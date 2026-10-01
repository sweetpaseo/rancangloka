/**
 * RancangLoka — Social Media Automation Platform Provider Contracts
 * Milestone: SOCIAL-S3
 *
 * Strict Invariants:
 * 1. ZERO EXTERNAL NETWORK CALLS IN CORE / TEST CODE.
 * 2. Provider-neutral: The core Social domain must NOT depend on provider-specific modules.
 * 3. Execution Gate: Adapters must be disabled by default (PROVIDER_EXECUTION_DISABLED).
 * 4. Zero Credential Exposure: Configuration models must never hold raw tokens or secrets.
 * 5. Deterministic Validation: Invalid variant, mismatched approval, or payload mutation fails closed.
 */

import type { SocialPostVariantRecord, SocialVariantType, SocialMediaAspectRatio } from '../types.ts';

export type SocialProviderId = 'meta' | string;
export type SocialPlatformId = 'facebook_page' | 'instagram_business' | string;

export type SocialProviderExecutionMode = 'DISABLED' | 'MOCK_ONLY' | 'LIVE';

export type SocialCapabilityStatus = 'SUPPORTED' | 'UNSUPPORTED' | 'UNVERIFIED';

export interface SocialPlatformCapabilityMatrix {
  platformId: SocialPlatformId;
  providerId: SocialProviderId;
  variantSupport: Record<SocialVariantType, SocialCapabilityStatus>;
  supportedAspectRatios: SocialMediaAspectRatio[];
  maxCaptionLength: number;
  maxHashtags?: number;
  minCarouselItems?: number;
  maxCarouselItems?: number;
  supportsScheduling: boolean;
  requiresMediaForPost: boolean;
  description: string;
}

export type SocialTransportMethod = 'GET' | 'POST' | 'DELETE' | 'PUT';

export interface SocialTransportRequest {
  method: SocialTransportMethod;
  url: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  bodyParams?: Record<string, any>;
  timeoutMs?: number;
}

export interface SocialTransportResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
}

export interface SocialProviderTransport {
  request(req: SocialTransportRequest): Promise<SocialTransportResponse>;
}

export type SocialNormalizedErrorClass =
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'RATE_LIMIT'
  | 'MEDIA_INVALID'
  | 'CONTENT_REJECTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'TRANSIENT_NETWORK'
  | 'DUPLICATE'
  | 'EXECUTION_DISABLED'
  | 'VALIDATION_FAILED'
  | 'UNKNOWN_PROVIDER_ERROR';

export interface SocialNormalizedError {
  errorClass: SocialNormalizedErrorClass;
  providerCode?: number | string | null;
  providerSubcode?: number | string | null;
  message: string;
  retryable: boolean;
  suggestedAction?: string;
  rawError?: any;
}

export interface SocialNormalizedPublishResult {
  success: boolean;
  providerId: SocialProviderId;
  platformId: SocialPlatformId;
  providerPostId: string | null;
  permalink: string | null;
  publishedAt: string | null;
  stageProgress: string[];
  rawDetails?: Record<string, any>;
  error?: SocialNormalizedError;
}

export interface SocialValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface SocialPublishRequestInput {
  variant: SocialPostVariantRecord;
  approvedPayload: {
    caption: string;
    mediaUrls?: string[];
    canonicalUrl?: string;
    hashtags?: string[];
  };
  config: Record<string, any>;
  outboxId?: string;
  operationId?: string;
}

export interface SocialBuiltRequest {
  providerId: SocialProviderId;
  platformId: SocialPlatformId;
  operationId: string;
  stages: Array<{
    stageName: string;
    transportRequest: SocialTransportRequest;
  }>;
  metadata: Record<string, any>;
}

export interface SocialPlatformAdapter {
  readonly providerId: SocialProviderId;
  readonly platformId: SocialPlatformId;

  capabilities(): SocialPlatformCapabilityMatrix;
  validateConfiguration(config: any): SocialValidationResult;
  validateVariant(
    variant: SocialPostVariantRecord,
    payload: { caption: string; mediaUrls?: string[]; canonicalUrl?: string }
  ): SocialValidationResult;
  buildPublishRequest(input: SocialPublishRequestInput): SocialBuiltRequest;
  executePublish(
    request: SocialBuiltRequest,
    transport: SocialProviderTransport,
    options?: { executionMode?: SocialProviderExecutionMode }
  ): Promise<SocialNormalizedPublishResult>;
  normalizeReceipt(response: SocialTransportResponse, request?: SocialBuiltRequest): SocialNormalizedPublishResult;
  classifyError(response: SocialTransportResponse | Error): SocialNormalizedError;
}
