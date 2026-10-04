// Typed client for the BidPilot API. Every response is parsed with the shared zod schema, so a contract drift
// fails loudly here instead of rendering wrong numbers.
import {
  advanceResultSchema,
  apiErrorSchema,
  campaignSchema,
  dailyStatSchema,
  experimentResultsSchema,
  statsSummarySchema,
  type CreateCampaignInput,
} from '@bidpilot/shared';
import { z } from 'zod';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

export function createApi(baseUrl: string = API_URL, fetchImpl: Fetch = (...args) => fetch(...args)) {
  async function call<S extends z.ZodTypeAny>(
    schema: S,
    path: string,
    init?: { method: 'POST'; body: unknown },
  ): Promise<z.infer<S>> {
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}/api${path}`, {
        method: init?.method ?? 'GET',
        headers: init ? { 'content-type': 'application/json' } : undefined,
        body: init ? JSON.stringify(init.body) : undefined,
        cache: 'no-store',
      });
    } catch {
      throw new ApiError(0, 'NETWORK', `cannot reach the API at ${baseUrl}`);
    }
    const body: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      const parsed = apiErrorSchema.safeParse(body);
      throw parsed.success
        ? new ApiError(res.status, parsed.data.error.code, parsed.data.error.message)
        : new ApiError(res.status, 'INTERNAL', `request failed with status ${res.status}`);
    }
    return schema.parse(body);
  }

  return {
    listCampaigns: () => call(z.array(campaignSchema), '/campaigns'),
    getCampaign: (id: string) => call(campaignSchema, `/campaigns/${id}`),
    createCampaign: (input: CreateCampaignInput) =>
      call(campaignSchema, '/campaigns', { method: 'POST', body: input }),
    advance: (id: string, days: number) =>
      call(advanceResultSchema, `/campaigns/${id}/advance`, { method: 'POST', body: { days } }),
    dailyStats: (id: string) => call(z.array(dailyStatSchema), `/campaigns/${id}/stats/daily`),
    summary: (id: string) => call(statsSummarySchema, `/campaigns/${id}/stats/summary`),
    experiments: () => call(experimentResultsSchema, '/experiments/latest'),
  };
}

export const api = createApi();
