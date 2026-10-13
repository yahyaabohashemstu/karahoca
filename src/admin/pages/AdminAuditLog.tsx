import React, { useState } from 'react';
import { adminApi, type AuditLogEntry } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDateTime } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { AdminIcon, Alert, Badge, Button, Card, EmptyState, Loading, PageHeader, Toolbar, type IconName, type Tone } from '../ui';

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
    title: 'Audit log',
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
    entity_audit_log: 'Audit log',
    entity_site: 'Website',
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
    entityFilter_site: 'Website',
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
    entity_site: 'الموقع',
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
    entityFilter_site: 'الموقع',
  },
});

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'SEND', 'QUEUE', 'EXPORT', 'IMPORT', 'REORDER'] as const;
type Action = typeof ACTIONS[number];
const isAction = (value: string): value is Action => (ACTIONS as readonly string[]).includes(value);

// One tone + icon per action, the same as the matching buttons elsewhere
// (Add = plus, Edit = edit, Delete = trash, Send = send…).
const ACTION_LOOK: Record<Action, { tone: Tone; icon: IconName }> = {
  CREATE: { tone: 'success', icon: 'plus' },
  UPDATE: { tone: 'info', icon: 'edit' },
  DELETE: { tone: 'danger', icon: 'trash' },
  SEND: { tone: 'accent', icon: 'send' },
  QUEUE: { tone: 'accent', icon: 'send' },
  EXPORT: { tone: 'neutral', icon: 'download' },
  IMPORT: { tone: 'neutral', icon: 'upload' },
  REORDER: { tone: 'neutral', icon: 'sort' },
};

// Keys are the entityType strings the server passes to logAudit — keep
// in step with `grep -rn "entityType:" server/`. Types missing here showed
// as raw ids and couldn't be filtered on. Labels: entity_* / entityFilter_*
// in the messages above; the filter dropdown follows this order. Icons
// match the sidebar's.
const ENTITY_ICON = {
  product:       'products',
  category:      'categories',
  news:          'news',
  blog_post:     'blog',
  blog_category: 'categories',
  campaign:      'campaigns',
  newsletter:    'newsletter',
  chat:          'chats',
  ai_qa:         'ai',
  ab_test:       'abtest',
  ab_variant:    'abtest',
  audit_log:     'audit',
  site:          'language',
} as const satisfies Record<string, IconName>;
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
  const filtered = Boolean(entityFilter || actionFilter || searchApplied || fromDate || toDate);

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
      <PageHeader
        title={t('title')}
        subtitle={t.plural('subtitle', total)}
        actions={(
          <Button
            href={exportUrl}
            icon="download"
            // download attribute provides a sensible default filename
            // even on browsers that don't follow Content-Disposition
            // strictly (rare but Safari historically lagged).
            download
            target="_self"
            rel="noopener"
          >
            {tc('exportCsv')}
          </Button>
        )}
      />

      {/* Filters wrap onto more lines on narrow viewports by themselves. */}
      <Toolbar
        end={(
          <Button variant="ghost" size="sm" icon="close" onClick={resetFilters} disabled={!filtered}>
            {t('resetFilters')}
          </Button>
        )}
      >
        <select
          className="adm-select adm-select-sm adm-select-narrow"
          aria-label={t('entity')}
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(0); }}
        >
          <option value="">{t('allEntities')}</option>
          {ENTITY_TYPES.map((type) => <option key={type} value={type}>{t(`entityFilter_${type}`)}</option>)}
        </select>

        <select
          className="adm-select adm-select-sm adm-select-narrow"
          aria-label={t('action')}
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
        >
          <option value="">{t('allActions')}</option>
          {ACTIONS.map((action) => <option key={action} value={action}>{t(`actionOption_${action}`)}</option>)}
        </select>

        <form
          className="adm-flex"
          role="search"
          onSubmit={(e) => { e.preventDefault(); setSearchApplied(searchInput.trim()); setPage(0); }}
        >
          <input
            type="search"
            className="adm-input adm-input-sm"
            aria-label={t('searchLabel')}
            placeholder={t('searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ minWidth: 200 }}
          />
          <Button type="submit" size="sm" icon="search">{tc('search')}</Button>
        </form>

        {/* The range wraps as one piece. */}
        <div className="adm-flex">
          <label className="adm-flex">
            <span className="adm-toolbar-label">{t('from')}</span>
            <input
              type="date"
              className="adm-input adm-input-sm adm-input-narrow"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
            />
          </label>

          <label className="adm-flex">
            <span className="adm-toolbar-label">{t('to')}</span>
            <input
              type="date"
              className="adm-input adm-input-sm adm-input-narrow"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => { setToDate(e.target.value); setPage(0); }}
            />
          </label>
        </div>
      </Toolbar>

      {loading && <Loading label={tc('loading')} />}
      {error && <Alert tone="danger">{error}</Alert>}

      {/* On an error the table would say "no entries match", which is not
          what the admin should conclude. */}
      {!loading && !error && (
        <>
          <Card flush>
            {logs.length === 0 ? (
              <EmptyState icon={filtered ? 'search' : 'audit'} title={t('noEntries')} compact />
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 120 }}>{t('colAction')}</th>
                      <th style={{ width: 150 }}>{t('colEntity')}</th>
                      <th>{t('colNameId')}</th>
                      <th style={{ width: 100 }}>{t('colAdmin')}</th>
                      <th>{t('colDetails')}</th>
                      <th style={{ width: 160 }}>{t('colTime')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          {isAction(log.action) ? (
                            <Badge tone={ACTION_LOOK[log.action].tone} icon={ACTION_LOOK[log.action].icon}>
                              {t(`actionBadge_${log.action}`)}
                            </Badge>
                          ) : (
                            <Badge>{log.action}</Badge>
                          )}
                        </td>
                        <td className="adm-text-sm adm-text-muted">
                          {isEntityType(log.entity_type) ? (
                            <span className="adm-flex">
                              <AdminIcon name={ENTITY_ICON[log.entity_type]} size="sm" />
                              {t(`entity_${log.entity_type}`)}
                            </span>
                          ) : log.entity_type}
                        </td>
                        <td>
                          {/* dir="auto": Arabic product / article names otherwise
                              reorder their punctuation in this LTR table. */}
                          <div dir="auto"><strong>{log.entity_name || '—'}</strong></div>
                          {log.entity_id && (
                            <div className="adm-text-sm adm-text-muted">
                              {t('idLabel')} <bdi dir="ltr">{log.entity_id}</bdi>
                            </div>
                          )}
                        </td>
                        <td className="adm-text-sm">{log.admin_user}</td>
                        <td dir="auto" className="adm-text-sm adm-text-muted">{log.details || '—'}</td>
                        <td className="adm-text-sm adm-text-muted" style={{ whiteSpace: 'nowrap' }}>
                          {/* created_at is UTC 'YYYY-MM-DD HH:MM:SS'; new Date() read it
                              as local time, 3 h off in Istanbul. */}
                          {fmtDateTime(log.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {totalPages > 1 && (
            <div className="adm-pagination">
              <Button
                variant="ghost"
                size="sm"
                icon="chevronBack"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                {tc('prev')}
              </Button>
              <span className="adm-text-muted adm-text-sm">
                {tc('pageOf', { page: page + 1, total: totalPages })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                iconEnd="chevronForward"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
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
