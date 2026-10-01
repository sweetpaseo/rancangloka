/**
 * RancangLoka — Secure OAuth Credential Vault Service
 * Milestone: SOCIAL-S3.5A
 * 
 * INVARIANTS:
 * 1. Plaintext tokens are NEVER stored in D1.
 * 2. Plaintext tokens are NEVER logged, rendered in HTML, or included in error objects.
 * 3. AES-256-GCM authenticated encryption with deterministic AAD.
 * 4. Just-in-time decryption strictly for authorized provider execution boundaries.
 */

import type {
  EncryptedCredentialRecord,
  StoreCredentialParams,
  DecryptedCredential,
  CredentialMetadata,
  KeyEncryptionKeyResolver,
} from './types.ts';
import {
  buildAuthenticatedContext,
  encryptToken,
  decryptToken,
} from './crypto.ts';

const DEFAULT_KEK_VERSION = 'META_CREDENTIAL_KEK_V1';

/**
 * Sanitizes any string or error to remove token patterns
 */
export function sanitizeVaultError(error: any): Error {
  const message = typeof error === 'string' ? error : error?.message || 'VAULT_UNKNOWN_ERROR';
  const sanitized = message
    .replace(/EAAB[a-zA-Z0-9_-]+/g, '[REDACTED_META_TOKEN]')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
    .replace(/[a-zA-Z0-9_\-\.]{40,}/g, '[REDACTED_SECRET]');
  return new Error(sanitized);
}

/**
 * Stores a freshly exchanged dynamic OAuth token into the encrypted vault
 * INVARIANT: Token is encrypted BEFORE being written to the database.
 */
export async function storeCredential(
  db: any,
  kekResolver: KeyEncryptionKeyResolver,
  params: StoreCredentialParams
): Promise<CredentialMetadata> {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('VAULT_STORAGE_ERROR: Database handle required');
  }
  if (!params.accessToken) {
    throw new Error('VAULT_VALIDATION_ERROR: Plaintext accessToken is required for storage');
  }

  const credentialId = `cred_${params.provider.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const keyVersion = params.keyVersion || DEFAULT_KEK_VERSION;
  const now = new Date().toISOString();

  // Resolve KEK
  const rawKey = await kekResolver(keyVersion);
  if (!rawKey) {
    throw new Error(`VAULT_KEK_UNAVAILABLE: Encryption key version ${keyVersion} could not be resolved`);
  }

  // Build Authenticated Context (AAD) with token purpose
  const accessAad = buildAuthenticatedContext(
    credentialId,
    params.connectionId,
    params.provider,
    params.authMode,
    keyVersion,
    'access_token'
  );

  // Encrypt access token with independent nonce
  const { ciphertext: encAccessToken, nonce: accessNonce } = await encryptToken(
    params.accessToken,
    rawKey,
    accessAad
  );

  // Encrypt refresh token if present with distinct independent nonce and distinct AAD
  let encRefreshToken: string | null = null;
  let refreshNonce: string | null = null;
  if (params.refreshToken) {
    const refreshAad = buildAuthenticatedContext(
      credentialId,
      params.connectionId,
      params.provider,
      params.authMode,
      keyVersion,
      'refresh_token'
    );
    const { ciphertext: refCipher, nonce: refNonce } = await encryptToken(
      params.refreshToken,
      rawKey,
      refreshAad
    );
    encRefreshToken = refCipher;
    refreshNonce = refNonce;
  }

  // Calculate expiration
  let expiresAt: string | null = params.expiresAt || null;
  if (!expiresAt && typeof params.expiresInSeconds === 'number' && params.expiresInSeconds > 0) {
    expiresAt = new Date(Date.now() + params.expiresInSeconds * 1000).toISOString();
  }

  const scopeSnapshot = JSON.stringify(params.scopes || []);
  const tokenType = params.tokenType || 'BEARER';

  // Atomic superseding: Mark existing active credentials for this connection as revoked, then insert new
  try {
    const revokeStmt = db
      .prepare(
        'UPDATE social_provider_credentials SET revoked_at = ?, updated_at = ? WHERE connection_id = ? AND provider = ? AND revoked_at IS NULL'
      )
      .bind(now, now, params.connectionId, params.provider);

    const insertStmt = db
      .prepare(
        `INSERT INTO social_provider_credentials (
          credential_id, connection_id, provider, auth_mode,
          encrypted_access_token, encrypted_refresh_token,
          encryption_nonce, access_token_nonce, refresh_token_nonce,
          encryption_key_version, token_type, expires_at,
          scope_snapshot, provider_user_id, created_at, updated_at, revoked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      )
      .bind(
        credentialId,
        params.connectionId,
        params.provider,
        params.authMode,
        encAccessToken,
        encRefreshToken,
        accessNonce,
        accessNonce,
        refreshNonce,
        keyVersion,
        tokenType,
        expiresAt,
        scopeSnapshot,
        params.providerUserId || null,
        now,
        now
      );

    if (typeof db.batch === 'function') {
      await db.batch([revokeStmt, insertStmt]);
    } else {
      await revokeStmt.run();
      await insertStmt.run();
    }
  } catch (err: any) {
    throw sanitizeVaultError(err);
  }

  return {
    credentialId,
    connectionId: params.connectionId,
    provider: params.provider,
    authMode: params.authMode,
    hasCredential: true,
    tokenType,
    expiresAt,
    isExpired: false,
    scopeSnapshot: params.scopes || [],
    providerUserId: params.providerUserId || null,
    keyVersion,
    status: 'VALID',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Decrypts and returns credential JUST-IN-TIME for provider execution.
 * STRICT SECURITY INVARIANT:
 * - Calling code must use the token immediately and discard the reference.
 * - Calling code must NEVER log or persist the decrypted token.
 */
export async function readCredentialForProviderExecution(
  db: any,
  kekResolver: KeyEncryptionKeyResolver,
  connectionId: string,
  provider = 'META'
): Promise<DecryptedCredential> {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('VAULT_STORAGE_ERROR: Database handle required');
  }

  let row: EncryptedCredentialRecord | null = null;
  try {
    row = await db
      .prepare(
        `SELECT * FROM social_provider_credentials 
         WHERE connection_id = ? AND provider = ? AND revoked_at IS NULL 
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(connectionId, provider)
      .first();
  } catch (err: any) {
    throw sanitizeVaultError(err);
  }

  if (!row) {
    throw new Error(`VAULT_CREDENTIAL_NOT_FOUND: No active credential for connection ${connectionId}`);
  }

  // Check expiration
  const isExpired = row.expires_at ? new Date(row.expires_at).getTime() <= Date.now() : false;
  if (isExpired) {
    throw new Error(`VAULT_CREDENTIAL_EXPIRED: Credential expired at ${row.expires_at}`);
  }

  // Resolve KEK
  const rawKey = await kekResolver(row.encryption_key_version);
  if (!rawKey) {
    throw new Error(`VAULT_KEK_UNAVAILABLE: Key version ${row.encryption_key_version} is not available in environment`);
  }

  // Authenticate and decrypt with AAD incorporating tokenPurpose
  const accessAad = buildAuthenticatedContext(
    row.credential_id,
    row.connection_id,
    row.provider,
    row.auth_mode,
    row.encryption_key_version,
    'access_token'
  );

  const accessNonce = row.access_token_nonce || row.encryption_nonce;

  let accessToken: string;
  let refreshToken: string | null = null;

  try {
    accessToken = await decryptToken(
      row.encrypted_access_token,
      accessNonce,
      rawKey,
      accessAad
    );

    if (row.encrypted_refresh_token) {
      const refreshAad = buildAuthenticatedContext(
        row.credential_id,
        row.connection_id,
        row.provider,
        row.auth_mode,
        row.encryption_key_version,
        'refresh_token'
      );
      const refreshNonce = row.refresh_token_nonce || row.encryption_nonce;
      refreshToken = await decryptToken(
        row.encrypted_refresh_token,
        refreshNonce,
        rawKey,
        refreshAad
      );
    }
  } catch (err: any) {
    throw sanitizeVaultError(err);
  }

  let scopeSnapshot: string[] = [];
  try {
    if (row.scope_snapshot) {
      scopeSnapshot = JSON.parse(row.scope_snapshot);
    }
  } catch {
    // Ignore JSON parse error
  }

  return {
    credentialId: row.credential_id,
    connectionId: row.connection_id,
    provider: row.provider,
    authMode: row.auth_mode,
    accessToken,
    refreshToken,
    tokenType: row.token_type,
    expiresAt: row.expires_at,
    isExpired: false,
    scopeSnapshot,
    keyVersion: row.encryption_key_version,
  };
}

/**
 * Returns safe non-secret metadata about the credential
 * SAFE TO CALL FROM ADMIN UI AND MISSION CONTROL.
 * NEVER returns plaintext tokens, ciphertexts, nonces, or encryption keys.
 */
export async function getCredentialMetadata(
  db: any,
  connectionId: string,
  provider = 'META'
): Promise<CredentialMetadata> {
  if (!db || typeof db.prepare !== 'function') {
    return {
      credentialId: '',
      connectionId,
      provider,
      authMode: 'UNKNOWN',
      hasCredential: false,
      tokenType: '',
      expiresAt: null,
      isExpired: false,
      scopeSnapshot: [],
      providerUserId: null,
      keyVersion: '',
      status: 'NOT_FOUND',
      createdAt: '',
      updatedAt: '',
    };
  }

  let row: EncryptedCredentialRecord | null = null;
  try {
    row = await db
      .prepare(
        `SELECT credential_id, connection_id, provider, auth_mode,
                encryption_key_version, token_type, expires_at,
                scope_snapshot, provider_user_id, created_at, updated_at, revoked_at
         FROM social_provider_credentials 
         WHERE connection_id = ? AND provider = ? 
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(connectionId, provider)
      .first();
  } catch {
    // Return not found on DB error
  }

  if (!row) {
    return {
      credentialId: '',
      connectionId,
      provider,
      authMode: 'UNKNOWN',
      hasCredential: false,
      tokenType: '',
      expiresAt: null,
      isExpired: false,
      scopeSnapshot: [],
      providerUserId: null,
      keyVersion: '',
      status: 'NOT_FOUND',
      createdAt: '',
      updatedAt: '',
    };
  }

  const isRevoked = !!row.revoked_at;
  const isExpired = row.expires_at ? new Date(row.expires_at).getTime() <= Date.now() : false;

  let status: 'VALID' | 'EXPIRED' | 'REVOKED' | 'NOT_FOUND' = 'VALID';
  if (isRevoked) {
    status = 'REVOKED';
  } else if (isExpired) {
    status = 'EXPIRED';
  }

  let scopeSnapshot: string[] = [];
  try {
    if (row.scope_snapshot) {
      scopeSnapshot = JSON.parse(row.scope_snapshot);
    }
  } catch {
    // Ignore JSON parse error
  }

  return {
    credentialId: row.credential_id,
    connectionId: row.connection_id,
    provider: row.provider,
    authMode: row.auth_mode,
    hasCredential: !isRevoked,
    tokenType: row.token_type,
    expiresAt: row.expires_at,
    isExpired,
    scopeSnapshot,
    providerUserId: row.provider_user_id,
    keyVersion: row.encryption_key_version,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Re-encrypts an existing credential with a new Key Encryption Key version
 */
export async function rotateEncryptionKey(
  db: any,
  kekResolver: KeyEncryptionKeyResolver,
  connectionId: string,
  targetKeyVersion: string,
  provider = 'META'
): Promise<CredentialMetadata> {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('VAULT_STORAGE_ERROR: Database handle required');
  }

  const row: EncryptedCredentialRecord | null = await db
    .prepare(
      `SELECT * FROM social_provider_credentials 
       WHERE connection_id = ? AND provider = ? AND revoked_at IS NULL 
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(connectionId, provider)
    .first();

  if (!row) {
    throw new Error(`VAULT_ROTATION_ERROR: No active credential for connection ${connectionId}`);
  }

  if (row.encryption_key_version === targetKeyVersion) {
    return await getCredentialMetadata(db, connectionId, provider);
  }

  // Resolve old KEK
  const oldKey = await kekResolver(row.encryption_key_version);
  if (!oldKey) {
    throw new Error(`VAULT_KEK_UNAVAILABLE: Old key version ${row.encryption_key_version} is missing`);
  }

  // Resolve new KEK
  const newKey = await kekResolver(targetKeyVersion);
  if (!newKey) {
    throw new Error(`VAULT_KEK_UNAVAILABLE: Target key version ${targetKeyVersion} is missing`);
  }

  // Decrypt with old key + old AAD (incorporating tokenPurpose)
  const oldAccessAad = buildAuthenticatedContext(
    row.credential_id,
    row.connection_id,
    row.provider,
    row.auth_mode,
    row.encryption_key_version,
    'access_token'
  );
  const oldAccessNonce = row.access_token_nonce || row.encryption_nonce;
  const plainAccessToken = await decryptToken(
    row.encrypted_access_token,
    oldAccessNonce,
    oldKey,
    oldAccessAad
  );

  let plainRefreshToken: string | null = null;
  if (row.encrypted_refresh_token) {
    const oldRefreshAad = buildAuthenticatedContext(
      row.credential_id,
      row.connection_id,
      row.provider,
      row.auth_mode,
      row.encryption_key_version,
      'refresh_token'
    );
    const oldRefreshNonce = row.refresh_token_nonce || row.encryption_nonce;
    plainRefreshToken = await decryptToken(
      row.encrypted_refresh_token,
      oldRefreshNonce,
      oldKey,
      oldRefreshAad
    );
  }

  // Re-encrypt with new key + new AAD + fresh independent nonces
  const newAccessAad = buildAuthenticatedContext(
    row.credential_id,
    row.connection_id,
    row.provider,
    row.auth_mode,
    targetKeyVersion,
    'access_token'
  );
  const { ciphertext: newEncToken, nonce: newAccessNonce } = await encryptToken(
    plainAccessToken,
    newKey,
    newAccessAad
  );

  let newEncRefresh: string | null = null;
  let newRefreshNonce: string | null = null;
  if (plainRefreshToken) {
    const newRefreshAad = buildAuthenticatedContext(
      row.credential_id,
      row.connection_id,
      row.provider,
      row.auth_mode,
      targetKeyVersion,
      'refresh_token'
    );
    const { ciphertext: refCipher, nonce: refNonce } = await encryptToken(
      plainRefreshToken,
      newKey,
      newRefreshAad
    );
    newEncRefresh = refCipher;
    newRefreshNonce = refNonce;
  }

  const now = new Date().toISOString();

  // Atomically update ciphertext, nonces, and key version
  await db
    .prepare(
      `UPDATE social_provider_credentials 
       SET encrypted_access_token = ?, encrypted_refresh_token = ?,
           encryption_nonce = ?, access_token_nonce = ?, refresh_token_nonce = ?,
           encryption_key_version = ?, updated_at = ?
       WHERE credential_id = ?`
    )
    .bind(
      newEncToken,
      newEncRefresh,
      newAccessNonce,
      newAccessNonce,
      newRefreshNonce,
      targetKeyVersion,
      now,
      row.credential_id
    )
    .run();

  return await getCredentialMetadata(db, connectionId, provider);
}

/**
 * Revokes active credentials for a connection
 */
export async function revokeCredential(
  db: any,
  connectionId: string,
  provider = 'META'
): Promise<{ revoked: boolean }> {
  if (!db || typeof db.prepare !== 'function') {
    return { revoked: false };
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      'UPDATE social_provider_credentials SET revoked_at = ?, updated_at = ? WHERE connection_id = ? AND provider = ? AND revoked_at IS NULL'
    )
    .bind(now, now, connectionId, provider)
    .run();

  return { revoked: true };
}
