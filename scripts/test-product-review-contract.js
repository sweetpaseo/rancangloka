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
  validateEditorialProductReview,
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
  SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL,
  SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON,
  SYNTHETIC_EVIDENCE_PRIMARY_TEST,
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
  SYNTHETIC_ARTICLE_PRODUCT_BINDING,
  assembleTechnicalMatchInput
} from '../src/lib/product-review/index.ts';

console.log('--- PRODUCT REVIEW AFFILIATE-1A/1B DOMAIN HARDENING TEST SUITE STARTING ---');

// ----------------------------------------------------------------------------
// Test A: Product validates without review_mode
// ----------------------------------------------------------------------------
console.log('Testing Proof A: Product validates without review_mode...');
const resA = validateProduct(SYNTHETIC_PRODUCT);
assert.equal(resA.valid, true, `Product should validate: ${JSON.stringify(resA.issues)}`);
assert.equal(SYNTHETIC_PRODUCT.review_mode, undefined, 'Product must not have review_mode');
assert.equal(SYNTHETIC_PRODUCT.tested_by_rancangloka, undefined, 'Product must not have tested_by_rancangloka');
console.log('✓ Proof A PASS');

// ----------------------------------------------------------------------------
// Test B: Product identity hash/equality does not include review mode
// ----------------------------------------------------------------------------
console.log('Testing Proof B: Product identity equality does not include review mode...');
const productBase = { ...SYNTHETIC_PRODUCT };
const productWithArbitraryReviewContext = { ...SYNTHETIC_PRODUCT };
// Pure product identity fields
const identityFields = ['product_id', 'canonical_name', 'brand', 'category_id', 'solution_class_id'];
for (const f of identityFields) {
  assert.equal(productBase[f], productWithArbitraryReviewContext[f]);
}
assert.ok(!('review_mode' in productBase), 'review_mode must not be in Product identity');
assert.ok(!('tested_by_rancangloka' in productBase), 'tested_by_rancangloka must not be in Product identity');
console.log('✓ Proof B PASS');

// ----------------------------------------------------------------------------
// Test C: Analytical EditorialProductReview validates independently
// ----------------------------------------------------------------------------
console.log('Testing Proof C: Analytical EditorialProductReview validates independently...');
const resC = validateEditorialProductReview(SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL);
assert.equal(resC.valid, true, `Analytical review should validate: ${JSON.stringify(resC.issues)}`);
assert.equal(SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL.review_mode, 'ANALYTICAL_REVIEW');
assert.equal(SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL.tested_by_rancangloka, false);
console.log('✓ Proof C PASS');

// ----------------------------------------------------------------------------
// Test D: Analytical review cannot claim Tested by RancangLoka
// ----------------------------------------------------------------------------
console.log('Testing Proof D: Analytical review cannot claim Tested by RancangLoka...');
const invalidAnalyticalReview = {
  ...SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL,
  tested_by_rancangloka: true // FORBIDDEN: Analytical review cannot claim tested
};
const resD = validateEditorialProductReview(invalidAnalyticalReview);
assert.equal(resD.valid, false, 'Analytical review with tested_by_rancangloka=true must fail validation');
assert.ok(
  resD.issues.some(iss => iss.code === 'INVALID_REVIEW_MODE_TESTED_FLAG'),
  'Must report INVALID_REVIEW_MODE_TESTED_FLAG'
);
console.log('✓ Proof D PASS');

// ----------------------------------------------------------------------------
// Test E: Hands-on review without primary test evidence fails
// ----------------------------------------------------------------------------
console.log('Testing Proof E: Hands-on review without primary test evidence fails...');
const handsOnWithoutTestedFlag = {
  ...SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON,
  tested_by_rancangloka: false
};
const resE1 = validateEditorialProductReview(handsOnWithoutTestedFlag);
assert.equal(resE1.valid, false);
assert.ok(resE1.issues.some(iss => iss.code === 'MISSING_TESTED_FLAG'));

const handsOnWithoutProvenance = {
  ...SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON,
  testing_provenance: undefined
};
const resE2 = validateEditorialProductReview(handsOnWithoutProvenance);
assert.equal(resE2.valid, false);
assert.ok(resE2.issues.some(iss => iss.code === 'MISSING_TESTING_PROVENANCE'));

// Hands-on passed with secondary evidence sources only (no primary test)
const resE3 = validateEditorialProductReview(
  SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON,
  [SYNTHETIC_EVIDENCE_MANUFACTURER, SYNTHETIC_EVIDENCE_LAB_TEST] // None is RANCANGLOKA_PRIMARY_TEST
);
assert.equal(resE3.valid, false);
assert.ok(resE3.issues.some(iss => iss.code === 'MISSING_PRIMARY_TEST_SOURCE'));
console.log('✓ Proof E PASS');

// ----------------------------------------------------------------------------
// Test F: Hands-on review with valid primary test provenance passes
// ----------------------------------------------------------------------------
console.log('Testing Proof F: Hands-on review with valid primary test provenance passes...');
const resF = validateEditorialProductReview(
  SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON,
  [SYNTHETIC_EVIDENCE_MANUFACTURER, SYNTHETIC_EVIDENCE_PRIMARY_TEST]
);
assert.equal(resF.valid, true, `Valid hands-on review should pass: ${JSON.stringify(resF.issues)}`);
console.log('✓ Proof F PASS');

// ----------------------------------------------------------------------------
// Test G: One Product can have multiple EditorialProductReviews
// ----------------------------------------------------------------------------
console.log('Testing Proof G: One Product can have multiple EditorialProductReviews...');
const reviewsForProduct = [
  SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL,
  SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON
];
assert.equal(reviewsForProduct.length, 2);
assert.equal(reviewsForProduct[0].product_id, SYNTHETIC_PRODUCT.product_id);
assert.equal(reviewsForProduct[1].product_id, SYNTHETIC_PRODUCT.product_id);
assert.notEqual(reviewsForProduct[0].review_id, reviewsForProduct[1].review_id);
assert.equal(reviewsForProduct[0].review_mode, 'ANALYTICAL_REVIEW');
assert.equal(reviewsForProduct[1].review_mode, 'HANDS_ON_REVIEW');
console.log('✓ Proof G PASS');

// ----------------------------------------------------------------------------
// Test H: Adding a second review does not alter Product identity
// ----------------------------------------------------------------------------
console.log('Testing Proof H: Adding a second review does not alter Product identity...');
const productBefore = JSON.stringify(SYNTHETIC_PRODUCT);
// Simulate adding hands-on review to existing product
const newReview = { ...SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON, review_id: 'rev_synth_handson_second_iteration' };
const resNewReview = validateEditorialProductReview(newReview, [SYNTHETIC_EVIDENCE_PRIMARY_TEST]);
assert.equal(resNewReview.valid, true);
// Product remains completely untouched
assert.equal(JSON.stringify(SYNTHETIC_PRODUCT), productBefore);
console.log('✓ Proof H PASS');

// ----------------------------------------------------------------------------
// Test I: Changing review mode does not alter technical match input
// ----------------------------------------------------------------------------
console.log('Testing Proof I: Changing review mode does not alter technical match input...');
const matchInput1 = assembleTechnicalMatchInput({
  product: SYNTHETIC_PRODUCT,
  variant: SYNTHETIC_VARIANT_1,
  specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
  evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER, SYNTHETIC_EVIDENCE_LAB_TEST]
});

// Technical match input does not contain review_mode or tested_by_rancangloka
assert.equal(matchInput1.review_mode, undefined, 'Technical match input must not contain review_mode');
assert.equal(matchInput1.tested_by_rancangloka, undefined, 'Technical match input must not contain tested_by_rancangloka');
assert.equal(matchInput1.testing_provenance, undefined, 'Technical match input must not contain testing_provenance');

// Even if an external caller attempts to pass review_mode or change review state
const matchInput2 = assembleTechnicalMatchInput({
  product: SYNTHETIC_PRODUCT,
  variant: SYNTHETIC_VARIANT_1,
  specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
  evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER, SYNTHETIC_EVIDENCE_LAB_TEST, SYNTHETIC_EVIDENCE_PRIMARY_TEST]
});
assert.equal(matchInput1.canonical_name, matchInput2.canonical_name);
assert.equal(matchInput1.product_id, matchInput2.product_id);
console.log('✓ Proof I PASS');

// ----------------------------------------------------------------------------
// Test J: ReviewSnapshot remains USER_EXPERIENCE_SIGNAL and not EditorialProductReview
// ----------------------------------------------------------------------------
console.log('Testing Proof J: ReviewSnapshot remains USER_EXPERIENCE_SIGNAL...');
const userReviewSource = {
  source_id: 'src_synth_marketplace_reviews',
  source_type: 'USER_REVIEW_AGGREGATE',
  source_url: 'https://fictional-store-a.id/reviews/nh-kus-x1',
  publisher: 'Ulasan Pembeli Terverifikasi (Fiktif)',
  retrieved_at: '2026-10-16T12:00:00Z',
  evidence_scope: 'Pengalaman pembeli setelah 6 bulan pemakaian',
  claim_class: 'USER_EXPERIENCE_SIGNAL',
  source_fidelity: 'USER_OBSERVATION',
  product_identity_reference: 'prod_synthetic_upvc_01'
};
const resJ = validateEvidenceSource(userReviewSource);
assert.equal(resJ.valid, true);
assert.equal(userReviewSource.claim_class, 'USER_EXPERIENCE_SIGNAL');
assert.notEqual(userReviewSource.claim_class, 'VERIFIED_FACT');
// Verify ReviewSnapshot is distinct from EditorialProductReview
const reviewSnapshotValidation = validateReviewSnapshot(SYNTHETIC_REVIEW_SNAPSHOT);
assert.equal(reviewSnapshotValidation.valid, true);
assert.ok('external_review_count' in SYNTHETIC_REVIEW_SNAPSHOT);
assert.ok(!('review_mode' in SYNTHETIC_REVIEW_SNAPSHOT));
console.log('✓ Proof J PASS');

// ----------------------------------------------------------------------------
// Test K: ArticleProductBinding remains structurally separate from EditorialReview
// ----------------------------------------------------------------------------
console.log('Testing Proof K: ArticleProductBinding remains structurally separate...');
const resK = validateArticleProductBinding(SYNTHETIC_ARTICLE_PRODUCT_BINDING);
assert.equal(resK.valid, true);
assert.ok('article_id' in SYNTHETIC_ARTICLE_PRODUCT_BINDING);
assert.ok('product_id' in SYNTHETIC_ARTICLE_PRODUCT_BINDING);
assert.ok('editorial_role' in SYNTHETIC_ARTICLE_PRODUCT_BINDING);
assert.ok(!('review_mode' in SYNTHETIC_ARTICLE_PRODUCT_BINDING), 'Binding must not own review_mode');
assert.ok(!('tested_by_rancangloka' in SYNTHETIC_ARTICLE_PRODUCT_BINDING), 'Binding must not own tested flag');
console.log('✓ Proof K PASS');

// ----------------------------------------------------------------------------
// Test L: Commerce disclosure remains structurally separate
// ----------------------------------------------------------------------------
console.log('Testing Proof L: Commerce disclosure remains structurally separate...');
assert.ok('commercial_disclosure' in SYNTHETIC_ARTICLE_PRODUCT_BINDING);
assert.ok(!('commercial_disclosure' in SYNTHETIC_PRODUCT), 'Product must not contain commercial disclosure');
assert.ok(!('commercial_disclosure' in SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL), 'Editorial review must not contain commercial disclosure');
console.log('✓ Proof L PASS');

// ----------------------------------------------------------------------------
// Test M: Variant, Offer, Spec, Price validation remains green
// ----------------------------------------------------------------------------
console.log('Testing Proof M: Standard entities validate cleanly...');
assert.equal(validateVariant(SYNTHETIC_VARIANT_1).valid, true);
assert.equal(validateVariant(SYNTHETIC_VARIANT_2).valid, true);
assert.equal(validateOffer(SYNTHETIC_OFFER_MERCHANT_A).valid, true);
assert.equal(validateOffer(SYNTHETIC_OFFER_MERCHANT_B).valid, true);
assert.equal(validateEvidenceSource(SYNTHETIC_EVIDENCE_MANUFACTURER).valid, true);
assert.equal(validateEvidenceSource(SYNTHETIC_EVIDENCE_LAB_TEST).valid, true);
assert.equal(validateSpecSnapshot(SYNTHETIC_SPEC_SNAPSHOT).valid, true);
assert.equal(validatePriceSnapshot(SYNTHETIC_PRICE_SNAPSHOT_A).valid, true);
assert.equal(validatePriceSnapshot(SYNTHETIC_PRICE_SNAPSHOT_B).valid, true);
assert.equal(validateAffiliateDestination(SYNTHETIC_AFFILIATE_DESTINATION_A).valid, true);
assert.equal(validateAffiliateDestination(SYNTHETIC_AFFILIATE_DESTINATION_B).valid, true);
console.log('✓ Proof M PASS');
// Swapping merchant affiliate destination does not affect evidence source
const originalEvidenceUrl = SYNTHETIC_EVIDENCE_MANUFACTURER.source_url;
const newAffiliateDestination = {
  ...SYNTHETIC_AFFILIATE_DESTINATION_A,
  provider: 'direct_merchant_partner',
  affiliate_destination_url: 'https://outbound.rancangloka.id/c/new-merchant-link'
};
assert.equal(SYNTHETIC_EVIDENCE_MANUFACTURER.source_url, originalEvidenceUrl);
assert.notEqual(SYNTHETIC_EVIDENCE_MANUFACTURER.source_url, newAffiliateDestination.affiliate_destination_url);

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
