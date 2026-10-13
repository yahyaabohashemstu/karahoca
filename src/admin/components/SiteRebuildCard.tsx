import React, { useState } from 'react';
import { adminApi, type SiteRebuildStatus } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDateTime, fmtTime } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { Alert, Badge, Button, Card, Loading } from '../ui';

const messages = defineMessages({
  en: {
    title: 'Search-engine copy',
    copy: 'The pre-rendered pages Google and link previews read.',
    notSetUpPending: 'Changes not published to search engines yet',
    upToDate: 'Up to date',
    notSetUpDetail: 'Automatic refresh is not set up, so search engines see changes only after the next deploy. Add SITE_REBUILD_WEBHOOK_URL and SITE_REBUILD_WEBHOOK_TOKEN to the API service in Coolify to switch it on.',
    failedTitle: 'Last refresh failed — retrying',
    failedDetail: '{error}. Next attempt {when}.',
    atTime: 'at {time}',
    soon: 'soon',
    unknownError: 'Unknown error',
    scheduled: 'Refresh scheduled for {time}',
    scheduledNoTime: 'Refresh scheduled',
    waiting: {
      one: 'Waiting for 1 quiet minute after the last change ({at}), so a batch of edits causes one rebuild. The rebuild itself takes about 3 minutes.',
      other: 'Waiting for {n} quiet minutes after the last change ({at}), so a batch of edits causes one rebuild. The rebuild itself takes about 3 minutes.',
    },
    lastRefreshed: 'Last refreshed {at}. Changes are picked up automatically.',
    automatic: 'Changes are picked up automatically a few minutes after you save.',
    refreshNow: 'Refresh now',
    requesting: 'Requesting…',
    failed: 'Rebuild failed',
  },
  ar: {
    title: 'نسخة محركات البحث',
    copy: 'الصفحات المُعدّة مسبقًا التي يقرؤها Google ومعاينات الروابط.',
    notSetUpPending: 'التغييرات لم تصل إلى محركات البحث بعد',
    upToDate: 'محدّثة',
    notSetUpDetail: 'التحديث التلقائي غير مفعّل، لذلك لا تظهر التغييرات لمحركات البحث إلا بعد النشر التالي. أضف SITE_REBUILD_WEBHOOK_URL و SITE_REBUILD_WEBHOOK_TOKEN إلى خدمة الـ API في Coolify لتفعيله.',
    failedTitle: 'فشل التحديث الأخير — ستُعاد المحاولة',
    failedDetail: '{error}. المحاولة التالية {when}.',
    atTime: 'عند {time}',
    soon: 'قريبًا',
    unknownError: 'خطأ غير معروف',
    scheduled: 'التحديث مجدول عند {time}',
    scheduledNoTime: 'التحديث مجدول',
    waiting: {
      one: 'ننتظر دقيقة هدوء واحدة بعد آخر تغيير ({at})، حتى تُجمع التعديلات المتتالية في تحديث واحد. يستغرق التحديث نفسه نحو 3 دقائق.',
      two: 'ننتظر دقيقتين من الهدوء بعد آخر تغيير ({at})، حتى تُجمع التعديلات المتتالية في تحديث واحد. يستغرق التحديث نفسه نحو 3 دقائق.',
      few: 'ننتظر {n} دقائق من الهدوء بعد آخر تغيير ({at})، حتى تُجمع التعديلات المتتالية في تحديث واحد. يستغرق التحديث نفسه نحو 3 دقائق.',
      other: 'ننتظر {n} دقيقة من الهدوء بعد آخر تغيير ({at})، حتى تُجمع التعديلات المتتالية في تحديث واحد. يستغرق التحديث نفسه نحو 3 دقائق.',
    },
    lastRefreshed: 'آخر تحديث {at}. تُلتقط التغييرات تلقائيًا.',
    automatic: 'تُلتقط التغييرات تلقائيًا بعد دقائق من الحفظ.',
    refreshNow: 'تحديث الآن',
    requesting: 'جارٍ الطلب…',
    failed: 'فشل التحديث',
  },
});

// Status of the pre-rendered public pages (what search engines and link
// previews read). They are rebuilt automatically a few minutes after the
// last content change; this card says whether that is set up, what is
// still waiting, and lets the admin rebuild at once.
export const SiteRebuildCard: React.FC = () => {
  const { data, loading, error, reload } = useAsync<SiteRebuildStatus>(() => adminApi.getSiteRebuild(), []);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const t = useT(messages);
  const tc = useT(common);

  const rebuildNow = async () => {
    setBusy(true);
    setActionError('');
    try {
      await adminApi.triggerSiteRebuild();
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('failed'));
    } finally {
      setBusy(false);
    }
  };

  let tone: 'ok' | 'wait' | 'warn' = 'ok';
  let headline = '';
  let detail = '';
  if (data) {
    if (!data.configured) {
      tone = data.pending ? 'warn' : 'ok';
      headline = data.pending ? t('notSetUpPending') : t('upToDate');
      detail = t('notSetUpDetail');
    } else if (data.lastStatus === 'error' && data.pending) {
      tone = 'warn';
      headline = t('failedTitle');
      detail = t('failedDetail', {
        error: data.lastError ?? t('unknownError'),
        when: data.nextRunAt ? t('atTime', { time: fmtTime(data.nextRunAt) }) : t('soon'),
      });
    } else if (data.pending) {
      tone = 'wait';
      headline = data.nextRunAt ? t('scheduled', { time: fmtTime(data.nextRunAt) }) : t('scheduledNoTime');
      detail = t.plural('waiting', data.delayMinutes, { at: fmtDateTime(data.lastChangeAt) });
    } else {
      tone = 'ok';
      headline = t('upToDate');
      detail = data.lastTriggeredAt
        ? t('lastRefreshed', { at: fmtDateTime(data.lastTriggeredAt) })
        : t('automatic');
    }
  }

  const look = { ok: { tone: 'success', icon: 'checkCircle' }, wait: { tone: 'info', icon: 'clock' }, warn: { tone: 'warning', icon: 'alert' } } as const;

  return (
    <Card
      className="adm-dashboard-side-panel adm-site-rebuild"
      title={t('title')}
      icon="search"
      subtitle={t('copy')}
    >
      {loading && !data && <Loading inline label={tc('loading')} />}
      {error && <Alert tone="danger">{error}</Alert>}
      {data && (
        <>
          <div role="status">
            <Badge tone={look[tone].tone} icon={look[tone].icon}>{headline}</Badge>
          </div>
          <p className="adm-site-rebuild-detail">{detail}</p>
          {actionError && <Alert tone="danger">{actionError}</Alert>}
          {data.configured && (
            <Button size="sm" icon="refresh" onClick={rebuildNow} loading={busy}>
              {busy ? t('requesting') : t('refreshNow')}
            </Button>
          )}
        </>
      )}
    </Card>
  );
};
