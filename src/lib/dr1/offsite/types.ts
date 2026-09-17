/**
 * RancangLoka DR-1: Offsite Storage Adapter Interfaces & Types
 */

import type { BackupSet } from '../types.ts';

export interface RemoteBackupSummary {
  remoteSetId: string;
  backupId: string;
  uploadedAt: string;
  files: {
    manifestUploaded: boolean;
    archiveUploaded: boolean;
    checksumsUploaded: boolean;
  };
  sizeBytes: number;
  sha256: string;
  isVerified: boolean;
}

export interface RetentionResult {
  keptCount: number;
  purgedCount: number;
  purgedIds: string[];
  error?: string;
}

export interface LocalBackupFiles {
  archivePath: string; // .enc
  checksumsPath: string; // .sha256
  manifestPath: string; // .manifest.json
}

export interface OffsiteAuthConfig {
  credentialsPath: string;
  tokenPath: string;
  scope: string;
  hasCredentials: boolean;
  hasToken: boolean;
  authModel: 'OAUTH2_DESKTOP_LEAST_PRIVILEGE';
}

export interface OffsiteUploadResult {
  success: boolean;
  remoteSetId?: string;
  error?: string;
  retention?: RetentionResult;
  verified?: boolean;
}

export interface OffsiteAdapter {
  providerName: string;
  testConnection(): Promise<boolean>;
  uploadBackupSet(set: BackupSet): Promise<{ success: boolean; remoteSetId?: string; error?: string }>;
  verifyRemoteBackupSet(remoteSetId: string): Promise<{ valid: boolean; error?: string }>;
  listBackupSets(): Promise<RemoteBackupSummary[]>;
  purgeBackupSet(remoteSetId: string): Promise<boolean>;
  enforceRetention(): Promise<RetentionResult>;
}

