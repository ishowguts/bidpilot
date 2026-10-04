# BidPilot — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: B10 Experiments CLI (rebuild)
- Doing now: `experiments/run.ts` CLI: `pnpm exp --seeds 20 --days 30 --scenario stationary|drift|emergence|all
  [--ablation]`. Writes `experiments/results/results.json` and `results.md` with command, commit, per (scenario,
  policy) total applies, CPA mean ± 95% CI (t, n-1 df), paired % CPA change vs equal with CI, regret vs oracle,
  mean pacing ratio, overdelivery count. `--ablation` adds Thompson floor 0/1/3% rows. Default run must stay
  under 60 s; record both runtimes in STATE Measurements.
- Next step: run the full experiment, copy numbers into STATE Measurements, mark B10 done, push. Then B11.
- Files in flight: experiments/src/run.ts (plus a stats helper), experiments/results/*
- Open problems / gotchas:
  - Days are 1-based in core. Policy interface has a `day` argument (ADR-011). Floor default 1% (ADR-014).
  - Scenario `emergence` needs a migration for the campaigns check constraint in B11 (ADR-013).
  - Full measurement with ablation took 62 s in a throwaway script; the default run excludes the ablation.
  - B03 review: `GET /api/publishers` is a stub returning `[]`, pino-http is not wired, and the API test hardcodes
    the test DB URL instead of `DATABASE_URL_TEST`. Fix in B11.
  - `.env` exists and must never be printed or overwritten. Never name any tool or assistant in code, comments or docs.
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test`

## Log

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
