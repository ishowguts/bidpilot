import { type Policy, type Observation, type Allocation } from './types.js';
import { type Category, type PublisherId } from '../scenarios.js';
import { type RNG } from '../rng.js';

// The baseline equal-split policy: every arm in a category gets the same share.
export class EqualPolicy implements Policy {
  private readonly publishers: PublisherId[];

  constructor(publishers: PublisherId[] = [1, 2, 3, 4, 5, 6]) {
    this.publishers = publishers;
  }

  allocate(
    _observations: Observation[],
    categoryBudgets: Record<Category, number>,
    _rng: RNG
  ): Allocation[] {
    const allocations: Allocation[] = [];
    const n = this.publishers.length;

    for (const cat of Object.keys(categoryBudgets) as Category[]) {
      const budget = categoryBudgets[cat];
      const equalShare = budget / n;

      for (const pub of this.publishers) {
        allocations.push({
          category: cat,
          publisherId: pub,
          budget: equalShare,
        });
      }
    }

    return allocations;
  }
}
