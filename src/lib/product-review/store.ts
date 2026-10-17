/**
 * ============================================================================
 * RancangLoka Product Review Desk (PRODUCT_REVIEW_AFFILIATE-1B)
 * Authoritative Storage Adapter & Technical Match Input Assembler
 *
 * Invariants:
 * 1. EDITORIAL_DATA_IS_NOT_COMMERCE_DATA
 *    (Technical & editorial tables are segregated from commercial & affiliate tables).
 * 2. COMMERCE_CHANGE_MUST_NOT_MUTATE_EDITORIAL_IDENTITY
 *    (Changing merchant, price, or affiliate destination never mutates Product/Variant).
 * 3. SNAPSHOTS_ARE_APPEND_ORIENTED_OBSERVATIONS
 *    (Spec, price, and review snapshots are immutable historical records, never updated in place).
 * 4. TECHNICAL_MATCH_INPUT_MUST_BE_COMMERCE_BLIND
 *    (The technical match assembler strictly refuses and strips all commercial data).
 * 5. IDEMPOTENT_INSERTION_AND_CONFLICT_DETECTION
 *    (Identical re-insertions return ALREADY_EXISTS_IDENTICAL; divergent collisions return BLOCKED_CONFLICT).
 * ============================================================================
 */

import { createHash } from 'node:crypto';
import type {
  Product,
  Variant,
  EvidenceSource,
  SpecSnapshot,
  ReviewSnapshot,
  Offer,
  PriceSnapshot,
  AffiliateDestination,
  ArticleProductBinding,
  CommercialDisclosure,
  ProductIdentityState,
  ReviewMode,
  TestingProvenance,
  SourceFidelity
} from './types.ts';
import {
  validateProduct,
  validateVariant,
  validateEvidenceSource,
  validateSpecSnapshot,
  validateReviewSnapshot,
  validateOffer,
  validatePriceSnapshot,
  validateAffiliateDestination,
  validateArticleProductBinding,
  scanForForbiddenReviewCommerceFields
} from './contracts.ts';

// ============================================================================
// DETERMINISTIC HASH COMPUTATION FOR SNAPSHOTS
// ============================================================================

export function computeSpecSnapshotHash(snapshot: SpecSnapshot): string {
  const sortedSpecs: Record<string, any> = {};
  for (const key of Object.keys(snapshot.specs).sort()) {
    sortedSpecs[key] = snapshot.specs[key];
  }

  const payload = {
    product_id: snapshot.product_id,
    variant_id: snapshot.variant_id ?? null,
    captured_at: snapshot.captured_at,
    source_id: snapshot.source_id,
    source_fidelity: snapshot.source_fidelity,
    specs: sortedSpecs
  };

  return createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}

export function computeReviewSnapshotHash(snapshot: ReviewSnapshot): string {
  const canonicalThemes = [...snapshot.recurring_themes].map(t => ({
    sentiment: t.sentiment,
    topic: t.topic,
    summary: t.summary
  })).sort((a, b) => a.topic.localeCompare(b.topic));

  const payload = {
    product_id: snapshot.product_id,
    variant_id: snapshot.variant_id ?? null,
    captured_at: snapshot.captured_at,
    source_id: snapshot.source_id,
    external_review_count: snapshot.external_review_count,
    external_rating: snapshot.external_rating ?? null,
    external_rating_max: snapshot.external_rating_max ?? null,
    source_label: snapshot.source_label,
    recurring_themes: canonicalThemes
  };

  return createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}

export function computePriceSnapshotHash(snapshot: PriceSnapshot): string {
  const payload = {
    offer_id: snapshot.offer_id,
    captured_at: snapshot.captured_at,
    currency: snapshot.currency,
    observed_price: snapshot.observed_price,
    availability: snapshot.availability,
    source_url: snapshot.source_url
  };

  return createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}

// ============================================================================
// TECHNICAL MATCH INPUT ASSEMBLER (COMMERCE-BLIND DTO BOUNDARY)
// ============================================================================

export interface TechnicalMatchInputDTO {
  product_id: string;
  canonical_name: string;
  brand: string;
  solution_class_id: string;
  review_mode: ReviewMode;
  tested_by_rancangloka: boolean;
  testing_provenance?: TestingProvenance;
  variant_id?: string;
  sku_or_model?: string;
  specs: Record<string, string | number | boolean>;
  source_fidelity: SourceFidelity;
  verified_claims: string[];
}

/**
 * Assembles a pure, commerce-blind TechnicalMatchInputDTO for technical evaluation.
 * Throws an invariant violation error if ANY commercial field is passed in.
 */
export function assembleTechnicalMatchInput(params: {
  product: Product;
  variant?: Variant;
  specSnapshot: SpecSnapshot;
  evidenceSources: EvidenceSource[] | readonly EvidenceSource[];
  [key: string]: any;
}): TechnicalMatchInputDTO {
  // 1. Strict commercial firewall scan on the entire input object
  const forbiddenFields = scanForForbiddenReviewCommerceFields(params);
  if (forbiddenFields.length > 0) {
    throw new Error(
      `TECHNICAL_MATCH_INPUT_COMMERCE_CONTAMINATION: Technical match input must be strictly commerce-blind. Detected forbidden fields: ${forbiddenFields.join(', ')}`
    );
  }

  // 2. Validate product and spec entities
  const productValidation = validateProduct(params.product);
  if (!productValidation.valid) {
    throw new Error(`Invalid Product in assembleTechnicalMatchInput: ${productValidation.issues.map(i => i.message).join(', ')}`);
  }

  const specValidation = validateSpecSnapshot(params.specSnapshot);
  if (!specValidation.valid) {
    throw new Error(`Invalid SpecSnapshot in assembleTechnicalMatchInput: ${specValidation.issues.map(i => i.message).join(', ')}`);
  }

  // 3. Extract verified claims from authoritative evidence sources
  const verifiedClaims: string[] = [];
  for (const src of params.evidenceSources) {
    if (src.claim_class === 'VERIFIED_FACT' || src.claim_class === 'TECHNICAL_CONSENSUS') {
      verifiedClaims.push(`${src.evidence_scope}: ${src.publisher}`);
    }
  }

  return {
    product_id: params.product.product_id,
    canonical_name: params.product.canonical_name,
    brand: params.product.brand,
    solution_class_id: params.product.solution_class_id,
    review_mode: params.product.review_mode,
    tested_by_rancangloka: params.product.tested_by_rancangloka,
    testing_provenance: params.product.testing_provenance,
    variant_id: params.variant?.variant_id,
    sku_or_model: params.variant?.sku_or_model,
    specs: { ...params.specSnapshot.specs },
    source_fidelity: params.specSnapshot.source_fidelity,
    verified_claims: verifiedClaims
  };
}

// ============================================================================
// STORE OPERATIONS (D1 / SQLITE COMPATIBLE)
// ============================================================================

export type StoreOpResult =
  | { status: 'INSERTED'; id: string }
  | { status: 'UPDATED'; id: string }
  | { status: 'ALREADY_EXISTS_IDENTICAL'; id: string }
  | { status: 'BLOCKED_SNAPSHOT_CONFLICT'; id: string; existing_hash: string; candidate_hash: string }
  | { status: 'BLOCKED_VALIDATION_FAILED'; issues: Array<{ code: string; field: string; message: string }> };

/**
 * Inserts a canonical Product record.
 */
export async function insertProduct(
  db: any,
  product: Product
): Promise<StoreOpResult> {
  const validation = validateProduct(product);
  if (!validation.valid) {
    return { status: 'BLOCKED_VALIDATION_FAILED', issues: validation.issues };
  }

  const existing = await db
    .prepare('SELECT product_id, canonical_name, brand, category_id, solution_class_id, identity_state, review_mode FROM product_review_products WHERE product_id = ?')
    .bind(product.product_id)
    .first();

  if (existing) {
    if (
      existing.canonical_name === product.canonical_name &&
      existing.brand === product.brand &&
      existing.solution_class_id === product.solution_class_id &&
      existing.review_mode === product.review_mode
    ) {
      return { status: 'ALREADY_EXISTS_IDENTICAL', id: product.product_id };
    }
    return {
      status: 'BLOCKED_SNAPSHOT_CONFLICT',
      id: product.product_id,
      existing_hash: existing.canonical_name,
      candidate_hash: product.canonical_name
    };
  }

  const now = new Date().toISOString();

  await db
    .prepare(`
      INSERT INTO product_review_products (
        product_id, canonical_name, brand, category_id, solution_class_id,
        identity_state, review_mode, tested_by_rancangloka,
        testing_provenance_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      product.product_id,
      product.canonical_name,
      product.brand,
      product.category_id,
      product.solution_class_id,
      product.identity_state,
      product.review_mode,
      product.tested_by_rancangloka ? 1 : 0,
      product.testing_provenance ? JSON.stringify(product.testing_provenance) : null,
      now,
      now
    )
    .run();

  return { status: 'INSERTED', id: product.product_id };
}

/**
 * Retrieves a canonical Product by product_id.
 */
export async function getProduct(db: any, productId: string): Promise<Product | null> {
  const row = await db
    .prepare('SELECT * FROM product_review_products WHERE product_id = ?')
    .bind(productId)
    .first();

  if (!row) return null;

  const variants = await getVariantsByProduct(db, productId);
  const evidenceSources = await getEvidenceSourcesByProduct(db, productId);
  const specSnapshots = await getSpecSnapshotsByProduct(db, productId);
  const reviewSnapshots = await getReviewSnapshotsByProduct(db, productId);

  return {
    product_id: row.product_id,
    canonical_name: row.canonical_name,
    brand: row.brand,
    category_id: row.category_id,
    solution_class_id: row.solution_class_id,
    identity_state: row.identity_state,
    review_mode: row.review_mode,
    tested_by_rancangloka: Boolean(row.tested_by_rancangloka),
    testing_provenance: row.testing_provenance_json ? JSON.parse(row.testing_provenance_json) : undefined,
    variants,
    spec_snapshots: specSnapshots,
    evidence_sources: evidenceSources,
    review_snapshots: reviewSnapshots
  };
}

/**
 * Updates a product's identity drift / lifecycle state.
 */
export async function updateProductIdentityState(
  db: any,
  productId: string,
  newState: ProductIdentityState
): Promise<boolean> {
  const result = await db
    .prepare('UPDATE product_review_products SET identity_state = ?, updated_at = ? WHERE product_id = ?')
    .bind(newState, new Date().toISOString(), productId)
    .run();

  return (result?.meta?.changes ?? 0) > 0;
}

/**
 * Inserts a Variant record.
 */
export async function insertVariant(
  db: any,
  variant: Variant
): Promise<StoreOpResult> {
  const validation = validateVariant(variant);
  if (!validation.valid) {
    return { status: 'BLOCKED_VALIDATION_FAILED', issues: validation.issues };
  }

  const existing = await db
    .prepare('SELECT variant_id, sku_or_model FROM product_review_variants WHERE variant_id = ?')
    .bind(variant.variant_id)
    .first();

  if (existing) {
    if (existing.sku_or_model === variant.sku_or_model) {
      return { status: 'ALREADY_EXISTS_IDENTICAL', id: variant.variant_id };
    }
    return {
      status: 'BLOCKED_SNAPSHOT_CONFLICT',
      id: variant.variant_id,
      existing_hash: existing.sku_or_model,
      candidate_hash: variant.sku_or_model
    };
  }

  await db
    .prepare(`
      INSERT INTO product_review_variants (
        variant_id, product_id, sku_or_model, variant_name,
        specific_specs_json, identity_state, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      variant.variant_id,
      variant.product_id,
      variant.sku_or_model,
      variant.variant_name,
      variant.specific_specs ? JSON.stringify(variant.specific_specs) : null,
      variant.identity_state,
      new Date().toISOString()
    )
    .run();

  return { status: 'INSERTED', id: variant.variant_id };
}

/**
 * Retrieves all variants for a given product.
 */
export async function getVariantsByProduct(db: any, productId: string): Promise<Variant[]> {
  const { results } = await db
    .prepare('SELECT * FROM product_review_variants WHERE product_id = ? ORDER BY variant_name ASC')
    .bind(productId)
    .all();

  return (results || []).map((row: any) => ({
    variant_id: row.variant_id,
    product_id: row.product_id,
    sku_or_model: row.sku_or_model,
    variant_name: row.variant_name,
    specific_specs: row.specific_specs_json ? JSON.parse(row.specific_specs_json) : undefined,
    identity_state: row.identity_state
  }));
}

/**
 * Inserts an EvidenceSource record.
 */
export async function insertEvidenceSource(
  db: any,
  source: EvidenceSource
): Promise<StoreOpResult> {
  const validation = validateEvidenceSource(source);
  if (!validation.valid) {
    return { status: 'BLOCKED_VALIDATION_FAILED', issues: validation.issues };
  }

  const existing = await db
    .prepare('SELECT source_id, source_url FROM product_review_evidence_sources WHERE source_id = ?')
    .bind(source.source_id)
    .first();

  if (existing) {
    if (existing.source_url === source.source_url) {
      return { status: 'ALREADY_EXISTS_IDENTICAL', id: source.source_id };
    }
    return {
      status: 'BLOCKED_SNAPSHOT_CONFLICT',
      id: source.source_id,
      existing_hash: existing.source_url,
      candidate_hash: source.source_url
    };
  }

  await db
    .prepare(`
      INSERT INTO product_review_evidence_sources (
        source_id, product_identity_reference, source_type, source_url, publisher,
        retrieved_at, evidence_scope, claim_class, source_fidelity,
        testing_provenance_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      source.source_id,
      source.product_identity_reference,
      source.source_type,
      source.source_url,
      source.publisher,
      source.retrieved_at,
      source.evidence_scope,
      source.claim_class,
      source.source_fidelity,
      source.testing_provenance ? JSON.stringify(source.testing_provenance) : null,
      new Date().toISOString()
    )
    .run();

  return { status: 'INSERTED', id: source.source_id };
}

/**
 * Retrieves all evidence sources for a product.
 */
export async function getEvidenceSourcesByProduct(db: any, productId: string): Promise<EvidenceSource[]> {
  const { results } = await db
    .prepare('SELECT * FROM product_review_evidence_sources WHERE product_identity_reference = ? ORDER BY created_at ASC')
    .bind(productId)
    .all();

  return (results || []).map((row: any) => ({
    source_id: row.source_id,
    product_identity_reference: row.product_identity_reference,
    source_type: row.source_type,
    source_url: row.source_url,
    publisher: row.publisher,
    retrieved_at: row.retrieved_at,
    evidence_scope: row.evidence_scope,
    claim_class: row.claim_class,
    source_fidelity: row.source_fidelity,
    testing_provenance: row.testing_provenance_json ? JSON.parse(row.testing_provenance_json) : undefined
  }));
}

/**
 * Appends an immutable SpecSnapshot observation.
 */
export async function appendSpecSnapshot(
  db: any,
  snapshot: SpecSnapshot
): Promise<StoreOpResult> {
  const validation = validateSpecSnapshot(snapshot);
  if (!validation.valid) {
    return { status: 'BLOCKED_VALIDATION_FAILED', issues: validation.issues };
  }

  const snapshotHash = computeSpecSnapshotHash(snapshot);

  const existing = await db
    .prepare('SELECT spec_snapshot_id, snapshot_hash FROM product_review_spec_snapshots WHERE spec_snapshot_id = ?')
    .bind(snapshot.spec_snapshot_id)
    .first();

  if (existing) {
    if (existing.snapshot_hash === snapshotHash) {
      return { status: 'ALREADY_EXISTS_IDENTICAL', id: snapshot.spec_snapshot_id };
    }
    return {
      status: 'BLOCKED_SNAPSHOT_CONFLICT',
      id: snapshot.spec_snapshot_id,
      existing_hash: existing.snapshot_hash,
      candidate_hash: snapshotHash
    };
  }

  await db
    .prepare(`
      INSERT INTO product_review_spec_snapshots (
        spec_snapshot_id, product_id, variant_id, captured_at, source_id,
        source_fidelity, specs_json, snapshot_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      snapshot.spec_snapshot_id,
      snapshot.product_id,
      snapshot.variant_id ?? null,
      snapshot.captured_at,
      snapshot.source_id,
      snapshot.source_fidelity,
      JSON.stringify(snapshot.specs),
      snapshotHash,
      new Date().toISOString()
    )
    .run();

  return { status: 'INSERTED', id: snapshot.spec_snapshot_id };
}

/**
 * Retrieves the latest SpecSnapshot for a product/variant.
 */
export async function getLatestSpecSnapshot(
  db: any,
  productId: string,
  variantId?: string
): Promise<SpecSnapshot | null> {
  let query = 'SELECT * FROM product_review_spec_snapshots WHERE product_id = ?';
  const params: any[] = [productId];

  if (variantId) {
    query += ' AND (variant_id = ? OR variant_id IS NULL)';
    params.push(variantId);
  }

  query += ' ORDER BY captured_at DESC LIMIT 1';

  const row = await db.prepare(query).bind(...params).first();
  if (!row) return null;

  return {
    spec_snapshot_id: row.spec_snapshot_id,
    product_id: row.product_id,
    variant_id: row.variant_id ?? undefined,
    captured_at: row.captured_at,
    source_id: row.source_id,
    source_fidelity: row.source_fidelity,
    specs: JSON.parse(row.specs_json)
  };
}

/**
 * Retrieves all SpecSnapshots for a product.
 */
export async function getSpecSnapshotsByProduct(db: any, productId: string): Promise<SpecSnapshot[]> {
  const { results } = await db
    .prepare('SELECT * FROM product_review_spec_snapshots WHERE product_id = ? ORDER BY captured_at DESC')
    .bind(productId)
    .all();

  return (results || []).map((row: any) => ({
    spec_snapshot_id: row.spec_snapshot_id,
    product_id: row.product_id,
    variant_id: row.variant_id ?? undefined,
    captured_at: row.captured_at,
    source_id: row.source_id,
    source_fidelity: row.source_fidelity,
    specs: JSON.parse(row.specs_json)
  }));
}

/**
 * Appends an immutable ReviewSnapshot observation.
 */
export async function appendReviewSnapshot(
  db: any,
  snapshot: ReviewSnapshot
): Promise<StoreOpResult> {
  const validation = validateReviewSnapshot(snapshot);
  if (!validation.valid) {
    return { status: 'BLOCKED_VALIDATION_FAILED', issues: validation.issues };
  }

  const snapshotHash = computeReviewSnapshotHash(snapshot);

  const existing = await db
    .prepare('SELECT review_snapshot_id, snapshot_hash FROM product_review_review_snapshots WHERE review_snapshot_id = ?')
    .bind(snapshot.review_snapshot_id)
    .first();

  if (existing) {
    if (existing.snapshot_hash === snapshotHash) {
      return { status: 'ALREADY_EXISTS_IDENTICAL', id: snapshot.review_snapshot_id };
    }
    return {
      status: 'BLOCKED_SNAPSHOT_CONFLICT',
      id: snapshot.review_snapshot_id,
      existing_hash: existing.snapshot_hash,
      candidate_hash: snapshotHash
    };
  }

  await db
    .prepare(`
      INSERT INTO product_review_review_snapshots (
        review_snapshot_id, product_id, variant_id, captured_at, source_id,
        external_review_count, external_rating, external_rating_max,
        source_label, recurring_themes_json, snapshot_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      snapshot.review_snapshot_id,
      snapshot.product_id,
      snapshot.variant_id ?? null,
      snapshot.captured_at,
      snapshot.source_id,
      snapshot.external_review_count,
      snapshot.external_rating ?? null,
      snapshot.external_rating_max ?? null,
      snapshot.source_label,
      JSON.stringify(snapshot.recurring_themes),
      snapshotHash,
      new Date().toISOString()
    )
    .run();

  return { status: 'INSERTED', id: snapshot.review_snapshot_id };
}

/**
 * Retrieves the latest ReviewSnapshot for a product/variant.
 */
export async function getLatestReviewSnapshot(
  db: any,
  productId: string,
  variantId?: string
): Promise<ReviewSnapshot | null> {
  let query = 'SELECT * FROM product_review_review_snapshots WHERE product_id = ?';
  const params: any[] = [productId];

  if (variantId) {
    query += ' AND (variant_id = ? OR variant_id IS NULL)';
    params.push(variantId);
  }

  query += ' ORDER BY captured_at DESC LIMIT 1';

  const row = await db.prepare(query).bind(...params).first();
  if (!row) return null;

  return {
    review_snapshot_id: row.review_snapshot_id,
    product_id: row.product_id,
    variant_id: row.variant_id ?? undefined,
    captured_at: row.captured_at,
    source_id: row.source_id,
    external_review_count: row.external_review_count,
    external_rating: row.external_rating ?? undefined,
    external_rating_max: row.external_rating_max ?? undefined,
    source_label: row.source_label,
    recurring_themes: JSON.parse(row.recurring_themes_json)
  };
}

/**
 * Retrieves all ReviewSnapshots for a product.
 */
export async function getReviewSnapshotsByProduct(db: any, productId: string): Promise<ReviewSnapshot[]> {
  const { results } = await db
    .prepare('SELECT * FROM product_review_review_snapshots WHERE product_id = ? ORDER BY captured_at DESC')
    .bind(productId)
    .all();

  return (results || []).map((row: any) => ({
    review_snapshot_id: row.review_snapshot_id,
    product_id: row.product_id,
    variant_id: row.variant_id ?? undefined,
    captured_at: row.captured_at,
    source_id: row.source_id,
    external_review_count: row.external_review_count,
    external_rating: row.external_rating ?? undefined,
    external_rating_max: row.external_rating_max ?? undefined,
    source_label: row.source_label,
    recurring_themes: JSON.parse(row.recurring_themes_json)
  }));
}

/**
 * Upserts a commercial Offer record.
 */
export async function upsertOffer(
  db: any,
  offer: Offer
): Promise<StoreOpResult> {
  const validation = validateOffer(offer);
  if (!validation.valid) {
    return { status: 'BLOCKED_VALIDATION_FAILED', issues: validation.issues };
  }

  const existing = await db
    .prepare('SELECT offer_id FROM product_review_offers WHERE offer_id = ?')
    .bind(offer.offer_id)
    .first();

  const now = new Date().toISOString();

  if (existing) {
    await db
      .prepare(`
        UPDATE product_review_offers SET
          merchant_name = ?,
          listing_title = ?,
          listing_identity = ?,
          listing_url = ?,
          current_availability = ?,
          updated_at = ?
        WHERE offer_id = ?
      `)
      .bind(
        offer.merchant_name,
        offer.listing_title,
        offer.listing_identity,
        offer.listing_url,
        offer.current_availability,
        now,
        offer.offer_id
      )
      .run();

    return { status: 'UPDATED', id: offer.offer_id };
  }

  await db
    .prepare(`
      INSERT INTO product_review_offers (
        offer_id, product_id, variant_id, merchant_id, merchant_name,
        listing_title, listing_identity, listing_url, current_availability,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      offer.offer_id,
      offer.product_id,
      offer.variant_id ?? null,
      offer.merchant_id,
      offer.merchant_name,
      offer.listing_title,
      offer.listing_identity,
      offer.listing_url,
      offer.current_availability,
      now,
      now
    )
    .run();

  return { status: 'INSERTED', id: offer.offer_id };
}

/**
 * Retrieves all offers for a product.
 */
export async function getOffersByProduct(db: any, productId: string): Promise<Offer[]> {
  const { results } = await db
    .prepare('SELECT * FROM product_review_offers WHERE product_id = ? ORDER BY merchant_name ASC')
    .bind(productId)
    .all();

  return (results || []).map((row: any) => ({
    offer_id: row.offer_id,
    product_id: row.product_id,
    variant_id: row.variant_id ?? undefined,
    merchant_id: row.merchant_id,
    merchant_name: row.merchant_name,
    listing_title: row.listing_title,
    listing_identity: row.listing_identity,
    listing_url: row.listing_url,
    current_availability: row.current_availability
  }));
}

/**
 * Appends an immutable PriceSnapshot observation.
 */
export async function appendPriceSnapshot(
  db: any,
  snapshot: PriceSnapshot
): Promise<StoreOpResult> {
  const validation = validatePriceSnapshot(snapshot);
  if (!validation.valid) {
    return { status: 'BLOCKED_VALIDATION_FAILED', issues: validation.issues };
  }

  const snapshotHash = computePriceSnapshotHash(snapshot);

  const existing = await db
    .prepare('SELECT price_snapshot_id, snapshot_hash FROM product_review_price_snapshots WHERE price_snapshot_id = ?')
    .bind(snapshot.price_snapshot_id)
    .first();

  if (existing) {
    if (existing.snapshot_hash === snapshotHash) {
      return { status: 'ALREADY_EXISTS_IDENTICAL', id: snapshot.price_snapshot_id };
    }
    return {
      status: 'BLOCKED_SNAPSHOT_CONFLICT',
      id: snapshot.price_snapshot_id,
      existing_hash: existing.snapshot_hash,
      candidate_hash: snapshotHash
    };
  }

  await db
    .prepare(`
      INSERT INTO product_review_price_snapshots (
        price_snapshot_id, offer_id, captured_at, currency, observed_price,
        availability, source_url, snapshot_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      snapshot.price_snapshot_id,
      snapshot.offer_id,
      snapshot.captured_at,
      snapshot.currency,
      snapshot.observed_price,
      snapshot.availability,
      snapshot.source_url,
      snapshotHash,
      new Date().toISOString()
    )
    .run();

  return { status: 'INSERTED', id: snapshot.price_snapshot_id };
}

/**
 * Retrieves the latest PriceSnapshot for a given offer.
 */
export async function getLatestPriceSnapshot(db: any, offerId: string): Promise<PriceSnapshot | null> {
  const row = await db
    .prepare('SELECT * FROM product_review_price_snapshots WHERE offer_id = ? ORDER BY captured_at DESC LIMIT 1')
    .bind(offerId)
    .first();

  if (!row) return null;

  return {
    price_snapshot_id: row.price_snapshot_id,
    offer_id: row.offer_id,
    captured_at: row.captured_at,
    currency: row.currency,
    observed_price: row.observed_price,
    availability: row.availability,
    source_url: row.source_url
  };
}

/**
 * Inserts an AffiliateDestination record.
 */
export async function insertAffiliateDestination(
  db: any,
  destination: AffiliateDestination
): Promise<StoreOpResult> {
  const validation = validateAffiliateDestination(destination);
  if (!validation.valid) {
    return { status: 'BLOCKED_VALIDATION_FAILED', issues: validation.issues };
  }

  const existing = await db
    .prepare('SELECT destination_id, affiliate_destination_url FROM product_review_affiliate_destinations WHERE destination_id = ?')
    .bind(destination.destination_id)
    .first();

  if (existing) {
    if (existing.affiliate_destination_url === destination.affiliate_destination_url) {
      return { status: 'ALREADY_EXISTS_IDENTICAL', id: destination.destination_id };
    }
    return {
      status: 'BLOCKED_SNAPSHOT_CONFLICT',
      id: destination.destination_id,
      existing_hash: existing.affiliate_destination_url,
      candidate_hash: destination.affiliate_destination_url
    };
  }

  const now = new Date().toISOString();

  await db
    .prepare(`
      INSERT INTO product_review_affiliate_destinations (
        destination_id, offer_id, provider, affiliate_destination_url,
        tracking_metadata_json, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      destination.destination_id,
      destination.offer_id,
      destination.provider,
      destination.affiliate_destination_url,
      destination.tracking_metadata ? JSON.stringify(destination.tracking_metadata) : null,
      destination.is_active ? 1 : 0,
      now,
      now
    )
    .run();

  return { status: 'INSERTED', id: destination.destination_id };
}

/**
 * Retrieves all affiliate destinations for an offer.
 */
export async function getAffiliateDestinationsByOffer(db: any, offerId: string): Promise<AffiliateDestination[]> {
  const { results } = await db
    .prepare('SELECT * FROM product_review_affiliate_destinations WHERE offer_id = ? ORDER BY is_active DESC, created_at ASC')
    .bind(offerId)
    .all();

  return (results || []).map((row: any) => ({
    destination_id: row.destination_id,
    offer_id: row.offer_id,
    provider: row.provider,
    affiliate_destination_url: row.affiliate_destination_url,
    tracking_metadata: row.tracking_metadata_json ? JSON.parse(row.tracking_metadata_json) : undefined,
    is_active: Boolean(row.is_active)
  }));
}

/**
 * Inserts an ArticleProductBinding.
 */
export async function insertArticleProductBinding(
  db: any,
  binding: ArticleProductBinding
): Promise<StoreOpResult> {
  const validation = validateArticleProductBinding(binding);
  if (!validation.valid) {
    return { status: 'BLOCKED_VALIDATION_FAILED', issues: validation.issues };
  }

  const existing = await db
    .prepare('SELECT binding_id, editorial_role FROM product_review_article_bindings WHERE binding_id = ?')
    .bind(binding.binding_id)
    .first();

  if (existing) {
    if (existing.editorial_role === binding.editorial_role) {
      return { status: 'ALREADY_EXISTS_IDENTICAL', id: binding.binding_id };
    }
    return {
      status: 'BLOCKED_SNAPSHOT_CONFLICT',
      id: binding.binding_id,
      existing_hash: existing.editorial_role,
      candidate_hash: binding.editorial_role
    };
  }

  await db
    .prepare(`
      INSERT INTO product_review_article_bindings (
        binding_id, article_id, product_id, variant_id,
        editorial_role, section_anchor, commercial_disclosure_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      binding.binding_id,
      binding.article_id,
      binding.product_id,
      binding.variant_id ?? null,
      binding.editorial_role,
      binding.section_anchor ?? null,
      JSON.stringify(binding.commercial_disclosure),
      new Date().toISOString()
    )
    .run();

  return { status: 'INSERTED', id: binding.binding_id };
}

/**
 * Retrieves all product bindings for an article.
 */
export async function getBindingsByArticle(db: any, articleId: number): Promise<ArticleProductBinding[]> {
  const { results } = await db
    .prepare('SELECT * FROM product_review_article_bindings WHERE article_id = ? ORDER BY created_at ASC')
    .bind(articleId)
    .all();

  return (results || []).map((row: any) => ({
    binding_id: row.binding_id,
    article_id: row.article_id,
    product_id: row.product_id,
    variant_id: row.variant_id ?? undefined,
    editorial_role: row.editorial_role,
    section_anchor: row.section_anchor ?? undefined,
    commercial_disclosure: JSON.parse(row.commercial_disclosure_json)
  }));
}
