# BidPilot — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: B05 RNG + samplers (rebuild)
- Doing now: rewriting `packages/core/src/rng.ts` on pure-rand xoroshiro128+ with streams derived by splitmix64
  hashing of the full tuple; environment stream key (seed, day, hour, category, publisher), policy stream key
  (seed, policy, day). Samplers: uniform, normal, lognormal, gamma (Marsaglia-Tsang), beta, poisson, binomial.
- Next step: moment tests (100k draws, fixed seed) and determinism/independence tests in `rng.test.ts`; then
  rebuild B06 scenarios + simulator on the new streams.
- Files in flight: packages/core/src/rng.ts, packages/core/src/rng.test.ts
- Open problems / gotchas:
  - Downstream core modules (simulator, pacing, policies, runCampaign) still use the old RNG class until B06-B09
    are rebuilt; they may be rewritten wholesale.
  - B03 review: `GET /api/publishers` is a stub returning `[]`, pino-http is a dependency but not wired, and the
    API test hardcodes the test DB URL instead of `DATABASE_URL_TEST`. Fix these in B11 (API work) and record it.
  - `.env` exists and must never be printed or overwritten. Never name any tool or assistant in code, comments or docs.
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test`

## Log

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
