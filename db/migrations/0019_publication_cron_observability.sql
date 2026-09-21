-- ============================================================================
-- Migration: 0019_publication_cron_observability.sql
-- Description: Phase 5L10 - Publication Automation Cron Heartbeat & Observability
-- Safety: Additive only. Creates publication_cron_runs table and indexes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS publication_cron_runs (
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
        'publication_dispatcher'
    )),

    CHECK (status IN (
        'STARTED',
        'SUCCEEDED',
        'BLOCKED',
        'FAILED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_job_created 
ON publication_cron_runs(job_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_runs_status_created 
ON publication_cron_runs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_runs_created 
ON publication_cron_runs(created_at DESC);
