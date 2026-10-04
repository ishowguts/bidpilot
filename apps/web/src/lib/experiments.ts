// Shapes /experiments/latest for the experiments page (ARCHITECTURE §6.5, §9).
import type { ExperimentResults } from '@bidpilot/shared';

export type ResultRow = ExperimentResults['rows'][number];

export const POLICY_ORDER = ['equal', 'greedy', 'thompson', 'oracle'] as const;

/** Row label: the policy, plus the exploration floor on ablation rows. */
export const rowLabel = (r: ResultRow): string =>
  r.floor === undefined ? r.policy : `${r.policy} (floor ${(r.floor * 100).toFixed(0)}%)`;

/**
 * One bar group per scenario: `<policy>` holds the mean CPA and `<policy>Ci` the 95% half-width that the error
 * whisker draws. Ablation rows are left out; they appear in the table only.
 */
export function cpaBars(rows: readonly ResultRow[]): Array<Record<string, number | string>> {
  const scenarios = [...new Set(rows.map((r) => r.scenario))];
  return scenarios.map((scenario) => {
    const group: Record<string, number | string> = { scenario };
    for (const r of rows)
      if (r.scenario === scenario && r.floor === undefined) {
        group[r.policy] = r.cpa.mean;
        group[`${r.policy}Ci`] = r.cpa.ci;
      }
    return group;
  });
}
