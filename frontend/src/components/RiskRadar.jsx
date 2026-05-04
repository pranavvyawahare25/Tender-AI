/**
 * RiskRadar — derives integrity-risk flags from extracted bidder data.
 * Pure frontend logic (no extra backend calls), runs in O(n²) over bidders.
 *
 * Flags:
 *  • Cartel pattern         — multiple bidders share PAN prefix or address fragment
 *  • Coordinated bidding    — turnover figures within 0.5% of each other
 *  • Low OCR confidence     — any extracted field with confidence < 0.7
 *  • Missing mandatory data — mandatory criterion has no extracted value
 *  • Duplicate documents    — same document filename across bidders
 */
function findFieldValue(bidder, fieldKeys) {
  if (!bidder?.extracted_data) return null;
  for (const item of bidder.extracted_data) {
    for (const key of fieldKeys) {
      const f = (item.field || '').toLowerCase();
      if (f.includes(key.toLowerCase())) return item;
    }
  }
  return null;
}

function findFieldsLike(bidder, fieldKeys) {
  if (!bidder?.extracted_data) return [];
  return bidder.extracted_data.filter((item) => {
    const f = (item.field || '').toLowerCase();
    return fieldKeys.some((k) => f.includes(k.toLowerCase()));
  });
}

export function computeRiskFlags(bidders, criteria = []) {
  const arr = Object.values(bidders || {});
  if (arr.length === 0) return { perBidder: {}, summary: [] };

  const flags = {};
  arr.forEach((b) => { flags[b.bidder_id] = []; });

  // ── Cartel: shared PAN prefix or shared address tokens ──────
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j];
      const aPan = findFieldValue(a, ['pan']);
      const bPan = findFieldValue(b, ['pan']);
      if (aPan?.value && bPan?.value) {
        const ap = String(aPan.value).replace(/\s/g, '').toUpperCase().slice(0, 5);
        const bp = String(bPan.value).replace(/\s/g, '').toUpperCase().slice(0, 5);
        if (ap.length >= 4 && ap === bp) {
          flags[a.bidder_id].push({
            severity: 'high',
            type: 'cartel',
            label: 'Shared PAN prefix',
            text: `Same first-5 PAN chars as ${b.bidder_name} (${ap}…) — possible related entity.`,
          });
          flags[b.bidder_id].push({
            severity: 'high',
            type: 'cartel',
            label: 'Shared PAN prefix',
            text: `Same first-5 PAN chars as ${a.bidder_name} (${ap}…) — possible related entity.`,
          });
        }
      }

      const aAddr = findFieldValue(a, ['address', 'office', 'registered']);
      const bAddr = findFieldValue(b, ['address', 'office', 'registered']);
      if (aAddr?.value && bAddr?.value) {
        const tokens = (s) =>
          new Set(
            String(s)
              .toLowerCase()
              .replace(/[^a-z0-9 ]/g, ' ')
              .split(/\s+/)
              .filter((t) => t.length > 3)
          );
        const ta = tokens(aAddr.value);
        const tb = tokens(bAddr.value);
        const overlap = [...ta].filter((t) => tb.has(t));
        if (overlap.length >= 3) {
          const note = `Shared address tokens with ${b.bidder_name}: ${overlap.slice(0, 3).join(', ')}…`;
          flags[a.bidder_id].push({ severity: 'medium', type: 'cartel', label: 'Address overlap', text: note });
          flags[b.bidder_id].push({
            severity: 'medium',
            type: 'cartel',
            label: 'Address overlap',
            text: `Shared address tokens with ${a.bidder_name}: ${overlap.slice(0, 3).join(', ')}…`,
          });
        }
      }
    }
  }

  // ── Coordinated bidding: turnover within 0.5% across ≥2 bidders ─
  const turnovers = arr
    .map((b) => {
      const t = findFieldValue(b, ['turnover', 'revenue']);
      const num = t?.value ? parseFloat(String(t.value).replace(/[^\d.]/g, '')) : NaN;
      return Number.isFinite(num) && num > 0 ? { bidder: b, num } : null;
    })
    .filter(Boolean);

  for (let i = 0; i < turnovers.length; i++) {
    for (let j = i + 1; j < turnovers.length; j++) {
      const a = turnovers[i], b = turnovers[j];
      const diff = Math.abs(a.num - b.num) / Math.max(a.num, b.num);
      if (diff <= 0.005) {
        const note = `Turnover within 0.5% of ${b.bidder.bidder_name} (~${a.num}) — coordinated bidding pattern.`;
        flags[a.bidder.bidder_id].push({ severity: 'high', type: 'coordinated', label: 'Coordinated turnover', text: note });
        flags[b.bidder.bidder_id].push({
          severity: 'high',
          type: 'coordinated',
          label: 'Coordinated turnover',
          text: `Turnover within 0.5% of ${a.bidder.bidder_name} (~${b.num}) — coordinated bidding pattern.`,
        });
      }
    }
  }

  // ── Low OCR confidence on any extracted field ───────────────
  arr.forEach((b) => {
    const lows = (b.extracted_data || []).filter((d) => Number.isFinite(d.confidence) && d.confidence < 0.7);
    if (lows.length > 0) {
      const fields = lows.slice(0, 3).map((l) => l.field).join(', ');
      const minConf = Math.min(...lows.map((l) => l.confidence));
      flags[b.bidder_id].push({
        severity: 'medium',
        type: 'ocr',
        label: 'Low document confidence',
        text: `${lows.length} field(s) extracted at <70% confidence (lowest ${(minConf * 100).toFixed(0)}%): ${fields}…`,
      });
    }
  });

  // ── Missing mandatory criterion ─────────────────────────────
  const mandatory = (criteria || []).filter((c) => c.mandatory);
  arr.forEach((b) => {
    const missing = [];
    mandatory.forEach((c) => {
      const matches = findFieldsLike(b, [c.criterion]);
      if (matches.length === 0) missing.push(c.criterion);
    });
    if (missing.length > 0) {
      flags[b.bidder_id].push({
        severity: missing.length >= 2 ? 'high' : 'medium',
        type: 'missing',
        label: 'Missing mandatory data',
        text: `No extracted value for: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`,
      });
    }
  });

  // ── Duplicate documents ─────────────────────────────────────
  const docToBidders = {};
  arr.forEach((b) => {
    (b.documents || []).forEach((d) => {
      const k = String(d).toLowerCase().trim();
      docToBidders[k] = docToBidders[k] || [];
      docToBidders[k].push(b);
    });
  });
  Object.entries(docToBidders).forEach(([doc, list]) => {
    if (list.length > 1) {
      list.forEach((b) => {
        flags[b.bidder_id].push({
          severity: 'high',
          type: 'duplicate',
          label: 'Identical document filename',
          text: `Document "${doc}" also submitted by ${list.filter((x) => x.bidder_id !== b.bidder_id).map((x) => x.bidder_name).join(', ')}`,
        });
      });
    }
  });

  // ── Build summary buckets ───────────────────────────────────
  const summary = [];
  const bucket = (severity) =>
    arr
      .filter((b) => flags[b.bidder_id].some((f) => f.severity === severity))
      .map((b) => b.bidder_name);
  if (bucket('high').length)
    summary.push({ severity: 'high', count: bucket('high').length, names: bucket('high') });
  if (bucket('medium').length)
    summary.push({ severity: 'medium', count: bucket('medium').length, names: bucket('medium') });

  return { perBidder: flags, summary };
}

const SEV_STYLE = {
  high:   { bg: 'rgba(255, 77, 106, 0.12)',  border: 'rgba(255, 77, 106, 0.35)',  color: 'var(--status-fail)',   label: 'High risk',   icon: '🚨' },
  medium: { bg: 'rgba(255, 183, 77, 0.12)',  border: 'rgba(255, 183, 77, 0.35)',  color: 'var(--status-review)', label: 'Watch',       icon: '⚠️' },
  low:    { bg: 'rgba(0, 229, 160, 0.10)',   border: 'rgba(0, 229, 160, 0.30)',   color: 'var(--status-pass)',   label: 'Cleared',     icon: '✅' },
};

export default function RiskRadar({ bidders, criteria }) {
  const { perBidder, summary } = computeRiskFlags(bidders, criteria);
  const arr = Object.values(bidders || {});
  const cleared = arr.filter((b) => (perBidder[b.bidder_id] || []).length === 0);

  if (arr.length === 0) return null;

  return (
    <div className="rr-root">
      <div className="rr-head">
        <div>
          <div className="rr-eyebrow">🛡 AI Risk Radar</div>
          <h2 className="rr-title">Integrity & anomaly detection</h2>
          <p className="rr-sub">
            Cross-checks every bidder for cartel patterns, coordinated bidding,
            low-confidence OCR, missing mandatory data and duplicate documents.
          </p>
        </div>
        <div className="rr-pills">
          {summary.length === 0 ? (
            <span className="rr-pill rr-pill-clear">✅ No anomalies detected</span>
          ) : (
            summary.map((s) => (
              <span key={s.severity} className={`rr-pill rr-pill-${s.severity}`}>
                {SEV_STYLE[s.severity].icon} {s.count} {SEV_STYLE[s.severity].label.toLowerCase()}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="rr-grid">
        {arr.map((b) => {
          const fl = perBidder[b.bidder_id] || [];
          const top = fl[0]; // worst flag
          const worstSev = fl.reduce((acc, f) => {
            if (f.severity === 'high') return 'high';
            if (f.severity === 'medium' && acc !== 'high') return 'medium';
            return acc;
          }, fl.length ? fl[0].severity : 'low');
          const style = SEV_STYLE[worstSev];

          return (
            <div
              key={b.bidder_id}
              className="rr-card"
              style={{
                background: style.bg,
                borderColor: style.border,
              }}
            >
              <div className="rr-card-head">
                <div className="rr-card-name">
                  🏢 {b.bidder_name}
                </div>
                <span
                  className="rr-card-badge"
                  style={{ color: style.color, borderColor: style.border }}
                >
                  {style.icon} {fl.length === 0 ? 'Cleared' : style.label}
                </span>
              </div>

              {fl.length === 0 ? (
                <div className="rr-card-empty">
                  All integrity checks passed. No risk patterns detected.
                </div>
              ) : (
                <ul className="rr-flag-list">
                  {fl.slice(0, 4).map((f, i) => (
                    <li key={i} className={`rr-flag rr-flag-${f.severity}`}>
                      <div className="rr-flag-label">
                        {SEV_STYLE[f.severity].icon} {f.label}
                      </div>
                      <div className="rr-flag-text">{f.text}</div>
                    </li>
                  ))}
                  {fl.length > 4 && (
                    <li className="rr-flag-more">+{fl.length - 4} more</li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {cleared.length > 0 && (
        <div className="rr-cleared">
          ✅ {cleared.length} bidder{cleared.length === 1 ? '' : 's'} passed all integrity checks: {cleared.map((b) => b.bidder_name).join(', ')}
        </div>
      )}

      <style>{`
        .rr-root {}
        .rr-head {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 16px; flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .rr-eyebrow {
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--accent-secondary);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .rr-title {
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: -0.01em;
          margin-bottom: 4px;
        }
        .rr-sub {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
          max-width: 560px;
        }
        .rr-pills {
          display: flex; gap: 6px; flex-wrap: wrap;
        }
        .rr-pill {
          font-size: 0.72rem;
          font-weight: 800;
          padding: 5px 12px;
          border-radius: 999px;
          border: 1px solid;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        .rr-pill-clear { color: var(--status-pass); background: var(--status-pass-bg); border-color: rgba(0, 229, 160, 0.3); }
        .rr-pill-medium { color: var(--status-review); background: var(--status-review-bg); border-color: rgba(255, 183, 77, 0.35); }
        .rr-pill-high { color: var(--status-fail); background: var(--status-fail-bg); border-color: rgba(255, 77, 106, 0.35); }

        .rr-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
        .rr-card {
          padding: 14px;
          border-radius: 14px;
          border: 1px solid var(--bg-glass-border);
          backdrop-filter: blur(8px);
        }
        .rr-card-head {
          display: flex; justify-content: space-between; align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .rr-card-name {
          font-weight: 700;
          color: var(--text-heading);
          font-size: 0.92rem;
        }
        .rr-card-badge {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .rr-card-empty {
          font-size: 0.78rem;
          color: var(--text-muted);
          padding: 4px 0 6px;
        }

        .rr-flag-list {
          list-style: none;
          padding: 0;
          margin: 4px 0 0;
          display: flex; flex-direction: column; gap: 6px;
        }
        .rr-flag {
          padding: 8px 10px;
          background: rgba(0, 0, 0, 0.18);
          border-radius: 8px;
          border-left: 3px solid var(--status-review);
        }
        .rr-flag-high   { border-left-color: var(--status-fail); }
        .rr-flag-medium { border-left-color: var(--status-review); }
        .rr-flag-label {
          font-weight: 700;
          font-size: 0.78rem;
          color: var(--text-heading);
          margin-bottom: 2px;
        }
        .rr-flag-text {
          font-size: 0.74rem;
          color: var(--text-secondary);
          line-height: 1.45;
        }
        .rr-flag-more {
          font-size: 0.7rem;
          color: var(--text-muted);
          padding: 4px 10px;
        }

        .rr-cleared {
          margin-top: 14px;
          padding: 10px 14px;
          font-size: 0.78rem;
          color: var(--accent-primary);
          background: rgba(0, 229, 160, 0.06);
          border: 1px dashed rgba(0, 229, 160, 0.25);
          border-radius: 10px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
