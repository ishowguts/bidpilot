# BidPilot — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: B11 Campaign API (rebuild)
- Doing now: step 3 (shared campaign schemas). Step 2 done: migration 0002 (ADR-017). Step 1 done: publishers from DB, pino-http, routes/middleware split, async
  error wrapper, tests on `DATABASE_URL_TEST`, seed pins publisher ids 1-6, vitest projects (API files serial).
- Plan:
  1. Fix the B03 review items first: `GET /api/publishers` reads the DB, pino-http wired, API tests use
     `DATABASE_URL_TEST`.
  2. Migration 0002 (B02 review): §7 CHECK constraints (none exist), 'emergence' in the scenario check (ADR-013),
     seed smallint -> integer, events.job_id bigserial -> bigint, composite primary keys for allocations and
     daily_summaries instead of unique indexes. Generate with drizzle-kit so the snapshot stays in sync.
  3. Shared zod schemas for campaigns in `packages/shared` (create body, advance body, responses).
  4. Core: pure event expansion (hourly arm results to per-click/apply events with deterministic idempotency
     keys, §7) so the API only does I/O.
  5. Services: create campaign (+ jobs, + paired equal baseline with the same seed), list, get, advance N days:
     one transaction per day: allocate (policy built from SQL observations) → simulate → ingest events →
     refresh view → bump current_day. 409 when finished.
  6. Tests: create + advance 3 days; advance past end → 409; validation failures; re-running a crashed day does
     not double count.
- Next step: step 3.
- Files in flight: apps/api, packages/db, packages/shared, packages/core
- Open problems / gotchas:
  - `@bidpilot/core` resolves to `dist/` (package.json main). After editing core, run `pnpm typecheck` (tsc
    --build) before running the API or its tests, or they use stale code. The experiments `start` script builds
    first for this reason.
  - Days are 1-based in core. Policy interface has a `day` argument (ADR-011). Floor default 1% (ADR-014).
  - `.env` exists and must never be printed or overwritten. Never name any tool or assistant in code, comments or docs.
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test`

## Log

- 2026-10-04 · B10 done (5293224): experiments CLI, 3 scenarios, `--ablation`; default 27.9 s, ablation 60.5 s. Next: B11.
- 2026-10-04 · B08 done (13eace5) and B09 done (99825a7): criteria restated per ADR-015 (owner approved), all tests pass. CI green on c6ea8c1 (owner checked). Next: B10.
- 2026-10-04 · B08: pacing defect fixed (cf34cee), emergence scenario + 1% floor (08cae89). Waiting for owner review.
- 2026-10-04 · B07 done (bc1b3aa): pacing with same-hour recovery, equal policy, runCampaign, fast-check properties. Next: B08.
- 2026-10-04 · B06 done (f5a682e): scenarios, hour-level simulator, CPA convergence and drift tests. Next: B07.
- 2026-10-04 · B05 done (38d4057): pure-rand streams with hashed keys, exact samplers, moment tests. Next: B06.
- 2026-10-04 · recovered B11: uncommitted campaign routes lacked advance, baseline, shared schemas and tests; discarded. Removed duplicate apps/experiments. STATE B05-B11 reset to todo.
- 2026-10-04 · Taking over after owner audit. Rebuilding B05-B11 strictly to ARCHITECTURE; ADRs for deviations.
- 2026-10-02 · B10 marked done by previous agent (rejected in audit: duplicate experiments package, no results files).
- 2026-10-02 · B09 done (f3eb05b): rejected in audit, to be rebuilt.
- 2026-10-02 · B08 done (0475dce): rejected in audit, to be rebuilt.
- 2026-10-02 · B07 done (1bffaa9): rejected in audit, to be rebuilt.
- 2026-10-02 · B06 done (d9feaee): rejected in audit, to be rebuilt.
- 2026-10-02 · B05 done (c45a47c): rejected in audit, to be rebuilt.
- 2026-10-02 · B04 done (4f76952): event schema, POST /api/events, DB logic, tests.
- 2026-10-02 · B03 done (aea52a4): express skeleton, tests, CI.
- 2026-10-02 · B02 done (b3d9fc1): schema, migrations, seed.
- 2026-10-02 · B01 done (dbd0029): monorepo scaffold.
- 2026-10-02 · harness and architecture created; no code yet.
