import { CATEGORIES, PUBLISHER_IDS, type Category, type PublisherId } from '../scenarios.js';
import { capacityEstimate, emptyPosterior, updatePosterior, type ArmPosterior } from '../posterior.js';
import type { Allocation, Observation, Policy } from './types.js';

/** Days of equal split before greedy commits. */
export const GREEDY_WARMUP_DAYS = 3;
const CAPACITY_HEADROOM = 1.2;

/**
 * Baseline (§6.3): equal split for the first 3 days, then 100% of each category's budget to the arm with the lowest
 * observed CPA (all-time spend / applies; arms without applies rank last), overflowing to the next arm when the
 * estimated capacity (same estimator as Thompson, without discount) is reached. No exploration.
 */
export function createGreedyPolicy(): Policy {
  return {
    name: 'greedy',
    allocate(observations, categoryBudgets, _rng, day): Allocation[] {
      if (day <= GREEDY_WARMUP_DAYS) {
        return CATEGORIES.flatMap((category) =>
          PUBLISHER_IDS.map((publisherId) => ({
            category,
            publisherId,
            budget: categoryBudgets[category] / PUBLISHER_IDS.length,
          })),
        );
      }
      return CATEGORIES.flatMap((category) => allocateCategory(category, observations, categoryBudgets[category]));
    },
  };
}

function allocateCategory(category: Category, observations: readonly Observation[], budget: number): Allocation[] {
  const totals = PUBLISHER_IDS.map((publisherId) => {
    const own = observations.filter((o) => o.category === category && o.publisherId === publisherId);
    let posterior: ArmPosterior = emptyPosterior();
    for (const o of own) posterior = updatePosterior(posterior, o.day, o, 1);
    const spend = own.reduce((s, o) => s + o.spend, 0);
    const clicks = own.reduce((s, o) => s + o.clicks, 0);
    const applies = own.reduce((s, o) => s + o.applies, 0);
    const capacity = capacityEstimate(posterior);
    return {
      publisherId,
      cpa: applies > 0 ? spend / applies : Infinity,
      cap: capacity === undefined || clicks === 0 ? Infinity : CAPACITY_HEADROOM * capacity * (spend / clicks),
    };
  });
  // Lowest CPA first; ties (including arms with no applies) keep publisher order.
  const order = [...totals].sort((a, b) => a.cpa - b.cpa);
  const budgets = new Map<PublisherId, number>();
  let left = budget;
  for (const arm of order) {
    const take = Math.min(left, arm.cap);
    budgets.set(arm.publisherId, take);
    left -= take;
  }
  return PUBLISHER_IDS.map((publisherId) => ({ category, publisherId, budget: budgets.get(publisherId) ?? 0 }));
}
