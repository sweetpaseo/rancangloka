/**
 * Phase 2B2B-4B3A-R2: Schema Compatibility & Migration Chain Regression Test
 * 
 * Verifies:
 * 1. Base schema + sequential migration chain (0001 -> 0002 -> 0003 -> 0004) reproduces
 *    the expected production database state without drift.
 * 2. Every column referenced in runtime SQL statements:
 *    - insertHermesArticleAndReceipt()
 *    - createArticle()
 *    must exist in the migrated SQLite table schema.
 * 3. Future attempts to add columns to runtime SQL without corresponding migrations
 *    will fail this test automatically.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

test('Schema Compatibility: migration chain and runtime persistence verification', async (t) => {
  const db = new DatabaseSync(':memory:');

  await t.test('1. Sequential execution of complete migration chain', () => {
    // Initial base schema (pre-0001 state)
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

      -- Base seeded data
      INSERT INTO categories (id, name, slug) VALUES (1, 'Interior & Tata Ruang', 'interior-design');
      INSERT INTO authors (id, name, slug) VALUES (1, 'Dimas Prasetyo, IAI', 'dimas-prasetyo');
    `);

    // Discover and apply all numbered migrations in order
    const migrationsDir = resolve(process.cwd(), 'db/migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    assert.deepEqual(
      migrationFiles,
      [
        '0001_category_taxonomy_expansion.sql',
        '0002_article_ingest_receipts.sql',
        '0003_canonical_editorial_author.sql',
        '0004_add_article_flags.sql'
      ],
      'Migration files must match expected sequence'
    );

    for (const file of migrationFiles) {
      const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
      db.exec(sql);
    }
  });

  await t.test('2. Verify runtime SQL column compatibility against migrated schema', () => {
    // Read source code to extract column names from insert statements
    const dbSrc = readFileSync(resolve(process.cwd(), 'src/lib/db.ts'), 'utf8');

    // Extract columns from insertHermesArticleAndReceipt
    const hermesMatch = dbSrc.match(/INSERT INTO articles \(([\s\S]*?)\)\s*VALUES/);
    assert.ok(hermesMatch, 'Must find INSERT INTO articles in src/lib/db.ts');
    
    const hermesCols = hermesMatch[1]
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    // Get actual columns from SQLite table info
    const tableInfo = db.prepare("PRAGMA table_info(articles)").all();
    const actualColNames = new Set(tableInfo.map(c => c.name));

    // Verify every column in Hermes INSERT exists in migrated table
    for (const col of hermesCols) {
      assert.ok(
        actualColNames.has(col),
        `Column "${col}" used in insertHermesArticleAndReceipt() must exist in migrated articles schema.`
      );
    }

    // Also verify createArticle() columns
    const createArticleMatches = [...dbSrc.matchAll(/INSERT INTO articles \(([\s\S]*?)\)\s*VALUES/g)];
    for (const match of createArticleMatches) {
      const cols = match[1].split(',').map(c => c.trim()).filter(Boolean);
      for (const col of cols) {
        assert.ok(
          actualColNames.has(col),
          `Column "${col}" used in createArticle() must exist in migrated articles schema.`
        );
      }
    }
  });

  await t.test('3. Test insertion with full runtime schema attributes', () => {
    // Test that a full insert runs cleanly with zero syntax or column mismatch errors
    const testStmt = db.prepare(`
      INSERT INTO articles (
        slug, title, description, content_md, content_html, featured_image, image_alt,
        category_id, author_id, status, reading_time_minutes, key_takeaways,
        focus_keyword, content_hash, is_featured, is_trending, is_sponsored,
        disable_internal_links, published_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    assert.doesNotThrow(() => {
      testStmt.run(
        'test-schema-compatibility-slug',
        'Judul Uji Kompatibilitas Skema',
        'Deskripsi uji',
        '# Markdown',
        '<p>Markdown</p>',
        'https://example.com/image.jpg',
        'Alt image',
        1,
        1,
        'draft',
        3,
        '[]',
        'focus',
        'hash123',
        0,
        0,
        0,
        0,
        new Date().toISOString(),
        new Date().toISOString()
      );
    });
  });
});
