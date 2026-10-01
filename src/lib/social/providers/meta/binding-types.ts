/**
 * RancangLoka — Meta Credential & Account Binding Architecture
 * Milestone: SOCIAL-S3.5
 *
 * Strict Invariants:
 * 1. ZERO PRODUCTION CREDENTIALS / SECRETS IN D1 OR REPO.
 *    No access_token, refresh_token, app_secret, or client_secret in data structures.
 * 2. Meta Publishing Authority = 0.
 *    Connection != Approval. Connection != Publishing Authority.
 * 3. Supports BOTH Meta Auth Modes:
 *    A. FACEBOOK_LOGIN (Facebook Page + optional linked Instagram Professional account)
 *    B. INSTAGRAM_LOGIN (Direct Instagram Professional account authorization)
 * 4. Distinct Permission Families per auth mode.
 * 5. Deterministic Connection Health & Discovery models.
 */

export type MetaAuthMode = 'FACEBOOK_LOGIN' | 'INSTAGRAM_LOGIN';

export type MetaConnectionStatus =
  | 'NOT_CONNECTED'
  | 'CONNECTED'
  | 'PERMISSION_INCOMPLETE'
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_LINK_MISSING'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'REAUTH_REQUIRED'
  | 'UNKNOWN';

export type MetaPlatformType = 'facebook_page' | 'instagram_business';

/**
 * Facebook Login Permission Family
 */
export const FACEBOOK_LOGIN_REQUIRED_PERMISSIONS = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
] as const;

export const FACEBOOK_LOGIN_OPTIONAL_IG_PERMISSIONS = [
  'instagram_basic',
  'instagram_content_publish',
] as const;

/**
 * Instagram Login (Direct) Permission Family
 */
export const INSTAGRAM_LOGIN_REQUIRED_PERMISSIONS = [
  'instagram_business_basic',
  'instagram_business_content_publish',
] as const;

/**
 * Discovery Metadata for a Discovered Facebook Page
 */
export interface DiscoveredFacebookPage {
  pageId: string;
  name: string;
  category?: string;
  tasks?: string[];
  hasLinkedInstagram: boolean;
  linkedInstagramId?: string | null;
  linkedInstagramUsername?: string | null;
  hasPublishPermission: boolean;
}

/**
 * Discovery Metadata for a Discovered Instagram Account
 */
export interface DiscoveredInstagramAccount {
  instagramId: string;
  username: string;
  name?: string;
  profilePictureUrl?: string;
  accountType: 'BUSINESS' | 'MEDIA_CREATOR' | 'PERSONAL';
  sourceAuthMode: MetaAuthMode;
  linkedFacebookPageId?: string | null;
}

/**
 * Normalized Account Discovery Result (No tokens)
 */
export interface MetaAccountDiscoveryResult {
  authMode: MetaAuthMode;
  operatorIdentity: {
    userId: string;
    userName?: string;
  };
  facebookPages: DiscoveredFacebookPage[];
  instagramAccounts: DiscoveredInstagramAccount[];
  discoveredAt: string;
}

/**
 * Canonical Meta Connection Binding Record
 * Stored in settings (key-value) as non-secret metadata.
 * ZERO raw tokens or secrets.
 */
export interface MetaConnectionRecord {
  connectionId: string;
  authMode: MetaAuthMode;
  credentialBindingName: string; // e.g. 'META_PAGE_ACCESS_TOKEN' or 'META_IG_ACCESS_TOKEN'
  status: MetaConnectionStatus;
  
  // Selected Target Identities (Explicitly chosen by operator)
  selectedFacebookPage?: {
    pageId: string;
    name: string;
    selectedAt: string;
  } | null;

  selectedInstagramAccount?: {
    instagramId: string;
    username: string;
    sourceMode: MetaAuthMode;
    selectedAt: string;
  } | null;

  // Granted vs Required Permissions
  grantedPermissions: string[];
  missingPermissions: string[];
  
  // Auditable Timestamps & Health
  lastVerifiedAt: string | null;
  lastHealthCheckReason?: string | null;
  tokenExpiresAt?: string | null; // Informational expiration timestamp only (no token value)
  createdAt: string;
  updatedAt: string;

  // Strict Safety Flag: ALWAYS 0 in S3.5
  publishingAuthority: 0;
}

export interface SelectedFacebookPageBinding {
  pageId: string;
  name: string;
  category?: string;
  tasks?: string[];
}

export interface SelectedInstagramAccountBinding {
  instagramId: string;
  username: string;
  name?: string;
  accountType?: 'BUSINESS' | 'MEDIA_CREATOR' | 'PERSONAL';
}

/**
 * Normalized Read-Only Connection Health Model for UI & Telemetry
 */
export interface MetaConnectionHealth {
  provider: 'meta';
  overallStatus: MetaConnectionStatus;
  authMode: MetaAuthMode | null;
  facebookPageStatus: 'CONNECTED' | 'NOT_CONFIGURED' | 'PERMISSION_INCOMPLETE';
  instagramStatus: 'CONNECTED' | 'NOT_CONFIGURED' | 'LINK_MISSING' | 'PERMISSION_INCOMPLETE';
  selectedPageName: string | null;
  selectedInstagramUsername: string | null;
  credentialBindingStatus: 'PRESENT' | 'MISSING';
  permissionsStatus: 'OK' | 'MISSING' | 'UNKNOWN';
  missingPermissions: string[];
  lastVerifiedAt: string | null;
  publishingAuthority: 0; // Strictly 0
  socialAutomationMode: 'OFF'; // Strictly OFF
  operatorActionRequired: boolean;
  operatorActionMessage?: string | null;
}

/**
 * OAuth State Parameter Structure
 * Cryptographically signed / verified single-use CSRF envelope
 */
export interface MetaOAuthState {
  stateId: string;
  authMode: MetaAuthMode;
  targetPlatform: 'all' | 'facebook_page' | 'instagram_business';
  redirectUri: string;
  createdAt: number;
  expiresAt: number;
  nonce: string;
}
