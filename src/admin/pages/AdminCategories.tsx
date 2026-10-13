import React, { useState } from 'react';
import { adminApi, type ProductCategory } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

const messages = defineMessages({
  en: {
    title: 'Product Categories',
    subtitle: 'Manage the category structure used by the product catalog',
    addCategory: '+ Add Category',
    allBrands: 'All Brands',
    count: { one: '{n} category', other: '{n} categories' },
    createCategory: 'Create Category',
    editCategory: 'Edit Category',
    brandRequired: 'Brand *',
    brandLocked: "The brand can't be changed after a category is created.",
    keyRequired: 'Key *',
    titleArRequired: 'Arabic title *',
    titleEnRequired: 'English title *',
    titleTr: 'Turkish title',
    titleRu: 'Russian title',
    displayOrder: 'Display order',
    saveCategory: '💾 Save Category',
    colBrand: 'Brand',
    colKey: 'Key',
    colTitleAr: 'Title (AR)',
    colTitleEn: 'Title (EN)',
    colOrder: 'Order',
    empty: 'No categories found.',
    deleteLabel: 'Delete category {name}',
    deleteTitle: 'Delete category',
    confirmDelete: 'Delete category "{name}"?',
    errRequired: 'Brand, key, Arabic title, and English title are required.',
    errSave: 'Failed to save category',
    errDelete: 'Failed to delete category',
  },
  ar: {
    title: 'فئات المنتجات',
    subtitle: 'إدارة بنية الفئات المستخدمة في كتالوج المنتجات',
    addCategory: '+ إضافة فئة',
    allBrands: 'كل العلامات التجارية',
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
    brandRequired: 'العلامة التجارية *',
    brandLocked: 'لا يمكن تغيير العلامة التجارية بعد إنشاء الفئة.',
    keyRequired: 'المفتاح *',
    titleArRequired: 'العنوان بالعربية *',
    titleEnRequired: 'العنوان بالإنجليزية *',
    titleTr: 'العنوان بالتركية',
    titleRu: 'العنوان بالروسية',
    displayOrder: 'ترتيب العرض',
    saveCategory: '💾 حفظ الفئة',
    colBrand: 'العلامة التجارية',
    colKey: 'المفتاح',
    colTitleAr: 'العنوان (AR)',
    colTitleEn: 'العنوان (EN)',
    colOrder: 'الترتيب',
    empty: 'لا توجد فئات.',
    deleteLabel: 'حذف الفئة {name}',
    deleteTitle: 'حذف الفئة',
    confirmDelete: 'حذف الفئة «{name}»؟',
    errRequired: 'العلامة التجارية والمفتاح والعنوان بالعربية والعنوان بالإنجليزية حقول مطلوبة.',
    errSave: 'تعذّر حفظ الفئة',
    errDelete: 'تعذّر حذف الفئة',
  },
});

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
  const [brand, setBrand] = useState<'DIOX' | 'AYLUX' | ''>('');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<Partial<ProductCategory>>(emptyCategory());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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

  const handleDelete = async (category: ProductCategory) => {
    const name = (t.lang === 'ar' ? category.title_ar || category.title_en : category.title_en) || category.id;
    if (!confirm(t('confirmDelete', { name }))) return;
    try {
      await adminApi.deleteCategory(category.id);
      await reload();
      if (editing === category.id) resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('errDelete'));
    }
  };

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{t('title')}</h1>
          <p className="adm-page-subtitle">{t('subtitle')}</p>
        </div>
        <button onClick={startNew} className="adm-btn adm-btn-primary adm-btn-sm">
          {t('addCategory')}
        </button>
      </div>

      <div className="adm-card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['', 'DIOX', 'AYLUX'] as const).map((value) => (
          <button
            key={value || 'all'}
            className={`adm-btn adm-btn-sm ${brand === value ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
            onClick={() => {
              setBrand(value);
              resetForm();
            }}
          >
            {value || t('allBrands')}
          </button>
        ))}
        <span className="adm-text-muted adm-text-sm" style={{ marginInlineStart: 'auto' }}>
          {t.plural('count', categories.length)}
        </span>
      </div>

      {(editing === 'new' || typeof editing === 'string') && (
        <div className="adm-card" style={{ marginBottom: 16 }}>
          <div className="adm-card-title" style={{ marginBottom: 16 }}>
            {editing === 'new' ? t('createCategory') : t('editCategory')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            <div className="adm-form-group">
              <label className="adm-label" htmlFor="category-brand">{t('brandRequired')}</label>
              {/* The server never updates a category's brand (its products
                  stay under the old one), so changing it here was silently
                  ignored. Only a new category can pick its brand. */}
              <select
                id="category-brand"
                className="adm-select"
                value={form.brand || 'DIOX'}
                onChange={(e) => set('brand', e.target.value as 'DIOX' | 'AYLUX')}
                disabled={editing !== 'new'}
                aria-describedby={editing !== 'new' ? 'category-brand-hint' : undefined}
              >
                <option value="DIOX">DIOX</option>
                <option value="AYLUX">AYLUX</option>
              </select>
              {editing !== 'new' && (
                <small id="category-brand-hint" style={{ color: 'var(--adm-text-dim)', marginTop: 4, display: 'block' }}>
                  {t('brandLocked')}
                </small>
              )}
            </div>
            <div className="adm-form-group">
              <label className="adm-label">{t('keyRequired')}</label>
              <input className="adm-input" dir="ltr" value={form.key || ''} onChange={(e) => set('key', e.target.value)} placeholder="homeCleaning" />
            </div>
            <div className="adm-form-group">
              <label className="adm-label">{t('titleArRequired')}</label>
              <input className="adm-input" dir="rtl" value={form.title_ar || ''} onChange={(e) => set('title_ar', e.target.value)} />
            </div>
            <div className="adm-form-group">
              <label className="adm-label">{t('titleEnRequired')}</label>
              <input className="adm-input" dir="ltr" value={form.title_en || ''} onChange={(e) => set('title_en', e.target.value)} />
            </div>
            <div className="adm-form-group">
              <label className="adm-label">{t('titleTr')}</label>
              <input className="adm-input" dir="ltr" value={form.title_tr || ''} onChange={(e) => set('title_tr', e.target.value)} />
            </div>
            <div className="adm-form-group">
              <label className="adm-label">{t('titleRu')}</label>
              <input className="adm-input" dir="ltr" value={form.title_ru || ''} onChange={(e) => set('title_ru', e.target.value)} />
            </div>
            <div className="adm-form-group" style={{ maxWidth: 180 }}>
              <label className="adm-label">{t('displayOrder')}</label>
              <input className="adm-input" type="number" dir="ltr" value={form.display_order ?? 0} onChange={(e) => set('display_order', Number(e.target.value))} />
            </div>
          </div>

          {error && <div className="adm-alert adm-alert-error" style={{ marginBottom: 12 }}>⚠ {error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} className="adm-btn adm-btn-primary" disabled={saving}>
              {saving ? tc('saving') : t('saveCategory')}
            </button>
            <button onClick={resetForm} className="adm-btn">{tc('cancel')}</button>
          </div>
        </div>
      )}

      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> {tc('loading')}</div>}
      {loadError && <div className="adm-alert adm-alert-error">⚠ {loadError}</div>}

      {!loading && (
        <div className="adm-card" style={{ padding: 0 }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>{t('colBrand')}</th>
                  <th>{t('colKey')}</th>
                  <th style={{ textAlign: 'right' }}>{t('colTitleAr')}</th>
                  <th>{t('colTitleEn')}</th>
                  <th>{t('colOrder')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>
                      {t('empty')}
                    </td>
                  </tr>
                ) : categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <span className={`adm-badge ${category.brand === 'DIOX' ? 'adm-badge-blue' : 'adm-badge-green'}`}>
                        {category.brand}
                      </span>
                    </td>
                    <td className="adm-mono">{category.key}</td>
                    <td dir="rtl" style={{ textAlign: 'right' }}>{category.title_ar}</td>
                    <td>{category.title_en}</td>
                    <td>{fmtNumber(category.display_order)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => startEdit(category)}>{tc('edit')}</button>
                        <button
                          className="adm-btn adm-btn-danger adm-btn-sm"
                          onClick={() => handleDelete(category)}
                          aria-label={t('deleteLabel', { name: (t.lang === 'ar' ? category.title_ar : category.title_en) || category.key })}
                          title={t('deleteTitle')}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};


