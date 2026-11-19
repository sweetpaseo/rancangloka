/**
 * RANCANGLOKA — P0 WATERMARK & IMAGE PROTECTION AUDIT SUITE
 * 
 * Verifies:
 * 1. D1 Watermark Settings & Active Configuration
 * 2. Watermark Engine Execution (renderTextWatermarkDerivative via Sharp)
 * 3. Pixel-Level Watermark Verification on Real Kling Omni Images
 * 4. Original Master Immutability & Preservation
 * 5. Private R2 Namespace Firewall (site/, originals/, masters/, private/)
 * 6. Edge Hotlink Protection & Scraper Defense
 * 7. Fail-Closed Publication Gate (Block Unwatermarked Media)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';

import {
  getD1WatermarkSettings,
  DEFAULT_WATERMARK_SETTINGS,
  WATERMARK_SETTINGS_KEY
} from '../src/lib/watermark/settings.ts';
import { renderTextWatermarkDerivative } from '../src/lib/media/stored-image-artifact.ts';
import { FAILURE_CODES } from '../src/lib/publication/types.ts';
import { evaluateArticleReadiness } from '../src/lib/publication/service.ts';

const D1_DB_PATH = './.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite';
const R2_DB_PATH = './.wrangler/state/v3/r2/miniflare-R2BucketObject/fa392ec9dba5040548372163b7e3e8e28dc6979a5d1f8eea06f57eec6bba6edf.sqlite';

const PRIVATE_MASTERS_DIR = path.resolve('storage/masters/art10011');
const CANDIDATES_DIR = path.resolve('public/experimental-media/candidates');

const COVER_PATH = fs.existsSync(path.join(PRIVATE_MASTERS_DIR, 'art10011_cover_kling_omni.png'))
  ? path.join(PRIVATE_MASTERS_DIR, 'art10011_cover_kling_omni.png')
  : path.join(CANDIDATES_DIR, 'art10011_cover_kling_omni.png');

const INLINE_PATH = fs.existsSync(path.join(PRIVATE_MASTERS_DIR, 'art10011_inline1_v2_kling_omni.png'))
  ? path.join(PRIVATE_MASTERS_DIR, 'art10011_inline1_v2_kling_omni.png')
  : path.join(CANDIDATES_DIR, 'art10011_inline1_v2_kling_omni.png');

let passedTests = 0;
function pass(msg) {
  passedTests++;
  console.log(`   ✓ Pass: ${msg}`);
}

async function runAudit() {
  console.log('================================================================');
  console.log('🛡️ RANCANGLOKA — P0 WATERMARK & IMAGE PROTECTION AUDIT SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Audit D1 Watermark Settings
  // ---------------------------------------------------------------------------
  console.log('[AUDIT 1] Memeriksa Konfigurasi Watermark Aktif di D1...');
  const db = new DatabaseSync(D1_DB_PATH);
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(WATERMARK_SETTINGS_KEY);
  assert.ok(row, 'Row watermark_settings wajib ada di D1');
  const d1Settings = JSON.parse(row.value);

  assert.strictEqual(d1Settings.enabled, true, 'Watermark wajib aktif (enabled: true)');
  assert.strictEqual(d1Settings.type, 'TEXT', 'Tipe watermark harus TEXT');
  assert.strictEqual(d1Settings.position, 'bottom-right', 'Posisi watermark harus bottom-right');
  assert.strictEqual(d1Settings.text.value, 'rancangloka.com', 'Teks watermark harus rancangloka.com');
  assert.strictEqual(d1Settings.opacity, 0.62, 'Opacity watermark harus 0.62 (halus)');
  pass(`D1 Settings: enabled=${d1Settings.enabled}, text="${d1Settings.text.value}", pos=${d1Settings.position}, opacity=${d1Settings.opacity}, version=${d1Settings.watermark_version}`);

  // ---------------------------------------------------------------------------
  // 2. Audit & Test renderTextWatermarkDerivative on Existing Kling Omni Images
  // ---------------------------------------------------------------------------
  console.log('\n[AUDIT 2] Menguji renderTextWatermarkDerivative pada Citra Kling Asli...');
  assert.ok(fs.existsSync(COVER_PATH), `File cover Kling asli harus ada di ${COVER_PATH}`);
  assert.ok(fs.existsSync(INLINE_PATH), `File inline Kling asli harus ada di ${INLINE_PATH}`);

  const origCoverBytes = fs.readFileSync(COVER_PATH);
  const origCoverSha = crypto.createHash('sha256').update(origCoverBytes).digest('hex');
  const origCoverSize = origCoverBytes.length;

  const origInlineBytes = fs.readFileSync(INLINE_PATH);
  const origInlineSha = crypto.createHash('sha256').update(origInlineBytes).digest('hex');
  const origInlineSize = origInlineBytes.length;

  // Generate Cover Derivative
  const coverDerivative = await renderTextWatermarkDerivative(origCoverBytes, {
    text: d1Settings.text.value,
    position: d1Settings.position,
    opacity: d1Settings.opacity
  });

  // Verify Cover Derivative
  assert.strictEqual(coverDerivative.width, 2720, 'Lebar cover derivative wajib 2720 px (preserved)');
  assert.strictEqual(coverDerivative.height, 1536, 'Tinggi cover derivative wajib 1536 px (preserved)');
  assert.notStrictEqual(coverDerivative.sha256, origCoverSha, 'SHA-256 derivative wajib berbeda dari master original');
  assert.strictEqual(fs.readFileSync(COVER_PATH).length, origCoverSize, 'File master original dilarang berubah (byte immutable)');
  assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(COVER_PATH)).digest('hex'), origCoverSha, 'SHA master original dilarang berubah');
  pass(`Cover Derivative: ${coverDerivative.width}x${coverDerivative.height}, SHA=${coverDerivative.sha256.substring(0, 16)}..., transform_id=${coverDerivative.transform_id.substring(0, 16)}...`);
  pass(`Master Cover Immutability: SHA tetap ${origCoverSha.substring(0, 16)}... (100% untouched)`);

  // Generate Inline Derivative
  const inlineDerivative = await renderTextWatermarkDerivative(origInlineBytes, {
    text: d1Settings.text.value,
    position: d1Settings.position,
    opacity: d1Settings.opacity
  });

  assert.strictEqual(inlineDerivative.width, 2720, 'Lebar inline derivative wajib 2720 px');
  assert.strictEqual(inlineDerivative.height, 1536, 'Tinggi inline derivative wajib 1536 px');
  assert.notStrictEqual(inlineDerivative.sha256, origInlineSha, 'SHA-256 inline derivative wajib berbeda dari master original');
  pass(`Inline Derivative: ${inlineDerivative.width}x${inlineDerivative.height}, SHA=${inlineDerivative.sha256.substring(0, 16)}...`);

  // ---------------------------------------------------------------------------
  // 3. Pixel-Level Verification: Embedded into Pixels vs CSS Overlay
  // ---------------------------------------------------------------------------
  console.log('\n[AUDIT 3] Memverifikasi Watermark Tertanam di Piksel (Bukan CSS Overlay)...');
  const origRaw = await sharp(origCoverBytes).ensureAlpha().raw().toBuffer();
  const derivRaw = await sharp(Buffer.from(coverDerivative.derivative_bytes)).ensureAlpha().raw().toBuffer();

  // In bottom-right quadrant (where watermark is placed), pixels must differ
  const width = 2720;
  const height = 1536;
  const channels = 4; // RGBA
  let watermarkRegionDiffs = 0;
  let topLeftQuadrantDiffs = 0;

  // Sample bottom-right region (x: 2300..2700, y: 1400..1520)
  for (let y = 1420; y < 1520; y++) {
    for (let x = 2320; x < 2680; x++) {
      const idx = (y * width + x) * channels;
      if (origRaw[idx] !== derivRaw[idx] || origRaw[idx + 1] !== derivRaw[idx + 1] || origRaw[idx + 2] !== derivRaw[idx + 2]) {
        watermarkRegionDiffs++;
      }
    }
  }

  // Sample top-left region (x: 50..400, y: 50..200) where no watermark exists
  for (let y = 50; y < 200; y++) {
    for (let x = 50; x < 400; x++) {
      const idx = (y * width + x) * channels;
      if (origRaw[idx] !== derivRaw[idx] || origRaw[idx + 1] !== derivRaw[idx + 1] || origRaw[idx + 2] !== derivRaw[idx + 2]) {
        topLeftQuadrantDiffs++;
      }
    }
  }

  assert.ok(watermarkRegionDiffs > 500, `Watermark wajib tertanam di piksel kuadran kanan bawah (ditemukan ${watermarkRegionDiffs} piksel termodifikasi)`);
  assert.strictEqual(topLeftQuadrantDiffs, 0, `Kuadran kiri atas wajib 100% identik dengan master original (ditemukan ${topLeftQuadrantDiffs} perbedaan)`);
  pass(`Pixel Proof: ${watermarkRegionDiffs} piksel termodifikasi di area teks watermark kanan bawah; area kiri atas 100% identik.`);

  // ---------------------------------------------------------------------------
  // 4. Audit Cloudflare Media Endpoint & Private Namespace Protection
  // ---------------------------------------------------------------------------
  console.log('\n[AUDIT 4] Memverifikasi Proteksi Endpoint Publik & Namespace Privat R2...');
  
  // Test 4A: Private master asset access MUST be blocked (404)
  const masterUrl = 'http://localhost:4321/media/site/watermarks/master/3b1b93ae9ab436a08a77f1b36fa02f0b193e46fa4a14b0c7cf8d3dd80c4d47c1.png';
  const masterRes = await fetch(masterUrl);
  assert.strictEqual(masterRes.status, 404, 'Master asset di namespace site/ wajib mengembalikan status 404 Not Found');
  pass('Master Watermark in R2 (site/watermarks/master/...) -> HTTP 404 BLOCKED (Fail-Closed)');

  // Test 4B: Originals namespace MUST be blocked (404)
  const origRes = await fetch('http://localhost:4321/media/originals/secret_master.png');
  assert.strictEqual(origRes.status, 404, 'Namespace originals/ wajib diblokir dengan 404');
  pass('Private namespace (originals/...) -> HTTP 404 BLOCKED');

  // Test 4C: Public Derivative MUST be accessible (200)
  const publicDerivUrl = 'http://localhost:4321/media/articles/derivatives/458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff.png';
  const derivRes = await fetch(publicDerivUrl);
  assert.strictEqual(derivRes.status, 200, 'Public derivative yang sah wajib mengembalikan HTTP 200');
  assert.strictEqual(derivRes.headers.get('content-type'), 'image/png', 'Content-type derivative harus image/png');
  pass('Public Derivative (media/articles/derivatives/...) -> HTTP 200 OK (Served Cleanly)');

  // ---------------------------------------------------------------------------
  // 5. Audit Hotlink Protection & Scraper Defense
  // ---------------------------------------------------------------------------
  console.log('\n[AUDIT 5] Menguji Hotlink Protection & Scraper Defense...');
  
  // Test 5A: Hotlinking from unauthorized third-party domain MUST be rejected (403)
  const hotlinkRes = await fetch(publicDerivUrl, {
    headers: { referer: 'https://malicious-pirate-aggregator.com/post/123' }
  });
  assert.strictEqual(hotlinkRes.status, 403, 'Permintaan hotlink pihak ketiga wajib ditolak dengan 403 Forbidden');
  pass('Unauthorized Third-Party Referer -> HTTP 403 FORBIDDEN (Hotlink Blocked)');

  // Test 5B: Internal referer MUST be allowed (200)
  const internalRes = await fetch(publicDerivUrl, {
    headers: { referer: 'https://rancangloka.com/arsitektur/dapur-kompak' }
  });
  assert.strictEqual(internalRes.status, 200, 'Permintaan dari domain internal rancangloka.com wajib diizinkan');
  pass('Internal Referer (rancangloka.com) -> HTTP 200 OK');

  // Test 5C: Search engines (Google, Bing) MUST be allowed (200)
  const googleRes = await fetch(publicDerivUrl, {
    headers: { referer: 'https://www.google.com/' }
  });
  assert.strictEqual(googleRes.status, 200, 'Mesin pencari Google Images wajib diizinkan');
  pass('Search Engine Referer (google.com) -> HTTP 200 OK (SEO Friendly)');

  // Test 5D: Direct request with no referer (browser address bar, apps) MUST be allowed (200)
  const directRes = await fetch(publicDerivUrl);
  assert.strictEqual(directRes.status, 200, 'Permintaan langsung tanpa referer wajib diizinkan');
  pass('Direct Navigation (No Referer) -> HTTP 200 OK');

  // ---------------------------------------------------------------------------
  // 6. Audit robots.txt for Experimental Media
  // ---------------------------------------------------------------------------
  console.log('\n[AUDIT 6] Memverifikasi Kebijakan robots.txt...');
  const robotsTxt = fs.readFileSync('public/robots.txt', 'utf8');
  assert.ok(robotsTxt.includes('Disallow: /experimental-media/'), 'robots.txt wajib mendisallow /experimental-media/');
  pass('robots.txt: Disallow: /experimental-media/ terverifikasi aktif.');

  // ---------------------------------------------------------------------------
  // 7. Audit Fail-Closed Publication Gate
  // ---------------------------------------------------------------------------
  console.log('\n[AUDIT 7] Menguji Fail-Closed Publication Gate pada Media Tanpa Watermark...');
  
  // Test mock D1 with an article having an unwatermarked raw master (role: ORIGINAL)
  const mockD1 = {
    prepare(sql) {
      return {
        _args: [],
        bind(...args) {
          this._args = args;
          return this;
        },
        async first() {
          if (sql.includes('FROM articles a')) {
            return {
              id: 999,
              slug: 'test-unwatermarked-article',
              status: 'draft',
              title: 'Judul Valid Uji Coba Perlindungan Gambar Master RancangLoka',
              description: 'Deskripsi valid dengan panjang yang cukup untuk memenuhi batas minimal editorial.',
              content_md: '## Pembahasan\n\nIsi artikel pengujian yang valid.',
              content_html: '<h2>Pembahasan</h2><p>Isi artikel pengujian yang valid.</p>',
              content_hash: 'hash123',
              category_id: 1,
              category_name: 'Desain',
              category_slug: 'desain',
              author_id: 1,
              author_name: 'Irwan Santoso',
              author_slug: 'irwan-santoso',
              takeaways: '["Poin 1", "Poin 2", "Poin 3"]'
            };
          }
          if (sql.includes("role = 'featured'")) {
            return {
              id: 1,
              asset_id: 'ast_unwatermarked_raw',
              role: 'featured',
              is_active: 1,
              asset_status: 'VALIDATED',
              media_type: 'image',
              width: 1200,
              height: 675,
              alt_text: 'Foto dapur tanpa watermark',
              media_role: 'ORIGINAL', // Raw unwatermarked master!
              derivative_id: null,
              source_type: 'kling_generated'
            };
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { meta: { changes: 1 } };
        }
      };
    }
  };

  const readiness = await evaluateArticleReadiness(mockD1, 999, { skipCache: true });
  assert.strictEqual(readiness.is_ready, false, 'Artikel dengan media ORIGINAL tanpa watermark dilarang siap publikasi');
  assert.ok(
    readiness.blockers.includes(FAILURE_CODES.MEDIA_WATERMARK_MISSING),
    `Blocker MEDIA_WATERMARK_MISSING wajib tercatat (ditemukan blockers: ${JSON.stringify(readiness.blockers)})`
  );
  pass('Publication Gate: Artikel dengan media ORIGINAL/Unwatermarked AI tertolak deterministik dengan blocker MEDIA_WATERMARK_MISSING.');

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`🎉 ALL ${passedTests}/${passedTests} P0 WATERMARK & IMAGE PROTECTION AUDIT TESTS PASSED!`);
  console.log('================================================================\n');
}

runAudit().catch((err) => {
  console.error('\n❌ AUDIT FAILED:', err);
  process.exit(1);
});
