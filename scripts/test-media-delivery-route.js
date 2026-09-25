/**
 * RancangLoka — Media Delivery Route & Security Test Suite (MEDIA-A4A.1)
 *
 * Deterministic offline test suite for:
 * 1. Single segment delivery backward compatibility (legacy)
 * 2. Nested R2 key delivery (Phase A3 & future pipelines)
 * 3. Deeply nested key delivery
 * 4. Legitimate percent-encoded filename delivery
 * 5. Encoded slash behavior
 * 6. Empty / whitespace key rejection (404)
 * 7. Missing object not-found handling (404)
 * 8. Traversal firewall: '../' rejection (400)
 * 9. Traversal firewall: '%2e%2e' rejection (400)
 * 10. Traversal firewall: backslash rejection (400)
 * 11. Traversal firewall: null byte rejection (400)
 * 12. Traversal firewall: double-decoding attempt rejection (400)
 * 13. Malformed percent encoding rejection (400)
 * 14. Accidental leading slash trimming
 * 15. Fallback mounting for subpaths without leading 'media/'
 * 16. Registry-to-Delivery parity invariant
 */

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { GET as mediaRouteGet } from '../src/pages/media/[...key].ts';

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

class MockR2Bucket {
  constructor() {
    this.objects = new Map();
  }

  seedObject(key, data) {
    this.objects.set(key, {
      key,
      size: data.bytes ? data.bytes.length : (data.size || 100),
      body: data.bytes || Buffer.from('mock image payload'),
      httpEtag: data.etag || 'mock-etag-12345',
      httpMetadata: {
        contentType: data.mime || 'image/png'
      },
      writeHttpMetadata: (headers) => {
        if (data.mime) {
          headers.set('Content-Type', data.mime);
        }
      }
    });
  }

  async get(key) {
    return this.objects.get(key) || null;
  }
}

async function runTests() {
  console.log('=============================================================');
  console.log('  RancangLoka — Media Delivery Route Security & Parity Tests');
  console.log('=============================================================\n');

  const bucket = new MockR2Bucket();

  // Seed test assets
  const legacyKey = 'canary-text-derivative-d89bf7d4.png';
  const a3NestedKey = 'media/canary/media-a3/7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967.png';
  const deeplyNestedKey = 'media/archive/2026/09/25/deep/sample.webp';
  const spacesKey = 'media/test images/space name.png';

  bucket.seedObject(legacyKey, { mime: 'image/png', bytes: Buffer.from('legacy png bytes') });
  bucket.seedObject(a3NestedKey, { mime: 'image/png', bytes: Buffer.from('a3 png bytes') });
  bucket.seedObject(deeplyNestedKey, { mime: 'image/webp', bytes: Buffer.from('deep webp bytes') });
  bucket.seedObject(spacesKey, { mime: 'image/png', bytes: Buffer.from('spaces png bytes') });

  const makeRequest = async (keyParam) => {
    return await mediaRouteGet({
      params: { key: keyParam },
      locals: { runtime: { env: { MEDIA_BUCKET: bucket } } }
    });
  };

  // 1. Legacy Single Segment Delivery
  console.log('--- Test 1: Legacy Single-Segment Delivery ---');
  const resLegacy = await makeRequest(legacyKey);
  assert.equal(resLegacy.status, 200);
  assert.equal(resLegacy.headers.get('Content-Type'), 'image/png');
  assert.equal(await resLegacy.text(), 'legacy png bytes');
  pass('LEGACY_SINGLE_SEGMENT_DELIVERY');

  // 2. A3 Nested Storage Key Delivery
  console.log('\n--- Test 2: A3 Nested Key Delivery ---');
  const resA3 = await makeRequest(a3NestedKey);
  assert.equal(resA3.status, 200);
  assert.equal(resA3.headers.get('Content-Type'), 'image/png');
  assert.equal(await resA3.text(), 'a3 png bytes');
  pass('A3_NESTED_DELIVERY_LOCAL');

  // 3. Deeply Nested Storage Key Delivery
  console.log('\n--- Test 3: Deeply Nested Key Delivery ---');
  const resDeep = await makeRequest(deeplyNestedKey);
  assert.equal(resDeep.status, 200);
  assert.equal(resDeep.headers.get('Content-Type'), 'image/webp');
  assert.equal(await resDeep.text(), 'deep webp bytes');
  pass('DEEPLY_NESTED_DELIVERY');

  // 4. Percent-Encoded Legitimate Path
  console.log('\n--- Test 4: Percent-Encoded Legitimate Path ---');
  const resSpaces = await makeRequest('media/test%20images/space%20name.png');
  assert.equal(resSpaces.status, 200);
  assert.equal(await resSpaces.text(), 'spaces png bytes');
  pass('PERCENT_ENCODED_LEGITIMATE_PATH');

  // 5. Encoded Slash Normalization
  console.log('\n--- Test 5: Encoded Slash Delivery ---');
  const resEncodedSlash = await makeRequest('media%2Fcanary%2Fmedia-a3%2F7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967.png');
  assert.equal(resEncodedSlash.status, 200);
  assert.equal(await resEncodedSlash.text(), 'a3 png bytes');
  pass('ENCODED_SLASH_NORMALIZATION');

  // 6. Subpath Fallback Mounting (omitting leading 'media/')
  console.log('\n--- Test 6: Subpath Fallback Mounting ---');
  const resSubpath = await makeRequest('canary/media-a3/7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967.png');
  assert.equal(resSubpath.status, 200);
  assert.equal(await resSubpath.text(), 'a3 png bytes');
  pass('SUBPATH_FALLBACK_MOUNTING');

  // 7. Accidental Leading Slash Trimming
  console.log('\n--- Test 7: Accidental Leading Slash Trimming ---');
  const resLeadingSlash = await makeRequest('/media/canary/media-a3/7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967.png');
  assert.equal(resLeadingSlash.status, 200);
  pass('LEADING_SLASH_TRIMMING');

  // 8. Empty / Whitespace Key Rejection
  console.log('\n--- Test 8: Empty / Whitespace Key Rejection ---');
  const resEmpty = await makeRequest('');
  assert.equal(resEmpty.status, 404);
  const resWhitespace = await makeRequest('   ');
  assert.equal(resWhitespace.status, 404);
  const resSlashesOnly = await makeRequest('///');
  assert.equal(resSlashesOnly.status, 404);
  pass('EMPTY_KEY_REJECTED');

  // 9. Missing Object Handled
  console.log('\n--- Test 9: Missing Object Handled ---');
  const resMissing = await makeRequest('media/non-existent-image.png');
  assert.equal(resMissing.status, 404);
  pass('MISSING_OBJECT_404');

  // 10. Traversal Attack: '../'
  console.log('\n--- Test 10: Traversal Attack (../) Rejected ---');
  const resTraversal1 = await makeRequest('../secret.env');
  assert.equal(resTraversal1.status, 400);
  const resTraversal2 = await makeRequest('media/canary/../../etc/passwd');
  assert.equal(resTraversal2.status, 400);
  pass('PATH_TRAVERSAL_REJECTED');

  // 11. Traversal Attack: '%2e%2e'
  console.log('\n--- Test 11: Traversal Attack (%2e%2e) Rejected ---');
  const resTraversalEncoded = await makeRequest('%2e%2e/secret.env');
  assert.equal(resTraversalEncoded.status, 400);
  const resTraversalEncodedSub = await makeRequest('media/%2e%2e/secret.env');
  assert.equal(resTraversalEncodedSub.status, 400);
  pass('ENCODED_TRAVERSAL_REJECTED');

  // 12. Traversal Attack: Backslash
  console.log('\n--- Test 12: Backslash Traversal Rejected ---');
  const resBackslash = await makeRequest('media\\canary\\file.png');
  assert.equal(resBackslash.status, 400);
  const resBackslashTraversal = await makeRequest('..\\..\\secret.env');
  assert.equal(resBackslashTraversal.status, 400);
  pass('BACKSLASH_TRAVERSAL_REJECTED');

  // 13. Traversal Attack: Null Byte
  console.log('\n--- Test 13: Null Byte Rejected ---');
  const resNull = await makeRequest('media/file.png\0.txt');
  assert.equal(resNull.status, 400);
  pass('NULL_BYTE_REJECTED');

  // 14. Double-Decoding Traversal Attack (%252e%252e)
  console.log('\n--- Test 14: Double-Decoding Traversal Attempt Rejected ---');
  const resDoubleDecode = await makeRequest('%252e%252e%252fsecret.env');
  assert.equal(resDoubleDecode.status, 400);
  pass('DOUBLE_DECODING_TRAVERSAL_REJECTED');

  // 15. Malformed Percent Encoding
  console.log('\n--- Test 15: Malformed Percent Encoding Rejected ---');
  const resMalformed = await makeRequest('media/file%ZZ.png');
  assert.equal(resMalformed.status, 400);
  pass('MALFORMED_PERCENT_REJECTED');

  // 16. Registry-to-Delivery Parity
  console.log('\n--- Test 16: Registry-to-Delivery Parity Invariant ---');
  // For any registered storage_key, /media/${storage_key} must resolve the exact bytes in R2
  const canonicalA3PublicUrl = `/media/${a3NestedKey}`;
  // Extract path following /media/
  const extractedKey = canonicalA3PublicUrl.replace(/^\/media\//, '');
  assert.equal(extractedKey, a3NestedKey);
  const resParity = await makeRequest(extractedKey);
  assert.equal(resParity.status, 200);
  assert.equal(await resParity.text(), 'a3 png bytes');
  pass('REGISTRY_STORAGE_DELIVERY_PARITY');

  console.log('\n=============================================================');
  console.log(`  ALL ${passed} MEDIA DELIVERY & SECURITY TESTS PASSED!`);
  console.log('=============================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Media Delivery Route Tests Failed:', err);
  process.exit(1);
});
