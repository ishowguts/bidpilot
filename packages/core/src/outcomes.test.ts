// Outcome criteria over 20 seeds × 30 days (ARCHITECTURE §10, ADR-015).
import { describe, it, expect } from 'vitest';
import { DEFAULT_JOBS_PER_CATEGORY, runCampaign } from './runCampaign.js';
import { createPolicy } from './policies/create.js';
import { POLICY_NAMES, type PolicyName } from './policies/types.js';
import { SCENARIOS, type ScenarioName } from './scenarios.js';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

function cpaBySeed(scenario: ScenarioName, policy: PolicyName): number[] {
  return SEEDS.map((seed) => {
    const days = runCampaign(
      { seed, scenario, days: 30, dailyBudget: 20_000, jobsPerCategory: DEFAULT_JOBS_PER_CATEGORY },
      createPolicy(policy, scenario),
    );
    return days.reduce((s, d) => s + d.spend, 0) / days.reduce((s, d) => s + d.applies, 0);
  });
}

const wins = (a: number[], b: number[]): number => a.filter((x, i) => x < b[i]!).length;

describe.each(SCENARIOS)('outcomes in the %s scenario', (scenario) => {
  it('Thompson beats equal split; oracle is at or below every policy on every seed', () => {
    const cpa = Object.fromEntries(POLICY_NAMES.map((p) => [p, cpaBySeed(scenario, p)])) as Record<PolicyName, number[]>;
    expect(wins(cpa.thompson, cpa.equal)).toBeGreaterThanOrEqual(18);
    for (const policy of POLICY_NAMES) {
      cpa.oracle.forEach((oracle, i) => expect(oracle).toBeLessThanOrEqual(cpa[policy][i]! + 1e-9));
    }
    if (scenario === 'emergence') expect(wins(cpa.thompson, cpa.greedy)).toBeGreaterThanOrEqual(18);
  }, 120_000);
});
