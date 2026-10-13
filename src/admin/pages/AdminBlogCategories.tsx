import React, { useState } from 'react';
import { adminApi, type BlogCategoryItem } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { normalizeSlug } from '../utils/slug';
import { confirmSlugChange } from '../utils/publishing';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { Alert, Button, Card, IconButton, Loading, NumberInput, PageHeader } from '../ui';

const messages = defineMessages({
  en: {
    confirmDelete: 'Soft-delete this category? Posts in it will keep their reference but the category will be hidden.',
    nameRequired: 'Need at least an Arabic or English name.',
    title: 'Blog categories',
    backToPosts: 'Blog',
    subtitle: 'Edit a row and save it; add a new category in the last row.',
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
    add: 'Add',
    saveLabel: 'Save {row}',
    deleteLabel: 'Delete {row}',
  },
  ar: {
    confirmDelete: 'حذف هذه الفئة حذفًا مؤقتًا؟ ستبقى المقالات التابعة لها مرتبطة بها، لكن الفئة ستُخفى.',
    nameRequired: 'يلزم اسم عربي أو إنجليزي على الأقل.',
    title: 'فئات المدونة',
    backToPosts: 'المدونة',
    subtitle: 'عدِّل الصف ثم احفظه، وأضف فئة جديدة من الصف الأخير.',
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
    add: 'إضافة',
    saveLabel: 'حفظ {row}',
    deleteLabel: 'حذف {row}',
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

// Defaults for a new category. Colour and icon are the category's own
// data, shown on the public blog (not admin interface): the icon is the
// label emoji, written as an escape.
const DEFAULT_COLOR = '#1a4d8f';
const EMPTY_CAT: Partial<BlogCategoryItem> = {
  slug: '',
  color: DEFAULT_COLOR,
  icon: '\u{1F3F7}',
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
      // Blank: the server derives one from the names.
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
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        back={{ to: '/admin/blog', label: t('backToPosts') }}
      />

      {(err || error) && <Alert tone="danger">{err || error}</Alert>}

      {loading ? <Loading label={tc('loading')} /> : (
        <Card flush>
          <div className="adm-table-wrap">
            <table className="adm-table adm-table-compact">
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
                  <th className="adm-col-actions"><span className="adm-sr-only">{tc('actions')}</span></th>
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
                          style={{ width: 56 }}
                          value={d.icon || ''}
                          onChange={(e) => updateDraft(cat.id, { icon: e.target.value })}
                          aria-label={t('iconLabel', { row })}
                        />
                      </td>
                      <td>
                        <input
                          type="color"
                          value={d.color || DEFAULT_COLOR}
                          onChange={(e) => updateDraft(cat.id, { color: e.target.value })}
                          aria-label={t('colorLabel', { row })}
                          className="adm-color-input adm-color-input-sm"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="adm-input adm-input-sm"
                          style={{ width: 120 }}
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
                          style={{ width: 120 }}
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
                          style={{ width: 120 }}
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
                          style={{ width: 120 }}
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
                          style={{ width: 120 }}
                          value={d.name_ru || ''}
                          onChange={(e) => updateDraft(cat.id, { name_ru: e.target.value })}
                          aria-label={t('nameRuLabel', { row })}
                        />
                      </td>
                      <td>
                        <NumberInput
                          className="adm-input adm-input-sm"
                          style={{ width: 56 }}
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
                      <td className="adm-col-actions">
                        <div className="adm-row-actions">
                          {/* Shown once the row has unsaved edits. */}
                          {dirty && (
                            <IconButton
                              icon="save"
                              tone="accent"
                              size="sm"
                              label={t('saveLabel', { row })}
                              onClick={() => saveDraft(cat.id)}
                              disabled={busy}
                            />
                          )}
                          <IconButton
                            icon="trash"
                            tone="danger"
                            size="sm"
                            label={t('deleteLabel', { row })}
                            onClick={() => handleDelete(cat.id)}
                            disabled={busy}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* New-category row */}
                <tr>
                  <td>
                    <input
                      type="text"
                      className="adm-input adm-input-sm"
                      style={{ width: 56 }}
                      value={newCat.icon || ''}
                      onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })}
                      aria-label={t('iconLabel', { row: t('newCategory') })}
                    />
                  </td>
                  <td>
                    <input
                      type="color"
                      value={newCat.color || DEFAULT_COLOR}
                      onChange={(e) => setNewCat({ ...newCat, color: e.target.value })}
                      aria-label={t('colorLabel', { row: t('newCategory') })}
                      className="adm-color-input adm-color-input-sm"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="adm-input adm-input-sm"
                      style={{ width: 120 }}
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
                      style={{ width: 120 }}
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
                      style={{ width: 120 }}
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
                      style={{ width: 120 }}
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
                      style={{ width: 120 }}
                      value={newCat.name_ru || ''}
                      onChange={(e) => setNewCat({ ...newCat, name_ru: e.target.value })}
                      aria-label={t('nameRuLabel', { row: t('newCategory') })}
                    />
                  </td>
                  <td>
                    <NumberInput
                      className="adm-input adm-input-sm"
                      style={{ width: 56 }}
                      value={newCat.display_order || 0}
                      onChange={(e) => setNewCat({ ...newCat, display_order: parseInt(e.target.value, 10) || 0 })}
                      aria-label={t('orderLabel', { row: t('newCategory') })}
                    />
                  </td>
                  <td><span className="adm-text-muted">—</span></td>
                  <td className="adm-col-actions">
                    <Button variant="primary" size="sm" icon="plus" onClick={handleCreate} disabled={busy}>
                      {t('add')}
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
