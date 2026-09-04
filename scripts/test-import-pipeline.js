/**
 * Phase 1 Integration Test:
 * sample Markdown -> validator -> existing import pipeline -> D1 draft -> article route check
 */

import fs from 'fs';
import path from 'path';
import { validateArticleFile } from './validate-article.js';
import { POST as importMdHandler } from '../src/pages/api/admin/import-md.ts';
import { getDb, getArticleBySlug, getAllCategories, getAllAuthors } from '../src/lib/db.ts';

async function runIntegrationTest() {
  console.log('=== Step 1: Validating Sample Markdown with Deterministic Validator ===');
  const samplePath = path.resolve(process.cwd(), 'samples/safe-sample-article.md');
  const valResult = validateArticleFile(samplePath);

  if (!valResult.isValid) {
    console.error('❌ Validator rejected sample article:', valResult.errors);
    process.exit(1);
  }
  console.log('✅ Validator passed successfully for sample article.');

  console.log('\n=== Step 2: Testing Deterministic Category & Author Resolvers in import-md ===');
  const rawContent = fs.readFileSync(samplePath, 'utf-8');

  // Helper to create Astro-like API request
  function createRequest(content, filename = 'safe-sample-article.md', strategy = 'overwrite') {
    const formData = new FormData();
    formData.append('filename', filename);
    formData.append('content', content);
    formData.append('strategy', strategy);

    return {
      request: new Request('http://localhost:4321/api/admin/import-md', {
        method: 'POST',
        body: formData
      }),
      locals: {}
    };
  }

  // 2A: Valid Import Test
  const validReq = createRequest(rawContent);
  const res = await importMdHandler(validReq);
  const resJson = await res.json();

  console.log('Import HTTP Status:', res.status);
  console.log('Import Response:', resJson);

  if (res.status !== 200 || resJson.status !== 'success') {
    console.error('❌ Import failed for valid sample:', resJson);
    process.exit(1);
  }
  console.log(`✅ Success: Imported "${resJson.title}" as slug "${resJson.slug}".`);
  console.log(`  • Resolved Category: ${resJson.category}`);
  console.log(`  • Resolved Author: ${resJson.author}`);

  // 2B: Negative Test: Unknown Category
  console.log('\nTesting Negative Case: Unknown Category...');
  const unknownCatContent = rawContent.replace('category: "Arsitektur & Renovasi"', 'category: "Kategori Fiktif Asal"');
  const catReq = createRequest(unknownCatContent, 'bad-cat.md');
  const catRes = await importMdHandler(catReq);
  const catJson = await catRes.json();
  console.log('Bad Category Status:', catRes.status, '| Error message:', catJson.error);
  if (catRes.status !== 400 || !catJson.error.includes('Kategori Fiktif Asal')) {
    console.error('❌ Expected 400 for unknown category, got:', catRes.status);
    process.exit(1);
  }
  console.log('✅ Unknown category correctly failed with 400.');

  // 2C: Negative Test: Unknown Author
  console.log('\nTesting Negative Case: Unknown Author...');
  const unknownAuthorContent = rawContent.replace('author: "RancangLoka Editorial Desk"', 'author: "Penulis Tak Dikenal"');
  const authorReq = createRequest(unknownAuthorContent, 'bad-author.md');
  const authorRes = await importMdHandler(authorReq);
  const authorJson = await authorRes.json();
  console.log('Bad Author Status:', authorRes.status, '| Error message:', authorJson.error);
  if (authorRes.status !== 400 || !authorJson.error.includes('Penulis Tak Dikenal')) {
    console.error('❌ Expected 400 for unknown author, got:', authorRes.status);
    process.exit(1);
  }
  console.log('✅ Unknown author correctly failed with 400.');

  // Step 3: Verify Article Retrieval as Draft in DB
  console.log('\n=== Step 3: Verifying Article Query for [slug].astro Route ===');
  const db = await getDb({});
  const queriedArticle = await getArticleBySlug(db, resJson.slug);

  if (!queriedArticle) {
    console.error('❌ Could not query inserted article by slug:', resJson.slug);
    process.exit(1);
  }

  console.log('Queried Article from DB:');
  console.log(`  • ID: ${queriedArticle.id}`);
  console.log(`  • Title: ${queriedArticle.title}`);
  console.log(`  • Status: ${queriedArticle.status} (Confirmed DRAFT)`);
  console.log(`  • Category ID: ${queriedArticle.category_id}`);
  console.log(`  • Author ID: ${queriedArticle.author_id}`);
  console.log(`  • Key Takeaways parsed: ${JSON.parse(queriedArticle.key_takeaways || '[]').length} items`);
  console.log(`  • HTML content generated: ${queriedArticle.content_html.length} chars`);

  if (queriedArticle.status !== 'draft') {
    console.error('❌ Article status must be "draft", got:', queriedArticle.status);
    process.exit(1);
  }

  console.log('\n🎉 ALL INTEGRATION HANDOFF TESTS PASSED SUCCESSFULLY!');
}

runIntegrationTest().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
