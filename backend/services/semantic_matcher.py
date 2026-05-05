"""
Sentence-embedding-based semantic matcher.

Replaces (and extends) the hardcoded CRITERION_TO_FIELDS dictionary in
matching_engine.py. Given a criterion name and a list of bidder fields,
it returns the most semantically similar field — or None if no field
crosses the configured similarity threshold.

This rescues:
  • LLM-extracted fields with non-canonical names ("yearly_revenue"
    matching "Minimum Annual Turnover")
  • Variation in criterion phrasing across tenders
  • Multilingual / paraphrased fields the regex never sees

Falls through to None on any failure so the matching engine can keep using
its deterministic CRITERION_TO_FIELDS dictionary.
"""
import os
import logging
from typing import Optional, Iterable

logger = logging.getLogger(__name__)

USE_SEMANTIC = os.getenv("USE_SEMANTIC_MATCHER", "1").strip() != "0"
MODEL_NAME   = os.getenv("SEMANTIC_MODEL", "sentence-transformers/all-MiniLM-L6-v2").strip()
THRESHOLD    = float(os.getenv("SEMANTIC_THRESHOLD", "0.45"))

_model = None
_field_cache: dict[str, "any"] = {}        # field-label  → embedding tensor
_criterion_cache: dict[str, "any"] = {}    # criterion-key → embedding tensor


def _get_model():
    """Lazily load the sentence-transformers model on first call."""
    global _model
    if _model is not None:
        return _model
    if not USE_SEMANTIC:
        return None
    try:
        from sentence_transformers import SentenceTransformer
        logger.info(f"Loading semantic-matcher model: {MODEL_NAME}")
        _model = SentenceTransformer(MODEL_NAME)
        return _model
    except Exception as e:
        logger.warning(f"Semantic matcher unavailable ({e}) — disabling")
        return None


def _embed(text: str, cache: dict):
    """Embed a single string with caching."""
    model = _get_model()
    if model is None:
        return None
    key = (text or "").strip().lower()
    if not key:
        return None
    if key in cache:
        return cache[key]
    emb = model.encode(key, convert_to_tensor=True, show_progress_bar=False)
    cache[key] = emb
    return emb


def best_match(
    criterion_name: str,
    criterion_value: str,
    bidder_fields: Iterable[dict],
    threshold: Optional[float] = None,
) -> Optional[tuple[dict, float]]:
    """
    Find the bidder field most semantically similar to the criterion.

    Args:
      criterion_name:    e.g. "Minimum Annual Turnover"
      criterion_value:   e.g. "Rs. 5 crore"  (used to enrich the query)
      bidder_fields:     list of dicts each with at least a `field` key,
                         optionally a `raw_text` and `value`.
      threshold:         override the configured threshold (0..1, cosine).

    Returns:
      (bidder_field_dict, similarity_score) if best score >= threshold,
      else None.
    """
    if not USE_SEMANTIC:
        return None
    model = _get_model()
    if model is None:
        return None

    fields = [f for f in (bidder_fields or []) if isinstance(f, dict) and f.get("field")]
    if not fields:
        return None

    try:
        from sentence_transformers import util
    except Exception:
        return None

    # Build the query: the criterion name plus its value provides extra signal
    query_text = f"{criterion_name} {criterion_value or ''}".strip()
    crit_emb = _embed(query_text, _criterion_cache)
    if crit_emb is None:
        return None

    best = None
    best_score = -1.0
    for f in fields:
        # Build a label that includes the canonical key + raw text + value
        label_parts = [
            f.get("field", "").replace("_", " "),
            f.get("value", ""),
            (f.get("raw_text", "") or "")[:80],
        ]
        label = " ".join(p for p in label_parts if p).strip()
        if not label:
            continue
        emb = _embed(label, _field_cache)
        if emb is None:
            continue
        score = float(util.cos_sim(crit_emb, emb).item())
        if score > best_score:
            best_score = score
            best = f

    thr = threshold if threshold is not None else THRESHOLD
    if best is not None and best_score >= thr:
        return best, best_score
    return None


def status() -> dict:
    """Diagnostic helper."""
    return {
        "enabled":   USE_SEMANTIC,
        "model":     MODEL_NAME,
        "threshold": THRESHOLD,
        "loaded":    _model is not None,
    }
