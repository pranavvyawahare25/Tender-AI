/**
 * TenderDetail — per-tender deep-dive view.
 * Live polling for bidder submissions, one-click evaluate, override + export.
 */
import { useState, useEffect, useRef } from 'react';
import * as api from '../utils/api';
import { tenderDisplayTitle, tenderNumber } from '../utils/helpers';
import CriteriaList from './CriteriaList';
import BidderCard from './BidderCard';
import Summary from './Summary';
import ComparisonMatrix from './ComparisonMatrix';
import TenderInsights from './TenderInsights';

const POLL_INTERVAL_MS = 8000;

export default function TenderDetail({ tender, onBack, onAuditOpen, onTitleChanged }) {
  const [tenderState, setTenderState] = useState(tender);
  const [criteria, setCriteria] = useState(tender?.criteria || []);
  const [bidders, setBidders] = useState({});
  const [evaluations, setEvaluations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview | insights | bidders | criteria | matrix
  const [lastSync, setLastSync] = useState(null);
  const [livePulse, setLivePulse] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const pollRef = useRef();

  // ── Initial load ──────────────────────────────────────────────
  useEffect(() => {
    if (!tender?.id) return;
    refresh(true);
    pollRef.current = setInterval(() => refresh(false), POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tender?.id]);

  // Re-extract criteria if missing
  useEffect(() => {
    if (!tender?.id) return;
    if ((!criteria || !criteria.length) && tender.criteria?.length) {
      setCriteria(tender.criteria);
    }
  }, [tender, criteria]);

  const refresh = async (initial) => {
    if (!tender?.id) return;
    try {
      const [tRes, bRes] = await Promise.all([
        api.getTender(tender.id).catch(() => null),
        api.getBidders(tender.id).catch(() => null),
      ]);
      if (tRes) {
        setTenderState((prev) => ({ ...prev, ...tRes }));
      }
      if (tRes?.criteria) setCriteria(tRes.criteria);
      if (bRes?.bidders) {
        setBidders((prev) => {
          const newCount = Object.keys(bRes.bidders).length;
          const oldCount = Object.keys(prev).length;
          if (newCount > oldCount && !initial) {
            // pulse the live indicator
            setLivePulse(true);
            setTimeout(() => setLivePulse(false), 2400);
          }
          return bRes.bidders;
        });
      }
      // Load existing evaluation if any
      if (initial) {
        try {
          const ev = await api.getEvaluation(tender.id);
          if (ev?.evaluations) {
            setEvaluations(ev.evaluations);
            setSummary(ev.summary);
          }
        } catch (_) { /* none yet */ }
      }
      setLastSync(new Date());
    } catch (e) {
      // swallow during polling
      if (initial) setError('Failed to load tender details.');
    }
  };

  // ── Run evaluation ────────────────────────────────────────────
  const runEval = async () => {
    if (!Object.keys(bidders).length) return;
    setBusy(true);
    setBusyMsg('Running AI evaluation engine…');
    setError('');
    try {
      const res = await api.evaluateBidders(tender.id);
      setEvaluations(res.evaluations);
      setSummary(res.summary);
      setActiveTab('bidders');
    } catch (e) {
      setError(e.response?.data?.detail || 'Evaluation failed.');
    } finally {
      setBusy(false);
    }
  };

  // ── Rename title ──────────────────────────────────────────────
  const startEdit = () => {
    setTitleDraft(tenderDisplayTitle(tenderState));
    setEditingTitle(true);
  };
  const cancelEdit = () => {
    setEditingTitle(false);
    setTitleDraft('');
  };
  const saveTitle = async () => {
    if (!titleDraft.trim()) return cancelEdit();
    setSavingTitle(true);
    try {
      const updated = await api.updateTenderTitle(tender.id, titleDraft.trim());
      setTenderState((prev) => ({ ...prev, ...updated }));
      onTitleChanged?.({ id: tender.id, title: updated?.title });
      setEditingTitle(false);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to rename tender.');
    } finally {
      setSavingTitle(false);
    }
  };

  const handleOverride = async (bidderId, criterion, newDecision, reason) => {
    try {
      const res = await api.overrideDecision(tender.id, bidderId, criterion, newDecision, reason);
      setEvaluations(res.evaluations);
      setSummary(res.summary);
    } catch (e) {
      setError(e.response?.data?.detail || 'Override failed.');
    }
  };

  // ── Derived state ─────────────────────────────────────────────
  const bidderArr = Object.values(bidders);
  const extractedCount = bidderArr.filter((b) => b.status === 'extracted').length;
  const hasResults = !!summary;
  const evaluatedNames = new Set(evaluations.map((e) => e.bidder_id));
  const newSinceEval = bidderArr.filter((b) => !evaluatedNames.has(b.bidder_id)).length;

  const fmtTime = (d) => {
    if (!d) return '—';
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return d.toLocaleTimeString();
  };

  return (
    <div className="td-root fade-in">
      {/* ── Header ───────────────────────────────── */}
      <div className="td-head">
        <button className="btn btn-secondary btn-sm td-back" onClick={onBack}>
          ← All tenders
        </button>
        <div className="td-title-block">
          <div className="td-eyebrow">
            {tenderNumber(tenderState) || 'Tender'}
          </div>
          {editingTitle ? (
            <div className="td-title-edit">
              <input
                className="td-title-input"
                value={titleDraft}
                autoFocus
                disabled={savingTitle}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle();
                  if (e.key === 'Escape') cancelEdit();
                }}
                placeholder="e.g. CRPF/IT/2025-26/001 — Supply of IT Equipment"
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={saveTitle}
                disabled={savingTitle || !titleDraft.trim()}
              >
                {savingTitle ? <span className="spinner-sm" /> : '✓'} Save
              </button>
              <button className="btn btn-secondary btn-sm" onClick={cancelEdit} disabled={savingTitle}>
                ✕
              </button>
            </div>
          ) : (
            <h1 className="td-title">
              {tenderDisplayTitle(tenderState)}
              <button className="td-rename" onClick={startEdit} title="Rename tender">
                ✏️
              </button>
            </h1>
          )}
          <div className="td-meta">
            <span className="td-id">ID · {tender.id}</span>
            <span className="td-dot">•</span>
            <span className="td-id">📄 {tenderState?.filename}</span>
            <span className="td-dot">•</span>
            <span className={`live-chip ${livePulse ? 'pulsing' : ''}`}>
              <span className="live-dot" /> LIVE
            </span>
            <span className="td-dot">•</span>
            <span>Updated {fmtTime(lastSync)}</span>
          </div>
        </div>
        <div className="td-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => refresh(false)}>
            🔄 Refresh
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onAuditOpen}>
            📜 Audit
          </button>
          {hasResults && (
            <>
              <a href={api.getJsonReportUrl(tender.id)} download className="btn btn-secondary btn-sm">
                📥 JSON
              </a>
              <a href={api.getPdfReportUrl(tender.id)} download className="btn btn-secondary btn-sm">
                📥 PDF
              </a>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner fade-in">
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} className="error-close">✕</button>
        </div>
      )}

      {/* ── Stat strip ───────────────────────────── */}
      <div className="td-stats">
        <div className="td-stat">
          <div className="td-stat-num">{criteria.length}</div>
          <div className="td-stat-label">Criteria</div>
          <div className="td-stat-sub">{criteria.filter((c) => c.mandatory).length} mandatory</div>
        </div>
        <div className="td-stat td-stat-live">
          <div className="td-stat-num">
            {bidderArr.length}
            <span className="live-dot inline" />
          </div>
          <div className="td-stat-label">Bidders submitted</div>
          <div className="td-stat-sub">{extractedCount} processed · {bidderArr.length - extractedCount} pending</div>
        </div>
        <div className="td-stat">
          <div className="td-stat-num td-stat-pass">
            {summary ? summary.eligible.length : '—'}
          </div>
          <div className="td-stat-label">Eligible</div>
          <div className="td-stat-sub">{summary ? summary.eligible.join(', ') || 'none yet' : 'run evaluation'}</div>
        </div>
        <div className="td-stat">
          <div className="td-stat-num td-stat-fail">
            {summary ? summary.not_eligible.length : '—'}
          </div>
          <div className="td-stat-label">Not eligible</div>
          <div className="td-stat-sub">{summary ? `${summary.needs_review.length} need manual review` : '—'}</div>
        </div>
      </div>

      {/* ── Big primary action ───────────────────── */}
      <div className="td-cta-row">
        {!hasResults ? (
          <button
            className="btn btn-primary btn-lg"
            disabled={busy || bidderArr.length === 0}
            onClick={runEval}
          >
            {busy ? <><span className="spinner-sm" /> {busyMsg}</> : '⚡ Run AI Evaluation'}
          </button>
        ) : (
          <button className="btn btn-primary" disabled={busy} onClick={runEval}>
            {busy ? <><span className="spinner-sm" /> Re-evaluating…</> : '🔁 Re-evaluate all bidders'}
          </button>
        )}
        {bidderArr.length === 0 && (
          <span className="td-cta-hint">Waiting for bidder submissions from the public portal.</span>
        )}
        {newSinceEval > 0 && hasResults && (
          <span className="td-new-pill">+{newSinceEval} new since last evaluation</span>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────── */}
      <div className="td-tabs">
        {[
          { id: 'overview', label: 'Overview',     icon: '📊' },
          { id: 'insights', label: 'Insights',     icon: '📈' },
          { id: 'matrix',   label: 'Matrix',       icon: '▦' },
          { id: 'bidders',  label: `Bidders (${bidderArr.length})`, icon: '🏢' },
          { id: 'criteria', label: `Criteria (${criteria.length})`, icon: '📋' },
        ].map((t) => (
          <button
            key={t.id}
            className={`td-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────── */}
      <div className="td-tab-content">
        {activeTab === 'overview' && (
          <div className="td-grid">
            {/* Submissions feed */}
            <div className="glass-card td-feed">
              <div className="td-card-head">
                <h3>Live submissions</h3>
                <span className="live-chip"><span className="live-dot" /> Polling every 8s</span>
              </div>
              {bidderArr.length === 0 ? (
                <div className="td-empty">
                  <div style={{ fontSize: '2rem' }}>📭</div>
                  <p>No bidders yet. Share the Bidder Portal link with vendors:</p>
                  <code className="td-link">/bidder</code>
                </div>
              ) : (
                <div className="td-feed-list">
                  {bidderArr.slice().reverse().map((b) => {
                    const ev = evaluations.find((e) => e.bidder_id === b.bidder_id);
                    const verdict = ev?.overall_decision;
                    return (
                      <div key={b.bidder_id} className="td-feed-row">
                        <div className="td-feed-icon">🏢</div>
                        <div className="td-feed-body">
                          <div className="td-feed-name">{b.bidder_name}</div>
                          <div className="td-feed-sub">
                            {b.documents?.length || 0} docs · {b.status}
                          </div>
                        </div>
                        {verdict ? (
                          <span className={`badge ${verdict === 'PASS' ? 'badge-pass' : verdict === 'FAIL' ? 'badge-fail' : 'badge-review'}`}>
                            {verdict === 'PASS' ? 'ELIGIBLE' : verdict === 'FAIL' ? 'NOT ELIGIBLE' : 'REVIEW'}
                          </span>
                        ) : (
                          <span className="badge badge-review">QUEUED</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary or call-to-action */}
            <div className="glass-card td-summary-card">
              <div className="td-card-head">
                <h3>Verdict snapshot</h3>
              </div>
              {summary ? (
                <Summary summary={summary} />
              ) : (
                <div className="td-empty">
                  <div style={{ fontSize: '2rem' }}>⚖️</div>
                  <p>No verdicts yet.<br />Click <strong>Run AI Evaluation</strong> when you're ready.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'bidders' && (
          <div>
            {evaluations.length === 0 ? (
              <div className="td-empty glass-card">
                <div style={{ fontSize: '2rem' }}>⏳</div>
                <p>Run evaluation first to see per-bidder verdicts.</p>
              </div>
            ) : (
              <div className="stagger">
                {evaluations.map((ev) => (
                  <BidderCard key={ev.bidder_id} evaluation={ev} onOverride={handleOverride} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'insights' && (
          <TenderInsights
            tender={tenderState}
            criteria={criteria}
            bidders={bidderArr}
            evaluations={evaluations}
            summary={summary}
          />
        )}

        {activeTab === 'matrix' && (
          <div className="fade-in">
            <ComparisonMatrix evaluations={evaluations} criteria={criteria} />
          </div>
        )}

        {activeTab === 'criteria' && (
          <div className="fade-in">
            {criteria.length === 0 ? (
              <div className="td-empty glass-card">
                <div style={{ fontSize: '2rem' }}>🔍</div>
                <p>No criteria found yet for this tender.</p>
              </div>
            ) : (
              <CriteriaList criteria={criteria} />
            )}
          </div>
        )}
      </div>

      <style>{`
        .td-root { position: relative; }

        .td-head {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .td-back { align-self: center; }
        .td-eyebrow {
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--accent-primary);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .td-title {
          font-size: 1.55rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.25;
          margin-bottom: 6px;
          display: inline-flex;
          align-items: flex-start;
          gap: 8px;
          flex-wrap: wrap;
        }
        .td-rename {
          background: transparent;
          border: 1px solid var(--bg-glass-border);
          border-radius: 8px;
          width: 28px; height: 28px;
          font-size: 0.78rem;
          color: var(--text-muted);
          cursor: pointer;
          opacity: 0;
          transition: opacity 150ms, background 150ms;
        }
        .td-title:hover .td-rename { opacity: 1; }
        .td-rename:hover {
          background: rgba(255,255,255,0.05);
          color: var(--accent-primary);
        }
        .td-title-edit {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 6px;
          flex-wrap: wrap;
        }
        .td-title-input {
          flex: 1;
          min-width: 280px;
          padding: 10px 14px;
          background: var(--bg-glass);
          border: 1px solid var(--accent-primary);
          border-radius: 10px;
          color: var(--text-heading);
          font-family: var(--font-family);
          font-size: 1.1rem;
          font-weight: 700;
          outline: none;
        }
        .td-meta {
          display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
          font-size: 0.78rem;
          color: var(--text-muted);
        }
        .td-id { font-family: monospace; }
        .td-dot { color: var(--text-muted); }
        .td-actions { display: flex; gap: 6px; flex-wrap: wrap; align-self: center; }

        .live-chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 3px 10px;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 1px;
          color: var(--status-pass);
          background: var(--status-pass-bg);
          border: 1px solid rgba(0, 229, 160, 0.3);
          border-radius: 999px;
          text-transform: uppercase;
        }
        .live-chip.pulsing {
          animation: liveBlink 0.6s ease-in-out 4;
        }
        @keyframes liveBlink {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 229, 160, 0.5); }
          50%      { box-shadow: 0 0 0 8px rgba(0, 229, 160, 0); }
        }
        .live-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: var(--status-pass);
          box-shadow: 0 0 8px rgba(0, 229, 160, 0.6);
          animation: livePulse 1.6s ease-in-out infinite;
        }
        .live-dot.inline {
          margin-left: 8px;
          width: 10px; height: 10px;
          vertical-align: middle;
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }

        /* Stat strip */
        .td-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }
        @media (max-width: 880px) {
          .td-stats { grid-template-columns: repeat(2, 1fr); }
        }
        .td-stat {
          padding: 16px;
          background: var(--bg-card);
          border: 1px solid var(--bg-glass-border);
          border-radius: 14px;
          backdrop-filter: blur(20px);
        }
        .td-stat-num {
          font-size: 1.8rem;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.02em;
          margin-bottom: 4px;
          background: var(--gradient-accent);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .td-stat-num.td-stat-pass { background: none; color: var(--status-pass); -webkit-text-fill-color: var(--status-pass); }
        .td-stat-num.td-stat-fail { background: none; color: var(--status-fail); -webkit-text-fill-color: var(--status-fail); }
        .td-stat-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }
        .td-stat-sub {
          font-size: 0.72rem;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .td-stat-live { border-color: rgba(0, 229, 160, 0.25); }

        /* CTA row */
        .td-cta-row {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          padding: 16px; margin-bottom: 16px;
          background: linear-gradient(135deg, rgba(0,229,160,0.08), rgba(61,139,253,0.08));
          border: 1px solid rgba(0, 229, 160, 0.2);
          border-radius: 14px;
        }
        .td-cta-hint { font-size: 0.85rem; color: var(--text-muted); }
        .td-new-pill {
          font-size: 0.72rem;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 999px;
          color: var(--status-review);
          background: var(--status-review-bg);
          border: 1px solid rgba(255, 183, 77, 0.3);
        }

        /* Tabs */
        .td-tabs {
          display: flex; gap: 4px;
          padding: 4px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--bg-glass-border);
          border-radius: 12px;
          margin-bottom: 16px;
          width: fit-content;
        }
        .td-tab {
          padding: 8px 14px;
          background: transparent;
          border: none;
          border-radius: 8px;
          font-family: var(--font-family);
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          display: inline-flex; align-items: center; gap: 6px;
          transition: all 150ms;
        }
        .td-tab:hover { color: var(--text-heading); }
        .td-tab.active {
          background: var(--accent-glow);
          color: var(--text-heading);
        }

        .td-tab-content { animation: fadeIn 0.4s ease-out; }

        /* Two-col grid */
        .td-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 16px;
        }
        @media (max-width: 1000px) {
          .td-grid { grid-template-columns: 1fr; }
        }

        .td-card-head {
          display: flex; justify-content: space-between; align-items: center;
          padding-bottom: 12px;
          margin-bottom: 12px;
          border-bottom: 1px solid var(--bg-glass-border);
        }
        .td-card-head h3 { font-size: 1rem; font-weight: 700; }

        .td-feed-list {
          display: flex; flex-direction: column; gap: 8px;
          max-height: 400px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .td-feed-row {
          display: flex; align-items: center; gap: 12px;
          padding: 12px;
          border-radius: 10px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--bg-glass-border);
          transition: background 150ms;
        }
        .td-feed-row:hover { background: rgba(255,255,255,0.04); }
        .td-feed-icon {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: rgba(0, 229, 160, 0.08);
          border: 1px solid rgba(0, 229, 160, 0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 1rem;
          flex-shrink: 0;
        }
        .td-feed-body { flex: 1; min-width: 0; }
        .td-feed-name {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-heading);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .td-feed-sub {
          font-size: 0.72rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .td-summary-card .summary-section { margin-bottom: 0; }
        .td-summary-card .summary-section h2 { display: none; }
        .td-summary-card .summary-grid { grid-template-columns: 1fr; gap: 8px; }
        .td-summary-card .summary-card { padding: 12px; }
        .td-summary-card .summary-count { font-size: 1.6rem; }

        .td-empty {
          padding: 32px;
          text-align: center;
          color: var(--text-muted);
        }
        .td-empty p { margin-top: 8px; font-size: 0.9rem; line-height: 1.5; }
        .td-link {
          display: inline-block;
          margin-top: 8px;
          padding: 4px 10px;
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          font-family: monospace;
          color: var(--accent-primary);
          font-size: 0.85rem;
        }

        .spinner-sm {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: var(--bg-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}
