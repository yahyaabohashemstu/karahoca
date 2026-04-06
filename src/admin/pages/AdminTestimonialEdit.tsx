import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi, type Testimonial } from '../utils/adminApi';

const EMPTY: Partial<Testimonial> = {
  client_name: '',
  company: '',
  country: '',
  role_ar: '', role_en: '', role_tr: '', role_ru: '',
  text_ar: '', text_en: '', text_tr: '', text_ru: '',
  rating: 5,
  display_order: 0,
  active: 1,
};

export const AdminTestimonialEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const [form, setForm] = useState<Partial<Testimonial>>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (isNew) return;
    adminApi.getTestimonial(Number(id))
      .then(data => { setForm(data.testimonial); setLoading(false); })
      .catch(() => { setError('Failed to load testimonial.'); setLoading(false); });
  }, [id, isNew]);

  const set = (field: keyof Testimonial, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleAutoTranslate = async () => {
    const source = form.text_ar || form.text_en || '';
    const roleSource = form.role_ar || form.role_en || '';
    if (!source) { alert('Please enter at least Arabic or English text first.'); return; }
    setTranslating(true);
    try {
      const fields: Record<string, string> = {};
      if (!form.text_en && form.text_ar) fields['text_en'] = form.text_ar;
      if (!form.text_tr) fields['text_tr'] = source;
      if (!form.text_ru) fields['text_ru'] = source;
      if (!form.role_en && form.role_ar) fields['role_en'] = form.role_ar;
      if (!form.role_tr) fields['role_tr'] = roleSource;
      if (!form.role_ru) fields['role_ru'] = roleSource;

      if (Object.keys(fields).length === 0) { alert('All fields are already filled.'); setTranslating(false); return; }

      const res = await adminApi.translate({ fields, sourceLang: form.text_ar ? 'ar' : 'en' });
      if (res.success && res.translations) {
        setForm(f => ({ ...f, ...res.translations }));
      }
    } catch {
      alert('Translation failed. Please try again.');
    } finally {
      setTranslating(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_name?.trim()) { setError('Client name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await adminApi.createTestimonial(form);
      } else {
        await adminApi.updateTestimonial(Number(id), form);
      }
      navigate('/admin/testimonials');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
      setSaving(false);
    }
  };

  if (loading) return <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>;

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{isNew ? 'Add Testimonial' : 'Edit Testimonial'}</h1>
          <p className="adm-page-subtitle">Client review displayed on the home page</p>
        </div>
        <button onClick={() => navigate('/admin/testimonials')} className="adm-btn adm-btn-ghost adm-btn-sm">
          ← Back
        </button>
      </div>

      {error && <div className="adm-alert adm-alert-error" style={{ marginBottom: 16 }}>⚠ {error}</div>}

      <form onSubmit={handleSave}>
        <div className="adm-card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, color: 'var(--adm-text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Client Info
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="adm-field">
              <label className="adm-label">Client Name *</label>
              <input className="adm-input" value={form.client_name || ''} onChange={e => set('client_name', e.target.value)} required />
            </div>
            <div className="adm-field">
              <label className="adm-label">Company</label>
              <input className="adm-input" value={form.company || ''} onChange={e => set('company', e.target.value)} />
            </div>
            <div className="adm-field">
              <label className="adm-label">Country</label>
              <input className="adm-input" value={form.country || ''} onChange={e => set('country', e.target.value)} />
            </div>
            <div className="adm-field">
              <label className="adm-label">Rating (1–5)</label>
              <select className="adm-input" value={form.rating || 5} onChange={e => set('rating', Number(e.target.value))}>
                {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{'★'.repeat(r)} ({r})</option>)}
              </select>
            </div>
            <div className="adm-field">
              <label className="adm-label">Display Order</label>
              <input className="adm-input" type="number" min={0} value={form.display_order ?? 0} onChange={e => set('display_order', Number(e.target.value))} />
            </div>
            <div className="adm-field">
              <label className="adm-label">Status</label>
              <select className="adm-input" value={form.active ?? 1} onChange={e => set('active', Number(e.target.value))}>
                <option value={1}>Active</option>
                <option value={0}>Hidden</option>
              </select>
            </div>
          </div>
        </div>

        <div className="adm-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--adm-text-dim)', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
              Role / Position
            </h3>
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={handleAutoTranslate} disabled={translating}>
              {translating ? '⏳ Translating…' : '✨ Auto-Translate'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {(['ar', 'en', 'tr', 'ru'] as const).map(lang => (
              <div key={lang} className="adm-field">
                <label className="adm-label">Role ({lang.toUpperCase()})</label>
                <input
                  className="adm-input"
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  value={form[`role_${lang}`] || ''}
                  onChange={e => set(`role_${lang}`, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="adm-card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, color: 'var(--adm-text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Testimonial Text
          </h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {(['ar', 'en', 'tr', 'ru'] as const).map(lang => (
              <div key={lang} className="adm-field">
                <label className="adm-label">Text ({lang.toUpperCase()})</label>
                <textarea
                  className="adm-input"
                  rows={3}
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  value={form[`text_${lang}`] || ''}
                  onChange={e => set(`text_${lang}`, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="adm-btn adm-btn-primary" disabled={saving}>
            {saving ? '⏳ Saving…' : isNew ? 'Create Testimonial' : 'Save Changes'}
          </button>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => navigate('/admin/testimonials')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
