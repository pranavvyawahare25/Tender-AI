/**
 * LoginPage — single, restricted login page for the Admin Dashboard.
 *
 * Only the email in VITE_ADMIN_EMAIL is allowed past this page.
 * If a non-admin user manages to sign in via Clerk, AdminGuard
 * intercepts them downstream and shows an "Access Denied" screen.
 */
import { Link, Navigate } from 'react-router-dom';
import { SignIn, SignedIn, SignedOut } from '@clerk/clerk-react';

// AdminGuard handles authorization, so we just route to /admin after sign-in.
// If the wrong account signed in, AdminGuard renders the Access Denied screen.
function PostSignInRouter() {
  return <Navigate to="/admin" replace />;
}

export default function LoginPage() {
  return (
    <>
      <SignedIn>
        <PostSignInRouter />
      </SignedIn>

      <SignedOut>
        <div className="auth-container">
          <div className="auth-bg"></div>

          <header className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
            <Link to="/" className="app-logo no-underline">
              <div
                className="app-logo-icon"
                style={{ width: 36, height: 36, fontSize: '1.1rem' }}
              >
                T
              </div>
              <div className="app-logo-text">
                <h1 className="text-lg">TenderAI</h1>
                <span>Admin Login</span>
              </div>
            </Link>
            <Link
              to="/bidder"
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: 'none' }}
            >
              I'm a Bidder →
            </Link>
          </header>

          <div className="auth-content" style={{ maxWidth: 460, width: '100%' }}>
            <div className="auth-brand">
              <div
                className="app-logo-icon"
                style={{ width: 64, height: 64, fontSize: '1.8rem' }}
              >
                T
              </div>
              <div
                className="badge badge-pass"
                style={{ marginTop: '4px', fontSize: '0.65rem' }}
              >
                🔒 Restricted Access
              </div>
              <h1 className="auth-title">Admin Login</h1>
              <p className="auth-subtitle">TenderAI Evaluation Platform</p>
              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  maxWidth: 360,
                  textAlign: 'center',
                  lineHeight: 1.6,
                }}
              >
                This portal is locked to a single authorised evaluator account.
                Vendors and contractors do not need to sign in — use the
                <Link to="/bidder" style={{ marginLeft: 4 }}>
                  Bidder Portal
                </Link>
                .
              </p>
            </div>

            <div className="auth-card">
              <SignIn
                routing="hash"
                signUpUrl="/login"
                fallbackRedirectUrl="/admin"
                forceRedirectUrl="/admin"
              />
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
      </SignedOut>
    </>
  );
}
