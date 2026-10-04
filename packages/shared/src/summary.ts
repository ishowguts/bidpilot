// LLM daily summary (ARCHITECTURE §12).
import { z } from 'zod';

/** The only input the model sees: numbers computed in SQL for one day, already rounded to the precision sent. */
export const summaryNumbersSchema = z.object({
  day: z.number().int(),
  date: z.string(),
  /** ₹, whole rupees. */
  budget: z.number().int(),
  spend: z.number().int(),
  applies: z.number().int(),
  /** ₹ per apply, whole rupees; null without applies. */
  cpa: z.number().int().nullable(),
  publishers: z.array(
    z.object({
      publisher: z.string(),
      spend: z.number().int(),
      applies: z.number().int(),
      cpa: z.number().int().nullable(),
      /** Share of the day's allocated budget, in percent with one decimal. */
      budgetSharePct: z.number(),
      /** Change in that share since the previous day, in percentage points with one decimal; null on day 1. */
      shareChangePts: z.number().nullable(),
    }),
  ),
});
export type SummaryNumbers = z.infer<typeof summaryNumbersSchema>;

export const MAX_SUMMARY_WORDS = 80;

/** What the model must return. */
export const modelSummarySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1)
    .refine((t) => t.split(/\s+/).length <= MAX_SUMMARY_WORDS, `at most ${MAX_SUMMARY_WORDS} words`),
});

export const dailySummarySchema = z.object({
  day: z.number().int(),
  date: z.string(),
  text: z.string(),
  numbers: summaryNumbersSchema,
  /** 'model' when the model's text passed validation and the grounding check; otherwise the template sentence. */
  source: z.enum(['model', 'template']),
  /** Model id that wrote `text`; null for the template. */
  model: z.string().nullable(),
});
export type DailySummary = z.infer<typeof dailySummarySchema>;

export const summaryDaySchema = z.coerce.number().int().min(1).max(90);
