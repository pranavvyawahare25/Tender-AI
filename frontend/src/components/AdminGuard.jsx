/**
 * AdminGuard — wraps a route so only the fixed admin email can access it.
 *
 *  - Signed out  → redirect to /login
 *  - Signed in, wrong email → "Access denied" screen with sign-out button
 *  - Signed in, admin email  → render children
 *
 * The admin email is read from VITE_ADMIN_EMAIL in .env.
 */
import { Navigate, Link } from 'react-router-dom';
import {
  SignedIn,
  SignedOut,
  useUser,
  useClerk,
} from '@clerk/clerk-react';

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase().trim();

function AccessDenied({ email }) {
  const { signOut } = useClerk();

  return (
    <div className="auth-container">
      <div className="auth-bg"></div>
      <div className="auth-content" style={{ maxWidth: 520 }}>
        <div className="auth-brand">
          <div
            className="app-logo-icon"
            style={{
              width: 64,
              height: 64,
              fontSize: '1.8rem',
              background: 'linear-gradient(135deg, #ff4d6a 0%, #ffb74d 100%)',
            }}
          >
            ⛔
          </div>
          <h1 className="auth-title" style={{ background: 'linear-gradient(135deg,#ff4d6a 0%,#ffb74d 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Access Denied
          </h1>
          <p className="auth-subtitle">Restricted Admin Area</p>
        </div>

        <div className="auth-card glass-card" style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
          <p style={{ marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>
            The account <strong style={{ color: 'var(--text-heading)' }}>{email || 'you signed in with'}</strong> is
            not an authorized evaluator.
          </p>
          <p style={{ marginBottom: 'var(--space-lg)', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            The Admin Dashboard is locked to a single fixed evaluator account.<br />
            If you are a vendor, please use the public Bidder Portal to submit your documents.
          </p>

          <div className="flex gap-sm" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/bidder" className="btn btn-secondary">
              🏢 Go to Bidder Portal
            </Link>
            <button
              className="btn btn-danger"
              onClick={() => signOut({ redirectUrl: '/' })}
            >
              Sign Out
            </button>
          </div>
        </div>

        <Link
          to="/"
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            textDecoration: 'none',
          }}
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}

function AdminEmailCheck({ children }) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="auth-container">
        <div className="auth-bg"></div>
        <div className="auth-content">
          <div className="spinner" style={{ width: 32, height: 32 }}></div>
        </div>
      </div>
    );
  }

  const userEmail = (user?.primaryEmailAddress?.emailAddress || '').toLowerCase().trim();

  // No admin email configured → fail closed.
  if (!ADMIN_EMAIL) {
    return <AccessDenied email={userEmail} />;
  }

  if (userEmail !== ADMIN_EMAIL) {
    return <AccessDenied email={userEmail} />;
  }

  return children;
}

export default function AdminGuard({ children }) {
  return (
    <>
      <SignedIn>
        <AdminEmailCheck>{children}</AdminEmailCheck>
      </SignedIn>
      <SignedOut>
        <Navigate to="/login" replace />
      </SignedOut>
    </>
  );
}
