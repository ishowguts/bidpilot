import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { advanceCampaign } from './services/campaigns.js';
import { resetDb, testApp, testDb } from './test/setup.js';

const body = {
  name: 'Spring hiring',
  dailyBudget: 20_000,
  days: 5,
  policy: 'thompson',
  scenario: 'stationary',
  seed: 7,
  startDate: '2026-10-01',
};

async function count(query: ReturnType<typeof sql>): Promise<number> {
  const rows = await testDb.execute<{ n: number }>(query);
  return rows[0]!.n;
}

describe('campaigns API', () => {
  beforeEach(resetDb);

  it('creates a campaign with jobs and a paired equal-split baseline', async () => {
    const res = await request(testApp).post('/api/campaigns').send(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Spring hiring',
      dailyBudget: 20_000,
      days: 5,
      policy: 'thompson',
      scenario: 'stationary',
      seed: 7,
      startDate: '2026-10-01',
      baselineOf: null,
      currentDay: 0,
      progress: 0,
      finished: false,
      jobsPerCategory: { software: 5, sales: 5, healthcare: 5, logistics: 5 },
    });
    const baseline = await request(testApp).get(`/api/campaigns/${res.body.baselineId}`);
    expect(baseline.body).toMatchObject({
      policy: 'equal',
      seed: 7,
      baselineOf: res.body.id,
      baselineId: null,
    });
    const list = await request(testApp).get('/api/campaigns');
    expect(list.body.map((c: { id: string }) => c.id).sort()).toEqual(
      [res.body.id, res.body.baselineId].sort(),
    );
  });

  it('can skip the baseline and draws a seed when none is given', async () => {
    const withoutSeed: Partial<typeof body> = { ...body };
    delete withoutSeed.seed;
    const res = await request(testApp)
      .post('/api/campaigns')
      .send({ ...withoutSeed, compareBaseline: false, jobsPerCategory: { software: 2 } });
    expect(res.status).toBe(201);
    expect(res.body.baselineId).toBeNull();
    expect(res.body.seed).toEqual(expect.any(Number));
    expect(res.body.jobsPerCategory).toEqual({ software: 2, sales: 0, healthcare: 0, logistics: 0 });
  });

  it('rejects invalid bodies and ids', async () => {
    for (const bad of [
      { ...body, dailyBudget: 10 },
      { ...body, days: 91 },
      { ...body, policy: 'random' },
      { ...body, extra: true },
      { ...body, jobsPerCategory: { software: 0 } },
    ]) {
      const res = await request(testApp).post('/api/campaigns').send(bad);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect((await request(testApp).get('/api/campaigns/not-a-uuid')).status).toBe(400);
    const missing = await request(testApp).get('/api/campaigns/00000000-0000-0000-0000-000000000000');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('advances 3 days: allocations, events and rollups agree, and the baseline advances too', async () => {
    const created = await request(testApp).post('/api/campaigns').send(body);
    const id: string = created.body.id;
    const res = await request(testApp).post(`/api/campaigns/${id}/advance`).send({ days: 3 });
    expect(res.status).toBe(200);
    expect(res.body.currentDay).toBe(3);
    expect(res.body.days.map((d: { date: string }) => d.date)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
    for (const d of res.body.days) {
      expect(d.spend).toBeLessThanOrEqual(d.budget);
      expect(d.spend / d.budget).toBeGreaterThan(0.97);
      expect(d.cpa).toBeCloseTo(d.spend / d.applies, 1);
    }

    const totalClicks = res.body.days.reduce((s: number, d: { clicks: number }) => s + d.clicks, 0);
    const totalApplies = res.body.days.reduce((s: number, d: { applies: number }) => s + d.applies, 0);
    expect(
      await count(sql`SELECT count(*)::int AS n FROM events WHERE campaign_id = ${id} AND type = 'click'`),
    ).toBe(totalClicks);
    expect(
      await count(sql`SELECT coalesce(sum(applies), 0)::int AS n FROM daily_stats WHERE campaign_id = ${id}`),
    ).toBe(totalApplies);
    expect(await count(sql`SELECT count(*)::int AS n FROM allocations WHERE campaign_id = ${id}`)).toBe(
      3 * 24,
    );
    // Thompson persists its diagnostics with each allocation (§6.2 step 5).
    expect(
      await count(
        sql`SELECT count(*)::int AS n FROM allocations WHERE campaign_id = ${id} AND p_best IS NULL`,
      ),
    ).toBe(0);

    const baseline = await request(testApp).get(`/api/campaigns/${created.body.baselineId}`);
    expect(baseline.body.currentDay).toBe(3);
    const campaign = await request(testApp).get(`/api/campaigns/${id}`);
    expect(campaign.body.progress).toBeCloseTo(0.6, 12);
  });

  it('stops at the last day and returns 409 once finished', async () => {
    const created = await request(testApp)
      .post('/api/campaigns')
      .send({ ...body, days: 2 });
    const id: string = created.body.id;
    const res = await request(testApp).post(`/api/campaigns/${id}/advance`).send({ days: 5 });
    expect(res.body.currentDay).toBe(2);
    expect(res.body.days).toHaveLength(2);
    const again = await request(testApp).post(`/api/campaigns/${id}/advance`).send({ days: 1 });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('CONFLICT');
    expect((await request(testApp).get(`/api/campaigns/${id}`)).body.finished).toBe(true);
  });

  it('rejects advancing a baseline directly and invalid advance bodies', async () => {
    const created = await request(testApp).post('/api/campaigns').send(body);
    const baseline = await request(testApp)
      .post(`/api/campaigns/${created.body.baselineId}/advance`)
      .send({ days: 1 });
    expect(baseline.status).toBe(409);
    for (const bad of [{ days: 0 }, { days: 31 }, { days: 1.5 }, {}]) {
      const res = await request(testApp).post(`/api/campaigns/${created.body.id}/advance`).send(bad);
      expect(res.status).toBe(400);
    }
  });

  it('re-running a crashed day does not double count', async () => {
    const created = await request(testApp)
      .post('/api/campaigns')
      .send({ ...body, compareBaseline: false });
    const id: string = created.body.id;

    // Crash after the day's events were written but before the day was committed.
    const crash = async (): Promise<void> => {
      throw new Error('simulated crash');
    };
    await expect(advanceCampaign(testDb, id, 1, { afterIngest: crash })).rejects.toThrow('simulated crash');
    expect((await request(testApp).get(`/api/campaigns/${id}`)).body.currentDay).toBe(0);
    expect(await count(sql`SELECT count(*)::int AS n FROM events WHERE campaign_id = ${id}`)).toBe(0);

    const res = await request(testApp).post(`/api/campaigns/${id}/advance`).send({ days: 1 });
    const day = res.body.days[0];
    expect(await count(sql`SELECT count(*)::int AS n FROM events WHERE campaign_id = ${id}`)).toBe(
      day.clicks + day.applies,
    );

    // Replaying the day's events through the ingestion API (as a retrying client would) adds nothing.
    const stored = await testDb.execute<{
      idempotency_key: string;
      job_id: string;
      publisher_id: number;
      type: string;
      cost: string;
      ts: Date;
    }>(
      sql`SELECT idempotency_key, job_id, publisher_id, type, cost, ts FROM events WHERE campaign_id = ${id} LIMIT 1000`,
    );
    const replay = await request(testApp)
      .post('/api/events')
      .send({
        events: stored.map((e) => ({
          idempotencyKey: e.idempotency_key,
          campaignId: id,
          jobId: Number(e.job_id),
          publisherId: e.publisher_id,
          type: e.type,
          cost: Number(e.cost),
          ts: new Date(e.ts).toISOString(),
        })),
      });
    expect(replay.body).toEqual({ accepted: 0, duplicates: stored.length });
    expect(await count(sql`SELECT count(*)::int AS n FROM events WHERE campaign_id = ${id}`)).toBe(
      day.clicks + day.applies,
    );
  });

  it('categories without jobs get no budget and no events', async () => {
    const created = await request(testApp)
      .post('/api/campaigns')
      .send({ ...body, compareBaseline: false, jobsPerCategory: { software: 3, sales: 1 } });
    const id: string = created.body.id;
    const res = await request(testApp).post(`/api/campaigns/${id}/advance`).send({ days: 2 });
    expect(res.status).toBe(200);
    expect(
      await count(sql`
        SELECT count(*)::int AS n FROM events e JOIN jobs j ON j.id = e.job_id
        WHERE e.campaign_id = ${id} AND j.category IN ('healthcare', 'logistics')`),
    ).toBe(0);
    expect(
      await count(sql`
        SELECT count(*)::int AS n FROM allocations
        WHERE campaign_id = ${id} AND category = 'healthcare' AND budget > 0`),
    ).toBe(0);
  });
});
