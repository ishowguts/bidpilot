// Pacing controller (ARCHITECTURE §6.4): spends one category's daily budget over 24 hourly ticks.
//
// Per hour and arm: the arm's slice of its remaining budget follows the traffic curve, clicks bought are the
// smaller of the available clicks and what the slice pays for, and a hard stop truncates any batch that would push
// the day's spend over the category budget. An arm whose budget exceeds what today's run rate says it can buy
// stops following the curve and buys every available click. At the end of each hour, budget an arm cannot use is
// spent in that same hour on arms with spare clicks, in proportion to their allocation shares; in the last hour
// every unused ₹ is pooled the same way (ADR-010, ADR-012).
import { hourTraffic, type HourTraffic } from './simulator.js';
import { HOURLY_WEIGHTS, type ArmTruth, type Category, type PublisherId } from './scenarios.js';

export interface PacingArm {
  publisherId: PublisherId;
  /** Allocated ₹ for the day. */
  budget: number;
  /** The arm's realised parameters for the day (from `armDay`). */
  arm: ArmTruth;
}

export interface ArmHourResult {
  hour: number;
  publisherId: PublisherId;
  clicks: number;
  applies: number;
}

export interface ArmDayResult {
  publisherId: PublisherId;
  /** ₹ allocated to the arm at the start of the day. */
  budget: number;
  clicks: number;
  applies: number;
  spend: number;
  /** ₹ per click paid on this day. */
  cpc: number;
}

export interface CategoryDayResult {
  category: Category;
  budget: number;
  spend: number;
  arms: ArmDayResult[];
  /** Non-empty arm-hours only, in hour then publisher order. */
  hours: ArmHourResult[];
}

const HOURS = HOURLY_WEIGHTS.length;
/**
 * Once the run rate is trusted, an arm that ran out of clicks gives up only the part of its remaining budget above
 * this multiple of its projected spend for the rest of the day.
 */
const RUN_RATE_HEADROOM = 2;
/** The run rate is trusted once this share of the day's traffic weight has passed (about 10:00). */
const MIN_RUN_RATE_WEIGHT = 0.3;
/** Σ_{k ≥ h} w[k] for each hour h. */
const SUFFIX_WEIGHTS: readonly number[] = HOURLY_WEIGHTS.map((_, h) =>
  HOURLY_WEIGHTS.slice(h).reduce((a, b) => a + b, 0),
);

export function paceCategory(
  seed: number,
  day: number,
  category: Category,
  arms: readonly PacingArm[],
): CategoryDayResult {
  const categoryBudget = arms.reduce((sum, a) => sum + a.budget, 0);
  const shares = arms.map((a) => (categoryBudget > 0 ? a.budget / categoryBudget : 0));
  const remaining = arms.map((a) => a.budget);
  const dayClicks = arms.map(() => 0);
  const dayApplies = arms.map(() => 0);
  const daySpendByArm = arms.map(() => 0);
  const hours: ArmHourResult[] = [];
  const availableSoFar = arms.map(() => 0);
  let daySpend = 0;

  for (let hour = 0; hour < HOURS; hour++) {
    const last = hour === HOURS - 1;
    const traffic: HourTraffic[] = arms.map((a) => hourTraffic(seed, day, hour, category, a.publisherId, a.arm));
    traffic.forEach((t, i) => (availableSoFar[i]! += t.available));
    const bought = arms.map(() => 0);
    const spent = arms.map(() => 0);

    // Buys up to `money` worth of clicks on arm i, within its available clicks and the hard stop.
    const buy = (i: number, money: number): void => {
      const cpc = arms[i]!.arm.cpc;
      const affordable = Math.floor(money / cpc);
      const underStop = Math.floor((categoryBudget - daySpend) / cpc);
      const n = Math.max(0, Math.min(traffic[i]!.available - bought[i]!, affordable, underStop));
      if (n === 0) return;
      bought[i]! += n;
      spent[i]! += n * cpc;
      daySpend += n * cpc;
    };
    const hasSpare = (i: number): boolean => shares[i]! > 0 && bought[i]! < traffic[i]!.available;

    // Today's run rate (clicks per unit of traffic weight) projects each arm's clicks for the rest of the day.
    // An arm whose remaining budget exceeds that projection cannot spend it all by following the curve, so it
    // buys every available click instead of holding money back for hours that will not deliver (ADR-012).
    const seenWeight = 1 - (SUFFIX_WEIGHTS[hour + 1] ?? 0);
    const capacityBound = (i: number): boolean => {
      if (seenWeight < MIN_RUN_RATE_WEIGHT) return false;
      const projectedClicks = (availableSoFar[i]! / seenWeight) * SUFFIX_WEIGHTS[hour]!;
      return remaining[i]! >= projectedClicks * arms[i]!.arm.cpc;
    };
    const slices = remaining.map((r, i) =>
      last || capacityBound(i) ? r : (r * HOURLY_WEIGHTS[hour]!) / SUFFIX_WEIGHTS[hour]!,
    );
    slices.forEach((slice, i) => buy(i, slice));
    remaining.forEach((_, i) => (remaining[i]! -= spent[i]!));

    // Underspend recovery: an arm that ran out of clicks this hour gives up its unused slice. Once the run rate is
    // trusted, it gives up no more than the part of its remaining budget it cannot spend today; the rest is carried
    // forward so the arm can catch up in busier hours (ADR-012). In the last hour every unused ₹ is given up. The
    // pool is spent this hour on arms with spare clicks, first in proportion to allocation shares, then in arm order
    // so rounding leftovers are not lost. Donors pay in proportion to what they put in; the rest stays with them.
    const donations = arms.map((_, i) => {
      if (last) return remaining[i]!;
      if (bought[i] !== traffic[i]!.available) return 0;
      const unusedSlice = Math.max(0, slices[i]! - spent[i]!);
      if (seenWeight < MIN_RUN_RATE_WEIGHT) return unusedSlice;
      const projectedClicks = (availableSoFar[i]! * SUFFIX_WEIGHTS[hour + 1]!) / seenWeight;
      const excess = remaining[i]! - RUN_RATE_HEADROOM * projectedClicks * arms[i]!.arm.cpc;
      return Math.max(0, Math.min(unusedSlice, excess));
    });
    const donated = donations.reduce((a, b) => a + b, 0);
    const recipients = arms.map((_, i) => i).filter(hasSpare);
    const recipientShare = recipients.reduce((sum, i) => sum + shares[i]!, 0);
    if (donated > 0 && recipients.length > 0) {
      const spendBefore = daySpend;
      let pool = donated;
      const spendPool = (i: number, money: number): void => {
        const before = daySpend;
        buy(i, money);
        pool -= daySpend - before;
      };
      for (const i of recipients) spendPool(i, (donated * shares[i]!) / recipientShare);
      for (const i of recipients) spendPool(i, pool);
      const used = daySpend - spendBefore;
      donations.forEach((d, i) => (remaining[i]! -= (used * d) / donated));
    }

    arms.forEach((a, i) => {
      const applies = traffic[i]!.applies(bought[i]!);
      dayClicks[i]! += bought[i]!;
      dayApplies[i]! += applies;
      daySpendByArm[i]! += spent[i]!;
      if (bought[i]! > 0) hours.push({ hour, publisherId: a.publisherId, clicks: bought[i]!, applies });
    });
  }

  return {
    category,
    budget: categoryBudget,
    spend: daySpend,
    arms: arms.map((a, i) => ({
      publisherId: a.publisherId,
      budget: a.budget,
      clicks: dayClicks[i]!,
      applies: dayApplies[i]!,
      spend: daySpendByArm[i]!,
      cpc: a.arm.cpc,
    })),
    hours,
  };
}
