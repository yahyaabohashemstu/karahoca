import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { adminApi } from '../utils/adminApi';

type SessionState = 'checking' | 'authenticated' | 'unauthenticated';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionState, setSessionState] = useState<SessionState>('checking');

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
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

