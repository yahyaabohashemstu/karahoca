import React, { useState } from 'react';
import { adminApi, type ProductCategory } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { Alert, BrandBadge, Button, Card, EmptyState, Field, IconButton, Loading, NumberInput, PageHeader, Tabs, Toolbar } from '../ui';

const messages = defineMessages({
  en: {
    title: 'Product categories',
    subtitle: 'Manage the category structure used by the product catalog',
    addCategory: 'Add category',
    allBrands: 'All brands',
    brandFilter: 'Brand',
    count: { one: '{n} category', other: '{n} categories' },
    createCategory: 'Create category',
    editCategory: 'Edit category',
    brand: 'Brand',
    brandLocked: "The brand can't be changed after a category is created.",
    key: 'Key',
    titleAr: 'Arabic title',
    titleEn: 'English title',
    titleTr: 'Turkish title',
    titleRu: 'Russian title',
    displayOrder: 'Display order',
    saveCategory: 'Save category',
    colBrand: 'Brand',
    colKey: 'Key',
    colTitleAr: 'Title (AR)',
    colTitleEn: 'Title (EN)',
    colOrder: 'Order',
    empty: 'No categories found.',
    editLabel: 'Edit category {name}',
    deleteLabel: 'Delete category {name}',
    confirmDelete: 'Delete category "{name}"?',
    errRequired: 'Brand, key, Arabic title, and English title are required.',
    errSave: 'Failed to save category',
    errDelete: 'Failed to delete category',
  },
  ar: {
    title: 'فئات المنتجات',
    subtitle: 'إدارة بنية الفئات المستخدمة في كتالوج المنتجات',
    addCategory: 'إضافة فئة',
    allBrands: 'كل العلامات التجارية',
    brandFilter: 'العلامة التجارية',
    count: {
      zero: 'لا توجد فئات',
      one: 'فئة واحدة',
      two: 'فئتان',
      few: '{n} فئات',
      many: '{n} فئة',
      other: '{n} فئة',
    },
    createCategory: 'إنشاء فئة',
    editCategory: 'تعديل الفئة',
    brand: 'العلامة التجارية',
    brandLocked: 'لا يمكن تغيير العلامة التجارية بعد إنشاء الفئة.',
    key: 'المفتاح',
    titleAr: 'العنوان بالعربية',
    titleEn: 'العنوان بالإنجليزية',
    titleTr: 'العنوان بالتركية',
    titleRu: 'العنوان بالروسية',
    displayOrder: 'ترتيب العرض',
    saveCategory: 'حفظ الفئة',
    colBrand: 'العلامة التجارية',
    colKey: 'المفتاح',
    colTitleAr: 'العنوان (AR)',
    colTitleEn: 'العنوان (EN)',
    colOrder: 'الترتيب',
    empty: 'لا توجد فئات.',
    editLabel: 'تعديل الفئة {name}',
    deleteLabel: 'حذف الفئة {name}',
    confirmDelete: 'حذف الفئة «{name}»؟',
    errRequired: 'العلامة التجارية والمفتاح والعنوان بالعربية والعنوان بالإنجليزية حقول مطلوبة.',
    errSave: 'تعذّر حفظ الفئة',
    errDelete: 'تعذّر حذف الفئة',
  },
});

type BrandFilter = '' | 'DIOX' | 'AYLUX';

const emptyCategory = (brand: 'DIOX' | 'AYLUX' = 'DIOX'): Partial<ProductCategory> => ({
  brand,
  key: '',
  title_ar: '',
  title_en: '',
  title_tr: '',
  title_ru: '',
  display_order: 0,
});

export const AdminCategories: React.FC = () => {
  const [brand, setBrand] = useState<BrandFilter>('');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<Partial<ProductCategory>>(emptyCategory());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const t = useT(messages);
  const tc = useT(common);

  const { data, loading, error: loadError, reload } = useAsync(
    () => adminApi.getCategories(brand || undefined),
    [brand]
  );

  const categories = data?.categories ?? [];

  const set = (key: keyof ProductCategory, value: string | number) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const startNew = () => {
    setEditing('new');
    setError('');
    setForm(emptyCategory(brand || 'DIOX'));
  };

  const startEdit = (category: ProductCategory) => {
    setEditing(category.id);
    setError('');
    setForm(category);
  };

  const resetForm = () => {
    setEditing(null);
    setError('');
    setForm(emptyCategory(brand || 'DIOX'));
  };

  const save = async () => {
    if (!form.brand || !form.key?.trim() || !form.title_ar?.trim() || !form.title_en?.trim()) {
      setError(t('errRequired'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editing === 'new') {
        await adminApi.createCategory({
          ...form,
          display_order: Number(form.display_order || 0),
        });
      } else if (typeof editing === 'string') {
        await adminApi.updateCategory(editing, {
          ...form,
          display_order: Number(form.display_order || 0),
        });
      }
      resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errSave'));
    } finally {
      setSaving(false);
    }
  };

  const nameOf = (category: ProductCategory) =>
    (t.lang === 'ar' ? category.title_ar || category.title_en : category.title_en) || category.key || category.id;

  const handleDelete = async (category: ProductCategory) => {
    const name = (t.lang === 'ar' ? category.title_ar || category.title_en : category.title_en) || category.id;
    if (!confirm(t('confirmDelete', { name }))) return;
    setActionError('');
    try {
      await adminApi.deleteCategory(category.id);
      await reload();
      if (editing === category.id) resetForm();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('errDelete'));
    }
  };

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={(
          // While the form is open its Save is the page's main action.
          <Button variant={editing ? 'secondary' : 'primary'} icon="plus" onClick={startNew}>
            {t('addCategory')}
          </Button>
        )}
      />

      <Toolbar end={<span className="adm-text-muted adm-text-sm">{t.plural('count', categories.length)}</span>}>
        <Tabs<BrandFilter>
          variant="segmented"
          ariaLabel={t('brandFilter')}
          value={brand}
          onChange={(value) => {
            setBrand(value);
            resetForm();
          }}
          items={[
            { value: '', label: t('allBrands') },
            { value: 'DIOX', label: 'DIOX' },
            { value: 'AYLUX', label: 'AYLUX' },
          ]}
        />
      </Toolbar>

      {editing !== null && (
        <Card
          title={editing === 'new' ? t('createCategory') : t('editCategory')}
          icon={editing === 'new' ? 'plus' : 'edit'}
          className="adm-mb-16"
        >
          <div className="adm-form-grid">
            {/* The server never updates a category's brand (its products
                stay under the old one), so changing it here was silently
                ignored. Only a new category can pick its brand. */}
            <Field label={t('brand')} required hint={editing !== 'new' ? t('brandLocked') : undefined}>
              <select
                className="adm-select"
                value={form.brand || 'DIOX'}
                onChange={(e) => set('brand', e.target.value as 'DIOX' | 'AYLUX')}
                disabled={editing !== 'new'}
              >
                <option value="DIOX">DIOX</option>
                <option value="AYLUX">AYLUX</option>
              </select>
            </Field>
            <Field label={t('key')} required>
              <input className="adm-input" dir="ltr" value={form.key || ''} onChange={(e) => set('key', e.target.value)} placeholder="homeCleaning" />
            </Field>
            <Field label={t('titleAr')} required>
              <input className="adm-input" dir="rtl" value={form.title_ar || ''} onChange={(e) => set('title_ar', e.target.value)} />
            </Field>
            <Field label={t('titleEn')} required>
              <input className="adm-input" dir="ltr" value={form.title_en || ''} onChange={(e) => set('title_en', e.target.value)} />
            </Field>
            <Field label={t('titleTr')}>
              <input className="adm-input" dir="ltr" value={form.title_tr || ''} onChange={(e) => set('title_tr', e.target.value)} />
            </Field>
            <Field label={t('titleRu')}>
              <input className="adm-input" dir="ltr" value={form.title_ru || ''} onChange={(e) => set('title_ru', e.target.value)} />
            </Field>
            <Field label={t('displayOrder')}>
              <NumberInput
                className="adm-input"
                style={{ maxWidth: 180 }}
                value={form.display_order ?? 0}
                onChange={(e) => set('display_order', Number(e.target.value))}
              />
            </Field>
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

          <div className="adm-flex">
            <Button variant="primary" icon="save" onClick={save} loading={saving}>
              {saving ? tc('saving') : t('saveCategory')}
            </Button>
            <Button variant="ghost" onClick={resetForm}>{tc('cancel')}</Button>
          </div>
        </Card>
      )}

      {loadError && <Alert tone="danger">{loadError}</Alert>}
      {actionError && <Alert tone="danger">{actionError}</Alert>}

      {loading ? <Loading label={tc('loading')} /> : (
        <Card flush>
          {categories.length === 0 ? (
            <EmptyState icon="categories" title={t('empty')} />
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>{t('colBrand')}</th>
                    <th>{t('colKey')}</th>
                    <th>{t('colTitleAr')}</th>
                    <th>{t('colTitleEn')}</th>
                    <th>{t('colOrder')}</th>
                    <th className="adm-col-actions"><span className="adm-sr-only">{tc('actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <BrandBadge brand={category.brand} />
                      </td>
                      <td className="adm-mono">{category.key}</td>
                      <td dir="rtl">{category.title_ar}</td>
                      <td className="adm-cell-ltr">{category.title_en}</td>
                      <td>{fmtNumber(category.display_order)}</td>
                      <td className="adm-col-actions">
                        <div className="adm-row-actions">
                          <IconButton
                            icon="edit"
                            size="sm"
                            label={t('editLabel', { name: nameOf(category) })}
                            onClick={() => startEdit(category)}
                          />
                          <IconButton
                            icon="trash"
                            tone="danger"
                            size="sm"
                            label={t('deleteLabel', { name: nameOf(category) })}
                            onClick={() => handleDelete(category)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
