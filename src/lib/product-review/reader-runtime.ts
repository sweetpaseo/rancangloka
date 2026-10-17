/**
 * ============================================================================
 * RancangLoka Product Review Desk (PRODUCT_REVIEW_AFFILIATE-1D-A)
 * Reader Runtime Adapter & Decision-to-Product Bridge
 *
 * Core Architectural Invariants:
 * 1. THE_PRODUCT_IS_NOT_THE_CENTER_OF_THE_ARTICLE
 *    Permanent Flow:
 *    READER DECISION -> PDE SOLUTION CLASS -> TECHNICAL PRODUCT MATCH ->
 *    EDITORIAL REVIEW -> OFFER -> AFFILIATE DESTINATION.
 *    Never: AFFILIATE OFFER -> RECOMMENDATION.
 *
 * 2. NO_SILENT_PRODUCT_REVIEW_PRODUCTION_FALLBACK
 *    In production mode, missing D1 data must return typed failure states
 *    (e.g., PRODUCT_UNAVAILABLE, NO_BINDING). Never silently fall back to
 *    synthetic fixtures in production.
 *
 * 3. DYNAMIC_COMMERCE_DATA_MUST_NOT_INVALIDATE_ARTICLE_PROVENANCE
 *    Dynamic product match and commerce cards are runtime-attached DTOs.
 *    They never mutate published article markdown, articles.content_hash,
 *    or Publication DNA.
 *
 * 4. COMMERCE_BLIND_TECHNICAL_ELIGIBILITY
 *    Technical eligibility is evaluated strictly on physical characteristics
 *    and verified evidence before any price or merchant offer is considered.
 *    Stale price does not disqualify a physically sound product.
 *
 * 5. NO_FAKE_NUMERIC_PRECISION
 *    Zero scores, ratings, or percentages. Pure qualitative match taxonomy.
 * ============================================================================
 */

import type {
  Product,
  EditorialProductReview,
  Variant,
  EvidenceSource,
  SpecSnapshot,
  Offer,
  PriceSnapshot,
  AffiliateDestination,
  ArticleProductBinding,
  ArticleProductRole,
  CommercialDisclosure,
  ProductMatchStatus,
  ProductMatchResult,
  ProductReviewHandoffContract,
  ReviewMode
} from './types.ts';
import {
  evaluateTechnicalProductMatch,
  scanForForbiddenReviewCommerceFields
} from './contracts.ts';
import {
  evaluateEntityFreshness,
  DEFAULT_FRESHNESS_POLICY,
  type FreshnessEvaluation
} from './freshness.ts';
import {
  validateHandsOnProvenance
} from './admin-inspector.ts';

// ============================================================================
// 1. READER PRODUCT ELIGIBILITY STATES
// ============================================================================

export type ReaderProductEligibilityState =
  | 'ELIGIBLE'
  | 'ELIGIBLE_WITH_TRADEOFF'
  | 'BLOCKED_INSUFFICIENT_EVIDENCE'
  | 'BLOCKED_STALE_SPEC'
  | 'BLOCKED_IDENTITY_DRIFT'
  | 'BLOCKED_TECHNICAL_MISMATCH'
  | 'BLOCKED_EDITORIAL_REVIEW';

export interface ReaderEligibilityResult {
  state: ReaderProductEligibilityState;
  is_eligible: boolean;
  reasons: string[];
}

/**
 * Derives whether a candidate product qualifies for public reader recommendation.
 * Evaluated strictly prior to attaching volatile commercial offers.
 */
export function deriveReaderProductEligibility(params: {
  product: Product;
  variant?: Variant;
  reviews: EditorialProductReview[];
  specSnapshot?: SpecSnapshot;
  evidenceSources?: EvidenceSource[] | readonly EvidenceSource[];
  matchResult: ProductMatchResult;
  referenceTime?: string;
}): ReaderEligibilityResult {
  const { product, reviews, specSnapshot, evidenceSources, matchResult } = params;
  const reasons: string[] = [];

  // 1. Identity integrity check (Block on identity drift)
  if (product.identity_state !== 'CURRENT') {
    reasons.push(`Identitas produk mengalami pergeseran (${product.identity_state}). Tinjauan redaksi diperlukan.`);
    return {
      state: 'BLOCKED_IDENTITY_DRIFT',
      is_eligible: false,
      reasons
    };
  }

  // 2. Editorial Review check (Block on incomplete review or unverified hands-on claims)
  if (!reviews || reviews.length === 0) {
    reasons.push('Produk belum memiliki ulasan editorial resmi dari redaksi RancangLoka.');
    return {
      state: 'BLOCKED_EDITORIAL_REVIEW',
      is_eligible: false,
      reasons
    };
  }

  for (const rev of reviews) {
    if (rev.review_mode === 'HANDS_ON_REVIEW') {
      const handsOnCheck = validateHandsOnProvenance(rev, evidenceSources);
      if (!handsOnCheck.valid) {
        reasons.push('Ulasan uji fisik (Hands-On) belum memenuhi standar kelengkapan provenansi primer.');
        return {
          state: 'BLOCKED_EDITORIAL_REVIEW',
          is_eligible: false,
          reasons
        };
      }
    }
  }

  // 3. Technical Match Check (Block on mismatch)
  if (matchResult.match_status === 'NOT_MATCH') {
    reasons.push('Produk tidak cocok dengan kelas solusi teknis yang direkomendasikan untuk pembaca.');
    if (matchResult.disqualified_reasons.length > 0) {
      reasons.push(...matchResult.disqualified_reasons);
    }
    return {
      state: 'BLOCKED_TECHNICAL_MISMATCH',
      is_eligible: false,
      reasons
    };
  }

  // 4. Evidence Adequacy Check (Block on insufficient evidence)
  if (
    matchResult.match_status === 'INSUFFICIENT_EVIDENCE' ||
    !specSnapshot ||
    !evidenceSources ||
    evidenceSources.length === 0
  ) {
    reasons.push('Bukti spesifikasi fisik terverifikasi belum mencukupi untuk penilaian deterministik.');
    return {
      state: 'BLOCKED_INSUFFICIENT_EVIDENCE',
      is_eligible: false,
      reasons
    };
  }

  // 5. Spec Freshness Check (Block on stale specifications)
  const specFreshness = evaluateEntityFreshness(
    'spec_snapshot',
    specSnapshot.captured_at,
    { referenceTime: params.referenceTime }
  );
  if (!specFreshness.is_fresh) {
    reasons.push(
      `Snapshot spesifikasi teknis telah kadaluarsa (${specFreshness.age_ms / (1000 * 60 * 60 * 24)} hari). Pembaruan diperlukan.`
    );
    return {
      state: 'BLOCKED_STALE_SPEC',
      is_eligible: false,
      reasons
    };
  }

  // 6. Qualitative Match Determination
  if (matchResult.match_status === 'MATCH_WITH_TRADEOFF' || matchResult.match_status === 'CONDITIONAL_MATCH') {
    reasons.push('Produk memenuhi kelas solusi arsitektural dengan pertimbangan kompromi fisik tertentu.');
    return {
      state: 'ELIGIBLE_WITH_TRADEOFF',
      is_eligible: true,
      reasons
    };
  }

  reasons.push('Produk memenuhi seluruh kriteria teknis arsitektural yang disyaratkan.');
  return {
    state: 'ELIGIBLE',
    is_eligible: true,
    reasons
  };
}

// ============================================================================
// 2. READER-SAFE PRODUCT DTO & COMMERCE PRESENTATION
// ============================================================================

export interface ReaderAffiliateLink {
  href: string;
  rel: 'sponsored nofollow noopener';
  target: '_blank';
}

export interface ReaderMerchantOffer {
  merchant_name: string;
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'PRE_ORDER' | 'UNKNOWN';
  observed_price_formatted?: string;
  observed_price_currency?: string;
  cta_text: string;
  affiliate_link?: ReaderAffiliateLink;
}

export interface ReaderCommercePresentation {
  availability_state: 'IN_STOCK' | 'OUT_OF_STOCK' | 'PRE_ORDER' | 'CHECK_MERCHANT' | 'UNAVAILABLE';
  observed_price_display?: string;
  observed_price_captured_at?: string;
  price_freshness: 'FRESH' | 'STALE' | 'UNAVAILABLE';
  price_caveat: string;
  offers: ReaderMerchantOffer[];
}

export interface ReaderCommercialDisclosure {
  has_affiliate_links: boolean;
  is_sponsored_content: boolean;
  is_product_supplied_by_brand: boolean;
  disclosure_statement: string;
}

/**
 * Public Reader-Safe DTO strictly sanitized for public presentation.
 * Prohibits internal hashes, admin notes, private reviewer contacts,
 * raw SQL IDs, and commercial ranking metrics.
 */
export interface ReaderProductDTO {
  product_id: string;
  display_name: string;
  brand: string;
  category_id: string;
  solution_class_id: string;
  editorial_role: ArticleProductRole;
  editorial_role_label: string;
  variant_summary?: string;
  technical_match_status: ProductMatchStatus;
  technical_match_label: string;
  why_it_matches: string[];
  important_tradeoffs: Array<{ benefit: string; compromise: string }>;
  reader_cautions: string[];
  review_mode: ReviewMode;
  tested_by_rancangloka: boolean;
  review_basis_statement: string;
  evidence_state: 'VERIFIED_CURRENT' | 'VERIFIED_AGING' | 'UNAVAILABLE';
  commercial_disclosure: ReaderCommercialDisclosure;
  commerce?: ReaderCommercePresentation;
}

// ============================================================================
// 3. EDITORIAL ROLE LABELS & COMMERCE CTA HELPERS
// ============================================================================

export const ARTICLE_PRODUCT_ROLE_CONFIG: Record<
  ArticleProductRole,
  { label: string; readerDescription: string; publicExposureAllowed: boolean }
> = {
  MATCHED_PRODUCT: {
    label: 'Rekomendasi Produk Cocok',
    readerDescription: 'Produk di pasaran yang karakteristik teknisnya terbukti cocok dengan keputusan arsitektur di atas.',
    publicExposureAllowed: true
  },
  PRIMARY_SUBJECT: {
    label: 'Subjek Ulasan Utama',
    readerDescription: 'Produk yang menjadi fokus bedah material mendalam dalam artikel ini.',
    publicExposureAllowed: true
  },
  ALTERNATIVE: {
    label: 'Alternatif Solusi',
    readerDescription: 'Produk dari kelas solusi alternatif untuk perbandingan kebutuhan rumah yang berbeda.',
    publicExposureAllowed: true
  },
  EXAMPLE: {
    label: 'Contoh Material di Pasar',
    readerDescription: 'Contoh perwujudan material fisik yang beredar di distributor Indonesia.',
    publicExposureAllowed: true
  },
  RELATED_PRODUCT: {
    label: 'Produk Terkait',
    readerDescription: 'Komponen hardware atau material pendukung pemasangan.',
    publicExposureAllowed: false // Private / reserved by default
  }
};

/**
 * Helper to construct safe, standardized affiliate link attributes.
 * Enforces rel="sponsored nofollow noopener".
 */
export function buildReaderAffiliateLink(destinationUrl: string): ReaderAffiliateLink {
  return {
    href: destinationUrl,
    rel: 'sponsored nofollow noopener',
    target: '_blank'
  };
}

/**
 * Standardized neutral editorial CTA generator.
 * Strictly avoids clickbait, FOMO, or superlative sales language.
 */
export function getStandardAffiliateCtaText(availability?: string): string {
  if (availability === 'IN_STOCK') {
    return 'Cek harga & varian di toko mitra';
  }
  if (availability === 'PRE_ORDER') {
    return 'Cek jadwal ketersediaan di distributor';
  }
  return 'Periksa ketersediaan & harga terkini';
}

// ============================================================================
// 4. FAILURE STATES & TYPED RUNTIME OUTCOMES
// ============================================================================

export type ReaderProductFailureCode =
  | 'NO_BINDING'
  | 'PRODUCT_UNAVAILABLE'
  | 'VARIANT_UNAVAILABLE'
  | 'IDENTITY_DRIFT'
  | 'SPEC_STALE'
  | 'EVIDENCE_INSUFFICIENT'
  | 'TECHNICAL_MISMATCH'
  | 'EDITORIAL_REVIEW_UNAVAILABLE'
  | 'PRODUCTION_FALLBACK_FORBIDDEN';

export type ReaderProductRuntimeResult =
  | {
      status: 'AVAILABLE';
      eligibility: ReaderProductEligibilityState;
      dto: ReaderProductDTO;
    }
  | {
      status: 'UNAVAILABLE';
      code: ReaderProductFailureCode;
      reason: string;
      eligibility?: ReaderProductEligibilityState;
    };

// ============================================================================
// 5. RUNTIME DTO ASSEMBLER
// ============================================================================

/**
 * Assembles the sanitized ReaderProductDTO from raw entities.
 * Strictly scans and verifies zero internal/commercial leakages.
 */
export function assembleReaderProductDTO(params: {
  binding: ArticleProductBinding;
  product: Product;
  variant?: Variant;
  reviews: EditorialProductReview[];
  specSnapshot?: SpecSnapshot;
  evidenceSources?: EvidenceSource[] | readonly EvidenceSource[];
  matchResult: ProductMatchResult;
  offers?: Offer[];
  priceSnapshots?: PriceSnapshot[];
  affiliateDestinations?: AffiliateDestination[];
  referenceTime?: string;
}): ReaderProductDTO {
  const {
    binding,
    product,
    variant,
    reviews,
    specSnapshot,
    evidenceSources,
    matchResult,
    offers = [],
    priceSnapshots = [],
    affiliateDestinations = [],
    referenceTime
  } = params;

  // 1. Identify primary editorial review
  const latestReview = reviews[reviews.length - 1];
  const isHandsOn = latestReview?.review_mode === 'HANDS_ON_REVIEW' && Boolean(latestReview?.tested_by_rancangloka);

  let reviewBasisStatement: string;
  if (isHandsOn) {
    reviewBasisStatement =
      'Diverifikasi melalui pengujian fisik di workshop/fasilitas lab RancangLoka dengan standar iklim tropis.';
  } else {
    reviewBasisStatement =
      'Analisis berbasis spesifikasi fisik terverifikasi, manual teknis pabrikan, dan konsensus material bangunan tropis (Bukan uji lab fisik).';
  }

  // 2. Format why_it_matches & cautions
  const whyItMatches = [...matchResult.matched_traits];
  const importantTradeoffs = matchResult.tradeoffs_addressed.map(t => {
    const parts = t.split(' dengan kompromi ');
    return {
      benefit: parts[0]?.replace('Mitigasi kompromi: ', '') || t,
      compromise: parts[1] || 'Perlu instalasi teliti.'
    };
  });

  const readerCautions: string[] = [];
  if (matchResult.match_status === 'MATCH_WITH_TRADEOFF') {
    readerCautions.push('Perhatikan persyaratan perkuatan profil dan ketelitian tukang spesialis saat pemasangan.');
  }
  if (matchResult.match_status === 'CONDITIONAL_MATCH') {
    readerCautions.push('Pastikan spesifikasi bukaan dan paparan tempias air telah memenuhi prasyarat arsitektur.');
  }

  // 3. Technical match label
  let matchLabel = 'Cocok Penuh';
  if (matchResult.match_status === 'MATCH_WITH_TRADEOFF') {
    matchLabel = 'Cocok dengan Kompromi';
  } else if (matchResult.match_status === 'CONDITIONAL_MATCH') {
    matchLabel = 'Cocok Bersyarat';
  }

  // 4. Evidence state
  let evidenceState: 'VERIFIED_CURRENT' | 'VERIFIED_AGING' | 'UNAVAILABLE' = 'UNAVAILABLE';
  if (specSnapshot) {
    const specFreshness = evaluateEntityFreshness('spec_snapshot', specSnapshot.captured_at, { referenceTime });
    if (specFreshness.is_fresh) {
      evidenceState = specFreshness.days_remaining <= 14 ? 'VERIFIED_AGING' : 'VERIFIED_CURRENT';
    }
  }

  // 5. Decoupled Commerce Presentation (attached separately)
  let commercePresentation: ReaderCommercePresentation | undefined;
  if (offers.length > 0) {
    const readerOffers: ReaderMerchantOffer[] = [];
    let latestObservedPrice: number | undefined;
    let latestPriceCurrency = 'IDR';
    let latestPriceCapturedAt: string | undefined;
    let priceFreshnessState: 'FRESH' | 'STALE' | 'UNAVAILABLE' = 'UNAVAILABLE';

    for (let i = 0; i < offers.length; i++) {
      const off = offers[i];
      const price = priceSnapshots.find(p => p.offer_id === off.offer_id) || priceSnapshots[i];
      const aff = affiliateDestinations.find(a => a.offer_id === off.offer_id && a.is_active);

      let priceFormatted: string | undefined;
      if (price) {
        priceFormatted = `${price.currency} ${price.observed_price.toLocaleString('id-ID')}`;
        latestObservedPrice = price.observed_price;
        latestPriceCurrency = price.currency;
        latestPriceCapturedAt = price.captured_at;

        const pFreshness = evaluateEntityFreshness('price_snapshot', price.captured_at, { referenceTime });
        priceFreshnessState = pFreshness.is_fresh ? 'FRESH' : 'STALE';
      }

      readerOffers.push({
        merchant_name: off.merchant_name,
        availability: off.current_availability,
        observed_price_formatted: priceFormatted,
        observed_price_currency: price?.currency,
        cta_text: getStandardAffiliateCtaText(off.current_availability),
        affiliate_link: aff ? buildReaderAffiliateLink(aff.affiliate_destination_url) : undefined
      });
    }

    commercePresentation = {
      availability_state: offers.some(o => o.current_availability === 'IN_STOCK') ? 'IN_STOCK' : 'CHECK_MERCHANT',
      observed_price_display: latestObservedPrice ? `${latestPriceCurrency} ${latestObservedPrice.toLocaleString('id-ID')}` : undefined,
      observed_price_captured_at: latestPriceCapturedAt,
      price_freshness: priceFreshnessState,
      price_caveat: 'Harga pasar dinamis dan dapat berubah sewaktu-waktu di masing-masing merchant pihak ketiga.',
      offers: readerOffers
    };
  }

  const roleConfig = ARTICLE_PRODUCT_ROLE_CONFIG[binding.editorial_role] || ARTICLE_PRODUCT_ROLE_CONFIG.MATCHED_PRODUCT;

  const dto: ReaderProductDTO = {
    product_id: product.product_id,
    display_name: product.canonical_name,
    brand: product.brand,
    category_id: product.category_id,
    solution_class_id: product.solution_class_id,
    editorial_role: binding.editorial_role,
    editorial_role_label: roleConfig.label,
    variant_summary: variant ? `${variant.variant_name} (${variant.sku_or_model})` : undefined,
    technical_match_status: matchResult.match_status,
    technical_match_label: matchLabel,
    why_it_matches: whyItMatches,
    important_tradeoffs: importantTradeoffs,
    reader_cautions: readerCautions,
    review_mode: latestReview ? latestReview.review_mode : 'ANALYTICAL_REVIEW',
    tested_by_rancangloka: isHandsOn,
    review_basis_statement: reviewBasisStatement,
    evidence_state: evidenceState,
    commercial_disclosure: {
      has_affiliate_links: Boolean(binding.commercial_disclosure.has_affiliate_links),
      is_sponsored_content: Boolean(binding.commercial_disclosure.is_sponsored_content),
      is_product_supplied_by_brand: Boolean(binding.commercial_disclosure.is_product_supplied_by_brand),
      disclosure_statement: binding.commercial_disclosure.disclosure_statement
    },
    commerce: commercePresentation
  };

  return dto;
}

// ============================================================================
// 6. EDGE RUNTIME ENTRYPOINT (SAFE READ-ONLY BRIDGE)
// ============================================================================

export interface ReaderRuntimeOptions {
  isProduction?: boolean;
  allowSyntheticFixture?: boolean;
  referenceTime?: string;
  syntheticFixtureOverride?: {
    binding: ArticleProductBinding;
    product: Product;
    variant?: Variant;
    reviews: EditorialProductReview[];
    specs?: SpecSnapshot;
    evidence: EvidenceSource[];
    offers?: Offer[];
    prices?: PriceSnapshot[];
    affiliates?: AffiliateDestination[];
  };
}

/**
 * Resolves a reader-safe product match for a published article given a PDE handoff contract.
 *
 * Enforces Invariants:
 * - NO_SILENT_PRODUCT_REVIEW_PRODUCTION_FALLBACK
 * - DYNAMIC_COMMERCE_DATA_MUST_NOT_INVALIDATE_ARTICLE_PROVENANCE
 * - TECHNICAL_MATCH_DETERMINED_BEFORE_COMMERCE
 */
export async function loadReaderProductForArticle(params: {
  articleId: number;
  pdeHandoff: ProductReviewHandoffContract;
  db?: any;
  options?: ReaderRuntimeOptions;
}): Promise<ReaderProductRuntimeResult> {
  const { articleId, pdeHandoff, db, options = {} } = params;
  const isProduction = Boolean(options.isProduction);

  // 1. Production Fallback Guard (Permanent Invariant)
  if (isProduction && options.allowSyntheticFixture) {
    return {
      status: 'UNAVAILABLE',
      code: 'PRODUCTION_FALLBACK_FORBIDDEN',
      reason: 'NO_SILENT_PRODUCT_REVIEW_PRODUCTION_FALLBACK: Static synthetic fixtures are strictly forbidden in production mode.'
    };
  }

  // 2. Data Resolution: Try storage or explicit development fixture
  let binding: ArticleProductBinding | null = null;
  let product: Product | null = null;
  let variant: Variant | undefined;
  let reviews: EditorialProductReview[] = [];
  let specs: SpecSnapshot | undefined;
  let evidence: EvidenceSource[] = [];
  let offers: Offer[] = [];
  let prices: PriceSnapshot[] = [];
  let affiliates: AffiliateDestination[] = [];

  if (db) {
    try {
      // Check if table exists safely (handles pre-migration 0036 D1 states)
      const tableCheck = await db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='product_review_article_bindings'")
        .first();

      if (tableCheck) {
        const row = await db
          .prepare('SELECT * FROM product_review_article_bindings WHERE article_id = ? LIMIT 1')
          .bind(articleId)
          .first();

        if (row) {
          binding = {
            binding_id: row.binding_id,
            article_id: row.article_id,
            product_id: row.product_id,
            variant_id: row.variant_id ?? undefined,
            editorial_role: row.editorial_role,
            section_anchor: row.section_anchor ?? undefined,
            commercial_disclosure: JSON.parse(row.commercial_disclosure_json)
          };

          // Load product
          const pRow = await db
            .prepare('SELECT * FROM product_review_products WHERE product_id = ?')
            .bind(binding.product_id)
            .first();

          if (pRow) {
            product = {
              product_id: pRow.product_id,
              brand: pRow.brand,
              canonical_name: pRow.canonical_name,
              category_id: pRow.category_id,
              solution_class_id: pRow.solution_class_id,
              identity_state: pRow.identity_state
            };
          }
        }
      }
    } catch {
      // Storage unavailable or tables not yet migrated
    }
  }

  // In non-production test/development mode, explicit synthetic fixtures are permitted
  if (!binding && options.allowSyntheticFixture && !isProduction) {
    if (options.syntheticFixtureOverride) {
      binding = options.syntheticFixtureOverride.binding;
      product = options.syntheticFixtureOverride.product;
      variant = options.syntheticFixtureOverride.variant;
      reviews = options.syntheticFixtureOverride.reviews;
      specs = options.syntheticFixtureOverride.specs;
      evidence = options.syntheticFixtureOverride.evidence;
      offers = options.syntheticFixtureOverride.offers || [];
      prices = options.syntheticFixtureOverride.prices || [];
      affiliates = options.syntheticFixtureOverride.affiliates || [];
    }
  }

  // 3. Handle missing binding
  if (!binding) {
    return {
      status: 'UNAVAILABLE',
      code: 'NO_BINDING',
      reason: `Artikel ID ${articleId} belum memiliki pengikatan produk terdaftar.`
    };
  }

  // 4. Handle missing product
  if (!product) {
    return {
      status: 'UNAVAILABLE',
      code: 'PRODUCT_UNAVAILABLE',
      reason: `Identitas produk '${binding.product_id}' tidak ditemukan dalam katalog ulasan.`
    };
  }

  // 5. Evaluate technical match against PDE handoff
  const matchResult = evaluateTechnicalProductMatch(pdeHandoff, product, specs);

  // 6. Derive reader product eligibility
  const eligibility = deriveReaderProductEligibility({
    product,
    variant,
    reviews,
    specSnapshot: specs,
    evidenceSources: evidence,
    matchResult,
    referenceTime: options.referenceTime
  });

  if (!eligibility.is_eligible) {
    let failureCode: ReaderProductFailureCode = 'TECHNICAL_MISMATCH';
    if (eligibility.state === 'BLOCKED_IDENTITY_DRIFT') failureCode = 'IDENTITY_DRIFT';
    if (eligibility.state === 'BLOCKED_STALE_SPEC') failureCode = 'SPEC_STALE';
    if (eligibility.state === 'BLOCKED_INSUFFICIENT_EVIDENCE') failureCode = 'EVIDENCE_INSUFFICIENT';
    if (eligibility.state === 'BLOCKED_EDITORIAL_REVIEW') failureCode = 'EDITORIAL_REVIEW_UNAVAILABLE';

    return {
      status: 'UNAVAILABLE',
      code: failureCode,
      reason: eligibility.reasons.join(' '),
      eligibility: eligibility.state
    };
  }

  // 7. Assemble sanitized reader DTO
  const dto = assembleReaderProductDTO({
    binding,
    product,
    variant,
    reviews,
    specSnapshot: specs,
    evidenceSources: evidence,
    matchResult,
    offers,
    priceSnapshots: prices,
    affiliateDestinations: affiliates,
    referenceTime: options.referenceTime
  });

  return {
    status: 'AVAILABLE',
    eligibility: eligibility.state,
    dto
  };
}
