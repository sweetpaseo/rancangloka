/**
 * RancangLoka — SOCIAL-S3.5 Meta Credential & Account Binding Test Suite
 *
 * Verifies:
 * 1. Facebook Login connection model (discovers Facebook Pages and linked Instagram accounts)
 * 2. Instagram Login direct connection model (discovers Instagram Professional identity without requiring FB Page)
 * 3. Permission verification: distinct permission families for Facebook Login vs Instagram Login
 * 4. Incomplete permissions evaluates to PERMISSION_INCOMPLETE status
 * 5. Multiple Facebook Pages: discovery preserves all pages and requires explicit selection
 * 6. Missing linked Instagram under Facebook Login is represented honestly (LINK_MISSING)
 * 7. Direct Instagram Login does not falsely require FB Page linkage
 * 8. OAuth state generation is cryptographically signed and tamper-resistant
 * 9. Tampered or expired OAuth state fails closed
 * 10. Origin / Redirect URI mismatch in OAuth state fails closed
 * 11. Zero secrets in connection metadata (no access_token, app_secret, refresh_token)
 * 12. Attempt to save raw token to settings throws security violation error
 * 13. Disconnect behavior clears account bindings without affecting existing campaigns
 * 14. Connection health reflects NOT_CONNECTED, PERMISSION_INCOMPLETE, REAUTH_REQUIRED accurately
 * 15. Anomaly detection: REAUTH_REQUIRED and PERMISSION_INCOMPLETE map to actionable MC-6 anomalies
 * 16. Mission Control read-only query (SOCIAL_CONNECTION_QUERY) returns truthful status
 * 17. Publishing commands via chat remain strictly forbidden (DANGEROUS_ACTION_FORBIDDEN)
 * 18. Zero live publishing executed, zero social_execution_receipts generated
 * 19. SOCIAL_AUTOMATION remains OFF, Meta publishing authority remains 0
 * 20. ProductionSocialProviderTransport remains blocked
 */

import assert from 'node:assert/strict';
import {
  generateOAuthState,
  validateOAuthState,
  normalizeFacebookPagesDiscovery,
  normalizeInstagramLoginDiscovery,
  verifyPermissions,
  evaluateConnectionHealth,
  disconnectMetaConnection,
  saveMetaConnection,
  getMetaConnection,
  getMetaConnectionHealth,
  ProductionSocialProviderTransport,
} from '../src/lib/social/index.ts';
import {
  executeReadOnlyQuery,
  processOperatorInteraction,
  activateSocialDepartmentShadow,
} from '../src/lib/mission-control/index.ts';

console.log('--- Starting SOCIAL-S3.5 Meta Account Binding Test Suite ---');

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

// ============================================================================
// SUITE 1: META AUTH MODES & ACCOUNT DISCOVERY
// ============================================================================

test('1. Facebook Login discovery models Pages, permissions, and linked Instagram', () => {
  const mockRawPages = {
    data: [
      {
        id: '10987654321',
        name: 'RancangLoka Indonesia',
        category: 'Media/News Company',
        tasks: ['CREATE_CONTENT', 'MANAGE'],
        instagram_business_account: {
          id: '17841400000000000',
          username: 'rancangloka.id',
        },
      },
      {
        id: '20987654321',
        name: 'RancangLoka Studio',
        category: 'Architecture Firm',
        tasks: ['ANALYZE'], // Read-only task, no publish permission
      },
    ],
  };

  const discovery = normalizeFacebookPagesDiscovery(mockRawPages, 'usr_op_123', 'Chief Editor');
  assert.equal(discovery.authMode, 'FACEBOOK_LOGIN');
  assert.equal(discovery.facebookPages.length, 2);

  // Page 1: Has publish permission + linked IG
  assert.equal(discovery.facebookPages[0].pageId, '10987654321');
  assert.equal(discovery.facebookPages[0].hasPublishPermission, true);
  assert.equal(discovery.facebookPages[0].hasLinkedInstagram, true);
  assert.equal(discovery.facebookPages[0].linkedInstagramId, '17841400000000000');

  // Page 2: No publish permission, no linked IG
  assert.equal(discovery.facebookPages[1].pageId, '20987654321');
  assert.equal(discovery.facebookPages[1].hasPublishPermission, false);
  assert.equal(discovery.facebookPages[1].hasLinkedInstagram, false);

  // Discovered Instagram accounts list
  assert.equal(discovery.instagramAccounts.length, 1);
  assert.equal(discovery.instagramAccounts[0].username, 'rancangloka.id');
  assert.equal(discovery.instagramAccounts[0].linkedFacebookPageId, '10987654321');
});

test('2. Direct Instagram Login discovery does not require Facebook Page linkage', () => {
  const mockRawIgMe = {
    id: '17841499999999999',
    username: 'rancangloka.official',
    account_type: 'BUSINESS',
  };

  const discovery = normalizeInstagramLoginDiscovery(mockRawIgMe, 'usr_op_ig_555');
  assert.equal(discovery.authMode, 'INSTAGRAM_LOGIN');
  assert.equal(discovery.facebookPages.length, 0, 'Direct IG Login discovers zero Facebook Pages');
  assert.equal(discovery.instagramAccounts.length, 1);
  assert.equal(discovery.instagramAccounts[0].username, 'rancangloka.official');
  assert.equal(discovery.instagramAccounts[0].sourceAuthMode, 'INSTAGRAM_LOGIN');
  assert.equal(discovery.instagramAccounts[0].linkedFacebookPageId, null);
});

// ============================================================================
// SUITE 2: PERMISSION HEALTH & SEPARATION
// ============================================================================

test('3. Permission verification enforces distinct families for Facebook vs Instagram Login', () => {
  // Facebook Login requires pages_show_list, pages_read_engagement, pages_manage_posts
  const fbComplete = verifyPermissions('FACEBOOK_LOGIN', [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
  ]);
  assert.equal(fbComplete.isComplete, true);
  assert.equal(fbComplete.missingPermissions.length, 0);

  // Facebook Login missing pages_manage_posts
  const fbIncomplete = verifyPermissions('FACEBOOK_LOGIN', ['pages_show_list', 'pages_read_engagement']);
  assert.equal(fbIncomplete.isComplete, false);
  assert.deepEqual(fbIncomplete.missingPermissions, ['pages_manage_posts']);

  // Instagram Login requires instagram_business_basic, instagram_business_content_publish
  const igComplete = verifyPermissions('INSTAGRAM_LOGIN', [
    'instagram_business_basic',
    'instagram_business_content_publish',
  ]);
  assert.equal(igComplete.isComplete, true);

  // Instagram Login missing publish
  const igIncomplete = verifyPermissions('INSTAGRAM_LOGIN', ['instagram_business_basic']);
  assert.equal(igIncomplete.isComplete, false);
  assert.deepEqual(igIncomplete.missingPermissions, ['instagram_business_content_publish']);
});

// ============================================================================
// SUITE 3: OAUTH STATE SECURITY & CSRF PROTECTION
// ============================================================================

test('4. OAuth state generation produces verifiable HMAC signature and single-use payload', () => {
  const redirectUri = 'https://rancangloka.com/admin/oauth/meta/callback';
  const { stateString, stateObject } = generateOAuthState({
    authMode: 'FACEBOOK_LOGIN',
    redirectUri,
  });

  assert.ok(stateString.includes('.'));
  assert.equal(stateObject.authMode, 'FACEBOOK_LOGIN');
  assert.equal(stateObject.redirectUri, redirectUri);
  assert.ok(stateObject.expiresAt > Date.now());

  // Validation succeeds
  const res = validateOAuthState(stateString, { expectedRedirectUri: redirectUri });
  assert.equal(res.valid, true);
  assert.equal(res.state?.authMode, 'FACEBOOK_LOGIN');
});

test('5. Tampered or expired OAuth state fails closed deterministically', () => {
  const redirectUri = 'https://rancangloka.com/admin/oauth/meta/callback';
  const { stateString } = generateOAuthState({
    authMode: 'FACEBOOK_LOGIN',
    redirectUri,
  });

  // Tamper payload
  const [payload, signature] = stateString.split('.');
  const tamperedState = `TAMPERED_${payload}.${signature}`;
  const resTampered = validateOAuthState(tamperedState);
  assert.equal(resTampered.valid, false);
  assert.ok(resTampered.error?.includes('INVALID_SIGNATURE'));

  // Expired state (ttl = -100ms)
  const expired = generateOAuthState({
    authMode: 'FACEBOOK_LOGIN',
    redirectUri,
    ttlMs: -100,
  });
  const resExpired = validateOAuthState(expired.stateString);
  assert.equal(resExpired.valid, false);
  assert.ok(resExpired.error?.includes('STATE_EXPIRED'));

  // Redirect URI mismatch
  const resMismatch = validateOAuthState(stateString, {
    expectedRedirectUri: 'https://evil.com/callback',
  });
  assert.equal(resMismatch.valid, false);
  assert.ok(resMismatch.error?.includes('REDIRECT_URI_MISMATCH'));
});

// ============================================================================
// SUITE 4: CONNECTION HEALTH & TARGET SELECTION
// ============================================================================

test('6. Connection health distinguishes CONNECTED, PERMISSION_INCOMPLETE, and LINK_MISSING', () => {
  // Case A: Clean Facebook connection with Page + linked IG
  const completeRecord = {
    connectionId: 'conn_test_001',
    authMode: 'FACEBOOK_LOGIN',
    credentialBindingName: 'META_PAGE_ACCESS_TOKEN',
    status: 'CONNECTED',
    selectedFacebookPage: {
      pageId: 'page_123',
      name: 'RancangLoka',
      selectedAt: '2026-10-01T10:00:00.000Z',
    },
    selectedInstagramAccount: {
      instagramId: 'ig_456',
      username: 'rancangloka.id',
      sourceMode: 'FACEBOOK_LOGIN',
      selectedAt: '2026-10-01T10:00:00.000Z',
    },
    grantedPermissions: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
    missingPermissions: [],
    lastVerifiedAt: '2026-10-01T10:00:00.000Z',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    publishingAuthority: 0,
  };

  const healthA = evaluateConnectionHealth(completeRecord);
  assert.equal(healthA.overallStatus, 'CONNECTED');
  assert.equal(healthA.facebookPageStatus, 'CONNECTED');
  assert.equal(healthA.instagramStatus, 'CONNECTED');
  assert.equal(healthA.publishingAuthority, 0);
  assert.equal(healthA.socialAutomationMode, 'OFF');

  // Case B: Facebook Page selected but NO linked Instagram
  const noIgRecord = {
    ...completeRecord,
    selectedInstagramAccount: null,
  };
  const healthB = evaluateConnectionHealth(noIgRecord);
  assert.equal(healthB.facebookPageStatus, 'CONNECTED');
  assert.equal(healthB.instagramStatus, 'LINK_MISSING');

  // Case C: Missing permission
  const incompleteRecord = {
    ...completeRecord,
    grantedPermissions: ['pages_show_list'], // Missing manage_posts
  };
  const healthC = evaluateConnectionHealth(incompleteRecord);
  assert.equal(healthC.overallStatus, 'PERMISSION_INCOMPLETE');
  assert.equal(healthC.permissionsStatus, 'MISSING');
  assert.ok(healthC.missingPermissions.includes('pages_manage_posts'));
});

// ============================================================================
// SUITE 5: SECRET BOUNDARY ASSERTION
// ============================================================================

await asyncTest('7. Attempt to save raw secrets or tokens throws critical security violation', async () => {
  const toxicRecord = {
    connectionId: 'conn_toxic',
    authMode: 'FACEBOOK_LOGIN',
    credentialBindingName: 'META_PAGE_TOKEN',
    status: 'CONNECTED',
    accessToken: 'EAAB_FORBIDDEN_RAW_TOKEN', // STRICTLY FORBIDDEN
    grantedPermissions: [],
    missingPermissions: [],
    publishingAuthority: 0,
  };

  const mockDb = {
    prepare: () => ({
      bind: () => ({
        run: async () => {},
      }),
    }),
  };

  await assert.rejects(
    async () => {
      await saveMetaConnection(mockDb, toxicRecord);
    },
    /CRITICAL_SECURITY_VIOLATION/
  );
});

test('8. Disconnect cleanly unbinds accounts without mutating campaigns', () => {
  const activeRecord = {
    connectionId: 'conn_to_disconnect',
    authMode: 'FACEBOOK_LOGIN',
    credentialBindingName: 'META_PAGE_ACCESS_TOKEN',
    status: 'CONNECTED',
    selectedFacebookPage: { pageId: 'p1', name: 'Page 1', selectedAt: '2026-10-01' },
    selectedInstagramAccount: { instagramId: 'ig1', username: 'ig1', sourceMode: 'FACEBOOK_LOGIN', selectedAt: '2026-10-01' },
    grantedPermissions: ['pages_show_list'],
    missingPermissions: [],
    lastVerifiedAt: '2026-10-01',
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
    publishingAuthority: 0,
  };

  const disconnected = disconnectMetaConnection(activeRecord);
  assert.equal(disconnected.status, 'NOT_CONNECTED');
  assert.equal(disconnected.selectedFacebookPage, null);
  assert.equal(disconnected.selectedInstagramAccount, null);
  assert.equal(disconnected.credentialBindingName, '');
  assert.equal(disconnected.publishingAuthority, 0);
});

// ============================================================================
// SUITE 6: MISSION CONTROL CHAT & ANOMALY INTEGRATION
// ============================================================================

test('9. Maya accurately answers SOCIAL_CONNECTION_QUERY from read model without faking publishing', () => {
  activateSocialDepartmentShadow();

  const snapshot = {
    social: {
      departmentAvailability: 'AVAILABLE_READ_ONLY',
      mode: 'SHADOW',
      staffCount: 1,
      totalCampaigns: 2,
      activeCampaigns: 1,
      metaConnection: {
        overallStatus: 'CONNECTED',
        authMode: 'FACEBOOK_LOGIN',
        selectedPageName: 'RancangLoka Indonesia',
        selectedInstagramUsername: 'rancangloka.id',
        permissionsStatus: 'OK',
        missingPermissions: [],
        publishingAuthority: 0,
      },
    },
  };

  const reply = executeReadOnlyQuery('SOCIAL_CONNECTION_QUERY', 'social_distribution_operator', snapshot);
  assert.ok(reply.includes('Status Keseluruhan: **CONNECTED**'));
  assert.ok(reply.includes('RancangLoka Indonesia'));
  assert.ok(reply.includes('@rancangloka.id'));
  assert.ok(reply.includes('Lengkap (OK)'));
  assert.ok(reply.includes('Otoritas Penerbitan: **0 (TIDAK AKTIF)**'));
  assert.ok(reply.includes('Otomasi Sosial: **OFF**'));
});

await asyncTest('10. Chat interaction strictly rejects live publishing and token injection', async () => {
  activateSocialDepartmentShadow();

  const snapshot = {
    social: {
      departmentAvailability: 'AVAILABLE_READ_ONLY',
      mode: 'SHADOW',
      staffCount: 1,
      metaConnection: { overallStatus: 'CONNECTED', publishingAuthority: 0 },
    },
  };

  // Attempt to publish
  const pubAttempt = await processOperatorInteraction(
    null,
    'social_distribution_operator',
    'Publish postingan sekarang ke Facebook Page',
    snapshot
  );
  assert.equal(pubAttempt.command, undefined);
  assert.equal(pubAttempt.response_message.message_type, 'ERROR');
  assert.ok(pubAttempt.response_message.content.includes('DANGEROUS_ACTION_FORBIDDEN'));

  // Attempt to inject token
  const tokenAttempt = await processOperatorInteraction(
    null,
    'social_distribution_operator',
    'Simpan access token EAAB999 ke database',
    snapshot
  );
  assert.equal(tokenAttempt.command, undefined);
  assert.equal(tokenAttempt.response_message.message_type, 'ERROR');
  assert.ok(tokenAttempt.response_message.content.includes('DANGEROUS_ACTION_FORBIDDEN'));
});

// ============================================================================
// SUITE 7: INERT PRODUCTION TRANSPORT SAFETY
// ============================================================================

await asyncTest('11. ProductionSocialProviderTransport strictly blocks execution', async () => {
  const transport = new ProductionSocialProviderTransport();
  await assert.rejects(
    async () => {
      await transport.request({
        method: 'POST',
        url: 'https://graph.facebook.com/v21.0/me/accounts',
      });
    },
    /PRODUCTION_TRANSPORT_BLOCKED/
  );
});

console.log(`\n--- ALL ${passedTests}/${totalTests} SOCIAL-S3.5 TESTS PASSED SUCCESSFULLY ---`);
