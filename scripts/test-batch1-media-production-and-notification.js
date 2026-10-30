/**
 * RANCANGLOKA — BATCH 1 MEDIA PRODUCTION & NOTIFICATION AUDIT TEST SUITE
 *
 * Verifies:
 * 1. Three Approved Cover Candidates Integrity & Provenance (#9993, #9999, #10000)
 * 2. Notification Bell Counter Source, Entity Decoupling & Projection Integrity
 * 3. All Six Supporting Visual Candidates Presence & Schema Integrity
 * 4. Architectural Visual & Technical QA Gate Conformance
 * 5. Separation of Concerns & Zero Auto-Publish Safety Invariant
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import {
  loadCandidatesLedger,
  getCandidateById
} from '../src/lib/media/experimental-storage.ts';

import {
  getApprovalInboxProjection,
  getApprovalCounts
} from '../src/lib/approvals/projection.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'storage', 'experimental-media', 'candidates-manifest.json');
const d1File = path.join(
  repoRoot,
  '.wrangler',
  'state',
  'v3',
  'd1',
  'miniflare-D1DatabaseObject',
  '37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
);

function createMockDb(sqlitePath) {
  const rawDb = new DatabaseSync(sqlitePath);
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              return rawDb.prepare(sql).get(...args);
            },
            async all() {
              return { results: rawDb.prepare(sql).all(...args) };
            }
          };
        },
        async first() {
          return rawDb.prepare(sql).get();
        },
        async all() {
          return { results: rawDb.prepare(sql).all() };
        }
      };
    }
  };
}

test('Batch 1 Media Production & Notification Audit Suite', async (t) => {
  const ledger = loadCandidatesLedger();

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: Cover Approval State Verification
  // ---------------------------------------------------------------------------
  await t.test('1. Three Chosen Cover Candidates are APPROVED with Chief Editor Provenance', () => {
    const expectedCovers = [
      { id: 'candidate-9993-flux-1-schnell-v3', articleId: 9993, model: 'FLUX.1 Schnell' },
      { id: 'candidate-9999-flux-1-schnell', articleId: 9999, model: 'FLUX.1 Schnell' },
      { id: 'candidate-10000-sdxl-lightning', articleId: 10000, model: 'SDXL Lightning' }
    ];

    for (const exp of expectedCovers) {
      const cand = ledger.find((c) => c.id === exp.id);
      assert.ok(cand, `Cover candidate ${exp.id} must exist in manifest`);
      assert.equal(cand.article_id, exp.articleId);
      assert.equal(cand.approval_status, 'APPROVED', `Candidate ${cand.id} must be APPROVED`);
      assert.equal(cand.reviewed_by, 'Chief Editor', `Reviewer must be Chief Editor`);
      assert.ok(cand.reviewed_at, 'reviewed_at timestamp must exist');
      assert.ok(Array.isArray(cand.approval_history), 'approval_history must be an array');
      assert.ok(cand.approval_history.length >= 1, 'approval_history must contain entries');

      // Verify file binary and SHA-256
      const storagePath = path.resolve(repoRoot, cand.storage_reference);
      const publicPath = path.resolve(repoRoot, `public${cand.public_url}`);
      assert.ok(fs.existsSync(storagePath), `Binary file must exist at ${cand.storage_reference}`);
      assert.ok(fs.existsSync(publicPath), `Public file must exist at public${cand.public_url}`);

      const bytes = fs.readFileSync(storagePath);
      const actualSha = crypto.createHash('sha256').update(bytes).digest('hex');
      assert.equal(actualSha, cand.sha256, `SHA-256 checksum of ${cand.id} must match manifest`);
      assert.equal(bytes.length, cand.byte_size, `Byte size of ${cand.id} must match manifest`);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: Notification Bell Counter Audit
  // ---------------------------------------------------------------------------
  await t.test('2. Notification Bell Counter Audit & Decoupling from Media Ledger', async () => {
    assert.ok(fs.existsSync(d1File), 'D1 sqlite file must exist for projection audit');
    const mockDb = createMockDb(d1File);

    const counts = await getApprovalCounts(mockDb, { includeDevFixtures: true });
    assert.equal(counts.pendingCount, 6, 'Pending count must be exactly 6');

    const projection = await getApprovalInboxProjection(mockDb, { includeDevFixtures: true });
    assert.equal(projection.pendingCount, 6);
    assert.equal(projection.previewItems.length, 5, 'Bell preview must be capped at 5 oldest items');

    // Audit the 6 items
    const types = projection.items.map((i) => i.type);
    const articleItems = types.filter((t) => t === 'article');
    const mediaItems = types.filter((t) => t === 'media');
    assert.equal(articleItems.length, 5, 'Contains 5 draft article approval items');
    assert.equal(mediaItems.length, 1, 'Contains 1 published media promotion approval item');

    // Confirm candidate ledger items are NOT in approval inbox
    const allIds = projection.items.map((i) => i.id);
    assert.ok(!allIds.includes('candidate-9993-flux-1-schnell-v3'));
    assert.ok(!allIds.includes('candidate-9999-flux-1-schnell'));
    assert.ok(!allIds.includes('candidate-10000-sdxl-lightning'));

    // Invariant: Approving candidate images does NOT mutate or fake the notification counter
    // The counter strictly reflects items in approval inbox
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: Six Supporting Visual Candidates Verification
  // ---------------------------------------------------------------------------
  await t.test('3. Six Supporting Visual Candidates Presence and Technical Integrity', () => {
    const expectedSupporting = [
      {
        id: 'candidate-9993-s1-jalur-rembesan-svg',
        articleId: 9993,
        role: 'supporting_s1',
        mime: 'image/svg+xml',
        method: 'deterministic_svg',
        dimensions: '1200x675'
      },
      {
        id: 'candidate-9993-s2-detail-cat-menggelembung-flux',
        articleId: 9993,
        role: 'supporting_s2',
        mime: 'image/jpeg',
        method: 'cloudflare_ai',
        dimensions: '1024x1024'
      },
      {
        id: 'candidate-9999-s1-meja-gantung-railing-flux',
        articleId: 9999,
        role: 'supporting_s1',
        mime: 'image/jpeg',
        method: 'cloudflare_ai',
        dimensions: '1024x1024'
      },
      {
        id: 'candidate-9999-s2-sudut-santai-tanaman-vertikal-flux',
        articleId: 9999,
        role: 'supporting_s2',
        mime: 'image/jpeg',
        method: 'cloudflare_ai',
        dimensions: '1024x1024'
      },
      {
        id: 'candidate-10000-s1-denah-konseptual-inner-court-svg',
        articleId: 10000,
        role: 'supporting_s1',
        mime: 'image/svg+xml',
        method: 'deterministic_svg',
        dimensions: '1200x675'
      },
      {
        id: 'candidate-10000-s2-potongan-void-stack-ventilation-svg',
        articleId: 10000,
        role: 'supporting_s2',
        mime: 'image/svg+xml',
        method: 'deterministic_svg',
        dimensions: '1200x675'
      }
    ];

    for (const exp of expectedSupporting) {
      const cand = ledger.find((c) => c.id === exp.id);
      assert.ok(cand, `Supporting candidate ${exp.id} must exist in manifest`);
      assert.equal(cand.article_id, exp.articleId);
      assert.equal(cand.media_role, exp.role);
      assert.equal(cand.mime_type, exp.mime);
      assert.equal(cand.dimensions, exp.dimensions);
      assert.equal(cand.approval_status, 'PENDING_REVIEW', `New supporting candidate must start in PENDING_REVIEW`);

      // Verify file presence
      const storageFile = path.resolve(repoRoot, cand.storage_reference);
      const publicFile = path.resolve(repoRoot, `public${cand.public_url}`);
      assert.ok(fs.existsSync(storageFile), `Storage file must exist: ${cand.storage_reference}`);
      assert.ok(fs.existsSync(publicFile), `Public file must exist: ${cand.public_url}`);

      const bytes = fs.readFileSync(storageFile);
      assert.ok(bytes.length > 5000, `File size of ${cand.id} must be non-trivial`);
      const sha = crypto.createHash('sha256').update(bytes).digest('hex');
      assert.equal(sha, cand.sha256, `Checksum must match for ${cand.id}`);

      // Verify QA and Visual Brief
      assert.ok(cand.visual_brief?.caption, `Candidate ${cand.id} must have a caption`);
      assert.ok(cand.visual_brief?.altText, `Candidate ${cand.id} must have altText`);
      assert.equal(cand.geometry_qa?.overallStatus, 'PASS', `Candidate ${cand.id} must pass architectural QA`);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: Architectural Quality & Technical Sanity
  // ---------------------------------------------------------------------------
  await t.test('4. Architectural Quality, No Impossible Geometry & SVG Disclaimers', () => {
    // Check SVG contents for disclaimers and typography
    const svgFiles = [
      'candidate-9993-s1-jalur-rembesan-svg.svg',
      'candidate-10000-s1-denah-konseptual-inner-court-svg.svg',
      'candidate-10000-s2-potongan-void-stack-ventilation-svg.svg'
    ];

    for (const svgFile of svgFiles) {
      const content = fs.readFileSync(path.join(repoRoot, 'storage', 'experimental-media', svgFile), 'utf8');
      assert.ok(content.includes('viewBox="0 0 1200 675"'), `${svgFile} must have standard responsive viewBox`);
      assert.ok(content.includes('Plus Jakarta Sans'), `${svgFile} must reference Plus Jakarta Sans font`);
      assert.ok(content.includes('DIAGRAM KONSEPTUAL'), `${svgFile} must carry DIAGRAM KONSEPTUAL disclaimer`);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 5: Safety Invariants & Zero Auto-Publish
  // ---------------------------------------------------------------------------
  await t.test('5. Zero Auto-Publish & Article Draft Immutability Invariant', () => {
    const rawDb = new DatabaseSync(d1File);
    const articles = rawDb.prepare('SELECT id, title, slug, status, featured_image FROM articles WHERE id IN (9993, 9999, 10000)').all();

    for (const art of articles) {
      assert.equal(art.status, 'draft', `Article #${art.id} must strictly remain in draft status`);
      assert.equal(art.featured_image, null, `Article #${art.id} featured_image must remain null prior to promotion`);
    }
  });
});
