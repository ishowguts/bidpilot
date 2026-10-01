import { describe, it, expect } from 'vitest';
import { RNG, normal, lognormal, gamma, beta, poisson, binomial } from './rng.js';

describe('RNG and Samplers', () => {
  it('is deterministic', () => {
    const rng1 = new RNG(42);
    const rng2 = new RNG(42);
    expect(rng1.next()).toBe(rng2.next());
    expect(rng1.next()).toBe(rng2.next());
  });

  it('split produces different streams', () => {
    const root = new RNG(42);
    const split1 = root.split(1);
    const split2 = root.split(2);
    
    // Values should differ from each other and from the root continuing
    const r1 = split1.next();
    const r2 = split2.next();
    const rr = root.next();

    expect(r1).not.toBe(r2);
    expect(r1).not.toBe(rr);
  });

  it('normal distribution moments (N=100k)', () => {
    const rng = new RNG(100);
    const N = 100000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < N; i++) {
      const v = normal(rng, 10, 2);
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / N;
    const variance = (sumSq / N) - (mean * mean);
    
    expect(mean).toBeCloseTo(10, 1);
    expect(Math.sqrt(variance)).toBeCloseTo(2, 1);
  });

  it('gamma distribution moments (N=100k)', () => {
    const rng = new RNG(101);
    const N = 100000;
    const alpha = 2.5; // Mean = alpha, Var = alpha
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < N; i++) {
      const v = gamma(rng, alpha);
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / N;
    const variance = (sumSq / N) - (mean * mean);
    
    expect(mean).toBeCloseTo(alpha, 1);
    expect(variance).toBeCloseTo(alpha, 1);
  });

  it('beta distribution moments (N=100k)', () => {
    const rng = new RNG(102);
    const N = 100000;
    const alpha = 2;
    const b = 5;
    // Mean = alpha / (alpha + b) = 2/7 = 0.2857
    // Var = (alpha * b) / ((alpha + b)^2 * (alpha + b + 1)) = 10 / (49 * 8) = 10 / 392 = 0.0255
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < N; i++) {
      const v = beta(rng, alpha, b);
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / N;
    const variance = (sumSq / N) - (mean * mean);
    
    expect(mean).toBeCloseTo(2 / 7, 2);
    expect(variance).toBeCloseTo(0.0255, 2);
  });

  it('lognormal distribution (N=10k)', () => {
    const rng = new RNG(103);
    const N = 10000;
    const mu = 0;
    const sigma = 1;
    // Mean = exp(mu + sigma^2/2) = exp(0.5) ≈ 1.648
    let sum = 0;
    for (let i = 0; i < N; i++) {
      sum += lognormal(rng, mu, sigma);
    }
    expect(sum / N).toBeCloseTo(1.648, 1);
  });

  it('poisson distribution (N=10k)', () => {
    const rng = new RNG(104);
    const N = 10000;
    const lambda = 4;
    let sum = 0;
    for (let i = 0; i < N; i++) {
      sum += poisson(rng, lambda);
    }
    expect(sum / N).toBeCloseTo(lambda, 1);
  });

  it('binomial distribution (N=10k)', () => {
    const rng = new RNG(105);
    const N = 10000;
    const n = 10;
    const p = 0.3;
    let sum = 0;
    for (let i = 0; i < N; i++) {
      sum += binomial(rng, n, p);
    }
    expect(sum / N).toBeCloseTo(n * p, 1);
  });
});
