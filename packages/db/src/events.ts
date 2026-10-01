import { sql } from 'drizzle-orm';
import { type Database } from './client.js';
import { events } from './schema.js';
import type { EventPayload } from '@bidpilot/shared';

export async function insertEvents(db: Database, payload: EventPayload[]) {
  if (payload.length === 0) return { accepted: 0, duplicates: 0 };

  const values = payload.map((e) => ({
    idempotencyKey: e.idempotencyKey,
    campaignId: e.campaignId,
    jobId: e.jobId,
    publisherId: e.publisherId,
    type: e.type,
    cost: e.cost.toString(),
    ts: new Date(e.ts),
  }));

  const result = await db
    .insert(events)
    .values(values)
    .onConflictDoNothing({ target: events.idempotencyKey });

  return {
    accepted: result.count,
    duplicates: payload.length - result.count,
  };
}

export async function refreshDailyStats(db: Database) {
  // REFRESH MATERIALIZED VIEW CONCURRENTLY requires a unique index
  // which was added in the migration.
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY daily_stats`);
}
