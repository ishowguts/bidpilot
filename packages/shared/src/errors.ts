import { z } from 'zod';

/** Error body of every non-2xx response (ARCHITECTURE §8). */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(['VALIDATION_ERROR', 'NOT_FOUND', 'CONFLICT', 'PAYLOAD_TOO_LARGE', 'INTERNAL']),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  requestId: z.string(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
