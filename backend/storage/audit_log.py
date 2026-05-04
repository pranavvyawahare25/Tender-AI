"""
Audit log for tracking all actions in the Tender Evaluation Platform.
"""
import json
import os
from datetime import datetime
from typing import Optional
from config import DATA_DIR


AUDIT_LOG_FILE = os.path.join(DATA_DIR, "audit_log.json")

_log: list[dict] = []
_loaded = False


def _ensure_loaded():
    """Load audit log from disk if not already loaded."""
    global _log, _loaded
    if _loaded:
        return
    if os.path.exists(AUDIT_LOG_FILE):
        with open(AUDIT_LOG_FILE, "r") as f:
            _log = json.load(f)
    _loaded = True


def _persist():
    """Write audit log to disk."""
    os.makedirs(os.path.dirname(AUDIT_LOG_FILE), exist_ok=True)
    with open(AUDIT_LOG_FILE, "w") as f:
        json.dump(_log, f, indent=2, ensure_ascii=False)


def log_action(
    action: str,
    tender_id: str = "",
    bidder_id: str = "",
    details: str = "",
    user: str = "system"
):
    """Record an audit log entry."""
    _ensure_loaded()
    entry = {
        "timestamp": datetime.now().isoformat(),
        "action": action,
        "tender_id": tender_id,
        "bidder_id": bidder_id,
        "details": details,
        "user": user,
    }
    _log.append(entry)
    _persist()


def get_log(tender_id: Optional[str] = None) -> list[dict]:
    """Retrieve audit log entries, optionally filtered by tender_id."""
    _ensure_loaded()
    if tender_id:
        return [e for e in _log if e.get("tender_id") == tender_id]
    return list(_log)


def clear_log():
    """Clear all audit log entries (for testing)."""
    global _log
    _log = []
    _persist()
