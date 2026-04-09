import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminApi, type Product, type ProductCategory } from '../utils/adminApi';
import { TranslationHelper } from '../components/TranslationHelper';

const LANGS = ['ar', 'en', 'tr', 'ru'] as const;
type Lang = typeof LANGS[number];

const EMPTY: Partial<Product> = {
  brand: 'DIOX',
  name_ar: '', name_en: '', name_tr: '', name_ru: '',
  description_ar: '', description_en: '', description_tr: '', description_ru: '',
  alt_ar: '', alt_en: '', alt_tr: '', alt_ru: '',
  material_ar: '', material_en: '', material_tr: '', material_ru: '',
  count_ar: '', count_en: '', count_tr: '', count_ru: '',
  image: '', gallery: '', weight: '', weight_count_table: '', category_id: '', display_order: 0, active: 1,
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [galleryUploading, setGalleryUploading] = useState<number | null>(null);
  const galleryFileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [showWCTable, setShowWCTable] = useState(false);

  useEffect(() => {
    adminApi.getCategories().then(r => setCategories(r.categories));
    if (!isNew) {
      adminApi.getProduct(id!).then(r => {
        setForm(r.product);
        if (r.product.weight_count_table) {
          try { if (JSON.parse(r.product.weight_count_table).length > 0) setShowWCTable(true); } catch {}
        }
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
  const getGalleryImages = (): string[] => {
    const raw = form.gallery;
    if (!raw) return [];
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
  };
  const setGalleryImages = (imgs: string[]) =>
    setForm(f => ({ ...f, gallery: imgs.length > 0 ? JSON.stringify(imgs) : '' }));
  const addGallerySlot = () => setGalleryImages([...getGalleryImages(), '']);
  const removeGalleryImage = (idx: number) => { const a = getGalleryImages(); a.splice(idx, 1); setGalleryImages(a); };
  const updateGalleryImage = (idx: number, val: string) => { const a = getGalleryImages(); a[idx] = val; setGalleryImages(a); };
  const handleGalleryUpload = async (idx: number, file: File) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED.includes(file.type)) { setError('Unsupported file type. Use JPG, PNG, WebP, or GIF.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('File too large. Maximum 10 MB.'); return; }
    setGalleryUploading(idx); setError(null);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const data = await adminApi.uploadImage(base64, file.name);
      if (!data.success) throw new Error('Upload failed');
      updateGalleryImage(idx, data.url || data.path);
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setGalleryUploading(null); }
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
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Unsupported file type. Use JPG, PNG, WebP, or GIF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10 MB.');
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
      if (!data.success) throw new Error('Upload failed');
      set('image', data.url || data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
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
              <label className="adm-label">Weight / Volume</label>
              <input className="adm-input" value={form.weight ?? ''} onChange={e => set('weight', e.target.value)} placeholder="e.g. 500ml" />
            </div>
            {/* Weight-Count Table (optional) */}
            <div className="adm-form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="adm-label" style={{ margin: 0 }}>Weight / Count Table</label>
                <button
                  type="button"
                  className={`adm-btn adm-btn-sm ${showWCTable ? 'adm-btn-warning' : 'adm-btn-secondary'}`}
                  onClick={() => {
                    if (!showWCTable && getWCRows().length === 0) setWCRows([{ weight: '', count: '' }, { weight: '', count: '' }]);
                    setShowWCTable(!showWCTable);
                  }}
                >
                  {showWCTable ? '✕ Hide Table' : '📊 Add Table'}
                </button>
              </div>

              {showWCTable && (
                <div style={{ marginTop: 10, border: '1px solid var(--adm-border, rgba(255,255,255,0.12))', borderRadius: 8, padding: 12, background: 'rgba(255,255,255,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--adm-text-muted, #888)', fontWeight: 600 }}>Weight / Volume</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--adm-text-muted, #888)', fontWeight: 600 }}>Count (per box)</th>
                        <th style={{ width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {getWCRows().map((row, i) => (
                        <tr key={i}>
                          <td style={{ padding: '3px 4px' }}>
                            <input className="adm-input" value={row.weight} onChange={e => updateWCRow(i, 'weight', e.target.value)} placeholder="e.g. 1.2 kg" style={{ fontSize: 13 }} />
                          </td>
                          <td style={{ padding: '3px 4px' }}>
                            <input className="adm-input" type="number" min={1} value={row.count} onChange={e => updateWCRow(i, 'count', e.target.value)} placeholder="e.g. 6" style={{ fontSize: 13 }} />
                          </td>
                          <td style={{ padding: '3px 4px' }}>
                            <button type="button" className="adm-btn adm-btn-danger adm-btn-sm" onClick={() => removeWCRow(i)} title="Remove" style={{ padding: '4px 8px' }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" className="adm-btn adm-btn-secondary adm-btn-sm" onClick={addWCRow}>+ Add Row</button>
                    {getWCRows().length > 0 && (
                      <button type="button" className="adm-btn adm-btn-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
                        onClick={() => { setWCRows([]); setShowWCTable(false); }}>Clear Table</button>
                    )}
                  </div>
                </div>
              )}
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

          {/* Gallery Images (optional) */}
          <div className="adm-card">
            <div className="adm-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Gallery Images</span>
              <button type="button" className="adm-btn adm-btn-secondary adm-btn-sm" onClick={addGallerySlot}>
                + Add Image
              </button>
            </div>
            {getGalleryImages().length === 0 && (
              <p style={{ color: 'var(--adm-text-muted, #888)', fontSize: 13, margin: '8px 0 0' }}>
                No gallery images. Click "+ Add Image" to add colour variants or extra views.
              </p>
            )}
            {getGalleryImages().map((img, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                {img && (
                  <img src={img} alt={`gallery-${idx}`}
                    style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--adm-border, #ddd)' }} />
                )}
                <input className="adm-input" value={img} onChange={e => updateGalleryImage(idx, e.target.value)}
                  placeholder={`Image path or URL #${idx + 1}`} style={{ flex: 1 }} />
                <button type="button" className="adm-btn adm-btn-secondary adm-btn-sm"
                  onClick={() => galleryFileRefs.current[idx]?.click()}
                  disabled={galleryUploading === idx} style={{ whiteSpace: 'nowrap' }}>
                  {galleryUploading === idx
                    ? <><span className="adm-spinner" style={{ width: 12, height: 12 }} /> ...</>
                    : '📁'}
                </button>
                <input ref={el => { galleryFileRefs.current[idx] = el; }} type="file" accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleGalleryUpload(idx, f); e.target.value = ''; }} />
                <button type="button" className="adm-btn adm-btn-sm"
                  style={{ background: '#dc3545', color: '#fff', border: 'none' }}
                  onClick={() => removeGalleryImage(idx)} title="Remove">
                  ✕
                </button>
              </div>
            ))}
          </div>
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


