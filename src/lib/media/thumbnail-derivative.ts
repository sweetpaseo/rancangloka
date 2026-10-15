/**
 * RancangLoka — Automatic Article Featured Thumbnail Derivative Lifecycle
 * Milestone: ARTICLE_SUPPORT_THUMBNAIL_FINAL_HARDENING
 *
 * Responsibilities:
 * 1. Automatic generation of 160x160 WebP (1:1 center-crop, Lanczos, quality=85)
 *    compact derivatives for featured article images upon acceptance.
 * 2. Idempotent Cloudflare R2 storage under canonical key: thumbnails/<canonical-filename>.
 * 3. Safe degradation: Derivative failure NEVER breaks or corrupts original asset or article.
 * 4. Zero runtime client JS and zero CLS overhead (image-induced CLS protection).
 */

import { computeBufferSha256 } from './service.ts';

export const THUMBNAIL_PRESET_NAME = 'compactThumb';
export const THUMBNAIL_WIDTH = 160;
export const THUMBNAIL_HEIGHT = 160;
export const THUMBNAIL_QUALITY = 85;
export const THUMBNAIL_R2_NAMESPACE = 'thumbnails';
export const THUMBNAIL_ROLE = 'ARTICLE_PUBLIC_DERIVATIVE';

export interface ThumbnailDerivativeResult {
  success: boolean;
  thumbnailKey: string;
  thumbnailUrl: string;
  sha256?: string;
  byteSize?: number;
  reusedExisting: boolean;
  degraded?: boolean;
  error?: string;
}

export interface EnsureThumbnailParams {
  canonicalFilename: string;
  sourceImageBuffer?: ArrayBuffer | Uint8Array;
  bucket?: any;
  db?: any;
  articleId?: number;
  slotKey?: string;
}

/**
 * Normalizes any canonical media path or URL into its pure filename.
 * Handles paths such as:
 * - https://rancangloka.com/media/images/photo123.webp -> photo123.webp
 * - /media/images/photo123.webp -> photo123.webp
 * - /media/thumbnails/photo123.webp -> photo123.webp
 * - /media/photo123.webp -> photo123.webp
 * - photo123.webp -> photo123.webp
 */
export function extractCanonicalFilename(pathOrUrl: string): string {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  const clean = pathOrUrl.split('?')[0].split('#')[0].trim();
  const segments = clean.split('/');
  return segments[segments.length - 1] || clean;
}

/**
 * Derives the canonical R2 storage key for a thumbnail derivative.
 */
export function computeThumbnailR2Key(pathOrUrl: string): string {
  const filename = extractCanonicalFilename(pathOrUrl);
  return `${THUMBNAIL_R2_NAMESPACE}/${filename}`;
}

/**
 * Generates a 160x160 1:1 center-cropped WebP buffer.
 * Uses dynamic import of sharp to preserve Cloudflare Workers build compatibility.
 */
export async function generateCompactThumbnailWebp(
  sourceBuffer: ArrayBuffer | Uint8Array,
  quality: number = THUMBNAIL_QUALITY
): Promise<Uint8Array> {
  const buffer = Buffer.isBuffer(sourceBuffer)
    ? sourceBuffer
    : Buffer.from(sourceBuffer instanceof Uint8Array ? sourceBuffer : new Uint8Array(sourceBuffer));

  let sharp: any;
  try {
    // Dynamic import with string concatenation + @vite-ignore to prevent Vite SSR bundling issues
    const sharpModName = 'sh' + 'arp';
    const mod = await import(/* @vite-ignore */ sharpModName);
    sharp = mod.default || mod;
  } catch (err: any) {
    throw new Error(`Sharp library unavailable for thumbnail generation: ${err.message}`);
  }

  const outputBuffer = await sharp(buffer)
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
      fit: 'cover',
      position: 'center'
    })
    .webp({ quality })
    .toBuffer();

  return new Uint8Array(outputBuffer);
}

/**
 * Automatically prepares, generates, and persists the 160x160 compact thumbnail derivative
 * for a featured article image in R2.
 *
 * Idempotent: If the derivative object already exists in R2, it is safely reused without re-generation.
 * Fail-Safe: If thumbnail generation fails, returns degraded = true without throwing, ensuring the
 * canonical original image and article draft are never corrupted.
 */
export async function ensureFeaturedThumbnailDerivative(
  params: EnsureThumbnailParams
): Promise<ThumbnailDerivativeResult> {
  const { canonicalFilename, sourceImageBuffer, bucket, db, articleId, slotKey = 'featured' } = params;
  const filename = extractCanonicalFilename(canonicalFilename);

  if (!filename) {
    return {
      success: false,
      thumbnailKey: '',
      thumbnailUrl: '',
      reusedExisting: false,
      degraded: true,
      error: 'FILENAME_REQUIRED'
    };
  }

  const thumbnailKey = computeThumbnailR2Key(filename);
  const thumbnailUrl = `/media/${thumbnailKey}`;

  // 1. Idempotency Check in Cloudflare R2
  if (bucket && typeof bucket.head === 'function') {
    try {
      const existing = await bucket.head(thumbnailKey);
      if (existing && existing.size > 0) {
        return {
          success: true,
          thumbnailKey,
          thumbnailUrl,
          byteSize: existing.size,
          sha256: existing.customMetadata?.sha256,
          reusedExisting: true
        };
      }
    } catch (_) {
      // head check miss is normal; proceed to generation
    }
  }

  // 2. Resolve source image buffer
  let inputBuffer = sourceImageBuffer;
  if (!inputBuffer && bucket && typeof bucket.get === 'function') {
    const candidates = [
      `images/${filename}`,
      `media/images/${filename}`,
      filename,
      `media/${filename}`
    ];
    for (const cand of candidates) {
      try {
        const obj = await bucket.get(cand);
        if (obj) {
          inputBuffer = await obj.arrayBuffer();
          break;
        }
      } catch (_) {
        // continue trying
      }
    }
  }

  if (!inputBuffer || (inputBuffer as ArrayBuffer).byteLength === 0) {
    return {
      success: false,
      thumbnailKey,
      thumbnailUrl,
      reusedExisting: false,
      degraded: true,
      error: 'SOURCE_IMAGE_BUFFER_NOT_FOUND'
    };
  }

  // 3. Generate compact 160x160 WebP derivative
  let thumbBytes: Uint8Array;
  let thumbSha256: string;
  try {
    thumbBytes = await generateCompactThumbnailWebp(inputBuffer);
    thumbSha256 = await computeBufferSha256(
      thumbBytes.buffer.slice(thumbBytes.byteOffset, thumbBytes.byteOffset + thumbBytes.byteLength) as ArrayBuffer
    );
  } catch (genErr: any) {
    // Fail-safe degradation: do not throw or corrupt original image
    return {
      success: false,
      thumbnailKey,
      thumbnailUrl,
      reusedExisting: false,
      degraded: true,
      error: genErr.message || 'THUMBNAIL_GENERATION_FAILED'
    };
  }

  // 4. Persist derivative in R2 with immutable 1-year caching
  if (bucket && typeof bucket.put === 'function') {
    try {
      await bucket.put(thumbnailKey, thumbBytes, {
        httpMetadata: {
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000, immutable'
        },
        customMetadata: {
          role: THUMBNAIL_ROLE,
          preset: THUMBNAIL_PRESET_NAME,
          width: String(THUMBNAIL_WIDTH),
          height: String(THUMBNAIL_HEIGHT),
          originalFilename: filename,
          sha256: thumbSha256,
          slotKey
        }
      });
    } catch (putErr: any) {
      return {
        success: false,
        thumbnailKey,
        thumbnailUrl,
        reusedExisting: false,
        degraded: true,
        error: `R2_THUMBNAIL_PUT_FAILED: ${putErr.message}`
      };
    }
  }

  // 5. Audit / registration record (additive, fail-safe)
  if (db && typeof db.prepare === 'function') {
    try {
      const auditId = `aud_thumb_${thumbSha256.substring(0, 16)}_${Date.now()}`;
      await db
        .prepare(
          `INSERT INTO media_asset_audit (
            audit_id, asset_id, action, role, upload_id, derivative_id, transform_id, sha256, r2_key, safe_metadata_json
          ) VALUES (?, ?, 'REGISTER_DERIVATIVE', ?, NULL, ?, ?, ?, ?, ?)`
        )
        .bind(
          auditId,
          `ast_thumb_${thumbSha256.substring(0, 16)}`,
          THUMBNAIL_ROLE,
          `der_thumb_${filename}`,
          THUMBNAIL_PRESET_NAME,
          thumbSha256,
          thumbnailKey,
          JSON.stringify({
            original_filename: filename,
            preset: THUMBNAIL_PRESET_NAME,
            width: THUMBNAIL_WIDTH,
            height: THUMBNAIL_HEIGHT,
            article_id: articleId || null,
            slot_key: slotKey
          })
        )
        .run();
    } catch (_) {
      // Non-fatal if media_asset_audit table does not exist or schema differs
    }
  }

  return {
    success: true,
    thumbnailKey,
    thumbnailUrl,
    sha256: thumbSha256,
    byteSize: thumbBytes.byteLength,
    reusedExisting: false
  };
}
