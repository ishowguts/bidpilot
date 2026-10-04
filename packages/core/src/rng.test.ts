import { describe, it, expect } from 'vitest';
import {
  stream,
  envStream,
  policyStream,
  normal,
  lognormal,
  gamma,
  beta,
  poisson,
  binomial,
  type Rng,
} from './rng.js';

const N = 100_000;

function moments(draw: (rng: Rng) => number, key: string): { mean: number; variance: number } {
  const rng = stream('moment-test', key);
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < N; i++) {
    const x = draw(rng);
    sum += x;
    sumSq += x * x;
  }
  const mean = sum / N;
  return { mean, variance: sumSq / N - mean * mean };
}

function expectMoments(
  name: string,
  draw: (rng: Rng) => number,
  mean: number,
  variance: number,
): void {
  const m = moments(draw, name);
  // Tolerance: 5 standard errors of the sample mean, and 5% relative error on the variance.
  expect(Math.abs(m.mean - mean)).toBeLessThan(5 * Math.sqrt(variance / N));
  expect(Math.abs(m.variance - variance) / variance).toBeLessThan(0.05);
}

describe('samplers: moments over 100k draws', () => {
  it('uniform', () => expectMoments('uniform', (r) => r.next(), 0.5, 1 / 12));
  it('normal(2, 3)', () => expectMoments('normal', (r) => normal(r, 2, 3), 2, 9));
  it('lognormal(0, 0.15)', () => {
    const s2 = 0.15 ** 2;
    expectMoments('lognormal', (r) => lognormal(r, 0, 0.15), Math.exp(s2 / 2), (Math.exp(s2) - 1) * Math.exp(s2));
  });
  it('gamma(0.5)', () => expectMoments('gamma-small', (r) => gamma(r, 0.5), 0.5, 0.5));
  it('gamma(3.7)', () => expectMoments('gamma', (r) => gamma(r, 3.7), 3.7, 3.7));
  it('beta(2, 5)', () => expectMoments('beta', (r) => beta(r, 2, 5), 2 / 7, 10 / (49 * 8)));
  it('beta(30, 970)', () => {
    const a = 30;
    const b = 970;
    const s = a + b;
    expectMoments('beta-skewed', (r) => beta(r, a, b), a / s, (a * b) / (s * s * (s + 1)));
  });
  it('poisson(3.2)', () => expectMoments('poisson-small', (r) => poisson(r, 3.2), 3.2, 3.2));
  it('poisson(250)', () => expectMoments('poisson-large', (r) => poisson(r, 250), 250, 250));
  it('binomial(20, 0.3)', () => expectMoments('binomial-small', (r) => binomial(r, 20, 0.3), 6, 4.2));
  it('binomial(1500, 0.04)', () =>
    expectMoments('binomial-large', (r) => binomial(r, 1500, 0.04), 60, 1500 * 0.04 * 0.96));

  it('edge cases', () => {
    const rng = stream('edges');
    expect(binomial(rng, 0, 0.5)).toBe(0);
    expect(binomial(rng, 500, 0)).toBe(0);
    expect(binomial(rng, 500, 1)).toBe(500);
    expect(poisson(rng, 0)).toBe(0);
    expect(() => binomial(rng, -1, 0.5)).toThrow();
    expect(() => binomial(rng, 10, 1.5)).toThrow();
    expect(() => gamma(rng, 0)).toThrow();
  });
});

function take(rng: Rng, n: number): number[] {
  return Array.from({ length: n }, () => rng.next());
}

function correlation(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

describe('streams', () => {
  it('same key gives the same sequence', () => {
    expect(take(envStream(7, 3, 11, 'software', 2), 50)).toEqual(take(envStream(7, 3, 11, 'software', 2), 50));
    expect(take(policyStream(7, 'thompson', 4), 50)).toEqual(take(policyStream(7, 'thompson', 4), 50));
  });

  it('keys that collided under XOR derivation give different streams', () => {
    // seed ^ day is equal for (1, 2) and (2, 1); hashing the full tuple must separate them.
    expect(envStream(1, 2, 0, 'sales', 1).next()).not.toBe(envStream(2, 1, 0, 'sales', 1).next());
    // Swapping hour and publisher must not collide either.
    expect(envStream(5, 1, 3, 'sales', 4).next()).not.toBe(envStream(5, 1, 4, 'sales', 3).next());
    // String and number parts with the same text are different keys.
    expect(stream(1).next()).not.toBe(stream('1').next());
  });

  it('first draws are unique across many neighbouring keys', () => {
    const seen = new Set<number>();
    let count = 0;
    for (let seed = 0; seed < 20; seed++)
      for (let day = 0; day < 30; day++)
        for (let hour = 0; hour < 24; hour++)
          for (const category of ['software', 'sales']) {
            seen.add(envStream(seed, day, hour, category, 1).next());
            count++;
          }
    expect(seen.size).toBe(count);
  });

  it('neighbouring seeds and days are uncorrelated', () => {
    const base = take(envStream(1, 1, 0, 'software', 1), 20_000);
    for (const other of [envStream(2, 1, 0, 'software', 1), envStream(1, 2, 0, 'software', 1), policyStream(1, 'equal', 1)]) {
      expect(Math.abs(correlation(base, take(other, 20_000)))).toBeLessThan(0.03);
    }
  });

  it('environment streams do not depend on the policy (common random numbers)', () => {
    // The environment key has no policy component, so every policy reads the same traffic for a seed.
    // Consuming a policy stream must not move the environment stream.
    const before = take(envStream(9, 4, 12, 'logistics', 6), 10);
    take(policyStream(9, 'thompson', 4), 1000);
    expect(take(envStream(9, 4, 12, 'logistics', 6), 10)).toEqual(before);
  });

  it('rejects non-integer numeric key parts', () => {
    expect(() => stream(1.5)).toThrow();
  });
});
