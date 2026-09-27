/**
 * RancangLoka — MEDIA-A5.7-P2A Canonical Device Auth Lifecycle Test Suite
 *
 * Deterministic test coverage:
 * 1.  Token generation entropy (>= 256 bits, lkmd_ prefix, 64 hex characters)
 * 2.  Register device successfully returns plaintext token ONCE
 * 3.  Plaintext token is NEVER persisted in database (hash only)
 * 4.  Database contains SHA-256 hash matching token
 * 5.  Authenticate request using valid registered device succeeds
 * 6.  Authenticate request with invalid / wrong token fails (401)
 * 7.  Authenticate request with missing token fails (401)
 * 8.  Authenticate request with forbidden scope fails (403)
 * 9.  Authenticate request with invalid scope fails (403)
 * 10. Duplicate registration with same active device_id returns conflict (409)
 * 11. Revoke active device transitions status to REVOKED
 * 12. Double revocation is safe, idempotent, and non-destructive
 * 13. Authenticate with revoked token is immediately rejected fail-closed (401)
 * 14. Revoked token does NOT fall through to dev bypass or environment fallback
 * 15. getMediaDevice returns safe metadata (no token, no hash)
 * 16. listMediaDevices returns safe collection without credentials
 * 17. Ephemeral canary probe registration & revocation helpers lifecycle
 * 18. HTTP API GET /api/internal/v1/media/devices requires operator auth
 * 19. HTTP API GET /api/internal/v1/media/devices with media device token rejected (403)
 * 20. HTTP API POST /api/internal/v1/media/devices registers device with operator session
 * 21. HTTP API POST /api/internal/v1/media/devices with media device token rejected (403 MEDIA_DEVICE_FORBIDDEN)
 * 22. HTTP API POST /api/internal/v1/media/devices duplicate registration returns 409
 * 23. HTTP API GET /api/internal/v1/media/devices/[device_id] returns metadata with operator session
 * 24. HTTP API DELETE /api/internal/v1/media/devices/[device_id] revokes device with operator session
 * 25. HTTP API DELETE /api/internal/v1/media/devices/[device_id] with media device token rejected (403)
 * 26. Second HTTP DELETE is idempotent (200, already revoked)
 * 27. Plaintext token is never present in console log outputs
 */

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  generateDeviceToken,
  hashToken,
  registerMediaDevice,
  revokeMediaDevice,
  getMediaDevice,
  listMediaDevices,
  registerCanaryEphemeralDevice,
  revokeCanaryEphemeralDevice,
  authenticateDeviceRequest,
  CANARY_EPHEMERAL_DEVICE_ID,
  CANARY_EPHEMERAL_DEVICE_NAME,
  ALLOWED_MEDIA_SCOPES,
  FORBIDDEN_SCOPES
} from '../src/lib/media/device-auth.ts';

import {
  createAdminSessionToken
} from '../src/lib/auth.ts';

import {
  GET as listDevicesHandler,
  POST as registerDeviceHandler,
  ALL as devicesMethodHandler
} from '../src/pages/api/internal/v1/media/devices/index.ts';

import {
  GET as getDeviceHandler,
  DELETE as revokeDeviceDeleteHandler,
  POST as revokeDevicePostHandler
} from '../src/pages/api/internal/v1/media/devices/[device_id].ts';

// ---------------------------------------------------------------------------
// 0. Network & Provider Call Firewall
// ---------------------------------------------------------------------------
let realProviderCalls = 0;
let falApiCalls = 0;
let metaApiCalls = 0;

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, ...args) => {
  const urlStr = String(input);
  if (urlStr.includes('fal.ai')) falApiCalls++;
  if (urlStr.includes('facebook') || urlStr.includes('graph.meta') || urlStr.includes('instagram')) metaApiCalls++;
  realProviderCalls++;
  throw new Error(`FIREWALL_BREACH: Real network call blocked: ${urlStr}`);
};

let testCount = 0;
function pass(name) {
  testCount++;
  console.log(`  [PASS ${String(testCount).padStart(2, '0')}] ${name}`);
}

// Intercept console.info to verify plaintext token is never logged
let capturedLogs = [];
const originalConsoleInfo = console.info;
console.info = (...args) => {
  const joined = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  capturedLogs.push(joined);
  originalConsoleInfo(...args);
};

function createTestDatabase() {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE media_devices (
      device_id TEXT PRIMARY KEY,
      device_name TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'media:device',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK (status IN ('ACTIVE', 'REVOKED'))
    );
  `);

  return {
    _raw: db,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...params) {
          this._params = params;
          return this;
        },
        async first() {
          const stmt = db.prepare(this._sql);
          return stmt.get(...this._params) || null;
        },
        async all() {
          const stmt = db.prepare(this._sql);
          return { results: stmt.all(...this._params) };
        },
        async run() {
          const stmt = db.prepare(this._sql);
          const info = stmt.run(...this._params);
          return {
            meta: {
              changes: info.changes,
              last_row_id: Number(info.lastInsertRowid)
            }
          };
        }
      };
    }
  };
}

async function runAllTests() {
  console.log('=============================================================');
  console.log('  RancangLoka — MEDIA-A5.7-P2A Device Auth Lifecycle Tests   ');
  console.log('=============================================================\n');

  const db = createTestDatabase();
  const testEnv = {
    ENVIRONMENT: 'development',
    RANCANGLOKA_ADMIN_SESSION_SECRET: 'test-session-secret-at-least-32-chars-long-12345'
  };

  // 1. Token Generation Entropy & Format
  const token = generateDeviceToken();
  assert.ok(token.startsWith('lkmd_'), 'Token must start with lkmd_ prefix');
  const tokenHex = token.slice(5);
  assert.equal(tokenHex.length, 64, 'Token must contain 64 hex characters (32 bytes = 256 bits entropy)');
  assert.match(tokenHex, /^[0-9a-f]{64}$/, 'Token hex must be lowercase hexadecimal');
  pass('Device token generation yields >= 256 bits entropy with lkmd_ prefix');

  // 2. Register device successfully
  const reg1 = await registerMediaDevice(db, {
    deviceId: 'dev_test_probe_01',
    deviceName: 'Test Probe 01',
    scope: 'media:device',
    actorId: 'test_operator'
  });
  assert.equal(reg1.success, true, 'Registration must succeed');
  assert.equal(reg1.deviceId, 'dev_test_probe_01');
  assert.equal(reg1.deviceName, 'Test Probe 01');
  assert.equal(reg1.scope, 'media:device');
  assert.equal(reg1.status, 'ACTIVE');
  assert.ok(reg1.rawToken && reg1.rawToken.startsWith('lkmd_'), 'Plaintext token returned on registration');
  pass('registerMediaDevice succeeds and returns plaintext token');

  // 3. Plaintext token is NOT persisted in DB; hash only
  const dbRow = db._raw.prepare('SELECT * FROM media_devices WHERE device_id = ?').get('dev_test_probe_01');
  assert.ok(dbRow, 'Row must exist in media_devices table');
  assert.notEqual(dbRow.token_hash, reg1.rawToken, 'Database must NOT store plaintext token');
  assert.equal(dbRow.token_hash.length, 64, 'Stored token_hash must be SHA-256 (64 hex characters)');
  pass('Plaintext token is never persisted in database (hash only)');

  // 4. Stored hash matches SHA-256 of raw token
  const expectedHash = await hashToken(reg1.rawToken);
  assert.equal(dbRow.token_hash, expectedHash, 'Stored token_hash matches SHA-256 of raw token');
  pass('Database token_hash exactly matches SHA-256 digest of plaintext token');

  // 5. Authenticate with valid registered device
  const req1 = new Request('https://rancangloka.com/api/internal/v1/media/jobs/run-next', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${reg1.rawToken}`,
      'X-RL-Scope': 'media:device'
    }
  });
  const auth1 = await authenticateDeviceRequest(req1, db, testEnv);
  assert.equal(auth1.authenticated, true, 'Authentication must succeed with valid token');
  assert.equal(auth1.deviceId, 'dev_test_probe_01');
  assert.equal(auth1.scope, 'media:device');
  pass('authenticateDeviceRequest succeeds with valid registered token');

  // 6. Authenticate with wrong token fails
  const reqWrong = new Request('https://rancangloka.com/api/internal/v1/media/jobs/run-next', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer lkmd_0000000000000000000000000000000000000000000000000000000000000000',
      'X-RL-Scope': 'media:device'
    }
  });
  // Without dev bypass matching: let testEnv have an expectedKey set so it doesn't bypass
  const authWrong = await authenticateDeviceRequest(reqWrong, db, { ...testEnv, LOKAMEDIA_DEVICE_TOKEN: 'prod_env_key' });
  assert.equal(authWrong.authenticated, false);
  assert.equal(authWrong.statusCode, 401);
  pass('authenticateDeviceRequest rejects invalid/unregistered token (401)');

  // 7. Authenticate with missing token fails
  const reqMissing = new Request('https://rancangloka.com/api/internal/v1/media/jobs/run-next', {
    method: 'POST'
  });
  const authMissing = await authenticateDeviceRequest(reqMissing, db, testEnv);
  assert.equal(authMissing.authenticated, false);
  assert.equal(authMissing.statusCode, 401);
  pass('authenticateDeviceRequest rejects missing token (401)');

  // 8. Authenticate with forbidden scope fails
  const reqForbidden = new Request('https://rancangloka.com/api/internal/v1/media/jobs/run-next', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${reg1.rawToken}`,
      'X-RL-Scope': 'publish'
    }
  });
  const authForbidden = await authenticateDeviceRequest(reqForbidden, db, testEnv);
  assert.equal(authForbidden.authenticated, false);
  assert.equal(authForbidden.statusCode, 403);
  pass('authenticateDeviceRequest rejects forbidden scope (publish -> 403)');

  // 9. Authenticate with disallowed media scope fails
  const reqDisallowed = new Request('https://rancangloka.com/api/internal/v1/media/jobs/run-next', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${reg1.rawToken}`,
      'X-RL-Scope': 'super_admin'
    }
  });
  const authDisallowed = await authenticateDeviceRequest(reqDisallowed, db, { ...testEnv, LOKAMEDIA_DEVICE_TOKEN: 'prod_env_key' });
  assert.equal(authDisallowed.authenticated, false);
  pass('authenticateDeviceRequest rejects disallowed scope');

  // 10. Duplicate registration with same device_id returns conflict (409)
  const regDup = await registerMediaDevice(db, {
    deviceId: 'dev_test_probe_01',
    deviceName: 'Duplicate Probe',
    scope: 'media:device'
  });
  assert.equal(regDup.success, false);
  assert.equal(regDup.conflict, true);
  assert.ok(regDup.error.includes('already exists'));
  pass('registerMediaDevice rejects duplicate registration with conflict (409)');

  // 11. Revoke active device
  const rev1 = await revokeMediaDevice(db, {
    deviceId: 'dev_test_probe_01',
    actorId: 'test_operator',
    reason: 'P2 verification complete'
  });
  assert.equal(rev1.success, true);
  assert.equal(rev1.revoked, true);
  assert.equal(rev1.status, 'REVOKED');
  assert.equal(rev1.previousStatus, 'ACTIVE');

  const dbRevRow = db._raw.prepare('SELECT status FROM media_devices WHERE device_id = ?').get('dev_test_probe_01');
  assert.equal(dbRevRow.status, 'REVOKED');
  pass('revokeMediaDevice transitions device status to REVOKED');

  // 12. Double revocation is idempotent and safe
  const rev2 = await revokeMediaDevice(db, {
    deviceId: 'dev_test_probe_01',
    actorId: 'test_operator',
    reason: 'Duplicate revocation check'
  });
  assert.equal(rev2.success, true);
  assert.equal(rev2.revoked, false);
  assert.equal(rev2.status, 'REVOKED');
  assert.equal(rev2.previousStatus, 'REVOKED');
  pass('revokeMediaDevice is safe and idempotent on repeated invocation');

  // 13. Authenticate with revoked token is immediately rejected fail-closed
  const reqAfterRevoke = new Request('https://rancangloka.com/api/internal/v1/media/jobs/run-next', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${reg1.rawToken}`,
      'X-RL-Scope': 'media:device'
    }
  });
  const authAfterRevoke = await authenticateDeviceRequest(reqAfterRevoke, db, testEnv);
  assert.equal(authAfterRevoke.authenticated, false, 'Revoked token must NOT authenticate');
  assert.equal(authAfterRevoke.statusCode, 401, 'Revoked token returns 401');
  assert.ok(authAfterRevoke.error.includes('telah dicabut') || authAfterRevoke.error.includes('tidak valid'));
  pass('authenticateDeviceRequest strictly rejects revoked device token (401 fail-closed)');

  // 14. Revoked token does NOT fall through to dev bypass even if no env secret is set
  const authDevBypassFail = await authenticateDeviceRequest(reqAfterRevoke, db, {});
  assert.equal(authDevBypassFail.authenticated, false, 'Revoked token must never fall through to dev bypass');
  assert.equal(authDevBypassFail.statusCode, 401);
  pass('Revoked token fail-closed firewall prevents fallthrough to dev bypass');

  // 15. getMediaDevice returns safe metadata
  const devMeta = await getMediaDevice(db, 'dev_test_probe_01');
  assert.ok(devMeta);
  assert.equal(devMeta.deviceId, 'dev_test_probe_01');
  assert.equal(devMeta.status, 'REVOKED');
  assert.equal(devMeta.token_hash, undefined, 'token_hash must NOT be present in safe metadata');
  pass('getMediaDevice returns clean metadata without credential material');

  // 16. listMediaDevices returns safe collection
  const devList = await listMediaDevices(db);
  assert.ok(Array.isArray(devList));
  assert.equal(devList.length, 1);
  assert.equal(devList[0].deviceId, 'dev_test_probe_01');
  assert.equal(devList[0].token_hash, undefined, 'token_hash must NOT be present in list response');
  pass('listMediaDevices returns list of devices with credentials omitted');

  // 17. Ephemeral canary probe lifecycle helpers
  const canaryReg = await registerCanaryEphemeralDevice(db, 'p2_test');
  assert.equal(canaryReg.success, true);
  assert.equal(canaryReg.deviceId, CANARY_EPHEMERAL_DEVICE_ID);
  assert.equal(canaryReg.deviceName, CANARY_EPHEMERAL_DEVICE_NAME);

  const canaryMeta = await getMediaDevice(db, CANARY_EPHEMERAL_DEVICE_ID);
  assert.equal(canaryMeta.status, 'ACTIVE');

  const canaryRev = await revokeCanaryEphemeralDevice(db, 'p2_test');
  assert.equal(canaryRev.success, true);
  assert.equal(canaryRev.revoked, true);

  const canaryMetaRev = await getMediaDevice(db, CANARY_EPHEMERAL_DEVICE_ID);
  assert.equal(canaryMetaRev.status, 'REVOKED');
  pass('Canary ephemeral probe lifecycle (register -> verify ACTIVE -> revoke -> REVOKED)');

  // -------------------------------------------------------------------------
  // HTTP Endpoint Tests: /api/internal/v1/media/devices
  // -------------------------------------------------------------------------

  // Create valid operator session token
  const operatorSessionToken = await createAdminSessionToken(testEnv);

  // 18. GET /api/internal/v1/media/devices requires operator auth
  const httpReqListNoAuth = new Request('https://rancangloka.com/api/internal/v1/media/devices');
  const httpResListNoAuth = await listDevicesHandler({
    request: httpReqListNoAuth,
    locals: { db, runtime: { env: testEnv } }
  });
  assert.equal(httpResListNoAuth.status, 401, 'Unauthenticated GET /devices must return 401');
  pass('GET /api/internal/v1/media/devices without operator auth rejected (401)');

  // 19. GET /api/internal/v1/media/devices with media device token rejected (403)
  const httpReqListDeviceToken = new Request('https://rancangloka.com/api/internal/v1/media/devices', {
    headers: {
      'Authorization': `Bearer ${canaryReg.rawToken}`
    }
  });
  const httpResListDeviceToken = await listDevicesHandler({
    request: httpReqListDeviceToken,
    locals: { db, runtime: { env: testEnv } }
  });
  assert.equal(httpResListDeviceToken.status, 403, 'Media device token must return 403 MEDIA_DEVICE_FORBIDDEN');
  const bodyListDevice = await httpResListDeviceToken.json();
  assert.equal(bodyListDevice.code, 'MEDIA_DEVICE_FORBIDDEN');
  pass('GET /api/internal/v1/media/devices with media device token strictly rejected (403)');

  // 20. POST /api/internal/v1/media/devices registers device with operator session
  const httpReqReg = new Request('https://rancangloka.com/api/internal/v1/media/devices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${operatorSessionToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      device_id: 'dev_api_probe_01',
      device_name: 'API Probe 01',
      scope: 'media:device'
    })
  });
  const httpResReg = await registerDeviceHandler({
    request: httpReqReg,
    locals: { db, runtime: { env: testEnv } }
  });
  assert.equal(httpResReg.status, 201, 'Operator session must successfully register device (201)');
  const bodyReg = await httpResReg.json();
  assert.equal(bodyReg.status, 'success');
  assert.equal(bodyReg.device.device_id, 'dev_api_probe_01');
  assert.ok(bodyReg.device.token && bodyReg.device.token.startsWith('lkmd_'), 'Plaintext token returned once in API response');
  pass('POST /api/internal/v1/media/devices successfully provisions device (201)');

  // 21. POST /api/internal/v1/media/devices with media device token rejected (403) - Zero self-provisioning loop
  const httpReqSelfProv = new Request('https://rancangloka.com/api/internal/v1/media/devices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${bodyReg.device.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      device_id: 'dev_malicious_child',
      device_name: 'Malicious Child Device'
    })
  });
  const httpResSelfProv = await registerDeviceHandler({
    request: httpReqSelfProv,
    locals: { db, runtime: { env: testEnv } }
  });
  assert.equal(httpResSelfProv.status, 403, 'Media device must NOT be allowed to self-provision (403)');
  const bodySelfProv = await httpResSelfProv.json();
  assert.equal(bodySelfProv.code, 'MEDIA_DEVICE_FORBIDDEN');
  pass('Media device credential strictly forbidden from self-provisioning other devices (403)');

  // 22. POST /api/internal/v1/media/devices duplicate registration returns 409
  const httpReqRegDup = new Request('https://rancangloka.com/api/internal/v1/media/devices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${operatorSessionToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      device_id: 'dev_api_probe_01',
      device_name: 'API Probe 01 Duplicate'
    })
  });
  const httpResRegDup = await registerDeviceHandler({
    request: httpReqRegDup,
    locals: { db, runtime: { env: testEnv } }
  });
  assert.equal(httpResRegDup.status, 409, 'Duplicate device ID must return 409 Conflict');
  pass('POST /api/internal/v1/media/devices returns 409 on duplicate registration');

  // 23. GET /api/internal/v1/media/devices/[device_id] returns metadata with operator session
  const httpReqGet = new Request('https://rancangloka.com/api/internal/v1/media/devices/dev_api_probe_01', {
    headers: {
      'Authorization': `Bearer ${operatorSessionToken}`
    }
  });
  const httpResGet = await getDeviceHandler({
    params: { device_id: 'dev_api_probe_01' },
    request: httpReqGet,
    locals: { db, runtime: { env: testEnv } }
  });
  assert.equal(httpResGet.status, 200);
  const bodyGet = await httpResGet.json();
  assert.equal(bodyGet.device.device_id, 'dev_api_probe_01');
  assert.equal(bodyGet.device.status, 'ACTIVE');
  assert.equal(bodyGet.device.token, undefined);
  pass('GET /api/internal/v1/media/devices/[device_id] returns clean metadata');

  // 24. DELETE /api/internal/v1/media/devices/[device_id] revokes device with operator session
  const httpReqDel = new Request('https://rancangloka.com/api/internal/v1/media/devices/dev_api_probe_01', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${operatorSessionToken}`
    }
  });
  const httpResDel = await revokeDeviceDeleteHandler({
    params: { device_id: 'dev_api_probe_01' },
    request: httpReqDel,
    locals: { db, runtime: { env: testEnv } }
  });
  assert.equal(httpResDel.status, 200);
  const bodyDel = await httpResDel.json();
  assert.equal(bodyDel.revoked, true);
  pass('DELETE /api/internal/v1/media/devices/[device_id] revokes device (200)');

  // 25. DELETE /api/internal/v1/media/devices/[device_id] with media device token rejected (403)
  const httpReqDelDevice = new Request('https://rancangloka.com/api/internal/v1/media/devices/dev_api_probe_01', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${bodyReg.device.token}`
    }
  });
  const httpResDelDevice = await revokeDeviceDeleteHandler({
    params: { device_id: 'dev_api_probe_01' },
    request: httpReqDelDevice,
    locals: { db, runtime: { env: testEnv } }
  });
  assert.equal(httpResDelDevice.status, 403);
  pass('DELETE /api/internal/v1/media/devices/[device_id] rejects media device token (403)');

  // 26. Second DELETE is idempotent (200, revoked: false)
  const httpReqDel2 = new Request('https://rancangloka.com/api/internal/v1/media/devices/dev_api_probe_01', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${operatorSessionToken}`
    }
  });
  const httpResDel2 = await revokeDeviceDeleteHandler({
    params: { device_id: 'dev_api_probe_01' },
    request: httpReqDel2,
    locals: { db, runtime: { env: testEnv } }
  });
  assert.equal(httpResDel2.status, 200);
  const bodyDel2 = await httpResDel2.json();
  assert.equal(bodyDel2.revoked, false);
  assert.equal(bodyDel2.status_code, 'REVOKED');
  pass('Repeated DELETE /api/internal/v1/media/devices/[device_id] is idempotent (200)');

  // 27. Plaintext token is never present in console logs
  for (const logLine of capturedLogs) {
    if (reg1.rawToken) {
      assert.ok(!logLine.includes(reg1.rawToken), `CRITICAL LEAK: Plaintext token found in log: ${logLine}`);
    }
    if (bodyReg?.device?.token) {
      assert.ok(!logLine.includes(bodyReg.device.token), `CRITICAL LEAK: Plaintext token found in log: ${logLine}`);
    }
    if (canaryReg?.rawToken) {
      assert.ok(!logLine.includes(canaryReg.rawToken), `CRITICAL LEAK: Plaintext token found in log: ${logLine}`);
    }
  }
  pass('Zero plaintext token leaks in logging output');

  // Verify Zero Provider Calls
  assert.equal(realProviderCalls, 0, 'ZERO external provider calls permitted');
  assert.equal(falApiCalls, 0, 'ZERO fal.ai calls permitted');
  assert.equal(metaApiCalls, 0, 'ZERO Meta calls permitted');
  pass('Zero provider calls firewall verified (0 fal.ai, 0 Meta, 0 external fetch)');

  console.log('\n=============================================================');
  console.log(`  ALL ${testCount} MEDIA DEVICE LIFECYCLE TESTS PASSED!`);
  console.log('=============================================================');
}

runAllTests().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
