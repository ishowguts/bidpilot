# BidPilot — Tasks

Rules: work in ID order unless dependencies allow otherwise. One task at a time. A task is `done` only when every
acceptance criterion holds and CI is green. Never delete a task; split it into `B07a`, `B07b` if it is too big.
Status lives in `harness/STATE.md`, not here. Spec references point to `docs/ARCHITECTURE.md` sections (§).

## Day 1 — Foundation + events

**B01 Monorepo scaffold** · deps: none
- pnpm workspace: `packages/core`, `packages/db`, `packages/shared`, `apps/api`, `apps/web`, `experiments` (§4).
  Strict tsconfig base, ESLint + Prettier, root scripts `lint`, `typecheck`, `test`, `build`, `exp`.
- Accept: clean clone → `pnpm install && pnpm lint && pnpm typecheck` pass.

**B02 Postgres + schema** · deps: B01
- `docker-compose.yml` (postgres:16 on port 5433, `bidpilot` and `bidpilot_test` DBs); `.env.example` (§11);
  Drizzle schema for §7 tables; raw SQL migration for `daily_stats` MV + unique index; seed 6 publishers.
- Accept: migrate twice is a no-op; `select count(*) from publishers` = 6.

**B03 Express skeleton + CI** · deps: B02
- `createApp()`/`server.ts`, zod env, request id, pino-http, helmet, cors, error shape (§8), `GET /api/health`,
  `GET /api/publishers`. `.github/workflows/ci.yml` (keep `guard.yml` untouched).
- Accept: Supertest health + 404 shape; CI green.

**B04 Event ingestion** · deps: B03
- `POST /api/events` with zod batch validation (1–1000), `ON CONFLICT DO NOTHING`, `{ accepted, duplicates }`;
  view refresh helper.
- Accept: same batch twice → second call `accepted: 0`; row count unchanged; invalid type → 400; 1001 events → 413.

## Day 2 — Simulator + baseline

**B05 RNG + samplers** · deps: B01
- `rng.ts` seeded split streams (§6.1); normal, lognormal, gamma (Marsaglia–Tsang), beta (via two gammas),
  poisson, binomial.
- Accept: moment tests within tolerance over 100k draws; determinism test.

**B06 Scenarios + simulator** · deps: B05
- `scenarios.ts` ground truth for all 4 categories × 6 publishers following the design rule in §5.1 (cheapest CPC is
  not cheapest CPA; best arm capacity-limited), stationary + drift; `simulator.ts` hour-level events.
- Accept: unit tests: observed CPA over a long run converges to true CPA ± 5%; drift applies on day 15.

**B07 Pacing + equal policy + runCampaign** · deps: B06
- `pacing.ts` (§6.4), `policies/equal.ts`, `runCampaign.ts` day loop with the `Policy` interface
  (`allocate(observations, budgets, rng) → allocations`).
- Accept: fast-check pacing properties (§10); equal policy 30-day run completes deterministically.

## Day 3 — Allocator

**B08 Posterior + Thompson policy** · deps: B07
- `posterior.ts` (discounted Beta + CPC estimate), `policies/thompson.ts` (§6.2: pBest via 2,000 draws, floor,
  capacity cap).
- Accept: convergence test (§10) on 20 seeds; drift test passes with γ = 0.95.

**B09 Greedy + oracle policies** · deps: B07
- Accept: oracle CPA ≤ every other policy's CPA on every seed (sanity check of the simulator).

**B10 Experiments CLI** · deps: B08, B09
- `pnpm exp --seeds 20 --days 30 --scenario stationary|drift|all`; writes `results.json` and `results.md` (§6.5),
  including command, commit hash, and paired CPA delta vs equal with 95% CI.
- Accept: runs in < 60 s locally; numbers copied to STATE Measurements.

## Day 4 — Live path + dashboard

**B11 Campaign API** · deps: B04, B08
- `POST/GET /campaigns`, `POST /campaigns/:id/advance` (transaction per day: allocate → simulate → ingest → refresh
  → bump day), paired baseline campaign, deterministic idempotency keys (§7).
- Accept: Supertest create + advance 3 days; advance past end → 409; re-running a crashed day does not double count.

**B12 Stats API** · deps: B11
- `/stats/daily` with window-function SQL (§7), `/stats/summary` incl. baseline delta, `/experiments/latest`.
- Accept: values match a hand-computed fixture.

**B13 Parity test** · deps: B11
- API-advanced allocations equal in-memory `runCampaign` allocations for the same seed for 5 days.

**B14 Web scaffold + campaign list** · deps: B03
- Next.js + Tailwind + Recharts; typed client from `packages/shared`; campaign list + create form.

**B15 Dashboard** · deps: B12, B14
- KPI tiles and the four charts (§9); advance controls; loading/error/empty states.

**B16 Experiments page** · deps: B10, B14
- Results table + CPA bar chart with CI whiskers per policy × scenario.

## Day 5 — Ship

**B17 Test pass** · deps: B13, B15
- Every endpoint has happy + failure tests; CI green.

**B18 Deploy** · deps: B17
- Neon + Render + Vercel (§13); seeded demo campaign with paired baseline advanced to day 30.
- Accept: live dashboard renders all charts; URLs in STATE.

**B19 LLM daily summary (stretch)** · deps: B12
- §12 including the grounding check; tests with a fake LLM: grounded text accepted, invented number rejected.

**B20 README** · deps: B10, B18
- What it is, live link, screenshot/GIF (owner records), diagram from §2, results table copied from
  `experiments/results/results.md`, how to run, "how real traffic differs" (§14). No unmeasured numbers.
