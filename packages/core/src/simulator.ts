import { RNG, lognormal, poisson, binomial } from './rng.js';
import { type Scenario, type PublisherId, type Category } from './scenarios.js';

export interface Event {
  publisherId: PublisherId;
  type: 'click' | 'apply';
  cost: number;
}

// 24 hours traffic weights, summing to 1. Low at night, peaks 10-13, 19-22.
export const HOURLY_WEIGHTS = [
  0.01, 0.01, 0.01, 0.01, 0.01, 0.01, // 0-5
  0.02, 0.04, 0.06, 0.08, 0.07, 0.06, // 6-11 (peak 9-11)
  0.05, 0.05, 0.04, 0.04, 0.04, 0.05, // 12-17
  0.06, 0.08, 0.07, 0.06, 0.04, 0.03, // 18-23 (peak 19-21)
];

// simulateHour runs the simulator for a single hour for a specific category, publisher, and budget
export function simulateHour(
  scenario: Scenario,
  category: Category,
  publisherId: PublisherId,
  budget: number,
  day: number,
  hour: number,
  seed: number
): Event[] {
  if (budget <= 0) return [];
  
  const truth = scenario.getTruth(day)[category].find(a => a.publisherId === publisherId)!;
  
  // Environment stream: derived from seed, day, hour, category (as string hash), publisherId
  const catHash = category.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
  const streamSeed = (seed ^ day ^ (hour << 8) ^ catHash ^ (publisherId << 16)) >>> 0;
  const envRng = new RNG(streamSeed);

  // Daily noise: lognormal with mean 1.0. If X ~ N(mu, sigma^2), E[exp(X)] = exp(mu + sigma^2/2).
  // To get E = 1.0, we need mu = -sigma^2/2.
  const dailyRng = new RNG((seed ^ day ^ catHash ^ (publisherId << 16)) >>> 0);
  const cpcNoise = lognormal(dailyRng, -0.01125, 0.15); // -0.15^2 / 2
  const applyNoise = Math.min(1.0, Math.max(0.001, lognormal(dailyRng, -0.005, 0.10))); // -0.10^2 / 2

  const trueCpc = truth.cpc * cpcNoise;
  const trueApplyRate = Math.min(1.0, truth.applyRate * applyNoise);
  const hourlyCap = truth.capacity * HOURLY_WEIGHTS[hour];

  // Number of available clicks is poisson distributed around hourly capacity
  const availableClicks = poisson(envRng, hourlyCap);
  
  // How many clicks can we afford?
  const affordableClicks = Math.floor(budget / trueCpc);
  
  // We get the min of what's available and what we can afford
  const clicks = Math.min(availableClicks, affordableClicks);
  if (clicks === 0) return [];

  // Simulate applies using binomial
  const applies = binomial(envRng, clicks, trueApplyRate);

  const events: Event[] = [];
  for (let i = 0; i < clicks; i++) {
    events.push({ publisherId, type: 'click', cost: trueCpc });
  }
  for (let i = 0; i < applies; i++) {
    events.push({ publisherId, type: 'apply', cost: 0 }); // Applies are free, cost is on clicks
  }
  
  return events;
}
