-- ============================================================================
-- Migration: 0010_publication_feedback.sql
-- Description: Post-Publication Crawl, Index & Telemetry Feedback Layer (PUBLICATION-3)
-- Semantics:
--   1. Strict separation of states:
--      - articles.status: 'draft' | 'published' | 'scheduled' (article lifecycle)
--      - article_publication_executions.execution_status (execution lifecycle)
--      - publication_feedback_snapshots.index_status: 'UNKNOWN' | 'NOT_INDEXED' | 'INDEXED' (authoritative index state)
--      - publication_feedback_aggregates.health_regime: 'UNKNOWN' | 'STALE' | 'PARTIAL' | 'HEALTHY' | 'DEGRADED'
--   2. Strict Feedback Semantics:
--      - HTTP 200 DOES NOT imply INDEXED.
--      - Sitemap presence DOES NOT imply INDEXED.
--      - Missing authoritative source MUST evaluate index_status to 'UNKNOWN'.
--      - Measured index latency requires BOTH valid published_at AND authoritative first_indexed_at.
--   3. Provenance & History:
--      - Observations are append-only; prior records are never overwritten when state changes.
--      - Source authority, observed_at, and raw payload are immutably preserved.
-- Safety: Additive only. Preserves all existing tables, columns, indexes, and data.
-- ============================================================================

-- 1. Table: publication_observations
-- Immutable, append-only log of discrete observations from all telemetry sources
CREATE TABLE IF NOT EXISTS publication_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    observation_id TEXT NOT NULL UNIQUE,                -- E.g. 'obs_8f3a9b1c2d3e'
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    receipt_id TEXT REFERENCES publication_execution_receipts(receipt_id),
    canonical_url TEXT NOT NULL,
    
    -- Source Identification & Provenance
    source_class TEXT NOT NULL,                         -- 'FIRST_PARTY_RUNTIME' | 'SITEMAP_PARSER' | 'SEARCH_CONSOLE' | 'ANALYTICS' | 'MANUAL_OPERATOR' | 'FUTURE_ADAPTER'
    source_name TEXT NOT NULL,                          -- E.g. 'edge_probe', 'gsc_inspection_api', 'sitemap_crawler'
    observation_type TEXT NOT NULL,                     -- 'EDGE_STATUS' | 'SITEMAP_PRESENT' | 'INDEX_STATUS' | 'SEARCH_IMPRESSIONS'
    
    -- Observed Data & State
    status_value TEXT NOT NULL,                         -- E.g. 'HTTP_200', 'PRESENT', 'INDEXED', 'NOT_INDEXED', 'UNKNOWN'
    metric_value REAL,                                  -- Numeric metric if applicable (e.g. latency ms, impressions)
    confidence_class TEXT NOT NULL,                     -- 'AUTHORITATIVE' | 'DIRECT_PROBE' | 'HEURISTIC'
    reason_code TEXT,                                   -- Reason code or error string
    raw_payload_json TEXT,                              -- Structured raw response for auditability
    dedup_hash TEXT NOT NULL,                           -- SHA256(article_id + source_name + observation_type + status_value + date(observed_at))
    
    -- Temporal Provenance
    observed_at DATETIME NOT NULL,                      -- Time observation occurred
    source_timestamp DATETIME,                          -- External timestamp from provider if provided
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (source_class IN ('FIRST_PARTY_RUNTIME', 'SITEMAP_PARSER', 'SEARCH_CONSOLE', 'ANALYTICS', 'MANUAL_OPERATOR', 'FUTURE_ADAPTER')),
    CHECK (confidence_class IN ('AUTHORITATIVE', 'DIRECT_PROBE', 'HEURISTIC'))
);

CREATE INDEX IF NOT EXISTS idx_obs_article_type ON publication_observations(article_id, observation_type);
CREATE INDEX IF NOT EXISTS idx_obs_observed_at ON publication_observations(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_source ON publication_observations(source_class, observation_type);
CREATE INDEX IF NOT EXISTS idx_obs_dedup ON publication_observations(dedup_hash);

-- 2. Table: publication_feedback_snapshots
-- Latest resolved point-in-time state per article based on deterministic precedence
CREATE TABLE IF NOT EXISTS publication_feedback_snapshots (
    article_id INTEGER PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
    receipt_id TEXT REFERENCES publication_execution_receipts(receipt_id),
    canonical_url TEXT NOT NULL,
    
    -- Discovery & Sitemap State
    in_sitemap INTEGER NOT NULL DEFAULT 0,              -- 0 = NO, 1 = YES
    in_news_sitemap INTEGER NOT NULL DEFAULT 0,         -- 0 = NO, 1 = YES
    last_sitemap_check_at DATETIME,
    
    -- Edge Response State
    edge_http_status INTEGER,                           -- 200, 404, 500, etc.
    canonical_matches INTEGER NOT NULL DEFAULT 0,       -- 0 = NO, 1 = YES
    robots_indexable INTEGER NOT NULL DEFAULT 1,        -- 0 = NO, 1 = YES
    last_edge_probe_at DATETIME,
    
    -- Authoritative Index State
    index_status TEXT NOT NULL DEFAULT 'UNKNOWN',       -- 'INDEXED' | 'NOT_INDEXED' | 'UNKNOWN'
    first_indexed_at DATETIME,                          -- First authoritative index observation
    index_latency_hours REAL,                           -- (first_indexed_at - published_at) / 3600
    index_source TEXT,                                  -- Provider asserting status
    last_index_check_at DATETIME,
    
    -- Resolution Metadata
    has_conflicts INTEGER NOT NULL DEFAULT 0,
    conflict_notes TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (index_status IN ('INDEXED', 'NOT_INDEXED', 'UNKNOWN'))
);

CREATE INDEX IF NOT EXISTS idx_snap_index_status ON publication_feedback_snapshots(index_status);
CREATE INDEX IF NOT EXISTS idx_snap_edge_status ON publication_feedback_snapshots(edge_http_status);

-- 3. Table: publication_feedback_aggregates
-- Rolling cohort health aggregates directly supplying IndexHealthSignals to PUBLICATION-1
CREATE TABLE IF NOT EXISTS publication_feedback_aggregates (
    aggregate_id TEXT PRIMARY KEY,                       -- E.g. 'agg_m87v32h1'
    window_start DATETIME NOT NULL,
    window_end DATETIME NOT NULL,
    evaluated_at DATETIME NOT NULL,
    
    -- Cohort Statistics
    cohort_sample_size INTEGER NOT NULL,                -- Articles evaluated in window
    observation_coverage_ratio REAL NOT NULL,           -- Ratio with fresh observations (0.0 - 1.0)
    
    -- Indexation Metrics
    articles_indexed_count INTEGER NOT NULL,
    articles_not_indexed_count INTEGER NOT NULL,
    articles_unknown_count INTEGER NOT NULL,
    indexing_success_ratio REAL,                        -- indexed / (indexed + not_indexed), null if no authoritative data
    median_index_latency_hours REAL,                    -- Median latency of indexed articles
    
    -- Crawl & Site Health Metrics
    sitemap_coverage_ratio REAL NOT NULL,               -- in_sitemap / cohort_sample_size
    sitemap_last_verified_at DATETIME,
    recent_5xx_rate REAL NOT NULL DEFAULT 0.0,
    canonical_mismatch_rate REAL NOT NULL DEFAULT 0.0,
    publication_error_rate REAL NOT NULL DEFAULT 0.0,
    
    -- Synthesized Signals & Recommendation
    health_regime TEXT NOT NULL,                        -- 'UNKNOWN' | 'STALE' | 'PARTIAL' | 'HEALTHY' | 'DEGRADED'
    planner_recommendation TEXT NOT NULL,               -- 'HOLD' | 'INCREASE_ONE_STEP' | 'DECREASE_ONE_STEP' | 'PAUSE_GROWTH'
    signals_payload_json TEXT NOT NULL,                 -- Serialized IndexHealthSignals matching PUBLICATION-1 contract
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (health_regime IN ('UNKNOWN', 'STALE', 'PARTIAL', 'HEALTHY', 'DEGRADED')),
    CHECK (planner_recommendation IN ('HOLD', 'INCREASE_ONE_STEP', 'DECREASE_ONE_STEP', 'PAUSE_GROWTH'))
);

CREATE INDEX IF NOT EXISTS idx_agg_evaluated_at ON publication_feedback_aggregates(evaluated_at DESC);

-- 4. Table: publication_feedback_runs
-- Concurrency locking and execution audit log
CREATE TABLE IF NOT EXISTS publication_feedback_runs (
    run_id TEXT PRIMARY KEY,                             -- E.g. 'fbrun_99v2'
    trigger_source TEXT NOT NULL,                       -- 'manual' | 'test' | 'cron'
    actor TEXT NOT NULL,
    locked_until DATETIME,                              -- Concurrency mutual exclusion lease
    run_status TEXT NOT NULL DEFAULT 'RUNNING',         -- 'RUNNING' | 'COMPLETED' | 'FAILED'
    
    articles_evaluated INTEGER NOT NULL DEFAULT 0,
    observations_recorded INTEGER NOT NULL DEFAULT 0,
    unchanged_count INTEGER NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0,
    
    aggregate_id TEXT REFERENCES publication_feedback_aggregates(aggregate_id),
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    details_json TEXT,

    CHECK (run_status IN ('RUNNING', 'COMPLETED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_fbrun_started_at ON publication_feedback_runs(started_at DESC);
