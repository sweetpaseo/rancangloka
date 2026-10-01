/**
 * RancangLoka — Meta Permission & Connection Health Engine
 * Milestone: SOCIAL-S3.5
 *
 * Implements:
 * 1. Mode-specific permission verification (distinct families for Facebook Login vs Instagram Login).
 * 2. Deterministic connection health computation.
 * 3. Safe disconnect behavior (clearing target bindings without deleting historical campaigns).
 * 4. Zero secret leakage across all health outputs.
 */

import type {
  MetaAuthMode,
  MetaConnectionHealth,
  MetaConnectionRecord,
  MetaConnectionStatus,
} from './binding-types.ts';
import {
  FACEBOOK_LOGIN_REQUIRED_PERMISSIONS,
  INSTAGRAM_LOGIN_REQUIRED_PERMISSIONS,
} from './binding-types.ts';

/**
 * Verify granted permissions against the required list for a given auth mode
 */
export function verifyPermissions(
  authMode: MetaAuthMode,
  grantedPermissions: string[]
): { isComplete: boolean; missingPermissions: string[] } {
  const grantedSet = new Set(grantedPermissions.map((p) => p.toLowerCase()));
  const required =
    authMode === 'FACEBOOK_LOGIN'
      ? FACEBOOK_LOGIN_REQUIRED_PERMISSIONS
      : INSTAGRAM_LOGIN_REQUIRED_PERMISSIONS;

  const missingPermissions = required.filter((req) => !grantedSet.has(req.toLowerCase()));

  return {
    isComplete: missingPermissions.length === 0,
    missingPermissions,
  };
}

/**
 * Compute the comprehensive normalized connection health
 */
export function evaluateConnectionHealth(connection?: MetaConnectionRecord | null): MetaConnectionHealth {
  if (!connection) {
    return {
      provider: 'meta',
      overallStatus: 'NOT_CONNECTED',
      authMode: null,
      facebookPageStatus: 'NOT_CONFIGURED',
      instagramStatus: 'NOT_CONFIGURED',
      selectedPageName: null,
      selectedInstagramUsername: null,
      credentialBindingStatus: 'MISSING',
      permissionsStatus: 'UNKNOWN',
      missingPermissions: [],
      lastVerifiedAt: null,
      publishingAuthority: 0,
      socialAutomationMode: 'OFF',
      operatorActionRequired: true,
      operatorActionMessage: 'Meta account is not connected. Connect via Admin Settings or Social Hub.',
    };
  }

  const { isComplete, missingPermissions } = verifyPermissions(
    connection.authMode,
    connection.grantedPermissions || []
  );

  let overallStatus: MetaConnectionStatus = connection.status;
  if (!isComplete) {
    overallStatus = 'PERMISSION_INCOMPLETE';
  }

  const hasPage = Boolean(connection.selectedFacebookPage?.pageId);
  const hasIg = Boolean(connection.selectedInstagramAccount?.instagramId);

  const facebookPageStatus =
    connection.authMode === 'FACEBOOK_LOGIN'
      ? hasPage
        ? isComplete
          ? 'CONNECTED'
          : 'PERMISSION_INCOMPLETE'
        : 'NOT_CONFIGURED'
      : 'NOT_CONFIGURED';

  const instagramStatus =
    hasIg
      ? isComplete
        ? 'CONNECTED'
        : 'PERMISSION_INCOMPLETE'
      : connection.authMode === 'FACEBOOK_LOGIN' && hasPage
      ? 'LINK_MISSING'
      : 'NOT_CONFIGURED';

  let operatorActionRequired = false;
  let operatorActionMessage: string | null = null;

  if (overallStatus === 'REAUTH_REQUIRED' || overallStatus === 'TOKEN_EXPIRED') {
    operatorActionRequired = true;
    operatorActionMessage = 'Meta authorization has expired or was revoked. Re-authentication is required.';
  } else if (overallStatus === 'PERMISSION_INCOMPLETE') {
    operatorActionRequired = true;
    operatorActionMessage = `Missing required permissions: ${missingPermissions.join(', ')}. Grant permissions in Meta dialog.`;
  } else if (connection.authMode === 'FACEBOOK_LOGIN' && !hasPage) {
    operatorActionRequired = true;
    operatorActionMessage = 'Facebook authorization successful, but no Facebook Page has been selected.';
  }

  return {
    provider: 'meta',
    overallStatus,
    authMode: connection.authMode,
    facebookPageStatus,
    instagramStatus,
    selectedPageName: connection.selectedFacebookPage?.name || null,
    selectedInstagramUsername: connection.selectedInstagramAccount?.username || null,
    credentialBindingStatus: connection.credentialBindingName ? 'PRESENT' : 'MISSING',
    permissionsStatus: isComplete ? 'OK' : 'MISSING',
    missingPermissions,
    lastVerifiedAt: connection.lastVerifiedAt,
    publishingAuthority: 0,
    socialAutomationMode: 'OFF',
    operatorActionRequired,
    operatorActionMessage,
  };
}

/**
 * Disconnect behavior:
 * Removes target page/account bindings and marks status as NOT_CONNECTED.
 * Invariant: Preserves audit history without touching social campaigns or creating fake receipts.
 */
export function disconnectMetaConnection(current: MetaConnectionRecord): MetaConnectionRecord {
  return {
    ...current,
    status: 'NOT_CONNECTED',
    selectedFacebookPage: null,
    selectedInstagramAccount: null,
    credentialBindingName: '',
    grantedPermissions: [],
    missingPermissions: [],
    lastVerifiedAt: new Date().toISOString(),
    lastHealthCheckReason: 'Operator initiated explicit disconnect.',
    updatedAt: new Date().toISOString(),
    publishingAuthority: 0,
  };
}
