-- ============================================================================
-- Migration: 0030_discovery_provider_settings.sql
-- Milestone: ADMIN-BRAVE-SEARCH-SETTINGS-1
-- Description: Encrypted discovery provider settings and administrative audit log.
-- Invariants:
--   1. Plaintext secrets are strictly prohibited from this table.
--   2. encrypted_secret stores AES-256-GCM ciphertext in Base64 only.
--   3. nonce stores 12-byte initialization vector in Base64.
--   4. Default enabled is 0 (OFF).
-- ============================================================================

CREATE TABLE IF NOT EXISTS discovery_provider_settings (
    provider TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    encrypted_secret TEXT,
    nonce TEXT,
    secret_version TEXT NOT NULL DEFAULT 'RANCANGLOKA_SETTINGS_KEK_V1',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS discovery_settings_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    result TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_discovery_settings_audit_action
ON discovery_settings_audit (action, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_discovery_settings_audit_provider
ON discovery_settings_audit (provider, timestamp DESC);
