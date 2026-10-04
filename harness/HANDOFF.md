# BidPilot — Handoff

The baton between sessions. Overwrite **Active session** at the start of every session and before/after every
step. Append one line per session to the **Log** (newest first). Keep it short and exact: a stranger must be able to
continue from this file alone.

## Active session

- Status: IN PROGRESS
- Task: B19 LLM daily summary (stretch); B18 waits on the Vercel deploy (owner)
- Doing now: planning §12: `GET /campaigns/:id/summary/:day`; numbers from SQL (spend, budget, applies, CPA and
  budget share per publisher, share change vs yesterday), rounded; model call via @google/genai with JSON mode,
  thinking off, zod-validated `{ text }`; grounding check (every number in text must be in the input); template
  fallback; cache grounded results in `daily_summaries`.
- Next step: shared schema, services/summary.ts (numbers + grounding, pure parts unit-tested), llm client behind
  an interface with a fake for tests, route, env (GEMINI_API_KEY, GEMINI_MODEL optional), render.yaml entries.
- Files in flight: apps/api/src/services/summary.ts, apps/api/src/llm.ts, apps/api/src/routes/summary.ts
  packages/db/src/client.ts, scripts/seed-prod.sh
- Open problems / gotchas:
  - API tests run in a single fork (vitest `api` project) because they share the test database.
  - `@bidpilot/core` and `@bidpilot/shared` resolve to `dist/`: run `pnpm typecheck` (tsc --build) after editing
    them, before running API tests.
  - Days are 1-based in core; the live path maps day d to `start_date + d - 1` (IST dates).
  - Local `tsc --build` can trust a stale tsbuildinfo; before marking a task done run `sh scripts/ci-local.sh`
    (fresh clone, Node 20, frozen install), which matches CI exactly (ADR-019).
  - Port 4100 is taken by another local project on this machine: run the API with `PORT=4101` and the web app
    with `NEXT_PUBLIC_API_URL=http://localhost:4101` for manual checks. The browser extension was not connected,
    so pages are checked with headless Chrome: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    --headless=new --virtual-time-budget=15000 --screenshot=out.png URL` (wrap with `perl -e 'alarm 45; exec @ARGV'`).
  - `.env` exists and must never be printed or overwritten. Never name any tool or assistant in code, comments or docs.
- Commands to verify: `pnpm lint && pnpm typecheck && pnpm test`

## Log

- 2026-10-05 · B18 done: web https://bidpilot-ashen.vercel.app and API https://bidpilot-api-jcys.onrender.com live; demo dashboard (tiles, four charts), experiments page and campaign list verified on the live site. Demo summary: 2,429 applies, CPA ₹247, −35.4% vs equal split, pacing 99.9%, overdelivery ₹0.
- 2026-10-05 · B11 done: owner confirmed CI green on GitHub at fd36ddd. API live on Render (owner verified).
- 2026-10-05 · Production DB (Supabase, Singapore) migrated and seeded via scripts/seed-prod.sh: 6 publishers, 2 campaigns (demo + baseline, day 30/30), 40 jobs, 1,440 allocations, 96,940 events, 92,942 clicks in both events and daily_stats.
- 2026-10-05 · CI red on d6d1a67 (pacing property, seed -1036790155): root cause late-day stranded headroom, fixed with λ + 2σ (ADR-023, e903192); results regenerated (fd36ddd); ci-local green 3 times.
- 2026-10-05 · B18 prepared (b841a94): demo seed, Render/Vercel configs; waiting for the owner's accounts.
- 2026-10-05 · B17 done (d671b1b): endpoint matrix, happy + failure each: health (200/503), publishers (200/500), campaigns create (201/400), list (200/500), get (200/400/404/500), advance (200/400/404/409/500), events (200/400/413, idempotent), stats daily (200/400/404), summary (200/400/404/500), experiments (200/404/500). ci-local green.
- 2026-10-05 · B16 done (96d48d7): experiments page, per-scenario tables incl. ablation rows, CPA bars with 95% CI whiskers. ci-local green.
- 2026-10-05 · B15 done (5336111): dashboard tiles, four charts, advance controls, loading/error/empty states (checked in headless Chrome). ci-local green.
- 2026-10-05 · B14 done (4def352): web scaffold, typed zod client, list + create form; web joins typecheck/lint/test and CI builds it (ADR-021). ci-local green.
- 2026-10-05 · B13 done (9964f8b): live allocations equal runCampaign for 5 days (thompson and greedy, drift, uneven jobs). ci-local green.
- 2026-10-05 · B12 done (0df99f6): stats daily/summary with window SQL, experiments/latest, hand-computed fixture; ADR-020. ci-local green.
- 2026-10-05 · B11 reopened: CI Typecheck red (TS2769). Fixed in a5e556a (@types/express 4, single @types/node 20, ADR-019); scripts/ci-local.sh reproduces CI. Awaiting owner confirmation.
- 2026-10-04 · B11 done (6be34ac): campaign API with paired baseline, per-day transactions, crash-safe re-run; B02/B03 review fixes (migration 0002, publishers, pino-http, test DB). Next: B12.
- 2026-10-04 · B10 done (5293224): experiments CLI, 3 scenarios, `--ablation`; default 27.9 s, ablation 60.5 s. Next: B11.
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
