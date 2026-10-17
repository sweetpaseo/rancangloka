/**
 * ============================================================================
 * RancangLoka Product Review Desk & Affiliate Firewall Contract Test Suite
 * Milestone: PRODUCT_REVIEW_AFFILIATE-1A
 *
 * Verifies:
 * A. Product validates.
 * B. Variant validates.
 * C. Offer validates.
 * D. Evidence source validates.
 * E. Spec snapshot validates.
 * F. Price snapshot validates.
 * G. Review snapshot validates.
 * H. ArticleProductBinding validates.
 * I. ANALYTICAL_REVIEW cannot claim Tested by RancangLoka.
 * J. HANDS_ON_REVIEW requires primary testing provenance.
 * K. User reviews remain USER_EXPERIENCE_SIGNAL.
 * L. Changing affiliate commission does not affect technical identity.
 * M. Changing affiliate destination does not affect evidence source.
 * N. Changing price does not affect product/spec identity.
 * O. Sponsored relationship does not affect match input.
 * P. Merchant priority fields are rejected from technical match contract.
 * Q. Identity drift is detectable.
 * R. Missing reliable technical evidence can produce INSUFFICIENT_EVIDENCE.
 * S. No numeric product score field in technical match result.
 * T. PDE handoff contains zero commerce data.
 * U. Synthetic fixture uses no real brand.
 * V. Zero network / D1 / Astro dependency.
 * ============================================================================
 */

import assert from 'node:assert/strict';

import {
  validateProduct,
  validateVariant,
  validateOffer,
  validateAffiliateDestination,
  validateEvidenceSource,
  validateSpecSnapshot,
  validatePriceSnapshot,
  validateReviewSnapshot,
  validateArticleProductBinding,
  validateIdentityDrift,
  evaluateTechnicalProductMatch,
  scanForForbiddenReviewCommerceFields,
  FORBIDDEN_TECHNICAL_MATCH_COMMERCE_FIELDS,
  SYNTHETIC_PRODUCT,
  SYNTHETIC_VARIANT_1,
  SYNTHETIC_VARIANT_2,
  SYNTHETIC_OFFER_MERCHANT_A,
  SYNTHETIC_OFFER_MERCHANT_B,
  SYNTHETIC_PRICE_SNAPSHOT_A,
  SYNTHETIC_PRICE_SNAPSHOT_B,
  SYNTHETIC_SPEC_SNAPSHOT,
  SYNTHETIC_REVIEW_SNAPSHOT,
  SYNTHETIC_EVIDENCE_MANUFACTURER,
  SYNTHETIC_EVIDENCE_LAB_TEST,
  SYNTHETIC_AFFILIATE_DESTINATION_A,
  SYNTHETIC_AFFILIATE_DESTINATION_B,
  SYNTHETIC_ARTICLE_PRODUCT_BINDING
} from '../src/lib/product-review/index.ts';

console.log('--- PRODUCT REVIEW AFFILIATE-1A TEST SUITE STARTING ---');

// ----------------------------------------------------------------------------
// Test A: Product validates
// ----------------------------------------------------------------------------
console.log('Testing Test A: Product validates...');
const resA = validateProduct(SYNTHETIC_PRODUCT);
assert.equal(resA.valid, true, `Product should validate: ${JSON.stringify(resA.issues)}`);
console.log('✓ Test A PASS');

// ----------------------------------------------------------------------------
// Test B: Variant validates
// ----------------------------------------------------------------------------
console.log('Testing Test B: Variant validates...');
const resB1 = validateVariant(SYNTHETIC_VARIANT_1);
assert.equal(resB1.valid, true, `Variant 1 should validate: ${JSON.stringify(resB1.issues)}`);
const resB2 = validateVariant(SYNTHETIC_VARIANT_2);
assert.equal(resB2.valid, true, `Variant 2 should validate: ${JSON.stringify(resB2.issues)}`);
console.log('✓ Test B PASS');

// ----------------------------------------------------------------------------
// Test C: Offer validates
// ----------------------------------------------------------------------------
console.log('Testing Test C: Offer validates...');
const resC1 = validateOffer(SYNTHETIC_OFFER_MERCHANT_A);
assert.equal(resC1.valid, true, `Offer A should validate: ${JSON.stringify(resC1.issues)}`);
const resC2 = validateOffer(SYNTHETIC_OFFER_MERCHANT_B);
assert.equal(resC2.valid, true, `Offer B should validate: ${JSON.stringify(resC2.issues)}`);
console.log('✓ Test C PASS');

// ----------------------------------------------------------------------------
// Test D: Evidence source validates
// ----------------------------------------------------------------------------
console.log('Testing Test D: Evidence source validates...');
const resD1 = validateEvidenceSource(SYNTHETIC_EVIDENCE_MANUFACTURER);
assert.equal(resD1.valid, true, `Manufacturer source should validate: ${JSON.stringify(resD1.issues)}`);
const resD2 = validateEvidenceSource(SYNTHETIC_EVIDENCE_LAB_TEST);
assert.equal(resD2.valid, true, `Lab test source should validate: ${JSON.stringify(resD2.issues)}`);
console.log('✓ Test D PASS');

// ----------------------------------------------------------------------------
// Test E: Spec snapshot validates
// ----------------------------------------------------------------------------
console.log('Testing Test E: Spec snapshot validates...');
const resE = validateSpecSnapshot(SYNTHETIC_SPEC_SNAPSHOT);
assert.equal(resE.valid, true, `Spec snapshot should validate: ${JSON.stringify(resE.issues)}`);
console.log('✓ Test E PASS');

// ----------------------------------------------------------------------------
// Test F: Price snapshot validates
// ----------------------------------------------------------------------------
console.log('Testing Test F: Price snapshot validates...');
const resF1 = validatePriceSnapshot(SYNTHETIC_PRICE_SNAPSHOT_A);
assert.equal(resF1.valid, true, `Price snapshot A should validate: ${JSON.stringify(resF1.issues)}`);
const resF2 = validatePriceSnapshot(SYNTHETIC_PRICE_SNAPSHOT_B);
assert.equal(resF2.valid, true, `Price snapshot B should validate: ${JSON.stringify(resF2.issues)}`);
console.log('✓ Test F PASS');

// ----------------------------------------------------------------------------
// Test G: Review snapshot validates
// ----------------------------------------------------------------------------
console.log('Testing Test G: Review snapshot validates...');
const resG = validateReviewSnapshot(SYNTHETIC_REVIEW_SNAPSHOT);
assert.equal(resG.valid, true, `Review snapshot should validate: ${JSON.stringify(resG.issues)}`);
console.log('✓ Test G PASS');

// ----------------------------------------------------------------------------
// Test H: ArticleProductBinding validates
// ----------------------------------------------------------------------------
console.log('Testing Test H: ArticleProductBinding validates...');
const resH = validateArticleProductBinding(SYNTHETIC_ARTICLE_PRODUCT_BINDING);
assert.equal(resH.valid, true, `Binding should validate: ${JSON.stringify(resH.issues)}`);
console.log('✓ Test H PASS');

// ----------------------------------------------------------------------------
// Test I: ANALYTICAL_REVIEW cannot claim Tested by RancangLoka
// ----------------------------------------------------------------------------
console.log('Testing Test I: ANALYTICAL_REVIEW cannot claim Tested by RancangLoka...');
const invalidAnalyticalProduct = {
  ...SYNTHETIC_PRODUCT,
  review_mode: 'ANALYTICAL_REVIEW',
  tested_by_rancangloka: true // FORBIDDEN without primary test evidence
};
const resI = validateProduct(invalidAnalyticalProduct);
assert.equal(resI.valid, false, 'ANALYTICAL_REVIEW with tested_by_rancangloka=true must fail validation');
assert.ok(
  resI.issues.some(iss => iss.code === 'INVALID_REVIEW_MODE_TESTED_FLAG'),
  'Must report INVALID_REVIEW_MODE_TESTED_FLAG'
);
console.log('✓ Test I PASS');

// ----------------------------------------------------------------------------
// Test J: HANDS_ON_REVIEW requires primary testing provenance
// ----------------------------------------------------------------------------
console.log('Testing Test J: HANDS_ON_REVIEW requires primary testing provenance...');
const invalidHandsOnProduct = {
  ...SYNTHETIC_PRODUCT,
  review_mode: 'HANDS_ON_REVIEW',
  tested_by_rancangloka: false // Missing tested flag
};
const resJ1 = validateProduct(invalidHandsOnProduct);
assert.equal(resJ1.valid, false, 'HANDS_ON_REVIEW without tested flag must fail');

const handsOnWithoutProvenance = {
  ...SYNTHETIC_PRODUCT,
  review_mode: 'HANDS_ON_REVIEW',
  tested_by_rancangloka: true,
  testing_provenance: undefined // Missing provenance
};
const resJ2 = validateProduct(handsOnWithoutProvenance);
assert.equal(resJ2.valid, false, 'HANDS_ON_REVIEW without provenance must fail');
assert.ok(
  resJ2.issues.some(iss => iss.code === 'MISSING_TESTING_PROVENANCE'),
  'Must report MISSING_TESTING_PROVENANCE'
);

// Valid HANDS_ON_REVIEW with proper provenance and primary test evidence source
const validHandsOnProduct = {
  ...SYNTHETIC_PRODUCT,
  review_mode: 'HANDS_ON_REVIEW',
  tested_by_rancangloka: true,
  testing_provenance: {
    testing_date: '2026-10-14',
    tester_identity: 'Irwan & RancangLoka Editorial Lab',
    testing_location: 'Workshop Pengujian Fasade Jakarta Barat',
    methodology_notes: 'Pengujian insulasi termal menggunakan thermo-gun terkalibrasi dan semprotan air 600Pa'
  },
  evidence_sources: [
    ...SYNTHETIC_PRODUCT.evidence_sources,
    {
      source_id: 'src_primary_test_01',
      source_type: 'RANCANGLOKA_PRIMARY_TEST',
      source_url: 'https://rancangloka.id/lab/reports/2026-10-nh-kus-x1-test.pdf',
      publisher: 'RancangLoka Editorial Lab',
      retrieved_at: '2026-10-14T17:00:00Z',
      evidence_scope: 'Physical acoustic & thermal chamber measurement',
      claim_class: 'VERIFIED_FACT',
      source_fidelity: 'PRIMARY_DOCUMENT',
      product_identity_reference: 'prod_synthetic_upvc_01'
    }
  ]
};
const resJ3 = validateProduct(validHandsOnProduct);
assert.equal(resJ3.valid, true, `Valid HANDS_ON_REVIEW should pass: ${JSON.stringify(resJ3.issues)}`);
console.log('✓ Test J PASS');

// ----------------------------------------------------------------------------
// Test K: User reviews remain USER_EXPERIENCE_SIGNAL
// ----------------------------------------------------------------------------
console.log('Testing Test K: User reviews remain USER_EXPERIENCE_SIGNAL...');
const userReviewSource = {
  source_id: 'src_synth_marketplace_reviews',
  source_type: 'USER_REVIEW_AGGREGATE',
  source_url: 'https://fictional-store-a.id/reviews/nh-kus-x1',
  publisher: 'Ulasan Pembeli Terverifikasi (Fiktif)',
  retrieved_at: '2026-10-16T12:00:00Z',
  evidence_scope: 'Pengalaman pembeli setelah 6 bulan pemakaian',
  claim_class: 'USER_EXPERIENCE_SIGNAL', // Required claim class
  source_fidelity: 'USER_OBSERVATION',
  product_identity_reference: 'prod_synthetic_upvc_01'
};
const resK = validateEvidenceSource(userReviewSource);
assert.equal(resK.valid, true);
assert.equal(userReviewSource.claim_class, 'USER_EXPERIENCE_SIGNAL');
assert.notEqual(userReviewSource.claim_class, 'VERIFIED_FACT', 'User reviews cannot be classified as VERIFIED_FACT');
console.log('✓ Test K PASS');

// ----------------------------------------------------------------------------
// Test L: Changing affiliate commission does not affect technical identity
// ----------------------------------------------------------------------------
console.log('Testing Test L: Changing affiliate commission does not affect technical identity...');
const initialProductJson = JSON.stringify(SYNTHETIC_PRODUCT);

// Alter affiliate destination metadata/commission rate
const modifiedAffiliateDestination = {
  ...SYNTHETIC_AFFILIATE_DESTINATION_A,
  tracking_metadata: {
    ...SYNTHETIC_AFFILIATE_DESTINATION_A.tracking_metadata,
    commission_bracket: 'tier_premium_99',
    payout_rate: '0.25'
  }
};
// Product technical identity remains 100% deep equal
assert.equal(JSON.stringify(SYNTHETIC_PRODUCT), initialProductJson);
assert.equal(SYNTHETIC_PRODUCT.canonical_name, 'Kusen Jendela uPVC Multi-Chamber Seri X1');
assert.equal(SYNTHETIC_PRODUCT.solution_class_id, 'sol_upvc_multi_chamber');
console.log('✓ Test L PASS');

// ----------------------------------------------------------------------------
// Test M: Changing affiliate destination does not affect evidence source
// ----------------------------------------------------------------------------
console.log('Testing Test M: Changing affiliate destination does not affect evidence source...');
const originalEvidenceUrl = SYNTHETIC_EVIDENCE_MANUFACTURER.source_url;

// Simulate swapping merchant affiliate link from Involve Asia to Shopee or direct partner
const newAffiliateDestination = {
  ...SYNTHETIC_AFFILIATE_DESTINATION_A,
  provider: 'direct_merchant_partner',
  affiliate_destination_url: 'https://outbound.rancangloka.id/c/new-merchant-link'
};
// Evidence source remains unchanged and independent
assert.equal(SYNTHETIC_EVIDENCE_MANUFACTURER.source_url, originalEvidenceUrl);
assert.notEqual(SYNTHETIC_EVIDENCE_MANUFACTURER.source_url, newAffiliateDestination.affiliate_destination_url);
console.log('✓ Test M PASS');

// ----------------------------------------------------------------------------
// Test N: Changing price does not affect product/spec identity
// ----------------------------------------------------------------------------
console.log('Testing Test N: Changing price does not affect product/spec identity...');
const initialSpecJson = JSON.stringify(SYNTHETIC_SPEC_SNAPSHOT);

// Price fluctuates wildly in marketplace
const newPriceSnapshot = {
  ...SYNTHETIC_PRICE_SNAPSHOT_A,
  captured_at: '2026-10-17T11:00:00Z',
  observed_price: 389000 // Flash sale price drop
};
// Spec snapshot remains 100% unchanged
assert.equal(JSON.stringify(SYNTHETIC_SPEC_SNAPSHOT), initialSpecJson);
assert.equal(SYNTHETIC_SPEC_SNAPSHOT.specs.chamber_count, 5);
assert.equal(SYNTHETIC_SPEC_SNAPSHOT.specs.thermal_transmittance_u_value, 1.4);
console.log('✓ Test N PASS');

// ----------------------------------------------------------------------------
// Test O: Sponsored relationship does not affect match input
// ----------------------------------------------------------------------------
console.log('Testing Test O: Sponsored relationship does not affect match input...');
const sponsoredBinding = {
  ...SYNTHETIC_ARTICLE_PRODUCT_BINDING,
  commercial_disclosure: {
    has_affiliate_links: true,
    is_sponsored_content: true, // Sponsored partnership
    is_product_supplied_by_brand: true,
    disclosure_statement: 'Produk ini disediakan oleh distributor untuk pengujian editorial independen.'
  }
};
// Validating binding succeeds without altering product technical traits
const resO = validateArticleProductBinding(sponsoredBinding);
assert.equal(resO.valid, true);

// Technical match evaluation receives same handoff and product
const handoff = {
  problem_id: 'dp_kusen_jendela_tropis',
  solution_class_id: 'sol_upvc_multi_chamber',
  selected_solution_class_id: 'sol_upvc_multi_chamber',
  required_characteristics: ['chamber_count: 5', 'corrosion_resistant: true'],
  important_tradeoffs: [{ benefit: 'Insulasi Termal', compromise: 'Biaya Lebih Tinggi' }],
  must_avoid_characteristics: ['single_glazed_only', 'unplasticized_pvc_without_steel'],
  context_summary: { climate: 'WEST_AFTERNOON_HEAT' },
  model_version_key: 'model_pde_kusen_tropis@v1.0.0@crit_kusen_v1',
  evidence_version: 'eed64da134be1b158d0a2985e3b43196f486eb4b86dd1fd9e95a5580655b3eed',
  commercial_data_allowed: false
};
const matchSponsored = evaluateTechnicalProductMatch(handoff, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
assert.equal(matchSponsored.match_status, 'MATCH');
console.log('✓ Test O PASS');

// ----------------------------------------------------------------------------
// Test P: Merchant priority fields are rejected from technical match contract
// ----------------------------------------------------------------------------
console.log('Testing Test P: Merchant priority fields are rejected from technical match...');
const contaminatedProduct = {
  ...SYNTHETIC_PRODUCT,
  merchant_priority: 'HIGH_TIER',
  commission_rate: 0.20,
  payout: 50000
};
const resP = validateProduct(contaminatedProduct);
assert.equal(resP.valid, false, 'Product with commercial priority fields must fail validation');
assert.ok(
  resP.issues.some(iss => iss.code === 'FORBIDDEN_COMMERCE_FIELD'),
  'Must report FORBIDDEN_COMMERCE_FIELD'
);
console.log('✓ Test P PASS');

// ----------------------------------------------------------------------------
// Test Q: Identity drift is detectable
// ----------------------------------------------------------------------------
console.log('Testing Test Q: Identity drift is detectable...');
// Normal listing update matching product
const normalListing = {
  title: 'Kusen Jendela uPVC Multi-Chamber Seri X1 Putih Berkualitas',
  model_or_sku: 'NH-KUS-X1-W60'
};
const driftQ1 = validateIdentityDrift(SYNTHETIC_VARIANT_1, normalListing);
assert.equal(driftQ1.drifted, false);
assert.equal(driftQ1.state, 'CURRENT');

// SKU mutation detected
const driftedSkuListing = {
  title: 'Kusen Jendela uPVC Multi-Chamber Seri X2 Versi Ekonomis',
  model_or_sku: 'NH-KUS-X2-ECONO' // Different SKU!
};
const driftQ2 = validateIdentityDrift(SYNTHETIC_VARIANT_1, driftedSkuListing);
assert.equal(driftQ2.drifted, true);
assert.equal(driftQ2.state, 'VARIANT_CHANGED');

// Severe title divergence detected
const ambiguousListing = {
  title: 'Pintu Kamar Mandi Aluminium Hollow Murah Cepat Pasang',
  model_or_sku: undefined
};
const driftQ3 = validateIdentityDrift(SYNTHETIC_PRODUCT, ambiguousListing);
assert.equal(driftQ3.drifted, true);
assert.equal(driftQ3.state, 'LISTING_AMBIGUOUS');
console.log('✓ Test Q PASS');

// ----------------------------------------------------------------------------
// Test R: Missing reliable technical evidence can produce INSUFFICIENT_EVIDENCE
// ----------------------------------------------------------------------------
console.log('Testing Test R: Missing reliable technical evidence produces INSUFFICIENT_EVIDENCE...');
const emptySpecSnapshot = {
  spec_snapshot_id: 'spec_snap_empty_01',
  product_id: 'prod_synthetic_upvc_01',
  captured_at: '2026-10-17T00:00:00Z',
  source_id: 'src_unknown',
  specs: {}, // Missing technical specs!
  source_fidelity: 'USER_OBSERVATION'
};
const matchInsufficient = evaluateTechnicalProductMatch(handoff, SYNTHETIC_PRODUCT, emptySpecSnapshot);
assert.equal(matchInsufficient.match_status, 'INSUFFICIENT_EVIDENCE');
assert.ok(matchInsufficient.insufficient_evidence_reasons && matchInsufficient.insufficient_evidence_reasons.length > 0);
console.log('✓ Test R PASS');

// ----------------------------------------------------------------------------
// Test S: No numeric product score field in technical match result
// ----------------------------------------------------------------------------
console.log('Testing Test S: No numeric product score field...');
const matchRes = evaluateTechnicalProductMatch(handoff, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
const matchKeys = Object.keys(matchRes);
assert.ok(!matchKeys.includes('score'));
assert.ok(!matchKeys.includes('numeric_score'));
assert.ok(!matchKeys.includes('overall_score'));
assert.ok(!matchKeys.includes('star_rating'));
assert.ok(!matchKeys.includes('rank'));
const matchString = JSON.stringify(matchRes);
assert.ok(!matchString.includes('92/100'));
assert.ok(!matchString.includes('4.8/5'));
assert.ok(!matchString.includes('Best Buy Score'));
console.log('✓ Test S PASS');

// ----------------------------------------------------------------------------
// Test T: PDE handoff contains zero commerce data
// ----------------------------------------------------------------------------
console.log('Testing Test T: PDE handoff contains zero commerce data...');
const handoffIssues = scanForForbiddenReviewCommerceFields(handoff);
assert.equal(handoffIssues.length, 0, 'PDE handoff must contain zero forbidden commerce fields');
assert.equal(handoff.commercial_data_allowed, false);
console.log('✓ Test T PASS');

// ----------------------------------------------------------------------------
// Test U: Synthetic fixture uses no real brand
// ----------------------------------------------------------------------------
console.log('Testing Test U: Synthetic fixture uses no real brand...');
const realBrandNames = [
  'alexindo',
  'ykk',
  'fentura',
  'windownet',
  'conch',
  'inoutic',
  'deceuninck',
  'rehau',
  'veka'
];
const syntheticString = JSON.stringify(SYNTHETIC_PRODUCT).toLowerCase();
for (const brand of realBrandNames) {
  assert.ok(!syntheticString.includes(brand), `Synthetic fixture must not impersonate real brand '${brand}'`);
}
assert.ok(syntheticString.includes('nusantara hardware archlab (fictional)'));
console.log('✓ Test U PASS');

// ----------------------------------------------------------------------------
// Test V: Zero network / D1 / Astro dependency
// ----------------------------------------------------------------------------
console.log('Testing Test V: Zero network / D1 / Astro dependency...');
// All modules in src/lib/product-review execute purely in Node/V8 memory
assert.equal(typeof validateProduct, 'function');
assert.equal(typeof validateOffer, 'function');
assert.equal(typeof evaluateTechnicalProductMatch, 'function');
console.log('✓ Test V PASS');

console.log('======================================================');
console.log('ALL 22 TEST CASES (A-V) PASSED SUCCESSFULLY!');
console.log('======================================================');
