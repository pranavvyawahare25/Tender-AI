/**
 * AuditLog — Slide-out panel showing audit trail.
 */
import { useState, useEffect } from 'react';
import { getAuditLog } from '../utils/api';
import { formatTimestamp } from '../utils/helpers';

export default function AuditLog({ tenderId, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getAuditLog(tenderId);
        setEntries(data.entries || []);
      } catch (e) {
        console.error('Failed to load audit log', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenderId]);

  const getActionIcon = (action) => {
    const icons = {
      UPLOAD_TENDER: '📄', UPLOAD_BIDDER: '📁', EXTRACT_CRITERIA: '🔍',
      EXTRACT_BIDDER_DATA: '🔬', EVALUATE: '⚖️', OVERRIDE: '✏️', GENERATE_REPORT: '📥',
    };
    return icons[action] || '📌';
  };

  return (
    <div className="audit-overlay">
      <div className="audit-header">
        <h3>📋 Audit Log</h3>
        <button className="audit-close" onClick={onClose}>✕</button>
      </div>
      <div className="audit-entries">
        {loading ? (
          <div className="text-center mt-lg">
            <div className="spinner" style={{ margin: '0 auto' }}></div>
          </div>
        ) : entries.length === 0 ? (
          <p className="text-muted text-center mt-lg">No audit entries yet.</p>
        ) : (
          entries.slice().reverse().map((entry, i) => (
            <div key={i} className="audit-entry fade-in">
              <div className="audit-entry-action">
                {getActionIcon(entry.action)} {entry.action.replace(/_/g, ' ')}
              </div>
              {entry.details && <div className="audit-entry-details">{entry.details}</div>}
              <div className="audit-entry-time">{formatTimestamp(entry.timestamp)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
