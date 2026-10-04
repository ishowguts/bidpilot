// Campaign rollups read from `daily_stats` and `allocations` with window functions (ARCHITECTURE §7, §8).
import { eq, sql } from 'drizzle-orm';
import { campaigns, type DbExecutor } from '@bidpilot/db';
import type { DailyStat, StatsSummary } from '@bidpilot/shared';
import { HttpError } from '../middleware/errors.js';

async function campaignRow(db: DbExecutor, id: string) {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  if (!row) throw new HttpError('NOT_FOUND', `campaign ${id} not found`);
  return row;
}

/**
 * Per day and publisher, summed over categories. Allocations and rollups are joined on (day, publisher) with a full
 * join, so a day with a budget but no traffic and events ingested without an allocation both appear. The 7-day CPA
 * uses a calendar RANGE window, which stays correct if a publisher is missing on some day.
 */
export async function dailyStats(db: DbExecutor, id: string): Promise<DailyStat[]> {
  const row = await campaignRow(db, id);
  const rows = await db.execute<{
    date: string;
    publisher_id: number;
    clicks: number;
    applies: number;
    spend: number;
    cpa_7d: number | null;
    spend_share: number | null;
    budget: number;
    p_best: number | null;
  }>(sql`
    WITH s AS (
      SELECT day, publisher_id, sum(clicks)::int AS clicks, sum(applies)::int AS applies, sum(spend) AS spend
      FROM daily_stats WHERE campaign_id = ${id} GROUP BY day, publisher_id
    ), a AS (
      SELECT day, publisher_id, sum(budget) AS budget, avg(p_best) FILTER (WHERE budget > 0) AS p_best
      FROM allocations WHERE campaign_id = ${id} GROUP BY day, publisher_id
    ), d AS (
      SELECT coalesce(s.day, a.day) AS day, coalesce(s.publisher_id, a.publisher_id) AS publisher_id,
             coalesce(s.clicks, 0) AS clicks, coalesce(s.applies, 0) AS applies, coalesce(s.spend, 0) AS spend,
             coalesce(a.budget, 0) AS budget, a.p_best
      FROM s FULL JOIN a ON a.day = s.day AND a.publisher_id = s.publisher_id
    )
    SELECT day::text AS date, publisher_id, clicks, applies, spend::float8 AS spend,
           (sum(spend) OVER w7 / nullif(sum(applies) OVER w7, 0))::float8 AS cpa_7d,
           (spend / nullif(sum(spend) OVER (PARTITION BY day), 0))::float8 AS spend_share,
           budget::float8 AS budget, p_best::float8 AS p_best
    FROM d
    WINDOW w7 AS (PARTITION BY publisher_id ORDER BY day RANGE BETWEEN interval '6 days' PRECEDING AND CURRENT ROW)
    ORDER BY day, publisher_id
  `);
  const start = Date.parse(`${row.startDate}T00:00:00Z`);
  return rows.map((r) => ({
    day: Math.round((Date.parse(`${r.date}T00:00:00Z`) - start) / 86_400_000) + 1,
    date: r.date,
    publisherId: r.publisher_id,
    clicks: r.clicks,
    applies: r.applies,
    spend: r.spend,
    cpa: r.applies > 0 ? r.spend / r.applies : null,
    cpa7d: r.cpa_7d,
    spendShare: r.spend_share,
    budget: r.budget,
    pBest: r.p_best,
  }));
}

type Totals = {
  spend: number;
  clicks: number;
  applies: number;
  overdelivery: number;
};

async function totals(db: DbExecutor, id: string, dailyBudget: string): Promise<Totals> {
  const [t] = await db.execute<Totals>(sql`
    SELECT coalesce(sum(spend), 0)::float8 AS spend, coalesce(sum(clicks), 0)::int AS clicks,
           coalesce(sum(applies), 0)::int AS applies,
           coalesce(sum(greatest(spend - ${dailyBudget}::numeric, 0)), 0)::float8 AS overdelivery
    FROM (SELECT day, sum(spend) AS spend, sum(clicks) AS clicks, sum(applies) AS applies
          FROM daily_stats WHERE campaign_id = ${id} GROUP BY day) d
  `);
  return t!;
}

const cpaOf = (t: Totals): number | null => (t.applies > 0 ? t.spend / t.applies : null);

export async function statsSummary(db: DbExecutor, id: string): Promise<StatsSummary> {
  const row = await campaignRow(db, id);
  const t = await totals(db, id, row.dailyBudget);
  const budget = Number(row.dailyBudget) * row.currentDay;
  const cpa = cpaOf(t);
  const summary: StatsSummary = {
    days: row.currentDay,
    spend: t.spend,
    budget,
    clicks: t.clicks,
    applies: t.applies,
    cpa,
    pacingRatio: budget > 0 ? t.spend / budget : null,
    overdelivery: t.overdelivery,
  };
  const [baseline] = await db.select().from(campaigns).where(eq(campaigns.baselineOf, id));
  if (baseline) {
    const b = await totals(db, baseline.id, baseline.dailyBudget);
    const baselineCpa = cpaOf(b);
    summary.baseline = { applies: b.applies, cpa: baselineCpa };
    summary.deltaCpaPct = cpa !== null && baselineCpa !== null ? (cpa / baselineCpa - 1) * 100 : null;
  }
  return summary;
}
