import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type ChatUser } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate } from '../utils/dateUtils';

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
                <colgroup>
                  <col style={{ width: '18%' }} />  {/* User ID */}
                  <col style={{ width: '8%'  }} />  {/* Language */}
                  <col style={{ width: '8%'  }} />  {/* Messages */}
                  <col style={{ width: '11%' }} />  {/* First Seen */}
                  <col style={{ width: '11%' }} />  {/* Last Active */}
                  <col style={{ width: '32%' }} />  {/* Last Message */}
                  <col style={{ width: '12%' }} />  {/* Actions */}
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left'   }}>User ID</th>
                    <th style={{ textAlign: 'center' }}>Language</th>
                    <th style={{ textAlign: 'center' }}>Messages</th>
                    <th style={{ textAlign: 'center' }}>First Seen</th>
                    <th style={{ textAlign: 'center' }}>Last Active</th>
                    <th style={{ textAlign: 'left'   }}>Last Message</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>No users found.</td></tr>
                  ) : data.users.map((u: ChatUser) => (
                    <tr key={u.id}>
                      <td style={{ textAlign: 'left' }}>
                        <span className="adm-mono adm-text-sm" style={{ color: 'var(--adm-text-muted)' }}>
                          {u.id.slice(0, 16)}…
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="adm-badge adm-badge-blue">{u.language}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <strong>{u.message_count}</strong>
                      </td>
                      <td style={{ textAlign: 'center' }} className="adm-text-muted adm-text-sm">
                        {fmtDate(u.first_seen)}
                      </td>
                      <td style={{ textAlign: 'center' }} className="adm-text-muted adm-text-sm">
                        {fmtDate(u.last_seen)}
                      </td>
                      <td style={{ textAlign: 'left', maxWidth: 0 }} className="adm-text-sm">
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.last_user_message || u.last_message || '—'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'center' }}>
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
                        </div>
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
