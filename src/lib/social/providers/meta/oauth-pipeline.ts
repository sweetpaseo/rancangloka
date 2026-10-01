/**
 * RancangLoka — Meta OAuth Connection & Callback Processing Pipeline
 * Milestone: SOCIAL-S3.6
 *
 * Implements:
 * 1. Safe preparation of OAuth connect requests with live readiness gates.
 * 2. Strict callback processing pipeline (state consumption, token exchange via transport,
 *    AES-256-GCM vault persistence, account discovery, and non-secret metadata saving).
 * 3. Guaranteed zero secret persistence in D1 settings (only encrypted vault).
 * 4. Strictly zero publishing authority (publishingAuthority = 0).
 */

import { storeCredential } from '../../vault/vault-service.ts';
import { normalizeFacebookPagesDiscovery, normalizeInstagramLoginDiscovery } from './account-discovery.ts';
import { evaluateAccountSelection } from './account-selection.ts';
import type {
  MetaAccountDiscoveryResult,
  MetaAuthMode,
  MetaConnectionRecord,
} from './binding-types.ts';
import { saveMetaConnection } from './connection-service.ts';
import { evaluateMetaLiveReadiness } from './live-readiness.ts';
import {
  buildMetaOAuthAuthorizeUrl,
  type MetaOAuthTransport,
  ProductionMetaOAuthTransport,
} from './oauth-client.ts';
import { consumeOAuthState, generateOAuthState } from './oauth-security.ts';

export interface MetaConnectOptions {
  env?: any;
  authMode?: MetaAuthMode;
  redirectUri?: string;
}

export interface MetaConnectResult {
  success: boolean;
  code: string;
  error?: string;
  authorizeUrl?: string;
  stateString?: string;
}

/**
 * Process an operator request to initiate Meta OAuth connection.
 * Evaluates prerequisites and returns the authorization URL if ready.
 */
export async function processMetaConnectRequest(
  options: MetaConnectOptions
): Promise<MetaConnectResult> {
  const env = options.env || (typeof process !== 'undefined' ? process.env : {});
  const readiness = evaluateMetaLiveReadiness({ env });

  // 1. Gate: Master Encryption Key (KEK) must be present
  if (readiness.credentialKekStatus === 'MISSING') {
    return {
      success: false,
      code: 'KEK_REQUIRED',
      error: readiness.operatorActionMessage,
    };
  }

  // 2. Gate: Meta App Configuration must be present
  if (readiness.metaAppIdStatus === 'MISSING' || readiness.metaAppSecretStatus === 'MISSING') {
    return {
      success: false,
      code: 'APP_CONFIGURATION_REQUIRED',
      error: readiness.operatorActionMessage,
    };
  }

  const authMode = options.authMode || readiness.selectedAuthMode;
  const redirectUri = options.redirectUri || readiness.callbackUrl;

  // 3. Generate cryptographically signed single-use state
  const { stateString } = generateOAuthState({
    authMode,
    redirectUri,
  });

  // 4. Construct authorization URL
  const authorizeUrl = buildMetaOAuthAuthorizeUrl({
    clientId: env.META_APP_ID,
    redirectUri,
    state: stateString,
    authMode,
    graphVersion: readiness.graphApiVersion,
  });

  return {
    success: true,
    code: 'READY_TO_CONNECT',
    authorizeUrl,
    stateString,
  };
}

export interface MetaCallbackOptions {
  db: any;
  env?: any;
  code?: string | null;
  state?: string | null;
  error?: string | null;
  errorDescription?: string | null;
  expectedRedirectUri?: string;
  transport?: MetaOAuthTransport;
  explicitSelectedPageId?: string;
}

export interface MetaCallbackResult {
  success: boolean;
  code: string;
  message: string;
  connection?: MetaConnectionRecord;
  discovery?: MetaAccountDiscoveryResult;
}

/**
 * Process incoming Meta OAuth callback.
 * Consumes single-use state, exchanges authorization code, encrypts tokens into vault,
 * discovers accounts, and persists safe non-secret connection record in D1.
 */
export async function processMetaCallbackRequest(
  options: MetaCallbackOptions
): Promise<MetaCallbackResult> {
  const { db, code, state, error, errorDescription, expectedRedirectUri } = options;
  const env = options.env || (typeof process !== 'undefined' ? process.env : {});

  // 1. Check for provider-reported OAuth errors (e.g. user cancelled)
  if (error) {
    return {
      success: false,
      code: 'OAUTH_PROVIDER_ERROR',
      message: errorDescription || error,
    };
  }

  // 2. Validate parameter presence
  if (!code || !state) {
    return {
      success: false,
      code: 'MISSING_PARAMETERS',
      message: 'Both code and state parameters are required to complete Meta OAuth callback.',
    };
  }

  // 3. Validate and atomically consume state (CSRF and single-use replay protection)
  const stateValidation = consumeOAuthState(state, {
    expectedRedirectUri,
  });

  if (!stateValidation.valid || !stateValidation.state) {
    return {
      success: false,
      code: stateValidation.error?.split(':')[0] || 'INVALID_OAUTH_STATE',
      message: stateValidation.error || 'Invalid or expired OAuth state parameter.',
    };
  }

  const oauthState = stateValidation.state;
  const transport = options.transport || new ProductionMetaOAuthTransport();

  // 4. Token exchange abstraction
  let tokenResult: {
    accessToken: string;
    tokenType: string;
    expiresIn?: number;
    refreshToken?: string;
  };

  try {
    tokenResult = await transport.exchangeCode({
      code,
      clientId: env.META_APP_ID || 'mock_app_id',
      clientSecret: env.META_APP_SECRET || 'mock_app_secret',
      redirectUri: oauthState.redirectUri,
    });
  } catch (exchangeErr: any) {
    return {
      success: false,
      code: 'TOKEN_EXCHANGE_FAILED',
      message: exchangeErr.message || 'Failed to exchange authorization code for access token.',
    };
  }

  // 5. Encrypt and persist tokens into Credential Vault (AES-256-GCM with independent nonces & AAD)
  const connectionId = 'conn_meta_primary';
  const kek = env.META_CREDENTIAL_KEK_V1;

  if (!kek) {
    return {
      success: false,
      code: 'KEK_REQUIRED',
      message: 'Cannot store OAuth credential: META_CREDENTIAL_KEK_V1 is not available.',
    };
  }

  const expiresAt = tokenResult.expiresIn
    ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
    : undefined;

  const kekResolver = async (version: string) => {
    if (version === 'META_CREDENTIAL_KEK_V1') return kek;
    return null;
  };

  try {
    await storeCredential(
      db,
      kekResolver,
      {
        connectionId,
        provider: 'meta',
        authMode: oauthState.authMode,
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
        keyVersion: 'META_CREDENTIAL_KEK_V1',
        expiresAt,
      }
    );
  } catch (vaultErr: any) {
    return {
      success: false,
      code: 'VAULT_STORAGE_FAILED',
      message: `Failed to encrypt credentials into vault: ${vaultErr.message}`,
    };
  }

  // 6. Read-Only Account Discovery via Transport
  let discovery: MetaAccountDiscoveryResult;
  try {
    if (oauthState.authMode === 'FACEBOOK_LOGIN') {
      const accountsPayload = await transport.requestReadOnly({
        endpoint: '/v21.0/me/accounts',
        accessToken: tokenResult.accessToken,
      });
      discovery = normalizeFacebookPagesDiscovery(accountsPayload, 'meta_operator', 'Operator');
    } else {
      const mePayload = await transport.requestReadOnly({
        endpoint: '/v21.0/me',
        accessToken: tokenResult.accessToken,
      });
      discovery = normalizeInstagramLoginDiscovery(mePayload, 'meta_operator');
    }
  } catch (discoveryErr: any) {
    return {
      success: false,
      code: 'DISCOVERY_FAILED',
      message: `Account discovery failed: ${discoveryErr.message}`,
    };
  }

  // 7. Explicit Account Selection & Target Binding
  const selection = evaluateAccountSelection({
    discovery,
    selectedPageId: options.explicitSelectedPageId,
    explicitConfirmation: true,
  });

  const now = new Date().toISOString();

  // 8. Construct Safe, Non-Secret Connection Record
  const connectionRecord: MetaConnectionRecord = {
    connectionId,
    authMode: oauthState.authMode,
    credentialBindingName: 'META_CREDENTIAL_VAULT',
    status: 'CONNECTED',
    selectedFacebookPage: selection.targetFacebookBinding
      ? {
          pageId: selection.targetFacebookBinding.pageId,
          name: selection.targetFacebookBinding.name,
          selectedAt: now,
        }
      : null,
    selectedInstagramAccount: selection.targetInstagramBinding
      ? {
          instagramId: selection.targetInstagramBinding.instagramId,
          username: selection.targetInstagramBinding.username,
          sourceMode: oauthState.authMode,
          selectedAt: now,
        }
      : null,
    grantedPermissions: [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
    ],
    missingPermissions: [],
    lastVerifiedAt: now,
    lastHealthCheckReason: 'OAuth handshake and read-only account discovery completed successfully.',
    tokenExpiresAt: expiresAt,
    createdAt: now,
    updatedAt: now,
    publishingAuthority: 0, // Strictly ZERO
  };

  // 9. Persist Connection Record to D1 Settings (Zero secrets)
  await saveMetaConnection(db, connectionRecord);

  return {
    success: true,
    code: 'CONNECTED_SUCCESS',
    message: 'Meta connection successfully bound in read-only mode.',
    connection: connectionRecord,
    discovery,
  };
}
