import { describe, it, expect } from 'vitest';
import { createScenario } from './scenarios.js';
import { simulateHour, HOURLY_WEIGHTS } from './simulator.js';

describe('Simulator', () => {
  it('HOURLY_WEIGHTS sum to 1', () => {
    const sum = HOURLY_WEIGHTS.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 4);
  });

  it('observed CPA over a long run converges to true CPA ± 10%', () => {
    const scenario = createScenario('stationary');
    const category = 'software';
    const publisherId = 3; // best arm, CPA 312.5
    const seed = 42;
    
    let totalClicks = 0;
    let totalApplies = 0;
    let totalSpend = 0;

    // Run for 100 days
    for (let day = 1; day <= 100; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const events = simulateHour(scenario, category, publisherId, 1000000, day, hour, seed); // infinite budget
        for (const e of events) {
          if (e.type === 'click') {
            totalClicks++;
            totalSpend += e.cost;
          } else if (e.type === 'apply') {
            totalApplies++;
          }
        }
      }
    }
    
    expect(totalApplies).toBeGreaterThan(0);
    expect(totalClicks).toBeGreaterThan(totalApplies);
    const observedCPA = totalSpend / totalApplies;
    
    const truth = scenario.getTruth(1)[category].find(a => a.publisherId === publisherId)!;
    const trueCPA = truth.cpc / truth.applyRate;
    
    const diffRatio = Math.abs(observedCPA - trueCPA) / trueCPA;
    expect(diffRatio).toBeLessThan(0.10); // within 10%
  });

  it('drift applies on day 15', () => {
    const scenario = createScenario('drift');
    const t14 = scenario.getTruth(14)['software'].find(a => a.publisherId === 3)!;
    const t15 = scenario.getTruth(15)['software'].find(a => a.publisherId === 3)!;
    
    // Best arm (pub 3) apply rate drops by 50%
    expect(t15.applyRate).toBeCloseTo(t14.applyRate * 0.5, 5);
  });
});
