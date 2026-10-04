// Publisher ground truth and scenarios (ARCHITECTURE §5.1). Hidden from policies: policies only receive
// observations, never anything exported from this file except the category and publisher identifiers.

export const CATEGORIES = ['software', 'sales', 'healthcare', 'logistics'] as const;
export type Category = (typeof CATEGORIES)[number];

/** Publisher ids 1..6 match the seeded `publishers` rows `pub-a` .. `pub-f`. */
export const PUBLISHER_IDS = [1, 2, 3, 4, 5, 6] as const;
export type PublisherId = (typeof PUBLISHER_IDS)[number];

export const PUBLISHER_SLUGS: Record<PublisherId, string> = {
  1: 'pub-a',
  2: 'pub-b',
  3: 'pub-c',
  4: 'pub-d',
  5: 'pub-e',
  6: 'pub-f',
};

export const SCENARIOS = ['stationary', 'drift', 'emergence'] as const;
export type ScenarioName = (typeof SCENARIOS)[number];

export interface ArmTruth {
  /** Cost per click, ₹. */
  cpc: number;
  /** Applies per click. */
  applyRate: number;
  /** Clicks available per day, spread over the hours by the traffic curve. */
  capacity: number;
}

type CategoryTruth = Record<PublisherId, ArmTruth>;

// Design rule (§5.1): in every category the cheapest CPC (publisher D) has the worst CPA, and the best-CPA arm
// (publisher C) cannot absorb the category's share of the default ₹20,000 budget (about ₹5,000 per category),
// so the optimal allocation fills C and then moves down the CPA order.
const BASE_TRUTH: Record<Category, CategoryTruth> = {
  software: {
    1: { cpc: 12, applyRate: 0.02, capacity: 900 }, // CPA 600
    2: { cpc: 18, applyRate: 0.045, capacity: 300 }, // CPA 400
    3: { cpc: 25, applyRate: 0.08, capacity: 120 }, // CPA 312.5, best, about ₹3,000/day of capacity
    4: { cpc: 8, applyRate: 0.01, capacity: 2000 }, // CPA 800, cheapest CPC
    5: { cpc: 30, applyRate: 0.06, capacity: 300 }, // CPA 500
    6: { cpc: 15, applyRate: 0.03, capacity: 700 }, // CPA 500
  },
  sales: {
    1: { cpc: 10, applyRate: 0.015, capacity: 1000 }, // CPA 667
    2: { cpc: 15, applyRate: 0.04, capacity: 400 }, // CPA 375
    3: { cpc: 22, applyRate: 0.075, capacity: 150 }, // CPA 293, best
    4: { cpc: 7, applyRate: 0.008, capacity: 2500 }, // CPA 875, cheapest CPC
    5: { cpc: 28, applyRate: 0.05, capacity: 350 }, // CPA 560
    6: { cpc: 14, applyRate: 0.025, capacity: 800 }, // CPA 560
  },
  healthcare: {
    1: { cpc: 15, applyRate: 0.025, capacity: 800 }, // CPA 600
    2: { cpc: 20, applyRate: 0.05, capacity: 250 }, // CPA 400
    3: { cpc: 30, applyRate: 0.09, capacity: 100 }, // CPA 333, best
    4: { cpc: 10, applyRate: 0.012, capacity: 1800 }, // CPA 833, cheapest CPC
    5: { cpc: 35, applyRate: 0.07, capacity: 200 }, // CPA 500
    6: { cpc: 18, applyRate: 0.035, capacity: 600 }, // CPA 514
  },
  logistics: {
    1: { cpc: 8, applyRate: 0.012, capacity: 1200 }, // CPA 667
    2: { cpc: 12, applyRate: 0.03, capacity: 500 }, // CPA 400
    3: { cpc: 18, applyRate: 0.06, capacity: 200 }, // CPA 300, best
    4: { cpc: 5, applyRate: 0.005, capacity: 3000 }, // CPA 1000, cheapest CPC
    5: { cpc: 20, applyRate: 0.04, capacity: 400 }, // CPA 500
    6: { cpc: 10, applyRate: 0.02, capacity: 900 }, // CPA 500
  },
};

/** First day (1-based) on which the drift scenario applies. */
export const DRIFT_DAY = 15;
const DRIFT_FACTOR = 0.5;

/**
 * Emergence scenario: publisher A starts as a poor arm (CPA ₹600-667) and from day 10 its apply rate triples, which
 * makes it the best arm in every category (CPA ₹200-222) with more capacity than the category budget. A policy
 * only finds this out if it keeps exploring.
 */
export const EMERGENCE_DAY = 10;
export const EMERGING_PUBLISHER: PublisherId = 1;
const EMERGENCE_FACTOR = 3;

/** Daily noise (§5.1): CPC × lognormal(0, 0.15), apply rate × lognormal(0, 0.10). */
export const CPC_NOISE_SIGMA = 0.15;
export const APPLY_RATE_NOISE_SIGMA = 0.1;

/** True CPA of an arm, ₹ per apply. */
export function trueCpa(arm: ArmTruth): number {
  return arm.cpc / arm.applyRate;
}

/** The publisher with the lowest true CPA in a category before any drift. */
export function bestPublisher(category: Category): PublisherId {
  let best: PublisherId = PUBLISHER_IDS[0];
  for (const pub of PUBLISHER_IDS) {
    if (trueCpa(BASE_TRUTH[category][pub]) < trueCpa(BASE_TRUTH[category][best])) best = pub;
  }
  return best;
}

/**
 * Ground truth for one arm on a 1-based day, before daily noise. In the drift scenario the best arm of every
 * category loses half its apply rate from `DRIFT_DAY` on. In the emergence scenario publisher A triples its apply
 * rate from `EMERGENCE_DAY` on.
 */
export function armTruth(scenario: ScenarioName, day: number, category: Category, publisher: PublisherId): ArmTruth {
  const base = BASE_TRUTH[category][publisher];
  if (scenario === 'drift' && day >= DRIFT_DAY && publisher === bestPublisher(category)) {
    return { ...base, applyRate: base.applyRate * DRIFT_FACTOR };
  }
  if (scenario === 'emergence' && day >= EMERGENCE_DAY && publisher === EMERGING_PUBLISHER) {
    return { ...base, applyRate: base.applyRate * EMERGENCE_FACTOR };
  }
  return base;
}

// Relative traffic by hour of day: low at night, peaks 10:00-13:00 and 19:00-22:00 (§5.1).
const RAW_HOURLY = [
  1, 0.6, 0.4, 0.3, 0.3, 0.5, 1, 2, 3.5, 4.5, 6, 6.5, 6.5, 6, 4.5, 4, 4, 4.5, 5, 6, 6.5, 6.5, 5, 2.5,
];
const RAW_TOTAL = RAW_HOURLY.reduce((a, b) => a + b, 0);

/** Hourly traffic weights w[0..23], summing to 1. */
export const HOURLY_WEIGHTS: readonly number[] = RAW_HOURLY.map((w) => w / RAW_TOTAL);
