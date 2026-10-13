import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type ChatUser } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate, fmtDateTime, fmtNumber } from '../utils/dateUtils';

export const AdminChats: React.FC = () => {
  const [page, setPage] = useState(1);
  const [lang, setLang] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const { data, loading, error, reload } = useAsync(
    () => adminApi.getChats({ page, lang: lang || undefined }),
    [page, lang]
  );

  // Deleting the only row of the last page left "No users found." with the
  // pager gone (total now fits one page) and no way back.
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  useEffect(() => {
    if (data && page > lastPage) setPage(lastPage);
  }, [data, page, lastPage]);

  const handleDelete = async (user: ChatUser) => {
    if (!confirm(`Delete this visitor's conversation (${user.message_count} messages)? This cannot be undone.`)) return;
    setDeleting(user.id);
    setActionError('');
    try {
      await adminApi.deleteChatUser(user.id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete the conversation');
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
      {actionError && <div className="adm-alert adm-alert-error" role="alert">⚠ {actionError}</div>}

      {data && (
        <>
          <div className="adm-card" style={{ padding: 0 }}>
            <div className="adm-table-wrap">
              <table className="adm-table">
                {/* User ID, Language, Messages, First Seen, Last Active, Last
                    Message, Actions. No comments between the <col>s: the
                    whitespace around them is invalid inside <colgroup>. */}
                <colgroup>
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '32%' }} />
                  <col style={{ width: '12%' }} />
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
                        <span className="adm-mono adm-text-sm" style={{ color: 'var(--adm-text-muted)' }} title={u.id}>
                          {u.id.slice(0, 16)}…
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="adm-badge adm-badge-blue">{u.language}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <strong>{fmtNumber(u.message_count)}</strong>
                      </td>
                      <td style={{ textAlign: 'center' }} className="adm-text-muted adm-text-sm">
                        {fmtDate(u.first_seen)}
                      </td>
                      <td style={{ textAlign: 'center' }} className="adm-text-muted adm-text-sm">
                        {fmtDateTime(u.last_seen)}
                      </td>
                      <td style={{ textAlign: 'left', maxWidth: 0 }} className="adm-text-sm">
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} dir="auto">
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
                            onClick={() => handleDelete(u)}
                            disabled={deleting === u.id}
                            aria-label="Delete conversation"
                            title="Delete conversation"
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
                Page {page} of {lastPage}
              </span>
              <button
                className="adm-btn adm-btn-ghost adm-btn-sm"
                disabled={page >= lastPage}
                onClick={() => setPage(p => p + 1)}
              >Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
