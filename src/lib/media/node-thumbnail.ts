/**
 * RancangLoka — Node.js Media Preparation & Transform Stage
 * Milestone: ARTICLE_SUPPORT_THUMBNAIL_FINAL_HARDENING
 *
 * Responsibilities:
 * 1. Safe, native image transform (sharp) restricted strictly to Node.js execution environments.
 * 2. 160x160 1:1 center-cropped WebP generation (quality=85) from any accepted source format (WebP, JPEG, PNG).
 * 3. Zero runtime client JS and zero CLS overhead (image-induced CLS protection).
 * 4. Boundary invariant: Sharp is NEVER executed in Cloudflare Worker runtime (workerd).
 */

import sharp from 'sharp';
import {
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_QUALITY,
  extractCanonicalFilename,
  computeThumbnailR2Key,
  ensureFeaturedThumbnailDerivative,
  type ThumbnailDerivativeResult
} from './thumbnail-derivative.ts';
import { computeBufferSha256 } from './service.ts';

export interface PreparedThumbnailResult {
  thumbnailBytes: Uint8Array;
  thumbnailSha256: string;
  thumbnailKey: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  mimeType: 'image/webp';
}

/**
 * Generates a 160x160 1:1 center-cropped WebP buffer from any accepted image format.
 * Executes strictly in Node.js environment.
 */
export async function generateCompactThumbnailWebp(
  sourceBuffer: ArrayBuffer | Uint8Array,
  quality: number = THUMBNAIL_QUALITY
): Promise<Uint8Array> {
  const buffer = Buffer.isBuffer(sourceBuffer)
    ? sourceBuffer
    : Buffer.from(sourceBuffer instanceof Uint8Array ? sourceBuffer : new Uint8Array(sourceBuffer));

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
 * Prepares the compact 160x160 WebP thumbnail derivative during Node media preparation stage.
 */
export async function prepareFeaturedThumbnail(
  sourceBuffer: ArrayBuffer | Uint8Array,
  canonicalFilenameOrUrl: string,
  quality: number = THUMBNAIL_QUALITY
): Promise<PreparedThumbnailResult> {
  const filename = extractCanonicalFilename(canonicalFilenameOrUrl);
  const thumbnailKey = computeThumbnailR2Key(filename);
  const thumbnailUrl = `/media/${thumbnailKey}`;

  const thumbnailBytes = await generateCompactThumbnailWebp(sourceBuffer, quality);
  const thumbnailSha256 = await computeBufferSha256(
    thumbnailBytes.buffer.slice(
      thumbnailBytes.byteOffset,
      thumbnailBytes.byteOffset + thumbnailBytes.byteLength
    ) as ArrayBuffer
  );

  return {
    thumbnailBytes,
    thumbnailSha256,
    thumbnailKey,
    thumbnailUrl,
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    mimeType: 'image/webp'
  };
}

/**
 * End-to-end Node media preparation and persistence helper.
 * Generates 160x160 compact WebP derivative using sharp and persists to R2 / D1.
 */
export async function ensureNodeThumbnailDerivative(params: {
  canonicalFilename: string;
  sourceImageBuffer: ArrayBuffer | Uint8Array;
  bucket?: any;
  db?: any;
  articleId?: number;
  slotKey?: string;
  quality?: number;
}): Promise<ThumbnailDerivativeResult> {
  const thumbBytes = await generateCompactThumbnailWebp(params.sourceImageBuffer, params.quality);
  return ensureFeaturedThumbnailDerivative({
    canonicalFilename: params.canonicalFilename,
    sourceImageBuffer: params.sourceImageBuffer,
    thumbnailBuffer: thumbBytes,
    bucket: params.bucket,
    db: params.db,
    articleId: params.articleId,
    slotKey: params.slotKey
  });
}
