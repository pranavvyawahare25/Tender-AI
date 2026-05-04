/**
 * LoginPage — single, restricted Admin Login page (username + password).
 * Demo credentials are surfaced on-screen so judges can sign in instantly.
 */
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { isSignedIn, signIn, DEMO_CREDENTIALS } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState('');

  if (isSignedIn) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Enter both username and password.');
      return;
    }
    setLoading(true);
    // Tiny artificial delay so the spinner is visible (better demo feel)
    setTimeout(() => {
      const res = signIn(username, password);
      setLoading(false);
      if (!res.ok) setError(res.error || 'Sign-in failed.');
    }, 250);
  };

  const fillDemo = () => {
    setUsername(DEMO_CREDENTIALS.username);
    setPassword(DEMO_CREDENTIALS.password);
    setError('');
  };

  const copy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(''), 1200);
    } catch {
      // ignore — clipboard not available
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-bg"></div>

      <header className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
        <Link to="/" className="app-logo no-underline">
          <div className="app-logo-icon" style={{ width: 36, height: 36, fontSize: '1.1rem' }}>T</div>
          <div className="app-logo-text">
            <h1 className="text-lg">TenderAI</h1>
            <span>Admin Login</span>
          </div>
        </Link>
        <Link to="/bidder" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
          I'm a Bidder →
        </Link>
      </header>

      <div className="auth-content" style={{ maxWidth: 460, width: '100%' }}>
        <div className="auth-brand">
          <div className="app-logo-icon" style={{ width: 64, height: 64, fontSize: '1.8rem' }}>T</div>
          <div className="badge badge-pass" style={{ marginTop: 4, fontSize: '0.65rem' }}>
            🔒 Restricted Access
          </div>
          <h1 className="auth-title">Admin Login</h1>
          <p className="auth-subtitle">TenderAI Evaluation Platform</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 360, textAlign: 'center', lineHeight: 1.6 }}>
            This portal is locked to the procurement evaluator.
            Vendors should use the <Link to="/bidder">Bidder Portal</Link>, no login needed.
          </p>
        </div>

        <form className="auth-card glass-card login-card" onSubmit={handleSubmit}>
          <label className="login-label">
            Username
            <input
              type="text"
              autoFocus
              autoComplete="username"
              className="login-input"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </label>

          <label className="login-label">
            Password
            <div className="login-pwd-wrap">
              <input
                type={showPwd ? 'text' : 'password'}
                autoComplete="current-password"
                className="login-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="login-pwd-toggle"
                onClick={() => setShowPwd((s) => !s)}
                tabIndex={-1}
              >
                {showPwd ? '🙈' : '👁'}
              </button>
            </div>
          </label>

          {error && (
            <div className="login-error fade-in">⚠️ {error}</div>
          )}

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? <span className="spinner-sm" /> : '🔐 Sign in to Admin'}
          </button>

          <div className="login-divider"><span>Demo credentials</span></div>

          <div className="login-creds">
            <div className="cred-row">
              <span className="cred-label">Username</span>
              <code>{DEMO_CREDENTIALS.username}</code>
              <button
                type="button"
                className="cred-copy"
                onClick={() => copy('username', DEMO_CREDENTIALS.username)}
              >
                {copied === 'username' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div className="cred-row">
              <span className="cred-label">Password</span>
              <code>{DEMO_CREDENTIALS.password}</code>
              <button
                type="button"
                className="cred-copy"
                onClick={() => copy('password', DEMO_CREDENTIALS.password)}
              >
                {copied === 'password' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <button type="button" className="btn btn-secondary btn-sm cred-fill" onClick={fillDemo}>
              ⚡ Auto-fill demo credentials
            </button>
          </div>
        </form>

        <Link to="/" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
          ← Back to Home
        </Link>
      </div>

      <style>{`
        .login-card {
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .login-label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .login-input {
          padding: 12px 14px;
          background: var(--bg-glass);
          border: 1px solid var(--bg-glass-border);
          border-radius: 10px;
          color: var(--text-heading);
          font-family: var(--font-family);
          font-size: 0.95rem;
          font-weight: 500;
          outline: none;
          transition: border-color 150ms, box-shadow 150ms;
        }
        .login-input:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(0, 229, 160, 0.12);
        }
        .login-input::placeholder { color: var(--text-muted); }

        .login-pwd-wrap {
          position: relative;
        }
        .login-pwd-wrap .login-input { width: 100%; padding-right: 44px; }
        .login-pwd-toggle {
          position: absolute;
          right: 8px; top: 50%;
          transform: translateY(-50%);
          width: 32px; height: 32px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.95rem;
          border-radius: 6px;
          transition: background 150ms;
        }
        .login-pwd-toggle:hover { background: rgba(255,255,255,0.05); }

        .login-btn { padding: 12px 16px; font-size: 0.95rem; }

        .login-error {
          padding: 10px 12px;
          background: var(--status-fail-bg);
          border: 1px solid rgba(255, 77, 106, 0.3);
          border-radius: 8px;
          color: var(--status-fail);
          font-size: 0.82rem;
        }

        .login-divider {
          display: flex; align-items: center; gap: 10px;
          margin: 4px 0 0;
          color: var(--text-muted);
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .login-divider::before, .login-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--bg-glass-border);
        }

        .login-creds {
          display: flex; flex-direction: column; gap: 6px;
          padding: 12px;
          background: rgba(0, 229, 160, 0.04);
          border: 1px dashed rgba(0, 229, 160, 0.25);
          border-radius: 10px;
        }
        .cred-row {
          display: flex; align-items: center; gap: 10px;
          font-size: 0.78rem;
        }
        .cred-label {
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--text-muted);
          width: 70px;
        }
        .cred-row code {
          flex: 1;
          padding: 6px 10px;
          background: rgba(255,255,255,0.04);
          border-radius: 6px;
          font-family: monospace;
          color: var(--accent-primary);
          font-weight: 700;
        }
        .cred-copy {
          padding: 5px 10px;
          background: transparent;
          border: 1px solid var(--bg-glass-border);
          color: var(--text-secondary);
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 150ms;
        }
        .cred-copy:hover {
          color: var(--accent-primary);
          border-color: rgba(0, 229, 160, 0.3);
        }
        .cred-fill { margin-top: 4px; }

        .spinner-sm {
          width: 16px; height: 16px;
          border: 2px solid rgba(0,0,0,0.2);
          border-top-color: var(--bg-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}
