import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { paceCategory, type PacingArm } from './pacing.js';
import { PUBLISHER_IDS } from './scenarios.js';

// One arm's random day: CPC in paise, daily click capacity, apply rate, and a positive allocation weight.
const armArb = fc.record({
  cpcPaise: fc.integer({ min: 300, max: 6000 }),
  capacity: fc.integer({ min: 50, max: 3000 }),
  applyRate: fc.double({ min: 0.001, max: 0.2, noNaN: true }),
  weight: fc.integer({ min: 1, max: 100 }),
});

const dayArb = fc.record({
  seed: fc.integer({ min: 0, max: 1_000_000 }),
  day: fc.integer({ min: 1, max: 90 }),
  // Budgets of at least ₹4,000 per category keep integer clicks from dominating (one click costs at most ₹60).
  budget: fc.integer({ min: 4_000, max: 200_000 }),
  arms: fc.array(armArb, { minLength: 6, maxLength: 6 }),
});

type RandomArm = { cpcPaise: number; capacity: number; applyRate: number; weight: number };

function pacingArms(budget: number, arms: readonly RandomArm[]): PacingArm[] {
  const totalWeight = arms.reduce((s, a) => s + a.weight, 0);
  return arms.map((a, i) => ({
    publisherId: PUBLISHER_IDS[i]!,
    budget: (budget * a.weight) / totalWeight,
    arm: { cpc: a.cpcPaise / 100, capacity: a.capacity, applyRate: a.applyRate },
  }));
}

describe('pacing properties (fast-check)', () => {
  it('day spend never exceeds the budget', () => {
    fc.assert(
      fc.property(dayArb, ({ seed, day, budget, arms }) => {
        const result = paceCategory(seed, day, 'software', pacingArms(budget, arms));
        expect(result.spend).toBeLessThanOrEqual(budget + 1e-6);
        expect(result.arms.reduce((s, a) => s + a.spend, 0)).toBeCloseTo(result.spend, 6);
        for (const a of result.arms) expect(a.applies).toBeLessThanOrEqual(a.clicks);
      }),
      { numRuns: 300 },
    );
  });

  it('spends at least 97% of the budget when capacity × CPC >= 1.2 × budget', () => {
    fc.assert(
      fc.property(dayArb, ({ seed, day, budget, arms }) => {
        const capacityValue = arms.reduce((s, a) => s + (a.capacity * a.cpcPaise) / 100, 0);
        fc.pre(capacityValue >= 1.2 * budget);
        const result = paceCategory(seed, day, 'software', pacingArms(budget, arms));
        expect(result.spend).toBeGreaterThanOrEqual(0.97 * budget);
      }),
      { numRuns: 300 },
    );
  });
});

describe('pacing', () => {
  it('moves budget off a capacity-limited arm to arms with spare clicks', () => {
    const arms: PacingArm[] = PUBLISHER_IDS.map((publisherId) => ({
      publisherId,
      // Publisher 1 gets most of the budget but can deliver only 20 clicks a day.
      budget: publisherId === 1 ? 5000 : 200,
      arm: { cpc: 10, capacity: publisherId === 1 ? 20 : 1000, applyRate: 0.05 },
    }));
    const result = paceCategory(1, 1, 'sales', arms);
    expect(result.spend).toBeGreaterThanOrEqual(0.97 * 6000);
    expect(result.arms[0]!.clicks).toBeLessThanOrEqual(60);
  });

  it('spends nothing on a zero budget and reports hourly rows that add up', () => {
    const zero = paceCategory(1, 1, 'sales', PUBLISHER_IDS.map((publisherId) => ({
      publisherId,
      budget: 0,
      arm: { cpc: 10, capacity: 100, applyRate: 0.05 },
    })));
    expect(zero.spend).toBe(0);
    expect(zero.hours).toHaveLength(0);

    const arms = pacingArms(6000, PUBLISHER_IDS.map(() => ({ cpcPaise: 1500, capacity: 500, applyRate: 0.05, weight: 1 })));
    const result = paceCategory(2, 3, 'logistics', arms);
    for (const a of result.arms) {
      const rows = result.hours.filter((h) => h.publisherId === a.publisherId);
      expect(rows.reduce((s, h) => s + h.clicks, 0)).toBe(a.clicks);
      expect(rows.reduce((s, h) => s + h.applies, 0)).toBe(a.applies);
    }
  });
});
