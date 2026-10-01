/**
 * RancangLoka — Meta Graph API Response Normalizer
 * Milestone: SOCIAL-S3
 *
 * Normalizes raw Meta Graph API responses into clean SocialNormalizedPublishResult.
 *
 * Invariants:
 * 1. ZERO RAW SECRET LEAKS: Redact potential tokens or auth headers.
 * 2. Missing post ID or error body fails closed.
 */

import type { SocialNormalizedPublishResult, SocialTransportResponse, SocialBuiltRequest } from '../types.ts';
import { classifyMetaError } from './error-classifier.ts';

/**
 * Redact sensitive fields from raw diagnostics
 */
export function sanitizeMetaPayload(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized: Record<string, any> = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('authorization') ||
      lowerKey.includes('cookie')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetaPayload(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Normalize Facebook Page response
 *
 * Graph API response shapes:
 * - Photo post: { id: "123456789_photo_id", post_id: "123456789_post_id" }
 * - Feed post: { id: "123456789_post_id" }
 */
export function normalizeFacebookPageResponse(
  response: SocialTransportResponse,
  request?: SocialBuiltRequest
): SocialNormalizedPublishResult {
  if (response.status < 200 || response.status >= 300) {
    const error = classifyMetaError(response);
    return {
      success: false,
      providerId: 'meta',
      platformId: 'facebook_page',
      providerPostId: null,
      permalink: null,
      publishedAt: null,
      stageProgress: request ? request.stages.map((s) => s.stageName) : [],
      error,
      rawDetails: sanitizeMetaPayload(response.body),
    };
  }

  const body = response.body || {};
  const postId = body.post_id || body.id || null;

  if (!postId) {
    return {
      success: false,
      providerId: 'meta',
      platformId: 'facebook_page',
      providerPostId: null,
      permalink: null,
      publishedAt: null,
      stageProgress: request ? request.stages.map((s) => s.stageName) : [],
      error: {
        errorClass: 'UNKNOWN_PROVIDER_ERROR',
        message: 'Facebook response did not include a valid post ID.',
        retryable: false,
      },
      rawDetails: sanitizeMetaPayload(body),
    };
  }

  return {
    success: true,
    providerId: 'meta',
    platformId: 'facebook_page',
    providerPostId: String(postId),
    permalink: `https://www.facebook.com/${postId}`,
    publishedAt: new Date().toISOString(),
    stageProgress: request ? request.stages.map((s) => s.stageName) : ['facebook_publish'],
    rawDetails: sanitizeMetaPayload(body),
  };
}

/**
 * Normalize Instagram Business response
 *
 * Media publish endpoint returns: { id: "17912345678901234" }
 */
export function normalizeInstagramBusinessResponse(
  response: SocialTransportResponse,
  request?: SocialBuiltRequest
): SocialNormalizedPublishResult {
  if (response.status < 200 || response.status >= 300) {
    const error = classifyMetaError(response);
    return {
      success: false,
      providerId: 'meta',
      platformId: 'instagram_business',
      providerPostId: null,
      permalink: null,
      publishedAt: null,
      stageProgress: request ? request.stages.map((s) => s.stageName) : [],
      error,
      rawDetails: sanitizeMetaPayload(response.body),
    };
  }

  const body = response.body || {};
  const mediaId = body.id || null;

  if (!mediaId) {
    return {
      success: false,
      providerId: 'meta',
      platformId: 'instagram_business',
      providerPostId: null,
      permalink: null,
      publishedAt: null,
      stageProgress: request ? request.stages.map((s) => s.stageName) : [],
      error: {
        errorClass: 'UNKNOWN_PROVIDER_ERROR',
        message: 'Instagram response did not include a valid published media ID.',
        retryable: false,
      },
      rawDetails: sanitizeMetaPayload(body),
    };
  }

  return {
    success: true,
    providerId: 'meta',
    platformId: 'instagram_business',
    providerPostId: String(mediaId),
    permalink: `https://www.instagram.com/p/${mediaId}/`, // Canonical reference URL structure
    publishedAt: new Date().toISOString(),
    stageProgress: request ? request.stages.map((s) => s.stageName) : ['instagram_publish'],
    rawDetails: sanitizeMetaPayload(body),
  };
}
