/**
 * Phase 2B2B-4B3A-R2: Migration 0004 & Real-SQLite Schema Migration Test
 * 
 * Verifies:
 * A. Construct exact pre-0004 production schema in real SQLite.
 * B. Existing rows preserve IDs and data.
 * C. Migration 0004 applies cleanly.
 * D. Both new columns (is_sponsored, disable_internal_links) exist with default 0.
 * E. Existing rows receive effective default 0 for both columns.
 * F. Hermes article INSERT using actual SQL succeeds.
 * G. Receipt INSERT using last_insert_rowid() succeeds in atomic batch.
 * H. Article and receipt join cleanly on the generated ID.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('Migration 0004: real SQLite migration and schema contract verification', async (t) => {
  const db = new DatabaseSync(':memory:');

  await t.test('1. Setup exact pre-0004 production schema with fixture rows', () => {
    db.exec(`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        color_badge TEXT DEFAULT '#059669',
        description TEXT,
        show_on_home INTEGER DEFAULT 1,
        display_order INTEGER DEFAULT 1,
        layout_style TEXT DEFAULT 'bento',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE authors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        bio TEXT,
        avatar TEXT,
        role TEXT DEFAULT 'Editor',
        social_links TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        content_md TEXT NOT NULL,
        content_html TEXT NOT NULL,
        featured_image TEXT,
        image_alt TEXT,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        author_id INTEGER REFERENCES authors(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'published' CHECK(status IN ('draft', 'published', 'scheduled')),
        views INTEGER DEFAULT 0,
        reading_time_minutes INTEGER DEFAULT 3,
        key_takeaways TEXT,
        focus_keyword TEXT,
        content_hash TEXT,
        is_featured INTEGER DEFAULT 0,
        is_trending INTEGER DEFAULT 0,
        published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE article_ingest_receipts (
        job_id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        source_article_id TEXT NOT NULL,
        content_sha256 TEXT NOT NULL,
        article_content_hash TEXT NOT NULL,
        article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        contract_version INTEGER NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source, source_article_id),
        UNIQUE(content_sha256),
        UNIQUE(article_content_hash)
      );

      INSERT INTO categories (id, name, slug) VALUES (3, 'Arsitektur & Renovasi', 'arsitektur-renovasi');
      INSERT INTO authors (id, name, slug) VALUES (3, 'RancangLoka Editorial Desk', 'dewan-redaksi-spasial');

      -- Existing fixture article (pre-migration)
      INSERT INTO articles (
        id, slug, title, content_md, content_html, category_id, author_id
      ) VALUES (
        1, 'artikel-eksisting', 'Artikel Eksisting', '# Halo', '<p>Halo</p>', 3, 3
      );
    `);

    // Verify pre-0004 state
    const tableInfo = db.prepare("PRAGMA table_info(articles)").all();
    const colNames = tableInfo.map((c) => c.name);
    assert.ok(!colNames.includes('is_sponsored'), 'pre-migration must not have is_sponsored');
    assert.ok(!colNames.includes('disable_internal_links'), 'pre-migration must not have disable_internal_links');
  });

  await t.test('2. Apply migration 0004_add_article_flags.sql cleanly', () => {
    const migrationSqlPath = resolve(process.cwd(), 'db/migrations/0004_add_article_flags.sql');
    const migrationSql = readFileSync(migrationSqlPath, 'utf8');
    db.exec(migrationSql);

    const tableInfo = db.prepare("PRAGMA table_info(articles)").all();
    const sponsoredCol = tableInfo.find((c) => c.name === 'is_sponsored');
    const linksCol = tableInfo.find((c) => c.name === 'disable_internal_links');

    assert.ok(sponsoredCol, 'is_sponsored must exist after migration');
    assert.equal(sponsoredCol.type, 'INTEGER');
    assert.equal(sponsoredCol.dflt_value, '0');

    assert.ok(linksCol, 'disable_internal_links must exist after migration');
    assert.equal(linksCol.type, 'INTEGER');
    assert.equal(linksCol.dflt_value, '0');
  });

  await t.test('3. Verify existing rows preserved with effective default 0', () => {
    const existingRow = db.prepare('SELECT id, slug, is_sponsored, disable_internal_links FROM articles WHERE id = 1').get();
    assert.ok(existingRow);
    assert.equal(existingRow.id, 1);
    assert.equal(existingRow.slug, 'artikel-eksisting');
    assert.equal(existingRow.is_sponsored, 0);
    assert.equal(existingRow.disable_internal_links, 0);
  });

  await t.test('4. Execute Hermes article & receipt batch persistence using actual SQL', () => {
    db.exec('BEGIN TRANSACTION;');
    
    // Exact SQL statement from src/lib/db.ts insertHermesArticleAndReceipt
    const insertArticleStmt = db.prepare(`
      INSERT INTO articles (
        slug, title, description, content_md, content_html, featured_image, image_alt,
        category_id, author_id, status, reading_time_minutes, key_takeaways,
        focus_keyword, content_hash, is_featured, is_trending, is_sponsored,
        disable_internal_links, published_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertArticleStmt.run(
      'arsitektur-bioklimatik-tropis-modern',
      'Arsitektur Bioklimatik Tropis Modern',
      'Kajian mendalam tentang desain adaptif iklim tropis.',
      '## Prinsip Desain Bioklimatik\n\nVentilasi silang dan peneduh pasif.',
      '<h2 id="prinsip-desain-bioklimatik">Prinsip Desain Bioklimatik</h2><p>Ventilasi silang dan peneduh pasif.</p>',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c',
      'Arsitektur Bioklimatik Tropis Modern',
      3,
      3,
      'draft',
      5,
      JSON.stringify(['Ventilasi silang', 'Peneduh pasif']),
      'arsitektur bioklimatik tropis',
      'chash_test_1234567890abcdef',
      0,
      0,
      0,
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Exact SQL statement from src/lib/db.ts insertReceiptStmt
    const insertReceiptStmt = db.prepare(`
      INSERT INTO article_ingest_receipts (
        job_id, source, source_article_id, content_sha256, article_content_hash, article_id, contract_version
      )
      VALUES (?, ?, ?, ?, ?, last_insert_rowid(), ?)
    `);

    insertReceiptStmt.run(
      'job_test_0004_verify',
      'hermes',
      'art_test_0004_verify',
      'csha_test_1234567890abcdef',
      'chash_test_1234567890abcdef',
      1
    );

    db.exec('COMMIT;');

    // Verify both rows joined on article_id
    const joined = db.prepare(`
      SELECT r.job_id, r.article_id, a.id, a.slug, a.status, a.is_sponsored, a.disable_internal_links
      FROM article_ingest_receipts r
      JOIN articles a ON a.id = r.article_id
      WHERE r.job_id = ?
    `).get('job_test_0004_verify');

    assert.ok(joined, 'Article and receipt must be joined');
    assert.equal(joined.job_id, 'job_test_0004_verify');
    assert.equal(joined.article_id, joined.id);
    assert.equal(joined.slug, 'arsitektur-bioklimatik-tropis-modern');
    assert.equal(joined.status, 'draft');
    assert.equal(joined.is_sponsored, 0);
    assert.equal(joined.disable_internal_links, 0);
  });
});
