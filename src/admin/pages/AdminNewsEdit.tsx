import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi, type NewsItem } from '../utils/adminApi';
import { TranslationHelper } from '../components/TranslationHelper';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { resolveAdminImage } from '../../utils/image';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../utils/datetimeLocal';
import { normalizeSlug } from '../utils/slug';
import { prerenderNote, confirmPastSchedule, confirmSlugChange } from '../utils/publishing';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { Alert, Button, Card, Field, LangLabel, Loading, PageHeader, Tabs } from '../ui';

const messages = defineMessages({
  en: {
    unsupportedType: 'Unsupported file type. Use JPG, PNG, WebP, or GIF.',
    tooLarge: 'File too large. Maximum size is 10 MB.',
    uploadFailed: 'Upload failed',
    requiredFields: 'Please fill required fields: Arabic title and slug (letters or digits).',
    saveFailed: 'Save failed',
    newArticle: 'New article',
    editArticle: 'Edit article',
    backToNews: 'News',
    saveArticle: 'Save article',
    articleInfo: 'Article info',
    slugLabel: 'Slug (URL)',
    imagePlaceholder: '/news/image.webp or paste URL',
    publishedDate: 'Published date',
    optPublished: 'Published — visible to everyone',
    optDraft: 'Draft — hidden, work in progress',
    optScheduled: 'Scheduled — auto-publish at set time',
    publishAt: 'Publish date & time',
    publishAtHelp: 'Article will be published automatically at this time (your local time).',
    imagePreview: 'Image preview',
    previewAlt: 'preview',
    content: 'Content',
    contentLanguage: 'Content language',
    categoryLabel: 'Category ({lang})',
    categoryPlaceholder: 'e.g. Announcement',
    titleLabel: 'Title ({lang})',
    excerptLabel: 'Excerpt ({lang})',
    bodyLabel: 'Body ({lang})',
    bodyHint: 'Supports **bold**, *italic*, # headings, lists, [links](url), > quotes',
  },
  ar: {
    unsupportedType: 'نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP أو GIF.',
    tooLarge: 'الملف كبير جدًا. الحد الأقصى للحجم 10 ميغابايت.',
    uploadFailed: 'فشل الرفع',
    requiredFields: 'يُرجى تعبئة الحقول المطلوبة: العنوان العربي والـ slug (أحرف أو أرقام).',
    saveFailed: 'فشل الحفظ',
    newArticle: 'خبر جديد',
    editArticle: 'تعديل الخبر',
    backToNews: 'الأخبار',
    saveArticle: 'حفظ الخبر',
    articleInfo: 'بيانات الخبر',
    slugLabel: 'الـ slug (الرابط)',
    imagePlaceholder: '/news/image.webp أو الصق رابطًا',
    publishedDate: 'تاريخ النشر',
    optPublished: 'منشور — ظاهر للجميع',
    optDraft: 'مسودة — مخفي، قيد الإعداد',
    optScheduled: 'مجدول — يُنشر تلقائيًا في الوقت المحدد',
    publishAt: 'تاريخ النشر ووقته',
    publishAtHelp: 'سيُنشر الخبر تلقائيًا في هذا الوقت (بالتوقيت المحلي للجهاز).',
    imagePreview: 'معاينة الصورة',
    previewAlt: 'معاينة',
    content: 'المحتوى',
    contentLanguage: 'لغة المحتوى',
    categoryLabel: 'الفئة ({lang})',
    categoryPlaceholder: 'مثال: إعلان',
    titleLabel: 'العنوان ({lang})',
    excerptLabel: 'الملخص ({lang})',
    bodyLabel: 'النص ({lang})',
    // \u2066…\u2069 isolate the Markdown samples so brackets and asterisks
    // stay in place inside right-to-left text.
    bodyHint: 'يدعم: \u2066**bold**\u2069، \u2066*italic*\u2069، \u2066#\u2069 للعناوين، القوائم، \u2066[links](url)\u2069، \u2066>\u2069 للاقتباس',
  },
});

const LANGS = ['ar', 'en', 'tr', 'ru'] as const;
type Lang = typeof LANGS[number];

// Each content language named in itself, whatever the admin language
// (as in the blog editor).

// The Arabic copy is the one TranslationHelper translates from.
const SOURCE_LANG: Lang = 'ar';

/** Trailing whitespace off the end of a body, applied only when saving. */
const trimBody = (paragraphs: string[] | undefined): string[] => {
  const out = [...(paragraphs ?? [])];
  while (out.length > 0 && !out[out.length - 1].trim()) out.pop();
  if (out.length > 0) out[out.length - 1] = out[out.length - 1].replace(/\s+$/, '');
  return out;
};

const EMPTY: Partial<NewsItem> = {
  slug: '', image: '', published_at: new Date().toISOString().split('T')[0],
  status: 'published', publish_at: null,
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
  const t = useT(messages);
  const tc = useT(common);

  const [form, setForm] = useState<Partial<NewsItem>>(EMPTY);
  const [activeLang, setActiveLang] = useState<Lang>('ar');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  // The article as loaded: whether it is live, and its slug, decide if a
  // slug edit needs a "links will break" confirmation.
  const [loaded, setLoaded] = useState<NewsItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isNew) {
      adminApi.getNewsItem(id!).then(r => {
        setForm(r.item);
        setLoaded(r.item);
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

  /**
   * The body is stored on the API as `string[]` (one paragraph per
   * element) for backward compatibility with the original news pages
   * that rendered each entry as a plain <p>. With the markdown editor
   * we now author the body as ONE block of markdown, so:
   *
   *   - getBodyText joins existing arrays with \n\n so legacy entries
   *     keep working when the admin opens them for editing.
   *   - setBodyText stores the WHOLE markdown as a single-element array
   *     [fullMarkdown]. Public NewsArticlePage joins on \n\n before
   *     rendering, so a single element or N elements both yield the
   *     same react-markdown input.
   */
  const getBodyText = (lang: Lang): string =>
    (form[`body_${lang}` as keyof NewsItem] as string[] | undefined)?.join('\n\n') ?? '';

  const setBodyText = (lang: Lang, text: string) => {
    // Store the text exactly as typed. It used to be trimmed here, on
    // every keystroke, so a space or Enter typed at the end vanished at
    // once — you could not start a new word or paragraph at the end of
    // the body. trimBody() runs when the save payload is built instead.
    // Wrapping in a single-element array keeps the API contract unchanged.
    const payload = text ? [text] : [];
    set(`body_${lang}` as keyof NewsItem, payload as unknown as NewsItem[keyof NewsItem]);
  };

  const handleTranslated = (translations: Record<string, Record<string, string>>) => {
    const updates: Partial<NewsItem> = {};
    for (const [field, langs] of Object.entries(translations)) {
      for (const [lang, value] of Object.entries(langs)) {
        // Never overwrite the text the admin translated from.
        if (lang === SOURCE_LANG) continue;
        if (field === 'body') {
          // One markdown block, like setBodyText: splitting on blank lines
          // and trimming each piece broke indented / fenced code blocks.
          const text = value.replace(/\s+$/, '');
          (updates as Record<string, string[]>)[`body_${lang}`] = text ? [text] : [];
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
      setError(t('unsupportedType'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t('tooLarge'));
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
      if (!data.success) throw new Error(t('uploadFailed'));
      setStr('image', data.url || data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const slug = normalizeSlug(form.slug);
    if (!form.title_ar || !slug) {
      setError(t('requiredFields'));
      return;
    }
    const wasLive = loaded?.status === 'published' && Boolean(loaded.active);
    if (!confirmSlugChange('article', wasLive, loaded?.slug, slug)) return;
    if (!confirmPastSchedule(form.status, form.publish_at)) return;
    const payload: Partial<NewsItem> = { ...form, slug };
    for (const l of LANGS) payload[`body_${l}`] = trimBody(form[`body_${l}`]);
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await adminApi.createNews(payload);
      } else {
        await adminApi.updateNews(id!, payload);
      }
      navigate('/admin/news');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label={tc('loading')} />;

  return (
    <div>
      <PageHeader
        title={isNew ? t('newArticle') : t('editArticle')}
        back={{ to: '/admin/news', label: t('backToNews') }}
        actions={(
          <Button variant="primary" icon="save" loading={saving} onClick={handleSave}>
            {saving ? tc('saving') : t('saveArticle')}
          </Button>
        )}
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="adm-grid-2" style={{ alignItems: 'start' }}>
        {/* Left: metadata */}
        <div className="adm-stack">
          <Card title={t('articleInfo')} icon="news">
            <Field label={t('slugLabel')} required>
              <input
                className="adm-input"
                dir="ltr"
                value={form.slug ?? ''}
                // Partial while typing (keeps a trailing dash so "my slug"
                // can be typed), fully normalised when leaving the field.
                onChange={e => setStr('slug', normalizeSlug(e.target.value, { partial: true }))}
                onBlur={e => setStr('slug', normalizeSlug(e.target.value))}
                placeholder="my-news-article"
              />
            </Field>
            <Field
              label={tc('image')}
              labelAction={(
                <>
                  <Button
                    size="sm"
                    icon="upload"
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploading}
                  >
                    {uploading ? tc('uploading') : tc('upload')}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }}
                  />
                </>
              )}
            >
              <input
                className="adm-input"
                dir="ltr"
                value={form.image ?? ''}
                onChange={e => setStr('image', e.target.value)}
                placeholder={t('imagePlaceholder')}
              />
            </Field>
            <Field label={t('publishedDate')}>
              <input
                className="adm-input"
                type="date"
                value={form.published_at ? form.published_at.split('T')[0] : ''}
                onChange={e => setStr('published_at', e.target.value)}
              />
            </Field>
            <Field label={tc('status')} hint={prerenderNote()}>
              <select
                className="adm-select"
                value={form.status ?? 'published'}
                onChange={e => setStr('status', e.target.value as NewsItem['status'])}
              >
                <option value="published">{t('optPublished')}</option>
                <option value="draft">{t('optDraft')}</option>
                <option value="scheduled">{t('optScheduled')}</option>
              </select>
            </Field>
            {form.status === 'scheduled' && (
              <Field label={t('publishAt')} hint={t('publishAtHelp')}>
                <input
                  className="adm-input"
                  type="datetime-local"
                  value={toDatetimeLocalValue(form.publish_at)}
                  onChange={e => setStr('publish_at', fromDatetimeLocalValue(e.target.value))}
                />
              </Field>
            )}
          </Card>

          {form.image && (
            <Card title={t('imagePreview')} icon="image">
              <img
                src={resolveAdminImage(form.image)}
                alt={t('previewAlt')}
                className="adm-thumb"
                style={{ width: '100%', height: 160 }}
              />
            </Card>
          )}
        </div>

        {/* Right: multilingual content */}
        <Card
          title={t('content')}
          icon="language"
          actions={(
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
          )}
        >
          <div className="adm-mb-16">
            <Tabs
              variant="segmented"
              ariaLabel={t('contentLanguage')}
              value={activeLang}
              onChange={setActiveLang}
              items={LANGS.map(l => ({ value: l, label: <LangLabel lang={l} /> }))}
            />
          </div>

          {LANGS.map(l => (
            <div key={l} hidden={activeLang !== l}>
              <Field label={t('categoryLabel', { lang: l.toUpperCase() })}>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`category_${l}`] ?? ''}
                  onChange={e => setStr(`category_${l}` as keyof NewsItem, e.target.value)}
                  placeholder={t('categoryPlaceholder')}
                />
              </Field>
              {/* Only the Arabic title is required (see handleSave). */}
              <Field label={t('titleLabel', { lang: l.toUpperCase() })} required={l === SOURCE_LANG}>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`title_${l}`] ?? ''}
                  onChange={e => setStr(`title_${l}` as keyof NewsItem, e.target.value)}
                />
              </Field>
              <Field label={t('excerptLabel', { lang: l.toUpperCase() })}>
                <textarea
                  className="adm-textarea"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  rows={2}
                  value={(form as Record<string, string>)[`excerpt_${l}`] ?? ''}
                  onChange={e => setStr(`excerpt_${l}` as keyof NewsItem, e.target.value)}
                />
              </Field>
              <Field label={t('bodyLabel', { lang: l.toUpperCase() })} hint={t('bodyHint')}>
                <MarkdownEditor
                  value={getBodyText(l)}
                  onChange={(text) => setBodyText(l, text)}
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  rows={12}
                />
              </Field>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};
