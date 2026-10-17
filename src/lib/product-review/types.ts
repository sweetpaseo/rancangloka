/**
 * ============================================================================
 * RancangLoka Product Review Desk & Affiliate Firewall (PRODUCT_REVIEW_AFFILIATE-1A)
 * Pure Data Contracts & Entity Definitions
 * ============================================================================
 *
 * Permanent Principle:
 * "THE PRODUCT IS NOT THE CENTER OF THE ARTICLE.
 *  THE READER'S DECISION IS."
 *
 * Pipeline:
 * Reader Context
 *   → PDE Solution Class Decision
 *   → Product Review Desk
 *   → Product Match
 *   → Offer / Affiliate Destination
 *
 * Invariant:
 * AFFILIATE_REVENUE_CANNOT_AFFECT_RECOMMENDATION
 */

import type { ProductReviewHandoffContract } from '../product-decision/public-boundary.ts';

// ============================================================================
// 1. EDITORIAL REVIEW MODES & EVIDENCE TAXONOMY
// ============================================================================

/**
 * Editorial Review Mode:
 * - ANALYTICAL_REVIEW: Default mode based on technical physics, standard specs, and published documentation.
 *   Strictly forbidden from claiming "Tested by RancangLoka".
 * - HANDS_ON_REVIEW: Only permitted when actual primary physical testing was conducted by RancangLoka
 *   with documented testing provenance and primary test logs.
 */
export type ReviewMode = 'ANALYTICAL_REVIEW' | 'HANDS_ON_REVIEW';

/**
 * Epistemic claim classes for product review evidence.
 */
export type ReviewClaimClass =
  | 'VERIFIED_FACT'
  | 'TECHNICAL_CONSENSUS'
  | 'USER_EXPERIENCE_SIGNAL'
  | 'EDITORIAL_INFERENCE'
  | 'EDITORIAL_RECOMMENDATION';

/**
 * Source types for evidence gathering.
 */
export type EvidenceSourceType =
  | 'MANUFACTURER'
  | 'OFFICIAL_MANUAL'
  | 'TECHNICAL_DATASHEET'
  | 'MERCHANT_LISTING'
  | 'INDEPENDENT_REVIEW'
  | 'USER_REVIEW_AGGREGATE'
  | 'RANCANGLOKA_PRIMARY_TEST';

/**
 * Source fidelity levels.
 */
export type SourceFidelity =
  | 'PRIMARY_DOCUMENT'
  | 'SECONDARY_ANALYSIS'
  | 'USER_OBSERVATION'
  | 'MANUFACTURER_CLAIM';

/**
 * Product identity drift states when external listings or manufacturer specifications evolve.
 */
export type ProductIdentityState =
  | 'CURRENT'
  | 'IDENTITY_CHANGED'
  | 'VARIANT_CHANGED'
  | 'LISTING_AMBIGUOUS'
  | 'DISCONTINUED'
  | 'UNAVAILABLE';

/**
 * Qualitative match status for matching a product to a PDE solution class.
 * Strictly qualitative without arbitrary numeric scores.
 */
export type ProductMatchStatus =
  | 'MATCH'
  | 'MATCH_WITH_TRADEOFF'
  | 'CONDITIONAL_MATCH'
  | 'NOT_MATCH'
  | 'INSUFFICIENT_EVIDENCE';

/**
 * Editorial role of a product in an article.
 * Placement order does NOT equal recommendation rank.
 */
export type ArticleProductRole =
  | 'PRIMARY_SUBJECT'
  | 'ALTERNATIVE'
  | 'EXAMPLE'
  | 'MATCHED_PRODUCT'
  | 'RELATED_PRODUCT';

// ============================================================================
// 2. CORE ENTITIES
// ============================================================================

/**
 * Testing provenance required for HANDS_ON_REVIEW.
 */
export interface TestingProvenance {
  testing_date: string;
  tester_identity: string;
  testing_location: string;
  methodology_notes: string;
  raw_log_ref?: string;
}

/**
 * EvidenceSource represents a verifiable document, lab test, or specification reference.
 * Permanent invariant: SOURCE_URL_IS_NOT_AFFILIATE_DESTINATION.
 */
export interface EvidenceSource {
  source_id: string;
  source_type: EvidenceSourceType;
  /** Authoritative document or reference URL (independent of affiliate destination) */
  source_url: string;
  publisher: string;
  retrieved_at: string;
  evidence_scope: string;
  claim_class: ReviewClaimClass;
  source_fidelity: SourceFidelity;
  product_identity_reference: string;
  testing_provenance?: TestingProvenance;
}

/**
 * SpecSnapshot represents a point-in-time capture of structured technical specs.
 * Versioned so that manufacturer updates never silently overwrite historical technical truth.
 */
export interface SpecSnapshot {
  spec_snapshot_id: string;
  product_id: string;
  variant_id?: string;
  captured_at: string;
  source_id: string;
  /** Structured specs as key-value pairs (only measured/spec values actually provided) */
  specs: Record<string, string | number | boolean>;
  source_fidelity: SourceFidelity;
}

/**
 * PriceSnapshot represents volatile marketplace commerce observation.
 * Permanent invariant: PRICE_IS_NOT_IMMUTABLE_EDITORIAL_PROSE.
 */
export interface PriceSnapshot {
  price_snapshot_id: string;
  offer_id: string;
  captured_at: string;
  currency: string;
  observed_price: number;
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'PRE_ORDER' | 'UNKNOWN';
  source_url: string;
}

/**
 * ReviewSnapshot captures external customer reviews from marketplaces/dealers.
 * Permanent distinction: ReviewSnapshot != EditorialProductReview.
 * ReviewSnapshot represents external USER_EXPERIENCE_SIGNAL, not VERIFIED_FACT,
 * and is strictly distinct from RancangLoka's own EditorialProductReview.
 * Marketplace star ratings are external metadata, NOT RancangLoka scores.
 */
export interface ReviewSnapshot {
  review_snapshot_id: string;
  product_id: string;
  variant_id?: string;
  source_id: string;
  captured_at: string;
  external_review_count: number;
  external_rating?: number;
  external_rating_max?: number;
  source_label: string;
  recurring_themes: Array<{
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    topic: string;
    summary: string;
  }> | ReadonlyArray<{
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    topic: string;
    summary: string;
  }>;
}

/**
 * Variant represents a distinct physical configuration, dimension, finish, or sub-model.
 */
export interface Variant {
  variant_id: string;
  product_id: string;
  sku_or_model: string;
  variant_name: string;
  specific_specs?: Record<string, string | number | boolean>;
  identity_state: ProductIdentityState;
}

/**
 * Editorial review status lifecycle.
 */
export type EditorialReviewStatus =
  | 'DRAFT'
  | 'REVIEWED'
  | 'PUBLISHED'
  | 'ARCHIVED';

/**
 * EditorialProductReview represents RancangLoka's own editorial assessment of a product.
 * Independent of physical Product identity.
 * Permanent invariant: EDITORIAL_REVIEW_STATE_MUST_NOT_MUTATE_PRODUCT_IDENTITY.
 * Permanent invariant: TESTED_BY_RANCANGLOKA_REQUIRES_PRIMARY_TEST_PROVENANCE.
 */
export interface EditorialProductReview {
  review_id: string;
  product_id: string;
  variant_id?: string;
  article_id?: number;
  review_mode: ReviewMode;
  tested_by_rancangloka: boolean;
  testing_provenance?: TestingProvenance;
  editorial_status: EditorialReviewStatus;
  reviewed_at?: string;
  reviewer_identity?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Product represents canonical product identity independent from merchant offers
 * and independent from RancangLoka editorial review state.
 * Permanent invariant: PRODUCT_REPRESENTS_PURE_MANUFACTURED_IDENTITY.
 * EDITORIAL_REVIEW_STATE_MUST_NOT_MUTATE_PRODUCT_IDENTITY.
 */
export interface Product {
  product_id: string;
  brand: string;
  canonical_name: string;
  category_id: string;
  /** Must reference a valid PDE solution_class_id */
  solution_class_id: string;
  identity_state: ProductIdentityState;
  created_at?: string;
  updated_at?: string;
  variants?: Variant[] | readonly Variant[];
  spec_snapshots?: SpecSnapshot[] | readonly SpecSnapshot[];
  evidence_sources?: EvidenceSource[] | readonly EvidenceSource[];
  review_snapshots?: ReviewSnapshot[] | readonly ReviewSnapshot[];
}

/**
 * Offer represents a commercial listing from a specific merchant.
 * Changing seller or merchant listing MUST NOT alter canonical Product identity.
 */
export interface Offer {
  offer_id: string;
  product_id: string;
  variant_id?: string;
  merchant_id: string;
  merchant_name: string;
  listing_title: string;
  listing_identity: string;
  listing_url: string;
  current_availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'PRE_ORDER' | 'UNKNOWN';
  latest_price_snapshot?: PriceSnapshot;
}

/**
 * AffiliateDestination represents tracked outbound commercial metadata.
 * Completely separate from editorial evidence sources and technical matching.
 */
export interface AffiliateDestination {
  destination_id: string;
  offer_id: string;
  provider: string;
  affiliate_destination_url: string;
  tracking_metadata?: Record<string, string>;
  is_active: boolean;
}

/**
 * Commercial disclosure metadata for article product bindings.
 */
export interface CommercialDisclosure {
  has_affiliate_links: boolean;
  is_sponsored_content: boolean;
  is_product_supplied_by_brand: boolean;
  disclosure_statement: string;
}

/**
 * ArticleProductBinding binds a product to an article with an editorial role.
 */
export interface ArticleProductBinding {
  binding_id: string;
  article_id: number;
  product_id: string;
  variant_id?: string;
  editorial_role: ArticleProductRole;
  section_anchor?: string;
  commercial_disclosure: CommercialDisclosure;
}

/**
 * Image provenance tracking.
 */
export interface ProductImageProvenance {
  image_id: string;
  product_id: string;
  variant_id?: string;
  source_image_url: string;
  rights_type:
    | 'MANUFACTURER_PRESS_KIT'
    | 'MERCHANT_LISTING_UNVERIFIED'
    | 'RANCANGLOKA_ORIGINAL_PHOTO'
    | 'PUBLIC_DOMAIN';
  retrieved_at: string;
  photographer_or_license?: string;
}

// ============================================================================
// 3. PRODUCT MATCHING & TECHNICAL DECISION CONTRACTS
// ============================================================================

/**
 * Technical match result when evaluating a Product against a PDE Handoff.
 */
export interface ProductMatchResult {
  product_id: string;
  solution_class_id: string;
  match_status: ProductMatchStatus;
  matched_traits: string[];
  disqualified_reasons: string[];
  tradeoffs_addressed: string[];
  insufficient_evidence_reasons?: string[];
  evidence_snapshot_id?: string;
}

/**
 * Re-export PDE Handoff contract for explicit consumption.
 */
export type { ProductReviewHandoffContract };
