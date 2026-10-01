import { type Observation } from './policies/types.js';
import { type Category, type PublisherId, DEFAULT_TRUTH } from './scenarios.js';

export class Posterior {
  public alpha: number = 1;
  public beta: number = 1;
  
  public totalClicks: number = 0;
  public totalSpend: number = 0;
  
  public dailyClicks: number[] = [];

  constructor(
    public readonly category: Category,
    public readonly publisherId: PublisherId,
    public readonly gamma: number = 0.95
  ) {}

  update(obs: Observation) {
    this.alpha = 1 + this.gamma * (this.alpha - 1) + obs.applies;
    this.beta = 1 + this.gamma * (this.beta - 1) + (obs.clicks - obs.applies);
    
    // We also discount the spend/clicks to keep CPC estimate adaptive to drift.
    // Wait, the doc says: "ĉ = discounted mean CPC (spend / clicks)".
    // Let's apply gamma to the rolling totals.
    this.totalClicks = this.gamma * this.totalClicks + obs.clicks;
    this.totalSpend = this.gamma * this.totalSpend + obs.spend;
    
    // Keep track of daily clicks to estimate capacity
    if (obs.clicks > 0) {
      this.dailyClicks.push(obs.clicks);
    }
  }

  get cpcEstimate(): number {
    if (this.totalClicks >= 20) {
      return this.totalSpend / this.totalClicks;
    }
    // Prior: category mean CPC across publishers
    const truth = DEFAULT_TRUTH[this.category];
    let sum = 0;
    for (const arm of truth) sum += arm.cpc;
    return sum / truth.length;
  }
  
  get observedCapacity(): number | undefined {
    if (this.dailyClicks.length < 3) return undefined; // Need some history
    // A simple robust estimate is the 90th percentile of observed clicks
    // Ponytail: just use the max observed clicks so far.
    let max = 0;
    for (const c of this.dailyClicks) {
      if (c > max) max = c;
    }
    return max;
  }
}
