/**
 * RancangLoka DR-1: Security & Granular Scope Enforcement
 * 
 * Separates permissions:
 * - backup:read
 * - backup:create
 * - backup:download
 * - restore:preview
 * - restore:execute
 * 
 * Enforces strict isolation against:
 * - Hermes Ingestion (hermes:ingest:v1)
 * - LokaMedia (media:write:draft)
 * - Publication Inventory (inventory:read:v1)
 */

import type { BackupPermissionScope } from './types.ts';

export const VALID_BACKUP_SCOPES = new Set<BackupPermissionScope>([
  'backup:read',
  'backup:create',
  'backup:download',
  'restore:preview',
  'restore:execute'
]);

export interface AuthPrincipal {
  sub: string;
  scopes: string[];
  isSuperAdmin?: boolean;
}

/**
 * Validates whether an authenticated principal holds the required scope.
 */
export function hasPermission(
  principal: AuthPrincipal | null | undefined,
  requiredScope: BackupPermissionScope
): boolean {
  if (!principal || !Array.isArray(principal.scopes)) {
    return false;
  }

  // SuperAdmin has broad authority, but restore:execute still requires explicit scope
  if (principal.isSuperAdmin && requiredScope !== 'restore:execute') {
    return true;
  }

  return principal.scopes.includes(requiredScope);
}

/**
 * Validates request scopes for DR-1 operations.
 * Fails closed if foreign scopes (Hermes, LokaMedia, Inventory) attempt DR-1 actions.
 */
export function validateScopeAuthorization(
  principal: AuthPrincipal,
  operation: 'READ' | 'CREATE' | 'DOWNLOAD' | 'RESTORE_PREVIEW' | 'RESTORE_EXECUTE'
): { authorized: boolean; reason?: string } {
  // Reject if principal only holds foreign subsystem scopes
  const hasOnlyForeignScopes = principal.scopes.every(scope =>
    ['hermes:ingest:v1', 'media:write:draft', 'inventory:read:v1'].includes(scope)
  );
  if (hasOnlyForeignScopes && !principal.isSuperAdmin) {
    return {
      authorized: false,
      reason: 'SECURITY REJECTION: Ingestion and Media credentials cannot perform backup or restore.'
    };
  }

  let requiredScope: BackupPermissionScope;
  switch (operation) {
    case 'READ':
      requiredScope = 'backup:read';
      break;
    case 'CREATE':
      requiredScope = 'backup:create';
      break;
    case 'DOWNLOAD':
      requiredScope = 'backup:download';
      break;
    case 'RESTORE_PREVIEW':
      requiredScope = 'restore:preview';
      break;
    case 'RESTORE_EXECUTE':
      requiredScope = 'restore:execute';
      break;
    default:
      return { authorized: false, reason: 'Unknown DR operation.' };
  }

  if (!hasPermission(principal, requiredScope)) {
    return {
      authorized: false,
      reason: `Insufficient privilege: Missing required scope '${requiredScope}'.`
    };
  }

  return { authorized: true };
}

/**
 * Verifies that a backup credential cannot publish or modify live editorial content.
 */
export function canPublishArticle(principal: AuthPrincipal): boolean {
  if (!principal || !Array.isArray(principal.scopes)) return false;
  // Backup-specific scopes cannot publish articles
  const hasBackupScopesOnly = principal.scopes.every(scope => scope.startsWith('backup:') || scope.startsWith('restore:'));
  if (hasBackupScopesOnly) {
    return false;
  }
  return principal.scopes.includes('article:publish');
}
