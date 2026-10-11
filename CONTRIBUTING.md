# Contributing to BidPilot

Use Node.js 20 and the pnpm version pinned in `package.json`. Follow the local setup in [README.md](README.md).

Before submitting a change:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @bidpilot/web build
```

Tests need the separate PostgreSQL test database from `docker compose up -d`.
Migrate and seed the test database before running API tests:

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:5433/bidpilot_test pnpm --filter db migrate
DATABASE_URL=postgres://postgres:postgres@localhost:5433/bidpilot_test pnpm --filter db seed
```

Set `DATABASE_URL_TEST` to that same local URL in `.env`. Run typecheck first to build workspace packages.
Use local test credentials, never a production database.

Keep request and response validation in `packages/shared`. Add migrations for schema changes; do not rewrite existing migrations.
Include a regression check for behavior changes. Keep secrets out of source control and document configuration in `.env.example`.

[Architecture](docs/ARCHITECTURE.md) describes the contracts; [decisions](docs/DECISIONS.md) records their trade-offs.
Preserve the evaluation limitations and the commands behind published results.

Database-independent checks: `pnpm exec vitest run --project pure`.
For CI verification in a fresh checkout: `sh scripts/ci-local.sh [ref]` (requires Docker).
