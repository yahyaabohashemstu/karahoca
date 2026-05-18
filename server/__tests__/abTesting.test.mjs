import { describe, it, expect } from 'vitest';
import { pickVariant, __testInternals } from '../services/abTesting.mjs';

const { fnv1a32 } = __testInternals;

/**
 * Tests for the deterministic variant resolver. We don't touch the DB
 * here — the SQL-shaped paths (results computation, exposure events)
 * are integration territory and would need a seed dataset. What we DO
 * pin is the math + distribution shape that makes A/B reports
 * believable in the first place.
 */

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
