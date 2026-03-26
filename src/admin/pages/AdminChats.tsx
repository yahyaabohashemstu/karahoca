import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type ChatUser } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';

export const AdminChats: React.FC = () => {
  const [page, setPage] = useState(1);
  const [lang, setLang] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(
    () => adminApi.getChats({ page, lang: lang || undefined }),
    [page, lang]
  );

  const handleDelete = async (userId: string) => {
    if (!confirm('Delete all messages from this user?')) return;
    setDeleting(userId);
    try {
      await adminApi.deleteChatUser(userId);
      reload();
    } catch {
      alert('Failed to delete user');
    } finally {
      setDeleting(null);
    }
  };

  const langs = ['', 'ar', 'en', 'tr', 'ru'];

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Chat History</h1>
          <p className="adm-page-subtitle">All users who interacted with the AI assistant</p>
        </div>
      </div>

      {/* Filters */}
      <div className="adm-card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="adm-text-muted" style={{ fontSize: 13 }}>Filter by language:</span>
        {langs.map(l => (
          <button
            key={l || 'all'}
            className={`adm-btn adm-btn-sm ${lang === l ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
            onClick={() => { setLang(l); setPage(1); }}
          >
            {l || 'All'}
          </button>
        ))}
        {data && (
          <span className="adm-text-muted adm-text-sm" style={{ marginLeft: 'auto' }}>
            Total: {data.total} users
          </span>
        )}
      </div>

      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>}
      {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

      {data && (
        <>
          <div className="adm-card" style={{ padding: 0 }}>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Language</th>
                    <th>Messages</th>
                    <th>First Seen</th>
                    <th>Last Active</th>
                    <th>Last Message</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>No users found.</td></tr>
                  ) : data.users.map((u: ChatUser) => (
                    <tr key={u.id}>
                      <td className="adm-mono adm-text-muted adm-truncate" style={{ maxWidth: 120 }}>
                        {u.id.slice(0, 14)}…
                      </td>
                      <td><span className="adm-badge adm-badge-blue">{u.language}</span></td>
                      <td><strong>{u.message_count}</strong></td>
                      <td className="adm-text-muted adm-text-sm">{new Date(u.first_seen).toLocaleDateString()}</td>
                      <td className="adm-text-muted adm-text-sm">{new Date(u.last_seen).toLocaleDateString()}</td>
                      <td className="adm-truncate adm-text-sm" style={{ maxWidth: 220 }}>
                        {u.last_user_message || u.last_message || '—'}
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <Link to={`/admin/chats/${encodeURIComponent(u.id)}`} className="adm-btn adm-btn-ghost adm-btn-sm">
                          View →
                        </Link>
                        <button
                          className="adm-btn adm-btn-danger adm-btn-sm"
                          onClick={() => handleDelete(u.id)}
                          disabled={deleting === u.id}
                        >
                          {deleting === u.id ? '…' : '🗑'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data.total > data.limit && (
            <div className="adm-pagination">
              <button
                className="adm-btn adm-btn-ghost adm-btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >← Prev</button>
              <span className="adm-text-muted adm-text-sm">
                Page {page} of {Math.ceil(data.total / data.limit)}
              </span>
              <button
                className="adm-btn adm-btn-ghost adm-btn-sm"
                disabled={page >= Math.ceil(data.total / data.limit)}
                onClick={() => setPage(p => p + 1)}
              >Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
