import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminApi, type BlogPostItem, type BlogCategoryItem } from '../utils/adminApi';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { resolveAdminImage } from '../../utils/image';

const LANGS = ['ar', 'en', 'tr', 'ru'] as const;
type Lang = typeof LANGS[number];

const EMPTY: Partial<BlogPostItem> = {
  slug: '',
  image: '',
  hero_image: '',
  category_id: null,
  tags: [],
  title_ar: '', title_en: '', title_tr: '', title_ru: '',
  excerpt_ar: '', excerpt_en: '', excerpt_tr: '', excerpt_ru: '',
  body_ar: '', body_en: '', body_tr: '', body_ru: '',
  meta_title_ar: '', meta_title_en: '', meta_title_tr: '', meta_title_ru: '',
  meta_description_ar: '', meta_description_en: '', meta_description_tr: '', meta_description_ru: '',
  author_name: '',
  reading_time: 0,
  featured: 0,
  status: 'draft',
  published_at: new Date().toISOString().slice(0, 10),
  publish_at: null,
  active: 0,
};

export const AdminBlogEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [form, setForm] = useState<Partial<BlogPostItem>>(EMPTY);
  const [categories, setCategories] = useState<BlogCategoryItem[]>([]);
  const [activeLang, setActiveLang] = useState<Lang>('ar');
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    adminApi.getBlogCategories()
      .then((r) => setCategories(r.items || []))
      .catch(() => { /* silently ignore — admin can still pick "no category" */ });
  }, []);

  useEffect(() => {
    if (isNew) return;
    adminApi.getBlogPost(id!)
      .then((r) => {
        setForm(r.item);
        setLoaded(true);
      })
      .catch((e) => {
        setError(e.message || 'Failed to load post');
        setLoaded(true);
      });
  }, [id, isNew]);

  const setField = <K extends keyof BlogPostItem>(key: K, value: BlogPostItem[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleImageUpload = async (which: 'image' | 'hero_image', file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result;
      if (typeof result !== 'string') return;
      const base64 = result.split(',')[1];
      setUploading(true);
      try {
        const res = await fetch('/api/admin/upload-image', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': document.cookie.match(/karahoca_admin_csrf=([^;]+)/)?.[1] || '',
          },
          body: JSON.stringify({ imageBase64: base64, fileName: file.name }),
        });
        const data = await res.json();
        if (data?.url) setField(which, data.url);
      } catch (err) {
        alert('Upload failed: ' + (err instanceof Error ? err.message : err));
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!t || (form.tags || []).includes(t)) { setTagInput(''); return; }
    setField('tags', [...(form.tags || []), t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setField('tags', (form.tags || []).filter((x) => x !== t));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!form.title_ar?.trim() && !form.title_en?.trim()) {
        setError('Please provide at least an Arabic or English title.');
        setSaving(false);
        return;
      }
      const payload: Partial<BlogPostItem> = { ...form };
      if (isNew) {
        const r = await adminApi.createBlogPost(payload);
        navigate(`/admin/blog/${encodeURIComponent(r.item.id)}`, { replace: true });
      } else {
        await adminApi.updateBlogPost(id!, payload);
        // Stay on page so the admin can keep editing.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <div className="adm-loading-center"><span className="adm-spinner" /> Loading…</div>;
  }

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{isNew ? 'New Post' : 'Edit Post'}</h1>
          <p className="adm-page-subtitle">
            <Link to="/admin/blog" style={{ color: 'var(--adm-accent)' }}>← Back to all posts</Link>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="adm-btn adm-btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>

      {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20 }}>
        {/* Main column */}
        <div className="adm-card">
          {/* Language tabs */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--adm-border)', marginBottom: 18 }}>
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                className={activeLang === l ? 'adm-tab adm-tab-active' : 'adm-tab'}
                onClick={() => setActiveLang(l)}
              >
                {{ ar: '🇸🇦 العربية', en: '🇬🇧 English', tr: '🇹🇷 Türkçe', ru: '🇷🇺 Русский' }[l]}
              </button>
            ))}
          </div>

          {/* Title */}
          <label className="adm-label">Title</label>
          <input
            type="text"
            className="adm-input"
            value={(form as Record<string, unknown>)[`title_${activeLang}`] as string || ''}
            onChange={(e) => setField(`title_${activeLang}` as keyof BlogPostItem, e.target.value as never)}
            placeholder={activeLang === 'ar' ? 'عنوان المقال…' : 'Post title…'}
            dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
          />

          {/* Excerpt */}
          <label className="adm-label" style={{ marginTop: 14 }}>Excerpt (short summary, 1-2 lines)</label>
          <textarea
            className="adm-input"
            rows={3}
            value={(form as Record<string, unknown>)[`excerpt_${activeLang}`] as string || ''}
            onChange={(e) => setField(`excerpt_${activeLang}` as keyof BlogPostItem, e.target.value as never)}
            placeholder={activeLang === 'ar' ? 'ملخص قصير يظهر في بطاقة المقال…' : 'Short summary shown in the post card…'}
            dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
          />

          {/* Body — markdown editor */}
          <label className="adm-label" style={{ marginTop: 14 }}>Body (markdown)</label>
          <MarkdownEditor
            value={(form as Record<string, unknown>)[`body_${activeLang}`] as string || ''}
            onChange={(v) => setField(`body_${activeLang}` as keyof BlogPostItem, v as never)}
            dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
            placeholder={activeLang === 'ar' ? 'محتوى المقال بصيغة Markdown…' : 'Post body in Markdown…'}
          />

          {/* SEO overrides — collapsed by default to keep the editor uncluttered */}
          <details style={{ marginTop: 18 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>SEO overrides ({activeLang.toUpperCase()})</summary>
            <div style={{ marginTop: 10 }}>
              <label className="adm-label">Meta title (defaults to Title if empty)</label>
              <input
                type="text"
                className="adm-input"
                value={(form as Record<string, unknown>)[`meta_title_${activeLang}`] as string || ''}
                onChange={(e) => setField(`meta_title_${activeLang}` as keyof BlogPostItem, e.target.value as never)}
                dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
              />
              <label className="adm-label" style={{ marginTop: 10 }}>Meta description (defaults to Excerpt if empty)</label>
              <textarea
                className="adm-input"
                rows={2}
                value={(form as Record<string, unknown>)[`meta_description_${activeLang}`] as string || ''}
                onChange={(e) => setField(`meta_description_${activeLang}` as keyof BlogPostItem, e.target.value as never)}
                dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>
          </details>
        </div>

        {/* Side column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Publishing */}
          <div className="adm-card">
            <h3 style={{ margin: '0 0 12px' }}>Publishing</h3>

            <label className="adm-label">Status</label>
            <select
              className="adm-input"
              value={form.status || 'draft'}
              onChange={(e) => setField('status', e.target.value as BlogPostItem['status'])}
            >
              <option value="draft">📝 Draft</option>
              <option value="published">✅ Published</option>
              <option value="scheduled">🕐 Scheduled</option>
            </select>

            {form.status === 'scheduled' && (
              <>
                <label className="adm-label" style={{ marginTop: 10 }}>Publish at</label>
                <input
                  type="datetime-local"
                  className="adm-input"
                  value={form.publish_at?.slice(0, 16) || ''}
                  onChange={(e) => setField('publish_at', new Date(e.target.value).toISOString())}
                />
              </>
            )}

            <label className="adm-label" style={{ marginTop: 10 }}>Published date</label>
            <input
              type="date"
              className="adm-input"
              value={form.published_at?.slice(0, 10) || ''}
              onChange={(e) => setField('published_at', new Date(e.target.value).toISOString())}
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(form.featured)}
                onChange={(e) => setField('featured', e.target.checked ? 1 : 0)}
              />
              ⭐ Featured (shown in hero strip)
            </label>
          </div>

          {/* Category */}
          <div className="adm-card">
            <h3 style={{ margin: '0 0 12px' }}>Category</h3>
            <select
              className="adm-input"
              value={form.category_id || ''}
              onChange={(e) => setField('category_id', e.target.value || null)}
            >
              <option value="">— No category —</option>
              {categories.filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name_en || c.name_ar}
                </option>
              ))}
            </select>
            <p style={{ fontSize: 12, color: 'var(--adm-text-dim)', margin: '8px 0 0' }}>
              <Link to="/admin/blog/categories" style={{ color: 'var(--adm-accent)' }}>
                Manage categories →
              </Link>
            </p>
          </div>

          {/* Slug + author */}
          <div className="adm-card">
            <label className="adm-label">Slug (URL path)</label>
            <input
              type="text"
              className="adm-input"
              value={form.slug || ''}
              onChange={(e) => setField('slug', e.target.value)}
              placeholder="auto-generated if blank"
            />

            <label className="adm-label" style={{ marginTop: 10 }}>Author name</label>
            <input
              type="text"
              className="adm-input"
              value={form.author_name || ''}
              onChange={(e) => setField('author_name', e.target.value)}
            />

            <label className="adm-label" style={{ marginTop: 10 }}>Reading time (minutes — auto-calc on save)</label>
            <input
              type="number"
              className="adm-input"
              min={1}
              value={form.reading_time || 0}
              onChange={(e) => setField('reading_time', parseInt(e.target.value, 10) || 0)}
            />
          </div>

          {/* Images */}
          <div className="adm-card">
            <h3 style={{ margin: '0 0 12px' }}>Images</h3>
            <label className="adm-label">Thumbnail (card)</label>
            {form.image && (
              <img src={resolveAdminImage(form.image)} alt="" style={{ width: '100%', borderRadius: 6, marginBottom: 8 }} />
            )}
            <input
              type="file"
              accept="image/*"
              className="adm-input"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload('image', f); }}
              disabled={uploading}
            />
            <input
              type="text"
              className="adm-input"
              style={{ marginTop: 6 }}
              value={form.image || ''}
              onChange={(e) => setField('image', e.target.value)}
              placeholder="or paste URL"
            />

            <label className="adm-label" style={{ marginTop: 14 }}>Hero (article page, 21:9 ideal)</label>
            {form.hero_image && form.hero_image !== form.image && (
              <img src={resolveAdminImage(form.hero_image)} alt="" style={{ width: '100%', borderRadius: 6, marginBottom: 8 }} />
            )}
            <input
              type="file"
              accept="image/*"
              className="adm-input"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload('hero_image', f); }}
              disabled={uploading}
            />
            <input
              type="text"
              className="adm-input"
              style={{ marginTop: 6 }}
              value={form.hero_image || ''}
              onChange={(e) => setField('hero_image', e.target.value)}
              placeholder="defaults to thumbnail"
            />
          </div>

          {/* Tags */}
          <div className="adm-card">
            <h3 style={{ margin: '0 0 12px' }}>Tags</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {(form.tags || []).map((t) => (
                <span key={t} style={{ background: 'var(--adm-bg-3)', padding: '4px 10px', borderRadius: 999, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  #{t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--adm-text-dim)' }}
                    aria-label={`Remove ${t}`}
                  >×</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                className="adm-input"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="add tag…"
              />
              <button type="button" className="adm-btn adm-btn-ghost" onClick={addTag}>+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
