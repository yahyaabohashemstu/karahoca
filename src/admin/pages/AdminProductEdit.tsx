import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminApi, type Product, type ProductCategory } from '../utils/adminApi';
import { TranslationHelper } from '../components/TranslationHelper';
import { AiDescriptionDialog } from '../components/AiDescriptionDialog';
import { ImageCropperDialog } from '../components/ImageCropperDialog';
import { resolveAdminImage } from '../../utils/image';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../utils/datetimeLocal';
import { confirmPastSchedule, prerenderNote } from '../utils/publishing';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

const messages = defineMessages({
  en: {
    errUnsupportedType: 'Unsupported file type. Use JPG, PNG, WebP, or GIF.',
    errGalleryTooLarge: 'File too large. Maximum 10 MB.',
    errImageTooLarge: 'File too large. Maximum size is 10 MB.',
    uploadFailed: 'Upload failed',
    errRequired: 'Please fill required fields: Arabic name, brand, and category.',
    saveFailed: 'Save failed',
    newProduct: 'New Product',
    editProduct: 'Edit Product',
    waitForUpload: 'Wait for the image upload to finish',
    saveProduct: '💾 Save Product',
    productInfo: 'Product Info',
    brandRequired: 'Brand *',
    categoryRequired: 'Category *',
    selectOption: '— Select —',
    imagePlaceholder: '/products/image.webp or paste URL',
    upload: '📁 Upload',
    cropUploadTitle: 'Open the image in a cropper before uploading',
    cropUpload: '✂️ Crop & upload',
    weightVolume: 'Weight / Volume',
    weightPlaceholder: 'e.g. 500ml',
    weightCountTable: 'Weight / Count Table',
    hideTable: '✕ Hide Table',
    addTable: '📊 Add Table',
    countPerBox: 'Count (per box)',
    rowWeightPlaceholder: 'e.g. 1.2 kg',
    rowCountPlaceholder: 'e.g. 6',
    remove: 'Remove',
    addRow: '+ Add Row',
    clearTable: 'Clear Table',
    displayOrder: 'Display Order',
    publishingStatus: 'Publishing status',
    statusPublished: '✅ Published — visible to everyone',
    statusDraft: '📝 Draft — hidden, work in progress',
    statusScheduled: '🕐 Scheduled — auto-publish at set time',
    publishAt: 'Publish at',
    publishAtHelp: 'The product will appear in the public catalogue automatically at this time (your local time). The catalogue cache is busted on flip.',
    imagePreview: 'Image Preview',
    imageScale: 'Image Scale',
    previewAlt: 'preview',
    previewName: 'Product Name',
    previewDescription: 'Description',
    galleryImages: 'Gallery Images',
    addImage: '+ Add Image',
    noGallery: 'No gallery images. Click "+ Add Image" to add colour variants or extra views.',
    galleryAlt: 'gallery-{index}',
    galleryPlaceholder: 'Image path or URL #{n}',
    uploadDirectTitle: 'Upload directly without cropping',
    uploadGalleryLabel: 'Upload gallery image {n}',
    cropGalleryLabel: 'Crop and upload gallery image {n}',
    removeGalleryLabel: 'Remove gallery image {n}',
    storeListings: 'Online Store Listings',
    storeListingsHelp: 'This product\'s own page on the brand\'s store. The site\'s "buy online" buttons in the product window open it — currently shown on the Turkish and Arabic AYLUX pages. Leave empty to send buyers to the store\'s main page.',
    trendyolListing: 'Trendyol listing',
    hepsiburadaListing: 'Hepsiburada listing',
    openListingTitle: 'Open the listing in a new tab to check it',
    openListing: '↗ Open',
    content: 'Content',
    nameLabel: 'Name ({lang}) *',
    descriptionLabel: 'Description ({lang})',
    aiWriteTitle: 'Generate a draft description in all 4 languages from the product name + an optional hint',
    aiWrite: '✨ AI write',
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
    waitForUpload: 'انتظر حتى يكتمل رفع الصورة',
    saveProduct: '💾 حفظ المنتج',
    productInfo: 'بيانات المنتج',
    brandRequired: 'العلامة التجارية *',
    categoryRequired: 'الفئة *',
    selectOption: '— اختر —',
    imagePlaceholder: '/products/image.webp أو الصق رابطًا',
    upload: '📁 رفع',
    cropUploadTitle: 'فتح الصورة في أداة القص قبل رفعها',
    cropUpload: '✂️ قص ورفع',
    weightVolume: 'الوزن / الحجم',
    weightPlaceholder: 'مثال: 500ml',
    weightCountTable: 'جدول الوزن / العدد',
    hideTable: '✕ إخفاء الجدول',
    addTable: '📊 إضافة جدول',
    countPerBox: 'العدد (لكل صندوق)',
    rowWeightPlaceholder: 'مثال: 1.2 kg',
    rowCountPlaceholder: 'مثال: 6',
    remove: 'إزالة',
    addRow: '+ إضافة صف',
    clearTable: 'مسح الجدول',
    displayOrder: 'ترتيب العرض',
    publishingStatus: 'حالة النشر',
    statusPublished: '✅ منشور — ظاهر للجميع',
    statusDraft: '📝 مسودة — مخفي، قيد الإعداد',
    statusScheduled: '🕐 مجدول — يُنشر تلقائيًا في الوقت المحدد',
    publishAt: 'موعد النشر',
    publishAtHelp: 'سيظهر المنتج في الكتالوج العام تلقائيًا في هذا الوقت (بتوقيتك المحلي). ويُحدَّث التخزين المؤقت للكتالوج لحظة النشر.',
    imagePreview: 'معاينة الصورة',
    imageScale: 'حجم الصورة',
    previewAlt: 'معاينة',
    previewName: 'اسم المنتج',
    previewDescription: 'الوصف',
    galleryImages: 'صور المعرض',
    addImage: '+ إضافة صورة',
    noGallery: 'لا توجد صور في المعرض. انقر «+ إضافة صورة» لإضافة ألوان أخرى للمنتج أو لقطات إضافية.',
    galleryAlt: 'صورة المعرض {n}',
    galleryPlaceholder: 'مسار الصورة أو رابطها #{n}',
    uploadDirectTitle: 'رفع مباشر دون قص',
    uploadGalleryLabel: 'رفع صورة المعرض {n}',
    cropGalleryLabel: 'قص صورة المعرض {n} ورفعها',
    removeGalleryLabel: 'إزالة صورة المعرض {n}',
    storeListings: 'صفحات المتاجر الإلكترونية',
    storeListingsHelp: 'صفحة هذا المنتج نفسه في متجر العلامة التجارية. تفتحها أزرار «اشترِ عبر الإنترنت» في نافذة المنتج على الموقع — وتظهر حاليًا في صفحات AYLUX التركية والعربية. اتركه فارغًا لتوجيه المشترين إلى الصفحة الرئيسية للمتجر.',
    trendyolListing: 'صفحة المنتج على Trendyol',
    hepsiburadaListing: 'صفحة المنتج على Hepsiburada',
    openListingTitle: 'فتح الصفحة في علامة تبويب جديدة للتحقق منها',
    openListing: '↗ فتح',
    content: 'المحتوى',
    nameLabel: 'الاسم ({lang}) *',
    descriptionLabel: 'الوصف ({lang})',
    aiWriteTitle: 'توليد مسودة وصف باللغات الأربع من اسم المنتج مع توجيه اختياري',
    aiWrite: '✨ كتابة بالذكاء الاصطناعي',
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
  // In-flight gallery upload → the slot it will fill. Kept in a ref so an
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

  if (loading) return <div className="adm-loading-center"><span className="adm-spinner" /> {tc('loading')}</div>;

  return (
    <div>
      <div className="adm-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/admin/products" className="adm-btn adm-btn-ghost adm-btn-sm">{tc('back')}</Link>
          <h1 className="adm-page-title">{isNew ? t('newProduct') : t('editProduct')}</h1>
        </div>
        {/* Saving navigates away, which would drop an image still uploading. */}
        <button
          className="adm-btn adm-btn-primary"
          onClick={handleSave}
          disabled={saving || uploading || uploadingSlots.size > 0}
          title={uploading || uploadingSlots.size > 0 ? t('waitForUpload') : undefined}
        >
          {saving ? <><span className="adm-spinner" style={{ width: 14, height: 14 }} /> {tc('saving')}</> : t('saveProduct')}
        </button>
      </div>

      {error && <div className="adm-alert adm-alert-error" style={{ marginBottom: 16 }}>⚠ {error}</div>}

      <div className="adm-grid-2">
        {/* Left: metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="adm-card">
            <div className="adm-card-title">{t('productInfo')}</div>
            <div className="adm-form-group">
              <label className="adm-label">{t('brandRequired')}</label>
              <select className="adm-input" value={form.brand} onChange={e => { set('brand', e.target.value as 'DIOX' | 'AYLUX'); set('category_id', ''); }}>
                <option value="DIOX">DIOX</option>
                <option value="AYLUX">AYLUX</option>
              </select>
            </div>
            <div className="adm-form-group">
              <label className="adm-label">{t('categoryRequired')}</label>
              <select className="adm-input" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                <option value="">{t('selectOption')}</option>
                {filteredCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.title_en} / {c.title_ar}</option>
                ))}
              </select>
            </div>
            <div className="adm-form-group">
              <label className="adm-label">{tc('image')}</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input
                  className="adm-input"
                  dir="ltr"
                  value={form.image ?? ''}
                  onChange={e => set('image', e.target.value)}
                  placeholder={t('imagePlaceholder')}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="adm-btn adm-btn-secondary adm-btn-sm"
                  onClick={() => {
                    // Clear a target left by a cancelled "Crop & upload"
                    // (closing the file picker doesn't fire onChange), or
                    // this plain upload would open the cropper.
                    setCropTarget(null);
                    fileInputRef.current?.click();
                  }}
                  disabled={uploading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {uploading ? <><span className="adm-spinner" style={{ width: 12, height: 12 }} /> {tc('uploading')}</> : t('upload')}
                </button>
                {/* Routes the picked file through the cropper before
                    uploading. Same File object, just clipped first.
                    The hidden input is shared with the plain upload
                    button via fileInputRef — we hijack onChange below
                    based on which button opened it. */}
                <button
                  type="button"
                  className="adm-btn adm-btn-ghost adm-btn-sm"
                  onClick={() => {
                    setCropTarget('main');
                    fileInputRef.current?.click();
                  }}
                  disabled={uploading}
                  style={{ whiteSpace: 'nowrap' }}
                  title={t('cropUploadTitle')}
                >
                  {t('cropUpload')}
                </button>
              </div>
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
            </div>
            <div className="adm-form-group">
              <label className="adm-label">{t('weightVolume')}</label>
              <input className="adm-input" value={form.weight ?? ''} onChange={e => set('weight', e.target.value)} placeholder={t('weightPlaceholder')} />
            </div>
            {/* Weight-Count Table (optional) */}
            <div className="adm-form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="adm-label" style={{ margin: 0 }}>{t('weightCountTable')}</label>
                <button
                  type="button"
                  className={`adm-btn adm-btn-sm ${showWCTable ? 'adm-btn-warning' : 'adm-btn-secondary'}`}
                  onClick={() => {
                    if (!showWCTable && getWCRows().length === 0) setWCRows([{ weight: '', count: '' }, { weight: '', count: '' }]);
                    setShowWCTable(!showWCTable);
                  }}
                >
                  {showWCTable ? t('hideTable') : t('addTable')}
                </button>
              </div>

              {showWCTable && (
                <div style={{ marginTop: 10, border: '1px solid var(--adm-border, rgba(255,255,255,0.12))', borderRadius: 8, padding: 12, background: 'rgba(255,255,255,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'start', padding: '6px 8px', fontSize: 12, color: 'var(--adm-text-muted, #888)', fontWeight: 600 }}>{t('weightVolume')}</th>
                        <th style={{ textAlign: 'start', padding: '6px 8px', fontSize: 12, color: 'var(--adm-text-muted, #888)', fontWeight: 600 }}>{t('countPerBox')}</th>
                        <th style={{ width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {getWCRows().map((row, i) => (
                        <tr key={i}>
                          <td style={{ padding: '3px 4px' }}>
                            <input className="adm-input" value={row.weight} onChange={e => updateWCRow(i, 'weight', e.target.value)} placeholder={t('rowWeightPlaceholder')} style={{ fontSize: 13 }} />
                          </td>
                          <td style={{ padding: '3px 4px' }}>
                            <input className="adm-input" type="number" dir="ltr" min={1} value={row.count} onChange={e => updateWCRow(i, 'count', e.target.value)} placeholder={t('rowCountPlaceholder')} style={{ fontSize: 13 }} />
                          </td>
                          <td style={{ padding: '3px 4px' }}>
                            <button type="button" className="adm-btn adm-btn-danger adm-btn-sm" onClick={() => removeWCRow(i)} title={t('remove')} style={{ padding: '4px 8px' }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" className="adm-btn adm-btn-secondary adm-btn-sm" onClick={addWCRow}>{t('addRow')}</button>
                    {getWCRows().length > 0 && (
                      <button type="button" className="adm-btn adm-btn-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
                        onClick={() => { setWCRows([]); setShowWCTable(false); }}>{t('clearTable')}</button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="adm-form-group">
              <label className="adm-label">{t('displayOrder')}</label>
              <input className="adm-input" type="number" dir="ltr" value={form.display_order ?? 0} onChange={e => set('display_order', Number(e.target.value))} />
            </div>
            <div className="adm-form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label className="adm-label" style={{ margin: 0 }}>{tc('active')}</label>
              <input type="checkbox" checked={!!form.active} onChange={e => set('active', e.target.checked ? 1 : 0)} style={{ width: 18, height: 18 }} />
            </div>

            {/* D5 publishing controls — mirrors AdminNewsEdit so admins
                build the same mental model for both content types. The
                datetime-local picker only renders when status='scheduled'
                so the field never holds a stale value for a draft / live
                product. */}
            <div className="adm-form-group">
              <label className="adm-label">{t('publishingStatus')}</label>
              <select
                className="adm-input"
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
              <small style={{ color: 'var(--adm-text-dim)', marginTop: 4, display: 'block' }}>
                {prerenderNote()}
              </small>
            </div>
            {form.status === 'scheduled' && (
              <div className="adm-form-group">
                <label className="adm-label">{t('publishAt')}</label>
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
                {/* The picker is in the admin's local time; datetimeLocal.ts
                    converts it to UTC for the server. The old text said
                    "server time, UTC", so admins entered UTC and the
                    product went live hours early or late. */}
                <small style={{ color: 'var(--adm-text-dim)', marginTop: 4, display: 'block' }}>
                  {t('publishAtHelp')}
                </small>
              </div>
            )}
          </div>

          {form.image && (
            <div className="adm-card">
              <div className="adm-card-title">{t('imagePreview')}</div>

              {/* Scale slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0' }}>
                <span style={{ fontSize: 12, opacity: 0.6, whiteSpace: 'nowrap' }}>{t('imageScale')}</span>
                <input
                  type="range"
                  min={30}
                  max={150}
                  step={5}
                  value={Math.round((form.image_scale ?? 0.85) * 100)}
                  onChange={e => set('image_scale', Number(e.target.value) / 100)}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 42, textAlign: 'center' }}>
                  {Math.round((form.image_scale ?? 0.85) * 100)}%
                </span>
              </div>

              {/* Card-like preview (matches product card 300×450) */}
              <div style={{
                position: 'relative',
                width: 240,
                height: 360,
                margin: '0 auto',
                borderRadius: 16,
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
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
                    filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.3))',
                  }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 72,
                  background: 'rgba(255,255,255,0.06)',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 12px',
                }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#fff',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  }}>
                    {form.name_ar || form.name_en || t('previewName')}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                    {form.description_ar || form.description_en || t('previewDescription')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Gallery Images (optional) */}
          <div className="adm-card">
            <div className="adm-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('galleryImages')}</span>
              <button type="button" className="adm-btn adm-btn-secondary adm-btn-sm" onClick={addGallerySlot}>
                {t('addImage')}
              </button>
            </div>
            {getGalleryImages().length === 0 && (
              <p style={{ color: 'var(--adm-text-muted, #888)', fontSize: 13, margin: '8px 0 0' }}>
                {t('noGallery')}
              </p>
            )}
            {getGalleryImages().map((img, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                {img && (
                  <img src={resolveAdminImage(img)} alt={t('galleryAlt', { index: idx, n: idx + 1 })}
                    style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--adm-border, #ddd)' }} />
                )}
                <input className="adm-input" dir="ltr" value={img} onChange={e => updateGalleryImage(idx, e.target.value)}
                  placeholder={t('galleryPlaceholder', { n: idx + 1 })} style={{ flex: 1 }} />
                <button type="button" className="adm-btn adm-btn-secondary adm-btn-sm"
                  onClick={() => { setCropTarget(null); galleryFileRefs.current[idx]?.click(); }}
                  disabled={uploadingSlots.has(idx)} style={{ whiteSpace: 'nowrap' }}
                  title={t('uploadDirectTitle')} aria-label={t('uploadGalleryLabel', { n: idx + 1 })}>
                  {uploadingSlots.has(idx)
                    ? <><span className="adm-spinner" style={{ width: 12, height: 12 }} /> ...</>
                    : '📁'}
                </button>
                {/* Cropper path. Sets the target index so the
                    shared cropFile pipeline knows which gallery slot
                    receives the cropped File. */}
                <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm"
                  onClick={() => { setCropTarget(idx); galleryFileRefs.current[idx]?.click(); }}
                  disabled={uploadingSlots.has(idx)} style={{ whiteSpace: 'nowrap' }}
                  title={t('cropUploadTitle')} aria-label={t('cropGalleryLabel', { n: idx + 1 })}>
                  ✂️
                </button>
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
                <button type="button" className="adm-btn adm-btn-sm"
                  style={{ background: '#dc3545', color: '#fff', border: 'none' }}
                  onClick={() => removeGalleryImage(idx)} title={t('remove')} aria-label={t('removeGalleryLabel', { n: idx + 1 })}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Marketplace listings (optional) */}
          <div className="adm-card">
            <div className="adm-card-title">{t('storeListings')}</div>
            <p style={{ color: 'var(--adm-text-muted, #888)', fontSize: 13, margin: '4px 0 12px' }}>
              {t('storeListingsHelp')}
            </p>
            {MARKETPLACE_URL_FIELDS.map(({ key, labelKey, placeholder }) => {
              const value = form[key] ?? '';
              return (
                <div key={key} className="adm-form-group">
                  <label className="adm-label">{t(labelKey)}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="adm-input"
                      type="url"
                      inputMode="url"
                      dir="ltr"
                      value={value}
                      onChange={e => set(key, e.target.value)}
                      placeholder={placeholder}
                      style={{ flex: 1 }}
                    />
                    {/^https:\/\//i.test(value) && (
                      <a
                        className="adm-btn adm-btn-ghost adm-btn-sm"
                        href={value}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ whiteSpace: 'nowrap' }}
                        title={t('openListingTitle')}
                      >
                        {t('openListing')}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: multilingual content */}
        <div className="adm-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div className="adm-card-title" style={{ margin: 0 }}>{t('content')}</div>
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
          </div>

          {/* Lang tabs */}
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
                <label className="adm-label">{t('nameLabel', { lang: l.toUpperCase() })}</label>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`name_${l}`] ?? ''}
                  onChange={e => set(`name_${l}` as keyof Product, e.target.value)}
                />
              </div>
              <div className="adm-form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <label className="adm-label" style={{ margin: 0 }}>{t('descriptionLabel', { lang: l.toUpperCase() })}</label>
                  {/* AI writer is mounted once per language tab; the
                      dialog body decides for itself whether to use
                      the visible language as the source. Clicking
                      from any tab opens the SAME dialog state. */}
                  <button
                    type="button"
                    className="adm-btn adm-btn-ghost adm-btn-sm"
                    onClick={() => setAiDescOpen(true)}
                    title={t('aiWriteTitle')}
                    disabled={!form.name_ar && !form.name_en}
                  >
                    {t('aiWrite')}
                  </button>
                </div>
                <textarea
                  className="adm-textarea"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  rows={3}
                  value={(form as Record<string, string>)[`description_${l}`] ?? ''}
                  onChange={e => set(`description_${l}` as keyof Product, e.target.value)}
                />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">{t('altLabel', { lang: l.toUpperCase() })}</label>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`alt_${l}`] ?? ''}
                  onChange={e => set(`alt_${l}` as keyof Product, e.target.value)}
                />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">{t('materialLabel', { lang: l.toUpperCase() })}</label>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`material_${l}`] ?? ''}
                  onChange={e => set(`material_${l}` as keyof Product, e.target.value)}
                />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">{t('countLabel', { lang: l.toUpperCase() })}</label>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`count_${l}`] ?? ''}
                  onChange={e => set(`count_${l}` as keyof Product, e.target.value)}
                />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">{t('giftLabel', { lang: l.toUpperCase() })}</label>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  placeholder={l === 'ar' ? 'مثال: معطر أرضيات آيلوكس' : 'e.g. AYLUX Floor Freshener'}
                  value={(form as Record<string, string>)[`gift_${l}`] ?? ''}
                  onChange={e => set(`gift_${l}` as keyof Product, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
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


