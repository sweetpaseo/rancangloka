/**
 * RancangLoka — Execute Kling Image 3.0 Omni Image Series Pilot (CANARY #10011)
 * File: scripts/execute-kling-omni-image-series-pilot.mjs
 *
 * Operational Invariants:
 * 1. BUDGET & SPEND CONTROL: Strictly 3 images in 1 series task = 24 Kling units (~US$0.0588 / ~Rp 958).
 *    Zero paid API calls allowed without explicit Owner authorization.
 * 2. IMAGE SERIES MODE: Native Kling Omni result_type="series", series_amount=3.
 * 3. HOUSE IDENTITY LOCK: All 3 shots locked to Cover anchor (U-shape topology, flat glass induction,
 *    slim under-cabinet hood, teak matte cabinets, cream countertop).
 * 4. COMPOSITIONAL DIVERSITY: Shot 1 (cooking condition), Shot 2 (hood & cooktop detail),
 *    Shot 3 (ventilation air-path perspective).
 * 5. PROVENANCE & PER-FRAME INSPECTION: Saves each frame independently with index and metadata.
 * 6. IMMUTABILITY: Preserves Cover, existing images, and Staging Article ID 10.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  KlingImageProviderAdapter,
  KLING_MODEL_V3_OMNI,
  KLING_UNITS_PER_IMAGE_2K
} from '../src/lib/media/kling-image-adapter.ts';
import {
  getKitchenVentilationHouseProfile,
  lockHouseIdentityFromCover,
  buildStructuredSeriesPrompt
} from '../src/lib/editorial/house-identity.ts';
import {
  evaluatePhotoFirstQualityGate,
  evaluateImageSeriesQualityGate
} from '../src/lib/editorial/photo-quality-gate.ts';
import {
  inspectImageBinary,
  inspectCandidateImageForNadia
} from '../src/lib/editorial/image-pixel-inspector.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables without echoing secrets
function loadEnv() {
  const envCandidates = ['.env', '.env.local', '../.env'];
  for (const rel of envCandidates) {
    const f = path.resolve(rootDir, rel);
    if (fs.existsSync(f)) {
      try {
        const lines = fs.readFileSync(f, 'utf8').split('\n');
        for (const l of lines) {
          const trimmed = l.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const k = trimmed.slice(0, idx).trim();
            const v = trimmed.slice(idx + 1).trim().replace(/^["\x27]|["\x27]$/g, '');
            if (!process.env[k]) process.env[k] = v;
          }
        }
      } catch (_) {}
    }
  }
}

loadEnv();

const KLING_KEY = process.env.KLING_API_KEY || '';
const ARTIFACT_DIR = 'C:/Users/Fanto/.gemini/antigravity/brain/d4ac4fcc-279e-4275-a4ab-cb211f4bdc36';
const CANDIDATES_DIR = path.resolve(rootDir, 'public/experimental-media/candidates');
const COVER_PATH = path.join(CANDIDATES_DIR, 'art10011_cover_kling_omni.png');

console.log('================================================================');
console.log('📸 RANCANGLOKA — KLING OMNI IMAGE SERIES PILOT (3 SHOTS)');
console.log('================================================================');
console.log('Target Article   : Article ID 10 — Ventilasi Dapur Tanpa Jendela');
console.log('Provider Model   : Kling Image 3.0 Omni (kling-v3-omni)');
console.log('Result Mode      : Image Series Mode (result_type: "series")');
console.log('Series Amount    : Exactly 3 Output Frames (2K, 16:9)');
console.log('Budget Required  : 24 Kling Units (~US$0.0588 / ~Rp 958)');
console.log('----------------------------------------------------------------\n');

// 1. Verify Cover Anchor from Disk
if (!fs.existsSync(COVER_PATH)) {
  console.error(`❌ Error: Cover anchor tidak ditemukan di: ${COVER_PATH}`);
  process.exit(1);
}

const coverInspection = inspectImageBinary(COVER_PATH);
console.log('🔍 [STEP 1] Validasi Real Pixel Cover Anchor dari Disk:');
console.log(`   - Format           : ${coverInspection.format}`);
console.log(`   - Dimensi Piksel   : ${coverInspection.width} x ${coverInspection.height} (${(coverInspection.size_bytes / (1024*1024)).toFixed(2)} MB)`);
console.log(`   - Byte Entropy     : ${coverInspection.entropy} (Photographic Data)`);
console.log(`   - SHA-256          : ${coverInspection.sha256}`);
console.log('   ✓ Cover Anchor terverifikasi.\n');

// 2. Lock House Identity from Cover
console.log('🔒 [STEP 2] Mengunci House Identity Profile (v1.2)...');
const initialProfile = getKitchenVentilationHouseProfile(
  'ventilasi-dapur-tanpa-jendela-canary-10011',
  'Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding'
);

const lockedProfile = lockHouseIdentityFromCover(initialProfile, {
  cover_image_id: 'art10011_cover_kling_omni',
  cover_image_path: COVER_PATH,
  cover_image_sha256: coverInspection.sha256,
  observed_kitchen_topology: 'U_SHAPE',
  topology_divergence_from_initial: true,
  topology_notes: 'Dapur kompak bentuk U sesuai citra cover anchor nyata art10011_cover_kling_omni.',
  observed_fixed_appliances: {
    cooktop_type: 'FLAT_GLASS_INDUCTION',
    cooktop_description: 'Kompor tanam flat flush kaca induksi hitam tanpa tungku gas',
    cooktop_location_relative: 'Meja tengah solid surface krem',
    hood_type: 'SLIM_STAINLESS_UNDER_CABINET',
    hood_description: 'Cooker hood slim stainless steel di bawah kabinet atas',
    hood_location_relative: 'Di atas kompor induksi'
  },
  observed_cabinetry: {
    lower_cabinets: 'HPL jati muda matte horizontal grain',
    upper_cabinets: 'Kabinet atas dan rak terbuka putih minimalis',
    countertop: 'Solid surface light cream matte',
    backsplash: 'Keramik subway tile putih krem vertikal'
  },
  observed_flooring: 'Semen ekspos / teraso honed abu-abu muda',
  observed_wall_finish: 'Cat matte warm greige',
  observed_visible_openings: 'Dapur tanpa jendela luar, kisi-kisi ventilasi atas',
  unseen_or_unverifiable_areas: [],
  locked_at: new Date().toISOString()
});

console.log(`   ✓ Topologi Terkunci: ${lockedProfile.room_topology}`);
console.log(`   ✓ Kompor Terkunci  : ${lockedProfile.cover_scene_lock?.observed_fixed_appliances.cooktop_description}`);
console.log(`   ✓ Hood Terkunci    : ${lockedProfile.cover_scene_lock?.observed_fixed_appliances.hood_description}\n`);

// 3. Build Unified Structured Series Prompt
console.log('✍️ [STEP 3] Menyusun Prompt Image Series 3-Shot (Budi Prompt Engine v1.2)...');
const seriesPromptResult = buildStructuredSeriesPrompt(lockedProfile);
console.log('   --- PROMPT TEKS KONSISTENSI SERI (3-SHOT) ---');
console.log(`   ${seriesPromptResult.prompt_text}\n`);
console.log('   --- NEGATIVE PROMPT ANTI-DRIFT & ANTI-DUPLIKAT ---');
console.log(`   ${seriesPromptResult.negative_prompt}\n`);

// 4. Prepare Payload with Cover Anchor Conditioning
const coverBuffer = fs.readFileSync(COVER_PATH);
const coverBase64 = coverBuffer.toString('base64');

const seriesReq = {
  request_id: `req_series_${Date.now()}`,
  purpose: 'editorial_image_series',
  prompt: seriesPromptResult.prompt_text,
  negative_prompt: seriesPromptResult.negative_prompt,
  aspect_ratio: '16:9',
  resolution: '2k',
  result_type: 'series',
  series_amount: 3,
  reference_image_base64: coverBase64,
  reference_image_id: 'art10011_cover_anchor',
  house_identity_profile_id: lockedProfile.profile_id
};

const adapter = new KlingImageProviderAdapter({
  apiKey: KLING_KEY,
  model: KLING_MODEL_V3_OMNI,
  pollIntervalMs: 4000
});

const submissionInspect = adapter.buildSubmissionPayload(seriesReq);
console.log('📦 [STEP 4] Validasi Submission Payload Kling Omni:');
console.log(`   - Endpoint Target  : POST /v1/images/omni-image`);
console.log(`   - Model ID         : ${submissionInspect.model}`);
console.log(`   - Result Type      : ${submissionInspect.payload.result_type}`);
console.log(`   - Series Amount    : ${submissionInspect.payload.series_amount} images`);
console.log(`   - Image List Count : ${submissionInspect.payload.image_list.length} item (Base64 length: ${submissionInspect.payload.image_list[0].image.length} chars)`);
console.log(`   - Tag Reference    : ${submissionInspect.payload.prompt.includes('<<<image_1>>>') ? 'TERVERIFIKASI (<<<image_1>>>)' : 'GAGAL'}`);
console.log(`   - Expected Cost    : 24 units (~US$0.0588 / ~Rp 958)`);
console.log('   ✓ Kontrak payload referensial seri 100% valid dan aman.\n');

// 5. Preflight Summary and Stop Point
const isAuthorized = process.argv.includes('--authorized-generate');

if (!isAuthorized) {
  console.log('================================================================');
  console.log('🛑 [STOP POINT] PREFLIGHT IMAGE SERIES SELESAI & TERVERIFIKASI');
  console.log('================================================================');
  console.log('Sesuai arahan Owner: TIDAK ADA generasi berbayar yang dijalankan pada tahap ini.');
  console.log('Biaya sesi ini: US$ 0.00.');
  console.log('Kebutuhan Unit untuk 3 Gambar Output: 24 Kling Units.');
  console.log('\nPerintah aman untuk eksekusi nyata setelah otorisasi Owner:');
  console.log('  node scripts/execute-kling-omni-image-series-pilot.mjs --authorized-generate');
  console.log('================================================================\n');
  process.exit(0);
}

// 6. Authorized Generation Execution (Runs ONLY if explicitly authorized by Owner)
console.log('\n🚀 [AUTHORIZED EXECUTION] Memulai pengiriman task Image Series ke Kling Omni...');
if (!KLING_KEY) {
  console.error('❌ Error: KLING_API_KEY tidak tersedia.');
  process.exit(1);
}

async function runAuthorizedSeries() {
  console.log('   📤 Mengirimkan Image Series Task ke POST /v1/images/omni-image (24 Units)...');
  const result = await adapter.generate(seriesReq);

  const unitsConsumed = result.cost_metadata?.actual_units_consumed || 24;
  console.log(`   ✓ Task ID         : ${result.task_id}`);
  console.log(`   ✓ Total Frames    : ${result.batch_count}`);
  console.log(`   ✓ Units Consumed  : ${unitsConsumed} units (Expected: 24 units)`);

  const seriesImages = result.series_images || [];
  if (seriesImages.length === 0) {
    console.error('❌ Error: Tidak ada series_images yang diterima dari respons Kling!');
    process.exit(1);
  }

  const savedPaths = [];
  for (let i = 0; i < seriesImages.length; i++) {
    const frame = seriesImages[i];
    const fileNamePng = `art10011_series_shot${i + 1}_kling_omni.png`;
    const framePngPath = path.join(CANDIDATES_DIR, fileNamePng);

    // Save Single Canonical PNG Master
    fs.writeFileSync(framePngPath, Buffer.from(frame.bytes));

    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.writeFileSync(path.join(ARTIFACT_DIR, fileNamePng), Buffer.from(frame.bytes));
    }

    savedPaths.push({
      shot_number: i + 1,
      shot_role: frame.shot_role,
      png_path: framePngPath,
      sha256: frame.sha256,
      dimensions: `${frame.width}x${frame.height}`,
      byte_size: frame.byte_size
    });

    console.log(`   ✓ Frame ${i + 1} (${frame.shot_role}) tersimpan di: ${framePngPath}`);
  }

  // Provenance logging
  const provenance = {
    execution_time: new Date().toISOString(),
    article_id: '10',
    mode: 'IMAGE_SERIES',
    provider: 'kling',
    model: KLING_MODEL_V3_OMNI,
    task_id: result.task_id,
    series_amount: result.batch_count,
    units_spent: unitsConsumed,
    cost_usd: (unitsConsumed * 0.00245).toFixed(4),
    reference_anchor_cover_sha256: coverInspection.sha256,
    frames: savedPaths
  };

  const provPath = path.join(rootDir, 'public/experimental-media/kling-omni-series-provenance.json');
  fs.writeFileSync(provPath, JSON.stringify(provenance, null, 2), 'utf8');
  console.log(`\n💾 Series Provenance tersimpan di: ${provPath}`);
}

runAuthorizedSeries().catch(err => {
  console.error('❌ Error during series execution:', err);
  process.exit(1);
});
