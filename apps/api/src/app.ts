import express, { type Request, type Response, type NextFunction, type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { type Env } from './env.js';
import { eventBatchSchema } from '@bidpilot/shared';
import { type Database, insertEvents, refreshDailyStats } from '@bidpilot/db';

// Error response shape per ARCHITECTURE §8.
interface ApiError {
  error: { code: string; message: string; details?: unknown };
  requestId: string;
}

export function createApp(env: Env, db?: Database): Express {
  const app = express();

  // ── Middleware ───────────────────────────────────────────────────────────────

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.split(',') }));
  app.use(express.json({ limit: '1mb' }));

  // Request ID — attached to every request for tracing.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.id = (req.headers['x-request-id'] as string) || randomUUID();
    next();
  });

  // ── Routes ──────────────────────────────────────────────────────────────────

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', db: db ? 'connected' : 'not configured' });
  });

  app.get('/api/publishers', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!db) {
        res.json([]);
        return;
      }
      res.json([]);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/events', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!db) {
        res.status(500).json({
          error: { code: 'INTERNAL', message: 'Database not configured' },
          requestId: req.id ?? 'unknown',
        });
        return;
      }
      const parsed = eventBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
        // 1001 events should be PAYLOAD_TOO_LARGE per ACCEPT criteria, but Zod min(1)/max(1000) causes VALIDATION_ERROR normally.
        // Let's do a quick manual check for payload length first, or transform the Zod array length error.
        if (Array.isArray(req.body.events) && req.body.events.length > 1000) {
          res.status(413).json({
             error: { code: 'PAYLOAD_TOO_LARGE', message: 'Maximum 1000 events per batch' },
             requestId: req.id ?? 'unknown',
          });
          return;
        }

        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: errorMsg },
          requestId: req.id ?? 'unknown',
        });
        return;
      }

      const { accepted, duplicates } = await insertEvents(db, parsed.data.events);
      await refreshDailyStats(db);
      res.json({ accepted, duplicates });
    } catch (err) {
      next(err);
    }
  });

  // ── 404 handler ─────────────────────────────────────────────────────────────

  app.use((_req: Request, res: Response) => {
    const body: ApiError = {
      error: { code: 'NOT_FOUND', message: 'Route not found' },
      requestId: String(_req.id ?? 'unknown'),
    };
    res.status(404).json(body);
  });

  // ── Error handler ───────────────────────────────────────────────────────────

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error(`[${req.id}]`, err);
    const body: ApiError = {
      error: { code: 'INTERNAL', message: err.message || 'Internal server error' },
      requestId: String(req.id ?? 'unknown'),
    };
    res.status(500).json(body);
  });

  return app;
}
