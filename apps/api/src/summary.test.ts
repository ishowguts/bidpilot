import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { SummaryNumbers } from '@bidpilot/shared';
import { createApp } from './app.js';
import type { LlmClient } from './llm.js';
import { numbersIn, templateText, ungroundedNumbers } from './services/summary.js';
import { resetDb, testApp, testDb, testEnv } from './test/setup.js';

const numbers: SummaryNumbers = {
  day: 2,
  date: '2026-10-02',
  budget: 20000,
  spend: 19987,
  applies: 52,
  cpa: 384,
  publishers: [
    { publisher: 'pub-a', spend: 2011, applies: 3, cpa: 670, budgetSharePct: 10.1, shareChangePts: -3.2 },
    { publisher: 'pub-c', spend: 9020, applies: 30, cpa: 301, budgetSharePct: 45.5, shareChangePts: 6.4 },
  ],
};

describe('grounding check', () => {
  it('finds every number, with thousands separators and decimals', () => {
    expect(numbersIn('Spent ₹19,987 of ₹20,000; pub-c 45.5% (+6.4 pts), 52 applies.')).toEqual([
      19987, 20000, 45.5, 6.4, 52,
    ]);
  });

  it('accepts text that only repeats input numbers, including a change written without its sign', () => {
    const text =
      'Day 2 (2026-10-02): ₹19,987 of ₹20,000 bought 52 applies at ₹384. pub-c rose 6.4 points to 45.5%; pub-a fell 3.2.';
    expect(ungroundedNumbers(text, numbers)).toEqual([]);
  });

  it('rejects a number the input does not contain, such as a computed difference', () => {
    expect(ungroundedNumbers('Spend was ₹13 under budget and pub-c led at 45.5%.', numbers)).toEqual([13]);
    expect(ungroundedNumbers('CPA was ₹384.5.', numbers)).toEqual([384.5]);
  });

  it('the template is grounded by construction', () => {
    const text = templateText(numbers);
    expect(text).toBe(
      'Day 2: spent ₹19,987 of ₹20,000 for 52 applies (CPA ₹384). pub-c had the largest budget share at 45.5%.',
    );
    expect(ungroundedNumbers(text, numbers)).toEqual([]);
  });
});

/** A fake model that answers from the numbers in its prompt, through `write`. */
function fakeLlm(write: (n: SummaryNumbers) => string): LlmClient & { calls: number } {
  const fake = {
    model: 'fake-model',
    calls: 0,
    async generateJson(prompt: string) {
      fake.calls++;
      return write(JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1)) as SummaryNumbers);
    },
  };
  return fake;
}

describe('GET /api/campaigns/:id/summary/:day', () => {
  let id: string;
  beforeEach(async () => {
    await resetDb();
    const created = await request(testApp).post('/api/campaigns').send({
      name: 'Summary',
      dailyBudget: 20000,
      days: 10,
      policy: 'thompson',
      scenario: 'stationary',
      seed: 5,
      startDate: '2026-10-01',
      compareBaseline: false,
    });
    id = created.body.id;
    await request(testApp).post(`/api/campaigns/${id}/advance`).send({ days: 2 });
  });

  const get = (llm: LlmClient | null, day: number | string = 2) =>
    request(createApp({ env: testEnv, db: testDb, llm })).get(`/api/campaigns/${id}/summary/${day}`);

  it('serves a grounded model summary, stores it, and does not call the model again', async () => {
    const llm = fakeLlm((n) =>
      JSON.stringify({
        text: `Spent ₹${n.spend.toLocaleString('en-IN')} of ₹${n.budget.toLocaleString('en-IN')} for ${n.applies} applies.`,
      }),
    );
    const first = await get(llm);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ day: 2, date: '2026-10-02', source: 'model', model: 'fake-model' });
    expect(first.body.text).toBe(
      `Spent ₹${first.body.numbers.spend.toLocaleString('en-IN')} of ₹20,000 for ${first.body.numbers.applies} applies.`,
    );
    expect(first.body.numbers.publishers).toHaveLength(6);
    const shares = first.body.numbers.publishers.reduce(
      (s: number, p: { budgetSharePct: number }) => s + p.budgetSharePct,
      0,
    );
    expect(shares).toBeCloseTo(100, 0);

    const again = await get(llm);
    expect(again.body).toEqual(first.body);
    expect(llm.calls).toBe(1);
  });

  it('replaces a summary with an invented number by the template and does not store it', async () => {
    const llm = fakeLlm((n) => JSON.stringify({ text: `Spent ₹${n.spend + 1} today.` }));
    const res = await get(llm);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ source: 'template', model: null });
    expect(res.body.text).toBe(templateText(res.body.numbers));
    const [stored] = await testDb.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM daily_summaries`);
    expect(stored!.n).toBe(0);
  });

  it('falls back to the template on invalid JSON, a schema violation, a failing model, or no model', async () => {
    const tooLong = JSON.stringify({ text: Array.from({ length: 81 }, () => 'word').join(' ') });
    for (const llm of [
      fakeLlm(() => 'not json'),
      fakeLlm(() => tooLong),
      fakeLlm(() => {
        throw new Error('timeout');
      }),
      null,
    ]) {
      const res = await get(llm);
      expect(res.status).toBe(200);
      expect(res.body.source).toBe('template');
    }
  });

  it('accepts a fenced JSON answer', async () => {
    const res = await get(
      fakeLlm(
        (n) => '```json\n' + JSON.stringify({ text: `${n.applies} applies on day ${n.day}.` }) + '\n```',
      ),
    );
    expect(res.body.source).toBe('model');
  });

  it('rejects days not simulated yet, invalid days and unknown campaigns', async () => {
    expect((await get(null, 3)).status).toBe(404);
    expect((await get(null, 0)).status).toBe(400);
    expect((await get(null, 'x')).status).toBe(400);
    const missing = await request(testApp).get(
      '/api/campaigns/00000000-0000-0000-0000-000000000000/summary/1',
    );
    expect(missing.status).toBe(404);
  });
});
