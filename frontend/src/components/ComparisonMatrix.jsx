/**
 * ComparisonMatrix — pivot table for criterion-by-criterion bidder comparison.
 * Rows = bidders, cols = criteria, cells = decision + value + confidence.
 * Sticky first column + sticky header row for scrollable wide matrices.
 */
import { useMemo } from 'react';

const PILLS = {
  PASS:        { bg: 'rgba(0, 229, 160, 0.18)',  color: 'var(--status-pass)',   icon: '✓' },
  FAIL:        { bg: 'rgba(255, 77, 106, 0.18)', color: 'var(--status-fail)',   icon: '✕' },
  NEED_REVIEW: { bg: 'rgba(255, 183, 77, 0.18)', color: 'var(--status-review)', icon: '?' },
};

export default function ComparisonMatrix({ evaluations, criteria = [] }) {
  const rows = evaluations || [];
  const normalizeCriterion = (value = '') =>
    value
      .toLowerCase()
      .replace(/\s*\([^)]*\)\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  // Use criteria from the tender if available; else derive from results
  const cols = useMemo(() => {
    if (criteria && criteria.length > 0) {
      return criteria.map((c) => ({
        name: c.criterion,
        value: c.value,
        type: c.type,
        mandatory: c.mandatory,
      }));
    }
    const seen = new Map();
    rows.forEach((r) =>
      (r.results || []).forEach((res) => {
        if (!seen.has(res.criterion)) seen.set(res.criterion, {
          name: res.criterion,
          value: '',
          type: '',
          mandatory: false,
        });
      })
    );
    return [...seen.values()];
  }, [criteria, rows]);

  if (rows.length === 0) {
    return (
      <div className="cm-empty glass-card">
        <div style={{ fontSize: '2rem' }}>📊</div>
        <p>Run evaluation first to see the comparison matrix.</p>
      </div>
    );
  }

  const cell = (bidder, critName) => {
    const key = normalizeCriterion(critName);
    const r = (bidder.results || []).find(
      (x) => normalizeCriterion(x.criterion) === key
    );
    return r;
  };

  const decisionCounts = (col) => {
    const out = { PASS: 0, FAIL: 0, NEED_REVIEW: 0 };
    rows.forEach((b) => {
      const c = cell(b, col.name);
      if (c?.decision && out[c.decision] !== undefined) out[c.decision]++;
    });
    return out;
  };

  return (
    <div className="cm-root">
      <div className="cm-head">
        <div>
          <div className="cm-eyebrow">📊 Side-by-side comparison</div>
          <h2 className="cm-title">Bidder × Criterion matrix</h2>
          <p className="cm-sub">
            Click a bidder name in the Bidders tab to drill into their full
            criterion-level reasoning, sources and confidence scores.
          </p>
        </div>
        <div className="cm-legend">
          <span><span className="cm-leg PASS">✓</span> Pass</span>
          <span><span className="cm-leg NEED_REVIEW">?</span> Review</span>
          <span><span className="cm-leg FAIL">✕</span> Fail</span>
        </div>
      </div>

      <div className="cm-scroll">
        <table className="cm-table">
          <thead>
            <tr>
              <th className="cm-corner">Bidder</th>
              {cols.map((c, i) => {
                const counts = decisionCounts(c);
                return (
                  <th key={i} className="cm-col">
                    <div className="cm-col-name" title={c.name}>{c.name}</div>
                    {c.value && <div className="cm-col-val">{c.value}</div>}
                    <div className="cm-col-counts">
                      <span className="PASS">{counts.PASS}</span>
                      <span className="NEED_REVIEW">{counts.NEED_REVIEW}</span>
                      <span className="FAIL">{counts.FAIL}</span>
                    </div>
                  </th>
                );
              })}
              <th className="cm-overall">Overall</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.bidder_id}>
                <td className="cm-row-head">
                  <div className="cm-row-name">🏢 {b.bidder_name}</div>
                  <div className="cm-row-stats">
                    <span className="PASS">✓ {b.pass_count}</span>
                    <span className="NEED_REVIEW">? {b.review_count}</span>
                    <span className="FAIL">✕ {b.fail_count}</span>
                  </div>
                </td>
                {cols.map((c, i) => {
                  const r = cell(b, c.name);
                  if (!r) {
                    return <td key={i} className="cm-cell cm-cell-empty">—</td>;
                  }
                  const p = PILLS[r.decision];
                  return (
                    <td
                      key={i}
                      className="cm-cell"
                      title={`${r.bidder_value || '—'} · ${r.reason || ''}`}
                    >
                      <div
                        className="cm-pill"
                        style={{ background: p.bg, color: p.color }}
                      >
                        {p.icon}
                      </div>
                      <div className="cm-val">{r.bidder_value || '—'}</div>
                      {Number.isFinite(r.confidence) && (
                        <div className="cm-conf">{Math.round(r.confidence * 100)}%</div>
                      )}
                    </td>
                  );
                })}
                <td className="cm-cell cm-overall-cell">
                  <span
                    className="cm-pill"
                    style={{
                      background: PILLS[b.overall_decision]?.bg,
                      color: PILLS[b.overall_decision]?.color,
                    }}
                  >
                    {PILLS[b.overall_decision]?.icon}
                  </span>
                  <div className="cm-val">
                    {b.overall_decision === 'PASS' ? 'Eligible'
                      : b.overall_decision === 'FAIL' ? 'Not eligible'
                      : 'Review'}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .cm-root {}
        .cm-head {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 16px; flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .cm-eyebrow {
          font-size: 0.7rem; font-weight: 800;
          color: var(--accent-primary);
          letter-spacing: 1.5px; text-transform: uppercase;
          margin-bottom: 4px;
        }
        .cm-title {
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: -0.01em;
          margin-bottom: 4px;
        }
        .cm-sub {
          font-size: 0.85rem;
          color: var(--text-secondary);
          max-width: 560px;
          line-height: 1.5;
        }
        .cm-legend {
          display: flex; gap: 12px; flex-wrap: wrap;
          font-size: 0.78rem;
          color: var(--text-secondary);
        }
        .cm-leg {
          display: inline-flex; align-items: center; justify-content: center;
          width: 18px; height: 18px;
          border-radius: 50%;
          font-weight: 800;
          font-size: 0.7rem;
          margin-right: 4px;
        }
        .cm-leg.PASS         { background: rgba(0, 229, 160, 0.2); color: var(--status-pass); }
        .cm-leg.FAIL         { background: rgba(255, 77, 106, 0.2); color: var(--status-fail); }
        .cm-leg.NEED_REVIEW  { background: rgba(255, 183, 77, 0.2); color: var(--status-review); }

        .cm-scroll {
          overflow: auto;
          border-radius: 14px;
          border: 1px solid var(--bg-glass-border);
          background: var(--bg-card);
          backdrop-filter: blur(20px);
          max-height: 70vh;
        }
        .cm-table {
          border-collapse: separate;
          border-spacing: 0;
          width: 100%;
          font-size: 0.85rem;
        }

        .cm-corner, .cm-col, .cm-overall {
          position: sticky;
          top: 0;
          background: rgba(15, 31, 61, 0.95);
          backdrop-filter: blur(8px);
          z-index: 2;
          border-bottom: 1px solid var(--bg-glass-border);
          padding: 10px 12px;
          text-align: left;
          vertical-align: top;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-secondary);
        }
        .cm-corner {
          left: 0;
          z-index: 3;
          min-width: 180px;
        }
        .cm-overall {
          right: 0;
          background: rgba(15, 31, 61, 0.98);
        }

        .cm-col {
          min-width: 150px;
          max-width: 220px;
        }
        .cm-col-name {
          font-weight: 700;
          font-size: 0.78rem;
          color: var(--text-heading);
          line-height: 1.3;
          margin-bottom: 2px;
        }
        .cm-col-val {
          font-size: 0.7rem;
          color: var(--accent-primary);
          font-weight: 700;
          margin-bottom: 4px;
        }
        .cm-col-counts {
          display: flex; gap: 6px;
          font-size: 0.65rem;
          font-weight: 800;
        }
        .cm-col-counts .PASS         { color: var(--status-pass); }
        .cm-col-counts .FAIL         { color: var(--status-fail); }
        .cm-col-counts .NEED_REVIEW  { color: var(--status-review); }

        .cm-row-head {
          position: sticky;
          left: 0;
          background: rgba(20, 40, 70, 0.95);
          backdrop-filter: blur(8px);
          z-index: 1;
          border-right: 1px solid var(--bg-glass-border);
          padding: 12px;
          min-width: 180px;
        }
        .cm-row-name {
          font-weight: 700;
          font-size: 0.85rem;
          color: var(--text-heading);
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cm-row-stats {
          display: flex; gap: 8px;
          font-size: 0.7rem;
          font-weight: 700;
        }
        .cm-row-stats .PASS         { color: var(--status-pass); }
        .cm-row-stats .FAIL         { color: var(--status-fail); }
        .cm-row-stats .NEED_REVIEW  { color: var(--status-review); }

        .cm-cell {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          border-left: 1px solid rgba(255,255,255,0.03);
          vertical-align: top;
        }
        .cm-cell-empty {
          color: var(--text-muted);
          font-size: 0.85rem;
          text-align: center;
        }
        .cm-pill {
          display: inline-flex; align-items: center; justify-content: center;
          width: 22px; height: 22px;
          border-radius: 6px;
          font-weight: 800;
          margin-bottom: 4px;
        }
        .cm-val {
          font-size: 0.78rem;
          color: var(--text-heading);
          font-weight: 600;
          line-height: 1.35;
          word-break: break-word;
        }
        .cm-conf {
          font-size: 0.65rem;
          color: var(--text-muted);
          margin-top: 2px;
          font-family: monospace;
        }
        .cm-overall-cell {
          position: sticky; right: 0;
          background: rgba(20, 40, 70, 0.95);
          backdrop-filter: blur(8px);
          z-index: 1;
          border-left: 1px solid var(--bg-glass-border);
        }

        .cm-empty {
          padding: 56px 24px;
          text-align: center;
          color: var(--text-muted);
        }
        .cm-empty p { margin-top: 8px; font-size: 0.9rem; }

        tbody tr:hover .cm-row-head,
        tbody tr:hover .cm-overall-cell {
          background: rgba(30, 55, 100, 0.95);
        }
      `}</style>
    </div>
  );
}
