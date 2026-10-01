-- ============================================================================
-- Migration: 0026_social_domain_and_outbox.sql
-- Description: Social Media Automation Core Domain, Staging Outbox & Immutable Receipts (SOCIAL-S1)
-- Semantics:
--   1. Strict Source Provenance:
--      - social_campaigns originates strictly from an immutable publication_execution_receipts record (outcome = 'SUCCESS').
--      - 1-to-1 mapping via UNIQUE constraint on source_receipt_id (prevents duplicate campaigns per web publication).
--   2. Multi-Platform Variant Model:
--      - social_post_variants models platform-specific tailoring (caption, aspect ratio, media assets).
--      - Partial unique index on (campaign_id, platform_id) prevents duplicate active variants.
--   3. Cryptographic Approval Boundary:
--      - social_variant_approvals ties human approval to the SHA-256 payload_hash.
--      - Any material mutation to caption or media invalidates prior approvals.
--   4. Staging Outbox (Compare-and-Set Concurrency Ready):
--      - social_staging_outbox manages leasing, attempts, retry classification, and scheduled windows.
--      - In SOCIAL-S1, SOCIAL_AUTOMATION = OFF guarantees zero executable dispatch.
--   5. Immutable Execution Receipts:
--      - social_execution_receipts stores permanent audit trail of external publication outcomes.
-- Safety: 100% Additive. No drops, no alters, zero impact on existing tables or routes.
-- Zero Secret Invariant: No OAuth tokens, refresh tokens, or app secrets are stored in these tables.
-- ============================================================================

-- 1. Table: social_campaigns
-- Binds distribution lifecycle to a single canonical published web article
CREATE TABLE IF NOT EXISTS social_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id TEXT NOT NULL UNIQUE,                       -- E.g. 'scamp_9f8e7d6c5b4a'
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    source_receipt_id TEXT NOT NULL UNIQUE REFERENCES publication_execution_receipts(receipt_id) ON DELETE RESTRICT,
    slug TEXT NOT NULL,
    content_hash TEXT NOT NULL,                             -- Provenance hash from publication receipt
    canonical_url TEXT NOT NULL,
    campaign_status TEXT NOT NULL DEFAULT 'DRAFT',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (campaign_status IN (
        'DRAFT', 'PREPARING', 'READY_FOR_QA', 'QA_REVIEW', 
        'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PROCESSING', 
        'COMPLETED', 'BLOCKED', 'CANCELLED', 'UNKNOWN'
    ))
);

CREATE INDEX IF NOT EXISTS idx_social_campaigns_article 
ON social_campaigns(article_id);

CREATE INDEX IF NOT EXISTS idx_social_campaigns_status 
ON social_campaigns(campaign_status);

CREATE INDEX IF NOT EXISTS idx_social_campaigns_source_receipt 
ON social_campaigns(source_receipt_id);


-- 2. Table: social_post_variants
-- Platform-specific content representations (Facebook, Instagram, etc.)
CREATE TABLE IF NOT EXISTS social_post_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    variant_id TEXT NOT NULL UNIQUE,                        -- E.g. 'spvar_1a2b3c4d5e6f'
    campaign_id TEXT NOT NULL REFERENCES social_campaigns(campaign_id) ON DELETE CASCADE,
    platform_id TEXT NOT NULL,                              -- 'facebook_page' | 'instagram_business' | 'tiktok' | 'x' | etc.
    variant_type TEXT NOT NULL DEFAULT 'FEED_POST',         -- 'FEED_POST' | 'CAROUSEL' | 'REEL_SHORT' | 'THREAD'
    caption_text TEXT NOT NULL,
    caption_hash TEXT NOT NULL,                             -- SHA-256 of normalized caption_text
    media_asset_ids_json TEXT NOT NULL DEFAULT '[]',        -- JSON array of referenced media_assets(asset_id)
    media_aspect_ratio TEXT NOT NULL DEFAULT '1:1',         -- '1:1' | '4:5' | '9:16' | '16:9'
    payload_hash TEXT NOT NULL,                             -- SHA-256 of (platform_id + caption_hash + media_asset_ids + aspect_ratio)
    variant_status TEXT NOT NULL DEFAULT 'DRAFT',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (variant_status IN (
        'DRAFT', 'PREPARING', 'READY_FOR_QA', 'QA_REVIEW', 
        'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PUBLISHING', 
        'PUBLISHED', 'RETRY_WAIT', 'FAILED', 'BLOCKED', 'CANCELLED', 'UNKNOWN'
    )),
    CHECK (media_aspect_ratio IN ('1:1', '4:5', '9:16', '16:9')),
    CHECK (variant_type IN ('FEED_POST', 'CAROUSEL', 'REEL_SHORT', 'THREAD'))
);

CREATE INDEX IF NOT EXISTS idx_social_variants_campaign 
ON social_post_variants(campaign_id);

CREATE INDEX IF NOT EXISTS idx_social_variants_status 
ON social_post_variants(variant_status);

-- Partial Unique Index: Exactly ONE active variant per platform per campaign
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_variant_per_campaign_platform 
ON social_post_variants(campaign_id, platform_id) 
WHERE variant_status NOT IN ('CANCELLED', 'FAILED');


-- 3. Table: social_variant_approvals
-- Explicit, auditable human sign-offs cryptographically tied to payload_hash
CREATE TABLE IF NOT EXISTS social_variant_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    approval_id TEXT NOT NULL UNIQUE,                       -- E.g. 'sappr_3c4d5e6f7a8b'
    variant_id TEXT NOT NULL REFERENCES social_post_variants(variant_id) ON DELETE CASCADE,
    approved_by TEXT NOT NULL,                              -- Operator username / authenticated email
    approved_role TEXT NOT NULL DEFAULT 'social_lead',      -- 'social_lead' | 'managing_editor' | 'editor_in_chief'
    approval_status TEXT NOT NULL DEFAULT 'APPROVED',       -- 'APPROVED' | 'REJECTED' | 'REVOKED'
    approved_payload_hash TEXT NOT NULL,                    -- Must match variant.payload_hash at approval time
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (approval_status IN ('APPROVED', 'REJECTED', 'REVOKED'))
);

CREATE INDEX IF NOT EXISTS idx_social_approvals_variant_status 
ON social_variant_approvals(variant_id, approval_status);

CREATE INDEX IF NOT EXISTS idx_social_approvals_created_at 
ON social_variant_approvals(created_at DESC);


-- 4. Table: social_staging_outbox
-- Staging and scheduled release outbox with compare-and-set concurrency controls
CREATE TABLE IF NOT EXISTS social_staging_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outbox_id TEXT NOT NULL UNIQUE,                         -- E.g. 'sout_5e6f7a8b9c0d'
    variant_id TEXT NOT NULL UNIQUE REFERENCES social_post_variants(variant_id) ON DELETE CASCADE,
    campaign_id TEXT NOT NULL REFERENCES social_campaigns(campaign_id) ON DELETE CASCADE,
    platform_id TEXT NOT NULL,
    approved_payload_hash TEXT NOT NULL,                    -- Validated snapshot hash from approval
    target_publish_at DATETIME NOT NULL,
    outbox_status TEXT NOT NULL DEFAULT 'STAGED',
    claimed_by_worker TEXT,
    lease_expires_at DATETIME,
    attempts_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_retry_at DATETIME,
    last_error_class TEXT,                                  -- 'RETRYABLE' | 'TERMINAL' | 'SAFETY_BLOCK'
    last_error_reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (outbox_status IN (
        'STAGED', 'CLAIMED', 'PUBLISHING', 'PUBLISHED', 
        'RETRY_WAIT', 'FAILED', 'BLOCKED', 'CANCELLED'
    )),
    CHECK (last_error_class IS NULL OR last_error_class IN ('RETRYABLE', 'TERMINAL', 'SAFETY_BLOCK'))
);

CREATE INDEX IF NOT EXISTS idx_social_outbox_due 
ON social_staging_outbox(outbox_status, target_publish_at) 
WHERE outbox_status IN ('STAGED', 'RETRY_WAIT');

CREATE INDEX IF NOT EXISTS idx_social_outbox_campaign 
ON social_staging_outbox(campaign_id);

CREATE INDEX IF NOT EXISTS idx_social_outbox_variant 
ON social_staging_outbox(variant_id);


-- 5. Table: social_execution_receipts
-- Immutable cryptographic audit trail of external platform publication outcomes
CREATE TABLE IF NOT EXISTS social_execution_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id TEXT NOT NULL UNIQUE,                        -- E.g. 'srec_7a8b9c0d1e2f'
    outbox_id TEXT NOT NULL UNIQUE REFERENCES social_staging_outbox(outbox_id) ON DELETE CASCADE,
    variant_id TEXT NOT NULL REFERENCES social_post_variants(variant_id) ON DELETE CASCADE,
    campaign_id TEXT NOT NULL REFERENCES social_campaigns(campaign_id) ON DELETE CASCADE,
    platform_id TEXT NOT NULL,
    approved_payload_hash TEXT NOT NULL,
    platform_post_id TEXT,                                  -- ID returned by external provider API
    platform_permalink TEXT,                                -- Public permalink to the post on platform
    target_publish_at DATETIME NOT NULL,
    actual_published_at DATETIME NOT NULL,
    outcome TEXT NOT NULL DEFAULT 'SUCCESS',                -- 'SUCCESS' | 'FAILED'
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (outcome IN ('SUCCESS', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_social_receipts_variant 
ON social_execution_receipts(variant_id);

CREATE INDEX IF NOT EXISTS idx_social_receipts_campaign 
ON social_execution_receipts(campaign_id);

CREATE INDEX IF NOT EXISTS idx_social_receipts_platform 
ON social_execution_receipts(platform_id);
