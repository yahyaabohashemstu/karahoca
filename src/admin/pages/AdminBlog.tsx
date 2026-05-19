import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type BlogPostItem, type BlogCategoryItem } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate } from '../utils/dateUtils';
import { resolveAdminImage } from '../../utils/image';

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

  const postsAsync = useAsync(() => adminApi.getBlogPosts(true), []);
  const catsAsync = useAsync(() => adminApi.getBlogCategories(), []);

  const categoriesById = useMemo(() => {
    const m = new Map<string, BlogCategoryItem>();
    for (const c of catsAsync.data?.items || []) m.set(c.id, c);
    return m;
  }, [catsAsync.data]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this blog post?')) return;
    setDeleting(id);
    try {
      await adminApi.deleteBlogPost(id);
      postsAsync.reload();
    } catch {
      alert('Failed to delete post');
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
      (item.tags || []).some((t: string) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Blog</h1>
          <p className="adm-page-subtitle">
            {items.length} posts ·{' '}
            <Link to="/admin/blog/categories" style={{ color: 'var(--adm-accent)' }}>
              Manage categories →
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
            <option value="all">All statuses</option>
            <option value="published">✅ Published</option>
            <option value="draft">📝 Drafts</option>
            <option value="scheduled">🕐 Scheduled</option>
            <option value="featured">⭐ Featured</option>
          </select>
          <input
            type="search"
            className="adm-input adm-input-sm"
            placeholder="Search title or tag…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 220 }}
          />
          <Link to="/admin/blog/new" className="adm-btn adm-btn-primary adm-btn-sm">
            + Add Post
          </Link>
        </div>
      </div>

      {postsAsync.loading && (
        <div className="adm-loading-center">
          <span className="adm-spinner" /> Loading...
        </div>
      )}
      {postsAsync.error && <div className="adm-alert adm-alert-error">⚠ {postsAsync.error}</div>}

      {!postsAsync.loading && (
        <div className="adm-card" style={{ padding: 0 }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th style={{ textAlign: 'right' }}>Title (AR)</th>
                  <th>Title (EN)</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Views</th>
                  <th>Reading</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>
                      No posts match the filter.
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
                      <td>{item.title_en || '—'}</td>
                      <td>
                        {cat ? (
                          <span
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
                        <StatusBadge status={item.status} />
                      </td>
                      <td>{item.view_count}</td>
                      <td>{item.reading_time} min</td>
                      <td>{fmtDate(item.published_at)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <Link
                          to={`/admin/blog/${encodeURIComponent(item.id)}`}
                          className="adm-btn adm-btn-ghost adm-btn-sm"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="adm-btn adm-btn-danger adm-btn-sm"
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting === item.id}
                          style={{ marginInlineStart: 6 }}
                        >
                          {deleting === item.id ? '…' : 'Delete'}
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

const StatusBadge: React.FC<{ status: BlogPostItem['status'] }> = ({ status }) => {
  const cfg: Record<string, { bg: string; label: string }> = {
    published: { bg: '#10b981', label: '✅ Live' },
    draft:     { bg: '#6b7280', label: '📝 Draft' },
    scheduled: { bg: '#f59e0b', label: '🕐 Scheduled' },
  };
  const c = cfg[status] || cfg.draft;
  return (
    <span style={{ background: c.bg, color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
      {c.label}
    </span>
  );
};
