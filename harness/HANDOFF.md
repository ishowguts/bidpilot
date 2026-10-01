# BidPilot — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: B08 Posterior + Thompson policy — DONE, committing
- Doing now: committing B08
- Done this session: B08 done — added Posterior class for tracking Beta and CPC estimates with discount, implemented Thompson sampling policy with 2,000 draws, exploration floor, and capacity cap.
- Next step: commit B08, start B09
- Files in flight (uncommitted): packages/core/src/posterior.ts, packages/core/src/policies/thompson.ts, packages/core/src/posterior.test.ts, harness updates.
- Open problems / gotchas: none
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test`

## Log

- 2026-10-02 · B08 done: Posterior and Thompson policy implementation and tests. Next: B09.
- 2026-10-02 · Fixed CI test database migration. B07 done: pacing, equal policy, runCampaign. Next: B08.
- 2026-10-02 · B06 done: Scenarios and simulator implementation and tests. Next: B07.
- 2026-10-02 · B05 done (c45a47c): RNG + samplers implementation and tests. Next: B06.
- 2026-10-02 · B04 done (4f76952): event schema, POST /api/events, DB logic, tests. Next: B05.
- 2026-10-02 · B03 done (aea52a4). Starting B04.
- 2026-10-02 · B03 done: express skeleton, tests, CI. Next: B04.
- 2026-10-02 · B01+B02 pushed. Starting B03.
- 2026-10-02 · B02 done (b3d9fc1): schema, migrations, seed.
- 2026-10-02 · B01 done (dbd0029): monorepo scaffold.
- 2026-10-02 · harness and architecture created; no code yet.
