/**
 * RancangLoka — MEDIA-1: Controlled Production Smoke Verification
 * Target: https://rancangloka.com
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROD_BASE_URL = 'https://rancangloka.com';
const TOKEN_PATH = path.join(os.homedir(), '.rancangloka-secrets', 'lokamedia_prod_device_token.txt');

if (!fs.existsSync(TOKEN_PATH)) {
  console.error('❌ Token file not found at:', TOKEN_PATH);
  process.exit(1);
}

const DEVICE_TOKEN = fs.readFileSync(TOKEN_PATH, 'utf8').trim();

function createSmokeWebp(width, height) {
  const w = width - 1;
  const h = height - 1;
  const vp8xPayload = Buffer.alloc(10);
  vp8xPayload.writeUInt8(0, 0);
  vp8xPayload.writeUInt8(w & 0xff, 4);
  vp8xPayload.writeUInt8((w >> 8) & 0xff, 5);
  vp8xPayload.writeUInt8((w >> 16) & 0xff, 6);
  vp8xPayload.writeUInt8(h & 0xff, 7);
  vp8xPayload.writeUInt8((h >> 8) & 0xff, 8);
  vp8xPayload.writeUInt8((h >> 16) & 0xff, 9);

  const chunkSize = Buffer.alloc(4);
  chunkSize.writeUInt32LE(10, 0);

  const vp8xChunk = Buffer.concat([Buffer.from('VP8X'), chunkSize, vp8xPayload]);

  const riffHeader = Buffer.alloc(12);
  riffHeader.write('RIFF', 0);
  riffHeader.writeUInt32LE(4 + vp8xChunk.length, 4);
  riffHeader.write('WEBP', 8);

  return Buffer.concat([riffHeader, vp8xChunk]);
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runProductionSmoke() {
  console.log('====================================================');
  console.log('🚀 MEDIA-1 CONTROLLED PRODUCTION SMOKE');
  console.log(`Target: ${PROD_BASE_URL}`);
  console.log('====================================================\n');

  // Step 1: GET /api/internal/v1/media/jobs (List Pending Jobs)
  console.log('[Step 1: GET /api/internal/v1/media/jobs]');
  let targetJob = null;
  {
    const resp = await fetch(`${PROD_BASE_URL}/api/internal/v1/media/jobs?status=PENDING`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DEVICE_TOKEN}`,
        'X-RL-Device-Token': DEVICE_TOKEN,
        'X-RL-Scope': 'media:device'
      }
    });
    assert(resp.status === 200, `Production jobs endpoint returns 200 OK (got ${resp.status})`);
    const data = await resp.json();
    assert(data.status === 'success', 'Response status is success');
    assert(Array.isArray(data.jobs), 'Response contains jobs array');
    targetJob = data.jobs.find(j => j.job_id === 'mjob_prod_smoke_art3_featured');
    assert(!!targetJob, 'Found fixture job mjob_prod_smoke_art3_featured in production');
    if (targetJob) {
      assert(targetJob.article_id === 3, 'Target article_id is 3');
      assert(targetJob.role === 'featured', 'Target job role is featured');
      assert(targetJob.media_type === 'image', 'Target job media_type is image');
      assert(targetJob.status === 'PENDING', 'Target job initial status is PENDING');
    }
  }

  // Step 2: GET /api/internal/v1/media/jobs/[job_id]
  console.log('\n[Step 2: GET /api/internal/v1/media/jobs/[job_id]]');
  {
    const resp = await fetch(`${PROD_BASE_URL}/api/internal/v1/media/jobs/mjob_prod_smoke_art3_featured`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DEVICE_TOKEN}`,
        'X-RL-Device-Token': DEVICE_TOKEN,
        'X-RL-Scope': 'media:device'
      }
    });
    assert(resp.status === 200, `Single job returns 200 OK (got ${resp.status})`);
    const data = await resp.json();
    assert(data.status === 'success', 'Single job response status is success');
    assert(data.job.job_id === 'mjob_prod_smoke_art3_featured', 'Job ID matches');
    assert(data.job.prompt.includes('Indonesian modern architecture facade'), 'Prompt matches');
    assert(data.job.alt_text.includes('Fasad arsitektur modern tropis'), 'Alt text matches');
  }

  // Step 3: PATCH /api/internal/v1/media/jobs/[job_id] -> IN_PROGRESS
  console.log('\n[Step 3: Transition to IN_PROGRESS via PATCH]');
  {
    const resp = await fetch(`${PROD_BASE_URL}/api/internal/v1/media/jobs/mjob_prod_smoke_art3_featured`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${DEVICE_TOKEN}`,
        'X-RL-Device-Token': DEVICE_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
    assert(resp.status === 200, `PATCH returns 200 OK (got ${resp.status})`);
    const data = await resp.json();
    assert(data.job.status === 'IN_PROGRESS', 'Job transitioned to IN_PROGRESS in production D1');
  }

  // Step 4: POST /api/internal/v1/media/upload
  console.log('\n[Step 4: Upload Smoke Image to Production]');
  const smokeWebp = createSmokeWebp(1200, 675);
  let uploadedAssetId = null;
  let uploadedStorageKey = null;
  let uploadedSha256 = null;

  {
    const formData = new FormData();
    const blob = new Blob([smokeWebp], { type: 'image/webp' });
    formData.append('file', blob, 'smoke_tropical_facade.webp');
    formData.append('article_id', '3');
    formData.append('role', 'featured');
    formData.append('alt_text', 'Fasad arsitektur modern tropis dengan batu kapur alami dan kisi kayu');
    formData.append('job_id', 'mjob_prod_smoke_art3_featured');

    const resp = await fetch(`${PROD_BASE_URL}/api/internal/v1/media/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEVICE_TOKEN}`,
        'X-RL-Device-Token': DEVICE_TOKEN,
        'X-RL-Scope': 'media:write:draft'
      },
      body: formData
    });

    assert(resp.status === 200, `Upload returns 200 OK (got ${resp.status})`);
    const data = await resp.json();
    assert(data.status === 'success', 'Upload status is success');
    assert(data.deduplicated === false, 'First upload is not deduplicated (creates new asset)');
    assert(data.jobId === 'mjob_prod_smoke_art3_featured', 'Job ID returned in response');
    assert(data.jobStatus === 'ATTACHED', 'Job transitioned to ATTACHED');
    assert(data.editorialReadiness === 'READY_FOR_REVIEW', 'Editorial readiness is READY_FOR_REVIEW');
    uploadedAssetId = data.assetId;
    uploadedStorageKey = data.storageKey;
    uploadedSha256 = data.sha256;
    console.log(`    Asset ID: ${uploadedAssetId}`);
    console.log(`    Storage Key: ${uploadedStorageKey}`);
    console.log(`    SHA-256: ${uploadedSha256}`);
  }

  // Step 5: Double Send Idempotency Check
  console.log('\n[Step 5: Double Send Idempotency Check in Production]');
  {
    const formData = new FormData();
    const blob = new Blob([smokeWebp], { type: 'image/webp' });
    formData.append('file', blob, 'smoke_tropical_facade.webp');
    formData.append('article_id', '3');
    formData.append('role', 'featured');
    formData.append('alt_text', 'Fasad arsitektur modern tropis dengan batu kapur alami dan kisi kayu');
    formData.append('job_id', 'mjob_prod_smoke_art3_featured');

    const resp = await fetch(`${PROD_BASE_URL}/api/internal/v1/media/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEVICE_TOKEN}`,
        'X-RL-Device-Token': DEVICE_TOKEN,
        'X-RL-Scope': 'media:write:draft'
      },
      body: formData
    });

    assert(resp.status === 200, `Second upload returns 200 OK (got ${resp.status})`);
    const data = await resp.json();
    assert(data.status === 'success', 'Second upload status is success');
    assert(data.deduplicated === true, 'Second upload is deduplicated (zero duplicate R2 binary)');
    assert(data.assetId === uploadedAssetId, 'Reuses same asset ID');
  }

  // Step 6: Public Draft Guard Check (Article remains unpublished)
  console.log('\n[Step 6: Invariant Check: Public Draft Guard]');
  {
    const resp = await fetch(`${PROD_BASE_URL}/rancangloka-sender-runtime-smoke-test-2b3d-2-v2-2026-09-04`);
    assert(resp.status === 404, `Public slug returns 404 (draft is NOT publicly published, got ${resp.status})`);
  }

  // Save smoke artifacts info for cleanup step
  const smokeInfo = {
    jobId: 'mjob_prod_smoke_art3_featured',
    articleId: 3,
    assetId: uploadedAssetId,
    storageKey: uploadedStorageKey,
    sha256: uploadedSha256
  };
  fs.writeFileSync(
    path.join(os.homedir(), '.rancangloka-secrets', 'smoke_prod_meta.json'),
    JSON.stringify(smokeInfo, null, 2),
    'utf8'
  );

  console.log('\n====================================================');
  console.log(`Production Smoke Summary: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runProductionSmoke().catch((err) => {
  console.error('Fatal production smoke error:', err);
  process.exit(1);
});
