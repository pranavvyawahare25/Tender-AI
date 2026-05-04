"""
Evaluation and matching endpoints.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from storage import store, audit_log
from services.matching_engine import evaluate_bidder, compute_overall_decision
from models.enums import AuditAction, Decision
from middleware.auth import get_current_user, ClerkUser

router = APIRouter(prefix="/api", tags=["evaluation"])


class OverrideRequest(BaseModel):
    criterion: str
    new_decision: str
    reason: str


@router.post("/evaluate_bidders/{tender_id}")
async def evaluate_bidders(tender_id: str, user: Optional[ClerkUser] = Depends(get_current_user)):
    """Evaluate all bidders against tender criteria."""
    session = store.get_session(tender_id)
    if not session:
        raise HTTPException(404, "Tender not found")

    criteria = session.get("criteria", [])
    if not criteria:
        raise HTTPException(400, "No criteria extracted. Run extract_criteria first.")

    bidders = session.get("bidders", {})
    if not bidders:
        raise HTTPException(400, "No bidders uploaded. Upload bidder documents first.")

    evaluations = []
    summary = {"eligible": [], "not_eligible": [], "needs_review": []}

    for bidder_id, bidder_info in bidders.items():
        bidder_data = bidder_info.get("extracted_data", [])
        bidder_name = bidder_info.get("bidder_name", bidder_id)

        if not bidder_data:
            # Auto-flag bidders with no extracted data
            evaluations.append({
                "bidder_id": bidder_id,
                "bidder_name": bidder_name,
                "results": [],
                "overall_decision": Decision.NEED_REVIEW.value,
                "pass_count": 0,
                "fail_count": 0,
                "review_count": len(criteria),
            })
            summary["needs_review"].append(bidder_name)
            continue

        results = evaluate_bidder(criteria, bidder_data, bidder_name)
        overall, pass_c, fail_c, review_c = compute_overall_decision(results)

        eval_entry = {
            "bidder_id": bidder_id,
            "bidder_name": bidder_name,
            "results": results,
            "overall_decision": overall,
            "pass_count": pass_c,
            "fail_count": fail_c,
            "review_count": review_c,
        }
        evaluations.append(eval_entry)

        if overall == Decision.PASS.value:
            summary["eligible"].append(bidder_name)
        elif overall == Decision.FAIL.value:
            summary["not_eligible"].append(bidder_name)
        else:
            summary["needs_review"].append(bidder_name)

    # Save evaluation results
    eval_data = {"evaluations": evaluations, "summary": summary}
    store.save_evaluation(tender_id, eval_data)
    store.update_session(tender_id, {"evaluations": evaluations, "status": "evaluated"})

    user_info = f" by {user.email or user.user_id}" if user else ""
    audit_log.log_action(AuditAction.EVALUATE.value, tender_id=tender_id,
                         details=f"Evaluated {len(evaluations)} bidders{user_info}")

    return {
        "tender_id": tender_id,
        "bidders_evaluated": len(evaluations),
        "evaluations": evaluations,
        "summary": summary,
    }


@router.get("/evaluation/{tender_id}")
async def get_evaluation(tender_id: str):
    """Get evaluation results for a tender."""
    data = store.load_evaluation(tender_id)
    if not data:
        raise HTTPException(404, "No evaluation found. Run evaluate_bidders first.")
    return data


@router.post("/override/{tender_id}/{bidder_id}")
async def override_decision(tender_id: str, bidder_id: str, req: OverrideRequest, user: Optional[ClerkUser] = Depends(get_current_user)):
    """Manually override an evaluation decision."""
    data = store.load_evaluation(tender_id)
    if not data:
        raise HTTPException(404, "No evaluation found")

    evaluations = data.get("evaluations", [])
    found = False

    for eval_entry in evaluations:
        if eval_entry["bidder_id"] == bidder_id:
            for result in eval_entry["results"]:
                if result["criterion"] == req.criterion:
                    result["decision"] = req.new_decision
                    result["overridden"] = True
                    result["override_reason"] = req.reason
                    found = True
                    break

            if found:
                # Recalculate overall
                overall, pass_c, fail_c, review_c = compute_overall_decision(eval_entry["results"])
                eval_entry["overall_decision"] = overall
                eval_entry["pass_count"] = pass_c
                eval_entry["fail_count"] = fail_c
                eval_entry["review_count"] = review_c
            break

    if not found:
        raise HTTPException(404, "Criterion not found for this bidder")

    # Rebuild summary
    summary = {"eligible": [], "not_eligible": [], "needs_review": []}
    for ev in evaluations:
        name = ev.get("bidder_name", ev.get("bidder_id"))
        if ev["overall_decision"] == Decision.PASS.value:
            summary["eligible"].append(name)
        elif ev["overall_decision"] == Decision.FAIL.value:
            summary["not_eligible"].append(name)
        else:
            summary["needs_review"].append(name)

    data["evaluations"] = evaluations
    data["summary"] = summary
    store.save_evaluation(tender_id, data)

    # Update session too
    store.update_session(tender_id, {"evaluations": evaluations})

    user_info = f" by {user.email or user.user_id}" if user else ""
    audit_log.log_action(AuditAction.OVERRIDE.value, tender_id=tender_id, bidder_id=bidder_id,
                         details=f"Overrode '{req.criterion}' to {req.new_decision}: {req.reason}{user_info}")

    return {"message": "Override applied", "evaluations": evaluations, "summary": summary}
