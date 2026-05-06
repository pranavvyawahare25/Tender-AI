"""
Bidder upload and data extraction endpoints.
"""
import os
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import Optional

from config import SUPPORTED_EXTENSIONS
from storage import store, audit_log
from services import ocr_service, bidder_extractor, tamper_detector
from models.enums import AuditAction

router = APIRouter(prefix="/api", tags=["bidder"])


@router.post("/upload_bidder_docs/{tender_id}")
async def upload_bidder_docs(
    tender_id: str,
    files: list[UploadFile] = File(...),
    bidder_name: Optional[str] = Form(None),
):
    """Upload bidder documents (multiple files)."""
    session = store.get_session(tender_id)
    if not session:
        raise HTTPException(404, "Tender not found")

    bidder_id = store.generate_id()
    filenames = []

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(400, f"Unsupported file: {file.filename} ({ext})")
        content = await file.read()
        store.save_bidder_file(content, file.filename, tender_id, bidder_id)
        filenames.append(file.filename)

    # Update session with bidder info
    bidders = session.get("bidders", {})
    name = bidder_name or f"Bidder-{bidder_id[:6]}"
    bidders[bidder_id] = {
        "bidder_id": bidder_id,
        "bidder_name": name,
        "documents": filenames,
        "status": "uploaded",
        "extracted_data": [],
    }
    store.update_session(tender_id, {"bidders": bidders})

    audit_log.log_action(AuditAction.UPLOAD_BIDDER.value, tender_id=tender_id,
                         bidder_id=bidder_id,
                         details=f"Uploaded {len(filenames)} files for {name}")

    return {"id": bidder_id, "bidder_name": name, "filename": ", ".join(filenames),
            "message": f"Uploaded {len(filenames)} documents for {name}"}


@router.post("/extract_bidder_data/{tender_id}/{bidder_id}")
async def extract_bidder_data(tender_id: str, bidder_id: str):
    """Extract data from bidder documents."""
    session = store.get_session(tender_id)
    if not session:
        raise HTTPException(404, "Tender not found")

    bidders = session.get("bidders", {})
    if bidder_id not in bidders:
        raise HTTPException(404, "Bidder not found")

    # Process all bidder files
    files = store.get_bidder_files(tender_id, bidder_id)
    all_extracted = []
    all_tamper_flags = []   # aggregated across this bidder's documents

    for filepath in files:
        filename = os.path.basename(filepath)
        ocr_result = ocr_service.process_document(filepath)

        # ── Integrity / tamper detection ─────────────────────────
        tamper = tamper_detector.detect(ocr_result, filename=filename)
        if tamper.get("flags"):
            for fl in tamper["flags"]:
                fl["document"] = filename
                all_tamper_flags.append(fl)

        extracted = bidder_extractor.extract_bidder_data(
            ocr_result.full_text, filename,
            [p.to_dict() for p in ocr_result.pages],
            ocr_payload=ocr_result.to_llm_payload(),
        )
        all_extracted.extend(extracted)

        # Save per-file OCR result
        store.save_extraction(tender_id, f"bidder_{bidder_id}_{filename}_ocr", ocr_result.to_dict())

    # Deduplicate by field (keep highest confidence)
    deduped = {}
    for item in all_extracted:
        field = item["field"]
        if field not in deduped or item["confidence"] > deduped[field]["confidence"]:
            deduped[field] = item
    final_data = list(deduped.values())

    # Roll up tamper findings into a bidder-level summary
    severities = [f.get("severity") for f in all_tamper_flags]
    max_sev = "high" if "high" in severities else "medium" if "medium" in severities else "low" if severities else None
    tamper_summary = {
        "flags":        all_tamper_flags,
        "max_severity": max_sev,
        "summary":      (
            f"{len(all_tamper_flags)} integrity flag(s) — max severity: {max_sev}."
            if all_tamper_flags else "Integrity checks passed."
        ),
    }

    # Update session
    bidders[bidder_id]["extracted_data"] = final_data
    bidders[bidder_id]["tamper"] = tamper_summary
    bidders[bidder_id]["status"] = "extracted"
    store.update_session(tender_id, {"bidders": bidders})
    store.save_extraction(tender_id, f"bidder_{bidder_id}_data", {"data": final_data})

    tamper_note = ""
    if max_sev:
        tamper_note = f" · ⚠️ tamper {max_sev}"
    audit_log.log_action(AuditAction.EXTRACT_BIDDER_DATA.value, tender_id=tender_id,
                         bidder_id=bidder_id,
                         details=f"Extracted {len(final_data)} fields{tamper_note}")

    return {
        "id": bidder_id, "status": "completed",
        "items_extracted": len(final_data), "data": final_data,
        "tamper": tamper_summary,
    }


@router.get("/bidders/{tender_id}")
async def get_bidders(tender_id: str):
    """List all bidders for a tender."""
    session = store.get_session(tender_id)
    if not session:
        raise HTTPException(404, "Tender not found")
    return {"tender_id": tender_id, "bidders": session.get("bidders", {})}
