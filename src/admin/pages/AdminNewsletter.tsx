import React, { useState } from 'react';
import { adminApi, getToken } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { buildApiUrl } from '../../utils/api';
import { fmtDate } from '../utils/dateUtils';

export const AdminNewsletter: React.FC = () => {
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => adminApi.getNewsletter(page),
    [page]
  );

  const handleUnsubscribe = async (email: string) => {
    if (!confirm(`Unsubscribe ${email}?`)) return;
    setDeleting(email);
    try {
      const response = await fetch(buildApiUrl(`/api/admin/newsletter/${encodeURIComponent(email)}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to unsubscribe');
      }
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to unsubscribe');
    } finally {
      setDeleting(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch(buildApiUrl('/api/admin/newsletter/export'), {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || 'Failed to export subscribers');
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'subscribers.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export subscribers');
    } finally {
      setExporting(false);
    }
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
        <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : '⬇ Export CSV'}
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
