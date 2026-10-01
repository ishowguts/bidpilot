# BidPilot — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: B09 Greedy + oracle policies — DONE, committing
- Doing now: committing B09
- Done this session: B09 done — added GreedyPolicy (3 days equal, then 100% best arm) and OraclePolicy (cheats using ground truth). Verified via test that Oracle CPA <= Equal CPA and Greedy CPA.
- Next step: commit B09, start B10
- Files in flight (uncommitted): packages/core/src/policies/greedy.ts, packages/core/src/policies/oracle.ts, packages/core/src/policies/baselines.test.ts, harness updates.
- Open problems / gotchas: none
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test`

## Log

- 2026-10-02 · B09 done: Greedy and Oracle baselines implementation and tests. Next: B10.
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
