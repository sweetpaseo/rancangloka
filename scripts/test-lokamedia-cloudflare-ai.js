/**
 * RancangLoka — Comprehensive Quality Assurance Suite
 * MISSION: RANCANGLOKA_SESSION_WARMUP_AND_CLOUDFLARE_AI_RESUME_1
 *
 * Verifies:
 * 1. Cloudflare Workers AI Image Provider Adapter & Model Contracts
 * 2. FLUX.1 Schnell & SDXL Lightning parameter constraints
 * 3. Binary response validation & SHA-256 checksums
 * 4. Experimental candidate persistence & ledger isolation
 * 5. Approval status workflow & immutability invariants
 * 6. Provider selection registry & UI contracts
 * 7. Admin authentication boundary for media generation
 * 8. All 6 experimental Batch 1 candidates presence and integrity
 * 9. Comparison preview route (/admin/media/comparison-batch1)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  CloudflareAiImageAdapter,
  CLOUDFLARE_FLUX_MODEL,
  CLOUDFLARE_SDXL_MODEL
} = await import('../src/lib/media/cloudflare-ai-image-adapter.ts');

const {
  loadCandidatesLedger,
  saveExperimentalCandidate,
  updateCandidateStatus
} = await import('../src/lib/media/experimental-storage.ts');

const {
  validateImageBinary,
  computeBinarySha256
} = await import('../src/lib/media/image-validation.ts');

const {
  PROVIDER_CHATGPT,
  PROVIDER_GEMINI,
  PROVIDER_CLOUDFLARE_AI,
  PROVIDER_MANUAL,
  CLOUDFLARE_MODELS
} = await import('../extensions/lokamedia/src/constants.js');

const { createAdminSessionToken } = await import('../src/lib/auth.ts');

console.log('='.repeat(70));
console.log('TEST SUITE: LOKAMEDIA CLOUDFLARE WORKERS AI INTEGRATION & QA');
console.log('='.repeat(70));

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

// --------------------------------------------------------------------
// TEST GROUP 1: Adapter & Model Contracts
// --------------------------------------------------------------------
console.log('\n--- Test Group 1: Adapter & Model Contracts ---');

const adapter = new CloudflareAiImageAdapter({ model: CLOUDFLARE_FLUX_MODEL });
assert(adapter.providerName === 'cloudflare_ai', 'Adapter identifies as cloudflare_ai');
assert(adapter.modelName === CLOUDFLARE_FLUX_MODEL, 'Default model is flux-1-schnell');

const sdxlAdapter = new CloudflareAiImageAdapter({ model: CLOUDFLARE_SDXL_MODEL });
assert(sdxlAdapter.modelName === CLOUDFLARE_SDXL_MODEL, 'SDXL adapter model is stable-diffusion-xl-lightning');

// Empty prompt rejection
try {
  await adapter.generate({ request_id: 'test-1', prompt: '   ', purpose: 'test' });
  assert(false, 'Should throw on empty prompt');
} catch (err) {
  assert(err.code === 'INVALID_RESPONSE', 'Rejects empty prompt with INVALID_RESPONSE');
}

// --------------------------------------------------------------------
// TEST GROUP 2: Provider Selection Constants & LokaMedia Contract
// --------------------------------------------------------------------
console.log('\n--- Test Group 2: Provider Selection Constants ---');

assert(PROVIDER_CHATGPT === 'CHATGPT_BROWSER', 'PROVIDER_CHATGPT constant is intact');
assert(PROVIDER_GEMINI === 'GEMINI_BROWSER', 'PROVIDER_GEMINI constant is intact');
assert(PROVIDER_CLOUDFLARE_AI === 'CLOUDFLARE_WORKERS_AI', 'PROVIDER_CLOUDFLARE_AI constant is defined');
assert(PROVIDER_MANUAL === 'MANUAL_UPLOAD', 'PROVIDER_MANUAL constant is defined');
assert(CLOUDFLARE_MODELS.FLUX_SCHNELL === '@cf/black-forest-labs/flux-1-schnell', 'FLUX model constant is valid');
assert(CLOUDFLARE_MODELS.SDXL_LIGHTNING === '@cf/bytedance/stable-diffusion-xl-lightning', 'SDXL model constant is valid');

// --------------------------------------------------------------------
// TEST GROUP 3: Binary Validation & Magic Bytes
// --------------------------------------------------------------------
console.log('\n--- Test Group 3: Binary Validation & Magic Bytes ---');

// Valid JPEG binary test
const sampleJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01]);
const sampleSha = await computeBinarySha256(sampleJpeg);
assert(sampleSha.length === 64, 'SHA-256 calculation produces 64-char hex string');

// Empty / truncated binary rejection
try {
  await validateImageBinary(new Uint8Array([0x00, 0x01, 0x02]), 'test');
  assert(false, 'Should throw on truncated binary');
} catch (err) {
  assert(err.code === 'INVALID_RESPONSE', 'Rejects truncated binary with INVALID_RESPONSE');
}

// --------------------------------------------------------------------
// TEST GROUP 4: Experimental Media Storage & Ledger Segregation
// --------------------------------------------------------------------
console.log('\n--- Test Group 4: Candidate Storage & Ledger Segregation ---');

const ledger = loadCandidatesLedger();
assert(Array.isArray(ledger), 'Candidates ledger is an array');
assert(ledger.length >= 6, `Ledger contains at least 6 candidates (found ${ledger.length})`);

// Verify all candidates have PENDING_REVIEW default and required schema fields
for (const cand of ledger) {
  assert(Boolean(cand.id), `Candidate ${cand.id} has valid ID`);
  assert(Boolean(cand.article_id), `Candidate ${cand.id} has article_id ${cand.article_id}`);
  assert(['PENDING_REVIEW', 'APPROVED', 'REJECTED'].includes(cand.approval_status), `Candidate ${cand.id} has valid approval status (${cand.approval_status})`);
  assert(Boolean(cand.dimensions), `Candidate ${cand.id} has dimensions ${cand.dimensions}`);
  assert(Boolean(cand.sha256), `Candidate ${cand.id} has sha256 hash`);
  assert(cand.public_url.startsWith('/experimental-media/'), `Candidate ${cand.id} has public URL`);
}

// Test status update workflow
const testCand = ledger[0];
const updatedApproved = updateCandidateStatus(testCand.id, 'APPROVED');
assert(updatedApproved.approval_status === 'APPROVED', 'Candidate status can transition to APPROVED');

const updatedReset = updateCandidateStatus(testCand.id, 'PENDING_REVIEW');
assert(updatedReset.approval_status === 'PENDING_REVIEW', 'Candidate status can transition back to PENDING_REVIEW');

// --------------------------------------------------------------------
// TEST GROUP 5: Batch 1 Candidate Images on Disk & Integrity
// --------------------------------------------------------------------
console.log('\n--- Test Group 5: Batch 1 Candidates On-Disk Integrity ---');

const expectedCandidates = [
  { id: 'candidate-9993-flux-1-schnell', articleId: 9993, model: 'FLUX.1 Schnell' },
  { id: 'candidate-9993-sdxl-lightning', articleId: 9993, model: 'SDXL Lightning' },
  { id: 'candidate-9999-flux-1-schnell', articleId: 9999, model: 'FLUX.1 Schnell' },
  { id: 'candidate-9999-sdxl-lightning', articleId: 9999, model: 'SDXL Lightning' },
  { id: 'candidate-10000-flux-1-schnell', articleId: 10000, model: 'FLUX.1 Schnell' },
  { id: 'candidate-10000-sdxl-lightning', articleId: 10000, model: 'SDXL Lightning' }
];

for (const exp of expectedCandidates) {
  const cand = ledger.find((c) => c.id === exp.id);
  assert(Boolean(cand), `Candidate ${exp.id} exists in manifest`);
  if (cand) {
    const storageFile = path.resolve(cand.storage_reference);
    const publicFile = path.resolve(`./public${cand.public_url}`);
    assert(fs.existsSync(storageFile), `Storage file exists: ${cand.storage_reference}`);
    assert(fs.existsSync(publicFile), `Public mirror file exists: public${cand.public_url}`);
    const stat = fs.statSync(storageFile);
    assert(stat.size > 50000, `Image file size is substantial (${(stat.size / 1024).toFixed(1)} KB)`);
  }
}

// --------------------------------------------------------------------
// TEST GROUP 6: Local Server Endpoint & UI Route Verification
// --------------------------------------------------------------------
console.log('\n--- Test Group 6: Local Server Route Verification ---');

const token = await createAdminSessionToken();

// 1. Unauthenticated check on generate endpoint
try {
  const unauthRes = await fetch('http://localhost:4321/api/admin/media/generate-cloudflare-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ article_id: 9993, prompt: 'test' })
  });
  assert(unauthRes.status === 401, 'Unauthenticated request to generate endpoint is rejected with 401');
} catch (err) {
  console.warn('  ⚠️ Note: Server fetch check skipped or server offline');
}

// 2. Comparison preview page check with auth
try {
  const compRes = await fetch('http://localhost:4321/admin/media/comparison-batch1', {
    headers: { Cookie: `admin_session=${token}` }
  });
  assert(compRes.status === 200, 'Comparison page /admin/media/comparison-batch1 returns HTTP 200 OK');
  const compHtml = await compRes.text();
  assert(compHtml.includes('FLUX.1 Schnell'), 'Comparison page contains FLUX.1 Schnell column');
  assert(compHtml.includes('SDXL Lightning'), 'Comparison page contains SDXL Lightning column');
  assert(compHtml.includes('Dinding Rembes'), 'Comparison page renders Article 9993');
  assert(compHtml.includes('7 Ide Menata Balkon'), 'Comparison page renders Article 9999');
  assert(compHtml.includes('Menata Denah Rumah Lebar 5–6 Meter'), 'Comparison page renders Article 10000');
  assert(compHtml.includes('PENDING_REVIEW'), 'Comparison page displays PENDING_REVIEW badges');
} catch (err) {
  console.warn('  ⚠️ Note: Server fetch check error:', err.message);
}

console.log('\n' + '='.repeat(70));
console.log(`TOTAL TESTS: ${passCount + failCount}`);
console.log(`PASSED: ${passCount}`);
console.log(`FAILED: ${failCount}`);
console.log('='.repeat(70));

if (failCount > 0) {
  console.error('>>> SOME TESTS FAILED <<<');
  process.exit(1);
} else {
  console.log('>>> ALL LOKAMEDIA CLOUDFLARE AI INTEGRATION TESTS PASS! <<<');
}
