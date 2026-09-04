/**
 * RancangLoka Canonical Article Pipeline & Import Service
 * Phase 1B Implementation
 *
 * Provides a unified preparation, validation, normalization, and persistence
 * pipeline shared by CLI, Admin Markdown Import, and future Hermes ingestion.
 */

import { parseArticleMarkdown } from './parser.ts';
import { validateArticle } from './validator.ts';
import { renderArticleMarkdownSafely } from './renderer.ts';
import { resolveCategory } from '../categories.ts';
import { resolveAuthor } from '../authors.ts';
import { generateContentHash, calculateReadingTime, slugifyText } from '../seo.ts';
import {
  getAllCategories,
  getAllAuthors,
  checkDuplicateArticle,
  insertArticle,
  updateArticle
} from '../db.ts';
import {
  ValidationError,
  CategoryNotFoundError,
  AuthorNotFoundError
} from '../errors.ts';

export interface NormalizedArticle {
  title: string;
  slug: string;
  description: string;
  content_md: string;
  content_html: string;
  content_hash: string;
  reading_time_minutes: number;
  category_id: number;
  category_name: string;
  category_slug: string;
  author_id: number;
  author_name: string;
  author_slug: string;
  focus_keyword: string;
  featured_image: string | null;
  image_alt: string | null;
  key_takeaways: string;
  keyTakeawaysArray: string[];
  is_featured: number;
  is_trending: number;
  is_sponsored: number;
  disable_internal_links: number;
}

export interface ImportOptions {
  strategy?: 'skip' | 'overwrite' | 'rename';
  filename?: string;
}

export interface ImportResult {
  status: 'success' | 'duplicate_skipped';
  action?: 'created' | 'overwritten';
  reason?: string;
  id?: number;
  title: string;
  slug: string;
  category?: string;
  author?: string;
}

/**
 * Normalizes an article by running it through the canonical pipeline:
 * parse -> validate -> resolve category & author -> hash -> reading time -> safe HTML.
 */
export async function normalizeArticle(rawContent: string, db: any): Promise<NormalizedArticle> {
  // 1. Validate contract (includes frontmatter parsing and safety checks)
  const validation = validateArticle(rawContent);
  if (!validation.isValid || !validation.data) {
    throw new ValidationError(
      `Validasi artikel gagal: ${validation.errors.join('; ')}`,
      validation.errors
    );
  }

  const { frontmatter, markdownBody } = validation.data;

  // 2. Resolve Category Deterministically
  const rawCategory = (frontmatter.category || frontmatter.category_id || '').toString().trim();
  const allCategories = await getAllCategories(db);
  const resolvedCat = resolveCategory(rawCategory, allCategories);

  if (!resolvedCat) {
    const available = allCategories.map((c) => `"${c.name}"`).join(', ');
    throw new CategoryNotFoundError(
      `Kategori "${rawCategory}" tidak valid. Kategori yang terdaftar: ${available}`
    );
  }

  // 3. Resolve Author Deterministically
  const rawAuthor = (frontmatter.author || frontmatter.author_id || '').toString().trim();
  const allAuthors = await getAllAuthors(db);
  const resolvedAut = resolveAuthor(rawAuthor, allAuthors);

  if (!resolvedAut) {
    const available = allAuthors.map((a) => `"${a.name}"`).join(', ');
    throw new AuthorNotFoundError(
      `Penulis "${rawAuthor}" tidak valid. Penulis yang terdaftar: ${available}`
    );
  }

  // 4. Compute Hash, Reading Time, and Render Safe HTML
  const contentHash = await generateContentHash(markdownBody);
  const readingTime = calculateReadingTime(markdownBody);
  const contentHtml = await renderArticleMarkdownSafely(markdownBody);

  // 5. Generate Slug
  const title = String(frontmatter.title).trim();
  const slug = frontmatter.slug ? slugifyText(String(frontmatter.slug)) : slugifyText(title);

  // Format key_takeaways as standard JSON string
  let takeawaysArr: string[] = [];
  if (Array.isArray(frontmatter.key_takeaways)) {
    takeawaysArr = frontmatter.key_takeaways;
  } else if (typeof frontmatter.key_takeaways === 'string') {
    try {
      takeawaysArr = JSON.parse(frontmatter.key_takeaways);
    } catch {
      takeawaysArr = [frontmatter.key_takeaways];
    }
  }

  const isFeatured = frontmatter.is_featured === 'true' || frontmatter.is_featured === '1' || frontmatter.is_featured === true ? 1 : 0;
  const isTrending = frontmatter.is_trending === 'true' || frontmatter.is_trending === '1' || frontmatter.is_trending === true ? 1 : 0;
  const isSponsored = frontmatter.is_sponsored === 'true' || frontmatter.is_sponsored === '1' || frontmatter.is_sponsored === true ? 1 : 0;
  const disableInternalLinks = frontmatter.disable_internal_links === 'true' || frontmatter.disable_internal_links === '1' || frontmatter.disable_internal_links === true || isSponsored === 1 ? 1 : 0;

  return {
    title,
    slug,
    description: String(frontmatter.description).trim(),
    content_md: markdownBody,
    content_html: contentHtml,
    content_hash: contentHash,
    reading_time_minutes: readingTime,
    category_id: resolvedCat.category.id,
    category_name: resolvedCat.category.name,
    category_slug: resolvedCat.category.slug,
    author_id: resolvedAut.author.id,
    author_name: resolvedAut.author.name,
    author_slug: resolvedAut.author.slug,
    focus_keyword: String(frontmatter.focus_keyword).trim(),
    featured_image: frontmatter.featured_image ? String(frontmatter.featured_image).trim() : null,
    image_alt: frontmatter.image_alt ? String(frontmatter.image_alt).trim() : null,
    key_takeaways: JSON.stringify(takeawaysArr),
    keyTakeawaysArray: takeawaysArr,
    is_featured: isFeatured,
    is_trending: isTrending,
    is_sponsored: isSponsored,
    disable_internal_links: disableInternalLinks
  };
}

/**
 * Shared article persistence service supporting admin strategies (skip, overwrite, rename).
 * Future Hermes machine ingestion will invoke this with strict persistence (no overwrite/rename).
 */
export async function importArticleContent(
  db: any,
  rawContent: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const strategy = options.strategy || 'skip';

  // 1. Run canonical normalization pipeline
  const normalized = await normalizeArticle(rawContent, db);

  let targetSlug = normalized.slug;
  const contentHash = normalized.content_hash;

  // 2. Duplicate detection check
  const dupCheck = await checkDuplicateArticle(db, targetSlug, contentHash);
  let isOverwrite = false;
  let targetOverwriteId: number | undefined;

  if (dupCheck.isDuplicate) {
    if (strategy === 'skip') {
      return {
        status: 'duplicate_skipped',
        reason: dupCheck.reason,
        title: normalized.title,
        slug: targetSlug,
        id: dupCheck.existingArticle?.id
      };
    } else if (strategy === 'rename') {
      targetSlug = `${targetSlug}-${Date.now().toString().slice(-4)}`;
    } else if (strategy === 'overwrite') {
      isOverwrite = true;
      targetOverwriteId = dupCheck.existingArticle?.id;
    }
  }

  // 3. Fallback default image for presentation continuity if image is not provided
  const fallbackImage = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80';
  const featuredImage = normalized.featured_image || fallbackImage;
  const imageAlt = normalized.image_alt || normalized.title;

  let persistedArticle: any;

  if (isOverwrite && targetOverwriteId) {
    // Strategy: Overwrite -> Actual SQL UPDATE on the existing row preserving original ID
    persistedArticle = await updateArticle(db, targetOverwriteId, {
      title: normalized.title,
      slug: dupCheck.existingArticle?.slug || targetSlug,
      description: normalized.description,
      content_md: normalized.content_md,
      content_html: normalized.content_html,
      featured_image: featuredImage,
      image_alt: imageAlt,
      category_id: normalized.category_id,
      author_id: normalized.author_id,
      status: 'draft',
      reading_time_minutes: normalized.reading_time_minutes,
      focus_keyword: normalized.focus_keyword,
      content_hash: normalized.content_hash,
      key_takeaways: normalized.key_takeaways,
      is_featured: normalized.is_featured,
      is_trending: normalized.is_trending,
      is_sponsored: normalized.is_sponsored,
      disable_internal_links: normalized.disable_internal_links
    });
  } else {
    // New Insert -> SQL INSERT returning actual database ID
    persistedArticle = await insertArticle(db, {
      title: normalized.title,
      slug: targetSlug,
      description: normalized.description,
      content_md: normalized.content_md,
      content_html: normalized.content_html,
      featured_image: featuredImage,
      image_alt: imageAlt,
      category_id: normalized.category_id,
      author_id: normalized.author_id,
      status: 'draft',
      reading_time_minutes: normalized.reading_time_minutes,
      focus_keyword: normalized.focus_keyword,
      content_hash: normalized.content_hash,
      key_takeaways: normalized.key_takeaways,
      is_featured: normalized.is_featured,
      is_trending: normalized.is_trending,
      is_sponsored: normalized.is_sponsored,
      disable_internal_links: normalized.disable_internal_links
    });
  }

  return {
    status: 'success',
    action: isOverwrite ? 'overwritten' : 'created',
    id: persistedArticle.id,
    title: persistedArticle.title,
    slug: persistedArticle.slug,
    category: normalized.category_name,
    author: normalized.author_name
  };
}
