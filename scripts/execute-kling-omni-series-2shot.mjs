/**
 * RANCANGLOKA — EXECUTE 2-SHOT IMAGE SERIES COMPLETION (ARTICLE #10011)
 * File: scripts/execute-kling-omni-series-2shot.mjs
 *
 * Executes Kling Image 3.0 Omni Image Series generation (2 output frames).
 * REQUIRES EXPLICIT OWNER AUTHORIZATION via OWNER_AUTHORIZED_SERIES_2SHOT=true.
 *
 * Invariants:
 * 1. BUDGET GATE: Strictly 2 images in 1 series task = 16 Kling units (~US$0.0392).
 * 2. REFERENCE ANCHOR: Uses art10011_cover_kling_omni.png in image_list.
 * 3. HOUSE IDENTITY LOCK v1.2: Preserves flat glass induction cooktop, teak cabinetry, no windows.
 * 4. REALISTIC PROPORTIONS: Shot B uses realistic vertical clearance proportional to equipment (no hardcoded dimensions).
 * 5. SAVES INDEPENDENTLY: Saves each frame as PNG master + WebP watermarked derivative.
 * 6. R2 BACKUP: Backs up masters to private R2 and derivatives to public R2.
 * 7. ZERO CMS MUTATION: Does NOT bind candidates to CMS. Article #10011 remains DRAFT.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import {
  KlingImageProviderAdapter,
  KLING_MODEL_V3_OMNI,
  KLING_UNITS_PER_IMAGE_2K
} from '../src/lib/media/kling-image-adapter.ts';
import { inspectImageBinary } from '../src/lib/editorial/image-pixel-inspector.ts';
import { renderTextWatermarkDerivative } from '../src/lib/media/stored-image-artifact.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load .env
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
const PRIVATE_MASTERS_DIR = path.resolve(rootDir, 'storage/masters/art10011');
const DERIVATIVES_DIR = path.resolve(rootDir, 'public/experimental-media/derivatives');
const COVER_PATH = path.join(PRIVATE_MASTERS_DIR, 'art10011_cover_kling_omni.png');
const SHOT2_APPROVED_PATH = path.join(DERIVATIVES_DIR, 'art10011_series_shot2_watermarked.webp');

async function main() {
  console.log('================================================================');
  console.log('📸 RANCANGLOKA — EXECUTE 2-SHOT KLING OMNI IMAGE SERIES');
  console.log('================================================================\n');

  // Safety Gate: Owner Authorization
  if (process.env.OWNER_AUTHORIZED_SERIES_2SHOT !== 'true') {
    console.error('❌ SAFETY GATE TRIGGERED: Eksekusi diblokir!');
    console.error('   Otorisasi eksplisit Owner untuk maksimal 16 Kling units diperlukan.');
    console.error('   Set OWNER_AUTHORIZED_SERIES_2SHOT=true setelah Owner menyetujui.');
    process.exit(1);
  }

  if (!KLING_KEY) {
    console.error('❌ Error: KLING_API_KEY tidak ditemukan di environment!');
    process.exit(1);
  }

  if (!fs.existsSync(COVER_PATH)) {
    console.error(`❌ Error: Cover master tidak ditemukan di: ${COVER_PATH}`);
    process.exit(1);
  }

  const coverBase64 = fs.readFileSync(COVER_PATH).toString('base64');
  console.log(`✓ Cover Anchor dimuat: ${path.basename(COVER_PATH)} (${coverBase64.length} chars base64)`);

  const targetHeadings = [
    {
      slot: 'inline_2',
      shot_id: 'shot_a',
      target_heading_text: '2. Kapan masing-masing sistem terasa kurang efektif?',
      title: 'Shot A: Cooking Perspective',
      role: 'cooking_condition_side_angle',
      description:
        '45-degree three-quarter side perspective from preparation counter looking at cooking zone. Shows U-shaped layout, teak cabinets, exactly one stainless steel pot on flat flush black glass induction cooktop with soft gentle steam rising toward slim stainless hood intake. Dimmable warm lighting (3000K). Strictly flat induction surface, no raised grates, strictly enclosed walls, no windows.'
    },
    {
      slot: 'inline_3',
      shot_id: 'shot_b',
      target_heading_text: '3. Apa yang perlu disiapkan sebelum pemasangan?',
      title: 'Shot B: Mounting Clearance Elevation',
      role: 'mounting_clearance_elevation',
      description:
        '90-degree lateral side-profile architectural elevation parallel to countertop. Shows realistic vertical installation clearance proportional to equipment between flat flush black glass induction cooktop and underside of slim stainless cooker hood mounted below teak cabinet. Cream subway tiles, clean countertop. Strictly flat cooktop, no protruding burner hardware, no wall louvers, no exterior ductwork.'
    }
  ];

  const seriesPrompt = [
    `Coherent 2-shot architectural editorial photography series of the exact same compact modern tropical Indonesian home kitchen from <<<image_1>>>, maintaining 100% architectural and material continuity across both panels:`,
    `[IMMUTABLE ARCHITECTURE & EQUIPMENT - BOTH SHOTS]`,
    `- Kitchen Layout: Compact U-shaped kitchen layout strictly identical to <<<image_1>>>.`,
    `- Fixed Appliances: Cooktop is strictly flat flush black glass induction cooktop built seamlessly into cream countertop (STRICTLY NO gas burners, NO raised burner rings, NO iron pan supports, NO knobs, NO flame). Cooker hood is slim stainless steel profile mounted directly underneath teak wall cabinet.`,
    `- Materials: Light teak matte woodgrain lower cabinets with horizontal grain, matching teak upper woodwork, matte cream solid surface countertop, cream subway tile backsplash with fine grout, light grey honed terrazzo flooring.`,
    `- Space Architecture: Fully enclosed interior kitchen without external windows, warm diffused tropical interior lighting (3000K), lived-in residential atmosphere, unpopulated (zero people).`,
    `[PANEL SEQUENCE SPECIFICATIONS]`,
    `SHOT 1 (${targetHeadings[0].role}): ${targetHeadings[0].description}`,
    `SHOT 2 (${targetHeadings[1].role}): ${targetHeadings[1].description}`,
    `PHOTOGRAPHIC STANDARD: Hasselblad medium-format camera, architectural magazine editorial standard, natural crisp depth of field, tactile material textures, zero distortion.`
  ].join('\n');

  const negativePrompt = [
    'duplicate camera angle of cover',
    'straight-on frontal eye level view',
    'gas burner rings and grates',
    'protruding gas knobs on cooktop',
    'cast iron pan supports',
    'gas flame',
    'blue fire',
    'open flame',
    'chimney hood',
    'canopy hood',
    'different cooker hood',
    'white glossy cabinets',
    'marble countertops',
    'granite countertop',
    'western luxury mansion',
    'huge kitchen island',
    'wooden louver on wall',
    'wall vent grille on upper wall',
    'exterior window with outdoor sunlight',
    'distorted geometry',
    'cartoon',
    '3d render',
    'illustration',
    'CGI',
    'technical diagram',
    'arrows',
    'flow lines',
    'schematic callouts',
    'labels',
    'watermark',
    'logo',
    'text overlays'
  ].join(', ');

  console.log(`✓ Prompt disusun: ${seriesPrompt.length} karakter (Batas Kling: 2500)`);
  if (seriesPrompt.length > 2500) {
    throw new Error(`Prompt terlalu panjang: ${seriesPrompt.length} > 2500`);
  }

  const adapter = new KlingImageProviderAdapter({
    apiKey: KLING_KEY,
    model: KLING_MODEL_V3_OMNI
  });

  console.log('\n🚀 Mengirim request Image Series 2-shot ke Kling API (Maksimal 16 units)...');
  const result = await adapter.generate({
    model: KLING_MODEL_V3_OMNI,
    model_override: KLING_MODEL_V3_OMNI,
    prompt: seriesPrompt,
    negative_prompt: negativePrompt,
    result_type: 'series',
    series_amount: 2,
    resolution: '2K',
    aspect_ratio: '16:9',
    reference_image: coverBase64,
    request_id: `req_series2shot_${Date.now()}`
  });

  const unitsConsumed = result.cost_metadata?.actual_units_consumed || 16;
  console.log('   ✓ Generasi Series Selesai!');
  console.log(`   ✓ Task ID           : ${result.task_id}`);
  console.log(`   ✓ Units Deducted    : ${unitsConsumed}`);
  console.log(`   ✓ Total Frames      : ${result.series_images?.length}`);

  // Process frames
  const outputMasters = [];
  const outputDerivatives = [];
  const frameReports = [];

  for (let i = 0; i < (result.series_images?.length || 0); i++) {
    const frame = result.series_images[i];
    const shotMeta = targetHeadings[i];
    const masterFileName = `art10011_series2_shot${i + 1}_kling_omni.png`;
    const derivativeFileName = `art10011_series2_shot${i + 1}_watermarked.webp`;

    const masterPath = path.join(PRIVATE_MASTERS_DIR, masterFileName);
    const derivativePath = path.join(DERIVATIVES_DIR, derivativeFileName);

    // Save PNG master
    fs.writeFileSync(masterPath, Buffer.from(frame.image_bytes));
    outputMasters.push(masterPath);

    // Copy master to artifact dir
    const artifactMasterPath = path.join(ARTIFACT_DIR, masterFileName);
    fs.writeFileSync(artifactMasterPath, Buffer.from(frame.image_bytes));

    // Generate watermarked WebP derivative
    await renderTextWatermarkDerivative({
      source_image: Buffer.from(frame.image_bytes),
      watermark_text: 'rancangloka.com',
      destination_path: derivativePath
    });
    outputDerivatives.push(derivativePath);

    // Copy derivative to artifact dir
    const artifactDerivativePath = path.join(ARTIFACT_DIR, derivativeFileName);
    fs.copyFileSync(derivativePath, artifactDerivativePath);

    // Inspect binary
    const inspection = inspectImageBinary(masterPath);

    // Backup to R2 Private Masters
    console.log(`\n☁️  Membackup Frame ${i + 1} ke Cloudflare R2 Staging...`);
    try {
      execSync(
        `npx wrangler r2 object put "rancangloka-media-staging/masters/articles/10011/${masterFileName}" --file "${masterPath}" --content-type "image/png" --remote`,
        { stdio: 'pipe' }
      );
      console.log(`   ✓ Master dicadangkan di R2: masters/articles/10011/${masterFileName}`);
    } catch (e) {
      console.warn(`   ⚠️ Gagal backup master R2: ${e.message}`);
    }

    // Upload WebP derivative to R2 Staging
    try {
      execSync(
        `npx wrangler r2 object put "rancangloka-media-staging/articles/10011/derivatives/${derivativeFileName}" --file "${derivativePath}" --content-type "image/webp" --remote`,
        { stdio: 'pipe' }
      );
      console.log(`   ✓ Derivative diupload ke R2: articles/10011/derivatives/${derivativeFileName}`);
    } catch (e) {
      console.warn(`   ⚠️ Gagal upload derivative R2: ${e.message}`);
    }

    frameReports.push({
      frame_index: i,
      shot_id: shotMeta.shot_id,
      title: shotMeta.title,
      target_heading: shotMeta.target_heading_text,
      master_file: masterFileName,
      derivative_file: derivativeFileName,
      derivative_url: `/experimental-media/derivatives/${derivativeFileName}`,
      dimensions: `${inspection.width}x${inspection.height}`,
      byte_size: inspection.size_bytes,
      entropy: inspection.entropy,
      sha256: inspection.sha256
    });

    console.log(`   ✓ Frame ${i + 1} (${shotMeta.title}) selesai:`);
    console.log(`     - Master     : ${masterFileName} (${(inspection.size_bytes / (1024*1024)).toFixed(2)} MB, entropy: ${inspection.entropy})`);
    console.log(`     - Derivative : ${derivativeFileName}`);
  }

  // Save Provenance Record
  const provenanceData = {
    execution_time: new Date().toISOString(),
    article_id: '10',
    mode: 'IMAGE_SERIES',
    provider: 'kling',
    model: 'kling-v3-omni',
    task_id: result.task_id,
    series_amount: 2,
    units_spent: result.final_unit_deduction || 16,
    reference_anchor_cover: 'art10011_cover_kling_omni.png',
    house_identity_version: 'v1.2',
    frames: frameReports
  };

  const provPath = path.resolve(rootDir, 'public/experimental-media/kling-omni-series2-provenance.json');
  fs.writeFileSync(provPath, JSON.stringify(provenanceData, null, 2), 'utf8');
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'kling-omni-series2-provenance.json'), JSON.stringify(provenanceData, null, 2), 'utf8');

  // Build Comprehensive Review HTML (Cover + Approved Shot 2 + Shot A + Shot B)
  console.log('\n📄 Menyusun Halaman Review Lengkap (Cover + Inline Approved + Shot A + Shot B)...');

  const reviewHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Article #10011 Complete Photo Storyboard Review — RancangLoka</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; line-height: 1.5; }
    .header { max-width: 1400px; margin: 0 auto 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid #334155; }
    .title { font-size: 1.5rem; font-weight: 700; color: #f8fafc; margin-bottom: 0.5rem; }
    .meta-bar { display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.85rem; color: #94a3b8; }
    .badge { padding: 0.25rem 0.6rem; border-radius: 9999px; font-weight: 600; font-size: 0.75rem; }
    .badge-success { background: #065f46; color: #a7f3d0; border: 1px solid #10b981; }
    .badge-pending { background: #78350f; color: #fde68a; border: 1px solid #f59e0b; }
    .grid { max-width: 1400px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
    .card-header { padding: 1rem; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
    .card-title { font-size: 0.95rem; font-weight: 600; }
    .img-wrap { width: 100%; aspect-ratio: 16/9; background: #020617; position: relative; overflow: hidden; }
    .img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; cursor: pointer; transition: transform 0.2s; }
    .img-wrap img:hover { transform: scale(1.02); }
    .card-body { padding: 1rem; font-size: 0.85rem; flex-grow: 1; display: flex; flex-direction: column; gap: 0.5rem; }
    .prop-row { display: flex; justify-content: space-between; font-size: 0.8rem; color: #94a3b8; border-bottom: 1px dashed #334155; padding-bottom: 0.25rem; }
    .prop-val { color: #f1f5f9; font-weight: 500; }
    .desc { margin-top: 0.5rem; font-size: 0.8rem; color: #cbd5e1; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">Article #10011 Complete Photo Storyboard Review (1 Cover + 3 Inlines)</h1>
    <div class="meta-bar">
      <span><strong>Article ID:</strong> 10 (Canary #10011)</span>
      <span><strong>Task ID:</strong> ${result.task_id}</span>
      <span><strong>Kling Units Spent:</strong> ${result.final_unit_deduction || 16} Units</span>
      <span><strong>Status CMS:</strong> <span class="badge badge-success">DRAFT (Terlindungi)</span></span>
    </div>
  </div>

  <div class="grid">
    <!-- 1. Cover Anchor -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Cover Hero (Ground Truth Anchor)</span>
        <span class="badge badge-success">ACCEPTED AS ANCHOR</span>
      </div>
      <div class="img-wrap">
        <img src="/experimental-media/derivatives/art10011_cover_kling_omni_watermarked.webp" alt="Cover Anchor" onclick="window.open(this.src)">
      </div>
      <div class="card-body">
        <div class="prop-row"><span>Peran</span><span class="prop-val">Hero Utama Artikel</span></div>
        <div class="prop-row"><span>Sudut Kamera</span><span class="prop-val">Eye-level Frontal</span></div>
        <div class="prop-row"><span>Status CMS</span><span class="prop-val">Terikat di Staging D1</span></div>
        <p class="desc">Dapur kompak U-shape tanpa bukaan jendela luar, kompor tanam induksi kaca datar, kabinet jati muda, cooker hood slim.</p>
      </div>
    </div>

    <!-- 2. Inline 1 / Shot 2 -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Inline 1 (Shot 2 Approved)</span>
        <span class="badge badge-success">ACCEPTED</span>
      </div>
      <div class="img-wrap">
        <img src="/experimental-media/derivatives/art10011_series_shot2_watermarked.webp" alt="Inline 1 Shot 2" onclick="window.open(this.src)">
      </div>
      <div class="card-body">
        <div class="prop-row"><span>Heading</span><span class="prop-val">1. Apa bedanya cara kerja kedua sistem?</span></div>
        <div class="prop-row"><span>Sudut Kamera</span><span class="prop-val">Slight Low Angle Upward Detail</span></div>
        <div class="prop-row"><span>Status CMS</span><span class="prop-val">Terikat di Staging D1</span></div>
        <p class="desc">Detail bagian bawah cooker hood stainless steel dengan filter jaring di bawah kabinet kayu.</p>
      </div>
    </div>

    <!-- 3. Inline 2 / Shot A -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Inline 2 (Shot A Baru)</span>
        <span class="badge badge-pending">PENDING OWNER REVIEW</span>
      </div>
      <div class="img-wrap">
        <img src="/experimental-media/derivatives/art10011_series2_shot1_watermarked.webp" alt="Shot A Cooking Condition" onclick="window.open(this.src)">
      </div>
      <div class="card-body">
        <div class="prop-row"><span>Heading</span><span class="prop-val">2. Kapan masing-masing sistem terasa kurang efektif?</span></div>
        <div class="prop-row"><span>Sudut Kamera</span><span class="prop-val">45° Three-Quarter Side Angle</span></div>
        <div class="prop-row"><span>Status CMS</span><span class="prop-val">NOT BOUND (Review Only)</span></div>
        <p class="desc">Kondisi memasak nyata di dapur tertutup: sudut samping 45 derajat dengan satu panci stainless di atas kompor induksi tanam dan kepulan uap halus.</p>
      </div>
    </div>

    <!-- 4. Inline 3 / Shot B -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Inline 3 (Shot B Baru)</span>
        <span class="badge badge-pending">PENDING OWNER REVIEW</span>
      </div>
      <div class="img-wrap">
        <img src="/experimental-media/derivatives/art10011_series2_shot2_watermarked.webp" alt="Shot B Mounting Clearance" onclick="window.open(this.src)">
      </div>
      <div class="card-body">
        <div class="prop-row"><span>Heading</span><span class="prop-val">3. Apa yang perlu disiapkan sebelum pemasangan?</span></div>
        <div class="prop-row"><span>Sudut Kamera</span><span class="prop-val">90° Lateral Side Profile Elevation</span></div>
        <div class="prop-row"><span>Status CMS</span><span class="prop-val">NOT BOUND (Review Only)</span></div>
        <p class="desc">Elevasi profil samping 90 derajat memperlihatkan jarak ketinggian pemasangan realistis antara kompor tanam induksi dan cooker hood slim.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const reviewPath = path.resolve(rootDir, 'public/experimental-media/art10011-complete-storyboard-review.html');
  fs.writeFileSync(reviewPath, reviewHtml, 'utf8');
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'art10011-complete-storyboard-review.html'), reviewHtml, 'utf8');
  console.log(`   ✓ Halaman review tersimpan: ${reviewPath}`);

  console.log('\n================================================================');
  console.log('🎉 TWO-SHOT COMPLETION GENERATION & REVIEW SETUP COMPLETE!');
  console.log('================================================================\n');

  return {
    taskId: result.task_id,
    unitsSpent: result.final_unit_deduction || 16,
    frames: frameReports,
    reviewUrl: 'http://localhost:4321/experimental-media/art10011-complete-storyboard-review.html'
  };
}

main().catch(err => {
  console.error('❌ Execution Error:', err);
  process.exit(1);
});
