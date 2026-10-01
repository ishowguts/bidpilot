# BidPilot — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: B06 Scenarios + simulator — DONE, committing
- Doing now: committing CI fix and B07
- Done this session: Fixed ci.yml to migrate/seed test database. B07 done — added pacing.ts for hourly spend control with underspend recovery, equal policy, and runCampaign.ts day loop. Tests pass and pacing respects budgets.
- Next step: push CI fix and B07, start B08
- Files in flight (uncommitted): None (committing now).
- Open problems / gotchas: CI was failing because it didn't migrate bidpilot_test. Fixed.
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test`

## Log

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
