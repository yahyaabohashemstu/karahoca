import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminApi, type Product, type ProductCategory } from '../utils/adminApi';
import { TranslationHelper } from '../components/TranslationHelper';
import type { ProductSize } from '../../data/brandCatalog';

const LANGS = ['ar', 'en', 'tr', 'ru'] as const;
type Lang = typeof LANGS[number];

const EMPTY: Partial<Product> = {
  brand: 'DIOX',
  name_ar: '', name_en: '', name_tr: '', name_ru: '',
  description_ar: '', description_en: '', description_tr: '', description_ru: '',
  alt_ar: '', alt_en: '', alt_tr: '', alt_ru: '',
  material_ar: '', material_en: '', material_tr: '', material_ru: '',
  count_ar: '', count_en: '', count_tr: '', count_ru: '',
  image: '', weight: '', category_id: '', display_order: 0, active: 1,
};

export const AdminProductEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [form, setForm] = useState<Partial<Product>>(EMPTY);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [activeLang, setActiveLang] = useState<Lang>('ar');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingSize, setUploadingSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sizeFileRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    adminApi.getCategories().then(r => setCategories(r.categories));
    if (!isNew) {
      adminApi.getProduct(id!).then(r => {
        setForm(r.product);
        setSizes(Array.isArray(r.product.sizes) ? r.product.sizes : []);
        setLoading(false);
      }).catch(e => {
        setError(e.message);
        setLoading(false);
      });
    }
  }, [id, isNew]);

  const set = (key: keyof Product, value: string | number) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleTranslated = (translations: Record<string, Record<string, string>>) => {
    const updates: Partial<Product> = {};
    for (const [field, langs] of Object.entries(translations)) {
      for (const [lang, value] of Object.entries(langs)) {
        (updates as Record<string, string>)[`${field}_${lang}`] = value;
      }
    }
    setForm(f => ({ ...f, ...updates }));
  };

  const handleSave = async () => {
    if (!form.name_ar || !form.brand || !form.category_id) {
      setError('Please fill required fields: Arabic name, brand, and category.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, sizes: sizes.length > 0 ? sizes : null };
      if (isNew) {
        await adminApi.createProduct(payload);
      } else {
        await adminApi.updateProduct(id!, payload);
      }
      navigate('/admin/products');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
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
      if (!data.success) throw new Error('Upload failed');
      set('image', data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Sizes helpers ────────────────────────────────────────────────────────
  const addSize = () => setSizes(s => [...s, { label: '', image: '' }]);
  const removeSize = (i: number) => setSizes(s => s.filter((_, idx) => idx !== i));
  const setSize = (i: number, field: keyof ProductSize, value: string) =>
    setSizes(s => s.map((sz, idx) => idx === i ? { ...sz, [field]: value } : sz));

  const handleSizeImageUpload = async (file: File, index: number) => {
    setUploadingSize(index);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const data = await adminApi.uploadImage(base64, file.name);
      if (!data.success) throw new Error('Upload failed');
      setSize(index, 'image', data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingSize(null);
    }
  };

  const filteredCategories = categories.filter(c => !form.brand || c.brand === form.brand);

  if (loading) return <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>;

  return (
    <div>
      <div className="adm-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/admin/products" className="adm-btn adm-btn-ghost adm-btn-sm">← Back</Link>
          <h1 className="adm-page-title">{isNew ? 'New Product' : 'Edit Product'}</h1>
        </div>
        <button className="adm-btn adm-btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <><span className="adm-spinner" style={{ width: 14, height: 14 }} /> Saving...</> : '💾 Save Product'}
        </button>
      </div>

      {error && <div className="adm-alert adm-alert-error" style={{ marginBottom: 16 }}>⚠ {error}</div>}

      <div className="adm-grid-2">
        {/* Left: metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="adm-card">
            <div className="adm-card-title">Product Info</div>
            <div className="adm-form-group">
              <label className="adm-label">Brand *</label>
              <select className="adm-input" value={form.brand} onChange={e => { set('brand', e.target.value as 'DIOX' | 'AYLUX'); set('category_id', ''); }}>
                <option value="DIOX">DIOX</option>
                <option value="AYLUX">AYLUX</option>
              </select>
            </div>
            <div className="adm-form-group">
              <label className="adm-label">Category *</label>
              <select className="adm-input" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                <option value="">— Select —</option>
                {filteredCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.title_en} / {c.title_ar}</option>
                ))}
              </select>
            </div>
            <div className="adm-form-group">
              <label className="adm-label">Image</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input
                  className="adm-input"
                  value={form.image ?? ''}
                  onChange={e => set('image', e.target.value)}
                  placeholder="/products/image.webp or paste URL"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="adm-btn adm-btn-secondary adm-btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {uploading ? <><span className="adm-spinner" style={{ width: 12, height: 12 }} /> Uploading...</> : '📁 Upload'}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }}
              />
            </div>
            <div className="adm-form-group">
              <label className="adm-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📦 Size Variants <span className="adm-text-muted adm-text-sm">(optional — use when one product comes in multiple sizes)</span></span>
                <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={addSize}>+ Add Size</button>
              </label>

              {sizes.length === 0 && (
                <p className="adm-text-muted adm-text-sm" style={{ marginTop: 4 }}>
                  No sizes set — the Weight field below will be used instead.
                </p>
              )}

              {sizes.map((sz, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, padding: '10px 12px', background: 'var(--adm-surface2)', borderRadius: 8, border: '1px solid var(--adm-glass-border)' }}>
                  <div style={{ flex: '0 0 110px' }}>
                    <div className="adm-text-sm adm-text-muted" style={{ marginBottom: 3 }}>Label *</div>
                    <input
                      className="adm-input adm-input-sm"
                      value={sz.label}
                      onChange={e => setSize(i, 'label', e.target.value)}
                      placeholder="700ml"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="adm-text-sm adm-text-muted" style={{ marginBottom: 3 }}>Image (optional)</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="adm-input adm-input-sm"
                        value={sz.image ?? ''}
                        onChange={e => setSize(i, 'image', e.target.value)}
                        placeholder="Leave blank to use main image"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="adm-btn adm-btn-secondary adm-btn-sm"
                        disabled={uploadingSize === i}
                        onClick={() => sizeFileRefs.current[i]?.click()}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {uploadingSize === i ? <span className="adm-spinner" style={{ width: 12, height: 12 }} /> : '📁'}
                      </button>
                      <input
                        ref={el => { sizeFileRefs.current[i] = el; }}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleSizeImageUpload(f, i); e.target.value = ''; }}
                      />
                    </div>
                  </div>
                  {sz.image && (
                    <img src={sz.image} alt={sz.label} style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 4, background: 'var(--adm-surface)', flexShrink: 0 }} />
                  )}
                  <button type="button" className="adm-btn adm-btn-danger adm-btn-sm" onClick={() => removeSize(i)} style={{ flexShrink: 0 }}>🗑</button>
                </div>
              ))}

              {sizes.length > 0 && (
                <p className="adm-text-muted adm-text-sm" style={{ marginTop: 6 }}>
                  ℹ️ When sizes are set, the Weight field below is ignored on the website.
                </p>
              )}
            </div>

            <div className="adm-form-group">
              <label className="adm-label">Weight / Volume <span className="adm-text-muted adm-text-sm">(used only if no sizes above)</span></label>
              <input className="adm-input" value={form.weight ?? ''} onChange={e => set('weight', e.target.value)} placeholder="e.g. 500ml" />
            </div>
            <div className="adm-form-group">
              <label className="adm-label">Display Order</label>
              <input className="adm-input" type="number" value={form.display_order ?? 0} onChange={e => set('display_order', Number(e.target.value))} />
            </div>
            <div className="adm-form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label className="adm-label" style={{ margin: 0 }}>Active</label>
              <input type="checkbox" checked={!!form.active} onChange={e => set('active', e.target.checked ? 1 : 0)} style={{ width: 18, height: 18 }} />
            </div>
          </div>

          {form.image && (
            <div className="adm-card">
              <div className="adm-card-title">Image Preview</div>
              <img src={form.image} alt="preview" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', marginTop: 8 }} />
            </div>
          )}
        </div>

        {/* Right: multilingual content */}
        <div className="adm-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div className="adm-card-title" style={{ margin: 0 }}>Content</div>
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
                <label className="adm-label">Name ({l.toUpperCase()}) *</label>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`name_${l}`] ?? ''}
                  onChange={e => set(`name_${l}` as keyof Product, e.target.value)}
                />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">Description ({l.toUpperCase()})</label>
                <textarea
                  className="adm-textarea"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  rows={3}
                  value={(form as Record<string, string>)[`description_${l}`] ?? ''}
                  onChange={e => set(`description_${l}` as keyof Product, e.target.value)}
                />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">Image Alt ({l.toUpperCase()})</label>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`alt_${l}`] ?? ''}
                  onChange={e => set(`alt_${l}` as keyof Product, e.target.value)}
                />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">Material ({l.toUpperCase()})</label>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`material_${l}`] ?? ''}
                  onChange={e => set(`material_${l}` as keyof Product, e.target.value)}
                />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">Count / Package ({l.toUpperCase()})</label>
                <input
                  className="adm-input"
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  value={(form as Record<string, string>)[`count_${l}`] ?? ''}
                  onChange={e => set(`count_${l}` as keyof Product, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


