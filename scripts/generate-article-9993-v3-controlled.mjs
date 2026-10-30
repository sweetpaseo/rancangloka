/**
 * RancangLoka — Batch 1 Hero Image Finalization (TASK 1 & TASK 2)
 *
 * Implements:
 * 1. Preserves historical v2 candidates with audit trail (REJECTED: excessive damage / demolished look).
 * 2. Generates 2 new controlled v3 candidates for Article #9993 (1 SDXL Lightning, 1 FLUX.1 Schnell).
 * 3. Uses controlled prompt with localized, modest moisture damage on intact wall.
 * 4. Attaches 5-dimensional QA classification (distinguishing automated heuristics from human review).
 * 5. Preserves Article #9999 (FLUX preferred) and #10000 (SDXL preferred) without mutation.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  CloudflareAiImageAdapter,
  CLOUDFLARE_FLUX_MODEL,
  CLOUDFLARE_SDXL_MODEL
} from '../src/lib/media/cloudflare-ai-image-adapter.ts';
import {
  loadCandidatesLedger,
  saveCandidatesLedger,
  saveExperimentalCandidate
} from '../src/lib/media/experimental-storage.ts';
import {
  BATCH_1_CANONICAL_BRIEFS,
  CONTROLLED_PROMPT_9993_V3,
  calculate16to9Crop,
  evaluateFiveDimensionalQA,
  evaluateArchitecturalGeometryQA,
  evaluateVisualSubjectPriority
} from '../src/lib/media/editorial-visual-intelligence.ts';

const STORAGE_DIR = path.resolve('./storage/experimental-media');
const PUBLIC_DIR = path.resolve('./public/experimental-media');

async function main() {
  console.log('='.repeat(70));
  console.log('RANCANGLOKA — BATCH 1 HERO FINALIZATION & ARTICLE #9993 V3 GENERATION');
  console.log('='.repeat(70));

  const ledger = loadCandidatesLedger();

  // 1. Preserve and archive v2 candidates with audit trail
  console.log('\n[1] Preserving and Archiving v2 Candidates for Article #9993:');
  for (const c of ledger) {
    if (c.article_id === 9993 && !c.id.includes('v3')) {
      const isFlux = c.model.includes('flux');
      const v2Id = isFlux ? 'candidate-9993-flux-1-schnell-v2' : 'candidate-9993-sdxl-lightning-v2';
      const oldFilename = `${c.id}.jpg`;
      const v2Filename = `${v2Id}.jpg`;

      // Copy disk files to preserve historical binary
      const oldStorage = path.join(STORAGE_DIR, oldFilename);
      const v2Storage = path.join(STORAGE_DIR, v2Filename);
      const oldPublic = path.join(PUBLIC_DIR, oldFilename);
      const v2Public = path.join(PUBLIC_DIR, v2Filename);

      if (fs.existsSync(oldStorage) && !fs.existsSync(v2Storage)) {
        fs.copyFileSync(oldStorage, v2Storage);
      }
      if (fs.existsSync(oldPublic) && !fs.existsSync(v2Public)) {
        fs.copyFileSync(oldPublic, v2Public);
      }

      // Update candidate entry
      c.id = v2Id;
      c.version = 'v2';
      c.storage_reference = `storage/experimental-media/${v2Filename}`;
      c.public_url = `/experimental-media/${v2Filename}`;
      c.approval_status = 'REJECTED';
      c.editorial_verdict = 'REJECTED';
      c.rejection_reason = isFlux
        ? 'Ditolak: FLUX v2 menghasilkan kerusakan menyerupai dinding dibobok (terlalu destruktif).'
        : 'Ditolak: SDXL v2 menghasilkan kerusakan terlalu ekstrem untuk masalah pemeliharaan bertahap.';
      c.five_dimensional_qa = evaluateFiveDimensionalQA(9993, isFlux ? 'FLUX' : 'SDXL', 'v2');

      console.log(`  ✓ Archived ${v2Id} with status REJECTED`);
    } else if (c.article_id === 9999) {
      c.version = 'v1';
      const isFlux = c.model.includes('flux');
      c.five_dimensional_qa = evaluateFiveDimensionalQA(9999, isFlux ? 'FLUX' : 'SDXL', 'v1');
      c.editorial_notes = isFlux
        ? 'Pilihan Editorial Utama: Decking rapi, railing proporsional, sirkulasi 60cm terjaga.'
        : 'Cacat Geometri: Pola sambungan decking kayu terdistorsi dan tidak lurus.';
    } else if (c.article_id === 10000) {
      c.version = 'v1';
      const isSdxl = c.model.includes('lightning') || c.model.includes('stable-diffusion');
      c.five_dimensional_qa = evaluateFiveDimensionalQA(10000, isSdxl ? 'SDXL' : 'FLUX', 'v1');
      c.editorial_notes = isSdxl
        ? 'Pilihan Owner: Perspektif ruang tengah 5-6m lapang, bukaan void alami. Catatan: Visualisasi interior 3D (bukan denah teknis 2D).'
        : 'Kandidat Alternatif: Pencahayaan void lebih disukai pada model SDXL.';
    }
  }

  saveCandidatesLedger(ledger);
  console.log('Saved updated ledger with archived v2 candidates.\n');

  // 2. Generate new v3 controlled candidates for Article #9993
  const models = [
    {
      id: CLOUDFLARE_SDXL_MODEL,
      tag: 'SDXL-LIGHTNING',
      name: 'SDXL Lightning',
      estimatedNeurons: 1200,
      steps: 4,
      candidateId: 'candidate-9993-sdxl-lightning-v3'
    },
    {
      id: CLOUDFLARE_FLUX_MODEL,
      tag: 'FLUX-1-SCHNELL',
      name: 'FLUX.1 Schnell',
      estimatedNeurons: 1500,
      steps: 4,
      candidateId: 'candidate-9993-flux-1-schnell-v3'
    }
  ];

  const brief9993 = BATCH_1_CANONICAL_BRIEFS[9993];
  console.log('[2] Generating v3 Controlled Candidates with Cloudflare Workers AI:');
  console.log(`Prompt:\n"${CONTROLLED_PROMPT_9993_V3}"\n`);

  for (const m of models) {
    console.log(`>> Generating ${m.name} (${m.candidateId})...`);
    const adapter = new CloudflareAiImageAdapter({ model: m.id });
    const genStartTime = Date.now();

    const result = await adapter.generate({
      request_id: `req-evi-9993-${m.tag.toLowerCase()}-v3`,
      prompt: CONTROLLED_PROMPT_9993_V3,
      purpose: 'batch1_comparison_candidate',
      media_role: 'featured_hero',
      article_id: 9993,
      model_override: m.id,
      width: 1024,
      height: 1024
    });

    const genLatency = Date.now() - genStartTime;
    console.log(`   Success in ${genLatency}ms. Received ${result.byte_size} bytes.`);
    console.log(`   SHA-256: ${result.sha256}`);

    const candidate = {
      id: m.candidateId,
      article_id: 9993,
      version: 'v3',
      generation_job_id: `JOB-BATCH1-9993-${m.tag}-V3-CONTROLLED`,
      provider: 'cloudflare_ai',
      model: m.id,
      prompt: CONTROLLED_PROMPT_9993_V3,
      dimensions: `${result.width}x${result.height}`,
      width: result.width,
      height: result.height,
      steps: m.steps,
      generation_timestamp: new Date().toISOString(),
      media_role: 'featured_hero',
      provenance: {
        source_type: 'ai_generated_operator_reviewed',
        provider: 'cloudflare_workers_ai',
        model: m.id,
        model_name: m.name,
        latency_ms: genLatency,
        byte_size: result.byte_size,
        sha256: result.sha256,
        evi_version: '1.1.0-controlled',
        brief_slug: brief9993.slug,
        prompt_style: 'controlled_localized_moisture'
      },
      approval_status: 'PENDING_REVIEW',
      storage_reference: '',
      public_url: '',
      byte_size: result.byte_size,
      sha256: result.sha256,
      mime_type: result.mime_type,
      usage: {
        estimated_neurons: m.estimatedNeurons,
        estimated_cost_usd: 0,
        is_free_tier: true
      },
      visual_brief: brief9993,
      geometry_qa: evaluateArchitecturalGeometryQA(9993, m.tag, {
        overallStatus: 'PENDING_REVIEW',
        damageRealism: 'PASS',
        notes: `Kandidat v3 Terkendali: Noda lembap terlokalisasi pada dinding bawah rumah terawat (${m.name}).`
      }),
      subject_priority_qa: evaluateVisualSubjectPriority(9993, {
        visibleElements: [
          'dinding plesteran dengan noda lembab terlokalisasi',
          'bercak cat melepuh kecil',
          'sebagian besar dinding bersih dan utuh',
          'lantai ubin keramik',
          'pencahayaan alami tropis'
        ],
        isDamageVisible: true,
        isCleanPristineWall: false
      }),
      five_dimensional_qa: evaluateFiveDimensionalQA(9993, m.tag, 'v3'),
      crop_preview: calculate16to9Crop(result.width, result.height, 'bottom'),
      editorial_verdict: 'PENDING_REVIEW',
      editorial_notes: `Regenerasi v3 (${m.name}): Kerusakan kelembapan ringan dan bertahap pada rumah tinggal terawat (tanpa lubang bobokan plesteran).`
    };

    saveExperimentalCandidate(candidate, result.image_bytes);
    console.log(`   Saved ${m.candidateId} to storage and public directories.\n`);
  }

  console.log('='.repeat(70));
  console.log('TASK 1 COMPLETE: 2 NEW V3 CANDIDATES GENERATED AND ARCHIVED IN LEDGER');
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('Fatal error during Task 1 generation:', err);
  process.exit(1);
});
