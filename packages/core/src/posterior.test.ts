import { describe, it, expect } from 'vitest';
import { capacityEstimate, cpcEstimate, emptyPosterior, updatePosterior, type DayEvidence } from './posterior.js';

const evidence = (clicks: number, applies: number, spend: number, budget = spend): DayEvidence => ({
  clicks,
  applies,
  spend,
  budget,
});

describe('discounted posterior', () => {
  it('applies γ once per day, then adds the day’s counts (§6.2)', () => {
    const day1 = updatePosterior(emptyPosterior(), 1, evidence(100, 10, 1000), 0.9);
    expect(day1.alpha).toBeCloseTo(11, 12);
    expect(day1.beta).toBeCloseTo(91, 12);
    const day2 = updatePosterior(day1, 2, evidence(50, 5, 500), 0.9);
    expect(day2.alpha).toBeCloseTo(1 + 0.9 * 10 + 5, 12);
    expect(day2.beta).toBeCloseTo(1 + 0.9 * 90 + 45, 12);
    expect(day2.spend).toBeCloseTo(0.9 * 1000 + 500, 12);
    expect(day2.clicks).toBeCloseTo(0.9 * 100 + 50, 12);
  });

  it('a skipped day still ages old evidence, exactly like a day with no clicks', () => {
    const day1 = updatePosterior(emptyPosterior(), 1, evidence(100, 10, 1000), 0.9);
    const skipped = updatePosterior(day1, 3, evidence(20, 2, 200), 0.9);
    const stepped = updatePosterior(updatePosterior(day1, 2, undefined, 0.9), 3, evidence(20, 2, 200), 0.9);
    expect(skipped.alpha).toBeCloseTo(stepped.alpha, 12);
    expect(skipped.beta).toBeCloseTo(stepped.beta, 12);
    expect(skipped.alpha).toBeCloseTo(1 + 0.81 * 10 + 2, 12);
  });

  it('γ = 1 keeps plain counts', () => {
    let state = emptyPosterior();
    for (let day = 1; day <= 10; day++) state = updatePosterior(state, day, evidence(30, 3, 300), 1);
    expect(state.alpha).toBe(31);
    expect(state.beta).toBe(271);
  });

  it('rejects days that do not increase and impossible counts', () => {
    const day2 = updatePosterior(emptyPosterior(), 2, evidence(10, 1, 100), 0.95);
    expect(() => updatePosterior(day2, 2, evidence(10, 1, 100), 0.95)).toThrow();
    expect(() => updatePosterior(day2, 3, evidence(1, 2, 10), 0.95)).toThrow();
    expect(() => updatePosterior(day2, 3, undefined, 0)).toThrow();
  });

  it('uses the category mean CPC until 20 clicks, then the discounted mean', () => {
    const few = updatePosterior(emptyPosterior(), 1, evidence(10, 1, 300), 0.95);
    expect(cpcEstimate(few, 12)).toBe(12);
    const enough = updatePosterior(few, 2, evidence(10, 1, 100), 0.95);
    expect(cpcEstimate(enough, 12)).toBeCloseTo((0.95 * 300 + 100) / (0.95 * 10 + 10), 12);
  });

  it('estimates capacity only from capacity-limited days', () => {
    const fullSpend = updatePosterior(emptyPosterior(), 1, evidence(100, 5, 1000, 1000), 0.95);
    expect(capacityEstimate(fullSpend)).toBeUndefined();
    // Two clicks' worth unspent is rounding, not a capacity limit.
    const rounding = updatePosterior(fullSpend, 2, evidence(5, 0, 50, 70), 0.95);
    expect(capacityEstimate(rounding)).toBeUndefined();
    const limited = updatePosterior(rounding, 3, evidence(80, 4, 800, 2000), 0.95);
    expect(capacityEstimate(limited)).toBe(80);
  });
});
