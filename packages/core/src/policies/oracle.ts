import { CATEGORIES, PUBLISHER_IDS, armTruth, trueCpa, type ScenarioName } from '../scenarios.js';
import type { Allocation, Policy } from './types.js';

/**
 * Upper bound (§6.3): knows each arm's true CPC, apply rate and capacity for the day (including drift) and fills
 * arms in true-CPA order, each up to its expected daily spend capacity (capacity × CPC). Used for regret. It is
 * the only policy given the scenario; it never sees the daily noise.
 */
export function createOraclePolicy(scenario: ScenarioName): Policy {
  return {
    name: 'oracle',
    allocate(_observations, categoryBudgets, _rng, day): Allocation[] {
      return CATEGORIES.flatMap((category) => {
        const arms = PUBLISHER_IDS.map((publisherId) => ({ publisherId, truth: armTruth(scenario, day, category, publisherId) }));
        arms.sort((a, b) => trueCpa(a.truth) - trueCpa(b.truth));
        let left = categoryBudgets[category];
        const budgets = new Map(
          arms.map(({ publisherId, truth }) => {
            const take = Math.min(left, truth.capacity * truth.cpc);
            left -= take;
            return [publisherId, take] as const;
          }),
        );
        return PUBLISHER_IDS.map((publisherId) => ({ category, publisherId, budget: budgets.get(publisherId)! }));
      });
    },
  };
}
