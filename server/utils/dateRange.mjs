/**
 * server/utils/dateRange.mjs — the one parser for the admin's date-only
 * `from` / `to` filters (funnel, Karo insights, audit log, trend charts).
 *
 * Timestamps are stored as TEXT in two shapes:
 *
 *   visitor_events, admin_audit_log  'YYYY-MM-DD HH:MM:SS'      (SQLite datetime('now'), UTC)
 *   chat_messages                    'YYYY-MM-DDTHH:MM:SS.sssZ' (JS toISOString)
 *
 * and SQLite compares TEXT byte by byte. The old bounds broke on that:
 * `created_at <= '2026-10-13'` excluded every event OF the 13th (they
 * sort after the bare date), so "today" was never counted and From = To
 * always returned nothing; `BETWEEN 'D T00:00:00Z' AND …` dropped the
 * whole first day for the space-separated shape because ' ' < 'T'.
 *
 * The fix is to compare against bare days only:
 *
 *   created_at >= 'FROM'  AND  created_at < 'DAY AFTER TO'
 *
 * Every stored value of day D starts with 'D', so it sorts after the bare
 * 'D' and before 'D+1' — whichever of the two shapes it uses.
 *
 * All days are UTC calendar days ('YYYY-MM-DD').
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Longest window a dashboard query may scan — a year, leap day included. */
export const MAX_RANGE_DAYS = 366;

const msToDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (day) => Date.parse(`${day}T00:00:00Z`);

/** Today's UTC day. */
export const todayUtc = () => msToDay(Date.now());

/**
 * `s` when it is a real calendar day in 'YYYY-MM-DD' form, else null.
 * '2026-02-30' is rejected: Date would silently roll it to March 2nd.
 */
export const parseDay = (s) => {
  if (typeof s !== 'string') return null;
  const m = DAY_RE.exec(s);
  if (!m) return null;
  const ms = dayMs(s);
  if (Number.isNaN(ms) || msToDay(ms) !== s) return null;
  return s;
};

/** Shift a 'YYYY-MM-DD' day by `n` days (negative = back). */
export const addDays = (day, n) => msToDay(dayMs(day) + n * DAY_MS);

/** Number of days from `from` to `to`, both included. */
export const spanDays = (from, to) => Math.round((dayMs(to) - dayMs(from)) / DAY_MS) + 1;

/** Every day from `from` to `to`, both included. */
export const eachDay = (from, to) => {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};

/**
 * One row per day of [from, to]: `rows` (keyed by `key`, a 'YYYY-MM-DD'
 * day) where they exist, `zero(day)` everywhere else. GROUP BY day only
 * returns days that had activity, and a chart drawn from those joins the
 * busy days straight across the quiet ones — it looked continuous when
 * nothing happened for a week.
 */
export const fillDays = (rows, from, to, key, zero) => {
  const byDay = new Map(rows.map((r) => [r[key], r]));
  return eachDay(from, to).map((day) => byDay.get(day) ?? zero(day));
};

/**
 * Validate a `from` / `to` pair of 'YYYY-MM-DD' days.
 *
 * Options:
 *   defaultDays  when a bound is missing: `to` defaults to today and
 *                `from` to `to` minus this many days (the admin's "last
 *                N days" presets send the same pair). `null` leaves
 *                missing bounds open (audit log: "everything since …").
 *   maxDays      longest allowed span; `null` for no cap.
 *   today        injectable for tests.
 *
 * Returns { error } for a malformed day, from > to or a span over the
 * cap, otherwise
 *   { from, to, toExclusive, days }
 * where toExclusive is the day after `to` — the `<` bound for SQL — and
 * any of them is null when that bound is open.
 */
export const resolveDayRange = (
  { from, to } = {},
  { defaultDays = 30, maxDays = MAX_RANGE_DAYS, today = todayUtc() } = {},
) => {
  let fromDay = null;
  let toDay = null;
  if (from) {
    fromDay = parseDay(from);
    if (!fromDay) return { error: '"from" must be a date in YYYY-MM-DD form.' };
  }
  if (to) {
    toDay = parseDay(to);
    if (!toDay) return { error: '"to" must be a date in YYYY-MM-DD form.' };
  }
  if (defaultDays != null) {
    toDay = toDay ?? today;
    fromDay = fromDay ?? addDays(toDay, -defaultDays);
  }
  const days = fromDay && toDay ? spanDays(fromDay, toDay) : null;
  if (days != null && days < 1) return { error: '"from" must be on or before "to".' };
  if (days != null && maxDays != null && days > maxDays) {
    return { error: `The date range can cover at most ${maxDays} days.` };
  }
  return {
    from: fromDay,
    to: toDay,
    toExclusive: toDay ? addDays(toDay, 1) : null,
    days,
  };
};
