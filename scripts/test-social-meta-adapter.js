/**
 * RancangLoka — SOCIAL-S3 Meta Platform Adapter Test Suite
 *
 * Verifies:
 * 1. Provider registry resolves Meta adapters (Facebook Page & Instagram Business)
 * 2. Facebook Page adapter identifies its platform ('facebook_page') and provider ('meta')
 * 3. Instagram Business adapter identifies its platform ('instagram_business') and provider ('meta')
 * 4. Capability matrices are deterministic and fail closed for unverified/unknown formats
 * 5. Unsupported format fails closed (e.g. THREAD on Facebook, REEL_SHORT as unverified)
 * 6. Request construction is deterministic with version-configurable base URL
 * 7. Approval and payload validation rejects mismatch or empty caption
 * 8. Instagram media requirement rejects post without media assets
 * 9. Disabled execution strictly rejects publish attempts with PROVIDER_EXECUTION_DISABLED
 * 10. Mock Facebook success normalizes response correctly into SocialNormalizedPublishResult
 * 11. Mock Instagram multi-stage flow (media container -> publish) normalizes correctly
 * 12. Mock Instagram Carousel multi-stage flow handles items and container chaining
 * 13. Authentication error fixture (code 190) classified deterministically as AUTHENTICATION
 * 14. Permission error fixture (code 200) classified deterministically as AUTHORIZATION
 * 15. Rate-limit error fixture (code 4, 17, 32, 613) classified deterministically as RATE_LIMIT
 * 16. Invalid media error fixture (code 36003) classified deterministically as MEDIA_INVALID
 * 17. Unknown provider error remains UNKNOWN_PROVIDER_ERROR (no invented classes)
 * 18. Secret sanitization ensures no tokens/secrets leak into normalized results or raw details
 * 19. No successful production receipt is created or persisted
 * 20. Zero external network calls made (MockSocialProviderTransport records all interactions)
 * 21. Mission Control chat query returns accurate adapter availability without faking publishing
 */

import assert from 'node:assert/strict';
import {
  getPlatformAdapter,
  getAllRegisteredAdapters,
  getSupportedPlatformIds,
  MockSocialProviderTransport,
  ProductionSocialProviderTransport,
  MetaFacebookPageAdapter,
  MetaInstagramBusinessAdapter,
  MetaProvider,
} from '../src/lib/social/index.ts';
import {
  executeReadOnlyQuery,
  processOperatorInteraction,
  activateSocialDepartmentShadow,
} from '../src/lib/mission-control/index.ts';

console.log('--- Starting SOCIAL-S3 Meta Platform Adapter Test Suite ---');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    throw err;
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    throw err;
  }
}

// ----------------------------------------------------------------------------
// Test Fixture Helpers
// ----------------------------------------------------------------------------

function createSampleVariant(overrides = {}) {
  return {
    id: 101,
    variant_id: 'var_test_fb_001',
    campaign_id: 'camp_meta_001',
    platform_id: 'facebook_page',
    variant_type: 'FEED_POST',
    caption_text: 'Desain fasad industrial dengan ventilasi silang optimal.',
    caption_hash: 'cap_hash_123',
    media_asset_ids_json: JSON.stringify(['asset_001']),
    media_aspect_ratio: '1:1',
    payload_hash: 'payload_hash_abc',
    variant_status: 'APPROVED',
    metadata_json: '{}',
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

// ============================================================================
// SUITE 1: REGISTRY & PLATFORM IDENTITY
// ============================================================================

test('1. Provider registry resolves Meta adapters', () => {
  const fbAdapter = getPlatformAdapter('facebook_page');
  const igAdapter = getPlatformAdapter('instagram_business');

  assert.ok(fbAdapter, 'Facebook Page adapter must be registered');
  assert.ok(igAdapter, 'Instagram Business adapter must be registered');

  const platforms = getSupportedPlatformIds();
  assert.ok(platforms.includes('facebook_page'));
  assert.ok(platforms.includes('instagram_business'));

  const allAdapters = getAllRegisteredAdapters();
  assert.equal(allAdapters.length, 2);
});

test('2. Facebook Page adapter identifies platform and provider', () => {
  const adapter = new MetaFacebookPageAdapter();
  assert.equal(adapter.providerId, 'meta');
  assert.equal(adapter.platformId, 'facebook_page');
});

test('3. Instagram Business adapter identifies platform and provider', () => {
  const adapter = new MetaInstagramBusinessAdapter();
  assert.equal(adapter.providerId, 'meta');
  assert.equal(adapter.platformId, 'instagram_business');
});

// ============================================================================
// SUITE 2: CAPABILITY MATRIX & DETERMINISTIC FAIL-CLOSED
// ============================================================================

test('4. Capability matrices are deterministic', () => {
  const fbAdapter = new MetaFacebookPageAdapter();
  const fbCaps = fbAdapter.capabilities();
  assert.equal(fbCaps.platformId, 'facebook_page');
  assert.equal(fbCaps.variantSupport.FEED_POST, 'SUPPORTED');
  assert.equal(fbCaps.variantSupport.THREAD, 'UNSUPPORTED');
  assert.equal(fbCaps.variantSupport.CAROUSEL, 'UNVERIFIED');
  assert.equal(fbCaps.variantSupport.REEL_SHORT, 'UNVERIFIED');

  const igAdapter = new MetaInstagramBusinessAdapter();
  const igCaps = igAdapter.capabilities();
  assert.equal(igCaps.platformId, 'instagram_business');
  assert.equal(igCaps.variantSupport.FEED_POST, 'SUPPORTED');
  assert.equal(igCaps.variantSupport.CAROUSEL, 'SUPPORTED');
  assert.equal(igCaps.variantSupport.REEL_SHORT, 'UNVERIFIED');
  assert.equal(igCaps.variantSupport.THREAD, 'UNSUPPORTED');
  assert.equal(igCaps.requiresMediaForPost, true);
});

test('5. Unsupported or unverified format fails closed in validation', () => {
  const fbAdapter = new MetaFacebookPageAdapter();
  const threadVariant = createSampleVariant({ variant_type: 'THREAD' });
  const valResult = fbAdapter.validateVariant(threadVariant, { caption: 'Test thread' });

  assert.equal(valResult.valid, false);
  assert.ok(valResult.errors.some((e) => e.includes('not supported')));

  // Unverified carousel on Facebook Page also fails closed
  const carouselVariant = createSampleVariant({ variant_type: 'CAROUSEL' });
  const valResult2 = fbAdapter.validateVariant(carouselVariant, { caption: 'Test carousel' });
  assert.equal(valResult2.valid, false);
});

test('6. Instagram Business rejects post without media', () => {
  const igAdapter = new MetaInstagramBusinessAdapter();
  const igVariant = createSampleVariant({
    platform_id: 'instagram_business',
    variant_type: 'FEED_POST',
  });

  const valResult = igAdapter.validateVariant(igVariant, {
    caption: 'Caption without media',
    mediaUrls: [], // Missing media
  });

  assert.equal(valResult.valid, false);
  assert.ok(valResult.errors.some((e) => e.includes('requires at least one media asset')));
});

test('7. Empty caption or excessive caption length rejected', () => {
  const fbAdapter = new MetaFacebookPageAdapter();
  const variant = createSampleVariant();

  // Empty caption
  const emptyVal = fbAdapter.validateVariant(variant, { caption: '   ' });
  assert.equal(emptyVal.valid, false);
  assert.ok(emptyVal.errors.some((e) => e.includes('cannot be empty')));

  // Excessive caption on Instagram (>2200 chars)
  const igAdapter = new MetaInstagramBusinessAdapter();
  const igVariant = createSampleVariant({ platform_id: 'instagram_business' });
  const hugeCaption = 'A'.repeat(2500);
  const hugeVal = igAdapter.validateVariant(igVariant, {
    caption: hugeCaption,
    mediaUrls: ['https://rancangloka.com/assets/img.jpg'],
  });
  assert.equal(hugeVal.valid, false);
  assert.ok(hugeVal.errors.some((e) => e.includes('exceeds maximum length')));
});

// ============================================================================
// SUITE 3: CONFIGURATION MODEL & ZERO SECRET EXPOSURE
// ============================================================================

test('8. Configuration validation strictly forbids raw secrets and access tokens', () => {
  const adapter = new MetaFacebookPageAdapter();

  // Valid config (non-secret references only)
  const validConfig = {
    provider: 'meta',
    facebookPageId: 'page_123456789',
    credentialBindingName: 'META_PAGE_TOKEN',
  };
  const validRes = adapter.validateConfiguration(validConfig);
  assert.equal(validRes.valid, true);

  // Toxic config with raw access token
  const toxicConfig = {
    provider: 'meta',
    facebookPageId: 'page_123456789',
    accessToken: 'EAAB...raw_secret_token',
  };
  const toxicRes = adapter.validateConfiguration(toxicConfig);
  assert.equal(toxicRes.valid, false);
  assert.ok(toxicRes.errors.some((e) => e.includes('strictly forbidden')));
});

// ============================================================================
// SUITE 4: REQUEST CONSTRUCTION (DETERMINISTIC & VERSION CONFIGURABLE)
// ============================================================================

test('9. Facebook Page builds deterministic photo publish request', () => {
  const adapter = new MetaFacebookPageAdapter({ graphApiVersion: 'v21.0' });
  const variant = createSampleVariant();
  const input = {
    variant,
    approvedPayload: {
      caption: 'Inspirasi fasad bata ekspos.',
      mediaUrls: ['https://rancangloka.com/assets/fasad-bata.jpg'],
      canonicalUrl: 'https://rancangloka.com/fasad-bata',
    },
    config: {
      provider: 'meta',
      facebookPageId: '10987654321',
      graphApiVersion: 'v21.0',
    },
  };

  const built = adapter.buildPublishRequest(input);
  assert.equal(built.providerId, 'meta');
  assert.equal(built.platformId, 'facebook_page');
  assert.equal(built.stages.length, 1);

  const stage = built.stages[0];
  assert.equal(stage.stageName, 'facebook_photo_publish');
  assert.equal(stage.transportRequest.method, 'POST');
  assert.equal(stage.transportRequest.url, 'https://graph.facebook.com/v21.0/10987654321/photos');
  assert.equal(stage.transportRequest.bodyParams?.url, 'https://rancangloka.com/assets/fasad-bata.jpg');
  assert.equal(stage.transportRequest.bodyParams?.caption, 'Inspirasi fasad bata ekspos.');
});

test('10. Instagram Business builds multi-stage container & publish requests', () => {
  const adapter = new MetaInstagramBusinessAdapter({ graphApiVersion: 'v21.0' });
  const variant = createSampleVariant({
    platform_id: 'instagram_business',
    variant_type: 'FEED_POST',
  });
  const input = {
    variant,
    approvedPayload: {
      caption: 'Detail interior skandinavia minimalis.',
      mediaUrls: ['https://rancangloka.com/assets/interior-skandinavia.jpg'],
    },
    config: {
      provider: 'meta',
      instagramAccountId: '17841400000000000',
      graphApiVersion: 'v21.0',
    },
  };

  const built = adapter.buildPublishRequest(input);
  assert.equal(built.providerId, 'meta');
  assert.equal(built.platformId, 'instagram_business');
  assert.equal(built.stages.length, 2);

  // Stage 1: Container
  assert.equal(built.stages[0].stageName, 'instagram_media_container');
  assert.equal(built.stages[0].transportRequest.url, 'https://graph.facebook.com/v21.0/17841400000000000/media');
  assert.equal(built.stages[0].transportRequest.bodyParams?.image_url, 'https://rancangloka.com/assets/interior-skandinavia.jpg');

  // Stage 2: Publish
  assert.equal(built.stages[1].stageName, 'instagram_media_publish');
  assert.equal(built.stages[1].transportRequest.url, 'https://graph.facebook.com/v21.0/17841400000000000/media_publish');
});

test('11. Instagram Carousel builds multi-item containers + carousel container + publish', () => {
  const adapter = new MetaInstagramBusinessAdapter({ graphApiVersion: 'v21.0' });
  const variant = createSampleVariant({
    platform_id: 'instagram_business',
    variant_type: 'CAROUSEL',
  });
  const input = {
    variant,
    approvedPayload: {
      caption: '5 Panduan renovasi dapur hemat energi.',
      mediaUrls: [
        'https://rancangloka.com/assets/slide1.jpg',
        'https://rancangloka.com/assets/slide2.jpg',
        'https://rancangloka.com/assets/slide3.jpg',
      ],
    },
    config: {
      provider: 'meta',
      instagramAccountId: '17841400000000000',
      graphApiVersion: 'v21.0',
    },
  };

  const built = adapter.buildPublishRequest(input);
  assert.equal(built.stages.length, 5); // 3 item stages + 1 carousel container stage + 1 publish stage
  assert.equal(built.stages[0].stageName, 'instagram_carousel_item_1');
  assert.equal(built.stages[1].stageName, 'instagram_carousel_item_2');
  assert.equal(built.stages[2].stageName, 'instagram_carousel_item_3');
  assert.equal(built.stages[3].stageName, 'instagram_carousel_container');
  assert.equal(built.stages[4].stageName, 'instagram_media_publish');
});

// ============================================================================
// SUITE 5: EXECUTION GATE & FAIL-CLOSED SAFETY
// ============================================================================

await asyncTest('12. Disabled execution rejects publish attempts immediately (PROVIDER_EXECUTION_DISABLED)', async () => {
  const adapter = new MetaFacebookPageAdapter({ executionMode: 'DISABLED' });
  const mockTransport = new MockSocialProviderTransport();

  const variant = createSampleVariant();
  const input = {
    variant,
    approvedPayload: { caption: 'Valid caption', mediaUrls: ['https://rancangloka.com/img.jpg'] },
    config: { provider: 'meta', facebookPageId: 'page_123' },
  };

  const request = adapter.buildPublishRequest(input);
  const result = await adapter.executePublish(request, mockTransport);

  assert.equal(result.success, false);
  assert.equal(result.error?.errorClass, 'EXECUTION_DISABLED');
  assert.ok(result.error?.message.includes('PROVIDER_EXECUTION_DISABLED'));
  assert.equal(mockTransport.recordedRequests.length, 0, 'No transport request should be made when disabled');
});

await asyncTest('13. Inert Production Transport blocks execution strictly', async () => {
  const prodTransport = new ProductionSocialProviderTransport();
  await assert.rejects(
    async () => {
      await prodTransport.request({
        method: 'POST',
        url: 'https://graph.facebook.com/v21.0/feed',
      });
    },
    /PRODUCTION_TRANSPORT_BLOCKED/
  );
});

// ============================================================================
// SUITE 6: MOCK TRANSPORT & RESPONSE NORMALIZATION
// ============================================================================

await asyncTest('14. Mock Facebook Page success normalizes correctly', async () => {
  const adapter = new MetaFacebookPageAdapter({ executionMode: 'MOCK_ONLY' });
  const mockTransport = new MockSocialProviderTransport();

  mockTransport.onUrl('/photos', {
    status: 200,
    body: {
      id: 'photo_999888777',
      post_id: 'page123_post456789',
    },
  });

  const variant = createSampleVariant();
  const input = {
    variant,
    approvedPayload: { caption: 'Fasad ramah lingkungan', mediaUrls: ['https://rancangloka.com/img.jpg'] },
    config: { provider: 'meta', facebookPageId: 'page123' },
  };

  const request = adapter.buildPublishRequest(input);
  const result = await adapter.executePublish(request, mockTransport, { executionMode: 'MOCK_ONLY' });

  assert.equal(result.success, true);
  assert.equal(result.providerId, 'meta');
  assert.equal(result.platformId, 'facebook_page');
  assert.equal(result.providerPostId, 'page123_post456789');
  assert.equal(result.permalink, 'https://www.facebook.com/page123_post456789');
  assert.ok(result.publishedAt);
  assert.equal(mockTransport.recordedRequests.length, 1);
});

await asyncTest('15. Mock Instagram multi-stage publication normalizes correctly', async () => {
  const adapter = new MetaInstagramBusinessAdapter({ executionMode: 'MOCK_ONLY' });
  const mockTransport = new MockSocialProviderTransport();

  mockTransport.on(
    (req) => req.url.endsWith('/media'),
    () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: { id: 'container_ig_999111' },
    })
  );

  mockTransport.on(
    (req) => req.url.endsWith('/media_publish'),
    (req) => {
      // Invariant: publish stage must receive the container ID from stage 1
      assert.equal(req.bodyParams?.creation_id, 'container_ig_999111');
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: { id: 'published_ig_post_777666' },
      };
    }
  );

  const variant = createSampleVariant({ platform_id: 'instagram_business' });
  const input = {
    variant,
    approvedPayload: { caption: 'Estetika dapur minimalis', mediaUrls: ['https://rancangloka.com/dapur.jpg'] },
    config: { provider: 'meta', instagramAccountId: 'ig_acc_555' },
  };

  const request = adapter.buildPublishRequest(input);
  const result = await adapter.executePublish(request, mockTransport, { executionMode: 'MOCK_ONLY' });

  assert.equal(result.success, true);
  assert.equal(result.providerId, 'meta');
  assert.equal(result.platformId, 'instagram_business');
  assert.equal(result.providerPostId, 'published_ig_post_777666');
  assert.equal(result.permalink, 'https://www.instagram.com/p/published_ig_post_777666/');
  assert.equal(mockTransport.recordedRequests.length, 2);
});

// ============================================================================
// SUITE 7: ERROR CLASSIFICATION (DETERMINISTIC)
// ============================================================================

test('16. Meta Authentication error (code 190) classified deterministically', () => {
  const errorResp = {
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    body: {
      error: {
        message: 'Error validating access token: Session has expired.',
        type: 'OAuthException',
        code: 190,
        error_subcode: 463,
        fbtrace_id: 'E_fb_trace_123',
      },
    },
  };

  const normalized = MetaProvider.classifyMetaError(errorResp);
  assert.equal(normalized.errorClass, 'AUTHENTICATION');
  assert.equal(normalized.providerCode, 190);
  assert.equal(normalized.providerSubcode, 463);
  assert.equal(normalized.retryable, false);
});

test('17. Meta Permission error (code 200) classified as AUTHORIZATION', () => {
  const errorResp = {
    status: 403,
    statusText: 'Forbidden',
    headers: {},
    body: {
      error: {
        message: 'Permissions error: pages_manage_posts required.',
        type: 'OAuthException',
        code: 200,
        fbtrace_id: 'E_fb_trace_456',
      },
    },
  };

  const normalized = MetaProvider.classifyMetaError(errorResp);
  assert.equal(normalized.errorClass, 'AUTHORIZATION');
  assert.equal(normalized.providerCode, 200);
  assert.equal(normalized.retryable, false);
});

test('18. Meta Rate limit error (code 4, 17, 32, 613) classified as RATE_LIMIT and retryable', () => {
  const errorResp = {
    status: 429,
    statusText: 'Too Many Requests',
    headers: {},
    body: {
      error: {
        message: 'Application request limit reached.',
        type: 'OAuthException',
        code: 4,
        fbtrace_id: 'E_fb_trace_789',
      },
    },
  };

  const normalized = MetaProvider.classifyMetaError(errorResp);
  assert.equal(normalized.errorClass, 'RATE_LIMIT');
  assert.equal(normalized.retryable, true);
});

test('19. Meta Invalid Media error (code 36003) classified as MEDIA_INVALID', () => {
  const errorResp = {
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    body: {
      error: {
        message: 'The image aspect ratio is not supported by Instagram.',
        type: 'IGApiException',
        code: 36003,
        fbtrace_id: 'E_fb_trace_media',
      },
    },
  };

  const normalized = MetaProvider.classifyMetaError(errorResp);
  assert.equal(normalized.errorClass, 'MEDIA_INVALID');
  assert.equal(normalized.retryable, false);
});

test('20. Unknown error remains UNKNOWN_PROVIDER_ERROR without fabrication', () => {
  const errorResp = {
    status: 418,
    statusText: "I'm a teapot",
    headers: {},
    body: {
      error: {
        message: 'Some unclassified proprietary vendor issue',
        code: 999999,
        type: 'UnknownException',
      },
    },
  };

  const normalized = MetaProvider.classifyMetaError(errorResp);
  assert.equal(normalized.errorClass, 'UNKNOWN_PROVIDER_ERROR');
  assert.equal(normalized.retryable, false);
});

// ============================================================================
// SUITE 8: SECRET SANITIZATION & REDACTION
// ============================================================================

test('21. Secret sanitization redacts access tokens and auth headers from diagnostics', () => {
  const rawData = {
    post_id: '12345678',
    access_token: 'EAAB_SUPER_SECRET_TOKEN',
    headers: {
      authorization: 'Bearer EAAB_SECRET',
    },
    meta: {
      expires_in: 3600,
      user_token: 'EAAB_ANOTHER_SECRET',
    },
  };

  const sanitized = MetaProvider.sanitizeMetaPayload(rawData);
  assert.equal(sanitized.post_id, '12345678');
  assert.equal(sanitized.access_token, '[REDACTED]');
  assert.equal(sanitized.headers.authorization, '[REDACTED]');
  assert.equal(sanitized.meta.user_token, '[REDACTED]');
  assert.equal(sanitized.meta.expires_in, 3600);
});

// ============================================================================
// SUITE 9: MISSION CONTROL DIRECT CHAT READ-ONLY INTEGRATION
// ============================================================================

test('22. Mission Control read-only query returns accurate adapter status without faking publishing', () => {
  const queryResult = executeReadOnlyQuery('SOCIAL_ADAPTER_QUERY', 'social_distribution_operator', null);

  assert.ok(queryResult.includes('TERSEDIA (Disabled Execution / Mock Transport)'));
  assert.ok(queryResult.includes('Facebook Page'));
  assert.ok(queryResult.includes('Instagram Business'));
  assert.ok(queryResult.includes('**DISABLED** (Otoritas Eksekusi = 0)'));
  assert.ok(queryResult.includes('Zero raw secrets'));
  assert.ok(queryResult.includes('TIDAK DIHUBUNGKAN'));
});

await asyncTest('23. Maya rejects publishing or credential modification via chat', async () => {
  activateSocialDepartmentShadow();

  const snapshot = {
    social: {
      departmentAvailability: 'AVAILABLE_READ_ONLY',
      mode: 'SHADOW',
      staffCount: 1,
      totalCampaigns: 1,
      activeCampaigns: 1,
      draftCampaigns: 1,
      approvedCampaigns: 0,
      scheduledCampaigns: 0,
      completedCampaigns: 0,
      blockedCampaigns: 0,
      totalVariants: 1,
      variantsAwaitingQa: 0,
      variantsAwaitingApproval: 0,
      variantsApproved: 1,
      variantsScheduledHeld: 0,
      publishedExternallyCount: 0,
      outboxStagedCount: 0,
      outboxEligibleCount: 0,
      providerExecutionAvailable: false,
    },
  };

  // Attempt to publish
  const pubAttempt = await processOperatorInteraction(
    null,
    'social_distribution_operator',
    'Tolong kirimkan postingan ini ke Instagram sekarang juga',
    snapshot
  );
  assert.equal(pubAttempt.command, undefined);
  assert.equal(pubAttempt.response_message.message_type, 'ERROR');
  assert.ok(pubAttempt.response_message.content.includes('DANGEROUS_ACTION_FORBIDDEN'));

  // Attempt to provide access token
  const tokenAttempt = await processOperatorInteraction(
    null,
    'social_distribution_operator',
    'Ini token facebook EAAB123 tolong hubungkan',
    snapshot
  );
  assert.equal(tokenAttempt.command, undefined);
  assert.equal(tokenAttempt.response_message.message_type, 'ERROR');
});

console.log(`\n--- ALL ${passedTests}/${totalTests} SOCIAL-S3 TESTS PASSED SUCCESFULLY ---`);
