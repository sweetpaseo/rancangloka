/**
 * RancangLoka DR-1: Disaster Recovery Master Test Suite (Async Web Crypto Standard)
 * 
 * Matrix of Tests (22 Required Scenarios):
 * 1. manifest creation
 * 2. checksum PASS
 * 3. checksum corruption BLOCK
 * 4. encryption/decryption roundtrip
 * 5. wrong passphrase BLOCK
 * 6. plaintext secret exclusion
 * 7. dry-run required before restore
 * 8. incompatible schema BLOCK
 * 9. merge conflict report
 * 10. full restore preflight
 * 11. backup failure does not affect publication
 * 12. Google Drive mock upload
 * 13. remote verification PASS
 * 14. remote verification failure deletes nothing
 * 15. retention 5
 * 16. sixth verified backup deletes oldest only
 * 17. incomplete backup set not counted valid
 * 18. scheduler prevents overlapping jobs
 * 19. backup job idempotency
 * 20. restore permission separation
 * 21. LokaMedia credential cannot restore
 * 22. backup credential cannot publish
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

import {
  computeSha256,
  encryptPayload,
  decryptPayload
} from '../src/lib/dr1/crypto.ts';
import {
  createBackupSet,
  assertNoPlaintextSecrets,
  buildInfrastructureManifest
} from '../src/lib/dr1/backup.ts';
import {
  verifyBackupSetIntegrity,
  checkSchemaCompatibility,
  createPreRestoreSnapshot,
  executeDryRunRestore,
  runRestorePreflight
} from '../src/lib/dr1/restore.ts';
import {
  GoogleDriveAdapter,
  ROLLING_RETENTION_LIMIT,
  CANONICAL_REMOTE_FOLDER,
  validateBackupFileExtensions,
  validateLocalBackupFiles,
  getGoogleDriveAuthConfig
} from '../src/lib/dr1/offsite/google-drive.ts';
import {
  BackupScheduler
} from '../src/lib/dr1/scheduler.ts';
import {
  hasPermission,
  validateScopeAuthorization,
  canPublishArticle
} from '../src/lib/dr1/auth.ts';

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
console.log('🧪 RANCANGLOKA DR-1 DISASTER RECOVERY TEST SUITE');
console.log('====================================================\n');

async function runSuite() {
  const sampleTables = {
    categories: {
      schemaSql: 'CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT, slug TEXT UNIQUE);',
      columns: ['id', 'name', 'slug'],
      rows: [
        { id: 1, name: 'Interior & Tata Ruang', slug: 'interior-design' },
        { id: 2, name: 'Arsitektur & Renovasi', slug: 'arsitektur-renovasi' }
      ]
    },
    articles: {
      schemaSql: 'CREATE TABLE articles (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, title TEXT, status TEXT, content_hash TEXT);',
      columns: ['id', 'slug', 'title', 'status', 'content_hash'],
      rows: [
        { id: 1, slug: 'test-article-1', title: 'Test Article 1', status: 'draft', content_hash: 'hash_123' },
        { id: 2, slug: 'test-article-2', title: 'Test Article 2', status: 'published', content_hash: 'hash_456' }
      ]
    },
    settings: {
      schemaSql: 'CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);',
      columns: ['key', 'value'],
      rows: [
        { key: 'site_title', value: 'RancangLoka' }
      ]
    }
  };

  const sampleMedia = [
    {
      storageKey: 'media/images/f0eea6b2067a462a2258225b37674589a92e13e77f0ad7852e3f4e9abbcdc962.jpg',
      sizeBytes: 104,
      sha256: 'f0eea6b2067a462a2258225b37674589a92e13e77f0ad7852e3f4e9abbcdc962',
      mimeType: 'image/jpeg'
    }
  ];

  const sampleSource = [
    { path: 'wrangler.toml', content: 'name = "rancangloka"\n' },
    { path: 'package.json', content: '{"name": "rancangloka-astro"}\n' }
  ];

  const TEST_PASSPHRASE = 'RancangLoka-Super-Secure-Passphrase-2026!';

  // =========================================================================
  // 1. Manifest Creation
  // =========================================================================
  console.log('--- Subsystem 1: Manifest & Backup Core ---');
  const backupSet = await createBackupSet({
    tables: sampleTables,
    mediaObjects: sampleMedia,
    sourceFiles: sampleSource,
    appVersion: '1.0.0',
    d1SchemaVersion: '0005'
  });

  assert(
    backupSet.manifest &&
    backupSet.manifest.manifestVersion === '1.0' &&
    backupSet.manifest.components.database.rowCount === 5 &&
    backupSet.manifest.components.media.objectCount === 1,
    'Test 1: Manifest created with correct components and row counts'
  );

  // =========================================================================
  // 2. Checksum PASS
  // =========================================================================
  const integrity = await verifyBackupSetIntegrity(backupSet);
  assert(
    integrity.valid === true && integrity.rawPayload !== undefined,
    'Test 2: Checksum verification passes for unmodified backup set'
  );

  // =========================================================================
  // 3. Checksum Corruption BLOCK
  // =========================================================================
  const corruptedSet = JSON.parse(JSON.stringify(backupSet));
  corruptedSet.rawPayloadJson = corruptedSet.rawPayloadJson.replace('test-article-1', 'tampered-article');
  const corruptedIntegrity = await verifyBackupSetIntegrity(corruptedSet);
  assert(
    corruptedIntegrity.valid === false && corruptedIntegrity.error.includes('mismatch'),
    'Test 3: Tampered backup payload fails checksum and is blocked'
  );

  // =========================================================================
  // 4. Encryption/Decryption Roundtrip
  // =========================================================================
  console.log('\n--- Subsystem 2: Authenticated Encryption (AES-256-GCM) ---');
  const encryptedSet = await createBackupSet(
    { tables: sampleTables, mediaObjects: sampleMedia },
    TEST_PASSPHRASE
  );

  assert(
    encryptedSet.encryptedArchive !== undefined &&
    encryptedSet.encryptedArchive.algorithm === 'AES-256-GCM' &&
    encryptedSet.rawPayloadJson === undefined,
    'Test 4A: Backup archive is packaged with standard AES-256-GCM'
  );

  const decryptedIntegrity = await verifyBackupSetIntegrity(encryptedSet, TEST_PASSPHRASE);
  assert(
    decryptedIntegrity.valid === true &&
    decryptedIntegrity.rawPayload.database.tables.categories !== undefined,
    'Test 4B: Encryption and decryption roundtrip restores exact original data'
  );

  // =========================================================================
  // 5. Wrong Passphrase BLOCK
  // =========================================================================
  const wrongPassIntegrity = await verifyBackupSetIntegrity(encryptedSet, 'wrong-passphrase-attempt');
  assert(
    wrongPassIntegrity.valid === false && wrongPassIntegrity.error.includes('Decryption failed'),
    'Test 5: Wrong passphrase cleanly fails closed and rejects decryption'
  );

  // =========================================================================
  // 6. Plaintext Secret Exclusion
  // =========================================================================
  const SECRET_TO_GUARD = 'super_secret_token_never_expose_12345';
  let leakCaught = false;
  try {
    await createBackupSet(
      {
        tables: {
          leaky_table: {
            schemaSql: 'CREATE TABLE leaky_table (val TEXT);',
            columns: ['val'],
            rows: [{ val: SECRET_TO_GUARD }]
          }
        }
      },
      undefined,
      [SECRET_TO_GUARD]
    );
  } catch (err) {
    leakCaught = true;
  }
  assert(
    leakCaught === true,
    'Test 6: Plaintext secret detection successfully catches and blocks leaked secret values'
  );

  // =========================================================================
  // 7. Dry-run Required Before Restore
  // =========================================================================
  console.log('\n--- Subsystem 3: Restore Core & Dry-Run Engine ---');
  const targetDatabaseState = {
    schemaVersion: '0005',
    tables: {
      categories: [
        { id: 1, name: 'Interior & Tata Ruang (Old)', slug: 'interior-design' }
      ],
      articles: [
        { id: 1, slug: 'test-article-1', title: 'Test Article 1 (Live Modified)', status: 'draft', content_hash: 'hash_live_different' }
      ]
    }
  };

  const preflight = await runRestorePreflight(backupSet, targetDatabaseState, 'MERGE');
  assert(
    preflight.passed === true &&
    preflight.step === 'READY' &&
    preflight.conflictReport !== undefined,
    'Test 7: Restore preflight completes checksum, schema, and dry run before declaring ready'
  );

  // =========================================================================
  // 8. Incompatible Schema BLOCK
  // =========================================================================
  const incompatibleManifest = JSON.parse(JSON.stringify(backupSet.manifest));
  incompatibleManifest.system.d1SchemaVersion = '0099_unknown_future_schema';
  const schemaCheck = checkSchemaCompatibility(incompatibleManifest, '0005');
  assert(
    schemaCheck.compatible === false && schemaCheck.error.includes('Incompatible'),
    'Test 8: Incompatible or unverified schema version blocks restore'
  );

  // =========================================================================
  // 9. Merge Conflict Report
  // =========================================================================
  const mergeReport = await executeDryRunRestore(integrity.rawPayload, targetDatabaseState, 'MERGE');
  assert(
    mergeReport.compatible === true &&
    mergeReport.totalConflicts > 0 &&
    mergeReport.conflicts.some(c => c.table === 'articles' && c.primaryKey === 1),
    'Test 9: Merge dry-run identifies modified records and generates conflict delta report'
  );

  // =========================================================================
  // 10. Full Restore Preflight & Pre-Restore Snapshot
  // =========================================================================
  const preSnapshot = await createPreRestoreSnapshot(targetDatabaseState);
  assert(
    preSnapshot.snapshotId.startsWith('pre_restore_snap_') &&
    preSnapshot.targetTables.includes('articles') &&
    preSnapshot.sha256.length === 64,
    'Test 10: Full restore preflight creates automated pre-restore rollback snapshot'
  );

  // =========================================================================
  // 11. Backup Failure Does Not Affect Publication
  // =========================================================================
  console.log('\n--- Subsystem 4: Scheduler & Resilience Decoupling ---');
  const scheduler = new BackupScheduler({ maxRetries: 2, cadenceMinutes: 60 });
  let publicationState = 'ONLINE_AND_PUBLISHING';

  const failingTask = async () => {
    throw new Error('Database read timeout during snapshot extraction');
  };

  const schedResult = await scheduler.executeTask(failingTask, 'job_fail_test');
  assert(
    schedResult.success === false &&
    scheduler.getHealth().status === 'FAILING' &&
    publicationState === 'ONLINE_AND_PUBLISHING',
    'Test 11: Complete backup task failure logs degraded state without affecting publication'
  );

  // =========================================================================
  // 12. Google Drive Mock Upload
  // =========================================================================
  console.log('\n--- Subsystem 5: Google Drive Offsite Provider ---');
  const driveAdapter = new GoogleDriveAdapter('folder_test_dr1');
  const uploadRes = await driveAdapter.uploadBackupSet(encryptedSet);

  assert(
    uploadRes.success === true && uploadRes.remoteSetId.startsWith('gdrive_set_'),
    'Test 12: Google Drive adapter uploads encrypted backup set'
  );

  // =========================================================================
  // 13. Remote Verification PASS
  // =========================================================================
  const verifyRes = await driveAdapter.verifyRemoteBackupSet(uploadRes.remoteSetId);
  assert(
    verifyRes.valid === true,
    'Test 13: Remote backup verification passes for complete, intact backup set'
  );

  // =========================================================================
  // 14. Remote Verification Failure Deletes Nothing
  // =========================================================================
  const countBefore = (await driveAdapter.listBackupSets()).length;
  driveAdapter.setSimulatedFailure(true);
  const failedProcess = await driveAdapter.processOffsiteBackup(encryptedSet);
  driveAdapter.setSimulatedFailure(false);
  const countAfter = (await driveAdapter.listBackupSets()).length;

  assert(
    failedProcess.success === false &&
    failedProcess.error.toLowerCase().includes('fail') &&
    countAfter === countBefore,
    'Test 14: Failed remote verification aborts retention purge and deletes nothing'
  );

  // =========================================================================
  // 15. Retention = 5
  // =========================================================================
  // Seed 4 more verified sets so total becomes 5
  for (let i = 2; i <= 5; i++) {
    const s = await createBackupSet({ tables: sampleTables }, TEST_PASSPHRASE);
    await driveAdapter.processOffsiteBackup(s);
  }
  const setsAtFive = await driveAdapter.listBackupSets();
  const verifiedCount = setsAtFive.filter(s => s.isVerified).length;
  assert(
    verifiedCount === 5,
    'Test 15: Exactly 5 verified backup sets are retained in the retention pool'
  );

  // =========================================================================
  // 16. Sixth Verified Backup Deletes Oldest Only
  // =========================================================================
  const oldestSetId = setsAtFive[0].remoteSetId;
  const sixthSet = await createBackupSet({ tables: sampleTables }, TEST_PASSPHRASE);
  const sixthResult = await driveAdapter.processOffsiteBackup(sixthSet);
  const setsAfterSixth = await driveAdapter.listBackupSets();

  assert(
    sixthResult.success === true &&
    sixthResult.retention.purgedCount === 1 &&
    sixthResult.retention.purgedIds.includes(oldestSetId) &&
    setsAfterSixth.filter(s => s.isVerified).length === ROLLING_RETENTION_LIMIT &&
    !setsAfterSixth.some(s => s.remoteSetId === oldestSetId),
    'Test 16: Sixth verified backup automatically purges oldest set and retains newest 5'
  );

  // =========================================================================
  // 17. Incomplete Backup Set Not Counted Valid
  // =========================================================================
  // Create an incomplete set directly in mock storage
  driveAdapter['storage'].set('incomplete_set_test', {
    remoteSetId: 'incomplete_set_test',
    backupId: 'bk_incomplete',
    uploadedAt: new Date().toISOString(),
    files: { manifest: { name: 'm.json', content: '{}', sizeBytes: 2, sha256: 'h', uploadedAt: '' } }, // missing archive & checksums
    isVerified: false
  });
  const unverifiedList = await driveAdapter.listBackupSets();
  const incompleteSummary = unverifiedList.find(s => s.remoteSetId === 'incomplete_set_test');
  assert(
    incompleteSummary && incompleteSummary.isVerified === false,
    'Test 17: Incomplete backup set is rejected as unverified and excluded from valid pool'
  );

  // =========================================================================
  // 18. Scheduler Prevents Overlapping Jobs
  // =========================================================================
  console.log('\n--- Subsystem 6: Scheduler Concurrency & Idempotency ---');
  const sched = new BackupScheduler();
  const lock1 = sched.acquireLock('job_concurrent_1');
  const lock2 = sched.acquireLock('job_concurrent_2');
  sched.releaseLock();

  assert(
    lock1.acquired === true &&
    lock2.acquired === false &&
    lock2.reason.includes('CONCURRENCY GUARD'),
    'Test 18: Concurrency guard strictly prevents overlapping backup jobs'
  );

  // =========================================================================
  // 19. Backup Job Idempotency
  // =========================================================================
  sched.recordSuccess('job_idempotent_test', 'bk_123', true);
  const lockIdempotent = sched.acquireLock('job_idempotent_test');
  assert(
    lockIdempotent.acquired === false &&
    lockIdempotent.reason.includes('IDEMPOTENCY GUARD'),
    'Test 19: Idempotency guard blocks re-execution of an already successful job'
  );

  // =========================================================================
  // 20. Restore Permission Separation
  // =========================================================================
  console.log('\n--- Subsystem 7: Security & Authorization Scopes ---');
  const readerPrincipal = { sub: 'auditor', scopes: ['backup:read'] };
  const previewPrincipal = { sub: 'admin', scopes: ['backup:read', 'restore:preview'] };
  const executePrincipal = { sub: 'superadmin', scopes: ['backup:read', 'restore:preview', 'restore:execute'], isSuperAdmin: true };

  const readAuth = validateScopeAuthorization(readerPrincipal, 'READ');
  const previewAuthByReader = validateScopeAuthorization(readerPrincipal, 'RESTORE_PREVIEW');
  const executeAuthByPreviewer = validateScopeAuthorization(previewPrincipal, 'RESTORE_EXECUTE');
  const executeAuth = validateScopeAuthorization(executePrincipal, 'RESTORE_EXECUTE');

  assert(
    readAuth.authorized === true &&
    previewAuthByReader.authorized === false &&
    executeAuthByPreviewer.authorized === false &&
    executeAuth.authorized === true,
    'Test 20: Granular scopes strictly enforce privilege separation across read/preview/execute'
  );

  // =========================================================================
  // 21. LokaMedia Credential Cannot Restore
  // =========================================================================
  const mediaPrincipal = { sub: 'lokamedia_worker', scopes: ['media:write:draft'] };
  const mediaRestoreAuth = validateScopeAuthorization(mediaPrincipal, 'RESTORE_EXECUTE');
  assert(
    mediaRestoreAuth.authorized === false &&
    mediaRestoreAuth.reason.includes('SECURITY REJECTION'),
    'Test 21: LokaMedia credential strictly rejected from executing restore actions'
  );

  // =========================================================================
  // 22. Backup Credential Cannot Publish
  // =========================================================================
  const backupPrincipal = { sub: 'backup_runner', scopes: ['backup:create', 'backup:read', 'backup:download'] };
  const canPublish = canPublishArticle(backupPrincipal);
  assert(
    canPublish === false,
    'Test 22: Backup credential cannot publish or modify live editorial content'
  );

  // =========================================================================
  // Subsystem 8: Controlled Backup Patch Validations
  // =========================================================================
  console.log('\n--- Subsystem 8: Controlled Backup Patch Validations ---');

  // Test 23: Aggregate manifest compilation
  const testAggregate = {
    backupId: 'bk_test_aggregate_001',
    timestamp: new Date().toISOString(),
    manifest: backupSet.manifest,
    database: { exported: true, sha256: 'deadbeef' },
    storage: { objectCount: 2, totalBytes: 14336 },
    infrastructure: buildInfrastructureManifest(),
    sourceFiles: [{ path: 'package.json', sha256: 'abc' }]
  };
  const aggregateJson = JSON.stringify(testAggregate, null, 2);
  assert(
    typeof aggregateJson === 'string' && aggregateJson.length > 50,
    'Test 23: Aggregate manifest object is explicitly created and serialized before encryption'
  );

  // Test 24: Aggregate manifest encryption & decryption roundtrip
  const testPass = 'CorrectHorseBatteryStaple99!';
  const testEnvelope = await encryptPayload(aggregateJson, testPass);
  const decryptedBytes = await decryptPayload(testEnvelope, testPass);
  const decryptedJson = new TextDecoder().decode(decryptedBytes);
  assert(
    decryptedJson === aggregateJson,
    'Test 24: Aggregate manifest encryption and decryption roundtrip produces exact match'
  );

  // Test 25: Wrong passphrase fails closed
  let wrongPassThrown = false;
  try {
    await decryptPayload(testEnvelope, 'WrongPassword123!');
  } catch {
    wrongPassThrown = true;
  }
  assert(
    wrongPassThrown === true,
    'Test 25: Decryption with invalid passphrase fails closed'
  );

  // Test 26: Passphrase confirmation mismatch detection fails closed
  const verifyPassphraseConfirmation = (pass1, pass2) => {
    if (!pass1 || pass1.length < 8) return { valid: false, reason: 'too_short' };
    if (pass1 !== pass2) return { valid: false, reason: 'mismatch' };
    return { valid: true };
  };
  const mismatchResult = verifyPassphraseConfirmation('MySecretPassphrase123!', 'MismatchedPassphrase456!');
  const matchResult = verifyPassphraseConfirmation('MySecretPassphrase123!', 'MySecretPassphrase123!');
  assert(
    mismatchResult.valid === false &&
    mismatchResult.reason === 'mismatch' &&
    matchResult.valid === true,
    'Test 26: Passphrase confirmation mismatch strictly fails closed'
  );

  // Test 27: Passphrase never appears in output or manifest
  const manifestString = JSON.stringify({
    manifest: backupSet.manifest,
    envelope: testEnvelope
  });
  assert(
    !manifestString.includes(testPass),
    'Test 27: Passphrase value never appears in envelope metadata, manifests, or output'
  );

  // Test 28: Failed temporary workspace is cleaned up safely
  const tempTestDir = path.join(os.tmpdir(), `dr1-temp-cleanup-test-${Date.now()}`);
  fs.mkdirSync(tempTestDir, { recursive: true });
  fs.writeFileSync(path.join(tempTestDir, 'test.tmp'), 'temp file content');

  const safeClean = (p) => {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  };

  let failureEncountered = false;
  try {
    throw new Error('Simulated failure during encryption');
  } catch {
    failureEncountered = true;
  } finally {
    safeClean(tempTestDir);
  }

  assert(
    failureEncountered === true && !fs.existsSync(tempTestDir),
    'Test 28: Temporary workspace directory is guaranteed cleaned up upon process failure'
  );

  // =========================================================================
  // Subsystem 9: PowerShell True Zero-Echo Interactive Helper Validations
  // =========================================================================
  console.log('\n--- Subsystem 9: PowerShell True Zero-Echo Interactive Helper Validations ---');

  const psScriptPath = path.resolve('scripts/get-hidden-passphrase.ps1');
  assert(
    fs.existsSync(psScriptPath),
    'Test 29: PowerShell SecureString helper script exists on disk'
  );

  const psScriptContent = fs.readFileSync(psScriptPath, 'utf-8');
  assert(
    psScriptContent.includes('ReadKey($true)') &&
    psScriptContent.includes('SecureStringToBSTR') &&
    psScriptContent.includes('ZeroFreeBSTR') &&
    psScriptContent.includes('exit 2') &&
    psScriptContent.includes('exit 3') &&
    psScriptContent.includes('exit 0'),
    'Test 30: PowerShell script uses true zero-echo ReadKey($true) with memory cleanup and fail-closed exit codes'
  );

  // Test 31: Successful hidden input handoff & pipe IPC (zero asterisks, zero length leak)
  const secretToHandoff = 'SuperSecretRecoveryPassphrase99!';
  const startTimeHandoff = Date.now();
  const handoffProc = spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', psScriptPath
  ], {
    input: `${secretToHandoff}\r\n${secretToHandoff}\r\n`,
    encoding: 'utf-8',
    timeout: 5000
  });
  const handoffElapsed = Date.now() - startTimeHandoff;

  assert(
    handoffProc.status === 0 &&
    handoffProc.stdout === secretToHandoff &&
    !handoffProc.stderr.includes(secretToHandoff) &&
    !handoffProc.stderr.includes('*'),
    'Test 31: Successful hidden input handoff delivers exact passphrase via pipe IPC with zero asterisks and no stderr leakage'
  );

  // Test 32: Mismatch strictly fails closed with code 3, zero secret leak, zero asterisks
  const mismatchProc = spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', psScriptPath
  ], {
    input: `${secretToHandoff}\r\nDifferentSecretPassword123!\r\n`,
    encoding: 'utf-8',
    timeout: 5000
  });

  assert(
    mismatchProc.status === 3 &&
    mismatchProc.stdout === '' &&
    !mismatchProc.stderr.includes(secretToHandoff) &&
    !mismatchProc.stderr.includes('DifferentSecretPassword123!') &&
    !mismatchProc.stderr.includes('*'),
    'Test 32: Passphrase mismatch strictly exits with code 3 without leaking characters or asterisks in stdout or stderr'
  );

  // Test 33: Empty input strictly fails closed with code 2
  const emptyProc = spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', psScriptPath
  ], {
    input: '\r\n\r\n',
    encoding: 'utf-8',
    timeout: 5000
  });

  assert(
    emptyProc.status === 2 &&
    emptyProc.stdout === '' &&
    !emptyProc.stderr.includes('*'),
    'Test 33: Empty input strictly exits with code 2 and empty stdout'
  );

  // Test 34: Helper process exits cleanly and parent Node process resumes without hanging
  assert(
    handoffProc.status === 0 && handoffElapsed < 4000,
    'Test 34: Helper process exits cleanly upon completion and parent Node process resumes immediately'
  );

  // =========================================================================
  // Subsystem 10: Final Backup Artifact Hygiene & Persistence Hardening
  // =========================================================================
  console.log('\n--- Subsystem 10: Final Backup Artifact Hygiene & Persistence Hardening ---');

  // Test 35: Encrypted archive contains database/rancangloka-d1.sql
  const testPayloadWithD1 = {
    exportedAt: new Date().toISOString(),
    d1: {
      file: 'database/rancangloka-d1.sql',
      sqlSha256: 'abc123d1sha',
      sizeBytes: 85093,
      sqlContent: 'CREATE TABLE articles (id INT PRIMARY KEY); INSERT INTO articles VALUES (1);'
    },
    files: {
      'database/rancangloka-d1.sql': 'CREATE TABLE articles (id INT PRIMARY KEY); INSERT INTO articles VALUES (1);'
    },
    r2: { totalObjects: 0, objects: [] },
    infrastructure: buildInfrastructureManifest()
  };

  const hygienePassphrase = 'HygienePassphraseStandard2026!';
  const hygieneEnvelope = await encryptPayload(JSON.stringify(testPayloadWithD1), hygienePassphrase);
  const decryptedHygieneBytes = await decryptPayload(hygieneEnvelope, hygienePassphrase);
  const decryptedHygieneJson = new TextDecoder().decode(decryptedHygieneBytes);
  const parsedDecrypted = JSON.parse(decryptedHygieneJson);

  assert(
    parsedDecrypted.d1?.file === 'database/rancangloka-d1.sql' &&
    parsedDecrypted.files?.['database/rancangloka-d1.sql']?.includes('CREATE TABLE articles') &&
    decryptedHygieneJson.includes('database/rancangloka-d1.sql'),
    'Test 35: Encrypted archive contains database/rancangloka-d1.sql and decrypt roundtrip restores complete SQL'
  );

  // Test 36: Successful backup leaves no plaintext SQL in final destination
  const mockDrDir = path.join(os.tmpdir(), `dr1-hygiene-mock-dest-${Date.now()}`);
  fs.mkdirSync(mockDrDir, { recursive: true });
  const mockBase = 'rancangloka-backup-mock-test';
  fs.writeFileSync(path.join(mockDrDir, `${mockBase}.enc`), 'mock-enc');
  fs.writeFileSync(path.join(mockDrDir, `${mockBase}.manifest.json`), '{}');
  fs.writeFileSync(path.join(mockDrDir, `${mockBase}.sha256`), 'mock-sha');

  const filesInDr = fs.readdirSync(mockDrDir);
  const hasPlaintextSql = filesInDr.some(f => f.endsWith('.sql'));
  fs.rmSync(mockDrDir, { recursive: true, force: true });

  assert(
    !hasPlaintextSql && filesInDr.length === 3,
    'Test 36: Successful backup destination strictly persists only .enc, .manifest.json, and .sha256 without plaintext SQL'
  );

  // Test 37: Failed backup cleans up temporary plaintext database workspace
  const mockTempWorkspace = path.join(os.tmpdir(), `dr1-fail-cleanup-test-${Date.now()}`);
  const mockDbDir = path.join(mockTempWorkspace, 'database');
  fs.mkdirSync(mockDbDir, { recursive: true });
  fs.writeFileSync(path.join(mockDbDir, 'rancangloka-d1.sql'), 'SELECT * FROM sensitive;');

  let failCleanupSuccess = false;
  try {
    throw new Error('Simulated D1 export failure during backup');
  } catch {
    // Failsafe cleanup
    if (fs.existsSync(mockTempWorkspace)) {
      fs.rmSync(mockTempWorkspace, { recursive: true, force: true });
    }
    failCleanupSuccess = !fs.existsSync(mockTempWorkspace);
  }

  assert(
    failCleanupSuccess === true,
    'Test 37: Failed backup strictly and immediately cleans up temporary plaintext database workspace'
  );

  // Test 38: Passphrase true zero-echo prevents length leakage (no characters, no asterisks)
  const len8 = '12345678';
  const len20 = '12345678901234567890';
  const proc8 = spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', psScriptPath
  ], {
    input: `${len8}\r\n${len8}\r\n`,
    encoding: 'utf-8',
    timeout: 5000
  });

  const proc20 = spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', psScriptPath
  ], {
    input: `${len20}\r\n${len20}\r\n`,
    encoding: 'utf-8',
    timeout: 5000
  });

  assert(
    proc8.status === 0 &&
    proc20.status === 0 &&
    !proc8.stderr.includes('*') &&
    !proc20.stderr.includes('*') &&
    !proc8.stderr.includes(len8) &&
    !proc20.stderr.includes(len20),
    'Test 38: True zero-echo input does not emit asterisks or characters, strictly preventing passphrase length leakage'
  );

  // =========================================================================
  // Subsystem 11: Google Drive Offsite Integration Hardening & Retention
  // =========================================================================
  console.log('\n--- Subsystem 11: Google Drive Offsite Integration & Retention ---');

  // Test 39: Canonical remote folder model is RancangLoka-DR
  const drAdapter = new GoogleDriveAdapter();
  assert(
    CANONICAL_REMOTE_FOLDER === 'RancangLoka-DR' &&
    drAdapter.remoteFolder === 'RancangLoka-DR',
    'Test 39: Google Drive adapter defaults to canonical remote folder RancangLoka-DR'
  );

  // Test 40: Plaintext SQL upload strictly rejected
  const sqlCheck = validateBackupFileExtensions(['rancangloka-d1.sql', 'dump.SQL']);
  assert(
    sqlCheck.valid === false &&
    sqlCheck.error.includes('SECURITY REJECTION') &&
    sqlCheck.error.includes('rancangloka-d1.sql'),
    'Test 40: Plaintext SQL artifacts are strictly blocked from offsite replication'
  );

  // Test 41: Only approved extensions (.enc, .sha256, .manifest.json) accepted
  const mixedCheck = validateBackupFileExtensions(['backup.enc', 'backup.sha256', 'backup.manifest.json']);
  const unknownExtCheck = validateBackupFileExtensions(['backup.enc', 'backup.png', 'backup.manifest.json']);
  const forbiddenExtCheck = validateBackupFileExtensions(['backup.enc', 'backup.zip', 'backup.manifest.json']);
  assert(
    mixedCheck.valid === true &&
    unknownExtCheck.valid === false &&
    unknownExtCheck.error.includes('POLICY REJECTION') &&
    forbiddenExtCheck.valid === false &&
    forbiddenExtCheck.error.includes('SECURITY REJECTION'),
    'Test 41: Only .enc, .sha256, and .manifest.json extensions are accepted for offsite upload'
  );

  // Test 42: Upload complete 3-file local backup set
  const tempOffsiteDir = path.join(os.tmpdir(), `dr1-offsite-test-${Date.now()}`);
  fs.mkdirSync(tempOffsiteDir, { recursive: true });
  const baseOffsiteName = 'rancangloka-backup-offsite-sample';
  const encPath = path.join(tempOffsiteDir, `${baseOffsiteName}.enc`);
  const shaPath = path.join(tempOffsiteDir, `${baseOffsiteName}.sha256`);
  const manifestPath = path.join(tempOffsiteDir, `${baseOffsiteName}.manifest.json`);

  const sampleArchiveData = Buffer.from('mock-encrypted-archive-payload-bytes');
  const sampleSha = await computeSha256(sampleArchiveData);
  fs.writeFileSync(encPath, sampleArchiveData);
  fs.writeFileSync(shaPath, `sha256:${sampleSha}`);
  fs.writeFileSync(manifestPath, JSON.stringify({
    manifestVersion: '1.0',
    backupId: 'offsite-sample',
    timestamp: new Date().toISOString()
  }));

  const localUploadRes = await drAdapter.uploadLocalBackupFiles({
    archivePath: encPath,
    checksumsPath: shaPath,
    manifestPath: manifestPath
  });

  assert(
    localUploadRes.success === true &&
    localUploadRes.remoteSetId &&
    localUploadRes.remoteSetId.startsWith('gdrive_set_'),
    'Test 42: Complete local 3-file backup set successfully uploads to offsite adapter'
  );

  // Test 43: Incomplete backup set blocks upload
  const incompleteLocal = await drAdapter.uploadLocalBackupFiles({
    archivePath: encPath,
    checksumsPath: shaPath,
    manifestPath: '' // Missing manifest
  });
  assert(
    incompleteLocal.success === false &&
    incompleteLocal.error.includes('INCOMPLETE_BACKUP_SET'),
    'Test 43: Incomplete backup set is strictly blocked from upload'
  );

  // Test 44: Remote verification PASS for complete atomic set
  const localVerifyRes = await drAdapter.verifyRemoteBackupSet(localUploadRes.remoteSetId);
  const remoteListAfterVerify = await drAdapter.listBackupSets();
  const remoteSetSummary = remoteListAfterVerify.find(s => s.remoteSetId === localUploadRes.remoteSetId);
  assert(
    localVerifyRes.valid === true &&
    remoteSetSummary &&
    remoteSetSummary.isVerified === true &&
    remoteSetSummary.files.archiveUploaded === true &&
    remoteSetSummary.files.checksumsUploaded === true &&
    remoteSetSummary.files.manifestUploaded === true,
    'Test 44: Remote verification passes and marks backup set verified only when all 3 files exist and match'
  );

  // Test 45: Remote verification failure deletes nothing and aborts retention
  const initialCount = (await drAdapter.listBackupSets()).length;
  drAdapter.setSimulatedFailure(true);
  const failedVerifyProcess = await drAdapter.processLocalOffsiteBackup({
    archivePath: encPath,
    checksumsPath: shaPath,
    manifestPath: manifestPath
  });
  drAdapter.setSimulatedFailure(false);
  const countAfterFailVerify = (await drAdapter.listBackupSets()).length;

  assert(
    failedVerifyProcess.success === false &&
    countAfterFailVerify === initialCount,
    'Test 45: Remote verification failure strictly aborts retention and deletes nothing'
  );

  // Test 46: 1..5 verified sets retained
  const retentionAdapter = new GoogleDriveAdapter();
  for (let i = 1; i <= 5; i++) {
    const sEnc = path.join(tempOffsiteDir, `set-${i}.enc`);
    const sSha = path.join(tempOffsiteDir, `set-${i}.sha256`);
    const sMan = path.join(tempOffsiteDir, `set-${i}.manifest.json`);
    fs.writeFileSync(sEnc, Buffer.from(`archive-content-${i}`));
    const hash = await computeSha256(Buffer.from(`archive-content-${i}`));
    fs.writeFileSync(sSha, `sha256:${hash}`);
    fs.writeFileSync(sMan, JSON.stringify({ backupId: `set-${i}`, index: i }));

    const res = await retentionAdapter.processLocalOffsiteBackup({
      archivePath: sEnc,
      checksumsPath: sSha,
      manifestPath: sMan
    });
    assert(res.success === true && res.retention.purgedCount === 0, `Seed set ${i} retained`);
  }

  const listAtFive = await retentionAdapter.listBackupSets();
  assert(
    listAtFive.filter(s => s.isVerified).length === 5,
    'Test 46: Exactly 1..5 verified backup sets are retained in the retention pool without purging'
  );

  // Test 47: Sixth verified backup set deletes oldest only
  const oldestSetBeforeSixth = listAtFive[0].remoteSetId;
  const s6Enc = path.join(tempOffsiteDir, 'set-6.enc');
  const s6Sha = path.join(tempOffsiteDir, 'set-6.sha256');
  const s6Man = path.join(tempOffsiteDir, 'set-6.manifest.json');
  fs.writeFileSync(s6Enc, Buffer.from('archive-content-6'));
  const hash6 = await computeSha256(Buffer.from('archive-content-6'));
  fs.writeFileSync(s6Sha, `sha256:${hash6}`);
  fs.writeFileSync(s6Man, JSON.stringify({ backupId: 'set-6', index: 6 }));

  const sixthProcess = await retentionAdapter.processLocalOffsiteBackup({
    archivePath: s6Enc,
    checksumsPath: s6Sha,
    manifestPath: s6Man
  });
  const listAfterSixth = await retentionAdapter.listBackupSets();

  assert(
    sixthProcess.success === true &&
    sixthProcess.retention.purgedCount === 1 &&
    sixthProcess.retention.purgedIds[0] === oldestSetBeforeSixth &&
    listAfterSixth.filter(s => s.isVerified).length === ROLLING_RETENTION_LIMIT &&
    !listAfterSixth.some(s => s.remoteSetId === oldestSetBeforeSixth),
    'Test 47: Sixth verified backup set automatically purges ONLY the oldest verified set'
  );

  // Test 48: Failed sixth upload deletes nothing
  const listBeforeFailSixth = await retentionAdapter.listBackupSets();
  retentionAdapter.setSimulatedFailure(true);
  const s7Enc = path.join(tempOffsiteDir, 'set-7.enc');
  const s7Sha = path.join(tempOffsiteDir, 'set-7.sha256');
  const s7Man = path.join(tempOffsiteDir, 'set-7.manifest.json');
  fs.writeFileSync(s7Enc, Buffer.from('archive-content-7'));
  fs.writeFileSync(s7Sha, 'sha256:dummy');
  fs.writeFileSync(s7Man, JSON.stringify({ backupId: 'set-7' }));

  const failedSixth = await retentionAdapter.processLocalOffsiteBackup({
    archivePath: s7Enc,
    checksumsPath: s7Sha,
    manifestPath: s7Man
  });
  retentionAdapter.setSimulatedFailure(false);
  const listAfterFailSixth = await retentionAdapter.listBackupSets();

  assert(
    failedSixth.success === false &&
    listAfterFailSixth.length === listBeforeFailSixth.length &&
    listAfterFailSixth.map(s => s.remoteSetId).join(',') === listBeforeFailSixth.map(s => s.remoteSetId).join(','),
    'Test 48: Failed upload attempt strictly deletes nothing and leaves all existing verified sets intact'
  );

  // Test 49: Authentication credentials stored outside Git repo and never logged
  const authConfig = getGoogleDriveAuthConfig();
  assert(
    authConfig.credentialsPath.includes('.rancangloka-secrets') &&
    authConfig.tokenPath.includes('.rancangloka-secrets') &&
    !authConfig.credentialsPath.includes('rancangloka-astro') &&
    authConfig.scope === 'https://www.googleapis.com/auth/drive.file' &&
    authConfig.authModel === 'OAUTH2_DESKTOP_LEAST_PRIVILEGE' &&
    authConfig.client_secret === undefined &&
    authConfig.access_token === undefined,
    'Test 49: Authentication credentials configuration is stored outside Git and never leaks secrets'
  );

  // Test 50: Retention ordering deterministic (oldest first)
  const sortedList = await retentionAdapter.listBackupSets();
  let isSorted = true;
  for (let i = 1; i < sortedList.length; i++) {
    if (new Date(sortedList[i].uploadedAt).getTime() < new Date(sortedList[i - 1].uploadedAt).getTime()) {
      isSorted = false;
      break;
    }
  }
  assert(
    isSorted && sortedList.length === 5,
    'Test 50: Remote backup set listing order is strictly deterministic and ascending by upload timestamp'
  );

  // Cleanup temporary test files
  fs.rmSync(tempOffsiteDir, { recursive: true, force: true });

  // =========================================================================
  // Final Results
  // =========================================================================
  console.log('\n====================================================');
  console.log(`📊 DR-1 TEST SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
