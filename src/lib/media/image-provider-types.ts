/**
 * RancangLoka — Headless Image Provider Abstraction (MEDIA-A1)
 *
 * Provider-agnostic domain models, request/response contracts, and typed error models
 * for automated headless image generation without browser or extension dependencies.
 */

export type ProviderErrorCode =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'PROVIDER_5XX'
  | 'INVALID_RESPONSE'
  | 'CONTENT_POLICY_BLOCK'
  | 'DOWNLOAD_FAILURE'
  | 'UNKNOWN_PROVIDER_ERROR';

export class ImageProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly provider: string;
  readonly httpStatus?: number;
  readonly isBillable: boolean;
  readonly details?: Record<string, any>;

  constructor(options: {
    code: ProviderErrorCode;
    provider: string;
    message: string;
    httpStatus?: number;
    isBillable?: boolean;
    details?: Record<string, any>;
  }) {
    super(options.message);
    this.name = 'ImageProviderError';
    this.code = options.code;
    this.provider = options.provider;
    this.httpStatus = options.httpStatus;
    this.isBillable = options.isBillable ?? false;
    this.details = options.details;
  }
}

export interface ImageGenerationRequest {
  request_id: string;
  prompt: string;
  width?: number;
  height?: number;
  aspect_ratio?: string; // e.g. '1315:660', '16:9', 'landscape'
  output_format?: 'png' | 'webp' | 'jpeg';
  quality?: 'standard' | 'hd';
  seed?: number;
  safety_profile?: Record<string, any>;
  purpose: string; // e.g. 'canary', 'featured_editorial'
  media_role?: 'featured' | 'inline' | 'comparison_visual' | 'process_visual';
  article_id?: number;
  slot_key?: string;
  timeout_ms?: number;
  model_override?: string;
}

export interface ImageCostMetadata {
  estimated_cost_usd?: number;
  billed_units?: number;
  pricing_tier?: string;
  is_billable?: boolean;
}

export interface ImageGenerationResult {
  provider: string;
  model: string;
  provider_request_id?: string;
  created_at: string;
  latency_ms: number;
  mime_type: string;
  width: number;
  height: number;
  byte_size: number;
  sha256: string;
  delivery_type: 'BASE64' | 'URL' | 'BYTES';
  image_bytes: Uint8Array;
  provider_url?: string;
  revised_prompt?: string;
  cost_metadata?: ImageCostMetadata;
}

export interface ImageProviderAdapter {
  readonly providerName: string;
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export type {
  GeneratedImageArtifact,
  NormalizedProvenance,
  MediaA3InputContract,
  ArtifactSourceType,
  MediaA2ErrorCode
} from './generated-image-artifact.ts';
export {
  MediaArtifactError,
  ARTIFACT_IDENTITY_RULE,
  computeArtifactId,
  createMediaA3Contract
} from './generated-image-artifact.ts';
