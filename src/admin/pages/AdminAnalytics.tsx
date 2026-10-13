import React, { useState } from 'react';
import { adminApi, type AdminAnalytics as AdminAnalyticsData, type GaData } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate, fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT, type Translate } from '../i18n/core';

const messages = defineMessages({
  en: {
    gaStep1: 'Go to Google Cloud Console → IAM & Admin → Service Accounts → Create service account',
    gaStep2: 'Download the JSON key file for that service account',
    gaStep3: 'In GA4: Admin → Property Access Management → add the service-account email as Viewer',
    gaStep4: 'In Google Cloud Console: APIs & Services → Library → Enable "Google Analytics Data API"',
    gaStep5: 'Add to the API environment:  GA_PROPERTY_ID=XXXXXXXXX  (numbers only)',
    gaStep6: 'Add to the API environment:  GA_SERVICE_ACCOUNT_JSON={"type":"service_account",...}  (one line)',
    gaStep7: 'Restart the API service',
    noData: 'No data yet.',
    noDeviceData: 'No device data yet.',
    deviceSessions: 'Device sessions',
    sessionsUnit: 'sessions',
    deviceShare: { other: '{pct}% · {n} sessions' },
    device_mobile: 'mobile',
    device_desktop: 'desktop',
    device_tablet: 'tablet',
    srcOrganicSearch: 'Organic Search',
    srcDirect: 'Direct',
    srcReferral: 'Referral',
    srcOrganicSocial: 'Organic Social',
    srcEmail: 'Email',
    srcPaidSearch: 'Paid Search',
    srcDisplay: 'Display',
    srcUnassigned: 'Unassigned',
    thousands: '{n}K',
    millions: '{n}M',
    durationMinSec: '{m}m {s}s',
    durationSec: '{s}s',
    setupTitle: 'Google Analytics 4 setup required',
    setupCopy: 'Complete the following steps to connect the property cleanly.',
    periodDays: { other: '{n} days' },
    lastDays: { other: 'last {n} days' },
    printTagline: 'Analytics Report',
    printGenerated: 'Generated: {date}',
    printPeriod: 'Trends: {trend} · GA4: {ga} · Totals: all time',
    printConnected: '● GA4 Connected',
    printNotConfigured: '○ GA4 Not Configured',
    eyebrow: 'Performance Overview',
    title: 'Analytics',
    heroText: 'A cleaner view of Google Analytics 4 plus internal bot and newsletter activity, organized for faster reading and comparison.',
    gaConnected: 'GA4 connected',
    gaNotConfigured: 'GA4 not configured',
    gaConnectedCopy: 'Traffic and device insights are available below.',
    gaNotConfiguredCopy: 'Add the property configuration to unlock reporting.',
    exportPdfTitle: 'Export as PDF',
    exportPdf: '🖨️ Export PDF',
    periodNote: 'The period applies to the daily chat and newsletter trends. Google Analytics covers the {range}; the totals, chat languages and most active users are all-time.',
    loadingGa: 'Loading Google Analytics data…',
    gaError: 'GA4 API error',
    gaSection: 'Google Analytics 4 — {range}',
    sessions: 'Sessions',
    activeUsers: 'Active Users',
    newUsers: 'New Users',
    pageViews: 'Page Views',
    bounceRate: 'Bounce Rate',
    avgSession: 'Avg Session',
    perSession: 'per session',
    sessionsPerDay: 'Sessions per day',
    sessionsPerDayCopy: 'Daily sessions over the {range}.',
    usersCount: { other: '{n} users' },
    sessionsSummary: '{total} total sessions in the {range}',
    topCountries: 'Top countries',
    topCountriesCopy: 'Markets generating the highest session volume.',
    devices: 'Devices',
    devicesCopy: 'Traffic split by device family for responsive planning.',
    sources: 'Traffic sources',
    sourcesCopy: 'How visitors are discovering the website.',
    topPages: 'Top pages',
    topPagesCopy: 'The most viewed destinations across the site.',
    internalSection: 'Internal Stats — Bot & Newsletter',
    loadingInternal: 'Loading internal analytics…',
    messages: 'Messages',
    chatUsers: 'Chat Users',
    subscribers: 'Subscribers',
    newsArticles: 'News Articles',
    products: 'Products',
    allTime: 'All time',
    activeSubscribersAllTime: 'Active, all time',
    activeAllTime: 'Active, all time',
    chatPerDay: 'Chat messages per day',
    chatPerDayCopy: 'Daily message activity captured by the assistant.',
    chatSummary: '{total} total messages in the {range}',
    signupsPerDay: 'Newsletter signups per day',
    signupsPerDayCopy: 'Daily subscription growth across the current period.',
    signupsSummary: '{total} signups in the {range}',
    langDist: 'Chat language distribution',
    langDistCopy: 'All time — how chat users are distributed by conversation language.',
    noLangData: 'No language data yet.',
    topUsers: 'Most active users',
    topUsersCopy: 'All time — the users with the most messages.',
    lastSeen: 'Last seen: {date}',
    msgs: 'msgs',
    noUsers: 'No users yet.',
  },
  ar: {
    gaStep1: 'افتح Google Cloud Console، ثم IAM & Admin → Service Accounts → Create service account',
    gaStep2: 'نزّل ملف مفتاح JSON لحساب الخدمة هذا',
    gaStep3: 'في GA4: Admin → Property Access Management، ثم أضف بريد حساب الخدمة بصلاحية Viewer',
    gaStep4: 'في Google Cloud Console: APIs & Services → Library، ثم فعّل "Google Analytics Data API"',
    gaStep5: 'أضف إلى متغيرات بيئة الـ API:  GA_PROPERTY_ID=XXXXXXXXX  (أرقام فقط)',
    gaStep6: 'أضف إلى متغيرات بيئة الـ API:  GA_SERVICE_ACCOUNT_JSON={"type":"service_account",...}  (في سطر واحد)',
    gaStep7: 'أعد تشغيل خدمة الـ API',
    noData: 'لا توجد بيانات بعد.',
    noDeviceData: 'لا توجد بيانات أجهزة بعد.',
    deviceSessions: 'الجلسات حسب الجهاز',
    sessionsUnit: 'جلسة',
    deviceShare: {
      zero: '{pct}% · لا جلسات',
      one: '{pct}% · جلسة واحدة',
      two: '{pct}% · جلستان',
      few: '{pct}% · {n} جلسات',
      many: '{pct}% · {n} جلسة',
      other: '{pct}% · {n} جلسة',
    },
    device_mobile: 'الجوال',
    device_desktop: 'الحاسوب',
    device_tablet: 'الجهاز اللوحي',
    srcOrganicSearch: 'بحث عضوي',
    srcDirect: 'مباشر',
    srcReferral: 'إحالة',
    srcOrganicSocial: 'تواصل اجتماعي عضوي',
    srcEmail: 'البريد الإلكتروني',
    srcPaidSearch: 'بحث مدفوع',
    srcDisplay: 'إعلانات مصوّرة',
    srcUnassigned: 'غير مصنّف',
    thousands: '{n} ألف',
    millions: '{n} مليون',
    durationMinSec: '{m} د {s} ث',
    durationSec: '{s} ث',
    setupTitle: 'يلزم إعداد Google Analytics 4',
    setupCopy: 'أكمل الخطوات التالية لربط الخاصية بشكل صحيح.',
    periodDays: { one: 'يوم واحد', two: 'يومان', few: '{n} أيام', many: '{n} يومًا', other: '{n} يوم' },
    lastDays: { one: 'آخر يوم', two: 'آخر يومين', few: 'آخر {n} أيام', many: 'آخر {n} يومًا', other: 'آخر {n} يوم' },
    printTagline: 'تقرير التحليلات',
    printGenerated: 'تاريخ الإنشاء: {date}',
    printPeriod: 'الاتجاهات: {trend} · GA4: {ga} · الإجماليات: منذ البداية',
    printConnected: '● GA4 متصل',
    printNotConfigured: '○ GA4 غير مُعدّ',
    eyebrow: 'نظرة عامة على الأداء',
    title: 'التحليلات',
    heroText: 'عرض أوضح لبيانات Google Analytics 4 إلى جانب نشاط المساعد والنشرة البريدية داخل الموقع، مرتّب لقراءة ومقارنة أسرع.',
    gaConnected: 'GA4 متصل',
    gaNotConfigured: 'GA4 غير مُعدّ',
    gaConnectedCopy: 'بيانات الزيارات والأجهزة متاحة أدناه.',
    gaNotConfiguredCopy: 'أضف إعدادات الخاصية لتفعيل التقارير.',
    exportPdfTitle: 'تصدير بصيغة PDF',
    exportPdf: '🖨️ تصدير PDF',
    periodNote: 'تنطبق الفترة على الاتجاهات اليومية للمحادثات والنشرة البريدية. يغطي Google Analytics {range}؛ أما الإجماليات ولغات المحادثة وأكثر الزوار نشاطًا فتشمل كل الفترات منذ البداية.',
    loadingGa: 'جارٍ تحميل بيانات Google Analytics…',
    gaError: 'خطأ في واجهة GA4 البرمجية',
    gaSection: 'Google Analytics 4 — {range}',
    sessions: 'الجلسات',
    activeUsers: 'المستخدمون النشطون',
    newUsers: 'المستخدمون الجدد',
    pageViews: 'مشاهدات الصفحات',
    bounceRate: 'معدل الارتداد',
    avgSession: 'متوسط مدة الجلسة',
    perSession: 'لكل جلسة',
    sessionsPerDay: 'الجلسات يوميًا',
    sessionsPerDayCopy: 'عدد الجلسات اليومية خلال {range}.',
    usersCount: { zero: 'لا مستخدمين', one: 'مستخدم واحد', two: 'مستخدمان', few: '{n} مستخدمين', many: '{n} مستخدمًا', other: '{n} مستخدم' },
    sessionsSummary: 'إجمالي الجلسات خلال {range}: {total}',
    topCountries: 'أبرز الدول',
    topCountriesCopy: 'الأسواق الأعلى من حيث عدد الجلسات.',
    devices: 'الأجهزة',
    devicesCopy: 'توزيع الزيارات حسب نوع الجهاز، للتخطيط للتصميم المتجاوب.',
    sources: 'مصادر الزيارات',
    sourcesCopy: 'كيف يصل الزوار إلى الموقع.',
    topPages: 'أكثر الصفحات زيارة',
    topPagesCopy: 'الصفحات الأكثر مشاهدة في الموقع.',
    internalSection: 'إحصاءات داخلية — المساعد والنشرة البريدية',
    loadingInternal: 'جارٍ تحميل الإحصاءات الداخلية…',
    messages: 'الرسائل',
    chatUsers: 'زوار المحادثة',
    subscribers: 'المشتركون',
    newsArticles: 'الأخبار',
    products: 'المنتجات',
    allTime: 'منذ البداية',
    activeSubscribersAllTime: 'النشطون فقط، منذ البداية',
    activeAllTime: 'المفعّلة فقط، منذ البداية',
    chatPerDay: 'رسائل المحادثة يوميًا',
    chatPerDayCopy: 'نشاط الرسائل اليومي الذي سجّله المساعد.',
    chatSummary: 'إجمالي الرسائل خلال {range}: {total}',
    signupsPerDay: 'اشتراكات النشرة البريدية يوميًا',
    signupsPerDayCopy: 'نمو الاشتراكات اليومي خلال الفترة الحالية.',
    signupsSummary: 'الاشتراكات خلال {range}: {total}',
    langDist: 'توزيع لغات المحادثة',
    langDistCopy: 'منذ البداية — توزيع زوار المحادثة حسب لغة المحادثة.',
    noLangData: 'لا توجد بيانات لغات بعد.',
    topUsers: 'أكثر الزوار نشاطًا',
    topUsersCopy: 'منذ البداية — الزوار الذين أرسلوا أكبر عدد من الرسائل.',
    lastSeen: 'آخر ظهور: {date}',
    msgs: 'رسالة',
    noUsers: 'لا يوجد زوار بعد.',
  },
});

type Key = keyof typeof messages.en;
type T = Translate<Key>;

const fmt = (n: number, t: T) =>
  n >= 1_000_000 ? t('millions', { n: (n / 1_000_000).toFixed(1) })
  : n >= 1_000 ? t('thousands', { n: (n / 1_000).toFixed(1) })
  : String(n);

const fmtDuration = (s: number, t: T) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? t('durationMinSec', { m: String(m), s: String(sec) }) : t('durationSec', { s: String(sec) });
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

// GA4 channel-group names → readable labels. Unknown channels show as sent.
const SOURCE_LABEL: Record<string, Key> = {
  'Organic Search': 'srcOrganicSearch', Direct: 'srcDirect', Referral: 'srcReferral',
  'Organic Social': 'srcOrganicSocial', Email: 'srcEmail', 'Paid Search': 'srcPaidSearch',
  Display: 'srcDisplay', Unassigned: 'srcUnassigned',
};

const DEVICE_COLOR: Record<string, string> = {
  mobile: '#4f6ef7', desktop: '#22c55e', tablet: '#f59e0b',
};

const DEVICE_ICON: Record<string, string> = {
  mobile: '📱', desktop: '🖥️', tablet: '📟',
};

const DEVICE_LABEL: Record<string, Key> = {
  mobile: 'device_mobile', desktop: 'device_desktop', tablet: 'device_tablet',
};

type TrendDatum = { label: string; value: number; helper?: string };

const TrendChart: React.FC<{
  id: string;
  data: TrendDatum[];
  accent: string;
  summary: string;
}> = ({ id, data, accent, summary }) => {
  const t = useT(messages);
  // The server sends every day of the range (quiet days as 0), so an
  // all-zero series is the "nothing happened" case.
  if (!data.length || data.every((item) => item.value === 0)) {
    return <div className="adm-analytics-empty">{t('noData')}</div>;
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

  // Time runs left to right in both languages: the plot, its axis and the
  // first/last dates underneath keep left-to-right geometry.
  return (
    <div className="adm-trend-chart adm-ltr">
      <div className="adm-trend-chart-stage">
        <div className="adm-trend-axis">
          <span>{fmt(max, t)}</span>
          <span>{fmt(midpoint, t)}</span>
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
        <span dir="auto">{summary}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
};

const DonutChart: React.FC<{ items: Array<{ device: string; sessions: number }> }> = ({ items }) => {
  const t = useT(messages);
  const total = items.reduce((sum, item) => sum + item.sessions, 0);
  if (!total) return <div className="adm-analytics-empty">{t('noDeviceData')}</div>;

  let offset = 0;
  const radius = 56;
  const center = 72;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="adm-device-layout">
      <svg viewBox="0 0 144 144" className="adm-device-chart adm-ltr" aria-label={t('deviceSessions')}>
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
        <text x={center} y={center - 4} textAnchor="middle" fill="var(--adm-text)" fontSize="22" fontWeight="700">{fmt(total, t)}</text>
        <text x={center} y={center + 18} textAnchor="middle" fill="var(--adm-text-muted)" fontSize="11">{t('sessionsUnit')}</text>
      </svg>

      <div className="adm-device-legend">
        {items.map((item) => {
          const percentage = Math.round((item.sessions / total) * 100);
          const color = DEVICE_COLOR[item.device.toLowerCase()] ?? '#6b7280';
          const labelKey = DEVICE_LABEL[item.device.toLowerCase()];
          return (
            <div key={item.device} className="adm-device-legend-item">
              <span className="adm-device-legend-icon">{DEVICE_ICON[item.device.toLowerCase()] ?? '💻'}</span>
              <div>
                <strong>{labelKey ? t(labelKey) : item.device}</strong>
                <span style={{ color }}>{t.plural('deviceShare', item.sessions, { pct: String(percentage) })}</span>
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
  /** "ltr" for values that read left to right (URL paths). */
  labelDir?: 'ltr';
}> = ({ label, value, max, color, icon, rank, labelDir }) => {
  const width = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="adm-ranking-row">
      <div className="adm-ranking-top">
        <div className="adm-ranking-label-wrap">
          {rank !== undefined && <span className="adm-ranking-rank">#{rank}</span>}
          {icon && <span className="adm-ranking-icon">{icon}</span>}
          <span className="adm-ranking-label" dir={labelDir}>{label}</span>
        </div>
        <strong style={{ color }}>{fmtNumber(value)}</strong>
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

// The steps come from the server (English only).
const GA_STEPS = ['gaStep1', 'gaStep2', 'gaStep3', 'gaStep4', 'gaStep5', 'gaStep6', 'gaStep7'] as const;

// The server's steps are English-only fixed text; the page words them in
// the admin language instead.
const SetupGuide: React.FC = () => {
  const t = useT(messages);
  const steps = GA_STEPS.map((key) => t(key));
  return (
    <div className="adm-analytics-rich-alert warning">
      <div className="adm-analytics-rich-alert-head">
        <span>⚙️</span>
        <div>
          <strong>{t('setupTitle')}</strong>
          <p>{t('setupCopy')}</p>
        </div>
      </div>
      <ol className="adm-analytics-steps">
        {steps.map((step, index) => (
          <li key={index} dir="auto">{step}</li>
        ))}
      </ol>
    </div>
  );
};

const PERIOD_OPTIONS = [30, 60, 90];

export const AdminAnalytics: React.FC = () => {
  const t = useT(messages);
  const [period, setPeriod] = useState(30);
  const internal = useAsync<AdminAnalyticsData>(() => adminApi.getAnalytics(period), [period]);
  // GA4 follows the period too. The server reports the window it actually
  // used as `days`; every GA label below reads that, never `period`.
  const ga = useAsync<GaData>(() => adminApi.getGaData(period), [period]);
  const gad = ga.data;
  const gaDays = gad?.days ?? 30;
  const summary = internal.data?.summary;
  const gaRange = t.plural('lastDays', gaDays);
  const periodRange = t.plural('lastDays', period);

  const handlePrint = () => window.print();

  const printDate = fmtDate(new Date().toISOString());

  return (
    <div className="adm-analytics-page">

      {/* ── Print-only cover header (hidden on screen) ────────────────────── */}
      <div className="analytics-print-header">
        <div className="analytics-print-header-left">
          <div className="analytics-print-brand">KARAHOCA</div>
          <div className="analytics-print-tagline">{t('printTagline')}</div>
        </div>
        <div className="analytics-print-header-right">
          <div className="analytics-print-date">{t('printGenerated', { date: printDate })}</div>
          {/* Only the daily trends follow the period selector. */}
          <div className="analytics-print-period">
            {t('printPeriod', { trend: periodRange, ga: gaRange })}
          </div>
          <div className={`analytics-print-status ${gad?.configured ? 'connected' : 'disconnected'}`}>
            {gad?.configured ? t('printConnected') : t('printNotConfigured')}
          </div>
        </div>
      </div>

      <section className="adm-card adm-analytics-hero">
        <div>
          <span className="adm-dashboard-eyebrow">{t('eyebrow')}</span>
          <h1 className="adm-analytics-hero-title">{t('title')}</h1>
          <p className="adm-analytics-hero-text">{t('heroText')}</p>
        </div>
        <div className="adm-analytics-status-card">
          <div className="adm-analytics-status-dot" style={{ background: gad?.configured ? '#22c55e' : '#f59e0b' }} />
          <div>
            <strong>{gad?.configured ? t('gaConnected') : t('gaNotConfigured')}</strong>
            <span>{gad?.configured ? t('gaConnectedCopy') : t('gaNotConfiguredCopy')}</span>
          </div>
        </div>
      </section>

      {/* ── Controls toolbar ─────────────────────────────────────────────────── */}
      <div className="adm-analytics-toolbar">
        <div className="adm-analytics-period-selector">
          {PERIOD_OPTIONS.map((days) => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className={`adm-analytics-period-btn${period === days ? ' active' : ''}`}
            >
              {t.plural('periodDays', days)}
            </button>
          ))}
        </div>
        <button className="adm-analytics-export-btn" onClick={handlePrint} title={t('exportPdfTitle')}>
          {t('exportPdf')}
        </button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--adm-text-muted)', margin: '-4px 0 16px' }}>
        {t('periodNote', { range: gaRange })}
      </p>

      {ga.loading && <div className="adm-loading-center"><span className="adm-spinner" /> {t('loadingGa')}</div>}

      {!ga.loading && ga.error && (
        <div className="adm-analytics-rich-alert error">
          <div className="adm-analytics-rich-alert-head">
            <span>⚠️</span>
            <div>
              <strong>{t('gaError')}</strong>
              <p>{ga.error}</p>
            </div>
          </div>
        </div>
      )}

      {!ga.loading && gad && !gad.configured && <SetupGuide />}

      {gad?.configured && gad.summary && (() => {
        const sm = gad.summary;
        return (
          <>
            <div className="adm-analytics-section-divider">
              <span>📊</span>
              <strong>{t('gaSection', { range: gaRange })}</strong>
            </div>
            <div className="adm-analytics-kpi-grid">
              <MetricCard icon="🔗" label={t('sessions')} value={fmt(sm.sessions, t)} gradient="linear-gradient(135deg, rgba(79,110,247,0.18), rgba(79,110,247,0.05))" border="rgba(79,110,247,0.28)" />
              <MetricCard icon="🟢" label={t('activeUsers')} value={fmt(sm.activeUsers, t)} gradient="linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.05))" border="rgba(34,197,94,0.28)" />
              <MetricCard icon="✨" label={t('newUsers')} value={fmt(sm.newUsers, t)} gradient="linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.05))" border="rgba(245,158,11,0.28)" />
              <MetricCard icon="📄" label={t('pageViews')} value={fmt(sm.pageViews, t)} gradient="linear-gradient(135deg, rgba(139,92,246,0.18), rgba(139,92,246,0.05))" border="rgba(139,92,246,0.28)" />
              <MetricCard icon="↩️" label={t('bounceRate')} value={`${sm.bounceRate}%`} gradient="linear-gradient(135deg, rgba(239,68,68,0.16), rgba(239,68,68,0.05))" border="rgba(239,68,68,0.24)" />
              <MetricCard icon="⏱️" label={t('avgSession')} value={fmtDuration(sm.avgSessionDuration, t)} sub={t('perSession')} gradient="linear-gradient(135deg, rgba(6,182,212,0.16), rgba(6,182,212,0.05))" border="rgba(6,182,212,0.24)" />
            </div>

            {(gad.byDay?.length ?? 0) > 0 && (
              <Panel title={t('sessionsPerDay')} icon="📈" accent="#4f6ef7" copy={t('sessionsPerDayCopy', { range: gaRange })}>
                <TrendChart
                  id="ga-sessions"
                  data={gad.byDay!.map((item) => ({ label: item.date, value: item.sessions, helper: t.plural('usersCount', item.users) }))}
                  accent="#6b84ff"
                  summary={t('sessionsSummary', {
                    total: fmtNumber(gad.byDay!.reduce((sum, item) => sum + item.sessions, 0)),
                    range: gaRange,
                  })}
                />
              </Panel>
            )}

            <div className="adm-analytics-grid-3">
              <Panel title={t('topCountries')} icon="🌍" accent="#4f6ef7" copy={t('topCountriesCopy')}>
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

              <Panel title={t('devices')} icon="📱" accent="#8b5cf6" copy={t('devicesCopy')}>
                <DonutChart items={gad.byDevice ?? []} />
              </Panel>

              <Panel title={t('sources')} icon="🔀" accent="#f59e0b" copy={t('sourcesCopy')}>
                <div className="adm-ranking-list">
                  {(gad.bySource ?? []).map((item) => {
                    const labelKey = SOURCE_LABEL[item.source];
                    return (
                      <RankingRow
                        key={item.source}
                        label={labelKey ? t(labelKey) : item.source}
                        icon={SOURCE_ICON[item.source] ?? '🌐'}
                        value={item.sessions}
                        max={gad.bySource?.[0]?.sessions ?? 1}
                        color={SOURCE_COLOR[item.source] ?? '#6b7280'}
                      />
                    );
                  })}
                </div>
              </Panel>
            </div>

            {(gad.byPage?.length ?? 0) > 0 && (
              <Panel title={t('topPages')} icon="📑" accent="#22c55e" copy={t('topPagesCopy')} className="adm-analytics-panel-wide">
                <div className="adm-analytics-grid-2 compact">
                  {gad.byPage!.map((item, index) => (
                    <RankingRow
                      key={item.page}
                      rank={index + 1}
                      label={item.page}
                      labelDir="ltr"
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
        <strong>{t('internalSection')}</strong>
      </div>

      {internal.loading && <div className="adm-loading-center"><span className="adm-spinner" /> {t('loadingInternal')}</div>}
      {internal.error && <div className="adm-alert adm-alert-error">⚠ {internal.error}</div>}

      {summary && (
        <div className="adm-analytics-kpi-grid compact">
          <MetricCard icon="💬" label={t('messages')} value={fmtNumber(summary.total_messages)} sub={t('allTime')} gradient="linear-gradient(135deg, rgba(79,110,247,0.16), rgba(79,110,247,0.05))" border="rgba(79,110,247,0.26)" />
          <MetricCard icon="👤" label={t('chatUsers')} value={fmtNumber(summary.total_users)} sub={t('allTime')} gradient="linear-gradient(135deg, rgba(34,197,94,0.16), rgba(34,197,94,0.05))" border="rgba(34,197,94,0.26)" />
          <MetricCard icon="✉️" label={t('subscribers')} value={fmtNumber(summary.total_subscribers)} sub={t('activeSubscribersAllTime')} gradient="linear-gradient(135deg, rgba(6,182,212,0.16), rgba(6,182,212,0.05))" border="rgba(6,182,212,0.24)" />
          <MetricCard icon="📰" label={t('newsArticles')} value={fmtNumber(summary.total_news)} sub={t('activeAllTime')} gradient="linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))" border="rgba(245,158,11,0.24)" />
          <MetricCard icon="🧴" label={t('products')} value={fmtNumber(summary.total_products)} sub={t('activeAllTime')} gradient="linear-gradient(135deg, rgba(139,92,246,0.16), rgba(139,92,246,0.05))" border="rgba(139,92,246,0.24)" />
        </div>
      )}

      {internal.data && (
        <>
          <div className="adm-analytics-grid-2">
            <Panel title={t('chatPerDay')} icon="💬" accent="#4f6ef7" copy={t('chatPerDayCopy')}>
              <TrendChart
                id="chat-per-day"
                data={(internal.data.chatPerDay ?? []).map((item) => ({ label: item.date, value: item.count }))}
                accent="#5eaeff"
                summary={t('chatSummary', {
                  total: fmtNumber((internal.data.chatPerDay ?? []).reduce((sum, item) => sum + item.count, 0)),
                  range: periodRange,
                })}
              />
            </Panel>

            <Panel title={t('signupsPerDay')} icon="✉️" accent="#22c55e" copy={t('signupsPerDayCopy')}>
              <TrendChart
                id="newsletter-per-day"
                data={(internal.data.newsletterPerDay ?? []).map((item) => ({ label: item.date, value: item.count }))}
                accent="#34d399"
                summary={t('signupsSummary', {
                  total: fmtNumber((internal.data.newsletterPerDay ?? []).reduce((sum, item) => sum + item.count, 0)),
                  range: periodRange,
                })}
              />
            </Panel>
          </div>

          {/* ── Page break before audience section (print only) ─────────────── */}
          <div className="analytics-print-break" />

          <div className="adm-analytics-grid-2">
            <Panel title={t('langDist')} icon="🌐" accent="#8b5cf6" copy={t('langDistCopy')}>
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
                ) : <div className="adm-analytics-empty">{t('noLangData')}</div>}
              </div>
            </Panel>

            <Panel title={t('topUsers')} icon="🔥" accent="#f59e0b" copy={t('topUsersCopy')}>
              {(internal.data.topUsers ?? []).length ? (
                <div className="adm-analytics-user-stack">
                  {internal.data.topUsers.map((user, index) => (
                    <div key={user.id} className="adm-analytics-user-row">
                      <div className="adm-analytics-user-rank">{index + 1}</div>
                      <div className="adm-analytics-user-copy">
                        <strong><bdi dir="ltr">{user.id.slice(0, 20)}…</bdi></strong>
                        <span>{t('lastSeen', { date: fmtDate(user.last_seen) })}</span>
                      </div>
                      <div className="adm-analytics-user-metric">
                        <strong>{fmtNumber(user.message_count)}</strong>
                        <span>{t('msgs')}</span>
                      </div>
                      <span className="adm-badge adm-badge-blue">{user.language}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="adm-analytics-empty">{t('noUsers')}</div>}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
};
