// Response schemas for the stats and experiments endpoints (ARCHITECTURE §8).
import { z } from 'zod';
import { policySchema, scenarioSchema } from './campaigns.js';

/** One publisher on one campaign day, summed over categories. */
export const dailyStatSchema = z.object({
  /** 1-based campaign day. */
  day: z.number().int(),
  /** Calendar date in IST, YYYY-MM-DD. */
  date: z.string(),
  publisherId: z.number().int(),
  clicks: z.number().int(),
  applies: z.number().int(),
  spend: z.number(),
  /** spend / applies; null on a day without applies. */
  cpa: z.number().nullable(),
  /** Spend / applies over this and the 6 previous calendar days; null without applies in the window. */
  cpa7d: z.number().nullable(),
  /** This publisher's share of the day's spend; null when nothing was spent. */
  spendShare: z.number().nullable(),
  /** Allocated budget, summed over categories. */
  budget: z.number(),
  /** Mean P(best) over the categories with a budget; null for policies that do not compute it. */
  pBest: z.number().nullable(),
});
export type DailyStat = z.infer<typeof dailyStatSchema>;

export const statsSummarySchema = z.object({
  days: z.number().int(),
  spend: z.number(),
  /** Daily budget × days advanced. */
  budget: z.number(),
  clicks: z.number().int(),
  applies: z.number().int(),
  cpa: z.number().nullable(),
  /** spend / budget. */
  pacingRatio: z.number().nullable(),
  /** ₹ spent above the daily budget, summed over days (should be 0). */
  overdelivery: z.number(),
  /** The paired equal-split campaign over the same days; absent when there is none. */
  baseline: z.object({ applies: z.number().int(), cpa: z.number().nullable() }).optional(),
  /** (cpa / baseline cpa - 1) × 100; negative is better. Absent without a baseline, null without applies. */
  deltaCpaPct: z.number().nullable().optional(),
});
export type StatsSummary = z.infer<typeof statsSummarySchema>;

const intervalSchema = z.object({ mean: z.number(), ci: z.number() });

/** `experiments/results/results.json`, written by `pnpm exp`. */
export const experimentResultsSchema = z.object({
  command: z.string(),
  commit: z.string(),
  generatedAt: z.string(),
  runtimeSeconds: z.number(),
  options: z.object({
    seeds: z.number().int(),
    days: z.number().int(),
    scenarios: z.array(scenarioSchema),
    dailyBudget: z.number(),
    ablation: z.boolean(),
  }),
  rows: z.array(
    z.object({
      scenario: scenarioSchema,
      policy: policySchema,
      floor: z.number().optional(),
      applies: intervalSchema,
      cpa: intervalSchema,
      cpaVsEqualPct: intervalSchema,
      regret: intervalSchema,
      pacingRatio: z.number(),
      overdeliveryDays: z.number().int(),
      winsVsEqual: z.number().int(),
      winsVsGreedy: z.number().int(),
    }),
  ),
});
export type ExperimentResults = z.infer<typeof experimentResultsSchema>;
