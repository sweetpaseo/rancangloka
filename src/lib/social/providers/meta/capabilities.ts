/**
 * RancangLoka — Meta Capability Matrices
 * Milestone: SOCIAL-S3
 *
 * Invariant:
 * UNVERIFIED / UNKNOWN capabilities FAIL CLOSED.
 * No imaginary or speculative feature support is declared.
 */

import type { SocialPlatformCapabilityMatrix } from '../types.ts';

/**
 * Facebook Page Capability Matrix
 * Verified model:
 * - Single image photo publish: SUPPORTED (via /{page-id}/photos with url and caption)
 * - Feed post (link / text): SUPPORTED (via /{page-id}/feed with message / link)
 * - Multi-photo / carousel: UNVERIFIED (Facebook multi-photo attachment requires attached_media list; marked UNVERIFIED for safety)
 * - Video / Reels: UNVERIFIED
 * - Threads: UNSUPPORTED
 */
export const FACEBOOK_PAGE_CAPABILITIES: SocialPlatformCapabilityMatrix = {
  platformId: 'facebook_page',
  providerId: 'meta',
  variantSupport: {
    FEED_POST: 'SUPPORTED',
    CAROUSEL: 'UNVERIFIED',
    REEL_SHORT: 'UNVERIFIED',
    THREAD: 'UNSUPPORTED',
  },
  supportedAspectRatios: ['1:1', '4:5', '16:9'],
  maxCaptionLength: 63206, // Facebook allows up to 63,206 chars, but practically we enforce editorial cleanliness
  maxHashtags: 30,
  supportsScheduling: false, // In SOCIAL-S3, our internal outbox scheduler handles scheduling; native Meta scheduling is not delegated
  requiresMediaForPost: false, // Text / link feed posts are possible on FB Page
  description: 'Meta Facebook Page publishing adapter (Photo & Feed endpoints)',
};

/**
 * Instagram Business Capability Matrix
 * Verified model:
 * - Single image feed post: SUPPORTED (via 2-stage /{ig-user-id}/media + /{ig-user-id}/media_publish)
 * - Carousel feed post: SUPPORTED (via 2-stage item containers + carousel container + media_publish)
 * - Reel: UNVERIFIED (requires video container workflow, marked UNVERIFIED until video pipeline tested)
 * - Threads: UNSUPPORTED
 */
export const INSTAGRAM_BUSINESS_CAPABILITIES: SocialPlatformCapabilityMatrix = {
  platformId: 'instagram_business',
  providerId: 'meta',
  variantSupport: {
    FEED_POST: 'SUPPORTED',
    CAROUSEL: 'SUPPORTED',
    REEL_SHORT: 'UNVERIFIED',
    THREAD: 'UNSUPPORTED',
  },
  supportedAspectRatios: ['1:1', '4:5', '16:9'], // Instagram feed requires 4:5 to 1.91:1 ratio
  maxCaptionLength: 2200,
  maxHashtags: 30,
  minCarouselItems: 2,
  maxCarouselItems: 10,
  supportsScheduling: false, // Handled internally
  requiresMediaForPost: true, // Instagram feed STRICTLY requires an image / media item
  description: 'Meta Instagram Business Publishing API (Container & Carousel 2-stage workflow)',
};
