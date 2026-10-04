import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { DEMO, seedDemo } from './seedDemo.js';
import { resetDb, testApp, testDb } from './test/setup.js';

describe('demo seed', () => {
  beforeEach(resetDb);

  it('creates the demo pair, advances it to the last day, and is a no-op the second time', async () => {
    const first = await seedDemo(testDb);
    expect(first.advanced).toBe(DEMO.days);
    const again = await seedDemo(testDb);
    expect(again).toEqual({ id: first.id, advanced: 0 });

    const list = (await request(testApp).get('/api/campaigns')).body as Array<{
      currentDay: number;
      finished: boolean;
    }>;
    expect(list).toHaveLength(2);
    for (const c of list) expect(c).toMatchObject({ currentDay: DEMO.days, finished: true });
    const summary = await request(testApp).get(`/api/campaigns/${first.id}/stats/summary`);
    expect(summary.body.overdelivery).toBe(0);
    expect(summary.body.deltaCpaPct).toBeLessThan(0);
  }, 120_000);
});
