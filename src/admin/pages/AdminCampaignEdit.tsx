import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { adminApi, type Campaign, type CampaignSend } from '../utils/adminApi';
import { TranslationHelper } from '../components/TranslationHelper';
import { fmtDate } from '../utils/dateUtils';

const TEMPLATES = [
  { value: 'custom',      label: 'Custom',          icon: '✏️' },
  { value: 'new_product', label: 'New Product',      icon: '🧴' },
  { value: 'offer',       label: 'Special Offer',    icon: '🏷️' },
  { value: 'news',        label: 'Company News',     icon: '📰' },
];
const TEMPLATE_DEFAULTS: Record<string, { subject: string; body: string }> = {
  new_product: {
    subject: 'Exciting New Product from KARAHOCA!',
    body: '**Hello!**\n\nWe are excited to announce a brand-new product added to our catalog.\n\nThis product is designed to [DESCRIBE BENEFITS]. It\'s now available for order.\n\nContact us at info@karahoca.com to place your order today.',
  },
  offer: {
    subject: 'Exclusive Special Offer – Limited Time',
    body: '**Dear valued customer,**\n\nWe have a special offer exclusively for our subscribers.\n\n🏷️ [DESCRIBE OFFER]\n\nThis offer is available until [DATE]. Don\'t miss out!\n\nContact us to take advantage of this deal.',
  },
  news: {
    subject: 'KARAHOCA News Update',
    body: '**Dear friends,**\n\nWe have exciting news to share with you:\n\n[NEWS CONTENT]\n\nThank you for being part of the KARAHOCA family.',
  },
};

const LANGS: Array<{ key: 'ar' | 'en' | 'tr' | 'ru'; label: string; dir: 'rtl' | 'ltr' }> = [
  { key: 'ar', label: '🇸🇦 AR', dir: 'rtl' },
  { key: 'en', label: '🇬🇧 EN', dir: 'ltr' },
  { key: 'tr', label: '🇹🇷 TR', dir: 'ltr' },
  { key: 'ru', label: '🇷🇺 RU', dir: 'ltr' },
];

type LangKey = 'ar' | 'en' | 'tr' | 'ru';

const empty = (): Partial<Campaign> => ({
  title: '', template_type: 'custom',
  subject_ar: '', subject_en: '', subject_tr: '', subject_ru: '',
  body_ar: '', body_en: '', body_tr: '', body_ru: '',
});

export const AdminCampaignEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew  = id === 'new';
  const activeTab = searchParams.get('tab') || 'edit';

  const [form, setForm]     = useState<Partial<Campaign>>(empty());
  const [lang, setLang]     = useState<LangKey>('ar');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving]   = useState(false);
  const [sending, setSending] = useState(false);
  const [sends, setSends]     = useState<CampaignSend[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isNew && id) {
      adminApi.getCampaign(parseInt(id, 10))
        .then(r => { setForm(r.campaign); setLoading(false); })
        .catch(e => { setError(e.message); setLoading(false); });
    }
  }, [id, isNew]);

  useEffect(() => {
    if (!isNew && id && activeTab === 'stats' && !statsLoaded) {
      adminApi.getCampaignStats(parseInt(id, 10))
        .then(r => { setSends(r.sends); setStatsLoaded(true); })
        .catch(() => {});
    }
  }, [activeTab, id, isNew, statsLoaded]);

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const applyTemplate = (type: string) => {
    const t = TEMPLATE_DEFAULTS[type];
    if (t) {
      setForm(f => ({
        ...f, template_type: type as Campaign['template_type'],
        subject_en: t.subject, body_en: t.body,
        subject_ar: '', body_ar: '',
        subject_tr: '', body_tr: '',
        subject_ru: '', body_ru: '',
      }));
    } else {
      setForm(f => ({ ...f, template_type: type as Campaign['template_type'] }));
    }
  };

  const handleTranslated = (translations: Record<string, Record<string, string>>) => {
    setForm(f => ({
      ...f,
      subject_ar: translations.subject?.ar || f.subject_ar || '',
      subject_en: translations.subject?.en || f.subject_en || '',
      subject_tr: translations.subject?.tr || f.subject_tr || '',
      subject_ru: translations.subject?.ru || f.subject_ru || '',
      body_ar: translations.body?.ar || f.body_ar || '',
      body_en: translations.body?.en || f.body_en || '',
      body_tr: translations.body?.tr || f.body_tr || '',
      body_ru: translations.body?.ru || f.body_ru || '',
    }));
  };

  const save = async () => {
    if (!form.title?.trim()) { setError('Title is required'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      if (isNew) {
        const r = await adminApi.createCampaign(form);
        navigate(`/admin/campaigns/${r.campaign.id}`, { replace: true });
        setSuccess('Campaign created!');
      } else {
        await adminApi.updateCampaign(parseInt(id!, 10), form);
        setSuccess('Saved!');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const sendNow = async () => {
    if (!confirm('Send this campaign to ALL active subscribers NOW?')) return;
    setSending(true); setError(''); setSuccess('');
    try {
      const r = await adminApi.sendCampaign(parseInt(id!, 10));
      setSuccess(`✅ Sent to ${r.sent} subscribers!`);
      const updated = await adminApi.getCampaign(parseInt(id!, 10));
      setForm(updated.campaign);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally { setSending(false); }
  };

  if (loading) return <div className="adm-loading-center"><span className="adm-spinner" /></div>;

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{isNew ? '✉️ New Campaign' : `✉️ ${form.title || 'Edit Campaign'}`}</h1>
          {form.status && (
            <p className="adm-page-subtitle">
              Status: <strong style={{ color: form.status === 'sent' ? '#22c55e' : form.status === 'scheduled' ? '#4f6ef7' : '#f59e0b', textTransform: 'capitalize' }}>{form.status}</strong>
              {form.status === 'sent' && ` · ${form.recipient_count} sent · ${form.open_count} opens`}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/admin/campaigns')} className="adm-btn">← Back</button>
          <button onClick={save} className="adm-btn adm-btn-primary" disabled={saving}>
            {saving ? <><span className="adm-spinner" style={{ width: 14, height: 14 }} /> Saving…</> : '💾 Save'}
          </button>
          {!isNew && form.status !== 'sent' && (
            <button onClick={sendNow} className="adm-btn" disabled={sending}
                    style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', border: 'none' }}>
              {sending ? <><span className="adm-spinner" style={{ width: 14, height: 14 }} /> Sending…</> : '🚀 Send Now'}
            </button>
          )}
        </div>
      </div>

      {error   && <div className="adm-alert adm-alert-error"   style={{ marginBottom: 16 }}>⚠ {error}</div>}
      {success && <div className="adm-alert adm-alert-success" style={{ marginBottom: 16 }}>✅ {success}</div>}

      {/* Tabs */}
      {!isNew && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--adm-border)', paddingBottom: 4 }}>
          {['edit','stats'].map(t => (
            <button key={t}
              onClick={() => navigate(`/admin/campaigns/${id}?tab=${t}`, { replace: true })}
              style={{
                padding: '8px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
                background: activeTab === t ? 'var(--adm-accent)' : 'transparent',
                color: activeTab === t ? '#fff' : 'var(--adm-text-muted)',
                fontWeight: activeTab === t ? 700 : 400, fontSize: 13, textTransform: 'capitalize',
              }}
            >{t === 'edit' ? '✏️ Edit' : '📊 Stats'}</button>
          ))}
        </div>
      )}

      {activeTab === 'edit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title + Template */}
          <div className="adm-card">
            <div className="adm-card-title" style={{ marginBottom: 16 }}>Campaign Settings</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="adm-form-group">
                <label className="adm-label">Campaign Title *</label>
                <input className="adm-input" value={form.title || ''} onChange={e => set('title', e.target.value)} placeholder="e.g. April Newsletter" />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">Template Type</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {TEMPLATES.map(t => (
                    <button key={t.value}
                      onClick={() => applyTemplate(t.value)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, border: '1px solid var(--adm-border)',
                        background: form.template_type === t.value ? 'var(--adm-accent)' : 'var(--adm-surface2)',
                        color: form.template_type === t.value ? '#fff' : 'var(--adm-text)',
                        cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      }}>{t.icon} {t.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI Translation */}
          <TranslationHelper
            fields={{
              subject: form[`subject_${lang}`] || '',
              body:    form[`body_${lang}`]    || '',
            }}
            sourceLang={lang}
            onTranslated={(t) => handleTranslated(t as Record<string, Record<string, string>>)}
          />

          {/* Content per language */}
          <div className="adm-card">
            <div className="adm-card-title" style={{ marginBottom: 16 }}>Content</div>
            {/* Lang tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--adm-border)', paddingBottom: 8 }}>
              {LANGS.map(l => (
                <button key={l.key} onClick={() => setLang(l.key)} style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: lang === l.key ? 'var(--adm-accent)' : 'var(--adm-surface2)',
                  color: lang === l.key ? '#fff' : 'var(--adm-text-muted)',
                  fontWeight: 600, fontSize: 12,
                }}>{l.label}</button>
              ))}
            </div>

            {LANGS.filter(l => l.key === lang).map(l => (
              <div key={l.key} style={{ direction: l.dir, textAlign: l.dir === 'rtl' ? 'right' : 'left' }}>
                <div className="adm-form-group">
                  <label className="adm-label">Subject Line</label>
                  <input className="adm-input"
                    value={(form as Record<string, string>)[`subject_${l.key}`] || ''}
                    onChange={e => set(`subject_${l.key}`, e.target.value)}
                    placeholder="Email subject..."
                    dir={l.dir}
                  />
                </div>
                <div className="adm-form-group">
                  <label className="adm-label">Email Body</label>
                  <textarea className="adm-input" rows={12}
                    value={(form as Record<string, string>)[`body_${l.key}`] || ''}
                    onChange={e => set(`body_${l.key}`, e.target.value)}
                    placeholder="Write your email content here... (use **bold** for emphasis)"
                    dir={l.dir}
                    style={{ fontFamily: 'inherit', resize: 'vertical' }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--adm-text-dim)', marginTop: 4 }}>
                    Use **text** for bold. Each line becomes a paragraph.
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'stats' && !isNew && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
            <div className="adm-stat-card">
              <div className="adm-stat-icon">👥</div>
              <div className="adm-stat-label">Recipients</div>
              <div className="adm-stat-value">{form.recipient_count}</div>
            </div>
            <div className="adm-stat-card">
              <div className="adm-stat-icon">👁</div>
              <div className="adm-stat-label">Opens</div>
              <div className="adm-stat-value" style={{ color: '#22c55e' }}>{form.open_count}</div>
            </div>
            <div className="adm-stat-card">
              <div className="adm-stat-icon">📊</div>
              <div className="adm-stat-label">Open Rate</div>
              <div className="adm-stat-value" style={{ color: '#8b5cf6' }}>
                {form.recipient_count ? `${Math.round((form.open_count! / form.recipient_count) * 100)}%` : '—'}
              </div>
            </div>
          </div>

          <div className="adm-card">
            <div className="adm-card-title" style={{ marginBottom: 14 }}>Delivery Details</div>
            {!sends.length
              ? <p className="adm-text-muted adm-text-sm">Loading…</p>
              : (
                <table className="adm-table" style={{ fontSize: 12 }}>
                  <thead><tr><th>Email</th><th>Sent</th><th>Opened</th><th>Open Time</th></tr></thead>
                  <tbody>
                    {sends.map(s => (
                      <tr key={s.id}>
                        <td className="adm-mono">{s.email}</td>
                        <td>{fmtDate(s.created_at)}</td>
                        <td>{s.opened
                          ? <span style={{ color: '#22c55e', fontWeight: 700 }}>✅ Yes</span>
                          : <span style={{ color: 'var(--adm-text-dim)' }}>—</span>}
                        </td>
                        <td>{s.opened_at ? fmtDate(s.opened_at) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </div>
      )}
    </div>
  );
};
