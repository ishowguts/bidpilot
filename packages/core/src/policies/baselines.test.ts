import { describe, it, expect } from 'vitest';
import { createGreedyPolicy, GREEDY_WARMUP_DAYS } from './greedy.js';
import { createOraclePolicy } from './oracle.js';
import { stream } from '../rng.js';
import { PUBLISHER_IDS, armTruth, trueCpa, type Category } from '../scenarios.js';
import type { Observation } from './types.js';

const budgets: Record<Category, number> = { software: 5000, sales: 5000, healthcare: 0, logistics: 5000 };
const rng = stream('baselines');

function obs(day: number, publisherId: 1 | 2 | 3 | 4 | 5 | 6, clicks: number, applies: number, spend: number, budget: number): Observation {
  return { day, category: 'software', publisherId, clicks, applies, spend, budget };
}

describe('greedy', () => {
  it('splits equally during warm-up', () => {
    const rows = createGreedyPolicy().allocate([], budgets, rng, GREEDY_WARMUP_DAYS);
    for (const a of rows.filter((r) => r.category === 'software')) expect(a.budget).toBeCloseTo(5000 / 6, 9);
  });

  it('then puts everything on the lowest observed CPA arm and overflows past its capacity', () => {
    const history: Observation[] = [];
    for (let day = 1; day <= 3; day++) {
      for (const pub of PUBLISHER_IDS) history.push(obs(day, pub, 50, pub === 2 ? 5 : 1, 800, 833));
    }
    let rows = createGreedyPolicy().allocate(history, budgets, rng, 4).filter((r) => r.category === 'software');
    expect(rows.find((r) => r.publisherId === 2)!.budget).toBe(5000);
    // Publisher 2 left more than 5% unspent on day 4: capped at 1.2 × 40 clicks × ₹16, the rest overflows.
    history.push(obs(4, 2, 40, 4, 640, 5000));
    rows = createGreedyPolicy().allocate(history, budgets, rng, 5).filter((r) => r.category === 'software');
    expect(rows.find((r) => r.publisherId === 2)!.budget).toBeCloseTo(1.2 * 40 * 16, 9);
    expect(rows.reduce((s, r) => s + r.budget, 0)).toBeCloseTo(5000, 9);
  });
});

describe('oracle', () => {
  it('fills arms in true-CPA order up to capacity × CPC', () => {
    const rows = createOraclePolicy('stationary').allocate([], budgets, rng, 1).filter((r) => r.category === 'software');
    const order = [...PUBLISHER_IDS].sort(
      (a, b) => trueCpa(armTruth('stationary', 1, 'software', a)) - trueCpa(armTruth('stationary', 1, 'software', b)),
    );
    const best = armTruth('stationary', 1, 'software', order[0]!);
    expect(rows.find((r) => r.publisherId === order[0])!.budget).toBe(best.capacity * best.cpc);
    expect(rows.find((r) => r.publisherId === order[1])!.budget).toBeCloseTo(5000 - best.capacity * best.cpc, 9);
    expect(rows.reduce((s, r) => s + r.budget, 0)).toBeCloseTo(5000, 9);
  });

  it('follows the drift', () => {
    const before = createOraclePolicy('drift').allocate([], budgets, rng, 14);
    const after = createOraclePolicy('drift').allocate([], budgets, rng, 15);
    expect(after).not.toEqual(before);
  });
});
