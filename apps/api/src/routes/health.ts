import { Router } from 'express';
import { asc, sql } from 'drizzle-orm';
import { publishers, type Database } from '@bidpilot/db';
import { handle } from '../middleware/errors.js';

export function healthRouter(db: Database): Router {
  const router = Router();

  router.get(
    '/health',
    handle(async (req, res) => {
      let dbStatus: 'up' | 'down' = 'up';
      try {
        await db.execute(sql`select 1`);
      } catch (err) {
        req.log.warn({ err }, 'database health check failed');
        dbStatus = 'down';
      }
      res
        .status(dbStatus === 'up' ? 200 : 503)
        .json({ status: dbStatus === 'up' ? 'ok' : 'degraded', db: dbStatus });
    }),
  );

  router.get(
    '/publishers',
    handle(async (_req, res) => {
      const rows = await db
        .select({ id: publishers.id, slug: publishers.slug, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.id));
      res.json(rows);
    }),
  );

  return router;
}
