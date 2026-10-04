// Turns one simulated day into individual click and apply events (ARCHITECTURE §7: one row per click).
import { createHash } from 'node:crypto';
import type { Category, DayResult, PublisherId } from '@bidpilot/core';
import type { EventPayload } from '@bidpilot/shared';

/** India Standard Time is UTC+05:30 with no daylight saving; `daily_stats` groups days in Asia/Kolkata. */
const IST_OFFSET_MS = 330 * 60 * 1000;

/** `sha256(campaignId | day | hour | category | publisher | type | seq)` (§7). Deterministic, so a retry dedupes. */
export function idempotencyKey(
  campaignId: string,
  day: number,
  hour: number,
  category: Category,
  publisherId: PublisherId,
  type: 'click' | 'apply',
  seq: number,
): string {
  return createHash('sha256')
    .update([campaignId, day, hour, category, publisherId, type, seq].join('|'))
    .digest('hex');
}

/** UTC instant of `hour:00` IST on a calendar date `YYYY-MM-DD`. */
export function istHourStart(date: string, hour: number): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d, hour) - IST_OFFSET_MS;
}

/**
 * Expands a day's hourly results into events. Clicks cost the day's CPC, applies cost 0. Events of an arm-hour are
 * spread evenly over the hour and assigned round-robin to the category's jobs (sorted by id).
 */
export function dayEvents(
  campaignId: string,
  day: number,
  date: string,
  result: Pick<DayResult, 'categories'>,
  jobIdsByCategory: ReadonlyMap<Category, readonly number[]>,
): EventPayload[] {
  const events: EventPayload[] = [];
  for (const category of result.categories) {
    const jobIds = jobIdsByCategory.get(category.category) ?? [];
    const cpcByPublisher = new Map(category.arms.map((a) => [a.publisherId, a.cpc]));
    for (const row of category.hours) {
      if (jobIds.length === 0)
        throw new Error(`no jobs in category ${category.category} for campaign ${campaignId}`);
      const start = istHourStart(date, row.hour);
      const emit = (type: 'click' | 'apply', count: number, cost: number): void => {
        for (let seq = 0; seq < count; seq++) {
          events.push({
            idempotencyKey: idempotencyKey(
              campaignId,
              day,
              row.hour,
              category.category,
              row.publisherId,
              type,
              seq,
            ),
            campaignId,
            jobId: jobIds[seq % jobIds.length]!,
            publisherId: row.publisherId,
            type,
            cost,
            ts: new Date(start + Math.floor((seq * 3_600_000) / count)).toISOString(),
          });
        }
      };
      emit('click', row.clicks, cpcByPublisher.get(row.publisherId)!);
      emit('apply', row.applies, 0);
    }
  }
  return events;
}
