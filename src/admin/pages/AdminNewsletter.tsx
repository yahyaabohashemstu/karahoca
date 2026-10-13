import React, { useEffect, useState } from 'react';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

const messages = defineMessages({
  en: {
    title: 'Newsletter Subscribers',
    activeSubscribers: { one: '{n} active subscriber', other: '{n} active subscribers' },
    countUnavailable: 'Subscriber count unavailable',
    exporting: 'Exporting…',
    languageFilter: 'Language:',
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
    colSubscribedAt: 'Subscribed At',
    noSubscribersLang: 'No subscribers with this language.',
    noSubscribers: 'No subscribers yet.',
    languageFor: 'Language for {email}',
    unsubscribe: 'Unsubscribe',
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
    languageFilter: 'اللغة:',
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
    unsubscribe: 'إلغاء الاشتراك',
  },
});

// Campaigns reach each subscriber in this language (or the closest one
// written). Older subscribers signed up before it was recorded.
const LANG_OPTIONS = ['ar', 'en', 'tr', 'ru'] as const;
const FILTERS = ['', ...LANG_OPTIONS, 'unknown'] as const;

export const AdminNewsletter: React.FC = () => {
  const [page, setPage] = useState(1);
  const [langFilter, setLangFilter] = useState('');
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

  const filterLabel = (value: (typeof FILTERS)[number]) =>
    value === '' ? tc('all') : tc(`lang_${value}`);

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

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{t('title')}</h1>
          <p className="adm-page-subtitle">
            {allCount !== undefined
              ? t.plural('activeSubscribers', allCount)
              : error ? t('countUnavailable') : tc('loading')}
          </p>
        </div>
        <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={handleExport} disabled={exporting}>
          {exporting ? t('exporting') : `⬇ ${tc('exportCsv')}`}
        </button>
      </div>

      <div className="adm-card adm-newsletter-filters">
        <span className="adm-text-muted adm-text-sm">{t('languageFilter')}</span>
        {FILTERS.map((value) => {
          const n = value === '' ? allCount : counts?.[value];
          return (
            <button
              key={value || 'all'}
              type="button"
              className={`adm-btn adm-btn-sm ${langFilter === value ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
              onClick={() => { setLangFilter(value); setPage(1); }}
              aria-pressed={langFilter === value}
            >
              {filterLabel(value)}{n !== undefined ? ` (${fmtNumber(n)})` : ''}
            </button>
          );
        })}
        {!!counts?.unknown && (
          <p className="adm-newsletter-hint">
            {t.plural('unknownHint', counts.unknown)}
          </p>
        )}
      </div>

      {actionError && <div className="adm-alert adm-alert-error" role="alert">⚠ {actionError}</div>}
      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> {tc('loading')}</div>}
      {error && (
        <div className="adm-alert adm-alert-error" role="alert">
          ⚠ {t('loadFailed', { error })}{' '}
          <button type="button" className="adm-btn adm-btn-sm" onClick={() => reload()}>{tc('retry')}</button>
        </div>
      )}

      {/* On an error the table would say "No subscribers yet", which is not
          what the admin should conclude. */}
      {!loading && !error && (
        <>
          <div className="adm-card" style={{ padding: 0 }}>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>{t('colEmail')}</th>
                    <th>{tc('language')}</th>
                    <th>{t('colSubscribedAt')}</th>
                    <th><span className="adm-sr-only">{tc('actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>
                      {langFilter ? t('noSubscribersLang') : t('noSubscribers')}
                    </td></tr>
                  ) : subscribers.map(sub => (
                    <tr key={sub.email}>
                      <td className="adm-mono">{sub.email}</td>
                      <td>
                        <select
                          className="adm-input adm-select adm-select-sm"
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
                      <td>
                        <button
                          className="adm-btn adm-btn-danger adm-btn-sm"
                          onClick={() => handleUnsubscribe(sub.email)}
                          disabled={deleting === sub.email}
                        >
                          {deleting === sub.email ? '…' : t('unsubscribe')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data && data.total > data.limit && (
            <div className="adm-pagination">
              <button
                className="adm-btn adm-btn-ghost adm-btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >{tc('prev')}</button>
              <span className="adm-text-muted adm-text-sm">
                {tc('pageOf', { page, total: lastPage })}
              </span>
              <button
                className="adm-btn adm-btn-ghost adm-btn-sm"
                disabled={page >= lastPage}
                onClick={() => setPage(p => p + 1)}
              >{tc('next')}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
