import React, { useState } from 'react';
import { adminApi, type AuditLogEntry } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDateTime } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

/**
 * Admin audit log viewer.
 *
 * Renders a paginated, filterable table of every CREATE / UPDATE /
 * DELETE / SEND / EXPORT operation performed by any admin. The page
 * supports three orthogonal filters (entity type, action, free-text)
 * plus a date-range pair, and a one-click CSV export that streams the
 * filtered set straight from the API — no in-memory accumulation
 * needed for a compliance-grade dump.
 *
 * UX rationale: the previous version exposed only the entity filter,
 * which forced compliance reviewers to scroll through hundreds of rows
 * to find a specific deletion. The free-text box matches on
 * entity_name + entity_id + details, so a query like "newsletter" or
 * "diox-floor" jumps directly to the rows that matter.
 */

const messages = defineMessages({
  en: {
    title: 'Audit Log',
    subtitle: { other: 'All admin create / update / delete / send / export operations — {n} matching entries' },
    resetFilters: 'Reset filters',
    entity: 'Entity',
    allEntities: 'All entities',
    action: 'Action',
    allActions: 'All actions',
    searchLabel: 'Search (name / id / details)',
    searchPlaceholder: 'e.g. floor cleaner or diox-…',
    from: 'From',
    to: 'To',
    colAction: 'Action',
    colEntity: 'Entity',
    colNameId: 'Name / ID',
    colAdmin: 'Admin',
    colDetails: 'Details',
    colTime: 'Time',
    noEntries: 'No log entries matching the current filters.',
    idLabel: 'ID:',
    pageSlash: 'Page {page} / {total}',
    // Filter dropdown
    actionOption_CREATE: 'Create',
    actionOption_UPDATE: 'Update',
    actionOption_DELETE: 'Delete',
    actionOption_SEND: 'Send',
    actionOption_EXPORT: 'Export',
    actionOption_IMPORT: 'Import',
    actionOption_REORDER: 'Reorder',
    actionOption_QUEUE: 'Queue send',
    // Table badge
    actionBadge_CREATE: 'CREATE',
    actionBadge_UPDATE: 'UPDATE',
    actionBadge_DELETE: 'DELETE',
    actionBadge_SEND: 'SEND',
    actionBadge_EXPORT: 'EXPORT',
    actionBadge_IMPORT: 'IMPORT',
    actionBadge_REORDER: 'REORDER',
    actionBadge_QUEUE: 'QUEUE',
    // One row's entity
    entity_product: 'Product',
    entity_category: 'Category',
    entity_news: 'News',
    entity_blog_post: 'Blog post',
    entity_blog_category: 'Blog category',
    entity_campaign: 'Campaign',
    entity_newsletter: 'Newsletter',
    entity_chat: 'Chat',
    entity_ai_qa: 'AI Q&A',
    entity_ab_test: 'A/B test',
    entity_ab_variant: 'A/B variant',
    entity_audit_log: 'Audit Log',
    // Filter dropdown
    entityFilter_product: 'Products',
    entityFilter_category: 'Categories',
    entityFilter_news: 'News',
    entityFilter_blog_post: 'Blog posts',
    entityFilter_blog_category: 'Blog categories',
    entityFilter_campaign: 'Campaigns',
    entityFilter_newsletter: 'Newsletter',
    entityFilter_chat: 'Chats',
    entityFilter_ai_qa: 'AI Q&A',
    entityFilter_ab_test: 'A/B tests',
    entityFilter_ab_variant: 'A/B variants',
    entityFilter_audit_log: 'Audit log',
  },
  ar: {
    title: 'سجل العمليات',
    subtitle: {
      zero: 'كل عمليات الإنشاء والتعديل والحذف والإرسال والتصدير التي نفّذها المشرفون — لا توجد سجلات مطابقة',
      one: 'كل عمليات الإنشاء والتعديل والحذف والإرسال والتصدير التي نفّذها المشرفون — سجل واحد مطابق',
      two: 'كل عمليات الإنشاء والتعديل والحذف والإرسال والتصدير التي نفّذها المشرفون — سجلان مطابقان',
      few: 'كل عمليات الإنشاء والتعديل والحذف والإرسال والتصدير التي نفّذها المشرفون — {n} سجلات مطابقة',
      many: 'كل عمليات الإنشاء والتعديل والحذف والإرسال والتصدير التي نفّذها المشرفون — {n} سجلًا مطابقًا',
      other: 'كل عمليات الإنشاء والتعديل والحذف والإرسال والتصدير التي نفّذها المشرفون — {n} سجل مطابق',
    },
    resetFilters: 'إعادة ضبط عوامل التصفية',
    entity: 'النوع',
    allEntities: 'كل الأنواع',
    action: 'العملية',
    allActions: 'كل العمليات',
    searchLabel: 'بحث (الاسم / المعرّف / التفاصيل)',
    searchPlaceholder: 'مثال: منظف الأرضيات أو diox-…',
    from: 'من',
    to: 'إلى',
    colAction: 'العملية',
    colEntity: 'النوع',
    colNameId: 'الاسم / المعرّف',
    colAdmin: 'المشرف',
    colDetails: 'التفاصيل',
    colTime: 'الوقت',
    noEntries: 'لا توجد سجلات تطابق عوامل التصفية الحالية.',
    idLabel: 'المعرّف:',
    pageSlash: 'صفحة {page} من {total}',
    actionOption_CREATE: 'إنشاء',
    actionOption_UPDATE: 'تعديل',
    actionOption_DELETE: 'حذف',
    actionOption_SEND: 'إرسال',
    actionOption_EXPORT: 'تصدير',
    actionOption_IMPORT: 'استيراد',
    actionOption_REORDER: 'إعادة ترتيب',
    actionOption_QUEUE: 'إرسال حملة',
    actionBadge_CREATE: 'إنشاء',
    actionBadge_UPDATE: 'تعديل',
    actionBadge_DELETE: 'حذف',
    actionBadge_SEND: 'إرسال',
    actionBadge_EXPORT: 'تصدير',
    actionBadge_IMPORT: 'استيراد',
    actionBadge_REORDER: 'إعادة ترتيب',
    actionBadge_QUEUE: 'إرسال حملة',
    entity_product: 'منتج',
    entity_category: 'فئة',
    entity_news: 'خبر',
    entity_blog_post: 'مقال',
    entity_blog_category: 'فئة المدونة',
    entity_campaign: 'حملة بريدية',
    entity_newsletter: 'النشرة البريدية',
    entity_chat: 'محادثة',
    entity_ai_qa: 'سؤال وجواب للمساعد',
    entity_ab_test: 'تجربة A/B',
    entity_ab_variant: 'نسخة A/B',
    entity_audit_log: 'سجل العمليات',
    entityFilter_product: 'المنتجات',
    entityFilter_category: 'الفئات',
    entityFilter_news: 'الأخبار',
    entityFilter_blog_post: 'مقالات المدونة',
    entityFilter_blog_category: 'فئات المدونة',
    entityFilter_campaign: 'الحملات البريدية',
    entityFilter_newsletter: 'النشرة البريدية',
    entityFilter_chat: 'المحادثات',
    entityFilter_ai_qa: 'أسئلة وأجوبة المساعد',
    entityFilter_ab_test: 'اختبارات A/B',
    entityFilter_ab_variant: 'نسخ A/B',
    entityFilter_audit_log: 'سجل العمليات',
  },
});

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'SEND', 'QUEUE', 'EXPORT', 'IMPORT', 'REORDER'] as const;
type Action = typeof ACTIONS[number];
const isAction = (value: string): value is Action => (ACTIONS as readonly string[]).includes(value);

const ACTION_COLOR: Record<string, string> = {
  CREATE: '#22c55e',
  UPDATE: '#4f6ef7',
  DELETE: '#ef4444',
  SEND:   '#f59e0b',
  EXPORT: '#06b6d4',
  IMPORT: '#0ea5e9',
  REORDER: '#a855f7',
};

const ACTION_ICON: Record<string, string> = {
  CREATE: '➕',
  UPDATE: '✏️',
  DELETE: '🗑️',
  SEND:   '📧',
  EXPORT: '⬇️',
  IMPORT: '📥',
  REORDER: '↕️',
};

// Keys are the entityType strings the server passes to logAudit — keep
// in step with `grep -rn "entityType:" server/`. Types missing here showed
// as raw ids and couldn't be filtered on. Labels: entity_* / entityFilter_*
// in the messages above; the filter dropdown follows this order.
const ENTITY_ICON = {
  product:       '🧴',
  category:      '🗂️',
  news:          '📰',
  blog_post:     '📝',
  blog_category: '🏷️',
  campaign:      '📧',
  newsletter:    '✉️',
  chat:          '💬',
  ai_qa:         '🤖',
  ab_test:       '🧪',
  ab_variant:    '🔀',
  audit_log:     '🔍',
} as const;
type EntityType = keyof typeof ENTITY_ICON;
const ENTITY_TYPES = Object.keys(ENTITY_ICON) as EntityType[];
const isEntityType = (value: string): value is EntityType => Object.prototype.hasOwnProperty.call(ENTITY_ICON, value);

const PAGE_SIZE = 50;

export const AdminAuditLog: React.FC = () => {
  const t = useT(messages);
  const tc = useT(common);
  const [page, setPage] = useState(0);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  // The text box is debounced via a separate "applied" state so every
  // keystroke doesn't fire a new request — saves the server from
  // burst-load when an admin types a long product slug.
  const [searchInput, setSearchInput] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, loading, error } = useAsync(
    () => adminApi.getAuditLog({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      entity: entityFilter || undefined,
      action: actionFilter || undefined,
      q: searchApplied || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    }),
    [page, entityFilter, actionFilter, searchApplied, fromDate, toDate],
  );

  const logs: AuditLogEntry[] = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  /**
   * Reset every filter at once. Cheaper than five sequential `setState`
   * calls and gives the admin a single "show me everything" escape hatch.
   */
  const resetFilters = () => {
    setEntityFilter('');
    setActionFilter('');
    setSearchInput('');
    setSearchApplied('');
    setFromDate('');
    setToDate('');
    setPage(0);
  };

  const exportUrl = adminApi.auditLogExportUrl({
    entity: entityFilter || undefined,
    action: actionFilter || undefined,
    q: searchApplied || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
  });

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{t('title')}</h1>
          <p className="adm-page-subtitle">
            {t.plural('subtitle', total)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <a
            href={exportUrl}
            className="adm-btn adm-btn-ghost adm-btn-sm"
            // download attribute provides a sensible default filename
            // even on browsers that don't follow Content-Disposition
            // strictly (rare but Safari historically lagged).
            download
            target="_self"
            rel="noopener"
          >
            ⬇️ {tc('exportCsv')}
          </a>
          <button
            type="button"
            className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={resetFilters}
            disabled={
              !entityFilter && !actionFilter && !searchApplied && !fromDate && !toDate
            }
          >
            {t('resetFilters')}
          </button>
        </div>
      </div>

      {/* Filter bar — five controls laid out in a flex-wrap row so it
          collapses cleanly on narrow viewports without a media query. */}
      <div
        className="adm-card"
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          marginBottom: 16,
          padding: 12,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>{t('entity')}</span>
          <select
            className="adm-select adm-input-sm"
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(0); }}
          >
            <option value="">{t('allEntities')}</option>
            {ENTITY_TYPES.map((type) => <option key={type} value={type}>{t(`entityFilter_${type}`)}</option>)}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>{t('action')}</span>
          <select
            className="adm-select adm-input-sm"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
          >
            <option value="">{t('allActions')}</option>
            {ACTIONS.map((action) => <option key={action} value={action}>{t(`actionOption_${action}`)}</option>)}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 220px', minWidth: 220 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>{t('searchLabel')}</span>
          <form
            onSubmit={(e) => { e.preventDefault(); setSearchApplied(searchInput.trim()); setPage(0); }}
            style={{ display: 'flex', gap: 4 }}
          >
            <input
              type="search"
              className="adm-input adm-input-sm"
              placeholder={t('searchPlaceholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="adm-btn adm-btn-primary adm-btn-sm">{tc('search')}</button>
          </form>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>{t('from')}</span>
          <input
            type="date"
            className="adm-input adm-input-sm"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
            style={{ width: 150 }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>{t('to')}</span>
          <input
            type="date"
            className="adm-input adm-input-sm"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => { setToDate(e.target.value); setPage(0); }}
            style={{ width: 150 }}
          />
        </label>
      </div>

      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> {tc('loading')}</div>}
      {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

      {!loading && (
        <>
          <div className="adm-card" style={{ padding: 0 }}>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>{t('colAction')}</th>
                    <th style={{ width: 130 }}>{t('colEntity')}</th>
                    <th>{t('colNameId')}</th>
                    <th style={{ width: 100 }}>{t('colAdmin')}</th>
                    <th>{t('colDetails')}</th>
                    <th style={{ width: 160 }}>{t('colTime')}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>
                        {t('noEntries')}
                      </td>
                    </tr>
                  ) : logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                          color: ACTION_COLOR[log.action] ?? 'var(--adm-text)',
                        }}>
                          {ACTION_ICON[log.action] ?? '•'} {isAction(log.action) ? t(`actionBadge_${log.action}`) : log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>
                        {isEntityType(log.entity_type)
                          ? `${ENTITY_ICON[log.entity_type]} ${t(`entity_${log.entity_type}`)}`
                          : log.entity_type}
                      </td>
                      <td>
                        {/* dir="auto": Arabic product / article names otherwise
                            reorder their punctuation in this LTR table. */}
                        <div dir="auto" style={{ fontWeight: 600, fontSize: 13 }}>{log.entity_name || '—'}</div>
                        {log.entity_id && (
                          <div style={{ fontSize: 11, color: 'var(--adm-text-dim)', marginTop: 1 }}>
                            {t('idLabel')} <bdi dir="ltr">{log.entity_id}</bdi>
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{log.admin_user}</td>
                      <td dir="auto" style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>{log.details || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--adm-text-dim)', whiteSpace: 'nowrap' }}>
                        {/* created_at is UTC 'YYYY-MM-DD HH:MM:SS'; new Date() read it
                            as local time, 3 h off in Istanbul. */}
                        {fmtDateTime(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
              <button
                className="adm-btn adm-btn-ghost adm-btn-sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                {tc('prev')}
              </button>
              <span style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>
                {t('pageSlash', { page: page + 1, total: totalPages })}
              </span>
              <button
                className="adm-btn adm-btn-ghost adm-btn-sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                {tc('next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
