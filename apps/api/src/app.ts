import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import type { Database } from '@bidpilot/db';
import type { Env } from './env.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { healthRouter } from './routes/health.js';
import { eventsRouter } from './routes/events.js';

export interface AppDeps {
  env: Env;
  db: Database;
}

export function createApp({ env, db }: AppDeps): Express {
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
  app.use(cors({ origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', healthRouter(db));
  app.use('/api', eventsRouter(db));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
