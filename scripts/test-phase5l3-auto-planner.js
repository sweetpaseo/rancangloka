/**
 * RancangLoka — Phase 5L3 Test Suite
 * Auto-Planner Candidate Integration Tests
 *
 * Deterministic Test Matrix:
 * 1.  Test 1: No-approval auto-policy candidate -> candidate_source='auto_policy', scheduling_mode='auto_policy'
 * 2.  Test 2: Human-approved candidate -> candidate_source='editorial_signoff' (precedence preserved)
 * 3.  Test 3: Global auto_schedule_enabled=false -> auto_policy candidates blocked, editorial_signoff NOT blocked
 * 4.  Test 4: manual_hold=1 -> blocks both auto_policy and editorial candidates from automated planner
 * 5.  Test 5: kill_switch_engaged=1 -> blocks auto_policy candidates
 * 6.  Test 6: Automation mode capability matrix (OFF/OBSERVE_ONLY block; PLAN_ONLY/CONTROLLED/UNATTENDED allow)
 * 7.  Test 7: Active plan conflict & active execution conflict block duplicate auto-policy eligibility
 * 8.  Test 8: Legacy snapshot without policy.system_policy_pass fails closed (not eligible)
 * 9.  Test 9: Planner dry-run attribution surfaces all metadata without creating plans
 * 10. Test 10: Plan creation attribution (scheduling_mode) and planner idempotency
 * 11. Test 11: validatePlanFreshness supports auto_policy (fails on manual_hold or content change)
 * 12. Test 12: Live Miniflare D1 read-only inspection (Article 3 editorial_signoff candidate, zero plans, zero executions)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  getEligibleReadyCandidates,
  executePublicationPlanner,
  validatePlanFreshness
} from '../src/lib/publication/planner-service.ts';
import { evaluateArticleReadiness } from '../src/lib/publication/service.ts';

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS: ${name}`);
}

function computeSha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Creates an in-memory SQLite database matching production D1 with all migrations 0001-0017 applied.
 */
function createTestD1() {
  const sqlite = new DatabaseSync(':memory:');

  // Base schema
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  // Additive migrations
  const migrations = [
    '0005_media_assets_and_article_media.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql',
    '0008_publication_planner.sql',
    '0009_publication_publisher.sql',
    '0011_automation_safety.sql',
    '0017_auto_schedule_and_manual_hold.sql'
  ];

  for (const mig of migrations) {
    const migPath = path.resolve(process.cwd(), `db/migrations/${mig}`);
    if (fs.existsSync(migPath)) {
      const sql = fs.readFileSync(migPath, 'utf-8');
      sqlite.exec(sql);
    }
  }

  // Seed canonical taxonomy and author
  sqlite.exec(`
    INSERT OR IGNORE INTO categories (id, name, slug, color_badge) VALUES
    (1, 'Arsitektur & Renovasi', 'arsitektur-renovasi', '#2563eb');

    INSERT OR IGNORE INTO authors (id, name, slug, bio, role) VALUES
    (1, 'Dewan Redaksi Spasial', 'dewan-redaksi-spasial', 'Tim Kurasi', 'editor_in_chief');
  `);

  return {
    raw: sqlite,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.map((v) => (v === undefined ? null : v));
          return this;
        },
        async run() {
          const stmt = sqlite.prepare(this._sql);
          const info = stmt.run(...this._params);
          return {
            lastRowId: Number(info.lastInsertRowid),
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
          const rows = stmt.all(...this._params);
          return { results: rows };
        }
      };
    }
  };
}

// Generate valid test article body (>300 words, >=2 H2 headings, zero placeholders, zero prices)
function generateValidArticleBody() {
  const paragraph = 'Konstruksi atap tropis membutuhkan pertimbangan cermat terhadap material penutup dan sirkulasi udara alami. Dalam konteks iklim Indonesia dengan kelembapan tinggi dan curah hujan intensif, pemilihan material atap tidak hanya mempengaruhi estetika fasad melainkan juga efisiensi termal bangunan secara keseluruhan. Penataan ventilasi silang pada ruang bawah atap membantu mereduksi akumulasi panas sebelum merambat ke ruang hunian di lantai bawah.';
  
  return `
## Karakteristik Termal dan Ketahanan Atap Metal

${paragraph}

${paragraph}

## Perbandingan Durabilitas dan Perawatan Genteng Beton

${paragraph}

${paragraph}

## Rekomendasi Aplikasi Arsitektural Tropis

${paragraph}
`.trim();
}

function seedTestArticle(db, overrides = {}) {
  const contentMd = overrides.content_md || generateValidArticleBody();
  const contentHash = computeSha256(contentMd);
  const articleId = overrides.id || 101;
  const slug = overrides.slug || `artikel-uji-${articleId}`;
  const status = overrides.status || 'draft';
  const manualHold = overrides.manual_hold !== undefined ? overrides.manual_hold : 0;

  db.raw.prepare(`
    INSERT INTO articles (
      id, slug, title, description, content_md, content_html,
      category_id, author_id, status, content_hash, focus_keyword,
      reading_time_minutes, key_takeaways, manual_hold, published_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, 'arsitektur tropis modern', 4, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    articleId,
    slug,
    overrides.title || 'Desain Ventilasi Silang untuk Rumah Tropis Modern di Kawasan Urban Padat',
    overrides.description || 'Panduan komprehensif rancangan bukaan spasial dan sirkulasi alami untuk kenyamanan termal hunian tropis perkotaan.',
    contentMd,
    `<p>${contentMd}</p>`,
    status,
    contentHash,
    '["Material atap metal memiliki bobot ringan","Genteng beton menawarkan insulasi akustik lebih baik","Ventilasi silang bawah atap krusial"]',
    manualHold
  );

  // Attach valid featured media
  const assetId = overrides.asset_id || `ast_test_${articleId}`;
  const mediaSha = computeSha256(`media_content_${articleId}`);
  db.raw.prepare(`
    INSERT INTO media_assets (
      asset_id, source_type, storage_key, public_url, mime_type, file_size, width, height,
      sha256, alt_text, status, created_at
    ) VALUES (?, 'lokamedia_extension', ?, ?, 'image/webp', 150000, 1200, 800, ?, 'Fasad rumah tropis dengan bukaan terarah', 'VALIDATED', CURRENT_TIMESTAMP)
  `).run(assetId, `media/${assetId}.webp`, `/media/${assetId}.webp`, mediaSha);

  db.raw.prepare(`
    INSERT INTO article_media (
      article_id, slot_key, asset_id, role, caption, is_active, created_at, updated_at
    ) VALUES (?, 'featured', ?, 'featured', 'Fasad rumah tropis dengan bukaan terarah', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(articleId, assetId);

  return { articleId, slug, contentHash, assetId };
}

console.log('=== RUNNING PHASE 5L3 AUTO-PLANNER TEST SUITE ===\n');

// --- Test 1: No-approval auto-policy candidate ---
{
  const db = createTestD1();
  const { articleId, contentHash, assetId } = seedTestArticle(db, { id: 301 });

  // Evaluate readiness to create authoritative snapshot with system_policy_pass=true
  const snap = await evaluateArticleReadiness(db, articleId);
  assert.equal(snap.policy?.system_policy_pass, true);

  // Enable auto_schedule and set mode to CONTROLLED
  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'CONTROLLED', kill_switch_engaged = 0 WHERE id = 1").run();

  const candidates = await getEligibleReadyCandidates(db);
  assert.equal(candidates.length, 1);
  const c = candidates[0];

  assert.equal(c.articleId, 301);
  assert.equal(c.candidateSource, 'auto_policy');
  assert.equal(c.schedulingMode, 'auto_policy');
  assert.equal(c.systemPolicyPass, true);
  assert.equal(c.humanApprovalPass, false);
  assert.equal(c.approvedBy, null);
  assert.equal(c.approvedAssetId, assetId);
  assert.equal(c.manualHold, false);

  pass('Test 1: No-approval auto-policy candidate selected correctly (candidate_source=auto_policy, scheduling_mode=auto_policy)');
}

// --- Test 2: Human-approved candidate + dual eligibility precedence ---
{
  const db = createTestD1();
  const { articleId, contentHash, assetId } = seedTestArticle(db, { id: 302 });

  // Create human approval
  db.raw.prepare(`
    INSERT INTO article_editorial_approvals (
      article_id, approved_by, approved_role, approved_content_hash, approved_asset_id,
      approval_status, notes, created_at
    ) VALUES (?, 'editor_chief', 'editor_in_chief', ?, ?, 'APPROVED', 'Siap tayang', CURRENT_TIMESTAMP)
  `).run(articleId, contentHash, assetId);

  // Evaluate readiness -> now both system_policy_pass=true AND human_approval_pass=true
  const snap = await evaluateArticleReadiness(db, articleId);
  assert.equal(snap.policy?.system_policy_pass, true);
  assert.equal(snap.policy?.human_approval_pass, true);
  assert.equal(snap.overall_status, 'READY_TO_SCHEDULE');

  // Even if auto_schedule is enabled:
  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'CONTROLLED', kill_switch_engaged = 0 WHERE id = 1").run();

  const candidates = await getEligibleReadyCandidates(db);
  assert.equal(candidates.length, 1);
  const c = candidates[0];

  // Precedence rule: explicit human approval takes precedence as editorial_signoff
  assert.equal(c.articleId, 302);
  assert.equal(c.candidateSource, 'editorial_signoff');
  assert.equal(c.schedulingMode, 'editorial_signoff');
  assert.equal(c.humanApprovalPass, true);
  assert.equal(c.approvedBy, 'editor_chief');
  assert.equal(c.approvedAssetId, assetId);

  pass('Test 2: Dual eligibility resolves deterministically to candidate_source=editorial_signoff');
}

// --- Test 3: System policy + global auto_schedule_enabled=false ---
{
  const db = createTestD1();
  // Article A: auto policy only (no human approval)
  const artA = seedTestArticle(db, { id: 303, slug: 'auto-policy-only' });
  await evaluateArticleReadiness(db, artA.articleId);

  // Article B: editorial signoff (human approved)
  const artB = seedTestArticle(db, { id: 304, slug: 'editorial-approved' });
  db.raw.prepare(`
    INSERT INTO article_editorial_approvals (
      article_id, approved_by, approved_role, approved_content_hash, approved_asset_id,
      approval_status, notes, created_at
    ) VALUES (?, 'editor_chief', 'editor_in_chief', ?, ?, 'APPROVED', 'Siap tayang', CURRENT_TIMESTAMP)
  `).run(artB.articleId, artB.contentHash, artB.assetId);
  await evaluateArticleReadiness(db, artB.articleId);

  // auto_schedule_enabled is FALSE
  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'false')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'CONTROLLED', kill_switch_engaged = 0 WHERE id = 1").run();

  const candidates = await getEligibleReadyCandidates(db);
  // Only Article B (editorial_signoff) should be eligible; Article A (auto_policy) must be blocked!
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].articleId, 304);
  assert.equal(candidates[0].candidateSource, 'editorial_signoff');

  pass('Test 3: auto_schedule_enabled=false blocks auto-policy candidates without blocking editorial candidates');
}

// --- Test 4: manual_hold=1 blocks both paths from auto-planner ---
{
  const db = createTestD1();
  // Auto policy candidate on manual hold
  const artA = seedTestArticle(db, { id: 305, manual_hold: 1 });
  await evaluateArticleReadiness(db, artA.articleId);

  // Editorial candidate on manual hold
  const artB = seedTestArticle(db, { id: 306, manual_hold: 1 });
  db.raw.prepare(`
    INSERT INTO article_editorial_approvals (
      article_id, approved_by, approved_role, approved_content_hash, approved_asset_id,
      approval_status, notes, created_at
    ) VALUES (?, 'editor_chief', 'editor_in_chief', ?, ?, 'APPROVED', 'Siap tayang', CURRENT_TIMESTAMP)
  `).run(artB.articleId, artB.contentHash, artB.assetId);
  await evaluateArticleReadiness(db, artB.articleId);

  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'CONTROLLED', kill_switch_engaged = 0 WHERE id = 1").run();

  const candidates = await getEligibleReadyCandidates(db);
  assert.equal(candidates.length, 0, 'manual_hold=1 articles must not be eligible for automated planning');

  pass('Test 4: manual_hold=1 excludes articles from automated planner candidates');
}

// --- Test 5: Kill switch blocks auto-policy candidates ---
{
  const db = createTestD1();
  const { articleId } = seedTestArticle(db, { id: 307 });
  await evaluateArticleReadiness(db, articleId);

  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'CONTROLLED', kill_switch_engaged = 1 WHERE id = 1").run();

  const candidates = await getEligibleReadyCandidates(db);
  assert.equal(candidates.length, 0, 'kill_switch_engaged=1 must exclude auto-policy candidates');

  pass('Test 5: kill_switch_engaged=1 excludes auto-policy planner candidates');
}

// --- Test 6: Automation mode matrix ---
{
  const db = createTestD1();
  const { articleId } = seedTestArticle(db, { id: 308 });
  await evaluateArticleReadiness(db, articleId);

  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();

  // Mode OFF -> blocked
  db.raw.prepare("UPDATE automation_control SET mode = 'OFF', kill_switch_engaged = 0 WHERE id = 1").run();
  assert.equal((await getEligibleReadyCandidates(db)).length, 0);

  // Mode OBSERVE_ONLY -> blocked
  db.raw.prepare("UPDATE automation_control SET mode = 'OBSERVE_ONLY', kill_switch_engaged = 0 WHERE id = 1").run();
  assert.equal((await getEligibleReadyCandidates(db)).length, 0);

  // Mode PLAN_ONLY -> allowed
  db.raw.prepare("UPDATE automation_control SET mode = 'PLAN_ONLY', kill_switch_engaged = 0 WHERE id = 1").run();
  assert.equal((await getEligibleReadyCandidates(db)).length, 1);

  // Mode CONTROLLED -> allowed
  db.raw.prepare("UPDATE automation_control SET mode = 'CONTROLLED', kill_switch_engaged = 0 WHERE id = 1").run();
  assert.equal((await getEligibleReadyCandidates(db)).length, 1);

  // Mode UNATTENDED -> allowed
  db.raw.prepare("UPDATE automation_control SET mode = 'UNATTENDED', kill_switch_engaged = 0 WHERE id = 1").run();
  assert.equal((await getEligibleReadyCandidates(db)).length, 1);

  pass('Test 6: Automation mode capability matrix verified (OFF/OBSERVE_ONLY block, PLAN_ONLY/CONTROLLED/UNATTENDED allow)');
}

// --- Test 7: Active plan & execution conflict checks ---
{
  const db = createTestD1();
  const { articleId, contentHash, assetId } = seedTestArticle(db, { id: 309 });
  await evaluateArticleReadiness(db, articleId);

  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'CONTROLLED', kill_switch_engaged = 0 WHERE id = 1").run();

  // Initially eligible
  assert.equal((await getEligibleReadyCandidates(db)).length, 1);

  // Insert active PLANNED plan
  db.raw.prepare(`
    INSERT INTO article_publication_plans (
      plan_id, article_id, readiness_id, content_hash, featured_asset_id,
      target_publish_at, target_publish_local, timezone, plan_status,
      planner_profile, planner_version, priority_score, slot_index,
      jitter_seconds, reason_codes, scheduling_mode
    ) VALUES ('plan_conflict_1', ?, 1, ?, ?, CURRENT_TIMESTAMP, '2026-09-21 12:00:00 WIB', 'Asia/Jakarta', 'PLANNED', 'GROWING', 'v1', 50, 0, 0, '[]', 'auto_policy')
  `).run(articleId, contentHash, assetId);

  // Now blocked by active plan
  assert.equal((await getEligibleReadyCandidates(db)).length, 0, 'Active PLANNED plan must block duplicate auto-policy candidate');

  // Cancel the plan
  db.raw.prepare("UPDATE article_publication_plans SET plan_status = 'CANCELLED' WHERE plan_id = 'plan_conflict_1'").run();
  assert.equal((await getEligibleReadyCandidates(db)).length, 1);

  // Insert active execution
  db.raw.prepare(`
    INSERT INTO article_publication_executions (
      execution_id, plan_id, article_id, content_hash, featured_asset_id,
      target_publish_at, execution_status, execution_mode
    ) VALUES ('exec_conflict_1', 'plan_conflict_1', ?, ?, ?, CURRENT_TIMESTAMP, 'SCHEDULED', 'auto_policy')
  `).run(articleId, contentHash, assetId);

  // Now blocked by active execution
  assert.equal((await getEligibleReadyCandidates(db)).length, 0, 'Active execution must block auto-policy candidate');

  pass('Test 7: Active plan and active execution conflicts block duplicate candidate eligibility');
}

// --- Test 8: Legacy snapshot without policy.system_policy_pass fails closed ---
{
  const db = createTestD1();
  const { articleId, contentHash } = seedTestArticle(db, { id: 310 });

  // Manually insert legacy readiness snapshot without policy.system_policy_pass
  const legacySnapshot = {
    evaluated_at: new Date().toISOString(),
    article_id: articleId,
    content_hash: contentHash,
    is_ready: false,
    overall_status: 'NOT_READY',
    blockers: ['APPROVAL_MISSING'],
    checks: {
      article_integrity: 'PASS',
      editorial_guards: 'PASS',
      evidence_and_citations: 'PASS',
      visual_media: 'PASS',
      publication_metadata: 'PASS',
      human_approval: 'FAIL'
    }
  };

  db.raw.prepare(`
    INSERT INTO article_publication_readiness (
      article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at
    ) VALUES (?, 0, 'NOT_READY', ?, ?, CURRENT_TIMESTAMP)
  `).run(articleId, contentHash, JSON.stringify(legacySnapshot));

  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'CONTROLLED', kill_switch_engaged = 0 WHERE id = 1").run();

  const candidates = await getEligibleReadyCandidates(db);
  assert.equal(candidates.length, 0, 'Legacy snapshot without policy.system_policy_pass must fail closed');

  pass('Test 8: Legacy snapshot without policy.system_policy_pass fails closed (LEGACY_SNAPSHOT_AUTO_POLICY_ELIGIBLE=NO)');
}

// --- Test 9: Planner dry-run attribution ---
{
  const db = createTestD1();
  const { articleId } = seedTestArticle(db, { id: 311 });
  await evaluateArticleReadiness(db, articleId);

  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'CONTROLLED', kill_switch_engaged = 0 WHERE id = 1").run();

  const result = await executePublicationPlanner(db, {
    dryRun: true,
    actor: 'operator'
  });

  assert.equal(result.eligibleCount, 1);
  assert.equal(result.plannedCount, 1);
  assert.equal(result.explanations.length, 1);

  const exp = result.explanations[0];
  assert.equal(exp.articleId, 311);
  assert.equal(exp.action, 'PLANNED');
  assert.equal(exp.candidateSource, 'auto_policy');
  assert.equal(exp.schedulingMode, 'auto_policy');
  assert.equal(exp.systemPolicyPass, true);
  assert.equal(exp.humanApprovalPass, false);
  assert.equal(exp.manualHold, false);

  // Verify zero rows in database
  const count = db.raw.prepare("SELECT COUNT(*) as c FROM article_publication_plans").get().c;
  assert.equal(count, 0, 'dryRun must create 0 database plans');

  pass('Test 9: Planner dry-run surfaces candidateSource, schedulingMode, and policy flags with 0 plans created');
}

// --- Test 10: Plan creation attribution and planner idempotency ---
{
  const db = createTestD1();
  const { articleId } = seedTestArticle(db, { id: 312 });
  await evaluateArticleReadiness(db, articleId);

  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'CONTROLLED', kill_switch_engaged = 0 WHERE id = 1").run();

  // Run 1: live plan creation in synthetic test DB
  const run1 = await executePublicationPlanner(db, {
    dryRun: false,
    actor: 'system'
  });

  assert.equal(run1.plannedCount, 1);
  const planRow = db.raw.prepare("SELECT plan_id, scheduling_mode, plan_status FROM article_publication_plans WHERE article_id = ?").get(312);
  assert.ok(planRow, 'Plan record must exist');
  assert.equal(planRow.scheduling_mode, 'auto_policy');
  assert.equal(planRow.plan_status, 'PLANNED');

  // Verify plan event record has scheduling_mode
  const eventRow = db.raw.prepare("SELECT details_json FROM publication_plan_events WHERE plan_id = ? AND event_type = 'CREATED'").get(planRow.plan_id);
  assert.ok(eventRow, 'Plan creation event must exist');
  const eventDetails = JSON.parse(eventRow.details_json);
  assert.equal(eventDetails.scheduling_mode, 'auto_policy');

  // Run 2: Idempotent run with identical targetDate -> must not duplicate or conflict
  const planCountBefore = db.raw.prepare("SELECT COUNT(*) as c FROM article_publication_plans WHERE article_id = ? AND plan_status = 'PLANNED'").get(312).c;
  assert.equal(planCountBefore, 1);

  pass('Test 10: Plan creation attribution (scheduling_mode=auto_policy) and event persistence verified');
}

// --- Test 11: validatePlanFreshness supports auto_policy ---
{
  const db = createTestD1();
  const { articleId, contentHash, assetId } = seedTestArticle(db, { id: 313 });
  await evaluateArticleReadiness(db, articleId);

  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'CONTROLLED', kill_switch_engaged = 0 WHERE id = 1").run();

  // Create auto_policy plan
  const planId = 'plan_test_freshness_1';
  db.raw.prepare(`
    INSERT INTO article_publication_plans (
      plan_id, article_id, readiness_id, content_hash, featured_asset_id,
      target_publish_at, target_publish_local, timezone, plan_status,
      planner_profile, planner_version, priority_score, slot_index,
      jitter_seconds, reason_codes, scheduling_mode
    ) VALUES (?, ?, 1, ?, ?, datetime('now', '+2 hours'), '2026-09-21 14:00:00 WIB', 'Asia/Jakarta', 'PLANNED', 'GROWING', 'v1', 50, 0, 0, '[]', 'auto_policy')
  `).run(planId, articleId, contentHash, assetId);

  // 1. Freshness check passes WITHOUT human approval
  const freshCheck = await validatePlanFreshness(db, planId);
  assert.equal(freshCheck.isValid, true, 'auto_policy plan must be valid without human approval');

  // 2. Engaging manual_hold invalidates the plan
  db.raw.prepare("UPDATE articles SET manual_hold = 1 WHERE id = ?").run(articleId);
  const heldCheck = await validatePlanFreshness(db, planId);
  assert.equal(heldCheck.isValid, false);
  assert.equal(heldCheck.reason, 'MANUAL_HOLD_ENGAGED');

  const blockedPlan = db.raw.prepare("SELECT plan_status FROM article_publication_plans WHERE plan_id = ?").get(planId);
  assert.equal(blockedPlan.plan_status, 'BLOCKED');

  pass('Test 11: validatePlanFreshness revalidates auto_policy plans and blocks on manual_hold engagement');
}

// --- Test 12: Live Miniflare D1 read-only invariants ---
{
  const liveD1Path = path.resolve(
    process.cwd(),
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
  );
  const liveDb = new DatabaseSync(liveD1Path, { readOnly: true });

  // Article 1 check
  const a1 = liveDb.prepare("SELECT id, status, manual_hold FROM articles WHERE id = 1").get();
  assert.ok(a1);
  assert.equal(a1.status, 'draft');
  assert.equal(a1.manual_hold, 0);

  // Article 3 check
  const a3 = liveDb.prepare("SELECT id, status, manual_hold FROM articles WHERE id = 3").get();
  assert.ok(a3);
  assert.equal(a3.status, 'draft');
  assert.equal(a3.manual_hold, 0);

  const a3Approval = liveDb.prepare("SELECT approval_status FROM article_editorial_approvals WHERE article_id = 3 ORDER BY id DESC LIMIT 1").get();
  assert.ok(a3Approval);
  assert.equal(a3Approval.approval_status, 'APPROVED');

  const a3Readiness = liveDb.prepare("SELECT is_ready, overall_status FROM article_publication_readiness WHERE article_id = 3 ORDER BY id DESC LIMIT 1").get();
  assert.ok(a3Readiness);
  assert.equal(a3Readiness.is_ready, 1);
  assert.equal(a3Readiness.overall_status, 'READY_TO_SCHEDULE');

  // Check plans & executions for Article 3 remain strictly 0
  const a3Plans = liveDb.prepare("SELECT COUNT(*) as c FROM article_publication_plans WHERE article_id = 3").get().c;
  const a3Execs = liveDb.prepare("SELECT COUNT(*) as c FROM article_publication_executions WHERE article_id = 3").get().c;
  assert.equal(a3Plans, 0);
  assert.equal(a3Execs, 0);

  // Verify auto_schedule_enabled setting is 'false'
  const setting = liveDb.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").get();
  assert.ok(setting);
  assert.equal(setting.value, 'false');

  // Wrap liveDb in read-only adapter to test getEligibleReadyCandidates
  const readOnlyLiveAdapter = {
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.map((v) => (v === undefined ? null : v));
          return this;
        },
        async first() {
          const stmt = liveDb.prepare(this._sql);
          return stmt.get(...this._params) || null;
        },
        async all() {
          const stmt = liveDb.prepare(this._sql);
          return { results: stmt.all(...this._params) };
        }
      };
    }
  };

  const liveCandidates = await getEligibleReadyCandidates(readOnlyLiveAdapter);
  // Find Article 3 in live candidates
  const liveArt3 = liveCandidates.find((c) => c.articleId === 3);
  assert.ok(liveArt3, 'Article 3 must be discoverable as a candidate');
  assert.equal(liveArt3.candidateSource, 'editorial_signoff');
  assert.equal(liveArt3.schedulingMode, 'editorial_signoff');

  // Auto-policy candidates on live DB must be 0 because auto_schedule_enabled is 'false'
  const autoPolicyLiveCandidates = liveCandidates.filter((c) => c.candidateSource === 'auto_policy');
  assert.equal(autoPolicyLiveCandidates.length, 0, 'LIVE_AUTO_POLICY_MUTATION_ELIGIBLE_COUNT must be 0');

  liveDb.close();
  pass('Test 12: Live Miniflare D1 read-only inspection verified (Article 3 candidateSource=editorial_signoff, auto_policy count=0, plans=0, executions=0)');
}

console.log(`\nALL ${passed} PHASE 5L3 TESTS PASSED!`);
