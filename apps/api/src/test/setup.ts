// Shared helpers for API tests: a real Postgres test database (ARCHITECTURE §10).
import { sql } from 'drizzle-orm';
import { createClient, refreshDailyStats, type Database } from '@bidpilot/db';
import { createApp } from '../app.js';
import type { Env } from '../env.js';

export const testEnv: Env = {
  DATABASE_URL: process.env.DATABASE_URL_TEST ?? 'postgres://postgres:postgres@localhost:5433/bidpilot_test',
  PORT: 4100,
  CORS_ORIGINS: 'http://localhost:3100',
  LOG_LEVEL: 'silent',
};

export const testDb: Database = createClient(testEnv.DATABASE_URL);

export const testApp = createApp({ env: testEnv, db: testDb });

/** Removes every campaign (and by cascade its jobs, allocations and events) and refreshes the view. */
export async function resetDb(): Promise<void> {
  await testDb.execute(sql`TRUNCATE campaigns CASCADE`);
  await refreshDailyStats(testDb);
}
