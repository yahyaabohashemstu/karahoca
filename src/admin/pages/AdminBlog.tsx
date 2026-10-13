import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type BlogPostItem, type BlogCategoryItem } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate, fmtNumber } from '../utils/dateUtils';
import { resolveAdminImage } from '../../utils/image';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

const messages = defineMessages({
  en: {
    title: 'Blog',
    postCount: { other: '{n} posts' },
    manageCategories: 'Manage categories →',
    allStatuses: 'All statuses',
    filterPublished: '✅ Published',
    filterDrafts: '📝 Drafts',
    filterScheduled: '🕐 Scheduled',
    filterFeatured: '⭐ Featured',
    searchPlaceholder: 'Search title or tag…',
    addPost: '+ Add Post',
    colTitleAr: 'Title (AR)',
    colTitleEn: 'Title (EN)',
    colCategory: 'Category',
    colViews: 'Views',
    colReading: 'Reading',
    colDate: 'Date',
    empty: 'No posts match the filter.',
    readingMinutes: { other: '{n} min' },
    confirmDelete: 'Delete this blog post?',
    deleteFailed: 'Failed to delete post',
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
    manageCategories: 'إدارة الفئات ←',
    allStatuses: 'كل الحالات',
    filterPublished: '✅ المنشورة',
    filterDrafts: '📝 المسودات',
    filterScheduled: '🕐 المجدولة',
    filterFeatured: '⭐ المميّزة',
    searchPlaceholder: 'البحث بالعنوان أو الوسم…',
    addPost: '+ إضافة مقال',
    colTitleAr: 'العنوان (AR)',
    colTitleEn: 'العنوان (EN)',
    colCategory: 'الفئة',
    colViews: 'المشاهدات',
    colReading: 'مدة القراءة',
    colDate: 'التاريخ',
    empty: 'لا توجد مقالات مطابقة للتصفية.',
    readingMinutes: {
      one: 'دقيقة واحدة',
      two: 'دقيقتان',
      few: '{n} دقائق',
      many: '{n} دقيقة',
      other: '{n} دقيقة',
    },
    confirmDelete: 'حذف هذا المقال؟',
    deleteFailed: 'تعذّر حذف المقال',
  },
});

/**
 * /admin/blog — list view for blog posts.
 *
 * Mirrors AdminNews almost line-for-line: search bar, status filter,
 * +Add button, table with thumbnail / title / category / status / date,
 * delete confirm. The only structural difference is the addition of a
 * "Categories" sub-link that jumps to the category-management page.
 */

type StatusFilter = 'all' | 'published' | 'draft' | 'scheduled' | 'featured';

export const AdminBlog: React.FC = () => {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const t = useT(messages);
  const tc = useT(common);

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
    try {
      await adminApi.deleteBlogPost(id);
      postsAsync.reload();
    } catch (e) {
      // Show the real reason (e.g. "session expired — sign in again").
      alert(e instanceof Error ? e.message : t('deleteFailed'));
    } finally {
      setDeleting(null);
    }
  };

  const items = postsAsync.data?.items ?? [];
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
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{t('title')}</h1>
          <p className="adm-page-subtitle">
            {t.plural('postCount', items.length)} ·{' '}
            <Link to="/admin/blog/categories" style={{ color: 'var(--adm-accent)' }}>
              {t('manageCategories')}
            </Link>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="adm-input adm-input-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={{ width: 140 }}
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 220 }}
          />
          <Link to="/admin/blog/new" className="adm-btn adm-btn-primary adm-btn-sm">
            {t('addPost')}
          </Link>
        </div>
      </div>

      {postsAsync.loading && (
        <div className="adm-loading-center">
          <span className="adm-spinner" /> {tc('loading')}
        </div>
      )}
      {postsAsync.error && <div className="adm-alert adm-alert-error">⚠ {postsAsync.error}</div>}

      {!postsAsync.loading && (
        <div className="adm-card" style={{ padding: 0 }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>{tc('image')}</th>
                  {/* Aligned with the Arabic titles below it. */}
                  <th style={{ textAlign: 'right' }}>{t('colTitleAr')}</th>
                  <th>{t('colTitleEn')}</th>
                  <th>{t('colCategory')}</th>
                  <th>{tc('status')}</th>
                  <th>{t('colViews')}</th>
                  <th>{t('colReading')}</th>
                  <th>{t('colDate')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>
                      {t('empty')}
                    </td>
                  </tr>
                ) : filtered.map((item) => {
                  const cat = item.category_id ? categoriesById.get(item.category_id) : null;
                  return (
                    <tr key={item.id}>
                      <td style={{ width: 80 }}>
                        {item.image ? (
                          <img
                            src={resolveAdminImage(item.image)}
                            alt=""
                            style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4 }}
                          />
                        ) : (
                          <div style={{ width: 60, height: 40, background: 'var(--adm-bg-3)', borderRadius: 4 }} />
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, direction: 'rtl' }}>
                        {item.featured ? '⭐ ' : ''}
                        {item.title_ar || '—'}
                      </td>
                      <td dir="auto">{item.title_en || '—'}</td>
                      <td>
                        {cat ? (
                          <span
                            dir="auto"
                            style={{
                              background: cat.color || 'var(--adm-bg-3)',
                              color: '#fff',
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {cat.icon} {cat.name_en || cat.name_ar}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--adm-text-dim)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={item.status} active={item.active} />
                      </td>
                      <td>{fmtNumber(item.view_count)}</td>
                      <td>{t.plural('readingMinutes', item.reading_time)}</td>
                      <td>{fmtDate(item.published_at)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <Link
                          to={`/admin/blog/${encodeURIComponent(item.id)}`}
                          className="adm-btn adm-btn-ghost adm-btn-sm"
                        >
                          {tc('edit')}
                        </Link>
                        <button
                          type="button"
                          className="adm-btn adm-btn-danger adm-btn-sm"
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting === item.id}
                          style={{ marginInlineStart: 6 }}
                        >
                          {deleting === item.id ? '…' : tc('delete')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const STATUS_BADGES = {
  published: { bg: '#10b981', icon: '✅', label: 'live' },
  draft:     { bg: '#6b7280', icon: '📝', label: 'draft' },
  scheduled: { bg: '#f59e0b', icon: '🕐', label: 'scheduled' },
  deleted:   { bg: '#ef4444', icon: '🗑', label: 'deletedStatus' },
} as const;

const StatusBadge: React.FC<{ status: BlogPostItem['status']; active?: number | boolean }> = ({ status, active }) => {
  const tc = useT(common);
  // Delete only sets active=0 (drafts are active=0 too). A deleted post kept
  // showing "Live", so it looked as if Delete had done nothing — and
  // re-saving it from the editor quietly republished it.
  const isDeleted = !active && status !== 'draft';
  const c = isDeleted ? STATUS_BADGES.deleted : STATUS_BADGES[status] || STATUS_BADGES.draft;
  return (
    <span style={{ background: c.bg, color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
      {c.icon} {tc(c.label)}
    </span>
  );
};
