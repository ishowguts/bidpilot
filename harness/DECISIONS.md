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
