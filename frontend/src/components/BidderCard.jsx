/**
 * BidderCard — Expandable evaluation card for a single bidder.
 */
import { useState } from 'react';
import {
  getDecisionClass,
  getConfidenceClass,
  formatConfidence,
  getSourceClass,
  getSourceLabel,
} from '../utils/helpers';

export default function BidderCard({ evaluation, onOverride }) {
  const [expanded, setExpanded] = useState(true);
  const [overrideRow, setOverrideRow] = useState(null);
  const [overrideDecision, setOverrideDecision] = useState('PASS');
  const [overrideReason, setOverrideReason] = useState('');

  const { bidder_id, bidder_name, results, overall_decision, pass_count, fail_count, review_count } = evaluation;

  const handleOverride = (criterion) => {
    if (!overrideReason.trim()) return;
    onOverride(bidder_id, criterion, overrideDecision, overrideReason.trim());
    setOverrideRow(null);
    setOverrideReason('');
  };

  return (
    <div className="glass-card bidder-eval-card">
      <div className="bidder-eval-header" onClick={() => setExpanded(!expanded)}>
        <div className="bidder-eval-name">
          <span style={{ fontSize: '1.5rem' }}>🏢</span>
          <div>
            <h3>{bidder_name}</h3>
            <div className="bidder-eval-stats">
              <span className="stat-item stat-pass">✅ {pass_count}</span>
              <span className="stat-item stat-fail">❌ {fail_count}</span>
              <span className="stat-item stat-review">⚠️ {review_count}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-md">
          <span className={`badge ${getDecisionClass(overall_decision)}`}>
            {overall_decision === 'PASS' ? '✅ ELIGIBLE' : overall_decision === 'FAIL' ? '❌ NOT ELIGIBLE' : '⚠️ NEEDS REVIEW'}
          </span>
          <span className={`expand-icon ${expanded ? 'expanded' : ''}`}>▼</span>
        </div>
      </div>

      {expanded && results.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Criterion</th>
              <th>Bidder Value</th>
              <th>Decision</th>
              <th>Confidence</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className={r.overridden ? 'row-overridden' : ''}>
                <td>
                  <div className="font-medium">{r.criterion}</div>
                  <div className="eval-reason">{r.reason}</div>
                  {r.document && <div className="eval-source">📄 {r.document} {r.page ? `(p.${r.page})` : ''}</div>}
                  {(r.field_raw_text || r.llm_reasoning) && (
                    <details className="evidence-details">
                      <summary>Evidence</summary>
                      <div>{r.llm_reasoning || r.field_raw_text}</div>
                    </details>
                  )}
                </td>
                <td>
                  <span className="font-semibold">{r.bidder_value || '—'}</span>
                  <div className="source-row compact">
                    <span className={`source-pill ${getSourceClass(r.extraction_source)}`}>
                      {getSourceLabel(r.extraction_source)}
                    </span>
                    {r.matched_field && (
                      <span className="source-pill source-regex">
                        {r.matched_field}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span className={`badge ${getDecisionClass(r.decision)}`}>
                    {r.decision}
                  </span>
                  {r.overridden && <span className="overridden-badge">OVERRIDDEN</span>}
                  {r.match_strategy === 'semantic' && (
                    <span
                      className="overridden-badge"
                      style={{ background: 'rgba(61, 139, 253, 0.15)', color: '#3D8BFD' }}
                      title={`Field matched by sentence-embedding similarity (${Math.round((r.match_score || 0) * 100)}%)`}
                    >
                      🧬 SEMANTIC {r.match_score ? Math.round(r.match_score * 100) + '%' : ''}
                    </span>
                  )}
                </td>
                <td>
                  <div className="flex flex-col gap-sm" style={{ minWidth: 80 }}>
                    <span className="text-xs">{formatConfidence(r.confidence)}</span>
                    <div className="confidence-bar">
                      <div
                        className={`confidence-bar-fill ${getConfidenceClass(r.confidence)}`}
                        style={{ width: `${r.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td>
                  {overrideRow === i ? (
                    <div className="override-form">
                      <select className="override-select" value={overrideDecision} onChange={e => setOverrideDecision(e.target.value)}>
                        <option value="PASS">PASS</option>
                        <option value="FAIL">FAIL</option>
                        <option value="NEED_REVIEW">REVIEW</option>
                      </select>
                      <input className="override-input" placeholder="Reason..." value={overrideReason}
                        onChange={e => setOverrideReason(e.target.value)} />
                      <button className="btn btn-primary btn-sm" onClick={() => handleOverride(r.criterion)}>✓</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setOverrideRow(null)}>✕</button>
                    </div>
                  ) : (
                    <button className="btn btn-secondary btn-sm override-btn" onClick={() => setOverrideRow(i)}>
                      ✏️ Override
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
