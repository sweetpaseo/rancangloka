-- Migration: 0039_lokabridge_studio_orchestrator.sql
-- Milestone: LOKABRIDGE-STUDIO-V1 (Durable Server-Side Import Orchestrator & Studio Workstation)

-- 1. Table: bridge_import_jobs
-- Tracks asynchronous multi-pipeline editorial import jobs
CREATE TABLE IF NOT EXISTS bridge_import_jobs (
  job_id TEXT PRIMARY KEY,                           -- e.g. 'job_bimport_1795508000000_a1b2c'
  production_id TEXT NOT NULL,                       -- Session identifier linking draft iterations
  article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL UNIQUE,              -- Idempotent submission key
  payload_hash TEXT NOT NULL,                        -- SHA-256 of complete article package
  revision INTEGER NOT NULL DEFAULT 1,               -- Package revision number
  overall_status TEXT NOT NULL CHECK (
    overall_status IN (
      'STAGING',
      'ACCEPTED',
      'QUEUED',
      'RUNNING',
      'RETRY_WAIT',
      'NEEDS_ATTENTION',
      'COMPLETE',
      'FAILED',
      'CANCELLED'
    )
  ),
  pipeline_states TEXT NOT NULL,                     -- JSON: { content, seo, media, evidence, internal_linking, schedule_intent, final_assembly, integrity_verification }
  raw_package_json TEXT NOT NULL,                    -- Immutable raw package payload
  asset_manifest_json TEXT,                          -- Staged assets manifest
  schedule_intent_json TEXT,                         -- Schedule intent (date, time WIB, slot)
  validation_results_json TEXT,                      -- Preflight & Gate A evaluation results
  reader_preview_url TEXT,                           -- Signed HMAC Reader Preview URL
  error_details TEXT,                                -- Persisted failure reasons / stack traces
  device_id TEXT NOT NULL,                           -- Authenticated device identifier
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_bimport_jobs_prod_id ON bridge_import_jobs(production_id);
CREATE INDEX IF NOT EXISTS idx_bimport_jobs_idempotency ON bridge_import_jobs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_bimport_jobs_status ON bridge_import_jobs(overall_status);
CREATE INDEX IF NOT EXISTS idx_bimport_jobs_article_id ON bridge_import_jobs(article_id);
CREATE INDEX IF NOT EXISTS idx_bimport_jobs_created_at ON bridge_import_jobs(created_at);

-- 2. Table: bridge_asset_jobs
-- Independent tracking and retry accounting for per-slot visual assets
CREATE TABLE IF NOT EXISTS bridge_asset_jobs (
  id TEXT PRIMARY KEY,                               -- e.g. 'asstjob_1795508000000_v1'
  job_id TEXT NOT NULL REFERENCES bridge_import_jobs(job_id) ON DELETE CASCADE,
  visual_id TEXT NOT NULL,                           -- e.g. 'cover_hero', 'inline_1'
  role TEXT NOT NULL,                                -- 'cover_hero' | 'inline' | 'diagram'
  placement_anchor TEXT,                             -- Heading / paragraph anchor in markdown
  original_filename TEXT,
  original_mime TEXT,
  original_size INTEGER,
  original_hash TEXT,
  status TEXT NOT NULL CHECK (
    status IN (
      'PENDING',
      'UPLOADING',
      'PROCESSING',
      'OPTIMIZED',
      'FAILED',
      'RETRY_WAIT'
    )
  ),
  optimized_url TEXT,                                -- Public/derivatives URL
  r2_key TEXT,                                       -- Stored R2 asset key
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_basset_jobs_job_id ON bridge_asset_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_basset_jobs_visual_id ON bridge_asset_jobs(visual_id);
CREATE INDEX IF NOT EXISTS idx_basset_jobs_status ON bridge_asset_jobs(status);
