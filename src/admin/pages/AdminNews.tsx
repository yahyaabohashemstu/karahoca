import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type NewsItem } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate, fmtDateTime } from '../utils/dateUtils';
import { resolveAdminImage } from '../../utils/image';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

const messages = defineMessages({
  en: {
    title: 'News',
    subtitle: { other: 'Manage news articles — {n} total' },
    searchPlaceholder: 'Search by title or category…',
    addArticle: '+ Add Article',
    colTitleAr: 'Title (AR)',
    colTitleEn: 'Title (EN)',
    colCategory: 'Category',
    colDate: 'Date',
    empty: 'No articles yet.',
    publishes: 'Publishes: {at}',
    confirmDelete: 'Delete this news article?',
    deleteFailed: 'Failed to delete article',
    deleteLabel: 'Delete article {name}',
    deleteTitle: 'Delete article',
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
    addArticle: '+ إضافة خبر',
    colTitleAr: 'العنوان (AR)',
    colTitleEn: 'العنوان (EN)',
    colCategory: 'الفئة',
    colDate: 'التاريخ',
    empty: 'لا توجد أخبار بعد.',
    publishes: 'يُنشر في: {at}',
    confirmDelete: 'حذف هذا الخبر؟',
    deleteFailed: 'تعذّر حذف الخبر',
    deleteLabel: 'حذف الخبر {name}',
    deleteTitle: 'حذف الخبر',
  },
});

export const AdminNews: React.FC = () => {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { data, loading, error, reload } = useAsync(() => adminApi.getNews(true), []);
  const t = useT(messages);
  const tc = useT(common);

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    setDeleting(id);
    try {
      await adminApi.deleteNews(id);
      reload();
    } catch (e) {
      // Show the real reason (e.g. "session expired — sign in again").
      alert(e instanceof Error ? e.message : t('deleteFailed'));
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
      (item.category_en || '').toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{t('title')}</h1>
          <p className="adm-page-subtitle">{t.plural('subtitle', items.length)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="search"
            className="adm-input adm-input-sm"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: 220 }}
          />
          <Link to="/admin/news/new" className="adm-btn adm-btn-primary adm-btn-sm">
            {t('addArticle')}
          </Link>
        </div>
      </div>

      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> {tc('loading')}</div>}
      {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

      {!loading && (
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
                  <th>{t('colDate')}</th>
                  <th>{tc('status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>{t('empty')}</td></tr>
                ) : filtered.map((item: NewsItem) => (
                  <tr key={item.id}>
                    <td>
                      {item.image ? (
                        <img
                          src={resolveAdminImage(item.image)}
                          alt={item.title_en}
                          style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4 }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : <span className="adm-text-muted">—</span>}
                    </td>
                    <td dir="rtl" className="adm-truncate" style={{ maxWidth: 180, textAlign: 'right' }}>{item.title_ar}</td>
                    <td dir="auto" className="adm-truncate" style={{ maxWidth: 200 }}>{item.title_en}</td>
                    <td dir="auto" className="adm-text-sm adm-text-muted">{item.category_en}</td>
                    <td className="adm-text-sm adm-text-muted">{fmtDate(item.published_at)}</td>
                    <td>
                      {/* Delete only sets active=0 (drafts are active=0 too), so a
                          deleted article used to show its old status — "Hidden"
                          at best, "Scheduled" for a deleted scheduled one. Same
                          rule as the blog list. */}
                      {!item.active && item.status !== 'draft' ? (
                        <span className="adm-badge adm-badge-red">🗑 {tc('deletedStatus')}</span>
                      ) : item.status === 'scheduled' ? (
                        <span className="adm-badge" style={{ background: 'rgba(99,102,241,.18)', color: '#818cf8', border: '1px solid rgba(99,102,241,.3)' }}
                          title={item.publish_at ? t('publishes', { at: fmtDateTime(item.publish_at) }) : ''}>
                          🕐 {tc('scheduled')}
                        </span>
                      ) : item.status === 'draft' ? (
                        <span className="adm-badge" style={{ background: 'rgba(245,158,11,.18)', color: '#fbbf24', border: '1px solid rgba(245,158,11,.3)' }}>
                          📝 {tc('draft')}
                        </span>
                      ) : (
                        <span className="adm-badge adm-badge-green">✅ {tc('published')}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Link to={`/admin/news/${item.id}`} className="adm-btn adm-btn-ghost adm-btn-sm">{tc('edit')}</Link>
                        <button
                          className="adm-btn adm-btn-danger adm-btn-sm"
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting === item.id}
                          aria-label={t('deleteLabel', { name: item.title_en || item.title_ar || item.slug })}
                          title={t('deleteTitle')}
                        >
                          {deleting === item.id ? '…' : '🗑'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
