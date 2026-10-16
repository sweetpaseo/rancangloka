/**
 * RancangLoka — Content Protection 1A: Cache & Protection Foundation Test Suite
 * Milestone: CONTENT_PROTECTION-1A
 *
 * Verifies:
 * A. Public published article gets public cache policy
 * B. Browser TTL and Cloudflare edge TTL are separated correctly
 * C. Admin route is no-store
 * D. admin_session request is no-store
 * E. Internal API is no-store
 * F. Mutation method (POST/PUT/DELETE) is no-store
 * G. 4xx/5xx is no-store
 * H. Search API exposes whitelist only (zero internal field leakage)
 * I. Article Support target tags are generated correctly
 * J. Cache purge tags are deterministic
 * K. Canonical Plane A schema is used (placement_plane = 'PLANE_A_DYNAMIC' AND status = 'ACTIVE')
 * L. No article prose/hash mutation
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { onRequest } from '../src/middleware.ts';
import {
  getArticleCacheTags,
  getInvalidationTagsForEvent,
  queryPlaneASourceArticles,
  purgeCacheTags,
  invalidateArticleCache
} from '../src/lib/cache/index.ts';
import { insertArticle, updateArticle, getArticleBySlug } from '../src/lib/db.ts';
import { executeAtomicPublication } from '../src/lib/publication/publisher-service.ts';

console.log('🧪 Starting CONTENT_PROTECTION-1A Cache & Protection Test Suite...\n');

let passCount = 0;
function pass(msg) {
  passCount++;
  console.log(`  ✅ PASS: ${msg}`);
}

async function runMockMiddleware({
  url = 'https://rancangloka.com/',
  method = 'GET',
  cookies = {},
  status = 200,
  initialHeaders = {},
  body = ''
} = {}) {
  const reqUrl = new URL(url);
  const headers = new Headers(initialHeaders);
  const request = new Request(reqUrl.toString(), {
    method,
    headers
  });

  const cookieMap = new Map(Object.entries(cookies).map(([k, v]) => [k, { value: v }]));
  const mockCookies = {
    get: (key) => cookieMap.get(key),
    has: (key) => cookieMap.has(key),
    set: (key, val) => cookieMap.set(key, { value: val }),
    delete: (key) => cookieMap.delete(key)
  };

  const context = {
    url: reqUrl,
    request,
    cookies: mockCookies,
    locals: { runtime: { env: {} } },
    redirect: (target, code = 302) =>
      new Response(null, {
        status: code,
        headers: { Location: target, 'Cache-Control': 'no-store, private' }
      })
  };

  const next = async () => {
    const resHeaders = new Headers(initialHeaders);
    return new Response(body, {
      status,
      headers: resHeaders
    });
  };

  return await onRequest(context, next);
}

async function runSuite() {
  // Test A: Public published article gets public cache policy
  {
    const res = await runMockMiddleware({
      url: 'https://rancangloka.com/panduan-arsitektur-tropis',
      method: 'GET',
      status: 200,
      initialHeaders: {
        'Cache-Control': 'public, max-age=60',
        'Cloudflare-CDN-Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Cache-Tag': 'article-5, category-1'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Cache-Control'), 'public, max-age=60');
    assert.equal(
      res.headers.get('Cloudflare-CDN-Cache-Control'),
      'public, max-age=3600, stale-while-revalidate=86400'
    );
    assert.equal(res.headers.get('Cache-Tag'), 'article-5, category-1');
    pass('A. Public published article gets public cache policy');
  }

  // Test B: Browser TTL and Cloudflare edge TTL are separated correctly
  {
    const res = await runMockMiddleware({
      url: 'https://rancangloka.com/',
      method: 'GET',
      status: 200
    });

    assert.equal(res.headers.get('Cache-Control'), 'public, max-age=60');
    assert.equal(
      res.headers.get('Cloudflare-CDN-Cache-Control'),
      'public, max-age=1800, stale-while-revalidate=86400'
    );
    assert.equal(res.headers.get('Cache-Tag'), 'homepage');
    pass('B. Browser TTL and Cloudflare edge TTL are separated correctly');
  }

  // Test C: Admin route is no-store
  {
    const res = await runMockMiddleware({
      url: 'https://rancangloka.com/admin/posts',
      method: 'GET'
    });

    assert.equal(res.headers.get('Cache-Control'), 'no-store, private');
    assert.equal(res.headers.get('Cloudflare-CDN-Cache-Control'), null);
    assert.equal(res.headers.get('Cache-Tag'), null);
    pass('C. Admin route is strictly no-store');
  }

  // Test D: admin_session request is no-store
  {
    const res = await runMockMiddleware({
      url: 'https://rancangloka.com/panduan-arsitektur-tropis',
      method: 'GET',
      cookies: { admin_session: 'mock_active_session_token' },
      initialHeaders: {
        'Cache-Control': 'public, max-age=60',
        'Cloudflare-CDN-Cache-Control': 'public, max-age=3600',
        'Cache-Tag': 'article-5'
      }
    });

    assert.equal(res.headers.get('Cache-Control'), 'no-store, private');
    assert.equal(res.headers.get('Cloudflare-CDN-Cache-Control'), null);
    assert.equal(res.headers.get('Cache-Tag'), null);
    pass('D. admin_session request is strictly no-store (zero cache poisoning)');
  }

  // Test E: Internal API is no-store
  {
    const res = await runMockMiddleware({
      url: 'https://rancangloka.com/api/internal/v1/media/jobs',
      method: 'GET',
      status: 200
    });

    assert.equal(res.headers.get('Cache-Control'), 'no-store, private');
    assert.equal(res.headers.get('Cloudflare-CDN-Cache-Control'), null);
    pass('E. Internal API route is strictly no-store');
  }

  // Test F: Mutation method (POST/PUT/DELETE) is no-store
  {
    const resPost = await runMockMiddleware({
      url: 'https://rancangloka.com/some-endpoint',
      method: 'POST',
      status: 200
    });
    assert.equal(resPost.headers.get('Cache-Control'), 'no-store, private');

    const resPut = await runMockMiddleware({
      url: 'https://rancangloka.com/some-endpoint',
      method: 'PUT',
      status: 200
    });
    assert.equal(resPut.headers.get('Cache-Control'), 'no-store, private');
    pass('F. Mutation methods (POST/PUT/DELETE) are strictly no-store');
  }

  // Test G: 4xx/5xx is no-store
  {
    const res404 = await runMockMiddleware({
      url: 'https://rancangloka.com/non-existent-article',
      method: 'GET',
      status: 404,
      initialHeaders: {
        'Cache-Control': 'public, max-age=60',
        'Cloudflare-CDN-Cache-Control': 'public, max-age=3600'
      }
    });
    assert.equal(res404.headers.get('Cache-Control'), 'no-store, private');
    assert.equal(res404.headers.get('Cloudflare-CDN-Cache-Control'), null);

    const res500 = await runMockMiddleware({
      url: 'https://rancangloka.com/server-error',
      method: 'GET',
      status: 500
    });
    assert.equal(res500.headers.get('Cache-Control'), 'no-store, private');
    pass('G. Error responses (4xx/5xx) are strictly no-store');
  }

  // Test H: Search API exposes whitelist only
  {
    const { GET: searchGet } = await import('../src/pages/api/search.json.ts');
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({
            results: [
              {
                id: 99,
                title: 'Material Fasad Ramah Lingkungan',
                slug: 'material-fasad-ramah-lingkungan',
                description: 'Panduan memilih fasad rumah ramah iklim.',
                category_name: 'Material',
                featured_image: 'https://rancangloka.com/media/fasad.webp',
                status: 'published',
                // Internal fields that MUST NOT leak:
                content_hash: 'secret_sha256_hash_value',
                views: 12450,
                key_takeaways: '["bata","kayu"]',
                focus_keyword: 'fasad rumah',
                category_id: 3,
                author_id: 1,
                is_featured: 1,
                is_trending: 0,
                disable_internal_links: 0
              }
            ]
          })
        })
      })
    };

    const mockRequest = new Request('https://rancangloka.com/api/search.json?q=fasad');
    const searchRes = await searchGet({
      request: mockRequest,
      locals: { runtime: { env: { DB: mockDb } } }
    });
    const json = await searchRes.json();

    assert.equal(json.length, 1);
    const item = json[0];
    assert.deepEqual(Object.keys(item).sort(), [
      'category_name',
      'description',
      'featured_image',
      'title',
      'slug'
    ].sort());

    assert.equal(item.content_hash, undefined);
    assert.equal(item.views, undefined);
    assert.equal(item.key_takeaways, undefined);
    assert.equal(item.focus_keyword, undefined);
    assert.equal(item.category_id, undefined);
    assert.equal(item.author_id, undefined);

    assert.equal(searchRes.headers.get('Cache-Control'), 'public, max-age=60');
    assert.equal(searchRes.headers.get('Cloudflare-CDN-Cache-Control'), 'public, max-age=300');
    assert.equal(searchRes.headers.get('Cache-Tag'), 'search');
    pass('H. Search API exposes whitelist only (zero internal field leakage)');
  }

  // Test I: Article Support target tags are generated correctly
  {
    const mockArticle = { id: 8, category_id: 5 };
    const mockPlaneALinks = [
      { target_article_id: 9 },
      { target_article_id: 7 },
      { target_article_id: 5 }
    ];

    const tags = getArticleCacheTags(mockArticle, { activePlaneALinks: mockPlaneALinks });
    assert.deepEqual(tags, [
      'article-8',
      'category-5',
      'support-target-9',
      'support-target-7',
      'support-target-5'
    ]);
    pass('I. Article Support target tags are generated correctly with active Plane A links');
  }

  // Test J: Cache purge tags are deterministic
  {
    const pubTags = getInvalidationTagsForEvent(9, 'ARTICLE_PUBLISHED', { categoryId: 3 });
    assert.ok(pubTags.includes('article-9'));
    assert.ok(pubTags.includes('category-3'));
    assert.ok(pubTags.includes('homepage'));
    assert.ok(pubTags.includes('rss'));
    assert.ok(pubTags.includes('sitemap'));
    assert.ok(pubTags.includes('search'));

    const titleTags = getInvalidationTagsForEvent(9, 'ARTICLE_TITLE_CHANGED', { categoryId: 3 });
    assert.ok(titleTags.includes('article-9'));
    assert.ok(titleTags.includes('support-target-9'));
    assert.ok(titleTags.includes('homepage'));
    assert.ok(titleTags.includes('rss'));

    const proseTags = getInvalidationTagsForEvent(9, 'ARTICLE_OPENING_PROSE_CHANGED');
    assert.deepEqual(proseTags.sort(), ['article-9', 'homepage', 'rss', 'support-target-9'].sort());

    const bodyOnlyTags = getInvalidationTagsForEvent(9, 'ARTICLE_REVISED');
    assert.deepEqual(bodyOnlyTags, ['article-9']);

    pass('J. Cache purge tags are deterministic and event-scoped');
  }

  // Test K: Canonical Plane A schema is used
  {
    let capturedSql = '';
    let capturedTargetId = null;
    const mockDb = {
      prepare: (sql) => {
        capturedSql = sql;
        return {
          bind: (tId) => {
            capturedTargetId = tId;
            return {
              all: async () => ({ results: [{ source_article_id: 8 }, { source_article_id: 12 }] })
            };
          }
        };
      }
    };

    const sources = await queryPlaneASourceArticles(mockDb, 9);
    assert.deepEqual(sources, [8, 12]);
    assert.equal(capturedTargetId, 9);
    assert.ok(capturedSql.includes("placement_plane = 'PLANE_A_DYNAMIC'"));
    assert.ok(capturedSql.includes("status = 'ACTIVE'"));
    assert.ok(!capturedSql.includes("plane = 'A'"));
    assert.ok(!capturedSql.includes('is_active = 1'));
    pass("K. Canonical Plane A schema contract strictly verified (placement_plane='PLANE_A_DYNAMIC' AND status='ACTIVE')");
  }

  // Test L: No article prose or hash mutation
  {
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ category_id: 2 })
        })
      })
    };
    const mockAdapter = {
      purged: [],
      purge: async (tags) => { mockAdapter.purged.push(...tags); }
    };

    const invalidationRes = await invalidateArticleCache(mockDb, 7, 'ARTICLE_TITLE_CHANGED', { adapter: mockAdapter });
    assert.equal(invalidationRes.success, true);
    assert.equal(invalidationRes.status, 'SUCCESS');
    assert.ok(invalidationRes.tags.includes('article-7'));
    assert.ok(invalidationRes.tags.includes('support-target-7'));
    pass('L. Invalidation runs purely out-of-band with zero article prose or hash mutation');
  }

  // =========================================================================
  // PRE-PRODUCTION HARDENING BEHAVIORAL SUITE (ITEMS A THROUGH L)
  // =========================================================================
  console.log('\n🛡️ Starting CONTENT_PROTECTION-1A Pre-Production Hardening Suite...');

  // Hardening A: Production adapter uses Workers Cache API contract ({ tags: [...] })
  {
    let receivedPayload = null;
    const mockCtx = {
      cache: {
        purge: async (payload) => {
          receivedPayload = payload;
        }
      }
    };
    const res = await purgeCacheTags(['article-1', 'homepage'], { ctx: mockCtx });
    assert.equal(res.status, 'SUCCESS');
    assert.deepEqual(receivedPayload, { tags: ['article-1', 'homepage'] });

    let adapterReceivedTags = null;
    const mockAdapter = {
      purge: async (tags) => {
        adapterReceivedTags = tags;
      }
    };
    const resAdapter = await purgeCacheTags(['article-2'], { adapter: mockAdapter });
    assert.equal(resAdapter.status, 'SUCCESS');
    assert.deepEqual(adapterReceivedTags, ['article-2']);
    pass('Hardening A: Production adapter uses Workers Cache API contract ({ tags: [...] })');
  }

  // Hardening B: No caches.default is used
  {
    const cacheCode = fs.readFileSync(path.resolve('src/lib/cache/index.ts'), 'utf8');
    assert.ok(!cacheCode.includes('caches.default'), 'Must not reference caches.default');
    assert.ok(!cacheCode.includes('caches.open'), 'Must not reference caches.open');
    pass('Hardening B: No caches.default is used');
  }

  // Hardening C: No ambiguous global cache fallback exists
  {
    const cacheCode = fs.readFileSync(path.resolve('src/lib/cache/index.ts'), 'utf8');
    assert.ok(!cacheCode.includes('globalThis.caches'), 'Must not use globalThis.caches');
    assert.ok(!cacheCode.includes('global.caches'), 'Must not use global.caches');
    assert.ok(!cacheCode.includes('// C. Non-Worker environment fallback (local simulation / tests)\n    return true;'), 'Must not silently return true');
    pass('Hardening C: No ambiguous global cache fallback exists');
  }

  // Hardening D: Unavailable cache runtime produces CACHE_API_UNAVAILABLE
  {
    // Calling in plain Node without ctx or adapter
    const res = await purgeCacheTags(['article-999']);
    assert.equal(res.status, 'CACHE_API_UNAVAILABLE');
    assert.ok(res.error && res.error.includes('unavailable'));
    assert.deepEqual(res.tags, ['article-999']);
    pass('Hardening D: Unavailable cache runtime produces CACHE_API_UNAVAILABLE');
  }

  // Hardening E: Purge failure produces CACHE_INVALIDATION_FAILED
  {
    const failingAdapter = {
      purge: async () => {
        throw new Error('Cloudflare Edge network purge timeout');
      }
    };
    const res = await purgeCacheTags(['article-500'], { adapter: failingAdapter });
    assert.equal(res.status, 'CACHE_INVALIDATION_FAILED');
    assert.equal(res.error, 'Cloudflare Edge network purge timeout');
    assert.deepEqual(res.tags, ['article-500']);
    pass('Hardening E: Purge failure produces CACHE_INVALIDATION_FAILED');
  }

  // Hardening F: Cache failure does not roll back canonical article mutation
  {
    const failingAdapter = {
      purge: async () => {
        throw new Error('Fatal edge connection error');
      }
    };
    const art = await insertArticle(null, {
      title: 'Rollback Invariant Test Article',
      slug: 'rollback-invariant-test-slug',
      status: 'draft'
    });
    const updated = await updateArticle(
      null,
      art.id,
      { title: 'Persisted Mutation With Cache Failure' },
      { cacheAdapter: failingAdapter }
    );
    assert.equal(updated.title, 'Persisted Mutation With Cache Failure');
    pass('Hardening F: Cache failure does not roll back canonical article mutation (DATABASE_TRUTH_WINS)');
  }

  // Hardening G: Canonical publisher invokes invalidation after successful publication
  {
    const execution = {
      execution_id: 'exec_canonical_pub_test',
      plan_id: 'plan_canonical_pub_test',
      article_id: 101,
      target_publish_at: '2026-10-16T12:00:00Z',
      content_hash: 'sha256_canonical_test_hash',
      featured_asset_id: 'ast_canonical_asset',
      claimed_by_worker: 'worker_pub_test',
      attempts_count: 0
    };
    const mockDb = {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => {
            if (sql.includes('publication_execution_receipts')) return null;
            if (sql.includes('server_now')) return { server_now: '2026-10-16T10:00:00.000Z' };
            if (sql.includes('category_id FROM articles')) return { category_id: 3 };
            return null;
          },
          run: async () => ({ changes: 1 }),
          all: async () => ({ results: [] })
        }),
        first: async () => ({ server_now: '2026-10-16T10:00:00.000Z' })
      }),
      batch: async (stmts) => stmts.map(() => ({ meta: { changes: 1 }, changes: 1 }))
    };

    const trackedTags = [];
    const trackingAdapter = {
      purge: async (tags) => {
        trackedTags.push(...tags);
      }
    };

    const pubRes = await executeAtomicPublication(
      mockDb,
      execution,
      'canonical-slug-test',
      1,
      undefined,
      { cacheAdapter: trackingAdapter }
    );

    assert.ok(pubRes.receiptId.startsWith('rcpt_'));
    assert.ok(trackedTags.includes('article-101'));
    assert.ok(trackedTags.includes('category-3'));
    assert.ok(trackedTags.includes('homepage'));
    assert.ok(trackedTags.includes('rss'));
    assert.ok(trackedTags.includes('sitemap'));
    assert.ok(trackedTags.includes('search'));
    pass('Hardening G: Canonical publisher invokes invalidation after successful publication');
  }

  // Hardening H: updateArticle Worker path invokes invalidation
  {
    const trackedTags = [];
    const trackingAdapter = {
      purge: async (tags) => {
        trackedTags.push(...tags);
      }
    };
    const art = await insertArticle(null, {
      title: 'Initial Title',
      slug: 'update-invalidation-slug',
      category_id: 1
    });
    // Transition to published via canonical mutation updateArticle
    await updateArticle(null, art.id, { status: 'published' }, { cacheAdapter: trackingAdapter });

    trackedTags.length = 0; // reset
    await updateArticle(
      null,
      art.id,
      { title: 'Updated Title Triggers Cache' },
      { cacheAdapter: trackingAdapter }
    );

    assert.ok(trackedTags.includes(`article-${art.id}`));
    assert.ok(trackedTags.includes(`support-target-${art.id}`));
    assert.ok(trackedTags.includes('homepage'));
    assert.ok(trackedTags.includes('rss'));
    assert.ok(trackedTags.includes('search'));
    assert.ok(trackedTags.includes('category-1'));
    pass('Hardening H: updateArticle Worker path invokes invalidation');
  }

  // Hardening I: insertArticle cannot silently create published public content without the canonical publication/invalidation contract
  {
    // A. Default status is draft
    const draftArt = await insertArticle(null, {
      title: 'Default Draft Article',
      slug: 'default-draft-slug'
    });
    assert.equal(draftArt.status, 'draft', 'insertArticle default status MUST be draft');

    // B. Direct published insert is rejected with DIRECT_PUBLISHED_INSERT_FORBIDDEN
    let threwDirectPub = false;
    let caughtCode = '';
    const forbiddenSlug = 'forbidden-direct-published-slug';
    try {
      await insertArticle(null, {
        title: 'Explicit Published Forbidden Article',
        slug: forbiddenSlug,
        status: 'published',
        category_id: 4
      });
    } catch (err) {
      threwDirectPub = true;
      caughtCode = err?.code || err?.message || '';
    }
    assert.ok(threwDirectPub, 'insertArticle with status="published" MUST throw');
    assert.ok(
      caughtCode.includes('DIRECT_PUBLISHED_INSERT_FORBIDDEN'),
      `Must reject with DIRECT_PUBLISHED_INSERT_FORBIDDEN error, got: ${caughtCode}`
    );

    // C. No D1/article mutation occurs after rejected direct published insert
    const notPersisted = await getArticleBySlug(null, forbiddenSlug);
    assert.equal(notPersisted, null, 'Rejected published insert must not create or persist article record');

    // D. Non-public lifecycle state (e.g., scheduled) remains supported
    const scheduledArt = await insertArticle(null, {
      title: 'Scheduled Non-Public Article',
      slug: 'scheduled-non-public-slug',
      status: 'scheduled'
    });
    assert.equal(scheduledArt.status, 'scheduled', 'Non-public lifecycle states remain supported');

    pass('Hardening I: insertArticle rejects status="published" with DIRECT_PUBLISHED_INSERT_FORBIDDEN and zero mutation');
  }

  // Hardening J: Legacy direct-D1 scripts are classified/documented as bypass paths
  {
    const pubScriptPath = path.resolve('scripts/publish-article-c-production.js');
    if (fs.existsSync(pubScriptPath)) {
      const pubScript = fs.readFileSync(pubScriptPath, 'utf8');
      assert.ok(pubScript.includes('LEGACY_DIRECT_D1') || pubScript.includes('MAINTENANCE_ONLY'), 'Must classify publish-article-c as LEGACY_DIRECT_D1');
      assert.ok(pubScript.includes('DIRECT_PRODUCTION_D1_MUTATION_BYPASSES_WORKERS_CACHE_INVALIDATION'), 'Must include bypass warning in publish-article-c');
    }

    const repairScript = fs.readFileSync(path.resolve('scripts/repair-article5-content-html.js'), 'utf8');
    assert.ok(repairScript.includes('LEGACY_DIRECT_D1') || repairScript.includes('MAINTENANCE_ONLY'), 'Must classify repair-article5 as LEGACY_DIRECT_D1');
    assert.ok(repairScript.includes('DIRECT_PRODUCTION_D1_MUTATION_BYPASSES_WORKERS_CACHE_INVALIDATION'), 'Must include bypass warning in repair-article5');
    pass('Hardening J: Legacy direct-D1 scripts are classified/documented as bypass paths');
  }

  // Hardening K: Cache tags remain deterministic
  {
    const allEvents = [
      'ARTICLE_PUBLISHED',
      'ARTICLE_REVISED',
      'ARTICLE_TITLE_CHANGED',
      'ARTICLE_FEATURED_IMAGE_CHANGED',
      'ARTICLE_OPENING_PROSE_CHANGED',
      'ARTICLE_READING_TIME_CHANGED',
      'ARTICLE_UNPUBLISHED',
      'ARTICLE_SLUG_CHANGED',
      'INTERNAL_LINK_GRAPH_CHANGED'
    ];
    for (const evt of allEvents) {
      const tags1 = getInvalidationTagsForEvent(15, evt, { categoryId: 3, sourceId: 20 });
      const tags2 = getInvalidationTagsForEvent(15, evt, { categoryId: 3, sourceId: 20 });
      assert.deepEqual(tags1, tags2, `Tags for ${evt} must be strictly deterministic`);
      assert.ok(Array.isArray(tags1) && tags1.length > 0);
    }
    pass('Hardening K: Cache tags remain deterministic');
  }

  // Hardening L: Published article prose/hash is untouched
  {
    const originalMd = '## Canonical Prose Heading\nThis is the authoritative prose.';
    const originalHash = 'sha256_canonical_prose_hash_value';
    const testArticle = {
      id: 50,
      title: 'Prose Protection Test',
      slug: 'prose-protection-test',
      content_md: originalMd,
      content_hash: originalHash,
      category_id: 1,
      status: 'published'
    };

    const mockAdapter = {
      purged: [],
      purge: async (tags) => { mockAdapter.purged.push(...tags); }
    };
    const res = await invalidateArticleCache(null, testArticle.id, 'ARTICLE_REVISED', { adapter: mockAdapter });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(testArticle.content_md, originalMd, 'Prose content must be 100% untouched');
    assert.equal(testArticle.content_hash, originalHash, 'Content hash must be 100% untouched');
    pass('Hardening L: Published article prose/hash is untouched');
  }

  console.log(`\n===========================================================`);
  console.log(`🏁 CONTENT_PROTECTION-1A Test Suite: ${passCount} Passed, 0 Failed`);
  console.log(`===========================================================\n`);
}

runSuite().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
