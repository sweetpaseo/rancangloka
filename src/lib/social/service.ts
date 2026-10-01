/**
 * RancangLoka — Social Media Automation Pipeline Service Layer
 * Milestone: SOCIAL-S1
 *
 * Strict Invariants:
 * 1. Zero External Network / Provider Calls.
 * 2. Source Provenance: Campaign creation requires valid SUCCESS publication_execution_receipts record.
 * 3. Exactly-once active variant per platform per campaign.
 * 4. Approval Gate: Scheduling requires matching cryptographic payload_hash.
 * 5. SOCIAL_AUTOMATION = OFF enforces zero dispatch eligibility.
 * 6. Observable-ready telemetry without mutating Mission Control UI.
 */

import crypto from 'node:crypto';
import type {
  SocialCampaignRecord,
  SocialPostVariantRecord,
  SocialVariantApprovalRecord,
  SocialStagingOutboxRecord,
  SocialExecutionReceiptRecord,
  SocialVariantType,
  SocialMediaAspectRatio,
  SocialDomainTelemetry
} from './types.ts';
import {
  validateCampaignTransition,
  validateVariantTransition,
  validateOutboxTransition
} from './state-machine.ts';
import {
  computeVariantPayloadHash,
  verifyVariantApprovalValidity
} from './approval.ts';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

// ============================================================================
// 1. Campaign Operations (Source Provenance Bound)
// ============================================================================

export async function createCampaignFromPublishedReceipt(
  db: any,
  sourceReceiptId: string,
  options: { metadata?: Record<string, any> } = {}
): Promise<SocialCampaignRecord> {
  if (!sourceReceiptId || typeof sourceReceiptId !== 'string') {
    throw new Error('INVALID_INPUT: sourceReceiptId must be a non-empty string.');
  }

  // 1. Verify source publication receipt in D1
  const receipt = await db
    .prepare('SELECT * FROM publication_execution_receipts WHERE receipt_id = ? LIMIT 1')
    .bind(sourceReceiptId)
    .first();

  if (!receipt) {
    throw new Error(`SOURCE_RECEIPT_NOT_FOUND: Publication receipt '${sourceReceiptId}' does not exist.`);
  }

  if (receipt.outcome !== 'SUCCESS') {
    throw new Error(`SOURCE_RECEIPT_NOT_SUCCESS: Publication receipt '${sourceReceiptId}' outcome is '${receipt.outcome}', expected 'SUCCESS'.`);
  }

  // 2. Check duplicate campaign for receipt (Idempotency)
  const existingCampaign = await db
    .prepare('SELECT * FROM social_campaigns WHERE source_receipt_id = ? LIMIT 1')
    .bind(sourceReceiptId)
    .first();

  if (existingCampaign) {
    throw new Error(`DUPLICATE_CAMPAIGN_FOR_RECEIPT: Social campaign '${existingCampaign.campaign_id}' already exists for receipt '${sourceReceiptId}'.`);
  }

  const campaignId = generateId('scamp');
  const metadataJson = JSON.stringify(options.metadata || {});

  await db
    .prepare(`
      INSERT INTO social_campaigns (
        campaign_id, article_id, source_receipt_id, slug,
        content_hash, canonical_url, campaign_status, metadata_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
    .bind(
      campaignId,
      receipt.article_id,
      receipt.receipt_id,
      receipt.slug,
      receipt.content_hash,
      receipt.canonical_url,
      metadataJson
    )
    .run();

  const created = await getCampaignById(db, campaignId);
  if (!created) {
    throw new Error('PERSISTENCE_ERROR: Failed to retrieve newly created campaign.');
  }

  return created;
}

export async function getCampaignById(db: any, campaignId: string): Promise<SocialCampaignRecord | null> {
  const row = await db
    .prepare('SELECT * FROM social_campaigns WHERE campaign_id = ? LIMIT 1')
    .bind(campaignId)
    .first();
  return row || null;
}

// ============================================================================
// 2. Post Variant Operations
// ============================================================================

export interface CreateVariantParams {
  campaign_id: string;
  platform_id: string;
  variant_type?: SocialVariantType;
  caption_text: string;
  media_asset_ids?: string[];
  media_aspect_ratio?: SocialMediaAspectRatio;
  metadata?: Record<string, any>;
}

export async function createPostVariant(
  db: any,
  params: CreateVariantParams
): Promise<SocialPostVariantRecord> {
  const campaign = await getCampaignById(db, params.campaign_id);
  if (!campaign) {
    throw new Error(`CAMPAIGN_NOT_FOUND: Social campaign '${params.campaign_id}' does not exist.`);
  }

  if (['COMPLETED', 'CANCELLED'].includes(campaign.campaign_status)) {
    throw new Error(`CAMPAIGN_TERMINATED: Cannot add variants to campaign in '${campaign.campaign_status}' state.`);
  }

  const platformId = params.platform_id.trim().toLowerCase();
  const variantType = params.variant_type || 'FEED_POST';
  const mediaAspectRatio = params.media_aspect_ratio || '1:1';
  const mediaAssetIds = params.media_asset_ids || [];

  // Check duplicate active variant for this platform
  const existingActive = await db
    .prepare(`
      SELECT * FROM social_post_variants 
      WHERE campaign_id = ? AND platform_id = ? AND variant_status NOT IN ('CANCELLED', 'FAILED')
      LIMIT 1
    `)
    .bind(params.campaign_id, platformId)
    .first();

  if (existingActive) {
    throw new Error(`DUPLICATE_ACTIVE_PLATFORM_VARIANT: Active variant '${existingActive.variant_id}' already exists for platform '${platformId}' in this campaign.`);
  }

  const { caption_hash, payload_hash } = computeVariantPayloadHash({
    platform_id: platformId,
    caption_text: params.caption_text,
    media_asset_ids: mediaAssetIds,
    media_aspect_ratio: mediaAspectRatio
  });

  const variantId = generateId('spvar');
  const metadataJson = JSON.stringify(params.metadata || {});

  await db
    .prepare(`
      INSERT INTO social_post_variants (
        variant_id, campaign_id, platform_id, variant_type,
        caption_text, caption_hash, media_asset_ids_json, media_aspect_ratio,
        payload_hash, variant_status, metadata_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
    .bind(
      variantId,
      params.campaign_id,
      platformId,
      variantType,
      params.caption_text,
      caption_hash,
      JSON.stringify(mediaAssetIds),
      mediaAspectRatio,
      payload_hash,
      metadataJson
    )
    .run();

  const created = await getVariantById(db, variantId);
  if (!created) {
    throw new Error('PERSISTENCE_ERROR: Failed to retrieve newly created variant.');
  }

  return created;
}

export async function getVariantById(db: any, variantId: string): Promise<SocialPostVariantRecord | null> {
  const row = await db
    .prepare('SELECT * FROM social_post_variants WHERE variant_id = ? LIMIT 1')
    .bind(variantId)
    .first();
  return row || null;
}

export async function updateVariantDraft(
  db: any,
  params: {
    variant_id: string;
    caption_text?: string;
    media_asset_ids?: string[];
    media_aspect_ratio?: SocialMediaAspectRatio;
    metadata?: Record<string, any>;
  }
): Promise<SocialPostVariantRecord> {
  const variant = await getVariantById(db, params.variant_id);
  if (!variant) {
    throw new Error(`VARIANT_NOT_FOUND: Variant '${params.variant_id}' does not exist.`);
  }

  // Only editable in non-scheduled / non-terminal states
  if (!['DRAFT', 'PREPARING', 'READY_FOR_QA', 'QA_REVIEW', 'APPROVED'].includes(variant.variant_status)) {
    throw new Error(`IMMUTABLE_STAGE: Cannot edit variant in '${variant.variant_status}' state.`);
  }

  const captionText = params.caption_text !== undefined ? params.caption_text : variant.caption_text;
  const mediaAssetIds = params.media_asset_ids !== undefined
    ? params.media_asset_ids
    : JSON.parse(variant.media_asset_ids_json || '[]');
  const mediaAspectRatio = params.media_aspect_ratio || variant.media_aspect_ratio;

  const { caption_hash, payload_hash } = computeVariantPayloadHash({
    platform_id: variant.platform_id,
    caption_text: captionText,
    media_asset_ids: mediaAssetIds,
    media_aspect_ratio: mediaAspectRatio
  });

  const metadataJson = params.metadata
    ? JSON.stringify({ ...JSON.parse(variant.metadata_json || '{}'), ...params.metadata })
    : variant.metadata_json;

  // If was APPROVED, editing demotes status back to READY_FOR_QA because approval is invalidated
  const nextStatus = variant.variant_status === 'APPROVED' ? 'READY_FOR_QA' : variant.variant_status;

  await db
    .prepare(`
      UPDATE social_post_variants
      SET caption_text = ?,
          caption_hash = ?,
          media_asset_ids_json = ?,
          media_aspect_ratio = ?,
          payload_hash = ?,
          variant_status = ?,
          metadata_json = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE variant_id = ?
    `)
    .bind(
      captionText,
      caption_hash,
      JSON.stringify(mediaAssetIds),
      mediaAspectRatio,
      payload_hash,
      nextStatus,
      metadataJson,
      params.variant_id
    )
    .run();

  return (await getVariantById(db, params.variant_id))!;
}

export async function submitVariantForQA(db: any, variantId: string): Promise<SocialPostVariantRecord> {
  const variant = await getVariantById(db, variantId);
  if (!variant) throw new Error(`VARIANT_NOT_FOUND: '${variantId}'`);

  const check = validateVariantTransition(variant.variant_status, 'READY_FOR_QA');
  if (!check.valid) throw new Error(check.reason);

  await db
    .prepare("UPDATE social_post_variants SET variant_status = 'READY_FOR_QA', updated_at = CURRENT_TIMESTAMP WHERE variant_id = ?")
    .bind(variantId)
    .run();

  return (await getVariantById(db, variantId))!;
}

// ============================================================================
// 3. Approval Operations
// ============================================================================

export interface ApproveVariantParams {
  variant_id: string;
  approved_by: string;
  approved_role?: string;
  notes?: string;
}

export async function approveVariant(
  db: any,
  params: ApproveVariantParams
): Promise<{ approval: SocialVariantApprovalRecord; variant: SocialPostVariantRecord }> {
  const variant = await getVariantById(db, params.variant_id);
  if (!variant) throw new Error(`VARIANT_NOT_FOUND: '${params.variant_id}'`);

  const transition = validateVariantTransition(variant.variant_status, 'APPROVED');
  if (!transition.valid) {
    throw new Error(`CANNOT_APPROVE: ${transition.reason}`);
  }

  const approvalId = generateId('sappr');
  const role = params.approved_role || 'social_lead';

  await db
    .prepare(`
      INSERT INTO social_variant_approvals (
        approval_id, variant_id, approved_by, approved_role,
        approval_status, approved_payload_hash, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'APPROVED', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
    .bind(
      approvalId,
      params.variant_id,
      params.approved_by,
      role,
      variant.payload_hash,
      params.notes || null
    )
    .run();

  await db
    .prepare("UPDATE social_post_variants SET variant_status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE variant_id = ?")
    .bind(params.variant_id)
    .run();

  const approval = await db
    .prepare('SELECT * FROM social_variant_approvals WHERE approval_id = ? LIMIT 1')
    .bind(approvalId)
    .first();

  const updatedVariant = (await getVariantById(db, params.variant_id))!;

  return { approval, variant: updatedVariant };
}

// ============================================================================
// 4. Staging Outbox Scheduling
// ============================================================================

export interface ScheduleVariantParams {
  variant_id: string;
  target_publish_at: string;
}

export async function scheduleVariantToOutbox(
  db: any,
  params: ScheduleVariantParams
): Promise<{ outbox: SocialStagingOutboxRecord; variant: SocialPostVariantRecord }> {
  const variant = await getVariantById(db, params.variant_id);
  if (!variant) throw new Error(`VARIANT_NOT_FOUND: '${params.variant_id}'`);

  if (variant.variant_status !== 'APPROVED') {
    throw new Error(`APPROVAL_REQUIRED: Variant '${params.variant_id}' must be in 'APPROVED' state before scheduling (currently '${variant.variant_status}').`);
  }

  // 1. Fetch latest approval and verify cryptographic payload binding
  const latestApproval = await db
    .prepare(`
      SELECT * FROM social_variant_approvals 
      WHERE variant_id = ? 
      ORDER BY id DESC LIMIT 1
    `)
    .bind(params.variant_id)
    .first();

  const approvalCheck = verifyVariantApprovalValidity(latestApproval, variant.payload_hash);
  if (!approvalCheck.valid) {
    throw new Error(`APPROVAL_INVALID: ${approvalCheck.reason}`);
  }

  // 2. Validate target time format
  const targetDate = new Date(params.target_publish_at);
  if (isNaN(targetDate.getTime())) {
    throw new Error(`INVALID_TARGET_TIME: '${params.target_publish_at}' is not a valid ISO date.`);
  }

  // 3. Ensure no existing active outbox item
  const existingOutbox = await db
    .prepare("SELECT * FROM social_staging_outbox WHERE variant_id = ? AND outbox_status NOT IN ('CANCELLED', 'FAILED') LIMIT 1")
    .bind(params.variant_id)
    .first();

  if (existingOutbox) {
    throw new Error(`OUTBOX_ALREADY_EXISTS: Outbox item '${existingOutbox.outbox_id}' already exists for variant '${params.variant_id}'.`);
  }

  const outboxId = generateId('sout');

  await db
    .prepare(`
      INSERT INTO social_staging_outbox (
        outbox_id, variant_id, campaign_id, platform_id,
        approved_payload_hash, target_publish_at, outbox_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'STAGED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
    .bind(
      outboxId,
      params.variant_id,
      variant.campaign_id,
      variant.platform_id,
      variant.payload_hash,
      params.target_publish_at
    )
    .run();

  await db
    .prepare("UPDATE social_post_variants SET variant_status = 'SCHEDULED', updated_at = CURRENT_TIMESTAMP WHERE variant_id = ?")
    .bind(params.variant_id)
    .run();

  // If campaign is APPROVED or earlier, transition to SCHEDULED
  const campaign = await getCampaignById(db, variant.campaign_id);
  if (campaign && ['DRAFT', 'PREPARING', 'READY_FOR_QA', 'QA_REVIEW', 'PENDING_APPROVAL', 'APPROVED'].includes(campaign.campaign_status)) {
    await db
      .prepare("UPDATE social_campaigns SET campaign_status = 'SCHEDULED', updated_at = CURRENT_TIMESTAMP WHERE campaign_id = ?")
      .bind(variant.campaign_id)
      .run();
  }

  const outbox = await db
    .prepare('SELECT * FROM social_staging_outbox WHERE outbox_id = ? LIMIT 1')
    .bind(outboxId)
    .first();

  const updatedVariant = (await getVariantById(db, params.variant_id))!;

  return { outbox, variant: updatedVariant };
}

// ============================================================================
// 5. Cancellation & Blocking
// ============================================================================

export async function cancelVariant(
  db: any,
  variantId: string,
  reason: string
): Promise<SocialPostVariantRecord> {
  const variant = await getVariantById(db, variantId);
  if (!variant) throw new Error(`VARIANT_NOT_FOUND: '${variantId}'`);

  if (variant.variant_status === 'PUBLISHED') {
    throw new Error('IMMUTABLE_TERMINAL: Cannot cancel an already published variant.');
  }

  await db
    .prepare("UPDATE social_post_variants SET variant_status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE variant_id = ?")
    .bind(variantId)
    .run();

  await db
    .prepare("UPDATE social_staging_outbox SET outbox_status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE variant_id = ? AND outbox_status NOT IN ('PUBLISHED')")
    .bind(variantId)
    .run();

  return (await getVariantById(db, variantId))!;
}

export async function markVariantBlocked(
  db: any,
  variantId: string,
  reason: string
): Promise<SocialPostVariantRecord> {
  const variant = await getVariantById(db, variantId);
  if (!variant) throw new Error(`VARIANT_NOT_FOUND: '${variantId}'`);

  if (variant.variant_status === 'PUBLISHED') {
    throw new Error('IMMUTABLE_TERMINAL: Cannot block an already published variant.');
  }

  await db
    .prepare("UPDATE social_post_variants SET variant_status = 'BLOCKED', updated_at = CURRENT_TIMESTAMP WHERE variant_id = ?")
    .bind(variantId)
    .run();

  await db
    .prepare("UPDATE social_staging_outbox SET outbox_status = 'BLOCKED', last_error_class = 'SAFETY_BLOCK', last_error_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE variant_id = ?")
    .bind(reason, variantId)
    .run();

  return (await getVariantById(db, variantId))!;
}

// ============================================================================
// 6. Immutable Execution Receipts (Test/Fixture Bound in S1)
// ============================================================================

export interface RecordReceiptParams {
  outbox_id: string;
  platform_post_id?: string;
  platform_permalink?: string;
  actual_published_at?: string;
  outcome?: 'SUCCESS' | 'FAILED';
  details?: Record<string, any>;
}

export async function recordExecutionReceipt(
  db: any,
  params: RecordReceiptParams
): Promise<SocialExecutionReceiptRecord> {
  const outbox = await db
    .prepare('SELECT * FROM social_staging_outbox WHERE outbox_id = ? LIMIT 1')
    .bind(params.outbox_id)
    .first();

  if (!outbox) throw new Error(`OUTBOX_NOT_FOUND: '${params.outbox_id}'`);

  const outcome = params.outcome || 'SUCCESS';
  const receiptId = generateId('srec');
  const publishedAt = params.actual_published_at || new Date().toISOString();
  const detailsJson = JSON.stringify(params.details || {});

  await db
    .prepare(`
      INSERT INTO social_execution_receipts (
        receipt_id, outbox_id, variant_id, campaign_id, platform_id,
        approved_payload_hash, platform_post_id, platform_permalink,
        target_publish_at, actual_published_at, outcome, details_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    .bind(
      receiptId,
      outbox.outbox_id,
      outbox.variant_id,
      outbox.campaign_id,
      outbox.platform_id,
      outbox.approved_payload_hash,
      params.platform_post_id || null,
      params.platform_permalink || null,
      outbox.target_publish_at,
      publishedAt,
      outcome,
      detailsJson
    )
    .run();

  const outboxStatus = outcome === 'SUCCESS' ? 'PUBLISHED' : 'FAILED';
  const variantStatus = outcome === 'SUCCESS' ? 'PUBLISHED' : 'FAILED';

  await db
    .prepare('UPDATE social_staging_outbox SET outbox_status = ?, updated_at = CURRENT_TIMESTAMP WHERE outbox_id = ?')
    .bind(outboxStatus, outbox.outbox_id)
    .run();

  await db
    .prepare('UPDATE social_post_variants SET variant_status = ?, updated_at = CURRENT_TIMESTAMP WHERE variant_id = ?')
    .bind(variantStatus, outbox.variant_id)
    .run();

  // If all variants in this campaign are PUBLISHED, mark campaign COMPLETED
  const pendingVariants = await db
    .prepare("SELECT COUNT(*) as count FROM social_post_variants WHERE campaign_id = ? AND variant_status NOT IN ('PUBLISHED', 'CANCELLED')")
    .bind(outbox.campaign_id)
    .first();

  if (pendingVariants && pendingVariants.count === 0) {
    await db
      .prepare("UPDATE social_campaigns SET campaign_status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE campaign_id = ?")
      .bind(outbox.campaign_id)
      .run();
  }

  const receipt = await db
    .prepare('SELECT * FROM social_execution_receipts WHERE receipt_id = ? LIMIT 1')
    .bind(receiptId)
    .first();

  return receipt;
}

// ============================================================================
// 7. Staging Outbox Snapshot & Safety Gate Inspection
// ============================================================================

export async function getSocialOutboxSnapshot(
  db: any,
  env: any = {}
): Promise<{
  automation_mode: string;
  eligible_count: number;
  staged_count: number;
  due_items: any[];
  safety_block_reason: string | null;
}> {
  const automationMode = env.SOCIAL_AUTOMATION || 'OFF';

  const stagedRows = await db
    .prepare("SELECT * FROM social_staging_outbox WHERE outbox_status IN ('STAGED', 'RETRY_WAIT')")
    .all();

  const items = stagedRows?.results || [];

  // STRICT INVARIANT: If SOCIAL_AUTOMATION is OFF, eligible items is strictly 0!
  if (automationMode === 'OFF') {
    return {
      automation_mode: 'OFF',
      eligible_count: 0,
      staged_count: items.length,
      due_items: [],
      safety_block_reason: 'SOCIAL_AUTOMATION = OFF enforces zero executable dispatch.'
    };
  }

  return {
    automation_mode: automationMode,
    eligible_count: items.length,
    staged_count: items.length,
    due_items: items,
    safety_block_reason: null
  };
}

// ============================================================================
// 8. Observable-Ready Telemetry (For Future MC Integration)
// ============================================================================

export async function getSocialDomainTelemetry(
  db: any,
  env: any = {}
): Promise<SocialDomainTelemetry> {
  const totalCampaigns = (await db.prepare('SELECT COUNT(*) as count FROM social_campaigns').first())?.count || 0;
  const draftCampaigns = (await db.prepare("SELECT COUNT(*) as count FROM social_campaigns WHERE campaign_status = 'DRAFT'").first())?.count || 0;
  const approvedCampaigns = (await db.prepare("SELECT COUNT(*) as count FROM social_campaigns WHERE campaign_status = 'APPROVED'").first())?.count || 0;
  const scheduledCampaigns = (await db.prepare("SELECT COUNT(*) as count FROM social_campaigns WHERE campaign_status = 'SCHEDULED'").first())?.count || 0;
  const completedCampaigns = (await db.prepare("SELECT COUNT(*) as count FROM social_campaigns WHERE campaign_status = 'COMPLETED'").first())?.count || 0;
  const blockedCampaigns = (await db.prepare("SELECT COUNT(*) as count FROM social_campaigns WHERE campaign_status = 'BLOCKED'").first())?.count || 0;

  const totalVariants = (await db.prepare('SELECT COUNT(*) as count FROM social_post_variants').first())?.count || 0;
  const stagedOutbox = (await db.prepare("SELECT COUNT(*) as count FROM social_staging_outbox WHERE outbox_status IN ('STAGED', 'RETRY_WAIT')").first())?.count || 0;
  const publishedReceipts = (await db.prepare("SELECT COUNT(*) as count FROM social_execution_receipts WHERE outcome = 'SUCCESS'").first())?.count || 0;

  const recentReceiptsRows = await db
    .prepare('SELECT receipt_id, variant_id, platform_id, outcome, actual_published_at FROM social_execution_receipts ORDER BY created_at DESC LIMIT 5')
    .all();

  const recent = (recentReceiptsRows?.results || []).map((r: any) => ({
    receipt_id: r.receipt_id,
    variant_id: r.variant_id,
    platform_id: r.platform_id,
    outcome: r.outcome,
    published_at: r.actual_published_at
  }));

  return {
    generated_at: new Date().toISOString(),
    automation_mode: env.SOCIAL_AUTOMATION || 'OFF',
    department_availability: 'NOT_AVAILABLE',
    counts: {
      total_campaigns: totalCampaigns,
      draft_campaigns: draftCampaigns,
      approved_campaigns: approvedCampaigns,
      scheduled_campaigns: scheduledCampaigns,
      completed_campaigns: completedCampaigns,
      blocked_campaigns: blockedCampaigns,
      total_variants: totalVariants,
      staged_outbox_items: stagedOutbox,
      published_receipts: publishedReceipts
    },
    recent_receipts: recent
  };
}
