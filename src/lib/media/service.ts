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
  imageBuffer: ArrayBuffer;
  altText: string;
  caption?: string;
  clientSuppliedKey?: string;
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

  // 3. Binary & Dimension Inspection
  const meta = inspectImageBinary(params.imageBuffer);
  meta.sha256 = await computeBufferSha256(params.imageBuffer);

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
        SOURCE_TYPE_MANUAL_UPLOAD,
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

  // 5. Relational Binding & Replacement
  const cleanAlt = params.altText.trim();

  // If identical active binding already exists on this article, return idempotently
  const existingActiveBinding = await db
    .prepare('SELECT id FROM article_media WHERE article_id = ? AND asset_id = ? AND role = ? AND is_active = 1')
    .bind(params.articleId, assetId, params.role)
    .first();

  if (!existingActiveBinding) {
    if (params.role === ROLE_FEATURED) {
      // Deactivate previous active featured binding on this article
      await db
        .prepare('UPDATE article_media SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE article_id = ? AND role = ? AND is_active = 1')
        .bind(params.articleId, ROLE_FEATURED)
        .run();

      // Create new active featured binding
      await db
        .prepare(
          `
          INSERT INTO article_media (
            article_id, asset_id, role, slot_key, is_active, sort_order, caption
          ) VALUES (?, ?, ?, ?, 1, 0, ?);
        `
        )
        .bind(params.articleId, assetId, ROLE_FEATURED, 'primary', params.caption || null)
        .run();

      // Update compatibility mirrors on articles table
      // (content_md, content_html, content_hash remain UNTOUCHED; status remains DRAFT)
      await db
        .prepare('UPDATE articles SET featured_image = ?, image_alt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?')
        .bind(publicUrl, cleanAlt, params.articleId, 'draft')
        .run();
    } else {
      // Inline media
      await db
        .prepare(
          `
          INSERT INTO article_media (
            article_id, asset_id, role, slot_key, is_active, sort_order, caption
          ) VALUES (?, ?, ?, ?, 1, 0, ?);
        `
        )
        .bind(params.articleId, assetId, ROLE_INLINE, 'inline', params.caption || null)
        .run();
    }
  }

  // 6. Evaluate Authoritative Readiness
  const readiness = await calculateArticleReadiness(db, params.articleId);

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
    editorialReadiness: readiness
  };
}
