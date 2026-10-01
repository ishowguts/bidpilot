import express, { type Request, type Response, type NextFunction, type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { type Env } from './env.js';

// Error response shape per ARCHITECTURE §8.
interface ApiError {
  error: { code: string; message: string; details?: unknown };
  requestId: string;
}

export function createApp(env: Env, db?: unknown): Express {
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

  // ── 404 handler ─────────────────────────────────────────────────────────────

  app.use((_req: Request, res: Response) => {
    const body: ApiError = {
      error: { code: 'NOT_FOUND', message: 'Route not found' },
      requestId: String(_req.id ?? 'unknown'),
    };
    res.status(404).json(body);
  });

  // ── Error handler ───────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
