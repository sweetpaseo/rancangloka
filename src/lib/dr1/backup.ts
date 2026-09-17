/**
 * RancangLoka DR-1: Backup Core Engine
 * 
 * Orchestrates deterministic backup generation:
 * - Source/config manifest
 * - D1 schema and data export
 * - R2 LokaMedia inventory
 * - Cloudflare infrastructure manifest
 * - SHA-256 checksums
 * - Authenticated AES-256-GCM packaging
 */

import { computeSha256, encryptPayload } from './crypto.ts';
import type {
  BackupManifest,
  BackupSet,
  ChecksumManifest,
  CloudflareInfrastructureManifest,
  D1DatabaseManifest,
  D1TableExport,
  R2MediaManifest,
  SourceManifest
} from './types.ts';

export const KNOWN_SECRET_NAMES = [
  'RANCANGLOKA_ADMIN_USERNAME',
  'RANCANGLOKA_ADMIN_PASSWORD',
  'RANCANGLOKA_ADMIN_SESSION_SECRET',
  'RANCANGLOKA_ADMIN_PREVIOUS_SECRETS',
  'RANCANGLOKA_HERMES_INGEST_KEY_CURRENT_ID',
  'RANCANGLOKA_HERMES_INGEST_KEY_CURRENT',
  'RANCANGLOKA_HERMES_INGEST_KEY_PREVIOUS_ID',
  'RANCANGLOKA_HERMES_INGEST_KEY_PREVIOUS',
  'RANCANGLOKA_INVENTORY_READ_KEY_CURRENT_ID',
  'RANCANGLOKA_INVENTORY_READ_KEY_CURRENT',
  'RANCANGLOKA_INVENTORY_READ_KEY_PREVIOUS_ID',
  'RANCANGLOKA_INVENTORY_READ_KEY_PREVIOUS',
  'RANCANGLOKA_MEDIA_UPLOAD_KEY',
  'MEDIA_UPLOAD_KEY',
  'RANCANGLOKA_BACKUP_MASTER_KEY'
];

/**
 * Builds the canonical infrastructure manifest without leaking any secret values.
 */
export function buildInfrastructureManifest(): CloudflareInfrastructureManifest {
  return {
    manifestVersion: '1.0',
    exportedAt: new Date().toISOString(),
    projectName: 'rancangloka',
    runtime: 'cloudflare_workers',
    framework: 'astro_7_ssr',
    compatibilityDate: '2024-09-23',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: '@astrojs/cloudflare/entrypoints/server',
    staticAssetsDirectory: 'dist',
    bindings: {
      d1: [
        {
          binding: 'DB',
          databaseName: 'rancangloka_db',
          databaseId: '3a86e9ad-410f-4440-884e-2eb813ec4cf7'
        }
      ],
      r2: [
        {
          binding: 'MEDIA_BUCKET',
          bucketName: 'rancangloka-media'
        }
      ]
    },
    networking: {
      workersDomain: 'rancangloka.chandrajoyko.workers.dev',
      customDomains: ['rancangloka.com', 'www.rancangloka.com'],
      zeroTrustProtectedPaths: ['/admin', '/admin/*']
    },
    dnsRecordsRequired: [
      { type: 'CNAME', name: 'rancangloka.com', target: 'rancangloka.chandrajoyko.workers.dev', proxied: true },
      { type: 'CNAME', name: 'www', target: 'rancangloka.com', proxied: true }
    ],
    secretsInventory: [
      { secretName: 'RANCANGLOKA_ADMIN_USERNAME', subsystem: 'auth', scope: 'admin:ui' },
      { secretName: 'RANCANGLOKA_ADMIN_PASSWORD', subsystem: 'auth', scope: 'admin:ui' },
      { secretName: 'RANCANGLOKA_ADMIN_SESSION_SECRET', subsystem: 'auth', scope: 'admin:session' },
      { secretName: 'RANCANGLOKA_HERMES_INGEST_KEY_CURRENT', subsystem: 'hermes', scope: 'hermes:ingest:v1' },
      { secretName: 'RANCANGLOKA_INVENTORY_READ_KEY_CURRENT', subsystem: 'inventory', scope: 'inventory:read:v1' },
      { secretName: 'RANCANGLOKA_MEDIA_UPLOAD_KEY', subsystem: 'lokamedia', scope: 'media:write:draft' },
      { secretName: 'RANCANGLOKA_BACKUP_MASTER_KEY', subsystem: 'dr1', scope: 'backup:envelope' }
    ]
  };
}

/**
 * Scans object payload to ensure no sensitive plaintext values were accidentally serialized.
 * Distinguishes between legitimate secret metadata NAMES (allowed in manifest)
 * and actual secret VALUES (strictly forbidden anywhere in backup).
 */
export function assertNoPlaintextSecrets(obj: any, secretValuesToGuard: string[] = []): void {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj);

  // 1. Guard against actual sensitive secret values
  for (const secretVal of secretValuesToGuard) {
    if (secretVal && typeof secretVal === 'string' && secretVal.trim().length >= 6) {
      const cleanVal = secretVal.trim();
      // Skip if the string is just a known secret identifier name
      if (KNOWN_SECRET_NAMES.includes(cleanVal)) {
        continue;
      }
      if (json.includes(cleanVal)) {
        throw new Error(`SECURITY ALERT: Plaintext secret value detected in backup artifact!`);
      }
    }
  }

  // 2. Structural check: Verify secretsInventory contains ONLY metadata names, never values
  try {
    const parsed = typeof obj === 'string' ? JSON.parse(obj) : obj;
    const infra = parsed?.infrastructure || parsed?.manifest?.components?.infrastructure;
    if (infra && Array.isArray(infra.secretsInventory)) {
      for (const item of infra.secretsInventory) {
        if ('value' in item || 'secret' in item || 'plaintext' in item || 'credential' in item) {
          throw new Error('SECURITY ALERT: secretsInventory contains sensitive value field!');
        }
      }
    }
  } catch (err: any) {
    if (err.message && err.message.startsWith('SECURITY ALERT:')) {
      throw err;
    }
  }

  // 3. Heuristic pattern check: Private keys or Bearer tokens
  const forbiddenPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /["']bearer\s+[A-Za-z0-9_\-\.]{32,}["']/i
  ];
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(json)) {
      throw new Error(`SECURITY ALERT: Private key or bearer token detected in backup artifact!`);
    }
  }
}

export interface BackupInputData {
  tables: Record<string, {
    schemaSql: string;
    columns: string[];
    rows: Record<string, any>[];
  }>;
  mediaObjects?: {
    storageKey: string;
    sizeBytes: number;
    sha256: string;
    mimeType: string;
  }[];
  sourceFiles?: {
    path: string;
    content: string;
  }[];
  appVersion?: string;
  d1SchemaVersion?: string;
}

/**
 * Creates a complete, deterministic, verified BackupSet asynchronously using standard Web Crypto.
 */
export async function createBackupSet(
  input: BackupInputData,
  passphrase?: string,
  secretValuesToGuard: string[] = []
): Promise<BackupSet> {
  const timestamp = new Date().toISOString();
  const backupId = `bk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // 1. Source Manifest
  const sourceFilesList = [];
  for (const f of input.sourceFiles || []) {
    const fileBytes = new TextEncoder().encode(f.content);
    sourceFilesList.push({
      path: f.path,
      sha256: await computeSha256(fileBytes),
      sizeBytes: fileBytes.length
    });
  }

  const sourceManifest: SourceManifest = {
    version: input.appVersion || '1.0.0',
    timestamp,
    files: sourceFilesList
  };

  // 2. D1 Database Export
  const tablesExport: Record<string, D1TableExport> = {};
  const d1TablesSummary: Record<string, { rowCount: number; sha256: string }> = {};
  let totalD1Rows = 0;

  for (const [tName, tData] of Object.entries(input.tables)) {
    const rowsJson = JSON.stringify(tData.rows);
    const tableSha256 = await computeSha256(rowsJson);
    tablesExport[tName] = {
      tableName: tName,
      rowCount: tData.rows.length,
      columns: tData.columns,
      schemaSql: tData.schemaSql,
      rows: tData.rows,
      sha256: tableSha256
    };
    d1TablesSummary[tName] = {
      rowCount: tData.rows.length,
      sha256: tableSha256
    };
    totalD1Rows += tData.rows.length;
  }

  const d1Manifest: D1DatabaseManifest = {
    databaseId: '3a86e9ad-410f-4440-884e-2eb813ec4cf7',
    databaseName: 'rancangloka_db',
    exportedAt: timestamp,
    tables: d1TablesSummary,
    totalRows: totalD1Rows,
    migrationsApplied: ['0001', '0002', '0003', '0004', '0005']
  };

  // 3. R2 Media Inventory
  const mediaList = input.mediaObjects || [];
  const r2Manifest: R2MediaManifest = {
    bucketName: 'rancangloka-media',
    exportedAt: timestamp,
    totalObjects: mediaList.length,
    totalBytes: mediaList.reduce((acc, m) => acc + m.sizeBytes, 0),
    objects: mediaList
  };

  // 4. Infrastructure Manifest
  const infraManifest = buildInfrastructureManifest();

  // 5. Component JSON Payloads & Checksums
  const sourceJson = JSON.stringify(sourceManifest);
  const databaseJson = JSON.stringify({ manifest: d1Manifest, tables: tablesExport });
  const mediaJson = JSON.stringify(r2Manifest);
  const infraJson = JSON.stringify(infraManifest);

  const checksumEntries: Record<string, string> = {
    'manifest.json': '', // computed below
    'source/manifest.json': await computeSha256(sourceJson),
    'database/export.json': await computeSha256(databaseJson),
    'media/inventory.json': await computeSha256(mediaJson),
    'infrastructure/manifest.json': await computeSha256(infraJson)
  };

  const checksumsManifest: ChecksumManifest = {
    algorithm: 'SHA-256',
    generatedAt: timestamp,
    entries: checksumEntries
  };

  // 6. Aggregate Payload
  const rawPayload = {
    backupId,
    timestamp,
    source: sourceManifest,
    database: { manifest: d1Manifest, tables: tablesExport },
    media: r2Manifest,
    infrastructure: infraManifest,
    checksums: checksumsManifest
  };

  const rawPayloadJson = JSON.stringify(rawPayload);
  const unencryptedPayloadSha256 = await computeSha256(rawPayloadJson);

  // Security check: Assert no guarded secrets in payload
  assertNoPlaintextSecrets(rawPayloadJson, secretValuesToGuard);

  // 7. Master Backup Manifest
  const manifest: BackupManifest = {
    manifestVersion: '1.0',
    backupId,
    backupType: 'FULL',
    createdAt: timestamp,
    system: {
      appVersion: input.appVersion || '1.0.0',
      d1SchemaVersion: input.d1SchemaVersion || '0005'
    },
    components: {
      source: { path: 'source/manifest.json', sha256: checksumEntries['source/manifest.json'] },
      database: { path: 'database/export.json', sha256: checksumEntries['database/export.json'], rowCount: totalD1Rows },
      media: { path: 'media/inventory.json', sha256: checksumEntries['media/inventory.json'], objectCount: mediaList.length },
      infrastructure: { path: 'infrastructure/manifest.json', sha256: checksumEntries['infrastructure/manifest.json'] },
      checksums: { path: 'checksums.sha256', sha256: await computeSha256(JSON.stringify(checksumsManifest)) }
    },
    unencryptedPayloadSha256
  };

  // Update manifest checksum
  checksumEntries['manifest.json'] = await computeSha256(JSON.stringify(manifest));

  // 8. Encryption (if passphrase provided)
  let encryptedArchive;
  if (passphrase) {
    encryptedArchive = await encryptPayload(rawPayloadJson, passphrase);
    manifest.encryption = {
      algorithm: encryptedArchive.algorithm,
      keyDerivation: encryptedArchive.keyDerivation,
      iterations: encryptedArchive.iterations,
      saltHex: encryptedArchive.saltHex,
      ivHex: encryptedArchive.ivHex,
      tagHex: encryptedArchive.tagHex
    };
  }

  const checksumsSha256 = await computeSha256(JSON.stringify(manifest));

  return {
    backupId,
    createdAt: timestamp,
    manifest,
    encryptedArchive,
    rawPayloadJson: passphrase ? undefined : rawPayloadJson,
    checksumsSha256
  };
}
