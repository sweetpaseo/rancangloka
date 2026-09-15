-- ============================================================================
-- Migration: 0013_lokamedia_durable_jobs.sql
-- Description: LokaMedia Phase 2A - Durable Media Job Model
-- Safety: local/non-production foundation. Rebuilds media_jobs to replace the
--         old CHECK constraint with the canonical single lifecycle state.
-- ============================================================================

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS media_jobs_v2 (
    job_id TEXT PRIMARY KEY,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    article_slug TEXT NOT NULL,
    article_title TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'featured',
    slot_key TEXT NOT NULL DEFAULT 'featured',
    sequence INTEGER NOT NULL DEFAULT 0,
    media_type TEXT NOT NULL DEFAULT 'image',
    prompt TEXT NOT NULL,
    prompt_version INTEGER NOT NULL DEFAULT 1,
    prompt_hash TEXT NOT NULL DEFAULT '',
    alt_text TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL DEFAULT '16:9',
    target_width INTEGER NOT NULL DEFAULT 1200,
    target_height INTEGER NOT NULL DEFAULT 675,
    required_for_readiness INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'QUEUED',
    lease_owner TEXT,
    lease_expires_at DATETIME,
    heartbeat_at DATETIME,
    attempt INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_retry_at DATETIME,
    last_error_code TEXT,
    last_error_message_safe TEXT,
    idempotency_key TEXT,
    submitted_at DATETIME,
    completed_at DATETIME,
    job_revision INTEGER NOT NULL DEFAULT 1,
    superseded_by_job_id TEXT REFERENCES media_jobs_v2(job_id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (role IN ('featured', 'inline')),
    CHECK (slot_key GLOB '[a-z][a-z0-9_]*'),
    CHECK (media_type IN ('image', 'video')),
    CHECK (required_for_readiness IN (0, 1)),
    CHECK (priority IN (100, 200, 300)),
    CHECK (attempt >= 0),
    CHECK (max_attempts >= 1),
    CHECK (job_revision >= 1),
    CHECK (status IN (
        'QUEUED',
        'LEASED',
        'PROMPT_PREPARING',
        'PROMPT_READY',
        'PROMPT_SENDING',
        'PROMPT_ACKNOWLEDGED',
        'GENERATING',
        'IMAGE_DETECTED',
        'CAPTURING',
        'CAPTURED',
        'UPLOAD_QUEUED',
        'UPLOADING',
        'UPLOAD_RECEIVED',
        'ATTACHING',
        'ATTACHMENT_CONFIRMED',
        'COMPLETE',
        'WAITING_RETRY',
        'RECOVERING',
        'AUTH_REQUIRED',
        'PROVIDER_BLOCKED',
        'USER_ACTION_REQUIRED',
        'FAILED_TERMINAL',
        'SUPERSEDED',
        'CANCELLED'
    ))
);

INSERT OR IGNORE INTO media_jobs_v2 (
    job_id, article_id, article_slug, article_title, role, slot_key, sequence,
    media_type, prompt, prompt_version, prompt_hash, alt_text, aspect_ratio,
    target_width, target_height, required_for_readiness, priority, status,
    attempt, max_attempts, created_at, updated_at
)
SELECT
    job_id,
    article_id,
    article_slug,
    article_title,
    role,
    CASE WHEN slot_key = 'primary' THEN 'featured' ELSE slot_key END,
    0,
    media_type,
    prompt,
    1,
    '',
    alt_text,
    aspect_ratio,
    target_width,
    target_height,
    CASE WHEN role = 'featured' THEN 1 ELSE 0 END,
    100,
    CASE status
      WHEN 'PENDING' THEN 'QUEUED'
      WHEN 'IN_PROGRESS' THEN 'LEASED'
      WHEN 'READY_TO_UPLOAD' THEN 'UPLOAD_QUEUED'
      WHEN 'UPLOADING' THEN 'UPLOADING'
      WHEN 'ATTACHED' THEN 'COMPLETE'
      WHEN 'FAILED' THEN 'FAILED_TERMINAL'
      WHEN 'SKIPPED' THEN 'CANCELLED'
      ELSE 'QUEUED'
    END,
    0,
    3,
    created_at,
    updated_at
FROM media_jobs;

DROP TABLE media_jobs;
ALTER TABLE media_jobs_v2 RENAME TO media_jobs;

CREATE INDEX IF NOT EXISTS idx_media_jobs_status_priority_retry
ON media_jobs(status, priority DESC, next_retry_at, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_media_jobs_article_slot
ON media_jobs(article_id, slot_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_jobs_lease
ON media_jobs(status, lease_expires_at, heartbeat_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_jobs_one_active_slot
ON media_jobs(article_id, slot_key)
WHERE status NOT IN ('COMPLETE', 'FAILED_TERMINAL', 'SUPERSEDED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS media_job_receipts (
    receipt_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES media_jobs(job_id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL,
    receipt_type TEXT NOT NULL,
    asset_id TEXT REFERENCES media_assets(asset_id) ON DELETE SET NULL,
    article_media_id INTEGER REFERENCES article_media(id) ON DELETE SET NULL,
    sha256 TEXT,
    safe_payload_json TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (receipt_type IN (
        'UPLOAD_ACCEPTED',
        'ASSET_EXISTS',
        'UPLOAD_RECEIVED',
        'ATTACHMENT_CONFIRMED',
        'REJECTED',
        'RETRYABLE_ERROR',
        'TERMINAL_ERROR'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_job_receipts_idempotency
ON media_job_receipts(job_id, idempotency_key, receipt_type);

CREATE INDEX IF NOT EXISTS idx_media_job_receipts_job
ON media_job_receipts(job_id, created_at DESC);

CREATE TABLE IF NOT EXISTS media_job_events (
    event_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES media_jobs(job_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    stage TEXT NOT NULL,
    attempt INTEGER NOT NULL DEFAULT 0,
    safe_payload_json TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (attempt >= 0),
    CHECK (event_type IN (
        'JOB_PROGRESS',
        'GENERATION_STARTED',
        'IMAGE_DETECTED',
        'CAPTURE_STARTED',
        'CAPTURED',
        'UPLOAD_STARTED',
        'UPLOAD_PROGRESS',
        'UPLOAD_RECEIVED',
        'ATTACHMENT_CONFIRMED',
        'JOB_COMPLETE',
        'JOB_RECOVERING',
        'JOB_FAILED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_media_job_events_job
ON media_job_events(job_id, created_at ASC);

PRAGMA foreign_keys = ON;
