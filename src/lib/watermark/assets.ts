/**
 * RancangLoka — LokaMedia Site-Level Watermark Master Asset Storage Service
 * Phase 5D4B: Site-Level Binary Asset + R2 Master Storage
 *
 * Requirements & Boundaries:
 * - Scope: Pure site-level asset. ZERO article_id, ZERO article_media rows.
 * - Format: Transparent PNG (canonical) & transparent WebP.
 * - Rejects: JPEG, GIF, SVG, AVIF, remote URLs, opaque images, spoofed MIME types.
 * - Boundaries: Max 2 MiB, Min 20x20 px, Max 2000x2000 px.
 * - Deduplication: SHA-256 content addressing (idempotent duplicate uploads).
 * - Storage: Private Cloudflare R2 bucket namespace (site/watermarks/master/<sha256>.<ext>).
 * - Metadata: D1 site_watermark_assets table.
 * - Transaction Safety: R2 put -> D1 insert; orphan cleanup on D1 failure.
 */

import zlib from 'node:zlib';
import { WATERMARK_SETTINGS_KEY } from './settings.ts';

export const WATERMARK_MASTER_PURPOSE = 'WATERMARK_MASTER';
export const WATERMARK_MASTER_R2_NAMESPACE = 'site/watermarks/master';
export const MAX_WATERMARK_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MiB (2,097,152 bytes)
export const MIN_WATERMARK_DIMENSIONS = Object.freeze({ width: 20, height: 20 });
export const MAX_WATERMARK_DIMENSIONS = Object.freeze({ width: 2000, height: 2000 });
export const SUPPORTED_WATERMARK_MIMES = Object.freeze(['image/png', 'image/webp']);
export const MASTER_ASSET_PUBLIC_BY_DEFAULT = false;
export const MASTER_DELETE_POLICY = 'REJECT_IF_REFERENCED_IN_SETTINGS';

export class WatermarkAssetValidationError extends Error {
  code: string;
  statusCode: number;
  constructor(message: string, code: string = 'VALIDATION_ERROR', statusCode: number = 400) {
    super(message);
    this.name = 'WatermarkAssetValidationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface WatermarkMasterAssetMetadata {
  asset_id: string;
  purpose: string;
  source_filename: string;
  mime_type: string;
  width: number;
  height: number;
  byte_size: number;
  sha256: string;
  r2_key: string;
  alpha_present: number;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Computes SHA-256 over exact binary bytes using Web Crypto.
 */
export async function computeBinarySha256(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as any);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parses and verifies PNG transparency by inspecting IHDR and scanlines.
 */
export function checkPngBinary(bytes: Uint8Array): {
  width: number;
  height: number;
  colorType: number;
  hasAlpha: boolean;
  transparentPixelFound: boolean;
} {
  if (bytes.byteLength < 24) {
    throw new WatermarkAssetValidationError('Truncated PNG header', 'CORRUPT_PAYLOAD', 422);
  }

  // Magic signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    throw new WatermarkAssetValidationError('Invalid PNG signature', 'MIME_SPOOF_REJECTED', 415);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunkType = String.fromCharCode(...bytes.slice(12, 16));
  if (chunkType !== 'IHDR') {
    throw new WatermarkAssetValidationError('PNG missing required IHDR chunk', 'CORRUPT_PAYLOAD', 422);
  }

  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  const bitDepth = bytes[24];
  const colorType = bytes[25];

  if (width <= 0 || height <= 0) {
    throw new WatermarkAssetValidationError('Invalid PNG dimensions', 'CORRUPT_PAYLOAD', 422);
  }

  let trnsHasTransparent = false;
  const idatParts: Uint8Array[] = [];

  let offset = 8;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) break;
    const chunkLen = view.getUint32(offset, false);
    const chunkName = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    const chunkDataOffset = offset + 8;

    if (chunkDataOffset + chunkLen > bytes.byteLength) break;

    if (chunkName === 'tRNS') {
      if (colorType === 3) {
        // Indexed-color: each byte is an alpha value
        for (let i = 0; i < chunkLen; i++) {
          if (bytes[chunkDataOffset + i] < 255) {
            trnsHasTransparent = true;
            break;
          }
        }
      } else {
        // Grayscale (0) or Truecolor (2): tRNS chunk specifies transparent color key
        trnsHasTransparent = true;
      }
    } else if (chunkName === 'IDAT') {
      idatParts.push(bytes.slice(chunkDataOffset, chunkDataOffset + chunkLen));
    } else if (chunkName === 'IEND') {
      break;
    }

    offset += 12 + chunkLen;
  }

  // If colorType 0 (Grayscale), 2 (RGB), or 3 (Indexed)
  if (colorType === 0 || colorType === 2 || colorType === 3) {
    return {
      width,
      height,
      colorType,
      hasAlpha: trnsHasTransparent,
      transparentPixelFound: trnsHasTransparent
    };
  }

  // If colorType 4 (Grayscale+Alpha) or 6 (RGBA)
  if (colorType === 4 || colorType === 6) {
    if (idatParts.length === 0) {
      return { width, height, colorType, hasAlpha: false, transparentPixelFound: false };
    }

    const totalIdatLen = idatParts.reduce((acc, p) => acc + p.byteLength, 0);
    const combinedIdat = new Uint8Array(totalIdatLen);
    let cur = 0;
    for (const part of idatParts) {
      combinedIdat.set(part, cur);
      cur += part.byteLength;
    }

    let decompressed: Buffer;
    try {
      decompressed = zlib.inflateSync(combinedIdat);
    } catch {
      throw new WatermarkAssetValidationError('Failed to decompress PNG IDAT stream', 'CORRUPT_PAYLOAD', 422);
    }

    const bytesPerPixel = colorType === 6 ? (bitDepth === 16 ? 8 : 4) : (bitDepth === 16 ? 4 : 2);
    const bytesPerSample = bitDepth === 16 ? 2 : 1;
    const stride = bytesPerPixel * width;

    let transparentPixelFound = false;
    let offsetDec = 0;

    const prevRow = new Uint8Array(stride);
    const currRow = new Uint8Array(stride);

    for (let y = 0; y < height; y++) {
      if (offsetDec >= decompressed.length) break;
      const filterType = decompressed[offsetDec++];
      if (offsetDec + stride > decompressed.length) break;
      const rawScanline = decompressed.subarray(offsetDec, offsetDec + stride);
      offsetDec += stride;

      // Reconstruct scanline using PNG filter type
      for (let i = 0; i < stride; i++) {
        const raw = rawScanline[i];
        const a = i >= bytesPerPixel ? currRow[i - bytesPerPixel] : 0;
        const b = prevRow[i];
        const c = i >= bytesPerPixel ? prevRow[i - bytesPerPixel] : 0;

        let val = raw;
        if (filterType === 0) {
          val = raw;
        } else if (filterType === 1) { // Sub
          val = (raw + a) & 0xff;
        } else if (filterType === 2) { // Up
          val = (raw + b) & 0xff;
        } else if (filterType === 3) { // Average
          val = (raw + Math.floor((a + b) / 2)) & 0xff;
        } else if (filterType === 4) { // Paeth
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          let pr = a;
          if (pb < pa && pb < pc) pr = b;
          else if (pc < pa) pr = c;
          val = (raw + pr) & 0xff;
        }
        currRow[i] = val;
      }

      // Check alpha of every pixel in reconstructed scanline
      for (let x = 0; x < width; x++) {
        const pixelOffset = x * bytesPerPixel;
        const alphaIdx = colorType === 6 ? pixelOffset + 3 * bytesPerSample : pixelOffset + 1 * bytesPerSample;
        const alphaVal = currRow[alphaIdx];
        if (alphaVal < 255) {
          transparentPixelFound = true;
          break;
        }
      }

      if (transparentPixelFound) break;
      prevRow.set(currRow);
    }

    return {
      width,
      height,
      colorType,
      hasAlpha: true,
      transparentPixelFound
    };
  }

  return { width, height, colorType, hasAlpha: false, transparentPixelFound: false };
}

/**
 * Parses and verifies WebP transparency and dimensions.
 */
export function checkWebpBinary(bytes: Uint8Array): {
  width: number;
  height: number;
  hasAlpha: boolean;
} {
  if (bytes.byteLength < 16) {
    throw new WatermarkAssetValidationError('Truncated WebP header', 'CORRUPT_PAYLOAD', 422);
  }

  // Magic: RIFF .... WEBP
  if (
    bytes[0] !== 0x52 ||
    bytes[1] !== 0x49 ||
    bytes[2] !== 0x46 ||
    bytes[3] !== 0x46 ||
    bytes[8] !== 0x57 ||
    bytes[9] !== 0x45 ||
    bytes[10] !== 0x42 ||
    bytes[11] !== 0x50
  ) {
    throw new WatermarkAssetValidationError('Invalid WebP signature', 'MIME_SPOOF_REJECTED', 415);
  }

  const chunkFourCC = String.fromCharCode(...bytes.slice(12, 16));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // VP8 (lossy simple) - has NO alpha channel
  if (chunkFourCC === 'VP8 ') {
    if (bytes.byteLength < 30) throw new WatermarkAssetValidationError('Truncated VP8 chunk', 'CORRUPT_PAYLOAD', 422);
    if (bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      const width = view.getUint16(26, true) & 0x3fff;
      const height = view.getUint16(28, true) & 0x3fff;
      return { width, height, hasAlpha: false };
    }
    throw new WatermarkAssetValidationError('Invalid VP8 startcode in WebP', 'CORRUPT_PAYLOAD', 422);
  }

  // VP8L (lossless) - signature 0x2F at offset 20
  if (chunkFourCC === 'VP8L') {
    if (bytes.byteLength < 25) throw new WatermarkAssetValidationError('Truncated VP8L chunk', 'CORRUPT_PAYLOAD', 422);
    if (bytes[20] !== 0x2f) throw new WatermarkAssetValidationError('Invalid VP8L signature', 'CORRUPT_PAYLOAD', 422);
    const b1 = bytes[21],
      b2 = bytes[22],
      b3 = bytes[23],
      b4 = bytes[24];
    const width = 1 + (((b2 & 0x3f) << 8) | b1);
    const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
    // Bit 28 is alpha_is_used (bit 4 of byte 24: b4 & 0x10)
    const hasAlpha = (b4 & 0x10) !== 0;
    return { width, height, hasAlpha };
  }

  // VP8X (extended WebP)
  if (chunkFourCC === 'VP8X') {
    if (bytes.byteLength < 30) throw new WatermarkAssetValidationError('Truncated VP8X chunk', 'CORRUPT_PAYLOAD', 422);
    const flags = bytes[20];
    const hasAlpha = (flags & 0x10) !== 0; // Bit 4 = Alpha flag
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height, hasAlpha };
  }

  throw new WatermarkAssetValidationError(`Unsupported WebP chunk: ${chunkFourCC}`, 'CORRUPT_PAYLOAD', 422);
}

/**
 * Validates master binary bytes against all Phase 5D4B rules:
 * - Size bound (<= 2 MiB)
 * - Dimension bounds (20x20 to 2000x2000)
 * - Mime types (PNG & WebP only; rejects JPEG, GIF, SVG, AVIF, remote URLs)
 * - File signature / magic bytes verification (rejects MIME spoofing)
 * - Transparency requirement (fails closed on completely opaque images)
 */
export function validateWatermarkMasterBinary(
  bytes: Uint8Array,
  declaredMime?: string
): {
  mime_type: string;
  width: number;
  height: number;
  byte_size: number;
  alpha_present: number;
  extension: string;
} {
  if (!bytes || bytes.byteLength === 0) {
    throw new WatermarkAssetValidationError('File upload kosong', 'EMPTY_FILE', 400);
  }

  if (bytes.byteLength > MAX_WATERMARK_UPLOAD_BYTES) {
    throw new WatermarkAssetValidationError(
      `Ukuran file (${bytes.byteLength} bytes) melebihi batas maksimum 2 MiB (${MAX_WATERMARK_UPLOAD_BYTES} bytes)`,
      'OVERSIZE',
      400
    );
  }

  if (bytes.byteLength < 16) {
    throw new WatermarkAssetValidationError('Payload terlalu kecil untuk format gambar valid', 'CORRUPT_PAYLOAD', 422);
  }

  // 1. Explicit rejection for JPEG (FF D8 FF)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    throw new WatermarkAssetValidationError(
      'Format JPEG tidak diizinkan. Watermark master harus berupa PNG atau WebP dengan latar transparan.',
      'UNSUPPORTED_TYPE',
      415
    );
  }

  // 2. Explicit rejection for GIF (GIF87a or GIF89a)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    throw new WatermarkAssetValidationError('Format GIF tidak diizinkan untuk watermark logo.', 'UNSUPPORTED_TYPE', 415);
  }

  // 3. Explicit rejection for text / XML / SVG
  const first32Chars = String.fromCharCode(...bytes.slice(0, Math.min(64, bytes.byteLength))).toLowerCase();
  if (
    first32Chars.includes('<svg') ||
    first32Chars.startsWith('<?xml') ||
    first32Chars.startsWith('<!doctype') ||
    first32Chars.startsWith('<html')
  ) {
    throw new WatermarkAssetValidationError('Format SVG atau teks tidak diizinkan untuk watermark master.', 'UNSUPPORTED_TYPE', 415);
  }

  // 4. Explicit rejection for remote URL
  const trimmedSample = first32Chars.trim();
  if (trimmedSample.startsWith('http://') || trimmedSample.startsWith('https://')) {
    throw new WatermarkAssetValidationError('Remote URL tidak diizinkan sebagai file binary.', 'REMOTE_URL_REJECTED', 400);
  }

  // 4. PNG Validation
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
    if (declaredMime && declaredMime !== 'image/png') {
      throw new WatermarkAssetValidationError(
        `MIME type dideklarasikan (${declaredMime}) tidak sesuai dengan signature file PNG asli.`,
        'MIME_SPOOF_REJECTED',
        415
      );
    }

    const pngInfo = checkPngBinary(bytes);

    if (
      pngInfo.width < MIN_WATERMARK_DIMENSIONS.width ||
      pngInfo.height < MIN_WATERMARK_DIMENSIONS.height
    ) {
      throw new WatermarkAssetValidationError(
        `Dimensi gambar (${pngInfo.width}x${pngInfo.height}) lebih kecil dari batas minimum ${MIN_WATERMARK_DIMENSIONS.width}x${MIN_WATERMARK_DIMENSIONS.height} px`,
        'DIMENSIONS_TOO_SMALL',
        422
      );
    }
    if (
      pngInfo.width > MAX_WATERMARK_DIMENSIONS.width ||
      pngInfo.height > MAX_WATERMARK_DIMENSIONS.height
    ) {
      throw new WatermarkAssetValidationError(
        `Dimensi gambar (${pngInfo.width}x${pngInfo.height}) melebihi batas maksimum ${MAX_WATERMARK_DIMENSIONS.width}x${MAX_WATERMARK_DIMENSIONS.height} px`,
        'DIMENSIONS_TOO_LARGE',
        422
      );
    }

    if (!pngInfo.transparentPixelFound) {
      throw new WatermarkAssetValidationError(
        'Gambar PNG tidak memiliki piksel transparan (alpha channel penuh 100%). Watermark logo master harus memiliki transparansi.',
        'OPAQUE_IMAGE_REJECTED',
        422
      );
    }

    return {
      mime_type: 'image/png',
      width: pngInfo.width,
      height: pngInfo.height,
      byte_size: bytes.byteLength,
      alpha_present: 1,
      extension: 'png'
    };
  }

  // 5. WebP Validation
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes.byteLength >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    if (declaredMime && declaredMime !== 'image/webp') {
      throw new WatermarkAssetValidationError(
        `MIME type dideklarasikan (${declaredMime}) tidak sesuai dengan signature file WebP asli.`,
        'MIME_SPOOF_REJECTED',
        415
      );
    }

    const webpInfo = checkWebpBinary(bytes);

    if (
      webpInfo.width < MIN_WATERMARK_DIMENSIONS.width ||
      webpInfo.height < MIN_WATERMARK_DIMENSIONS.height
    ) {
      throw new WatermarkAssetValidationError(
        `Dimensi gambar (${webpInfo.width}x${webpInfo.height}) lebih kecil dari batas minimum ${MIN_WATERMARK_DIMENSIONS.width}x${MIN_WATERMARK_DIMENSIONS.height} px`,
        'DIMENSIONS_TOO_SMALL',
        422
      );
    }
    if (
      webpInfo.width > MAX_WATERMARK_DIMENSIONS.width ||
      webpInfo.height > MAX_WATERMARK_DIMENSIONS.height
    ) {
      throw new WatermarkAssetValidationError(
        `Dimensi gambar (${webpInfo.width}x${webpInfo.height}) melebihi batas maksimum ${MAX_WATERMARK_DIMENSIONS.width}x${MAX_WATERMARK_DIMENSIONS.height} px`,
        'DIMENSIONS_TOO_LARGE',
        422
      );
    }

    if (!webpInfo.hasAlpha) {
      throw new WatermarkAssetValidationError(
        'Gambar WebP tidak memiliki alpha channel transparan. Watermark logo master harus memiliki transparansi.',
        'OPAQUE_IMAGE_REJECTED',
        422
      );
    }

    return {
      mime_type: 'image/webp',
      width: webpInfo.width,
      height: webpInfo.height,
      byte_size: bytes.byteLength,
      alpha_present: 1,
      extension: 'webp'
    };
  }

  // 6. Any other binary magic is rejected
  throw new WatermarkAssetValidationError(
    'Format file tidak didukung. Hanya file PNG atau WebP dengan alpha channel yang diizinkan sebagai watermark master.',
    'UNSUPPORTED_TYPE',
    415
  );
}

/**
 * Uploads, validates, deduplicates, and stores a watermark master asset in R2 + D1.
 */
export async function uploadWatermarkMasterAsset(options: {
  fileBuffer: Uint8Array;
  filename: string;
  declaredMime?: string;
  db: any;
  bucket: any;
  actor?: string;
}): Promise<{
  status: string;
  asset: WatermarkMasterAssetMetadata;
  deduplicated: boolean;
}> {
  const { fileBuffer, filename, declaredMime, db, bucket, actor = 'admin' } = options;

  // 1. Rigorous validation of binary bytes
  const validated = validateWatermarkMasterBinary(fileBuffer, declaredMime);

  // 2. Exact SHA-256 hash over unchanged original master bytes
  const sha256 = await computeBinarySha256(fileBuffer);

  // 3. Content Deduplication: Check if an identical master already exists in D1
  if (db && typeof db.prepare === 'function') {
    try {
      const existing = await db
        .prepare('SELECT * FROM site_watermark_assets WHERE sha256 = ? LIMIT 1')
        .bind(sha256)
        .first();

      if (existing) {
        return {
          status: 'success',
          asset: existing as WatermarkMasterAssetMetadata,
          deduplicated: true
        };
      }
    } catch (dbErr: any) {
      console.warn('D1 deduplication check fallback:', dbErr.message);
    }
  }

  // 4. Deterministic identity and R2 key
  const asset_id = `wma_${sha256.substring(0, 16)}`;
  const cleanFilename = (filename || `watermark-master.${validated.extension}`).split('/').pop()?.split('\\').pop() || `watermark-master.${validated.extension}`;
  const r2_key = `${WATERMARK_MASTER_R2_NAMESPACE}/${sha256}.${validated.extension}`;

  // 5. R2 Put (MASTER_ASSET_PUBLIC_BY_DEFAULT=NO: private cache-control)
  if (bucket && typeof bucket.put === 'function') {
    await bucket.put(r2_key, fileBuffer, {
      httpMetadata: {
        contentType: validated.mime_type,
        cacheControl: 'private, no-cache, no-transform'
      },
      customMetadata: {
        asset_id,
        purpose: WATERMARK_MASTER_PURPOSE,
        sha256,
        width: String(validated.width),
        height: String(validated.height)
      }
    });
  }

  // 6. D1 Insert with transaction safety
  const assetRecord: WatermarkMasterAssetMetadata = {
    asset_id,
    purpose: WATERMARK_MASTER_PURPOSE,
    source_filename: cleanFilename,
    mime_type: validated.mime_type,
    width: validated.width,
    height: validated.height,
    byte_size: validated.byte_size,
    sha256,
    r2_key,
    alpha_present: 1,
    status: 'VALIDATED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (db && typeof db.prepare === 'function') {
    try {
      await db
        .prepare(
          `INSERT INTO site_watermark_assets (
            asset_id, purpose, source_filename, mime_type,
            width, height, byte_size, sha256, r2_key, alpha_present, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          assetRecord.asset_id,
          assetRecord.purpose,
          assetRecord.source_filename,
          assetRecord.mime_type,
          assetRecord.width,
          assetRecord.height,
          assetRecord.byte_size,
          assetRecord.sha256,
          assetRecord.r2_key,
          assetRecord.alpha_present,
          assetRecord.status,
          assetRecord.created_at,
          assetRecord.updated_at
        )
        .run();
    } catch (insertErr: any) {
      // Transaction rollback: delete newly written R2 object to prevent orphan
      if (bucket && typeof bucket.delete === 'function') {
        try {
          await bucket.delete(r2_key);
        } catch (delErr) {
          console.error('Failed to clean up orphan R2 object after D1 error:', delErr);
        }
      }
      throw new WatermarkAssetValidationError(
        `Gagal menyimpan metadata asset ke D1: ${insertErr.message}`,
        'DATABASE_INSERT_FAILED',
        500
      );
    }

    // 7. Audit log
    try {
      const auditEntry = {
        event: 'WATERMARK_MASTER_UPLOADED',
        asset_id,
        mime: validated.mime_type,
        size: validated.byte_size,
        sha256,
        timestamp: new Date().toISOString(),
        actor
      };

      const existingAuditRow = await db
        .prepare('SELECT value FROM settings WHERE key = ? LIMIT 1')
        .bind('watermark_asset_audit')
        .first();
      let auditHistory: any[] = [];
      if (existingAuditRow && existingAuditRow.value) {
        try {
          auditHistory = JSON.parse(existingAuditRow.value);
        } catch {}
      }
      auditHistory.unshift(auditEntry);
      if (auditHistory.length > 50) auditHistory = auditHistory.slice(0, 50);

      await db
        .prepare(
          "INSERT INTO settings (key, value, updated_at) VALUES ('watermark_asset_audit', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
        )
        .bind(JSON.stringify(auditHistory))
        .run();
    } catch (auditErr) {
      console.warn('Failed to record watermark asset audit event:', auditErr);
    }
  }

  return {
    status: 'success',
    asset: assetRecord,
    deduplicated: false
  };
}

/**
 * Retrieves safe metadata for a watermark master asset.
 * Zero private credentials exposed.
 */
export async function getWatermarkMasterAsset(
  db: any,
  asset_id: string
): Promise<WatermarkMasterAssetMetadata | null> {
  if (!asset_id) return null;
  if (db && typeof db.prepare === 'function') {
    const row = await db
      .prepare('SELECT * FROM site_watermark_assets WHERE asset_id = ? LIMIT 1')
      .bind(asset_id)
      .first();
    if (row) return row as WatermarkMasterAssetMetadata;
  }
  return null;
}

/**
 * Fetches the raw binary stream from R2 for private admin preview.
 */
export async function getWatermarkMasterAssetObject(
  db: any,
  bucket: any,
  asset_id: string
): Promise<{
  asset: WatermarkMasterAssetMetadata;
  object: any;
}> {
  const asset = await getWatermarkMasterAsset(db, asset_id);
  if (!asset) {
    throw new WatermarkAssetValidationError('Watermark master asset tidak ditemukan', 'ASSET_NOT_FOUND', 404);
  }

  if (!bucket || typeof bucket.get !== 'function') {
    throw new WatermarkAssetValidationError('R2 MEDIA_BUCKET binding tidak tersedia', 'STORAGE_UNAVAILABLE', 500);
  }

  const object = await bucket.get(asset.r2_key);
  if (!object) {
    throw new WatermarkAssetValidationError('Binary object tidak ditemukan di R2 storage', 'OBJECT_NOT_FOUND', 404);
  }

  return { asset, object };
}

/**
 * Deletes a watermark master asset if not actively referenced in current watermark settings.
 */
export async function deleteWatermarkMasterAsset(
  db: any,
  bucket: any,
  asset_id: string
): Promise<{ success: boolean; message: string }> {
  const asset = await getWatermarkMasterAsset(db, asset_id);
  if (!asset) {
    throw new WatermarkAssetValidationError('Watermark master asset tidak ditemukan', 'ASSET_NOT_FOUND', 404);
  }

  // Verification: Reject deletion if asset is referenced in current watermark settings
  if (db && typeof db.prepare === 'function') {
    const settingsRow = await db
      .prepare('SELECT value FROM settings WHERE key = ? LIMIT 1')
      .bind(WATERMARK_SETTINGS_KEY || 'watermark_settings')
      .first();
    if (settingsRow && settingsRow.value) {
      try {
        const settings = JSON.parse(settingsRow.value);
        if (settings.image?.asset_id === asset_id) {
          throw new WatermarkAssetValidationError(
            'Tidak dapat menghapus asset yang sedang aktif digunakan dalam pengaturan watermark.',
            'ASSET_IN_USE',
            409
          );
        }
      } catch (err: any) {
        if (err instanceof WatermarkAssetValidationError) throw err;
      }
    }

    // Safe delete from D1
    await db.prepare('DELETE FROM site_watermark_assets WHERE asset_id = ?').bind(asset_id).run();
  }

  // Delete from R2
  if (bucket && typeof bucket.delete === 'function') {
    await bucket.delete(asset.r2_key);
  }

  return {
    success: true,
    message: `Asset ${asset_id} berhasil dihapus.`
  };
}
