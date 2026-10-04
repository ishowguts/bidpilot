// Parity (ARCHITECTURE §10): the live path, which reads its history back from Postgres every day, must decide
// exactly what the in-memory experiment path decides for the same seed.
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { CATEGORIES, createPolicy, runCampaign, type PolicyName } from '@bidpilot/core';
import { resetDb, testApp, testDb } from './test/setup.js';

const DAYS = 5;
const jobsPerCategory = { software: 4, sales: 2, healthcare: 3, logistics: 1 };

/** float4 columns: both sides rounded to single precision, since Postgres prints the shortest round-trip text. */
const real = (x: number | null | undefined): number | null =>
  x === undefined || x === null ? null : Math.fround(x);

describe('parity between the live path and runCampaign', () => {
  beforeEach(resetDb);

  for (const policy of ['thompson', 'greedy'] as const satisfies readonly PolicyName[]) {
    it(`${policy}: allocations and day totals agree for ${DAYS} days`, async () => {
      const created = await request(testApp).post('/api/campaigns').send({
        name: 'Parity',
        dailyBudget: 23_456.78,
        days: 30,
        policy,
        scenario: 'drift',
        seed: 99,
        startDate: '2026-10-01',
        compareBaseline: false,
        jobsPerCategory,
      });
      const id: string = created.body.id;
      const advanced = [];
      for (let d = 1; d <= DAYS; d++) {
        const res = await request(testApp).post(`/api/campaigns/${id}/advance`).send({ days: 1 });
        expect(res.status).toBe(200);
        advanced.push(...res.body.days);
      }

      const expected = runCampaign(
        { seed: 99, scenario: 'drift', days: DAYS, dailyBudget: 23_456.78, jobsPerCategory },
        createPolicy(policy, 'drift'),
      );
      const stored = await testDb.execute<{
        day: string;
        category: string;
        publisher_id: number;
        budget: string;
        p_best: number | null;
        alpha: number | null;
        beta: number | null;
      }>(sql`
        SELECT day::text AS day, category, publisher_id, budget::text AS budget, p_best, alpha, beta
        FROM allocations WHERE campaign_id = ${id}`);
      const order = (c: string): number => CATEGORIES.indexOf(c as (typeof CATEGORIES)[number]);
      const live = stored
        .map(({ day, p_best, alpha, beta, ...r }) => ({
          dayNumber: Number(day.slice(8)),
          ...r,
          p_best: real(p_best),
          alpha: real(alpha),
          beta: real(beta),
        }))
        .sort(
          (a, b) =>
            a.dayNumber - b.dayNumber ||
            order(a.category) - order(b.category) ||
            a.publisher_id - b.publisher_id,
        );

      const inMemory = expected.flatMap((day) =>
        [...day.allocations]
          .sort((a, b) => order(a.category) - order(b.category) || a.publisherId - b.publisherId)
          .map((a) => ({
            dayNumber: day.day,
            category: a.category,
            publisher_id: a.publisherId,
            budget: a.budget.toFixed(2),
            p_best: real(a.pBest),
            alpha: real(a.alpha),
            beta: real(a.beta),
          })),
      );
      expect(live).toEqual(inMemory);
      if (policy === 'thompson') expect(live.every((r) => r.p_best !== null)).toBe(true);

      expect(advanced).toEqual(
        expected.map((day) => ({
          day: day.day,
          date: `2026-10-0${day.day}`,
          budget: expect.closeTo(day.budget, 6),
          spend: expect.closeTo(day.spend, 6),
          clicks: day.clicks,
          applies: day.applies,
          cpa: day.applies > 0 ? Math.round((day.spend / day.applies) * 100) / 100 : null,
        })),
      );
    }, 60_000);
  }
});
