/**
 * RancangLoka DR-1: Disaster Recovery Type Definitions & Contracts
 * 
 * Defines all schemas, manifests, configurations, and verification models
 * for Backup, Restore, Offsite Replication, and Scheduling.
 */

export interface SourceManifest {
  version: string;
  gitCommitSha?: string;
  timestamp: string;
  files: {
    path: string;
    sha256: string;
    sizeBytes: number;
  }[];
}

export interface D1TableExport {
  tableName: string;
  rowCount: number;
  columns: string[];
  schemaSql: string;
  rows: Record<string, any>[];
  sha256: string;
}

export interface D1DatabaseManifest {
  databaseId: string;
  databaseName: string;
  exportedAt: string;
  tables: Record<string, {
    rowCount: number;
    sha256: string;
  }>;
  totalRows: number;
  migrationsApplied: string[];
}

export interface R2ObjectMetadata {
  storageKey: string;
  sizeBytes: number;
  sha256: string;
  mimeType: string;
  etag?: string;
  uploadedAt?: string;
}

export interface R2MediaManifest {
  bucketName: string;
  exportedAt: string;
  totalObjects: number;
  totalBytes: number;
  objects: R2ObjectMetadata[];
}

export interface CloudflareInfrastructureManifest {
  manifestVersion: string;
  exportedAt: string;
  projectName: string;
  runtime: 'cloudflare_workers';
  framework: string;
  compatibilityDate: string;
  compatibilityFlags: string[];
  entrypoint: string;
  staticAssetsDirectory: string;
  bindings: {
    d1: { binding: string; databaseName: string; databaseId: string }[];
    r2: { binding: string; bucketName: string }[];
  };
  networking: {
    workersDomain: string;
    customDomains: string[];
    zeroTrustProtectedPaths: string[];
  };
  dnsRecordsRequired: {
    type: string;
    name: string;
    target: string;
    proxied: boolean;
  }[];
  secretsInventory: {
    secretName: string;
    subsystem: string;
    scope: string;
  }[];
}

export interface ChecksumManifest {
  algorithm: 'SHA-256';
  generatedAt: string;
  entries: Record<string, string>; // relativePath -> sha256
}

export interface BackupManifest {
  manifestVersion: '1.0';
  backupId: string;
  backupType: 'FULL' | 'D1_ONLY' | 'MEDIA_ONLY';
  createdAt: string;
  system: {
    appVersion: string;
    d1SchemaVersion: string;
  };
  components: {
    source?: { path: string; sha256: string };
    database: { path: string; sha256: string; rowCount: number };
    media: { path: string; sha256: string; objectCount: number };
    infrastructure: { path: string; sha256: string };
    checksums: { path: string; sha256: string };
  };
  unencryptedPayloadSha256: string;
  encryption?: {
    algorithm: 'AES-256-GCM';
    keyDerivation: 'PBKDF2-SHA256';
    iterations: number;
    saltHex: string;
    ivHex: string;
    tagHex: string;
  };
}

export interface EncryptedEnvelope {
  format: 'RL_DR1_ENCRYPTED_ARCHIVE';
  version: 1;
  algorithm: 'AES-256-GCM';
  keyDerivation: 'PBKDF2-SHA256';
  iterations: number;
  saltHex: string;
  ivHex: string;
  tagHex: string;
  ciphertextBase64: string;
  envelopeSha256: string;
  createdAt: string;
}

export interface BackupSet {
  backupId: string;
  createdAt: string;
  manifest: BackupManifest;
  encryptedArchive?: EncryptedEnvelope;
  rawPayloadJson?: string;
  checksumsSha256: string;
}

export type RestoreMode = 'MERGE' | 'FULL_RESTORE';

export interface ConflictItem {
  table: string;
  primaryKey: string | number;
  conflictType: 'EXISTING_OVERWRITE' | 'FOREIGN_KEY_MISSING' | 'SCHEMA_MISMATCH';
  existingRecord?: Record<string, any>;
  incomingRecord?: Record<string, any>;
  resolution: 'OVERWRITE' | 'IGNORE' | 'FAIL';
}

export interface ConflictReport {
  dryRunTimestamp: string;
  backupId: string;
  restoreMode: RestoreMode;
  compatible: boolean;
  totalIncomingRows: number;
  totalConflicts: number;
  conflicts: ConflictItem[];
  tableDeltas: Record<string, {
    toInsert: number;
    toUpdate: number;
    toSkip: number;
  }>;
  errors: string[];
}

export interface RestoreVerificationResult {
  passed: boolean;
  step: 'VERIFY' | 'CHECKSUM' | 'MANIFEST' | 'SCHEMA' | 'DRY_RUN' | 'CONFLICT_EVAL' | 'READY';
  errors: string[];
  manifest?: BackupManifest;
  conflictReport?: ConflictReport;
}

export interface PreRestoreSnapshot {
  snapshotId: string;
  createdAt: string;
  targetTables: string[];
  data: Record<string, any[]>;
  sha256: string;
}

export type BackupPermissionScope =
  | 'backup:read'
  | 'backup:create'
  | 'backup:download'
  | 'restore:preview'
  | 'restore:execute';

export interface SchedulerPolicy {
  enabled: boolean;
  cadenceMinutes: number; // e.g. 1440 = daily
  retentionKeepLast: number; // strictly 5
  autoSyncGoogleDrive: boolean;
  maxRetries: number;
  retryDelaySeconds: number;
}

export interface BackupHealthState {
  status: 'HEALTHY' | 'DEGRADED' | 'FAILING';
  lastSuccessfulBackupAt?: string;
  lastSuccessfulBackupId?: string;
  lastOffsiteVerificationAt?: string;
  lastRestoreRehearsalAt?: string;
  nextScheduledBackupAt?: string;
  activeJobId?: string;
  consecutiveFailures: number;
  lastError?: string;
  googleDriveRetentionUsed: number;
}
