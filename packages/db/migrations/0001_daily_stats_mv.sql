-- Raw SQL migration for the daily_stats materialized view.
-- Drizzle does not manage materialized views, so this is a manual migration.

CREATE MATERIALIZED VIEW IF NOT EXISTS daily_stats AS
SELECT e.campaign_id,
       (e.ts AT TIME ZONE 'Asia/Kolkata')::date        AS day,
       j.category,
       e.publisher_id,
       count(*) FILTER (WHERE e.type = 'click')        AS clicks,
       count(*) FILTER (WHERE e.type = 'apply')        AS applies,
       coalesce(sum(e.cost), 0)                        AS spend
FROM events e JOIN jobs j ON j.id = e.job_id
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX IF NOT EXISTS daily_stats_pk
  ON daily_stats (campaign_id, day, category, publisher_id);
