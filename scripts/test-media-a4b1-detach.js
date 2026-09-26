/**
 * RancangLoka — MEDIA-A4B.1 Canonical Detach / Deactivate Test Suite
 *
 * Validates:
 * 1. Canonical detach service implementation (detachArticleMedia)
 * 2. Scope & identity targeting (article_id, asset_id, [slot_key], [binding_id])
 * 3. Soft-deactivation semantics: UPDATE is_active = 0, preserves history
 * 4. LEGACY FIELD IMMUTABILITY: articles.featured_image is NEVER mutated
 * 5. CANONICAL STATE ROUNDTRIP: pre-attach hash === post-detach hash 100%
 * 6. ACTIVE SLOT REUSE: deactivating asset A allows asset B to occupy the unique active slot
 * 7. IDEMPOTENCY: detaching an already-inactive binding returns already_inactive = true safely
 * 8. CONFLICT HANDLING: fail-closed on article/asset/slot/binding mismatch
 * 9. MUTATION SCOPE: articles, media_assets, publication tables remain 100% untouched
 * 10. LEDGER DECOUPLING: 0 trajectory ledger rows created by attach/detach
 * 11. LOCAL A4B FULL ROUNDTRIP: baseline -> attach -> verify -> detach -> verify -> hash match
 */

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  attachArticleMedia,
  detachArticleMedia,
  MediaAttachmentError
} from '../src/lib/media/article-media.ts';

import {
  buildCanonicalPublicationPreflightState,
  computeCanonicalPreflightHash
} from '../src/lib/decision/publication-preflight-state.ts';

function pass(testName) {
  console.log(`  [PASS] ${testName}`);
}

function createTestDb() {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      content_md TEXT,
      content_html TEXT,
      featured_image TEXT,
      image_alt TEXT,
      content_hash TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      manual_hold INTEGER NOT NULL DEFAULT 0,
      reading_time_minutes INTEGER DEFAULT 5,
      is_sponsored INTEGER DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE media_assets (
      asset_id TEXT PRIMARY KEY,
      media_type TEXT NOT NULL DEFAULT 'image',
      source_type TEXT NOT NULL,
      storage_key TEXT NOT NULL UNIQUE,
      public_url TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      file_size INTEGER NOT NULL,
      sha256 TEXT NOT NULL UNIQUE,
      alt_text TEXT,
      status TEXT NOT NULL DEFAULT 'VALIDATED',
      role TEXT DEFAULT 'ARTICLE_PUBLIC_DERIVATIVE',
      upload_id TEXT,
      derivative_id TEXT,
      transform_id TEXT,
      provenance_json TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE article_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      asset_id TEXT NOT NULL REFERENCES media_assets(asset_id) ON DELETE RESTRICT,
      role TEXT NOT NULL,
      slot_key TEXT NOT NULL DEFAULT 'primary',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      caption TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (role IN ('featured', 'inline')),
      CHECK (is_active IN (0, 1))
    );

    CREATE UNIQUE INDEX idx_article_media_one_active_slot
    ON article_media(article_id, slot_key)
    WHERE is_active = 1;

    CREATE TABLE media_asset_audit (
      audit_id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      action TEXT NOT NULL DEFAULT 'REGISTER',
      role TEXT NOT NULL DEFAULT 'ARTICLE_PUBLIC_DERIVATIVE',
      upload_id TEXT,
      derivative_id TEXT,
      transform_id TEXT,
      sha256 TEXT NOT NULL,
      r2_key TEXT NOT NULL,
      safe_metadata_json TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE article_state_snapshots (
      snapshot_id TEXT PRIMARY KEY,
      article_id INTEGER NOT NULL
    );

    CREATE TABLE article_state_transitions (
      transition_id TEXT PRIMARY KEY,
      article_id INTEGER NOT NULL
    );

    CREATE TABLE decision_outcomes (
      outcome_id TEXT PRIMARY KEY,
      article_id INTEGER NOT NULL
    );
  `);

  return {
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...params) {
          this._params = params;
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

async function runTests() {
  console.log('=============================================================');
  console.log('  RancangLoka — MEDIA-A4B.1 Canonical Detach Test Suite');
  console.log('=============================================================\n');

  const db = createTestDb();

  // Seed Article 1 with existing legacy featured image
  const legacyImageUrl = '/media/images/e65c333f60867f40e777fb13b14929cee478dc44d8b86ae6143b3acfff9d6857.webp';
  await db.prepare(`
    INSERT INTO articles (id, title, slug, content_md, content_html, featured_image, image_alt, content_hash, status)
    VALUES (1, 'Canary Article', 'rancangloka-internal-ingest-smoke-test-2026-09-04', 'Sample content', '<p>Sample</p>', ?, 'Legacy Alt', 'hash_art1', 'draft')
  `).bind(legacyImageUrl).run();

  // Seed Asset A (Canary Target Asset ast_8321f8f3eb7b039c59c222ba)
  const assetA = 'ast_8321f8f3eb7b039c59c222ba';
  const assetAKey = 'media/canary/media-a3/7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967.png';
  await db.prepare(`
    INSERT INTO media_assets (asset_id, source_type, storage_key, public_url, mime_type, width, height, file_size, sha256, status, role)
    VALUES (?, 'lokamedia_extension', ?, ?, 'image/png', 169, 512, 66377, 'sha_asset_a', 'VALIDATED', 'ARTICLE_PUBLIC_DERIVATIVE')
  `).bind(assetA, assetAKey, '/' + assetAKey).run();

  // Seed Asset B
  const assetB = 'ast_replacement_asset_b';
  await db.prepare(`
    INSERT INTO media_assets (asset_id, source_type, storage_key, public_url, mime_type, width, height, file_size, sha256, status, role)
    VALUES (?, 'manual_upload', 'asset_b.png', '/asset_b.png', 'image/png', 800, 600, 50000, 'sha_asset_b', 'VALIDATED', 'ARTICLE_PUBLIC_DERIVATIVE')
  `).bind(assetB).run();

  // --- Test 1: Phase 9 — Critical Legacy Field Immutability ---
  console.log('--- Test 1: Phase 9 — Legacy Field Immutability ---');
  const artPre = await db.prepare('SELECT featured_image, image_alt FROM articles WHERE id = 1').first();
  assert.equal(artPre.featured_image, legacyImageUrl);

  // Attach Asset A
  const attachRes = await attachArticleMedia({
    article_id: 1,
    slot_key: 'featured',
    asset_id: assetA,
    caption: 'Canary attachment'
  }, db);
  assert.equal(attachRes.status, 'success');

  const artDuring = await db.prepare('SELECT featured_image, image_alt FROM articles WHERE id = 1').first();
  assert.equal(artDuring.featured_image, legacyImageUrl, 'articles.featured_image must NOT change during attach');

  // Detach Asset A
  const detachRes = await detachArticleMedia({
    article_id: 1,
    asset_id: assetA,
    slot_key: 'featured'
  }, db);
  assert.equal(detachRes.status, 'success');
  assert.equal(detachRes.detached, true);
  assert.equal(detachRes.already_inactive, false);

  const artPost = await db.prepare('SELECT featured_image, image_alt FROM articles WHERE id = 1').first();
  assert.equal(artPost.featured_image, legacyImageUrl, 'articles.featured_image must NOT change during detach');
  assert.equal(artPost.image_alt, 'Legacy Alt');
  pass('LEGACY_FEATURED_IMAGE_IMMUTABILITY_TEST_PASS');

  // --- Test 2: Phase 10 — Canonical State Roundtrip ---
  console.log('\n--- Test 2: Phase 10 — Canonical State Roundtrip ---');
  const basePreflightInput = {
    project: 'RancangLoka',
    articleId: 1,
    slug: 'rancangloka-internal-ingest-smoke-test-2026-09-04',
    contentHash: 'hash_art1',
    hasContent: true,
    persistedReadinessStatus: 'NOT_READY',
    isReady: 0,
    readingTimeMinutes: 5,
    isSponsored: false,
    manualHold: 0,
    status: 'draft'
  };

  // State 0: Baseline (no active media)
  const state0 = buildCanonicalPublicationPreflightState({ ...basePreflightInput, featuredAssetId: null });
  const hash0 = computeCanonicalPreflightHash(state0);

  // State 1: Re-attach Asset A
  await attachArticleMedia({ article_id: 1, slot_key: 'featured', asset_id: assetA }, db);
  const state1 = buildCanonicalPublicationPreflightState({ ...basePreflightInput, featuredAssetId: assetA });
  const hash1 = computeCanonicalPreflightHash(state1);

  assert.notEqual(hash0, hash1, 'Hash must change when media is attached');
  assert.equal(state1.heroImagePresent, true);

  // State 2: Detach Asset A
  await detachArticleMedia({ article_id: 1, asset_id: assetA, slot_key: 'featured' }, db);

  // Active featured media query returns null
  const activeMediaRow = await db.prepare("SELECT asset_id FROM article_media WHERE article_id = 1 AND role = 'featured' AND is_active = 1").first();
  assert.equal(activeMediaRow, null, 'Active featured asset must be null after detach');

  const state2 = buildCanonicalPublicationPreflightState({ ...basePreflightInput, featuredAssetId: activeMediaRow?.asset_id || null });
  const hash2 = computeCanonicalPreflightHash(state2);

  assert.deepEqual(state2, state0, 'Post-detach canonical state must deep-equal baseline state');
  assert.equal(hash2, hash0, 'Post-detach canonical hash must match baseline hash 100%');
  pass('CANONICAL_STATE_ROUNDTRIP_PASS');

  // --- Test 3: Phase 11 — Active Slot Reuse ---
  console.log('\n--- Test 3: Phase 11 — Active Slot Reuse ---');
  // Asset A was attached, then detached (is_active = 0 exists for slot 'featured').
  // Now attach Asset B to the SAME slot ('featured')
  const attachBRes = await attachArticleMedia({
    article_id: 1,
    slot_key: 'featured',
    asset_id: assetB,
    caption: 'Replacement asset B'
  }, db);
  assert.equal(attachBRes.status, 'success');
  assert.equal(attachBRes.attachment.asset_id, assetB);
  assert.equal(attachBRes.attachment.is_active, 1);

  // Verify exactly 1 active featured binding exists (Asset B)
  const activeB = await db.prepare("SELECT asset_id FROM article_media WHERE article_id = 1 AND role = 'featured' AND is_active = 1").first();
  assert.equal(activeB.asset_id, assetB);

  // Verify total bindings for article 1 is 3 (2 inactive rows for Asset A from Test 1 & 2, 1 active for Asset B)
  const totalBindings = await db.prepare('SELECT count(*) as count FROM article_media WHERE article_id = 1').first();
  assert.equal(totalBindings.count, 3);

  // Cleanup: Detach Asset B
  await detachArticleMedia({ article_id: 1, asset_id: assetB, slot_key: 'featured' }, db);
  pass('ACTIVE_SLOT_REUSE_PASS');

  // --- Test 4: Phase 12 — Detach Idempotency ---
  console.log('\n--- Test 4: Phase 12 — Detach Idempotency ---');
  // Asset B was just detached above (is_active = 0).
  // Detaching Asset B again should succeed idempotently
  const detachBAgain = await detachArticleMedia({
    article_id: 1,
    asset_id: assetB,
    slot_key: 'featured'
  }, db);

  assert.equal(detachBAgain.status, 'success');
  assert.equal(detachBAgain.detached, false, 'detached must be false when already inactive');
  assert.equal(detachBAgain.already_inactive, true, 'already_inactive must be true');
  assert.equal(detachBAgain.binding.is_active, 0);

  // Row count must remain unchanged (3 total bindings: 2 inactive for A, 1 inactive for B)
  const totalAfterDup = await db.prepare('SELECT count(*) as count FROM article_media WHERE article_id = 1').first();
  assert.equal(totalAfterDup.count, 3);
  pass('DETACH_IDEMPOTENCY_PASS');

  // --- Test 5: Phase 13 — Conflict & Validation Tests ---
  console.log('\n--- Test 5: Phase 13 — Conflict & Validation Tests ---');
  // 1. Non-existent article
  await assert.rejects(
    () => detachArticleMedia({ article_id: 9999, asset_id: assetA }, db),
    (err) => err.code === 'ARTICLE_NOT_FOUND'
  );

  // 2. Non-existent asset
  await assert.rejects(
    () => detachArticleMedia({ article_id: 1, asset_id: 'ast_unknown_123' }, db),
    (err) => err.code === 'MEDIA_ASSET_NOT_FOUND'
  );

  // 3. Binding not found for article/asset combination
  await assert.rejects(
    () => detachArticleMedia({ article_id: 1, asset_id: assetA, slot_key: 'non_existent_slot' }, db),
    (err) => err.code === 'ARTICLE_MEDIA_BINDING_NOT_FOUND'
  );

  // 4. Role mismatch
  await assert.rejects(
    () => detachArticleMedia({ article_id: 1, asset_id: assetA, slot_key: 'featured', role: 'inline' }, db),
    (err) => err.code === 'ROLE_MISMATCH'
  );

  // 5. Invalid slot key format
  await assert.rejects(
    () => detachArticleMedia({ article_id: 1, asset_id: assetA, slot_key: 'INVALID-SLOT' }, db),
    (err) => err.code === 'INVALID_SLOT_KEY'
  );
  pass('DETACH_CONFLICT_HANDLING_PASS');

  // --- Test 6: Phase 14 — Mutation Scope Verification ---
  console.log('\n--- Test 6: Phase 14 — Mutation Scope Verification ---');
  // Re-attach Asset A and measure side effects of detach
  await attachArticleMedia({ article_id: 1, slot_key: 'featured', asset_id: assetA }, db);

  const artBefore = await db.prepare('SELECT * FROM articles WHERE id = 1').first();
  const assetBefore = await db.prepare('SELECT * FROM media_assets WHERE asset_id = ?').bind(assetA).first();

  await detachArticleMedia({ article_id: 1, asset_id: assetA, slot_key: 'featured' }, db);

  const artAfter = await db.prepare('SELECT * FROM articles WHERE id = 1').first();
  const assetAfter = await db.prepare('SELECT * FROM media_assets WHERE asset_id = ?').bind(assetA).first();

  assert.deepEqual(artAfter, artBefore, 'Articles table must have zero field mutations');
  assert.deepEqual(assetAfter, assetBefore, 'Media assets table must have zero field mutations');
  pass('DETACH_MUTATION_SCOPE_PASS');

  // --- Test 7: Phase 15 — Ledger Semantics (Zero Trajectory Hallucinations) ---
  console.log('\n--- Test 7: Phase 15 — Ledger Semantics ---');
  const snapshots = await db.prepare('SELECT count(*) as count FROM article_state_snapshots').first();
  const transitions = await db.prepare('SELECT count(*) as count FROM article_state_transitions').first();
  const outcomes = await db.prepare('SELECT count(*) as count FROM decision_outcomes').first();

  assert.equal(snapshots.count, 0, 'Trajectory snapshots must be 0');
  assert.equal(transitions.count, 0, 'Trajectory transitions must be 0');
  assert.equal(outcomes.count, 0, 'Trajectory outcomes must be 0');
  pass('DETACH_LEDGER_DECOUPLING_PASS');

  // --- Test 8: Phase 16 — Local Full A4B Roundtrip ---
  console.log('\n--- Test 8: Phase 16 — Local Full A4B Roundtrip ---');
  // Reset Article 1 article_media to empty
  await db.prepare('DELETE FROM article_media WHERE article_id = 1').run();

  // 1. Initial baseline
  const active0 = await db.prepare("SELECT asset_id FROM article_media WHERE article_id = 1 AND role = 'featured' AND is_active = 1").first();
  assert.equal(active0, null);
  const baselineState = buildCanonicalPublicationPreflightState({ ...basePreflightInput, featuredAssetId: null });
  const baselineHash = computeCanonicalPreflightHash(baselineState);

  // 2. Attach canary
  const canaryAttach = await attachArticleMedia({ article_id: 1, slot_key: 'featured', asset_id: assetA }, db);
  assert.equal(canaryAttach.status, 'success');
  const active1 = await db.prepare("SELECT asset_id FROM article_media WHERE article_id = 1 AND role = 'featured' AND is_active = 1").first();
  assert.equal(active1.asset_id, assetA);
  const duringState = buildCanonicalPublicationPreflightState({ ...basePreflightInput, featuredAssetId: assetA });
  const duringHash = computeCanonicalPreflightHash(duringState);
  assert.notEqual(duringHash, baselineHash);

  // 3. Detach canary
  const canaryDetach = await detachArticleMedia({
    article_id: 1,
    asset_id: assetA,
    slot_key: 'featured',
    binding_id: canaryAttach.attachment.id
  }, db);
  assert.equal(canaryDetach.status, 'success');
  assert.equal(canaryDetach.detached, true);

  // 4. Verify post-canary state
  const active2 = await db.prepare("SELECT asset_id FROM article_media WHERE article_id = 1 AND role = 'featured' AND is_active = 1").first();
  assert.equal(active2, null);
  const postState = buildCanonicalPublicationPreflightState({ ...basePreflightInput, featuredAssetId: null });
  const postHash = computeCanonicalPreflightHash(postState);

  assert.equal(postHash, baselineHash, 'Post-canary hash must exactly restore baseline hash');
  pass('LOCAL_FULL_ROUNDTRIP_PASS');

  console.log('\n=============================================================');
  console.log('  ALL 8 MEDIA-A4B.1 CANONICAL DETACH TESTS PASSED CLEANLY');
  console.log('=============================================================\n');
}

runTests().catch(err => {
  console.error('\nTEST SUITE FATAL ERROR:', err);
  process.exit(1);
});
