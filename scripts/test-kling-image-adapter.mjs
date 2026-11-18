/**
 * RancangLoka — Kling Image Provider V1 Integration & Benchmark Test Suite
 *
 * Validates:
 * 1. KlingImageProviderAdapter interface conformity with ImageProviderAdapter.
 * 2. Secure API key authentication & zero credential leakage.
 * 3. Model selection: Model A (kling-v3) & Model B (kling-v3-omni).
 * 4. Aspect ratio (16:9, 1:1, etc.) & resolution (1K, 2K) normalization.
 * 5. Batch support n=1..9.
 * 6. Asynchronous task submission, polling loop, and task idempotency.
 * 7. Error handling & mapping (AUTH_ERROR, RATE_LIMIT, CONTENT_POLICY_BLOCK, PROVIDER_5XX).
 * 8. Download, binary validation, dimensions, and SHA-256 generation.
 * 9. Integration with Budi Media Pipeline (Seedream Pro as DEFAULT, Kling as EXPERIMENTAL).
 * 10. Multi-agent visual evaluation (Rina, Irwan, Budi, JEV) compatibility.
 * 11. Article #10000 benchmark specification readiness (Kling 3.0 vs Seedream Pro V2).
 *
 * ALL TESTS RUN IN ZERO-SPEND MODE ($0.00 spend).
 */

import assert from 'node:assert/strict';
import {
  KlingImageProviderAdapter,
  KLING_API_BASE,
  KLING_MODEL_V3,
  KLING_MODEL_V3_OMNI,
  DEFAULT_KLING_MODEL,
  KLING_V3_UNIT_COST_USD,
  KLING_V3_OMNI_UNIT_COST_USD,
  KLING_UNITS_PER_IMAGE_2K,
  KLING_UNITS_PER_IMAGE_4K,
  KLING_LIST_PRICE_PER_UNIT_USD,
  KLING_TRIAL_PREPAID_RATE_PER_UNIT_USD,
  KLING_V3_2K_LIST_PRICE_USD,
  KLING_V3_4K_LIST_PRICE_USD,
  KLING_2K_EFFECTIVE_PREPAID_USD,
  KLING_4K_EFFECTIVE_PREPAID_USD,
  persistKlingCandidateToR2Staging
} from '../src/lib/media/kling-image-adapter.ts';
import { ImageProviderError } from '../src/lib/media/image-provider-types.ts';
import { executeBudiMediaPipeline } from '../src/lib/editorial/budi-media-pipeline.ts';
import { generateVisualStoryboard } from '../src/lib/editorial/nadia-visual-storyboard.ts';
import {
  buildDeepPromptV2,
  SEEDREAM_PRO_MODEL_ID,
  SEEDREAM_PRICE_USD,
  KLING_V3_MODEL_ID,
  KLING_V3_OMNI_MODEL_ID
} from '../src/lib/editorial/budi-prompt-engine.ts';
import {
  evaluateEditorialVisionV2,
  evaluateStrictVisualEvidenceGate
} from '../src/lib/editorial/visual-quality-reviewer.ts';

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function itAsync(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// Generate valid 1x1 JPEG bytes for testing
function createMockJpegBytes(width = 1920, height = 1080) {
  // Minimal valid JPEG with SOF0 marker for dimension parsing
  const bytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff, // Height
    (width >> 8) & 0xff, width & 0xff,   // Width
    0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9 // EOI
  ]);
  return bytes;
}

async function run() {
  console.log('================================================================');
  console.log('🧪 RANCANGLOKA — KLING IMAGE API PROVIDER V1 TEST SUITE');
  console.log('================================================================\n');

  // 1. Adapter Configuration & Defaults
  it('T01: Adapter defaults to kling-v3 and Singapore API Base', () => {
    const adapter = new KlingImageProviderAdapter({ apiKey: 'mock_test_key_123' });
    assert.equal(adapter.providerName, 'kling');
    assert.equal(adapter.model, KLING_MODEL_V3);
    assert.equal(adapter.baseUrl, 'https://api-singapore.klingai.com');
  });

  it('T02: Adapter resolves 16:9 aspect ratio and 2K resolution for architectural visuals', () => {
    const adapter = new KlingImageProviderAdapter({ apiKey: 'mock_test_key_123' });

    assert.equal(adapter.resolveAspectRatio({ aspect_ratio: '16:9', prompt: '', purpose: 'test', request_id: '1' }), '16:9');
    assert.equal(adapter.resolveAspectRatio({ aspect_ratio: '1312:672', prompt: '', purpose: 'test', request_id: '2' }), '16:9');
    assert.equal(adapter.resolveAspectRatio({ aspect_ratio: '1:1', prompt: '', purpose: 'test', request_id: '3' }), '1:1');
    assert.equal(adapter.resolveAspectRatio({ aspect_ratio: '9:16', prompt: '', purpose: 'test', request_id: '4' }), '9:16');
    assert.equal(adapter.resolveAspectRatio({ prompt: '', purpose: 'test', request_id: '5' }), '16:9'); // Default

    assert.equal(adapter.resolveResolution({ prompt: '', purpose: 'test', request_id: '1' }), '2k');
    assert.equal(adapter.resolveResolution({ quality: 'standard', width: 800, prompt: '', purpose: 'test', request_id: '2' }), '1k');
  });

  it('T03: Adapter clamps batch count n between 1 and 9', () => {
    const adapter = new KlingImageProviderAdapter({ apiKey: 'mock_test_key_123' });
    assert.equal(adapter.resolveBatchCount({ prompt: '', purpose: 'test', request_id: '1' }), 1);
    assert.equal(adapter.resolveBatchCount({ prompt: '', purpose: 'test', request_id: '2', n: 4 }), 4);
    assert.equal(adapter.resolveBatchCount({ prompt: '', purpose: 'test', request_id: '3', n: 12 }), 9);
    assert.equal(adapter.resolveBatchCount({ prompt: '', purpose: 'test', request_id: '4', n: 0 }), 1);
  });

  it('T04: Missing API Key fails closed with typed AUTH_ERROR', async () => {
    const adapter = new KlingImageProviderAdapter({ apiKey: '' });
    await assert.rejects(
      async () => {
        await adapter.generate({
          request_id: 'req_test_no_auth',
          prompt: 'Architectural test',
          purpose: 'test'
        });
      },
      (err) => {
        assert.ok(err instanceof ImageProviderError);
        assert.equal(err.code, 'AUTH_ERROR');
        assert.equal(err.provider, 'kling');
        assert.equal(err.isBillable, false);
        return true;
      }
    );
  });

  // 2. Simulated End-to-End Generation for Model A (kling-v3)
  await itAsync('T05: Model A (kling-v3) task submission and polling loop completes in mock mode', async () => {
    const mockTaskId = 'task_kling_v3_test_98765';
    let postCalled = false;
    let pollCount = 0;
    const mockJpeg = createMockJpegBytes(1920, 1080);

    const mockFetch = async (url, init) => {
      const urlStr = String(url);
      const method = init?.method || 'GET';

      // 1. Task submission
      if (urlStr.includes('/v1/images/generations') && method === 'POST') {
        postCalled = true;
        const body = JSON.parse(init.body);
        assert.equal(body.model_name, 'kling-v3');
        assert.equal(body.resolution, '2k');
        assert.equal(body.aspect_ratio, '16:9');
        assert.equal(init.headers['Authorization'], 'Bearer mock_secret_kling_key_001');

        return new Response(JSON.stringify({
          code: 0,
          message: 'SUCCEED',
          request_id: 'req_kling_gw_01',
          data: {
            task_id: mockTaskId,
            task_status: 'submitted',
            created_at: Date.now()
          }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // 2. Task status polling
      if (urlStr.includes(`/v1/images/generations/${mockTaskId}`) && method === 'GET') {
        pollCount++;
        if (pollCount === 1) {
          return new Response(JSON.stringify({
            code: 0,
            message: 'SUCCEED',
            request_id: 'req_kling_gw_02',
            data: {
              task_id: mockTaskId,
              task_status: 'processing'
            }
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({
          code: 0,
          message: 'SUCCEED',
          request_id: 'req_kling_gw_03',
          data: {
            task_id: mockTaskId,
            task_status: 'succeed',
            task_result: {
              images: [
                {
                  index: 0,
                  url: 'https://cdn.klingai.com/mock-output-kling-v3.jpg'
                }
              ]
            }
          }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // 3. Image download
      if (urlStr.includes('cdn.klingai.com/mock-output-kling-v3.jpg')) {
        return new Response(mockJpeg, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' }
        });
      }

      throw new Error(`Unexpected mock URL: ${urlStr}`);
    };

    const adapter = new KlingImageProviderAdapter({
      apiKey: 'mock_secret_kling_key_001',
      model: KLING_MODEL_V3,
      pollIntervalMs: 10,
      fetchFn: mockFetch
    });

    const result = await adapter.generate({
      request_id: 'req_kling_v3_success',
      prompt: 'Interior denah rumah lebar 5 meter arsitektur tropis',
      aspect_ratio: '16:9',
      purpose: 'canary'
    });

    assert.ok(postCalled, 'POST task submission must be called');
    assert.equal(pollCount, 2, 'Must poll twice before succeed');
    assert.equal(result.provider, 'kling');
    assert.equal(result.model, 'kling-v3');
    assert.equal(result.task_id, mockTaskId);
    assert.equal(result.external_task_id, 'req_kling_v3_success');
    assert.equal(result.mime_type, 'image/jpeg');
    assert.equal(result.width, 1920);
    assert.equal(result.height, 1080);
    assert.ok(result.sha256.length === 64);
    assert.equal(result.cost_metadata?.estimated_cost_usd, KLING_V3_UNIT_COST_USD);
    assert.equal(result.cost_metadata?.is_billable, true);
  });

  // 3. Simulated Model B (kling-v3-omni)
  await itAsync('T06: Model B (kling-v3-omni) uses /v1/images/omni-image endpoints', async () => {
    const mockTaskId = 'task_omni_test_777';
    let omniEndpointUsed = false;
    const mockJpeg = createMockJpegBytes(1920, 1080);

    const mockFetch = async (url, init) => {
      const urlStr = String(url);
      const method = init?.method || 'GET';

      if (urlStr.includes('/v1/images/omni-image') && method === 'POST') {
        omniEndpointUsed = true;
        const body = JSON.parse(init.body);
        assert.equal(body.model_name, 'kling-v3-omni');
        return new Response(JSON.stringify({
          code: 0,
          message: 'SUCCEED',
          request_id: 'req_omni_01',
          data: { task_id: mockTaskId, task_status: 'submitted' }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes(`/v1/images/omni-image/${mockTaskId}`) && method === 'GET') {
        return new Response(JSON.stringify({
          code: 0,
          message: 'SUCCEED',
          request_id: 'req_omni_02',
          data: {
            task_id: mockTaskId,
            task_status: 'succeed',
            task_result: { images: [{ index: 0, url: 'https://cdn.klingai.com/omni.jpg' }] }
          }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('cdn.klingai.com/omni.jpg')) {
        return new Response(mockJpeg, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
      }

      throw new Error(`Unexpected URL: ${urlStr}`);
    };

    const adapter = new KlingImageProviderAdapter({
      apiKey: 'mock_key',
      model: KLING_MODEL_V3_OMNI,
      pollIntervalMs: 10,
      fetchFn: mockFetch
    });

    const result = await adapter.generate({
      request_id: 'req_omni_test',
      prompt: 'Omni multi-element architectural study',
      purpose: 'canary'
    });

    assert.ok(omniEndpointUsed, 'Must use /v1/images/omni-image endpoint');
    assert.equal(result.model, 'kling-v3-omni');
    assert.equal(result.cost_metadata?.estimated_cost_usd, KLING_V3_OMNI_UNIT_COST_USD);
  });

  // 4. Batch Generation (n=4)
  await itAsync('T07: Batch generation (n=4) downloads all candidates and calculates aggregate cost', async () => {
    const mockTaskId = 'task_batch_4_test';
    const mockJpeg = createMockJpegBytes(1920, 1080);

    const mockFetch = async (url, init) => {
      const urlStr = String(url);
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body);
        assert.equal(body.n, 4);
        return new Response(JSON.stringify({
          code: 0,
          message: 'SUCCEED',
          request_id: 'req_b1',
          data: { task_id: mockTaskId, task_status: 'submitted' }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes(`/v1/images/generations/${mockTaskId}`)) {
        return new Response(JSON.stringify({
          code: 0,
          message: 'SUCCEED',
          request_id: 'req_b2',
          data: {
            task_id: mockTaskId,
            task_status: 'succeed',
            task_result: {
              images: [
                { index: 0, url: 'https://cdn.klingai.com/batch_0.jpg' },
                { index: 1, url: 'https://cdn.klingai.com/batch_1.jpg' },
                { index: 2, url: 'https://cdn.klingai.com/batch_2.jpg' },
                { index: 3, url: 'https://cdn.klingai.com/batch_3.jpg' }
              ]
            }
          }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('cdn.klingai.com/batch_')) {
        return new Response(mockJpeg, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
      }

      throw new Error(`Unexpected URL: ${urlStr}`);
    };

    const adapter = new KlingImageProviderAdapter({
      apiKey: 'mock_key',
      pollIntervalMs: 10,
      fetchFn: mockFetch
    });

    const result = await adapter.generate({
      request_id: 'req_batch_test',
      prompt: 'Denah lebar 5 meter batch comparison',
      purpose: 'benchmark',
      n: 4
    });

    assert.equal(result.batch_count, 4);
    assert.equal(result.batch_images?.length, 4);
    assert.equal(result.cost_metadata?.billed_units, 32); // 8 units * 4 images = 32 units
    assert.equal(result.cost_metadata?.actual_units_consumed, 32);
    assert.equal(result.cost_metadata?.estimated_cost_usd, Number((KLING_V3_2K_LIST_PRICE_USD * 4).toFixed(4)));
  });

  // 5. Task Idempotency: Polling failure does NOT re-generate task
  await itAsync('T08: Polling network failure preserves task_id without re-submitting new generation', async () => {
    let postCount = 0;
    const mockTaskId = 'task_preserve_123';

    const mockFetch = async (url, init) => {
      const urlStr = String(url);
      if (init?.method === 'POST') {
        postCount++;
        return new Response(JSON.stringify({
          code: 0,
          message: 'SUCCEED',
          request_id: 'req_idemp_1',
          data: { task_id: mockTaskId, task_status: 'submitted' }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes(mockTaskId)) {
        // Simulate network disconnect during poll
        throw new Error('ECONNRESET: Connection dropped during polling query');
      }

      throw new Error(`Unexpected URL: ${urlStr}`);
    };

    const adapter = new KlingImageProviderAdapter({
      apiKey: 'mock_key',
      pollIntervalMs: 5,
      fetchFn: mockFetch
    });

    await assert.rejects(
      async () => {
        await adapter.generate({
          request_id: 'req_idempotent_test',
          prompt: 'Idempotency verification',
          purpose: 'test'
        });
      },
      (err) => {
        assert.ok(err instanceof ImageProviderError);
        assert.equal(err.code, 'TIMEOUT');
        assert.equal(err.details?.taskId, mockTaskId);
        return true;
      }
    );

    // Critical Invariant: POST submission was executed exactly ONCE
    assert.equal(postCount, 1, 'Task must NEVER be re-submitted when polling fails');
  });

  // 6. Security Invariant: API Key is never leaked in errors
  await itAsync('T09: Secret Redaction: KLING_API_KEY is stripped from all error messages', async () => {
    const sensitiveKey = 'SUPER_SECRET_KLING_KEY_999888';

    const mockFetch = async () => {
      return new Response(JSON.stringify({
        code: 1000,
        message: `Unauthorized access using token ${sensitiveKey}`,
        request_id: 'err_01',
        data: null
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    };

    const adapter = new KlingImageProviderAdapter({
      apiKey: sensitiveKey,
      fetchFn: mockFetch
    });

    await assert.rejects(
      async () => {
        await adapter.generate({
          request_id: 'req_redact_test',
          prompt: 'Security leak test',
          purpose: 'test'
        });
      },
      (err) => {
        assert.ok(err instanceof ImageProviderError);
        assert.equal(err.code, 'AUTH_ERROR');
        assert.ok(!err.message.includes(sensitiveKey), 'Secret key must NOT appear in error message');
        assert.ok(err.message.includes('[REDACTED_KLING_API_KEY]'), 'Secret must be replaced with redacted token');
        return true;
      }
    );
  });

  // 7. Pipeline Integration: Seedream Pro remains DEFAULT, Kling is EXPERIMENTAL
  await itAsync('T10: Budi Media Pipeline preserves Seedream Pro as DEFAULT and enables Kling as EXPERIMENTAL', async () => {
    const testStoryboard = generateVisualStoryboard({
      id: 88888,
      slug: 'uji-eksperimental-kling-provider-v1',
      title: 'Uji Eksperimental Kling Provider V1',
      markdown: '## Contoh Heading\n\nIsi paragraf contoh untuk uji pipeline media.'
    });

    // Default call: no provider specified -> must default to seedream
    const defaultResult = await executeBudiMediaPipeline(null, testStoryboard, 'markdown', {
      allowPaidGeneration: false,
      allowMockWhenMissing: true
    });
    assert.equal(defaultResult.providerUsed, 'seedream');
    assert.equal(defaultResult.modelUsed, SEEDREAM_PRO_MODEL_ID);

    // Explicit experimental Kling call
    const klingResult = await executeBudiMediaPipeline(null, testStoryboard, 'markdown', {
      provider: 'kling',
      klingModel: 'kling-v3',
      allowPaidGeneration: false,
      allowMockWhenMissing: true
    });
    assert.equal(klingResult.providerUsed, 'kling');
    assert.equal(klingResult.modelUsed, 'kling-v3');
    assert.ok(klingResult.warnings.some(w => w.includes('kling-v3')));
  });

  // 8. Multi-Agent Evaluation Compatibility (Rina, Irwan, Budi, JEV)
  it('T11: Multi-Agent Reviewer accurately evaluates Kling candidate images', () => {
    const evaluation = evaluateEditorialVisionV2({
      candidate_id: 'kling_v3_art10000_cover_cand01',
      slot_key: 'cover_hero',
      model: 'kling-v3',
      cost_usd: KLING_V3_UNIT_COST_USD,
      scores: {
        editorial_relevance: 90,
        architectural_accuracy: 88,
        visual_explanation_clarity: 85,
        photorealism: 89,
        premium_composition: 90
      },
      signals: {
        has_natural_daylight: true,
        has_authentic_materials: true
      }
    });

    assert.equal(evaluation.overall_verdict, 'PASS');
    assert.equal(evaluation.model, 'kling-v3');
    assert.equal(evaluation.jev_supervision.recommendation, 'APPROVE_FOR_OWNER');
    assert.equal(evaluation.jev_supervision.cost_usd, KLING_V3_UNIT_COST_USD);
    assert.ok(evaluation.rubric_v2.weighted_total_score >= 85);
  });

  // 9. Article #10000 Benchmark Specification Readiness
  it('T12: Article #10000 benchmark specification is ready for Kling 3.0 (2K, 16:9, batch=1)', () => {
    const deepSpec = buildDeepPromptV2(
      {
        slot_key: 'cover_hero',
        intent_type: 'ARCHITECTURAL_REALISM',
        main_problem: '5–6 meter',
        editorial_angle: 'solusi sirkulasi dan bukaan ruang tengah'
      },
      {
        article_slug: 'menata-denah-rumah-lebar-5-6-meter-solusi-sirkulasi',
        target_model: KLING_V3_MODEL_ID,
        aspect_ratio: '16:9'
      }
    );

    assert.equal(deepSpec.target_model, 'kling-v3');
    assert.equal(deepSpec.aspect_ratio, '16:9');
    assert.ok(deepSpec.compiled_prompt.length > 300, 'Compiled prompt must be thorough and detailed');
    assert.ok(deepSpec.compiled_prompt.includes('5-meter'));
    assert.ok(deepSpec.compiled_prompt.includes('courtyard'));
    assert.ok(deepSpec.negative_prompt.includes('CGI'));
  });

  // 10. Official Kling Pricing Model Calibration
  await itAsync('T13: Official Kling pricing model: 2K=8 units ($0.028 list), 4K=16 units ($0.056 list), trial rate=$0.00245/unit', async () => {
    assert.equal(KLING_UNITS_PER_IMAGE_2K, 8);
    assert.equal(KLING_UNITS_PER_IMAGE_4K, 16);
    assert.equal(KLING_V3_2K_LIST_PRICE_USD, 0.0280);
    assert.equal(KLING_V3_4K_LIST_PRICE_USD, 0.0560);
    assert.equal(KLING_LIST_PRICE_PER_UNIT_USD, 0.0035);
    assert.equal(KLING_TRIAL_PREPAID_RATE_PER_UNIT_USD, 0.00245);
    assert.equal(KLING_2K_EFFECTIVE_PREPAID_USD, 0.0196);
    assert.equal(KLING_4K_EFFECTIVE_PREPAID_USD, 0.0392);

    const mockJpeg = createMockJpegBytes(1920, 1080);
    const mockTaskId = 'task_price_check';
    const mockFetch = async (url, init) => {
      const s = String(url);
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({
          code: 0,
          message: 'SUCCEED',
          request_id: 'req_price_1',
          data: { task_id: mockTaskId, task_status: 'submitted' }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (s.includes(mockTaskId)) {
        return new Response(JSON.stringify({
          code: 0,
          message: 'SUCCEED',
          request_id: 'req_price_2',
          data: {
            task_id: mockTaskId,
            task_status: 'succeed',
            task_result: { images: [{ index: 0, url: 'https://cdn.klingai.com/img0.jpg' }] }
          }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(mockJpeg, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
    };

    const adapter = new KlingImageProviderAdapter({
      apiKey: 'kling_key_pricing',
      pollIntervalMs: 5,
      fetchFn: mockFetch
    });

    const res = await adapter.generate({
      request_id: 'req_price_test',
      prompt: 'Price test',
      purpose: 'test',
      n: 1
    });

    assert.equal(res.cost_metadata?.actual_units_consumed, 8);
    assert.equal(res.cost_metadata?.estimated_spend_usd, 0.0280);
    assert.equal(res.cost_metadata?.effective_prepaid_cost_usd, 0.0196);
    assert.equal(res.cost_metadata?.list_price_usd, 0.0280);
    assert.equal(res.cost_metadata?.units_per_image, 8);
  });

  // 11. Visual Quality Reviewer Decoupling
  it('T14: Visual Quality Reviewer decouples visual quality from price; Seedream Pro ($0.0675) achieves top score', () => {
    const seedreamEval = evaluateEditorialVisionV2({
      candidate_id: 'seedream_cand_art10000',
      slot_key: 'cover_hero',
      model: SEEDREAM_PRO_MODEL_ID,
      cost_usd: SEEDREAM_PRICE_USD, // 0.0675
      scores: {
        editorial_relevance: 96,
        architectural_accuracy: 94,
        visual_explanation_clarity: 95,
        photorealism: 95,
        premium_composition: 95
      },
      signals: {
        has_natural_daylight: true,
        has_authentic_materials: true
      }
    });

    // Seedream Pro visual score is not penalized by price
    assert.equal(seedreamEval.overall_verdict, 'PASS');
    assert.ok(seedreamEval.rubric_v2.weighted_total_score >= 94, 'Seedream Pro must achieve top tier score (94+)');
    assert.equal(seedreamEval.jev_supervision.cost_usd, 0.0675);
    assert.equal(seedreamEval.jev_supervision.cost_per_accepted_image_usd, 0.0675);
    assert.equal(seedreamEval.jev_supervision.quality_vs_cost_ratio, 'EXCELLENT', 'Seedream Pro must be rated EXCELLENT for high quality');
    assert.equal(seedreamEval.jev_supervision.recommendation, 'APPROVE_FOR_OWNER');
  });

  // 12. R2 Staging Persistence Contract
  await itAsync('T15: R2 Staging Persistence stores candidate binary and targets rancangloka-media-staging', async () => {
    const mockBytes = createMockJpegBytes(1920, 1080);
    let mockR2PutCalled = false;
    let putKey = '';

    const mockBucket = {
      async put(key, body, options) {
        mockR2PutCalled = true;
        putKey = key;
        return { key, size: body.byteLength };
      }
    };

    const persistResult = await persistKlingCandidateToR2Staging({
      imageBytes: mockBytes,
      articleId: 10000,
      slotKey: 'cover',
      model: 'kling-v3',
      mimeType: 'image/jpeg',
      r2Bucket: mockBucket
    });

    assert.ok(persistResult.persisted);
    assert.ok(persistResult.persisted_to_r2);
    assert.equal(persistResult.r2_bucket, 'rancangloka-media-staging');
    assert.ok(persistResult.storage_key.includes('media/staging/articles/10000/'));
    assert.ok(persistResult.storage_key.includes('kling-v3'));
    assert.equal(mockR2PutCalled, true);
    assert.equal(putKey, persistResult.storage_key);
    assert.ok(persistResult.upload_command.includes('rancangloka-media-staging'));
  });

  console.log('\n================================================================');
  console.log(`HASIL TEST SUITE KLING IMAGE PROVIDER V1: ${passed} / ${total} PASS`);
  console.log('================================================================');
  console.log('STATUS: ALL INTEGRATION & BENCHMARK CONTRACTS VERIFIED (100% PASS)');
  console.log('TOTAL ACTUAL SPEND: US$0.00 (Zero paid calls, fully mocked)');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
