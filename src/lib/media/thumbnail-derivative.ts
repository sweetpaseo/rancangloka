/**
 * RancangLoka — Automatic Article Featured Thumbnail Derivative Lifecycle
 * Milestone: ARTICLE_SUPPORT_THUMBNAIL_FINAL_HARDENING
 *
 * Responsibilities:
 * 1. Automatic Cloudflare R2 persistence and registration of 160x160 WebP compact derivatives
 *    under canonical key: thumbnails/<canonical-filename>.webp.
 * 2. Idempotent Cloudflare R2 storage: Reuses existing objects without re-generation.
 * 3. Safe degradation: Derivative failure NEVER breaks or corrupts original asset or article.
 * 4. Runtime-Safe Boundary: Worker execution NEVER loads or runs native C++ binaries (sharp).
 *    Transform execution is delegated to Node.js media preparation stage (node-thumbnail.ts).
 * 5. Failure Observability: Records durable diagnostic records in media_asset_audit for Dimas/admin backfill.
 * 6. Zero runtime client JS and zero CLS overhead (image-induced CLS protection).
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
  thumbnailBuffer?: ArrayBuffer | Uint8Array;
  transformExecutor?: (source: ArrayBuffer | Uint8Array) => Promise<Uint8Array>;
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
 * Always normalizes extension to .webp so that derivative bytes and URLs are strictly image/webp.
 */
export function computeThumbnailR2Key(pathOrUrl: string): string {
  const filename = extractCanonicalFilename(pathOrUrl);
  const webpFilename = filename.replace(/\.(jpe?g|png|webp)$/i, '') + '.webp';
  return `${THUMBNAIL_R2_NAMESPACE}/${webpFilename}`;
}

/**
 * Boundary Guard:
 * Direct invocation of generateCompactThumbnailWebp in Cloudflare Worker runtime is blocked.
 * Native image transforms belong strictly in the Node media preparation stage (node-thumbnail.ts).
 */
export async function generateCompactThumbnailWebp(
  _sourceBuffer: ArrayBuffer | Uint8Array,
  _quality: number = THUMBNAIL_QUALITY
): Promise<Uint8Array> {
  throw new Error(
    'Native image transform cannot execute in Cloudflare Worker runtime. Use prepareFeaturedThumbnail or generateCompactThumbnailWebp from src/lib/media/node-thumbnail.ts in Node.js media preparation stage.'
  );
}

/**
 * Automatically persists and registers the 160x160 compact thumbnail derivative
 * for a featured article image in R2 and D1.
 *
 * Idempotent: If the derivative object already exists in R2, it is safely reused without re-generation.
 * Fail-Safe: If thumbnail buffer is not yet available, records durable diagnostic evidence in
 * media_asset_audit for Dimas/admin backfill and returns degraded = true without throwing, ensuring the
 * canonical original image and article draft are never corrupted.
 */
export async function ensureFeaturedThumbnailDerivative(
  params: EnsureThumbnailParams
): Promise<ThumbnailDerivativeResult> {
  const {
    canonicalFilename,
    sourceImageBuffer,
    thumbnailBuffer,
    transformExecutor,
    bucket,
    db,
    articleId,
    slotKey = 'featured'
  } = params;
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
      // head check miss is normal; proceed to persistence
    }
  }

  // 2. Resolve thumbnail bytes (from pre-generated buffer or transform executor)
  let thumbBytes: Uint8Array | null = null;
  if (thumbnailBuffer && (thumbnailBuffer as ArrayBuffer).byteLength > 0) {
    thumbBytes = thumbnailBuffer instanceof Uint8Array
      ? thumbnailBuffer
      : new Uint8Array(thumbnailBuffer);
  } else if (transformExecutor) {
    let inputBuffer = sourceImageBuffer;
    if (!inputBuffer && bucket && typeof bucket.get === 'function') {
      const rawBase = filename.replace(/\.(jpe?g|png|webp)$/i, '');
      const candidateNames = Array.from(new Set([
        filename,
        `${rawBase}.webp`,
        `${rawBase}.jpg`,
        `${rawBase}.jpeg`,
        `${rawBase}.png`
      ]));
      const candidates: string[] = [];
      for (const name of candidateNames) {
        candidates.push(`images/${name}`, `media/images/${name}`, name, `media/${name}`);
      }
      for (const cand of candidates) {
        try {
          const obj = await bucket.get(cand);
          if (obj) {
            inputBuffer = await obj.arrayBuffer();
            break;
          }
        } catch (_) {}
      }
    }
    if (inputBuffer) {
      try {
        thumbBytes = await transformExecutor(inputBuffer);
      } catch (err: any) {
        // Will record failure in audit log below
      }
    }
  }

  // 3. Fallback / Safe Degradation with Failure Observability
  // If thumbnail bytes are unavailable in this execution context (e.g. Worker runtime):
  if (!thumbBytes || thumbBytes.byteLength === 0) {
    if (db && typeof db.prepare === 'function') {
      try {
        const auditId = `aud_thumb_pend_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        await db
          .prepare(
            `INSERT INTO media_asset_audit (
              audit_id, asset_id, action, role, upload_id, derivative_id, transform_id, sha256, r2_key, safe_metadata_json
            ) VALUES (?, ?, 'DERIVATIVE_PENDING_TRANSFORM', ?, NULL, ?, ?, NULL, ?, ?)`
          )
          .bind(
            auditId,
            `ast_pend_${filename}`,
            THUMBNAIL_ROLE,
            `der_thumb_${filename}`,
            THUMBNAIL_PRESET_NAME,
            thumbnailKey,
            JSON.stringify({
              reason: 'TRANSFORM_DELEGATED_TO_NODE_STAGE',
              original_filename: filename,
              thumbnail_key: thumbnailKey,
              article_id: articleId || null,
              slot_key: slotKey,
              status: 'PENDING_NODE_PREPARATION'
            })
          )
          .run();
      } catch (_) {}
    }

    return {
      success: false,
      thumbnailKey,
      thumbnailUrl,
      reusedExisting: false,
      degraded: true,
      error: 'DERIVATIVE_TRANSFORM_DELEGATED_TO_NODE_STAGE'
    };
  }

  // 4. Compute SHA-256 of the thumbnail bytes
  const thumbSha256 = await computeBufferSha256(
    thumbBytes.buffer.slice(thumbBytes.byteOffset, thumbBytes.byteOffset + thumbBytes.byteLength) as ArrayBuffer
  );

  // 5. Persist derivative in R2 with immutable 1-year caching
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

  // 6. Audit / registration record (additive, fail-safe)
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
