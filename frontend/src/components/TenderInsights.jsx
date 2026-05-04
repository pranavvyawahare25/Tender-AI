import { useEffect, useMemo, useState } from 'react';

function useCountUp(value, duration = 700) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const startAt = performance.now();
    let frame;

    const tick = (now) => {
      const progress = Math.min((now - startAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return display;
}

function ImpactCounter({ label, value, sub, tone = 'info', suffix = '' }) {
  const count = useCountUp(value);

  return (
    <div className={`ti-impact ti-impact-${tone}`}>
      <div className="ti-impact-value">{count}{suffix}</div>
      <div className="ti-impact-label">{label}</div>
      <div className="ti-impact-sub">{sub}</div>
    </div>
  );
}

export default function TenderInsights({ tender, criteria = [], bidders = [], evaluations = [], summary }) {
  const stats = useMemo(() => {
    const totalBidders = bidders.length;
    const extracted = bidders.filter((b) => b.status === 'extracted').length;
    const evaluated = evaluations.length;
    const eligible = summary?.eligible?.length || evaluations.filter((e) => e.overall_decision === 'PASS').length;
    const review = summary?.needs_review?.length || evaluations.filter((e) => e.overall_decision === 'NEED_REVIEW').length;
    const failed = summary?.not_eligible?.length || evaluations.filter((e) => e.overall_decision === 'FAIL').length;
    const allResults = evaluations.flatMap((e) => e.results || []);
    const passedChecks = allResults.filter((r) => r.decision === 'PASS').length;
    const totalChecks = allResults.length || totalBidders * criteria.length;
    const avgConfidence = allResults.length
      ? Math.round((allResults.reduce((sum, r) => sum + (Number(r.confidence) || 0), 0) / allResults.length) * 100)
      : 0;
    const automationCoverage = totalChecks ? Math.round((passedChecks / totalChecks) * 100) : 0;

    return {
      totalBidders,
      extracted,
      evaluated,
      eligible,
      review,
      failed,
      totalChecks,
      passedChecks,
      avgConfidence,
      automationCoverage,
    };
  }, [bidders, criteria.length, evaluations, summary]);

  const funnel = [
    { label: 'Submitted', value: stats.totalBidders, tone: 'info' },
    { label: 'Extracted', value: stats.extracted, tone: 'brand' },
    { label: 'Evaluated', value: stats.evaluated, tone: 'warn' },
    { label: 'Eligible', value: stats.eligible, tone: 'pass' },
  ];
  const maxFunnel = Math.max(...funnel.map((f) => f.value), 1);

  const timeline = [
    {
      key: 'upload',
      label: 'Tender uploaded',
      detail: tender?.filename || 'Tender package received',
      state: 'done',
    },
    {
      key: 'criteria',
      label: 'Eligibility criteria extracted',
      detail: `${criteria.length} criteria identified`,
      state: criteria.length ? 'done' : 'pending',
    },
    ...bidders.slice().reverse().map((b) => ({
      key: b.bidder_id,
      label: `${b.bidder_name || 'Bidder'} submitted documents`,
      detail: `${b.documents?.length || 0} document${(b.documents?.length || 0) === 1 ? '' : 's'} · ${b.status || 'queued'}`,
      state: b.status === 'extracted' ? 'done' : 'active',
    })),
    {
      key: 'evaluation',
      label: 'AI evaluation complete',
      detail: stats.evaluated
        ? `${stats.evaluated} bidders scored across ${criteria.length} criteria`
        : 'Waiting for evaluation run',
      state: stats.evaluated ? 'done' : 'pending',
    },
  ].slice(0, 8);

  return (
    <div className="ti-root">
      <div className="ti-grid">
        <section className="glass-card ti-funnel">
          <div className="ti-card-head">
            <div>
              <div className="ti-eyebrow">Eligibility funnel</div>
              <h3>Bidder progression</h3>
            </div>
            <span className="ti-chip">{stats.review} review</span>
          </div>
          <div className="ti-funnel-list">
            {funnel.map((item) => (
              <div key={item.label} className="ti-funnel-row">
                <div className="ti-funnel-meta">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
                <div className="ti-funnel-track">
                  <div
                    className={`ti-funnel-fill ti-${item.tone}`}
                    style={{ width: `${Math.max((item.value / maxFunnel) * 100, item.value ? 12 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card ti-impact-wrap">
          <div className="ti-card-head">
            <div>
              <div className="ti-eyebrow">Impact metrics</div>
              <h3>Evaluation lift</h3>
            </div>
          </div>
          <div className="ti-impact-grid">
            <ImpactCounter label="Checks automated" value={stats.totalChecks} sub={`${stats.passedChecks} passing evidence matches`} tone="brand" />
            <ImpactCounter label="Confidence" value={stats.avgConfidence} sub="mean extraction confidence" tone="info" suffix="%" />
            <ImpactCounter label="Eligibility rate" value={stats.totalBidders ? Math.round((stats.eligible / stats.totalBidders) * 100) : 0} sub={`${stats.failed} not eligible`} tone="pass" suffix="%" />
            <ImpactCounter label="Coverage" value={stats.automationCoverage} sub="criteria with pass decisions" tone="warn" suffix="%" />
          </div>
        </section>
      </div>

      <section className="glass-card ti-timeline">
        <div className="ti-card-head">
          <div>
            <div className="ti-eyebrow">Activity timeline</div>
            <h3>Recent tender activity</h3>
          </div>
        </div>
        <div className="ti-timeline-list">
          {timeline.map((item) => (
            <div key={item.key} className={`ti-time-row ti-time-${item.state}`}>
              <div className="ti-time-dot" />
              <div className="ti-time-body">
                <div className="ti-time-label">{item.label}</div>
                <div className="ti-time-detail">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        .ti-root { display: flex; flex-direction: column; gap: 16px; }
        .ti-grid { display: grid; grid-template-columns: 0.95fr 1.05fr; gap: 16px; }
        @media (max-width: 980px) { .ti-grid { grid-template-columns: 1fr; } }
        .ti-card-head {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 12px; padding-bottom: 12px; margin-bottom: 14px;
          border-bottom: 1px solid var(--bg-glass-border);
        }
        .ti-card-head h3 { font-size: 1rem; }
        .ti-eyebrow {
          font-size: 0.68rem; font-weight: 800; letter-spacing: 1.2px;
          color: var(--accent-primary); text-transform: uppercase; margin-bottom: 3px;
        }
        .ti-chip {
          padding: 4px 10px; border-radius: 999px; font-size: 0.7rem; font-weight: 800;
          color: var(--status-review); background: var(--status-review-bg);
          border: 1px solid rgba(255, 183, 77, 0.3);
        }
        .ti-funnel-list { display: flex; flex-direction: column; gap: 14px; }
        .ti-funnel-meta {
          display: flex; justify-content: space-between; gap: 12px;
          font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 6px;
        }
        .ti-funnel-meta strong { color: var(--text-heading); font-size: 0.95rem; }
        .ti-funnel-track {
          height: 12px; border-radius: 999px; background: rgba(255,255,255,0.05);
          border: 1px solid var(--bg-glass-border); overflow: hidden;
        }
        .ti-funnel-fill {
          height: 100%; border-radius: inherit; transition: width 700ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .ti-brand { background: var(--gradient-accent); }
        .ti-info { background: linear-gradient(90deg, #3d8bfd, #7aa7ff); }
        .ti-pass { background: linear-gradient(90deg, #00e5a0, #65f0c5); }
        .ti-warn { background: linear-gradient(90deg, #ffb74d, #ffd391); }
        .ti-impact-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        @media (max-width: 620px) { .ti-impact-grid { grid-template-columns: 1fr; } }
        .ti-impact {
          min-height: 112px; padding: 14px; border-radius: 12px;
          background: rgba(255,255,255,0.03); border: 1px solid var(--bg-glass-border);
        }
        .ti-impact-value {
          font-size: 1.7rem; font-weight: 850; line-height: 1;
          color: var(--text-heading); margin-bottom: 8px;
        }
        .ti-impact-brand .ti-impact-value { color: var(--accent-primary); }
        .ti-impact-info .ti-impact-value { color: var(--accent-secondary); }
        .ti-impact-pass .ti-impact-value { color: var(--status-pass); }
        .ti-impact-warn .ti-impact-value { color: var(--status-review); }
        .ti-impact-label {
          font-size: 0.76rem; font-weight: 800; color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: 0.7px;
        }
        .ti-impact-sub { font-size: 0.75rem; color: var(--text-muted); line-height: 1.35; margin-top: 4px; }
        .ti-timeline-list { display: flex; flex-direction: column; }
        .ti-time-row {
          display: grid; grid-template-columns: 22px 1fr; gap: 10px;
          position: relative; padding: 0 0 14px;
        }
        .ti-time-row:not(:last-child)::after {
          content: ''; position: absolute; left: 5px; top: 14px; bottom: 0;
          width: 1px; background: var(--bg-glass-border);
        }
        .ti-time-dot {
          width: 11px; height: 11px; border-radius: 50%; margin-top: 5px;
          background: var(--text-muted); box-shadow: 0 0 0 4px rgba(255,255,255,0.03);
          z-index: 1;
        }
        .ti-time-done .ti-time-dot { background: var(--status-pass); }
        .ti-time-active .ti-time-dot {
          background: var(--status-review);
          animation: tiPulse 1.5s ease-in-out infinite;
        }
        @keyframes tiPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(255,183,77,0.14); }
          50% { box-shadow: 0 0 0 8px rgba(255,183,77,0); }
        }
        .ti-time-label { font-size: 0.88rem; font-weight: 700; color: var(--text-heading); }
        .ti-time-detail { font-size: 0.76rem; color: var(--text-muted); margin-top: 2px; }
      `}</style>
    </div>
  );
}
