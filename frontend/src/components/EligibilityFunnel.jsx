/**
 * EligibilityFunnel — SVG funnel showing how bidders flow through the
 * mandatory criteria of a tender.
 *
 *   Submitted → Pass crit 1 → Pass crit 2 → … → Final eligible
 *
 * Each stage shows a horizontal bar whose width is proportional to the number
 * of bidders still in contention at that point.
 */
import { useMemo } from 'react';

function buildStages(evaluations, criteria) {
  if (!evaluations || evaluations.length === 0) return null;

  const total = evaluations.length;
  // Use mandatory criteria first, then optional, in declaration order
  const ordered = (criteria || [])
    .slice()
    .sort((a, b) => Number(!!b.mandatory) - Number(!!a.mandatory));

  const stages = [
    { label: 'Submitted', count: total, criterion: null, sample: null },
  ];

  let stillIn = new Set(evaluations.map((e) => e.bidder_id));

  for (const crit of ordered) {
    if (stillIn.size === 0) break;
    const passed = new Set();
    const dropped = [];
    for (const ev of evaluations) {
      if (!stillIn.has(ev.bidder_id)) continue;
      const r = (ev.results || []).find(
        (x) => (x.criterion || '').trim().toLowerCase() === (crit.criterion || '').trim().toLowerCase()
      );
      if (!r) {
        // unknown — keep them in (no decision yet)
        passed.add(ev.bidder_id);
      } else if (r.decision === 'PASS') {
        passed.add(ev.bidder_id);
      } else {
        dropped.push({ name: ev.bidder_name, reason: r.reason || `Failed: ${crit.criterion}` });
      }
    }
    stages.push({
      label: crit.criterion,
      mandatory: !!crit.mandatory,
      count: passed.size,
      lostCount: stillIn.size - passed.size,
      lost: dropped.slice(0, 3),
      criterion: crit,
    });
    stillIn = passed;
  }

  // Last stage: final overall decision
  const eligible = evaluations.filter((e) => e.overall_decision === 'PASS').length;
  const review = evaluations.filter((e) => e.overall_decision === 'NEED_REVIEW').length;
  const fail = evaluations.filter((e) => e.overall_decision === 'FAIL').length;

  return { stages, total, eligible, review, fail };
}

export default function EligibilityFunnel({ evaluations, criteria }) {
  const data = useMemo(() => buildStages(evaluations, criteria), [evaluations, criteria]);

  if (!data) {
    return (
      <div className="ef-empty glass-card">
        <div style={{ fontSize: '2rem' }}>🪜</div>
        <p>Run evaluation first to see the eligibility funnel.</p>
      </div>
    );
  }

  const { stages, total, eligible, review, fail } = data;
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="ef-root">
      <div className="ef-head">
        <div>
          <div className="ef-eyebrow">🪜 Eligibility Funnel</div>
          <h2 className="ef-title">How bidders narrow through criteria</h2>
          <p className="ef-sub">
            Each row shows how many bidders survive that criterion.
            Mandatory criteria are checked first.
          </p>
        </div>
        <div className="ef-final-pills">
          <span className="ef-pill ef-pill-pass">✓ {eligible} eligible</span>
          <span className="ef-pill ef-pill-review">? {review} review</span>
          <span className="ef-pill ef-pill-fail">✕ {fail} not eligible</span>
        </div>
      </div>

      <div className="ef-bars">
        {stages.map((s, i) => {
          const pct = (s.count / maxCount) * 100;
          const dropPct = i === 0 ? 0 : ((stages[i - 1].count - s.count) / Math.max(1, stages[i - 1].count)) * 100;
          return (
            <div key={i} className="ef-row">
              <div className="ef-row-head">
                <div className="ef-row-label">
                  {i === 0 ? '📥' : (s.mandatory ? '🔒' : '✓')}
                  <span>{s.label}</span>
                  {s.mandatory && <span className="ef-tag-m">MANDATORY</span>}
                </div>
                <div className="ef-row-stats">
                  {i > 0 && stages[i - 1].count > s.count && (
                    <span className="ef-drop">
                      −{stages[i - 1].count - s.count} dropped ({dropPct.toFixed(0)}%)
                    </span>
                  )}
                  <span className="ef-count">{s.count} / {total}</span>
                </div>
              </div>
              <div className="ef-bar-track">
                <div
                  className="ef-bar-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {s.lost && s.lost.length > 0 && (
                <div className="ef-lost">
                  {s.lost.map((l, j) => (
                    <span key={j} className="ef-lost-chip" title={l.reason}>
                      ❌ {l.name}
                    </span>
                  ))}
                  {s.lostCount > s.lost.length && (
                    <span className="ef-lost-chip ef-lost-more">
                      +{s.lostCount - s.lost.length} more
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .ef-root {}
        .ef-head {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 16px; flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .ef-eyebrow {
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--accent-secondary);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .ef-title {
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: -0.01em;
          margin-bottom: 4px;
        }
        .ef-sub {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
          max-width: 540px;
        }
        .ef-final-pills {
          display: flex; gap: 6px; flex-wrap: wrap;
        }
        .ef-pill {
          font-size: 0.72rem;
          font-weight: 800;
          padding: 5px 12px;
          border-radius: 999px;
          letter-spacing: 0.5px;
          border: 1px solid;
        }
        .ef-pill-pass   { color: var(--status-pass); background: var(--status-pass-bg); border-color: rgba(0, 229, 160, 0.3); }
        .ef-pill-review { color: var(--status-review); background: var(--status-review-bg); border-color: rgba(255, 183, 77, 0.3); }
        .ef-pill-fail   { color: var(--status-fail); background: var(--status-fail-bg); border-color: rgba(255, 77, 106, 0.3); }

        .ef-bars {
          padding: 18px;
          background: var(--bg-card);
          border: 1px solid var(--bg-glass-border);
          border-radius: 14px;
          backdrop-filter: blur(20px);
        }
        .ef-row {
          padding: 10px 0;
          border-bottom: 1px dashed var(--bg-glass-border);
        }
        .ef-row:last-child { border-bottom: 0; }
        .ef-row-head {
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .ef-row-label {
          display: inline-flex; align-items: center; gap: 8px;
          font-weight: 700;
          font-size: 0.92rem;
          color: var(--text-heading);
          flex: 1;
          min-width: 0;
        }
        .ef-row-label > span:first-of-type {
          word-break: break-word;
        }
        .ef-tag-m {
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          padding: 2px 6px;
          border-radius: 999px;
          color: var(--status-fail);
          background: var(--status-fail-bg);
          border: 1px solid rgba(255, 77, 106, 0.3);
          margin-left: 4px;
        }
        .ef-row-stats {
          display: flex; gap: 10px; align-items: center;
          font-size: 0.75rem;
        }
        .ef-drop {
          color: var(--status-fail);
          font-weight: 700;
        }
        .ef-count {
          font-weight: 800;
          color: var(--accent-primary);
          font-family: monospace;
        }
        .ef-bar-track {
          height: 14px;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          overflow: hidden;
        }
        .ef-bar-fill {
          height: 100%;
          background: var(--gradient-accent);
          border-radius: 8px;
          transition: width 600ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        .ef-lost {
          margin-top: 8px;
          display: flex; gap: 6px; flex-wrap: wrap;
        }
        .ef-lost-chip {
          font-size: 0.7rem;
          padding: 3px 9px;
          border-radius: 999px;
          background: var(--status-fail-bg);
          color: var(--status-fail);
          border: 1px solid rgba(255, 77, 106, 0.25);
        }
        .ef-lost-more {
          background: rgba(255,255,255,0.04);
          color: var(--text-muted);
          border-color: var(--bg-glass-border);
        }

        .ef-empty {
          padding: 56px 24px;
          text-align: center;
          color: var(--text-muted);
        }
        .ef-empty p { margin-top: 8px; font-size: 0.9rem; }
      `}</style>
    </div>
  );
}
