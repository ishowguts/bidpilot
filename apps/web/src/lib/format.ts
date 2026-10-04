const inrFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const intFormat = new Intl.NumberFormat('en-IN');

/** ₹ amount without paise, Indian digit grouping; an em dash for null. */
export const inr = (x: number | null | undefined): string => (x == null ? '—' : inrFormat.format(x));

export const int = (x: number): string => intFormat.format(x);

/** 0.1234 → "12.3%". */
export const pct = (x: number | null | undefined, digits = 1): string =>
  x == null ? '—' : `${(x * 100).toFixed(digits)}%`;

/** Signed percentage for values already in percent: -14.6 → "−14.6%". */
export const signedPct = (x: number | null | undefined): string =>
  x == null ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(1)}%`;

export const PUBLISHER_NAMES: Record<number, string> = {
  1: 'pub-a',
  2: 'pub-b',
  3: 'pub-c',
  4: 'pub-d',
  5: 'pub-e',
  6: 'pub-f',
};
