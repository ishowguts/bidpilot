# BidPilot — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS (waiting for owner review of the measured table before B08 is marked done)
- Task: B08 Posterior + Thompson policy (rebuild)
- Done this session for B08 (owner decision #2):
  1. Capacity defect found and fixed in pacing (cf34cee, ADR-012) with two regression tests that fail on the old
     code. The estimator change (discounted max) was tried and reverted: no difference once pacing was fixed.
  2. Floor ablation measured: 1% beats 3% in every scenario with paired CIs excluding zero; default is now 1%
     (08cae89, ADR-014).
  3. Emergence scenario added (08cae89, ADR-013). Needs a DB migration for the scenario check in B11.
  Full numbers: see the table in the owner report; raw output was produced by a throwaway script (not committed).
- Proposed restated criteria (awaiting owner approval; then write them into §10 + ADR + tests):
  - Hard: Thompson CPA < equal on >= 18/20 seeds in every scenario (measured 20/20 in all three).
  - Convergence: true best arm has the highest pBest on day 15 in >= 60/80 (seed, category) pairs
    (measured 70/80 at f = 1%). pBest > 0.8 on day 30 is reported only (measured 43/80).
  - Drift: degraded arm's budget on day 20 below day 14 in >= 60/80 pairs (measured 71/80); its pBest lower in
    >= 60/80 (76/80); its day-20 budget below the γ = 1 run's in >= 60/80 (64/80).
  - Greedy: emergence, Thompson CPA < greedy on >= 18/20 (measured 20/20). Stationary and drift: no superiority
    claim; greedy's mean CPA is lower (375.0 vs 381.6, 428.0 vs 437.9) and regret is equal within CI.
  - Oracle CPA <= every policy on every seed (holds in all three scenarios).
- Next step: on approval, write §10 criteria + ADR-015, add `thompson.test.ts` (convergence, drift, outcomes),
  mark B08 and B09 done, push. Then B10 (experiments CLI with 3 scenarios + floor ablation; runtime target < 60 s
  needs attention: the measurement script took 62 s for 6 variants × 3 scenarios).
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
