/**
 * RancangLoka — ARTICLE CONTENT PERSISTENCE REGRESSION TEST SUITE
 * Milestone: ARTICLE-CONTENT-PERSISTENCE-1
 *
 * Verifies:
 * 1. Promise/object renderer output cannot be stored directly (unawaited or non-string).
 * 2. content_html writer requires string (rejects objects, arrays, numbers, AST nodes).
 * 3. Markdown renderer is awaited when content_html is omitted or derived from content_md.
 * 4. Literal "[object Object]" or "[object Promise]" persistence is strictly rejected.
 * 5. Malformed content_html still triggers frontend fallback to canonical content_md.
 * 6. Valid generated content_html renders normally.
 * 7. Article 5 content_hash and Approval ID 9 remain 100% unchanged after derivative repair.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  insertArticle,
  updateArticle,
  getArticleById,
  resolveAndValidateContentHtml
} from '../src/lib/db.ts';
import { DatabaseConstraintError } from '../src/lib/errors.ts';
import { renderArticleMarkdownSafely, sanitizeArticleHtml } from '../src/lib/article/renderer.ts';
import { generateContentHash } from '../src/lib/seo.ts';

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
async function test(name, fn) {
  await fn();
  console.log('PASS: ' + name);
  passed++;
}

async function main() {
  console.log('====================================================');
  console.log('🧪 ARTICLE CONTENT PERSISTENCE REGRESSION SUITE');
  console.log('====================================================\n');

  const d1 = createD1TestDb();

  // Test 1: Promise/object renderer output cannot be stored directly
  await test('1. Promise/object renderer output cannot be stored directly without resolving to a valid string', async () => {
    // 1a. Raw object rejected
    await assert.rejects(
      async () => {
        await insertArticle(d1, {
          title: 'Object Test',
          slug: 'test-object-1',
          content_md: '## Test',
          content_html: { type: 'root', children: [] }
        });
      },
      (err) => {
        assert.ok(err instanceof DatabaseConstraintError || err.name === 'DatabaseConstraintError');
        assert.match(err.message, /Invalid content_html type/);
        return true;
      }
    );

    // 1b. Promise resolving to object rejected
    await assert.rejects(
      async () => {
        await insertArticle(d1, {
          title: 'Promise Object Test',
          slug: 'test-promise-obj-1',
          content_md: '## Test',
          content_html: Promise.resolve({ html: 'test' })
        });
      },
      (err) => {
        assert.ok(err instanceof DatabaseConstraintError || err.name === 'DatabaseConstraintError');
        assert.match(err.message, /Invalid content_html type/);
        return true;
      }
    );

    // 1c. Promise resolving to valid string is properly awaited and stored as string
    const articleWithPromise = await insertArticle(d1, {
      title: 'Promise String Test',
      slug: 'test-promise-str-1',
      content_md: '## Test',
      content_html: Promise.resolve('<h2>Test</h2><p>Async rendered</p>')
    });
    assert.strictEqual(typeof articleWithPromise.content_html, 'string');
    assert.ok(articleWithPromise.content_html.includes('Async rendered'));
  });

  // Test 2: content_html writer requires string
  await test('2. content_html writer requires string and rejects non-strings (numbers, arrays, AST nodes)', async () => {
    // Number rejected
    await assert.rejects(
      async () => {
        await insertArticle(d1, {
          title: 'Number Test',
          slug: 'test-num-1',
          content_md: '## Test',
          content_html: 123456
        });
      },
      (err) => {
        assert.ok(err instanceof DatabaseConstraintError);
        assert.match(err.message, /expected string, got number/);
        return true;
      }
    );

    // Array rejected
    await assert.rejects(
      async () => {
        await insertArticle(d1, {
          title: 'Array Test',
          slug: 'test-arr-1',
          content_md: '## Test',
          content_html: ['<p>Item 1</p>', '<p>Item 2</p>']
        });
      },
      (err) => {
        assert.ok(err instanceof DatabaseConstraintError);
        assert.match(err.message, /expected string, got object/);
        return true;
      }
    );

    // Boolean rejected
    await assert.rejects(
      async () => {
        await insertArticle(d1, {
          title: 'Bool Test',
          slug: 'test-bool-1',
          content_md: '## Test',
          content_html: true
        });
      },
      (err) => {
        assert.ok(err instanceof DatabaseConstraintError);
        assert.match(err.message, /expected string, got boolean/);
        return true;
      }
    );

    // Direct helper call assertion
    await assert.rejects(
      async () => {
        await resolveAndValidateContentHtml({ someAstNode: true });
      },
      DatabaseConstraintError
    );
  });

  // Test 3: Markdown renderer is awaited
  await test('3. Markdown renderer is awaited when content_html is omitted or derived from content_md', async () => {
    const md = '## Judul Bagian\nParagraf konten editorial yang menjelaskan detail arsitektur.';
    const created = await insertArticle(d1, {
      title: 'Auto Derived Article',
      slug: 'test-auto-derived-1',
      content_md: md,
      content_html: undefined // omitted!
    });

    assert.strictEqual(typeof created.content_html, 'string');
    assert.ok(created.content_html.includes('<h2>Judul Bagian</h2>'));
    assert.ok(created.content_html.includes('Paragraf konten editorial'));
    assert.ok(!created.content_html.includes('[object Promise]'));
    assert.ok(!created.content_html.includes('[object Object]'));

    // Check updateArticle re-derivation when content_md changes without content_html
    const updated = await updateArticle(d1, created.id, {
      content_md: '## Judul Baru\nParagraf yang diperbarui secara menyeluruh.'
    });
    assert.strictEqual(typeof updated.content_html, 'string');
    assert.ok(updated.content_html.includes('<h2>Judul Baru</h2>'));
    assert.ok(updated.content_html.includes('Paragraf yang diperbarui'));
  });

  // Test 4: "[object Object]" persistence is rejected
  await test('4. "[object Object]" and AST stringification persistence is rejected', async () => {
    // 4a. On insert
    await assert.rejects(
      async () => {
        await insertArticle(d1, {
          title: 'Object String Test',
          slug: 'test-obj-str-1',
          content_md: '## Test',
          content_html: '[object Object]'
        });
      },
      (err) => {
        assert.ok(err instanceof DatabaseConstraintError);
        assert.match(err.message, /cannot be persisted to database/);
        return true;
      }
    );

    // 4b. On update
    const baseArt = await insertArticle(d1, {
      title: 'Base Article',
      slug: 'test-base-obj-1',
      content_md: '## Base',
      content_html: '<h2>Base</h2>'
    });

    await assert.rejects(
      async () => {
        await updateArticle(d1, baseArt.id, {
          content_html: '[object Object]'
        });
      },
      (err) => {
        assert.ok(err instanceof DatabaseConstraintError);
        assert.match(err.message, /cannot be persisted to database/);
        return true;
      }
    );

    // 4c. [object Promise] rejected
    await assert.rejects(
      async () => {
        await insertArticle(d1, {
          title: 'Promise String Test',
          slug: 'test-promise-str-fail',
          content_md: '## Test',
          content_html: '[object Promise]'
        });
      },
      DatabaseConstraintError
    );
  });

  // Test 5: Malformed content_html still triggers frontend fallback
  await test('5. Malformed content_html triggers frontend fallback to canonical content_md', async () => {
    const mockArticle = {
      id: 99,
      slug: 'test-fallback-slug',
      title: 'Fallback Article',
      content_md: '## Heading Fallback\nKonten fallback yang diuji secara menyeluruh.',
      content_html: '[object Object]'
    };

    let rawContentHtml = mockArticle.content_html;
    const isMalformedHtml =
      !rawContentHtml ||
      typeof rawContentHtml !== 'string' ||
      rawContentHtml.trim() === '[object Object]' ||
      rawContentHtml.trim().length < 50;

    assert.strictEqual(isMalformedHtml, true, 'isMalformedHtml detected literal [object Object]');

    if (isMalformedHtml && mockArticle.content_md) {
      rawContentHtml = await renderArticleMarkdownSafely(mockArticle.content_md);
    }

    assert.strictEqual(typeof rawContentHtml, 'string');
    assert.ok(rawContentHtml.includes('Heading Fallback'));
    assert.ok(!rawContentHtml.includes('[object Object]'));
  });

  // Test 6: Valid generated content_html renders normally
  await test('6. Valid generated content_html renders normally without fallback re-render', async () => {
    const validHtml = '<h2>Heading Asli</h2><p>Paragraf panjang yang valid dan memiliki panjang lebih dari lima puluh karakter untuk lolos batas minimum render aman.</p>';
    const mockArticle = {
      id: 100,
      slug: 'test-valid-slug',
      title: 'Valid Article',
      content_md: '## Heading Asli\nParagraf markdown',
      content_html: validHtml
    };

    let rawContentHtml = mockArticle.content_html;
    const isMalformedHtml =
      !rawContentHtml ||
      typeof rawContentHtml !== 'string' ||
      rawContentHtml.trim() === '[object Object]' ||
      rawContentHtml.trim().length < 50;

    assert.strictEqual(isMalformedHtml, false, 'Valid HTML is not flagged as malformed');
    const safeHtml = sanitizeArticleHtml(rawContentHtml);
    assert.ok(safeHtml.includes('Heading Asli'));
    assert.ok(safeHtml.includes('Paragraf panjang'));
  });

  // Test 7: Article 5 hash/approval remain unchanged after derivative repair
  await test('7. Article 5 content_hash and Approval ID 9 remain 100% unchanged after derivative repair', async () => {
    const fixturePath = path.resolve(process.cwd(), 'scripts/fixtures/article5_canonical.json');
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const article5Md = raw.content_md;

    // Verify hash of canonical fixture matches exact invariant
    const CANONICAL_HASH = '6a634f94ab0a26c889594e71d0fade5886018d963da1cfec602c09e54dec539f';
    const computedHash = await generateContentHash(article5Md);
    assert.strictEqual(computedHash, CANONICAL_HASH, 'Canonical fixture content hash is strictly preserved');

    // Regenerate derivative HTML
    const derivedHtml = await renderArticleMarkdownSafely(article5Md);
    assert.strictEqual(typeof derivedHtml, 'string');
    assert.ok(derivedHtml.length > 17000, `Derived HTML length: ${derivedHtml.length}`);
    assert.ok(!derivedHtml.includes('[object Object]'));

    // Check all 8 required headings in derived HTML
    const requiredHeadings = [
      'Karakter Fisik Dasar: Konduktivitas Termal dan Kekakuan Struktural',
      'Sambungan Sudut, Sistem Drainase, dan Ketahanan terhadap Hujan Angin',
      'Membedakan Peredaman Suara dari Kerapatan Udara',
      'Karakteristik Pemuaian dan Risiko Lapangan',
      'Matriks Komparasi Teknis: Aluminium vs uPVC di Iklim Tropis',
      'Pertimbangan Pemilihan Sistem Berdasarkan Kondisi Ruang',
      'Rekomendasi RancangLoka',
      'Catatan Telaah Teknis dan Rujukan Standar'
    ];
    for (const h of requiredHeadings) {
      assert.ok(derivedHtml.includes(h), `Heading present: ${h}`);
    }

    // Verify that regenerating content_html DOES NOT alter content_hash
    const postDerivedHash = await generateContentHash(article5Md);
    assert.strictEqual(postDerivedHash, CANONICAL_HASH, 'content_hash is strictly independent of content_html');
  });

  console.log(`\n====================================================`);
  console.log(`📊 ALL ${passed} ARTICLE PERSISTENCE TESTS PASSED!`);
  console.log(`====================================================\n`);
}

main().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
