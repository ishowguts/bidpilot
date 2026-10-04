# BidPilot — State

Last updated: 2026-10-04 · Phase: **Day 2 — Rebuild after owner audit** · Next task: **B10**

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
| B10 | Experiments CLI | todo (rebuilt by owner decision after audit) |
| B11 | Campaign API | todo (rebuilt by owner decision after audit) |
| B12 | Stats API | todo |
| B13 | Parity test | todo |
| B14 | Web scaffold + campaign list | todo |
| B15 | Dashboard | todo |
| B16 | Experiments page | todo |
| B17 | Test pass | todo |
| B18 | Deploy | todo |
| B19 | LLM daily summary (stretch) | todo |
| B20 | README | todo |

## Measurements

Only measured values, each with the command that produced it and the commit.

| Metric | Value | Command | Commit |
| --- | --- | --- | --- |
| Thompson CPA vs equal split, stationary (paired, mean ± 95% CI) | −20.0% ± 1.4% (₹381.6 vs ₹477.6), lower on 20/20 seeds | `pnpm exp --seeds 20 --days 30 --scenario all --ablation` | b38fa01 |
| Thompson CPA vs equal split, drift | −14.6% ± 1.3% (₹437.9 vs ₹513.3), 20/20 | same | b38fa01 |
| Thompson CPA vs equal split, emergence | −31.1% ± 1.7% (₹276.7 vs ₹401.9), 20/20 | same | b38fa01 |
| Thompson vs greedy CPA (stationary / drift / emergence) | ₹381.6 vs ₹375.0 / ₹437.9 vs ₹428.0 / ₹276.7 vs ₹365.0; Thompson lower on 5 / 5 / 20 of 20 seeds | same | b38fa01 |
| Regret vs oracle, applies lost (thompson / greedy / equal) | stationary 207 / 211 / 522; drift 247 / 253 / 448; emergence 395 / 953 / 1074 | same | b38fa01 |
| Mean pacing ratio / overdelivery days | Thompson 0.9993 in every scenario / 0 days for every policy | same | b38fa01 |
| Floor ablation, Thompson CPA at 0% / 1% / 3% | stationary 380.5 / 381.6 / 387.4; drift 438.8 / 437.9 / 444.6; emergence 271.2 / 276.7 / 286.4 | same | b38fa01 |
| Experiment runtime, default (20 seeds × 30 days × 4 policies × 3 scenarios) | 27.9 s | `pnpm exp --seeds 20 --days 30 --scenario all` | 5293224 |
| Experiment runtime with `--ablation` (adds 2 Thompson floors) | 60.5 s | `pnpm exp --seeds 20 --days 30 --scenario all --ablation` | b38fa01 |

Runtimes measured on the owner's Mac (Node 25, single process). Committed `experiments/results/` come from the
`--ablation` run.

## Live URLs

- Web: —
- API: —

## Owner-only items

- Gemini API key for the stretch summary (agents never commit keys).
- Recording the dashboard GIF (B20).
