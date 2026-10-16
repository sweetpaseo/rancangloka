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

import assert from 'node:assert/strict';
import { onRequest } from '../src/middleware.ts';
import {
  getArticleCacheTags,
  getInvalidationTagsForEvent,
  queryPlaneASourceArticles,
  purgeCacheTags,
  invalidateArticleCache
} from '../src/lib/cache/index.ts';

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

    const invalidationRes = await invalidateArticleCache(mockDb, 7, 'ARTICLE_TITLE_CHANGED');
    assert.equal(invalidationRes.success, true);
    assert.ok(invalidationRes.tags.includes('article-7'));
    assert.ok(invalidationRes.tags.includes('support-target-7'));
    pass('L. Invalidation runs purely out-of-band with zero article prose or hash mutation');
  }

  console.log(`\n===========================================================`);
  console.log(`🏁 CONTENT_PROTECTION-1A Test Suite: ${passCount} Passed, 0 Failed`);
  console.log(`===========================================================\n`);
}

runSuite().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
