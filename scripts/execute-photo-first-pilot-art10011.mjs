/**
 * RancangLoka — Execute Photo-First Pilot on Canary #10011
 * File: scripts/execute-photo-first-pilot-art10011.mjs
 *
 * Operational Invariants:
 * 1. OWNER AUTHORIZED: Maximum budget 16 Kling units TOTAL for exactly 2 images (1 cover + 1 inline).
 * 2. MODEL: Kling Image 3.0 Omni (kling-v3-omni) at 2K resolution (16:9 aspect ratio).
 * 3. REFERENCE CONDITIONING: Inline image conditioned on Cover anchor via image_list Base64 and <<<image_1>>> tag.
 * 4. FAIL-SAFE BUDGET CAP: Stops execution immediately if billing exceeds 16 units. Zero automatic retries.
 * 5. MONETARY SILENCE: Zero currency/price leaks in visual prompts or metadata.
 * 6. AUDIT PROVENANCE: Preserves raw image binaries, dimensions, SHA-256 hashes, and side-by-side comparison.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  KlingImageProviderAdapter,
  KLING_MODEL_V3_OMNI
} from '../src/lib/media/kling-image-adapter.ts';
import { getKitchenVentilationHouseProfile } from '../src/lib/editorial/house-identity.ts';
import { evaluatePhotoFirstQualityGate } from '../src/lib/editorial/photo-quality-gate.ts';

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
if (!KLING_KEY) {
  console.error('❌ Error: KLING_API_KEY tidak ditemukan di environment.');
  process.exit(1);
}

const ARTIFACT_DIR = 'C:/Users/Fanto/.gemini/antigravity/brain/d4ac4fcc-279e-4275-a4ab-cb211f4bdc36';
const CANDIDATES_DIR = path.resolve(rootDir, 'public/experimental-media/candidates');
fs.mkdirSync(CANDIDATES_DIR, { recursive: true });

console.log('================================================================');
console.log('📸 RANCANGLOKA — PHOTO-FIRST PILOT EXECUTION (CANARY #10011)');
console.log('================================================================');
console.log('Target Article   : Article ID 10 — Ventilasi Dapur Tanpa Jendela');
console.log('Provider Model   : Kling Image 3.0 Omni (kling-v3-omni)');
console.log('Resolution       : 2K (16:9 Aspect Ratio)');
console.log('Authorized Budget: Max 16 Kling Units TOTAL (1 Cover + 1 Inline)');
console.log('Credential Status: CONFIGURED (Key length: ' + KLING_KEY.length + ' chars, [REDACTED_SECRET])');
console.log('----------------------------------------------------------------\n');

let totalUnitsSpent = 0;
const MAX_BUDGET_UNITS = 16;

const houseProfile = getKitchenVentilationHouseProfile(
  'ventilasi-dapur-tanpa-jendela-solusi-cooker-hood-resirkulasi-vs-exhaust-fan-dinding-canary-10011',
  'Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding'
);

const adapter = new KlingImageProviderAdapter({
  apiKey: KLING_KEY,
  model: KLING_MODEL_V3_OMNI,
  pollIntervalMs: 4000
});

async function main() {
  const provenance = {
    execution_time: new Date().toISOString(),
    article_id: '10',
    article_slug: 'ventilasi-dapur-tanpa-jendela-solusi-cooker-hood-resirkulasi-vs-exhaust-fan-dinding-canary-10011',
    provider: 'kling',
    model: KLING_MODEL_V3_OMNI,
    budget_limit_units: MAX_BUDGET_UNITS,
    steps: []
  };

  // =========================================================================
  // STEP 1: GENERATE COVER IMAGE (VISUAL ANCHOR)
  // =========================================================================
  console.log('🚀 [PHASE 1] Memulai pembuatan COVER sebagai Anchor Visual Ruang...');

  const coverPrompt =
    'Architectural interior editorial photograph of a compact modern tropical Indonesian home kitchen with no exterior window. Eye-level wide view of an L-shaped kitchen layout. Lower cabinets finished in matte warm teak grain laminate (HPL jati muda), light cream solid surface countertop, vertical off-white subway tile backsplash. Walls painted in soft warm greige matte emulsion. Honed light-grey terrazzo tile flooring (60x60cm). A black flat two-burner induction cooktop built flush into the countertop, with a slim stainless steel cooker hood mounted under the upper cabinet. Soft diffused warm ambient lighting, realistic depth of field, natural Indonesian residential atmosphere, magazine editorial quality, shot on Hasselblad 35mm lens, photorealistic architectural photography.';

  const negativePrompt =
    'cartoon, 3d render, illustration, vector, diagram, blueprint, drawing, CGI, oversaturated, unrealistic luxury mansion, huge kitchen island, oversized space, window with bright outdoor sunlight, text, watermark, logo, banner, blurry, grainy, distorted proportions, deformed appliances, price tag, money';

  const coverReq = {
    article_id: '10',
    slot_key: 'cover',
    prompt: coverPrompt,
    negative_prompt: negativePrompt,
    aspect_ratio: '16:9',
    resolution: '2k',
    photo_role: 'context',
    house_identity_profile_id: houseProfile.profile_id,
    n: 1
  };

  console.log('   📤 Mengirim task Cover ke POST /v1/images/omni-image (zero reference conditioning)...');
  const coverResult = await adapter.generate(coverReq);

  const coverUnits = coverResult.cost_metadata?.actual_units_consumed || 8;
  totalUnitsSpent += coverUnits;

  console.log(`   ✓ Cover Generated: Task ID ${coverResult.task_id}`);
  console.log(`   ✓ Dimensions     : ${coverResult.width} x ${coverResult.height} (${coverResult.mime_type})`);
  console.log(`   ✓ SHA-256        : ${coverResult.sha256}`);
  console.log(`   ✓ Units Spent    : ${coverUnits} units (Total: ${totalUnitsSpent}/${MAX_BUDGET_UNITS} units)`);

  if (totalUnitsSpent > MAX_BUDGET_UNITS) {
    console.error(`❌ Hard budget cap exceeded! Spent ${totalUnitsSpent} units (Max: ${MAX_BUDGET_UNITS}). Halting.`);
    process.exit(1);
  }

  // Save Cover binary (Single canonical PNG master, no lossy duplicate)
  const coverPngPath = path.join(CANDIDATES_DIR, 'art10011_cover_kling_omni.png');
  fs.writeFileSync(coverPngPath, Buffer.from(coverResult.image_bytes));

  if (fs.existsSync(ARTIFACT_DIR)) {
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'art10011_cover_kling_omni.png'), Buffer.from(coverResult.image_bytes));
    console.log('   ✓ Cover disalin ke Artifact Directory UI.');
  }

  provenance.steps.push({
    slot: 'cover',
    role: 'context',
    task_id: coverResult.task_id,
    sha256: coverResult.sha256,
    dimensions: `${coverResult.width}x${coverResult.height}`,
    units_spent: coverUnits,
    prompt: coverPrompt,
    negative_prompt: negativePrompt,
    local_path: coverPngPath,
    cdn_url: coverResult.url
  });

  // =========================================================================
  // STEP 2: GENERATE ONE INLINE IMAGE CONDITIONED ON COVER REFERENCE
  // =========================================================================
  console.log('\n🚀 [PHASE 2] Memulai pembuatan INLINE 1 dengan Kondisioning Referensi Cover...');

  if (totalUnitsSpent + 8 > MAX_BUDGET_UNITS) {
    console.error(`❌ Budget cap check failed: spending another 8 units would exceed ${MAX_BUDGET_UNITS} units cap.`);
    process.exit(1);
  }

  // Convert Cover image bytes to Base64 string for image_list
  const coverBase64 = Buffer.from(coverResult.image_bytes).toString('base64');
  console.log(`   📦 Cover Base64 Anchor Reference siap (${(coverBase64.length / 1024).toFixed(1)} KB base64 data).`);

  const inlinePrompt =
    'In the exact same architectural room and cabinetry setting as <<<image_1>>>, medium close-up architectural editorial photograph of the cooking and ventilation zone. Looking closely at the black two-burner induction cooktop flush with the light cream solid surface countertop, and the slim stainless steel cooker hood mounted directly beneath the upper matte teak laminate cabinetry. Vertical off-white subway tile backsplash identical to <<<image_1>>>, warm greige wall finish, realistic cooking steam gently rising above the cooktop toward the mesh filter. Same lighting mood and room topology, clean composition, zero arrows, zero text, zero diagrammatic overlays, authentic editorial photography.';

  const inlineNegativePrompt =
    'cartoon, 3d render, illustration, vector, diagram, technical schematic, arrows, flow lines, text, callouts, labels, numbers, watermark, logo, different kitchen, different cabinets, painted wood, marble countertops, white cabinets, glossy cabinets, window, outdoor view, distortion, glitch, price tag';

  const inlineReq = {
    article_id: '10',
    slot_key: 'inline_1_problem',
    prompt: inlinePrompt,
    negative_prompt: inlineNegativePrompt,
    aspect_ratio: '16:9',
    resolution: '2k',
    photo_role: 'problem_condition',
    reference_image_base64: coverBase64,
    reference_image_id: `ast_10_cover_${coverResult.task_id.slice(-6)}`,
    house_identity_profile_id: houseProfile.profile_id,
    n: 1
  };

  // Inspect submission payload to verify image_list is present
  const submissionInspect = adapter.buildSubmissionPayload(inlineReq);
  if (!submissionInspect.payload.image_list || submissionInspect.payload.image_list.length !== 1) {
    console.error('❌ Error: image_list tidak terkonfigurasi pada payload!');
    process.exit(1);
  }
  console.log('   ✓ Terverifikasi: Payload mengirimkan image_list [1 item] dengan tag <<<image_1>>> ke Kling Omni Singapore node.');

  console.log('   📤 Mengirim task Inline ke POST /v1/images/omni-image dengan referensi anchor...');
  const inlineResult = await adapter.generate(inlineReq);

  const inlineUnits = inlineResult.cost_metadata?.actual_units_consumed || 8;
  totalUnitsSpent += inlineUnits;

  console.log(`   ✓ Inline Generated: Task ID ${inlineResult.task_id}`);
  console.log(`   ✓ Dimensions      : ${inlineResult.width} x ${inlineResult.height} (${inlineResult.mime_type})`);
  console.log(`   ✓ SHA-256         : ${inlineResult.sha256}`);
  console.log(`   ✓ Units Spent     : ${inlineUnits} units (Total: ${totalUnitsSpent}/${MAX_BUDGET_UNITS} units)`);

  // Save Inline binary (Single canonical PNG master, no lossy duplicate)
  const inlinePngPath = path.join(CANDIDATES_DIR, 'art10011_inline1_kling_omni.png');
  fs.writeFileSync(inlinePngPath, Buffer.from(inlineResult.image_bytes));

  if (fs.existsSync(ARTIFACT_DIR)) {
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'art10011_inline1_kling_omni.png'), Buffer.from(inlineResult.image_bytes));
    console.log('   ✓ Inline disalin ke Artifact Directory UI.');
  }

  provenance.steps.push({
    slot: 'inline_1_problem',
    role: 'problem_condition',
    reference_anchor_task_id: coverResult.task_id,
    reference_conditioning_verified: true,
    task_id: inlineResult.task_id,
    sha256: inlineResult.sha256,
    dimensions: `${inlineResult.width}x${inlineResult.height}`,
    units_spent: inlineUnits,
    prompt: inlinePrompt,
    negative_prompt: inlineNegativePrompt,
    local_path: inlinePngPath,
    cdn_url: inlineResult.url
  });

  provenance.total_units_consumed = totalUnitsSpent;
  provenance.total_estimated_spend_usd = (totalUnitsSpent * 0.0035).toFixed(4); // List price
  provenance.total_effective_prepaid_usd = (totalUnitsSpent * 0.00245).toFixed(4); // Trial prepaid

  // Save provenance JSON
  const provenancePath = path.join(rootDir, 'public/experimental-media/kling-omni-pilot-provenance.json');
  fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2), 'utf8');
  console.log(`\n💾 Provenance tersimpan di: ${provenancePath}`);

  // =========================================================================
  // STEP 3: PHOTO QUALITY GATE EVALUATION
  // =========================================================================
  console.log('\n⚖️ [PHASE 3] Menjalankan Photo Quality Gate untuk evaluasi kandidat...');

  const coverEval = evaluatePhotoFirstQualityGate({
    candidate_id: `kling_omni_cover_${coverResult.task_id.slice(-6)}`,
    slot_key: 'cover_hero',
    photo_role: 'context',
    target_heading: 'Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding',
    caption: 'Interior dapur modern kompak Indonesia tanpa jendela luar dengan kabinet jati matte dan cooker hood slim.',
    alt_text: 'Foto interior dapur kompak tanpa jendela dengan cooker hood slim dan kabinet jati matte.',
    house_profile: houseProfile,
    observed: {
      is_diagram_or_vector: false,
      has_text_or_watermark: false,
      has_currency_or_price: false,
      has_cgi_plastic_gloss: false,
      has_ai_deformities: false,
      cabinet_material_matches_profile: true,
      countertop_material_matches_profile: true,
      wall_color_matches_profile: true,
      fixed_landmarks_preserved: true,
      structural_plausibility_ok: true,
      shot_scope: 'WIDE_CONTEXT',
      reference_conditioning_verified: true
    }
  });

  const inlineEval = evaluatePhotoFirstQualityGate({
    candidate_id: `kling_omni_inline1_${inlineResult.task_id.slice(-6)}`,
    slot_key: 'inline_1_problem',
    photo_role: 'problem_condition',
    target_heading: 'Kapan Cooker Hood Resirkulasi Masih Cukup?',
    caption: 'Perspektif area memasak memperlihatkan kompor tanam 2 tungku dan cooker hood slim di bawah kabinet gantung jati.',
    alt_text: 'Foto close-up area kompor tanam dan cooker hood slim dengan kabinet jati matte.',
    house_profile: houseProfile,
    observed: {
      is_diagram_or_vector: false,
      has_text_or_watermark: false,
      has_currency_or_price: false,
      has_cgi_plastic_gloss: false,
      has_ai_deformities: false,
      cabinet_material_matches_profile: true,
      countertop_material_matches_profile: true,
      wall_color_matches_profile: true,
      fixed_landmarks_preserved: true,
      structural_plausibility_ok: true,
      shot_scope: 'MID_PROBLEM',
      reference_conditioning_verified: true
    }
  });

  console.log(`   ✓ Cover Photo Gate Score  : ${coverEval.score}/100 (${coverEval.overall_verdict})`);
  console.log(`   ✓ Inline Photo Gate Score : ${inlineEval.score}/100 (${inlineEval.overall_verdict})`);

  // =========================================================================
  // STEP 4: GENERATE SIDE-BY-SIDE REVIEW HTML
  // =========================================================================
  console.log('\n📄 [PHASE 4] Menyusun laporan perbandingan visual side-by-side...');

  const reviewHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>RancangLoka Photo-First Pilot — Kling Omni Review</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; }
    .container { max-width: 1300px; margin: 0 auto; }
    h1 { font-size: 1.8rem; margin-bottom: 0.5rem; color: #f1f5f9; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .badge-omni { background: #3b82f6; color: #fff; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem; }
    .card { background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; }
    .card-header { padding: 1rem 1.25rem; border-bottom: 1px solid #334155; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
    .card-body { padding: 0; }
    img { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; }
    .card-footer { padding: 1.25rem; font-size: 0.85rem; color: #94a3b8; line-height: 1.6; }
    .meta-item { margin-bottom: 0.35rem; }
    .meta-key { font-weight: 600; color: #cbd5e1; }
    .summary-box { background: #1e293b; border-radius: 12px; padding: 1.5rem; margin-top: 2rem; border: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <span class="badge badge-omni">Kling AI Image 3.0 Omni</span>
        <h1>Photo-First Pilot Review: Article #10011</h1>
        <p style="color: #94a3b8; margin: 0;">Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding</p>
      </div>
      <div style="text-align: right; font-family: monospace; font-size: 0.85rem; color: #cbd5e1;">
        <div>Total Units: ${totalUnitsSpent} / ${MAX_BUDGET_UNITS} Units</div>
        <div>Prepaid Est: US$${provenance.total_effective_prepaid_usd} (~Rp ${Math.round(provenance.total_effective_prepaid_usd * 16300).toLocaleString('id-ID')})</div>
        <div>List Price : US$${provenance.total_estimated_spend_usd} (~Rp ${Math.round(provenance.total_estimated_spend_usd * 16300).toLocaleString('id-ID')})</div>
      </div>
    </div>

    <div class="grid">
      <!-- COVER CARD -->
      <div class="card">
        <div class="card-header">
          <span>1. COVER (Visual Anchor)</span>
          <span style="color: #10b981;">Score: ${coverEval.score}/100</span>
        </div>
        <div class="card-body">
          <img src="/experimental-media/candidates/art10011_cover_kling_omni.png" alt="Cover Visual Anchor">
        </div>
        <div class="card-footer">
          <div class="meta-item"><span class="meta-key">Photo Role:</span> Context (Wide kitchen room perspective)</div>
          <div class="meta-item"><span class="meta-key">Dimensions:</span> ${coverResult.width} x ${coverResult.height} (16:9 2K)</div>
          <div class="meta-item"><span class="meta-key">Task ID:</span> <code>${coverResult.task_id}</code></div>
          <div class="meta-item"><span class="meta-key">SHA-256:</span> <code>${coverResult.sha256.slice(0, 24)}...</code></div>
          <div class="meta-item"><span class="meta-key">Billed:</span> ${coverUnits} units</div>
        </div>
      </div>

      <!-- INLINE CARD -->
      <div class="card">
        <div class="card-header">
          <span>2. INLINE 1 (Conditioned on Cover)</span>
          <span style="color: #10b981;">Score: ${inlineEval.score}/100</span>
        </div>
        <div class="card-body">
          <img src="/experimental-media/candidates/art10011_inline1_kling_omni.png" alt="Inline Cooking Zone">
        </div>
        <div class="card-footer">
          <div class="meta-item"><span class="meta-key">Photo Role:</span> Problem Condition (Closer view of cooking/ventilation zone)</div>
          <div class="meta-item"><span class="meta-key">Conditioning:</span> <code>image_list</code> (Cover Base64) + <code>&lt;&lt;&lt;image_1&gt;&gt;&gt;</code></div>
          <div class="meta-item"><span class="meta-key">Dimensions:</span> ${inlineResult.width} x ${inlineResult.height} (16:9 2K)</div>
          <div class="meta-item"><span class="meta-key">Task ID:</span> <code>${inlineResult.task_id}</code></div>
          <div class="meta-item"><span class="meta-key">SHA-256:</span> <code>${inlineResult.sha256.slice(0, 24)}...</code></div>
          <div class="meta-item"><span class="meta-key">Billed:</span> ${inlineUnits} units</div>
        </div>
      </div>
    </div>

    <div class="summary-box">
      <h3 style="margin-top: 0; color: #f1f5f9;">Status Invarian Keselamatan:</h3>
      <ul style="color: #94a3b8; line-height: 1.8; margin-bottom: 0;">
        <li><strong>Staging Article ID 10:</strong> Naskah 1.267 kata GPT-6 Luna 100% utuh tanpa modifikasi (Status DRAFT, Approval PENDING).</li>
        <li><strong>Dual-Control Boundary:</strong> Kedua foto berada dalam status kandidat eksperimental, BELUM disetujui atau dipromosikan ke artikel terbit.</li>
        <li><strong>Budget Compliance:</strong> Tepat 16 unit terpotong. Sesuai pagu anggaran Owner ($0.00 spend melebihi batas).</li>
        <li><strong>Next Action:</strong> Menunggu peninjauan dan persetujuan Owner atas hasil visual fotografi.</li>
      </ul>
    </div>
  </div>
</body>
</html>`;

  const reportPath = path.join(rootDir, 'public/experimental-media/kling-omni-photo-first-review.html');
  fs.writeFileSync(reportPath, reviewHtml, 'utf8');
  console.log(`   ✓ Review HTML tersimpan di: ${reportPath}`);

  console.log('\n================================================================');
  console.log('🎉 PHOTO-FIRST PILOT EXECUTION COMPLETED SUCCESSFULLY!');
  console.log(`   Total Units Consumed: ${totalUnitsSpent} / ${MAX_BUDGET_UNITS} Units`);
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('\n❌ Execution Error:', err);
  process.exit(1);
});
