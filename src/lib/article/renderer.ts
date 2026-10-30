/**
 * RancangLoka Canonical Safe Markdown Renderer
 * Phase 1B Implementation
 *
 * Implements an allowlist-based HTML sanitizer using 'xss' to prevent Stored XSS
 * while preserving legitimate editorial Markdown formatting (headings, lists,
 * blockquotes, tables, links, images, etc.).
 *
 * Fully compatible with Node.js CLI, Astro SSR, and Cloudflare Workers.
 */

import { marked } from 'marked';
import xss from 'xss';
import { enhanceComparisonMatrices } from './comparison-matrix.ts';
import { stripFaqCommentMarkers } from '../editorial/faq.ts';
import { extractArticleBody } from './parser.ts';

const safeAttrValue = (xss as any).safeAttrValue;


/**
 * Strict allowlist of HTML tags and allowed attributes for RancangLoka articles.
 */
const ARTICLE_HTML_WHITELIST: Record<string, string[]> = {
  p: ['class'],
  h1: ['id', 'class'],
  h2: ['id', 'class'],
  h3: ['id', 'class'],
  h4: ['id', 'class'],
  h5: ['id', 'class'],
  h6: ['id', 'class'],
  strong: ['class'],
  b: ['class'],
  em: ['class'],
  i: ['class'],
  u: ['class'],
  s: ['class'],
  del: ['class'],
  strike: ['class'],
  ul: ['class'],
  ol: ['start', 'class'],
  li: ['class'],
  blockquote: ['class'],
  pre: ['class'],
  code: ['class'],
  a: ['href', 'title', 'target', 'rel', 'class', 'id'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding', 'class'],
  figure: ['class', 'id', 'data-media-slot'],
  figcaption: ['class'],
  table: ['class', 'role'],
  thead: ['class'],
  tbody: ['class'],
  tr: ['class'],
  th: ['align', 'class', 'scope'],
  td: ['align', 'class'],
  hr: ['class'],
  br: [],
  div: ['class', 'id', 'data-comparison-matrix'],
  span: ['class', 'id']
};

/**
 * Safe URL validation for href and src attributes.
 * Neutralizes javascript:, vbscript:, data:text/html, and obfuscated variations.
 */
function filterSafeUrl(value: string): string {
  if (!value) return '';

  // Remove control characters and whitespace inside URL
  const cleaned = value.replace(/[\u0000-\u001F\u007F-\u009F\s]+/g, '').trim();
  const lower = cleaned.toLowerCase();

  // Explicitly block dangerous protocols
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.includes('javascript:') ||
    lower.startsWith('data:text/html') ||
    lower.startsWith('data:application/javascript')
  ) {
    return '';
  }

  // Allow standard web protocols, relative URLs, mailto, and telephone
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('/') ||
    lower.startsWith('#') ||
    lower.startsWith('./') ||
    lower.startsWith('../') ||
    lower.startsWith('data:image/')
  ) {
    return value;
  }

  // Reject unrecognized protocols as unsafe
  if (lower.includes(':')) {
    return '';
  }

  return value;
}

/**
 * Detects and strips any accidentally rendered or cached frontmatter metadata blocks
 * from HTML. Designed as an anti-leak defense-in-depth gate.
 *
 * Invariants:
 * - Must NOT remove words like 'title', 'category', 'author' from ordinary article prose.
 * - Only strips blocks that exhibit structured frontmatter key-value bundles.
 */
export function stripLeakedMetadataHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  // Pattern 1: Setext or ATX heading frontmatter leak: <hr>\s*<h[1-6]>title: ... slug: ... </h[1-6]>
  const headingLeakRegex = /(?:<hr\s*\/?>\s*)?<h[1-6][^>]*>\s*(?:&quot;|")?title:[\s\S]*?(?:slug:|description:|category:|author:|focus_keyword:|key_takeaways:|seo_title:|meta_description:)[\s\S]*?<\/h[1-6]>\s*(?:<hr\s*\/?>)?/gi;
  let cleaned = html.replace(headingLeakRegex, '');

  // Pattern 2: Paragraph, blockquote, div, or pre frontmatter leak
  const containerLeakRegex = /(?:<hr\s*\/?>\s*)?<(?:p|blockquote|div|pre)[^>]*>\s*(?:&quot;|")?title:[\s\S]*?(?:slug:|description:|category:|author:|focus_keyword:|key_takeaways:|seo_title:|meta_description:)[\s\S]*?<\/(?:p|blockquote|div|pre)>\s*(?:<hr\s*\/?>)?/gi;
  cleaned = cleaned.replace(containerLeakRegex, '');

  return cleaned;
}

/**
 * Sanitizes an HTML string against the strict article allowlist.
 * Can be used on both newly rendered Markdown and legacy content_html from the database.
 */
export function sanitizeArticleHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  const cleanHtml = stripFaqCommentMarkers(rawHtml);
  const withoutLeakedMeta = stripLeakedMetadataHtml(cleanHtml);
  return xss(withoutLeakedMeta, {
    whiteList: ARTICLE_HTML_WHITELIST,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'svg'],
    safeAttrValue: (tag, name, value, cssFilter) => {
      if (name === 'href' || name === 'src') {
        const safeUrl = filterSafeUrl(value);
        if (!safeUrl) return '';
        return safeAttrValue(tag, name, safeUrl, cssFilter);
      }
      return safeAttrValue(tag, name, value, cssFilter);
    }
  });
}

/**
 * Parses Markdown into safe, sanitized HTML with responsive comparison matrix presentation.
 * Cleanly separates and excludes frontmatter so raw metadata NEVER renders as visible prose.
 */
export async function renderArticleMarkdownSafely(markdownInput: string): Promise<string> {
  if (!markdownInput || typeof markdownInput !== 'string') return '';

  // 1. Cleanly separate frontmatter from markdown body to guarantee metadata never leaks
  const cleanBody = extractArticleBody(markdownInput);

  // 2. Strip recognized FAQ metadata blocks before Markdown conversion to HTML
  const cleanMarkdown = stripFaqCommentMarkers(cleanBody);
  const parsedHtml = await marked.parse(cleanMarkdown);
  const enhancedHtml = enhanceComparisonMatrices(parsedHtml);
  return sanitizeArticleHtml(enhancedHtml);
}

