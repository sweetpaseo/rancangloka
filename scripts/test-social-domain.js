/**
 * RancangLoka — SOCIAL-S1: Social Media Automation Pipeline Test Suite
 *
 * Systematically tests all 17 canonical domain criteria:
 *  1. Campaign creation from valid SUCCESS publication receipt provenance
 *  2. Rejection of non-existent publication receipt provenance
 *  3. Rejection of non-success publication receipt provenance
 *  4. Duplicate campaign prevention for same publication receipt
 *  5. Platform variant creation with deterministic payload hashing
 *  6. Duplicate active platform variant prevention in same campaign
 *  7. State machine valid transitions (campaign, variant, outbox)
 *  8. State machine invalid transitions fail closed with explicit reason
 *  9. Approval requirement before scheduling outbox item
 * 10. Cryptographic approval invalidation when caption text is mutated
 * 11. Cryptographic approval invalidation when media assets are mutated
 * 12. Staging outbox scheduling with valid approval payload matching
 * 13. Duplicate outbox scheduling prevention
 * 14. SOCIAL_AUTOMATION = OFF enforces zero dispatch eligibility
 * 15. Cancellation and blocking lifecycle behavior
 * 16. Execution receipt recording and campaign completion
 * 17. Telemetry observable shape compatibility and UNKNOWN handling
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  createCampaignFromPublishedReceipt,
  createPostVariant,
  updateVariantDraft,
  submitVariantForQA,
  approveVariant,
  scheduleVariantToOutbox,
  cancelVariant,
  markVariantBlocked,
  recordExecutionReceipt,
  getSocialOutboxSnapshot,
  getSocialDomainTelemetry,
  getCampaignById,
  getVariantById
} from '../src/lib/social/service.ts';

import {
  validateCampaignTransition,
  validateVariantTransition,
  validateOutboxTransition
} from '../src/lib/social/state-machine.ts';

import {
  computeVariantPayloadHash,
  verifyVariantApprovalValidity
} from '../src/lib/social/approval.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`✗ [FAIL] ${message}`);
    failed++;
  }
}

/**
 * Creates in-memory SQLite database matching production D1 with all migrations through 0026.
 */
function createSocialTestDb() {
  const sqlite = new DatabaseSync(':memory:');

  // Base schema
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  // Seed baseline author & category
  sqlite.exec(`
    INSERT OR REPLACE INTO authors (id, name, slug, bio, avatar, role)
    VALUES (1, 'RancangLoka Editorial Desk', 'dewan-redaksi-spasial', 'Dewan redaksi arsitektur.', '/avatar.png', 'Editorial Desk');

    INSERT OR REPLACE INTO categories (id, name, slug, description)
    VALUES (1, 'Tata Ruang & Denah', 'interior-design', 'Panduan tata ruang');
  `);

  // Apply relevant prior migrations
  const migrations = [
    '0002_article_ingest_receipts.sql',
    '0005_media_assets_and_article_media.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql',
    '0008_publication_planner.sql',
    '0009_publication_publisher.sql',
    '0026_social_domain_and_outbox.sql'
  ];

  for (const mig of migrations) {
    const migPath = path.resolve(process.cwd(), `db/migrations/${mig}`);
    if (fs.existsSync(migPath)) {
      const sql = fs.readFileSync(migPath, 'utf-8');
      sqlite.exec(sql);
    }
  }

  // Seed sample published article and execution receipt for testing provenance
  sqlite.exec(`
    INSERT INTO articles (id, title, slug, content_md, content_html, description, author_id, category_id, status, content_hash)
    VALUES (
      101,
      'Desain Dinding Roster untuk Ventilasi Tropis',
      'desain-dinding-roster-tropis',
      '# Desain Dinding Roster\n\nVentilasi alami tanpa mengorbankan privasi...',
      '<h1>Desain Dinding Roster</h1><p>Ventilasi alami tanpa mengorbankan privasi...</p>',
      'Panduan material dan pola dinding roster hunian tropis.',
      1,
      1,
      'published',
      'hash_art_101_content'
    );

    INSERT INTO article_publication_readiness (id, article_id, is_ready, overall_status, content_hash, snapshot_json)
    VALUES (1, 101, 1, 'READY_TO_SCHEDULE', 'hash_art_101_content', '{}');

    INSERT INTO article_publication_plans (id, plan_id, article_id, readiness_id, target_publish_at, target_publish_local, timezone, plan_status, planner_profile, priority_score, slot_index, reason_codes, content_hash, featured_asset_id)
    VALUES (
      1,
      'plan_101_test',
      101,
      1,
      '2026-10-01 10:00:00',
      '2026-10-01 17:00:00 WIB',
      'Asia/Jakarta',
      'PLANNED',
      'GROWING',
      100.0,
      1,
      '["TEST"]',
      'hash_art_101_content',
      'asset_roster_cover'
    ),
    (
      2,
      'plan_102_test',
      101,
      1,
      '2026-10-01 10:00:00',
      '2026-10-01 17:00:00 WIB',
      'Asia/Jakarta',
      'CANCELLED',
      'GROWING',
      100.0,
      2,
      '["TEST"]',
      'hash_art_101_content',
      'asset_roster_cover'
    );

    INSERT INTO article_publication_executions (id, execution_id, plan_id, article_id, content_hash, featured_asset_id, target_publish_at, execution_status)
    VALUES (
      1,
      'pexec_101_test',
      'plan_101_test',
      101,
      'hash_art_101_content',
      'asset_roster_cover',
      '2026-10-01 10:00:00',
      'PUBLISHED'
    );

    INSERT INTO article_publication_executions (id, execution_id, plan_id, article_id, content_hash, featured_asset_id, target_publish_at, execution_status)
    VALUES (
      2,
      'pexec_102_failed',
      'plan_102_test',
      101,
      'hash_art_101_content',
      'asset_roster_cover',
      '2026-10-01 10:00:00',
      'FAILED'
    );

    INSERT INTO publication_execution_receipts (
      receipt_id, execution_id, plan_id, article_id, slug,
      content_hash, featured_asset_id, canonical_url, target_publish_at,
      actual_published_at, outcome, details_json
    ) VALUES (
      'rcpt_101_canonical_success',
      'pexec_101_test',
      'plan_101_test',
      101,
      'desain-dinding-roster-tropis',
      'hash_art_101_content',
      'asset_roster_cover',
      'https://rancangloka.com/desain-dinding-roster-tropis',
      '2026-10-01 10:00:00',
      '2026-10-01 10:00:05',
      'SUCCESS',
      '{}'
    );

    INSERT INTO publication_execution_receipts (
      receipt_id, execution_id, plan_id, article_id, slug,
      content_hash, featured_asset_id, canonical_url, target_publish_at,
      actual_published_at, outcome, details_json
    ) VALUES (
      'rcpt_102_canonical_failed',
      'pexec_102_failed',
      'plan_102_test',
      101,
      'desain-dinding-roster-tropis',
      'hash_art_101_content',
      'asset_roster_cover',
      'https://rancangloka.com/desain-dinding-roster-tropis',
      '2026-10-01 10:00:00',
      '2026-10-01 10:00:05',
      'FAILED',
      '{"error":"simulated failure"}'
    );
  `);

  return {
    raw: sqlite,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.map(v => (v === undefined ? null : v));
          return this;
        },
        async run() {
          const stmt = sqlite.prepare(this._sql);
          const info = stmt.run(...this._params);
          return {
            changes: Number(info.changes),
            lastRowId: Number(info.lastInsertRowid)
          };
        },
        async first() {
          const stmt = sqlite.prepare(this._sql);
          const row = stmt.get(...this._params);
          return row || null;
        },
        async all() {
          const stmt = sqlite.prepare(this._sql);
          const results = stmt.all(...this._params);
          return { results };
        }
      };
    }
  };
}

// ============================================================================
// Test Execution
// ============================================================================

async function runTests() {
  console.log('--- Starting Social Media Automation Core Domain Test Suite (SOCIAL-S1) ---');
  const db = createSocialTestDb();

  // Test 1: Campaign creation from valid SUCCESS publication receipt provenance
  const campaign = await createCampaignFromPublishedReceipt(db, 'rcpt_101_canonical_success', {
    metadata: { test_suite: 'social-s1' }
  });
  assert(
    campaign &&
    campaign.campaign_id.startsWith('scamp_') &&
    campaign.article_id === 101 &&
    campaign.slug === 'desain-dinding-roster-tropis' &&
    campaign.content_hash === 'hash_art_101_content' &&
    campaign.campaign_status === 'DRAFT',
    '1. Valid SUCCESS publication receipt creates DRAFT social campaign with full provenance'
  );

  // Test 2: Rejection of non-existent publication receipt provenance
  let nonExistentRejected = false;
  try {
    await createCampaignFromPublishedReceipt(db, 'rcpt_non_existent_404');
  } catch (err) {
    nonExistentRejected = err.message.includes('SOURCE_RECEIPT_NOT_FOUND');
  }
  assert(nonExistentRejected, '2. Non-existent publication receipt is rejected fail-closed');

  // Test 3: Rejection of non-success publication receipt provenance
  let nonSuccessRejected = false;
  try {
    await createCampaignFromPublishedReceipt(db, 'rcpt_102_canonical_failed');
  } catch (err) {
    nonSuccessRejected = err.message.includes('SOURCE_RECEIPT_NOT_SUCCESS');
  }
  assert(nonSuccessRejected, '3. Non-success publication receipt is rejected fail-closed');

  // Test 4: Duplicate campaign prevention for same publication receipt
  let duplicateCampaignRejected = false;
  try {
    await createCampaignFromPublishedReceipt(db, 'rcpt_101_canonical_success');
  } catch (err) {
    duplicateCampaignRejected = err.message.includes('DUPLICATE_CAMPAIGN_FOR_RECEIPT');
  }
  assert(duplicateCampaignRejected, '4. Duplicate social campaign for identical receipt is prevented (idempotent)');

  // Test 5: Platform variant creation with deterministic payload hashing
  const fbVariant = await createPostVariant(db, {
    campaign_id: campaign.campaign_id,
    platform_id: 'facebook_page',
    variant_type: 'FEED_POST',
    caption_text: 'Dinding roster bukan sekadar pemanis fasad.\nSimak ulasan teknisnya di RancangLoka.',
    media_asset_ids: ['asset_roster_cover', 'asset_roster_detail_1'],
    media_aspect_ratio: '1:1'
  });
  assert(
    fbVariant &&
    fbVariant.variant_id.startsWith('spvar_') &&
    fbVariant.platform_id === 'facebook_page' &&
    fbVariant.variant_status === 'DRAFT' &&
    fbVariant.payload_hash &&
    fbVariant.caption_hash,
    '5. Platform variant created in DRAFT with deterministic payload and caption hashes'
  );

  // Test 6: Duplicate active platform variant prevention in same campaign
  let duplicateVariantRejected = false;
  try {
    await createPostVariant(db, {
      campaign_id: campaign.campaign_id,
      platform_id: 'facebook_page',
      caption_text: 'Teks duplikat.'
    });
  } catch (err) {
    duplicateVariantRejected = err.message.includes('DUPLICATE_ACTIVE_PLATFORM_VARIANT');
  }
  assert(duplicateVariantRejected, '6. Duplicate active variant for same platform in one campaign is rejected');

  // Test 7: State machine valid transitions (campaign, variant, outbox)
  assert(validateCampaignTransition('DRAFT', 'READY_FOR_QA').valid === true, '7a. Campaign DRAFT -> READY_FOR_QA is valid');
  assert(validateCampaignTransition('APPROVED', 'SCHEDULED').valid === true, '7b. Campaign APPROVED -> SCHEDULED is valid');
  assert(validateVariantTransition('DRAFT', 'READY_FOR_QA').valid === true, '7c. Variant DRAFT -> READY_FOR_QA is valid');
  assert(validateOutboxTransition('STAGED', 'CLAIMED').valid === true, '7d. Outbox STAGED -> CLAIMED is valid');

  // Test 8: State machine invalid transitions fail closed with explicit reason
  const invalidCamp = validateCampaignTransition('DRAFT', 'COMPLETED');
  const invalidVar = validateVariantTransition('DRAFT', 'PUBLISHED');
  assert(
    invalidCamp.valid === false && invalidCamp.reason &&
    invalidVar.valid === false && invalidVar.reason,
    '8. Invalid direct transitions (e.g. DRAFT -> COMPLETED/PUBLISHED) fail closed'
  );

  // Test 9: Approval requirement before scheduling outbox item
  let prematureScheduleRejected = false;
  try {
    await scheduleVariantToOutbox(db, {
      variant_id: fbVariant.variant_id,
      target_publish_at: '2026-10-01T12:00:00Z'
    });
  } catch (err) {
    prematureScheduleRejected = err.message.includes('APPROVAL_REQUIRED');
  }
  assert(prematureScheduleRejected, '9. Scheduling variant without approval is strictly rejected');

  // Test 10: Cryptographic approval invalidation when caption text is mutated
  await submitVariantForQA(db, fbVariant.variant_id);
  const { approval } = await approveVariant(db, {
    variant_id: fbVariant.variant_id,
    approved_by: 'lead_editor@rancangloka.com',
    approved_role: 'social_lead',
    notes: 'Approved for social distribution.'
  });

  // Verify approval is initially valid
  const initialCheck = verifyVariantApprovalValidity(approval, fbVariant.payload_hash);
  assert(initialCheck.valid === true, '10a. Fresh approval matches payload hash and is valid');

  // Mutate caption
  await updateVariantDraft(db, {
    variant_id: fbVariant.variant_id,
    caption_text: 'Dinding roster bukan sekadar pemanis fasad.\nPerhatikan ketebalan spesi perekat!'
  });
  const mutatedVariant = (await getVariantById(db, fbVariant.variant_id));
  const mutatedCheck = verifyVariantApprovalValidity(approval, mutatedVariant.payload_hash);
  assert(
    mutatedCheck.valid === false && mutatedCheck.reason.includes('PAYLOAD_MUTATED_SINCE_APPROVAL'),
    '10b. Caption mutation alters payload hash and invalidates prior approval'
  );

  // Test 11: Cryptographic approval invalidation when media assets are mutated
  const reApproved = await approveVariant(db, {
    variant_id: fbVariant.variant_id,
    approved_by: 'chief_editor@rancangloka.com',
    notes: 'Re-approved after caption refinement.'
  });
  await updateVariantDraft(db, {
    variant_id: fbVariant.variant_id,
    media_asset_ids: ['asset_roster_cover', 'asset_roster_different_image']
  });
  const mediaMutatedVariant = (await getVariantById(db, fbVariant.variant_id));
  const mediaCheck = verifyVariantApprovalValidity(reApproved.approval, mediaMutatedVariant.payload_hash);
  assert(
    mediaCheck.valid === false && mediaCheck.reason.includes('PAYLOAD_MUTATED_SINCE_APPROVAL'),
    '11. Media asset mutation alters payload hash and invalidates approval'
  );

  // Test 12: Staging outbox scheduling with valid approval payload matching
  const finalApproval = await approveVariant(db, {
    variant_id: fbVariant.variant_id,
    approved_by: 'chief_editor@rancangloka.com',
    notes: 'Final sign-off.'
  });
  const scheduleResult = await scheduleVariantToOutbox(db, {
    variant_id: fbVariant.variant_id,
    target_publish_at: '2026-10-01T15:00:00Z'
  });
  assert(
    scheduleResult &&
    scheduleResult.outbox.outbox_id.startsWith('sout_') &&
    scheduleResult.outbox.outbox_status === 'STAGED' &&
    scheduleResult.outbox.approved_payload_hash === finalApproval.approval.approved_payload_hash &&
    scheduleResult.variant.variant_status === 'SCHEDULED',
    '12. Valid approval allows scheduling into social_staging_outbox in STAGED state'
  );

  // Test 13: Duplicate outbox scheduling prevention
  let duplicateOutboxRejected = false;
  try {
    await scheduleVariantToOutbox(db, {
      variant_id: fbVariant.variant_id,
      target_publish_at: '2026-10-01T16:00:00Z'
    });
  } catch (err) {
    duplicateOutboxRejected = err.message.includes('OUTBOX_ALREADY_EXISTS') || err.message.includes('APPROVAL_REQUIRED');
  }
  assert(duplicateOutboxRejected, '13. Duplicate outbox scheduling for already scheduled variant is prevented');

  // Test 14: SOCIAL_AUTOMATION = OFF enforces zero dispatch eligibility
  const outboxSnapshotOff = await getSocialOutboxSnapshot(db, { SOCIAL_AUTOMATION: 'OFF' });
  assert(
    outboxSnapshotOff.automation_mode === 'OFF' &&
    outboxSnapshotOff.staged_count >= 1 &&
    outboxSnapshotOff.eligible_count === 0 &&
    outboxSnapshotOff.due_items.length === 0 &&
    outboxSnapshotOff.safety_block_reason !== null,
    '14. SOCIAL_AUTOMATION = OFF strictly prevents dispatch eligibility (eligible_count = 0)'
  );

  // Test 15: Cancellation and blocking lifecycle behavior
  // Create second variant for testing cancellation
  const igVariant = await createPostVariant(db, {
    campaign_id: campaign.campaign_id,
    platform_id: 'instagram_business',
    variant_type: 'CAROUSEL',
    caption_text: 'Pola roster tropis untuk sirkulasi udara maksimal.',
    media_asset_ids: ['asset_roster_slide_1'],
    media_aspect_ratio: '1:1'
  });
  const blockedVariant = await markVariantBlocked(db, igVariant.variant_id, 'PROVIDER_RATE_LIMIT');
  assert(
    blockedVariant && blockedVariant.variant_status === 'BLOCKED',
    '15a. Variant marked BLOCKED transition behaves deterministically'
  );
  const cancelledVariant = await cancelVariant(db, igVariant.variant_id, 'Cancelled by operator');
  assert(
    cancelledVariant && cancelledVariant.variant_status === 'CANCELLED',
    '15b. Variant marked CANCELLED transition behaves deterministically'
  );

  // Test 16: Execution receipt recording and campaign completion
  const receiptRecord = await recordExecutionReceipt(db, {
    outbox_id: scheduleResult.outbox.outbox_id,
    platform_post_id: 'fb_post_9876543210',
    platform_permalink: 'https://facebook.com/rancangloka/posts/9876543210',
    actual_published_at: '2026-10-01T15:00:10Z',
    outcome: 'SUCCESS',
    details: { provider: 'meta_graph_api', container_id: 'cont_12345' }
  });
  const completedCampaign = await getCampaignById(db, campaign.campaign_id);
  assert(
    receiptRecord &&
    receiptRecord.receipt_id.startsWith('srec_') &&
    receiptRecord.platform_post_id === 'fb_post_9876543210' &&
    receiptRecord.outcome === 'SUCCESS' &&
    completedCampaign.campaign_status === 'COMPLETED',
    '16. Immutable execution receipt recorded and campaign successfully transitions to COMPLETED'
  );

  // Test 17: Telemetry observable shape compatibility and UNKNOWN handling
  const telemetry = await getSocialDomainTelemetry(db, { SOCIAL_AUTOMATION: 'OFF' });
  assert(
    telemetry &&
    telemetry.automation_mode === 'OFF' &&
    telemetry.department_availability === 'NOT_AVAILABLE' &&
    telemetry.counts.total_campaigns >= 1 &&
    telemetry.counts.completed_campaigns >= 1 &&
    telemetry.counts.published_receipts >= 1 &&
    Array.isArray(telemetry.recent_receipts),
    '17. Observable telemetry compiles accurately with department_availability = NOT_AVAILABLE'
  );

  console.log('======================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner encountered unexpected error:', err);
  process.exit(1);
});
