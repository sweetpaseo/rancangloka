-- ============================================================================
-- Migration: 0009_publication_publisher.sql
-- Description: Deterministic Scheduled Publication Execution Engine (PUBLICATION-2)
-- Semantics:
--   1. Strict separation of states:
--      - articles.status: 'draft' | 'published' | 'scheduled' (article lifecycle)
--      - article_publication_plans.plan_status: 'PLANNED' | 'SUPERSEDED' | 'CANCELLED' | 'BLOCKED' (planning lifecycle)
--      - article_publication_executions.execution_status: 'SCHEDULED' | 'CLAIMED' | 'PUBLISHING' | 'PUBLISHED' | 'RETRY_WAIT' | 'FAILED' | 'CANCELLED' | 'BLOCKED' (execution lifecycle)
--   2. Exactly-Once & Concurrency Control:
--      - Unique constraint per plan_id in executions.
--      - Partial unique index on active execution per article.
--      - Atomic lease acquisition via compare-and-set.
--      - Immutable cryptographic publication receipts.
--   3. Auditability:
--      - Attempt logs per execution.
--      - Run summary telemetry.
-- Safety: Additive only. Preserves all existing tables, columns, indexes, and data.
-- ============================================================================

-- 1. Table: article_publication_executions
-- Manages the active dispatch and lease lifecycle of publication tasks.
CREATE TABLE IF NOT EXISTS article_publication_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL UNIQUE,                  -- E.g. 'pexec_8f3a9b1c2d3e'
    plan_id TEXT NOT NULL UNIQUE,                       -- Strictly 1 execution per plan
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    
    -- Cryptographic Invariants from Plan Snapshot
    content_hash TEXT NOT NULL,
    featured_asset_id TEXT NOT NULL,
    
    -- Publication Window Assignment (UTC)
    target_publish_at DATETIME NOT NULL,
    
    -- Execution State Machine
    execution_status TEXT NOT NULL DEFAULT 'SCHEDULED',
    
    -- Concurrency Lease Fields
    claimed_by_worker TEXT,
    lease_expires_at DATETIME,
    
    -- Retry & Failure Tracking
    attempts_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_retry_at DATETIME,
    last_error_class TEXT,                              -- 'RETRYABLE' | 'TERMINAL' | 'SAFETY_BLOCK'
    last_error_reason TEXT,                             -- Machine-readable reason code
    
    -- Provenance & Timing
    publisher_version TEXT NOT NULL DEFAULT '1.0.0',
    actual_published_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (plan_id) REFERENCES article_publication_plans(plan_id) ON DELETE CASCADE,
    CHECK (execution_status IN ('SCHEDULED', 'CLAIMED', 'PUBLISHING', 'PUBLISHED', 'RETRY_WAIT', 'FAILED', 'CANCELLED', 'BLOCKED'))
);

-- Index for due execution queries (UTC time comparison)
CREATE INDEX IF NOT EXISTS idx_pub_executions_due 
ON article_publication_executions(execution_status, target_publish_at)
WHERE execution_status IN ('SCHEDULED', 'RETRY_WAIT');

-- Index for article lookups
CREATE INDEX IF NOT EXISTS idx_pub_executions_article 
ON article_publication_executions(article_id, execution_status);

-- Partial Unique Index: Exactly ONE active execution per article at any time
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_execution_per_article 
ON article_publication_executions(article_id) 
WHERE execution_status IN ('SCHEDULED', 'CLAIMED', 'PUBLISHING', 'RETRY_WAIT');


-- 2. Table: publication_execution_receipts
-- Immutable cryptographic audit trail of completed publications
CREATE TABLE IF NOT EXISTS publication_execution_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id TEXT NOT NULL UNIQUE,                    -- E.g. 'rcpt_7a8b9c0d1e2f'
    execution_id TEXT NOT NULL UNIQUE REFERENCES article_publication_executions(execution_id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    
    -- Canonical Verification Data
    slug TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    featured_asset_id TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    
    -- Timestamp Verification
    target_publish_at DATETIME NOT NULL,
    actual_published_at DATETIME NOT NULL,
    
    -- Engine Provenance
    publisher_version TEXT NOT NULL DEFAULT '1.0.0',
    planner_version TEXT NOT NULL DEFAULT '1.0.0',
    attempts_count INTEGER NOT NULL DEFAULT 1,
    outcome TEXT NOT NULL DEFAULT 'SUCCESS',
    
    -- Telemetry Details
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (outcome IN ('SUCCESS', 'FAILED', 'ABORTED'))
);

CREATE INDEX IF NOT EXISTS idx_pub_receipts_article 
ON publication_execution_receipts(article_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pub_receipts_plan 
ON publication_execution_receipts(plan_id);


-- 3. Table: publication_execution_attempts
-- Fine-grained log of every claim and dispatch attempt
CREATE TABLE IF NOT EXISTS publication_execution_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL REFERENCES article_publication_executions(execution_id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    claimed_by_worker TEXT,
    outcome TEXT NOT NULL,                              -- 'SUCCESS' | 'RETRYABLE_ERROR' | 'TERMINAL_ERROR' | 'BLOCKED'
    error_class TEXT,
    reason_code TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (outcome IN ('SUCCESS', 'RETRYABLE_ERROR', 'TERMINAL_ERROR', 'BLOCKED'))
);

CREATE INDEX IF NOT EXISTS idx_pub_attempts_exec 
ON publication_execution_attempts(execution_id, created_at DESC);


-- 4. Table: publication_publisher_runs
-- Batch execution run telemetry and metrics
CREATE TABLE IF NOT EXISTS publication_publisher_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    publisher_run_id TEXT NOT NULL UNIQUE,              -- E.g. 'prun_pub2_0a1b2c3d'
    trigger_source TEXT NOT NULL,                       -- 'cron' | 'manual' | 'api'
    due_count INTEGER NOT NULL DEFAULT 0,
    claimed_count INTEGER NOT NULL DEFAULT 0,
    published_count INTEGER NOT NULL DEFAULT 0,
    retry_count INTEGER NOT NULL DEFAULT 0,
    blocked_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    executions_json TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pub_runs_created 
ON publication_publisher_runs(created_at DESC);
