import React, { useState } from 'react';
import { adminApi, type AuditLogEntry } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';

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

const ACTION_COLOR: Record<string, string> = {
  CREATE: '#22c55e',
  UPDATE: '#4f6ef7',
  DELETE: '#ef4444',
  SEND:   '#f59e0b',
  EXPORT: '#06b6d4',
  IMPORT: '#0ea5e9',
  REORDER: '#a855f7',
};

const ACTION_ICON: Record<string, string> = {
  CREATE: '➕',
  UPDATE: '✏️',
  DELETE: '🗑️',
  SEND:   '📧',
  EXPORT: '⬇️',
  IMPORT: '📥',
  REORDER: '↕️',
};

const ENTITY_LABELS: Record<string, string> = {
  product:    '🧴 Product',
  category:   '🗂️ Category',
  news:       '📰 News',
  campaign:   '📧 Campaign',
  newsletter: '✉️ Newsletter',
  ai_qa:      '🤖 AI Q&A',
  audit_log:  '🔍 Audit Log',
};

const PAGE_SIZE = 50;

export const AdminAuditLog: React.FC = () => {
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

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

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
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Audit Log</h1>
          <p className="adm-page-subtitle">
            All admin create / update / delete / send / export operations — {total} matching entries
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <a
            href={exportUrl}
            className="adm-btn adm-btn-ghost adm-btn-sm"
            // download attribute provides a sensible default filename
            // even on browsers that don't follow Content-Disposition
            // strictly (rare but Safari historically lagged).
            download
            target="_self"
            rel="noopener"
          >
            ⬇️ Export CSV
          </a>
          <button
            type="button"
            className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={resetFilters}
            disabled={
              !entityFilter && !actionFilter && !searchApplied && !fromDate && !toDate
            }
          >
            Reset filters
          </button>
        </div>
      </div>

      {/* Filter bar — five controls laid out in a flex-wrap row so it
          collapses cleanly on narrow viewports without a media query. */}
      <div
        className="adm-card"
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          marginBottom: 16,
          padding: 12,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>Entity</span>
          <select
            className="adm-input adm-input-sm"
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(0); }}
          >
            <option value="">All entities</option>
            <option value="product">Products</option>
            <option value="category">Categories</option>
            <option value="news">News</option>
            <option value="campaign">Campaigns</option>
            <option value="newsletter">Newsletter</option>
            <option value="ai_qa">AI Q&amp;A</option>
            <option value="audit_log">Audit log</option>
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>Action</span>
          <select
            className="adm-input adm-input-sm"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
          >
            <option value="">All actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="SEND">Send</option>
            <option value="EXPORT">Export</option>
            <option value="IMPORT">Import</option>
            <option value="REORDER">Reorder</option>
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 220px', minWidth: 220 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>Search (name / id / details)</span>
          <form
            onSubmit={(e) => { e.preventDefault(); setSearchApplied(searchInput.trim()); setPage(0); }}
            style={{ display: 'flex', gap: 4 }}
          >
            <input
              type="search"
              className="adm-input adm-input-sm"
              placeholder="e.g. floor cleaner or diox-…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="adm-btn adm-btn-primary adm-btn-sm">Search</button>
          </form>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>From</span>
          <input
            type="date"
            className="adm-input adm-input-sm"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
            style={{ width: 150 }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>To</span>
          <input
            type="date"
            className="adm-input adm-input-sm"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(0); }}
            style={{ width: 150 }}
          />
        </label>
      </div>

      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> Loading…</div>}
      {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

      {!loading && (
        <>
          <div className="adm-card" style={{ padding: 0 }}>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Action</th>
                    <th style={{ width: 130 }}>Entity</th>
                    <th>Name / ID</th>
                    <th style={{ width: 100 }}>Admin</th>
                    <th>Details</th>
                    <th style={{ width: 160 }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>
                        No log entries matching the current filters.
                      </td>
                    </tr>
                  ) : logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                          color: ACTION_COLOR[log.action] ?? 'var(--adm-text)',
                        }}>
                          {ACTION_ICON[log.action] ?? '•'} {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>
                        {ENTITY_LABELS[log.entity_type] ?? log.entity_type}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{log.entity_name || '—'}</div>
                        {log.entity_id && (
                          <div style={{ fontSize: 11, color: 'var(--adm-text-dim)', marginTop: 1 }}>
                            ID: {log.entity_id}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{log.admin_user}</td>
                      <td style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>{log.details || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--adm-text-dim)', whiteSpace: 'nowrap' }}>
                        {fmtDate(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
              <button
                className="adm-btn adm-btn-ghost adm-btn-sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>
                Page {page + 1} / {totalPages}
              </span>
              <button
                className="adm-btn adm-btn-ghost adm-btn-sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
