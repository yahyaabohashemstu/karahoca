/**
 * SQLite stores dates as "YYYY-MM-DD HH:MM:SS" (UTC, no T/Z separator).
 * JavaScript's Date constructor requires ISO 8601 format.
 * These helpers convert SQLite dates before parsing.
 *
 * The admin UI is English, so dates and numbers are formatted in one fixed
 * locale. They used to follow the browser's: in an Arabic browser
 * "18/4/2026" came out with right-to-left marks between the parts, and in
 * the left-to-right admin tables it rendered as "182026/4/".
 */

const LOCALE = 'en-GB';

const toISO = (d: string): string => {
  if (!d) return '';
  if (d.includes('T')) return d;           // already ISO
  return d.replace(' ', 'T') + 'Z';       // "2025-01-15 12:30:45" → "2025-01-15T12:30:45Z"
};

const parse = (d: string): Date | null => {
  const dt = new Date(toISO(d));
  return Number.isNaN(dt.getTime()) ? null : dt;
};

/** "13 Oct 2026" */
export const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  const dt = parse(d);
  return dt ? dt.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' }) : d;
};

/** "13 Oct 2026, 14:05" (the viewer's local time) */
export const fmtDateTime = (d: string | null | undefined): string => {
  if (!d) return '—';
  const dt = parse(d);
  return dt
    ? dt.toLocaleString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d;
};

/** "14:05" */
export const fmtTime = (d: string | null | undefined): string => {
  if (!d) return '—';
  const dt = parse(d);
  return dt ? dt.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }) : d;
};

/** "12,345" — Western digits whatever the browser language. */
export const fmtNumber = (n: number | null | undefined): string =>
  typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
