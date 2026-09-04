/**
 * RancangLoka Hermes Machine-to-Machine Ingestion Security & Transport Module
 * Phase 2A Implementation
 *
 * Implements:
 * - Transport header validation (X-RL-*)
 * - Constant-time HMAC-SHA256 request signature verification
 * - Secret resolution with fail-closed production semantics & key rotation
 * - Replay window validation (±300s)
 * - Safe identifier validation (article_id, job_id, request_id)
 * - Strict Hermes article frontmatter, category, and author policy enforcement
 */

export const HERMES_SOURCE = 'hermes';
export const HERMES_CONTRACT_VERSION = 1;
export const HERMES_TIMESTAMP_WINDOW_SECONDS = 300; // ±300s (5 minutes)
export const HERMES_MAX_BODY_BYTES = 512 * 1024; // 512 KiB

/**
 * The strict 6 official editorial categories permitted for Hermes ingestion.
 */
export const HERMES_ALLOWED_CATEGORIES = new Set([
  'Arsitektur & Renovasi',
  'Interior & Tata Ruang',
  'Material & Finishing',
  'Kenyamanan Rumah',
  'Eksterior & Lanskap',
  'Sistem & Konstruksi Rumah'
]);

/**
 * The strict author permitted for Hermes ingestion in contract v1.
 */
export const HERMES_ALLOWED_AUTHOR = 'RancangLoka Editorial Desk';

/**
 * Allowed frontmatter fields for Hermes contract_version 1.
 */
export const HERMES_ALLOWED_FRONTMATTER_FIELDS = new Set([
  'title',
  'description',
  'category',
  'author',
  'focus_keyword',
  'featured_image',
  'image_alt',
  'key_takeaways'
]);

/**
 * Forbidden publication/database control fields explicitly rejected in Hermes frontmatter.
 */
export const HERMES_FORBIDDEN_CONTROL_FIELDS = [
  'status',
  'slug',
  'id',
  'article_id',
  'category_id',
  'author_id',
  'published_at',
  'scheduled_at',
  'updated_at',
  'created_at',
  'is_featured',
  'is_trending',
  'is_sponsored',
  'views',
  'reading_time_minutes',
  'content_hash',
  'content_html'
];

/**
 * Structure of verified Hermes transport headers.
 */
export interface HermesHeaders {
  signatureVersion: string;
  timestamp: number;
  jobId: string;
  requestId: string;
  keyId: string;
  signature: string;
}

/**
 * Transport JSON payload contract.
 */
export interface HermesTransportPayload {
  source: string;
  contract_version: number;
  article_id: string;
  markdown: string;
}

/**
 * Computes lowercase hex SHA-256 digest of raw byte buffer or string.
 */
export async function computeSha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validates opaque identifier formats:
 * - article_id: art_[A-Za-z0-9_-]{16,80}
 * - job_id: job_[A-Za-z0-9_-]{16,80}
 * - request_id: req_[A-Za-z0-9_-]{16,80}
 */
export function isValidOpaqueId(id: string, prefix: 'art_' | 'job_' | 'req_'): boolean {
  if (!id || typeof id !== 'string') return false;
  if (!id.startsWith(prefix)) return false;
  const suffix = id.slice(prefix.length);
  if (suffix.length < 16 || suffix.length > 80) return false;
  return /^[A-Za-z0-9_-]+$/.test(suffix);
}

/**
 * Validates Hermes Key ID format.
 */
export function isValidKeyId(keyId: string): boolean {
  if (!keyId || typeof keyId !== 'string') return false;
  return /^[A-Za-z0-9_.-]{1,64}$/.test(keyId.trim());
}

/**
 * Builds the canonical string for HMAC-SHA256 signing.
 * Format:
 * v1\nPOST\n/api/internal/v1/hermes-ingest\n<TIMESTAMP>\n<JOB_ID>\n<REQUEST_ID>\n<SHA256_RAW_BODY>
 * No trailing newline.
 */
export function buildHermesCanonicalString(
  timestamp: number,
  jobId: string,
  requestId: string,
  rawBodySha256Hex: string
): string {
  return `v1\nPOST\n/api/internal/v1/hermes-ingest\n${timestamp}\n${jobId}\n${requestId}\n${rawBodySha256Hex}`;
}

/**
 * Resolves the Hermes ingestion secret for a given keyId.
 * Fails closed if keys are not configured.
 */
export function getHermesIngestSecret(
  keyId: string,
  env?: any
): { secret: string | null; configured: boolean; isKnownKey: boolean } {
  const currentKeyId = env?.RANCANGLOKA_HERMES_INGEST_KEY_CURRENT_ID ||
                       (globalThis as any).process?.env?.RANCANGLOKA_HERMES_INGEST_KEY_CURRENT_ID ||
                       '';
  const currentSecret = env?.RANCANGLOKA_HERMES_INGEST_KEY_CURRENT ||
                        (globalThis as any).process?.env?.RANCANGLOKA_HERMES_INGEST_KEY_CURRENT ||
                        '';

  const previousKeyId = env?.RANCANGLOKA_HERMES_INGEST_KEY_PREVIOUS_ID ||
                        (globalThis as any).process?.env?.RANCANGLOKA_HERMES_INGEST_KEY_PREVIOUS_ID ||
                        '';
  const previousSecret = env?.RANCANGLOKA_HERMES_INGEST_KEY_PREVIOUS ||
                         (globalThis as any).process?.env?.RANCANGLOKA_HERMES_INGEST_KEY_PREVIOUS ||
                         '';

  // Check if at least one ingestion key is configured
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
 * Signs a canonical string using HMAC-SHA256 with the provided secret (Test/Sender helper).
 */
export async function signHermesCanonicalString(
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
  return sigArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time cryptographic HMAC verification.
 */
export async function verifyHermesHmac(
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
    return await crypto.subtle.verify('HMAC', key, sigBytes as BufferSource, encoder.encode(canonicalString));
  } catch {
    return false;
  }
}

/**
 * Validates and extracts required Hermes transport headers.
 */
export function extractAndValidateHermesHeaders(
  headers: Headers,
  nowSec: number = Math.floor(Date.now() / 1000)
): { valid: boolean; data?: HermesHeaders; code?: string; message?: string } {
  const sigVersion = headers.get('x-rl-signature-version');
  const timestampStr = headers.get('x-rl-timestamp');
  const jobId = headers.get('x-rl-job-id');
  const requestId = headers.get('x-rl-request-id');
  const keyId = headers.get('x-rl-key-id');
  const sigHeader = headers.get('x-rl-signature');

  if (!sigVersion) {
    return { valid: false, code: 'SIGNATURE_VERSION_REQUIRED', message: 'Header X-RL-Signature-Version diperlukan.' };
  }
  if (sigVersion !== 'v1') {
    return { valid: false, code: 'SIGNATURE_VERSION_UNSUPPORTED', message: `Versi signature "${sigVersion}" tidak didukung.` };
  }

  if (!timestampStr) {
    return { valid: false, code: 'TIMESTAMP_INVALID', message: 'Header X-RL-Timestamp diperlukan.' };
  }
  const timestamp = parseInt(timestampStr.trim(), 10);
  if (isNaN(timestamp) || String(timestamp) !== timestampStr.trim() || timestamp <= 0) {
    return { valid: false, code: 'TIMESTAMP_INVALID', message: 'Format timestamp unix epoch tidak valid.' };
  }
  if (Math.abs(nowSec - timestamp) > HERMES_TIMESTAMP_WINDOW_SECONDS) {
    return { valid: false, code: 'TIMESTAMP_OUT_OF_WINDOW', message: 'Timestamp berada di luar jendela toleransi ±300 detik.' };
  }

  if (!jobId) {
    return { valid: false, code: 'JOB_ID_REQUIRED', message: 'Header X-RL-Job-ID diperlukan.' };
  }
  if (!isValidOpaqueId(jobId, 'job_')) {
    return { valid: false, code: 'JOB_ID_INVALID', message: 'Format X-RL-Job-ID tidak valid (harus diawali job_ dengan panjang aman).' };
  }

  if (!requestId) {
    return { valid: false, code: 'REQUEST_ID_REQUIRED', message: 'Header X-RL-Request-ID diperlukan.' };
  }
  if (!isValidOpaqueId(requestId, 'req_')) {
    return { valid: false, code: 'REQUEST_ID_INVALID', message: 'Format X-RL-Request-ID tidak valid (harus diawali req_ dengan panjang aman).' };
  }

  if (!keyId || !isValidKeyId(keyId)) {
    return { valid: false, code: 'KEY_NOT_ACCEPTED', message: 'Header X-RL-Key-ID tidak valid atau hilang.' };
  }

  if (!sigHeader) {
    return { valid: false, code: 'SIGNATURE_REQUIRED', message: 'Header X-RL-Signature diperlukan.' };
  }
  if (!sigHeader.startsWith('sha256=')) {
    return { valid: false, code: 'SIGNATURE_INVALID', message: 'Format X-RL-Signature harus menggunakan awalan sha256=.' };
  }
  const sigHex = sigHeader.slice(7).trim();
  if (sigHex.length !== 64 || !/^[0-9a-f]{64}$/.test(sigHex)) {
    return { valid: false, code: 'SIGNATURE_INVALID', message: 'Format hexadecimal X-RL-Signature tidak valid (harus 64 karakter lowercase hex).' };
  }

  return {
    valid: true,
    data: {
      signatureVersion: sigVersion,
      timestamp,
      jobId,
      requestId,
      keyId: keyId.trim(),
      signature: sigHex
    }
  };
}

/**
 * Validates Hermes transport JSON payload structure.
 */
export function validateHermesTransportPayload(
  body: any
): { valid: boolean; data?: HermesTransportPayload; code?: string; message?: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, code: 'MALFORMED_JSON', message: 'Payload body harus berupa JSON object.' };
  }

  const allowedFields = new Set(['source', 'contract_version', 'article_id', 'markdown']);
  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) {
      return {
        valid: false,
        code: 'TRANSPORT_FIELD_NOT_ALLOWED',
        message: `Field transport tidak diizinkan: "${key}".`
      };
    }
  }

  if (body.source !== HERMES_SOURCE) {
    return { valid: false, code: 'TRANSPORT_INVALID', message: `Field source harus bernilai "${HERMES_SOURCE}".` };
  }

  if (body.contract_version === undefined || body.contract_version === null) {
    return { valid: false, code: 'TRANSPORT_INVALID', message: 'Field contract_version wajib diisi.' };
  }
  if (body.contract_version !== HERMES_CONTRACT_VERSION) {
    return { valid: false, code: 'TRANSPORT_INVALID', message: `Versi contract_version "${body.contract_version}" tidak didukung (harus 1).` };
  }

  if (!body.article_id || typeof body.article_id !== 'string') {
    return { valid: false, code: 'TRANSPORT_INVALID', message: 'Field article_id wajib berupa string.' };
  }
  if (!isValidOpaqueId(body.article_id, 'art_')) {
    return { valid: false, code: 'TRANSPORT_INVALID', message: 'Format article_id tidak valid (harus diawali art_).' };
  }

  if (!body.markdown || typeof body.markdown !== 'string') {
    return { valid: false, code: 'TRANSPORT_INVALID', message: 'Field markdown wajib diisi string konten Markdown.' };
  }

  return {
    valid: true,
    data: {
      source: body.source,
      contract_version: body.contract_version,
      article_id: body.article_id,
      markdown: body.markdown
    }
  };
}

/**
 * Validates strict frontmatter policy for Hermes contract v1.
 */
export function validateHermesArticlePolicy(
  frontmatter: Record<string, any>
): { valid: boolean; code?: string; message?: string } {
  // 1. Check for explicitly forbidden publication/database control fields
  for (const field of HERMES_FORBIDDEN_CONTROL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(frontmatter, field)) {
      return {
        valid: false,
        code: 'FRONTMATTER_FIELD_NOT_ALLOWED',
        message: `Field frontmatter terlarang untuk Hermes: "${field}". Kontrol status dan ID hanya dilakukan server-side.`
      };
    }
  }

  // 2. Check for unknown fields outside the strict allowlist
  for (const key of Object.keys(frontmatter)) {
    if (!HERMES_ALLOWED_FRONTMATTER_FIELDS.has(key)) {
      return {
        valid: false,
        code: 'FRONTMATTER_FIELD_NOT_ALLOWED',
        message: `Field frontmatter tidak diizinkan: "${key}".`
      };
    }
  }

  // 3. Strict Category Whitelist (Only 6 Official categories, NO legacy/aliases)
  if (typeof frontmatter.category !== 'string' || !HERMES_ALLOWED_CATEGORIES.has(frontmatter.category)) {
    return {
      valid: false,
      code: 'HERMES_CATEGORY_NOT_ALLOWED',
      message: `Kategori "${frontmatter.category}" tidak diizinkan untuk Hermes. Hanya 6 kategori resmi yang diterima: ${Array.from(HERMES_ALLOWED_CATEGORIES).join(', ')}.`
    };
  }

  // 4. Strict Author Whitelist (Contract v1 accepts only "RancangLoka Editorial Desk")
  if (typeof frontmatter.author !== 'string' || frontmatter.author !== HERMES_ALLOWED_AUTHOR) {
    return {
      valid: false,
      code: 'HERMES_AUTHOR_NOT_ALLOWED',
      message: `Penulis "${frontmatter.author}" tidak diizinkan untuk Hermes contract v1. Hanya "${HERMES_ALLOWED_AUTHOR}" yang diterima.`
    };
  }

  return { valid: true };
}
