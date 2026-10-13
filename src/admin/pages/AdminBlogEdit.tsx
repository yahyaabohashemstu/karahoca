import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi, type BlogPostItem, type BlogCategoryItem } from '../utils/adminApi';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { resolveAdminImage } from '../../utils/image';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../utils/datetimeLocal';
import { normalizeSlug } from '../utils/slug';
import { prerenderNote, confirmPastSchedule, confirmSlugChange } from '../utils/publishing';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { getCurrentAdminLang } from '../i18n/currentLang';
import { Alert, Badge, Button, Card, Field, IconButton, LangLabel, Loading, NumberInput, PageHeader, SectionTitle, Tabs } from '../ui';

const messages = defineMessages({
  en: {
    loadFailed: 'Failed to load post',
    uploadFailed: 'Upload failed: {error}',
    titleRequired: 'Please provide at least an Arabic or English title.',
    slugInvalid: 'The slug must contain at least one letter or digit.',
    newPost: 'New post',
    editPost: 'Edit post',
    backToPosts: 'Blog',
    savedBadge: 'Saved',
    savePost: 'Save post',
    deletedBanner: 'This post was deleted and is hidden from the site. Saving it as Published or Scheduled will put it back on the site.',
    contentLanguage: 'Content language',
    titleLabel: 'Title',
    excerptLabel: 'Excerpt (short summary, 1-2 lines)',
    bodyLabel: 'Body (markdown)',
    seoOverrides: 'SEO overrides ({lang})',
    showSeo: 'Show',
    hideSeo: 'Hide',
    metaTitle: 'Meta title (defaults to Title if empty)',
    metaDescription: 'Meta description (defaults to Excerpt if empty)',
    publishing: 'Publishing',
    publishAt: 'Publish at (your local time)',
    publishedDate: 'Published date',
    featured: 'Featured (shown in hero strip)',
    category: 'Category',
    noCategory: '— No category —',
    manageCategories: 'Manage categories',
    urlAndDetails: 'URL & details',
    slugLabel: 'Slug (URL path)',
    slugPlaceholder: 'auto-generated if blank',
    authorName: 'Author name',
    readingTime: 'Reading time (minutes)',
    readingTimeHint: 'Recalculated on save unless you change it.',
    images: 'Images',
    thumbnail: 'Thumbnail (card)',
    pasteUrl: 'Paste an image URL',
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
    backToPosts: 'المدونة',
    savedBadge: 'تم الحفظ',
    savePost: 'حفظ المقال',
    deletedBanner: 'هذا المقال محذوف ومخفي عن الموقع. حفظه بحالة «منشور» أو «مجدول» يعيده إلى الموقع.',
    contentLanguage: 'لغة المحتوى',
    titleLabel: 'العنوان',
    excerptLabel: 'الملخص (موجز قصير في سطر أو سطرين)',
    bodyLabel: 'النص (Markdown)',
    // ‏ keeps the bracket after the Latin "SEO" in right-to-left text.
    seoOverrides: 'تخصيص SEO ‏({lang})',
    showSeo: 'إظهار',
    hideSeo: 'إخفاء',
    metaTitle: 'عنوان الميتا (يُستخدم العنوان إذا تُرك فارغًا)',
    metaDescription: 'وصف الميتا (يُستخدم الملخص إذا تُرك فارغًا)',
    publishing: 'النشر',
    publishAt: 'موعد النشر (بالتوقيت المحلي للجهاز)',
    publishedDate: 'تاريخ النشر',
    featured: 'مميّز (يظهر في الشريط الرئيسي)',
    category: 'الفئة',
    noCategory: '— بلا فئة —',
    manageCategories: 'إدارة الفئات',
    urlAndDetails: 'الرابط والتفاصيل',
    slugLabel: 'الـ slug (مسار الرابط)',
    slugPlaceholder: 'يُولَّد تلقائيًا إذا تُرك فارغًا',
    authorName: 'اسم الكاتب',
    readingTime: 'مدة القراءة (بالدقائق)',
    readingTimeHint: 'تُحسب من جديد عند الحفظ ما لم تُعدَّل يدويًا.',
    images: 'الصور',
    thumbnail: 'الصورة المصغّرة (البطاقة)',
    pasteUrl: 'الصق رابط الصورة',
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

// Each content language named in itself, whatever the admin language.

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

type ImageField = 'image' | 'hero_image';

export const AdminBlogEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const t = useT(messages);
  const tc = useT(common);

  const [form, setForm] = useState<Partial<BlogPostItem>>(EMPTY);
  const [categories, setCategories] = useState<BlogCategoryItem[]>([]);
  const [activeLang, setActiveLang] = useState<Lang>('ar');
  const [seoOpen, setSeoOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  // Which image is uploading (both upload buttons wait for it).
  const [uploading, setUploading] = useState<ImageField | null>(null);
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
  const thumbFileRef = useRef<HTMLInputElement>(null);
  const heroFileRef = useRef<HTMLInputElement>(null);
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

  const handleImageUpload = async (which: ImageField, file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result;
      if (typeof result !== 'string') return;
      const base64 = result.split(',')[1];
      setUploading(which);
      setError(null);
      try {
        // Through adminApi, not a bare fetch('/api/…'): a relative URL hit
        // the web origin (nginx) instead of the API host in production, so
        // blog image uploads always failed — and silently, since a non-OK
        // response was never reported.
        const data = await adminApi.uploadImage(base64, file.name);
        if (data?.url) setField(which, data.url);
      } catch (err) {
        setError(t('uploadFailed', { error: err instanceof Error ? err.message : String(err) }));
      } finally {
        setUploading(null);
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

  if (!loaded) return <Loading label={tc('loading')} />;

  const langDir = activeLang === 'ar' ? 'rtl' : 'ltr';
  const langValue = (prefix: string) => (form as Record<string, unknown>)[`${prefix}_${activeLang}`] as string || '';
  const setLangValue = (prefix: string, value: string) =>
    setField(`${prefix}_${activeLang}` as keyof BlogPostItem, value as never);

  /**
   * One image: URL field, an Upload button (with its hidden file picker)
   * next to the label, and the preview under the field.
   */
  const imageField = (which: ImageField, label: string, placeholder: string, showPreview: boolean) => {
    const fileRef = which === 'image' ? thumbFileRef : heroFileRef;
    return (
      <Field
        label={label}
        labelAction={(
          <>
            <Button
              size="sm"
              icon="upload"
              onClick={() => fileRef.current?.click()}
              loading={uploading === which}
              disabled={uploading !== null}
            >
              {uploading === which ? tc('uploading') : tc('upload')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(which, f); e.target.value = ''; }}
            />
          </>
        )}
        hint={showPreview && form[which] ? (
          <img src={resolveAdminImage(form[which] as string)} alt="" className="adm-thumb" style={{ width: '100%', height: 'auto' }} />
        ) : undefined}
      >
        <input
          type="text"
          className="adm-input"
          dir="ltr"
          value={form[which] || ''}
          onChange={(e) => setField(which, e.target.value)}
          placeholder={placeholder}
        />
      </Field>
    );
  };

  return (
    <div>
      <PageHeader
        title={isNew ? t('newPost') : t('editPost')}
        back={{ to: '/admin/blog', label: t('backToPosts') }}
        actions={(
          <>
            {/* Saving keeps the editor open, so without this nothing showed
                that it had worked. */}
            {savedFlash && (
              <span role="status"><Badge tone="success" icon="check">{t('savedBadge')}</Badge></span>
            )}
            <Button variant="primary" icon="save" loading={saving} onClick={handleSave}>
              {saving ? tc('saving') : t('savePost')}
            </Button>
          </>
        )}
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {stored && !stored.active && stored.status !== 'draft' && (
        <Alert tone="warning">{t('deletedBanner')}</Alert>
      )}

      <div className="adm-editor-layout">
        {/* Main column */}
        <Card>
          <div className="adm-mb-16">
            <Tabs
              variant="segmented"
              ariaLabel={t('contentLanguage')}
              value={activeLang}
              onChange={setActiveLang}
              items={LANGS.map((l) => ({ value: l, label: <LangLabel lang={l} /> }))}
            />
          </div>

          {/* Placeholders follow the field's language, not the admin's,
              like the text typed into it. */}
          <Field label={t('titleLabel')}>
            <input
              type="text"
              className="adm-input"
              value={langValue('title')}
              onChange={(e) => setLangValue('title', e.target.value)}
              placeholder={activeLang === 'ar' ? 'عنوان المقال…' : 'Post title…'}
              dir={langDir}
            />
          </Field>

          <Field label={t('excerptLabel')}>
            <textarea
              className="adm-textarea"
              rows={3}
              value={langValue('excerpt')}
              onChange={(e) => setLangValue('excerpt', e.target.value)}
              placeholder={activeLang === 'ar' ? 'ملخص قصير يظهر في بطاقة المقال…' : 'Short summary shown in the post card…'}
              dir={langDir}
            />
          </Field>

          <Field label={t('bodyLabel')}>
            <MarkdownEditor
              value={langValue('body')}
              onChange={(v) => setLangValue('body', v)}
              dir={langDir}
              placeholder={activeLang === 'ar' ? 'محتوى المقال بصيغة Markdown…' : 'Post body in Markdown…'}
            />
          </Field>

          {/* SEO overrides — collapsed by default to keep the editor uncluttered */}
          <SectionTitle
            icon="search"
            actions={(
              <Button
                variant="ghost"
                size="sm"
                iconEnd={seoOpen ? 'chevronUp' : 'chevronDown'}
                aria-expanded={seoOpen}
                onClick={() => setSeoOpen((open) => !open)}
              >
                {seoOpen ? t('hideSeo') : t('showSeo')}
              </Button>
            )}
          >
            {t('seoOverrides', { lang: activeLang.toUpperCase() })}
          </SectionTitle>
          {seoOpen && (
            <>
              <Field label={t('metaTitle')}>
                <input
                  type="text"
                  className="adm-input"
                  value={langValue('meta_title')}
                  onChange={(e) => setLangValue('meta_title', e.target.value)}
                  dir={langDir}
                />
              </Field>
              <Field label={t('metaDescription')}>
                <textarea
                  className="adm-textarea"
                  rows={2}
                  value={langValue('meta_description')}
                  onChange={(e) => setLangValue('meta_description', e.target.value)}
                  dir={langDir}
                />
              </Field>
            </>
          )}
        </Card>

        {/* Side column */}
        <div className="adm-stack">
          <Card title={t('publishing')} icon="send">
            <Field label={tc('status')} hint={prerenderNote()}>
              <select
                className="adm-select"
                value={form.status || 'draft'}
                onChange={(e) => setField('status', e.target.value as BlogPostItem['status'])}
              >
                <option value="draft">{tc('draft')}</option>
                <option value="published">{tc('published')}</option>
                <option value="scheduled">{tc('scheduled')}</option>
              </select>
            </Field>

            {form.status === 'scheduled' && (
              <Field label={t('publishAt')}>
                <input
                  type="datetime-local"
                  className="adm-input"
                  value={toDatetimeLocalValue(form.publish_at)}
                  onChange={(e) => setField('publish_at', fromDatetimeLocalValue(e.target.value) || null)}
                />
              </Field>
            )}

            <Field label={t('publishedDate')}>
              <input
                type="date"
                className="adm-input"
                value={form.published_at?.slice(0, 10) || ''}
                // Clearing the field gave new Date(''), then toISOString() threw
                // a RangeError and blanked the editor (unsaved work lost).
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  if (!Number.isNaN(date.getTime())) setField('published_at', date.toISOString());
                }}
              />
            </Field>

            <label className="adm-check">
              <input
                type="checkbox"
                checked={Boolean(form.featured)}
                onChange={(e) => setField('featured', e.target.checked ? 1 : 0)}
              />
              {t('featured')}
            </label>
          </Card>

          <Card
            title={t('category')}
            icon="categories"
            actions={(
              <Button to="/admin/blog/categories" variant="ghost" size="sm" iconEnd="forward">
                {t('manageCategories')}
              </Button>
            )}
          >
            <select
              className="adm-select"
              aria-label={t('category')}
              value={form.category_id || ''}
              onChange={(e) => setField('category_id', e.target.value || null)}
            >
              <option value="">{t('noCategory')}</option>
              {categories.filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id}>{c.name_en || c.name_ar}</option>
              ))}
            </select>
          </Card>

          <Card title={t('urlAndDetails')} icon="link">
            <Field label={t('slugLabel')}>
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
            </Field>

            <Field label={t('authorName')}>
              <input
                type="text"
                className="adm-input"
                dir="auto"
                value={form.author_name || ''}
                onChange={(e) => setField('author_name', e.target.value)}
              />
            </Field>

            <Field label={t('readingTime')} hint={t('readingTimeHint')}>
              <NumberInput
                className="adm-input"
                min={1}
                value={form.reading_time || 0}
                onChange={(e) => {
                  setReadingTimeTouched(true);
                  setField('reading_time', parseInt(e.target.value, 10) || 0);
                }}
              />
            </Field>
          </Card>

          <Card title={t('images')} icon="image">
            {imageField('image', t('thumbnail'), t('pasteUrl'), true)}
            {imageField('hero_image', t('hero'), t('heroPlaceholder'), form.hero_image !== form.image)}
          </Card>

          <Card title={t('tags')} icon="tag">
            {(form.tags || []).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {(form.tags || []).map((tag) => (
                  <span key={tag} className="adm-flex" style={{ gap: 2 }}>
                    <Badge tone="neutral"><bdi>#{tag}</bdi></Badge>
                    <IconButton icon="close" size="sm" label={t('removeTag', { tag })} onClick={() => removeTag(tag)} />
                  </span>
                ))}
              </div>
            )}
            <div className="adm-flex">
              <input
                type="text"
                className="adm-input"
                style={{ flex: 1, minWidth: 0 }}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder={t('tagPlaceholder')}
                dir="auto"
                aria-label={t('newTag')}
              />
              <IconButton icon="plus" label={t('addTag')} onClick={addTag} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
