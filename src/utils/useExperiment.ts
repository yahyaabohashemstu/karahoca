/**
 * src/utils/useExperiment.ts — client-side A/B variant resolver hook
 * for KARAHOCA's experimentation framework (Phase G4).
 *
 * Behaviour:
 *
 *   1. On first call, `useExperiment(key)` reads the cached list of
 *      running experiments from sessionStorage (populated once per
 *      session by `bootstrapExperiments()` in main.tsx). If the
 *      experiment isn't running, the hook returns `null` — callers
 *      then render the "control" branch by default.
 *
 *   2. Variant picking uses a deterministic FNV-1a hash of
 *      `experiment_key + visitor_id`, mirroring the server-side
 *      pickVariant in server/services/abTesting.mjs. Same visitor →
 *      same variant across page loads, no server round-trip per
 *      page-view.
 *
 *   3. Once a variant is picked, we fire a single `variant_exposure`
 *      analytics event so the admin dashboard can attribute later
 *      goal events back to this assignment. The exposure event is
 *      idempotent per session — re-rendering the same component
 *      doesn't double-fire.
 *
 *   4. Consent-aware. If the visitor hasn't opted into analytics,
 *      `useExperiment` silently returns the deterministic variant
 *      WITHOUT firing the exposure event — so the page still
 *      renders the right branch but we don't pollute the visitor's
 *      event log.
 */

import { useEffect, useState } from 'react';
import { apiFetch } from './apiFetch';
import { getVisitorId } from './visitorIdentity';
import { track } from './track';

const STORAGE_KEY = 'karahoca_ab_experiments_v1';
const STORAGE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const EXPOSURE_FIRED_KEY = 'karahoca_ab_exposures_v1';

export interface AbVariant {
  variant_key: string;
  label: string | null;
  weight: number;
}
export interface AbExperiment {
  key: string;
  name: string;
  description: string | null;
  goal_event: string;
  variants: AbVariant[];
}

interface CachedFeed {
  experiments: AbExperiment[];
  fetchedAt: number;
}

// FNV-1a 32-bit — must match server/services/abTesting.mjs:fnv1a32 byte-for-byte
const fnv1a32 = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h;
};

export const pickVariant = (
  experimentKey: string,
  visitorId: string,
  variants: AbVariant[],
): string | null => {
  if (!variants || variants.length === 0) return null;
  const safe = variants.map((v) => ({
    ...v,
    weight: Math.max(0, Number.isFinite(v.weight) ? Math.floor(v.weight) : 1),
  }));
  const total = safe.reduce((s, v) => s + v.weight, 0);
  if (total <= 0) return safe[0].variant_key;
  const bucket = fnv1a32(`${experimentKey}::${visitorId || 'anonymous'}`) % total;
  let cum = 0;
  for (const v of safe) {
    cum += v.weight;
    if (bucket < cum) return v.variant_key;
  }
  return safe[safe.length - 1].variant_key;
};

const readCachedFeed = (): CachedFeed | null => {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedFeed;
    if (Date.now() - parsed.fetchedAt > STORAGE_TTL_MS) return null;
    return parsed;
  } catch { return null; }
};

const writeCachedFeed = (experiments: AbExperiment[]): void => {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ experiments, fetchedAt: Date.now() }));
  } catch { /* */ }
};

let inflightFetch: Promise<AbExperiment[]> | null = null;

/**
 * Fetch the running experiments feed (or return a cached one). Idempotent
 * within a session. Public so `bootstrapExperiments()` in main.tsx can
 * warm the cache before any component mounts.
 */
export const fetchActiveExperiments = async (): Promise<AbExperiment[]> => {
  const cached = readCachedFeed();
  if (cached) return cached.experiments;
  if (inflightFetch) return inflightFetch;
  inflightFetch = (async () => {
    try {
      const res = await apiFetch('/api/ab/active', { method: 'GET' });
      if (!res.ok) return [];
      const json = (await res.json()) as { success: boolean; experiments?: AbExperiment[] };
      const experiments = json.experiments || [];
      writeCachedFeed(experiments);
      return experiments;
    } catch {
      return [];
    } finally {
      inflightFetch = null;
    }
  })();
  return inflightFetch;
};

// Per-session "have we already fired exposure for {experiment}/{variant}" set.
const readFiredSet = (): Set<string> => {
  if (typeof sessionStorage === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(EXPOSURE_FIRED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
};
const writeFiredSet = (s: Set<string>): void => {
  if (typeof sessionStorage === 'undefined') return;
  try { sessionStorage.setItem(EXPOSURE_FIRED_KEY, JSON.stringify([...s])); } catch { /* */ }
};

/**
 * The hook. Resolves the variant for the named experiment and fires
 * the exposure event once per session per (experiment, variant) pair.
 *
 * Returns:
 *   - the variant_key string when an experiment is running, OR
 *   - `null` when the experiment isn't running / hasn't loaded yet
 *
 * Callers should treat `null` as "render the control branch" — that
 * way the page never blocks on the network request, and a user with
 * blocked tracking still sees a sensible UI.
 */
export const useExperiment = (experimentKey: string): string | null => {
  const [variant, setVariant] = useState<string | null>(() => {
    // Synchronous attempt to read from cache so the first render
    // already shows the right variant (avoids a flash of control).
    const cached = readCachedFeed();
    if (!cached) return null;
    const exp = cached.experiments.find((e) => e.key === experimentKey);
    if (!exp) return null;
    return pickVariant(experimentKey, getVisitorId(), exp.variants);
  });

  useEffect(() => {
    let cancelled = false;
    fetchActiveExperiments().then((experiments) => {
      if (cancelled) return;
      const exp = experiments.find((e) => e.key === experimentKey);
      if (!exp) { setVariant(null); return; }
      const v = pickVariant(experimentKey, getVisitorId(), exp.variants);
      setVariant(v);
      // Fire exposure once per session per (key, variant) pair.
      if (!v) return;
      const fired = readFiredSet();
      const tag = `${experimentKey}::${v}`;
      if (!fired.has(tag)) {
        fired.add(tag);
        writeFiredSet(fired);
        // The event type isn't in track.ts's EventType union — that's
        // intentional, because adding it there would force a SPA-wide
        // rebuild for any new variant. The server's allow-list does
        // include 'variant_exposure'.
        (track as unknown as (e: { event_type: string; payload?: Record<string, unknown> }) => void)({
          event_type: 'variant_exposure',
          payload: { experiment_key: experimentKey, variant_key: v },
        });
      }
    });
    return () => { cancelled = true; };
  }, [experimentKey]);

  return variant;
};
