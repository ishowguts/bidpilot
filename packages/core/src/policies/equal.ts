import { CATEGORIES, PUBLISHER_IDS } from '../scenarios.js';
import type { Allocation, Policy } from './types.js';

/** Baseline (§6.3): every arm in a category gets the same share every day. */
export function createEqualPolicy(): Policy {
  return {
    name: 'equal',
    allocate(_observations, categoryBudgets): Allocation[] {
      return CATEGORIES.flatMap((category) =>
        PUBLISHER_IDS.map((publisherId) => ({
          category,
          publisherId,
          budget: categoryBudgets[category] / PUBLISHER_IDS.length,
        })),
      );
    },
  };
}
