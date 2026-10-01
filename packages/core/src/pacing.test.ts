import { describe, it, expect } from 'vitest';
import { initPacing, paceHour } from './pacing.js';
import { createScenario } from './scenarios.js';
import { type Allocation } from './policies/types.js';

describe('Pacing', () => {
  it('respects daily budget without overdelivery', () => {
    const scenario = createScenario('stationary');
    const day = 1;
    const seed = 42;
    
    // Allocate 10k to software pub 1 and 10k to pub 2
    const allocations: Allocation[] = [
      { category: 'software', publisherId: 1, budget: 10000 },
      { category: 'software', publisherId: 4, budget: 10000 },
    ];
    
    const state = initPacing(allocations);
    
    let totalSpend = 0;
    
    for (let hour = 0; hour < 24; hour++) {
      const events = paceHour(state, scenario, day, hour, seed);
      for (const e of events) {
        totalSpend += e.cost;
      }
    }
    
    // Total budget is 20,000. It should never exceed 20,000.
    expect(totalSpend).toBeLessThanOrEqual(20000.01);
    
    // Pacing metrics target 0.97 - 1.00 of budget spend
    const spendRatio = totalSpend / 20000;
    expect(spendRatio).toBeGreaterThan(0.95);
  });
});
