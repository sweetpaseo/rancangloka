-- ============================================================================
-- Migration: 0036_product_review_desk.sql
-- Description: Add Product Review Desk persistence foundation (Products, Variants,
--              Evidence Sources, Spec Snapshots, Review Snapshots, Offers,
--              Price Snapshots, Affiliate Destinations, Article Bindings)
-- Milestone: PRODUCT_REVIEW_AFFILIATE-1B
-- Invariants:
-- 1. EDITORIAL_DATA_IS_NOT_COMMERCE_DATA
-- 2. AFFILIATE_REVENUE_CANNOT_AFFECT_RECOMMENDATION
-- 3. SOURCE_URL_IS_NOT_AFFILIATE_DESTINATION
-- 4. PRICE_IS_NOT_IMMUTABLE_EDITORIAL_PROSE
-- 5. SNAPSHOTS_ARE_APPEND_ORIENTED_OBSERVATIONS
-- ============================================================================

-- 1. Table: product_review_products (Canonical editorial product identities - pure identity)
-- Permanent Invariant: EDITORIAL_REVIEW_STATE_MUST_NOT_MUTATE_PRODUCT_IDENTITY
CREATE TABLE IF NOT EXISTS product_review_products (
  product_id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL CHECK(length(canonical_name) > 0),
  brand TEXT NOT NULL CHECK(length(brand) > 0),
  category_id TEXT NOT NULL CHECK(length(category_id) > 0),
  solution_class_id TEXT NOT NULL CHECK(length(solution_class_id) > 0),
  identity_state TEXT NOT NULL CHECK(identity_state IN ('CURRENT', 'IDENTITY_CHANGED', 'VARIANT_CHANGED', 'LISTING_AMBIGUOUS', 'DISCONTINUED', 'UNAVAILABLE')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pr_products_solution_class ON product_review_products(solution_class_id);
CREATE INDEX IF NOT EXISTS idx_pr_products_identity_state ON product_review_products(identity_state);

-- 1b. Table: product_review_editorial_reviews (RancangLoka editorial review state & provenance)
-- Permanent Invariant: EDITORIAL_REVIEW_STATE_MUST_NOT_MUTATE_PRODUCT_IDENTITY
-- Permanent Invariant: TESTED_BY_RANCANGLOKA_REQUIRES_PRIMARY_TEST_PROVENANCE
CREATE TABLE IF NOT EXISTS product_review_editorial_reviews (
  review_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_id TEXT NULL,
  article_id INTEGER NULL,
  review_mode TEXT NOT NULL CHECK(review_mode IN ('ANALYTICAL_REVIEW', 'HANDS_ON_REVIEW')),
  tested_by_rancangloka INTEGER NOT NULL DEFAULT 0 CHECK(tested_by_rancangloka IN (0, 1)),
  testing_provenance_json TEXT NULL,
  editorial_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(editorial_status IN ('DRAFT', 'REVIEWED', 'PUBLISHED', 'ARCHIVED')),
  reviewed_at TEXT NULL,
  reviewer_identity TEXT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (product_id) REFERENCES product_review_products(product_id),
  FOREIGN KEY (variant_id) REFERENCES product_review_variants(variant_id),
  FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE INDEX IF NOT EXISTS idx_pr_ed_reviews_product ON product_review_editorial_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_pr_ed_reviews_mode ON product_review_editorial_reviews(review_mode);
CREATE INDEX IF NOT EXISTS idx_pr_ed_reviews_status ON product_review_editorial_reviews(editorial_status);
CREATE INDEX IF NOT EXISTS idx_pr_ed_reviews_article ON product_review_editorial_reviews(article_id);

-- 2. Table: product_review_variants (Physical SKU & configurations)
CREATE TABLE IF NOT EXISTS product_review_variants (
  variant_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  sku_or_model TEXT NOT NULL CHECK(length(sku_or_model) > 0),
  variant_name TEXT NOT NULL CHECK(length(variant_name) > 0),
  specific_specs_json TEXT NULL,
  identity_state TEXT NOT NULL CHECK(identity_state IN ('CURRENT', 'IDENTITY_CHANGED', 'VARIANT_CHANGED', 'LISTING_AMBIGUOUS', 'DISCONTINUED', 'UNAVAILABLE')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (product_id) REFERENCES product_review_products(product_id)
);

CREATE INDEX IF NOT EXISTS idx_pr_variants_product ON product_review_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_pr_variants_sku ON product_review_variants(sku_or_model);

-- 3. Table: product_review_evidence_sources (Factual & technical evidence provenance)
CREATE TABLE IF NOT EXISTS product_review_evidence_sources (
  source_id TEXT PRIMARY KEY,
  product_identity_reference TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('MANUFACTURER', 'OFFICIAL_MANUAL', 'TECHNICAL_DATASHEET', 'MERCHANT_LISTING', 'INDEPENDENT_REVIEW', 'USER_REVIEW_AGGREGATE', 'RANCANGLOKA_PRIMARY_TEST')),
  source_url TEXT NOT NULL CHECK(length(source_url) > 0),
  publisher TEXT NOT NULL CHECK(length(publisher) > 0),
  retrieved_at TEXT NOT NULL,
  evidence_scope TEXT NOT NULL,
  claim_class TEXT NOT NULL CHECK(claim_class IN ('VERIFIED_FACT', 'TECHNICAL_CONSENSUS', 'USER_EXPERIENCE_SIGNAL', 'EDITORIAL_INFERENCE', 'EDITORIAL_RECOMMENDATION')),
  source_fidelity TEXT NOT NULL CHECK(source_fidelity IN ('PRIMARY_DOCUMENT', 'SECONDARY_ANALYSIS', 'USER_OBSERVATION', 'MANUFACTURER_CLAIM')),
  testing_provenance_json TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (product_identity_reference) REFERENCES product_review_products(product_id)
);

CREATE INDEX IF NOT EXISTS idx_pr_evidence_product ON product_review_evidence_sources(product_identity_reference);
CREATE INDEX IF NOT EXISTS idx_pr_evidence_type ON product_review_evidence_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_pr_evidence_fidelity ON product_review_evidence_sources(source_fidelity);

-- 4. Table: product_review_spec_snapshots (Versioned, measured technical specifications)
CREATE TABLE IF NOT EXISTS product_review_spec_snapshots (
  spec_snapshot_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_id TEXT NULL,
  captured_at TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_fidelity TEXT NOT NULL CHECK(source_fidelity IN ('PRIMARY_DOCUMENT', 'SECONDARY_ANALYSIS', 'USER_OBSERVATION', 'MANUFACTURER_CLAIM')),
  specs_json TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (product_id) REFERENCES product_review_products(product_id),
  FOREIGN KEY (variant_id) REFERENCES product_review_variants(variant_id),
  FOREIGN KEY (source_id) REFERENCES product_review_evidence_sources(source_id)
);

CREATE INDEX IF NOT EXISTS idx_pr_specs_product ON product_review_spec_snapshots(product_id);
CREATE INDEX IF NOT EXISTS idx_pr_specs_variant ON product_review_spec_snapshots(variant_id);
CREATE INDEX IF NOT EXISTS idx_pr_specs_hash ON product_review_spec_snapshots(snapshot_hash);

-- 5. Table: product_review_review_snapshots (External user review signals - NOT verified facts)
CREATE TABLE IF NOT EXISTS product_review_review_snapshots (
  review_snapshot_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_id TEXT NULL,
  source_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  external_review_count INTEGER NOT NULL CHECK(external_review_count >= 0),
  external_rating REAL NULL,
  external_rating_max REAL NULL,
  source_label TEXT NOT NULL,
  recurring_themes_json TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (product_id) REFERENCES product_review_products(product_id),
  FOREIGN KEY (variant_id) REFERENCES product_review_variants(variant_id),
  FOREIGN KEY (source_id) REFERENCES product_review_evidence_sources(source_id)
);

CREATE INDEX IF NOT EXISTS idx_pr_reviews_product ON product_review_review_snapshots(product_id);
CREATE INDEX IF NOT EXISTS idx_pr_reviews_hash ON product_review_review_snapshots(snapshot_hash);

-- 6. Table: product_review_offers (Commercial merchant listings)
CREATE TABLE IF NOT EXISTS product_review_offers (
  offer_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_id TEXT NULL,
  merchant_id TEXT NOT NULL CHECK(length(merchant_id) > 0),
  merchant_name TEXT NOT NULL CHECK(length(merchant_name) > 0),
  listing_title TEXT NOT NULL CHECK(length(listing_title) > 0),
  listing_identity TEXT NOT NULL CHECK(length(listing_identity) > 0),
  listing_url TEXT NOT NULL CHECK(length(listing_url) > 0),
  current_availability TEXT NOT NULL CHECK(current_availability IN ('IN_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER', 'UNKNOWN')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (product_id) REFERENCES product_review_products(product_id),
  FOREIGN KEY (variant_id) REFERENCES product_review_variants(variant_id)
);

CREATE INDEX IF NOT EXISTS idx_pr_offers_product ON product_review_offers(product_id);
CREATE INDEX IF NOT EXISTS idx_pr_offers_variant ON product_review_offers(variant_id);
CREATE INDEX IF NOT EXISTS idx_pr_offers_merchant ON product_review_offers(merchant_id);

-- 7. Table: product_review_price_snapshots (Volatile price observations)
CREATE TABLE IF NOT EXISTS product_review_price_snapshots (
  price_snapshot_id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  currency TEXT NOT NULL CHECK(length(currency) > 0),
  observed_price REAL NOT NULL CHECK(observed_price >= 0),
  availability TEXT NOT NULL CHECK(availability IN ('IN_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER', 'UNKNOWN')),
  source_url TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (offer_id) REFERENCES product_review_offers(offer_id)
);

CREATE INDEX IF NOT EXISTS idx_pr_prices_offer ON product_review_price_snapshots(offer_id);
CREATE INDEX IF NOT EXISTS idx_pr_prices_hash ON product_review_price_snapshots(snapshot_hash);

-- 8. Table: product_review_affiliate_destinations (Outbound tracked links - strictly isolated from technical rankings)
CREATE TABLE IF NOT EXISTS product_review_affiliate_destinations (
  destination_id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(length(provider) > 0),
  affiliate_destination_url TEXT NOT NULL CHECK(length(affiliate_destination_url) > 0),
  tracking_metadata_json TEXT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (offer_id) REFERENCES product_review_offers(offer_id)
);

CREATE INDEX IF NOT EXISTS idx_pr_destinations_offer ON product_review_affiliate_destinations(offer_id);
CREATE INDEX IF NOT EXISTS idx_pr_destinations_active ON product_review_affiliate_destinations(is_active);

-- 9. Table: product_review_article_bindings (Connects editorial article to products)
CREATE TABLE IF NOT EXISTS product_review_article_bindings (
  binding_id TEXT PRIMARY KEY,
  article_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NULL,
  editorial_role TEXT NOT NULL CHECK(editorial_role IN ('PRIMARY_SUBJECT', 'ALTERNATIVE', 'EXAMPLE', 'MATCHED_PRODUCT', 'RELATED_PRODUCT')),
  section_anchor TEXT NULL,
  commercial_disclosure_json TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (article_id) REFERENCES articles(id),
  FOREIGN KEY (product_id) REFERENCES product_review_products(product_id),
  FOREIGN KEY (variant_id) REFERENCES product_review_variants(variant_id)
);

CREATE INDEX IF NOT EXISTS idx_pr_bindings_article ON product_review_article_bindings(article_id);
CREATE INDEX IF NOT EXISTS idx_pr_bindings_product ON product_review_article_bindings(product_id);
