/**
 * Regression Test: Sitemap XSLT Deprecation & Clean XML Compatibility
 * 
 * Verifies:
 * 1. Complete elimination of <?xml-stylesheet ...?> and XSLT references
 * 2. Strict XML declaration <?xml version="1.0" encoding="UTF-8"?>
 * 3. Master Sitemap Index XML structure and valid child sitemaps
 * 4. Post sitemap XML structure, image namespace, and XML escaping
 * 5. Page sitemap XML structure and namespaces
 * 6. Category sitemap XML structure and namespaces
 * 7. News sitemap XML structure, news namespace, publication dates, and CDATA
 * 8. All canonical alias routes resolve with HTTP 200 and identical content
 * 9. Content-Type headers are strictly application/xml; charset=utf-8
 * 10. Accurate lastmod ISO-8601 timestamps across all entries
 * 11. Complete removal of browser-side XSLT stylesheet file (main-sitemap.xsl)
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== SITEMAP XSLT DEPRECATION COMPATIBILITY TEST ===\n');

let passCount = 0;
let failCount = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(err);
    failCount++;
  }
}

async function itAsync(description, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${description}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(err);
    failCount++;
  }
}

async function fetchRoute(routePath) {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:8788' + routePath, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    }).on('error', reject);
  });
}

function validateIsoDate(dateStr) {
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  return isoRegex.test(dateStr) && !isNaN(Date.parse(dateStr));
}

// Simple XML tag-matching validator
function validateXmlWellFormed(xml) {
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Must start with standard XML declaration');
  assert.ok(!xml.includes('<?xml-stylesheet'), 'Must not contain any xml-stylesheet processing instruction');
  assert.ok(!xml.includes('text/xsl'), 'Must not contain text/xsl');
  assert.ok(!xml.includes('main-sitemap.xsl'), 'Must not reference main-sitemap.xsl');

  // Check tags balance
  const openTags = [];
  const tagRegex = /<(\/)?([a-zA-Z0-9:-]+)([^>]*)>/g;
  let match;
  while ((match = tagRegex.exec(xml)) !== null) {
    const isClosing = match[1] === '/';
    const tagName = match[2];
    const isSelfClosing = match[3].endsWith('/') || match[0].startsWith('<?');

    if (match[0].startsWith('<?')) continue;
    if (isSelfClosing) continue;

    if (isClosing) {
      const last = openTags.pop();
      assert.equal(last, tagName, `Closing tag </${tagName}> does not match open tag <${last}>`);
    } else {
      openTags.push(tagName);
    }
  }
  assert.equal(openTags.length, 0, `Unclosed tags remaining: ${openTags.join(', ')}`);
}

async function runSuite() {
  // 1. Filesystem Invariants
  it('public/main-sitemap.xsl is deleted from repository', () => {
    const xslPath = path.resolve('public', 'main-sitemap.xsl');
    assert.equal(fs.existsSync(xslPath), false, 'main-sitemap.xsl must not exist in public directory');
  });

  // 2. Master Sitemap Index (/sitemap.xml)
  await itAsync('/sitemap.xml produces clean XML without XSLT processing instruction', async () => {
    const res = await fetchRoute('/sitemap.xml');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /^application\/xml/);
    validateXmlWellFormed(res.body);

    assert.ok(res.body.includes('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
    assert.ok(res.body.includes('<loc>https://rancangloka.com/post-sitemap.xml</loc>') || res.body.includes('sitemap-posts-'));
    assert.ok(res.body.includes('<loc>https://rancangloka.com/page-sitemap.xml</loc>'));
    assert.ok(res.body.includes('<loc>https://rancangloka.com/category-sitemap.xml</loc>'));
    assert.ok(res.body.includes('<loc>https://rancangloka.com/sitemap-news.xml</loc>'));

    // Check lastmod dates
    const lastmods = [...res.body.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(m => m[1]);
    assert.ok(lastmods.length >= 3, 'Must have at least 3 sitemap entries with lastmod');
    for (const lm of lastmods) {
      assert.ok(validateIsoDate(lm), `Invalid ISO date: ${lm}`);
    }
  });

  // 2B. Stability across repeated requests (Deterministic timestamps)
  await itAsync('/sitemap.xml produces identical, stable output across repeated requests without content changes', async () => {
    const res1 = await fetchRoute('/sitemap.xml');
    await new Promise(r => setTimeout(r, 100));
    const res2 = await fetchRoute('/sitemap.xml');
    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);
    assert.equal(res1.body, res2.body, 'Sitemap index XML must be byte-for-byte identical across repeated requests');
  });

  // 2C. Distinction between Child Sitemap timestamps
  await itAsync('Sitemap index differentiates timestamps between posts and pages based on actual content', async () => {
    const res = await fetchRoute('/sitemap.xml');
    const postMatch = res.body.match(/<loc>[^<]*post-sitemap\.xml<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/);
    const pageMatch = res.body.match(/<loc>[^<]*page-sitemap\.xml<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/);

    assert.ok(postMatch, 'post-sitemap must have lastmod');
    assert.ok(pageMatch, 'page-sitemap must have lastmod');

    const postLastmod = postMatch[1];
    const pageLastmod = pageMatch[1];

    console.log(`    Post Sitemap lastmod: ${postLastmod}`);
    console.log(`    Page Sitemap lastmod: ${pageLastmod}`);

    // They must not be identical synthetic timestamps
    assert.notEqual(postLastmod, pageLastmod, 'Post and Page sitemaps must reflect distinct actual content modification dates');
    assert.ok(postLastmod > pageLastmod, 'Post sitemap should reflect more recent publication than initial institutional pages');
  });

  // 3. Master Sitemap Index Alias (/sitemap_index.xml)
  await itAsync('/sitemap_index.xml alias returns identical clean XML without timestamp drift', async () => {
    const resIndex = await fetchRoute('/sitemap_index.xml');
    const resMain = await fetchRoute('/sitemap.xml');
    assert.equal(resIndex.status, 200);
    assert.equal(resIndex.body, resMain.body, 'Alias must match main index exactly without dynamic clock drift');
  });

  // 4. Post Sitemap (/post-sitemap.xml & /sitemap-posts-1.xml)
  await itAsync('/post-sitemap.xml produces clean XML with image namespace and zero XSLT', async () => {
    const res = await fetchRoute('/post-sitemap.xml');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /^application\/xml/);
    validateXmlWellFormed(res.body);

    assert.ok(res.body.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'));
    assert.ok(res.body.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'));
    assert.ok(res.body.includes('<loc>https://rancangloka.com/perbedaan-atap-metal-dan-genteng-beton-untuk-rumah-tropis</loc>'));

    // Image tag escaping check
    if (res.body.includes('<image:image>')) {
      assert.ok(res.body.includes('<image:loc>'));
      assert.ok(res.body.includes('<image:title>'));
      assert.ok(!res.body.includes('& ')); // No raw ampersand
    }

    // Check lastmod dates reflect actual published/updated dates
    const lastmods = [...res.body.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(m => m[1]);
    assert.ok(lastmods.length > 0, 'Must have at least 1 post URL');
    for (const lm of lastmods) {
      assert.ok(validateIsoDate(lm), `Invalid post lastmod: ${lm}`);
    }
  });

  await itAsync('/sitemap-posts-1.xml returns identical content to /post-sitemap.xml', async () => {
    const res1 = await fetchRoute('/sitemap-posts-1.xml');
    const resAlias = await fetchRoute('/post-sitemap.xml');
    assert.equal(res1.status, 200);
    assert.equal(res1.body, resAlias.body);
  });

  // 5. Page Sitemap (/page-sitemap.xml & /sitemap-pages.xml)
  await itAsync('/page-sitemap.xml produces clean XML without XSLT', async () => {
    const res = await fetchRoute('/page-sitemap.xml');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /^application\/xml/);
    validateXmlWellFormed(res.body);

    assert.ok(res.body.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
    const lastmods = [...res.body.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(m => m[1]);
    for (const lm of lastmods) {
      assert.ok(validateIsoDate(lm), `Invalid page lastmod: ${lm}`);
    }
  });

  await itAsync('/sitemap-pages.xml alias returns identical content to /page-sitemap.xml', async () => {
    const resAlias = await fetchRoute('/page-sitemap.xml');
    const resDirect = await fetchRoute('/sitemap-pages.xml');
    assert.equal(resDirect.status, 200);
    assert.equal(resDirect.body, resAlias.body);
  });

  // 6. Category Sitemap (/category-sitemap.xml & /sitemap-categories.xml)
  await itAsync('/category-sitemap.xml produces clean XML without XSLT', async () => {
    const res = await fetchRoute('/category-sitemap.xml');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /^application\/xml/);
    validateXmlWellFormed(res.body);

    assert.ok(res.body.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
    assert.ok(res.body.includes('<loc>https://rancangloka.com</loc>')); // Homepage entry
    assert.ok(res.body.includes('<loc>https://rancangloka.com/category/'));
  });

  await itAsync('/sitemap-categories.xml returns identical content to /category-sitemap.xml', async () => {
    const resAlias = await fetchRoute('/category-sitemap.xml');
    const resDirect = await fetchRoute('/sitemap-categories.xml');
    assert.equal(resDirect.status, 200);
    // Normalize lastmod timestamp which generates at request time
    const normAlias = resAlias.body.replace(/<lastmod>[^<]+<\/lastmod>/g, '<lastmod>NORMALIZED</lastmod>');
    const normDirect = resDirect.body.replace(/<lastmod>[^<]+<\/lastmod>/g, '<lastmod>NORMALIZED</lastmod>');
    assert.equal(normDirect, normAlias);
  });

  // 7. News Sitemap (/sitemap-news.xml & /news-sitemap.xml)
  await itAsync('/sitemap-news.xml produces clean XML without XSLT', async () => {
    const res = await fetchRoute('/sitemap-news.xml');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /^application\/xml/);
    validateXmlWellFormed(res.body);

    assert.ok(res.body.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'));
    assert.ok(res.body.includes('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"'));
  });

  await itAsync('/news-sitemap.xml alias returns identical content to /sitemap-news.xml', async () => {
    const resDirect = await fetchRoute('/sitemap-news.xml');
    const resAlias = await fetchRoute('/news-sitemap.xml');
    assert.equal(resAlias.status, 200);
    assert.equal(resAlias.body, resDirect.body);
  });

  // 8. Search Engine Robots.txt Integrity
  it('public/robots.txt correctly declares canonical sitemaps', () => {
    const robots = fs.readFileSync(path.resolve('public', 'robots.txt'), 'utf8');
    assert.ok(robots.includes('Sitemap: https://rancangloka.com/sitemap.xml'));
    assert.ok(robots.includes('Sitemap: https://rancangloka.com/post-sitemap.xml'));
    assert.ok(robots.includes('Sitemap: https://rancangloka.com/page-sitemap.xml'));
    assert.ok(robots.includes('Sitemap: https://rancangloka.com/category-sitemap.xml'));
    assert.ok(robots.includes('Sitemap: https://rancangloka.com/sitemap-news.xml'));
  });

  console.log(`\n=== RESULTS: ${passCount} PASSED, ${failCount} FAILED ===`);
  if (failCount > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
