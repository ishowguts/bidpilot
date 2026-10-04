import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function run() {
  const url = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/bidpilot';
  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);

  // Step 1: Run Drizzle-managed migrations (tables, indexes, constraints).
  console.log('migrate: running drizzle migrations...');
  await migrate(db, { migrationsFolder: join(__dirname, '..', 'migrations') });

  // Step 2: Run the raw SQL migration for the daily_stats materialized view.
  // Uses IF NOT EXISTS so running twice is a no-op.
  console.log('migrate: creating daily_stats materialized view...');
  const mvSql = readFileSync(join(__dirname, '..', 'migrations', '0001_daily_stats_mv.sql'), 'utf8');
  await sql.unsafe(mvSql);

  console.log('migrate: done');
  await sql.end();
}

run().catch((err) => {
  console.error('migrate failed:', err);
  process.exit(1);
});
