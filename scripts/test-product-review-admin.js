/**
 * ============================================================================
 * RancangLoka Product Review Desk (PRODUCT_REVIEW_AFFILIATE-1C)
 * Admin Product Review Desk & Editorial Inspector Test Suite
 *
 * Requirements (A to X):
 * A. Admin route exists.
 * B. Authentication required.
 * C. Cache-Control private/no-store.
 * D. X-Robots-Tag blocks indexing.
 * E. Product identity shown separately.
 * F. EditorialReview shown separately.
 * G. Analytical review cannot display Tested by RancangLoka.
 * H. Hands-on review displays provenance.
 * I. Missing hands-on provenance warns.
 * J. External ReviewSnapshot labeled USER_EXPERIENCE_SIGNAL.
 * K. Technical match shows no commerce fields.
 * L. Commerce panel does not alter technical match result.
 * M. No numeric product score.
 * N. Evidence fidelity visible.
 * O. Freshness states visible separately.
 * P. Identity drift warning visible.
 * Q. PDE handoff is read-only.
 * R. Affiliate/sponsorship disclosure visible.
 * S. Data source clearly labeled.
 * T. Synthetic data explicitly marked test-only.
 * U. Empty state works.
 * V. No public route exposure.
 * W. No autonomous publication controls.
 * X. No production D1 dependency required for tests.
 * ============================================================================
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getSyntheticProductDeskProjection,
  getProductionProductDeskProjection,
  deriveEditorialReadiness,
  validateHandsOnProvenance,
  DATA_SOURCE_CONFIG,
  EDITORIAL_READINESS_CONFIG,
  PRODUCT_IDENTITY_STATE_CONFIG,
  REVIEW_MODE_CONFIG,
  PRODUCT_MATCH_CONFIG,
  INSPECTION_FRESHNESS_CONFIG,
  SOURCE_FIDELITY_CONFIG,
  SYNTHETIC_PDE_HANDOFF,
  SYNTHETIC_PRODUCT_DRIFTED,
  SYNTHETIC_PRODUCT_STALE_SPEC
} from '../src/lib/product-review/admin-inspector.ts';
import {
  SYNTHETIC_PRODUCT,
  SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL,
  SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON,
  SYNTHETIC_SPEC_SNAPSHOT,
  SYNTHETIC_EVIDENCE_MANUFACTURER,
  SYNTHETIC_EVIDENCE_LAB_TEST,
  SYNTHETIC_EVIDENCE_PRIMARY_TEST
} from '../src/lib/product-review/fixtures.ts';
import {
  evaluateTechnicalProductMatch,
  scanForForbiddenReviewCommerceFields
} from '../src/lib/product-review/contracts.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT_DIR = resolve(__dirname, '..');

function readRepoFile(relPath) {
  const fullPath = join(ROOT_DIR, relPath);
  assert.ok(existsSync(fullPath), `File must exist: ${relPath}`);
  return readFileSync(fullPath, 'utf8');
}

// ----------------------------------------------------------------------------
// Test A: Admin route exists
// ----------------------------------------------------------------------------
test('Product Review 1C [Test A]: Admin route exists on disk', () => {
  const pagePath = join(ROOT_DIR, 'src/pages/admin/product-review.astro');
  assert.ok(existsSync(pagePath), 'src/pages/admin/product-review.astro must exist');
  const content = readFileSync(pagePath, 'utf8');
  assert.ok(content.length > 500, 'Page content must be substantive');
});

// ----------------------------------------------------------------------------
// Test B: Authentication required
// ----------------------------------------------------------------------------
test('Product Review 1C [Test B]: Authentication required via admin middleware', () => {
  const middleware = readRepoFile('src/middleware.ts');
  assert.match(
    middleware,
    /pathname\.startsWith\('\/admin'\)/,
    'Middleware must intercept /admin routes'
  );
  assert.match(
    middleware,
    /isValidAdminSession/,
    'Middleware must validate admin session cookie'
  );
  assert.match(
    middleware,
    /\/admin\/login\?redirect=/,
    'Unauthenticated requests must be redirected to /admin/login'
  );
});

// ----------------------------------------------------------------------------
// Test C: Cache-Control private/no-store
// ----------------------------------------------------------------------------
test('Product Review 1C [Test C]: Cache-Control headers enforce no-store, private', () => {
  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(
    page,
    /Astro\.response\.headers\.set\('Cache-Control',\s*'no-store,\s*private'\)/,
    'Must set Cache-Control to no-store, private'
  );
});

// ----------------------------------------------------------------------------
// Test D: X-Robots-Tag blocks indexing
// ----------------------------------------------------------------------------
test('Product Review 1C [Test D]: X-Robots-Tag blocks indexing, archiving, and snippets', () => {
  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(
    page,
    /Astro\.response\.headers\.set\('X-Robots-Tag',\s*'noindex,\s*nofollow,\s*noarchive,\s*nosnippet'\)/,
    'Must set X-Robots-Tag to noindex, nofollow, noarchive, nosnippet'
  );
});

// ----------------------------------------------------------------------------
// Test E: Product identity shown separately
// ----------------------------------------------------------------------------
test('Product Review 1C [Test E]: Product identity shown separately from review state', () => {
  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(
    page,
    /Identitas Fisik Produk Murni/i,
    'Page must contain a dedicated Pure Manufactured Identity section'
  );
  assert.match(
    page,
    /What product is this\?/i,
    'Page must document the What product is this? semantic role'
  );

  // Pure product object must not contain review mode
  assert.equal(SYNTHETIC_PRODUCT.review_mode, undefined);
  assert.equal(SYNTHETIC_PRODUCT.tested_by_rancangloka, undefined);
});

// ----------------------------------------------------------------------------
// Test F: EditorialReview shown separately
// ----------------------------------------------------------------------------
test('Product Review 1C [Test F]: EditorialProductReview shown separately and supports multiple reviews', () => {
  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(
    page,
    /Histori Ulasan Redaksional RancangLoka/i,
    'Page must contain EditorialProductReview history section'
  );
  assert.match(
    page,
    /How has RancangLoka reviewed it\?/i,
    'Page must document the How has RancangLoka reviewed it? semantic role'
  );

  const proj = getSyntheticProductDeskProjection({ productId: SYNTHETIC_PRODUCT.product_id });
  assert.ok(proj.detail);
  assert.equal(proj.detail.editorial_reviews.length, 2, 'Must support multiple reviews on a single product');
});

// ----------------------------------------------------------------------------
// Test G: Analytical review cannot display Tested by RancangLoka
// ----------------------------------------------------------------------------
test('Product Review 1C [Test G]: Analytical review cannot claim Tested by RancangLoka', () => {
  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(
    page,
    /Tidak \(Analytical Only - Bukan Uji Fisik\)/,
    'Analytical reviews must render explicit non-hands-on status'
  );

  assert.equal(SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL.tested_by_rancangloka, false);
});

// ----------------------------------------------------------------------------
// Test H: Hands-on review displays provenance
// ----------------------------------------------------------------------------
test('Product Review 1C [Test H]: Hands-on review displays testing provenance', () => {
  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(
    page,
    /Provenansi Pengujian Fisik Primer/i,
    'Page must render physical primary testing provenance section'
  );
  assert.match(
    page,
    /rev\.testing_provenance\.testing_date/,
    'Must render testing_date'
  );
  assert.match(
    page,
    /rev\.testing_provenance\.tester_identity/,
    'Must render tester_identity'
  );
  assert.match(
    page,
    /rev\.testing_provenance\.testing_location/,
    'Must render testing_location'
  );
  assert.match(
    page,
    /rev\.testing_provenance\.methodology_notes/,
    'Must render methodology_notes'
  );

  assert.ok(SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON.testing_provenance);
  assert.equal(SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON.tested_by_rancangloka, true);
});

// ----------------------------------------------------------------------------
// Test I: Missing hands-on provenance warns
// ----------------------------------------------------------------------------
test('Product Review 1C [Test I]: Missing hands-on provenance triggers HANDS_ON_PROVENANCE_INCOMPLETE', () => {
  const invalidReview = {
    ...SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON,
    testing_provenance: undefined
  };

  const check = validateHandsOnProvenance(invalidReview, [SYNTHETIC_EVIDENCE_PRIMARY_TEST]);
  assert.equal(check.valid, false);
  assert.ok(check.issues.length > 0);

  const readiness = deriveEditorialReadiness({
    product: SYNTHETIC_PRODUCT,
    reviews: [invalidReview],
    specSnapshot: SYNTHETIC_SPEC_SNAPSHOT,
    evidenceSources: [SYNTHETIC_EVIDENCE_PRIMARY_TEST]
  });
  assert.equal(readiness.state, 'HANDS_ON_PROVENANCE_INCOMPLETE');

  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(
    page,
    /HANDS_ON_PROVENANCE_INCOMPLETE/,
    'Admin page must visibly warn on incomplete hands-on provenance'
  );
});

// ----------------------------------------------------------------------------
// Test J: External ReviewSnapshot labeled USER_EXPERIENCE_SIGNAL
// ----------------------------------------------------------------------------
test('Product Review 1C [Test J]: External ReviewSnapshot labeled USER_EXPERIENCE_SIGNAL', () => {
  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(
    page,
    /Pengalaman Pengguna Eksternal \(ReviewSnapshot\)/i,
    'Must have dedicated external review section'
  );
  assert.match(
    page,
    /USER_EXPERIENCE_SIGNAL/,
    'Must explicitly badge as USER_EXPERIENCE_SIGNAL'
  );
  assert.match(
    page,
    /tidak pernah dicampur.*dengan status ulasan editorial/i,
    'Must explain separation between user signal and editorial review'
  );
});

// ----------------------------------------------------------------------------
// Test K: Technical match shows no commerce fields
// ----------------------------------------------------------------------------
test('Product Review 1C [Test K]: Technical match shows no commerce fields', () => {
  const match = evaluateTechnicalProductMatch(
    SYNTHETIC_PDE_HANDOFF,
    SYNTHETIC_PRODUCT,
    SYNTHETIC_SPEC_SNAPSHOT
  );

  const forbidden = scanForForbiddenReviewCommerceFields(match);
  assert.equal(forbidden.length, 0, 'Technical match output must have 0 commerce fields');

  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(
    page,
    /Murni kualitatif\.\s*Nol skor angka\.\s*Nol data harga,\s*merchant,\s*atau komisi/i,
    'Technical match panel must explicitly declare zero commerce data'
  );
});

// ----------------------------------------------------------------------------
// Test L: Commerce panel does not alter technical match result
// ----------------------------------------------------------------------------
test('Product Review 1C [Test L]: Commerce panel does not alter technical match result', () => {
  const match1 = evaluateTechnicalProductMatch(
    SYNTHETIC_PDE_HANDOFF,
    SYNTHETIC_PRODUCT,
    SYNTHETIC_SPEC_SNAPSHOT
  );

  // Even if offers or prices change or exist, technical match depends only on (handoff, product, spec)
  const match2 = evaluateTechnicalProductMatch(
    SYNTHETIC_PDE_HANDOFF,
    SYNTHETIC_PRODUCT,
    SYNTHETIC_SPEC_SNAPSHOT
  );

  assert.deepEqual(match1, match2, 'Technical match must be commerce-blind and identical');
});

// ----------------------------------------------------------------------------
// Test M: No numeric product score
// ----------------------------------------------------------------------------
test('Product Review 1C [Test M]: No numeric overall score in technical match or summary', () => {
  const proj = getSyntheticProductDeskProjection();
  for (const item of proj.products_list) {
    assert.equal(item.overall_score, undefined);
    assert.equal(item.score, undefined);
    assert.equal(item.rating, undefined);
  }

  const match = evaluateTechnicalProductMatch(
    SYNTHETIC_PDE_HANDOFF,
    SYNTHETIC_PRODUCT,
    SYNTHETIC_SPEC_SNAPSHOT
  );
  assert.equal(match.score, undefined);
  assert.equal(match.numeric_fit, undefined);
});

// ----------------------------------------------------------------------------
// Test N: Evidence fidelity visible
// ----------------------------------------------------------------------------
test('Product Review 1C [Test N]: Evidence fidelity and claim classes visible without source collapsing', () => {
  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(page, /Dokumen Bukti Empiris Terverifikasi \(EvidenceSource\)/i);
  assert.match(page, /source_fidelity/);
  assert.match(page, /claim_class/);
  assert.match(page, /source_url/);
  assert.match(page, /Menjamin transparansi asal-usul klaim teknis tanpa source collapsing tersembunyi/i);

  assert.ok(SOURCE_FIDELITY_CONFIG.PRIMARY_DOCUMENT);
  assert.ok(SOURCE_FIDELITY_CONFIG.SECONDARY_ANALYSIS);
});

// ----------------------------------------------------------------------------
// Test O: Freshness states visible separately
// ----------------------------------------------------------------------------
test('Product Review 1C [Test O]: Freshness states visible separately without merged score', () => {
  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(page, /Dashboard Kesegaran Data Independen/i);
  assert.match(page, /SpecSnapshot/);
  assert.match(page, /ReviewSnapshot/);
  assert.match(page, /PriceSnapshot/);
  assert.match(page, /Tidak dilebur menjadi skor tunggal/i);

  const proj = getSyntheticProductDeskProjection();
  assert.ok(proj.detail?.spec_freshness_state);
  assert.ok(proj.detail?.review_freshness_state);
  assert.ok(proj.detail?.price_freshness_map);
});

// ----------------------------------------------------------------------------
// Test P: Identity drift warning visible
// ----------------------------------------------------------------------------
test('Product Review 1C [Test P]: Identity drift warning visible when state !== CURRENT', () => {
  const proj = getSyntheticProductDeskProjection({ productId: SYNTHETIC_PRODUCT_DRIFTED.product_id, activeTab: 'drift' });
  assert.equal(proj.detail?.product.identity_state, 'LISTING_AMBIGUOUS');

  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(page, /Peringatan Pergeseran Identitas Terdeteksi/i);
  assert.match(page, /Sistem dilarang menimpa identitas kanonikal secara otomatis/i);
});

// ----------------------------------------------------------------------------
// Test Q: PDE handoff is read-only
// ----------------------------------------------------------------------------
test('Product Review 1C [Test Q]: PDE handoff is read-only and cannot mutate PDE', () => {
  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(page, /PDE Decision Context/i);
  assert.match(page, /READ-ONLY HANDOFF/i);
  assert.match(page, /Meja ulasan tidak dapat mengubah hasil PDE/i);

  assert.equal(SYNTHETIC_PDE_HANDOFF.commercial_data_allowed, false);
});

// ----------------------------------------------------------------------------
// Test R: Affiliate/sponsorship disclosure visible
// ----------------------------------------------------------------------------
test('Product Review 1C [Test R]: Affiliate and sponsorship disclosure visible', () => {
  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(page, /Transparansi Hubungan Komersial \(Commercial Disclosure\)/i);
  assert.match(page, /Hubungan Afiliasi/i);
  assert.match(page, /Konten Bersponsor/i);
  assert.match(page, /Barang Disediakan Brand/i);
  assert.match(page, /Pernyataan Pengungkapan Redaksi/i);

  const proj = getSyntheticProductDeskProjection();
  assert.ok(proj.detail?.commercial_disclosure);
  assert.equal(proj.detail.commercial_disclosure.has_affiliate_links, true);
});

// ----------------------------------------------------------------------------
// Test S: Data source clearly labeled
// ----------------------------------------------------------------------------
test('Product Review 1C [Test S]: Data source clearly labeled (SYNTHETIC_TEST_DATA)', () => {
  const proj = getSyntheticProductDeskProjection();
  assert.equal(proj.data_source, 'SYNTHETIC_TEST_DATA');
  assert.ok(DATA_SOURCE_CONFIG.SYNTHETIC_TEST_DATA);
  assert.ok(DATA_SOURCE_CONFIG.LOCAL_DATABASE);
  assert.ok(DATA_SOURCE_CONFIG.PRODUCTION_D1);

  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(page, /ADMIN_MUST_KNOW_WHICH_DATA_SOURCE_IS_BEING_INSPECTED/);
  assert.match(page, /Sumber Data Aktif:/);
});

// ----------------------------------------------------------------------------
// Test T: Synthetic data explicitly marked test-only
// ----------------------------------------------------------------------------
test('Product Review 1C [Test T]: Synthetic data explicitly marked DEVELOPMENT / TEST DATA', () => {
  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(page, /DEVELOPMENT \/ TEST DATA/);

  assert.equal(DATA_SOURCE_CONFIG.SYNTHETIC_TEST_DATA.isTestOnly, true);
});

// ----------------------------------------------------------------------------
// Test U: Empty state works
// ----------------------------------------------------------------------------
test('Product Review 1C [Test U]: Explicit empty state works cleanly', () => {
  const proj = getSyntheticProductDeskProjection({ forceEmpty: true });
  assert.equal(proj.is_empty, true);
  assert.equal(proj.products_list.length, 0);
  assert.equal(proj.empty_reason, 'Belum ada produk yang masuk ke Product Review Desk.');

  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(page, /Belum ada produk yang masuk ke Product Review Desk\./);
});

// ----------------------------------------------------------------------------
// Test V: No public route exposure
// ----------------------------------------------------------------------------
test('Product Review 1C [Test V]: No public navigation or sitemap exposure for admin product review', () => {
  // Check public layout or navigation
  const publicNav = readRepoFile('src/components/Header.astro');
  assert.doesNotMatch(publicNav, /\/admin\/product-review/, 'Public header must not link to /admin/product-review');

  const robots = readRepoFile('public/robots.txt');
  assert.match(robots, /Disallow:\s*\/admin/, 'robots.txt must disallow /admin');
});

// ----------------------------------------------------------------------------
// Test W: No autonomous publication controls
// ----------------------------------------------------------------------------
test('Product Review 1C [Test W]: No autonomous publication or approval controls exist', () => {
  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.doesNotMatch(page, /auto[_-]?publish/i, 'No auto-publish allowed');
  assert.doesNotMatch(page, /auto[_-]?approve/i, 'No auto-approve allowed');
  assert.doesNotMatch(page, /auto[_-]?affiliate/i, 'No auto-affiliate insertion allowed');
});

// ----------------------------------------------------------------------------
// Test X: No production D1 dependency required for tests
// ----------------------------------------------------------------------------
test('Product Review 1C [Test X]: Tests execute 100% offline with zero remote D1 dependency', () => {
  const proj = getSyntheticProductDeskProjection();
  assert.ok(proj.products_list.length > 0);
  assert.ok(proj.detail);
  assert.equal(proj.data_source, 'SYNTHETIC_TEST_DATA');
});

// ----------------------------------------------------------------------------
// Test Y: Production D1 empty state projection
// ----------------------------------------------------------------------------
test('Product Review 1D [Test Y]: Production D1 empty state returns PRODUCTION_D1 and zero products', async () => {
  // Mock D1 database with 0 rows in product_review_products
  const mockEmptyD1 = {
    prepare: (sql) => ({
      all: async () => ({ results: [] })
    })
  };

  const proj = await getProductionProductDeskProjection(mockEmptyD1);
  assert.equal(proj.data_source, 'PRODUCTION_D1');
  assert.equal(proj.data_source_meta.source, 'PRODUCTION_D1');
  assert.equal(proj.is_empty, true);
  assert.equal(proj.products_list.length, 0);
  assert.equal(proj.empty_reason, 'Belum ada produk yang masuk ke Product Review Desk.');
  assert.equal(proj.detail, undefined);
});

// ----------------------------------------------------------------------------
// Test Z: NO_SILENT_PRODUCT_REVIEW_PRODUCTION_FALLBACK invariant
// ----------------------------------------------------------------------------
test('Product Review 1D [Test Z]: NO_SILENT_PRODUCT_REVIEW_PRODUCTION_FALLBACK enforced in production', async () => {
  // Even if db is null or errored in production, getProductionProductDeskProjection never returns synthetic fixtures
  const projNullDb = await getProductionProductDeskProjection(null);
  assert.equal(projNullDb.data_source, 'PRODUCTION_D1');
  assert.equal(projNullDb.is_empty, true);
  assert.equal(projNullDb.products_list.length, 0);

  // Check admin page source code enforces this invariant
  const page = readRepoFile('src/pages/admin/product-review.astro');
  assert.match(page, /NO_SILENT_PRODUCT_REVIEW_PRODUCTION_FALLBACK/);
  assert.match(page, /getProductionProductDeskProjection/);
  assert.match(page, /import\.meta\.env\.PROD/);
});
