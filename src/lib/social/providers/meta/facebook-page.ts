/**
 * RancangLoka — Meta Facebook Page Platform Adapter
 * Milestone: SOCIAL-S3
 *
 * Implements SocialPlatformAdapter for Facebook Page.
 *
 * Safety Invariants:
 * 1. Default executionMode is strictly 'DISABLED'.
 * 2. Real network calls fail closed with PROVIDER_EXECUTION_DISABLED.
 * 3. Configuration holds zero raw secrets.
 * 4. Deterministic validation for variant, payload hash, and format support.
 */

import type {
  SocialBuiltRequest,
  SocialNormalizedError,
  SocialNormalizedPublishResult,
  SocialPlatformAdapter,
  SocialPlatformCapabilityMatrix,
  SocialProviderExecutionMode,
  SocialProviderId,
  SocialProviderTransport,
  SocialPublishRequestInput,
  SocialTransportResponse,
  SocialValidationResult,
} from '../types.ts';
import type { SocialPostVariantRecord } from '../../types.ts';
import { FACEBOOK_PAGE_CAPABILITIES } from './capabilities.ts';
import { buildFacebookPageRequest } from './request-builder.ts';
import { normalizeFacebookPageResponse } from './response-normalizer.ts';
import { classifyMetaError } from './error-classifier.ts';
import type { MetaProviderConfig } from './types.ts';

export class MetaFacebookPageAdapter implements SocialPlatformAdapter {
  public readonly providerId: SocialProviderId = 'meta';
  public readonly platformId = 'facebook_page';

  private config: MetaProviderConfig;
  private executionMode: SocialProviderExecutionMode;

  constructor(config?: Partial<MetaProviderConfig>) {
    this.config = {
      provider: 'meta',
      graphApiVersion: config?.graphApiVersion || 'v21.0',
      facebookPageId: config?.facebookPageId,
      credentialBindingName: config?.credentialBindingName,
      executionMode: config?.executionMode || 'DISABLED',
    };
    this.executionMode = this.config.executionMode || 'DISABLED';
  }

  public capabilities(): SocialPlatformCapabilityMatrix {
    return FACEBOOK_PAGE_CAPABILITIES;
  }

  public validateConfiguration(config: any): SocialValidationResult {
    const errors: string[] = [];

    if (!config) {
      errors.push('Configuration object is required.');
      return { valid: false, errors };
    }

    if (config.provider !== 'meta') {
      errors.push(`Invalid provider "${config.provider}"; expected "meta".`);
    }

    if (!config.facebookPageId || typeof config.facebookPageId !== 'string') {
      errors.push('Missing or invalid facebookPageId.');
    }

    // Invariant: Fail if caller tries to pass raw secrets/tokens in configuration
    if (config.accessToken || config.access_token || config.appSecret || config.app_secret) {
      errors.push('CRITICAL: Raw secrets or access tokens are strictly forbidden in configuration.');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public validateVariant(
    variant: SocialPostVariantRecord,
    payload: { caption: string; mediaUrls?: string[]; canonicalUrl?: string }
  ): SocialValidationResult {
    const errors: string[] = [];
    const caps = this.capabilities();

    // Check platform match
    if (variant.platform_id !== this.platformId) {
      errors.push(`Target platform "${variant.platform_id}" does not match adapter platform "${this.platformId}".`);
    }

    // Check variant support
    const support = caps.variantSupport[variant.variant_type];
    if (support !== 'SUPPORTED') {
      errors.push(`Variant type "${variant.variant_type}" is not supported by Facebook Page adapter (status: ${support}).`);
    }

    // Check caption
    if (!payload.caption || payload.caption.trim().length === 0) {
      errors.push('Caption cannot be empty.');
    } else if (payload.caption.length > caps.maxCaptionLength) {
      errors.push(`Caption exceeds maximum length of ${caps.maxCaptionLength} characters.`);
    }

    // Media verification
    if (caps.requiresMediaForPost && (!payload.mediaUrls || payload.mediaUrls.length === 0)) {
      errors.push('This post format requires at least one media asset.');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public buildPublishRequest(input: SocialPublishRequestInput): SocialBuiltRequest {
    // Validate first
    const valResult = this.validateVariant(input.variant, input.approvedPayload);
    if (!valResult.valid) {
      throw new Error(`VALIDATION_FAILED: ${valResult.errors.join('; ')}`);
    }

    const effectiveConfig: MetaProviderConfig = {
      ...this.config,
      ...input.config,
    };

    return buildFacebookPageRequest(input, effectiveConfig);
  }

  public async executePublish(
    request: SocialBuiltRequest,
    transport: SocialProviderTransport,
    options?: { executionMode?: SocialProviderExecutionMode }
  ): Promise<SocialNormalizedPublishResult> {
    const mode = options?.executionMode || this.executionMode;

    // Strict Execution Gate
    if (mode === 'DISABLED') {
      const error: SocialNormalizedError = {
        errorClass: 'EXECUTION_DISABLED',
        message: 'PROVIDER_EXECUTION_DISABLED: Facebook Page adapter execution is disabled.',
        retryable: false,
        suggestedAction: 'Execution authority is 0. Do not attempt live publishing.',
      };
      return {
        success: false,
        providerId: this.providerId,
        platformId: this.platformId,
        providerPostId: null,
        permalink: null,
        publishedAt: null,
        stageProgress: [],
        error,
      };
    }

    // Execute through provided transport (Mock or future live)
    const stage = request.stages[0];
    if (!stage) {
      throw new Error('INVALID_REQUEST: No transport stages defined.');
    }

    try {
      const response = await transport.request(stage.transportRequest);
      return this.normalizeReceipt(response, request);
    } catch (err: any) {
      const error = this.classifyError(err);
      return {
        success: false,
        providerId: this.providerId,
        platformId: this.platformId,
        providerPostId: null,
        permalink: null,
        publishedAt: null,
        stageProgress: [stage.stageName],
        error,
      };
    }
  }

  public normalizeReceipt(
    response: SocialTransportResponse,
    request?: SocialBuiltRequest
  ): SocialNormalizedPublishResult {
    return normalizeFacebookPageResponse(response, request);
  }

  public classifyError(responseOrError: SocialTransportResponse | Error): SocialNormalizedError {
    return classifyMetaError(responseOrError);
  }
}
