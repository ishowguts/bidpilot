import { type Policy, type Observation, type Allocation } from './types.js';
import { type Category, type PublisherId } from '../scenarios.js';
import { type RNG } from '../rng.js';
import { Posterior } from '../posterior.js';

// 3 days equal split, then 100% to the lowest observed CPA arm 
// (capacity overflow to the next lowest).
export class GreedyPolicy implements Policy {
  constructor(private readonly publishers: PublisherId[] = [1, 2, 3, 4, 5, 6]) {}

  allocate(
    observations: Observation[],
    categoryBudgets: Record<Category, number>,
    _rng: RNG
  ): Allocation[] {
    const allocations: Allocation[] = [];
    const K = this.publishers.length;
    
    // Group observations by category and publisher
    const posteriors = new Map<string, Posterior>();
    for (const cat of Object.keys(categoryBudgets) as Category[]) {
      for (const pub of this.publishers) {
        posteriors.set(`${cat}|${pub}`, new Posterior(cat, pub, 1.0)); // No discount for pure greedy
      }
    }
    
    // Determine the current day by looking at observations.
    // If there are less than 3 days of observations (i.e. < 3 * K * numCategories obs),
    // we do equal split.
    let numDays = 0;
    if (observations.length > 0) {
      const firstCat = Object.keys(categoryBudgets)[0] as Category;
      numDays = observations.filter(o => o.category === firstCat && o.publisherId === this.publishers[0]).length;
    }

    for (const obs of observations) {
      const p = posteriors.get(`${obs.category}|${obs.publisherId}`);
      if (p) p.update(obs);
    }

    for (const cat of Object.keys(categoryBudgets) as Category[]) {
      const budget = categoryBudgets[cat];
      
      if (numDays < 3) {
        // Equal split for the first 3 days
        for (const pub of this.publishers) {
          allocations.push({ category: cat, publisherId: pub, budget: budget / K });
        }
        continue;
      }
      
      // Greedy phase
      const arms = this.publishers.map(pub => {
        const p = posteriors.get(`${cat}|${pub}`)!;
        const cpa = p.alpha > 1 ? p.totalSpend / (p.alpha - 1) : Infinity; // alpha - 1 = total applies
        return { pub, cpa, p };
      });
      
      arms.sort((a, b) => a.cpa - b.cpa);
      
      let remaining = budget;
      for (const arm of arms) {
        let alloc = 0;
        if (remaining > 0) {
          const capClicks = arm.p.observedCapacity;
          if (capClicks !== undefined) {
            const maxBudget = 1.2 * capClicks * arm.p.cpcEstimate;
            alloc = Math.min(remaining, maxBudget);
          } else {
            alloc = remaining;
          }
        }
        remaining -= alloc;
        allocations.push({ category: cat, publisherId: arm.pub, budget: alloc });
      }
    }

    return allocations;
  }
}
