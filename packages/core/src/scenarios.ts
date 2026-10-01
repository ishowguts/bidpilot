export type Category = 'software' | 'sales' | 'healthcare' | 'logistics';
export type PublisherId = 1 | 2 | 3 | 4 | 5 | 6; // Mapping to pub-a ... pub-f

export interface ArmTruth {
  publisherId: PublisherId;
  cpc: number;
  applyRate: number;
  capacity: number; // daily clicks capacity
}

export type CategoryTruth = Record<Category, ArmTruth[]>;

// Design rule §5.1: cheapest CPC != cheapest CPA, best arm is capacity-limited.
// The default scenario is 'stationary'.
export const DEFAULT_TRUTH: CategoryTruth = {
  software: [
    { publisherId: 1, cpc: 12, applyRate: 0.020, capacity: 900 }, // CPA 600
    { publisherId: 2, cpc: 18, applyRate: 0.045, capacity: 300 }, // CPA 400
    { publisherId: 3, cpc: 25, applyRate: 0.080, capacity: 120 }, // CPA 312.5 (best, low cap)
    { publisherId: 4, cpc: 8,  applyRate: 0.010, capacity: 2000 },// CPA 800 (cheapest CPC, worst CPA)
    { publisherId: 5, cpc: 30, applyRate: 0.060, capacity: 300 }, // CPA 500
    { publisherId: 6, cpc: 15, applyRate: 0.030, capacity: 700 }, // CPA 500
  ],
  sales: [
    { publisherId: 1, cpc: 10, applyRate: 0.015, capacity: 1000 },// CPA 666
    { publisherId: 2, cpc: 15, applyRate: 0.040, capacity: 400 }, // CPA 375
    { publisherId: 3, cpc: 22, applyRate: 0.075, capacity: 150 }, // CPA 293 (best)
    { publisherId: 4, cpc: 7,  applyRate: 0.008, capacity: 2500 },// CPA 875
    { publisherId: 5, cpc: 28, applyRate: 0.050, capacity: 350 }, // CPA 560
    { publisherId: 6, cpc: 14, applyRate: 0.025, capacity: 800 }, // CPA 560
  ],
  healthcare: [
    { publisherId: 1, cpc: 15, applyRate: 0.025, capacity: 800 }, // CPA 600
    { publisherId: 2, cpc: 20, applyRate: 0.050, capacity: 250 }, // CPA 400
    { publisherId: 3, cpc: 30, applyRate: 0.090, capacity: 100 }, // CPA 333 (best)
    { publisherId: 4, cpc: 10, applyRate: 0.012, capacity: 1800 },// CPA 833
    { publisherId: 5, cpc: 35, applyRate: 0.070, capacity: 200 }, // CPA 500
    { publisherId: 6, cpc: 18, applyRate: 0.035, capacity: 600 }, // CPA 514
  ],
  logistics: [
    { publisherId: 1, cpc: 8,  applyRate: 0.012, capacity: 1200 },// CPA 666
    { publisherId: 2, cpc: 12, applyRate: 0.030, capacity: 500 }, // CPA 400
    { publisherId: 3, cpc: 18, applyRate: 0.060, capacity: 200 }, // CPA 300 (best)
    { publisherId: 4, cpc: 5,  applyRate: 0.005, capacity: 3000 },// CPA 1000
    { publisherId: 5, cpc: 20, applyRate: 0.040, capacity: 400 }, // CPA 500
    { publisherId: 6, cpc: 10, applyRate: 0.020, capacity: 900 }, // CPA 500
  ],
};

export type ScenarioType = 'stationary' | 'drift';

export interface Scenario {
  type: ScenarioType;
  getTruth(day: number): CategoryTruth;
}

export function createScenario(type: ScenarioType): Scenario {
  return {
    type,
    getTruth(day: number): CategoryTruth {
      if (type === 'stationary' || day < 15) {
        return DEFAULT_TRUTH;
      }
      
      // Drift: on day 15, the best arm's apply rate drops by 50%
      const truth = JSON.parse(JSON.stringify(DEFAULT_TRUTH)) as CategoryTruth; // deep copy
      for (const cat of Object.keys(truth) as Category[]) {
        // Find best arm
        let best = truth[cat][0];
        for (const arm of truth[cat]) {
          if ((arm.cpc / arm.applyRate) < (best.cpc / best.applyRate)) {
            best = arm;
          }
        }
        best.applyRate *= 0.5;
      }
      return truth;
    }
  };
}
