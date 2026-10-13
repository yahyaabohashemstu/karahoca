import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AdminSidebar } from './components/AdminSidebar';
import { AdminErrorBoundary } from './components/AdminErrorBoundary';
import { adminApi, SESSION_EXPIRED_EVENT } from './utils/adminApi';
import { defineMessages, useT } from './i18n/core';
import { Alert, Button, IconButton } from './ui';

const messages = defineMessages({
  en: {
    openMenu: 'Open menu',
    brand: 'KARAHOCA admin',
    sessionExpired: 'Your session has expired. Nothing you typed is lost: sign in again in a new tab, then come back here and save.',
    signInNewTab: 'Sign in (new tab)',
    dismiss: 'Dismiss',
    logoutFailed: 'Logout failed — you are still signed in. Check your connection and try again.',
  },
  ar: {
    openMenu: 'فتح القائمة',
    brand: 'إدارة KARAHOCA',
    sessionExpired: 'انتهت الجلسة. لم يضِع شيء مما كتبته: سجّل الدخول من جديد في تبويب جديد، ثم ارجع إلى هنا واحفظ.',
    signInNewTab: 'تسجيل الدخول (تبويب جديد)',
    dismiss: 'إخفاء',
    logoutFailed: 'تعذّر تسجيل الخروج، وما زلت مسجّلًا. تحقّق من الاتصال وحاول مرة أخرى.',
  },
});

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const t = useT(messages);
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
        setLogoutError(t('logoutFailed'));
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
          <IconButton
            icon="menu"
            label={t('openMenu')}
            onClick={() => setSidebarOpen(true)}
            aria-expanded={sidebarOpen}
          />
          <span className="adm-mobile-brand">{t('brand')}</span>
        </div>

        <div className="adm-content">
          {sessionExpired && (
            <Alert
              tone="warning"
              action={(
                <div className="adm-session-actions">
                  <Button href="/admin" target="_blank" rel="noopener" variant="primary" size="sm" iconEnd="external">
                    {t('signInNewTab')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSessionExpired(false)}>{t('dismiss')}</Button>
                </div>
              )}
            >
              {t('sessionExpired')}
            </Alert>
          )}
          {logoutError && (
            <Alert tone="danger">{logoutError}</Alert>
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
