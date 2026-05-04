/**
 * NewTenderModal — modal that uploads a tender file, auto-runs criteria
 * extraction, and returns the new tender id to the parent.
 */
import { useState, useRef } from 'react';
import * as api from '../utils/api';

export default function NewTenderModal({ open, onClose, onCreated }) {
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | uploading | extracting | done | error
  const [error, setError] = useState('');
  const [extracted, setExtracted] = useState(null);
  const [created, setCreated] = useState(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setPhase('idle');
    setError('');
    setExtracted(null);
    setCreated(null);
  };

  const closeAll = () => {
    reset();
    onClose();
  };

  const handleSelect = (f) => {
    if (!f) return;
    setFile(f);
    setError('');
  };

  const submit = async () => {
    if (!file) return;
    setError('');
    try {
      setPhase('uploading');
      const up = await api.uploadTender(file);
      setCreated({ id: up.id, filename: up.filename });

      setPhase('extracting');
      const ex = await api.extractCriteria(up.id);
      setExtracted({
        count: ex.items_extracted,
        criteria: ex.data,
      });
      setPhase('done');
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to publish tender.');
      setPhase('error');
    }
  };

  const finish = () => {
    if (created && onCreated) onCreated(created);
    closeAll();
  };

  const sizeStr = (b) => {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  const counts = extracted
    ? extracted.criteria.reduce(
        (a, c) => {
          a[c.type] = (a[c.type] || 0) + 1;
          if (c.mandatory) a.mandatory++;
          return a;
        },
        { mandatory: 0 }
      )
    : null;

  return (
    <div className="modal-backdrop" onClick={closeAll}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">＋ New Tender</div>
            <h2>Publish a new tender</h2>
            <p>Upload the NIT/tender PDF — AI will extract eligibility criteria
              and publish it to the Bidder Portal.</p>
          </div>
          <button className="modal-close" onClick={closeAll} aria-label="Close">✕</button>
        </div>

        {error && (
          <div className="error-banner" style={{ marginBottom: 16 }}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')} className="error-close">✕</button>
          </div>
        )}

        {/* ── Step 1: pick file ── */}
        {phase === 'idle' && (
          <>
            <div
              className={`upload-zone ${drag ? 'dragover' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); handleSelect(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current?.click()}
            >
              <div className="upload-zone-icon">📄</div>
              <p className="upload-zone-text">
                <strong>Click to upload</strong> or drag and drop<br />
                PDF, Images (PNG/JPG), or DOCX
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              className="file-input-hidden"
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp,.docx"
              onChange={(e) => handleSelect(e.target.files[0])}
            />

            {file && (
              <div className="selected-file fade-in" style={{ marginTop: 16 }}>
                <div className="selected-file-info">
                  <span className="selected-file-icon">📎</span>
                  <div>
                    <div className="selected-file-name">{file.name}</div>
                    <div className="selected-file-size">{sizeStr(file.size)}</div>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={submit}>
                  Publish & Extract →
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Step 2: progress ── */}
        {(phase === 'uploading' || phase === 'extracting') && (
          <div className="modal-progress fade-in">
            <div className="progress-row">
              <div className={`progress-step ${phase === 'uploading' ? 'active' : 'done'}`}>
                <div className="progress-dot">{phase === 'uploading' ? <span className="spinner-sm" /> : '✓'}</div>
                <div>
                  <div className="progress-step-title">Securely uploading</div>
                  <div className="progress-step-sub">{file?.name}</div>
                </div>
              </div>
            </div>
            <div className="progress-row">
              <div className={`progress-step ${phase === 'extracting' ? 'active' : 'pending'}`}>
                <div className="progress-dot">
                  {phase === 'extracting' ? <span className="spinner-sm" /> : '·'}
                </div>
                <div>
                  <div className="progress-step-title">Extracting eligibility criteria</div>
                  <div className="progress-step-sub">Analyzing technical, financial, and compliance rules</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: success ── */}
        {phase === 'done' && extracted && (
          <div className="fade-in">
            <div className="success-block">
              <div className="success-icon">✓</div>
              <div>
                <div className="success-title">Tender published</div>
                <div className="success-sub">{created?.filename}</div>
              </div>
            </div>

            <div className="extract-summary">
              <div className="extract-summary-num">{extracted.count}</div>
              <div className="extract-summary-text">
                eligibility criteria extracted
                {counts ? <>, of which <strong>{counts.mandatory}</strong> are mandatory</> : null}
              </div>
            </div>

            {counts && (
              <div className="type-pills">
                {counts.financial   ? <span className="criterion-type type-financial">💰 Financial · {counts.financial}</span> : null}
                {counts.technical   ? <span className="criterion-type type-technical">⚙️ Technical · {counts.technical}</span> : null}
                {counts.compliance  ? <span className="criterion-type type-compliance">📋 Compliance · {counts.compliance}</span> : null}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeAll}>Back to dashboard</button>
              <button className="btn btn-primary" onClick={finish}>Open this tender →</button>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {phase === 'error' && (
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={reset}>Try again</button>
          </div>
        )}
      </div>

      <style>{`
        .modal-backdrop {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(5, 12, 25, 0.7);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          animation: fadeIn 200ms ease-out;
        }
        .modal-card {
          width: 100%; max-width: 540px;
          background: var(--bg-card);
          border: 1px solid var(--bg-glass-border);
          border-radius: 18px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          padding: 28px;
          backdrop-filter: blur(24px);
          animation: scaleIn 220ms ease-out;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-head {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 16px; margin-bottom: 20px;
        }
        .modal-head h2 {
          font-size: 1.3rem;
          font-weight: 800;
          margin-bottom: 4px;
          letter-spacing: -0.01em;
        }
        .modal-head p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .modal-eyebrow {
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--accent-primary);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .modal-close {
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--bg-glass-border);
          color: var(--text-muted);
          width: 32px; height: 32px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 0.95rem;
          flex-shrink: 0;
          transition: all 150ms;
        }
        .modal-close:hover {
          color: var(--text-heading);
          background: rgba(255,255,255,0.08);
        }

        .modal-progress {
          display: flex; flex-direction: column; gap: 14px;
          padding: 8px 0;
        }
        .progress-row { padding: 8px 0; }
        .progress-step {
          display: flex; align-items: center; gap: 14px;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid var(--bg-glass-border);
          background: rgba(255,255,255,0.02);
        }
        .progress-step.active {
          border-color: rgba(0, 229, 160, 0.3);
          background: rgba(0, 229, 160, 0.06);
        }
        .progress-step.done { opacity: 0.7; }
        .progress-step.pending { opacity: 0.4; }
        .progress-dot {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700;
          color: var(--accent-primary);
          flex-shrink: 0;
        }
        .progress-step.done .progress-dot {
          background: var(--gradient-accent);
          color: var(--bg-primary);
        }
        .progress-step-title {
          font-weight: 600;
          font-size: 0.92rem;
          color: var(--text-heading);
        }
        .progress-step-sub {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .spinner-sm {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: var(--accent-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }

        .success-block {
          display: flex; align-items: center; gap: 14px;
          padding: 18px;
          border-radius: 14px;
          background: rgba(0, 229, 160, 0.08);
          border: 1px solid rgba(0, 229, 160, 0.3);
          margin-bottom: 16px;
        }
        .success-block .success-icon {
          width: 40px; height: 40px;
          border-radius: 50%;
          background: var(--gradient-accent);
          color: var(--bg-primary);
          font-weight: 800;
          font-size: 1.2rem;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .success-title {
          font-weight: 700;
          color: var(--accent-primary);
        }
        .success-sub {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .extract-summary {
          display: flex; align-items: center; gap: 16px;
          padding: 18px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--bg-glass-border);
          border-radius: 14px;
          margin-bottom: 14px;
        }
        .extract-summary-num {
          font-size: 2.4rem;
          font-weight: 800;
          line-height: 1;
          background: var(--gradient-accent);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .extract-summary-text {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .type-pills {
          display: flex; flex-wrap: wrap; gap: 8px;
          margin-bottom: 20px;
        }
        .modal-actions {
          display: flex; justify-content: flex-end; gap: 8px;
          padding-top: 4px;
        }
      `}</style>
    </div>
  );
}
