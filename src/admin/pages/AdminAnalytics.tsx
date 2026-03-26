import React, { useState } from 'react';
import { adminApi, type AdminAnalytics, type GaData } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate } from '../utils/dateUtils';

// ── Format helpers ─────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(1)}K`
  : String(n);

const fmtDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const COUNTRY_FLAG: Record<string, string> = {
  'Turkey': '🇹🇷', 'Türkiye': '🇹🇷', 'United States': '🇺🇸', 'Saudi Arabia': '🇸🇦',
  'Germany': '🇩🇪', 'France': '🇫🇷', 'United Kingdom': '🇬🇧', 'UAE': '🇦🇪',
  'Russia': '🇷🇺', 'Iraq': '🇮🇶', 'Egypt': '🇪🇬', 'Jordan': '🇯🇴',
  'Kuwait': '🇰🇼', 'Qatar': '🇶🇦', 'Netherlands': '🇳🇱', 'Spain': '🇪🇸',
  'Italy': '🇮🇹', 'Canada': '🇨🇦', 'Australia': '🇦🇺', 'Brazil': '🇧🇷',
  'Iceland': '🇮🇸', 'Ireland': '🇮🇪',
};

const SOURCE_COLOR: Record<string, string> = {
  'Organic Search': '#22c55e', 'Direct': '#4f6ef7', 'Referral': '#f59e0b',
  'Organic Social': '#ec4899', 'Email': '#06b6d4', 'Paid Search': '#f97316',
  'Display': '#8b5cf6', 'Unassigned': '#6b7280',
};
const SOURCE_ICON: Record<string, string> = {
  'Organic Search': '🔍', 'Direct': '🔗', 'Referral': '↗️',
  'Organic Social': '📲', 'Email': '📧', 'Paid Search': '💰',
  'Display': '🖼️', 'Unassigned': '❓',
};
const DEVICE_COLOR: Record<string, string> = {
  mobile: '#4f6ef7', desktop: '#22c55e', tablet: '#f59e0b',
};
const DEVICE_ICON: Record<string, string> = {
  mobile: '📱', desktop: '🖥️', tablet: '📟',
};

// ── Sessions Sparkline ─────────────────────────────────────────────────────────
const SessionsChart: React.FC<{ data: Array<{ date: string; sessions: number; users: number }> }> = ({ data }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!data.length) return <p style={{ color: 'var(--adm-text-muted)', fontSize: 13 }}>No data yet.</p>;
  const max = Math.max(...data.map(d => d.sessions), 1);
  const totalSessions = data.reduce((s, d) => s + d.sessions, 0);

  return (
    <div>
      {/* Bar chart */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140, padding: '0 4px', position: 'relative' }}>
        {data.map((d, i) => {
          const h = Math.max(4, (d.sessions / max) * 130);
          const isH = hovered === i;
          return (
            <div
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', cursor: 'default', position: 'relative' }}
            >
              {isH && (
                <div style={{
                  position: 'absolute', bottom: h + 8, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--adm-surface2)', border: '1px solid var(--adm-border)',
                  borderRadius: 6, padding: '5px 10px', fontSize: 11, whiteSpace: 'nowrap',
                  zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--adm-accent)' }}>{d.sessions} sessions</div>
                  <div style={{ color: 'var(--adm-text-muted)', marginTop: 1 }}>{d.users} users · {d.date}</div>
                </div>
              )}
              <div style={{
                width: '100%', height: h,
                background: isH
                  ? 'linear-gradient(180deg, #6b84ff, #4f6ef7)'
                  : 'linear-gradient(180deg, rgba(79,110,247,0.7), rgba(79,110,247,0.3))',
                borderRadius: '4px 4px 0 0',
                transition: 'all 0.15s ease',
                minWidth: 3,
              }} />
            </div>
          );
        })}
      </div>
      {/* X-axis */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--adm-text-dim)', padding: '0 4px' }}>
        <span>{data[0]?.date}</span>
        <span style={{ color: 'var(--adm-text-muted)' }}>
          {totalSessions.toLocaleString()} total sessions in 30 days
        </span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
};

// ── Donut chart (devices) ──────────────────────────────────────────────────────
const DonutChart: React.FC<{ items: Array<{ device: string; sessions: number }> }> = ({ items }) => {
  const total = items.reduce((s, i) => s + i.sessions, 0);
  if (!total) return null;
  let offset = 0;
  const r = 52, cx = 64, cy = 64, circumference = 2 * Math.PI * r;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg width={128} height={128} viewBox="0 0 128 128" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--adm-surface2)" strokeWidth={16} />
        {items.map((item, i) => {
          const pct = item.sessions / total;
          const dash = pct * circumference;
          const gap  = circumference - dash;
          const color = DEVICE_COLOR[item.device.toLowerCase()] ?? '#6b7280';
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={color} strokeWidth={16}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset * circumference}
              style={{ transition: 'stroke-dasharray 0.5s ease', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
          );
          offset += pct;
          return el;
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--adm-text)" fontSize={18} fontWeight={700}>{fmt(total)}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--adm-text-muted)" fontSize={10}>sessions</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, i) => {
          const pct = Math.round((item.sessions / total) * 100);
          const color = DEVICE_COLOR[item.device.toLowerCase()] ?? '#6b7280';
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{DEVICE_ICON[item.device.toLowerCase()] ?? '💻'}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--adm-text)', textTransform: 'capitalize' }}>{item.device}</div>
                <div style={{ fontSize: 11, color }}>
                  {pct}% · {item.sessions.toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Horizontal bar row ─────────────────────────────────────────────────────────
const HRow: React.FC<{ label: string; value: number; max: number; color: string; icon?: string; rank?: number }> = ({
  label, value, max, color, icon, rank,
}) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {rank !== undefined && (
            <span style={{ fontSize: 11, color: 'var(--adm-text-dim)', width: 16, textAlign: 'right', flexShrink: 0 }}>#{rank}</span>
          )}
          {icon && <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>}
          <span style={{ fontSize: 13, color: 'var(--adm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color, flexShrink: 0, marginLeft: 12 }}>{value.toLocaleString()}</span>
      </div>
      <div style={{ height: 5, background: 'var(--adm-surface2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
};

// ── KPI Metric Card ────────────────────────────────────────────────────────────
const MetricCard: React.FC<{
  icon: string; label: string; value: string; sub?: string;
  gradient: string; border: string;
}> = ({ icon, label, value, sub, gradient, border }) => (
  <div style={{
    background: gradient,
    border: `1px solid ${border}`,
    borderRadius: 14,
    padding: '20px 22px',
    position: 'relative',
    overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', top: -20, right: -16, fontSize: 80, opacity: 0.07, lineHeight: 1 }}>{icon}</div>
    <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--adm-text-muted)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--adm-text)', lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--adm-text-dim)', marginTop: 5 }}>{sub}</div>}
  </div>
);

// ── Section card ───────────────────────────────────────────────────────────────
const SCard: React.FC<{ title: string; icon: string; children: React.ReactNode; accent?: string }> = ({
  title, icon, children, accent = 'var(--adm-accent)',
}) => (
  <div style={{
    background: 'var(--adm-surface)',
    border: '1px solid var(--adm-border)',
    borderRadius: 14,
    padding: '20px 22px',
    borderTop: `3px solid ${accent}`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--adm-text-muted)' }}>{title}</span>
    </div>
    {children}
  </div>
);

// ── Setup Guide ────────────────────────────────────────────────────────────────
const SetupGuide: React.FC<{ steps: string[] }> = ({ steps }) => (
  <div style={{
    background: 'linear-gradient(135deg, rgba(245,166,35,0.08), transparent)',
    border: '1px solid rgba(245,166,35,0.3)',
    borderRadius: 14, padding: 24, marginBottom: 24,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span style={{ fontSize: 22 }}>⚙️</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--adm-text)' }}>Google Analytics 4 — Setup Required</div>
        <div style={{ fontSize: 12, color: 'var(--adm-text-muted)', marginTop: 2 }}>Follow these steps to connect your GA4 property</div>
      </div>
    </div>
    <ol style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {steps.map((s, i) => (
        <li key={i} style={{ fontSize: 13, color: 'var(--adm-text-muted)', lineHeight: 1.6 }}>{s}</li>
      ))}
    </ol>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────
export const AdminAnalytics: React.FC = () => {
  const internal = useAsync<AdminAnalytics>(() => adminApi.getAnalytics(), []);
  const ga       = useAsync<GaData>(() => adminApi.getGaData(), []);
  const gad      = ga.data;
  const s        = internal.data?.summary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--adm-text)', letterSpacing: -0.5 }}>Analytics</h1>
          <p style={{ color: 'var(--adm-text-muted)', fontSize: 13, marginTop: 3 }}>
            Real-time insights from Google Analytics 4 + internal bot statistics
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--adm-surface)', border: '1px solid var(--adm-border)',
          borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--adm-text-muted)',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: gad?.configured ? '#22c55e' : '#f59e0b', flexShrink: 0, boxShadow: gad?.configured ? '0 0 6px #22c55e' : 'none' }} />
          {gad?.configured ? 'GA4 Connected' : 'GA4 Not configured'}
        </div>
      </div>

      {/* ── GA Loading ────────────────────────────────────────────────── */}
      {ga.loading && (
        <div style={{ background: 'var(--adm-surface)', border: '1px solid var(--adm-border)', borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <span className="adm-spinner" style={{ width: 28, height: 28 }} />
          <p style={{ color: 'var(--adm-text-muted)', marginTop: 12, fontSize: 13 }}>Loading Google Analytics data…</p>
        </div>
      )}

      {/* ── GA Error ──────────────────────────────────────────────────── */}
      {!ga.loading && ga.error && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(224,82,82,0.08), transparent)',
          border: '1px solid rgba(224,82,82,0.3)',
          borderRadius: 14, padding: 20,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: '#e05252', marginBottom: 4 }}>GA4 API Error</div>
              <div style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>{ga.error}</div>
              <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginTop: 6 }}>
                Make sure the service account email is added as Viewer in GA4 → Admin → Property Access Management
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Setup guide ───────────────────────────────────────────────── */}
      {!ga.loading && gad && !gad.configured && gad.steps && <SetupGuide steps={gad.steps} />}

      {/* ══════════════════════════════════════════════════════════════
          GA4 DATA SECTION
      ══════════════════════════════════════════════════════════════ */}
      {gad?.configured && gad.summary && (() => {
        const sm = gad.summary;
        return (
          <>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              <MetricCard icon="🔗" label="Sessions"       value={fmt(sm.sessions)}       gradient="linear-gradient(135deg,rgba(79,110,247,0.15),rgba(79,110,247,0.04))"  border="rgba(79,110,247,0.3)" />
              <MetricCard icon="🟢" label="Active Users"   value={fmt(sm.activeUsers)}    gradient="linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.04))"    border="rgba(34,197,94,0.3)"  />
              <MetricCard icon="✨" label="New Users"      value={fmt(sm.newUsers)}       gradient="linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.04))"  border="rgba(245,158,11,0.3)" />
              <MetricCard icon="📄" label="Page Views"     value={fmt(sm.pageViews)}      gradient="linear-gradient(135deg,rgba(139,92,246,0.15),rgba(139,92,246,0.04))"  border="rgba(139,92,246,0.3)" />
              <MetricCard icon="↩️" label="Bounce Rate"   value={`${sm.bounceRate}%`}    gradient="linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.04))"    border="rgba(239,68,68,0.25)" />
              <MetricCard icon="⏱️" label="Avg Session"   value={fmtDuration(sm.avgSessionDuration)} sub="per session" gradient="linear-gradient(135deg,rgba(6,182,212,0.12),rgba(6,182,212,0.04))" border="rgba(6,182,212,0.25)" />
            </div>

            {/* Sessions chart */}
            {(gad.byDay?.length ?? 0) > 0 && (
              <SCard title="Sessions / Day — Last 30 Days" icon="📈">
                <SessionsChart data={gad.byDay!} />
              </SCard>
            )}

            {/* 3-column grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>

              {/* Countries */}
              <SCard title="Top Countries" icon="🌍" accent="#4f6ef7">
                {(gad.byCountry ?? []).map((r, i) => (
                  <HRow key={i} rank={i + 1}
                    label={r.country}
                    icon={COUNTRY_FLAG[r.country] ?? '🌐'}
                    value={r.sessions}
                    max={gad.byCountry![0]?.sessions ?? 1}
                    color="#4f6ef7"
                  />
                ))}
              </SCard>

              {/* Devices */}
              <SCard title="Devices" icon="📱" accent="#8b5cf6">
                <DonutChart items={gad.byDevice ?? []} />
              </SCard>

              {/* Sources */}
              <SCard title="Traffic Sources" icon="🔀" accent="#f59e0b">
                {(gad.bySource ?? []).map((r, i) => (
                  <HRow key={i}
                    label={r.source}
                    icon={SOURCE_ICON[r.source] ?? '🌐'}
                    value={r.sessions}
                    max={gad.bySource![0]?.sessions ?? 1}
                    color={SOURCE_COLOR[r.source] ?? '#6b7280'}
                  />
                ))}
              </SCard>
            </div>

            {/* Top pages */}
            {(gad.byPage?.length ?? 0) > 0 && (
              <SCard title="Top Pages" icon="📑" accent="#22c55e">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0 32px' }}>
                  {gad.byPage!.map((r, i) => (
                    <HRow key={i} rank={i + 1}
                      label={r.page}
                      value={r.views}
                      max={gad.byPage![0]?.views ?? 1}
                      color="#22c55e"
                    />
                  ))}
                </div>
              </SCard>
            )}
          </>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════
          INTERNAL STATS SECTION
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        borderTop: '1px solid var(--adm-border)', paddingTop: 20, marginTop: 4,
      }}>
        <span style={{ fontSize: 16 }}>💬</span>
        <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--adm-text-muted)' }}>
          Internal Stats — Bot & Newsletter
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--adm-border)' }} />
      </div>

      {internal.loading && (
        <div style={{ textAlign: 'center', padding: 24 }}><span className="adm-spinner" /></div>
      )}
      {internal.error && (
        <div className="adm-alert adm-alert-error">⚠ {internal.error}</div>
      )}

      {s && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            { icon: '💬', label: 'Messages',      value: s.total_messages,    g: 'rgba(79,110,247,0.12)',  b: 'rgba(79,110,247,0.25)' },
            { icon: '👤', label: 'Chat Users',    value: s.total_users,       g: 'rgba(34,197,94,0.1)',   b: 'rgba(34,197,94,0.25)'  },
            { icon: '✉️', label: 'Subscribers',   value: s.total_subscribers, g: 'rgba(6,182,212,0.1)',   b: 'rgba(6,182,212,0.25)'  },
            { icon: '📰', label: 'News Articles', value: s.total_news,        g: 'rgba(245,158,11,0.1)',  b: 'rgba(245,158,11,0.25)' },
            { icon: '🧴', label: 'Products',      value: s.total_products,    g: 'rgba(139,92,246,0.1)',  b: 'rgba(139,92,246,0.25)' },
          ].map(item => (
            <MetricCard key={item.label} icon={item.icon} label={item.label}
              value={String(item.value)} gradient={`linear-gradient(135deg,${item.g},transparent)`}
              border={item.b}
            />
          ))}
        </div>
      )}

      {internal.data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

            {/* Chat per day */}
            <SCard title="Chat Messages / Day" icon="💬" accent="#4f6ef7">
              {!(internal.data.chatPerDay?.length)
                ? <p style={{ color: 'var(--adm-text-dim)', fontSize: 13 }}>No data yet.</p>
                : <SessionsChart data={internal.data.chatPerDay.map(d => ({ date: d.date, sessions: d.count, users: 0 }))} />
              }
            </SCard>

            {/* Newsletter per day */}
            <SCard title="Newsletter Signups / Day" icon="✉️" accent="#22c55e">
              {!(internal.data.newsletterPerDay?.length)
                ? <p style={{ color: 'var(--adm-text-dim)', fontSize: 13 }}>No data yet.</p>
                : <SessionsChart data={internal.data.newsletterPerDay.map(d => ({ date: d.date, sessions: d.count, users: 0 }))} />
              }
            </SCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

            {/* Language distribution */}
            <SCard title="Chat Language Distribution" icon="🌐" accent="#8b5cf6">
              {!(internal.data.langDistribution?.length)
                ? <p style={{ color: 'var(--adm-text-dim)', fontSize: 13 }}>No data yet.</p>
                : (() => {
                    const total = internal.data.langDistribution.reduce((s, i) => s + i.count, 0);
                    const LANG_COLORS = ['#4f6ef7', '#22c55e', '#f59e0b', '#ec4899'];
                    return internal.data.langDistribution.map((d, i) => (
                      <HRow key={d.language}
                        label={`${d.language.toUpperCase()}  (${Math.round((d.count / total) * 100)}%)`}
                        value={d.count} max={total}
                        color={LANG_COLORS[i % LANG_COLORS.length]}
                      />
                    ));
                  })()
              }
            </SCard>

            {/* Top users */}
            <SCard title="Most Active Users" icon="🔥" accent="#f59e0b">
              {!(internal.data.topUsers?.length)
                ? <p style={{ color: 'var(--adm-text-dim)', fontSize: 13 }}>No users yet.</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {internal.data.topUsers.map((u, i) => (
                      <div key={u.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'var(--adm-surface2)', borderRadius: 10, padding: '10px 14px',
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: `linear-gradient(135deg, hsl(${(i * 60 + 200) % 360}, 70%, 55%), hsl(${(i * 60 + 240) % 360}, 70%, 45%))`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700, color: '#fff',
                        }}>{i + 1}</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 11, color: 'var(--adm-text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.id.slice(0, 20)}…
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--adm-text-dim)', marginTop: 2 }}>
                            Last seen: {fmtDate(u.last_seen)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--adm-text)' }}>{u.message_count}</div>
                          <div style={{ fontSize: 10, color: 'var(--adm-text-dim)' }}>msgs</div>
                        </div>
                        <span className="adm-badge adm-badge-blue" style={{ flexShrink: 0 }}>{u.language}</span>
                      </div>
                    ))}
                  </div>
                )}
            </SCard>
          </div>
        </>
      )}
    </div>
  );
};
