import { describe, it, expect } from 'vitest';
import { DEFAULT_JOBS_PER_CATEGORY, categoryBudgets, runCampaign, type CampaignConfig } from './runCampaign.js';
import { createEqualPolicy } from './policies/equal.js';

const config: CampaignConfig = {
  seed: 11,
  scenario: 'stationary',
  days: 30,
  dailyBudget: 20_000,
  jobsPerCategory: DEFAULT_JOBS_PER_CATEGORY,
};

describe('runCampaign with the equal policy', () => {
  it('completes 30 days deterministically', () => {
    const a = runCampaign(config, createEqualPolicy());
    const b = runCampaign(config, createEqualPolicy());
    expect(a).toHaveLength(30);
    expect(b).toEqual(a);
    expect(runCampaign({ ...config, seed: 12 }, createEqualPolicy())).not.toEqual(a);
  });

  it('never overspends and paces close to the budget', () => {
    for (const day of runCampaign(config, createEqualPolicy())) {
      expect(day.spend).toBeLessThanOrEqual(day.budget + 1e-6);
      expect(day.spend / day.budget).toBeGreaterThanOrEqual(0.97);
      for (const a of day.allocations) expect(a.budget).toBeCloseTo(20_000 / 4 / 6, 9);
    }
  });

  it('splits the daily budget across categories by job count', () => {
    const budgets = categoryBudgets({ dailyBudget: 10_000, jobsPerCategory: { software: 3, sales: 1, healthcare: 0, logistics: 1 } });
    expect(budgets).toEqual({ software: 6000, sales: 2000, healthcare: 0, logistics: 2000 });
    expect(() => categoryBudgets({ dailyBudget: 1, jobsPerCategory: { software: 0, sales: 0, healthcare: 0, logistics: 0 } })).toThrow();
  });
});
