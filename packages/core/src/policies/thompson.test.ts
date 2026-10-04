import { describe, it, expect } from 'vitest';
import { createThompsonPolicy, probabilityBest, sharesToBudgets } from './thompson.js';
import { DEFAULT_JOBS_PER_CATEGORY, allocateDay, runCampaign, type CampaignConfig, type DayResult } from '../runCampaign.js';
import { stream } from '../rng.js';
import { CATEGORIES, DRIFT_DAY, bestPublisher, type Category, type ScenarioName } from '../scenarios.js';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

function config(seed: number, scenario: ScenarioName, days: number): CampaignConfig {
  return { seed, scenario, days, dailyBudget: 20_000, jobsPerCategory: DEFAULT_JOBS_PER_CATEGORY };
}

function bestArm(days: DayResult[], day: number, category: Category) {
  return days[day - 1]!.allocations.find((a) => a.category === category && a.publisherId === bestPublisher(category))!;
}

describe('probabilityBest', () => {
  it('picks a clear winner and splits evenly between identical arms', () => {
    const clear = probabilityBest(
      [
        { alpha: 101, beta: 901, cpc: 10 }, // CPA about 100
        { alpha: 11, beta: 991, cpc: 10 }, // CPA about 1,000
      ],
      2000,
      stream('pbest', 1),
    );
    expect(clear[0]).toBeGreaterThan(0.99);
    const even = probabilityBest(
      Array.from({ length: 4 }, () => ({ alpha: 5, beta: 95, cpc: 10 })),
      20_000,
      stream('pbest', 2),
    );
    for (const p of even) expect(p).toBeCloseTo(0.25, 1);
    expect(even.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
});

describe('sharesToBudgets', () => {
  it('applies the floor: share = (1 - K f) pBest + f', () => {
    const budgets = sharesToBudgets([1, 0, 0, 0], [undefined, undefined, undefined, undefined], 1000, 0.05);
    expect(budgets).toEqual([850, 50, 50, 50].map((b) => expect.closeTo(b, 9)));
  });

  it('caps arms and gives the excess to uncapped arms in proportion to pBest', () => {
    const budgets = sharesToBudgets([0.6, 0.3, 0.1, 0], [100, undefined, undefined, undefined], 1000, 0);
    expect(budgets[0]).toBe(100);
    // Excess 500 goes 3:1 to arms 2 and 3.
    expect(budgets[1]).toBeCloseTo(300 + 375, 9);
    expect(budgets[2]).toBeCloseTo(100 + 125, 9);
    expect(budgets[3]).toBe(0);
    expect(budgets.reduce((a, b) => a + b, 0)).toBeCloseTo(1000, 9);
  });

  it('leaves budget unallocated when every arm is capped', () => {
    const budgets = sharesToBudgets([0.5, 0.5], [100, 200], 1000, 0);
    expect(budgets).toEqual([100, 200]);
  });
});

describe('Thompson policy', () => {
  it('a fresh policy fed the full history allocates exactly like one updated day by day', () => {
    const cfg = config(4, 'drift', 18);
    const days = runCampaign(cfg, createThompsonPolicy());
    const history = days.slice(0, 17).flatMap((d) => d.observations);
    const fresh = allocateDay(cfg, createThompsonPolicy(), 18, history);
    expect(fresh).toEqual(days[17]!.allocations);
  });

  it('never allocates more than the category budget and respects the floor when uncapped', () => {
    for (const day of runCampaign(config(2, 'stationary', 10), createThompsonPolicy())) {
      for (const category of CATEGORIES) {
        const rows = day.allocations.filter((a) => a.category === category);
        expect(rows.reduce((s, a) => s + a.budget, 0)).toBeLessThanOrEqual(5000 + 1e-6);
        if (day.day === 1) for (const a of rows) expect(a.budget).toBeGreaterThanOrEqual(0.01 * 5000 - 1e-9);
      }
    }
  });
});

describe('Thompson convergence and drift (ADR-015, 20 seeds × 4 categories)', () => {
  it('on day 15 the true best arm has the highest pBest in at least 60 of 80 pairs', () => {
    let hits = 0;
    for (const seed of SEEDS) {
      const days = runCampaign(config(seed, 'stationary', 15), createThompsonPolicy());
      for (const category of CATEGORIES) {
        const rows = days[14]!.allocations.filter((a) => a.category === category);
        const top = rows.reduce((a, b) => (b.pBest! > a.pBest! ? b : a));
        if (top.publisherId === bestPublisher(category)) hits++;
      }
    }
    expect(hits).toBeGreaterThanOrEqual(60);
  }, 120_000);

  it('moves budget off the degraded arm within 5 days of the change (γ = 0.95)', () => {
    let budgetDrop = 0;
    let pBestDrop = 0;
    let belowNoDiscount = 0;
    const checkDay = DRIFT_DAY + 5;
    for (const seed of SEEDS) {
      const discounted = runCampaign(config(seed, 'drift', checkDay), createThompsonPolicy({ gamma: 0.95 }));
      const plain = runCampaign(config(seed, 'drift', checkDay), createThompsonPolicy({ gamma: 1 }));
      for (const category of CATEGORIES) {
        const before = bestArm(discounted, DRIFT_DAY - 1, category);
        const after = bestArm(discounted, checkDay, category);
        if (after.budget < before.budget) budgetDrop++;
        if (after.pBest! < before.pBest!) pBestDrop++;
        if (after.budget < bestArm(plain, checkDay, category).budget) belowNoDiscount++;
      }
    }
    expect(budgetDrop).toBeGreaterThanOrEqual(60);
    expect(pBestDrop).toBeGreaterThanOrEqual(60);
    expect(belowNoDiscount).toBeGreaterThanOrEqual(60);
  }, 120_000);
});
