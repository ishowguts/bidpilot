import { type PublisherId, type Category } from '../scenarios.js';
import { type RNG } from '../rng.js';

export interface Observation {
  category: Category;
  publisherId: PublisherId;
  clicks: number;
  applies: number;
  spend: number;
}

export interface Allocation {
  category: Category;
  publisherId: PublisherId;
  budget: number;
  // Metadata for DB persistence and debugging
  pBest?: number;
  alpha?: number;
  beta?: number;
  cpcEstimate?: number;
}

export interface Policy {
  /**
   * Allocate daily budgets across publishers within each category.
   * @param observations The historical observations (day 1 to day t-1)
   * @param categoryBudgets The budget available for each category today
   * @param rng The seeded random number generator for this policy's decisions
   */
  allocate(
    observations: Observation[],
    categoryBudgets: Record<Category, number>,
    rng: RNG
  ): Allocation[];
}
