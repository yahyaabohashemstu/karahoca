// ═══════════════════════════════════════════════════════════════════════════
// Client session id
// ─────────────────────────────────────────────────────────────────────────
// One UUID per browser tab (sessionStorage, not localStorage — we WANT this
// to rotate when the tab closes). Attached to every /api/log-error report
// so we can group an individual user's burst of errors without cookies.
//
// Persistence layer: sessionStorage. If the browser blocks it (private mode
// in Safari throws on write), we fall back to an in-memory id for this tab.
// Either way the API stays the same for callers.
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'karahoca_session_id';

let memoryFallback: string | null = null;

const generate = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Extremely narrow fallback — Chrome 91 and below / non-secure contexts.
  // Not as random as crypto.randomUUID but good enough for a session tag.
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const getClientSessionId = (): string => {
  if (typeof window === 'undefined') return 'ssr';

  if (memoryFallback) return memoryFallback;

  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const fresh = generate();
    window.sessionStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // Storage throws in Safari private mode & some corporate policies.
    memoryFallback = generate();
    return memoryFallback;
  }
};
