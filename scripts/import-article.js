/**
 * RancangLoka Production Handoff CLI
 * Phase 1.5 — Single-Command Handoff Bridge for Hermes
 *
 * Workflow:
 *   Markdown file -> deterministic validator -> import-md pipeline -> D1 (as draft)
 *
 * Usage:
 *   node scripts/import-article.js <path-to-article.md> [--strategy=skip|overwrite|rename]
 */

import fs from 'fs';
import path from 'path';
import { validateArticleFile } from './validate-article.js';
import { POST as importMdHandler } from '../src/pages/api/admin/import-md.ts';

async function main() {
  const args = process.argv.slice(2);
  const filePathArg = args.find(a => !a.startsWith('--'));
  const strategyArg = args.find(a => a.startsWith('--strategy='));
  const strategy = strategyArg ? strategyArg.split('=')[1] : 'skip'; // default: skip duplicate

  // A. Argument check
  if (!filePathArg) {
    console.error('VALIDATION: FAIL');
    console.error('Reason: Path file markdown wajib disertakan.');
    console.error('Penggunaan: node scripts/import-article.js <path-to-article.md> [--strategy=skip|overwrite|rename]');
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), filePathArg);

  if (!fs.existsSync(resolvedPath)) {
    console.error('VALIDATION: FAIL');
    console.error(`Reason: File tidak ditemukan di path: ${filePathArg}`);
    process.exit(1);
  }

  // B. Run deterministic validator first
  const valResult = validateArticleFile(resolvedPath);

  // C. Stop immediately if validation fails
  if (!valResult.isValid) {
    console.error('VALIDATION: FAIL');
    console.error('Reason:');
    valResult.errors.forEach((err, idx) => {
      console.error(`  ${idx + 1}. ${err}`);
    });
    process.exit(1);
  }

  // D. If validation passes, invoke existing Markdown import pipeline
  const filename = path.basename(resolvedPath);
  const rawContent = fs.readFileSync(resolvedPath, 'utf-8');

  try {
    const formData = new FormData();
    formData.append('filename', filename);
    formData.append('content', rawContent);
    formData.append('strategy', strategy);

    const apiRequest = {
      request: new Request('http://localhost:4321/api/admin/import-md', {
        method: 'POST',
        body: formData
      }),
      locals: {}
    };

    const response = await importMdHandler(apiRequest);
    const result = await response.json();

    if (response.status !== 200 || (result.status !== 'success' && result.status !== 'duplicate_skipped')) {
      console.log('VALIDATION: PASS');
      console.error('IMPORT: FAIL');
      console.error(`Reason: ${result.error || result.reason || 'Terjadi kesalahan saat memproses impor.'}`);
      process.exit(1);
    }

    if (result.status === 'duplicate_skipped') {
      console.log('VALIDATION: PASS');
      console.log('IMPORT: DUPLICATE_SKIPPED');
      console.log(`TITLE: ${result.title}`);
      console.log(`SLUG: ${result.slug}`);
      console.log(`STATUS: draft`);
      console.log(`NOTE: Artikel dilewati karena sudah ada di database (${result.reason}). Gunakan --strategy=overwrite jika ingin memperbarui.`);
      process.exit(0);
    }

    // E. Print concise structured result
    console.log('VALIDATION: PASS');
    console.log('IMPORT: PASS');
    console.log(`TITLE: ${result.title}`);
    console.log(`SLUG: ${result.slug}`);
    console.log(`CATEGORY: ${result.category}`);
    console.log(`AUTHOR: ${result.author}`);
    console.log('STATUS: draft');
    console.log(`ARTICLE_ID: ${result.id}`);
    process.exit(0);
  } catch (err) {
    console.log('VALIDATION: PASS');
    console.error('IMPORT: FAIL');
    console.error(`Reason: ${err.message || 'Terjadi error tidak terduga pada server import.'}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('FATAL ERROR:', err.message);
  process.exit(1);
});
