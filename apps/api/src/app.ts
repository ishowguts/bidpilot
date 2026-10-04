import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import type { Database } from '@bidpilot/db';
import { normalizeOrigin, type Env } from './env.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { healthRouter } from './routes/health.js';
import { eventsRouter } from './routes/events.js';
import { campaignsRouter } from './routes/campaigns.js';
import { statsRouter } from './routes/stats.js';
import { summaryRouter } from './routes/summary.js';
import type { LlmClient } from './llm.js';

export interface AppDeps {
  env: Env;
  db: Database;
  /** Location of `experiments/results/results.json`; tests point it elsewhere. */
  resultsPath?: URL | string;
  /** Writes the daily summaries; null or absent means the template is used (ARCHITECTURE §12). */
  llm?: LlmClient | null;
}

export function createApp({ env, db, resultsPath, llm = null }: AppDeps): Express {
  const app = express();

  app.use(
    pinoHttp({
      level: env.LOG_LEVEL,
      // Honour an incoming x-request-id so a request can be traced across services.
      genReqId: (req, res) => {
        const header = req.headers['x-request-id'];
        const id =
          typeof header === 'string' && header.length > 0 && header.length <= 128 ? header : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
    }),
  );
  app.use(helmet());
  const allowedOrigins = new Set(env.CORS_ORIGINS);
  app.use(
    cors({
      // Compared after normalization on both sides, so a trailing slash or case difference cannot block browsers.
      // Requests without an Origin header (server to server, curl) are not subject to CORS.
      origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(normalizeOrigin(origin))),
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', healthRouter(db));
  app.use('/api', eventsRouter(db));
  app.use('/api', campaignsRouter(db));
  app.use('/api', statsRouter(db, resultsPath));
  app.use('/api', summaryRouter(db, llm));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
