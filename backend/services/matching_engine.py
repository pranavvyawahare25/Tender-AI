"""
Matching Engine for evaluating bidders against tender criteria.
Compares extracted bidder data with tender requirements using
rule-based logic with explainable decisions.
"""
import re
from models.enums import Decision, CriterionType
from services.confidence_scorer import score_extraction, needs_review


def _parse_amount(value_str):
    """Parse a monetary value string to a number."""
    if not value_str:
        return None
    text = str(value_str).strip()
    m = re.search(r'(\d+[\d,.]*)\s*(?:crore|cr\.?)\b', text, re.IGNORECASE)
    if m:
        return float(m.group(1).replace(",", "")) * 10_000_000
    m = re.search(r'(\d+[\d,.]*)\s*(?:lakh|lac|lakhs)\b', text, re.IGNORECASE)
    if m:
        return float(m.group(1).replace(",", "")) * 100_000
    m = re.search(r'[\d,.]+', text)
    if m:
        return float(m.group(0).replace(",", ""))
    return None


def _parse_int(value_str):
    """Parse an integer from string."""
    if not value_str:
        return None
    m = re.search(r'(\d+)', str(value_str))
    return int(m.group(1)) if m else None


# Field mapping: criterion name → bidder data field(s)
CRITERION_TO_FIELDS = {
    "Minimum Annual Turnover": ["turnover"],
    "Minimum Net Worth": ["net_worth"],
    "Minimum Revenue": ["turnover"],
    "Minimum Similar Projects": ["projects_completed"],
    "Minimum Years of Experience": ["years_experience"],
    "GST Registration": ["gst_registered"],
    "PAN Card": ["pan_number"],
    "ISO Certification": ["iso_certified"],
    "EPFO Registration": ["epfo_registered"],
    "ESIC Registration": ["esic_registered"],
    "Not Blacklisted Declaration": ["not_blacklisted"],
    "MSME/Udyam Registration": ["msme_registered"],
}


def evaluate_bidder(criteria, bidder_data, bidder_name="", ocr_confidence=0.95):
    """
    Evaluate a single bidder against all criteria.
    Returns list of EvalResult dicts.
    """
    # Build lookup from bidder data
    bidder_lookup = {}
    for item in bidder_data:
        field = item.get("field", "")
        bidder_lookup[field] = item

    results = []

    for criterion in criteria:
        crit_name = criterion.get("criterion", "")
        crit_value = criterion.get("value", "")
        crit_type = criterion.get("type", "compliance")

        # Find matching bidder data
        matching_fields = CRITERION_TO_FIELDS.get(crit_name, [])
        bidder_item = None
        for field in matching_fields:
            if field in bidder_lookup:
                bidder_item = bidder_lookup[field]
                break

        if bidder_item is None:
            # No matching data found → NEED_REVIEW
            results.append({
                "criterion": f"{crit_name} ({crit_value})",
                "criterion_value": crit_value,
                "criterion_type": crit_type,
                "bidder_value": "Not found",
                "document": "",
                "page": 0,
                "decision": Decision.NEED_REVIEW.value,
                "reason": f"No matching data found in bidder documents for '{crit_name}'",
                "confidence": 0.0,
                "overridden": False,
                "override_reason": "",
            })
            continue

        bidder_value = bidder_item.get("value", "")
        extraction_conf = bidder_item.get("confidence", 0.5)
        combined_conf = score_extraction(ocr_confidence, extraction_conf)
        source_doc = bidder_item.get("source_doc", "")
        page = bidder_item.get("page", 0)

        # Low confidence → automatic NEED_REVIEW
        if needs_review(combined_conf):
            results.append({
                "criterion": f"{crit_name} ({crit_value})",
                "criterion_value": crit_value,
                "criterion_type": crit_type,
                "bidder_value": bidder_value,
                "document": source_doc,
                "page": page,
                "decision": Decision.NEED_REVIEW.value,
                "reason": f"Low confidence extraction ({combined_conf:.2f}). Manual verification recommended.",
                "confidence": combined_conf,
                "overridden": False,
                "override_reason": "",
            })
            continue

        # Evaluate based on criterion type
        if crit_type == CriterionType.FINANCIAL.value:
            result = _evaluate_financial(crit_name, crit_value, bidder_value, criterion)
        elif crit_type == CriterionType.TECHNICAL.value:
            result = _evaluate_technical(crit_name, crit_value, bidder_value)
        else:
            result = _evaluate_compliance(crit_name, crit_value, bidder_value)

        result.update({
            "criterion": f"{crit_name} ({crit_value})",
            "criterion_value": crit_value,
            "criterion_type": crit_type,
            "bidder_value": bidder_value,
            "document": source_doc,
            "page": page,
            "confidence": combined_conf,
            "overridden": False,
            "override_reason": "",
        })
        results.append(result)

    return results


def _evaluate_financial(crit_name, crit_value, bidder_value, criterion):
    """Evaluate a financial criterion (numeric comparison)."""
    req_amount = criterion.get("parsed_amount") or _parse_amount(crit_value)
    bid_amount = _parse_amount(bidder_value)

    if req_amount is None or bid_amount is None:
        return {
            "decision": Decision.NEED_REVIEW.value,
            "reason": f"Could not parse amounts for comparison. Required: '{crit_value}', Bidder: '{bidder_value}'",
        }

    if bid_amount >= req_amount:
        return {
            "decision": Decision.PASS.value,
            "reason": f"Bidder value ({bidder_value}) meets or exceeds requirement ({crit_value})",
        }
    else:
        return {
            "decision": Decision.FAIL.value,
            "reason": f"Bidder value ({bidder_value}) is below requirement ({crit_value})",
        }


def _evaluate_technical(crit_name, crit_value, bidder_value):
    """Evaluate a technical criterion (numeric comparison)."""
    req_num = _parse_int(crit_value)
    bid_num = _parse_int(bidder_value)

    if req_num is None or bid_num is None:
        return {
            "decision": Decision.NEED_REVIEW.value,
            "reason": f"Could not parse values. Required: '{crit_value}', Bidder: '{bidder_value}'",
        }

    if bid_num >= req_num:
        return {
            "decision": Decision.PASS.value,
            "reason": f"Bidder has {bidder_value} (required: {crit_value})",
        }
    else:
        return {
            "decision": Decision.FAIL.value,
            "reason": f"Bidder has {bidder_value} (required: {crit_value})",
        }


def _evaluate_compliance(crit_name, crit_value, bidder_value):
    """Evaluate a compliance criterion (boolean/presence check)."""
    value_lower = str(bidder_value).lower().strip()

    # Check for positive indicators
    positive = value_lower in ("yes", "true", "available", "enclosed", "attached")
    has_number = bool(re.search(r'[A-Z0-9]{5,}', str(bidder_value)))  # GST/PAN number pattern
    has_iso = bool(re.search(r'ISO\s*\d{4}', str(bidder_value), re.IGNORECASE))

    if positive or has_number or has_iso:
        return {
            "decision": Decision.PASS.value,
            "reason": f"Compliance requirement met: {bidder_value}",
        }
    elif value_lower in ("no", "false", "not available", "na", "n/a"):
        return {
            "decision": Decision.FAIL.value,
            "reason": f"Compliance requirement not met: {bidder_value}",
        }
    else:
        return {
            "decision": Decision.NEED_REVIEW.value,
            "reason": f"Cannot determine compliance status from value: '{bidder_value}'",
        }


def compute_overall_decision(results):
    """Compute overall decision for a bidder from individual results."""
    decisions = [r.get("decision", Decision.NEED_REVIEW.value) for r in results]
    fail_count = decisions.count(Decision.FAIL.value)
    review_count = decisions.count(Decision.NEED_REVIEW.value)
    pass_count = decisions.count(Decision.PASS.value)

    if fail_count > 0:
        overall = Decision.FAIL.value
    elif review_count > 0:
        overall = Decision.NEED_REVIEW.value
    else:
        overall = Decision.PASS.value

    return overall, pass_count, fail_count, review_count
