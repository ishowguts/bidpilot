# BidPilot — State

Last updated: 2026-10-05 · Phase: **Day 5 — Ship** · Next task: **B18**

Build order note: TalentLens is built first. Start BidPilot after TalentLens reaches T24 (deployed), unless the owner
says otherwise.

Status values: `todo` · `in-progress` · `blocked (reason)` · `done (YYYY-MM-DD, <commit>)`

| ID | Task | Status |
| --- | --- | --- |
| B01 | Monorepo scaffold | done (2026-10-02, dbd0029) |
| B02 | Postgres + schema | done (2026-10-02, b3d9fc1) |
| B03 | Express skeleton + CI | done (2026-10-02, aea52a4) |
| B04 | Event ingestion | done (2026-10-02, 4f76952) |
| B05 | RNG + samplers | done (2026-10-04, 38d4057) |
| B06 | Scenarios + simulator | done (2026-10-04, f5a682e) |
| B07 | Pacing + equal policy + runCampaign | done (2026-10-04, bc1b3aa) |
| B08 | Posterior + Thompson policy | done (2026-10-04, 13eace5) |
| B09 | Greedy + oracle policies | done (2026-10-04, 99825a7) |
| B10 | Experiments CLI | done (2026-10-04, 5293224) |
| B11 | Campaign API | in progress (6be34ac; CI red on Typecheck, reopened until CI is green) |
| B12 | Stats API | done (2026-10-05, 0df99f6) |
| B13 | Parity test | done (2026-10-05, 9964f8b) |
| B14 | Web scaffold + campaign list | done (2026-10-05, 4def352) |
| B15 | Dashboard | done (2026-10-05, 5336111) |
| B16 | Experiments page | done (2026-10-05, 96d48d7) |
| B17 | Test pass | done (2026-10-05, d671b1b) |
| B18 | Deploy | todo |
| B19 | LLM daily summary (stretch) | todo |
| B20 | README | todo |

## Measurements

Only measured values, each with the command that produced it and the commit.

| Metric | Value | Command | Commit |
| --- | --- | --- | --- |
| Thompson CPA vs equal split, stationary (paired, mean ± 95% CI) | −20.3% ± 1.4% (₹380.3 vs ₹477.6), lower on 20/20 seeds | `pnpm exp --seeds 20 --days 30 --scenario all --ablation` | e903192 |
| Thompson CPA vs equal split, drift | −14.9% ± 1.3% (₹436.7 vs ₹513.3), 20/20 | same | e903192 |
| Thompson CPA vs equal split, emergence | −31.4% ± 1.5% (₹275.5 vs ₹401.9), 20/20 | same | e903192 |
| Thompson vs greedy CPA (stationary / drift / emergence) | ₹380.3 vs ₹375.3 / ₹436.7 vs ₹427.9 / ₹275.5 vs ₹363.7; Thompson lower on 5 / 7 / 20 of 20 seeds | same | e903192 |
| Regret vs oracle, applies lost (thompson / greedy / equal) | stationary 204 / 214 / 525; drift 244 / 252 / 448; emergence 385 / 943 / 1073 | same | e903192 |
| Mean pacing ratio / overdelivery days | Thompson 0.9993 in every scenario / 0 days for every policy | same | e903192 |
| Floor ablation, Thompson CPA at 0% / 1% / 3% | stationary 379.8 / 380.3 / 388.0; drift 437.9 / 436.7 / 443.2; emergence 269.0 / 275.5 / 285.8 | same | e903192 |
| Experiment runtime, default (20 seeds × 30 days × 4 policies × 3 scenarios) | 31.3 s at add6965 (27.9 s at 5293224); not re-timed after e903192 | `pnpm exp --seeds 20 --days 30 --scenario all` | add6965 |
| Experiment runtime with `--ablation` (adds 2 Thompson floors) | 60.0 s (69.6 s at add6965, 60.5 s at b38fa01) | `pnpm exp --seeds 20 --days 30 --scenario all --ablation` | e903192 |
| Pacing: days spending < 97% of budget when capacity value ≥ 1.2 × budget | 0 of 34,008 random days, min 98.8% (before ADR-023: 2, min 96.6%) | fast-check sample of the property's arbitrary, seed 42 (ADR-023) | e903192 |

Runtimes measured on the owner's Mac (Node 25, single process); they vary by about 10% between runs. Committed
`experiments/results/` come from the `--ablation` run. Results were regenerated at e903192 after the pacing headroom
fix (ADR-023); every CPA moved within its confidence interval.

## Live URLs

- Web: —
- API: —

## Owner-only items

- Gemini API key for the stretch summary (agents never commit keys).
- Recording the dashboard GIF (B20).
