import React, { useMemo, useState } from 'react';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT, type Translate } from '../i18n/core';
import {
  Alert, Card, EmptyState, LangTag, Loading, PageHeader, StatCard, StatGrid, Tabs, Toolbar,
} from '../ui';

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
    title: 'Karo insights',
    subtitle: 'How visitors use Karo, the site\'s chat assistant: volume, origin, languages and what they ask about.',
    period: 'Period',
    custom: 'Custom',
    lastDays: { other: 'Last {n} days' },
    from: 'From',
    to: 'To',
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
    topCountries: 'Top countries',
    colCountry: 'Country',
    colChats: 'Chats',
    langDist: 'Language distribution',
    colLang: 'Lang',
    topProducts: 'Top products asked about',
    colProduct: 'Product',
    colHits: 'Hits',
    noProducts: 'No product events yet.',
    topChips: 'Top follow-up chips',
    colChip: 'Chip',
    colTaps: 'Taps',
    noChips: 'No chip taps yet.',
    emptyChip: '(empty)',
    dailyVolume: 'Daily chat volume',
    noChatsInRange: 'No chats in this range.',
    noData: 'No data yet.',
    dayBar: '{day}: {opens} opens, {visitors} visitors',
  },
  ar: {
    title: 'إحصاءات كارو',
    subtitle: 'كيف يستخدم الزوار كارو، مساعد المحادثة في الموقع: حجم المحادثات، ومن أين يأتون، ولغاتهم، وعمّا يسألون.',
    period: 'الفترة',
    custom: 'فترة مخصّصة',
    lastDays: { one: 'آخر يوم', two: 'آخر يومين', few: 'آخر {n} أيام', many: 'آخر {n} يومًا', other: 'آخر {n} يوم' },
    from: 'من',
    to: 'إلى',
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
    topCountries: 'أبرز الدول',
    colCountry: 'الدولة',
    colChats: 'المحادثات',
    langDist: 'توزيع اللغات',
    colLang: 'اللغة',
    topProducts: 'أكثر المنتجات التي سُئل عنها',
    colProduct: 'المنتج',
    colHits: 'مرات الظهور',
    noProducts: 'لا توجد أحداث منتجات بعد.',
    topChips: 'أكثر الاقتراحات المتابِعة استخدامًا',
    colChip: 'الاقتراح',
    colTaps: 'النقرات',
    noChips: 'لم يُنقر على أي اقتراح بعد.',
    emptyChip: '(فارغ)',
    dailyVolume: 'حجم المحادثات اليومي',
    noChatsInRange: 'لا توجد محادثات في هذه الفترة.',
    noData: 'لا توجد بيانات بعد.',
    dayBar: '{day} — مرات الفتح: {opens}، الزوار: {visitors}',
  },
});

type T = Translate<keyof typeof messages.en>;

/** Numeric columns line up at the end of the cell. */
const NUM: React.CSSProperties = { textAlign: 'end' };

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

const PRESETS: PresetKey[] = ['7', '30', '90', 'custom'];

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
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Range picker */}
      <Toolbar>
        <Tabs
          variant="segmented"
          size="sm"
          ariaLabel={t('period')}
          items={PRESETS.map((p) => ({ value: p, label: p === 'custom' ? t('custom') : t.plural('lastDays', Number(p)) }))}
          value={preset}
          onChange={setPreset}
        />
        {preset === 'custom' && (
          <>
            <label className="adm-flex">
              <span className="adm-toolbar-label">{t('from')}</span>
              <input
                type="date"
                className="adm-input adm-input-sm"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </label>
            <label className="adm-flex">
              <span className="adm-toolbar-label">{t('to')}</span>
              <input
                type="date"
                className="adm-input adm-input-sm"
                value={customTo}
                min={customFrom}
                max={todayIso()}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </label>
          </>
        )}
      </Toolbar>

      {loading && <Loading label={t('loading')} />}
      {error && <Alert tone="danger">{t('loadFailed', { error: String(error) })}</Alert>}

      {data && (
        <>
          <StatGrid>
            <StatCard icon="cohorts" tone="info" label={t('uniqueVisitors')} value={fmt(kpi?.uniqueVisitors || 0, t)} sub={t('uniqueVisitorsSub')} />
            <StatCard icon="bot" label={t('chatOpens')} value={fmt(kpi?.chatOpens || 0, t)} sub={t('chatOpensSub')} />
            <StatCard
              icon="chats"
              tone="violet"
              label={t('totalMessages')}
              value={fmt(kpi?.totalMessages || 0, t)}
              sub={t('totalMessagesSub', { user: fmt(kpi?.userMessages || 0, t), karo: fmt(kpi?.assistantMessages || 0, t) })}
            />
            <StatCard icon="insights" tone="info" label={t('avgPerConvo')} value={String(kpi?.avgMessagesPerConvo || 0)} sub={t('avgPerConvoSub')} />
            {/* Capped: a rate over 100% can only mean mismatched counts. */}
            <StatCard icon="whatsapp" tone="success" label={t('whatsappCtr')} value={`${Math.min(100, kpi?.whatsappCtr || 0)}%`} sub={t('whatsappCtrSub')} />
            <StatCard icon="alert" tone="warning" label={t('dropped')} value={fmt(kpi?.droppedConversations || 0, t)} sub={t('droppedSub')} />
          </StatGrid>

          <div className="adm-stack">
            {/* Two-column layout for the distribution tables */}
            <div className="adm-analytics-grid-2">
              <Card title={t('topCountries')} icon="language">
                {data.byCountry.length === 0 ? <EmptyState compact icon="language" title={t('noData')} /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>{t('colCountry')}</th>
                          <th style={NUM}>{t('colChats')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byCountry.map((row) => (
                          <tr key={row.country}>
                            <td>{row.country}</td>
                            <td style={NUM}>{fmt(row.count, t)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card title={t('langDist')} icon="language">
                {data.byLang.length === 0 ? <EmptyState compact icon="language" title={t('noData')} /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>{t('colLang')}</th>
                          <th style={NUM}>{t('colChats')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byLang.map((row) => (
                          <tr key={row.lang}>
                            <td><LangTag lang={row.lang} /></td>
                            <td style={NUM}>{fmt(row.count, t)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card title={t('topProducts')} icon="products">
                {data.topProducts.length === 0 ? <EmptyState compact icon="products" title={t('noProducts')} /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>{t('colProduct')}</th>
                          <th style={NUM}>{t('colHits')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topProducts.map((row) => (
                          <tr key={row.product_id}>
                            <td className="adm-cell-ltr"><code className="adm-mono">{row.product_id}</code></td>
                            <td style={NUM}>{fmt(row.hits, t)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card title={t('topChips')} icon="chats">
                {data.topFollowupChips.length === 0 ? <EmptyState compact icon="chats" title={t('noChips')} /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>{t('colChip')}</th>
                          <th style={NUM}>{t('colTaps')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topFollowupChips.map((row, i) => (
                          <tr key={`${row.chip}-${i}`}>
                            <td><bdi>{row.chip || t('emptyChip')}</bdi></td>
                            <td style={NUM}>{fmt(row.count, t)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            {/* Sparkline-style daily volume */}
            <Card title={t('dailyVolume')} icon="analytics">
              {/* byDay has every day of the range (quiet days as 0), so
                  "no chats" means every day is 0, not an empty list. */}
              {data.byDay.every((row) => row.opens === 0) ? <EmptyState compact icon="analytics" title={t('noChatsInRange')} /> : (
                <DailyBars rows={data.byDay} />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

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
              // Chart bar colour (series).
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
