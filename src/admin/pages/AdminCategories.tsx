import React, { useState } from 'react';
import { adminApi, type ProductCategory } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';

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
      setError('Brand, key, Arabic title, and English title are required.');
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
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: ProductCategory) => {
    if (!confirm(`Delete category "${category.title_en || category.id}"?`)) return;
    try {
      await adminApi.deleteCategory(category.id);
      await reload();
      if (editing === category.id) resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Product Categories</h1>
          <p className="adm-page-subtitle">Manage the category structure used by the product catalog</p>
        </div>
        <button onClick={startNew} className="adm-btn adm-btn-primary adm-btn-sm">
          + Add Category
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
            {value || 'All Brands'}
          </button>
        ))}
        <span className="adm-text-muted adm-text-sm" style={{ marginLeft: 'auto' }}>
          {categories.length} categories
        </span>
      </div>

      {(editing === 'new' || typeof editing === 'string') && (
        <div className="adm-card" style={{ marginBottom: 16 }}>
          <div className="adm-card-title" style={{ marginBottom: 16 }}>
            {editing === 'new' ? 'Create Category' : 'Edit Category'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            <div className="adm-form-group">
              <label className="adm-label">Brand *</label>
              <select className="adm-select" value={form.brand || 'DIOX'} onChange={(e) => set('brand', e.target.value as 'DIOX' | 'AYLUX')}>
                <option value="DIOX">DIOX</option>
                <option value="AYLUX">AYLUX</option>
              </select>
            </div>
            <div className="adm-form-group">
              <label className="adm-label">Key *</label>
              <input className="adm-input" value={form.key || ''} onChange={(e) => set('key', e.target.value)} placeholder="homeCleaning" />
            </div>
            <div className="adm-form-group">
              <label className="adm-label">Arabic title *</label>
              <input className="adm-input" dir="rtl" value={form.title_ar || ''} onChange={(e) => set('title_ar', e.target.value)} />
            </div>
            <div className="adm-form-group">
              <label className="adm-label">English title *</label>
              <input className="adm-input" value={form.title_en || ''} onChange={(e) => set('title_en', e.target.value)} />
            </div>
            <div className="adm-form-group">
              <label className="adm-label">Turkish title</label>
              <input className="adm-input" value={form.title_tr || ''} onChange={(e) => set('title_tr', e.target.value)} />
            </div>
            <div className="adm-form-group">
              <label className="adm-label">Russian title</label>
              <input className="adm-input" value={form.title_ru || ''} onChange={(e) => set('title_ru', e.target.value)} />
            </div>
            <div className="adm-form-group" style={{ maxWidth: 180 }}>
              <label className="adm-label">Display order</label>
              <input className="adm-input" type="number" value={form.display_order ?? 0} onChange={(e) => set('display_order', Number(e.target.value))} />
            </div>
          </div>

          {error && <div className="adm-alert adm-alert-error" style={{ marginBottom: 12 }}>⚠ {error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} className="adm-btn adm-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : '💾 Save Category'}
            </button>
            <button onClick={resetForm} className="adm-btn">Cancel</button>
          </div>
        </div>
      )}

      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>}
      {loadError && <div className="adm-alert adm-alert-error">⚠ {loadError}</div>}

      {!loading && (
        <div className="adm-card" style={{ padding: 0 }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Key</th>
                  <th style={{ textAlign: 'right' }}>Title (AR)</th>
                  <th>Title (EN)</th>
                  <th>Order</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>
                      No categories found.
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
                    <td>{category.display_order}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => startEdit(category)}>Edit</button>
                        <button className="adm-btn adm-btn-danger adm-btn-sm" onClick={() => handleDelete(category)}>🗑</button>
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


