/**
 * Test Suite: Final Sitemap Scalability, Pagination Invariants & Lastmod Correction
 * 
 * Verifies:
 * 1. Scalable post sitemap lastmod calculations beyond 50 articles (e.g. 75 articles)
 * 2. High-scale pagination beyond 1,000 articles (e.g. 2,500 articles across 3 sitemap pages)
 * 3. Exact pagination chunk boundaries: 0, 1, 999, 1,000, 1,001, and 2,500 articles
 * 4. Deterministic ordering with unique id tie-breaker for articles with identical published_at
 * 5. Safe timestamp precedence: updated_at only overrides published_at when strictly newer (never selecting older date)
 * 6. Individual chunk lastmod accuracy and isolation during mutations
 * 7. Category sitemap lastmod semantics (category membership, taxonomy changes, omitting lastmod for empty categories)
 * 8. News sitemap 48-hour eligibility window (entering/leaving boundary, scalability beyond 50, omitting lastmod when empty)
 * 9. Repeated requests produce stable, byte-identical results without dynamic clock drift
 * 10. Database query efficiency: single-query aggregations and zero N+1 operations
 * 11. Preservation of all canonical sitemap URLs and valid XML structure
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import {
  getPostSitemapPageLastmods,
  getCategorySitemapData,
  getPageSitemapLatestMod,
  getEligibleNewsArticles,
  getTotalArticlesCount,
  getAllArticles
} from '../src/lib/db.ts';

console.log('=== RANCANGLOKA SITEMAP SCALABILITY & LASTMOD REGRESSION SUITE ===\n');

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

/**
 * Creates an in-memory mock D1 database that records query counts
 * and executes SQLite-like operations matching RancangLoka D1 schema.
 */
function createMockD1(articlesData = [], pagesData = []) {
  let queryCount = 0;
  const articles = [...articlesData];
  const pages = [...pagesData];

  return {
    getQueryCount: () => queryCount,
    getArticles: () => articles,
    setArticleUpdated: (slug, newUpdatedAt) => {
      const art = articles.find(a => a.slug === slug);
      if (art) {
        art.updated_at = newUpdatedAt;
      }
    },
    prepare: (sql) => {
      const handler = async (params = []) => {
        queryCount++;

        // 1. Post sitemap lastmods (queries mod_date with deterministic tie-breaker)
        if (sql.includes('mod_date') || (sql.includes('FROM articles') && sql.includes('ORDER BY') && !sql.includes('published_at >='))) {
          const quarantined = params;
          const rows = articles
            .filter(a => a.status === 'published' && !quarantined.includes(a.slug))
            .sort((a, b) => {
              const diff = new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
              if (diff !== 0) return diff;
              return (b.id || 0) - (a.id || 0);
            })
            .map(a => {
              const u = a.updated_at ? new Date(a.updated_at).getTime() : 0;
              const pub = a.published_at ? new Date(a.published_at).getTime() : 0;
              const effective = Math.max(u, pub);
              return {
                id: a.id,
                slug: a.slug,
                mod_date: effective > 0 ? new Date(effective).toISOString() : null,
                published_at: a.published_at,
                updated_at: a.updated_at
              };
            });
          return { results: rows };
        }

        // 2. Category sitemap aggregation (GROUP BY category_id)
        if (sql.includes('GROUP BY category_id')) {
          const quarantined = params;
          const filtered = articles.filter(a => a.status === 'published' && a.category_id && !quarantined.includes(a.slug));
          const catMap = new Map();
          for (const a of filtered) {
            const u = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const pub = a.published_at ? new Date(a.published_at).getTime() : 0;
            const t = Math.max(u, pub);
            if (t > 0) {
              const current = catMap.get(a.category_id);
              if (!current || t > new Date(current).getTime()) {
                catMap.set(a.category_id, new Date(t).toISOString());
              }
            }
          }
          const results = Array.from(catMap.entries()).map(([catId, maxMod]) => ({
            category_id: catId,
            latest_mod: maxMod,
            max_mod: maxMod
          }));
          return { results };
        }

        // 3. News sitemap aggregation (published_at >= ?)
        if (sql.includes('published_at >=')) {
          const cutoff = params[0];
          const quarantined = params.slice(1);
          const cutoffTime = new Date(cutoff).getTime();
          const filtered = articles
            .filter(a => {
              if (a.status !== 'published') return false;
              if (quarantined.includes(a.slug)) return false;
              const pubTime = new Date(a.published_at).getTime();
              return pubTime >= cutoffTime;
            })
            .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
          return { results: filtered };
        }

        // 4. Articles list (getAllArticles)
        if (sql.includes('SELECT a.id, a.slug')) {
          const status = sql.includes('a.status = ?') ? params[0] : 'all';
          const quarantined = params.slice(status !== 'all' ? 1 : 0);
          const limit = params[params.length - 2];
          const offset = params[params.length - 1];

          const filtered = articles
            .filter(a => {
              if (status !== 'all' && a.status !== status) return false;
              if (quarantined.includes(a.slug)) return false;
              return true;
            })
            .sort((a, b) => {
              const diff = new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
              if (diff !== 0) return diff;
              return (b.id || 0) - (a.id || 0);
            });
          return { results: filtered.slice(offset, offset + limit) };
        }

        return { results: [] };
      };

      const firstHandler = async (params = []) => {
        queryCount++;
        // Count queries
        if (sql.includes('COUNT(*) as count FROM articles')) {
          const quarantined = params;
          const status = sql.includes('status = ?') ? params[0] : 'all';
          const filtered = articles.filter(a => {
            if (status !== 'all' && a.status !== status) return false;
            if (quarantined.includes(a.slug)) return false;
            return true;
          });
          return { count: filtered.length };
        }

        // Pages max_mod
        if (sql.includes('FROM pages')) {
          const published = pages.filter(p => p.status === 'published');
          if (published.length === 0) return { max_mod: null };
          const times = published.map(p => new Date(p.updated_at).getTime()).filter(t => !isNaN(t));
          return { max_mod: times.length > 0 ? new Date(Math.max(...times)).toISOString() : null };
        }
        return null;
      };

      return {
        bind: (...params) => ({
          all: () => handler(params),
          first: () => firstHandler(params)
        }),
        all: () => handler([]),
        first: () => firstHandler([])
      };
    }
  };
}

async function runRegressionSuite() {
  // =========================================================================
  // SCENARIO 1: Scale > 50 Articles (Sampling Limit Bug Fixed)
  // =========================================================================
  console.log('--- SCENARIO 1: Scale > 50 Articles (Beyond 50-Item Sampling) ---');
  
  const dataset75 = [];
  const baseTime = Date.now() - 75 * 3600 * 1000;
  for (let i = 1; i <= 75; i++) {
    dataset75.push({
      id: i,
      slug: `article-${i}`,
      title: `Article ${i}`,
      status: 'published',
      category_id: (i % 3) + 1,
      published_at: new Date(baseTime + i * 3600 * 1000).toISOString(),
      updated_at: new Date(baseTime + i * 3600 * 1000).toISOString(),
      is_news: i === 65 ? 1 : 0
    });
  }

  // Update Article #65 (index 64, well past the old 50 boundary) with newest updated_at
  const art65NewerUpdate = new Date(Date.now() + 3600 * 1000).toISOString();
  dataset75[64].updated_at = art65NewerUpdate;

  const mockDb75 = createMockD1(dataset75);

  await itAsync('getPostSitemapPageLastmods captures Article #65 modification (beyond 50 articles)', async () => {
    const pages = await getPostSitemapPageLastmods(mockDb75, 1000);
    assert.equal(pages.length, 1);
    assert.equal(pages[0].page, 1);
    assert.equal(pages[0].lastmod, art65NewerUpdate, 'Must reflect Article #65 updated_at, not truncated at 50');
  });

  await itAsync('getEligibleNewsArticles captures news article at index 65 (beyond 50 articles)', async () => {
    const fortyEightHoursAgo = Date.now() - 48 * 3600 * 1000;
    const news = await getEligibleNewsArticles(mockDb75, fortyEightHoursAgo);
    const foundArt65 = news.find(a => a.slug === 'article-65');
    assert.ok(foundArt65, 'Article 65 must be included in news articles despite being index 65');
  });

  // =========================================================================
  // SCENARIO 2: High-Scale Pagination (>1,000 Articles across Multiple Pages)
  // =========================================================================
  console.log('\n--- SCENARIO 2: Scale > 1,000 Articles (Paginated Post Sitemaps) ---');

  const dataset2500 = [];
  const startEpoch = new Date('2026-01-01T00:00:00Z').getTime();

  for (let i = 2500; i >= 1; i--) {
    const pubTime = new Date(startEpoch + i * 3600 * 1000 * 2).toISOString();
    dataset2500.push({
      id: 2501 - i,
      slug: `scaled-article-${2501 - i}`,
      title: `Scaled Article ${2501 - i}`,
      status: 'published',
      category_id: (i % 4) + 1,
      published_at: pubTime,
      updated_at: pubTime
    });
  }

  const p1ExpectedMod = '2026-10-15T12:00:00.000Z';
  dataset2500[50].updated_at = p1ExpectedMod;

  const p2ExpectedMod = '2026-07-10T14:00:00.000Z';
  dataset2500[1200].updated_at = p2ExpectedMod;

  const p3ExpectedMod = '2026-03-05T08:00:00.000Z';
  dataset2500[2200].updated_at = p3ExpectedMod;

  const mockDb2500 = createMockD1(dataset2500);

  let initialPages;
  await itAsync('getPostSitemapPageLastmods chunks 2,500 articles into 3 pages with distinct lastmod', async () => {
    initialPages = await getPostSitemapPageLastmods(mockDb2500, 1000);
    assert.equal(initialPages.length, 3, 'Must have exactly 3 sitemap pages for 2,500 articles');

    assert.equal(initialPages[0].page, 1);
    assert.equal(initialPages[0].lastmod, p1ExpectedMod);

    assert.equal(initialPages[1].page, 2);
    assert.equal(initialPages[1].lastmod, p2ExpectedMod);

    assert.equal(initialPages[2].page, 3);
    assert.equal(initialPages[2].lastmod, p3ExpectedMod);
  });

  await itAsync('Mutating an article in Page 2 ONLY updates Page 2 lastmod (Page 1 and 3 are isolated)', async () => {
    const p2NewerMod = '2026-07-25T19:00:00.000Z';
    dataset2500[1500].updated_at = p2NewerMod;

    const updatedPages = await getPostSitemapPageLastmods(mockDb2500, 1000);
    assert.equal(updatedPages.length, 3);

    // Page 1 must remain completely unchanged
    assert.equal(updatedPages[0].lastmod, p1ExpectedMod, 'Page 1 lastmod must not drift when Page 2 mutates');

    // Page 2 must reflect the new modification
    assert.equal(updatedPages[1].lastmod, p2NewerMod, 'Page 2 lastmod must reflect article 1500 update');

    // Page 3 must remain completely unchanged
    assert.equal(updatedPages[2].lastmod, p3ExpectedMod, 'Page 3 lastmod must not drift when Page 2 mutates');
  });

  // =========================================================================
  // SCENARIO 3: Pagination Boundary Matrix (0, 1, 999, 1000, 1001, 2500)
  // =========================================================================
  console.log('\n--- SCENARIO 3: Pagination Boundary Invariant Matrix ---');

  const boundaryCounts = [0, 1, 999, 1000, 1001, 2500];
  for (const count of boundaryCounts) {
    const boundaryArticles = [];
    for (let j = 1; j <= count; j++) {
      boundaryArticles.push({
        id: j,
        slug: `boundary-art-${j}`,
        status: 'published',
        published_at: new Date(Date.now() - (count - j) * 60000).toISOString()
      });
    }

    const expectedPages = Math.max(1, Math.ceil(count / 1000));
    const boundaryDb = createMockD1(boundaryArticles);

    await itAsync(`Pagination boundary for ${count} articles yields exactly ${expectedPages} sitemap page(s)`, async () => {
      const pPages = await getPostSitemapPageLastmods(boundaryDb, 1000);
      assert.equal(pPages.length, expectedPages);
      if (count === 0) {
        assert.equal(pPages[0].lastmod, null, '0 articles must have null lastmod (omitted)');
      } else {
        assert.ok(pPages[0].lastmod !== null, `${count} articles must have a non-null lastmod`);
      }
    });
  }

  // =========================================================================
  // SCENARIO 4: Deterministic Ordering & Tie-Breaker Invariant
  // =========================================================================
  console.log('\n--- SCENARIO 4: Deterministic Ordering & Unique Tie-Breaker ---');

  const identicalPubTime = '2026-10-20T10:00:00.000Z';
  const collisionArticles = [
    { id: 10, slug: 'collision-10', status: 'published', published_at: identicalPubTime },
    { id: 25, slug: 'collision-25', status: 'published', published_at: identicalPubTime },
    { id: 5,  slug: 'collision-5',  status: 'published', published_at: identicalPubTime }
  ];

  const collisionDb = createMockD1(collisionArticles);

  await itAsync('Articles with identical published_at resolve deterministically via id DESC tie-breaker', async () => {
    const list = await getAllArticles(collisionDb, 10, 0, 'published');
    const slugs = list.map(a => a.slug);
    assert.deepEqual(slugs, ['collision-25', 'collision-10', 'collision-5'], 'Must sort by id DESC on identical timestamp');
  });

  // =========================================================================
  // SCENARIO 5: Safe Timestamp Precedence (Never Select Older Date)
  // =========================================================================
  console.log('\n--- SCENARIO 5: Safe Timestamp Precedence ---');

  const safeTimeArticles = [
    {
      id: 301,
      slug: 'art-draft-updated-before-publish',
      status: 'published',
      published_at: '2026-10-25T14:00:00.000Z',
      updated_at: '2026-10-20T08:00:00.000Z' // Draft update prior to publication
    },
    {
      id: 302,
      slug: 'art-edited-after-publish',
      status: 'published',
      published_at: '2026-10-25T14:00:00.000Z',
      updated_at: '2026-10-28T09:00:00.000Z' // Real edit after publication
    }
  ];

  const safeTimeDb = createMockD1(safeTimeArticles);

  await itAsync('updated_at only takes precedence when newer than published_at', async () => {
    const pages = await getPostSitemapPageLastmods(safeTimeDb, 1000);
    assert.equal(pages[0].lastmod, '2026-10-28T09:00:00.000Z', 'Must reflect the latest actual edit');

    // Test individual article 301 (draft update before publish)
    const singleDb = createMockD1([safeTimeArticles[0]]);
    const singlePages = await getPostSitemapPageLastmods(singleDb, 1000);
    assert.equal(singlePages[0].lastmod, '2026-10-25T14:00:00.000Z', 'Must NOT select older updated_at; must select published_at');
  });

  // =========================================================================
  // SCENARIO 6: Category Sitemap Semantics & Membership Changes
  // =========================================================================
  console.log('\n--- SCENARIO 6: Category Membership & Taxonomy Lastmod Semantics ---');

  const catArticles = [
    {
      id: 101,
      slug: 'cat1-art-1',
      category_id: 1, // Category 1: Desain
      status: 'published',
      published_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-10T12:00:00.000Z'
    },
    {
      id: 102,
      slug: 'cat1-art-2',
      category_id: 1,
      status: 'published',
      published_at: '2026-10-05T00:00:00.000Z',
      updated_at: '2026-10-20T16:00:00.000Z' // Latest for Cat 1
    },
    {
      id: 103,
      slug: 'cat2-art-1',
      category_id: 2, // Category 2: Material
      status: 'published',
      published_at: '2026-10-02T00:00:00.000Z',
      updated_at: '2026-10-08T09:00:00.000Z' // Latest for Cat 2
    }
  ];

  const mockDbCat = createMockD1(catArticles);

  await itAsync('getCategorySitemapData returns distinct per-category lastmod and omits empty categories', async () => {
    const catData = await getCategorySitemapData(mockDbCat);

    assert.equal(catData.categoryMods.get(1), '2026-10-20T16:00:00.000Z');
    assert.equal(catData.categoryMods.get(2), '2026-10-08T09:00:00.000Z');
    assert.equal(catData.categoryMods.get(3), undefined, 'Empty category must be undefined (omitted, not synthetic)');
    assert.equal(catData.latestOverallMod, '2026-10-20T16:00:00.000Z');
  });

  await itAsync('Empty site: getCategorySitemapData returns null latestOverallMod (no invented lastmod)', async () => {
    const emptyDb = createMockD1([]);
    const catData = await getCategorySitemapData(emptyDb);
    assert.equal(catData.categoryMods.size, 0);
    assert.equal(catData.latestOverallMod, null, 'Must omit lastmod when zero articles exist');
  });

  // =========================================================================
  // SCENARIO 7: News Sitemap 48-Hour Eligibility Window
  // =========================================================================
  console.log('\n--- SCENARIO 7: News Sitemap 48-Hour Eligibility Window ---');

  const now = Date.now();
  const newsArticlesList = [
    {
      id: 201,
      slug: 'news-fresh',
      title: 'Fresh News 10h ago',
      category_slug: 'news',
      status: 'published',
      published_at: new Date(now - 10 * 3600 * 1000).toISOString(),
      updated_at: new Date(now - 8 * 3600 * 1000).toISOString()
    },
    {
      id: 202,
      slug: 'news-edge',
      title: 'Edge News 47h ago',
      category_slug: 'news',
      status: 'published',
      published_at: new Date(now - 47 * 3600 * 1000).toISOString(),
      updated_at: new Date(now - 47 * 3600 * 1000).toISOString()
    },
    {
      id: 203,
      slug: 'news-expired',
      title: 'Expired News 49h ago',
      category_slug: 'news',
      status: 'published',
      published_at: new Date(now - 49 * 3600 * 1000).toISOString(),
      updated_at: new Date(now - 49 * 3600 * 1000).toISOString()
    },
    {
      id: 204,
      slug: 'evergreen-guide',
      title: 'Evergreen Guide 5h ago',
      category_slug: 'panduan',
      status: 'published',
      published_at: new Date(now - 5 * 3600 * 1000).toISOString(),
      updated_at: new Date(now - 5 * 3600 * 1000).toISOString()
    }
  ];

  const mockDbNews = createMockD1(newsArticlesList);

  await itAsync('News eligibility strictly enforces 48h window and news classification', async () => {
    const fortyEightHoursAgo = now - 48 * 3600 * 1000;
    const eligible = await getEligibleNewsArticles(mockDbNews, fortyEightHoursAgo);

    assert.equal(eligible.length, 2, 'Only fresh and edge news should qualify');
    assert.ok(eligible.some(a => a.slug === 'news-fresh'));
    assert.ok(eligible.some(a => a.slug === 'news-edge'));
    assert.ok(!eligible.some(a => a.slug === 'news-expired'), '49h old article must be excluded');
    assert.ok(!eligible.some(a => a.slug === 'evergreen-guide'), 'Non-news article must be excluded');
  });

  await itAsync('When news articles age out (>48h), getEligibleNewsArticles returns empty list', async () => {
    const futureTime = now + 40 * 3600 * 1000;
    const futureCutoff = futureTime - 48 * 3600 * 1000;

    const eligible = await getEligibleNewsArticles(mockDbNews, futureCutoff);
    assert.equal(eligible.length, 0, 'All previous news articles have aged out');
  });

  // =========================================================================
  // SCENARIO 8: Query Efficiency & Database Aggregation
  // =========================================================================
  console.log('\n--- SCENARIO 8: Query Efficiency & Database Aggregation ---');

  await itAsync('Sitemap getters execute bounded aggregation without N+1 query loops', async () => {
    const profilerDb = createMockD1(dataset2500, [
      { id: 1, slug: 'tentang-kami', status: 'published', updated_at: '2026-09-01T00:00:00Z' }
    ]);

    await getPostSitemapPageLastmods(profilerDb, 1000);
    assert.equal(profilerDb.getQueryCount(), 1, 'Post sitemap page lastmods must execute exactly 1 query');

    await getCategorySitemapData(profilerDb);
    assert.equal(profilerDb.getQueryCount(), 2, 'Category sitemap aggregation must execute exactly 1 query');

    await getPageSitemapLatestMod(profilerDb);
    assert.equal(profilerDb.getQueryCount(), 3, 'Page sitemap latest mod must execute exactly 1 query');

    await getEligibleNewsArticles(profilerDb, Date.now() - 48 * 3600 * 1000);
    assert.equal(profilerDb.getQueryCount(), 4, 'News eligibility must execute exactly 1 query');
  });

  // =========================================================================
  // SCENARIO 9: Live Localhost Integration Verification (Port 8788)
  // =========================================================================
  console.log('\n--- SCENARIO 9: Live Localhost Integration Verification ---');

  await itAsync('Live /sitemap.xml generates valid sitemapindex with deterministic lastmod tags', async () => {
    const res = await fetchRoute('/sitemap.xml');
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
    assert.ok(res.body.includes('/post-sitemap.xml'));
    assert.ok(res.body.includes('/page-sitemap.xml'));
    assert.ok(res.body.includes('/category-sitemap.xml'));
    assert.ok(res.body.includes('/sitemap-news.xml'));
  });

  await itAsync('Live /category-sitemap.xml reflects category membership lastmods', async () => {
    const res = await fetchRoute('/category-sitemap.xml');
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
    assert.ok(res.body.includes('<loc>https://rancangloka.com</loc>'));
    assert.ok(res.body.includes('<loc>https://rancangloka.com/category/'));

    const lastmods = [...res.body.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(m => m[1]);
    assert.ok(lastmods.length > 0, 'Must have lastmod tags for active categories');
    for (const lm of lastmods) {
      assert.ok(!isNaN(Date.parse(lm)), `Invalid ISO lastmod: ${lm}`);
    }
  });

  await itAsync('Repeated requests to /sitemap.xml and /category-sitemap.xml produce identical bytes', async () => {
    const [sm1, sm2, cat1, cat2] = await Promise.all([
      fetchRoute('/sitemap.xml'),
      fetchRoute('/sitemap.xml'),
      fetchRoute('/category-sitemap.xml'),
      fetchRoute('/category-sitemap.xml')
    ]);

    assert.equal(sm1.body, sm2.body, '/sitemap.xml must be byte-for-byte identical across repeated requests');
    assert.equal(cat1.body, cat2.body, '/category-sitemap.xml must be byte-for-byte identical across repeated requests');
  });

  console.log(`\n=== SCALABILITY REGRESSION RESULTS: ${passCount} PASSED, ${failCount} FAILED ===`);
  if (failCount > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fatal regression suite error:', err);
  process.exit(1);
});
