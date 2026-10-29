import assert from 'assert';

async function verifyScrollToTop() {
  console.log('=== VERIFYING SCROLL TO TOP ROUTE ISOLATION ===');

  // 1. Article detail page: MUST HAVE scroll-to-top
  const artRes = await fetch('http://localhost:8788/perbedaan-atap-metal-dan-genteng-beton-untuk-rumah-tropis');
  const artHtml = await artRes.text();
  assert.ok(artHtml.includes('id="scroll-to-top-btn"'), 'Article page MUST include scroll-to-top-btn');
  assert.ok(artHtml.includes('aria-label="Kembali ke atas"'), 'Must have accessible label');
  assert.ok(artHtml.includes('hidden lg:flex'), 'Must be hidden on mobile/tablet');
  assert.ok(artHtml.includes('id="article-body"'), 'Must have article-body container for boundary check');
  console.log('  ✓ Article page correctly includes desktop-only Scroll to Top.');

  // 2. HTML Sitemap: MUST NOT HAVE scroll-to-top
  const sitemapRes = await fetch('http://localhost:8788/sitemap');
  const sitemapHtml = await sitemapRes.text();
  assert.ok(!sitemapHtml.includes('id="scroll-to-top-btn"'), 'HTML Sitemap MUST NOT include scroll-to-top-btn');
  console.log('  ✓ HTML Sitemap correctly excludes Scroll to Top.');

  // 3. Explore page: MUST NOT HAVE scroll-to-top
  const exploreRes = await fetch('http://localhost:8788/explore');
  const exploreHtml = await exploreRes.text();
  assert.ok(!exploreHtml.includes('id="scroll-to-top-btn"'), 'Explore page MUST NOT include scroll-to-top-btn');
  console.log('  ✓ Explore page correctly excludes Scroll to Top.');

  // 4. Category page: MUST NOT HAVE scroll-to-top
  const catRes = await fetch('http://localhost:8788/category/arsitektur-renovasi');
  const catHtml = await catRes.text();
  assert.ok(!catHtml.includes('id="scroll-to-top-btn"'), 'Category page MUST NOT include scroll-to-top-btn');
  console.log('  ✓ Category page correctly excludes Scroll to Top.');

  console.log('✅ ALL SCROLL TO TOP ISOLATION CHECKS PASSED!');
}

verifyScrollToTop().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
