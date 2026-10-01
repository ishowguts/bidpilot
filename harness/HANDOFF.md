# BidPilot — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: B05 RNG + samplers — DONE, committing
- Doing now: committing B05
- Done this session: B05 done — added Mulberry32 RNG and normal, lognormal, gamma, beta, poisson, binomial samplers in core. Tests pass and statistical moments are checked. Fixed some types and dependency issues.
- Next step: commit B05, start B06
- Files in flight (uncommitted): packages/core/src/rng.ts, packages/core/src/rng.test.ts, harness updates, package.json updates.
- Open problems / gotchas: none
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test`

## Log

- 2026-10-02 · B05 done: RNG + samplers implementation and tests. Next: B06.
- 2026-10-02 · B04 done (4f76952): event schema, POST /api/events, DB logic, tests. Next: B05.
- 2026-10-02 · B03 done (aea52a4). Starting B04.
- 2026-10-02 · B03 done: express skeleton, tests, CI. Next: B04.
- 2026-10-02 · B01+B02 pushed. Starting B03.
- 2026-10-02 · B02 done (b3d9fc1): schema, migrations, seed.
- 2026-10-02 · B01 done (dbd0029): monorepo scaffold.
- 2026-10-02 · harness and architecture created; no code yet.
