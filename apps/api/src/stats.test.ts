import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { refreshDailyStats } from '@bidpilot/db';
import { createApp } from './app.js';
import { istHourStart } from './services/dayEvents.js';
import { resetDb, testApp, testDb, testEnv } from './test/setup.js';

type Category = 'software' | 'sales';

async function jobOf(campaignId: string, category: Category): Promise<number> {
  const [row] = await testDb.execute<{ id: string }>(
    sql`SELECT id FROM jobs WHERE campaign_id = ${campaignId} AND category = ${category} ORDER BY id LIMIT 1`,
  );
  return Number(row!.id);
}

async function allocate(
  campaignId: string,
  date: string,
  category: Category,
  publisherId: number,
  budget: number,
  pBest: number,
): Promise<void> {
  await testDb.execute(sql`
    INSERT INTO allocations (campaign_id, day, category, publisher_id, budget, p_best)
    VALUES (${campaignId}, ${date}, ${category}, ${publisherId}, ${budget}, ${pBest})`);
}

let seq = 0;
/** `clicks` clicks at `cpc` and `applies` applies at IST `hour:minute` on `date`. */
async function events(
  campaignId: string,
  category: Category,
  publisherId: number,
  date: string,
  hour: number,
  clicks: number,
  cpc: number,
  applies: number,
  minute = 0,
): Promise<void> {
  const jobId = await jobOf(campaignId, category);
  const ts = new Date(istHourStart(date, hour) + minute * 60_000).toISOString();
  const rows = [
    ...Array.from({ length: clicks }, () => ({ type: 'click', cost: cpc })),
    ...Array.from({ length: applies }, () => ({ type: 'apply', cost: 0 })),
  ];
  for (const r of rows) {
    await testDb.execute(sql`
      INSERT INTO events (idempotency_key, campaign_id, job_id, publisher_id, type, cost, ts)
      VALUES (${`fixture-${seq++}`}, ${campaignId}, ${jobId}, ${publisherId}, ${r.type}, ${r.cost}, ${ts})`);
  }
}

/**
 * Hand-computed fixture (dates are IST; the campaign starts 2026-10-01, ₹1,000 a day, 9 days advanced):
 *
 * | day | publisher | clicks | applies | spend | budget        | pBest (budget > 0)  |
 * | 1   | 1         | 4+2    | 1+1     | 40+30 | 300+250       | (0.75+0.5)/2        |
 * | 1   | 2         | 3      | 0       | 60    | 200+250       | (0.25+0.5)/2        |
 * | 2   | 1         | 5      | 2       | 50    | 400+500       | (0.75+1)/2          |
 * | 2   | 2         | 1      | 1       | 30    | 100+0         | 0.25 (0 excluded)   |
 * | 3   | 1         | 0      | 0       | 0     | 100           | 0.5                 |
 * | 9   | 1         | 2      | 1       | 50    | 500           | 0.875               |
 *
 * Publisher 2's day-2 click is at 00:30 IST, which is still 2026-10-01 in UTC: it must count on day 2.
 * The baseline spends ₹1,100 on day 1 for 4 applies: ₹100 of overdelivery, CPA 275.
 */
async function fixture(): Promise<{ id: string; baselineId: string }> {
  const created = await request(testApp).post('/api/campaigns').send({
    name: 'Fixture',
    dailyBudget: 1000,
    days: 10,
    policy: 'thompson',
    scenario: 'stationary',
    seed: 1,
    startDate: '2026-10-01',
  });
  const { id, baselineId } = created.body as { id: string; baselineId: string };

  await allocate(id, '2026-10-01', 'software', 1, 300, 0.75);
  await allocate(id, '2026-10-01', 'software', 2, 200, 0.25);
  await allocate(id, '2026-10-01', 'sales', 1, 250, 0.5);
  await allocate(id, '2026-10-01', 'sales', 2, 250, 0.5);
  await allocate(id, '2026-10-02', 'software', 1, 400, 0.75);
  await allocate(id, '2026-10-02', 'software', 2, 100, 0.25);
  await allocate(id, '2026-10-02', 'sales', 1, 500, 1);
  await allocate(id, '2026-10-02', 'sales', 2, 0, 0);
  await allocate(id, '2026-10-03', 'software', 1, 100, 0.5);
  await allocate(id, '2026-10-09', 'software', 1, 500, 0.875);

  await events(id, 'software', 1, '2026-10-01', 10, 4, 10, 1);
  await events(id, 'sales', 1, '2026-10-01', 15, 2, 15, 1);
  await events(id, 'software', 2, '2026-10-01', 23, 3, 20, 0);
  await events(id, 'software', 1, '2026-10-02', 10, 5, 10, 2);
  await events(id, 'sales', 2, '2026-10-02', 0, 1, 30, 1, 30);
  await events(id, 'software', 1, '2026-10-09', 12, 2, 25, 1);
  await events(baselineId, 'software', 3, '2026-10-01', 9, 110, 10, 4);

  await testDb.execute(sql`UPDATE campaigns SET current_day = 9 WHERE id IN (${id}, ${baselineId})`);
  await refreshDailyStats(testDb);
  return { id, baselineId };
}

describe('stats API', () => {
  beforeEach(resetDb);

  it('daily stats match the hand-computed fixture', async () => {
    const { id } = await fixture();
    const res = await request(testApp).get(`/api/campaigns/${id}/stats/daily`);
    expect(res.status).toBe(200);
    const row = (day: number, publisherId: number, rest: object) => ({ day, publisherId, ...rest });
    expect(res.body).toEqual([
      row(1, 1, {
        date: '2026-10-01',
        clicks: 6,
        applies: 2,
        spend: 70,
        cpa: 35,
        cpa7d: 35,
        spendShare: 70 / 130,
        budget: 550,
        pBest: 0.625,
      }),
      row(1, 2, {
        date: '2026-10-01',
        clicks: 3,
        applies: 0,
        spend: 60,
        cpa: null,
        cpa7d: null,
        spendShare: 60 / 130,
        budget: 450,
        pBest: 0.375,
      }),
      row(2, 1, {
        date: '2026-10-02',
        clicks: 5,
        applies: 2,
        spend: 50,
        cpa: 25,
        cpa7d: 120 / 4,
        spendShare: 50 / 80,
        budget: 900,
        pBest: 0.875,
      }),
      row(2, 2, {
        date: '2026-10-02',
        clicks: 1,
        applies: 1,
        spend: 30,
        cpa: 30,
        cpa7d: 90,
        spendShare: 30 / 80,
        budget: 100,
        pBest: 0.25,
      }),
      row(3, 1, {
        date: '2026-10-03',
        clicks: 0,
        applies: 0,
        spend: 0,
        cpa: null,
        cpa7d: 120 / 4,
        spendShare: null,
        budget: 100,
        pBest: 0.5,
      }),
      // The 7-day window on 2026-10-09 covers 10-03 .. 10-09, so days 1 and 2 drop out.
      row(9, 1, {
        date: '2026-10-09',
        clicks: 2,
        applies: 1,
        spend: 50,
        cpa: 50,
        cpa7d: 50,
        spendShare: 1,
        budget: 500,
        pBest: 0.875,
      }),
    ]);
  });

  it('summary matches the fixture, including overdelivery and the baseline delta', async () => {
    const { id, baselineId } = await fixture();
    const res = await request(testApp).get(`/api/campaigns/${id}/stats/summary`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      days: 9,
      spend: 260,
      budget: 9000,
      clicks: 17,
      applies: 6,
      cpa: 260 / 6,
      pacingRatio: 260 / 9000,
      overdelivery: 0,
      baseline: { applies: 4, cpa: 275 },
      deltaCpaPct: expect.closeTo((260 / 6 / 275 - 1) * 100, 10),
    });
    const baseline = await request(testApp).get(`/api/campaigns/${baselineId}/stats/summary`);
    expect(baseline.body).toEqual({
      days: 9,
      spend: 1100,
      budget: 9000,
      clicks: 110,
      applies: 4,
      cpa: 275,
      pacingRatio: 1100 / 9000,
      overdelivery: 100,
    });
  });

  it('a campaign with no traffic yet has empty stats and null ratios', async () => {
    const created = await request(testApp).post('/api/campaigns').send({
      name: 'Empty',
      dailyBudget: 5000,
      days: 3,
      policy: 'equal',
      scenario: 'drift',
      seed: 2,
      compareBaseline: false,
    });
    expect((await request(testApp).get(`/api/campaigns/${created.body.id}/stats/daily`)).body).toEqual([]);
    expect((await request(testApp).get(`/api/campaigns/${created.body.id}/stats/summary`)).body).toEqual({
      days: 0,
      spend: 0,
      budget: 0,
      clicks: 0,
      applies: 0,
      cpa: null,
      pacingRatio: null,
      overdelivery: 0,
    });
  });

  it('rejects bad ids and unknown campaigns', async () => {
    for (const path of ['stats/daily', 'stats/summary']) {
      const bad = await request(testApp).get(`/api/campaigns/nope/${path}`);
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('VALIDATION_ERROR');
      const missing = await request(testApp).get(
        `/api/campaigns/00000000-0000-0000-0000-000000000000/${path}`,
      );
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('NOT_FOUND');
    }
  });
});

describe('GET /api/experiments/latest', () => {
  it('returns the committed results file', async () => {
    const res = await request(testApp).get('/api/experiments/latest');
    expect(res.status).toBe(200);
    expect(res.body.command).toMatch(/^pnpm exp /);
    expect(res.body.rows.length).toBeGreaterThan(0);
  });

  it('returns 404 without a results file and 500 for a malformed one', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bidpilot-results-'));
    const missing = createApp({ env: testEnv, db: testDb, resultsPath: join(dir, 'missing.json') });
    const res = await request(missing).get('/api/experiments/latest');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    const path = join(dir, 'results.json');
    writeFileSync(path, JSON.stringify({ rows: 'nope' }));
    const malformed = await request(createApp({ env: testEnv, db: testDb, resultsPath: path })).get(
      '/api/experiments/latest',
    );
    expect(malformed.status).toBe(500);
    expect(malformed.body.error.code).toBe('INTERNAL');
  });
});
