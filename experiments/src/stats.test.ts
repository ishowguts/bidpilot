import { describe, it, expect } from 'vitest';
import { meanCi, t95 } from './stats.js';

describe('stats', () => {
  it('t critical values', () => {
    expect(t95(19)).toBe(2.093);
    expect(t95(100)).toBe(1.96);
    expect(() => t95(0)).toThrow();
  });

  it('mean and 95% CI of the mean', () => {
    // Values 1..5: mean 3, sample sd sqrt(2.5), CI = 2.776 × sqrt(2.5 / 5).
    const r = meanCi([1, 2, 3, 4, 5]);
    expect(r.mean).toBe(3);
    expect(r.ci).toBeCloseTo(2.776 * Math.sqrt(0.5), 12);
    expect(meanCi([7])).toEqual({ mean: 7, ci: 0 });
    expect(() => meanCi([])).toThrow();
  });
});
