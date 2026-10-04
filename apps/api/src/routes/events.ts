import { Router } from 'express';
import { MAX_EVENTS_PER_BATCH, eventBatchSchema } from '@bidpilot/shared';
import { insertEvents, refreshDailyStats, type Database } from '@bidpilot/db';
import { HttpError, handle, parse } from '../middleware/errors.js';

export function eventsRouter(db: Database): Router {
  const router = Router();

  router.post(
    '/events',
    handle(async (req, res) => {
      // An oversized batch is 413 (§8), checked before the schema so it is not reported as a validation error.
      const events: unknown = (req.body as { events?: unknown } | undefined)?.events;
      if (Array.isArray(events) && events.length > MAX_EVENTS_PER_BATCH) {
        throw new HttpError('PAYLOAD_TOO_LARGE', `at most ${MAX_EVENTS_PER_BATCH} events per batch`);
      }
      const batch = parse(eventBatchSchema, req.body);
      const result = await db.transaction(async (tx) => {
        const counts = await insertEvents(tx, batch.events);
        if (counts.accepted > 0) await refreshDailyStats(tx);
        return counts;
      });
      res.json(result);
    }),
  );

  return router;
}
