import React from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type AdminStats, type ChatUser } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const GA_LINK = GA_MEASUREMENT_ID && GA_MEASUREMENT_ID !== 'G-XXXXXXXXXX'
  ? `https://analytics.google.com/analytics/web/#/p${GA_MEASUREMENT_ID}/reports/overview`
  : 'https://analytics.google.com/';

const StatCard: React.FC<{ icon: string; label: string; value: number | string; sub?: string; to?: string }> = ({ icon, label, value, sub, to }) => {
  const inner = (
    <div className="adm-stat-card" style={{ cursor: to ? 'pointer' : 'default' }}>
      <div className="adm-stat-icon">{icon}</div>
      <div className="adm-stat-label">{label}</div>
      <div className="adm-stat-value">{value}</div>
      {sub && <div className="adm-stat-sub">{sub}</div>}
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
};

export const AdminDashboard: React.FC = () => {
  const { data, loading, error } = useAsync<AdminStats>(() => adminApi.getStats(), []);

  if (loading) return <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>;
  if (error) return <div className="adm-alert adm-alert-error">⚠ {error}</div>;

  const stats = data?.stats;
  const recent = data?.recentUsers || [];

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Dashboard</h1>
          <p className="adm-page-subtitle">Overview of your website activity</p>
        </div>
        <a href={GA_LINK} target="_blank" rel="noopener noreferrer" className="adm-btn adm-btn-secondary adm-btn-sm">
          📊 Open Google Analytics ↗
        </a>
      </div>

      <div className="adm-stat-grid">
        <StatCard icon="🧴" label="Active Products" value={stats?.products ?? 0} sub="DIOX + AYLUX" to="/admin/products" />
        <StatCard icon="📰" label="News Articles" value={stats?.news ?? 0} sub="Published" to="/admin/news" />
        <StatCard icon="✉️" label="Subscribers" value={stats?.subscribers ?? 0} sub="Newsletter" to="/admin/newsletter" />
        <StatCard icon="👥" label="Chat Users" value={stats?.chatUsers ?? 0} sub="Unique visitors" to="/admin/chats" />
        <StatCard icon="💬" label="Total Messages" value={stats?.chatMessages ?? 0} sub="All time" to="/admin/chats" />
        <StatCard icon="🔥" label="Messages (7d)" value={stats?.recentMessages ?? 0} sub="Last 7 days" to="/admin/analytics" />
      </div>

      {recent.length > 0 && (
        <div className="adm-card">
          <div className="adm-card-title">Recent Chat Users</div>
          <div className="adm-table-wrap" style={{ marginTop: 12 }}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Language</th>
                  <th>Messages</th>
                  <th>Last Active</th>
                  <th>Last Message</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((u: ChatUser) => (
                  <tr key={u.id}>
                    <td className="adm-mono adm-text-muted">{u.id.slice(0, 12)}…</td>
                    <td><span className="adm-badge adm-badge-blue">{u.language}</span></td>
                    <td>{u.message_count}</td>
                    <td className="adm-text-muted adm-text-sm">{new Date(u.last_seen).toLocaleDateString()}</td>
                    <td className="adm-truncate" style={{ maxWidth: 240 }}>{u.last_message || u.last_user_message || '—'}</td>
                    <td>
                      <Link to={`/admin/chats/${encodeURIComponent(u.id)}`} className="adm-btn adm-btn-ghost adm-btn-sm">View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
