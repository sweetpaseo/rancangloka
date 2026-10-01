/**
 * RancangLoka — Social Media Automation Approval & Hash Utilities
 * Milestone: SOCIAL-S1
 *
 * Strict Invariants:
 * 1. Independent Authority Boundary: Approval is cryptographically linked to the exact payload hash.
 * 2. Material Mutation Invalidation: Any modification to caption text or media assets produces
 *    a distinct payload hash, instantly invalidating previous approvals.
 * 3. Deterministic Hashing: Canonical sorting of asset arrays and whitespace normalization.
 */

import crypto from 'node:crypto';
import type { SocialVariantApprovalRecord } from './types.ts';

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function normalizeCaptionText(rawCaption: string): string {
  return rawCaption.replace(/\r\n/g, '\n').trim();
}

export interface PayloadHashInput {
  platform_id: string;
  caption_text: string;
  media_asset_ids: string[];
  media_aspect_ratio: string;
}

/**
 * Computes deterministic SHA-256 hash of a variant payload.
 */
export function computeVariantPayloadHash(input: PayloadHashInput): {
  caption_hash: string;
  payload_hash: string;
} {
  const normCaption = normalizeCaptionText(input.caption_text);
  const captionHash = sha256(normCaption);

  const sortedMediaIds = [...(input.media_asset_ids || [])].sort();
  const canonicalString = [
    input.platform_id.trim().toLowerCase(),
    captionHash,
    sortedMediaIds.join(','),
    input.media_aspect_ratio.trim()
  ].join('::');

  const payloadHash = sha256(canonicalString);

  return {
    caption_hash: captionHash,
    payload_hash: payloadHash
  };
}

export interface ApprovalVerificationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates whether an existing approval record legally authorizes a variant for scheduling.
 */
export function verifyVariantApprovalValidity(
  approval: SocialVariantApprovalRecord | null,
  currentPayloadHash: string
): ApprovalVerificationResult {
  if (!approval) {
    return {
      valid: false,
      reason: 'MISSING_APPROVAL: Variant has no recorded human approval.'
    };
  }

  if (approval.approval_status !== 'APPROVED') {
    return {
      valid: false,
      reason: `INVALID_APPROVAL_STATUS: Approval is currently '${approval.approval_status}'.`
    };
  }

  if (approval.approved_payload_hash !== currentPayloadHash) {
    return {
      valid: false,
      reason: 'PAYLOAD_MUTATED_SINCE_APPROVAL: Caption or media assets changed after approval was signed.'
    };
  }

  return { valid: true };
}
