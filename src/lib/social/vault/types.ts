/**
 * RancangLoka — Secure OAuth Credential Vault Types
 * Milestone: SOCIAL-S3.5A
 * 
 * INVARIANT: Plaintext credentials must never be persisted.
 * Authenticated AES-GCM ciphertext only in D1 database.
 */

export interface EncryptedCredentialRecord {
  credential_id: string;
  connection_id: string;
  provider: string; // e.g. 'META'
  auth_mode: string; // e.g. 'FACEBOOK_LOGIN' | 'INSTAGRAM_LOGIN'
  encrypted_access_token: string; // Base64 AES-GCM ciphertext + tag
  encrypted_refresh_token: string | null;
  encryption_nonce: string; // Base64 12-byte IV
  encryption_key_version: string; // e.g. 'META_CREDENTIAL_KEK_V1'
  token_type: string; // e.g. 'BEARER'
  expires_at: string | null; // ISO 8601 string
  scope_snapshot: string | null; // JSON array string
  provider_user_id: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
}

export interface StoreCredentialParams {
  connectionId: string;
  provider: string;
  authMode: string;
  accessToken: string; // Plaintext token to be encrypted immediately
  refreshToken?: string | null;
  keyVersion?: string; // Defaults to 'META_CREDENTIAL_KEK_V1'
  tokenType?: string; // Defaults to 'BEARER'
  expiresInSeconds?: number | null;
  expiresAt?: string | null;
  scopes?: string[];
  providerUserId?: string | null;
}

export interface DecryptedCredential {
  credentialId: string;
  connectionId: string;
  provider: string;
  authMode: string;
  accessToken: string; // Plaintext token (JUST-IN-TIME USE ONLY)
  refreshToken: string | null;
  tokenType: string;
  expiresAt: string | null;
  isExpired: boolean;
  scopeSnapshot: string[];
  keyVersion: string;
}

export interface CredentialMetadata {
  credentialId: string;
  connectionId: string;
  provider: string;
  authMode: string;
  hasCredential: boolean;
  tokenType: string;
  expiresAt: string | null;
  isExpired: boolean;
  scopeSnapshot: string[];
  providerUserId: string | null;
  keyVersion: string;
  status: 'VALID' | 'EXPIRED' | 'REVOKED' | 'NOT_FOUND';
  createdAt: string;
  updatedAt: string;
}

export type KeyEncryptionKeyResolver = (
  version: string
) => Promise<Uint8Array | string | null> | Uint8Array | string | null;
