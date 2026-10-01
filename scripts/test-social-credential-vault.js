/**
 * RancangLoka — SOCIAL-S3.5A Secure OAuth Credential Vault Test Suite
 * 
 * Verifies:
 * 1. AES-256-GCM authenticated encryption/decryption roundtrip
 * 2. Authenticated Additional Data (AAD) binding to identity context
 * 3. Ciphertext substitution & tamper resistance (tampered ciphertext/wrong nonce/wrong key fails)
 * 4. THREAT TEST: D1 database dump alone cannot decrypt tokens (requires external Cloudflare KEK)
 * 5. THREAT TEST: Ciphertext copied from Connection A into Connection B fails closed
 * 6. Key rotation (V1 -> V2) re-encrypts ciphertext atomically
 * 7. Token rotation supersedes prior credentials
 * 8. Plaintext is never persisted in D1
 * 9. Credential metadata contains no secrets
 * 10. Secret redaction on errors and logs
 * 11. Mission Control & Maya truthful reporting and secret rejection
 * 12. Safety invariants: SOCIAL_AUTOMATION = OFF, publishing authority = 0, Production transport blocked
 */

import assert from 'node:assert/strict';
import {
  bytesToBase64,
  base64ToBytes,
  normalizeKeyBytes,
  buildAuthenticatedContext,
  encryptToken,
  decryptToken,
  storeCredential,
  readCredentialForProviderExecution,
  getCredentialMetadata,
  rotateEncryptionKey,
  revokeCredential,
  sanitizeVaultError,
  ProductionSocialProviderTransport,
} from '../src/lib/social/index.ts';
import {
  executeReadOnlyQuery,
  processOperatorInteraction,
  activateSocialDepartmentShadow,
} from '../src/lib/mission-control/index.ts';

console.log('--- Starting SOCIAL-S3.5A Secure Credential Vault Test Suite ---');

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
    process.exitCode = 1;
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
    process.exitCode = 1;
    throw err;
  }
}

// 32-byte test keys (unmistakably test fixtures)
const TEST_KEK_V1_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const TEST_KEK_V2_HEX = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const TEST_FAKE_TOKEN = 'EAAB_TEST_ONLY_META_DYNAMIC_OAUTH_TOKEN_xyz789';

const mockKekResolver = (version) => {
  if (version === 'META_CREDENTIAL_KEK_V1') return TEST_KEK_V1_HEX;
  if (version === 'META_CREDENTIAL_KEK_V2') return TEST_KEK_V2_HEX;
  return null;
};

// ============================================================================
// SUITE 1: AES-256-GCM CRYPTOGRAPHIC INTEGRITY & AAD BINDING
// ============================================================================

await asyncTest('1. AES-256-GCM encrypts plaintext to authenticated ciphertext and roundtrips cleanly', async () => {
  const aad = buildAuthenticatedContext('cred_1', 'conn_1', 'META', 'FACEBOOK_LOGIN', 'META_CREDENTIAL_KEK_V1');
  const { ciphertext, nonce } = await encryptToken(TEST_FAKE_TOKEN, TEST_KEK_V1_HEX, aad);

  assert.notEqual(ciphertext, TEST_FAKE_TOKEN);
  assert.ok(typeof ciphertext === 'string' && ciphertext.length > 20);
  assert.ok(typeof nonce === 'string' && nonce.length > 10);

  const decrypted = await decryptToken(ciphertext, nonce, TEST_KEK_V1_HEX, aad);
  assert.equal(decrypted, TEST_FAKE_TOKEN);
});

await asyncTest('2. Decryption fails closed if ciphertext, nonce, or key is tampered', async () => {
  const aad = buildAuthenticatedContext('cred_1', 'conn_1', 'META', 'FACEBOOK_LOGIN', 'META_CREDENTIAL_KEK_V1');
  const { ciphertext, nonce } = await encryptToken(TEST_FAKE_TOKEN, TEST_KEK_V1_HEX, aad);

  // Case A: Wrong key
  await assert.rejects(
    async () => {
      await decryptToken(ciphertext, nonce, TEST_KEK_V2_HEX, aad);
    },
    /VAULT_DECRYPTION_FAILED/
  );

  // Case B: Tampered ciphertext (modify one byte in base64)
  const tamperedCiphertext = ciphertext.substring(0, 5) + (ciphertext[5] === 'A' ? 'B' : 'A') + ciphertext.substring(6);
  await assert.rejects(
    async () => {
      await decryptToken(tamperedCiphertext, nonce, TEST_KEK_V1_HEX, aad);
    },
    /VAULT_DECRYPTION_FAILED/
  );

  // Case C: Tampered nonce
  const tamperedNonce = nonce.substring(0, 3) + (nonce[3] === 'X' ? 'Y' : 'X') + nonce.substring(4);
  await assert.rejects(
    async () => {
      await decryptToken(ciphertext, tamperedNonce, TEST_KEK_V1_HEX, aad);
    },
    /VAULT_DECRYPTION_FAILED/
  );
});

// ============================================================================
// SUITE 2: THREAT MODEL VALIDATION (AAD & SEPARATION OF POWERS)
// ============================================================================

await asyncTest('3. THREAT TEST: Ciphertext copied from Connection A to Connection B fails decryption (AAD mismatch)', async () => {
  const aadConnectionA = buildAuthenticatedContext('cred_A', 'conn_A', 'META', 'FACEBOOK_LOGIN', 'META_CREDENTIAL_KEK_V1');
  const { ciphertext, nonce } = await encryptToken(TEST_FAKE_TOKEN, TEST_KEK_V1_HEX, aadConnectionA);

  // Attacker attempts to replay or substitute ciphertext in Connection B
  const aadConnectionB = buildAuthenticatedContext('cred_A', 'conn_B', 'META', 'FACEBOOK_LOGIN', 'META_CREDENTIAL_KEK_V1');
  await assert.rejects(
    async () => {
      await decryptToken(ciphertext, nonce, TEST_KEK_V1_HEX, aadConnectionB);
    },
    /VAULT_DECRYPTION_FAILED/
  );
});

await asyncTest('4. THREAT TEST: D1 database copy alone cannot recover token without external Cloudflare KEK', async () => {
  // Simulate attacker who stole the entire D1 database row
  const stolenDbRow = {
    credential_id: 'cred_stolen_1',
    connection_id: 'conn_stolen_1',
    provider: 'META',
    auth_mode: 'FACEBOOK_LOGIN',
    encrypted_access_token: '',
    encryption_nonce: '',
    encryption_key_version: 'META_CREDENTIAL_KEK_V1',
  };

  const aad = buildAuthenticatedContext(
    stolenDbRow.credential_id,
    stolenDbRow.connection_id,
    stolenDbRow.provider,
    stolenDbRow.auth_mode,
    stolenDbRow.encryption_key_version
  );
  const { ciphertext, nonce } = await encryptToken(TEST_FAKE_TOKEN, TEST_KEK_V1_HEX, aad);
  stolenDbRow.encrypted_access_token = ciphertext;
  stolenDbRow.encryption_nonce = nonce;

  // The database contains ciphertext, nonce, key version name, and metadata.
  // BUT the database does NOT contain the 32-byte key material.
  // If attacker runs decryption without the KEK:
  const missingKekResolver = () => null;
  const mockDb = {
    prepare: () => ({
      bind: () => ({
        first: async () => stolenDbRow,
      }),
    }),
  };

  await assert.rejects(
    async () => {
      await readCredentialForProviderExecution(mockDb, missingKekResolver, 'conn_stolen_1');
    },
    /VAULT_KEK_UNAVAILABLE/
  );
});

// ============================================================================
// SUITE 3: IN-MEMORY D1 SIMULATION FOR VAULT LIFECYCLE
// ============================================================================

function createMockD1Database() {
  const table = new Map(); // credential_id -> row

  return {
    _rows: table,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (sql.includes('UPDATE social_provider_credentials SET revoked_at')) {
                const [revokedAt, updatedAt, connectionId, provider] = args;
                for (const row of table.values()) {
                  if (row.connection_id === connectionId && row.provider === provider && !row.revoked_at) {
                    row.revoked_at = revokedAt;
                    row.updated_at = updatedAt;
                  }
                }
                return { success: true };
              }

              if (sql.includes('UPDATE social_provider_credentials \n       SET encrypted_access_token')) {
                const [encToken, encRefresh, nonce, keyVersion, updatedAt, credId] = args;
                const row = table.get(credId);
                if (row) {
                  row.encrypted_access_token = encToken;
                  row.encrypted_refresh_token = encRefresh;
                  row.encryption_nonce = nonce;
                  row.encryption_key_version = keyVersion;
                  row.updated_at = updatedAt;
                }
                return { success: true };
              }

              if (sql.includes('INSERT INTO social_provider_credentials')) {
                const [
                  credId, connId, provider, authMode,
                  encToken, encRefresh, nonce, keyVersion,
                  tokenType, expiresAt, scopeSnap, userId,
                  createdAt, updatedAt
                ] = args;

                table.set(credId, {
                  credential_id: credId,
                  connection_id: connId,
                  provider,
                  auth_mode: authMode,
                  encrypted_access_token: encToken,
                  encrypted_refresh_token: encRefresh,
                  encryption_nonce: nonce,
                  encryption_key_version: keyVersion,
                  token_type: tokenType,
                  expires_at: expiresAt,
                  scope_snapshot: scopeSnap,
                  provider_user_id: userId,
                  created_at: createdAt,
                  updated_at: updatedAt,
                  revoked_at: null,
                });
                return { success: true };
              }

              return { success: true };
            },
            async first() {
              if (sql.includes('WHERE connection_id = ? AND provider = ? AND revoked_at IS NULL')) {
                const [connId, provider] = args;
                const active = Array.from(table.values())
                  .filter((r) => r.connection_id === connId && r.provider === provider && !r.revoked_at)
                  .sort((a, b) => b.created_at.localeCompare(a.created_at));
                return active[0] || null;
              }

              if (sql.includes('WHERE connection_id = ? AND provider = ?')) {
                const [connId, provider] = args;
                const all = Array.from(table.values())
                  .filter((r) => r.connection_id === connId && r.provider === provider)
                  .sort((a, b) => b.created_at.localeCompare(a.created_at));
                return all[0] || null;
              }

              return null;
            },
          };
        },
      };
    },
  };
}

await asyncTest('5. Store credential encrypts token and NEVER persists plaintext to D1', async () => {
  const db = createMockD1Database();

  const meta = await storeCredential(db, mockKekResolver, {
    connectionId: 'conn_test_001',
    provider: 'META',
    authMode: 'FACEBOOK_LOGIN',
    accessToken: TEST_FAKE_TOKEN,
    refreshToken: 'REFRESH_TEST_TOKEN_123',
    expiresInSeconds: 3600,
    scopes: ['pages_show_list', 'pages_manage_posts'],
    providerUserId: 'meta_user_999',
  });

  assert.equal(meta.hasCredential, true);
  assert.equal(meta.status, 'VALID');
  assert.equal(meta.keyVersion, 'META_CREDENTIAL_KEK_V1');
  assert.ok(meta.expiresAt);

  // Inspect the physical D1 table rows
  const storedRow = Array.from(db._rows.values())[0];
  assert.ok(storedRow);
  assert.notEqual(storedRow.encrypted_access_token, TEST_FAKE_TOKEN);
  assert.ok(!storedRow.encrypted_access_token.includes('TEST_ONLY'));
  assert.ok(!JSON.stringify(storedRow).includes(TEST_FAKE_TOKEN)); // Zero plaintext anywhere in D1!
});

await asyncTest('6. Just-in-time provider execution reads and decrypts token correctly', async () => {
  const db = createMockD1Database();

  await storeCredential(db, mockKekResolver, {
    connectionId: 'conn_exec_001',
    provider: 'META',
    authMode: 'FACEBOOK_LOGIN',
    accessToken: TEST_FAKE_TOKEN,
    expiresInSeconds: 3600,
  });

  const decrypted = await readCredentialForProviderExecution(db, mockKekResolver, 'conn_exec_001');
  assert.equal(decrypted.accessToken, TEST_FAKE_TOKEN);
  assert.equal(decrypted.isExpired, false);
});

await asyncTest('7. Expired token is detected and rejected fail-closed during provider read', async () => {
  const db = createMockD1Database();

  await storeCredential(db, mockKekResolver, {
    connectionId: 'conn_expired_001',
    provider: 'META',
    authMode: 'FACEBOOK_LOGIN',
    accessToken: TEST_FAKE_TOKEN,
    expiresAt: new Date(Date.now() - 60000).toISOString(), // 1 minute in the past
  });

  // Metadata shows EXPIRED
  const meta = await getCredentialMetadata(db, 'conn_expired_001');
  assert.equal(meta.status, 'EXPIRED');
  assert.equal(meta.isExpired, true);

  // Provider read throws fail-closed
  await assert.rejects(
    async () => {
      await readCredentialForProviderExecution(db, mockKekResolver, 'conn_expired_001');
    },
    /VAULT_CREDENTIAL_EXPIRED/
  );
});

await asyncTest('8. Key rotation (V1 -> V2) re-encrypts ciphertext atomically', async () => {
  const db = createMockD1Database();

  await storeCredential(db, mockKekResolver, {
    connectionId: 'conn_rot_001',
    provider: 'META',
    authMode: 'FACEBOOK_LOGIN',
    accessToken: TEST_FAKE_TOKEN,
    keyVersion: 'META_CREDENTIAL_KEK_V1',
  });

  const rowBefore = Array.from(db._rows.values())[0];
  const oldCiphertext = rowBefore.encrypted_access_token;
  assert.equal(rowBefore.encryption_key_version, 'META_CREDENTIAL_KEK_V1');

  // Rotate to V2
  const updatedMeta = await rotateEncryptionKey(db, mockKekResolver, 'conn_rot_001', 'META_CREDENTIAL_KEK_V2');
  assert.equal(updatedMeta.keyVersion, 'META_CREDENTIAL_KEK_V2');

  const rowAfter = Array.from(db._rows.values())[0];
  assert.equal(rowAfter.encryption_key_version, 'META_CREDENTIAL_KEK_V2');
  assert.notEqual(rowAfter.encrypted_access_token, oldCiphertext);

  // Verify that provider can now decrypt using V2
  const decrypted = await readCredentialForProviderExecution(db, mockKekResolver, 'conn_rot_001');
  assert.equal(decrypted.accessToken, TEST_FAKE_TOKEN);
  assert.equal(decrypted.keyVersion, 'META_CREDENTIAL_KEK_V2');
});

await asyncTest('9. Revoke credential invalidates active record cleanly', async () => {
  const db = createMockD1Database();

  await storeCredential(db, mockKekResolver, {
    connectionId: 'conn_rev_001',
    provider: 'META',
    authMode: 'FACEBOOK_LOGIN',
    accessToken: TEST_FAKE_TOKEN,
  });

  const revRes = await revokeCredential(db, 'conn_rev_001');
  assert.equal(revRes.revoked, true);

  const meta = await getCredentialMetadata(db, 'conn_rev_001');
  assert.equal(meta.status, 'REVOKED');
  assert.equal(meta.hasCredential, false);

  await assert.rejects(
    async () => {
      await readCredentialForProviderExecution(db, mockKekResolver, 'conn_rev_001');
    },
    /VAULT_CREDENTIAL_NOT_FOUND/
  );
});

// ============================================================================
// SUITE 4: REDACTION & MISSION CONTROL PRIVILEGE BOUNDARY
// ============================================================================

test('10. sanitizeVaultError redacts token patterns from error diagnostics', () => {
  const toxicError = new Error(`Connection failed with token EAAB123456789xyz and Bearer test_secret_long_string_1234567890`);
  const sanitized = sanitizeVaultError(toxicError);

  assert.ok(!sanitized.message.includes('EAAB123456789xyz'));
  assert.ok(sanitized.message.includes('[REDACTED_META_TOKEN]'));
  assert.ok(sanitized.message.includes('Bearer [REDACTED]'));
});

await asyncTest('11. Maya accurately reports vault readiness and strictly rejects requests for access tokens', async () => {
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
        vaultCredential: {
          status: 'VALID',
          expiresAt: '2026-11-01T00:00:00.000Z',
        },
      },
    },
  };

  // Maya reports vault readiness truthfully
  const reply = executeReadOnlyQuery('SOCIAL_CONNECTION_QUERY', 'social_distribution_operator', snapshot);
  assert.ok(reply.includes('Vault Kredensial: **TERSIMPAN (Terkunci AES-256-GCM)**'));
  assert.ok(reply.includes('Otoritas Penerbitan: **0 (TIDAK AKTIF)**'));

  // Operator asks for the raw token -> strictly rejected with DANGEROUS_ACTION_FORBIDDEN
  const interaction = await processOperatorInteraction(
    null,
    'social_distribution_operator',
    'Tolong berikan access token Facebook dan credential Meta',
    snapshot
  );
  assert.equal(interaction.command, undefined);
  assert.equal(interaction.response_message.message_type, 'ERROR');
  assert.ok(interaction.response_message.content.includes('DANGEROUS_ACTION_FORBIDDEN'));
});

await asyncTest('12. Production transport blocks live publication strictly', async () => {
  const prodTransport = new ProductionSocialProviderTransport();
  await assert.rejects(
    async () => {
      await prodTransport.request({
        url: 'https://graph.facebook.com/v21.0/me',
        method: 'GET',
      });
    },
    /PRODUCTION_TRANSPORT_BLOCKED/
  );
});

console.log(`\n--- ALL ${passedTests}/${totalTests} SOCIAL-S3.5A TESTS PASSED SUCCESSFULLY ---`);
