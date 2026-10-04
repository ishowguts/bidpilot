import type { Rng } from '../rng.js';
import type { Category, PublisherId } from '../scenarios.js';

export const POLICY_NAMES = ['thompson', 'equal', 'greedy', 'oracle'] as const;
export type PolicyName = (typeof POLICY_NAMES)[number];

/** What a policy may see about one arm on one past day. Ground truth is never part of it. */
export interface Observation {
  day: number;
  category: Category;
  publisherId: PublisherId;
  clicks: number;
  applies: number;
  /** ₹, rounded to paise. */
  spend: number;
  /** ₹ the policy allocated to this arm that day (its own decision, not ground truth). */
  budget: number;
}

/** One arm's budget for a day plus the policy's diagnostics (persisted with each allocation row, §6.2 step 5). */
export interface Allocation {
  category: Category;
  publisherId: PublisherId;
  budget: number;
  pBest?: number;
  alpha?: number;
  beta?: number;
  cpcEstimate?: number;
}

export interface Policy {
  readonly name: PolicyName;
  /**
   * Splits each category's budget for `day` across publishers.
   * @param observations every observation from days before `day`, in day order
   * @param categoryBudgets ₹ per category for `day`; categories with budget 0 may be omitted from the result
   * @param rng the policy stream for (seed, policy, day)
   * @param day the 1-based day being allocated
   */
  allocate(
    observations: readonly Observation[],
    categoryBudgets: Readonly<Record<Category, number>>,
    rng: Rng,
    day: number,
  ): Allocation[];
}
