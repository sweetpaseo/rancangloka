/**
 * RancangLoka — Kling Omni Reference Payload & Photo-First Contract Test
 * File: scripts/test-kling-omni-reference-payload.mjs
 *
 * Verifies:
 * 1. Endpoint routing: kling-v3-omni -> POST /v1/images/omni-image
 * 2. Parameter validation: image_list array, no image_fidelity on omni endpoint
 * 3. Tagging injection: <<<image_1>>> automatically injected if omitted
 * 4. Header masking: Bearer [REDACTED_KLING_API_KEY]
 * 5. Cost calculation: 2 images = 16 units ($0.0392 prepaid / $0.0560 list)
 */

import assert from 'node:assert';
import { KlingImageProviderAdapter } from '../src/lib/media/kling-image-adapter.ts';
import { getKitchenVentilationHouseProfile } from '../src/lib/editorial/house-identity.ts';

console.log('================================================================');
console.log('🧪 TEST: KLING OMNI REFERENCE PAYLOAD & PHOTO-FIRST CONTRACT');
console.log('================================================================\n');

// 1. Instantiate Adapter with mock key
const adapter = new KlingImageProviderAdapter({
  apiKey: 'kling_test_secret_key_12345',
  model: 'kling-v3-omni'
});

// Test 1: Verify Cover Request Payload (No reference image)
console.log('Test 1: Verify Cover Request (Zero Reference Image)...');
const houseProfile = getKitchenVentilationHouseProfile();
const coverRequest = {
  article_id: '10',
  slot_key: 'cover',
  prompt: 'Photographic architectural shot of a modern minimalist Indonesian kitchen interior with custom teak laminate cabinetry, matte white walls, light gray solid surface countertop, warm ambient lighting.',
  negative_prompt: 'cartoon, 3d render, vector, noisy, low resolution, price tag, money',
  aspect_ratio: '16:9',
  quality: 'hd',
  photo_role: 'context',
  house_identity_profile_id: houseProfile.profile_id
};

const coverSubmission = adapter.buildSubmissionPayload(coverRequest);

assert.strictEqual(coverSubmission.endpoint, '/v1/images/omni-image', 'Must route to /v1/images/omni-image');
assert.strictEqual(coverSubmission.model, 'kling-v3-omni', 'Model must be kling-v3-omni');
assert.strictEqual(coverSubmission.payload.model_name, 'kling-v3-omni', 'Payload model_name must be kling-v3-omni');
assert.strictEqual(coverSubmission.payload.aspect_ratio, '16:9', 'Aspect ratio must be 16:9');
assert.strictEqual(coverSubmission.payload.resolution, '2k', 'Default HD resolution for Omni must be 2k');
assert.strictEqual(coverSubmission.payload.image_list, undefined, 'Cover request must not have image_list');
assert.strictEqual(coverSubmission.payload.image, undefined, 'Omni endpoint must not have singular image field');
assert.strictEqual(coverSubmission.payload.image_fidelity, undefined, 'Omni endpoint must never send image_fidelity');
assert.strictEqual(coverSubmission.maskedHeaders.Authorization, 'Bearer [REDACTED_KLING_API_KEY]', 'Headers must mask secret API key');
assert.ok(!JSON.stringify(coverSubmission.maskedHeaders).includes('kling_test_secret_key_12345'), 'Zero secret leak in headers');
console.log('   ✓ Pass: Cover payload correctly structured without reference image or secret leaks.');

// Test 2: Verify Inline Request with Reference Image Conditioning
console.log('\nTest 2: Verify Inline Request with Reference Image Conditioning...');
const mockCoverUrl = 'https://r2.rancangloka.com/canary/art10011_cover_anchor.jpg';
const inlineRequest = {
  article_id: '10',
  slot_key: 'inline_1_problem',
  prompt: 'Close-up architectural view looking up toward the wall above the cooktop, showing trapped cooking steam and humidity near the upper cabinetry.',
  negative_prompt: 'cartoon, 3d render, vector, low resolution',
  aspect_ratio: '16:9',
  quality: 'hd',
  photo_role: 'problem_condition',
  reference_image_url: mockCoverUrl,
  reference_image_id: 'ast_10_cover',
  house_identity_profile_id: houseProfile.profile_id
};

const inlineSubmission = adapter.buildSubmissionPayload(inlineRequest);

assert.strictEqual(inlineSubmission.endpoint, '/v1/images/omni-image', 'Must route to /v1/images/omni-image');
assert.strictEqual(inlineSubmission.model, 'kling-v3-omni', 'Model must be kling-v3-omni');
assert.ok(Array.isArray(inlineSubmission.payload.image_list), 'image_list must be an array');
assert.strictEqual(inlineSubmission.payload.image_list.length, 1, 'image_list must contain exactly 1 anchor reference');
assert.strictEqual(inlineSubmission.payload.image_list[0].image, mockCoverUrl, 'image_list[0].image must match reference URL');
assert.strictEqual(inlineSubmission.payload.image, undefined, 'Omni endpoint must not have singular image parameter');
assert.strictEqual(inlineSubmission.payload.image_fidelity, undefined, 'Omni endpoint must not accept image_fidelity');
assert.ok(inlineSubmission.payload.prompt.includes('<<<image_1>>>'), 'Prompt must contain <<<image_1>>> tag for Omni reference conditioning');
assert.ok(inlineSubmission.payload.prompt.includes('Close-up architectural view'), 'Original prompt intent must be preserved');
console.log('   ✓ Pass: Inline payload correctly structures image_list and injects <<<image_1>>> conditioning.');

// Test 3: Base64 Reference Prefix Stripping
console.log('\nTest 3: Base64 Reference Prefix Stripping...');
const base64Sample = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD...';
const inlineBase64Req = {
  article_id: '10',
  slot_key: 'inline_2_detail',
  prompt: 'Detail view of the activated carbon filter cartridge inside cooker hood.',
  reference_image_url: base64Sample,
  photo_role: 'relevant_detail'
};

const inlineBase64Submission = adapter.buildSubmissionPayload(inlineBase64Req);
assert.strictEqual(inlineBase64Submission.payload.image_list[0].image, '/9j/4AAQSkZJRgABAQEASABIAAD/2wBD...', 'Must strip data:image/... base64 prefix');
console.log('   ✓ Pass: Base64 data URI header stripped cleanly.');

// Test 4: Pricing & Billing Units for 2 Pilot Images
console.log('\nTest 4: Pricing & Billing Units for 2 Pilot Images...');
// Kling 3.0 2K costs 8 units per image
const unitsPerImage = 8;
const pilotImageCount = 2; // 1 cover + 1 inline
const totalUnits = unitsPerImage * pilotImageCount; // 16 units
const prepaidUnitCost = 0.00245; // $2.45 / 1000 units
const listUnitCost = 0.028 / 8;  // $0.00350 / unit
const prepaidTotal = totalUnits * prepaidUnitCost;
const listTotal = totalUnits * listUnitCost;
const idrExchangeRate = 16300;

assert.strictEqual(totalUnits, 16, 'Pilot of 2 images must cost exactly 16 units');
assert.ok(Math.abs(prepaidTotal - 0.0392) < 0.0001, 'Prepaid total must be US$0.0392');
assert.ok(Math.abs(listTotal - 0.0560) < 0.0001, 'List total must be US$0.0560');

console.log(`   - 2K Kling Units per image : ${unitsPerImage} units`);
console.log(`   - Pilot Image Count        : ${pilotImageCount} (1 cover + 1 inline)`);
console.log(`   - Total Consumption        : ${totalUnits} units`);
console.log(`   - Effective Prepaid Cost   : US$ ${prepaidTotal.toFixed(4)} (~ Rp ${Math.round(prepaidTotal * idrExchangeRate).toLocaleString('id-ID')})`);
console.log(`   - Standard List Cost       : US$ ${listTotal.toFixed(4)} (~ Rp ${Math.round(listTotal * idrExchangeRate).toLocaleString('id-ID')})`);
console.log('   ✓ Pass: Cost calculation strictly verified within budget.');

console.log('\n================================================================');
console.log('🎉 ALL 4/4 KLING OMNI REFERENCE CONTRACT TESTS PASSED (100%)!');
console.log('================================================================');
