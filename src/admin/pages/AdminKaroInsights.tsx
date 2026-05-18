import React, { useMemo, useState } from 'react';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';

/**
 * Karo Insights — first-party analytics dashboard for the AI chat.
 *
 * Answers the six questions the operator most often has, in one
 * pane, without leaving the admin:
 *
 *   1. How many chats / messages / unique visitors in the period?
 *   2. Where do my visitors come from (country) and what language do
 *      they chat in?
 *   3. Which products are they asking Karo about?
 *   4. Which follow-up chips get tapped (so I know which curated
 *      suggestions are actually working)?
 *   5. What percent of chat openers end up clicking through to
 *      WhatsApp?
 *   6. How many conversations dropped off (visitor sent a question
 *      Karo didn't answer)?
 *
 * Implementation notes:
 *   - One server fetch hydrates every section (see
 *     server/routes/admin-karo-insights.mjs). No per-table cascade.
 *   - Date range is a simple "last N days" preset; the UI exposes 7
 *     / 30 / 90 / custom. The custom path takes ISO yyyy-mm-dd from
 *     two date inputs so timezone confusion is impossible.
 *   - All counts come back as plain numbers — no NaN guards needed
 *     in the rendering code.
 */

// Style tokens — kept inline so the page reads top-to-bottom without
// jumping to a separate CSS module. Mirrors the muted-glass aesthetic
// the existing admin pages use.
const s = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '16px 18px',
  } as React.CSSProperties,
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
    marginBottom: 18,
  } as React.CSSProperties,
  kpiLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 } as React.CSSProperties,
  kpiValue: { fontSize: 24, fontWeight: 800 } as React.CSSProperties,
  kpiSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 } as React.CSSProperties,
  sectionTitle: { margin: '24px 0 10px', fontSize: 16, fontWeight: 700 } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 } as React.CSSProperties,
  th: {
    textAlign: 'start',
    padding: '8px 10px',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.55)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  } as React.CSSProperties,
  td: { padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' } as React.CSSProperties,
  empty: { textAlign: 'center', padding: 28, color: 'rgba(255,255,255,0.4)' } as React.CSSProperties,
  rangePicker: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 } as React.CSSProperties,
  rangeBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#fff',
    padding: '6px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
  } as React.CSSProperties,
  rangeBtnActive: { background: 'rgba(245,75,26,0.18)', borderColor: '#F54B1A' } as React.CSSProperties,
};

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
  : String(n);

const isoDaysAgo = (days: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

type PresetKey = '7' | '30' | '90' | 'custom';

export const AdminKaroInsights: React.FC = () => {
  const [preset, setPreset] = useState<PresetKey>('30');
  const [customFrom, setCustomFrom] = useState<string>(isoDaysAgo(30));
  const [customTo, setCustomTo] = useState<string>(todayIso());

  const range = useMemo(() => {
    if (preset === 'custom') return { from: customFrom, to: customTo };
    const days = Number(preset);
    return { from: isoDaysAgo(days), to: todayIso() };
  }, [preset, customFrom, customTo]);

  const { data, loading, error } = useAsync(
    () => adminApi.getKaroInsights(range),
    [range.from, range.to],
  );

  const kpi = data?.kpi;

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22 }}>🤖 Karo Insights</h1>

      {/* Range picker */}
      <div style={s.rangePicker}>
        {(['7', '30', '90', 'custom'] as PresetKey[]).map((p) => (
          <button
            key={p}
            type="button"
            style={{
              ...s.rangeBtn,
              ...(preset === p ? s.rangeBtnActive : {}),
            }}
            onClick={() => setPreset(p)}
          >
            {p === 'custom' ? 'Custom' : `Last ${p} days`}
          </button>
        ))}
        {preset === 'custom' && (
          <>
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{ ...s.rangeBtn, padding: '6px 10px' }}
            />
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>→</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={todayIso()}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{ ...s.rangeBtn, padding: '6px 10px' }}
            />
          </>
        )}
      </div>

      {loading && <p style={{ color: 'rgba(255,255,255,0.55)' }}>Loading insights…</p>}
      {error && (
        <p style={{ color: '#f87171' }}>Failed to load insights: {String(error)}</p>
      )}

      {data && (
        <>
          {/* KPI tiles */}
          <div style={s.kpiGrid}>
            <Kpi label="Unique visitors" value={fmt(kpi?.uniqueVisitors || 0)} sub="Distinct browsers" />
            <Kpi label="Chat opens" value={fmt(kpi?.chatOpens || 0)} sub="Including re-opens" />
            <Kpi label="Total messages" value={fmt(kpi?.totalMessages || 0)} sub={`${fmt(kpi?.userMessages || 0)} user · ${fmt(kpi?.assistantMessages || 0)} Karo`} />
            <Kpi label="Avg msgs / convo" value={String(kpi?.avgMessagesPerConvo || 0)} sub="Per unique visitor" />
            <Kpi label="WhatsApp CTR" value={`${kpi?.whatsappCtr || 0}%`} sub="of chat openers" />
            <Kpi label="Dropped convos" value={fmt(kpi?.droppedConversations || 0)} sub="Visitor turn without a reply" />
          </div>

          {/* Two-column layout for the distribution tables */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <Section title="🌍 Top countries">
              {data.byCountry.length === 0 ? <p style={s.empty}>No data yet.</p> : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Country</th>
                      <th style={{ ...s.th, textAlign: 'end' }}>Chats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCountry.map((row) => (
                      <tr key={row.country}>
                        <td style={s.td}>{row.country}</td>
                        <td style={{ ...s.td, textAlign: 'end' }}>{fmt(row.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title="🗣 Language distribution">
              {data.byLang.length === 0 ? <p style={s.empty}>No data yet.</p> : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Lang</th>
                      <th style={{ ...s.th, textAlign: 'end' }}>Chats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byLang.map((row) => (
                      <tr key={row.lang}>
                        <td style={s.td}>{row.lang.toUpperCase()}</td>
                        <td style={{ ...s.td, textAlign: 'end' }}>{fmt(row.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title="📦 Top products asked about">
              {data.topProducts.length === 0 ? <p style={s.empty}>No product events yet.</p> : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Product</th>
                      <th style={{ ...s.th, textAlign: 'end' }}>Hits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((row) => (
                      <tr key={row.product_id}>
                        <td style={s.td}>
                          <code style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)' }}>{row.product_id}</code>
                        </td>
                        <td style={{ ...s.td, textAlign: 'end' }}>{fmt(row.hits)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title="💬 Top follow-up chips">
              {data.topFollowupChips.length === 0 ? <p style={s.empty}>No chip taps yet.</p> : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Chip</th>
                      <th style={{ ...s.th, textAlign: 'end' }}>Taps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topFollowupChips.map((row, i) => (
                      <tr key={`${row.chip}-${i}`}>
                        <td style={s.td}>{row.chip || '(empty)'}</td>
                        <td style={{ ...s.td, textAlign: 'end' }}>{fmt(row.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          </div>

          {/* Sparkline-style daily volume */}
          <Section title="📈 Daily chat volume" style={{ marginTop: 14 }}>
            {data.byDay.length === 0 ? <p style={s.empty}>No chats in this range.</p> : (
              <DailyBars rows={data.byDay} />
            )}
          </Section>
        </>
      )}
    </div>
  );
};

interface KpiProps { label: string; value: string; sub: string; }
const Kpi: React.FC<KpiProps> = ({ label, value, sub }) => (
  <div style={s.card}>
    <div style={s.kpiLabel}>{label}</div>
    <div style={s.kpiValue}>{value}</div>
    <div style={s.kpiSub}>{sub}</div>
  </div>
);

interface SectionProps {
  title: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}
const Section: React.FC<SectionProps> = ({ title, style, children }) => (
  <div style={{ ...s.card, ...style }}>
    <h2 style={s.sectionTitle}>{title}</h2>
    {children}
  </div>
);

/**
 * Pure-CSS bar chart for the daily volume series. Avoids pulling in a
 * dedicated chart library for a single 30-bar visual.
 */
interface DailyBarsProps {
  rows: Array<{ day: string; unique_visitors: number; opens: number }>;
}
const DailyBars: React.FC<DailyBarsProps> = ({ rows }) => {
  const max = Math.max(1, ...rows.map((r) => r.opens));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, padding: '8px 0' }}>
      {rows.map((row) => {
        const heightPct = (row.opens / max) * 100;
        return (
          <div
            key={row.day}
            title={`${row.day}: ${row.opens} opens, ${row.unique_visitors} visitors`}
            style={{
              flex: 1,
              minWidth: 4,
              height: `${heightPct}%`,
              background: 'linear-gradient(180deg, #F54B1A 0%, rgba(245,75,26,0.4) 100%)',
              borderRadius: '3px 3px 0 0',
              transition: 'opacity 0.15s',
            }}
          />
        );
      })}
    </div>
  );
};
