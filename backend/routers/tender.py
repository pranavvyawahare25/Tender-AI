"""
Tender upload and extraction endpoints.
"""
import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional

from config import SUPPORTED_EXTENSIONS
from storage import store, audit_log
from services import ocr_service, tender_extractor
from models.enums import AuditAction

router = APIRouter(prefix="/api", tags=["tender"])


class TenderUpdate(BaseModel):
    title: Optional[str] = None


@router.post("/upload_tender")
async def upload_tender(file: UploadFile = File(...)):
    """Upload a tender document."""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}. Supported: {SUPPORTED_EXTENSIONS}")

    tender_id = store.generate_id()
    content = await file.read()
    filepath = store.save_tender_file(content, file.filename, tender_id)
    store.create_session(tender_id, file.filename)

    audit_log.log_action(AuditAction.UPLOAD_TENDER.value, tender_id=tender_id,
                         details=f"Uploaded tender: {file.filename}")

    return {"id": tender_id, "filename": file.filename, "message": "Tender uploaded successfully"}


@router.post("/extract_criteria/{tender_id}")
async def extract_criteria(tender_id: str):
    """Extract eligibility criteria from the uploaded tender."""
    session = store.get_session(tender_id)
    if not session:
        raise HTTPException(404, "Tender not found")

    filepath = store.get_tender_file_path(tender_id)
    if not filepath:
        raise HTTPException(404, "Tender file not found")

    # Run OCR / text extraction
    ocr_result = ocr_service.process_document(filepath)

    # Extract criteria
    criteria = tender_extractor.extract_criteria(ocr_result.full_text)

    # Save results
    store.save_extraction(tender_id, "tender_ocr", ocr_result.to_dict())
    store.save_extraction(tender_id, "criteria", {"criteria": criteria})
    store.update_session(tender_id, {"criteria": criteria, "status": "criteria_extracted"})

    audit_log.log_action(AuditAction.EXTRACT_CRITERIA.value, tender_id=tender_id,
                         details=f"Extracted {len(criteria)} criteria")

    return {"id": tender_id, "status": "completed", "items_extracted": len(criteria), "data": criteria}


@router.get("/tender/{tender_id}")
async def get_tender(tender_id: str):
    """Get tender information and extracted criteria."""
    session = store.get_session(tender_id)
    if not session:
        raise HTTPException(404, "Tender not found")
    return session


@router.patch("/tender/{tender_id}")
async def update_tender(tender_id: str, update: TenderUpdate):
    """Update tender metadata (currently: title)."""
    session = store.get_session(tender_id)
    if not session:
        raise HTTPException(404, "Tender not found")

    updates = {}
    if update.title is not None:
        new_title = update.title.strip()[:200]
        updates["title"] = new_title
        audit_log.log_action(
            "RENAME_TENDER",
            tender_id=tender_id,
            details=f"Renamed tender to: {new_title}",
        )

    if updates:
        store.update_session(tender_id, updates)

    return store.get_session(tender_id)


@router.get("/tenders")
async def list_tenders():
    """List all available tenders."""
    tenders = store.get_all_tenders()
    return {"tenders": tenders}
