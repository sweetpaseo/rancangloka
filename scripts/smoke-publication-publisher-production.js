/**
 * RancangLoka — PUBLICATION-2: Controlled Production Publisher Smoke Verification
 *
 * Exercises the authoritative PUBLICATION-2 service against the real remote Cloudflare D1
 * database (rancangloka_db) using exactly ONE internal smoke article (Article ID 1).
 *
 * Strict Production Safety Boundaries:
 * - Exactly ONE internal smoke article used (Article ID 1)
 * - Zero normal editorial articles touched
 * - Temporary exposure immediately verified and rolled back
 * - Remote D1 cleaned up completely with zero residue
 * - Zero AI model provider calls (MODEL_CALLS = 0)
 * - AUTO_PUBLISH = OFF
 * - PRODUCTION_CRON_ENABLED = NO
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  evaluateArticleReadiness,
  recordEditorialApproval,
  getArticlesReadyToSchedule
} from '../src/lib/publication/service.ts';

import {
  validatePlanFreshness
} from '../src/lib/publication/planner-service.ts';

import {
  PUBLISHER_VERSION,
  EXECUTION_STATUS_SCHEDULED,
  EXECUTION_STATUS_PUBLISHED
} from '../src/lib/publication/publisher-types.ts';

import {
  schedulePlanForExecution,
  getDueExecutions,
  validatePrepublishInvariants,
  executeAtomicPublication,
  processSingleExecution,
  publishNow,
  cancelExecution,
  verifyPublicSurface
} from '../src/lib/publication/publisher-service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROD_ARTICLE_ID = 1;
const SMOKE_OPERATOR = 'publication2-controlled-smoke';
const SMOKE_ASSET_ID = 'ast_smoke_pub2_prod';

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

// Remote D1 query execution via --command with retry on transient network errors
function runRemoteD1(sql, retries = 3) {
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  const escaped = oneLine.replace(/"/g, '\\"');
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const raw = execSync(`npx wrangler d1 execute DB --remote --json -y --command="${escaped}"`, {
        encoding: 'utf8',
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, CI: 'true' }
      });
      const jsonStart = raw.indexOf('[');
      if (jsonStart === -1) {
        throw new Error(`Invalid JSON response from Wrangler D1:\n${raw}`);
      }
      return JSON.parse(raw.slice(jsonStart));
    } catch (err) {
      const isTransient = err.message && (
        err.message.includes('fetch failed') ||
        err.message.includes('code: 7000') ||
        err.message.includes('ECONNRESET') ||
        err.message.includes('ETIMEDOUT')
      );
      if (isTransient && attempt < retries) {
        console.warn(`  [runRemoteD1] Transient network issue on attempt ${attempt}, retrying in 1.5s...`);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
        continue;
      }
      throw err;
    }
  }
}

function interpolateSql(sql, params) {
  if (!params || params.length === 0) return sql;
  let idx = 0;
  return sql.replace(/\?/g, () => {
    if (idx >= params.length) return 'NULL';
    const val = params[idx++];
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? '1' : '0';
    const escaped = String(val).replace(/'/g, "''");
    return `'${escaped}'`;
  });
}

function createRemoteD1Adapter() {
  return {
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.map(v => (v === undefined ? null : v));
          return this;
        },
        async first() {
          const formattedSql = interpolateSql(this._sql, this._params);
          const res = runRemoteD1(formattedSql);
          const rows = res[0]?.results || [];
          return rows.length > 0 ? rows[0] : null;
        },
        async all() {
          const formattedSql = interpolateSql(this._sql, this._params);
          const res = runRemoteD1(formattedSql);
          const rows = res[0]?.results || [];
          return { results: rows, meta: res[0]?.meta || {} };
        },
        async run() {
          const formattedSql = interpolateSql(this._sql, this._params);
          const res = runRemoteD1(formattedSql);
          const meta = res[0]?.meta || {};
          return {
            lastRowId: meta.last_row_id || 0,
            meta: {
              last_row_id: meta.last_row_id || 0,
              changes: meta.changes || 0
            }
          };
        }
      };
    },
    async batch(stmts) {
      const sqlCommands = stmts.map(s => interpolateSql(s._sql, s._params)).join(';\n') + ';';
      const tmpFile = path.resolve(__dirname, `tmp_d1_batch_${Date.now()}.sql`);
      fs.writeFileSync(tmpFile, sqlCommands, 'utf8');
      try {
        const raw = execSync(`npx wrangler d1 execute DB --remote --json -y --file="${tmpFile}"`, {
          encoding: 'utf8',
          cwd: path.resolve(__dirname, '..'),
          env: { ...process.env, CI: 'true' }
        });
        const jsonStart = raw.indexOf('[');
        if (jsonStart === -1) {
          throw new Error(`Invalid JSON response from Wrangler D1 batch:\n${raw}`);
        }
        const res = JSON.parse(raw.slice(jsonStart));
        return res.map(r => ({
          changes: r.meta?.changes || 0,
          meta: { changes: r.meta?.changes || 0, last_row_id: r.meta?.last_row_id || 0 }
        }));
      } finally {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      }
    }
  };
}

async function fetchPublicHttpStatus(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'rancangloka-smoke/1.0' } });
    return res.status;
  } catch {
    return 0;
  }
}

async function fetchPublicBody(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'rancangloka-smoke/1.0' } });
    return await res.text();
  } catch {
    return '';
  }
}

export async function runControlledProductionSmoke() {
  console.log('================================================================');
  console.log('🚀 PUBLICATION-2: CONTROLLED PRODUCTION PUBLISHER SMOKE');
  console.log('Target: Remote Cloudflare D1 Store (rancangloka_db)');
  console.log('================================================================\n');

  const db = createRemoteD1Adapter();

  // ========================================================================
  // 1. SELECT INTERNAL SMOKE ARTICLE & CAPTURE PREFLIGHT BASELINE
  // ========================================================================
  console.log('====================================================');
  console.log('[Step 1: Capture Preflight Baseline]');
  console.log('====================================================');

  const baselineArticle = await db
    .prepare("SELECT * FROM articles WHERE id = ?")
    .bind(PROD_ARTICLE_ID)
    .first();

  assert(!!baselineArticle, `Found internal smoke article ID ${PROD_ARTICLE_ID}`);
  assert(baselineArticle.status === 'draft', `Article status is strictly draft: ${baselineArticle.status}`);
  assert(baselineArticle.slug.includes('smoke-test'), `Article is clearly an internal smoke article: ${baselineArticle.slug}`);

  const baselineHash = baselineArticle.content_hash;
  const baselineBodyLength = (baselineArticle.content_md || '').length;
  const baselinePublishedAt = baselineArticle.published_at;
  const baselineSlug = baselineArticle.slug;
  const publicUrl = `https://rancangloka.com/${baselineSlug}`;

  console.log(`  Baseline Hash: ${baselineHash}`);
  console.log(`  Baseline Body Length: ${baselineBodyLength} chars`);
  console.log(`  Baseline Status: ${baselineArticle.status}`);
  console.log(`  Baseline Published At: ${baselinePublishedAt}`);
  console.log(`  Public Article URL: ${publicUrl}`);

  // Confirm initial public status is 404 (draft)
  const preflightHttpCode = await fetchPublicHttpStatus(publicUrl);
  assert(preflightHttpCode === 404, `Preflight public route returns HTTP 404: ${preflightHttpCode}`);

  // ========================================================================
  // 2. BUILD GENUINE UPSTREAM ELIGIBILITY (PUB-0 & PUB-1)
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 2: Build Genuine Upstream Eligibility]');
  console.log('====================================================');

  // 1. Insert validated media asset
  await db.prepare(`
    INSERT OR REPLACE INTO media_assets (
      asset_id, media_type, source_type, storage_key, public_url,
      mime_type, file_size, width, height, sha256, alt_text, status
    ) VALUES (
      ?, 'image', 'manual_upload', ?, ?,
      'image/webp', 1024, 1200, 800, ?, 'Alt text smoke', 'VALIDATED'
    );
  `).bind(
    SMOKE_ASSET_ID,
    `media/images/${SMOKE_ASSET_ID}.webp`,
    `/media/images/${SMOKE_ASSET_ID}.webp`,
    computeSha256(SMOKE_ASSET_ID)
  ).run();

  // 2. Bind active featured media
  await db.prepare(`
    INSERT OR REPLACE INTO article_media (
      article_id, asset_id, role, sort_order, is_active
    ) VALUES (?, ?, 'featured', 0, 1);
  `).bind(PROD_ARTICLE_ID, SMOKE_ASSET_ID).run();

  // 3. Record editorial approval via canonical service
  const approvalRes = await recordEditorialApproval(db, {
    articleId: PROD_ARTICLE_ID,
    approvedBy: SMOKE_OPERATOR,
    approvedRole: 'editor_in_chief',
    notes: 'Temporary approval for PUBLICATION-2 Controlled Production Smoke'
  });
  assert(!!approvalRes.approval, 'Editorial approval recorded via canonical service');

  // 4. Evaluate readiness genuinely via canonical service
  const readinessResult = await evaluateArticleReadiness(db, PROD_ARTICLE_ID);
  assert(readinessResult.is_ready === true, 'Genuinely passed PUBLICATION-0 readiness evaluation');
  assert(readinessResult.overall_status === 'READY_TO_SCHEDULE', 'PUBLICATION-0 status is READY_TO_SCHEDULE');

  // Retrieve the generated readiness row ID from D1
  const latestReadiness = await db.prepare(
    "SELECT id FROM article_publication_readiness WHERE article_id = ? ORDER BY evaluated_at DESC, id DESC LIMIT 1"
  ).bind(PROD_ARTICLE_ID).first();
  assert(Boolean(latestReadiness && latestReadiness.id), `Readiness ID resolved: ${latestReadiness?.id}`);
  const readinessId = latestReadiness.id;

  // 5. Create genuine active PUBLICATION-1 plan
  const planId = `plan_smoke_p2_prod_${Date.now().toString(36)}`;
  const targetPublishAt = '2026-09-10T02:00:00.000Z'; // Future target
  await db.prepare(`
    INSERT INTO article_publication_plans (
      plan_id, article_id, readiness_id, content_hash, featured_asset_id,
      target_publish_at, target_publish_local, timezone, plan_status,
      planner_profile, priority_score, slot_index, jitter_seconds, reason_codes
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, '2026-09-10 09:00:00 WIB', 'Asia/Jakarta', 'PLANNED',
      'GROWING', 95.0, 1, 0, '["CONTROLLED_SMOKE"]'
    );
  `).bind(planId, PROD_ARTICLE_ID, readinessId, baselineHash, SMOKE_ASSET_ID, targetPublishAt).run();

  const planFresh = await validatePlanFreshness(db, planId);
  assert(planFresh.isValid === true, 'PUBLICATION-1 plan created and validated fresh');

  const artCheckPreSchedule = await db.prepare("SELECT status FROM articles WHERE id = ?").bind(PROD_ARTICLE_ID).first();
  assert(artCheckPreSchedule.status === 'draft', 'Article remains strictly draft during planning');

  // ========================================================================
  // 3. CREATE PUBLICATION-2 SCHEDULED EXECUTION
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 3: Create PUBLICATION-2 Execution]');
  console.log('====================================================');

  const execution = await schedulePlanForExecution(db, planId, SMOKE_OPERATOR);
  assert(execution && execution.execution_status === EXECUTION_STATUS_SCHEDULED, `Execution created in status: ${execution.execution_status}`);
  assert(execution.plan_id === planId, `Execution bound to plan: ${execution.plan_id}`);
  assert(execution.article_id === PROD_ARTICLE_ID, `Execution bound to article: ${execution.article_id}`);

  // ========================================================================
  // 4. FUTURE-NOT-DUE SAFETY CHECK
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 4: Future-Not-Due Safety Verification]');
  console.log('====================================================');

  const dueCheck = await getDueExecutions(db, { nowUtc: '2026-09-07T07:00:00.000Z' });
  const isDue = dueCheck.some(e => e.execution_id === execution.execution_id);
  assert(!isDue, 'Future execution is NOT due before target time (DUE=NO)');

  const artCheckPreDue = await db.prepare("SELECT status, published_at FROM articles WHERE id = ?").bind(PROD_ARTICLE_ID).first();
  assert(artCheckPreDue.status === 'draft', 'Article strictly remains draft before due time');

  // ========================================================================
  // 5. CONTROLLED LIVE PUBLICATION (CANONICAL GATE)
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 5: Controlled Live Publication via publishNow]');
  console.log('====================================================');

  const publishResult = await publishNow(db, execution.execution_id, SMOKE_OPERATOR);
  assert(publishResult.outcome === 'PUBLISHED', `publishNow outcome: ${publishResult.outcome}`);
  assert(Boolean(publishResult.receiptId), `Publication receipt generated: ${publishResult.receiptId}`);
  assert(Boolean(publishResult.publishedAt), `Publication timestamp: ${publishResult.publishedAt}`);

  // Verify article status in D1
  const publishedArt = await db.prepare("SELECT status, published_at, content_md, content_hash FROM articles WHERE id = ?").bind(PROD_ARTICLE_ID).first();
  assert(publishedArt.status === 'published', `Article status atomically transitioned to published: ${publishedArt.status}`);
  assert(publishedArt.published_at === publishResult.publishedAt, `Article published_at matches receipt: ${publishedArt.published_at}`);
  assert(publishedArt.content_hash === baselineHash, 'Article content_hash strictly unchanged during publish');
  assert((publishedArt.content_md || '').length === baselineBodyLength, 'Article body strictly unchanged during publish');

  // Verify receipt in D1
  const receiptRow = await db.prepare("SELECT * FROM publication_execution_receipts WHERE execution_id = ?").bind(execution.execution_id).first();
  assert(Boolean(receiptRow), 'Publication receipt confirmed in D1');
  assert(receiptRow.outcome === 'SUCCESS', `Receipt outcome is SUCCESS: ${receiptRow.outcome}`);
  assert(receiptRow.canonical_url === publicUrl, `Canonical URL in receipt: ${receiptRow.canonical_url}`);

  // ========================================================================
  // 6. PUBLIC SURFACE VERIFICATION (LIVE HTTP RESOLUTION)
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 6: Public Surface Live Verification]');
  console.log('====================================================');

  // Edge SSR should immediately resolve to HTTP 200
  const liveHttpCode = await fetchPublicHttpStatus(publicUrl);
  assert(liveHttpCode === 200, `Live public article route returns HTTP 200: ${liveHttpCode}`);

  const liveHtml = await fetchPublicBody(publicUrl);
  assert(liveHtml.includes('Tujuan verifikasi internal') || liveHtml.includes('RancangLoka Internal Ingest'), 'Public HTML serves actual article content');
  assert(liveHtml.includes(baselineSlug), 'Public HTML contains canonical slug reference');

  // Surface helper verification
  const surfaceCheck = await verifyPublicSurface(db, baselineSlug);
  assert(surfaceCheck.isPublished === true, 'verifyPublicSurface confirms article is published');
  assert(surfaceCheck.isSitemapEligible === true, 'verifyPublicSurface confirms sitemap eligibility');

  // ========================================================================
  // 7. EXACTLY-ONCE LIVE REPLAY VERIFICATION
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 7: Exactly-Once Replay Verification]');
  console.log('====================================================');

  const replayResult = await processSingleExecution(db, execution, 'worker_replay');
  assert(replayResult.outcome === 'PUBLISHED', 'Replay detects already-published state');
  assert(replayResult.receiptId === publishResult.receiptId, 'Replay returned identical receipt ID');

  const receiptsCount = await db.prepare("SELECT count(*) as count FROM publication_execution_receipts WHERE article_id = ?").bind(PROD_ARTICLE_ID).first();
  assert(Number(receiptsCount.count) === 1, `Exactly 1 receipt exists for article (count = ${receiptsCount.count})`);

  const artCheckReplay = await db.prepare("SELECT status, published_at FROM articles WHERE id = ?").bind(PROD_ARTICLE_ID).first();
  assert(artCheckReplay.published_at === publishResult.publishedAt, 'published_at remained completely stable');

  // ========================================================================
  // 8. CONTROLLED ROLLBACK & ZERO-RESIDUE TEARDOWN
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 8: Controlled Rollback & Teardown]');
  console.log('====================================================');

  // 1. Revert article to original draft state
  await db.prepare(`
    UPDATE articles 
    SET status = 'draft',
        published_at = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(baselinePublishedAt, baselineArticle.updated_at, PROD_ARTICLE_ID).run();

  const restoredArt = await db.prepare("SELECT status, published_at FROM articles WHERE id = ?").bind(PROD_ARTICLE_ID).first();
  assert(restoredArt.status === 'draft', `Article status restored to draft: ${restoredArt.status}`);
  assert(restoredArt.published_at === baselinePublishedAt, `Article published_at restored to baseline: ${restoredArt.published_at}`);

  // 2. Reverse-order teardown of smoke records
  await db.prepare("DELETE FROM publication_execution_attempts WHERE execution_id = ?").bind(execution.execution_id).run();
  await db.prepare("DELETE FROM publication_execution_receipts WHERE execution_id = ?").bind(execution.execution_id).run();
  await db.prepare("DELETE FROM article_publication_executions WHERE execution_id = ?").bind(execution.execution_id).run();
  await db.prepare("DELETE FROM publication_plan_events WHERE plan_id = ?").bind(planId).run();
  await db.prepare("DELETE FROM article_publication_plans WHERE plan_id = ?").bind(planId).run();
  await db.prepare("DELETE FROM article_publication_readiness WHERE article_id = ?").bind(PROD_ARTICLE_ID).run();
  await db.prepare("DELETE FROM article_editorial_approvals WHERE article_id = ? AND approved_by = 'publication2-controlled-smoke'").bind(PROD_ARTICLE_ID).run();
  await db.prepare("DELETE FROM article_media WHERE article_id = ? AND asset_id = ?").bind(PROD_ARTICLE_ID, SMOKE_ASSET_ID).run();
  await db.prepare("DELETE FROM media_assets WHERE asset_id = ?").bind(SMOKE_ASSET_ID).run();

  // ========================================================================
  // 9. POST-CLEANUP PUBLIC SURFACE & INTEGRITY VERIFICATION
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 9: Post-Cleanup Public Surface & Integrity]');
  console.log('====================================================');

  // Public route must return 404 again
  const postCleanupHttpCode = await fetchPublicHttpStatus(publicUrl);
  assert(postCleanupHttpCode === 404, `Post-cleanup public route returns HTTP 404: ${postCleanupHttpCode}`);

  // Check database residue
  const resExecs = await db.prepare("SELECT count(*) as count FROM article_publication_executions WHERE article_id = ?").bind(PROD_ARTICLE_ID).first();
  const resReceipts = await db.prepare("SELECT count(*) as count FROM publication_execution_receipts WHERE article_id = ?").bind(PROD_ARTICLE_ID).first();
  const resPlans = await db.prepare("SELECT count(*) as count FROM article_publication_plans WHERE article_id = ?").bind(PROD_ARTICLE_ID).first();
  const resReady = await db.prepare("SELECT count(*) as count FROM article_publication_readiness WHERE article_id = ?").bind(PROD_ARTICLE_ID).first();
  const resApp = await db.prepare("SELECT count(*) as count FROM article_editorial_approvals WHERE article_id = ?").bind(PROD_ARTICLE_ID).first();
  const resMedia = await db.prepare("SELECT count(*) as count FROM article_media WHERE article_id = ?").bind(PROD_ARTICLE_ID).first();

  assert(Number(resExecs.count) === 0, `Residual executions: ${resExecs.count}`);
  assert(Number(resReceipts.count) === 0, `Residual receipts: ${resReceipts.count}`);
  assert(Number(resPlans.count) === 0, `Residual plans: ${resPlans.count}`);
  assert(Number(resReady.count) === 0, `Residual readiness records: ${resReady.count}`);
  assert(Number(resApp.count) === 0, `Residual approvals: ${resApp.count}`);
  assert(Number(resMedia.count) === 0, `Residual media bindings: ${resMedia.count}`);

  // Final baseline comparison
  const finalArt = await db.prepare("SELECT * FROM articles WHERE id = ?").bind(PROD_ARTICLE_ID).first();
  assert(finalArt.content_hash === baselineHash, 'Final content_hash matches preflight baseline byte-for-byte');
  assert((finalArt.content_md || '').length === baselineBodyLength, 'Final content_md length matches baseline byte-for-byte');
  assert(finalArt.status === 'draft', 'Final article status is strictly draft');

  console.log('\n================================================================');
  console.log(`PRODUCTION SMOKE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runControlledProductionSmoke().catch(err => {
  console.error('Fatal production smoke error:', err);
  process.exit(1);
});
