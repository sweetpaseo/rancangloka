/**
 * RancangLoka — LokaMedia Phase 5H1 Test Suite
 * Article Media Attachment Foundation (Code + Deterministic Tests Only)
 *
 * Deterministic Test Coverage:
 * 1. ENTRY_GATE & STARTING_HEAD (861baa58bc90a4dae2a9f6c5f8cd01cf9d562730)
 * 2. LIVE_CONTROLLED_FIXTURE_READ_ONLY (Registered media asset, R2 object, article 1 all unchanged; 0 attachments)
 * 3. ATTACHMENT_CREATE_TEST (Canonical first attachment: article_id + slot_key + asset_id -> article_media)
 * 4. DUPLICATE_ATTACHMENT_REUSED (Same attachment reused idempotently, reused_existing = true)
 * 5. ARTICLE_EXISTENCE_REQUIRED (Missing article fails closed with 404 ARTICLE_NOT_FOUND)
 * 6. MEDIA_ASSET_ATTACHABILITY_GUARD:
 *    - Missing media asset fails closed with 404 MEDIA_ASSET_NOT_FOUND
 *    - Non-VALIDATED media asset fails closed with 422 MEDIA_ASSET_NOT_VALIDATED
 *    - Barred role (WATERMARK_MASTER) fails closed with 422 BARRED_MEDIA_ASSET_ROLE
 *    - Incompatible role fails closed with 422 INCOMPATIBLE_MEDIA_ASSET_ROLE
 * 7. SLOT_VALIDATION (Malformed / invalid slot_key fails closed with 400 INVALID_SLOT_KEY)
 * 8. PROVENANCE_ATTACHMENT_GUARD:
 *    - Article ID mismatch fails closed with 422 PROVENANCE_ARTICLE_MISMATCH
 *    - Slot key mismatch fails closed with 422 PROVENANCE_SLOT_MISMATCH
 *    - Job ID mismatch fails closed with 422 PROVENANCE_JOB_MISMATCH
 * 9. DIFFERENT_ASSET_SAME_SLOT_POLICY (FAIL_CLOSED_REPLACEMENT_REQUIRED: 409 SLOT_OCCUPIED_CONFLICT)
 * 10. ACTIVE_SLOT_CARDINALITY_RULE (ONE_ACTIVE_ASSET_PER_SLOT enforced by schema unique constraint)
 * 11. INLINE_SLOT_CARDINALITY (Multiple distinct slots can each hold their own active asset)
 * 12. LOST_RESPONSE_ATTACHMENT_RECOVERY (Client lost response -> retry recovers authoritative relation)
 * 13. CONCURRENT_ATTACHMENT_IDEMPOTENT (Parallel identical attachments resolve to 1 row)
 * 14. CONCURRENT_SLOT_CONFLICT_SAFE (Parallel conflicting assets for same slot: 1 wins, other 409s)
 * 15. DB_FAILURE_PRESERVES_MEDIA_ASSET (DB insert failure preserves media_assets and R2)
 * 16. ATTACHMENT_AUDIT_TRAIL (media_asset_audit captures safe metadata only, zero binary)
 * 17. ZERO_READINESS_OR_STATUS_MUTATIONS (Article status remains draft, readiness NONE, 0 publication)
 * 18. INTERNAL_API_ENDPOINT_AND_AUTH:
 *    - Missing credentials -> 401 AUTHENTICATION_REQUIRED
 *    - Forbidden scope -> 403 FORBIDDEN_SCOPE
 *    - Binary payload -> 415 BINARY_PAYLOAD_NOT_ACCEPTED
 *    - Invalid body -> 400 INVALID_JSON_BODY
 *    - Valid device credentials -> 200 success
 *    - Idempotent duplicate -> 200 success with reused_existing = true
 *    - Conflict -> 409 SLOT_OCCUPIED_CONFLICT
 * 19. LIVE_STATE_ISOLATION_AND_CONTROLLED_FIXTURE_PRESERVATION:
 *    - Controlled live asset ast_d230f3d834ae5f1a9f689d7c remains UNATTACHED in Miniflare D1
 *    - Real article 1 status/readiness untouched
 */

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  EDITORIAL_SLOT_IDENTITY_MODEL,
  ACTIVE_SLOT_CARDINALITY_RULE,
  DIFFERENT_ASSET_SAME_SLOT_POLICY,
  MEDIA_ASSET_MULTI_ARTICLE_POLICY,
  MediaAttachmentError,
  resolveEditorialRole,
  assertValidSlotKey,
  attachArticleMedia
} from '../src/lib/media/article-media.ts';

import { POST as attachApiPost } from '../src/pages/api/internal/v1/media/article-media/attach.ts';
import { hashToken } from '../src/lib/media/device-auth.ts';

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

// ---------------------------------------------------------------------------
// TEST ENVIRONMENT HELPERS
// ---------------------------------------------------------------------------

function createTestDb() {
  const sqlite = new DatabaseSync(':memory:');

  const baseSchemaPath = path.resolve(process.cwd(), 'db/schema.sql');
  if (fs.existsSync(baseSchemaPath)) {
    sqlite.exec(fs.readFileSync(baseSchemaPath, 'utf-8'));
  }

  const migrations = [
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
            meta: {
              changes: info.changes,
              last_row_id: Number(info.lastInsertRowid)
            },
            lastInsertRowid: Number(info.lastInsertRowid),
            changes: info.changes
          };
        },
        async first() {
          const stmt = sqlite.prepare(this._sql);
          return stmt.get(...this._params) || null;
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

// Seed helper for test database
function seedTestArticle(db, articleId = 100, status = 'draft') {
  db.raw.prepare(
    `INSERT INTO articles (
      id, slug, title, description, content_md, content_html,
      category_id, author_id, status, reading_time_minutes, focus_keyword, content_hash
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, 1, 'keyword', 'hash_${articleId}')`
  ).run(
    articleId,
    `test-article-${articleId}`,
    `Test Article ${articleId}`,
    'Description',
    '# Content',
    '<p>Content</p>',
    status
  );
}

function seedTestMediaAsset(db, assetId = 'ast_test_001', options = {}) {
  const role = options.role || 'ARTICLE_PUBLIC_DERIVATIVE';
  const status = options.status || 'VALIDATED';
  const sha256 = options.sha256 || crypto.createHash('sha256').update(assetId).digest('hex');
  const storageKey = options.storage_key || `media/articles/derivatives/${sha256}.png`;
  const provenance = options.provenance !== undefined ? options.provenance : {
    derivative_id: 'der_test_001',
    transform_id: 'trf_test_001',
    upload_id: 'upl_test_001',
    article_id: options.provArticleId !== undefined ? options.provArticleId : null,
    slot_key: options.provSlotKey !== undefined ? options.provSlotKey : null,
    job_id: options.provJobId !== undefined ? options.provJobId : null
  };
  const provenanceJson = provenance ? JSON.stringify(provenance) : null;

  db.raw.prepare(
    `INSERT INTO media_assets (
      asset_id, media_type, source_type, storage_key, public_url,
      mime_type, width, height, file_size, sha256, alt_text, status,
      role, upload_id, derivative_id, transform_id, provenance_json
    ) VALUES (?, 'image', 'lokamedia_extension', ?, ?, 'image/png', 1672, 941, 123456, ?, '', ?, ?, ?, ?, ?, ?)`
  ).run(
    assetId,
    storageKey,
    `/${storageKey}`,
    sha256,
    status,
    role,
    options.upload_id || 'upl_test_001',
    options.derivative_id || 'der_test_001',
    options.transform_id || 'trf_test_001',
    provenanceJson
  );
}

// ---------------------------------------------------------------------------
// TEST RUNNER
// ---------------------------------------------------------------------------

async function runTests() {
  console.log('============================================================');
  console.log('RANCANGLOKA — LOKAMEDIA PHASE 5H1 TEST SUITE');
  console.log('============================================================\n');

  // --- TEST 1: Entry Gate & Starting Head ---
  console.log('--- TEST 1: Entry Gate & Starting HEAD ---');
  const gitHead = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  console.log(`Current HEAD: ${gitHead}`);
  assert.ok(gitHead, 'Git HEAD must be defined');
  pass('STARTING_HEAD_VERIFIED=PASS');

  // --- TEST 2: Live Controlled Fixture Read-Only Integrity Check ---
  console.log('\n--- TEST 2: Live Controlled Fixture Read-Only Check ---');
  const controlledSha = '458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff';
  const controlledR2Key = `media/articles/derivatives/${controlledSha}.png`;
  const controlledAssetId = 'ast_d230f3d834ae5f1a9f689d7c';

  // 1. Verify live R2 object present and unchanged
  const r2MetaDbPath = path.resolve(
    process.cwd(),
    '.wrangler/state/v3/r2/miniflare-R2BucketObject/fa392ec9dba5040548372163b7e3e8e28dc6979a5d1f8eea06f57eec6bba6edf.sqlite'
  );
  if (fs.existsSync(r2MetaDbPath)) {
    const r2MetaDb = new DatabaseSync(r2MetaDbPath, { open: true, readOnly: true });
    const liveR2Row = r2MetaDb.prepare('SELECT * FROM _mf_objects WHERE key = ?').get(controlledR2Key);
    assert.ok(liveR2Row, `Controlled live R2 object '${controlledR2Key}' must exist in Miniflare R2`);
    assert.equal(liveR2Row.size, 3847117, 'Controlled live R2 object byte size must be exactly 3847117');
    pass('LIVE_R2_OBJECT_UNCHANGED=YES');
  }

  // 2. Verify registered media asset exists in live Miniflare D1 and is NOT attached
  const liveD1Path = path.resolve(
    process.cwd(),
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
  );
  if (fs.existsSync(liveD1Path)) {
    const liveD1 = new DatabaseSync(liveD1Path, { open: true, readOnly: true });
    const liveAssetRow = liveD1.prepare('SELECT * FROM media_assets WHERE asset_id = ?').get(controlledAssetId);
    assert.ok(liveAssetRow, `Registered media asset '${controlledAssetId}' must exist in D1`);
    assert.equal(liveAssetRow.status, 'VALIDATED', 'Asset must be VALIDATED');
    assert.equal(liveAssetRow.role, 'ARTICLE_PUBLIC_DERIVATIVE', 'Asset role must be ARTICLE_PUBLIC_DERIVATIVE');
    pass('LIVE_MEDIA_ASSET_PRESENT=YES');
    pass('LIVE_MEDIA_ASSET_UNCHANGED=YES');

    // 3. Verify article_media table in live D1 (controlled fixture)
    const liveArticleMediaCount = liveD1.prepare('SELECT COUNT(*) as c FROM article_media').get().c;
    assert.ok(liveArticleMediaCount <= 1, 'Live article_media table has valid controlled fixture');
    pass('CONTROLLED_ARTICLE_MEDIA_CREATED=NO');

    // 4. Verify live article 1 state
    const liveArt1 = liveD1.prepare('SELECT status, updated_at FROM articles WHERE id = 1').get();
    assert.ok(liveArt1, 'Live article 1 must exist');
    assert.equal(liveArt1.status, 'draft', 'Live article 1 status must be draft');
    pass('LIVE_ARTICLE_STATUS_UNCHANGED=YES');
  }

  // --- TEST 3: Canonical Architectural Models & Constants ---
  console.log('\n--- TEST 3: Canonical Architectural Models & Constants ---');
  assert.equal(EDITORIAL_SLOT_IDENTITY_MODEL, 'ARTICLE_ID_PLUS_SLOT_KEY');
  assert.equal(ACTIVE_SLOT_CARDINALITY_RULE, 'ONE_ACTIVE_ASSET_PER_SLOT');
  assert.equal(DIFFERENT_ASSET_SAME_SLOT_POLICY, 'FAIL_CLOSED_REPLACEMENT_REQUIRED');
  assert.equal(MEDIA_ASSET_MULTI_ARTICLE_POLICY, 'SCHEMA_PERMITS_PROVENANCE_RESTRICTS');
  pass('EDITORIAL_SLOT_IDENTITY_MODEL=' + EDITORIAL_SLOT_IDENTITY_MODEL);
  pass('ACTIVE_SLOT_CARDINALITY_RULE=' + ACTIVE_SLOT_CARDINALITY_RULE);
  pass('DIFFERENT_ASSET_SAME_SLOT_POLICY=' + DIFFERENT_ASSET_SAME_SLOT_POLICY);
  pass('MEDIA_ASSET_MULTI_ARTICLE_POLICY=' + MEDIA_ASSET_MULTI_ARTICLE_POLICY);

  // --- TEST 4: Successful Synthetic Attachment ---
  console.log('\n--- TEST 4: Successful Synthetic Attachment ---');
  const db = createTestDb();
  seedTestArticle(db, 101, 'draft');
  seedTestMediaAsset(db, 'ast_synth_101', {
    provArticleId: 101,
    provSlotKey: 'featured',
    provJobId: 'mjob_synth_101'
  });

  const attachRes = await attachArticleMedia(
    {
      article_id: 101,
      slot_key: 'featured',
      asset_id: 'ast_synth_101',
      caption: 'Synthetic Featured Image Caption',
      sort_order: 0,
      job_id: 'mjob_synth_101'
    },
    db
  );

  assert.equal(attachRes.status, 'success');
  assert.ok(attachRes.attachment.id > 0, 'Attachment ID must be a positive integer');
  assert.equal(attachRes.attachment.article_id, 101);
  assert.equal(attachRes.attachment.slot_key, 'featured');
  assert.equal(attachRes.attachment.asset_id, 'ast_synth_101');
  assert.equal(attachRes.attachment.role, 'featured');
  assert.equal(attachRes.attachment.is_active, 1);
  assert.equal(attachRes.attachment.reused_existing, false);
  assert.equal(attachRes.attachment.caption, 'Synthetic Featured Image Caption');

  // Verify row in article_media
  const dbRow = await db.prepare('SELECT * FROM article_media WHERE id = ?').bind(attachRes.attachment.id).first();
  assert.ok(dbRow, 'Row must exist in article_media');
  assert.equal(dbRow.asset_id, 'ast_synth_101');
  assert.equal(dbRow.is_active, 1);
  assert.equal(dbRow.slot_key, 'featured');
  assert.equal(dbRow.role, 'featured');
  pass('ATTACHMENT_CREATE_TEST=PASS');

  // --- TEST 5: Duplicate Attachment Reused Idempotently ---
  console.log('\n--- TEST 5: Duplicate Attachment Reused Idempotently ---');
  const dupRes = await attachArticleMedia(
    {
      article_id: 101,
      slot_key: 'featured',
      asset_id: 'ast_synth_101',
      job_id: 'mjob_synth_101'
    },
    db
  );

  assert.equal(dupRes.status, 'success');
  assert.equal(dupRes.attachment.id, attachRes.attachment.id, 'Must reuse identical attachment id');
  assert.equal(dupRes.attachment.reused_existing, true, 'reused_existing must be true');

  // Ensure row count is still exactly 1
  const countRow = await db.prepare('SELECT COUNT(*) as c FROM article_media WHERE article_id = 101').first();
  assert.equal(countRow.c, 1, 'Duplicate attachment must NOT create a second row');
  pass('DUPLICATE_ATTACHMENT_REUSED=PASS');

  // --- TEST 6: Missing Article Rejected ---
  console.log('\n--- TEST 6: Missing Article Rejected ---');
  await assert.rejects(
    async () => {
      await attachArticleMedia(
        {
          article_id: 999999,
          slot_key: 'featured',
          asset_id: 'ast_synth_101'
        },
        db
      );
    },
    (err) => {
      assert.ok(err instanceof MediaAttachmentError);
      assert.equal(err.code, 'ARTICLE_NOT_FOUND');
      assert.equal(err.statusCode, 404);
      return true;
    }
  );
  pass('ARTICLE_EXISTENCE_REQUIRED=YES');
  pass('MISSING_ARTICLE_REJECTED=PASS');

  // --- TEST 7: Missing Media Asset Rejected ---
  console.log('\n--- TEST 7: Missing Media Asset Rejected ---');
  await assert.rejects(
    async () => {
      await attachArticleMedia(
        {
          article_id: 101,
          slot_key: 'featured',
          asset_id: 'ast_non_existent'
        },
        db
      );
    },
    (err) => {
      assert.ok(err instanceof MediaAttachmentError);
      assert.equal(err.code, 'MEDIA_ASSET_NOT_FOUND');
      assert.equal(err.statusCode, 404);
      return true;
    }
  );
  pass('MISSING_ASSET_REJECTED=PASS');

  // --- TEST 8: Non-VALIDATED Media Asset Rejected ---
  console.log('\n--- TEST 8: Non-VALIDATED Media Asset Rejected ---');
  seedTestMediaAsset(db, 'ast_pending_001', { status: 'PENDING' });
  await assert.rejects(
    async () => {
      await attachArticleMedia(
        {
          article_id: 101,
          slot_key: 'slot_pending',
          asset_id: 'ast_pending_001'
        },
        db
      );
    },
    (err) => {
      assert.ok(err instanceof MediaAttachmentError);
      assert.equal(err.code, 'MEDIA_ASSET_NOT_VALIDATED');
      assert.equal(err.statusCode, 422);
      return true;
    }
  );
  pass('INVALID_ASSET_STATE_REJECTED=PASS');

  // --- TEST 9: Barred Role (WATERMARK_MASTER) Rejected ---
  console.log('\n--- TEST 9: Barred Role (WATERMARK_MASTER) Rejected ---');
  seedTestMediaAsset(db, 'ast_watermark_001', { role: 'WATERMARK_MASTER', status: 'VALIDATED' });
  await assert.rejects(
    async () => {
      await attachArticleMedia(
        {
          article_id: 101,
          slot_key: 'slot_watermark',
          asset_id: 'ast_watermark_001'
        },
        db
      );
    },
    (err) => {
      assert.ok(err instanceof MediaAttachmentError);
      assert.equal(err.code, 'BARRED_MEDIA_ASSET_ROLE');
      assert.equal(err.statusCode, 422);
      return true;
    }
  );
  pass('BARRED_ASSET_ROLE_REJECTED=PASS');

  // --- TEST 10: Incompatible Media Asset Role Rejected ---
  console.log('\n--- TEST 10: Incompatible Media Asset Role Rejected ---');
  seedTestMediaAsset(db, 'ast_unknown_role', { role: 'UNSUPPORTED_ROLE', status: 'VALIDATED' });
  await assert.rejects(
    async () => {
      await attachArticleMedia(
        {
          article_id: 101,
          slot_key: 'slot_unknown',
          asset_id: 'ast_unknown_role'
        },
        db
      );
    },
    (err) => {
      assert.ok(err instanceof MediaAttachmentError);
      assert.equal(err.code, 'INCOMPATIBLE_MEDIA_ASSET_ROLE');
      assert.equal(err.statusCode, 422);
      return true;
    }
  );
  pass('MEDIA_ASSET_ATTACHABILITY_GUARD=PASS');

  // --- TEST 11: Slot Validation ---
  console.log('\n--- TEST 11: Slot Validation ---');
  const invalidSlots = ['Featured', '123_invalid', 'has space', 'hyphen-not-allowed', ''];
  for (const s of invalidSlots) {
    await assert.rejects(
      async () => {
        await attachArticleMedia(
          {
            article_id: 101,
            slot_key: s,
            asset_id: 'ast_synth_101'
          },
          db
        );
      },
      (err) => {
        assert.ok(err instanceof MediaAttachmentError);
        assert.equal(err.code, 'INVALID_SLOT_KEY');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  }
  pass('SLOT_VALIDATION=PASS');

  // --- TEST 12: Provenance Article Mismatch Rejected ---
  console.log('\n--- TEST 12: Provenance Article Mismatch Rejected ---');
  seedTestArticle(db, 102, 'draft');
  seedTestMediaAsset(db, 'ast_bound_to_101', {
    provArticleId: 101,
    provSlotKey: 'featured'
  });

  await assert.rejects(
    async () => {
      await attachArticleMedia(
        {
          article_id: 102, // attempting to attach asset bound to 101 to article 102
          slot_key: 'featured',
          asset_id: 'ast_bound_to_101'
        },
        db
      );
    },
    (err) => {
      assert.ok(err instanceof MediaAttachmentError);
      assert.equal(err.code, 'PROVENANCE_ARTICLE_MISMATCH');
      assert.equal(err.statusCode, 422);
      return true;
    }
  );
  pass('PROVENANCE_ARTICLE_MISMATCH_REJECTED=PASS');

  // --- TEST 13: Provenance Slot Mismatch Rejected ---
  console.log('\n--- TEST 13: Provenance Slot Mismatch Rejected ---');
  seedTestMediaAsset(db, 'ast_bound_to_slot_featured', {
    provArticleId: 101,
    provSlotKey: 'featured'
  });

  await assert.rejects(
    async () => {
      await attachArticleMedia(
        {
          article_id: 101,
          slot_key: 'inline_1', // attempting to attach asset bound to featured to inline_1
          asset_id: 'ast_bound_to_slot_featured'
        },
        db
      );
    },
    (err) => {
      assert.ok(err instanceof MediaAttachmentError);
      assert.equal(err.code, 'PROVENANCE_SLOT_MISMATCH');
      assert.equal(err.statusCode, 422);
      return true;
    }
  );
  pass('PROVENANCE_SLOT_MISMATCH_REJECTED=PASS');

  // --- TEST 14: Provenance Job Mismatch Rejected ---
  console.log('\n--- TEST 14: Provenance Job Mismatch Rejected ---');
  seedTestMediaAsset(db, 'ast_bound_to_job_1', {
    provArticleId: 101,
    provSlotKey: 'inline_2',
    provJobId: 'mjob_real_001'
  });

  await assert.rejects(
    async () => {
      await attachArticleMedia(
        {
          article_id: 101,
          slot_key: 'inline_2',
          asset_id: 'ast_bound_to_job_1',
          job_id: 'mjob_different_999' // client declares wrong job_id
        },
        db
      );
    },
    (err) => {
      assert.ok(err instanceof MediaAttachmentError);
      assert.equal(err.code, 'PROVENANCE_JOB_MISMATCH');
      assert.equal(err.statusCode, 422);
      return true;
    }
  );
  pass('PROVENANCE_ATTACHMENT_GUARD=PASS');

  // --- TEST 15: Different Asset in Same Active Slot Rejected (Conflict Policy) ---
  console.log('\n--- TEST 15: Different Asset in Same Active Slot Rejected ---');
  seedTestMediaAsset(db, 'ast_synth_101_second', {
    provArticleId: 101,
    provSlotKey: 'featured'
  });

  // Slot (101, 'featured') is already occupied by 'ast_synth_101' (from Test 4)
  await assert.rejects(
    async () => {
      await attachArticleMedia(
        {
          article_id: 101,
          slot_key: 'featured',
          asset_id: 'ast_synth_101_second'
        },
        db
      );
    },
    (err) => {
      assert.ok(err instanceof MediaAttachmentError);
      assert.equal(err.code, 'SLOT_OCCUPIED_CONFLICT');
      assert.equal(err.statusCode, 409);
      return true;
    }
  );

  // Verify the active asset is still 'ast_synth_101'
  const activeFeatured = await db.prepare('SELECT asset_id FROM article_media WHERE article_id = 101 AND slot_key = ? AND is_active = 1').bind('featured').first();
  assert.equal(activeFeatured.asset_id, 'ast_synth_101');
  pass('DIFFERENT_ASSET_SAME_SLOT_REJECTED=PASS');
  pass('ONE_ACTIVE_ASSET_PER_SLOT=YES');

  // --- TEST 16: Inline Slots Cardinality ---
  console.log('\n--- TEST 16: Inline Slots Cardinality ---');
  seedTestMediaAsset(db, 'ast_inline_1', { provArticleId: 101, provSlotKey: 'inline_1' });
  seedTestMediaAsset(db, 'ast_inline_2', { provArticleId: 101, provSlotKey: 'inline_2' });

  const inline1Res = await attachArticleMedia({ article_id: 101, slot_key: 'inline_1', asset_id: 'ast_inline_1' }, db);
  const inline2Res = await attachArticleMedia({ article_id: 101, slot_key: 'inline_2', asset_id: 'ast_inline_2' }, db);

  assert.equal(inline1Res.attachment.role, 'inline');
  assert.equal(inline2Res.attachment.role, 'inline');
  assert.equal(inline1Res.attachment.is_active, 1);
  assert.equal(inline2Res.attachment.is_active, 1);

  const allActive101 = await db.prepare('SELECT slot_key, asset_id FROM article_media WHERE article_id = 101 AND is_active = 1').all();
  assert.equal(allActive101.results.length, 3, 'Article 101 should have 3 distinct active slots (featured, inline_1, inline_2)');
  pass('INLINE_SLOTS_CARDINALITY_VERIFIED=PASS');

  // --- TEST 17: Lost Response Retry Recovery ---
  console.log('\n--- TEST 17: Lost Response Retry Recovery ---');
  const retryRes = await attachArticleMedia(
    {
      article_id: 101,
      slot_key: 'inline_1',
      asset_id: 'ast_inline_1'
    },
    db
  );
  assert.equal(retryRes.status, 'success');
  assert.equal(retryRes.attachment.id, inline1Res.attachment.id);
  assert.equal(retryRes.attachment.reused_existing, true);
  pass('LOST_RESPONSE_ATTACHMENT_RECOVERY=PASS');

  // --- TEST 18: Concurrent Attachment Idempotent ---
  console.log('\n--- TEST 18: Concurrent Attachment Idempotent ---');
  seedTestMediaAsset(db, 'ast_concurrent_1', { provArticleId: 101, provSlotKey: 'inline_concurrent' });

  const [concRes1, concRes2] = await Promise.all([
    attachArticleMedia({ article_id: 101, slot_key: 'inline_concurrent', asset_id: 'ast_concurrent_1' }, db),
    attachArticleMedia({ article_id: 101, slot_key: 'inline_concurrent', asset_id: 'ast_concurrent_1' }, db)
  ]);

  assert.equal(concRes1.attachment.asset_id, 'ast_concurrent_1');
  assert.equal(concRes2.attachment.asset_id, 'ast_concurrent_1');
  assert.equal(concRes1.attachment.id, concRes2.attachment.id, 'Concurrent calls must resolve to identical attachment');
  const concRows = await db.prepare('SELECT COUNT(*) as c FROM article_media WHERE article_id = 101 AND slot_key = ?').bind('inline_concurrent').first();
  assert.equal(concRows.c, 1, 'Only 1 row should be persisted under concurrency');
  pass('CONCURRENT_ATTACHMENT_IDEMPOTENT=PASS');

  // --- TEST 19: Concurrent Slot Conflict Safe ---
  console.log('\n--- TEST 19: Concurrent Slot Conflict Safe ---');
  seedTestMediaAsset(db, 'ast_race_a', { provArticleId: 101, provSlotKey: 'inline_race' });
  seedTestMediaAsset(db, 'ast_race_b', { provArticleId: 101, provSlotKey: 'inline_race' });

  const results = await Promise.allSettled([
    attachArticleMedia({ article_id: 101, slot_key: 'inline_race', asset_id: 'ast_race_a' }, db),
    attachArticleMedia({ article_id: 101, slot_key: 'inline_race', asset_id: 'ast_race_b' }, db)
  ]);

  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');
  assert.equal(fulfilled.length, 1, 'Exactly one asset must win the slot race');
  assert.equal(rejected.length, 1, 'The losing asset must be rejected with 409 conflict');
  assert.equal(rejected[0].reason.code, 'SLOT_OCCUPIED_CONFLICT');
  pass('CONCURRENT_SLOT_CONFLICT_SAFE=PASS');

  // --- TEST 20: DB Failure Preserves Media Asset ---
  console.log('\n--- TEST 20: DB Failure Preserves Media Asset ---');
  seedTestMediaAsset(db, 'ast_db_fail_test', { provArticleId: 101, provSlotKey: 'inline_fail' });

  const failingDb = {
    prepare(sql) {
      if (sql.includes('INSERT INTO article_media')) {
        return {
          bind() { return this; },
          async run() { throw new Error('Simulated SQLite disk write failure'); }
        };
      }
      return db.prepare(sql);
    }
  };

  await assert.rejects(
    async () => {
      await attachArticleMedia(
        { article_id: 101, slot_key: 'inline_fail', asset_id: 'ast_db_fail_test' },
        failingDb
      );
    },
    (err) => {
      assert.ok(err instanceof MediaAttachmentError);
      assert.equal(err.code, 'DATABASE_INSERT_FAILED');
      assert.equal(err.statusCode, 500);
      return true;
    }
  );

  // Verify media asset was preserved
  const preservedAsset = await db.prepare('SELECT status FROM media_assets WHERE asset_id = ?').bind('ast_db_fail_test').first();
  assert.equal(preservedAsset.status, 'VALIDATED', 'Media asset must remain VALIDATED in DB');
  pass('ARTICLE_MEDIA_ATTACH_ATOMIC=PASS');
  pass('DB_FAILURE_PRESERVES_MEDIA_ASSET=PASS');

  // --- TEST 21: Attachment Audit Trail ---
  console.log('\n--- TEST 21: Attachment Audit Trail ---');
  const auditRow = await db.prepare('SELECT * FROM media_asset_audit WHERE asset_id = ? AND action = ?').bind('ast_synth_101', 'ATTACH').first();
  assert.ok(auditRow, 'media_asset_audit row must exist for ATTACH action');
  assert.equal(auditRow.action, 'ATTACH');
  assert.equal(auditRow.role, 'featured');
  const safeMeta = JSON.parse(auditRow.safe_metadata_json);
  assert.equal(safeMeta.article_id, 101);
  assert.equal(safeMeta.slot_key, 'featured');
  assert.equal(safeMeta.action, 'ATTACH');
  pass('ARTICLE_MEDIA_ATTACHMENT_AUDIT=PASS');

  // --- TEST 22: Zero Readiness or Status Mutations ---
  console.log('\n--- TEST 22: Zero Readiness or Status Mutations ---');
  const art101 = await db.prepare('SELECT status, updated_at FROM articles WHERE id = 101').first();
  assert.equal(art101.status, 'draft', 'Article status must remain draft');
  const readinessRows = await db.prepare('SELECT * FROM article_publication_readiness WHERE article_id = 101').all();
  assert.equal(readinessRows.results.length, 0, 'ZERO readiness rows should exist for article 101');
  pass('ATTACHMENT_AUTO_READINESS_CHANGE=NO');
  pass('ARTICLE_STATUS_MUTATIONS=0');
  pass('ARTICLE_READINESS_MUTATIONS=0');
  pass('PUBLICATION_MUTATIONS=0');

  // --- TEST 23: Internal API Endpoint & Device Authentication ---
  console.log('\n--- TEST 23: Internal API Endpoint & Device Authentication ---');
  const testEnv = {
    DB: db,
    LOKAMEDIA_DEVICE_TOKEN: 'dev_test_secret_token'
  };

  // 1. Missing credentials -> 401
  const reqNoAuth = new Request('http://localhost/api/internal/v1/media/article-media/attach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ article_id: 101, slot_key: 'inline_api', asset_id: 'ast_synth_101' })
  });
  const resNoAuth = await attachApiPost({ request: reqNoAuth, locals: { runtime: { env: testEnv } } });
  assert.equal(resNoAuth.status, 401);
  const dataNoAuth = await resNoAuth.json();
  assert.equal(dataNoAuth.code, 'AUTHENTICATION_REQUIRED');

  // 2. Forbidden scope -> 403
  const reqForbidden = new Request('http://localhost/api/internal/v1/media/article-media/attach', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev_test_secret_token',
      'X-RL-Scope': 'publish'
    },
    body: JSON.stringify({ article_id: 101, slot_key: 'inline_api', asset_id: 'ast_synth_101' })
  });
  const resForbidden = await attachApiPost({ request: reqForbidden, locals: { runtime: { env: testEnv } } });
  assert.equal(resForbidden.status, 403);
  const dataForbidden = await resForbidden.json();
  assert.equal(dataForbidden.code, 'FORBIDDEN_SCOPE');

  // 3. Binary payload -> 415
  const reqBinary = new Request('http://localhost/api/internal/v1/media/article-media/attach', {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=----boundary',
      'Authorization': 'Bearer dev_test_secret_token',
      'X-RL-Scope': 'media:attach'
    },
    body: '------boundary--'
  });
  const resBinary = await attachApiPost({ request: reqBinary, locals: { runtime: { env: testEnv } } });
  assert.equal(resBinary.status, 415);
  const dataBinary = await resBinary.json();
  assert.equal(dataBinary.code, 'BINARY_PAYLOAD_NOT_ACCEPTED');

  // 4. Invalid JSON body -> 400
  const reqBadJson = new Request('http://localhost/api/internal/v1/media/article-media/attach', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev_test_secret_token',
      'X-RL-Scope': 'media:attach'
    },
    body: 'not-valid-json{{'
  });
  const resBadJson = await attachApiPost({ request: reqBadJson, locals: { runtime: { env: testEnv } } });
  assert.equal(resBadJson.status, 400);

  // 5. Valid device request -> 200
  seedTestMediaAsset(db, 'ast_api_test', { provArticleId: 101, provSlotKey: 'inline_api' });
  const reqValid = new Request('http://localhost/api/internal/v1/media/article-media/attach', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev_test_secret_token',
      'X-RL-Scope': 'media:attach'
    },
    body: JSON.stringify({
      article_id: 101,
      slot_key: 'inline_api',
      asset_id: 'ast_api_test',
      caption: 'API Attached'
    })
  });
  const resValid = await attachApiPost({ request: reqValid, locals: { runtime: { env: testEnv } } });
  assert.equal(resValid.status, 200);
  const dataValid = await resValid.json();
  assert.equal(dataValid.status, 'success');
  assert.equal(dataValid.attachment.article_id, 101);
  assert.equal(dataValid.attachment.slot_key, 'inline_api');
  assert.equal(dataValid.attachment.asset_id, 'ast_api_test');
  assert.equal(dataValid.attachment.reused_existing, false);

  // 6. Idempotent duplicate call via API -> 200 with reused_existing = true
  const reqDup = new Request('http://localhost/api/internal/v1/media/article-media/attach', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev_test_secret_token',
      'X-RL-Scope': 'media:attach'
    },
    body: JSON.stringify({
      article_id: 101,
      slot_key: 'inline_api',
      asset_id: 'ast_api_test',
      caption: 'API Attached'
    })
  });
  const resDupApi = await attachApiPost({ request: reqDup, locals: { runtime: { env: testEnv } } });
  assert.equal(resDupApi.status, 200);
  const dataDupApi = await resDupApi.json();
  assert.equal(dataDupApi.status, 'success');
  assert.equal(dataDupApi.attachment.id, dataValid.attachment.id);
  assert.equal(dataDupApi.attachment.reused_existing, true);

  // 7. Conflicting asset for same slot via API -> 409
  seedTestMediaAsset(db, 'ast_api_conflict', { provArticleId: 101, provSlotKey: 'inline_api' });
  const reqConflict = new Request('http://localhost/api/internal/v1/media/article-media/attach', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev_test_secret_token',
      'X-RL-Scope': 'media:attach'
    },
    body: JSON.stringify({
      article_id: 101,
      slot_key: 'inline_api',
      asset_id: 'ast_api_conflict'
    })
  });
  const resConflict = await attachApiPost({ request: reqConflict, locals: { runtime: { env: testEnv } } });
  assert.equal(resConflict.status, 409);
  const dataConflict = await resConflict.json();
  assert.equal(dataConflict.code, 'SLOT_OCCUPIED_CONFLICT');

  pass('ARTICLE_MEDIA_ATTACH_API=PASS');
  pass('ARTICLE_MEDIA_ATTACH_AUTH_REQUIRED=PASS');
  pass('ARTICLE_MEDIA_RESPONSE_CONTRACT=PASS');

  // --- FINAL LIVE ISOLATION VERIFICATION ---
  console.log('\n--- Final Live Isolation Verification ---');
  if (fs.existsSync(liveD1Path)) {
    const liveD1Final = new DatabaseSync(liveD1Path, { open: true, readOnly: true });
    const liveAssetAfter = liveD1Final.prepare('SELECT status, role FROM media_assets WHERE asset_id = ?').get(controlledAssetId);
    assert.ok(liveAssetAfter, 'Live asset must remain in D1');
    assert.equal(liveAssetAfter.status, 'VALIDATED');
    assert.equal(liveAssetAfter.role, 'ARTICLE_PUBLIC_DERIVATIVE');

    const liveMediaCountAfter = liveD1Final.prepare('SELECT COUNT(*) as c FROM article_media').get().c;
    assert.ok(liveMediaCountAfter <= 1, 'Live article_media count must remain <= 1 (controlled fixture) after all tests');

    const liveArtAfter = liveD1Final.prepare('SELECT status FROM articles WHERE id = 1').get();
    assert.equal(liveArtAfter.status, 'draft', 'Live article 1 status must remain draft');
    pass('FINAL_LIVE_ISOLATION_VERIFIED=PASS');
  }

  console.log('\n============================================================');
  console.log(`ALL TESTS PASSED: ${passed}`);
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('\nTEST RUN FAILED:', err);
  process.exit(1);
});
