import React, { useState } from 'react';
import { adminApi, type Product } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { resolveAdminImage } from '../../utils/image';
import { ProductCsvImportModal } from '../components/ProductCsvImportModal';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { AdminIcon, Alert, Badge, BrandBadge, Button, Card, EmptyState, IconButton, Loading, PageHeader, StatusBadge, Tabs, Toolbar } from '../ui';

const messages = defineMessages({
  en: {
    confirmDelete: 'Delete this product? It will be hidden from the public site.\n\nTo permanently remove it, use "Edit" and then contact your admin.',
    errDelete: 'Failed to delete product',
    confirmDiscard: 'Discard unsaved order changes?',
    errSaveOrder: 'Failed to save order: {error}',
    errSaveOrderRetry: 'Failed to save order. Please try again.',
    reorderTitle: 'Reorder products',
    reorderSubtitle: 'Drag rows within each category to change display order. Cross-category drag is disabled.',
    saveOrder: 'Save order',
    noChanges: 'No changes',
    noProductsLoaded: 'No products loaded. Close and open a brand filter first.',
    groupCount: { one: '{n} product', other: '{n} products' },
    discard: 'Discard',
    saveNewOrder: 'Save new order',
    title: 'Products',
    subtitle: 'Manage DIOX and AYLUX product catalog',
    reorderHint: 'Drag-and-drop to reorder products within categories',
    reorder: 'Reorder',
    exportBrandTitle: 'Download {brand} products as CSV',
    exportAllTitle: 'Download full product catalogue as CSV',
    importTitle: 'Bulk-import or update products from a CSV file',
    importCsv: 'Import CSV',
    manageCategories: 'Manage categories',
    addProduct: 'Add product',
    allBrands: 'All brands',
    brandFilter: 'Filter by brand',
    showHiddenTitle: 'Show hidden/deleted products',
    showHidden: 'Show hidden',
    statusFilterTitle: 'Filter by publishing status',
    allStatuses: 'All statuses',
    filterPublished: 'Published',
    filterDrafts: 'Drafts',
    filterScheduled: 'Scheduled',
    searchPlaceholder: 'Search by name, category, brand…',
    countOf: '{shown} of {total}',
    hiddenCount: '{n} hidden',
    colNameAr: 'Name (AR)',
    colNameEn: 'Name (EN)',
    colBrand: 'Brand',
    colCategory: 'Category',
    colOrder: 'Order',
    colVisibility: 'Visibility',
    colPublishing: 'Publishing',
    empty: 'No products found.',
    emptyText: 'Products you add appear in the site\'s catalogue.',
    noMatch: 'No product matches these filters.',
    publishes: 'Publishes: {at}',
    deleteLabel: 'Delete product {name}',
    editLabel: 'Edit product {name}',
  },
  ar: {
    confirmDelete: 'حذف هذا المنتج؟ سيُخفى من الموقع العام.\n\nلإزالته نهائيًا، افتح «تعديل» ثم تواصل مع مسؤول الموقع.',
    errDelete: 'تعذّر حذف المنتج',
    confirmDiscard: 'تجاهل تغييرات الترتيب غير المحفوظة؟',
    errSaveOrder: 'تعذّر حفظ الترتيب: {error}',
    errSaveOrderRetry: 'تعذّر حفظ الترتيب. أعد المحاولة.',
    reorderTitle: 'إعادة ترتيب المنتجات',
    reorderSubtitle: 'اسحب الصفوف داخل كل فئة لتغيير ترتيب العرض. لا يمكن السحب بين فئات مختلفة.',
    saveOrder: 'حفظ الترتيب',
    noChanges: 'لا توجد تغييرات',
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
    saveNewOrder: 'حفظ الترتيب الجديد',
    title: 'المنتجات',
    subtitle: 'إدارة كتالوج منتجات DIOX و AYLUX',
    reorderHint: 'اسحب المنتجات وأفلتها لإعادة ترتيبها داخل الفئات',
    reorder: 'إعادة الترتيب',
    exportBrandTitle: 'تنزيل منتجات {brand} بصيغة CSV',
    exportAllTitle: 'تنزيل كتالوج المنتجات كاملًا بصيغة CSV',
    importTitle: 'استيراد المنتجات أو تحديثها دفعةً واحدة من ملف CSV',
    importCsv: 'استيراد CSV',
    manageCategories: 'إدارة الفئات',
    addProduct: 'إضافة منتج',
    allBrands: 'كل العلامات التجارية',
    brandFilter: 'التصفية حسب العلامة التجارية',
    showHiddenTitle: 'عرض المنتجات المخفية والمحذوفة',
    showHidden: 'عرض المخفية',
    statusFilterTitle: 'التصفية حسب حالة النشر',
    allStatuses: 'كل الحالات',
    filterPublished: 'المنشورة',
    filterDrafts: 'المسودات',
    filterScheduled: 'المجدولة',
    searchPlaceholder: 'ابحث بالاسم أو الفئة أو العلامة التجارية…',
    countOf: '{shown} من {total}',
    hiddenCount: 'المخفية: {n}',
    colNameAr: 'الاسم (AR)',
    colNameEn: 'الاسم (EN)',
    colBrand: 'العلامة التجارية',
    colCategory: 'الفئة',
    colOrder: 'الترتيب',
    colVisibility: 'الظهور',
    colPublishing: 'النشر',
    empty: 'لا توجد منتجات.',
    emptyText: 'تظهر المنتجات التي تضيفها في كتالوج الموقع.',
    noMatch: 'لا يوجد منتج يطابق عوامل التصفية هذه.',
    publishes: 'يُنشر في: {at}',
    deleteLabel: 'حذف المنتج {name}',
    editLabel: 'تعديل المنتج {name}',
  },
});

type BrandFilter = '' | 'DIOX' | 'AYLUX';
type StatusFilter = '' | 'draft' | 'scheduled' | 'published';


export const AdminProducts: React.FC = () => {
  // ── Browse state ──────────────────────────────────────────────────────────
  const [brand, setBrand] = useState<BrandFilter>('');
  const [showHidden, setShowHidden] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  // D5: client-side status filter. The list endpoint returns ALL
  // statuses for admin views, so filtering here keeps the query
  // surface unchanged while letting the admin focus on drafts /
  // scheduled / published.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

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
    setActionError('');
    try {
      await adminApi.deleteProduct(id);
      reload();
    } catch (e) {
      // Show the real reason (e.g. "session expired — sign in again").
      setActionError(e instanceof Error ? e.message : t('errDelete'));
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
    setActionError('');
    setReorderMode(true);
  };

  const cancelReorder = () => {
    if (dirty && !confirm(t('confirmDiscard'))) return;
    setReorderMode(false);
    setDragSrcId(null);
    setDragOverId(null);
    setDirty(false);
    setActionError('');
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
    setActionError('');
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
      setActionError(e instanceof Error ? t('errSaveOrder', { error: e.message }) : t('errSaveOrderRetry'));
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
        <PageHeader
          title={t('reorderTitle')}
          subtitle={t('reorderSubtitle')}
          actions={(
            <>
              <Button onClick={cancelReorder} disabled={saving}>
                {tc('cancel')}
              </Button>
              <Button
                variant={dirty ? 'primary' : 'ghost'}
                icon={dirty ? 'save' : 'check'}
                onClick={handleSaveReorder}
                disabled={!dirty}
                loading={saving}
              >
                {saving ? tc('saving') : dirty ? t('saveOrder') : t('noChanges')}
              </Button>
            </>
          )}
        />

        {actionError && <Alert tone="danger">{actionError}</Alert>}

        {reorderItems.length === 0 && (
          <Alert tone="info">{t('noProductsLoaded')}</Alert>
        )}

        <div className="adm-stack">
          {groupedReorder.map(group => {
            // The admin language first, the other one beside it.
            const arFirst = t.lang === 'ar' && Boolean(group.titleAr);
            const primary = arFirst
              ? <span dir="rtl">{group.titleAr}</span>
              : <span dir="ltr">{group.titleEn}</span>;
            const secondary = arFirst
              ? <span dir="ltr">{group.titleEn}</span>
              : group.titleAr ? <span dir="rtl">{group.titleAr}</span> : undefined;
            return (
              <Card
                key={group.id}
                flush
                icon="categories"
                title={primary}
                subtitle={secondary}
                actions={<Badge tone="info">{t.plural('groupCount', group.items.length)}</Badge>}
              >
                {/* Draggable rows */}
                {group.items.map((p) => {
                  const isDragging = dragSrcId === p.id;
                  const isOver = dragOverId === p.id && dragSrcId !== p.id;
                  const srcInSameCat = dragSrcId
                    ? reorderItems.find(x => x.id === dragSrcId)?.category_id === p.category_id
                    : false;
                  const isTarget = isOver && srcInSameCat;

                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id)}
                      onDragOver={(e) => handleDragOver(e, p.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, p.id)}
                      onDragEnd={handleDragEnd}
                      className={`adm-drag-row${isDragging ? ' is-dragging' : ''}${isTarget ? ' is-drop-target' : ''}`}
                    >
                      <span className="adm-drag-handle">
                        <AdminIcon name="grip" size="md" />
                      </span>

                      {/* Thumbnail */}
                      {p.image ? (
                        <img
                          src={resolveAdminImage(p.image)}
                          alt={p.alt_en || p.name_en}
                          draggable={false}
                          className="adm-thumb-sq"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="adm-thumb-sq" />
                      )}

                      {/* Names: the admin language first, as in the group titles. */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {t.lang === 'ar' && p.name_ar ? (
                          <>
                            <strong dir="rtl" className="adm-truncate" style={{ display: 'block' }}>{p.name_ar}</strong>
                            <div className="adm-truncate adm-cell-ltr adm-text-sm adm-text-muted">{p.name_en}</div>
                          </>
                        ) : (
                          <>
                            <strong className="adm-truncate adm-cell-ltr" style={{ display: 'block' }}>{p.name_en}</strong>
                            <div dir="rtl" className="adm-truncate adm-text-sm adm-text-muted">{p.name_ar}</div>
                          </>
                        )}
                      </div>

                      <StatusBadge status={p.active ? 'active' : 'hidden'} />
                      <BrandBadge brand={p.brand} />
                    </div>
                  );
                })}
              </Card>
            );
          })}
        </div>

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
            <Button onClick={cancelReorder} disabled={saving}>
              {t('discard')}
            </Button>
            <Button variant="primary" icon="save" onClick={handleSaveReorder} loading={saving}>
              {saving ? tc('saving') : t('saveNewOrder')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── NORMAL TABLE VIEW ─────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const filtersActive = Boolean(searchQuery.trim() || statusFilter);

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={(
          <>
            <Button
              icon="sort"
              onClick={enterReorderMode}
              title={t('reorderHint')}
              disabled={loading || products.length === 0}
            >
              {t('reorder')}
            </Button>
            {/* CSV round-trip — export downloads the active brand filter
                (or full catalogue), import opens a two-step preview/apply
                modal. See server/routes/admin-products.mjs for the
                column schema and validation rules. */}
            <Button
              icon="download"
              href={adminApi.productsExportCsvUrl(brand || undefined)}
              title={brand
                ? t('exportBrandTitle', { brand })
                : t('exportAllTitle')}
              download
              target="_self"
              rel="noopener"
            >
              {tc('exportCsv')}
            </Button>
            <Button icon="upload" onClick={() => setCsvImportOpen(true)} title={t('importTitle')}>
              {t('importCsv')}
            </Button>
            <Button icon="categories" to="/admin/categories">
              {t('manageCategories')}
            </Button>
            <Button variant="primary" icon="plus" to="/admin/products/new">
              {t('addProduct')}
            </Button>
          </>
        )}
      />

      <ProductCsvImportModal
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        onComplete={reload}
      />

      <Toolbar
        end={(
          <>
            <span className="adm-text-muted adm-text-sm">
              {t('countOf', { shown: filtered.length, total: products.length })}
            </span>
            {hiddenCount > 0 && (
              <Badge tone="neutral" icon="eyeOff">{t('hiddenCount', { n: hiddenCount })}</Badge>
            )}
          </>
        )}
      >
        {/* Brand filter */}
        <Tabs<BrandFilter>
          variant="segmented"
          ariaLabel={t('brandFilter')}
          value={brand}
          onChange={setBrand}
          items={[
            { value: '', label: t('allBrands') },
            { value: 'DIOX', label: 'DIOX' },
            { value: 'AYLUX', label: 'AYLUX' },
          ]}
        />

        {/* Show-hidden toggle */}
        <label className="adm-check" title={t('showHiddenTitle')}>
          <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />
          <span>{t('showHidden')}</span>
        </label>

        {/* D5 status filter */}
        <select
          className="adm-select adm-select-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          title={t('statusFilterTitle')}
          aria-label={t('statusFilterTitle')}
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
          aria-label={tc('search')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </Toolbar>

      {error && <Alert tone="danger">{error}</Alert>}
      {actionError && <Alert tone="danger">{actionError}</Alert>}

      {loading ? <Loading label={tc('loading')} /> : (
        <Card flush>
          {filtered.length === 0 ? (
            products.length > 0 && filtersActive
              ? <EmptyState icon="search" title={t('noMatch')} compact />
              : (
                <EmptyState
                  icon="products"
                  title={t('empty')}
                  text={t('emptyText')}
                  action={<Button to="/admin/products/new" variant="primary" icon="plus" size="sm">{t('addProduct')}</Button>}
                />
              )
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>{tc('image')}</th>
                    <th>{t('colNameAr')}</th>
                    <th>{t('colNameEn')}</th>
                    <th>{t('colBrand')}</th>
                    <th>{t('colCategory')}</th>
                    <th>{t('colOrder')}</th>
                    <th>{t('colVisibility')}</th>
                    <th>{t('colPublishing')}</th>
                    <th className="adm-col-actions"><span className="adm-sr-only">{tc('actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p: Product) => {
                    const status = (p.status || 'published') as 'draft' | 'scheduled' | 'published';
                    const name = p.name_en || p.name_ar || p.id;
                    return (
                      // Hidden (and deleted) products stay listed but dimmed.
                      <tr key={p.id} className={p.active ? undefined : 'adm-row-dim'}>
                        <td>
                          {p.image ? (
                            <img
                              src={resolveAdminImage(p.image)}
                              alt={p.alt_en || p.name_en}
                              className="adm-thumb-sq"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : <span className="adm-text-muted">—</span>}
                        </td>
                        <td dir="rtl" className="adm-truncate" style={{ maxWidth: 160 }}>{p.name_ar}</td>
                        <td className="adm-truncate adm-cell-ltr" style={{ maxWidth: 160 }}>{p.name_en}</td>
                        <td><BrandBadge brand={p.brand} /></td>
                        <td className="adm-text-sm adm-text-muted">
                          {(t.lang === 'ar' ? p.category_title_ar || p.category_title_en : p.category_title_en) || p.category_id}
                        </td>
                        <td className="adm-text-sm adm-text-muted">{fmtNumber(p.display_order)}</td>
                        <td>
                          <StatusBadge status={p.active ? 'active' : 'hidden'} />
                        </td>
                        <td>
                          <StatusBadge
                            status={status}
                            title={status === 'scheduled' && p.publish_at
                              ? t('publishes', { at: fmtDateTime(p.publish_at) })
                              : undefined}
                          />
                          {status === 'scheduled' && p.publish_at && (
                            <div className="adm-text-sm adm-text-muted" style={{ marginTop: 4 }}>
                              {fmtDateTime(p.publish_at)}
                            </div>
                          )}
                        </td>
                        <td className="adm-col-actions">
                          <div className="adm-row-actions">
                            <IconButton icon="edit" label={t('editLabel', { name })} size="sm" to={`/admin/products/${p.id}`} />
                            <IconButton
                              icon="trash"
                              tone="danger"
                              size="sm"
                              label={t('deleteLabel', { name })}
                              onClick={() => handleDelete(p.id)}
                              loading={deleting === p.id}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
