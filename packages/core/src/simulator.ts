// Hour-level traffic simulator (ARCHITECTURE §5.1, §6.4 steps 2 and 5).
//
// All draws come from environment streams keyed by (seed, day, hour, category, publisher) and never by policy, so
// every policy faces the same traffic and noise for a seed. Within an hour the stream is consumed in a fixed order
// (available clicks, then applies), so the available clicks do not depend on how many clicks the policy buys.
import { binomial, envDayStream, envStream, lognormal, poisson } from './rng.js';
import {
  APPLY_RATE_NOISE_SIGMA,
  CPC_NOISE_SIGMA,
  HOURLY_WEIGHTS,
  armTruth,
  type ArmTruth,
  type Category,
  type PublisherId,
  type ScenarioName,
} from './scenarios.js';

/** Highest apply rate after noise; keeps the rate inside (0, 1). */
const MAX_APPLY_RATE = 0.999;

/** One arm's realised parameters for one day: ground truth times that day's noise. */
export function armDay(
  seed: number,
  scenario: ScenarioName,
  day: number,
  category: Category,
  publisher: PublisherId,
): ArmTruth {
  const truth = armTruth(scenario, day, category, publisher);
  const rng = envDayStream(seed, day, category, publisher);
  const cpcFactor = lognormal(rng, 0, CPC_NOISE_SIGMA);
  const rateFactor = lognormal(rng, 0, APPLY_RATE_NOISE_SIGMA);
  return {
    // Rounded to paise so spend sums are exact in both the in-memory path and SQL (numeric) rollups.
    cpc: Math.round(truth.cpc * cpcFactor * 100) / 100,
    applyRate: Math.min(truth.applyRate * rateFactor, MAX_APPLY_RATE),
    capacity: truth.capacity,
  };
}

export interface HourTraffic {
  /** Clicks the publisher can deliver this hour, ~ Poisson(capacity × w[hour]). */
  available: number;
  /** Applies for the clicks actually bought, ~ Binomial(clicks, applyRate). Call at most once. */
  applies(clicks: number): number;
}

/** Opens one arm's traffic for one hour of a day. */
export function hourTraffic(
  seed: number,
  day: number,
  hour: number,
  category: Category,
  publisher: PublisherId,
  arm: ArmTruth,
): HourTraffic {
  const rng = envStream(seed, day, hour, category, publisher);
  const available = poisson(rng, arm.capacity * HOURLY_WEIGHTS[hour]!);
  let used = false;
  return {
    available,
    applies(clicks: number): number {
      if (used) throw new Error('applies() already drawn for this hour');
      if (clicks > available) throw new Error(`bought ${clicks} clicks but only ${available} available`);
      used = true;
      return binomial(rng, clicks, arm.applyRate);
    },
  };
}
