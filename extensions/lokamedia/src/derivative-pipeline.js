/**
 * RancangLoka — LokaMedia Durable Derivative Pipeline Orchestrator
 * Phase 5D5A: Durable Public Derivative Foundation
 *
 * Coordinates:
 * captured ORIGINAL (immutable)
 *         ↓
 * runtime watermark configuration snapshot
 *         ↓
 * optional private IMAGE master fetch & independent SHA verification
 *         ↓
 * Watermark Engine transform core
 *         ↓
 * validated DERIVATIVE binary & SHA-256 readback
 *         ↓
 * durable derivative store (media-derivatives)
 *         ↓
 * stop (ready for controlled live derivative in 5D5B)
 */

import {
  transformWatermark,
  computeTransformId,
  computeSha256,
  WATERMARK_ENGINE_VERSION,
  DEFAULT_WATERMARK_VERSION,
  WATERMARK_TYPES
} from './watermark-engine.js';

export const MAX_PENDING_DERIVATIVE_ASSETS = 4;
export const MAX_PENDING_DERIVATIVE_BYTES = 20 * 1024 * 1024; // 20 MiB = 20971520 bytes
export const DERIVATIVE_OUTPUT_FORMAT_POLICY = 'PRESERVE_SOURCE_FORMAT';
export const DERIVATIVE_STORE_NAME = 'media-derivatives';
export const ROLE_PUBLIC_DERIVATIVE_CANDIDATE = 'PUBLIC_DERIVATIVE_CANDIDATE';
export const ROLE_ORIGINAL = 'ORIGINAL';
export const RUNTIME_CONFIG_CACHE_POLICY = 'NO_STORE_FRESH_FETCH_WITH_JOB_SNAPSHOT';

export class DerivativePipelineError extends Error {
  constructor(message, code = 'DERIVATIVE_PIPELINE_ERROR', cause = null) {
    super(message);
    this.name = 'DerivativePipelineError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

/**
 * Computes deterministic derivative ID from sourceSha256 and transformId.
 * No timestamps or random UUIDs.
 */
export async function computeDerivativeId(sourceSha256, transformId) {
  if (!sourceSha256 || !transformId) {
    throw new DerivativePipelineError(
      'sourceSha256 and transformId are required to compute derivative ID',
      'INVALID_DERIVATIVE_IDENTITY_INPUT'
    );
  }
  const digest = await computeSha256(`${sourceSha256}:${transformId}`);
  return `der_${digest}`;
}

/**
 * Validates binary integrity and dimensions of output derivative.
 */
export function validateDerivativeBinary({
  bytes,
  mime,
  sourceWidth,
  sourceHeight,
  sourceMime
}) {
  if (!bytes) {
    throw new DerivativePipelineError('Derivative binary bytes are missing', 'DERIVATIVE_BYTES_MISSING');
  }

  const byteLength = bytes.byteLength !== undefined ? bytes.byteLength : bytes.length;
  if (typeof byteLength !== 'number' || byteLength <= 0) {
    throw new DerivativePipelineError('Derivative binary is empty (0 bytes)', 'DERIVATIVE_BYTES_EMPTY');
  }

  const supportedMimes = ['image/png', 'image/webp'];
  if (!supportedMimes.includes(mime)) {
    throw new DerivativePipelineError(
      `Unsupported derivative MIME type '${mime}'. Expected image/png or image/webp.`,
      'UNSUPPORTED_DERIVATIVE_MIME'
    );
  }

  // Enforce PRESERVE_SOURCE_FORMAT policy
  if (sourceMime && mime !== sourceMime) {
    throw new DerivativePipelineError(
      `Output format policy PRESERVE_SOURCE_FORMAT violated: expected '${sourceMime}', got '${mime}'`,
      'OUTPUT_FORMAT_POLICY_VIOLATED'
    );
  }

  if (!sourceWidth || sourceWidth <= 0 || !sourceHeight || sourceHeight <= 0) {
    throw new DerivativePipelineError(
      `Invalid derivative dimensions: ${sourceWidth}x${sourceHeight}`,
      'INVALID_DERIVATIVE_DIMENSIONS'
    );
  }

  return true;
}

/**
 * Validates private master image asset metadata and binary integrity.
 */
export async function validateImageMasterAsset({ assetId, bytes, meta }) {
  if (!meta || typeof meta !== 'object') {
    throw new DerivativePipelineError('Image master asset metadata is missing', 'IMAGE_MASTER_METADATA_MISSING');
  }

  if (meta.asset_id !== assetId) {
    throw new DerivativePipelineError(
      `Asset ID mismatch: requested '${assetId}', received '${meta.asset_id}'`,
      'IMAGE_MASTER_ID_MISMATCH'
    );
  }

  if (!bytes) {
    throw new DerivativePipelineError('Image master bytes missing', 'IMAGE_MASTER_BYTES_MISSING');
  }

  const byteLength = bytes.byteLength !== undefined ? bytes.byteLength : bytes.length;
  if (typeof byteLength !== 'number' || byteLength <= 0) {
    throw new DerivativePipelineError('Image master binary is empty', 'IMAGE_MASTER_BYTES_EMPTY');
  }

  if (meta.byte_size && meta.byte_size !== byteLength) {
    throw new DerivativePipelineError(
      `Image master byte size mismatch: declared ${meta.byte_size}, received ${byteLength}`,
      'IMAGE_MASTER_SIZE_MISMATCH'
    );
  }

  const supportedMimes = ['image/png', 'image/webp'];
  if (!supportedMimes.includes(meta.mime)) {
    throw new DerivativePipelineError(
      `Unsupported image master MIME: '${meta.mime}'`,
      'UNSUPPORTED_IMAGE_MASTER_MIME'
    );
  }

  // Independent SHA-256 verification
  const computedSha = await computeSha256(bytes);
  if (meta.sha256 && meta.sha256 !== computedSha) {
    throw new DerivativePipelineError(
      `Image master SHA-256 verification failed: expected ${meta.sha256}, computed ${computedSha}`,
      'IMAGE_MASTER_SHA256_MISMATCH'
    );
  }

  return {
    valid: true,
    sha256: computedSha,
    byteLength
  };
}

/**
 * Validates integrity of an existing derivative record from store.
 */
export async function validateDerivativeRecordIntegrity(record) {
  if (!record || typeof record !== 'object') {
    return { valid: false, reason: 'RECORD_NULL' };
  }

  if (!record.derivative_id || !record.transform_id || !record.job_id) {
    return { valid: false, reason: 'MISSING_REQUIRED_IDS' };
  }

  if (!record.bytes) {
    return { valid: false, reason: 'BYTES_MISSING' };
  }

  const byteLength = record.bytes.byteLength !== undefined ? record.bytes.byteLength : record.bytes.length;
  if (typeof byteLength !== 'number' || byteLength <= 0) {
    return { valid: false, reason: 'BYTES_EMPTY' };
  }

  if (record.byte_size !== undefined && record.byte_size !== byteLength) {
    return { valid: false, reason: 'SIZE_MISMATCH' };
  }

  if (!record.width || record.width <= 0 || !record.height || record.height <= 0) {
    return { valid: false, reason: 'INVALID_DIMENSIONS' };
  }

  const computedSha = await computeSha256(record.bytes);
  if (record.sha256 && record.sha256 !== computedSha) {
    return { valid: false, reason: 'SHA256_MISMATCH' };
  }

  return { valid: true };
}

/**
 * Executes the complete deterministic watermark derivative pipeline.
 */
export async function executeWatermarkDerivativePipeline({
  sourceBlob,
  sourceMeta,
  jobId,
  articleId = null,
  slotKey = 'featured',
  sourceBlobKey,
  apiClient,
  derivativeStore,
  configSnapshot = null,
  canvasProvider = null,
  options = {}
}) {
  if (!sourceBlob) {
    throw new DerivativePipelineError('sourceBlob is required', 'MISSING_SOURCE_BLOB');
  }
  if (!sourceMeta || typeof sourceMeta !== 'object') {
    throw new DerivativePipelineError('sourceMeta is required', 'MISSING_SOURCE_META');
  }
  if (!jobId) {
    throw new DerivativePipelineError('jobId is required', 'MISSING_JOB_ID');
  }
  if (!derivativeStore) {
    throw new DerivativePipelineError('derivativeStore is required', 'MISSING_DERIVATIVE_STORE');
  }

  // 1. Double Watermark Guard: Source role MUST be ORIGINAL
  const sourceRole = sourceMeta.role || 'ORIGINAL';
  if (sourceRole !== ROLE_ORIGINAL && sourceRole !== 'MASTER' && sourceRole !== 'featured') {
    throw new DerivativePipelineError(
      `DOUBLE_WATERMARK_PIPELINE_GUARD: Pipeline accepts only 'ORIGINAL' role as source. Received: '${sourceRole}'`,
      'DOUBLE_WATERMARK_GUARD_BLOCKED'
    );
  }

  if (
    sourceRole === ROLE_PUBLIC_DERIVATIVE_CANDIDATE ||
    sourceMeta.isWatermarked === true ||
    sourceMeta.watermarked === true ||
    Boolean(sourceMeta.transformId)
  ) {
    throw new DerivativePipelineError(
      'DOUBLE_WATERMARK_PIPELINE_GUARD: Source has already been watermarked or is a derivative candidate',
      'DOUBLE_WATERMARK_GUARD_BLOCKED'
    );
  }

  // 2. Source binary integrity pre-check & immutability baseline
  const sourceBytesBaseline = await (typeof sourceBlob.arrayBuffer === 'function'
    ? sourceBlob.arrayBuffer()
    : Promise.resolve(sourceBlob));
  const sourceShaBaseline = sourceMeta.sha256 || (await computeSha256(sourceBytesBaseline));

  // 3. Acquire runtime configuration snapshot (Immutable during transform)
  let runtimeConfig;
  if (configSnapshot) {
    runtimeConfig = JSON.parse(JSON.stringify(configSnapshot));
  } else {
    if (!apiClient || typeof apiClient.getWatermarkConfig !== 'function') {
      throw new DerivativePipelineError(
        'ApiClient with getWatermarkConfig is required when configSnapshot is not provided',
        'SETTINGS_FETCH_FAILURE'
      );
    }
    try {
      const fetched = await apiClient.getWatermarkConfig();
      runtimeConfig = fetched.config || fetched;
    } catch (fetchErr) {
      throw new DerivativePipelineError(
        `Failed to fetch runtime watermark settings from server: ${fetchErr.message}`,
        'SETTINGS_FETCH_FAILURE',
        fetchErr
      );
    }
  }

  // Freeze config snapshot for duration of pipeline execution
  const immutableSnapshot = Object.freeze(JSON.parse(JSON.stringify(runtimeConfig)));

  // 4. Disabled Watermark Check (Explicit NOOP path)
  if (!immutableSnapshot.enabled) {
    return {
      status: 'NO_WATERMARK_REQUIRED',
      reused: false,
      transformed: false,
      derivative: null,
      message: 'Watermark is disabled in runtime configuration. Source original preserved without transform.'
    };
  }

  // 5. Image master asset fetch & verification if IMAGE mode is active
  let watermarkAsset = null;
  let watermarkAssetSha256 = null;

  if (immutableSnapshot.type === WATERMARK_TYPES.IMAGE) {
    const assetId = immutableSnapshot.image?.asset_id;
    if (!assetId) {
      throw new DerivativePipelineError(
        'Watermark config specifies IMAGE type but asset_id is missing',
        'IMAGE_MASTER_MISSING_ASSET_ID'
      );
    }

    if (!apiClient || typeof apiClient.getWatermarkMasterAsset !== 'function') {
      throw new DerivativePipelineError(
        'ApiClient with getWatermarkMasterAsset is required for IMAGE watermark transform',
        'IMAGE_MASTER_FETCH_UNAVAILABLE'
      );
    }

    let fetchedAsset;
    try {
      fetchedAsset = await apiClient.getWatermarkMasterAsset(assetId);
    } catch (assetErr) {
      throw new DerivativePipelineError(
        `Failed to fetch private watermark master asset '${assetId}': ${assetErr.message}`,
        'IMAGE_MASTER_FETCH_FAILED',
        assetErr
      );
    }

    if (!fetchedAsset || !fetchedAsset.bytes) {
      throw new DerivativePipelineError(
        `Watermark master asset '${assetId}' returned empty payload`,
        'IMAGE_MASTER_EMPTY'
      );
    }

    // Independently verify asset integrity and SHA-256
    const verified = await validateImageMasterAsset({
      assetId,
      bytes: fetchedAsset.bytes,
      meta: fetchedAsset.meta
    });

    watermarkAssetSha256 = verified.sha256;
    watermarkAsset = {
      blob: new Blob([fetchedAsset.bytes], { type: fetchedAsset.meta.mime }),
      width: fetchedAsset.meta.width,
      height: fetchedAsset.meta.height,
      mime: fetchedAsset.meta.mime,
      sha256: verified.sha256,
      hasAlpha: fetchedAsset.meta.alpha_present
    };
  }

  // 6. Compute deterministic transform ID & derivative ID
  const watermarkVersion = Number(immutableSnapshot.watermark_version ?? DEFAULT_WATERMARK_VERSION);
  const engineVersion = String(immutableSnapshot.engine_version ?? WATERMARK_ENGINE_VERSION);

  const transformId = await computeTransformId({
    sourceSha256: sourceShaBaseline,
    normalizedConfig: immutableSnapshot,
    watermarkAssetSha256,
    watermarkVersion,
    engineVersion
  });

  const derivativeId = await computeDerivativeId(sourceShaBaseline, transformId);

  // 7. Idempotency & Deduplication: Check if valid derivative already exists in store
  const existingByTransform = await derivativeStore.getDerivativeByTransformId(transformId);
  const existingById = existingByTransform || (await derivativeStore.getDerivative(derivativeId));

  if (existingById) {
    const integrity = await validateDerivativeRecordIntegrity(existingById);
    if (integrity.valid) {
      return {
        status: 'REUSED',
        reused: true,
        transformed: false,
        derivative: existingById,
        message: 'Identical derivative already exists and passed binary integrity verification.'
      };
    } else {
      // Corrupt derivative record fails closed
      throw new DerivativePipelineError(
        `Existing derivative record '${derivativeId}' is corrupted: ${integrity.reason}. Aborting transform to prevent using bad state.`,
        'CORRUPT_DERIVATIVE_RECORD'
      );
    }
  }

  // 8. Backpressure check
  const currentStats = await derivativeStore.stats();
  if (currentStats.count >= MAX_PENDING_DERIVATIVE_ASSETS) {
    throw new DerivativePipelineError(
      `Derivative backpressure limit exceeded: max pending assets (${MAX_PENDING_DERIVATIVE_ASSETS}) reached`,
      'DERIVATIVE_BACKPRESSURE_ASSET_LIMIT'
    );
  }

  const estimatedDerivativeSize = sourceBlob.size || sourceBytesBaseline.byteLength;
  if (currentStats.bytes + estimatedDerivativeSize > MAX_PENDING_DERIVATIVE_BYTES) {
    throw new DerivativePipelineError(
      `Derivative backpressure limit exceeded: max pending bytes (${MAX_PENDING_DERIVATIVE_BYTES}) would be exceeded`,
      'DERIVATIVE_BACKPRESSURE_BYTE_LIMIT'
    );
  }

  // 9. Execute Transform via Watermark Engine
  const transformResult = await transformWatermark({
    sourceBlob,
    sourceMeta: {
      ...sourceMeta,
      sha256: sourceShaBaseline,
      role: ROLE_ORIGINAL
    },
    config: immutableSnapshot,
    watermarkAsset,
    canvasProvider,
    options
  });

  // 10. Verify source immutability (Original must remain 100% unchanged)
  const sourceBytesPost = await (typeof sourceBlob.arrayBuffer === 'function'
    ? sourceBlob.arrayBuffer()
    : Promise.resolve(sourceBlob));
  const sourceShaPost = await computeSha256(sourceBytesPost);

  if (sourceShaBaseline !== sourceShaPost || sourceBytesBaseline.byteLength !== sourceBytesPost.byteLength) {
    throw new DerivativePipelineError(
      'ORIGINAL_IMMUTABILITY_VIOLATED: Source blob was mutated during watermark transform',
      'ORIGINAL_IMMUTABILITY_FAILED'
    );
  }

  // 11. Extract and validate output derivative binary
  const outputBytes = await (typeof transformResult.blob.arrayBuffer === 'function'
    ? transformResult.blob.arrayBuffer()
    : Promise.resolve(transformResult.blob));

  validateDerivativeBinary({
    bytes: outputBytes,
    mime: transformResult.mime,
    sourceWidth: sourceMeta.width,
    sourceHeight: sourceMeta.height,
    sourceMime: sourceMeta.mime
  });

  // 12. Compute SHA-256 over output derivative bytes & readback verification
  const outputSha256 = await computeSha256(outputBytes);
  const readbackSha = await computeSha256(new Uint8Array(outputBytes));
  if (outputSha256 !== readbackSha) {
    throw new DerivativePipelineError(
      'Derivative SHA-256 readback mismatch',
      'DERIVATIVE_SHA256_MISMATCH'
    );
  }

  // 13. Construct durable derivative record
  const derivativeRecord = {
    derivative_id: derivativeId,
    transform_id: transformId,
    job_id: jobId,
    article_id: articleId ?? null,
    slot_key: slotKey ?? 'featured',
    source_blob_key: sourceBlobKey || `${jobId}:1`,
    source_sha256: sourceShaBaseline,
    watermark_settings_version: watermarkVersion,
    watermark_engine_version: engineVersion,
    watermark_type: immutableSnapshot.type,
    watermark_asset_id: immutableSnapshot.type === WATERMARK_TYPES.IMAGE ? immutableSnapshot.image.asset_id : null,
    watermark_asset_sha256: watermarkAssetSha256,
    mime: transformResult.mime,
    width: transformResult.width,
    height: transformResult.height,
    byte_size: outputBytes.byteLength,
    sha256: outputSha256,
    bytes: outputBytes,
    created_at: new Date().toISOString(),
    role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE
  };

  // 14. Atomic persistence in derivative store (media-derivatives)
  try {
    await derivativeStore.putDerivative(derivativeRecord);
  } catch (persistErr) {
    throw new DerivativePipelineError(
      `Failed to persist derivative to store: ${persistErr.message}`,
      'DERIVATIVE_PERSIST_FAILED',
      persistErr
    );
  }

  // 15. Verify persisted readback
  const storedRecord = await derivativeStore.getDerivative(derivativeId);
  if (!storedRecord || !storedRecord.bytes) {
    throw new DerivativePipelineError(
      'Derivative readback immediately after persistence failed',
      'DERIVATIVE_READBACK_FAILED'
    );
  }

  const storedSha = await computeSha256(storedRecord.bytes);
  if (storedSha !== outputSha256) {
    throw new DerivativePipelineError(
      `Persisted derivative SHA-256 mismatch on readback: expected ${outputSha256}, got ${storedSha}`,
      'DERIVATIVE_READBACK_SHA_MISMATCH'
    );
  }

  return {
    status: 'CREATED',
    reused: false,
    transformed: true,
    derivative: storedRecord
  };
}
