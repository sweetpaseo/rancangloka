/**
 * RancangLoka — Meta Graph API Request Builder
 * Milestone: SOCIAL-S3
 *
 * Deterministic builder for Meta Graph API requests:
 * 1. Facebook Page: Photos (single image) vs Feed (text / link)
 * 2. Instagram Business: 2-stage container workflow:
 *    - Single item: /{ig-user-id}/media (image_url, caption) -> /{ig-user-id}/media_publish (creation_id)
 *    - Carousel: 2..10 items with is_carousel_item=true -> container with media_type=CAROUSEL -> media_publish
 *
 * Invariants:
 * - Version configurable (never hardcoded)
 * - Zero real network calls
 * - Zero raw secrets embedded
 */

import type { SocialBuiltRequest, SocialPublishRequestInput, SocialTransportRequest } from '../types.ts';
import { DEFAULT_META_GRAPH_API_VERSION, type MetaProviderConfig } from './types.ts';

const GRAPH_BASE_URL = 'https://graph.facebook.com';

/**
 * Build Facebook Page Publish Request (Deterministic)
 */
export function buildFacebookPageRequest(
  input: SocialPublishRequestInput,
  config: MetaProviderConfig
): SocialBuiltRequest {
  const version = config.graphApiVersion || DEFAULT_META_GRAPH_API_VERSION;
  const pageId = config.facebookPageId || 'DUMMY_PAGE_ID';
  const operationId = input.operationId || `fb_op_${input.variant.id}`;
  const mediaUrls = input.approvedPayload.mediaUrls || [];

  const stages: Array<{ stageName: string; transportRequest: SocialTransportRequest }> = [];

  if (mediaUrls.length > 0) {
    // Single photo publishing endpoint: POST /{page-id}/photos
    // In Meta Graph API: url: mediaUrl, caption: caption
    const transportRequest: SocialTransportRequest = {
      method: 'POST',
      url: `${GRAPH_BASE_URL}/${version}/${pageId}/photos`,
      headers: {
        'content-type': 'application/json',
      },
      bodyParams: {
        url: mediaUrls[0],
        caption: input.approvedPayload.caption,
      },
    };

    stages.push({
      stageName: 'facebook_photo_publish',
      transportRequest,
    });
  } else {
    // Feed post endpoint: POST /{page-id}/feed
    // message: caption, link: canonicalUrl (if provided)
    const bodyParams: Record<string, any> = {
      message: input.approvedPayload.caption,
    };
    if (input.approvedPayload.canonicalUrl) {
      bodyParams.link = input.approvedPayload.canonicalUrl;
    }

    const transportRequest: SocialTransportRequest = {
      method: 'POST',
      url: `${GRAPH_BASE_URL}/${version}/${pageId}/feed`,
      headers: {
        'content-type': 'application/json',
      },
      bodyParams,
    };

    stages.push({
      stageName: 'facebook_feed_publish',
      transportRequest,
    });
  }

  return {
    providerId: 'meta',
    platformId: 'facebook_page',
    operationId,
    stages,
    metadata: {
      graphApiVersion: version,
      pageId,
      mediaCount: mediaUrls.length,
      hasLink: Boolean(input.approvedPayload.canonicalUrl),
      variantId: input.variant.id,
    },
  };
}

/**
 * Build Instagram Business Publish Request (Deterministic Multi-Stage)
 */
export function buildInstagramBusinessRequest(
  input: SocialPublishRequestInput,
  config: MetaProviderConfig
): SocialBuiltRequest {
  const version = config.graphApiVersion || DEFAULT_META_GRAPH_API_VERSION;
  const igAccountId = config.instagramAccountId || 'DUMMY_IG_ACCOUNT_ID';
  const operationId = input.operationId || `ig_op_${input.variant.id}`;
  const mediaUrls = input.approvedPayload.mediaUrls || [];

  const stages: Array<{ stageName: string; transportRequest: SocialTransportRequest }> = [];

  if (input.variant.variant_type === 'CAROUSEL' && mediaUrls.length >= 2) {
    // Instagram Carousel:
    // Step 1..N: Create item container for each media url (is_carousel_item=true)
    for (let i = 0; i < mediaUrls.length; i++) {
      stages.push({
        stageName: `instagram_carousel_item_${i + 1}`,
        transportRequest: {
          method: 'POST',
          url: `${GRAPH_BASE_URL}/${version}/${igAccountId}/media`,
          headers: { 'content-type': 'application/json' },
          bodyParams: {
            image_url: mediaUrls[i],
            is_carousel_item: true,
          },
        },
      });
    }

    // Step N+1: Create carousel container referencing item container IDs
    stages.push({
      stageName: 'instagram_carousel_container',
      transportRequest: {
        method: 'POST',
        url: `${GRAPH_BASE_URL}/${version}/${igAccountId}/media`,
        headers: { 'content-type': 'application/json' },
        bodyParams: {
          media_type: 'CAROUSEL',
          caption: input.approvedPayload.caption,
          children: [], // Populated at runtime from item container stage results
        },
      },
    });

    // Step N+2: Publish the carousel container: POST /{ig-account-id}/media_publish
    stages.push({
      stageName: 'instagram_media_publish',
      transportRequest: {
        method: 'POST',
        url: `${GRAPH_BASE_URL}/${version}/${igAccountId}/media_publish`,
        headers: { 'content-type': 'application/json' },
        bodyParams: {
          creation_id: '', // Populated at runtime from container result
        },
      },
    });
  } else {
    // Single Media Feed Post:
    // Step 1: Create media container: POST /{ig-account-id}/media
    stages.push({
      stageName: 'instagram_media_container',
      transportRequest: {
        method: 'POST',
        url: `${GRAPH_BASE_URL}/${version}/${igAccountId}/media`,
        headers: { 'content-type': 'application/json' },
        bodyParams: {
          image_url: mediaUrls[0] || '',
          caption: input.approvedPayload.caption,
        },
      },
    });

    // Step 2: Publish media container: POST /{ig-account-id}/media_publish
    stages.push({
      stageName: 'instagram_media_publish',
      transportRequest: {
        method: 'POST',
        url: `${GRAPH_BASE_URL}/${version}/${igAccountId}/media_publish`,
        headers: { 'content-type': 'application/json' },
        bodyParams: {
          creation_id: '', // Populated at runtime from stage 1
        },
      },
    });
  }

  return {
    providerId: 'meta',
    platformId: 'instagram_business',
    operationId,
    stages,
    metadata: {
      graphApiVersion: version,
      instagramAccountId: igAccountId,
      mediaCount: mediaUrls.length,
      isCarousel: input.variant.variant_type === 'CAROUSEL',
      variantId: input.variant.id,
    },
  };
}
