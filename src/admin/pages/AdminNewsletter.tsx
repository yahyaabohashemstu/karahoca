import React, { useEffect, useState } from 'react';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { Alert, Button, Card, EmptyState, IconButton, LangTag, Loading, PageHeader, Tabs, Toolbar, type TabItem } from '../ui';

const messages = defineMessages({
  en: {
    title: 'Newsletter subscribers',
    activeSubscribers: { one: '{n} active subscriber', other: '{n} active subscribers' },
    countUnavailable: 'Subscriber count unavailable',
    exporting: 'Exporting…',
    languageFilter: 'Language',
    unknownHint: {
      one: '1 subscriber signed up before the language was recorded and receives campaigns in the first language written (Arabic when available). Set their language below if you know it.',
      other: '{n} subscribers signed up before the language was recorded and receive campaigns in the first language written (Arabic when available). Set their language below if you know it.',
    },
    confirmUnsubscribe: 'Unsubscribe {email}?',
    unsubscribeFailed: 'Failed to unsubscribe',
    langChangeFailed: 'Failed to change the language',
    exportFailed: 'Failed to export subscribers',
    loadFailed: "Couldn't load subscribers: {error}",
    colEmail: 'Email',
    colSubscribedAt: 'Subscribed at',
    noSubscribersLang: 'No subscribers with this language.',
    noSubscribers: 'No subscribers yet.',
    languageFor: 'Language for {email}',
    unsubscribe: 'Unsubscribe {email}',
  },
  ar: {
    title: 'مشتركو النشرة البريدية',
    activeSubscribers: {
      zero: 'لا يوجد مشتركون نشطون',
      one: 'مشترك نشط واحد',
      two: 'مشتركان نشطان',
      few: '{n} مشتركين نشطين',
      many: '{n} مشتركًا نشطًا',
      other: '{n} مشترك نشط',
    },
    countUnavailable: 'عدد المشتركين غير متاح',
    exporting: 'جارٍ التصدير…',
    languageFilter: 'اللغة',
    unknownHint: {
      one: 'مشترك واحد سجّل قبل بدء حفظ اللغة، فتصله الحملات بأول لغة مكتوبة (العربية إن وُجدت). حدّد لغته أدناه إن كانت معروفة.',
      two: 'مشتركان سجّلا قبل بدء حفظ اللغة، فتصلهما الحملات بأول لغة مكتوبة (العربية إن وُجدت). حدّد لغتيهما أدناه إن كانت معروفة.',
      few: '{n} مشتركين سجّلوا قبل بدء حفظ اللغة، فتصلهم الحملات بأول لغة مكتوبة (العربية إن وُجدت). حدّد لغاتهم أدناه إن كانت معروفة.',
      many: '{n} مشتركًا سجّلوا قبل بدء حفظ اللغة، فتصلهم الحملات بأول لغة مكتوبة (العربية إن وُجدت). حدّد لغاتهم أدناه إن كانت معروفة.',
      other: '{n} مشترك سجّلوا قبل بدء حفظ اللغة، فتصلهم الحملات بأول لغة مكتوبة (العربية إن وُجدت). حدّد لغاتهم أدناه إن كانت معروفة.',
    },
    confirmUnsubscribe: 'إلغاء اشتراك {email}؟',
    unsubscribeFailed: 'تعذّر إلغاء الاشتراك',
    langChangeFailed: 'تعذّر تغيير اللغة',
    exportFailed: 'تعذّر تصدير المشتركين',
    loadFailed: 'تعذّر تحميل المشتركين: {error}',
    colEmail: 'البريد الإلكتروني',
    colSubscribedAt: 'تاريخ الاشتراك',
    noSubscribersLang: 'لا يوجد مشتركون بهذه اللغة.',
    noSubscribers: 'لا يوجد مشتركون بعد.',
    languageFor: 'لغة {email}',
    unsubscribe: 'إلغاء اشتراك {email}',
  },
});

// Campaigns reach each subscriber in this language (or the closest one
// written). Older subscribers signed up before it was recorded.
const LANG_OPTIONS = ['ar', 'en', 'tr', 'ru'] as const;
const FILTERS = ['', ...LANG_OPTIONS, 'unknown'] as const;

export const AdminNewsletter: React.FC = () => {
  const [page, setPage] = useState(1);
  const [langFilter, setLangFilter] = useState<(typeof FILTERS)[number]>('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savingLang, setSavingLang] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState('');
  const t = useT(messages);
  const tc = useT(common);

  const { data, loading, error, reload } = useAsync(
    () => adminApi.getNewsletter(page, undefined, langFilter || undefined),
    [page, langFilter]
  );

  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  // Unsubscribing the only row of the last page left the admin on a page
  // past the end: an empty table reading "No subscribers yet".
  useEffect(() => {
    if (data && page > lastPage) setPage(lastPage);
  }, [data, page, lastPage]);

  const handleUnsubscribe = async (email: string) => {
    if (!confirm(t('confirmUnsubscribe', { email }))) return;
    setDeleting(email);
    setActionError('');
    try {
      // Route through adminApi so the admin CSRF double-submit cookie is
      // attached. The previous raw `fetch` bypassed the helper and would
      // have been rejected 403 by the server's admin-CSRF guard.
      await adminApi.deleteSubscriber(email);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('unsubscribeFailed'));
    } finally {
      setDeleting(null);
    }
  };

  const handleLangChange = async (email: string, lang: string) => {
    setSavingLang(email);
    setActionError('');
    try {
      await adminApi.setSubscriberLang(email, lang || null);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('langChangeFailed'));
    } finally {
      setSavingLang(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setActionError('');
    try {
      const blob = await adminApi.exportNewsletterCsv();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'subscribers.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const subscribers = data?.subscribers ?? [];
  const counts = data?.langCounts;
  const allCount = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;

  // Language filter: a language chip (never a flag) and the count per language.
  const filterItems: TabItem<(typeof FILTERS)[number]>[] = FILTERS.map((value) => {
    const n = value === '' ? allCount : counts?.[value];
    return {
      value,
      label: value === ''
        ? tc('all')
        : value === 'unknown'
          ? tc('lang_unknown')
          : <><LangTag lang={value} /> {tc(`lang_${value}`)}</>,
      badge: n !== undefined ? fmtNumber(n) : undefined,
    };
  });

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={allCount !== undefined
          ? t.plural('activeSubscribers', allCount)
          : error ? t('countUnavailable') : tc('loading')}
        actions={(
          <Button icon="download" onClick={handleExport} loading={exporting}>
            {exporting ? t('exporting') : tc('exportCsv')}
          </Button>
        )}
      />

      <Toolbar>
        <span className="adm-toolbar-label">{t('languageFilter')}</span>
        <Tabs
          variant="segmented"
          ariaLabel={tc('language')}
          items={filterItems}
          value={langFilter}
          onChange={(value) => { setLangFilter(value); setPage(1); }}
        />
      </Toolbar>

      {!!counts?.unknown && (
        <Alert tone="info">{t.plural('unknownHint', counts.unknown)}</Alert>
      )}

      {actionError && <Alert tone="danger">{actionError}</Alert>}
      {loading && <Loading label={tc('loading')} />}
      {error && (
        <Alert
          tone="danger"
          action={<Button size="sm" icon="refresh" onClick={() => reload()}>{tc('retry')}</Button>}
        >
          {t('loadFailed', { error })}
        </Alert>
      )}

      {/* On an error the table would say "No subscribers yet", which is not
          what the admin should conclude. */}
      {!loading && !error && (
        <>
          <Card flush>
            {subscribers.length === 0 ? (
              <EmptyState
                icon="newsletter"
                title={langFilter ? t('noSubscribersLang') : t('noSubscribers')}
                compact
              />
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>{t('colEmail')}</th>
                      <th>{tc('language')}</th>
                      <th>{t('colSubscribedAt')}</th>
                      <th className="adm-col-actions"><span className="adm-sr-only">{tc('actions')}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map(sub => (
                      <tr key={sub.email}>
                        <td className="adm-cell-ltr">{sub.email}</td>
                        <td>
                          <select
                            className="adm-select adm-select-sm"
                            value={sub.lang ?? ''}
                            onChange={(e) => handleLangChange(sub.email, e.target.value)}
                            disabled={savingLang === sub.email}
                            aria-label={t('languageFor', { email: sub.email })}
                          >
                            <option value="">{tc('lang_unknown')}</option>
                            {LANG_OPTIONS.map((value) => <option key={value} value={value}>{tc(`lang_${value}`)}</option>)}
                          </select>
                        </td>
                        <td className="adm-text-muted adm-text-sm">
                          {fmtDateTime(sub.subscribed_at)}
                        </td>
                        <td className="adm-col-actions">
                          <div className="adm-row-actions">
                            {/* Unsubscribing stops the mailings (the row is
                                kept, inactive) — hence "ban", not "trash". */}
                            <IconButton
                              icon="ban"
                              tone="danger"
                              size="sm"
                              label={t('unsubscribe', { email: sub.email })}
                              onClick={() => handleUnsubscribe(sub.email)}
                              loading={deleting === sub.email}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {data && data.total > data.limit && (
            <div className="adm-pagination">
              <Button
                variant="ghost"
                size="sm"
                icon="chevronBack"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                {tc('prev')}
              </Button>
              <span className="adm-text-muted adm-text-sm">
                {tc('pageOf', { page, total: lastPage })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                iconEnd="chevronForward"
                disabled={page >= lastPage}
                onClick={() => setPage(p => p + 1)}
              >
                {tc('next')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
