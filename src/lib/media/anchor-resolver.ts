/**
 * RancangLoka — Inline Editorial Visual Engine: Anchor Resolver & Placement Engine
 * Phase 1 Implementation (Strictly Fail-Safe & Deterministic)
 *
 * Invariants:
 * 1. STRICT ANCHOR TRUTH: Matches exact heading anchors; never guesses with silent fuzzy fallback.
 * 2. CONTENT HASH BINDING: Cryptographically verifies content_hash against canonical markdown.
 * 3. FAIL-SAFE ISOLATION: Missing, ambiguous, or stale anchors reject insertion and return diagnostic warnings.
 * 4. PRODUCTION BOUNDARY: Unapproved media assets are strictly barred from production publication.
 * 5. DUPLICATE PREVENTION: Enforces unique slot keys per article manifest.
 */

import { createHash } from 'node:crypto';

export type AnchorPlacementPosition = 'before_heading' | 'after_heading' | 'after_paragraph_containing';

export interface VisualPlacementAnchor {
  target_heading_text: string;
  target_heading_id?: string;
  target_subheading_text?: string;
  position: AnchorPlacementPosition;
  paragraph_anchor_phrase?: string;
  fallback_position?: AnchorPlacementPosition;
}

export interface VisualManifestItem {
  visual_id: string;
  slot_key: string;
  media_type: 'photograph' | 'technical_diagram' | 'comparison' | 'detail_close_up' | 'annotated_illustration';
  priority: 'essential' | 'helpful' | 'unnecessary';
  placement: VisualPlacementAnchor;
  visual_purpose: string;
  visual_brief: {
    prompt_indonesian: string;
    storytelling_class: string;
    aspect_ratio: string;
    intended_width: number;
    intended_height: number;
  };
  caption: string;
  alt_text: string;
  asset_id: string | null;
  storage_key: string | null;
  review_status: 'PENDING' | 'APPROVED_TECHNICAL_TRUTH' | 'REJECTED';
  editorial_approval: 'PENDING' | 'APPROVED_FOR_INLINE_PUBLICATION' | 'REJECTED';
}

export interface VisualPlacementManifest {
  manifest_version: string;
  article_id: string;
  article_slug: string;
  content_hash?: string;
  featured?: {
    src: string;
    alt?: string;
    caption?: string;
  };
  visual_items: VisualManifestItem[];
}

export interface PlacementWarning {
  code:
    | 'STALE_CONTENT_HASH'
    | 'DUPLICATE_SLOT_KEY'
    | 'MISSING_HEADING_ANCHOR'
    | 'AMBIGUOUS_HEADING_ANCHOR'
    | 'MISSING_PARAGRAPH_ANCHOR'
    | 'UNAPPROVED_MEDIA'
    | 'INVALID_SLOT_KEY';
  visual_id?: string;
  slot_key?: string;
  message: string;
}

export interface PlacementResolutionResult {
  html: string;
  placedCount: number;
  warnings: PlacementWarning[];
  isValid: boolean;
}

export interface ResolvePlacementOptions {
  contentMd?: string;
  isDev?: boolean;
  allowUnapprovedInPreview?: boolean;
  renderFigureFn?: (item: VisualManifestItem, isPreview: boolean) => string;
}

/**
 * Normalizes text for comparison by stripping markdown markup, HTML tags, and collapsing whitespace.
 */
export function normalizeAnchorText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '') // strip HTML tags
    .replace(/[*_#`~]/g, '') // strip markdown formatting characters
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Computes sha256 hex digest of article content string.
 */
export function computeCanonicalContentHash(content: string): string {
  if (!content) return '';
  const normalized = content.replace(/\s+/g, ' ').trim().toLowerCase();
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Computes sha256 hex digest of article content string.
 * Uses canonical normalization identical to generateContentHash.
 */
export function computeContentHash(content: string): string {
  return computeCanonicalContentHash(content);
}

/**
 * Resolves inline visual placements into HTML based on a placement manifest.
 * Fails closed if content hash differs or anchors cannot be precisely located.
 */
export function resolveVisualPlacements(
  html: string,
  manifest: VisualPlacementManifest,
  options: ResolvePlacementOptions = {}
): PlacementResolutionResult {
  const warnings: PlacementWarning[] = [];

  if (!html || typeof html !== 'string') {
    return { html: '', placedCount: 0, warnings, isValid: false };
  }

  if (!manifest || !Array.isArray(manifest.visual_items) || manifest.visual_items.length === 0) {
    return { html, placedCount: 0, warnings, isValid: true };
  }

  // 1. Content Hash Verification
  if (options.contentMd && manifest.content_hash) {
    const canonicalHash = computeCanonicalContentHash(options.contentMd);
    const legacyTrimHash = createHash('sha256').update(options.contentMd.replace(/\r\n/g, '\n').trim(), 'utf8').digest('hex');
    const legacyRawHash = createHash('sha256').update(options.contentMd, 'utf8').digest('hex');
    const cleanManifestHash = manifest.content_hash.replace(/^sha256:/i, '').trim().toLowerCase();
    if (
      canonicalHash !== cleanManifestHash &&
      legacyTrimHash !== cleanManifestHash &&
      legacyRawHash !== cleanManifestHash
    ) {
      warnings.push({
        code: 'STALE_CONTENT_HASH',
        message: `Manifest content hash (${cleanManifestHash}) does not match current manuscript hash (${canonicalHash}). Placement aborted for editorial safety.`
      });
      return { html, placedCount: 0, warnings, isValid: false };
    }
  }

  // 2. Duplicate Slot Key Detection
  const seenSlots = new Set<string>();
  for (const item of manifest.visual_items) {
    if (seenSlots.has(item.slot_key)) {
      warnings.push({
        code: 'DUPLICATE_SLOT_KEY',
        visual_id: item.visual_id,
        slot_key: item.slot_key,
        message: `Duplicate slot_key '${item.slot_key}' detected in manifest item '${item.visual_id}'.`
      });
      return { html, placedCount: 0, warnings, isValid: false };
    }
    seenSlots.add(item.slot_key);
  }

  // 3. Scan Headings in HTML
  // Match <h[2-6] id="...">content</h[2-6]>
  const headingRegex = /<h([2-6])([^>]*)>([\s\S]*?)<\/h\1>/gi;
  interface HeadingMatch {
    tag: string;
    level: number;
    attrs: string;
    id: string;
    rawContent: string;
    normalizedContent: string;
    startIndex: number;
    endIndex: number;
  }

  const headings: HeadingMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRegex.exec(html)) !== null) {
    const idMatch = /id\s*=\s*["']([^"']+)["']/i.exec(m[2]);
    headings.push({
      tag: `h${m[1]}`,
      level: parseInt(m[1], 10),
      attrs: m[2],
      id: idMatch ? idMatch[1] : '',
      rawContent: m[3],
      normalizedContent: normalizeAnchorText(m[3]),
      startIndex: m.index,
      endIndex: m.index + m[0].length
    });
  }

  // We will build insertions: array of { index: number, content: string }
  const insertions: { index: number; content: string; visual_id: string }[] = [];

  for (const item of manifest.visual_items) {
    // 4. Validate Slot Key Format
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(item.slot_key)) {
      warnings.push({
        code: 'INVALID_SLOT_KEY',
        visual_id: item.visual_id,
        slot_key: item.slot_key,
        message: `Invalid slot key format '${item.slot_key}'. Must be lower-case alphanumeric with underscore.`
      });
      continue;
    }

    // 5. Check Publication & Approval Boundary
    const isApproved = item.editorial_approval === 'APPROVED_FOR_INLINE_PUBLICATION';
    const isPreview = options.allowUnapprovedInPreview !== undefined
      ? Boolean(options.allowUnapprovedInPreview)
      : Boolean(options.isDev);

    if (!isApproved && !isPreview) {
      warnings.push({
        code: 'UNAPPROVED_MEDIA',
        visual_id: item.visual_id,
        slot_key: item.slot_key,
        message: `Visual item '${item.visual_id}' is unapproved (editorial_approval: '${item.editorial_approval}'). Excluded from production render.`
      });
      continue;
    }

    // 6. Anchor Matching
    const targetNorm = normalizeAnchorText(item.placement.target_heading_text);
    const targetId = item.placement.target_heading_id ? item.placement.target_heading_id.trim().toLowerCase() : '';

    const matchingHeadings = headings.filter((h) => {
      if (targetId && h.id && h.id.toLowerCase() === targetId) {
        return true;
      }
      return h.normalizedContent === targetNorm;
    });

    if (matchingHeadings.length === 0) {
      warnings.push({
        code: 'MISSING_HEADING_ANCHOR',
        visual_id: item.visual_id,
        slot_key: item.slot_key,
        message: `Target heading anchor '${item.placement.target_heading_text}' was not found in manuscript.`
      });
      continue;
    }

    if (matchingHeadings.length > 1) {
      warnings.push({
        code: 'AMBIGUOUS_HEADING_ANCHOR',
        visual_id: item.visual_id,
        slot_key: item.slot_key,
        message: `Ambiguous heading anchor: ${matchingHeadings.length} headings matched '${item.placement.target_heading_text}'. Placement rejected.`
      });
      continue;
    }

    const matchedHeading = matchingHeadings[0];
    let insertIndex = -1;

    if (item.placement.position === 'before_heading') {
      insertIndex = matchedHeading.startIndex;
    } else if (item.placement.position === 'after_heading') {
      insertIndex = matchedHeading.endIndex;
    } else if (item.placement.position === 'after_paragraph_containing') {
      const phrase = item.placement.paragraph_anchor_phrase;
      if (!phrase) {
        warnings.push({
          code: 'MISSING_PARAGRAPH_ANCHOR',
          visual_id: item.visual_id,
          slot_key: item.slot_key,
          message: `Position 'after_paragraph_containing' requested but paragraph_anchor_phrase was omitted.`
        });
        continue;
      }

      // Search subsequent text between this heading and the next heading of same or higher level
      const currentHeadIdx = headings.indexOf(matchedHeading);
      const nextHeading = headings.slice(currentHeadIdx + 1).find((h) => h.level <= matchedHeading.level);
      const sectionEnd = nextHeading ? nextHeading.startIndex : html.length;
      const sectionHtml = html.slice(matchedHeading.endIndex, sectionEnd);

      const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      let pMatch: RegExpExecArray | null;
      let foundParagraphEnd = -1;
      const normPhrase = phrase.trim().toLowerCase();

      while ((pMatch = pRegex.exec(sectionHtml)) !== null) {
        const pText = pMatch[1].toLowerCase();
        const pPlainText = pMatch[1].replace(/<[^>]+>/g, '').toLowerCase();
        if (pText.includes(normPhrase) || pPlainText.includes(normPhrase)) {
          foundParagraphEnd = matchedHeading.endIndex + pMatch.index + pMatch[0].length;
          break;
        }
      }

      if (foundParagraphEnd !== -1) {
        insertIndex = foundParagraphEnd;
      } else {
        warnings.push({
          code: 'MISSING_PARAGRAPH_ANCHOR',
          visual_id: item.visual_id,
          slot_key: item.slot_key,
          message: `Paragraph anchor phrase '${phrase}' was not found in section '${matchedHeading.rawContent}'.`
        });
        continue;
      }
    }

    if (insertIndex >= 0) {
      const figureHtml = options.renderFigureFn
        ? options.renderFigureFn(item, isPreview)
        : defaultRenderFigure(item, isPreview);
      insertions.push({ index: insertIndex, content: figureHtml, visual_id: item.visual_id });
    }
  }

  // Sort insertions in descending order of index so string splicing doesn't alter remaining indices
  insertions.sort((a, b) => b.index - a.index);

  let resultHtml = html;
  for (const ins of insertions) {
    resultHtml = resultHtml.slice(0, ins.index) + ins.content + resultHtml.slice(ins.index);
  }

  return {
    html: resultHtml,
    placedCount: insertions.length,
    warnings,
    isValid: warnings.length === 0
  };
}

/**
 * Escapes characters for HTML attribute and content safety.
 */
function escapeHtml(value: string): string {
  if (!value) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Safe default renderer for an inline visual figure.
 */
function defaultRenderFigure(item: VisualManifestItem, isPreview: boolean): string {
  const slotKey = escapeHtml(item.slot_key);
  const alt = escapeHtml(item.alt_text || 'Ilustrasi teknis RancangLoka');
  const caption = escapeHtml(item.caption || '');
  const width = item.visual_brief?.intended_width || 1200;
  const height = item.visual_brief?.intended_height || 675;

  const rawKey = item.storage_key ? item.storage_key.trim() : '';
  let url = '';
  if (rawKey) {
    if (rawKey.startsWith('http://') || rawKey.startsWith('https://') || rawKey.startsWith('data:') || rawKey.startsWith('/')) {
      url = escapeHtml(rawKey);
    } else if (rawKey.startsWith('storage/experimental-media/')) {
      url = escapeHtml(`/${rawKey.replace(/^storage\//, '')}`);
    } else if (rawKey.startsWith('experimental-media/')) {
      url = escapeHtml(`/${rawKey}`);
    } else {
      const stripped = rawKey.replace(/^\/+/, '');
      url = escapeHtml(stripped.startsWith('media/') ? `/${stripped}` : `/media/${stripped}`);
    }
  }

  if (!url) {
    if (isPreview) {
      // Clean diagnostic preview box for Chief Editor / developer preview
      return `<figure class="rl-media-slot my-8 max-w-full" data-media-slot="${slotKey}" data-review-status="${escapeHtml(item.review_status)}">
  <div class="relative overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800 border-2 border-dashed border-stone-300 dark:border-stone-700 aspect-16/9 flex flex-col items-center justify-center p-6 text-center">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 mb-2">
      PROPOSAL VISUAL EDITORIAL (${escapeHtml(item.media_type)})
    </div>
    <p class="text-sm text-stone-600 dark:text-stone-300 max-w-md font-sans">${escapeHtml(item.visual_purpose)}</p>
    <span class="mt-2 text-xs text-stone-400 font-mono">[${slotKey} — ${width}x${height} — Belum Disetujui]</span>
  </div>
  ${caption ? `<figcaption class="mt-2.5 text-center text-xs text-stone-500 dark:text-stone-400 font-sans tracking-tight">${caption} <span class="text-amber-600 font-semibold">(Draft Proposal)</span></figcaption>` : ''}
</figure>`;
    }
    return '';
  }

  const isApproved = item.editorial_approval === 'APPROVED_FOR_INLINE_PUBLICATION';
  const fixtureAttr = isPreview && !isApproved ? ' data-fixture-asset="true"' : '';

  return `<figure class="rl-media-slot my-8 max-w-full" data-media-slot="${slotKey}"${fixtureAttr}>
  <div class="relative overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800 aspect-16/9">
    <img src="${url}" alt="${alt}" width="${width}" height="${height}" loading="lazy" decoding="async" class="w-full h-full object-cover" />
  </div>
  ${caption ? `<figcaption class="mt-2.5 text-center text-xs text-stone-500 dark:text-stone-400 font-sans tracking-tight">${caption}</figcaption>` : ''}
</figure>`;
}
