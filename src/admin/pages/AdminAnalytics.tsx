import React from 'react';
import { adminApi, type AdminAnalytics } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const GA_LINK = GA_MEASUREMENT_ID && GA_MEASUREMENT_ID !== 'G-XXXXXXXXXX'
  ? `https://analytics.google.com/analytics/web/#/p${GA_MEASUREMENT_ID}/reports/overview`
  : 'https://analytics.google.com/';

const MiniBar: React.FC<{ items: Array<{ date: string; count: number }>; color?: string }> = ({ items, color = 'var(--adm-accent)' }) => {
  if (!items.length) return <p className="adm-text-muted adm-text-sm">No data yet.</p>;
  const max = Math.max(...items.map(i => i.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="adm-chart-bars">
        {items.map(item => (
          <div
            key={item.date}
            className="adm-chart-bar"
            style={{ height: `${(item.count / max) * 100}%`, background: color }}
            data-value={`${item.count} (${item.date})`}
            title={`${item.date}: ${item.count}`}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--adm-text-dim)' }}>
        <span>{items[0]?.date}</span>
        <span>{items[items.length - 1]?.date}</span>
      </div>
    </div>
  );
};

export const AdminAnalytics: React.FC = () => {
  const { data, loading, error } = useAsync<AdminAnalytics>(() => adminApi.getAnalytics(), []);

  if (loading) return <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>;
  if (error) return <div className="adm-alert adm-alert-error">⚠ {error}</div>;

  const s = data?.summary;

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Analytics</h1>
          <p className="adm-page-subtitle">Internal statistics — last 30 days</p>
        </div>
        <a href={GA_LINK} target="_blank" rel="noopener noreferrer" className="adm-btn adm-btn-primary adm-btn-sm">
          📊 Full Analytics in Google ↗
        </a>
      </div>

      {/* Summary cards */}
      <div className="adm-stat-grid" style={{ marginBottom: 24 }}>
        {[
          { icon: '💬', label: 'Total Messages', value: s?.total_messages ?? 0 },
          { icon: '👥', label: 'Total Chat Users', value: s?.total_users ?? 0 },
          { icon: '✉️', label: 'Newsletter Subscribers', value: s?.total_subscribers ?? 0 },
          { icon: '📰', label: 'News Articles', value: s?.total_news ?? 0 },
          { icon: '🧴', label: 'Products', value: s?.total_products ?? 0 },
        ].map(item => (
          <div key={item.label} className="adm-stat-card">
            <div className="adm-stat-icon">{item.icon}</div>
            <div className="adm-stat-label">{item.label}</div>
            <div className="adm-stat-value">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="adm-grid-2">
        {/* Chat messages per day */}
        <div className="adm-card">
          <div className="adm-card-title">💬 Chat Messages / Day</div>
          <div style={{ marginTop: 12 }}>
            <MiniBar items={data?.chatPerDay ?? []} />
          </div>
        </div>

        {/* Newsletter signups per day */}
        <div className="adm-card">
          <div className="adm-card-title">✉️ Newsletter Signups / Day</div>
          <div style={{ marginTop: 12 }}>
            <MiniBar items={data?.newsletterPerDay ?? []} color="var(--adm-success)" />
          </div>
        </div>
      </div>

      <div className="adm-grid-2" style={{ marginTop: 16 }}>
        {/* Language distribution */}
        <div className="adm-card">
          <div className="adm-card-title">🌍 Chat Language Distribution</div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data?.langDistribution ?? []).length === 0
              ? <p className="adm-text-muted adm-text-sm">No data yet.</p>
              : data?.langDistribution.map(d => {
                  const total = (data?.langDistribution ?? []).reduce((sum, i) => sum + i.count, 0);
                  const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
                  return (
                    <div key={d.language}>
                      <div className="adm-flex-between" style={{ marginBottom: 4 }}>
                        <span className="adm-badge adm-badge-blue">{d.language}</span>
                        <span className="adm-text-sm adm-text-muted">{d.count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--adm-surface2)', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--adm-accent)', borderRadius: 3, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Top active users */}
        <div className="adm-card">
          <div className="adm-card-title">🔥 Most Active Users</div>
          <div style={{ marginTop: 12 }}>
            {(data?.topUsers ?? []).length === 0
              ? <p className="adm-text-muted adm-text-sm">No users yet.</p>
              : (
                <table className="adm-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr><th>User ID</th><th>Lang</th><th>Messages</th><th>Last Seen</th></tr>
                  </thead>
                  <tbody>
                    {data?.topUsers.map(u => (
                      <tr key={u.id}>
                        <td className="adm-mono adm-truncate" style={{ maxWidth: 100 }}>{u.id.slice(0, 10)}…</td>
                        <td><span className="adm-badge adm-badge-blue">{u.language}</span></td>
                        <td>{u.message_count}</td>
                        <td>{new Date(u.last_seen).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};
