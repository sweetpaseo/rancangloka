import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  requestPromotionApproval,
  adminApprovePromotionRequest,
  adminRejectPromotionRequest,
  verifyAndConsumePromotionApproval,
  getPromotionRequestStatus,
  issuePromotionApproval
} from '../src/lib/media/promotion-approval.ts';

import { POST as requestPromotionPost } from '../src/pages/api/internal/v1/media/promotions/request.ts';
import { POST as mediaDeviceApprovePost } from '../src/pages/api/internal/v1/media/promotions/approve.ts';
import { POST as standaloneUploadPost } from '../src/pages/api/internal/v1/media/assets/upload.ts';
import { POST as adminApprovePost } from '../src/pages/api/admin/media-promotions/[id]/approve.ts';
import { GET as adminListPost } from '../src/pages/api/admin/media-promotions/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Valid 1315x660 WebP binary fixture
const VALID_WEBP_BYTES = fs.readFileSync(path.join(__dirname, '..', 'artifacts', 'article-b-cover-1315x660.webp'));
const VALID_WEBP_SHA256 = crypto.createHash('sha256').update(VALID_WEBP_BYTES).digest('hex');

const TEST_ARTICLE = {
  id: 8,
  slug: 'thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi',
  title: 'Thermal Bridge Kusen Aluminium',
  status: 'published',
  content_hash: '66094cf52d2d10650b82141adace0cedc27fc9a3f63ae1f85e19a57c38d4e260'
};

const TEST_ARTICLE_OTHER = {
  id: 9,
  slug: 'artikel-hunian-lainnya',
  title: 'Artikel Hunian Lainnya',
  status: 'published',
  content_hash: '1111111111111111111111111111111111111111111111111111111111111111'
};

function createMockDb(initialData = {}) {
  const articles = new Map(initialData.articles || [
    [TEST_ARTICLE.id, { ...TEST_ARTICLE }],
    [TEST_ARTICLE_OTHER.id, { ...TEST_ARTICLE_OTHER }]
  ]);
  const promotionApprovals = new Map(initialData.promotionApprovals || []);
  const devices = new Map(initialData.devices || [
    ['lokamedia-prod-operator-01', {
      device_id: 'lokamedia-prod-operator-01',
      device_name: 'LokaMedia Production Operator 01',
      token_hash: crypto.createHash('sha256').update('test_device_token_secret_123').digest('hex'),
      scope: 'media:device',
      status: 'ACTIVE'
    }]
  ]);

  return {
    articles,
    promotionApprovals,
    devices,
    async exec(sql) { return { success: true }; },
    prepare(query) {
      const q = query.trim();
      const normQ = q.replace(/\s+/g, ' ');

      const createExecutor = (boundParams = []) => ({
        async first(col) {
          if (normQ.includes('FROM media_devices WHERE token_hash = ?')) {
            const tokenHash = boundParams[0];
            for (const dev of devices.values()) {
              if (dev.token_hash === tokenHash) return col ? dev[col] : dev;
            }
            return null;
          }
          if (normQ.includes('FROM articles WHERE slug = ?')) {
            const slug = boundParams[0];
            for (const art of articles.values()) {
              if (art.slug === slug) return col ? art[col] : art;
            }
            return null;
          }
          if (normQ.includes('FROM articles WHERE id = ?')) {
            const id = Number(boundParams[0]);
            const art = articles.get(id);
            return art ? (col ? art[col] : art) : null;
          }
          if (normQ.includes('FROM media_promotion_approvals WHERE approval_id = ?')) {
            const id = boundParams[0];
            const rec = promotionApprovals.get(id);
            return rec ? (col ? rec[col] : rec) : null;
          }
          return null;
        },
        async all() {
          if (normQ.includes('FROM media_promotion_approvals')) {
            return { results: Array.from(promotionApprovals.values()) };
          }
          return { results: [] };
        },
        async run() {
          if (normQ.includes('INSERT INTO media_promotion_approvals')) {
            const [requestId, deviceId, articleId, articleSlug, contentHash, cleanSha, slotKey, altText, width, height, mime, byteSize, reqAt, issAt, expAt] = boundParams;
            promotionApprovals.set(requestId, {
              approval_id: requestId,
              device_id: deviceId,
              article_id: Number(articleId),
              article_slug: articleSlug,
              content_hash: contentHash,
              candidate_sha256: cleanSha,
              slot_key: slotKey,
              alt_text: altText,
              candidate_width: width,
              candidate_height: height,
              candidate_mime: mime,
              candidate_byte_size: byteSize,
              status: 'REQUESTED',
              signature: null,
              requested_at: reqAt,
              issued_at: issAt,
              expires_at: expAt
            });
            return { success: true };
          }
          if (normQ.includes('UPDATE media_promotion_approvals')) {
            if (normQ.includes("SET status = 'APPROVED'")) {
              const [approvedAt, adminActor, signature, approvalId] = boundParams;
              const rec = promotionApprovals.get(approvalId);
              if (rec && rec.status === 'REQUESTED') {
                rec.status = 'APPROVED';
                rec.approved_at = approvedAt;
                rec.approved_by = adminActor;
                rec.signature = signature;
                return { success: true, changes: 1 };
              }
              return { success: true, changes: 0 };
            }
            if (normQ.includes("SET status = 'REJECTED'")) {
              const [adminActor, reason, approvalId] = boundParams;
              const rec = promotionApprovals.get(approvalId);
              if (rec && rec.status === 'REQUESTED') {
                rec.status = 'REJECTED';
                rec.approved_by = adminActor;
                rec.rejection_reason = reason;
                return { success: true, changes: 1 };
              }
              return { success: true, changes: 0 };
            }
            if (normQ.includes("SET status = 'CONSUMED'")) {
              const [uploadId, approvalId] = boundParams;
              const rec = promotionApprovals.get(approvalId);
              if (rec && (rec.status === 'APPROVED' || rec.status === 'ISSUED')) {
                rec.status = 'CONSUMED';
                rec.consumed_at = new Date().toISOString();
                rec.consumed_by_upload_id = uploadId;
                return { success: true, changes: 1 };
              }
              return { success: true, changes: 0 };
            }
            return { success: true, changes: 1 };
          }
          return { success: true };
        }
      });

      return {
        ...createExecutor([]),
        bind(...params) {
          return createExecutor(params);
        }
      };
    }
  };
}

function createMockR2() {
  const objects = new Map();
  return {
    objects,
    async get(key) {
      const obj = objects.get(key);
      if (!obj) return null;
      return {
        size: obj.bytes.byteLength,
        customMetadata: obj.customMetadata,
        async arrayBuffer() { return obj.bytes.buffer; }
      };
    },
    async head(key) {
      const obj = objects.get(key);
      if (!obj) return null;
      return { size: obj.bytes.byteLength, customMetadata: obj.customMetadata };
    },
    async put(key, bytes, options = {}) {
      objects.set(key, { bytes: new Uint8Array(bytes), customMetadata: options.customMetadata });
      return { key };
    }
  };
}

console.log('--- LOKAMEDIA DUAL CONTROL NEGATIVE SECURITY REGRESSION SUITE ---');

// A: Valid media-device token cannot self-approve promotion.
test('A: Valid media-device token cannot self-approve promotion (403 HUMAN_ADMIN_APPROVAL_REQUIRED)', async () => {
  const mockDb = createMockDb();
  const req = new Request('http://localhost:4321/api/internal/v1/media/promotions/approve', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test_device_token_secret_123',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      article_slug: TEST_ARTICLE.slug,
      candidate_sha256: VALID_WEBP_SHA256,
      slot_key: 'featured'
    })
  });

  const res = await mediaDeviceApprovePost({
    request: req,
    locals: { db: mockDb, runtime: { env: { DB: mockDb } } }
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.code, 'HUMAN_ADMIN_APPROVAL_REQUIRED');
  assert.match(data.message || data.error, /Human Admin authority/i);
});

// B: Media device can create REQUESTED promotion.
test('B: Media device can create REQUESTED promotion challenge', async () => {
  const mockDb = createMockDb();
  const req = new Request('http://localhost:4321/api/internal/v1/media/promotions/request', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test_device_token_secret_123',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      article_slug: TEST_ARTICLE.slug,
      candidate_sha256: VALID_WEBP_SHA256,
      slot_key: 'featured',
      alt_text: 'Test alt text for dual control',
      candidate_width: 1315,
      candidate_height: 660,
      candidate_mime: 'image/webp',
      candidate_byte_size: VALID_WEBP_BYTES.byteLength
    })
  });

  const res = await requestPromotionPost({
    request: req,
    locals: { db: mockDb, runtime: { env: { DB: mockDb } } }
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.status, 'success');
  assert.ok(data.request_id);
  assert.ok(data.promotion_request);
  assert.equal(data.promotion_request.status, 'REQUESTED');
  assert.equal(data.promotion_request.candidate_sha256, VALID_WEBP_SHA256);
  // Zero signature minted on request
  assert.equal(data.promotion_request.signature, undefined);

  // Check in DB
  const stored = mockDb.promotionApprovals.get(data.request_id);
  assert.ok(stored);
  assert.equal(stored.status, 'REQUESTED');
  assert.equal(stored.signature, null);
});

// C: Unauthenticated caller cannot approve REQUESTED promotion.
test('C: Unauthenticated caller cannot approve REQUESTED promotion', async () => {
  const mockDb = createMockDb();
  const reqRes = await requestPromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: TEST_ARTICLE.slug,
    expectedContentHash: TEST_ARTICLE.content_hash,
    candidateSha256: VALID_WEBP_SHA256,
    slotKey: 'featured',
    altText: 'Test alt text for dual control'
  });
  assert.equal(reqRes.success, true);
  const requestId = reqRes.promotionRequest.request_id;

  // Endpoint without authenticated admin
  const req = new Request(`http://localhost:4321/api/admin/media-promotions/${requestId}/approve`, {
    method: 'POST'
  });

  const res = await adminApprovePost({
    request: req,
    params: { id: requestId },
    locals: { db: mockDb, adminUser: null, runtime: { env: { DB: mockDb } } }
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.code, 'ADMIN_UNAUTHORIZED');
});

// D: Authenticated admin can approve exact REQUESTED promotion.
test('D: Authenticated admin can approve exact REQUESTED promotion', async () => {
  const mockDb = createMockDb();
  const reqRes = await requestPromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: TEST_ARTICLE.slug,
    expectedContentHash: TEST_ARTICLE.content_hash,
    candidateSha256: VALID_WEBP_SHA256,
    slotKey: 'featured',
    altText: 'Test alt text for dual control'
  });
  assert.equal(reqRes.success, true);
  const requestId = reqRes.promotionRequest.request_id;

  const req = new Request(`http://localhost:4321/api/admin/media-promotions/${requestId}/approve`, {
    method: 'POST'
  });

  const res = await adminApprovePost({
    request: req,
    params: { id: requestId },
    locals: {
      db: mockDb,
      adminUser: { id: 1, username: 'chief_editor' },
      runtime: { env: { DB: mockDb } }
    }
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'success');
  assert.ok(data.approval_receipt);
  assert.equal(data.approval_receipt.status, 'APPROVED');
  assert.ok(data.approval_receipt.signature);
  assert.equal(data.approval_receipt.signature.length, 64);

  // DB reflects APPROVED status
  const stored = mockDb.promotionApprovals.get(requestId);
  assert.equal(stored.status, 'APPROVED');
  assert.equal(stored.approved_by, 'chief_editor');
  assert.ok(stored.signature);
});

// E: Media device can execute upload ONLY after admin approval.
test('E: Media device upload fails when promotion is only in REQUESTED status', async () => {
  const mockDb = createMockDb();
  const mockR2 = createMockR2();

  // Create request but DO NOT approve it
  const reqRes = await requestPromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: TEST_ARTICLE.slug,
    expectedContentHash: TEST_ARTICLE.content_hash,
    candidateSha256: VALID_WEBP_SHA256,
    slotKey: 'featured',
    altText: 'Test alt text for dual control'
  });
  assert.equal(reqRes.success, true);
  const unapprovedReceipt = {
    approval_id: reqRes.promotionRequest.request_id,
    request_id: reqRes.promotionRequest.request_id,
    device_id: 'lokamedia-prod-operator-01',
    article_id: TEST_ARTICLE.id,
    article_slug: TEST_ARTICLE.slug,
    content_hash: TEST_ARTICLE.content_hash,
    expected_content_hash: TEST_ARTICLE.content_hash,
    candidate_sha256: VALID_WEBP_SHA256,
    slot_key: 'featured',
    alt_text: 'Test alt text for dual control',
    status: 'REQUESTED'
  };

  const form = new FormData();
  form.set('expected_sha256', VALID_WEBP_SHA256);
  form.set('human_approval', JSON.stringify(unapprovedReceipt));
  form.set('file', new Blob([VALID_WEBP_BYTES], { type: 'image/webp' }), 'image.webp');

  const req = new Request('http://localhost:4321/api/internal/v1/media/assets/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer test_device_token_secret_123' },
    body: form
  });

  const res = await standaloneUploadPost({
    request: req,
    locals: { db: mockDb, runtime: { env: { DB: mockDb, MEDIA_BUCKET: mockR2 } } }
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.code, 'HUMAN_ADMIN_APPROVAL_REQUIRED');
  assert.equal(mockR2.objects.size, 0, 'No R2 write allowed before admin approval');
});

// F: Candidate SHA mismatch fails closed.
test('F: Candidate SHA mismatch fails closed (422 APPROVAL_SHA_MISMATCH)', async () => {
  const mockDb = createMockDb();
  const mockR2 = createMockR2();

  // Issue approval for fake SHA
  const fakeSha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const issueRes = await issuePromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: TEST_ARTICLE.slug,
    expectedContentHash: TEST_ARTICLE.content_hash,
    candidateSha256: fakeSha,
    slotKey: 'featured'
  });
  assert.equal(issueRes.success, true);

  // Present real image (whose SHA is VALID_WEBP_SHA256) with fakeSha approval
  const form = new FormData();
  form.set('expected_sha256', VALID_WEBP_SHA256);
  form.set('human_approval', JSON.stringify(issueRes.approvalReceipt));
  form.set('file', new Blob([VALID_WEBP_BYTES], { type: 'image/webp' }), 'image.webp');

  const req = new Request('http://localhost:4321/api/internal/v1/media/assets/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer test_device_token_secret_123' },
    body: form
  });

  const res = await standaloneUploadPost({
    request: req,
    locals: { db: mockDb, runtime: { env: { DB: mockDb, MEDIA_BUCKET: mockR2 } } }
  });

  assert.equal(res.status, 422);
  const data = await res.json();
  assert.equal(data.code, 'APPROVAL_SHA_MISMATCH');
  assert.equal(mockR2.objects.size, 0);
});

// G: Article mismatch fails closed.
test('G: Article mismatch fails closed (404/422)', async () => {
  const mockDb = createMockDb();
  const mockR2 = createMockR2();

  const issueRes = await issuePromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: TEST_ARTICLE.slug,
    expectedContentHash: TEST_ARTICLE.content_hash,
    candidateSha256: VALID_WEBP_SHA256,
    slotKey: 'featured'
  });
  assert.equal(issueRes.success, true);

  // Tamper approval receipt to claim article TEST_ARTICLE_OTHER
  const tamperedReceipt = {
    ...issueRes.approvalReceipt,
    article_slug: TEST_ARTICLE_OTHER.slug,
    expected_content_hash: TEST_ARTICLE_OTHER.content_hash
  };

  const form = new FormData();
  form.set('expected_sha256', VALID_WEBP_SHA256);
  form.set('human_approval', JSON.stringify(tamperedReceipt));
  form.set('file', new Blob([VALID_WEBP_BYTES], { type: 'image/webp' }), 'image.webp');

  const req = new Request('http://localhost:4321/api/internal/v1/media/assets/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer test_device_token_secret_123' },
    body: form
  });

  const res = await standaloneUploadPost({
    request: req,
    locals: { db: mockDb, runtime: { env: { DB: mockDb, MEDIA_BUCKET: mockR2 } } }
  });

  // Fails with 403 or 422
  assert.ok(res.status === 403 || res.status === 422);
  const data = await res.json();
  assert.ok(data.code === 'APPROVAL_SLUG_MISMATCH' || data.code === 'APPROVAL_SIGNATURE_INVALID');
  assert.equal(mockR2.objects.size, 0);
});

// H: Content-hash drift after approval blocks execution.
test('H: Content-hash drift after approval blocks execution (409 CONTENT_HASH_DRIFT_DETECTED)', async () => {
  const mockDb = createMockDb();
  const mockR2 = createMockR2();

  const issueRes = await issuePromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: TEST_ARTICLE.slug,
    expectedContentHash: TEST_ARTICLE.content_hash,
    candidateSha256: VALID_WEBP_SHA256,
    slotKey: 'featured'
  });
  assert.equal(issueRes.success, true);

  // Simulate article edit in production (content_hash mutates)
  const article = mockDb.articles.get(TEST_ARTICLE.id);
  article.content_hash = '9999999999999999999999999999999999999999999999999999999999999999';

  const form = new FormData();
  form.set('expected_sha256', VALID_WEBP_SHA256);
  form.set('human_approval', JSON.stringify(issueRes.approvalReceipt));
  form.set('file', new Blob([VALID_WEBP_BYTES], { type: 'image/webp' }), 'image.webp');

  const req = new Request('http://localhost:4321/api/internal/v1/media/assets/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer test_device_token_secret_123' },
    body: form
  });

  const res = await standaloneUploadPost({
    request: req,
    locals: { db: mockDb, runtime: { env: { DB: mockDb, MEDIA_BUCKET: mockR2 } } }
  });

  assert.equal(res.status, 409);
  const data = await res.json();
  assert.ok(data.code === 'CONTENT_HASH_MISMATCH' || data.code === 'CONTENT_HASH_DRIFT_DETECTED');
  assert.equal(mockR2.objects.size, 0);
});

// I: Expired approval blocks execution.
test('I: Expired approval blocks execution (403 APPROVAL_EXPIRED)', async () => {
  const mockDb = createMockDb();
  const mockR2 = createMockR2();

  // 1. Pending request with negative TTL cannot be approved
  const reqRes = await requestPromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: TEST_ARTICLE.slug,
    expectedContentHash: TEST_ARTICLE.content_hash,
    candidateSha256: VALID_WEBP_SHA256,
    slotKey: 'featured',
    altText: 'Test expired alt text',
    ttlSeconds: -10
  });
  assert.equal(reqRes.success, true);
  const appRes = await adminApprovePromotionRequest(mockDb, {
    requestId: reqRes.promotionRequest.request_id,
    adminActor: 'admin_operator'
  });
  assert.equal(appRes.success, false);
  assert.equal(appRes.code, 'PROMOTION_REQUEST_EXPIRED');

  // 2. Previously approved receipt that expires blocks execution at upload boundary
  const validIssue = await issuePromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: TEST_ARTICLE.slug,
    expectedContentHash: TEST_ARTICLE.content_hash,
    candidateSha256: VALID_WEBP_SHA256,
    slotKey: 'featured'
  });
  assert.equal(validIssue.success, true);

  // Expire the approved record in D1
  const stored = mockDb.promotionApprovals.get(validIssue.approvalReceipt.approval_id);
  stored.expires_at = new Date(Date.now() - 60000).toISOString();

  const form = new FormData();
  form.set('expected_sha256', VALID_WEBP_SHA256);
  form.set('human_approval', JSON.stringify({
    ...validIssue.approvalReceipt,
    expires_at: stored.expires_at
  }));
  form.set('file', new Blob([VALID_WEBP_BYTES], { type: 'image/webp' }), 'image.webp');

  const req = new Request('http://localhost:4321/api/internal/v1/media/assets/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer test_device_token_secret_123' },
    body: form
  });

  const res = await standaloneUploadPost({
    request: req,
    locals: { db: mockDb, runtime: { env: { DB: mockDb, MEDIA_BUCKET: mockR2 } } }
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.code, 'APPROVAL_EXPIRED');
  assert.equal(mockR2.objects.size, 0);
});

// J: Consumed approval cannot authorize a different operation.
test('J: Consumed approval cannot authorize a different operation (409/422)', async () => {
  const mockDb = createMockDb();
  const mockR2 = createMockR2();

  const issueRes = await issuePromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: TEST_ARTICLE.slug,
    expectedContentHash: TEST_ARTICLE.content_hash,
    candidateSha256: VALID_WEBP_SHA256,
    slotKey: 'featured'
  });
  assert.equal(issueRes.success, true);

  // 1. First upload consumes the approval
  const form1 = new FormData();
  form1.set('expected_sha256', VALID_WEBP_SHA256);
  form1.set('human_approval', JSON.stringify(issueRes.approvalReceipt));
  form1.set('file', new Blob([VALID_WEBP_BYTES], { type: 'image/webp' }), 'image.webp');

  const req1 = new Request('http://localhost:4321/api/internal/v1/media/assets/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer test_device_token_secret_123' },
    body: form1
  });

  const res1 = await standaloneUploadPost({
    request: req1,
    locals: { db: mockDb, runtime: { env: { DB: mockDb, MEDIA_BUCKET: mockR2 } } }
  });
  assert.equal(res1.status, 200);

  // Check state is CONSUMED
  const stored = mockDb.promotionApprovals.get(issueRes.approvalReceipt.approval_id);
  assert.equal(stored.status, 'CONSUMED');

  // 2. Replay against another article
  const form2 = new FormData();
  form2.set('expected_sha256', VALID_WEBP_SHA256);
  form2.set('human_approval', JSON.stringify({
    ...issueRes.approvalReceipt,
    article_slug: TEST_ARTICLE_OTHER.slug,
    expected_content_hash: TEST_ARTICLE_OTHER.content_hash
  }));
  form2.set('file', new Blob([VALID_WEBP_BYTES], { type: 'image/webp' }), 'image.webp');

  const req2 = new Request('http://localhost:4321/api/internal/v1/media/assets/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer test_device_token_secret_123' },
    body: form2
  });

  const res2 = await standaloneUploadPost({
    request: req2,
    locals: { db: mockDb, runtime: { env: { DB: mockDb, MEDIA_BUCKET: mockR2 } } }
  });

  assert.ok(res2.status === 403 || res2.status === 409 || res2.status === 422);
  const data2 = await res2.json();
  assert.ok(
    data2.code === 'APPROVAL_SLUG_MISMATCH' ||
    data2.code === 'APPROVAL_SIGNATURE_INVALID' ||
    data2.code === 'APPROVAL_ALREADY_CONSUMED' ||
    data2.code === 'CONTENT_HASH_MISMATCH'
  );
});

// K: Admin approval does not expose admin_session.
test('K: Admin approval response does not expose admin_session value or secret', async () => {
  const mockDb = createMockDb();
  const reqRes = await requestPromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: TEST_ARTICLE.slug,
    expectedContentHash: TEST_ARTICLE.content_hash,
    candidateSha256: VALID_WEBP_SHA256,
    slotKey: 'featured',
    altText: 'Test alt text for dual control'
  });
  const requestId = reqRes.promotionRequest.request_id;

  const req = new Request(`http://localhost:4321/api/admin/media-promotions/${requestId}/approve`, {
    method: 'POST',
    headers: { Cookie: 'admin_session=super_secret_cookie_token_9999' }
  });

  const res = await adminApprovePost({
    request: req,
    params: { id: requestId },
    locals: {
      db: mockDb,
      adminUser: { id: 1, username: 'operator' },
      runtime: { env: { DB: mockDb } }
    }
  });

  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text.includes('super_secret_cookie_token_9999'), false, 'admin_session must never be in response body');
  assert.equal(text.includes('RANCANGLOKA_ADMIN_SESSION_SECRET'), false);
});

// L: Device token does not enter admin UI or logs.
test('L: Device token does not enter admin list endpoint or promotion approvals table', async () => {
  const mockDb = createMockDb();
  await requestPromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: TEST_ARTICLE.slug,
    expectedContentHash: TEST_ARTICLE.content_hash,
    candidateSha256: VALID_WEBP_SHA256,
    slotKey: 'featured',
    altText: 'Test alt text for dual control'
  });

  const req = new Request('http://localhost:4321/api/admin/media-promotions', {
    method: 'GET'
  });

  const res = await adminListPost({
    request: req,
    locals: {
      db: mockDb,
      adminUser: { id: 1, username: 'editor' },
      runtime: { env: { DB: mockDb } }
    }
  });

  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text.includes('test_device_token_secret_123'), false, 'device token must never enter admin response');
  assert.equal(text.includes('Bearer'), false);
  const data = JSON.parse(text);
  assert.ok(Array.isArray(data.pending_promotions));
  assert.equal(data.pending_promotions.length, 1);
  assert.equal(data.pending_promotions[0].device_id, 'lokamedia-prod-operator-01');
});
