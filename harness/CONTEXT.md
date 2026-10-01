# BidPilot — Context

## Why this exists

Recruitment advertising platforms spend an employer's budget across many job sites and optimize for cost per
application. Each site has a different price per click and a different, unknown click-to-apply rate that changes over
time. BidPilot is that problem in miniature: decide daily where the money goes, learn from results, stay on budget,
and prove it beats a naive split.

## Goals

1. A deterministic simulator with hidden ground truth so results can be measured honestly.
2. A Thompson sampling allocator with pacing that beats an equal split on cost per apply, with confidence intervals
   over 20 seeds, in both a stationary and a drift scenario.
3. A production-shaped live path: idempotent event API, SQL rollups with window functions, a Next.js dashboard.

## Non-goals

- Real ad-network integrations, auctions, or bid optimization (listed as extensions in ARCHITECTURE §14).
- Auth and multi-tenant accounts.
- Real candidate data.

## Success criteria

- `experiments/results/results.md` shows CPA vs equal split with 95% CI for both scenarios, plus regret vs oracle.
- Spend never exceeds the daily budget in any test or run (overdelivery = 0).
- Live dashboard with the four charts; CI green.

## Design questions the owner must be able to answer

- Explore vs exploit, and why Thompson sampling instead of always picking the best so far (greedy result shows it).
- What happens when a publisher's performance changes mid-campaign (drift scenario, ADR-003).
- How overspending is prevented (pacing hard stop, §6.4) and how underspend is recovered.
- How real click data differs from the simulator (§14).
