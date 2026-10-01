/**
 * RancangLoka — Social Platform Provider Registry
 * Milestone: SOCIAL-S3
 *
 * Central registry resolving neutral SocialPlatformAdapter implementations.
 * Decouples caller (Social Domain / Mission Control) from concrete provider code.
 */

import type { SocialPlatformAdapter, SocialPlatformId } from './types.ts';
import { MetaFacebookPageAdapter } from './meta/facebook-page.ts';
import { MetaInstagramBusinessAdapter } from './meta/instagram-business.ts';

// Internal map of instantiated adapters
const adapterRegistry = new Map<SocialPlatformId, SocialPlatformAdapter>();

// Register canonical default adapters
const defaultFacebookAdapter = new MetaFacebookPageAdapter();
const defaultInstagramAdapter = new MetaInstagramBusinessAdapter();

adapterRegistry.set('facebook_page', defaultFacebookAdapter);
adapterRegistry.set('instagram_business', defaultInstagramAdapter);

/**
 * Resolve platform adapter for a given target platform
 */
export function getPlatformAdapter(platformId: SocialPlatformId): SocialPlatformAdapter | undefined {
  return adapterRegistry.get(platformId);
}

/**
 * Register a custom or configured adapter instance (e.g. for testing or tenant config)
 */
export function registerPlatformAdapter(platformId: SocialPlatformId, adapter: SocialPlatformAdapter): void {
  adapterRegistry.set(platformId, adapter);
}

/**
 * List all registered platform adapters
 */
export function getAllRegisteredAdapters(): SocialPlatformAdapter[] {
  return Array.from(adapterRegistry.values());
}

/**
 * List supported platform IDs
 */
export function getSupportedPlatformIds(): SocialPlatformId[] {
  return Array.from(adapterRegistry.keys());
}
