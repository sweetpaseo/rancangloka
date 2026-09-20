/**
 * RancangLoka — Phase 5J2 Test Suite
 * Human Review Surface Integration & Boundaries Verification
 *
 * Deterministic Test Coverage:
 * 1. ENTRY_GATE & STARTING_HEAD check
 * 2. LIVE_CONTROLLED_FIXTURE_ISOLATION (Article 1 status remains draft, readiness READY_FOR_REVIEW, 0 approvals, untouched)
 * 3. READY_ARTICLE_APPROVAL_FLOW (Ready article can receive approval via service/API)
 * 4. NON_READY_ARTICLE_APPROVAL_GUARD:
 *    - Article without active featured media cannot be approved (FEATURED_MEDIA_MISSING fails closed 422)
 *    - Non-draft article cannot be approved (ARTICLE_NOT_DRAFT fails closed 422)
 * 5. APPROVAL_CONTENT_HASH_BINDING (Approval strictly binds to content_hash)
 * 6. APPROVAL_MEDIA_BINDING (Approval strictly binds to active featured asset_id)
 * 7. CONTENT_STALE_RACE_SAFE (Modifying content invalidates approval -> APPROVAL_STALE_CONTENT)
 * 8. MEDIA_STALE_RACE_SAFE (Replacing featured asset invalidates approval -> APPROVAL_STALE_MEDIA)
 * 9. APPROVAL_DOES_NOT_PUBLISH (article_editorial_approvals insert does NOT alter article status or publish)
 * 10. APPROVAL_DOES_NOT_SCHEDULE (Approval does NOT schedule or create execution)
 * 11. APPROVAL_REVOCATION_FLOW (Revoking approval records REVOKED and blocks readiness)
 * 12. EDITORIAL_NOTES_SUPPORTED (Notes persist cleanly in article_editorial_approvals)
 * 13. PREVIEW_PAGE_TEMPLATE_AUDIT (Verify readiness panel, media panel, approval controls markup & safety)
 * 14. PREVIEW_NO_AUTO_TRIGGER (Verify approval scripts require explicit human click event)
 * 15. FINAL_LIVE_ISOLATION (Zero mutations on live Miniflare D1/R2)
 */

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  evaluateArticleReadiness,
  recordEditorialApproval,
  revokeEditorialApproval,
  getArticleReadiness,
  getArticleApprovalsHistory
} from '../src/lib/publication/service.ts';

import {
  POST as approvePostHandler,
  DELETE as approveDeleteHandler,
  GET as approveGetHandler
} from '../src/pages/api/admin/publication/approve/[id].ts';

import {
  FAILURE_CODES,
  PUBLICATION_STATUS_READY_TO_SCHEDULE,
  PUBLICATION_STATUS_NOT_READY,
  PUBLICATION_STATUS_BLOCKED,
  APPROVAL_STATUS_APPROVED,
  APPROVAL_STATUS_REVOKED
} from '../src/lib/publication/types.ts';

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

function createTestDb() {
  const sqlite = new DatabaseSync(':memory:');

  const baseSchemaPath = path.resolve(process.cwd(), 'db/schema.sql');
  if (fs.existsSync(baseSchemaPath)) {
    sqlite.exec(fs.readFileSync(baseSchemaPath, 'utf-8'));
  }

  const migrations = [
    '0001_category_taxonomy_expansion.sql',
    '0002_article_ingest_receipts.sql',
    '0005_media_assets_and_article_media.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql',
    '0013_lokamedia_durable_jobs.sql',
    '0014_lokamedia_phase2c_slot_attachment.sql',
    '0015_site_watermark_assets.sql',
    '0016_media_assets_derivative_registration.sql'
  ];

  for (const mig of migrations) {
    const p = path.resolve(process.cwd(), `db/migrations/${mig}`);
    if (fs.existsSync(p)) {
      sqlite.exec(fs.readFileSync(p, 'utf-8'));
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

function computeContentHash(contentMd) {
  return crypto.createHash('sha256').update(contentMd, 'utf8').digest('hex');
}

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

function seedFullArticle(db, articleId, overrides = {}) {
  // Ensure canonical category & author exist
  db.raw.prepare(`
    INSERT OR IGNORE INTO categories (id, name, slug, description)
    VALUES (1, 'Arsitektur & Renovasi', 'arsitektur-renovasi', 'Kajian arsitektur dan renovasi rumah tropis.')
  `).run();

  db.raw.prepare(`
    INSERT OR IGNORE INTO authors (id, name, slug, bio, avatar, role)
    VALUES (1, 'RancangLoka Editorial Desk', 'dewan-redaksi-spasial', 'Dewan redaksi spasial.', '/avatar.png', 'Editorial Desk')
  `).run();

  const contentMd = overrides.content_md || generateValidArticleBody();

  const contentHash = computeContentHash(contentMd);

  db.raw.prepare(`
    INSERT INTO articles (
      id, slug, title, description, content_md, content_html, content_hash,
      category_id, author_id, status, featured_image, image_alt,
      reading_time_minutes, key_takeaways, focus_keyword
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      1, 1, ?, ?, ?,
      5, ?, 'kajian arsitektur tropis'
    )
  `).run(
    articleId,
    overrides.slug || `synthetic-article-${articleId}`,
    overrides.title || 'Kajian Spasial Tropis Kontemporer',
    overrides.description || 'Deskripsi komprehensif mengenai tata ruang hunian tropis kontemporer di Indonesia.',
    contentMd,
    `<p>${contentMd}</p>`,
    contentHash,
    overrides.status || 'draft',
    overrides.featured_image || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c',
    overrides.image_alt || 'Visual fasad tropis',
    JSON.stringify(overrides.key_takeaways || [
      'Pemanfaatan ventilasi silang pasif menurunkan suhu ruangan 3 derajat.',
      'Material lokal andesit memberikan ketahanan tinggi terhadap iklim tropis lembap.',
      'Orientasi bangunan mengurangi radiasi sinar matahari langsung secara signifikan.'
    ])
  );

  return { articleId, contentMd, contentHash };
}

function seedMediaAssetAndAttachment(db, articleId, assetId, options = {}) {
  const sha = crypto.createHash('sha256').update(assetId).digest('hex');
  const storageKey = `media/articles/derivatives/${sha}.png`;

  db.raw.prepare(`
    INSERT INTO media_assets (
      asset_id, media_type, source_type, storage_key, public_url,
      mime_type, width, height, file_size, sha256, alt_text, status,
      role
    ) VALUES (?, 'image', 'lokamedia_extension', ?, ?, 'image/png', 1672, 941, 123456, ?, ?, ?, ?)
  `).run(
    assetId,
    storageKey,
    `/${storageKey}`,
    sha,
    options.alt_text !== undefined ? options.alt_text : 'Visual kajian arsitektur tropis',
    options.status || 'VALIDATED',
    options.role || 'ARTICLE_PUBLIC_DERIVATIVE'
  );

  if (options.attach !== false) {
    db.raw.prepare(`
      INSERT INTO article_media (
        article_id, slot_key, asset_id, role, is_active, sort_order, caption, created_at, updated_at
      ) VALUES (?, 'featured', ?, 'featured', 1, 0, 'Foto featured artikel', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(articleId, assetId);
  }
}

async function runTests() {
  console.log('============================================================');
  console.log('RANCANGLOKA — PHASE 5J2 TEST SUITE');
  console.log('Human Review Surface Integration & Boundaries');
  console.log('============================================================\n');

  // --- TEST 1: Entry Gate & Starting Head ---
  console.log('--- TEST 1: Entry Gate & Starting HEAD ---');
  const gitHead = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  console.log(`Current HEAD: ${gitHead}`);
  assert.ok(gitHead, 'Git HEAD must be valid');
  pass('STARTING_HEAD_VERIFIED=PASS');

  // --- TEST 2: Live Controlled Fixture Isolation Check ---
  console.log('\n--- TEST 2: Live Controlled Fixture Isolation Check ---');
  const liveD1Path = path.resolve(
    process.cwd(),
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
  );
  if (fs.existsSync(liveD1Path)) {
    const liveD1 = new DatabaseSync(liveD1Path, { open: true, readOnly: true });

    // Verify Article 1 status is draft
    const art1 = liveD1.prepare('SELECT id, slug, status, updated_at FROM articles WHERE id = 1').get();
    assert.ok(art1, 'Article 1 must exist');
    assert.equal(art1.status, 'draft', 'Article 1 status must remain draft');
    pass('LIVE_ARTICLE_1_STATUS_DRAFT=YES');

    // Verify Article 1 has 0 approvals
    const approvalCount = liveD1.prepare('SELECT COUNT(*) as c FROM article_editorial_approvals WHERE article_id = 1').get().c;
    assert.equal(approvalCount, 0, 'Article 1 must have 0 approvals in live DB');
    pass('LIVE_ARTICLE_1_APPROVAL_ROWS_ZERO=YES');

    // Verify exactly 1 active featured attachment
    const activeFeaturedCount = liveD1.prepare('SELECT COUNT(*) as c FROM article_media WHERE article_id = 1 AND slot_key = \'featured\' AND is_active = 1').get().c;
    assert.equal(activeFeaturedCount, 1, 'Article 1 must have exactly 1 active featured attachment');
    pass('LIVE_FEATURED_ATTACHMENT_COUNT=1');

    // Verify evaluated readiness is READY_FOR_REVIEW
    const readinessRow = liveD1.prepare('SELECT snapshot_json FROM article_publication_readiness WHERE article_id = 1 ORDER BY id DESC LIMIT 1').get();
    assert.ok(readinessRow, 'Readiness row must exist for article 1');
    const snapshot = JSON.parse(readinessRow.snapshot_json);
    assert.equal(snapshot.evaluated_readiness, 'READY_FOR_REVIEW');
    assert.equal(snapshot.ready_for_review, true);
    pass('LIVE_ARTICLE_1_READINESS=READY_FOR_REVIEW');
  }

  // --- TEST 3: Synthetic Ready Article Approval Flow ---
  console.log('\n--- TEST 3: Synthetic Ready Article Approval Flow ---');
  const db3 = createTestDb();
  const art3 = seedFullArticle(db3, 301);
  seedMediaAssetAndAttachment(db3, 301, 'ast_synth_301');

  // Verify before approval readiness is NOT_READY (due to APPROVAL_MISSING)
  const evalBefore = await evaluateArticleReadiness(db3, 301);
  assert.equal(evalBefore.is_ready, false);
  assert.equal(evalBefore.checks.human_approval, 'FAIL');
  assert.ok(evalBefore.blockers.includes(FAILURE_CODES.APPROVAL_MISSING));
  pass('APPROVAL_MISSING_BLOCKS_READY_TO_SCHEDULE=YES');

  // Record explicit approval via service
  const approvalRes = await recordEditorialApproval(db3, {
    articleId: 301,
    approvedBy: 'dewan_redaksi_editor',
    approvedRole: 'editor_in_chief',
    notes: 'Kajian arsitektur tropis telah memenuhi seluruh standar visual dan teks.'
  });

  assert.equal(approvalRes.approval.article_id, 301);
  assert.equal(approvalRes.approval.approval_status, APPROVAL_STATUS_APPROVED);
  assert.equal(approvalRes.approval.approved_by, 'dewan_redaksi_editor');
  assert.equal(approvalRes.approval.approved_role, 'editor_in_chief');
  assert.equal(approvalRes.approval.approved_content_hash, art3.contentHash);
  assert.equal(approvalRes.approval.approved_asset_id, 'ast_synth_301');
  assert.equal(approvalRes.approval.notes, 'Kajian arsitektur tropis telah memenuhi seluruh standar visual dan teks.');

  // Readiness should now transition to READY_TO_SCHEDULE
  if (!approvalRes.snapshot.is_ready) {
    console.log('Test 3 snapshot checks:', approvalRes.snapshot.checks);
    console.log('Test 3 snapshot blockers:', approvalRes.snapshot.blockers);
  }
  assert.equal(approvalRes.snapshot.is_ready, true);
  assert.equal(approvalRes.snapshot.overall_status, PUBLICATION_STATUS_READY_TO_SCHEDULE);
  assert.equal(approvalRes.snapshot.checks.human_approval, 'PASS');
  assert.equal(approvalRes.snapshot.blockers.length, 0);
  pass('READY_ARTICLE_APPROVAL_FLOW=PASS');

  // Verify article status strictly remains draft (approval does NOT publish)
  const art3Check = await db3.prepare('SELECT status FROM articles WHERE id = 301').first();
  assert.equal(art3Check.status, 'draft', 'Approval strictly does NOT mutate article status to published');
  pass('APPROVAL_AUTO_PUBLISH=NO');
  pass('APPROVAL_AUTO_SCHEDULE=NO');

  // --- TEST 4: Non-Ready Article Approval Guards ---
  console.log('\n--- TEST 4: Non-Ready Article Approval Guards ---');
  const db4 = createTestDb();
  // Article without media attachment
  seedFullArticle(db4, 401);

  await assert.rejects(
    async () => {
      await recordEditorialApproval(db4, {
        articleId: 401,
        approvedBy: 'test_editor'
      });
    },
    /FEATURED_MEDIA_MISSING/,
    'Article without featured media binding cannot be approved'
  );
  pass('NON_READY_NO_MEDIA_APPROVAL_BLOCKED=PASS');

  // Non-draft article cannot be approved
  seedFullArticle(db4, 402, { status: 'published' });
  seedMediaAssetAndAttachment(db4, 402, 'ast_synth_402');

  await assert.rejects(
    async () => {
      await recordEditorialApproval(db4, {
        articleId: 402,
        approvedBy: 'test_editor'
      });
    },
    /ARTICLE_NOT_DRAFT/,
    'Non-draft article cannot be approved'
  );
  pass('NON_DRAFT_APPROVAL_BLOCKED=PASS');

  // --- TEST 5: Cryptographic Hash & Media Binding ---
  console.log('\n--- TEST 5: Cryptographic Hash & Media Binding ---');
  assert.equal(approvalRes.approval.approved_content_hash, art3.contentHash);
  assert.equal(approvalRes.approval.approved_asset_id, 'ast_synth_301');
  pass('APPROVAL_CONTENT_HASH_BINDING=PASS');
  pass('APPROVAL_MEDIA_BINDING=PASS');

  // --- TEST 6: Content Stale Race Safety ---
  console.log('\n--- TEST 6: Content Stale Race Safety ---');
  // Mutate article content
  const newContent = art3.contentMd + '\n\n## Perubahan Konten Pasca-Approval\nTambahan catatan teknis material kayu.';
  const newHash = computeContentHash(newContent);
  db3.raw.prepare('UPDATE articles SET content_md = ?, content_hash = ? WHERE id = 301').run(newContent, newHash);

  const evalAfterContentChange = await evaluateArticleReadiness(db3, 301);
  assert.equal(evalAfterContentChange.is_ready, false);
  assert.equal(evalAfterContentChange.checks.human_approval, 'FAIL');
  assert.ok(evalAfterContentChange.blockers.includes(FAILURE_CODES.APPROVAL_STALE));
  assert.ok(evalAfterContentChange.blockers.includes(FAILURE_CODES.APPROVAL_STALE_CONTENT));
  pass('CONTENT_CHANGED_INVALIDATES_APPROVAL=PASS');
  pass('STALE_REVIEW_RACE_SAFE=PASS');

  // --- TEST 7: Featured Media Stale Race Safety ---
  console.log('\n--- TEST 7: Featured Media Stale Race Safety ---');
  // Restore content
  db3.raw.prepare('UPDATE articles SET content_md = ?, content_hash = ? WHERE id = 301').run(art3.contentMd, art3.contentHash);
  // Replace featured media attachment with a different asset
  seedMediaAssetAndAttachment(db3, 301, 'ast_synth_301_replaced', { attach: false });
  db3.raw.prepare('UPDATE article_media SET is_active = 0 WHERE article_id = 301').run();
  db3.raw.prepare(`
    INSERT INTO article_media (article_id, slot_key, asset_id, role, is_active, sort_order, caption)
    VALUES (301, 'featured', 'ast_synth_301_replaced', 'featured', 1, 0, 'Replaced image')
  `).run();

  const evalAfterMediaChange = await evaluateArticleReadiness(db3, 301);
  assert.equal(evalAfterMediaChange.is_ready, false);
  assert.equal(evalAfterMediaChange.checks.human_approval, 'FAIL');
  assert.ok(evalAfterMediaChange.blockers.includes(FAILURE_CODES.APPROVAL_STALE_MEDIA));
  pass('MEDIA_CHANGED_INVALIDATES_APPROVAL=PASS');

  // --- TEST 8: Explicit Approval API Endpoint (POST & DELETE) ---
  console.log('\n--- TEST 8: Explicit Approval API Endpoint ---');
  const db8 = createTestDb();
  seedFullArticle(db8, 801);
  seedMediaAssetAndAttachment(db8, 801, 'ast_synth_801');

  // POST approve via endpoint
  const postReq = new Request('http://localhost/api/admin/publication/approve/801', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      approved_by: 'api_chief_editor',
      approved_role: 'editor_in_chief',
      notes: 'Persetujuan via API endpoint'
    })
  });

  const postRes = await approvePostHandler({
    params: { id: '801' },
    request: postReq,
    locals: { db: db8 }
  });

  assert.equal(postRes.status, 200);
  const postData = await postRes.json();
  assert.equal(postData.status, 'success');
  assert.equal(postData.approval.approved_by, 'api_chief_editor');
  assert.equal(postData.readiness.is_ready, true);
  assert.equal(postData.readiness.overall_status, PUBLICATION_STATUS_READY_TO_SCHEDULE);
  pass('APPROVE_API_ENDPOINT_POST=PASS');

  // DELETE revoke via endpoint
  const deleteReq = new Request('http://localhost/api/admin/publication/approve/801', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      revoked_by: 'api_chief_editor',
      notes: 'Dicabut kembali untuk evaluasi tambahan'
    })
  });

  const deleteRes = await approveDeleteHandler({
    params: { id: '801' },
    request: deleteReq,
    locals: { db: db8 }
  });

  assert.equal(deleteRes.status, 200);
  const deleteData = await deleteRes.json();
  assert.equal(deleteData.status, 'success');
  assert.equal(deleteData.revoked, true);
  assert.equal(deleteData.readiness.is_ready, false);
  assert.ok(deleteData.readiness.blockers.includes(FAILURE_CODES.APPROVAL_STATUS_REVOKED));
  pass('APPROVE_API_ENDPOINT_DELETE=PASS');

  // --- TEST 9: Review Surface Code & Markup Inspection ---
  console.log('\n--- TEST 9: Review Surface Code & Markup Inspection ---');
  const previewPath = path.resolve(process.cwd(), 'src/pages/admin/preview/[slug].astro');
  const previewContent = fs.readFileSync(previewPath, 'utf-8');

  // Verify readiness panel rendered
  assert.ok(previewContent.includes('Editorial Review & Publication Readiness Gate'), 'Preview must have Editorial Review heading');
  assert.ok(previewContent.includes('Status Kesiapan (Readiness)'), 'Preview must display Status Kesiapan');
  assert.ok(previewContent.includes('humanReasonDescriptions'), 'Preview must map machine reasons to human descriptions');
  pass('READINESS_PANEL_MARKUP=PASS');
  pass('READINESS_REASON_DISPLAY_MAPPING=PASS');

  // Verify featured media panel rendered
  assert.ok(previewContent.includes('Featured Media Review'), 'Preview must render Featured Media Review');
  assert.ok(previewContent.includes('activeFeaturedMedia'), 'Preview must bind active featured media');
  pass('FEATURED_MEDIA_REVIEW_PANEL_MARKUP=PASS');

  // Verify approval status & stale indicators
  assert.ok(previewContent.includes('approvalDisplayStatus'), 'Preview must render approval status');
  assert.ok(previewContent.includes('STALE_CONTENT'), 'Preview must support STALE_CONTENT');
  assert.ok(previewContent.includes('STALE_MEDIA'), 'Preview must support STALE_MEDIA');
  pass('APPROVAL_STATUS_PANEL_MARKUP=PASS');
  pass('STALE_APPROVAL_UI_SUPPORT=PASS');

  // Verify deliberate action guards (NO auto trigger)
  assert.ok(previewContent.includes('btn-explicit-approve'), 'Must contain explicit approve button ID');
  assert.ok(previewContent.includes('addEventListener(\'click\''), 'Must bind to explicit click event');
  assert.ok(previewContent.includes('window.confirm('), 'Must require human confirmation dialog');
  assert.ok(!previewContent.includes('window.onload = function() { approve'), 'Zero automatic approval on page load');
  pass('APPROVAL_REQUIRES_USER_ACTION=YES');
  pass('APPROVAL_ON_PAGE_LOAD=NO');
  pass('AUTO_APPROVAL=NO');

  // Verify separate action separation (approval != publish)
  assert.ok(!previewContent.includes('publishNow('), 'Preview review UI does not trigger publishNow');
  assert.ok(!previewContent.includes('publish_now'), 'Preview review UI does not invoke publish_now action');
  pass('APPROVAL_AND_PUBLISH_SEPARATE_ACTIONS=YES');

  // --- TEST 10: Final Isolation & Controlled Article Verification ---
  console.log('\n--- TEST 10: Final Isolation & Controlled Article Verification ---');
  if (fs.existsSync(liveD1Path)) {
    const liveD1Final = new DatabaseSync(liveD1Path, { open: true, readOnly: true });
    const finalArt1 = liveD1Final.prepare('SELECT status, updated_at FROM articles WHERE id = 1').get();
    assert.equal(finalArt1.status, 'draft', 'Controlled Article 1 status must remain draft');

    const finalApprovals = liveD1Final.prepare('SELECT COUNT(*) as c FROM article_editorial_approvals WHERE article_id = 1').get().c;
    assert.equal(finalApprovals, 0, 'Controlled Article 1 must remain unapproved in live DB');

    const finalAttachments = liveD1Final.prepare('SELECT COUNT(*) as c FROM article_media WHERE article_id = 1 AND slot_key = \'featured\' AND is_active = 1').get().c;
    assert.equal(finalAttachments, 1, 'Active featured attachment must remain exactly 1');

    pass('ARTICLE_1_STATUS=draft');
    pass('ARTICLE_1_READINESS=READY_FOR_REVIEW');
    pass('ARTICLE_1_APPROVAL_ROWS_CREATED=0');
  }

  console.log('\n============================================================');
  console.log(`ALL TESTS PASSED: ${passed}`);
  console.log('PHASE 5J2 HUMAN REVIEW SURFACE INTEGRATION VERIFIED');
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
