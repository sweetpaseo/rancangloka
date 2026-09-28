/**
 * RancangLoka Centralized Content Quarantine Policy
 * Milestone: CONTENT-QUARANTINE-1
 *
 * Implements a single authoritative registry and evaluation policy for:
 * 1. Hardcoded prototype articles isolated from public discovery
 * 2. Unsafe / evidence-review articles undergoing editorial remediation
 * 3. Legacy / overlapping URLs redirected to authentic canonical articles
 */

export type QuarantineType = 'PROTOTYPE' | 'EVIDENCE_REVIEW' | 'REDIRECT';

export interface QuarantineEntry {
  slug: string;
  quarantine_type: QuarantineType;
  reason: string;
  replacement_url?: string;
  quarantined_at: string;
  future_reuse_allowed: boolean;
}

export const QUARANTINE_REGISTRY: Record<string, QuarantineEntry> = {
  // ---------------------------------------------------------------------------
  // 1. In-Memory Prototype Corpus (19 articles isolated from discovery)
  // ---------------------------------------------------------------------------
  'rumah-tropis-yang-tidak-takut-matahari': {
    slug: 'rumah-tropis-yang-tidak-takut-matahari',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'mengapa-rumah-menghadap-barat-selalu-panas': {
    slug: 'mengapa-rumah-menghadap-barat-selalu-panas',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'efek-cerobong-void-rumah-sempit-36': {
    slug: 'efek-cerobong-void-rumah-sempit-36',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'panduan-material-fasad-kisi-ulin-vs-louver': {
    slug: 'panduan-material-fasad-kisi-ulin-vs-louver',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'tren-desain-interior-japandi-2026-hunian-minimalis': {
    slug: 'tren-desain-interior-japandi-2026-hunian-minimalis',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'proporsi-spasial-rumah-mungil-skala-furnitur': {
    slug: 'proporsi-spasial-rumah-mungil-skala-furnitur',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'layering-pencahayaan-alami-dan-cove-lighting': {
    slug: 'layering-pencahayaan-alami-dan-cove-lighting',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'kamar-tidur-yang-benar-benar-mengistirahatkan': {
    slug: 'kamar-tidur-yang-benar-benar-mengistirahatkan',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'panduan-smart-home-otomasi-energi-2026': {
    slug: 'panduan-smart-home-otomasi-energi-2026',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'protokol-matter-dan-thread-smart-home': {
    slug: 'protokol-matter-dan-thread-smart-home',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'smart-lighting-sensor-keberadaan-lokal': {
    slug: 'smart-lighting-sensor-keberadaan-lokal',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'sistem-keamanan-rumah-privasi-lokal': {
    slug: 'sistem-keamanan-rumah-privasi-lokal',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'desain-home-office-ergonomis-wfh-produktif': {
    slug: 'desain-home-office-ergonomis-wfh-produktif',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'materialitas-batu-alam-andesit-dan-terakota': {
    slug: 'materialitas-batu-alam-andesit-dan-terakota',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'inner-courtyard-taman-kering-tengah-rumah': {
    slug: 'inner-courtyard-taman-kering-tengah-rumah',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'open-plan-vs-ruang-tersekat-trade-off': {
    slug: 'open-plan-vs-ruang-tersekat-trade-off',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'arsitek-menjawab-efektivitas-void-tanpa-exhaust-fan': {
    slug: 'arsitek-menjawab-efektivitas-void-tanpa-exhaust-fan',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'studi-kasus-fasad-kisi-ulin-rumah-120m2': {
    slug: 'studi-kasus-fasad-kisi-ulin-rumah-120m2',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },
  'solusi-rumah-panas-5-intervensi-spasial-berbiaya-rendah': {
    slug: 'solusi-rumah-panas-5-intervensi-spasial-berbiaya-rendah',
    quarantine_type: 'PROTOTYPE',
    reason: 'in-memory prototype corpus isolated from discovery pending replacement',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  },

  // ---------------------------------------------------------------------------
  // 2. Overlapping Prototype Redirect (1 prototype article redirected to Article 5)
  // ---------------------------------------------------------------------------
  'panduan-kusen-aluminium-ekstrusi-daerah-lembap': {
    slug: 'panduan-kusen-aluminium-ekstrusi-daerah-lembap',
    quarantine_type: 'REDIRECT',
    reason: 'overlapping legacy prototype consolidated via 301 redirect to authentic Article 5',
    replacement_url: '/kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: false
  },

  // ---------------------------------------------------------------------------
  // 3. Article 6: Evidence Review (Real content quarantined pending repair)
  // ---------------------------------------------------------------------------
  'rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman': {
    slug: 'rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman',
    quarantine_type: 'EVIDENCE_REVIEW',
    reason: 'citation/evidence repair required before renewed public discovery',
    quarantined_at: '2026-09-28T07:30:00.000Z',
    future_reuse_allowed: true
  }
};

/**
 * Normalizes a slug for reliable registry lookup.
 */
export function normalizeSlug(slug: string): string {
  if (!slug) return '';
  return slug.trim().replace(/^\/+|\/+$/g, '');
}

/**
 * Retrieves the quarantine state for a given slug if quarantined.
 */
export function getQuarantineState(slug: string, registry: Record<string, QuarantineEntry> = QUARANTINE_REGISTRY): QuarantineEntry | null {
  const norm = normalizeSlug(slug);
  return Object.hasOwn(registry, norm) ? registry[norm] : null;
}

/**
 * Checks whether a given slug is currently quarantined.
 */
export function isQuarantined(slug: string, registry: Record<string, QuarantineEntry> = QUARANTINE_REGISTRY): boolean {
  return getQuarantineState(slug, registry) !== null;
}

/**
 * Determines if an article is eligible for public discovery surfaces
 * (homepage, /explore, category archives, related cards, sitemaps, RSS, search).
 */
export function isPubliclyDiscoverable(
  article: { slug: string; status?: string } | null | undefined,
  registry: Record<string, QuarantineEntry> = QUARANTINE_REGISTRY
): boolean {
  if (!article || !article.slug) return false;
  if (article.status && article.status !== 'published') return false;
  return !isQuarantined(article.slug, registry);
}

/**
 * Determines if an article should be indexed by search engines.
 */
export function isIndexableArticle(
  article: { slug: string; status?: string } | null | undefined,
  registry: Record<string, QuarantineEntry> = QUARANTINE_REGISTRY
): boolean {
  return isPubliclyDiscoverable(article, registry);
}

/**
 * Returns the 301 redirect target URL if the slug is quarantined as a redirect.
 */
export function getQuarantineRedirect(slug: string, registry: Record<string, QuarantineEntry> = QUARANTINE_REGISTRY): string | null {
  const state = getQuarantineState(slug, registry);
  if (state && state.quarantine_type === 'REDIRECT' && state.replacement_url) {
    return state.replacement_url;
  }
  return null;
}

/**
 * Computes the meta robots directive for an article page.
 */
export function getArticleRobotsDirective(
  slug: string,
  siteAllowIndexing: string = 'true',
  registry: Record<string, QuarantineEntry> = QUARANTINE_REGISTRY
): string {
  if (siteAllowIndexing === 'false') {
    return 'noindex, nofollow, noarchive, nosnippet';
  }
  const state = getQuarantineState(slug, registry);
  if (state) {
    return 'noindex, follow';
  }
  return 'index, follow, max-image-preview:large';
}

/**
 * Computes the X-Robots-Tag response header value.
 */
export function getArticleXRobotsTag(
  slug: string,
  siteAllowIndexing: string = 'true',
  registry: Record<string, QuarantineEntry> = QUARANTINE_REGISTRY
): string | null {
  const state = getQuarantineState(slug, registry);
  if (state) {
    return 'noindex, follow';
  }
  if (siteAllowIndexing === 'false') {
    return 'noindex, nofollow';
  }
  return null;
}

/**
 * Returns all quarantined slugs matching an optional quarantine type filter.
 */
export function getQuarantinedSlugs(type?: QuarantineType, registry: Record<string, QuarantineEntry> = QUARANTINE_REGISTRY): string[] {
  return Object.values(registry)
    .filter(e => !type || e.quarantine_type === type)
    .map(e => e.slug);
}

/**
 * Returns the exact 20 slugs belonging to the prototype corpus.
 */
export function getPrototypeCorpusSlugs(registry: Record<string, QuarantineEntry> = QUARANTINE_REGISTRY): string[] {
  return Object.values(registry)
    .filter(e => e.quarantine_type === 'PROTOTYPE' || e.quarantine_type === 'REDIRECT')
    .map(e => e.slug);
}
