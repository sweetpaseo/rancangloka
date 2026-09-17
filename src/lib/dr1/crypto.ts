/**
 * RancangLoka DR-1: Cryptographic Engine (Web Crypto Standard)
 * 
 * Implements standard authenticated encryption (AES-256-GCM),
 * PBKDF2 key derivation, and SHA-256 integrity checks.
 * Uses 100% standard Web Crypto API (crypto.subtle).
 * Zero Node.js-specific imports for universal edge/browser/worker compatibility.
 * NO CUSTOM CRYPTOGRAPHY.
 */

import type { EncryptedEnvelope } from './types.ts';

const PBKDF2_ITERATIONS = 100000;
const IV_LENGTH_BYTES = 12;   // 96 bits for GCM
const SALT_LENGTH_BYTES = 32; // 256 bits

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Computes deterministic SHA-256 hex string of a UTF-8 string or Uint8Array.
 */
export async function computeSha256(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from a user passphrase and salt via PBKDF2.
 */
export async function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!passphrase || typeof passphrase !== 'string' || passphrase.trim().length < 8) {
    throw new Error('Passphrase must be at least 8 characters long.');
  }

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts arbitrary plaintext (string or Uint8Array) using AES-256-GCM.
 * In Web Crypto, the 16-byte authentication tag is appended to the ciphertext.
 */
export async function encryptPayload(
  plaintext: string | Uint8Array,
  passphrase: string
): Promise<EncryptedEnvelope> {
  if (!passphrase) {
    throw new Error('Passphrase is required for encryption.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const key = await deriveKeyFromPassphrase(passphrase, salt);

  const inputBuffer = typeof plaintext === 'string' ? new TextEncoder().encode(plaintext) : plaintext;
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    inputBuffer as BufferSource
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  // Web Crypto AES-GCM appends 16-byte auth tag at the end
  const tagBytes = encryptedBytes.slice(encryptedBytes.length - 16);
  const ciphertextBytes = encryptedBytes.slice(0, encryptedBytes.length - 16);

  const ciphertextBase64 = bytesToBase64(encryptedBytes);
  const saltHex = bytesToHex(salt);
  const ivHex = bytesToHex(iv);
  const tagHex = bytesToHex(tagBytes);

  const envelopeSha256 = await computeSha256(ciphertextBase64 + saltHex + ivHex + tagHex);

  return {
    format: 'RL_DR1_ENCRYPTED_ARCHIVE',
    version: 1,
    algorithm: 'AES-256-GCM',
    keyDerivation: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    saltHex,
    ivHex,
    tagHex,
    ciphertextBase64,
    envelopeSha256,
    createdAt: new Date().toISOString()
  };
}

/**
 * Decrypts an EncryptedEnvelope back into plaintext Uint8Array using the supplied passphrase.
 * Fails closed if the tag mismatches, ciphertext is tampered, or passphrase is wrong.
 */
export async function decryptPayload(
  envelope: EncryptedEnvelope,
  passphrase: string
): Promise<Uint8Array> {
  if (!passphrase) {
    throw new Error('Passphrase is required for decryption.');
  }

  if (envelope.format !== 'RL_DR1_ENCRYPTED_ARCHIVE' || envelope.version !== 1) {
    throw new Error('Unsupported envelope format or version.');
  }

  if (envelope.algorithm !== 'AES-256-GCM') {
    throw new Error(`Unsupported encryption algorithm: ${envelope.algorithm}`);
  }

  // Verify envelope integrity hash
  const computedHash = await computeSha256(
    envelope.ciphertextBase64 + envelope.saltHex + envelope.ivHex + envelope.tagHex
  );
  if (computedHash !== envelope.envelopeSha256) {
    throw new Error('Envelope integrity verification failed (tampered ciphertext or metadata).');
  }

  const salt = hexToBytes(envelope.saltHex);
  const iv = hexToBytes(envelope.ivHex);
  const encryptedBytes = base64ToBytes(envelope.ciphertextBase64);

  const key = await deriveKeyFromPassphrase(passphrase, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      encryptedBytes as BufferSource
    );
    return new Uint8Array(decryptedBuffer);
  } catch (err: any) {
    throw new Error('Decryption failed: authentication tag mismatch or invalid passphrase.');
  }
}
