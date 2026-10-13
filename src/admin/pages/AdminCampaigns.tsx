import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate, fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

const messages = defineMessages({
  en: {
    title: 'Email Campaigns',
    subtitle: 'Compose, schedule & send newsletters to all subscribers',
    newCampaign: 'New Campaign',
    confirmDelete: 'Delete the campaign "{title}"? Its delivery stats are deleted with it.',
    deleteFailed: 'Delete failed',
    confirmSend: 'Send this campaign now? It goes to the recipients selected in the campaign (every active subscriber unless some were unticked).',
    alreadyQueued: 'Campaign is already queued for background delivery.',
    queuedOk: 'Campaign queued for background delivery.',
    sendFailed: 'Send failed',
    cardTotal: 'Total',
    cardDrafts: 'Drafts',
    cardScheduled: 'Scheduled',
    cardQueued: 'Queued',
    cardSent: 'Sent',
    cardOpens: 'Opens',
    cardClicks: 'Clicks',
    noCampaigns: 'No campaigns yet.',
    createFirst: 'Create Your First Campaign',
    tplCustom: 'Custom',
    tplNewProduct: 'New Product',
    tplOffer: 'Special Offer',
    tplNews: 'Company News',
    createdAt: 'Created: {date}',
    sentAt: 'Sent: {date}',
    scheduledAt: 'Scheduled: {date}',
    queuedNote: 'Queued for background delivery',
    sendingNow: 'Sending now…',
    recipients: { one: '{n} recipient', other: '{n} recipients' },
    opens: { one: '{n} open', other: '{n} opens' },
    clicks: { one: '{n} click', other: '{n} clicks' },
    stats: 'Stats',
    queueing: 'Queueing…',
    queueSend: 'Queue Send',
    deleteCampaignLabel: 'Delete campaign {title}',
  },
  ar: {
    title: 'الحملات البريدية',
    subtitle: 'إنشاء النشرات البريدية وجدولتها وإرسالها إلى جميع المشتركين',
    newCampaign: 'حملة جديدة',
    confirmDelete: 'حذف الحملة «{title}»؟ ستُحذف إحصاءات إرسالها معها.',
    deleteFailed: 'فشل الحذف',
    confirmSend: 'إرسال هذه الحملة الآن؟ ستصل إلى المستلمين المحددين في الحملة (جميع المشتركين النشطين ما لم يُلغَ تحديد بعضهم).',
    alreadyQueued: 'الحملة موجودة بالفعل في قائمة انتظار الإرسال في الخلفية.',
    queuedOk: 'أُضيفت الحملة إلى قائمة انتظار الإرسال في الخلفية.',
    sendFailed: 'فشل الإرسال',
    cardTotal: 'الإجمالي',
    cardDrafts: 'المسودات',
    cardScheduled: 'المجدولة',
    cardQueued: 'في قائمة الانتظار',
    cardSent: 'المُرسَلة',
    cardOpens: 'مرات الفتح',
    cardClicks: 'النقرات',
    noCampaigns: 'لا توجد حملات بعد.',
    createFirst: 'أنشئ أول حملة',
    tplCustom: 'مخصص',
    tplNewProduct: 'منتج جديد',
    tplOffer: 'عرض خاص',
    tplNews: 'أخبار الشركة',
    createdAt: 'أُنشئت: {date}',
    sentAt: 'أُرسلت: {date}',
    scheduledAt: 'مجدولة: {date}',
    queuedNote: 'في قائمة انتظار الإرسال في الخلفية',
    sendingNow: 'جارٍ الإرسال الآن…',
    recipients: {
      zero: 'لا مستلمين',
      one: 'مستلم واحد',
      two: 'مستلمان',
      few: '{n} مستلمين',
      many: '{n} مستلمًا',
      other: '{n} مستلم',
    },
    opens: {
      zero: 'لم تُفتح بعد',
      one: 'فُتحت مرة واحدة',
      two: 'فُتحت مرتين',
      few: 'فُتحت {n} مرات',
      many: 'فُتحت {n} مرة',
      other: 'فُتحت {n} مرة',
    },
    clicks: {
      zero: 'لا نقرات',
      one: 'نقرة واحدة',
      two: 'نقرتان',
      few: '{n} نقرات',
      many: '{n} نقرة',
      other: '{n} نقرة',
    },
    stats: 'الإحصاءات',
    queueing: 'جارٍ الإرسال…',
    queueSend: 'إرسال الآن',
    deleteCampaignLabel: 'حذف الحملة {title}',
  },
});

type Key = keyof typeof messages.en;
type StatusKey = 'draft' | 'scheduled' | 'queued' | 'sending' | 'sent';

const STATUS_COLOR: Record<string, string> = {
  draft: '#f59e0b', scheduled: '#4f6ef7', queued: '#0ea5e9', sending: '#0ea5e9', sent: '#22c55e',
};
const STATUS_ICON: Record<string, string> = {
  draft: '✏️', scheduled: '🕐', queued: '⏳', sending: '📤', sent: '✅',
};
// Labels come from the shared status words (i18n/common).
const STATUS_KEYS: readonly string[] = ['draft', 'scheduled', 'queued', 'sending', 'sent'] satisfies StatusKey[];
const TPL_LABEL: Record<string, { icon: string; label: Key }> = {
  custom: { icon: '', label: 'tplCustom' },
  new_product: { icon: '🧴', label: 'tplNewProduct' },
  offer: { icon: '🏷️', label: 'tplOffer' },
  news: { icon: '📰', label: 'tplNews' },
};

export const AdminCampaigns: React.FC = () => {
  const { data, loading, error, reload } = useAsync(() => adminApi.getCampaigns(), []);
  const [sending, setSending] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const t = useT(messages);
  const tc = useT(common);

  const statusText = (status: string) => (STATUS_KEYS.includes(status) ? tc(status as StatusKey) : status);
  const templateText = (type: string) => {
    const tpl = TPL_LABEL[type];
    if (!tpl) return type;
    return tpl.icon ? `${tpl.icon} ${t(tpl.label)}` : t(tpl.label);
  };

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(t('confirmDelete', { title }))) return;
    setMsg('');
    try {
      await adminApi.deleteCampaign(id);
      reload();
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : t('deleteFailed')}`);
    }
  };

  const handleSend = async (id: number) => {
    if (!confirm(t('confirmSend'))) return;
    setSending(id); setMsg('');
    try {
      const res = await adminApi.sendCampaign(id);
      if (res.alreadyQueued) {
        setMsg(`⚠️ ${t('alreadyQueued')}`);
      } else {
        setMsg(`✅ ${t('queuedOk')}`);
      }
      reload();
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : t('sendFailed')}`);
    } finally { setSending(null); }
  };

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{t('title')}</h1>
          <p className="adm-page-subtitle">{t('subtitle')}</p>
        </div>
        <Link to="/admin/campaigns/new" className="adm-btn adm-btn-primary">
          ✉️ {t('newCampaign')}
        </Link>
      </div>

      {msg && (
        <div className={`adm-alert ${msg.startsWith('✅') ? 'adm-alert-success' : 'adm-alert-error'}`}
             style={{ marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {loading && <div className="adm-loading-center"><span className="adm-spinner" /></div>}
      {error   && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

      {!loading && !error && (
        <>
          {/* Summary cards */}
          {data?.campaigns && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
              {([
                { label: 'cardTotal',     value: data.campaigns.length,                              color: 'var(--adm-accent)' },
                { label: 'cardDrafts',    value: data.campaigns.filter(c => c.status === 'draft').length,    color: '#f59e0b' },
                { label: 'cardScheduled', value: data.campaigns.filter(c => c.status === 'scheduled').length, color: '#4f6ef7' },
                { label: 'cardQueued',    value: data.campaigns.filter(c => c.status === 'queued').length,    color: '#0ea5e9' },
                { label: 'cardSent',      value: data.campaigns.filter(c => c.status === 'sent').length,     color: '#22c55e' },
                { label: 'cardOpens',     value: data.campaigns.reduce((s, c) => s + c.open_count, 0),       color: '#8b5cf6' },
                { label: 'cardClicks',    value: data.campaigns.reduce((s, c) => s + (c.click_count ?? 0), 0), color: '#f59e0b' },
              ] satisfies { label: Key; value: number; color: string }[]).map(card => (
                <div key={card.label} className="adm-stat-card" style={{ padding: '16px 18px' }}>
                  <div className="adm-stat-label">{t(card.label)}</div>
                  <div className="adm-stat-value" style={{ color: card.color, fontSize: 24 }}>{fmtNumber(card.value)}</div>
                </div>
              ))}
            </div>
          )}

          {!data?.campaigns?.length ? (
            <div className="adm-card" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
              <p className="adm-text-muted">{t('noCampaigns')}</p>
              <Link to="/admin/campaigns/new" className="adm-btn adm-btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>
                {t('createFirst')}
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data!.campaigns.map(c => (
                <div key={c.id} style={{
                  background: 'var(--adm-surface)', border: '1px solid var(--adm-border)',
                  borderRadius: 12, padding: '18px 20px',
                  borderInlineStart: `3px solid ${STATUS_COLOR[c.status] || 'var(--adm-border)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 18 }}>{STATUS_ICON[c.status]}</span>
                        <span dir="auto" style={{ fontWeight: 700, fontSize: 15, color: 'var(--adm-text)' }}>{c.title}</span>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 20,
                          background: `${STATUS_COLOR[c.status]}22`, color: STATUS_COLOR[c.status],
                          fontWeight: 600, textTransform: 'capitalize',
                        }}>{statusText(c.status)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--adm-text-muted)' }}>
                        <span>{templateText(c.template_type)}</span>
                        <span>{t('createdAt', { date: fmtDate(c.created_at) })}</span>
                        {c.sent_at && <span style={{ color: '#22c55e' }}>{t('sentAt', { date: fmtDateTime(c.sent_at) })}</span>}
                        {c.scheduled_at && c.status === 'scheduled' && (
                          <span style={{ color: '#4f6ef7' }}>{t('scheduledAt', { date: fmtDateTime(c.scheduled_at) })}</span>
                        )}
                        {c.status === 'queued' && (
                          <span style={{ color: '#0ea5e9' }}>{t('queuedNote')}</span>
                        )}
                        {c.status === 'sending' && (
                          <span style={{ color: '#0ea5e9' }}>{t('sendingNow')}</span>
                        )}
                        {c.status === 'sent' && (
                          <>
                            <span>👥 {t.plural('recipients', c.recipient_count)}</span>
                            <span>👁 {t.plural('opens', c.open_count)}
                              {c.recipient_count > 0 && (
                                <span style={{ color: '#22c55e', marginInlineStart: 4 }}>
                                  ({Math.round((c.open_count / c.recipient_count) * 100)}%)
                                </span>
                              )}
                            </span>
                            {/* Raw count: it includes repeat clicks, so a
                                per-recipient rate could pass 100 %. */}
                            <span>🖱 {t.plural('clicks', c.click_count ?? 0)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {c.status === 'sent' && (
                        <Link to={`/admin/campaigns/${c.id}?tab=stats`}
                              className="adm-btn adm-btn-sm"
                              style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.25)' }}>
                          📊 {t('stats')}
                        </Link>
                      )}
                      {(c.status === 'draft' || c.status === 'scheduled') && (
                        <button
                          className="adm-btn adm-btn-sm adm-btn-primary"
                          onClick={() => handleSend(c.id)}
                          disabled={sending === c.id}
                        >
                          {sending === c.id ? <><span className="adm-spinner" style={{ width: 12, height: 12 }} /> {t('queueing')}</> : `🚀 ${t('queueSend')}`}
                        </button>
                      )}
                      <Link to={`/admin/campaigns/${c.id}`} className="adm-btn adm-btn-sm">
                        {c.status === 'draft' || c.status === 'scheduled' ? `✏️ ${tc('edit')}` : `👁 ${tc('view')}`}
                      </Link>
                      {c.status !== 'sending' && (
                        <button
                          className="adm-btn adm-btn-sm adm-btn-danger"
                          onClick={() => handleDelete(c.id, c.title)}
                          aria-label={t('deleteCampaignLabel', { title: c.title })}
                          title={tc('delete')}
                        >🗑</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
