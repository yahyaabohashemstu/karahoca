import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createAdminProduct,
  deleteAdminProduct,
  getAdminProducts,
  updateAdminProduct
} from '../utils/adminApi';
import { clearAdminToken } from '../utils/adminAuth';

type Product = {
  id: number;
  slug: string;
  status: string;
  created_at: string;
  scheduled_at: string | null;
  deleted_at: string | null;
  translations: Array<{ lang: string; name: string; description: string }>;
};

function AdminProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSlug, setEditSlug] = useState('');
  const [editStatus, setEditStatus] = useState<'draft' | 'published'>('draft');
  const [editSchedule, setEditSchedule] = useState('');
  const [error, setError] = useState('');
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceLang, setSourceLang] = useState('ar');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [scheduledAt, setScheduledAt] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const productsResponse = await getAdminProducts();
      setProducts(productsResponse.items || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load admin data.';
      setError(message);
      if (message.toLowerCase().includes('unauthorized')) {
        clearAdminToken();
        navigate('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onCreateProduct = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createAdminProduct({
        slug,
        sourceLang,
        name,
        description,
        status,
        scheduledAt: scheduledAt || null
      });
      setSlug('');
      setName('');
      setDescription('');
      setScheduledAt('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create product failed.');
    } finally {
      setSaving(false);
    }
  };

  const onLogout = () => {
    clearAdminToken();
    navigate('/admin/login');
  };

  const startEdit = (item: Product) => {
    setEditingId(item.id);
    setEditSlug(item.slug);
    setEditStatus(item.status === 'published' ? 'published' : 'draft');
    setEditSchedule(item.scheduled_at ? item.scheduled_at.slice(0, 16) : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditSlug('');
    setEditStatus('draft');
    setEditSchedule('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setError('');
    try {
      await updateAdminProduct(editingId, {
        slug: editSlug,
        status: editStatus,
        scheduledAt: editSchedule ? new Date(editSchedule).toISOString() : null
      });
      cancelEdit();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update product failed.');
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async (id: number) => {
    if (!window.confirm('Soft delete this product?')) return;
    setSaving(true);
    setError('');
    try {
      await deleteAdminProduct(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete product failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Admin Panel</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/admin/news')}>News</button>
          <button onClick={() => navigate('/admin/chats')}>Chats</button>
          <button onClick={onLogout}>Logout</button>
        </div>
      </div>

      <h2>Create Product (AI translation enabled)</h2>
      <form onSubmit={onCreateProduct} style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
        <input placeholder="Slug (diox-123)" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
          <option value="ar">Arabic</option>
          <option value="en">English</option>
          <option value="tr">Turkish</option>
          <option value="ru">Russian</option>
        </select>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          required
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          placeholder="Schedule (optional)"
        />
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Create Product'}
        </button>
      </form>

      {error && <p style={{ color: '#d32f2f' }}>{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <h2>Products</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {products.map((item) => (
              <div key={item.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
                <strong>{item.slug}</strong> - {item.status}
                {item.scheduled_at ? (
                  <div>Scheduled: {new Date(item.scheduled_at).toLocaleString()}</div>
                ) : null}
                {item.deleted_at ? (
                  <div style={{ color: '#d32f2f' }}>Deleted at: {new Date(item.deleted_at).toLocaleString()}</div>
                ) : null}
                <div style={{ marginTop: 8 }}>
                  {item.translations?.map((t) => (
                    <div key={t.lang}>
                      <b>{t.lang}:</b> {t.name}
                    </div>
                  ))}
                </div>
                {!item.deleted_at && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <button onClick={() => startEdit(item)}>Edit</button>
                    <button onClick={() => removeProduct(item.id)} disabled={saving}>
                      Soft Delete
                    </button>
                  </div>
                )}

                {editingId === item.id && (
                  <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                    <input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as 'draft' | 'published')}>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                    <input
                      type="datetime-local"
                      value={editSchedule}
                      onChange={(e) => setEditSchedule(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={saveEdit} disabled={saving}>
                        Save
                      </button>
                      <button onClick={cancelEdit} disabled={saving}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default AdminProductsPage;
