/**
 * RancangLoka — PUBLICATION-1: Controlled Production Planner Smoke Verification
 *
 * Runs against the actual remote Cloudflare D1 database:
 * DB: rancangloka_db (3a86e9ad-410f-4440-884e-2eb813ec4cf7)
 *
 * Strict Production Safety Boundaries:
 * - NO public publishing
 * - NO schedule execution
 * - NO modification to article body / content_hash
 * - NO modification to normal editorial articles
 * - ZERO AI model provider calls (MODEL_CALLS = 0)
 * - AUTO_PUBLISH = OFF
 */

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
  PLANNER_PROFILE_GROWING,
  PLANNER_VERSION,
  CANONICAL_TIMEZONE,
  PLAN_STATUS_PLANNED,
  PLAN_STATUS_CANCELLED
} from '../src/lib/publication/planner-types.ts';

import {
  DEFAULT_PROFILES,
  calculateEffectiveCapacity
} from '../src/lib/publication/planner-engine.ts';

import {
  getEligibleReadyCandidates,
  executePublicationPlanner,
  validatePlanFreshness,
  cancelPlan,
  getActivePlans
} from '../src/lib/publication/planner-service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROD_ARTICLE_ID = 1;
const SMOKE_OPERATOR = 'publication1-controlled-smoke';
const SMOKE_ASSET_ID = 'ast_smoke_pub1_prod';

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

// Remote D1 query execution via --command to return actual datasets with retry on transient network errors
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
    }
  };
}

export async function runControlledProductionSmoke() {
  console.log('================================================================');
  console.log('🚀 PUBLICATION-1: CONTROLLED PRODUCTION PLANNER SMOKE');
  console.log('Target: Remote Cloudflare D1 Store (rancangloka_db)');
  console.log('================================================================\n');

  const db = createRemoteD1Adapter();

  // ========================================================================
  // 1. SELECT INTERNAL SMOKE ARTICLE & CAPTURE PREFLIGHT BASELINE
  // ========================================================================
  console.log('====================================================');
  console.log('[Step 1: Select Internal Smoke Article & Capture Baseline]');
  console.log('====================================================');

  const baselineArticle = await db
    .prepare("SELECT id, slug, title, status, content_md, content_hash, published_at FROM articles WHERE id = ?")
    .bind(PROD_ARTICLE_ID)
    .first();

  assert(!!baselineArticle, `Found internal smoke article ID ${PROD_ARTICLE_ID}`);
  assert(baselineArticle.status === 'draft', `Article status is strictly draft: ${baselineArticle.status}`);
  assert(baselineArticle.slug.includes('smoke-test'), `Article is clearly an internal smoke article: ${baselineArticle.slug}`);

  const baselineHash = baselineArticle.content_hash;
  const baselineBodyLength = (baselineArticle.content_md || '').length;
  const baselinePublishedAt = baselineArticle.published_at;

  console.log(`  Baseline Hash: ${baselineHash}`);
  console.log(`  Baseline Body Length: ${baselineBodyLength} chars`);
  console.log(`  Baseline Status: ${baselineArticle.status}`);

  // Confirm preflight readiness is currently 0 (clean state)
  const preReadiness = await db
    .prepare("SELECT count(*) as count FROM article_publication_readiness WHERE article_id = ?")
    .bind(PROD_ARTICLE_ID)
    .first();
  const preApprovals = await db
    .prepare("SELECT count(*) as count FROM article_editorial_approvals WHERE article_id = ?")
    .bind(PROD_ARTICLE_ID)
    .first();
  const preMedia = await db
    .prepare("SELECT count(*) as count FROM article_media WHERE article_id = ?")
    .bind(PROD_ARTICLE_ID)
    .first();

  console.log(`  Preflight Readiness Records: ${preReadiness?.count || 0}`);
  console.log(`  Preflight Approval Records: ${preApprovals?.count || 0}`);
  console.log(`  Preflight Media Bindings: ${preMedia?.count || 0}`);

  // ========================================================================
  // 2. CREATE TEMPORARY PUBLICATION-0 FIXTURE VIA CANONICAL PIPELINE
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 2: Create Temporary PUBLICATION-0 Fixture]');
  console.log('====================================================');

  // A. Create temporary validated media asset
  await db
    .prepare(`
      INSERT OR REPLACE INTO media_assets (
        asset_id, media_type, source_type, storage_key, public_url,
        mime_type, file_size, width, height, sha256, alt_text, status
      ) VALUES (
        ?, 'image', 'manual_upload', ?, ?,
        'image/webp', 2048, 1200, 675, ?, 'Production Smoke Alt Text', 'VALIDATED'
      );
    `)
    .bind(
      SMOKE_ASSET_ID,
      `media/images/${SMOKE_ASSET_ID}.webp`,
      `/media/images/${SMOKE_ASSET_ID}.webp`,
      computeSha256(SMOKE_ASSET_ID)
    )
    .run();

  // B. Create active featured article_media binding
  await db
    .prepare(`
      INSERT OR REPLACE INTO article_media (
        article_id, asset_id, role, is_active
      ) VALUES (?, ?, 'featured', 1);
    `)
    .bind(PROD_ARTICLE_ID, SMOKE_ASSET_ID)
    .run();

  // C. Record human editorial approval via canonical service
  const approvalRes = await recordEditorialApproval(db, {
    articleId: PROD_ARTICLE_ID,
    approvedBy: SMOKE_OPERATOR,
    approvedRole: 'editor_in_chief',
    notes: 'Temporary approval for PUBLICATION-1 Controlled Production Smoke'
  });
  assert(!!approvalRes.approval, 'Editorial approval recorded via canonical service');

  // D. Evaluate readiness via canonical service
  const readinessRes = await evaluateArticleReadiness(db, PROD_ARTICLE_ID);
  assert(readinessRes.is_ready === true, 'PUBLICATION-0 readiness evaluation genuinely evaluated is_ready = true');
  assert(readinessRes.overall_status === 'READY_TO_SCHEDULE', 'PUBLICATION-0 status is READY_TO_SCHEDULE');
  assert(readinessRes.blockers.length === 0, 'Zero blockers present');
  assert(readinessRes.checks.visual_media === 'PASS', 'Visual media check passed');
  assert(readinessRes.checks.human_approval === 'PASS', 'Human approval check passed');

  // ========================================================================
  // 3. PUBLICATION-1 PREFLIGHT CANDIDATE QUERY
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 3: PUBLICATION-1 Preflight Candidate Query]');
  console.log('====================================================');

  const eligibleCandidates = await getEligibleReadyCandidates(db);
  assert(eligibleCandidates.length === 1, `Exactly 1 candidate eligible for planning (got ${eligibleCandidates.length})`);
  assert(eligibleCandidates[0].articleId === PROD_ARTICLE_ID, `Eligible candidate is strictly smoke article ${PROD_ARTICLE_ID}`);
  assert(eligibleCandidates[0].contentHash === baselineHash, 'Eligible candidate content_hash matches preflight baseline');

  // Confirm normal editorial article 4 is strictly excluded
  const candidateIds = eligibleCandidates.map(c => c.articleId);
  assert(!candidateIds.includes(4), 'Normal editorial article 4 strictly excluded from eligible inventory');

  // ========================================================================
  // 4. MIGRATION 0008 & PLANNER DEPLOYMENT VERIFICATION
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 4: Migration 0008 & Schema Verification]');
  console.log('====================================================');

  // Verify all 3 planner tables exist in remote D1
  const tablesCheck = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('article_publication_plans', 'publication_planner_runs', 'publication_plan_events')")
    .all();
  assert(tablesCheck.results.length === 3, 'All 3 planner tables verified in production D1');

  const idxCheck = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name = 'uq_active_plan_per_article'")
    .all();
  assert(idxCheck.results.length === 1, 'Partial unique index uq_active_plan_per_article verified in production D1');

  // Verify deployed endpoint reachability
  const endpointRes = await fetch('https://rancangloka.chandrajoyko.workers.dev/api/admin/publication/plans');
  assert(endpointRes.status === 401, 'Production planner API endpoint is live and protected (HTTP 401)');

  // ========================================================================
  // 5. CONTROLLED PLANNER RUN
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 5: Controlled Planner Run]');
  console.log('====================================================');

  const targetDate = '2026-09-10';
  const planRun1 = await executePublicationPlanner(db, {
    targetDate,
    profile: PLANNER_PROFILE_GROWING,
    actor: SMOKE_OPERATOR
  });

  assert(planRun1.plannedCount === 1, `Exactly 1 article planned (got ${planRun1.plannedCount})`);
  assert(planRun1.deferredCount === 0, 'Zero articles deferred');
  assert(planRun1.plans.length === 1, 'Planner execution result contains exactly 1 plan');

  const createdPlan = planRun1.plans[0];
  assert(createdPlan.candidate.articleId === PROD_ARTICLE_ID, `Plan created for article ${PROD_ARTICLE_ID}`);
  assert(createdPlan.timezone === CANONICAL_TIMEZONE, `Plan timezone is ${CANONICAL_TIMEZONE}`);
  assert(createdPlan.targetPublishLocal.includes('WIB'), `Timestamp formatted in WIB: ${createdPlan.targetPublishLocal}`);
  assert(createdPlan.reasonCodes.length > 0, `Reason codes recorded: ${createdPlan.reasonCodes.join(', ')}`);

  // Verify plan record in remote D1 table
  const activePlansInDb = await getActivePlans(db, { dateStr: targetDate });
  assert(activePlansInDb.length === 1, `Exactly 1 active plan in database for target date (got ${activePlansInDb.length})`);
  assert(activePlansInDb[0].plan_status === PLAN_STATUS_PLANNED, `Plan status is PLANNED`);
  assert(activePlansInDb[0].article_id === PROD_ARTICLE_ID, `Active plan belongs to article ${PROD_ARTICLE_ID}`);

  // Confirm NO invalid CMS state changes occurred
  const artCheck = await db.prepare("SELECT status, published_at FROM articles WHERE id = ?").bind(PROD_ARTICLE_ID).first();
  assert(artCheck.status === 'draft', 'Article status strictly remains draft (no publish or CMS schedule)');
  assert(artCheck.published_at === baselinePublishedAt, 'Article published_at remains unchanged');

  // ========================================================================
  // 6. IDEMPOTENCY VERIFICATION
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 6: Idempotency Verification]');
  console.log('====================================================');

  const planRun2 = await executePublicationPlanner(db, {
    targetDate,
    profile: PLANNER_PROFILE_GROWING,
    actor: SMOKE_OPERATOR
  });

  // Second run should recognize existing active plan and produce no duplicates
  const activePlansAfterRun2 = await getActivePlans(db, { dateStr: targetDate });
  assert(activePlansAfterRun2.length === 1, 'Repeated planner run produced zero duplicate active plans');
  assert(activePlansAfterRun2[0].plan_id === activePlansInDb[0].plan_id, 'Plan ID preserved across repeated run');
  assert(activePlansAfterRun2[0].target_publish_at === activePlansInDb[0].target_publish_at, 'Target publication timestamp strictly identical');

  // Verify database constraint blocks duplicate active plan
  let dupInsertFailed = false;
  try {
    await db.prepare(`
      INSERT INTO article_publication_plans (
        plan_id, article_id, readiness_id, content_hash, featured_asset_id,
        target_publish_at, target_publish_local, timezone, plan_status,
        planner_profile, planner_version, priority_score, slot_index,
        jitter_seconds, reason_codes
      ) VALUES (
        'plan_dup_prod_test', ?, 1, ?, ?,
        '2026-09-10 10:00:00', '2026-09-10 17:00:00 WIB',
        'Asia/Jakarta', 'PLANNED', 'GROWING', '1.0.0', 50, 1, 0, '[]'
      );
    `).bind(PROD_ARTICLE_ID, baselineHash, SMOKE_ASSET_ID).run();
  } catch (err) {
    dupInsertFailed = true;
  }
  assert(dupInsertFailed, 'Database partial unique index uq_active_plan_per_article actively blocked duplicate active plan');

  // ========================================================================
  // 7. CONSERVATIVE CAPACITY VERIFICATION
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 7: Conservative Capacity Verification]');
  console.log('====================================================');

  const capCalc = calculateEffectiveCapacity(DEFAULT_PROFILES[PLANNER_PROFILE_GROWING], undefined, 1);
  assert(capCalc.effectiveCapacity === 1, 'Quality dominates quota: 1 ready article results in 1 planned');
  assert(DEFAULT_PROFILES[PLANNER_PROFILE_GROWING].maxCeiling === 20, '20 is ceiling only for GROWING profile, not universal quota');

  // ========================================================================
  // 8. HUMAN PLAN CONTROL (CANCEL PLAN)
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 8: Human Editorial Plan Control]');
  console.log('====================================================');

  const planToCancel = activePlansInDb[0];
  await cancelPlan(db, planToCancel.plan_id, SMOKE_OPERATOR, 'Controlled production smoke cancellation');

  const cancelledRow = await db
    .prepare("SELECT plan_status FROM article_publication_plans WHERE plan_id = ?")
    .bind(planToCancel.plan_id)
    .first();
  assert(cancelledRow.plan_status === PLAN_STATUS_CANCELLED, 'Database confirmed plan status CANCELLED');

  const cancelEvent = await db
    .prepare("SELECT event_type, actor_id FROM publication_plan_events WHERE plan_id = ? AND event_type = 'CANCELLED'")
    .bind(planToCancel.plan_id)
    .first();
  assert(!!cancelEvent, 'Audit event CANCELLED recorded in publication_plan_events');

  // Verify zero active plans remain for the date
  const activeRemaining = await getActivePlans(db, { dateStr: targetDate });
  assert(activeRemaining.length === 0, 'Zero active plans remain after cancellation');

  // ========================================================================
  // 9. CLEANUP — REVERSE ORDER
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 9: Cleanup — Reverse Order]');
  console.log('====================================================');

  // 1. Delete smoke planner events, plans, and runs
  await db.prepare("DELETE FROM publication_plan_events WHERE plan_id = ?").bind(planToCancel.plan_id).run();
  await db.prepare("DELETE FROM article_publication_plans WHERE plan_id = ?").bind(planToCancel.plan_id).run();
  await db.prepare("DELETE FROM publication_planner_runs WHERE run_id = ?").bind(planRun1.runId).run();
  await db.prepare("DELETE FROM publication_planner_runs WHERE run_id = ?").bind(planRun2.runId).run();

  // 2. Delete smoke approvals
  await db.prepare("DELETE FROM article_editorial_approvals WHERE article_id = ? AND approved_by = ?").bind(PROD_ARTICLE_ID, SMOKE_OPERATOR).run();

  // 3. Delete smoke readiness evaluation
  await db.prepare("DELETE FROM article_publication_readiness WHERE article_id = ?").bind(PROD_ARTICLE_ID).run();

  // 4. Delete smoke article_media binding
  await db.prepare("DELETE FROM article_media WHERE article_id = ? AND asset_id = ?").bind(PROD_ARTICLE_ID, SMOKE_ASSET_ID).run();

  // 5. Delete smoke media asset
  await db.prepare("DELETE FROM media_assets WHERE asset_id = ?").bind(SMOKE_ASSET_ID).run();

  console.log('  Cleaned all temporary smoke planner, approval, readiness, and media records.');

  // ========================================================================
  // 10. FINAL VERIFICATION & INVARIANTS CHECK
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 10: Final Verification & Invariants]');
  console.log('====================================================');

  const finalArticle = await db
    .prepare("SELECT id, status, content_md, content_hash, published_at FROM articles WHERE id = ?")
    .bind(PROD_ARTICLE_ID)
    .first();

  assert(finalArticle.status === 'draft', 'Article remains strictly draft');
  assert(finalArticle.content_hash === baselineHash, 'Article content_hash matches preflight baseline 100%');
  assert((finalArticle.content_md || '').length === baselineBodyLength, 'Article body length matches preflight baseline 100%');
  assert(finalArticle.published_at === baselinePublishedAt, 'Article published_at matches preflight baseline 100%');

  const postActivePlans = await getActivePlans(db);
  assert(postActivePlans.length === 0, 'Zero active publication plans remain in production D1');

  const postApprovals = await db.prepare("SELECT count(*) as count FROM article_editorial_approvals WHERE article_id = ?").bind(PROD_ARTICLE_ID).first();
  assert(postApprovals.count === 0, 'Zero residual approval records for article');

  const postReadiness = await db.prepare("SELECT count(*) as count FROM article_publication_readiness WHERE article_id = ?").bind(PROD_ARTICLE_ID).first();
  assert(postReadiness.count === 0, 'Zero residual readiness records for article');

  const postMedia = await db.prepare("SELECT count(*) as count FROM article_media WHERE article_id = ?").bind(PROD_ARTICLE_ID).first();
  assert(postMedia.count === 0, 'Zero residual media bindings for article');

  const postAsset = await db.prepare("SELECT count(*) as count FROM media_assets WHERE asset_id = ?").bind(SMOKE_ASSET_ID).first();
  assert(postAsset.count === 0, 'Zero residual smoke media assets');

  console.log('\n================================================================');
  console.log(`PRODUCTION SMOKE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runControlledProductionSmoke().catch(err => {
  console.error('Fatal error in controlled production smoke:', err);
  process.exit(1);
});
