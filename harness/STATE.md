# BidPilot — State

Last updated: 2026-10-04 · Phase: **Day 2 — Rebuild after owner audit** · Next task: **B05**

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
| B08 | Posterior + Thompson policy | todo (rebuilt by owner decision after audit) |
| B09 | Greedy + oracle policies | todo (rebuilt by owner decision after audit) |
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
| CPA vs equal split, stationary (mean, 95% CI) | — | | |
| CPA vs equal split, drift (mean, 95% CI) | — | | |
| Regret vs oracle (applies lost) | — | | |
| Mean pacing ratio / overdelivery count | — | | |
| Experiment runtime (20 seeds × 30 days × 4 policies × 2 scenarios) | — | | |

## Live URLs

- Web: —
- API: —

## Owner-only items

- Gemini API key for the stretch summary (agents never commit keys).
- Recording the dashboard GIF (B20).
