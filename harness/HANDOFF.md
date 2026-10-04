# BidPilot — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: B13 Parity test (B11 still awaits the owner's CI confirmation for a5e556a)
- Doing now: `apps/api/src/parity.test.ts`: create a campaign via the API (thompson, compareBaseline false),
  advance 5 days one at a time, read `allocations` back, compare with `runCampaign(config, createThompsonPolicy())`
  allocations for days 1-5 (budget to the paisa, pBest/alpha/beta to float4 precision).
- Next step: run tests, ci-local, mark B13 done, push.
- Files in flight: apps/api/src/parity.test.ts
- Open problems / gotchas:
  - API tests run in a single fork (vitest `api` project) because they share the test database.
  - `@bidpilot/core` and `@bidpilot/shared` resolve to `dist/`: run `pnpm typecheck` (tsc --build) after editing
    them, before running API tests.
  - Days are 1-based in core; the live path maps day d to `start_date + d - 1` (IST dates).
  - Local `tsc --build` can trust a stale tsbuildinfo; before marking a task done run `sh scripts/ci-local.sh`
    (fresh clone, Node 20, frozen install), which matches CI exactly (ADR-019).
  - `.env` exists and must never be printed or overwritten. Never name any tool or assistant in code, comments or docs.
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test`

## Log

- 2026-10-05 · B12 done (0df99f6): stats daily/summary with window SQL, experiments/latest, hand-computed fixture; ADR-020. ci-local green.
- 2026-10-05 · B11 reopened: CI Typecheck red (TS2769). Fixed in a5e556a (@types/express 4, single @types/node 20, ADR-019); scripts/ci-local.sh reproduces CI. Awaiting owner confirmation.
- 2026-10-04 · B11 done (6be34ac): campaign API with paired baseline, per-day transactions, crash-safe re-run; B02/B03 review fixes (migration 0002, publishers, pino-http, test DB). Next: B12.
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
