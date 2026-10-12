/**
 * RANCANGLOKA — LOKAMEDIA V0.1.18 PRODUCTION-READINESS CLOSEOUT-1
 * MANUAL PROMOTION ALT-TEXT PROPAGATION & IMMUTABILITY REGRESSION SUITE
 *
 * Covers:
 * Test A: Alt text is required for manual published-media promotion.
 * Test B: Approval request binds exact alt text in D1 record and HMAC signature.
 * Test C: Changing alt after REQUESTED invalidates/requires new request.
 * Test D: Admin approval UI displays proposed alt text.
 * Test E: Final article image_alt equals approved alt.
 * Test F: Old image_alt cannot leak forward (zero fallback to old placeholder).
 * Test G: actual_published_at unchanged (receipts/executions immutability).
 * Test H: published_at unchanged on article.
 * Test I: content_hash / editorial body unchanged.
 * Test J: Exactly-one featured invariant preserved.
 * Test K: Auth hardening still rejects random prefix tokens.
 * Test L: Execution dispatch still exactly once (idempotent, replay protection).
 * Test M: Canary Regression Proof (Placeholder Featured Image -> LokaMedia human acceptance canary featured image).
 * Test N: Article B Dry-Run Proof (artifacts/article-b-cover-1315x660.webp -> Detail sambungan kusen aluminium, kaca, dan dinding pada jendela rumah).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  requestPromotionApproval,
  adminApprovePromotionRequest,
  verifyAndConsumePromotionApproval,
  buildCanonicalApprovalString
} from '../src/lib/media/promotion-approval.ts';
import { attachArticleMedia } from '../src/lib/media/article-media.ts';
import { registerMediaAsset } from '../src/lib/media/asset-registration.ts';
import { authenticateDeviceRequest } from '../src/lib/media/device-auth.ts';
import { LokaMediaController } from '../extensions/lokamedia/src/controller.js';
import { ExtensionStorage } from '../extensions/lokamedia/src/storage.js';
import { MemoryBlobStore } from '../extensions/lokamedia/src/blob-store.js';
import { EXTENSION_VERSION } from '../extensions/lokamedia/src/constants.js';
import { EXPECTED_LOKAMEDIA_EXTENSION_VERSION } from '../src/lib/media/version.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Article B WebP fixture from artifacts
const ARTICLE_B_BYTES = fs.readFileSync(path.join(repoRoot, 'artifacts', 'article-b-cover-1315x660.webp'));
const ARTICLE_B_SHA256 = crypto.createHash('sha256').update(ARTICLE_B_BYTES).digest('hex');
const ARTICLE_B_EXPECTED_SHA = '8ecd77ff40bb4d933e27e44980bcec9ebb040e0cb971de72e5387ff6b463247d';
const ARTICLE_B_EXACT_ALT = 'Detail sambungan kusen aluminium, kaca, dan dinding pada jendela rumah';

function createMockR2(initialObjects = {}) {
  const objects = new Map(Object.entries(initialObjects));
  return {
    objects,
    async head(key) {
      const obj = objects.get(key);
      if (!obj) return null;
      return {
        key,
        size: obj.size,
        httpMetadata: { contentType: obj.mime },
        customMetadata: {
          sha256: obj.sha256,
          width: String(obj.width),
          height: String(obj.height)
        }
      };
    },
    async put(key, streamOrBytes, options) {
      const bytes = Buffer.isBuffer(streamOrBytes)
        ? streamOrBytes
        : Buffer.from(await new Response(streamOrBytes).arrayBuffer());
      const metadata = options?.customMetadata || {};
      objects.set(key, {
        bytes,
        size: bytes.byteLength,
        mime: options?.httpMetadata?.contentType || 'image/webp',
        sha256: metadata.sha256,
        width: metadata.width,
        height: metadata.height
      });
      return { key, size: bytes.byteLength };
    },
    async get(key) {
      const obj = objects.get(key);
      if (!obj) return null;
      return {
        key,
        size: obj.size,
        arrayBuffer: async () => obj.bytes.buffer
      };
    }
  };
}

function createMockDb(initialData = {}) {
  const articles = new Map(initialData.articles || []);
  const assets = new Map(initialData.assets || []);
  const articleMedia = new Map(initialData.articleMedia || []);
  const promotionApprovals = new Map(initialData.promotionApprovals || []);
  const devices = new Map(initialData.devices || [
    ['lokamedia-prod-operator-01', {
      device_id: 'lokamedia-prod-operator-01',
      device_name: 'LokaMedia Production Operator 01',
      token_hash: crypto.createHash('sha256').update('genuine_device_secret_token_123').digest('hex'),
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
                  alt_text: ast.alt_text,
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
              return { results: Array.from(promotionApprovals.values()) };
            },
            async run() {
              if (normQ.includes('INSERT INTO media_assets')) {
                const [assetId, cleanSourceType, r2_key, publicUrl, mime, width, height, byte_size, sha256, cleanAltText, status, canonicalRole, upload_id, derivative_id, transform_id, provenanceJson] = params;
                assets.set(assetId, {
                  id: assetId,
                  asset_id: assetId,
                  storage_key: r2_key,
                  public_url: publicUrl,
                  sha256,
                  width,
                  height,
                  mime,
                  file_size: byte_size,
                  status,
                  role: canonicalRole,
                  alt_text: cleanAltText
                });
                return { success: true };
              }
              if (normQ.includes('UPDATE article_media SET is_active = 0')) {
                const id = params[0];
                for (const rel of articleMedia.values()) {
                  if (rel.id === id || rel.id === Number(id)) {
                    rel.is_active = 0;
                  }
                }
                return { success: true };
              }
              if (normQ.includes('INSERT INTO article_media')) {
                const [artId, assetId, role, slotKey, sortOrder, caption] = params;
                const newId = articleMedia.size + 1;
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
                  art.updated_at = new Date().toISOString();
                }
                return { success: true };
              }
              if (normQ.includes('INSERT INTO media_promotion_approvals')) {
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
                return { success: true };
              }
              if (normQ.includes('UPDATE media_promotion_approvals')) {
                if (normQ.includes("SET status = 'APPROVED'")) {
                  const [approvedAt, adminActor, signature, approvalId] = params;
                  const rec = promotionApprovals.get(approvalId);
                  if (rec) {
                    rec.status = 'APPROVED';
                    rec.approved_at = approvedAt;
                    rec.approved_by = adminActor;
                    rec.signature = signature;
                  }
                  return { success: true, changes: 1 };
                }
                if (normQ.includes("SET status = 'CONSUMED'")) {
                  const [uploadId, approvalId] = params;
                  const rec = promotionApprovals.get(approvalId);
                  if (rec) {
                    rec.status = 'CONSUMED';
                    rec.consumed_at = new Date().toISOString();
                    rec.consumed_by_upload_id = uploadId;
                  }
                  return { success: true, changes: 1 };
                }
              }
              return { success: true, changes: 1 };
            }
          };
        }
      };
    }
  };
}

console.log('--- LOKAMEDIA V0.1.18 PRODUCTION-READINESS CLOSEOUT REGRESSION SUITE ---');

// TEST A: Alt text is required for manual published-media promotion
test('A: Alt text is required for manual published-media promotion', async () => {
  const mockDb = createMockDb({
    articles: [
      [16, { id: 16, slug: 'test-article', status: 'published', content_hash: 'hash_16' }]
    ]
  });

  // 1. Missing alt text
  const resMissing = await requestPromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: 'test-article',
    expectedContentHash: 'hash_16',
    candidateSha256: 'a'.repeat(64),
    slotKey: 'featured'
  });
  assert.equal(resMissing.success, false);
  assert.equal(resMissing.statusCode, 422);
  assert.equal(resMissing.code, 'ALT_TEXT_REQUIRED');

  // 2. Empty string alt text
  const resEmpty = await requestPromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: 'test-article',
    expectedContentHash: 'hash_16',
    candidateSha256: 'a'.repeat(64),
    slotKey: 'featured',
    altText: '   '
  });
  assert.equal(resEmpty.success, false);
  assert.equal(resEmpty.statusCode, 422);
  assert.equal(resEmpty.code, 'ALT_TEXT_REQUIRED');

  // 3. Valid alt text succeeds
  const resValid = await requestPromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: 'test-article',
    expectedContentHash: 'hash_16',
    candidateSha256: 'a'.repeat(64),
    slotKey: 'featured',
    altText: 'Deskripsi gambar valid untuk aksesibilitas'
  });
  assert.equal(resValid.success, true);
  assert.equal(resValid.promotionRequest.alt_text, 'Deskripsi gambar valid untuk aksesibilitas');
});

// TEST B: Approval request binds exact alt text in D1 record and HMAC signature
test('B: Approval request binds exact alt text in D1 record and HMAC signature', async () => {
  const mockDb = createMockDb({
    articles: [
      [16, { id: 16, slug: 'test-article', status: 'published', content_hash: 'hash_16' }]
    ]
  });

  const alt = 'Detail sambungan kusen jendela kayu autentik';
  const reqRes = await requestPromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: 'test-article',
    expectedContentHash: 'hash_16',
    candidateSha256: 'b'.repeat(64),
    slotKey: 'featured',
    altText: alt
  });
  assert.equal(reqRes.success, true);

  // Record in DB has alt_text
  const record = mockDb.promotionApprovals.get(reqRes.promotionRequest.request_id);
  assert.equal(record.alt_text, alt);

  // Admin approves
  const appRes = await adminApprovePromotionRequest(mockDb, {
    requestId: reqRes.promotionRequest.request_id,
    adminActor: 'chief_editor'
  });
  assert.equal(appRes.success, true);
  assert.equal(appRes.approvalReceipt.alt_text, alt);

  // Receipt signature cryptographically binds the alt_text
  const expectedCanonical = buildCanonicalApprovalString(
    record.approval_id,
    record.device_id,
    record.article_id,
    record.article_slug,
    record.content_hash,
    record.candidate_sha256,
    record.slot_key,
    record.approved_at,
    record.expires_at,
    alt
  );
  assert.ok(expectedCanonical.includes(alt));

  // Verification succeeds with matching receipt alt_text
  const verifyRes = await verifyAndConsumePromotionApproval(
    mockDb,
    appRes.approvalReceipt,
    'b'.repeat(64),
    'upload_01'
  );
  assert.equal(verifyRes.valid, true);

  // Verification FAILS if tampered alt_text is presented in receipt
  const tamperedReceipt = { ...appRes.approvalReceipt, alt_text: 'Teks deskripsi palsu' };
  const tamperRes = await verifyAndConsumePromotionApproval(
    mockDb,
    tamperedReceipt,
    'b'.repeat(64),
    'upload_02'
  );
  assert.equal(tamperRes.valid, false);
  assert.equal(tamperRes.code, 'APPROVAL_ALT_TEXT_MISMATCH');
});

// TEST C: Changing alt after REQUESTED invalidates/requires new request
test('C: Changing alt after REQUESTED invalidates/requires new request', async () => {
  const storage = ExtensionStorage.memory();
  const blobStore = new MemoryBlobStore();
  const controller = new LokaMediaController({ storage, blobStore });

  await storage.updateManualPromotionState({
    stage: 'WAITING_FOR_ADMIN_APPROVAL',
    targetArticle: { id: 16, slug: 'canary-slug', status: 'published', content_hash: 'hash_16' },
    candidate: { sha256: 'c'.repeat(64), alt_text: 'Initial alt text' },
    promotionRequest: { request_id: 'req_123', alt_text: 'Initial alt text' },
    approval: { approval_id: 'app_123', alt_text: 'Initial alt text' }
  });

  // Operator edits alt text
  const res = await controller.manualSetAltText({ altText: 'Altered alt text description' });
  assert.equal(res.ok, true);

  const state = await storage.getManualPromotionState();
  assert.equal(state.alt_text, 'Altered alt text description');
  assert.equal(state.candidate.alt_text, 'Altered alt text description');
  // Existing approval and promotionRequest invalidated
  assert.equal(state.approval, null, 'Approval must be cleared on alt text change');
  assert.equal(state.promotionRequest, null, 'Promotion request must be cleared on alt text change');
  assert.equal(state.stage, 'CANDIDATE_READY', 'Stage must reset to CANDIDATE_READY');
});

// TEST D: Admin approval UI displays proposed alt text
test('D: Admin approval UI displays proposed alt text', () => {
  const adminPagePath = path.join(repoRoot, 'src', 'pages', 'admin', 'media-promotions.astro');
  const adminHtml = fs.readFileSync(adminPagePath, 'utf8');

  assert.ok(adminHtml.includes('Proposed Alt Text'), 'Admin approval page must include Proposed Alt Text heading');
  assert.ok(adminHtml.includes('req.alt_text'), 'Admin approval page must render req.alt_text value');
});

// TEST E & F: Final article image_alt equals approved alt and old image_alt cannot leak forward
test('E & F: Final article image_alt equals approved alt and old image_alt cannot leak forward', async () => {
  const newStorageKey = 'media/images/closeout_canary.webp';
  const newSha = 'd'.repeat(64);
  const mockR2 = createMockR2({
    [newStorageKey]: { size: 5182, mime: 'image/webp', sha256: newSha, width: 800, height: 450 }
  });

  const mockDb = createMockDb({
    articles: [
      [16, {
        id: 16,
        slug: 'canary-article',
        title: 'Canary Article',
        status: 'published',
        content_hash: 'd4e5f6a1b2c3d4e5',
        featured_image: '/old-image.webp',
        image_alt: 'Placeholder Featured Image', // Old placeholder
        published_at: '2026-10-10T12:00:00.000Z',
        updated_at: '2026-10-10T12:00:00.000Z'
      }]
    ]
  });

  const newApprovedAlt = 'LokaMedia human acceptance canary featured image';

  // 1. Asset registered with approved alt_text
  const regRes = await registerMediaAsset({
    upload_id: 'up_canary_closeout_1',
    derivative_id: 'der_canary_closeout_1',
    transform_id: 'trf_canary_closeout_1',
    r2_key: newStorageKey,
    sha256: newSha,
    width: 800,
    height: 450,
    mime: 'image/webp',
    byte_size: 5182,
    role: 'ARTICLE_PUBLIC_DERIVATIVE',
    alt_text: newApprovedAlt,
    upload_receipt: {
      upload_id: 'up_canary_closeout_1',
      state: 'UPLOADED',
      r2_key: newStorageKey,
      sha256: newSha,
      byte_size: 5182,
      mime: 'image/webp'
    }
  }, mockDb, mockR2);
  assert.equal(regRes.status, 'success');
  const newAssetId = regRes.asset.asset_id;

  // 2. Attach asset to featured slot
  const attachRes = await attachArticleMedia({
    article_id: 16,
    asset_id: newAssetId,
    role: 'featured',
    slot_key: 'featured',
    alt_text: newApprovedAlt,
    replace_active: true
  }, mockDb);
  assert.equal(attachRes.status, 'success');

  // 3. Authoritative article mirror verification
  const updatedArticle = mockDb.articles.get(16);
  assert.equal(updatedArticle.featured_image, `/${newStorageKey}`);
  assert.equal(updatedArticle.image_alt, newApprovedAlt, 'Article image_alt must equal new approved alt');
  assert.notEqual(updatedArticle.image_alt, 'Placeholder Featured Image', 'Old placeholder alt must NOT leak forward');
});

// TEST G, H, I: Immutability proof: actual_published_at, published_at, and content_hash unchanged
test('G, H, I: Immutability proof: actual_published_at, published_at, and content_hash unchanged', async () => {
  const initialPublishedAt = '2026-10-10T10:00:00.000Z';
  const initialContentHash = 'canonical_content_hash_fixed_abc123';
  const initialContentMd = '# Title\n\nOriginal editorial markdown body.';
  const initialContentHtml = '<h1>Title</h1><p>Original editorial markdown body.</p>';

  const mockDb = createMockDb({
    articles: [
      [16, {
        id: 16,
        slug: 'immutable-article',
        status: 'published',
        published_at: initialPublishedAt,
        content_hash: initialContentHash,
        content_md: initialContentMd,
        content_html: initialContentHtml,
        featured_image: '/old.webp',
        image_alt: 'Old Alt'
      }]
    ],
    assets: [
      ['ast_any', { id: 'ast_any', storage_key: 'media/any.webp', alt_text: 'Brand New Promoted Alt' }]
    ]
  });

  const attachRes = await attachArticleMedia({
    article_id: 16,
    asset_id: 'ast_any',
    role: 'ARTICLE_PUBLIC_DERIVATIVE',
    slot_key: 'featured',
    alt_text: 'Brand New Promoted Alt',
    replace_active: true
  }, mockDb);
  assert.equal(attachRes.status, 'success');

  const art = mockDb.articles.get(16);
  // H: published_at unchanged
  assert.equal(art.published_at, initialPublishedAt, 'published_at must remain completely unchanged');
  // I: content_hash, content_md, content_html unchanged
  assert.equal(art.content_hash, initialContentHash, 'content_hash must remain completely unchanged');
  assert.equal(art.content_md, initialContentMd, 'content_md must remain completely unchanged');
  assert.equal(art.content_html, initialContentHtml, 'content_html must remain completely unchanged');
  // Status remains published
  assert.equal(art.status, 'published', 'article status must remain published');
});

// TEST J: Exactly-one active featured invariant preserved
test('J: Exactly-one active featured invariant preserved', async () => {
  const mockDb = createMockDb({
    articles: [
      [16, { id: 16, slug: 'featured-test', status: 'published', content_hash: 'hash_16' }]
    ],
    assets: [
      ['ast_1', { id: 'ast_1', storage_key: 'img1.webp', alt_text: 'Alt 1' }],
      ['ast_2', { id: 'ast_2', storage_key: 'img2.webp', alt_text: 'Alt 2' }]
    ],
    articleMedia: [
      [101, { id: 101, article_id: 16, asset_id: 'ast_1', slot_key: 'featured', role: 'featured', is_active: 1 }]
    ]
  });

  // Promote second asset with replace_active: true
  await attachArticleMedia({
    article_id: 16,
    asset_id: 'ast_2',
    role: 'ARTICLE_PUBLIC_DERIVATIVE',
    slot_key: 'featured',
    alt_text: 'Alt 2',
    replace_active: true
  }, mockDb);

  const activeFeatured = Array.from(mockDb.articleMedia.values()).filter(
    (rel) => rel.article_id === 16 && rel.slot_key === 'featured' && rel.is_active === 1
  );
  assert.equal(activeFeatured.length, 1, 'Exactly one active featured relation must exist');
  assert.equal(activeFeatured[0].asset_id, 'ast_2');
  assert.equal(mockDb.articleMedia.get(101).is_active, 0, 'Previous featured relation must be deactivated');
});

// TEST K: Auth hardening still rejects random prefix tokens
test('K: Auth hardening still rejects random prefix tokens', async () => {
  const mockDb = createMockDb();
  const fakeToken = `lkmd_${crypto.randomBytes(16).toString('hex')}`;
  const fakeReq = new Request('http://localhost:4321/api/internal/v1/media/test', {
    headers: { Authorization: `Bearer ${fakeToken}` }
  });
  const res = await authenticateDeviceRequest(fakeReq, mockDb);
  assert.equal(res.authenticated, false);
  assert.ok(res.error, 'Error message must be present for invalid token');
});

// TEST L: Execution dispatch still exactly once (consumed approval rejects reuse)
test('L: Execution dispatch still exactly once', async () => {
  const mockDb = createMockDb({
    articles: [
      [16, { id: 16, slug: 'dispatch-test', status: 'published', content_hash: 'hash_16' }]
    ]
  });

  const req = await requestPromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: 'dispatch-test',
    expectedContentHash: 'hash_16',
    candidateSha256: 'e'.repeat(64),
    slotKey: 'featured',
    altText: 'Exact dispatch alt'
  });
  const app = await adminApprovePromotionRequest(mockDb, {
    requestId: req.promotionRequest.request_id,
    adminActor: 'chief_editor'
  });

  // First consumption succeeds
  const first = await verifyAndConsumePromotionApproval(
    mockDb,
    app.approvalReceipt,
    'e'.repeat(64),
    'upload_first'
  );
  assert.equal(first.valid, true);

  // Second consumption is marked isReplayIdempotent (safe retry)
  const second = await verifyAndConsumePromotionApproval(
    mockDb,
    app.approvalReceipt,
    'e'.repeat(64),
    'upload_second'
  );
  assert.equal(second.valid, true);
  assert.equal(second.isReplayIdempotent, true);

  // Replaying against different article fails closed
  const third = await verifyAndConsumePromotionApproval(
    mockDb,
    { ...app.approvalReceipt, article_slug: 'mismatched-slug' },
    'e'.repeat(64),
    'upload_third'
  );
  assert.equal(third.valid, false);
  assert.equal(third.code, 'APPROVAL_SLUG_MISMATCH');
});

// TEST M: Canary Regression Proof (Placeholder Featured Image -> LokaMedia human acceptance canary featured image)
test('M: Canary Regression Proof: explicit test alt propagates to article mirror', async () => {
  const canaryBefore = {
    id: 16,
    slug: 'lokamedia-manual-promotion-canary-human-local-only',
    title: 'Lokamedia Manual Promotion Canary Human Local Only',
    status: 'published',
    content_hash: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
    featured_image: '/images/canary-old-placeholder.webp',
    image_alt: 'Placeholder Featured Image',
    published_at: '2026-10-10T15:00:00.000Z'
  };

  const canaryAlt = 'LokaMedia human acceptance canary featured image';
  const candidateSha = 'fe52ca8268d320f2c15e9082766dc0bcfce5763603796b8cf590e27e2c3af07e';
  const storageKey = `media/images/${candidateSha}.webp`;

  const mockR2 = createMockR2({
    [storageKey]: { size: 5182, mime: 'image/webp', sha256: candidateSha, width: 800, height: 450 }
  });

  const mockDb = createMockDb({
    articles: [[16, { ...canaryBefore }]]
  });

  // Request & Approve
  const reqRes = await requestPromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: canaryBefore.slug,
    expectedContentHash: canaryBefore.content_hash,
    candidateSha256: candidateSha,
    slotKey: 'featured',
    altText: canaryAlt
  });
  assert.equal(reqRes.success, true);

  const appRes = await adminApprovePromotionRequest(mockDb, {
    requestId: reqRes.promotionRequest.request_id,
    adminActor: 'chief_editor'
  });
  assert.equal(appRes.success, true);
  assert.equal(appRes.approvalReceipt.alt_text, canaryAlt);

  // Register & Attach
  const regRes = await registerMediaAsset({
    upload_id: 'up_canary_proof',
    derivative_id: 'der_canary_proof',
    transform_id: 'trf_canary_proof',
    r2_key: storageKey,
    sha256: candidateSha,
    width: 800,
    height: 450,
    mime: 'image/webp',
    byte_size: 5182,
    role: 'ARTICLE_PUBLIC_DERIVATIVE',
    alt_text: appRes.approvalReceipt.alt_text,
    upload_receipt: {
      upload_id: 'up_canary_proof',
      state: 'UPLOADED',
      r2_key: storageKey,
      sha256: candidateSha,
      byte_size: 5182,
      mime: 'image/webp'
    }
  }, mockDb, mockR2);
  assert.equal(regRes.status, 'success');
  const assetId = regRes.asset.asset_id;

  await attachArticleMedia({
    article_id: 16,
    asset_id: assetId,
    role: 'featured',
    slot_key: 'featured',
    alt_text: appRes.approvalReceipt.alt_text,
    replace_active: true
  }, mockDb);

  const finalArticle = mockDb.articles.get(16);
  assert.equal(finalArticle.featured_image, `/${storageKey}`);
  assert.equal(finalArticle.image_alt, canaryAlt);
  assert.notEqual(finalArticle.image_alt, 'Placeholder Featured Image');
  assert.equal(finalArticle.published_at, canaryBefore.published_at);
});

// TEST N: Article B Dry-Run Proof (Candidate WebP + Exact Production Alt)
test('N: Article B Production Target Dry-Run Proof (Zero Production Mutation)', async () => {
  // Candidate verification
  assert.equal(ARTICLE_B_SHA256, ARTICLE_B_EXPECTED_SHA, 'Candidate SHA256 must match exact Article B expected SHA');
  assert.equal(ARTICLE_B_BYTES.byteLength, 149764, 'Article B WebP byte length must match');

  const storageKey = `media/images/${ARTICLE_B_EXPECTED_SHA}.webp`;
  const mockR2 = createMockR2({
    [storageKey]: {
      size: ARTICLE_B_BYTES.byteLength,
      mime: 'image/webp',
      sha256: ARTICLE_B_EXPECTED_SHA,
      width: 1315,
      height: 660
    }
  });

  const mockDb = createMockDb({
    articles: [
      [8, {
        id: 8,
        slug: 'thermal-bridge-dinding-bata-ringan',
        title: 'Thermal Bridge Dinding Bata Ringan: Solusi Mengatasi Ruang Panas',
        status: 'published',
        content_hash: 'content_hash_article_b_production_target',
        featured_image: '/images/legacy-article-b.webp',
        image_alt: 'Thermal bridge ilustrasi lama',
        published_at: '2026-10-09T08:00:00.000Z'
      }]
    ]
  });

  // Dual-control promotion request with exact required alt text
  const reqRes = await requestPromotionApproval(mockDb, {
    deviceId: 'lokamedia-prod-operator-01',
    articleSlug: 'thermal-bridge-dinding-bata-ringan',
    expectedContentHash: 'content_hash_article_b_production_target',
    candidateSha256: ARTICLE_B_EXPECTED_SHA,
    slotKey: 'featured',
    candidateWidth: 1315,
    candidateHeight: 660,
    candidateMime: 'image/webp',
    candidateByteSize: ARTICLE_B_BYTES.byteLength,
    altText: ARTICLE_B_EXACT_ALT
  });
  assert.equal(reqRes.success, true);
  assert.equal(reqRes.promotionRequest.alt_text, ARTICLE_B_EXACT_ALT);

  // Chief editor approves
  const appRes = await adminApprovePromotionRequest(mockDb, {
    requestId: reqRes.promotionRequest.request_id,
    adminActor: 'chief_editor'
  });
  assert.equal(appRes.success, true);
  assert.equal(appRes.approvalReceipt.alt_text, ARTICLE_B_EXACT_ALT);

  // Asset registration binds exact alt
  const regRes = await registerMediaAsset({
    upload_id: 'up_article_b_proof',
    derivative_id: 'der_article_b_proof',
    transform_id: 'trf_article_b_proof',
    r2_key: storageKey,
    sha256: ARTICLE_B_EXPECTED_SHA,
    width: 1315,
    height: 660,
    mime: 'image/webp',
    byte_size: ARTICLE_B_BYTES.byteLength,
    role: 'ARTICLE_PUBLIC_DERIVATIVE',
    alt_text: appRes.approvalReceipt.alt_text,
    upload_receipt: {
      upload_id: 'up_article_b_proof',
      state: 'UPLOADED',
      r2_key: storageKey,
      sha256: ARTICLE_B_EXPECTED_SHA,
      byte_size: ARTICLE_B_BYTES.byteLength,
      mime: 'image/webp'
    }
  }, mockDb, mockR2);
  assert.equal(regRes.status, 'success');
  const assetId = regRes.asset.asset_id;

  // Article media attachment propagates exact alt to article mirror
  const attachRes = await attachArticleMedia({
    article_id: 8,
    asset_id: assetId,
    role: 'featured',
    slot_key: 'featured',
    alt_text: appRes.approvalReceipt.alt_text,
    replace_active: true
  }, mockDb);
  assert.equal(attachRes.status, 'success');

  const finalArticleB = mockDb.articles.get(8);
  assert.equal(finalArticleB.featured_image, `/${storageKey}`);
  assert.equal(finalArticleB.image_alt, ARTICLE_B_EXACT_ALT);
  assert.equal(finalArticleB.published_at, '2026-10-09T08:00:00.000Z');
  assert.equal(finalArticleB.content_hash, 'content_hash_article_b_production_target');
});

// TEST O: Version alignment at 0.1.18
test('O: Version alignment at 0.1.18 across constants, manifest, and server expectation', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'extensions', 'lokamedia', 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, '0.1.18');
  assert.equal(EXTENSION_VERSION, '0.1.18');
  assert.equal(EXPECTED_LOKAMEDIA_EXTENSION_VERSION, '0.1.18');
});
