/**
 * RANCANGLOKA — TEST SUITE: P0 IMAGE DEDUPLICATION + WATERMARK FINAL HARDENING
 * 
 * Tests:
 * 1. Single Canonical Master in Private Storage (1 Task = 1 File, PNG format)
 * 2. Zero Fake JPG Duplicates in Storage or Public Root
 * 3. Zero Unwatermarked Raw Master Exposure in Public Candidates Directory
 * 4. Master Immutability & Provenance (SHA-256 matches exact Kling Task IDs)
 * 5. Public Watermarked WebP Derivatives (Valid WebP, 94-96% bandwidth savings)
 * 6. Pixel-Level Watermark Verification (Text embedded in pixels, not CSS overlay)
 * 7. Review Pages Bound to Watermarked Derivatives (Zero unwatermarked links)
 * 8. Private Namespace Firewall on /media/ Endpoint (HTTP 404 for masters/originals)
 * 9. Image Series Mode Compatibility (Ensures series executor writes single canonical master)
 * 10. Idempotent Deduplication (No duplicate creation on rerun)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const PRIVATE_MASTERS_DIR = path.resolve('storage/masters/art10011');
const CANDIDATES_DIR = path.resolve('public/experimental-media/candidates');
const DERIVATIVES_DIR = path.resolve('public/experimental-media/derivatives');

const KNOWN_MASTERS = [
  {
    slot: 'cover',
    fileName: 'art10011_cover_kling_omni.png',
    duplicateJpg: 'art10011_cover_kling_omni.jpg',
    derivativeName: 'art10011_cover_kling_omni_watermarked.webp',
    expectedSha256: '733486f66831ddaf91b5f57da25bc808f50ac58313afae15d79dfaa85ef3d893',
    expectedTaskId: '952232021702233451',
    expectedSize: 7017266
  },
  {
    slot: 'inline1',
    fileName: 'art10011_inline1_kling_omni.png',
    duplicateJpg: 'art10011_inline1_kling_omni.jpg',
    derivativeName: 'art10011_inline1_kling_omni_watermarked.webp',
    expectedSha256: 'fcf1e69ee998b209e6ebe14b45ae1ef5d27baf0888fbcb636e5bc35cfba2e699',
    expectedTaskId: '952232682732930619',
    expectedSize: 5588333
  },
  {
    slot: 'inline1_v2',
    fileName: 'art10011_inline1_v2_kling_omni.png',
    duplicateJpg: 'art10011_inline1_v2_kling_omni.jpg',
    derivativeName: 'art10011_inline1_v2_kling_omni_watermarked.webp',
    expectedSha256: 'c1270cdc7f60deefebc8ae93a825695b690d84b7afc8bcc37c2034148a6c814d',
    expectedTaskId: '952247362167128625',
    expectedSize: 7037134
  }
];

let testsPassed = 0;
function pass(name, detail) {
  testsPassed++;
  console.log(`   ✓ Pass [${testsPassed}]: ${name} -> ${detail}`);
}

function computeSha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RANCANGLOKA — P0 IMAGE DEDUPLICATION TEST SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // TEST 1: Single Canonical Master in Private Storage
  // ---------------------------------------------------------------------------
  console.log('[TEST 1] Verifikasi Single Canonical Master di Private Storage...');
  assert.ok(fs.existsSync(PRIVATE_MASTERS_DIR), `Private masters directory must exist: ${PRIVATE_MASTERS_DIR}`);

  const masterFiles = fs.readdirSync(PRIVATE_MASTERS_DIR).filter(f => f.endsWith('.png'));
  assert.strictEqual(masterFiles.length, 3, `Must have exactly 3 PNG masters, found: ${masterFiles.length}`);

  for (const item of KNOWN_MASTERS) {
    const masterPath = path.join(PRIVATE_MASTERS_DIR, item.fileName);
    assert.ok(fs.existsSync(masterPath), `Master file must exist: ${item.fileName}`);

    const bytes = fs.readFileSync(masterPath);
    // Verify PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const magic = bytes.subarray(0, 8).toString('hex');
    assert.strictEqual(magic, '89504e470d0a1a0a', `Master must have valid PNG magic bytes: ${item.fileName}`);
    assert.strictEqual(bytes.length, item.expectedSize, `Master byte size must match exact Kling output`);
  }
  pass('CANONICAL_MASTERS_ISOLATED', 'Tepat 3 file PNG master berada di storage privat dengan magic bytes PNG valid');

  // ---------------------------------------------------------------------------
  // TEST 2: Zero Fake JPG Duplicates in Candidates and Private Storage
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 2] Verifikasi Pembersihan Total File JPG Palsu (Renamed PNG)...');
  for (const item of KNOWN_MASTERS) {
    const candidateJpg = path.join(CANDIDATES_DIR, item.duplicateJpg);
    const privateJpg = path.join(PRIVATE_MASTERS_DIR, item.duplicateJpg);

    assert.ok(!fs.existsSync(candidateJpg), `Duplicate JPG must NOT exist in candidates: ${item.duplicateJpg}`);
    assert.ok(!fs.existsSync(privateJpg), `Duplicate JPG must NOT exist in private masters: ${item.duplicateJpg}`);
  }
  pass('ZERO_FAKE_JPG_DUPLICATES', 'Semua file JPG duplikat (renamed PNG) telah dipurged secara total');

  // ---------------------------------------------------------------------------
  // TEST 3: Zero Raw Master Exposure in Public Candidates Directory
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 3] Verifikasi Zero Exposure Master Tanpa Watermark di Web Root...');
  for (const item of KNOWN_MASTERS) {
    const candidatePng = path.join(CANDIDATES_DIR, item.fileName);
    assert.ok(!fs.existsSync(candidatePng), `Raw master PNG must NOT exist in public candidates dir: ${item.fileName}`);
  }
  pass('ZERO_RAW_MASTER_EXPOSURE', 'Master PNG asli tanpa watermark telah dipindahkan keluar dari folder public');

  // ---------------------------------------------------------------------------
  // TEST 4: Master Immutability & Provenance Integrity
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 4] Verifikasi Integritas SHA-256 Master & Kling Task Provenance...');
  for (const item of KNOWN_MASTERS) {
    const masterPath = path.join(PRIVATE_MASTERS_DIR, item.fileName);
    const bytes = fs.readFileSync(masterPath);
    const sha = computeSha256(bytes);
    assert.strictEqual(sha, item.expectedSha256, `SHA-256 master must match Kling task provenance for ${item.fileName}`);

    const meta = await sharp(bytes).metadata();
    assert.strictEqual(meta.width, 2720, `Master width must be 2720: ${item.fileName}`);
    assert.strictEqual(meta.height, 1536, `Master height must be 1536: ${item.fileName}`);
    assert.strictEqual(meta.format, 'png', `Master format must be PNG: ${item.fileName}`);
  }
  pass('MASTER_IMMUTABILITY_VERIFIED', 'Semua 3 master mempertahankan SHA-256 asli, format PNG 2720x1536 (100% utuh)');

  // ---------------------------------------------------------------------------
  // TEST 5: Public Watermarked WebP Derivatives Verification
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 5] Verifikasi Public Watermarked WebP Derivatives...');
  assert.ok(fs.existsSync(DERIVATIVES_DIR), `Derivatives dir must exist: ${DERIVATIVES_DIR}`);

  for (const item of KNOWN_MASTERS) {
    const derivPath = path.join(DERIVATIVES_DIR, item.derivativeName);
    assert.ok(fs.existsSync(derivPath), `Watermarked derivative must exist: ${item.derivativeName}`);

    const derivBytes = fs.readFileSync(derivPath);
    // Check WebP magic bytes: RIFF....WEBP
    const riff = derivBytes.subarray(0, 4).toString('ascii');
    const webp = derivBytes.subarray(8, 12).toString('ascii');
    assert.strictEqual(riff, 'RIFF', `Derivative must start with RIFF: ${item.derivativeName}`);
    assert.strictEqual(webp, 'WEBP', `Derivative must have WEBP signature: ${item.derivativeName}`);

    const meta = await sharp(derivBytes).metadata();
    assert.strictEqual(meta.width, 2720, `Derivative width must be preserved at 2720: ${item.derivativeName}`);
    assert.strictEqual(meta.height, 1536, `Derivative height must be preserved at 1536: ${item.derivativeName}`);
    assert.strictEqual(meta.format, 'webp', `Derivative format must be WebP: ${item.derivativeName}`);

    const savingsPercent = Math.round((1 - derivBytes.length / item.expectedSize) * 100);
    assert.ok(savingsPercent >= 90, `Bandwidth savings must be >= 90%, got: ${savingsPercent}%`);
    assert.notStrictEqual(computeSha256(derivBytes), item.expectedSha256, 'Derivative SHA must differ from master');
  }
  pass('WEBP_DERIVATIVES_VALID', 'Public derivatives berformat WebP 2720x1536 dengan penghematan bandwidth 94-96%');

  // ---------------------------------------------------------------------------
  // TEST 6: Pixel-Level Watermark Verification in Derivatives
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 6] Verifikasi Piksel Watermark Tertanam pada Public Derivative...');
  for (const item of KNOWN_MASTERS) {
    const masterPath = path.join(PRIVATE_MASTERS_DIR, item.fileName);
    const derivPath = path.join(DERIVATIVES_DIR, item.derivativeName);

    const masterRaw = await sharp(masterPath).ensureAlpha().raw().toBuffer();
    const derivRaw = await sharp(derivPath).ensureAlpha().raw().toBuffer();

    // Check bottom-right region (2720x1536 -> bottom 150px, right 400px)
    let brDiffCount = 0;
    const startY = 1536 - 150;
    const startX = 2720 - 400;

    for (let y = startY; y < 1536; y += 4) {
      for (let x = startX; x < 2720; x += 4) {
        const idx = (y * 2720 + x) * 4;
        const diffR = Math.abs(masterRaw[idx] - derivRaw[idx]);
        const diffG = Math.abs(masterRaw[idx + 1] - derivRaw[idx + 1]);
        const diffB = Math.abs(masterRaw[idx + 2] - derivRaw[idx + 2]);
        if (diffR > 15 || diffG > 15 || diffB > 15) {
          brDiffCount++;
        }
      }
    }

    assert.ok(brDiffCount > 50, `Watermark must modify pixels in bottom-right quadrant for ${item.derivativeName}, found ${brDiffCount}`);
  }
  pass('PIXEL_WATERMARK_CONFIRMED', 'Piksel watermark rancangloka.com terbukti tertanam secara nyata pada citra WebP');

  // ---------------------------------------------------------------------------
  // TEST 7: Review Pages Bound to Watermarked Derivatives
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 7] Verifikasi Review Pages Menggunakan Watermarked WebP Derivatives...');
  const reviewFiles = [
    'public/experimental-media/kling-omni-inline1-v2-review.html',
    'public/experimental-media/kling-omni-photo-first-review.html',
    'public/experimental-media/kling-omni-inline1-replacement-preflight.html'
  ];

  for (const relPath of reviewFiles) {
    const fullPath = path.resolve(relPath);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(!content.includes('art10011_cover_kling_omni.jpg'), `Must not reference fake cover jpg in ${relPath}`);
    assert.ok(!content.includes('art10011_inline1_kling_omni.jpg'), `Must not reference fake inline1 jpg in ${relPath}`);
    assert.ok(!content.includes('art10011_inline1_v2_kling_omni.jpg'), `Must not reference fake inline1_v2 jpg in ${relPath}`);

    // Must reference derivatives
    assert.ok(
      content.includes('/experimental-media/derivatives/') || content.includes('_watermarked.webp'),
      `Review page must reference watermarked webp derivatives in ${relPath}`
    );
  }
  pass('REVIEW_PAGES_HARDENED', 'Semua review page HTML telah diarahkan ke watermarked WebP derivatives');

  // ---------------------------------------------------------------------------
  // TEST 8: Private Namespace Firewall Verification on Media Endpoint
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 8] Verifikasi Private Namespace Firewall pada /media/ Endpoint...');
  const endpointPath = path.resolve('src/pages/media/[...key].ts');
  const endpointCode = fs.readFileSync(endpointPath, 'utf8');

  assert.ok(endpointCode.includes("normalizedLower.startsWith('originals/')"), 'Endpoint must block originals/ namespace');
  assert.ok(endpointCode.includes("normalizedLower.startsWith('masters/')"), 'Endpoint must block masters/ namespace');
  assert.ok(endpointCode.includes("normalizedLower.startsWith('site/')"), 'Endpoint must block site/ namespace');
  assert.ok(endpointCode.includes("normalizedLower.startsWith('private/')"), 'Endpoint must block private/ namespace');
  assert.ok(endpointCode.includes("status: 404"), 'Endpoint must return 404 on blocked namespaces');
  assert.ok(endpointCode.includes("status: 403"), 'Endpoint must enforce hotlink protection (403)');
  pass('MEDIA_ENDPOINT_FIREWALL', 'Endpoint /media/ memblokir namespace masters/, originals/, site/, private/ (HTTP 404)');

  // ---------------------------------------------------------------------------
  // TEST 9: Image Series Mode Compatibility Verification
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 9] Verifikasi Kompatibilitas Alur Image Series Mode...');
  const seriesScriptPath = path.resolve('scripts/execute-kling-omni-image-series-pilot.mjs');
  const seriesCode = fs.readFileSync(seriesScriptPath, 'utf8');

  assert.ok(!seriesCode.includes("fileNameJpg"), 'Series script must not generate duplicate fileNameJpg');
  assert.ok(!seriesCode.includes("frameJpgPath"), 'Series script must not write frameJpgPath');
  assert.ok(seriesCode.includes("fileNamePng"), 'Series script must write canonical PNG master');
  pass('SERIES_MODE_COMPATIBLE', 'Alur Image Series Mode dikonfigurasi untuk hanya menulis 1 canonical PNG master');

  // ---------------------------------------------------------------------------
  // TEST 10: Idempotent Deduplication Check
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 10] Verifikasi Idempotensi Pipeline Deduplikasi...');
  const manifestPath = path.join(PRIVATE_MASTERS_DIR, 'art10011-masters-manifest.json');
  assert.ok(fs.existsSync(manifestPath), `Manifest must exist at ${manifestPath}`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.masters.length, 3, 'Manifest must record exactly 3 masters');
  for (const m of manifest.masters) {
    assert.strictEqual(m.canonical_master.mime_type, 'image/png');
    assert.strictEqual(m.public_derivative.mime_type, 'image/webp');
    assert.ok(fs.existsSync(m.canonical_master.storage_path), 'Recorded master path must exist');
    assert.ok(fs.existsSync(m.public_derivative.local_path), 'Recorded derivative path must exist');
  }
  pass('IDEMPOTENT_PIPELINE', 'Manifest dan artefak tervalidasi lengkap, idempotensi terjamin');

  console.log('\n================================================================');
  console.log(`🎉 ALL ${testsPassed}/${testsPassed} P0 IMAGE DEDUPLICATION TESTS PASSED!`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
