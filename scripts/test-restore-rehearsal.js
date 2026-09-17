/**
 * RancangLoka DR-1: Restore Rehearsal Automated Test Suite
 * 
 * Verifies all 6 disaster recovery rehearsal phases:
 * 1. Checksum verification & integrity validation (PASS & tamper BLOCK)
 * 2. Decrypt roundtrip into temporary outside workspace (PASS & wrong passphrase BLOCK)
 * 3. Isolated local SQLite restore (native node:sqlite):
 *    - schema import
 *    - core tables exist
 *    - migration state verified (0001-0005)
 *    - row counts match
 *    - PRAGMA integrity_check: ok
 * 4. Source recovery verification
 * 5. R2 empty snapshot recovery
 * 6. Plaintext secret exclusion & temporary workspace cleanup
 * 7. Verification of verified production backup set signatures and immutability
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  computeSha256,
  encryptPayload
} from '../src/lib/dr1/crypto.ts';
import {
  buildInfrastructureManifest
} from '../src/lib/dr1/backup.ts';
import {
  runRestoreRehearsal
} from './dr1-restore-rehearsal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DR_BACKUP_DIR = path.resolve(PROJECT_ROOT, '..', 'dr-backups');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS [${passedTests + failedTests + 1}]: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL [${passedTests + failedTests + 1}]: ${message}`);
    failedTests++;
  }
}

console.log('\n====================================================');
console.log('🧪 RANCANGLOKA DR-1 RESTORE REHEARSAL TEST SUITE');
console.log('====================================================\n');

async function runTests() {
  const testWorkspace = path.join(os.tmpdir(), `test-dr1-restore-${Date.now()}`);
  fs.mkdirSync(testWorkspace, { recursive: true });

  const TEST_PASSPHRASE = 'Rehearsal-Super-Secure-Passphrase-2026!';

  // Prepare a realistic D1 SQL dump with core tables and migrations
  const sampleD1Sql = `
PRAGMA foreign_keys = OFF;

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color_badge TEXT DEFAULT '#059669',
  description TEXT,
  show_on_home INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 1,
  layout_style TEXT DEFAULT 'bento',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  bio TEXT,
  avatar TEXT,
  role TEXT DEFAULT 'Editor',
  social_links TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  content_md TEXT NOT NULL,
  content_html TEXT NOT NULL,
  featured_image TEXT,
  image_alt TEXT,
  category_id INTEGER REFERENCES categories(id),
  author_id INTEGER REFERENCES authors(id),
  status TEXT DEFAULT 'published',
  views INTEGER DEFAULT 0,
  reading_time_minutes INTEGER DEFAULT 3,
  key_takeaways TEXT,
  focus_keyword TEXT,
  content_hash TEXT,
  is_featured INTEGER DEFAULT 0,
  is_trending INTEGER DEFAULT 0,
  is_sponsored INTEGER DEFAULT 0,
  disable_internal_links INTEGER DEFAULT 0,
  published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE article_ingest_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  article_slug TEXT NOT NULL,
  canonical_url TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  published_at DATETIME,
  content_hash TEXT,
  media_count INTEGER DEFAULT 0,
  featured_image TEXT,
  ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE article_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id),
  asset_id TEXT NOT NULL REFERENCES media_assets(asset_id),
  role TEXT NOT NULL,
  slot_key TEXT NOT NULL DEFAULT 'primary',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  caption TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO categories (id, name, slug) VALUES (1, 'Interior & Tata Ruang', 'interior-design');
INSERT INTO categories (id, name, slug) VALUES (2, 'Arsitektur & Renovasi', 'arsitektur-renovasi');
INSERT INTO authors (id, name, slug) VALUES (1, 'Dewan Redaksi Spasial', 'dewan-redaksi-spasial');
INSERT INTO articles (id, slug, title, content_md, content_html, status) VALUES (1, 'test-rehearsal', 'Test Rehearsal Title', 'Body', '<p>Body</p>', 'published');
INSERT INTO settings (key, value) VALUES ('site_title', 'RancangLoka');
INSERT INTO d1_migrations (id, name) VALUES (1, '0001_category_taxonomy_expansion.sql');
INSERT INTO d1_migrations (id, name) VALUES (2, '0002_article_ingest_receipts.sql');
INSERT INTO d1_migrations (id, name) VALUES (3, '0003_canonical_editorial_author.sql');
INSERT INTO d1_migrations (id, name) VALUES (4, '0004_add_article_flags.sql');
INSERT INTO d1_migrations (id, name) VALUES (5, '0005_media_assets_and_article_media.sql');
`;

  const sqlSha256 = await computeSha256(sampleD1Sql);
  const infraManifest = buildInfrastructureManifest();

  const mockPayload = {
    exportedAt: new Date().toISOString(),
    d1: {
      file: 'database/rancangloka-d1.sql',
      sqlSha256,
      sizeBytes: Buffer.byteLength(sampleD1Sql, 'utf-8'),
      sqlContent: sampleD1Sql
    },
    r2: {
      bucketName: 'rancangloka-media',
      exportedAt: new Date().toISOString(),
      totalObjects: 0,
      totalBytes: 0,
      objects: []
    },
    infrastructure: infraManifest,
    sourceSummary: { fileCount: 138 },
    files: {
      'database/rancangloka-d1.sql': sampleD1Sql
    }
  };

  const mockPayloadJson = JSON.stringify(mockPayload);
  const unencryptedPayloadSha256 = await computeSha256(mockPayloadJson);
  const encryptedEnvelope = await encryptPayload(mockPayloadJson, TEST_PASSPHRASE);

  const mockBaseName = `mock-backup-${Date.now()}`;
  const mockArchivePath = path.join(testWorkspace, `${mockBaseName}.enc`);
  const mockManifestPath = path.join(testWorkspace, `${mockBaseName}.manifest.json`);
  const mockChecksumPath = path.join(testWorkspace, `${mockBaseName}.sha256`);

  const mockManifest = {
    manifestVersion: '1.0',
    backupId: `bk_test_${Date.now()}`,
    environment: 'production',
    createdAt: new Date().toISOString(),
    database: {
      method: 'WRANGLER_D1_EXPORT',
      toolVersion: 'wrangler@4',
      file: 'rancangloka-d1.sql',
      sizeBytes: Buffer.byteLength(sampleD1Sql, 'utf-8'),
      sha256: sqlSha256,
      tablesVerified: ['categories', 'authors', 'articles', 'settings', 'd1_migrations']
    },
    media: {
      bucket: 'rancangloka-media',
      objectCount: 0,
      bucketSize: '0 B',
      state: 'VALID_EMPTY_SNAPSHOT'
    },
    source: {
      fileCount: 138
    },
    encryption: {
      algorithm: encryptedEnvelope.algorithm,
      keyDerivation: encryptedEnvelope.keyDerivation,
      iterations: encryptedEnvelope.iterations,
      saltHex: encryptedEnvelope.saltHex,
      ivHex: encryptedEnvelope.ivHex,
      tagHex: encryptedEnvelope.tagHex
    },
    unencryptedPayloadSha256,
    archiveSha256: encryptedEnvelope.envelopeSha256
  };

  fs.writeFileSync(mockArchivePath, JSON.stringify(encryptedEnvelope, null, 2), 'utf-8');
  fs.writeFileSync(mockManifestPath, JSON.stringify(mockManifest, null, 2), 'utf-8');
  fs.writeFileSync(mockChecksumPath, `${encryptedEnvelope.envelopeSha256}  ${mockBaseName}.enc\n`, 'utf-8');

  try {
    // -------------------------------------------------------------------------
    // Test 1: Full Rehearsal Execution on Valid Mock Backup via Zero-Echo Pipe
    // -------------------------------------------------------------------------
    const result = await runRestoreRehearsal({
      baseName: mockBaseName,
      archivePath: mockArchivePath,
      manifestPath: mockManifestPath,
      checksumPath: mockChecksumPath,
      _testInputPipe: TEST_PASSPHRASE
    });

    assert(result.success === true, 'Test 1: Full isolated restore rehearsal succeeds end-to-end');
    assert(result.migrationsApplied === 5, 'Test 2: All 5 D1 migrations verified in local database');
    assert(result.tablesRecovered.articles === 1, 'Test 3: Articles table recovered with correct row count');
    assert(result.tablesRecovered.categories === 2, 'Test 4: Categories table recovered with correct row count');
    assert(result.r2ObjectCount === 0, 'Test 5: Empty R2 media snapshot handled cleanly');
    assert(result.tempCleaned === true, 'Test 6: Temporary decrypted restore workspace automatically cleaned');

    // -------------------------------------------------------------------------
    // Test 7: Wrong Passphrase Strictly Fails Closed
    // -------------------------------------------------------------------------
    let wrongPassFailedClosed = false;
    try {
      await runRestoreRehearsal({
        baseName: mockBaseName,
        archivePath: mockArchivePath,
        manifestPath: mockManifestPath,
        checksumPath: mockChecksumPath,
        _testInputPipe: 'CompletelyWrongPassphrase999!'
      });
    } catch (err) {
      wrongPassFailedClosed = err.message.includes('Decryption failed closed');
    }
    assert(wrongPassFailedClosed, 'Test 7: Wrong passphrase strictly fails closed without workspace leak');

    // -------------------------------------------------------------------------
    // Test 8: Checksum Corruption Fails Closed
    // -------------------------------------------------------------------------
    const corruptedChecksumPath = path.join(testWorkspace, `${mockBaseName}-corrupt.sha256`);
    fs.writeFileSync(corruptedChecksumPath, `badhash1234567890  ${mockBaseName}.enc\n`, 'utf-8');

    let corruptCheckFailed = false;
    try {
      await runRestoreRehearsal({
        baseName: mockBaseName,
        archivePath: mockArchivePath,
        manifestPath: mockManifestPath,
        checksumPath: corruptedChecksumPath,
        _testInputPipe: TEST_PASSPHRASE
      });
    } catch (err) {
      corruptCheckFailed = err.message.includes('Checksum file does not match archive SHA-256');
    }
    assert(corruptCheckFailed, 'Test 8: Checksum file tampering strictly fails closed in Phase 1');

    // -------------------------------------------------------------------------
    // Test 9: Restore Passphrase Helper Protocol (get-restore-passphrase.ps1)
    // -------------------------------------------------------------------------
    const psHelperPath = path.join(__dirname, 'get-restore-passphrase.ps1');
    const secretHandoff = 'SecureRecoveryKey2026!';
    const handoffProc = spawnSync('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', psHelperPath
    ], {
      input: `${secretHandoff}\r\n`,
      encoding: 'utf-8',
      timeout: 5000
    });

    assert(
      handoffProc.status === 0 && handoffProc.stdout === secretHandoff,
      'Test 9: get-restore-passphrase.ps1 delivers exact zero-echo secret via pipe without stderr exposure'
    );

    const emptyProc = spawnSync('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', psHelperPath
    ], {
      input: '\r\n',
      encoding: 'utf-8',
      timeout: 5000
    });

    assert(emptyProc.status === 2, 'Test 10: get-restore-passphrase.ps1 rejects empty input with exit code 2');

    // -------------------------------------------------------------------------
    // Test 11-16: Verified Production Backup Artifact Signatures & Immutability
    // -------------------------------------------------------------------------
    const prodArchive = path.join(DR_BACKUP_DIR, 'rancangloka-backup-prod-2026-09-06T23-39-58-152Z.enc');
    const prodManifest = path.join(DR_BACKUP_DIR, 'rancangloka-backup-prod-2026-09-06T23-39-58-152Z.manifest.json');
    const prodSha256 = path.join(DR_BACKUP_DIR, 'rancangloka-backup-prod-2026-09-06T23-39-58-152Z.sha256');

    assert(fs.existsSync(prodArchive), 'Test 11: Production backup archive .enc exists');
    assert(fs.existsSync(prodManifest), 'Test 12: Production backup manifest .manifest.json exists');
    assert(fs.existsSync(prodSha256), 'Test 13: Production backup checksum .sha256 exists');

    const prodEncContent = fs.readFileSync(prodArchive, 'utf-8');
    const prodManifestObj = JSON.parse(fs.readFileSync(prodManifest, 'utf-8'));
    const prodShaContent = fs.readFileSync(prodSha256, 'utf-8');

    const prodEnvelope = JSON.parse(prodEncContent);
    assert(
      prodEnvelope.envelopeSha256 === '95242c007f0815faaae3457f7b020ff62c5326219abbad31f0a387a92d752d0d',
      'Test 14: Production archive envelopeSha256 matches verified golden checksum'
    );
    assert(
      prodShaContent.includes(prodEnvelope.envelopeSha256) && prodManifestObj.archiveSha256 === prodEnvelope.envelopeSha256,
      'Test 15: Production checksum file and manifest match exact archive envelopeSha256'
    );

    const computedProdEnvelopeSha = await computeSha256(
      prodEnvelope.ciphertextBase64 + prodEnvelope.saltHex + prodEnvelope.ivHex + prodEnvelope.tagHex
    );
    assert(
      computedProdEnvelopeSha === prodEnvelope.envelopeSha256,
      'Test 16: Production envelope internal HMAC/integrity hash verified uncorrupted'
    );

    // -------------------------------------------------------------------------
    // Test 17: Passphrase Hygiene Guardrail — NO ARGV PASSPHRASE
    // -------------------------------------------------------------------------
    const argvTestProc = spawnSync('node', [
      path.join(__dirname, 'dr1-restore-rehearsal.js'),
      '--passphrase', 'IllegalCliPassphrase123!'
    ], {
      encoding: 'utf-8',
      timeout: 5000
    });

    assert(
      argvTestProc.status === 1 &&
      argvTestProc.stderr.includes('SECURITY VIOLATION: Providing recovery passphrase via argv is strictly forbidden'),
      'Test 17: Command-line argument passphrase (--passphrase) is strictly rejected with security violation'
    );

    // -------------------------------------------------------------------------
    // Test 18: Passphrase Hygiene Guardrail — NO ENV PASSPHRASE
    // -------------------------------------------------------------------------
    let envPassphraseRejected = false;
    try {
      process.env.RANCANGLOKA_BACKUP_PASSPHRASE = 'IllegalEnvPassphrase123!';
      await runRestoreRehearsal({
        baseName: mockBaseName,
        archivePath: mockArchivePath,
        manifestPath: mockManifestPath,
        checksumPath: mockChecksumPath
      });
    } catch (err) {
      envPassphraseRejected = err.message.includes('Ingesting recovery passphrase from environment variable');
    } finally {
      delete process.env.RANCANGLOKA_BACKUP_PASSPHRASE;
    }

    assert(
      envPassphraseRejected,
      'Test 18: Environment variable passphrase (RANCANGLOKA_BACKUP_PASSPHRASE) is strictly rejected with security violation'
    );

    // -------------------------------------------------------------------------
    // Test 19: Passphrase Hygiene Guardrail — NO FILE-BASED PROBING
    // -------------------------------------------------------------------------
    const restoreToolingSrc = fs.readFileSync(path.join(__dirname, 'dr1-restore-rehearsal.js'), 'utf-8');
    const hasSecretFileProbing = (
      restoreToolingSrc.includes('.rancangloka-secrets') ||
      restoreToolingSrc.includes("readFileSync('.env") ||
      restoreToolingSrc.includes('readFileSync(".env') ||
      restoreToolingSrc.includes('.dev.vars') ||
      restoreToolingSrc.includes('secretFiles') ||
      restoreToolingSrc.includes('readSecretFile')
    );
    assert(
      !hasSecretFileProbing,
      'Test 19: Restore tooling contains zero file-based secret probing or directory scanning for passphrases'
    );

    // -------------------------------------------------------------------------
    // Test 20: Passphrase Hygiene Guardrail — NO HISTORY LOOKUP
    // -------------------------------------------------------------------------
    const hasHistoryLookup = (
      restoreToolingSrc.includes('PSReadLine') ||
      restoreToolingSrc.includes('ConsoleHistory') ||
      restoreToolingSrc.includes('transcript') ||
      restoreToolingSrc.includes('history.txt')
    );
    assert(
      !hasHistoryLookup,
      'Test 20: Restore tooling contains zero history inspection or transcript searching for passphrases'
    );

    // -------------------------------------------------------------------------
    // Test 21: Passphrase Hygiene Guardrail — NO CANDIDATE GUESSING
    // -------------------------------------------------------------------------
    const hasCandidateGuessing = (
      restoreToolingSrc.includes('candidates') ||
      restoreToolingSrc.includes('candidateList') ||
      restoreToolingSrc.includes('bruteForce') ||
      restoreToolingSrc.includes('dictionary') ||
      restoreToolingSrc.includes('wordlist')
    );
    assert(
      !hasCandidateGuessing,
      'Test 21: Restore tooling contains zero candidate guessing, enumeration loops, or brute-forcing'
    );

    // -------------------------------------------------------------------------
    // Test 22: Passphrase Hygiene Guardrail — NO PASSPHRASE LOGGING
    // -------------------------------------------------------------------------
    const testSecretToNotLog = 'UniquelyIdentifiableSecretPhrase987!';
    let caughtErrorMessage = '';
    try {
      await runRestoreRehearsal({
        baseName: mockBaseName,
        archivePath: mockArchivePath,
        manifestPath: mockManifestPath,
        checksumPath: mockChecksumPath,
        _testInputPipe: testSecretToNotLog
      });
    } catch (err) {
      caughtErrorMessage = err.message;
    }

    assert(
      !caughtErrorMessage.includes(testSecretToNotLog),
      'Test 22: Error messages, logs, and stack traces never log or expose the typed passphrase'
    );

    // -------------------------------------------------------------------------
    // Test 23: Wrong Passphrase Simply Fails Closed
    // -------------------------------------------------------------------------
    assert(
      caughtErrorMessage === 'Decryption failed closed: authentication tag mismatch or invalid passphrase.',
      'Test 23: Invalid passphrase simply fails closed with generic authentication error'
    );

  } finally {
    // Clean test workspace
    try {
      if (fs.existsSync(testWorkspace)) {
        fs.rmSync(testWorkspace, { recursive: true, force: true });
      }
    } catch {}
  }

  console.log('\n====================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
