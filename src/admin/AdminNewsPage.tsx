import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAdminNews, deleteAdminNews, getAdminNews, updateAdminNews } from '../utils/adminApi';
import { clearAdminToken } from '../utils/adminAuth';

type NewsItem = {
  id: number;
  slug: string;
  status: string;
  scheduled_at: string | null;
  deleted_at: string | null;
  translations: Array<{ lang: string; title: string; content: string }>;
};

function AdminNewsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [slug, setSlug] = useState('');
  const [sourceLang, setSourceLang] = useState('ar');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [scheduledAt, setScheduledAt] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSlug, setEditSlug] = useState('');
  const [editStatus, setEditStatus] = useState<'draft' | 'published'>('draft');
  const [editSchedule, setEditSchedule] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getAdminNews();
      setItems(response.items || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load news.';
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

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createAdminNews({
        slug,
        sourceLang,
        title,
        content,
        status,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null
      });
      setSlug('');
      setTitle('');
      setContent('');
      setScheduledAt('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create news failed.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: NewsItem) => {
    setEditingId(item.id);
    setEditSlug(item.slug);
    setEditStatus(item.status === 'published' ? 'published' : 'draft');
    setEditSchedule(item.scheduled_at ? item.scheduled_at.slice(0, 16) : '');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setError('');
    try {
      await updateAdminNews(editingId, {
        slug: editSlug,
        status: editStatus,
        scheduledAt: editSchedule ? new Date(editSchedule).toISOString() : null
      });
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update news failed.');
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (id: number) => {
    if (!window.confirm('Soft delete this news item?')) return;
    setSaving(true);
    setError('');
    try {
      await deleteAdminNews(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete news failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <h1>Admin News</h1>
      <button onClick={() => navigate('/admin/products')}>Go to Products</button>
      <button onClick={() => navigate('/admin/chats')} style={{ marginInlineStart: 8 }}>
        Go to Chats
      </button>

      <h2 style={{ marginTop: 18 }}>Create News (AI translation enabled)</h2>
      <form onSubmit={onCreate} style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug" required />
        <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
          <option value="ar">Arabic</option>
          <option value="en">English</option>
          <option value="tr">Turkish</option>
          <option value="ru">Russian</option>
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content" rows={6} required />
        <select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Create News'}
        </button>
      </form>

      {error && <p style={{ color: '#d32f2f' }}>{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => (
            <div key={item.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
              <strong>{item.slug}</strong> - {item.status}
              {item.scheduled_at ? <div>Scheduled: {new Date(item.scheduled_at).toLocaleString()}</div> : null}
              {item.deleted_at ? <div style={{ color: '#d32f2f' }}>Soft deleted</div> : null}
              <div style={{ marginTop: 8 }}>
                {item.translations.map((t) => (
                  <div key={t.lang}>
                    <b>{t.lang}:</b> {t.title}
                  </div>
                ))}
              </div>
              {!item.deleted_at && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button onClick={() => startEdit(item)}>Edit</button>
                  <button onClick={() => removeItem(item.id)} disabled={saving}>
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
                  <input type="datetime-local" value={editSchedule} onChange={(e) => setEditSchedule(e.target.value)} />
                  <button onClick={saveEdit} disabled={saving}>
                    Save
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminNewsPage;
