import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type NewsItem } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate } from '../utils/dateUtils';

export const AdminNews: React.FC = () => {
  const [deleting, setDeleting] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsync(() => adminApi.getNews(true), []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this news article?')) return;
    setDeleting(id);
    try {
      await adminApi.deleteNews(id);
      reload();
    } catch {
      alert('Failed to delete article');
    } finally {
      setDeleting(null);
    }
  };

  const items = data?.items ?? [];

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">News</h1>
          <p className="adm-page-subtitle">Manage news articles — {items.length} total</p>
        </div>
        <Link to="/admin/news/new" className="adm-btn adm-btn-primary adm-btn-sm">
          + Add Article
        </Link>
      </div>

      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>}
      {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

      {!loading && (
        <div className="adm-card" style={{ padding: 0 }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th style={{ textAlign: 'right' }}>Title (AR)</th>
                  <th>Title (EN)</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>No articles yet.</td></tr>
                ) : items.map((item: NewsItem) => (
                  <tr key={item.id}>
                    <td>
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title_en}
                          style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4 }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : <span className="adm-text-muted">—</span>}
                    </td>
                    <td dir="rtl" className="adm-truncate" style={{ maxWidth: 180 }}>{item.title_ar}</td>
                    <td className="adm-truncate" style={{ maxWidth: 200 }}>{item.title_en}</td>
                    <td className="adm-text-sm adm-text-muted">{item.category_en}</td>
                    <td className="adm-text-sm adm-text-muted">{fmtDate(item.published_at)}</td>
                    <td>
                      <span className={`adm-badge ${item.active ? 'adm-badge-green' : 'adm-badge-red'}`}>
                        {item.active ? 'Published' : 'Hidden'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Link to={`/admin/news/${item.id}`} className="adm-btn adm-btn-ghost adm-btn-sm">Edit</Link>
                        <button
                          className="adm-btn adm-btn-danger adm-btn-sm"
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting === item.id}
                        >
                          {deleting === item.id ? '…' : '🗑'}
                        </button>
                      </div>
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
