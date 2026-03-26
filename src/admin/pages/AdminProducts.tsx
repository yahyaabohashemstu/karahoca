import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type Product } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';

export const AdminProducts: React.FC = () => {
  const [brand, setBrand] = useState<'DIOX' | 'AYLUX' | ''>('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(
    () => adminApi.getProducts(brand || undefined, true),
    [brand]
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    setDeleting(id);
    try {
      await adminApi.deleteProduct(id);
      reload();
    } catch {
      alert('Failed to delete product');
    } finally {
      setDeleting(null);
    }
  };

  const products = data?.products ?? [];

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Products</h1>
          <p className="adm-page-subtitle">Manage DIOX and AYLUX product catalog</p>
        </div>
        <Link to="/admin/products/new" className="adm-btn adm-btn-primary adm-btn-sm">
          + Add Product
        </Link>
      </div>

      {/* Brand filter */}
      <div className="adm-card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        {(['', 'DIOX', 'AYLUX'] as const).map(b => (
          <button
            key={b || 'all'}
            className={`adm-btn adm-btn-sm ${brand === b ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
            onClick={() => setBrand(b)}
          >
            {b || 'All Brands'}
          </button>
        ))}
        <span className="adm-text-muted adm-text-sm" style={{ marginLeft: 'auto' }}>
          {products.length} products
        </span>
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
                  <th>Name (AR)</th>
                  <th>Name (EN)</th>
                  <th>Brand</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>No products found.</td></tr>
                ) : products.map((p: Product) => (
                  <tr key={p.id}>
                    <td>
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.alt_en || p.name_en}
                          style={{ width: 40, height: 40, objectFit: 'contain', background: 'var(--adm-surface2)', borderRadius: 4 }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : <span className="adm-text-muted">—</span>}
                    </td>
                    <td dir="rtl" style={{ maxWidth: 160 }} className="adm-truncate">{p.name_ar}</td>
                    <td style={{ maxWidth: 160 }} className="adm-truncate">{p.name_en}</td>
                    <td><span className={`adm-badge ${p.brand === 'DIOX' ? 'adm-badge-blue' : 'adm-badge-green'}`}>{p.brand}</span></td>
                    <td className="adm-text-sm adm-text-muted">{p.category_title_en || p.category_id}</td>
                    <td>
                      <span className={`adm-badge ${p.active ? 'adm-badge-green' : 'adm-badge-red'}`}>
                        {p.active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <Link to={`/admin/products/${p.id}`} className="adm-btn adm-btn-ghost adm-btn-sm">Edit</Link>
                      <button
                        className="adm-btn adm-btn-danger adm-btn-sm"
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                      >
                        {deleting === p.id ? '…' : '🗑'}
                      </button>
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
