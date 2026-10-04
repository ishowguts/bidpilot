import { describe, it, expect } from 'vitest';
import { ApiError, createApi } from './api';

const campaign = {
  id: '6f1c2b8e-4f5a-4c1e-9d2b-1a2b3c4d5e6f',
  name: 'Spring hiring',
  dailyBudget: 20000,
  days: 30,
  startDate: '2026-10-01',
  targetCpa: null,
  policy: 'thompson',
  scenario: 'stationary',
  seed: 7,
  baselineOf: null,
  baselineId: null,
  jobsPerCategory: { software: 5, sales: 5, healthcare: 5, logistics: 5 },
  currentDay: 0,
  progress: 0,
  finished: false,
  createdAt: '2026-10-05T00:00:00.000Z',
};

function fakeFetch(status: number, body: unknown, calls: Request[] = []): typeof fetch {
  return async (input, init) => {
    calls.push(new Request(input, init));
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
}

describe('web API client', () => {
  it('posts JSON to the API and parses the response', async () => {
    const calls: Request[] = [];
    const api = createApi('http://api.test', fakeFetch(201, campaign, calls));
    const input = {
      name: 'Spring hiring',
      dailyBudget: 20000,
      days: 30,
      policy: 'thompson',
      scenario: 'stationary',
    } as const;
    expect(await api.createCampaign(input)).toEqual(campaign);
    expect(calls[0]!.url).toBe('http://api.test/api/campaigns');
    expect(calls[0]!.method).toBe('POST');
    expect(await calls[0]!.json()).toEqual(input);
  });

  it('turns the error body into an ApiError', async () => {
    const api = createApi(
      'http://api.test',
      fakeFetch(409, { error: { code: 'CONFLICT', message: 'campaign is finished' }, requestId: 'r1' }),
    );
    await expect(api.advance(campaign.id, 1)).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'campaign is finished',
    });
  });

  it('rejects a response that does not match the contract', async () => {
    const api = createApi('http://api.test', fakeFetch(200, [{ ...campaign, dailyBudget: 'lots' }]));
    await expect(api.listCampaigns()).rejects.toThrow();
  });

  it('reports an unreachable API as a network error', async () => {
    const api = createApi('http://api.test', async () => {
      throw new TypeError('fetch failed');
    });
    const err = await api.listCampaigns().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 0, code: 'NETWORK' });
  });
});
