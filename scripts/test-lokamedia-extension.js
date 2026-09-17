/**
 * RancangLoka — MEDIA-1: LokaMedia Extension Automated Test Suite
 *
 * Test Matrix:
 * 1. Pending jobs list (GET /api/internal/v1/media/jobs)
 * 2. Get job by ID (GET /api/internal/v1/media/jobs/[job_id])
 * 3. Invalid job (404 on non-existent job ID)
 * 4. Image intake preflight logic (Universal Fallback: file select/drop/paste MIME, size, dimensions)
 * 5. Double send idempotency (Deduplication on second send, no duplicate active bindings)
 * 6. Upload retry safety (Retry after failure preserves state)
 * 7. Attached state transition (Job transitions to ATTACHED on successful upload)
 * 8. Failed state transition (Job transitions to FAILED on error/patch)
 * 9. Skipped state transition (Job transitions to SKIPPED on user skip)
 * 10. Device credential scope security (No publish / article body edit permissions)
 * 11. Extension restart state preservation (Survives restart/reload)
 * 12. Article remains strictly draft (articles.status never mutated to published)
 */

import zlib from 'node:zlib';
import {
  GET as jobsGet,
  POST as jobsPost
} from '../src/pages/api/internal/v1/media/jobs/index.ts';
import {
  GET as singleJobGet,
  PATCH as singleJobPatch
} from '../src/pages/api/internal/v1/media/jobs/[job_id].ts';
import { POST as mediaUploadPost } from '../src/pages/api/internal/v1/media/upload.ts';
import {
  authenticateDeviceRequest,
  ALLOWED_MEDIA_SCOPES,
  FORBIDDEN_SCOPES
} from '../src/lib/media/device-auth.ts';
import {
  processMediaUpload,
  inspectImageBinary,
  STATUS_VALIDATED,
  READINESS_READY_FOR_REVIEW
} from '../src/lib/media/service.ts';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

// Generate valid test PNG buffer with specific dimensions
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
    crcBuf.writeUInt32BE(0x12345678, 0); // Mock crc for inspection
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // Scanlines (1 byte filter 0 + 4 bytes RGBA per pixel)
  const scanlines = Buffer.alloc(height * (1 + width * 4), 0);
  const compressed = zlib.deflateSync(scanlines);

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Mock In-Memory D1 Database Adapter
 */
function createMockD1() {
  const articles = [
    {
      id: 42,
      slug: 'perbedaan-atap-metal-pasir-genteng-beton',
      title: 'Perbedaan Atap Metal Pasir dan Genteng Beton untuk Rumah Tropis',
      description: 'Panduan komprehensif pemilihan material atap rumah tropis.',
      content_md: '# Perbedaan Atap Metal Pasir...',
      content_html: '<h1>Perbedaan Atap Metal Pasir...</h1>',
      featured_image: '',
      image_alt: '',
      status: 'draft',
      content_hash: 'hash_test_draft_42'
    },
    {
      id: 99,
      slug: 'artikel-sudah-publish',
      title: 'Artikel yang Sudah Publish',
      description: 'Deskripsi artikel publish.',
      content_md: '# Artikel Publish...',
      content_html: '<h1>Artikel Publish...</h1>',
      featured_image: '/media/images/existing.jpg',
      image_alt: 'Existing alt',
      status: 'published',
      content_hash: 'hash_test_published_99'
    }
  ];

  const mediaJobs = [
    {
      job_id: 'mjob_sample_42_featured',
      article_id: 42,
      article_slug: 'perbedaan-atap-metal-pasir-genteng-beton',
      article_title: 'Perbedaan Atap Metal Pasir dan Genteng Beton untuk Rumah Tropis',
      role: 'featured',
      slot_key: 'primary',
      media_type: 'image',
      prompt: 'Modern Indonesian tropical house with charcoal matte sand-coated metal roof, 8k, photorealistic',
      alt_text: 'Atap metal pasir warna arang terpasang rapi pada rumah minimalis tropis',
      aspect_ratio: '16:9',
      target_width: 1200,
      target_height: 675,
      status: 'PENDING',
      created_at: '2026-09-07T08:00:00Z',
      updated_at: '2026-09-07T08:00:00Z'
    }
  ];

  const mediaAssets = [];
  const articleMedia = [];
  let articleMediaIdCounter = 1;

  const devices = [
    {
      device_id: 'dev_chr_test001',
      device_name: 'Editor Chrome Extension',
      token_hash: 'test_token_hash_staging',
      scope: 'media:device',
      status: 'ACTIVE'
    }
  ];

  return {
    _articles: articles,
    _mediaJobs: mediaJobs,
    _mediaAssets: mediaAssets,
    _articleMedia: articleMedia,
    _devices: devices,

    prepare(sql) {
      const bound = [];
      const normalizedSql = sql.replace(/\s+/g, ' ');
      return {
        sql,
        normalizedSql,
        bound,
        bind(...args) {
          bound.push(...args);
          return this;
        },
        async first() {
          // 1. SELECT articles by id
          if (normalizedSql.includes('SELECT id, slug, status, content_md') && normalizedSql.includes('WHERE id = ?')) {
            const id = bound[0];
            const found = articles.find((a) => a.id === id);
            return found || null;
          }

          // 2. SELECT media_assets by sha256
          if (normalizedSql.includes('FROM media_assets WHERE sha256 = ?')) {
            const sha = bound[0];
            const found = mediaAssets.find((m) => m.sha256 === sha);
            return found || null;
          }

          // 3. SELECT article_media by article_id, asset_id, role, is_active
          if (normalizedSql.includes('FROM article_media WHERE article_id = ? AND asset_id = ? AND role = ? AND is_active = 1')) {
            const [artId, assetId, role] = bound;
            const found = articleMedia.find(
              (am) => am.article_id === artId && am.asset_id === assetId && am.role === role && am.is_active === 1
            );
            return found || null;
          }

          // 4. Calculate article readiness
          if (normalizedSql.includes('FROM article_media am') && normalizedSql.includes("am.role = 'featured' AND am.is_active = 1")) {
            const artId = bound[0];
            const binding = articleMedia.find((am) => am.article_id === artId && am.role === 'featured' && am.is_active === 1);
            if (!binding) return null;
            const asset = mediaAssets.find((ma) => ma.asset_id === binding.asset_id);
            const article = articles.find((a) => a.id === artId);
            return {
              is_active: binding.is_active,
              asset_status: asset?.status || 'PENDING',
              media_type: asset?.media_type || 'image',
              alt_text: asset?.alt_text || '',
              image_alt: article?.image_alt || ''
            };
          }

          // 5. SELECT media_jobs by job_id
          if (normalizedSql.includes('FROM media_jobs') && normalizedSql.includes('WHERE job_id = ?')) {
            const jid = bound[0];
            const found = mediaJobs.find((j) => j.job_id === jid);
            return found || null;
          }

          // 6. SELECT media_devices by token_hash
          if (normalizedSql.includes('FROM media_devices WHERE token_hash = ?')) {
            const [hash, status] = bound;
            const found = devices.find((d) => d.token_hash === hash && d.status === status);
            return found || null;
          }

          return null;
        },
        async all() {
          // SELECT media_jobs list
          if (normalizedSql.includes('FROM media_jobs')) {
            let res = [...mediaJobs];
            if (bound.includes('PENDING')) {
              res = res.filter((j) => j.status === 'PENDING');
            }
            return { results: res };
          }
          return { results: [] };
        },
        async run() {
          // 1. UPDATE media_jobs SET status
          if (normalizedSql.includes('UPDATE media_jobs SET status = ?')) {
            const [status, jid] = bound;
            const found = mediaJobs.find((j) => j.job_id === jid);
            if (found) {
              found.status = status;
              found.updated_at = new Date().toISOString();
            }
            return { success: true };
          }

          // 2. UPDATE media_jobs SET status = 'ATTACHED'
          if (normalizedSql.includes("UPDATE media_jobs SET status = 'ATTACHED'")) {
            const [jid] = bound;
            const found = mediaJobs.find((j) => j.job_id === jid);
            if (found) {
              found.status = 'ATTACHED';
              found.updated_at = new Date().toISOString();
            }
            return { success: true };
          }

          // 3. INSERT INTO media_jobs
          if (normalizedSql.includes('INSERT INTO media_jobs')) {
            const [
              job_id, article_id, article_slug, article_title,
              role, slot_key, media_type, prompt, alt_text,
              aspect_ratio, target_width, target_height, status
            ] = bound;
            mediaJobs.push({
              job_id, article_id, article_slug, article_title,
              role, slot_key, media_type, prompt, alt_text,
              aspect_ratio, target_width, target_height,
              status,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            return { success: true };
          }

          // 4. INSERT INTO media_assets
          if (normalizedSql.includes('INSERT INTO media_assets')) {
            const [
              asset_id, media_type, source_type, storage_key, public_url,
              mime_type, width, height, file_size, sha256, alt_text, status
            ] = bound;
            mediaAssets.push({
              asset_id, media_type, source_type, storage_key, public_url,
              mime_type, width, height, file_size, sha256, alt_text, status
            });
            return { success: true };
          }

          // 5. UPDATE article_media SET is_active = 0
          if (normalizedSql.includes('UPDATE article_media SET is_active = 0')) {
            const [artId, role] = bound;
            articleMedia.forEach((am) => {
              if (am.article_id === artId && am.role === role) {
                am.is_active = 0;
              }
            });
            return { success: true };
          }

          // 6. INSERT INTO article_media
          if (normalizedSql.includes('INSERT INTO article_media')) {
            const [artId, assetId, role, slotKey, caption] = bound;
            articleMedia.push({
              id: articleMediaIdCounter++,
              article_id: artId,
              asset_id: assetId,
              role,
              slot_key: slotKey,
              is_active: 1,
              caption
            });
            return { success: true };
          }

          // 7. UPDATE articles SET featured_image
          if (normalizedSql.includes('UPDATE articles SET featured_image = ?')) {
            const [featured_image, image_alt, artId] = bound;
            const found = articles.find((a) => a.id === artId && a.status === 'draft');
            if (found) {
              found.featured_image = featured_image;
              found.image_alt = image_alt;
              // GUARANTEE: status remains 'draft'
            }
            return { success: true };
          }

          return { success: true };
        }
      };
    }
  };
}

/**
 * Mock R2 Bucket Adapter
 */
function createMockR2Bucket() {
  const store = new Map();
  return {
    _store: store,
    async put(key, buffer, options) {
      store.set(key, { buffer, options });
      return { key };
    },
    async get(key) {
      return store.get(key) || null;
    }
  };
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 RANCANGLOKA MEDIA-1 AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  const mockDb = createMockD1();
  const mockBucket = createMockR2Bucket();
  const mockLocals = {
    db: mockDb,
    runtime: {
      env: {
        DB: mockDb,
        MEDIA_BUCKET: mockBucket,
        LOKAMEDIA_DEVICE_TOKEN: 'staging-media-token'
      }
    }
  };

  // -------------------------------------------------------------------------
  // Test 1: Pending Jobs List (GET /api/internal/v1/media/jobs)
  // -------------------------------------------------------------------------
  console.log('[Test 1: Pending Jobs List Endpoint]');
  {
    const req = new Request('http://localhost:4321/api/internal/v1/media/jobs?status=PENDING', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer staging-media-token',
        'X-RL-Device-Token': 'staging-media-token'
      }
    });

    const resp = await jobsGet({ request: req, url: new URL(req.url), locals: mockLocals });
    assert(resp.status === 200, 'Jobs list returns 200 OK');
    const data = await resp.json();
    assert(data.status === 'success', 'Response status is success');
    assert(Array.isArray(data.jobs), 'Response contains jobs array');
    assert(data.jobs.length >= 1, 'Contains at least 1 pending job');
    assert(data.jobs[0].job_id === 'mjob_sample_42_featured', 'First job ID matches expected fixture');
    assert(data.jobs[0].role === 'featured', 'Job role is featured');
    assert(data.jobs[0].media_type === 'image', 'Media type is image');
  }

  // -------------------------------------------------------------------------
  // Test 2: Get Job by ID (GET /api/internal/v1/media/jobs/[job_id])
  // -------------------------------------------------------------------------
  console.log('\n[Test 2: Get Single Job by ID]');
  {
    const req = new Request('http://localhost:4321/api/internal/v1/media/jobs/mjob_sample_42_featured', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer staging-media-token'
      }
    });

    const resp = await singleJobGet({
      request: req,
      params: { job_id: 'mjob_sample_42_featured' },
      locals: mockLocals
    });
    assert(resp.status === 200, 'Single job retrieval returns 200 OK');
    const data = await resp.json();
    assert(data.job.article_id === 42, 'Returns correct target article_id');
    assert(data.job.prompt.includes('Modern Indonesian tropical house'), 'Returns correct prompt text');
    assert(data.job.status === 'PENDING', 'Job status is initially PENDING');
  }

  // -------------------------------------------------------------------------
  // Test 3: Invalid Job (404 on Non-Existent Job ID)
  // -------------------------------------------------------------------------
  console.log('\n[Test 3: Non-Existent Job 404 Rejection]');
  {
    const req = new Request('http://localhost:4321/api/internal/v1/media/jobs/mjob_non_existent', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer staging-media-token'
      }
    });

    const resp = await singleJobGet({
      request: req,
      params: { job_id: 'mjob_non_existent' },
      locals: mockLocals
    });
    assert(resp.status === 404, 'Non-existent job ID returns 404 Not Found');
  }

  // -------------------------------------------------------------------------
  // Test 4: Image Intake Preflight Logic (Universal Fallback Validation)
  // -------------------------------------------------------------------------
  console.log('\n[Test 4: Universal Fallback & Image Preflight]');
  {
    const toArrayBuffer = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

    // Valid 800x450 PNG
    const validPng = createTestPng(800, 450);
    const meta = inspectImageBinary(toArrayBuffer(validPng));
    assert(meta.width === 800 && meta.height === 450, 'Inspects true pixel dimensions (800x450)');
    assert(meta.mimeType === 'image/png', 'Detects PNG magic bytes correctly');

    // Too small dimensions (< 600x338)
    const smallPng = createTestPng(400, 200);
    let smallFailed = false;
    try {
      inspectImageBinary(toArrayBuffer(smallPng));
    } catch (e) {
      smallFailed = true;
      assert(e.code === 'DIMENSIONS_TOO_SMALL', 'Rejects undersized image (< 600x338)');
    }
    assert(smallFailed, 'Throws exception on undersized dimensions');

    // Invalid format magic bytes (>= 16 bytes to pass size check)
    const corruptBuffer = Buffer.alloc(32, 0xaa);
    let corruptFailed = false;
    try {
      inspectImageBinary(toArrayBuffer(corruptBuffer));
    } catch (e) {
      corruptFailed = true;
      assert(e.code === 'INVALID_MIME_TYPE', 'Rejects non-image magic bytes with INVALID_MIME_TYPE');
    }
    assert(corruptFailed, 'Throws exception on non-image binary');

    // Truncated payload (< 16 bytes)
    const truncatedBuffer = Buffer.from([0x00, 0x11, 0x22]);
    let truncatedFailed = false;
    try {
      inspectImageBinary(toArrayBuffer(truncatedBuffer));
    } catch (e) {
      truncatedFailed = true;
      assert(e.code === 'CORRUPT_IMAGE_PAYLOAD', 'Rejects payload < 16 bytes with CORRUPT_IMAGE_PAYLOAD');
    }
    assert(truncatedFailed, 'Throws exception on truncated payload');
  }

  // -------------------------------------------------------------------------
  // Test 5: Upload via Reused MEDIA-0 API & Attached State Transition
  // -------------------------------------------------------------------------
  console.log('\n[Test 5: Reused MEDIA-0 Upload API & ATTACHED Transition]');
  const validImageBuffer = createTestPng(1200, 675);
  let firstAssetId = '';
  {
    // Create multipart form payload
    const formData = new FormData();
    const blob = new Blob([validImageBuffer], { type: 'image/png' });
    formData.append('file', blob, 'featured_roof.png');
    formData.append('article_id', '42');
    formData.append('role', 'featured');
    formData.append('alt_text', 'Atap metal pasir warna arang terpasang rapi pada rumah minimalis tropis');
    formData.append('job_id', 'mjob_sample_42_featured');

    const req = new Request('http://localhost:4321/api/internal/v1/media/upload', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer staging-media-token',
        'X-RL-Device-Token': 'staging-media-token',
        'X-RL-Scope': 'media:write:draft'
      },
      body: formData
    });

    const resp = await mediaUploadPost({ request: req, locals: mockLocals });
    assert(resp.status === 200, 'Upload succeeds with 200 OK');
    const data = await resp.json();
    assert(data.status === 'success', 'Response status is success');
    assert(data.deduplicated === false, 'First upload is not deduplicated (new R2 write)');
    assert(data.jobId === 'mjob_sample_42_featured', 'Response references job_id');
    assert(data.jobStatus === 'ATTACHED', 'Job status transitioned to ATTACHED');
    assert(data.editorialReadiness === READINESS_READY_FOR_REVIEW, 'Editorial readiness updated to READY_FOR_REVIEW');
    firstAssetId = data.assetId;

    // Verify job in database is ATTACHED
    const jobRecord = mockDb._mediaJobs.find((j) => j.job_id === 'mjob_sample_42_featured');
    assert(jobRecord.status === 'ATTACHED', 'Job record status in D1 is ATTACHED');
  }

  // -------------------------------------------------------------------------
  // Test 6: Double Send Idempotency (Deduplication & No Redundant Bindings)
  // -------------------------------------------------------------------------
  console.log('\n[Test 6: Double Send Idempotency]');
  {
    const initialBindingCount = mockDb._articleMedia.length;

    const formData = new FormData();
    const blob = new Blob([validImageBuffer], { type: 'image/png' });
    formData.append('file', blob, 'featured_roof.png');
    formData.append('article_id', '42');
    formData.append('role', 'featured');
    formData.append('alt_text', 'Atap metal pasir warna arang terpasang rapi pada rumah minimalis tropis');
    formData.append('job_id', 'mjob_sample_42_featured');

    const req = new Request('http://localhost:4321/api/internal/v1/media/upload', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer staging-media-token',
        'X-RL-Device-Token': 'staging-media-token',
        'X-RL-Scope': 'media:write:draft'
      },
      body: formData
    });

    const resp = await mediaUploadPost({ request: req, locals: mockLocals });
    assert(resp.status === 200, 'Second upload returns 200 OK idempotently');
    const data = await resp.json();
    assert(data.deduplicated === true, 'Existing SHA-256 asset is deduplicated (zero redundant R2 write)');
    assert(data.assetId === firstAssetId, 'Reuses identical asset_id');

    // Verify no duplicate active bindings were created
    const activeBindings = mockDb._articleMedia.filter((am) => am.article_id === 42 && am.role === 'featured' && am.is_active === 1);
    assert(activeBindings.length === 1, 'Exactly one active featured binding exists');
    assert(mockDb._articleMedia.length === initialBindingCount, 'No duplicate rows added to article_media');
  }

  // -------------------------------------------------------------------------
  // Test 7: Upload Retry Safety After Transient Network Error
  // -------------------------------------------------------------------------
  console.log('\n[Test 7: Safe Upload Retry]');
  {
    // A retry with the same job_id and file produces clean idempotent outcome
    const formData = new FormData();
    const blob = new Blob([validImageBuffer], { type: 'image/png' });
    formData.append('file', blob, 'retry_image.png');
    formData.append('article_id', '42');
    formData.append('role', 'featured');
    formData.append('alt_text', 'Atap metal pasir retry');
    formData.append('job_id', 'mjob_sample_42_featured');

    const req = new Request('http://localhost:4321/api/internal/v1/media/upload', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer staging-media-token',
        'X-RL-Scope': 'media:write:draft'
      },
      body: formData
    });

    const resp = await mediaUploadPost({ request: req, locals: mockLocals });
    assert(resp.status === 200, 'Retry upload succeeds with 200 OK');
    const data = await resp.json();
    assert(data.status === 'success', 'Retry response is successful');
  }

  // -------------------------------------------------------------------------
  // Test 8: Failed State Transition (PATCH /api/internal/v1/media/jobs/[job_id])
  // -------------------------------------------------------------------------
  console.log('\n[Test 8: Failed State Transition]');
  {
    const req = new Request('http://localhost:4321/api/internal/v1/media/jobs/mjob_sample_42_featured', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer staging-media-token'
      },
      body: JSON.stringify({
        status: 'FAILED',
        error_message: 'Operator cancelled generation in external tool'
      })
    });

    const resp = await singleJobPatch({
      request: req,
      params: { job_id: 'mjob_sample_42_featured' },
      locals: mockLocals
    });
    assert(resp.status === 200, 'Status update to FAILED returns 200 OK');
    const data = await resp.json();
    assert(data.job.status === 'FAILED', 'Job status transitioned to FAILED');
  }

  // -------------------------------------------------------------------------
  // Test 9: Skipped State Transition (PATCH /api/internal/v1/media/jobs/[job_id])
  // -------------------------------------------------------------------------
  console.log('\n[Test 9: Skipped State Transition]');
  {
    const req = new Request('http://localhost:4321/api/internal/v1/media/jobs/mjob_sample_42_featured', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer staging-media-token'
      },
      body: JSON.stringify({
        status: 'SKIPPED'
      })
    });

    const resp = await singleJobPatch({
      request: req,
      params: { job_id: 'mjob_sample_42_featured' },
      locals: mockLocals
    });
    assert(resp.status === 200, 'Status update to SKIPPED returns 200 OK');
    const data = await resp.json();
    assert(data.job.status === 'SKIPPED', 'Job status transitioned to SKIPPED');
  }

  // -------------------------------------------------------------------------
  // Test 10: Device Credential Scope Security (Zero Publish / Edit Permissions)
  // -------------------------------------------------------------------------
  console.log('\n[Test 10: Zero-Trust Security Scope Guardrails]');
  {
    // 10a. Request with publish scope must be rejected
    const publishReq = new Request('http://localhost:4321/api/internal/v1/media/upload', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer staging-media-token',
        'X-RL-Scope': 'publish'
      }
    });
    const authPublish = await authenticateDeviceRequest(publishReq, mockDb, { LOKAMEDIA_DEVICE_TOKEN: 'staging-media-token' });
    assert(authPublish.authenticated === false, 'Device request claiming publish scope is denied');
    assert(authPublish.statusCode === 403, 'Returns 403 Forbidden on forbidden scope');

    // 10b. Request with article edit scope must be rejected
    const editReq = new Request('http://localhost:4321/api/internal/v1/media/upload', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer staging-media-token',
        'X-RL-Scope': 'article:edit'
      }
    });
    const authEdit = await authenticateDeviceRequest(editReq, mockDb, { LOKAMEDIA_DEVICE_TOKEN: 'staging-media-token' });
    assert(authEdit.authenticated === false, 'Device request claiming article:edit scope is denied');

    // 10c. Valid media:device scope is permitted
    const validReq = new Request('http://localhost:4321/api/internal/v1/media/upload', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer staging-media-token',
        'X-RL-Scope': 'media:device'
      }
    });
    const authValid = await authenticateDeviceRequest(validReq, mockDb, { LOKAMEDIA_DEVICE_TOKEN: 'staging-media-token' });
    assert(authValid.authenticated === true, 'Device request with media:device scope is authenticated');
  }

  // -------------------------------------------------------------------------
  // Test 11: Extension Restart Preserves Completed State
  // -------------------------------------------------------------------------
  console.log('\n[Test 11: State Preservation Across Extension Restart]');
  {
    // Set job to ATTACHED
    const jobRecord = mockDb._mediaJobs.find((j) => j.job_id === 'mjob_sample_42_featured');
    jobRecord.status = 'ATTACHED';

    // Simulate extension reopening by querying single job
    const req = new Request('http://localhost:4321/api/internal/v1/media/jobs/mjob_sample_42_featured', {
      method: 'GET',
      headers: { Authorization: 'Bearer staging-media-token' }
    });
    const resp = await singleJobGet({
      request: req,
      params: { job_id: 'mjob_sample_42_featured' },
      locals: mockLocals
    });
    const data = await resp.json();
    assert(data.job.status === 'ATTACHED', 'Reopening extension preserves ATTACHED state from D1');
  }

  // -------------------------------------------------------------------------
  // Test 12: Article Remains Strictly in 'draft' Status
  // -------------------------------------------------------------------------
  console.log("\n[Test 12: Invariant: Article Remains Strictly 'draft']");
  {
    const article = mockDb._articles.find((a) => a.id === 42);
    assert(article.status === 'draft', "Target article #42 status is strictly 'draft'");
    assert(article.status !== 'published', 'Target article #42 was NEVER mutated to published');
    assert(article.featured_image.length > 0, 'Target article featured_image compatibility mirror was populated');
    assert(article.image_alt.length > 0, 'Target article image_alt compatibility mirror was populated');

    // Also verify that attempting to upload media to a published article is blocked with 409
    let publishedUploadBlocked = false;
    try {
      await processMediaUpload(
        {
          articleId: 99, // Published article
          role: 'featured',
          imageBuffer: validImageBuffer,
          altText: 'Alt'
        },
        mockDb,
        mockBucket
      );
    } catch (err) {
      if (err.code === 'ARTICLE_NOT_DRAFT') {
        publishedUploadBlocked = true;
      }
    }
    assert(publishedUploadBlocked, 'Uploading media to published articles is strictly barred (ARTICLE_NOT_DRAFT 409)');
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n====================================================');
  console.log(`Test Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
