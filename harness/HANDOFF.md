# BidPilot — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: B10 Experiments CLI — DONE, committing
- Doing now: committing B10
- Done this session: B10 done — added apps/experiments with CLI using commander and cli-table3. Exposed core modules from packages/core/src/index.ts. Command `pnpm exp --seeds 2 --days 30 --scenario stationary` works correctly and prints the metrics table.
- Next step: commit B10, start B11
- Files in flight (uncommitted): apps/experiments/*, package.json, packages/core/src/index.ts, harness updates.
- Open problems / gotchas: none
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test`

## Log

- 2026-10-02 · B10 done: Experiments CLI app implementation. Next: B11.
- 2026-10-02 · B09 done (f3eb05b): Greedy and Oracle baselines implementation and tests. Next: B10.
- 2026-10-02 · B08 done (0475dce): Posterior and Thompson policy implementation and tests. Next: B09.
- 2026-10-02 · Fixed CI test database migration. B07 done (1bffaa9): pacing, equal policy, runCampaign. Next: B08.
- 2026-10-02 · B06 done (d9feaee): Scenarios and simulator implementation and tests. Next: B07.
- 2026-10-02 · B05 done (c45a47c): RNG + samplers implementation and tests. Next: B06.
- 2026-10-02 · B04 done (4f76952): event schema, POST /api/events, DB logic, tests. Next: B05.
- 2026-10-02 · B03 done (aea52a4). Starting B04.
- 2026-10-02 · B03 done: express skeleton, tests, CI. Next: B04.
- 2026-10-02 · B01+B02 pushed. Starting B03.
- 2026-10-02 · B02 done (b3d9fc1): schema, migrations, seed.
- 2026-10-02 · B01 done (dbd0029): monorepo scaffold.
- 2026-10-02 · harness and architecture created; no code yet.
