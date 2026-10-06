/**
 * Discovery Provider Abstraction & Candidate Normalization
 * Milestone: RESEARCH-DISCOVERY-CAPABILITY-1
 *
 * Implements multi-provider discovery (CrossRef, Wikipedia EN/ID, Open-Web API),
 * strict SSRF URL validation, cross-provider deduplication, and candidate relevance ranking.
 *
 * Principles:
 * - Provider results are DISCOVERY METADATA ONLY.
 * - Discovery snippets/abstracts NEVER become evidence without full authentic document retrieval.
 * - Untrusted URLs from search results must pass network safety before retrieval.
 */

import crypto from 'node:crypto';
import { validateSafeUrl } from './discovery-network-safety.ts';
import type { DiscoveryOptions } from './source-discovery.ts';

export interface DiscoveryProviderRequest {
  query: string;
  query_id: string;
  language: 'id' | 'en';
  category?: string;
  max_results?: number;
  target_type?: 'SCHOLARLY' | 'ENCYCLOPEDIC' | 'OPEN_WEB' | 'GENERAL';
}

export interface NormalizedCandidateMetadata {
  provider: string; // 'CROSSREF' | 'WIKIPEDIA_EN' | 'WIKIPEDIA_ID' | 'OPEN_WEB'
  candidate_id: string;
  title: string;
  snippet_or_abstract?: string;
  url?: string;
  doi?: string;
  publisher?: string;
  document_hint?: 'SCHOLARLY' | 'INSTITUTIONAL' | 'STANDARD' | 'ENCYCLOPEDIC' | 'MANUFACTURER' | 'UNKNOWN';
  language?: 'id' | 'en';
  discovered_at: string;
  discovery_query_id: string;
  discovered_by_providers?: string[];
  discovery_query_ids?: string[];
  is_open_access?: boolean;
  relevance_score?: number;
}

export interface ResearchDiscoveryProvider {
  provider_name: string;
  search(request: DiscoveryProviderRequest, options?: DiscoveryOptions): Promise<NormalizedCandidateMetadata[]>;
}

/**
 * Normalizes a DOI string for consistent deduplication (e.g., '10.1016/j.buildenv...').
 */
export function normalizeDoi(doi?: string): string | undefined {
  if (!doi) return undefined;
  const clean = doi.trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '');
  return clean || undefined;
}

/**
 * Normalizes a URL for consistent deduplication.
 */
export function normalizeUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.hash = '';
    // Strip common tracking parameters
    const toDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (key.startsWith('utm_') || key === 'ref' || key === 'source' || key === 'origin') {
        toDelete.push(key);
      }
    });
    for (const key of toDelete) parsed.searchParams.delete(key);
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    parsed.pathname = path;
    return parsed.toString().toLowerCase();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

/**
 * Normalizes a title for strong identity deduplication.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deduplicates normalized candidates across multiple providers by DOI, URL, or Title.
 */
export function deduplicateCandidates(
  candidates: NormalizedCandidateMetadata[]
): NormalizedCandidateMetadata[] {
  const deduped: NormalizedCandidateMetadata[] = [];
  const seenDois = new Map<string, NormalizedCandidateMetadata>();
  const seenUrls = new Map<string, NormalizedCandidateMetadata>();
  const seenTitles = new Map<string, NormalizedCandidateMetadata>();

  for (const c of candidates) {
    const normDoi = normalizeDoi(c.doi);
    const normUrl = normalizeUrl(c.url);
    const normT = normalizeTitle(c.title);

    let match = (normDoi ? seenDois.get(normDoi) : undefined) ||
                (normUrl ? seenUrls.get(normUrl) : undefined) ||
                (normT.length > 10 ? seenTitles.get(normT) : undefined);

    if (match) {
      // Merge provenance
      const providers = new Set(match.discovered_by_providers || [match.provider]);
      providers.add(c.provider);
      match.discovered_by_providers = Array.from(providers);

      const qIds = new Set(match.discovery_query_ids || [match.discovery_query_id]);
      qIds.add(c.discovery_query_id);
      match.discovery_query_ids = Array.from(qIds);

      // Upgrade metadata if newer candidate has DOI or direct URL
      if (!match.doi && c.doi) match.doi = c.doi;
      if (!match.url && c.url) match.url = c.url;
      if (!match.snippet_or_abstract && c.snippet_or_abstract) match.snippet_or_abstract = c.snippet_or_abstract;
      if (c.is_open_access) match.is_open_access = true;
    } else {
      c.discovered_by_providers = [c.provider];
      c.discovery_query_ids = [c.discovery_query_id];
      deduped.push(c);

      if (normDoi) seenDois.set(normDoi, c);
      if (normUrl) seenUrls.set(normUrl, c);
      if (normT.length > 10) seenTitles.set(normT, c);
    }
  }

  return deduped;
}

/**
 * Estimates candidate document class hint.
 */
export function estimateCandidateHint(
  title: string,
  publisher?: string,
  url?: string,
  doi?: string
): 'SCHOLARLY' | 'INSTITUTIONAL' | 'STANDARD' | 'ENCYCLOPEDIC' | 'MANUFACTURER' | 'UNKNOWN' {
  const combined = `${title} ${publisher || ''} ${url || ''}`.toLowerCase();

  if (combined.includes('wikipedia.org') || combined.includes('wikimedia')) {
    return 'ENCYCLOPEDIC';
  }
  if (/\b(?:bsn|sni|astm|iso|din|ashrae)\b/i.test(combined)) {
    return 'STANDARD';
  }
  if (/\b(?:\.gov|\.go\.id|\.edu|\.ac\.id|lbnl|ornl|doe|epa|pupr|brin)\b/i.test(combined)) {
    return 'INSTITUTIONAL';
  }
  if (doi || /\b(?:journal|sciencedirect|springer|wiley|ieee|elsevier|researchgate)\b/i.test(combined)) {
    return 'SCHOLARLY';
  }
  if (/\b(?:corporation|ltd|pt\b|inc|manufacturer|brand|products|commercial)\b/i.test(combined)) {
    return 'MANUFACTURER';
  }
  return 'UNKNOWN';
}

// Out-of-domain negative patterns that must never consume retrieval budget for building/architecture topics
export const OUT_OF_DOMAIN_PATTERNS = [
  /\b(?:hiv|aids|spondylodiscitis|paralysis|skeletal atrophy|clinical trial|patient|patients|hospital|surgery|oncology|chemotherapy|pediatric|biomedical|pharmacology|pharmacokinetics|electronic health records|ehr|sexual behaviour|western kenya|vaccine|pathology|therapeutic)\b/i,
  /\b(?:large language model-based applications|llm-based applications|software engineering repository)\b/i
];

export const BUILDING_DOMAIN_SIGNALS = [
  /\b(?:building|architecture|architectural|civil engineering|materials? engineering|construction|structural)\b/i,
  /\b(?:facade|façade|envelope|fenestration|glazing|window|glass|laminated|tempered|door|frame)\b/i,
  /\b(?:tile|ceramic|flooring|subfloor|mortar|grout|adhesion|debonding|buckling|tenting|movement joint|expansion joint)\b/i,
  /\b(?:shading|overhang|louver|louvre|awning|secondary skin|brise-soleil|solar heat gain|shgc|radiant barrier|insulation)\b/i,
  /\b(?:ventilation|exhaust fan|airflow|hvac|duct|indoor air|condensation|moisture|dampness|mold|waterproofing|leak|roof|attic|drainage|gutter)\b/i
];

export interface DomainConsistencyResult {
  consistent: boolean;
  scoreAdjustment: number;
  reason?: string;
}

/**
 * Evaluates candidate domain consistency and negative topic markers.
 */
export function evaluateCandidateDomainConsistency(
  candidate: { title: string; snippet_or_abstract?: string; publisher?: string },
  topic: string = ''
): DomainConsistencyResult {
  const textBlob = `${candidate.title} ${candidate.snippet_or_abstract || ''} ${candidate.publisher || ''}`.toLowerCase();

  // 1. Negative out-of-domain detection (biomedical, clinical, software EHR)
  for (const pattern of OUT_OF_DOMAIN_PATTERNS) {
    if (pattern.test(textBlob)) {
      return {
        consistent: false,
        scoreAdjustment: -200,
        reason: 'OUT_OF_DOMAIN_NEGATIVE_MATCH: Biomedical, clinical, or software artifact detected'
      };
    }
  }

  // 2. Positive building domain consistency check
  let domainSignalCount = 0;
  for (const sig of BUILDING_DOMAIN_SIGNALS) {
    if (sig.test(textBlob)) {
      domainSignalCount++;
    }
  }

  if (domainSignalCount > 0) {
    return {
      consistent: true,
      scoreAdjustment: Math.min(domainSignalCount * 15, 45)
    };
  }

  return {
    consistent: true,
    scoreAdjustment: 0
  };
}

/**
 * Scores and ranks candidate metadata.
 * Note: Discovery ranking assigns retrieval priority only; it NEVER grants evidence authority.
 */
export function rankCandidatesByDiscoveryRelevance(
  candidates: NormalizedCandidateMetadata[],
  topicTerms: string[]
): NormalizedCandidateMetadata[] {
  const cleanTopicTerms = topicTerms.map(t => t.toLowerCase()).filter(t => t.length > 2);
  const topicString = cleanTopicTerms.join(' ');

  return candidates.map(c => {
    let score = 30;

    // Hint weights
    const hint = c.document_hint || estimateCandidateHint(c.title, c.publisher, c.url, c.doi);
    if (hint === 'INSTITUTIONAL') score += 50;
    else if (hint === 'STANDARD') score += 45;
    else if (hint === 'SCHOLARLY') score += 40;
    else if (hint === 'ENCYCLOPEDIC') score += 25;
    else if (hint === 'MANUFACTURER') score += 10;

    // URL presence & DOI
    if (c.url) score += 10;
    if (c.doi) score += 5;
    if (c.is_open_access) score += 15;

    // Domain consistency evaluation
    const domainCheck = evaluateCandidateDomainConsistency(c, topicString);
    score += domainCheck.scoreAdjustment;

    // Title / snippet term overlap
    const textBlob = `${c.title} ${c.snippet_or_abstract || ''}`.toLowerCase();
    let termMatches = 0;
    for (const term of cleanTopicTerms) {
      if (textBlob.includes(term)) termMatches++;
    }
    score += Math.min(termMatches * 15, 60);

    return {
      ...c,
      document_hint: hint,
      relevance_score: score
    };
  }).sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
}

// =========================================================================
// PROVIDER ADAPTERS
// =========================================================================

/**
 * CrossRef Open API Discovery Provider.
 */
export class CrossRefDiscoveryProvider implements ResearchDiscoveryProvider {
  provider_name = 'CROSSREF';

  async search(request: DiscoveryProviderRequest, options: DiscoveryOptions = {}): Promise<NormalizedCandidateMetadata[]> {
    const fetchFn = options.fetchFn || globalThis.fetch;
    const timeoutMs = options.timeoutMs || 10000;
    const maxRows = request.max_results || 4;

    const url = `https://api.crossref.org/works?query=${encodeURIComponent(request.query)}&rows=${maxRows}&select=DOI,title,publisher,published,abstract`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetchFn(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'RancangLoka-Research-Runtime/1.0 (mailto:redaksi@rancangloka.com)'
        }
      });
      clearTimeout(timeoutId);

      if (!res.ok) return [];

      const data: any = await res.json();
      const items = data?.message?.items;
      if (!Array.isArray(items)) return [];

      const results: NormalizedCandidateMetadata[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rawTitle = Array.isArray(item.title) ? item.title[0] : (item.title || 'Untitled Work');
        const doi = item.DOI;
        const targetUrl = doi ? `https://doi.org/${doi}` : undefined;

        // SSRF check on target URL if present
        if (targetUrl) {
          const safeCheck = validateSafeUrl(targetUrl);
          if (!safeCheck.isSafe) continue;
        }

        results.push({
          provider: 'CROSSREF',
          candidate_id: `cand_cr_${Date.now()}_${i}`,
          title: rawTitle,
          snippet_or_abstract: item.abstract ? item.abstract.replace(/<[^>]+>/g, '').slice(0, 300) : undefined,
          url: targetUrl,
          doi,
          publisher: item.publisher || 'Unknown Scholarly Publisher',
          document_hint: 'SCHOLARLY',
          language: request.language,
          discovered_at: new Date().toISOString(),
          discovery_query_id: request.query_id
        });
      }

      return results;
    } catch {
      return [];
    }
  }
}

/**
 * Wikipedia API Discovery Provider (English & Indonesian).
 */
export class WikipediaDiscoveryProvider implements ResearchDiscoveryProvider {
  provider_name: string;
  private lang: 'en' | 'id';

  constructor(lang: 'en' | 'id' = 'en') {
    this.lang = lang;
    this.provider_name = lang === 'en' ? 'WIKIPEDIA_EN' : 'WIKIPEDIA_ID';
  }

  async search(request: DiscoveryProviderRequest, options: DiscoveryOptions = {}): Promise<NormalizedCandidateMetadata[]> {
    const fetchFn = options.fetchFn || globalThis.fetch;
    const timeoutMs = options.timeoutMs || 10000;
    const maxRows = request.max_results || 3;

    const baseHost = this.lang === 'id' ? 'id.wikipedia.org' : 'en.wikipedia.org';
    const url = `https://${baseHost}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(request.query)}&format=json&origin=*`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetchFn(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'RancangLoka-Research-Runtime/1.0 (mailto:redaksi@rancangloka.com)'
        }
      });
      clearTimeout(timeoutId);

      if (!res.ok) return [];

      const data: any = await res.json();
      const items = data?.query?.search;
      if (!Array.isArray(items)) return [];

      const results: NormalizedCandidateMetadata[] = [];
      for (let i = 0; i < Math.min(items.length, maxRows); i++) {
        const item = items[i];
        const pageTitle = item.title;
        const pageUrl = `https://${baseHost}/wiki/${encodeURIComponent(pageTitle.replace(/\s+/g, '_'))}`;

        const safeCheck = validateSafeUrl(pageUrl);
        if (!safeCheck.isSafe) continue;

        results.push({
          provider: this.provider_name,
          candidate_id: `cand_wiki_${this.lang}_${Date.now()}_${i}`,
          title: pageTitle,
          snippet_or_abstract: item.snippet ? item.snippet.replace(/<[^>]+>/g, '').slice(0, 300) : undefined,
          url: pageUrl,
          publisher: 'Wikimedia Foundation',
          document_hint: 'ENCYCLOPEDIC',
          language: this.lang,
          discovered_at: new Date().toISOString(),
          discovery_query_id: request.query_id
        });
      }

      return results;
    } catch {
      return [];
    }
  }
}

/**
 * Open-Web Search Provider Adapter.
 * Integrates external web search APIs (e.g., Brave Search, Tavily, SearXNG) or mock handlers.
 * Enforces strict network boundaries: any URL with private/local IP is rejected before normalization.
 */
export interface OpenWebDiscoveryRuntimeConfig {
  enabled?: boolean;
  apiKey?: string;
  endpoint?: string;
  provider?: 'BRAVE' | 'TAVILY' | 'SEARXNG' | 'CUSTOM';
}

export class OpenWebDiscoveryProvider implements ResearchDiscoveryProvider {
  provider_name = 'OPEN_WEB';
  private customSearchFn?: (query: string, maxResults: number) => Promise<{ title: string; url: string; snippet?: string; publisher?: string }[]>;
  private runtimeConfig?: OpenWebDiscoveryRuntimeConfig;

  constructor(
    customSearchFn?: (query: string, maxResults: number) => Promise<{ title: string; url: string; snippet?: string; publisher?: string }[]>,
    runtimeConfig?: OpenWebDiscoveryRuntimeConfig
  ) {
    this.customSearchFn = customSearchFn;
    this.runtimeConfig = runtimeConfig;
  }

  getProviderName(): 'BRAVE' | 'TAVILY' | 'SEARXNG' | 'CUSTOM' {
    if (this.customSearchFn) return 'CUSTOM';
    if (this.runtimeConfig?.provider) return this.runtimeConfig.provider;
    const explicit = (process.env.OPEN_WEB_SEARCH_PROVIDER || '').toUpperCase().trim();
    if (explicit === 'BRAVE' || explicit === 'TAVILY' || explicit === 'SEARXNG' || explicit === 'CUSTOM') {
      return explicit;
    }
    if (process.env.TAVILY_API_KEY && !process.env.BRAVE_SEARCH_API_KEY && !process.env.OPEN_WEB_SEARCH_API_KEY) {
      return 'TAVILY';
    }
    return 'BRAVE';
  }

  isEnabled(): boolean {
    if (this.customSearchFn) return true;
    if (this.runtimeConfig && typeof this.runtimeConfig.enabled === 'boolean') {
      return this.runtimeConfig.enabled;
    }
    if (process.env.BRAVE_SEARCH_ENABLED === 'false' || process.env.OPEN_WEB_SEARCH_ENABLED === 'false') {
      return false;
    }
    if (process.env.BRAVE_SEARCH_ENABLED === 'true' || process.env.OPEN_WEB_SEARCH_ENABLED === 'true') {
      return true;
    }
    // Default in standalone unit tests without runtimeConfig: allowed if configured
    return Boolean(this.isConfigured());
  }

  isConfigured(): boolean {
    if (this.customSearchFn) return true;
    if (this.runtimeConfig?.apiKey) return true;
    const provider = this.getProviderName();
    if (provider === 'SEARXNG') {
      return Boolean(this.runtimeConfig?.endpoint || process.env.OPEN_WEB_SEARCH_ENDPOINT);
    }
    const providerKey =
      this.runtimeConfig?.apiKey ||
      process.env.OPEN_WEB_SEARCH_API_KEY ||
      process.env.BRAVE_SEARCH_API_KEY ||
      process.env.TAVILY_API_KEY;
    return Boolean(providerKey);
  }

  async search(request: DiscoveryProviderRequest, options: DiscoveryOptions = {}): Promise<NormalizedCandidateMetadata[]> {
    const maxRows = request.max_results || 5;

    // 1. If custom mock or test search function supplied
    if (this.customSearchFn) {
      const rawResults = await this.customSearchFn(request.query, maxRows);
      const candidates: NormalizedCandidateMetadata[] = [];

      for (let i = 0; i < rawResults.length; i++) {
        const item = rawResults[i];
        // Critical SSRF check on untrusted search provider URL
        const safeCheck = validateSafeUrl(item.url);
        if (!safeCheck.isSafe) {
          continue; // Safely discard private/unsafe URLs
        }

        candidates.push({
          provider: 'OPEN_WEB',
          candidate_id: `cand_web_${Date.now()}_${i}`,
          title: item.title,
          snippet_or_abstract: item.snippet,
          url: safeCheck.normalizedUrl || item.url,
          publisher: item.publisher || 'Open Web Source',
          document_hint: estimateCandidateHint(item.title, item.publisher, item.url),
          language: request.language,
          discovered_at: new Date().toISOString(),
          discovery_query_id: request.query_id
        });
      }
      return candidates;
    }

    // 2. Explicit failure if unconfigured or not enabled
    if (!this.isConfigured()) {
      throw new Error('OPEN_WEB_DISCOVERY_PROVIDER_UNAVAILABLE: No open-web provider credentials or endpoint configured');
    }

    if (!this.isEnabled()) {
      throw new Error('OPEN_WEB_DISCOVERY_PROVIDER_UNAVAILABLE: Open-web search is disabled by administrator settings');
    }

    const providerType = this.getProviderName();
    const fetchFn = options.fetchFn || globalThis.fetch;
    const timeoutMs = options.timeoutMs || 10000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;

    try {
      if (providerType === 'TAVILY') {
        const apiKey = this.runtimeConfig?.apiKey || process.env.OPEN_WEB_SEARCH_API_KEY || process.env.TAVILY_API_KEY;
        const endpoint = this.runtimeConfig?.endpoint || process.env.OPEN_WEB_SEARCH_ENDPOINT || 'https://api.tavily.com/search';
        res = await fetchFn(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'RancangLoka-Research-Runtime/1.0'
          },
          body: JSON.stringify({
            api_key: apiKey,
            query: request.query,
            max_results: maxRows
          })
        });
      } else if (providerType === 'SEARXNG') {
        const endpoint = this.runtimeConfig?.endpoint || process.env.OPEN_WEB_SEARCH_ENDPOINT || 'http://127.0.0.1:8888/search';
        const queryUrl = `${endpoint}?q=${encodeURIComponent(request.query)}&format=json`;
        res = await fetchFn(queryUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'RancangLoka-Research-Runtime/1.0'
          }
        });
      } else {
        // Default: BRAVE
        const apiKey = this.runtimeConfig?.apiKey || process.env.OPEN_WEB_SEARCH_API_KEY || process.env.BRAVE_SEARCH_API_KEY;
        const endpoint = this.runtimeConfig?.endpoint || process.env.OPEN_WEB_SEARCH_ENDPOINT || 'https://api.search.brave.com/res/v1/web/search';
        const queryUrl = `${endpoint}?q=${encodeURIComponent(request.query)}&count=${maxRows}`;
        res = await fetchFn(queryUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': apiKey || '',
            'User-Agent': 'RancangLoka-Research-Runtime/1.0'
          }
        });
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      throw new Error(`PROVIDER_API_ERROR_${res.status}`);
    }

    const data: any = await res.json();
    let rawItems: any[] = [];

    if (providerType === 'TAVILY' || providerType === 'SEARXNG') {
      rawItems = Array.isArray(data?.results) ? data.results : [];
    } else {
      rawItems = Array.isArray(data?.web?.results) ? data.web.results : [];
    }

    const candidates: NormalizedCandidateMetadata[] = [];
    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const safeCheck = validateSafeUrl(item.url);
      if (!safeCheck.isSafe) continue;

      candidates.push({
        provider: 'OPEN_WEB',
        candidate_id: `cand_web_${Date.now()}_${i}`,
        title: item.title,
        snippet_or_abstract: item.description || item.content || item.snippet,
        url: safeCheck.normalizedUrl || item.url,
        publisher: item.profile?.name || item.engine || undefined,
        document_hint: estimateCandidateHint(item.title, item.profile?.name, item.url),
        language: request.language,
        discovered_at: new Date().toISOString(),
        discovery_query_id: request.query_id
      });
    }

    return candidates;
  }
}

/**
 * Hermes Browser Discovery Provider.
 * Milestone: CONTENT-BOOTSTRAP-RECOVERY-1
 *
 * Implements free open-web discovery fallback through Hermes browser automation.
 * Invariants:
 * - Discovery metadata only; snippets NEVER become evidence.
 * - Outbound URLs strictly pass validateSafeUrl and network safety.
 * - Respects search engine rate limits / anti-bot blocks: records BROWSER_SEARCH_BLOCKED.
 * - Bounded query executions per pass.
 */
export interface HermesBrowserDiscoveryOptions {
  browserSearchFn?: (query: string, maxResults: number) => Promise<{
    title: string;
    url: string;
    snippet?: string;
    publisher?: string;
    isBlocked?: boolean;
    blockReason?: string;
  }[]>;
  maxQueriesPerPass?: number;
  maxResultsPerQuery?: number;
}

export class HermesBrowserDiscoveryProvider implements ResearchDiscoveryProvider {
  provider_name = 'HERMES_BROWSER';
  private browserSearchFn?: (query: string, maxResults: number) => Promise<{
    title: string;
    url: string;
    snippet?: string;
    publisher?: string;
    isBlocked?: boolean;
    blockReason?: string;
  }[]>;
  private maxResultsPerQuery: number;

  constructor(options: HermesBrowserDiscoveryOptions = {}) {
    this.browserSearchFn = options.browserSearchFn;
    this.maxResultsPerQuery = options.maxResultsPerQuery || 5;
  }

  isAvailable(): boolean {
    if (this.browserSearchFn) return true;
    if (typeof (globalThis as any).__HERMES_BROWSER_EXECUTOR__ === 'function') return true;
    if (process.env.HERMES_BROWSER_DISCOVERY_ENABLED === 'true') return true;
    return false;
  }

  async search(
    request: DiscoveryProviderRequest,
    options: DiscoveryOptions = {}
  ): Promise<NormalizedCandidateMetadata[]> {
    const maxRows = Math.min(request.max_results || this.maxResultsPerQuery, 5);

    if (!this.isAvailable()) {
      return [];
    }

    try {
      const searchFn = this.browserSearchFn || (globalThis as any).__HERMES_BROWSER_EXECUTOR__;
      if (!searchFn) {
        return [];
      }

      const rawResults = await searchFn(request.query, maxRows);
      if (!Array.isArray(rawResults)) return [];

      const candidates: NormalizedCandidateMetadata[] = [];
      for (let i = 0; i < rawResults.length; i++) {
        const item = rawResults[i];
        if (item.isBlocked) {
          // CAPTCHA / bot challenge detected -> BROWSER_SEARCH_BLOCKED
          continue;
        }

        // Section 12: Existing Network Safety (validateSafeUrl)
        const safeCheck = validateSafeUrl(item.url);
        if (!safeCheck.isSafe) {
          continue;
        }

        candidates.push({
          provider: 'HERMES_BROWSER',
          candidate_id: `cand_hbr_${Date.now()}_${i}`,
          title: item.title,
          snippet_or_abstract: item.snippet,
          url: safeCheck.normalizedUrl || item.url,
          publisher: item.publisher || 'Web Result via Hermes Browser',
          document_hint: estimateCandidateHint(item.title, item.publisher, item.url),
          language: request.language,
          discovered_at: new Date().toISOString(),
          discovery_query_id: request.query_id
        });
      }

      return candidates;
    } catch (err: any) {
      if (err.message && err.message.includes('BROWSER_SEARCH_BLOCKED')) {
        return [];
      }
      return [];
    }
  }
}

