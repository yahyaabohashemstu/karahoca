import React, { useState } from 'react';
import { adminApi, getToken } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { buildApiUrl } from '../../utils/api';
import { fmtDate } from '../utils/dateUtils';

export const AdminNewsletter: React.FC = () => {
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(
    () => adminApi.getNewsletter(page),
    [page]
  );

  const handleUnsubscribe = async (email: string) => {
    if (!confirm(`Unsubscribe ${email}?`)) return;
    setDeleting(email);
    try {
      await fetch(buildApiUrl(`/api/admin/newsletter/${encodeURIComponent(email)}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      reload();
    } catch {
      alert('Failed to unsubscribe');
    } finally {
      setDeleting(null);
    }
  };

  const handleExport = () => {
    window.open(buildApiUrl('/api/admin/newsletter/export') + `?token=${getToken()}`, '_blank');
  };

  const subscribers = data?.subscribers ?? [];

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Newsletter Subscribers</h1>
          <p className="adm-page-subtitle">
            {data ? `${data.total} total subscribers` : 'Loading...'}
          </p>
        </div>
        <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={handleExport}>
          ⬇ Export CSV
        </button>
      </div>

      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>}
      {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

      {!loading && (
        <>
          <div className="adm-card" style={{ padding: 0 }}>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Subscribed At</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.length === 0 ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>No subscribers yet.</td></tr>
                  ) : subscribers.map(sub => (
                    <tr key={sub.email}>
                      <td className="adm-mono">{sub.email}</td>
                      <td className="adm-text-muted adm-text-sm">
                        {fmtDate(sub.subscribed_at)}
                      </td>
                      <td>
                        <button
                          className="adm-btn adm-btn-danger adm-btn-sm"
                          onClick={() => handleUnsubscribe(sub.email)}
                          disabled={deleting === sub.email}
                        >
                          {deleting === sub.email ? '…' : 'Unsubscribe'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data && data.total > data.limit && (
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
