import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import type { Env } from './env.js';

const testEnv: Env = {
  DATABASE_URL: 'postgres://localhost:5433/bidpilot_test',
  PORT: 4100,
  CORS_ORIGINS: 'http://localhost:3100',
  LOG_LEVEL: 'fatal',
};

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const app = createApp(testEnv);
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'not configured' });
  });
});

describe('404 shape', () => {
  it('returns the standard error shape for unknown routes', async () => {
    const app = createApp(testEnv);
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.requestId).toBeDefined();
  });
});
