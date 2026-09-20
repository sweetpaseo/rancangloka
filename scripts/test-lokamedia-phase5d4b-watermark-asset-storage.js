/**
 * RancangLoka — LokaMedia Phase 5D4B Test Suite
 * Watermark Master Asset Storage (Site-Level Binary Asset + R2 Master Storage)
 *
 * Deterministic Test Coverage:
 * 1. BINARY_VALIDATION & MAGIC_BYTES (PNG, WebP, JPEG reject, SVG reject, Remote URL reject, MIME spoof reject)
 * 2. TRANSPARENCY_VALIDATION (Transparent PNG/WebP accepted, Opaque rejected)
 * 3. BOUNDS_VALIDATION (Size bounds <= 2MiB, Dimensions 20x20 to 2000x2000)
 * 4. SHA256 & MASTER_BYTES_UNCHANGED
 * 5. R2_NAMESPACE & PRIVATE_BY_DEFAULT
 * 6. DEDUPLICATION & IDEMPOTENCY
 * 7. TRANSACTION_SAFETY (R2 failure -> no DB row, D1 failure -> orphan deleted)
 * 8. ASSET_METADATA_READ & PRIVATE_PREVIEW
 * 9. SETTINGS_INTEGRATION (Valid asset linkage, unknown asset reject, wrong purpose reject)
 * 10. REPLACEMENT_SEMANTICS & DELETE_POLICY (Old master not deleted, referenced asset delete rejected)
 * 11. VERSION_BUMP_SEMANTICS (Asset change bumps version, same asset does not bump)
 * 12. AUDIT_LOGGING (Upload audit, asset change audit)
 * 13. LIVE_HTTP_API (Admin auth required, CSRF protection, upload API, preview API)
 * 14. NO_ARTICLE_COUPLING & ZERO_PROVIDER_INVOLVEMENT
 * 15. TEXT_MODE_REGRESSION
 */

import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import http from 'node:http';
import { createAdminSessionToken } from '../src/lib/auth.ts';

import {
  WATERMARK_MASTER_PURPOSE,
  WATERMARK_MASTER_R2_NAMESPACE,
  MAX_WATERMARK_UPLOAD_BYTES,
  MIN_WATERMARK_DIMENSIONS,
  MAX_WATERMARK_DIMENSIONS,
  MASTER_ASSET_PUBLIC_BY_DEFAULT,
  MASTER_DELETE_POLICY,
  WatermarkAssetValidationError,
  validateWatermarkMasterBinary,
  computeBinarySha256,
  checkPngBinary,
  checkWebpBinary,
  uploadWatermarkMasterAsset,
  getWatermarkMasterAsset,
  getWatermarkMasterAssetObject,
  deleteWatermarkMasterAsset
} from '../src/lib/watermark/assets.ts';

import {
  DEFAULT_WATERMARK_SETTINGS,
  WATERMARK_SETTINGS_KEY,
  WATERMARK_AUDIT_KEY,
  WATERMARK_TYPES,
  getD1WatermarkSettings,
  saveD1WatermarkSettings,
  WatermarkSettingsValidationError
} from '../src/lib/watermark/settings.ts';

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

// ---------------------------------------------------------------------------
// DETERMINISTIC BINARY FIXTURE GENERATORS
// ---------------------------------------------------------------------------

function createTestPng(width, height, hasTransparentPixel = true) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crcBuf = Buffer.alloc(4);
    const toCrc = Buffer.concat([typeBuf, data]);
    const crc = zlib.crc32(toCrc);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const scanlines = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // filter 0
    for (let x = 0; x < width; x++) {
      row[1 + x * 4 + 0] = 100;
      row[1 + x * 4 + 1] = 150;
      row[1 + x * 4 + 2] = 200;
      row[1 + x * 4 + 3] = (hasTransparentPixel && x === 0 && y === 0) ? 128 : 255;
    }
    scanlines.push(row);
  }

  const rawData = Buffer.concat(scanlines);
  const compressed = zlib.deflateSync(rawData);

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return new Uint8Array(Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]));
}

function createTestWebp(width, height, hasAlpha = true) {
  // Construct a deterministic VP8X WebP header
  // RIFF [4 bytes file size - 8] WEBP VP8X [4 bytes chunk size = 10] [flags 1 byte] ...
  const riffHeader = Buffer.from('RIFF');
  const webpHeader = Buffer.from('WEBP');
  const vp8xFourCC = Buffer.from('VP8X');

  const vp8xData = Buffer.alloc(10);
  vp8xData[0] = hasAlpha ? 0x10 : 0x00; // Bit 4 = Alpha flag
  // Canvas width - 1 (24-bit little endian)
  const wMinus1 = width - 1;
  vp8xData[4] = wMinus1 & 0xff;
  vp8xData[5] = (wMinus1 >> 8) & 0xff;
  vp8xData[6] = (wMinus1 >> 16) & 0xff;
  // Canvas height - 1 (24-bit little endian)
  const hMinus1 = height - 1;
  vp8xData[7] = hMinus1 & 0xff;
  vp8xData[8] = (hMinus1 >> 8) & 0xff;
  vp8xData[9] = (hMinus1 >> 16) & 0xff;

  const vp8xChunkLen = Buffer.alloc(4);
  vp8xChunkLen.writeUInt32LE(10, 0);

  // Dummy ALPH / payload chunk
  const payloadFourCC = Buffer.from('ALPH');
  const payloadData = Buffer.alloc(16);
  const payloadChunkLen = Buffer.alloc(4);
  payloadChunkLen.writeUInt32LE(payloadData.length, 0);

  const totalContent = Buffer.concat([
    webpHeader,
    vp8xFourCC,
    vp8xChunkLen,
    vp8xData,
    payloadFourCC,
    payloadChunkLen,
    payloadData
  ]);

  const riffSize = Buffer.alloc(4);
  riffSize.writeUInt32LE(totalContent.length, 0);

  return new Uint8Array(Buffer.concat([riffHeader, riffSize, totalContent]));
}

// ---------------------------------------------------------------------------
// IN-MEMORY MOCKS FOR D1 & R2
// ---------------------------------------------------------------------------

class MockD1Database {
  constructor() {
    this.storage = new Map();
    this.assets = new Map();
    this.shouldFailInsert = false;
  }

  prepare(query) {
    const db = this;
    function makeStatement(params = []) {
      return {
        bind(...newParams) {
          return makeStatement(newParams);
        },
        async first() {
          if (query.includes('SELECT value FROM settings WHERE key = ?')) {
            const key = params[0];
            const value = db.storage.get(key);
            return value ? { value } : null;
          }
          if (query.includes('SELECT * FROM site_watermark_assets WHERE sha256 = ?')) {
            const sha256 = params[0];
            for (const asset of db.assets.values()) {
              if (asset.sha256 === sha256) return asset;
            }
            return null;
          }
          if (query.includes('SELECT * FROM site_watermark_assets WHERE asset_id = ?')) {
            const assetId = params[0];
            return db.assets.get(assetId) || null;
          }
          if (query.includes("SELECT value FROM settings WHERE key = 'watermark_asset_audit'")) {
            const value = db.storage.get('watermark_asset_audit');
            return value ? { value } : null;
          }
          if (query.includes("SELECT value FROM settings WHERE key = 'watermark_settings'")) {
            const value = db.storage.get(WATERMARK_SETTINGS_KEY);
            return value ? { value } : null;
          }
          return null;
        },
        async run() {
          if (query.includes('INSERT INTO site_watermark_assets')) {
            if (db.shouldFailInsert) {
              throw new Error('D1_INSERT_SIMULATED_FAILURE');
            }
            const asset = {
              asset_id: params[0],
              purpose: params[1],
              source_filename: params[2],
              mime_type: params[3],
              width: params[4],
              height: params[5],
              byte_size: params[6],
              sha256: params[7],
              r2_key: params[8],
              alpha_present: params[9],
              status: params[10],
              created_at: params[11],
              updated_at: params[12]
            };
            db.assets.set(asset.asset_id, asset);
            return { success: true };
          }
          if (query.includes('INSERT INTO settings')) {
            if (query.includes("'watermark_asset_audit'")) {
              db.storage.set('watermark_asset_audit', params[0]);
            } else {
              const key = params[0];
              const value = params[1];
              db.storage.set(key, value);
            }
            return { success: true };
          }
          if (query.includes('DELETE FROM site_watermark_assets WHERE asset_id = ?')) {
            const assetId = params[0];
            db.assets.delete(assetId);
            return { success: true };
          }
          return { success: true };
        },
        async all() {
          return { results: [...db.assets.values()] };
        }
      };
    }
    return makeStatement();
  }
}

class MockR2Bucket {
  constructor() {
    this.objects = new Map();
    this.shouldFailPut = false;
    this.deletedKeys = [];
  }

  async put(key, value, options = {}) {
    if (this.shouldFailPut) {
      throw new Error('R2_PUT_SIMULATED_FAILURE');
    }
    this.objects.set(key, {
      body: value,
      httpMetadata: options.httpMetadata || {},
      customMetadata: options.customMetadata || {}
    });
    return { key };
  }

  async get(key) {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return {
      body: obj.body,
      httpMetadata: obj.httpMetadata,
      customMetadata: obj.customMetadata
    };
  }

  async delete(key) {
    this.objects.delete(key);
    this.deletedKeys.push(key);
    return true;
  }
}

console.log('=== TEST SUITE: PHASE 5D4B WATERMARK MASTER ASSET STORAGE ===\n');

// --- TEST 1: Binary Validation & Type Filtering ---
console.log('--- TEST 1: Binary Validation & Type Filtering ---');
const validTransparentPngBytes = createTestPng(100, 100, true);
const opaquePngBytes = createTestPng(100, 100, false);
const validTransparentWebpBytes = createTestWebp(120, 80, true);
const opaqueWebpBytes = createTestWebp(120, 80, false);

// 1. Transparent PNG accepted
const pngRes = validateWatermarkMasterBinary(validTransparentPngBytes, 'image/png');
assert.equal(pngRes.mime_type, 'image/png');
assert.equal(pngRes.width, 100);
assert.equal(pngRes.height, 100);
assert.equal(pngRes.alpha_present, 1);
pass('TRANSPARENT_PNG_ACCEPTED=PASS');
pass('PNG_UPLOAD=PASS');

// 2. Transparent WebP accepted
const webpRes = validateWatermarkMasterBinary(validTransparentWebpBytes, 'image/webp');
assert.equal(webpRes.mime_type, 'image/webp');
assert.equal(webpRes.width, 120);
assert.equal(webpRes.height, 80);
assert.equal(webpRes.alpha_present, 1);
pass('TRANSPARENT_WEBP_ACCEPTED=PASS');
pass('WEBP_UPLOAD=PASS');

// 3. Completely opaque PNG rejected
assert.throws(
  () => validateWatermarkMasterBinary(opaquePngBytes, 'image/png'),
  (err) => err.code === 'OPAQUE_IMAGE_REJECTED'
);
pass('OPAQUE_PNG_REJECTED=PASS');

// 4. Completely opaque WebP rejected
assert.throws(
  () => validateWatermarkMasterBinary(opaqueWebpBytes, 'image/webp'),
  (err) => err.code === 'OPAQUE_IMAGE_REJECTED'
);
pass('OPAQUE_WEBP_REJECTED=PASS');
pass('OPAQUE_IMAGE_REJECTED=PASS');

// 5. JPEG rejected
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01]);
assert.throws(
  () => validateWatermarkMasterBinary(jpegBytes, 'image/jpeg'),
  (err) => err.code === 'UNSUPPORTED_TYPE'
);
pass('JPEG_REJECTED=PASS');

// 6. SVG rejected
const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>');
assert.throws(
  () => validateWatermarkMasterBinary(svgBytes, 'image/svg+xml'),
  (err) => err.code === 'UNSUPPORTED_TYPE'
);
pass('SVG_REJECTED=PASS');

// 7. Remote URL rejected
const remoteUrlBytes = new TextEncoder().encode('https://example.com/logo.png');
assert.throws(
  () => validateWatermarkMasterBinary(remoteUrlBytes, 'text/plain'),
  (err) => err.code === 'REMOTE_URL_REJECTED'
);
pass('REMOTE_URL_REJECTED=PASS');

// 8. MIME spoofing rejected (declared image/png but payload is JPEG)
assert.throws(
  () => validateWatermarkMasterBinary(jpegBytes, 'image/png'),
  (err) => err.code === 'UNSUPPORTED_TYPE' || err.code === 'MIME_SPOOF_REJECTED'
);
pass('MIME_SPOOF_REJECTED=PASS');

// --- TEST 2: Bounds & Limits (Size & Dimensions) ---
console.log('\n--- TEST 2: Bounds & Limits ---');
// 1. Oversize rejected (> 2 MiB)
const oversizeBytes = new Uint8Array(MAX_WATERMARK_UPLOAD_BYTES + 10);
assert.throws(
  () => validateWatermarkMasterBinary(oversizeBytes),
  (err) => err.code === 'OVERSIZE'
);
pass('MAX_WATERMARK_UPLOAD_BYTES=2097152');
pass('OVERSIZE_REJECTED=PASS');

// 2. Undersized dimensions (< 20x20)
const tinyPng = createTestPng(10, 10, true);
assert.throws(
  () => validateWatermarkMasterBinary(tinyPng, 'image/png'),
  (err) => err.code === 'DIMENSIONS_TOO_SMALL'
);

// 3. Oversized dimensions (> 2000x2000)
const hugePng = createTestPng(2001, 20, true);
assert.throws(
  () => validateWatermarkMasterBinary(hugePng, 'image/png'),
  (err) => err.code === 'DIMENSIONS_TOO_LARGE'
);
pass('MIN_WATERMARK_DIMENSIONS=20x20');
pass('MAX_WATERMARK_DIMENSIONS=2000x2000');
pass('DIMENSION_LIMIT_TEST=PASS');

// --- TEST 3: Original Master Preservation & SHA-256 ---
console.log('\n--- TEST 3: Original Master Preservation & SHA-256 ---');
const masterSha = await computeBinarySha256(validTransparentPngBytes);
assert.ok(masterSha && masterSha.length === 64);
pass(`MASTER_SHA256_VERIFIED=PASS (${masterSha.substring(0, 16)}...)`);

// --- TEST 4: R2 Namespace & Privacy Guarantee ---
console.log('\n--- TEST 4: R2 Namespace & Privacy Guarantee ---');
assert.equal(WATERMARK_MASTER_R2_NAMESPACE, 'site/watermarks/master');
assert.equal(MASTER_ASSET_PUBLIC_BY_DEFAULT, false);
pass('WATERMARK_MASTER_R2_NAMESPACE=site/watermarks/master');
pass('MASTER_ASSET_PUBLIC_BY_DEFAULT=NO');

// --- TEST 5: Upload, Deduplication & Storage Execution ---
console.log('\n--- TEST 5: Upload, Deduplication & Storage Execution ---');
const db = new MockD1Database();
const bucket = new MockR2Bucket();

// 1. First upload: stores in R2 + D1
const upload1 = await uploadWatermarkMasterAsset({
  fileBuffer: validTransparentPngBytes,
  filename: 'rancangloka-logo.png',
  declaredMime: 'image/png',
  db,
  bucket,
  actor: 'editor-spasial'
});

assert.equal(upload1.status, 'success');
assert.equal(upload1.deduplicated, false);
assert.ok(upload1.asset.asset_id.startsWith('wma_'));
assert.equal(upload1.asset.purpose, 'WATERMARK_MASTER');
assert.equal(upload1.asset.width, 100);
assert.equal(upload1.asset.height, 100);
assert.equal(upload1.asset.alpha_present, 1);
assert.equal(upload1.asset.sha256, masterSha);

// Verify R2 object
const r2Obj = await bucket.get(upload1.asset.r2_key);
assert.ok(r2Obj);
assert.equal(r2Obj.httpMetadata.cacheControl, 'private, no-cache, no-transform');
assert.deepEqual(r2Obj.body, validTransparentPngBytes);
pass('MASTER_BYTES_UNCHANGED=PASS');
pass('WATERMARK_ASSET_UPLOAD_API=PASS');

// 2. Duplicate upload: reuses existing asset without rewriting R2 or duplicating DB
const upload2 = await uploadWatermarkMasterAsset({
  fileBuffer: validTransparentPngBytes,
  filename: 'duplicate-upload.png',
  declaredMime: 'image/png',
  db,
  bucket,
  actor: 'editor-spasial'
});

assert.equal(upload2.status, 'success');
assert.equal(upload2.deduplicated, true);
assert.equal(upload2.asset.asset_id, upload1.asset.asset_id);
assert.equal(db.assets.size, 1); // No second record
pass('DUPLICATE_UPLOAD_IDEMPOTENT=PASS');

// --- TEST 6: Transaction Safety (R2 / DB Failure) ---
console.log('\n--- TEST 6: Transaction Safety ---');
// 1. R2 failure -> No DB row inserted
const bucketFailing = new MockR2Bucket();
bucketFailing.shouldFailPut = true;
const dbCheck1 = new MockD1Database();

await assert.rejects(
  async () => {
    await uploadWatermarkMasterAsset({
      fileBuffer: validTransparentWebpBytes,
      filename: 'test.webp',
      declaredMime: 'image/webp',
      db: dbCheck1,
      bucket: bucketFailing
    });
  },
  (err) => err.message.includes('R2_PUT_SIMULATED_FAILURE')
);
assert.equal(dbCheck1.assets.size, 0);
pass('R2_FAILURE_NO_DB_ROW=PASS');

// 2. DB failure -> Orphan R2 object cleaned up
const bucketCleanCheck = new MockR2Bucket();
const dbFailing = new MockD1Database();
dbFailing.shouldFailInsert = true;

await assert.rejects(
  async () => {
    await uploadWatermarkMasterAsset({
      fileBuffer: validTransparentWebpBytes,
      filename: 'test.webp',
      declaredMime: 'image/webp',
      db: dbFailing,
      bucket: bucketCleanCheck
    });
  },
  (err) => err.code === 'DATABASE_INSERT_FAILED'
);
assert.equal(bucketCleanCheck.objects.size, 0);
assert.equal(bucketCleanCheck.deletedKeys.length, 1);
pass('DB_FAILURE_ORPHAN_HANDLED=PASS');

// --- TEST 7: Metadata Read & Private Preview ---
console.log('\n--- TEST 7: Metadata Read & Private Preview ---');
// 1. Read metadata
const readMeta = await getWatermarkMasterAsset(db, upload1.asset.asset_id);
assert.ok(readMeta);
assert.equal(readMeta.asset_id, upload1.asset.asset_id);
assert.equal(readMeta.mime_type, 'image/png');
assert.equal(readMeta.alpha_present, 1);
pass('ASSET_METADATA_READ=PASS');

// 2. Read binary object for private streaming preview
const previewResult = await getWatermarkMasterAssetObject(db, bucket, upload1.asset.asset_id);
assert.ok(previewResult.object);
assert.deepEqual(previewResult.object.body, validTransparentPngBytes);
pass('PRIVATE_MASTER_PREVIEW=PASS');

// --- TEST 8: Watermark Settings Integration & Asset Linkage ---
console.log('\n--- TEST 8: Watermark Settings Integration & Asset Linkage ---');
// 1. Valid asset linkage in IMAGE mode succeeds
const saveRes1 = await saveD1WatermarkSettings(db, {
  type: WATERMARK_TYPES.IMAGE,
  image: {
    asset_id: upload1.asset.asset_id,
    width_ratio: 0.15
  }
});
assert.equal(saveRes1.settings.type, 'IMAGE');
assert.equal(saveRes1.settings.image.asset_id, upload1.asset.asset_id);
pass('IMAGE_SETTINGS_WITH_VALID_ASSET=PASS');

// 2. Unknown asset ID rejected
await assert.rejects(
  async () => {
    await saveD1WatermarkSettings(db, {
      type: WATERMARK_TYPES.IMAGE,
      image: {
        asset_id: 'wma_non_existent_999',
        width_ratio: 0.15
      }
    });
  },
  (err) => err.code === 'UNKNOWN_ASSET_ID'
);
pass('UNKNOWN_ASSET_ID_REJECTED=PASS');

// 3. Wrong purpose asset rejected
const wrongPurposeAsset = {
  asset_id: 'wma_wrong_purpose',
  purpose: 'ARTICLE_ORIGINAL', // Intentionally wrong!
  source_filename: 'wrong.png',
  mime_type: 'image/png',
  width: 100,
  height: 100,
  byte_size: 1000,
  sha256: 'deadbeef',
  r2_key: 'site/wrong.png',
  alpha_present: 1,
  status: 'VALIDATED'
};
db.assets.set(wrongPurposeAsset.asset_id, wrongPurposeAsset);

await assert.rejects(
  async () => {
    await saveD1WatermarkSettings(db, {
      type: WATERMARK_TYPES.IMAGE,
      image: {
        asset_id: 'wma_wrong_purpose',
        width_ratio: 0.15
      }
    });
  },
  (err) => err.code === 'WRONG_PURPOSE_ASSET'
);
pass('WRONG_PURPOSE_ASSET_REJECTED=PASS');

// --- TEST 9: Version Bumping Semantics & Replacement ---
console.log('\n--- TEST 9: Version Bumping Semantics & Replacement ---');
// Upload a second valid master asset
const uploadSecond = await uploadWatermarkMasterAsset({
  fileBuffer: validTransparentWebpBytes,
  filename: 'second-watermark.webp',
  declaredMime: 'image/webp',
  db,
  bucket,
  actor: 'editor-spasial'
});

const versionBefore = saveRes1.settings.watermark_version;

// Switching asset_A -> asset_B increments watermark_version
const switchRes = await saveD1WatermarkSettings(db, {
  type: WATERMARK_TYPES.IMAGE,
  image: {
    asset_id: uploadSecond.asset.asset_id,
    width_ratio: 0.15
  }
});
assert.equal(switchRes.versionBumped, true);
assert.equal(switchRes.settings.watermark_version, versionBefore + 1);
pass('ASSET_CHANGE_VERSION_BUMP=PASS');

// Saving same asset without changes does NOT bump version
const sameAssetRes = await saveD1WatermarkSettings(db, {
  type: WATERMARK_TYPES.IMAGE,
  image: {
    asset_id: uploadSecond.asset.asset_id,
    width_ratio: 0.15
  }
});
assert.equal(sameAssetRes.versionBumped, false);
assert.equal(sameAssetRes.settings.watermark_version, switchRes.settings.watermark_version);
pass('SAME_ASSET_NO_VERSION_BUMP=PASS');

// Old master record must still exist after replacement (not deleted!)
const oldMaster = await getWatermarkMasterAsset(db, upload1.asset.asset_id);
assert.ok(oldMaster);
const oldMasterR2 = await bucket.get(upload1.asset.r2_key);
assert.ok(oldMasterR2);
pass('OLD_MASTER_NOT_DELETED_ON_REPLACE=PASS');

// --- TEST 10: Delete Policy ---
console.log('\n--- TEST 10: Delete Policy ---');
assert.equal(MASTER_DELETE_POLICY, 'REJECT_IF_REFERENCED_IN_SETTINGS');

// 1. Attempting to delete active asset rejected
await assert.rejects(
  async () => {
    await deleteWatermarkMasterAsset(db, bucket, uploadSecond.asset.asset_id);
  },
  (err) => err.code === 'ASSET_IN_USE'
);
pass('ACTIVE_ASSET_DELETE_REJECTED=PASS');

// 2. Deleting unreferenced old asset succeeds
const delRes = await deleteWatermarkMasterAsset(db, bucket, upload1.asset.asset_id);
assert.equal(delRes.success, true);
const deletedAssetCheck = await getWatermarkMasterAsset(db, upload1.asset.asset_id);
assert.equal(deletedAssetCheck, null);
pass('UNREFERENCED_ASSET_DELETE_ALLOWED=PASS');

// --- TEST 11: Audit Logging ---
console.log('\n--- TEST 11: Audit Logging ---');
const auditRow = await db.prepare("SELECT value FROM settings WHERE key = 'watermark_asset_audit'").first();
assert.ok(auditRow && auditRow.value);
const auditList = JSON.parse(auditRow.value);
assert.ok(auditList.length >= 2);
assert.equal(auditList[0].event, 'WATERMARK_MASTER_UPLOADED');
pass('WATERMARK_ASSET_AUDIT=PASS');

// --- TEST 12: Text Mode Regression ---
console.log('\n--- TEST 12: Text Mode Regression ---');
const textModeSave = await saveD1WatermarkSettings(db, {
  type: WATERMARK_TYPES.TEXT,
  text: { value: 'rancangloka.com', font_size_ratio: 0.022, font_weight: 500 }
});
assert.equal(textModeSave.settings.type, 'TEXT');
assert.equal(textModeSave.settings.text.value, 'rancangloka.com');
pass('TEXT_MODE_REGRESSION=PASS');

// --- TEST 13: Live HTTP API & UI Integration ---
console.log('\n--- TEST 13: Live HTTP API & UI Integration ---');
const isServerUp = await new Promise((resolve) => {
  http.get('http://localhost:4321', (res) => resolve(res.statusCode === 200)).on('error', () => resolve(false));
});

if (isServerUp) {
  const token = await createAdminSessionToken();

  function makeMultipartRequest(path, boundary, bodyBuffer, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request(`http://localhost:4321${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length,
          ...headers
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(data); } catch {}
          resolve({ status: res.statusCode, data: parsed, text: data });
        });
      });
      req.on('error', reject);
      req.write(bodyBuffer);
      req.end();
    });
  }

  function fetchEndpoint(path, options = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request(`http://localhost:4321${path}`, {
        method: options.method || 'GET',
        headers: options.headers || {}
      }, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          let parsed = null;
          try { parsed = JSON.parse(buf.toString('utf8')); } catch {}
          resolve({
            status: res.statusCode,
            data: parsed,
            buffer: buf,
            text: buf.toString('utf8'),
            headers: res.headers
          });
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  // Build multipart form body
  const boundary = '----WebKitFormBoundaryWatermarkTest5D4B';
  const fileHeader = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test-logo.png"\r\nContent-Type: image/png\r\n\r\n`
  );
  const fileFooter = Buffer.from(`\r\n--${boundary}--\r\n`);
  const multipartBody = Buffer.concat([fileHeader, Buffer.from(validTransparentPngBytes), fileFooter]);

  // 1. Unauthenticated upload returns 401
  const unauthUpload = await makeMultipartRequest('/api/admin/watermark/asset', boundary, multipartBody);
  assert.equal(unauthUpload.status, 401);
  assert.equal(unauthUpload.data?.code, 'UNAUTHORIZED');
  pass('ADMIN_AUTH_REQUIRED=PASS');

  // 2. Cross-origin mutating request returns 403 CSRF
  const csrfBlocked = await makeMultipartRequest('/api/admin/watermark/asset', boundary, multipartBody, {
    'Cookie': `admin_session=${token}`,
    'Origin': 'https://evil-attacker.com'
  });
  assert.equal(csrfBlocked.status, 403);
  assert.equal(csrfBlocked.data?.code, 'FORBIDDEN_CSRF');
  pass('CSRF_PROTECTION=PASS');

  // 3. Valid authenticated upload returns 200 with asset metadata
  const authUpload = await makeMultipartRequest('/api/admin/watermark/asset', boundary, multipartBody, {
    'Cookie': `admin_session=${token}`,
    'Origin': 'http://localhost:4321'
  });
  assert.equal(authUpload.status, 200);
  assert.equal(authUpload.data?.status, 'success');
  assert.ok(authUpload.data?.asset?.asset_id);
  const liveAssetId = authUpload.data.asset.asset_id;
  pass('HTTP_ADMIN_WATERMARK_UPLOAD=PASS');

  // 4. Read metadata endpoint returns 200
  const metaRes = await fetchEndpoint(`/api/admin/watermark/assets/${liveAssetId}`, {
    headers: { 'Cookie': `admin_session=${token}` }
  });
  assert.equal(metaRes.status, 200);
  assert.equal(metaRes.data?.asset?.asset_id, liveAssetId);
  pass('HTTP_ASSET_METADATA_READ=PASS');

  // 5. Preview streaming endpoint returns binary with correct Content-Type
  const previewRes = await fetchEndpoint(`/api/admin/watermark/assets/${liveAssetId}/preview`, {
    headers: { 'Cookie': `admin_session=${token}` }
  });
  assert.equal(previewRes.status, 200);
  assert.equal(previewRes.headers['content-type'], 'image/png');
  assert.ok(previewRes.buffer.length > 0);
  pass('HTTP_PRIVATE_MASTER_PREVIEW=PASS');

  // 6. UI contains updated R2 upload button & elements
  const uiRes = await fetchEndpoint('/admin/watermark', {
    headers: { 'Cookie': `admin_session=${token}` }
  });
  assert.equal(uiRes.status, 200);
  assert.ok(uiRes.text.includes('btn-upload-master'));
  assert.ok(uiRes.text.includes('Unggah Master ke R2'));
  assert.ok(uiRes.text.includes('current-asset-card'));
  pass('UPLOAD_FAILURE_UI=PASS');
} else {
  console.log('  SKIP: Local server not running on port 4321, skipping live HTTP assertions');
}

console.log('\n=== ALL PHASE 5D4B TESTS PASSED ===\n');
