import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type BlogCategoryItem } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { normalizeSlug } from '../utils/slug';
import { confirmSlugChange } from '../utils/publishing';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

const messages = defineMessages({
  en: {
    confirmDelete: 'Soft-delete this category? Posts in it will keep their reference but the category will be hidden.',
    nameRequired: 'Need at least an Arabic or English name.',
    title: 'Blog Categories',
    backToPosts: '← Back to posts',
    colIcon: 'Icon',
    colColor: 'Color',
    colSlug: 'Slug',
    colNameAr: 'Name AR',
    colNameEn: 'Name EN',
    colNameTr: 'Name TR',
    colNameRu: 'Name RU',
    colOrder: 'Order',
    colActive: 'Active',
    newCategory: 'new category',
    iconLabel: 'Icon — {row}',
    colorLabel: 'Color — {row}',
    slugLabel: 'Slug — {row}',
    nameArLabel: 'Arabic name — {row}',
    nameEnLabel: 'English name — {row}',
    nameTrLabel: 'Turkish name — {row}',
    nameRuLabel: 'Russian name — {row}',
    orderLabel: 'Display order — {row}',
    activeLabel: 'Active — {row}',
    slugPlaceholder: 'auto from name',
    add: '+ Add',
  },
  ar: {
    confirmDelete: 'حذف هذه الفئة حذفًا مؤقتًا؟ ستبقى المقالات التابعة لها مرتبطة بها، لكن الفئة ستُخفى.',
    nameRequired: 'يلزم اسم عربي أو إنجليزي على الأقل.',
    title: 'فئات المدونة',
    backToPosts: '→ العودة إلى المقالات',
    colIcon: 'الأيقونة',
    colColor: 'اللون',
    colSlug: 'الـ slug',
    colNameAr: 'الاسم AR',
    colNameEn: 'الاسم EN',
    colNameTr: 'الاسم TR',
    colNameRu: 'الاسم RU',
    colOrder: 'الترتيب',
    colActive: 'مفعّلة',
    newCategory: 'فئة جديدة',
    iconLabel: 'الأيقونة — {row}',
    colorLabel: 'اللون — {row}',
    slugLabel: 'الـ slug — {row}',
    nameArLabel: 'الاسم العربي — {row}',
    nameEnLabel: 'الاسم الإنجليزي — {row}',
    nameTrLabel: 'الاسم التركي — {row}',
    nameRuLabel: 'الاسم الروسي — {row}',
    orderLabel: 'ترتيب العرض — {row}',
    activeLabel: 'مفعّلة — {row}',
    slugPlaceholder: 'من الاسم تلقائيًا',
    add: '+ إضافة',
  },
});

/**
 * /admin/blog/categories — inline-edit grid for blog categories.
 *
 * Categories are short and rarely change, so this page skips the
 * separate /new and /:id edit screens that posts use. Everything
 * happens in a single table: add a row at the bottom, edit fields
 * inline, hit Save per row. Keeps the workflow as light as possible.
 */

const EMPTY_CAT: Partial<BlogCategoryItem> = {
  slug: '',
  color: '#1a4d8f',
  icon: '🏷',
  name_ar: '', name_en: '', name_tr: '', name_ru: '',
  description_ar: '', description_en: '', description_tr: '', description_ru: '',
  display_order: 0,
};

export const AdminBlogCategories: React.FC = () => {
  const { data, loading, error, reload } = useAsync(() => adminApi.getBlogCategories(), []);
  const [drafts, setDrafts] = useState<Record<string, Partial<BlogCategoryItem>>>({});
  const [newCat, setNewCat] = useState<Partial<BlogCategoryItem>>(EMPTY_CAT);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const t = useT(messages);
  const tc = useT(common);

  const items = data?.items || [];

  const updateDraft = (id: string, patch: Partial<BlogCategoryItem>) => {
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] || {}), ...patch } }));
  };

  const saveDraft = async (id: string) => {
    if (!drafts[id] || Object.keys(drafts[id]).length === 0) return;
    const patch = { ...drafts[id] };
    if (patch.slug !== undefined) {
      // Blank → the server derives one from the names.
      patch.slug = normalizeSlug(patch.slug);
      const cat = items.find((c) => c.id === id);
      if (!confirmSlugChange('category', Boolean(cat?.active), cat?.slug, patch.slug)) return;
    }
    setBusy(true);
    setErr(null);
    try {
      await adminApi.updateBlogCategory(id, patch);
      setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    setBusy(true);
    try {
      await adminApi.deleteBlogCategory(id);
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!newCat.name_ar?.trim() && !newCat.name_en?.trim()) {
      setErr(t('nameRequired'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await adminApi.createBlogCategory({ ...newCat, slug: normalizeSlug(newCat.slug) });
      setNewCat(EMPTY_CAT);
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{t('title')}</h1>
          <p className="adm-page-subtitle">
            <Link to="/admin/blog" style={{ color: 'var(--adm-accent)' }}>{t('backToPosts')}</Link>
          </p>
        </div>
      </div>

      {(err || error) && <div className="adm-alert adm-alert-error">⚠ {err || error}</div>}
      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> {tc('loading')}</div>}

      {!loading && (
        <div className="adm-card" style={{ padding: 0 }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>{t('colIcon')}</th>
                  <th>{t('colColor')}</th>
                  <th>{t('colSlug')}</th>
                  <th>{t('colNameAr')}</th>
                  <th>{t('colNameEn')}</th>
                  <th>{t('colNameTr')}</th>
                  <th>{t('colNameRu')}</th>
                  <th>{t('colOrder')}</th>
                  <th>{t('colActive')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((cat) => {
                  const d = { ...cat, ...(drafts[cat.id] || {}) };
                  const dirty = Boolean(drafts[cat.id]);
                  // The table header isn't tied to these inputs, so each
                  // one names its column and row for screen readers.
                  const row = cat.name_en || cat.name_ar || cat.slug;
                  return (
                    <tr key={cat.id}>
                      <td>
                        <input
                          type="text"
                          className="adm-input adm-input-sm"
                          style={{ width: 60 }}
                          value={d.icon || ''}
                          onChange={(e) => updateDraft(cat.id, { icon: e.target.value })}
                          aria-label={t('iconLabel', { row })}
                        />
                      </td>
                      <td>
                        <input
                          type="color"
                          value={d.color || '#1a4d8f'}
                          onChange={(e) => updateDraft(cat.id, { color: e.target.value })}
                          aria-label={t('colorLabel', { row })}
                          style={{ width: 40, height: 28, border: 0, cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="adm-input adm-input-sm"
                          style={{ width: 130 }}
                          dir="ltr"
                          value={d.slug || ''}
                          onChange={(e) => updateDraft(cat.id, { slug: normalizeSlug(e.target.value, { partial: true }) })}
                          aria-label={t('slugLabel', { row })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="adm-input adm-input-sm"
                          dir="rtl"
                          style={{ width: 140 }}
                          value={d.name_ar || ''}
                          onChange={(e) => updateDraft(cat.id, { name_ar: e.target.value })}
                          aria-label={t('nameArLabel', { row })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="adm-input adm-input-sm"
                          dir="ltr"
                          style={{ width: 140 }}
                          value={d.name_en || ''}
                          onChange={(e) => updateDraft(cat.id, { name_en: e.target.value })}
                          aria-label={t('nameEnLabel', { row })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="adm-input adm-input-sm"
                          dir="ltr"
                          style={{ width: 140 }}
                          value={d.name_tr || ''}
                          onChange={(e) => updateDraft(cat.id, { name_tr: e.target.value })}
                          aria-label={t('nameTrLabel', { row })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="adm-input adm-input-sm"
                          dir="ltr"
                          style={{ width: 140 }}
                          value={d.name_ru || ''}
                          onChange={(e) => updateDraft(cat.id, { name_ru: e.target.value })}
                          aria-label={t('nameRuLabel', { row })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="adm-input adm-input-sm"
                          dir="ltr"
                          style={{ width: 60 }}
                          value={d.display_order || 0}
                          onChange={(e) => updateDraft(cat.id, { display_order: parseInt(e.target.value, 10) || 0 })}
                          aria-label={t('orderLabel', { row })}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(d.active)}
                          onChange={(e) => updateDraft(cat.id, { active: e.target.checked ? 1 : 0 })}
                          aria-label={t('activeLabel', { row })}
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {dirty && (
                          <button
                            type="button"
                            className="adm-btn adm-btn-primary adm-btn-sm"
                            onClick={() => saveDraft(cat.id)}
                            disabled={busy}
                          >
                            {tc('save')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="adm-btn adm-btn-danger adm-btn-sm"
                          onClick={() => handleDelete(cat.id)}
                          disabled={busy}
                          style={{ marginInlineStart: 6 }}
                        >
                          {tc('delete')}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* New-category row */}
                <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <td>
                    <input
                      type="text"
                      className="adm-input adm-input-sm"
                      style={{ width: 60 }}
                      value={newCat.icon || ''}
                      onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })}
                      placeholder="🏷"
                      aria-label={t('iconLabel', { row: t('newCategory') })}
                    />
                  </td>
                  <td>
                    <input
                      type="color"
                      value={newCat.color || '#1a4d8f'}
                      onChange={(e) => setNewCat({ ...newCat, color: e.target.value })}
                      aria-label={t('colorLabel', { row: t('newCategory') })}
                      style={{ width: 40, height: 28, border: 0, cursor: 'pointer' }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="adm-input adm-input-sm"
                      style={{ width: 130 }}
                      dir="ltr"
                      value={newCat.slug || ''}
                      onChange={(e) => setNewCat({ ...newCat, slug: normalizeSlug(e.target.value, { partial: true }) })}
                      placeholder={t('slugPlaceholder')}
                      aria-label={t('slugLabel', { row: t('newCategory') })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="adm-input adm-input-sm"
                      dir="rtl"
                      style={{ width: 140 }}
                      value={newCat.name_ar || ''}
                      onChange={(e) => setNewCat({ ...newCat, name_ar: e.target.value })}
                      aria-label={t('nameArLabel', { row: t('newCategory') })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="adm-input adm-input-sm"
                      dir="ltr"
                      style={{ width: 140 }}
                      value={newCat.name_en || ''}
                      onChange={(e) => setNewCat({ ...newCat, name_en: e.target.value })}
                      aria-label={t('nameEnLabel', { row: t('newCategory') })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="adm-input adm-input-sm"
                      dir="ltr"
                      style={{ width: 140 }}
                      value={newCat.name_tr || ''}
                      onChange={(e) => setNewCat({ ...newCat, name_tr: e.target.value })}
                      aria-label={t('nameTrLabel', { row: t('newCategory') })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="adm-input adm-input-sm"
                      dir="ltr"
                      style={{ width: 140 }}
                      value={newCat.name_ru || ''}
                      onChange={(e) => setNewCat({ ...newCat, name_ru: e.target.value })}
                      aria-label={t('nameRuLabel', { row: t('newCategory') })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="adm-input adm-input-sm"
                      dir="ltr"
                      style={{ width: 60 }}
                      value={newCat.display_order || 0}
                      onChange={(e) => setNewCat({ ...newCat, display_order: parseInt(e.target.value, 10) || 0 })}
                      aria-label={t('orderLabel', { row: t('newCategory') })}
                    />
                  </td>
                  <td>—</td>
                  <td>
                    <button
                      type="button"
                      className="adm-btn adm-btn-primary adm-btn-sm"
                      onClick={handleCreate}
                      disabled={busy}
                    >
                      {t('add')}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
