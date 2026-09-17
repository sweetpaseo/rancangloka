/**
 * RancangLoka Publication Inventory Security & Transport Module
 * Phase 3B-5B Implementation
 *
 * Implements:
 * - Dedicated Read-Only M2M Authentication (separated from Ingestion secret)
 * - Header validation (X-RL-Signature-Version, X-RL-Timestamp, X-RL-Request-ID, X-RL-Key-ID, X-RL-Signature)
 * - Replay tolerance window validation (±300s)
 * - Safe identifier validation (req_[A-Za-z0-9_-]{16,80})
 * - Lexicographical deterministic canonical query string construction
 * - Constant-time HMAC-SHA256 request signature verification via Web Crypto
 * - Fail-closed production key resolution with previous-key rotation support
 */

export const INVENTORY_TIMESTAMP_WINDOW_SECONDS = 300; // ±300s (5 minutes)
export const INVENTORY_ROUTE_PATH = '/api/internal/v1/publication-inventory';
export const INVENTORY_SIGNATURE_VERSION = 'v1';

export interface InventoryHeaders {
  signatureVersion: string;
  timestamp: number;
  requestId: string;
  keyId: string;
  signature: string;
}

/**
 * Validates request_id format: req_[A-Za-z0-9_-]{16,80}
 */
export function isValidRequestId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (!id.startsWith('req_')) return false;
  const suffix = id.slice(4);
  if (suffix.length < 16 || suffix.length > 80) return false;
  return /^[A-Za-z0-9_-]+$/.test(suffix);
}

/**
 * Validates Key ID format: [A-Za-z0-9_.-]{1,64}
 */
export function isValidKeyId(keyId: string): boolean {
  if (!keyId || typeof keyId !== 'string') return false;
  return /^[A-Za-z0-9_.-]{1,64}$/.test(keyId.trim());
}

/**
 * Builds the canonical query string for HMAC signing.
 *
 * Rules:
 * 1. Include only supported parameters ('after_id', 'limit', 'status')
 * 2. Sort keys lexicographically
 * 3. Encode values deterministically
 * 4. Disregard original parameter ordering
 * 5. Returns empty string if no supported parameters are present
 */
export function buildInventoryCanonicalQuery(
  input: URLSearchParams | Record<string, string | number | undefined | null>
): string {
  const supportedKeys = ['after_id', 'limit', 'status'];
  const params: [string, string][] = [];

  if (input instanceof URLSearchParams) {
    for (const key of supportedKeys) {
      const val = input.get(key);
      if (val !== null && val !== undefined && val !== '') {
        params.push([key, encodeURIComponent(val)]);
      }
    }
  } else if (typeof input === 'object' && input !== null) {
    for (const key of supportedKeys) {
      const val = input[key];
      if (val !== null && val !== undefined && val !== '') {
        params.push([key, encodeURIComponent(String(val))]);
      }
    }
  }

  // Sort keys lexicographically
  params.sort((a, b) => a[0].localeCompare(b[0]));

  return params.map(([k, v]) => `${k}=${v}`).join('&');
}

/**
 * Builds the canonical string for HMAC-SHA256 signing of GET /api/internal/v1/publication-inventory
 * Format:
 * v1\nGET\n/api/internal/v1/publication-inventory\n<TIMESTAMP>\n<REQUEST_ID>\n<CANONICAL_QUERY_STRING>
 * No trailing newline.
 */
export function buildInventoryCanonicalString(
  timestamp: number,
  requestId: string,
  canonicalQueryString: string
): string {
  return `${INVENTORY_SIGNATURE_VERSION}\nGET\n${INVENTORY_ROUTE_PATH}\n${timestamp}\n${requestId}\n${canonicalQueryString}`;
}

/**
 * Resolves the dedicated read-only inventory secret for a given keyId.
 * Fails closed if keys are not configured.
 */
export function getInventoryReadSecret(
  keyId: string,
  env?: any
): { secret: string | null; configured: boolean; isKnownKey: boolean } {
  const currentKeyId =
    env?.RANCANGLOKA_INVENTORY_READ_KEY_CURRENT_ID ||
    (globalThis as any).process?.env?.RANCANGLOKA_INVENTORY_READ_KEY_CURRENT_ID ||
    '';
  const currentSecret =
    env?.RANCANGLOKA_INVENTORY_READ_KEY_CURRENT ||
    (globalThis as any).process?.env?.RANCANGLOKA_INVENTORY_READ_KEY_CURRENT ||
    '';

  const previousKeyId =
    env?.RANCANGLOKA_INVENTORY_READ_KEY_PREVIOUS_ID ||
    (globalThis as any).process?.env?.RANCANGLOKA_INVENTORY_READ_KEY_PREVIOUS_ID ||
    '';
  const previousSecret =
    env?.RANCANGLOKA_INVENTORY_READ_KEY_PREVIOUS ||
    (globalThis as any).process?.env?.RANCANGLOKA_INVENTORY_READ_KEY_PREVIOUS ||
    '';

  // Fail closed if at least current key and secret are not configured
  const isConfigured = Boolean(currentKeyId && currentSecret);
  if (!isConfigured) {
    return { secret: null, configured: false, isKnownKey: false };
  }

  if (keyId === currentKeyId) {
    return { secret: currentSecret, configured: true, isKnownKey: true };
  }

  if (previousKeyId && previousSecret && keyId === previousKeyId) {
    return { secret: previousSecret, configured: true, isKnownKey: true };
  }

  return { secret: null, configured: true, isKnownKey: false };
}

/**
 * Signs an inventory canonical string using HMAC-SHA256 with the provided secret (Test/Client helper).
 */
export async function signInventoryCanonicalString(
  canonicalString: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(canonicalString));
  const sigArray = Array.from(new Uint8Array(sigBuffer));
  return sigArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time cryptographic HMAC verification via Web Crypto subtle.
 */
export async function verifyInventoryHmac(
  canonicalString: string,
  signatureHex: string,
  secret: string
): Promise<boolean> {
  if (!signatureHex || typeof signatureHex !== 'string') return false;
  const cleanHex = signatureHex.trim().toLowerCase();
  if (cleanHex.length !== 64 || !/^[0-9a-f]{64}$/.test(cleanHex)) return false;

  // Convert hex to Uint8Array
  const sigBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    sigBytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    return await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes as BufferSource,
      encoder.encode(canonicalString)
    );
  } catch {
    return false;
  }
}

/**
 * Validates and extracts required Publication Inventory transport headers.
 */
export function extractAndValidateInventoryHeaders(
  headers: Headers,
  nowSec: number = Math.floor(Date.now() / 1000)
): { valid: boolean; data?: InventoryHeaders; code?: string; message?: string } {
  const sigVersion = headers.get('x-rl-signature-version');
  const timestampStr = headers.get('x-rl-timestamp');
  const requestId = headers.get('x-rl-request-id');
  const keyId = headers.get('x-rl-key-id');
  const sigHeader = headers.get('x-rl-signature');

  if (!sigVersion) {
    return {
      valid: false,
      code: 'SIGNATURE_VERSION_REQUIRED',
      message: 'Header X-RL-Signature-Version diperlukan.'
    };
  }
  if (sigVersion !== INVENTORY_SIGNATURE_VERSION) {
    return {
      valid: false,
      code: 'SIGNATURE_VERSION_UNSUPPORTED',
      message: `Versi signature "${sigVersion}" tidak didukung.`
    };
  }

  if (!timestampStr) {
    return {
      valid: false,
      code: 'TIMESTAMP_REQUIRED',
      message: 'Header X-RL-Timestamp diperlukan.'
    };
  }
  const timestamp = parseInt(timestampStr.trim(), 10);
  if (isNaN(timestamp) || String(timestamp) !== timestampStr.trim() || timestamp <= 0) {
    return {
      valid: false,
      code: 'TIMESTAMP_INVALID',
      message: 'Format timestamp unix epoch tidak valid.'
    };
  }
  if (Math.abs(nowSec - timestamp) > INVENTORY_TIMESTAMP_WINDOW_SECONDS) {
    return {
      valid: false,
      code: 'TIMESTAMP_OUT_OF_WINDOW',
      message: 'Timestamp berada di luar jendela toleransi ±300 detik.'
    };
  }

  if (!requestId) {
    return {
      valid: false,
      code: 'REQUEST_ID_REQUIRED',
      message: 'Header X-RL-Request-ID diperlukan.'
    };
  }
  if (!isValidRequestId(requestId)) {
    return {
      valid: false,
      code: 'REQUEST_ID_INVALID',
      message: 'Format X-RL-Request-ID tidak valid (harus diawali req_ dengan panjang aman).'
    };
  }

  if (!keyId || !isValidKeyId(keyId)) {
    return {
      valid: false,
      code: 'KEY_NOT_ACCEPTED',
      message: 'Header X-RL-Key-ID tidak valid atau hilang.'
    };
  }

  if (!sigHeader) {
    return {
      valid: false,
      code: 'SIGNATURE_REQUIRED',
      message: 'Header X-RL-Signature diperlukan.'
    };
  }
  if (!sigHeader.startsWith('sha256=')) {
    return {
      valid: false,
      code: 'SIGNATURE_INVALID',
      message: 'Format X-RL-Signature harus menggunakan awalan sha256=.'
    };
  }
  const sigHex = sigHeader.slice(7).trim();
  if (sigHex.length !== 64 || !/^[0-9a-f]{64}$/.test(sigHex)) {
    return {
      valid: false,
      code: 'SIGNATURE_INVALID',
      message:
        'Format hexadecimal X-RL-Signature tidak valid (harus 64 karakter lowercase hex).'
    };
  }

  return {
    valid: true,
    data: {
      signatureVersion: sigVersion,
      timestamp,
      requestId,
      keyId: keyId.trim(),
      signature: sigHex
    }
  };
}
