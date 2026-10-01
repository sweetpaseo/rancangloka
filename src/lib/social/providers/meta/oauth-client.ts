/**
 * RancangLoka — Meta OAuth Client & Transport Boundary
 * Milestone: SOCIAL-S3.6
 *
 * Implements:
 * 1. Token exchange abstraction separating transport from OAuth business logic.
 * 2. MockMetaOAuthTransport for unit & integration testing with pre-configured fixtures.
 * 3. ProductionMetaOAuthTransport which fails closed strictly unless explicitly enabled.
 * 4. Read-only probe enforcement on all transport calls.
 *
 * Invariant: ZERO RAW SECRETS IN OUTPUTS OR LOGS.
 */

import type { MetaAuthMode } from './binding-types.ts';
import { assertReadOnlyMetaEndpoint } from './live-readiness.ts';

export interface MetaTokenExchangeResult {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  refreshToken?: string;
}

export interface MetaTokenDebugResult {
  isValid: boolean;
  appId: string;
  userId: string;
  scopes: string[];
  expiresAt?: number;
}

export interface MetaOAuthTransport {
  exchangeCode(params: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): Promise<MetaTokenExchangeResult>;

  inspectToken(params: {
    inputToken: string;
    accessToken: string;
  }): Promise<MetaTokenDebugResult>;

  requestReadOnly(params: {
    endpoint: string;
    accessToken: string;
    method?: string;
  }): Promise<any>;
}

/**
 * Mock Meta OAuth Transport for tests and deterministic simulations.
 * Guarantees zero external network access.
 */
export class MockMetaOAuthTransport implements MetaOAuthTransport {
  public recordedRequests: Array<{ type: string; params: any }> = [];
  private exchangeResult: MetaTokenExchangeResult;
  private debugResult: MetaTokenDebugResult;
  private readOnlyResponses: Map<string, any> = new Map();

  constructor(options?: {
    exchangeResult?: Partial<MetaTokenExchangeResult>;
    debugResult?: Partial<MetaTokenDebugResult>;
  }) {
    this.exchangeResult = {
      accessToken: options?.exchangeResult?.accessToken || 'mock_meta_access_token_sec_99999',
      tokenType: options?.exchangeResult?.tokenType || 'bearer',
      expiresIn: options?.exchangeResult?.expiresIn || 5184000, // 60 days
      refreshToken: options?.exchangeResult?.refreshToken || 'mock_meta_refresh_token_sec_88888',
    };

    this.debugResult = {
      isValid: options?.debugResult?.isValid ?? true,
      appId: options?.debugResult?.appId || 'mock_app_1234567890',
      userId: options?.debugResult?.userId || 'mock_user_9876543210',
      scopes: options?.debugResult?.scopes || [
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts',
        'instagram_basic',
        'instagram_content_publish',
      ],
      expiresAt: options?.debugResult?.expiresAt || Date.now() + 5184000 * 1000,
    };
  }

  public setReadOnlyResponse(endpoint: string, response: any): void {
    this.readOnlyResponses.set(endpoint, response);
  }

  public async exchangeCode(params: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): Promise<MetaTokenExchangeResult> {
    this.recordedRequests.push({
      type: 'exchangeCode',
      params: {
        code: params.code,
        clientId: params.clientId,
        redirectUri: params.redirectUri,
        // clientSecret is recorded as redacted
        clientSecret: '[REDACTED]',
      },
    });

    if (params.code === 'invalid_code' || params.code === 'expired_code') {
      throw new Error('OAUTH_EXCHANGE_FAILED: The authorization code is invalid or has expired.');
    }

    return { ...this.exchangeResult };
  }

  public async inspectToken(params: {
    inputToken: string;
    accessToken: string;
  }): Promise<MetaTokenDebugResult> {
    this.recordedRequests.push({
      type: 'inspectToken',
      params: {
        inputToken: '[REDACTED]',
        accessToken: '[REDACTED]',
      },
    });

    return { ...this.debugResult };
  }

  public async requestReadOnly(params: {
    endpoint: string;
    accessToken: string;
    method?: string;
  }): Promise<any> {
    const method = params.method || 'GET';
    // Strictly verify endpoint is read-only
    assertReadOnlyMetaEndpoint(method, params.endpoint);

    this.recordedRequests.push({
      type: 'requestReadOnly',
      params: {
        endpoint: params.endpoint,
        method,
        accessToken: '[REDACTED]',
      },
    });

    // Check pre-configured response
    if (this.readOnlyResponses.has(params.endpoint)) {
      return this.readOnlyResponses.get(params.endpoint);
    }

    // Default mock response for /me/accounts
    if (params.endpoint.includes('/me/accounts')) {
      return {
        data: [
          {
            id: 'page_10987654321',
            name: 'RancangLoka ID',
            category: 'Media/News Company',
            tasks: ['ANALYZE', 'ADVERTISE', 'MODERATE', 'CREATE_CONTENT', 'MANAGE'],
            instagram_business_account: {
              id: '17841400000000001',
              username: 'rancangloka.id',
            },
          },
        ],
      };
    }

    // Default mock response for /me (Direct Instagram)
    if (params.endpoint.includes('/me')) {
      return {
        id: '17841400000000001',
        username: 'rancangloka.official',
        account_type: 'BUSINESS',
      };
    }

    return { data: [] };
  }
}

/**
 * Production Meta OAuth Transport.
 * Fails closed strictly by default. Zero unauthorized network requests.
 */
export class ProductionMetaOAuthTransport implements MetaOAuthTransport {
  private executionAllowed: boolean;

  constructor(options?: { executionAllowed?: boolean }) {
    this.executionAllowed = options?.executionAllowed === true;
  }

  public async exchangeCode(_params: any): Promise<MetaTokenExchangeResult> {
    if (!this.executionAllowed) {
      throw new Error(
        'PRODUCTION_OAUTH_TRANSPORT_BLOCKED: Live Meta OAuth code exchange is disabled in this milestone. Use MockMetaOAuthTransport.'
      );
    }
    throw new Error('LIVE_OAUTH_UNAUTHORIZED: Live exchange transport requires operator activation.');
  }

  public async inspectToken(_params: any): Promise<MetaTokenDebugResult> {
    if (!this.executionAllowed) {
      throw new Error(
        'PRODUCTION_OAUTH_TRANSPORT_BLOCKED: Live Meta token debug is disabled in this milestone.'
      );
    }
    throw new Error('LIVE_OAUTH_UNAUTHORIZED: Live token inspection requires operator activation.');
  }

  public async requestReadOnly(_params: any): Promise<any> {
    if (!this.executionAllowed) {
      throw new Error(
        'PRODUCTION_OAUTH_TRANSPORT_BLOCKED: Live Meta read-only probe is disabled in this milestone.'
      );
    }
    throw new Error('LIVE_OAUTH_UNAUTHORIZED: Live read-only probe requires operator activation.');
  }
}

/**
 * Build the canonical Meta OAuth Authorization Dialog URL
 */
export function buildMetaOAuthAuthorizeUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
  authMode: MetaAuthMode;
  graphVersion?: string;
}): string {
  const version = options.graphVersion || 'v21.0';

  if (options.authMode === 'INSTAGRAM_LOGIN') {
    const params = new URLSearchParams({
      enable_fb_login: '0',
      force_authentication: '1',
      client_id: options.clientId,
      redirect_uri: options.redirectUri,
      response_type: 'code',
      scope: 'instagram_business_basic,instagram_business_content_publish',
      state: options.state,
    });
    return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
  }

  // Default: FACEBOOK_LOGIN
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish',
    state: options.state,
  });
  return `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`;
}
