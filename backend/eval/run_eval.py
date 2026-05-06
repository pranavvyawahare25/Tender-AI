"""
Run TenderAI's criterion extractor against the hand-labelled
ground-truth set and print precision / recall / F1.

Usage (from backend/):
    python -m sample_data.generate_samples       # produce the seeded PDFs first
    python -m eval.run_eval                       # then run this

Output:
    Per-tender table + a final aggregated row.

Honest reporting only — we measure the extractor against the
ground-truth file in this folder. If you change the prompt or
patterns, re-run this and update slide 14b in the deck.
"""
import os
import sys
import json
from pathlib import Path

# Allow running as a top-level script
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from services import ocr_service, tender_extractor   # noqa: E402

GROUND_TRUTH = Path(__file__).parent / "ground_truth.json"
SAMPLE_DIR   = ROOT / "sample_data" / "generated"


def _norm(s: str) -> str:
    return (s or "").lower().strip()


def _value_match(predicted_value: str, expected_tokens: list[str]) -> bool:
    """All expected tokens must appear (case-insensitive) somewhere in predicted_value."""
    if not predicted_value:
        return False
    lv = predicted_value.lower()
    return all(t.lower() in lv for t in expected_tokens)


def _criterion_match(predicted_name: str, expected_name: str) -> bool:
    """Soft matcher: stem comparison + token overlap."""
    a = _norm(predicted_name).split()
    b = _norm(expected_name).split()
    if not a or not b:
        return False
    overlap = len(set(a) & set(b))
    return overlap >= max(1, min(len(a), len(b)) // 2 + 1)


def evaluate_tender(tender_spec, sample_dir):
    fname = tender_spec["filename"]
    fpath = sample_dir / fname
    if not fpath.exists():
        return {"id": tender_spec["id"], "error": f"sample file missing: {fpath}"}

    expected = tender_spec["criteria"]

    ocr = ocr_service.process_document(str(fpath))
    predicted = tender_extractor.extract_criteria(ocr.full_text) or []

    matched = []   # (expected, predicted)
    used_predicted = set()

    for exp in expected:
        best_idx = None
        for i, p in enumerate(predicted):
            if i in used_predicted:
                continue
            if _criterion_match(p.get("criterion", ""), exp["criterion"]):
                # Optionally also require value tokens
                tokens = exp.get("value_contains") or []
                if not tokens or _value_match(p.get("value", ""), tokens):
                    best_idx = i
                    break
        if best_idx is not None:
            used_predicted.add(best_idx)
            matched.append((exp, predicted[best_idx]))

    tp = len(matched)                                  # true positives
    fn = len(expected) - tp                             # missed expected
    fp = len(predicted) - tp                            # extra predictions
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall    = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

    return {
        "id":          tender_spec["id"],
        "expected":    len(expected),
        "predicted":   len(predicted),
        "tp": tp, "fp": fp, "fn": fn,
        "precision":   round(precision, 3),
        "recall":      round(recall, 3),
        "f1":          round(f1, 3),
    }


def main():
    if not GROUND_TRUTH.exists():
        print(f"Ground truth not found: {GROUND_TRUTH}")
        return 1
    if not SAMPLE_DIR.exists():
        print(f"Sample data missing — run sample_data.generate_samples first ({SAMPLE_DIR})")
        return 1

    spec = json.loads(GROUND_TRUTH.read_text())
    rows = []
    for t in spec["tenders"]:
        rows.append(evaluate_tender(t, SAMPLE_DIR))

    # Aggregate
    tot_tp = sum(r.get("tp", 0) for r in rows if "error" not in r)
    tot_fp = sum(r.get("fp", 0) for r in rows if "error" not in r)
    tot_fn = sum(r.get("fn", 0) for r in rows if "error" not in r)
    p = tot_tp / (tot_tp + tot_fp) if (tot_tp + tot_fp) else 0.0
    r_ = tot_tp / (tot_tp + tot_fn) if (tot_tp + tot_fn) else 0.0
    f1 = (2 * p * r_ / (p + r_)) if (p + r_) else 0.0

    print("\nTenderAI extractor evaluation")
    print("=" * 78)
    print(f"{'Tender':<28}{'Exp':>5}{'Pred':>6}{'TP':>5}{'FP':>5}{'FN':>5}"
          f"{'Prec':>8}{'Rec':>8}{'F1':>8}")
    print("-" * 78)
    for r in rows:
        if "error" in r:
            print(f"{r['id']:<28}  ERROR  {r['error']}")
            continue
        print(f"{r['id']:<28}{r['expected']:>5}{r['predicted']:>6}"
              f"{r['tp']:>5}{r['fp']:>5}{r['fn']:>5}"
              f"{r['precision']:>8}{r['recall']:>8}{r['f1']:>8}")
    print("-" * 78)
    print(f"{'OVERALL':<28}{'':>5}{'':>6}{tot_tp:>5}{tot_fp:>5}{tot_fn:>5}"
          f"{p:>8.3f}{r_:>8.3f}{f1:>8.3f}")
    print("\nAdd these numbers to slide 14b (Accuracy & Eval) of the pitch deck.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
