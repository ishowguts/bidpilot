import { describe, it, expect } from 'vitest';
import { runCampaign } from '../runCampaign.js';
import { createScenario } from '../scenarios.js';
import { EqualPolicy } from './equal.js';
import { GreedyPolicy } from './greedy.js';
import { OraclePolicy } from './oracle.js';

describe('Baseline Policies', () => {
  it('oracle CPA <= every other policy on stationary scenario', () => {
    const splits = { software: 1, sales: 0, healthcare: 0, logistics: 0 };
    const seed = 42;
    const days = 10; // short run to keep test fast
    const budget = 20000;

    const oracleRes = runCampaign(createScenario('stationary'), new OraclePolicy([1, 2, 3, 4, 5, 6], 'stationary'), days, budget, splits, seed);
    const equalRes = runCampaign(createScenario('stationary'), new EqualPolicy(), days, budget, splits, seed);
    const greedyRes = runCampaign(createScenario('stationary'), new GreedyPolicy(), days, budget, splits, seed);

    const oracleCPA = oracleRes.totalSpend / oracleRes.totalApplies;
    const equalCPA = equalRes.totalSpend / equalRes.totalApplies;
    const greedyCPA = greedyRes.totalSpend / greedyRes.totalApplies;

    expect(oracleCPA).toBeLessThanOrEqual(equalCPA);
    expect(oracleCPA).toBeLessThanOrEqual(greedyCPA);
  });
});
