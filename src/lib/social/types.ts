/**
 * RancangLoka — Social Media Automation Pipeline Core Domain Types
 * Milestone: SOCIAL-S1
 *
 * Strict Invariants:
 * 1. ZERO EXTERNAL PROVIDER CALLS.
 * 2. SOCIAL_AUTOMATION = OFF must prevent automated dispatch.
 * 3. Human Approval Gate: No variant can be scheduled without valid approval matching payload_hash.
 * 4. Immutable Provenance: Every campaign maps strictly to a SUCCESS publication_execution_receipt.
 * 5. Exactly-once active variant per platform per campaign.
 * 6. Zero secret leakage: No OAuth tokens or credentials in data models.
 */

export type SocialCampaignStatus =
  | 'DRAFT'
  | 'PREPARING'
  | 'READY_FOR_QA'
  | 'QA_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'CANCELLED'
  | 'UNKNOWN';

export type SocialVariantStatus =
  | 'DRAFT'
  | 'PREPARING'
  | 'READY_FOR_QA'
  | 'QA_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'RETRY_WAIT'
  | 'FAILED'
  | 'BLOCKED'
  | 'CANCELLED'
  | 'UNKNOWN';

export type SocialVariantType =
  | 'FEED_POST'
  | 'CAROUSEL'
  | 'REEL_SHORT'
  | 'THREAD';

export type SocialMediaAspectRatio =
  | '1:1'
  | '4:5'
  | '9:16'
  | '16:9';

export type SocialApprovalStatus =
  | 'APPROVED'
  | 'REJECTED'
  | 'REVOKED';

export type SocialOutboxStatus =
  | 'STAGED'
  | 'CLAIMED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'RETRY_WAIT'
  | 'FAILED'
  | 'BLOCKED'
  | 'CANCELLED';

export type SocialErrorClass =
  | 'RETRYABLE'
  | 'TERMINAL'
  | 'SAFETY_BLOCK';

export interface SocialCampaignRecord {
  id?: number;
  campaign_id: string;
  article_id: number;
  source_receipt_id: string;
  slug: string;
  content_hash: string;
  canonical_url: string;
  campaign_status: SocialCampaignStatus;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

export interface SocialPostVariantRecord {
  id?: number;
  variant_id: string;
  campaign_id: string;
  platform_id: string;
  variant_type: SocialVariantType;
  caption_text: string;
  caption_hash: string;
  media_asset_ids_json: string;
  media_aspect_ratio: SocialMediaAspectRatio;
  payload_hash: string;
  variant_status: SocialVariantStatus;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

export interface SocialVariantApprovalRecord {
  id?: number;
  approval_id: string;
  variant_id: string;
  approved_by: string;
  approved_role: string;
  approval_status: SocialApprovalStatus;
  approved_payload_hash: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialStagingOutboxRecord {
  id?: number;
  outbox_id: string;
  variant_id: string;
  campaign_id: string;
  platform_id: string;
  approved_payload_hash: string;
  target_publish_at: string;
  outbox_status: SocialOutboxStatus;
  claimed_by_worker?: string | null;
  lease_expires_at?: string | null;
  attempts_count: number;
  max_attempts: number;
  next_retry_at?: string | null;
  last_error_class?: SocialErrorClass | null;
  last_error_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialExecutionReceiptRecord {
  id?: number;
  receipt_id: string;
  outbox_id: string;
  variant_id: string;
  campaign_id: string;
  platform_id: string;
  approved_payload_hash: string;
  platform_post_id?: string | null;
  platform_permalink?: string | null;
  target_publish_at: string;
  actual_published_at: string;
  outcome: 'SUCCESS' | 'FAILED';
  details_json: string;
  created_at: string;
}

export interface SocialDomainTelemetry {
  generated_at: string;
  automation_mode: 'OFF' | 'SHADOW' | 'APPROVAL_REQUIRED' | 'CONTROLLED' | 'UNKNOWN';
  department_availability: 'NOT_AVAILABLE' | 'AVAILABLE';
  counts: {
    total_campaigns: number;
    draft_campaigns: number;
    approved_campaigns: number;
    scheduled_campaigns: number;
    completed_campaigns: number;
    blocked_campaigns: number;
    total_variants: number;
    staged_outbox_items: number;
    published_receipts: number;
  };
  recent_receipts: Array<{
    receipt_id: string;
    variant_id: string;
    platform_id: string;
    outcome: string;
    published_at: string;
  }>;
}
