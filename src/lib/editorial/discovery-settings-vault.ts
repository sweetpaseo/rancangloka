/**
 * RancangLoka Discovery Settings Vault & Key Management Service
 * Milestone: ADMIN-BRAVE-SEARCH-SETTINGS-1
 *
 * Provides:
 * 1. AES-256-GCM server-side encryption/decryption for search provider credentials.
 * 2. Fail-closed secret storage invariants (never plaintext in D1 or GET responses).
 * 3. Administrative toggle and status reconciliation (OFF / READY / ACTIVE / CONFIG ERROR).
 * 4. Bounded connection test (exactly one request, zero secrets leaked).
 * 5. Sanitized administrative audit logging.
 */

import {
  normalizeKeyBytes,
  bytesToBase64,
  base64ToBytes
} from '../social/vault/crypto.ts';

export type DiscoveryProviderName = 'brave' | 'tavily' | 'searxng' | 'custom';
export type DiscoveryProviderStatus = 'OFF' | 'READY' | 'ACTIVE' | 'CONFIG ERROR';

export interface DiscoveryProviderStatusResponse {
  provider: string;
  configured: boolean;
  enabled: boolean;
  status: DiscoveryProviderStatus;
}

export interface DiscoverySettingsRecord {
  provider: string;
  enabled: number;
  encrypted_secret: string | null;
  nonce: string | null;
  secret_version: string;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_SETTINGS_KEK_VERSION = 'RANCANGLOKA_SETTINGS_KEK_V1';
const NONCE_BYTE_LENGTH = 12;

/**
 * Resolves the master Key Encryption Key (KEK) from environment.
 * Throws SECRET_STORAGE_NOT_READY if missing or invalid.
 */
export function resolveSettingsKek(env?: any): Uint8Array {
  const rawKey =
    env?.RANCANGLOKA_SETTINGS_KEK ||
    (globalThis as any).process?.env?.RANCANGLOKA_SETTINGS_KEK ||
    env?.RANCANGLOKA_VAULT_KEK ||
    (globalThis as any).process?.env?.RANCANGLOKA_VAULT_KEK ||
    env?.META_CREDENTIAL_KEK ||
    (globalThis as any).process?.env?.META_CREDENTIAL_KEK;

  if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
    throw new Error('SECRET_STORAGE_NOT_READY: Encryption key RANCANGLOKA_SETTINGS_KEK is not configured');
  }

  try {
    return normalizeKeyBytes(rawKey);
  } catch (err: any) {
    throw new Error(`SECRET_STORAGE_NOT_READY: Invalid KEK format: ${err.message}`);
  }
}

/**
 * Builds deterministic Authenticated Additional Data (AAD) for search provider secret
 */
export function buildDiscoveryAad(provider: string, secretVersion: string): Uint8Array {
  const contextString = `${provider.toLowerCase()}:discovery_credential:${secretVersion}`;
  return new TextEncoder().encode(contextString);
}

/**
 * Encrypts a plaintext API key with AES-256-GCM
 */
export async function encryptDiscoverySecret(
  plaintext: string,
  rawKey: Uint8Array,
  provider: string,
  secretVersion: string = DEFAULT_SETTINGS_KEK_VERSION
): Promise<{ ciphertext: string; nonce: string }> {
  if (!plaintext || !plaintext.trim()) {
    throw new Error('EMPTY_PLAINTEXT_FORBIDDEN');
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WEB_CRYPTO_UNAVAILABLE: globalThis.crypto.subtle required');
  }

  const cryptoKey = await subtle.importKey(
    'raw',
    rawKey as any,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  const nonce = new Uint8Array(NONCE_BYTE_LENGTH);
  globalThis.crypto.getRandomValues(nonce);

  const aad = buildDiscoveryAad(provider, secretVersion);
  const plaintextBytes = new TextEncoder().encode(plaintext.trim());

  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce as any,
      additionalData: aad as any,
      tagLength: 128
    },
    cryptoKey,
    plaintextBytes as any
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
    nonce: bytesToBase64(nonce)
  };
}

/**
 * Decrypts an authenticated AES-256-GCM discovery secret
 */
export async function decryptDiscoverySecret(
  ciphertextBase64: string,
  nonceBase64: string,
  rawKey: Uint8Array,
  provider: string,
  secretVersion: string = DEFAULT_SETTINGS_KEK_VERSION
): Promise<string> {
  if (!ciphertextBase64 || !nonceBase64) {
    throw new Error('CIPHERTEXT_OR_NONCE_MISSING');
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WEB_CRYPTO_UNAVAILABLE: globalThis.crypto.subtle required');
  }

  const cryptoKey = await subtle.importKey(
    'raw',
    rawKey as any,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  const ciphertextBytes = base64ToBytes(ciphertextBase64);
  const nonceBytes = base64ToBytes(nonceBase64);
  const aad = buildDiscoveryAad(provider, secretVersion);

  try {
    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonceBytes as any,
        additionalData: aad as any,
        tagLength: 128
      },
      cryptoKey,
      ciphertextBytes as any
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    throw new Error('DISCOVERY_SECRET_DECRYPTION_FAILED: Authentication tag verification failed or key mismatch');
  }
}

/**
 * Strips any potential secret tokens or sensitive values from an error or log string
 */
export function sanitizeDiscoveryMessage(message: any): string {
  if (!message) return '';
  const str = typeof message === 'string' ? message : message?.message || String(message);
  return str
    .replace(/BSA[a-zA-Z0-9_\-]{20,}/g, '[REDACTED_BRAVE_KEY]')
    .replace(/tvly-[a-zA-Z0-9_\-]{20,}/g, '[REDACTED_TAVILY_KEY]')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
    .replace(/[a-zA-Z0-9_\-\.]{32,}/g, '[REDACTED_SECRET]');
}

/**
 * Records an administrative audit event
 */
export async function recordDiscoveryAudit(
  db: any,
  params: {
    provider: string;
    action: string;
    actor: string;
    result: string;
    details?: Record<string, any>;
  }
): Promise<void> {
  if (!db || typeof db.prepare !== 'function') return;

  const auditId = `audit_disc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const timestamp = new Date().toISOString();

  // Ensure details contain zero secrets
  const safeDetails = params.details ? JSON.parse(JSON.stringify(params.details)) : {};
  if (safeDetails.apiKey) delete safeDetails.apiKey;
  if (safeDetails.encrypted_secret) delete safeDetails.encrypted_secret;
  if (safeDetails.headers) delete safeDetails.headers;
  if (safeDetails.token) delete safeDetails.token;

  try {
    await db
      .prepare(
        `INSERT INTO discovery_settings_audit (
          audit_id, provider, action, actor, result, timestamp, details_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        auditId,
        params.provider.toLowerCase(),
        params.action,
        params.actor,
        params.result,
        timestamp,
        JSON.stringify(safeDetails)
      )
      .run();
  } catch {
    // Non-fatal if table doesn't exist in dev mock
  }
}

/**
 * Fetches the safe public status for a discovery provider without exposing secrets
 */
export async function getDiscoveryProviderStatus(
  db: any,
  providerName: string = 'brave',
  env?: any
): Promise<DiscoveryProviderStatusResponse> {
  const normProvider = providerName.toLowerCase();

  // 1. Check if database has record
  if (db && typeof db.prepare === 'function') {
    try {
      const row = (await db
        .prepare('SELECT provider, enabled, encrypted_secret, nonce, secret_version FROM discovery_provider_settings WHERE provider = ? LIMIT 1')
        .bind(normProvider)
        .first()) as DiscoverySettingsRecord | null;

      if (row && row.encrypted_secret && row.nonce) {
        const isEnabled = Number(row.enabled) === 1;
        return {
          provider: normProvider,
          configured: true,
          enabled: isEnabled,
          status: isEnabled ? 'ACTIVE' : 'READY'
        };
      }
    } catch {
      // Table may not exist yet or query error
    }
  }

  // 2. Check if operator environment has emergency fallback key configured
  const envKey =
    env?.OPEN_WEB_SEARCH_API_KEY ||
    (globalThis as any).process?.env?.OPEN_WEB_SEARCH_API_KEY ||
    env?.BRAVE_SEARCH_API_KEY ||
    (globalThis as any).process?.env?.BRAVE_SEARCH_API_KEY;

  if (normProvider === 'brave' && envKey && typeof envKey === 'string' && envKey.trim()) {
    // Note: Environment key presence alone does NOT automatically enable Brave!
    const envEnabled =
      env?.BRAVE_SEARCH_ENABLED === 'true' ||
      (globalThis as any).process?.env?.BRAVE_SEARCH_ENABLED === 'true';

    return {
      provider: normProvider,
      configured: true,
      enabled: envEnabled,
      status: envEnabled ? 'ACTIVE' : 'READY'
    };
  }

  return {
    provider: normProvider,
    configured: false,
    enabled: false,
    status: 'OFF'
  };
}

/**
 * Saves or replaces an API key for a discovery provider in encrypted storage
 */
export async function saveDiscoveryProviderKey(
  db: any,
  params: {
    provider: string;
    apiKey: string;
    actor: string;
    env?: any;
  }
): Promise<DiscoveryProviderStatusResponse> {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('DATABASE_REQUIRED: Database connection required for settings persistence');
  }

  const normProvider = params.provider.toLowerCase();
  const rawApiKey = (params.apiKey || '').trim();

  if (!rawApiKey) {
    throw new Error('API_KEY_REQUIRED: Plaintext API key cannot be empty');
  }

  // Resolve KEK (fails closed with SECRET_STORAGE_NOT_READY if missing)
  const kek = resolveSettingsKek(params.env);

  // Encrypt immediately
  const secretVersion = DEFAULT_SETTINGS_KEK_VERSION;
  const { ciphertext, nonce } = await encryptDiscoverySecret(rawApiKey, kek, normProvider, secretVersion);

  const now = new Date().toISOString();

  // Check if existing record exists
  const existing = (await db
    .prepare('SELECT provider, enabled, encrypted_secret FROM discovery_provider_settings WHERE provider = ? LIMIT 1')
    .bind(normProvider)
    .first()) as DiscoverySettingsRecord | null;

  const isReplacing = Boolean(existing && existing.encrypted_secret);
  const currentEnabled = existing ? Number(existing.enabled) : 0;

  await db
    .prepare(
      `INSERT INTO discovery_provider_settings (
        provider, enabled, encrypted_secret, nonce, secret_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET
        encrypted_secret = excluded.encrypted_secret,
        nonce = excluded.nonce,
        secret_version = excluded.secret_version,
        updated_at = excluded.updated_at`
    )
    .bind(normProvider, currentEnabled, ciphertext, nonce, secretVersion, now, now)
    .run();

  // Audit event
  const action = isReplacing ? 'BRAVE_API_KEY_REPLACED' : 'BRAVE_API_KEY_CONFIGURED';
  await recordDiscoveryAudit(db, {
    provider: normProvider,
    action,
    actor: params.actor,
    result: 'SUCCESS'
  });

  return {
    provider: normProvider,
    configured: true,
    enabled: currentEnabled === 1,
    status: currentEnabled === 1 ? 'ACTIVE' : 'READY'
  };
}

/**
 * Removes an API key and automatically disables the provider atomically
 */
export async function removeDiscoveryProviderKey(
  db: any,
  params: {
    provider: string;
    actor: string;
  }
): Promise<DiscoveryProviderStatusResponse> {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('DATABASE_REQUIRED: Database connection required');
  }

  const normProvider = params.provider.toLowerCase();
  const now = new Date().toISOString();

  await db
    .prepare(
      `UPDATE discovery_provider_settings
       SET encrypted_secret = NULL, nonce = NULL, enabled = 0, updated_at = ?
       WHERE provider = ?`
    )
    .bind(now, normProvider)
    .run();

  await recordDiscoveryAudit(db, {
    provider: normProvider,
    action: 'BRAVE_API_KEY_REMOVED',
    actor: params.actor,
    result: 'SUCCESS'
  });

  return {
    provider: normProvider,
    configured: false,
    enabled: false,
    status: 'OFF'
  };
}

/**
 * Toggles a discovery provider ON or OFF
 */
export async function toggleDiscoveryProvider(
  db: any,
  params: {
    provider: string;
    enabled: boolean;
    actor: string;
    env?: any;
  }
): Promise<DiscoveryProviderStatusResponse> {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('DATABASE_REQUIRED: Database connection required');
  }

  const normProvider = params.provider.toLowerCase();
  const wantEnabled = Boolean(params.enabled);

  // If toggling ON, check that valid key is configured
  if (wantEnabled) {
    const status = await getDiscoveryProviderStatus(db, normProvider, params.env);
    if (!status.configured) {
      throw new Error('Masukkan Brave Search API Key terlebih dahulu.');
    }
  }

  const now = new Date().toISOString();
  const newEnabledVal = wantEnabled ? 1 : 0;

  await db
    .prepare(
      `UPDATE discovery_provider_settings
       SET enabled = ?, updated_at = ?
       WHERE provider = ?`
    )
    .bind(newEnabledVal, now, normProvider)
    .run();

  const action = wantEnabled ? 'BRAVE_SEARCH_ENABLED' : 'BRAVE_SEARCH_DISABLED';
  await recordDiscoveryAudit(db, {
    provider: normProvider,
    action,
    actor: params.actor,
    result: 'SUCCESS'
  });

  return {
    provider: normProvider,
    configured: true,
    enabled: wantEnabled,
    status: wantEnabled ? 'ACTIVE' : 'READY'
  };
}

/**
 * Performs exactly ONE test connection request using the stored or provided key.
 * Never leaks credentials.
 */
export async function testDiscoveryProviderConnection(
  db: any,
  params: {
    provider: string;
    actor: string;
    env?: any;
    fetchFn?: typeof fetch;
  }
): Promise<{ success: boolean; message: string; httpStatus?: number }> {
  const normProvider = params.provider.toLowerCase();

  // 1. Resolve key
  let apiKey: string | null = null;

  // Check operator environment override first
  const envKey =
    params.env?.OPEN_WEB_SEARCH_API_KEY ||
    (globalThis as any).process?.env?.OPEN_WEB_SEARCH_API_KEY ||
    params.env?.BRAVE_SEARCH_API_KEY ||
    (globalThis as any).process?.env?.BRAVE_SEARCH_API_KEY;

  if (envKey && typeof envKey === 'string' && envKey.trim()) {
    apiKey = envKey.trim();
  } else if (db && typeof db.prepare === 'function') {
    const row = (await db
      .prepare('SELECT encrypted_secret, nonce, secret_version FROM discovery_provider_settings WHERE provider = ? LIMIT 1')
      .bind(normProvider)
      .first()) as DiscoverySettingsRecord | null;

    if (row && row.encrypted_secret && row.nonce) {
      const kek = resolveSettingsKek(params.env);
      apiKey = await decryptDiscoverySecret(
        row.encrypted_secret,
        row.nonce,
        kek,
        normProvider,
        row.secret_version || DEFAULT_SETTINGS_KEK_VERSION
      );
    }
  }

  if (!apiKey) {
    throw new Error('PROVIDER_NOT_CONFIGURED: Masukkan Brave Search API Key terlebih dahulu.');
  }

  const fetchFn = params.fetchFn || globalThis.fetch;
  const endpoint =
    params.env?.OPEN_WEB_SEARCH_ENDPOINT ||
    (globalThis as any).process?.env?.OPEN_WEB_SEARCH_ENDPOINT ||
    'https://api.search.brave.com/res/v1/web/search';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  let success = false;
  let message = '';
  let httpStatus: number | undefined;

  try {
    const testUrl = `${endpoint}?q=${encodeURIComponent('arsitektur bangunan')}&count=1`;
    const res = await fetchFn(testUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
        'User-Agent': 'RancangLoka-Admin-Test/1.0'
      }
    });

    httpStatus = res.status;

    if (res.ok) {
      success = true;
      message = 'Koneksi berhasil';
    } else if (res.status === 401 || res.status === 403) {
      message = 'Autentikasi gagal (API key tidak valid)';
    } else if (res.status === 429) {
      message = 'Rate limit tercapai';
    } else if (res.status >= 500) {
      message = 'Provider tidak tersedia (Server error)';
    } else {
      message = `Provider mengembalikan status ${res.status}`;
    }
  } catch (err: any) {
    message = sanitizeDiscoveryMessage(err?.name === 'AbortError' ? 'Koneksi timeout' : 'Kesalahan jaringan');
  } finally {
    clearTimeout(timeoutId);
  }

  // Record audit
  await recordDiscoveryAudit(db, {
    provider: normProvider,
    action: success ? 'BRAVE_CONNECTION_TEST_SUCCEEDED' : 'BRAVE_CONNECTION_TEST_FAILED',
    actor: params.actor,
    result: success ? 'SUCCESS' : 'FAILED',
    details: { httpStatus, message }
  });

  return { success, message, httpStatus };
}

/**
 * Resolves the effective runtime discovery configuration considering precedence:
 * Precedence:
 * 1. Emergency/operator environment override if intentionally set
 * 2. Admin-managed encrypted configuration in D1
 * 3. Unavailable
 *
 * Invariant:
 * Even if an API key is available, `enabled` is strictly governed by whether Brave
 * has been explicitly enabled by Chief (enabled === true).
 */
export async function resolveEffectiveDiscoveryConfig(
  db: any,
  providerName: string = 'brave',
  env?: any
): Promise<{
  enabled: boolean;
  apiKey?: string;
  endpoint?: string;
  provider: DiscoveryProviderName;
  source: 'ENV' | 'D1' | 'NONE';
}> {
  const normProvider = providerName.toLowerCase() as DiscoveryProviderName;

  // 1. Check D1 record
  let d1Row: DiscoverySettingsRecord | null = null;
  if (db && typeof db.prepare === 'function') {
    try {
      d1Row = (await db
        .prepare('SELECT provider, enabled, encrypted_secret, nonce, secret_version FROM discovery_provider_settings WHERE provider = ? LIMIT 1')
        .bind(normProvider)
        .first()) as DiscoverySettingsRecord | null;
    } catch {
      // D1 query error
    }
  }

  const d1Enabled = d1Row ? Number(d1Row.enabled) === 1 : false;

  // Check operator environment override
  const envKey =
    env?.OPEN_WEB_SEARCH_API_KEY ||
    (globalThis as any).process?.env?.OPEN_WEB_SEARCH_API_KEY ||
    env?.BRAVE_SEARCH_API_KEY ||
    (globalThis as any).process?.env?.BRAVE_SEARCH_API_KEY;

  const envExplicitEnabled =
    env?.BRAVE_SEARCH_ENABLED === 'true' ||
    (globalThis as any).process?.env?.BRAVE_SEARCH_ENABLED === 'true';

  // Effective enabled flag: D1 toggle or explicit environment toggle
  const isEffectiveEnabled = d1Enabled || envExplicitEnabled;

  if (!isEffectiveEnabled) {
    return {
      enabled: false,
      provider: normProvider,
      source: 'NONE'
    };
  }

  // Precedence 1: Explicit operator environment override
  if (envKey && typeof envKey === 'string' && envKey.trim()) {
    const endpoint =
      env?.OPEN_WEB_SEARCH_ENDPOINT ||
      (globalThis as any).process?.env?.OPEN_WEB_SEARCH_ENDPOINT ||
      'https://api.search.brave.com/res/v1/web/search';

    return {
      enabled: true,
      apiKey: envKey.trim(),
      endpoint,
      provider: normProvider,
      source: 'ENV'
    };
  }

  // Precedence 2: Admin-managed decrypted key from D1
  if (d1Row && d1Row.encrypted_secret && d1Row.nonce) {
    try {
      const kek = resolveSettingsKek(env);
      const decryptedKey = await decryptDiscoverySecret(
        d1Row.encrypted_secret,
        d1Row.nonce,
        kek,
        normProvider,
        d1Row.secret_version || DEFAULT_SETTINGS_KEK_VERSION
      );

      const endpoint =
        env?.OPEN_WEB_SEARCH_ENDPOINT ||
        (globalThis as any).process?.env?.OPEN_WEB_SEARCH_ENDPOINT ||
        'https://api.search.brave.com/res/v1/web/search';

      return {
        enabled: true,
        apiKey: decryptedKey,
        endpoint,
        provider: normProvider,
        source: 'D1'
      };
    } catch {
      // Decryption failed or KEK missing
      return {
        enabled: false,
        provider: normProvider,
        source: 'NONE'
      };
    }
  }

  return {
    enabled: false,
    provider: normProvider,
    source: 'NONE'
  };
}
