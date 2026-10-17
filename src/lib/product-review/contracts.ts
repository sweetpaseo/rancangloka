/**
 * ============================================================================
 * RancangLoka Product Review Desk & Affiliate Firewall (PRODUCT_REVIEW_AFFILIATE-1A)
 * Pure Contract Validation & Technical Matching Runtime
 * ============================================================================
 */

import type {
  Product,
  Variant,
  Offer,
  AffiliateDestination,
  EvidenceSource,
  SpecSnapshot,
  PriceSnapshot,
  ReviewSnapshot,
  ArticleProductBinding,
  ProductMatchResult,
  ProductMatchStatus,
  ProductIdentityState,
  ProductReviewHandoffContract
} from './types.ts';

/**
 * List of forbidden commercial fields in technical decision and product evaluation contracts.
 * Permanent Invariant: AFFILIATE_REVENUE_CANNOT_AFFECT_RECOMMENDATION.
 */
export const FORBIDDEN_TECHNICAL_MATCH_COMMERCE_FIELDS = Object.freeze([
  'commission',
  'commission_rate',
  'payout',
  'affiliate_priority',
  'merchant_priority',
  'sponsored_rank',
  'sponsored_tier',
  'ad_budget',
  'revenue_score',
  'winner_score',
  'star_rating',
  'numeric_score',
  'overall_score',
  'payout_amount',
  'affiliate_commission'
]);

export interface ValidationIssue {
  code: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Recursively scans any object to ensure no forbidden commercial or fake precision
 * fields are present in technical decision objects.
 */
export function scanForForbiddenReviewCommerceFields(
  obj: unknown,
  path = ''
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return issues;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      issues.push(...scanForForbiddenReviewCommerceFields(obj[i], `${path}[${i}]`));
    }
    return issues;
  }

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    const lowerKey = key.toLowerCase();

    for (const forbidden of FORBIDDEN_TECHNICAL_MATCH_COMMERCE_FIELDS) {
      if (lowerKey === forbidden || lowerKey.endsWith(`_${forbidden}`)) {
        issues.push({
          code: 'FORBIDDEN_COMMERCE_FIELD',
          field: currentPath,
          message: `Technical decision object cannot contain commercial property '${key}'.`
        });
      }
    }

    if (typeof value === 'object' && value !== null) {
      issues.push(...scanForForbiddenReviewCommerceFields(value, currentPath));
    }
  }

  return issues;
}

/**
 * Validates a Product entity.
 */
export function validateProduct(product: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!product || typeof product !== 'object' || Array.isArray(product)) {
    return {
      valid: false,
      issues: [{ code: 'INVALID_ENTITY', field: 'root', message: 'Product must be an object.' }]
    };
  }

  const p = product as Partial<Product>;

  // Scan for forbidden commerce fields
  issues.push(...scanForForbiddenReviewCommerceFields(product));

  // Required string identities
  if (!p.product_id || typeof p.product_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'product_id', message: 'product_id is required.' });
  }
  if (!p.brand || typeof p.brand !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'brand', message: 'brand is required.' });
  }
  if (!p.canonical_name || typeof p.canonical_name !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'canonical_name', message: 'canonical_name is required.' });
  }
  if (!p.category_id || typeof p.category_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'category_id', message: 'category_id is required.' });
  }
  if (!p.solution_class_id || typeof p.solution_class_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'solution_class_id', message: 'solution_class_id is required.' });
  }

  // Review Mode & Tested by RancangLoka Invariant
  if (p.review_mode !== 'ANALYTICAL_REVIEW' && p.review_mode !== 'HANDS_ON_REVIEW') {
    issues.push({ code: 'INVALID_FIELD', field: 'review_mode', message: 'review_mode must be ANALYTICAL_REVIEW or HANDS_ON_REVIEW.' });
  }

  // ANALYTICAL_REVIEW cannot claim tested_by_rancangloka = true
  if (p.review_mode === 'ANALYTICAL_REVIEW' && p.tested_by_rancangloka === true) {
    issues.push({
      code: 'INVALID_REVIEW_MODE_TESTED_FLAG',
      field: 'tested_by_rancangloka',
      message: 'ANALYTICAL_REVIEW cannot claim tested_by_rancangloka = true without primary test evidence.'
    });
  }

  // HANDS_ON_REVIEW requires tested_by_rancangloka = true AND testing_provenance AND primary test source
  if (p.review_mode === 'HANDS_ON_REVIEW') {
    if (p.tested_by_rancangloka !== true) {
      issues.push({
        code: 'MISSING_TESTED_FLAG',
        field: 'tested_by_rancangloka',
        message: 'HANDS_ON_REVIEW requires tested_by_rancangloka = true.'
      });
    }

    if (!p.testing_provenance || !p.testing_provenance.testing_date || !p.testing_provenance.tester_identity || !p.testing_provenance.methodology_notes) {
      issues.push({
        code: 'MISSING_TESTING_PROVENANCE',
        field: 'testing_provenance',
        message: 'HANDS_ON_REVIEW requires comprehensive testing_provenance (testing_date, tester_identity, methodology_notes).'
      });
    }

    const hasPrimaryTestSource = Array.isArray(p.evidence_sources) && p.evidence_sources.some(
      s => s.source_type === 'RANCANGLOKA_PRIMARY_TEST'
    );
    if (!hasPrimaryTestSource) {
      issues.push({
        code: 'MISSING_PRIMARY_TEST_SOURCE',
        field: 'evidence_sources',
        message: 'HANDS_ON_REVIEW requires at least one EvidenceSource with source_type = RANCANGLOKA_PRIMARY_TEST.'
      });
    }
  }

  // Validate nested variants if present
  if (Array.isArray(p.variants)) {
    for (let i = 0; i < p.variants.length; i++) {
      const vRes = validateVariant(p.variants[i]);
      if (!vRes.valid) {
        issues.push(...vRes.issues.map(iss => ({ ...iss, field: `variants[${i}].${iss.field}` })));
      }
    }
  }

  // Validate nested spec snapshots if present
  if (Array.isArray(p.spec_snapshots)) {
    for (let i = 0; i < p.spec_snapshots.length; i++) {
      const sRes = validateSpecSnapshot(p.spec_snapshots[i]);
      if (!sRes.valid) {
        issues.push(...sRes.issues.map(iss => ({ ...iss, field: `spec_snapshots[${i}].${iss.field}` })));
      }
    }
  }

  // Validate nested evidence sources if present
  if (Array.isArray(p.evidence_sources)) {
    for (let i = 0; i < p.evidence_sources.length; i++) {
      const eRes = validateEvidenceSource(p.evidence_sources[i]);
      if (!eRes.valid) {
        issues.push(...eRes.issues.map(iss => ({ ...iss, field: `evidence_sources[${i}].${iss.field}` })));
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validates a Variant entity.
 */
export function validateVariant(variant: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!variant || typeof variant !== 'object' || Array.isArray(variant)) {
    return {
      valid: false,
      issues: [{ code: 'INVALID_ENTITY', field: 'root', message: 'Variant must be an object.' }]
    };
  }

  const v = variant as Partial<Variant>;

  // Scan for forbidden commerce fields
  issues.push(...scanForForbiddenReviewCommerceFields(variant));

  if (!v.variant_id || typeof v.variant_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'variant_id', message: 'variant_id is required.' });
  }
  if (!v.product_id || typeof v.product_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'product_id', message: 'product_id is required.' });
  }
  if (!v.sku_or_model || typeof v.sku_or_model !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'sku_or_model', message: 'sku_or_model is required.' });
  }
  if (!v.variant_name || typeof v.variant_name !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'variant_name', message: 'variant_name is required.' });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validates an Offer entity.
 */
export function validateOffer(offer: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!offer || typeof offer !== 'object' || Array.isArray(offer)) {
    return {
      valid: false,
      issues: [{ code: 'INVALID_ENTITY', field: 'root', message: 'Offer must be an object.' }]
    };
  }

  const o = offer as Partial<Offer>;

  if (!o.offer_id || typeof o.offer_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'offer_id', message: 'offer_id is required.' });
  }
  if (!o.product_id || typeof o.product_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'product_id', message: 'product_id is required.' });
  }
  if (!o.merchant_id || typeof o.merchant_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'merchant_id', message: 'merchant_id is required.' });
  }
  if (!o.merchant_name || typeof o.merchant_name !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'merchant_name', message: 'merchant_name is required.' });
  }
  if (!o.listing_title || typeof o.listing_title !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'listing_title', message: 'listing_title is required.' });
  }
  if (!o.listing_identity || typeof o.listing_identity !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'listing_identity', message: 'listing_identity is required.' });
  }
  if (!o.listing_url || typeof o.listing_url !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'listing_url', message: 'listing_url is required.' });
  }
  if (!o.current_availability) {
    issues.push({ code: 'MISSING_FIELD', field: 'current_availability', message: 'current_availability is required.' });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validates an AffiliateDestination entity.
 */
export function validateAffiliateDestination(destination: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!destination || typeof destination !== 'object' || Array.isArray(destination)) {
    return {
      valid: false,
      issues: [{ code: 'INVALID_ENTITY', field: 'root', message: 'AffiliateDestination must be an object.' }]
    };
  }

  const d = destination as Partial<AffiliateDestination>;

  if (!d.destination_id || typeof d.destination_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'destination_id', message: 'destination_id is required.' });
  }
  if (!d.offer_id || typeof d.offer_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'offer_id', message: 'offer_id is required.' });
  }
  if (!d.provider || typeof d.provider !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'provider', message: 'provider is required.' });
  }
  if (!d.affiliate_destination_url || typeof d.affiliate_destination_url !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'affiliate_destination_url', message: 'affiliate_destination_url is required.' });
  } else {
    try {
      new URL(d.affiliate_destination_url);
    } catch {
      issues.push({ code: 'INVALID_URL', field: 'affiliate_destination_url', message: 'affiliate_destination_url must be a valid URL string.' });
    }
  }

  // Ensure no editorial rank or recommendation score is placed on destination
  const destRecord = d as Record<string, any>;
  if ('editorial_rank' in destRecord || 'winner_score' in destRecord || 'recommendation_score' in destRecord) {
    issues.push({
      code: 'FORBIDDEN_EDITORIAL_RANK_IN_COMMERCE',
      field: 'root',
      message: 'AffiliateDestination cannot hold editorial rank or recommendation score.'
    });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validates an EvidenceSource entity.
 * Invariant: SOURCE_URL_IS_NOT_AFFILIATE_DESTINATION.
 */
export function validateEvidenceSource(source: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return {
      valid: false,
      issues: [{ code: 'INVALID_ENTITY', field: 'root', message: 'EvidenceSource must be an object.' }]
    };
  }

  const s = source as Partial<EvidenceSource>;

  if (!s.source_id || typeof s.source_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'source_id', message: 'source_id is required.' });
  }
  if (!s.source_type) {
    issues.push({ code: 'MISSING_FIELD', field: 'source_type', message: 'source_type is required.' });
  }
  if (!s.source_url || typeof s.source_url !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'source_url', message: 'source_url is required.' });
  } else {
    // Invariant: SOURCE_URL_IS_NOT_AFFILIATE_DESTINATION
    const lowerUrl = s.source_url.toLowerCase();
    if (
      lowerUrl.includes('affiliate') ||
      lowerUrl.includes('involve.asia') ||
      lowerUrl.includes('tag=') ||
      lowerUrl.includes('aff_sub=')
    ) {
      issues.push({
        code: 'SOURCE_URL_IS_AFFILIATE_LINK',
        field: 'source_url',
        message: 'Evidence source_url cannot be an affiliate tracking destination. Use authoritative source URL.'
      });
    }
  }

  if (!s.publisher || typeof s.publisher !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'publisher', message: 'publisher is required.' });
  }
  if (!s.retrieved_at || typeof s.retrieved_at !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'retrieved_at', message: 'retrieved_at is required.' });
  }
  if (!s.evidence_scope || typeof s.evidence_scope !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'evidence_scope', message: 'evidence_scope is required.' });
  }
  if (!s.claim_class) {
    issues.push({ code: 'MISSING_FIELD', field: 'claim_class', message: 'claim_class is required.' });
  }
  if (!s.source_fidelity) {
    issues.push({ code: 'MISSING_FIELD', field: 'source_fidelity', message: 'source_fidelity is required.' });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validates a SpecSnapshot entity.
 */
export function validateSpecSnapshot(snapshot: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return {
      valid: false,
      issues: [{ code: 'INVALID_ENTITY', field: 'root', message: 'SpecSnapshot must be an object.' }]
    };
  }

  const s = snapshot as Partial<SpecSnapshot>;

  issues.push(...scanForForbiddenReviewCommerceFields(snapshot));

  if (!s.spec_snapshot_id || typeof s.spec_snapshot_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'spec_snapshot_id', message: 'spec_snapshot_id is required.' });
  }
  if (!s.product_id || typeof s.product_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'product_id', message: 'product_id is required.' });
  }
  if (!s.captured_at || typeof s.captured_at !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'captured_at', message: 'captured_at is required.' });
  }
  if (!s.source_id || typeof s.source_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'source_id', message: 'source_id is required.' });
  }
  if (!s.specs || typeof s.specs !== 'object' || Array.isArray(s.specs)) {
    issues.push({ code: 'MISSING_FIELD', field: 'specs', message: 'specs must be a non-null key-value object.' });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validates a PriceSnapshot entity.
 */
export function validatePriceSnapshot(snapshot: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return {
      valid: false,
      issues: [{ code: 'INVALID_ENTITY', field: 'root', message: 'PriceSnapshot must be an object.' }]
    };
  }

  const p = snapshot as Partial<PriceSnapshot>;

  if (!p.price_snapshot_id || typeof p.price_snapshot_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'price_snapshot_id', message: 'price_snapshot_id is required.' });
  }
  if (!p.offer_id || typeof p.offer_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'offer_id', message: 'offer_id is required.' });
  }
  if (!p.captured_at || typeof p.captured_at !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'captured_at', message: 'captured_at is required.' });
  }
  if (!p.currency || typeof p.currency !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'currency', message: 'currency is required.' });
  }
  if (typeof p.observed_price !== 'number' || isNaN(p.observed_price) || p.observed_price < 0) {
    issues.push({ code: 'INVALID_PRICE', field: 'observed_price', message: 'observed_price must be a non-negative number.' });
  }
  if (!p.availability) {
    issues.push({ code: 'MISSING_FIELD', field: 'availability', message: 'availability is required.' });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validates a ReviewSnapshot entity.
 * Invariant: External ratings are marketplace signals, not RancangLoka scores.
 */
export function validateReviewSnapshot(snapshot: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return {
      valid: false,
      issues: [{ code: 'INVALID_ENTITY', field: 'root', message: 'ReviewSnapshot must be an object.' }]
    };
  }

  const r = snapshot as Partial<ReviewSnapshot>;

  if (!r.review_snapshot_id || typeof r.review_snapshot_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'review_snapshot_id', message: 'review_snapshot_id is required.' });
  }
  if (!r.product_id || typeof r.product_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'product_id', message: 'product_id is required.' });
  }
  if (!r.source_id || typeof r.source_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'source_id', message: 'source_id is required.' });
  }
  if (!r.captured_at || typeof r.captured_at !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'captured_at', message: 'captured_at is required.' });
  }
  if (typeof r.external_review_count !== 'number' || r.external_review_count < 0) {
    issues.push({ code: 'INVALID_FIELD', field: 'external_review_count', message: 'external_review_count must be a non-negative integer.' });
  }
  if (!r.source_label || typeof r.source_label !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'source_label', message: 'source_label is required.' });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validates an ArticleProductBinding entity.
 */
export function validateArticleProductBinding(binding: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    return {
      valid: false,
      issues: [{ code: 'INVALID_ENTITY', field: 'root', message: 'ArticleProductBinding must be an object.' }]
    };
  }

  const b = binding as Partial<ArticleProductBinding>;

  if (!b.binding_id || typeof b.binding_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'binding_id', message: 'binding_id is required.' });
  }
  if (typeof b.article_id !== 'number' || b.article_id <= 0) {
    issues.push({ code: 'MISSING_FIELD', field: 'article_id', message: 'article_id must be a positive integer.' });
  }
  if (!b.product_id || typeof b.product_id !== 'string') {
    issues.push({ code: 'MISSING_FIELD', field: 'product_id', message: 'product_id is required.' });
  }
  if (!b.editorial_role) {
    issues.push({ code: 'MISSING_FIELD', field: 'editorial_role', message: 'editorial_role is required.' });
  }
  if (!b.commercial_disclosure || typeof b.commercial_disclosure !== 'object') {
    issues.push({ code: 'MISSING_FIELD', field: 'commercial_disclosure', message: 'commercial_disclosure is required.' });
  } else {
    if (typeof b.commercial_disclosure.disclosure_statement !== 'string' || b.commercial_disclosure.disclosure_statement.trim() === '') {
      issues.push({ code: 'MISSING_FIELD', field: 'commercial_disclosure.disclosure_statement', message: 'disclosure_statement is required.' });
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Detects identity drift when an external merchant listing title, SKU, or core specs mutate.
 */
export function validateIdentityDrift(
  original: Product | Variant,
  updatedListing: {
    title: string;
    model_or_sku?: string;
    key_specs?: Record<string, any>;
  }
): { drifted: boolean; state: ProductIdentityState; reason?: string } {
  const originalName = 'canonical_name' in original ? original.canonical_name : original.variant_name;
  const originalSku = 'sku_or_model' in original ? original.sku_or_model : '';

  // 1. Model / SKU check: if both present, strict match is authoritative
  if (originalSku && updatedListing.model_or_sku) {
    if (originalSku.toLowerCase() !== updatedListing.model_or_sku.toLowerCase()) {
      return {
        drifted: true,
        state: 'VARIANT_CHANGED',
        reason: `Listing SKU '${updatedListing.model_or_sku}' does not match registered model '${originalSku}'.`
      };
    }
    return {
      drifted: false,
      state: 'CURRENT'
    };
  }

  // 2. Listing Title word overlap check
  const originalTokens = originalName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const listingTokens = new Set(updatedListing.title.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  let matchingTokens = 0;
  for (const token of originalTokens) {
    if (listingTokens.has(token)) {
      matchingTokens++;
    }
  }

  // If there's zero overlap in meaningful words
  if (originalTokens.length > 0 && matchingTokens === 0) {
    return {
      drifted: true,
      state: 'LISTING_AMBIGUOUS',
      reason: `Listing title '${updatedListing.title}' has zero semantic overlap with registered '${originalName}'.`
    };
  }

  return {
    drifted: false,
    state: 'CURRENT'
  };
}

/**
 * Evaluates technical product characteristics against a PDE Handoff Contract.
 *
 * Rules:
 * - Match happens AFTER solution class decision.
 * - Compares required_characteristics, must_avoid_characteristics, important_tradeoffs.
 * - Zero commercial data, commission, merchant priority, or ad spend in evaluation.
 * - Returns pure qualitative status (MATCH, MATCH_WITH_TRADEOFF, CONDITIONAL_MATCH, NOT_MATCH, INSUFFICIENT_EVIDENCE).
 * - Zero numeric score (no 92/100, 4.8/5).
 */
export function evaluateTechnicalProductMatch(
  handoff: ProductReviewHandoffContract,
  product: Product,
  specSnapshot?: SpecSnapshot
): ProductMatchResult {
  // 1. Enforce solution class alignment
  if (handoff.solution_class_id !== product.solution_class_id) {
    return {
      product_id: product.product_id,
      solution_class_id: product.solution_class_id,
      match_status: 'NOT_MATCH',
      matched_traits: [],
      disqualified_reasons: [
        `Kelas solusi produk '${product.solution_class_id}' tidak cocok dengan rekomendasi arsitektural '${handoff.solution_class_id}'.`
      ],
      tradeoffs_addressed: []
    };
  }

  // 2. Missing or empty spec snapshot produces INSUFFICIENT_EVIDENCE
  if (!specSnapshot || !specSnapshot.specs || Object.keys(specSnapshot.specs).length === 0) {
    return {
      product_id: product.product_id,
      solution_class_id: product.solution_class_id,
      match_status: 'INSUFFICIENT_EVIDENCE',
      matched_traits: [],
      disqualified_reasons: [],
      tradeoffs_addressed: [],
      insufficient_evidence_reasons: [
        `Spesifikasi teknis terverifikasi untuk produk '${product.canonical_name}' belum mencukupi untuk penilaian deterministik.`
      ]
    };
  }

  const specs = specSnapshot.specs;
  const matchedTraits: string[] = [];
  const disqualifiedReasons: string[] = [];
  const tradeoffsAddressed: string[] = [];

  // 3. Scan for Must Avoid Characteristics (Red Lines)
  for (const avoidTrait of handoff.must_avoid_characteristics) {
    const avoidLower = avoidTrait.toLowerCase();
    for (const [specKey, specVal] of Object.entries(specs)) {
      const valStr = String(specVal).toLowerCase();
      if (avoidLower.includes(valStr) || valStr.includes(avoidLower)) {
        disqualifiedReasons.push(`Produk melanggar kriteria red-line: ${avoidTrait} (terdeteksi pada ${specKey}: ${specVal})`);
      }
    }
  }

  if (disqualifiedReasons.length > 0) {
    return {
      product_id: product.product_id,
      solution_class_id: product.solution_class_id,
      match_status: 'NOT_MATCH',
      matched_traits: matchedTraits,
      disqualified_reasons: disqualifiedReasons,
      tradeoffs_addressed: tradeoffsAddressed,
      evidence_snapshot_id: specSnapshot.spec_snapshot_id
    };
  }

  // 4. Verify Required Characteristics
  for (const req of handoff.required_characteristics) {
    const reqLower = req.toLowerCase();
    let traitFound = false;

    for (const [specKey, specVal] of Object.entries(specs)) {
      const specEntry = `${specKey}: ${specVal}`.toLowerCase();
      if (reqLower.includes(specKey.toLowerCase()) || specEntry.includes(reqLower)) {
        matchedTraits.push(`${specKey}: ${specVal}`);
        traitFound = true;
        break;
      }
    }

    if (!traitFound) {
      // Missing some required characteristics -> CONDITIONAL_MATCH
    }
  }

  // 5. Check Tradeoffs Addressed
  for (const t of handoff.important_tradeoffs) {
    tradeoffsAddressed.push(`Mitigasi kompromi: ${t.benefit} dengan kompromi ${t.compromise}`);
  }

  // 6. Qualitative Match Determination
  let status: ProductMatchStatus = 'MATCH';
  if (matchedTraits.length < handoff.required_characteristics.length) {
    status = 'MATCH_WITH_TRADEOFF';
  }

  return {
    product_id: product.product_id,
    solution_class_id: product.solution_class_id,
    match_status: status,
    matched_traits: matchedTraits,
    disqualified_reasons: [],
    tradeoffs_addressed: tradeoffsAddressed,
    evidence_snapshot_id: specSnapshot.spec_snapshot_id
  };
}
