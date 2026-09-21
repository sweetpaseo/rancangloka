/**
 * RancangLoka — Phase 5L2 Test Suite
 * System Publication Policy & Hands-Off Auto-Schedule Foundation
 *
 * Deterministic Test Matrix:
 * Test A: All automated gates PASS, no human approval -> system_policy_pass YES, human_approval_pass NO
 * Test B: Automated content gate fails (placeholder) -> system_policy_pass NO
 * Test C: Media gate fails (missing featured media) -> system_policy_pass NO
 * Test D: manual_hold = 1 -> auto_schedule_eligible NO
 * Test E: auto_schedule_enabled = false -> auto_schedule_eligible NO
 * Test F: kill switch engaged = 1 -> auto_schedule_eligible NO
 * Test G: automation mode disallows scheduling (OFF / OBSERVE_ONLY) -> auto_schedule_eligible NO
 * Test H: active plan exists -> auto_schedule_eligible NO
 * Test I: active execution exists -> auto_schedule_eligible NO
 * Test J: all controls PASS, system_policy_pass YES, no human approval -> auto_schedule_eligible YES (NO plan created)
 * Test K: live Miniflare D1 Article 1 and Article 3 state frozen and unregressed
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { evaluateArticleReadiness } from '../src/lib/publication/service.ts';
import { evaluateAutoScheduleEligibility } from '../src/lib/publication/auto-policy.ts';

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

  // Additive migrations that are not already baked into base schema.sql
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
  const slug = overrides.slug || 'artikel-uji-kebijakan-otomatis';
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

console.log('=== RUNNING PHASE 5L2 TEST SUITE ===');

// --- Test A: All automated gates PASS, no human approval ---
{
  const db = createTestD1();
  const { articleId } = seedTestArticle(db, { id: 201 });

  const snapshot = await evaluateArticleReadiness(db, articleId);

  // In Phase 5L2: legacy overall_status is NOT_READY due to APPROVAL_MISSING
  assert.equal(snapshot.overall_status, 'NOT_READY');
  assert.ok(snapshot.blockers.includes('APPROVAL_MISSING'));

  // BUT: system_policy_pass is independently TRUE!
  assert.equal(snapshot.policy?.system_policy_pass, true);
  assert.equal(snapshot.policy?.human_approval_pass, false);
  assert.equal(snapshot.checks.article_integrity, 'PASS');
  assert.equal(snapshot.checks.editorial_guards, 'PASS');
  assert.equal(snapshot.checks.evidence_and_citations, 'PASS');
  assert.equal(snapshot.checks.visual_media, 'PASS');
  assert.equal(snapshot.checks.publication_metadata, 'PASS');
  assert.equal(snapshot.checks.human_approval, 'FAIL');

  pass('Test A: all automated gates PASS without approval -> system_policy_pass=true, human_approval_pass=false');
}

// --- Test B: Automated content gate fails ---
{
  const db = createTestD1();
  const badContent = `${generateValidArticleBody()}\n\n[EVIDENCE NEEDED] - Biaya renovasi sekitar Rp 500.000.000.`;
  const { articleId } = seedTestArticle(db, { id: 202, content_md: badContent });

  const snapshot = await evaluateArticleReadiness(db, articleId);
  assert.equal(snapshot.policy?.system_policy_pass, false);
  assert.equal(snapshot.checks.editorial_guards, 'FAIL');
  assert.ok(snapshot.blockers.includes('ARTICLE_CONTRACT_FAILED') || snapshot.blockers.includes('MONETARY_GUARD_FAILED'));

  pass('Test B: automated content gate failure -> system_policy_pass=false');
}

// --- Test C: Media gate fails ---
{
  const db = createTestD1();
  const { articleId } = seedTestArticle(db, { id: 203 });

  // Invalidate media binding (set is_active = 0)
  db.raw.prepare("UPDATE article_media SET is_active = 0 WHERE article_id = ?").run(articleId);

  const snapshot = await evaluateArticleReadiness(db, articleId);
  assert.equal(snapshot.policy?.system_policy_pass, false);
  assert.equal(snapshot.checks.visual_media, 'FAIL');
  assert.ok(snapshot.blockers.includes('FEATURED_MEDIA_MISSING'));

  pass('Test C: media gate failure -> system_policy_pass=false');
}

// --- Test D: manual_hold = 1 blocks auto_schedule_eligible ---
{
  const db = createTestD1();
  const { articleId } = seedTestArticle(db, { id: 204, manual_hold: 1 });

  // Enable global auto schedule & automation mode for isolated test of manual_hold
  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'UNATTENDED', kill_switch_engaged = 0 WHERE id = 1").run();

  const eligibility = await evaluateAutoScheduleEligibility(db, articleId, { forceLiveReadinessEvaluation: true });
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.manual_hold, true);
  assert.ok(eligibility.reasons.includes('MANUAL_HOLD_ENGAGED'));

  pass('Test D: manual_hold=1 blocks auto_schedule_eligibility');
}

// --- Test E: auto_schedule_enabled = false blocks eligibility ---
{
  const db = createTestD1();
  const { articleId } = seedTestArticle(db, { id: 205, manual_hold: 0 });

  // Keep auto_schedule_enabled = 'false' (default)
  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'false')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'UNATTENDED', kill_switch_engaged = 0 WHERE id = 1").run();

  const eligibility = await evaluateAutoScheduleEligibility(db, articleId, { forceLiveReadinessEvaluation: true });
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.auto_schedule_enabled, false);
  assert.ok(eligibility.reasons.includes('GLOBAL_AUTO_SCHEDULE_DISABLED'));

  pass('Test E: auto_schedule_enabled=false blocks auto_schedule_eligibility');
}

// --- Test F: kill switch engaged blocks eligibility ---
{
  const db = createTestD1();
  const { articleId } = seedTestArticle(db, { id: 206, manual_hold: 0 });

  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'UNATTENDED', kill_switch_engaged = 1 WHERE id = 1").run();

  const eligibility = await evaluateAutoScheduleEligibility(db, articleId, { forceLiveReadinessEvaluation: true });
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.kill_switch_engaged, true);
  assert.ok(eligibility.reasons.includes('KILL_SWITCH_ENGAGED'));

  pass('Test F: kill_switch_engaged=1 blocks auto_schedule_eligibility');
}

// --- Test G: automation mode disallows scheduling ---
{
  const db = createTestD1();
  const { articleId } = seedTestArticle(db, { id: 207, manual_hold: 0 });

  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'OFF', kill_switch_engaged = 0 WHERE id = 1").run();

  const eligibility = await evaluateAutoScheduleEligibility(db, articleId, { forceLiveReadinessEvaluation: true });
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.automation_mode_allowed, false);
  assert.ok(eligibility.reasons.some((r) => r.startsWith('AUTOMATION_MODE_BLOCKED')));

  pass('Test G: automation mode OFF blocks auto_schedule_eligibility');
}

// --- Test H: active plan exists blocks duplicate eligibility ---
{
  const db = createTestD1();
  const { articleId, contentHash, assetId } = seedTestArticle(db, { id: 208, manual_hold: 0 });

  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'UNATTENDED', kill_switch_engaged = 0 WHERE id = 1").run();

  // Insert active PLANNED plan
  const readinessRes = db.raw.prepare(`
    INSERT INTO article_publication_readiness (
      article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at
    ) VALUES (?, 0, 'NOT_READY', ?, '{}', CURRENT_TIMESTAMP)
  `).run(articleId, contentHash);
  const readinessId = Number(readinessRes.lastInsertRowid);

  db.raw.prepare(`
    INSERT INTO article_publication_plans (
      plan_id, article_id, readiness_id, content_hash, featured_asset_id,
      target_publish_at, target_publish_local, plan_status, planner_profile,
      priority_score, slot_index, reason_codes, scheduling_mode
    ) VALUES ('plan_test_208', ?, ?, ?, ?, CURRENT_TIMESTAMP, '2026-09-22 10:00:00', 'PLANNED', 'GROWING', 1.0, 0, '[]', 'auto_policy')
  `).run(articleId, readinessId, contentHash, assetId);

  const eligibility = await evaluateAutoScheduleEligibility(db, articleId, { forceLiveReadinessEvaluation: true });
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.has_active_plan, true);
  assert.ok(eligibility.reasons.includes('ACTIVE_PLAN_EXISTS'));

  pass('Test H: active PLANNED plan blocks duplicate auto_schedule_eligibility');
}

// --- Test I: active execution exists blocks duplicate eligibility ---
{
  const db = createTestD1();
  const { articleId, contentHash, assetId } = seedTestArticle(db, { id: 209, manual_hold: 0 });

  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'UNATTENDED', kill_switch_engaged = 0 WHERE id = 1").run();

  // Insert plan first to satisfy foreign key constraint on executions.plan_id
  const readinessRes = db.raw.prepare(`
    INSERT INTO article_publication_readiness (
      article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at
    ) VALUES (?, 0, 'NOT_READY', ?, '{}', CURRENT_TIMESTAMP)
  `).run(articleId, contentHash);
  const readinessId = Number(readinessRes.lastInsertRowid);

  db.raw.prepare(`
    INSERT INTO article_publication_plans (
      plan_id, article_id, readiness_id, content_hash, featured_asset_id,
      target_publish_at, target_publish_local, plan_status, planner_profile,
      priority_score, slot_index, reason_codes, scheduling_mode
    ) VALUES ('plan_test_209', ?, ?, ?, ?, CURRENT_TIMESTAMP, '2026-09-22 10:00:00', 'SUPERSEDED', 'GROWING', 1.0, 0, '[]', 'auto_policy')
  `).run(articleId, readinessId, contentHash, assetId);

  // Insert active execution in SCHEDULED state
  db.raw.prepare(`
    INSERT INTO article_publication_executions (
      execution_id, plan_id, article_id, content_hash, featured_asset_id,
      target_publish_at, execution_status, execution_mode
    ) VALUES ('exec_test_209', 'plan_test_209', ?, ?, ?, CURRENT_TIMESTAMP, 'SCHEDULED', 'auto_schedule')
  `).run(articleId, contentHash, assetId);

  const eligibility = await evaluateAutoScheduleEligibility(db, articleId, { forceLiveReadinessEvaluation: true });
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.has_active_execution, true);
  assert.ok(eligibility.reasons.includes('ACTIVE_OR_COMPLETED_EXECUTION_EXISTS'));

  pass('Test I: active execution blocks duplicate auto_schedule_eligibility');
}

// --- Test J: all controls PASS, system_policy_pass YES, NO human approval -> auto_schedule_eligible YES (zero plans created) ---
{
  const db = createTestD1();
  const { articleId } = seedTestArticle(db, { id: 210, manual_hold: 0 });

  db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_schedule_enabled', 'true')").run();
  db.raw.prepare("UPDATE automation_control SET mode = 'UNATTENDED', kill_switch_engaged = 0 WHERE id = 1").run();

  const eligibility = await evaluateAutoScheduleEligibility(db, articleId, { forceLiveReadinessEvaluation: true });
  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.system_policy_pass, true);
  assert.equal(eligibility.manual_hold, false);
  assert.equal(eligibility.auto_schedule_enabled, true);
  assert.equal(eligibility.automation_mode_allowed, true);
  assert.equal(eligibility.kill_switch_engaged, false);
  assert.equal(eligibility.has_active_plan, false);
  assert.equal(eligibility.has_active_execution, false);
  assert.equal(eligibility.reasons.length, 0);

  // Verify that evaluating eligibility created ZERO plans and ZERO executions!
  const planCount = db.raw.prepare("SELECT COUNT(*) as c FROM article_publication_plans").get().c;
  const execCount = db.raw.prepare("SELECT COUNT(*) as c FROM article_publication_executions").get().c;
  assert.equal(planCount, 0);
  assert.equal(execCount, 0);

  pass('Test J: all controls PASS -> auto_schedule_eligible=true without human approval and ZERO plans created');
}

// --- Test K: Live Miniflare D1 regression verification (Articles 1 and 3) ---
{
  const liveD1Path = path.resolve(
    process.cwd(),
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
  );
  const liveDb = new DatabaseSync(liveD1Path, { readOnly: true });

  // Article 1: unchanged, manual_hold=0, status=draft
  const a1 = liveDb.prepare("SELECT id, status, manual_hold FROM articles WHERE id = 1").get();
  assert.ok(a1, 'Article 1 exists in live D1');
  assert.equal(a1.status, 'draft');
  assert.equal(a1.manual_hold, 0);

  // Article 3: unchanged, manual_hold=0, status=draft, approval=APPROVED
  const a3 = liveDb.prepare("SELECT id, status, manual_hold FROM articles WHERE id = 3").get();
  assert.ok(a3, 'Article 3 exists in live D1');
  assert.equal(a3.status, 'draft');
  assert.equal(a3.manual_hold, 0);

  const a3Approval = liveDb.prepare("SELECT approval_status FROM article_editorial_approvals WHERE article_id = 3 ORDER BY id DESC LIMIT 1").get();
  assert.ok(a3Approval, 'Article 3 approval exists');
  assert.equal(a3Approval.approval_status, 'APPROVED');

  const a3Readiness = liveDb.prepare("SELECT is_ready, overall_status FROM article_publication_readiness WHERE article_id = 3 ORDER BY id DESC LIMIT 1").get();
  assert.ok(a3Readiness, 'Article 3 readiness row exists');
  assert.equal(a3Readiness.is_ready, 1);
  assert.equal(a3Readiness.overall_status, 'READY_TO_SCHEDULE');

  // Zero plans, zero executions in live DB
  const livePlans = liveDb.prepare("SELECT COUNT(*) as c FROM article_publication_plans WHERE article_id = 3").get().c;
  const liveExecs = liveDb.prepare("SELECT COUNT(*) as c FROM article_publication_executions WHERE article_id = 3").get().c;
  assert.equal(livePlans, 0);
  assert.equal(liveExecs, 0);

  // Settings: auto_schedule_enabled is 'false'
  const setting = liveDb.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").get();
  assert.ok(setting, 'auto_schedule_enabled setting exists');
  assert.equal(setting.value, 'false');

  liveDb.close();
  pass('Test K: live D1 Article 1, Article 3, and settings state verified frozen and unregressed');
}

console.log(`\nALL ${passed} PHASE 5L2 TESTS PASSED!`);
