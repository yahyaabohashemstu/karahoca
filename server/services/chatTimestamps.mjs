/**
 * Rebuilding real timestamps for legacy chat messages.
 *
 * Until /api/chat/log validated it (2026-10-12), chat_messages.created_at
 * stored the chat widget's DISPLAY time — the visitor's local clock, no
 * date: "٠٣:٣٧ م" (ar-EG), "03:37 PM" (en-US), "15:37" (tr/ru).
 *
 * The date is recoverable from what the server did record, per visitor:
 *   - chat_users.first_seen — server time of the visitor's first log
 *     flush, sent right after their first exchange (seconds later);
 *   - chat_users.last_seen  — server time of their last flush.
 *
 * From the first message's local clock and first_seen we get the visitor's
 * UTC offset; walking the messages in id order, the clock going backwards
 * means midnight passed. When the conversation still ends days before
 * last_seen, the visitor came back later: the missing days go at the
 * longest pause, the likeliest place a new visit began.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
// The clock may step back a little inside one exchange (the reply
// rendered a minute before the question's batch was stamped); only a
// bigger step back means the day changed.
const ROLLOVER_TOLERANCE_MIN = 5;

/**
 * Minutes since local midnight from a widget display time, or null.
 * "٠٣:٣٧ م" → 937, "03:37 PM" → 937, "15:37" → 937, "12:05 AM" → 5.
 */
export const parseDisplayTime = (value) => {
  if (typeof value !== 'string') return null;
  const text = value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  const match = text.match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  // ar-EG writes ص (AM) / م (PM); en-US AM / PM.
  const isPm = /\bp\.?\s?m\b/i.test(text) || /م/.test(text);
  const isAm = /\ba\.?\s?m\b/i.test(text) || /ص/.test(text);
  if ((isPm || isAm) && hours > 12) return null;
  if (isPm && hours < 12) hours += 12;
  if (isAm && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const utcMinutesOfDay = (ms) => {
  const d = new Date(ms);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

/** Visitor's UTC offset in minutes (to the nearest 15), from one known pair. */
export const inferUtcOffsetMinutes = (localMinutes, utcMs) => {
  let diff = localMinutes - utcMinutesOfDay(utcMs);
  // Offsets run from UTC−12 to UTC+14.
  while (diff <= -720) diff += 1440;
  while (diff > 840) diff -= 1440;
  return Math.round(diff / 15) * 15;
};

/** Start of the local calendar day containing utcMs, as a UTC instant. */
const localMidnightUtcMs = (utcMs, offsetMin) => {
  const local = utcMs + offsetMin * MINUTE_MS;
  return local - (local % DAY_MS) - offsetMin * MINUTE_MS;
};

/**
 * @param {{ id: number, created_at: string }[]} messages one visitor's legacy
 *   rows (any order; sorted by id here)
 * @param {{ first_seen: string, last_seen: string }} user
 * @returns {Map<number, string>} id → ISO timestamp (UTC)
 */
export const reconstructVisitorTimestamps = (messages, user) => {
  const result = new Map();
  const firstMs = Date.parse(user?.first_seen);
  const lastMsRaw = Date.parse(user?.last_seen);
  if (!messages.length || Number.isNaN(firstMs)) return result;
  const lastMs = Number.isNaN(lastMsRaw) || lastMsRaw < firstMs ? firstMs : lastMsRaw;

  const rows = [...messages].sort((a, b) => a.id - b.id);
  // Unparseable clocks inherit the previous message's (or the first one's).
  let previous = null;
  const clocks = rows.map((row) => {
    const parsed = parseDisplayTime(row.created_at);
    if (parsed != null) previous = parsed;
    return parsed ?? previous;
  });
  const firstClock = clocks.find((c) => c != null);
  if (firstClock == null) {
    for (const row of rows) result.set(row.id, new Date(firstMs).toISOString());
    return result;
  }
  for (let i = 0; i < clocks.length && clocks[i] == null; i++) clocks[i] = firstClock;

  const offset = inferUtcOffsetMinutes(clocks[0], firstMs);

  // Forward pass from the first visit: the day advances when the clock
  // goes back.
  const dayStart = localMidnightUtcMs(firstMs, offset);
  let day = 0;
  const times = clocks.map((clock, i) => {
    if (i > 0 && clock < clocks[i - 1] - ROLLOVER_TOLERANCE_MIN) day += 1;
    return dayStart + day * DAY_MS + clock * MINUTE_MS;
  });

  // Ends whole days before the last visit → a later visit; shift
  // everything after the longest pause by the missing days.
  const missingDays = Math.floor((lastMs - times[times.length - 1] + 30 * MINUTE_MS) / DAY_MS);
  if (missingDays > 0 && times.length > 1) {
    let split = 1;
    for (let i = 2; i < times.length; i++) {
      if (times[i] - times[i - 1] > times[split] - times[split - 1]) split = i;
    }
    for (let i = split; i < times.length; i++) times[i] += missingDays * DAY_MS;
  }

  // Never before the first visit or after the last one (allowing the
  // flush delay and the 15-minute offset rounding).
  const lower = firstMs - 60 * MINUTE_MS;
  const upper = lastMs + 15 * MINUTE_MS;
  rows.forEach((row, i) => {
    const ms = Math.min(Math.max(times[i], lower), upper);
    result.set(row.id, new Date(ms).toISOString());
  });
  return result;
};
