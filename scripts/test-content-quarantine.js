/** Deterministic CONTENT-QUARANTINE-1 regression: real loaders + route handlers,
 * isolated SQLite fixtures, no remote services or production writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

// Astro/Vite resolves extensionless TS imports; emulate that for route tests in Node.
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && context.parentURL) {
    const url = new URL(specifier + '.ts', context.parentURL);
    if (fs.existsSync(url)) return next(url.href, context);
  }
  return next(specifier, context);
} });
const policy = await import('../src/lib/quarantine.ts');
const { getAllArticles, getPublishedArticleBySlug, getRelatedArticles } = await import('../src/lib/db.ts');
const { injectAutoKeywordLinks, injectInArticleRelated } = await import('../src/lib/seo.ts');
const a5 = 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia';
const a6 = 'rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman';
const oldKusen = 'panduan-kusen-aluminium-ekstrusi-daerah-lembap';
const expected = [
  'rumah-tropis-yang-tidak-takut-matahari',
  'mengapa-rumah-menghadap-barat-selalu-panas',
  'efek-cerobong-void-rumah-sempit-36',
  'panduan-material-fasad-kisi-ulin-vs-louver',
  'tren-desain-interior-japandi-2026-hunian-minimalis',
  'proporsi-spasial-rumah-mungil-skala-furnitur',
  'layering-pencahayaan-alami-dan-cove-lighting',
  'kamar-tidur-yang-benar-benar-mengistirahatkan',
  'panduan-smart-home-otomasi-energi-2026',
  'protokol-matter-dan-thread-smart-home',
  'smart-lighting-sensor-keberadaan-lokal',
  'sistem-keamanan-rumah-privasi-lokal',
  'desain-home-office-ergonomis-wfh-produktif',
  'materialitas-batu-alam-andesit-dan-terakota',
  'inner-courtyard-taman-kering-tengah-rumah',
  'open-plan-vs-ruang-tersekat-trade-off',
  'arsitek-menjawab-efektivitas-void-tanpa-exhaust-fan',
  'studi-kasus-fasad-kisi-ulin-rumah-120m2',
  oldKusen,
  'solusi-rumah-panas-5-intervensi-spasial-berbiaya-rendah'
];
let passed = 0;
async function test(name, fn) { await fn(); console.log('PASS ' + name); passed++; }
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync('db/schema.sql', 'utf8'));
sqlite.exec('DELETE FROM articles');
function seed(id, slug, status = 'published', date = '2026-09-28T06:16:33Z') {
  sqlite.prepare(`INSERT INTO articles (id,slug,title,description,content_md,content_html,
    category_id,author_id,status,published_at,updated_at,focus_keyword)
    VALUES (?,?,?,'rumah fixture','immutable body','<p>immutable body</p>',1,1,?,?,?,'rumah fixture')`)
    .run(id, slug, slug, status, date, date);
}
seed(5, a5); seed(6, a6); seed(40, 'artikel-baru-yang-sah'); seed(41, 'draft-rahasia', 'draft');
// Many newer quarantined rows ahead of an eligible related result expose LIMIT-before-filter bugs.
expected.forEach((slug, i) => seed(100 + i, slug, 'published', '2026-09-29T00:00:00Z'));
const db = { prepare(sql) {
  assert.match(sql.trim(), /^SELECT\b/i, 'Production loader must only read fixture DB');
  let args = [];
  return { bind(...values) { args = values; return this; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    async first() { return sqlite.prepare(sql).get(...args) || null; } };
} };
const locals = { runtime: { env: { DB: db } } };
const before = JSON.stringify(sqlite.prepare('SELECT * FROM articles WHERE id IN (5,6)').all());

await test('exact intended 20 prototypes match actual source array and registry', () => {
  const source = ts.createSourceFile('db.ts', fs.readFileSync('src/lib/db.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  let slugs;
  function visit(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(source) === 'inMemoryArticles') {
      slugs = n.initializer.elements.map(a => a.properties.find(p => p.name?.getText(source) === 'slug').initializer.text);
    }
    ts.forEachChild(n, visit);
  }
  visit(source);
  assert.equal(slugs.length, 20);
  assert.deepEqual(slugs, expected);
  assert.deepEqual(policy.getPrototypeCorpusSlugs().sort(), [...expected].sort());
  assert.equal(policy.getQuarantinedSlugs('PROTOTYPE').length, 19);
});
await test('Article 5 protected despite ID collision with prototype 5', async () => {
  const article = await getPublishedArticleBySlug(db, a5);
  assert.equal(article.id, 5);
  assert.equal(policy.getQuarantineState(a5), null);
  assert.ok(policy.isPubliclyDiscoverable(article));
  assert.ok(policy.isIndexableArticle(article));
  assert.equal(policy.getArticleRobotsDirective(a5), 'index, follow, max-image-preview:large');
  assert.equal(policy.getArticleXRobotsTag(a5), null);
});
await test('19 reusable prototype direct loaders preserve content and noindex/follow', async () => {
  for (const slug of expected.filter(s => s !== oldKusen)) {
    const article = await getPublishedArticleBySlug(db, slug);
    assert.ok(article?.content_md);
    assert.equal(policy.getQuarantineState(slug).future_reuse_allowed, true);
    assert.equal(policy.getArticleRobotsDirective(slug), 'noindex, follow');
    assert.equal(policy.getArticleXRobotsTag(slug), 'noindex, follow');
    assert.equal(policy.isPubliclyDiscoverable(article), false);
  }
});
await test('kusen redirect is one hop to public Article 5 with no loop', async () => {
  assert.equal(policy.getQuarantineRedirect(oldKusen), '/' + a5);
  assert.equal(policy.getQuarantineRedirect(a5), null);
  assert.ok(await getPublishedArticleBySlug(db, a5));
});
await test('Article 6 remains published/directly readable with evidence-review noindex', async () => {
  const article = await getPublishedArticleBySlug(db, a6);
  assert.equal(article.status, 'published');
  assert.equal(policy.getQuarantineState(a6).quarantine_type, 'EVIDENCE_REVIEW');
  assert.equal(policy.getArticleRobotsDirective(a6), 'noindex, follow');
  assert.equal(policy.getArticleXRobotsTag(a6), 'noindex, follow');
});
await test('collections and pagination exclude quarantine while retaining other legitimate content', async () => {
  const all = await getAllArticles(db, 1000);
  assert.deepEqual(new Set(all.map(a => a.slug)), new Set([a5, 'artikel-baru-yang-sah']));
  assert.equal((await getAllArticles(db, 1, 1)).length, 1);
  assert.equal((await getAllArticles(null)).length, 0);
  assert.equal((await getAllArticles(db, 1000, 0, 'all')).length, 24);
});
await test('related loader filters before limit and never falls back to quarantined prototypes', async () => {
  const related = await getRelatedArticles(db, 40, 1, 1);
  assert.deepEqual(related.map(a => a.slug), [a5]);
  assert.deepEqual(await getRelatedArticles(null, 5, 1), []);
});
for (const route of ['post-sitemap.xml', 'sitemap-posts-[page].xml', 'rss.xml', 'sitemap-news.xml', 'news-sitemap.xml']) {
  await test(route + ' real handler excludes all quarantine URLs', async () => {
    const { GET } = await import('../src/pages/' + route + '.ts');
    const response = await GET({ locals, params: { page: '1' } });
    assert.equal(response.status, 200);
    const body = await response.text();
    for (const slug of [...expected, a6]) assert.ok(!body.includes('/' + slug), slug);
    if (!route.includes('news')) assert.ok(body.includes('/' + a5));
  });
}
await test('public search JSON excludes quarantine and returns Article 5', async () => {
  const { GET } = await import('../src/pages/api/search.json.ts');
  const response = await GET({ locals, request: new Request('https://example.test/api/search.json?q=rumah') });
  const rows = await response.json();
  assert.ok(rows.some(a => a.slug === a5));
  assert.ok(rows.every(a => policy.isPubliclyDiscoverable(a)));
});
await test('robots.txt allows crawling every quarantined URL', () => {
  const robots = fs.readFileSync('public/robots.txt', 'utf8');
  const denied = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map(m => m[1]);
  for (const slug of [...expected, a6]) assert.ok(denied.every(p => !('/' + slug).startsWith(p)));
});
await test('removing registry entry restores same-slug eligibility without changing content', () => {
  const registry = { ...policy.QUARANTINE_REGISTRY };
  delete registry[expected[0]];
  const article = { slug: expected[0], status: 'published' };
  assert.ok(policy.isPubliclyDiscoverable(article, registry));
  assert.ok(policy.isIndexableArticle(article, registry));
  assert.equal(policy.getArticleRobotsDirective(article.slug, 'true', registry), 'index, follow, max-image-preview:large');
  assert.equal(policy.getArticleXRobotsTag(article.slug, 'true', registry), null);
});
await test('unknown slugs remain eligible; drafts and missing articles remain excluded', () => {
  for (const slug of ['new-approved-article', 'constructor', 'toString', '__proto__']) {
    assert.equal(policy.getQuarantineState(slug), null);
    assert.ok(policy.isPubliclyDiscoverable({ slug, status: 'published' }));
  }
  assert.equal(policy.isPubliclyDiscoverable({ slug: a5, status: 'draft' }), false);
  assert.equal(policy.isPubliclyDiscoverable(null), false);
});
await test('internal-link and in-article related pools reject quarantined candidates', () => {
  const html = '<p>rumah fixture</p>';
  for (const slug of [...expected, a6]) {
    const article = { id: 100, slug, status: 'published', title: 'fixture', focus_keyword: 'rumah fixture' };
    assert.equal(injectAutoKeywordLinks(html, 5, [article]), html);
    assert.equal(injectInArticleRelated(html, article), html);
  }
  assert.ok(injectAutoKeywordLinks(html, 40, [{ id: 5, slug: a5, status: 'published', focus_keyword: 'rumah fixture' }]).includes('/' + a5));
});
await test('Astro route wires robots/header and 301; global noindex retains priority', () => {
  const page = fs.readFileSync('src/pages/[slug].astro', 'utf8');
  assert.match(page, /Astro\.redirect\(quarantineRedirect, 301\)/);
  assert.match(page, /headers\.set\('X-Robots-Tag', xRobotsTag\)/);
  assert.match(page, /robotsDirective=\{robotsDirective\}/);
  const layout = fs.readFileSync('src/layouts/BaseLayout.astro', 'utf8');
  assert.match(layout, /noindex \|\| siteSettings\.allow_indexing === 'false' \?/);
});
await test('Article 5 and 6 fixture bodies/metadata unchanged after all reads', () => {
  assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM articles WHERE id IN (5,6)').all()), before);
});
sqlite.close();
console.log(`\n${passed} quarantine regression checks passed.`);
