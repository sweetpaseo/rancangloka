-- ============================================================================
-- Migration: 0022_allow_jev_shadow_collector_cron.sql
-- Description: Phase JEV-7A - Autonomous Continuous Jev Shadow Collector Observability
-- Safety: Preserves all existing rows, IDs, and indexes. Expands CHECK constraint
--         on job_name to support 'jev_shadow_collector'.
-- ============================================================================

CREATE TABLE IF NOT EXISTS publication_cron_runs_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL UNIQUE,
    job_name TEXT NOT NULL,
    trigger_source TEXT NOT NULL,
    started_at DATETIME NOT NULL,
    finished_at DATETIME,
    status TEXT NOT NULL,
    automation_mode TEXT,
    kill_switch_engaged INTEGER DEFAULT 0,
    processed_count INTEGER DEFAULT 0,
    created_count INTEGER DEFAULT 0,
    blocked_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    error_class TEXT,
    error_summary TEXT,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (job_name IN (
        'publication_planner',
        'auto_execution_reconciler',
        'publication_dispatcher',
        'jev_shadow_collector'
    )),

    CHECK (status IN (
        'STARTED',
        'SUCCEEDED',
        'BLOCKED',
        'FAILED'
    ))
);

INSERT INTO publication_cron_runs_new (
    id, run_id, job_name, trigger_source, started_at, finished_at, status,
    automation_mode, kill_switch_engaged, processed_count, created_count,
    blocked_count, failed_count, error_class, error_summary, details_json, created_at
)
SELECT 
    id, run_id, job_name, trigger_source, started_at, finished_at, status,
    automation_mode, kill_switch_engaged, processed_count, created_count,
    blocked_count, failed_count, error_class, error_summary, details_json, created_at
FROM publication_cron_runs;

DROP TABLE publication_cron_runs;

ALTER TABLE publication_cron_runs_new RENAME TO publication_cron_runs;

CREATE INDEX IF NOT EXISTS idx_cron_runs_job_created 
ON publication_cron_runs(job_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_runs_status_created 
ON publication_cron_runs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_runs_created 
ON publication_cron_runs(created_at DESC);
