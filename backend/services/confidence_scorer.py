"""
Confidence scoring for extraction results.

Blending strategy depends on which extractor produced the field:

  - source="regex"   → 0.4 × OCR + 0.6 × extraction
        Regex extraction confidence is artificially fixed at the pattern's
        reliability, so OCR quality carries meaningful weight.

  - source="llm"     → 0.25 × OCR + 0.75 × extraction
        Llama-3 returns its own per-field confidence (model-reported), which
        is much more meaningful than a fixed regex score. We trust the
        model's self-assessment more, but keep some OCR-quality signal.

  - source="semantic"→ confidence is multiplied by similarity score
        Semantic-matched fields inherit their underlying field's confidence,
        scaled by the (cosine-similarity / 1.0) so a 0.45-similarity match is
        proportionally less trusted than a 0.95 one.
"""
from config import OCR_CONFIDENCE_THRESHOLD


def score_extraction(
    ocr_confidence: float,
    extraction_confidence: float,
    source: str = "regex",
    match_score: float | None = None,
) -> float:
    """
    Compute combined confidence score, weighted by extraction source.

    Args:
      ocr_confidence:        0..1, OCR pipeline's reported quality
      extraction_confidence: 0..1, extractor's reported confidence
      source:                "regex" | "llm" | "semantic"
      match_score:           0..1, semantic-similarity score if source=semantic

    Returns:
      0..1 combined confidence, rounded to 3 decimals.
    """
    if source == "llm":
        # Trust the LLM's self-reported confidence more
        combined = 0.25 * ocr_confidence + 0.75 * extraction_confidence
    else:
        # Default: regex-style weighting
        combined = 0.4 * ocr_confidence + 0.6 * extraction_confidence

    # Semantic matching adds a multiplicative penalty proportional to similarity
    if source == "semantic" and match_score is not None:
        combined *= max(0.0, min(1.0, match_score))

    return round(max(0.0, min(1.0, combined)), 3)


def needs_review(confidence: float) -> bool:
    """Check if a result needs manual review based on confidence."""
    return confidence < OCR_CONFIDENCE_THRESHOLD


def classify_confidence(confidence: float) -> str:
    """Classify confidence level."""
    if confidence >= 0.9:
        return "high"
    elif confidence >= OCR_CONFIDENCE_THRESHOLD:
        return "medium"
    else:
        return "low"
