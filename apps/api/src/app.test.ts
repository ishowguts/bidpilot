import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import type { Env } from './env.js';
import { createClient } from '@bidpilot/db';
import { sql } from 'drizzle-orm';

const testEnv: Env = {
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5433/bidpilot_test',
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

describe('POST /api/events', () => {
  const db = createClient(testEnv.DATABASE_URL);
  
  beforeAll(async () => {
    // Seed campaign and job for FK constraints
    await db.execute(sql`
      INSERT INTO campaigns (id, name, daily_budget, days, start_date, policy, scenario, seed)
      VALUES ('00000000-0000-0000-0000-000000000001', 'Test Campaign', 1000, 30, '2026-10-01', 'equal', 'stationary', 42)
      ON CONFLICT DO NOTHING;
    `);
    await db.execute(sql`
      INSERT INTO jobs (id, campaign_id, title, category)
      VALUES (1, '00000000-0000-0000-0000-000000000001', 'Test Job', 'software')
      ON CONFLICT DO NOTHING;
    `);
    // Seed publishers
    await db.execute(sql`
       INSERT INTO publishers (id, slug, name)
       VALUES (1, 'pub-a', 'Pub A')
       ON CONFLICT DO NOTHING;
    `);
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM events`);
    await db.execute(sql`DELETE FROM jobs WHERE id = 1`);
    await db.execute(sql`DELETE FROM campaigns WHERE id = '00000000-0000-0000-0000-000000000001'`);
  });

  it('rejects invalid payload', async () => {
    const app = createApp(testEnv, db);
    const res = await request(app).post('/api/events').send({
      events: [{ type: 'invalid' }]
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects > 1000 events', async () => {
    const app = createApp(testEnv, db);
    const events = Array.from({ length: 1001 }).map(() => ({}));
    const res = await request(app).post('/api/events').send({ events });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('inserts events idempotently', async () => {
    const app = createApp(testEnv, db);
    const payload = {
      events: [
        {
          idempotencyKey: 'key-1',
          campaignId: '00000000-0000-0000-0000-000000000001',
          jobId: 1,
          publisherId: 1,
          type: 'click',
          cost: 12.50,
          ts: '2026-10-01T10:00:00Z',
        }
      ]
    };
    
    // First insert
    const res1 = await request(app).post('/api/events').send(payload);
    expect(res1.status).toBe(200);
    expect(res1.body).toEqual({ accepted: 1, duplicates: 0 });
    
    // Second insert (duplicate)
    const res2 = await request(app).post('/api/events').send(payload);
    expect(res2.status).toBe(200);
    expect(res2.body).toEqual({ accepted: 0, duplicates: 1 });
  });
});
