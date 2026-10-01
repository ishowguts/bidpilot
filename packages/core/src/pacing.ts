import { HOURLY_WEIGHTS, type Event } from './simulator.js';
import { type Allocation } from './policies/types.js';
import { type Scenario, type Category, type PublisherId } from './scenarios.js';
import { RNG, lognormal, poisson, binomial } from './rng.js';

export interface PacingState {
  allocations: Allocation[];
  remainingBudget: Map<string, number>; // key: "category|publisherId"
  totalSpend: Map<string, number>;
}

export function initPacing(allocations: Allocation[]): PacingState {
  const remainingBudget = new Map<string, number>();
  const totalSpend = new Map<string, number>();
  
  for (const alloc of allocations) {
    const key = `${alloc.category}|${alloc.publisherId}`;
    remainingBudget.set(key, alloc.budget);
    totalSpend.set(key, 0);
  }
  
  return { allocations, remainingBudget, totalSpend };
}

// pacing controller for a single hour across all categories and arms
export function paceHour(
  state: PacingState,
  scenario: Scenario,
  day: number,
  hour: number,
  seed: number
): Event[] {
  const events: Event[] = [];
  
  // Weights sum from hour to end of day
  let weightSum = 0;
  for (let h = hour; h < 24; h++) {
    weightSum += HOURLY_WEIGHTS[h];
  }
  // Safe guard to prevent division by zero at the very last hour if float math is slightly off
  weightSum = Math.max(weightSum, 1e-9);

  const currentWeight = HOURLY_WEIGHTS[hour];

  // Group allocations by category to handle underspend recovery later
  const catArms = new Map<Category, { pub: PublisherId, key: string, alloc: number, spent: number }[]>();
  for (const a of state.allocations) {
    if (!catArms.has(a.category)) catArms.set(a.category, []);
    catArms.get(a.category)!.push({ pub: a.publisherId, key: `${a.category}|${a.publisherId}`, alloc: a.budget, spent: 0 });
  }

  for (const [cat, arms] of catArms.entries()) {
    let unspentInCat = 0;
    
    // 1. Spend for this hour
    for (const arm of arms) {
      const remaining = state.remainingBudget.get(arm.key)!;
      if (remaining <= 0) continue;

      const hourCap = remaining * (currentWeight / weightSum);
      
      const truth = scenario.getTruth(day)[cat].find(a => a.publisherId === arm.pub)!;
      const catHash = cat.split('').reduce((acc, b) => { acc = ((acc << 5) - acc) + b.charCodeAt(0); return acc & acc }, 0);
      
      const streamSeed = (seed ^ day ^ (hour << 8) ^ catHash ^ (arm.pub << 16)) >>> 0;
      const envRng = new RNG(streamSeed);

      const dailyRng = new RNG((seed ^ day ^ catHash ^ (arm.pub << 16)) >>> 0);
      const cpcNoise = lognormal(dailyRng, -0.01125, 0.15);
      const applyNoise = Math.min(1.0, Math.max(0.001, lognormal(dailyRng, -0.005, 0.10)));

      const trueCpc = truth.cpc * cpcNoise;
      const trueApplyRate = Math.min(1.0, truth.applyRate * applyNoise);
      const hourlyCapClicks = truth.capacity * currentWeight;

      const availableClicks = poisson(envRng, hourlyCapClicks);
      const affordableClicks = Math.floor(hourCap / trueCpc);
      
      // Hard stop: ensure we do not exceed remaining budget exactly
      const maxPossibleClicks = Math.floor(remaining / trueCpc);
      const clicksBought = Math.min(availableClicks, affordableClicks, maxPossibleClicks);
      
      const cost = clicksBought * trueCpc;
      
      arm.spent = cost;
      
      // We only deduct the actual cost from remaining. But for underspend recovery, 
      // we figure out how much of the hourCap was missed.
      const missed = hourCap - cost;
      // If we missed > 0, we'll try to reallocate it. For now, deduct the full hourCap 
      // from the arm (we will give back the unspent to the category pool).
      // Wait, if an arm is budget constrained, missed = 0.
      state.remainingBudget.set(arm.key, remaining - hourCap); 
      state.totalSpend.set(arm.key, state.totalSpend.get(arm.key)! + cost);
      
      unspentInCat += missed;

      if (clicksBought > 0) {
        const applies = binomial(envRng, clicksBought, trueApplyRate);
        for (let i = 0; i < clicksBought; i++) events.push({ category: cat, publisherId: arm.pub, type: 'click', cost: trueCpc });
        for (let i = 0; i < applies; i++) events.push({ category: cat, publisherId: arm.pub, type: 'apply', cost: 0 });
      }
    }

    // Underspend recovery: distribute unspent budget for THIS hour to remaining arms 
    // proportionally to their original allocation shares.
    if (unspentInCat > 0) {
      let sumShares = 0;
      for (const a of arms) sumShares += a.alloc;
      
      if (sumShares > 0) {
        for (const arm of arms) {
           const extra = unspentInCat * (arm.alloc / sumShares);
           const current = state.remainingBudget.get(arm.key)!;
           state.remainingBudget.set(arm.key, current + extra);
        }
      } else {
        // Fallback: just give it evenly
        const extra = unspentInCat / arms.length;
        for (const arm of arms) {
           const current = state.remainingBudget.get(arm.key)!;
           state.remainingBudget.set(arm.key, current + extra);
        }
      }
    }
  }

  return events;
}
