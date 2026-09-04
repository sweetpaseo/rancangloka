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

  // Check for opening and closing triple dash frontmatter delimiters
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return {
      success: false,
      frontmatter: {},
      markdownBody: rawContent,
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
