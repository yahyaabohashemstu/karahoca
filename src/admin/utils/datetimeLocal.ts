// <input type="datetime-local"> speaks LOCAL wall-clock time
// ("2026-10-12T14:00"), while publish_at is stored as a UTC ISO string
// ("2026-10-12T11:00:00.000Z" for Istanbul) so the server's
// `datetime(publish_at) <= datetime('now')` compares like with like.
//
// The editors used to feed the stored ISO string straight back via
// `.slice(0, 16)` — i.e. the UTC clock time. In Turkey the picker showed
// 11:00 right after the admin typed 14:00, and every further edit shifted
// the value another three hours.

const pad = (n: number) => String(n).padStart(2, '0');

/** Stored ISO (or legacy local) string → value for a datetime-local input. */
export const toDatetimeLocalValue = (stored: string | null | undefined): string => {
  if (!stored) return '';
  const date = new Date(stored);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** datetime-local input value → UTC ISO string, or '' when cleared/invalid. */
export const fromDatetimeLocalValue = (value: string): string => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};
