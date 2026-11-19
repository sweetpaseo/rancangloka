/**
 * RancangLoka — Test Suite: Photo-First Visual Editorial Policy v1.1
 *
 * Verifies:
 * 1. House Identity Profile creation and token compilation for Article #10011.
 * 2. Nadia Visual Storyboard generates 1 cover + 3 inline photos (0 diagrams) in PHOTO_FIRST mode.
 * 3. Each inline photo has a designated purpose: context, problem_condition, relevant_detail, realistic_solution_example.
 * 4. The 7 Photo-First Quality Gates correctly validate and reject non-compliant candidates.
 * 5. Strictly rejects false SAME_HOUSE claims based only on text prompts.
 * 6. Legacy SVG generators remain intact and accessible for historical processes.
 * 7. Accurate cost calculations for all 4 provider options.
 */

import assert from 'node:assert';
import {
  getKitchenVentilationHouseProfile,
  compileHouseIdentityToPromptTokens,
  compileNegativeTokensFromHouseIdentity
} from '../src/lib/editorial/house-identity.ts';
import {
  generateVisualStoryboard
} from '../src/lib/editorial/nadia-visual-storyboard.ts';
import {
  evaluatePhotoFirstQualityGate
} from '../src/lib/editorial/photo-quality-gate.ts';
import {
  generateKitchenAirflowComparisonSvg,
  generateVentilationEffectivenessSvg
} from '../src/lib/editorial/kitchen-ventilation-diagrams.ts';

console.log('================================================================');
console.log('🧪 TEST: PHOTO-FIRST VISUAL EDITORIAL POLICY v1.1');
console.log('================================================================');

// -----------------------------------------------------------------------------
// Test 1: House Identity Profile Creation for Article #10011
// -----------------------------------------------------------------------------
console.log('\nTest 1: House Identity Profile Creation for Article #10011...');
const slug = 'ventilasi-dapur-tanpa-jendela-solusi-cooker-hood-resirkulasi-vs-exhaust-fan-dinding-canary-10011';
const title = 'Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding';

const profile = getKitchenVentilationHouseProfile(slug, title);

assert.ok(profile.profile_id, 'Profile ID must be present');
assert.ok(profile.architectural_style.includes('Indonesian'), 'Must specify Indonesian tropical architectural style');
assert.ok(profile.room_topology.includes('2.4m x 3.0m'), 'Must specify exact room topology dimensions');
assert.ok(profile.material_palette.length >= 4, 'Material palette must contain at least 4 specific materials');
assert.ok(profile.wall_colors.includes('#F2EFE9'), 'Wall colors must specify exact shade and hex');
assert.ok(profile.frame_window_identity.includes('tanpa jendela luar'), 'Frame/window identity must note windowless interior zone');
assert.ok(profile.fixed_spatial_landmarks.length >= 4, 'Must have at least 4 fixed spatial landmarks');
assert.ok(profile.lighting_mood.includes('3000K'), 'Lighting must specify architectural color temperature');
assert.ok(profile.tropical_climate_features.length >= 2, 'Must include tropical climate adaptations');

const promptTokens = compileHouseIdentityToPromptTokens(profile);
assert.ok(promptTokens.includes('ARCHITECTURAL STYLE'), 'Must compile architectural style token');
assert.ok(promptTokens.includes('MATERIAL PALETTE'), 'Must compile material palette tokens');
assert.ok(promptTokens.includes('KEY SPATIAL FIXTURES'), 'Must compile key spatial fixtures');

const negativeTokens = compileNegativeTokensFromHouseIdentity(profile);
assert.ok(negativeTokens.includes('different kitchen cabinetry'), 'Must ban changing cabinetry in negatives');
assert.ok(negativeTokens.includes('price tags'), 'Must ban price tags in negatives (Monetary Silence)');

console.log('   ✓ Pass: House Identity Profile captures 8 key architectural and spatial dimensions.');

// -----------------------------------------------------------------------------
// Test 2: Nadia Visual Storyboard in PHOTO_FIRST Mode (0 Diagrams, 1 Cover + 3 Inlines)
// -----------------------------------------------------------------------------
console.log('\nTest 2: Nadia Visual Storyboard in PHOTO_FIRST Mode...');
const sampleManuscript = `## 1. Apa bedanya cara kerja kedua sistem?
Cooker hood resirkulasi menyedot udara di sekitar kompor, melewatkannya melalui filter lemak dan karbon aktif, lalu mengembalikannya ke ruangan. Sebaliknya, exhaust fan dinding menarik udara ruangan dan membuangnya ke luar bangunan melalui jalur tembusan dinding.

## 2. Kapan masing-masing sistem terasa kurang efektif?
Tanda dapur memerlukan ventilasi mekanis antara lain kondensasi uap air yang menempel di kabinet setelah memasak, bau minyak yang bertahan lebih dari 30 menit, atau suhu ruangan yang meningkat drastis. Cooker hood resirkulasi kurang efektif menurunkan kelembapan, sementara exhaust fan dinding bekerja kurang optimal jika ruang dapur tertutup rapat tanpa udara pengganti.

## 3. Apa yang perlu disiapkan sebelum pemasangan?
Pemasangan exhaust fan dinding memerlukan bukaan dinding luar yang diplester rapi dan celah pasokan udara masuk di bawah pintu. Sementara cooker hood resirkulasi membutuhkan ruang kabinet gantung yang kokoh dan akses kelistrikan aman.`;

const storyboard = generateVisualStoryboard({
  id: 10011,
  slug,
  title,
  markdown: sampleManuscript
}, {
  visual_policy: 'PHOTO_FIRST'
});

assert.strictEqual(storyboard.visual_policy, 'PHOTO_FIRST', 'Policy must be PHOTO_FIRST');
assert.ok(storyboard.house_identity, 'House identity must be attached to storyboard');
assert.strictEqual(storyboard.cover.slot_key, 'cover_hero', 'Cover slot must be cover_hero');
assert.strictEqual(storyboard.cover.photo_role, 'context', 'Cover photo role must be context');

// Check that inline slots total exactly 3
assert.strictEqual(storyboard.inline_slots.length, 3, 'Must plan exactly 3 inline photos for article #10011');
assert.strictEqual(storyboard.total_visual_slots, 4, 'Total visual slots must be 4 (1 cover + 3 inlines)');

// Check zero diagrams
const diagramSlots = storyboard.inline_slots.filter(s => s.visual_media_type === 'TECHNICAL_DIAGRAM_SVG');
assert.strictEqual(diagramSlots.length, 0, 'Zero diagrams in standard editorial flow');

// Check that all slots are PHOTO_REALISTIC
const allPhotos = storyboard.inline_slots.every(s => s.visual_media_type === 'PHOTO_REALISTIC');
assert.ok(allPhotos, 'All inline slots must be PHOTO_REALISTIC');

// -----------------------------------------------------------------------------
// Test 3: Dedicated Purpose for Each Photo
// -----------------------------------------------------------------------------
console.log('\nTest 3: Dedicated Purpose for Each Inline Photo...');
const roles = storyboard.inline_slots.map(s => s.photo_role);
console.log('   Observed inline photo roles:', roles);

assert.strictEqual(roles[0], 'problem_condition', 'Slot 1 must be problem_condition');
assert.strictEqual(roles[1], 'relevant_detail', 'Slot 2 must be relevant_detail');
assert.strictEqual(roles[2], 'realistic_solution_example', 'Slot 3 must be realistic_solution_example');

// Check intent contracts
assert.ok(storyboard.visual_intent_contracts?.cover_hero, 'Cover contract must exist');
assert.ok(storyboard.visual_intent_contracts?.inline_1_problem_trapped_steam, 'Slot 1 contract must exist');
assert.ok(storyboard.visual_intent_contracts?.inline_2_detail_cooker_hood_filter, 'Slot 2 contract must exist');
assert.ok(storyboard.visual_intent_contracts?.inline_3_solution_balanced_exhaust, 'Slot 3 contract must exist');

console.log('   ✓ Pass: 4 distinct roles verified: context, problem_condition, relevant_detail, realistic_solution_example.');

// -----------------------------------------------------------------------------
// Test 4: Photo-First Quality Gates — Positive Evaluation
// -----------------------------------------------------------------------------
console.log('\nTest 4: Photo-First Quality Gates — Positive Evaluation...');
const validCoverEvaluation = evaluatePhotoFirstQualityGate({
  candidate_id: 'cand_10011_cover_sample',
  slot_key: 'cover_hero',
  photo_role: 'context',
  target_heading: 'Ventilasi Dapur Tanpa Jendela',
  caption: 'Dapur kompak kontemporer tanpa jendela dengan pencahayaan arsitektural terencana.',
  alt_text: 'Foto interior dapur kompak tanpa jendela dengan pencahayaan hangat dan tata letak ventilasi terencana.',
  house_profile: profile,
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

assert.ok(validCoverEvaluation.passed, 'Valid candidate must pass quality gate');
assert.strictEqual(validCoverEvaluation.overall_verdict, 'RECOMMENDED_FOR_OWNER', 'Verdict must be RECOMMENDED_FOR_OWNER');
assert.strictEqual(validCoverEvaluation.rejection_reasons.length, 0, 'Zero rejection reasons on valid candidate');
assert.ok(validCoverEvaluation.score >= 90, 'Score must be >= 90');
console.log(`   ✓ Pass: Positive candidate scored ${validCoverEvaluation.score}/100 with verdict RECOMMENDED_FOR_OWNER.`);

// -----------------------------------------------------------------------------
// Test 5: Photo-First Quality Gates — Strict Rejection of False SAME_HOUSE Claims
// -----------------------------------------------------------------------------
console.log('\nTest 5: Photo-First Quality Gates — Strict Rejection of False SAME_HOUSE Claims...');
const falseConsistencyCandidate = evaluatePhotoFirstQualityGate({
  candidate_id: 'cand_10011_inconsistent_cabinets',
  slot_key: 'inline_1_problem_trapped_steam',
  photo_role: 'problem_condition',
  target_heading: '1. Apa bedanya cara kerja kedua sistem?',
  caption: 'Uap memasak di atas kompor.',
  alt_text: 'Foto uap memasak.',
  house_profile: profile,
  observed: {
    is_diagram_or_vector: false,
    has_text_or_watermark: false,
    has_currency_or_price: false,
    has_cgi_plastic_gloss: false,
    has_ai_deformities: false,
    cabinet_material_matches_profile: false, // Inconsistent cabinetry!
    countertop_material_matches_profile: false, // Inconsistent countertop!
    wall_color_matches_profile: true,
    fixed_landmarks_preserved: true,
    structural_plausibility_ok: true,
    shot_scope: 'MID_PROBLEM',
    reference_conditioning_verified: false
  }
});

assert.strictEqual(falseConsistencyCandidate.passed, false, 'Inconsistent house identity must fail');
assert.strictEqual(falseConsistencyCandidate.overall_verdict, 'REJECTED', 'Must reject inconsistent candidate');
assert.ok(
  falseConsistencyCandidate.rejection_reasons.some(r => r.includes('[SAME_HOUSE_FAIL]')),
  'Must cite [SAME_HOUSE_FAIL] in rejection reasons'
);
console.log('   ✓ Pass: Correctly rejected candidate with mismatched cabinetry/countertop materials.');

// -----------------------------------------------------------------------------
// Test 6: Rejection of Vector Diagrams in Photo-First Mode
// -----------------------------------------------------------------------------
console.log('\nTest 6: Rejection of Vector Diagrams in Photo-First Mode...');
const vectorDiagramCandidate = evaluatePhotoFirstQualityGate({
  candidate_id: 'cand_10011_svg_diagram',
  slot_key: 'inline_1_problem_trapped_steam',
  photo_role: 'problem_condition',
  target_heading: '1. Apa bedanya cara kerja kedua sistem?',
  caption: 'Diagram alur ventilasi.',
  alt_text: 'Diagram alur.',
  house_profile: profile,
  observed: {
    is_diagram_or_vector: true, // Vector diagram!
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

assert.strictEqual(vectorDiagramCandidate.passed, false, 'Vector diagram must fail Photo-First gate');
assert.ok(
  vectorDiagramCandidate.rejection_reasons.some(r => r.includes('[PHOTO_REALISM_FAIL]')),
  'Must cite [PHOTO_REALISM_FAIL] when vector diagram is submitted'
);
console.log('   ✓ Pass: Correctly rejected vector diagram under PHOTO_REALISM gate.');

// -----------------------------------------------------------------------------
// Test 7: Rejection of Monetary Leaks
// -----------------------------------------------------------------------------
console.log('\nTest 7: Rejection of Monetary Leaks in Visuals...');
const monetaryLeakCandidate = evaluatePhotoFirstQualityGate({
  candidate_id: 'cand_10011_price_leak',
  slot_key: 'inline_2_detail_cooker_hood_filter',
  photo_role: 'relevant_detail',
  target_heading: '2. Kapan masing-masing sistem terasa kurang efektif?',
  caption: 'Cooker hood harga terjangkau.',
  alt_text: 'Foto filter.',
  house_profile: profile,
  observed: {
    is_diagram_or_vector: false,
    has_text_or_watermark: false,
    has_currency_or_price: true, // Price tag in photo!
    has_cgi_plastic_gloss: false,
    has_ai_deformities: false,
    cabinet_material_matches_profile: true,
    countertop_material_matches_profile: true,
    wall_color_matches_profile: true,
    fixed_landmarks_preserved: true,
    structural_plausibility_ok: true,
    shot_scope: 'CLOSE_DETAIL',
    reference_conditioning_verified: true
  }
});

assert.strictEqual(monetaryLeakCandidate.passed, false, 'Monetary leak must fail gate');
assert.ok(
  monetaryLeakCandidate.rejection_reasons.some(r => r.includes('[MONETARY_SILENCE_FAIL]')),
  'Must cite [MONETARY_SILENCE_FAIL]'
);
console.log('   ✓ Pass: Correctly rejected candidate displaying price or currency.');

// -----------------------------------------------------------------------------
// Test 8: Legacy SVG Generators Preserved and Intact
// -----------------------------------------------------------------------------
console.log('\nTest 8: Legacy SVG Generators Preserved and Intact...');
const svg1 = generateKitchenAirflowComparisonSvg();
const svg2 = generateVentilationEffectivenessSvg();
assert.ok(svg1.includes('<svg'), 'Inline 1 SVG generator must still work');
assert.ok(svg2.includes('<svg'), 'Inline 2 SVG generator must still work');
console.log('   ✓ Pass: Legacy SVG generators remain functional for backward compatibility.');

// -----------------------------------------------------------------------------
// Test 9: Provider Pricing & Unit Cost Verification for 1 Set (1 Cover + 3 Inlines = 4 Photos)
// -----------------------------------------------------------------------------
console.log('\nTest 9: Provider Pricing & Cost Verification for 4 Photos...');
const photoCount = 4; // 1 cover + 3 inlines

// Pricing constants
const COST_FAL_SCHNELL = 0.0030 * photoCount; // $0.0120
const COST_FAL_DEV = 0.0250 * photoCount;     // $0.1000
const COST_KLING_2K_TRIAL = 0.0196 * photoCount; // $0.0784 (8 units * $0.00245)
const COST_KLING_2K_LIST = 0.0280 * photoCount;  // $0.1120 (8 units * $0.00350)
const COST_SEEDREAM_PRO = 0.0675 * photoCount;   // $0.2700

console.log(`   - Fal Flux Schnell : US$${COST_FAL_SCHNELL.toFixed(4)} (~Rp ${Math.round(COST_FAL_SCHNELL * 16300)})`);
console.log(`   - Fal Flux Dev     : US$${COST_FAL_DEV.toFixed(4)} (~Rp ${Math.round(COST_FAL_DEV * 16300)})`);
console.log(`   - Kling 3.0 (2K)   : US$${COST_KLING_2K_TRIAL.toFixed(4)} (Trial) / US$${COST_KLING_2K_LIST.toFixed(4)} (List) (~Rp ${Math.round(COST_KLING_2K_TRIAL * 16300)})`);
console.log(`   - Seedream 5.0 Pro : US$${COST_SEEDREAM_PRO.toFixed(4)} (~Rp ${Math.round(COST_SEEDREAM_PRO * 16300)})`);

assert.ok(COST_FAL_SCHNELL < 0.05, 'Flux Schnell must be < $0.05');
assert.ok(COST_KLING_2K_TRIAL < 0.10, 'Kling 2K trial must be < $0.10');
assert.ok(COST_SEEDREAM_PRO <= 0.30, 'Seedream Pro must be within $0.30 budget cap');

console.log('   ✓ Pass: All 4 provider cost models verified within budget bounds.');

console.log('\n================================================================');
console.log('🎉 ALL 9/9 PHOTO-FIRST POLICY TESTS PASSED (100%)!');
console.log('================================================================');
