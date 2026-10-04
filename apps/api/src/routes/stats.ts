import { readFile } from 'node:fs/promises';
import { Router } from 'express';
import { campaignIdSchema, experimentResultsSchema } from '@bidpilot/shared';
import type { Database } from '@bidpilot/db';
import { HttpError, handle, parse } from '../middleware/errors.js';
import { dailyStats, statsSummary } from '../services/stats.js';

/** Committed output of `pnpm exp`, resolved from this file (src/routes or dist/routes) to the repo root. */
export const DEFAULT_RESULTS_PATH = new URL('../../../../experiments/results/results.json', import.meta.url);

export function statsRouter(db: Database, resultsPath: URL | string = DEFAULT_RESULTS_PATH): Router {
  const router = Router();

  router.get(
    '/campaigns/:id/stats/daily',
    handle(async (req, res) => {
      res.json(await dailyStats(db, parse(campaignIdSchema, req.params.id)));
    }),
  );

  router.get(
    '/campaigns/:id/stats/summary',
    handle(async (req, res) => {
      res.json(await statsSummary(db, parse(campaignIdSchema, req.params.id)));
    }),
  );

  router.get(
    '/experiments/latest',
    handle(async (_req, res) => {
      let text: string;
      try {
        text = await readFile(resultsPath, 'utf8');
      } catch {
        throw new HttpError('NOT_FOUND', 'no experiment results yet: run `pnpm exp`');
      }
      // A malformed file is a server fault, so it surfaces as 500 rather than a client validation error.
      res.json(experimentResultsSchema.parse(JSON.parse(text)));
    }),
  );

  return router;
}
