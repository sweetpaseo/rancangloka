/**
 * RancangLoka — Canonical Preflight State Parity Test Suite (JEV-7M.1)
 *
 * Verifies 100% mathematical and operational parity across:
 * - Publication Planner
 * - Autonomous Jev Shadow Collector
 * - Editorial Trajectory Evidence Ledger
 * - Operator Controls (Hold/Resume)
 * - Shared Authoritative Loader (loadCanonicalPublicationPreflightInput)
 */

import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import {
  buildCanonicalPublicationPreflightState,
  computeCanonicalPreflightHash,
  loadCanonicalPublicationPreflightInput
} from '../src/lib/decision/publication-preflight-state.ts';
import { buildPublicationPreflightState as collectorBuildState } from '../src/lib/decision/shadow-collector.ts';
import { DECISION_SCHEMA_VERSION } from '../src/lib/decision/decision-types.ts';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

function createMockD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE articles (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      content_hash TEXT,
      content_md TEXT,
      content_html TEXT,
      featured_image TEXT,
      image_alt TEXT,
      reading_time_minutes INTEGER DEFAULT 5,
      is_sponsored INTEGER DEFAULT 0,
      manual_hold INTEGER DEFAULT 0
    );

    CREATE TABLE article_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      asset_id TEXT NOT NULL,
      role TEXT NOT NULL,
      slot_key TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE article_publication_readiness (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      overall_status TEXT NOT NULL,
      is_ready INTEGER NOT NULL,
      evaluated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return {
    raw: sqlite,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            first: async () => {
              const stmt = sqlite.prepare(sql);
              return stmt.get(...params);
            },
            all: async () => {
              const stmt = sqlite.prepare(sql);
              const results = stmt.all(...params);
              return { results };
            }
          };
        }
      };
    }
  };
}

console.log('\n=============================================================');
console.log('  RancangLoka — JEV-7M.1 Canonical State Parity Suite');
console.log('=============================================================\n');

// 1. Shared Data Loader Existence and Functionality
await testAsync('Test 1: loadCanonicalPublicationPreflightInput is an authoritative shared function', async () => {
  assert.strictEqual(typeof loadCanonicalPublicationPreflightInput, 'function');
  const db = createMockD1();
  const nullInput = await loadCanonicalPublicationPreflightInput(db, 9999);
  assert.strictEqual(nullInput, null, 'Non-existent article returns null');
});

// 2. No Active article_media: featuredAssetId is absent everywhere regardless of articles.featured_image
await testAsync('Test 2: Featured media absent when active article_media missing (legacy featured_image ignored)', async () => {
  const db = createMockD1();
  db.raw.prepare(`
    INSERT INTO articles (id, slug, title, status, content_hash, content_md, featured_image, reading_time_minutes, is_sponsored, manual_hold)
    VALUES (1, 'internal-smoke-test', 'Smoke Test', 'draft', 'hash_0b88', 'Sample markdown content', '/media/images/legacy_mirror.webp', 3, 0, 0)
  `).run();

  const loaded = await loadCanonicalPublicationPreflightInput(db, 1);
  assert.ok(loaded, 'Article 1 loaded');
  assert.strictEqual(loaded.featuredAssetId, null, 'featuredAssetId must be null when no active article_media');
  assert.strictEqual(loaded.manualHold, 0);

  const canonicalState = buildCanonicalPublicationPreflightState(loaded);
  assert.strictEqual(canonicalState.heroImagePresent, false, 'heroImagePresent must be false');
  assert.strictEqual(canonicalState.plannerEligibilityStatus, 'NOT_ELIGIBLE', 'plannerEligibilityStatus must be NOT_ELIGIBLE without media');
});

// 3. Active article_media featured binding: featured media present everywhere
await testAsync('Test 3: Active article_media binding provides authoritative featuredAssetId', async () => {
  const db = createMockD1();
  db.raw.prepare(`
    INSERT INTO articles (id, slug, title, status, content_hash, content_md, featured_image, reading_time_minutes, is_sponsored, manual_hold)
    VALUES (5, 'kusen-aluminium-vs-upvc', 'Kusen Aluminium vs UPVC', 'draft', 'hash_c778', 'Sample comparison content', '', 8, 0, 0)
  `).run();
  db.raw.prepare(`
    INSERT INTO article_media (article_id, asset_id, role, slot_key, is_active)
    VALUES (5, 'ast_mfUpgVe99C_bq_p2d_O4Ge4L', 'featured', 'featured', 1)
  `).run();

  const loaded = await loadCanonicalPublicationPreflightInput(db, 5);
  assert.ok(loaded, 'Article 5 loaded');
  assert.strictEqual(loaded.featuredAssetId, 'ast_mfUpgVe99C_bq_p2d_O4Ge4L', 'featuredAssetId resolved from article_media');

  const canonicalState = buildCanonicalPublicationPreflightState(loaded);
  assert.strictEqual(canonicalState.heroImagePresent, true, 'heroImagePresent must be true');
  assert.strictEqual(canonicalState.plannerEligibilityStatus, 'ELIGIBLE', 'plannerEligibilityStatus must be ELIGIBLE');
});

// 4. Parity across Planner, Collector, and Ledger for Article 1 State
await testAsync('Test 4: Strict parity across planner, collector, and ledger for Article 1 (Target: h_1a9ca364)', async () => {
  const db = createMockD1();
  db.raw.prepare(`
    INSERT INTO articles (id, slug, title, status, content_hash, content_md, featured_image, reading_time_minutes, is_sponsored, manual_hold)
    VALUES (1, 'rancangloka-internal-ingest-smoke-test-2026-09-04', 'Smoke Test', 'draft', '0b88aa50b67259013d00757825356877ae3a78061d9151dc446eb0e8d0f419cf', 'Content', '/media/images/e65c333f60867f40e777fb13b14929cee478dc44d8b86ae6143b3acfff9d6857.webp', 3, 0, 0)
  `).run();

  // Path A: Shared Loader + Canonical State Builder (Ledger / Operator Controls)
  const loadedInput = await loadCanonicalPublicationPreflightInput(db, 1);
  const ledgerState = buildCanonicalPublicationPreflightState(loadedInput);
  const ledgerHash = computeCanonicalPreflightHash(ledgerState);

  // Path B: Shadow Collector
  const collectorSubject = {
    id: 1,
    slug: 'rancangloka-internal-ingest-smoke-test-2026-09-04',
    contentHash: '0b88aa50b67259013d00757825356877ae3a78061d9151dc446eb0e8d0f419cf',
    featuredAssetId: null, // From LEFT JOIN article_media
    readinessStatus: 'NOT_READY',
    isReady: 0,
    readingTimeMinutes: 3,
    isSponsored: false,
    manualHold: 0,
    status: 'draft'
  };
  const collectorState = collectorBuildState(collectorSubject);
  const collectorHash = computeCanonicalPreflightHash(collectorState);

  assert.deepStrictEqual(ledgerState, collectorState, 'Ledger and Collector states must match identically');
  assert.strictEqual(ledgerHash, collectorHash, 'Ledger and Collector hashes must match identically');
  assert.strictEqual(ledgerHash, 'h_1a9ca364', 'Reproduced historical JEV-7G canonical v2 hash h_1a9ca364');
});

// 5. Parity across Planner, Collector, and Ledger for Article 5 State
await testAsync('Test 5: Strict parity across planner, collector, and ledger for Article 5 (Active Media Bound)', async () => {
  const db = createMockD1();
  db.raw.prepare(`
    INSERT INTO articles (id, slug, title, status, content_hash, content_md, featured_image, reading_time_minutes, is_sponsored, manual_hold)
    VALUES (5, 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia', 'Kusen Aluminium vs UPVC', 'draft', 'c77881c0c35025aadf56bd3e64e3d40348b187c84d408a9c7275e6d0a0d26378', 'Content', '/media/images/mirror.webp', 8, 0, 0)
  `).run();
  db.raw.prepare(`
    INSERT INTO article_media (article_id, asset_id, role, slot_key, is_active)
    VALUES (5, 'ast_mfUpgVe99C_bq_p2d_O4Ge4L', 'featured', 'featured', 1)
  `).run();

  // Path A: Shared Loader (Ledger / Operator Controls)
  const loadedInput = await loadCanonicalPublicationPreflightInput(db, 5);
  const ledgerState = buildCanonicalPublicationPreflightState(loadedInput);
  const ledgerHash = computeCanonicalPreflightHash(ledgerState);

  // Path B: Shadow Collector
  const collectorSubject = {
    id: 5,
    slug: 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
    contentHash: 'c77881c0c35025aadf56bd3e64e3d40348b187c84d408a9c7275e6d0a0d26378',
    featuredAssetId: 'ast_mfUpgVe99C_bq_p2d_O4Ge4L',
    readinessStatus: 'NOT_READY',
    isReady: 0,
    readingTimeMinutes: 8,
    isSponsored: false,
    manualHold: 0,
    status: 'draft'
  };
  const collectorState = collectorBuildState(collectorSubject);
  const collectorHash = computeCanonicalPreflightHash(collectorState);

  assert.deepStrictEqual(ledgerState, collectorState, 'Article 5 Ledger and Collector states must match identically');
  assert.strictEqual(ledgerHash, collectorHash, 'Article 5 Ledger and Collector hashes must match identically');
});

// 6. Legacy articles.featured_image Disagreement cannot alter Canonical State
await testAsync('Test 6: Disagreement in legacy articles.featured_image cannot alter canonical state', async () => {
  const db = createMockD1();
  db.raw.prepare(`
    INSERT INTO articles (id, slug, title, status, content_hash, content_md, featured_image, reading_time_minutes, is_sponsored, manual_hold)
    VALUES (10, 'disagreement-test', 'Test', 'draft', 'hash_test', 'Content', '/media/images/bogus_legacy_mirror.webp', 5, 0, 0)
  `).run();
  db.raw.prepare(`
    INSERT INTO article_media (article_id, asset_id, role, slot_key, is_active)
    VALUES (10, 'ast_authoritative_789', 'featured', 'featured', 1)
  `).run();

  const loaded = await loadCanonicalPublicationPreflightInput(db, 10);
  assert.strictEqual(loaded.featuredAssetId, 'ast_authoritative_789', 'Must use authoritative article_media asset_id, ignoring bogus legacy URL');

  const canonicalState = buildCanonicalPublicationPreflightState(loaded);
  assert.strictEqual(canonicalState.heroImagePresent, true);
});

// 7. Manual Hold Dimension Testing
await testAsync('Test 7: Manual hold toggles only the operational eligibility dimension', async () => {
  const db = createMockD1();
  db.raw.prepare(`
    INSERT INTO articles (id, slug, title, status, content_hash, content_md, featured_image, reading_time_minutes, is_sponsored, manual_hold)
    VALUES (20, 'hold-test', 'Hold Test', 'draft', 'hash_hold', 'Content', '', 5, 0, 0)
  `).run();
  db.raw.prepare(`
    INSERT INTO article_media (article_id, asset_id, role, slot_key, is_active)
    VALUES (20, 'ast_active_20', 'featured', 'featured', 1)
  `).run();

  const inputBefore = await loadCanonicalPublicationPreflightInput(db, 20, { manualHold: 0 });
  const inputAfter = await loadCanonicalPublicationPreflightInput(db, 20, { manualHold: 1 });

  const stateBefore = buildCanonicalPublicationPreflightState(inputBefore);
  const stateAfter = buildCanonicalPublicationPreflightState(inputAfter);

  assert.strictEqual(stateBefore.plannerEligibilityStatus, 'ELIGIBLE');
  assert.strictEqual(stateAfter.plannerEligibilityStatus, 'NOT_ELIGIBLE');

  // Verify that ONLY plannerEligibilityStatus changed among the 12 canonical fields
  const diffKeys = Object.keys(stateBefore).filter(k => stateBefore[k] !== stateAfter[k]);
  assert.deepStrictEqual(diffKeys, ['plannerEligibilityStatus'], 'Only plannerEligibilityStatus may differ when manual hold is toggled');

  const hashBefore = computeCanonicalPreflightHash(stateBefore);
  const hashAfter = computeCanonicalPreflightHash(stateAfter);
  assert.notStrictEqual(hashBefore, hashAfter, 'Hash changes when operational eligibility changes');
});

// 8. Decision ↔ Snapshot Linkability Join Key
await testAsync('Test 8: Decision observation to state snapshot join key (article_id, input_hash, schema_version) links reliably', async () => {
  const db = createMockD1();
  db.raw.prepare(`
    INSERT INTO articles (id, slug, title, status, content_hash, content_md, featured_image, reading_time_minutes, is_sponsored, manual_hold)
    VALUES (1, 'rancangloka-internal-ingest-smoke-test-2026-09-04', 'Smoke Test', 'draft', '0b88aa50b67259013d00757825356877ae3a78061d9151dc446eb0e8d0f419cf', 'Content', '/media/images/legacy.webp', 3, 0, 0)
  `).run();

  // Shadow Collector observation record key
  const collectorSubject = {
    id: 1,
    slug: 'rancangloka-internal-ingest-smoke-test-2026-09-04',
    contentHash: '0b88aa50b67259013d00757825356877ae3a78061d9151dc446eb0e8d0f419cf',
    featuredAssetId: null,
    readinessStatus: 'NOT_READY',
    isReady: 0,
    readingTimeMinutes: 3,
    isSponsored: false,
    manualHold: 0,
    status: 'draft'
  };
  const obsState = collectorBuildState(collectorSubject);
  const obsHash = computeCanonicalPreflightHash(obsState);
  const obsKey = {
    subject_id: '1',
    input_hash: obsHash,
    input_schema_version: DECISION_SCHEMA_VERSION
  };

  // Trajectory Ledger snapshot record key
  const loadedInput = await loadCanonicalPublicationPreflightInput(db, 1);
  const snapState = buildCanonicalPublicationPreflightState(loadedInput);
  const snapHash = computeCanonicalPreflightHash(snapState);
  const snapKey = {
    article_id: 1,
    input_hash: snapHash,
    input_schema_version: DECISION_SCHEMA_VERSION
  };

  assert.strictEqual(Number(obsKey.subject_id), snapKey.article_id, 'Subject/article ID must match');
  assert.strictEqual(obsKey.input_hash, snapKey.input_hash, 'Input hash must match exactly');
  assert.strictEqual(obsKey.input_schema_version, snapKey.input_schema_version, 'Schema version must match');
  assert.strictEqual(obsHash, 'h_1a9ca364');
  console.log(`    Join key verified: article_id=${snapKey.article_id}, input_hash=${snapHash}, version=${DECISION_SCHEMA_VERSION}`);
});

console.log('\n=============================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================================\n');

if (failed > 0) {
  process.exit(1);
}
