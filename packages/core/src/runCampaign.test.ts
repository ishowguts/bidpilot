import { describe, it, expect } from 'vitest';
import { runCampaign } from './runCampaign.js';
import { createScenario } from './scenarios.js';
import { EqualPolicy } from './policies/equal.js';

describe('runCampaign', () => {
  it('equal policy completes deterministically', () => {
    const scenario = createScenario('stationary');
    const policy = new EqualPolicy();
    
    const splits = {
      software: 1,
      sales: 1,
      healthcare: 1,
      logistics: 1,
    };
    
    const result1 = runCampaign(scenario, policy, 5, 20000, splits, 123);
    const result2 = runCampaign(scenario, policy, 5, 20000, splits, 123);
    
    expect(result1.totalSpend).toBe(result2.totalSpend);
    expect(result1.totalApplies).toBe(result2.totalApplies);
    expect(result1.totalClicks).toBe(result2.totalClicks);
    expect(result1.totalApplies).toBeGreaterThan(0);
    
    // Another seed gives different results
    const result3 = runCampaign(scenario, policy, 5, 20000, splits, 999);
    expect(result3.totalApplies).not.toBe(result1.totalApplies);
  });
});
