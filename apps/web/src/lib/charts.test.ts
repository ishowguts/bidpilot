import { describe, it, expect } from 'vitest';
import type { DailyStat } from '@bidpilot/shared';
import { cpaSeries, cumulativeApplies, publisherKeys, shareSeries, spendSeries } from './charts';

function row(day: number, publisherId: number, x: Partial<DailyStat>): DailyStat {
  return {
    day,
    date: `2026-10-0${day}`,
    publisherId,
    clicks: 0,
    applies: 0,
    spend: 0,
    cpa: null,
    cpa7d: null,
    spendShare: null,
    budget: 0,
    pBest: null,
    ...x,
  };
}

// Rows arrive ordered by day; the shaping must not depend on it.
const campaign = [
  row(2, 1, { spend: 300, budget: 600, applies: 3, cpa7d: 80 }),
  row(1, 1, { spend: 200, budget: 250, applies: 2, cpa7d: 100 }),
  row(1, 2, { spend: 100, budget: 750, applies: 0, cpa7d: null }),
  row(2, 2, { spend: 150, budget: 400, applies: 1, cpa7d: 250 }),
];
const baseline = [row(1, 1, { applies: 1 }), row(2, 1, { applies: 2 }), row(2, 2, { applies: 1 })];

describe('dashboard series', () => {
  it('spend per day against the daily budget', () => {
    expect(spendSeries(campaign, 1000)).toEqual([
      { day: 1, spend: 300, budget: 1000 },
      { day: 2, spend: 450, budget: 1000 },
    ]);
  });

  it('7-day CPA per publisher keeps nulls as gaps', () => {
    expect(cpaSeries(campaign)).toEqual([
      { day: 1, 'pub-a': 100, 'pub-b': null },
      { day: 2, 'pub-a': 80, 'pub-b': 250 },
    ]);
    expect(publisherKeys(campaign)).toEqual(['pub-a', 'pub-b']);
  });

  it('budget shares sum to 1 per day', () => {
    expect(shareSeries(campaign)).toEqual([
      { day: 1, 'pub-a': 0.25, 'pub-b': 0.75 },
      { day: 2, 'pub-a': 0.6, 'pub-b': 0.4 },
    ]);
  });

  it('cumulative applies for the campaign and its baseline', () => {
    expect(cumulativeApplies(campaign, baseline)).toEqual([
      { day: 1, campaign: 2, baseline: 1 },
      { day: 2, campaign: 6, baseline: 4 },
    ]);
    expect(cumulativeApplies(campaign, null)).toEqual([
      { day: 1, campaign: 2, baseline: null },
      { day: 2, campaign: 6, baseline: null },
    ]);
  });
});
