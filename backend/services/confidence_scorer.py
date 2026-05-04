"""
Confidence scoring for extraction results.
"""
from config import OCR_CONFIDENCE_THRESHOLD


def score_extraction(ocr_confidence, extraction_confidence):
    """Compute combined confidence score."""
    # Weighted: 40% OCR quality, 60% extraction pattern match
    combined = 0.4 * ocr_confidence + 0.6 * extraction_confidence
    return round(combined, 3)


def needs_review(confidence):
    """Check if a result needs manual review based on confidence."""
    return confidence < OCR_CONFIDENCE_THRESHOLD


def classify_confidence(confidence):
    """Classify confidence level."""
    if confidence >= 0.9:
        return "high"
    elif confidence >= OCR_CONFIDENCE_THRESHOLD:
        return "medium"
    else:
        return "low"
