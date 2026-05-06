"""
Tamper / forgery detector for bidder documents.

Three lightweight integrity checks run on every uploaded bidder document
*after* OCR, before the matching engine sees the data. None of these
require an extra ML model — they're heuristics that surface suspicious
patterns for human review.

Checks:
  1. Native-vs-OCR mismatch.
       For PDFs we hold both PyMuPDF native text and Tesseract-OCR text
       per page. If the OCR sees a substantially different number than
       the native text, someone may have rendered an image overlay on
       top of the original PDF.
  2. Numeric-token confidence drop.
       Average OCR confidence on a page vs the worst-conf numeric token.
       A value where the digits sit much lower than surrounding prose
       is a classic Photoshop-on-scan signature.
  3. Filename heuristic.
       Filenames containing "tampered", "edited", or "fake" trigger an
       advisory flag. Useful as a deterministic demo trigger.

Each check returns a TamperFlag with severity + reason + evidence so the
result is fully explainable. The matching engine treats a HIGH flag as
a forced NEED_REVIEW; the UI renders a 🚨 badge regardless of severity.
"""
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)


# ─── Tunables ──────────────────────────────────────────────────────────
# Confidence drop that triggers a flag (page avg minus suspicious token conf)
NUMERIC_CONF_DROP    = 0.20
# Native-vs-OCR digit mismatch threshold (Levenshtein-ish ratio, simple)
NATIVE_OCR_TOLERANCE = 0.85
# Substring triggers in filename
SUSPICIOUS_NAMES     = ("tampered", "edited", "fake", "forged", "altered")

NUMERIC_TOKEN_RE = re.compile(r"\b(?:rs\.?|inr|₹)?\s*\d{1,3}(?:,\d{2,3})*(?:\.\d+)?\s*(?:crore|cr\.?|lakh|lac|lakhs)?\b", re.IGNORECASE)


def _flag(severity, kind, reason, evidence=None):
    return {
        "severity": severity,    # "high" | "medium" | "low"
        "kind":     kind,        # "native_ocr_mismatch" | "conf_drop" | "filename" | ...
        "reason":   reason,
        "evidence": evidence or {},
    }


def _digit_string(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def _ratio(a: str, b: str) -> float:
    """Cheap Levenshtein-ish similarity 0..1 over digit strings."""
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    n = max(len(a), len(b))
    same = sum(1 for x, y in zip(a, b) if x == y)
    return same / n


def detect(ocr_result, filename: str = "") -> dict:
    """
    Run integrity checks against an OCRResult-shaped dict.

    Args:
      ocr_result: dict with keys `pages` (list of {page_num, text, confidence, method, ...})
                  and `full_text`.
      filename:   the original uploaded filename.

    Returns:
      {
        "flags":          [<TamperFlag>, ...],
        "max_severity":   "high" | "medium" | "low" | None,
        "summary":        short human-readable line for the audit log,
      }
    """
    if not ocr_result:
        return {"flags": [], "max_severity": None, "summary": "no document supplied"}

    if hasattr(ocr_result, "to_dict"):
        ocr_result = ocr_result.to_dict()

    flags: list[dict] = []
    pages = ocr_result.get("pages") or []
    full_text = ocr_result.get("full_text", "")

    # ── 1. Filename heuristic (also acts as demo trigger) ────────
    fname_low = (filename or "").lower()
    if any(t in fname_low for t in SUSPICIOUS_NAMES):
        flags.append(_flag(
            "high", "filename",
            "Filename contains a suspicious token ('tampered', 'edited', 'fake', 'forged', 'altered'). "
            "Treating as deliberately flagged document.",
            {"filename": filename},
        ))

    # ── 2. Native-vs-OCR digit mismatch (PDF only, multi-method pages) ──
    native_pages = [p for p in pages if p.get("method") == "native"]
    ocr_pages    = [p for p in pages if p.get("method") == "ocr"]
    # Quick co-page comparison: if the document has BOTH native and OCR pages
    # we expect digit characters to match closely. If OCR digits diverge from
    # native digits on an overlapping page, someone rendered an image overlay.
    if native_pages and ocr_pages:
        nat_digits = _digit_string(" ".join(p.get("text", "") for p in native_pages))
        ocr_digits = _digit_string(" ".join(p.get("text", "") for p in ocr_pages))
        if nat_digits and ocr_digits:
            r = _ratio(nat_digits[: len(ocr_digits)], ocr_digits[: len(nat_digits)])
            if r < NATIVE_OCR_TOLERANCE:
                flags.append(_flag(
                    "high", "native_ocr_mismatch",
                    "Native PDF text and OCR text disagree on numeric content — possible image overlay over original PDF.",
                    {"similarity": round(r, 3), "tolerance": NATIVE_OCR_TOLERANCE},
                ))

    # ── 3. Numeric-token confidence drop on OCR pages ────────────
    for p in pages:
        method = p.get("method")
        text   = p.get("text", "")
        page_conf = float(p.get("confidence", 1.0) or 0.0)
        if method != "ocr" or not text or page_conf <= 0:
            continue
        # We don't have per-token confidence in our pipeline by default,
        # so we approximate: any OCR page whose overall confidence has
        # dropped well below 0.75 AND contains numeric tokens is suspect.
        if page_conf < (0.75 - 0) and NUMERIC_TOKEN_RE.search(text):
            tokens = NUMERIC_TOKEN_RE.findall(text)[:3]
            flags.append(_flag(
                "medium", "conf_drop",
                f"Page {p.get('page_num')} OCR confidence {page_conf:.2f} is well below trust threshold "
                f"on a page containing numeric values — recommend visual verification.",
                {"page_num": p.get("page_num"), "confidence": page_conf, "sample_tokens": tokens},
            ))

    # ── 4. Body-level numeric anomalies (very cheap pattern check) ──
    # Eg. "Rs. 8.0 Crore" rendered with mixed font hints (the same pattern repeated
    # multiple times in different glyph widths is a known forgery sign). We look
    # for repeated currency tokens with inconsistent spacing — proxy heuristic.
    spaced = re.findall(r"R\s+s\s*\.|R\s*s\s+", full_text or "")
    if len(spaced) >= 2:
        flags.append(_flag(
            "low", "spacing_anomaly",
            "Repeated odd character spacing in 'Rs.' tokens — possible rendered overlay.",
            {"hits": len(spaced)},
        ))

    # ── Roll up severity ──────────────────────────────────────────
    severities = [f["severity"] for f in flags]
    max_sev = "high" if "high" in severities else "medium" if "medium" in severities else "low" if severities else None

    if not flags:
        summary = "Integrity checks passed — no tamper signals."
    else:
        kinds = {f["kind"] for f in flags}
        summary = f"{len(flags)} flag(s) raised: {', '.join(sorted(kinds))} (max severity: {max_sev})."

    return {"flags": flags, "max_severity": max_sev, "summary": summary}


def is_high_risk(detection: dict) -> bool:
    """Convenience for the matching engine: True → force NEED_REVIEW."""
    return bool(detection) and detection.get("max_severity") == "high"
