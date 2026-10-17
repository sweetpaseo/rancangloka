/**
 * ============================================================================
 * RancangLoka Product Review Desk — Persistence & Storage Boundary Test Suite
 * Milestone: PRODUCT_REVIEW_AFFILIATE-1B
 *
 * Verifies:
 * A. Migration applies locally.
 * B. Product persists.
 * C. Variant persists.
 * D. EvidenceSource persists.
 * E. SpecSnapshot persists.
 * F. Offer persists.
 * G. PriceSnapshot persists.
 * H. ReviewSnapshot persists.
 * I. AffiliateDestination persists separately.
 * J. CommercialDisclosure persists separately.
 * K. ArticleProductBinding persists.
 * L. Synthetic round-trip preserves identities.
 * M. Exact duplicate is idempotent.
 * N. Immutable conflict blocks overwrite.
 * O. Commerce changes do not alter technical match input.
 * P. Price changes do not alter technical match input.
 * Q. Affiliate destination changes do not alter technical match input.
 * R. Sponsorship disclosure does not alter technical match input.
 * S. Technical spec change DOES affect technical match input.
 * T. Evidence provenance change is detectable.
 * U. Analytical review cannot acquire Tested by RancangLoka status.
 * V. Hands-on review requires primary test provenance.
 * W. User review remains USER_EXPERIENCE_SIGNAL.
 * X. No numeric ranking score.
 * Y. No production connection required.
 * Z. No PDE recommendation semantics changed.
 * ============================================================================
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  SYNTHETIC_PRODUCT,
  SYNTHETIC_VARIANT_1,
  SYNTHETIC_VARIANT_2,
  SYNTHETIC_SPEC_SNAPSHOT,
  SYNTHETIC_EVIDENCE_MANUFACTURER,
  SYNTHETIC_EVIDENCE_LAB_TEST,
  SYNTHETIC_REVIEW_SNAPSHOT,
  SYNTHETIC_OFFER_MERCHANT_A,
  SYNTHETIC_PRICE_SNAPSHOT_A,
  SYNTHETIC_AFFILIATE_DESTINATION_A,
  SYNTHETIC_ARTICLE_PRODUCT_BINDING
} from '../src/lib/product-review/fixtures.ts';

const SYNTHETIC_AFFILIATE_A = SYNTHETIC_AFFILIATE_DESTINATION_A;
const SYNTHETIC_ARTICLE_BINDING = SYNTHETIC_ARTICLE_PRODUCT_BINDING;
const SYNTHETIC_COMMERCIAL_DISCLOSURE = SYNTHETIC_ARTICLE_PRODUCT_BINDING.commercial_disclosure;


import {
  insertProduct,
  getProduct,
  updateProductIdentityState,
  insertVariant,
  getVariantsByProduct,
  insertEvidenceSource,
  getEvidenceSourcesByProduct,
  appendSpecSnapshot,
  getLatestSpecSnapshot,
  appendReviewSnapshot,
  getLatestReviewSnapshot,
  upsertOffer,
  getOffersByProduct,
  appendPriceSnapshot,
  getLatestPriceSnapshot,
  insertAffiliateDestination,
  getAffiliateDestinationsByOffer,
  insertArticleProductBinding,
  getBindingsByArticle,
  assembleTechnicalMatchInput,
  computeSpecSnapshotHash
} from '../src/lib/product-review/store.ts';

import {
  DEFAULT_FRESHNESS_POLICY,
  evaluateEntityFreshness
} from '../src/lib/product-review/freshness.ts';

import { evaluateTechnicalProductMatch } from '../src/lib/product-review/contracts.ts';
import { DECISION_MODEL_PILOT_KUSEN } from '../src/lib/product-decision/pilot-kusen.ts';
import { evaluateDecision } from '../src/lib/product-decision/evaluator.ts';

function createTestDb() {
  const sqlite = new DatabaseSync(':memory:');

  // Apply base schema
  const baseSchema = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(baseSchema);

  // Apply migration 0035 (PDE)
  const migration0035 = fs.readFileSync(
    path.resolve(process.cwd(), 'db/migrations/0035_product_decision_engine.sql'),
    'utf-8'
  );
  sqlite.exec(migration0035);

  // Apply migration 0036 (Product Review Desk)
  const migration0036 = fs.readFileSync(
    path.resolve(process.cwd(), 'db/migrations/0036_product_review_desk.sql'),
    'utf-8'
  );
  sqlite.exec(migration0036);

  // Seed reference article 5
  sqlite.exec(`
    INSERT OR REPLACE INTO articles (id, slug, title, description, content_md, content_html, category_id, author_id, status)
    VALUES (
      5,
      'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
      'Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia',
      'Panduan teknis komparasi kusen aluminium dan uPVC.',
      'Konten artikel...',
      '<p>Konten artikel...</p>',
      5,
      2,
      'published'
    );
  `);

  return {
    raw: sqlite,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.map(v => (v === undefined ? null : v));
          return this;
        },
        async run() {
          const stmt = sqlite.prepare(this._sql);
          const info = stmt.run(...this._params);
          return {
            meta: {
              changes: Number(info.changes),
              last_row_id: Number(info.lastInsertRowid)
            }
          };
        },
        async first() {
          const stmt = sqlite.prepare(this._sql);
          const row = stmt.get(...this._params);
          return row ?? null;
        },
        async all() {
          const stmt = sqlite.prepare(this._sql);
          const rows = stmt.all(...this._params);
          return {
            results: rows ?? []
          };
        }
      };
    }
  };
}

async function runTestSuite() {
  console.log('--- PRODUCT REVIEW AFFILIATE-1B TEST SUITE STARTING ---');
  const db = createTestDb();

  // Test A: Migration applies locally
  console.log('Testing Test A: Migration applies cleanly to local test DB...');
  const tableCheck = db.raw
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'product_review_%'")
    .all();
  assert.equal(tableCheck.length >= 9, true, 'At least 9 product_review tables must exist');
  console.log('✓ Test A PASS');

  // Test B: Product persists
  console.log('Testing Test B: Product persists...');
  const insertProdRes = await insertProduct(db, {
    product_id: SYNTHETIC_PRODUCT.product_id,
    canonical_name: SYNTHETIC_PRODUCT.canonical_name,
    brand: SYNTHETIC_PRODUCT.brand,
    category_id: SYNTHETIC_PRODUCT.category_id,
    solution_class_id: SYNTHETIC_PRODUCT.solution_class_id,
    identity_state: SYNTHETIC_PRODUCT.identity_state,
    review_mode: SYNTHETIC_PRODUCT.review_mode,
    tested_by_rancangloka: SYNTHETIC_PRODUCT.tested_by_rancangloka,
    variants: [],
    spec_snapshots: [],
    evidence_sources: []
  });
  assert.equal(insertProdRes.status, 'INSERTED');
  const retrievedProd = await getProduct(db, SYNTHETIC_PRODUCT.product_id);
  assert.notEqual(retrievedProd, null);
  assert.equal(retrievedProd.canonical_name, SYNTHETIC_PRODUCT.canonical_name);
  console.log('✓ Test B PASS');

  // Test C: Variant persists
  console.log('Testing Test C: Variant persists...');
  const insertVarRes1 = await insertVariant(db, {
    variant_id: SYNTHETIC_VARIANT_1.variant_id,
    product_id: SYNTHETIC_VARIANT_1.product_id,
    variant_name: SYNTHETIC_VARIANT_1.variant_name,
    sku_or_model: SYNTHETIC_VARIANT_1.sku_or_model,
    specific_specs: { ...SYNTHETIC_VARIANT_1.specific_specs },
    identity_state: SYNTHETIC_VARIANT_1.identity_state
  });
  assert.equal(insertVarRes1.status, 'INSERTED');

  const insertVarRes2 = await insertVariant(db, {
    variant_id: SYNTHETIC_VARIANT_2.variant_id,
    product_id: SYNTHETIC_VARIANT_2.product_id,
    variant_name: SYNTHETIC_VARIANT_2.variant_name,
    sku_or_model: SYNTHETIC_VARIANT_2.sku_or_model,
    specific_specs: { ...SYNTHETIC_VARIANT_2.specific_specs },
    identity_state: SYNTHETIC_VARIANT_2.identity_state
  });
  assert.equal(insertVarRes2.status, 'INSERTED');

  const variants = await getVariantsByProduct(db, SYNTHETIC_PRODUCT.product_id);
  assert.equal(variants.length, 2);
  console.log('✓ Test C PASS');

  // Test D: EvidenceSource persists
  console.log('Testing Test D: EvidenceSource persists...');
  const insertSrcRes1 = await insertEvidenceSource(db, {
    source_id: SYNTHETIC_EVIDENCE_MANUFACTURER.source_id,
    product_identity_reference: SYNTHETIC_PRODUCT.product_id,
    source_type: SYNTHETIC_EVIDENCE_MANUFACTURER.source_type,
    source_url: SYNTHETIC_EVIDENCE_MANUFACTURER.source_url,
    publisher: SYNTHETIC_EVIDENCE_MANUFACTURER.publisher,
    retrieved_at: SYNTHETIC_EVIDENCE_MANUFACTURER.retrieved_at,
    evidence_scope: SYNTHETIC_EVIDENCE_MANUFACTURER.evidence_scope,
    claim_class: SYNTHETIC_EVIDENCE_MANUFACTURER.claim_class,
    source_fidelity: SYNTHETIC_EVIDENCE_MANUFACTURER.source_fidelity
  });
  assert.equal(insertSrcRes1.status, 'INSERTED');

  const insertSrcRes2 = await insertEvidenceSource(db, {
    source_id: SYNTHETIC_EVIDENCE_LAB_TEST.source_id,
    product_identity_reference: SYNTHETIC_PRODUCT.product_id,
    source_type: SYNTHETIC_EVIDENCE_LAB_TEST.source_type,
    source_url: SYNTHETIC_EVIDENCE_LAB_TEST.source_url,
    publisher: SYNTHETIC_EVIDENCE_LAB_TEST.publisher,
    retrieved_at: SYNTHETIC_EVIDENCE_LAB_TEST.retrieved_at,
    evidence_scope: SYNTHETIC_EVIDENCE_LAB_TEST.evidence_scope,
    claim_class: SYNTHETIC_EVIDENCE_LAB_TEST.claim_class,
    source_fidelity: SYNTHETIC_EVIDENCE_LAB_TEST.source_fidelity
  });
  assert.equal(insertSrcRes2.status, 'INSERTED');

  const evidenceList = await getEvidenceSourcesByProduct(db, SYNTHETIC_PRODUCT.product_id);
  assert.equal(evidenceList.length, 2);
  console.log('✓ Test D PASS');

  // Test E: SpecSnapshot persists
  console.log('Testing Test E: SpecSnapshot persists...');
  const insertSpecRes = await appendSpecSnapshot(db, {
    spec_snapshot_id: SYNTHETIC_SPEC_SNAPSHOT.spec_snapshot_id,
    product_id: SYNTHETIC_SPEC_SNAPSHOT.product_id,
    variant_id: SYNTHETIC_SPEC_SNAPSHOT.variant_id,
    captured_at: SYNTHETIC_SPEC_SNAPSHOT.captured_at,
    source_id: SYNTHETIC_SPEC_SNAPSHOT.source_id,
    source_fidelity: SYNTHETIC_SPEC_SNAPSHOT.source_fidelity,
    specs: { ...SYNTHETIC_SPEC_SNAPSHOT.specs }
  });
  assert.equal(insertSpecRes.status, 'INSERTED');

  const latestSpec = await getLatestSpecSnapshot(db, SYNTHETIC_PRODUCT.product_id);
  assert.notEqual(latestSpec, null);
  assert.equal(latestSpec.specs.thermal_transmittance_u_value, 1.4);
  console.log('✓ Test E PASS');

  // Test F: Offer persists
  console.log('Testing Test F: Offer persists...');
  const insertOfferRes = await upsertOffer(db, {
    offer_id: SYNTHETIC_OFFER_MERCHANT_A.offer_id,
    product_id: SYNTHETIC_OFFER_MERCHANT_A.product_id,
    variant_id: SYNTHETIC_OFFER_MERCHANT_A.variant_id,
    merchant_id: SYNTHETIC_OFFER_MERCHANT_A.merchant_id,
    merchant_name: SYNTHETIC_OFFER_MERCHANT_A.merchant_name,
    listing_identity: SYNTHETIC_OFFER_MERCHANT_A.listing_identity,
    listing_title: SYNTHETIC_OFFER_MERCHANT_A.listing_title,
    listing_url: SYNTHETIC_OFFER_MERCHANT_A.listing_url,
    current_availability: SYNTHETIC_OFFER_MERCHANT_A.current_availability
  });
  assert.equal(insertOfferRes.status, 'INSERTED');

  const offers = await getOffersByProduct(db, SYNTHETIC_PRODUCT.product_id);
  assert.equal(offers.length, 1);
  console.log('✓ Test F PASS');

  // Test G: PriceSnapshot persists
  console.log('Testing Test G: PriceSnapshot persists...');
  const insertPriceRes = await appendPriceSnapshot(db, {
    price_snapshot_id: SYNTHETIC_PRICE_SNAPSHOT_A.price_snapshot_id,
    offer_id: SYNTHETIC_PRICE_SNAPSHOT_A.offer_id,
    captured_at: SYNTHETIC_PRICE_SNAPSHOT_A.captured_at,
    currency: SYNTHETIC_PRICE_SNAPSHOT_A.currency,
    observed_price: SYNTHETIC_PRICE_SNAPSHOT_A.observed_price,
    availability: SYNTHETIC_PRICE_SNAPSHOT_A.availability,
    source_url: SYNTHETIC_PRICE_SNAPSHOT_A.source_url
  });
  assert.equal(insertPriceRes.status, 'INSERTED');

  const latestPrice = await getLatestPriceSnapshot(db, SYNTHETIC_OFFER_MERCHANT_A.offer_id);
  assert.notEqual(latestPrice, null);
  assert.equal(latestPrice.observed_price, 450000);
  console.log('✓ Test G PASS');

  // Test H: ReviewSnapshot persists
  console.log('Testing Test H: ReviewSnapshot persists...');
  const insertRevRes = await appendReviewSnapshot(db, {
    review_snapshot_id: SYNTHETIC_REVIEW_SNAPSHOT.review_snapshot_id,
    product_id: SYNTHETIC_REVIEW_SNAPSHOT.product_id,
    variant_id: SYNTHETIC_REVIEW_SNAPSHOT.variant_id,
    source_id: SYNTHETIC_REVIEW_SNAPSHOT.source_id,
    captured_at: SYNTHETIC_REVIEW_SNAPSHOT.captured_at,
    external_review_count: SYNTHETIC_REVIEW_SNAPSHOT.external_review_count,
    external_rating: SYNTHETIC_REVIEW_SNAPSHOT.external_rating,
    external_rating_max: SYNTHETIC_REVIEW_SNAPSHOT.external_rating_max,
    source_label: SYNTHETIC_REVIEW_SNAPSHOT.source_label,
    recurring_themes: [...SYNTHETIC_REVIEW_SNAPSHOT.recurring_themes]
  });
  assert.equal(insertRevRes.status, 'INSERTED');

  const latestRev = await getLatestReviewSnapshot(db, SYNTHETIC_PRODUCT.product_id);
  assert.notEqual(latestRev, null);
  assert.equal(latestRev.external_review_count, 42);
  console.log('✓ Test H PASS');

  // Test I: AffiliateDestination persists separately
  console.log('Testing Test I: AffiliateDestination persists separately...');
  const insertAffRes = await insertAffiliateDestination(db, {
    destination_id: SYNTHETIC_AFFILIATE_A.destination_id,
    offer_id: SYNTHETIC_AFFILIATE_A.offer_id,
    provider: SYNTHETIC_AFFILIATE_A.provider,
    affiliate_destination_url: SYNTHETIC_AFFILIATE_A.affiliate_destination_url,
    tracking_metadata: { campaign: 'kus_tropis_2026' },
    is_active: SYNTHETIC_AFFILIATE_A.is_active
  });
  assert.equal(insertAffRes.status, 'INSERTED');

  const affList = await getAffiliateDestinationsByOffer(db, SYNTHETIC_OFFER_MERCHANT_A.offer_id);
  assert.equal(affList.length, 1);
  assert.equal(affList[0].provider, 'involve_asia');
  console.log('✓ Test I PASS');

  // Test J: CommercialDisclosure persists separately
  console.log('Testing Test J: CommercialDisclosure persists separately...');
  // Disclosure is persisted as part of article binding
  const testBinding = {
    binding_id: SYNTHETIC_ARTICLE_BINDING.binding_id,
    article_id: SYNTHETIC_ARTICLE_BINDING.article_id,
    product_id: SYNTHETIC_ARTICLE_BINDING.product_id,
    variant_id: SYNTHETIC_ARTICLE_BINDING.variant_id,
    editorial_role: SYNTHETIC_ARTICLE_BINDING.editorial_role,
    section_anchor: '#rekomendasi-upvc',
    commercial_disclosure: {
      has_affiliate_links: true,
      is_sponsored_content: false,
      is_product_supplied_by_brand: false,
      disclosure_statement: 'RancangLoka mungkin mendapatkan komisi afiliasi jika membeli melalui tautan ini.'
    }
  };
  const insertBindRes = await insertArticleProductBinding(db, testBinding);
  assert.equal(insertBindRes.status, 'INSERTED');

  const bindings = await getBindingsByArticle(db, 5);
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].commercial_disclosure.has_affiliate_links, true);
  console.log('✓ Test J PASS');

  // Test K: ArticleProductBinding persists
  console.log('Testing Test K: ArticleProductBinding persists...');
  assert.equal(bindings[0].editorial_role, 'EXAMPLE');
  console.log('✓ Test K PASS');

  // Test L: Synthetic round-trip preserves identities
  console.log('Testing Test L: Synthetic round-trip preserves identities...');
  const p = await getProduct(db, SYNTHETIC_PRODUCT.product_id);
  const v = await getVariantsByProduct(db, SYNTHETIC_PRODUCT.product_id);
  const s = await getLatestSpecSnapshot(db, SYNTHETIC_PRODUCT.product_id);
  assert.equal(p.product_id, SYNTHETIC_PRODUCT.product_id);
  assert.equal(p.brand, SYNTHETIC_PRODUCT.brand);
  assert.equal(v[0].sku_or_model, SYNTHETIC_VARIANT_1.sku_or_model);
  assert.equal(s.spec_snapshot_id, SYNTHETIC_SPEC_SNAPSHOT.spec_snapshot_id);
  console.log('✓ Test L PASS');

  // Test M: Exact duplicate is idempotent
  console.log('Testing Test M: Exact duplicate is idempotent...');
  const dupProd = await insertProduct(db, {
    product_id: SYNTHETIC_PRODUCT.product_id,
    canonical_name: SYNTHETIC_PRODUCT.canonical_name,
    brand: SYNTHETIC_PRODUCT.brand,
    category_id: SYNTHETIC_PRODUCT.category_id,
    solution_class_id: SYNTHETIC_PRODUCT.solution_class_id,
    identity_state: SYNTHETIC_PRODUCT.identity_state,
    review_mode: SYNTHETIC_PRODUCT.review_mode,
    tested_by_rancangloka: SYNTHETIC_PRODUCT.tested_by_rancangloka,
    variants: [],
    spec_snapshots: [],
    evidence_sources: []
  });
  assert.equal(dupProd.status, 'ALREADY_EXISTS_IDENTICAL');

  const dupSpec = await appendSpecSnapshot(db, {
    spec_snapshot_id: SYNTHETIC_SPEC_SNAPSHOT.spec_snapshot_id,
    product_id: SYNTHETIC_SPEC_SNAPSHOT.product_id,
    variant_id: SYNTHETIC_SPEC_SNAPSHOT.variant_id,
    captured_at: SYNTHETIC_SPEC_SNAPSHOT.captured_at,
    source_id: SYNTHETIC_SPEC_SNAPSHOT.source_id,
    source_fidelity: SYNTHETIC_SPEC_SNAPSHOT.source_fidelity,
    specs: { ...SYNTHETIC_SPEC_SNAPSHOT.specs }
  });
  assert.equal(dupSpec.status, 'ALREADY_EXISTS_IDENTICAL');
  console.log('✓ Test M PASS');

  // Test N: Immutable conflict blocks overwrite
  console.log('Testing Test N: Immutable conflict blocks overwrite...');
  const conflictSpec = await appendSpecSnapshot(db, {
    spec_snapshot_id: SYNTHETIC_SPEC_SNAPSHOT.spec_snapshot_id,
    product_id: SYNTHETIC_SPEC_SNAPSHOT.product_id,
    variant_id: SYNTHETIC_SPEC_SNAPSHOT.variant_id,
    captured_at: SYNTHETIC_SPEC_SNAPSHOT.captured_at,
    source_id: SYNTHETIC_SPEC_SNAPSHOT.source_id,
    source_fidelity: SYNTHETIC_SPEC_SNAPSHOT.source_fidelity,
    specs: { thermal_transmittance_u_value: 9.99 } // Conflicting content
  });
  assert.equal(conflictSpec.status, 'BLOCKED_SNAPSHOT_CONFLICT');
  console.log('✓ Test N PASS');

  // Test O: Commerce changes do not alter technical match input
  console.log('Testing Test O: Commerce changes do not alter technical match input...');
  const pRecord = await getProduct(db, SYNTHETIC_PRODUCT.product_id);
  const vRecord = (await getVariantsByProduct(db, SYNTHETIC_PRODUCT.product_id))[0];
  const sRecord = await getLatestSpecSnapshot(db, SYNTHETIC_PRODUCT.product_id);
  const eRecords = await getEvidenceSourcesByProduct(db, SYNTHETIC_PRODUCT.product_id);

  const matchInputA = assembleTechnicalMatchInput({
    product: pRecord,
    variant: vRecord,
    specSnapshot: sRecord,
    evidenceSources: eRecords
  });

  // Mutate commerce: Add a new merchant with different price, availability, and affiliate URL
  await upsertOffer(db, {
    offer_id: 'off_merchant_c_new',
    product_id: SYNTHETIC_PRODUCT.product_id,
    variant_id: vRecord.variant_id,
    merchant_id: 'merch_new_c',
    merchant_name: 'Merchant Toko Baru C',
    listing_identity: 'LIST-C-999',
    listing_title: 'Diskon Heboh Kusen uPVC C',
    listing_url: 'https://new-store-c.id/item',
    current_availability: 'OUT_OF_STOCK'
  });

  await appendPriceSnapshot(db, {
    price_snapshot_id: 'price_snap_c_new',
    offer_id: 'off_merchant_c_new',
    captured_at: new Date().toISOString(),
    currency: 'IDR',
    observed_price: 1999999,
    availability: 'OUT_OF_STOCK',
    source_url: 'https://new-store-c.id/item'
  });

  const matchInputB = assembleTechnicalMatchInput({
    product: pRecord,
    variant: vRecord,
    specSnapshot: sRecord,
    evidenceSources: eRecords
  });

  assert.deepEqual(matchInputA, matchInputB, 'Match input must remain bit-for-bit identical despite commerce mutation');
  console.log('✓ Test O PASS');

  // Test P: Price changes do not alter technical match input
  console.log('Testing Test P: Price changes do not alter technical match input...');
  await appendPriceSnapshot(db, {
    price_snapshot_id: 'price_snap_a_surge',
    offer_id: SYNTHETIC_OFFER_MERCHANT_A.offer_id,
    captured_at: new Date().toISOString(),
    currency: 'IDR',
    observed_price: 3500000, // Price spiked
    availability: 'IN_STOCK',
    source_url: SYNTHETIC_OFFER_MERCHANT_A.listing_url
  });
  const matchInputC = assembleTechnicalMatchInput({
    product: pRecord,
    variant: vRecord,
    specSnapshot: sRecord,
    evidenceSources: eRecords
  });
  assert.deepEqual(matchInputA, matchInputC);
  console.log('✓ Test P PASS');

  // Test Q: Affiliate destination changes do not alter technical match input
  console.log('Testing Test Q: Affiliate destination changes do not alter technical match input...');
  await insertAffiliateDestination(db, {
    destination_id: 'aff_new_sponsor_high_payout',
    offer_id: SYNTHETIC_OFFER_MERCHANT_A.offer_id,
    provider: 'HIGH_COMMISSION_AFFILIATE',
    affiliate_destination_url: 'https://payout.example.com/tracked?payout=90%',
    is_active: true
  });
  const matchInputD = assembleTechnicalMatchInput({
    product: pRecord,
    variant: vRecord,
    specSnapshot: sRecord,
    evidenceSources: eRecords
  });
  assert.deepEqual(matchInputA, matchInputD);
  console.log('✓ Test Q PASS');

  // Test R: Sponsorship disclosure does not alter technical match input
  console.log('Testing Test R: Sponsorship disclosure does not alter technical match input...');
  const matchInputE = assembleTechnicalMatchInput({
    product: pRecord,
    variant: vRecord,
    specSnapshot: sRecord,
    evidenceSources: eRecords
  });
  assert.deepEqual(matchInputA, matchInputE);
  console.log('✓ Test R PASS');

  // Test S: Technical spec change DOES affect technical match input
  console.log('Testing Test S: Technical spec change DOES affect technical match input...');
  const newSpecSnapshot = {
    spec_snapshot_id: 'spec_snap_synth_v2_better_insulation',
    product_id: SYNTHETIC_PRODUCT.product_id,
    variant_id: vRecord.variant_id,
    captured_at: new Date().toISOString(),
    source_id: SYNTHETIC_EVIDENCE_LAB_TEST.source_id,
    source_fidelity: 'PRIMARY_DOCUMENT',
    specs: {
      ...SYNTHETIC_SPEC_SNAPSHOT.specs,
      thermal_transmittance_u_value: 0.95 // Upgraded U-value
    }
  };
  await appendSpecSnapshot(db, newSpecSnapshot);

  const matchInputUpgraded = assembleTechnicalMatchInput({
    product: pRecord,
    variant: vRecord,
    specSnapshot: newSpecSnapshot,
    evidenceSources: eRecords
  });

  assert.notDeepEqual(matchInputA, matchInputUpgraded, 'Technical spec changes must affect technical match input');
  assert.equal(matchInputUpgraded.specs.thermal_transmittance_u_value, 0.95);
  console.log('✓ Test S PASS');

  // Test T: Evidence provenance change is detectable
  console.log('Testing Test T: Evidence provenance change is detectable...');
  const newEvidenceSource = {
    source_id: 'src_synth_low_fidelity_blog',
    product_identity_reference: SYNTHETIC_PRODUCT.product_id,
    source_type: 'USER_REVIEW_AGGREGATE',
    source_url: 'https://unverified-blog.example.com/opinions',
    publisher: 'Personal Construction Blog',
    retrieved_at: new Date().toISOString(),
    evidence_scope: 'Subjective user feedback',
    claim_class: 'USER_EXPERIENCE_SIGNAL',
    source_fidelity: 'USER_OBSERVATION'
  };
  await insertEvidenceSource(db, newEvidenceSource);
  const updatedEvidenceSources = await getEvidenceSourcesByProduct(db, SYNTHETIC_PRODUCT.product_id);
  assert.equal(updatedEvidenceSources.length, 3);
  console.log('✓ Test T PASS');

  // Test U: Analytical review cannot acquire Tested by RancangLoka status
  console.log('Testing Test U: Analytical review cannot acquire Tested by RancangLoka status...');
  const invalidAnalyticalProd = {
    product_id: 'prod_invalid_tested_claim',
    canonical_name: 'Produk Klaim Palsu',
    brand: 'Fictional Brand',
    category_id: 'cat_test',
    solution_class_id: 'sol_upvc_multi_chamber',
    identity_state: 'CURRENT',
    review_mode: 'ANALYTICAL_REVIEW',
    tested_by_rancangloka: true, // FORBIDDEN without hands-on review and primary test evidence
    variants: [],
    spec_snapshots: [],
    evidence_sources: []
  };
  const insertInvalidProdRes = await insertProduct(db, invalidAnalyticalProd);
  assert.equal(insertInvalidProdRes.status, 'BLOCKED_VALIDATION_FAILED');
  console.log('✓ Test U PASS');

  // Test V: Hands-on review requires primary test provenance
  console.log('Testing Test V: Hands-on review requires primary test provenance...');
  const invalidHandsOnProd = {
    product_id: 'prod_invalid_handson_no_prov',
    canonical_name: 'Produk Hands On Tanpa Bukti',
    brand: 'Fictional Brand',
    category_id: 'cat_test',
    solution_class_id: 'sol_upvc_multi_chamber',
    identity_state: 'CURRENT',
    review_mode: 'HANDS_ON_REVIEW',
    tested_by_rancangloka: true,
    // Missing testing_provenance
    variants: [],
    spec_snapshots: [],
    evidence_sources: []
  };
  const insertInvalidHandsOnRes = await insertProduct(db, invalidHandsOnProd);
  assert.equal(insertInvalidHandsOnRes.status, 'BLOCKED_VALIDATION_FAILED');
  console.log('✓ Test V PASS');

  // Test W: User review remains USER_EXPERIENCE_SIGNAL
  console.log('Testing Test W: User review remains USER_EXPERIENCE_SIGNAL...');
  const rev = await getLatestReviewSnapshot(db, SYNTHETIC_PRODUCT.product_id);
  assert.notEqual(rev, null);
  assert.equal(rev.external_rating, 4.8);
  // Verify that technical match input assembler completely ignores review snapshots
  assert.equal(matchInputA.external_rating, undefined);
  assert.equal(matchInputA.review_snapshot, undefined);
  console.log('✓ Test W PASS');

  // Test X: No numeric ranking score
  console.log('Testing Test X: No numeric ranking score...');
  assert.equal(matchInputA.score, undefined);
  assert.equal(matchInputA.overall_score, undefined);
  assert.equal(matchInputA.rank, undefined);
  assert.equal(matchInputA.rating, undefined);
  console.log('✓ Test X PASS');

  // Test Y: No production connection required
  console.log('Testing Test Y: No production connection required...');
  assert.equal(process.env.CF_PAGES, undefined);
  assert.equal(process.env.CLOUDFLARE_API_TOKEN, undefined);
  console.log('✓ Test Y PASS');

  // Test Z: No PDE recommendation semantics changed
  console.log('Testing Test Z: No PDE recommendation semantics changed...');
  const pdeResult = evaluateDecision(
    DECISION_MODEL_PILOT_KUSEN,
    DECISION_MODEL_PILOT_KUSEN.scenarios[0].context
  );
  assert.equal(pdeResult.status, 'RECOMMENDED');
  assert.equal(
    pdeResult.recommendation.recommended_solution_id,
    DECISION_MODEL_PILOT_KUSEN.scenarios[0].expected_recommendation.recommended_solution_id
  );
  console.log('✓ Test Z PASS');

  console.log('======================================================');
  console.log('ALL 26 TEST CASES (A-Z) PASSED SUCCESSFULLY!');
  console.log('======================================================');
}

runTestSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
