// The experiment protocol (ARCHITECTURE §6.5), in memory and without I/O.
import {
  DEFAULT_JOBS_PER_CATEGORY,
  createPolicy,
  createThompsonPolicy,
  runCampaign,
  type Policy,
  type PolicyName,
  type ScenarioName,
} from '@bidpilot/core';
import { meanCi, type Interval } from './stats.js';

export const DEFAULT_DAILY_BUDGET = 20_000;
/** Exploration floors compared by the optional ablation; the default floor is 1% (ADR-014). */
export const ABLATION_FLOORS = [0, 0.03] as const;
const MAIN_POLICIES: readonly PolicyName[] = ['equal', 'greedy', 'thompson', 'oracle'];

export interface ExperimentOptions {
  seeds: number;
  days: number;
  scenarios: readonly ScenarioName[];
  dailyBudget: number;
  ablation: boolean;
}

export interface ResultRow {
  scenario: ScenarioName;
  policy: PolicyName;
  /** Set on ablation rows only: the Thompson exploration floor used. */
  floor?: number;
  applies: Interval;
  /** ₹ per apply: total spend / total applies per seed. */
  cpa: Interval;
  /** % change in CPA versus equal split on the same seed. */
  cpaVsEqualPct: Interval;
  /** Applies lost versus the oracle on the same seed. */
  regret: Interval;
  /** Mean of daily spend / budget over all days and seeds. */
  pacingRatio: number;
  /** Days on which spend exceeded the daily budget, summed over seeds. */
  overdeliveryDays: number;
  /** Seeds on which this row's CPA is lower than equal split's / greedy's. */
  winsVsEqual: number;
  winsVsGreedy: number;
}

interface SeedOutcome {
  applies: number;
  spend: number;
  cpa: number;
  pacingRatios: number[];
  overdeliveryDays: number;
}

function runSeeds(options: ExperimentOptions, scenario: ScenarioName, makePolicy: () => Policy): SeedOutcome[] {
  return Array.from({ length: options.seeds }, (_, i) => {
    const days = runCampaign(
      {
        seed: i + 1,
        scenario,
        days: options.days,
        dailyBudget: options.dailyBudget,
        jobsPerCategory: DEFAULT_JOBS_PER_CATEGORY,
      },
      makePolicy(),
    );
    const applies = days.reduce((s, d) => s + d.applies, 0);
    const spend = days.reduce((s, d) => s + d.spend, 0);
    return {
      applies,
      spend,
      cpa: applies > 0 ? spend / applies : Infinity,
      pacingRatios: days.map((d) => d.spend / d.budget),
      // Spend is a sum of paise amounts in floating point; anything within ₹0.000001 is rounding, not overdelivery.
      overdeliveryDays: days.filter((d) => d.spend > d.budget + 1e-6).length,
    };
  });
}

export function runExperiment(options: ExperimentOptions): ResultRow[] {
  if (options.seeds < 2) throw new Error('at least 2 seeds are needed for confidence intervals');
  const rows: ResultRow[] = [];
  for (const scenario of options.scenarios) {
    const variants: { policy: PolicyName; floor?: number; make: () => Policy }[] = [
      ...MAIN_POLICIES.map((policy) => ({ policy, make: () => createPolicy(policy, scenario) })),
      ...(options.ablation
        ? ABLATION_FLOORS.map((floor) => ({ policy: 'thompson' as const, floor, make: () => createThompsonPolicy({ floor }) }))
        : []),
    ];
    const outcomes = variants.map((v) => runSeeds(options, scenario, v.make));
    const [equal, greedy, , oracle] = outcomes as [SeedOutcome[], SeedOutcome[], SeedOutcome[], SeedOutcome[]];
    variants.forEach((v, k) => {
      const runs = outcomes[k]!;
      const wins = (other: SeedOutcome[]): number => runs.filter((r, i) => r.cpa < other[i]!.cpa).length;
      rows.push({
        scenario,
        policy: v.policy,
        ...(v.floor !== undefined ? { floor: v.floor } : {}),
        applies: meanCi(runs.map((r) => r.applies)),
        cpa: meanCi(runs.map((r) => r.cpa)),
        cpaVsEqualPct: meanCi(runs.map((r, i) => 100 * (r.cpa / equal[i]!.cpa - 1))),
        regret: meanCi(runs.map((r, i) => oracle[i]!.applies - r.applies)),
        pacingRatio: meanCi(runs.flatMap((r) => r.pacingRatios)).mean,
        overdeliveryDays: runs.reduce((s, r) => s + r.overdeliveryDays, 0),
        winsVsEqual: wins(equal),
        winsVsGreedy: wins(greedy),
      });
    });
  }
  return rows;
}

const fmt = (i: Interval, digits: number, suffix = ''): string =>
  `${i.mean.toFixed(digits)}${suffix} ± ${i.ci.toFixed(digits)}${suffix}`;

export interface ReportMeta {
  command: string;
  commit: string;
  generatedAt: string;
  runtimeSeconds: number;
}

export function toMarkdown(options: ExperimentOptions, rows: readonly ResultRow[], meta: ReportMeta): string {
  const header =
    '| Policy | Applies | CPA (₹) | CPA vs equal | Regret (applies) | Beats equal | Beats greedy | Pacing | Overdelivery days |\n' +
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |';
  const line = (r: ResultRow, label: string): string =>
    `| ${label} | ${fmt(r.applies, 0)} | ${fmt(r.cpa, 1)} | ${fmt(r.cpaVsEqualPct, 1, '%')} | ${fmt(r.regret, 0)} | ` +
    `${r.winsVsEqual}/${options.seeds} | ${r.winsVsGreedy}/${options.seeds} | ${r.pacingRatio.toFixed(4)} | ${r.overdeliveryDays} |`;
  const out = [
    '# BidPilot experiment results',
    '',
    `Generated by \`${meta.command}\` at commit \`${meta.commit}\` on ${meta.generatedAt} (runtime ${meta.runtimeSeconds.toFixed(1)} s).`,
    '',
    `${options.seeds} seeds × ${options.days} days, ₹${options.dailyBudget.toLocaleString('en-IN')} per day, ` +
      'equal job mix. Values are mean ± 95% CI across seeds (t-distribution). "CPA vs equal" and "Beats" are paired ' +
      'by seed (common random numbers). Regret is applies lost versus the oracle. Thompson uses a 1% floor (ADR-014).',
  ];
  for (const scenario of options.scenarios) {
    out.push('', `## ${scenario}`, '', header);
    for (const r of rows.filter((x) => x.scenario === scenario && x.floor === undefined)) out.push(line(r, r.policy));
  }
  if (options.ablation) {
    out.push('', '## Exploration floor ablation (Thompson)', '');
    for (const scenario of options.scenarios) {
      out.push(`### ${scenario}`, '', header);
      const scenarioRows = rows.filter((x) => x.scenario === scenario && x.policy === 'thompson');
      for (const r of [...scenarioRows].sort((a, b) => (a.floor ?? 0.01) - (b.floor ?? 0.01))) {
        out.push(line(r, `thompson, floor ${((r.floor ?? 0.01) * 100).toFixed(0)}%`));
      }
      out.push('');
    }
  }
  return out.join('\n').trimEnd() + '\n';
}
