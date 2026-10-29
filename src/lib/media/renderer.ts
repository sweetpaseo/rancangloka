/**
 * RancangLoka — Inline Media Slot Renderer
 * Phase 1 Implementation
 *
 * Implements safe, layout-stable rendering of inline editorial figures with:
 * 1. Strict semantic <figure> and <figcaption> markup.
 * 2. Strict XSS mitigation (HTML escaping on alt text, caption, slot keys).
 * 3. Intrinsic width/height and aspect ratio containment to prevent CLS.
 * 4. Safe URL validation.
 * 5. Deterministic integration with manifest-driven anchor resolution.
 */

import {
  resolveVisualPlacements,
  type VisualPlacementManifest,
  type PlacementResolutionResult
} from './anchor-resolver.ts';
import { loadArticleVisualManifest } from './manifest-loader.ts';

const MEDIA_ANCHOR_PATTERN = /\{\{media:([a-z][a-z0-9_]{1,63})\}\}/g;
const VALID_SLOT_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export interface RenderMediaOptions {
  articleSlug?: string;
  contentMd?: string;
  manifest?: VisualPlacementManifest;
  autoLoadManifest?: boolean;
  isDev?: boolean;
  isLocalFixture?: boolean;
  allowUnapprovedInPreview?: boolean;
  localAssets?: Record<
    string,
    {
      public_url: string;
      alt_text?: string;
      caption?: string;
      width?: number;
      height?: number;
      is_fixture?: boolean;
    }
  >;
}

export function escapeHtml(value: string): string {
  if (!value) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isSafeMediaUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const cleaned = url.replace(/[\u0000-\u001F\u007F-\u009F\s]+/g, '').trim().toLowerCase();
  if (
    cleaned.startsWith('javascript:') ||
    cleaned.startsWith('vbscript:') ||
    cleaned.includes('javascript:') ||
    cleaned.startsWith('data:text/html')
  ) {
    return false;
  }
  return (
    cleaned.startsWith('/') ||
    cleaned.startsWith('http://') ||
    cleaned.startsWith('https://') ||
    cleaned.startsWith('data:image/')
  );
}

export function hasMediaAnchors(html: string): boolean {
  return MEDIA_ANCHOR_PATTERN.test(html);
}

export function formatInlineFigure(params: {
  slotKey: string;
  publicUrl: string;
  altText: string;
  caption?: string;
  width?: number;
  height?: number;
  isFixture?: boolean;
}): string {
  const { slotKey, publicUrl, altText, caption, width = 1200, height = 675, isFixture } = params;

  if (!isSafeMediaUrl(publicUrl)) {
    return '';
  }

  const safeSlot = escapeHtml(slotKey);
  const safeAlt = escapeHtml(altText || 'Media artikel RancangLoka');
  const safeUrl = escapeHtml(publicUrl);
  const safeCaption = caption ? escapeHtml(caption) : '';

  const fixtureAttr = isFixture ? ' data-fixture-asset="true"' : '';
  const fixtureBadge = isFixture
    ? ' <span class="text-amber-600 dark:text-amber-400 font-semibold">(Fixture Media - Belum Disetujui)</span>'
    : '';

  return `<figure class="rl-media-slot my-8 max-w-full" data-media-slot="${safeSlot}"${fixtureAttr}>
  <div class="relative overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800 aspect-16/9">
    <img src="${safeUrl}" alt="${safeAlt}" width="${width}" height="${height}" loading="lazy" decoding="async" class="w-full h-full object-cover" />
  </div>
  ${safeCaption ? `<figcaption class="mt-2.5 text-center text-xs text-stone-500 dark:text-stone-400 font-sans tracking-tight">${safeCaption}${fixtureBadge}</figcaption>` : ''}
</figure>`;
}

export async function renderMediaSlotAnchors(
  db: any,
  articleId: number | string,
  html: string,
  options?: RenderMediaOptions
): Promise<string> {
  if (!html || typeof html !== 'string') return '';

  let workingHtml = html;

  // 1. Resolve manifest (from options.manifest or via loadArticleVisualManifest if autoLoadManifest is requested)
  let manifest: VisualPlacementManifest | null | undefined = options?.manifest;
  if (!manifest && options?.autoLoadManifest) {
    manifest = await loadArticleVisualManifest({
      articleId,
      slug: options?.articleSlug,
      db
    });
  }

  if (manifest && Array.isArray(manifest.visual_items) && manifest.visual_items.length > 0) {
    // Clone manifest to prevent mutating caller's object
    const resolvedManifest: VisualPlacementManifest = JSON.parse(JSON.stringify(manifest));

    // Enrich manifest items with active attached assets from D1 if db and articleId are available
    if (db && (typeof articleId === 'number' || !isNaN(Number(articleId)))) {
      try {
        const stmt = db.prepare(
          `
          SELECT am.slot_key, am.caption, ma.asset_id, ma.storage_key, ma.public_url, ma.alt_text, ma.width, ma.height
          FROM article_media am
          JOIN media_assets ma ON am.asset_id = ma.asset_id
          WHERE am.article_id = ?
            AND am.is_active = 1
            AND ma.status = 'VALIDATED'
            AND ma.media_type = 'image'
        `
        );
        const bound = stmt?.bind ? stmt.bind(Number(articleId)) : stmt;
        let activeRows: any[] = [];
        if (bound && typeof bound.all === 'function') {
          const res = await bound.all();
          activeRows = Array.isArray(res?.results) ? res.results : (Array.isArray(res) ? res : []);
        } else if (bound && typeof bound.first === 'function') {
          const first = await bound.first();
          if (first) activeRows = [first];
        }
        const activeMap = new Map<string, any>();
        for (const row of activeRows) {
          if (row.slot_key) {
            activeMap.set(row.slot_key, row);
          }
        }

        for (const item of resolvedManifest.visual_items) {
          const attached = activeMap.get(item.slot_key);
          if (attached) {
            item.asset_id = attached.asset_id;
            item.storage_key = attached.storage_key || attached.public_url;
            item.editorial_approval = 'APPROVED_FOR_INLINE_PUBLICATION';
            item.review_status = 'APPROVED_TECHNICAL_TRUTH';
            if (attached.alt_text) item.alt_text = attached.alt_text;
            if (attached.caption) item.caption = attached.caption;
            if (attached.width && item.visual_brief) item.visual_brief.intended_width = Number(attached.width) || item.visual_brief.intended_width;
            if (attached.height && item.visual_brief) item.visual_brief.intended_height = Number(attached.height) || item.visual_brief.intended_height;
          }
        }
      } catch (err) {
        console.warn('[renderMediaSlotAnchors] Could not query article_media for manifest enrichment:', err);
      }
    }

    // Also support options.localAssets (for local testing/fixtures)
    if (options?.localAssets) {
      for (const item of resolvedManifest.visual_items) {
        const local = options.localAssets[item.slot_key];
        if (local) {
          item.storage_key = local.public_url;
          if (local.alt_text) item.alt_text = local.alt_text;
          if (local.caption) item.caption = local.caption;
          if (local.width && item.visual_brief) item.visual_brief.intended_width = local.width;
          if (local.height && item.visual_brief) item.visual_brief.intended_height = local.height;
          if (!local.is_fixture) {
            item.editorial_approval = 'APPROVED_FOR_INLINE_PUBLICATION';
            item.review_status = 'APPROVED_TECHNICAL_TRUTH';
          }
        }
      }
    }

    const isDev = Boolean(options?.isDev || options?.isLocalFixture);
    const placementResult: PlacementResolutionResult = resolveVisualPlacements(workingHtml, resolvedManifest, {
      contentMd: options?.contentMd,
      isDev,
      allowUnapprovedInPreview: options?.allowUnapprovedInPreview ?? isDev
    });
    workingHtml = placementResult.html;
  }

  // 2. Resolve {{media:slot_key}} shortcode anchors
  const matches = Array.from(workingHtml.matchAll(MEDIA_ANCHOR_PATTERN));
  const slotKeys = Array.from(new Set(matches.map((m) => m[1])));

  if (slotKeys.length === 0) {
    return workingHtml;
  }

  const rendered = new Map<string, string>();

  for (const slotKey of slotKeys) {
    if (!VALID_SLOT_KEY_PATTERN.test(slotKey)) {
      rendered.set(slotKey, '');
      continue;
    }

    // Check local fixture assets first (if provided)
    if (options?.localAssets && options.localAssets[slotKey]) {
      const asset = options.localAssets[slotKey];
      rendered.set(
        slotKey,
        formatInlineFigure({
          slotKey,
          publicUrl: asset.public_url,
          altText: asset.alt_text || '',
          caption: asset.caption,
          width: asset.width,
          height: asset.height,
          isFixture: true
        })
      );
      continue;
    }

    // Otherwise query D1 database
    if (db && (typeof articleId === 'number' || !isNaN(Number(articleId)))) {
      try {
        const row = await db
          .prepare(
            `
            SELECT ma.public_url, ma.alt_text, ma.width, ma.height, am.caption
            FROM article_media am
            JOIN media_assets ma ON am.asset_id = ma.asset_id
            WHERE am.article_id = ?
              AND am.slot_key = ?
              AND am.is_active = 1
              AND ma.status = 'VALIDATED'
              AND ma.media_type = 'image'
            LIMIT 1
          `
          )
          .bind(Number(articleId), slotKey)
          .first();

        if (row?.public_url && isSafeMediaUrl(row.public_url)) {
          rendered.set(
            slotKey,
            formatInlineFigure({
              slotKey,
              publicUrl: String(row.public_url),
              altText: String(row.alt_text || ''),
              caption: row.caption ? String(row.caption) : undefined,
              width: Number(row.width) || 1200,
              height: Number(row.height) || 675,
              isFixture: false
            })
          );
          continue;
        }
      } catch (_) {
        // Fall through to empty substitution
      }
    }

    // Default if unmapped: empty string (strip shortcode cleanly)
    rendered.set(slotKey, '');
  }

  return workingHtml.replace(MEDIA_ANCHOR_PATTERN, (_match, slotKey) => rendered.get(slotKey) || '');
}
