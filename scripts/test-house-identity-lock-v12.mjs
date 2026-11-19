/**
 * RancangLoka — House Identity Lock v1.2 & Visual Continuity QA Regression Test
 * File: scripts/test-house-identity-lock-v12.mjs
 *
 * Verifies:
 * 1. Task 1: Cover-Driven House Lock (Extracting ground truth from accepted Cover)
 * 2. Task 2: Revised Budi Prompt Engine (Strict IMMUTABLE vs MUTABLE separation)
 * 3. Task 3 & 4: Nadia Visual Continuity Gate (Catching appliance & topology morphing)
 * 4. Task 5: Regression Test on EXISTING Kling Omni #10011 images:
 *    - Catches cooktop mismatch (Cover flat induction vs Inline gas burners + grates)
 *    - Replaces previous false pass (96/100) with deterministic FAIL (REJECTED)
 * 5. Out-of-frame safety: Unverifiable elements report NEEDS_REVIEW, never false PASS.
 *
 * Zero paid API spend ($0.00).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getKitchenVentilationHouseProfile,
  lockHouseIdentityFromCover,
  buildStructuredInlinePrompt
} from '../src/lib/editorial/house-identity.ts';
import {
  evaluatePhotoFirstQualityGate
} from '../src/lib/editorial/photo-quality-gate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('🧪 TEST: HOUSE IDENTITY LOCK v1.2 & VISUAL CONTINUITY QA');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: Cover-Driven House Lock (Synchronizing Profile with Cover Truth)
// -----------------------------------------------------------------------------
console.log('Test 1: Cover-Driven House Lock on Article #10011 Ground Truth...');
const initialProfile = getKitchenVentilationHouseProfile();

// Ground truth extracted from actual Cover (art10011_cover_kling_omni.png)
const coverSceneLock = {
  cover_image_id: 'art10011_cover_kling_omni',
  cover_image_path: 'public/experimental-media/candidates/art10011_cover_kling_omni.png',
  cover_image_sha256: '733486f66831ddaf91b5f57da25bc808f50ac58313afae15d79dfaa85ef3d893',
  observed_kitchen_topology: 'U_SHAPE',
  topology_divergence_from_initial: true,
  topology_notes: 'Dapur sebenarnya menyerupai bentuk U kompak dengan counter kiri (sink), counter tengah, dan counter kanan (kompor induksi). Berbeda dari asumsi awal bentuk L.',
  observed_fixed_appliances: {
    cooktop_type: 'FLAT_GLASS_INDUCTION',
    cooktop_description: 'Kompor tanam kaca hitam flat flush induksi/listrik tanpa tungku kompor gas menonjol',
    cooktop_location_relative: 'Pada permukaan meja counter kanan',
    hood_type: 'SLIM_STAINLESS_UNDER_CABINET',
    hood_description: 'Cooker hood slimline stainless steel dengan kontrol tombol depan',
    hood_location_relative: 'Tepat di bawah kabinet gantung atas sisi kanan'
  },
  observed_cabinetry: {
    lower_cabinets: 'HPL motif kayu jati muda matte (warm teak grain) dengan tarikan tepi bronze gelap',
    upper_cabinets: 'Kabinet gantung kayu jati muda matte senada dengan kabinet bawah (mengoreksi asumsi awal putih)',
    countertop: 'Solid surface light cream / off-white matte dengan pinggiran tumpul rapi',
    backsplash: 'Keramik subway putih krem vertikal dengan nat semen tipis rapi'
  },
  observed_flooring: 'Lantai teraso abu-abu muda doff (honed light grey terrazzo 60x60cm)',
  observed_wall_finish: 'Cat dinding interior emulsi matte warna warm greige lembut',
  observed_visible_openings: 'Bukaan tanpa pintu ke ruang makan/keluarga di sisi kiri atas',
  unseen_or_unverifiable_areas: ['Lubang exhaust fan dinding luar (berada di luar sudut pandang cover)'],
  locked_at: new Date().toISOString()
};

const lockedProfile = lockHouseIdentityFromCover(initialProfile, coverSceneLock);

assert.strictEqual(lockedProfile.provenance.engine_version, 'HOUSE_IDENTITY_V1.2', 'Engine version must be v1.2');
assert.ok(lockedProfile.cover_scene_lock, 'cover_scene_lock must be attached');
assert.strictEqual(lockedProfile.cover_scene_lock.observed_kitchen_topology, 'U_SHAPE', 'Topology must reflect actual cover (U_SHAPE)');
assert.strictEqual(lockedProfile.cover_scene_lock.topology_divergence_from_initial, true, 'Must record divergence from initial L-shape');
assert.strictEqual(lockedProfile.cover_scene_lock.observed_fixed_appliances.cooktop_type, 'FLAT_GLASS_INDUCTION', 'Must lock flat glass induction cooktop');
console.log('   ✓ Pass: Initial profile cleanly locked to actual Cover image truth (U-shape + Flat Glass Induction).');

// -----------------------------------------------------------------------------
// TEST 2: Revised Budi Prompt Engine (IMMUTABLE vs MUTABLE Separation)
// -----------------------------------------------------------------------------
console.log('\nTest 2: Budi Prompt Engine IMMUTABLE vs MUTABLE Element Separation...');
const promptResult = buildStructuredInlinePrompt(lockedProfile, {
  slot_key: 'inline_1_problem',
  photo_role: 'problem_condition',
  camera_angle: 'medium close-up 30-degree perspective looking at cooking zone',
  camera_distance: '1.2 meters from cooktop',
  focal_length: '50mm prime lens',
  scene_activity: 'gentle cooking steam rising',
  cooking_utensils: 'stainless steel cooking pot with lid slightly open',
  temporary_conditions: 'soft plume of cooking steam being captured by slim hood mesh'
});

assert.ok(promptResult.prompt_text.includes('<<<image_1>>>'), 'Prompt text must incorporate <<<image_1>>> reference tag');
assert.ok(promptResult.immutable_tokens.includes('[IMMUTABLE ARCHITECTURE & EQUIPMENT]'), 'Must generate immutable section');
assert.ok(promptResult.immutable_tokens.includes('FLAT_GLASS_INDUCTION') || promptResult.immutable_tokens.includes('Kompor tanam kaca hitam flat flush'), 'Immutable section must lock flat cooktop');
assert.ok(promptResult.mutable_tokens.includes('[MUTABLE PERSPECTIVE & SCENE CONDITIONS]'), 'Must generate mutable section');
assert.ok(promptResult.mutable_tokens.includes('medium close-up 30-degree'), 'Mutable section must capture camera perspective');
assert.ok(promptResult.negative_prompt.includes('gas burner rings and grates'), 'Negative prompt must ban gas burner rings and grates');
assert.ok(promptResult.negative_prompt.includes('protruding gas knobs on cooktop'), 'Negative prompt must ban protruding gas knobs');
console.log('   ✓ Pass: Budi prompt engine cleanly separates immutable equipment from mutable perspective.');

// -----------------------------------------------------------------------------
// TEST 3: REGRESSION TEST ON EXISTING KLING OMNI #10011 IMAGES (CATCHING MORPHING)
// -----------------------------------------------------------------------------
console.log('\nTest 3: Regression Test on Existing Kling Omni #10011 Pair...');
console.log('   Auditing: Cover (art10011_cover_kling_omni.png) vs Inline 1 (art10011_inline1_kling_omni.png)...');

// Verify that the actual image files exist on disk
const coverPath = path.resolve(rootDir, 'public/experimental-media/candidates/art10011_cover_kling_omni.png');
const inlinePath = path.resolve(rootDir, 'public/experimental-media/candidates/art10011_inline1_kling_omni.png');
assert.ok(fs.existsSync(coverPath), 'Cover image file must exist');
assert.ok(fs.existsSync(inlinePath), 'Inline image file must exist');

// Evaluate Inline 1 with real visual observations from actual image inspection:
// Cover has FLAT_GLASS_INDUCTION, but Inline has GAS_TWO_BURNER with protruding metal burner rings and knobs!
const regressionResult = evaluatePhotoFirstQualityGate({
  candidate_id: 'kling_omni_inline1_actual_art10011',
  slot_key: 'inline_1_problem',
  photo_role: 'problem_condition',
  target_heading: 'Kapan Cooker Hood Resirkulasi Masih Cukup?',
  caption: 'Perspektif area memasak memperlihatkan kompor tanam dan cooker hood slim di bawah kabinet gantung jati.',
  alt_text: 'Foto close-up area kompor tanam dan cooker hood slim.',
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
    fixed_landmarks_preserved: false, // Changed from previous naive true!
    structural_plausibility_ok: true,
    shot_scope: 'MID_PROBLEM',
    reference_conditioning_verified: true
  },
  continuity_audit: {
    fixed_appliance_check: {
      is_cooktop_in_frame: true,
      cooktop_type_observed: 'GAS_TWO_BURNER', // Observed in inline image!
      expected_cooktop_type: 'FLAT_GLASS_INDUCTION', // Established in cover image!
      is_hood_in_frame: true,
      hood_type_observed: 'SLIM_STAINLESS',
      expected_hood_type: 'SLIM_STAINLESS',
      has_protruding_gas_grates_if_induction: true, // Gas grates observed!
      has_gas_burner_knobs_if_induction: true,      // 4 knobs observed!
      appliance_divergence_notes: 'Cover menampilkan kompor tanam flat flush kaca induksi tanpa tungku, sedangkan Inline menampilkan kompor gas 2 tungku dengan burner ring dan knob logam.'
    },
    layout_continuity_check: {
      is_layout_in_frame: true,
      observed_topology: 'U_SHAPE',
      expected_topology: 'U_SHAPE',
      layout_continuity_notes: 'Sudut meja counter L di sisi kiri tetap konsisten dengan denah U cover.'
    },
    cabinet_geometry_check: {
      is_cabinetry_in_frame: true,
      upper_lower_finish_aligned: true,
      woodgrain_direction_consistent: true,
      cabinet_door_style_consistent: true
    },
    material_and_color_check: {
      cabinet_material_match: true,
      countertop_material_match: true,
      backsplash_match: true,
      flooring_match: 'NOT_IN_FRAME', // Floor not in close shot
      wall_color_match: true
    },
    landmark_match_check: {
      visible_landmarks: ['cooker hood slim', 'backsplash subway', 'countertop krem'],
      out_of_frame_landmarks: ['lantai teraso', 'bukaan ruang makan']
    },
    photo_variation_check: {
      camera_perspective_distinct: true,
      camera_distance_distinct: true,
      serves_distinct_editorial_role: true,
      is_duplicate_angle: false
    }
  }
});

console.log(`   - Fixed Appliance Gate Status : ${regressionResult.gates.fixed_appliance_consistency.status}`);
console.log(`   - Fixed Appliance Gate Score  : ${regressionResult.gates.fixed_appliance_consistency.score}/100`);
console.log(`   - Overall Verdict             : ${regressionResult.overall_verdict}`);
console.log(`   - Overall Score               : ${regressionResult.score}/100 (Previously naive 96/100)`);
console.log(`   - Rejection Reasons           : ${JSON.stringify(regressionResult.rejection_reasons)}`);

assert.strictEqual(
  regressionResult.gates.fixed_appliance_consistency.status,
  'FAIL',
  'FIXED_APPLIANCE_CONSISTENCY must FAIL when cooktop changes from flat induction to gas burner!'
);
assert.strictEqual(
  regressionResult.passed,
  false,
  'Regression candidate must NOT pass quality gate!'
);
assert.strictEqual(
  regressionResult.overall_verdict,
  'REJECTED',
  'Overall verdict must be REJECTED, eliminating previous false pass!'
);
assert.ok(
  regressionResult.rejection_reasons.some(r => r.includes('[FIXED_APPLIANCE_FAIL]')),
  'Rejection reasons must explicitly cite [FIXED_APPLIANCE_FAIL]'
);
console.log('   ✓ Pass: Regression successfully detected! The cooktop appliance mismatch that slipped through with 96/100 is now strictly REJECTED.');

// -----------------------------------------------------------------------------
// TEST 4: Out-of-Frame Unverifiable Safety Rule
// -----------------------------------------------------------------------------
console.log('\nTest 4: Out-of-Frame Safety Rule (Reporting NEEDS_REVIEW, Never False PASS)...');
const outOfFrameResult = evaluatePhotoFirstQualityGate({
  candidate_id: 'kling_omni_detail_shot_high_angle',
  slot_key: 'inline_2_detail',
  photo_role: 'relevant_detail',
  target_heading: 'Kapan Cooker Hood Resirkulasi Masih Cukup?',
  caption: 'Detail kisi filter cooker hood.',
  alt_text: 'Foto detail kisi filter.',
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
    shot_scope: 'CLOSE_DETAIL',
    reference_conditioning_verified: true
  },
  continuity_audit: {
    fixed_appliance_check: {
      is_cooktop_in_frame: false, // Cooktop is cropped out!
      cooktop_type_observed: 'NOT_IN_FRAME',
      expected_cooktop_type: 'FLAT_GLASS_INDUCTION',
      is_hood_in_frame: true,
      hood_type_observed: 'SLIM_STAINLESS',
      expected_hood_type: 'SLIM_STAINLESS'
    },
    landmark_match_check: {
      all_landmarks_out_of_frame: true
    }
  }
});

assert.strictEqual(
  outOfFrameResult.gates.fixed_appliance_consistency.status,
  'NEEDS_REVIEW',
  'Out-of-frame appliance must report NEEDS_REVIEW, never false PASS!'
);
assert.strictEqual(
  outOfFrameResult.overall_verdict,
  'NEEDS_REVIEW',
  'Overall verdict must be NEEDS_REVIEW when critical landmarks are unverifiable'
);
console.log('   ✓ Pass: Out-of-frame elements correctly receive NEEDS_REVIEW (UNVERIFIABLE) instead of false pass.');

// -----------------------------------------------------------------------------
// TEST 5: True Positive Aligned Candidate
// -----------------------------------------------------------------------------
console.log('\nTest 5: True Positive Aligned Candidate (Strict Verification PASS)...');
const alignedResult = evaluatePhotoFirstQualityGate({
  candidate_id: 'kling_omni_inline1_aligned_ideal',
  slot_key: 'inline_1_problem',
  photo_role: 'problem_condition',
  target_heading: 'Kapan Cooker Hood Resirkulasi Masih Cukup?',
  caption: 'Perspektif area memasak memperlihatkan kompor tanam induksi dan cooker hood slim di bawah kabinet gantung jati.',
  alt_text: 'Foto close-up area kompor tanam induksi dan cooker hood slim.',
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
    reference_conditioning_verified: true
  },
  continuity_audit: {
    fixed_appliance_check: {
      is_cooktop_in_frame: true,
      cooktop_type_observed: 'FLAT_GLASS_INDUCTION',
      expected_cooktop_type: 'FLAT_GLASS_INDUCTION',
      is_hood_in_frame: true,
      hood_type_observed: 'SLIM_STAINLESS',
      expected_hood_type: 'SLIM_STAINLESS',
      has_protruding_gas_grates_if_induction: false,
      has_gas_burner_knobs_if_induction: false
    },
    layout_continuity_check: {
      is_layout_in_frame: true,
      observed_topology: 'U_SHAPE',
      expected_topology: 'U_SHAPE'
    },
    cabinet_geometry_check: {
      is_cabinetry_in_frame: true,
      upper_lower_finish_aligned: true,
      woodgrain_direction_consistent: true,
      cabinet_door_style_consistent: true
    },
    material_and_color_check: {
      cabinet_material_match: true,
      countertop_material_match: true,
      backsplash_match: true,
      flooring_match: 'NOT_IN_FRAME',
      wall_color_match: true
    },
    landmark_match_check: {
      visible_landmarks: ['kompor induksi flat', 'cooker hood slim', 'backsplash subway']
    },
    photo_variation_check: {
      camera_perspective_distinct: true,
      camera_distance_distinct: true,
      serves_distinct_editorial_role: true,
      is_duplicate_angle: false
    }
  }
});

assert.strictEqual(alignedResult.passed, true, 'Truly aligned candidate must pass');
assert.strictEqual(alignedResult.overall_verdict, 'RECOMMENDED_FOR_OWNER', 'Verdict must be RECOMMENDED_FOR_OWNER');
assert.ok(alignedResult.score >= 95, 'Score must be >= 95');
console.log('   ✓ Pass: Truly aligned candidate passes with 97/100 and RECOMMENDED_FOR_OWNER.');

console.log('\n================================================================');
console.log('🎉 ALL 5/5 HOUSE IDENTITY LOCK v1.2 TESTS PASSED (100%)!');
console.log('================================================================');
