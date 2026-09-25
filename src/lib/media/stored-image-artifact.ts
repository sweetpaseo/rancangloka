/**
 * RancangLoka — Stored Generated Image Artifact & Watermark Derivative Engine (MEDIA-A3)
 *
 * Implements:
 * 1. StoredGeneratedImageArtifact contract (handoff for MEDIA-A4)
 * 2. Deterministic TEXT watermarking using canonical engine geometry
 * 3. Derivative binary validation and integrity calculation
 * 4. Production R2 storage key and provenance formatting
 *
 * SAFETY INVARIANTS:
 * - Source artifact and fixture bytes are strictly immutable (read-only)
 * - Deterministic transformId & derivative identity based on sourceSha256 and canonical config
 * - Zero D1 mutations, zero media_assets inserts, zero article_media attachments
 * - Zero paid provider calls
 */

import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  type GeneratedImageArtifact,
  type NormalizedProvenance,
  validateArtifactBinary,
  computeArtifactId,
  MediaArtifactError
} from './generated-image-artifact.ts';
import {
  computeBinarySha256
} from './image-validation.ts';
import {
  DEFAULT_WATERMARK_CONFIG,
  calculateTextWatermarkMetrics,
  calculateWatermarkPlacement,
  computeCanonicalConfigString,
  computeTransformId,
  WATERMARK_ENGINE_VERSION,
  DEFAULT_WATERMARK_VERSION,
  WATERMARK_TYPES
} from '../../../extensions/lokamedia/src/watermark-engine.js';

export interface StoredGeneratedImageArtifact {
  readonly artifact_id: string;
  readonly source_artifact_id: string;
  readonly source_type: string;
  readonly storage_provider: 'cloudflare_r2';
  readonly bucket: string;
  readonly storage_key: string;
  readonly mime_type: 'image/png' | 'image/jpeg' | 'image/webp';
  readonly width: number;
  readonly height: number;
  readonly byte_size: number;
  readonly sha256: string;
  readonly watermark_applied: boolean;
  readonly watermark_type: 'TEXT' | 'IMAGE';
  readonly watermark_config_hash: string;
  readonly provenance: Record<string, any>;
  readonly created_at: string;
}

export interface WatermarkDerivativeResult {
  readonly derivative_bytes: Uint8Array;
  readonly sha256: string;
  readonly byte_size: number;
  readonly width: number;
  readonly height: number;
  readonly mime_type: 'image/png';
  readonly transform_id: string;
  readonly watermark_config_hash: string;
  readonly source_sha256: string;
  readonly provenance: Record<string, any>;
}

/**
 * Renders a canonical TEXT watermark onto the source image using deterministic geometry.
 * Preserves exact source dimensions.
 */
export async function renderTextWatermarkDerivative(
  sourceBytes: Uint8Array | ArrayBuffer,
  options: {
    text?: string;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    opacity?: number;
    sourceMeta?: { width?: number; height?: number; mime?: string; sha256?: string };
    engineVersion?: string;
    watermarkVersion?: number;
  } = {}
): Promise<WatermarkDerivativeResult> {
  const bytes = sourceBytes instanceof Uint8Array ? sourceBytes : new Uint8Array(sourceBytes);
  const sourceSha = options.sourceMeta?.sha256 || (await computeBinarySha256(bytes));

  const img = await loadImage(Buffer.from(bytes));
  const sourceWidth = img.width;
  const sourceHeight = img.height;

  const config = {
    ...DEFAULT_WATERMARK_CONFIG,
    type: WATERMARK_TYPES.TEXT,
    position: options.position || DEFAULT_WATERMARK_CONFIG.position,
    opacity: options.opacity ?? DEFAULT_WATERMARK_CONFIG.opacity,
    text: {
      ...DEFAULT_WATERMARK_CONFIG.text,
      value: options.text || DEFAULT_WATERMARK_CONFIG.text.value
    }
  };

  const metrics = calculateTextWatermarkMetrics({
    width: sourceWidth,
    height: sourceHeight,
    config
  });

  const canvas = createCanvas(sourceWidth, sourceHeight);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, sourceWidth, sourceHeight);

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
    marginXRatio: config.margin_x_ratio,
    marginYRatio: config.margin_y_ratio
  });

  // Subtle readability treatment: subtle shadow + crisp white text
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = Math.max(2, Math.round(metrics.fontSizePx * 0.15));
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.fillText(metrics.value, placement.x, placement.y);
  ctx.restore();

  const derivativeBuf = canvas.toBuffer('image/png');
  const derivativeBytes = new Uint8Array(derivativeBuf);

  // Validate derivative binary
  const validated = await validateArtifactBinary(derivativeBytes, {
    declaredMime: 'image/png',
    declaredWidth: sourceWidth,
    declaredHeight: sourceHeight,
    providerName: 'watermark_derivative_engine'
  });

  const canonicalConfigStr = computeCanonicalConfigString(config);
  const { createHash } = await import('node:crypto');
  const watermarkConfigHash = createHash('sha256').update(canonicalConfigStr).digest('hex');

  const transformId = await computeTransformId({
    sourceSha256: sourceSha,
    normalizedConfig: config,
    watermarkVersion: options.watermarkVersion ?? DEFAULT_WATERMARK_VERSION,
    engineVersion: options.engineVersion ?? WATERMARK_ENGINE_VERSION
  });

  const provenance = {
    source_sha256: sourceSha,
    derivative_sha256: validated.sha256,
    transform_id: transformId,
    watermark_config_hash: watermarkConfigHash,
    watermark_type: 'TEXT',
    watermark_text: config.text.value,
    watermark_position: config.position,
    watermark_opacity: config.opacity,
    engine_version: options.engineVersion ?? WATERMARK_ENGINE_VERSION,
    watermark_version: options.watermarkVersion ?? DEFAULT_WATERMARK_VERSION,
    created_at: new Date().toISOString(),
    width: validated.width,
    height: validated.height,
    byte_size: validated.byteSize,
    mime: validated.mimeType
  };

  return {
    derivative_bytes: derivativeBytes,
    sha256: validated.sha256,
    byte_size: validated.byteSize,
    width: validated.width,
    height: validated.height,
    mime_type: 'image/png',
    transform_id: transformId,
    watermark_config_hash: watermarkConfigHash,
    source_sha256: sourceSha,
    provenance
  };
}

/**
 * Creates the StoredGeneratedImageArtifact record after verified storage upload.
 */
export function createStoredGeneratedImageArtifact(options: {
  sourceArtifact: GeneratedImageArtifact;
  derivative: WatermarkDerivativeResult;
  bucket: string;
  storageKey: string;
}): StoredGeneratedImageArtifact {
  const artifactId = computeArtifactId(options.derivative.sha256);

  const fullProvenance = {
    ...options.sourceArtifact.provenance,
    derivative_provenance: options.derivative.provenance,
    storage: {
      provider: 'cloudflare_r2',
      bucket: options.bucket,
      storage_key: options.storageKey,
      sha256: options.derivative.sha256,
      byte_size: options.derivative.byte_size
    }
  };

  return {
    artifact_id: artifactId,
    source_artifact_id: options.sourceArtifact.artifact_id,
    source_type: options.sourceArtifact.source_type,
    storage_provider: 'cloudflare_r2',
    bucket: options.bucket,
    storage_key: options.storageKey,
    mime_type: options.derivative.mime_type,
    width: options.derivative.width,
    height: options.derivative.height,
    byte_size: options.derivative.byte_size,
    sha256: options.derivative.sha256,
    watermark_applied: true,
    watermark_type: 'TEXT',
    watermark_config_hash: options.derivative.watermark_config_hash,
    provenance: fullProvenance,
    created_at: new Date().toISOString()
  };
}
