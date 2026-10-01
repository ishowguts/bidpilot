import { type Policy, type Observation, type Allocation } from './types.js';
import { type Category, type PublisherId, createScenario } from '../scenarios.js';
import { type RNG } from '../rng.js';

// Oracle knows true CPC, apply rate, and capacity for the current day.
// Fills arms in true-CPA order. Upper bound for performance.
export class OraclePolicy implements Policy {
  private scenario = createScenario('stationary');
  private day = 1;

  constructor(
    private readonly publishers: PublisherId[] = [1, 2, 3, 4, 5, 6],
    scenarioType: 'stationary' | 'drift' = 'stationary'
  ) {
    this.scenario = createScenario(scenarioType);
  }

  allocate(
    observations: Observation[],
    categoryBudgets: Record<Category, number>,
    _rng: RNG
  ): Allocation[] {
    const allocations: Allocation[] = [];
    
    // Determine the current day
    let numDays = 0;
    if (observations.length > 0) {
      const firstCat = Object.keys(categoryBudgets)[0] as Category;
      numDays = observations.filter(o => o.category === firstCat && o.publisherId === this.publishers[0]).length;
    }
    this.day = numDays + 1;

    const truth = this.scenario.getTruth(this.day);

    for (const cat of Object.keys(categoryBudgets) as Category[]) {
      const budget = categoryBudgets[cat];
      const catTruth = truth[cat];
      
      const arms = catTruth.map(t => ({
        pub: t.publisherId,
        cpa: t.cpc / t.applyRate,
        capClicks: t.capacity,
        cpc: t.cpc
      }));
      
      arms.sort((a, b) => a.cpa - b.cpa);
      
      let remaining = budget;
      const allocMap = new Map<PublisherId, number>();
      for (const pub of this.publishers) allocMap.set(pub, 0);

      for (const arm of arms) {
        if (remaining <= 0) break;
        const maxBudget = arm.capClicks * arm.cpc;
        const alloc = Math.min(remaining, maxBudget);
        allocMap.set(arm.pub, alloc);
        remaining -= alloc;
      }
      
      for (const pub of this.publishers) {
        allocations.push({ category: cat, publisherId: pub, budget: allocMap.get(pub)! });
      }
    }

    return allocations;
  }
}
