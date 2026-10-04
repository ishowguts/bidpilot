import { describe, it, expect } from 'vitest';
import { cpaBars, rowLabel, type ResultRow } from './experiments';

const iv = (mean: number, ci = 0) => ({ mean, ci });
function row(
  scenario: ResultRow['scenario'],
  policy: ResultRow['policy'],
  cpa: number,
  ci: number,
  floor?: number,
): ResultRow {
  return {
    scenario,
    policy,
    ...(floor === undefined ? {} : { floor }),
    applies: iv(1000),
    cpa: iv(cpa, ci),
    cpaVsEqualPct: iv(0),
    regret: iv(0),
    pacingRatio: 1,
    overdeliveryDays: 0,
    winsVsEqual: 0,
    winsVsGreedy: 0,
  };
}

describe('experiment results shaping', () => {
  const rows = [
    row('stationary', 'equal', 477.6, 6.8),
    row('stationary', 'thompson', 381.3, 9.1),
    row('stationary', 'thompson', 390, 9, 0.03),
    row('drift', 'equal', 513.3, 7),
  ];

  it('groups mean CPA and CI half-width per scenario, without ablation rows', () => {
    expect(cpaBars(rows)).toEqual([
      { scenario: 'stationary', equal: 477.6, equalCi: 6.8, thompson: 381.3, thompsonCi: 9.1 },
      { scenario: 'drift', equal: 513.3, equalCi: 7 },
    ]);
  });

  it('labels ablation rows with their floor', () => {
    expect(rowLabel(rows[1]!)).toBe('thompson');
    expect(rowLabel(rows[2]!)).toBe('thompson (floor 3%)');
  });
});
