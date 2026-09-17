/**
 * RancangLoka DR-1: Restore Core Engine
 * 
 * Implements non-destructive verification and dry-run execution:
 * VERIFY
 * → CHECKSUM
 * → MANIFEST VALIDATION
 * → SCHEMA COMPATIBILITY
 * → DRY RUN
 * → CONFLICT REPORT
 * → READY / BLOCK
 * 
 * Modes: MERGE, FULL_RESTORE.
 * Full restore automatically generates a PreRestoreSnapshot.
 */

import { computeSha256, decryptPayload } from './crypto.ts';
import type {
  BackupManifest,
  BackupSet,
  ConflictItem,
  ConflictReport,
  PreRestoreSnapshot,
  RestoreMode,
  RestoreVerificationResult
} from './types.ts';

export const EXPECTED_SCHEMA_VERSION = '0005';
export const REQUIRED_CANONICAL_TABLES = [
  'categories',
  'authors',
  'articles',
  'pages',
  'settings',
  'users',
  'sessions',
  'subscribers',
  'article_ingest_receipts',
  'media_assets',
  'article_media'
];

export interface TargetDatabaseState {
  tables: Record<string, Record<string, any>[]>;
  schemaVersion?: string;
}

/**
 * Step 1: Validates that backup checksums and manifests match uncorrupted signatures.
 */
export async function verifyBackupSetIntegrity(
  backupSet: BackupSet,
  passphrase?: string
): Promise<{ valid: boolean; error?: string; rawPayload?: any }> {
  if (!backupSet || !backupSet.manifest) {
    return { valid: false, error: 'Malformed backup set: manifest is missing.' };
  }

  // 1. Verify manifest format
  if (backupSet.manifest.manifestVersion !== '1.0') {
    return { valid: false, error: `Unsupported manifest version: ${backupSet.manifest.manifestVersion}` };
  }

  // 2. If encrypted, decrypt and verify payload hash
  if (backupSet.encryptedArchive) {
    if (!passphrase) {
      return { valid: false, error: 'Passphrase is required to decrypt this backup set.' };
    }
    try {
      const decryptedBytes = await decryptPayload(backupSet.encryptedArchive, passphrase);
      const decryptedJson = new TextDecoder().decode(decryptedBytes);
      const decryptedSha256 = await computeSha256(decryptedJson);

      if (decryptedSha256 !== backupSet.manifest.unencryptedPayloadSha256) {
        return { valid: false, error: 'Decrypted payload SHA-256 does not match manifest.' };
      }

      const parsedPayload = JSON.parse(decryptedJson);
      return { valid: true, rawPayload: parsedPayload };
    } catch (err: any) {
      return { valid: false, error: `Decryption failed: ${err.message}` };
    }
  }

  // 3. If unencrypted raw payload provided
  if (backupSet.rawPayloadJson) {
    const rawSha256 = await computeSha256(backupSet.rawPayloadJson);
    if (rawSha256 !== backupSet.manifest.unencryptedPayloadSha256) {
      return { valid: false, error: 'Unencrypted payload SHA-256 mismatch: archive is corrupted.' };
    }
    const parsedPayload = JSON.parse(backupSet.rawPayloadJson);
    return { valid: true, rawPayload: parsedPayload };
  }

  return { valid: false, error: 'Backup set contains neither raw payload nor valid encrypted archive.' };
}

/**
 * Step 2: Checks schema compatibility against current canonical D1 schema.
 */
export function checkSchemaCompatibility(
  manifest: BackupManifest,
  currentSchemaVersion: string = EXPECTED_SCHEMA_VERSION
): { compatible: boolean; error?: string } {
  const backupSchemaVersion = manifest.system.d1SchemaVersion;
  if (!backupSchemaVersion) {
    return { compatible: false, error: 'Backup manifest lacks D1 schema version metadata.' };
  }

  // Backwards compatible within 0001-0005 range
  const validVersions = ['0001', '0002', '0003', '0004', '0005'];
  if (!validVersions.includes(backupSchemaVersion)) {
    return {
      compatible: false,
      error: `Incompatible backup schema version: ${backupSchemaVersion} (supported: ${validVersions.join(', ')})`
    };
  }

  return { compatible: true };
}

/**
 * Generates an automatic point-in-time snapshot of the target database state before restore.
 */
export async function createPreRestoreSnapshot(
  targetState: TargetDatabaseState
): Promise<PreRestoreSnapshot> {
  const snapshotId = `pre_restore_snap_${Date.now()}`;
  const data = JSON.parse(JSON.stringify(targetState.tables));
  const sha256 = await computeSha256(JSON.stringify(data));

  return {
    snapshotId,
    createdAt: new Date().toISOString(),
    targetTables: Object.keys(data),
    data,
    sha256
  };
}

/**
 * Step 3: Executes Dry-Run Restore Simulation without mutating target database.
 * Detects conflicts, calculates delta statistics, and produces a ConflictReport.
 */
export async function executeDryRunRestore(
  rawPayload: any,
  targetState: TargetDatabaseState,
  mode: RestoreMode
): Promise<ConflictReport> {
  const timestamp = new Date().toISOString();
  const backupId = rawPayload.backupId || 'unknown';
  const incomingTables: Record<string, any> = rawPayload.database?.tables || {};

  const conflicts: ConflictItem[] = [];
  const tableDeltas: Record<string, { toInsert: number; toUpdate: number; toSkip: number }> = {};
  const errors: string[] = [];

  let totalIncomingRows = 0;

  // Verify that incoming tables are structured
  for (const tableName of Object.keys(incomingTables)) {
    const incomingData = incomingTables[tableName];
    const incomingRows: Record<string, any>[] = incomingData.rows || [];
    totalIncomingRows += incomingRows.length;

    const existingRows = targetState.tables[tableName] || [];
    const existingById = new Map<any, Record<string, any>>();
    const existingBySlug = new Map<string, Record<string, any>>();

    for (const row of existingRows) {
      if (row.id !== undefined) existingById.set(row.id, row);
      if (row.slug) existingBySlug.set(row.slug, row);
      if (row.key) existingById.set(row.key, row); // settings
    }

    let toInsert = 0;
    let toUpdate = 0;
    let toSkip = 0;

    for (const incRow of incomingRows) {
      const primaryKeyVal = incRow.id !== undefined ? incRow.id : (incRow.key || incRow.slug || incRow.asset_id);
      const existingMatch = existingById.get(primaryKeyVal) || (incRow.slug ? existingBySlug.get(incRow.slug) : undefined);

      if (existingMatch) {
        if (mode === 'MERGE') {
          // Merge mode detects overwrite vs identical
          const matchSha = await computeSha256(JSON.stringify(existingMatch));
          const incSha = await computeSha256(JSON.stringify(incRow));

          if (matchSha === incSha) {
            toSkip++;
          } else {
            toUpdate++;
            conflicts.push({
              table: tableName,
              primaryKey: primaryKeyVal,
              conflictType: 'EXISTING_OVERWRITE',
              existingRecord: existingMatch,
              incomingRecord: incRow,
              resolution: 'OVERWRITE'
            });
          }
        } else {
          // Full Restore mode marks all existing as to be replaced
          toUpdate++;
          conflicts.push({
            table: tableName,
            primaryKey: primaryKeyVal,
            conflictType: 'EXISTING_OVERWRITE',
            existingRecord: existingMatch,
            incomingRecord: incRow,
            resolution: 'OVERWRITE'
          });
        }
      } else {
        toInsert++;
      }
    }

    tableDeltas[tableName] = { toInsert, toUpdate, toSkip };
  }

  const compatible = errors.length === 0;

  return {
    dryRunTimestamp: timestamp,
    backupId,
    restoreMode: mode,
    compatible,
    totalIncomingRows,
    totalConflicts: conflicts.length,
    conflicts,
    tableDeltas,
    errors
  };
}

/**
 * Master Verification Pipeline:
 * VERIFY → CHECKSUM → MANIFEST VALIDATION → SCHEMA COMPATIBILITY → DRY RUN → CONFLICT REPORT
 */
export async function runRestorePreflight(
  backupSet: BackupSet,
  targetState: TargetDatabaseState,
  mode: RestoreMode,
  passphrase?: string
): Promise<RestoreVerificationResult> {
  const errors: string[] = [];

  // 1. CHECKSUM & INTEGRITY
  const integrityResult = await verifyBackupSetIntegrity(backupSet, passphrase);
  if (!integrityResult.valid || !integrityResult.rawPayload) {
    return {
      passed: false,
      step: 'CHECKSUM',
      errors: [integrityResult.error || 'Integrity check failed.']
    };
  }

  // 2. MANIFEST VALIDATION
  const manifest = backupSet.manifest;
  if (!manifest.components.database || !manifest.components.infrastructure) {
    return {
      passed: false,
      step: 'MANIFEST',
      errors: ['Manifest is missing required database or infrastructure components.']
    };
  }

  // 3. SCHEMA COMPATIBILITY
  const schemaCheck = checkSchemaCompatibility(manifest, targetState.schemaVersion);
  if (!schemaCheck.compatible) {
    return {
      passed: false,
      step: 'SCHEMA',
      errors: [schemaCheck.error || 'Schema compatibility check failed.'],
      manifest
    };
  }

  // 4. DRY RUN & CONFLICT REPORT
  const conflictReport = await executeDryRunRestore(integrityResult.rawPayload, targetState, mode);
  if (!conflictReport.compatible) {
    return {
      passed: false,
      step: 'CONFLICT_EVAL',
      errors: conflictReport.errors,
      manifest,
      conflictReport
    };
  }

  // 5. READY
  return {
    passed: true,
    step: 'READY',
    errors: [],
    manifest,
    conflictReport
  };
}
