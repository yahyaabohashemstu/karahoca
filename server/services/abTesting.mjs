/**
 * server/services/abTesting.mjs — A/B testing variant resolver + results
 * computer.
 *
 * Design summary:
 *
 *   1. Variants are weighted (integers, default 1). Total weight per
 *      experiment = sum of variant weights. A visitor's assignment is
 *      `hash(experiment_key + visitor_id) % total_weight` mapped to
 *      the variant whose cumulative weight covers the bucket.
 *
 *   2. The hash is deterministic and stable across deployments — same
 *      visitor + same experiment always → same variant. This is the
 *      property that makes A/B reporting believable. We use FNV-1a
 *      32-bit because (a) it's tiny, (b) it has good bucket
 *      distribution for low-entropy keys like "exp_a-v123abc", and
 *      (c) it's not a cryptographic hash but doesn't need to be —
 *      no one's adversarial about which variant they see.
 *
 *   3. Reporting uses the existing visitor_events table — no
 *      conversion table to maintain. We pivot:
 *        - "exposure" = visitors who saw the experiment
 *          (any visitor_events row with payload_json.experiment_key)
 *        - "conversion" = exposed visitors who later fired the
 *          experiment's goal_event AT OR AFTER their first exposure
 *      so a visitor who whatsapp-clicked BEFORE seeing the variant
 *      isn't credited to it.
 *
 *   4. Lift + confidence are computed naively (z-test of two
 *      proportions). For KARAHOCA's volumes (hundreds of visitors per
 *      experiment per day) this is good enough; if a future test
 *      crosses tens of thousands we can revisit with Bayesian
 *      shrinkage.
 */

import { getDb } from '../db.mjs';

// ─── Variant resolver ───────────────────────────────────────────────────────

/**
 * FNV-1a 32-bit. Returns a non-negative integer.
 * Fast, dependency-free, well-distributed for short strings.
 */
const fnv1a32 = (input) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // Multiplication via additions / shifts to stay in 32-bit unsigned.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h;
};

/**
 * Pure-function variant picker. Given an experiment's variants and a
 * visitor id, returns the chosen variant key — deterministic across
 * calls. Exported separately from the route handler so a unit test
 * can verify distribution shape without touching the DB.
 */
export const pickVariant = (experimentKey, visitorId, variants) => {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  // Coerce + clamp weights to positive integers — defensive against an
  // admin who typed -3 in the weight input.
  const safeVariants = variants.map((v) => ({
    ...v,
    weight: Math.max(0, Number.isFinite(v.weight) ? Math.floor(v.weight) : 1),
  }));
  const total = safeVariants.reduce((s, v) => s + v.weight, 0);
  if (total <= 0) return safeVariants[0].variant_key;
  const bucket = fnv1a32(`${experimentKey}::${visitorId || 'anonymous'}`) % total;
  let cumulative = 0;
  for (const v of safeVariants) {
    cumulative += v.weight;
    if (bucket < cumulative) return v.variant_key;
  }
  // Should be unreachable — fall back to the last variant just in case
  // floating-point weirdness ever creeps in.
  return safeVariants[safeVariants.length - 1].variant_key;
};

/**
 * Fetch every running experiment with its variants. Returns the shape
 * the public /api/ab/active endpoint exposes to the SPA.
 *
 * Running experiments only — drafts are admin-only previews; stopped
 * tests aren't actively assigning anyone (the existing exposure events
 * are kept for the results report). The endpoint is cacheable by the
 * SPA for a few minutes because the cost of one visitor seeing the
 * old assignment for a tick after an admin toggles "stop" is zero —
 * the next page-view re-pulls and matches the new state.
 */
export const listRunningExperiments = () => {
  const db = getDb();
  const exps = db.prepare(`
    SELECT id, key, name, description, goal_event, started_at
    FROM ab_experiments
    WHERE status='running'
    ORDER BY started_at DESC NULLS LAST, id DESC
  `).all();
  if (exps.length === 0) return [];
  const vStmt = db.prepare(`
    SELECT variant_key, label, weight
    FROM ab_variants
    WHERE experiment_id=?
    ORDER BY id ASC
  `);
  return exps.map((e) => ({
    key: e.key,
    name: e.name,
    description: e.description,
    goal_event: e.goal_event,
    variants: vStmt.all(e.id),
  }));
};

// ─── Results computer ───────────────────────────────────────────────────────

/**
 * Two-sided z-test on the difference of two proportions. Returns the
 * one-tailed p-value of "B beats A" (smaller = more confidence). We
 * report `confidence = 1 - p` so the dashboard reads "95% confident
 * B wins" naturally.
 */
const zTestPValue = (xA, nA, xB, nB) => {
  if (nA <= 0 || nB <= 0) return 1;
  const pA = xA / nA;
  const pB = xB / nB;
  const pPool = (xA + xB) / (nA + nB);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / nA + 1 / nB));
  if (se === 0) return 1;
  const z = (pB - pA) / se;
  // Approximate normal CDF (one-sided) via the Abramowitz & Stegun
  // closed-form. Sufficient precision for confidence-display use.
  const ncdf = (x) => {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x) / Math.SQRT2;
    const t = 1 / (1 + p * ax);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
    return 0.5 * (1 + sign * y);
  };
  // P(z >= observed) under the null = 1 - cdf(z).
  return 1 - ncdf(z);
};

/**
 * Build the per-experiment results table.
 *
 * For each variant of the given experiment:
 *   - exposed   = unique visitor_ids with a variant_exposure event
 *                 for this experiment + variant
 *   - converted = subset of those who fired goal_event at or after
 *                 their first exposure
 *   - rate      = converted / exposed
 *   - lift      = (rate - baseline_rate) / baseline_rate
 *                 where baseline_rate = first variant's rate
 *   - confidence= 1 - p-value of z-test against the baseline
 */
export const computeExperimentResults = (experimentKey) => {
  const db = getDb();
  const exp = db.prepare(`
    SELECT id, key, name, description, status, goal_event, started_at, stopped_at
    FROM ab_experiments WHERE key=?
  `).get(experimentKey);
  if (!exp) return null;

  const variants = db.prepare(`
    SELECT variant_key, label, weight
    FROM ab_variants WHERE experiment_id=?
    ORDER BY id ASC
  `).all(exp.id);

  // For each variant, query the visitor_events table for exposures +
  // conversions. We use a single JOINED query per variant to avoid
  // pulling the whole event log into JS.
  const rows = variants.map((v) => {
    // Exposed: unique visitors with a matching variant_exposure event.
    // The payload_json holds { experiment_key, variant_key }. We use
    // json_extract (built-in to SQLite 3.45 / better-sqlite3) for the
    // comparison so we don't have to LIKE on raw JSON strings.
    const exposedRow = db.prepare(`
      SELECT COUNT(DISTINCT visitor_id) AS c
      FROM visitor_events
      WHERE event_type='variant_exposure'
        AND visitor_id IS NOT NULL
        AND json_extract(payload_json, '$.experiment_key') = ?
        AND json_extract(payload_json, '$.variant_key')    = ?
    `).get(exp.key, v.variant_key);
    const exposed = exposedRow?.c ?? 0;

    // Converted: visitors who had at least one goal_event AT OR AFTER
    // their first exposure to this variant. The inner subquery finds
    // each exposed visitor's first exposure timestamp, the outer
    // counts those who later fired the goal.
    const convertedRow = db.prepare(`
      WITH first_exposure AS (
        SELECT visitor_id, MIN(created_at) AS first_at
        FROM visitor_events
        WHERE event_type='variant_exposure'
          AND visitor_id IS NOT NULL
          AND json_extract(payload_json, '$.experiment_key') = ?
          AND json_extract(payload_json, '$.variant_key')    = ?
        GROUP BY visitor_id
      )
      SELECT COUNT(DISTINCT fe.visitor_id) AS c
      FROM first_exposure fe
      INNER JOIN visitor_events ve
        ON ve.visitor_id = fe.visitor_id
       AND ve.event_type = ?
       AND ve.created_at >= fe.first_at
    `).get(exp.key, v.variant_key, exp.goal_event);
    const converted = convertedRow?.c ?? 0;

    return {
      variant_key: v.variant_key,
      label: v.label || v.variant_key,
      weight: v.weight,
      exposed,
      converted,
      rate: exposed > 0 ? converted / exposed : 0,
    };
  });

  // Compute lift + confidence against the FIRST variant (the baseline).
  const baseline = rows[0];
  const enriched = rows.map((r, i) => {
    if (i === 0 || !baseline || baseline.exposed === 0) {
      return { ...r, lift: 0, confidence: 0 };
    }
    const lift = baseline.rate === 0 ? 0 : ((r.rate - baseline.rate) / baseline.rate) * 100;
    const p = zTestPValue(baseline.converted, baseline.exposed, r.converted, r.exposed);
    return {
      ...r,
      lift: Math.round(lift * 10) / 10,
      confidence: Math.round((1 - p) * 1000) / 10,
    };
  });

  return {
    experiment: {
      key: exp.key,
      name: exp.name,
      description: exp.description,
      status: exp.status,
      goal_event: exp.goal_event,
      started_at: exp.started_at,
      stopped_at: exp.stopped_at,
    },
    results: enriched,
  };
};

export const __testInternals = { fnv1a32 };
