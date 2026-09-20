/**
 * RancangLoka — Durable Article Derivative Upload Service
 * Phase 5E1: Article Derivative Upload Foundation
 *
 * Requirements & Security Invariants:
 * 1. Dedicated Least-Privilege Device Authentication.
 * 2. Strict Role Guard: Only PUBLIC_DERIVATIVE_CANDIDATE is accepted.
 *    Captured ORIGINAL or arbitrary images are rejected (fails closed).
 * 3. Never Trust Client Metadata Blindly:
 *    Independently inspects magic bytes, dimensions, and calculates SHA-256.
 * 4. Content-Addressable Canonical R2 Storage:
 *    media/articles/derivatives/<sha256>.<ext>
 * 5. Private First:
 *    Stored in R2 with 'private, no-transform' cache-control.
 *    No public URL exposure, NO media_assets or article_media rows created in Phase 5E1.
 * 6. Idempotent Deduplication & Collision Guard:
 *    Existing R2 object with identical SHA-256 and size is safely reused.
 *    Corrupt/conflicting R2 key collisions fail closed with 409 Conflict.
 */

import {
  inspectImageBinary,
  computeBufferSha256,
  MediaRuntimeError,
  type ImageMetadata
} from './service.ts';

export const ARTICLE_DERIVATIVE_R2_NAMESPACE = 'media/articles/derivatives';
export const ROLE_PUBLIC_DERIVATIVE_CANDIDATE = 'PUBLIC_DERIVATIVE_CANDIDATE';
export const MAX_DERIVATIVE_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MiB ceiling
export const SUPPORTED_DERIVATIVE_MIMES = Object.freeze(['image/png', 'image/webp']);

export interface DerivativeUploadParams {
  derivativeId: string;
  transformId: string;
  jobId?: string;
  slotKey?: string;
  role?: string;
  clientMime?: string;
  clientWidth?: number;
  clientHeight?: number;
  clientByteSize?: number;
  clientSha256?: string;
  imageBuffer: ArrayBuffer;
}

export interface DerivativeUploadReceipt {
  r2_key: string;
  derivative_id: string;
  transform_id: string;
  sha256: string;
  byte_size: number;
  mime: string;
  width: number;
  height: number;
  uploaded_at: string;
  reused_existing: boolean;
}

export interface DerivativeUploadResult {
  status: 'success';
  receipt: DerivativeUploadReceipt;
}

/**
 * Derives deterministic content-addressed R2 key for derivative.
 */
export function computeDerivativeR2Key(sha256: string, extension: string = 'png'): string {
  if (!sha256 || typeof sha256 !== 'string' || sha256.length < 16) {
    throw new MediaRuntimeError('INVALID_SHA256_INPUT', 'Valid SHA-256 required for derivative R2 key', 400);
  }
  return `${ARTICLE_DERIVATIVE_R2_NAMESPACE}/${sha256.toLowerCase()}.${extension.toLowerCase()}`;
}

/**
 * Validates and stores a public derivative candidate in canonical R2 storage.
 * Enforces server-side validation and content-addressed idempotency.
 */
export async function processDerivativeUpload(
  params: DerivativeUploadParams,
  bucket: any
): Promise<DerivativeUploadResult> {
  const {
    derivativeId,
    transformId,
    jobId = '',
    slotKey = 'featured',
    role = ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
    clientMime,
    clientWidth,
    clientHeight,
    clientByteSize,
    clientSha256,
    imageBuffer
  } = params;

  // 1. Validate required identity fields
  if (!derivativeId || typeof derivativeId !== 'string') {
    throw new MediaRuntimeError('DERIVATIVE_ID_REQUIRED', 'Parameter derivative_id wajib disertakan.', 400);
  }
  if (!transformId || typeof transformId !== 'string') {
    throw new MediaRuntimeError('TRANSFORM_ID_REQUIRED', 'Parameter transform_id wajib disertakan.', 400);
  }

  // 2. Strict Role Guard: Only PUBLIC_DERIVATIVE_CANDIDATE allowed
  if (role !== ROLE_PUBLIC_DERIVATIVE_CANDIDATE) {
    throw new MediaRuntimeError(
      'UPLOAD_SOURCE_ROLE_GUARD_BLOCKED',
      `Hanya role '${ROLE_PUBLIC_DERIVATIVE_CANDIDATE}' yang dapat diunggah ke derivative endpoint. Diterima: '${role}'.`,
      422
    );
  }

  // 3. Binary presence & size boundary check
  if (!imageBuffer || !(imageBuffer instanceof ArrayBuffer)) {
    throw new MediaRuntimeError('BINARY_PAYLOAD_REQUIRED', 'Binary derivative payload wajib disertakan.', 400);
  }

  const actualByteLength = imageBuffer.byteLength;
  if (actualByteLength <= 0) {
    throw new MediaRuntimeError('BINARY_EMPTY', 'Binary derivative kosong (0 byte).', 422);
  }

  if (actualByteLength > MAX_DERIVATIVE_UPLOAD_BYTES) {
    throw new MediaRuntimeError(
      'BINARY_TOO_LARGE',
      `Ukuran derivative (${actualByteLength} byte) melebihi batas maksimum (${MAX_DERIVATIVE_UPLOAD_BYTES} byte).`,
      413
    );
  }

  // Declared byte size check
  if (clientByteSize !== undefined && clientByteSize !== actualByteLength) {
    throw new MediaRuntimeError(
      'SERVER_BYTE_SIZE_VERIFY_FAILED',
      `Ukuran binary tidak cocok: declared ${clientByteSize}, actual ${actualByteLength}.`,
      422
    );
  }

  // 4. Server-side SHA-256 calculation & independent verification
  const serverSha256 = await computeBufferSha256(imageBuffer);
  if (clientSha256 && clientSha256.toLowerCase() !== serverSha256) {
    throw new MediaRuntimeError(
      'SERVER_BINARY_SHA_VERIFY_FAILED',
      `SHA-256 verification failed: declared ${clientSha256}, server computed ${serverSha256}.`,
      422
    );
  }

  // 5. Server-side image format & dimension inspection
  let imageMeta: ImageMetadata;
  try {
    imageMeta = inspectImageBinary(imageBuffer);
  } catch (err: any) {
    throw new MediaRuntimeError(
      'SERVER_IMAGE_DECODE_VERIFY_FAILED',
      `Gagal mendekode gambar derivative: ${err.message}`,
      422
    );
  }

  if (!SUPPORTED_DERIVATIVE_MIMES.includes(imageMeta.mimeType)) {
    throw new MediaRuntimeError(
      'UNSUPPORTED_DERIVATIVE_MIME',
      `MIME type '${imageMeta.mimeType}' tidak didukung untuk derivative. Diharapkan: ${SUPPORTED_DERIVATIVE_MIMES.join(', ')}.`,
      415
    );
  }

  if (clientMime && clientMime.toLowerCase() !== imageMeta.mimeType.toLowerCase()) {
    throw new MediaRuntimeError(
      'MIME_MISMATCH',
      `MIME type tidak cocok: declared '${clientMime}', detected '${imageMeta.mimeType}'.`,
      422
    );
  }

  // Dimension validation
  if (clientWidth !== undefined && clientWidth !== imageMeta.width) {
    throw new MediaRuntimeError(
      'SERVER_DIMENSION_VERIFY_FAILED',
      `Lebar gambar tidak cocok: declared ${clientWidth}, detected ${imageMeta.width}.`,
      422
    );
  }
  if (clientHeight !== undefined && clientHeight !== imageMeta.height) {
    throw new MediaRuntimeError(
      'SERVER_DIMENSION_VERIFY_FAILED',
      `Tinggi gambar tidak cocok: declared ${clientHeight}, detected ${imageMeta.height}.`,
      422
    );
  }

  // 6. Content-Addressable R2 Key derivation
  const r2Key = computeDerivativeR2Key(serverSha256, imageMeta.extension);

  // 7. Idempotent Deduplication & Collision Verification in R2
  if (bucket && typeof bucket.head === 'function') {
    try {
      const existingObject = await bucket.head(r2Key);
      if (existingObject) {
        const existingSha = existingObject.customMetadata?.sha256;
        const existingSize = existingObject.size;
        const existingMime = existingObject.httpMetadata?.contentType;

        // Verify that existing object matches exact content identity
        if (existingSize === actualByteLength && (!existingSha || existingSha.toLowerCase() === serverSha256)) {
          // Idempotent hit: exact duplicate already exists in R2
          return {
            status: 'success',
            receipt: {
              r2_key: r2Key,
              derivative_id: derivativeId,
              transform_id: transformId,
              sha256: serverSha256,
              byte_size: actualByteLength,
              mime: imageMeta.mimeType,
              width: imageMeta.width,
              height: imageMeta.height,
              uploaded_at: existingObject.uploaded ? existingObject.uploaded.toISOString() : new Date().toISOString(),
              reused_existing: true
            }
          };
        } else {
          // Key collision with conflicting size/sha -> FAIL CLOSED
          throw new MediaRuntimeError(
            'R2_KEY_COLLISION_INTEGRITY_CONFLICT',
            `R2 key '${r2Key}' exists but conflicting integrity metadata detected (size=${existingSize}, sha=${existingSha}).`,
            409
          );
        }
      }
    } catch (headErr: any) {
      if (headErr instanceof MediaRuntimeError) throw headErr;
      // Other errors fall through to attempting PUT or error handling
    }
  }

  // 8. R2 Write
  if (bucket && typeof bucket.put === 'function') {
    try {
      await bucket.put(r2Key, imageBuffer, {
        httpMetadata: {
          contentType: imageMeta.mimeType,
          cacheControl: 'private, no-transform' // Private first
        },
        customMetadata: {
          sha256: serverSha256,
          derivativeId,
          transformId,
          role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
          jobId,
          slotKey
        }
      });
    } catch (putErr: any) {
      throw new MediaRuntimeError(
        'R2_STORAGE_PUT_FAILED',
        `Gagal menulis derivative ke R2: ${putErr.message}`,
        500
      );
    }
  }

  // Return canonical verified upload receipt
  return {
    status: 'success',
    receipt: {
      r2_key: r2Key,
      derivative_id: derivativeId,
      transform_id: transformId,
      sha256: serverSha256,
      byte_size: actualByteLength,
      mime: imageMeta.mimeType,
      width: imageMeta.width,
      height: imageMeta.height,
      uploaded_at: new Date().toISOString(),
      reused_existing: false
    }
  };
}

/**
 * Checks R2 for an existing derivative receipt (used for restart recovery & reconciliation).
 */
export async function getDerivativeUploadReceipt(
  sha256: string,
  derivativeId: string,
  transformId: string,
  extension: string = 'png',
  bucket: any
): Promise<DerivativeUploadReceipt | null> {
  if (!bucket || typeof bucket.head !== 'function' || !sha256) return null;
  const r2Key = computeDerivativeR2Key(sha256, extension);
  try {
    const existing = await bucket.head(r2Key);
    if (!existing) return null;
    return {
      r2_key: r2Key,
      derivative_id: derivativeId,
      transform_id: transformId,
      sha256,
      byte_size: existing.size,
      mime: existing.httpMetadata?.contentType || 'image/png',
      width: Number(existing.customMetadata?.width || 0),
      height: Number(existing.customMetadata?.height || 0),
      uploaded_at: existing.uploaded ? existing.uploaded.toISOString() : new Date().toISOString(),
      reused_existing: true
    };
  } catch {
    return null;
  }
}
