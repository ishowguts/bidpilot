CREATE TABLE "allocations" (
	"campaign_id" uuid NOT NULL,
	"day" date NOT NULL,
	"category" text NOT NULL,
	"publisher_id" smallint NOT NULL,
	"budget" numeric(12, 2) NOT NULL,
	"p_best" real,
	"alpha" real,
	"beta" real,
	"cpc_estimate" numeric(10, 4)
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"daily_budget" numeric(12, 2) NOT NULL,
	"days" smallint NOT NULL,
	"start_date" date NOT NULL,
	"target_cpa" numeric(10, 2),
	"policy" text NOT NULL,
	"scenario" text NOT NULL,
	"seed" smallint NOT NULL,
	"baseline_of" uuid,
	"current_day" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_summaries" (
	"campaign_id" uuid NOT NULL,
	"day" date NOT NULL,
	"numbers" jsonb NOT NULL,
	"text" text NOT NULL,
	"model" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"campaign_id" uuid NOT NULL,
	"job_id" bigserial NOT NULL,
	"publisher_id" smallint NOT NULL,
	"type" text NOT NULL,
	"cost" numeric(10, 4) DEFAULT '0' NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publishers" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "publishers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_baseline_of_campaigns_id_fk" FOREIGN KEY ("baseline_of") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "allocations_pk" ON "allocations" USING btree ("campaign_id","day","category","publisher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_summaries_pk" ON "daily_summaries" USING btree ("campaign_id","day");--> statement-breakpoint
CREATE INDEX "events_campaign_ts_idx" ON "events" USING btree ("campaign_id","ts");