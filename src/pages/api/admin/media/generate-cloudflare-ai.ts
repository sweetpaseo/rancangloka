import type { APIRoute } from 'astro';
import { ADMIN_COOKIE_NAME, isValidAdminSession } from '../../../../lib/auth.ts';
import {
  CloudflareAiImageAdapter,
  CLOUDFLARE_FLUX_MODEL,
  CLOUDFLARE_SDXL_MODEL
} from '../../../../lib/media/cloudflare-ai-image-adapter.ts';
import {
  saveExperimentalCandidate,
  type ExperimentalMediaCandidate
} from '../../../../lib/media/experimental-storage.ts';
import { calculateModelNeurons } from '../../../../lib/media/neurons-usage-service.ts';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    const env = (locals as any)?.runtime?.env || (import.meta as any).env || {};
    const sessionCookie = cookies.get(ADMIN_COOKIE_NAME);
    const isAuthenticated = await isValidAdminSession(sessionCookie, env);

    if (!isAuthenticated) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Admin authentication required to generate media.'
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      article_id,
      model = CLOUDFLARE_FLUX_MODEL,
      prompt,
      steps = 4,
      seed,
      media_role = 'featured_hero',
      generation_job_id
    } = body;

    if (!article_id || !prompt || !prompt.trim()) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'INVALID_INPUT',
          message: 'article_id and prompt are required fields.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize adapter with native Cloudflare AI binding if available
    const aiBinding = env?.AI;
    const adapter = new CloudflareAiImageAdapter({
      model,
      aiBinding
    });

    const result = await adapter.generate({
      request_id: `req-cf-${Date.now()}`,
      prompt: prompt.trim(),
      purpose: 'experimental_batch1_cover',
      media_role,
      article_id: Number(article_id),
      model_override: model
    });

    const isFlux = model.includes('flux');
    const modelTag = isFlux ? 'FLUX-1-SCHNELL' : 'SDXL-LIGHTNING';
    const candidateId = `CANDIDATE-${article_id}-${modelTag}-${Date.now().toString().slice(-6)}`;
    const jobId = generation_job_id || `JOB-CF-${Date.now()}`;

    const candidate: ExperimentalMediaCandidate = {
      id: candidateId,
      article_id: Number(article_id),
      generation_job_id: jobId,
      provider: 'cloudflare_ai',
      model,
      prompt: prompt.trim(),
      dimensions: `${result.width}x${result.height}`,
      width: result.width,
      height: result.height,
      seed: seed ? Number(seed) : undefined,
      steps: Number(steps),
      generation_timestamp: result.created_at,
      media_role,
      provenance: {
        source_type: 'ai_generated_operator_reviewed',
        provider: 'cloudflare_workers_ai',
        model,
        latency_ms: result.latency_ms,
        provider_request_id: result.provider_request_id
      },
      approval_status: 'PENDING_REVIEW',
      storage_reference: '',
      public_url: '',
      byte_size: result.byte_size,
      sha256: result.sha256,
      mime_type: result.mime_type,
      usage: {
        estimated_neurons: calculateModelNeurons(model, result.width, result.height, Number(steps)).neuronsEstimated,
        estimated_cost_usd: null, // Cost is unverified; do not display $0.00 as actual verified cost
        is_free_tier: true,
        pricing_status: calculateModelNeurons(model, result.width, result.height, Number(steps)).pricingStatus,
        cost_status: isFlux ? 'UNVERIFIED_FREE_TIER' : 'UNKNOWN'
      }
    };

    saveExperimentalCandidate(candidate, result.image_bytes);

    return new Response(
      JSON.stringify({
        status: 'success',
        candidate
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: err.code || 'GENERATION_FAILED',
        message: err.message || String(err)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
