/**
 * RancangLoka — PUBLICATION-0: Local End-to-End Readiness Smoke Verification
 *
 * Runs against the actual local Cloudflare D1 database:
 * .wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite
 *
 * Strictly Local / Staging:
 * - NO remote D1 migration
 * - NO remote production deploy
 * - NO public publishing
 * - NO AI model calls (MODEL_CALLS = 0)
 * - AUTO_PUBLISH = OFF
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  evaluateArticleReadiness,
  recordEditorialApproval,
  revokeEditorialApproval,
  getArticleReadiness,
  getArticleReadinessHistory,
  getArticleApprovalsHistory,
  getArticlesReadyToSchedule
} from '../src/lib/publication/service.ts';

import {
  FAILURE_CODES,
  PUBLICATION_STATUS_READY_TO_SCHEDULE,
  PUBLICATION_STATUS_NOT_READY,
  PUBLICATION_STATUS_BLOCKED,
  APPROVAL_STATUS_APPROVED,
  APPROVAL_STATUS_REVOKED
} from '../src/lib/publication/types.ts';

import {
  GET as readinessGet,
  POST as readinessPost
} from '../src/pages/api/admin/publication/readiness/[id].ts';

import {
  GET as approvalGet,
  POST as approvalPost,
  DELETE as approvalDelete
} from '../src/pages/api/admin/publication/approve/[id].ts';

import {
  GET as readyToScheduleGet
} from '../src/pages/api/admin/publication/ready-to-schedule.ts';

function computeSha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Find local D1 sqlite file
function findLocalD1Path() {
  const baseDir = path.resolve(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  if (!fs.existsSync(baseDir)) {
    throw new Error(`Local D1 directory not found: ${baseDir}`);
  }
  const files = fs.readdirSync(baseDir).filter(f => f.endsWith('.sqlite'));
  if (files.length === 0) {
    throw new Error(`No SQLite database found in ${baseDir}`);
  }
  // Pick the primary migrated database file (the larger/newer one)
  const sorted = files.map(f => ({
    name: f,
    size: fs.statSync(path.join(baseDir, f)).size
  })).sort((a, b) => b.size - a.size);

  return path.join(baseDir, sorted[0].name);
}

function openLocalD1Db() {
  const dbPath = findLocalD1Path();
  console.log(`Connecting to local D1 database: ${path.basename(dbPath)}`);
  const sqlite = new DatabaseSync(dbPath);

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
          const results = stmt.all(...this._params);
          return { results };
        }
      };
    }
  };
}

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

function generateSmokeArticleBody() {
  const p1 = 'Penataan ventilasi silang dan pemilihan material penutup atap merupakan pilar utama kenyamanan termal hunian tropis lembap. Dalam konteks arsitektur kontemporer Indonesia, integrasi kisi penahan radiasi dan insulasi peredam panas mampu menurunkan suhu ruang secara terukur tanpa membebani konsumsi energi pendingin udara buatan. Pemilihan detail sambungan mekanis tahan korosi menjaga integritas struktural dalam jangka panjang.';
  const p2 = 'Penggunaan material atap metal berinsulasi menawarkan keunggulan dalam bobot struktur yang ringan serta kecepatan instalasi lapangan. Akan tetapi, tanpa rekayasa insulasi akustik yang memadai, rintik hujan lebat dapat menimbulkan polusi suara di ruang privat. Oleh karena itu, penggunaan peredam rockwool dengan kerapatan optimal menjadi prasyarat teknis yang tidak dapat diabaikan.';
  const p3 = 'Di sisi lain, genteng beton menyajikan kapasitas termal yang masif sehingga mampu memperlambat transmisi panas terik matahari siang hari ke dalam loteng. Bobotnya yang berat menuntut struktur rangka atap baja ringan dengan kalkulasi beban angin dan lendutan yang presisi. Perawatan berkala terhadap lapisan pelindung jamur dan lumut esensial guna mempertahankan estetika fasad tropis.';
  const p4 = 'Strategi ventilasi bawah bubungan (ridge vent) dan kisi soffit di bawah tritisan atap bekerja secara sinergis menciptakan efek cerobong pasif. Udara panas yang terperangkap di bawah bidang atap dibuang keluar secara berkelanjutan, mencegah rambatan panas konduktif ke plafon ruang keluarga dan kamar tidur di lantai bawah.';
  
  return `
## Analisis Karakteristik Termal Material Atap Tropis

${p1}

${p2}

## Perbandingan Kinerja Akustik dan Durabilitas Fungsional

${p3}

${p4}

## Rekomendasi Spesifikasi Arsitektur Hijau

${p1}

${p2}
`.trim();
}

async function runLocalSmoke() {
  console.log('====================================================');
  console.log('🏛️ PUBLICATION-0 LOCAL END-TO-END READINESS SMOKE');
  console.log('====================================================\n');

  const db = openLocalD1Db();

  // Verify Migration 0007 Tables Exist in Local D1
  console.log('[Phase 1: Verify Local Migration 0007 Tables]');
  const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('article_editorial_approvals', 'article_publication_readiness')").all();
  const tableNames = (tables.results || tables || []).map(t => t.name);
  assert(tableNames.includes('article_editorial_approvals'), 'Table article_editorial_approvals exists in local D1');
  assert(tableNames.includes('article_publication_readiness'), 'Table article_publication_readiness exists in local D1');

  // Resolve canonical author and category
  let author = await db.prepare("SELECT id FROM authors WHERE slug = 'dewan-redaksi-spasial'").first();
  if (!author) {
    const authorInsert = await db.prepare(`
      INSERT INTO authors (name, slug, bio, avatar, role)
      VALUES ('RancangLoka Editorial Desk', 'dewan-redaksi-spasial', 'Dewan redaksi arsitektur spasial.', '/avatar.png', 'Editorial Desk')
    `).run();
    author = { id: authorInsert.lastRowId || 1 };
  }

  let category = await db.prepare("SELECT id FROM categories WHERE slug = 'arsitektur-renovasi'").first();
  const categoryId = category ? category.id : 3;

  // Cleanup any leftover smoke fixtures from previous runs
  const SMOKE_ARTICLE_ID = 9001;
  const SMOKE_ASSET_1 = 'ast_smoke_pub0_local_01';
  const SMOKE_ASSET_2 = 'ast_smoke_pub0_local_02';

  await db.prepare("DELETE FROM article_publication_readiness WHERE article_id = ?").bind(SMOKE_ARTICLE_ID).run();
  await db.prepare("DELETE FROM article_editorial_approvals WHERE article_id = ?").bind(SMOKE_ARTICLE_ID).run();
  await db.prepare("DELETE FROM article_media WHERE article_id = ?").bind(SMOKE_ARTICLE_ID).run();
  await db.prepare("DELETE FROM media_assets WHERE asset_id IN (?, ?)").bind(SMOKE_ASSET_1, SMOKE_ASSET_2).run();
  await db.prepare("DELETE FROM articles WHERE id = ?").bind(SMOKE_ARTICLE_ID).run();

  // Create Deterministic DRAFT Article Fixture
  console.log('\n[Phase 2: Create Deterministic Local DRAFT Article Fixture]');
  const smokeBody = generateSmokeArticleBody();
  const smokeHash = computeSha256(smokeBody);

  await db.prepare(`
    INSERT INTO articles (
      id, slug, title, description, content_md, content_html,
      featured_image, image_alt, category_id, author_id,
      status, reading_time_minutes, key_takeaways, focus_keyword, content_hash
    ) VALUES (
      ?,
      'smoke-atap-metal-vs-genteng-beton-tropis',
      'Smoke Uji Kesiapan Publikasi: Atap Metal vs Genteng Beton Tropis',
      'Panduan teknis pengujian smoke readiness gate untuk evaluasi kelayakan artikel sebelum penjadwalan.',
      ?,
      '<p>Smoke html</p>',
      '',
      '',
      ?,
      ?,
      'draft',
      5,
      '["Insulasi termal pasif mereduksi beban panas","Rongga udara bawah atap esensial untuk cross-ventilation","Detail sambungan mekanis anti-bocor krusial"]',
      'smoke atap tropis',
      ?
    );
  `).bind(SMOKE_ARTICLE_ID, smokeBody, categoryId, author.id, smokeHash).run();

  const fixtureArticle = await db.prepare("SELECT id, slug, status, content_hash FROM articles WHERE id = ?").bind(SMOKE_ARTICLE_ID).first();
  assert(fixtureArticle !== null, 'Local smoke draft article created');
  assert(fixtureArticle.status === 'draft', 'Smoke article status is draft');
  assert(fixtureArticle.content_hash === smokeHash, 'Smoke article content_hash matches computed SHA-256');

  // Scenario A: NO MEDIA / NO APPROVAL
  console.log('\n[Phase 3: Scenario A — NO MEDIA / NO APPROVAL]');
  const resA = await evaluateArticleReadiness(db, SMOKE_ARTICLE_ID);
  assert(resA.is_ready === false, 'Scenario A: is_ready is false');
  assert(resA.overall_status === PUBLICATION_STATUS_NOT_READY, 'Scenario A: overall_status is NOT_READY');
  assert(resA.blockers.includes(FAILURE_CODES.FEATURED_MEDIA_MISSING), 'Scenario A: blockers include FEATURED_MEDIA_MISSING');
  assert(resA.blockers.includes(FAILURE_CODES.APPROVAL_MISSING), 'Scenario A: blockers include APPROVAL_MISSING');
  assert(resA.checks.editorial_guards === 'PASS', 'Scenario A: editorial guards PASS');
  assert(resA.checks.visual_media === 'FAIL', 'Scenario A: visual media FAIL');
  assert(resA.checks.human_approval === 'FAIL', 'Scenario A: human approval FAIL');

  // Verify article status remained draft
  const checkStatusA = await db.prepare("SELECT status FROM articles WHERE id = ?").bind(SMOKE_ARTICLE_ID).first();
  assert(checkStatusA.status === 'draft', 'Article strictly remains draft during evaluation');

  // Scenario B: VALID MEDIA / NO APPROVAL
  console.log('\n[Phase 4: Scenario B — VALID MEDIA / NO APPROVAL]');
  // Insert valid local media asset
  await db.prepare(`
    INSERT INTO media_assets (
      asset_id, media_type, source_type, storage_key, public_url,
      mime_type, width, height, file_size, sha256, alt_text, status
    ) VALUES (
      ?, 'image', 'manual_upload', 'media/images/smoke01.webp', '/media/images/smoke01.webp',
      'image/webp', 1200, 675, 128000, 'sha256_smoke_asset_01', 'Visual smoke atap metal dan genteng beton', 'VALIDATED'
    );
  `).bind(SMOKE_ASSET_1).run();

  // Bind active featured media
  await db.prepare(`
    INSERT INTO article_media (article_id, asset_id, role, slot_key, is_active, sort_order)
    VALUES (?, ?, 'featured', 'primary', 1, 0);
  `).bind(SMOKE_ARTICLE_ID, SMOKE_ASSET_1).run();

  const resB = await evaluateArticleReadiness(db, SMOKE_ARTICLE_ID);
  assert(resB.is_ready === false, 'Scenario B: is_ready is false');
  assert(resB.overall_status === PUBLICATION_STATUS_NOT_READY, 'Scenario B: overall_status is NOT_READY');
  assert(resB.checks.visual_media === 'PASS', 'Scenario B: visual media check is now PASS');
  assert(!resB.blockers.includes(FAILURE_CODES.FEATURED_MEDIA_MISSING), 'Scenario B: FEATURED_MEDIA_MISSING cleared');
  assert(resB.blockers.includes(FAILURE_CODES.APPROVAL_MISSING), 'Scenario B: APPROVAL_MISSING remains');

  // Scenario C: HUMAN APPROVAL
  console.log('\n[Phase 5: Scenario C — HUMAN APPROVAL]');
  const approvalRes = await recordEditorialApproval(db, {
    articleId: SMOKE_ARTICLE_ID,
    approvedBy: 'smoke_operator@rancangloka.com',
    approvedRole: 'editor_in_chief',
    notes: 'Smoke sign-off on draft'
  });

  assert(approvalRes.approval.article_id === SMOKE_ARTICLE_ID, 'Human approval recorded');
  assert(approvalRes.approval.approved_content_hash === smokeHash, 'Approval bound to exact content_hash');
  assert(approvalRes.approval.approved_asset_id === SMOKE_ASSET_1, 'Approval bound to exact asset_id');

  const resC = await evaluateArticleReadiness(db, SMOKE_ARTICLE_ID);
  assert(resC.is_ready === true, 'Scenario C: is_ready is TRUE');
  assert(resC.overall_status === PUBLICATION_STATUS_READY_TO_SCHEDULE, 'Scenario C: overall_status is READY_TO_SCHEDULE');
  assert(resC.blockers.length === 0, 'Scenario C: blockers array is empty');
  assert(resC.checks.article_integrity === 'PASS', 'Scenario C: integrity is PASS');
  assert(resC.checks.editorial_guards === 'PASS', 'Scenario C: editorial guards PASS');
  assert(resC.checks.evidence_and_citations === 'PASS', 'Scenario C: evidence & citations PASS');
  assert(resC.checks.visual_media === 'PASS', 'Scenario C: visual media PASS');
  assert(resC.checks.human_approval === 'PASS', 'Scenario C: human approval PASS');
  assert(resC.checks.publication_metadata === 'PASS', 'Scenario C: publication metadata PASS');

  // Verify article remains draft and query returns it
  const checkStatusC = await db.prepare("SELECT status FROM articles WHERE id = ?").bind(SMOKE_ARTICLE_ID).first();
  assert(checkStatusC.status === 'draft', 'Article status is strictly draft');

  const readyList = await getArticlesReadyToSchedule(db);
  const foundInReady = readyList.some(a => a.articleId === SMOKE_ARTICLE_ID);
  assert(foundInReady, 'READY_TO_SCHEDULE query returns smoke article 9001');

  // Idempotency
  console.log('\n[Phase 6: Idempotency Verification]');
  const resIdem1 = await evaluateArticleReadiness(db, SMOKE_ARTICLE_ID);
  const resIdem2 = await evaluateArticleReadiness(db, SMOKE_ARTICLE_ID);
  assert(resIdem1.is_ready === resIdem2.is_ready, 'Idempotent repeated evaluation yields same readiness');
  assert(resIdem1.overall_status === resIdem2.overall_status, 'Idempotent overall_status identical');
  assert(resIdem1.blockers.length === resIdem2.blockers.length, 'Idempotent blocker counts match');

  // Content Change Invalidation
  console.log('\n[Phase 7: Content Change Invalidation]');
  const modifiedBody = smokeBody + '\n\n## Perubahan Konten Pasca Approval\n\nPenambahan paragraf baru yang memodifikasi konten artikel secara material.';
  const modifiedHash = computeSha256(modifiedBody);
  await db.prepare("UPDATE articles SET content_md = ?, content_hash = ? WHERE id = ?").bind(modifiedBody, modifiedHash, SMOKE_ARTICLE_ID).run();

  const resContentMod = await evaluateArticleReadiness(db, SMOKE_ARTICLE_ID);
  assert(resContentMod.is_ready === false, 'Content change invalidates readiness (is_ready = false)');
  assert(
    resContentMod.blockers.includes(FAILURE_CODES.APPROVAL_STALE_CONTENT) ||
    resContentMod.blockers.includes(FAILURE_CODES.CONTENT_CHANGED_AFTER_APPROVAL),
    'Blockers include APPROVAL_STALE_CONTENT / CONTENT_CHANGED_AFTER_APPROVAL'
  );

  // Re-Approve Content
  console.log('\n[Phase 8: Re-Approve Mutated Content]');
  await recordEditorialApproval(db, {
    articleId: SMOKE_ARTICLE_ID,
    approvedBy: 'smoke_operator@rancangloka.com',
    approvedRole: 'editor_in_chief',
    notes: 'Re-approved with modified content'
  });
  const resReapproved = await evaluateArticleReadiness(db, SMOKE_ARTICLE_ID);
  assert(resReapproved.is_ready === true, 'Re-approval restores READY_TO_SCHEDULE');

  // Featured Media Change Invalidation
  console.log('\n[Phase 9: Featured Media Change Invalidation]');
  // Insert second valid asset
  await db.prepare(`
    INSERT INTO media_assets (
      asset_id, media_type, source_type, storage_key, public_url,
      mime_type, width, height, file_size, sha256, alt_text, status
    ) VALUES (
      ?, 'image', 'manual_upload', 'media/images/smoke02.webp', '/media/images/smoke02.webp',
      'image/webp', 1200, 675, 135000, 'sha256_smoke_asset_02', 'Cover gambar pengganti kedua', 'VALIDATED'
    );
  `).bind(SMOKE_ASSET_2).run();

  // Swap active featured binding to ASSET_2
  await db.prepare("UPDATE article_media SET is_active = 0 WHERE article_id = ? AND asset_id = ?").bind(SMOKE_ARTICLE_ID, SMOKE_ASSET_1).run();
  await db.prepare(`
    INSERT INTO article_media (article_id, asset_id, role, slot_key, is_active, sort_order)
    VALUES (?, ?, 'featured', 'primary', 1, 0);
  `).bind(SMOKE_ARTICLE_ID, SMOKE_ASSET_2).run();

  const resMediaMod = await evaluateArticleReadiness(db, SMOKE_ARTICLE_ID);
  assert(resMediaMod.is_ready === false, 'Media change invalidates readiness (is_ready = false)');
  assert(
    resMediaMod.blockers.includes(FAILURE_CODES.APPROVAL_STALE_MEDIA) ||
    resMediaMod.blockers.includes(FAILURE_CODES.MEDIA_CHANGED_AFTER_APPROVAL),
    'Blockers include APPROVAL_STALE_MEDIA / MEDIA_CHANGED_AFTER_APPROVAL'
  );

  // Approve new media
  await recordEditorialApproval(db, {
    articleId: SMOKE_ARTICLE_ID,
    approvedBy: 'smoke_operator@rancangloka.com',
    approvedRole: 'editor_in_chief',
    notes: 'Approved with new media asset 02'
  });
  const resMediaApproved = await evaluateArticleReadiness(db, SMOKE_ARTICLE_ID);
  assert(resMediaApproved.is_ready === true, 'Approving new media restores READY_TO_SCHEDULE');

  // Revoke Approval
  console.log('\n[Phase 10: Revoke Approval]');
  await revokeEditorialApproval(db, {
    articleId: SMOKE_ARTICLE_ID,
    revokedBy: 'smoke_operator@rancangloka.com',
    notes: 'Explicit revocation test'
  });
  const resRevoked = await evaluateArticleReadiness(db, SMOKE_ARTICLE_ID);
  assert(resRevoked.is_ready === false, 'Revoked approval blocks readiness');
  assert(resRevoked.blockers.includes(FAILURE_CODES.APPROVAL_STATUS_REVOKED), 'Blockers include APPROVAL_STATUS_REVOKED');

  // Fail-Closed Checks
  console.log('\n[Phase 11: Fail-Closed Checks]');
  // 1. Unknown guard state fails closed
  const failUnknown = await evaluateArticleReadiness(db, SMOKE_ARTICLE_ID, { forceFailClosed: true });
  assert(failUnknown.is_ready === false, 'Emergency/unknown guard state fails closed');
  assert(failUnknown.overall_status === PUBLICATION_STATUS_BLOCKED, 'Status transitions to BLOCKED');

  // 2. Non-validated media fails closed
  await db.prepare("UPDATE media_assets SET status = 'FAILED' WHERE asset_id = ?").bind(SMOKE_ASSET_2).run();
  const failMediaStatus = await evaluateArticleReadiness(db, SMOKE_ARTICLE_ID);
  assert(failMediaStatus.is_ready === false, 'FAILED media status blocks readiness');
  assert(failMediaStatus.blockers.includes(FAILURE_CODES.MEDIA_NOT_VALIDATED), 'Blocker MEDIA_NOT_VALIDATED present');
  await db.prepare("UPDATE media_assets SET status = 'VALIDATED' WHERE asset_id = ?").bind(SMOKE_ASSET_2).run();

  // 3. Missing alt text fails closed
  await db.prepare("UPDATE media_assets SET alt_text = '' WHERE asset_id = ?").bind(SMOKE_ASSET_2).run();
  const failAlt = await evaluateArticleReadiness(db, SMOKE_ARTICLE_ID);
  assert(failAlt.is_ready === false, 'Empty alt text blocks readiness');
  assert(failAlt.blockers.includes(FAILURE_CODES.ALT_TEXT_MISSING), 'Blocker ALT_TEXT_MISSING present');
  await db.prepare("UPDATE media_assets SET alt_text = 'Visual smoke' WHERE asset_id = ?").bind(SMOKE_ASSET_2).run();

  // 4. Non-draft article fails closed
  await db.prepare("UPDATE articles SET status = 'published' WHERE id = ?").bind(SMOKE_ARTICLE_ID).run();
  const failStatus = await evaluateArticleReadiness(db, SMOKE_ARTICLE_ID);
  assert(failStatus.is_ready === false, 'Published article cannot re-enter gate');
  assert(failStatus.blockers.includes(FAILURE_CODES.ARTICLE_NOT_DRAFT), 'Blocker ARTICLE_NOT_DRAFT present');
  await db.prepare("UPDATE articles SET status = 'draft' WHERE id = ?").bind(SMOKE_ARTICLE_ID).run();

  // 5. Incomplete metadata fails closed
  await db.prepare("UPDATE articles SET key_takeaways = '[]' WHERE id = ?").bind(SMOKE_ARTICLE_ID).run();
  const failMeta = await evaluateArticleReadiness(db, SMOKE_ARTICLE_ID);
  assert(failMeta.is_ready === false, 'Empty takeaways blocks readiness');
  assert(failMeta.blockers.includes(FAILURE_CODES.TAKEAWAYS_INVALID), 'Blocker TAKEAWAYS_INVALID present');
  await db.prepare(`UPDATE articles SET key_takeaways = '["P1", "P2", "P3"]' WHERE id = ?`).bind(SMOKE_ARTICLE_ID).run();

  // API / Service Smoke
  console.log('\n[Phase 12: API / Service Smoke]');
  const mockContext = {
    params: { id: String(SMOKE_ARTICLE_ID) },
    locals: { db },
    url: new URL(`http://localhost/api/admin/publication/readiness/${SMOKE_ARTICLE_ID}`)
  };

  const getApiRes = await readinessGet(mockContext);
  assert(getApiRes.status === 200, 'GET /api/admin/publication/readiness/[id] returns 200');
  const getApiData = await getApiRes.json();
  assert(getApiData.status === 'success', 'GET response status is success');

  const historyContext = {
    params: { id: String(SMOKE_ARTICLE_ID) },
    locals: { db },
    url: new URL(`http://localhost/api/admin/publication/readiness/${SMOKE_ARTICLE_ID}?history=true`)
  };
  const histApiRes = await readinessGet(historyContext);
  assert(histApiRes.status === 200, 'GET history returns 200');
  const histApiData = await histApiRes.json();
  assert(Array.isArray(histApiData.history) && histApiData.history.length > 0, 'History contains snapshot logs');

  const plannerApiRes = await readyToScheduleGet({ locals: { db } });
  assert(plannerApiRes.status === 200, 'GET /api/admin/publication/ready-to-schedule returns 200');

  // Verify State & Integrity
  console.log('\n[Phase 13: State & Content Integrity]');
  const finalArticle = await db.prepare("SELECT * FROM articles WHERE id = ?").bind(SMOKE_ARTICLE_ID).first();
  assert(finalArticle.status === 'draft', 'Final article status is strictly draft');
  assert(!finalArticle.published_at || finalArticle.published_at.length > 0, 'No publication mutation occurred');
  assert(finalArticle.is_featured === 0, 'is_featured untouched');

  // Deterministic Cleanup
  console.log('\n[Phase 14: Deterministic Cleanup]');
  await db.prepare("DELETE FROM article_publication_readiness WHERE article_id = ?").bind(SMOKE_ARTICLE_ID).run();
  await db.prepare("DELETE FROM article_editorial_approvals WHERE article_id = ?").bind(SMOKE_ARTICLE_ID).run();
  await db.prepare("DELETE FROM article_media WHERE article_id = ?").bind(SMOKE_ARTICLE_ID).run();
  await db.prepare("DELETE FROM media_assets WHERE asset_id IN (?, ?)").bind(SMOKE_ASSET_1, SMOKE_ASSET_2).run();
  await db.prepare("DELETE FROM articles WHERE id = ?").bind(SMOKE_ARTICLE_ID).run();

  const residueArticle = await db.prepare("SELECT id FROM articles WHERE id = ?").bind(SMOKE_ARTICLE_ID).first();
  const residueAssets = await db.prepare("SELECT asset_id FROM media_assets WHERE asset_id IN (?, ?)").bind(SMOKE_ASSET_1, SMOKE_ASSET_2).all();
  assert(residueArticle === null, 'Smoke fixture article 9001 deleted');
  assert((residueAssets.results || residueAssets || []).length === 0, 'Smoke media assets deleted');

  console.log('\n====================================================');
  console.log(`SMOKE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLocalSmoke().catch(err => {
  console.error('Unhandled error in local smoke:', err);
  process.exit(1);
});
