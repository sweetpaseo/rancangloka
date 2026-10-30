/**
 * RancangLoka — Execute Batch 1 Canonical Media Promotion
 * Milestone: BATCH-1-CANONICAL-MEDIA-BINDING
 *
 * Runs controlled, idempotent canonical promotion and binding for human-approved
 * Batch 1 media assets against the local D1 SQLite database.
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  promoteApprovedCandidateToCanonical,
  promoteBatch1ApprovedMedia,
  normalizeDb
} from '../src/lib/media/candidate-promotion.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dbPath = path.resolve(
  rootDir,
  '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
);

console.log('======================================================================');
console.log('RANCANGLOKA — BATCH 1 CANONICAL MEDIA PROMOTION EXECUTION');
console.log('Target Database:', dbPath);
console.log('======================================================================\n');

const sqlite = new DatabaseSync(dbPath);
const db = normalizeDb(sqlite);

async function run() {
  const result = await promoteBatch1ApprovedMedia(db);

  console.log('--- Promoted Candidates (Count: ' + result.promoted.length + ') ---');
  for (const p of result.promoted) {
    console.log(`✓ Candidate: ${p.candidate_id}`);
    console.log(`  Asset ID:   ${p.asset_id}`);
    console.log(`  Article ID: ${p.article_id} (Slot: ${p.slot_key}, Role: ${p.role})`);
    console.log(`  Reused:     asset=${p.reused_asset}, attachment=${p.reused_attachment}`);
    console.log(`  ApprovedBy: ${p.provenance.approved_by} (${p.provenance.approved_at})`);
    console.log(`  URL:        ${p.public_url}\n`);
  }

  console.log('--- Skipped Candidates (Count: ' + result.skippedPending.length + ') ---');
  for (const s of result.skippedPending) {
    console.log(`⚠️ Candidate: ${s.candidateId} (Slot: ${s.slotKey})`);
    console.log(`   Reason:    ${s.reason}\n`);
  }

  if (result.errors.length > 0) {
    console.error('--- Errors (Count: ' + result.errors.length + ') ---');
    for (const e of result.errors) {
      console.error(`❌ Candidate ${e.candidateId}: ${e.error}`);
    }
  }

  // Verify resulting D1 state
  console.log('--- Verification of Canonical Database State ---');
  const articles = sqlite.prepare('SELECT id, slug, status, featured_image, image_alt FROM articles WHERE id IN (9993, 9999, 10000)').all();
  console.log('Articles:');
  for (const a of articles) {
    console.log(`  [ID ${a.id}] status=${a.status} | featured_image=${a.featured_image}`);
  }

  const mediaAssets = sqlite.prepare("SELECT asset_id, status, role, public_url, sha256 FROM media_assets WHERE role = 'ARTICLE_PUBLIC_DERIVATIVE'").all();
  console.log(`\nmedia_assets (ARTICLE_PUBLIC_DERIVATIVE count: ${mediaAssets.length}):`);
  for (const m of mediaAssets) {
    console.log(`  ${m.asset_id} [${m.status}] -> ${m.public_url}`);
  }

  const articleMedia = sqlite.prepare('SELECT am.id, am.article_id, am.slot_key, am.role, am.asset_id, am.is_active FROM article_media am WHERE am.article_id IN (9993, 9999, 10000)').all();
  console.log(`\narticle_media (Batch 1 bindings count: ${articleMedia.length}):`);
  for (const am of articleMedia) {
    console.log(`  [Article ${am.article_id}] slot=${am.slot_key} (role=${am.role}) -> ${am.asset_id} (active=${am.is_active})`);
  }
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
