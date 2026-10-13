import React, { useMemo, useState } from 'react';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT, type Translate } from '../i18n/core';

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
 *      WhatsApp from the chat (product card / footer link / "continue
 *      on WhatsApp" — not the floating button)?
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

const messages = defineMessages({
  en: {
    title: '🤖 Karo Insights',
    custom: 'Custom',
    lastDays: { other: 'Last {n} days' },
    rangeArrow: '→',
    loading: 'Loading insights…',
    loadFailed: 'Failed to load insights: {error}',
    thousands: '{n}K',
    millions: '{n}M',
    uniqueVisitors: 'Unique visitors',
    uniqueVisitorsSub: 'Distinct browsers',
    chatOpens: 'Chat opens',
    chatOpensSub: 'Including re-opens',
    totalMessages: 'Total messages',
    totalMessagesSub: '{user} user · {karo} Karo',
    avgPerConvo: 'Avg msgs / convo',
    avgPerConvoSub: 'Per unique visitor',
    whatsappCtr: 'WhatsApp CTR',
    whatsappCtrSub: 'of chat openers, from the chat',
    dropped: 'Dropped convos',
    droppedSub: 'Visitor turn without a reply',
    topCountries: '🌍 Top countries',
    colCountry: 'Country',
    colChats: 'Chats',
    langDist: '🗣 Language distribution',
    colLang: 'Lang',
    topProducts: '📦 Top products asked about',
    colProduct: 'Product',
    colHits: 'Hits',
    noProducts: 'No product events yet.',
    topChips: '💬 Top follow-up chips',
    colChip: 'Chip',
    colTaps: 'Taps',
    noChips: 'No chip taps yet.',
    emptyChip: '(empty)',
    dailyVolume: '📈 Daily chat volume',
    noChatsInRange: 'No chats in this range.',
    noData: 'No data yet.',
    dayBar: '{day}: {opens} opens, {visitors} visitors',
  },
  ar: {
    title: '🤖 إحصاءات كارو',
    custom: 'فترة مخصّصة',
    lastDays: { one: 'آخر يوم', two: 'آخر يومين', few: 'آخر {n} أيام', many: 'آخر {n} يومًا', other: 'آخر {n} يوم' },
    rangeArrow: '←',
    loading: 'جارٍ تحميل الإحصاءات…',
    loadFailed: 'تعذّر تحميل الإحصاءات: {error}',
    thousands: '{n} ألف',
    millions: '{n} مليون',
    uniqueVisitors: 'الزوار الفريدون',
    uniqueVisitorsSub: 'متصفحات مختلفة',
    chatOpens: 'مرات فتح المحادثة',
    chatOpensSub: 'بما فيها إعادة الفتح',
    totalMessages: 'إجمالي الرسائل',
    totalMessagesSub: '{user} من الزوار · {karo} من كارو',
    avgPerConvo: 'متوسط الرسائل لكل محادثة',
    avgPerConvoSub: 'لكل زائر فريد',
    whatsappCtr: 'نسبة النقر إلى WhatsApp',
    whatsappCtrSub: 'من الذين فتحوا المحادثة، من داخل المحادثة',
    dropped: 'محادثات بلا رد',
    droppedSub: 'رسالة من الزائر لم يُرَدّ عليها',
    topCountries: '🌍 أبرز الدول',
    colCountry: 'الدولة',
    colChats: 'المحادثات',
    langDist: '🗣 توزيع اللغات',
    colLang: 'اللغة',
    topProducts: '📦 أكثر المنتجات التي سُئل عنها',
    colProduct: 'المنتج',
    colHits: 'مرات الظهور',
    noProducts: 'لا توجد أحداث منتجات بعد.',
    topChips: '💬 أكثر الاقتراحات المتابِعة استخدامًا',
    colChip: 'الاقتراح',
    colTaps: 'النقرات',
    noChips: 'لم يُنقر على أي اقتراح بعد.',
    emptyChip: '(فارغ)',
    dailyVolume: '📈 حجم المحادثات اليومي',
    noChatsInRange: 'لا توجد محادثات في هذه الفترة.',
    noData: 'لا توجد بيانات بعد.',
    dayBar: '{day} — مرات الفتح: {opens}، الزوار: {visitors}',
  },
});

type T = Translate<keyof typeof messages.en>;

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

const fmt = (n: number, t: T) =>
  n >= 1_000_000 ? t('millions', { n: (n / 1_000_000).toFixed(1) })
  : n >= 1_000 ? t('thousands', { n: (n / 1_000).toFixed(1) })
  : String(n);

const isoDaysAgo = (days: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

type PresetKey = '7' | '30' | '90' | 'custom';

export const AdminKaroInsights: React.FC = () => {
  const t = useT(messages);
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
      <h1 style={{ margin: '0 0 18px', fontSize: 22 }}>{t('title')}</h1>

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
            {p === 'custom' ? t('custom') : t.plural('lastDays', Number(p))}
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
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{t('rangeArrow')}</span>
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

      {loading && <p style={{ color: 'rgba(255,255,255,0.55)' }}>{t('loading')}</p>}
      {error && (
        <p style={{ color: '#f87171' }}>{t('loadFailed', { error: String(error) })}</p>
      )}

      {data && (
        <>
          {/* KPI tiles */}
          <div style={s.kpiGrid}>
            <Kpi label={t('uniqueVisitors')} value={fmt(kpi?.uniqueVisitors || 0, t)} sub={t('uniqueVisitorsSub')} />
            <Kpi label={t('chatOpens')} value={fmt(kpi?.chatOpens || 0, t)} sub={t('chatOpensSub')} />
            <Kpi
              label={t('totalMessages')}
              value={fmt(kpi?.totalMessages || 0, t)}
              sub={t('totalMessagesSub', { user: fmt(kpi?.userMessages || 0, t), karo: fmt(kpi?.assistantMessages || 0, t) })}
            />
            <Kpi label={t('avgPerConvo')} value={String(kpi?.avgMessagesPerConvo || 0)} sub={t('avgPerConvoSub')} />
            {/* Capped: a rate over 100% can only mean mismatched counts. */}
            <Kpi label={t('whatsappCtr')} value={`${Math.min(100, kpi?.whatsappCtr || 0)}%`} sub={t('whatsappCtrSub')} />
            <Kpi label={t('dropped')} value={fmt(kpi?.droppedConversations || 0, t)} sub={t('droppedSub')} />
          </div>

          {/* Two-column layout for the distribution tables */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <Section title={t('topCountries')}>
              {data.byCountry.length === 0 ? <p style={s.empty}>{t('noData')}</p> : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>{t('colCountry')}</th>
                      <th style={{ ...s.th, textAlign: 'end' }}>{t('colChats')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCountry.map((row) => (
                      <tr key={row.country}>
                        <td style={s.td}>{row.country}</td>
                        <td style={{ ...s.td, textAlign: 'end' }}>{fmt(row.count, t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title={t('langDist')}>
              {data.byLang.length === 0 ? <p style={s.empty}>{t('noData')}</p> : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>{t('colLang')}</th>
                      <th style={{ ...s.th, textAlign: 'end' }}>{t('colChats')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byLang.map((row) => (
                      <tr key={row.lang}>
                        <td style={s.td}>{row.lang.toUpperCase()}</td>
                        <td style={{ ...s.td, textAlign: 'end' }}>{fmt(row.count, t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title={t('topProducts')}>
              {data.topProducts.length === 0 ? <p style={s.empty}>{t('noProducts')}</p> : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>{t('colProduct')}</th>
                      <th style={{ ...s.th, textAlign: 'end' }}>{t('colHits')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((row) => (
                      <tr key={row.product_id}>
                        <td style={s.td}>
                          <code dir="ltr" style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)' }}>{row.product_id}</code>
                        </td>
                        <td style={{ ...s.td, textAlign: 'end' }}>{fmt(row.hits, t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title={t('topChips')}>
              {data.topFollowupChips.length === 0 ? <p style={s.empty}>{t('noChips')}</p> : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>{t('colChip')}</th>
                      <th style={{ ...s.th, textAlign: 'end' }}>{t('colTaps')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topFollowupChips.map((row, i) => (
                      <tr key={`${row.chip}-${i}`}>
                        <td style={s.td}><bdi>{row.chip || t('emptyChip')}</bdi></td>
                        <td style={{ ...s.td, textAlign: 'end' }}>{fmt(row.count, t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          </div>

          {/* Sparkline-style daily volume */}
          <Section title={t('dailyVolume')} style={{ marginTop: 14 }}>
            {/* byDay has every day of the range (quiet days as 0), so
                "no chats" means every day is 0, not an empty list. */}
            {data.byDay.every((row) => row.opens === 0) ? <p style={s.empty}>{t('noChatsInRange')}</p> : (
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
 * dedicated chart library for a single 30-bar visual. One bar per day of
 * the range — zero days included, so gaps show as gaps — which is why
 * long ranges get thinner bars and the strip scrolls rather than
 * overflowing the card.
 */
interface DailyBarsProps {
  rows: Array<{ day: string; unique_visitors: number; opens: number }>;
}
const DailyBars: React.FC<DailyBarsProps> = ({ rows }) => {
  const t = useT(messages);
  const max = Math.max(1, ...rows.map((r) => r.opens));
  const dense = rows.length > 45;
  // A time series: days run left to right in both languages.
  return (
    <div className="adm-ltr" style={{ display: 'flex', alignItems: 'flex-end', gap: dense ? 1 : 4, height: 120, padding: '8px 0', overflowX: 'auto' }}>
      {rows.map((row) => {
        const heightPct = (row.opens / max) * 100;
        return (
          <div
            key={row.day}
            title={t('dayBar', { day: row.day, opens: fmtNumber(row.opens), visitors: fmtNumber(row.unique_visitors) })}
            style={{
              flex: 1,
              minWidth: dense ? 2 : 4,
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
