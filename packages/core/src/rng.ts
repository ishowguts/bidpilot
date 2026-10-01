// PCG implementation or a simple seeded LCG/Xorshift.
// Ponytail says: simplest seeded RNG that is fast and passes tests.
// Mulberry32 is 32-bit, fast, simple, good enough for simulation.

export class RNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  // Returns a float between [0, 1)
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  split(seedOffset: number): RNG {
    // Generate a new seed from the current stream combined with the offset
    const childSeed = (this.state ^ seedOffset) >>> 0;
    const child = new RNG(childSeed);
    // Burn a few draws to decouple the streams
    child.next();
    child.next();
    return child;
  }
}

// ── Samplers ──────────────────────────────────────────────────────────────────

// Box-Muller transform for normal distribution
export function normal(rng: RNG, mean: number, stdDev: number): number {
  const u1 = Math.max(Number.MIN_VALUE, rng.next());
  const u2 = rng.next();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z * stdDev + mean;
}

export function lognormal(rng: RNG, mean: number, stdDev: number): number {
  return Math.exp(normal(rng, mean, stdDev));
}

// Marsaglia and Tsang’s method for Gamma(alpha, 1)
// For beta, we only need scale = 1.
export function gamma(rng: RNG, alpha: number): number {
  if (alpha < 1.0) {
    // Ahrens-Dieter acceptance-rejection method for alpha < 1
    // Simplest version: gamma(alpha) = gamma(alpha + 1) * U^(1/alpha)
    return gamma(rng, alpha + 1.0) * Math.pow(rng.next(), 1.0 / alpha);
  }

  const d = alpha - 1.0 / 3.0;
  const c = 1.0 / Math.sqrt(9.0 * d);
  while (true) {
    const x = normal(rng, 0, 1);
    const v = 1.0 + c * x;
    if (v <= 0) continue;

    const v3 = v * v * v;
    const u = rng.next();

    if (u < 1.0 - 0.0331 * x * x * x * x) return d * v3;
    if (Math.log(u) < 0.5 * x * x + d * (1.0 - v3 + Math.log(v3))) return d * v3;
  }
}

// Beta distribution via two Gammas
export function beta(rng: RNG, alpha: number, beta_param: number): number {
  const x = gamma(rng, alpha);
  const y = gamma(rng, beta_param);
  if (x + y === 0) return 0; // prevent NaN
  return x / (x + y);
}

// Knuth's algorithm for Poisson
export function poisson(rng: RNG, lambda: number): number {
  // Ponytail: for very large lambda, we should approximate with normal, but let's assume lambda is reasonable.
  if (lambda > 500) {
     return Math.max(0, Math.round(normal(rng, lambda, Math.sqrt(lambda))));
  }
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1.0;
  do {
    k++;
    p *= rng.next();
  } while (p > L);
  return k - 1;
}

// Simplest binomial (naive O(n) coin flips).
// Ponytail: if n is too large, use normal approx.
export function binomial(rng: RNG, n: number, p: number): number {
  if (n > 100) {
    const mean = n * p;
    const variance = n * p * (1 - p);
    return Math.max(0, Math.min(n, Math.round(normal(rng, mean, Math.sqrt(variance)))));
  }
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (rng.next() < p) k++;
  }
  return k;
}
