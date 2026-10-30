/**
 * RancangLoka — Editorial Photo Text-Free Policy & Supporting Visual QA Test Suite
 *
 * Verifies:
 * 1. EDITORIAL_PHOTO_TEXT_FREE = TRUE permanent policy export and failure code taxonomy.
 * 2. Deterministic evaluation of text overlay, gibberish typography, watermarks, black boxes, UI elements.
 * 3. Exemption rules for technical diagrams and infographics.
 * 4. Retry classification policy (RETRY_WITH_REPROMPT from GENERATION).
 * 5. Candidate #9999-S1 v1 rejection status & exact reason.
 * 6. Candidate #9999-S1 v2 clean photo creation, SHA-256 checksum, and PENDING_REVIEW state.
 * 7. Invariants: Hero covers remain APPROVED, draft status immutable, zero auto-publish.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import {
  EDITORIAL_PHOTO_TEXT_FREE,
  MEDIA_QA_FAILURE_CODES,
  evaluateEditorialPhotoTextFree,
  evaluateMediaArtifact
} from '../src/lib/media/qa-service.ts';

import { decideMediaRetryPolicy } from '../src/lib/media/retry-policy.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const STORAGE_DIR = path.join(repoRoot, 'storage', 'experimental-media');
const PUBLIC_DIR = path.join(repoRoot, 'public', 'experimental-media');
const MANIFEST_PATH = path.join(STORAGE_DIR, 'candidates-manifest.json');
const D1_PATH = path.join(repoRoot, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', 'd027f67d4e3e3b33346d0a7f1c1f4e1f740e53a35f795db2b295325c79805d21.sqlite');

test('Editorial Photo Text-Free Policy & Supporting Visual QA Suite', async (t) => {
  // ---------------------------------------------------------------------------
  // TEST 1: Permanent Policy Constant & Taxonomy
  // ---------------------------------------------------------------------------
  await t.test('1. EDITORIAL_PHOTO_TEXT_FREE is exported as TRUE and failure codes are registered', () => {
    assert.equal(EDITORIAL_PHOTO_TEXT_FREE, true, 'EDITORIAL_PHOTO_TEXT_FREE must be explicitly true');

    const expectedCodes = [
      'TEXT_OVERLAY_DETECTED',
      'WATERMARK_DETECTED',
      'GIBBERISH_TYPOGRAPHY',
      'PRESENTATION_BOX_DETECTED',
      'ARTIFICIAL_UI_ELEMENTS',
      'UNWANTED_LABELS',
      'TEXT_IN_EDITORIAL_PHOTO'
    ];

    for (const code of expectedCodes) {
      assert.ok(MEDIA_QA_FAILURE_CODES[code], `MEDIA_QA_FAILURE_CODES must include ${code}`);
      assert.equal(MEDIA_QA_FAILURE_CODES[code], code);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 2: Deterministic QA Evaluation of Visual Artifacts
  // ---------------------------------------------------------------------------
  await t.test('2. evaluateEditorialPhotoTextFree flags all 6 visual defects and respects exemptions', () => {
    // A. Text Overlay
    const resText = evaluateEditorialPhotoTextFree(
      { media_role: 'supporting_photograph' },
      { hasTextOverlay: true, detectedTextSnippets: ['Random Presentation Text'] }
    );
    assert.equal(resText.decision, 'FAIL');
    assert.equal(resText.failure_code, MEDIA_QA_FAILURE_CODES.TEXT_OVERLAY_DETECTED);
    assert.equal(resText.retry_hint, 'RETRYABLE_WITH_REPROMPT');

    // B. Gibberish Typography
    const resGibberish = evaluateEditorialPhotoTextFree(
      { media_role: 'supporting_photograph' },
      { hasGibberishTypography: true }
    );
    assert.equal(resGibberish.decision, 'FAIL');
    assert.equal(resGibberish.failure_code, MEDIA_QA_FAILURE_CODES.GIBBERISH_TYPOGRAPHY);

    // C. Watermark
    const resWatermark = evaluateEditorialPhotoTextFree(
      { media_role: 'featured_hero' },
      { hasWatermark: true }
    );
    assert.equal(resWatermark.decision, 'FAIL');
    assert.equal(resWatermark.failure_code, MEDIA_QA_FAILURE_CODES.WATERMARK_DETECTED);

    // D. Presentation Box
    const resBox = evaluateEditorialPhotoTextFree(
      { media_role: 'supporting_photograph' },
      { hasPresentationBox: true }
    );
    assert.equal(resBox.decision, 'FAIL');
    assert.equal(resBox.failure_code, MEDIA_QA_FAILURE_CODES.PRESENTATION_BOX_DETECTED);

    // E. Artificial UI Elements
    const resUi = evaluateEditorialPhotoTextFree(
      { media_role: 'material_photograph' },
      { hasArtificialUi: true }
    );
    assert.equal(resUi.decision, 'FAIL');
    assert.equal(resUi.failure_code, MEDIA_QA_FAILURE_CODES.ARTIFICIAL_UI_ELEMENTS);

    // F. Unwanted Labels
    const resLabels = evaluateEditorialPhotoTextFree(
      { media_role: 'architectural_documentary_photograph' },
      { hasUnwantedLabels: true }
    );
    assert.equal(resLabels.decision, 'FAIL');
    assert.equal(resLabels.failure_code, MEDIA_QA_FAILURE_CODES.UNWANTED_LABELS);

    // G. Diagram Exemption (Technical diagrams/SVGs are permitted to have labels)
    const resDiagram = evaluateEditorialPhotoTextFree(
      { media_role: 'supporting_s1', isDiagramOrInfographic: true },
      { hasTextOverlay: true, hasUnwantedLabels: true }
    );
    assert.equal(resDiagram.decision, 'PASS');
    assert.equal(resDiagram.evidence.is_exempt, true);

    const resSvg = evaluateEditorialPhotoTextFree(
      { media_role: 'supporting_s1', media_type: 'image/svg+xml' },
      { hasTextOverlay: true }
    );
    assert.equal(resSvg.decision, 'PASS');
    assert.equal(resSvg.evidence.is_exempt, true);

    // H. Clean Photo requires human visual review gate
    const resClean = evaluateEditorialPhotoTextFree(
      { media_role: 'supporting_photograph' },
      { hasTextOverlay: false, hasWatermark: false }
    );
    assert.equal(resClean.decision, 'PASS');
    assert.equal(resClean.evidence.human_visual_review_required, true);
  });

  // ---------------------------------------------------------------------------
  // TEST 3: Retry Policy Classification for Text-Free Violations
  // ---------------------------------------------------------------------------
  await t.test('3. decideMediaRetryPolicy maps text-free violations to RETRY_WITH_REPROMPT', () => {
    const textViolations = [
      MEDIA_QA_FAILURE_CODES.TEXT_OVERLAY_DETECTED,
      MEDIA_QA_FAILURE_CODES.WATERMARK_DETECTED,
      MEDIA_QA_FAILURE_CODES.GIBBERISH_TYPOGRAPHY,
      MEDIA_QA_FAILURE_CODES.PRESENTATION_BOX_DETECTED,
      MEDIA_QA_FAILURE_CODES.ARTIFICIAL_UI_ELEMENTS,
      MEDIA_QA_FAILURE_CODES.UNWANTED_LABELS,
      MEDIA_QA_FAILURE_CODES.TEXT_IN_EDITORIAL_PHOTO
    ];

    for (const code of textViolations) {
      const decision = decideMediaRetryPolicy({
        failure_code: code,
        source_channel: 'AUTONOMOUS_PROVIDER',
        attempt_number: 1,
        max_attempts: 3
      });

      assert.equal(decision.retry_class, 'RETRY_WITH_REPROMPT', `Code ${code} must trigger RETRY_WITH_REPROMPT`);
      assert.equal(decision.retry_stage, 'GENERATION', `Code ${code} must retry from GENERATION stage`);
      assert.equal(decision.next_job_status, 'WAITING_RETRY');
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 4: Candidate #9999-S1 Versioning & Rejection Provenance
  // ---------------------------------------------------------------------------
  await t.test('4. Candidate #9999-S1 v1 is properly REJECTED and v2 is registered in PENDING_REVIEW', () => {
    assert.ok(fs.existsSync(MANIFEST_PATH), 'Manifest must exist');
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

    // Check v1
    const v1 = manifest.find((c) => (c.id || c.candidate_id) === 'candidate-9999-s1-meja-gantung-railing-flux');
    assert.ok(v1, 'Candidate #9999-S1 v1 must be preserved in manifest');
    assert.equal(v1.approval_status, 'REJECTED');
    assert.equal(v1.review_readiness, 'NEEDS_REGENERATION');
    assert.equal(
      v1.rejection_reason,
      'AI-generated text overlay and gibberish typography inside editorial photograph.'
    );

    // Check v2
    const v2 = manifest.find((c) => (c.id || c.candidate_id) === 'candidate-9999-s1-meja-gantung-railing-flux-v2');
    assert.ok(v2, 'Candidate #9999-S1 v2 must exist in manifest');
    assert.equal(v2.approval_status, 'PENDING_REVIEW');
    assert.equal(v2.review_readiness, 'READY_FOR_HUMAN_REVIEW');
    assert.equal(v2.article_id, 9999);
    assert.equal(v2.media_role, 'supporting_s1');
    assert.equal(v2.dimensions, '1024x1024');
    assert.ok(v2.prompt.includes('no text'), 'v2 prompt must include negative constraints');
    assert.ok(v2.negative_prompt.includes('no text'), 'v2 negative_prompt must include no text');

    // Verify physical file v2 in storage and public
    const storageFile = path.join(STORAGE_DIR, 'candidate-9999-s1-meja-gantung-railing-flux-v2.jpg');
    const publicFile = path.join(PUBLIC_DIR, 'candidate-9999-s1-meja-gantung-railing-flux-v2.jpg');

    assert.ok(fs.existsSync(storageFile), 'Storage file v2 must exist');
    assert.ok(fs.existsSync(publicFile), 'Public file v2 must exist');

    const bytes = fs.readFileSync(storageFile);
    assert.ok(bytes.length > 50000, 'File size must be substantial (>50KB)');
    const sha = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha, v2.sha256, 'SHA-256 in manifest must match physical file');
  });

  // ---------------------------------------------------------------------------
  // TEST 5: Invariant Decoupling & Article Immutability
  // ---------------------------------------------------------------------------
  await t.test('5. Zero Auto-Publish invariant: All articles remain in draft and hero covers remain APPROVED', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

    // Verify 3 Hero Covers remain APPROVED
    const covers = [
      { id: 'candidate-9993-flux-1-schnell-v3', articleId: 9993 },
      { id: 'candidate-9999-flux-1-schnell', articleId: 9999 },
      { id: 'candidate-10000-sdxl-lightning', articleId: 10000 }
    ];

    for (const cov of covers) {
      const item = manifest.find((c) => (c.id || c.candidate_id) === cov.id);
      assert.ok(item, `Cover candidate ${cov.id} must exist`);
      assert.equal(item.approval_status, 'APPROVED', `Cover ${cov.id} must remain APPROVED`);
      assert.equal(item.reviewed_by, 'Chief Editor', `Cover ${cov.id} must record Chief Editor`);
    }

    // Verify D1 Database articles
    if (fs.existsSync(D1_PATH)) {
      const db = new DatabaseSync(D1_PATH);
      const rows = db.prepare('SELECT id, title, slug, status, featured_image FROM articles WHERE id IN (9993, 9999, 10000)').all();
      for (const row of rows) {
        assert.equal(row.status, 'draft', `Article #${row.id} must remain in draft`);
        assert.equal(row.featured_image, null, `Article #${row.id} featured_image must remain null`);
      }
    }
  });
});
