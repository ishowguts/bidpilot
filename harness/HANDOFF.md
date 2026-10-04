# BidPilot — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: B08 + B09 completion (owner approved the restated criteria on 2026-10-04; CI green on c6ea8c1)
- Doing now: writing the approved criteria into ARCHITECTURE §10 + ADR-015, adding `policies/thompson.test.ts`
  (unit tests, convergence, drift) and `outcomes.test.ts` (hard criterion, emergence vs greedy, oracle sanity),
  plus greedy/oracle unit tests. Floor default stays 1% (ADR-014).
- Approved criteria (80 pairs = 20 seeds x 4 categories, floor 1%):
  - Hard: Thompson CPA < equal on >= 18/20 seeds in every scenario.
  - Day 15 stationary: true best arm has the highest pBest in >= 60/80 pairs. pBest > 0.8 on day 30: reported only.
  - Drift: degraded arm's day-20 budget < day-14 budget in >= 60/80; day-20 pBest < day-14 pBest in >= 60/80;
    day-20 budget below the γ = 1 run's in >= 60/80.
  - Emergence: Thompson CPA < greedy on >= 18/20. Stationary/drift vs greedy: no claim, reported.
  - Oracle CPA <= every policy on every seed, every scenario.
- Next step: mark B08 and B09 done with real hashes, push; then B10 (CLI, `--ablation` optional flag so the
  default run stays under 60 s; record both runtimes), then B11.
- Files in flight: none uncommitted except throwaway `packages/core/src/dbg*.tmp.ts` (delete them, never commit).
- Open problems / gotchas:
  - Days are 1-based in core. Policy interface has a `day` argument (ADR-011).
  - CI status cannot be checked from this machine (no `gh` CLI, private repo). Owner should glance at Actions.
  - B03 review: `GET /api/publishers` is a stub returning `[]`, pino-http is not wired, and the API test hardcodes
    the test DB URL instead of `DATABASE_URL_TEST`. Fix in B11.
  - `.env` exists and must never be printed or overwritten. Never name any tool or assistant in code, comments or docs.
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test`

## Log

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
