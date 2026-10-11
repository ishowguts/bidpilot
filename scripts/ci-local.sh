#!/bin/sh
# Reproduces .github/workflows/ci.yml locally: a fresh clone of a committed ref, Node 20, a frozen install,
# fresh databases, then Migrate and Seed, Lint, Typecheck, Test and Build web.
# Uses the CI steps without the working tree's node_modules or build caches.
#
# Usage: sh scripts/ci-local.sh [ref]   (default: HEAD; needs `docker compose up -d`)
set -eu

REF=${1:-HEAD}
REPO=$(git rev-parse --show-toplevel)
SHA=$(git -C "$REPO" rev-parse "$REF")
WORK=$(mktemp -d "${TMPDIR:-/tmp}/bidpilot-ci.XXXXXX")
trap 'rm -rf "$WORK"' EXIT

NODE20=$(npx -y -p node@20 -- node -p 'process.execPath')
PATH=$(dirname "$NODE20"):$PATH
export PATH

psql_admin() {
  docker compose -f "$REPO/docker-compose.yml" exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 -q -c "$1"
}
for db in bidpilot_ci bidpilot_ci_test; do
  psql_admin "DROP DATABASE IF EXISTS $db WITH (FORCE);"
  psql_admin "CREATE DATABASE $db;"
done
DATABASE_URL=postgres://postgres:postgres@localhost:5433/bidpilot_ci
DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5433/bidpilot_ci_test
export DATABASE_URL DATABASE_URL_TEST

git clone -q "$REPO" "$WORK/repo"
cd "$WORK/repo"
git checkout -q "$SHA"
echo "ci-local: $SHA on node $(node -v)"

pnpm install --frozen-lockfile
pnpm --filter db migrate
DATABASE_URL=$DATABASE_URL_TEST pnpm --filter db migrate
DATABASE_URL=$DATABASE_URL_TEST pnpm --filter db seed
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @bidpilot/web build
echo "ci-local: green on $SHA"
