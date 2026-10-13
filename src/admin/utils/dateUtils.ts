/**
 * SQLite stores dates as "YYYY-MM-DD HH:MM:SS" (UTC, no T/Z separator).
 * JavaScript's Date constructor requires ISO 8601 format.
 * These helpers convert SQLite dates before parsing.
 *
 * Dates follow the admin language (set by AdminI18nProvider) — never the
 * browser's: in an Arabic browser the English UI used to get
 * "18/4/2026" with right-to-left marks, which rendered as "182026/4/".
 * Both languages use Western digits and a 24-hour clock, so numbers read
 * the same whichever language the admin picks.
 */

import { getCurrentAdminLang } from '../i18n/currentLang';

const LOCALES = {
  en: 'en-GB',
  ar: 'ar-u-nu-latn',
} as const;

const locale = () => LOCALES[getCurrentAdminLang()];

const toISO = (d: string): string => {
  if (!d) return '';
  if (d.includes('T')) return d;           // already ISO
  return d.replace(' ', 'T') + 'Z';       // "2025-01-15 12:30:45" → "2025-01-15T12:30:45Z"
};

const parse = (d: string): Date | null => {
  const dt = new Date(toISO(d));
  return Number.isNaN(dt.getTime()) ? null : dt;
};

/** "13 Oct 2026" / "13 أكتوبر 2026" */
export const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  const dt = parse(d);
  return dt ? dt.toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' }) : d;
};

/** "13 Oct 2026, 14:05" (the viewer's local time) */
export const fmtDateTime = (d: string | null | undefined): string => {
  if (!d) return '—';
  const dt = parse(d);
  return dt
    ? dt.toLocaleString(locale(), {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
    : d;
};

/** "14:05" */
export const fmtTime = (d: string | null | undefined): string => {
  if (!d) return '—';
  const dt = parse(d);
  return dt ? dt.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : d;
};

/** "12,345" — Western digits whatever the language. */
export const fmtNumber = (n: number | null | undefined): string =>
  typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
