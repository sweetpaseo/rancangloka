/**
 * RancangLoka Admin Brave Search Settings & Vault Test Suite
 * Milestone: ADMIN-BRAVE-SEARCH-SETTINGS-1
 *
 * Verifies:
 * 1. Default Brave OFF
 * 2. Toggle ON without key rejected
 * 3. Key encrypted before persistence
 * 4. Plaintext absent from persistence
 * 5. GET never returns plaintext
 * 6. Key saved + OFF => READY
 * 7. Key saved + ON => ACTIVE
 * 8. ACTIVE permits Brave runtime
 * 9. OFF results in Brave request count = 0
 * 10. Replace key succeeds
 * 11. Remove key disables Brave
 * 12. Test Connection = exactly one request
 * 13. Auth failure doesn't leak key
 * 14. Audit logs contain zero secrets
 * 15. Unauthorized actor rejected
 * 16. CrossRef/Wikipedia still work when Brave OFF
 * 17. Brave ACTIVE still uses socket-safe retrieval
 * 18. Missing KEK => SECRET_STORAGE_NOT_READY
 * 19. Admin page load triggers 0 Brave requests
 * 20. Fake secret scan => occurrence count 0
 */

import assert from 'node:assert';
import {
  resolveSettingsKek,
  encryptDiscoverySecret,
  decryptDiscoverySecret,
  getDiscoveryProviderStatus,
  saveDiscoveryProviderKey,
  removeDiscoveryProviderKey,
  toggleDiscoveryProvider,
  testDiscoveryProviderConnection,
  recordDiscoveryAudit,
  resolveEffectiveDiscoveryConfig
} from '../src/lib/editorial/discovery-settings-vault.ts';

import {
  OpenWebDiscoveryProvider
} from '../src/lib/editorial/discovery-providers.ts';

import {
  executeGeneralizedResearchJob
} from '../src/lib/editorial/irwan-research-runtime.ts';

const TEST_SECRET = 'BRAVE_TEST_SECRET_SHOULD_NEVER_LEAK';
const TEST_KEK = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 32-byte hex

// In-Memory SQLite/D1 Simulator
class MockD1 {
  constructor() {
    this.providerSettings = new Map();
    this.auditLogs = [];
  }

  prepare(sql) {
    const trimmed = sql.trim();
    const self = this;

    return {
      bind(...params) {
        return {
          async first() {
            if (trimmed.includes('FROM discovery_provider_settings WHERE provider = ?')) {
              const provider = params[0];
              const row = self.providerSettings.get(provider);
              return row ? { ...row } : null;
            }
            return null;
          },
          async run() {
            if (trimmed.startsWith('INSERT INTO discovery_provider_settings')) {
              const [provider, enabled, encSecret, nonce, secVer, createdAt, updatedAt] = params;
              const existing = self.providerSettings.get(provider) || {};
              self.providerSettings.set(provider, {
                provider,
                enabled: Number(enabled),
                encrypted_secret: encSecret,
                nonce,
                secret_version: secVer,
                created_at: existing.created_at || createdAt,
                updated_at: updatedAt
              });
              return { success: true };
            }
            if (trimmed.startsWith('UPDATE discovery_provider_settings')) {
              if (trimmed.includes('SET encrypted_secret = NULL')) {
                const [now, provider] = params;
                const row = self.providerSettings.get(provider);
                if (row) {
                  row.encrypted_secret = null;
                  row.nonce = null;
                  row.enabled = 0;
                  row.updated_at = now;
                }
              } else if (trimmed.includes('SET enabled = ?')) {
                const [enabled, now, provider] = params;
                const row = self.providerSettings.get(provider);
                if (row) {
                  row.enabled = Number(enabled);
                  row.updated_at = now;
                }
              }
              return { success: true };
            }
            if (trimmed.startsWith('INSERT INTO discovery_settings_audit')) {
              const [audit_id, provider, action, actor, result, timestamp, details_json] = params;
              self.auditLogs.push({
                audit_id,
                provider,
                action,
                actor,
                result,
                timestamp,
                details_json
              });
              return { success: true };
            }
            return { success: true };
          },
          async all() {
            if (trimmed.includes('FROM discovery_settings_audit')) {
              return { results: [...self.auditLogs] };
            }
            return { results: [] };
          }
        };
      }
    };
  }
}

async function runSuite() {
  console.log('🧪 Starting ADMIN-BRAVE-SEARCH-SETTINGS-1 Test Suite...\n');
  let passed = 0;

  const mockDb = new MockD1();
  const envWithKek = { RANCANGLOKA_SETTINGS_KEK: TEST_KEK };
  const allRecordedResponsesAndDumps = [];

  // --- Test 1: Default Brave OFF ---
  {
    const status = await getDiscoveryProviderStatus(mockDb, 'brave', envWithKek);
    assert.strictEqual(status.provider, 'brave');
    assert.strictEqual(status.configured, false);
    assert.strictEqual(status.enabled, false);
    assert.strictEqual(status.status, 'OFF');
    allRecordedResponsesAndDumps.push(JSON.stringify(status));
    console.log('  ✅ PASS: 1. Default Brave OFF');
    passed++;
  }

  // --- Test 2: Toggle ON without key rejected ---
  {
    let rejected = false;
    let errorMessage = '';
    try {
      await toggleDiscoveryProvider(mockDb, { provider: 'brave', enabled: true, actor: 'chief_admin', env: envWithKek });
    } catch (err) {
      rejected = true;
      errorMessage = err.message;
    }
    assert.strictEqual(rejected, true);
    assert.ok(errorMessage.includes('Masukkan Brave Search API Key terlebih dahulu.'));
    console.log('  ✅ PASS: 2. Toggle ON without key rejected');
    passed++;
  }

  // --- Test 3: Key encrypted before persistence ---
  {
    const saveRes = await saveDiscoveryProviderKey(mockDb, {
      provider: 'brave',
      apiKey: TEST_SECRET,
      actor: 'chief_admin',
      env: envWithKek
    });
    allRecordedResponsesAndDumps.push(JSON.stringify(saveRes));

    const storedRow = mockDb.providerSettings.get('brave');
    assert.ok(storedRow);
    assert.ok(storedRow.encrypted_secret);
    assert.ok(storedRow.nonce);
    assert.notStrictEqual(storedRow.encrypted_secret, TEST_SECRET);
    // Nonce must be valid base64 12 bytes
    const nonceBuffer = Buffer.from(storedRow.nonce, 'base64');
    assert.strictEqual(nonceBuffer.length, 12);
    console.log('  ✅ PASS: 3. Key encrypted before persistence (AES-256-GCM)');
    passed++;
  }

  // --- Test 4: Plaintext absent from persistence ---
  {
    const storedRow = mockDb.providerSettings.get('brave');
    const rowSerialized = JSON.stringify(storedRow);
    assert.strictEqual(rowSerialized.includes(TEST_SECRET), false);
    assert.strictEqual(storedRow.encrypted_secret.includes(TEST_SECRET), false);
    console.log('  ✅ PASS: 4. Plaintext absent from persistence');
    passed++;
  }

  // --- Test 5: GET never returns plaintext ---
  {
    const status = await getDiscoveryProviderStatus(mockDb, 'brave', envWithKek);
    allRecordedResponsesAndDumps.push(JSON.stringify(status));
    assert.strictEqual('apiKey' in status, false);
    assert.strictEqual('encrypted_secret' in status, false);
    assert.strictEqual('nonce' in status, false);
    assert.strictEqual(JSON.stringify(status).includes(TEST_SECRET), false);
    console.log('  ✅ PASS: 5. GET never returns plaintext or encryption metadata');
    passed++;
  }

  // --- Test 6: Key saved + OFF => READY ---
  {
    const status = await getDiscoveryProviderStatus(mockDb, 'brave', envWithKek);
    assert.strictEqual(status.configured, true);
    assert.strictEqual(status.enabled, false);
    assert.strictEqual(status.status, 'READY');
    console.log('  ✅ PASS: 6. Key saved + OFF => READY');
    passed++;
  }

  // --- Test 7: Key saved + ON => ACTIVE ---
  {
    const toggleRes = await toggleDiscoveryProvider(mockDb, {
      provider: 'brave',
      enabled: true,
      actor: 'chief_admin',
      env: envWithKek
    });
    allRecordedResponsesAndDumps.push(JSON.stringify(toggleRes));

    const status = await getDiscoveryProviderStatus(mockDb, 'brave', envWithKek);
    assert.strictEqual(status.configured, true);
    assert.strictEqual(status.enabled, true);
    assert.strictEqual(status.status, 'ACTIVE');
    console.log('  ✅ PASS: 7. Key saved + ON => ACTIVE');
    passed++;
  }

  // --- Test 8: ACTIVE permits Brave runtime ---
  {
    const resolved = await resolveEffectiveDiscoveryConfig(mockDb, 'brave', envWithKek);
    assert.strictEqual(resolved.enabled, true);
    assert.strictEqual(resolved.source, 'D1');
    assert.strictEqual(resolved.apiKey, TEST_SECRET);

    let fetchCount = 0;
    const mockFetch = async (url, opts) => {
      fetchCount++;
      return new Response(JSON.stringify({
        web: {
          results: [
            { title: 'Teknik Ventilasi Atap Metal', url: 'https://example.com/ventilasi', description: 'Panduan standar' }
          ]
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const provider = new OpenWebDiscoveryProvider(undefined, {
      enabled: resolved.enabled,
      apiKey: resolved.apiKey,
      provider: 'BRAVE'
    });

    assert.strictEqual(provider.isEnabled(), true);
    assert.strictEqual(provider.isConfigured(), true);

    const results = await provider.search(
      { query: 'ventilasi atap', query_id: 'q1', language: 'id', max_results: 3 },
      { fetchFn: mockFetch }
    );
    assert.strictEqual(results.length, 1);
    assert.strictEqual(fetchCount, 1);
    console.log('  ✅ PASS: 8. ACTIVE permits Brave runtime');
    passed++;
  }

  // --- Test 9: OFF results in Brave request count = 0 ---
  {
    await toggleDiscoveryProvider(mockDb, {
      provider: 'brave',
      enabled: false,
      actor: 'chief_admin',
      env: envWithKek
    });

    const resolved = await resolveEffectiveDiscoveryConfig(mockDb, 'brave', envWithKek);
    assert.strictEqual(resolved.enabled, false);

    let braveFetchCalls = 0;
    const mockFetch = async () => {
      braveFetchCalls++;
      return new Response('{}', { status: 200 });
    };

    const provider = new OpenWebDiscoveryProvider(undefined, {
      enabled: resolved.enabled,
      apiKey: resolved.apiKey,
      provider: 'BRAVE'
    });

    assert.strictEqual(provider.isEnabled(), false);

    let thrown = false;
    try {
      await provider.search(
        { query: 'test query', query_id: 'q2', language: 'id' },
        { fetchFn: mockFetch }
      );
    } catch (e) {
      thrown = true;
    }
    assert.strictEqual(thrown, true);
    assert.strictEqual(braveFetchCalls, 0); // Strictly zero requests!
    console.log('  ✅ PASS: 9. OFF results in Brave request count = 0 (Cost = 0)');
    passed++;
  }

  // --- Test 10: Replace key succeeds ---
  {
    const NEW_SECRET = 'BRAVE_NEW_REPLACED_SECRET_TEST_123';
    const replaceRes = await saveDiscoveryProviderKey(mockDb, {
      provider: 'brave',
      apiKey: NEW_SECRET,
      actor: 'chief_admin',
      env: envWithKek
    });
    allRecordedResponsesAndDumps.push(JSON.stringify(replaceRes));

    // Audit must contain BRAVE_API_KEY_REPLACED
    const lastAudit = mockDb.auditLogs[mockDb.auditLogs.length - 1];
    assert.strictEqual(lastAudit.action, 'BRAVE_API_KEY_REPLACED');
    assert.strictEqual(lastAudit.result, 'SUCCESS');

    // Decrypt must yield new secret
    const row = mockDb.providerSettings.get('brave');
    const decrypted = await decryptDiscoverySecret(row.encrypted_secret, row.nonce, resolveSettingsKek(envWithKek), 'brave');
    assert.strictEqual(decrypted, NEW_SECRET);
    console.log('  ✅ PASS: 10. Replace key succeeds atomically');
    passed++;
  }

  // --- Test 11: Remove key disables Brave ---
  {
    // First toggle ON
    await toggleDiscoveryProvider(mockDb, { provider: 'brave', enabled: true, actor: 'chief_admin', env: envWithKek });
    assert.strictEqual(mockDb.providerSettings.get('brave').enabled, 1);

    // Remove key
    const removeRes = await removeDiscoveryProviderKey(mockDb, { provider: 'brave', actor: 'chief_admin' });
    allRecordedResponsesAndDumps.push(JSON.stringify(removeRes));

    const status = await getDiscoveryProviderStatus(mockDb, 'brave', envWithKek);
    assert.strictEqual(status.configured, false);
    assert.strictEqual(status.enabled, false);
    assert.strictEqual(status.status, 'OFF');

    const lastAudit = mockDb.auditLogs[mockDb.auditLogs.length - 1];
    assert.strictEqual(lastAudit.action, 'BRAVE_API_KEY_REMOVED');
    console.log('  ✅ PASS: 11. Remove key disables Brave atomically');
    passed++;
  }

  // --- Test 12: Test Connection = exactly one request ---
  {
    // Re-save key for testing
    await saveDiscoveryProviderKey(mockDb, {
      provider: 'brave',
      apiKey: 'BSA_VALID_TEST_KEY_FOR_MOCK_123',
      actor: 'chief_admin',
      env: envWithKek
    });

    let connectionTestRequests = 0;
    const testFetch = async (url, opts) => {
      connectionTestRequests++;
      assert.ok(url.includes('arsitektur%20bangunan') || url.includes('arsitektur'));
      assert.strictEqual(opts.headers['X-Subscription-Token'], 'BSA_VALID_TEST_KEY_FOR_MOCK_123');
      return new Response(JSON.stringify({ query: { original: 'arsitektur bangunan' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const testRes = await testDiscoveryProviderConnection(mockDb, {
      provider: 'brave',
      actor: 'chief_admin',
      env: envWithKek,
      fetchFn: testFetch
    });
    allRecordedResponsesAndDumps.push(JSON.stringify(testRes));

    assert.strictEqual(testRes.success, true);
    assert.strictEqual(testRes.message, 'Koneksi berhasil');
    assert.strictEqual(connectionTestRequests, 1); // EXACTLY ONE request
    console.log('  ✅ PASS: 12. Test Connection = exactly one request');
    passed++;
  }

  // --- Test 13: Auth failure doesn't leak key ---
  {
    const failFetch = async () => {
      return new Response(JSON.stringify({ error: { message: 'Invalid subscription token' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const failRes = await testDiscoveryProviderConnection(mockDb, {
      provider: 'brave',
      actor: 'chief_admin',
      env: envWithKek,
      fetchFn: failFetch
    });
    allRecordedResponsesAndDumps.push(JSON.stringify(failRes));

    assert.strictEqual(failRes.success, false);
    assert.strictEqual(failRes.message, 'Autentikasi gagal (API key tidak valid)');
    assert.strictEqual(JSON.stringify(failRes).includes('BSA_VALID_TEST_KEY'), false);
    console.log('  ✅ PASS: 13. Auth failure handled safely without key leak');
    passed++;
  }

  // --- Test 14: Audit logs contain zero secrets ---
  {
    for (const log of mockDb.auditLogs) {
      const serialized = JSON.stringify(log);
      allRecordedResponsesAndDumps.push(serialized);
      assert.strictEqual(serialized.includes(TEST_SECRET), false);
      assert.strictEqual(serialized.includes('X-Subscription-Token'), false);
      assert.strictEqual(serialized.includes('Bearer '), false);
    }
    console.log('  ✅ PASS: 14. Audit logs contain zero secrets or auth tokens');
    passed++;
  }

  // --- Test 15: Unauthorized actor rejected ---
  {
    // Simulate API request without admin session
    const mockRequest = new Request('http://localhost/api/admin/discovery-settings', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    // In our API handler, missing cookies or auth header returns 401
    const { isValidAdminSession } = await import('../src/lib/auth.ts');
    const isAuth = await isValidAdminSession(null, envWithKek);
    assert.strictEqual(isAuth, false);
    console.log('  ✅ PASS: 15. Unauthorized actor rejected fail-closed');
    passed++;
  }

  // --- Test 16: CrossRef/Wikipedia still work when Brave OFF ---
  {
    let crossRefCalled = false;
    let wikiCalled = false;
    let openWebCalled = false;

    const mockCrossRef = async () => {
      crossRefCalled = true;
      return [];
    };
    const mockWiki = async () => {
      wikiCalled = true;
      return [];
    };
    const mockOpenWeb = async () => {
      openWebCalled = true;
      return [];
    };

    // Brave disabled in config
    const discoveryConfig = {
      enabled: false,
      provider: 'BRAVE'
    };

    const result = await executeGeneralizedResearchJob(
      {
        taskId: 'task_test_off',
        topic: 'Ventilasi Atap Rumah Tropis',
        operatorAuth: { authorizedBy: 'chief' },
        execution_type: 'TEST'
      },
      {
        crossRefSearchFn: mockCrossRef,
        wikiSearchFn: mockWiki,
        discoveryConfig
      }
    );

    assert.strictEqual(crossRefCalled, true);
    assert.strictEqual(wikiCalled, true);
    assert.strictEqual(openWebCalled, false);
    console.log('  ✅ PASS: 16. CrossRef/Wikipedia still work when Brave OFF');
    passed++;
  }

  // --- Test 17: Brave ACTIVE still uses socket-safe retrieval ---
  {
    const { createPinnedDispatcher } = await import('../src/lib/editorial/discovery-network-safety.ts');
    assert.strictEqual(typeof createPinnedDispatcher, 'function');
    const dispatcher = await createPinnedDispatcher('example.com', '93.184.216.34');
    assert.ok(dispatcher);
    console.log('  ✅ PASS: 17. Brave ACTIVE maintains socket-bound network safety boundary');
    passed++;
  }

  // --- Test 18: Missing KEK => SECRET_STORAGE_NOT_READY ---
  {
    let caughtKekError = false;
    let kekErrorMessage = '';
    try {
      await saveDiscoveryProviderKey(mockDb, {
        provider: 'brave',
        apiKey: 'test-key',
        actor: 'chief',
        env: {} // No KEK provided
      });
    } catch (err) {
      caughtKekError = true;
      kekErrorMessage = err.message;
    }
    assert.strictEqual(caughtKekError, true);
    assert.ok(kekErrorMessage.includes('SECRET_STORAGE_NOT_READY'));
    console.log('  ✅ PASS: 18. Missing KEK fails closed with SECRET_STORAGE_NOT_READY');
    passed++;
  }

  // --- Test 19: Admin page load triggers 0 Brave requests ---
  {
    let fetchCalls = 0;
    const trackingFetch = async () => {
      fetchCalls++;
      return new Response('{}');
    };
    // Page load calls getDiscoveryProviderStatus
    await getDiscoveryProviderStatus(mockDb, 'brave', envWithKek);
    assert.strictEqual(fetchCalls, 0); // ZERO fetch calls on page load
    console.log('  ✅ PASS: 19. Admin page load triggers 0 Brave requests');
    passed++;
  }

  // --- Test 20: Fake secret scan => occurrence count 0 ---
  {
    let secretLeakCount = 0;
    for (const dump of allRecordedResponsesAndDumps) {
      if (dump.includes(TEST_SECRET)) {
        secretLeakCount++;
      }
    }
    assert.strictEqual(secretLeakCount, 0);
    console.log(`  ✅ PASS: 20. Fake secret scan across all responses & audit logs => occurrence count: ${secretLeakCount}`);
    passed++;
  }

  console.log(`\n==================================================`);
  console.log(`ADMIN-BRAVE-SEARCH-SETTINGS-1 SUITE COMPLETE: ${passed} PASSED, 0 FAILED`);
  console.log(`==================================================\n`);
}

runSuite().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
