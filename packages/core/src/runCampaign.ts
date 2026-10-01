import { type Policy, type Observation, type Allocation } from './policies/types.js';
import { type Scenario, type Category } from './scenarios.js';
import { RNG } from './rng.js';
import { initPacing, paceHour } from './pacing.js';

export interface CampaignResult {
  observations: Observation[];
  allocations: (Allocation & { day: number })[];
  totalSpend: number;
  totalApplies: number;
  totalClicks: number;
}

export function runCampaign(
  scenario: Scenario,
  policy: Policy,
  days: number,
  dailyBudget: number, // total budget across all categories
  categorySplits: Record<Category, number>, // weights to split dailyBudget across categories
  seed: number
): CampaignResult {
  const observations: Observation[] = [];
  const allAllocations: (Allocation & { day: number })[] = [];
  let totalSpend = 0;
  let totalApplies = 0;
  let totalClicks = 0;

  // Split daily budget into categories
  const catBudgets = {} as Record<Category, number>;
  let sumSplit = 0;
  for (const cat in categorySplits) sumSplit += categorySplits[cat as Category];
  for (const cat in categorySplits) {
    catBudgets[cat as Category] = dailyBudget * (categorySplits[cat as Category] / sumSplit);
  }

  const rootRng = new RNG(seed);

  for (let day = 1; day <= days; day++) {
    const policyRng = rootRng.split(day); // Seed for policy decisions
    const allocations = policy.allocate(observations, catBudgets, policyRng);
    
    // Store allocations for history
    for (const alloc of allocations) {
      allAllocations.push({ day, ...alloc });
    }

    const state = initPacing(allocations);
    
    // Collect observations for tomorrow
    const dailyObs = new Map<string, Observation>();
    for (const alloc of allocations) {
      const key = `${alloc.category}|${alloc.publisherId}`;
      dailyObs.set(key, {
        category: alloc.category,
        publisherId: alloc.publisherId,
        clicks: 0,
        applies: 0,
        spend: 0
      });
    }

    // Run 24 hours
    for (let hour = 0; hour < 24; hour++) {
      const events = paceHour(state, scenario, day, hour, seed);
      for (const e of events) {
        if (e.type === 'click') {
          totalClicks++;
          totalSpend += e.cost;
        } else {
          totalApplies++;
        }
        
        const obs = dailyObs.get(`${e.category}|${e.publisherId}`);
        if (obs) {
          if (e.type === 'click') {
            obs.clicks++;
            obs.spend += e.cost;
          } else {
            obs.applies++;
          }
        }
      }
    }
    
    for (const obs of dailyObs.values()) {
      observations.push(obs);
    }
  }
  
  return { observations, allocations: allAllocations, totalSpend, totalApplies, totalClicks };
}
