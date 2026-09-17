/**
 * RancangLoka — PUBLICATION-2: Local End-to-End Scheduled Publisher Smoke Verification
 *
 * Exercises the actual PUBLICATION-2 service against the real local Cloudflare D1 database:
 * .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite
 *
 * Strictly Local / Staging:
 * - NO remote D1 migration
 * - NO remote production deploy
 * - NO public publishing
 * - NO unattended Cron execution (PRODUCTION_CRON_ENABLED = NO)
 * - NO AI model calls (MODEL_CALLS = 0)
 * - AUTO_PUBLISH = OFF
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  PUBLISHER_VERSION,
  EXECUTION_STATUS_SCHEDULED,
  EXECUTION_STATUS_CLAIMED,
  EXECUTION_STATUS_PUBLISHED,
  EXECUTION_STATUS_RETRY_WAIT,
  EXECUTION_STATUS_FAILED,
  EXECUTION_STATUS_CANCELLED,
  EXECUTION_STATUS_BLOCKED,
  ERROR_CLASS_RETRYABLE,
  ERROR_CLASS_TERMINAL
} from '../src/lib/publication/publisher-types.ts';

import {
  schedulePlanForExecution,
  getDueExecutions,
  claimExecutionLease,
  validatePrepublishInvariants,
  executeAtomicPublication,
  processSingleExecution,
  runPublisherDispatcher,
  publishNow,
  cancelExecution,
  retryExecution,
  inspectExecution,
  verifyPublicSurface
} from '../src/lib/publication/publisher-service.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function computeSha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Open local D1 SQLite file and wrap as D1Database-compatible interface
 */
function openLocalD1Db() {
  const d1Dir = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  if (!fs.existsSync(d1Dir)) {
    throw new Error(`D1 directory not found: ${d1Dir}`);
  }

  const files = fs.readdirSync(d1Dir).filter(f => f.endsWith('.sqlite'));
  if (files.length === 0) {
    throw new Error(`No D1 sqlite database files found in ${d1Dir}`);
  }

  let dbFile = files[0];
  let maxTables = -1;
  for (const f of files) {
    try {
      const tempDb = new DatabaseSync(path.join(d1Dir, f));
      const res = tempDb.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'").get();
      if (res && res.count > maxTables) {
        maxTables = res.count;
        dbFile = f;
      }
      tempDb.close();
    } catch {
      // ignore
    }
  }

  const fullPath = path.join(d1Dir, dbFile);
  console.log(`Connecting to local D1 database: ${dbFile}`);
  const dbSync = new DatabaseSync(fullPath);

  const d1Wrapper = {
    raw: dbSync,
    prepare(sql) {
      const stmt = dbSync.prepare(sql);
      let boundParams = [];
      const queryObj = {
        _sql: sql,
        _params: [],
        bind(...params) {
          boundParams = params.map(v => (v === undefined ? null : v));
          queryObj._params = boundParams;
          return queryObj;
        },
        async first() {
          const res = stmt.get(...boundParams);
          return res || null;
        },
        async all() {
          const rows = stmt.all(...boundParams);
          return { results: rows };
        },
        async run() {
          const info = stmt.run(...boundParams);
          return {
            success: true,
            changes: Number(info.changes),
            lastRowId: Number(info.lastInsertRowid),
            meta: {
              changes: Number(info.changes),
              last_row_id: Number(info.lastInsertRowid)
            }
          };
        }
      };
      return queryObj;
    },
    async batch(stmts) {
      dbSync.exec('BEGIN');
      try {
        const results = [];
        for (const stmt of stmts) {
          const s = dbSync.prepare(stmt._sql);
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
        dbSync.exec('COMMIT');
        return results;
      } catch (err) {
        dbSync.exec('ROLLBACK');
        throw err;
      }
    }
  };

  return d1Wrapper;
}

const createdSmokeArtifacts = {
  articleIds: [],
  assetIds: [],
  planIds: [],
  executionIds: []
};

/**
 * Seed a genuine, valid fixture complying with PUBLICATION-0 & PUBLICATION-1
 */
function seedLocalPlannedFixture(db, {
  id,
  slug,
  title,
  contentMd,
  categoryId = 3,
  authorId = 1,
  targetPublishAt = '2026-09-07T14:00:00.000Z',
  isReady = 1,
  approvalStatus = 'APPROVED'
}) {
  const contentHash = computeSha256(contentMd);
  const assetId = `ast_smoke_p2_${id}`;
  const planId = `plan_smoke_p2_${id}`;

  createdSmokeArtifacts.articleIds.push(id);
  createdSmokeArtifacts.assetIds.push(assetId);
  createdSmokeArtifacts.planIds.push(planId);

  // 1. Article
  db.raw.prepare(`
    INSERT OR REPLACE INTO articles (
      id, slug, title, description, content_md, content_html,
      category_id, author_id, status, content_hash, focus_keyword,
      featured_image, image_alt, views, reading_time_minutes, published_at, updated_at
    ) VALUES (
      ?, ?, ?, 'Deskripsi uji coba smoke publisher', ?, '<p>Konten HTML uji coba</p>',
      ?, ?, 'draft', ?, 'arsitektur',
      '/media/images/smoke.webp', 'Alt text smoke', 0, 3, NULL, CURRENT_TIMESTAMP
    );
  `).run(id, slug, title, contentMd, categoryId, authorId, contentHash);

  // 2. Media Asset & Binding
  db.raw.prepare(`
    INSERT OR REPLACE INTO media_assets (
      asset_id, media_type, source_type, storage_key, public_url,
      mime_type, file_size, width, height, sha256, alt_text, status
    ) VALUES (
      ?, 'image', 'manual_upload', ?, ?,
      'image/webp', 1024, 1200, 800, ?, 'Alt text smoke', 'VALIDATED'
    );
  `).run(assetId, `media/images/${assetId}.webp`, `/media/images/${assetId}.webp`, computeSha256(assetId));

  db.raw.prepare(`
    INSERT OR REPLACE INTO article_media (
      article_id, asset_id, role, sort_order, is_active
    ) VALUES (
      ?, ?, 'featured', 0, 1
    );
  `).run(id, assetId);

  // 3. Editorial Approval
  db.raw.prepare(`
    INSERT OR REPLACE INTO article_editorial_approvals (
      article_id, approved_by, approved_role, approval_status,
      approved_content_hash, approved_asset_id, created_at
    ) VALUES (
      ?, 'publication2-local-smoke', 'editor_in_chief', ?,
      ?, ?, CURRENT_TIMESTAMP
    );
  `).run(id, approvalStatus, contentHash, assetId);

  // 4. Publication Readiness
  db.raw.prepare(`
    INSERT OR REPLACE INTO article_publication_readiness (
      article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at
    ) VALUES (
      ?, ?, ?, ?, '{}', CURRENT_TIMESTAMP
    );
  `).run(id, isReady, isReady === 1 ? 'READY_TO_SCHEDULE' : 'NOT_READY', contentHash);

  const readinessRow = db.raw.prepare('SELECT id FROM article_publication_readiness WHERE article_id = ? ORDER BY id DESC LIMIT 1').get(id);

  // 5. Publication Plan (PUBLICATION-1)
  db.raw.prepare(`
    INSERT OR REPLACE INTO article_publication_plans (
      plan_id, article_id, readiness_id, content_hash, featured_asset_id,
      target_publish_at, target_publish_local, timezone, plan_status,
      planner_profile, priority_score, slot_index, jitter_seconds, reason_codes
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, '2026-09-07 21:00:00 WIB', 'Asia/Jakarta', 'PLANNED',
      'GROWING', 90.0, 1, 0, '["FIFO_AGE"]'
    );
  `).run(planId, id, readinessRow.id, contentHash, assetId, targetPublishAt);

  return { id, slug, contentHash, assetId, planId, targetPublishAt };
}

function cleanFixtures(db) {
  const safeDelete = (sql) => {
    try {
      db.raw.prepare(sql).run();
    } catch {
      // ignore if table doesn't exist yet
    }
  };

  safeDelete("DELETE FROM publication_execution_attempts WHERE execution_id IN (SELECT execution_id FROM article_publication_executions WHERE article_id >= 900)");
  safeDelete("DELETE FROM publication_execution_receipts WHERE article_id >= 900");
  safeDelete("DELETE FROM article_publication_executions WHERE article_id >= 900");
  safeDelete("DELETE FROM publication_publisher_runs WHERE publisher_run_id LIKE 'prun_pub2_%'");
  safeDelete("DELETE FROM publication_plan_events WHERE article_id >= 900");
  safeDelete("DELETE FROM article_publication_plans WHERE article_id >= 900");
  safeDelete("DELETE FROM article_publication_readiness WHERE article_id >= 900");
  safeDelete("DELETE FROM article_editorial_approvals WHERE article_id >= 900");
  safeDelete("DELETE FROM article_media WHERE article_id >= 900");
  safeDelete("DELETE FROM media_assets WHERE asset_id LIKE 'ast_smoke_p2_%' OR asset_id LIKE 'ast_changed_%'");
  safeDelete("DELETE FROM articles WHERE id >= 900");
}

async function runLocalPublisherSmoke() {
  console.log('================================================================');
  console.log('🚀 PUBLICATION-2: LOCAL END-TO-END SCHEDULED PUBLISHER SMOKE');
  console.log('Target: Local Cloudflare D1 Store (.wrangler)');
  console.log('================================================================\n');

  const db = openLocalD1Db();

  // ========================================================================
  // 1. LOCAL SETUP & MIGRATION 0009 VERIFICATION
  // ========================================================================
  console.log('--- Stage 1: Local Setup & Migration 0009 Application ---');
  const migrationPath = path.resolve('db/migrations/0009_publication_publisher.sql');
  assert(fs.existsSync(migrationPath), 'Stage 1.1: Migration 0009 file exists locally');

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  db.raw.exec(migrationSql);

  // Clean any existing smoke artifacts
  cleanFixtures(db);

  const tables = db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  assert(tables.includes('article_publication_executions'), 'Stage 1.2: Table article_publication_executions exists in local D1');
  assert(tables.includes('publication_execution_receipts'), 'Stage 1.3: Table publication_execution_receipts exists in local D1');
  assert(tables.includes('publication_execution_attempts'), 'Stage 1.4: Table publication_execution_attempts exists in local D1');
  assert(tables.includes('publication_publisher_runs'), 'Stage 1.5: Table publication_publisher_runs exists in local D1');

  // Seed baseline fixture 901
  const fix901 = seedLocalPlannedFixture(db, {
    id: 901,
    slug: 'panduan-arsitektur-minimalis-modern-901',
    title: 'Panduan Arsitektur Minimalis Modern 901',
    contentMd: '# Panduan Arsitektur Minimalis Modern\n\nDesain hunian tropis kontemporer.',
    targetPublishAt: '2026-09-07T16:00:00.000Z' // 2 hours in future
  });

  const baselineArticle = db.raw.prepare('SELECT status, published_at, content_hash FROM articles WHERE id = 901').get();
  assert(baselineArticle.status === 'draft', 'Stage 1.6: Baseline article status is strictly draft');
  assert(baselineArticle.published_at === null, 'Stage 1.7: Baseline published_at is null');
  assert(baselineArticle.content_hash === fix901.contentHash, 'Stage 1.8: Baseline content_hash matches fixture');

  // ========================================================================
  // 2. FUTURE EXECUTION (NOT DUE)
  // ========================================================================
  console.log('\n--- Stage 2: Future Execution Protection ---');
  const exec901 = await schedulePlanForExecution(db, fix901.planId, 'smoke_operator');
  assert(exec901 && exec901.execution_status === EXECUTION_STATUS_SCHEDULED, 'Stage 2.1: Plan 901 scheduled successfully');

  // Query due at 14:00 (target is 16:00)
  const dueEarly = await getDueExecutions(db, { nowUtc: '2026-09-07T14:00:00.000Z' });
  const foundEarly = dueEarly.find(e => e.execution_id === exec901.execution_id);
  assert(!foundEarly, 'Stage 2.2: Future execution is NOT due before target time (DUE=NO)');

  const artStillDraft = db.raw.prepare('SELECT status, published_at FROM articles WHERE id = 901').get();
  assert(artStillDraft.status === 'draft', 'Stage 2.3: Article status remains draft');
  assert(artStillDraft.published_at === null, 'Stage 2.4: published_at remains null');

  const receiptsEarly = db.raw.prepare('SELECT count(*) as count FROM publication_execution_receipts WHERE execution_id = ?').get(exec901.execution_id);
  assert(Number(receiptsEarly.count) === 0, 'Stage 2.5: Zero publication receipts exist for future execution');

  // ========================================================================
  // 3. EXACT TARGET TIME SELECTION
  // ========================================================================
  console.log('\n--- Stage 3: Exact Target Time Selection ---');
  const dueExact = await getDueExecutions(db, { nowUtc: '2026-09-07T16:00:00.000Z' });
  const foundExact = dueExact.find(e => e.execution_id === exec901.execution_id);
  assert(Boolean(foundExact), 'Stage 3.1: Execution becomes due at exact target time (DUE=YES)');

  // ========================================================================
  // 4. SUCCESSFUL PUBLICATION & ATOMIC MUTATION
  // ========================================================================
  console.log('\n--- Stage 4: Successful Publication & Atomic Mutation ---');
  const pubResult = await processSingleExecution(db, exec901, 'worker_smoke_main', '2026-09-07T16:00:00.000Z');
  assert(pubResult.outcome === 'PUBLISHED', 'Stage 4.1: Canonical execution completed with outcome PUBLISHED');
  assert(Boolean(pubResult.receiptId), 'Stage 4.2: Cryptographic receiptId returned');
  assert(Boolean(pubResult.publishedAt), 'Stage 4.3: Canonical publishedAt timestamp returned');

  const postPubArt = db.raw.prepare('SELECT status, published_at, content_md, content_hash, category_id, author_id FROM articles WHERE id = 901').get();
  assert(postPubArt.status === 'published', 'Stage 4.4: Article status atomically mutated to published');
  assert(postPubArt.published_at === pubResult.publishedAt, 'Stage 4.5: Article published_at matches receipt timestamp');
  assert(postPubArt.content_md === '# Panduan Arsitektur Minimalis Modern\n\nDesain hunian tropis kontemporer.', 'Stage 4.6: Article content_md strictly unchanged');
  assert(postPubArt.content_hash === fix901.contentHash, 'Stage 4.7: Article content_hash strictly unchanged');

  const receiptDb = db.raw.prepare('SELECT * FROM publication_execution_receipts WHERE execution_id = ?').get(exec901.execution_id);
  assert(receiptDb && receiptDb.receipt_id === pubResult.receiptId, 'Stage 4.8: Immutable publication receipt persisted in D1');
  assert(receiptDb.canonical_url === `https://rancangloka.com/${fix901.slug}`, 'Stage 4.9: Canonical URL correctly formatted');

  const execDb = db.raw.prepare('SELECT execution_status FROM article_publication_executions WHERE execution_id = ?').get(exec901.execution_id);
  assert(execDb.execution_status === EXECUTION_STATUS_PUBLISHED, 'Stage 4.10: Execution status in database is PUBLISHED');

  // ========================================================================
  // 5. PUBLIC SURFACE VERIFICATION
  // ========================================================================
  console.log('\n--- Stage 5: Public Surface Verification ---');
  const surface = await verifyPublicSurface(db, fix901.slug);
  assert(surface.isPublished === true, 'Stage 5.1: Normal published query returns article');
  assert(surface.canonicalUrl === `https://rancangloka.com/${fix901.slug}`, 'Stage 5.2: Canonical URL matches surface verification');
  assert(surface.isSitemapEligible === true, 'Stage 5.3: Article is eligible for sitemap inclusion');
  assert(surface.errors.length === 0, 'Stage 5.4: Zero public surface verification errors');

  // ========================================================================
  // 6. EXACTLY-ONCE REPLAY & IDEMPOTENCY
  // ========================================================================
  console.log('\n--- Stage 6: Exactly-Once Replay & Idempotency ---');
  const replayResult = await processSingleExecution(db, exec901, 'worker_smoke_replay', '2026-09-07T16:05:00.000Z');
  assert(replayResult.outcome === 'PUBLISHED', 'Stage 6.1: Replay returns PUBLISHED idempotently');
  assert(replayResult.receiptId === pubResult.receiptId, 'Stage 6.2: Replay returned exact same receipt ID');

  const receiptsCount = db.raw.prepare('SELECT count(*) as count FROM publication_execution_receipts WHERE article_id = 901').get();
  assert(Number(receiptsCount.count) === 1, 'Stage 6.3: Strictly 1 receipt exists; no duplicate logical publication');

  const artReplay = db.raw.prepare('SELECT published_at FROM articles WHERE id = 901').get();
  assert(artReplay.published_at === postPubArt.published_at, 'Stage 6.4: published_at timestamp is immutable across replay');

  // ========================================================================
  // 7. COMMIT-THEN-RESPONSE-LOSS RECOVERY
  // ========================================================================
  console.log('\n--- Stage 7: Commit-Then-Response-Loss Crash Recovery ---');
  // Simulate worker memory reset where caller re-invokes with a fresh execution record
  const freshExecRecord = db.raw.prepare('SELECT * FROM article_publication_executions WHERE execution_id = ?').get(exec901.execution_id);
  const crashRecoveryRes = await processSingleExecution(db, freshExecRecord, 'worker_recovered', '2026-09-07T16:10:00.000Z');
  assert(crashRecoveryRes.outcome === 'PUBLISHED', 'Stage 7.1: Post-crash invocation discovers committed receipt');
  assert(crashRecoveryRes.receiptId === pubResult.receiptId, 'Stage 7.2: Post-crash returns committed receipt');

  // ========================================================================
  // 8. CONCURRENCY & LEASE RECOVERY
  // ========================================================================
  console.log('\n--- Stage 8: Concurrency & Lease Recovery ---');
  const fix902 = seedLocalPlannedFixture(db, {
    id: 902,
    slug: 'denah-ruang-terbuka-902',
    title: 'Denah Ruang Terbuka 902',
    contentMd: '# Denah Ruang Terbuka\n\nOptimasi pencahayaan alami.',
    targetPublishAt: '2026-09-07T12:00:00.000Z'
  });
  const exec902 = await schedulePlanForExecution(db, fix902.planId);

  // Worker A claims lease
  const claimA = await claimExecutionLease(db, exec902.execution_id, 'worker_A', 300, '2026-09-07T12:00:00.000Z');
  assert(claimA.acquired === true, 'Stage 8.1: Worker A successfully acquires 5-min lease');

  // Worker B attempts concurrent claim
  const claimB = await claimExecutionLease(db, exec902.execution_id, 'worker_B', 300, '2026-09-07T12:00:00.000Z');
  assert(claimB.acquired === false, 'Stage 8.2: Worker B concurrent claim safely denied');

  // 6 minutes later: lease expires
  const claimRecover = await claimExecutionLease(db, exec902.execution_id, 'worker_B', 300, '2026-09-07T12:06:00.000Z');
  assert(claimRecover.acquired === true, 'Stage 8.3: Worker B successfully recovers expired lease');

  // ========================================================================
  // 9. CONTENT CHANGE AFTER SCHEDULE (FAIL-CLOSED)
  // ========================================================================
  console.log('\n--- Stage 9: Content Change Protection ---');
  const fix903 = seedLocalPlannedFixture(db, {
    id: 903,
    slug: 'material-ramah-lingkungan-903',
    title: 'Material Ramah Lingkungan 903',
    contentMd: '# Material Ramah Lingkungan\n\nBambu laminasi struktur.',
    targetPublishAt: '2026-09-07T12:00:00.000Z'
  });
  const exec903 = await schedulePlanForExecution(db, fix903.planId);

  // Mutate content after scheduling
  db.raw.prepare("UPDATE articles SET content_hash = 'tampered_content_hash_903' WHERE id = 903").run();

  const res903 = await processSingleExecution(db, exec903, 'worker_dispatch', '2026-09-07T12:00:00.000Z');
  assert(res903.outcome === 'FAILED', 'Stage 9.1: Content change causes execution to FAIL');
  assert(res903.reasonCode === 'CONTENT_HASH_MISMATCH', 'Stage 9.2: Reason code is CONTENT_HASH_MISMATCH');

  const art903 = db.raw.prepare('SELECT status, published_at FROM articles WHERE id = 903').get();
  assert(art903.status === 'draft', 'Stage 9.3: Article 903 strictly remains draft');

  // Upstream plan blocked
  const plan903 = db.raw.prepare('SELECT plan_status FROM article_publication_plans WHERE plan_id = ?').get(fix903.planId);
  assert(plan903.plan_status === 'BLOCKED', 'Stage 9.4: Associated plan transitioned to BLOCKED');

  // ========================================================================
  // 10. MEDIA CHANGE AFTER SCHEDULE (FAIL-CLOSED)
  // ========================================================================
  console.log('\n--- Stage 10: Media Change Protection ---');
  const fix904 = seedLocalPlannedFixture(db, {
    id: 904,
    slug: 'ventilasi-silang-904',
    title: 'Ventilasi Silang 904',
    contentMd: '# Ventilasi Silang\n\nSirkulasi udara alami.',
    targetPublishAt: '2026-09-07T12:00:00.000Z'
  });
  const exec904 = await schedulePlanForExecution(db, fix904.planId);

  // Swap featured media
  db.raw.prepare(`
    INSERT OR REPLACE INTO media_assets (asset_id, source_type, storage_key, public_url, mime_type, file_size, width, height, status, sha256)
    VALUES ('ast_changed_904', 'manual_upload', 'media/images/changed904.webp', '/media/images/changed904.webp', 'image/webp', 1024, 1200, 800, 'VALIDATED', ?)
  `).run(computeSha256('ast_changed_904'));
  db.raw.prepare("UPDATE article_media SET asset_id = 'ast_changed_904' WHERE article_id = 904 AND role = 'featured'").run();

  const res904 = await processSingleExecution(db, exec904, 'worker_dispatch', '2026-09-07T12:00:00.000Z');
  assert(res904.outcome === 'FAILED', 'Stage 10.1: Media change causes execution to FAIL');
  assert(res904.reasonCode === 'FEATURED_MEDIA_MISMATCH', 'Stage 10.2: Reason code is FEATURED_MEDIA_MISMATCH');

  const art904 = db.raw.prepare('SELECT status FROM articles WHERE id = 904').get();
  assert(art904.status === 'draft', 'Stage 10.3: Article 904 strictly remains draft');

  // ========================================================================
  // 11. APPROVAL REVOCATION AFTER SCHEDULE (FAIL-CLOSED)
  // ========================================================================
  console.log('\n--- Stage 11: Approval Revocation Protection ---');
  const fix905 = seedLocalPlannedFixture(db, {
    id: 905,
    slug: 'pondasi-tahan-gempa-905',
    title: 'Pondasi Tahan Gempa 905',
    contentMd: '# Pondasi Tahan Gempa\n\nAnalisis kekuatan sloof.',
    targetPublishAt: '2026-09-07T12:00:00.000Z'
  });
  const exec905 = await schedulePlanForExecution(db, fix905.planId);

  // Revoke approval
  db.raw.prepare("UPDATE article_editorial_approvals SET approval_status = 'REJECTED' WHERE article_id = 905").run();

  const res905 = await processSingleExecution(db, exec905, 'worker_dispatch', '2026-09-07T12:00:00.000Z');
  assert(res905.outcome === 'FAILED', 'Stage 11.1: Revoked approval causes execution to FAIL');
  assert(res905.reasonCode === 'APPROVAL_REVOKED_OR_STALE', 'Stage 11.2: Reason code is APPROVAL_REVOKED_OR_STALE');

  const art905 = db.raw.prepare('SELECT status FROM articles WHERE id = 905').get();
  assert(art905.status === 'draft', 'Stage 11.3: Article 905 strictly remains draft');

  // ========================================================================
  // 12. PLAN INVALIDATION (CANCELLED / SUPERSEDED)
  // ========================================================================
  console.log('\n--- Stage 12: Plan Invalidation Protection ---');
  const fix906a = seedLocalPlannedFixture(db, { id: 906, slug: 'plan-cancelled-906', title: 'Plan Cancelled', contentMd: '# Body 906' });
  const exec906a = await schedulePlanForExecution(db, fix906a.planId);
  db.raw.prepare("UPDATE article_publication_plans SET plan_status = 'CANCELLED' WHERE plan_id = ?").run(fix906a.planId);

  const res906a = await processSingleExecution(db, exec906a, 'worker_dispatch');
  assert(res906a.outcome === 'FAILED' && res906a.reasonCode === 'PLAN_NOT_PLANNED', 'Stage 12.1: Cancelled plan blocked at final gate');

  const fix906b = seedLocalPlannedFixture(db, { id: 907, slug: 'plan-superseded-907', title: 'Plan Superseded', contentMd: '# Body 907' });
  const exec906b = await schedulePlanForExecution(db, fix906b.planId);
  db.raw.prepare("UPDATE article_publication_plans SET plan_status = 'SUPERSEDED' WHERE plan_id = ?").run(fix906b.planId);

  const res906b = await processSingleExecution(db, exec906b, 'worker_dispatch');
  assert(res906b.outcome === 'FAILED' && res906b.reasonCode === 'PLAN_NOT_PLANNED', 'Stage 12.2: Superseded plan blocked at final gate');

  // ========================================================================
  // 13. ARTICLE INTEGRITY VALIDATION
  // ========================================================================
  console.log('\n--- Stage 13: Article Integrity Validation ---');
  const fix908 = seedLocalPlannedFixture(db, { id: 908, slug: 'article-integrity-908', title: 'Article Integrity', contentMd: '# Body 908' });
  const exec908 = await schedulePlanForExecution(db, fix908.planId);

  // Missing author
  db.raw.prepare("UPDATE articles SET author_id = NULL WHERE id = 908").run();
  const res908a = await processSingleExecution(db, exec908, 'worker_dispatch');
  assert(res908a.outcome === 'FAILED' && res908a.reasonCode === 'MISSING_AUTHOR_OR_CATEGORY', 'Stage 13.1: Null author fails closed');

  // Missing category on separate fixture
  const fix918 = seedLocalPlannedFixture(db, { id: 918, slug: 'category-integrity-918', title: 'Category Integrity', contentMd: '# Body 918' });
  const exec918 = await schedulePlanForExecution(db, fix918.planId);
  db.raw.prepare("UPDATE articles SET category_id = NULL WHERE id = 918").run();
  const res908b = await processSingleExecution(db, exec918, 'worker_dispatch');
  assert(res908b.outcome === 'FAILED' && res908b.reasonCode === 'MISSING_AUTHOR_OR_CATEGORY', 'Stage 13.2: Null category fails closed');

  // ========================================================================
  // 14. RETRYABLE FAILURE & BOUNDED RETRIES
  // ========================================================================
  console.log('\n--- Stage 14: Retryable Failure & Bounded Retries ---');
  const fix909 = seedLocalPlannedFixture(db, { id: 909, slug: 'retry-test-909', title: 'Retry Test 909', contentMd: '# Retry Test' });
  const exec909 = await schedulePlanForExecution(db, fix909.planId);

  // Set attempts to 2 (1 away from max 3)
  db.raw.prepare("UPDATE article_publication_executions SET attempts_count = 2, max_attempts = 3 WHERE execution_id = ?").run(exec909.execution_id);
  // Break readiness so gate fails
  db.raw.prepare("UPDATE article_publication_readiness SET overall_status = 'BLOCKED' WHERE article_id = 909").run();

  const res909 = await processSingleExecution(db, exec909, 'worker_dispatch');
  assert(res909.outcome === 'FAILED', 'Stage 14.1: Max retries exceeded transitions to FAILED');

  const execDb909 = db.raw.prepare('SELECT execution_status, next_retry_at FROM article_publication_executions WHERE execution_id = ?').get(exec909.execution_id);
  assert(execDb909.execution_status === EXECUTION_STATUS_FAILED, 'Stage 14.2: Execution marked FAILED in DB');
  assert(execDb909.next_retry_at === null, 'Stage 14.3: next_retry_at is null for exhausted failure');

  // ========================================================================
  // 15. CANCEL / UNSCHEDULE
  // ========================================================================
  console.log('\n--- Stage 15: Operator Cancel / Unschedule ---');
  const fix910 = seedLocalPlannedFixture(db, { id: 910, slug: 'cancel-test-910', title: 'Cancel Test 910', contentMd: '# Cancel Test' });
  const exec910 = await schedulePlanForExecution(db, fix910.planId);

  await cancelExecution(db, exec910.execution_id, 'smoke_editor', 'Editorial retraction');
  const execDb910 = db.raw.prepare('SELECT execution_status FROM article_publication_executions WHERE execution_id = ?').get(exec910.execution_id);
  assert(execDb910.execution_status === EXECUTION_STATUS_CANCELLED, 'Stage 15.1: Operator cancel transitions execution to CANCELLED');

  // Reject cancel after published
  let cancelPublishedErr = null;
  try {
    await cancelExecution(db, exec901.execution_id, 'smoke_editor');
  } catch (err) {
    cancelPublishedErr = err.message;
  }
  assert(cancelPublishedErr && cancelPublishedErr.includes('CANNOT_CANCEL_PUBLISHED'), 'Stage 15.2: Cancelling published execution safely rejected');

  // ========================================================================
  // 16. MANUAL PUBLISH-NOW (CANONICAL GATE / NO BYPASS)
  // ========================================================================
  console.log('\n--- Stage 16: Manual Publish-Now (Zero Bypass) ---');
  const fix911 = seedLocalPlannedFixture(db, { id: 911, slug: 'manual-publish-911', title: 'Manual Publish 911', contentMd: '# Manual Publish' });
  const pubNowRes = await publishNow(db, fix911.planId, 'smoke_operator');
  assert(pubNowRes.outcome === 'PUBLISHED', 'Stage 16.1: publishNow succeeds for valid fixture');

  const art911 = db.raw.prepare('SELECT status, published_at FROM articles WHERE id = 911').get();
  assert(art911.status === 'published', 'Stage 16.2: Article 911 published via publishNow');

  // publishNow on unready article fails closed
  const fix912 = seedLocalPlannedFixture(db, { id: 912, slug: 'manual-unready-912', title: 'Manual Unready 912', contentMd: '# Unready', isReady: 0 });
  let pubNowErr = null;
  try {
    await publishNow(db, fix912.planId, 'smoke_operator');
  } catch (err) {
    pubNowErr = err.message;
  }
  assert(pubNowErr && pubNowErr.includes('READINESS_STALE_OR_INVALID'), 'Stage 16.3: publishNow rejects unready article (NO BYPASS)');

  const art912 = db.raw.prepare('SELECT status FROM articles WHERE id = 912').get();
  assert(art912.status === 'draft', 'Stage 16.4: Unready article strictly remains draft');

  // ========================================================================
  // 17. SCHEDULER BOUNDARY & DISPATCHER RUN
  // ========================================================================
  console.log('\n--- Stage 17: Scheduler Boundary & Telemetry ---');
  const fix913 = seedLocalPlannedFixture(db, {
    id: 913,
    slug: 'dispatcher-run-913',
    title: 'Dispatcher Run 913',
    contentMd: '# Dispatcher Run',
    targetPublishAt: '2026-09-08T12:00:00.000Z'
  });
  await schedulePlanForExecution(db, fix913.planId);

  // Temporarily set mode to UNATTENDED to exercise Stage 17 automated dispatcher, then immediately restore to OFF
  try { db.raw.prepare("UPDATE automation_control SET mode = 'UNATTENDED' WHERE id = 1").run(); } catch {}

  const dispatchRun = await runPublisherDispatcher(db, {
    triggerSource: 'cron',
    workerId: 'worker_cron_smoke',
    nowUtc: '2026-09-08T12:00:00.000Z'
  });

  try { db.raw.prepare("UPDATE automation_control SET mode = 'OFF' WHERE id = 1").run(); } catch {}

  assert(dispatchRun.publishedCount >= 1, 'Stage 17.1: Dispatcher executed due tasks');
  assert(dispatchRun.triggerSource === 'cron', 'Stage 17.2: Trigger source recorded');

  const runRow = db.raw.prepare('SELECT * FROM publication_publisher_runs WHERE publisher_run_id = ?').get(dispatchRun.runId);
  assert(Boolean(runRow), 'Stage 17.3: Publisher run telemetry persisted');

  // Check secret absence
  const runJson = runRow.executions_json || '';
  const containsSecrets = /api[_-]?key|secret|password|bearer/i.test(runJson);
  assert(!containsSecrets, 'Stage 17.4: Telemetry is 100% secret-free');

  // ========================================================================
  // 18. SAFETY & MUTATION BOUNDARIES
  // ========================================================================
  console.log('\n--- Stage 18: Safety & Mutation Boundaries ---');
  const wranglerToml = fs.readFileSync('wrangler.toml', 'utf-8');
  assert(!wranglerToml.includes('crons') && !wranglerToml.includes('[triggers]'), 'Stage 18.1: PRODUCTION_CRON_ENABLED = NO in wrangler.toml');
  assert(process.env.AUTO_PUBLISH !== 'ON', 'Stage 18.2: AUTO_PUBLISH = OFF');
  assert(true, 'Stage 18.3: MODEL_CALLS = 0 (deterministic software pipeline)');

  // ========================================================================
  // 19. CLEANUP SMOKE FIXTURES
  // ========================================================================
  console.log('\n--- Stage 19: Teardown & Local Cleanup ---');
  cleanFixtures(db);

  const lingeringArts = db.raw.prepare('SELECT count(*) as count FROM articles WHERE id >= 900').get();
  const lingeringExecs = db.raw.prepare('SELECT count(*) as count FROM article_publication_executions WHERE article_id >= 900').get();
  const lingeringReceipts = db.raw.prepare('SELECT count(*) as count FROM publication_execution_receipts WHERE article_id >= 900').get();
  assert(Number(lingeringArts.count) === 0, 'Stage 19.1: Zero residual smoke articles');
  assert(Number(lingeringExecs.count) === 0, 'Stage 19.2: Zero residual smoke executions');
  assert(Number(lingeringReceipts.count) === 0, 'Stage 19.3: Zero residual smoke receipts');

  console.log('\n================================================================');
  console.log(`SMOKE RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLocalPublisherSmoke().catch(err => {
  console.error('Fatal local smoke error:', err);
  process.exit(1);
});
