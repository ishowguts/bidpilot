import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { createClient } from '@bidpilot/db';
import { createApp } from './app.js';
import { resetDb, testApp, testDb, testEnv } from './test/setup.js';

const CAMPAIGN_ID = '00000000-0000-0000-0000-000000000001';

// An app whose database cannot be reached: every query fails, so DB-backed routes must answer 500 INTERNAL.
const downApp = createApp({
  env: testEnv,
  db: createClient('postgres://postgres:postgres@localhost:1/none'),
});

describe('GET /api/health', () => {
  it('reports the database as up', async () => {
    const res = await request(testApp).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('reports 503 when the database is unreachable', async () => {
    const res = await request(downApp).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', db: 'down' });
  });
});

describe('GET /api/publishers', () => {
  it('lists the six seeded publishers', async () => {
    const res = await request(testApp).get('/api/publishers');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
    expect(res.body[0]).toEqual({ id: expect.any(Number), slug: 'pub-a', name: 'Publisher A' });
  });

  it('answers 500 with the error shape when the database is unreachable', async () => {
    const res = await request(downApp).get('/api/publishers');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL', message: 'internal server error' },
      requestId: expect.any(String),
    });
  });
});

describe('database failures on other routes', () => {
  it('list, read, stats and ingestion answer 500 INTERNAL without leaking details', async () => {
    const id = '00000000-0000-0000-0000-000000000002';
    for (const res of [
      await request(downApp).get('/api/campaigns'),
      await request(downApp).get(`/api/campaigns/${id}`),
      await request(downApp).get(`/api/campaigns/${id}/stats/summary`),
      await request(downApp).post(`/api/campaigns/${id}/advance`).send({ days: 1 }),
    ]) {
      expect(res.status).toBe(500);
      expect(res.body.error).toEqual({ code: 'INTERNAL', message: 'internal server error' });
    }
  });
});

describe('errors', () => {
  it('unknown routes return the standard error shape and echo the request id', async () => {
    const res = await request(testApp).get('/api/nonexistent').set('x-request-id', 'req-123');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String) },
      requestId: 'req-123',
    });
  });

  it('malformed JSON is a validation error', async () => {
    const res = await request(testApp)
      .post('/api/events')
      .set('content-type', 'application/json')
      .send('{"events": [');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/events', () => {
  let jobId: number;
  let publisherId: number;

  beforeEach(async () => {
    await resetDb();
    await testDb.execute(sql`
      INSERT INTO campaigns (id, name, daily_budget, days, start_date, policy, scenario, seed)
      VALUES (${CAMPAIGN_ID}, 'Test Campaign', 1000, 30, '2026-10-01', 'equal', 'stationary', 42)`);
    const job = await testDb.execute<{ id: string }>(sql`
      INSERT INTO jobs (campaign_id, title, category) VALUES (${CAMPAIGN_ID}, 'Test Job', 'software') RETURNING id`);
    jobId = Number(job[0]!.id);
    const pub = await testDb.execute<{ id: number }>(sql`SELECT id FROM publishers WHERE slug = 'pub-a'`);
    publisherId = pub[0]!.id;
  });

  const event = (key: string) => ({
    idempotencyKey: key,
    campaignId: CAMPAIGN_ID,
    jobId,
    publisherId,
    type: 'click',
    cost: 12.5,
    ts: '2026-10-01T10:00:00Z',
  });

  it('rejects an invalid event type', async () => {
    const res = await request(testApp)
      .post('/api/events')
      .send({ events: [{ ...event('k1'), type: 'view' }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });

  it('rejects more than 1000 events with 413', async () => {
    const res = await request(testApp)
      .post('/api/events')
      .send({ events: Array.from({ length: 1001 }, (_, i) => event(`k${i}`)) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('is idempotent: the same batch twice is all duplicates and the row count is unchanged', async () => {
    const payload = { events: [event('k1'), event('k2')] };
    const first = await request(testApp).post('/api/events').send(payload);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ accepted: 2, duplicates: 0 });
    const second = await request(testApp).post('/api/events').send(payload);
    expect(second.body).toEqual({ accepted: 0, duplicates: 2 });
    const count = await testDb.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM events`);
    expect(count[0]!.n).toBe(2);
    const stats = await testDb.execute<{ clicks: number; spend: string }>(
      sql`SELECT clicks::int, spend::text FROM daily_stats WHERE campaign_id = ${CAMPAIGN_ID}`,
    );
    expect(stats[0]).toEqual({ clicks: 2, spend: '25.0000' });
  });
});
