/**
 * RancangLoka — PUBLICATION CLOCK-SKEW & PROVENANCE REGRESSION TEST
 * Milestone: CONTENT-GOLIVE-1-STABILIZE
 *
 * Deterministically proves:
 * 1. Operator/workstation clock can be intentionally minutes or hours skewed backwards.
 * 2. Human approval is recorded with database server time.
 * 3. Publication derives actualPublishedAt exclusively from the canonical database server time.
 * 4. published_at is strictly monotonically >= approval created_at (no inversion).
 * 5. Article published_at, execution actual_published_at, and receipt actual_published_at
 *    are 100% unified and identical.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';

import {
  recordEditorialApproval,
  evaluateArticleReadiness
} from '../src/lib/publication/service.ts';

import {
  schedulePlanForExecution,
  executeAtomicPublication,
  processSingleExecution,
  publishNow
} from '../src/lib/publication/publisher-service.ts';

import {
  PLANNER_PROFILE_GROWING
} from '../src/lib/publication/planner-types.ts';

function createTestDb() {
  const sqlite = new DatabaseSync(':memory:');

  // Base schema
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  // Seed canonical author & categories
  sqlite.exec(`
    INSERT OR REPLACE INTO authors (id, name, slug, bio, avatar, role)
    VALUES (3, 'RancangLoka Editorial Desk', 'dewan-redaksi-spasial', 'Dewan redaksi arsitektur.', '/avatar.png', 'Editorial Desk');

    INSERT OR REPLACE INTO categories (id, name, slug, description)
    VALUES 
      (1, 'Tata Ruang & Denah', 'interior-design', 'Panduan tata ruang'),
      (2, 'Material Bangunan', 'material-bangunan', 'Panduan material'),
      (3, 'Arsitektur & Renovasi', 'arsitektur-renovasi', 'Panduan arsitektur');
  `);

  // Apply migrations
  const migrations = [
    '0002_article_ingest_receipts.sql',
    '0005_media_assets_and_article_media.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql',
    '0008_publication_planner.sql',
    '0009_publication_publisher.sql',
    '0017_auto_schedule_and_manual_hold.sql',
    '0023_editorial_trajectory_ledger.sql'
  ];

  for (const mig of migrations) {
    const migPath = path.resolve(process.cwd(), `db/migrations/${mig}`);
    if (fs.existsSync(migPath)) {
      const sql = fs.readFileSync(migPath, 'utf-8');
      sqlite.exec(sql);
    }
  }

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
      sqlite.exec('BEGIN TRANSACTION');
      try {
        const results = [];
        for (const s of stmts) {
          const stmt = sqlite.prepare(s._sql);
          const info = stmt.run(...s._params);
          results.push({
            changes: Number(info.changes),
            meta: { changes: Number(info.changes) }
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

async function main() {
  console.log('=== PUBLICATION CLOCK-SKEW & PROVENANCE REGRESSION TEST ===\n');

  const db = createTestDb();
  const articleId = 100;
  const content = '# Judul Panduan Konstruksi\\n\\n## Analisis Material\\n\\nKonten uji material rumah tropis.\\n\\n## Pertimbangan Teknis\\n\\nPembahasan teknis lengkap.';
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');

  // 1. Seed draft article
  await db.prepare(`
    INSERT INTO articles (
      id, slug, title, description, content_md, content_html, featured_image, image_alt,
      category_id, author_id, status, reading_time_minutes, key_takeaways,
      focus_keyword, content_hash, is_featured, is_trending, published_at, updated_at
    ) VALUES (
      ?, 'uji-clock-skew-artikel-konstruksi', 'Judul Uji Clock Skew', 'Deskripsi artikel uji', ?, '<p>Konten</p>',
      '/media/images/test.webp', 'Alt text valid', 1, 3, 'draft', 5,
      '["Poin 1 evaluasi", "Poin 2 analisis"]', 'material rumah', ?, 0, 0, NULL, CURRENT_TIMESTAMP
    )
  `).bind(articleId, content, contentHash).run();

  // 2. Seed active validated media
  const assetId = 'ast_test_clock_skew_001';
  await db.prepare(`
    INSERT INTO media_assets (asset_id, source_type, storage_key, public_url, mime_type, file_size, width, height, status, sha256)
    VALUES (?, 'manual_upload', 'media/images/test.webp', 'https://assets.rancangloka.com/test.webp', 'image/webp', 1024, 1200, 675, 'VALIDATED', 'hash123')
  `).bind(assetId).run();

  await db.prepare(`
    INSERT INTO article_media (article_id, asset_id, role, is_active)
    VALUES (?, ?, 'featured', 1)
  `).bind(articleId, assetId).run();

  // 3. Record human editorial approval at server time
  console.log('1. Recording Human Editorial Approval...');
  const approvalRes = await recordEditorialApproval(db, {
    articleId,
    approvedBy: 'chief_editor',
    approvedRole: 'editor_in_chief',
    notes: 'Approval granted for clock skew test'
  });

  const approvalRow = await db.prepare('SELECT * FROM article_editorial_approvals WHERE id = ?').bind(approvalRes.approval.id).first();
  console.log('  Approval recorded at server time:', approvalRow.created_at);
  assert.equal(approvalRow.approval_status, 'APPROVED', 'Approval must be approved');

  // 4. Create publication readiness & plan
  console.log('2. Creating Publication Readiness & Plan...');
  await db.prepare(`
    INSERT INTO article_publication_readiness (
      article_id, content_hash, is_ready, overall_status, snapshot_json, evaluated_at
    ) VALUES (?, ?, 1, 'READY_TO_SCHEDULE', '{}', CURRENT_TIMESTAMP)
  `).bind(articleId, contentHash).run();

  const readinessRow = await db.prepare('SELECT id FROM article_publication_readiness WHERE article_id = ? ORDER BY id DESC LIMIT 1').bind(articleId).first();

  const planId = 'plan_skew_test_001';
  await db.prepare(`
    INSERT INTO article_publication_plans (
      plan_id, article_id, readiness_id, content_hash, featured_asset_id,
      target_publish_at, target_publish_local, timezone, plan_status,
      planner_profile, planner_version, priority_score, slot_index,
      jitter_seconds, reason_codes, scheduling_mode, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'Local Time', 'Asia/Jakarta', 'PLANNED',
      'GROWING', '1.0.0', 50.0, 1, 0, '["TEST"]', 'editorial_signoff', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).bind(planId, articleId, readinessRow.id, contentHash, assetId).run();

  // 5. SIMULATE SEVERELY SKEWED OPERATOR WORKSTATION CLOCK (15 MINUTES BACKWARDS)
  console.log('3. Simulating Operator Workstation Clock Skew (-15 minutes)...');
  const OriginalDate = globalThis.Date;
  const SKEW_MS = 15 * 60 * 1000; // 15 minutes behind
  
  // Custom Date proxy that returns a skewed timestamp when instantiated without arguments
  class MockSkewedDate extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(OriginalDate.now() - SKEW_MS);
      } else {
        super(...args);
      }
    }
    static now() {
      return OriginalDate.now() - SKEW_MS;
    }
  }

  globalThis.Date = MockSkewedDate;

  try {
    const clientSkewedTime = new Date().toISOString();
    console.log('  Workstation skewed time:', clientSkewedTime);

    // 6. Execute publishNow on the workstation
    console.log('4. Executing Controlled publishNow under Skewed Workstation Clock...');
    const publishResult = await publishNow(db, planId, 'chief_editor');

    assert.equal(publishResult.outcome, 'PUBLISHED', 'Outcome must be PUBLISHED');

    // 7. Verify Publication Timestamp Sourcing
    console.log('5. Verifying Database Timestamps and Invariants...');
    const art = await db.prepare('SELECT id, status, published_at, updated_at FROM articles WHERE id = ?').bind(articleId).first();
    const exec = await db.prepare('SELECT * FROM article_publication_executions WHERE plan_id = ?').bind(planId).first();
    const rcpt = await db.prepare('SELECT * FROM publication_execution_receipts WHERE plan_id = ?').bind(planId).first();

    console.log('  articles.published_at:                        ', art.published_at);
    console.log('  article_publication_executions.actual_pub_at: ', exec.actual_published_at);
    console.log('  publication_execution_receipts.actual_pub_at: ', rcpt.actual_published_at);
    console.log('  approval created_at (server time):            ', approvalRow.created_at);

    // Assertions
    // A. Timestamp must NOT match the skewed workstation clock
    const publishedTimeMs = new OriginalDate(art.published_at).getTime();
    const skewedTimeMs = new OriginalDate(clientSkewedTime).getTime();
    const diffToSkewed = Math.abs(publishedTimeMs - skewedTimeMs);

    assert(
      diffToSkewed > 10 * 60 * 1000,
      `published_at (${art.published_at}) must not adopt the skewed workstation clock (${clientSkewedTime})`
    );

    // B. published_at must be monotonically >= approval server time
    const approvalTimeMs = new OriginalDate(approvalRow.created_at + 'Z').getTime();
    assert(
      publishedTimeMs >= approvalTimeMs,
      `published_at (${art.published_at}) must not be earlier than approval (${approvalRow.created_at})`
    );

    // C. Exact unity across article, execution, and receipt
    assert.equal(
      art.published_at,
      exec.actual_published_at,
      'article published_at must exactly equal execution actual_published_at'
    );
    assert.equal(
      art.published_at,
      rcpt.actual_published_at,
      'article published_at must exactly equal receipt actual_published_at'
    );

    console.log('\n✅ ALL CLOCK-SKEW REGRESSION ASSERTIONS PASSED (100% PASS)');
  } finally {
    // Restore global Date
    globalThis.Date = OriginalDate;
  }
}

main().catch(err => {
  console.error('\n❌ CLOCK-SKEW REGRESSION TEST FAILED:', err);
  process.exit(1);
});
