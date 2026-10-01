/**
 * RancangLoka — Social Media Automation Deterministic State Machine
 * Milestone: SOCIAL-S1
 *
 * Strict Invariants:
 * 1. Explicit, deterministic state transitions.
 * 2. Invalid transitions fail closed with explicit reason.
 * 3. UNKNOWN remains UNKNOWN — never inferred as success.
 * 4. Terminal states (COMPLETED, PUBLISHED, CANCELLED) cannot be mutated.
 */

import type {
  SocialCampaignStatus,
  SocialVariantStatus,
  SocialOutboxStatus
} from './types.ts';

export interface TransitionResult {
  valid: boolean;
  reason?: string;
}

// ============================================================================
// Campaign State Machine
// ============================================================================

const ALLOWED_CAMPAIGN_TRANSITIONS: Record<SocialCampaignStatus, readonly SocialCampaignStatus[]> = {
  DRAFT: ['PREPARING', 'READY_FOR_QA', 'BLOCKED', 'CANCELLED'],
  PREPARING: ['READY_FOR_QA', 'DRAFT', 'BLOCKED', 'CANCELLED'],
  READY_FOR_QA: ['QA_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'DRAFT', 'BLOCKED', 'CANCELLED'],
  QA_REVIEW: ['PENDING_APPROVAL', 'APPROVED', 'READY_FOR_QA', 'BLOCKED', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'QA_REVIEW', 'BLOCKED', 'CANCELLED'],
  APPROVED: ['SCHEDULED', 'PENDING_APPROVAL', 'BLOCKED', 'CANCELLED'],
  SCHEDULED: ['PROCESSING', 'APPROVED', 'BLOCKED', 'CANCELLED'],
  PROCESSING: ['COMPLETED', 'SCHEDULED', 'BLOCKED', 'CANCELLED'],
  BLOCKED: ['DRAFT', 'READY_FOR_QA', 'PENDING_APPROVAL', 'SCHEDULED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  UNKNOWN: ['DRAFT']
};

export function validateCampaignTransition(
  from: SocialCampaignStatus,
  to: SocialCampaignStatus
): TransitionResult {
  if (from === to) {
    return { valid: true };
  }

  const allowed = ALLOWED_CAMPAIGN_TRANSITIONS[from];
  if (!allowed) {
    return {
      valid: false,
      reason: `Unknown source campaign status: '${from}'`
    };
  }

  if (allowed.includes(to)) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: `Invalid campaign transition from '${from}' to '${to}'`
  };
}

// ============================================================================
// Post Variant State Machine
// ============================================================================

const ALLOWED_VARIANT_TRANSITIONS: Record<SocialVariantStatus, readonly SocialVariantStatus[]> = {
  DRAFT: ['PREPARING', 'READY_FOR_QA', 'BLOCKED', 'CANCELLED'],
  PREPARING: ['READY_FOR_QA', 'DRAFT', 'BLOCKED', 'CANCELLED'],
  READY_FOR_QA: ['QA_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'DRAFT', 'BLOCKED', 'CANCELLED'],
  QA_REVIEW: ['PENDING_APPROVAL', 'APPROVED', 'READY_FOR_QA', 'BLOCKED', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'QA_REVIEW', 'BLOCKED', 'CANCELLED'],
  APPROVED: ['SCHEDULED', 'PENDING_APPROVAL', 'BLOCKED', 'CANCELLED'],
  SCHEDULED: ['PUBLISHING', 'APPROVED', 'BLOCKED', 'CANCELLED'],
  PUBLISHING: ['PUBLISHED', 'RETRY_WAIT', 'FAILED', 'BLOCKED'],
  RETRY_WAIT: ['PUBLISHING', 'FAILED', 'BLOCKED', 'CANCELLED'],
  BLOCKED: ['DRAFT', 'READY_FOR_QA', 'PENDING_APPROVAL', 'SCHEDULED', 'CANCELLED'],
  PUBLISHED: [],
  FAILED: [],
  CANCELLED: [],
  UNKNOWN: ['DRAFT']
};

export function validateVariantTransition(
  from: SocialVariantStatus,
  to: SocialVariantStatus
): TransitionResult {
  if (from === to) {
    return { valid: true };
  }

  const allowed = ALLOWED_VARIANT_TRANSITIONS[from];
  if (!allowed) {
    return {
      valid: false,
      reason: `Unknown source variant status: '${from}'`
    };
  }

  if (allowed.includes(to)) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: `Invalid variant transition from '${from}' to '${to}'`
  };
}

// ============================================================================
// Staging Outbox State Machine
// ============================================================================

const ALLOWED_OUTBOX_TRANSITIONS: Record<SocialOutboxStatus, readonly SocialOutboxStatus[]> = {
  STAGED: ['CLAIMED', 'CANCELLED', 'BLOCKED'],
  CLAIMED: ['PUBLISHING', 'STAGED', 'BLOCKED', 'CANCELLED'],
  PUBLISHING: ['PUBLISHED', 'RETRY_WAIT', 'FAILED', 'BLOCKED'],
  RETRY_WAIT: ['CLAIMED', 'FAILED', 'BLOCKED', 'CANCELLED'],
  BLOCKED: ['STAGED', 'CANCELLED'],
  PUBLISHED: [],
  FAILED: [],
  CANCELLED: []
};

export function validateOutboxTransition(
  from: SocialOutboxStatus,
  to: SocialOutboxStatus
): TransitionResult {
  if (from === to) {
    return { valid: true };
  }

  const allowed = ALLOWED_OUTBOX_TRANSITIONS[from];
  if (!allowed) {
    return {
      valid: false,
      reason: `Unknown source outbox status: '${from}'`
    };
  }

  if (allowed.includes(to)) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: `Invalid outbox transition from '${from}' to '${to}'`
  };
}
