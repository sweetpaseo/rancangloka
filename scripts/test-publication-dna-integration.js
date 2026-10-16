/**
 * ============================================================================
 * RancangLoka Publication DNA Integration Test Suite (CONTENT_PROTECTION-1B-B)
 *
 * Verifies end-to-end integration of Publication DNA materialization into the
 * publisher runtime, including:
 * - Local SQLite execution with Migration 0034 applied
 * - Idempotency (DNA_ALREADY_EXISTS) & conflict detection (DNA_VERSION_CONFLICT)
 * - Modern hash enforcement (CANONICAL_MARKDOWN_HASH_V1)
 * - Approval provenance validation (DNA_PROVENANCE_SOURCE_MISMATCH)
 * - Cloudflare Worker ctx.waitUntil asynchronous non-blocking contract
 * - Transaction order enforcement (zero DNA on publication failure)
 * - Race-safety: captured publication snapshot vs live mutable prose
 * - Forensic snapshot completeness
 * ============================================================================
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  DNA_VERSION,
  NORMALIZATION_VERSION,
  SHINGLE_VERSION,
  MINHASH_VERSION,
  GENERATOR_VERSION,
  CONTENT_HASH_CONTRACT_MARKDOWN_V1,
  CONTENT_HASH_CONTRACT_LEGACY_V0,
  computeCanonicalContentHash,
  generatePublicationDnaMaterial
} from '../src/lib/content-protection/publication-dna.ts';

import {
  materializePublicationDna
} from '../src/lib/content-protection/publication-dna-store.ts';

import {
  executeAtomicPublication
} from '../src/lib/publication/publisher-service.ts';

function computeSha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Creates an in-memory SQLite database loaded with migrations up to 0034.
 */
function createIntegrationTestDb() {
  const sqlite = new DatabaseSync(':memory:');

  // Base schema
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  const migrations = [
    '0001_initial_schema.sql',
    '0002_article_slug_and_dates.sql',
    '0003_admin_users.sql',
    '0004_d1_audit_log.sql',
    '0005_media_assets_and_article_media.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql',
    '0008_publication_planner.sql',
    '0009_publication_publisher.sql',
    '0017_auto_schedule_and_manual_hold.sql',
    '0023_editorial_trajectory_ledger.sql',
    '0034_article_publication_dna.sql'
  ];

  for (const mig of migrations) {
    const migPath = path.resolve(process.cwd(), `db/migrations/${mig}`);
    if (fs.existsSync(migPath)) {
      const sql = fs.readFileSync(migPath, 'utf-8');
      sqlite.exec(sql);
    }
  }

  // Seed baseline author and category
  sqlite.exec(`
    INSERT OR IGNORE INTO authors (id, name, slug, bio) VALUES (1, 'Editor RancangLoka', 'editor-rancangloka', 'Redaksi');
    INSERT OR IGNORE INTO categories (id, name, slug) VALUES (1, 'Arsitektur', 'arsitektur');
  `);

  return {
    raw: sqlite,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.map(v => (v === undefined ? null : v));
          return this;
        },
        async run() {
          const stmt = sqlite.prepare(this._sql);
          const info = stmt.run(...this._params);
          return {
            changes: Number(info.changes),
            lastRowId: Number(info.lastInsertRowid),
            meta: {
              changes: Number(info.changes),
              last_row_id: Number(info.lastInsertRowid)
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
    },
    async batch(stmts) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const stmt of stmts) {
          const s = sqlite.prepare(stmt._sql);
          const info = s.run(...stmt._params);
          results.push({
            changes: Number(info.changes),
            lastRowId: Number(info.lastInsertRowid),
            meta: {
              changes: Number(info.changes),
              last_row_id: Number(info.lastInsertRowid)
            }
          });
        }
        sqlite.exec('COMMIT');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    }
  };
}

/**
 * Seeds a synthetic deterministic planned article fixture.
 */
async function seedPlannedFixture(db, overrides = {}) {
  const articleId = overrides.articleId || 201;
  const slug = overrides.slug || `synthetic-dna-article-${articleId}`;
  const contentMd = overrides.contentMd || '# Desain Dinding Bata Expose\n\nAnalisis kekuatan dan proteksi kelembapan tropis.';
  const contentHtml = overrides.contentHtml || '<h1>Desain Dinding Bata Expose</h1><p>Analisis kekuatan dan proteksi kelembapan tropis.</p>';
  const contentHash = computeSha256(contentMd);
  const assetId = overrides.assetId || `asset_${articleId}`;
  const planId = overrides.planId || `plan_${articleId}`;
  const executionId = overrides.executionId || `pexec_${articleId}`;
  const targetPublishAt = overrides.targetPublishAt || '2026-10-16T12:00:00.000Z';

  // 1. Article
  await db.prepare(`
    INSERT OR REPLACE INTO articles (
      id, slug, title, description, content_md, content_html, featured_image,
      image_alt, category_id, author_id, status, content_hash, published_at, updated_at
    ) VALUES (
      ?, ?, 'Panduan Dinding Bata Expose', 'Ulasan teknis material.',
      ?, ?, 'https://assets.rancangloka.com/bata.webp',
      'Detail bata expose', 1, 1, 'draft', ?, NULL, CURRENT_TIMESTAMP
    )
  `).bind(articleId, slug, contentMd, contentHtml, contentHash).run();

  // 2. Media Asset & Binding
  const mediaSha256 = computeSha256(`synthetic_binary_${assetId}`);
  await db.prepare(`
    INSERT OR REPLACE INTO media_assets (
      asset_id, source_type, storage_key, public_url, mime_type, file_size,
      width, height, status, sha256
    ) VALUES (
      ?, 'manual_upload', ?, ?,
      'image/webp', 50000, 1200, 800, 'VALIDATED', ?
    )
  `).bind(assetId, `media/images/${assetId}.webp`, `https://assets.rancangloka.com/images/${assetId}.webp`, mediaSha256).run();

  await db.prepare(`
    INSERT OR REPLACE INTO article_media (
      article_id, asset_id, role, sort_order, is_active
    ) VALUES (?, ?, 'featured', 0, 1)
  `).bind(articleId, assetId).run();

  // 3. Editorial Approval
  await db.prepare(`
    INSERT OR REPLACE INTO article_editorial_approvals (
      article_id, approved_content_hash, approved_asset_id, approved_by, approval_status, notes
    ) VALUES (?, ?, ?, 'lead_editor', 'APPROVED', 'Disetujui untuk publikasi')
  `).bind(articleId, contentHash, assetId).run();

  // 4. Publication Readiness
  await db.prepare(`
    INSERT OR REPLACE INTO article_publication_readiness (
      article_id, content_hash, is_ready, overall_status, snapshot_json, evaluated_at
    ) VALUES (?, ?, 1, 'READY_TO_SCHEDULE', '{}', CURRENT_TIMESTAMP)
  `).bind(articleId, contentHash).run();

  // 5. Plan
  await db.prepare(`
    INSERT OR REPLACE INTO article_publication_plans (
      plan_id, article_id, readiness_id, content_hash, featured_asset_id,
      target_publish_at, target_publish_local, timezone, plan_status,
      planner_profile, priority_score, slot_index, jitter_seconds, reason_codes
    ) VALUES (
      ?, ?, 1, ?, ?,
      ?, '2026-10-16 19:00:00 WIB', 'Asia/Jakarta', 'PLANNED',
      'GROWING', 90.0, 1, 0, '["FIFO_AGE"]'
    )
  `).bind(planId, articleId, contentHash, assetId, targetPublishAt).run();

  // 6. Execution
  const executionRecord = {
    execution_id: executionId,
    plan_id: planId,
    article_id: articleId,
    content_hash: contentHash,
    featured_asset_id: assetId,
    target_publish_at: targetPublishAt,
    execution_status: 'CLAIMED',
    claimed_by_worker: 'worker_dna_test',
    attempts_count: 0
  };

  await db.prepare(`
    INSERT OR REPLACE INTO article_publication_executions (
      execution_id, plan_id, article_id, content_hash, featured_asset_id,
      target_publish_at, execution_status, publisher_version, execution_mode,
      claimed_by_worker, attempts_count, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, 'CLAIMED', 'v2.0', 'scheduled_publish',
      'worker_dna_test', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).bind(executionId, planId, articleId, contentHash, assetId, targetPublishAt).run();

  return {
    articleId,
    slug,
    contentMd,
    contentHash,
    assetId,
    mediaSha256,
    planId,
    executionId,
    executionRecord
  };
}

async function seedReceipt(db, fix, receiptId) {
  await db.prepare(`
    INSERT OR REPLACE INTO publication_execution_receipts (
      receipt_id, execution_id, plan_id, article_id, slug,
      content_hash, featured_asset_id, canonical_url,
      target_publish_at, actual_published_at, publisher_version,
      planner_version, attempts_count, outcome, details_json, created_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, 'v2.0',
      'v1.0', 1, 'SUCCESS', '{}', CURRENT_TIMESTAMP
    )
  `).bind(
    receiptId, fix.executionId, fix.planId, fix.articleId, fix.slug,
    fix.contentHash, fix.assetId, `https://rancangloka.com/${fix.slug}`,
    '2026-10-16T12:00:00.000Z', '2026-10-16T12:00:00.000Z'
  ).run();
}

async function runIntegrationTests() {
  console.log('================================================================');
  console.log('RancangLoka — CONTENT_PROTECTION-1B-B Integration Test Suite');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(err);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(err);
      failed++;
    }
  }

  // ============================================================================
  // Suite 1: Pure Materialization Matrix & Storage Contracts
  // ============================================================================
  console.log('\n--- Suite 1: Pure Materialization Matrix & Storage Contracts ---');

  await testAsync('1A: Valid new publication snapshot materializes DNA (DNA_GENERATED)', async () => {
    const db = createIntegrationTestDb();
    const fix = await seedPlannedFixture(db, { articleId: 301 });
    await seedReceipt(db, fix, 'rcpt_test_301');

    const snapshot = {
      articleId: fix.articleId,
      contentMarkdown: fix.contentMd,
      contentHash: fix.contentHash,
      slug: fix.slug,
      canonicalUrl: `https://rancangloka.com/${fix.slug}`,
      approvedContentHash: fix.contentHash,
      approvedRecordedAt: '2026-10-16T10:00:00.000Z',
      featuredAssetId: fix.assetId,
      featuredAssetSha256: fix.mediaSha256,
      executionId: fix.executionId,
      receiptId: 'rcpt_test_301',
      actualPublishedAt: '2026-10-16T12:00:00.000Z',
      provenanceClass: 'FULL_PROVENANCE',
      contentHashContract: CONTENT_HASH_CONTRACT_MARKDOWN_V1
    };

    const res = await materializePublicationDna(db, snapshot);
    assert.strictEqual(res.status, 'DNA_GENERATED');
    assert(res.dnaId && res.dnaId.startsWith('dna_'));
    assert.strictEqual(res.versionKey, 'receipt:rcpt_test_301');

    // Verify row count in SQLite
    const row = await db.prepare('SELECT * FROM article_dna_signatures WHERE version_key = ?').bind('receipt:rcpt_test_301').first();
    assert(row, 'DNA row must exist in table');
    assert.strictEqual(row.article_id, 301);
    assert.strictEqual(row.published_content_hash, fix.contentHash);
    assert.strictEqual(row.content_hash_contract, 'canonical-markdown-sha256-v1');
  });

  await testAsync('1B: Idempotent re-run on same receipt returns DNA_ALREADY_EXISTS', async () => {
    const db = createIntegrationTestDb();
    const fix = await seedPlannedFixture(db, { articleId: 302 });
    await seedReceipt(db, fix, 'rcpt_test_302');

    const snapshot = {
      articleId: fix.articleId,
      contentMarkdown: fix.contentMd,
      contentHash: fix.contentHash,
      slug: fix.slug,
      canonicalUrl: `https://rancangloka.com/${fix.slug}`,
      approvedContentHash: fix.contentHash,
      approvedRecordedAt: '2026-10-16T10:00:00.000Z',
      featuredAssetId: fix.assetId,
      featuredAssetSha256: fix.mediaSha256,
      executionId: fix.executionId,
      receiptId: 'rcpt_test_302',
      actualPublishedAt: '2026-10-16T12:00:00.000Z',
      provenanceClass: 'FULL_PROVENANCE',
      contentHashContract: CONTENT_HASH_CONTRACT_MARKDOWN_V1
    };

    const res1 = await materializePublicationDna(db, snapshot);
    assert.strictEqual(res1.status, 'DNA_GENERATED');

    const res2 = await materializePublicationDna(db, snapshot);
    assert.strictEqual(res2.status, 'DNA_ALREADY_EXISTS');
    assert.strictEqual(res2.dnaId, res1.dnaId);

    const count = (await db.prepare('SELECT COUNT(*) as c FROM article_dna_signatures WHERE version_key = ?').bind('receipt:rcpt_test_302').first()).c;
    assert.strictEqual(count, 1, 'Exactly one row must exist after idempotent execution');
  });

  await testAsync('1C: Same version_key with conflicting content returns DNA_VERSION_CONFLICT without overwrite', async () => {
    const db = createIntegrationTestDb();
    const fix = await seedPlannedFixture(db, { articleId: 303 });
    await seedReceipt(db, fix, 'rcpt_test_303');

    const snapshot1 = {
      articleId: fix.articleId,
      contentMarkdown: fix.contentMd,
      contentHash: fix.contentHash,
      slug: fix.slug,
      canonicalUrl: `https://rancangloka.com/${fix.slug}`,
      approvedContentHash: fix.contentHash,
      approvedRecordedAt: '2026-10-16T10:00:00.000Z',
      featuredAssetId: fix.assetId,
      featuredAssetSha256: fix.mediaSha256,
      executionId: fix.executionId,
      receiptId: 'rcpt_test_303',
      actualPublishedAt: '2026-10-16T12:00:00.000Z'
    };

    const res1 = await materializePublicationDna(db, snapshot1);
    assert.strictEqual(res1.status, 'DNA_GENERATED');

    // Conflicting snapshot with different articleId or contentHash
    const snapshot2 = {
      ...snapshot1,
      articleId: 999,
      contentMarkdown: '# Conflicting content'
    };

    const res2 = await materializePublicationDna(db, snapshot2);
    assert.strictEqual(res2.status, 'DNA_VERSION_CONFLICT');
    assert(res2.error && res2.error.includes('conflicts with snapshot fields'));

    // Verify original row is preserved
    const row = await db.prepare('SELECT * FROM article_dna_signatures WHERE version_key = ?').bind('receipt:rcpt_test_303').first();
    assert.strictEqual(row.article_id, fix.articleId, 'Original row article_id must not be overwritten');
    assert.strictEqual(row.dna_id, res1.dnaId, 'Original dna_id must remain untouched');
  });

  await testAsync('1D: Modern hash mismatch returns DNA_SOURCE_HASH_MISMATCH with zero insert', async () => {
    const db = createIntegrationTestDb();
    const fix = await seedPlannedFixture(db, { articleId: 304 });

    const snapshot = {
      articleId: fix.articleId,
      contentMarkdown: '# Discrepant Markdown\n\nNot matching the declared hash.',
      contentHash: fix.contentHash, // does not match markdown
      slug: fix.slug,
      canonicalUrl: `https://rancangloka.com/${fix.slug}`,
      approvedContentHash: fix.contentHash,
      receiptId: 'rcpt_test_304',
      executionId: fix.executionId,
      actualPublishedAt: '2026-10-16T12:00:00.000Z'
    };

    const res = await materializePublicationDna(db, snapshot);
    assert.strictEqual(res.status, 'DNA_SOURCE_HASH_MISMATCH');
    assert(res.error && res.error.includes('Source hash mismatch'));

    const count = (await db.prepare('SELECT COUNT(*) as c FROM article_dna_signatures WHERE version_key = ?').bind('receipt:rcpt_test_304').first()).c;
    assert.strictEqual(count, 0, 'Zero rows must be inserted on source hash mismatch');
  });

  await testAsync('1E: Approval hash mismatch returns DNA_PROVENANCE_SOURCE_MISMATCH with zero insert', async () => {
    const db = createIntegrationTestDb();
    const fix = await seedPlannedFixture(db, { articleId: 305 });

    const snapshot = {
      articleId: fix.articleId,
      contentMarkdown: fix.contentMd,
      contentHash: fix.contentHash,
      slug: fix.slug,
      canonicalUrl: `https://rancangloka.com/${fix.slug}`,
      approvedContentHash: 'stale_or_tampered_approval_hash', // Mismatch!
      approvedRecordedAt: '2026-10-16T10:00:00.000Z',
      receiptId: 'rcpt_test_305',
      executionId: fix.executionId,
      actualPublishedAt: '2026-10-16T12:00:00.000Z'
    };

    const res = await materializePublicationDna(db, snapshot);
    assert.strictEqual(res.status, 'DNA_PROVENANCE_SOURCE_MISMATCH');
    assert(res.error && res.error.includes('Approval provenance hash mismatch'));

    const count = (await db.prepare('SELECT COUNT(*) as c FROM article_dna_signatures WHERE version_key = ?').bind('receipt:rcpt_test_305').first()).c;
    assert.strictEqual(count, 0, 'Zero rows must be inserted on provenance mismatch');
  });

  await testAsync('1F: Missing approval for FULL_PROVENANCE returns DNA_PROVENANCE_SOURCE_MISMATCH', async () => {
    const db = createIntegrationTestDb();
    const fix = await seedPlannedFixture(db, { articleId: 306 });

    const snapshot = {
      articleId: fix.articleId,
      contentMarkdown: fix.contentMd,
      contentHash: fix.contentHash,
      slug: fix.slug,
      canonicalUrl: `https://rancangloka.com/${fix.slug}`,
      approvedContentHash: null, // missing!
      receiptId: 'rcpt_test_306',
      executionId: fix.executionId,
      actualPublishedAt: '2026-10-16T12:00:00.000Z'
    };

    const res = await materializePublicationDna(db, snapshot);
    assert.strictEqual(res.status, 'DNA_PROVENANCE_SOURCE_MISMATCH');
    assert(res.error && res.error.includes('Missing approved_content_hash'));

    const count = (await db.prepare('SELECT COUNT(*) as c FROM article_dna_signatures WHERE version_key = ?').bind('receipt:rcpt_test_306').first()).c;
    assert.strictEqual(count, 0);
  });

  await testAsync('1G: NULL optional featured asset SHA handled safely without failing DNA', async () => {
    const db = createIntegrationTestDb();
    const fix = await seedPlannedFixture(db, { articleId: 307 });
    await seedReceipt(db, fix, 'rcpt_test_307');

    const snapshot = {
      articleId: fix.articleId,
      contentMarkdown: fix.contentMd,
      contentHash: fix.contentHash,
      slug: fix.slug,
      canonicalUrl: `https://rancangloka.com/${fix.slug}`,
      approvedContentHash: fix.contentHash,
      approvedRecordedAt: '2026-10-16T10:00:00.000Z',
      featuredAssetId: 'asset_without_sha',
      featuredAssetSha256: null, // explicitly NULL
      receiptId: 'rcpt_test_307',
      executionId: fix.executionId,
      actualPublishedAt: '2026-10-16T12:00:00.000Z'
    };

    const res = await materializePublicationDna(db, snapshot);
    assert.strictEqual(res.status, 'DNA_GENERATED');

    const row = await db.prepare('SELECT * FROM article_dna_signatures WHERE version_key = ?').bind('receipt:rcpt_test_307').first();
    assert.strictEqual(row.featured_asset_id, 'asset_without_sha');
    assert.strictEqual(row.featured_asset_sha256, null);
  });

  await testAsync('1H: Legacy hash contract cannot be selected by new publisher integration', async () => {
    const db = createIntegrationTestDb();
    const fix = await seedPlannedFixture(db, { articleId: 308 });

    const pubRes = await executeAtomicPublication(
      db,
      fix.executionRecord,
      fix.slug,
      1,
      '2026-10-16T12:00:00.000Z',
      { contentMarkdown: fix.contentMd }
    );

    const row = await db.prepare('SELECT content_hash_contract FROM article_dna_signatures WHERE publication_receipt_id = ?').bind(pubRes.receiptId).first();
    assert(row, 'DNA row must exist');
    assert.strictEqual(row.content_hash_contract, 'canonical-markdown-sha256-v1');
    assert.notStrictEqual(row.content_hash_contract, 'legacy-normalized-sha256-v0');
  });

  // ============================================================================
  // Suite 2: Publisher Runtime executeAtomicPublication & waitUntil
  // ============================================================================
  console.log('\n--- Suite 2: Publisher executeAtomicPublication & waitUntil Contract ---');

  await testAsync('2A: Worker path registers waitUntil exactly once and resolves without blocking', async () => {
    const db = createIntegrationTestDb();
    const fix = await seedPlannedFixture(db, { articleId: 401 });

    const capturedPromises = [];
    const fakeCtx = {
      waitUntil(p) {
        capturedPromises.push(p);
      }
    };

    const pubRes = await executeAtomicPublication(
      db,
      fix.executionRecord,
      fix.slug,
      1,
      '2026-10-16T12:05:00.000Z',
      { ctx: fakeCtx, contentMarkdown: fix.contentMd }
    );

    // Assert publication resolved immediately
    assert(pubRes && pubRes.receiptId.startsWith('rcpt_'));
    assert.strictEqual(pubRes.canonicalUrl, `https://rancangloka.com/${fix.slug}`);

    // Assert waitUntil captured exactly one DNA promise
    assert.strictEqual(capturedPromises.length, 1, 'ctx.waitUntil must be invoked exactly once');

    // Before awaiting captured promise: verify receipt exists in D1
    const receiptRow = await db.prepare('SELECT * FROM publication_execution_receipts WHERE receipt_id = ?').bind(pubRes.receiptId).first();
    assert(receiptRow, 'Publication receipt must be committed before waitUntil resolution');

    // Await the captured waitUntil promise
    const dnaResult = await capturedPromises[0];
    assert.strictEqual(dnaResult.status, 'DNA_GENERATED');

    // Verify DNA row is materialized
    const dnaRow = await db.prepare('SELECT * FROM article_dna_signatures WHERE publication_receipt_id = ?').bind(pubRes.receiptId).first();
    assert(dnaRow, 'DNA row must exist in D1 after awaiting waitUntil promise');
    assert.strictEqual(dnaRow.published_content_hash, fix.contentHash);
  });

  await testAsync('2B: DNA failure in waitUntil does NOT change successful publication outcome', async () => {
    const db = createIntegrationTestDb();
    // Intentionally omit approval to cause DNA provenance mismatch
    const fix = await seedPlannedFixture(db, { articleId: 402 });
    await db.prepare('DELETE FROM article_editorial_approvals WHERE article_id = ?').bind(fix.articleId).run();

    const capturedPromises = [];
    const fakeCtx = {
      waitUntil(p) {
        capturedPromises.push(p);
      }
    };

    const pubRes = await executeAtomicPublication(
      db,
      fix.executionRecord,
      fix.slug,
      1,
      '2026-10-16T12:05:00.000Z',
      { ctx: fakeCtx, contentMarkdown: fix.contentMd }
    );

    // Publication itself MUST succeed
    assert(pubRes && pubRes.receiptId, 'Publication must succeed even if DNA fails');

    // Await captured DNA promise
    assert.strictEqual(capturedPromises.length, 1);
    const dnaResult = await capturedPromises[0];
    assert.strictEqual(dnaResult.status, 'DNA_PROVENANCE_SOURCE_MISMATCH');

    // Receipt exists and article status is published (PUBLICATION_SUCCEEDS_DNA_PENDING)
    const art = await db.prepare('SELECT status FROM articles WHERE id = ?').bind(fix.articleId).first();
    assert.strictEqual(art.status, 'published');
  });

  // ============================================================================
  // Suite 3: Transaction Order & Failure Invariants
  // ============================================================================
  console.log('\n--- Suite 3: Transaction Order & Invariants ---');

  await testAsync('3A: Publication failure ensures zero DNA scheduling and zero DNA rows', async () => {
    const db = createIntegrationTestDb();
    const fix = await seedPlannedFixture(db, { articleId: 403 });

    // Engage manual hold so atomic batch update fails (0 changes)
    await db.prepare("UPDATE articles SET manual_hold = 1 WHERE id = ?").bind(fix.articleId).run();

    const capturedPromises = [];
    const fakeCtx = {
      waitUntil(p) {
        capturedPromises.push(p);
      }
    };

    let threw = false;
    try {
      await executeAtomicPublication(
        db,
        fix.executionRecord,
        fix.slug,
        1,
        '2026-10-16T12:05:00.000Z',
        { ctx: fakeCtx, contentMarkdown: fix.contentMd }
      );
    } catch (err) {
      threw = true;
    }

    assert(threw, 'executeAtomicPublication must throw when article cannot be updated');
    assert.strictEqual(capturedPromises.length, 0, 'Zero waitUntil promises must be scheduled on batch failure');

    const dnaCount = (await db.prepare('SELECT COUNT(*) as c FROM article_dna_signatures WHERE article_id = ?').bind(fix.articleId).first()).c;
    assert.strictEqual(dnaCount, 0, 'Zero DNA records must exist when publication fails');
  });

  // ============================================================================
  // Suite 4: Source Snapshot Race-Safety Test
  // ============================================================================
  console.log('\n--- Suite 4: Source Snapshot Race-Safety Test ---');

  await testAsync('4A: DNA fingerprints captured publication snapshot, NOT mutable prose changed post-commit', async () => {
    const db = createIntegrationTestDb();
    const contentA = '# Versi Naskah Asli A\n\nTeks terbitan kanonikal resmi.';
    const hashA = computeSha256(contentA);
    const fix = await seedPlannedFixture(db, {
      articleId: 404,
      contentMd: contentA,
      contentHash: hashA
    });

    const capturedPromises = [];
    const fakeCtx = {
      waitUntil(p) {
        capturedPromises.push(p);
      }
    };

    // 1. Publication succeeds with content A
    const pubRes = await executeAtomicPublication(
      db,
      fix.executionRecord,
      fix.slug,
      1,
      '2026-10-16T12:10:00.000Z',
      { ctx: fakeCtx, contentMarkdown: contentA }
    );

    assert(pubRes.receiptId);
    assert.strictEqual(capturedPromises.length, 1);

    // 2. Simulate concurrent mutation of live articles table to Version B
    const contentB = '# Versi Naskah B Berubah\n\nProsa berbeda yang dimutasi pasca-publikasi.';
    const hashB = computeSha256(contentB);
    await db.prepare("UPDATE articles SET content_md = ?, content_hash = ? WHERE id = ?").bind(contentB, hashB, fix.articleId).run();

    // 3. Now execute the captured DNA promise
    const dnaResult = await capturedPromises[0];
    assert.strictEqual(dnaResult.status, 'DNA_GENERATED');

    // 4. Verify DNA record fingerprints Version A, NOT Version B
    const dnaRow = await db.prepare('SELECT * FROM article_dna_signatures WHERE publication_receipt_id = ?').bind(pubRes.receiptId).first();
    assert(dnaRow, 'DNA row must exist');
    assert.strictEqual(dnaRow.published_content_hash, hashA, 'DNA published_content_hash must match Version A');
    assert.notStrictEqual(dnaRow.published_content_hash, hashB, 'DNA must NOT fingerprint Version B');

    // Verify block hashes fingerprint Version A
    const expectedDnaMaterialA = generatePublicationDnaMaterial(contentA);
    assert.strictEqual(dnaRow.block_hashes_json, expectedDnaMaterialA.blockHashesJson, 'Block hashes must match Version A');
    assert.strictEqual(dnaRow.minhash_signature_json, expectedDnaMaterialA.minhashSignatureJson, 'MinHash must match Version A');
  });

  // ============================================================================
  // Suite 5: Full DNA Row Forensic Snapshot Verification
  // ============================================================================
  console.log('\n--- Suite 5: Forensic Snapshot Completeness ---');

  await testAsync('5A: Verified row contains all 26 required columns with exact contracts', async () => {
    const db = createIntegrationTestDb();
    const fix = await seedPlannedFixture(db, { articleId: 501 });

    const pubRes = await executeAtomicPublication(
      db,
      fix.executionRecord,
      fix.slug,
      1,
      '2026-10-16T12:15:00.000Z',
      { contentMarkdown: fix.contentMd }
    );

    const row = await db.prepare('SELECT * FROM article_dna_signatures WHERE publication_receipt_id = ?').bind(pubRes.receiptId).first();
    assert(row, 'DNA row must exist');

    assert(row.dna_id.startsWith('dna_'), 'dna_id must have dna_ prefix');
    assert.strictEqual(row.version_key, `receipt:${pubRes.receiptId}`);
    assert.strictEqual(row.article_id, 501);
    assert.strictEqual(row.publication_receipt_id, pubRes.receiptId);
    assert.strictEqual(row.publication_execution_id, fix.executionId);
    assert.strictEqual(row.provenance_class, 'FULL_PROVENANCE');
    assert.strictEqual(row.content_hash_contract, 'canonical-markdown-sha256-v1');
    assert.strictEqual(row.source_fidelity, 'BYTE_EXACT_HASH_VERIFIED');
    assert.strictEqual(row.published_content_hash, fix.contentHash);
    assert.strictEqual(row.approved_content_hash, fix.contentHash);
    assert.strictEqual(row.canonical_slug, fix.slug);
    assert.strictEqual(row.canonical_url, `https://rancangloka.com/${fix.slug}`);
    assert(Boolean(row.approved_recorded_at), 'approved_recorded_at must be populated');
    assert.strictEqual(row.actual_published_at, '2026-10-16T12:15:00.000Z');
    assert.strictEqual(row.historical_published_at, null);

    assert.strictEqual(row.dna_version, 'v1.0');
    assert.strictEqual(row.normalization_version, 'norm-v1');
    assert.strictEqual(row.shingle_version, 'shingle-4w-v1');
    assert.strictEqual(row.minhash_version, 'minhash-64h-v1');
    assert.strictEqual(row.generator_version, 'dna-engine/1.0.0');

    assert.strictEqual(typeof row.normalized_text_hash, 'string');
    assert.strictEqual(row.normalized_text_hash.length, 64);
    assert(Array.isArray(JSON.parse(row.block_hashes_json)));
    assert(Array.isArray(JSON.parse(row.minhash_signature_json)));
    assert.strictEqual(JSON.parse(row.minhash_signature_json).length, 64);
    assert(typeof JSON.parse(row.structural_signature_json) === 'object');

    assert.strictEqual(row.featured_asset_id, fix.assetId);
    assert.strictEqual(row.featured_asset_sha256, fix.mediaSha256);
    assert(Boolean(row.created_at));
  });

  // ============================================================================
  // Suite 6: Non-Worker Local Await Execution
  // ============================================================================
  console.log('\n--- Suite 6: Non-Worker Local Await Execution ---');

  await testAsync('6A: Local execution without ctx awaits promise and returns dnaResult', async () => {
    const db = createIntegrationTestDb();
    const fix = await seedPlannedFixture(db, { articleId: 601 });

    const pubRes = await executeAtomicPublication(
      db,
      fix.executionRecord,
      fix.slug,
      1,
      '2026-10-16T12:20:00.000Z',
      { contentMarkdown: fix.contentMd }
    );

    assert(pubRes.dnaResult, 'dnaResult must be populated in local synchronous await mode');
    assert.strictEqual(pubRes.dnaResult.status, 'DNA_GENERATED');
    assert.strictEqual(pubRes.dnaResult.versionKey, `receipt:${pubRes.receiptId}`);
  });

  console.log('\n================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\nSUCCESS: All Publication DNA Integration tests passed!');
  }
}

runIntegrationTests().catch(err => {
  console.error('Fatal error in integration test runner:', err);
  process.exit(1);
});
