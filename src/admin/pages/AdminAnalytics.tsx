import React, { useState } from 'react';
import { adminApi, type AdminAnalytics as AdminAnalyticsData, type GaData } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate } from '../utils/dateUtils';

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
  : String(n);

const fmtDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const COUNTRY_FLAG: Record<string, string> = {
  Turkey: '🇹🇷', Türkiye: '🇹🇷', 'United States': '🇺🇸', 'Saudi Arabia': '🇸🇦',
  Germany: '🇩🇪', France: '🇫🇷', 'United Kingdom': '🇬🇧', UAE: '🇦🇪',
  Russia: '🇷🇺', Iraq: '🇮🇶', Egypt: '🇪🇬', Jordan: '🇯🇴',
  Kuwait: '🇰🇼', Qatar: '🇶🇦', Netherlands: '🇳🇱', Spain: '🇪🇸',
  Italy: '🇮🇹', Canada: '🇨🇦', Australia: '🇦🇺', Brazil: '🇧🇷',
  Iceland: '🇮🇸', Ireland: '🇮🇪',
};

const SOURCE_COLOR: Record<string, string> = {
  'Organic Search': '#22c55e', Direct: '#4f6ef7', Referral: '#f59e0b',
  'Organic Social': '#ec4899', Email: '#06b6d4', 'Paid Search': '#f97316',
  Display: '#8b5cf6', Unassigned: '#6b7280',
};

const SOURCE_ICON: Record<string, string> = {
  'Organic Search': '🔍', Direct: '🔗', Referral: '↗️',
  'Organic Social': '📲', Email: '📧', 'Paid Search': '💰',
  Display: '🖼️', Unassigned: '❓',
};

const DEVICE_COLOR: Record<string, string> = {
  mobile: '#4f6ef7', desktop: '#22c55e', tablet: '#f59e0b',
};

const DEVICE_ICON: Record<string, string> = {
  mobile: '📱', desktop: '🖥️', tablet: '📟',
};

type TrendDatum = { label: string; value: number; helper?: string };

const TrendChart: React.FC<{
  id: string;
  data: TrendDatum[];
  accent: string;
  summary: string;
}> = ({ id, data, accent, summary }) => {
  if (!data.length) {
    return <div className="adm-analytics-empty">No data yet.</div>;
  }

  const width = 720;
  const height = 240;
  const padding = { top: 18, right: 18, bottom: 32, left: 18 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...data.map((item) => item.value), 1);
  const midpoint = Math.round(max / 2);
  const points = data.map((item, index) => {
    const x = padding.left + (chartWidth * index) / Math.max(data.length - 1, 1);
    const y = padding.top + chartHeight - (item.value / max) * chartHeight;
    return { ...item, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${['M', points[0].x, height - padding.bottom, 'L', ...points.flatMap((point) => [point.x, point.y]), 'L', points[points.length - 1].x, height - padding.bottom, 'Z'].join(' ')}`;
  const gradientId = `${id}-gradient`;

  return (
    <div className="adm-trend-chart">
      <div className="adm-trend-chart-stage">
        <div className="adm-trend-axis">
          <span>{fmt(max)}</span>
          <span>{fmt(midpoint)}</span>
          <span>0</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="adm-trend-svg" role="img" aria-label={summary}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {[0, 0.5, 1].map((step) => {
            const y = padding.top + chartHeight * step;
            return (
              <line
                key={step}
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="4 6"
              />
            );
          })}

          <path d={area} fill={`url(#${gradientId})`} />
          <polyline points={line} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => (
            <g key={index}>
              <circle cx={point.x} cy={point.y} r="5" fill={accent} fillOpacity="0.16" />
              <circle cx={point.x} cy={point.y} r="2.6" fill={accent} />
            </g>
          ))}
        </svg>
      </div>
      <div className="adm-trend-footer">
        <span>{data[0]?.label}</span>
        <span>{summary}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
};

const DonutChart: React.FC<{ items: Array<{ device: string; sessions: number }> }> = ({ items }) => {
  const total = items.reduce((sum, item) => sum + item.sessions, 0);
  if (!total) return <div className="adm-analytics-empty">No device data yet.</div>;

  let offset = 0;
  const radius = 56;
  const center = 72;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="adm-device-layout">
      <svg viewBox="0 0 144 144" className="adm-device-chart" aria-label="Device sessions">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="16" />
        {items.map((item, index) => {
          const portion = item.sessions / total;
          const dash = portion * circumference;
          const gap = circumference - dash;
          const color = DEVICE_COLOR[item.device.toLowerCase()] ?? '#6b7280';
          const circle = (
            <circle
              key={index}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="16"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset * circumference}
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
          );
          offset += portion;
          return circle;
        })}
        <text x={center} y={center - 4} textAnchor="middle" fill="var(--adm-text)" fontSize="22" fontWeight="700">{fmt(total)}</text>
        <text x={center} y={center + 18} textAnchor="middle" fill="var(--adm-text-muted)" fontSize="11">sessions</text>
      </svg>

      <div className="adm-device-legend">
        {items.map((item) => {
          const percentage = Math.round((item.sessions / total) * 100);
          const color = DEVICE_COLOR[item.device.toLowerCase()] ?? '#6b7280';
          return (
            <div key={item.device} className="adm-device-legend-item">
              <span className="adm-device-legend-icon">{DEVICE_ICON[item.device.toLowerCase()] ?? '💻'}</span>
              <div>
                <strong>{item.device}</strong>
                <span style={{ color }}>{percentage}% · {item.sessions.toLocaleString()} sessions</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RankingRow: React.FC<{
  label: string;
  value: number;
  max: number;
  color: string;
  icon?: string;
  rank?: number;
}> = ({ label, value, max, color, icon, rank }) => {
  const width = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="adm-ranking-row">
      <div className="adm-ranking-top">
        <div className="adm-ranking-label-wrap">
          {rank !== undefined && <span className="adm-ranking-rank">#{rank}</span>}
          {icon && <span className="adm-ranking-icon">{icon}</span>}
          <span className="adm-ranking-label">{label}</span>
        </div>
        <strong style={{ color }}>{value.toLocaleString()}</strong>
      </div>
      <div className="adm-ranking-track">
        <div className="adm-ranking-fill" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  icon: string;
  label: string;
  value: string;
  sub?: string;
  gradient: string;
  border: string;
}> = ({ icon, label, value, sub, gradient, border }) => (
  <div className="adm-analytics-metric-card" style={{ background: gradient, borderColor: border }}>
    <div className="adm-analytics-metric-icon">{icon}</div>
    <div className="adm-analytics-metric-label">{label}</div>
    <div className="adm-analytics-metric-value">{value}</div>
    {sub && <div className="adm-analytics-metric-sub">{sub}</div>}
  </div>
);

const Panel: React.FC<{
  title: string;
  icon: string;
  children: React.ReactNode;
  accent?: string;
  copy?: string;
  className?: string;
}> = ({ title, icon, children, accent = 'var(--adm-accent)', copy, className }) => (
  <section className={`adm-analytics-panel${className ? ` ${className}` : ''}`} style={{ borderTopColor: accent }}>
    <div className="adm-analytics-panel-head">
      <div>
        <div className="adm-card-title">{icon} {title}</div>
        {copy && <p className="adm-analytics-panel-copy">{copy}</p>}
      </div>
    </div>
    {children}
  </section>
);

const SetupGuide: React.FC<{ steps: string[] }> = ({ steps }) => (
  <div className="adm-analytics-rich-alert warning">
    <div className="adm-analytics-rich-alert-head">
      <span>⚙️</span>
      <div>
        <strong>Google Analytics 4 setup required</strong>
        <p>Complete the following steps to connect the property cleanly.</p>
      </div>
    </div>
    <ol className="adm-analytics-steps">
      {steps.map((step, index) => (
        <li key={index}>{step}</li>
      ))}
    </ol>
  </div>
);

const PERIOD_OPTIONS = [
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
];

export const AdminAnalytics: React.FC = () => {
  const [period, setPeriod] = useState(30);
  const internal = useAsync<AdminAnalyticsData>(() => adminApi.getAnalytics(period), [period]);
  const ga = useAsync<GaData>(() => adminApi.getGaData(), []);
  const gad = ga.data;
  const summary = internal.data?.summary;

  const handlePrint = () => window.print();

  const printDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="adm-analytics-page">

      {/* ── Print-only cover header (hidden on screen) ────────────────────── */}
      <div className="analytics-print-header">
        <div className="analytics-print-header-left">
          <div className="analytics-print-brand">KARAHOCA</div>
          <div className="analytics-print-tagline">Analytics Report</div>
        </div>
        <div className="analytics-print-header-right">
          <div className="analytics-print-date">Generated: {printDate}</div>
          <div className="analytics-print-period">Period: Last {period} days</div>
          <div className={`analytics-print-status ${gad?.configured ? 'connected' : 'disconnected'}`}>
            {gad?.configured ? '● GA4 Connected' : '○ GA4 Not Configured'}
          </div>
        </div>
      </div>

      <section className="adm-card adm-analytics-hero">
        <div>
          <span className="adm-dashboard-eyebrow">Performance Overview</span>
          <h1 className="adm-analytics-hero-title">Analytics</h1>
          <p className="adm-analytics-hero-text">
            A cleaner view of Google Analytics 4 plus internal bot and newsletter activity, organized for faster reading and comparison.
          </p>
        </div>
        <div className="adm-analytics-status-card">
          <div className="adm-analytics-status-dot" style={{ background: gad?.configured ? '#22c55e' : '#f59e0b' }} />
          <div>
            <strong>{gad?.configured ? 'GA4 connected' : 'GA4 not configured'}</strong>
            <span>{gad?.configured ? 'Traffic and device insights are available below.' : 'Add the property configuration to unlock reporting.'}</span>
          </div>
        </div>
      </section>

      {/* ── Controls toolbar ─────────────────────────────────────────────────── */}
      <div className="adm-analytics-toolbar">
        <div className="adm-analytics-period-selector">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.days}
              onClick={() => setPeriod(opt.days)}
              className={`adm-analytics-period-btn${period === opt.days ? ' active' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button className="adm-analytics-export-btn" onClick={handlePrint} title="Export as PDF">
          🖨️ Export PDF
        </button>
      </div>

      {ga.loading && <div className="adm-loading-center"><span className="adm-spinner" /> Loading Google Analytics data…</div>}

      {!ga.loading && ga.error && (
        <div className="adm-analytics-rich-alert error">
          <div className="adm-analytics-rich-alert-head">
            <span>⚠️</span>
            <div>
              <strong>GA4 API error</strong>
              <p>{ga.error}</p>
            </div>
          </div>
        </div>
      )}

      {!ga.loading && gad && !gad.configured && gad.steps && <SetupGuide steps={gad.steps} />}

      {gad?.configured && gad.summary && (() => {
        const sm = gad.summary;
        return (
          <>
            <div className="adm-analytics-kpi-grid">
              <MetricCard icon="🔗" label="Sessions" value={fmt(sm.sessions)} gradient="linear-gradient(135deg, rgba(79,110,247,0.18), rgba(79,110,247,0.05))" border="rgba(79,110,247,0.28)" />
              <MetricCard icon="🟢" label="Active Users" value={fmt(sm.activeUsers)} gradient="linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.05))" border="rgba(34,197,94,0.28)" />
              <MetricCard icon="✨" label="New Users" value={fmt(sm.newUsers)} gradient="linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.05))" border="rgba(245,158,11,0.28)" />
              <MetricCard icon="📄" label="Page Views" value={fmt(sm.pageViews)} gradient="linear-gradient(135deg, rgba(139,92,246,0.18), rgba(139,92,246,0.05))" border="rgba(139,92,246,0.28)" />
              <MetricCard icon="↩️" label="Bounce Rate" value={`${sm.bounceRate}%`} gradient="linear-gradient(135deg, rgba(239,68,68,0.16), rgba(239,68,68,0.05))" border="rgba(239,68,68,0.24)" />
              <MetricCard icon="⏱️" label="Avg Session" value={fmtDuration(sm.avgSessionDuration)} sub="per session" gradient="linear-gradient(135deg, rgba(6,182,212,0.16), rgba(6,182,212,0.05))" border="rgba(6,182,212,0.24)" />
            </div>

            {(gad.byDay?.length ?? 0) > 0 && (
              <Panel title="Sessions per day" icon="📈" accent="#4f6ef7" copy="A smoother 30-day trend view for sessions and audience behavior.">
                <TrendChart
                  id="ga-sessions"
                  data={gad.byDay!.map((item) => ({ label: item.date, value: item.sessions, helper: `${item.users} users` }))}
                  accent="#6b84ff"
                  summary={`${gad.byDay!.reduce((sum, item) => sum + item.sessions, 0).toLocaleString()} total sessions in the last 30 days (GA4 window is fixed)`}
                />
              </Panel>
            )}

            <div className="adm-analytics-grid-3">
              <Panel title="Top countries" icon="🌍" accent="#4f6ef7" copy="Markets generating the highest session volume.">
                <div className="adm-ranking-list">
                  {(gad.byCountry ?? []).map((item, index) => (
                    <RankingRow
                      key={item.country}
                      rank={index + 1}
                      label={item.country}
                      icon={COUNTRY_FLAG[item.country] ?? '🌐'}
                      value={item.sessions}
                      max={gad.byCountry?.[0]?.sessions ?? 1}
                      color="#4f6ef7"
                    />
                  ))}
                </div>
              </Panel>

              <Panel title="Devices" icon="📱" accent="#8b5cf6" copy="Traffic split by device family for responsive planning.">
                <DonutChart items={gad.byDevice ?? []} />
              </Panel>

              <Panel title="Traffic sources" icon="🔀" accent="#f59e0b" copy="How visitors are discovering the website.">
                <div className="adm-ranking-list">
                  {(gad.bySource ?? []).map((item) => (
                    <RankingRow
                      key={item.source}
                      label={item.source}
                      icon={SOURCE_ICON[item.source] ?? '🌐'}
                      value={item.sessions}
                      max={gad.bySource?.[0]?.sessions ?? 1}
                      color={SOURCE_COLOR[item.source] ?? '#6b7280'}
                    />
                  ))}
                </div>
              </Panel>
            </div>

            {(gad.byPage?.length ?? 0) > 0 && (
              <Panel title="Top pages" icon="📑" accent="#22c55e" copy="The most viewed destinations across the site." className="adm-analytics-panel-wide">
                <div className="adm-analytics-grid-2 compact">
                  {gad.byPage!.map((item, index) => (
                    <RankingRow
                      key={item.page}
                      rank={index + 1}
                      label={item.page}
                      value={item.views}
                      max={gad.byPage?.[0]?.views ?? 1}
                      color="#22c55e"
                    />
                  ))}
                </div>
              </Panel>
            )}
          </>
        );
      })()}

      {/* ── Page break before internal stats (print only) ─────────────────── */}
      <div className="analytics-print-break" />

      <div className="adm-analytics-section-divider">
        <span>💬</span>
        <strong>Internal Stats — Bot &amp; Newsletter</strong>
      </div>

      {internal.loading && <div className="adm-loading-center"><span className="adm-spinner" /> Loading internal analytics…</div>}
      {internal.error && <div className="adm-alert adm-alert-error">⚠ {internal.error}</div>}

      {summary && (
        <div className="adm-analytics-kpi-grid compact">
          <MetricCard icon="💬" label="Messages" value={String(summary.total_messages)} gradient="linear-gradient(135deg, rgba(79,110,247,0.16), rgba(79,110,247,0.05))" border="rgba(79,110,247,0.26)" />
          <MetricCard icon="👤" label="Chat Users" value={String(summary.total_users)} gradient="linear-gradient(135deg, rgba(34,197,94,0.16), rgba(34,197,94,0.05))" border="rgba(34,197,94,0.26)" />
          <MetricCard icon="✉️" label="Subscribers" value={String(summary.total_subscribers)} gradient="linear-gradient(135deg, rgba(6,182,212,0.16), rgba(6,182,212,0.05))" border="rgba(6,182,212,0.24)" />
          <MetricCard icon="📰" label="News Articles" value={String(summary.total_news)} gradient="linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))" border="rgba(245,158,11,0.24)" />
          <MetricCard icon="🧴" label="Products" value={String(summary.total_products)} gradient="linear-gradient(135deg, rgba(139,92,246,0.16), rgba(139,92,246,0.05))" border="rgba(139,92,246,0.24)" />
        </div>
      )}

      {internal.data && (
        <>
          <div className="adm-analytics-grid-2">
            <Panel title="Chat messages per day" icon="💬" accent="#4f6ef7" copy="Daily message activity captured by the assistant.">
              <TrendChart
                id="chat-per-day"
                data={(internal.data.chatPerDay ?? []).map((item) => ({ label: item.date, value: item.count }))}
                accent="#5eaeff"
                summary={`${(internal.data.chatPerDay ?? []).reduce((sum, item) => sum + item.count, 0).toLocaleString()} total messages in the last ${period} days`}
              />
            </Panel>

            <Panel title="Newsletter signups per day" icon="✉️" accent="#22c55e" copy="Daily subscription growth across the current period.">
              <TrendChart
                id="newsletter-per-day"
                data={(internal.data.newsletterPerDay ?? []).map((item) => ({ label: item.date, value: item.count }))}
                accent="#34d399"
                summary={`${(internal.data.newsletterPerDay ?? []).reduce((sum, item) => sum + item.count, 0).toLocaleString()} signups in the last ${period} days`}
              />
            </Panel>
          </div>

          {/* ── Page break before audience section (print only) ─────────────── */}
          <div className="analytics-print-break" />

          <div className="adm-analytics-grid-2">
            <Panel title="Chat language distribution" icon="🌐" accent="#8b5cf6" copy="How users are distributed by conversation language.">
              <div className="adm-ranking-list">
                {(internal.data.langDistribution ?? []).length ? (
                  (() => {
                    const total = internal.data.langDistribution.reduce((sum, item) => sum + item.count, 0);
                    const colors = ['#8b5cf6', '#4f6ef7', '#22c55e', '#f59e0b'];
                    return internal.data.langDistribution.map((item, index) => (
                      <RankingRow
                        key={item.language}
                        label={`${item.language.toUpperCase()} (${Math.round((item.count / total) * 100)}%)`}
                        value={item.count}
                        max={total}
                        color={colors[index % colors.length]}
                      />
                    ));
                  })()
                ) : <div className="adm-analytics-empty">No language data yet.</div>}
              </div>
            </Panel>

            <Panel title="Most active users" icon="🔥" accent="#f59e0b" copy="Users generating the heaviest conversation load right now.">
              {(internal.data.topUsers ?? []).length ? (
                <div className="adm-analytics-user-stack">
                  {internal.data.topUsers.map((user, index) => (
                    <div key={user.id} className="adm-analytics-user-row">
                      <div className="adm-analytics-user-rank">{index + 1}</div>
                      <div className="adm-analytics-user-copy">
                        <strong>{user.id.slice(0, 20)}…</strong>
                        <span>Last seen: {fmtDate(user.last_seen)}</span>
                      </div>
                      <div className="adm-analytics-user-metric">
                        <strong>{user.message_count}</strong>
                        <span>msgs</span>
                      </div>
                      <span className="adm-badge adm-badge-blue">{user.language}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="adm-analytics-empty">No users yet.</div>}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
};
