/**
 * RANCANGLOKA — RETRIEVE COMPLETED 2-SHOT TASK 952319480679123526
 *
 * Fetches the already completed 2-shot results from Kling API without any new spend.
 * Saves masters, generates WebP derivatives, backups to R2, and builds review page.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import {
  KlingImageProviderAdapter,
  KLING_MODEL_V3_OMNI
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
const TASK_ID = '952319480679123526';

const targetHeadings = [
  {
    slot: 'inline_2',
    shot_id: 'shot_a',
    target_heading_text: '2. Kapan masing-masing sistem terasa kurang efektif?',
    title: 'Shot A: Cooking Perspective',
    role: 'cooking_condition_side_angle',
    description:
      '45-degree three-quarter side perspective from preparation counter looking at cooking zone. Shows U-shaped layout, teak cabinets, exactly one stainless steel pot on flat flush black glass induction cooktop with soft gentle steam rising toward slim stainless hood intake.'
  },
  {
    slot: 'inline_3',
    shot_id: 'shot_b',
    target_heading_text: '3. Apa yang perlu disiapkan sebelum pemasangan?',
    title: 'Shot B: Mounting Clearance Elevation',
    role: 'mounting_clearance_elevation',
    description:
      '90-degree lateral side-profile architectural elevation parallel to countertop. Shows realistic vertical installation clearance proportional to equipment between flat flush black glass induction cooktop and underside of slim stainless cooker hood mounted below teak cabinet.'
  }
];

async function main() {
  console.log('================================================================');
  console.log(`📦 RANCANGLOKA — RETRIEVING TASK ${TASK_ID} (ZERO NEW SPEND)`);
  console.log('================================================================\n');

  const adapter = new KlingImageProviderAdapter({
    apiKey: KLING_KEY,
    model: KLING_MODEL_V3_OMNI
  });

  console.log(`🔍 [1/4] Mengambil status task ${TASK_ID} dari Kling API...`);
  const taskInfo = await adapter.queryTask(TASK_ID, KLING_MODEL_V3_OMNI);

  console.log(`   ✓ Task Status      : ${taskInfo.task_status}`);
  console.log(`   ✓ Result Type      : ${taskInfo.task_result?.result_type}`);
  console.log(`   ✓ Series Images    : ${taskInfo.task_result?.series_images?.length} frames`);

  if (taskInfo.task_status !== 'succeed') {
    throw new Error(`Task status is not succeed: ${taskInfo.task_status}`);
  }

  console.log('\n📥 [2/4] Mengunduh binary gambar 2K langsung dari CDN Kling...');
  const seriesImages = await adapter.downloadSeriesImages(taskInfo);

  console.log(`   ✓ Berhasil mengunduh ${seriesImages.length} frame gambar.`);

  const frameReports = [];

  for (let i = 0; i < seriesImages.length; i++) {
    const frame = seriesImages[i];
    const shotMeta = targetHeadings[i];

    // Determine extension
    let ext = 'png';
    if (frame.mime_type === 'image/jpeg') ext = 'jpg';
    else if (frame.mime_type === 'image/webp') ext = 'webp';
    else if (frame.mime_type === 'image/png') ext = 'png';

    const masterFileName = `art10011_series2_shot${i + 1}_kling_omni.${ext}`;
    const derivativeFileName = `art10011_series2_shot${i + 1}_watermarked.webp`;

    const masterPath = path.join(PRIVATE_MASTERS_DIR, masterFileName);
    const derivativePath = path.join(DERIVATIVES_DIR, derivativeFileName);

    // Save master
    fs.writeFileSync(masterPath, Buffer.from(frame.bytes));
    fs.writeFileSync(path.join(ARTIFACT_DIR, masterFileName), Buffer.from(frame.bytes));

    // Generate watermarked WebP derivative
    const derivResult = await renderTextWatermarkDerivative(Buffer.from(frame.bytes), {
      text: 'rancangloka.com',
      position: 'bottom-right',
      opacity: 0.72,
      format: 'image/webp',
      quality: 88
    });

    fs.writeFileSync(derivativePath, Buffer.from(derivResult.derivative_bytes));
    fs.writeFileSync(path.join(ARTIFACT_DIR, derivativeFileName), Buffer.from(derivResult.derivative_bytes));

    const inspection = inspectImageBinary(masterPath);

    // Backup to R2 Private Masters
    console.log(`\n☁️  Membackup Frame ${i + 1} ke Cloudflare R2 Staging...`);
    try {
      execSync(
        `npx wrangler r2 object put "rancangloka-media-staging/masters/articles/10011/${masterFileName}" --file "${masterPath}" --content-type "${frame.mime_type}" --remote`,
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

    console.log(`   ✓ Frame ${i + 1} (${shotMeta.title}) selesai diproses:`);
    console.log(`     - Master     : ${masterFileName} (${(inspection.size_bytes / (1024*1024)).toFixed(2)} MB, entropy: ${inspection.entropy})`);
    console.log(`     - Derivative : ${derivativeFileName}`);
  }

  // Save Provenance Record
  console.log('\n📝 [3/4] Mencatat Provenance Data...');
  const provenanceData = {
    execution_time: new Date().toISOString(),
    article_id: '10',
    mode: 'IMAGE_SERIES',
    provider: 'kling',
    model: 'kling-v3-omni',
    task_id: TASK_ID,
    series_amount: 2,
    units_spent: 16,
    reference_anchor_cover: 'art10011_cover_kling_omni.png',
    house_identity_version: 'v1.2',
    frames: frameReports
  };

  const provPath = path.resolve(rootDir, 'public/experimental-media/kling-omni-series2-provenance.json');
  fs.writeFileSync(provPath, JSON.stringify(provenanceData, null, 2), 'utf8');
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'kling-omni-series2-provenance.json'), JSON.stringify(provenanceData, null, 2), 'utf8');

  // Build Comprehensive Review HTML
  console.log('\n📄 [4/4] Menyusun Halaman Review Lengkap (Cover + Inline Approved + Shot A + Shot B)...');

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
      <span><strong>Task ID:</strong> ${TASK_ID}</span>
      <span><strong>Kling Units Spent:</strong> 16 Units</span>
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
        <p class="desc">Area dapur kompak dengan pencahayaan ambien hangat, cooker hood ramping, dan kabinet kayu tanpa jendela luar.</p>
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
        <p class="desc">Detail filter jaring cooker hood stainless steel yang terpasang di bawah kabinet kayu.</p>
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
  console.log('🎉 RETRIEVAL, DERIVATIVES, & REVIEW SETUP COMPLETED!');
  console.log('================================================================\n');

  return {
    taskId: TASK_ID,
    unitsSpent: 16,
    frames: frameReports,
    reviewUrl: 'http://localhost:4321/experimental-media/art10011-complete-storyboard-review.html'
  };
}

main().catch(err => {
  console.error('❌ Retrieval Error:', err);
  process.exit(1);
});
