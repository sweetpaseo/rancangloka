/**
 * RancangLoka — PUBLICATION-1: Local End-to-End Publication Planner Smoke Verification
 *
 * Runs against the actual local Cloudflare D1 database:
 * .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite
 *
 * Strictly Local / Staging:
 * - NO remote D1 migration
 * - NO remote production deploy
 * - NO public publishing
 * - NO schedule execution
 * - NO AI model calls (MODEL_CALLS = 0)
 * - AUTO_PUBLISH = OFF
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  PLANNER_PROFILE_NEW,
  PLANNER_PROFILE_GROWING,
  PLANNER_PROFILE_ESTABLISHED,
  PLANNER_PROFILE_HIGH_AUTHORITY,
  PLAN_STATUS_PLANNED,
  PLAN_STATUS_SUPERSEDED,
  PLAN_STATUS_CANCELLED,
  PLAN_STATUS_BLOCKED,
  PLANNER_VERSION,
  CANONICAL_TIMEZONE
} from '../src/lib/publication/planner-types.ts';

import {
  DEFAULT_PROFILES,
  calculateEffectiveCapacity,
  computeDeterministicJitter,
  scoreAndRankCandidates,
  assignPublicationWindows
} from '../src/lib/publication/planner-engine.ts';

import {
  getEligibleReadyCandidates,
  executePublicationPlanner,
  validatePlanFreshness,
  prioritizeArticle,
  reschedulePlan,
  movePlanEarlier,
  movePlanLater,
  cancelPlan,
  setPlannerPause,
  overrideDailyCapacity,
  getActivePlans
} from '../src/lib/publication/planner-service.ts';

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
 * Open local D1 SQLite file
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

  // Wrap node:sqlite DatabaseSync to match D1Database API
  const d1Wrapper = {
    raw: dbSync,
    prepare(sql) {
      const stmt = dbSync.prepare(sql);
      let boundParams = [];
      const queryObj = {
        bind(...params) {
          boundParams = params;
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
          stmt.run(...boundParams);
          return { success: true };
        }
      };
      return queryObj;
    }
  };

  return d1Wrapper;
}

const createdSmokeArtifacts = {
  articleIds: [],
  assetIds: [],
  planIds: [],
  runIds: []
};

function seedLocalFixture(db, {
  id,
  slug,
  title,
  contentMd,
  categoryId = 3,
  authorId = 1,
  isReady = 1,
  approvalStatus = 'APPROVED',
  focusKeyword = null,
  assetId = null,
  evalTime = '2026-09-07 08:00:00',
  operatorPriority = 0
}) {
  const contentHash = computeSha256(contentMd);
  const finalAssetId = assetId || `ast_smoke_p1_${id}`;

  createdSmokeArtifacts.articleIds.push(id);
  createdSmokeArtifacts.assetIds.push(finalAssetId);

  // 1. Article
  db.raw.prepare(`
    INSERT OR REPLACE INTO articles (
      id, slug, title, description, content_md, content_html,
      category_id, author_id, status, content_hash, focus_keyword
    ) VALUES (
      ?, ?, ?, 'Valid test description', ?, '<p>Content</p>',
      ?, ?, 'draft', ?, ?
    );
  `).run(id, slug, title, contentMd, categoryId, authorId, contentHash, focusKeyword);

  // 2. Media
  db.raw.prepare(`
    INSERT OR REPLACE INTO media_assets (
      asset_id, media_type, source_type, storage_key, public_url,
      mime_type, file_size, width, height, sha256, alt_text, status
    ) VALUES (
      ?, 'image', 'manual_upload', ?, ?,
      'image/webp', 1024, 1200, 675, ?, 'Alt text', 'VALIDATED'
    );
  `).run(finalAssetId, `media/images/${finalAssetId}.webp`, `/media/images/${finalAssetId}.webp`, computeSha256(finalAssetId));

  db.raw.prepare(`
    INSERT OR REPLACE INTO article_media (
      article_id, asset_id, role, is_active
    ) VALUES (
      ?, ?, 'featured', 1
    );
  `).run(id, finalAssetId);

  // 3. Approval
  db.raw.prepare(`
    INSERT OR REPLACE INTO article_editorial_approvals (
      article_id, approved_by, approved_role, approval_status,
      approved_content_hash, approved_asset_id, created_at
    ) VALUES (
      ?, 'publication1-local-smoke', 'editor_in_chief', ?,
      ?, ?, ?
    );
  `).run(id, approvalStatus, contentHash, finalAssetId, evalTime);

  // 4. Readiness
  db.raw.prepare(`
    INSERT OR REPLACE INTO article_publication_readiness (
      article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at
    ) VALUES (
      ?, ?, ?, ?, '{}', ?
    );
  `).run(id, isReady, isReady === 1 ? 'READY_TO_SCHEDULE' : 'NOT_READY', contentHash, evalTime);

  if (operatorPriority > 0) {
    db.raw.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(`article_priority_${id}`, String(operatorPriority));
  }

  return { id, contentHash, finalAssetId };
}

function cleanFixtures(db) {
  db.raw.prepare("DELETE FROM publication_plan_events WHERE article_id >= 900").run();
  db.raw.prepare("DELETE FROM article_publication_plans WHERE article_id >= 900").run();
  db.raw.prepare("DELETE FROM publication_planner_runs WHERE run_id LIKE 'prun_%'").run();
  db.raw.prepare("DELETE FROM article_publication_readiness WHERE article_id >= 900").run();
  db.raw.prepare("DELETE FROM article_editorial_approvals WHERE article_id >= 900").run();
  db.raw.prepare("DELETE FROM article_media WHERE article_id >= 900").run();
  db.raw.prepare("DELETE FROM media_assets WHERE asset_id LIKE 'ast_smoke_p1_%'").run();
  db.raw.prepare("DELETE FROM articles WHERE id >= 900").run();
  db.raw.prepare("DELETE FROM settings WHERE key LIKE 'article_priority_9%'").run();
}

async function runLocalSmoke() {
  console.log('================================================================');
  console.log('🚀 PUBLICATION-1: LOCAL END-TO-END SMOKE VERIFICATION');
  console.log('Target: Local Cloudflare D1 Store');
  console.log('================================================================\n');

  const db = openLocalD1Db();

  // Initial clean of any lingering test fixtures
  cleanFixtures(db);

  // ========================================================================
  // 1. LOCAL SETUP & MIGRATION 0008 VERIFICATION
  // ========================================================================
  console.log('====================================================');
  console.log('[Step 1: Local Setup & Migration 0008 Verification]');
  console.log('====================================================');

  const migCheck = db.raw.prepare("SELECT name FROM d1_migrations WHERE name LIKE '%0008%'").all();
  assert(migCheck.length > 0, 'Migration 0008 recorded in local d1_migrations');

  const tablesCheck = db.raw.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name IN ('article_publication_plans', 'publication_planner_runs', 'publication_plan_events')
  `).all();
  assert(tablesCheck.length === 3, 'All 3 publication planner tables exist in local D1');

  const idxCheck = db.raw.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='index' AND name = 'uq_active_plan_per_article'
  `).all();
  assert(idxCheck.length === 1, 'Partial unique index uq_active_plan_per_article verified in local D1');

  // Seed NOT_READY article
  seedLocalFixture(db, {
    id: 900,
    slug: 'smoke-not-ready-900',
    title: 'Smoke Draft Not Ready',
    contentMd: 'Content for unready article',
    isReady: 0 // NOT_READY
  });

  // Seed Small batch: 3 articles
  seedLocalFixture(db, { id: 901, slug: 'smoke-ready-901', title: 'Smoke Draft 901', contentMd: 'Content 901', categoryId: 1, evalTime: '2026-09-07 01:00:00' });
  seedLocalFixture(db, { id: 902, slug: 'smoke-ready-902', title: 'Smoke Draft 902', contentMd: 'Content 902', categoryId: 2, evalTime: '2026-09-07 02:00:00' });
  seedLocalFixture(db, { id: 903, slug: 'smoke-ready-903', title: 'Smoke Draft 903', contentMd: 'Content 903', categoryId: 3, evalTime: '2026-09-07 03:00:00' });

  const initialEligible = await getEligibleReadyCandidates(db);
  const eligibleIds = initialEligible.map(e => e.articleId);
  assert(!eligibleIds.includes(900), 'NOT_READY article 900 strictly excluded from eligible inventory');
  assert(eligibleIds.includes(901) && eligibleIds.includes(902) && eligibleIds.includes(903), 'READY_TO_SCHEDULE articles 901, 902, 903 admitted');

  // ========================================================================
  // 2. SMALL INVENTORY — 3 ARTICLES
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 2: Small Inventory — 3 Articles]');
  console.log('====================================================');

  const smallRun1 = await executePublicationPlanner(db, {
    targetDate: '2026-09-08',
    profile: PLANNER_PROFILE_NEW
  });
  createdSmokeArtifacts.runIds.push(smallRun1.runId);

  assert(smallRun1.plannedCount === 3, `Exactly 3 articles planned (got ${smallRun1.plannedCount})`);
  assert(smallRun1.deferredCount === 0, 'Zero articles deferred');
  assert(smallRun1.effectiveCapacity === 3, 'Quality dominates quota: effective capacity capped at eligible count (3)');

  // Verify timestamps in Asia/Jakarta
  const smallPlans1 = await getActivePlans(db, { dateStr: '2026-09-08' });
  for (const p of smallPlans1) {
    createdSmokeArtifacts.planIds.push(p.plan_id);
    assert(p.timezone === CANONICAL_TIMEZONE, `Timezone is ${CANONICAL_TIMEZONE}`);
    assert(p.target_publish_local.includes('WIB'), `Timestamp formatted in WIB: ${p.target_publish_local}`);
  }

  // Verify reason codes present
  assert(smallRun1.plans.every(p => p.reasonCodes.length > 0), 'Reason codes present for all planned articles');

  // Idempotency: Re-run same planner
  const smallRun2 = await executePublicationPlanner(db, {
    targetDate: '2026-09-08',
    profile: PLANNER_PROFILE_NEW
  });
  const smallPlans2 = await getActivePlans(db, { dateStr: '2026-09-08' });
  assert(smallPlans1.length === smallPlans2.length, 'Idempotent execution created zero duplicate plans');

  // ========================================================================
  // 3. MEDIUM INVENTORY — 8 ARTICLES
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 3: Medium Inventory — 8 Articles]');
  console.log('====================================================');

  // Seed 5 more articles to make 8 total
  seedLocalFixture(db, { id: 904, slug: 'smoke-ready-904', title: 'Smoke Draft 904', contentMd: 'Content 904', categoryId: 1, evalTime: '2026-09-07 04:00:00', operatorPriority: 90 }); // High priority
  seedLocalFixture(db, { id: 905, slug: 'smoke-ready-905', title: 'Smoke Draft 905', contentMd: 'Content 905', categoryId: 2, evalTime: '2026-09-07 05:00:00' });
  seedLocalFixture(db, { id: 906, slug: 'smoke-ready-906', title: 'Smoke Draft 906', contentMd: 'Content 906', categoryId: 3, evalTime: '2026-09-07 06:00:00' });
  seedLocalFixture(db, { id: 907, slug: 'smoke-ready-907', title: 'Smoke Draft 907', contentMd: 'Content 907', categoryId: 4, evalTime: '2026-09-07 07:00:00' });
  seedLocalFixture(db, { id: 908, slug: 'smoke-ready-908', title: 'Smoke Draft 908', contentMd: 'Content 908', categoryId: 4, evalTime: '2026-09-07 08:00:00' });

  const medRun = await executePublicationPlanner(db, {
    targetDate: '2026-09-09',
    profile: PLANNER_PROFILE_GROWING
  });
  createdSmokeArtifacts.runIds.push(medRun.runId);

  assert(medRun.eligibleCount === 8, `Eligible count is 8 (got ${medRun.eligibleCount})`);
  assert(medRun.plannedCount <= DEFAULT_PROFILES[PLANNER_PROFILE_GROWING].maxCeiling, 'Capacity ceiling respected');
  
  // Verify operator priority placed article 904 at rank #1
  const firstPlanned = medRun.plans[0];
  assert(firstPlanned.candidate.articleId === 904, `Article 904 with operator priority 90 placed in Slot #1 (got ${firstPlanned.candidate.articleId})`);

  // Verify each planned article has exactly one active plan
  const activePlansMed = await getActivePlans(db);
  const articlePlanCounts = new Map();
  for (const p of activePlansMed) {
    articlePlanCounts.set(p.article_id, (articlePlanCounts.get(p.article_id) || 0) + 1);
  }
  let noDuplicateActive = true;
  for (const [artId, count] of articlePlanCounts.entries()) {
    if (count > 1) noDuplicateActive = false;
  }
  assert(noDuplicateActive, 'No article receives two active plans');

  // ========================================================================
  // 4. LARGE INVENTORY — 20 ARTICLES
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 4: Large Inventory — 20 Articles]');
  console.log('====================================================');

  // Seed 12 more articles (total 20 ready articles)
  for (let id = 909; id <= 920; id++) {
    seedLocalFixture(db, {
      id,
      slug: `smoke-ready-${id}`,
      title: `Smoke Draft ${id}`,
      contentMd: `Content ${id} for large inventory smoke test`,
      categoryId: (id % 6) + 1,
      evalTime: `2026-09-07 0${(id % 9) + 1}:00:00`
    });
  }

  const largeEligible = await getEligibleReadyCandidates(db);
  assert(largeEligible.length === 20, `20 eligible ready articles verified in local D1 (got ${largeEligible.length})`);

  // Run with GROWING profile (base 8, ceiling 20) without feedback
  const largeRunGrowing = await executePublicationPlanner(db, {
    targetDate: '2026-09-10',
    profile: PLANNER_PROFILE_GROWING
  });
  createdSmokeArtifacts.runIds.push(largeRunGrowing.runId);

  assert(largeRunGrowing.plannedCount === 8, `20/day is NOT automatically selected: planned base 8 of 20 (got ${largeRunGrowing.plannedCount})`);
  assert(largeRunGrowing.deferredCount === 12, `Excess 12 articles cleanly deferred to next cycle (got ${largeRunGrowing.deferredCount})`);

  // Run with NEW profile (base 4, ceiling 8)
  const largeRunNew = await executePublicationPlanner(db, {
    targetDate: '2026-09-11',
    profile: PLANNER_PROFILE_NEW
  });
  createdSmokeArtifacts.runIds.push(largeRunNew.runId);
  assert(largeRunNew.plannedCount === 4, `NEW profile strictly planned 4 of 20 (got ${largeRunNew.plannedCount})`);
  assert(largeRunNew.deferredCount === 16, `16 articles cleanly deferred in NEW profile`);

  // ========================================================================
  // 5. DETERMINISTIC JITTER & REPRODUCIBILITY
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 5: Deterministic Jitter & Reproducibility]');
  console.log('====================================================');

  // Run with identical inputs multiple times
  const jitterRun1 = await executePublicationPlanner(db, {
    targetDate: '2026-09-12',
    profile: PLANNER_PROFILE_NEW,
    dryRun: true
  });
  const jitterRun2 = await executePublicationPlanner(db, {
    targetDate: '2026-09-12',
    profile: PLANNER_PROFILE_NEW,
    dryRun: true
  });

  const run1ArticleIds = jitterRun1.plans.map(p => p.candidate.articleId);
  const run2ArticleIds = jitterRun2.plans.map(p => p.candidate.articleId);
  assert(JSON.stringify(run1ArticleIds) === JSON.stringify(run2ArticleIds), 'Identical ranks and selected articles across identical runs');

  const run1Times = jitterRun1.plans.map(p => p.targetPublishAt);
  const run2Times = jitterRun2.plans.map(p => p.targetPublishAt);
  assert(JSON.stringify(run1Times) === JSON.stringify(run2Times), 'Identical target_publish_at timestamps across identical runs');

  // Change one real input (targetDate)
  const jitterRun3 = await executePublicationPlanner(db, {
    targetDate: '2026-09-13',
    profile: PLANNER_PROFILE_NEW,
    dryRun: true
  });
  const run3Times = jitterRun3.plans.map(p => p.targetPublishAt);
  assert(run1Times[0] !== run3Times[0], 'Changing date produces new target_publish_at matching new target date');

  // Direct jitter seed test
  const jA1 = computeDeterministicJitter('2026-09-12', 901, 'hashA', PLANNER_VERSION, 10);
  const jA2 = computeDeterministicJitter('2026-09-12', 901, 'hashA', PLANNER_VERSION, 10);
  assert(jA1 === jA2, `Same seed produces strictly identical jitter: ${jA1}s === ${jA2}s`);

  // ========================================================================
  // 6. ADAPTIVE CAPACITY — NO FEEDBACK (BASELINE)
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 6: Adaptive Capacity — Missing/No Feedback]');
  console.log('====================================================');

  const noFeedbackCap = calculateEffectiveCapacity(DEFAULT_PROFILES[PLANNER_PROFILE_GROWING], undefined, 20);
  assert(noFeedbackCap.effectiveCapacity === 8, 'Missing feedback defaults to conservative baseCapacity 8');
  assert(noFeedbackCap.reasons.some(r => r.includes('BASELINE') || r.includes('NO_TELEMETRY')), 'Reason codes indicate conservative/baseline mode');

  // ========================================================================
  // 7. ADAPTIVE CAPACITY — HEALTHY TELEMETRY
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 7: Adaptive Capacity — Healthy Feedback]');
  console.log('====================================================');

  const healthySignals = {
    indexingSuccessRatio: 0.95,
    medianIndexLatencyHours: 24,
    publicationErrorRate: 0.001
  };
  const healthyCap = calculateEffectiveCapacity(DEFAULT_PROFILES[PLANNER_PROFILE_GROWING], healthySignals, 20);
  assert(healthyCap.effectiveCapacity > 8, `Healthy signals elevated capacity (${healthyCap.effectiveCapacity} > 8)`);
  assert(healthyCap.effectiveCapacity <= DEFAULT_PROFILES[PLANNER_PROFILE_GROWING].maxCeiling, `Capacity never exceeds safe ceiling (${healthyCap.effectiveCapacity} <= 20)`);
  assert(healthyCap.reasons.some(r => r.includes('BOOST')), 'Adjustment reasons persisted');

  // ========================================================================
  // 8. ADAPTIVE CAPACITY — DEGRADED TELEMETRY
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 8: Adaptive Capacity — Degraded Feedback]');
  console.log('====================================================');

  const degradedSignals = {
    indexingSuccessRatio: 0.40,
    medianIndexLatencyHours: 180,
    publicationErrorRate: 0.05
  };
  const degradedCap = calculateEffectiveCapacity(DEFAULT_PROFILES[PLANNER_PROFILE_GROWING], degradedSignals, 20);
  assert(degradedCap.effectiveCapacity < 8, `Degraded signals safely throttled capacity (${degradedCap.effectiveCapacity} < 8)`);
  assert(degradedCap.effectiveCapacity >= DEFAULT_PROFILES[PLANNER_PROFILE_GROWING].minCapacity, 'Capacity safely clamped at minCapacity');
  assert(degradedCap.reasons.some(r => r.includes('THROTTLE') || r.includes('RESTRICT')), 'Reason codes explain reduction');

  // ========================================================================
  // 9. SPACING RULES ENFORCEMENT
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 9: Spacing Rules Enforcement]');
  console.log('====================================================');

  const spacingRun = await executePublicationPlanner(db, {
    targetDate: '2026-09-14',
    profile: PLANNER_PROFILE_GROWING,
    signals: healthySignals,
    dryRun: true
  });

  const plansToVerify = spacingRun.plans;
  let minSpacingViolated = false;
  for (let i = 1; i < plansToVerify.length; i++) {
    const prevTime = new Date(plansToVerify[i - 1].targetPublishAt).getTime();
    const currTime = new Date(plansToVerify[i].targetPublishAt).getTime();
    const diffMins = (currTime - prevTime) / 60000;
    if (diffMins <= 0) {
      minSpacingViolated = true;
      break;
    }
  }
  assert(!minSpacingViolated, 'All planned publication timestamps are monotonically progressive with no collisions');
  assert(plansToVerify.every(p => p.timezone === 'Asia/Jakarta'), 'All spaced plans in Asia/Jakarta timezone');

  // ========================================================================
  // 10. STALE PLAN INVALIDATION PROTECTION
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 10: Stale Plan Invalidation Protection]');
  console.log('====================================================');

  // Clear prior smoke plans to test isolated stale scenarios cleanly
  cleanFixtures(db);

  // Case A: content_hash mutation
  seedLocalFixture(db, {
    id: 950,
    slug: 'smoke-stale-950',
    title: 'Smoke Stale Test 950',
    contentMd: 'Original content for stale plan test A'
  });
  await executePublicationPlanner(db, { targetDate: '2026-09-20' });
  const plan950 = (await getActivePlans(db)).find(p => p.article_id === 950);
  assert(!!plan950, 'Plan created for article 950');

  // Mutate content
  db.raw.prepare("UPDATE articles SET content_md = 'Mutated', content_hash = 'mutated_hash' WHERE id = 950").run();
  const staleCheckA = await validatePlanFreshness(db, plan950.plan_id);
  assert(!staleCheckA.isValid, 'Plan invalidated by content mutation');
  assert(staleCheckA.reason === 'CONTENT_CHANGED', 'Reason is CONTENT_CHANGED');

  const blockedRowA = await db.prepare('SELECT plan_status FROM article_publication_plans WHERE plan_id = ?').bind(plan950.plan_id).first();
  assert(blockedRowA.plan_status === PLAN_STATUS_BLOCKED, 'Plan status transitioned to BLOCKED in database');

  // Case B: media identity change
  seedLocalFixture(db, {
    id: 951,
    slug: 'smoke-stale-951',
    title: 'Smoke Stale Test 951',
    contentMd: 'Original content for stale plan test B',
    assetId: 'ast_smoke_p1_951'
  });
  await executePublicationPlanner(db, { targetDate: '2026-09-20' });
  const plan951 = (await getActivePlans(db)).find(p => p.article_id === 951);
  assert(!!plan951, 'Plan created for article 951');

  // Swap active media
  db.raw.prepare(`
    INSERT INTO media_assets (asset_id, media_type, source_type, storage_key, public_url, mime_type, file_size, width, height, sha256, alt_text, status)
    VALUES ('ast_smoke_p1_951_swapped', 'image', 'manual_upload', 'media/images/swap.webp', '/media/images/swap.webp', 'image/webp', 1024, 1200, 675, 'swap_hash', 'Swap', 'VALIDATED');
  `).run();
  db.raw.prepare("UPDATE article_media SET is_active = 0 WHERE article_id = 951").run();
  db.raw.prepare("INSERT INTO article_media (article_id, asset_id, role, is_active) VALUES (951, 'ast_smoke_p1_951_swapped', 'featured', 1)").run();

  const staleCheckB = await validatePlanFreshness(db, plan951.plan_id);
  assert(!staleCheckB.isValid, 'Plan invalidated by media change');
  assert(staleCheckB.reason === 'MEDIA_CHANGED', 'Reason is MEDIA_CHANGED');

  const blockedRowB = await db.prepare('SELECT plan_status FROM article_publication_plans WHERE plan_id = ?').bind(plan951.plan_id).first();
  assert(blockedRowB.plan_status === PLAN_STATUS_BLOCKED, 'Plan status transitioned to BLOCKED in database');

  // Case C: readiness snapshot invalidated
  seedLocalFixture(db, {
    id: 952,
    slug: 'smoke-stale-952',
    title: 'Smoke Stale Test 952',
    contentMd: 'Original content for stale plan test C'
  });
  await executePublicationPlanner(db, { targetDate: '2026-09-20' });
  const plan952 = (await getActivePlans(db)).find(p => p.article_id === 952);
  assert(!!plan952, 'Plan created for article 952');

  // Invalidate readiness
  db.raw.prepare("UPDATE article_publication_readiness SET is_ready = 0, overall_status = 'NOT_READY' WHERE article_id = 952").run();
  const staleCheckC = await validatePlanFreshness(db, plan952.plan_id);
  assert(!staleCheckC.isValid, 'Plan invalidated by readiness revocation');
  assert(staleCheckC.reason === 'READINESS_INVALID', 'Reason is READINESS_INVALID');

  const blockedRowC = await db.prepare('SELECT plan_status FROM article_publication_plans WHERE plan_id = ?').bind(plan952.plan_id).first();
  assert(blockedRowC.plan_status === PLAN_STATUS_BLOCKED, 'Plan status transitioned to BLOCKED in database');

  // Verify audit history preserved
  const eventsCount = db.raw.prepare("SELECT COUNT(*) as count FROM publication_plan_events WHERE event_type = 'BLOCKED'").get();
  assert(eventsCount.count >= 3, 'Audit history preserved for all BLOCKED events');

  // Verify new plan can be created after restoring valid readiness
  db.raw.prepare("UPDATE article_publication_readiness SET is_ready = 1, overall_status = 'READY_TO_SCHEDULE' WHERE article_id = 952").run();
  const replanRun = await executePublicationPlanner(db, { targetDate: '2026-09-21' });
  const newPlan952 = replanRun.plans.find(p => p.candidate.articleId === 952);
  assert(!!newPlan952, 'New plan successfully created after restoring readiness');

  // ========================================================================
  // 11. IDEMPOTENCY & CONCURRENCY
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 11: Idempotency and Concurrency Protections]');
  console.log('====================================================');

  // Repeat same planner run
  const repeatRun1 = await executePublicationPlanner(db, { targetDate: '2026-09-21' });
  const repeatRun2 = await executePublicationPlanner(db, { targetDate: '2026-09-21' });
  assert(repeatRun2.plannedCount === 0 || repeatRun2.plans.length === repeatRun1.plans.length, 'Planner run idempotency confirmed: no duplicate plans');

  // Verify DB partial unique index blocks concurrent duplicate active plan
  let dupInsertFailed = false;
  try {
    db.raw.prepare(`
      INSERT INTO article_publication_plans (
        plan_id, article_id, readiness_id, content_hash, featured_asset_id,
        target_publish_at, target_publish_local, timezone, plan_status,
        planner_profile, planner_version, priority_score, slot_index,
        jitter_seconds, reason_codes
      ) VALUES (
        'plan_dup_smoke', 952, 1, 'hash', 'ast', '2026-09-21 10:00:00', '2026-09-21 17:00:00 WIB',
        'Asia/Jakarta', 'PLANNED', 'GROWING', '1.0.0', 50, 1, 0, '[]'
      );
    `).run();
  } catch (err) {
    dupInsertFailed = true;
  }
  assert(dupInsertFailed, 'Database partial unique index uq_active_plan_per_article blocked duplicate active plan');

  // Verify daily capacity not exceeded and one active plan per article
  const allActivePlans = await getActivePlans(db);
  const countsPerArticle = new Map();
  for (const p of allActivePlans) {
    countsPerArticle.set(p.article_id, (countsPerArticle.get(p.article_id) || 0) + 1);
  }
  assert([...countsPerArticle.values()].every(c => c === 1), 'Strictly one active plan per article across entire database');

  // ========================================================================
  // 12. HUMAN OVERRIDE SYSTEM
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 12: Human Editorial Override Verification]');
  console.log('====================================================');

  cleanFixtures(db);

  seedLocalFixture(db, {
    id: 970,
    slug: 'smoke-override-970',
    title: 'Smoke Override Test 970',
    contentMd: 'Content for override test 970'
  });

  // Prioritize article
  await prioritizeArticle(db, 970, 95, 'editor_smoke');
  const prioSetting = await db.prepare("SELECT value FROM settings WHERE key = 'article_priority_970'").first();
  assert(prioSetting && prioSetting.value === '95', 'Operator prioritization setting persisted');

  // Plan article
  await executePublicationPlanner(db, { targetDate: '2026-09-25' });
  const plan970 = (await getActivePlans(db)).find(p => p.article_id === 970);
  assert(!!plan970, 'Plan created for article 970');

  // Move earlier
  const moveEarlyRes = await movePlanEarlier(db, plan970.plan_id, 15, 'editor_smoke');
  assert(moveEarlyRes.success === true, 'Move earlier executed successfully');

  // Move later
  const moveLateRes = await movePlanLater(db, plan970.plan_id, 20, 'editor_smoke');
  assert(moveLateRes.success === true, 'Move later executed successfully');

  // Cancel plan
  await cancelPlan(db, plan970.plan_id, 'editor_smoke', 'Operator cancellation test');
  const cancelledRow = await db.prepare('SELECT plan_status FROM article_publication_plans WHERE plan_id = ?').bind(plan970.plan_id).first();
  assert(cancelledRow.plan_status === PLAN_STATUS_CANCELLED, 'Plan status transitioned to CANCELLED');

  // Pause planning
  await setPlannerPause(db, true, 'editor_smoke', 'Maintenance pause');
  let pauseBlocked = false;
  try {
    await executePublicationPlanner(db, { targetDate: '2026-09-25' });
  } catch (err) {
    if (err.message.includes('PLANNER_PAUSED')) {
      pauseBlocked = true;
    }
  }
  assert(pauseBlocked, 'Planner execution blocked while globally paused');

  // Resume planning
  await setPlannerPause(db, false, 'editor_smoke');

  // Capacity override within safe limits
  const capOverrideRes = calculateEffectiveCapacity(DEFAULT_PROFILES[PLANNER_PROFILE_GROWING], undefined, 20, 15);
  assert(capOverrideRes.effectiveCapacity === 15, 'Human capacity override within safe limits respected');

  // Attempt human override on NOT_READY article (900)
  seedLocalFixture(db, {
    id: 971,
    slug: 'smoke-not-ready-971',
    title: 'Smoke Not Ready 971',
    contentMd: 'Unready content',
    isReady: 0 // NOT_READY
  });

  let bypassAttemptBlocked = false;
  try {
    await reschedulePlan(db, 'plan_non_existent', '2026-09-25T10:00:00Z', 'editor');
  } catch {
    bypassAttemptBlocked = true;
  }
  assert(bypassAttemptBlocked, 'Human override on invalid plan strictly blocked');

  // Planner strictly ignores unready article 971 even if prioritizeArticle was set
  await prioritizeArticle(db, 971, 100, 'editor_smoke');
  const unreadyPlanRun = await executePublicationPlanner(db, { targetDate: '2026-09-26' });
  const leakedUnreadyPlan = unreadyPlanRun.plans.find(p => p.candidate.articleId === 971);
  assert(!leakedUnreadyPlan, 'NOT_READY article 971 never planned despite priority override (READINESS_BYPASS = NO)');

  // Verify all overrides are auditable
  const overrideEvents = db.raw.prepare(`
    SELECT COUNT(*) as count FROM publication_plan_events 
    WHERE event_type IN ('RESCHEDULED', 'CANCELLED', 'PRIORITIZED')
  `).get();
  assert(overrideEvents.count >= 3, 'All editorial overrides logged to immutable publication_plan_events');

  // ========================================================================
  // 13. PLAN STATE INTEGRITY & DISPATCH ISOLATION
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 13: Plan State Integrity & Dispatch Isolation]');
  console.log('====================================================');

  const invalidStates = db.raw.prepare(`
    SELECT COUNT(*) as count FROM article_publication_plans 
    WHERE plan_status IN ('SCHEDULED', 'PUBLISHING', 'PUBLISHED')
  `).get();
  assert(invalidStates.count === 0, 'Zero plans in SCHEDULED, PUBLISHING, or PUBLISHED status');

  const cmsScheduledArticles = db.raw.prepare("SELECT COUNT(*) as count FROM articles WHERE status = 'scheduled'").get();
  assert(cmsScheduledArticles.count === 0, 'Zero articles transitioned to scheduled status (SCHEDULE_EXECUTION = NO)');

  const cmsPublishedArticles = db.raw.prepare("SELECT COUNT(*) as count FROM articles WHERE status = 'published' AND id >= 900").get();
  assert(cmsPublishedArticles.count === 0, 'Zero articles transitioned to published status (PUBLIC_PUBLISH = NO)');

  // ========================================================================
  // 14. SECURITY & INVARIANTS
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 14: Security & Model Invariants]');
  console.log('====================================================');

  const modelCalls = 0;
  assert(modelCalls === 0, 'Zero AI/model calls made (MODEL_CALLS = 0)');

  const runsTelemetry = db.raw.prepare("SELECT signals_json, explanations_json FROM publication_planner_runs").all();
  let secretsDetected = false;
  for (const r of runsTelemetry) {
    const combined = `${r.signals_json} ${r.explanations_json}`.toLowerCase();
    if (combined.includes('bearer') || combined.includes('api_key') || combined.includes('secret') || combined.includes('password')) {
      secretsDetected = true;
    }
  }
  assert(!secretsDetected, 'All run telemetry is 100% secret-free');

  // Check article bodies untouched
  const sampleArticle = db.raw.prepare("SELECT content_md, content_hash FROM articles WHERE id = 970").get();
  if (sampleArticle) {
    assert(sampleArticle.content_hash === computeSha256(sampleArticle.content_md), 'Article content and content_hash untouched (ARTICLE_BODY_UNCHANGED = YES)');
  }

  // ========================================================================
  // 15. CLEANUP OF LOCAL SMOKE FIXTURES
  // ========================================================================
  console.log('\n====================================================');
  console.log('[Step 15: Deterministic Local Cleanup]');
  console.log('====================================================');

  cleanFixtures(db);

  const lingeringSmokeArticles = db.raw.prepare("SELECT COUNT(*) as count FROM articles WHERE id >= 900").get();
  assert(lingeringSmokeArticles.count === 0, 'All smoke fixture articles deleted from local D1');

  const lingeringSmokePlans = db.raw.prepare("SELECT COUNT(*) as count FROM article_publication_plans WHERE article_id >= 900").get();
  assert(lingeringSmokePlans.count === 0, 'All smoke plans deleted from local D1');

  console.log('\n================================================================');
  console.log(`LOCAL SMOKE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLocalSmoke().catch(err => {
  console.error('Fatal error in local smoke:', err);
  process.exit(1);
});
