/**
 * LandingPage — public marketing/entry page.
 *
 *  - "Bidder Portal"  → public, no login
 *  - "Admin Login"    → fixed admin login page (only one account allowed)
 */
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';

const features = [
  { icon: '📄', title: 'Auto-extract criteria', text: 'Parse NIT/tender PDFs and lift mandatory + optional eligibility rules.' },
  { icon: '🧾', title: 'Multi-format ingestion', text: 'Typed PDFs, scanned copies, photos, DOCX — all handled.' },
  { icon: '⚖️', title: 'Explainable verdicts', text: 'Every Pass / Fail / Review references the exact criterion and document.' },
  { icon: '🔐', title: 'Audit-grade trail', text: 'Immutable log of every automated decision and human override.' },
];

const flow = [
  { n: '01', title: 'Upload tender', text: 'Admin drops the NIT PDF.' },
  { n: '02', title: 'AI extracts criteria', text: 'Technical, financial, compliance — separated.' },
  { n: '03', title: 'Bidders submit', text: 'Vendors apply via the public portal.' },
  { n: '04', title: 'Auto-evaluate', text: 'Eligible / Not Eligible / Manual Review.' },
  { n: '05', title: 'Sign-off report', text: 'Exportable, audit-ready, criterion-by-criterion.' },
];

export default function LandingPage() {
  return (
    <div className="landing-container">
      <div className="landing-bg"></div>

      {/* ── Header ─────────────────────────────── */}
      <header className="landing-header">
        <div className="app-logo">
          <div className="app-logo-icon" style={{ width: 40, height: 40, fontSize: '1.2rem' }}>T</div>
          <div className="app-logo-text">
            <h1 className="text-lg">TenderAI</h1>
            <span>Government Procurement</span>
          </div>
        </div>

        <div className="flex items-center gap-md">
          <Link to="/bidder" className="nav-link">Bidder Portal</Link>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Link to="/login" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
              🔒 Admin Login
            </Link>
          </SignedOut>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────── */}
      <main className="landing-main">
        <div className="hero stagger">
          <div className="hero-badge">
            🇮🇳 Built for CRPF · Theme 3 · AI Tender Evaluation
          </div>

          <h1 className="hero-title">
            Automated <span className="grad-text">eligibility analysis</span><br />
            for government procurement.
          </h1>

          <p className="hero-sub">
            Turn 200-page tender documents and heterogeneous bidder submissions
            into <strong>explainable</strong>, <strong>auditable</strong> Pass / Fail / Review
            verdicts — in minutes, not days.
          </p>

          <div className="hero-stats">
            <div><strong>10×</strong><span>faster review</span></div>
            <div><strong>100%</strong><span>auditable</span></div>
            <div><strong>0</strong><span>silent rejections</span></div>
          </div>
        </div>

        {/* ── Two role cards ─────────────────────── */}
        <div className="role-grid">
          {/* Bidder card — public */}
          <Link to="/bidder" className="role-card role-card-bidder no-underline">
            <div className="role-card-top">
              <div className="role-icon">🏢</div>
              <div className="role-tag tag-public">Public · No login</div>
            </div>
            <h2 className="role-title">Bidder Portal</h2>
            <p className="role-sub">For Vendors & Contractors</p>
            <p className="role-desc">
              Browse open government tenders, upload your eligibility documents
              (PDF, scans, photos, DOCX) and submit your bid in a few clicks.
            </p>
            <ul className="role-bullets">
              <li>View open tenders + eligibility checklist</li>
              <li>Upload typed PDFs, scans or phone photos</li>
              <li>Get instant submission confirmation</li>
            </ul>
            <div className="role-cta">Enter Bidder Portal →</div>
          </Link>

          {/* Admin card — locked */}
          <Link to="/login" className="role-card role-card-admin no-underline">
            <div className="role-card-top">
              <div className="role-icon">⚖️</div>
              <div className="role-tag tag-locked">🔒 Restricted · Admin only</div>
            </div>
            <h2 className="role-title">Admin Dashboard</h2>
            <p className="role-sub">For the Evaluation Committee</p>
            <p className="role-desc">
              Upload the NIT, let AI extract criteria, review every bidder
              criterion-by-criterion, override anything that needs human
              judgement, and export a sign-off-ready report.
            </p>
            <ul className="role-bullets">
              <li>AI-extracted, type-tagged criteria</li>
              <li>Per-bidder explainable verdicts</li>
              <li>Manual-review queue + audit log</li>
              <li>JSON / PDF report export</li>
            </ul>
            <div className="role-cta">Sign in as Admin →</div>
          </Link>
        </div>

        {/* ── How it works strip ─────────────────── */}
        <section className="flow-section">
          <div className="flow-head">
            <h2 className="flow-title">How TenderAI works</h2>
            <p className="flow-sub">Five steps from a 200-page NIT to a signed evaluation report.</p>
          </div>
          <div className="flow-grid">
            {flow.map((step, i) => (
              <div key={step.n} className="flow-step">
                <div className="flow-num">{step.n}</div>
                <div className="flow-step-title">{step.title}</div>
                <div className="flow-step-text">{step.text}</div>
                {i < flow.length - 1 && <div className="flow-arrow">→</div>}
              </div>
            ))}
          </div>
        </section>

        {/* ── Features grid ──────────────────────── */}
        <section className="features-section">
          {features.map((f) => (
            <div key={f.title} className="feature-card glass-card">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-text">{f.text}</div>
            </div>
          ))}
        </section>

        <footer className="landing-footer">
          <span>TenderAI · Hackathon Prototype</span>
          <span>·</span>
          <span>AI-Based Tender Evaluation & Eligibility Analysis</span>
          <span>·</span>
          <Link to="/login">Admin</Link>
        </footer>
      </main>

      <style>{`
        .landing-container {
          position: relative;
          min-height: 100vh;
          overflow-x: hidden;
        }
        .landing-bg {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(ellipse at 20% 0%, rgba(0, 229, 160, 0.18), transparent 55%),
            radial-gradient(ellipse at 100% 30%, rgba(61, 139, 253, 0.16), transparent 50%),
            radial-gradient(ellipse at 50% 100%, rgba(156, 39, 176, 0.10), transparent 55%);
        }

        .landing-header {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 48px;
          backdrop-filter: blur(8px);
        }
        .nav-link {
          color: var(--text-secondary);
          font-size: 0.875rem;
          text-decoration: none;
          font-weight: 500;
          transition: color 150ms;
        }
        .nav-link:hover { color: var(--accent-primary); }

        .landing-main {
          position: relative;
          z-index: 1;
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 32px 48px;
        }

        /* Hero */
        .hero {
          text-align: center;
          padding: 56px 16px 24px;
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
          letter-spacing: 0.4px;
          margin-bottom: 24px;
        }
        .hero-title {
          font-size: clamp(2rem, 5vw, 3.4rem);
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin-bottom: 20px;
        }
        .grad-text {
          background: var(--gradient-accent);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-sub {
          max-width: 720px;
          margin: 0 auto;
          color: var(--text-secondary);
          font-size: 1.05rem;
          line-height: 1.7;
        }
        .hero-stats {
          display: flex;
          justify-content: center;
          gap: 40px;
          margin-top: 28px;
          flex-wrap: wrap;
        }
        .hero-stats > div {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        .hero-stats strong {
          font-size: 1.6rem;
          font-weight: 800;
          background: var(--gradient-accent);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-stats span {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-muted);
        }

        /* Role grid */
        .role-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-top: 56px;
        }
        @media (max-width: 860px) {
          .role-grid { grid-template-columns: 1fr; }
        }

        .role-card {
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 32px;
          border-radius: 20px;
          background: var(--bg-card);
          backdrop-filter: blur(20px);
          border: 1px solid var(--bg-glass-border);
          color: inherit;
          transition: transform 250ms, border-color 250ms, box-shadow 250ms;
          overflow: hidden;
        }
        .role-card::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 250ms;
          pointer-events: none;
        }
        .role-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
        }
        .role-card:hover::before { opacity: 1; }

        .role-card-bidder::before {
          background: radial-gradient(ellipse at top right, rgba(0, 229, 160, 0.18), transparent 60%);
        }
        .role-card-bidder:hover { border-color: rgba(0, 229, 160, 0.35); }

        .role-card-admin::before {
          background: radial-gradient(ellipse at top right, rgba(61, 139, 253, 0.18), transparent 60%);
        }
        .role-card-admin:hover { border-color: rgba(61, 139, 253, 0.4); }

        .role-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .role-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.7rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .role-tag {
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          padding: 5px 10px;
          border-radius: 999px;
        }
        .tag-public {
          color: var(--status-pass);
          background: var(--status-pass-bg);
          border: 1px solid rgba(0, 229, 160, 0.3);
        }
        .tag-locked {
          color: var(--accent-secondary);
          background: rgba(61, 139, 253, 0.12);
          border: 1px solid rgba(61, 139, 253, 0.3);
        }
        .role-title {
          font-size: 1.5rem;
          font-weight: 800;
          margin-bottom: 4px;
        }
        .role-sub {
          font-size: 0.85rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 16px;
        }
        .role-desc {
          font-size: 0.92rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 16px;
        }
        .role-bullets {
          list-style: none;
          padding: 0;
          margin: 0 0 24px 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .role-bullets li {
          font-size: 0.85rem;
          color: var(--text-secondary);
          padding-left: 22px;
          position: relative;
          line-height: 1.5;
        }
        .role-bullets li::before {
          content: '✓';
          position: absolute;
          left: 0;
          color: var(--accent-primary);
          font-weight: 700;
        }
        .role-cta {
          margin-top: auto;
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--accent-primary);
          padding-top: 12px;
          border-top: 1px solid var(--bg-glass-border);
        }

        /* Flow */
        .flow-section {
          margin-top: 80px;
          padding: 32px 24px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--bg-glass-border);
        }
        .flow-head {
          text-align: center;
          margin-bottom: 28px;
        }
        .flow-title {
          font-size: 1.5rem;
          font-weight: 800;
          margin-bottom: 4px;
        }
        .flow-sub {
          color: var(--text-muted);
          font-size: 0.9rem;
        }
        .flow-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }
        @media (max-width: 1000px) {
          .flow-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .flow-grid { grid-template-columns: 1fr; }
        }
        .flow-step {
          position: relative;
          padding: 18px 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--bg-glass-border);
        }
        .flow-num {
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 1.5px;
          color: var(--accent-primary);
          margin-bottom: 6px;
        }
        .flow-step-title {
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--text-heading);
          margin-bottom: 4px;
        }
        .flow-step-text {
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .flow-arrow {
          display: none;
          position: absolute;
          right: -14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          font-weight: 700;
          z-index: 1;
        }
        @media (min-width: 1001px) {
          .flow-arrow { display: block; }
        }

        /* Features */
        .features-section {
          margin-top: 56px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 900px) { .features-section { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .features-section { grid-template-columns: 1fr; } }
        .feature-card { padding: 18px; }
        .feature-icon { font-size: 1.6rem; margin-bottom: 10px; }
        .feature-title {
          font-size: 0.95rem;
          font-weight: 700;
          margin-bottom: 4px;
          color: var(--text-heading);
        }
        .feature-text {
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.55;
        }

        .landing-footer {
          margin-top: 64px;
          padding: 24px 0 8px;
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
          font-size: 0.78rem;
          color: var(--text-muted);
          border-top: 1px solid var(--bg-glass-border);
        }
        .landing-footer a {
          color: var(--text-muted);
          text-decoration: none;
        }
        .landing-footer a:hover { color: var(--accent-primary); }

        .no-underline { text-decoration: none; }
      `}</style>
    </div>
  );
}
