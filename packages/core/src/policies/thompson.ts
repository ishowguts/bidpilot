import { type Policy, type Observation, type Allocation } from './types.js';
import { type Category, type PublisherId } from '../scenarios.js';
import { type RNG, beta } from '../rng.js';
import { Posterior } from '../posterior.js';

export class ThompsonPolicy implements Policy {
  private readonly publishers: PublisherId[];
  private posteriors = new Map<string, Posterior>();
  
  constructor(
    publishers: PublisherId[] = [1, 2, 3, 4, 5, 6],
    private readonly gamma: number = 0.95
  ) {
    this.publishers = publishers;
  }

  private getPosterior(cat: Category, pub: PublisherId): Posterior {
    const key = `${cat}|${pub}`;
    let p = this.posteriors.get(key);
    if (!p) {
      p = new Posterior(cat, pub, this.gamma);
      this.posteriors.set(key, p);
    }
    return p;
  }

  allocate(
    observations: Observation[],
    categoryBudgets: Record<Category, number>,
    rng: RNG
  ): Allocation[] {
    // 1. Process new observations. 
    // We should only process the LAST day's observations to avoid double counting,
    // since runCampaign passes the full history. 
    // Wait, the API specifies `allocate(observations, ...)`. If it's the full history,
    // we need to rebuild posteriors or only process the diff.
    // Easiest is to rebuild posteriors from scratch using the full history.
    this.posteriors.clear();
    for (const obs of observations) {
      this.getPosterior(obs.category, obs.publisherId).update(obs);
    }

    const allocations: Allocation[] = [];
    const K = this.publishers.length;
    const M = 2000;
    const floor = 0.03;

    for (const cat of Object.keys(categoryBudgets) as Category[]) {
      const budget = categoryBudgets[cat];
      const arms = this.publishers.map(pub => this.getPosterior(cat, pub));
      
      // Draw M samples per arm
      const wins = new Array(K).fill(0);
      for (let i = 0; i < M; i++) {
        let bestArm = -1;
        let bestCpa = Infinity;
        
        for (let a = 0; a < K; a++) {
          const arm = arms[a];
          const theta = beta(rng, arm.alpha, arm.beta);
          const cpa = arm.cpcEstimate / Math.max(1e-9, theta);
          if (cpa < bestCpa) {
            bestCpa = cpa;
            bestArm = a;
          }
        }
        wins[bestArm]++;
      }
      
      const pBest = wins.map(w => w / M);
      
      // Exploration floor
      const shares = pBest.map(p => (1 - K * floor) * p + floor);
      
      // Budgets before cap
      const budgets = shares.map(s => s * budget);
      
      // Capacity cap: budget <= 1.2 * observed capacity * cpc.
      // Redistribute excess proportional to pBest.
      let capping = true;
      let remainingToRedistribute = 0;
      const capped = new Array(K).fill(false);
      
      while (capping) {
        capping = false;
        let sumPBestUncapped = 0;
        for (let a = 0; a < K; a++) {
          if (!capped[a]) sumPBestUncapped += pBest[a];
        }
        
        // If all arms are capped, we just stop redistributing and they underspend.
        if (sumPBestUncapped === 0) break;

        for (let a = 0; a < K; a++) {
          if (capped[a]) continue;
          
          budgets[a] += remainingToRedistribute * (pBest[a] / sumPBestUncapped);
        }
        remainingToRedistribute = 0;
        
        for (let a = 0; a < K; a++) {
          if (capped[a]) continue;
          const capClicks = arms[a].observedCapacity;
          if (capClicks !== undefined) {
            const maxBudget = 1.2 * capClicks * arms[a].cpcEstimate;
            if (budgets[a] > maxBudget) {
              remainingToRedistribute += (budgets[a] - maxBudget);
              budgets[a] = maxBudget;
              capped[a] = true;
              capping = true;
            }
          }
        }
      }

      for (let a = 0; a < K; a++) {
        allocations.push({
          category: cat,
          publisherId: this.publishers[a],
          budget: budgets[a],
          pBest: pBest[a],
          alpha: arms[a].alpha,
          beta: arms[a].beta,
          cpcEstimate: arms[a].cpcEstimate
        });
      }
    }

    return allocations;
  }
}
