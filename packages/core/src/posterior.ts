// Discounted Beta posteriors and CPC / capacity estimates per arm (ARCHITECTURE §6.2).
//
// The posterior is a fold over days. Updating with day d first applies the discount once for every day elapsed
// since the last update (days without evidence still age the old evidence), then adds day d's counts:
//   α ← 1 + γ^k·(α − 1) + applies,  β ← 1 + γ^k·(β − 1) + (clicks − applies),  k = d − lastDay.
// With k = 1 this is exactly the §6.2 update, and k > 1 equals k single-day updates where the skipped days had no
// clicks. Folding a full history and updating day by day give the same state.

export const DEFAULT_GAMMA = 0.95;
/** ĉ uses the category mean CPC until the arm has this many clicks (§6.2). */
export const CPC_PRIOR_CLICKS = 20;
/**
 * An arm is treated as capacity-limited on a day when it left more than this share of its allocation unspent and
 * more than `CAPACITY_LIMITED_MIN_CLICKS` clicks' worth. The second condition keeps integer-click rounding on small
 * budgets from looking like a capacity limit (which would cap the arm at a tiny budget for good).
 */
export const CAPACITY_LIMITED_UNSPENT_RATIO = 0.05;
export const CAPACITY_LIMITED_MIN_CLICKS = 3;

export interface ArmPosterior {
  alpha: number;
  beta: number;
  /** Discounted spend and clicks, for the discounted mean CPC. */
  spend: number;
  clicks: number;
  /** Undiscounted clicks ever observed, for the CPC prior threshold. */
  totalClicks: number;
  /** Discounted sum of clicks on capacity-limited days, and the discounted count of those days. */
  limitedClicks: number;
  limitedDays: number;
  /** Last day whose evidence is included; 0 before any update. */
  lastDay: number;
}

export interface DayEvidence {
  clicks: number;
  applies: number;
  spend: number;
  /** The budget that was allocated to the arm that day. */
  budget: number;
}

export function emptyPosterior(): ArmPosterior {
  return { alpha: 1, beta: 1, spend: 0, clicks: 0, totalClicks: 0, limitedClicks: 0, limitedDays: 0, lastDay: 0 };
}

/** Returns the posterior after adding the evidence of `day`; `evidence` is undefined for a day with no data. */
export function updatePosterior(
  state: ArmPosterior,
  day: number,
  evidence: DayEvidence | undefined,
  gamma: number,
): ArmPosterior {
  if (!(gamma > 0 && gamma <= 1)) throw new Error(`gamma must be in (0, 1], got ${gamma}`);
  if (!Number.isInteger(day) || day <= state.lastDay) {
    throw new Error(`posterior days must increase: got day ${day} after day ${state.lastDay}`);
  }
  const clicks = evidence?.clicks ?? 0;
  const applies = evidence?.applies ?? 0;
  if (applies > clicks) throw new Error(`applies (${applies}) exceed clicks (${clicks}) on day ${day}`);
  const discount = gamma ** (day - state.lastDay);
  const limited = evidence !== undefined && isCapacityLimited(evidence);
  return {
    alpha: 1 + discount * (state.alpha - 1) + applies,
    beta: 1 + discount * (state.beta - 1) + (clicks - applies),
    spend: discount * state.spend + (evidence?.spend ?? 0),
    clicks: discount * state.clicks + clicks,
    totalClicks: state.totalClicks + clicks,
    limitedClicks: discount * state.limitedClicks + (limited ? clicks : 0),
    limitedDays: discount * state.limitedDays + (limited ? 1 : 0),
    lastDay: day,
  };
}

function isCapacityLimited(evidence: DayEvidence): boolean {
  const unspent = evidence.budget - evidence.spend;
  const dayCpc = evidence.clicks > 0 ? evidence.spend / evidence.clicks : 0;
  return unspent > CAPACITY_LIMITED_UNSPENT_RATIO * evidence.budget && unspent > CAPACITY_LIMITED_MIN_CLICKS * dayCpc;
}

/** Discounted mean CPC, or `categoryMeanCpc` until the arm has `CPC_PRIOR_CLICKS` clicks. */
export function cpcEstimate(state: ArmPosterior, categoryMeanCpc: number): number {
  return state.totalClicks >= CPC_PRIOR_CLICKS && state.clicks > 0 ? state.spend / state.clicks : categoryMeanCpc;
}

/** Estimated daily click capacity from capacity-limited days; undefined (uncapped) if never limited. */
export function capacityEstimate(state: ArmPosterior): number | undefined {
  return state.limitedDays > 0 ? state.limitedClicks / state.limitedDays : undefined;
}
