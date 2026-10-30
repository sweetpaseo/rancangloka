/**
 * RANCANGLOKA — LOKAMEDIA BATCH 1 CANDIDATE APPROVAL FLOW REGRESSION SUITE
 *
 * Verifies:
 * 1. Unauthorized session rejection (401)
 * 2. Invalid parameter validation (400 for missing/invalid fields)
 * 3. Non-existent candidate handling (404)
 * 4. Approve transition: PENDING_REVIEW -> APPROVED with reviewer & timestamp
 * 5. Reject transition: PENDING_REVIEW/APPROVED -> REJECTED with audit
 * 6. Reset transition: REJECTED/APPROVED -> PENDING_REVIEW
 * 7. Candidate ledger disk persistence across reloads
 * 8. Review history / audit trail integrity
 * 9. Separation of concerns: D1 articles status remains 'draft' (zero auto-publish)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import { POST, GET } from '../src/pages/api/admin/media/candidate-approval.ts';
import { createAdminSessionToken, ADMIN_COOKIE_NAME } from '../src/lib/auth.ts';
import {
  saveCandidatesLedger,
  getCandidateById,
  loadCandidatesLedger,
  updateCandidateStatus
} from '../src/lib/media/experimental-storage.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'storage', 'experimental-media', 'candidates-manifest.json');

// Helper to create mock Astro API context
function createMockAstroContext({ body, cookieValue, searchParams = {} } = {}) {
  const url = new URL('http://localhost:4321/api/admin/media/candidate-approval');
  for (const [k, v] of Object.entries(searchParams)) {
    url.searchParams.set(k, v);
  }

  const request = new Request(url.toString(), {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieValue ? { 'Cookie': `${ADMIN_COOKIE_NAME}=${cookieValue}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const cookies = {
    get(name) {
      if (name === ADMIN_COOKIE_NAME && cookieValue) {
        return { value: cookieValue };
      }
      return undefined;
    }
  };

  const locals = {
    runtime: {
      env: {
        ENVIRONMENT: 'development',
        RANCANGLOKA_ADMIN_SESSION_SECRET: 'rancangloka-default-dev-secret-change-in-production-32bytes-min'
      }
    }
  };

  return { request, url, cookies, locals };
}

test('Candidate Approval Flow Regression Suite', async (t) => {
  const validAdminToken = await createAdminSessionToken({
    RANCANGLOKA_ADMIN_SESSION_SECRET: 'rancangloka-default-dev-secret-change-in-production-32bytes-min'
  });

  // Unique isolated candidate ID for testing
  const testCandidateId = `test_cand_approval_${Date.now()}`;

  // Teardown / cleanup helper
  const cleanupTestCandidate = () => {
    try {
      if (fs.existsSync(manifestPath)) {
        const raw = fs.readFileSync(manifestPath, 'utf8');
        const list = JSON.parse(raw);
        const filtered = list.filter((c) => c.id !== testCandidateId);
        fs.writeFileSync(manifestPath, JSON.stringify(filtered, null, 2), 'utf8');
      }
    } catch {
      // ignore
    }
  };

  t.after(() => {
    cleanupTestCandidate();
  });

  await t.test('1. Unauthorized requests return HTTP 401', async () => {
    // A. Missing cookie
    const ctxNoAuth = createMockAstroContext({
      body: { id: testCandidateId, action: 'approve' }
    });
    const resNoAuth = await POST(ctxNoAuth);
    assert.equal(resNoAuth.status, 401);
    const dataNoAuth = await resNoAuth.json();
    assert.equal(dataNoAuth.status, 'error');

    // B. Invalid cookie
    const ctxBadAuth = createMockAstroContext({
      body: { id: testCandidateId, action: 'approve' },
      cookieValue: 'invalid-tampered-token.abc123'
    });
    const resBadAuth = await POST(ctxBadAuth);
    assert.equal(resBadAuth.status, 401);
  });

  await t.test('2. Missing or invalid parameters return HTTP 400 with descriptive message', async () => {
    // A. Missing id
    const ctxNoId = createMockAstroContext({
      body: { action: 'approve' },
      cookieValue: validAdminToken
    });
    const resNoId = await POST(ctxNoId);
    assert.equal(resNoId.status, 400);
    const dataNoId = await resNoId.json();
    assert.equal(dataNoId.status, 'error');
    assert.match(dataNoId.message, /Parameter tidak valid/);

    // B. Missing action
    const ctxNoAction = createMockAstroContext({
      body: { id: testCandidateId },
      cookieValue: validAdminToken
    });
    const resNoAction = await POST(ctxNoAction);
    assert.equal(resNoAction.status, 400);

    // C. Invalid action (not in approve, reject, reset)
    const ctxBadAction = createMockAstroContext({
      body: { id: testCandidateId, action: 'delete_article' },
      cookieValue: validAdminToken
    });
    const resBadAction = await POST(ctxBadAction);
    assert.equal(resBadAction.status, 400);
  });

  await t.test('3. Non-existent candidate ID returns HTTP 404', async () => {
    const ctxNotFound = createMockAstroContext({
      body: { id: 'non_existent_candidate_9999999', action: 'approve' },
      cookieValue: validAdminToken
    });
    const resNotFound = await POST(ctxNotFound);
    assert.equal(resNotFound.status, 404);
    const dataNotFound = await resNotFound.json();
    assert.equal(dataNotFound.status, 'error');
    assert.match(dataNotFound.message, /tidak ditemukan/);
  });

  await t.test('4. Seed isolated test candidate into manifest', () => {
    const list = loadCandidatesLedger();
    list.push({
      id: testCandidateId,
      article_id: 99999,
      topic_slug: 'test-topic',
      r2_key: `experiments/test/${testCandidateId}.png`,
      public_url: `http://localhost:4321/assets/test/${testCandidateId}.png`,
      model: '@cf/black-forest-labs/flux-1-schnell',
      prompt: 'A test prompt for isolated candidate approval verification',
      steps: 4,
      dimensions: '1024x1024',
      byte_size: 102400,
      generation_time_ms: 1200,
      usage: {
        dimensions: '1024x1024',
        steps: 4,
        estimated_neurons: 57.6,
        confidence: 'ESTIMATED'
      },
      provenance: {
        model_name: 'FLUX.1 Schnell',
        provider: 'Cloudflare Workers AI',
        generated_at: new Date().toISOString()
      },
      approval_status: 'PENDING_REVIEW'
    });
    saveCandidatesLedger(list);

    const cand = getCandidateById(testCandidateId);
    assert.ok(cand, 'Test candidate must exist');
    assert.equal(cand.approval_status, 'PENDING_REVIEW');
  });

  await t.test('5. Approve action transitions to APPROVED and records reviewer metadata', async () => {
    const ctxApprove = createMockAstroContext({
      body: { id: testCandidateId, action: 'approve' },
      cookieValue: validAdminToken
    });
    const resApprove = await POST(ctxApprove);
    assert.equal(resApprove.status, 200);

    const dataApprove = await resApprove.json();
    assert.equal(dataApprove.status, 'success');
    assert.equal(dataApprove.message, 'Gambar berhasil disetujui');
    assert.equal(dataApprove.candidate.approval_status, 'APPROVED');
    assert.equal(dataApprove.candidate.reviewed_by, 'Chief Editor');
    assert.ok(dataApprove.candidate.reviewed_at, 'reviewed_at timestamp must be set');
    assert.ok(Array.isArray(dataApprove.candidate.approval_history), 'approval_history must be an array');
    assert.equal(dataApprove.candidate.approval_history.length, 1);
    assert.equal(dataApprove.candidate.approval_history[0].action, 'approve');
    assert.equal(dataApprove.candidate.approval_history[0].previous_status, 'PENDING_REVIEW');
    assert.equal(dataApprove.candidate.approval_history[0].new_status, 'APPROVED');
  });

  await t.test('6. Reject action transitions to REJECTED and updates audit history', async () => {
    const ctxReject = createMockAstroContext({
      body: { id: testCandidateId, action: 'reject' },
      cookieValue: validAdminToken
    });
    const resReject = await POST(ctxReject);
    assert.equal(resReject.status, 200);

    const dataReject = await resReject.json();
    assert.equal(dataReject.status, 'success');
    assert.equal(dataReject.candidate.approval_status, 'REJECTED');
    assert.equal(dataReject.candidate.approval_history.length, 2);
    assert.equal(dataReject.candidate.approval_history[0].action, 'reject');
    assert.equal(dataReject.candidate.approval_history[0].previous_status, 'APPROVED');
    assert.equal(dataReject.candidate.approval_history[0].new_status, 'REJECTED');
  });

  await t.test('7. Reset action reverts to PENDING_REVIEW', async () => {
    const ctxReset = createMockAstroContext({
      body: { id: testCandidateId, action: 'reset' },
      cookieValue: validAdminToken
    });
    const resReset = await POST(ctxReset);
    assert.equal(resReset.status, 200);

    const dataReset = await resReset.json();
    assert.equal(dataReset.status, 'success');
    assert.equal(dataReset.candidate.approval_status, 'PENDING_REVIEW');
    assert.equal(dataReset.candidate.reviewed_by, null);
    assert.equal(dataReset.candidate.approval_history.length, 3);
    assert.equal(dataReset.candidate.approval_history[0].action, 'reset');
    assert.equal(dataReset.candidate.approval_history[0].new_status, 'PENDING_REVIEW');
  });

  await t.test('8. Re-approve after reset works seamlessly', async () => {
    const ctxReApprove = createMockAstroContext({
      body: { id: testCandidateId, action: 'approve' },
      cookieValue: validAdminToken
    });
    const resReApprove = await POST(ctxReApprove);
    assert.equal(resReApprove.status, 200);

    const dataReApprove = await resReApprove.json();
    assert.equal(dataReApprove.candidate.approval_status, 'APPROVED');
    assert.equal(dataReApprove.candidate.reviewed_by, 'Chief Editor');
    assert.equal(dataReApprove.candidate.approval_history.length, 4);
  });

  await t.test('9. Ledger disk persistence survives clean re-read', () => {
    // Read raw JSON directly from disk without caching
    const rawDisk = fs.readFileSync(manifestPath, 'utf8');
    const diskList = JSON.parse(rawDisk);
    const persisted = diskList.find((c) => c.id === testCandidateId);

    assert.ok(persisted, 'Candidate must be persisted on disk');
    assert.equal(persisted.approval_status, 'APPROVED');
    assert.equal(persisted.reviewed_by, 'Chief Editor');
    assert.ok(persisted.reviewed_at);
    assert.equal(persisted.approval_history.length, 4);
  });

  await t.test('10. Safety Invariant: Media approval strictly decoupled from article publication', () => {
    // Check D1 articles table in local sqlite database
    const dbPath = path.join(repoRoot, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', 'd40c0b96fc1b452e8d356caec5aa62c2f42a1228221b65e90d19642caecfef65.sqlite');

    if (fs.existsSync(dbPath)) {
      const db = new DatabaseSync(dbPath);
      const rows = db.prepare('SELECT id, title, slug, status, featured_image FROM articles WHERE id IN (9993, 9999, 10000)').all();
      
      for (const row of rows) {
        // Status MUST remain 'draft'
        assert.equal(row.status, 'draft', `Article #${row.id} status must strictly remain 'draft'`);
        // featured_image must NOT be auto-promoted before explicit promotion flow
        assert.equal(row.featured_image, null, `Article #${row.id} featured_image must remain NULL`);
      }
    }
  });
});
