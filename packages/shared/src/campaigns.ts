import { z } from 'zod';

// These lists mirror packages/core; apps/api asserts at compile time that they stay identical.
export const CATEGORY_VALUES = ['software', 'sales', 'healthcare', 'logistics'] as const;
export const POLICY_VALUES = ['thompson', 'equal', 'greedy', 'oracle'] as const;
export const SCENARIO_VALUES = ['stationary', 'drift', 'emergence'] as const;

export const categorySchema = z.enum(CATEGORY_VALUES);
export const policySchema = z.enum(POLICY_VALUES);
export const scenarioSchema = z.enum(SCENARIO_VALUES);

export const DEFAULT_JOBS_PER_CATEGORY_COUNT = 5;
export const MAX_SEED = 2_147_483_647;

/** Request body of POST /api/campaigns (§8). */
export const createCampaignSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    dailyBudget: z.number().min(1000).max(1_000_000),
    days: z.number().int().min(1).max(90),
    policy: policySchema,
    scenario: scenarioSchema,
    seed: z.number().int().min(0).max(MAX_SEED).optional(),
    /** Jobs per category, 0-50 each. Omitted: 5 per category. Given: missing categories have 0 jobs. */
    jobsPerCategory: z
      .record(categorySchema, z.number().int().min(0).max(50))
      .refine((jobs) => Object.values(jobs).some((n) => n > 0), 'at least one category needs a job')
      .optional(),
    /** Create a paired equal-split campaign with the same seed. Defaults to true. */
    compareBaseline: z.boolean().optional(),
    startDate: z.string().date().optional(),
    targetCpa: z.number().positive().max(100_000).optional(),
  })
  .strict();
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

/** Request body of POST /api/campaigns/:id/advance (§8). */
export const advanceCampaignSchema = z.object({ days: z.number().int().min(1).max(30) }).strict();
export type AdvanceCampaignInput = z.infer<typeof advanceCampaignSchema>;

export const campaignIdSchema = z.string().uuid();

export const campaignSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  dailyBudget: z.number(),
  days: z.number().int(),
  startDate: z.string(),
  targetCpa: z.number().nullable(),
  policy: policySchema,
  scenario: scenarioSchema,
  seed: z.number().int(),
  /** Set on a baseline campaign: the campaign it is the equal-split comparison for. */
  baselineOf: z.string().uuid().nullable(),
  /** Set on a campaign that has a paired baseline. */
  baselineId: z.string().uuid().nullable(),
  jobsPerCategory: z.record(categorySchema, z.number().int()),
  currentDay: z.number().int(),
  /** currentDay / days, 0-1. */
  progress: z.number(),
  finished: z.boolean(),
  createdAt: z.string(),
});
export type Campaign = z.infer<typeof campaignSchema>;

export const advanceDaySchema = z.object({
  day: z.number().int(),
  date: z.string(),
  budget: z.number(),
  spend: z.number(),
  clicks: z.number().int(),
  applies: z.number().int(),
  /** ₹ per apply; null on a day without applies. */
  cpa: z.number().nullable(),
});

export const advanceResultSchema = z.object({
  currentDay: z.number().int(),
  days: z.array(advanceDaySchema),
});
export type AdvanceResult = z.infer<typeof advanceResultSchema>;
