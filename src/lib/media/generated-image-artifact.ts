/**
 * RancangLoka — Provider-Neutral Image Artifact Normalization & Validation (MEDIA-A2)
 *
 * Implements the canonical GeneratedImageArtifact contract and normalization layer
 * bridging autonomous headless providers (fal.ai FLUX), manual browser capture
 * (ChatGPT Plus / LokaMedia bridge), and safe local image fixtures.
 *
 * SAFETY INVARIANTS:
 * - Deterministic content-addressed identity rule: art_${sha256.substring(0, 24)}
 * - Binary validation based on actual magic bytes, not extension/metadata trust
 * - Strict secret firewall: rejects and redacts all auth headers, cookies, API keys, tokens
 * - Zero production mutations: zero D1 writes, zero R2 uploads, zero publication side effects
 */

import fs from 'node:fs';
import {
  type ImageGenerationResult,
  type ImageGenerationRequest
} from './image-provider-types.ts';
import {
  validateImageBinary,
  computeBinarySha256,
  type ValidatedImageBinary
} from './image-validation.ts';

export type MediaA2ErrorCode =
  | 'EMPTY_IMAGE'
  | 'INVALID_IMAGE_SIGNATURE'
  | 'UNSUPPORTED_MIME'
  | 'DIMENSION_INVALID'
  | 'HASH_FAILURE'
  | 'PROVENANCE_INVALID'
  | 'SOURCE_MISSING'
  | 'NORMALIZATION_ERROR';

export class MediaArtifactError extends Error {
  readonly code: MediaA2ErrorCode;
  readonly details?: Record<string, any>;

  constructor(options: {
    code: MediaA2ErrorCode;
    message: string;
    details?: Record<string, any>;
  }) {
    super(options.message);
    this.name = 'MediaArtifactError';
    this.code = options.code;
    this.details = options.details;
  }
}

export type ArtifactSourceType =
  | 'fal_api'
  | 'chatgpt_browser_bridge'
  | 'local_fixture'
  | (string & {});

export const ARTIFACT_IDENTITY_RULE = 'art_${sha256.substring(0, 24)}';

/**
 * Computes deterministic content-addressed artifact ID from SHA-256 hex string.
 */
export function computeArtifactId(sha256Hex: string): string {
  if (!sha256Hex || typeof sha256Hex !== 'string' || sha256Hex.length < 24) {
    throw new MediaArtifactError({
      code: 'HASH_FAILURE',
      message: `Invalid SHA-256 for artifact identity generation: "${sha256Hex}".`
    });
  }
  return `art_${sha256Hex.toLowerCase().substring(0, 24)}`;
}

export interface NormalizedProvenance {
  source_type: string;
  provider: string;
  model?: string;
  request_id?: string;
  prompt_hash?: string;
  prompt_version?: number;
  capture_method?: string;
  created_at: string;
  width: number;
  height: number;
  mime: string;
  byte_size: number;
  sha256: string;
  adapter_version?: string;
  capture_timestamp?: string;
  is_canonical_original?: boolean;
  [key: string]: any;
}

export interface GeneratedImageArtifact {
  readonly artifact_id: string;
  readonly source_type: ArtifactSourceType;
  readonly provider: string;
  readonly model?: string;
  readonly provider_request_id?: string;
  readonly local_path?: string;
  readonly image_bytes: Uint8Array;
  readonly mime_type: 'image/png' | 'image/jpeg' | 'image/webp';
  readonly width: number;
  readonly height: number;
  readonly byte_size: number;
  readonly sha256: string;
  readonly prompt_hash?: string;
  readonly prompt_version?: number;
  readonly media_role: 'featured' | 'inline' | 'comparison_visual' | 'process_visual' | string;
  readonly purpose: string;
  readonly created_at: string;
  readonly provenance: NormalizedProvenance;
}

/**
 * MEDIA-A3 Downstream Handoff Input Contract.
 * Consumed by future watermark, R2 storage, and media registration pipelines.
 */
export interface MediaA3InputContract {
  artifact_id: string;
  source_type: string;
  provider: string;
  model?: string;
  local_path?: string;
  image_bytes: Uint8Array;
  mime_type: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  byte_size: number;
  sha256: string;
  prompt_hash?: string;
  prompt_version?: number;
  media_role: string;
  purpose: string;
  created_at: string;
  provenance: NormalizedProvenance;
}

/**
 * Creates the validated handoff contract for MEDIA-A3 consumption.
 */
export function createMediaA3Contract(artifact: GeneratedImageArtifact): MediaA3InputContract {
  return {
    artifact_id: artifact.artifact_id,
    source_type: artifact.source_type,
    provider: artifact.provider,
    model: artifact.model,
    local_path: artifact.local_path,
    image_bytes: artifact.image_bytes,
    mime_type: artifact.mime_type,
    width: artifact.width,
    height: artifact.height,
    byte_size: artifact.byte_size,
    sha256: artifact.sha256,
    prompt_hash: artifact.prompt_hash,
    prompt_version: artifact.prompt_version,
    media_role: artifact.media_role,
    purpose: artifact.purpose,
    created_at: artifact.created_at,
    provenance: { ...artifact.provenance }
  };
}

/**
 * Secret / Privacy Firewall.
 * Sanitizes provenance and rejects secret keywords or credentials.
 */
const FORBIDDEN_KEY_PATTERNS = [
  /fal_?key/i,
  /auth(orization)?/i,
  /cookie/i,
  /session(_?token)?/i,
  /access_?token/i,
  /secret/i,
  /credential/i,
  /bearer/i,
  /password/i,
  /api_?key/i,
  /local_?storage/i
];

// Whitelist of benign keys that may contain partial matches (e.g. 'slot_key', 'blobKey', 'r2_key')
const WHITELISTED_SAFE_KEYS = new Set([
  'slot_key',
  'blobKey',
  'blob_key',
  'r2_key'
]);

/**
 * Sanitizes URLs to remove sensitive query parameters (e.g. ?key=..., &sig=..., &token=...)
 */
export function sanitizeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl);
    const sensitiveParams = ['sig', 'signature', 'token', 'key', 'api_key', 'auth', 'x-amz-signature', 'x-amz-credential'];
    for (const param of sensitiveParams) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, 'REDACTED');
      }
    }
    return parsed.toString();
  } catch {
    return rawUrl.replace(/([?&](?:sig|signature|token|key|api_key|auth)=)[^&]+/gi, '$1REDACTED');
  }
}

/**
 * Deeply sanitizes any provenance object, stripping secrets, auth tokens, and session cookies.
 */
export function sanitizeProvenance(raw: Record<string, any> = {}): NormalizedProvenance {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(raw)) {
    // Check key against forbidden list unless explicitly whitelisted
    if (!WHITELISTED_SAFE_KEYS.has(key)) {
      const isForbiddenKey = FORBIDDEN_KEY_PATTERNS.some((pat) => pat.test(key));
      if (isForbiddenKey) {
        continue; // Omit entirely from sanitized provenance
      }
    }

    if (value === null || value === undefined) {
      sanitized[key] = value;
    } else if (typeof value === 'string') {
      // Check for URL sanitization
      if (value.startsWith('http://') || value.startsWith('https://')) {
        sanitized[key] = sanitizeUrl(value);
      } else {
        // Redact any credential-like string patterns
        let cleaned = value;
        if (/bearer\s+[a-zA-Z0-9._~+/-]+=*/i.test(cleaned)) {
          cleaned = cleaned.replace(/bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]');
        }
        sanitized[key] = cleaned;
      }
    } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array)) {
      sanitized[key] = sanitizeProvenance(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as NormalizedProvenance;
}

/**
 * Validates raw image binary bytes against strict media integrity rules and
 * verifies consistency with declared metadata.
 */
export async function validateArtifactBinary(
  bufferOrBytes: ArrayBuffer | Uint8Array,
  options: {
    declaredMime?: string;
    declaredWidth?: number;
    declaredHeight?: number;
    declaredSha256?: string;
    providerName?: string;
  } = {}
): Promise<ValidatedImageBinary> {
  if (!bufferOrBytes) {
    throw new MediaArtifactError({
      code: 'EMPTY_IMAGE',
      message: 'Image binary is missing, null, or undefined.'
    });
  }

  const bytes = bufferOrBytes instanceof Uint8Array ? bufferOrBytes : new Uint8Array(bufferOrBytes);
  const byteSize = bytes.byteLength;

  if (byteSize === 0) {
    throw new MediaArtifactError({
      code: 'EMPTY_IMAGE',
      message: 'Image binary contains 0 bytes.'
    });
  }

  if (byteSize < 16) {
    throw new MediaArtifactError({
      code: 'INVALID_IMAGE_SIGNATURE',
      message: `Image binary is truncated (${byteSize} bytes, minimum 16 required).`
    });
  }

  // Detect HTML or JSON error masquerading as image
  const first32Str = String.fromCharCode(...bytes.slice(0, Math.min(32, bytes.length))).trim().toLowerCase();
  if (
    first32Str.startsWith('<html') ||
    first32Str.startsWith('<!doctype') ||
    first32Str.startsWith('<?xml') ||
    first32Str.startsWith('{"error"') ||
    first32Str.startsWith('{"message"')
  ) {
    throw new MediaArtifactError({
      code: 'INVALID_IMAGE_SIGNATURE',
      message: 'Payload is HTML, XML, or JSON error text, not a valid image binary.'
    });
  }

  let validated: ValidatedImageBinary;
  try {
    validated = await validateImageBinary(bytes, options.providerName || 'media_artifact');
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('Unrecognized image binary format')) {
      throw new MediaArtifactError({
        code: 'INVALID_IMAGE_SIGNATURE',
        message: msg
      });
    }
    if (msg.includes('empty or truncated')) {
      throw new MediaArtifactError({
        code: 'EMPTY_IMAGE',
        message: msg
      });
    }
    if (msg.includes('dimensions')) {
      throw new MediaArtifactError({
        code: 'DIMENSION_INVALID',
        message: msg
      });
    }
    throw new MediaArtifactError({
      code: 'INVALID_IMAGE_SIGNATURE',
      message: msg
    });
  }

  // MIME consistency verification
  if (options.declaredMime) {
    const normDeclared = options.declaredMime.toLowerCase().replace('jpg', 'jpeg');
    const normDetected = validated.mimeType.toLowerCase();
    if (normDeclared !== normDetected) {
      throw new MediaArtifactError({
        code: 'UNSUPPORTED_MIME',
        message: `MIME mismatch: declared "${options.declaredMime}", but binary header is "${validated.mimeType}".`
      });
    }
  }

  // Dimension consistency verification
  if (options.declaredWidth !== undefined && options.declaredWidth > 0) {
    if (options.declaredWidth !== validated.width) {
      throw new MediaArtifactError({
        code: 'DIMENSION_INVALID',
        message: `Width mismatch: declared ${options.declaredWidth}, but binary parsed ${validated.width}.`
      });
    }
  }
  if (options.declaredHeight !== undefined && options.declaredHeight > 0) {
    if (options.declaredHeight !== validated.height) {
      throw new MediaArtifactError({
        code: 'DIMENSION_INVALID',
        message: `Height mismatch: declared ${options.declaredHeight}, but binary parsed ${validated.height}.`
      });
    }
  }

  // SHA-256 consistency verification
  if (options.declaredSha256) {
    if (options.declaredSha256.toLowerCase() !== validated.sha256.toLowerCase()) {
      throw new MediaArtifactError({
        code: 'HASH_FAILURE',
        message: `SHA-256 mismatch: declared ${options.declaredSha256}, but binary computed ${validated.sha256}.`
      });
    }
  }

  return validated;
}

/**
 * Normalizes an ImageGenerationResult (from fal.ai FLUX, OpenAI DALL-E, or other headless adapter)
 * into a provider-neutral GeneratedImageArtifact.
 */
export async function normalizeHeadlessResult(
  result: ImageGenerationResult,
  options: {
    request?: ImageGenerationRequest;
    local_path?: string;
    prompt_hash?: string;
    prompt_version?: number;
    purpose?: string;
    media_role?: string;
  } = {}
): Promise<GeneratedImageArtifact> {
  if (!result) {
    throw new MediaArtifactError({
      code: 'SOURCE_MISSING',
      message: 'ImageGenerationResult is missing or null.'
    });
  }

  let rawBytes: Uint8Array = result.image_bytes;
  if ((!rawBytes || rawBytes.byteLength === 0) && options.local_path && fs.existsSync(options.local_path)) {
    rawBytes = fs.readFileSync(options.local_path);
  }

  const binaryValidation = await validateArtifactBinary(rawBytes, {
    declaredMime: result.mime_type,
    declaredWidth: result.width,
    declaredHeight: result.height,
    declaredSha256: result.sha256,
    providerName: result.provider
  });

  const artifactId = computeArtifactId(binaryValidation.sha256);
  const sourceType: ArtifactSourceType = result.provider === 'fal' ? 'fal_api' : `${result.provider}_api`;

  const rawProvenance: Record<string, any> = {
    source_type: sourceType,
    provider: result.provider,
    model: result.model,
    request_id: result.provider_request_id || options.request?.request_id || artifactId,
    prompt_hash: options.prompt_hash || null,
    prompt_version: options.prompt_version ?? 1,
    capture_method: 'API_DIRECT',
    created_at: result.created_at || new Date().toISOString(),
    width: binaryValidation.width,
    height: binaryValidation.height,
    mime: binaryValidation.mimeType,
    byte_size: binaryValidation.byteSize,
    sha256: binaryValidation.sha256,
    latency_ms: result.latency_ms,
    delivery_type: result.delivery_type,
    revised_prompt: result.revised_prompt || null
  };

  const provenance = sanitizeProvenance(rawProvenance);

  return {
    artifact_id: artifactId,
    source_type: sourceType,
    provider: result.provider,
    model: result.model,
    provider_request_id: result.provider_request_id,
    local_path: options.local_path,
    image_bytes: rawBytes,
    mime_type: binaryValidation.mimeType,
    width: binaryValidation.width,
    height: binaryValidation.height,
    byte_size: binaryValidation.byteSize,
    sha256: binaryValidation.sha256,
    prompt_hash: options.prompt_hash,
    prompt_version: options.prompt_version ?? 1,
    media_role: options.media_role || options.request?.media_role || 'featured',
    purpose: options.purpose || options.request?.purpose || 'canary',
    created_at: result.created_at || new Date().toISOString(),
    provenance
  };
}

/**
 * Normalizes LokaMedia / ChatGPT Plus browser bridge capture output into
 * a provider-neutral GeneratedImageArtifact.
 */
export async function normalizeChatGptBridgeResult(
  bridgeResult: {
    bytes?: ArrayBuffer | Uint8Array;
    data_url?: string;
    size?: number;
    mime?: string;
    width?: number;
    height?: number;
    sha256?: string;
    blobKey?: string;
    provenance?: string;
    is_canonical_original?: boolean;
    provider_conversation_id?: string;
    provider_response_id?: string;
    [key: string]: any;
  },
  options: {
    job?: {
      job_id?: string;
      prompt_hash?: string;
      prompt_version?: number;
      slot_key?: string;
      purpose?: string;
      media_role?: string;
      timeout_ms?: number;
      [key: string]: any;
    };
    local_path?: string;
  } = {}
): Promise<GeneratedImageArtifact> {
  if (!bridgeResult) {
    throw new MediaArtifactError({
      code: 'SOURCE_MISSING',
      message: 'ChatGPT bridge capture result is missing or null.'
    });
  }

  let rawBytes: Uint8Array | null = null;

  if (bridgeResult.bytes) {
    rawBytes = bridgeResult.bytes instanceof Uint8Array ? bridgeResult.bytes : new Uint8Array(bridgeResult.bytes);
  } else if (bridgeResult.data_url && bridgeResult.data_url.startsWith('data:')) {
    const base64 = bridgeResult.data_url.split(',')[1] || '';
    const binaryStr = Buffer.from(base64, 'base64');
    rawBytes = new Uint8Array(binaryStr);
  } else if (options.local_path && fs.existsSync(options.local_path)) {
    rawBytes = fs.readFileSync(options.local_path);
  }

  if (!rawBytes) {
    throw new MediaArtifactError({
      code: 'EMPTY_IMAGE',
      message: 'No image bytes found in ChatGPT bridge capture result.'
    });
  }

  const binaryValidation = await validateArtifactBinary(rawBytes, {
    declaredMime: bridgeResult.mime,
    declaredWidth: bridgeResult.width,
    declaredHeight: bridgeResult.height,
    declaredSha256: bridgeResult.sha256,
    providerName: 'chatgpt_browser_bridge'
  });

  const artifactId = computeArtifactId(binaryValidation.sha256);

  const rawProvenance: Record<string, any> = {
    source_type: 'chatgpt_browser_bridge',
    provider: 'chatgpt',
    model: 'gpt-4o',
    request_id: options.job?.job_id || bridgeResult.blobKey || artifactId,
    prompt_hash: options.job?.prompt_hash || null,
    prompt_version: options.job?.prompt_version ?? 1,
    capture_method: bridgeResult.provenance || 'PROVIDER_BINARY',
    is_canonical_original: bridgeResult.is_canonical_original ?? (bridgeResult.provenance !== 'CANVAS_REENCODED'),
    adapter_version: '0.1.0',
    created_at: new Date().toISOString(),
    width: binaryValidation.width,
    height: binaryValidation.height,
    mime: binaryValidation.mimeType,
    byte_size: binaryValidation.byteSize,
    sha256: binaryValidation.sha256,
    provider_conversation_id: bridgeResult.provider_conversation_id || null,
    provider_response_id: bridgeResult.provider_response_id || null
  };

  const provenance = sanitizeProvenance(rawProvenance);

  return {
    artifact_id: artifactId,
    source_type: 'chatgpt_browser_bridge',
    provider: 'chatgpt',
    model: 'gpt-4o',
    provider_request_id: bridgeResult.provider_response_id || bridgeResult.blobKey,
    local_path: options.local_path,
    image_bytes: rawBytes,
    mime_type: binaryValidation.mimeType,
    width: binaryValidation.width,
    height: binaryValidation.height,
    byte_size: binaryValidation.byteSize,
    sha256: binaryValidation.sha256,
    prompt_hash: options.job?.prompt_hash,
    prompt_version: options.job?.prompt_version ?? 1,
    media_role: options.job?.media_role || options.job?.slot_key || 'featured',
    purpose: options.job?.purpose || 'editorial',
    created_at: rawProvenance.created_at,
    provenance
  };
}

/**
 * Normalizes a local project-owned image fixture into a provider-neutral GeneratedImageArtifact.
 */
export async function normalizeLocalFixture(options: {
  filePath?: string;
  bytes?: Uint8Array | ArrayBuffer;
  media_role?: string;
  purpose?: string;
  prompt_hash?: string;
  prompt_version?: number;
  model?: string;
  provider?: string;
}): Promise<GeneratedImageArtifact> {
  let rawBytes: Uint8Array;

  if (options.filePath) {
    if (!fs.existsSync(options.filePath)) {
      throw new MediaArtifactError({
        code: 'SOURCE_MISSING',
        message: `Local fixture image file not found: "${options.filePath}".`
      });
    }
    rawBytes = fs.readFileSync(options.filePath);
  } else if (options.bytes) {
    rawBytes = options.bytes instanceof Uint8Array ? options.bytes : new Uint8Array(options.bytes);
  } else {
    throw new MediaArtifactError({
      code: 'SOURCE_MISSING',
      message: 'Neither filePath nor bytes provided for local fixture normalization.'
    });
  }

  const binaryValidation = await validateArtifactBinary(rawBytes, {
    providerName: options.provider || 'local_fixture'
  });

  const artifactId = computeArtifactId(binaryValidation.sha256);
  const now = new Date().toISOString();

  const rawProvenance: Record<string, any> = {
    source_type: 'local_fixture',
    provider: options.provider || 'local_fixture',
    model: options.model || 'internal_fixture',
    request_id: artifactId,
    prompt_hash: options.prompt_hash || null,
    prompt_version: options.prompt_version ?? 1,
    capture_method: 'FILESYSTEM_FIXTURE',
    created_at: now,
    width: binaryValidation.width,
    height: binaryValidation.height,
    mime: binaryValidation.mimeType,
    byte_size: binaryValidation.byteSize,
    sha256: binaryValidation.sha256,
    local_path: options.filePath || null
  };

  const provenance = sanitizeProvenance(rawProvenance);

  return {
    artifact_id: artifactId,
    source_type: 'local_fixture',
    provider: options.provider || 'local_fixture',
    model: options.model || 'internal_fixture',
    provider_request_id: artifactId,
    local_path: options.filePath,
    image_bytes: rawBytes,
    mime_type: binaryValidation.mimeType,
    width: binaryValidation.width,
    height: binaryValidation.height,
    byte_size: binaryValidation.byteSize,
    sha256: binaryValidation.sha256,
    prompt_hash: options.prompt_hash,
    prompt_version: options.prompt_version ?? 1,
    media_role: options.media_role || 'featured',
    purpose: options.purpose || 'canary',
    created_at: now,
    provenance
  };
}
