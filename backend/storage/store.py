"""
File and JSON storage manager for the Tender Evaluation Platform.
Handles saving/loading documents and structured data.
"""
import json
import os
import shutil
import uuid
from datetime import datetime
from typing import Optional

from config import (
    TENDERS_DIR, BIDDERS_DIR, EXTRACTIONS_DIR,
    EVALUATIONS_DIR, REPORTS_DIR, DATA_SUBDIRS
)


def ensure_directories():
    """Create all required data directories."""
    for d in DATA_SUBDIRS:
        os.makedirs(d, exist_ok=True)


def generate_id() -> str:
    """Generate a short unique ID."""
    return uuid.uuid4().hex[:12]


# ── Tender Storage ───────────────────────────────────────────────

def save_tender_file(file_bytes: bytes, filename: str, tender_id: str) -> str:
    """Save an uploaded tender document. Returns the file path."""
    tender_dir = os.path.join(TENDERS_DIR, tender_id)
    os.makedirs(tender_dir, exist_ok=True)
    filepath = os.path.join(tender_dir, filename)
    with open(filepath, "wb") as f:
        f.write(file_bytes)
    return filepath


def get_tender_file_path(tender_id: str) -> Optional[str]:
    """Get the path to the tender document."""
    tender_dir = os.path.join(TENDERS_DIR, tender_id)
    if not os.path.exists(tender_dir):
        return None
    files = os.listdir(tender_dir)
    if not files:
        return None
    return os.path.join(tender_dir, files[0])


def get_tender_filename(tender_id: str) -> Optional[str]:
    """Get the filename of the tender document."""
    tender_dir = os.path.join(TENDERS_DIR, tender_id)
    if not os.path.exists(tender_dir):
        return None
    files = os.listdir(tender_dir)
    return files[0] if files else None


# ── Bidder Storage ───────────────────────────────────────────────

def save_bidder_file(file_bytes: bytes, filename: str, tender_id: str, bidder_id: str) -> str:
    """Save an uploaded bidder document. Returns the file path."""
    bidder_dir = os.path.join(BIDDERS_DIR, tender_id, bidder_id)
    os.makedirs(bidder_dir, exist_ok=True)
    filepath = os.path.join(bidder_dir, filename)
    with open(filepath, "wb") as f:
        f.write(file_bytes)
    return filepath


def get_bidder_files(tender_id: str, bidder_id: str) -> list[str]:
    """Get list of files for a bidder."""
    bidder_dir = os.path.join(BIDDERS_DIR, tender_id, bidder_id)
    if not os.path.exists(bidder_dir):
        return []
    return [os.path.join(bidder_dir, f) for f in os.listdir(bidder_dir)]


def get_bidder_filenames(tender_id: str, bidder_id: str) -> list[str]:
    """Get filenames for a bidder."""
    bidder_dir = os.path.join(BIDDERS_DIR, tender_id, bidder_id)
    if not os.path.exists(bidder_dir):
        return []
    return os.listdir(bidder_dir)


# ── JSON Data Storage ────────────────────────────────────────────

def save_extraction(tender_id: str, data_type: str, data: dict):
    """Save extraction results as JSON."""
    ext_dir = os.path.join(EXTRACTIONS_DIR, tender_id)
    os.makedirs(ext_dir, exist_ok=True)
    filepath = os.path.join(ext_dir, f"{data_type}.json")
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_extraction(tender_id: str, data_type: str) -> Optional[dict]:
    """Load extraction results from JSON."""
    filepath = os.path.join(EXTRACTIONS_DIR, tender_id, f"{data_type}.json")
    if not os.path.exists(filepath):
        return None
    with open(filepath, "r") as f:
        return json.load(f)


def save_evaluation(tender_id: str, data: dict):
    """Save evaluation results as JSON."""
    os.makedirs(EVALUATIONS_DIR, exist_ok=True)
    filepath = os.path.join(EVALUATIONS_DIR, f"{tender_id}.json")
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_evaluation(tender_id: str) -> Optional[dict]:
    """Load evaluation results from JSON."""
    filepath = os.path.join(EVALUATIONS_DIR, f"{tender_id}.json")
    if not os.path.exists(filepath):
        return None
    with open(filepath, "r") as f:
        return json.load(f)


def save_report(tender_id: str, report_bytes: bytes, fmt: str) -> str:
    """Save a generated report. Returns file path."""
    os.makedirs(REPORTS_DIR, exist_ok=True)
    filename = f"report_{tender_id}.{fmt}"
    filepath = os.path.join(REPORTS_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(report_bytes)
    return filepath


def get_report_path(tender_id: str, fmt: str) -> Optional[str]:
    """Get the path to a generated report."""
    filepath = os.path.join(REPORTS_DIR, f"report_{tender_id}.{fmt}")
    return filepath if os.path.exists(filepath) else None


# ── Session Management ───────────────────────────────────────────

_sessions: dict[str, dict] = {}


def create_session(tender_id: str, filename: str) -> dict:
    """Create a new tender evaluation session."""
    session = {
        "tender_id": tender_id,
        "filename": filename,
        "title": "",
        "status": "pending",
        "criteria": [],
        "bidders": {},
        "evaluations": {},
        "created_at": datetime.now().isoformat(),
    }
    _sessions[tender_id] = session
    _persist_session(tender_id)
    return session


def get_session(tender_id: str) -> Optional[dict]:
    """Get a tender session, loading from disk if necessary."""
    if tender_id in _sessions:
        return _sessions[tender_id]
    # Try loading from disk
    filepath = os.path.join(EXTRACTIONS_DIR, tender_id, "session.json")
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            session = json.load(f)
        _sessions[tender_id] = session
        return session
    return None


def update_session(tender_id: str, updates: dict):
    """Update a session with new data."""
    session = get_session(tender_id)
    if session:
        session.update(updates)
        _sessions[tender_id] = session
        _persist_session(tender_id)


def _persist_session(tender_id: str):
    """Write session to disk."""
    session = _sessions.get(tender_id)
    if not session:
        return
    ext_dir = os.path.join(EXTRACTIONS_DIR, tender_id)
    os.makedirs(ext_dir, exist_ok=True)
    filepath = os.path.join(ext_dir, "session.json")
    with open(filepath, "w") as f:
        json.dump(session, f, indent=2, ensure_ascii=False)


def get_all_tenders() -> list[dict]:
    """Get a list of all tenders from disk."""
    tenders = []
    if not os.path.exists(EXTRACTIONS_DIR):
        return tenders
        
    for tender_id in os.listdir(EXTRACTIONS_DIR):
        filepath = os.path.join(EXTRACTIONS_DIR, tender_id, "session.json")
        if os.path.exists(filepath):
            try:
                with open(filepath, "r") as f:
                    session = json.load(f)
                
                tenders.append({
                    "id": session.get("tender_id"),
                    "filename": session.get("filename"),
                    "title": session.get("title", ""),
                    "created_at": session.get("created_at"),
                    "status": session.get("status"),
                })
            except Exception:
                pass
                
    # Sort by created_at descending
    tenders.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return tenders
