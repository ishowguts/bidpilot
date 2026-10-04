# BidPilot — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: B08 Posterior + Thompson policy (rebuild)
- Doing now: BLOCKED on an owner decision about the §10 convergence and drift criteria (measured below).
  Code is written: `posterior.ts` as an incremental fold (state per arm; each elapsed day applies γ exactly once, in
  day order, then adds that day's counts) and `policies/thompson.ts` (§6.2: 2,000 draws, pBest, 3% floor,
  capacity cap with redistribution by pBest).
- Next step: tests: discount update unit tests (γ once per day, skipped days, γ = 1 equals plain counts, fold
  of full history equals incremental updates), convergence (true best arm pBest > 0.8 by day 15 for >= 18/20
  seeds), drift (budget off the degraded arm within 5 days of day 15 with γ = 0.95). Then B09.
- Files in flight: packages/core/src/posterior.ts, policies/thompson.ts (written, no tests yet)
- Measured on 20 seeds x 30 days, default budget, spec parameters (γ 0.95, floor 3%, 2,000 draws):
  - pBest(true best arm) > 0.8 on day 15: software 7, sales 8, healthcare 6, logistics 5 of 20 seeds
    (γ = 1: 11, 12, 9, 11). Reached 0.8 on any day up to 15: 14, 14, 11, 10.
  - True best arm has the highest pBest on day 15: 20, 17, 16, 16 of 20 (γ = 1: 18, 18, 16, 18).
  - Drift: degraded arm's budget on day 20 below half its day-14 budget: 5, 5, 7, 5 of 20 (γ = 1: 1, 2, 4, 2).
  - Cause: the best arm is capacity-capped (about 120 clicks a day), and rivals receive little budget, so their
    posteriors stay wide. Not a code bug: posteriors and pBest were checked by hand on seed 3.
  - Fixed on the way: integer-click rounding on small budgets made arms look capacity-limited and capped them for
    good. The limited rule now needs unspent > 5% of the allocation and > 3 clicks' worth.
- Open problems / gotchas:
  - Days are 1-based in core (drift from day 15 = `DRIFT_DAY`). Policy interface has a `day` argument (ADR-011).
  - Pacing recovery spends in the same hour (ADR-010). Observations carry spend rounded to paise.
  - CI status cannot be checked from this machine (no `gh` CLI, private repo). Owner should glance at Actions.
  - B03 review: `GET /api/publishers` is a stub returning `[]`, pino-http is not wired, and the API test hardcodes
    the test DB URL instead of `DATABASE_URL_TEST`. Fix in B11.
  - `.env` exists and must never be printed or overwritten. Never name any tool or assistant in code, comments or docs.
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test`

## Log

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
