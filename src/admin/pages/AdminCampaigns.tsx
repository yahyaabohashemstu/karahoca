import React, { useState } from 'react';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate, fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import {
  AdminIcon, Alert, Badge, Button, Card, EmptyState, IconButton, Loading, PageHeader,
  StatCard, StatGrid, StatusBadge, type IconName, type Tone,
} from '../ui';

const messages = defineMessages({
  en: {
    title: 'Email campaigns',
    subtitle: 'Compose, schedule & send newsletters to all subscribers',
    newCampaign: 'New campaign',
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
    noCampaignsText: 'A campaign is one e-mail to the newsletter subscribers, each in their own language.',
    createFirst: 'Create your first campaign',
    tplCustom: 'Custom',
    tplNewProduct: 'New product',
    tplOffer: 'Special offer',
    tplNews: 'Company news',
    createdAt: 'Created: {date}',
    sentAt: 'Sent: {date}',
    scheduledAt: 'Scheduled: {date}',
    queuedNote: 'Queued for background delivery',
    sendingNow: 'Sending now…',
    recipients: { one: '{n} recipient', other: '{n} recipients' },
    opens: { one: '{n} open', other: '{n} opens' },
    openRate: 'Open rate',
    clicks: { one: '{n} click', other: '{n} clicks' },
    stats: 'Stats',
    queueing: 'Queueing…',
    queueSend: 'Queue send',
    editCampaignLabel: 'Edit campaign {title}',
    viewCampaignLabel: 'View campaign {title}',
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
    noCampaignsText: 'الحملة رسالة واحدة إلى مشتركي النشرة البريدية، يتلقاها كل مشترك بلغته.',
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
    openRate: 'معدل الفتح',
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
    editCampaignLabel: 'تعديل الحملة {title}',
    viewCampaignLabel: 'عرض الحملة {title}',
    deleteCampaignLabel: 'حذف الحملة {title}',
  },
});

type Key = keyof typeof messages.en;

const TPL_LABEL: Record<string, { icon: IconName; label: Key }> = {
  custom: { icon: 'edit', label: 'tplCustom' },
  new_product: { icon: 'products', label: 'tplNewProduct' },
  offer: { icon: 'tag', label: 'tplOffer' },
  news: { icon: 'news', label: 'tplNews' },
};

/** One item of a campaign's meta line: a small icon and its text. */
const Meta: React.FC<{ icon: IconName; children: React.ReactNode }> = ({ icon, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
    <AdminIcon name={icon} size="xs" />
    <span>{children}</span>
  </span>
);

export const AdminCampaigns: React.FC = () => {
  const { data, loading, error, reload } = useAsync(() => adminApi.getCampaigns(), []);
  const [sending, setSending] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);
  const t = useT(messages);
  const tc = useT(common);

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(t('confirmDelete', { title }))) return;
    setMsg(null);
    try {
      await adminApi.deleteCampaign(id);
      reload();
    } catch (e: unknown) {
      setMsg({ tone: 'danger', text: e instanceof Error ? e.message : t('deleteFailed') });
    }
  };

  const handleSend = async (id: number) => {
    if (!confirm(t('confirmSend'))) return;
    setSending(id); setMsg(null);
    try {
      const res = await adminApi.sendCampaign(id);
      if (res.alreadyQueued) {
        setMsg({ tone: 'warning', text: t('alreadyQueued') });
      } else {
        setMsg({ tone: 'success', text: t('queuedOk') });
      }
      reload();
    } catch (e: unknown) {
      setMsg({ tone: 'danger', text: e instanceof Error ? e.message : t('sendFailed') });
    } finally { setSending(null); }
  };

  const campaigns = data?.campaigns ?? [];
  const summary: { label: Key; value: number; icon: IconName; tone: Tone }[] = [
    { label: 'cardTotal', value: campaigns.length, icon: 'mail', tone: 'accent' },
    { label: 'cardDrafts', value: campaigns.filter(c => c.status === 'draft').length, icon: 'draft', tone: 'warning' },
    { label: 'cardScheduled', value: campaigns.filter(c => c.status === 'scheduled').length, icon: 'clock', tone: 'info' },
    { label: 'cardQueued', value: campaigns.filter(c => c.status === 'queued').length, icon: 'hourglass', tone: 'info' },
    { label: 'cardSent', value: campaigns.filter(c => c.status === 'sent').length, icon: 'checkCircle', tone: 'success' },
    { label: 'cardOpens', value: campaigns.reduce((s, c) => s + c.open_count, 0), icon: 'eye', tone: 'violet' },
    { label: 'cardClicks', value: campaigns.reduce((s, c) => s + (c.click_count ?? 0), 0), icon: 'pointer', tone: 'accent' },
  ];

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={<Button to="/admin/campaigns/new" variant="primary" icon="plus">{t('newCampaign')}</Button>}
      />

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {loading && <Loading label={tc('loading')} />}
      {error && <Alert tone="danger">{error}</Alert>}

      {!loading && !error && (
        <>
          {data?.campaigns && (
            <StatGrid min={140}>
              {summary.map(card => (
                <StatCard key={card.label} icon={card.icon} tone={card.tone} label={t(card.label)} value={fmtNumber(card.value)} />
              ))}
            </StatGrid>
          )}

          {!campaigns.length ? (
            <Card>
              <EmptyState
                icon="mail"
                title={t('noCampaigns')}
                text={t('noCampaignsText')}
                action={<Button to="/admin/campaigns/new" variant="primary" icon="plus" size="sm">{t('createFirst')}</Button>}
              />
            </Card>
          ) : (
            <div className="adm-stack">
              {campaigns.map(c => {
                const tpl = TPL_LABEL[c.template_type];
                const editable = c.status === 'draft' || c.status === 'scheduled';
                return (
                  <Card key={c.id}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                          <h2 className="adm-card-title" style={{ margin: 0 }} dir="auto">{c.title}</h2>
                          <StatusBadge status={c.status} />
                        </div>
                        <div className="adm-text-sm adm-text-muted" style={{ display: 'flex', gap: '6px 16px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {tpl ? <Meta icon={tpl.icon}>{t(tpl.label)}</Meta> : <span>{c.template_type}</span>}
                          <Meta icon="calendar">{t('createdAt', { date: fmtDate(c.created_at) })}</Meta>
                          {c.sent_at && <Meta icon="send">{t('sentAt', { date: fmtDateTime(c.sent_at) })}</Meta>}
                          {c.scheduled_at && c.status === 'scheduled' && (
                            <Meta icon="clock">{t('scheduledAt', { date: fmtDateTime(c.scheduled_at) })}</Meta>
                          )}
                          {c.status === 'queued' && <Meta icon="hourglass">{t('queuedNote')}</Meta>}
                          {c.status === 'sending' && <Meta icon="send">{t('sendingNow')}</Meta>}
                          {c.status === 'sent' && (
                            <>
                              <Meta icon="cohorts">{t.plural('recipients', c.recipient_count)}</Meta>
                              <Meta icon="eye">{t.plural('opens', c.open_count)}</Meta>
                              {c.recipient_count > 0 && (
                                <Badge tone="success" title={t('openRate')}>
                                  {Math.round((c.open_count / c.recipient_count) * 100)}%
                                </Badge>
                              )}
                              {/* Raw count: it includes repeat clicks, so a
                                  per-recipient rate could pass 100 %. */}
                              <Meta icon="pointer">{t.plural('clicks', c.click_count ?? 0)}</Meta>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="adm-row-actions" style={{ flexShrink: 0, gap: 6 }}>
                        {c.status === 'sent' && (
                          <Button to={`/admin/campaigns/${c.id}?tab=stats`} variant="secondary" size="sm" icon="insights">
                            {t('stats')}
                          </Button>
                        )}
                        {editable && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon="send"
                            onClick={() => handleSend(c.id)}
                            loading={sending === c.id}
                          >
                            {sending === c.id ? t('queueing') : t('queueSend')}
                          </Button>
                        )}
                        <IconButton
                          icon={editable ? 'edit' : 'eye'}
                          size="sm"
                          label={t(editable ? 'editCampaignLabel' : 'viewCampaignLabel', { title: c.title })}
                          to={`/admin/campaigns/${c.id}`}
                        />
                        {c.status !== 'sending' && (
                          <IconButton
                            icon="trash"
                            tone="danger"
                            size="sm"
                            label={t('deleteCampaignLabel', { title: c.title })}
                            onClick={() => handleDelete(c.id, c.title)}
                          />
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
