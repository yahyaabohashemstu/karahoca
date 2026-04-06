import React, { useState } from 'react';
import { adminApi, type AuditLogEntry } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';

const ACTION_COLOR: Record<string, string> = {
  CREATE: '#22c55e',
  UPDATE: '#4f6ef7',
  DELETE: '#ef4444',
  SEND:   '#f59e0b',
};

const ACTION_ICON: Record<string, string> = {
  CREATE: '➕',
  UPDATE: '✏️',
  DELETE: '🗑️',
  SEND:   '📧',
};

const ENTITY_LABELS: Record<string, string> = {
  product:  '🧴 Product',
  news:     '📰 News',
  campaign: '📧 Campaign',
};

const PAGE_SIZE = 50;

export const AdminAuditLog: React.FC = () => {
  const [page, setPage] = useState(0);
  const [entityFilter, setEntityFilter] = useState('');

  const { data, loading, error } = useAsync(
    () => adminApi.getAuditLog({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, entity: entityFilter || undefined }),
    [page, entityFilter]
  );

  const logs: AuditLogEntry[] = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Audit Log</h1>
          <p className="adm-page-subtitle">All admin create / update / delete / send operations — {total} total entries</p>
        </div>
        <select
          className="adm-input adm-input-sm"
          value={entityFilter}
          onChange={e => { setEntityFilter(e.target.value); setPage(0); }}
          style={{ width: 160 }}
        >
          <option value="">All entities</option>
          <option value="product">Products</option>
          <option value="news">News</option>
          <option value="campaign">Campaigns</option>
        </select>
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
                    <th style={{ width: 90 }}>Action</th>
                    <th style={{ width: 100 }}>Entity</th>
                    <th>Name / ID</th>
                    <th style={{ width: 80 }}>Admin</th>
                    <th>Details</th>
                    <th style={{ width: 160 }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>No log entries yet.</td></tr>
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
                onClick={() => setPage(p => p - 1)}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>
                Page {page + 1} / {totalPages}
              </span>
              <button
                className="adm-btn adm-btn-ghost adm-btn-sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
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
