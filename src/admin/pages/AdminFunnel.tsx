import React, { useState } from 'react';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';

/**
 * Conversion funnel + search-terms dashboard (Phase G1 + G2).
 *
 * The funnel shows unique visitors at each step of the canonical
 * KARAHOCA path (page_view → product_view → chat_open →
 * chat_message_sent → whatsapp_click) and the per-step drop-off, so
 * the team can see EXACTLY where the conversion leaks happen.
 *
 * The search-terms block is the sister G2 panel — top normalised
 * queries from `search_query` events. Picking these up here means an
 * admin filtering the funnel by "last 7 days, Russian visitors" sees
 * the search terms ALSO scoped to that audience.
 */

const LANGS = [
  { code: '',   label: 'All languages' },
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ru', label: 'Русский' },
];

const PRESET_RANGES = [
  { key: '7d',  label: 'Last 7 days',  days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
];

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const presetRange = (days: number) => {
  const to = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return { from: isoDate(from), to: isoDate(to) };
};

export const AdminFunnel: React.FC = () => {
  const [{ from, to }, setRange] = useState(() => presetRange(30));
  const [activePreset, setActivePreset] = useState<string>('30d');
  const [lang, setLang] = useState('');

  const { data, loading, error } = useAsync(
    () => adminApi.getFunnel({ from, to, lang: lang || undefined }),
    [from, to, lang],
  );

  const funnel = data?.funnel ?? [];
  const searchTerms = data?.searchTerms ?? [];
  const peak = funnel.length > 0 ? funnel[0].visitors : 0;

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Conversion Funnel</h1>
          <p className="adm-page-subtitle">
            Unique visitors at every step of the KARAHOCA conversion path,
            plus the most common search terms over the same window.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        className="adm-card"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PRESET_RANGES.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`adm-btn adm-btn-sm ${activePreset === p.key ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
              onClick={() => { setActivePreset(p.key); setRange(presetRange(p.days)); }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>From</span>
          <input
            type="date"
            className="adm-input adm-input-sm"
            value={from}
            onChange={(e) => { setActivePreset('custom'); setRange((r) => ({ ...r, from: e.target.value })); }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>To</span>
          <input
            type="date"
            className="adm-input adm-input-sm"
            value={to}
            onChange={(e) => { setActivePreset('custom'); setRange((r) => ({ ...r, to: e.target.value })); }}
          />
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
        <>
          <div className="adm-card" style={{ marginBottom: 16 }}>
            <div className="adm-card-title">Funnel</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {funnel.length === 0 ? (
                <div style={{ color: 'var(--adm-text-dim)', fontSize: 13 }}>
                  No events recorded in this window. Try a wider date range.
                </div>
              ) : funnel.map((step, idx) => {
                const widthPct = peak > 0 ? Math.max(2, Math.round((step.visitors / peak) * 100)) : 0;
                return (
                  <div key={step.key} style={{ position: 'relative' }}>
                    <div
                      style={{
                        height: 56,
                        background: 'linear-gradient(90deg, rgba(79, 110, 247, 0.18), rgba(79, 110, 247, 0.04))',
                        borderLeft: '3px solid #4f6ef7',
                        borderRadius: 6,
                        width: `${widthPct}%`,
                        minWidth: 200,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 14px',
                        gap: 12,
                        transition: 'width 0.4s ease',
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{step.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{step.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>
                          {step.visitors.toLocaleString()} unique visitors • {step.conversionFromStart}% of top
                        </div>
                      </div>
                      {idx > 0 && step.dropFromPrev > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap' }}>
                          –{step.dropFromPrev}% drop
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="adm-card">
            <div className="adm-card-title">Top search terms</div>
            <p style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginTop: 4, marginBottom: 12 }}>
              Normalised (whitespace + case) so "  منظف " and "منظف  " roll up together.
              Filtered to terms of 2+ characters.
            </p>
            {searchTerms.length === 0 ? (
              <div style={{ color: 'var(--adm-text-dim)', fontSize: 13 }}>
                No search activity in this window — or the SPA isn't emitting <code>search_query</code> events yet for the
                search inputs you care about.
              </div>
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>#</th>
                      <th>Term</th>
                      <th style={{ width: 100 }}>Hits</th>
                      <th style={{ width: 100 }}>Top lang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchTerms.map((s, idx) => (
                      <tr key={s.term}>
                        <td style={{ color: 'var(--adm-text-dim)', fontSize: 12 }}>{idx + 1}</td>
                        <td>
                          <span dir="auto" style={{ fontSize: 14 }}>{s.term}</span>
                        </td>
                        <td><strong>{s.count.toLocaleString()}</strong></td>
                        <td>
                          <span className="adm-badge adm-badge-blue" style={{ fontSize: 11 }}>
                            {s.topLang || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
