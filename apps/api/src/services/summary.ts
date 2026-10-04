// LLM daily summary (ARCHITECTURE §12): numbers from SQL in, one short paragraph out, and every figure in the
// paragraph must come from those numbers. Anything else falls back to a template built from the same numbers.
import { and, eq } from 'drizzle-orm';
import { campaigns, dailySummaries, type DbExecutor } from '@bidpilot/db';
import {
  modelSummarySchema,
  summaryNumbersSchema,
  type DailySummary,
  type SummaryNumbers,
} from '@bidpilot/shared';
import { HttpError } from '../middleware/errors.js';
import { unfence, type LlmClient } from '../llm.js';
import { dateOfDay } from './campaigns.js';
import { dailyStats } from './stats.js';

const PUBLISHER_NAMES = ['pub-a', 'pub-b', 'pub-c', 'pub-d', 'pub-e', 'pub-f'];
const round1 = (x: number): number => Math.round(x * 10) / 10;

/** The day's numbers, rounded to the precision the model is given (whole rupees, shares to 0.1 point). */
export async function summaryNumbers(db: DbExecutor, id: string, day: number): Promise<SummaryNumbers> {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  if (!row) throw new HttpError('NOT_FOUND', `campaign ${id} not found`);
  if (day > row.currentDay) throw new HttpError('NOT_FOUND', `day ${day} has not been simulated yet`);
  const stats = await dailyStats(db, id);
  const today = stats.filter((s) => s.day === day);
  const yesterday = stats.filter((s) => s.day === day - 1);
  const shares = (rows: typeof stats) => {
    const total = rows.reduce((s, r) => s + r.budget, 0);
    return new Map(rows.map((r) => [r.publisherId, total > 0 ? (100 * r.budget) / total : 0]));
  };
  const todayShares = shares(today);
  const yesterdayShares = day > 1 ? shares(yesterday) : null;
  const spend = today.reduce((s, r) => s + r.spend, 0);
  const applies = today.reduce((s, r) => s + r.applies, 0);
  return {
    day,
    date: dateOfDay(row.startDate, day),
    budget: Math.round(Number(row.dailyBudget)),
    spend: Math.round(spend),
    applies,
    cpa: applies > 0 ? Math.round(spend / applies) : null,
    publishers: today.map((r) => {
      const share = todayShares.get(r.publisherId)!;
      return {
        publisher: PUBLISHER_NAMES[r.publisherId - 1] ?? `pub-${r.publisherId}`,
        spend: Math.round(r.spend),
        applies: r.applies,
        cpa: r.cpa === null ? null : Math.round(r.cpa),
        budgetSharePct: round1(share),
        shareChangePts: yesterdayShares ? round1(share - (yesterdayShares.get(r.publisherId) ?? 0)) : null,
      };
    }),
  };
}

/** Every number written in `text` (digits with optional thousands commas and decimals, sign dropped). */
export function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, '')));
}

/**
 * The grounding check: returns the numbers in `text` that do not appear anywhere in `numbers` (as written there, or
 * their absolute value, since "fell 3.2 points" reports a change of -3.2). Empty means grounded.
 */
export function ungroundedNumbers(text: string, numbers: SummaryNumbers): number[] {
  const allowed = new Set<number>();
  const collect = (v: unknown): void => {
    if (typeof v === 'number') {
      allowed.add(v);
      allowed.add(Math.abs(v));
    } else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') Object.values(v).forEach(collect);
  };
  collect(numbers);
  // The date is a string; its parts are fine to repeat.
  numbers.date.split('-').forEach((part) => allowed.add(Number(part)));
  return numbersIn(text).filter((n) => !allowed.has(n));
}

const inr = (x: number): string => `₹${x.toLocaleString('en-IN')}`;

/** The fallback: one sentence built only from `numbers`, so it is grounded by construction. */
export function templateText(n: SummaryNumbers): string {
  const top = [...n.publishers].sort((a, b) => b.budgetSharePct - a.budgetSharePct)[0];
  const cpa = n.cpa === null ? 'no applies yet' : `CPA ${inr(n.cpa)}`;
  const lead = top ? ` ${top.publisher} had the largest budget share at ${top.budgetSharePct}%.` : '';
  return `Day ${n.day}: spent ${inr(n.spend)} of ${inr(n.budget)} for ${n.applies} applies (${cpa}).${lead}`;
}

export function summaryPrompt(numbers: SummaryNumbers): string {
  return [
    'You write the daily note on a job-ad budget dashboard. Publishers are named pub-a to pub-f.',
    'Fields: budget and spend are the day\'s rupees; applies is job applications; cpa is rupees per apply;',
    'budgetSharePct is a publisher\'s percent of the day\'s budget; shareChangePts is the change in that share',
    'since yesterday in percentage points (null on the first day, when there is no change to report).',
    'Write at most 60 words of plain English for a marketer: how the day went (spend against budget, applies,',
    'CPA), then where the budget moved (the one or two largest share changes, or the largest shares on day 1).',
    'Never mention field names, JSON or null. Use only numbers that appear in the JSON, exactly as written there;',
    'do not compute new numbers (no sums, differences, ratios or percentages of your own).',
    'Write rupee amounts like ₹12,345. Return JSON: {"text": "..."}.',
    '',
    JSON.stringify(numbers),
  ].join('\n');
}

/** Asks the model once; returns grounded text, or null with the reason. Never throws. */
export async function modelText(
  llm: LlmClient,
  numbers: SummaryNumbers,
): Promise<{ text: string | null; reason?: string }> {
  try {
    const parsed = modelSummarySchema.safeParse(
      JSON.parse(unfence(await llm.generateJson(summaryPrompt(numbers)))),
    );
    if (!parsed.success) return { text: null, reason: 'invalid output' };
    const invented = ungroundedNumbers(parsed.data.text, numbers);
    if (invented.length > 0) return { text: null, reason: `ungrounded numbers: ${invented.join(', ')}` };
    return { text: parsed.data.text };
  } catch (error) {
    return { text: null, reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * The summary for one day. A grounded model summary is stored in `daily_summaries` and served from there after;
 * the template is cheap and is never stored, so a later request can still get a model summary.
 */
export async function dailySummary(
  db: DbExecutor,
  llm: LlmClient | null,
  id: string,
  day: number,
  log: (reason: string) => void = () => {},
): Promise<DailySummary> {
  const numbers = await summaryNumbers(db, id, day);
  const [cached] = await db
    .select()
    .from(dailySummaries)
    .where(and(eq(dailySummaries.campaignId, id), eq(dailySummaries.day, numbers.date)));
  if (cached) {
    // Served with the numbers the model was given, so text and numbers always match.
    const stored = summaryNumbersSchema.parse(cached.numbers);
    return {
      day,
      date: stored.date,
      text: cached.text,
      numbers: stored,
      source: 'model',
      model: cached.model,
    };
  }

  if (llm) {
    const { text, reason } = await modelText(llm, numbers);
    if (text !== null) {
      await db
        .insert(dailySummaries)
        .values({ campaignId: id, day: numbers.date, numbers, text, model: llm.model })
        .onConflictDoNothing();
      return { day, date: numbers.date, text, numbers, source: 'model', model: llm.model };
    }
    log(`summary fell back to the template: ${reason?.slice(0, 200)}`);
  }
  return { day, date: numbers.date, text: templateText(numbers), numbers, source: 'template', model: null };
}
