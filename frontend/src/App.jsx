import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import EvaluatorDashboard from './pages/EvaluatorDashboard';
import BidderPortal from './pages/BidderPortal';
import AdminGuard from './components/AdminGuard';
import './App.css';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

export default function App() {
  const [theme, setTheme] = useState('dark');

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Clerk theme configuration based on app theme
  const clerkAppearance = {
    baseTheme: theme === 'dark' ? dark : undefined,
    variables: {
      colorPrimary: '#00E5A0',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      borderRadius: '12px',
    },
    elements: {
      card: {
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)',
        borderRadius: '16px',
      },
      formButtonPrimary: {
        background: 'linear-gradient(135deg, #00E5A0 0%, #3D8BFD 100%)',
        border: 'none',
        textTransform: 'none',
        fontWeight: 600,
      },
      footerActionLink: { color: '#00E5A0' },
    },
  };

  return (
    <ClerkProvider publishableKey={CLERK_KEY} appearance={clerkAppearance}>
      <BrowserRouter>
        <Routes>
          {/* Public landing */}
          <Route path="/" element={<LandingPage />} />

          {/* Public bidder portal — no login required */}
          <Route path="/bidder" element={<BidderPortal />} />

          {/* Single, fixed-admin login page */}
          <Route path="/login" element={<LoginPage />} />

          {/* Admin Dashboard — protected by AdminGuard (fixed email only) */}
          <Route
            path="/admin/*"
            element={
              <AdminGuard>
                <EvaluatorDashboard theme={theme} toggleTheme={toggleTheme} />
              </AdminGuard>
            }
          />

          {/* Legacy redirect */}
          <Route path="/evaluator/*" element={<Navigate to="/admin" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  );
}
