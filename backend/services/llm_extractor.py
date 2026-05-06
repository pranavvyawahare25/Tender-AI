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
import json
import logging
from typing import Optional
from config import (
    GROQ_API_KEY, GROQ_MODEL, USE_LLM_EXTRACTOR, LLM_TIMEOUT,
    LLM_PROVIDER, OLLAMA_HOST, OLLAMA_MODEL,
)

logger = logging.getLogger(__name__)

GROQ_API_KEY = (GROQ_API_KEY or "").strip()
GROQ_MODEL   = (GROQ_MODEL or "llama-3.3-70b-versatile").strip()
USE_LLM      = USE_LLM_EXTRACTOR
PROVIDER     = (LLM_PROVIDER or "groq").lower()  # "groq" | "ollama" | "auto"

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
        _client = Groq(api_key=GROQ_API_KEY, timeout=LLM_TIMEOUT)
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


def _call_ollama(system: str, user: str, max_tokens: int = 2048) -> Optional[str]:
    """
    Call a self-hosted Ollama instance — keeps tender data inside your
    container / Indian infrastructure. Same JSON contract as Groq.
    Activate via LLM_PROVIDER=ollama in .env.
    """
    if not USE_LLM:
        return None
    try:
        import httpx
        url = f"{OLLAMA_HOST}/api/chat"
        payload = {
            "model": OLLAMA_MODEL,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.1, "num_predict": max_tokens},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
        }
        with httpx.Client(timeout=LLM_TIMEOUT) as cli:
            r = cli.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
        return (data.get("message") or {}).get("content")
    except Exception as e:
        logger.warning(f"Ollama call failed ({OLLAMA_HOST}) — falling back: {e}")
        return None


def _call_llm(system: str, user: str, max_tokens: int = 2048) -> Optional[str]:
    """
    Provider-aware dispatch. Default is groq.
    `auto` tries ollama first (sovereign) then groq.
    """
    if PROVIDER == "ollama":
        return _call_ollama(system, user, max_tokens)
    if PROVIDER == "auto":
        out = _call_ollama(system, user, max_tokens)
        if out is not None:
            return out
        return _call_groq(system, user, max_tokens)
    # default
    return _call_groq(system, user, max_tokens)


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
      "raw_text":   "<the exact sentence from the tender that establishes this criterion>",
      "llm_reasoning": "<brief reason this sentence establishes the criterion>"
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


def _coerce_ocr_text(document_input) -> str:
    """Accept raw text or OCRResult/to_dict payloads and return LLM-ready text."""
    if isinstance(document_input, dict):
        return str(document_input.get("llm_text") or document_input.get("full_text") or "")
    return str(document_input or "")


def _llm_available() -> bool:
    """LLM is callable if either Groq key (cloud) or Ollama (sovereign) is wired up."""
    if not USE_LLM:
        return False
    if PROVIDER == "ollama":
        return True   # we attempt Ollama; it'll log + return None on failure
    if PROVIDER == "auto":
        return True
    return bool(GROQ_API_KEY)


def extract_criteria_llm(text: str | dict) -> Optional[list[dict]]:
    """Returns a list of criterion dicts (regex-compatible) or None on failure."""
    text = _coerce_ocr_text(text)
    if not _llm_available():
        return None
    if not text or not text.strip():
        return None

    # Trim absurdly long tenders to fit context. 70B Llama has a 128k window
    # but we only need the eligibility section in practice.
    truncated = text[:60_000]
    raw = _call_llm(
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
                "llm_reasoning": str(c.get("llm_reasoning", "")).strip(),
                "source":     "llm",
                "extraction_source": "llm",
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
      "llm_reasoning": "<brief reason this value is the correct field>",
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


def extract_bidder_data_llm(text: str | dict,
                            filename: str = "",
                            page_count: int = 1) -> Optional[list[dict]]:
    """Returns a list of bidder field dicts compatible with the matching engine, or None."""
    if isinstance(text, dict):
        filename = filename or str(text.get("filename") or "")
        page_count = int(text.get("page_count") or page_count or 1)
    text = _coerce_ocr_text(text)
    if not _llm_available():
        return None
    if not text or not text.strip():
        return None

    truncated = text[:60_000]
    raw = _call_llm(
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
                "llm_reasoning": str(f.get("llm_reasoning", "")).strip(),
                "confidence": conf,
                "source_doc": filename,
                "page":       1,            # page-level localisation not yet returned
                "source":     "llm",
                "extraction_source": "llm",
            })
        return cleaned if cleaned else None
    except json.JSONDecodeError as e:
        logger.warning(f"LLM returned invalid JSON for bidder: {e}")
        return None


def llm_status() -> dict:
    """Diagnostic helper — useful for the /health endpoint and audit log."""
    sovereign = PROVIDER in ("ollama",)   # data stays inside your container
    return {
        "enabled":     USE_LLM,
        "provider":    PROVIDER,
        "model":       OLLAMA_MODEL if PROVIDER == "ollama" else GROQ_MODEL,
        "ollama_host": OLLAMA_HOST if PROVIDER in ("ollama", "auto") else None,
        "key_set":     bool(GROQ_API_KEY),
        "sovereign":   sovereign,
        "available":   _llm_available(),
    }
