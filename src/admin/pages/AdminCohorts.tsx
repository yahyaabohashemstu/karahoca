import React, { useState } from 'react';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';

/**
 * Cohort retention dashboard (Phase G3).
 *
 * Triangular table: each row is a cohort of visitors (defined by the
 * week or month of their first event); each column is "n buckets
 * after the cohort started" with the retention % as the cell value.
 *
 * Heatmap colouring scales each cell against the cohort's own size —
 * the leftmost column is always 100% (everyone is "retained" in their
 * own cohort) so we use it as the visual baseline rather than an
 * arbitrary global max. That keeps small cohorts readable next to
 * big ones.
 */

const LANGS = [
  { code: '',   label: 'All languages' },
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ru', label: 'Русский' },
];

/**
 * Pick a background colour for a retention cell. Hue is fixed (the
 * brand blue); the alpha encodes magnitude so the matrix reads as a
 * heatmap without dragging in a colour library. Cells with pct=0
 * stay transparent so the empty future of recent cohorts looks empty
 * rather than just "deeply blue and confusing."
 */
const cellBg = (pct: number) => {
  if (pct <= 0) return 'transparent';
  // Map 0–100 → alpha 0.05–0.85 with a touch of curve so 10-20% range
  // is already visible.
  const alpha = Math.min(0.85, 0.05 + Math.sqrt(pct / 100) * 0.8);
  return `rgba(79, 110, 247, ${alpha.toFixed(2)})`;
};

export const AdminCohorts: React.FC = () => {
  const [bucket, setBucket] = useState<'week' | 'month'>('week');
  const [periods, setPeriods] = useState(8);
  const [lang, setLang] = useState('');

  const { data, loading, error } = useAsync(
    () => adminApi.getCohorts({ bucket, periods, lang: lang || undefined }),
    [bucket, periods, lang],
  );

  const cohorts = data?.cohorts ?? [];

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Cohort retention</h1>
          <p className="adm-page-subtitle">
            How many visitors from each cohort come back in the {bucket}s that follow.
            Hover a cell to see absolute counts.
          </p>
        </div>
      </div>

      <div
        className="adm-card"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>Bucket</span>
          <select
            className="adm-input adm-input-sm"
            value={bucket}
            onChange={(e) => setBucket(e.target.value === 'month' ? 'month' : 'week')}
            style={{ width: 110 }}
          >
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>Periods</span>
          <select
            className="adm-input adm-input-sm"
            value={periods}
            onChange={(e) => setPeriods(Number(e.target.value))}
            style={{ width: 90 }}
          >
            {[4, 6, 8, 12, 16, 24].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>Language</span>
          <select
            className="adm-input adm-input-sm"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            style={{ width: 160 }}
          >
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </label>
      </div>

      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> Loading…</div>}
      {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

      {!loading && !error && (
        <div className="adm-card" style={{ padding: 0, overflow: 'auto' }}>
          {cohorts.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--adm-text-dim)' }}>
              No cohorts found in this window.
            </div>
          ) : (
            <table className="adm-table" style={{ minWidth: 'max-content' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--adm-surface)', minWidth: 130, zIndex: 1 }}>
                    Cohort
                  </th>
                  <th style={{ minWidth: 60 }}>Size</th>
                  {Array.from({ length: periods }, (_, p) => (
                    <th key={p} style={{ textAlign: 'center', minWidth: 70 }}>
                      {bucket === 'week' ? `W+${p}` : `M+${p}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.cohort}>
                    <td style={{
                      position: 'sticky',
                      left: 0,
                      background: 'var(--adm-surface)',
                      fontWeight: 600,
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                      zIndex: 1,
                    }}>
                      {c.cohort}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>{c.size}</td>
                    {c.retention.map((r) => (
                      <td
                        key={r.period}
                        title={`${r.returners} of ${c.size} returned in ${r.label}`}
                        style={{
                          textAlign: 'center',
                          fontSize: 12,
                          fontWeight: 600,
                          background: cellBg(r.pct),
                          color: r.pct >= 50 ? '#fff' : 'inherit',
                        }}
                      >
                        {r.pct > 0 ? `${r.pct}%` : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
