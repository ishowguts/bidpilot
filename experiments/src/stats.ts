// Small statistics helpers for the experiment report (ARCHITECTURE §6.5).

// Two-sided 95% critical values of Student's t for 1..30 degrees of freedom.
const T95 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11,
  2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];

/** Two-sided 95% t critical value; above 30 degrees of freedom the normal value is close enough. */
export function t95(df: number): number {
  if (!Number.isInteger(df) || df < 1) throw new Error(`degrees of freedom must be a positive integer, got ${df}`);
  return T95[df - 1] ?? 1.96;
}

export interface Interval {
  mean: number;
  /** Half-width of the 95% confidence interval; 0 for a single value. */
  ci: number;
}

/** Mean and 95% confidence half-width of the mean (t-distribution, n − 1 degrees of freedom). */
export function meanCi(xs: readonly number[]): Interval {
  if (xs.length === 0) throw new Error('meanCi needs at least one value');
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  if (n === 1) return { mean, ci: 0 };
  const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
  return { mean, ci: t95(n - 1) * Math.sqrt(variance / n) };
}
