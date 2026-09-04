/**
 * RancangLoka Deterministic Article Validator
 * Phase 1B Implementation
 *
 * Thin CLI adapter delegating contract parsing and validation to the canonical
 * shared validator module (src/lib/article/validator.ts).
 *
 * Usage:
 *   node scripts/validate-article.js <path-to-article.md>
 */

import fs from 'fs';
import path from 'path';
import {
  validateArticle as canonicalValidateArticle,
  BANNED_PLACEHOLDERS,
  WORD_COUNT_MIN,
  WORD_COUNT_MAX
} from '../src/lib/article/validator.ts';
import { parseArticleMarkdown } from '../src/lib/article/parser.ts';

export { BANNED_PLACEHOLDERS, WORD_COUNT_MIN, WORD_COUNT_MAX };

/**
 * Backward-compatible frontmatter parser wrapper delegating to canonical parser.
 */
export function parseFrontmatter(rawContent) {
  const result = parseArticleMarkdown(rawContent);
  if (!result.success) {
    return { error: result.error };
  }
  return {
    frontmatter: result.frontmatter,
    markdownBody: result.markdownBody
  };
}

/**
 * Validates article content using canonical production contract rules.
 */
export function validateArticle(rawContent) {
  return canonicalValidateArticle(rawContent);
}

/**
 * Validates a Markdown file by path.
 */
export function validateArticleFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { isValid: false, errors: [`File tidak ditemukan: ${filePath}`] };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return validateArticle(content);
}

// CLI Execution Support
const isCLI = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

if (isCLI || (process.argv[1] && process.argv[1].endsWith('validate-article.js'))) {
  const targetFile = process.argv[2];
  if (!targetFile) {
    console.error('❌ Harap berikan path ke file markdown.');
    console.error('Contoh: node scripts/validate-article.js samples/sample.md');
    process.exit(1);
  }

  const result = validateArticleFile(path.resolve(process.cwd(), targetFile));
  if (!result.isValid) {
    console.error(`\n❌ Validasi GAGAL untuk: ${targetFile}`);
    result.errors.forEach((err, idx) => console.error(`  ${idx + 1}. ${err}`));
    console.error('');
    process.exit(1);
  } else {
    console.log(`\n✅ Validasi BERHASIL untuk: ${targetFile}`);
    console.log(`  • Judul: "${result.data.frontmatter.title}"`);
    console.log(`  • Kategori: ${result.data.frontmatter.category}`);
    console.log(`  • Penulis: ${result.data.frontmatter.author}`);
    console.log(`  • Kata Kunci: ${result.data.frontmatter.focus_keyword}`);
    console.log(`  • Jumlah Kata: ${result.data.wordCount} kata`);
    console.log(`  • Key Takeaways: ${Array.isArray(result.data.frontmatter.key_takeaways) ? result.data.frontmatter.key_takeaways.length : 0} butir\n`);
    process.exit(0);
  }
}
