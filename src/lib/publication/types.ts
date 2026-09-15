/**
 * RancangLoka — Publication Readiness Gate Domain Types & Canonical Failure Codes
 * Milestone: PUBLICATION-0
 */

export const PUBLICATION_STATUS_READY_TO_SCHEDULE = 'READY_TO_SCHEDULE';
export const PUBLICATION_STATUS_NOT_READY = 'NOT_READY';
export const PUBLICATION_STATUS_BLOCKED = 'BLOCKED';

export type PublicationOverallStatus =
  | typeof PUBLICATION_STATUS_READY_TO_SCHEDULE
  | typeof PUBLICATION_STATUS_NOT_READY
  | typeof PUBLICATION_STATUS_BLOCKED;

export const APPROVAL_STATUS_APPROVED = 'APPROVED';
export const APPROVAL_STATUS_REJECTED = 'REJECTED';
export const APPROVAL_STATUS_REVOKED = 'REVOKED';

export type ApprovalStatus =
  | typeof APPROVAL_STATUS_APPROVED
  | typeof APPROVAL_STATUS_REJECTED
  | typeof APPROVAL_STATUS_REVOKED;

/**
 * Deterministic Machine-Readable Failure Codes
 */
export const FAILURE_CODES = {
  // Article Core Integrity
  ARTICLE_NOT_FOUND: 'ARTICLE_NOT_FOUND',
  ARTICLE_NOT_DRAFT: 'ARTICLE_NOT_DRAFT',
  ARTICLE_CONTENT_EMPTY: 'ARTICLE_CONTENT_EMPTY',
  SLUG_INVALID: 'SLUG_INVALID',
  TITLE_LENGTH_INVALID: 'TITLE_LENGTH_INVALID',
  DESCRIPTION_INVALID: 'DESCRIPTION_INVALID',
  CANONICAL_AUTHOR_REQUIRED: 'CANONICAL_AUTHOR_REQUIRED',
  CATEGORY_INVALID: 'CATEGORY_INVALID',

  // Editorial Guards
  ARTICLE_CONTRACT_FAILED: 'ARTICLE_CONTRACT_FAILED',
  MONETARY_GUARD_FAILED: 'MONETARY_GUARD_FAILED',
  EDITORIAL_QA_FAILED: 'EDITORIAL_QA_FAILED',

  // Grounding & Citations
  EVIDENCE_FAILED: 'EVIDENCE_FAILED',
  EVIDENCE_GATE_FAILED: 'EVIDENCE_GATE_FAILED',
  CITATION_FAILED: 'CITATION_FAILED',
  CITATION_GUARD_FAILED: 'CITATION_GUARD_FAILED',

  // Visual Media
  FEATURED_MEDIA_MISSING: 'FEATURED_MEDIA_MISSING',
  MEDIA_NOT_VALIDATED: 'MEDIA_NOT_VALIDATED',
  MEDIA_TYPE_INVALID: 'MEDIA_TYPE_INVALID',
  MEDIA_DIMENSIONS_INVALID: 'MEDIA_DIMENSIONS_INVALID',
  ALT_TEXT_MISSING: 'ALT_TEXT_MISSING',

  // Human Approval & Invalidation
  APPROVAL_MISSING: 'APPROVAL_MISSING',
  APPROVAL_STATUS_REJECTED: 'APPROVAL_STATUS_REJECTED',
  APPROVAL_STATUS_REVOKED: 'APPROVAL_STATUS_REVOKED',
  APPROVAL_STALE: 'APPROVAL_STALE',
  APPROVAL_STALE_CONTENT: 'APPROVAL_STALE_CONTENT',
  CONTENT_CHANGED_AFTER_APPROVAL: 'CONTENT_CHANGED_AFTER_APPROVAL',
  APPROVAL_STALE_MEDIA: 'APPROVAL_STALE_MEDIA',
  MEDIA_CHANGED_AFTER_APPROVAL: 'MEDIA_CHANGED_AFTER_APPROVAL',

  // Publication Metadata & Conflicts
  PUBLICATION_CONFLICT: 'PUBLICATION_CONFLICT',
  INVENTORY_CONFLICT: 'INVENTORY_CONFLICT',
  METADATA_INCOMPLETE: 'METADATA_INCOMPLETE',
  TAKEAWAYS_INVALID: 'TAKEAWAYS_INVALID',

  // Fail-Closed
  GUARD_STATE_UNKNOWN: 'GUARD_STATE_UNKNOWN',
  FAIL_CLOSED: 'FAIL_CLOSED'
} as const;

export type FailureCode = (typeof FAILURE_CODES)[keyof typeof FAILURE_CODES];

export interface VectorCheckResult {
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  details?: Record<string, any>;
  blockers?: FailureCode[];
}

export interface ReadinessSnapshotPayload {
  schema_version: number;
  article_id: number;
  slug: string;
  evaluated_at: string;
  is_ready: boolean;
  overall_status: PublicationOverallStatus;
  content_hash: string;
  media: {
    asset_id: string | null;
    status: string | null;
    media_type: string | null;
    alt_text: string | null;
    has_alt_text: boolean;
  };
  approval: {
    has_approval: boolean;
    status: ApprovalStatus | null;
    approved_by: string | null;
    approved_at: string | null;
    approved_content_hash: string | null;
    approved_asset_id: string | null;
    content_hash_matched: boolean;
    media_matched: boolean;
  };
  checks: {
    article_integrity: 'PASS' | 'FAIL';
    editorial_guards: 'PASS' | 'FAIL';
    evidence_and_citations: 'PASS' | 'FAIL';
    visual_media: 'PASS' | 'FAIL';
    human_approval: 'PASS' | 'FAIL';
    publication_metadata: 'PASS' | 'FAIL';
  };
  blockers: FailureCode[];
}

export interface EditorialApprovalRecord {
  id: number;
  article_id: number;
  approved_by: string;
  approved_role: string;
  approval_status: ApprovalStatus;
  approved_content_hash: string;
  approved_asset_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReadinessEvaluationRecord {
  id: number;
  article_id: number;
  is_ready: number;
  overall_status: PublicationOverallStatus;
  content_hash: string;
  snapshot_json: string;
  evaluated_at: string;
}
