-- ==============================================================================
-- Migration 0011: Automation Safety, Circuit Breakers, and Run Ledger
-- Milestone: SOAK-0
--
-- Tables:
-- 1. automation_control: Single-row enum mode controller and emergency kill switch.
-- 2. circuit_breakers: State machine tracking for cascading failure prevention.
-- 3. circuit_breaker_events: Auditable transition event ledger for circuit breakers.
--
-- View:
-- 4. v_publication_run_ledger: Correlated read model across all 5 operational phases.
-- ==============================================================================

-- 1. Automation Control Table (Single-row pattern id=1)
CREATE TABLE IF NOT EXISTS automation_control (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    mode TEXT NOT NULL DEFAULT 'OFF',
    kill_switch_engaged INTEGER NOT NULL DEFAULT 0,
    kill_reason TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT NOT NULL DEFAULT 'system_default',
    CHECK (mode IN ('OFF', 'OBSERVE_ONLY', 'PLAN_ONLY', 'CONTROLLED', 'UNATTENDED'))
);

-- Seed default safe row if missing
INSERT OR IGNORE INTO automation_control (id, mode, kill_switch_engaged, kill_reason, updated_at, updated_by)
VALUES (1, 'OFF', 0, NULL, CURRENT_TIMESTAMP, 'system_init');

-- 2. Circuit Breakers Table
CREATE TABLE IF NOT EXISTS circuit_breakers (
    id TEXT PRIMARY KEY,
    state TEXT NOT NULL DEFAULT 'CLOSED',
    failure_count INTEGER NOT NULL DEFAULT 0,
    failure_threshold INTEGER NOT NULL DEFAULT 3,
    last_failure_at DATETIME,
    last_state_change_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trip_reason TEXT,
    probe_success_count INTEGER NOT NULL DEFAULT 0,
    probe_required_successes INTEGER NOT NULL DEFAULT 2,
    CHECK (state IN ('CLOSED', 'OPEN', 'HALF_OPEN'))
);

-- Seed default publisher and database breakers
INSERT OR IGNORE INTO circuit_breakers (id, state, failure_count, failure_threshold, last_state_change_at, probe_required_successes)
VALUES 
    ('global_publisher', 'CLOSED', 0, 3, CURRENT_TIMESTAMP, 2),
    ('d1_database', 'CLOSED', 0, 2, CURRENT_TIMESTAMP, 2);

-- 3. Circuit Breaker Transition Events
CREATE TABLE IF NOT EXISTS circuit_breaker_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    breaker_id TEXT NOT NULL,
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor TEXT NOT NULL DEFAULT 'system',
    FOREIGN KEY (breaker_id) REFERENCES circuit_breakers(id)
);

CREATE INDEX IF NOT EXISTS idx_circuit_breaker_events_breaker 
ON circuit_breaker_events(breaker_id, created_at DESC);

-- 4. Consolidated Run Ledger Observability View
CREATE VIEW IF NOT EXISTS v_publication_run_ledger AS
SELECT 
    a.id as d1_article_id,
    a.slug as article_slug,
    a.status as article_status,
    COALESCE(air.job_id, CAST(a.id AS TEXT)) as correlation_id,
    air.source_article_id as ingest_request_id,
    air.job_id as ingest_receipt_id,
    apr.id as readiness_snapshot_id,
    apr.overall_status as readiness_status,
    aea.id as editorial_approval_id,
    app.plan_id as plan_id,
    app.target_publish_at as planned_target_time,
    pe.execution_id as execution_id,
    pe.execution_status as execution_status,
    pr.receipt_id as publication_receipt_id,
    pr.actual_published_at as actual_published_at,
    pfs.index_status as authoritative_index_state
FROM articles a
LEFT JOIN article_ingest_receipts air ON a.id = air.article_id
LEFT JOIN article_publication_readiness apr ON a.id = apr.article_id
LEFT JOIN article_editorial_approvals aea ON a.id = aea.article_id
LEFT JOIN article_publication_plans app ON a.id = app.article_id
LEFT JOIN article_publication_executions pe ON app.plan_id = pe.plan_id
LEFT JOIN publication_execution_receipts pr ON pe.execution_id = pr.execution_id
LEFT JOIN publication_feedback_snapshots pfs ON a.id = pfs.article_id;
