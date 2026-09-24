/**
 * RancangLoka — LokaMedia Runtime Media Service (MEDIA-0)
 *
 * Cloudflare Worker / Astro runtime media engine enforcing:
 * 1. media_assets.status describes binary asset health ONLY:
 *    ('PENDING', 'UPLOADING', 'VALIDATED', 'REJECTED', 'FAILED').
 * 2. Attachment lifecycle belongs exclusively to article_media: is_active = 1 / 0.
 * 3. Authoritative readiness requires active featured binding + VALIDATED image + alt_text.
 * 4. Legacy articles.featured_image/image_alt remain compatibility mirrors only.
 * 5. Global content-addressable storage: media/images/<sha256>.<ext>.
 * 6. Least-privilege authentication (independent of Hermes ingest).
 */

import {
  prepareStateMutationCapture,
  generateMutationOperationId
} from '../decision/trajectory-ledger.ts';
import {
  buildCanonicalPublicationPreflightState,
  computeCanonicalPreflightHash
} from '../decision/publication-preflight-state.ts';

export const MEDIA_TYPE_IMAGE = 'image';
export const MEDIA_TYPE_VIDEO = 'video'; // Reserved

export const SOURCE_TYPE_MANUAL_UPLOAD = 'manual_upload';
export const SOURCE_TYPE_LOKAMEDIA_EXTENSION = 'lokamedia_extension'; // Reserved
export const SOURCE_TYPE_FAL_GENERATED = 'fal_generated'; // Reserved

export const ROLE_FEATURED = 'featured';
export const ROLE_INLINE = 'inline';

export const STATUS_PENDING = 'PENDING';
export const STATUS_UPLOADING = 'UPLOADING';
export const STATUS_VALIDATED = 'VALIDATED';
export const STATUS_REJECTED = 'REJECTED';
export const STATUS_FAILED = 'FAILED';

export const READINESS_WAITING_MEDIA = 'WAITING_MEDIA';
export const READINESS_MEDIA_IN_PROGRESS = 'MEDIA_IN_PROGRESS';
export const READINESS_MEDIA_NEEDS_ATTENTION = 'MEDIA_NEEDS_ATTENTION';
export const READINESS_READY_FOR_REVIEW = 'READY_FOR_REVIEW';

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024; // 5 MiB strict ceiling
export const MIN_IMAGE_WIDTH = 600;
export const MIN_IMAGE_HEIGHT = 338;
export const MAX_IMAGE_WIDTH = 3840;
export const MAX_IMAGE_HEIGHT = 2160;

export const MIME_JPEG = 'image/jpeg';
export const MIME_PNG = 'image/png';
export const MIME_WEBP = 'image/webp';

export const SUPPORTED_MIMES = new Set([MIME_JPEG, MIME_PNG, MIME_WEBP]);

export interface ImageMetadata {
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  sha256: string;
  extension: string;
}

export interface MediaUploadParams {
  articleId: number;
  role: 'featured' | 'inline';
  slotKey?: string;
  sequence?: number;
  imageBuffer: ArrayBuffer;
  altText: string;
  caption?: string;
  clientSuppliedKey?: string;
  sourceType?: string;
  protocolVersion?: number;
  jobId?: string;
  expectedJobRevision?: number;
  promptVersion?: number;
  promptHash?: string;
  idempotencyKey?: string;
  clientSha256?: string;
  deviceId?: string | null;
  failureInjectionPoint?: string;
}

export interface MediaUploadResult {
  status: 'success';
  assetId: string;
  articleId: number;
  role: 'featured' | 'inline';
  publicUrl: string;
  storageKey: string;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  sha256: string;
  altText: string;
  deduplicated: boolean;
  editorialReadiness: string;
  slotKey: string;
  articleMediaId: number | null;
  receiptId?: string;
  receiptType?: string;
}

export class MediaRuntimeError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(`${code}: ${message}`);
    this.name = 'MediaRuntimeError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const SAFE_SLOT_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

const MEDIA_JOB_TERMINAL_STATES = new Set(['COMPLETE', 'FAILED_TERMINAL', 'SUPERSEDED', 'CANCELLED']);
const MEDIA_JOB_NEEDS_ATTENTION_STATES = new Set(['AUTH_REQUIRED', 'PROVIDER_BLOCKED', 'USER_ACTION_REQUIRED', 'FAILED_TERMINAL']);
const MEDIA_JOB_IN_PROGRESS_STATES = new Set([
  'LEASED',
  'PROMPT_PREPARING',
  'PROMPT_READY',
  'PROMPT_SENDING',
  'PROMPT_ACKNOWLEDGED',
  'GENERATING',
  'IMAGE_DETECTED',
  'CAPTURING',
  'CAPTURED',
  'UPLOAD_QUEUED',
  'UPLOADING',
  'UPLOAD_RECEIVED',
  'ATTACHING',
  'ATTACHMENT_CONFIRMED',
  'RECOVERING'
]);

function assertSafeSlotKey(slotKey: string): void {
  if (!SAFE_SLOT_KEY_PATTERN.test(slotKey)) {
    throw new MediaRuntimeError('INVALID_SLOT_KEY', 'slot_key tidak valid.', 400);
  }
}

function getResultFromReceipt(receipt: any, articleId: number, role: 'featured' | 'inline', slotKey: string): MediaUploadResult | null {
  if (!receipt || receipt.receipt_type !== 'ATTACHMENT_CONFIRMED' || !receipt.safe_payload_json) return null;
  try {
    const payload = JSON.parse(receipt.safe_payload_json);
    return {
      status: 'success',
      assetId: String(receipt.asset_id || payload.assetId),
      articleId,
      role,
      publicUrl: String(payload.publicUrl || ''),
      storageKey: String(payload.storageKey || ''),
      mimeType: String(payload.mimeType || ''),
      width: Number(payload.width || 0),
      height: Number(payload.height || 0),
      fileSize: Number(payload.fileSize || 0),
      sha256: String(receipt.sha256 || payload.sha256 || ''),
      altText: String(payload.altText || ''),
      deduplicated: Boolean(payload.deduplicated),
      editorialReadiness: String(payload.editorialReadiness || READINESS_WAITING_MEDIA),
      slotKey,
      articleMediaId: receipt.article_media_id ? Number(receipt.article_media_id) : null,
      receiptId: receipt.receipt_id,
      receiptType: receipt.receipt_type
    };
  } catch (_) {
    return null;
  }
}

/**
 * Computes lowercase hex SHA-256 using standard Web Crypto.
 */
export async function computeBufferSha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const byteArray = new Uint8Array(digest);
  return Array.from(byteArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates canonical asset identifier: ast_<24-chars>.
 */
export function generateRuntimeAssetId(): string {
  const randomBytes = new Uint8Array(18);
  crypto.getRandomValues(randomBytes);
  let binary = '';
  for (let i = 0; i < randomBytes.length; i++) {
    binary += String.fromCharCode(randomBytes[i]);
  }
  const base64 = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `ast_${base64}`;
}

/**
 * Parses image magic bytes and extracts width/height from binary ArrayBuffer.
 */
export function inspectImageBinary(buffer: ArrayBuffer): ImageMetadata {
  const bytes = new Uint8Array(buffer);
  const fileSize = bytes.byteLength;

  if (fileSize > MAX_MEDIA_BYTES) {
    throw new MediaRuntimeError(
      'FILE_TOO_LARGE',
      `File size (${fileSize} bytes) exceeds limit of ${MAX_MEDIA_BYTES} bytes (5 MiB)`,
      413
    );
  }

  if (fileSize < 16) {
    throw new MediaRuntimeError('CORRUPT_IMAGE_PAYLOAD', 'Payload too small to be a valid image', 422);
  }

  // 1. JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    const { width, height } = parseJpegDimensions(bytes);
    validateDimensions(width, height);
    return { mimeType: MIME_JPEG, width, height, fileSize, sha256: '', extension: 'jpg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    const { width, height } = parsePngDimensions(bytes);
    validateDimensions(width, height);
    return { mimeType: MIME_PNG, width, height, fileSize, sha256: '', extension: 'png' };
  }

  // 3. WebP: RIFF .... WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    fileSize >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    const { width, height } = parseWebpDimensions(bytes);
    validateDimensions(width, height);
    return { mimeType: MIME_WEBP, width, height, fileSize, sha256: '', extension: 'webp' };
  }

  throw new MediaRuntimeError(
    'INVALID_MIME_TYPE',
    'Binary magic bytes do not match supported image formats (JPEG, PNG, WebP)',
    415
  );
}

function validateDimensions(width: number, height: number): void {
  if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
    throw new MediaRuntimeError(
      'DIMENSIONS_TOO_SMALL',
      `Image dimensions (${width}x${height}) smaller than minimum allowed (${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT})`,
      422
    );
  }
  if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT) {
    throw new MediaRuntimeError(
      'DIMENSIONS_TOO_LARGE',
      `Image dimensions (${width}x${height}) exceed maximum allowed (${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT})`,
      422
    );
  }
}

function parsePngDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.byteLength < 24) {
    throw new MediaRuntimeError('CORRUPT_IMAGE_PAYLOAD', 'Truncated PNG header', 422);
  }
  const chunkType = String.fromCharCode(...bytes.slice(12, 16));
  if (chunkType !== 'IHDR') {
    throw new MediaRuntimeError('CORRUPT_IMAGE_PAYLOAD', 'PNG missing required IHDR chunk', 422);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  if (width <= 0 || height <= 0) {
    throw new MediaRuntimeError('CORRUPT_IMAGE_PAYLOAD', 'Invalid PNG dimensions in IHDR', 422);
  }
  return { width, height };
}

function parseJpegDimensions(bytes: Uint8Array): { width: number; height: number } {
  let offset = 2;
  const length = bytes.byteLength;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  while (offset < length) {
    if (offset + 1 >= length) break;
    if (bytes[offset] !== 0xff) break;

    const marker = bytes[offset + 1];
    offset += 2;

    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    if (offset + 2 > length) break;
    const segLength = view.getUint16(offset, false);
    if (segLength < 2 || offset + segLength > length) break;

    // SOF markers
    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      if (offset + 7 <= length) {
        const height = view.getUint16(offset + 3, false);
        const width = view.getUint16(offset + 5, false);
        if (width <= 0 || height <= 0) {
          throw new MediaRuntimeError('CORRUPT_IMAGE_PAYLOAD', 'Invalid JPEG dimensions', 422);
        }
        return { width, height };
      }
    }

    offset += segLength;
  }

  throw new MediaRuntimeError('CORRUPT_IMAGE_PAYLOAD', 'Could not parse valid JPEG Start of Frame (SOF) marker', 422);
}

function parseWebpDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.byteLength < 16) {
    throw new MediaRuntimeError('CORRUPT_IMAGE_PAYLOAD', 'Truncated WebP header', 422);
  }
  const chunkFourCC = String.fromCharCode(...bytes.slice(12, 16));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (chunkFourCC === 'VP8 ') {
    if (bytes.byteLength < 30) throw new MediaRuntimeError('CORRUPT_IMAGE_PAYLOAD', 'Truncated VP8 chunk', 422);
    if (bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      const width = view.getUint16(26, true) & 0x3fff;
      const height = view.getUint16(28, true) & 0x3fff;
      return { width, height };
    }
    throw new MediaRuntimeError('CORRUPT_IMAGE_PAYLOAD', 'Invalid VP8 startcode in WebP', 422);
  }

  if (chunkFourCC === 'VP8L') {
    if (bytes.byteLength < 25) throw new MediaRuntimeError('CORRUPT_IMAGE_PAYLOAD', 'Truncated VP8L chunk', 422);
    if (bytes[20] !== 0x2f) throw new MediaRuntimeError('CORRUPT_IMAGE_PAYLOAD', 'Invalid VP8L signature', 422);
    const b1 = bytes[21],
      b2 = bytes[22],
      b3 = bytes[23],
      b4 = bytes[24];
    const width = 1 + (((b2 & 0x3f) << 8) | b1);
    const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
    return { width, height };
  }

  if (chunkFourCC === 'VP8X') {
    if (bytes.byteLength < 30) throw new MediaRuntimeError('CORRUPT_IMAGE_PAYLOAD', 'Truncated VP8X chunk', 422);
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }

  throw new MediaRuntimeError('CORRUPT_IMAGE_PAYLOAD', `Unsupported WebP chunk: ${chunkFourCC}`, 422);
}

/**
 * Calculates authoritative editorial readiness for an article.
 * Requires:
 * 1. Active featured binding in article_media (is_active = 1)
 * 2. Backing media_assets record with status = 'VALIDATED'
 * 3. media_type = 'image'
 * 4. Non-empty alt text
 */
export async function calculateArticleReadiness(db: any, articleId: number): Promise<string> {
  let durableJobs: any[] = [];
  try {
    const { results } = await db
      .prepare(
        `
        SELECT job_id, slot_key, status, required_for_readiness
        FROM media_jobs
        WHERE article_id = ?
          AND status <> 'SUPERSEDED'
        ORDER BY sequence ASC, created_at ASC
      `
      )
      .bind(articleId)
      .all();
    durableJobs = results || [];
  } catch (_) {
    durableJobs = [];
  }

  if (durableJobs.length > 0) {
    let hasInProgress = false;
    for (const job of durableJobs) {
      if (Number(job.required_for_readiness) !== 1) continue;
      const status = String(job.status);
      if (MEDIA_JOB_NEEDS_ATTENTION_STATES.has(status)) return READINESS_MEDIA_NEEDS_ATTENTION;
      const attached = await db
        .prepare(
          `
          SELECT am.id
          FROM article_media am
          JOIN media_assets ma ON am.asset_id = ma.asset_id
          WHERE am.article_id = ?
            AND am.slot_key = ?
            AND am.is_active = 1
            AND ma.status = 'VALIDATED'
          LIMIT 1
        `
        )
        .bind(articleId, job.slot_key)
        .first();
      if (!attached) {
        if (MEDIA_JOB_IN_PROGRESS_STATES.has(status)) hasInProgress = true;
        else return READINESS_WAITING_MEDIA;
      }
    }
    return hasInProgress ? READINESS_MEDIA_IN_PROGRESS : READINESS_READY_FOR_REVIEW;
  }

  const row = await db
    .prepare(
      `
      SELECT am.is_active, ma.status AS asset_status, ma.media_type, ma.alt_text, a.image_alt
      FROM article_media am
      JOIN media_assets ma ON am.asset_id = ma.asset_id
      JOIN articles a ON am.article_id = a.id
      WHERE am.article_id = ? AND am.role = 'featured' AND am.is_active = 1
      LIMIT 1;
    `
    )
    .bind(articleId)
    .first();

  if (!row) {
    return READINESS_WAITING_MEDIA;
  }

  const isImage = row.media_type === MEDIA_TYPE_IMAGE;
  const isValidated = row.asset_status === STATUS_VALIDATED;
  const alt = (row.alt_text || row.image_alt || '').trim();

  if (isImage && isValidated && alt.length > 0) {
    return READINESS_READY_FOR_REVIEW;
  }

  return READINESS_WAITING_MEDIA;
}

/**
 * Hardened LokaMedia Upload Service.
 */
export async function processMediaUpload(
  params: MediaUploadParams,
  db: any,
  bucket: any
): Promise<MediaUploadResult> {
  // 1. Client key prohibition
  if (params.clientSuppliedKey !== undefined && params.clientSuppliedKey !== null) {
    throw new MediaRuntimeError('CLIENT_KEY_FORBIDDEN', 'Client cannot choose or supply storage_key', 400);
  }

  const sourceType = params.sourceType || SOURCE_TYPE_MANUAL_UPLOAD;
  const slotKey = params.slotKey || (params.role === ROLE_FEATURED ? 'featured' : 'inline');
  assertSafeSlotKey(slotKey);

  // 2. Draft Article Validation
  const article = await db.prepare('SELECT id, slug, status, content_md, content_html, content_hash FROM articles WHERE id = ?').bind(params.articleId).first();
  if (!article) {
    throw new MediaRuntimeError('ARTICLE_NOT_FOUND', `Article with ID ${params.articleId} not found`, 404);
  }
  if (article.status !== 'draft') {
    throw new MediaRuntimeError(
      'ARTICLE_NOT_DRAFT',
      `Target article ${params.articleId} is in status '${article.status}'. Media uploads restricted to draft articles.`,
      409
    );
  }

  let job: any = null;
  if (sourceType === SOURCE_TYPE_LOKAMEDIA_EXTENSION) {
    if (Number(params.protocolVersion) !== 1) {
      throw new MediaRuntimeError('PROTOCOL_VERSION_UNSUPPORTED', 'Versi protokol LokaMedia tidak didukung.', 426);
    }
    if (!params.jobId) throw new MediaRuntimeError('JOB_ID_REQUIRED', 'job_id wajib untuk upload LokaMedia Extension.', 400);
    if (!params.idempotencyKey) throw new MediaRuntimeError('IDEMPOTENCY_KEY_REQUIRED', 'idempotency_key wajib untuk upload LokaMedia Extension.', 400);

    const priorReceipt = await db
      .prepare(
        `
        SELECT receipt_id, job_id, idempotency_key, receipt_type, asset_id,
               article_media_id, sha256, safe_payload_json, created_at
        FROM media_job_receipts
        WHERE job_id = ? AND idempotency_key = ? AND receipt_type = 'ATTACHMENT_CONFIRMED'
        ORDER BY created_at DESC
        LIMIT 1
      `
      )
      .bind(params.jobId, params.idempotencyKey)
      .first();
    const replay = getResultFromReceipt(priorReceipt, params.articleId, params.role, slotKey);
    if (replay) return replay;

    job = await db.prepare('SELECT * FROM media_jobs WHERE job_id = ? LIMIT 1').bind(params.jobId).first();
    if (!job) throw new MediaRuntimeError('JOB_NOT_FOUND', `Media job ${params.jobId} tidak ditemukan.`, 404);
    if (Number(job.article_id) !== Number(params.articleId)) throw new MediaRuntimeError('JOB_ARTICLE_MISMATCH', 'job_id tidak cocok dengan article_id.', 409);
    if (job.slot_key !== slotKey) throw new MediaRuntimeError('JOB_SLOT_MISMATCH', 'job_id tidak cocok dengan slot_key.', 409);
    if (job.role !== params.role) throw new MediaRuntimeError('JOB_ROLE_MISMATCH', 'job_id tidak cocok dengan role.', 409);
    if (params.sequence !== undefined && Number(job.sequence) !== Number(params.sequence)) throw new MediaRuntimeError('JOB_SEQUENCE_MISMATCH', 'job_id tidak cocok dengan sequence.', 409);
    if (params.promptVersion !== undefined && Number(job.prompt_version) !== Number(params.promptVersion)) throw new MediaRuntimeError('PROMPT_VERSION_MISMATCH', 'prompt_version tidak cocok.', 409);
    if (params.promptHash && job.prompt_hash !== params.promptHash) throw new MediaRuntimeError('PROMPT_HASH_MISMATCH', 'prompt_hash tidak cocok.', 409);
    if (params.expectedJobRevision !== undefined && Number(job.job_revision) !== Number(params.expectedJobRevision)) throw new MediaRuntimeError('JOB_REVISION_CONFLICT', 'job_revision sudah berubah.', 409);
    if (job.status === 'CANCELLED') throw new MediaRuntimeError('JOB_CANCELLED', 'Media job sudah dibatalkan.', 409);
    if (job.status === 'SUPERSEDED') throw new MediaRuntimeError('JOB_SUPERSEDED', 'Media job sudah digantikan.', 409);
    if (MEDIA_JOB_TERMINAL_STATES.has(job.status)) throw new MediaRuntimeError('JOB_TERMINAL', 'Media job sudah terminal.', 409);
    if (job.lease_owner && params.deviceId && job.lease_owner !== params.deviceId) throw new MediaRuntimeError('LEASE_NOT_OWNER', 'Perangkat bukan pemilik lease.', 403);
  }

  if (params.failureInjectionPoint === 'AFTER_VALIDATION') throw new MediaRuntimeError('INJECTED_AFTER_VALIDATION', 'Injected failure after validation.', 500);

  // 3. Binary & Dimension Inspection
  const meta = inspectImageBinary(params.imageBuffer);
  meta.sha256 = await computeBufferSha256(params.imageBuffer);
  if (params.clientSha256 && params.clientSha256.toLowerCase() !== meta.sha256) {
    throw new MediaRuntimeError('CLIENT_SHA256_MISMATCH', 'client_sha256 tidak cocok dengan SHA-256 server.', 422);
  }
  if (params.failureInjectionPoint === 'AFTER_SHA') throw new MediaRuntimeError('INJECTED_AFTER_SHA', 'Injected failure after SHA.', 500);

  const storageKey = `media/images/${meta.sha256}.${meta.extension}`;
  const publicUrl = `/${storageKey}`;

  // 4. Global SHA-256 Deduplication
  let assetId: string;
  let deduplicated = false;

  const existingAsset = await db
    .prepare('SELECT asset_id, status FROM media_assets WHERE sha256 = ?')
    .bind(meta.sha256)
    .first();

  if (existingAsset && existingAsset.status === STATUS_VALIDATED) {
    assetId = existingAsset.asset_id;
    deduplicated = true;
  } else {
    assetId = generateRuntimeAssetId();

    // R2 Upload (Single global write)
    if (bucket && typeof bucket.put === 'function') {
      try {
        await bucket.put(storageKey, params.imageBuffer, {
          httpMetadata: {
            contentType: meta.mimeType,
            cacheControl: 'public, max-age=31536000, immutable'
          },
          customMetadata: {
            sha256: meta.sha256,
            assetId,
            mediaType: MEDIA_TYPE_IMAGE
          }
        });
      } catch (err: any) {
        throw new MediaRuntimeError('MEDIA_STORAGE_FAILED', `R2 storage write failure: ${err.message}`, 500);
      }
    }

    // Insert media_assets with status VALIDATED
    await db
      .prepare(
        `
        INSERT INTO media_assets (
          asset_id, media_type, source_type, storage_key, public_url,
          mime_type, width, height, file_size, sha256, alt_text, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `
      )
      .bind(
        assetId,
        MEDIA_TYPE_IMAGE,
        sourceType,
        storageKey,
        publicUrl,
        meta.mimeType,
        meta.width,
        meta.height,
        meta.fileSize,
        meta.sha256,
        params.altText,
        STATUS_VALIDATED
      )
        .run();
  }
  if (params.failureInjectionPoint === 'AFTER_MEDIA_ASSET') throw new MediaRuntimeError('INJECTED_AFTER_MEDIA_ASSET', 'Injected failure after media_assets.', 500);

  if (sourceType === SOURCE_TYPE_LOKAMEDIA_EXTENSION && params.jobId && params.idempotencyKey) {
    try {
      await db
        .prepare("UPDATE media_jobs SET status = 'UPLOAD_RECEIVED', idempotency_key = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?")
        .bind(params.idempotencyKey, params.jobId)
        .run();
      await db
        .prepare(
          `
          INSERT OR IGNORE INTO media_job_receipts (
            receipt_id, job_id, idempotency_key, receipt_type, asset_id, article_media_id, sha256, safe_payload_json
          ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
        `
        )
        .bind(`mjr_${params.jobId}_${params.idempotencyKey}_received`, params.jobId, params.idempotencyKey, deduplicated ? 'ASSET_EXISTS' : 'UPLOAD_RECEIVED', assetId, meta.sha256, JSON.stringify({ storageKey, publicUrl, deduplicated }))
        .run();
    } catch (_) {}
  }

  // 5. Relational Binding & Replacement
  const cleanAlt = params.altText.trim();

  // If identical active binding already exists on this article, return idempotently
  let articleMediaId: number | null = null;
  let existingActiveBinding = await db
    .prepare('SELECT id, asset_id FROM article_media WHERE article_id = ? AND slot_key = ? AND is_active = 1')
    .bind(params.articleId, slotKey)
    .first();
  if (!existingActiveBinding) {
    existingActiveBinding = await db
      .prepare('SELECT id, asset_id FROM article_media WHERE article_id = ? AND asset_id = ? AND role = ? AND is_active = 1')
      .bind(params.articleId, assetId, params.role)
      .first();
  }

  if (existingActiveBinding && existingActiveBinding.asset_id === assetId) {
    articleMediaId = Number(existingActiveBinding.id);
  } else {
    if (params.role === ROLE_FEATURED) {
      const priorAssetId = existingActiveBinding?.asset_id || null;

      // Deactivate previous active featured binding on this article
      const deactivateStmt = db
        .prepare('UPDATE article_media SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE article_id = ? AND slot_key = ? AND is_active = 1')
        .bind(params.articleId, slotKey);

      // Create new active featured binding
      const insertMediaStmt = db
        .prepare(
          `
          INSERT INTO article_media (
            article_id, asset_id, role, slot_key, is_active, sort_order, caption
          ) VALUES (?, ?, ?, ?, 1, 0, ?);
        `
        )
        .bind(params.articleId, assetId, ROLE_FEATURED, slotKey, params.caption || null);

      // Update compatibility mirrors on articles table
      // (content_md, content_html, content_hash remain UNTOUCHED; status remains DRAFT)
      const updateArticleStmt = db
        .prepare('UPDATE articles SET featured_image = ?, image_alt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?')
        .bind(publicUrl, cleanAlt, params.articleId, 'draft');

      // Trajectory Ledger Capture
      let ledgerStatements: any[] = [];
      try {
        const article = await db.prepare('SELECT slug, content_hash, manual_hold, reading_time_minutes, is_sponsored, status FROM articles WHERE id = ?').bind(params.articleId).first();
        if (article) {
          const beforeInput = {
            articleId: params.articleId,
            slug: article.slug,
            contentHash: article.content_hash,
            featuredAssetId: priorAssetId,
            manualHold: article.manual_hold,
            readingTimeMinutes: article.reading_time_minutes,
            isSponsored: Boolean(article.is_sponsored),
            status: article.status
          };
          const afterInput = {
            ...beforeInput,
            featuredAssetId: assetId
          };
          const fromHash = computeCanonicalPreflightHash(buildCanonicalPublicationPreflightState(beforeInput));
          const toHash = computeCanonicalPreflightHash(buildCanonicalPublicationPreflightState(afterInput));
          const mopId = generateMutationOperationId('media_binding', params.articleId, fromHash, toHash);

          const capture = prepareStateMutationCapture(db, {
            articleId: params.articleId,
            beforeInput,
            afterInput,
            captureSource: 'featured_media_binding',
            mutationOperationId: mopId,
            actorType: 'admin_operator'
          });
          ledgerStatements = capture.statements;
        }
      } catch {
        // safe fallback
      }

      const batchResults = await db.batch([
        deactivateStmt,
        insertMediaStmt,
        updateArticleStmt,
        ...ledgerStatements
      ]);
      articleMediaId = Number(batchResults[1]?.meta?.last_row_id ?? batchResults[1]?.lastInsertRowid ?? 0) || null;
    } else {
      // Inline media
      await db
        .prepare('UPDATE article_media SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE article_id = ? AND slot_key = ? AND is_active = 1')
        .bind(params.articleId, slotKey)
        .run();
      const insertRes = await db
        .prepare(
          `
          INSERT INTO article_media (
            article_id, asset_id, role, slot_key, is_active, sort_order, caption
          ) VALUES (?, ?, ?, ?, 1, 0, ?);
        `
        )
        .bind(params.articleId, assetId, ROLE_INLINE, slotKey, params.caption || null)
        .run();
      articleMediaId = Number(insertRes?.meta?.last_row_id ?? insertRes?.lastInsertRowid ?? 0) || null;
    }
  }
  if (params.failureInjectionPoint === 'AFTER_ARTICLE_MEDIA') throw new MediaRuntimeError('INJECTED_AFTER_ARTICLE_MEDIA', 'Injected failure after article_media.', 500);

  // 6. Evaluate Authoritative Readiness
  const readiness = await calculateArticleReadiness(db, params.articleId);
  let receiptId: string | undefined;
  if (sourceType === SOURCE_TYPE_LOKAMEDIA_EXTENSION && params.jobId && params.idempotencyKey) {
    const payload = {
      assetId,
      articleId: params.articleId,
      role: params.role,
      slotKey,
      publicUrl,
      storageKey,
      mimeType: meta.mimeType,
      width: meta.width,
      height: meta.height,
      fileSize: meta.fileSize,
      sha256: meta.sha256,
      altText: cleanAlt,
      deduplicated,
      editorialReadiness: readiness
    };
    receiptId = `mjr_${params.jobId}_${params.idempotencyKey}_attached`;
    await db
      .prepare(
        `
        INSERT OR IGNORE INTO media_job_receipts (
          receipt_id, job_id, idempotency_key, receipt_type, asset_id, article_media_id, sha256, safe_payload_json
        ) VALUES (?, ?, ?, 'ATTACHMENT_CONFIRMED', ?, ?, ?, ?)
      `
      )
      .bind(receiptId, params.jobId, params.idempotencyKey, assetId, articleMediaId, meta.sha256, JSON.stringify(payload))
      .run();
    if (params.failureInjectionPoint === 'AFTER_RECEIPT') throw new MediaRuntimeError('INJECTED_AFTER_RECEIPT', 'Injected failure after receipt.', 500);
    await db
      .prepare(
        `
        UPDATE media_jobs
        SET status = 'COMPLETE',
            completed_at = CURRENT_TIMESTAMP,
            job_revision = job_revision + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
      `
      )
      .bind(params.jobId)
      .run();
  }

  return {
    status: 'success',
    assetId,
    articleId: params.articleId,
    role: params.role,
    publicUrl,
    storageKey,
    mimeType: meta.mimeType,
    width: meta.width,
    height: meta.height,
    fileSize: meta.fileSize,
    sha256: meta.sha256,
    altText: cleanAlt,
    deduplicated,
    editorialReadiness: readiness,
    slotKey,
    articleMediaId,
    receiptId,
    receiptType: receiptId ? 'ATTACHMENT_CONFIRMED' : undefined
  };
}

/**
 * Unbinds / removes active featured media from an article.
 * Triggers MEDIA_REMOVED transition.
 */
export async function unbindFeaturedMedia(
  db: any,
  articleId: number,
  actorId?: string
): Promise<{ success: boolean; previousAssetId: string | null }> {
  const existing = await db
    .prepare("SELECT asset_id, slot_key FROM article_media WHERE article_id = ? AND role = 'featured' AND is_active = 1 LIMIT 1")
    .bind(articleId)
    .first();

  if (!existing) {
    return { success: true, previousAssetId: null };
  }

  const deactivateStmt = db
    .prepare("UPDATE article_media SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE article_id = ? AND role = 'featured' AND is_active = 1")
    .bind(articleId);

  const updateArticleStmt = db
    .prepare("UPDATE articles SET featured_image = '', image_alt = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(articleId);

  let ledgerStatements: any[] = [];
  try {
    const article = await db.prepare('SELECT slug, content_hash, manual_hold, reading_time_minutes, is_sponsored, status FROM articles WHERE id = ?').bind(articleId).first();
    if (article) {
      const beforeInput = {
        articleId,
        slug: article.slug,
        contentHash: article.content_hash,
        featuredAssetId: existing.asset_id,
        manualHold: article.manual_hold,
        readingTimeMinutes: article.reading_time_minutes,
        isSponsored: Boolean(article.is_sponsored),
        status: article.status
      };
      const afterInput = {
        ...beforeInput,
        featuredAssetId: null
      };
      const fromHash = computeCanonicalPreflightHash(buildCanonicalPublicationPreflightState(beforeInput));
      const toHash = computeCanonicalPreflightHash(buildCanonicalPublicationPreflightState(afterInput));
      const mopId = generateMutationOperationId('media_unbind', articleId, fromHash, toHash);

      const capture = prepareStateMutationCapture(db, {
        articleId,
        beforeInput,
        afterInput,
        captureSource: 'featured_media_unbind',
        mutationOperationId: mopId,
        actorType: 'admin_operator',
        actorId
      });
      ledgerStatements = capture.statements;
    }
  } catch {
    // safe fallback
  }

  await db.batch([deactivateStmt, updateArticleStmt, ...ledgerStatements]);
  return { success: true, previousAssetId: existing.asset_id };
}

/**
 * Binds an existing validated media asset to an article with role.
 * Triggers MEDIA_ADDED or MEDIA_REPLACED transition atomically via D1 batch.
 */
export async function bindMediaToArticle(
  db: any,
  params: {
    articleId: number;
    assetId: string;
    role?: string;
    slotKey?: string;
    publicUrl?: string;
    altText?: string;
    caption?: string;
    boundBy?: string;
  }
): Promise<{ success: boolean; articleMediaId: number | null }> {
  const role = params.role || ROLE_FEATURED;
  const slotKey = params.slotKey || (role === ROLE_FEATURED ? 'featured' : 'inline');
  const cleanAlt = (params.altText || '').trim();
  const publicUrl = params.publicUrl || `https://rancangloka.com/media/${params.assetId}.webp`;

  let existingActiveBinding = await db
    .prepare('SELECT id, asset_id FROM article_media WHERE article_id = ? AND slot_key = ? AND is_active = 1')
    .bind(params.articleId, slotKey)
    .first();
  if (!existingActiveBinding) {
    existingActiveBinding = await db
      .prepare('SELECT id, asset_id FROM article_media WHERE article_id = ? AND asset_id = ? AND role = ? AND is_active = 1')
      .bind(params.articleId, params.assetId, role)
      .first();
  }

  if (existingActiveBinding && existingActiveBinding.asset_id === params.assetId) {
    return { success: true, articleMediaId: Number(existingActiveBinding.id) };
  }

  const priorAssetId = existingActiveBinding?.asset_id || null;

  const deactivateStmt = db
    .prepare('UPDATE article_media SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE article_id = ? AND slot_key = ? AND is_active = 1')
    .bind(params.articleId, slotKey);

  const insertMediaStmt = db
    .prepare(
      `
      INSERT INTO article_media (
        article_id, asset_id, role, slot_key, is_active, sort_order, caption
      ) VALUES (?, ?, ?, ?, 1, 0, ?);
    `
    )
    .bind(params.articleId, params.assetId, role, slotKey, params.caption || null);

  const updateArticleStmt = db
    .prepare('UPDATE articles SET featured_image = ?, image_alt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?')
    .bind(publicUrl, cleanAlt, params.articleId, 'draft');

  let ledgerStatements: any[] = [];
  try {
    const article = await db.prepare('SELECT slug, content_hash, manual_hold, reading_time_minutes, is_sponsored, status FROM articles WHERE id = ?').bind(params.articleId).first();
    if (article) {
      const beforeInput = {
        articleId: params.articleId,
        slug: article.slug,
        contentHash: article.content_hash,
        featuredAssetId: priorAssetId,
        manualHold: article.manual_hold,
        readingTimeMinutes: article.reading_time_minutes,
        isSponsored: Boolean(article.is_sponsored),
        status: article.status
      };
      const afterInput = {
        ...beforeInput,
        featuredAssetId: params.assetId
      };
      const fromHash = computeCanonicalPreflightHash(buildCanonicalPublicationPreflightState(beforeInput));
      const toHash = computeCanonicalPreflightHash(buildCanonicalPublicationPreflightState(afterInput));
      const mopId = generateMutationOperationId('media_binding', params.articleId, fromHash, toHash);

      const capture = prepareStateMutationCapture(db, {
        articleId: params.articleId,
        beforeInput,
        afterInput,
        captureSource: 'featured_media_binding',
        mutationOperationId: mopId,
        actorType: 'admin_operator',
        actorId: params.boundBy
      });
      ledgerStatements = capture.statements;
    }
  } catch {
    // safe fallback
  }

  const batchResults = await db.batch([
    deactivateStmt,
    insertMediaStmt,
    updateArticleStmt,
    ...ledgerStatements
  ]);

  const articleMediaId = Number(batchResults[1]?.meta?.last_row_id ?? batchResults[1]?.lastInsertRowid ?? 0) || null;
  return { success: true, articleMediaId };
}

