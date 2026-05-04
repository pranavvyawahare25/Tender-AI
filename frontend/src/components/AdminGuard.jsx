/**
 * AdminGuard — wraps a route so only the signed-in admin can access it.
 * Sign-out is wired through the local AuthContext.
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminGuard({ children }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="auth-container">
        <div className="auth-bg" />
        <div className="auth-content">
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
