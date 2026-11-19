/**
 * RancangLoka — Kling Image 3.0 Omni Image Series Contract & QA Test Suite
 * File: scripts/test-kling-omni-series-contract.mjs
 *
 * Verifies:
 * 1. Payload Structure: result_type="series", series_amount=2..9, image_list conditioning.
 * 2. Input Bounds: Rejection of series_amount < 2 or > 9.
 * 3. Single-Image Regression: Preserves result_type="single" and n=1 for normal requests.
 * 4. Polling & Result Parsing: Parses task_result.series_images with per-frame indices.
 * 5. Billing Calculation: Output-based units calculation (3 images at 2K = 24 units).
 * 6. Structured Series Prompt: 3 distinct editorial shots with shared immutable lock.
 * 7. Nadia Series QA: Evaluates SAME_HOUSE, FIXED_APPLIANCE, SPATIAL_CONTINUITY,
 *    DISTINCT_CAMERA_ANGLES, ARTICLE_RELEVANCE, and PHOTO_REALISM.
 *
 * INVARIANT: Zero Paid API Calls ($0.00 Spend, Fully Mocked).
 */

import assert from 'node:assert/strict';
import {
  KlingImageProviderAdapter,
  KLING_MODEL_V3_OMNI,
  KLING_UNITS_PER_IMAGE_2K,
  KLING_TRIAL_PREPAID_RATE_PER_UNIT_USD,
  KLING_LIST_PRICE_PER_UNIT_USD
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

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`   ✓ Pass: ${name}`);
  } catch (err) {
    console.error(`   ❌ FAIL: ${name}\n`, err.message);
    throw err;
  }
}

async function itAsync(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`   ✓ Pass: ${name}`);
  } catch (err) {
    console.error(`   ❌ FAIL: ${name}\n`, err.message);
    throw err;
  }
}

console.log('================================================================');
console.log('🧪 TEST: KLING OMNI IMAGE SERIES CONTRACT & NADIA QA SUITE');
console.log('================================================================\n');

const mockCoverBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const houseProfile = getKitchenVentilationHouseProfile(
  'ventilasi-dapur-tanpa-jendela-canary-10011',
  'Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding'
);

const lockedProfile = lockHouseIdentityFromCover(houseProfile, {
  cover_image_id: 'art10011_cover_anchor',
  observed_kitchen_topology: 'U_SHAPE',
  topology_divergence_from_initial: true,
  topology_notes: 'Dapur kompak U-shape sesuai citra cover anchor.',
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

const adapter = new KlingImageProviderAdapter({
  apiKey: 'kling_test_mock_key_series',
  model: KLING_MODEL_V3_OMNI
});

// Test 1: Series Payload Submission Contract
it('T01: Series Payload Construction (result_type="series", series_amount=3)', () => {
  const seriesPrompt = buildStructuredSeriesPrompt(lockedProfile);

  const req = {
    request_id: 'req_series_test_01',
    purpose: 'editorial_series',
    model_override: KLING_MODEL_V3_OMNI,
    prompt: seriesPrompt.prompt_text,
    negative_prompt: seriesPrompt.negative_prompt,
    result_type: 'series',
    series_amount: 3,
    aspect_ratio: '16:9',
    resolution: '2k',
    reference_image_base64: mockCoverBase64
  };

  const inspected = adapter.buildSubmissionPayload(req);

  assert.strictEqual(inspected.endpoint, '/v1/images/omni-image');
  assert.strictEqual(inspected.model, 'kling-v3-omni');
  assert.strictEqual(inspected.payload.model_name, 'kling-v3-omni');
  assert.strictEqual(inspected.payload.result_type, 'series');
  assert.strictEqual(inspected.payload.series_amount, 3);
  assert.strictEqual(inspected.payload.n, undefined, 'Field "n" must not be sent when result_type is series');
  assert.strictEqual(inspected.payload.aspect_ratio, '16:9');
  assert.strictEqual(inspected.payload.resolution, '2k');
  assert.ok(Array.isArray(inspected.payload.image_list), 'image_list must be an array');
  assert.strictEqual(inspected.payload.image_list.length, 1);
  assert.ok(inspected.payload.prompt.includes('<<<image_1>>>'), 'Prompt must condition on <<<image_1>>>');
  assert.ok(!('image_fidelity' in inspected.payload), 'image_fidelity must not be present on omni endpoint');
});

// Test 2: Input Validation Bounds (series_amount 2..9)
it('T02: Rejection of Invalid series_amount (<2 or >9)', () => {
  assert.throws(
    () => {
      adapter.buildSubmissionPayload({
        request_id: 'req_invalid_min',
        purpose: 'test',
        prompt: 'test',
        result_type: 'series',
        series_amount: 1
      });
    },
    /series_amount must be an integer between 2 and 9/,
    'Must reject series_amount < 2'
  );

  assert.throws(
    () => {
      adapter.buildSubmissionPayload({
        request_id: 'req_invalid_max',
        purpose: 'test',
        prompt: 'test',
        result_type: 'series',
        series_amount: 10
      });
    },
    /series_amount must be an integer between 2 and 9/,
    'Must reject series_amount > 9'
  );
});

// Test 3: Backward Compatibility (Single-Image Default)
it('T03: Single-Image Request Preserved as Default', () => {
  const singleReq = {
    request_id: 'req_single_test',
    purpose: 'single_editorial',
    prompt: 'A single photo',
    aspect_ratio: '16:9',
    resolution: '2k'
  };

  const inspected = adapter.buildSubmissionPayload(singleReq);
  assert.strictEqual(inspected.payload.result_type, 'single');
  assert.strictEqual(inspected.payload.n, 1);
  assert.strictEqual(inspected.payload.series_amount, undefined);
});

// Test 4: End-to-End Series Polling & Result Parsing
await itAsync('T04: Polling & Parsing of task_result.series_images', async () => {
  const dummyPng = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000aa00000060008020000008779b5b2000000017352474200a4ce8c490000000467414d410000b18f0bfc61050000000c49444154785e6360000000020001e221bc330000000049454e44ae426082',
    'hex'
  );

  const mockFetch = async (input, init) => {
    const url = String(input);
    if (init?.method === 'POST') {
      return new Response(JSON.stringify({
        code: 0,
        message: 'SUCCEED',
        request_id: 'req_mock_sub_01',
        data: { task_id: 'task_series_999' }
      }));
    }
    if (url.includes('/v1/images/omni-image/task_series_999')) {
      return new Response(JSON.stringify({
        code: 0,
        message: 'SUCCEED',
        request_id: 'req_mock_poll_01',
        data: {
          task_id: 'task_series_999',
          task_status: 'succeed',
          task_result: {
            result_type: 'series',
            images: [],
            series_images: [
              { index: 0, url: 'https://cdn.mock.kling/series_shot1.png' },
              { index: 1, url: 'https://cdn.mock.kling/series_shot2.png' },
              { index: 2, url: 'https://cdn.mock.kling/series_shot3.png' }
            ]
          }
        }
      }));
    }
    if (url.includes('cdn.mock.kling')) {
      return new Response(dummyPng, {
        status: 200,
        headers: { 'Content-Type': 'image/png' }
      });
    }
    return new Response('Not found', { status: 404 });
  };

  const seriesAdapter = new KlingImageProviderAdapter({
    apiKey: 'mock_key',
    model: KLING_MODEL_V3_OMNI,
    pollIntervalMs: 5,
    fetchFn: mockFetch
  });

  const res = await seriesAdapter.generate({
    request_id: 'req_full_series',
    purpose: 'series_generation',
    prompt: 'Coherent 3-shot kitchen series',
    result_type: 'series',
    series_amount: 3,
    resolution: '2k',
    aspect_ratio: '16:9'
  });

  assert.strictEqual(res.result_type, 'series');
  assert.strictEqual(res.batch_count, 3);
  assert.ok(Array.isArray(res.series_images), 'series_images must be returned');
  assert.strictEqual(res.series_images.length, 3);
  assert.strictEqual(res.series_images[0].frame_index, 0);
  assert.strictEqual(res.series_images[1].frame_index, 1);
  assert.strictEqual(res.series_images[2].frame_index, 2);
  assert.strictEqual(res.series_images[0].shot_role, 'cooking_perspective');
  assert.strictEqual(res.series_images[1].shot_role, 'appliance_detail');
  assert.strictEqual(res.series_images[2].shot_role, 'ventilation_solution');
});

// Test 5: Accurate Billing Calculation (Based on Output Images Count)
it('T05: Billing Calculation for 3 Images Series (24 Units)', () => {
  const unitsPerImage = KLING_UNITS_PER_IMAGE_2K; // 8 units
  const seriesAmount = 3;
  const totalUnits = unitsPerImage * seriesAmount; // 24 units
  const effectiveCost = totalUnits * KLING_TRIAL_PREPAID_RATE_PER_UNIT_USD;
  const listPrice = totalUnits * KLING_LIST_PRICE_PER_UNIT_USD;

  assert.strictEqual(totalUnits, 24, '3 output images at 2K must consume 24 Kling units');
  assert.strictEqual(Number(effectiveCost.toFixed(4)), 0.0588, 'Effective trial cost must be $0.0588 (~Rp 958)');
  assert.strictEqual(Number(listPrice.toFixed(4)), 0.0840, 'Official list price must be $0.0840 (~Rp 1369)');
});

// Test 6: Structured Series Prompt Engine
it('T06: Budi Prompt Engine v1.2 Generates Coherent 3-Shot Specifications', () => {
  const seriesPrompt = buildStructuredSeriesPrompt(lockedProfile);

  assert.strictEqual(seriesPrompt.series_amount, 3);
  assert.strictEqual(seriesPrompt.shot_specifications.length, 3);
  assert.strictEqual(seriesPrompt.shot_specifications[0].shot_role, 'cooking_perspective');
  assert.strictEqual(seriesPrompt.shot_specifications[1].shot_role, 'appliance_detail');
  assert.strictEqual(seriesPrompt.shot_specifications[2].shot_role, 'ventilation_solution');

  assert.ok(seriesPrompt.prompt_text.includes('<<<image_1>>>'));
  assert.ok(seriesPrompt.prompt_text.includes('U_SHAPE'));
  assert.ok(seriesPrompt.prompt_text.includes('flat flush kaca induksi'));
  assert.ok(seriesPrompt.prompt_text.includes('Cooker hood slim stainless steel'));

  assert.ok(seriesPrompt.negative_prompt.includes('gas burner rings and grates'));
  assert.ok(seriesPrompt.negative_prompt.includes('protruding gas knobs'));
  assert.ok(seriesPrompt.negative_prompt.includes('duplicate angle'));
});

// Test 7: Nadia QA Series Gate Evaluation
it('T07: Nadia Series Quality Gate Verifies All 6 Invariants', () => {
  const makeMockEval = (custom = {}) => {
    return evaluatePhotoFirstQualityGate({
      candidate_id: 'cand_mock',
      slot_key: 'series_frame',
      photo_role: 'problem_condition',
      target_heading: 'Heading H2',
      caption: 'Caption',
      alt_text: 'Alt',
      house_profile: lockedProfile,
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
        reference_conditioning_verified: true,
        ...custom.observed
      },
      continuity_audit: {
        fixed_appliance_check: {
          is_cooktop_in_frame: true,
          cooktop_type_observed: 'FLAT_GLASS_INDUCTION',
          expected_cooktop_type: 'FLAT_GLASS_INDUCTION',
          is_hood_in_frame: true,
          hood_type_observed: 'SLIM_STAINLESS',
          expected_hood_type: 'SLIM_STAINLESS',
          ...custom.appliance
        },
        layout_continuity_check: {
          is_layout_in_frame: true,
          observed_topology: 'U_SHAPE',
          expected_topology: 'U_SHAPE'
        },
        material_and_color_check: {
          cabinet_material_match: true,
          countertop_material_match: true,
          backsplash_match: true,
          flooring_match: 'NOT_IN_FRAME',
          wall_color_match: true,
          ...custom.materials
        },
        photo_variation_check: {
          camera_perspective_distinct: true,
          camera_distance_distinct: true,
          serves_distinct_editorial_role: true,
          is_duplicate_angle: false
        }
      }
    });
  };

  // Case 7.1: Positive Coherent 3-Frame Series
  const positiveFrames = [
    {
      frame_index: 0,
      shot_role: 'cooking_perspective',
      target_heading: 'Kondisi Memasak Dapur Tanpa Jendela',
      camera_angle: 'WIDE_45_DEGREE_ANGLED_PERSPECTIVE',
      camera_distance: 'MEDIUM_WIDE_SHOT',
      evaluation: makeMockEval()
    },
    {
      frame_index: 1,
      shot_role: 'appliance_detail',
      target_heading: 'Kapan Cooker Hood Resirkulasi Masih Cukup?',
      camera_angle: 'SLIGHT_LOW_ANGLE_UPWARD_DETAIL',
      camera_distance: 'CLOSE_ARCHITECTURAL_DETAIL',
      evaluation: makeMockEval()
    },
    {
      frame_index: 2,
      shot_role: 'ventilation_solution',
      target_heading: 'Solusi Exhaust Fan dan Kisi Udara',
      camera_angle: 'BROAD_CONTEXTUAL_PERSPECTIVE',
      camera_distance: 'FULL_SPACE_PERSPECTIVE',
      evaluation: makeMockEval()
    }
  ];

  const posResult = evaluateImageSeriesQualityGate({
    series_id: 'series_pos_01',
    house_profile: lockedProfile,
    frames: positiveFrames
  });

  assert.strictEqual(posResult.overall_verdict, 'RECOMMENDED_FOR_OWNER');
  assert.strictEqual(posResult.gates.same_house_consistency.status, 'PASS');
  assert.strictEqual(posResult.gates.fixed_appliance_consistency.status, 'PASS');
  assert.strictEqual(posResult.gates.distinct_camera_angles.status, 'PASS');

  // Case 7.2: Rejection on Duplicate Camera Angle
  const duplicateAngleFrames = [
    ...positiveFrames.slice(0, 2),
    {
      frame_index: 2,
      shot_role: 'duplicate_shot',
      target_heading: 'Heading',
      camera_angle: 'WIDE_45_DEGREE_ANGLED_PERSPECTIVE', // Duplicate angle from frame 0
      camera_distance: 'MEDIUM_WIDE_SHOT',
      evaluation: makeMockEval()
    }
  ];

  const dupResult = evaluateImageSeriesQualityGate({
    series_id: 'series_dup_01',
    house_profile: lockedProfile,
    frames: duplicateAngleFrames
  });

  assert.strictEqual(dupResult.overall_verdict, 'REJECTED');
  assert.strictEqual(dupResult.gates.distinct_camera_angles.status, 'FAIL');
  assert.ok(dupResult.rejection_reasons.some(r => r.includes('[SERIES_DUPLICATE_ANGLE_FAIL]')));

  // Case 7.3: Rejection on Morphed Appliance (e.g. Frame 1 mutated to Gas Cooktop)
  const morphedApplianceFrames = [
    positiveFrames[0],
    {
      ...positiveFrames[1],
      evaluation: makeMockEval({
        appliance: {
          cooktop_type_observed: 'GAS_TWO_BURNER',
          has_protruding_gas_grates_if_induction: true
        }
      })
    },
    positiveFrames[2]
  ];

  const morphResult = evaluateImageSeriesQualityGate({
    series_id: 'series_morph_01',
    house_profile: lockedProfile,
    frames: morphedApplianceFrames
  });

  assert.strictEqual(morphResult.overall_verdict, 'REJECTED');
  assert.strictEqual(morphResult.gates.fixed_appliance_consistency.status, 'FAIL');
  assert.ok(morphResult.rejection_reasons.some(r => r.includes('[SERIES_FIXED_APPLIANCE_FAIL]')));
});

console.log(`\n================================================================`);
console.log(`🎉 ALL ${passed}/${total} KLING OMNI SERIES CONTRACT TESTS PASSED (100%)!`);
console.log('================================================================\n');
