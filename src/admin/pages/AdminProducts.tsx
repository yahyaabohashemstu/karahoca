import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type Product } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { resolveAdminImage } from '../../utils/image';
import { ProductCsvImportModal } from '../components/ProductCsvImportModal';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

const messages = defineMessages({
  en: {
    confirmDelete: 'Delete this product? It will be hidden from the public site.\n\nTo permanently remove it, use "Edit" and then contact your admin.',
    errDelete: 'Failed to delete product',
    confirmDiscard: 'Discard unsaved order changes?',
    errSaveOrder: 'Failed to save order: {error}',
    errSaveOrderRetry: 'Failed to save order. Please try again.',
    reorderTitle: '⠿ Reorder Products',
    reorderSubtitle: 'Drag rows within each category to change display order. Cross-category drag is disabled.',
    savingOrder: '⏳ Saving…',
    saveOrder: '💾 Save Order',
    noChanges: '✓ No Changes',
    noProductsLoaded: 'No products loaded. Close and open a brand filter first.',
    groupCount: { one: '{n} product', other: '{n} products' },
    discard: 'Discard',
    saveNewOrder: '💾 Save New Order',
    title: 'Products',
    subtitle: 'Manage DIOX and AYLUX product catalog',
    reorderHint: 'Drag-and-drop to reorder products within categories',
    reorder: '⠿ Reorder',
    exportBrandTitle: 'Download {brand} products as CSV',
    exportAllTitle: 'Download full product catalogue as CSV',
    exportCsv: '⬇️ Export CSV',
    importTitle: 'Bulk-import or update products from a CSV file',
    importCsv: '📥 Import CSV',
    manageCategories: '🗂️ Manage Categories',
    addProduct: '+ Add Product',
    allBrands: 'All Brands',
    hiddenShownTitle: 'Currently showing hidden products — click to hide them',
    showHiddenTitle: 'Show hidden/deleted products',
    hideHidden: '👁 Hide Hidden',
    showHidden: '👁 Show Hidden',
    statusFilterTitle: 'Filter by publishing status',
    allStatuses: 'All statuses',
    filterPublished: '✅ Published',
    filterDrafts: '📝 Drafts',
    filterScheduled: '🕐 Scheduled',
    searchPlaceholder: 'Search by name, category, brand…',
    countOf: '{shown} of {total}',
    hiddenCount: '({n} hidden)',
    colNameAr: 'Name (AR)',
    colNameEn: 'Name (EN)',
    colBrand: 'Brand',
    colCategory: 'Category',
    colOrder: 'Order',
    colVisibility: 'Visibility',
    colPublishing: 'Publishing',
    empty: 'No products found.',
    badgeDraft: '📝 Draft',
    badgeScheduled: '🕐 Scheduled',
    badgeLive: '✅ Live',
    deleteLabel: 'Delete product {name}',
    deleteTitle: 'Delete product',
  },
  ar: {
    confirmDelete: 'حذف هذا المنتج؟ سيُخفى من الموقع العام.\n\nلإزالته نهائيًا، افتح «تعديل» ثم تواصل مع مسؤول الموقع.',
    errDelete: 'تعذّر حذف المنتج',
    confirmDiscard: 'تجاهل تغييرات الترتيب غير المحفوظة؟',
    errSaveOrder: 'تعذّر حفظ الترتيب: {error}',
    errSaveOrderRetry: 'تعذّر حفظ الترتيب. أعد المحاولة.',
    reorderTitle: '⠿ إعادة ترتيب المنتجات',
    reorderSubtitle: 'اسحب الصفوف داخل كل فئة لتغيير ترتيب العرض. لا يمكن السحب بين فئات مختلفة.',
    savingOrder: '⏳ جارٍ الحفظ…',
    saveOrder: '💾 حفظ الترتيب',
    noChanges: '✓ لا توجد تغييرات',
    noProductsLoaded: 'لم تُحمَّل أي منتجات. أغلق هذا العرض واختر علامة تجارية أولًا.',
    groupCount: {
      zero: 'لا منتجات',
      one: 'منتج واحد',
      two: 'منتجان',
      few: '{n} منتجات',
      many: '{n} منتجًا',
      other: '{n} منتج',
    },
    discard: 'تجاهل التغييرات',
    saveNewOrder: '💾 حفظ الترتيب الجديد',
    title: 'المنتجات',
    subtitle: 'إدارة كتالوج منتجات DIOX و AYLUX',
    reorderHint: 'اسحب المنتجات وأفلتها لإعادة ترتيبها داخل الفئات',
    reorder: '⠿ إعادة الترتيب',
    exportBrandTitle: 'تنزيل منتجات {brand} بصيغة CSV',
    exportAllTitle: 'تنزيل كتالوج المنتجات كاملًا بصيغة CSV',
    exportCsv: '⬇️ تصدير CSV',
    importTitle: 'استيراد المنتجات أو تحديثها دفعةً واحدة من ملف CSV',
    importCsv: '📥 استيراد CSV',
    manageCategories: '🗂️ إدارة الفئات',
    addProduct: '+ إضافة منتج',
    allBrands: 'كل العلامات التجارية',
    hiddenShownTitle: 'المنتجات المخفية معروضة الآن — انقر لإخفائها',
    showHiddenTitle: 'عرض المنتجات المخفية والمحذوفة',
    hideHidden: '👁 إخفاء المخفية',
    showHidden: '👁 عرض المخفية',
    statusFilterTitle: 'التصفية حسب حالة النشر',
    allStatuses: 'كل الحالات',
    filterPublished: '✅ المنشورة',
    filterDrafts: '📝 المسودات',
    filterScheduled: '🕐 المجدولة',
    searchPlaceholder: 'ابحث بالاسم أو الفئة أو العلامة التجارية…',
    countOf: '{shown} من {total}',
    hiddenCount: '(المخفية: {n})',
    colNameAr: 'الاسم (AR)',
    colNameEn: 'الاسم (EN)',
    colBrand: 'العلامة التجارية',
    colCategory: 'الفئة',
    colOrder: 'الترتيب',
    colVisibility: 'الظهور',
    colPublishing: 'النشر',
    empty: 'لا توجد منتجات.',
    badgeDraft: '📝 مسودة',
    badgeScheduled: '🕐 مجدول',
    badgeLive: '✅ ظاهر للزوار',
    deleteLabel: 'حذف المنتج {name}',
    deleteTitle: 'حذف المنتج',
  },
});

export const AdminProducts: React.FC = () => {
  // ── Browse state ──────────────────────────────────────────────────────────
  const [brand, setBrand] = useState<'DIOX' | 'AYLUX' | ''>('');
  const [showHidden, setShowHidden] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // D5: client-side status filter. The list endpoint returns ALL
  // statuses for admin views, so filtering here keeps the query
  // surface unchanged while letting the admin focus on drafts /
  // scheduled / published.
  const [statusFilter, setStatusFilter] = useState<'' | 'draft' | 'scheduled' | 'published'>('');

  // ── Reorder state ─────────────────────────────────────────────────────────
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderItems, setReorderItems] = useState<Product[]>([]);
  const [dragSrcId, setDragSrcId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ── CSV import state ─────────────────────────────────────────────────────
  // Modal-open boolean — the modal owns its own form state so this
  // component stays focused on the table view.
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  const t = useT(messages);
  const tc = useT(common);

  const { data, loading, error, reload } = useAsync(
    () => adminApi.getProducts(brand || undefined, showHidden),
    [brand, showHidden],
  );

  const products = data?.products ?? [];

  const filtered = products.filter((p) => {
    // Status filter — clients see EVERY status (the admin endpoint
    // returns all), then narrow here so the count badge updates
    // instantly when the dropdown changes.
    if (statusFilter && (p.status || 'published') !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.name_en || '').toLowerCase().includes(q) ||
      (p.name_ar || '').includes(q) ||
      (p.category_title_en || '').toLowerCase().includes(q) ||
      (p.category_title_ar || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q)
    );
  });

  const hiddenCount = showHidden ? filtered.filter(p => !p.active).length : 0;

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    setDeleting(id);
    try {
      await adminApi.deleteProduct(id);
      reload();
    } catch (e) {
      // Show the real reason (e.g. "session expired — sign in again").
      alert(e instanceof Error ? e.message : t('errDelete'));
    } finally {
      setDeleting(null);
    }
  };

  // ── Enter / exit reorder mode ─────────────────────────────────────────────
  const enterReorderMode = () => {
    // Fetch ALL active products regardless of filter for reorder
    setReorderItems([...products]);
    setDirty(false);
    setDragSrcId(null);
    setDragOverId(null);
    setReorderMode(true);
  };

  const cancelReorder = () => {
    if (dirty && !confirm(t('confirmDiscard'))) return;
    setReorderMode(false);
    setDragSrcId(null);
    setDragOverId(null);
    setDirty(false);
  };

  // ── Drag & drop handlers ──────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDragSrcId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragOverId) setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!dragSrcId || dragSrcId === targetId) {
      setDragSrcId(null);
      setDragOverId(null);
      return;
    }

    const srcItem = reorderItems.find(p => p.id === dragSrcId);
    const tgtItem = reorderItems.find(p => p.id === targetId);
    if (!srcItem || !tgtItem) return;

    // Only allow reordering within the same category
    if (srcItem.category_id !== tgtItem.category_id) {
      setDragSrcId(null);
      setDragOverId(null);
      return;
    }

    const newItems = [...reorderItems];
    const srcIdx = newItems.findIndex(p => p.id === dragSrcId);
    const tgtIdx = newItems.findIndex(p => p.id === targetId);
    newItems.splice(srcIdx, 1);
    newItems.splice(tgtIdx, 0, srcItem);

    setReorderItems(newItems);
    setDirty(true);
    setDragSrcId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragSrcId(null);
    setDragOverId(null);
  };

  // ── Save reorder ──────────────────────────────────────────────────────────
  const handleSaveReorder = async () => {
    setSaving(true);
    try {
      // Assign sequential display_order per category group
      const payload: { id: string; display_order: number }[] = [];
      const byCategory = new Map<string, Product[]>();

      for (const p of reorderItems) {
        if (!byCategory.has(p.category_id)) byCategory.set(p.category_id, []);
        byCategory.get(p.category_id)!.push(p);
      }
      for (const [, prods] of byCategory) {
        prods.forEach((p, idx) => payload.push({ id: p.id, display_order: idx + 1 }));
      }

      await adminApi.reorderProducts(payload);
      setDirty(false);
      setReorderMode(false);
      reload();
    } catch (e) {
      alert(e instanceof Error ? t('errSaveOrder', { error: e.message }) : t('errSaveOrderRetry'));
    } finally {
      setSaving(false);
    }
  };

  // ── Build grouped structure for reorder view ──────────────────────────────
  const groupedReorder = (() => {
    const catOrder: string[] = [];
    const groups = new Map<string, { titleEn: string; titleAr: string; items: Product[] }>();
    for (const p of reorderItems) {
      if (!groups.has(p.category_id)) {
        catOrder.push(p.category_id);
        groups.set(p.category_id, {
          titleEn: p.category_title_en || p.category_id,
          titleAr: p.category_title_ar || '',
          items: [],
        });
      }
      groups.get(p.category_id)!.items.push(p);
    }
    return catOrder.map(id => ({ id, ...groups.get(id)! }));
  })();

  // ═══════════════════════════════════════════════════════════════════════════
  // ── REORDER MODE VIEW ─────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  if (reorderMode) {
    return (
      <div>
        <div className="adm-page-header">
          <div>
            <h1 className="adm-page-title">{t('reorderTitle')}</h1>
            <p className="adm-page-subtitle">
              {t('reorderSubtitle')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="adm-btn adm-btn-secondary adm-btn-sm"
              onClick={cancelReorder}
              disabled={saving}
            >
              {tc('cancel')}
            </button>
            <button
              className={`adm-btn adm-btn-sm ${dirty ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
              onClick={handleSaveReorder}
              disabled={!dirty || saving}
            >
              {saving ? t('savingOrder') : dirty ? t('saveOrder') : t('noChanges')}
            </button>
          </div>
        </div>

        {reorderItems.length === 0 && (
          <div className="adm-alert" style={{ marginTop: 16 }}>
            {t('noProductsLoaded')}
          </div>
        )}

        {groupedReorder.map(group => (
          <div key={group.id} className="adm-card" style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
            {/* Category header */}
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--adm-border)',
              background: 'var(--adm-surface2)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              {/* The admin language first, the other one beside it. */}
              {t.lang === 'ar' && group.titleAr ? (
                <>
                  <strong style={{ fontSize: 14 }} dir="rtl">{group.titleAr}</strong>
                  <span className="adm-text-muted" style={{ fontSize: 13 }} dir="ltr">{group.titleEn}</span>
                </>
              ) : (
                <>
                  <strong style={{ fontSize: 14 }} dir="ltr">{group.titleEn}</strong>
                  {group.titleAr && (
                    <span className="adm-text-muted" style={{ fontSize: 13 }} dir="rtl">{group.titleAr}</span>
                  )}
                </>
              )}
              <span className="adm-badge adm-badge-blue" style={{ marginInlineStart: 'auto', fontSize: 11 }}>
                {t.plural('groupCount', group.items.length)}
              </span>
            </div>

            {/* Draggable rows */}
            {group.items.map((p) => {
              const isDragging = dragSrcId === p.id;
              const isOver = dragOverId === p.id && dragSrcId !== p.id;
              const srcInSameCat = dragSrcId
                ? reorderItems.find(x => x.id === dragSrcId)?.category_id === p.category_id
                : false;

              return (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, p.id)}
                  onDragOver={(e) => handleDragOver(e, p.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, p.id)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '9px 16px',
                    borderBottom: '1px solid var(--adm-border)',
                    background: isDragging
                      ? 'rgba(99, 102, 241, 0.05)'
                      : isOver && srcInSameCat
                        ? 'rgba(99, 102, 241, 0.1)'
                        : 'transparent',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    opacity: isDragging ? 0.45 : 1,
                    borderInlineStart: isOver && srcInSameCat
                      ? '3px solid var(--adm-primary, #6366f1)'
                      : '3px solid transparent',
                    transition: 'background 0.12s, border-color 0.12s, opacity 0.12s',
                  }}
                >
                  {/* Drag handle */}
                  <span style={{
                    fontSize: 20,
                    color: 'var(--adm-text-dim)',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}>
                    ⠿
                  </span>

                  {/* Thumbnail */}
                  {p.image ? (
                    <img
                      src={resolveAdminImage(p.image)}
                      alt={p.alt_en || p.name_en}
                      draggable={false}
                      style={{
                        width: 38,
                        height: 38,
                        objectFit: 'contain',
                        borderRadius: 6,
                        background: 'var(--adm-surface2)',
                        flexShrink: 0,
                      }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{
                      width: 38, height: 38,
                      borderRadius: 6,
                      background: 'var(--adm-surface2)',
                      flexShrink: 0,
                    }} />
                  )}

                  {/* Names */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name_en}
                    </div>
                    <div dir="rtl" style={{ fontSize: 12, color: 'var(--adm-text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name_ar}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={`adm-badge ${p.active ? 'adm-badge-green' : 'adm-badge-red'}`} style={{ fontSize: 11, flexShrink: 0 }}>
                    {p.active ? tc('active') : tc('hidden')}
                  </span>

                  {/* Brand badge */}
                  <span className={`adm-badge ${p.brand === 'DIOX' ? 'adm-badge-blue' : 'adm-badge-green'}`} style={{ fontSize: 11, flexShrink: 0 }}>
                    {p.brand}
                  </span>
                </div>
              );
            })}
          </div>
        ))}

        {/* Bottom save bar */}
        {dirty && (
          <div style={{
            position: 'sticky',
            bottom: 16,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 0',
          }}>
            <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={cancelReorder} disabled={saving}>
              {t('discard')}
            </button>
            <button className="adm-btn adm-btn-primary" onClick={handleSaveReorder} disabled={saving}>
              {saving ? t('savingOrder') : t('saveNewOrder')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── NORMAL TABLE VIEW ─────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{t('title')}</h1>
          <p className="adm-page-subtitle">{t('subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={enterReorderMode}
            title={t('reorderHint')}
            disabled={loading || products.length === 0}
          >
            {t('reorder')}
          </button>
          {/* CSV round-trip — export downloads the active brand filter
              (or full catalogue), import opens a two-step preview/apply
              modal. See server/routes/admin-products.mjs for the
              column schema and validation rules. */}
          <a
            href={adminApi.productsExportCsvUrl(brand || undefined)}
            className="adm-btn adm-btn-ghost adm-btn-sm"
            title={brand
              ? t('exportBrandTitle', { brand })
              : t('exportAllTitle')}
            download
            target="_self"
            rel="noopener"
          >
            {t('exportCsv')}
          </a>
          <button
            type="button"
            className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={() => setCsvImportOpen(true)}
            title={t('importTitle')}
          >
            {t('importCsv')}
          </button>
          <Link to="/admin/categories" className="adm-btn adm-btn-secondary adm-btn-sm">
            {t('manageCategories')}
          </Link>
          <Link to="/admin/products/new" className="adm-btn adm-btn-primary adm-btn-sm">
            {t('addProduct')}
          </Link>
        </div>
      </div>

      <ProductCsvImportModal
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        onComplete={reload}
      />

      <div className="adm-card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Brand filter */}
        {(['', 'DIOX', 'AYLUX'] as const).map((b) => (
          <button
            key={b || 'all'}
            className={`adm-btn adm-btn-sm ${brand === b ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
            onClick={() => setBrand(b)}
          >
            {b || t('allBrands')}
          </button>
        ))}

        {/* Show-hidden toggle */}
        <button
          className={`adm-btn adm-btn-sm ${showHidden ? 'adm-btn-warning' : 'adm-btn-ghost'}`}
          onClick={() => setShowHidden(v => !v)}
          title={showHidden ? t('hiddenShownTitle') : t('showHiddenTitle')}
        >
          {showHidden ? t('hideHidden') : t('showHidden')}
        </button>

        {/* D5 status filter */}
        <select
          className="adm-input adm-input-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | 'draft' | 'scheduled' | 'published')}
          style={{ width: 160 }}
          title={t('statusFilterTitle')}
        >
          <option value="">{t('allStatuses')}</option>
          <option value="published">{t('filterPublished')}</option>
          <option value="draft">{t('filterDrafts')}</option>
          <option value="scheduled">{t('filterScheduled')}</option>
        </select>

        {/* Search */}
        <input
          type="search"
          className="adm-input adm-input-sm"
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ marginInlineStart: 'auto', width: 220 }}
        />

        {/* Count */}
        <span className="adm-text-muted adm-text-sm">
          {t('countOf', { shown: filtered.length, total: products.length })}
          {hiddenCount > 0 && (
            <span style={{ color: 'var(--adm-danger)', marginInlineStart: 4 }}>
              {t('hiddenCount', { n: hiddenCount })}
            </span>
          )}
        </span>
      </div>

      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> {tc('loading')}</div>}
      {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

      {!loading && (
        <div className="adm-card" style={{ padding: 0 }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>{tc('image')}</th>
                  <th style={{ textAlign: 'right' }}>{t('colNameAr')}</th>
                  <th>{t('colNameEn')}</th>
                  <th>{t('colBrand')}</th>
                  <th>{t('colCategory')}</th>
                  <th>{t('colOrder')}</th>
                  <th>{t('colVisibility')}</th>
                  <th>{t('colPublishing')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>
                      {t('empty')}
                    </td>
                  </tr>
                ) : filtered.map((p: Product) => {
                  const status = (p.status || 'published') as 'draft' | 'scheduled' | 'published';
                  const statusBadge =
                    status === 'draft'     ? { color: 'adm-badge-warning', text: t('badgeDraft') } :
                    status === 'scheduled' ? { color: 'adm-badge-blue',    text: t('badgeScheduled') } :
                                             { color: 'adm-badge-green',   text: t('badgeLive') };
                  return (
                    <tr
                      key={p.id}
                      style={!p.active ? { opacity: 0.45, background: 'rgba(255,60,60,0.04)' } : undefined}
                    >
                      <td>
                        {p.image ? (
                          <img
                            src={resolveAdminImage(p.image)}
                            alt={p.alt_en || p.name_en}
                            style={{ width: 40, height: 40, objectFit: 'contain', background: 'var(--adm-surface2)', borderRadius: 4 }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : <span className="adm-text-muted">—</span>}
                      </td>
                      <td dir="rtl" style={{ maxWidth: 160, textAlign: 'right' }} className="adm-truncate">{p.name_ar}</td>
                      <td style={{ maxWidth: 160 }} className="adm-truncate">{p.name_en}</td>
                      <td><span className={`adm-badge ${p.brand === 'DIOX' ? 'adm-badge-blue' : 'adm-badge-green'}`}>{p.brand}</span></td>
                      <td className="adm-text-sm adm-text-muted">
                        {(t.lang === 'ar' ? p.category_title_ar || p.category_title_en : p.category_title_en) || p.category_id}
                      </td>
                      <td className="adm-text-sm adm-text-muted">{fmtNumber(p.display_order)}</td>
                      <td>
                        <span className={`adm-badge ${p.active ? 'adm-badge-green' : 'adm-badge-red'}`}>
                          {p.active ? tc('active') : tc('hidden')}
                        </span>
                      </td>
                      <td>
                        <span className={`adm-badge ${statusBadge.color}`}>{statusBadge.text}</span>
                        {status === 'scheduled' && p.publish_at && (
                          <div style={{ fontSize: 10, color: 'var(--adm-text-dim)', marginTop: 2 }}>
                            {fmtDateTime(p.publish_at)}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Link to={`/admin/products/${p.id}`} className="adm-btn adm-btn-ghost adm-btn-sm">{tc('edit')}</Link>
                          <button
                            className="adm-btn adm-btn-danger adm-btn-sm"
                            onClick={() => handleDelete(p.id)}
                            disabled={deleting === p.id}
                            aria-label={t('deleteLabel', { name: p.name_en || p.name_ar || p.id })}
                            title={t('deleteTitle')}
                          >
                            {deleting === p.id ? '…' : '🗑'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
