import { describe, it, expect } from 'vitest';
import { armDay, hourTraffic } from './simulator.js';
import {
  CATEGORIES,
  DRIFT_DAY,
  HOURLY_WEIGHTS,
  PUBLISHER_IDS,
  armTruth,
  bestPublisher,
  trueCpa,
  type Category,
  type PublisherId,
  type ScenarioName,
} from './scenarios.js';

/** Buys every available click on one arm for `days` days and returns totals. */
function buyEverything(
  seed: number,
  scenario: ScenarioName,
  category: Category,
  publisher: PublisherId,
  fromDay: number,
  toDay: number,
): { clicks: number; applies: number; spend: number } {
  let clicks = 0;
  let applies = 0;
  let spend = 0;
  for (let day = fromDay; day <= toDay; day++) {
    const arm = armDay(seed, scenario, day, category, publisher);
    for (let hour = 0; hour < 24; hour++) {
      const traffic = hourTraffic(seed, day, hour, category, publisher, arm);
      clicks += traffic.available;
      applies += traffic.applies(traffic.available);
      spend += traffic.available * arm.cpc;
    }
  }
  return { clicks, applies, spend };
}

describe('scenarios', () => {
  it('hourly weights sum to 1 and peak in the day and evening windows', () => {
    expect(HOURLY_WEIGHTS).toHaveLength(24);
    expect(HOURLY_WEIGHTS.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    const peak = Math.max(...HOURLY_WEIGHTS);
    expect(HOURLY_WEIGHTS[3]!).toBeLessThan(peak / 10);
    for (const hour of [11, 12, 20, 21]) expect(HOURLY_WEIGHTS[hour]).toBe(peak);
  });

  it('cheapest CPC is not cheapest CPA, and the best arm cannot absorb the category budget', () => {
    for (const category of CATEGORIES) {
      const arms = PUBLISHER_IDS.map((pub) => ({ pub, ...armTruth('stationary', 1, category, pub) }));
      const cheapestCpc = arms.reduce((a, b) => (b.cpc < a.cpc ? b : a));
      const best = arms.find((a) => a.pub === bestPublisher(category))!;
      expect(cheapestCpc.pub).not.toBe(best.pub);
      // Default ₹20,000/day split evenly over 4 categories is ₹5,000 per category.
      expect(best.capacity * best.cpc).toBeLessThan(5000);
    }
  });

  it('drift halves the best arm apply rate from day 15 only', () => {
    for (const category of CATEGORIES) {
      const best = bestPublisher(category);
      const before = armTruth('drift', DRIFT_DAY - 1, category, best);
      const after = armTruth('drift', DRIFT_DAY, category, best);
      expect(before.applyRate).toBe(armTruth('stationary', DRIFT_DAY, category, best).applyRate);
      expect(after.applyRate).toBeCloseTo(before.applyRate / 2, 12);
      const other = PUBLISHER_IDS.find((p) => p !== best)!;
      expect(armTruth('drift', 30, category, other)).toEqual(armTruth('stationary', 30, category, other));
    }
  });
});

describe('simulator', () => {
  it('observed CPA over a long run converges to true CPA within 5%', () => {
    for (const category of CATEGORIES) {
      for (const publisher of [bestPublisher(category), 4 as PublisherId]) {
        const total = buyEverything(1, 'stationary', category, publisher, 1, 200);
        const observed = total.spend / total.applies;
        const truth = trueCpa(armTruth('stationary', 1, category, publisher));
        expect(Math.abs(observed / truth - 1)).toBeLessThan(0.05);
      }
    }
  });

  it('drift shows up in observed apply rates on day 15', () => {
    const category: Category = 'software';
    const best = bestPublisher(category);
    const before = buyEverything(3, 'drift', category, best, 1, DRIFT_DAY - 1);
    const after = buyEverything(3, 'drift', category, best, DRIFT_DAY, 60);
    const rateBefore = before.applies / before.clicks;
    const rateAfter = after.applies / after.clicks;
    expect(rateAfter / rateBefore).toBeGreaterThan(0.35);
    expect(rateAfter / rateBefore).toBeLessThan(0.65);
  });

  it('is deterministic and available clicks do not depend on the clicks bought', () => {
    const arm = armDay(5, 'stationary', 2, 'sales', 2);
    expect(armDay(5, 'stationary', 2, 'sales', 2)).toEqual(arm);
    const a = hourTraffic(5, 2, 12, 'sales', 2, arm);
    const b = hourTraffic(5, 2, 12, 'sales', 2, arm);
    expect(a.available).toBe(b.available);
    expect(a.applies(a.available)).toBe(b.applies(b.available));
    // A different seed gives different noise.
    expect(armDay(6, 'stationary', 2, 'sales', 2).cpc).not.toBe(arm.cpc);
  });

  it('rejects buying more clicks than available or drawing applies twice', () => {
    const arm = armDay(1, 'stationary', 1, 'software', 1);
    const t = hourTraffic(1, 1, 12, 'software', 1, arm);
    expect(() => t.applies(t.available + 1)).toThrow();
    t.applies(0);
    expect(() => t.applies(0)).toThrow();
  });
});
