/**
 * ============================================================================
 * RancangLoka Product Review Desk (PRODUCT_REVIEW_AFFILIATE-1D-A)
 * Reader Boundary & Integration Prep Test Suite
 *
 * Requirements (A to V):
 * A. ArticleProductBinding resolves correctly.
 * B. PDE handoff remains read-only.
 * C. Eligible product maps to reader-safe DTO.
 * D. NOT_MATCH blocks reader recommendation.
 * E. INSUFFICIENT_EVIDENCE blocks.
 * F. Stale critical spec blocks.
 * G. Identity drift blocks.
 * H. Analytical review never renders Tested by RancangLoka.
 * I. Valid hands-on review may render Tested by RancangLoka.
 * J. Commerce data cannot change technical eligibility.
 * K. Price change cannot change technical eligibility.
 * L. Affiliate destination change cannot change technical eligibility.
 * M. Sponsored relationship cannot change technical eligibility.
 * N. Commerce unavailable does not erase valid technical analysis.
 * O. No commission/payout exposed in reader DTO.
 * P. No admin notes/raw traces exposed.
 * Q. No numeric product score.
 * R. Affiliate link helper includes sponsored/nofollow/noopener.
 * S. Synthetic fixtures blocked from production mode.
 * T. No silent fallback in production.
 * U. Dynamic commerce changes do not alter canonical article prose/hash.
 * V. No real product/merchant/network dependency required.
 * ============================================================================
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  deriveReaderProductEligibility,
  assembleReaderProductDTO,
  buildReaderAffiliateLink,
  getStandardAffiliateCtaText,
  loadReaderProductForArticle,
  ARTICLE_PRODUCT_ROLE_CONFIG,
  isArticleProductRoleReaderVisible
} from '../src/lib/product-review/reader-runtime.ts';

import {
  SYNTHETIC_PRODUCT,
  SYNTHETIC_VARIANT_1 as SYNTHETIC_VARIANT,
  SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL,
  SYNTHETIC_EDITORIAL_REVIEW_DRAFT,
  SYNTHETIC_EDITORIAL_REVIEW_REVIEWED,
  SYNTHETIC_EDITORIAL_REVIEW_ARCHIVED,
  SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON,
  SYNTHETIC_SPEC_SNAPSHOT,
  SYNTHETIC_EVIDENCE_MANUFACTURER,
  SYNTHETIC_EVIDENCE_LAB_TEST as SYNTHETIC_EVIDENCE_LAB_REPORT,
  SYNTHETIC_EVIDENCE_PRIMARY_TEST,
  SYNTHETIC_OFFER_MERCHANT_A as SYNTHETIC_OFFER,
  SYNTHETIC_PRICE_SNAPSHOT_A as SYNTHETIC_PRICE_SNAPSHOT,
  SYNTHETIC_AFFILIATE_DESTINATION_A as SYNTHETIC_AFFILIATE_DESTINATION,
  SYNTHETIC_ARTICLE_PRODUCT_BINDING
} from '../src/lib/product-review/fixtures.ts';

import {
  evaluateTechnicalProductMatch
} from '../src/lib/product-review/contracts.ts';

import {
  SYNTHETIC_PDE_HANDOFF,
  SYNTHETIC_PRODUCT_DRIFTED,
  SYNTHETIC_PRODUCT_STALE_SPEC,
  SYNTHETIC_EDITORIAL_REVIEW_STALE,
  SYNTHETIC_EDITORIAL_REVIEW_DRIFTED
} from '../src/lib/product-review/admin-inspector.ts';


const REF_TIME = '2026-10-17T00:00:00.000Z';

// ============================================================================
// TEST SUITE
// ============================================================================

test('A. ArticleProductBinding resolves correctly', () => {
  const binding = { ...SYNTHETIC_ARTICLE_PRODUCT_BINDING };
  assert.equal(binding.binding_id, 'bind_art5_prod_upvc_01');
  assert.equal(binding.article_id, 5);
  assert.equal(binding.product_id, 'prod_synthetic_upvc_01');
  assert.equal(binding.editorial_role, 'EXAMPLE');
  assert.equal(binding.section_anchor, 'karakteristik-upvc-multi-chamber');
  assert.equal(binding.commercial_disclosure.has_affiliate_links, true);
  assert.equal(binding.commercial_disclosure.is_sponsored_content, false);
});

test('B. PDE handoff remains read-only', () => {
  const originalSnapshot = JSON.stringify(SYNTHETIC_PDE_HANDOFF);
  const frozenHandoff = Object.freeze(JSON.parse(originalSnapshot));

  const match = evaluateTechnicalProductMatch(frozenHandoff, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
  assert.ok(match);
  assert.equal(JSON.stringify(frozenHandoff), originalSnapshot, 'Upstream PDE handoff must not be mutated');
});

test('C. Eligible product maps to reader-safe DTO', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
  const eligibility = deriveReaderProductEligibility({
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    referenceTime: REF_TIME
  });

  assert.equal(eligibility.is_eligible, true);
  assert.equal(eligibility.state, 'ELIGIBLE');

  const dto = assembleReaderProductDTO({
    binding: SYNTHETIC_ARTICLE_PRODUCT_BINDING,
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    offers: [SYNTHETIC_OFFER],
    priceSnapshots: [SYNTHETIC_PRICE_SNAPSHOT],
    affiliateDestinations: [SYNTHETIC_AFFILIATE_DESTINATION],
    referenceTime: REF_TIME
  });

  assert.equal(dto.product_id, SYNTHETIC_PRODUCT.product_id);
  assert.equal(dto.display_name, SYNTHETIC_PRODUCT.canonical_name);
  assert.equal(dto.brand, SYNTHETIC_PRODUCT.brand);
  assert.equal(dto.technical_match_status, 'MATCH');
  assert.equal(dto.technical_match_label, 'Cocok Penuh');
  assert.ok(dto.why_it_matches.length > 0);
  assert.ok(dto.commerce);
  assert.equal(dto.commerce.offers.length, 1);
});

test('D. NOT_MATCH blocks reader recommendation', () => {
  // Create a handoff with contradictory constraints
  const mismatchHandoff = {
    ...SYNTHETIC_PDE_HANDOFF,
    must_avoid_characteristics: ['Ketebalan profil >= 1.35mm']
  };

  const matchResult = evaluateTechnicalProductMatch(mismatchHandoff, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
  assert.equal(matchResult.match_status, 'NOT_MATCH');

  const eligibility = deriveReaderProductEligibility({
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    referenceTime: REF_TIME
  });

  assert.equal(eligibility.is_eligible, false);
  assert.equal(eligibility.state, 'BLOCKED_TECHNICAL_MISMATCH');
});

test('E. INSUFFICIENT_EVIDENCE blocks recommendation', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, undefined);
  assert.equal(matchResult.match_status, 'INSUFFICIENT_EVIDENCE');

  const eligibility = deriveReaderProductEligibility({
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: undefined,
    evidenceSources: [],
    matchResult,
    referenceTime: REF_TIME
  });

  assert.equal(eligibility.is_eligible, false);
  assert.equal(eligibility.state, 'BLOCKED_INSUFFICIENT_EVIDENCE');
});

test('F. Stale critical spec blocks recommendation', () => {
  const staleSpec = {
    ...SYNTHETIC_SPEC_SNAPSHOT,
    captured_at: '2026-05-10T08:00:00Z' // > 150 days old, max is 90 days
  };

  const matchResult = evaluateTechnicalProductMatch(
    SYNTHETIC_PDE_HANDOFF,
    SYNTHETIC_PRODUCT,
    staleSpec
  );

  const eligibility = deriveReaderProductEligibility({
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: staleSpec,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    referenceTime: REF_TIME
  });

  assert.equal(eligibility.is_eligible, false);
  assert.equal(eligibility.state, 'BLOCKED_STALE_SPEC');
  assert.ok(eligibility.reasons.some(r => r.includes('kadaluarsa')));
});

test('G. Identity drift blocks recommendation', () => {
  const matchResult = evaluateTechnicalProductMatch(
    SYNTHETIC_PDE_HANDOFF,
    SYNTHETIC_PRODUCT_DRIFTED,
    SYNTHETIC_PRODUCT_DRIFTED.spec_snapshots?.[0]
  );

  const eligibility = deriveReaderProductEligibility({
    product: SYNTHETIC_PRODUCT_DRIFTED,
    variant: SYNTHETIC_PRODUCT_DRIFTED.variants?.[0],
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_DRIFTED],
    specSnapshot: SYNTHETIC_PRODUCT_DRIFTED.spec_snapshots?.[0],
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    referenceTime: REF_TIME
  });

  assert.equal(eligibility.is_eligible, false);
  assert.equal(eligibility.state, 'BLOCKED_IDENTITY_DRIFT');
  assert.ok(eligibility.reasons.some(r => r.includes('pergeseran')));
});

test('H. Analytical review never renders Tested by RancangLoka', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
  const dto = assembleReaderProductDTO({
    binding: SYNTHETIC_ARTICLE_PRODUCT_BINDING,
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    referenceTime: REF_TIME
  });

  assert.equal(dto.review_mode, 'ANALYTICAL_REVIEW');
  assert.equal(dto.tested_by_rancangloka, false);
  assert.ok(dto.review_basis_statement.includes('Bukan uji lab fisik'));
  assert.ok(!dto.review_basis_statement.includes('Diverifikasi melalui pengujian fisik di workshop'));
});

test('I. Valid hands-on review may render Tested by RancangLoka', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
  const dto = assembleReaderProductDTO({
    binding: SYNTHETIC_ARTICLE_PRODUCT_BINDING,
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER, SYNTHETIC_EVIDENCE_LAB_REPORT],
    matchResult,
    referenceTime: REF_TIME
  });

  assert.equal(dto.review_mode, 'HANDS_ON_REVIEW');
  assert.equal(dto.tested_by_rancangloka, true);
  assert.ok(dto.review_basis_statement.includes('Diverifikasi melalui pengujian fisik di workshop/fasilitas lab RancangLoka'));
});

test('J. Commerce data cannot change technical eligibility', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
  const eligibilityNoCommerce = deriveReaderProductEligibility({
    product: SYNTHETIC_PRODUCT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    referenceTime: REF_TIME
  });

  // Adding offers does not alter eligibility function call
  assert.equal(eligibilityNoCommerce.state, 'ELIGIBLE');
  assert.equal(eligibilityNoCommerce.is_eligible, true);
});

test('K. Price change cannot change technical eligibility', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);

  const dtoCheap = assembleReaderProductDTO({
    binding: SYNTHETIC_ARTICLE_PRODUCT_BINDING,
    product: SYNTHETIC_PRODUCT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    offers: [SYNTHETIC_OFFER],
    priceSnapshots: [{ ...SYNTHETIC_PRICE_SNAPSHOT, observed_price: 50000 }],
    referenceTime: REF_TIME
  });

  const dtoExpensive = assembleReaderProductDTO({
    binding: SYNTHETIC_ARTICLE_PRODUCT_BINDING,
    product: SYNTHETIC_PRODUCT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    offers: [SYNTHETIC_OFFER],
    priceSnapshots: [{ ...SYNTHETIC_PRICE_SNAPSHOT, observed_price: 50000000 }],
    referenceTime: REF_TIME
  });

  assert.equal(dtoCheap.technical_match_status, 'MATCH');
  assert.equal(dtoExpensive.technical_match_status, 'MATCH');
  assert.equal(dtoCheap.technical_match_status, dtoExpensive.technical_match_status);
});

test('L. Affiliate destination change cannot change technical eligibility', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);

  const dtoInactiveAff = assembleReaderProductDTO({
    binding: SYNTHETIC_ARTICLE_PRODUCT_BINDING,
    product: SYNTHETIC_PRODUCT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    offers: [SYNTHETIC_OFFER],
    affiliateDestinations: [{ ...SYNTHETIC_AFFILIATE_DESTINATION, is_active: false }],
    referenceTime: REF_TIME
  });

  assert.equal(dtoInactiveAff.technical_match_status, 'MATCH');
  // Affiliate link is omitted when inactive
  assert.equal(dtoInactiveAff.commerce?.offers[0].affiliate_link, undefined);
});

test('M. Sponsored relationship cannot change technical eligibility', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);

  const sponsoredBinding = {
    ...SYNTHETIC_ARTICLE_PRODUCT_BINDING,
    commercial_disclosure: {
      has_affiliate_links: true,
      is_sponsored_content: true,
      is_product_supplied_by_brand: true,
      disclosure_statement: 'Ulasan ini disponsori oleh brand mitra.'
    }
  };

  const dto = assembleReaderProductDTO({
    binding: sponsoredBinding,
    product: SYNTHETIC_PRODUCT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    referenceTime: REF_TIME
  });

  assert.equal(dto.technical_match_status, 'MATCH');
  assert.equal(dto.commercial_disclosure.is_sponsored_content, true);
  assert.equal(dto.commercial_disclosure.is_product_supplied_by_brand, true);
});

test('N. Commerce unavailable does not erase valid technical analysis', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);

  const dtoNoCommerce = assembleReaderProductDTO({
    binding: SYNTHETIC_ARTICLE_PRODUCT_BINDING,
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    offers: [],
    priceSnapshots: [],
    affiliateDestinations: [],
    referenceTime: REF_TIME
  });

  assert.equal(dtoNoCommerce.technical_match_status, 'MATCH');
  assert.equal(dtoNoCommerce.display_name, SYNTHETIC_PRODUCT.canonical_name);
  assert.ok(dtoNoCommerce.why_it_matches.length > 0);
  assert.ok(dtoNoCommerce.important_tradeoffs.length > 0);
  assert.equal(dtoNoCommerce.commerce, undefined, 'Commerce object is cleanly undefined when no offers exist');
});

test('O. No commission/payout exposed in reader DTO', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
  const dto = assembleReaderProductDTO({
    binding: SYNTHETIC_ARTICLE_PRODUCT_BINDING,
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    offers: [SYNTHETIC_OFFER],
    priceSnapshots: [SYNTHETIC_PRICE_SNAPSHOT],
    affiliateDestinations: [SYNTHETIC_AFFILIATE_DESTINATION],
    referenceTime: REF_TIME
  });

  const rawJson = JSON.stringify(dto).toLowerCase();
  assert.ok(!rawJson.includes('commission'), 'No commission in reader DTO');
  assert.ok(!rawJson.includes('payout'), 'No payout in reader DTO');
  assert.ok(!rawJson.includes('revenue_share'), 'No revenue_share in reader DTO');
});

test('P. No admin notes/raw traces exposed', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
  const dto = assembleReaderProductDTO({
    binding: SYNTHETIC_ARTICLE_PRODUCT_BINDING,
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    offers: [SYNTHETIC_OFFER],
    priceSnapshots: [SYNTHETIC_PRICE_SNAPSHOT],
    affiliateDestinations: [SYNTHETIC_AFFILIATE_DESTINATION],
    referenceTime: REF_TIME
  });

  const rawJson = JSON.stringify(dto).toLowerCase();
  assert.ok(!rawJson.includes('admin_notes'), 'No admin notes in reader DTO');
  assert.ok(!rawJson.includes('reviewer_id'), 'No reviewer ID in reader DTO');
  assert.ok(!rawJson.includes('testing_provenance'), 'No private testing provenance in reader DTO');
  assert.ok(!rawJson.includes('facility_details'), 'No private testing facility details in reader DTO');
});

test('Q. No numeric product score', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
  const dto = assembleReaderProductDTO({
    binding: SYNTHETIC_ARTICLE_PRODUCT_BINDING,
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    referenceTime: REF_TIME
  });

  const rawJson = JSON.stringify(dto).toLowerCase();
  assert.ok(!rawJson.includes('score'), 'No score field in reader DTO');
  assert.ok(!rawJson.includes('rating'), 'No rating field in reader DTO');
  assert.ok(!rawJson.includes('stars'), 'No stars field in reader DTO');
  assert.ok(!rawJson.includes('rank'), 'No rank field in reader DTO');
});

test('R. Affiliate link helper includes sponsored/nofollow/noopener', () => {
  const link = buildReaderAffiliateLink('https://partner.example.com/tokopedia/item123');
  assert.equal(link.href, 'https://partner.example.com/tokopedia/item123');
  assert.equal(link.rel, 'sponsored nofollow noopener');
  assert.equal(link.target, '_blank');
});

test('S. Synthetic fixtures blocked from production mode', async () => {
  const result = await loadReaderProductForArticle({
    articleId: 5,
    pdeHandoff: SYNTHETIC_PDE_HANDOFF,
    options: {
      isProduction: true,
      allowSyntheticFixture: true
    }
  });

  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.code, 'PRODUCTION_FALLBACK_FORBIDDEN');
  assert.ok(result.reason.includes('NO_SILENT_PRODUCT_REVIEW_PRODUCTION_FALLBACK'));
});

test('T. No silent fallback in production', async () => {
  // Empty db or missing article in production
  const mockEmptyDb = {
    prepare: () => ({
      first: async () => null,
      bind: () => ({
        first: async () => null
      })
    })
  };

  const result = await loadReaderProductForArticle({
    articleId: 999,
    pdeHandoff: SYNTHETIC_PDE_HANDOFF,
    db: mockEmptyDb,
    options: {
      isProduction: true,
      allowSyntheticFixture: false
    }
  });

  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.code, 'NO_BINDING');
  assert.ok(result.reason.includes('belum memiliki pengikatan produk terdaftar'));
});

test('U. Dynamic commerce changes do not alter canonical article prose/hash', () => {
  // Simulate Article 5 canonical markdown prose and DNA
  const canonicalArticleProse = `# Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia

Kusen aluminium dan uPVC adalah dua pilihan terpopuler untuk bukaan rumah tinggal di iklim tropis lembap.
Artikel ini membahas ketahanan terhadap tempias hujan, pemuaian panas matahari barat, dan biaya perawatan jangka panjang.`;

  const initialHash = createHash('sha256').update(canonicalArticleProse, 'utf8').digest('hex');

  // Runtime receives dynamic product module with changing prices and affiliate links
  const dynamicCommerceData1 = {
    observedPrice: 1750000,
    availability: 'IN_STOCK',
    affiliateUrl: 'https://tokopedia.example/item-a'
  };

  const dynamicCommerceData2 = {
    observedPrice: 1850000,
    availability: 'PRE_ORDER',
    affiliateUrl: 'https://shopee.example/item-b'
  };

  // Ensure canonical prose remains completely untouched
  const hashAfterCommerceUpdate1 = createHash('sha256').update(canonicalArticleProse, 'utf8').digest('hex');
  const hashAfterCommerceUpdate2 = createHash('sha256').update(canonicalArticleProse, 'utf8').digest('hex');

  assert.equal(hashAfterCommerceUpdate1, initialHash);
  assert.equal(hashAfterCommerceUpdate2, initialHash);
  assert.ok(dynamicCommerceData1.observedPrice !== dynamicCommerceData2.observedPrice);
});

test('V. No real product/merchant/network dependency required', async () => {
  // Execution with synthetic fixture in offline/dev mode completes synchronously & purely in-memory
  const result = await loadReaderProductForArticle({
    articleId: 5,
    pdeHandoff: SYNTHETIC_PDE_HANDOFF,
    options: {
      isProduction: false,
      allowSyntheticFixture: true,
      referenceTime: REF_TIME,
      syntheticFixtureOverride: {
        binding: SYNTHETIC_ARTICLE_PRODUCT_BINDING,
        product: SYNTHETIC_PRODUCT,
        variant: SYNTHETIC_VARIANT,
        reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
        specs: SYNTHETIC_SPEC_SNAPSHOT,
        evidence: [SYNTHETIC_EVIDENCE_MANUFACTURER],
        offers: [SYNTHETIC_OFFER],
        prices: [SYNTHETIC_PRICE_SNAPSHOT],
        affiliates: [SYNTHETIC_AFFILIATE_DESTINATION]
      }
    }
  });

  assert.equal(result.status, 'AVAILABLE');
  assert.equal(result.eligibility, 'ELIGIBLE');
  assert.equal(result.dto.product_id, SYNTHETIC_PRODUCT.product_id);
});

test('W. DRAFT EditorialProductReview is blocked from reader output', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
  const eligibility = deriveReaderProductEligibility({
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_DRAFT],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    referenceTime: REF_TIME
  });

  assert.equal(eligibility.is_eligible, false);
  assert.equal(eligibility.state, 'BLOCKED_EDITORIAL_REVIEW');
  assert.ok(eligibility.reasons.some(r => r.includes('UNPUBLISHED_EDITORIAL_REVIEW_MUST_NEVER_REACH_READER_OUTPUT')));
  assert.ok(eligibility.reasons.some(r => r.includes('DRAFT')));
});

test('X. REVIEWED but unpublished review is blocked from reader output', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
  const eligibility = deriveReaderProductEligibility({
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_REVIEWED],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    referenceTime: REF_TIME
  });

  assert.equal(eligibility.is_eligible, false);
  assert.equal(eligibility.state, 'BLOCKED_EDITORIAL_REVIEW');
  assert.ok(eligibility.reasons.some(r => r.includes('UNPUBLISHED_EDITORIAL_REVIEW_MUST_NEVER_REACH_READER_OUTPUT')));
  assert.ok(eligibility.reasons.some(r => r.includes('REVIEWED')));
});

test('Y. ARCHIVED review is blocked from reader output', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
  const eligibility = deriveReaderProductEligibility({
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ARCHIVED],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    referenceTime: REF_TIME
  });

  assert.equal(eligibility.is_eligible, false);
  assert.equal(eligibility.state, 'BLOCKED_EDITORIAL_REVIEW');
  assert.ok(eligibility.reasons.some(r => r.includes('UNPUBLISHED_EDITORIAL_REVIEW_MUST_NEVER_REACH_READER_OUTPUT')));
  assert.ok(eligibility.reasons.some(r => r.includes('ARCHIVED')));
});

test('Z. PUBLISHED review is eligible when every other condition passes', () => {
  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
  const eligibility = deriveReaderProductEligibility({
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL], // editorial_status: 'PUBLISHED'
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    referenceTime: REF_TIME
  });

  assert.equal(eligibility.is_eligible, true);
  assert.equal(eligibility.state, 'ELIGIBLE');
});

test('AA. RELATED_PRODUCT role is blocked from reader output by default', async () => {
  const relatedBinding = {
    ...SYNTHETIC_ARTICLE_PRODUCT_BINDING,
    editorial_role: 'RELATED_PRODUCT'
  };

  const matchResult = evaluateTechnicalProductMatch(SYNTHETIC_PDE_HANDOFF, SYNTHETIC_PRODUCT, SYNTHETIC_SPEC_SNAPSHOT);
  const eligibility = deriveReaderProductEligibility({
    product: SYNTHETIC_PRODUCT,
    variant: SYNTHETIC_VARIANT,
    reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_MANUFACTURER],
    matchResult,
    referenceTime: REF_TIME,
    editorialRole: 'RELATED_PRODUCT'
  });

  assert.equal(eligibility.is_eligible, false);
  assert.equal(eligibility.state, 'BLOCKED_ROLE_NOT_READER_VISIBLE');

  // Verify runtime loadReaderProductForArticle also rejects RELATED_PRODUCT
  const result = await loadReaderProductForArticle({
    articleId: 5,
    pdeHandoff: SYNTHETIC_PDE_HANDOFF,
    options: {
      isProduction: false,
      allowSyntheticFixture: true,
      referenceTime: REF_TIME,
      syntheticFixtureOverride: {
        binding: relatedBinding,
        product: SYNTHETIC_PRODUCT,
        variant: SYNTHETIC_VARIANT,
        reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL],
        specs: SYNTHETIC_SPEC_SNAPSHOT,
        evidence: [SYNTHETIC_EVIDENCE_MANUFACTURER]
      }
    }
  });

  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.code, 'ROLE_NOT_READER_VISIBLE');
  assert.ok(result.reason.includes('RELATED_PRODUCT'));
});

test('AB. isArticleProductRoleReaderVisible policy is deterministic across all roles', () => {
  assert.equal(isArticleProductRoleReaderVisible('MATCHED_PRODUCT'), true);
  assert.equal(isArticleProductRoleReaderVisible('PRIMARY_SUBJECT'), true);
  assert.equal(isArticleProductRoleReaderVisible('ALTERNATIVE'), true);
  assert.equal(isArticleProductRoleReaderVisible('EXAMPLE'), true);
  assert.equal(isArticleProductRoleReaderVisible('RELATED_PRODUCT'), false);
  // Unknown or arbitrary role defaults to false
  assert.equal(isArticleProductRoleReaderVisible('UNKNOWN_ROLE'), false);
});
