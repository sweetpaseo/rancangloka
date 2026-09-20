/**
 * RancangLoka — LokaMedia Watermark Engine Core
 * Phase 5D3A: Watermark Engine Foundation + Processing Capability Lock
 *
 * Deterministic transform core for image watermarking:
 * - Pure transform core (no direct storage/IndexedDB writes)
 * - Source Blob is strictly read-only and immutable
 * - Never modifies source in-place
 * - Double watermark guard prevents watermarking already-watermarked derivatives
 * - Deterministic transformId based on sourceSha256, normalizedConfig, assetSha256, versions
 * - Supports TYPE 1: TEXT (default: rancangloka.com)
 * - Supports TYPE 2: IMAGE (transparent PNG/WebP with alpha validation)
 * - Exact dimension preservation (e.g. 1672x941 -> 1672x941)
 * - PNG -> Lossless WebP normalization capability gate (blocks if lossless encoder missing)
 */

export const WATERMARK_ENGINE_VERSION = '1.0.0';
export const DEFAULT_WATERMARK_VERSION = 1;

export const WATERMARK_TYPES = Object.freeze({
  TEXT: 'TEXT',
  IMAGE: 'IMAGE'
});

export const WATERMARK_POSITIONS = Object.freeze({
  TOP_LEFT: 'top-left',
  TOP_RIGHT: 'top-right',
  BOTTOM_LEFT: 'bottom-left',
  BOTTOM_RIGHT: 'bottom-right'
});

export const DEFAULT_WATERMARK_CONFIG = Object.freeze({
  enabled: true,
  type: WATERMARK_TYPES.TEXT,
  position: WATERMARK_POSITIONS.BOTTOM_RIGHT,
  opacity: 0.62,
  margin_x_ratio: 0.022,
  margin_y_ratio: 0.028,
  text: Object.freeze({
    value: 'rancangloka.com',
    font_size_ratio: 0.022,
    font_weight: 500,
    font_family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }),
  image: Object.freeze({
    asset_id: null,
    asset_hash: null,
    width_ratio: 0.15
  })
});

// Guardrail boundaries
export const CONFIG_BOUNDS = Object.freeze({
  opacity: { min: 0.30, max: 0.90 },
  font_size_ratio: { min: 0.012, max: 0.05 },
  image_width_ratio: { min: 0.05, max: 0.30 },
  margin_x_ratio: { min: 0.01, max: 0.08 },
  margin_y_ratio: { min: 0.01, max: 0.08 }
});

/**
 * Validates and normalizes raw watermark configuration.
 * Fails closed on invalid type, position, empty text, or out-of-bounds parameters.
 */
export function normalizeWatermarkConfig(raw = {}) {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('CONFIG_GUARDRAIL_ERROR: Configuration must be a non-null object');
  }

  const enabled = raw.enabled !== undefined ? Boolean(raw.enabled) : DEFAULT_WATERMARK_CONFIG.enabled;
  const type = raw.type ?? DEFAULT_WATERMARK_CONFIG.type;

  if (type !== WATERMARK_TYPES.TEXT && type !== WATERMARK_TYPES.IMAGE) {
    throw new Error(`CONFIG_GUARDRAIL_ERROR: Invalid watermark type: '${type}'. Expected TEXT or IMAGE.`);
  }

  const position = raw.position ?? DEFAULT_WATERMARK_CONFIG.position;
  const validPositions = Object.values(WATERMARK_POSITIONS);
  if (!validPositions.includes(position)) {
    throw new Error(`CONFIG_GUARDRAIL_ERROR: Invalid position: '${position}'. Expected one of ${validPositions.join(', ')}.`);
  }

  const opacity = Number(raw.opacity ?? DEFAULT_WATERMARK_CONFIG.opacity);
  if (Number.isNaN(opacity) || opacity < CONFIG_BOUNDS.opacity.min || opacity > CONFIG_BOUNDS.opacity.max) {
    throw new Error(
      `CONFIG_GUARDRAIL_ERROR: Opacity ${opacity} outside permitted range [${CONFIG_BOUNDS.opacity.min}, ${CONFIG_BOUNDS.opacity.max}]`
    );
  }

  const margin_x_ratio = Number(raw.margin_x_ratio ?? DEFAULT_WATERMARK_CONFIG.margin_x_ratio);
  if (
    Number.isNaN(margin_x_ratio) ||
    margin_x_ratio < CONFIG_BOUNDS.margin_x_ratio.min ||
    margin_x_ratio > CONFIG_BOUNDS.margin_x_ratio.max
  ) {
    throw new Error(
      `CONFIG_GUARDRAIL_ERROR: margin_x_ratio ${margin_x_ratio} outside permitted range [${CONFIG_BOUNDS.margin_x_ratio.min}, ${CONFIG_BOUNDS.margin_x_ratio.max}]`
    );
  }

  const margin_y_ratio = Number(raw.margin_y_ratio ?? DEFAULT_WATERMARK_CONFIG.margin_y_ratio);
  if (
    Number.isNaN(margin_y_ratio) ||
    margin_y_ratio < CONFIG_BOUNDS.margin_y_ratio.min ||
    margin_y_ratio > CONFIG_BOUNDS.margin_y_ratio.max
  ) {
    throw new Error(
      `CONFIG_GUARDRAIL_ERROR: margin_y_ratio ${margin_y_ratio} outside permitted range [${CONFIG_BOUNDS.margin_y_ratio.min}, ${CONFIG_BOUNDS.margin_y_ratio.max}]`
    );
  }

  let textConfig = null;
  if (type === WATERMARK_TYPES.TEXT) {
    const rawText = raw.text || {};
    const textValue = (rawText.value ?? DEFAULT_WATERMARK_CONFIG.text.value);
    if (typeof textValue !== 'string' || textValue.trim().length === 0) {
      throw new Error('CONFIG_GUARDRAIL_ERROR: Text watermark value must be a non-empty string');
    }

    const fontSizeRatio = Number(rawText.font_size_ratio ?? DEFAULT_WATERMARK_CONFIG.text.font_size_ratio);
    if (
      Number.isNaN(fontSizeRatio) ||
      fontSizeRatio < CONFIG_BOUNDS.font_size_ratio.min ||
      fontSizeRatio > CONFIG_BOUNDS.font_size_ratio.max
    ) {
      throw new Error(
        `CONFIG_GUARDRAIL_ERROR: font_size_ratio ${fontSizeRatio} outside permitted range [${CONFIG_BOUNDS.font_size_ratio.min}, ${CONFIG_BOUNDS.font_size_ratio.max}]`
      );
    }

    const fontWeight = rawText.font_weight ?? DEFAULT_WATERMARK_CONFIG.text.font_weight;
    const fontFamily = rawText.font_family ?? DEFAULT_WATERMARK_CONFIG.text.font_family;

    textConfig = Object.freeze({
      value: textValue.trim(),
      font_size_ratio: fontSizeRatio,
      font_weight: fontWeight,
      font_family: fontFamily
    });
  }

  let imageConfig = null;
  if (type === WATERMARK_TYPES.IMAGE) {
    const rawImage = raw.image || {};
    const widthRatio = Number(rawImage.width_ratio ?? DEFAULT_WATERMARK_CONFIG.image.width_ratio);
    if (
      Number.isNaN(widthRatio) ||
      widthRatio < CONFIG_BOUNDS.image_width_ratio.min ||
      widthRatio > CONFIG_BOUNDS.image_width_ratio.max
    ) {
      throw new Error(
        `CONFIG_GUARDRAIL_ERROR: image.width_ratio ${widthRatio} outside permitted range [${CONFIG_BOUNDS.image_width_ratio.min}, ${CONFIG_BOUNDS.image_width_ratio.max}]`
      );
    }

    imageConfig = Object.freeze({
      asset_id: rawImage.asset_id ?? null,
      asset_hash: rawImage.asset_hash ?? null,
      width_ratio: widthRatio
    });
  }

  return Object.freeze({
    enabled,
    type,
    position,
    opacity,
    margin_x_ratio,
    margin_y_ratio,
    text: textConfig,
    image: imageConfig
  });
}

/**
 * Computes canonical string representation of normalized watermark config.
 * Keys are ordered deterministically to guarantee idempotency.
 */
export function computeCanonicalConfigString(config) {
  const norm = normalizeWatermarkConfig(config);
  const canonicalObj = {
    enabled: norm.enabled,
    margin_x_ratio: norm.margin_x_ratio,
    margin_y_ratio: norm.margin_y_ratio,
    opacity: norm.opacity,
    position: norm.position,
    type: norm.type
  };

  if (norm.type === WATERMARK_TYPES.TEXT && norm.text) {
    canonicalObj.text = {
      font_family: norm.text.font_family,
      font_size_ratio: norm.text.font_size_ratio,
      font_weight: norm.text.font_weight,
      value: norm.text.value
    };
  }

  if (norm.type === WATERMARK_TYPES.IMAGE && norm.image) {
    canonicalObj.image = {
      asset_hash: norm.image.asset_hash,
      asset_id: norm.image.asset_id,
      width_ratio: norm.image.width_ratio
    };
  }

  return JSON.stringify(canonicalObj, Object.keys(canonicalObj).sort());
}

/**
 * Calculates SHA-256 hex digest for string, ArrayBuffer, Uint8Array, or Blob.
 */
export async function computeSha256(data) {
  let bytes;
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else if (typeof data?.arrayBuffer === 'function') {
    const ab = await data.arrayBuffer();
    bytes = new Uint8Array(ab);
  } else {
    throw new Error('HASH_ERROR: Unsupported data type for SHA-256 computation');
  }

  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const digestBuf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(digestBuf));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js fallback if subtle is unavailable
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Computes deterministic transform ID from canonical inputs.
 */
export async function computeTransformId({
  sourceSha256,
  normalizedConfig,
  watermarkAssetSha256 = '',
  watermarkVersion = DEFAULT_WATERMARK_VERSION,
  engineVersion = WATERMARK_ENGINE_VERSION
}) {
  if (!sourceSha256 || typeof sourceSha256 !== 'string') {
    throw new Error('TRANSFORM_ID_ERROR: sourceSha256 is required and must be a valid hex string');
  }

  const canonicalConfigStr = computeCanonicalConfigString(normalizedConfig);
  const inputStr = [
    sourceSha256,
    canonicalConfigStr,
    watermarkAssetSha256 || '',
    String(watermarkVersion),
    String(engineVersion)
  ].join('|');

  return computeSha256(inputStr);
}

/**
 * Double watermark guard. Ensures source is an original master and has not already been watermarked.
 */
export function assertSourceEligibleForWatermark(sourceMeta, options = {}) {
  if (!sourceMeta || typeof sourceMeta !== 'object') {
    throw new Error('DOUBLE_WATERMARK_GUARD_ERROR: sourceMeta is required');
  }

  // If role is explicitly provided, verify it is ORIGINAL or MASTER
  if (sourceMeta.role && sourceMeta.role !== 'ORIGINAL' && sourceMeta.role !== 'MASTER' && sourceMeta.role !== 'featured') {
    if (!options.allowRebuild) {
      throw new Error(`DOUBLE_WATERMARK_GUARD_BLOCKED: cannot watermark derivative with role '${sourceMeta.role}'`);
    }
  }

  // Reject if flagged as already watermarked
  if (sourceMeta.isWatermarked === true || sourceMeta.watermarked === true || Boolean(sourceMeta.transformId)) {
    if (!options.allowRebuild) {
      throw new Error('DOUBLE_WATERMARK_GUARD_BLOCKED: source has already been watermarked');
    }
  }

  return true;
}

/**
 * Calculates deterministic placement geometry for an element of (itemWidth, itemHeight)
 * within a canvas of (canvasWidth, canvasHeight) given position and margin ratios.
 */
export function calculateWatermarkPlacement({
  canvasWidth,
  canvasHeight,
  itemWidth,
  itemHeight,
  position,
  marginXRatio,
  marginYRatio
}) {
  if (canvasWidth <= 0 || canvasHeight <= 0) {
    throw new Error('PLACEMENT_ERROR: Canvas dimensions must be positive');
  }
  if (itemWidth < 0 || itemHeight < 0) {
    throw new Error('PLACEMENT_ERROR: Item dimensions must be non-negative');
  }

  const marginXPx = Math.max(1, Math.round(canvasWidth * marginXRatio));
  const marginYPx = Math.max(1, Math.round(canvasHeight * marginYRatio));

  let x;
  let y;

  switch (position) {
    case WATERMARK_POSITIONS.TOP_LEFT:
      x = marginXPx;
      y = marginYPx;
      break;
    case WATERMARK_POSITIONS.TOP_RIGHT:
      x = canvasWidth - marginXPx - itemWidth;
      y = marginYPx;
      break;
    case WATERMARK_POSITIONS.BOTTOM_LEFT:
      x = marginXPx;
      y = canvasHeight - marginYPx - itemHeight;
      break;
    case WATERMARK_POSITIONS.BOTTOM_RIGHT:
    default:
      x = canvasWidth - marginXPx - itemWidth;
      y = canvasHeight - marginYPx - itemHeight;
      break;
  }

  // Clamping guard: watermark must stay inside image boundaries
  const clampedX = Math.max(0, Math.min(x, Math.max(0, canvasWidth - itemWidth)));
  const clampedY = Math.max(0, Math.min(y, Math.max(0, canvasHeight - itemHeight)));

  return {
    x: clampedX,
    y: clampedY,
    marginXPx,
    marginYPx,
    itemWidth,
    itemHeight
  };
}

/**
 * Calculates pixel-level metrics for text watermark.
 */
export function calculateTextWatermarkMetrics({ width, height, config }) {
  const norm = normalizeWatermarkConfig(config);
  if (norm.type !== WATERMARK_TYPES.TEXT) {
    throw new Error('METRICS_ERROR: Expected TEXT watermark config');
  }

  // Font size scales with min(width, height) to preserve proportionality across aspect ratios
  const baseDim = Math.min(width, height);
  const fontSizePx = Math.max(10, Math.round(baseDim * norm.text.font_size_ratio));
  const marginXPx = Math.max(1, Math.round(width * norm.margin_x_ratio));
  const marginYPx = Math.max(1, Math.round(height * norm.margin_y_ratio));

  return {
    fontSizePx,
    marginXPx,
    marginYPx,
    fontWeight: norm.text.font_weight,
    fontFamily: norm.text.font_family,
    value: norm.text.value,
    opacity: norm.opacity,
    position: norm.position
  };
}

/**
 * Validates watermark image transparency.
 * Returns explicit validation result; fails closed if completely opaque.
 */
export function validateWatermarkImageTransparency(watermarkAsset) {
  if (!watermarkAsset) {
    return {
      valid: false,
      reason: 'MISSING_WATERMARK_ASSET',
      hasAlphaChannel: false
    };
  }

  const { width, height, mime, pixelData } = watermarkAsset;

  if (!width || width <= 0 || !height || height <= 0) {
    return {
      valid: false,
      reason: 'INVALID_WATERMARK_DIMENSIONS',
      hasAlphaChannel: false
    };
  }

  const validMimes = ['image/png', 'image/webp'];
  if (mime && !validMimes.includes(mime)) {
    return {
      valid: false,
      reason: `UNSUPPORTED_WATERMARK_MIME: '${mime}'. Expected PNG or WebP.`,
      hasAlphaChannel: false
    };
  }

  // If pixel data (RGBA Uint8Array/Uint8ClampedArray) is provided, scan alpha channel
  if (pixelData && pixelData.length >= width * height * 4) {
    let transparentCount = 0;
    let opaqueCount = 0;
    const totalPixels = width * height;

    for (let i = 3; i < pixelData.length; i += 4) {
      if (pixelData[i] < 255) {
        transparentCount++;
      } else {
        opaqueCount++;
      }
    }

    if (transparentCount === 0) {
      return {
        valid: false,
        reason: 'OPAQUE_WATERMARK_INPUT_NO_TRANSPARENCY',
        hasAlphaChannel: false,
        transparentCount,
        totalPixels
      };
    }

    return {
      valid: true,
      reason: null,
      hasAlphaChannel: true,
      transparentCount,
      totalPixels,
      transparencyRatio: transparentCount / totalPixels
    };
  }

  // If pixel data is not directly supplied, asset must indicate explicit alpha support
  if (watermarkAsset.hasAlpha === false) {
    return {
      valid: false,
      reason: 'OPAQUE_WATERMARK_INPUT_NO_TRANSPARENCY',
      hasAlphaChannel: false
    };
  }

  return {
    valid: true,
    reason: null,
    hasAlphaChannel: true
  };
}

/**
 * PNG -> Transparent WebP Normalizer Contract
 * Phase 5D3A Capability Gate: Browser canvas WebP encoding alters color profiles / premultiplied alpha
 * and is not strictly lossless. Gated until a dedicated libwebp WASM dependency is approved.
 */
export async function normalizeWatermarkAsset(sourceAsset) {
  if (!sourceAsset) {
    throw new Error('NORMALIZER_ERROR: sourceAsset is required');
  }

  return {
    status: 'BLOCKED_LOSSLESS_ENCODER_REQUIRED',
    reason: 'Native browser canvas WebP encoding cannot guarantee strict lossless alpha preservation due to color premultiplication drift. Requires dedicated libwebp WASM encoder.',
    asset: null
  };
}

/**
 * Canonical Core Watermark Transform Function.
 *
 * Takes:
 * - sourceBlob: Blob (or binary with .size and .arrayBuffer())
 * - sourceMeta: { width, height, mime, sha256, role, isWatermarked? }
 * - config: Raw or normalized watermark configuration
 * - watermarkAsset: Optional decoded watermark asset for IMAGE type
 * - canvasProvider: Optional canvas provider (for test/node environments)
 *
 * Returns:
 * - blob: New derivative Blob
 * - mime: Output MIME type ('image/png')
 * - width: Output width (preserved)
 * - height: Output height (preserved)
 * - byteSize: Output byte size
 * - transformId: Deterministic transform identity
 * - engineVersion: WATERMARK_ENGINE_VERSION
 * - watermarkVersion: DEFAULT_WATERMARK_VERSION
 * - sourceSha256: Source SHA-256
 * - watermarkAssetSha256: Watermark asset SHA-256 (if IMAGE)
 * - normalizedConfig: Normalized configuration used
 */
export async function transformWatermark({
  sourceBlob,
  sourceMeta,
  config = DEFAULT_WATERMARK_CONFIG,
  watermarkAsset = null,
  canvasProvider = null,
  options = {}
}) {
  if (!sourceBlob || typeof sourceBlob.size !== 'number' || sourceBlob.size <= 0) {
    throw new Error('TRANSFORM_ERROR: Valid non-empty sourceBlob is required');
  }

  if (!sourceMeta || typeof sourceMeta !== 'object') {
    throw new Error('TRANSFORM_ERROR: sourceMeta object is required');
  }

  // 1. Double watermark guard
  assertSourceEligibleForWatermark(sourceMeta, options);

  // 2. Normalize and validate config
  const normalizedConfig = normalizeWatermarkConfig(config);

  // 3. Disabled Watermark NOOP path (Section 23)
  if (!normalizedConfig.enabled) {
    return {
      transformed: false,
      blob: sourceBlob,
      mime: sourceMeta.mime || sourceBlob.type || 'image/png',
      width: sourceMeta.width,
      height: sourceMeta.height,
      byteSize: sourceBlob.size,
      transformId: null,
      engineVersion: WATERMARK_ENGINE_VERSION,
      watermarkVersion: DEFAULT_WATERMARK_VERSION,
      sourceSha256: sourceMeta.sha256 || null,
      watermarkAssetSha256: null,
      normalizedConfig,
      reason: 'WATERMARK_DISABLED_NOOP'
    };
  }

  // 4. Validate source dimensions
  const sourceWidth = Number(sourceMeta.width);
  const sourceHeight = Number(sourceMeta.height);
  if (!sourceWidth || sourceWidth <= 0 || !sourceHeight || sourceHeight <= 0) {
    throw new Error(`TRANSFORM_ERROR: Invalid source dimensions: ${sourceWidth}x${sourceHeight}`);
  }

  // 5. If IMAGE watermark, validate asset & transparency
  let watermarkAssetSha256 = null;
  if (normalizedConfig.type === WATERMARK_TYPES.IMAGE) {
    if (!watermarkAsset) {
      throw new Error('CONFIG_GUARDRAIL_ERROR: Missing required watermark image asset for IMAGE type');
    }

    const transparencyCheck = validateWatermarkImageTransparency(watermarkAsset);
    if (!transparencyCheck.valid) {
      throw new Error(`CONFIG_GUARDRAIL_ERROR: Watermark image validation failed: ${transparencyCheck.reason}`);
    }

    if (watermarkAsset.sha256) {
      watermarkAssetSha256 = watermarkAsset.sha256;
    } else if (watermarkAsset.blob) {
      watermarkAssetSha256 = await computeSha256(watermarkAsset.blob);
    } else if (watermarkAsset.pixelData) {
      watermarkAssetSha256 = await computeSha256(watermarkAsset.pixelData);
    }
  }

  // 6. Compute source SHA-256
  const sourceSha256 = sourceMeta.sha256 || (await computeSha256(sourceBlob));

  // 7. Compute deterministic transform ID
  const transformId = await computeTransformId({
    sourceSha256,
    normalizedConfig,
    watermarkAssetSha256,
    watermarkVersion: DEFAULT_WATERMARK_VERSION,
    engineVersion: WATERMARK_ENGINE_VERSION
  });

  // 8. Execute Canvas Rendering
  let outputBlob;
  let renderedWidth = sourceWidth;
  let renderedHeight = sourceHeight;

  if (canvasProvider) {
    // Custom / test canvas provider
    const result = await canvasProvider.renderWatermark({
      sourceBlob,
      sourceWidth,
      sourceHeight,
      config: normalizedConfig,
      watermarkAsset
    });
    outputBlob = result.blob;
    renderedWidth = result.width ?? sourceWidth;
    renderedHeight = result.height ?? sourceHeight;
  } else if (typeof globalThis.OffscreenCanvas === 'function' && typeof globalThis.createImageBitmap === 'function') {
    // Native Service Worker / Browser environment
    const canvas = new globalThis.OffscreenCanvas(sourceWidth, sourceHeight);
    const ctx = canvas.getContext('2d');

    const sourceBitmap = await globalThis.createImageBitmap(sourceBlob);
    ctx.drawImage(sourceBitmap, 0, 0, sourceWidth, sourceHeight);

    if (normalizedConfig.type === WATERMARK_TYPES.TEXT) {
      const metrics = calculateTextWatermarkMetrics({
        width: sourceWidth,
        height: sourceHeight,
        config: normalizedConfig
      });

      ctx.save();
      ctx.globalAlpha = metrics.opacity;
      ctx.font = `${metrics.fontWeight} ${metrics.fontSizePx}px ${metrics.fontFamily}`;

      const textMeasure = ctx.measureText(metrics.value);
      const textWidth = textMeasure.width;
      const textHeight = textMeasure.actualBoundingBoxAscent || metrics.fontSizePx;

      const placement = calculateWatermarkPlacement({
        canvasWidth: sourceWidth,
        canvasHeight: sourceHeight,
        itemWidth: textWidth,
        itemHeight: textHeight,
        position: metrics.position,
        marginXRatio: normalizedConfig.margin_x_ratio,
        marginYRatio: normalizedConfig.margin_y_ratio
      });

      // Subtle readability treatment: restrained dark shadow + crisp white text
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = Math.max(2, Math.round(metrics.fontSizePx * 0.15));
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'top';
      ctx.fillText(metrics.value, placement.x, placement.y);
      ctx.restore();
    } else if (normalizedConfig.type === WATERMARK_TYPES.IMAGE && watermarkAsset) {
      let assetBitmap = watermarkAsset.bitmap;
      if (!assetBitmap && watermarkAsset.blob) {
        assetBitmap = await globalThis.createImageBitmap(watermarkAsset.blob);
      }

      const targetWidth = Math.round(sourceWidth * normalizedConfig.image.width_ratio);
      const aspectRatio = (watermarkAsset.height || assetBitmap.height) / (watermarkAsset.width || assetBitmap.width);
      const targetHeight = Math.round(targetWidth * aspectRatio);

      const placement = calculateWatermarkPlacement({
        canvasWidth: sourceWidth,
        canvasHeight: sourceHeight,
        itemWidth: targetWidth,
        itemHeight: targetHeight,
        position: normalizedConfig.position,
        marginXRatio: normalizedConfig.margin_x_ratio,
        marginYRatio: normalizedConfig.margin_y_ratio
      });

      ctx.save();
      ctx.globalAlpha = normalizedConfig.opacity;
      ctx.drawImage(assetBitmap, placement.x, placement.y, targetWidth, targetHeight);
      ctx.restore();
    }

    outputBlob = await canvas.convertToBlob({ type: 'image/png' });
  } else {
    throw new Error('TRANSFORM_ERROR: No canvas execution environment available (OffscreenCanvas not found)');
  }

  // 9. Dimension preservation check
  if (renderedWidth !== sourceWidth || renderedHeight !== sourceHeight) {
    throw new Error(
      `DIMENSION_MISMATCH_ERROR: Output dimensions (${renderedWidth}x${renderedHeight}) must match source (${sourceWidth}x${sourceHeight})`
    );
  }

  return {
    transformed: true,
    blob: outputBlob,
    mime: 'image/png',
    width: renderedWidth,
    height: renderedHeight,
    byteSize: outputBlob.size,
    transformId,
    engineVersion: WATERMARK_ENGINE_VERSION,
    watermarkVersion: DEFAULT_WATERMARK_VERSION,
    sourceSha256,
    watermarkAssetSha256,
    normalizedConfig
  };
}
