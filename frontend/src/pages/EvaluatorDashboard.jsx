/**
 * EvaluatorDashboard — main admin SPA.
 *  - Overview view (tenders + KPIs)
 *  - TenderDetail view (per-tender deep dive, live polling)
 *  - NewTenderModal (upload + auto-extract)
 *  - AuditLog (slide-in panel)
 */
import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import '../App.css';
import Layout from '../components/Layout';
import AdminOverview from '../components/AdminOverview';
import TenderDetail from '../components/TenderDetail';
import NewTenderModal from '../components/NewTenderModal';
import AuditLog from '../components/AuditLog';
import { setAuthTokenGetter } from '../utils/api';

export default function EvaluatorDashboard({ theme, toggleTheme }) {
  const { getToken } = useAuth();
  const { user } = useUser();

  const [view, setView] = useState('overview'); // overview | tender | audit
  const [activeTender, setActiveTender] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setAuthTokenGetter(getToken);
  }, [getToken]);

  const openTender = (t) => {
    setActiveTender(t);
    setView('tender');
  };

  const handleNav = (target) => {
    if (target === 'audit') {
      setShowAudit(true);
      return;
    }
    if (target === 'tender' && !activeTender) return;
    setView(target);
  };

  const handleNewTender = () => setShowNew(true);

  const handleCreated = (created) => {
    setRefreshKey((k) => k + 1);
    if (created?.id) openTender(created);
  };

  const goBackToOverview = () => {
    setView('overview');
    setRefreshKey((k) => k + 1);
  };

  return (
    <>
      <Layout
        view={view}
        onNav={handleNav}
        activeTender={activeTender}
        onNewTender={handleNewTender}
        user={user}
        theme={theme}
        toggleTheme={toggleTheme}
      >
        {view === 'overview' && (
          <AdminOverview
            onOpenTender={openTender}
            onNewTender={handleNewTender}
            refreshKey={refreshKey}
          />
        )}

        {view === 'tender' && activeTender && (
          <TenderDetail
            tender={activeTender}
            onBack={goBackToOverview}
            onAuditOpen={() => setShowAudit(true)}
            onTitleChanged={(updated) => {
              setActiveTender((prev) => ({ ...prev, ...updated }));
              setRefreshKey((k) => k + 1);
            }}
          />
        )}
      </Layout>

      <NewTenderModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={handleCreated}
      />

      {showAudit && (
        <AuditLog
          tenderId={activeTender?.id}
          onClose={() => setShowAudit(false)}
        />
      )}
    </>
  );
}
