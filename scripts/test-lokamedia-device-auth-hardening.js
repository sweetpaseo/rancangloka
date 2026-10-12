/**
 * RANCANGLOKA — LOKAMEDIA DEVICE AUTH HARDENING NEGATIVE SECURITY SUITE
 *
 * Verifies:
 * A. Random lkmd_<random> token => 401
 * B. Random test_<random> token => 401
 * C. Valid ACTIVE D1 token => authenticated exact device row
 * D. Valid token for REVOKED row => 401/403 fail closed
 * E. No runtime branch returns dev_test_harness from token prefix
 * F. Device ID supplied by client cannot override token-derived identity (DEVICE_IDENTITY_MISMATCH)
 * G. Promotion request records exact authenticated D1 device identity
 * H. Production source & build contains no test-token prefix bypass string/behavior
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { authenticateDeviceRequest, hashToken } from '../src/lib/media/device-auth.ts';
import { POST as promotionRequestPost } from '../src/pages/api/internal/v1/media/promotions/request.ts';
import { GET as articleResolveGet } from '../src/pages/api/internal/v1/media/articles/resolve.ts';
import { POST as assetUploadPost } from '../src/pages/api/internal/v1/media/assets/upload.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

function createMockDb(initialDevices = [], initialArticles = []) {
  const devices = new Map(initialDevices.map((d) => [d.token_hash, d]));
  const articles = new Map(initialArticles.map((a) => [a.slug, a]));
  const promotionApprovals = new Map();

  return {
    devices,
    articles,
    promotionApprovals,
    async exec() { return { success: true }; },
    prepare(query) {
      const q = query.trim().replace(/\s+/g, ' ');
      return {
        bind(...params) {
          return {
            async first() {
              if (q.includes('FROM media_devices WHERE token_hash = ?')) {
                const hash = params[0];
                return devices.get(hash) || null;
              }
              if (q.includes('FROM articles WHERE slug = ?')) {
                const slug = params[0];
                return articles.get(slug) || null;
              }
              if (q.includes('FROM articles WHERE id = ?')) {
                const id = params[0];
                for (const art of articles.values()) {
                  if (art.id === id) return art;
                }
                return null;
              }
              return null;
            },
            async run() {
              if (q.includes('INSERT INTO media_promotion_approvals')) {
                // params: approval_id, device_id, article_id, article_slug, content_hash, ...
                const [approval_id, device_id, article_id, article_slug, content_hash, candidate_sha256, slot_key] = params;
                const rec = { approval_id, device_id, article_id, article_slug, content_hash, candidate_sha256, slot_key, status: 'REQUESTED' };
                promotionApprovals.set(approval_id, rec);
                return { success: true, changes: 1 };
              }
              return { success: true, changes: 1 };
            },
            async all() {
              return { results: [] };
            }
          };
        }
      };
    }
  };
}

async function runTests() {
  console.log('--- LOKAMEDIA DEVICE AUTH HARDENING NEGATIVE SECURITY SUITE ---');

  // Test A: Random lkmd_<random> token => 401
  {
    const mockDb = createMockDb();
    const randomToken = `lkmd_${crypto.randomBytes(16).toString('hex')}`;
    const req = new Request('http://localhost:4321/api/internal/v1/media/test', {
      headers: { Authorization: `Bearer ${randomToken}`, 'x-rl-scope': 'media:device' }
    });

    const auth = await authenticateDeviceRequest(req, mockDb, {});
    assert.equal(auth.authenticated, false);
    assert.equal(auth.statusCode, 401);
    assert(auth.error.includes('tidak valid'));
    pass('A. Random lkmd_<random> token fails with 401 and zero bypass');
  }

  // Test B: Random test_<random> token => 401
  {
    const mockDb = createMockDb();
    const randomToken = `test_${crypto.randomBytes(16).toString('hex')}`;
    const req = new Request('http://localhost:4321/api/internal/v1/media/test', {
      headers: { Authorization: `Bearer ${randomToken}`, 'x-rl-scope': 'media:device' }
    });

    const auth = await authenticateDeviceRequest(req, mockDb, {});
    assert.equal(auth.authenticated, false);
    assert.equal(auth.statusCode, 401);
    assert(auth.error.includes('tidak valid'));
    pass('B. Random test_<random> token fails with 401 and zero bypass');
  }

  // Test C: Valid ACTIVE D1 token => authenticated exact device row
  {
    const genuineToken = `token_genuine_${crypto.randomBytes(16).toString('hex')}`;
    const genuineHash = await hashToken(genuineToken);
    const mockDevice = {
      device_id: 'dev_local_human_operator_v3',
      device_name: 'Local Human Acceptance Operator V3',
      token_hash: genuineHash,
      scope: 'media:device',
      status: 'ACTIVE'
    };

    const mockDb = createMockDb([mockDevice]);
    const req = new Request('http://localhost:4321/api/internal/v1/media/test', {
      headers: { Authorization: `Bearer ${genuineToken}`, 'x-rl-scope': 'media:device' }
    });

    const auth = await authenticateDeviceRequest(req, mockDb, {});
    assert.equal(auth.authenticated, true);
    assert.equal(auth.deviceId, 'dev_local_human_operator_v3');
    assert.equal(auth.scope, 'media:device');
    pass('C. Valid ACTIVE D1 token authenticates exact device row without substitution');
  }

  // Test D: Valid token for REVOKED row => 401 fail closed
  {
    const revokedToken = `token_revoked_${crypto.randomBytes(16).toString('hex')}`;
    const revokedHash = await hashToken(revokedToken);
    const mockDevice = {
      device_id: 'dev_local_human_operator_v2',
      device_name: 'Revoked Device',
      token_hash: revokedHash,
      scope: 'media:device',
      status: 'REVOKED'
    };

    const mockDb = createMockDb([mockDevice]);
    const req = new Request('http://localhost:4321/api/internal/v1/media/test', {
      headers: { Authorization: `Bearer ${revokedToken}`, 'x-rl-scope': 'media:device' }
    });

    const auth = await authenticateDeviceRequest(req, mockDb, {});
    assert.equal(auth.authenticated, false);
    assert.equal(auth.statusCode, 401);
    assert.equal(auth.deviceId, 'dev_local_human_operator_v2');
    pass('D. Valid token for REVOKED row fails closed immediately');
  }

  // Test E: No runtime branch returns dev_test_harness from token prefix
  {
    const testPrefixes = [
      'lkmd_',
      'lkmd_12345',
      'test_',
      'test_operator',
      'staging-media-token'
    ];

    const mockDb = createMockDb();
    for (const prefix of testPrefixes) {
      const req = new Request('http://localhost:4321/api/internal/v1/media/test', {
        headers: { Authorization: `Bearer ${prefix}`, 'x-rl-scope': 'media:device' }
      });
      const auth = await authenticateDeviceRequest(req, mockDb, {});
      assert.notEqual(auth.deviceId, 'dev_test_harness', `Prefix ${prefix} must NOT yield dev_test_harness`);
      assert.equal(auth.authenticated, false, `Prefix ${prefix} must NOT be accepted`);
    }
    pass('E. No runtime branch returns dev_test_harness from token prefix');
  }

  // Test F: Device ID supplied by client cannot override token-derived identity (DEVICE_IDENTITY_MISMATCH)
  {
    const genuineToken = `token_genuine_${crypto.randomBytes(16).toString('hex')}`;
    const genuineHash = await hashToken(genuineToken);
    const mockDevice = {
      device_id: 'dev_local_human_operator_v3',
      device_name: 'Genuine Device',
      token_hash: genuineHash,
      scope: 'media:device',
      status: 'ACTIVE'
    };

    const canaryArticle = {
      id: 16,
      slug: 'lokamedia-manual-promotion-canary-human-local-only',
      title: 'Canary Article',
      status: 'published',
      content_hash: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5'
    };

    const mockDb = createMockDb([mockDevice], [canaryArticle]);

    // Client sends spoofed device_id: 'dev_attacker_spoofed' in promotion request body
    const spoofedBody = JSON.stringify({
      article_slug: canaryArticle.slug,
      candidate_sha256: 'fe52ca8268d320f2c15e9082766dc0bcfce5763603796b8cf590e27e2c3af07e',
      slot_key: 'featured',
      device_id: 'dev_attacker_spoofed' // Deliberate spoof attempt
    });

    const spoofReq = new Request('http://localhost:4321/api/internal/v1/media/promotions/request', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${genuineToken}`,
        'Content-Type': 'application/json',
        'x-rl-scope': 'media:device'
      },
      body: spoofedBody
    });

    const res = await promotionRequestPost({ request: spoofReq, locals: { db: mockDb, runtime: { env: { DB: mockDb } } } });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, 'DEVICE_IDENTITY_MISMATCH');
    assert((body.message || body.error).includes('tidak cocok'));

    // Also test resolve endpoint with spoofed device_id query param
    const resolveSpoofReq = new Request(`http://localhost:4321/api/internal/v1/media/articles/resolve?slug=${canaryArticle.slug}&device_id=dev_attacker_spoofed`, {
      headers: { Authorization: `Bearer ${genuineToken}`, 'x-rl-scope': 'media:device' }
    });
    const resolveRes = await articleResolveGet({ request: resolveSpoofReq, locals: { db: mockDb, runtime: { env: { DB: mockDb } } } });
    assert.equal(resolveRes.status, 403);
    const resolveBody = await resolveRes.json();
    assert.equal(resolveBody.code, 'DEVICE_IDENTITY_MISMATCH');
    assert((resolveBody.message || resolveBody.error).includes('tidak cocok'));

    pass('F. Client-supplied device_id mismatch fails closed with 403 DEVICE_IDENTITY_MISMATCH');
  }

  // Test G: Promotion request records exact authenticated D1 device identity
  {
    const genuineToken = `token_genuine_g_${crypto.randomBytes(16).toString('hex')}`;
    const genuineHash = await hashToken(genuineToken);
    const mockDevice = {
      device_id: 'dev_local_human_operator_v3',
      device_name: 'Genuine Device',
      token_hash: genuineHash,
      scope: 'media:device',
      status: 'ACTIVE'
    };

    const canaryArticle = {
      id: 16,
      slug: 'lokamedia-manual-promotion-canary-human-local-only',
      title: 'Canary Article',
      status: 'published',
      content_hash: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5'
    };

    const mockDb = createMockDb([mockDevice], [canaryArticle]);

    // Request with matching or omitted client device_id
    const validBody = JSON.stringify({
      article_slug: canaryArticle.slug,
      candidate_sha256: 'fe52ca8268d320f2c15e9082766dc0bcfce5763603796b8cf590e27e2c3af07e',
      slot_key: 'featured',
      alt_text: 'Test canary featured alt text',
      device_id: 'dev_local_human_operator_v3'
    });

    const validReq = new Request('http://localhost:4321/api/internal/v1/media/promotions/request', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${genuineToken}`,
        'Content-Type': 'application/json',
        'x-rl-scope': 'media:device'
      },
      body: validBody
    });

    const res = await promotionRequestPost({ request: validReq, locals: { db: mockDb, runtime: { env: { DB: mockDb } } } });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.promotion_request.device_id, 'dev_local_human_operator_v3');
    pass('G. Promotion request records exact authenticated D1 device identity (dev_local_human_operator_v3)');
  }

  // Test H: Production source contains no test-token prefix bypass string/behavior
  {
    const sourceCode = fs.readFileSync(path.join(repoRoot, 'src', 'lib', 'media', 'device-auth.ts'), 'utf8');
    assert(!sourceCode.includes("token.startsWith('lkmd_')"), 'device-auth.ts must not contain lkmd_ prefix bypass');
    assert(!sourceCode.includes("token.startsWith('test_')"), 'device-auth.ts must not contain test_ prefix bypass');
    assert(!sourceCode.includes("'dev_test_harness'"), 'device-auth.ts must not contain dev_test_harness substitution');
    pass('H. Production runtime source verified clean of test-token prefix bypass logic');
  }

  console.log(`\nALL ${passed} NEGATIVE SECURITY TESTS PASSED.`);
}

runTests().catch((err) => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
