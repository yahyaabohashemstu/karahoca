import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type BlogCategoryItem } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';

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

  const items = data?.items || [];

  const updateDraft = (id: string, patch: Partial<BlogCategoryItem>) => {
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] || {}), ...patch } }));
  };

  const saveDraft = async (id: string) => {
    const patch = drafts[id];
    if (!patch || Object.keys(patch).length === 0) return;
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
    if (!confirm('Soft-delete this category? Posts in it will keep their reference but the category will be hidden.')) return;
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
      setErr('Need at least an Arabic or English name.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await adminApi.createBlogCategory(newCat);
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
          <h1 className="adm-page-title">Blog Categories</h1>
          <p className="adm-page-subtitle">
            <Link to="/admin/blog" style={{ color: 'var(--adm-accent)' }}>← Back to posts</Link>
          </p>
        </div>
      </div>

      {(err || error) && <div className="adm-alert adm-alert-error">⚠ {err || error}</div>}
      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> Loading…</div>}

      {!loading && (
        <div className="adm-card" style={{ padding: 0 }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Icon</th>
                  <th>Color</th>
                  <th>Slug</th>
                  <th>Name AR</th>
                  <th>Name EN</th>
                  <th>Name TR</th>
                  <th>Name RU</th>
                  <th>Order</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((cat) => {
                  const d = { ...cat, ...(drafts[cat.id] || {}) };
                  const dirty = Boolean(drafts[cat.id]);
                  return (
                    <tr key={cat.id}>
                      <td>
                        <input
                          type="text"
                          className="adm-input adm-input-sm"
                          style={{ width: 60 }}
                          value={d.icon || ''}
                          onChange={(e) => updateDraft(cat.id, { icon: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="color"
                          value={d.color || '#1a4d8f'}
                          onChange={(e) => updateDraft(cat.id, { color: e.target.value })}
                          style={{ width: 40, height: 28, border: 0, cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="adm-input adm-input-sm"
                          style={{ width: 130 }}
                          value={d.slug || ''}
                          onChange={(e) => updateDraft(cat.id, { slug: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="adm-input adm-input-sm"
                          style={{ width: 140, direction: 'rtl' }}
                          value={d.name_ar || ''}
                          onChange={(e) => updateDraft(cat.id, { name_ar: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="adm-input adm-input-sm"
                          style={{ width: 140 }}
                          value={d.name_en || ''}
                          onChange={(e) => updateDraft(cat.id, { name_en: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="adm-input adm-input-sm"
                          style={{ width: 140 }}
                          value={d.name_tr || ''}
                          onChange={(e) => updateDraft(cat.id, { name_tr: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="adm-input adm-input-sm"
                          style={{ width: 140 }}
                          value={d.name_ru || ''}
                          onChange={(e) => updateDraft(cat.id, { name_ru: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="adm-input adm-input-sm"
                          style={{ width: 60 }}
                          value={d.display_order || 0}
                          onChange={(e) => updateDraft(cat.id, { display_order: parseInt(e.target.value, 10) || 0 })}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(d.active)}
                          onChange={(e) => updateDraft(cat.id, { active: e.target.checked ? 1 : 0 })}
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
                            Save
                          </button>
                        )}
                        <button
                          type="button"
                          className="adm-btn adm-btn-danger adm-btn-sm"
                          onClick={() => handleDelete(cat.id)}
                          disabled={busy}
                          style={{ marginInlineStart: 6 }}
                        >
                          Delete
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
                    />
                  </td>
                  <td>
                    <input
                      type="color"
                      value={newCat.color || '#1a4d8f'}
                      onChange={(e) => setNewCat({ ...newCat, color: e.target.value })}
                      style={{ width: 40, height: 28, border: 0, cursor: 'pointer' }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="adm-input adm-input-sm"
                      style={{ width: 130 }}
                      value={newCat.slug || ''}
                      onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })}
                      placeholder="auto from name"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="adm-input adm-input-sm"
                      style={{ width: 140, direction: 'rtl' }}
                      value={newCat.name_ar || ''}
                      onChange={(e) => setNewCat({ ...newCat, name_ar: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="adm-input adm-input-sm"
                      style={{ width: 140 }}
                      value={newCat.name_en || ''}
                      onChange={(e) => setNewCat({ ...newCat, name_en: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="adm-input adm-input-sm"
                      style={{ width: 140 }}
                      value={newCat.name_tr || ''}
                      onChange={(e) => setNewCat({ ...newCat, name_tr: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="adm-input adm-input-sm"
                      style={{ width: 140 }}
                      value={newCat.name_ru || ''}
                      onChange={(e) => setNewCat({ ...newCat, name_ru: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="adm-input adm-input-sm"
                      style={{ width: 60 }}
                      value={newCat.display_order || 0}
                      onChange={(e) => setNewCat({ ...newCat, display_order: parseInt(e.target.value, 10) || 0 })}
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
                      + Add
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
