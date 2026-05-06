"""
CAG audit pack — bundles every artefact a CAG auditor would ask for
into a single ZIP, plus a SHA-256 hash chain manifest so any tampering
with the pack itself can be detected post-hoc.

Contents of the ZIP:
  manifest.json         hash chain + provenance metadata
  cover.txt             plain-English summary
  session.json          tender session (criteria, bidders, status)
  criteria.json         AI-extracted criteria
  evaluation.json       evaluations + summary
  audit_log.jsonl       only entries for THIS tender
  bidders/<bid>/data.json
  bidders/<bid>/ocr/*.json
  tender/<original-file>

Public API:
    build_audit_pack(tender_id) -> bytes   (ZIP)
"""
import io
import json
import os
import zipfile
import hashlib
from datetime import datetime

from config import EXTRACTIONS_DIR, EVALUATIONS_DIR, TENDERS_DIR
from storage import store, audit_log


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _add(zf: zipfile.ZipFile, path: str, content):
    """Add bytes/str content to ZIP and return its SHA-256."""
    if isinstance(content, str):
        content = content.encode("utf-8")
    zf.writestr(path, content)
    return _sha256(content)


def _read_file(path: str) -> bytes | None:
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        return f.read()


def build_audit_pack(tender_id: str) -> bytes:
    session = store.get_session(tender_id)
    if not session:
        raise ValueError(f"No session for tender {tender_id}")

    evaluation = store.load_evaluation(tender_id) or {}
    criteria = session.get("criteria", [])
    bidders = session.get("bidders", {})

    # Filter audit log to this tender
    log_all = audit_log.get_log()
    log_tender = [e for e in log_all if (e.get("tender_id") or "") == tender_id]

    buf = io.BytesIO()
    manifest_entries = []   # (path, sha256)

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # ── Cover sheet ───────────────────────────────────────────
        cover = _build_cover(tender_id, session, evaluation, criteria, bidders, log_tender)
        manifest_entries.append(("cover.txt", _add(zf, "cover.txt", cover)))

        # ── Core JSON artefacts ───────────────────────────────────
        manifest_entries.append((
            "session.json",
            _add(zf, "session.json", json.dumps(session, indent=2, ensure_ascii=False)),
        ))
        manifest_entries.append((
            "criteria.json",
            _add(zf, "criteria.json", json.dumps({"criteria": criteria}, indent=2, ensure_ascii=False)),
        ))
        manifest_entries.append((
            "evaluation.json",
            _add(zf, "evaluation.json", json.dumps(evaluation, indent=2, ensure_ascii=False)),
        ))

        # Audit log — JSONL one event per line (CAG-friendly)
        log_jsonl = "\n".join(json.dumps(e, ensure_ascii=False) for e in log_tender)
        manifest_entries.append(("audit_log.jsonl", _add(zf, "audit_log.jsonl", log_jsonl)))

        # ── Per-bidder folders ────────────────────────────────────
        for bid, info in bidders.items():
            b_path = f"bidders/{bid}"
            data = {
                "bidder_id":      bid,
                "bidder_name":    info.get("bidder_name"),
                "documents":      info.get("documents", []),
                "extracted_data": info.get("extracted_data", []),
                "tamper":         info.get("tamper"),
                "status":         info.get("status"),
            }
            manifest_entries.append((
                f"{b_path}/data.json",
                _add(zf, f"{b_path}/data.json", json.dumps(data, indent=2, ensure_ascii=False)),
            ))

            # Per-document OCR snapshots
            ocr_dir = os.path.join(EXTRACTIONS_DIR, tender_id)
            if os.path.isdir(ocr_dir):
                for fn in os.listdir(ocr_dir):
                    if fn.startswith(f"bidder_{bid}_") and fn.endswith("_ocr.json"):
                        full = os.path.join(ocr_dir, fn)
                        content = _read_file(full)
                        if content:
                            manifest_entries.append((
                                f"{b_path}/ocr/{fn}",
                                _add(zf, f"{b_path}/ocr/{fn}", content),
                            ))

        # ── Original tender file ──────────────────────────────────
        tender_dir = os.path.join(TENDERS_DIR, tender_id)
        if os.path.isdir(tender_dir):
            for fn in os.listdir(tender_dir):
                full = os.path.join(tender_dir, fn)
                content = _read_file(full)
                if content is not None:
                    manifest_entries.append((
                        f"tender/{fn}",
                        _add(zf, f"tender/{fn}", content),
                    ))

        # ── Manifest with hash chain ──────────────────────────────
        # Chain hash: hash(prev_chain_hash + file_sha) for each file in order.
        chain = ""
        chained = []
        for path, sha in manifest_entries:
            chain = _sha256((chain + sha).encode())
            chained.append({"path": path, "sha256": sha, "chain_sha256": chain})

        manifest = {
            "audit_pack_version": "1.0",
            "tender_id":          tender_id,
            "tender_filename":    session.get("filename"),
            "tender_title":       session.get("title", ""),
            "generated_at":       datetime.now().isoformat(),
            "generator":          "TenderAI Audit Pack v1",
            "compliance_basis": [
                "GFR 2017 — Rule 173 (e-Procurement)",
                "Central Vigilance Commission — Manual for Procurement of Goods, 2022",
                "Right to Information Act, 2005 — Section 4 (proactive disclosure)",
                "Comptroller and Auditor-General — Procurement Audit Guidelines",
            ],
            "files":              chained,
            "final_chain_sha256": chain,
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))

    return buf.getvalue()


def _build_cover(tender_id, session, evaluation, criteria, bidders, log) -> str:
    title = session.get("title") or session.get("filename") or "Untitled tender"
    summary = evaluation.get("summary") or {}
    eligible = summary.get("eligible") or []
    not_eligible = summary.get("not_eligible") or []
    review = summary.get("needs_review") or []

    lines = [
        "TenderAI — CAG Audit Pack",
        "=" * 60,
        f"Tender ID:      {tender_id}",
        f"Title:          {title}",
        f"Filename:       {session.get('filename', '—')}",
        f"Generated at:   {datetime.now().isoformat()}",
        "",
        "Compliance basis (claimed):",
        "  • GFR 2017 Rule 173 (e-Procurement)",
        "  • CVC Manual for Procurement of Goods, 2022",
        "  • RTI Act 2005 §4 (proactive disclosure)",
        "  • CAG Procurement Audit Guidelines",
        "",
        f"Criteria extracted:  {len(criteria)}",
        f"Bidders submitted:   {len(bidders)}",
        f"Evaluations on file: {len(evaluation.get('evaluations', []))}",
        f"Audit log entries:   {len(log)}",
        "",
        "Outcome summary:",
        f"  Eligible      : {len(eligible)}  — {', '.join(eligible)  or 'none'}",
        f"  Not eligible  : {len(not_eligible)}  — {', '.join(not_eligible) or 'none'}",
        f"  Needs review  : {len(review)}  — {', '.join(review) or 'none'}",
        "",
        "Pack contents:",
        "  manifest.json     hash chain + provenance",
        "  session.json      complete tender session",
        "  criteria.json     AI-extracted criteria",
        "  evaluation.json   evaluations + summary",
        "  audit_log.jsonl   tender-scoped audit trail",
        "  bidders/<id>/     per-bidder data + OCR snapshots",
        "  tender/<files>    original NIT file(s) preserved",
        "",
        "Integrity:",
        "  Every file in the pack is hashed (SHA-256). The hashes are",
        "  combined into a chain so any tampering with the pack itself,",
        "  including the audit log or evaluation file, breaks the final",
        "  chain hash recorded in manifest.json.",
        "",
        "— end of cover —",
    ]
    return "\n".join(lines)
