/**
 * RANCANGLOKA — P0 IMAGE DEDUPLICATION & PUBLIC DERIVATIVE GENERATOR
 * 
 * Executes:
 * 1. Forensic verification of the 3 canonical Kling Omni masters (PNG).
 * 2. Idempotent isolation into private storage: storage/masters/art10011/.
 * 3. Removal/purging of fake .jpg duplicates.
 * 4. Deterministic WebP public derivative generation via renderTextWatermarkDerivative.
 * 5. Update review HTML pages and manifests to reference watermarked public derivatives.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { renderTextWatermarkDerivative } from '../src/lib/media/stored-image-artifact.ts';
import { WATERMARK_SETTINGS_KEY } from '../src/lib/watermark/settings.ts';

const D1_DB_PATH = './.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite';

const CANDIDATES_DIR = path.resolve('public/experimental-media/candidates');
const PRIVATE_MASTERS_DIR = path.resolve('storage/masters/art10011');
const DERIVATIVES_DIR = path.resolve('public/experimental-media/derivatives');

const KNOWN_MASTERS = [
  {
    slot: 'cover',
    fileName: 'art10011_cover_kling_omni.png',
    duplicateJpg: 'art10011_cover_kling_omni.jpg',
    derivativeName: 'art10011_cover_kling_omni_watermarked.webp',
    expectedSha256: '733486f66831ddaf91b5f57da25bc808f50ac58313afae15d79dfaa85ef3d893',
    expectedTaskId: '952232021702233451',
    role: 'context'
  },
  {
    slot: 'inline1',
    fileName: 'art10011_inline1_kling_omni.png',
    duplicateJpg: 'art10011_inline1_kling_omni.jpg',
    derivativeName: 'art10011_inline1_kling_omni_watermarked.webp',
    expectedSha256: 'fcf1e69ee998b209e6ebe14b45ae1ef5d27baf0888fbcb636e5bc35cfba2e699',
    expectedTaskId: '952232682732930619',
    role: 'problem_condition_v1'
  },
  {
    slot: 'inline1_v2',
    fileName: 'art10011_inline1_v2_kling_omni.png',
    duplicateJpg: 'art10011_inline1_v2_kling_omni.jpg',
    derivativeName: 'art10011_inline1_v2_kling_omni_watermarked.webp',
    expectedSha256: 'c1270cdc7f60deefebc8ae93a825695b690d84b7afc8bcc37c2034148a6c814d',
    expectedTaskId: '952247362167128625',
    role: 'problem_condition_v2'
  }
];

function computeSha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function run() {
  console.log('================================================================');
  console.log('📦 RANCANGLOKA — P0 IMAGE DEDUPLICATION & DERIVATIVE PIPELINE');
  console.log('================================================================\n');

  // Ensure directories exist
  fs.mkdirSync(PRIVATE_MASTERS_DIR, { recursive: true });
  fs.mkdirSync(DERIVATIVES_DIR, { recursive: true });

  // Read D1 Watermark Configuration
  let d1Settings = {
    enabled: true,
    type: 'TEXT',
    position: 'bottom-right',
    text: { value: 'rancangloka.com' },
    opacity: 0.62,
    watermark_version: 3
  };

  try {
    const db = new DatabaseSync(D1_DB_PATH);
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(WATERMARK_SETTINGS_KEY);
    if (row && row.value) {
      d1Settings = JSON.parse(row.value);
    }
  } catch (err) {
    console.warn('   ⚠️ D1 read warning, using canonical defaults:', err.message);
  }

  console.log(`[CONFIG] Watermark: text="${d1Settings.text.value}", pos=${d1Settings.position}, opacity=${d1Settings.opacity}`);

  const manifest = {
    article_id: '10',
    article_slug: 'ventilasi-dapur-tanpa-jendela-solusi-cooker-hood-resirkulasi-vs-exhaust-fan-dinding-canary-10011',
    deduplication_timestamp: new Date().toISOString(),
    masters: []
  };

  for (const item of KNOWN_MASTERS) {
    console.log(`\n--- Processing Master: ${item.fileName} (${item.slot}) ---`);

    // Source master file could be in candidates dir or already in private masters dir
    const candidatesPath = path.join(CANDIDATES_DIR, item.fileName);
    const privateMasterPath = path.join(PRIVATE_MASTERS_DIR, item.fileName);

    let sourceMasterBytes;
    if (fs.existsSync(privateMasterPath)) {
      sourceMasterBytes = fs.readFileSync(privateMasterPath);
      console.log(`   ✓ Master exists in private storage: ${privateMasterPath}`);
    } else if (fs.existsSync(candidatesPath)) {
      sourceMasterBytes = fs.readFileSync(candidatesPath);
      console.log(`   ✓ Master found in candidates dir, copying to private storage...`);
      fs.writeFileSync(privateMasterPath, sourceMasterBytes);
      console.log(`   ✓ Copied to: ${privateMasterPath}`);
    } else {
      throw new Error(`Master file not found in candidates or private storage: ${item.fileName}`);
    }

    // Verify SHA-256
    const masterSha = computeSha256(sourceMasterBytes);
    if (masterSha !== item.expectedSha256) {
      throw new Error(`Master SHA mismatch for ${item.fileName}: got ${masterSha}, expected ${item.expectedSha256}`);
    }
    console.log(`   ✓ Verified Master SHA-256: ${masterSha} (Length: ${sourceMasterBytes.length} bytes)`);

    // Remove fake JPG duplicate if present in candidates
    const duplicateJpgPath = path.join(CANDIDATES_DIR, item.duplicateJpg);
    if (fs.existsSync(duplicateJpgPath)) {
      const jpgBytes = fs.readFileSync(duplicateJpgPath);
      const jpgSha = computeSha256(jpgBytes);
      if (jpgSha === masterSha) {
        fs.unlinkSync(duplicateJpgPath);
        console.log(`   ✓ PURGED duplicate JPG (was renamed PNG): ${duplicateJpgPath}`);
      } else {
        console.warn(`   ⚠️ JPG SHA ${jpgSha} does not match master SHA ${masterSha}. Kept for inspection.`);
      }
    } else {
      console.log(`   ✓ No duplicate JPG found in candidates: ${item.duplicateJpg}`);
    }

    // Remove master PNG from public candidates directory to prevent unwatermarked master leakage
    if (fs.existsSync(candidatesPath)) {
      fs.unlinkSync(candidatesPath);
      console.log(`   ✓ PURGED unwatermarked master PNG from public web root: ${candidatesPath}`);
    }

    // Generate WebP Public Derivative with embedded watermark
    const derivativePath = path.join(DERIVATIVES_DIR, item.derivativeName);
    console.log(`   Rendering public WebP derivative with embedded watermark...`);

    const derivativeResult = await renderTextWatermarkDerivative(sourceMasterBytes, {
      text: d1Settings.text.value,
      position: d1Settings.position,
      opacity: d1Settings.opacity,
      format: 'image/webp',
      quality: 88
    });

    fs.writeFileSync(derivativePath, Buffer.from(derivativeResult.derivative_bytes));
    console.log(`   ✓ Public Derivative saved: ${derivativePath}`);
    console.log(`   ✓ Derivative Dimensions: ${derivativeResult.width}x${derivativeResult.height} (${derivativeResult.mime_type})`);
    console.log(`   ✓ Derivative Byte Size: ${derivativeResult.byte_size} bytes (vs Master ${sourceMasterBytes.length} bytes -> ~${Math.round((1 - derivativeResult.byte_size / sourceMasterBytes.length) * 100)}% bandwidth savings)`);
    console.log(`   ✓ Derivative SHA-256: ${derivativeResult.sha256}`);
    console.log(`   ✓ Transform ID: ${derivativeResult.transform_id}`);

    manifest.masters.push({
      slot: item.slot,
      role: item.role,
      task_id: item.expectedTaskId,
      canonical_master: {
        file_name: item.fileName,
        storage_path: privateMasterPath,
        mime_type: 'image/png',
        byte_size: sourceMasterBytes.length,
        sha256: masterSha,
        width: derivativeResult.width,
        height: derivativeResult.height
      },
      public_derivative: {
        file_name: item.derivativeName,
        public_url_path: `/experimental-media/derivatives/${item.derivativeName}`,
        local_path: derivativePath,
        mime_type: 'image/webp',
        byte_size: derivativeResult.byte_size,
        sha256: derivativeResult.sha256,
        transform_id: derivativeResult.transform_id,
        watermark_config_hash: derivativeResult.watermark_config_hash,
        watermark_text: d1Settings.text.value,
        watermark_position: d1Settings.position,
        watermark_opacity: d1Settings.opacity
      }
    });
  }

  // Save Master & Derivative Manifest
  const manifestPath = path.join(PRIVATE_MASTERS_DIR, 'art10011-masters-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n✓ Manifest saved to: ${manifestPath}`);

  // Update Review HTML Pages
  updateReviewPages();

  console.log('\n================================================================');
  console.log('🎉 P0 IMAGE DEDUPLICATION & WATERMARK HARDENING COMPLETED!');
  console.log('================================================================');
}

function updateReviewPages() {
  console.log('\n[UPDATING REVIEW PAGES]');

  // 1. kling-omni-inline1-v2-review.html
  const v2ReviewPath = path.resolve('public/experimental-media/kling-omni-inline1-v2-review.html');
  if (fs.existsSync(v2ReviewPath)) {
    let content = fs.readFileSync(v2ReviewPath, 'utf8');
    // Replace cover img src
    content = content.replace(
      /src="[^"]*art10011_cover_kling_omni\.(png|jpg)"[^>]*>/,
      `src="/experimental-media/derivatives/art10011_cover_kling_omni_watermarked.webp" alt="Cover Anchor (Watermarked Public Derivative)" onclick="window.open(this.src)" style="cursor: pointer;">`
    );
    // Replace inline v2 img src
    content = content.replace(
      /src="[^"]*art10011_inline1_v2_kling_omni\.(png|jpg)"[^>]*>/,
      `src="/experimental-media/derivatives/art10011_inline1_v2_kling_omni_watermarked.webp" alt="Inline 1 Replacement (Watermarked Public Derivative)" onclick="window.open(this.src)" style="cursor: pointer;">`
    );
    fs.writeFileSync(v2ReviewPath, content, 'utf8');
    console.log(`   ✓ Updated: ${v2ReviewPath} -> now loads watermarked WebP derivatives`);
  }

  // 2. kling-omni-photo-first-review.html
  const photoFirstReviewPath = path.resolve('public/experimental-media/kling-omni-photo-first-review.html');
  if (fs.existsSync(photoFirstReviewPath)) {
    let content = fs.readFileSync(photoFirstReviewPath, 'utf8');
    // Replace cover img src
    content = content.replace(
      /src="[^"]*art10011_cover_kling_omni\.(png|jpg)"/,
      `src="/experimental-media/derivatives/art10011_cover_kling_omni_watermarked.webp"`
    );
    // Replace inline 1 img src
    content = content.replace(
      /src="[^"]*art10011_inline1_kling_omni\.(png|jpg)"/,
      `src="/experimental-media/derivatives/art10011_inline1_kling_omni_watermarked.webp"`
    );
    fs.writeFileSync(photoFirstReviewPath, content, 'utf8');
    console.log(`   ✓ Updated: ${photoFirstReviewPath} -> now loads watermarked WebP derivatives`);
  }
}

run().catch((err) => {
  console.error('❌ Pipeline Error:', err);
  process.exit(1);
});
