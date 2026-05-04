/**
 * AuthContext — local username/password auth for the Admin Dashboard.
 * Credentials are loaded from VITE_ADMIN_USERNAME / VITE_ADMIN_PASSWORD.
 * Session persisted in localStorage so the admin stays signed in across reloads.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'tenderai.admin.session';

const ADMIN_USERNAME = (import.meta.env.VITE_ADMIN_USERNAME || 'admin').trim();
const ADMIN_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD || 'crpf@2025').trim();

const AuthContext = createContext(null);

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(session) {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());

  // Sync to localStorage whenever the session changes
  useEffect(() => {
    saveSession(session);
  }, [session]);

  const value = useMemo(() => {
    const signIn = (username, password) => {
      const u = (username || '').trim();
      const p = (password || '').trim();
      if (u === ADMIN_USERNAME && p === ADMIN_PASSWORD) {
        const next = {
          username: u,
          fullName: 'Procurement Admin',
          email: 'admin@crpf.demo',
          signedInAt: new Date().toISOString(),
        };
        setSession(next);
        return { ok: true };
      }
      return { ok: false, error: 'Invalid username or password.' };
    };

    const signOut = () => setSession(null);

    return {
      isLoaded: true,
      isSignedIn: !!session,
      user: session,
      signIn,
      signOut,
      DEMO_CREDENTIALS: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    };
  }, [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
