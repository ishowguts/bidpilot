// Thompson sampling allocator (ARCHITECTURE §6.2), run per category once per day.
import { beta as sampleBeta, type Rng } from '../rng.js';
import { CATEGORIES, PUBLISHER_IDS, type Category, type PublisherId } from '../scenarios.js';
import {
  DEFAULT_GAMMA,
  capacityEstimate,
  cpcEstimate,
  emptyPosterior,
  updatePosterior,
  type ArmPosterior,
} from '../posterior.js';
import type { Allocation, Observation, Policy } from './types.js';

export interface ThompsonOptions {
  /** Discount factor per day; 1 means no forgetting. */
  gamma?: number;
  /** Posterior draws per arm. */
  draws?: number;
  /** Minimum share per arm. */
  floor?: number;
  /** An arm's budget is capped at this multiple of its estimated daily capacity × ĉ. */
  capacityHeadroom?: number;
}

// Floor 1%: measured better than 3% in every scenario (ADR-014).
const DEFAULTS: Required<ThompsonOptions> = { gamma: DEFAULT_GAMMA, draws: 2000, floor: 0.01, capacityHeadroom: 1.2 };

/** Used as ĉ for every arm before the category has any clicks; only CPC ratios matter, so any constant works. */
const NO_DATA_CPC = 1;

type ArmKey = `${Category}:${PublisherId}`;
const armKey = (category: Category, publisherId: PublisherId): ArmKey => `${category}:${publisherId}`;

/**
 * Share of draws in which each arm has the lowest sampled CPA = ĉ / θ, θ ~ Beta(α, β).
 * Draws are taken arm by arm within each round, in publisher order, so results are reproducible.
 */
export function probabilityBest(
  arms: readonly { alpha: number; beta: number; cpc: number }[],
  draws: number,
  rng: Rng,
): number[] {
  const wins = arms.map(() => 0);
  for (let m = 0; m < draws; m++) {
    let best = 0;
    let bestCpa = Infinity;
    arms.forEach((arm, i) => {
      const cpa = arm.cpc / sampleBeta(rng, arm.alpha, arm.beta);
      if (cpa < bestCpa) {
        bestCpa = cpa;
        best = i;
      }
    });
    wins[best]! += 1;
  }
  return wins.map((w) => w / draws);
}

/**
 * Turns pBest into budgets: floor (§6.2 step 3), then capacity caps with the excess redistributed to uncapped
 * arms in proportion to pBest (step 4). If every arm is capped, the remainder stays unallocated.
 */
export function sharesToBudgets(
  pBest: readonly number[],
  caps: readonly (number | undefined)[],
  categoryBudget: number,
  floor: number,
): number[] {
  const k = pBest.length;
  const budgets = pBest.map((p) => ((1 - k * floor) * p + floor) * categoryBudget);
  const capped = budgets.map(() => false);
  for (;;) {
    let excess = 0;
    budgets.forEach((b, i) => {
      const cap = caps[i];
      if (!capped[i] && cap !== undefined && b > cap) {
        excess += b - cap;
        budgets[i] = cap;
        capped[i] = true;
      }
    });
    if (excess <= 0) return budgets;
    const open = budgets.map((_, i) => i).filter((i) => !capped[i]);
    if (open.length === 0) return budgets;
    const weightOf = (i: number): number => pBest[i]!;
    const totalWeight = open.reduce((s, i) => s + weightOf(i), 0);
    for (const i of open) {
      budgets[i]! += totalWeight > 0 ? (excess * weightOf(i)) / totalWeight : excess / open.length;
    }
  }
}

export function createThompsonPolicy(options: ThompsonOptions = {}): Policy {
  const { gamma, draws, floor, capacityHeadroom } = { ...DEFAULTS, ...options };
  const posteriors = new Map<ArmKey, ArmPosterior>();
  let lastFoldedDay = 0;

  const posteriorOf = (category: Category, publisherId: PublisherId): ArmPosterior =>
    posteriors.get(armKey(category, publisherId)) ?? emptyPosterior();

  /** Folds every observation from days after `lastFoldedDay` up to `throughDay`, one day at a time, in order. */
  function fold(observations: readonly Observation[], throughDay: number): void {
    const byDay = new Map<number, Map<ArmKey, Observation>>();
    for (const o of observations) {
      if (o.day <= lastFoldedDay || o.day > throughDay) continue;
      let day = byDay.get(o.day);
      if (!day) byDay.set(o.day, (day = new Map()));
      if (day.has(armKey(o.category, o.publisherId))) {
        throw new Error(`duplicate observation for ${o.category}/${o.publisherId} on day ${o.day}`);
      }
      day.set(armKey(o.category, o.publisherId), o);
    }
    for (let day = lastFoldedDay + 1; day <= throughDay; day++) {
      const dayObs = byDay.get(day);
      for (const category of CATEGORIES) {
        for (const publisherId of PUBLISHER_IDS) {
          const key = armKey(category, publisherId);
          posteriors.set(key, updatePosterior(posteriorOf(category, publisherId), day, dayObs?.get(key), gamma));
        }
      }
    }
    lastFoldedDay = Math.max(lastFoldedDay, throughDay);
  }

  return {
    name: 'thompson',
    allocate(observations, categoryBudgets, rng, day): Allocation[] {
      fold(observations, day - 1);
      return CATEGORIES.flatMap((category) => {
        const arms = PUBLISHER_IDS.map((publisherId) => posteriorOf(category, publisherId));
        const categorySpend = arms.reduce((s, a) => s + a.spend, 0);
        const categoryClicks = arms.reduce((s, a) => s + a.clicks, 0);
        const meanCpc = categoryClicks > 0 ? categorySpend / categoryClicks : NO_DATA_CPC;
        const cpcs = arms.map((a) => cpcEstimate(a, meanCpc));
        const budget = categoryBudgets[category];
        const pBest =
          budget > 0
            ? probabilityBest(
                arms.map((a, i) => ({ alpha: a.alpha, beta: a.beta, cpc: cpcs[i]! })),
                draws,
                rng,
              )
            : arms.map(() => 1 / arms.length);
        const caps = arms.map((a, i) => {
          const capacity = capacityEstimate(a);
          return capacity === undefined ? undefined : capacityHeadroom * capacity * cpcs[i]!;
        });
        const budgets = sharesToBudgets(pBest, caps, budget, floor);
        return PUBLISHER_IDS.map((publisherId, i) => ({
          category,
          publisherId,
          budget: budgets[i]!,
          pBest: pBest[i]!,
          alpha: arms[i]!.alpha,
          beta: arms[i]!.beta,
          cpcEstimate: cpcs[i]!,
        }));
      });
    },
  };
}
