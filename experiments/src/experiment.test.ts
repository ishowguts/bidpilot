import { describe, it, expect } from 'vitest';
import { runExperiment, toMarkdown, type ExperimentOptions } from './experiment.js';

const options: ExperimentOptions = { seeds: 3, days: 4, scenarios: ['stationary', 'emergence'], dailyBudget: 20_000, ablation: true };

describe('runExperiment', () => {
  const rows = runExperiment(options);

  it('reports every policy and the floor ablation for every scenario', () => {
    // 4 main policies + 2 ablation floors, per scenario.
    expect(rows).toHaveLength(12);
    for (const scenario of options.scenarios) {
      const r = rows.filter((x) => x.scenario === scenario);
      expect(r.map((x) => x.policy)).toEqual(['equal', 'greedy', 'thompson', 'oracle', 'thompson', 'thompson']);
      expect(r.map((x) => x.floor)).toEqual([undefined, undefined, undefined, undefined, 0, 0.03]);
    }
  });

  it('pairs comparisons by seed', () => {
    for (const r of rows.filter((x) => x.policy === 'equal')) {
      expect(r.cpaVsEqualPct).toEqual({ mean: 0, ci: 0 });
      expect(r.winsVsEqual).toBe(0);
    }
    for (const r of rows.filter((x) => x.policy === 'oracle')) expect(r.regret).toEqual({ mean: 0, ci: 0 });
    for (const r of rows) expect(r.overdeliveryDays).toBe(0);
  });

  it('is deterministic', () => {
    expect(runExperiment(options)).toEqual(rows);
  });

  it('writes the command and commit into the markdown', () => {
    const md = toMarkdown(options, rows, { command: 'pnpm exp --seeds 3', commit: 'abc1234', generatedAt: 'now', runtimeSeconds: 1 });
    expect(md).toContain('`pnpm exp --seeds 3`');
    expect(md).toContain('`abc1234`');
    expect(md).toContain('## emergence');
    expect(md).toContain('thompson, floor 0%');
  });

  it('needs at least two seeds', () => {
    expect(() => runExperiment({ ...options, seeds: 1 })).toThrow();
  });
});
