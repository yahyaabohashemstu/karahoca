import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi, type Product, type ProductCategory } from '../utils/adminApi';
import { TranslationHelper } from '../components/TranslationHelper';
import { AiDescriptionDialog } from '../components/AiDescriptionDialog';
import { ImageCropperDialog } from '../components/ImageCropperDialog';
import { resolveAdminImage } from '../../utils/image';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../utils/datetimeLocal';
import { confirmPastSchedule, prerenderNote } from '../utils/publishing';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { Alert, Button, Card, EmptyState, Field, IconButton, LangLabel, Loading, NumberInput, PageHeader, Tabs } from '../ui';

const messages = defineMessages({
  en: {
    errUnsupportedType: 'Unsupported file type. Use JPG, PNG, WebP, or GIF.',
    errGalleryTooLarge: 'File too large. Maximum 10 MB.',
    errImageTooLarge: 'File too large. Maximum size is 10 MB.',
    uploadFailed: 'Upload failed',
    errRequired: 'Please fill required fields: Arabic name, brand, and category.',
    saveFailed: 'Save failed',
    newProduct: 'New product',
    editProduct: 'Edit product',
    backToProducts: 'Products',
    waitForUpload: 'Wait for the image upload to finish',
    saveProduct: 'Save product',
    productInfo: 'Product info',
    brand: 'Brand',
    category: 'Category',
    selectOption: '— Select —',
    imagePlaceholder: '/products/image.webp or paste URL',
    cropUploadTitle: 'Open the image in a cropper before uploading',
    cropUpload: 'Crop & upload',
    weightVolume: 'Weight / volume',
    weightPlaceholder: 'e.g. 500ml',
    weightCountTable: 'Weight / count table',
    hideTable: 'Hide table',
    addTable: 'Add table',
    countPerBox: 'Count (per box)',
    rowWeightPlaceholder: 'e.g. 1.2 kg',
    rowCountPlaceholder: 'e.g. 6',
    removeRowLabel: 'Remove row {n}',
    addRow: 'Add row',
    clearTable: 'Clear table',
    displayOrder: 'Display order',
    publishingStatus: 'Publishing status',
    statusPublished: 'Published — visible to everyone',
    statusDraft: 'Draft — hidden, work in progress',
    statusScheduled: 'Scheduled — auto-publish at set time',
    publishAt: 'Publish at',
    publishAtHelp: 'The product will appear in the public catalogue automatically at this time (your local time). The catalogue cache is busted on flip.',
    imagePreview: 'Image preview',
    imageScale: 'Image scale',
    previewAlt: 'preview',
    previewName: 'Product name',
    previewDescription: 'Description',
    galleryImages: 'Gallery images',
    addImage: 'Add image',
    noGallery: 'No gallery images.',
    noGalleryText: 'Use "Add Image" to add colour variants or extra views.',
    galleryAlt: 'gallery-{index}',
    galleryPlaceholder: 'Image path or URL #{n}',
    uploadGalleryLabel: 'Upload gallery image {n} without cropping',
    cropGalleryLabel: 'Crop and upload gallery image {n}',
    removeGalleryLabel: 'Remove gallery image {n}',
    storeListings: 'Online store listings',
    storeListingsHelp: 'This product\'s own page on the brand\'s store. The site\'s "buy online" buttons in the product window open it — currently shown on the Turkish and Arabic AYLUX pages. Leave empty to send buyers to the store\'s main page.',
    trendyolListing: 'Trendyol listing',
    hepsiburadaListing: 'Hepsiburada listing',
    openListingTitle: 'Open the listing in a new tab to check it',
    openListing: 'Open',
    content: 'Content',
    contentLanguage: 'Content language',
    nameLabel: 'Name ({lang})',
    descriptionLabel: 'Description ({lang})',
    aiWriteTitle: 'Generate a draft description in all 4 languages from the product name + an optional hint',
    aiWrite: 'AI write',
    altLabel: 'Image Alt ({lang})',
    materialLabel: 'Material ({lang})',
    countLabel: 'Count / Package ({lang})',
    giftLabel: 'Free gift ({lang}) — optional',
  },
  ar: {
    errUnsupportedType: 'نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP أو GIF.',
    errGalleryTooLarge: 'الملف كبير جدًا. الحد الأقصى 10 ميغابايت.',
    errImageTooLarge: 'الملف كبير جدًا. الحد الأقصى للحجم 10 ميغابايت.',
    uploadFailed: 'فشل الرفع',
    errRequired: 'املأ الحقول المطلوبة: الاسم بالعربية، والعلامة التجارية، والفئة.',
    saveFailed: 'فشل الحفظ',
    newProduct: 'منتج جديد',
    editProduct: 'تعديل المنتج',
    backToProducts: 'المنتجات',
    waitForUpload: 'انتظر حتى يكتمل رفع الصورة',
    saveProduct: 'حفظ المنتج',
    productInfo: 'بيانات المنتج',
    brand: 'العلامة التجارية',
    category: 'الفئة',
    selectOption: '— اختر —',
    imagePlaceholder: '/products/image.webp أو الصق رابطًا',
    cropUploadTitle: 'فتح الصورة في أداة القص قبل رفعها',
    cropUpload: 'قص ورفع',
    weightVolume: 'الوزن / الحجم',
    weightPlaceholder: 'مثال: 500ml',
    weightCountTable: 'جدول الوزن / العدد',
    hideTable: 'إخفاء الجدول',
    addTable: 'إضافة جدول',
    countPerBox: 'العدد (لكل صندوق)',
    rowWeightPlaceholder: 'مثال: 1.2 kg',
    rowCountPlaceholder: 'مثال: 6',
    removeRowLabel: 'إزالة الصف {n}',
    addRow: 'إضافة صف',
    clearTable: 'مسح الجدول',
    displayOrder: 'ترتيب العرض',
    publishingStatus: 'حالة النشر',
    statusPublished: 'منشور — ظاهر للجميع',
    statusDraft: 'مسودة — مخفي، قيد الإعداد',
    statusScheduled: 'مجدول — يُنشر تلقائيًا في الوقت المحدد',
    publishAt: 'موعد النشر',
    publishAtHelp: 'سيظهر المنتج في الكتالوج العام تلقائيًا في هذا الوقت (بتوقيتك المحلي). ويُحدَّث التخزين المؤقت للكتالوج لحظة النشر.',
    imagePreview: 'معاينة الصورة',
    imageScale: 'حجم الصورة',
    previewAlt: 'معاينة',
    previewName: 'اسم المنتج',
    previewDescription: 'الوصف',
    galleryImages: 'صور المعرض',
    addImage: 'إضافة صورة',
    noGallery: 'لا توجد صور في المعرض.',
    noGalleryText: 'استخدم «إضافة صورة» لإضافة ألوان أخرى للمنتج أو لقطات إضافية.',
    galleryAlt: 'صورة المعرض {n}',
    galleryPlaceholder: 'مسار الصورة أو رابطها #{n}',
    uploadGalleryLabel: 'رفع صورة المعرض {n} دون قص',
    cropGalleryLabel: 'قص صورة المعرض {n} ورفعها',
    removeGalleryLabel: 'إزالة صورة المعرض {n}',
    storeListings: 'صفحات المتاجر الإلكترونية',
    storeListingsHelp: 'صفحة هذا المنتج نفسه في متجر العلامة التجارية. تفتحها أزرار «اشترِ عبر الإنترنت» في نافذة المنتج على الموقع — وتظهر حاليًا في صفحات AYLUX التركية والعربية. اتركه فارغًا لتوجيه المشترين إلى الصفحة الرئيسية للمتجر.',
    trendyolListing: 'صفحة المنتج على Trendyol',
    hepsiburadaListing: 'صفحة المنتج على Hepsiburada',
    openListingTitle: 'فتح الصفحة في علامة تبويب جديدة للتحقق منها',
    openListing: 'فتح',
    content: 'المحتوى',
    contentLanguage: 'لغة المحتوى',
    nameLabel: 'الاسم ({lang})',
    descriptionLabel: 'الوصف ({lang})',
    aiWriteTitle: 'توليد مسودة وصف باللغات الأربع من اسم المنتج مع توجيه اختياري',
    aiWrite: 'كتابة بالذكاء الاصطناعي',
    altLabel: 'النص البديل للصورة ({lang})',
    materialLabel: 'المادة ({lang})',
    countLabel: 'العدد / العبوة ({lang})',
    giftLabel: 'هدية مجانية ({lang}) — اختياري',
  },
});

const LANGS = ['ar', 'en', 'tr', 'ru'] as const;
type Lang = typeof LANGS[number];

// The Arabic copy is the one TranslationHelper translates from.
const SOURCE_LANG: Lang = 'ar';

const parseGallery = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
};

const EMPTY: Partial<Product> = {
  brand: 'DIOX',
  name_ar: '', name_en: '', name_tr: '', name_ru: '',
  description_ar: '', description_en: '', description_tr: '', description_ru: '',
  alt_ar: '', alt_en: '', alt_tr: '', alt_ru: '',
  material_ar: '', material_en: '', material_tr: '', material_ru: '',
  count_ar: '', count_en: '', count_tr: '', count_ru: '',
  image: '', gallery: '', weight: '', weight_count_table: '', image_scale: 0.85, category_id: '', display_order: 0, active: 1,
  // D5 defaults — new products start as published so the existing
  // "create a product and it's live" flow keeps working. Admins flip
  // to draft / scheduled only when they want delayed reveal.
  status: 'published',
  publish_at: null,
};

// The product's own listing on each marketplace store. The public site's
// "buy online" buttons open these (falling back to the store's main page
// when empty); the server only accepts https links on the right domain.
const MARKETPLACE_URL_FIELDS = [
  {
    key: 'trendyol_url',
    labelKey: 'trendyolListing',
    placeholder: 'https://www.trendyol.com/aylux/...-p-123456789?merchantId=1277496',
  },
  {
    key: 'hepsiburada_url',
    labelKey: 'hepsiburadaListing',
    placeholder: 'https://www.hepsiburada.com/...-pm-HBC0000XXXXXX?magaza=AYLUX',
  },
] as const;

const hasWeightCountRows = (rawTable: string | null | undefined) => {
  if (!rawTable) {
    return false;
  }

  try {
    const parsedTable = JSON.parse(rawTable);
    return Array.isArray(parsedTable) && parsedTable.length > 0;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Unable to parse product weight-count table.', error);
    }
    return false;
  }
};

export const AdminProductEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const t = useT(messages);
  const tc = useT(common);

  const [form, setForm] = useState<Partial<Product>>(EMPTY);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [activeLang, setActiveLang] = useState<Lang>('ar');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Gallery slots with an upload in flight (one spinner per slot; several
  // uploads can run at once).
  const [uploadingSlots, setUploadingSlots] = useState<ReadonlySet<number>>(() => new Set());
  // In-flight gallery upload -> the slot it will fill. Kept in a ref so an
  // upload that finishes reads the slot's CURRENT index: removing a slot
  // above it shifts it down one, removing the slot itself cancels it.
  const pendingGalleryUploads = useRef(new Map<symbol, number>());
  const syncUploadingSlots = () => setUploadingSlots(new Set(pendingGalleryUploads.current.values()));
  const galleryFileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [showWCTable, setShowWCTable] = useState(false);
  // The AI description writer modal — opens with the current form's
  // name/brand/category pre-filled, lets the admin preview the
  // generated copy in all 4 languages, then optionally apply it to
  // the description_{ar,en,tr,ru} fields.
  const [aiDescOpen, setAiDescOpen] = useState(false);
  // Image cropper state. Two routing handles because the cropper can
  // be invoked from either the main-image picker OR a gallery slot;
  // the active target tells `handleCropped` where to write the result.
  // `null` for main image, otherwise the gallery index.
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropTarget, setCropTarget] = useState<'main' | number | null>(null);

  useEffect(() => {
    adminApi.getCategories().then(r => setCategories(r.categories));
    if (!isNew) {
      adminApi.getProduct(id!).then(r => {
        setForm(r.product);
        setShowWCTable(hasWeightCountRows(r.product.weight_count_table));
        setLoading(false);
      }).catch(e => {
        setError(e.message);
        setLoading(false);
      });
    }
  }, [id, isNew]);

  const set = (key: keyof Product, value: string | number) =>
    setForm(f => ({ ...f, [key]: value }));

  // ── Gallery helpers ──────────────────────────────────────────────────────
  const getGalleryImages = (): string[] => parseGallery(form.gallery);
  // Every change is a functional update of the LATEST gallery. They used
  // to rebuild the array from the `form` captured when the handler began,
  // so an upload finishing after another upload / add / remove wrote back
  // a stale list and silently dropped images.
  const updateGallery = (change: (imgs: string[]) => string[]) =>
    setForm(f => {
      const next = change(parseGallery(f.gallery));
      return { ...f, gallery: next.length > 0 ? JSON.stringify(next) : '' };
    });
  const addGallerySlot = () => updateGallery(a => [...a, '']);
  const removeGalleryImage = (idx: number) => {
    for (const [token, slot] of pendingGalleryUploads.current) {
      if (slot === idx) pendingGalleryUploads.current.delete(token);
      else if (slot > idx) pendingGalleryUploads.current.set(token, slot - 1);
    }
    syncUploadingSlots();
    updateGallery(a => a.filter((_, i) => i !== idx));
  };
  const updateGalleryImage = (idx: number, val: string) =>
    updateGallery(a => a.map((img, i) => (i === idx ? val : img)));
  const handleGalleryUpload = async (idx: number, file: File) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED.includes(file.type)) { setError(t('errUnsupportedType')); return; }
    if (file.size > 10 * 1024 * 1024) { setError(t('errGalleryTooLarge')); return; }
    const token = Symbol('gallery-upload');
    pendingGalleryUploads.current.set(token, idx);
    syncUploadingSlots();
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
      const slot = pendingGalleryUploads.current.get(token);
      // undefined: the slot was removed while the file was uploading.
      if (slot !== undefined) updateGalleryImage(slot, data.url || data.path);
    } catch (e) { setError(e instanceof Error ? e.message : t('uploadFailed')); }
    finally {
      pendingGalleryUploads.current.delete(token);
      syncUploadingSlots();
    }
  };

  // ── Weight-Count Table helpers ──────────────────────────────────────────
  interface WCRow { weight: string; count: number | string }
  const getWCRows = (): WCRow[] => {
    const raw = form.weight_count_table;
    if (!raw) return [];
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
  };
  const setWCRows = (rows: WCRow[]) =>
    setForm(f => ({ ...f, weight_count_table: rows.length > 0 ? JSON.stringify(rows) : '' }));
  const addWCRow = () => setWCRows([...getWCRows(), { weight: '', count: '' }]);
  const removeWCRow = (i: number) => { const r = [...getWCRows()]; r.splice(i, 1); setWCRows(r); };
  const updateWCRow = (i: number, field: 'weight' | 'count', val: string) => {
    const r = [...getWCRows()];
    r[i] = { ...r[i], [field]: field === 'count' ? (val === '' ? '' : Number(val)) : val };
    setWCRows(r);
  };

  const handleTranslated = (translations: Record<string, Record<string, string>>) => {
    const updates: Partial<Product> = {};
    for (const [field, langs] of Object.entries(translations)) {
      for (const [lang, value] of Object.entries(langs)) {
        // Never overwrite the text the admin translated from.
        if (lang === SOURCE_LANG) continue;
        (updates as Record<string, string>)[`${field}_${lang}`] = value;
      }
    }
    setForm(f => ({ ...f, ...updates }));
  };

  const handleSave = async () => {
    if (!form.name_ar || !form.brand || !form.category_id) {
      setError(t('errRequired'));
      return;
    }
    if (!confirmPastSchedule(form.status, form.publish_at)) return;
    setSaving(true);
    setError(null);
    try {
      // Clean empty gallery entries before saving
      const cleanForm = { ...form };
      if (cleanForm.gallery) {
        try {
          const imgs = JSON.parse(cleanForm.gallery).filter((s: string) => s.trim());
          cleanForm.gallery = imgs.length > 0 ? JSON.stringify(imgs) : '';
        } catch { /* leave as-is */ }
      }
      // Clean empty weight-count rows
      if (cleanForm.weight_count_table) {
        try {
          const rows = JSON.parse(cleanForm.weight_count_table)
            .filter((r: WCRow) => r.weight?.trim() && r.count !== '' && r.count !== undefined);
          cleanForm.weight_count_table = rows.length > 0 ? JSON.stringify(rows) : '';
        } catch { /* leave as-is */ }
      }
      if (isNew) {
        await adminApi.createProduct(cleanForm);
      } else {
        await adminApi.updateProduct(id!, cleanForm);
      }
      navigate('/admin/products');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(t('errUnsupportedType'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t('errImageTooLarge'));
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
      set('image', data.url || data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  /**
   * Called by the cropper when the admin confirms a crop. Routes the
   * resulting File to either the main image uploader or the gallery
   * uploader based on which surface opened the dialog.
   */
  const handleCropped = async (cropped: File) => {
    const target = cropTarget;
    setCropFile(null);
    setCropTarget(null);
    if (target === 'main') {
      await handleImageUpload(cropped);
    } else if (typeof target === 'number') {
      await handleGalleryUpload(target, cropped);
    }
  };

  const filteredCategories = categories.filter(c => !form.brand || c.brand === form.brand);

  if (loading) return <Loading label={tc('loading')} />;

  const gallery = getGalleryImages();
  const wcRows = getWCRows();
  const scalePct = Math.round((form.image_scale ?? 0.85) * 100);

  return (
    <div>
      <PageHeader
        title={isNew ? t('newProduct') : t('editProduct')}
        back={{ to: '/admin/products', label: t('backToProducts') }}
        actions={(
          // Saving navigates away, which would drop an image still uploading.
          <Button
            variant="primary"
            icon="save"
            onClick={handleSave}
            loading={saving}
            disabled={uploading || uploadingSlots.size > 0}
            title={uploading || uploadingSlots.size > 0 ? t('waitForUpload') : undefined}
          >
            {saving ? tc('saving') : t('saveProduct')}
          </Button>
        )}
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="adm-grid-2">
        {/* Left: metadata */}
        <div className="adm-stack">
          <Card title={t('productInfo')} icon="products">
            <Field label={t('brand')} required>
              <select className="adm-select" value={form.brand} onChange={e => { set('brand', e.target.value as 'DIOX' | 'AYLUX'); set('category_id', ''); }}>
                <option value="DIOX">DIOX</option>
                <option value="AYLUX">AYLUX</option>
              </select>
            </Field>
            <Field label={t('category')} required>
              <select className="adm-select" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                <option value="">{t('selectOption')}</option>
                {filteredCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.title_en} / {c.title_ar}</option>
                ))}
              </select>
            </Field>
            <Field
              label={tc('image')}
              labelAction={(
                <div className="adm-flex">
                  <Button
                    size="sm"
                    icon="upload"
                    onClick={() => {
                      // Clear a target left by a cancelled "Crop & upload"
                      // (closing the file picker doesn't fire onChange), or
                      // this plain upload would open the cropper.
                      setCropTarget(null);
                      fileInputRef.current?.click();
                    }}
                    loading={uploading}
                  >
                    {uploading ? tc('uploading') : tc('upload')}
                  </Button>
                  {/* Routes the picked file through the cropper before
                      uploading. Same File object, just clipped first.
                      The hidden input is shared with the plain upload
                      button via fileInputRef — we hijack onChange below
                      based on which button opened it. */}
                  <Button
                    size="sm"
                    icon="crop"
                    onClick={() => {
                      setCropTarget('main');
                      fileInputRef.current?.click();
                    }}
                    disabled={uploading}
                    title={t('cropUploadTitle')}
                  >
                    {t('cropUpload')}
                  </Button>
                </div>
              )}
            >
              <input
                className="adm-input"
                dir="ltr"
                value={form.image ?? ''}
                onChange={e => set('image', e.target.value)}
                placeholder={t('imagePlaceholder')}
              />
            </Field>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) { setCropTarget(null); return; }
                // If "Crop & upload" was clicked we have a pending
                // target — route via the cropper. Otherwise straight
                // upload as before.
                if (cropTarget === 'main') {
                  setCropFile(f);
                } else {
                  handleImageUpload(f);
                }
              }}
            />
            <Field label={t('weightVolume')}>
              <input className="adm-input" dir="auto" value={form.weight ?? ''} onChange={e => set('weight', e.target.value)} placeholder={t('weightPlaceholder')} />
            </Field>
            {/* Weight-Count Table (optional) */}
            <Field
              label={t('weightCountTable')}
              labelAction={(
                <Button
                  size="sm"
                  icon={showWCTable ? 'close' : 'table'}
                  onClick={() => {
                    if (!showWCTable && getWCRows().length === 0) setWCRows([{ weight: '', count: '' }, { weight: '', count: '' }]);
                    setShowWCTable(!showWCTable);
                  }}
                >
                  {showWCTable ? t('hideTable') : t('addTable')}
                </Button>
              )}
            >
              {showWCTable ? (
                <div>
                  <div className="adm-table-wrap">
                    <table className="adm-table adm-table-compact">
                      <thead>
                        <tr>
                          <th>{t('weightVolume')}</th>
                          <th>{t('countPerBox')}</th>
                          <th className="adm-col-actions"><span className="adm-sr-only">{tc('actions')}</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {wcRows.map((row, i) => (
                          <tr key={i}>
                            <td>
                              <input className="adm-input adm-input-sm" dir="auto" value={row.weight} onChange={e => updateWCRow(i, 'weight', e.target.value)} placeholder={t('rowWeightPlaceholder')} />
                            </td>
                            <td>
                              <NumberInput className="adm-input adm-input-sm" min={1} value={row.count} onChange={e => updateWCRow(i, 'count', e.target.value)} placeholder={t('rowCountPlaceholder')} />
                            </td>
                            <td className="adm-col-actions">
                              <IconButton icon="close" tone="danger" size="sm" label={t('removeRowLabel', { n: i + 1 })} onClick={() => removeWCRow(i)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="adm-flex" style={{ marginTop: 8 }}>
                    <Button size="sm" icon="plus" onClick={addWCRow}>{t('addRow')}</Button>
                    {wcRows.length > 0 && (
                      <Button size="sm" variant="danger" icon="trash" onClick={() => { setWCRows([]); setShowWCTable(false); }}>
                        {t('clearTable')}
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}
            </Field>

            <Field label={t('displayOrder')}>
              <NumberInput className="adm-input" value={form.display_order ?? 0} onChange={e => set('display_order', Number(e.target.value))} />
            </Field>
            <div className="adm-field">
              <label className="adm-check">
                <input type="checkbox" checked={!!form.active} onChange={e => set('active', e.target.checked ? 1 : 0)} />
                <span>{tc('active')}</span>
              </label>
            </div>

            {/* D5 publishing controls — mirrors AdminNewsEdit so admins
                build the same mental model for both content types. The
                datetime-local picker only renders when status='scheduled'
                so the field never holds a stale value for a draft / live
                product. */}
            <Field label={t('publishingStatus')} hint={prerenderNote()}>
              <select
                className="adm-select"
                value={form.status ?? 'published'}
                onChange={(e) => {
                  const next = e.target.value as 'draft' | 'scheduled' | 'published';
                  // Clear publish_at when leaving 'scheduled' to keep the
                  // server-side validation invariant (publish_at MUST be
                  // null for draft / published).
                  setForm((f) => ({
                    ...f,
                    status: next,
                    publish_at: next === 'scheduled' ? f.publish_at || '' : null,
                  }));
                }}
              >
                <option value="published">{t('statusPublished')}</option>
                <option value="draft">{t('statusDraft')}</option>
                <option value="scheduled">{t('statusScheduled')}</option>
              </select>
            </Field>
            {form.status === 'scheduled' && (
              // The picker is in the admin's local time; datetimeLocal.ts
              // converts it to UTC for the server. The old text said
              // "server time, UTC", so admins entered UTC and the
              // product went live hours early or late.
              <Field label={t('publishAt')} hint={t('publishAtHelp')}>
                <input
                  className="adm-input"
                  type="datetime-local"
                  dir="ltr"
                  value={toDatetimeLocalValue(form.publish_at)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      publish_at: fromDatetimeLocalValue(e.target.value),
                    }))
                  }
                />
              </Field>
            )}
          </Card>

          {form.image && (
            <Card title={t('imagePreview')} icon="image">
              {/* Scale slider */}
              <Field label={t('imageScale')} labelAction={<strong>{scalePct}%</strong>}>
                <input
                  type="range"
                  min={30}
                  max={150}
                  step={5}
                  value={scalePct}
                  onChange={e => set('image_scale', Number(e.target.value) / 100)}
                  style={{ width: '100%' }}
                />
              </Field>

              {/* Card-like preview (matches product card 300×450) */}
              <div style={{
                position: 'relative',
                width: 240,
                height: 360,
                margin: '0 auto',
                borderRadius: 'var(--adm-radius)',
                overflow: 'hidden',
                background: 'var(--adm-panel-solid)',
                border: '1px solid var(--adm-glass-border-strong)',
                boxShadow: 'var(--adm-shadow-sm)',
              }}>
                <img
                  src={resolveAdminImage(form.image)}
                  alt={t('previewAlt')}
                  style={{
                    width: '85%',
                    objectFit: 'contain',
                    display: 'block',
                    position: 'absolute',
                    top: 0,
                    bottom: 72,
                    left: '50%',
                    transform: `translateX(-50%) scale(${(form.image_scale ?? 0.85) / 0.85})`,
                    margin: 'auto 0',
                  }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 72,
                  background: 'var(--adm-surface2)',
                  borderTop: '1px solid var(--adm-glass-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 12px',
                }}>
                  <strong className="adm-truncate" style={{ maxWidth: '100%' }}>
                    {form.name_ar || form.name_en || t('previewName')}
                  </strong>
                  <div className="adm-truncate adm-text-sm adm-text-muted" style={{ maxWidth: '100%', marginTop: 2 }}>
                    {form.description_ar || form.description_en || t('previewDescription')}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Gallery Images (optional) */}
          <Card
            title={t('galleryImages')}
            icon="image"
            actions={<Button size="sm" icon="plus" onClick={addGallerySlot}>{t('addImage')}</Button>}
          >
            {gallery.length === 0 ? (
              <EmptyState icon="image" title={t('noGallery')} text={t('noGalleryText')} compact />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {gallery.map((img, idx) => (
                  <div key={idx} className="adm-flex">
                    {img && (
                      <img src={resolveAdminImage(img)} alt={t('galleryAlt', { index: idx, n: idx + 1 })} className="adm-thumb-sq" />
                    )}
                    <input
                      className="adm-input"
                      dir="ltr"
                      value={img}
                      onChange={e => updateGalleryImage(idx, e.target.value)}
                      placeholder={t('galleryPlaceholder', { n: idx + 1 })}
                      aria-label={t('galleryPlaceholder', { n: idx + 1 })}
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <IconButton
                      icon="upload"
                      label={t('uploadGalleryLabel', { n: idx + 1 })}
                      onClick={() => { setCropTarget(null); galleryFileRefs.current[idx]?.click(); }}
                      loading={uploadingSlots.has(idx)}
                    />
                    {/* Cropper path. Sets the target index so the
                        shared cropFile pipeline knows which gallery slot
                        receives the cropped File. */}
                    <IconButton
                      icon="crop"
                      label={t('cropGalleryLabel', { n: idx + 1 })}
                      onClick={() => { setCropTarget(idx); galleryFileRefs.current[idx]?.click(); }}
                      disabled={uploadingSlots.has(idx)}
                    />
                    <input ref={el => { galleryFileRefs.current[idx] = el; }} type="file" accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (!f) { setCropTarget(null); return; }
                        if (cropTarget === idx) {
                          setCropFile(f);
                        } else {
                          handleGalleryUpload(idx, f);
                        }
                      }} />
                    <IconButton
                      icon="close"
                      tone="danger"
                      label={t('removeGalleryLabel', { n: idx + 1 })}
                      onClick={() => removeGalleryImage(idx)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Marketplace listings (optional) */}
          <Card title={t('storeListings')} icon="link" subtitle={t('storeListingsHelp')}>
            {MARKETPLACE_URL_FIELDS.map(({ key, labelKey, placeholder }) => {
              const value = form[key] ?? '';
              return (
                <Field
                  key={key}
                  label={t(labelKey)}
                  labelAction={/^https:\/\//i.test(value) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconEnd="external"
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t('openListingTitle')}
                    >
                      {t('openListing')}
                    </Button>
                  )}
                >
                  <input
                    className="adm-input"
                    type="url"
                    inputMode="url"
                    dir="ltr"
                    value={value}
                    onChange={e => set(key, e.target.value)}
                    placeholder={placeholder}
                  />
                </Field>
              );
            })}
          </Card>
        </div>

        {/* Right: multilingual content */}
        <Card
          title={t('content')}
          icon="language"
          actions={(
            <TranslationHelper
              fields={{
                name: form.name_ar || '',
                description: form.description_ar || '',
                alt: form.alt_ar || '',
                material: form.material_ar || '',
                count: form.count_ar || '',
              }}
              sourceLang="ar"
              onTranslated={handleTranslated}
            />
          )}
        >
          <div className="adm-mb-16">
            <Tabs<Lang>
              variant="segmented"
              ariaLabel={t('contentLanguage')}
              value={activeLang}
              onChange={setActiveLang}
              items={LANGS.map(l => ({ value: l, label: <LangLabel lang={l} /> }))}
            />
          </div>

          {LANGS.map(l => (
            <div key={l} hidden={activeLang !== l}>
              <Field label={t('nameLabel', { lang: l.toUpperCase() })} required={l === SOURCE_LANG}>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`name_${l}`] ?? ''}
                  onChange={e => set(`name_${l}` as keyof Product, e.target.value)}
                />
              </Field>
              {/* AI writer is mounted once per language tab; the
                  dialog body decides for itself whether to use
                  the visible language as the source. Clicking
                  from any tab opens the SAME dialog state. */}
              <Field
                label={t('descriptionLabel', { lang: l.toUpperCase() })}
                labelAction={(
                  <Button
                    variant="ai"
                    size="sm"
                    icon="ai"
                    onClick={() => setAiDescOpen(true)}
                    title={t('aiWriteTitle')}
                    disabled={!form.name_ar && !form.name_en}
                  >
                    {t('aiWrite')}
                  </Button>
                )}
              >
                <textarea
                  className="adm-textarea"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  rows={3}
                  value={(form as Record<string, string>)[`description_${l}`] ?? ''}
                  onChange={e => set(`description_${l}` as keyof Product, e.target.value)}
                />
              </Field>
              <Field label={t('altLabel', { lang: l.toUpperCase() })}>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`alt_${l}`] ?? ''}
                  onChange={e => set(`alt_${l}` as keyof Product, e.target.value)}
                />
              </Field>
              <Field label={t('materialLabel', { lang: l.toUpperCase() })}>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`material_${l}`] ?? ''}
                  onChange={e => set(`material_${l}` as keyof Product, e.target.value)}
                />
              </Field>
              <Field label={t('countLabel', { lang: l.toUpperCase() })}>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`count_${l}`] ?? ''}
                  onChange={e => set(`count_${l}` as keyof Product, e.target.value)}
                />
              </Field>
              <Field label={t('giftLabel', { lang: l.toUpperCase() })}>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  placeholder={l === 'ar' ? 'مثال: معطر أرضيات آيلوكس' : 'e.g. AYLUX Floor Freshener'}
                  value={(form as Record<string, string>)[`gift_${l}`] ?? ''}
                  onChange={e => set(`gift_${l}` as keyof Product, e.target.value)}
                />
              </Field>
            </div>
          ))}
        </Card>
      </div>

      {/* AI description writer modal. Reads its inputs from the current
          form state so the brief always reflects what the admin sees.
          The category lookup goes through `filteredCategories` so an
          English-speaker editing a DIOX product gets the English
          category name in the prompt context. */}
      <AiDescriptionDialog
        open={aiDescOpen}
        onClose={() => setAiDescOpen(false)}
        defaults={{
          name: (form.name_ar || form.name_en || '').trim(),
          brand: (form.brand as 'DIOX' | 'AYLUX') || 'DIOX',
          category: (() => {
            const cat = filteredCategories.find((c) => c.id === form.category_id);
            return cat?.title_en || cat?.title_ar || undefined;
          })(),
          sourceLang: form.name_ar ? 'ar' : 'en',
        }}
        onApply={(descs) => {
          // Apply only NON-EMPTY languages from the model so a partial
          // response (3 of 4 langs) doesn't blank out an existing field.
          const updates: Partial<Product> = {};
          (['ar', 'en', 'tr', 'ru'] as const).forEach((lang) => {
            const val = descs[lang];
            if (typeof val === 'string' && val.trim()) {
              (updates as Record<string, string>)[`description_${lang}`] = val;
            }
          });
          setForm((f) => ({ ...f, ...updates }));
        }}
      />

      {/* Image cropper dialog. Mounted once for the whole page; the
          cropTarget ref-style state decides which uploader receives
          the cropped File (main image vs a specific gallery slot). */}
      <ImageCropperDialog
        open={cropFile !== null}
        file={cropFile}
        onCancel={() => { setCropFile(null); setCropTarget(null); }}
        onCropped={handleCropped}
      />
    </div>
  );
};
