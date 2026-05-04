/**
 * CriteriaList — Display extracted eligibility criteria.
 */
import { getTypeIcon, getTypeLabel } from '../utils/helpers';

export default function CriteriaList({ criteria }) {
  if (!criteria || criteria.length === 0) return null;

  return (
    <div>
      <h2 className="section-title">🔍 Extracted Eligibility Criteria</h2>
      <p className="section-desc">
        Found <strong className="accent-text">{criteria.length}</strong> eligibility criteria from the tender document.
      </p>

      <div className="criteria-grid stagger">
        {criteria.map((c, i) => {
          const typeClass = `type-${c.type}`;
          return (
            <div key={i} className="glass-card criterion-card">
              <div className="criterion-header">
                <span className={`criterion-type ${typeClass}`}>
                  {getTypeIcon(c.type)} {getTypeLabel(c.type)}
                </span>
                {c.mandatory && (
                  <span className="badge badge-fail" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
                    MANDATORY
                  </span>
                )}
              </div>
              <div className="criterion-name">{c.criterion}</div>
              <div className="criterion-value">{c.value}</div>
              {c.raw_text && (
                <div className="criterion-raw">"{c.raw_text}"</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
