import { Router } from 'express';
import { campaignIdSchema, summaryDaySchema } from '@bidpilot/shared';
import type { Database } from '@bidpilot/db';
import type { LlmClient } from '../llm.js';
import { handle, parse } from '../middleware/errors.js';
import { dailySummary } from '../services/summary.js';

export function summaryRouter(db: Database, llm: LlmClient | null): Router {
  const router = Router();
  router.get(
    '/campaigns/:id/summary/:day',
    handle(async (req, res) => {
      const id = parse(campaignIdSchema, req.params.id);
      const day = parse(summaryDaySchema, req.params.day);
      res.json(
        await dailySummary(db, llm, id, day, (reason) => req.log.warn({ campaignId: id, day }, reason)),
      );
    }),
  );
  return router;
}
