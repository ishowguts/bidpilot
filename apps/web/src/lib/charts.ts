// Turns /stats/daily rows into the series the four dashboard charts draw (ARCHITECTURE §9). Pure, so it is tested
// without a browser.
import type { DailyStat } from '@bidpilot/shared';
import { PUBLISHER_NAMES } from './format';

export type Point = { day: number } & Record<string, number | null>;

function byDay(rows: readonly DailyStat[]): Map<number, DailyStat[]> {
  const days = new Map<number, DailyStat[]>();
  for (const r of rows) days.set(r.day, [...(days.get(r.day) ?? []), r]);
  return new Map([...days].sort(([a], [b]) => a - b));
}

const sum = (rows: readonly DailyStat[], key: 'spend' | 'budget' | 'applies'): number =>
  rows.reduce((s, r) => s + r[key], 0);

const nameOf = (id: number): string => PUBLISHER_NAMES[id] ?? `pub-${id}`;

/** Publisher names present in `rows`, in id order: the keys of the per-publisher series. */
export function publisherKeys(rows: readonly DailyStat[]): string[] {
  return [...new Set(rows.map((r) => r.publisherId))].sort((a, b) => a - b).map(nameOf);
}

/** Chart 1: spend per day next to the daily budget. */
export function spendSeries(rows: readonly DailyStat[], dailyBudget: number): Point[] {
  return [...byDay(rows)].map(([day, r]) => ({ day, spend: sum(r, 'spend'), budget: dailyBudget }));
}

/** Chart 2: 7-day rolling cost per apply, one key per publisher (null where it has no applies yet). */
export function cpaSeries(rows: readonly DailyStat[]): Point[] {
  return [...byDay(rows)].map(([day, r]) => ({
    day,
    ...Object.fromEntries(r.map((x) => [nameOf(x.publisherId), x.cpa7d])),
  }));
}

/** Chart 3: each publisher's share of the day's allocated budget. */
export function shareSeries(rows: readonly DailyStat[]): Point[] {
  return [...byDay(rows)].map(([day, r]) => {
    const total = sum(r, 'budget');
    return {
      day,
      ...Object.fromEntries(r.map((x) => [nameOf(x.publisherId), total > 0 ? x.budget / total : 0])),
    };
  });
}

/** Chart 4: cumulative applies of the campaign and of its equal-split baseline (null without a baseline). */
export function cumulativeApplies(
  campaign: readonly DailyStat[],
  baseline: readonly DailyStat[] | null,
): Point[] {
  const base = baseline ? byDay(baseline) : null;
  let mine = 0;
  let theirs = 0;
  return [...byDay(campaign)].map(([day, r]) => {
    mine += sum(r, 'applies');
    theirs += base ? sum(base.get(day) ?? [], 'applies') : 0;
    return { day, campaign: mine, baseline: base ? theirs : null };
  });
}
