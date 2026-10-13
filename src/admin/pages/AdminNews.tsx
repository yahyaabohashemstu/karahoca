import React, { useState } from 'react';
import { adminApi, type NewsItem } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate, fmtDateTime } from '../utils/dateUtils';
import { resolveAdminImage } from '../../utils/image';
import { defineMessages, useAdminLang, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { Alert, Button, Card, EmptyState, IconButton, Loading, PageHeader, StatusBadge, Toolbar } from '../ui';

const messages = defineMessages({
  en: {
    title: 'News',
    subtitle: { other: 'Manage news articles — {n} total' },
    searchPlaceholder: 'Search by title or category…',
    addArticle: 'Add article',
    colTitleAr: 'Title (AR)',
    colTitleEn: 'Title (EN)',
    colCategory: 'Category',
    colDate: 'Date',
    empty: 'No articles yet.',
    emptyText: 'Published articles appear on the site\'s news page.',
    noMatch: 'No article matches this search.',
    publishes: 'Publishes: {at}',
    confirmDelete: 'Delete this news article?',
    deleteFailed: 'Failed to delete article',
    deleteLabel: 'Delete article {name}',
    editLabel: 'Edit article {name}',
  },
  ar: {
    title: 'الأخبار',
    subtitle: {
      zero: 'إدارة الأخبار — لا توجد أخبار',
      one: 'إدارة الأخبار — خبر واحد',
      two: 'إدارة الأخبار — خبران',
      few: 'إدارة الأخبار — {n} أخبار',
      many: 'إدارة الأخبار — {n} خبرًا',
      other: 'إدارة الأخبار — {n} خبر',
    },
    searchPlaceholder: 'البحث بالعنوان أو الفئة…',
    addArticle: 'إضافة خبر',
    colTitleAr: 'العنوان (AR)',
    colTitleEn: 'العنوان (EN)',
    colCategory: 'الفئة',
    colDate: 'التاريخ',
    empty: 'لا توجد أخبار بعد.',
    emptyText: 'تظهر الأخبار المنشورة في صفحة الأخبار على الموقع.',
    noMatch: 'لا يوجد خبر يطابق هذا البحث.',
    publishes: 'يُنشر في: {at}',
    confirmDelete: 'حذف هذا الخبر؟',
    deleteFailed: 'تعذّر حذف الخبر',
    deleteLabel: 'حذف الخبر {name}',
    editLabel: 'تعديل الخبر {name}',
  },
});

export const AdminNews: React.FC = () => {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { data, loading, error, reload } = useAsync(() => adminApi.getNews(true), []);
  const t = useT(messages);
  const tc = useT(common);
  const { lang } = useAdminLang();

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    setDeleting(id);
    setActionError('');
    try {
      await adminApi.deleteNews(id);
      reload();
    } catch (e) {
      // Show the real reason (e.g. "session expired — sign in again").
      setActionError(e instanceof Error ? e.message : t('deleteFailed'));
    } finally {
      setDeleting(null);
    }
  };

  const items = data?.items ?? [];
  const filtered = items.filter((item: NewsItem) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.title_en || '').toLowerCase().includes(q) ||
      (item.title_ar || '').includes(q) ||
      (item.category_en || '').toLowerCase().includes(q) ||
      (item.category_ar || '').includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t.plural('subtitle', items.length)}
        actions={<Button to="/admin/news/new" variant="primary" icon="plus">{t('addArticle')}</Button>}
      />

      <Toolbar>
        <input
          type="search"
          className="adm-input adm-input-sm"
          placeholder={t('searchPlaceholder')}
          aria-label={tc('search')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </Toolbar>

      {error && <Alert tone="danger">{error}</Alert>}
      {actionError && <Alert tone="danger">{actionError}</Alert>}

      {loading ? <Loading label={tc('loading')} /> : (
        <Card flush>
          {filtered.length === 0 ? (
            searchQuery.trim()
              ? <EmptyState icon="search" title={t('noMatch')} compact />
              : (
                <EmptyState
                  icon="news"
                  title={t('empty')}
                  text={t('emptyText')}
                  action={<Button to="/admin/news/new" variant="primary" icon="plus" size="sm">{t('addArticle')}</Button>}
                />
              )
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>{tc('image')}</th>
                    <th>{t('colTitleAr')}</th>
                    <th>{t('colTitleEn')}</th>
                    <th>{t('colCategory')}</th>
                    <th>{t('colDate')}</th>
                    <th>{tc('status')}</th>
                    <th className="adm-col-actions"><span className="adm-sr-only">{tc('actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item: NewsItem) => {
                    const name = item.title_en || item.title_ar || item.slug;
                    return (
                      <tr key={item.id}>
                        <td>
                          {item.image ? (
                            <img
                              src={resolveAdminImage(item.image)}
                              alt={item.title_en}
                              className="adm-thumb"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : <span className="adm-text-muted">—</span>}
                        </td>
                        <td dir="rtl" className="adm-truncate" style={{ maxWidth: 200 }}>{item.title_ar}</td>
                        <td className="adm-truncate adm-cell-ltr" style={{ maxWidth: 220 }}>{item.title_en}</td>
                        <td dir="auto" className="adm-text-sm adm-text-muted">
                          {(lang === 'ar' ? item.category_ar || item.category_en : item.category_en || item.category_ar) || '—'}
                        </td>
                        <td className="adm-cell-date">{fmtDate(item.published_at)}</td>
                        <td>
                          {/* Delete only sets active=0 (drafts are active=0 too), so a
                              deleted article used to show its old status — "Hidden"
                              at best, "Scheduled" for a deleted scheduled one. Same
                              rule as the blog list. */}
                          {!item.active && item.status !== 'draft' ? (
                            <StatusBadge status="deleted" />
                          ) : item.status === 'scheduled' ? (
                            <StatusBadge
                              status="scheduled"
                              title={item.publish_at ? t('publishes', { at: fmtDateTime(item.publish_at) }) : undefined}
                            />
                          ) : item.status === 'draft' ? (
                            <StatusBadge status="draft" />
                          ) : (
                            <StatusBadge status="published" />
                          )}
                        </td>
                        <td className="adm-col-actions">
                          <div className="adm-row-actions">
                            <IconButton icon="edit" label={t('editLabel', { name })} size="sm" to={`/admin/news/${item.id}`} />
                            <IconButton
                              icon="trash"
                              tone="danger"
                              size="sm"
                              label={t('deleteLabel', { name })}
                              onClick={() => handleDelete(item.id)}
                              loading={deleting === item.id}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
