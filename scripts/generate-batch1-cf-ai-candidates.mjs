/**
 * RancangLoka — Batch 1 Experimental Image Generation Runner (MEDIA-CLOUDFLARE-AI-1)
 *
 * Generates 6 experimental hero candidates across Batch 1 articles:
 * - Article A (ID 9993): 1 FLUX.1 Schnell, 1 SDXL Lightning
 * - Article B (ID 9999): 1 FLUX.1 Schnell, 1 SDXL Lightning
 * - Article C (ID 10000): 1 FLUX.1 Schnell, 1 SDXL Lightning
 *
 * SAFETY INVARIANTS:
 * - Maximum 6 successful generations. Zero infinite loops.
 * - approval_status = PENDING_REVIEW (Zero auto-approval, zero production mutation).
 * - All assets segregated in storage/experimental-media and public/experimental-media.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CloudflareAiImageAdapter,
  CLOUDFLARE_FLUX_MODEL,
  CLOUDFLARE_SDXL_MODEL
} from '../src/lib/media/cloudflare-ai-image-adapter.ts';
import {
  saveExperimentalCandidate
} from '../src/lib/media/experimental-storage.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BATCH_1_ARTICLES = [
  {
    id: 9993,
    code: 'ARTICLE_A',
    slug: 'dinding-rembes-dan-cat-menggelembung-cara-membedakan-masalah-talang-plesteran-kelembapan-tanah',
    title: 'Dinding Rembes dan Cat Menggelembung',
    prompt:
      'Editorial interior photography of an authentic modern Indonesian house living room, eye-level shot. A plastered brick wall showing realistic blistering paint texture and fine white salt efflorescence near the skirting board at ground level, contrasting with a clean modern white-sand textured wall above. Warm tropical morning ambient sunlight streaming from a side window, soft shadows, warm natural wood console table nearby, matte ceramic floor tiles. Architectural Digest Indonesia style, 8k resolution, crisp architectural detail, photojournalistic, no exaggerated water spills, no CGI artificial glare.'
  },
  {
    id: 9999,
    code: 'ARTICLE_B',
    slug: '7-ide-menata-balkon-rumah-kecil-agar-nyaman',
    title: '7 Ide Menata Balkon Rumah Kecil agar Nyaman dan Teduh',
    prompt:
      "Architectural photography of a cozy compact balcony (1.2 x 2.4 meters) on the second floor of a modern Indonesian townhouse. Acacia wood interlocking decking tiles on the floor, black powder-coated iron railing with a sleek foldable wooden railing bar table holding a ceramic mug and a book. Lush vertical plants in terracotta wall pots including devil's ivy (sirih gading) and compact sansevieria. Golden hour warm sunlight casting gentle diagonal shadows, clean sliding glass door open to an interior room, no clutter, warm inviting mood, Kinfolk and Livingetc aesthetic, 8k photorealistic."
  },
  {
    id: 10000,
    code: 'ARTICLE_C',
    slug: 'menata-denah-rumah-lebar-5-6-meter-solusi-sirkulasi-bukaan-ruang-tengah-tidak-pengap',
    title: 'Menata Denah Rumah Lebar 5–6 Meter',
    prompt:
      'Editorial interior architecture photography of a narrow modern Indonesian row house with a 6-meter facade width. Open-concept living and dining area centered around an internal dry garden courtyard (inner court) with floor-to-ceiling black aluminum sliding doors open. Soft zenithal daylight washing down from the open courtyard sky onto warm microcement floor and light wood dining table. Terrazzo planter with a slender tropical tree (Ketapang Kencana mini), breeze rippling linen curtains. Jakarta modern tropical home, warm neutral palette (#E6E2D8), crisp lines, photorealistic, 8k.'
  }
];

const MODELS = [
  {
    id: CLOUDFLARE_FLUX_MODEL,
    tag: 'FLUX-1-SCHNELL',
    name: 'FLUX.1 Schnell',
    estimatedNeurons: 1500,
    steps: 4
  },
  {
    id: CLOUDFLARE_SDXL_MODEL,
    tag: 'SDXL-LIGHTNING',
    name: 'SDXL Lightning',
    estimatedNeurons: 1200,
    steps: 4
  }
];

async function main() {
  console.log('='.repeat(70));
  console.log('CLOUDFLARE WORKERS AI — BATCH 1 EXPERIMENTAL COVER GENERATION');
  console.log('='.repeat(70));
  console.log(`Planned executions: 3 articles × 2 models = 6 candidates maximum`);
  console.log(`Safety Envelope: Strictly Free Tier (10,000 Neurons/day allocation)`);
  console.log(`Output Directories: storage/experimental-media & public/experimental-media\n`);

  let successCount = 0;
  const startTimeTotal = Date.now();
  const summaryLog = [];

  for (const article of BATCH_1_ARTICLES) {
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`[ARTICLE ${article.code}] ID ${article.id}: ${article.title}`);
    console.log(`----------------------------------------------------------------------`);

    for (const model of MODELS) {
      if (successCount >= 6) {
        console.log(`\nReached maximum budget of 6 successful generations. Stopping safely.`);
        break;
      }

      console.log(`\n>> Generating candidate with model: ${model.name} (${model.id})`);
      const adapter = new CloudflareAiImageAdapter({ model: model.id });

      try {
        const genStartTime = Date.now();
        const result = await adapter.generate({
          request_id: `req-batch1-${article.id}-${model.tag.toLowerCase()}`,
          prompt: article.prompt,
          purpose: 'batch1_comparison_candidate',
          media_role: 'featured',
          article_id: article.id,
          model_override: model.id
        });

        const candidateId = `candidate-${article.id}-${model.tag.toLowerCase()}`;
        const candidate = {
          id: candidateId,
          article_id: article.id,
          generation_job_id: `JOB-BATCH1-${article.id}-${model.tag}`,
          provider: 'cloudflare_ai',
          model: model.id,
          prompt: article.prompt,
          dimensions: `${result.width}x${result.height}`,
          width: result.width,
          height: result.height,
          steps: model.steps,
          generation_timestamp: result.created_at,
          media_role: 'featured_hero',
          provenance: {
            source_type: 'ai_generated_operator_reviewed',
            provider: 'cloudflare_workers_ai',
            model: model.id,
            model_name: model.name,
            latency_ms: result.latency_ms,
            byte_size: result.byte_size,
            sha256: result.sha256
          },
          approval_status: 'PENDING_REVIEW',
          storage_reference: '',
          public_url: '',
          byte_size: result.byte_size,
          sha256: result.sha256,
          mime_type: result.mime_type,
          usage: {
            estimated_neurons: model.estimatedNeurons,
            estimated_cost_usd: 0.0,
            is_free_tier: true
          }
        };

        saveExperimentalCandidate(candidate, result.image_bytes);
        successCount++;

        console.log(`  ✓ SUCCESS: Candidate ${candidateId} saved!`);
        console.log(`    - Model: ${model.name}`);
        console.log(`    - Dimensions: ${result.width}x${result.height}`);
        console.log(`    - Size: ${(result.byte_size / 1024).toFixed(1)} KB (${result.mime_type})`);
        console.log(`    - SHA-256: ${result.sha256.slice(0, 16)}...`);
        console.log(`    - Latency: ${result.latency_ms}ms`);
        console.log(`    - Public Path: ${candidate.public_url}`);

        summaryLog.push({
          articleId: article.id,
          articleTitle: article.title,
          model: model.name,
          candidateId,
          dimensions: candidate.dimensions,
          sizeKb: (result.byte_size / 1024).toFixed(1),
          latencyMs: result.latency_ms,
          status: 'SUCCESS'
        });
      } catch (err) {
        console.error(`  ❌ FAILED to generate for ${article.id} / ${model.name}:`, err.message);
        summaryLog.push({
          articleId: article.id,
          articleTitle: article.title,
          model: model.name,
          status: 'FAILED',
          error: err.message
        });
      }
    }
  }

  const totalDuration = ((Date.now() - startTimeTotal) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(70));
  console.log(`GENERATION COMPLETED in ${totalDuration}s`);
  console.log(`Successful candidates: ${successCount} / 6`);
  console.log('='.repeat(70));
  console.table(summaryLog);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
