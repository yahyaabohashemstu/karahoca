import React, { useState } from 'react';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtNumber } from '../utils/dateUtils';
import { defineMessages, useAdminLang, useT } from '../i18n/core';
import { common } from '../i18n/common';

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

const messages = defineMessages({
  en: {
    title: 'Conversion Funnel',
    subtitle: 'Unique visitors at every step of the KARAHOCA conversion path, plus the most common search terms over the same window.',
    allLanguages: 'All languages',
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

// The server sends English step labels; known steps are shown in the
// admin's language, any other step as sent.
const STEP_LABEL: Record<string, Key> = {
  page_view: 'step_page_view',
  product_view: 'step_product_view',
  chat_open: 'step_chat_open',
  chat_message_sent: 'step_chat_message_sent',
  whatsapp_click: 'step_whatsapp_click',
};

// Language names are written in their own language ("All" is translated).
const LANGS = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ru', label: 'Русский' },
];

const PRESET_RANGES = [
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
  const { dir } = useAdminLang();
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
          <h1 className="adm-page-title">{t('title')}</h1>
          <p className="adm-page-subtitle">{t('subtitle')}</p>
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
              {t.plural('lastDays', p.days)}
            </button>
          ))}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>{t('from')}</span>
          <input
            type="date"
            className="adm-input adm-input-sm"
            value={from}
            max={to}
            onChange={(e) => { setActivePreset('custom'); setRange((r) => ({ ...r, from: e.target.value })); }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>{t('to')}</span>
          <input
            type="date"
            className="adm-input adm-input-sm"
            value={to}
            min={from}
            max={isoDate(new Date())}
            onChange={(e) => { setActivePreset('custom'); setRange((r) => ({ ...r, to: e.target.value })); }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>{tc('language')}</span>
          <select
            className="adm-select adm-input-sm"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="">{t('allLanguages')}</option>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </label>
      </div>

      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> {tc('loading')}</div>}
      {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}

      {!loading && !error && (
        <>
          <div className="adm-card" style={{ marginBottom: 16 }}>
            <div className="adm-card-title">{t('funnel')}</div>
            {/* The server always returns all five steps, so "nothing
                happened" is a top step of 0 — five empty bars said nothing. */}
            {peak === 0 ? (
              <div style={{ color: 'var(--adm-text-dim)', fontSize: 13, marginTop: 12 }}>
                {t('noVisitors')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {funnel.map((step, idx) => {
                  const widthPct = (step.visitors / peak) * 100;
                  // Full-width row: a track with the fill drawn under the
                  // text. The fill used to BE the row, so a small step
                  // shrank to its 200px minimum and the text wrapped onto
                  // three lines.
                  return (
                    <div
                      key={step.key}
                      style={{
                        position: 'relative',
                        height: 48,
                        borderRadius: 6,
                        overflow: 'hidden',
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderInlineStart: '3px solid #4f6ef7',
                      }}
                    >
                      <div
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          insetInlineStart: 0,
                          width: `${widthPct}%`,
                          // Strongest at the start of the row in either direction.
                          background: `linear-gradient(${dir === 'rtl' ? '270deg' : '90deg'}, rgba(79, 110, 247, 0.32), rgba(79, 110, 247, 0.12))`,
                          transition: 'width 0.4s ease',
                        }}
                      />
                      <div
                        style={{
                          position: 'relative',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '0 14px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span style={{ fontSize: 18, flexShrink: 0 }} aria-hidden="true">{step.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {STEP_LABEL[step.key] ? t(STEP_LABEL[step.key]) : step.label}
                        </span>
                        <span style={{ marginInlineStart: 'auto', fontSize: 12, color: 'var(--adm-text-muted)', flexShrink: 0 }}>
                          <strong style={{ color: 'var(--adm-text)' }}>{fmtNumber(step.visitors)}</strong>{' '}
                          {t.plural('visitorsOfTop', step.visitors, { pct: String(step.conversionFromStart) })}
                        </span>
                        {idx > 0 && step.dropFromPrev > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>
                            {t('drop', { pct: String(step.dropFromPrev) })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="adm-card">
            <div className="adm-card-title">{t('topSearchTerms')}</div>
            <p style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginTop: 4, marginBottom: 12 }}>
              {t('searchNote')}
            </p>
            {searchTerms.length === 0 ? (
              <div style={{ color: 'var(--adm-text-dim)', fontSize: 13 }}>
                {t('noSearchBefore')} <code>search_query</code> {t('noSearchAfter')}
              </div>
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
                        <td style={{ color: 'var(--adm-text-dim)', fontSize: 12 }}>{idx + 1}</td>
                        <td>
                          <span dir="auto" style={{ fontSize: 14 }}>{s.term}</span>
                        </td>
                        <td><strong>{fmtNumber(s.count)}</strong></td>
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
