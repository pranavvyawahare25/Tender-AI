"""
LLM-based extractor — uses Groq (Llama-3 70B) for structured extraction.

Two responsibilities:
  1. extract_criteria_llm(text)        — pull eligibility criteria from a tender
  2. extract_bidder_data_llm(text, ..) — pull bidder-side fields from a submission

Both return the SAME schema as the regex-based extractors so the rest of the
pipeline (matching engine, confidence scorer, report generator) keeps working.

Failure semantics:
  - If GROQ_API_KEY is unset or USE_LLM_EXTRACTOR=0, returns None.
  - If the API call fails or JSON is malformed, returns None.
The caller falls back to the deterministic regex extractor when None is returned.
"""
import os
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
USE_LLM      = os.getenv("USE_LLM_EXTRACTOR", "1").strip() != "0"

_client = None


def _get_client():
    """Lazily import the Groq SDK so the backend still boots without it."""
    global _client
    if _client is not None:
        return _client
    if not USE_LLM or not GROQ_API_KEY:
        return None
    try:
        from groq import Groq
        _client = Groq(api_key=GROQ_API_KEY)
        return _client
    except Exception as e:
        logger.warning(f"Groq client init failed — LLM disabled: {e}")
        return None


def _call_groq(system: str, user: str, max_tokens: int = 2048) -> Optional[str]:
    """Call Groq with strict JSON-mode response. Returns raw text or None."""
    client = _get_client()
    if client is None:
        return None
    try:
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
            temperature=0.1,                # near-deterministic for evaluation work
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        return resp.choices[0].message.content
    except Exception as e:
        logger.warning(f"Groq call failed — falling back to regex: {e}")
        return None


# ─── Tender criteria extraction ────────────────────────────────────────
CRITERIA_SYSTEM = """You are a senior CRPF procurement analyst.
Read the tender / NIT document and extract every eligibility criterion the
bidder must satisfy. Distinguish technical, financial, and compliance
criteria. Mark each as mandatory or optional. Always return STRICT JSON
matching this schema, with no commentary:

{
  "criteria": [
    {
      "criterion":  "<short canonical name, e.g. Minimum Annual Turnover>",
      "value":      "<the threshold value verbatim, e.g. ₹5 crore or ISO 9001:2015>",
      "type":       "financial" | "technical" | "compliance",
      "mandatory":  true | false,
      "raw_text":   "<the exact sentence from the tender that establishes this criterion>"
    }
  ]
}

Rules:
- Always include the unit / amount / standard explicitly in `value`.
- For financial criteria, parse Indian-system amounts (crore = 10,000,000, lakh = 100,000).
- Mark a criterion mandatory unless the tender explicitly says "optional",
  "preferred", "desirable", or similar.
- If the tender repeats the same requirement in multiple sections, emit it ONCE.
- If you cannot find any criteria, return {"criteria": []}.
"""


def extract_criteria_llm(text: str) -> Optional[list[dict]]:
    """Returns a list of criterion dicts (regex-compatible) or None on failure."""
    if not USE_LLM or not GROQ_API_KEY:
        return None
    if not text or not text.strip():
        return None

    # Trim absurdly long tenders to fit context. 70B Llama has a 128k window
    # but we only need the eligibility section in practice.
    truncated = text[:60_000]
    raw = _call_groq(
        system=CRITERIA_SYSTEM,
        user=f"TENDER DOCUMENT:\n\n{truncated}",
        max_tokens=3000,
    )
    if raw is None:
        return None
    try:
        data = json.loads(raw)
        criteria = data.get("criteria", [])
        if not isinstance(criteria, list):
            return None
        # Backfill required fields the matching engine expects
        cleaned = []
        for c in criteria:
            if not isinstance(c, dict) or "criterion" not in c:
                continue
            cleaned.append({
                "criterion":  str(c.get("criterion", "")).strip(),
                "value":      str(c.get("value", "")).strip(),
                "type":       (c.get("type") or "compliance").lower(),
                "mandatory":  bool(c.get("mandatory", True)),
                "raw_text":   str(c.get("raw_text", "")).strip(),
                "source":     "llm",
            })
        return cleaned if cleaned else None
    except json.JSONDecodeError as e:
        logger.warning(f"LLM returned invalid JSON for criteria: {e}")
        return None


# ─── Bidder data extraction ────────────────────────────────────────────
BIDDER_SYSTEM = """You are a senior CRPF procurement analyst.
Read this bidder's submission document and extract every fact a procurement
officer would need to evaluate eligibility. Always return STRICT JSON in
this exact schema, with no commentary:

{
  "fields": [
    {
      "field":       "<canonical key — see list below>",
      "value":       "<the value, verbatim where possible>",
      "raw_text":    "<the exact sentence or table cell from the document>",
      "confidence":  0.0 to 1.0
    }
  ]
}

Use these canonical field keys when applicable (preferred):
  company_name, year_established, address, turnover, net_worth,
  projects_completed, years_experience, gst_registered, pan_number,
  iso_certified, epfo_registered, esic_registered, msme_registered,
  not_blacklisted, emd_amount, similar_projects_list

Rules:
- For turnover and net_worth, give the most recent year's figure (verbatim, e.g. "Rs. 8.0 Crore").
- For boolean fields like gst_registered / iso_certified — value should be "Yes" or "No"
  if you can tell, else copy the relevant phrase verbatim.
- For projects_completed give an integer count (e.g. "5").
- confidence reflects how clearly the field is stated. 0.95+ for explicit tables,
  0.75–0.9 for narrative mentions, 0.5–0.7 for ambiguous phrasing.
- If you can't find a field, omit it (don't invent values).
"""


def extract_bidder_data_llm(text: str,
                            filename: str = "",
                            page_count: int = 1) -> Optional[list[dict]]:
    """Returns a list of bidder field dicts compatible with the matching engine, or None."""
    if not USE_LLM or not GROQ_API_KEY:
        return None
    if not text or not text.strip():
        return None

    truncated = text[:60_000]
    raw = _call_groq(
        system=BIDDER_SYSTEM,
        user=f"BIDDER DOCUMENT ({filename}):\n\n{truncated}",
        max_tokens=2500,
    )
    if raw is None:
        return None
    try:
        data = json.loads(raw)
        fields = data.get("fields", [])
        if not isinstance(fields, list):
            return None
        cleaned = []
        for f in fields:
            if not isinstance(f, dict) or "field" not in f or "value" not in f:
                continue
            try:
                conf = float(f.get("confidence", 0.85))
            except (TypeError, ValueError):
                conf = 0.85
            conf = max(0.0, min(1.0, conf))
            cleaned.append({
                "field":      str(f.get("field", "")).strip(),
                "value":      str(f.get("value", "")).strip(),
                "raw_text":   str(f.get("raw_text", "")).strip(),
                "confidence": conf,
                "source_doc": filename,
                "page":       1,            # page-level localisation not yet returned
                "source":     "llm",
            })
        return cleaned if cleaned else None
    except json.JSONDecodeError as e:
        logger.warning(f"LLM returned invalid JSON for bidder: {e}")
        return None


def llm_status() -> dict:
    """Diagnostic helper — useful for the /health endpoint and audit log."""
    return {
        "enabled":   USE_LLM,
        "key_set":   bool(GROQ_API_KEY),
        "model":     GROQ_MODEL,
        "available": _get_client() is not None,
    }
