import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { adminApi, loginPathFor } from '../utils/adminApi';

type SessionState = 'checking' | 'authenticated' | 'unauthenticated';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionState, setSessionState] = useState<SessionState>('checking');
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        await adminApi.getSession();
        if (!cancelled) {
          setSessionState('authenticated');
        }
      } catch {
        if (!cancelled) {
          setSessionState('unauthenticated');
        }
      }
    };

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  if (sessionState === 'checking') {
    return <div className="adm-loading-center"><span className="adm-spinner" /> Checking session...</div>;
  }

  if (sessionState !== 'authenticated') {
    // Remember the page so signing in lands back on it, not the dashboard.
    return <Navigate to={loginPathFor(location.pathname + location.search)} replace />;
  }

  return <>{children}</>;
};

