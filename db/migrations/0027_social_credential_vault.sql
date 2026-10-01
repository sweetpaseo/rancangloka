-- Migration: 0027_social_credential_vault.sql
-- Milestone: SOCIAL-S3.5A — Secure OAuth Credential Vault & Token Persistence Hardening
-- Description: Dedicated encrypted credential vault for social provider OAuth tokens.
-- INVARIANT: No plaintext token column. All encrypted_* columns store authenticated AES-GCM ciphertext only.

CREATE TABLE IF NOT EXISTS social_provider_credentials (
    credential_id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    auth_mode TEXT NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT,
    encryption_nonce TEXT NOT NULL,
    encryption_key_version TEXT NOT NULL,
    token_type TEXT NOT NULL DEFAULT 'BEARER',
    expires_at TEXT,
    scope_snapshot TEXT,
    provider_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_social_provider_credentials_conn 
ON social_provider_credentials (connection_id, provider, revoked_at);

CREATE INDEX IF NOT EXISTS idx_social_provider_credentials_prov_user 
ON social_provider_credentials (provider, provider_user_id);
