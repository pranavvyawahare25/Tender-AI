"""
Bidder Document Data Extractor.
Extracts relevant data from bidder submission documents.
"""
import re


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
    if amount >= 10_000_000:
        return f"₹{amount / 10_000_000:.1f} crore"
    elif amount >= 100_000:
        return f"₹{amount / 100_000:.1f} lakh"
    else:
        return f"₹{amount:,.0f}"


EXTRACTION_PATTERNS = [
    # Company name
    {"field": "company_name",
     "patterns": [
         r'(?:company\s*name|firm\s*name|name\s*of\s*(?:the\s*)?(?:firm|company|bidder|vendor))[\s:]+([A-Z][A-Za-z\s&.,]+(?:Ltd|Pvt|Private|Limited|LLP|Solutions|Systems|Infra|Corp|Inc)[\w.]*)',
         r'^([A-Z][A-Za-z\s&]+(?:Ltd|Pvt|Private|Limited|LLP|Solutions|Systems|Infra|Corp)[\w.]*)',
     ]},
    # Turnover
    {"field": "turnover",
     "patterns": [
         r'(?:annual\s*turnover|turnover|total\s*revenue|gross\s*revenue)[\s:]*(?:₹|Rs\.?|INR\.?\s*)?\s*(\d+[\d,.]*\s*(?:crore|cr\.?|lakh|lac|lakhs)?)',
         r'(?:turnover|revenue)[\s\S]{0,30}?(?:₹|Rs\.?|INR\.?\s*)\s*(\d+[\d,.]*\s*(?:crore|cr\.?|lakh|lac|lakhs)?)',
     ]},
    # Net worth
    {"field": "net_worth",
     "patterns": [
         r'(?:net\s*worth|networth)[\s:]*(?:₹|Rs\.?|INR\.?\s*)?\s*(\d+[\d,.]*\s*(?:crore|cr\.?|lakh|lac|lakhs)?)',
     ]},
    # Projects count
    {"field": "projects_completed",
     "patterns": [
         r'(?:completed|executed|undertaken|delivered)\s*(\d+)\s*(?:similar\s*)?(?:projects?|works?|contracts?|orders?)',
         r'(\d+)\s*(?:similar\s*)?(?:projects?|works?|contracts?)\s*(?:completed|executed|delivered)',
         r'(?:number\s*of\s*(?:similar\s*)?projects?)[\s:]*(\d+)',
     ]},
    # Years of experience
    {"field": "years_experience",
     "patterns": [
         r'(\d+)\s*(?:\+\s*)?years?\s*(?:of\s*)?(?:experience|exp\.?)',
         r'(?:experience|established|since)[\s:]*(\d{4})',
     ]},
]

COMPLIANCE_CHECKS = [
    {"field": "gst_registered", "patterns": [
        r'\bGST(?:IN|N)?\s*(?:No\.?|Number|Registration)?[\s:]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])',
        r'\bGST\s*(?:registered|registration\s*(?:certificate|no|number))',
    ]},
    {"field": "pan_number", "patterns": [
        r'\bPAN\s*(?:No\.?|Number|Card)?[\s:]*([A-Z]{5}[0-9]{4}[A-Z])',
        r'\bPAN\b.*(?:card|available|enclosed|attached)',
    ]},
    {"field": "iso_certified", "patterns": [
        r'ISO\s*(9001|14001|27001|45001)(?::\d{4})?',
        r'(?:certified|certification)\s*(?:under|for)\s*ISO',
    ]},
    {"field": "epfo_registered", "patterns": [
        r'\bEPF(?:O)?\s*(?:registration|registered|no|number)',
        r'(?:provident\s*fund)\s*(?:registration|registered)',
    ]},
    {"field": "not_blacklisted", "patterns": [
        r'(?:not|never)\s*(?:been\s*)?(?:black\s*listed|blacklisted|debarred)',
        r'(?:black\s*list|blacklist).*(?:no|nil|none|never)',
    ]},
]


def extract_bidder_data(text, filename="", pages=None):
    """Extract relevant data from bidder document text."""
    extracted = []
    pages = pages or []

    # Extract main fields
    for item in EXTRACTION_PATTERNS:
        for pattern in item["patterns"]:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                value = match.group(1).strip()
                page_num = _find_page(match.start(), pages, text)
                conf = 0.90

                # Parse financial amounts
                if item["field"] in ("turnover", "net_worth"):
                    amount = _parse_indian_amount(value)
                    if amount:
                        value = _format_indian_amount(amount)
                        conf = 0.92

                # Parse year-based experience
                if item["field"] == "years_experience" and len(value) == 4:
                    try:
                        year = int(value)
                        if 1900 < year < 2030:
                            value = str(2025 - year)
                            conf = 0.85
                    except ValueError:
                        pass

                extracted.append({
                    "field": item["field"],
                    "value": value,
                    "source_doc": filename,
                    "page": page_num,
                    "confidence": conf,
                    "raw_match": match.group(0)[:100],
                })
                break  # Use first matching pattern

    # Check compliance items
    for item in COMPLIANCE_CHECKS:
        for pattern in item["patterns"]:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                value = match.group(1) if match.lastindex else "Yes"
                page_num = _find_page(match.start(), pages, text)
                extracted.append({
                    "field": item["field"],
                    "value": value,
                    "source_doc": filename,
                    "page": page_num,
                    "confidence": 0.88,
                    "raw_match": match.group(0)[:100],
                })
                break

    return extracted


def _find_page(char_pos, pages, full_text):
    """Determine which page a character position falls on."""
    if not pages:
        return 1
    running = 0
    for p in pages:
        page_len = len(p.get("text", "")) if isinstance(p, dict) else len(getattr(p, "text", ""))
        running += page_len + 2  # account for page separator
        page_num = p.get("page_num", 1) if isinstance(p, dict) else getattr(p, "page_num", 1)
        if char_pos <= running:
            return page_num
    return pages[-1].get("page_num", 1) if isinstance(pages[-1], dict) else getattr(pages[-1], "page_num", 1)
