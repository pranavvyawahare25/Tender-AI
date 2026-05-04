/**
 * BidderPortal — public, no-login portal for vendors / contractors.
 * Cleanly separated from the Admin Dashboard.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../utils/api';
import { tenderDisplayTitle, tenderNumber } from '../utils/helpers';
import BidderUpload from '../components/BidderUpload';

export default function BidderPortal() {
  const [tenders, setTenders] = useState([]);
  const [selectedTender, setSelectedTender] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTenders();
  }, []);

  const fetchTenders = async () => {
    try {
      setLoading(true);
      const res = await api.getTenders();
      setTenders(res.tenders || []);
    } catch (e) {
      setError('Failed to load open tenders. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files, bidderName) => {
    if (!selectedTender) return;
    setUploading(true);
    setError('');
    setSuccess(false);
    try {
      const uploadRes = await api.uploadBidderDocs(selectedTender.id, files, bidderName);
      await api.extractBidderData(selectedTender.id, uploadRes.id);
      setSuccess(true);
      setTimeout(() => {
        setSelectedTender(null);
        setSuccess(false);
      }, 3000);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to submit your documents.');
    } finally {
      setUploading(false);
    }
  };

  const niceName = (tender) => tenderDisplayTitle(tender);

  return (
    <div className="bidder-portal">
      <div className="bidder-bg" />

      {/* ── Header ─────────────────────────────── */}
      <header className="bp-header">
        <Link to="/" className="app-logo no-underline">
          <div className="app-logo-icon" style={{ width: 36, height: 36, fontSize: '1.05rem' }}>T</div>
          <div className="app-logo-text">
            <h1 className="text-lg">TenderAI</h1>
            <span>Bidder Portal</span>
          </div>
        </Link>

        <div className="flex items-center gap-md">
          <span className="badge badge-pass" style={{ fontSize: '0.65rem' }}>🔓 Public Access</span>
          <Link to="/" className="nav-link">← Home</Link>
          <Link to="/login" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            Admin Login
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────── */}
      <section className="bp-hero">
        <div className="hero-badge">🏢 For Vendors & Contractors</div>
        <h1 className="bp-title">
          Apply for <span className="grad-text">government tenders</span> in minutes.
        </h1>
        <p className="bp-sub">
          Browse open tenders, upload your eligibility documents (PDFs, scans,
          phone photos, DOCX) and submit your bid for AI-assisted evaluation.
          No account needed.
        </p>

        <div className="bp-steps">
          <div className="bp-step"><span>1</span> Pick a tender</div>
          <div className="bp-arrow">→</div>
          <div className="bp-step"><span>2</span> Upload your docs</div>
          <div className="bp-arrow">→</div>
          <div className="bp-step"><span>3</span> Get instant confirmation</div>
        </div>
      </section>

      {/* ── Body ───────────────────────────────── */}
      <main className="bp-main stagger">
        {error && (
          <div className="error-banner mb-lg">
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')} className="error-close">✕</button>
          </div>
        )}

        {success && (
          <div className="success-card fade-in">
            <div className="success-icon">✓</div>
            <h3>Submission Successful</h3>
            <p>
              Your documents have been encrypted and queued for evaluation.
              You'll be notified when results are published.
            </p>
          </div>
        )}

        {!selectedTender && (
          <div className="bp-section-head">
            <div>
              <h2 className="bp-section-title">Open Tenders</h2>
              <p className="bp-section-sub">
                {loading ? 'Loading…' : `${tenders.length} tender${tenders.length === 1 ? '' : 's'} accepting submissions`}
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchTenders} disabled={loading}>
              🔄 Refresh
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center" style={{ padding: '64px 0' }}>
            <div className="spinner mx-auto" style={{ width: 32, height: 32, marginBottom: 12 }}></div>
            <p className="text-muted">Loading open tenders…</p>
          </div>
        ) : !selectedTender ? (
          <div className="tender-grid">
            {tenders.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📭</div>
                <h3>No open tenders right now</h3>
                <p>Check back soon — new tenders are published by the procurement office.</p>
              </div>
            ) : (
              tenders.map((tender) => (
                <div key={tender.id} className="tender-card glass-card">
                  <div className="tender-card-top">
                    <div className="tender-icon">📋</div>
                    <span className="badge badge-pass" style={{ fontSize: '0.65rem' }}>Open</span>
                  </div>
                  <h3 className="tender-name">{niceName(tender)}</h3>
                  <div className="tender-id">
                    {tenderNumber(tender) ? <>📋 {tenderNumber(tender)}</> : <>ID · {tender.id.slice(0, 8)}…</>}
                  </div>

                  <div className="tender-meta">
                    <div><span>📂</span> Multi-format docs</div>
                    <div><span>⚡</span> AI evaluation</div>
                    <div><span>🔒</span> Encrypted upload</div>
                  </div>

                  <button
                    className="btn btn-primary w-full"
                    onClick={() => setSelectedTender(tender)}
                  >
                    Apply Now →
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="glass-card fade-in" style={{ padding: 'var(--space-xl)' }}>
            <div className="apply-head">
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Applying for</div>
                <h3 className="text-xl font-bold mt-md">{niceName(selectedTender)}</h3>
                <div className="text-xs text-muted mt-md">Tender ID · <span style={{ fontFamily: 'monospace' }}>{selectedTender.id}</span></div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedTender(null)}
                disabled={uploading}
              >
                ← Back
              </button>
            </div>

            <div className="apply-tips">
              <div className="apply-tip"><strong>📑 Documents to upload</strong> Company profile, audited financials, similar-project experience letters, GST / tax registration, ISO / quality certifications.</div>
              <div className="apply-tip"><strong>🖼 Any format</strong> Typed PDFs, scanned PDFs, phone photos (JPG/PNG) and DOCX files all work — our OCR handles them.</div>
              <div className="apply-tip"><strong>🔒 Privacy</strong> Your submission is encrypted and only visible to the authorised evaluator.</div>
            </div>

            {uploading ? (
              <div className="text-center" style={{ padding: '32px 0' }}>
                <div className="spinner mx-auto" style={{ width: 40, height: 40, marginBottom: 12 }}></div>
                <p className="text-muted">Uploading and securely encrypting documents…</p>
              </div>
            ) : (
              <BidderUpload onUpload={handleUpload} bidders={{}} />
            )}
          </div>
        )}
      </main>

      <footer className="bp-footer">
        <span>TenderAI · Bidder Portal</span>
        <span>·</span>
        <span>Government procurement made transparent</span>
      </footer>

      <style>{`
        .bidder-portal {
          position: relative;
          min-height: 100vh;
          padding-bottom: 32px;
        }
        .bidder-bg {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(ellipse at 0% 0%, rgba(0, 229, 160, 0.14), transparent 55%),
            radial-gradient(ellipse at 100% 0%, rgba(61, 139, 253, 0.10), transparent 55%);
        }
        .bp-header, .bp-hero, .bp-main, .bp-footer {
          position: relative;
          z-index: 1;
        }

        /* Header */
        .bp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 32px;
          border-bottom: 1px solid var(--bg-glass-border);
          backdrop-filter: blur(8px);
          background: rgba(10, 22, 40, 0.4);
          position: sticky;
          top: 0;
          z-index: 30;
        }
        .nav-link {
          color: var(--text-secondary);
          font-size: 0.85rem;
          text-decoration: none;
          font-weight: 500;
        }
        .nav-link:hover { color: var(--accent-primary); }

        /* Hero */
        .bp-hero {
          max-width: 880px;
          margin: 0 auto;
          padding: 56px 32px 24px;
          text-align: center;
        }
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          border-radius: 999px;
          background: rgba(0, 229, 160, 0.08);
          border: 1px solid rgba(0, 229, 160, 0.25);
          color: var(--accent-primary);
          font-size: 0.78rem;
          font-weight: 600;
          margin-bottom: 20px;
        }
        .bp-title {
          font-size: clamp(1.8rem, 4vw, 2.8rem);
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.01em;
          margin-bottom: 14px;
        }
        .grad-text {
          background: var(--gradient-accent);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .bp-sub {
          color: var(--text-secondary);
          max-width: 640px;
          margin: 0 auto;
          font-size: 0.98rem;
          line-height: 1.7;
        }
        .bp-steps {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-top: 28px;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--bg-glass-border);
          flex-wrap: wrap;
          justify-content: center;
        }
        .bp-step {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          color: var(--text-secondary);
          padding: 4px 10px;
          font-weight: 500;
        }
        .bp-step span {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--gradient-accent);
          color: var(--bg-primary);
          font-size: 0.7rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .bp-arrow { color: var(--text-muted); font-size: 0.85rem; }

        /* Body */
        .bp-main {
          max-width: 1080px;
          margin: 32px auto 0;
          padding: 0 32px;
        }

        .bp-section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 24px;
        }
        .bp-section-title {
          font-size: 1.4rem;
          font-weight: 800;
          letter-spacing: -0.01em;
        }
        .bp-section-sub {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        /* Tender grid */
        .tender-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 18px;
        }
        .tender-card {
          display: flex;
          flex-direction: column;
          padding: 20px;
          transition: transform 200ms, border-color 200ms, box-shadow 200ms;
        }
        .tender-card:hover {
          transform: translateY(-2px);
          border-color: rgba(0, 229, 160, 0.3);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
        }
        .tender-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .tender-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(0, 229, 160, 0.1);
          border: 1px solid rgba(0, 229, 160, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
        }
        .tender-name {
          font-size: 1rem;
          font-weight: 700;
          line-height: 1.35;
          margin-bottom: 4px;
          /* clamp to 2 lines */
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .tender-id {
          font-size: 0.7rem;
          color: var(--text-muted);
          font-family: monospace;
          margin-bottom: 14px;
        }
        .tender-meta {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
          border: 1px solid var(--bg-glass-border);
        }
        .tender-meta > div {
          font-size: 0.78rem;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .empty-state {
          grid-column: 1 / -1;
          padding: 56px 24px;
          text-align: center;
          border-radius: 16px;
          border: 1px dashed var(--bg-glass-border);
          background: rgba(255, 255, 255, 0.02);
        }
        .empty-state h3 { margin-bottom: 4px; }
        .empty-state p { color: var(--text-muted); font-size: 0.9rem; }

        /* Apply state */
        .apply-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 16px;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--bg-glass-border);
          gap: 16px;
        }
        .apply-tips {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          padding: 14px;
          background: rgba(0, 229, 160, 0.04);
          border: 1px solid rgba(0, 229, 160, 0.18);
          border-radius: 12px;
          margin-bottom: 20px;
        }
        @media (max-width: 720px) {
          .apply-tips { grid-template-columns: 1fr; }
        }
        .apply-tip {
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.55;
        }
        .apply-tip strong {
          display: block;
          color: var(--text-heading);
          font-size: 0.82rem;
          margin-bottom: 4px;
        }

        /* Success */
        .success-card {
          padding: 32px;
          text-align: center;
          border-radius: 16px;
          border: 1px solid rgba(0, 229, 160, 0.3);
          background: rgba(0, 229, 160, 0.06);
          margin-bottom: 24px;
        }
        .success-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--gradient-accent);
          color: var(--bg-primary);
          font-size: 1.8rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
        }
        .success-card h3 { color: var(--status-pass); margin-bottom: 6px; }
        .success-card p { color: var(--text-secondary); font-size: 0.9rem; }

        .bp-footer {
          margin-top: 56px;
          padding: 16px 0;
          text-align: center;
          font-size: 0.78rem;
          color: var(--text-muted);
          border-top: 1px solid var(--bg-glass-border);
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .no-underline { text-decoration: none; }
      `}</style>
    </div>
  );
}
