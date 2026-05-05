"""
Tender Criteria Extractor — hybrid LLM + regex.

Strategy:
  1. Try the LLM-based extractor (Groq · Llama-3 70B) first.
     It handles linguistic variation regex can't.
  2. If the LLM is disabled, fails, or returns < 2 criteria, fall through
     to the deterministic regex pipeline below.
  3. Merge: any criterion found by regex but missed by the LLM is added
     back, so we never lose recall.

This gives us the AI talking point AND the auditable deterministic backbone.
"""
import re
import logging
from models.enums import CriterionType
from services import llm_extractor

logger = logging.getLogger(__name__)


def _parse_indian_amount(text):
    """Parse Indian currency amounts. Returns value as raw number."""
    text = text.strip()
    m = re.search(r'(\d+[\d,.]*)\s*(?:crore|cr\.?)\b', text, re.IGNORECASE)
    if m:
        return float(m.group(1).replace(",", "")) * 10_000_000
    m = re.search(r'(\d+[\d,.]*)\s*(?:lakh|lac|lakhs)\b', text, re.IGNORECASE)
    if m:
        return float(m.group(1).replace(",", "")) * 100_000
    m = re.search(r'(\d{1,3}(?:,\d{2})*(?:,\d{3})?|\d+)', text)
    if m:
        return float(m.group(1).replace(",", ""))
    return None


def _format_indian_amount(amount):
    """Format a number as Indian currency string."""
    if amount >= 10_000_000:
        return f"₹{amount / 10_000_000:.1f} crore"
    elif amount >= 100_000:
        return f"₹{amount / 100_000:.1f} lakh"
    else:
        return f"₹{amount:,.0f}"


FINANCIAL_PATTERNS = [
    {"pattern": r'(?:minimum|min\.?|average|annual)\s*(?:annual\s*)?(?:turnover|turn\s*over)[\s:]*(?:of\s*)?(?:₹|Rs\.?|INR\.?\s*)?\s*(\d+[\d,.]*)\s*(?:crore|cr\.?|lakh|lac|lakhs)?',
     "criterion": "Minimum Annual Turnover", "type": CriterionType.FINANCIAL},
    {"pattern": r'(?:minimum|min\.?)\s*(?:net\s*worth|networth)[\s:]*(?:of\s*)?(?:₹|Rs\.?|INR\.?\s*)?\s*(\d+[\d,.]*)\s*(?:crore|cr\.?|lakh|lac|lakhs)?',
     "criterion": "Minimum Net Worth", "type": CriterionType.FINANCIAL},
]

TECHNICAL_PATTERNS = [
    {"pattern": r'(?:minimum|min\.?|at\s*least)\s*(\d+)\s*(?:similar|completed|successful)?\s*(?:projects?|works?|contracts?|orders?)',
     "criterion": "Minimum Similar Projects", "type": CriterionType.TECHNICAL},
    {"pattern": r'(?:minimum|min\.?|at\s*least)\s*(\d+)\s*(?:years?)\s*(?:of\s*)?(?:experience|exp\.?)',
     "criterion": "Minimum Years of Experience", "type": CriterionType.TECHNICAL},
]

COMPLIANCE_KEYWORDS = [
    {"keyword": r'\bGST\b.*(?:registration|registered|certificate|number|no\.?)', "criterion": "GST Registration", "type": CriterionType.COMPLIANCE},
    {"keyword": r'\bPAN\b.*(?:card|number|no\.?|copy)', "criterion": "PAN Card", "type": CriterionType.COMPLIANCE},
    {"keyword": r'\bISO\s*(?:9001|14001|27001|45001)', "criterion": "ISO Certification", "type": CriterionType.COMPLIANCE},
    {"keyword": r'\bEPFO?\b.*(?:registration|registered|certificate)', "criterion": "EPFO Registration", "type": CriterionType.COMPLIANCE},
    {"keyword": r'\bESIC?\b.*(?:registration|registered|certificate)', "criterion": "ESIC Registration", "type": CriterionType.COMPLIANCE},
    {"keyword": r'(?:not\s*)?(?:black\s*listed|blacklisted|debarred)', "criterion": "Not Blacklisted Declaration", "type": CriterionType.COMPLIANCE},
]


def extract_criteria(text):
    """
    Extract eligibility criteria from tender document text.

    Hybrid pipeline:
      1. LLM-first (Groq Llama-3 70B) — best at linguistic variation.
      2. Regex fallback / merge — guarantees recall for known patterns.
    """
    # ── 1. Try the LLM ──────────────────────────────────────────────
    llm_criteria = llm_extractor.extract_criteria_llm(text)
    if llm_criteria and len(llm_criteria) >= 2:
        logger.info(f"LLM extractor returned {len(llm_criteria)} criteria")
        # Merge: add any regex-found criterion the LLM missed (recall safety net)
        regex_criteria = _extract_criteria_regex(text)
        seen_names = {c["criterion"].lower() for c in llm_criteria}
        for rc in regex_criteria:
            if rc["criterion"].lower() not in seen_names:
                rc["source"] = "regex-fallback"
                llm_criteria.append(rc)
                seen_names.add(rc["criterion"].lower())
        return llm_criteria

    # ── 2. LLM unavailable or returned too little — pure regex path
    logger.info("LLM extractor unavailable or insufficient — using regex pipeline")
    return _extract_criteria_regex(text)


def _extract_criteria_regex(text):
    """The original deterministic regex extractor — kept as a safety net."""
    criteria = []
    seen = set()
    search_text = _find_eligibility_section(text) or text

    # Financial
    for pat in FINANCIAL_PATTERNS:
        for match in re.finditer(pat["pattern"], search_text, re.IGNORECASE):
            key = pat["criterion"]
            if key in seen:
                continue
            seen.add(key)
            full_match = match.group(0)
            amount = _parse_indian_amount(full_match)
            formatted = _format_indian_amount(amount) if amount else match.group(1)
            criteria.append({
                "criterion": key, "value": formatted, "type": pat["type"].value,
                "mandatory": True, "raw_text": full_match.strip(), "parsed_amount": amount,
            })

    # Technical
    for pat in TECHNICAL_PATTERNS:
        for match in re.finditer(pat["pattern"], search_text, re.IGNORECASE):
            key = pat["criterion"]
            if key in seen:
                continue
            seen.add(key)
            criteria.append({
                "criterion": key, "value": match.group(1), "type": pat["type"].value,
                "mandatory": True, "raw_text": match.group(0).strip(),
            })

    # Compliance
    for comp in COMPLIANCE_KEYWORDS:
        match = re.search(comp["keyword"], search_text, re.IGNORECASE)
        if match and comp["criterion"] not in seen:
            seen.add(comp["criterion"])
            start = max(0, match.start() - 30)
            end = min(len(search_text), match.end() + 70)
            value = "Required"
            if "ISO" in comp["criterion"]:
                iso_m = re.search(r'ISO\s*(9001|14001|27001|45001)', search_text, re.IGNORECASE)
                if iso_m:
                    value = f"ISO {iso_m.group(1)} Required"
            criteria.append({
                "criterion": comp["criterion"], "value": value, "type": comp["type"].value,
                "mandatory": True, "raw_text": search_text[start:end].strip(),
            })

    return criteria


def _find_eligibility_section(text):
    """Locate the eligibility section of the tender."""
    headers = [
        r'(?:eligibility\s*criteria|pre[\s-]*qualification\s*requirements?|PQR)',
        r'(?:qualification\s*criteria|minimum\s*eligibility)',
    ]
    for header in headers:
        match = re.search(header, text, re.IGNORECASE)
        if match:
            start = match.start()
            next_sec = re.search(
                r'\n\s*(?:\d+\.\s*)?(?:scope\s*of\s*work|technical\s*specification|bill\s*of\s*quantities|terms?\s*and\s*conditions?)',
                text[start + 50:], re.IGNORECASE
            )
            end = start + 50 + next_sec.start() if next_sec else min(start + 3000, len(text))
            return text[start:end]
    return None
