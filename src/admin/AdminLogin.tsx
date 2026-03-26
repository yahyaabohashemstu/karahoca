import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from './utils/useAdminAuth';

export const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(username, password);
    if (ok) navigate('/admin/dashboard');
  };

  return (
    <div className="adm-login-bg">
      <div className="adm-login-card">
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
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="adm-alert adm-alert-error" style={{ marginBottom: 16 }}>
              ⚠ {error}
            </div>
          )}

          <button
            className="adm-btn adm-btn-primary"
            type="submit"
            disabled={isLoading}
            style={{ width: '100%' }}
          >
            {isLoading ? <><span className="adm-spinner" style={{ width: 14, height: 14 }} /> Logging in...</> : 'Login →'}
          </button>
        </form>
      </div>
    </div>
  );
};
