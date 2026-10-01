/**
 * RancangLoka — Secure OAuth Credential Vault Cryptography
 * Milestone: SOCIAL-S3.5A
 * 
 * Cryptographic Engine: AES-256-GCM (Authenticated Encryption with Associated Data - AEAD)
 * Platform: Native Web Crypto API (supported in Cloudflare Workers and Node.js)
 */

const NONCE_BYTE_LENGTH = 12; // 96 bits standard for AES-GCM
const KEY_BYTE_LENGTH = 32; // 256 bits for AES-256

/**
 * Base64 encoding utility compatible with both Cloudflare Workers Edge and Node.js
 */
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 decoding utility compatible with both Cloudflare Workers Edge and Node.js
 */
export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Normalizes input key material (Uint8Array, Hex string, or Base64 string) into 32 raw bytes
 */
export function normalizeKeyBytes(rawKey: Uint8Array | string): Uint8Array {
  if (rawKey instanceof Uint8Array) {
    if (rawKey.length !== KEY_BYTE_LENGTH) {
      throw new Error(`INVALID_KEK_LENGTH: Expected 32 bytes for AES-256, got ${rawKey.length}`);
    }
    return rawKey;
  }

  if (typeof rawKey === 'string') {
    const trimmed = rawKey.trim();
    // Check if 64-char hex
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      const match = trimmed.match(/.{1,2}/g);
      if (match) {
        return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
      }
    }
    // Attempt base64 decode
    try {
      const decoded = base64ToBytes(trimmed);
      if (decoded.length === KEY_BYTE_LENGTH) {
        return decoded;
      }
    } catch {
      // Fall through to error
    }

    // Attempt utf-8 encode if exactly 32 chars
    const utf8 = new TextEncoder().encode(trimmed);
    if (utf8.length === KEY_BYTE_LENGTH) {
      return utf8;
    }
  }

  throw new Error(`INVALID_KEK_FORMAT: KEK must resolve to 32 bytes (AES-256)`);
}

/**
 * Imports raw key bytes into a CryptoKey for AES-GCM
 */
async function importAesGcmKey(rawKey: Uint8Array | string): Promise<CryptoKey> {
  const keyBytes = normalizeKeyBytes(rawKey);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WEB_CRYPTO_UNAVAILABLE: globalThis.crypto.subtle is required');
  }

  return await subtle.importKey(
    'raw',
    keyBytes as any,
    { name: 'AES-GCM' },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Builds deterministic Authenticated Additional Data (AAD)
 * Cryptographically binds ciphertext to the exact identity context.
 * Ciphertext substitution between connections or auth modes will fail authentication.
 */
export function buildAuthenticatedContext(
  credentialId: string,
  connectionId: string,
  provider: string,
  authMode: string,
  keyVersion: string
): Uint8Array {
  const contextString = `${credentialId}:${connectionId}:${provider}:${authMode}:${keyVersion}`;
  return new TextEncoder().encode(contextString);
}

/**
 * Encrypts a plaintext token string using AES-256-GCM with authenticated context
 */
export async function encryptToken(
  plaintext: string,
  rawKey: Uint8Array | string,
  aad: Uint8Array
): Promise<{ ciphertext: string; nonce: string }> {
  if (!plaintext) {
    throw new Error('EMPTY_PLAINTEXT_FORBIDDEN');
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WEB_CRYPTO_UNAVAILABLE');
  }

  const cryptoKey = await importAesGcmKey(rawKey);
  const nonce = new Uint8Array(NONCE_BYTE_LENGTH);
  globalThis.crypto.getRandomValues(nonce);

  const plaintextBytes = new TextEncoder().encode(plaintext);

  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce as any,
      additionalData: aad as any,
      tagLength: 128, // 16 bytes auth tag
    },
    cryptoKey,
    plaintextBytes as any
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
    nonce: bytesToBase64(nonce),
  };
}

/**
 * Decrypts an authenticated AES-256-GCM ciphertext using the key and authenticated context
 */
export async function decryptToken(
  ciphertextBase64: string,
  nonceBase64: string,
  rawKey: Uint8Array | string,
  aad: Uint8Array
): Promise<string> {
  if (!ciphertextBase64 || !nonceBase64) {
    throw new Error('CIPHERTEXT_OR_NONCE_MISSING');
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WEB_CRYPTO_UNAVAILABLE');
  }

  const cryptoKey = await importAesGcmKey(rawKey);
  const ciphertextBytes = base64ToBytes(ciphertextBase64);
  const nonceBytes = base64ToBytes(nonceBase64);

  try {
    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonceBytes as any,
        additionalData: aad as any,
        tagLength: 128,
      },
      cryptoKey,
      ciphertextBytes as any
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err: any) {
    throw new Error(`VAULT_DECRYPTION_FAILED: Authentication tag verification failed or key mismatch (${err?.message || 'MAC failed'})`);
  }
}
