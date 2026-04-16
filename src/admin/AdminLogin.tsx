import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from './utils/adminApi';
import { useAdminAuth } from './utils/useAdminAuth';

export const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAdminAuth();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        await adminApi.getSession();
        if (!cancelled) {
          navigate('/admin/dashboard', { replace: true });
        }
      } catch {
        // No valid cookie session yet; stay on the login screen.
      } finally {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(username, password);
    if (ok) navigate('/admin/dashboard', { replace: true });
  };

  return (
    <div className="adm-login-bg">
      <div className="adm-login-card">

        {/* Logo */}
        <div className="adm-login-logo">
          <h1>KARAHOCA</h1>
          <p>Admin Dashboard</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="adm-form-group">
            <label className="adm-label">Username</label>
            <input
              className="adm-input"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className="adm-form-group">
            <label className="adm-label">Password</label>
            <input
              className="adm-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="adm-alert adm-alert-error">
              ⚠ {error}
            </div>
          )}

          <button
            className="adm-btn adm-btn-primary"
            type="submit"
            disabled={isLoading || isCheckingSession}
            style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '12px 20px', fontSize: '14px' }}
          >
            {isCheckingSession
              ? <><span className="adm-spinner" style={{ width: 15, height: 15 }} /> Checking session…</>
              : isLoading
              ? <><span className="adm-spinner" style={{ width: 15, height: 15 }} /> Logging in…</>
              : '🔐  Sign In'
            }
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'var(--adm-text-dim)' }}>
          KARAHOCA © {new Date().getFullYear()} — Secure Area
        </p>
      </div>
    </div>
  );
};
