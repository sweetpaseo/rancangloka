import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LokaMediaController } from '../extensions/lokamedia/src/controller.js';
import { ExtensionStorage } from '../extensions/lokamedia/src/storage.js';
import { MemoryBlobStore, cloneBytes } from '../extensions/lokamedia/src/blob-store.js';
import { renderManualPromotion } from '../extensions/lokamedia/src/side-panel.js';
import { formatAuditText } from '../extensions/lokamedia/src/audit-log.js';
import { EXTENSION_VERSION } from '../extensions/lokamedia/src/constants.js';
import { EXPECTED_LOKAMEDIA_EXTENSION_VERSION } from '../src/lib/media/version.ts';
import { GET as resolveArticleGet } from '../src/pages/api/internal/v1/media/articles/resolve.ts';
import { POST as standaloneUploadPost } from '../src/pages/api/internal/v1/media/assets/upload.ts';
import { POST as approvePromotionPost } from '../src/pages/api/internal/v1/media/promotions/approve.ts';
import { issuePromotionApproval } from '../src/lib/media/promotion-approval.ts';
import { POST as attachMediaPost } from '../src/pages/api/internal/v1/media/article-media/attach.ts';
import { POST as mediaUploadPost } from '../src/pages/api/internal/v1/media/upload.ts';
import { attachArticleMedia } from '../src/lib/media/article-media.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.join(__dirname, '..', 'extensions', 'lokamedia');

// Valid 1315x660 WebP binary fixture from artifacts
const VALID_WEBP_BYTES = fs.readFileSync(path.join(__dirname, '..', 'artifacts', 'article-b-cover-1315x660.webp'));
const VALID_WEBP_SHA256 = crypto.createHash('sha256').update(VALID_WEBP_BYTES).digest('hex');

function createMockDb(initialData = {}) {
  const articles = new Map(initialData.articles || []);
  const assets = new Map(initialData.assets || []);
  const articleMedia = new Map(initialData.articleMedia || []);
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
    assets,
    articleMedia,
    promotionApprovals,
    devices,
    async exec(sql) { return { success: true }; },
    prepare(query) {
      const q = query.trim();
      const normQ = q.replace(/\s+/g, ' ');
      return {
        bind(...params) {
          return {
            async first(col) {
              if (normQ.includes('FROM media_devices WHERE token_hash = ?')) {
                const tokenHash = params[0];
                for (const dev of devices.values()) {
                  if (dev.token_hash === tokenHash) return col ? dev[col] : dev;
                }
                return null;
              }
              if (normQ.includes('FROM articles WHERE slug = ?')) {
                const slug = params[0];
                for (const art of articles.values()) {
                  if (art.slug === slug) return col ? art[col] : art;
                }
                return null;
              }
              if (normQ.includes('FROM articles WHERE id = ?')) {
                const id = Number(params[0]);
                const art = articles.get(id);
                return art ? (col ? art[col] : art) : null;
              }
              if (normQ.includes('FROM media_assets WHERE sha256 = ?')) {
                const sha = params[0];
                for (const ast of assets.values()) {
                  if (ast.sha256 === sha) return col ? ast[col] : ast;
                }
                return null;
              }
              if (normQ.includes('FROM media_assets WHERE id = ?') || normQ.includes('FROM media_assets WHERE asset_id = ?')) {
                const id = params[0];
                const ast = assets.get(id);
                if (!ast) return null;
                const normalized = {
                  asset_id: ast.asset_id || ast.id,
                  id: ast.id || ast.asset_id,
                  role: ast.role || 'featured',
                  status: ast.status || 'VALIDATED',
                  storage_key: ast.storage_key || 'media/images/key.webp',
                  sha256: ast.sha256 || 'sha',
                  public_url: ast.public_url || 'https://url',
                  ...ast
                };
                return col ? normalized[col] : normalized;
              }
              if (normQ.includes('FROM article_media') && normQ.includes('is_active = 1')) {
                const [artId, slotKey] = params;
                for (const rel of articleMedia.values()) {
                  if (rel.article_id === Number(artId) && rel.slot_key === slotKey && rel.is_active === 1) {
                    return col ? rel[col] : rel;
                  }
                }
                return null;
              }
              if (normQ.includes('FROM media_promotion_approvals WHERE approval_id = ?')) {
                const id = params[0];
                const rec = promotionApprovals.get(id);
                return rec ? (col ? rec[col] : rec) : null;
              }
              return null;
            },
            async all() {
              return { results: [] };
            },
            async run() {
              if (normQ.includes('INSERT INTO media_assets')) {
                const [id, storage_key, public_url, sha256, width, height, mime, file_size, status, alt_text] = params;
                assets.set(id, { id, storage_key, public_url, sha256, width, height, mime, file_size, status, alt_text });
                return { success: true };
              }
              if (normQ.includes('is_active = 0')) {
                const id = params[0];
                for (const rel of articleMedia.values()) {
                  if (rel.id === id || rel.id === Number(id)) {
                    rel.is_active = 0;
                  }
                }
                const rel = articleMedia.get(id) || articleMedia.get(Number(id));
                if (rel) rel.is_active = 0;
                return { success: true };
              }
              if (normQ.includes('INSERT INTO article_media')) {
                const [artId, assetId, role, slotKey, sortOrder, caption] = params;
                const newId = 201;
                articleMedia.set(newId, {
                  id: newId,
                  article_id: Number(artId),
                  asset_id: assetId,
                  role,
                  slot_key: slotKey,
                  is_active: 1,
                  sort_order: Number(sortOrder || 0),
                  caption
                });
                return { success: true, meta: { last_row_id: newId } };
              }
              if (normQ.includes('INSERT INTO media_asset_audit')) {
                return { success: true };
              }
              if (normQ.includes('UPDATE articles SET featured_image = ?') || normQ.includes('featured_image = COALESCE')) {
                const [featImg, imgAlt, artId] = params;
                const art = articles.get(Number(artId));
                if (art) {
                  art.featured_image = featImg;
                  art.image_alt = imgAlt;
                }
                return { success: true };
              }
              if (normQ.includes('INSERT INTO media_promotion_approvals')) {
                if (params.length >= 14) {
                  const [requestId, deviceId, articleId, articleSlug, contentHash, cleanSha, slotKey, altText, width, height, mime, byteSize, reqAt, issAt, expAt] = params;
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
                } else {
                  const [approval_id, device_id, article_id, article_slug, content_hash, candidate_sha256, slot_key, signature, issued_at, expires_at] = params;
                  promotionApprovals.set(approval_id, {
                    approval_id,
                    device_id,
                    article_id: Number(article_id),
                    article_slug,
                    content_hash,
                    candidate_sha256,
                    slot_key,
                    status: 'REQUESTED',
                    signature,
                    issued_at,
                    expires_at
                  });
                }
                return { success: true };
              }
              if (normQ.includes('UPDATE media_promotion_approvals')) {
                if (normQ.includes("SET status = 'APPROVED'")) {
                  const [approvedAt, adminActor, signature, approvalId] = params;
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
                  const [adminActor, reason, approvalId] = params;
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
                  const [uploadId, approvalId] = params;
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
          };
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
      return {
        size: obj.bytes.byteLength,
        customMetadata: obj.customMetadata
      };
    },
    async put(key, bytes, options = {}) {
      objects.set(key, { bytes: new Uint8Array(bytes), customMetadata: options.customMetadata });
      return { key };
    }
  };
}

console.log('--- LOKAMEDIA MANUAL PUBLISHED MEDIA PROMOTION TEST SUITE ---');

// ---------------------------------------------------------------------------
// TEST A & C: Manual local-file promotion works WITHOUT media job on a PUBLISHED article
// ---------------------------------------------------------------------------
test('A & C: Manual local-file promotion works WITHOUT media job on published article', async () => {
  const storage = ExtensionStorage.memory();
  await storage.update((state) => {
    state.config.deviceId = 'lokamedia-prod-operator-01';
  });
  const blobStore = new MemoryBlobStore();

  const articleB = {
    id: 8,
    slug: 'thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi',
    title: 'Thermal Bridge Kusen Aluminium',
    status: 'published',
    content: '<p>Body content published</p>',
    content_hash: '66094cf52d2d10650b82141adace0cedc27fc9a3f63ae1f85e19a57c38d4e260',
    featured_image: null,
    image_alt: null,
    published_at: '2026-10-08T10:00:00Z',
    actual_published_at: '2026-10-08T10:00:00Z'
  };

  let r2Uploaded = false;
  let assetRegistered = false;
  let mediaAttached = false;

  let approvalStatus = 'REQUESTED';
  const apiClient = {
    async resolveArticle(slug) {
      if (slug === articleB.slug) return { ok: true, article: { ...articleB } };
      return { ok: false, error: 'NOT_FOUND' };
    },
    async requestPromotionApproval({ article_slug, candidate_sha256, slot_key }) {
      return {
        status: 'success',
        request_id: 'appr_prom_test_mock_1',
        stage: 'WAITING_FOR_ADMIN_APPROVAL'
      };
    },
    async getPromotionStatus(requestId) {
      return {
        status: approvalStatus,
        approval_receipt: approvalStatus === 'APPROVED' ? {
          approval_id: requestId,
          request_id: requestId,
          device_id: 'lokamedia-prod-operator-01',
          article_id: articleB.id,
          article_slug: articleB.slug,
          content_hash: articleB.content_hash,
          expected_content_hash: articleB.content_hash,
          candidate_sha256: VALID_WEBP_SHA256,
          slot_key: 'featured',
          status: 'APPROVED',
          approved_at: new Date().toISOString(),
          issued_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 900000).toISOString(),
          signature: 'sig_mock_123'
        } : null
      };
    },
    async uploadStandaloneMedia({ expectedSha256 }) {
      r2Uploaded = true;
      return {
        ok: true,
        storage_key: `media/images/${expectedSha256}.webp`,
        public_url: `https://rancangloka.com/media/images/${expectedSha256}.webp`,
        sha256: expectedSha256
      };
    },
    async registerAsset({ sha256, storage_key, public_url }) {
      assetRegistered = true;
      return {
        ok: true,
        asset: { id: `ast_${sha256.slice(0, 8)}`, sha256, storage_key, public_url }
      };
    },
    async attachArticleMedia({ article_id, asset_id }) {
      mediaAttached = true;
      return {
        ok: true,
        relation: { id: `rel_${article_id}`, article_id, asset_id, role: 'featured', is_active: 1 }
      };
    }
  };

  const controller = new LokaMediaController({ storage, blobStore, apiClient });

  // Verify zero media jobs exist
  const initialState = await storage.readState();
  assert.equal(Object.keys(initialState.jobs).length, 0);

  // 1. Resolve Target Article by Slug
  const resolveRes = await controller.manualResolveArticle({ slug: articleB.slug });
  assert.equal(resolveRes.ok, true);
  assert.equal(resolveRes.article.status, 'published');

  // 2. Select Local Image
  const fileRes = await controller.manualSetLocalFile({
    bytes: VALID_WEBP_BYTES,
    mime: 'image/webp',
    width: 1315,
    height: 660,
    size: VALID_WEBP_BYTES.byteLength,
    sha256: VALID_WEBP_SHA256,
    alt_text: 'Detail sambungan kusen aluminium'
  });
  assert.equal(fileRes.ok, true);

  // 3. Request Promotion Approval (Device Authority)
  const approveRes = await controller.manualApprovePromotion();
  assert.equal(approveRes.ok, true);
  assert.equal(approveRes.stage, 'WAITING_FOR_ADMIN_APPROVAL');

  // Human Admin approves in /admin/media-promotions UI -> operator checks status:
  approvalStatus = 'APPROVED';
  const checkRes = await controller.checkPromotionApprovalStatus();
  assert.equal(checkRes.ok, true);
  assert.equal(checkRes.stage, 'APPROVED');
  assert.equal(checkRes.approval.candidate_sha256, VALID_WEBP_SHA256);
  assert.equal(checkRes.approval.article_slug, articleB.slug);

  // 4. Execute Promotion
  const execRes = await controller.manualExecutePromotion();
  assert.equal(execRes.ok, true);
  assert.equal(execRes.status, 'COMPLETE');
  assert.equal(r2Uploaded, true);
  assert.equal(assetRegistered, true);
  assert.equal(mediaAttached, true);

  // Invariant check: No media job was created
  const finalState = await storage.readState();
  assert.equal(Object.keys(finalState.jobs).length, 0);
  assert.equal(finalState.manualPromotionState.stage, 'COMPLETE');
});

// ---------------------------------------------------------------------------
// TEST B: Existing generation fallback still requires active job
// ---------------------------------------------------------------------------
test('B: Existing generation fallback still requires active job', async () => {
  const storage = ExtensionStorage.memory();
  const blobStore = new MemoryBlobStore();
  const controller = new LokaMediaController({ storage, blobStore });

  // Calling saveLocalFileCandidate without jobId fails closed
  const resNoJob = await controller.saveLocalFileCandidate({
    jobId: null,
    bytes: VALID_WEBP_BYTES,
    mime: 'image/webp',
    sha256: VALID_WEBP_SHA256
  });
  assert.equal(resNoJob.ok, false);
  assert.equal(resNoJob.error, 'INVALID_PAYLOAD');
});

// ---------------------------------------------------------------------------
// TEST D: Existing /media/upload still rejects published article with ARTICLE_NOT_DRAFT
// ---------------------------------------------------------------------------
test('D: Existing /media/upload still rejects published article with ARTICLE_NOT_DRAFT', async () => {
  const mockDb = createMockDb({
    articles: [
      [8, { id: 8, slug: 'thermal-bridge', status: 'published', content_hash: 'abc' }]
    ]
  });

  const form = new FormData();
  form.set('source_type', 'lokamedia_extension');
  form.set('job_id', 'mjob_draft_01');
  form.set('article_id', '8');
  form.set('role', 'featured');
  form.set('alt_text', 'Gambar draft');
  form.set('file', new Blob([VALID_WEBP_BYTES], { type: 'image/webp' }), 'test.webp');
  form.set('approval_record', JSON.stringify({
    job_id: 'mjob_draft_01',
    candidate_sha256: VALID_WEBP_SHA256,
    approval_source: 'operator_side_panel',
    approved_at: new Date().toISOString()
  }));

  const req = new Request('http://localhost:4321/api/internal/v1/media/upload', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test_device_token_secret_123',
      'X-RL-Device-Token': 'test_device_token_secret_123'
    },
    body: form
  });

  const res = await mediaUploadPost({
    request: req,
    locals: { db: mockDb, runtime: { env: { DB: mockDb, MEDIA_WRITE_KEY: 'test_device_token_secret_123' } } }
  });

  assert.equal(res.status, 409, 'Must return 409 Conflict for non-draft article');
  const payload = await res.json();
  assert.equal(payload.code, 'ARTICLE_NOT_DRAFT');
});

// ---------------------------------------------------------------------------
// TEST E: Slug resolves article and verifies content_hash
// ---------------------------------------------------------------------------
test('E: Slug resolves article and verifies content_hash', async () => {
  const mockDb = createMockDb({
    articles: [
      [8, {
        id: 8,
        slug: 'thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi',
        title: 'Thermal Bridge Kusen Aluminium',
        status: 'published',
        content_hash: '66094cf52d2d10650b82141adace0cedc27fc9a3f63ae1f85e19a57c38d4e260',
        featured_image: null,
        image_alt: null
      }]
    ]
  });

  const req = new Request('http://localhost:4321/api/internal/v1/media/articles/resolve?slug=thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi', {
    method: 'GET',
    headers: { Authorization: 'Bearer test_device_token_secret_123' }
  });

  const res = await resolveArticleGet({
    request: req,
    locals: { db: mockDb, runtime: { env: { DB: mockDb } } }
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'success');
  assert.equal(data.article.slug, 'thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi');
  assert.equal(data.article.status, 'published');
  assert.equal(data.article.content_hash, '66094cf52d2d10650b82141adace0cedc27fc9a3f63ae1f85e19a57c38d4e260');
});

// ---------------------------------------------------------------------------
// TEST F: Wrong expected content_hash blocks promotion
// ---------------------------------------------------------------------------
test('F: Wrong expected content_hash blocks promotion', async () => {
  const storage = ExtensionStorage.memory();
  const blobStore = new MemoryBlobStore();
  const controller = new LokaMediaController({ storage, blobStore });

  await storage.updateManualPromotionState({
    targetArticle: {
      id: 8,
      slug: 'thermal-bridge',
      status: 'published',
      content_hash: 'real_content_hash_111'
    },
    candidate: {
      blob_key: 'blob_test',
      sha256: VALID_WEBP_SHA256,
      mime: 'image/webp',
      width: 1315,
      height: 660,
      size: 100
    }
  });

  // Approving with mismatched expectedContentHash
  const approveRes = await controller.manualApprovePromotion({
    expectedContentHash: 'wrong_stale_hash_222',
    alt_text: 'Test alt text for Test F'
  });

  assert.equal(approveRes.ok, false);
  assert.equal(approveRes.error, 'CONTENT_HASH_MISMATCH');

  // Verify state approval remains null
  const state = await storage.getManualPromotionState();
  assert.equal(state.approval, null);
});

// ---------------------------------------------------------------------------
// TEST G: No upload occurs before explicit human approval
// ---------------------------------------------------------------------------
test('G: No upload occurs before explicit human approval', async () => {
  const storage = ExtensionStorage.memory();
  const blobStore = new MemoryBlobStore();
  let uploadCalled = false;

  const apiClient = {
    async uploadStandaloneMedia() {
      uploadCalled = true;
      return { ok: true };
    }
  };

  const controller = new LokaMediaController({ storage, blobStore, apiClient });

  await storage.updateManualPromotionState({
    targetArticle: { id: 8, slug: 'thermal-bridge', content_hash: 'hash' },
    candidate: { blob_key: 'blob_test', sha256: VALID_WEBP_SHA256, mime: 'image/webp' },
    approval: null, // NO APPROVAL
    stage: 'CANDIDATE_READY'
  });

  const execRes = await controller.manualExecutePromotion();
  assert.equal(execRes.ok, false);
  assert.equal(execRes.error, 'HUMAN_ADMIN_APPROVAL_REQUIRED');
  assert.equal(uploadCalled, false, 'No upload may occur without approval');
});

// ---------------------------------------------------------------------------
// TEST H: Same SHA retry is idempotent in standalone R2 upload
// ---------------------------------------------------------------------------
test('H: Same SHA retry is idempotent in standalone R2 upload', async () => {
  const mockDb = createMockDb({
    articles: [
      [8, { id: 8, slug: 'thermal-bridge', status: 'published', content_hash: 'hash_b' }]
    ]
  });
  const mockR2 = createMockR2();

  const issueRes = await issuePromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: 'thermal-bridge',
    expectedContentHash: 'hash_b',
    candidateSha256: VALID_WEBP_SHA256,
    slotKey: 'featured'
  });
  assert.equal(issueRes.success, true);
  const approval = issueRes.approvalReceipt;

  const createReq = () => {
    const form = new FormData();
    form.set('expected_sha256', VALID_WEBP_SHA256);
    form.set('human_approval', JSON.stringify(approval));
    form.set('file', new Blob([VALID_WEBP_BYTES], { type: 'image/webp' }), 'image.webp');
    return new Request('http://localhost:4321/api/internal/v1/media/assets/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer test_device_token_secret_123' },
      body: form
    });
  };

  // First upload
  const res1 = await standaloneUploadPost({
    request: createReq(),
    locals: { db: mockDb, runtime: { env: { DB: mockDb, MEDIA_BUCKET: mockR2 } } }
  });
  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.equal(data1.reused, false);
  assert.equal(data1.sha256, VALID_WEBP_SHA256);

  // Second upload with same SHA
  const res2 = await standaloneUploadPost({
    request: createReq(),
    locals: { db: mockDb, runtime: { env: { DB: mockDb, MEDIA_BUCKET: mockR2 } } }
  });
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.reused, true);
  assert.equal(data2.storage_key, data1.storage_key);
});

// ---------------------------------------------------------------------------
// TEST I: Duplicate active featured slot impossible
// ---------------------------------------------------------------------------
test('I: Duplicate active featured slot impossible', async () => {
  const mockDb = createMockDb({
    articles: [
      [8, { id: 8, slug: 'thermal-bridge', featured_image: 'https://old.png', image_alt: 'Old' }]
    ],
    assets: [
      ['ast_old', { id: 'ast_old', sha256: 'old_sha', public_url: 'https://old.png' }],
      ['ast_new', { id: 'ast_new', sha256: VALID_WEBP_SHA256, public_url: 'https://new.webp' }]
    ],
    articleMedia: [
      [101, { id: 101, article_id: 8, asset_id: 'ast_old', role: 'featured', slot_key: 'featured', is_active: 1 }]
    ]
  });

  const res = await attachArticleMedia({
    article_id: 8,
    asset_id: 'ast_new',
    role: 'featured',
    slot_key: 'featured',
    alt_text: 'New alt text',
    replace_active: true
  }, mockDb);

  assert.equal(res.status, 'success');

  // Check that old relation is now is_active = 0
  const oldRel = mockDb.articleMedia.get(101);
  assert.equal(oldRel.is_active, 0, 'Old active relation must be deactivated');

  // Count active featured slots
  let activeFeaturedCount = 0;
  for (const rel of mockDb.articleMedia.values()) {
    if (rel.article_id === 8 && rel.slot_key === 'featured' && rel.is_active === 1) {
      activeFeaturedCount++;
    }
  }
  assert.equal(activeFeaturedCount, 1, 'Exactly one active featured slot must exist');
});

// ---------------------------------------------------------------------------
// TEST J: Article content_hash/status/published_at unchanged
// ---------------------------------------------------------------------------
test('J: Article content_hash/status/published_at unchanged after attachment', async () => {
  const initialArticle = {
    id: 8,
    slug: 'thermal-bridge',
    status: 'published',
    content: '<p>Unchanged body</p>',
    content_hash: '66094cf52d2d10650b82141adace0cedc27fc9a3f63ae1f85e19a57c38d4e260',
    featured_image: null,
    image_alt: null,
    published_at: '2026-10-08T10:00:00Z',
    actual_published_at: '2026-10-08T10:00:00Z'
  };

  const mockDb = createMockDb({
    articles: [[8, { ...initialArticle }]],
    assets: [['ast_new', { id: 'ast_new', sha256: VALID_WEBP_SHA256, storage_key: 'media/images/new.webp' }]]
  });

  await attachArticleMedia({
    article_id: 8,
    asset_id: 'ast_new',
    role: 'featured',
    slot_key: 'featured',
    alt_text: 'Alt text',
    replace_active: true
  }, mockDb);

  const updated = mockDb.articles.get(8);
  assert.equal(updated.content, initialArticle.content);
  assert.equal(updated.content_hash, initialArticle.content_hash);
  assert.equal(updated.status, initialArticle.status);
  assert.equal(updated.published_at, initialArticle.published_at);
  assert.equal(updated.actual_published_at, initialArticle.actual_published_at);
  assert.equal(updated.featured_image, '/media/images/new.webp');
  assert.equal(updated.image_alt, 'Alt text');
});

// ---------------------------------------------------------------------------
// TEST K: Article A cannot be affected when Article B is target
// ---------------------------------------------------------------------------
test('K: Article A cannot be affected when Article B is target', async () => {
  const articleA = {
    id: 7,
    slug: 'jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge',
    featured_image: '/media/images/b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp',
    content_hash: '00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298'
  };
  const articleB = {
    id: 8,
    slug: 'thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi',
    featured_image: null,
    content_hash: '66094cf52d2d10650b82141adace0cedc27fc9a3f63ae1f85e19a57c38d4e260'
  };

  const mockDb = createMockDb({
    articles: [
      [7, { ...articleA }],
      [8, { ...articleB }]
    ],
    assets: [
      ['ast_A', { id: 'ast_A', public_url: articleA.featured_image }],
      ['ast_B', { id: 'ast_B', public_url: 'https://b.webp' }]
    ],
    articleMedia: [
      ['rel_A', { id: 'rel_A', article_id: 7, asset_id: 'ast_A', slot_key: 'featured', is_active: 1 }]
    ]
  });

  // Promote Article B
  await attachArticleMedia({
    article_id: 8,
    asset_id: 'ast_B',
    role: 'featured',
    slot_key: 'featured',
    replace_active: true
  }, mockDb);

  // Verify Article A is 100% untouched
  const finalA = mockDb.articles.get(7);
  assert.equal(finalA.featured_image, articleA.featured_image);
  assert.equal(finalA.content_hash, articleA.content_hash);
  const relA = mockDb.articleMedia.get('rel_A');
  assert.equal(relA.is_active, 1);
});

// ---------------------------------------------------------------------------
// TEST L: Device token never appears in audit export
// ---------------------------------------------------------------------------
test('L: Device token never appears in audit export', async () => {
  const storage = ExtensionStorage.memory();
  const SECRET_TOKEN = 'secret_bearer_token_xyz987';
  await storage.saveConfig({ deviceToken: SECRET_TOKEN });

  const events = [
    {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      event_code: 'MANUAL_PROMOTION_TARGET_RESOLVED',
      details: { slug: 'thermal-bridge', article_id: 8 }
    },
    {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      event_code: 'MANUAL_PROMOTION_APPROVAL_RECORDED',
      details: { candidate_sha256: VALID_WEBP_SHA256 }
    },
    {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      event_code: 'MANUAL_PROMOTION_COMPLETE',
      details: { asset_id: 'ast_123', storage_key: 'media/images/123.webp' }
    }
  ];

  for (const ev of events) {
    await storage.appendAuditEvent(ev);
  }

  const state = await storage.readState();
  const auditText = formatAuditText({ events, state });
  assert.equal(auditText.includes(SECRET_TOKEN), false, 'Audit text must never contain device token');

  const exportPayload = { events, last_action: state.auditLog.lastAction };
  const jsonString = JSON.stringify(exportPayload);
  assert.equal(jsonString.includes(SECRET_TOKEN), false, 'Audit JSON export must never contain device token');
});

// ---------------------------------------------------------------------------
// TEST M: Recovery from R2-success / register-failure
// ---------------------------------------------------------------------------
test('M: Recovery from R2-success / register-failure', async () => {
  const storage = ExtensionStorage.memory();
  const blobStore = new MemoryBlobStore();

  await blobStore.put({
    key: `manual_promo:${VALID_WEBP_SHA256}`,
    bytes: VALID_WEBP_BYTES,
    sha256: VALID_WEBP_SHA256
  });

  let uploadCount = 0;
  let registerCount = 0;
  let shouldFailRegister = true;

  const apiClient = {
    async uploadStandaloneMedia() {
      uploadCount++;
      return {
        ok: true,
        storage_key: `media/images/${VALID_WEBP_SHA256}.webp`,
        public_url: `https://rancangloka.com/media/images/${VALID_WEBP_SHA256}.webp`,
        sha256: VALID_WEBP_SHA256
      };
    },
    async registerAsset() {
      registerCount++;
      if (shouldFailRegister) {
        throw new Error('NETWORK_TIMEOUT_DURING_REGISTER');
      }
      return { ok: true, asset: { id: 'ast_recovered_123' } };
    },
    async attachArticleMedia() {
      return { ok: true, relation: { id: 'rel_123' } };
    }
  };

  const controller = new LokaMediaController({ storage, blobStore, apiClient });

  await storage.updateManualPromotionState({
    targetArticle: { id: 8, slug: 'thermal-bridge', content_hash: 'hash' },
    candidate: { blob_key: `manual_promo:${VALID_WEBP_SHA256}`, sha256: VALID_WEBP_SHA256, mime: 'image/webp', width: 1315, height: 660, size: 100 },
    approval: {
      article_slug: 'thermal-bridge',
      article_id: 8,
      expected_content_hash: 'hash',
      candidate_sha256: VALID_WEBP_SHA256,
      slot_key: 'featured'
    },
    stage: 'APPROVED',
    uploadedAsset: null
  });

  // Attempt 1: Fails at registration
  const res1 = await controller.manualExecutePromotion();
  assert.equal(res1.ok, false);
  assert.equal(res1.stage, 'OBJECT_UPLOADED_ASSET_REGISTRATION_PENDING');
  assert.equal(uploadCount, 1);
  assert.equal(registerCount, 1);

  // Verify storage has saved R2 upload result
  const midState = await storage.getManualPromotionState();
  assert.equal(midState.stage, 'OBJECT_UPLOADED_ASSET_REGISTRATION_PENDING');
  assert.equal(midState.uploadedAsset.storage_key, `media/images/${VALID_WEBP_SHA256}.webp`);

  // Attempt 2: Operator retries, registration succeeds, R2 upload is NOT repeated
  shouldFailRegister = false;
  const res2 = await controller.manualExecutePromotion();
  assert.equal(res2.ok, true);
  assert.equal(res2.status, 'COMPLETE');
  assert.equal(uploadCount, 1, 'R2 upload must not be repeated on retry');
  assert.equal(registerCount, 2);
});

// ---------------------------------------------------------------------------
// TEST N: Recovery from register-success / attach-failure
// ---------------------------------------------------------------------------
test('N: Recovery from register-success / attach-failure', async () => {
  const storage = ExtensionStorage.memory();
  const blobStore = new MemoryBlobStore();

  let uploadCount = 0;
  let registerCount = 0;
  let attachCount = 0;
  let shouldFailAttach = true;

  const apiClient = {
    async uploadStandaloneMedia() {
      uploadCount++;
      return { ok: true, storage_key: 'key', public_url: 'url', sha256: VALID_WEBP_SHA256 };
    },
    async registerAsset() {
      registerCount++;
      return { ok: true, asset: { id: 'ast_456' } };
    },
    async attachArticleMedia() {
      attachCount++;
      if (shouldFailAttach) {
        throw new Error('D1_LOCK_TIMEOUT_DURING_ATTACH');
      }
      return { ok: true, relation: { id: 'rel_456' } };
    }
  };

  const controller = new LokaMediaController({ storage, blobStore, apiClient });

  await storage.updateManualPromotionState({
    targetArticle: { id: 8, slug: 'thermal-bridge', content_hash: 'hash' },
    candidate: { blob_key: 'key', sha256: VALID_WEBP_SHA256, mime: 'image/webp', width: 1315, height: 660, size: 100 },
    approval: {
      article_slug: 'thermal-bridge',
      article_id: 8,
      expected_content_hash: 'hash',
      candidate_sha256: VALID_WEBP_SHA256,
      slot_key: 'featured'
    },
    uploadedAsset: { storage_key: 'key', public_url: 'url', sha256: VALID_WEBP_SHA256, asset_id: 'ast_456' },
    stage: 'ASSET_REGISTERED_ATTACHMENT_PENDING'
  });

  // Attempt 1: Fails at attachment
  const res1 = await controller.manualExecutePromotion();
  assert.equal(res1.ok, false);
  assert.equal(res1.stage, 'ASSET_REGISTERED_ATTACHMENT_PENDING');
  assert.equal(uploadCount, 0, 'No R2 upload needed');
  assert.equal(registerCount, 0, 'No registration needed');
  assert.equal(attachCount, 1);

  // Attempt 2: Operator retries attachment
  shouldFailAttach = false;
  const res2 = await controller.manualExecutePromotion();
  assert.equal(res2.ok, true);
  assert.equal(res2.status, 'COMPLETE');
  assert.equal(uploadCount, 0);
  assert.equal(registerCount, 0);
  assert.equal(attachCount, 2);
});

// ---------------------------------------------------------------------------
// TEST O: Negative Security: Upload without server approval fails closed
// ---------------------------------------------------------------------------
test('O: Negative Security: Upload without server approval fails closed', async () => {
  const mockDb = createMockDb({
    articles: [
      [8, { id: 8, slug: 'thermal-bridge', content_hash: 'hash_b' }]
    ]
  });
  const mockR2 = createMockR2();

  // Raw client-only approval without server approval receipt
  const clientOnlyApproval = {
    article_slug: 'thermal-bridge',
    article_id: 8,
    expected_content_hash: 'hash_b',
    candidate_sha256: VALID_WEBP_SHA256,
    slot_key: 'featured'
  };

  const form = new FormData();
  form.set('expected_sha256', VALID_WEBP_SHA256);
  form.set('human_approval', JSON.stringify(clientOnlyApproval));
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
  assert.equal(data.code, 'APPROVAL_ID_REQUIRED');
  assert.equal(mockR2.objects.size, 0, 'No R2 object should be created');
});

// ---------------------------------------------------------------------------
// TEST P: Negative Security: Candidate SHA mismatch fails closed
// ---------------------------------------------------------------------------
test('P: Negative Security: Candidate SHA mismatch fails closed', async () => {
  const mockDb = createMockDb({
    articles: [
      [8, { id: 8, slug: 'thermal-bridge', status: 'published', content_hash: 'hash_b' }]
    ]
  });
  const mockR2 = createMockR2();

  const fakeApprovedSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const issueRes = await issuePromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: 'thermal-bridge',
    expectedContentHash: 'hash_b',
    candidateSha256: fakeApprovedSha,
    slotKey: 'featured'
  });
  assert.equal(issueRes.success, true);

  // Attempt to upload real image (whose hash is VALID_WEBP_SHA256) using approval for fakeApprovedSha
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
  assert.equal(mockR2.objects.size, 0, 'Zero R2 objects created on SHA mismatch');
});

// ---------------------------------------------------------------------------
// TEST Q: Negative Security: Replaying consumed approval against another article fails closed
// ---------------------------------------------------------------------------
test('Q: Negative Security: Replaying consumed approval against another article fails closed', async () => {
  const mockDb = createMockDb({
    articles: [
      [8, { id: 8, slug: 'thermal-bridge', status: 'published', content_hash: 'hash_b' }],
      [9, { id: 9, slug: 'article-target-other', status: 'published', content_hash: 'hash_other' }]
    ]
  });
  const mockR2 = createMockR2();

  // 1. Issue approval for article 8
  const issueRes = await issuePromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: 'thermal-bridge',
    expectedContentHash: 'hash_b',
    candidateSha256: VALID_WEBP_SHA256,
    slotKey: 'featured'
  });
  assert.equal(issueRes.success, true);

  // 2. Consume it for article 8
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

  // 3. Replay against article 9
  const tamperedReceipt = {
    ...issueRes.approvalReceipt,
    article_slug: 'article-target-other',
    expected_content_hash: 'hash_other'
  };

  const form2 = new FormData();
  form2.set('expected_sha256', VALID_WEBP_SHA256);
  form2.set('human_approval', JSON.stringify(tamperedReceipt));
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

  // Must fail closed with 403 / 422
  assert.ok(res2.status >= 400);
});

// ---------------------------------------------------------------------------
// TEST R: LOKAMEDIA MANUAL LOCAL FILE INGEST FIX-1 (Regression Suite)
// ---------------------------------------------------------------------------

test('R.1: cloneBytes supports plain JS Array, TypedArrays, base64 data URLs, and fails on invalid bytes', () => {
  // A. Plain JS Array (as sent across chrome.runtime.sendMessage)
  const plainArray = [137, 80, 78, 71, 13, 10, 26, 10];
  const clonedFromArray = cloneBytes(plainArray);
  assert.equal(clonedFromArray instanceof ArrayBuffer, true);
  assert.equal(clonedFromArray.byteLength, 8);
  assert.deepEqual(Array.from(new Uint8Array(clonedFromArray)), plainArray);

  // B. Uint8Array view
  const u8 = new Uint8Array([1, 2, 3, 4]);
  const clonedFromU8 = cloneBytes(u8);
  assert.equal(clonedFromU8 instanceof ArrayBuffer, true);
  assert.equal(clonedFromU8.byteLength, 4);

  // C. Base64 data URL
  const base64Str = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAAQABAAEA==';
  const clonedFromDataUrl = cloneBytes(base64Str);
  assert.equal(clonedFromDataUrl instanceof ArrayBuffer, true);
  assert.ok(clonedFromDataUrl.byteLength > 0);

  // D. Unsupported type (null, undefined, invalid object)
  assert.throws(() => cloneBytes(null), /Unsupported blob bytes/);
  assert.throws(() => cloneBytes({ not: 'bytes' }), /Unsupported blob bytes/);
});

test('R.2: manualSetLocalFile processes plain JS Array of Canary WebP and never persists Blob/File in storage', async () => {
  const canaryPath = path.join(__dirname, '..', 'artifacts', 'human-canary-candidate-800x450.webp');
  const canaryBytes = fs.readFileSync(canaryPath);
  const canarySha = crypto.createHash('sha256').update(canaryBytes).digest('hex');
  assert.equal(canaryBytes.length, 5182);
  assert.equal(canarySha, 'fe52ca8268d320f2c15e9082766dc0bcfce5763603796b8cf590e27e2c3af07e');

  const storage = ExtensionStorage.memory();
  const blobStore = new MemoryBlobStore();
  const controller = new LokaMediaController({ storage, blobStore });

  // Convert to plain JS Array as produced by Array.from(new Uint8Array(arrayBuffer))
  const plainByteArray = Array.from(new Uint8Array(canaryBytes));

  const setRes = await controller.manualSetLocalFile({
    filename: 'human-canary-candidate-800x450.webp',
    bytes: plainByteArray,
    mime: 'image/webp',
    width: 800,
    height: 450,
    size: canaryBytes.length,
    sha256: canarySha,
    dataUrl: 'data:image/webp;base64,...'
  });

  assert.equal(setRes.ok, true);
  assert.equal(setRes.candidate.sha256, canarySha);
  assert.equal(setRes.candidate.filename, 'human-canary-candidate-800x450.webp');
  assert.equal(setRes.candidate.width, 800);
  assert.equal(setRes.candidate.height, 450);
  assert.equal(setRes.candidate.size, 5182);
  assert.equal(setRes.candidate.mime, 'image/webp');

  // Verify blobStore has the actual bytes stored as ArrayBuffer
  const storedBlob = await blobStore.get(setRes.candidate.blob_key);
  assert.ok(storedBlob);
  assert.equal(storedBlob.bytes.byteLength, 5182);
  const recomputedSha = crypto.createHash('sha256').update(new Uint8Array(storedBlob.bytes)).digest('hex');
  assert.equal(recomputedSha, canarySha);

  // Invariant: Zero Blob/File in chrome.storage.local
  const fullState = await storage.readState();
  const candidateInStorage = fullState.manualPromotionState.candidate;
  assert.ok(candidateInStorage);
  // Must be 100% JSON-serializable plain object
  const serialized = JSON.stringify(candidateInStorage);
  const roundtripped = JSON.parse(serialized);
  assert.deepEqual(candidateInStorage, roundtripped);
  assert.equal(candidateInStorage.constructor.name, 'Object');
  assert.equal(typeof candidateInStorage.blob_key, 'string');
  assert.equal(typeof candidateInStorage.sha256, 'string');

  // Invariant: Zero raw binary bytes in audit logs
  const auditEvents = fullState.auditLog.events;
  for (const ev of auditEvents) {
    if (ev.details) {
      assert.equal(ev.details.bytes, undefined, 'Audit log details must never contain binary bytes');
    }
  }
});

test('R.3: UI render & gate: Request Promotion Approval enables only after article + candidate valid', () => {
  const elements = new Map();
  function mockEl(id) {
    const el = {
      id,
      style: { display: 'none' },
      disabled: true,
      textContent: '',
      src: '',
      value: ''
    };
    elements.set(id, el);
    return el;
  }

  const ids = [
    'manual-promotion-card', 'manual-article-attestation', 'manual-article-title',
    'manual-article-status', 'manual-article-hash', 'manual-current-featured',
    'manual-candidate-preview-box', 'manual-preview-image', 'manual-candidate-filename',
    'manual-candidate-dimensions', 'manual-candidate-mime', 'manual-candidate-size',
    'manual-candidate-sha', 'manual-btn-approve', 'manual-btn-check-status',
    'manual-btn-execute', 'manual-status-banner'
  ];
  for (const id of ids) mockEl(id);

  const prevDoc = globalThis.document;
  globalThis.document = {
    querySelector: (sel) => {
      const cleanId = sel.replace(/^#/, '');
      return elements.get(cleanId) || null;
    }
  };

  try {
    const btnApprove = elements.get('manual-btn-approve');
    const previewBox = elements.get('manual-candidate-preview-box');

    // 1. Initial IDLE state: button disabled, preview hidden
    renderManualPromotion({ manualPromotionState: { stage: 'IDLE' } });
    assert.equal(btnApprove.disabled, true);
    assert.equal(previewBox.style.display, 'none');

    // 2. Article resolved but candidate NOT yet chosen: button still disabled
    const targetArticle = {
      id: 16,
      slug: 'lokamedia-manual-promotion-canary-human-local-only',
      title: 'Manual Canary Target',
      status: 'published',
      content_hash: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5'
    };
    renderManualPromotion({
      manualPromotionState: {
        stage: 'IDLE',
        targetArticle,
        candidate: null
      }
    });
    assert.equal(btnApprove.disabled, true);
    assert.equal(previewBox.style.display, 'none');

    // 3. Candidate selected with human canary details: button ENABLES and preview displays
    const validCandidate = {
      filename: 'human-canary-candidate-800x450.webp',
      blob_key: 'manual_promo:fe52ca8268d320f2c15e9082766dc0bcfce5763603796b8cf590e27e2c3af07e',
      sha256: 'fe52ca8268d320f2c15e9082766dc0bcfce5763603796b8cf590e27e2c3af07e',
      mime: 'image/webp',
      width: 800,
      height: 450,
      size: 5182,
      alt_text: 'Canary test valid alt text',
      data_url: 'data:image/webp;base64,canary_preview_data'
    };
    renderManualPromotion({
      manualPromotionState: {
        stage: 'CANDIDATE_READY',
        targetArticle,
        candidate: validCandidate
      }
    });
    assert.equal(btnApprove.disabled, false, 'Request Promotion Approval must be enabled when article + candidate are valid');
    assert.equal(btnApprove.textContent, 'Request Promotion Approval');
    assert.equal(previewBox.style.display, 'block');
    assert.equal(elements.get('manual-candidate-filename').textContent, 'human-canary-candidate-800x450.webp');
    assert.equal(elements.get('manual-candidate-dimensions').textContent, '800 × 450');
    assert.equal(elements.get('manual-candidate-mime').textContent, 'image/webp');
    assert.equal(elements.get('manual-candidate-size').textContent, '5,182 bytes');
    assert.equal(elements.get('manual-candidate-sha').textContent, 'fe52ca8268d320f2...');
    assert.equal(elements.get('manual-preview-image').src, 'data:image/webp;base64,canary_preview_data');

    // 4. Invalid candidate (zero dimensions or wrong mime): button remains disabled
    renderManualPromotion({
      manualPromotionState: {
        stage: 'CANDIDATE_READY',
        targetArticle,
        candidate: { ...validCandidate, width: 0, height: 0 }
      }
    });
    assert.equal(btnApprove.disabled, true, 'Zero dimension candidate must keep button disabled');

    // 5. Generation fallback cannot satisfy manual promotion gate
    renderManualPromotion({
      jobs: { 'job_gen_1': { status: 'COMPLETE', candidate: validCandidate } },
      manualPromotionState: {
        stage: 'IDLE',
        targetArticle,
        candidate: null
      }
    });
    assert.equal(btnApprove.disabled, true, 'Generation job state must not satisfy manual candidate gate');
  } finally {
    globalThis.document = prevDoc;
  }
});

test('R.4: Negative testing: unsupported mime and dimensions fail closed with actionable errors', async () => {
  const storage = ExtensionStorage.memory();
  const blobStore = new MemoryBlobStore();
  const controller = new LokaMediaController({ storage, blobStore });

  // 1. Unsupported mime
  const mimeRes = await controller.manualSetLocalFile({
    bytes: [1, 2, 3],
    mime: 'application/pdf',
    width: 800,
    height: 450,
    size: 3,
    sha256: 'abc'
  });
  assert.equal(mimeRes.ok, false);
  assert.equal(mimeRes.error, 'UNSUPPORTED_MIME');

  // 2. Invalid dimensions
  const dimRes = await controller.manualSetLocalFile({
    bytes: [1, 2, 3],
    mime: 'image/webp',
    width: 0,
    height: 450,
    size: 3,
    sha256: 'abc'
  });
  assert.equal(dimRes.ok, false);
  assert.equal(dimRes.error, 'INVALID_DIMENSIONS');

  // 3. Empty/null bytes
  const bytesRes = await controller.manualSetLocalFile({
    bytes: null,
    mime: 'image/webp',
    width: 800,
    height: 450,
    size: 0,
    sha256: 'abc'
  });
  assert.equal(bytesRes.ok, false);
  assert.equal(bytesRes.error, 'INVALID_PAYLOAD');
});

// ---------------------------------------------------------------------------
// TEST R.5: Exact real-browser symptom reproduction
// ---------------------------------------------------------------------------
test('R.5: Exact real-browser symptom reproduction: candidate card visibility, gate enablement, workflow isolation, and persistence', async () => {
  const prevDoc = globalThis.document;
  const elements = new Map();
  function fakeElement(id) {
    const el = {
      id,
      style: {},
      disabled: false,
      textContent: '',
      value: '',
      src: '',
      addEventListener: () => {}
    };
    elements.set(id, el);
    return el;
  }
  const domIds = [
    'manual-promotion-card',
    'manual-article-slug',
    'manual-btn-resolve',
    'manual-article-attestation',
    'manual-article-title',
    'manual-article-status',
    'manual-article-hash',
    'manual-current-featured',
    'manual-file-input',
    'manual-btn-select-file',
    'manual-candidate-preview-box',
    'manual-preview-image',
    'manual-candidate-filename',
    'manual-candidate-dimensions',
    'manual-candidate-mime',
    'manual-candidate-size',
    'manual-candidate-sha',
    'manual-alt-box',
    'manual-alt-text',
    'manual-status-banner',
    'manual-btn-approve',
    'manual-btn-check-status',
    'manual-btn-execute',
    'manual-btn-reset',
    'btn-select-file'
  ];
  for (const id of domIds) fakeElement(id);

  globalThis.document = {
    querySelector: (selector) => {
      const id = selector.replace(/^[#.]/, '');
      return elements.get(id) || null;
    }
  };

  try {
    const storage = ExtensionStorage.memory();
    const blobStore = new MemoryBlobStore();
    const apiClient = {
      resolveArticle: async (slug) => ({
        status: 'success',
        article: {
          id: 16,
          slug,
          title: 'Manual Canary Target',
          status: 'published',
          content_hash: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
          featured_image: null,
          image_alt: null
        }
      })
    };
    const controller = new LokaMediaController({ storage, blobStore, apiClient });

    // Pre-existing legacy generation job in storage with old candidate (bad12f70...)
    const legacyJobId = 'mjob_legacy_generation_01';
    await storage.upsertJob(legacyJobId, {
      status: 'COMPLETE',
      local_state: 'COMPLETE',
      article_id: 81,
      article_title: 'Legacy Article',
      sha256: 'bad12f705a150e4181be108def8e2cab4fb059f6916c2403f028524d82597235',
      width: 1672,
      height: 941,
      mime: 'image/png'
    });

    // A. Article resolved
    const resolveRes = await controller.manualResolveArticle({
      slug: 'lokamedia-manual-promotion-canary-human-local-only'
    });
    assert.equal(resolveRes.ok, true, 'Article must resolve successfully');
    assert.equal(resolveRes.article.id, 16);
    assert.equal(resolveRes.article.content_hash, 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5');

    // B. Manual file ingestion succeeds with real Canary WebP bytes
    const canaryPath = path.join(__dirname, '..', 'artifacts', 'human-canary-candidate-800x450.webp');
    const canaryBytes = Array.from(fs.readFileSync(canaryPath));
    assert.equal(canaryBytes.length, 5182);

    const ingestRes = await controller.manualSetLocalFile({
      filename: 'human-canary-candidate-800x450.webp',
      bytes: canaryBytes,
      mime: 'image/webp',
      width: 800,
      height: 450,
      size: 5182,
      sha256: 'fe52ca8268d320f2c15e9082766dc0bcfce5763603796b8cf590e27e2c3af07e',
      dataUrl: 'data:image/webp;base64,fe52ca_data_url'
    });
    assert.equal(ingestRes.ok, true, 'Manual file ingestion must succeed');
    assert.equal(ingestRes.candidate.sha256, 'fe52ca8268d320f2c15e9082766dc0bcfce5763603796b8cf590e27e2c3af07e');

    // C. Persisted manualPromotionState contains candidate
    const persistedState = await storage.getManualPromotionState();
    assert(persistedState, 'Persisted manualPromotionState must exist');
    assert(persistedState.candidate, 'Persisted manualPromotionState must contain candidate');
    assert.equal(persistedState.candidate.sha256, 'fe52ca8268d320f2c15e9082766dc0bcfce5763603796b8cf590e27e2c3af07e');
    assert.equal(persistedState.candidate.filename, 'human-canary-candidate-800x450.webp');
    assert.equal(persistedState.candidate.width, 800);
    assert.equal(persistedState.candidate.height, 450);
    assert.equal(persistedState.candidate.size, 5182);

    // Operator enters alt text
    await controller.manualSetAltText({ altText: 'Canary human acceptance test alt text' });

    // D. Side-panel refresh/hydration receives candidate
    const fullState = await storage.readState();
    renderManualPromotion(fullState);

    // E. Candidate card becomes visible
    const previewBox = elements.get('manual-candidate-preview-box');
    assert.equal(previewBox.style.display, 'block', 'Candidate preview card must become visible');

    // F. Displayed candidate is fe52ca82..., NOT stale bad12f70...
    assert.equal(elements.get('manual-candidate-filename').textContent, 'human-canary-candidate-800x450.webp');
    assert.equal(elements.get('manual-candidate-dimensions').textContent, '800 × 450');
    assert.equal(elements.get('manual-candidate-mime').textContent, 'image/webp');
    assert.equal(elements.get('manual-candidate-size').textContent, '5,182 bytes');
    assert.equal(elements.get('manual-candidate-sha').textContent, 'fe52ca8268d320f2...');
    assert.equal(elements.get('manual-preview-image').src, 'data:image/webp;base64,fe52ca_data_url');
    assert.notEqual(elements.get('manual-candidate-sha').textContent, 'bad12f705a150e41...');

    // G. Request Promotion Approval becomes enabled
    const btnApprove = elements.get('manual-btn-approve');
    assert.equal(btnApprove.disabled, false, 'Request Promotion Approval must be enabled');
    assert.equal(btnApprove.textContent, 'Request Promotion Approval');

    // H. Legacy generation candidate/state is unchanged
    const legacyJob = fullState.jobs[legacyJobId];
    assert.equal(legacyJob.sha256, 'bad12f705a150e4181be108def8e2cab4fb059f6916c2403f028524d82597235');
    assert.equal(legacyJob.status, 'COMPLETE');
    assert.equal(legacyJob.local_state, 'COMPLETE');

    // And saveLocalFileCandidate on legacy completed job fails closed
    const mutateAttempt = await controller.saveLocalFileCandidate({
      jobId: legacyJobId,
      bytes: canaryBytes,
      mime: 'image/webp',
      width: 800,
      height: 450,
      size: 5182,
      sha256: 'fe52ca8268d320f2c15e9082766dc0bcfce5763603796b8cf590e27e2c3af07e'
    });
    assert.equal(mutateAttempt.ok, false);
    assert.equal(mutateAttempt.error, 'CANNOT_MUTATE_COMPLETED_JOB');

    // I. Reloading side panel restores manual candidate card from persisted serializable state
    elements.get('manual-candidate-filename').textContent = '';
    elements.get('manual-candidate-dimensions').textContent = '';
    previewBox.style.display = 'none';
    btnApprove.disabled = true;

    const freshReadState = await storage.readState();
    renderManualPromotion(freshReadState);
    assert.equal(previewBox.style.display, 'block');
    assert.equal(elements.get('manual-candidate-filename').textContent, 'human-canary-candidate-800x450.webp');
    assert.equal(elements.get('manual-candidate-dimensions').textContent, '800 × 450');
    assert.equal(btnApprove.disabled, false);

    // J. Reset Manual Promotion clears only manual candidate state and does not touch legacy generation workflow
    const resetRes = await controller.manualResetPromotion();
    assert.equal(resetRes.ok, true);

    const postResetState = await storage.readState();
    assert.equal(postResetState.manualPromotionState, null);
    renderManualPromotion(postResetState);
    assert.equal(previewBox.style.display, 'none');
    assert.equal(btnApprove.disabled, true);

    // Legacy generation job remains untouched
    assert.equal(postResetState.jobs[legacyJobId].sha256, 'bad12f705a150e4181be108def8e2cab4fb059f6916c2403f028524d82597235');
    assert.equal(postResetState.jobs[legacyJobId].status, 'COMPLETE');
  } finally {
    globalThis.document = prevDoc;
  }
});

// ---------------------------------------------------------------------------
// TEST: Version alignment at 0.1.18
// ---------------------------------------------------------------------------
test('Version alignment at 0.1.18 across constants and manifest', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, '0.1.18');
  assert.equal(EXTENSION_VERSION, '0.1.18');
  assert.equal(EXPECTED_LOKAMEDIA_EXTENSION_VERSION, '0.1.18');
});
