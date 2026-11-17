/**
 * RancangLoka Canonical Frontmatter & Markdown Parser
 * Phase 1B Implementation
 *
 * Replaces fragmented regex-based YAML parsers with a robust, platform-neutral
 * YAML parser powered by js-yaml. Compatible with Node.js, Astro SSR, and Cloudflare Workers.
 */

import { load } from 'js-yaml';

export interface ParseResult {
  success: boolean;
  frontmatter: Record<string, any>;
  markdownBody: string;
  error?: string;
}

/**
 * Parses raw article Markdown content extracting YAML frontmatter and markdown body.
 *
 * Requirements:
 * - Requires valid opening and closing triple dash (---) delimiters.
 * - Distinguishes delimiter errors from YAML syntax errors.
 * - Correctly parses quoted strings, colons within values, and YAML-style lists.
 * - Preserves UTF-8 / Indonesian characters.
 * - Rejects malformed structures deterministically.
 */
export function parseArticleMarkdown(rawContent: string): ParseResult {
  if (!rawContent || typeof rawContent !== 'string' || !rawContent.trim()) {
    return {
      success: false,
      frontmatter: {},
      markdownBody: '',
      error: 'File artikel kosong atau tidak berisi konten'
    };
  }

  // Strip optional UTF-8 BOM
  const cleaned = rawContent.replace(/^\ufeff/, '');

  // Check for opening and closing triple dash frontmatter delimiters
  const match = cleaned.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    // Check if there is an unclosed frontmatter delimiter at start of file
    if (/^---\r?\n/.test(cleaned)) {
      // Look for boundary where editorial body begins (e.g. markdown heading # or double newline after YAML keys)
      const unclosedMatch = cleaned.match(/^---\r?\n[\s\S]*?\n(?=(?:#{1,6}\s|[A-Z0-9].*?\n\n))([\s\S]*)$/);
      const fallbackBody = unclosedMatch ? unclosedMatch[1] : cleaned.replace(/^---\r?\n[\s\S]*?(?=\n\n|$)/, '').trimStart();
      return {
        success: false,
        frontmatter: {},
        markdownBody: fallbackBody,
        error: 'Frontmatter tidak ditutup dengan triple dash (---)'
      };
    }

    return {
      success: false,
      frontmatter: {},
      markdownBody: cleaned,
      error: 'Frontmatter tidak ditemukan atau tidak diawali dan diakhiri dengan triple dash (---)'
    };
  }

  const yamlBlock = match[1];
  const markdownBody = match[2];

  try {
    const loaded = load(yamlBlock);
    if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
      return {
        success: false,
        frontmatter: {},
        markdownBody,
        error: 'Frontmatter harus berupa key-value object YAML yang valid'
      };
    }

    return {
      success: true,
      frontmatter: loaded as Record<string, any>,
      markdownBody
    };
  } catch (err: any) {
    return {
      success: false,
      frontmatter: {},
      markdownBody,
      error: `Format frontmatter YAML tidak valid: ${err.message || String(err)}`
    };
  }
}

/**
 * Returns strictly the Markdown body of an article, cleanly stripping any leading
 * YAML frontmatter block (whether valid or malformed) to guarantee metadata never
 * leaks into editorial prose.
 *
 * Invariants:
 * - Documents without frontmatter are returned as-is (with BOM stripped).
 * - Horizontal rules (---) inside article body are strictly preserved.
 * - Malformed or unclosed frontmatter blocks at the beginning of the file are stripped.
 */
export function extractArticleBody(content: string): string {
  if (!content || typeof content !== 'string') return '';
  const cleaned = content.replace(/^\ufeff/, '');

  let body = cleaned;
  // 1. Standard opening and closing triple dash frontmatter
  const match = cleaned.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  if (match) {
    body = match[1];
  } else if (/^---\r?\n/.test(cleaned)) {
    // 2. Unclosed frontmatter guard: starts with --- and metadata keys, but missing closing delimiter
    const anyClosing = cleaned.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
    if (anyClosing) {
      body = anyClosing[1];
    } else {
      // Look for boundary where editorial body begins (e.g. markdown heading # or double newline)
      const unclosedMatch = cleaned.match(/^---\r?\n[\s\S]*?\n(?=(?:#{1,6}\s|[A-Z0-9].*?\n\n))([\s\S]*)$/);
      if (unclosedMatch && unclosedMatch[1].trim()) {
        body = unclosedMatch[1];
      } else {
        body = cleaned.replace(/^---\r?\n[\s\S]*?(?=\n\n|$)/, '').trimStart();
      }
    }
  }

  // Strip leading redundant top-level H1 (e.g. # Article Title) so it never duplicates hero H1
  return body.replace(/^\s*#\s+[^\r\n]+(?:\r?\n)*/, '').trimStart();
}

