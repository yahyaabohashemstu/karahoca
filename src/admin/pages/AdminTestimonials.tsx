import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type Testimonial } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';

export const AdminTestimonials: React.FC = () => {
  const [deleting, setDeleting] = useState<number | null>(null);
  const { data, loading, error, reload } = useAsync(() => adminApi.getTestimonials(), []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this testimonial?')) return;
    setDeleting(id);
    try {
      await adminApi.deleteTestimonial(id);
      reload();
    } catch {
      alert('Failed to delete testimonial');
    } finally {
      setDeleting(null);
    }
  };

  const items: Testimonial[] = data?.testimonials ?? [];

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Testimonials</h1>
          <p className="adm-page-subtitle">Manage client reviews shown on the home page — {items.length} total</p>
        </div>
        <Link to="/admin/testimonials/new" className="adm-btn adm-btn-primary adm-btn-sm">
          + Add Testimonial
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
                  <th>Client</th>
                  <th>Company</th>
                  <th>Country</th>
                  <th>Rating</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>No testimonials yet.</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.client_name}</td>
                    <td>{item.company || '—'}</td>
                    <td>{item.country || '—'}</td>
                    <td>{'★'.repeat(item.rating)}</td>
                    <td>{item.display_order}</td>
                    <td>
                      <span className={`adm-badge ${item.active ? 'adm-badge-success' : 'adm-badge-warn'}`}>
                        {item.active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link to={`/admin/testimonials/${item.id}`} className="adm-btn adm-btn-ghost adm-btn-sm">
                          Edit
                        </Link>
                        <button
                          className="adm-btn adm-btn-danger adm-btn-sm"
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting === item.id}
                        >
                          {deleting === item.id ? '…' : 'Delete'}
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
