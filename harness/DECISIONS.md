# BidPilot — Decisions (ADR log)

Append-only. Format: number, date, decision, why, consequences. To reverse one, add a new ADR that supersedes it.

## ADR-001 · 2026-10-02 · Pure, deterministic core shared by API and experiments
- Why: the allocator, simulator and pacing must be testable without a database and reproducible from a seed. The
  same `runCampaign` drives both the live API and the experiments CLI, and a parity test proves they agree.
- Consequence: `packages/core` has no I/O imports; lint rule forbids `pg`, `fs`, `http` there.

## ADR-002 · 2026-10-02 · Thompson sampling with probability-of-being-best budget shares
- Why: it balances exploring uncertain publishers and exploiting good ones without a hand-tuned schedule (unlike
  epsilon-greedy), and turns naturally into a budget split. Beta posteriors fit click→apply counts exactly.
- Trade-off: CPC is a point estimate, not sampled; fine because CPC is observed on every click and stabilizes fast.

## ADR-003 · 2026-10-02 · Discounted posteriors (γ = 0.95) for non-stationarity
- Why: publisher performance changes mid-campaign. Discounting old evidence keeps uncertainty alive so the policy
  re-explores. Tested by the drift scenario. γ = 1.0 reproduces the stationary version.

## ADR-004 · 2026-10-02 · Exploration floor (3%) and capacity cap
- Why: the floor guarantees every publisher keeps generating evidence; the cap stops budget piling onto a publisher
  that cannot deliver the clicks, which would cause underspend.

## ADR-005 · 2026-10-02 · Common random numbers across policies
- Why: comparisons between policies are paired by seed with identical traffic and noise, so the measured CPA gap is
  caused by decisions, and confidence intervals are tighter.

## ADR-006 · 2026-10-02 · One row per click in `events`, rollups in a materialized view
- Why: makes ingestion, idempotency and SQL aggregation real rather than pre-aggregated; refresh is cheap at demo
  scale. `REFRESH … CONCURRENTLY` needs the unique index.
- Scaling note: at production volume, events go to a stream and rollups become incremental.

## ADR-007 · 2026-10-02 · Deterministic idempotency keys
- Why: re-running a day after a crash re-generates the same keys, so `ON CONFLICT DO NOTHING` makes the retry safe.

## ADR-008 · 2026-10-02 · LLM summary is numbers-in, grounding-checked
- Why: the model may only phrase numbers computed in SQL; any number in its text that was not in the input rejects
  the summary. Stretch feature; the dashboard works without it.

## ADR-009 · 2026-10-04 · Stream derivation by hashing the full key tuple; separate daily noise stream
- Context: the first RNG (Mulberry32, streams derived by XOR of seed, day, hour, category hash and publisher) was
  rejected in the owner audit: XOR keys collide across seeds and days (for example seed 1 day 2 and seed 2 day 1),
  which breaks the independence and reproducibility required by §6.1.
- Decision: every stream is a pure-rand `xoroshiro128+` generator whose 128-bit state comes from splitmix64 applied
  to a hash of the whole key tuple. Numeric parts must be safe integers; string parts are absorbed character by
  character with a type tag and length, so `1` and `'1'` and reordered tuples are different keys. Uniforms use 53
  bits built from the high bits of two outputs (the low bits of xoroshiro128+ are weak).
- Keys: `env(seed, day, hour, category, publisher)` for hourly traffic and applies, `env-day(seed, day, category,
  publisher)` for the daily CPC and apply-rate noise (§5.1 noise is per day, not per hour), and
  `policy(seed, policy, day)` for policy decisions. None of the environment keys include the policy, which gives
  common random numbers across policies.
- Samplers are exact: binomial and Poisson reduce large parameters with Knuth's beta and gamma splitting
  (TAOCP 3.4.1) instead of normal approximations, so moment tests hold for all sizes.
- Cost: about 3.5 µs to create a stream (BigInt hashing), about 10 s of the full 20-seed experiment. Acceptable
  under the 60 s target; optimize by caching key prefixes if needed.

## ADR-010 · 2026-10-04 · Pacing recovery spends in the same hour; last hour pools every unused rupee
- Context: §6.4 step 4 says budget an arm cannot use moves to arms with spare capacity at the end of each hour.
  Moving it into the recipients' remaining budget for later hours made spend lag the traffic curve: a property
  test found a day with nearly all capacity on an arm with a 0.5% allocation share that spent only 71% of budget.
- Decision: at the end of each hour, the unused slices of capacity-limited arms are pooled and spent in that same
  hour on arms that still have available clicks, first in proportion to allocation shares and then in arm order
  (so rounding leftovers are not lost). Donors are charged in proportion to what they pooled; anything not spent
  stays with them. In the last hour every unused rupee is pooled. Arms with a zero allocation never receive budget.
- Consequence: the §10 properties hold (spend ≤ budget always; spend ≥ 0.97 × budget when capacity × CPC ≥
  1.2 × budget) over 5,000 fast-check cases. The property generator uses category budgets of at least ₹4,000 so
  that one click (at most ₹60) is a small part of the budget; with tiny budgets integer clicks alone can miss 97%.

## ADR-011 · 2026-10-04 · Policy interface takes the day; CPC is rounded to paise
- `Policy.allocate(observations, categoryBudgets, rng, day)` adds `day` to the §6.2 interface. The oracle needs it
  for the drift scenario and greedy needs it to count warm-up days even when no observations exist yet.
- The simulator rounds each day's noisy CPC to paise, and observations carry spend rounded to paise. Spend then
  sums exactly in memory and in SQL `numeric`, which the parity test (§10) relies on.

## ADR-012 · 2026-10-04 · Pacing lets capacity-bound arms catch up (fixes an under-delivery defect)
- Defect: Thompson's capacity estimate for publisher C (the best, capacity-limited arm) averaged 58-77% of the
  true capacity by day 30. Cause: pacing followed the hourly curve rigidly. In an hour with fewer clicks than its
  slice, the arm gave the unused slice away for good; in an hour with more clicks than its slice, it could not buy
  them. With a budget of 1.2 × its capacity value, the arm bought only 88% of its available clicks, so every day
  looked capacity-limited and the capacity estimate (and with it the 1.2 × estimate × ĉ cap) ratcheted down to
  about 83% of real capacity.
- Decision: pacing uses today's run rate (available clicks seen so far per unit of traffic weight), trusted once
  30% of the day's traffic weight has passed. An arm whose remaining budget is at least its projected spend for
  the rest of the day buys every available click instead of its slice. After the trust point, an arm that ran out
  of clicks gives up only the part of its remaining budget above 2 × its projected spend; before it, the ADR-010
  rule (give up the unused slice) still applies, so budget held by arms with tiny capacity starts moving at once.
- Considered and rejected: changing the capacity estimator to a discounted maximum. With the pacing fix it made no
  measurable difference (same 0.85-0.97 of capacity in the feedback loop), so the mean over limited days stays.
- Evidence: bought/available clicks at 1.2 × capacity value rose from 0.883 to 0.929 (20 seeds × 10 days); the
  capped-arm feedback loop rose from 0.78-0.88 to 0.85-0.97 of capacity. Both are regression tests in
  `pacing.test.ts` that fail on the old code. The §10 properties hold over 30,000 fast-check cases.

## ADR-013 · 2026-10-04 · Third scenario: emergence
- Owner decision: keep `stationary` and `drift` unchanged and add `emergence`, the case exploration exists for.
- Definition: from day 10, publisher A's apply rate triples in every category. A moves from a poor arm (CPA ₹600-667,
  in the worst half) to the best arm (CPA ₹200-222) with more capacity than the category budget. Nothing else
  changes. Constants `EMERGENCE_DAY = 10` and `EMERGING_PUBLISHER = 1` live in `scenarios.ts`.
- Consequence: the `campaigns.scenario` check constraint needs a migration adding `'emergence'` (done in B11, since
  committed migrations are never edited). Experiments report all three scenarios.

## ADR-014 · 2026-10-04 · Exploration floor 1% (supersedes the 3% in ADR-004)
- Owner rule: keep 3% unless the measurements clearly favour another value in every scenario.
- Measurement (20 seeds × 30 days, ₹20,000/day, paired by seed, 95% CI with t(19)): Thompson CPA with floor 1%
  versus 3%: stationary −1.50% ± 0.60 (lower on 17/20 seeds), drift −1.48% ± 0.75 (16/20), emergence −3.43% ± 1.03
  (18/20). Every interval excludes zero, so 1% is clearly better in every scenario. Floor 0% versus 1% is not
  clearly different in stationary (−0.28% ± 1.01) or drift (+0.22% ± 0.90), so the floor stays above zero to keep
  the guarantee that every publisher keeps producing evidence.
- Consequence: default `f = 0.01` in `policies/thompson.ts` and §6.2. The experiments report a 0/1/3% ablation.

## ADR-015 · 2026-10-04 · Restated allocator criteria from measurement (owner approved)
- Context: the original §10 criteria (`pBest` of the true best arm > 0.8 by day 15 for ≥ 18/20 seeds; budget off
  the degraded arm within 5 days) do not hold for the specified design: the best arm is capacity-capped, so rivals
  receive little budget and their posteriors stay wide. Measured with spec parameters: `pBest` > 0.8 on day 15 in
  5-8 of 20 seeds per category. This is a property of the design, not a defect (posteriors were checked by hand).
- Decision (owner, 2026-10-04): keep the algorithm and restate the criteria from measured numbers, with bars set as
  meaningful claims and not moved to make a test pass. Measured values at floor 1% (80 seed × category pairs):
  highest `pBest` on day 15 70/80 (bar 60); drift budget drop 71/80, `pBest` drop 76/80, below γ = 1 64/80 (bars 60);
  `pBest` > 0.8 on day 30 43/80 (reported only).
- Outcome criteria added by the owner: Thompson beats equal split on CPA on ≥ 18/20 seeds in every scenario (hard;
  measured 20/20 in all three). Against greedy, Thompson wins clearly only in `emergence` (20/20, bar 18/20). In
  stationary and drift greedy has about 2% lower mean CPA and equal regret within the confidence interval; the
  README reports this rather than claiming superiority.

## ADR-016 · 2026-10-04 · Floor ablation behind `--ablation`; committed results include it
- Owner decision: the default `pnpm exp` run must stay under the 60 s target, so the 0% and 3% floor variants run
  only with `--ablation`. Measured: default run 27.9 s, with `--ablation` 60.5 s (STATE Measurements).
- The committed `experiments/results/` files come from the `--ablation` run so the README and the experiments page
  can show the ablation; the files record the exact command and commit.
- Arguments are parsed with `node:util` `parseArgs` and validated with zod, so no CLI framework is needed.

## ADR-017 · 2026-10-04 · Migration 0002 brings the B02 schema in line with §7
- Review of the kept B02 work found that migration 0000 had none of the §7 CHECK constraints, stored `seed` as
  `smallint` (§7: `integer`), created `events.job_id` as `bigserial` (a foreign key must not own a sequence), and
  used unique indexes where §7 has composite primary keys. Committed migrations are never edited, so
  `0002_harden_constraints.sql` (generated by drizzle-kit, with two manual additions) fixes all of it and adds
  `'emergence'` to the scenario check (ADR-013), plus `current_day BETWEEN 0 AND days` and an index on
  `jobs.campaign_id`. `campaigns.baseline_of` now cascades on delete, so deleting a campaign removes its baseline.
- Manual additions: `daily_stats` reads `events.job_id`, so the migration drops the view before changing the column
  type and `migrate.ts` recreates it right after (it already runs the view SQL with IF NOT EXISTS on every
  migrate); and the leftover `events_job_id_seq` default is dropped.
- The file is numbered 0002 because `0001_daily_stats_mv.sql` is a raw SQL file outside the drizzle journal.
- The seed now pins publisher ids 1-6 to `pub-a` .. `pub-f` with an upsert, because core identifies publishers by
  those ids. Migrating twice is still a no-op.
