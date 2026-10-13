import React, { useMemo, useState } from 'react';
import { adminApi, type BlogPostItem, type BlogCategoryItem } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate, fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { resolveAdminImage } from '../../utils/image';
import { defineMessages, useAdminLang, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { Alert, Badge, Button, Card, EmptyState, IconButton, Loading, PageHeader, StatusBadge, Toolbar } from '../ui';

const messages = defineMessages({
  en: {
    title: 'Blog',
    postCount: { other: '{n} posts' },
    manageCategories: 'Manage categories',
    allStatuses: 'All statuses',
    filterPublished: 'Published',
    filterDrafts: 'Drafts',
    filterScheduled: 'Scheduled',
    filterFeatured: 'Featured',
    statusFilter: 'Filter by status',
    searchPlaceholder: 'Search title or tag…',
    addPost: 'Add post',
    colTitleAr: 'Title (AR)',
    colTitleEn: 'Title (EN)',
    colCategory: 'Category',
    colViews: 'Views',
    colReading: 'Reading',
    colDate: 'Date',
    featured: 'Featured',
    empty: 'No posts match the filter.',
    noPosts: 'No posts yet.',
    noPostsText: 'Published posts appear on the site\'s blog.',
    readingMinutes: { other: '{n} min' },
    publishes: 'Publishes: {at}',
    confirmDelete: 'Delete this blog post?',
    deleteFailed: 'Failed to delete post',
    editLabel: 'Edit post {name}',
    deleteLabel: 'Delete post {name}',
  },
  ar: {
    title: 'المدونة',
    postCount: {
      zero: 'لا توجد مقالات',
      one: 'مقال واحد',
      two: 'مقالان',
      few: '{n} مقالات',
      many: '{n} مقالًا',
      other: '{n} مقال',
    },
    manageCategories: 'إدارة الفئات',
    allStatuses: 'كل الحالات',
    filterPublished: 'المنشورة',
    filterDrafts: 'المسودات',
    filterScheduled: 'المجدولة',
    filterFeatured: 'المميّزة',
    statusFilter: 'التصفية حسب الحالة',
    searchPlaceholder: 'البحث بالعنوان أو الوسم…',
    addPost: 'إضافة مقال',
    colTitleAr: 'العنوان (AR)',
    colTitleEn: 'العنوان (EN)',
    colCategory: 'الفئة',
    colViews: 'المشاهدات',
    colReading: 'مدة القراءة',
    colDate: 'التاريخ',
    featured: 'مميّز',
    empty: 'لا توجد مقالات مطابقة للتصفية.',
    noPosts: 'لا توجد مقالات بعد.',
    noPostsText: 'تظهر المقالات المنشورة في مدونة الموقع.',
    readingMinutes: {
      one: 'دقيقة واحدة',
      two: 'دقيقتان',
      few: '{n} دقائق',
      many: '{n} دقيقة',
      other: '{n} دقيقة',
    },
    publishes: 'يُنشر في: {at}',
    confirmDelete: 'حذف هذا المقال؟',
    deleteFailed: 'تعذّر حذف المقال',
    editLabel: 'تعديل المقال {name}',
    deleteLabel: 'حذف المقال {name}',
  },
});

/**
 * /admin/blog — list view for blog posts.
 *
 * Mirrors AdminNews almost line-for-line: search bar, status filter,
 * Add button, table with thumbnail / title / category / status / date,
 * delete confirm. The only structural difference is the addition of a
 * "Categories" link that jumps to the category-management page.
 */

type StatusFilter = 'all' | 'published' | 'draft' | 'scheduled' | 'featured';

export const AdminBlog: React.FC = () => {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const t = useT(messages);
  const tc = useT(common);
  const { lang } = useAdminLang();

  const postsAsync = useAsync(() => adminApi.getBlogPosts(true), []);
  const catsAsync = useAsync(() => adminApi.getBlogCategories(), []);

  const categoriesById = useMemo(() => {
    const m = new Map<string, BlogCategoryItem>();
    for (const c of catsAsync.data?.items || []) m.set(c.id, c);
    return m;
  }, [catsAsync.data]);

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    setDeleting(id);
    setActionError('');
    try {
      await adminApi.deleteBlogPost(id);
      postsAsync.reload();
    } catch (e) {
      // Show the real reason (e.g. "session expired — sign in again").
      setActionError(e instanceof Error ? e.message : t('deleteFailed'));
    } finally {
      setDeleting(null);
    }
  };

  const items = postsAsync.data?.items ?? [];
  const filtering = statusFilter !== 'all' || Boolean(searchQuery.trim());
  const filtered = items.filter((item: BlogPostItem) => {
    if (statusFilter === 'featured' && !item.featured) return false;
    if (statusFilter !== 'all' && statusFilter !== 'featured' && item.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.title_en || '').toLowerCase().includes(q) ||
      (item.title_ar || '').includes(q) ||
      (item.tags || []).some((tag: string) => tag.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t.plural('postCount', items.length)}
        actions={(
          <>
            <Button to="/admin/blog/categories" icon="categories">{t('manageCategories')}</Button>
            <Button to="/admin/blog/new" variant="primary" icon="plus">{t('addPost')}</Button>
          </>
        )}
      />

      <Toolbar>
        <select
          className="adm-select adm-select-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label={t('statusFilter')}
        >
          <option value="all">{t('allStatuses')}</option>
          <option value="published">{t('filterPublished')}</option>
          <option value="draft">{t('filterDrafts')}</option>
          <option value="scheduled">{t('filterScheduled')}</option>
          <option value="featured">{t('filterFeatured')}</option>
        </select>
        <input
          type="search"
          className="adm-input adm-input-sm"
          placeholder={t('searchPlaceholder')}
          aria-label={tc('search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </Toolbar>

      {postsAsync.error && <Alert tone="danger">{postsAsync.error}</Alert>}
      {actionError && <Alert tone="danger">{actionError}</Alert>}

      {postsAsync.loading ? <Loading label={tc('loading')} /> : (
        <Card flush>
          {filtered.length === 0 ? (
            filtering
              ? <EmptyState icon="search" title={t('empty')} compact />
              : (
                <EmptyState
                  icon="blog"
                  title={t('noPosts')}
                  text={t('noPostsText')}
                  action={<Button to="/admin/blog/new" variant="primary" icon="plus" size="sm">{t('addPost')}</Button>}
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
                    <th>{tc('status')}</th>
                    <th>{t('colViews')}</th>
                    <th>{t('colReading')}</th>
                    <th>{t('colDate')}</th>
                    <th className="adm-col-actions"><span className="adm-sr-only">{tc('actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const cat = item.category_id ? categoriesById.get(item.category_id) : null;
                    const name = item.title_en || item.title_ar || item.slug;
                    // Delete only sets active=0 (drafts are active=0 too). A
                    // deleted post kept showing "Live", so it looked as if
                    // Delete had done nothing — and re-saving it from the
                    // editor quietly republished it.
                    const isDeleted = !item.active && item.status !== 'draft';
                    return (
                      <tr key={item.id}>
                        <td>
                          {item.image ? (
                            <img src={resolveAdminImage(item.image)} alt="" className="adm-thumb" />
                          ) : <span className="adm-text-muted">—</span>}
                        </td>
                        <td dir="rtl" className="adm-truncate" style={{ maxWidth: 190 }}>{item.title_ar || '—'}</td>
                        <td className="adm-truncate adm-cell-ltr" style={{ maxWidth: 190 }}>{item.title_en || '—'}</td>
                        <td>
                          {cat ? (
                            <Badge tone="neutral">
                              {/* The category's own colour (set on the categories page). */}
                              {cat.color && (
                                <span className="adm-dot" style={{ background: cat.color, marginInlineEnd: 6 }} aria-hidden="true" />
                              )}
                              <bdi>{lang === 'ar' ? cat.name_ar || cat.name_en : cat.name_en || cat.name_ar}</bdi>
                            </Badge>
                          ) : <span className="adm-text-muted">—</span>}
                        </td>
                        <td>
                          <div className="adm-flex" style={{ gap: 4, flexWrap: 'wrap' }}>
                            {isDeleted ? (
                              <StatusBadge status="deleted" />
                            ) : item.status === 'scheduled' ? (
                              <StatusBadge
                                status="scheduled"
                                title={item.publish_at ? t('publishes', { at: fmtDateTime(item.publish_at) }) : undefined}
                              />
                            ) : item.status === 'published' ? (
                              <StatusBadge status="published" />
                            ) : (
                              <StatusBadge status="draft" />
                            )}
                            {Boolean(item.featured) && <Badge tone="warning" icon="star">{t('featured')}</Badge>}
                          </div>
                        </td>
                        <td>{fmtNumber(item.view_count)}</td>
                        <td className="adm-text-sm adm-text-muted">{t.plural('readingMinutes', item.reading_time)}</td>
                        <td className="adm-cell-date">{fmtDate(item.published_at)}</td>
                        <td className="adm-col-actions">
                          <div className="adm-row-actions">
                            <IconButton
                              icon="edit"
                              size="sm"
                              label={t('editLabel', { name })}
                              to={`/admin/blog/${encodeURIComponent(item.id)}`}
                            />
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
