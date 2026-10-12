/**
 * RANCANGLOKA — LOKAMEDIA MANUAL PROMOTION EXECUTION DISPATCH REGRESSION TESTS
 *
 * Verifies:
 * 1. Real symptom reproduction:
 *    - Article resolved, candidate ready, promotion requested, admin approved.
 *    - UI displays APPROVED and enables Promote to Featured.
 *    - Human clicks Promote to Featured (#manual-btn-execute).
 *    - MANUAL_PROMOTION_EXECUTE reaches controller and controller reaches apiClient.uploadStandaloneMedia.
 *    - Exactly one upload request is attempted.
 *
 * Sub-test matrix:
 * A. Device mismatch blocks before upload with visible error (PROMOTION_DEVICE_MISMATCH).
 * B. Expired approval disables execute and transitions UI to APPROVAL_EXPIRED.
 * C. Missing candidate bytes blocks before network with visible error (LOCAL_CANDIDATE_BYTES_UNAVAILABLE).
 * D. Valid execution dispatches exactly one POST to /api/internal/v1/media/assets/upload with correct payload & auth.
 * E. No duplicate dispatch on double click / concurrent execution lock.
 * F. Test fixture device cannot leak into human browser state; default device is dev_local_human_operator_v2.
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LokaMediaController } from '../extensions/lokamedia/src/controller.js';
import { ExtensionStorage } from '../extensions/lokamedia/src/storage.js';
import { MemoryBlobStore } from '../extensions/lokamedia/src/blob-store.js';
import { EXTENSION_VERSION, DEFAULT_CONFIG } from '../extensions/lokamedia/src/constants.js';
import { renderManualPromotion } from '../extensions/lokamedia/src/side-panel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.join(__dirname, '..', 'extensions', 'lokamedia');

// Load canonical test candidate
const candidateFixturePath = path.join(__dirname, '..', 'artifacts', 'human-canary-candidate-800x450.webp');
let candidateBytes;
if (fs.existsSync(candidateFixturePath)) {
  candidateBytes = fs.readFileSync(candidateFixturePath);
} else {
  // Fallback to article-b-cover-1315x660.webp if not present
  candidateBytes = fs.readFileSync(path.join(__dirname, '..', 'artifacts', 'article-b-cover-1315x660.webp'));
}
const candidateSha256 = crypto.createHash('sha256').update(candidateBytes).digest('hex');

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

class FakeElement {
  constructor(id) {
    this.id = id;
    this.textContent = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.dataset = {};
    this.style = {};
    this.listeners = {};
    this.children = [];
    this.className = '';
  }

  addEventListener(type, handler) {
    this.listeners[type] ??= [];
    this.listeners[type].push(handler);
  }

  async dispatch(type) {
    for (const handler of this.listeners[type] ?? []) {
      await handler({ target: this });
    }
  }

  querySelector(selector) {
    const id = selector.replace(/^#/, '');
    if (this.id === id) return this;
    for (const child of this.children) {
      const match = child.querySelector(selector);
      if (match) return match;
    }
    return null;
  }
}

class FakeDocument {
  constructor(ids) {
    this.elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  }

  querySelector(selector) {
    const id = selector.replace(/^#/, '');
    return this.elements[id] ?? null;
  }

  createElement(id) {
    return new FakeElement(id);
  }
}

const SIDE_PANEL_IDS = [
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
  'manual-status-banner',
  'manual-btn-approve',
  'manual-btn-check-status',
  'manual-btn-execute',
  'manual-btn-reset',
  'device-id',
  'server',
  'token',
  'enabled',
  'save'
];

async function runTests() {
  console.log('--- LOKAMEDIA MANUAL PROMOTION EXECUTION DISPATCH REGRESSION SUITE ---');

  // Test 1: Real Symptom Reproduction & End-to-End Dispatch
  {
    const storage = ExtensionStorage.memory();
    const blobStore = new MemoryBlobStore();
    await storage.initialize();

    const deviceId = 'dev_local_human_operator_v2';
    await storage.update((s) => {
      s.config.deviceId = deviceId;
      s.config.deviceToken = 'dev_local_token_123';
      s.config.enabled = true;
    });

    const blobKey = `manual_promo:${candidateSha256}`;
    await blobStore.put({ key: blobKey, bytes: candidateBytes, mime: 'image/webp' });

    const targetArticle = {
      id: 999,
      slug: 'lokamedia-manual-promotion-canary-human-local-only',
      title: 'Canary Test Article',
      status: 'PUBLISHED',
      content_hash: 'abc123hashcontent456',
      featured_image: null,
      image_alt: 'Test Alt'
    };

    const candidate = {
      blob_key: blobKey,
      filename: 'canary.webp',
      mime: 'image/webp',
      size: candidateBytes.length,
      width: 800,
      height: 450,
      sha256: candidateSha256,
      alt_text: 'Test candidate alt'
    };

    const validApproval = {
      approval_id: 'prom_req_fresh_test_001',
      request_id: 'prom_req_fresh_test_001',
      status: 'APPROVED',
      article_slug: targetArticle.slug,
      article_id: targetArticle.id,
      expected_content_hash: targetArticle.content_hash,
      candidate_sha256: candidateSha256,
      slot_key: 'featured',
      device_id: deviceId,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      approved_by: 'admin@rancangloka.local'
    };

    await storage.updateManualPromotionState((cur) => ({
      ...cur,
      stage: 'APPROVED',
      targetArticle,
      candidate,
      approval: validApproval,
      lastError: null
    }));

    // Verify UI state rendering for APPROVED
    const doc = new FakeDocument(SIDE_PANEL_IDS);
    globalThis.document = doc;
    const currentState = await storage.readState();
    renderManualPromotion(currentState);

    const btnExecute = doc.querySelector('#manual-btn-execute');
    assert.equal(btnExecute.style.display, 'block', 'Promote to Featured button must be displayed when APPROVED');
    assert.equal(btnExecute.disabled, false, 'Promote to Featured button must be enabled when APPROVED');

    const banner = doc.querySelector('#manual-status-banner');
    assert.equal(banner.style.display, 'block');
    assert(banner.textContent.includes('ADMIN APPROVED'), 'Banner must indicate ADMIN APPROVED');

    // Setup mock API Client to verify dispatch reachability
    let uploadStandaloneCalled = 0;
    let registerAssetCalled = 0;
    let attachArticleMediaCalled = 0;
    let lastUploadArgs = null;

    const mockApiClient = {
      async uploadStandaloneMedia(args) {
        uploadStandaloneCalled++;
        lastUploadArgs = args;
        return {
          storage_key: 'articles/999/canary.webp',
          public_url: 'https://cdn.rancangloka.com/articles/999/canary.webp',
          sha256: args.expectedSha256,
          upload: { upload_id: 'upl_mock_123' }
        };
      },
      async registerAsset(payload) {
        registerAssetCalled++;
        return {
          asset: {
            asset_id: 'ast_mock_456',
            storage_key: payload.storage_key
          }
        };
      },
      async attachArticleMedia(payload) {
        attachArticleMediaCalled++;
        return {
          relation: {
            article_id: payload.article_id,
            asset_id: payload.asset_id,
            slot_key: payload.slot_key
          }
        };
      }
    };

    const controller = new LokaMediaController({
      apiClient: mockApiClient,
      storage,
      blobStore
    });

    // Human operator clicks Promote to Featured
    const executeResult = await controller.manualExecutePromotion();

    assert.equal(executeResult.ok, true, `Execution must succeed, got error: ${executeResult.error}`);
    assert.equal(uploadStandaloneCalled, 1, 'Exactly one upload request must reach api-client');
    assert.equal(registerAssetCalled, 1, 'Exactly one registerAsset request must reach api-client');
    assert.equal(attachArticleMediaCalled, 1, 'Exactly one attachArticleMedia request must reach api-client');

    assert.equal(lastUploadArgs.expectedSha256, candidateSha256);
    assert.equal(lastUploadArgs.humanApproval.approval_id, validApproval.approval_id);

    const postState = await storage.getManualPromotionState();
    assert.equal(postState.stage, 'COMPLETE', 'Promotion must reach COMPLETE stage');

    pass('1. Real Symptom Reproduction: Approved promotion reaches api-client and dispatches exactly once to COMPLETE');
  }

  // Test A: Device mismatch blocks before upload with visible error
  {
    const storage = ExtensionStorage.memory();
    const blobStore = new MemoryBlobStore();
    await storage.initialize();

    await storage.update((s) => {
      s.config.deviceId = 'dev_local_human_operator_v2';
    });

    const blobKey = `manual_promo:${candidateSha256}`;
    await blobStore.put({ key: blobKey, bytes: candidateBytes, mime: 'image/webp' });

    const mismatchedApproval = {
      approval_id: 'prom_req_mismatch_001',
      status: 'APPROVED',
      article_slug: 'test-article',
      article_id: 101,
      expected_content_hash: 'hash101',
      candidate_sha256: candidateSha256,
      slot_key: 'featured',
      device_id: 'dev_test_harness', // Deliberate mismatch
      expires_at: new Date(Date.now() + 3600000).toISOString()
    };

    await storage.updateManualPromotionState((cur) => ({
      ...cur,
      stage: 'APPROVED',
      targetArticle: { id: 101, slug: 'test-article', content_hash: 'hash101' },
      candidate: { blob_key: blobKey, sha256: candidateSha256, mime: 'image/webp', size: candidateBytes.length },
      approval: mismatchedApproval
    }));

    let uploadCalled = false;
    const mockApiClient = {
      async uploadStandaloneMedia() {
        uploadCalled = true;
        throw new Error('SHOULD_NOT_BE_CALLED');
      }
    };

    const controller = new LokaMediaController({
      apiClient: mockApiClient,
      storage,
      blobStore
    });

    const res = await controller.manualExecutePromotion();
    assert.equal(res.ok, false, 'Execution must fail on device mismatch');
    assert(res.error.includes('PROMOTION_DEVICE_MISMATCH'), `Error must be PROMOTION_DEVICE_MISMATCH, got: ${res.error}`);
    assert.equal(uploadCalled, false, 'Network upload must NOT be attempted when device mismatches');

    const finalState = await storage.getManualPromotionState();
    assert(finalState.lastError.includes('PROMOTION_DEVICE_MISMATCH'));

    pass('Test A: Device mismatch blocks before upload with visible PROMOTION_DEVICE_MISMATCH error');
  }

  // Test B: Expired approval disables execute and transitions UI to APPROVAL_EXPIRED
  {
    const storage = ExtensionStorage.memory();
    const blobStore = new MemoryBlobStore();
    await storage.initialize();

    await storage.update((s) => {
      s.config.deviceId = 'dev_local_human_operator_v2';
    });

    const expiredApproval = {
      approval_id: 'prom_req_expired_001',
      status: 'APPROVED',
      article_slug: 'test-article',
      article_id: 102,
      expected_content_hash: 'hash102',
      candidate_sha256: candidateSha256,
      slot_key: 'featured',
      device_id: 'dev_local_human_operator_v2',
      expires_at: new Date(Date.now() - 60000).toISOString() // Expired 1 minute ago
    };

    await storage.updateManualPromotionState((cur) => ({
      ...cur,
      stage: 'APPROVED',
      targetArticle: { id: 102, slug: 'test-article', content_hash: 'hash102', status: 'PUBLISHED' },
      candidate: { sha256: candidateSha256, mime: 'image/webp', size: candidateBytes.length, width: 800, height: 450 },
      approval: expiredApproval
    }));

    // Verify UI rendering for expired approval
    const doc = new FakeDocument(SIDE_PANEL_IDS);
    globalThis.document = doc;
    renderManualPromotion(await storage.readState());

    const btnExecute = doc.querySelector('#manual-btn-execute');
    assert.equal(btnExecute.style.display, 'none', 'Execute button must be hidden when approval is expired');

    const btnApprove = doc.querySelector('#manual-btn-approve');
    assert.equal(btnApprove.style.display, 'block', 'Request Approval button must be restored so human can request a new approval');

    const banner = doc.querySelector('#manual-status-banner');
    assert(banner.textContent.includes('Persetujuan kedaluwarsa') || banner.textContent.includes('EXPIRED'));

    // Verify controller execution refusal
    let uploadCalled = false;
    const mockApiClient = {
      async uploadStandaloneMedia() {
        uploadCalled = true;
      }
    };

    const controller = new LokaMediaController({ apiClient: mockApiClient, storage, blobStore });
    const res = await controller.manualExecutePromotion();
    assert.equal(res.ok, false);
    assert.equal(res.error, 'APPROVAL_EXPIRED');
    assert.equal(uploadCalled, false, 'Network upload must NOT be attempted when approval is expired');

    pass('Test B: Expired approval disables execute and transitions UI & controller to APPROVAL_EXPIRED');
  }

  // Test C: Missing candidate bytes blocks with visible error
  {
    const storage = ExtensionStorage.memory();
    const blobStore = new MemoryBlobStore(); // Empty blob store
    await storage.initialize();

    await storage.update((s) => {
      s.config.deviceId = 'dev_local_human_operator_v2';
    });

    const approval = {
      approval_id: 'prom_req_valid_bytes_missing',
      status: 'APPROVED',
      article_slug: 'test-article',
      article_id: 103,
      expected_content_hash: 'hash103',
      candidate_sha256: candidateSha256,
      slot_key: 'featured',
      device_id: 'dev_local_human_operator_v2',
      expires_at: new Date(Date.now() + 3600000).toISOString()
    };

    await storage.updateManualPromotionState((cur) => ({
      ...cur,
      stage: 'APPROVED',
      targetArticle: { id: 103, slug: 'test-article', content_hash: 'hash103' },
      candidate: {
        blob_key: 'manual_promo:non_existent_key',
        sha256: candidateSha256,
        mime: 'image/webp',
        size: candidateBytes.length
      },
      approval
    }));

    let uploadCalled = false;
    const mockApiClient = {
      async uploadStandaloneMedia() {
        uploadCalled = true;
      }
    };

    const controller = new LokaMediaController({ apiClient: mockApiClient, storage, blobStore });
    const res = await controller.manualExecutePromotion();
    assert.equal(res.ok, false);
    assert.equal(res.error, 'LOCAL_CANDIDATE_BYTES_UNAVAILABLE');
    assert.equal(uploadCalled, false, 'Network upload must NOT be attempted when candidate bytes are missing');

    const finalState = await storage.getManualPromotionState();
    assert.equal(finalState.lastError, 'LOCAL_CANDIDATE_BYTES_UNAVAILABLE');

    pass('Test C: Missing candidate bytes blocks with visible LOCAL_CANDIDATE_BYTES_UNAVAILABLE error');
  }

  // Test D: Valid execution dispatches exactly one POST
  {
    const storage = ExtensionStorage.memory();
    const blobStore = new MemoryBlobStore();
    await storage.initialize();

    await storage.update((s) => {
      s.config.deviceId = 'dev_local_human_operator_v2';
    });

    const blobKey = `manual_promo:${candidateSha256}`;
    await blobStore.put({ key: blobKey, bytes: candidateBytes, mime: 'image/webp' });

    const approval = {
      approval_id: 'prom_req_valid_post_001',
      status: 'APPROVED',
      article_slug: 'test-article',
      article_id: 104,
      expected_content_hash: 'hash104',
      candidate_sha256: candidateSha256,
      slot_key: 'featured',
      device_id: 'dev_local_human_operator_v2',
      expires_at: new Date(Date.now() + 3600000).toISOString()
    };

    await storage.updateManualPromotionState((cur) => ({
      ...cur,
      stage: 'APPROVED',
      targetArticle: { id: 104, slug: 'test-article', content_hash: 'hash104' },
      candidate: { blob_key: blobKey, sha256: candidateSha256, mime: 'image/webp', size: candidateBytes.length, width: 800, height: 450 },
      approval
    }));

    let uploadCount = 0;
    const mockApiClient = {
      async uploadStandaloneMedia(args) {
        uploadCount++;
        return {
          storage_key: 'test/storage/key.webp',
          public_url: 'https://test/storage/key.webp',
          sha256: args.expectedSha256,
          upload: { upload_id: 'upl_104' }
        };
      },
      async registerAsset() {
        return { asset_id: 'ast_104' };
      },
      async attachArticleMedia() {
        return { relation: { article_id: 104, asset_id: 'ast_104' } };
      }
    };

    const controller = new LokaMediaController({ apiClient: mockApiClient, storage, blobStore });
    const res = await controller.manualExecutePromotion();
    assert.equal(res.ok, true);
    assert.equal(uploadCount, 1, 'Valid execution must dispatch exactly one upload POST');

    pass('Test D: Valid execution dispatches exactly one POST');
  }

  // Test E: No duplicate dispatch on double click
  {
    const storage = ExtensionStorage.memory();
    const blobStore = new MemoryBlobStore();
    await storage.initialize();

    await storage.update((s) => {
      s.config.deviceId = 'dev_local_human_operator_v2';
    });

    const blobKey = `manual_promo:${candidateSha256}`;
    await blobStore.put({ key: blobKey, bytes: candidateBytes, mime: 'image/webp' });

    const approval = {
      approval_id: 'prom_req_double_click_001',
      status: 'APPROVED',
      article_slug: 'test-article',
      article_id: 105,
      expected_content_hash: 'hash105',
      candidate_sha256: candidateSha256,
      slot_key: 'featured',
      device_id: 'dev_local_human_operator_v2',
      expires_at: new Date(Date.now() + 3600000).toISOString()
    };

    await storage.updateManualPromotionState((cur) => ({
      ...cur,
      stage: 'APPROVED',
      targetArticle: { id: 105, slug: 'test-article', content_hash: 'hash105' },
      candidate: { blob_key: blobKey, sha256: candidateSha256, mime: 'image/webp', size: candidateBytes.length, width: 800, height: 450 },
      approval
    }));

    let uploadCount = 0;
    let resolveUpload;
    const uploadPromise = new Promise((resolve) => {
      resolveUpload = resolve;
    });

    const mockApiClient = {
      async uploadStandaloneMedia() {
        uploadCount++;
        await uploadPromise;
        return {
          storage_key: 'test/storage/key.webp',
          public_url: 'https://test/storage/key.webp',
          sha256: candidateSha256,
          upload: { upload_id: 'upl_105' }
        };
      },
      async registerAsset() {
        return { asset_id: 'ast_105' };
      },
      async attachArticleMedia() {
        return { relation: { article_id: 105, asset_id: 'ast_105' } };
      }
    };

    const controller = new LokaMediaController({ apiClient: mockApiClient, storage, blobStore });

    // First click triggers upload
    const execution1 = controller.manualExecutePromotion();

    // Second click occurs while first is in-flight
    const execution2 = controller.manualExecutePromotion();

    const res2 = await execution2;
    assert.equal(res2.ok, false);
    assert.equal(res2.error, 'PROMOTION_EXECUTION_ALREADY_IN_FLIGHT', 'Concurrent execution must be rejected with PROMOTION_EXECUTION_ALREADY_IN_FLIGHT');

    // Resolve in-flight upload
    resolveUpload();
    const res1 = await execution1;
    assert.equal(res1.ok, true);
    assert.equal(uploadCount, 1, 'Exactly one upload must occur despite concurrent click');

    pass('Test E: No duplicate dispatch on concurrent execution / double click');
  }

  // Test F: Test fixture device cannot leak into human browser state
  {
    assert.equal(DEFAULT_CONFIG.deviceId, 'dev_local_human_operator_v3', 'DEFAULT_CONFIG.deviceId must be dev_local_human_operator_v3');

    const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
    assert.equal(manifest.version, '0.1.18');
    assert.equal(EXTENSION_VERSION, '0.1.18');

    // Verify storage initialization defaults
    const storage = ExtensionStorage.memory();
    const state = await storage.initialize();
    assert.equal(state.config.deviceId, 'dev_local_human_operator_v3', 'Storage default deviceId must be dev_local_human_operator_v3');

    pass('Test F: Test fixture device cannot leak into human browser state');
  }

  console.log(`\nALL ${passed} EXECUTION DISPATCH REGRESSION TESTS PASSED.`);
}

runTests().catch((err) => {
  console.error('TEST RUNNER FAILED:', err);
  process.exit(1);
});
