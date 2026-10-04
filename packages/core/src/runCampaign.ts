// The day loop shared by the live API and the experiments CLI (ARCHITECTURE §2, §5).
import { paceCategory, type CategoryDayResult } from './pacing.js';
import { policyStream } from './rng.js';
import { CATEGORIES, PUBLISHER_IDS, type Category, type ScenarioName } from './scenarios.js';
import { armDay } from './simulator.js';
import type { Allocation, Observation, Policy } from './policies/types.js';

export interface CampaignConfig {
  seed: number;
  scenario: ScenarioName;
  days: number;
  /** ₹ per day for the whole campaign. */
  dailyBudget: number;
  /** Jobs per category; the daily budget is split across categories in proportion to these counts. */
  jobsPerCategory: Readonly<Record<Category, number>>;
}

export const DEFAULT_JOBS_PER_CATEGORY: Readonly<Record<Category, number>> = {
  software: 5,
  sales: 5,
  healthcare: 5,
  logistics: 5,
};

export interface DayResult {
  day: number;
  budget: number;
  spend: number;
  clicks: number;
  applies: number;
  allocations: Allocation[];
  categories: CategoryDayResult[];
  /** What the policy will see about this day from tomorrow on. */
  observations: Observation[];
}

/** Fixed split of the daily budget across categories by job count (§5). */
export function categoryBudgets(config: Pick<CampaignConfig, 'dailyBudget' | 'jobsPerCategory'>): Record<Category, number> {
  const totalJobs = CATEGORIES.reduce((sum, c) => sum + config.jobsPerCategory[c], 0);
  if (totalJobs <= 0) throw new Error('a campaign needs at least one job');
  return Object.fromEntries(
    CATEGORIES.map((c) => [c, (config.dailyBudget * config.jobsPerCategory[c]) / totalJobs]),
  ) as Record<Category, number>;
}

const roundPaise = (x: number): number => Math.round(x * 100) / 100;

/** Simulates one day for given allocations: noise, hourly pacing, clicks and applies. */
export function simulateDay(config: CampaignConfig, day: number, allocations: readonly Allocation[]): Omit<DayResult, 'allocations'> {
  const budgets = categoryBudgets(config);
  const categories = CATEGORIES.filter((c) => budgets[c] > 0).map((category) => {
    const arms = PUBLISHER_IDS.map((publisherId) => {
      const allocated = allocations
        .filter((a) => a.category === category && a.publisherId === publisherId)
        .reduce((sum, a) => sum + a.budget, 0);
      return { publisherId, budget: allocated, arm: armDay(config.seed, config.scenario, day, category, publisherId) };
    });
    const allocated = arms.reduce((sum, a) => sum + a.budget, 0);
    if (allocated > budgets[category] * (1 + 1e-9)) {
      throw new Error(`allocations for ${category} (${allocated}) exceed its budget (${budgets[category]})`);
    }
    return paceCategory(config.seed, day, category, arms);
  });
  const observations = categories.flatMap((c) =>
    c.arms.map((a) => ({
      day,
      category: c.category,
      publisherId: a.publisherId,
      clicks: a.clicks,
      applies: a.applies,
      spend: roundPaise(a.spend),
      budget: a.budget,
    })),
  );
  return {
    day,
    budget: config.dailyBudget,
    spend: categories.reduce((sum, c) => sum + c.spend, 0),
    clicks: observations.reduce((sum, o) => sum + o.clicks, 0),
    applies: observations.reduce((sum, o) => sum + o.applies, 0),
    categories,
    observations,
  };
}

/** Asks the policy for one day's allocations, using the policy stream for (seed, policy, day). */
export function allocateDay(
  config: CampaignConfig,
  policy: Policy,
  day: number,
  history: readonly Observation[],
): Allocation[] {
  return policy.allocate(history, categoryBudgets(config), policyStream(config.seed, policy.name, day), day);
}

/** Runs a whole campaign in memory. */
export function runCampaign(config: CampaignConfig, policy: Policy): DayResult[] {
  const history: Observation[] = [];
  const results: DayResult[] = [];
  for (let day = 1; day <= config.days; day++) {
    const allocations = allocateDay(config, policy, day, history);
    const result = simulateDay(config, day, allocations);
    history.push(...result.observations);
    results.push({ ...result, allocations });
  }
  return results;
}
