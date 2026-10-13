import React, { useState } from 'react';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { Alert, Card, EmptyState, Loading, PageHeader, Tabs, Toolbar } from '../ui';

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
 *
 * Periods that haven't started yet come back as `null` and render as an
 * empty hatched cell, distinct from a real 0%.
 */

const messages = defineMessages({
  en: {
    title: 'Cohort retention',
    subtitleWeek: 'Visitors are grouped by the week of their first-ever visit; each cell shows how many of them came back in the weeks that follow. Hover a cell to see absolute counts.',
    subtitleMonth: 'Visitors are grouped by the month of their first-ever visit; each cell shows how many of them came back in the months that follow. Hover a cell to see absolute counts.',
    bucket: 'Bucket',
    weekly: 'Weekly',
    monthly: 'Monthly',
    periods: 'Periods',
    allLanguages: 'All languages',
    noCohorts: 'No cohorts found in this window.',
    colCohort: 'Cohort',
    colSize: 'Size',
    colWeek: 'W+{n}',
    colMonth: 'M+{n}',
    notStarted: '{label} hasn\'t started yet',
    notReached: 'Not reached yet',
    returnedWeek: '{returners} of {size} returned in the week of {label}',
    returnedMonth: '{returners} of {size} returned in the month of {label}',
  },
  ar: {
    title: 'مجموعات الاحتفاظ',
    subtitleWeek: 'يُجمَّع الزوار حسب أسبوع زيارتهم الأولى؛ وتُظهر كل خلية نسبة من عاد منهم في الأسابيع التالية. مرّر المؤشر فوق أي خلية لرؤية الأعداد الفعلية.',
    subtitleMonth: 'يُجمَّع الزوار حسب شهر زيارتهم الأولى؛ وتُظهر كل خلية نسبة من عاد منهم في الأشهر التالية. مرّر المؤشر فوق أي خلية لرؤية الأعداد الفعلية.',
    bucket: 'التجميع',
    weekly: 'أسبوعي',
    monthly: 'شهري',
    periods: 'عدد الفترات',
    allLanguages: 'كل اللغات',
    noCohorts: 'لا توجد مجموعات في هذه الفترة.',
    colCohort: 'المجموعة',
    colSize: 'الحجم',
    colWeek: 'الأسبوع {n}',
    colMonth: 'الشهر {n}',
    notStarted: 'الفترة {label} لم تبدأ بعد',
    notReached: 'لم تُبلَغ بعد',
    returnedWeek: 'عاد {returners} من أصل {size} في الأسبوع الذي يبدأ {label}',
    returnedMonth: 'عاد {returners} من أصل {size} في الشهر الذي يبدأ {label}',
  },
});

type Bucket = 'week' | 'month';

// Language names are written in their own language ("All" is translated).
const LANGS = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ru', label: 'Русский' },
];

const PERIOD_CHOICES = [4, 6, 8, 12, 16, 24];

/**
 * Pick a background colour for a retention cell. Hue is fixed (the
 * brand blue); the alpha encodes magnitude so the matrix reads as a
 * heatmap without dragging in a colour library. Cells with pct=0
 * stay transparent so "nobody came back" looks empty rather than just
 * "deeply blue and confusing."
 */
const cellBg = (pct: number) => {
  if (pct <= 0) return 'transparent';
  // Map 0–100 to alpha 0.05–0.85 with a touch of curve so 10-20% range
  // is already visible.
  const alpha = Math.min(0.85, 0.05 + Math.sqrt(pct / 100) * 0.8);
  return `rgba(79, 110, 247, ${alpha.toFixed(2)})`;
};

/** Not-yet-reached period: faint diagonal hatch, no number. */
const FUTURE_CELL_BG =
  'repeating-linear-gradient(135deg, transparent 0 6px, rgba(255, 255, 255, 0.04) 6px 12px)';

/**
 * The sticky Cohort column must be opaque, or the cells scrolling under
 * it show through (the glass tints are translucent). The table sits on
 * two glass layers (the card and the table frame) over the page's solid
 * base colour, so the cell paints the same stack.
 */
const STICKY_BG =
  'linear-gradient(var(--adm-glass), var(--adm-glass)), linear-gradient(var(--adm-glass), var(--adm-glass)), var(--adm-bg-mid)';

const STICKY: React.CSSProperties = { position: 'sticky', insetInlineStart: 0, background: STICKY_BG, zIndex: 1 };

export const AdminCohorts: React.FC = () => {
  const t = useT(messages);
  const tc = useT(common);
  const [bucket, setBucket] = useState<Bucket>('week');
  const [periods, setPeriods] = useState(8);
  const [lang, setLang] = useState('');

  const { data, loading, error } = useAsync(
    () => adminApi.getCohorts({ bucket, periods, lang: lang || undefined }),
    [bucket, periods, lang],
  );

  const cohorts = data?.cohorts ?? [];

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={bucket === 'week' ? t('subtitleWeek') : t('subtitleMonth')}
      />

      <Toolbar>
        <Tabs<Bucket>
          variant="segmented"
          size="sm"
          ariaLabel={t('bucket')}
          items={[
            { value: 'week', label: t('weekly') },
            { value: 'month', label: t('monthly') },
          ]}
          value={bucket}
          onChange={setBucket}
        />
        <label className="adm-flex">
          <span className="adm-toolbar-label">{t('periods')}</span>
          <select
            className="adm-select adm-select-sm"
            value={periods}
            onChange={(e) => setPeriods(Number(e.target.value))}
            style={{ minWidth: 0 }}
          >
            {PERIOD_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
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
        <Card flush>
          {cohorts.length === 0 ? (
            <EmptyState compact icon="cohorts" title={t('noCohorts')} />
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    <th style={{ ...STICKY, minWidth: 130 }}>{t('colCohort')}</th>
                    <th style={{ minWidth: 60 }}>{t('colSize')}</th>
                    {Array.from({ length: periods }, (_, p) => (
                      <th key={p} style={{ textAlign: 'center', minWidth: 70 }}>
                        {bucket === 'week' ? t('colWeek', { n: p }) : t('colMonth', { n: p })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((c) => (
                    <tr key={c.cohort}>
                      <td style={{ ...STICKY, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        <span className="adm-text-sm">{c.cohort}</span>
                      </td>
                      <td><span className="adm-text-sm adm-text-muted">{fmtNumber(c.size)}</span></td>
                      {c.retention.map((r) => {
                        // null = this period hasn't started yet (no data);
                        // 0 = it has, and nobody came back.
                        const pct: number | null = r.pct;
                        if (pct === null) {
                          return (
                            <td
                              key={r.period}
                              title={t('notStarted', { label: r.label })}
                              aria-label={t('notReached')}
                              style={{ background: FUTURE_CELL_BG }}
                            />
                          );
                        }
                        // Heatmap cell: background and label colour are the chart's.
                        return (
                          <td
                            key={r.period}
                            title={t(bucket === 'week' ? 'returnedWeek' : 'returnedMonth', {
                              returners: fmtNumber(r.returners),
                              size: fmtNumber(c.size),
                              label: r.label,
                            })}
                            style={{
                              textAlign: 'center',
                              fontWeight: 600,
                              background: cellBg(pct),
                              color: pct >= 50 ? '#fff' : undefined,
                            }}
                          >
                            <span className={pct === 0 ? 'adm-text-sm adm-text-muted' : 'adm-text-sm'}>{pct}%</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
