import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { adminApi, type Campaign, type CampaignSend } from '../utils/adminApi';
import { TranslationHelper } from '../components/TranslationHelper';
import { fmtDate } from '../utils/dateUtils';
import { buildApiUrl } from '../../utils/api';

const TEMPLATES = [
  { value: 'custom',      label: 'Custom',          icon: '✏️' },
  { value: 'new_product', label: 'New Product',     icon: '🧴' },
  { value: 'offer',       label: 'Special Offer',   icon: '🏷️' },
  { value: 'news',        label: 'Company News',    icon: '📰' },
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
type CompressedImage = { base64: string; fileName: string };

const empty = (): Partial<Campaign> => ({
  title: '', template_type: 'custom',
  subject_ar: '', subject_en: '', subject_tr: '', subject_ru: '',
  subject_b_ar: '', subject_b_en: '', subject_b_tr: '', subject_b_ru: '',
  body_ar: '', body_en: '', body_tr: '', body_ru: '',
  image_url: '',
});

const parseServerDatetime = (value?: string | null) => {
  if (!value) return null;

  const normalizedValue = value.includes('T')
    ? value
    : value.includes(' ')
      ? value.replace(' ', 'T') + 'Z'
      : value;

  const parsedDate = new Date(normalizedValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const getLocalDateInputMin = () => {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
};

const toDatetimeLocal = (value?: string | null): { date: string; time: string } => {
  if (!value) return { date: '', time: '10:00' };
  const d = parseServerDatetime(value);
  if (!d) return { date: '', time: '10:00' };
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  const local = new Date(d.getTime() - offsetMs).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
};

export const AdminCampaignEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const activeTab = searchParams.get('tab') || 'edit';

  const [form, setForm] = useState<Partial<Campaign>>(empty());
  const [lang, setLang] = useState<LangKey>('ar');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sends, setSends] = useState<CampaignSend[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Subscriber picker
  const [allSubscribers, setAllSubscribers] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  useEffect(() => {
    if (!isNew && id) {
      adminApi.getCampaign(parseInt(id, 10))
        .then((r) => {
          setForm(r.campaign);
          const { date, time } = toDatetimeLocal(r.campaign.scheduled_at);
          setScheduleDate(date);
          setScheduleTime(time);
          setLoading(false);
        })
        .catch((e) => {
          setError(e.message);
          setLoading(false);
        });
    }
  }, [id, isNew]);

  useEffect(() => {
    if (!isNew && id && activeTab === 'stats' && !statsLoaded) {
      adminApi.getCampaignStats(parseInt(id, 10))
        .then((r) => {
          setSends(r.sends);
          setStatsLoaded(true);
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : 'Failed to load stats');
          setStatsLoaded(true); // stop the spinner even on error
        });
    }
  }, [activeTab, id, isNew, statsLoaded]);

  useEffect(() => {
    if (isNew) return;
    adminApi.getNewsletter(1).then((r) => {
      setAllSubscribers((r.subscribers ?? []).map((s: { email: string }) => s.email));
    }).catch(() => {});
  }, [isNew]);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const applyTemplate = (type: string) => {
    const t = TEMPLATE_DEFAULTS[type];
    if (t) {
      setForm((f) => ({
        ...f,
        template_type: type as Campaign['template_type'],
        subject_en: t.subject,
        body_en: t.body,
        subject_ar: '',
        body_ar: '',
        subject_tr: '',
        body_tr: '',
        subject_ru: '',
        body_ru: '',
        subject_b_ar: '',
        subject_b_en: '',
        subject_b_tr: '',
        subject_b_ru: '',
      }));
    } else {
      setForm((f) => ({ ...f, template_type: type as Campaign['template_type'] }));
    }
  };

  const handleTranslated = (translations: Record<string, Record<string, string>>) => {
    setForm((f) => ({
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

  const refreshCampaign = async () => {
    if (!id || isNew) return;
    const updated = await adminApi.getCampaign(parseInt(id, 10));
    setForm(updated.campaign);
    const { date, time } = toDatetimeLocal(updated.campaign.scheduled_at);
    setScheduleDate(date);
    setScheduleTime(time);
  };

  const save = async () => {
    if (!form.title?.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (isNew) {
        const r = await adminApi.createCampaign(form);
        navigate(`/admin/campaigns/${r.campaign.id}`, { replace: true });
        setSuccess('Campaign created!');
      } else {
        await adminApi.updateCampaign(parseInt(id!, 10), form);
        await refreshCampaign();
        setSuccess('Saved!');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const getPreviewImageUrl = (value?: string) => {
    if (!value) return '';
    return value.startsWith('/') ? buildApiUrl(value) : value;
  };

  const compressImage = (file: File, maxPx = 1400, quality = 0.82): Promise<CompressedImage> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width >= height) { height = Math.round((height / width) * maxPx); width = maxPx; }
          else                 { width  = Math.round((width  / height) * maxPx); height = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx2d = canvas.getContext('2d');
        if (!ctx2d) { reject(new Error('Canvas not supported')); return; }
        ctx2d.drawImage(img, 0, 0, width, height);
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const extension = mime === 'image/png' ? 'png' : 'jpg';
        const originalBaseName = file.name.replace(/\.[^.]+$/, '').trim() || 'campaign-image';
        const dataUrl = canvas.toDataURL(mime, quality);
        resolve({
          base64: dataUrl.split(',')[1],
          fileName: `${originalBaseName}.${extension}`,
        });
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')); };
      img.src = objectUrl;
    });

  const handleImageUpload = async (file: File) => {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Unsupported file type. Use JPG, PNG, WebP, or GIF.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File too large. Maximum size is 20 MB.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const compressed = await compressImage(file);
      const data = await adminApi.uploadImage(compressed.base64, compressed.fileName);
      // Store the stable relative API path in the campaign record.
      // The server will expand it to the correct public URL when sending emails.
      set('image_url', data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const scheduleLater = async () => {
    if (isNew || !id) {
      setError('Save the campaign first before scheduling it.');
      return;
    }
    if (!scheduleDate) {
      setError('Choose a date to schedule this campaign.');
      return;
    }
    setScheduling(true);
    setError('');
    setSuccess('');
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime || '10:00'}`);
      if (Number.isNaN(scheduledAt.getTime())) {
        throw new Error('Invalid schedule date.');
      }
      await adminApi.scheduleCampaign(parseInt(id, 10), scheduledAt.toISOString());
      await refreshCampaign();
      setSuccess('Campaign scheduled successfully!');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Schedule failed');
    } finally {
      setScheduling(false);
    }
  };

  const sendNow = async () => {
    const selectedCount = allSubscribers.length - excluded.size;
    if (!confirm(`Send this campaign to ${selectedCount} subscriber${selectedCount !== 1 ? 's' : ''} NOW?`)) return;
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const r = await adminApi.sendCampaign(parseInt(id!, 10), {
        excludedEmails: excluded.size > 0 ? [...excluded] : [],
      });
      const abNote = (r.sentA !== undefined && r.sentB !== undefined && r.sentB > 0)
        ? ` (A: ${r.sentA}, B: ${r.sentB})`
        : '';
      setSuccess(`✅ Sent to ${r.sent} subscriber${r.sent !== 1 ? 's' : ''}${abNote}!`);
      await refreshCampaign();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="adm-loading-center"><span className="adm-spinner" /></div>;

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{isNew ? '✉️ New Campaign' : `✉️ ${form.title || 'Edit Campaign'}`}</h1>
          {form.status && (
            <p className="adm-page-subtitle">
              Status:{' '}
              <strong
                style={{
                  color:
                    form.status === 'sent'
                      ? '#22c55e'
                      : form.status === 'scheduled'
                        ? '#4f6ef7'
                        : '#f59e0b',
                  textTransform: 'capitalize',
                }}
              >
                {form.status}
              </strong>
              {form.status === 'sent' && ` · ${form.recipient_count} sent · ${form.open_count} opens`}
              {form.status === 'scheduled' && form.scheduled_at && ` · ${fmtDate(form.scheduled_at)}`}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/admin/campaigns')} className="adm-btn">← Back</button>
          <button onClick={save} className="adm-btn adm-btn-primary" disabled={saving}>
            {saving ? <><span className="adm-spinner" style={{ width: 14, height: 14 }} /> Saving…</> : '💾 Save'}
          </button>
          {!isNew && form.status !== 'sent' && (
            <button onClick={scheduleLater} className="adm-btn adm-btn-secondary" disabled={scheduling}>
              {scheduling ? <><span className="adm-spinner" style={{ width: 14, height: 14 }} /> Scheduling…</> : '🕐 Schedule'}
            </button>
          )}
          {!isNew && form.status !== 'sent' && (
            <button
              onClick={sendNow}
              className="adm-btn"
              disabled={sending}
              style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', border: 'none' }}
            >
              {sending ? <><span className="adm-spinner" style={{ width: 14, height: 14 }} /> Sending…</> : '🚀 Send Now'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="adm-alert adm-alert-error" style={{ marginBottom: 16 }}>⚠ {error}</div>}
      {success && <div className="adm-alert adm-alert-success" style={{ marginBottom: 16 }}>✅ {success}</div>}

      {!isNew && (
        <div className="adm-tabs">
          {['edit', 'stats'].map((t) => (
            <button
              key={t}
              onClick={() => navigate(`/admin/campaigns/${id}?tab=${t}`, { replace: true })}
              className={`adm-tab-btn${activeTab === t ? ' active' : ''}`}
            >
              {t === 'edit' ? '✏️ Edit' : '📊 Stats'}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'edit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="adm-card">
            <div className="adm-card-title" style={{ marginBottom: 16 }}>Campaign Settings</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="adm-form-group">
                <label className="adm-label">Campaign Title *</label>
                <input className="adm-input" value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="e.g. April Newsletter" />
              </div>
              <div className="adm-form-group">
                <label className="adm-label">Template Type</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => applyTemplate(t.value)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        border: '1px solid var(--adm-border)',
                        background: form.template_type === t.value ? 'var(--adm-accent)' : 'var(--adm-surface2)',
                        color: form.template_type === t.value ? '#fff' : 'var(--adm-text)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="adm-card">
            <div className="adm-card-title" style={{ marginBottom: 12 }}>Campaign Timing</div>

            {isNew ? (
              <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, color: 'var(--adm-text-muted)', fontSize: 13 }}>
                💾 Save the campaign first, then you can set a scheduled send time.
              </div>
            ) : form.status === 'sent' ? (
              <div style={{ padding: '12px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, color: 'var(--adm-text-muted)', fontSize: 13 }}>
                ✅ Campaign already sent on {form.scheduled_at ? fmtDate(form.scheduled_at) : '—'}.
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                  <div className="adm-form-group" style={{ marginBottom: 0 }}>
                    <label className="adm-label">Date</label>
                      <input
                        className="adm-input"
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        min={getLocalDateInputMin()}
                      />
                  </div>
                  <div className="adm-form-group" style={{ marginBottom: 0 }}>
                    <label className="adm-label">Time</label>
                    <input
                      className="adm-input"
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </div>
                  <button type="button" className="adm-btn adm-btn-secondary" onClick={scheduleLater} disabled={scheduling}>
                    {scheduling ? 'Scheduling…' : 'Save schedule'}
                  </button>
                </div>
                {form.status === 'scheduled' && form.scheduled_at && (
                  <div className="adm-text-muted adm-text-sm" style={{ marginTop: 8 }}>
                    Currently scheduled for {fmtDate(form.scheduled_at)}.
                  </div>
                )}
              </>
            )}
          </div>

          <div className="adm-card">
            <div className="adm-card-title" style={{ marginBottom: 12 }}>
              Campaign Image <span style={{ fontSize: 11, color: 'var(--adm-text-dim)', fontWeight: 400, textTransform: 'none' }}>(optional — shown at top of email)</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="adm-input"
                value={(form as Record<string, string>).image_url || ''}
                onChange={(e) => set('image_url', e.target.value)}
                placeholder="https://... or upload from device"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="adm-btn adm-btn-secondary adm-btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{ whiteSpace: 'nowrap' }}
              >
                {uploading ? <><span className="adm-spinner" style={{ width: 12, height: 12 }} /> Uploading…</> : '📁 Upload'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                  e.target.value = '';
                }}
              />
            </div>
            {(form as Record<string, string>).image_url && (
              <img
                src={getPreviewImageUrl((form as Record<string, string>).image_url)}
                alt="preview"
                style={{ marginTop: 10, maxHeight: 160, maxWidth: '100%', objectFit: 'contain', borderRadius: 8, border: '1px solid var(--adm-border)' }}
              />
            )}
          </div>

          {/* ── Subscriber Picker ─────────────────────────────────────────── */}
          {!isNew && form.status !== 'sent' && allSubscribers.length > 0 && (
            <div className="adm-card">
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setPickerOpen(o => !o)}
              >
                <div>
                  <div className="adm-card-title" style={{ margin: 0 }}>Recipients</div>
                  <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginTop: 3 }}>
                    {allSubscribers.length - excluded.size} / {allSubscribers.length} selected
                    {excluded.size > 0 && <span style={{ color: '#f59e0b', marginLeft: 8 }}>· {excluded.size} excluded</span>}
                  </div>
                </div>
                <span style={{ fontSize: 18, color: 'var(--adm-text-dim)', transition: 'transform .2s', transform: pickerOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
              </div>

              {pickerOpen && (
                <div style={{ marginTop: 14 }}>
                  {/* Toolbar */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <input
                      className="adm-input adm-input-sm"
                      placeholder="Filter emails…"
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      style={{ flex: 1, minWidth: 160 }}
                      onClick={e => e.stopPropagation()}
                    />
                    <button
                      type="button"
                      className="adm-btn adm-btn-ghost adm-btn-sm"
                      onClick={e => { e.stopPropagation(); setExcluded(new Set()); }}
                    >Select All</button>
                    <button
                      type="button"
                      className="adm-btn adm-btn-ghost adm-btn-sm"
                      style={{ color: '#f59e0b' }}
                      onClick={e => { e.stopPropagation(); setExcluded(new Set(allSubscribers)); }}
                    >Deselect All</button>
                  </div>

                  {/* List */}
                  <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--adm-border)', borderRadius: 8 }}>
                    {allSubscribers
                      .filter(email => !pickerSearch.trim() || email.toLowerCase().includes(pickerSearch.toLowerCase()))
                      .map(email => {
                        const isExcluded = excluded.has(email);
                        return (
                          <label
                            key={email}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '9px 14px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--adm-border)',
                              background: isExcluded ? 'rgba(245,158,11,0.06)' : 'transparent',
                              transition: 'background .15s',
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              style={{ width: 15, height: 15, accentColor: 'var(--adm-accent)', flexShrink: 0 }}
                              onChange={() => {
                                setExcluded(prev => {
                                  const next = new Set(prev);
                                  if (next.has(email)) next.delete(email);
                                  else next.add(email);
                                  return next;
                                });
                              }}
                            />
                            <span
                              className="adm-mono"
                              style={{ fontSize: 13, color: isExcluded ? 'var(--adm-text-dim)' : 'var(--adm-text)', textDecoration: isExcluded ? 'line-through' : 'none' }}
                            >
                              {email}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          <TranslationHelper
            fields={{
              subject: form[`subject_${lang}`] || '',
              body: form[`body_${lang}`] || '',
            }}
            sourceLang={lang}
            onTranslated={(t) => handleTranslated(t as Record<string, Record<string, string>>)}
          />

          <div className="adm-card">
            <div className="adm-card-title" style={{ marginBottom: 16 }}>Content</div>
            <div className="adm-tabs" style={{ marginBottom: 16 }}>
              {LANGS.map((l) => (
                <button
                  key={l.key}
                  onClick={() => setLang(l.key)}
                  className={`adm-tab-btn${lang === l.key ? ' active' : ''}`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {LANGS.filter((l) => l.key === lang).map((l) => (
              <div key={l.key} style={{ direction: l.dir, textAlign: l.dir === 'rtl' ? 'right' : 'left' }}>
                <div className="adm-form-group">
                  <label className="adm-label">Subject Line — Group A</label>
                  <input
                    className="adm-input"
                    value={(form as Record<string, string>)[`subject_${l.key}`] || ''}
                    onChange={(e) => set(`subject_${l.key}`, e.target.value)}
                    placeholder="Email subject for Group A (everyone if no B)..."
                    dir={l.dir}
                  />
                </div>
                <div className="adm-form-group">
                  <label className="adm-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Subject Line — Group B
                    <span style={{ fontSize: 10, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>A/B TEST</span>
                  </label>
                  <input
                    className="adm-input"
                    value={(form as Record<string, string>)[`subject_b_${l.key}`] || ''}
                    onChange={(e) => set(`subject_b_${l.key}`, e.target.value)}
                    placeholder="Leave empty to send same subject to everyone..."
                    dir={l.dir}
                    style={{ borderColor: (form as Record<string, string>)[`subject_b_${l.key}`] ? 'rgba(139,92,246,0.5)' : undefined }}
                  />
                  {(form as Record<string, string>)[`subject_b_${l.key}`] && (
                    <div style={{ fontSize: 11, color: '#8b5cf6', marginTop: 4 }}>
                      ✓ A/B test active — odd-numbered subscribers will receive Subject B
                    </div>
                  )}
                </div>
                <div className="adm-form-group">
                  <label className="adm-label">Email Body</label>
                  <textarea
                    className="adm-input"
                    rows={12}
                    value={(form as Record<string, string>)[`body_${l.key}`] || ''}
                    onChange={(e) => set(`body_${l.key}`, e.target.value)}
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
          {/* ── Summary cards ─────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 14, marginBottom: 24 }}>
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
            <div className="adm-stat-card">
              <div className="adm-stat-icon">🔗</div>
              <div className="adm-stat-label">Clicks</div>
              <div className="adm-stat-value" style={{ color: '#f59e0b' }}>
                {sends.reduce((sum, s) => sum + (s.click_count ?? 0), 0)}
              </div>
            </div>
          </div>

          {/* ── A/B breakdown (shown only if variant data exists) ─────────── */}
          {sends.some(s => s.ab_variant === 'b') && (() => {
            const groupA = sends.filter(s => s.ab_variant !== 'b');
            const groupB = sends.filter(s => s.ab_variant === 'b');
            const rate = (group: typeof sends) =>
              group.length ? `${Math.round((group.filter(s => s.opened).length / group.length) * 100)}%` : '—';
            const clicks = (group: typeof sends) => group.reduce((n, s) => n + (s.click_count ?? 0), 0);
            return (
              <div className="adm-card" style={{ marginBottom: 24 }}>
                <div className="adm-card-title" style={{ marginBottom: 14 }}>
                  🧪 A/B Test Results
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[{ label: 'Group A', group: groupA, color: '#4f6ef7' }, { label: 'Group B', group: groupB, color: '#8b5cf6' }].map(({ label, group, color }) => (
                    <div key={label} style={{ background: 'var(--adm-surface2)', borderRadius: 10, padding: '14px 18px', border: `1px solid ${color}40` }}>
                      <div style={{ fontWeight: 700, color, marginBottom: 10, fontSize: 14 }}>{label}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span className="adm-text-muted">Recipients</span>
                          <strong>{group.length}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span className="adm-text-muted">Opens</span>
                          <strong style={{ color: '#22c55e' }}>{group.filter(s => s.opened).length}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span className="adm-text-muted">Open Rate</span>
                          <strong style={{ color }}>{rate(group)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span className="adm-text-muted">Clicks</span>
                          <strong style={{ color: '#f59e0b' }}>{clicks(group)}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Delivery table ─────────────────────────────────────────────── */}
          <div className="adm-card">
            <div className="adm-card-title" style={{ marginBottom: 14 }}>Delivery Details</div>
            {!statsLoaded ? (
              <p className="adm-text-muted adm-text-sm"><span className="adm-spinner" style={{ width: 14, height: 14, marginRight: 8 }} />Loading…</p>
            ) : !sends.length ? (
              <p className="adm-text-muted adm-text-sm">No emails sent yet for this campaign.</p>
            ) : (() => {
              // Compute once — avoids O(n²) inside the row map
              const hasVariant = sends.some(s => s.ab_variant);
              return (
                <table className="adm-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      {hasVariant && <th>Variant</th>}
                      <th>Sent</th>
                      <th>Opened</th>
                      <th>Clicks</th>
                      <th>Open Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sends.map((s) => (
                      <tr key={s.id}>
                        <td className="adm-mono">{s.email}</td>
                        {hasVariant && (
                          <td>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                              background: s.ab_variant === 'b' ? 'rgba(139,92,246,0.15)' : 'rgba(79,110,247,0.15)',
                              color: s.ab_variant === 'b' ? '#8b5cf6' : '#4f6ef7',
                            }}>
                              {s.ab_variant?.toUpperCase() ?? 'A'}
                            </span>
                          </td>
                        )}
                        <td>{fmtDate(s.created_at)}</td>
                        <td>
                          {s.opened ? (
                            <span style={{ color: '#22c55e', fontWeight: 700 }}>✅ Yes</span>
                          ) : (
                            <span style={{ color: 'var(--adm-text-dim)' }}>—</span>
                          )}
                        </td>
                        <td>
                          {(s.click_count ?? 0) > 0 ? (
                            <span style={{ color: '#f59e0b', fontWeight: 700 }}>{s.click_count}</span>
                          ) : (
                            <span style={{ color: 'var(--adm-text-dim)' }}>—</span>
                          )}
                        </td>
                        <td>{s.opened_at ? fmtDate(s.opened_at) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
