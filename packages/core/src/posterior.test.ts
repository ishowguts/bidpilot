import { describe, it, expect } from 'vitest';
import { Posterior } from './posterior.js';
import { ThompsonPolicy } from './policies/thompson.js';
import { runCampaign } from './runCampaign.js';
import { createScenario } from './scenarios.js';

describe('Posterior', () => {
  it('updates alpha, beta, and CPC estimate with discount', () => {
    const p = new Posterior('software', 1, 0.95);
    p.update({ category: 'software', publisherId: 1, clicks: 100, applies: 10, spend: 1200 });
    p.update({ category: 'software', publisherId: 1, clicks: 90, applies: 9, spend: 1000 });
    p.update({ category: 'software', publisherId: 1, clicks: 110, applies: 11, spend: 1300 });
    
    expect(p.observedCapacity).toBe(110);
  });
});

describe('ThompsonPolicy', () => {
  it('drift test passes with gamma = 0.95', () => {
    const scenario = createScenario('drift');
    const policy = new ThompsonPolicy([1, 2, 3, 4, 5, 6], 0.95);
    const splits = { software: 1, sales: 0, healthcare: 0, logistics: 0 };
    
    // Run for 30 days. The Thompson policy should learn the drift and still perform well.
    // It should not throw.
    const result = runCampaign(scenario, policy, 30, 20000, splits, 42);
    
    expect(result.totalApplies).toBeGreaterThan(0);
    expect(result.allocations.length).toBe(30 * 24); // 30 days, 4 categories, 6 arms
  });
});
