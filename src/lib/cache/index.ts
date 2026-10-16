/**
 * RancangLoka — Workers Cache & Invalidation Engine
 * Milestone: CONTENT_PROTECTION-1A
 *
 * Provides canonical cache tag vocabularies, deterministic tag derivation,
 * query resolution for Plane A reverse internal link dependencies, and
 * safe Workers Cache tag purging.
 */

export type InvalidationEventType =
  | 'ARTICLE_PUBLISHED'
  | 'ARTICLE_REVISED'
  | 'ARTICLE_TITLE_CHANGED'
  | 'ARTICLE_FEATURED_IMAGE_CHANGED'
  | 'ARTICLE_OPENING_PROSE_CHANGED'
  | 'ARTICLE_READING_TIME_CHANGED'
  | 'ARTICLE_UNPUBLISHED'
  | 'ARTICLE_SLUG_CHANGED'
  | 'INTERNAL_LINK_GRAPH_CHANGED';

export interface CacheTagDerivationOptions {
  categoryId?: number | null;
  activePlaneALinks?: Array<{ target_article_id: number }>;
}

/**
 * 1. Derives cache tags for a published article response.
 * Tags must be printable ASCII, without spaces, compact, and deterministic.
 *
 * Canonical Vocabulary:
 * - article-<id>
 * - category-<id>
 * - support-target-<target_article_id>
 */
export function getArticleCacheTags(
  article: { id: number; category_id?: number | null },
  options: CacheTagDerivationOptions = {}
): string[] {
  const tags: string[] = [`article-${article.id}`];

  const catId = options.categoryId ?? article.category_id;
  if (catId) {
    tags.push(`category-${catId}`);
  }

  if (options.activePlaneALinks && Array.isArray(options.activePlaneALinks)) {
    const seen = new Set<number>();
    for (const link of options.activePlaneALinks) {
      if (link.target_article_id && !seen.has(link.target_article_id)) {
        seen.add(link.target_article_id);
        tags.push(`support-target-${link.target_article_id}`);
      }
    }
  }

  return tags;
}

/**
 * 2. Deterministic invalidation tags mapping per publication event.
 * Avoids global purge while guaranteeing all stale surfaces are invalidated.
 */
export function getInvalidationTagsForEvent(
  articleId: number,
  eventType: InvalidationEventType,
  options: { categoryId?: number | null; sourceId?: number } = {}
): string[] {
  const tags = new Set<string>();
  const catTag = options.categoryId ? `category-${options.categoryId}` : null;

  switch (eventType) {
    case 'ARTICLE_PUBLISHED':
      tags.add(`article-${articleId}`);
      tags.add('homepage');
      tags.add('rss');
      tags.add('sitemap');
      tags.add('search');
      if (catTag) tags.add(catTag);
      break;

    case 'ARTICLE_REVISED':
      // Body prose revision only: target cards and feed summaries remain unchanged
      tags.add(`article-${articleId}`);
      break;

    case 'ARTICLE_TITLE_CHANGED':
      tags.add(`article-${articleId}`);
      tags.add(`support-target-${articleId}`);
      tags.add('homepage');
      tags.add('rss');
      tags.add('search');
      if (catTag) tags.add(catTag);
      break;

    case 'ARTICLE_FEATURED_IMAGE_CHANGED':
      tags.add(`article-${articleId}`);
      tags.add(`support-target-${articleId}`);
      tags.add('homepage');
      tags.add('search');
      if (catTag) tags.add(catTag);
      break;

    case 'ARTICLE_OPENING_PROSE_CHANGED':
      // Support card excerpts on source articles derive from opening prose
      tags.add(`article-${articleId}`);
      tags.add(`support-target-${articleId}`);
      tags.add('homepage');
      tags.add('rss');
      break;

    case 'ARTICLE_READING_TIME_CHANGED':
      tags.add(`article-${articleId}`);
      tags.add(`support-target-${articleId}`);
      break;

    case 'ARTICLE_UNPUBLISHED':
    case 'ARTICLE_SLUG_CHANGED':
      tags.add(`article-${articleId}`);
      tags.add(`support-target-${articleId}`);
      tags.add('homepage');
      tags.add('rss');
      tags.add('sitemap');
      tags.add('search');
      if (catTag) tags.add(catTag);
      break;

    case 'INTERNAL_LINK_GRAPH_CHANGED':
      if (options.sourceId) {
        tags.add(`article-${options.sourceId}`);
      }
      break;

    default:
      tags.add(`article-${articleId}`);
      break;
  }

  return Array.from(tags);
}

/**
 * 3. Canonical query for finding active Plane A source articles targeting targetArticleId.
 * Used for reverse dependency verification and auditing.
 *
 * Contract:
 * - placement_plane = 'PLANE_A_DYNAMIC'
 * - status = 'ACTIVE'
 */
export async function queryPlaneASourceArticles(
  db: any,
  targetArticleId: number
): Promise<number[]> {
  if (!db || typeof db.prepare !== 'function') {
    return [];
  }

  try {
    const result = await db
      .prepare(`
        SELECT DISTINCT source_article_id
        FROM article_internal_links
        WHERE target_article_id = ?
          AND placement_plane = 'PLANE_A_DYNAMIC'
          AND status = 'ACTIVE'
      `)
      .bind(targetArticleId)
      .all();

    const rows = result?.results || result || [];
    return rows.map((r: any) => Number(r.source_article_id)).filter((id: number) => !isNaN(id));
  } catch (err) {
    console.warn('[CacheEngine] queryPlaneASourceArticles failed:', err);
    return [];
  }
}

/**
 * 4. Safe Workers Cache purge implementation.
 * Uses selector object { tags: [...] } compliant with Cloudflare Workers Cache API.
 * Never throws into caller; logs structured error if invalidation fails.
 */
export async function purgeCacheTags(
  tags: string[],
  options: { ctx?: any } = {}
): Promise<boolean> {
  if (!tags || tags.length === 0) {
    return true;
  }

  try {
    // A. Check if ExecutionContext cache purge is available
    if (options.ctx?.cache && typeof options.ctx.cache.purge === 'function') {
      await options.ctx.cache.purge({ tags });
      return true;
    }

    // B. Check if cloudflare:workers cache module is available in Workers runtime
    let cloudflareCache: any = null;
    try {
      // Dynamic import to avoid breaking Node.js test runners
      // @ts-ignore
      const cfMod = await import('cloudflare:workers');
      cloudflareCache = cfMod?.cache;
    } catch {
      // Environment does not support cloudflare:workers (e.g. local Node test runner)
    }

    if (cloudflareCache && typeof cloudflareCache.purge === 'function') {
      await cloudflareCache.purge({ tags });
      return true;
    }

    // C. Non-Worker environment fallback (local simulation / tests)
    return true;
  } catch (err: any) {
    console.error(
      JSON.stringify({
        event: 'CACHE_INVALIDATION_FAILED',
        tags,
        error: err?.message || String(err),
        timestamp: new Date().toISOString()
      })
    );
    return false;
  }
}

/**
 * 5. High-level publication cache invalidator.
 * Queries metadata if needed, calculates deterministic tags, and purges.
 * Invalidation failure never fails the underlying publication operation.
 */
export async function invalidateArticleCache(
  db: any,
  articleId: number,
  eventType: InvalidationEventType,
  options: { categoryId?: number | null; sourceId?: number; ctx?: any } = {}
): Promise<{ success: boolean; tags: string[] }> {
  let categoryId = options.categoryId;

  // Resolve category if not supplied
  if (categoryId === undefined && db && typeof db.prepare === 'function') {
    try {
      const row = await db
        .prepare('SELECT category_id FROM articles WHERE id = ? LIMIT 1')
        .bind(articleId)
        .first();
      categoryId = row?.category_id;
    } catch {
      // Non-fatal
    }
  }

  const tags = getInvalidationTagsForEvent(articleId, eventType, {
    categoryId,
    sourceId: options.sourceId
  });

  const success = await purgeCacheTags(tags, { ctx: options.ctx });
  return { success, tags };
}
