import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminApi, type BlogPostItem, type BlogCategoryItem } from '../utils/adminApi';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { resolveAdminImage } from '../../utils/image';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../utils/datetimeLocal';
import { normalizeSlug } from '../utils/slug';
import { prerenderNote, confirmPastSchedule, confirmSlugChange } from '../utils/publishing';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { getCurrentAdminLang } from '../i18n/currentLang';

const messages = defineMessages({
  en: {
    loadFailed: 'Failed to load post',
    uploadFailed: 'Upload failed: {error}',
    titleRequired: 'Please provide at least an Arabic or English title.',
    slugInvalid: 'The slug must contain at least one letter or digit.',
    newPost: 'New Post',
    editPost: 'Edit Post',
    backToPosts: '← Back to all posts',
    savedBadge: '✓ Saved',
    create: 'Create',
    deletedBanner: '🗑 This post was deleted and is hidden from the site. Saving it as Published or Scheduled will put it back on the site.',
    titleLabel: 'Title',
    excerptLabel: 'Excerpt (short summary, 1-2 lines)',
    bodyLabel: 'Body (markdown)',
    seoOverrides: 'SEO overrides ({lang})',
    metaTitle: 'Meta title (defaults to Title if empty)',
    metaDescription: 'Meta description (defaults to Excerpt if empty)',
    publishing: 'Publishing',
    optDraft: '📝 Draft',
    optPublished: '✅ Published',
    optScheduled: '🕐 Scheduled',
    publishAt: 'Publish at (your local time)',
    publishedDate: 'Published date',
    featured: '⭐ Featured (shown in hero strip)',
    category: 'Category',
    noCategory: '— No category —',
    manageCategories: 'Manage categories →',
    slugLabel: 'Slug (URL path)',
    slugPlaceholder: 'auto-generated if blank',
    authorName: 'Author name',
    readingTime: 'Reading time (minutes — recalculated on save unless you change it)',
    images: 'Images',
    thumbnail: 'Thumbnail (card)',
    pasteUrl: 'or paste URL',
    hero: 'Hero (article page, 21:9 ideal)',
    heroPlaceholder: 'defaults to thumbnail',
    tags: 'Tags',
    removeTag: 'Remove {tag}',
    tagPlaceholder: 'add tag…',
    newTag: 'New tag',
    addTag: 'Add tag',
  },
  ar: {
    loadFailed: 'تعذّر تحميل المقال',
    uploadFailed: 'فشل الرفع: {error}',
    titleRequired: 'يُرجى إدخال عنوان عربي أو إنجليزي على الأقل.',
    slugInvalid: 'يجب أن يحتوي الـ slug على حرف أو رقم واحد على الأقل.',
    newPost: 'مقال جديد',
    editPost: 'تعديل المقال',
    backToPosts: '→ العودة إلى كل المقالات',
    savedBadge: '✓ تم الحفظ',
    create: 'إنشاء',
    deletedBanner: '🗑 هذا المقال محذوف ومخفي عن الموقع. حفظه بحالة «منشور» أو «مجدول» يعيده إلى الموقع.',
    titleLabel: 'العنوان',
    excerptLabel: 'الملخص (موجز قصير في سطر أو سطرين)',
    bodyLabel: 'النص (Markdown)',
    // \u200F keeps the bracket after the Latin "SEO" in right-to-left text.
    seoOverrides: 'تخصيص SEO \u200F({lang})',
    metaTitle: 'عنوان الميتا (يُستخدم العنوان إذا تُرك فارغًا)',
    metaDescription: 'وصف الميتا (يُستخدم الملخص إذا تُرك فارغًا)',
    publishing: 'النشر',
    optDraft: '📝 مسودة',
    optPublished: '✅ منشور',
    optScheduled: '🕐 مجدول',
    publishAt: 'موعد النشر (بالتوقيت المحلي للجهاز)',
    publishedDate: 'تاريخ النشر',
    featured: '⭐ مميّز (يظهر في الشريط الرئيسي)',
    category: 'الفئة',
    noCategory: '— بلا فئة —',
    manageCategories: 'إدارة الفئات ←',
    slugLabel: 'الـ slug (مسار الرابط)',
    slugPlaceholder: 'يُولَّد تلقائيًا إذا تُرك فارغًا',
    authorName: 'اسم الكاتب',
    readingTime: 'مدة القراءة (بالدقائق — تُحسب من جديد عند الحفظ ما لم تُعدَّل يدويًا)',
    images: 'الصور',
    thumbnail: 'الصورة المصغّرة (البطاقة)',
    pasteUrl: 'أو الصق رابطًا',
    hero: 'صورة الواجهة (صفحة المقال، يُفضّل 21:9)',
    heroPlaceholder: 'الصورة المصغّرة افتراضيًا',
    tags: 'الوسوم',
    removeTag: 'إزالة {tag}',
    tagPlaceholder: 'إضافة وسم…',
    newTag: 'وسم جديد',
    addTag: 'إضافة وسم',
  },
});

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
  const t = useT(messages);
  const tc = useT(common);

  const [form, setForm] = useState<Partial<BlogPostItem>>(EMPTY);
  const [categories, setCategories] = useState<BlogCategoryItem[]>([]);
  const [activeLang, setActiveLang] = useState<Lang>('ar');
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(isNew);
  // The post as last loaded / saved. The "deleted" banner and the
  // "links will break" slug check read this, not the live form: the
  // banner was derived from the form, so switching a draft's status to
  // Published made it claim "This post was deleted".
  const [stored, setStored] = useState<BlogPostItem | null>(null);
  // reading_time is sent only when the admin typed one. The form always
  // sent its (loaded) value, so the server — which recalculates only when
  // the field is absent — never updated it as the body grew.
  const [readingTimeTouched, setReadingTimeTouched] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

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
        setStored(r.item);
        setLoaded(true);
      })
      .catch((e) => {
        // Read outside React: `t` as a dependency would reload the post
        // (and drop unsaved edits) whenever the admin language changes.
        setError(e.message || String(messages[getCurrentAdminLang()].loadFailed));
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
        // Through adminApi, not a bare fetch('/api/…'): a relative URL hit
        // the web origin (nginx) instead of the API host in production, so
        // blog image uploads always failed — and silently, since a non-OK
        // response was never reported.
        const data = await adminApi.uploadImage(base64, file.name);
        if (data?.url) setField(which, data.url);
      } catch (err) {
        alert(t('uploadFailed', { error: err instanceof Error ? err.message : String(err) }));
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const addTag = () => {
    // Letters/digits of any script (same rule as the server): the old
    // [a-z0-9] filter reduced Arabic and Russian tags to nothing.
    const tag = tagInput.trim().toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-+|-+$/g, '');
    if (!tag || (form.tags || []).includes(tag)) { setTagInput(''); return; }
    setField('tags', [...(form.tags || []), tag]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setField('tags', (form.tags || []).filter((x) => x !== tag));

  const showSaved = () => {
    setSavedFlash(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSavedFlash(false), 3000);
  };

  const handleSave = async () => {
    if (!form.title_ar?.trim() && !form.title_en?.trim()) {
      setError(t('titleRequired'));
      return;
    }
    // Blank is fine (the server derives one from the title); text with
    // no letters or digits is not.
    const slug = normalizeSlug(form.slug);
    if (form.slug?.trim() && !slug) {
      setError(t('slugInvalid'));
      return;
    }
    const wasLive = stored?.status === 'published' && Boolean(stored.active);
    if (!confirmSlugChange('post', wasLive, stored?.slug, slug)) return;
    if (!confirmPastSchedule(form.status, form.publish_at)) return;
    setSaving(true);
    setError(null);
    setSavedFlash(false);
    try {
      const payload: Partial<BlogPostItem> = { ...form, slug };
      if (!readingTimeTouched) delete payload.reading_time;
      if (isNew) {
        const r = await adminApi.createBlogPost(payload);
        navigate(`/admin/blog/${encodeURIComponent(r.item.id)}`, { replace: true });
      } else {
        const r = await adminApi.updateBlogPost(id!, payload);
        // Stay on page so the admin can keep editing. Take what the server
        // decided (normalised / derived slug, recalculated reading time),
        // unless the admin has changed that field again meanwhile.
        setStored(r.item);
        setForm((f) => ({
          ...f,
          ...(normalizeSlug(f.slug) === slug ? { slug: r.item.slug } : {}),
          ...(f.reading_time === form.reading_time ? { reading_time: r.item.reading_time } : {}),
        }));
      }
      showSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <div className="adm-loading-center"><span className="adm-spinner" /> {tc('loading')}</div>;
  }

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{isNew ? t('newPost') : t('editPost')}</h1>
          <p className="adm-page-subtitle">
            <Link to="/admin/blog" style={{ color: 'var(--adm-accent)' }}>{t('backToPosts')}</Link>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Saving keeps the editor open, so without this nothing showed
              that it had worked. */}
          {savedFlash && <span className="adm-badge adm-badge-green" role="status">{t('savedBadge')}</span>}
          <button type="button" className="adm-btn adm-btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? tc('saving') : isNew ? t('create') : tc('save')}
          </button>
        </div>
      </div>

      {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}
      {stored && !stored.active && stored.status !== 'draft' && (
        <div className="adm-alert adm-alert-info">
          {t('deletedBanner')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20 }}>
        {/* Main column */}
        <div className="adm-card">
          {/* Language tabs — each language named in itself, whatever the
              admin language. */}
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

          {/* Title. Placeholders follow the field's language, not the
              admin's, like the text typed into it. */}
          <label className="adm-label">{t('titleLabel')}</label>
          <input
            type="text"
            className="adm-input"
            value={(form as Record<string, unknown>)[`title_${activeLang}`] as string || ''}
            onChange={(e) => setField(`title_${activeLang}` as keyof BlogPostItem, e.target.value as never)}
            placeholder={activeLang === 'ar' ? 'عنوان المقال…' : 'Post title…'}
            dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
          />

          {/* Excerpt */}
          <label className="adm-label" style={{ marginTop: 14 }}>{t('excerptLabel')}</label>
          <textarea
            className="adm-input"
            rows={3}
            value={(form as Record<string, unknown>)[`excerpt_${activeLang}`] as string || ''}
            onChange={(e) => setField(`excerpt_${activeLang}` as keyof BlogPostItem, e.target.value as never)}
            placeholder={activeLang === 'ar' ? 'ملخص قصير يظهر في بطاقة المقال…' : 'Short summary shown in the post card…'}
            dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
          />

          {/* Body — markdown editor */}
          <label className="adm-label" style={{ marginTop: 14 }}>{t('bodyLabel')}</label>
          <MarkdownEditor
            value={(form as Record<string, unknown>)[`body_${activeLang}`] as string || ''}
            onChange={(v) => setField(`body_${activeLang}` as keyof BlogPostItem, v as never)}
            dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
            placeholder={activeLang === 'ar' ? 'محتوى المقال بصيغة Markdown…' : 'Post body in Markdown…'}
          />

          {/* SEO overrides — collapsed by default to keep the editor uncluttered */}
          <details style={{ marginTop: 18 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('seoOverrides', { lang: activeLang.toUpperCase() })}</summary>
            <div style={{ marginTop: 10 }}>
              <label className="adm-label">{t('metaTitle')}</label>
              <input
                type="text"
                className="adm-input"
                value={(form as Record<string, unknown>)[`meta_title_${activeLang}`] as string || ''}
                onChange={(e) => setField(`meta_title_${activeLang}` as keyof BlogPostItem, e.target.value as never)}
                dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
              />
              <label className="adm-label" style={{ marginTop: 10 }}>{t('metaDescription')}</label>
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
            <h3 style={{ margin: '0 0 12px' }}>{t('publishing')}</h3>

            <label className="adm-label">{tc('status')}</label>
            <select
              className="adm-input"
              value={form.status || 'draft'}
              onChange={(e) => setField('status', e.target.value as BlogPostItem['status'])}
            >
              <option value="draft">{t('optDraft')}</option>
              <option value="published">{t('optPublished')}</option>
              <option value="scheduled">{t('optScheduled')}</option>
            </select>
            <p style={{ fontSize: 12, color: 'var(--adm-text-dim)', margin: '6px 0 0' }}>{prerenderNote()}</p>

            {form.status === 'scheduled' && (
              <>
                <label className="adm-label" style={{ marginTop: 10 }}>{t('publishAt')}</label>
                <input
                  type="datetime-local"
                  className="adm-input"
                  value={toDatetimeLocalValue(form.publish_at)}
                  onChange={(e) => setField('publish_at', fromDatetimeLocalValue(e.target.value) || null)}
                />
              </>
            )}

            <label className="adm-label" style={{ marginTop: 10 }}>{t('publishedDate')}</label>
            <input
              type="date"
              className="adm-input"
              value={form.published_at?.slice(0, 10) || ''}
              // Clearing the field gave new Date('') → toISOString() threw
              // a RangeError and blanked the editor (unsaved work lost).
              onChange={(e) => {
                const date = new Date(e.target.value);
                if (!Number.isNaN(date.getTime())) setField('published_at', date.toISOString());
              }}
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(form.featured)}
                onChange={(e) => setField('featured', e.target.checked ? 1 : 0)}
              />
              {t('featured')}
            </label>
          </div>

          {/* Category */}
          <div className="adm-card">
            <h3 style={{ margin: '0 0 12px' }}>{t('category')}</h3>
            <select
              className="adm-input"
              value={form.category_id || ''}
              onChange={(e) => setField('category_id', e.target.value || null)}
            >
              <option value="">{t('noCategory')}</option>
              {categories.filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name_en || c.name_ar}
                </option>
              ))}
            </select>
            <p style={{ fontSize: 12, color: 'var(--adm-text-dim)', margin: '8px 0 0' }}>
              <Link to="/admin/blog/categories" style={{ color: 'var(--adm-accent)' }}>
                {t('manageCategories')}
              </Link>
            </p>
          </div>

          {/* Slug + author */}
          <div className="adm-card">
            <label className="adm-label">{t('slugLabel')}</label>
            <input
              type="text"
              className="adm-input"
              dir="ltr"
              value={form.slug || ''}
              // Partial while typing (keeps a trailing dash so "my slug"
              // can be typed), fully normalised when leaving the field.
              onChange={(e) => setField('slug', normalizeSlug(e.target.value, { partial: true }))}
              onBlur={(e) => setField('slug', normalizeSlug(e.target.value))}
              placeholder={t('slugPlaceholder')}
            />

            <label className="adm-label" style={{ marginTop: 10 }}>{t('authorName')}</label>
            <input
              type="text"
              className="adm-input"
              dir="auto"
              value={form.author_name || ''}
              onChange={(e) => setField('author_name', e.target.value)}
            />

            <label className="adm-label" style={{ marginTop: 10 }}>{t('readingTime')}</label>
            <input
              type="number"
              className="adm-input"
              dir="ltr"
              min={1}
              value={form.reading_time || 0}
              onChange={(e) => {
                setReadingTimeTouched(true);
                setField('reading_time', parseInt(e.target.value, 10) || 0);
              }}
            />
          </div>

          {/* Images */}
          <div className="adm-card">
            <h3 style={{ margin: '0 0 12px' }}>{t('images')}</h3>
            <label className="adm-label">{t('thumbnail')}</label>
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
              dir="ltr"
              style={{ marginTop: 6 }}
              value={form.image || ''}
              onChange={(e) => setField('image', e.target.value)}
              placeholder={t('pasteUrl')}
            />

            <label className="adm-label" style={{ marginTop: 14 }}>{t('hero')}</label>
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
              dir="ltr"
              style={{ marginTop: 6 }}
              value={form.hero_image || ''}
              onChange={(e) => setField('hero_image', e.target.value)}
              placeholder={t('heroPlaceholder')}
            />
          </div>

          {/* Tags */}
          <div className="adm-card">
            <h3 style={{ margin: '0 0 12px' }}>{t('tags')}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {(form.tags || []).map((tag) => (
                <span key={tag} dir="auto" style={{ background: 'var(--adm-bg-3)', padding: '4px 10px', borderRadius: 999, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--adm-text-dim)' }}
                    aria-label={t('removeTag', { tag })}
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
                placeholder={t('tagPlaceholder')}
                dir="auto"
                aria-label={t('newTag')}
              />
              <button type="button" className="adm-btn adm-btn-ghost" onClick={addTag} aria-label={t('addTag')} title={t('addTag')}>+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
