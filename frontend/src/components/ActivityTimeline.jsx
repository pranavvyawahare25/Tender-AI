/**
 * ActivityTimeline — recent audit events for a tender (or system-wide).
 * Polls every 8s so you can demo "watch the timeline light up live".
 */
import { useState, useEffect, useRef } from 'react';
import { getAuditLog } from '../utils/api';
import { formatTimestamp } from '../utils/helpers';

const POLL_MS = 8000;

const ICON = {
  UPLOAD_TENDER:        { i: '📄', tone: 'brand'  },
  RENAME_TENDER:        { i: '✏️', tone: 'brand'  },
  EXTRACT_CRITERIA:     { i: '🔍', tone: 'brand'  },
  UPLOAD_BIDDER:        { i: '📁', tone: 'info'   },
  EXTRACT_BIDDER_DATA:  { i: '🔬', tone: 'info'   },
  EVALUATE:             { i: '⚖️', tone: 'success'},
  OVERRIDE:             { i: '✏️', tone: 'warn'   },
  GENERATE_REPORT:      { i: '📥', tone: 'info'   },
};

function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function ActivityTimeline({ tenderId, limit = 8, title = 'Live activity' }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSeen, setLastSeen] = useState(0);
  const pollRef = useRef();

  const refresh = async () => {
    try {
      const data = await getAuditLog(tenderId);
      const list = (data?.entries || []).slice().reverse();
      setEntries(list);
      setLastSeen((prev) => Math.max(prev, list.length));
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, POLL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenderId]);

  const visible = entries.slice(0, limit);

  return (
    <div className="at-card glass-card">
      <div className="at-head">
        <h3>📜 {title}</h3>
        <span className="at-live">
          <span className="at-dot" /> live
        </span>
      </div>
      {loading ? (
        <div className="at-loading">
          <span className="spinner" style={{ width: 18, height: 18 }} />
        </div>
      ) : visible.length === 0 ? (
        <div className="at-empty">No activity yet — uploads and evaluations will appear here.</div>
      ) : (
        <ol className="at-list">
          {visible.map((e, i) => {
            const meta = ICON[e.action] || { i: '📌', tone: 'brand' };
            return (
              <li key={i} className={`at-item at-${meta.tone} ${i === 0 ? 'at-newest' : ''}`}>
                <div className="at-bullet">{meta.i}</div>
                <div className="at-body">
                  <div className="at-action">{(e.action || '').replace(/_/g, ' ')}</div>
                  {e.details && <div className="at-details">{e.details}</div>}
                  <div className="at-time">
                    {relativeTime(e.timestamp)}
                    <span className="at-sep">·</span>
                    <span className="at-ts">{formatTimestamp(e.timestamp)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {entries.length > limit && (
        <div className="at-more">+{entries.length - limit} earlier events in the full audit log</div>
      )}

      <style>{`
        .at-card { padding: 16px; }
        .at-head {
          display: flex; justify-content: space-between; align-items: center;
          padding-bottom: 10px;
          margin-bottom: 10px;
          border-bottom: 1px solid var(--bg-glass-border);
        }
        .at-head h3 { font-size: 0.95rem; font-weight: 700; }
        .at-live {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 0.62rem; font-weight: 800;
          color: var(--accent-primary);
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .at-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: var(--accent-primary);
          box-shadow: 0 0 8px rgba(0, 229, 160, 0.6);
          animation: livePulse 1.6s ease-in-out infinite;
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        .at-loading {
          padding: 16px;
          display: flex; justify-content: center;
        }
        .at-empty {
          padding: 16px;
          font-size: 0.78rem;
          color: var(--text-muted);
          text-align: center;
        }
        .at-list {
          list-style: none;
          padding: 0; margin: 0;
          position: relative;
          max-height: 300px;
          overflow-y: auto;
        }
        .at-list::before {
          content: '';
          position: absolute;
          left: 17px; top: 4px; bottom: 4px;
          width: 2px;
          background: linear-gradient(180deg, var(--bg-glass-border), transparent);
          opacity: 0.6;
        }
        .at-item {
          position: relative;
          display: grid;
          grid-template-columns: 40px 1fr;
          gap: 8px;
          padding: 8px 0;
        }
        .at-bullet {
          width: 32px; height: 32px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--bg-glass-border);
          z-index: 1;
          font-size: 0.95rem;
          flex-shrink: 0;
        }
        .at-brand   .at-bullet { border-color: rgba(0, 229, 160, 0.3); background: rgba(0, 229, 160, 0.06); }
        .at-info    .at-bullet { border-color: rgba(61, 139, 253, 0.3); background: rgba(61, 139, 253, 0.06); }
        .at-success .at-bullet { border-color: rgba(0, 229, 160, 0.4); background: rgba(0, 229, 160, 0.1); }
        .at-warn    .at-bullet { border-color: rgba(255, 183, 77, 0.3); background: rgba(255, 183, 77, 0.06); }

        .at-newest .at-bullet {
          box-shadow: 0 0 0 4px rgba(0, 229, 160, 0.18);
        }

        .at-action {
          font-weight: 700;
          font-size: 0.82rem;
          color: var(--text-heading);
          text-transform: capitalize;
        }
        .at-details {
          font-size: 0.72rem;
          color: var(--text-secondary);
          margin-top: 2px;
          line-height: 1.45;
        }
        .at-time {
          font-size: 0.65rem;
          color: var(--text-muted);
          margin-top: 4px;
          display: flex; gap: 6px; flex-wrap: wrap;
        }
        .at-sep { opacity: 0.5; }
        .at-ts { font-family: monospace; }
        .at-more {
          padding-top: 8px;
          margin-top: 4px;
          border-top: 1px solid var(--bg-glass-border);
          font-size: 0.7rem;
          color: var(--text-muted);
          text-align: center;
        }
      `}</style>
    </div>
  );
}
