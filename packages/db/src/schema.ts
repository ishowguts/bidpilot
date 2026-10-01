import { pgTable, smallserial, text, uuid, numeric, smallint, date, bigserial, timestamp, index, uniqueIndex, jsonb, real, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── Publishers ──────────────────────────────────────────────────────────────────

export const publishers = pgTable('publishers', {
  id: smallserial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
});

// ── Campaigns ───────────────────────────────────────────────────────────────────

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  dailyBudget: numeric('daily_budget', { precision: 12, scale: 2 }).notNull(),
  days: smallint('days').notNull(),
  startDate: date('start_date').notNull(),
  targetCpa: numeric('target_cpa', { precision: 10, scale: 2 }),
  policy: text('policy').notNull(),
  scenario: text('scenario').notNull(),
  seed: smallint('seed').notNull(),
  baselineOf: uuid('baseline_of').references((): AnyPgColumn => campaigns.id),
  currentDay: smallint('current_day').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Jobs ────────────────────────────────────────────────────────────────────────

export const jobs = pgTable('jobs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  category: text('category').notNull(),
});

// ── Allocations ─────────────────────────────────────────────────────────────────

export const allocations = pgTable('allocations', {
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  day: date('day').notNull(),
  category: text('category').notNull(),
  publisherId: smallint('publisher_id').notNull().references(() => publishers.id),
  budget: numeric('budget', { precision: 12, scale: 2 }).notNull(),
  pBest: real('p_best'),
  alpha: real('alpha'),
  beta: real('beta'),
  cpcEstimate: numeric('cpc_estimate', { precision: 10, scale: 4 }),
}, (table) => [
  // Composite primary key via unique index (Drizzle does not have a built-in composite PK helper for pgTable)
  uniqueIndex('allocations_pk').on(table.campaignId, table.day, table.category, table.publisherId),
]);

// ── Events ──────────────────────────────────────────────────────────────────────

export const events = pgTable('events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  jobId: bigserial('job_id', { mode: 'number' }).notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  publisherId: smallint('publisher_id').notNull().references(() => publishers.id),
  type: text('type').notNull(),
  cost: numeric('cost', { precision: 10, scale: 4 }).notNull().default('0'),
  ts: timestamp('ts', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('events_campaign_ts_idx').on(table.campaignId, table.ts),
]);

// ── Daily summaries (stretch, B19) ──────────────────────────────────────────────

export const dailySummaries = pgTable('daily_summaries', {
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  day: date('day').notNull(),
  numbers: jsonb('numbers').notNull(),
  text: text('text').notNull(),
  model: text('model').notNull(),
}, (table) => [
  uniqueIndex('daily_summaries_pk').on(table.campaignId, table.day),
]);
