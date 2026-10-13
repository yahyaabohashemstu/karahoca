import React from 'react';
import { Link } from 'react-router-dom';
import { type AdminStats, type ChatUser } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { adminApi } from '../utils/adminApi';
import { fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { AdminIcon, type IconName } from '../components/AdminIcons';

const GA_PROPERTY_ID = import.meta.env.VITE_GA_PROPERTY_ID;
const GA_LINK = GA_PROPERTY_ID
  ? `https://analytics.google.com/analytics/web/#/p${GA_PROPERTY_ID}/reports/intelligenthome`
  : 'https://analytics.google.com/';

const StatCard: React.FC<{ icon: IconName; label: string; value: number; sub: string; to: string }> = ({ icon, label, value, sub, to }) => (
  <Link to={to} className="adm-dashboard-stat-link">
    <div className="adm-stat-card adm-dashboard-stat-card">
      <div className="adm-stat-icon"><AdminIcon name={icon} size={20} /></div>
      <div className="adm-stat-label">{label}</div>
      <div className="adm-stat-value">{fmtNumber(value)}</div>
      <div className="adm-stat-sub">{sub}</div>
    </div>
  </Link>
);

// One row of numbers. The page used to show the same four figures three
// times (hero tiles, stat cards, "workspace snapshot"), the snapshot adding
// unrelated counts together (products + news, subscribers + chat users).
export const AdminDashboard: React.FC = () => {
  const { data, loading, error } = useAsync<AdminStats>(() => adminApi.getStats(), []);

  if (loading) return <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>;
  if (error) return <div className="adm-alert adm-alert-error">⚠ {error}</div>;

  const stats = data?.stats;
  const recent = data?.recentUsers || [];
  const quickLinks: { to: string; icon: IconName; title: string; copy: string }[] = [
    { to: '/admin/products/new', icon: 'products', title: 'Add a product', copy: 'Create a catalogue item in all four languages.' },
    { to: '/admin/news/new', icon: 'news', title: 'Publish news', copy: 'Write a company announcement.' },
    { to: '/admin/blog/new', icon: 'blog', title: 'Write a blog post', copy: 'Draft an article for the blog.' },
    { to: '/admin/campaigns/new', icon: 'campaigns', title: 'New campaign', copy: 'E-mail the newsletter subscribers.' },
  ];

  return (
    <div className="adm-dashboard-page">
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Dashboard</h1>
          <p className="adm-page-subtitle">What is live on the site, and what visitors are doing</p>
        </div>
        <a href={GA_LINK} target="_blank" rel="noopener noreferrer" className="adm-btn adm-btn-secondary adm-btn-sm">
          Open Google Analytics ↗
        </a>
      </div>

      <div className="adm-stat-grid adm-dashboard-stat-grid">
        <StatCard icon="products" label="Live Products" value={stats?.products ?? 0} sub="Visible on the site" to="/admin/products" />
        <StatCard icon="news" label="News Articles" value={stats?.news ?? 0} sub="Published" to="/admin/news" />
        <StatCard icon="blog" label="Blog Posts" value={stats?.blogPosts ?? 0} sub="Published" to="/admin/blog" />
        <StatCard icon="newsletter" label="Subscribers" value={stats?.subscribers ?? 0} sub="Active newsletter" to="/admin/newsletter" />
        <StatCard icon="cohorts" label="Chat Visitors" value={stats?.chatUsers ?? 0} sub="Talked to the assistant" to="/admin/chats" />
        <StatCard
          icon="chats"
          label="Messages (7 days)"
          value={stats?.recentMessages ?? 0}
          sub={`${fmtNumber(stats?.chatMessages ?? 0)} all time`}
          to="/admin/karo-insights"
        />
      </div>

      <div className="adm-dashboard-main-grid">
        <div className="adm-card adm-dashboard-table-card">
          <div className="adm-dashboard-panel-head">
            <div>
              <div className="adm-card-title">Recent Chat Visitors</div>
              <p className="adm-dashboard-panel-copy">Latest visitors who used the assistant, with their last question.</p>
            </div>
            <Link to="/admin/chats" className="adm-btn adm-btn-ghost adm-btn-sm">All chats →</Link>
          </div>

          {recent.length > 0 ? (
            <div className="adm-table-wrap" style={{ marginTop: 14 }}>
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Visitor</th>
                    <th>Language</th>
                    <th>Messages</th>
                    <th>Last Active</th>
                    <th>Last Question</th>
                    <th><span className="adm-sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((u: ChatUser) => (
                    <tr key={u.id}>
                      <td className="adm-mono adm-text-muted" title={u.id}>{u.id.slice(0, 8)}…</td>
                      <td><span className="adm-badge adm-badge-blue">{u.language}</span></td>
                      <td>{fmtNumber(u.message_count)}</td>
                      <td className="adm-text-muted adm-text-sm">{fmtDateTime(u.last_seen)}</td>
                      <td className="adm-truncate adm-dashboard-question" dir="auto">{u.last_message || u.last_user_message || '—'}</td>
                      <td>
                        <Link to={`/admin/chats/${encodeURIComponent(u.id)}`} className="adm-btn adm-btn-ghost adm-btn-sm">View →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="adm-dashboard-empty-state">No chat activity yet.</div>
          )}
        </div>

        <div className="adm-dashboard-side-column">
          <div className="adm-card adm-dashboard-side-panel">
            <div className="adm-dashboard-panel-head compact">
              <div>
                <div className="adm-card-title">Quick Actions</div>
              </div>
            </div>
            <div className="adm-dashboard-shortcuts">
              {quickLinks.map((item) => (
                <Link key={item.to} to={item.to} className="adm-dashboard-shortcut">
                  <span className="adm-dashboard-shortcut-icon"><AdminIcon name={item.icon} /></span>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.copy}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
