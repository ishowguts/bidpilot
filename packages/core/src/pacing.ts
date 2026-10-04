// Pacing controller (ARCHITECTURE §6.4): spends one category's daily budget over 24 hourly ticks.
//
// Per hour and arm: the arm's slice of its remaining budget follows the traffic curve, clicks bought are the
// smaller of the available clicks and what the slice pays for, and a hard stop truncates any batch that would push
// the day's spend over the category budget. At the end of each hour, the unused slice of an arm that ran out of
// clicks is spent in that same hour on arms with spare clicks, in proportion to their allocation shares. In the
// last hour every unused ₹ is pooled the same way, so underspend is limited to about one click (ADR-010).
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
  let daySpend = 0;

  for (let hour = 0; hour < HOURS; hour++) {
    const last = hour === HOURS - 1;
    const traffic: HourTraffic[] = arms.map((a) => hourTraffic(seed, day, hour, category, a.publisherId, a.arm));
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

    const slices = remaining.map((r) => (last ? r : (r * HOURLY_WEIGHTS[hour]!) / SUFFIX_WEIGHTS[hour]!));
    slices.forEach((slice, i) => buy(i, slice));
    remaining.forEach((_, i) => (remaining[i]! -= spent[i]!));

    // Underspend recovery: the unused slice of every capacity-limited arm (in the last hour, every unused ₹)
    // is pooled and spent this hour on arms with spare clicks, first in proportion to allocation shares, then in
    // arm order so rounding leftovers are not lost. Donors pay for it in proportion to what they put in; the
    // rest stays with them.
    const donations = arms.map((_, i) =>
      last ? remaining[i]! : bought[i] === traffic[i]!.available ? Math.max(0, slices[i]! - spent[i]!) : 0,
    );
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
      clicks: dayClicks[i]!,
      applies: dayApplies[i]!,
      spend: daySpendByArm[i]!,
      cpc: a.arm.cpc,
    })),
    hours,
  };
}
