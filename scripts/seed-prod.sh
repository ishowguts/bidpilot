#!/bin/sh
# Migrates and seeds the production database from a workstation (ARCHITECTURE §13): migrations, the publishers and
# the demo campaign, all idempotent, then prints row counts. The URL is read from DATABASE_URL_PROD in .env and is
# never printed or written anywhere else.
#
# Usage: sh scripts/seed-prod.sh   (ENV_FILE=other.env to read another file, for a dry run)
set -eu
cd "$(git rev-parse --show-toplevel)"

ENV_FILE=${ENV_FILE:-.env}
DATABASE_URL=$(sed -n 's/^DATABASE_URL_PROD=//p' "$ENV_FILE" | tail -n 1 | sed -e "s/^[\"']//" -e "s/[\"']\$//")
if [ -z "$DATABASE_URL" ]; then
  echo "seed-prod: DATABASE_URL_PROD is not set in $ENV_FILE" >&2
  exit 1
fi
export DATABASE_URL

pnpm build
pnpm --filter db migrate
pnpm --filter db seed
node apps/api/dist/seedDemo.js
pnpm --filter @bidpilot/db exec node --input-type=module -e "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const [c] = await sql\`
  SELECT (SELECT count(*) FROM publishers)::int AS publishers,
         (SELECT count(*) FROM campaigns)::int AS campaigns,
         (SELECT count(*) FROM jobs)::int AS jobs,
         (SELECT count(*) FROM allocations)::int AS allocations,
         (SELECT count(*) FROM events)::int AS events,
         (SELECT count(*) FROM daily_stats)::int AS daily_stats_rows,
         (SELECT coalesce(sum(clicks), 0) FROM daily_stats)::int AS rollup_clicks,
         (SELECT count(*) FROM events WHERE type = 'click')::int AS event_clicks,
         (SELECT string_agg(name || ' day ' || current_day || '/' || days, '; ') FROM campaigns) AS progress\`;
console.log('seed-prod: counts', c);
await sql.end();
"
