"""
Pydantic schemas for API request/response models.
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from models.enums import Decision, CriterionType, ProcessingStatus


# ── Tender Criteria ──────────────────────────────────────────────

class Criterion(BaseModel):
    """A single eligibility criterion extracted from a tender."""
    criterion: str = Field(..., description="Name of the criterion")
    value: str = Field(..., description="Required value (e.g., '₹5 crore')")
    type: CriterionType = Field(..., description="Category: financial/technical/compliance")
    mandatory: bool = Field(True, description="Whether this criterion is mandatory")
    raw_text: str = Field("", description="Original text snippet from the document")
    source: Optional[str] = Field(
        None, description="Which extractor produced this criterion: 'llm' | 'regex' | 'regex-fallback'",
    )
    extraction_source: Optional[str] = Field(
        None, description="Normalized extraction source used by reports and audit output",
    )
    llm_reasoning: str = Field("", description="Brief LLM rationale when source is 'llm'")
    parsed_amount: Optional[float] = Field(
        None, description="Parsed numeric amount for financial criteria (in ₹)",
    )


# ── Bidder Data ──────────────────────────────────────────────────

class BidderDataField(BaseModel):
    """A single extracted data field from a bidder's document."""
    field: str = Field(..., description="Field name (e.g., 'turnover')")
    value: str = Field(..., description="Extracted value")
    source_doc: str = Field("", description="Source document filename")
    page: int = Field(0, description="Page number where value was found")
    confidence: float = Field(0.0, ge=0.0, le=1.0, description="Extraction confidence")
    source: str = Field("regex", description="Extractor source: regex or llm")
    extraction_source: str = Field("regex", description="Normalized extractor source")
    raw_text: str = Field("", description="Raw supporting text")
    raw_match: str = Field("", description="Regex match snippet, when applicable")
    llm_reasoning: str = Field("", description="Brief LLM rationale when source is 'llm'")


class BidderProfile(BaseModel):
    """Complete extracted profile for a bidder."""
    bidder_id: str
    bidder_name: str = ""
    documents: list[str] = []
    extracted_data: list[BidderDataField] = []
    status: ProcessingStatus = ProcessingStatus.PENDING


# ── Evaluation Results ───────────────────────────────────────────

class EvalResult(BaseModel):
    """Evaluation result for a single criterion against a single bidder."""
    criterion: str = Field(..., description="Criterion being evaluated")
    criterion_value: str = Field("", description="Required value")
    criterion_type: CriterionType = CriterionType.COMPLIANCE
    bidder_value: str = Field("", description="Bidder's value for this criterion")
    document: str = Field("", description="Source document")
    page: int = Field(0, description="Page number")
    decision: Decision = Field(..., description="PASS / FAIL / NEED_REVIEW")
    reason: str = Field("", description="Human-readable explanation")
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    overridden: bool = Field(False, description="Whether manually overridden")
    override_reason: str = Field("", description="Reason for override")
    extraction_source: str = Field("", description="Source of the matched bidder field")
    match_strategy: str = Field("", description="canonical, semantic, missing")
    match_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    matched_field: Optional[str] = Field(None, description="Bidder field matched to the criterion")
    field_raw_text: str = Field("", description="Raw text supporting the matched field")
    llm_reasoning: str = Field("", description="LLM rationale for the matched field, if present")


class BidderEvaluation(BaseModel):
    """Complete evaluation for a single bidder."""
    bidder_id: str
    bidder_name: str = ""
    results: list[EvalResult] = []
    overall_decision: Decision = Decision.NEED_REVIEW
    pass_count: int = 0
    fail_count: int = 0
    review_count: int = 0


# ── Tender Session ───────────────────────────────────────────────

class TenderInfo(BaseModel):
    """Metadata for an uploaded tender."""
    tender_id: str
    filename: str
    title: str = ""
    status: ProcessingStatus = ProcessingStatus.PENDING
    criteria: list[Criterion] = []
    bidders: list[BidderProfile] = []
    evaluations: list[BidderEvaluation] = []


# ── API Responses ────────────────────────────────────────────────

class UploadResponse(BaseModel):
    """Response after file upload."""
    id: str
    filename: str
    message: str


class ExtractionResponse(BaseModel):
    """Response after running extraction."""
    id: str
    status: str
    items_extracted: int
    data: list


class EvaluationSummary(BaseModel):
    """High-level summary of evaluation results."""
    eligible: list[str] = []
    not_eligible: list[str] = []
    needs_review: list[str] = []


class EvaluationResponse(BaseModel):
    """Response after running evaluation."""
    tender_id: str
    bidders_evaluated: int
    evaluations: list[BidderEvaluation]
    summary: EvaluationSummary


class OverrideRequest(BaseModel):
    """Request to override an evaluation decision."""
    criterion: str
    new_decision: Decision
    reason: str


# ── Audit Log ────────────────────────────────────────────────────

class AuditEntry(BaseModel):
    """A single audit log entry."""
    timestamp: str
    action: str
    tender_id: str = ""
    bidder_id: str = ""
    details: str = ""
    user: str = "system"
