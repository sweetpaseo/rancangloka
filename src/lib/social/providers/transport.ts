/**
 * RancangLoka — Social Provider Transport Abstraction & Mock Transport
 * Milestone: SOCIAL-S3
 *
 * Invariants:
 * 1. ZERO REAL NETWORK CALLS IN SOCIAL-S3.
 * 2. MockSocialProviderTransport allows fully deterministic fixtures for unit & integration tests.
 * 3. Inert production transport fails closed immediately when social execution is disabled.
 */

import type {
  SocialProviderTransport,
  SocialTransportRequest,
  SocialTransportResponse,
} from './types.ts';

/**
 * Mock Transport for unit tests and local deterministic simulations.
 * Records all requests made and returns pre-configured fixture responses or handlers.
 */
export class MockSocialProviderTransport implements SocialProviderTransport {
  public recordedRequests: SocialTransportRequest[] = [];
  private handlers: Array<{
    matcher: (req: SocialTransportRequest) => boolean;
    responder: (req: SocialTransportRequest) => Promise<SocialTransportResponse> | SocialTransportResponse;
  }> = [];
  private defaultResponse: SocialTransportResponse = {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: { id: 'mock_provider_post_id_12345' },
  };

  constructor(defaultResponse?: SocialTransportResponse) {
    if (defaultResponse) {
      this.defaultResponse = defaultResponse;
    }
  }

  /**
   * Register a route-specific or condition-specific mock responder.
   */
  public on(
    matcher: (req: SocialTransportRequest) => boolean,
    responder: (req: SocialTransportRequest) => Promise<SocialTransportResponse> | SocialTransportResponse
  ): this {
    this.handlers.push({ matcher, responder });
    return this;
  }

  /**
   * Register an exact URL/path matcher
   */
  public onUrl(
    urlSubstr: string,
    response: Partial<SocialTransportResponse>
  ): this {
    return this.on(
      (req) => req.url.includes(urlSubstr),
      () => ({
        status: response.status ?? 200,
        statusText: response.statusText ?? 'OK',
        headers: response.headers ?? { 'content-type': 'application/json' },
        body: response.body ?? {},
      })
    );
  }

  /**
   * Set the fallback response when no matcher triggers.
   */
  public setDefaultResponse(resp: SocialTransportResponse): void {
    this.defaultResponse = resp;
  }

  /**
   * Clear recorded requests and custom handlers.
   */
  public reset(): void {
    this.recordedRequests = [];
    this.handlers = [];
  }

  /**
   * Execute request in mock context. Guaranteed zero network calls.
   */
  public async request(req: SocialTransportRequest): Promise<SocialTransportResponse> {
    // Record deep clone of request to ensure caller cannot tamper retroactively
    this.recordedRequests.push(JSON.parse(JSON.stringify(req)));

    for (const handler of this.handlers) {
      if (handler.matcher(req)) {
        return await handler.responder(req);
      }
    }

    return this.defaultResponse;
  }
}

/**
 * Inert Production Transport.
 * Designed to strictly reject execution while execution mode is disabled.
 * Uses global fetch ONLY if explicit live authorization exists in a future milestone.
 */
export class ProductionSocialProviderTransport implements SocialProviderTransport {
  private executionAllowed: boolean;

  constructor(options?: { executionAllowed?: boolean }) {
    // Strictly default to false in SOCIAL-S3
    this.executionAllowed = options?.executionAllowed === true;
  }

  public async request(_req: SocialTransportRequest): Promise<SocialTransportResponse> {
    if (!this.executionAllowed) {
      throw new Error(
        'PRODUCTION_TRANSPORT_BLOCKED: Social live transport is strictly disabled in SOCIAL-S3 milestone. No network calls permitted.'
      );
    }

    // Even if executionAllowed were true, in SOCIAL-S3 live calls remain unimplemented to prevent accidents.
    throw new Error('LIVE_TRANSPORT_UNAUTHORIZED: Live Meta publishing is not yet authorized in this milestone.');
  }
}
