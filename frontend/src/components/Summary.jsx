/**
 * Summary — Eligibility summary cards.
 */
export default function Summary({ summary }) {
  if (!summary) return null;

  return (
    <div className="summary-section">
      <h2 className="section-title">📊 Evaluation Summary</h2>
      <div className="summary-grid stagger">
        <div className="glass-card summary-card">
          <div className="summary-count eligible">{summary.eligible?.length || 0}</div>
          <div className="summary-label">Eligible</div>
          <div className="summary-names">
            {summary.eligible?.length > 0
              ? summary.eligible.join(', ')
              : 'None'}
          </div>
        </div>
        <div className="glass-card summary-card">
          <div className="summary-count not-eligible">{summary.not_eligible?.length || 0}</div>
          <div className="summary-label">Not Eligible</div>
          <div className="summary-names">
            {summary.not_eligible?.length > 0
              ? summary.not_eligible.join(', ')
              : 'None'}
          </div>
        </div>
        <div className="glass-card summary-card">
          <div className="summary-count needs-review">{summary.needs_review?.length || 0}</div>
          <div className="summary-label">Needs Review</div>
          <div className="summary-names">
            {summary.needs_review?.length > 0
              ? summary.needs_review.join(', ')
              : 'None'}
          </div>
        </div>
      </div>
    </div>
  );
}
