import { z } from 'zod';

export const eventSchema = z.object({
  idempotencyKey: z.string().min(1),
  campaignId: z.string().uuid(),
  jobId: z.number().int().positive(),
  publisherId: z.number().int().positive(),
  type: z.enum(['click', 'apply']),
  cost: z.number().min(0),
  ts: z.string().datetime(),
});

export type EventPayload = z.infer<typeof eventSchema>;

export const MAX_EVENTS_PER_BATCH = 1000;

export const eventBatchSchema = z.object({
  events: z.array(eventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});

export const eventBatchResultSchema = z.object({ accepted: z.number().int(), duplicates: z.number().int() });
export type EventBatchResult = z.infer<typeof eventBatchResultSchema>;

export type EventBatchPayload = z.infer<typeof eventBatchSchema>;
