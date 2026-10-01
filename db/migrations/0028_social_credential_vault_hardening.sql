-- Migration: 0028_social_credential_vault_hardening.sql
-- Milestone: SOCIAL-S3.5B — Credential Vault Cryptographic & Concurrency Hardening
-- Description: Adds separate nonces for access and refresh tokens, and enforces single active credential via partial unique index.

-- 1. Add dedicated access_token_nonce and refresh_token_nonce columns
ALTER TABLE social_provider_credentials ADD COLUMN access_token_nonce TEXT;
ALTER TABLE social_provider_credentials ADD COLUMN refresh_token_nonce TEXT;

-- 2. Populate access_token_nonce from existing encryption_nonce for existing rows
UPDATE social_provider_credentials 
SET access_token_nonce = encryption_nonce 
WHERE access_token_nonce IS NULL;

-- 3. Enforce strictly ONE active credential per (connection_id, provider) via partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_active_credential 
ON social_provider_credentials (connection_id, provider) 
WHERE revoked_at IS NULL;
