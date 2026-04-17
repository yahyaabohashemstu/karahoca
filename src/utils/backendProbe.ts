import { apiFetch } from './apiFetch';

/**
 * Boot-time reachability probe for the Node API backend.
 *
 * Why this exists: in production the SPA (nginx) and the API (Node) live in
 * separate Coolify services. If `VITE_BACKEND_URL` is misconfigured or the
 * API service is down, every `/api/*` fetch silently 404s or hangs and the
 * user sees a dead frontend with no diagnostic. This probe catches the
 * situation at boot and lets the root component render a maintenance page
 * instead of a non-functional SPA.
 *
 * Behaviour:
 *   - Development: always reports "reachable" so a local `npm run dev:web`
 *     without the API server still works.
 *   - Production: fires a single low-timeout GET against `/api/health`.
 *     A response with `status === 'ok'` → reachable. Anything else → not.
 *   - Never throws. Callers subscribe to `subscribeBackendStatus(cb)` and
 *     react declaratively.
 *
 * We only probe once per page load; network state doesn't typically change
 * within a single session, and repeated probing would itself add latency.
 */

export type BackendStatus = 'unknown' | 'reachable' | 'unreachable';

let status: BackendStatus = 'unknown';
const listeners = new Set<(s: BackendStatus) => void>();

const emit = (next: BackendStatus) => {
  if (next === status) return;
  status = next;
  for (const listener of listeners) {
    try { listener(next); } catch { /* listener error is not our problem */ }
  }
};

export const getBackendStatus = (): BackendStatus => status;

export const subscribeBackendStatus = (
  cb: (s: BackendStatus) => void,
): (() => void) => {
  listeners.add(cb);
  // Notify the subscriber with the current value so it can render the
  // correct state immediately without waiting for the next emission.
  try { cb(status); } catch { /* */ }
  return () => { listeners.delete(cb); };
};

let probeStarted = false;

/**
 * Start the probe. Idempotent — safe to call from multiple entry points.
 * Runs once per page load.
 */
export const startBackendProbe = async (): Promise<void> => {
  if (probeStarted) return;
  probeStarted = true;

  // In dev and in any SSR-ish context: assume reachable. The dev proxy
  // will forward /api, and prerender runs against a local static server
  // where /api doesn't exist at all.
  if (typeof window === 'undefined' || import.meta.env.DEV) {
    emit('reachable');
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let response: Response;
    try {
      response = await apiFetch('/api/health', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      emit('unreachable');
      return;
    }
    const payload = await response.json().catch(() => null);
    emit(payload?.status === 'ok' ? 'reachable' : 'unreachable');
  } catch {
    emit('unreachable');
  }
};
