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
  img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'class'],
  table: ['class'],
  thead: ['class'],
  tbody: ['class'],
  tr: ['class'],
  th: ['align', 'class'],
  td: ['align', 'class'],
  hr: ['class'],
  br: [],
  div: ['class', 'id'],
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
 * Sanitizes an HTML string against the strict article allowlist.
 * Can be used on both newly rendered Markdown and legacy content_html from the database.
 */
export function sanitizeArticleHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  return xss(rawHtml, {
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
 * Parses Markdown into safe, sanitized HTML.
 */
export async function renderArticleMarkdownSafely(markdownBody: string): Promise<string> {
  if (!markdownBody || typeof markdownBody !== 'string') return '';

  const parsedHtml = await marked.parse(markdownBody);
  return sanitizeArticleHtml(parsedHtml);
}
