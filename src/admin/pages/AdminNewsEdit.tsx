import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminApi, type NewsItem } from '../utils/adminApi';
import { TranslationHelper } from '../components/TranslationHelper';

const LANGS = ['ar', 'en', 'tr', 'ru'] as const;
type Lang = typeof LANGS[number];

const EMPTY: Partial<NewsItem> = {
  slug: '', image: '', published_at: new Date().toISOString().split('T')[0],
  category_ar: '', category_en: '', category_tr: '', category_ru: '',
  title_ar: '', title_en: '', title_tr: '', title_ru: '',
  excerpt_ar: '', excerpt_en: '', excerpt_tr: '', excerpt_ru: '',
  body_ar: [], body_en: [], body_tr: [], body_ru: [],
  active: 1,
};

export const AdminNewsEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [form, setForm] = useState<Partial<NewsItem>>(EMPTY);
  const [activeLang, setActiveLang] = useState<Lang>('ar');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isNew) {
      adminApi.getNewsItem(id!).then(r => {
        setForm(r.item);
        setLoading(false);
      }).catch(e => {
        setError(e.message);
        setLoading(false);
      });
    }
  }, [id, isNew]);

  const set = <K extends keyof NewsItem>(key: K, value: NewsItem[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const setStr = (key: keyof NewsItem, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  const getBodyText = (lang: Lang): string =>
    (form[`body_${lang}` as keyof NewsItem] as string[] | undefined)?.join('\n\n') ?? '';

  const setBodyText = (lang: Lang, text: string) => {
    const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    set(`body_${lang}` as keyof NewsItem, paragraphs as unknown as NewsItem[keyof NewsItem]);
  };

  const handleTranslated = (translations: Record<string, Record<string, string>>) => {
    const updates: Partial<NewsItem> = {};
    for (const [field, langs] of Object.entries(translations)) {
      for (const [lang, value] of Object.entries(langs)) {
        if (field === 'body') {
          const paragraphs = value.split(/\n\n+/).map((p: string) => p.trim()).filter(Boolean);
          (updates as Record<string, string[]>)[`body_${lang}`] = paragraphs;
        } else {
          (updates as Record<string, string>)[`${field}_${lang}`] = value;
        }
      }
    }
    setForm(f => ({ ...f, ...updates }));
  };

  const handleImageUpload = async (file: File) => {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Unsupported file type. Use JPG, PNG, WebP, or GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5 MB.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const data = await adminApi.uploadImage(base64, file.name);
      if (!data.success) throw new Error('Upload failed');
      setStr('image', data.url || data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title_ar || !form.slug) {
      setError('Please fill required fields: Arabic title and slug.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await adminApi.createNews(form);
      } else {
        await adminApi.updateNews(id!, form);
      }
      navigate('/admin/news');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>;

  return (
    <div>
      <div className="adm-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/admin/news" className="adm-btn adm-btn-ghost adm-btn-sm">← Back</Link>
          <h1 className="adm-page-title">{isNew ? 'New Article' : 'Edit Article'}</h1>
        </div>
        <button className="adm-btn adm-btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <><span className="adm-spinner" style={{ width: 14, height: 14 }} /> Saving...</> : '💾 Save Article'}
        </button>
      </div>

      {error && <div className="adm-alert adm-alert-error" style={{ marginBottom: 16 }}>⚠ {error}</div>}

      <div className="adm-grid-2">
        {/* Left: metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="adm-card">
            <div className="adm-card-title">Article Info</div>
            <div className="adm-form-group">
              <label className="adm-label">Slug (URL) *</label>
              <input
                className="adm-input"
                value={form.slug ?? ''}
                onChange={e => setStr('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="my-news-article"
              />
            </div>
            <div className="adm-form-group">
              <label className="adm-label">Image</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input
                  className="adm-input"
                  value={form.image ?? ''}
                  onChange={e => setStr('image', e.target.value)}
                  placeholder="/news/image.webp or paste URL"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="adm-btn adm-btn-secondary adm-btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {uploading ? <><span className="adm-spinner" style={{ width: 12, height: 12 }} /> Uploading...</> : '📁 Upload'}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }}
              />
            </div>
            <div className="adm-form-group">
              <label className="adm-label">Published Date</label>
              <input
                className="adm-input"
                type="date"
                value={form.published_at ? form.published_at.split('T')[0] : ''}
                onChange={e => setStr('published_at', e.target.value)}
              />
            </div>
            <div className="adm-form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label className="adm-label" style={{ margin: 0 }}>Published</label>
              <input type="checkbox" checked={!!form.active} onChange={e => set('active', (e.target.checked ? 1 : 0) as NewsItem['active'])} style={{ width: 18, height: 18 }} />
            </div>
          </div>

          {form.image && (
            <div className="adm-card">
              <div className="adm-card-title">Image Preview</div>
              <img src={form.image} alt="preview" style={{ maxWidth: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 6, marginTop: 8 }} />
            </div>
          )}
        </div>

        {/* Right: multilingual content */}
        <div className="adm-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div className="adm-card-title" style={{ margin: 0 }}>Content</div>
            <TranslationHelper
              fields={{
                category: form.category_ar || '',
                title: form.title_ar || '',
                excerpt: form.excerpt_ar || '',
                body: getBodyText('ar'),
              }}
              sourceLang="ar"
              onTranslated={handleTranslated}
            />
          </div>

          <div className="adm-lang-tabs">
            {LANGS.map(l => (
              <button key={l} className={`adm-lang-tab ${activeLang === l ? 'active' : ''}`} onClick={() => setActiveLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {LANGS.map(l => (
            <div key={l} style={{ display: activeLang === l ? 'block' : 'none' }}>
              <div className="adm-form-group">
                <label className="adm-label">Category ({l.toUpperCase()})</label>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`category_${l}`] ?? ''}
                  onChange={e => setStr(`category_${l}` as keyof NewsItem, e.target.value)}
                  placeholder="e.g. Announcement"
                />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">Title ({l.toUpperCase()}) *</label>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`title_${l}`] ?? ''}
                  onChange={e => setStr(`title_${l}` as keyof NewsItem, e.target.value)}
                />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">Excerpt ({l.toUpperCase()})</label>
                <textarea
                  className="adm-textarea"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  rows={2}
                  value={(form as Record<string, string>)[`excerpt_${l}`] ?? ''}
                  onChange={e => setStr(`excerpt_${l}` as keyof NewsItem, e.target.value)}
                />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">Body ({l.toUpperCase()}) — separate paragraphs with blank line</label>
                <textarea
                  className="adm-textarea"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  rows={8}
                  value={getBodyText(l)}
                  onChange={e => setBodyText(l, e.target.value)}
                  placeholder="First paragraph&#10;&#10;Second paragraph"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
