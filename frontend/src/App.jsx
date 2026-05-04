import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import EvaluatorDashboard from './pages/EvaluatorDashboard';
import BidderPortal from './pages/BidderPortal';
import AdminGuard from './components/AdminGuard';
import './App.css';

export default function App() {
  const [theme, setTheme] = useState('dark');

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public landing */}
          <Route path="/" element={<LandingPage />} />

          {/* Public bidder portal — no login required */}
          <Route path="/bidder" element={<BidderPortal />} />

          {/* Single, fixed-admin login page */}
          <Route path="/login" element={<LoginPage />} />

          {/* Admin Dashboard — protected by AdminGuard (fixed creds only) */}
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
    </AuthProvider>
  );
}
