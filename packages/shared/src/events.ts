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

export const eventBatchSchema = z.object({
  events: z.array(eventSchema).min(1).max(1000),
});

export type EventBatchPayload = z.infer<typeof eventBatchSchema>;
