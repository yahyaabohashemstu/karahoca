import React, { useState } from 'react';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import {
  AdminIcon, Alert, Badge, Card, EmptyState, LangTag, Loading, PageHeader, Tabs, Toolbar, type IconName,
} from '../ui';

/**
 * Conversion funnel + search-terms dashboard (Phase G1 + G2).
 *
 * The funnel shows unique visitors at each step of the canonical
 * KARAHOCA path (page_view, product_view, chat_open,
 * chat_message_sent, whatsapp_click) and the per-step drop-off, so
 * the team can see EXACTLY where the conversion leaks happen.
 *
 * The search-terms block is the sister G2 panel — top normalised
 * queries from `search_query` events. Picking these up here means an
 * admin filtering the funnel by "last 7 days, Russian visitors" sees
 * the search terms ALSO scoped to that audience.
 */

const messages = defineMessages({
  en: {
    title: 'Conversion funnel',
    subtitle: 'Unique visitors at every step of the KARAHOCA conversion path, plus the most common search terms over the same window.',
    allLanguages: 'All languages',
    period: 'Period',
    lastDays: { other: 'Last {n} days' },
    from: 'From',
    to: 'To',
    funnel: 'Funnel',
    noVisitors: 'No visitors recorded in this window. Try a wider date range.',
    step_page_view: 'Visited the site',
    step_product_view: 'Viewed a product',
    step_chat_open: 'Opened Karo chat',
    step_chat_message_sent: 'Sent a chat message',
    step_whatsapp_click: 'Clicked WhatsApp',
    visitorsOfTop: { other: 'visitors · {pct}% of top' },
    drop: '–{pct}% drop',
    topSearchTerms: 'Top search terms',
    searchNote: 'Normalised (whitespace + case) so "  منظف " and "منظف  " roll up together. Filtered to terms of 2+ characters.',
    noSearchBefore: 'No search activity in this window — or the SPA isn\'t emitting',
    noSearchAfter: 'events yet for the search inputs you care about.',
    colTerm: 'Term',
    colHits: 'Hits',
    colTopLang: 'Top lang',
  },
  ar: {
    title: 'قمع التحويل',
    subtitle: 'عدد الزوار الفريدين في كل مرحلة من مسار التحويل في KARAHOCA، مع أكثر عبارات البحث شيوعًا خلال الفترة نفسها.',
    allLanguages: 'كل اللغات',
    period: 'الفترة',
    lastDays: { one: 'آخر يوم', two: 'آخر يومين', few: 'آخر {n} أيام', many: 'آخر {n} يومًا', other: 'آخر {n} يوم' },
    from: 'من',
    to: 'إلى',
    funnel: 'مراحل القمع',
    noVisitors: 'لم يُسجَّل أي زائر في هذه الفترة. جرّب نطاقًا زمنيًا أوسع.',
    step_page_view: 'زار الموقع',
    step_product_view: 'شاهد منتجًا',
    step_chat_open: 'فتح محادثة كارو',
    step_chat_message_sent: 'أرسل رسالة في المحادثة',
    step_whatsapp_click: 'نقر على WhatsApp',
    visitorsOfTop: {
      zero: 'زائر · {pct}% من المرحلة الأولى',
      one: 'زائر · {pct}% من المرحلة الأولى',
      two: 'زائران · {pct}% من المرحلة الأولى',
      few: 'زوار · {pct}% من المرحلة الأولى',
      many: 'زائرًا · {pct}% من المرحلة الأولى',
      other: 'زائر · {pct}% من المرحلة الأولى',
    },
    drop: 'تراجع {pct}%',
    topSearchTerms: 'أكثر عبارات البحث',
    searchNote: 'تُوحَّد العبارات (المسافات وحالة الأحرف) بحيث تُحتسب "  منظف " و"منظف  " عبارة واحدة. تُعرض فقط العبارات المكوّنة من حرفين أو أكثر.',
    noSearchBefore: 'لا يوجد نشاط بحث في هذه الفترة — أو أن الموقع لا يرسل بعد أحداث',
    noSearchAfter: 'من حقول البحث المطلوبة.',
    colTerm: 'العبارة',
    colHits: 'مرات البحث',
    colTopLang: 'اللغة الأكثر',
  },
});

type Key = keyof typeof messages.en;

// The server sends English step labels (and emoji icons, which the admin
// doesn't show); known steps get the admin's language and icon, any other
// step its label as sent.
const STEP_LABEL: Record<string, Key> = {
  page_view: 'step_page_view',
  product_view: 'step_product_view',
  chat_open: 'step_chat_open',
  chat_message_sent: 'step_chat_message_sent',
  whatsapp_click: 'step_whatsapp_click',
};

const STEP_ICON: Record<string, IconName> = {
  page_view: 'file',
  product_view: 'products',
  chat_open: 'bot',
  chat_message_sent: 'chats',
  whatsapp_click: 'whatsapp',
};

/** Funnel bar colour (chart series). */
const FUNNEL_COLOR = '#4f6ef7';

// Language names are written in their own language ("All" is translated).
const LANGS = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ru', label: 'Русский' },
];

type PresetKey = '7d' | '30d' | '90d' | 'custom';

const PRESET_RANGES: { key: PresetKey; days: number }[] = [
  { key: '7d',  days: 7 },
  { key: '30d', days: 30 },
  { key: '90d', days: 90 },
];

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const presetRange = (days: number) => {
  const to = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return { from: isoDate(from), to: isoDate(to) };
};

export const AdminFunnel: React.FC = () => {
  const t = useT(messages);
  const tc = useT(common);
  const [{ from, to }, setRange] = useState(() => presetRange(30));
  const [activePreset, setActivePreset] = useState<PresetKey>('30d');
  const [lang, setLang] = useState('');

  const { data, loading, error } = useAsync(
    () => adminApi.getFunnel({ from, to, lang: lang || undefined }),
    [from, to, lang],
  );

  const funnel = data?.funnel ?? [];
  const searchTerms = data?.searchTerms ?? [];
  const peak = funnel.length > 0 ? funnel[0].visitors : 0;

  const pickPreset = (key: PresetKey) => {
    const preset = PRESET_RANGES.find((p) => p.key === key);
    if (!preset) return;
    setActivePreset(key);
    setRange(presetRange(preset.days));
  };

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* A typed date leaves the presets ("custom" matches no tab). */}
      <Toolbar>
        <Tabs
          variant="segmented"
          size="sm"
          ariaLabel={t('period')}
          items={PRESET_RANGES.map((p) => ({ value: p.key, label: t.plural('lastDays', p.days) }))}
          value={activePreset}
          onChange={pickPreset}
        />
        <label className="adm-flex">
          <span className="adm-toolbar-label">{t('from')}</span>
          <input
            type="date"
            className="adm-input adm-input-sm"
            value={from}
            max={to}
            onChange={(e) => { setActivePreset('custom'); setRange((r) => ({ ...r, from: e.target.value })); }}
          />
        </label>
        <label className="adm-flex">
          <span className="adm-toolbar-label">{t('to')}</span>
          <input
            type="date"
            className="adm-input adm-input-sm"
            value={to}
            min={from}
            max={isoDate(new Date())}
            onChange={(e) => { setActivePreset('custom'); setRange((r) => ({ ...r, to: e.target.value })); }}
          />
        </label>
        <label className="adm-flex">
          <span className="adm-toolbar-label">{tc('language')}</span>
          <select
            className="adm-select adm-select-sm"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            <option value="">{t('allLanguages')}</option>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </label>
      </Toolbar>

      {loading && <Loading label={tc('loading')} />}
      {error && <Alert tone="danger">{error}</Alert>}

      {!loading && !error && (
        <div className="adm-stack">
          <Card title={t('funnel')} icon="funnel">
            {/* The server always returns all five steps, so "nothing
                happened" is a top step of 0 — five empty bars said nothing. */}
            {peak === 0 ? (
              <EmptyState compact icon="funnel" title={t('noVisitors')} />
            ) : (
              // Same rows as the Analytics rankings: the step on top, a
              // full-width track under it filled to its share of the top step.
              <div className="adm-ranking-list">
                {funnel.map((step, idx) => {
                  const widthPct = (step.visitors / peak) * 100;
                  return (
                    <div key={step.key} className="adm-ranking-row">
                      <div className="adm-ranking-top">
                        <div className="adm-ranking-label-wrap">
                          <AdminIcon name={STEP_ICON[step.key] ?? 'target'} size="sm" className="adm-ranking-icon adm-text-muted" />
                          <span className="adm-ranking-label">
                            {STEP_LABEL[step.key] ? t(STEP_LABEL[step.key]) : step.label}
                          </span>
                        </div>
                        <div className="adm-flex" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <strong>{fmtNumber(step.visitors)}</strong>
                          <span className="adm-text-sm adm-text-muted">
                            {t.plural('visitorsOfTop', step.visitors, { pct: String(step.conversionFromStart) })}
                          </span>
                          {idx > 0 && step.dropFromPrev > 0 && (
                            <Badge tone="danger">{t('drop', { pct: String(step.dropFromPrev) })}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="adm-ranking-track">
                        <div className="adm-ranking-fill" style={{ width: `${widthPct}%`, background: FUNNEL_COLOR }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title={t('topSearchTerms')} icon="search" subtitle={t('searchNote')}>
            {searchTerms.length === 0 ? (
              <EmptyState
                compact
                icon="search"
                title={<>{t('noSearchBefore')} <code>search_query</code> {t('noSearchAfter')}</>}
              />
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>#</th>
                      <th>{t('colTerm')}</th>
                      <th style={{ width: 100 }}>{t('colHits')}</th>
                      <th style={{ width: 100 }}>{t('colTopLang')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchTerms.map((s, idx) => (
                      <tr key={s.term}>
                        <td><span className="adm-text-sm adm-text-muted">{idx + 1}</span></td>
                        <td dir="auto">{s.term}</td>
                        <td><strong>{fmtNumber(s.count)}</strong></td>
                        <td>
                          {s.topLang ? <LangTag lang={s.topLang} /> : <span className="adm-text-muted">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
