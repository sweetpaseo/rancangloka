/**
 * RancangLoka — Scheduled Publisher Type Definitions
 * Milestone: PUBLICATION-2
 * 
 * Strict state definitions, execution lifecycle types, and fail-closed error classes.
 */

export const PUBLISHER_VERSION = '1.0.0';

// Canonical Publication Execution States
export const EXECUTION_STATUS_SCHEDULED = 'SCHEDULED';
export const EXECUTION_STATUS_CLAIMED = 'CLAIMED';
export const EXECUTION_STATUS_PUBLISHING = 'PUBLISHING';
export const EXECUTION_STATUS_PUBLISHED = 'PUBLISHED';
export const EXECUTION_STATUS_RETRY_WAIT = 'RETRY_WAIT';
export const EXECUTION_STATUS_FAILED = 'FAILED';
export const EXECUTION_STATUS_CANCELLED = 'CANCELLED';
export const EXECUTION_STATUS_BLOCKED = 'BLOCKED';

export type ExecutionStatus =
  | typeof EXECUTION_STATUS_SCHEDULED
  | typeof EXECUTION_STATUS_CLAIMED
  | typeof EXECUTION_STATUS_PUBLISHING
  | typeof EXECUTION_STATUS_PUBLISHED
  | typeof EXECUTION_STATUS_RETRY_WAIT
  | typeof EXECUTION_STATUS_FAILED
  | typeof EXECUTION_STATUS_CANCELLED
  | typeof EXECUTION_STATUS_BLOCKED;

// Canonical Failure Classification
export const ERROR_CLASS_RETRYABLE = 'RETRYABLE';
export const ERROR_CLASS_TERMINAL = 'TERMINAL';
export const ERROR_CLASS_SAFETY_BLOCK = 'SAFETY_BLOCK';

export type ErrorClass =
  | typeof ERROR_CLASS_RETRYABLE
  | typeof ERROR_CLASS_TERMINAL
  | typeof ERROR_CLASS_SAFETY_BLOCK;

// Reason Codes
export type PublisherReasonCode =
  | 'PLAN_NOT_FOUND'
  | 'PLAN_NOT_PLANNED'
  | 'ACTIVE_EXECUTION_EXISTS'
  | 'ARTICLE_NOT_DRAFT'
  | 'READINESS_STALE_OR_INVALID'
  | 'APPROVAL_REVOKED_OR_STALE'
  | 'CONTENT_HASH_MISMATCH'
  | 'FEATURED_MEDIA_MISMATCH'
  | 'MISSING_AUTHOR_OR_CATEGORY'
  | 'SLUG_CONFLICT'
  | 'ALREADY_PUBLISHED'
  | 'LEASE_ACQUISITION_FAILED'
  | 'LEASE_EXPIRED_RECOVERED'
  | 'ATOMIC_BATCH_FAILED'
  | 'MAX_RETRIES_EXCEEDED'
  | 'CANCELLED_BY_OPERATOR'
  | 'PUBLISHER_PAUSED'
  | 'SUCCESS';

export interface PublicationExecutionRecord {
  id: number;
  execution_id: string;
  plan_id: string;
  article_id: number;
  content_hash: string;
  featured_asset_id: string;
  target_publish_at: string;
  execution_status: ExecutionStatus;
  claimed_by_worker: string | null;
  lease_expires_at: string | null;
  attempts_count: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_error_class: ErrorClass | null;
  last_error_reason: string | null;
  publisher_version: string;
  actual_published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicationReceiptRecord {
  id: number;
  receipt_id: string;
  execution_id: string;
  plan_id: string;
  article_id: number;
  slug: string;
  content_hash: string;
  featured_asset_id: string;
  canonical_url: string;
  target_publish_at: string;
  actual_published_at: string;
  publisher_version: string;
  planner_version: string;
  attempts_count: number;
  outcome: 'SUCCESS' | 'FAILED' | 'ABORTED';
  details_json: string;
  created_at: string;
}

export interface PublicationAttemptRecord {
  id: number;
  execution_id: string;
  attempt_number: number;
  claimed_by_worker: string | null;
  outcome: 'SUCCESS' | 'RETRYABLE_ERROR' | 'TERMINAL_ERROR' | 'BLOCKED';
  error_class: ErrorClass | null;
  reason_code: string | null;
  duration_ms: number;
  created_at: string;
}

export interface PublisherRunRecord {
  id: number;
  publisher_run_id: string;
  trigger_source: 'cron' | 'manual' | 'api' | 'test' | 'scheduler';
  due_count: number;
  claimed_count: number;
  published_count: number;
  retry_count: number;
  blocked_count: number;
  failed_count: number;
  duration_ms: number;
  executions_json: string;
  created_at: string;
}

export interface PrepublishValidationResult {
  isValid: boolean;
  errorClass?: ErrorClass;
  reasonCode?: PublisherReasonCode;
  details?: Record<string, any>;
  article?: {
    id: number;
    slug: string;
    title: string;
    content_hash: string;
    category_id: number;
    author_id: number;
  };
}

export interface ExecutionDispatchResult {
  executionId: string;
  planId: string;
  articleId: number;
  outcome: 'PUBLISHED' | 'RETRY_WAIT' | 'FAILED' | 'BLOCKED' | 'SKIPPED';
  reasonCode?: string;
  receiptId?: string;
  publishedAt?: string;
  canonicalUrl?: string;
}

export interface DispatchRunResult {
  runId: string;
  triggerSource: 'cron' | 'manual' | 'api' | 'test' | 'scheduler';
  dueCount: number;
  claimedCount: number;
  publishedCount: number;
  retryCount: number;
  blockedCount: number;
  failedCount: number;
  durationMs: number;
  results: ExecutionDispatchResult[];
  reason?: string;
}
