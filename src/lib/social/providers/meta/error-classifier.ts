/**
 * RancangLoka — Meta Graph API Error Classifier
 * Milestone: SOCIAL-S3
 *
 * Deterministic mapping of Meta Graph API errors into SocialNormalizedError.
 * Invariant: Unknown errors remain UNKNOWN_PROVIDER_ERROR. No fabricated error classes.
 */

import type { SocialNormalizedError, SocialNormalizedErrorClass, SocialTransportResponse } from '../types.ts';
import type { MetaGraphErrorResponse } from './types.ts';

/**
 * Classify a Meta Graph API error response or caught exception into a normalized structure.
 *
 * Known Meta Error Codes:
 * - 190: Invalid OAuth 2.0 Access Token / Expired / Revoked -> AUTHENTICATION
 * - 102: API Session error -> AUTHENTICATION
 * - 10: Application does not have permission -> AUTHORIZATION
 * - 200..299: Permissions error (e.g. pages_manage_posts missing) -> AUTHORIZATION
 * - 4, 17, 32, 613: Application / User / Page Rate Limit reached -> RATE_LIMIT
 * - 36003, 36004: Invalid media format / aspect ratio / image resolution -> MEDIA_INVALID
 * - 368: Temporarily blocked for policies / spam -> CONTENT_REJECTED
 * - 1, 2: Temporary Meta API service outage -> PROVIDER_UNAVAILABLE
 * - 506: Duplicate post content -> DUPLICATE
 */
export function classifyMetaError(responseOrError: SocialTransportResponse | Error | any): SocialNormalizedError {
  // If it's a native Error (e.g., transport failure or network abort)
  if (responseOrError instanceof Error) {
    if (responseOrError.message.includes('PROVIDER_EXECUTION_DISABLED')) {
      return {
        errorClass: 'EXECUTION_DISABLED',
        message: responseOrError.message,
        retryable: false,
        suggestedAction: 'Enable Social provider execution mode before publishing.',
      };
    }

    if (
      responseOrError.message.includes('ECONNRESET') ||
      responseOrError.message.includes('ETIMEDOUT') ||
      responseOrError.message.includes('fetch failed') ||
      responseOrError.message.includes('timeout')
    ) {
      return {
        errorClass: 'TRANSIENT_NETWORK',
        message: responseOrError.message,
        retryable: true,
        suggestedAction: 'Check connectivity or retry after exponential backoff.',
      };
    }

    return {
      errorClass: 'UNKNOWN_PROVIDER_ERROR',
      message: responseOrError.message,
      retryable: false,
      rawError: { name: responseOrError.name, message: responseOrError.message },
    };
  }

  // If it's a SocialTransportResponse
  const resp = responseOrError as SocialTransportResponse;
  const body: MetaGraphErrorResponse = typeof resp.body === 'object' && resp.body !== null ? resp.body : {};
  const metaErr = body.error;

  if (!metaErr) {
    // If HTTP error code but body is not standard Meta error JSON
    if (resp.status === 401 || resp.status === 403) {
      return {
        errorClass: resp.status === 401 ? 'AUTHENTICATION' : 'AUTHORIZATION',
        message: `HTTP ${resp.status} ${resp.statusText || 'Unauthorized'}`,
        retryable: false,
        suggestedAction: 'Verify API credentials and token permissions.',
        rawError: { status: resp.status, body: resp.body },
      };
    }

    if (resp.status === 429) {
      return {
        errorClass: 'RATE_LIMIT',
        message: 'HTTP 429 Too Many Requests',
        retryable: true,
        suggestedAction: 'Wait for rate limit window to reset.',
        rawError: { status: resp.status, body: resp.body },
      };
    }

    if (resp.status >= 500) {
      return {
        errorClass: 'PROVIDER_UNAVAILABLE',
        message: `HTTP ${resp.status} Provider Server Error`,
        retryable: true,
        suggestedAction: 'Meta Graph API returned server error; retry later.',
        rawError: { status: resp.status, body: resp.body },
      };
    }

    return {
      errorClass: 'UNKNOWN_PROVIDER_ERROR',
      message: `Unknown HTTP response status: ${resp.status}`,
      retryable: false,
      rawError: { status: resp.status, body: resp.body },
    };
  }

  // Parse structured Meta error
  const code = metaErr.code;
  const subcode = metaErr.error_subcode;
  const message = metaErr.message || 'Meta Graph API error';

  let errorClass: SocialNormalizedErrorClass = 'UNKNOWN_PROVIDER_ERROR';
  let retryable = false;
  let suggestedAction = 'Inspect error details or consult Meta developer documentation.';

  // Authentication
  if (code === 190 || code === 102) {
    errorClass = 'AUTHENTICATION';
    retryable = false;
    suggestedAction = 'Token expired, revoked, or invalid. Refresh Page/User access token.';
  }
  // Authorization / Permissions
  else if (code === 10 || (code >= 200 && code <= 299)) {
    errorClass = 'AUTHORIZATION';
    retryable = false;
    suggestedAction = 'Ensure account has required permissions (pages_manage_posts, instagram_content_publish).';
  }
  // Rate Limits
  else if (code === 4 || code === 17 || code === 32 || code === 613) {
    errorClass = 'RATE_LIMIT';
    retryable = true;
    suggestedAction = 'Rate limit reached. Back off and wait before retrying.';
  }
  // Media format / dimensions / aspect ratio
  else if (code === 36003 || code === 36004 || code === 100 && message.toLowerCase().includes('aspect ratio')) {
    errorClass = 'MEDIA_INVALID';
    retryable = false;
    suggestedAction = 'Verify image aspect ratio (1:1, 4:5, 16:9), size (<8MB), and format (JPEG/PNG).';
  }
  // Spam / Policy
  else if (code === 368) {
    errorClass = 'CONTENT_REJECTED';
    retryable = false;
    suggestedAction = 'Content flagged by Meta policy checks.';
  }
  // Duplicate
  else if (code === 506) {
    errorClass = 'DUPLICATE';
    retryable = false;
    suggestedAction = 'Duplicate post detected. Content was already published recently.';
  }
  // Provider Unavailable
  else if (code === 1 || code === 2) {
    errorClass = 'PROVIDER_UNAVAILABLE';
    retryable = true;
    suggestedAction = 'Meta Graph API temporary internal error. Retry with backoff.';
  }

  return {
    errorClass,
    providerCode: code,
    providerSubcode: subcode ?? null,
    message,
    retryable,
    suggestedAction,
    rawError: {
      code,
      subcode,
      type: metaErr.type,
      fbtrace_id: metaErr.fbtrace_id,
    },
  };
}
