/**
 * RancangLoka Phase 1A Regression & Verification Test Suite
 * Covers all 26 Phase 1A criteria deterministically.
 */

import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { execSync } from 'child_process';

import { insertArticle, updateArticle, getArticleById, getAllCategories, checkDuplicateArticle } from '../src/lib/db.ts';
import { resolveCategory, OFFICIAL_CATEGORIES, LEGACY_CATEGORIES } from '../src/lib/categories.ts';
import { POST as importMdHandler } from '../src/pages/api/admin/import-md.ts';
import { AppError, DuplicateSlugError, DatabaseWriteError, ArticleNotFoundError } from '../src/lib/errors.ts';

// Helper to create a D1-compatible test database using node:sqlite
function createD1TestDb() {
  const sqlite = new DatabaseSync(':memory:');
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);
  const migration0001 = fs.readFileSync(path.resolve(process.cwd(), 'db/migrations/0001_category_taxonomy_expansion.sql'), 'utf-8');
  sqlite.exec(migration0001);

  return {
    raw: sqlite,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.map(v => v === undefined ? null : v);
          return this;
        },
        async run() {
          const stmt = sqlite.prepare(this._sql);
          const info = stmt.run(...this._params);
          return {
            meta: {
              last_row_id: Number(info.lastInsertRowid),
              changes: Number(info.changes)
            }
          };
        },
        async first() {
          const stmt = sqlite.prepare(this._sql);
          const row = stmt.get(...this._params);
          return row || null;
        },
        async all() {
          const stmt = sqlite.prepare(this._sql);
          const results = stmt.all(...this._params);
          return { results };
        }
      };
    }
  };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 RancangLoka Phase 1A Regression Test Suite');
  console.log('====================================================\n');

  const d1 = createD1TestDb();

  // Test 1: Successful D1 insert returns actual persisted article ID
  console.log('[1. Article Persistence & ID Generation]');
  const inserted = await insertArticle(d1, {
    title: 'Test Article 1',
    slug: 'test-article-1',
    content_md: '## Heading\nTest content body',
    content_html: '<h2>Heading</h2><p>Test content body</p>',
    category_id: 1,
    author_id: 1,
    status: 'draft'
  });
  assert(typeof inserted.id === 'number' && inserted.id > 0, `Successful D1 insert returns actual ID: ${inserted.id}`);

  // Query raw database to verify returned ID matches SQLite rowid
  const rawRow = d1.raw.prepare('SELECT id, title FROM articles WHERE id = ?').get(inserted.id);
  assert(rawRow && rawRow.id === inserted.id && rawRow.title === 'Test Article 1', `Returned article.id (${inserted.id}) matches persisted row ID (${rawRow?.id})`);

  // Test 2: D1 insert failure is surfaced
  console.log('\n[2. D1 Error Surfacing]');
  let duplicateThrew = false;
  let caughtErrorCode = '';
  try {
    // Attempt insert with the exact same slug
    await insertArticle(d1, {
      title: 'Duplicate Slug Article',
      slug: 'test-article-1', // duplicate!
      content_md: '## Heading\nAnother content',
      content_html: '<h2>Heading</h2><p>Another content</p>'
    });
  } catch (err) {
    duplicateThrew = true;
    caughtErrorCode = err?.code || '';
  }
  assert(duplicateThrew, 'D1 insert with duplicate slug threw an exception instead of swallowing');
  assert(caughtErrorCode === 'DUPLICATE_SLUG', `Surfaced typed error code DUPLICATE_SLUG (got: ${caughtErrorCode})`);

  // Test 3: Production D1 failure does NOT fall back to in-memory success
  console.log('\n[3. No In-Memory Fallback on D1 Failure]');
  // Create a broken D1 simulator that fails on insert
  const brokenD1 = {
    prepare() {
      return {
        bind() { return this; },
        async run() { throw new Error('D1 Disk Full / Connection Refused'); },
        async first() { return null; },
        async all() { return { results: [] }; }
      };
    }
  };
  let brokenD1Threw = false;
  try {
    await insertArticle(brokenD1, {
      title: 'Should Fail',
      slug: 'should-fail-slug',
      content_md: 'Content'
    });
  } catch (err) {
    brokenD1Threw = true;
  }
  assert(brokenD1Threw, 'Database failure on real DB binding threw hard error and did NOT mask as fake in-memory success');

  // Test 4: Explicit no-D1 test mode can still use mock/in-memory storage
  console.log('\n[4. Explicit In-Memory Test Mode]');
  const memArticle = await insertArticle(null, {
    title: 'Explicit In-Memory Article',
    slug: 'explicit-in-memory-slug',
    content_md: 'In-memory test body'
  });
  assert(memArticle && memArticle.id > 0, `Explicit null DB successfully used in-memory adapter (ID: ${memArticle.id})`);

  // Test 5: Duplicate slug constraint is identifiable in memory mode too
  let memDupThrew = false;
  try {
    await insertArticle(null, {
      title: 'Explicit In-Memory Duplicate',
      slug: 'explicit-in-memory-slug',
      content_md: 'In-memory duplicate'
    });
  } catch (err) {
    memDupThrew = true;
  }
  assert(memDupThrew, 'In-memory mock adapter also enforces duplicate slug constraint for test parity');

  // Test 6 & 7 & 8 & 9 & 10 & 11: Admin Import Strategies (skip, rename, overwrite)
  console.log('\n[5. Admin Import Strategies (skip, rename, overwrite)]');

  // Test 6: strategy = skip
  const formSkip = new FormData();
  formSkip.append('filename', 'article-skip.md');
  formSkip.append('strategy', 'skip');
  formSkip.append('content', `---
title: "Existing Title"
slug: "test-article-1"
category: "Interior & Tata Ruang"
author: "Dewan Redaksi Spasial RancangLoka"
description: "Test Desc"
focus_keyword: "kw"
key_takeaways:
  - "T1"
  - "T2"
  - "T3"
---
## Heading
New Content Body with more than three hundred words... ${'kata '.repeat(350)}`);

  const reqSkip = {
    request: new Request('http://localhost:4321/api/admin/import-md', { method: 'POST', body: formSkip }),
    locals: { runtime: { env: { DB: d1 } } }
  };
  const resSkip = await importMdHandler(reqSkip);
  const jsonSkip = await resSkip.json();
  assert(jsonSkip.status === 'duplicate_skipped' && jsonSkip.id === inserted.id, `strategy=skip returns duplicate_skipped with original ID: ${jsonSkip.id}`);

  // Test 7: strategy = rename
  const formRename = new FormData();
  formRename.append('filename', 'article-rename.md');
  formRename.append('strategy', 'rename');
  formRename.append('content', `---
title: "Renamed Article"
slug: "test-article-1"
category: "Interior & Tata Ruang"
author: "Dewan Redaksi Spasial RancangLoka"
description: "Test Desc"
focus_keyword: "kw"
key_takeaways:
  - "T1"
  - "T2"
  - "T3"
---
## Heading
New Content Body for renamed article... ${'kata '.repeat(350)}`);

  const reqRename = {
    request: new Request('http://localhost:4321/api/admin/import-md', { method: 'POST', body: formRename }),
    locals: { runtime: { env: { DB: d1 } } }
  };
  const resRename = await importMdHandler(reqRename);
  const jsonRename = await resRename.json();
  assert(jsonRename.status === 'success' && jsonRename.action === 'created' && jsonRename.slug !== 'test-article-1', `strategy=rename created new article with modified slug: ${jsonRename.slug}`);

  // Test 8, 9, 10: strategy = overwrite performs UPDATE, preserves ID, changes content
  const formOverwrite = new FormData();
  formOverwrite.append('filename', 'article-overwrite.md');
  formOverwrite.append('strategy', 'overwrite');
  formOverwrite.append('content', `---
title: "Updated Overwritten Title"
slug: "test-article-1"
category: "Interior & Tata Ruang"
author: "Dewan Redaksi Spasial RancangLoka"
description: "Updated Meta Description"
focus_keyword: "kw-updated"
key_takeaways:
  - "T1 Updated"
  - "T2 Updated"
  - "T3 Updated"
---
## Updated Heading
Brand new overwritten markdown body text here... ${'kata '.repeat(350)}`);

  const reqOverwrite = {
    request: new Request('http://localhost:4321/api/admin/import-md', { method: 'POST', body: formOverwrite }),
    locals: { runtime: { env: { DB: d1 } } }
  };
  const resOverwrite = await importMdHandler(reqOverwrite);
  const jsonOverwrite = await resOverwrite.json();

  assert(jsonOverwrite.status === 'success' && jsonOverwrite.action === 'overwritten', 'strategy=overwrite returned success with action: overwritten');
  assert(jsonOverwrite.id === inserted.id, `strategy=overwrite preserved original article ID: ${jsonOverwrite.id} === ${inserted.id}`);

  // Verify in D1 that content was actually updated
  const updatedInDb = await getArticleById(d1, inserted.id);
  assert(updatedInDb?.title === 'Updated Overwritten Title', `Database row title was updated: "${updatedInDb?.title}"`);
  assert(updatedInDb?.content_md.includes('Brand new overwritten markdown'), 'Database row content_md was updated');

  // Test 11: overwrite database failure is surfaced
  let brokenOverwriteThrew = false;
  try {
    await updateArticle(brokenD1, inserted.id, { title: 'Fails' });
  } catch (err) {
    brokenOverwriteThrew = true;
  }
  assert(brokenOverwriteThrew, 'updateArticle database failure surfaces to caller without being swallowed');

  // Test 12, 13, 14: Category Taxonomy & Deterministic Aliasing
  console.log('\n[6. Category Taxonomy & Aliasing]');
  const allDbCats = await getAllCategories(d1);

  // Test 12: "Desain Interior & Estetika" resolves successfully
  const resLegacyName = resolveCategory('Desain Interior & Estetika', allDbCats);
  assert(resLegacyName !== null && resLegacyName.category.id === 1, `Legacy name "Desain Interior & Estetika" resolved to Category ID 1`);

  // Test 13: "Interior & Tata Ruang" resolves to the exact same category ID
  const resNewName = resolveCategory('Interior & Tata Ruang', allDbCats);
  assert(resNewName !== null && resNewName.category.id === 1, `New name "Interior & Tata Ruang" resolved to Category ID 1`);
  assert(resLegacyName?.category.id === resNewName?.category.id, `"Desain Interior & Estetika" and "Interior & Tata Ruang" resolve to the exact same ID (1)`);

  // Test 14: "Arsitektur & Renovasi" behavior remains unchanged
  const resArsi = resolveCategory('Arsitektur & Renovasi', allDbCats);
  assert(resArsi !== null && resArsi.category.id === 3 && resArsi.category.slug === 'arsitektur-renovasi', 'Arsitektur & Renovasi resolves unchanged to ID 3');

  // Test 15, 16, 17, 18: New Official Categories Migration & Seeding
  console.log('\n[7. New Official Categories Verification]');
  const catMat = allDbCats.find(c => c.slug === 'material-finishing');
  const catKenyamanan = allDbCats.find(c => c.slug === 'kenyamanan-rumah');
  const catEksterior = allDbCats.find(c => c.slug === 'eksterior-lanskap');
  const catSistem = allDbCats.find(c => c.slug === 'sistem-konstruksi-rumah');

  assert(catMat && catMat.id === 5 && catMat.name === 'Material & Finishing', 'Material & Finishing migrated deterministically (ID 5, material-finishing)');
  assert(catKenyamanan && catKenyamanan.id === 6 && catKenyamanan.name === 'Kenyamanan Rumah', 'Kenyamanan Rumah migrated deterministically (ID 6, kenyamanan-rumah)');
  assert(catEksterior && catEksterior.id === 7 && catEksterior.name === 'Eksterior & Lanskap', 'Eksterior & Lanskap migrated deterministically (ID 7, eksterior-lanskap)');
  assert(catSistem && catSistem.id === 8 && catSistem.name === 'Sistem & Konstruksi Rumah', 'Sistem & Konstruksi Rumah migrated deterministically (ID 8, sistem-konstruksi-rumah)');

  // Test 19 & 20: Legacy Categories preserved
  console.log('\n[8. Legacy Categories Preserved]');
  const catSmart = allDbCats.find(c => c.slug === 'smart-home');
  const catLife = allDbCats.find(c => c.slug === 'lifestyle-hunian');
  assert(catSmart && catSmart.id === 2, 'Smart Home & Otomasi preserved at ID 2');
  assert(catLife && catLife.id === 4, 'Gaya Hidup & Hunian preserved at ID 4');

  // Test 21 & 22: Slug & URL compatibility
  const catInterior = allDbCats.find(c => c.id === 1);
  assert(catInterior?.slug === 'interior-design', 'Category ID 1 retains slug "interior-design" ensuring 100% URL continuity');
  assert(catInterior?.name === 'Interior & Tata Ruang', 'Category ID 1 display name updated to "Interior & Tata Ruang"');

  // Test 23: Existing CLI article import test suite still works
  console.log('\n[9. Existing CLI & Pipeline Regression]');
  try {
    const cliOutput = execSync('node scripts/test-handoff-cli.js', { encoding: 'utf-8' });
    assert(cliOutput.includes('ALL TESTS PASSED') || cliOutput.includes('Positive test passed'), 'Existing test-handoff-cli.js runs and passes');
  } catch (err) {
    assert(false, `test-handoff-cli.js failed: ${err.message}`);
  }

  // Test 24: Existing validator tests still work
  try {
    const valOutput = execSync('node scripts/test-validator.js', { encoding: 'utf-8' });
    assert(valOutput.includes('Testing Deterministic Article Validator'), 'Existing test-validator.js runs and passes');
  } catch (err) {
    assert(false, `test-validator.js failed: ${err.message}`);
  }

  // Test 25: Article IDs are not renumbered
  console.log('\n[10. Article ID Integrity]');
  const idSeqTest = d1.raw.prepare('SELECT id FROM articles ORDER BY id').all();
  const ids = idSeqTest.map(r => r.id);
  assert(ids.includes(inserted.id), `Original article ID ${inserted.id} remains constant and intact`);

  console.log('\n====================================================');
  console.log(`📊 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
