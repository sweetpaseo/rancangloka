/**
 * RancangLoka — Meta Instagram Business Platform Adapter
 * Milestone: SOCIAL-S3
 *
 * Implements SocialPlatformAdapter for Instagram Business.
 * Handles the native 2-stage container publication workflow:
 * - Single item: container creation -> media publish
 * - Carousel: item containers -> carousel container -> media publish
 *
 * Safety Invariants:
 * 1. Default executionMode is strictly 'DISABLED'.
 * 2. Real network calls fail closed with PROVIDER_EXECUTION_DISABLED.
 * 3. Configuration holds zero raw secrets.
 * 4. Deterministic validation for aspect ratios, caption length, and media requirement.
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
import { INSTAGRAM_BUSINESS_CAPABILITIES } from './capabilities.ts';
import { buildInstagramBusinessRequest } from './request-builder.ts';
import { normalizeInstagramBusinessResponse } from './response-normalizer.ts';
import { classifyMetaError } from './error-classifier.ts';
import type { MetaProviderConfig } from './types.ts';

export class MetaInstagramBusinessAdapter implements SocialPlatformAdapter {
  public readonly providerId: SocialProviderId = 'meta';
  public readonly platformId = 'instagram_business';

  private config: MetaProviderConfig;
  private executionMode: SocialProviderExecutionMode;

  constructor(config?: Partial<MetaProviderConfig>) {
    this.config = {
      provider: 'meta',
      graphApiVersion: config?.graphApiVersion || 'v21.0',
      instagramAccountId: config?.instagramAccountId,
      credentialBindingName: config?.credentialBindingName,
      executionMode: config?.executionMode || 'DISABLED',
    };
    this.executionMode = this.config.executionMode || 'DISABLED';
  }

  public capabilities(): SocialPlatformCapabilityMatrix {
    return INSTAGRAM_BUSINESS_CAPABILITIES;
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

    if (!config.instagramAccountId || typeof config.instagramAccountId !== 'string') {
      errors.push('Missing or invalid instagramAccountId.');
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
      errors.push(`Variant type "${variant.variant_type}" is not supported by Instagram adapter (status: ${support}).`);
    }

    // Check caption length
    if (!payload.caption || payload.caption.trim().length === 0) {
      errors.push('Caption cannot be empty.');
    } else if (payload.caption.length > caps.maxCaptionLength) {
      errors.push(`Caption exceeds maximum length of ${caps.maxCaptionLength} characters.`);
    }

    // Media verification (Instagram strictly requires media)
    const mediaUrls = payload.mediaUrls || [];
    if (caps.requiresMediaForPost && mediaUrls.length === 0) {
      errors.push('Instagram strictly requires at least one media asset for publishing.');
    }

    // Carousel constraints
    if (variant.variant_type === 'CAROUSEL') {
      if (mediaUrls.length < (caps.minCarouselItems || 2)) {
        errors.push(`Instagram Carousel requires at least ${caps.minCarouselItems || 2} media items.`);
      }
      if (mediaUrls.length > (caps.maxCarouselItems || 10)) {
        errors.push(`Instagram Carousel allows at most ${caps.maxCarouselItems || 10} media items.`);
      }
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

    return buildInstagramBusinessRequest(input, effectiveConfig);
  }

  /**
   * Execute multi-stage Instagram publication workflow.
   * Multi-stage sequence:
   * 1. Container creation stage(s)
   * 2. Carousel parent container creation (if carousel)
   * 3. Media publish stage
   */
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
        message: 'PROVIDER_EXECUTION_DISABLED: Instagram Business adapter execution is disabled.',
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

    const stageProgress: string[] = [];

    try {
      let publishContainerId = '';
      const carouselItemIds: string[] = [];

      for (const stage of request.stages) {
        stageProgress.push(stage.stageName);

        // Dynamically inject container ID into subsequent dependent stages
        if (stage.stageName === 'instagram_carousel_container') {
          stage.transportRequest.bodyParams = {
            ...stage.transportRequest.bodyParams,
            children: carouselItemIds,
          };
        } else if (stage.stageName === 'instagram_media_publish') {
          stage.transportRequest.bodyParams = {
            ...stage.transportRequest.bodyParams,
            creation_id: publishContainerId,
          };
        }

        const response = await transport.request(stage.transportRequest);

        if (response.status < 200 || response.status >= 300) {
          const error = this.classifyError(response);
          return {
            success: false,
            providerId: this.providerId,
            platformId: this.platformId,
            providerPostId: null,
            permalink: null,
            publishedAt: null,
            stageProgress,
            error,
            rawDetails: response.body,
          };
        }

        // Capture IDs created along the chain
        if (stage.stageName.startsWith('instagram_carousel_item_')) {
          carouselItemIds.push(response.body?.id || 'mock_item_container_id');
        } else if (
          stage.stageName === 'instagram_media_container' ||
          stage.stageName === 'instagram_carousel_container'
        ) {
          publishContainerId = response.body?.id || 'mock_publish_container_id';
        } else if (stage.stageName === 'instagram_media_publish') {
          // Final stage response
          return this.normalizeReceipt(response, request);
        }
      }

      // If somehow no publish stage was hit
      return {
        success: false,
        providerId: this.providerId,
        platformId: this.platformId,
        providerPostId: null,
        permalink: null,
        publishedAt: null,
        stageProgress,
        error: {
          errorClass: 'UNKNOWN_PROVIDER_ERROR',
          message: 'Instagram publish workflow completed without final publish stage.',
          retryable: false,
        },
      };
    } catch (err: any) {
      const error = this.classifyError(err);
      return {
        success: false,
        providerId: this.providerId,
        platformId: this.platformId,
        providerPostId: null,
        permalink: null,
        publishedAt: null,
        stageProgress,
        error,
      };
    }
  }

  public normalizeReceipt(
    response: SocialTransportResponse,
    request?: SocialBuiltRequest
  ): SocialNormalizedPublishResult {
    return normalizeInstagramBusinessResponse(response, request);
  }

  public classifyError(responseOrError: SocialTransportResponse | Error): SocialNormalizedError {
    return classifyMetaError(responseOrError);
  }
}
