import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { pickVariant, computeExperimentResults, __testInternals } from '../services/abTesting.mjs';
import { handleAdminAbTests } from '../routes/admin-ab-tests.mjs';

// Results + admin routes run against an in-memory copy of the tables.
const mem = vi.hoisted(() => ({ db: null }));
vi.mock('../db.mjs', () => ({ getDb: () => mem.db, logAudit: () => {} }));

const { fnv1a32 } = __testInternals;

/**
 * Tests for the deterministic variant resolver — the math + distribution
 * shape that makes A/B reports believable in the first place — plus the
 * results window and the variant lock, against a seeded in-memory DB.
 */

const freshDb = () => {
  mem.db = new Database(':memory:');
  mem.db.exec(`
    CREATE TABLE ab_experiments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      description TEXT, status TEXT NOT NULL DEFAULT 'draft', goal_event TEXT NOT NULL,
      started_at TEXT, stopped_at TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE ab_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT, experiment_id INTEGER NOT NULL, variant_key TEXT NOT NULL,
      label TEXT, weight INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE visitor_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, visitor_id TEXT, event_type TEXT NOT NULL,
      payload_json TEXT, created_at TEXT
    );
  `);
};

const addExperiment = ({ key = 'hero', status = 'running', started_at = null, stopped_at = null } = {}) => {
  const { lastInsertRowid: id } = mem.db.prepare(
    'INSERT INTO ab_experiments (key, name, status, goal_event, started_at, stopped_at) VALUES (?,?,?,?,?,?)',
  ).run(key, key, status, 'whatsapp_click', started_at, stopped_at);
  for (const vk of ['control', 'variant_a']) {
    mem.db.prepare('INSERT INTO ab_variants (experiment_id, variant_key, label, weight) VALUES (?,?,?,50)').run(id, vk, vk);
  }
  return Number(id);
};

const exposure = (visitor, variant, at, key = 'hero') =>
  mem.db.prepare('INSERT INTO visitor_events (visitor_id, event_type, payload_json, created_at) VALUES (?,?,?,?)')
    .run(visitor, 'variant_exposure', JSON.stringify({ experiment_key: key, variant_key: variant }), at);
const goal = (visitor, at) =>
  mem.db.prepare('INSERT INTO visitor_events (visitor_id, event_type, created_at) VALUES (?,?,?)')
    .run(visitor, 'whatsapp_click', at);

const control = (key = 'hero') => computeExperimentResults(key).results.find((r) => r.variant_key === 'control');

describe('fnv1a32', () => {
  it('returns a non-negative 32-bit integer', () => {
    expect(fnv1a32('hello')).toBeGreaterThanOrEqual(0);
    expect(fnv1a32('hello')).toBeLessThan(2 ** 32);
  });
  it('is deterministic', () => {
    expect(fnv1a32('karahoca')).toBe(fnv1a32('karahoca'));
  });
  it('changes on a single-bit input change', () => {
    expect(fnv1a32('karahoca')).not.toBe(fnv1a32('karahocb'));
  });
});

describe('pickVariant', () => {
  const variants = [
    { variant_key: 'control',   label: 'Control',   weight: 50 },
    { variant_key: 'variant_a', label: 'Variant A', weight: 50 },
  ];

  it('returns the same variant for the same (experiment, visitor) pair', () => {
    const a = pickVariant('hero_cta', 'visitor-1', variants);
    const b = pickVariant('hero_cta', 'visitor-1', variants);
    expect(a).toBe(b);
  });

  it('returns null for an empty variant list', () => {
    expect(pickVariant('x', 'v', [])).toBeNull();
  });

  it('always returns a key from the list', () => {
    for (let i = 0; i < 200; i++) {
      const v = pickVariant('test', `visitor-${i}`, variants);
      expect(['control', 'variant_a']).toContain(v);
    }
  });

  it('approximately respects the weight ratio at scale (50/50 → roughly 50% each)', () => {
    let control = 0;
    for (let i = 0; i < 5000; i++) {
      if (pickVariant('exp', `visitor-${i}`, variants) === 'control') control += 1;
    }
    // 5000 visitors, expected mean = 2500 with σ ≈ 35. Generous ±10% band
    // (450 each side) avoids flaky failures on the upper-bound tail.
    expect(control).toBeGreaterThan(2050);
    expect(control).toBeLessThan(2950);
  });

  it('respects skewed weights', () => {
    const skewed = [
      { variant_key: 'a', label: 'A', weight: 90 },
      { variant_key: 'b', label: 'B', weight: 10 },
    ];
    let a = 0;
    for (let i = 0; i < 5000; i++) {
      if (pickVariant('exp', `visitor-${i}`, skewed) === 'a') a += 1;
    }
    // 90/10 split → expect ~4500 in A. Allow generous band.
    expect(a).toBeGreaterThan(4300);
    expect(a).toBeLessThan(4700);
  });

  it('different experiments produce independent assignments for the same visitor', () => {
    // Across N visitors, the probability of two-experiment assignments
    // disagreeing should average ~50%. A naive "always-same-bucket"
    // bug would produce ~0%.
    let disagreed = 0;
    const total = 1000;
    for (let i = 0; i < total; i++) {
      const a = pickVariant('exp_a', `visitor-${i}`, variants);
      const b = pickVariant('exp_b', `visitor-${i}`, variants);
      if (a !== b) disagreed += 1;
    }
    expect(disagreed).toBeGreaterThan(total * 0.35);
    expect(disagreed).toBeLessThan(total * 0.65);
  });

  it('falls back to the first variant when all weights are zero', () => {
    const zeroed = [
      { variant_key: 'a', label: 'A', weight: 0 },
      { variant_key: 'b', label: 'B', weight: 0 },
    ];
    expect(pickVariant('exp', 'v', zeroed)).toBe('a');
  });
});

describe('computeExperimentResults — run window', () => {
  beforeEach(freshDb);

  it('ignores exposures and conversions from before started_at (a reused key)', () => {
    // An earlier experiment with the same key, since deleted, left these behind.
    exposure('old-1', 'control', '2026-01-05 10:00:00');
    goal('old-1', '2026-01-05 10:05:00');
    addExperiment({ started_at: '2026-10-01 09:00:00' });
    exposure('new-1', 'control', '2026-10-02 10:00:00');
    expect(control()).toMatchObject({ exposed: 1, converted: 0 });
  });

  it('counts nothing for an experiment that has not started', () => {
    exposure('old-1', 'control', '2026-01-05 10:00:00');
    addExperiment({ status: 'draft' });
    expect(control()).toMatchObject({ exposed: 0, converted: 0, rate: 0 });
  });

  it('stops counting at stopped_at once stopped', () => {
    addExperiment({ status: 'stopped', started_at: '2026-10-01 09:00:00', stopped_at: '2026-10-05 18:00:00' });
    exposure('in', 'control', '2026-10-02 10:00:00');
    goal('in', '2026-10-05 17:59:59');
    exposure('late', 'control', '2026-10-06 10:00:00');
    exposure('slow', 'control', '2026-10-03 10:00:00');
    goal('slow', '2026-10-07 10:00:00'); // converted after the stop
    expect(control()).toMatchObject({ exposed: 2, converted: 1 });
  });

  it('still requires the goal at or after the first exposure', () => {
    addExperiment({ started_at: '2026-10-01 09:00:00' });
    goal('v', '2026-10-02 09:00:00');
    exposure('v', 'control', '2026-10-02 10:00:00');
    expect(control()).toMatchObject({ exposed: 1, converted: 0 });
  });
});

describe('admin A/B routes — variant lock', () => {
  beforeEach(freshDb);

  const call = (method, url, body = {}) => {
    const out = {};
    handleAdminAbTests({ method }, {}, {
      body, url, origin: '', admin: { username: 'test' },
      sendJson: (_res, status, payload) => { out.status = status; out.body = payload; },
    });
    return out;
  };

  it('lets a draft change its weights', () => {
    const id = addExperiment({ status: 'draft' });
    expect(call('PUT', `/api/admin/ab-tests/${id}/variants/control`, { weight: 70 }).status).toBe(200);
  });

  it('refuses weight changes, additions and removals once running', () => {
    const id = addExperiment({ started_at: '2026-10-01 09:00:00' });
    expect(call('PUT', `/api/admin/ab-tests/${id}/variants/control`, { weight: 70 }).status).toBe(409);
    expect(call('POST', `/api/admin/ab-tests/${id}/variants`, { variant_key: 'variant_b' }).status).toBe(409);
    expect(call('DELETE', `/api/admin/ab-tests/${id}/variants/variant_a`).status).toBe(409);
    expect(call('PUT', `/api/admin/ab-tests/${id}/variants/control`, { label: 'Original' }).status).toBe(200);
  });

  it('refuses to send a started experiment back to draft', () => {
    const id = addExperiment({ status: 'stopped', started_at: '2026-10-01 09:00:00', stopped_at: '2026-10-02 09:00:00' });
    expect(call('PUT', `/api/admin/ab-tests/${id}`, { status: 'draft' }).status).toBe(409);
  });

  it('rejects an emptied, fractional or negative weight instead of saving it', () => {
    const id = addExperiment({ status: 'draft' });
    expect(call('PUT', `/api/admin/ab-tests/${id}/variants/control`, { weight: '' }).status).toBe(400);
    expect(call('PUT', `/api/admin/ab-tests/${id}/variants/control`, { weight: 2.5 }).status).toBe(400);
    expect(call('PUT', `/api/admin/ab-tests/${id}/variants/control`, { weight: -1 }).status).toBe(400);
  });

  it('restarting keeps started_at and clears the old stop', () => {
    const id = addExperiment({ status: 'stopped', started_at: '2026-10-01 09:00:00', stopped_at: '2026-10-02 09:00:00' });
    const { status, body } = call('POST', `/api/admin/ab-tests/${id}/start`);
    expect(status).toBe(200);
    expect(body.experiment).toMatchObject({ status: 'running', started_at: '2026-10-01 09:00:00', stopped_at: null });
  });
});
