-- ============================================================================
-- Migration: 0006_media_jobs_queue.sql
-- Description: LokaMedia Extension Queue & Device Authentication Schema (MEDIA-1)
-- Semantics:
--   1. media_jobs tracks pending image jobs for draft articles.
--   2. media_jobs.status lifecycle:
--      'PENDING', 'IN_PROGRESS', 'READY_TO_UPLOAD', 'UPLOADING', 'ATTACHED', 'FAILED', 'SKIPPED'.
--   3. Relational integrity: CASCADE on article deletion.
--   4. media_devices stores dedicated LokaMedia device enrollment tokens.
-- Safety: Additive only. Preserves all existing tables, columns, indexes, and data.
-- Scope: D1 Staging Draft (IMAGE enabled; VIDEO reserved).
-- ============================================================================

-- 1. Table: media_jobs
-- Queues and tracks visual generation jobs for draft articles
CREATE TABLE IF NOT EXISTS media_jobs (
    job_id TEXT PRIMARY KEY,                         -- Canonical identifier: mjob_<uuid-or-id>
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    article_slug TEXT NOT NULL,
    article_title TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'featured',           -- 'featured' | 'inline'
    slot_key TEXT NOT NULL DEFAULT 'primary',        -- 'primary' | 'inline_1' | 'inline_2'
    media_type TEXT NOT NULL DEFAULT 'image',        -- 'image' (video reserved)
    prompt TEXT NOT NULL,                            -- Visual prompt generated for operator
    alt_text TEXT NOT NULL,                          -- Pre-calculated SEO alt text
    aspect_ratio TEXT NOT NULL DEFAULT '16:9',       -- '16:9' | '4:3' | '1:1'
    target_width INTEGER NOT NULL DEFAULT 1200,
    target_height INTEGER NOT NULL DEFAULT 675,
    status TEXT NOT NULL DEFAULT 'PENDING',          -- Lifecycle state
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Role validation
    CHECK (role IN ('featured', 'inline')),

    -- Media Type validation (Image only for Media-1, video reserved)
    CHECK (media_type IN ('image', 'video')),

    -- Media Job Lifecycle States
    CHECK (status IN (
        'PENDING',
        'IN_PROGRESS',
        'READY_TO_UPLOAD',
        'UPLOADING',
        'ATTACHED',
        'FAILED',
        'SKIPPED'
    ))
);

-- Indices for fast queue filtering and lookups
CREATE INDEX IF NOT EXISTS idx_media_jobs_status ON media_jobs(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_media_jobs_article_id ON media_jobs(article_id);
CREATE INDEX IF NOT EXISTS idx_media_jobs_article_slug ON media_jobs(article_slug);

-- 2. Table: media_devices
-- Enrolls authorized LokaMedia Extension devices with least-privilege tokens
CREATE TABLE IF NOT EXISTS media_devices (
    device_id TEXT PRIMARY KEY,                      -- dev_chr_<unique-id>
    device_name TEXT NOT NULL,                       -- e.g. "Editor Chrome Extension"
    token_hash TEXT NOT NULL,                        -- SHA-256 hash of device secret token
    scope TEXT NOT NULL DEFAULT 'media:device',      -- Enforces media:read + media:upload + media:attach
    status TEXT NOT NULL DEFAULT 'ACTIVE',           -- 'ACTIVE' | 'REVOKED'
    last_used_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (status IN ('ACTIVE', 'REVOKED'))
);

CREATE INDEX IF NOT EXISTS idx_media_devices_status ON media_devices(status);
