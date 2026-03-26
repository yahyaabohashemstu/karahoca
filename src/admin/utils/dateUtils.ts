/**
 * SQLite stores dates as "YYYY-MM-DD HH:MM:SS" (UTC, no T/Z separator).
 * JavaScript's Date constructor requires ISO 8601 format.
 * These helpers convert SQLite dates before parsing.
 */

const toISO = (d: string): string => {
  if (!d) return '';
  if (d.includes('T')) return d;           // already ISO
  return d.replace(' ', 'T') + 'Z';       // "2025-01-15 12:30:45" → "2025-01-15T12:30:45Z"
};

export const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  const dt = new Date(toISO(d));
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString();
};

export const fmtDateTime = (d: string | null | undefined): string => {
  if (!d) return '—';
  const dt = new Date(toISO(d));
  return isNaN(dt.getTime()) ? d : dt.toLocaleString();
};

export const fmtTime = (d: string | null | undefined): string => {
  if (!d) return '—';
  const dt = new Date(toISO(d));
  return isNaN(dt.getTime()) ? d : dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};
