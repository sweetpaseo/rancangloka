/**
 * ============================================================================
 * RancangLoka Publication DNA Backfill Test Suite (CONTENT_PROTECTION-1B-C)
 *
 * Verifies local test matrix for Publication DNA backfill and source fidelity:
 * A. Article-5-shaped synthetic fixture: FULL_PROVENANCE, LEGACY V0, NORMALIZED_HASH_VERIFIED
 * B. Article-6-shaped synthetic fixture: PARTIAL_HISTORICAL_PROVENANCE, LEGACY V0, NORMALIZED_HASH_VERIFIED, NULL receipt
 * C. Modern receipt-backed fixture: FULL_PROVENANCE, MARKDOWN V1, BYTE_EXACT_HASH_VERIFIED
 * D. Canonical publisher cannot emit NORMALIZED_HASH_VERIFIED
 * E. Historical legacy path cannot claim BYTE_EXACT_HASH_VERIFIED
 * F. Version conflict blocks without overwrite (BLOCKED_VERSION_CONFLICT)
 * G. Identical repeat becomes ALREADY_EXISTS_IDENTICAL
 * H. Default CLI is dry-run
 * I. --apply alone is insufficient (remains DRY_RUN)
 * J. Dual confirmation enables local/mock insert (APPLY mode)
 * K. No UPDATE/DELETE SQL exists in backfill path
 * ============================================================================
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  CONTENT_HASH_CONTRACT_LEGACY_V0,
  CONTENT_HASH_CONTRACT_MARKDOWN_V1,
  SOURCE_FIDELITY_BYTE_EXACT,
  SOURCE_FIDELITY_NORMALIZED,
  computeCanonicalContentHash,
  computeLegacyContentHashV0
} from '../src/lib/content-protection/publication-dna.ts';

import {
  materializePublicationDna
} from '../src/lib/content-protection/publication-dna-store.ts';

import {
  buildBackfillPlans,
  runPublicationDnaBackfill,
  formatDryRunTable
} from './backfill-publication-dna.js';

let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failedCount++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failedCount++;
  }
}

/**
 * Creates an in-memory SQLite database loaded with migrations up to 0034 (amended).
 */
function createBackfillTestDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = OFF;');

  // Base schema
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  const migrations = [
    '0001_initial_schema.sql',
    '0002_article_slug_and_dates.sql',
    '0003_admin_users.sql',
    '0004_d1_audit_log.sql',
    '0005_media_assets_and_article_media.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql',
    '0008_publication_planner.sql',
    '0009_publication_publisher.sql',
    '0017_auto_schedule_and_manual_hold.sql',
    '0023_editorial_trajectory_ledger.sql',
    '0034_article_publication_dna.sql'
  ];

  for (const mig of migrations) {
    const migPath = path.resolve(process.cwd(), `db/migrations/${mig}`);
    if (fs.existsSync(migPath)) {
      const sql = fs.readFileSync(migPath, 'utf-8');
      sqlite.exec(sql);
    }
  }

  // Seed baseline author and category
  sqlite.exec(`
    INSERT OR IGNORE INTO authors (id, name, slug, bio) VALUES (1, 'Editor RancangLoka', 'editor-rancangloka', 'Redaksi');
    INSERT OR IGNORE INTO categories (id, name, slug) VALUES (1, 'Arsitektur', 'arsitektur');
  `);

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
        async all() {
          const stmt = sqlite.prepare(this._sql);
          return stmt.all(...this._params);
        },
        async first() {
          const stmt = sqlite.prepare(this._sql);
          const all = stmt.all(...this._params);
          return all[0] || null;
        },
        async run() {
          const stmt = sqlite.prepare(this._sql);
          const info = stmt.run(...this._params);
          return {
            changes: info.changes,
            lastInsertRowid: info.lastInsertRowid
          };
        }
      };
    }
  };
}

/**
 * Seeds synthetic test data for Articles 5–9 matching canonical production shapes.
 */
function seedBackfillCorpus(db) {
  const sqlite = db.raw;

  // Article 5: Legacy V0, FULL_PROVENANCE
  const art5Md = '# Panduan Kusen Aluminium vs UPVC\n\nPerbandingan material kusen jendela untuk rumah tropis Indonesia.';
  const art5Hash = computeLegacyContentHashV0(art5Md);
  sqlite.exec(`
    INSERT INTO articles (id, author_id, category_id, title, slug, description, content_md, content_html, content_hash, status, published_at)
    VALUES (5, 1, 1, 'Kusen Aluminium vs UPVC', 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia', 'Deskripsi Art 5', '${art5Md}', '<p>Art 5</p>', '${art5Hash}', 'published', '2026-09-28T06:10:39.816Z');

    INSERT INTO article_editorial_approvals (id, article_id, approved_by, approval_status, approved_content_hash, approved_asset_id, created_at)
    VALUES (9, 5, 'fanto_operator', 'APPROVED', '${art5Hash}', 'ast_5_asset', '2026-09-28 06:15:42');

    INSERT INTO publication_execution_receipts (receipt_id, execution_id, plan_id, article_id, slug, content_hash, featured_asset_id, canonical_url, target_publish_at, actual_published_at, outcome)
    VALUES ('rcpt_bbae85b48e1b2f8d', 'pexec_5', 'plan_5', 5, 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia', '${art5Hash}', 'ast_5_asset', 'https://rancangloka.com/kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia', '2026-09-28T06:10:39.816Z', '2026-09-28T06:10:39.816Z', 'SUCCESS');

    INSERT INTO media_assets (asset_id, source_type, storage_key, public_url, mime_type, width, height, file_size, sha256)
    VALUES ('ast_5_asset', 'manual_upload', 'media/images/631baf7a25e9986b9f0d01073633cb434ae162b3df1241ddac56b977026276e9.webp', '/media/images/631baf7a25e9986b9f0d01073633cb434ae162b3df1241ddac56b977026276e9.webp', 'image/webp', 1200, 800, 10240, '631baf7a25e9986b9f0d01073633cb434ae162b3df1241ddac56b977026276e9');
  `);

  // Article 6: Legacy V0, PARTIAL_HISTORICAL_PROVENANCE (no approval, no receipt)
  const art6Md = '# Rekayasa Ventilasi Silang Alami\n\nOptimasi aliran udara alami untuk kenyamanan rumah tinggal.';
  const art6Hash = computeLegacyContentHashV0(art6Md);
  sqlite.exec(`
    INSERT INTO articles (id, author_id, category_id, title, slug, description, content_md, content_html, content_hash, status, published_at)
    VALUES (6, 1, 1, 'Rekayasa Ventilasi Silang Alami', 'rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman', 'Deskripsi Art 6', '${art6Md}', '<p>Art 6</p>', '${art6Hash}', 'published', '2026-09-13T23:05:51.804Z');
  `);

  // Articles 7, 8, 9: Modern V1, FULL_PROVENANCE
  const modernArticles = [
    { id: 7, slug: 'jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge', title: 'Jendela Berkondensasi', receipt: 'rcpt_artA_d476e9020634', asset: 'ast_7_asset', sha: 'b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4', date: '2026-10-07 01:24:49' },
    { id: 8, slug: 'thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi', title: 'Thermal Bridge Kusen', receipt: 'rcpt_artB_f3fb92d8c53d', asset: 'ast_8_asset', sha: '8ecd77ff40bb4d933e27e44980bcec9ebb040e0cb971de72e5387ff6b463247d', date: '2026-10-07 01:28:26' },
    { id: 9, slug: 'memilih-sistem-shading-luar-rumah-tropis', title: 'Memilih Sistem Shading', receipt: 'rcpt_artC_8341d2fda3bc', asset: 'ast_9_asset', sha: '4ee0363758a41bd45aae735349028ab19ca6256964c20ec1d98af4e65c578bf4', date: '2026-10-15 03:32:49' }
  ];

  for (const m of modernArticles) {
    const md = `# ${m.title}\n\nUraian komprehensif terkait teknik dan material bangunan modern pada artikel ${m.id}.`;
    const hash = computeCanonicalContentHash(md);
    sqlite.exec(`
      INSERT INTO articles (id, author_id, category_id, title, slug, description, content_md, content_html, content_hash, status, published_at)
      VALUES (${m.id}, 1, 1, '${m.title}', '${m.slug}', 'Deskripsi ${m.id}', '${md}', '<p>${m.id}</p>', '${hash}', 'published', '${m.date}');

      INSERT INTO article_editorial_approvals (id, article_id, approved_by, approval_status, approved_content_hash, approved_asset_id, created_at)
      VALUES (${m.id + 10}, ${m.id}, 'fanto_operator', 'APPROVED', '${hash}', '${m.asset}', '${m.date}');

      INSERT INTO publication_execution_receipts (receipt_id, execution_id, plan_id, article_id, slug, content_hash, featured_asset_id, canonical_url, target_publish_at, actual_published_at, outcome)
      VALUES ('${m.receipt}', 'pexec_${m.id}', 'plan_${m.id}', ${m.id}, '${m.slug}', '${hash}', '${m.asset}', 'https://rancangloka.com/${m.slug}', '${m.date}', '${m.date}', 'SUCCESS');

      INSERT INTO media_assets (asset_id, source_type, storage_key, public_url, mime_type, width, height, file_size, sha256)
      VALUES ('${m.asset}', 'manual_upload', 'media/images/${m.sha}.webp', '/media/images/${m.sha}.webp', 'image/webp', 1200, 800, 12345, '${m.sha}');
    `);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('Publication DNA Backfill Test Suite (CONTENT_PROTECTION-1B-C)');
  console.log('================================================================\n');

  // Test A: Article-5-shaped synthetic fixture
  await testAsync('A. Article-5-shaped fixture: FULL_PROVENANCE, LEGACY V0, NORMALIZED_HASH_VERIFIED', async () => {
    const db = createBackfillTestDb();
    seedBackfillCorpus(db);

    const plans = await buildBackfillPlans(db);
    const p5 = plans.find(p => p.article_id === 5);
    assert(p5, 'Plan for article 5 must exist');
    assert.strictEqual(p5.provenance_class, 'FULL_PROVENANCE');
    assert.strictEqual(p5.content_hash_contract, CONTENT_HASH_CONTRACT_LEGACY_V0);
    assert.strictEqual(p5.source_fidelity, SOURCE_FIDELITY_NORMALIZED);
    assert.strictEqual(p5.hash_verification, 'PASS_NORMALIZED_MATCH');
    assert(p5.approval_state.startsWith('FULL_MATCH'));
    assert(p5.receipt_state.startsWith('FULL_MATCH'));
    assert.strictEqual(p5.planned_action, 'WOULD_INSERT');
  });

  // Test B: Article-6-shaped fixture
  await testAsync('B. Article-6-shaped fixture: PARTIAL_HISTORICAL_PROVENANCE, LEGACY V0, NORMALIZED_HASH_VERIFIED, NULL receipt', async () => {
    const db = createBackfillTestDb();
    seedBackfillCorpus(db);

    const plans = await buildBackfillPlans(db);
    const p6 = plans.find(p => p.article_id === 6);
    assert(p6, 'Plan for article 6 must exist');
    assert.strictEqual(p6.provenance_class, 'PARTIAL_HISTORICAL_PROVENANCE');
    assert.strictEqual(p6.content_hash_contract, CONTENT_HASH_CONTRACT_LEGACY_V0);
    assert.strictEqual(p6.source_fidelity, SOURCE_FIDELITY_NORMALIZED);
    assert.strictEqual(p6.hash_verification, 'PASS_NORMALIZED_MATCH');
    assert.strictEqual(p6.approval_state, 'NONE_PARTIAL_PROVENANCE');
    assert.strictEqual(p6.receipt_state, 'NONE_PARTIAL_PROVENANCE');
    assert(p6.version_key.startsWith('historical:6:'));
    assert.strictEqual(p6.planned_action, 'WOULD_INSERT');
    assert.strictEqual(p6.snapshot.receiptId, null);
    assert.strictEqual(p6.snapshot.executionId, null);
    assert.strictEqual(p6.snapshot.approvedContentHash, null);
    assert.strictEqual(p6.snapshot.approvedRecordedAt, null);
    assert.strictEqual(p6.snapshot.historicalPublishedAt, '2026-09-13T23:05:51.804Z');
  });

  // Test C: Modern receipt-backed fixture (Art 7–9)
  await testAsync('C. Modern receipt-backed fixture: FULL_PROVENANCE, MARKDOWN V1, BYTE_EXACT_HASH_VERIFIED', async () => {
    const db = createBackfillTestDb();
    seedBackfillCorpus(db);

    const plans = await buildBackfillPlans(db);
    for (const id of [7, 8, 9]) {
      const p = plans.find(plan => plan.article_id === id);
      assert(p, `Plan for article ${id} must exist`);
      assert.strictEqual(p.provenance_class, 'FULL_PROVENANCE');
      assert.strictEqual(p.content_hash_contract, CONTENT_HASH_CONTRACT_MARKDOWN_V1);
      assert.strictEqual(p.source_fidelity, SOURCE_FIDELITY_BYTE_EXACT);
      assert.strictEqual(p.hash_verification, 'PASS_BYTE_EXACT_MATCH');
      assert(p.approval_state.startsWith('FULL_MATCH'));
      assert(p.receipt_state.startsWith('FULL_MATCH'));
      assert.strictEqual(p.planned_action, 'WOULD_INSERT');
    }
  });

  // Test D: Canonical publisher cannot emit NORMALIZED_HASH_VERIFIED
  await testAsync('D. Canonical publisher cannot emit NORMALIZED_HASH_VERIFIED under Markdown V1', async () => {
    const db = createBackfillTestDb();
    const md = '# New Post\n\nCanonical test prose.';
    const hash = computeCanonicalContentHash(md);

    // Attempt to pass NORMALIZED_HASH_VERIFIED with Markdown V1
    const snapshot = {
      articleId: 101,
      contentMarkdown: md,
      contentHash: hash,
      slug: 'new-post',
      canonicalUrl: 'https://rancangloka.com/new-post',
      approvedContentHash: hash,
      executionId: 'pexec_101',
      receiptId: 'rcpt_101',
      actualPublishedAt: new Date().toISOString(),
      provenanceClass: 'FULL_PROVENANCE',
      contentHashContract: CONTENT_HASH_CONTRACT_MARKDOWN_V1,
      sourceFidelity: SOURCE_FIDELITY_NORMALIZED
    };

    const res = await materializePublicationDna(db, snapshot);
    assert.strictEqual(res.status, 'DNA_GENERATION_FAILED');
    assert(res.error.includes("cannot emit 'NORMALIZED_HASH_VERIFIED'"));
  });

  // Test E: Historical legacy path cannot claim BYTE_EXACT_HASH_VERIFIED
  await testAsync('E. Historical legacy path cannot claim BYTE_EXACT_HASH_VERIFIED under Legacy V0', async () => {
    const db = createBackfillTestDb();
    const md = '# Legacy Post\n\nHistorical test prose.';
    const hash = computeLegacyContentHashV0(md);

    // Attempt to claim BYTE_EXACT_HASH_VERIFIED for Legacy V0
    const snapshot = {
      articleId: 102,
      contentMarkdown: md,
      contentHash: hash,
      slug: 'legacy-post',
      canonicalUrl: 'https://rancangloka.com/legacy-post',
      approvedContentHash: hash,
      executionId: 'pexec_102',
      receiptId: 'rcpt_102',
      actualPublishedAt: new Date().toISOString(),
      provenanceClass: 'FULL_PROVENANCE',
      contentHashContract: CONTENT_HASH_CONTRACT_LEGACY_V0,
      sourceFidelity: SOURCE_FIDELITY_BYTE_EXACT
    };

    const res = await materializePublicationDna(db, snapshot);
    assert.strictEqual(res.status, 'DNA_GENERATION_FAILED');
    assert(res.error.includes("Historical legacy V0 content hash cannot claim 'BYTE_EXACT_HASH_VERIFIED'"));
  });

  // Test F: Version conflict blocks without overwrite
  await testAsync('F. Version conflict blocks without overwrite (BLOCKED_VERSION_CONFLICT)', async () => {
    const db = createBackfillTestDb();
    seedBackfillCorpus(db);

    // Seed existing DNA for Article 5 with tampered/conflicting content hash
    db.raw.exec(`
      INSERT INTO article_dna_signatures (
        dna_id, version_key, article_id, publication_receipt_id, publication_execution_id,
        provenance_class, content_hash_contract, source_fidelity, published_content_hash, approved_content_hash,
        canonical_slug, canonical_url, dna_version, normalization_version, shingle_version, minhash_version,
        normalized_text_hash, block_hashes_json, minhash_signature_json, structural_signature_json,
        generator_version, created_at
      ) VALUES (
        'dna_conflict_test', 'receipt:rcpt_bbae85b48e1b2f8d', 5, 'rcpt_bbae85b48e1b2f8d', 'pexec_5',
        'FULL_PROVENANCE', 'legacy-normalized-sha256-v0', 'NORMALIZED_HASH_VERIFIED', 'conflicting_tampered_hash', 'conflicting_tampered_hash',
        'art5', 'https://rancangloka.com/art5', 'v1.0', 'norm-v1', 'shingle-4w-v1', 'minhash-64h-v1',
        'normhash', '[]', '[]', '{}',
        'dna-engine/1.0.0', '2026-09-28 06:15:42'
      );
    `);

    const plans = await buildBackfillPlans(db);
    const p5 = plans.find(p => p.article_id === 5);
    assert.strictEqual(p5.planned_action, 'BLOCKED_VERSION_CONFLICT');
    assert(p5.block_reason.includes('conflicts with snapshot fields'));

    // Verify row was NOT overwritten
    const checkRow = await db.prepare("SELECT published_content_hash FROM article_dna_signatures WHERE version_key = 'receipt:rcpt_bbae85b48e1b2f8d'").first();
    assert.strictEqual(checkRow.published_content_hash, 'conflicting_tampered_hash');
  });

  // Test G: Identical repeat becomes ALREADY_EXISTS_IDENTICAL
  await testAsync('G. Identical repeat becomes ALREADY_EXISTS_IDENTICAL', async () => {
    const db = createBackfillTestDb();
    seedBackfillCorpus(db);

    // Run first apply
    const run1 = await runPublicationDnaBackfill({ db, apply: true, confirm: true });
    assert.strictEqual(run1.insertedCount, 5);
    assert.strictEqual(run1.alreadyExistsCount, 0);

    // Run second apply on exact same data
    const run2 = await runPublicationDnaBackfill({ db, apply: true, confirm: true });
    assert.strictEqual(run2.insertedCount, 0);
    assert.strictEqual(run2.alreadyExistsCount, 5);
    assert(run2.plans.every(p => p.planned_action === 'ALREADY_EXISTS_IDENTICAL'));
  });

  // Test H: Default CLI execution is dry-run
  await testAsync('H. Default CLI execution is dry-run (zero inserts without apply)', async () => {
    const db = createBackfillTestDb();
    seedBackfillCorpus(db);

    const res = await runPublicationDnaBackfill({ db });
    assert.strictEqual(res.mode, 'DRY_RUN');
    assert.strictEqual(res.insertedCount, 0);

    const countRow = await db.prepare('SELECT COUNT(*) as cnt FROM article_dna_signatures').first();
    assert.strictEqual(countRow.cnt, 0);
  });

  // Test I: --apply alone is insufficient
  await testAsync('I. --apply alone without confirm is insufficient (remains DRY_RUN)', async () => {
    const db = createBackfillTestDb();
    seedBackfillCorpus(db);

    const res = await runPublicationDnaBackfill({ db, apply: true, confirm: false });
    assert.strictEqual(res.mode, 'DRY_RUN');
    assert.strictEqual(res.insertedCount, 0);

    const countRow = await db.prepare('SELECT COUNT(*) as cnt FROM article_dna_signatures').first();
    assert.strictEqual(countRow.cnt, 0);
  });

  // Test J: Dual confirmation enables local/mock insert
  await testAsync('J. Dual confirmation enables local/mock insert (APPLY mode)', async () => {
    const db = createBackfillTestDb();
    seedBackfillCorpus(db);

    const res = await runPublicationDnaBackfill({ db, apply: true, confirm: true });
    assert.strictEqual(res.mode, 'APPLY');
    assert.strictEqual(res.insertedCount, 5);
    assert.strictEqual(res.blockedCount, 0);

    const countRow = await db.prepare('SELECT COUNT(*) as cnt FROM article_dna_signatures').first();
    assert.strictEqual(countRow.cnt, 5);

    // Verify row for Article 6
    const row6 = await db.prepare("SELECT * FROM article_dna_signatures WHERE article_id = 6").first();
    assert.strictEqual(row6.provenance_class, 'PARTIAL_HISTORICAL_PROVENANCE');
    assert.strictEqual(row6.content_hash_contract, 'legacy-normalized-sha256-v0');
    assert.strictEqual(row6.source_fidelity, 'NORMALIZED_HASH_VERIFIED');
    assert.strictEqual(row6.publication_receipt_id, null);
    assert.strictEqual(row6.publication_execution_id, null);
    assert.strictEqual(row6.approved_content_hash, null);
    assert.strictEqual(row6.historical_published_at, '2026-09-13T23:05:51.804Z');

    // Verify row for Article 9
    const row9 = await db.prepare("SELECT * FROM article_dna_signatures WHERE article_id = 9").first();
    assert.strictEqual(row9.provenance_class, 'FULL_PROVENANCE');
    assert.strictEqual(row9.content_hash_contract, 'canonical-markdown-sha256-v1');
    assert.strictEqual(row9.source_fidelity, 'BYTE_EXACT_HASH_VERIFIED');
    assert.strictEqual(row9.publication_receipt_id, 'rcpt_artC_8341d2fda3bc');
  });

  // Test K: No UPDATE/DELETE SQL exists in backfill path
  test('K. No UPDATE or DELETE SQL exists in backfill utility path', () => {
    const backfillCode = fs.readFileSync(path.resolve(process.cwd(), 'scripts/backfill-publication-dna.js'), 'utf-8');
    const storeCode = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/content-protection/publication-dna-store.ts'), 'utf-8');

    // Remove comments
    const stripComments = (str) => str.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const cleanBackfill = stripComments(backfillCode);
    const cleanStore = stripComments(storeCode);

    assert(!/\bUPDATE\s+article_dna_signatures\b/i.test(cleanBackfill), 'Backfill script must NOT contain UPDATE SQL');
    assert(!/\bDELETE\s+FROM\s+article_dna_signatures\b/i.test(cleanBackfill), 'Backfill script must NOT contain DELETE SQL');
    assert(!/\bUPDATE\s+article_dna_signatures\b/i.test(cleanStore), 'DNA store must NOT contain UPDATE SQL');
    assert(!/\bDELETE\s+FROM\s+article_dna_signatures\b/i.test(cleanStore), 'DNA store must NOT contain DELETE SQL');
  });

  console.log('\n================================================================');
  console.log(`Results: ${passedCount} passed, ${failedCount} failed`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
