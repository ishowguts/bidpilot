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
