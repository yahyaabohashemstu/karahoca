import React from 'react';
import { Link } from 'react-router-dom';
import { type AdminStats, type ChatUser } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { adminApi } from '../utils/adminApi';
import { fmtDate } from '../utils/dateUtils';

const GA_PROPERTY_ID = import.meta.env.VITE_GA_PROPERTY_ID;
const GA_LINK = GA_PROPERTY_ID
  ? `https://analytics.google.com/analytics/web/#/p${GA_PROPERTY_ID}/reports/intelligenthome`
  : 'https://analytics.google.com/';

const StatCard: React.FC<{ icon: string; label: string; value: number | string; sub?: string; to?: string }> = ({ icon, label, value, sub, to }) => {
  const inner = (
    <div className="adm-stat-card adm-dashboard-stat-card" style={{ cursor: to ? 'pointer' : 'default' }}>
      <div className="adm-stat-icon">{icon}</div>
      <div className="adm-stat-label">{label}</div>
      <div className="adm-stat-value">{value}</div>
      {sub && <div className="adm-stat-sub">{sub}</div>}
    </div>
  );

  return to ? <Link to={to} className="adm-dashboard-stat-link">{inner}</Link> : inner;
};

export const AdminDashboard: React.FC = () => {
  const { data, loading, error } = useAsync<AdminStats>(() => adminApi.getStats(), []);

  if (loading) return <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>;
  if (error) return <div className="adm-alert adm-alert-error">⚠ {error}</div>;

  const stats = data?.stats;
  const recent = data?.recentUsers || [];
  const quickLinks = [
    { to: '/admin/products', icon: '🧴', title: 'Products', copy: 'Update catalog items and product pages.' },
    { to: '/admin/categories', icon: '🗂️', title: 'Categories', copy: 'Organize the catalog structure cleanly.' },
    { to: '/admin/news', icon: '📰', title: 'Newsroom', copy: 'Publish company news and updates.' },
    { to: '/admin/campaigns', icon: '📧', title: 'Campaigns', copy: 'Prepare newsletters and schedule mailings.' },
  ];
  const summaryRows = [
    { label: 'Catalog Items', value: (stats?.products ?? 0) + (stats?.news ?? 0), accent: 'var(--adm-info)' },
    { label: 'Audience Size', value: (stats?.subscribers ?? 0) + (stats?.chatUsers ?? 0), accent: 'var(--adm-success)' },
    { label: 'Conversation Load', value: stats?.chatMessages ?? 0, accent: 'var(--adm-accent)' },
  ];

  return (
    <div className="adm-dashboard-page">
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Dashboard</h1>
          <p className="adm-page-subtitle">Overview of your website activity</p>
        </div>
        <a href={GA_LINK} target="_blank" rel="noopener noreferrer" className="adm-btn adm-btn-secondary adm-btn-sm">
          📊 Open Google Analytics ↗
        </a>
      </div>

      <section className="adm-card adm-dashboard-hero">
        <div className="adm-dashboard-hero-copy">
          <span className="adm-dashboard-eyebrow">Admin Overview</span>
          <h2 className="adm-dashboard-hero-title">KARAHOCA control center</h2>
          <p className="adm-dashboard-hero-text">
            Follow the catalog, newsroom, campaigns, and visitor activity from one place with a clearer daily overview.
          </p>
          <div className="adm-dashboard-hero-actions">
            <Link to="/admin/products" className="adm-btn adm-btn-primary">Manage Products</Link>
            <Link to="/admin/analytics" className="adm-btn adm-btn-secondary">View Analytics</Link>
          </div>
        </div>
        <div className="adm-dashboard-hero-metrics">
          <div className="adm-dashboard-hero-metric">
            <span className="adm-dashboard-hero-metric-label">Products</span>
            <strong>{stats?.products ?? 0}</strong>
          </div>
          <div className="adm-dashboard-hero-metric">
            <span className="adm-dashboard-hero-metric-label">Subscribers</span>
            <strong>{stats?.subscribers ?? 0}</strong>
          </div>
          <div className="adm-dashboard-hero-metric">
            <span className="adm-dashboard-hero-metric-label">Chat Users</span>
            <strong>{stats?.chatUsers ?? 0}</strong>
          </div>
          <div className="adm-dashboard-hero-metric">
            <span className="adm-dashboard-hero-metric-label">Messages (7d)</span>
            <strong>{stats?.recentMessages ?? 0}</strong>
          </div>
        </div>
      </section>

      <div className="adm-stat-grid adm-dashboard-stat-grid">
        <StatCard icon="🧴" label="Active Products" value={stats?.products ?? 0} sub="DIOX + AYLUX" to="/admin/products" />
        <StatCard icon="📰" label="News Articles" value={stats?.news ?? 0} sub="Published" to="/admin/news" />
        <StatCard icon="✉️" label="Subscribers" value={stats?.subscribers ?? 0} sub="Newsletter" to="/admin/newsletter" />
        <StatCard icon="👥" label="Chat Users" value={stats?.chatUsers ?? 0} sub="Unique visitors" to="/admin/chats" />
        <StatCard icon="💬" label="Total Messages" value={stats?.chatMessages ?? 0} sub="All time" to="/admin/chats" />
        <StatCard icon="🔥" label="Messages (7d)" value={stats?.recentMessages ?? 0} sub="Last 7 days" to="/admin/analytics" />
      </div>

      <div className="adm-dashboard-main-grid">
        <div className="adm-card adm-dashboard-table-card">
          <div className="adm-dashboard-panel-head">
            <div>
              <div className="adm-card-title">Recent Chat Users</div>
              <p className="adm-dashboard-panel-copy">The latest active visitors and their most recent message snippets.</p>
            </div>
            <Link to="/admin/chats" className="adm-btn adm-btn-ghost adm-btn-sm">Open Chats →</Link>
          </div>

          {recent.length > 0 ? (
            <div className="adm-table-wrap" style={{ marginTop: 14 }}>
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
                      <td className="adm-text-muted adm-text-sm">{fmtDate(u.last_seen)}</td>
                      <td className="adm-truncate" style={{ maxWidth: 280 }}>{u.last_message || u.last_user_message || '—'}</td>
                      <td>
                        <Link to={`/admin/chats/${encodeURIComponent(u.id)}`} className="adm-btn adm-btn-ghost adm-btn-sm">View →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="adm-dashboard-empty-state">No recent chat activity yet.</div>
          )}
        </div>

        <div className="adm-dashboard-side-column">
          <div className="adm-card adm-dashboard-side-panel">
            <div className="adm-dashboard-panel-head compact">
              <div>
                <div className="adm-card-title">Quick Actions</div>
                <p className="adm-dashboard-panel-copy">Fast entry points to the most edited admin areas.</p>
              </div>
            </div>
            <div className="adm-dashboard-shortcuts">
              {quickLinks.map((item) => (
                <Link key={item.to} to={item.to} className="adm-dashboard-shortcut">
                  <span className="adm-dashboard-shortcut-icon">{item.icon}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.copy}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="adm-card adm-dashboard-side-panel">
            <div className="adm-dashboard-panel-head compact">
              <div>
                <div className="adm-card-title">Workspace Snapshot</div>
                <p className="adm-dashboard-panel-copy">A compact operational summary for the current admin workspace.</p>
              </div>
            </div>
            <div className="adm-dashboard-summary-list">
              {summaryRows.map((row) => (
                <div key={row.label} className="adm-dashboard-summary-item">
                  <div>
                    <span>{row.label}</span>
                  </div>
                  <strong style={{ color: row.accent }}>{row.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
