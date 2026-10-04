-- Brings the schema in line with ARCHITECTURE §7 (ADR-017): CHECK constraints, integer seed, plain bigint job_id,
-- composite primary keys, and the 'emergence' scenario (ADR-013).
-- daily_stats depends on events.job_id, so it is dropped here and recreated by migrate.ts right after.
DROP MATERIALIZED VIEW IF EXISTS daily_stats;
--> statement-breakpoint
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_baseline_of_campaigns_id_fk";
--> statement-breakpoint
DROP INDEX "allocations_pk";--> statement-breakpoint
DROP INDEX "daily_summaries_pk";--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "seed" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "job_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "job_id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "events_job_id_seq";--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_pkey" PRIMARY KEY("campaign_id","day","category","publisher_id");--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_pkey" PRIMARY KEY("campaign_id","day");--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_baseline_of_campaigns_id_fk" FOREIGN KEY ("baseline_of") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_campaign_idx" ON "jobs" USING btree ("campaign_id");--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_budget_check" CHECK ("allocations"."budget" >= 0);--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_daily_budget_check" CHECK ("campaigns"."daily_budget" > 0);--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_days_check" CHECK ("campaigns"."days" BETWEEN 1 AND 90);--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_policy_check" CHECK ("campaigns"."policy" IN ('thompson', 'equal', 'greedy', 'oracle'));--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_scenario_check" CHECK ("campaigns"."scenario" IN ('stationary', 'drift', 'emergence'));--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_current_day_check" CHECK ("campaigns"."current_day" BETWEEN 0 AND "campaigns"."days");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_type_check" CHECK ("events"."type" IN ('click', 'apply'));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_cost_check" CHECK ("events"."cost" >= 0);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_category_check" CHECK ("jobs"."category" IN ('software', 'sales', 'healthcare', 'logistics'));