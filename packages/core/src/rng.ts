// Seeded random streams and samplers (ARCHITECTURE §6.1).
//
// Every stream is a pure-rand xoroshiro128+ generator whose 128-bit state is derived by hashing the whole stream
// key (for example `env, seed, day, hour, category, publisher`) with splitmix64. Distinct keys give unrelated
// states, so streams do not collide across seeds, days or arms, and the same key always gives the same stream.
import { xoroshiro128plus, type RandomGenerator } from 'pure-rand';

const MASK64 = (1n << 64n) - 1n;
const GOLDEN = 0x9e3779b97f4a7c15n;

/** splitmix64 finalizer: a bijective 64-bit mix with good avalanche. */
function mix64(z: bigint): bigint {
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
  return z ^ (z >> 31n);
}

export type StreamKeyPart = string | number;

/** Hashes a key tuple to 64 bits. Type tags and lengths keep `[1, 'a']`, `['1a']` and `[1]` apart. */
function hashKey(key: readonly StreamKeyPart[]): bigint {
  let h = mix64(BigInt(key.length) + GOLDEN);
  const absorb = (x: bigint): void => {
    h = mix64((h + GOLDEN + x) & MASK64);
  };
  for (const part of key) {
    if (typeof part === 'number') {
      if (!Number.isSafeInteger(part)) throw new Error(`stream key part must be a safe integer, got ${part}`);
      absorb(1n);
      absorb(BigInt.asUintN(64, BigInt(part)));
    } else {
      absorb(2n);
      absorb(BigInt(part.length));
      for (let i = 0; i < part.length; i++) absorb(BigInt(part.charCodeAt(i)));
    }
  }
  return h;
}

/** A mutable stream of uniform numbers. Not shared between callers: each owns its stream. */
export class Rng {
  private readonly gen: RandomGenerator;

  constructor(gen: RandomGenerator) {
    this.gen = gen;
  }

  /** Uniform in [0, 1) with 53 bits of precision, built from the high bits of two outputs. */
  next(): number {
    const hi = this.gen.unsafeNext() >>> 5; // 27 bits
    const lo = this.gen.unsafeNext() >>> 6; // 26 bits
    return (hi * 67108864 + lo) / 9007199254740992;
  }
}

/** Creates the stream for a key tuple. Same key, same stream; different keys, independent streams. */
export function stream(...key: StreamKeyPart[]): Rng {
  let s = hashKey(key);
  const words: number[] = [];
  for (let i = 0; i < 2; i++) {
    s = (s + GOLDEN) & MASK64;
    const z = mix64(s);
    words.push(Number(BigInt.asIntN(32, z >> 32n)), Number(BigInt.asIntN(32, z)));
  }
  // xoroshiro128+ must not start from the all-zero state; splitmix64 outputs make that practically impossible,
  // but guard anyway.
  if (!words.some((w) => w !== 0)) words[3] = 1;
  return new Rng(xoroshiro128plus.fromState(words));
}

/** Environment stream: traffic and noise for one arm in one hour. Identical for every policy (common random numbers). */
export function envStream(seed: number, day: number, hour: number, category: string, publisher: number): Rng {
  return stream('env', seed, day, hour, category, publisher);
}

/** Daily environment noise for one arm (CPC and apply-rate multipliers). Shared by every policy. */
export function envDayStream(seed: number, day: number, category: string, publisher: number): Rng {
  return stream('env-day', seed, day, category, publisher);
}

/** Policy stream: randomness used by a policy's decisions on one day. */
export function policyStream(seed: number, policy: string, day: number): Rng {
  return stream('policy', seed, policy, day);
}

// ── Samplers ──────────────────────────────────────────────────────────────────

/** Uniform in (0, 1): never returns 0, so it is safe inside log() and pow(·, 1/a). */
function openUniform(rng: Rng): number {
  let u = rng.next();
  while (u === 0) u = rng.next();
  return u;
}

/** Normal(mean, sd) via the Box-Muller transform. */
export function normal(rng: Rng, mean = 0, sd = 1): number {
  const u1 = openUniform(rng);
  const u2 = rng.next();
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** exp(Normal(mu, sigma)). */
export function lognormal(rng: Rng, mu: number, sigma: number): number {
  return Math.exp(normal(rng, mu, sigma));
}

/** Gamma(shape, 1) by Marsaglia-Tsang; shape < 1 uses Gamma(shape + 1) · U^(1/shape). */
export function gamma(rng: Rng, shape: number): number {
  if (!(shape > 0)) throw new Error(`gamma shape must be > 0, got ${shape}`);
  if (shape < 1) return gamma(rng, shape + 1) * Math.pow(openUniform(rng), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = normal(rng);
    const v0 = 1 + c * x;
    if (v0 <= 0) continue;
    const v = v0 * v0 * v0;
    const u = openUniform(rng);
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Beta(a, b) as X / (X + Y) with X ~ Gamma(a), Y ~ Gamma(b). */
export function beta(rng: Rng, a: number, b: number): number {
  const x = gamma(rng, a);
  const y = gamma(rng, b);
  return x / (x + y);
}

/**
 * Binomial(n, p), exact. Large n is reduced by Knuth's beta splitting (TAOCP 3.4.1): the a-th order statistic of
 * n uniforms is Beta(a, n + 1 - a), which tells how many of the n trials fall below p in one draw. The remaining
 * small n is summed directly.
 */
export function binomial(rng: Rng, n: number, p: number): number {
  if (!Number.isInteger(n) || n < 0) throw new Error(`binomial n must be a non-negative integer, got ${n}`);
  if (!(p >= 0 && p <= 1)) throw new Error(`binomial p must be in [0, 1], got ${p}`);
  let k = 0;
  while (n > 40 && p > 0 && p < 1) {
    const a = 1 + Math.floor(n / 2);
    const b = n + 1 - a;
    const x = beta(rng, a, b);
    if (x >= p) {
      n = a - 1;
      p = p / x;
    } else {
      k += a;
      n = b - 1;
      p = (p - x) / (1 - x);
    }
  }
  if (p <= 0) return k;
  if (p >= 1) return k + n;
  for (let i = 0; i < n; i++) if (rng.next() < p) k++;
  return k;
}

/**
 * Poisson(lambda), exact. Large lambda is reduced with gamma waiting times (Knuth, TAOCP 3.4.1); the rest uses
 * the multiplication method.
 */
export function poisson(rng: Rng, lambda: number): number {
  if (!(lambda >= 0)) throw new Error(`poisson lambda must be >= 0, got ${lambda}`);
  let k = 0;
  while (lambda > 30) {
    const m = Math.floor(lambda * 0.875);
    const x = gamma(rng, m);
    if (x >= lambda) return k + binomial(rng, m - 1, lambda / x);
    k += m;
    lambda -= x;
  }
  const limit = Math.exp(-lambda);
  let prod = rng.next();
  while (prod > limit) {
    k++;
    prod *= rng.next();
  }
  return k;
}
