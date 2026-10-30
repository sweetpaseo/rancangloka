import assert from 'assert';

async function verifyScrollToTop() {
  const TARGET_BASE = process.env.TARGET_URL || 'http://localhost:8788';
  console.log(`=== VERIFYING SCROLL TO TOP ROUTE ISOLATION (${TARGET_BASE}) ===`);

  // 1. Article detail page: MUST HAVE scroll-to-top
  const artRes = await fetch(`${TARGET_BASE}/perbedaan-atap-metal-dan-genteng-beton-untuk-rumah-tropis`);
  const artHtml = await artRes.text();
  assert.ok(artHtml.includes('id="scroll-to-top-btn"'), 'Article page MUST include scroll-to-top-btn');
  assert.ok(artHtml.includes('aria-label="Kembali ke atas"'), 'Must have accessible label');
  assert.ok(artHtml.includes('hidden lg:flex'), 'Must be hidden on mobile/tablet');
  assert.ok(artHtml.includes('id="article-body"'), 'Must have article-body container for boundary check');
  console.log('  ✓ Article page correctly includes desktop-only Scroll to Top.');

  // 1b. Homepage: MUST HAVE scroll-to-top (desktop only, Lemon Linen primary token, data-context="homepage")
  const homeRes = await fetch(`${TARGET_BASE}/`);
  const homeHtml = await homeRes.text();
  assert.ok(homeHtml.includes('id="scroll-to-top-btn"'), 'Homepage MUST include scroll-to-top-btn');
  assert.ok(homeHtml.includes('data-context="homepage"'), 'Homepage must pass context="homepage"');
  assert.ok(homeHtml.includes('hidden lg:flex'), 'Homepage scroll-to-top must be desktop only');
  assert.ok(homeHtml.includes('aria-label="Kembali ke atas"'), 'Homepage scroll-to-top must have accessible label');
  assert.ok(homeHtml.includes('bg-[var(--primary)]'), 'Button must use Lemon Linen primary color token');
  console.log('  ✓ Homepage correctly includes desktop-only Scroll to Top.');

  // 2. HTML Sitemap: MUST NOT HAVE scroll-to-top
  const sitemapRes = await fetch(`${TARGET_BASE}/sitemap`);
  const sitemapHtml = await sitemapRes.text();
  assert.ok(!sitemapHtml.includes('id="scroll-to-top-btn"'), 'HTML Sitemap MUST NOT include scroll-to-top-btn');
  console.log('  ✓ HTML Sitemap correctly excludes Scroll to Top.');

  // 3. Explore page: MUST NOT HAVE scroll-to-top
  const exploreRes = await fetch(`${TARGET_BASE}/explore`);
  const exploreHtml = await exploreRes.text();
  assert.ok(!exploreHtml.includes('id="scroll-to-top-btn"'), 'Explore page MUST NOT include scroll-to-top-btn');
  console.log('  ✓ Explore page correctly excludes Scroll to Top.');

  // 4. Category page: MUST NOT HAVE scroll-to-top
  const catRes = await fetch(`${TARGET_BASE}/category/arsitektur-renovasi`);
  const catHtml = await catRes.text();
  assert.ok(!catHtml.includes('id="scroll-to-top-btn"'), 'Category page MUST NOT include scroll-to-top-btn');
  console.log('  ✓ Category page correctly excludes Scroll to Top.');

  console.log('✅ ALL SCROLL TO TOP ISOLATION CHECKS PASSED!');
}

verifyScrollToTop().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
