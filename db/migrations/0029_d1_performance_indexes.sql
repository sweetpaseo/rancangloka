-- ============================================================================
-- Migration: 0029_d1_performance_indexes.sql
-- Description: D1 Row Read Optimization & Query Efficiency Indexes (D1-ROW-READ-HOTFIX-1)
-- Safety: Additive indexes only. Zero table alterations, zero data mutations.
-- Invariants:
--   - automation_mode = OFF
--   - AUTO_PUBLISH = OFF
--   - JEV_MODE = shadow
-- ============================================================================

-- 1. Publication cron runs: Optimize ORDER BY started_at DESC in scheduler telemetry
CREATE INDEX IF NOT EXISTS idx_cron_runs_started
ON publication_cron_runs(started_at DESC);

-- 2. Media job events: Optimize ORDER BY created_at DESC in media summary telemetry
CREATE INDEX IF NOT EXISTS idx_media_job_events_created
ON media_job_events(created_at DESC);

-- 3. Editorial approvals: Optimize WHERE approval_status = 'APPROVED' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_approvals_status_created
ON article_editorial_approvals(approval_status, created_at DESC);

-- 4. Articles: Optimize ORDER BY updated_at DESC in pipeline board & tasks
CREATE INDEX IF NOT EXISTS idx_articles_updated
ON articles(updated_at DESC);

-- 5. Media jobs: Optimize ORDER BY created_at DESC in pipeline board & tasks
CREATE INDEX IF NOT EXISTS idx_media_jobs_created
ON media_jobs(created_at DESC);

-- 6. Article ingest receipts: Optimize ORDER BY created_at DESC in outbox & editorial summaries
CREATE INDEX IF NOT EXISTS idx_ingest_receipts_created
ON article_ingest_receipts(created_at DESC);

-- 7. Social execution receipts: Optimize ORDER BY created_at DESC and WHERE outcome = 'SUCCESS'
CREATE INDEX IF NOT EXISTS idx_social_receipts_created
ON social_execution_receipts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_receipts_outcome_created
ON social_execution_receipts(outcome, created_at DESC);

-- 8. Operator actions: Optimize ORDER BY requested_at DESC for events fast-path
CREATE INDEX IF NOT EXISTS idx_mc_action_requested_desc
ON mission_control_operator_actions(requested_at DESC);
