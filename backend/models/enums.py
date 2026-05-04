"""
Enumerations for the Tender Evaluation Platform.
"""
from enum import Enum


class Decision(str, Enum):
    """Evaluation decision for a criterion."""
    PASS = "PASS"
    FAIL = "FAIL"
    NEED_REVIEW = "NEED_REVIEW"


class CriterionType(str, Enum):
    """Category of an eligibility criterion."""
    FINANCIAL = "financial"
    TECHNICAL = "technical"
    COMPLIANCE = "compliance"


class ProcessingStatus(str, Enum):
    """Status of a processing task."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AuditAction(str, Enum):
    """Types of audit log actions."""
    UPLOAD_TENDER = "UPLOAD_TENDER"
    UPLOAD_BIDDER = "UPLOAD_BIDDER"
    EXTRACT_CRITERIA = "EXTRACT_CRITERIA"
    EXTRACT_BIDDER_DATA = "EXTRACT_BIDDER_DATA"
    EVALUATE = "EVALUATE"
    OVERRIDE = "OVERRIDE"
    GENERATE_REPORT = "GENERATE_REPORT"
