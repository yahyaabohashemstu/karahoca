import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type Product } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';

export const AdminProducts: React.FC = () => {
  // ── Browse state ──────────────────────────────────────────────────────────
  const [brand, setBrand] = useState<'DIOX' | 'AYLUX' | ''>('');
  const [showHidden, setShowHidden] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Reorder state ─────────────────────────────────────────────────────────
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderItems, setReorderItems] = useState<Product[]>([]);
  const [dragSrcId, setDragSrcId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => adminApi.getProducts(brand || undefined, showHidden),
    [brand, showHidden],
  );

  const products = data?.products ?? [];

  const filtered = products.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.name_en || '').toLowerCase().includes(q) ||
      (p.name_ar || '').includes(q) ||
      (p.category_title_en || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q)
    );
  });

  const hiddenCount = showHidden ? filtered.filter(p => !p.active).length : 0;

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product? It will be hidden from the public site.\n\nTo permanently remove it, use "Edit" and then contact your admin.')) return;
    setDeleting(id);
    try {
      await adminApi.deleteProduct(id);
      reload();
    } catch {
      alert('Failed to delete product');
    } finally {
      setDeleting(null);
    }
  };

  // ── Enter / exit reorder mode ─────────────────────────────────────────────
  const enterReorderMode = () => {
    // Fetch ALL active products regardless of filter for reorder
    setReorderItems([...products]);
    setDirty(false);
    setDragSrcId(null);
    setDragOverId(null);
    setReorderMode(true);
  };

  const cancelReorder = () => {
    if (dirty && !confirm('Discard unsaved order changes?')) return;
    setReorderMode(false);
    setDragSrcId(null);
    setDragOverId(null);
    setDirty(false);
  };

  // ── Drag & drop handlers ──────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDragSrcId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragOverId) setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!dragSrcId || dragSrcId === targetId) {
      setDragSrcId(null);
      setDragOverId(null);
      return;
    }

    const srcItem = reorderItems.find(p => p.id === dragSrcId);
    const tgtItem = reorderItems.find(p => p.id === targetId);
    if (!srcItem || !tgtItem) return;

    // Only allow reordering within the same category
    if (srcItem.category_id !== tgtItem.category_id) {
      setDragSrcId(null);
      setDragOverId(null);
      return;
    }

    const newItems = [...reorderItems];
    const srcIdx = newItems.findIndex(p => p.id === dragSrcId);
    const tgtIdx = newItems.findIndex(p => p.id === targetId);
    newItems.splice(srcIdx, 1);
    newItems.splice(tgtIdx, 0, srcItem);

    setReorderItems(newItems);
    setDirty(true);
    setDragSrcId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragSrcId(null);
    setDragOverId(null);
  };

  // ── Save reorder ──────────────────────────────────────────────────────────
  const handleSaveReorder = async () => {
    setSaving(true);
    try {
      // Assign sequential display_order per category group
      const payload: { id: string; display_order: number }[] = [];
      const byCategory = new Map<string, Product[]>();

      for (const p of reorderItems) {
        if (!byCategory.has(p.category_id)) byCategory.set(p.category_id, []);
        byCategory.get(p.category_id)!.push(p);
      }
      for (const [, prods] of byCategory) {
        prods.forEach((p, idx) => payload.push({ id: p.id, display_order: idx + 1 }));
      }

      await adminApi.reorderProducts(payload);
      setDirty(false);
      setReorderMode(false);
      reload();
    } catch {
      alert('Failed to save order. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Build grouped structure for reorder view ──────────────────────────────
  const groupedReorder = (() => {
    const catOrder: string[] = [];
    const groups = new Map<string, { titleEn: string; titleAr: string; items: Product[] }>();
    for (const p of reorderItems) {
      if (!groups.has(p.category_id)) {
        catOrder.push(p.category_id);
        groups.set(p.category_id, {
          titleEn: p.category_title_en || p.category_id,
          titleAr: p.category_title_ar || '',
          items: [],
        });
      }
      groups.get(p.category_id)!.items.push(p);
    }
    return catOrder.map(id => ({ id, ...groups.get(id)! }));
  })();

  // ═══════════════════════════════════════════════════════════════════════════
  // ── REORDER MODE VIEW ─────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  if (reorderMode) {
    return (
      <div>
        <div className="adm-page-header">
          <div>
            <h1 className="adm-page-title">⠿ Reorder Products</h1>
            <p className="adm-page-subtitle">
              Drag rows within each category to change display order. Cross-category drag is disabled.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="adm-btn adm-btn-secondary adm-btn-sm"
              onClick={cancelReorder}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className={`adm-btn adm-btn-sm ${dirty ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
              onClick={handleSaveReorder}
              disabled={!dirty || saving}
            >
              {saving ? '⏳ Saving…' : dirty ? '💾 Save Order' : '✓ No Changes'}
            </button>
          </div>
        </div>

        {reorderItems.length === 0 && (
          <div className="adm-alert" style={{ marginTop: 16 }}>
            No products loaded. Close and open a brand filter first.
          </div>
        )}

        {groupedReorder.map(group => (
          <div key={group.id} className="adm-card" style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
            {/* Category header */}
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--adm-border)',
              background: 'var(--adm-surface2)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <strong style={{ fontSize: 14 }}>{group.titleEn}</strong>
              {group.titleAr && (
                <span className="adm-text-muted" style={{ fontSize: 13 }} dir="rtl">{group.titleAr}</span>
              )}
              <span className="adm-badge adm-badge-blue" style={{ marginLeft: 'auto', fontSize: 11 }}>
                {group.items.length} products
              </span>
            </div>

            {/* Draggable rows */}
            {group.items.map((p) => {
              const isDragging = dragSrcId === p.id;
              const isOver = dragOverId === p.id && dragSrcId !== p.id;
              const srcInSameCat = dragSrcId
                ? reorderItems.find(x => x.id === dragSrcId)?.category_id === p.category_id
                : false;

              return (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, p.id)}
                  onDragOver={(e) => handleDragOver(e, p.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, p.id)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '9px 16px',
                    borderBottom: '1px solid var(--adm-border)',
                    background: isDragging
                      ? 'rgba(99, 102, 241, 0.05)'
                      : isOver && srcInSameCat
                        ? 'rgba(99, 102, 241, 0.1)'
                        : 'transparent',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    opacity: isDragging ? 0.45 : 1,
                    borderLeft: isOver && srcInSameCat
                      ? '3px solid var(--adm-primary, #6366f1)'
                      : '3px solid transparent',
                    transition: 'background 0.12s, border-color 0.12s, opacity 0.12s',
                  }}
                >
                  {/* Drag handle */}
                  <span style={{
                    fontSize: 20,
                    color: 'var(--adm-text-dim)',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}>
                    ⠿
                  </span>

                  {/* Thumbnail */}
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.alt_en || p.name_en}
                      draggable={false}
                      style={{
                        width: 38,
                        height: 38,
                        objectFit: 'contain',
                        borderRadius: 6,
                        background: 'var(--adm-surface2)',
                        flexShrink: 0,
                      }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{
                      width: 38, height: 38,
                      borderRadius: 6,
                      background: 'var(--adm-surface2)',
                      flexShrink: 0,
                    }} />
                  )}

                  {/* Names */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name_en}
                    </div>
                    <div dir="rtl" style={{ fontSize: 12, color: 'var(--adm-text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name_ar}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={`adm-badge ${p.active ? 'adm-badge-green' : 'adm-badge-red'}`} style={{ fontSize: 11, flexShrink: 0 }}>
                    {p.active ? 'Active' : 'Hidden'}
                  </span>

                  {/* Brand badge */}
                  <span className={`adm-badge ${p.brand === 'DIOX' ? 'adm-badge-blue' : 'adm-badge-green'}`} style={{ fontSize: 11, flexShrink: 0 }}>
                    {p.brand}
                  </span>
                </div>
              );
            })}
          </div>
        ))}

        {/* Bottom save bar */}
        {dirty && (
          <div style={{
            position: 'sticky',
            bottom: 16,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 0',
          }}>
            <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={cancelReorder} disabled={saving}>
              Discard
            </button>
            <button className="adm-btn adm-btn-primary" onClick={handleSaveReorder} disabled={saving}>
              {saving ? '⏳ Saving…' : '💾 Save New Order'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── NORMAL TABLE VIEW ─────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Products</h1>
          <p className="adm-page-subtitle">Manage DIOX and AYLUX product catalog</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={enterReorderMode}
            title="Drag-and-drop to reorder products within categories"
            disabled={loading || products.length === 0}
          >
            ⠿ Reorder
          </button>
          <Link to="/admin/categories" className="adm-btn adm-btn-secondary adm-btn-sm">
            🗂️ Manage Categories
          </Link>
          <Link to="/admin/products/new" className="adm-btn adm-btn-primary adm-btn-sm">
            + Add Product
          </Link>
        </div>
      </div>

      <div className="adm-card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Brand filter */}
        {(['', 'DIOX', 'AYLUX'] as const).map((b) => (
          <button
            key={b || 'all'}
            className={`adm-btn adm-btn-sm ${brand === b ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
            onClick={() => setBrand(b)}
          >
            {b || 'All Brands'}
          </button>
        ))}

        {/* Show-hidden toggle */}
        <button
          className={`adm-btn adm-btn-sm ${showHidden ? 'adm-btn-warning' : 'adm-btn-ghost'}`}
          onClick={() => setShowHidden(v => !v)}
          title={showHidden ? 'Currently showing hidden products — click to hide them' : 'Show hidden/deleted products'}
        >
          {showHidden ? '👁 Hide Hidden' : '👁 Show Hidden'}
        </button>

        {/* Search */}
        <input
          type="search"
          className="adm-input adm-input-sm"
          placeholder="Search by name, category, brand…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ marginLeft: 'auto', width: 220 }}
        />

        {/* Count */}
        <span className="adm-text-muted adm-text-sm">
          {filtered.length} of {products.length}
          {hiddenCount > 0 && (
            <span style={{ color: 'var(--adm-danger)', marginLeft: 4 }}>
              ({hiddenCount} hidden)
            </span>
          )}
        </span>
      </div>

      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> Loading...</div>}
      {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

      {!loading && (
        <div className="adm-card" style={{ padding: 0 }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th style={{ textAlign: 'right' }}>Name (AR)</th>
                  <th>Name (EN)</th>
                  <th>Brand</th>
                  <th>Category</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>
                      No products found.
                    </td>
                  </tr>
                ) : filtered.map((p: Product) => (
                  <tr
                    key={p.id}
                    style={!p.active ? { opacity: 0.45, background: 'rgba(255,60,60,0.04)' } : undefined}
                  >
                    <td>
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.alt_en || p.name_en}
                          style={{ width: 40, height: 40, objectFit: 'contain', background: 'var(--adm-surface2)', borderRadius: 4 }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : <span className="adm-text-muted">—</span>}
                    </td>
                    <td dir="rtl" style={{ maxWidth: 160, textAlign: 'right' }} className="adm-truncate">{p.name_ar}</td>
                    <td style={{ maxWidth: 160 }} className="adm-truncate">{p.name_en}</td>
                    <td><span className={`adm-badge ${p.brand === 'DIOX' ? 'adm-badge-blue' : 'adm-badge-green'}`}>{p.brand}</span></td>
                    <td className="adm-text-sm adm-text-muted">{p.category_title_en || p.category_id}</td>
                    <td className="adm-text-sm adm-text-muted">{p.display_order}</td>
                    <td>
                      <span className={`adm-badge ${p.active ? 'adm-badge-green' : 'adm-badge-red'}`}>
                        {p.active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Link to={`/admin/products/${p.id}`} className="adm-btn adm-btn-ghost adm-btn-sm">Edit</Link>
                        <button
                          className="adm-btn adm-btn-danger adm-btn-sm"
                          onClick={() => handleDelete(p.id)}
                          disabled={deleting === p.id}
                        >
                          {deleting === p.id ? '…' : '🗑'}
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
