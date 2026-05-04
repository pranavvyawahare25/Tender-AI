/**
 * Layout — Admin Dashboard shell.
 * Section-based sidebar nav + topbar.  No stepper.
 */
import { Link } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { tenderDisplayTitle } from '../utils/helpers';

const NAV = [
  { id: 'overview', label: 'Dashboard', icon: '📊' },
  { id: 'tender',   label: 'Active Tender', icon: '📋' },
  { id: 'audit',    label: 'Audit Log',     icon: '📜' },
];

export default function Layout({
  children,
  view,
  onNav,
  activeTender,
  onNewTender,
  user,
  theme,
  toggleTheme,
}) {
  return (
    <div className="app-layout">
      {/* ─── Sidebar ─────────────────────────────────────────────── */}
      <aside className="app-sidebar">
        <Link to="/" className="app-logo no-underline">
          <div className="app-logo-icon">T</div>
          <div className="app-logo-text">
            <h1>TenderAI</h1>
            <span>Admin Console</span>
          </div>
        </Link>

        <div className="admin-tag">🔒 Restricted Admin</div>

        {/* User chip */}
        <div className="sidebar-user">
          <UserButton
            afterSignOutUrl="/"
            appearance={{ elements: { avatarBox: { width: 36, height: 36 } } }}
          />
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">
              {user?.fullName || user?.firstName || 'Evaluator'}
            </span>
            <span className="sidebar-user-email">
              {user?.primaryEmailAddress?.emailAddress || ''}
            </span>
          </div>
        </div>

        {/* Primary action */}
        <button className="btn btn-primary w-full new-tender-btn" onClick={onNewTender}>
          ＋ New Tender
        </button>

        {/* Section nav */}
        <nav className="nav-list">
          {NAV.map((n) => {
            const disabled = n.id !== 'overview' && !activeTender;
            const active = view === n.id;
            return (
              <button
                key={n.id}
                className={`nav-item ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={() => !disabled && onNav(n.id)}
                disabled={disabled}
                title={disabled ? 'Open a tender first' : ''}
              >
                <span className="nav-icon">{n.icon}</span>
                <span className="nav-label">{n.label}</span>
                {n.id === 'tender' && activeTender && (
                  <span className="nav-pill">●</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active-tender preview */}
        {activeTender && (
          <div className="active-tender">
            <div className="active-tender-label">Now viewing</div>
            <div className="active-tender-name" title={tenderDisplayTitle(activeTender)}>
              {tenderDisplayTitle(activeTender)}
            </div>
            <div className="active-tender-id">{activeTender.id?.slice(0, 12)}…</div>
          </div>
        )}

        {/* Footer actions */}
        <div className="sidebar-actions">
          <Link
            to="/bidder"
            className="btn btn-secondary btn-sm w-full"
            style={{ textDecoration: 'none' }}
            target="_blank"
            rel="noreferrer"
          >
            🏢 Open Bidder Portal ↗
          </Link>
          <button className="btn btn-secondary btn-sm w-full" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>
      </aside>

      {/* ─── Main ───────────────────────────────────────────────── */}
      <main className="app-main">{children}</main>

      <style>{`
        .no-underline { text-decoration: none; color: inherit; }

        .admin-tag {
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--accent-secondary);
          background: rgba(61, 139, 253, 0.12);
          border: 1px solid rgba(61, 139, 253, 0.3);
          padding: 4px 10px;
          border-radius: 999px;
          align-self: flex-start;
          margin-bottom: var(--space-md);
        }

        .new-tender-btn { margin-bottom: var(--space-md); }

        .nav-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: var(--space-md);
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-secondary);
          font-family: var(--font-family);
          font-size: 0.86rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 150ms;
          text-align: left;
        }
        .nav-item:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-heading);
        }
        .nav-item.active {
          background: var(--accent-glow);
          border-color: rgba(0, 229, 160, 0.25);
          color: var(--text-heading);
        }
        .nav-item.disabled,
        .nav-item:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .nav-icon {
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          font-size: 0.95rem;
          flex-shrink: 0;
        }
        .nav-item.active .nav-icon {
          background: var(--gradient-accent);
          color: var(--bg-primary);
        }
        .nav-label { flex: 1; }
        .nav-pill {
          color: var(--accent-primary);
          font-size: 0.6rem;
          line-height: 1;
          animation: livePulse 1.6s ease-in-out infinite;
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }

        .active-tender {
          padding: 10px 12px;
          background: rgba(0, 229, 160, 0.06);
          border: 1px solid rgba(0, 229, 160, 0.2);
          border-radius: 10px;
          margin-bottom: var(--space-md);
        }
        .active-tender-label {
          font-size: 0.62rem;
          font-weight: 700;
          color: var(--accent-primary);
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 3px;
        }
        .active-tender-name {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-heading);
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .active-tender-id {
          font-size: 0.65rem;
          color: var(--text-muted);
          font-family: monospace;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}
