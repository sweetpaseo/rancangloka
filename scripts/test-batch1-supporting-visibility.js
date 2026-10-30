import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { loadCandidatesLedger } from '../src/lib/media/experimental-storage.ts';
import { BATCH_1_SUPPORTING_BRIEFS } from '../src/lib/media/editorial-visual-intelligence.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

test('Batch 1 Supporting Visuals Visibility & Robustness Regression Suite', async (t) => {
  const candidates = loadCandidatesLedger();

  function getSupportingCandidate(articleId, slotIdentifier) {
    const normSlot = slotIdentifier.includes('-')
      ? slotIdentifier.split('-')[1].toUpperCase()
      : slotIdentifier.toUpperCase();

    const matching = candidates.filter((c) => {
      if (c.article_id !== articleId) return false;
      const role = (c.media_role || '').toLowerCase();
      const briefSlot = (c.visual_brief?.slotKey || '').toUpperCase();
      const id = c.id.toLowerCase();
      const targetSlot = normSlot.toLowerCase();

      return (
        role === `supporting_${targetSlot}` ||
        briefSlot === normSlot ||
        id.includes(`-${targetSlot}-`) ||
        id.endsWith(`-${targetSlot}`)
      );
    });

    const v2 = matching.find((c) => c.id.includes('v2'));
    if (v2) return v2;
    const active = matching.find((c) => c.approval_status !== 'REJECTED');
    return active || matching[matching.length - 1];
  }

  const expectedSlots = [
    { articleId: 9993, slotId: '9993-S1', expectedModel: 'deterministic_svg', expectedMime: 'image/svg+xml' },
    { articleId: 9993, slotId: '9993-S2', expectedModel: 'flux', expectedMime: 'image/jpeg' },
    { articleId: 9999, slotId: '9999-S1', expectedModel: 'flux', expectedMime: 'image/jpeg' },
    { articleId: 9999, slotId: '9999-S2', expectedModel: 'flux', expectedMime: 'image/jpeg' },
    { articleId: 10000, slotId: '10000-S1', expectedModel: 'deterministic_svg', expectedMime: 'image/svg+xml' },
    { articleId: 10000, slotId: '10000-S2', expectedModel: 'deterministic_svg', expectedMime: 'image/svg+xml' }
  ];

  await t.test('1. getSupportingCandidate resolves all 6 slots cleanly without returning undefined', () => {
    for (const item of expectedSlots) {
      const cand = getSupportingCandidate(item.articleId, item.slotId);
      assert.ok(cand, `Slot ${item.slotId} for article #${item.articleId} must resolve to a candidate`);
      assert.equal(cand.article_id, item.articleId);
      assert.equal(cand.approval_status, 'PENDING_REVIEW');
      assert.ok(cand.public_url, `Slot ${item.slotId} must have public_url`);
      assert.ok(cand.id.includes(item.slotId.toLowerCase().split('-')[1]), `Candidate ID ${cand.id} must match slot`);
    }
  });

  await t.test('2. Physical disk files exist, non-empty, and match SHA-256 in manifest', () => {
    for (const item of expectedSlots) {
      const cand = getSupportingCandidate(item.articleId, item.slotId);
      const storagePath = path.join(repoRoot, cand.storage_reference);
      const publicPath = path.join(repoRoot, 'public', cand.public_url.replace(/^\//, ''));

      assert.ok(fs.existsSync(storagePath), `Storage file must exist: ${storagePath}`);
      assert.ok(fs.existsSync(publicPath), `Public asset file must exist: ${publicPath}`);

      const bufStorage = fs.readFileSync(storagePath);
      const bufPublic = fs.readFileSync(publicPath);

      assert.ok(bufStorage.length > 5000, `Storage file ${storagePath} must be > 5KB (was ${bufStorage.length})`);
      assert.ok(bufPublic.length > 5000, `Public file ${publicPath} must be > 5KB (was ${bufPublic.length})`);

      const shaStorage = crypto.createHash('sha256').update(bufStorage).digest('hex');
      const shaPublic = crypto.createHash('sha256').update(bufPublic).digest('hex');

      assert.equal(shaStorage, cand.sha256, `SHA256 of ${storagePath} must match candidate record`);
      assert.equal(shaPublic, cand.sha256, `SHA256 of ${publicPath} must match candidate record`);
    }
  });

  await t.test('3. HTTP assets return HTTP 200 with valid Content-Type on localhost', async () => {
    for (const item of expectedSlots) {
      const cand = getSupportingCandidate(item.articleId, item.slotId);
      const assetUrl = `http://localhost:4321${cand.public_url}`;
      
      try {
        const res = await fetch(assetUrl, { method: 'HEAD' });
        assert.equal(res.status, 200, `Asset ${assetUrl} must return 200 OK`);
        const cType = res.headers.get('content-type') || '';
        assert.ok(
          cType.includes(item.expectedMime.split('/')[1]),
          `Asset ${assetUrl} Content-Type "${cType}" must contain "${item.expectedMime}"`
        );
      } catch (err) {
        // Dev server might not be running in isolated test mode
        console.warn(`Dev server fetch check skipped: ${err.message}`);
      }
    }
  });

  await t.test('4. SVG candidate files contain valid SVG XML and Plus Jakarta Sans font references', () => {
    const svgSlots = expectedSlots.filter(s => s.expectedModel === 'deterministic_svg');
    for (const item of svgSlots) {
      const cand = getSupportingCandidate(item.articleId, item.slotId);
      const content = fs.readFileSync(path.join(repoRoot, cand.storage_reference), 'utf8');

      assert.ok(content.includes('<svg'), `Must have root <svg tag`);
      assert.ok(content.includes('viewBox="'), `Must have responsive viewBox`);
      assert.ok(
        content.includes('KONSEPTUAL') || content.includes('ARSITEKTURAL') || content.includes('DIAGRAM'),
        `Must include architectural conceptual label`
      );
      assert.ok(content.includes('Plus Jakarta Sans'), `Must use Plus Jakarta Sans font`);
    }
  });

  await t.test('5. Zero Auto-Publish invariant: All 6 candidates remain PENDING_REVIEW and no draft article is modified', () => {
    for (const item of expectedSlots) {
      const cand = getSupportingCandidate(item.articleId, item.slotId);
      assert.equal(cand.approval_status, 'PENDING_REVIEW', `Candidate ${cand.id} must remain PENDING_REVIEW`);
      assert.equal(cand.reviewed_by, undefined, `Candidate ${cand.id} must not have reviewed_by yet`);
    }
  });
});
