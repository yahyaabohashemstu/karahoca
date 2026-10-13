import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AdminSidebar } from './components/AdminSidebar';
import { AdminErrorBoundary } from './components/AdminErrorBoundary';
import { adminApi, SESSION_EXPIRED_EVENT } from './utils/adminApi';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  // The mobile drawer only closed from the overlay: after tapping a link the
  // new page loaded underneath it, still covered.
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  useEffect(() => {
    const onExpired = () => setSessionExpired(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const handleLogout = () => {
    setLogoutError('');
    void (async () => {
      try {
        await adminApi.logout();
        navigate('/admin', { replace: true });
      } catch {
        // Navigating anyway sent the admin to the login page, whose session
        // check found the still-valid cookie and opened the dashboard again —
        // on a shared computer they'd believe they had logged out.
        setLogoutError('Logout failed — you are still signed in. Check your connection and try again.');
      }
    })();
  };

  return (
    <div className="adm-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="adm-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`adm-sidebar-wrap ${sidebarOpen ? 'open' : ''}`}>
        <AdminSidebar onLogout={handleLogout} />
      </div>

      {/* Main */}
      <div className="adm-main">
        {/* Mobile header */}
        <div className="adm-mobile-header">
          <button
            className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
          >
            ☰
          </button>
          <span style={{ fontWeight: 700, fontSize: 15 }}>KARAHOCA Admin</span>
        </div>

        <div className="adm-content">
          {sessionExpired && (
            <div className="adm-alert adm-alert-error adm-session-banner" role="alert">
              <span>
                Your session has expired. Nothing you typed is lost: sign in again in a new tab, then come back here and save.
              </span>
              <a href="/admin" target="_blank" rel="noopener" className="adm-btn adm-btn-sm adm-btn-primary">
                Sign in (new tab)
              </a>
              <button type="button" className="adm-btn adm-btn-sm adm-btn-ghost" onClick={() => setSessionExpired(false)}>
                Dismiss
              </button>
            </div>
          )}
          {logoutError && (
            <div className="adm-alert adm-alert-error" role="alert">{logoutError}</div>
          )}
          {/* Keyed by page so an error on one page doesn't stick to the next. */}
          <AdminErrorBoundary key={pathname}>
            <Outlet />
          </AdminErrorBoundary>
        </div>
      </div>
    </div>
  );
};
