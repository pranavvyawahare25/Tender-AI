"""
Report generation and audit log endpoints.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from storage import store, audit_log
from services.report_generator import generate_json_report, generate_pdf_report
from services.reasoned_order import generate_reasoned_order
from services.audit_pack import build_audit_pack
from models.enums import AuditAction

router = APIRouter(prefix="/api", tags=["report"])


@router.get("/report/{tender_id}/json")
async def get_json_report(tender_id: str):
    """Generate and download JSON report."""
    session = store.get_session(tender_id)
    if not session:
        raise HTTPException(404, "Tender not found")

    eval_data = store.load_evaluation(tender_id)
    if not eval_data:
        raise HTTPException(400, "No evaluation data. Run evaluate_bidders first.")

    criteria = session.get("criteria", [])
    evaluations = eval_data.get("evaluations", [])
    audit_entries = audit_log.get_log(tender_id)

    report_bytes = generate_json_report(session, evaluations, criteria, audit_entries)
    store.save_report(tender_id, report_bytes, "json")

    audit_log.log_action(AuditAction.GENERATE_REPORT.value, tender_id=tender_id,
                         details="Generated JSON report")

    return Response(
        content=report_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=report_{tender_id}.json"}
    )


@router.get("/report/{tender_id}/pdf")
async def get_pdf_report(tender_id: str):
    """Generate and download PDF report."""
    session = store.get_session(tender_id)
    if not session:
        raise HTTPException(404, "Tender not found")

    eval_data = store.load_evaluation(tender_id)
    if not eval_data:
        raise HTTPException(400, "No evaluation data. Run evaluate_bidders first.")

    criteria = session.get("criteria", [])
    evaluations = eval_data.get("evaluations", [])
    audit_entries = audit_log.get_log(tender_id)

    report_bytes = generate_pdf_report(session, evaluations, criteria, audit_entries)
    store.save_report(tender_id, report_bytes, "pdf")

    audit_log.log_action(AuditAction.GENERATE_REPORT.value, tender_id=tender_id,
                         details="Generated PDF report")

    return Response(
        content=report_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=report_{tender_id}.pdf"}
    )


@router.get("/reasoned_order/{tender_id}/{bidder_id}")
async def get_reasoned_order(tender_id: str, bidder_id: str):
    """
    CVC-compliant reasoned-order PDF for a single bidder.
    Cites GFR Rule 173 + CVC Procurement Manual + Section 4 RTI.
    """
    session = store.get_session(tender_id)
    if not session:
        raise HTTPException(404, "Tender not found")

    eval_data = store.load_evaluation(tender_id)
    if not eval_data:
        raise HTTPException(400, "No evaluation data. Run evaluate_bidders first.")

    evaluation = next(
        (e for e in eval_data.get("evaluations", []) if e.get("bidder_id") == bidder_id),
        None,
    )
    if not evaluation:
        raise HTTPException(404, "Bidder not found in evaluation results")

    criteria = session.get("criteria", [])
    bidder_name = evaluation.get("bidder_name", bidder_id)
    pdf_bytes = generate_reasoned_order(
        tender_info={"tender_id": tender_id, **session},
        bidder_name=bidder_name,
        evaluation=evaluation,
        criteria=criteria,
    )

    audit_log.log_action(
        AuditAction.GENERATE_REPORT.value, tender_id=tender_id, bidder_id=bidder_id,
        details=f"Generated reasoned order for {bidder_name}",
    )
    safe_name = bidder_name.replace(" ", "_").replace("/", "-")[:60]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=reasoned_order_{safe_name}.pdf"},
    )


@router.get("/audit_pack/{tender_id}")
async def get_audit_pack(tender_id: str):
    """
    CAG-grade audit pack — one ZIP with every artefact a procurement
    auditor would request, plus a SHA-256 hash-chain manifest so any
    post-hoc tampering with the pack itself can be detected.
    """
    try:
        zip_bytes = build_audit_pack(tender_id)
    except ValueError as e:
        raise HTTPException(404, str(e))

    audit_log.log_action(
        AuditAction.GENERATE_REPORT.value, tender_id=tender_id,
        details="Generated CAG audit pack (hash-chain manifest)",
    )
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=audit_pack_{tender_id}.zip"},
    )


@router.get("/audit_log/{tender_id}")
async def get_audit_log(tender_id: str):
    """Get audit log entries for a tender."""
    entries = audit_log.get_log(tender_id)
    return {"tender_id": tender_id, "entries": entries}


@router.get("/audit_log")
async def get_full_audit_log():
    """Get all audit log entries."""
    entries = audit_log.get_log()
    return {"entries": entries}
