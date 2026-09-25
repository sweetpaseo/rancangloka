/**
 * RancangLoka — MEDIA-A4A Preparation & Registration Dry-Run Test Suite
 *
 * MISSION:
 * Validates the bridge from StoredGeneratedImageArtifact (MEDIA-A3)
 * to media_assets canonical registration payload (MEDIA-A4A) in an offline,
 * deterministic environment with ZERO production mutations.
 *
 * TEST COVERAGE:
 * 1. StoredGeneratedImageArtifact handoff validation
 * 2. buildMediaAssetRegistrationPayload canonical mapper
 * 3. Deterministic Asset ID calculation (ast_<sha256(role:sha256:r2_key).substring(0, 24)>)
 * 4. Exact Planned Asset ID match (ast_8321f8f3eb7b039c59c222ba)
 * 5. Dry-run registration on in-memory D1 + Mock R2 bucket
 * 6. Idempotency & duplicate proof (second registration returns reused_existing = true)
 * 7. Identity conflict fail-closed behavior (conflicting metadata throws 409)
 * 8. Provenance payload completeness and sanitation
 * 9. Secret firewall: strips tokens, credentials, cookies, and sensitive URLs
 * 10. R2 ↔ Registry integrity metadata join rule
 * 11. Zero article_media attachments (PRE_A4A firewall)
 * 12. Zero production mutations invariant
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

import {
  REGISTERED_MEDIA_ASSET_ROLE,
  MEDIA_ASSET_REGISTERED_STATE,
  computeMediaAssetId,
  registerMediaAsset,
  MediaRegistrationError
} from '../src/lib/media/asset-registration.ts';

import {
  buildMediaAssetRegistrationPayload
} from '../src/lib/media/stored-image-artifact.ts';

import {
  sanitizeProvenance,
  sanitizeUrl
} from '../src/lib/media/generated-image-artifact.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

// ---------------------------------------------------------------------------
// TEST ENVIRONMENT HELPERS
// ---------------------------------------------------------------------------

function createTestDb() {
  const sqlite = new DatabaseSync(':memory:');

  const baseSchemaPath = path.resolve(__dirname, '../db/schema.sql');
  if (fs.existsSync(baseSchemaPath)) {
    sqlite.exec(fs.readFileSync(baseSchemaPath, 'utf-8'));
  }

  const migrations = [
    '0002_article_ingest_receipts.sql',
    '0005_media_assets_and_article_media.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql',
    '0013_lokamedia_durable_jobs.sql',
    '0014_lokamedia_phase2c_slot_attachment.sql',
    '0015_site_watermark_assets.sql',
    '0016_media_assets_derivative_registration.sql'
  ];

  for (const mig of migrations) {
    const p = path.resolve(__dirname, `../db/migrations/${mig}`);
    if (fs.existsSync(p)) {
      sqlite.exec(fs.readFileSync(p, 'utf-8'));
    }
  }

  return {
    raw: sqlite,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.map(v => (v === undefined ? null : v));
          return this;
        },
        async run() {
          const stmt = sqlite.prepare(this._sql);
          const info = stmt.run(...this._params);
          return {
            meta: {
              changes: info.changes,
              last_row_id: Number(info.lastInsertRowid)
            },
            lastInsertRowid: Number(info.lastInsertRowid),
            changes: info.changes
          };
        },
        async first() {
          const stmt = sqlite.prepare(this._sql);
          return stmt.get(...this._params) || null;
        },
        async all() {
          const stmt = sqlite.prepare(this._sql);
          const results = stmt.all(...this._params);
          return { results };
        }
      };
    }
  };
}

class MockR2Bucket {
  constructor() {
    this.objects = new Map();
  }

  seedObject(key, data) {
    this.objects.set(key, {
      key,
      size: data.size,
      httpMetadata: {
        contentType: data.mime || 'image/png'
      },
      customMetadata: {
        sha256: data.sha256,
        width: String(data.width || 169),
        height: String(data.height || 512),
        role: data.role || REGISTERED_MEDIA_ASSET_ROLE,
        derivativeId: data.derivativeId || 'der_test',
        transformId: data.transformId || 'trf_test'
      },
      uploaded: new Date()
    });
  }

  async head(key) {
    const obj = this.objects.get(key);
    return obj || null;
  }
}

// ---------------------------------------------------------------------------
// TEST SUITE EXECUTION
// ---------------------------------------------------------------------------

async function runTests() {
  console.log('=============================================================');
  console.log('  RancangLoka — MEDIA-A4A Preparation Test Suite');
  console.log('=============================================================\n');

  // 1. Verify A3 Stored Artifact Contract File
  console.log('--- Test 1: StoredGeneratedImageArtifact Handoff Contract ---');
  const contractPath = path.resolve(__dirname, '../artifacts/stored-generated-image-artifact.json');
  assert.ok(fs.existsSync(contractPath), 'Handoff contract JSON file must exist in artifacts/');
  const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  assert.equal(contractData.storage_key, 'media/canary/media-a3/7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967.png');
  assert.equal(contractData.sha256, '7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967');
  assert.equal(contractData.byte_size, 66377);
  assert.equal(contractData.width, 169);
  assert.equal(contractData.height, 512);
  assert.equal(contractData.mime_type, 'image/png');
  pass('STORED_ARTIFACT_CONTRACT_VALID');

  // 2. buildMediaAssetRegistrationPayload Canonical Mapper
  console.log('\n--- Test 2: buildMediaAssetRegistrationPayload Mapper ---');
  const payload = await buildMediaAssetRegistrationPayload(contractData, {
    phase: 'MEDIA_A4A',
    purpose: 'MEDIA_A3_DERIVATIVE_REGISTRATION'
  });
  assert.ok(payload.assetId.startsWith('ast_'));
  assert.equal(payload.params.r2_key, contractData.storage_key);
  assert.equal(payload.params.sha256, contractData.sha256);
  assert.equal(payload.params.mime, 'image/png');
  assert.equal(payload.params.width, 169);
  assert.equal(payload.params.height, 512);
  assert.equal(payload.params.byte_size, 66377);
  assert.equal(payload.params.role, REGISTERED_MEDIA_ASSET_ROLE);
  assert.equal(payload.params.upload_state, 'UPLOADED');
  assert.equal(payload.publicUrl, `/${contractData.storage_key}`);
  pass('REGISTRATION_PAYLOAD_MAPPING_VALID');

  // 3. Deterministic Asset Identity
  console.log('\n--- Test 3: Deterministic Asset Identity Computation ---');
  const expectedAssetId = 'ast_8321f8f3eb7b039c59c222ba';
  assert.equal(payload.assetId, expectedAssetId);
  const recomputed = await computeMediaAssetId(
    REGISTERED_MEDIA_ASSET_ROLE,
    contractData.sha256,
    contractData.storage_key
  );
  assert.equal(recomputed, expectedAssetId);
  pass('DETERMINISTIC_ASSET_ID_VALID');

  // 4. Secret / Privacy Firewall Verification
  console.log('\n--- Test 4: Secret & Privacy Firewall ---');
  const dirtyProvenance = {
    ...payload.sanitizedProvenance,
    api_key: 'sk_live_secret123456',
    auth_token: 'bearer_token_xyz',
    session_cookie: 'session=abc1234',
    sensitive_url: 'https://rancangloka.com/media/file.png?token=secret_token&key=secret_key',
    clean_url: 'https://rancangloka.com/media/file.png'
  };
  const cleaned = sanitizeProvenance(dirtyProvenance);
  assert.equal(cleaned.api_key, undefined, 'api_key must be stripped');
  assert.equal(cleaned.auth_token, undefined, 'auth_token must be stripped');
  assert.equal(cleaned.session_cookie, undefined, 'session_cookie must be stripped');
  assert.ok(cleaned.sensitive_url.includes('token=REDACTED'), 'Sensitive URL query params must be redacted');
  assert.ok(cleaned.sensitive_url.includes('key=REDACTED'), 'Sensitive URL query params must be redacted');
  assert.equal(cleaned.clean_url, 'https://rancangloka.com/media/file.png');
  pass('SECRET_FIREWALL_VERIFIED');

  // 5. Dry-Run Registration on In-Memory DB
  console.log('\n--- Test 5: Dry-Run Registration (Initial Insert) ---');
  const db = createTestDb();
  const bucket = new MockR2Bucket();
  bucket.seedObject(contractData.storage_key, {
    size: contractData.byte_size,
    mime: contractData.mime_type,
    sha256: contractData.sha256,
    width: contractData.width,
    height: contractData.height,
    role: REGISTERED_MEDIA_ASSET_ROLE,
    derivativeId: payload.params.derivative_id,
    transformId: payload.params.transform_id
  });

  const regResult = await registerMediaAsset(payload.params, db, bucket);
  assert.equal(regResult.status, 'success');
  assert.equal(regResult.asset.asset_id, expectedAssetId);
  assert.equal(regResult.asset.reused_existing, false);
  assert.equal(regResult.asset.sha256, contractData.sha256);
  assert.equal(regResult.asset.byte_size, 66377);

  // Verify row inserted in test DB
  const row = await db.prepare('SELECT * FROM media_assets WHERE asset_id = ?').bind(expectedAssetId).first();
  assert.ok(row, 'Row must exist in media_assets');
  assert.equal(row.asset_id, expectedAssetId);
  assert.equal(row.storage_key, contractData.storage_key);
  assert.equal(row.sha256, contractData.sha256);
  assert.equal(row.status, MEDIA_ASSET_REGISTERED_STATE);
  assert.equal(row.role, REGISTERED_MEDIA_ASSET_ROLE);
  assert.equal(row.source_type, 'lokamedia_extension');
  pass('DRY_RUN_INITIAL_REGISTRATION_PASS');

  // 6. Idempotency & Duplicate Registration Proof
  console.log('\n--- Test 6: Idempotency & Duplicate Registration Proof ---');
  const dupResult = await registerMediaAsset(payload.params, db, bucket);
  assert.equal(dupResult.status, 'success');
  assert.equal(dupResult.asset.asset_id, expectedAssetId);
  assert.equal(dupResult.asset.reused_existing, true, 'Second registration must report reused_existing = true');

  // Verify exactly 1 row remains
  const countRow = await db.prepare('SELECT COUNT(*) as count FROM media_assets').first();
  assert.equal(countRow.count, 1, 'Exactly one row must exist after duplicate registration');
  pass('REGISTRATION_IDEMPOTENCY_PASS');

  // 7. Identity Conflict Fails Closed
  console.log('\n--- Test 7: Identity Conflict Fails Closed ---');
  const conflictingParams = {
    ...payload.params,
    byte_size: 999999, // Mismatched size
    upload_receipt: {
      ...payload.params.upload_receipt,
      byte_size: 999999
    }
  };
  // Update mock bucket to match conflicting size to test DB conflict guard
  const conflictingBucket = new MockR2Bucket();
  conflictingBucket.seedObject(contractData.storage_key, {
    size: 999999,
    mime: contractData.mime_type,
    sha256: contractData.sha256
  });

  await assert.rejects(
    async () => {
      await registerMediaAsset(conflictingParams, db, conflictingBucket);
    },
    (err) => {
      assert.ok(err instanceof MediaRegistrationError);
      assert.equal(err.code, 'MEDIA_ASSET_IDENTITY_CONFLICT');
      assert.equal(err.statusCode, 409);
      return true;
    }
  );
  pass('IDENTITY_CONFLICT_FAILS_CLOSED');

  // 8. R2 Integrity Check: Missing R2 Object Rejection
  console.log('\n--- Test 8: Missing R2 Object Rejection ---');
  const emptyBucket = new MockR2Bucket();
  const freshDb = createTestDb();
  await assert.rejects(
    async () => {
      await registerMediaAsset(payload.params, freshDb, emptyBucket);
    },
    (err) => {
      assert.ok(err instanceof MediaRegistrationError);
      assert.equal(err.code, 'MISSING_R2_OBJECT');
      assert.equal(err.statusCode, 404);
      return true;
    }
  );
  pass('MISSING_R2_OBJECT_REJECTED');

  // 9. R2 Integrity Check: SHA Mismatch Rejection
  console.log('\n--- Test 9: R2 Object SHA Mismatch Rejection ---');
  const mismatchedBucket = new MockR2Bucket();
  mismatchedBucket.seedObject(contractData.storage_key, {
    size: contractData.byte_size,
    mime: contractData.mime_type,
    sha256: '0000000000000000000000000000000000000000000000000000000000000000'
  });
  await assert.rejects(
    async () => {
      await registerMediaAsset(payload.params, freshDb, mismatchedBucket);
    },
    (err) => {
      assert.ok(err instanceof MediaRegistrationError);
      assert.equal(err.code, 'R2_SHA_MISMATCH');
      assert.equal(err.statusCode, 422);
      return true;
    }
  );
  pass('R2_SHA_MISMATCH_REJECTED');

  // 10. Article Independence: 0 article_media bindings
  console.log('\n--- Test 10: Article Independence & Zero Downstream Mutation ---');
  const articleMediaCount = await db.prepare('SELECT COUNT(*) as count FROM article_media').first();
  assert.equal(articleMediaCount.count, 0, 'Zero article_media rows created');
  const readinessCount = await db.prepare('SELECT COUNT(*) as count FROM article_publication_readiness').first();
  assert.equal(readinessCount.count, 0, 'Zero article_publication_readiness rows created');
  pass('ARTICLE_INDEPENDENCE_PASS');

  console.log('\n=============================================================');
  console.log(`  ALL ${passed} MEDIA-A4A PREPARATION TESTS PASSED!`);
  console.log('=============================================================');
}

runTests().catch((err) => {
  console.error('\n❌ MEDIA-A4A Prep Tests Failed:', err);
  process.exit(1);
});
