/**
 * RancangLoka — MEDIA-1: LokaMedia Local Live Smoke Verification
 * Tests against the live running local runtime at http://127.0.0.1:4321
 */

import zlib from 'node:zlib';

const BASE_URL = 'http://127.0.0.1:4321';
const DEVICE_TOKEN = 'staging-media-token';

function createTestPng(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);

  function crc32(buf) {
    let c = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ [
        0, 0x77073096, 0xee0e612c, 0x990951ba, 0x076dc419, 0x706af48f, 0xe963a535, 0x9e6495a3
      ][(c ^ buf[i]) & 7];
    }
    return (c ^ (-1)) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const toCrc = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(toCrc), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const scanlines = Buffer.alloc(height * (1 + width * 4), 0);
  const compressed = zlib.deflateSync(scanlines);

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
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

async function runLiveSmoke() {
  console.log('====================================================');
  console.log('🌐 MEDIA-1 LOCAL RUNTIME SMOKE VERIFICATION');
  console.log(`Target: ${BASE_URL}`);
  console.log('====================================================\n');

  // Step 1: CORS Preflight (OPTIONS)
  console.log('[Step 1: CORS Preflight]');
  {
    const resp = await fetch(`${BASE_URL}/api/internal/v1/media/upload`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'chrome-extension://dummy-extension-id',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization, X-RL-Device-Token, X-RL-Scope'
      }
    });
    assert(resp.status === 204, `OPTIONS returns 204 No Content (got ${resp.status})`);
    assert(resp.headers.get('Access-Control-Allow-Origin') === '*', 'CORS Allow-Origin header is present');
    assert(resp.headers.get('Access-Control-Allow-Methods')?.includes('POST'), 'CORS Allow-Methods contains POST');
  }

  // Step 2: GET /api/internal/v1/media/jobs (List Pending Jobs)
  console.log('\n[Step 2: GET /api/internal/v1/media/jobs?status=PENDING]');
  let targetJob = null;
  {
    const resp = await fetch(`${BASE_URL}/api/internal/v1/media/jobs?status=PENDING`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DEVICE_TOKEN}`,
        'X-RL-Device-Token': DEVICE_TOKEN,
        'X-RL-Scope': 'media:device'
      }
    });
    assert(resp.status === 200, `Jobs list returns 200 OK (got ${resp.status})`);
    const data = await resp.json();
    assert(data.status === 'success', 'Response status is success');
    assert(Array.isArray(data.jobs), 'Response contains jobs array');
    targetJob = data.jobs.find(j => j.job_id === 'mjob_smoke_local_888_featured');
    assert(!!targetJob, 'Found fixture job mjob_smoke_local_888_featured');
    if (targetJob) {
      assert(targetJob.article_id === 888, 'Target article_id is 888');
      assert(targetJob.role === 'featured', 'Target job role is featured');
      assert(targetJob.media_type === 'image', 'Target job media_type is image');
      assert(targetJob.status === 'PENDING', 'Target job initial status is PENDING');
    }
  }

  // Step 3: GET /api/internal/v1/media/jobs/[job_id]
  console.log('\n[Step 3: GET /api/internal/v1/media/jobs/[job_id]]');
  {
    const resp = await fetch(`${BASE_URL}/api/internal/v1/media/jobs/mjob_smoke_local_888_featured`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DEVICE_TOKEN}`,
        'X-RL-Device-Token': DEVICE_TOKEN,
        'X-RL-Scope': 'media:device'
      }
    });
    assert(resp.status === 200, `Single job returns 200 OK (got ${resp.status})`);
    const data = await resp.json();
    assert(data.status === 'success', 'Response status is success');
    assert(data.job.job_id === 'mjob_smoke_local_888_featured', 'Job ID matches');
    assert(data.job.prompt.includes('Modern Indonesian tropical house'), 'Prompt text retrieved correctly');
    assert(data.job.alt_text.includes('Atap metal pasir'), 'Alt text retrieved correctly');
  }

  // Step 4: Device Auth Enforcement (Scope Security)
  console.log('\n[Step 4: Device Auth & Scope Guardrails]');
  {
    // Forbidden scope 'publish'
    const forbiddenResp = await fetch(`${BASE_URL}/api/internal/v1/media/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEVICE_TOKEN}`,
        'X-RL-Scope': 'publish'
      }
    });
    assert(forbiddenResp.status === 403, `Forbidden scope 'publish' rejected with 403 (got ${forbiddenResp.status})`);

    // Invalid device token
    const invalidAuthResp = await fetch(`${BASE_URL}/api/internal/v1/media/jobs`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid-token-xyz'
      }
    });
    assert(invalidAuthResp.status === 401, `Invalid token rejected with 401 (got ${invalidAuthResp.status})`);
  }

  // Step 5: Send Image via POST /api/internal/v1/media/upload (Universal Fallback intake -> R2)
  console.log('\n[Step 5: POST /api/internal/v1/media/upload]');
  const testPngBuffer = createTestPng(1200, 675);
  let firstAssetId = null;
  {
    const formData = new FormData();
    const blob = new Blob([testPngBuffer], { type: 'image/png' });
    formData.append('file', blob, 'smoke_featured.png');
    formData.append('article_id', '888');
    formData.append('role', 'featured');
    formData.append('alt_text', 'Atap metal pasir warna arang terpasang rapi pada rumah minimalis tropis');
    formData.append('job_id', 'mjob_smoke_local_888_featured');

    const resp = await fetch(`${BASE_URL}/api/internal/v1/media/upload`, {
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
    assert(data.jobId === 'mjob_smoke_local_888_featured', 'Job ID returned in response');
    assert(data.jobStatus === 'ATTACHED', 'Job transitioned to ATTACHED');
    assert(data.editorialReadiness === 'READY_FOR_REVIEW', 'Editorial readiness is READY_FOR_REVIEW');
    firstAssetId = data.assetId;
    console.log(`    Asset ID: ${firstAssetId}`);
    console.log(`    Storage Key: ${data.storageKey}`);
  }

  // Step 6: Idempotency (Double-Send / Retry Check)
  console.log('\n[Step 6: Double Send Idempotency Check]');
  {
    const formData = new FormData();
    const blob = new Blob([testPngBuffer], { type: 'image/png' });
    formData.append('file', blob, 'smoke_featured.png');
    formData.append('article_id', '888');
    formData.append('role', 'featured');
    formData.append('alt_text', 'Atap metal pasir warna arang terpasang rapi pada rumah minimalis tropis');
    formData.append('job_id', 'mjob_smoke_local_888_featured');

    const resp = await fetch(`${BASE_URL}/api/internal/v1/media/upload`, {
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
    assert(data.assetId === firstAssetId, 'Reuses same asset ID');
  }

  // Step 7: Verify Job status via GET /api/internal/v1/media/jobs/[job_id]
  console.log('\n[Step 7: Verify ATTACHED status via Single Job Endpoint]');
  {
    const resp = await fetch(`${BASE_URL}/api/internal/v1/media/jobs/mjob_smoke_local_888_featured`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DEVICE_TOKEN}`,
        'X-RL-Device-Token': DEVICE_TOKEN
      }
    });
    assert(resp.status === 200, 'Single job endpoint returns 200');
    const data = await resp.json();
    assert(data.job.status === 'ATTACHED', 'Job status in D1 is ATTACHED');
  }

  // Step 8: PATCH /api/internal/v1/media/jobs/[job_id]
  console.log('\n[Step 8: PATCH /api/internal/v1/media/jobs/[job_id]]');
  {
    const resp = await fetch(`${BASE_URL}/api/internal/v1/media/jobs/mjob_smoke_local_888_featured`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${DEVICE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'ATTACHED',
        error_message: null
      })
    });
    assert(resp.status === 200, `PATCH endpoint returns 200 OK (got ${resp.status})`);
    const data = await resp.json();
    assert(data.status === 'success', 'PATCH status is success');
    assert(data.job.status === 'ATTACHED', 'PATCH preserves ATTACHED status');
  }

  console.log('\n====================================================');
  console.log(`Live Smoke Summary: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runLiveSmoke().catch((err) => {
  console.error('Fatal live smoke error:', err);
  process.exit(1);
});
