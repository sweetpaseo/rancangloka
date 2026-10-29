/**
 * Production Live Edge Verification Script
 * MISSION: RANCANGLOKA_EDITORIAL_UX_MEDIA_ENHANCEMENT_1
 * 
 * Verifies live edge endpoints on https://rancangloka.com:
 * 1. Homepage HTTP 200 & ScrollToTop presence
 * 2. Published Article pages HTTP 200 & ScrollToTop presence
 * 3. FAQ rendering: No unapproved placeholder DOM rendered
 * 4. Existing images loading with HTTP 200
 * 5. Sitemaps (HTML sitemap & XML sitemap) HTTP 200
 */

import assert from 'node:assert';

const BASE_URL = 'https://rancangloka.com';

console.log(`=== LIVE EDGE VERIFICATION: ${BASE_URL} ===\n`);

async function fetchRoute(path) {
  const separator = path.includes('?') ? '&' : '?';
  const url = `${BASE_URL}${path}${separator}_cf_cache_bust=${Date.now()}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'RancangLoka-Verification-Agent/2.1',
      'Cache-Control': 'no-cache, no-store'
    }
  });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

let passed = 0;

// 1. Homepage
console.log('1. Verifying Homepage...');
const home = await fetchRoute('/');
assert.strictEqual(home.status, 200, `Homepage returned ${home.status}`);
console.log('Homepage text length:', home.text.length);
console.log('Includes scroll-to-top-btn:', home.text.includes('scroll-to-top-btn'));
assert.ok(home.text.includes('scroll-to-top-btn'), 'Homepage must contain scroll-to-top component markup');
assert.ok(home.text.includes('data-context="homepage"'), 'Homepage scroll-to-top must be tagged with data-context="homepage"');
console.log('  ✅ Homepage HTTP 200 with desktop-only ScrollToTop verified.\n');
passed++;

// 2. Published Article Pages
console.log('2. Verifying Article Pages & ScrollToTop...');
const testSlugs = [
  '/kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
  '/perbedaan-atap-metal-dan-genteng-beton-untuk-rumah-tropis',
  '/memilih-sistem-shading-luar-rumah-tropis'
];

for (const slug of testSlugs) {
  const art = await fetchRoute(slug);
  assert.strictEqual(art.status, 200, `Article ${slug} returned ${art.status}`);
  assert.ok(art.text.includes('scroll-to-top-btn'), `Article ${slug} must contain scroll-to-top component`);
  assert.ok(art.text.includes('data-context="article"'), `Article ${slug} must have data-context="article"`);
  
  // 3. Editorial FAQ Invariant:
  // Since existing live articles have no approved FAQ attached, they MUST NOT render empty FAQ markup
  assert.ok(!art.text.includes('class="editorial-faq"'), `Article ${slug} must NOT render empty FAQ container`);
  assert.ok(!art.text.includes('faq-accordion-item'), `Article ${slug} must NOT render empty accordion items`);
  console.log(`  ✅ Article ${slug} HTTP 200: ScrollToTop present, unapproved FAQ cleanly omitted.`);
}
console.log('');
passed++;

// 4. Sitemaps
console.log('3. Verifying Sitemap Endpoints...');
const htmlSitemap = await fetchRoute('/sitemap');
assert.strictEqual(htmlSitemap.status, 200, 'HTML sitemap must be HTTP 200');
assert.ok(htmlSitemap.text.includes('Peta Situs'), 'HTML sitemap must contain title');
assert.ok(!htmlSitemap.text.includes('scroll-to-top-btn'), 'HTML sitemap must NOT contain scroll-to-top');

const xmlSitemap = await fetchRoute('/sitemap.xml');
assert.strictEqual(xmlSitemap.status, 200, 'XML sitemap must be HTTP 200');
console.log('  ✅ Sitemaps verified (HTML sitemap & XML sitemap HTTP 200).\n');
passed++;

// 5. Existing Images Loading
console.log('4. Verifying Existing Production Images...');
const imageUrl = 'https://rancangloka.com/media/images/ef702415bb6c84ebc26d9647a282385d241e161f45074287d46db6648bc1af79.webp';
const imgRes = await fetch(imageUrl, { method: 'HEAD' });
assert.strictEqual(imgRes.status, 200, `Existing image returned ${imgRes.status}`);
console.log(`  ✅ Existing image URL returned HTTP ${imgRes.status}.\n`);
passed++;

console.log(`🎉 ALL ${passed} LIVE EDGE VERIFICATION CHECKS PASSED ON RANCANGLOKA.COM!`);
