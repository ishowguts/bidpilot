// Campaign lifecycle on the live path (ARCHITECTURE §2, §7, §8). The decisions come from packages/core; this file
// only reads and writes Postgres.
import { randomInt } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  CATEGORIES,
  allocateDay,
  createPolicy,
  simulateDay,
  type CampaignConfig,
  type Category,
  type Observation,
  type PolicyName,
  type PublisherId,
  type ScenarioName,
} from '@bidpilot/core';
import {
  allocations,
  campaigns,
  insertEvents,
  jobs,
  refreshDailyStats,
  type Database,
  type DbExecutor,
} from '@bidpilot/db';
import {
  CATEGORY_VALUES,
  DEFAULT_JOBS_PER_CATEGORY_COUNT,
  MAX_EVENTS_PER_BATCH,
  MAX_SEED,
  POLICY_VALUES,
  SCENARIO_VALUES,
  type AdvanceResult,
  type Campaign,
  type CreateCampaignInput,
} from '@bidpilot/shared';
import { HttpError } from '../middleware/errors.js';
import { dayEvents } from './dayEvents.js';

// The API's enums and the core's must be the same lists; these lines stop compiling if they drift apart.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const enumsMatch: [
  Same<(typeof CATEGORY_VALUES)[number], Category>,
  Same<(typeof POLICY_VALUES)[number], PolicyName>,
  Same<(typeof SCENARIO_VALUES)[number], ScenarioName>,
] = [true, true, true];
void enumsMatch;

type CampaignRow = typeof campaigns.$inferSelect;

/** Test hook: runs inside a day's transaction after its events are written, before the view refresh. */
export interface AdvanceHooks {
  afterIngest?: (campaignId: string, day: number) => Promise<void>;
}

const roundPaise = (x: number): number => Math.round(x * 100) / 100;

/** Calendar date (YYYY-MM-DD) of 1-based campaign day `day`. */
export function dateOfDay(startDate: string, day: number): string {
  const [y, m, d] = startDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + day - 1)).toISOString().slice(0, 10);
}

function todayIst(): string {
  return new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

async function jobCounts(
  db: DbExecutor,
  campaignIds: readonly string[],
): Promise<Map<string, Record<Category, number>>> {
  const counts = new Map<string, Record<Category, number>>();
  for (const id of campaignIds) counts.set(id, { software: 0, sales: 0, healthcare: 0, logistics: 0 });
  if (campaignIds.length === 0) return counts;
  const rows = await db
    .select({ campaignId: jobs.campaignId, category: jobs.category, n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(inArray(jobs.campaignId, [...campaignIds]))
    .groupBy(jobs.campaignId, jobs.category);
  for (const r of rows) counts.get(r.campaignId)![r.category as Category] = r.n;
  return counts;
}

async function toCampaigns(db: DbExecutor, rows: readonly CampaignRow[]): Promise<Campaign[]> {
  const ids = rows.map((r) => r.id);
  const counts = await jobCounts(db, ids);
  const baselines =
    ids.length === 0
      ? []
      : await db
          .select({ id: campaigns.id, baselineOf: campaigns.baselineOf })
          .from(campaigns)
          .where(inArray(campaigns.baselineOf, ids));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    dailyBudget: Number(r.dailyBudget),
    days: r.days,
    startDate: r.startDate,
    targetCpa: r.targetCpa === null ? null : Number(r.targetCpa),
    policy: r.policy as PolicyName,
    scenario: r.scenario as ScenarioName,
    seed: r.seed,
    baselineOf: r.baselineOf,
    baselineId: baselines.find((b) => b.baselineOf === r.id)?.id ?? null,
    jobsPerCategory: counts.get(r.id)!,
    currentDay: r.currentDay,
    progress: r.currentDay / r.days,
    finished: r.currentDay >= r.days,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createCampaign(db: Database, input: CreateCampaignInput): Promise<Campaign> {
  const jobsPerCategory = Object.fromEntries(
    CATEGORIES.map((c) => [
      c,
      input.jobsPerCategory ? (input.jobsPerCategory[c] ?? 0) : DEFAULT_JOBS_PER_CATEGORY_COUNT,
    ]),
  ) as Record<Category, number>;
  const seed = input.seed ?? randomInt(1, MAX_SEED);
  const base = {
    dailyBudget: roundPaise(input.dailyBudget).toFixed(2),
    days: input.days,
    startDate: input.startDate ?? todayIst(),
    targetCpa: input.targetCpa === undefined ? null : input.targetCpa.toFixed(2),
    scenario: input.scenario,
    seed,
  };
  const id = await db.transaction(async (tx) => {
    const insertJobs = async (campaignId: string): Promise<void> => {
      const rows = CATEGORIES.flatMap((category) =>
        Array.from({ length: jobsPerCategory[category] }, (_, i) => ({
          campaignId,
          category,
          title: `${category[0]!.toUpperCase()}${category.slice(1)} role ${i + 1}`,
        })),
      );
      await tx.insert(jobs).values(rows);
    };
    const [main] = await tx
      .insert(campaigns)
      .values({ ...base, name: input.name, policy: input.policy })
      .returning({ id: campaigns.id });
    await insertJobs(main!.id);
    if (input.compareBaseline ?? true) {
      const [baseline] = await tx
        .insert(campaigns)
        .values({ ...base, name: `${input.name} (equal split)`, policy: 'equal', baselineOf: main!.id })
        .returning({ id: campaigns.id });
      await insertJobs(baseline!.id);
    }
    return main!.id;
  });
  return getCampaign(db, id);
}

export async function listCampaigns(db: Database): Promise<Campaign[]> {
  const rows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt), asc(campaigns.id));
  return toCampaigns(db, rows);
}

export async function getCampaign(db: DbExecutor, id: string): Promise<Campaign> {
  const rows = await db.select().from(campaigns).where(eq(campaigns.id, id));
  if (rows.length === 0) throw new HttpError('NOT_FOUND', `campaign ${id} not found`);
  return (await toCampaigns(db, rows))[0]!;
}

function configOf(row: CampaignRow, jobsPerCategory: Record<Category, number>): CampaignConfig {
  return {
    seed: row.seed,
    scenario: row.scenario as ScenarioName,
    days: row.days,
    dailyBudget: Number(row.dailyBudget),
    jobsPerCategory,
  };
}

/**
 * Observations for days before `day`, read back from SQL: each allocation row joined with that day's rollup.
 * Only categories with jobs are included and rows are sorted in core order, so the policy sees exactly what the
 * in-memory path gives it (parity, §10).
 */
async function loadHistory(
  tx: DbExecutor,
  row: CampaignRow,
  config: CampaignConfig,
  day: number,
): Promise<Observation[]> {
  const before = dateOfDay(row.startDate, day);
  const rows = await tx.execute<{
    day: string;
    category: Category;
    publisher_id: number;
    budget: string;
    clicks: number;
    applies: number;
    spend: string;
  }>(sql`
    SELECT a.day::text AS day, a.category, a.publisher_id, a.budget::text AS budget,
           coalesce(s.clicks, 0)::int AS clicks, coalesce(s.applies, 0)::int AS applies,
           coalesce(s.spend, 0)::text AS spend
    FROM allocations a
    LEFT JOIN daily_stats s
      ON s.campaign_id = a.campaign_id AND s.day = a.day AND s.category = a.category AND s.publisher_id = a.publisher_id
    WHERE a.campaign_id = ${row.id} AND a.day < ${before}`);
  const dayIndex = (date: string): number =>
    Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${row.startDate}T00:00:00Z`)) / 86_400_000) + 1;
  return rows
    .filter((r) => config.jobsPerCategory[r.category] > 0)
    .map((r) => ({
      day: dayIndex(r.day),
      category: r.category,
      publisherId: r.publisher_id as PublisherId,
      clicks: r.clicks,
      applies: r.applies,
      spend: Number(r.spend),
      budget: Number(r.budget),
    }))
    .sort(
      (a, b) =>
        a.day - b.day ||
        CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) ||
        a.publisherId - b.publisherId,
    );
}

/** Runs one day for one campaign inside `tx`: allocate → simulate → write allocations and events → bump the day. */
async function advanceOneDay(
  tx: DbExecutor,
  row: CampaignRow,
  day: number,
  hooks: AdvanceHooks,
): Promise<AdvanceResult['days'][number]> {
  const counts = (await jobCounts(tx, [row.id])).get(row.id)!;
  const config = configOf(row, counts);
  const history = await loadHistory(tx, row, config, day);
  const decided = allocateDay(config, createPolicy(row.policy as PolicyName, config.scenario), day, history);
  const result = simulateDay(config, day, decided);
  const date = dateOfDay(row.startDate, day);

  await tx.insert(allocations).values(
    decided.map((a) => ({
      campaignId: row.id,
      day: date,
      category: a.category,
      publisherId: a.publisherId,
      budget: a.budget.toFixed(2),
      pBest: a.pBest ?? null,
      alpha: a.alpha ?? null,
      beta: a.beta ?? null,
      cpcEstimate: a.cpcEstimate === undefined ? null : a.cpcEstimate.toFixed(4),
    })),
  );

  const jobRows = await tx
    .select({ id: jobs.id, category: jobs.category })
    .from(jobs)
    .where(eq(jobs.campaignId, row.id))
    .orderBy(asc(jobs.id));
  const jobIds = new Map<Category, number[]>();
  for (const j of jobRows)
    jobIds.set(j.category as Category, [...(jobIds.get(j.category as Category) ?? []), j.id]);
  const events = dayEvents(row.id, day, date, result, jobIds);
  for (let i = 0; i < events.length; i += MAX_EVENTS_PER_BATCH) {
    await insertEvents(tx, events.slice(i, i + MAX_EVENTS_PER_BATCH));
  }
  await hooks.afterIngest?.(row.id, day);

  const bumped = await tx
    .update(campaigns)
    .set({ currentDay: day })
    .where(and(eq(campaigns.id, row.id), eq(campaigns.currentDay, day - 1)))
    .returning({ id: campaigns.id });
  if (bumped.length !== 1)
    throw new HttpError('CONFLICT', `campaign ${row.id} moved past day ${day - 1} concurrently`);

  const spend = roundPaise(result.spend);
  return {
    day,
    date,
    budget: config.dailyBudget,
    spend,
    clicks: result.clicks,
    applies: result.applies,
    cpa: result.applies > 0 ? roundPaise(spend / result.applies) : null,
  };
}

/**
 * Advances a campaign (and its paired baseline) by up to `days` days, one transaction per day. Stops at the last
 * day; 409 if the campaign is already finished or is itself a baseline.
 */
export async function advanceCampaign(
  db: Database,
  id: string,
  days: number,
  hooks: AdvanceHooks = {},
): Promise<AdvanceResult> {
  const first = await getCampaign(db, id);
  if (first.baselineOf !== null) {
    throw new HttpError('CONFLICT', 'a baseline campaign advances with the campaign it belongs to', {
      campaignId: first.baselineOf,
    });
  }
  if (first.finished) throw new HttpError('CONFLICT', `campaign ${id} has finished all ${first.days} days`);

  const results: AdvanceResult['days'] = [];
  let currentDay = first.currentDay;
  for (let step = 0; step < days && currentDay < first.days; step++) {
    const day = currentDay + 1;
    const dayResult = await db.transaction(async (tx) => {
      // Lock the campaign and its baseline so concurrent advances serialise.
      const locked = await tx
        .select()
        .from(campaigns)
        .where(sql`${campaigns.id} = ${id} OR ${campaigns.baselineOf} = ${id}`)
        .orderBy(asc(campaigns.id))
        .for('update');
      const main = locked.find((r) => r.id === id)!;
      if (main.currentDay !== day - 1)
        throw new HttpError('CONFLICT', `campaign ${id} was advanced concurrently`);
      const mainResult = await advanceOneDay(tx, main, day, hooks);
      const baseline = locked.find((r) => r.baselineOf === id);
      if (baseline && baseline.currentDay === day - 1) await advanceOneDay(tx, baseline, day, hooks);
      await refreshDailyStats(tx);
      return mainResult;
    });
    results.push(dayResult);
    currentDay = day;
  }
  return { currentDay, days: results };
}
