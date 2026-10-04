# BidPilot — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: B07 Pacing + equal policy + runCampaign (rebuild)
- Doing now: adding fast-check as a dev dependency; writing `policies/types.ts` (Policy interface,
  Observation, Allocation), `policies/equal.ts`, `pacing.ts` (§6.4) and `runCampaign.ts` (day loop).
- Next step: fast-check pacing properties (spend <= budget always; spend >= 0.97 × budget when capacity × CPC
  >= 1.2 × budget) and an equal-policy 30-day determinism test; then B08.
- Files in flight: packages/core/src/pacing.ts, policies/types.ts, policies/equal.ts, runCampaign.ts and tests
- Open problems / gotchas:
  - Days are 1-based everywhere in core (drift starts on day 15 = `DRIFT_DAY`).
  - Simulator API: `armDay(seed, scenario, day, category, publisher)` gives the noisy daily parameters;
    `hourTraffic(...)` gives available clicks and an `applies(clicks)` draw (order fixed for common random numbers).
  - CI status cannot be checked from this machine (no `gh` CLI, private repo). Owner should glance at Actions.
  - B03 review: `GET /api/publishers` is a stub returning `[]`, pino-http is not wired, and the API test hardcodes
    the test DB URL instead of `DATABASE_URL_TEST`. Fix in B11.
  - `.env` exists and must never be printed or overwritten. Never name any tool or assistant in code, comments or docs.
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test`

## Log

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
