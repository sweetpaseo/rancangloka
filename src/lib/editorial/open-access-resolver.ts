/**
 * Open-Access Scholarly Resolver
 * Milestone: RESEARCH-DISCOVERY-CAPABILITY-1
 *
 * Provides a bounded, legitimate resolution mechanism for scholarly literature
 * when canonical publisher URLs are paywalled.
 *
 * Invariants:
 * - Strictly forbids paywall circumvention or pirate mirror lookups.
 * - Resolves only legitimate open-access repositories (institutional repositories,
 *   author manuscripts, PMC/EuropePMC, arXiv, unpaywall-indexed green/gold OA).
 * - Enforces strict network SSRF safety on all resolved OA URLs.
 */

import { validateSafeUrl } from './discovery-network-safety.ts';
import { normalizeDoi } from './discovery-providers.ts';
import type { DiscoveryOptions } from './source-discovery.ts';

export interface OpenAccessResolutionResult {
  original_doi: string;
  canonical_publisher_url: string;
  oa_resolution_attempted: boolean;
  oa_provider?: 'OPENALEX' | 'UNPAYWALL' | 'MOCK_OA_RESOLVER';
  oa_url?: string;
  oa_status: 'OA_AVAILABLE' | 'NO_OA_FOUND' | 'OA_BLOCKED_UNSAFE_URL' | 'NOT_ATTEMPTED' | 'OA_PROVIDER_ERROR';
  oa_repository_type?: string;
  license?: string;
}

export type CustomOaResolverFn = (
  doi: string
) => Promise<{ oa_url?: string; repository_type?: string; license?: string } | null>;

export interface OaResolverOptions extends DiscoveryOptions {
  customOaResolverFn?: CustomOaResolverFn;
}

/**
 * Resolves an alternate legitimate open-access copy for a scholarly DOI.
 */
export async function resolveOpenAccessCandidate(
  doi: string,
  canonicalPublisherUrl: string,
  options: OaResolverOptions = {}
): Promise<OpenAccessResolutionResult> {
  const cleanDoi = normalizeDoi(doi);
  if (!cleanDoi) {
    return {
      original_doi: doi || '',
      canonical_publisher_url: canonicalPublisherUrl,
      oa_resolution_attempted: false,
      oa_status: 'NOT_ATTEMPTED'
    };
  }

  // 1. Custom mock / test resolver
  if (options.customOaResolverFn) {
    try {
      const res = await options.customOaResolverFn(cleanDoi);
      if (!res || !res.oa_url) {
        return {
          original_doi: cleanDoi,
          canonical_publisher_url: canonicalPublisherUrl,
          oa_resolution_attempted: true,
          oa_provider: 'MOCK_OA_RESOLVER',
          oa_status: 'NO_OA_FOUND'
        };
      }

      // Critical SSRF check on resolved OA URL
      const safety = validateSafeUrl(res.oa_url);
      if (!safety.isSafe) {
        return {
          original_doi: cleanDoi,
          canonical_publisher_url: canonicalPublisherUrl,
          oa_resolution_attempted: true,
          oa_provider: 'MOCK_OA_RESOLVER',
          oa_url: res.oa_url,
          oa_status: 'OA_BLOCKED_UNSAFE_URL'
        };
      }

      return {
        original_doi: cleanDoi,
        canonical_publisher_url: canonicalPublisherUrl,
        oa_resolution_attempted: true,
        oa_provider: 'MOCK_OA_RESOLVER',
        oa_url: safety.normalizedUrl || res.oa_url,
        oa_status: 'OA_AVAILABLE',
        oa_repository_type: res.repository_type || 'INSTITUTIONAL_REPOSITORY',
        license: res.license
      };
    } catch {
      return {
        original_doi: cleanDoi,
        canonical_publisher_url: canonicalPublisherUrl,
        oa_resolution_attempted: true,
        oa_provider: 'MOCK_OA_RESOLVER',
        oa_status: 'OA_PROVIDER_ERROR'
      };
    }
  }

  // 2. OpenAlex API resolution (Default open access directory)
  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || 8000;
  const openAlexUrl = `https://api.openalex.org/works/doi:${encodeURIComponent(cleanDoi)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetchFn(openAlexUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RancangLoka-Research-Runtime/1.0 (mailto:redaksi@rancangloka.com)'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        original_doi: cleanDoi,
        canonical_publisher_url: canonicalPublisherUrl,
        oa_resolution_attempted: true,
        oa_provider: 'OPENALEX',
        oa_status: 'NO_OA_FOUND'
      };
    }

    const data: any = await res.json();
    const openAccess = data?.open_access;
    const bestLocation = data?.best_oa_location;

    if (!openAccess?.is_oa || !bestLocation?.landing_page_url) {
      return {
        original_doi: cleanDoi,
        canonical_publisher_url: canonicalPublisherUrl,
        oa_resolution_attempted: true,
        oa_provider: 'OPENALEX',
        oa_status: 'NO_OA_FOUND'
      };
    }

    const candidateOaUrl = bestLocation.landing_page_url || bestLocation.pdf_url;
    const safety = validateSafeUrl(candidateOaUrl);
    if (!safety.isSafe) {
      return {
        original_doi: cleanDoi,
        canonical_publisher_url: canonicalPublisherUrl,
        oa_resolution_attempted: true,
        oa_provider: 'OPENALEX',
        oa_url: candidateOaUrl,
        oa_status: 'OA_BLOCKED_UNSAFE_URL'
      };
    }

    return {
      original_doi: cleanDoi,
      canonical_publisher_url: canonicalPublisherUrl,
      oa_resolution_attempted: true,
      oa_provider: 'OPENALEX',
      oa_url: safety.normalizedUrl || candidateOaUrl,
      oa_status: 'OA_AVAILABLE',
      oa_repository_type: bestLocation.version || 'ACCEPTED_MANUSCRIPT',
      license: bestLocation.license || undefined
    };
  } catch {
    return {
      original_doi: cleanDoi,
      canonical_publisher_url: canonicalPublisherUrl,
      oa_resolution_attempted: true,
      oa_provider: 'OPENALEX',
      oa_status: 'OA_PROVIDER_ERROR'
    };
  }
}
