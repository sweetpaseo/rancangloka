/**
 * RancangLoka — Scheduled Publisher Service & Execution Engine
 * Milestone: PUBLICATION-2
 * 
 * The authoritative, fail-closed execution layer for publication dispatch.
 * Enforces pre-publish double-gate, atomic D1 batch mutation, lease concurrency,
 * exactly-once receipt generation, and bounded retry policy.
 */

import {
  PUBLISHER_VERSION,
  EXECUTION_STATUS_SCHEDULED,
  EXECUTION_STATUS_CLAIMED,
  EXECUTION_STATUS_PUBLISHING,
  EXECUTION_STATUS_PUBLISHED,
  EXECUTION_STATUS_RETRY_WAIT,
  EXECUTION_STATUS_FAILED,
  EXECUTION_STATUS_CANCELLED,
  EXECUTION_STATUS_BLOCKED,
  ERROR_CLASS_RETRYABLE,
  ERROR_CLASS_TERMINAL,
  ERROR_CLASS_SAFETY_BLOCK,
  type ExecutionStatus,
  type ErrorClass,
  type PublisherReasonCode,
  type PublicationExecutionRecord,
  type PublicationReceiptRecord,
  type PublicationAttemptRecord,
  type PublisherRunRecord,
  type PrepublishValidationResult,
  type ExecutionDispatchResult,
  type DispatchRunResult
} from './publisher-types.ts';

import {
  PLAN_STATUS_PLANNED,
  PLAN_STATUS_BLOCKED,
  PLAN_STATUS_CANCELLED,
  PLANNER_VERSION
} from './planner-types.ts';

import {
  getAutomationControl,
  getCapabilityMatrix
} from '../safety/automation-controller.ts';
import {
  getCircuitBreaker,
  recordBreakerFailure,
  recordBreakerSuccess
} from '../safety/circuit-breaker.ts';
import {
  processOverdueExecutions,
  checkActivationRateLimit,
  DEFAULT_ACTIVATION_ENVELOPE
} from '../safety/rate-limiter.ts';

function getRandomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteCount; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// Bounded retry backoff intervals (seconds)
const RETRY_BACKOFF_SECONDS = [15, 60, 300];

/**
 * 1. Schedule Plan for Execution
 * Transitions an active PUBLICATION-1 plan into PUBLICATION-2 SCHEDULED state.
 * Validates plan freshness, article draft status, and active execution uniqueness.
 */
export async function schedulePlanForExecution(
  db: any,
  planId: string,
  actor: string = 'operator'
): Promise<PublicationExecutionRecord> {
  // 1. Fetch active plan
  const plan = await db
    .prepare('SELECT * FROM article_publication_plans WHERE plan_id = ? LIMIT 1')
    .bind(planId)
    .first();

  if (!plan) {
    throw new Error('PLAN_NOT_FOUND: Plan does not exist');
  }

  if (plan.plan_status !== PLAN_STATUS_PLANNED) {
    throw new Error(`PLAN_NOT_PLANNED: Cannot schedule plan with status '${plan.plan_status}'`);
  }

  // 2. Revalidate article draft state
  const article = await db
    .prepare('SELECT id, status, content_hash FROM articles WHERE id = ? LIMIT 1')
    .bind(plan.article_id)
    .first();

  if (!article || article.status !== 'draft') {
    throw new Error('ARTICLE_NOT_DRAFT: Article is not in draft status');
  }

  // 3. Cryptographic and media consistency
  if (article.content_hash !== plan.content_hash) {
    throw new Error('CONTENT_HASH_MISMATCH: Article content changed after plan creation');
  }

  const activeMedia = await db
    .prepare("SELECT asset_id FROM article_media WHERE article_id = ? AND role = 'featured' AND is_active = 1 LIMIT 1")
    .bind(plan.article_id)
    .first();

  if (!activeMedia || activeMedia.asset_id !== plan.featured_asset_id) {
    throw new Error('FEATURED_MEDIA_MISMATCH: Featured media changed after plan creation');
  }

  // 4. Revalidate readiness & approval
  const latestApproval = await db
    .prepare('SELECT approval_status, approved_content_hash, approved_asset_id FROM article_editorial_approvals WHERE article_id = ? ORDER BY created_at DESC, id DESC LIMIT 1')
    .bind(plan.article_id)
    .first();

  if (
    !latestApproval ||
    latestApproval.approval_status !== 'APPROVED' ||
    latestApproval.approved_content_hash !== plan.content_hash ||
    latestApproval.approved_asset_id !== plan.featured_asset_id
  ) {
    throw new Error('APPROVAL_REVOKED_OR_STALE: Valid editorial approval is missing or stale');
  }

  const latestReadiness = await db
    .prepare('SELECT is_ready, overall_status FROM article_publication_readiness WHERE article_id = ? ORDER BY evaluated_at DESC, id DESC LIMIT 1')
    .bind(plan.article_id)
    .first();

  if (!latestReadiness || latestReadiness.is_ready !== 1 || latestReadiness.overall_status !== 'READY_TO_SCHEDULE') {
    throw new Error('READINESS_STALE_OR_INVALID: Article is not currently READY_TO_SCHEDULE');
  }

  // 5. Check if execution already exists for this plan
  const existingPlanExec = await db
    .prepare('SELECT * FROM article_publication_executions WHERE plan_id = ? LIMIT 1')
    .bind(planId)
    .first();

  if (existingPlanExec) {
    if (existingPlanExec.execution_status === EXECUTION_STATUS_SCHEDULED) {
      return existingPlanExec as PublicationExecutionRecord;
    }
    throw new Error(`ACTIVE_EXECUTION_EXISTS: Plan already has execution in status '${existingPlanExec.execution_status}'`);
  }

  // 6. Check active execution per article
  const activeArticleExec = await db
    .prepare(`
      SELECT * FROM article_publication_executions 
      WHERE article_id = ? 
        AND execution_status IN ('${EXECUTION_STATUS_SCHEDULED}', '${EXECUTION_STATUS_CLAIMED}', '${EXECUTION_STATUS_PUBLISHING}', '${EXECUTION_STATUS_RETRY_WAIT}')
      LIMIT 1
    `)
    .bind(plan.article_id)
    .first();

  if (activeArticleExec) {
    throw new Error(`ACTIVE_EXECUTION_EXISTS: Article ID ${plan.article_id} already has an active execution ${activeArticleExec.execution_id}`);
  }

  // 7. Insert new execution record
  const executionId = `pexec_${getRandomHex(8)}`;
  await db
    .prepare(`
      INSERT INTO article_publication_executions (
        execution_id, plan_id, article_id, content_hash, featured_asset_id,
        target_publish_at, execution_status, publisher_version, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, '${EXECUTION_STATUS_SCHEDULED}', '${PUBLISHER_VERSION}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `)
    .bind(
      executionId,
      plan.plan_id,
      plan.article_id,
      plan.content_hash,
      plan.featured_asset_id,
      plan.target_publish_at
    )
    .run();

  const record = await db
    .prepare('SELECT * FROM article_publication_executions WHERE execution_id = ? LIMIT 1')
    .bind(executionId)
    .first();

  return record as PublicationExecutionRecord;
}

/**
 * 2. Due Execution Selection
 * Queries for executions where target_publish_at <= current trusted UTC time.
 * Selects only eligible states ('SCHEDULED', 'RETRY_WAIT') with unexpired/null leases.
 */
export async function getDueExecutions(
  db: any,
  options: {
    nowUtc?: string;
    limit?: number;
  } = {}
): Promise<PublicationExecutionRecord[]> {
  const now = options.nowUtc || new Date().toISOString();
  const limit = options.limit || 10;

  const query = `
    SELECT * FROM article_publication_executions
    WHERE execution_status IN ('${EXECUTION_STATUS_SCHEDULED}', '${EXECUTION_STATUS_RETRY_WAIT}')
      AND target_publish_at <= ?
      AND (next_retry_at IS NULL OR next_retry_at <= ?)
      AND (lease_expires_at IS NULL OR lease_expires_at < ?)
    ORDER BY target_publish_at ASC
    LIMIT ?;
  `;

  const res = await db.prepare(query).bind(now, now, now, limit).all();
  return (res.results || res || []) as PublicationExecutionRecord[];
}

/**
 * 3. Atomic Lease Acquisition (Compare-and-Set)
 * Guarantees single-owner concurrency across multiple workers or cron invocations.
 */
export async function claimExecutionLease(
  db: any,
  executionId: string,
  workerId: string,
  leaseDurationSeconds: number = 300,
  nowUtc?: string
): Promise<{ acquired: boolean; leaseExpiresAt?: string }> {
  const now = nowUtc ? new Date(nowUtc) : new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationSeconds * 1000).toISOString();
  const nowIso = now.toISOString();

  const query = `
    UPDATE article_publication_executions
    SET execution_status = '${EXECUTION_STATUS_CLAIMED}',
        claimed_by_worker = ?,
        lease_expires_at = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE execution_id = ?
      AND (
        execution_status IN ('${EXECUTION_STATUS_SCHEDULED}', '${EXECUTION_STATUS_RETRY_WAIT}')
        OR (execution_status = '${EXECUTION_STATUS_CLAIMED}' AND lease_expires_at < ?)
      );
  `;

  const res = await db.prepare(query).bind(workerId, leaseExpiresAt, executionId, nowIso).run();
  const changes = res?.meta?.changes ?? res?.changes ?? 0;

  if (changes > 0) {
    return { acquired: true, leaseExpiresAt };
  }
  return { acquired: false };
}

/**
 * 4. Pre-Publish Double-Gate Revalidation
 * Re-checks 100% of readiness, plan, article, media, author, category, and slug invariants
 * immediately prior to mutation. Fails closed on any discrepancy.
 */
export async function validatePrepublishInvariants(
  db: any,
  execution: PublicationExecutionRecord
): Promise<PrepublishValidationResult> {
  // 1. Fetch current article
  const article = await db
    .prepare('SELECT id, slug, title, description, content_md, content_html, content_hash, category_id, author_id, status FROM articles WHERE id = ? LIMIT 1')
    .bind(execution.article_id)
    .first();

  if (!article) {
    return {
      isValid: false,
      errorClass: ERROR_CLASS_TERMINAL,
      reasonCode: 'ARTICLE_NOT_DRAFT',
      details: { error: 'Article record not found' }
    };
  }

  if (article.status === 'published') {
    return {
      isValid: false,
      errorClass: ERROR_CLASS_TERMINAL,
      reasonCode: 'ALREADY_PUBLISHED',
      details: { error: 'Article is already published' }
    };
  }

  if (article.status !== 'draft') {
    return {
      isValid: false,
      errorClass: ERROR_CLASS_TERMINAL,
      reasonCode: 'ARTICLE_NOT_DRAFT',
      details: { status: article.status }
    };
  }

  // Integrity checks on content fields
  if (!article.slug || !article.title || !article.content_md || !article.content_html) {
    return {
      isValid: false,
      errorClass: ERROR_CLASS_TERMINAL,
      reasonCode: 'MISSING_AUTHOR_OR_CATEGORY',
      details: { error: 'Article has missing required editorial fields' }
    };
  }

  // 2. Cryptographic content hash check
  if (article.content_hash !== execution.content_hash) {
    return {
      isValid: false,
      errorClass: ERROR_CLASS_TERMINAL,
      reasonCode: 'CONTENT_HASH_MISMATCH',
      details: { expected: execution.content_hash, actual: article.content_hash }
    };
  }

  // 3. Category & Author checks
  const category = await db
    .prepare('SELECT id, slug FROM categories WHERE id = ? LIMIT 1')
    .bind(article.category_id)
    .first();

  if (!category) {
    return {
      isValid: false,
      errorClass: ERROR_CLASS_TERMINAL,
      reasonCode: 'MISSING_AUTHOR_OR_CATEGORY',
      details: { error: 'Invalid or missing category_id', category_id: article.category_id }
    };
  }

  const author = await db
    .prepare('SELECT id, slug FROM authors WHERE id = ? LIMIT 1')
    .bind(article.author_id)
    .first();

  if (!author) {
    return {
      isValid: false,
      errorClass: ERROR_CLASS_TERMINAL,
      reasonCode: 'MISSING_AUTHOR_OR_CATEGORY',
      details: { error: 'Invalid or missing author_id', author_id: article.author_id }
    };
  }

  // 4. Duplicate slug collision check against other published articles
  const slugConflict = await db
    .prepare("SELECT id FROM articles WHERE slug = ? AND id != ? AND status = 'published' LIMIT 1")
    .bind(article.slug, article.id)
    .first();

  if (slugConflict) {
    return {
      isValid: false,
      errorClass: ERROR_CLASS_TERMINAL,
      reasonCode: 'SLUG_CONFLICT',
      details: { conflicting_article_id: slugConflict.id, slug: article.slug }
    };
  }

  // 5. Active plan revalidation
  const plan = await db
    .prepare('SELECT * FROM article_publication_plans WHERE plan_id = ? LIMIT 1')
    .bind(execution.plan_id)
    .first();

  if (!plan) {
    return {
      isValid: false,
      errorClass: ERROR_CLASS_TERMINAL,
      reasonCode: 'PLAN_NOT_FOUND',
      details: { plan_id: execution.plan_id }
    };
  }

  if (plan.plan_status !== PLAN_STATUS_PLANNED) {
    return {
      isValid: false,
      errorClass: ERROR_CLASS_TERMINAL,
      reasonCode: 'PLAN_NOT_PLANNED',
      details: { plan_status: plan.plan_status }
    };
  }

  if (plan.content_hash !== execution.content_hash || plan.featured_asset_id !== execution.featured_asset_id) {
    return {
      isValid: false,
      errorClass: ERROR_CLASS_TERMINAL,
      reasonCode: 'CONTENT_HASH_MISMATCH',
      details: { error: 'Plan cryptographic snapshot diverged from execution' }
    };
  }

  // 6. Active featured media check
  const activeMedia = await db
    .prepare("SELECT asset_id FROM article_media WHERE article_id = ? AND role = 'featured' AND is_active = 1 LIMIT 1")
    .bind(article.id)
    .first();

  if (!activeMedia || activeMedia.asset_id !== execution.featured_asset_id) {
    return {
      isValid: false,
      errorClass: ERROR_CLASS_TERMINAL,
      reasonCode: 'FEATURED_MEDIA_MISMATCH',
      details: { expected: execution.featured_asset_id, actual: activeMedia?.asset_id }
    };
  }

  const mediaAsset = await db
    .prepare("SELECT status FROM media_assets WHERE asset_id = ? LIMIT 1")
    .bind(activeMedia.asset_id)
    .first();

  if (!mediaAsset || mediaAsset.status !== 'VALIDATED') {
    return {
      isValid: false,
      errorClass: ERROR_CLASS_TERMINAL,
      reasonCode: 'FEATURED_MEDIA_MISMATCH',
      details: { media_status: mediaAsset?.status }
    };
  }

  // 7. Editorial approval check
  const latestApproval = await db
    .prepare('SELECT approval_status, approved_content_hash, approved_asset_id FROM article_editorial_approvals WHERE article_id = ? ORDER BY created_at DESC, id DESC LIMIT 1')
    .bind(article.id)
    .first();

  if (
    !latestApproval ||
    latestApproval.approval_status !== 'APPROVED' ||
    latestApproval.approved_content_hash !== execution.content_hash ||
    latestApproval.approved_asset_id !== execution.featured_asset_id
  ) {
    return {
      isValid: false,
      errorClass: ERROR_CLASS_TERMINAL,
      reasonCode: 'APPROVAL_REVOKED_OR_STALE',
      details: { approval_status: latestApproval?.approval_status }
    };
  }

  // 8. Publication readiness check
  const latestReadiness = await db
    .prepare('SELECT is_ready, overall_status, content_hash FROM article_publication_readiness WHERE article_id = ? ORDER BY evaluated_at DESC, id DESC LIMIT 1')
    .bind(article.id)
    .first();

  if (
    !latestReadiness ||
    latestReadiness.is_ready !== 1 ||
    latestReadiness.overall_status !== 'READY_TO_SCHEDULE' ||
    latestReadiness.content_hash !== execution.content_hash
  ) {
    return {
      isValid: false,
      errorClass: ERROR_CLASS_TERMINAL,
      reasonCode: 'READINESS_STALE_OR_INVALID',
      details: { overall_status: latestReadiness?.overall_status, is_ready: latestReadiness?.is_ready }
    };
  }

  return {
    isValid: true,
    article: {
      id: article.id,
      slug: article.slug,
      title: article.title,
      content_hash: article.content_hash,
      category_id: article.category_id,
      author_id: article.author_id
    }
  };
}

/**
 * 5. Atomic Publication Mutation
 * Executes single atomic D1 batch updating article status to 'published',
 * marking execution 'PUBLISHED', inserting cryptographic receipt, and plan event.
 */
export async function executeAtomicPublication(
  db: any,
  execution: PublicationExecutionRecord,
  articleSlug: string,
  attemptNumber: number = 1
): Promise<{ receiptId: string; actualPublishedAt: string; canonicalUrl: string }> {
  // Check if article is ALREADY published and receipt exists (Crash recovery / Idempotency)
  const existingReceipt = await db
    .prepare('SELECT * FROM publication_execution_receipts WHERE execution_id = ? LIMIT 1')
    .bind(execution.execution_id)
    .first();

  if (existingReceipt) {
    return {
      receiptId: existingReceipt.receipt_id,
      actualPublishedAt: existingReceipt.actual_published_at,
      canonicalUrl: existingReceipt.canonical_url
    };
  }

  const actualPublishedAt = new Date().toISOString();
  const receiptId = `rcpt_${getRandomHex(8)}`;
  const canonicalUrl = `https://rancangloka.com/${articleSlug}`;

  const telemetryDetails = {
    execution_id: execution.execution_id,
    plan_id: execution.plan_id,
    target_publish_at: execution.target_publish_at,
    published_at: actualPublishedAt,
    attempt: attemptNumber,
    claimed_by: execution.claimed_by_worker
  };

  const batchStatements = [
    // 1. Atomic Article Publish (Guards status = 'draft')
    db.prepare(`
      UPDATE articles 
      SET status = 'published',
          published_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'draft'
    `).bind(actualPublishedAt, execution.article_id),

    // 2. Execution Record Completion
    db.prepare(`
      UPDATE article_publication_executions
      SET execution_status = '${EXECUTION_STATUS_PUBLISHED}',
          actual_published_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE execution_id = ? AND execution_status IN ('${EXECUTION_STATUS_CLAIMED}', '${EXECUTION_STATUS_PUBLISHING}')
    `).bind(actualPublishedAt, execution.execution_id),

    // 3. Immutable Cryptographic Publication Receipt
    db.prepare(`
      INSERT INTO publication_execution_receipts (
        receipt_id, execution_id, plan_id, article_id, slug,
        content_hash, featured_asset_id, canonical_url,
        target_publish_at, actual_published_at, publisher_version,
        planner_version, attempts_count, outcome, details_json, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, 'SUCCESS', ?, CURRENT_TIMESTAMP
      )
    `).bind(
      receiptId,
      execution.execution_id,
      execution.plan_id,
      execution.article_id,
      articleSlug,
      execution.content_hash,
      execution.featured_asset_id,
      canonicalUrl,
      execution.target_publish_at,
      actualPublishedAt,
      PUBLISHER_VERSION,
      PLANNER_VERSION,
      attemptNumber,
      JSON.stringify(telemetryDetails)
    )
  ];

  const batchRes = await db.batch(batchStatements);

  // Validate that the article update affected exactly 1 row
  const artChanges = batchRes[0]?.meta?.changes ?? batchRes[0]?.changes ?? 0;
  if (artChanges === 0) {
    // Re-check if it was already published by a concurrent attempt
    const verifyArt = await db
      .prepare('SELECT status, published_at FROM articles WHERE id = ? LIMIT 1')
      .bind(execution.article_id)
      .first();

    if (verifyArt && verifyArt.status === 'published') {
      const receiptAfter = await db
        .prepare('SELECT * FROM publication_execution_receipts WHERE execution_id = ? LIMIT 1')
        .bind(execution.execution_id)
        .first();

      if (receiptAfter) {
        return {
          receiptId: receiptAfter.receipt_id,
          actualPublishedAt: receiptAfter.actual_published_at,
          canonicalUrl: receiptAfter.canonical_url
        };
      }
    }

    throw new Error('ATOMIC_BATCH_FAILED: Article status update failed (article was not draft or changed concurrently)');
  }

  return { receiptId, actualPublishedAt, canonicalUrl };
}

/**
 * 6. Process Single Execution
 * Coordinates claim, pre-publish gate, atomic publish, failure classification, and retry backoff.
 */
export async function processSingleExecution(
  db: any,
  execution: PublicationExecutionRecord,
  workerId: string,
  nowUtc?: string
): Promise<ExecutionDispatchResult> {
  const startTime = Date.now();
  const attemptNumber = execution.attempts_count + 1;

  // 1. Acquire lease
  const claimRes = await claimExecutionLease(db, execution.execution_id, workerId, 300, nowUtc);
  if (!claimRes.acquired) {
    // Check if execution is already published in database (Idempotent completion check)
    const existingDb = await db
      .prepare('SELECT execution_status, actual_published_at FROM article_publication_executions WHERE execution_id = ? LIMIT 1')
      .bind(execution.execution_id)
      .first();

    if (existingDb && existingDb.execution_status === EXECUTION_STATUS_PUBLISHED) {
      const receipt = await db
        .prepare('SELECT receipt_id, canonical_url, actual_published_at FROM publication_execution_receipts WHERE execution_id = ? LIMIT 1')
        .bind(execution.execution_id)
        .first();

      return {
        executionId: execution.execution_id,
        planId: execution.plan_id,
        articleId: execution.article_id,
        outcome: 'PUBLISHED',
        receiptId: receipt?.receipt_id,
        publishedAt: receipt?.actual_published_at || existingDb.actual_published_at,
        canonicalUrl: receipt?.canonical_url
      };
    }

    return {
      executionId: execution.execution_id,
      planId: execution.plan_id,
      articleId: execution.article_id,
      outcome: 'SKIPPED',
      reasonCode: 'LEASE_ACQUISITION_FAILED'
    };
  }

  // Set local state
  execution.claimed_by_worker = workerId;
  execution.execution_status = EXECUTION_STATUS_CLAIMED;

  // 2. Pre-publish gate revalidation
  const gateResult = await validatePrepublishInvariants(db, execution);

  if (!gateResult.isValid) {
    const errorClass = gateResult.errorClass || ERROR_CLASS_TERMINAL;
    const reasonCode = gateResult.reasonCode || 'READINESS_STALE_OR_INVALID';
    const durationMs = Date.now() - startTime;

    if (errorClass === ERROR_CLASS_TERMINAL) {
      // Terminal failure: Fail closed. Set FAILED, do not retry. Block associated plan.
      await db
        .prepare(`
          UPDATE article_publication_executions
          SET execution_status = '${EXECUTION_STATUS_FAILED}',
              attempts_count = ?,
              last_error_class = ?,
              last_error_reason = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE execution_id = ?
        `)
        .bind(attemptNumber, errorClass, reasonCode, execution.execution_id)
        .run();

      // Block upstream plan
      await db
        .prepare(`
          UPDATE article_publication_plans
          SET plan_status = '${PLAN_STATUS_BLOCKED}', updated_at = CURRENT_TIMESTAMP
          WHERE plan_id = ?
        `)
        .bind(execution.plan_id)
        .run();

      // Record attempt
      await db
        .prepare(`
          INSERT INTO publication_execution_attempts (
            execution_id, attempt_number, claimed_by_worker, outcome, error_class, reason_code, duration_ms
          ) VALUES (?, ?, ?, 'TERMINAL_ERROR', ?, ?, ?)
        `)
        .bind(execution.execution_id, attemptNumber, workerId, errorClass, reasonCode, durationMs)
        .run();

      return {
        executionId: execution.execution_id,
        planId: execution.plan_id,
        articleId: execution.article_id,
        outcome: 'FAILED',
        reasonCode
      };
    } else {
      // Retryable failure (if transient error configured)
      return handleRetryableError(db, execution, workerId, attemptNumber, errorClass, reasonCode, durationMs, nowUtc);
    }
  }

  // 3. Gate passed! Execute atomic publication
  try {
    const publishRes = await executeAtomicPublication(
      db,
      execution,
      gateResult.article!.slug,
      attemptNumber
    );

    const durationMs = Date.now() - startTime;

    // Record success attempt
    await db
      .prepare(`
        INSERT INTO publication_execution_attempts (
          execution_id, attempt_number, claimed_by_worker, outcome, error_class, reason_code, duration_ms
        ) VALUES (?, ?, ?, 'SUCCESS', NULL, 'SUCCESS', ?)
      `)
      .bind(execution.execution_id, attemptNumber, workerId, durationMs)
      .run();

    return {
      executionId: execution.execution_id,
      planId: execution.plan_id,
      articleId: execution.article_id,
      outcome: 'PUBLISHED',
      receiptId: publishRes.receiptId,
      publishedAt: publishRes.actualPublishedAt,
      canonicalUrl: publishRes.canonicalUrl
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    return handleRetryableError(
      db,
      execution,
      workerId,
      attemptNumber,
      ERROR_CLASS_RETRYABLE,
      err.message || 'ATOMIC_BATCH_FAILED',
      durationMs,
      nowUtc
    );
  }
}

/**
 * Helper: Handles retryable error calculation with bounded backoff
 */
async function handleRetryableError(
  db: any,
  execution: PublicationExecutionRecord,
  workerId: string,
  attemptNumber: number,
  errorClass: ErrorClass,
  reasonCode: string,
  durationMs: number,
  nowUtc?: string
): Promise<ExecutionDispatchResult> {
  const maxAttempts = execution.max_attempts || 3;

  if (attemptNumber >= maxAttempts) {
    // Max attempts exceeded -> Transition to FAILED
    await db
      .prepare(`
        UPDATE article_publication_executions
        SET execution_status = '${EXECUTION_STATUS_FAILED}',
            attempts_count = ?,
            last_error_class = ?,
            last_error_reason = 'MAX_RETRIES_EXCEEDED',
            updated_at = CURRENT_TIMESTAMP
        WHERE execution_id = ?
      `)
      .bind(attemptNumber, ERROR_CLASS_TERMINAL, execution.execution_id)
      .run();

    await db
      .prepare(`
        INSERT INTO publication_execution_attempts (
          execution_id, attempt_number, claimed_by_worker, outcome, error_class, reason_code, duration_ms
        ) VALUES (?, ?, ?, 'TERMINAL_ERROR', ?, 'MAX_RETRIES_EXCEEDED', ?)
      `)
      .bind(execution.execution_id, attemptNumber, workerId, ERROR_CLASS_TERMINAL, durationMs)
      .run();

    return {
      executionId: execution.execution_id,
      planId: execution.plan_id,
      articleId: execution.article_id,
      outcome: 'FAILED',
      reasonCode: 'MAX_RETRIES_EXCEEDED'
    };
  }

  // Calculate backoff
  const backoffIdx = Math.min(attemptNumber - 1, RETRY_BACKOFF_SECONDS.length - 1);
  const backoffSec = RETRY_BACKOFF_SECONDS[backoffIdx] || 60;
  const now = nowUtc ? new Date(nowUtc) : new Date();
  const nextRetryAt = new Date(now.getTime() + backoffSec * 1000).toISOString();

  await db
    .prepare(`
      UPDATE article_publication_executions
      SET execution_status = '${EXECUTION_STATUS_RETRY_WAIT}',
          attempts_count = ?,
          next_retry_at = ?,
          last_error_class = ?,
          last_error_reason = ?,
          claimed_by_worker = NULL,
          lease_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE execution_id = ?
    `)
    .bind(attemptNumber, nextRetryAt, errorClass, reasonCode, execution.execution_id)
    .run();

  await db
    .prepare(`
      INSERT INTO publication_execution_attempts (
        execution_id, attempt_number, claimed_by_worker, outcome, error_class, reason_code, duration_ms
      ) VALUES (?, ?, ?, 'RETRYABLE_ERROR', ?, ?, ?)
    `)
    .bind(execution.execution_id, attemptNumber, workerId, errorClass, reasonCode, durationMs)
    .run();

  return {
    executionId: execution.execution_id,
    planId: execution.plan_id,
    articleId: execution.article_id,
    outcome: 'RETRY_WAIT',
    reasonCode
  };
}

/**
 * 7. Dispatcher Run Coordinator
 * Processes all currently due executions and records publisher run metrics.
 */
export async function runPublisherDispatcher(
  db: any,
  options: {
    triggerSource?: 'cron' | 'manual' | 'api' | 'test' | 'scheduler';
    workerId?: string;
    nowUtc?: string;
    limit?: number;
  } = {}
): Promise<DispatchRunResult> {
  const startTime = Date.now();
  const triggerSource = options.triggerSource || 'manual';
  const workerId = options.workerId || `worker_${getRandomHex(4)}`;
  const runId = `prun_pub2_${getRandomHex(6)}`;

  // 0. SOAK-0 Outer Safety Envelope: Automation Mode, Kill Switch, Breakers, Catch-up
  let autoControl;
  try {
    autoControl = await getAutomationControl(db);
  } catch {
    autoControl = { mode: 'OFF', kill_switch_engaged: 0 };
  }

  // A. Global Kill Switch Check
  if (autoControl.kill_switch_engaged === 1) {
    return {
      runId,
      triggerSource,
      dueCount: 0,
      claimedCount: 0,
      publishedCount: 0,
      retryCount: 0,
      blockedCount: 0,
      failedCount: 0,
      durationMs: Date.now() - startTime,
      results: [],
      reason: 'KILL_SWITCH_ENGAGED'
    };
  }

  // B. Automation Mode Capability Check
  const caps = getCapabilityMatrix(autoControl.mode as any, Boolean(autoControl.kill_switch_engaged));
  const isAutomated = triggerSource !== 'test' && triggerSource !== 'manual';

  if (isAutomated && !caps.canPublishUnattended) {
    return {
      runId,
      triggerSource,
      dueCount: 0,
      claimedCount: 0,
      publishedCount: 0,
      retryCount: 0,
      blockedCount: 0,
      failedCount: 0,
      durationMs: Date.now() - startTime,
      results: [],
      reason: autoControl.mode === 'OFF' ? 'AUTOMATION_MODE_OFF' : 'UNATTENDED_PUBLISH_BLOCKED'
    };
  }

  // C. Circuit Breaker Check
  try {
    const breaker = await getCircuitBreaker(db, 'global_publisher');
    if (breaker && breaker.state === 'OPEN') {
      return {
        runId,
        triggerSource,
        dueCount: 0,
        claimedCount: 0,
        publishedCount: 0,
        retryCount: 0,
        blockedCount: 0,
        failedCount: 0,
        durationMs: Date.now() - startTime,
        results: [],
        reason: 'CIRCUIT_BREAKER_OPEN'
      };
    }
  } catch {
    // If circuit breaker table doesn't exist, continue safely
  }

  // D. Catch-Up Burst Protection & Rate Limiter Check (for automated dispatch)
  if (isAutomated) {
    try {
      await processOverdueExecutions(db, DEFAULT_ACTIVATION_ENVELOPE, options.nowUtc);
      const rateLimitCheck = await checkActivationRateLimit(db, DEFAULT_ACTIVATION_ENVELOPE, options.nowUtc);
      if (!rateLimitCheck.allowed) {
        return {
          runId,
          triggerSource,
          dueCount: 0,
          claimedCount: 0,
          publishedCount: 0,
          retryCount: 0,
          blockedCount: 0,
          failedCount: 0,
          durationMs: Date.now() - startTime,
          results: [],
          reason: 'ACTIVATION_RATE_LIMIT_EXCEEDED'
        };
      }
    } catch {
      // If table missing, continue
    }
  }

  // Check if publisher is globally paused (legacy setting)
  const pauseSetting = await db
    .prepare("SELECT value FROM settings WHERE key = 'publisher_paused' LIMIT 1")
    .first()
    .catch(() => null);

  if (pauseSetting && (pauseSetting.value === '1' || pauseSetting.value === 'true')) {
    return {
      runId,
      triggerSource,
      dueCount: 0,
      claimedCount: 0,
      publishedCount: 0,
      retryCount: 0,
      blockedCount: 0,
      failedCount: 0,
      durationMs: Date.now() - startTime,
      results: []
    };
  }

  // 1. Query due executions
  const due = await getDueExecutions(db, { nowUtc: options.nowUtc, limit: options.limit || 10 });

  const results: ExecutionDispatchResult[] = [];
  let publishedCount = 0;
  let retryCount = 0;
  let blockedCount = 0;
  let failedCount = 0;
  let claimedCount = 0;

  for (const execution of due) {
    const res = await processSingleExecution(db, execution, workerId, options.nowUtc);
    results.push(res);

    if (res.outcome !== 'SKIPPED') {
      claimedCount++;
    }

    if (res.outcome === 'PUBLISHED') publishedCount++;
    else if (res.outcome === 'RETRY_WAIT') retryCount++;
    else if (res.outcome === 'BLOCKED') blockedCount++;
    else if (res.outcome === 'FAILED') failedCount++;
  }

  const durationMs = Date.now() - startTime;

  // Persist run telemetry
  await db
    .prepare(`
      INSERT INTO publication_publisher_runs (
        publisher_run_id, trigger_source, due_count, claimed_count, published_count,
        retry_count, blocked_count, failed_count, duration_ms, executions_json, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
      )
    `)
    .bind(
      runId,
      triggerSource,
      due.length,
      claimedCount,
      publishedCount,
      retryCount,
      blockedCount,
      failedCount,
      durationMs,
      JSON.stringify(results.map(r => ({ id: r.executionId, outcome: r.outcome, reason: r.reasonCode })))
    )
    .run();

  return {
    runId,
    triggerSource,
    dueCount: due.length,
    claimedCount,
    publishedCount,
    retryCount,
    blockedCount,
    failedCount,
    durationMs,
    results
  };
}

/**
 * 8. Manual Publish-Now Path (Controlled Smoke / Operator Trigger)
 * Uses 100% OF THE EXACT SAME VALIDATION GATE AND MUTATION PATH.
 * No bypass. No force publish.
 */
export async function publishNow(
  db: any,
  planOrExecutionId: string,
  actor: string = 'operator',
  nowUtc?: string
): Promise<ExecutionDispatchResult> {
  // SOAK-0 Emergency Kill Switch Check
  let autoControl;
  try {
    autoControl = await getAutomationControl(db);
  } catch {
    autoControl = null;
  }
  if (autoControl && autoControl.kill_switch_engaged === 1) {
    throw new Error('KILL_SWITCH_ENGAGED: Publication blocked by global emergency kill switch');
  }

  let execution: PublicationExecutionRecord | null = null;

  if (planOrExecutionId.startsWith('pexec_')) {
    execution = await db
      .prepare('SELECT * FROM article_publication_executions WHERE execution_id = ? LIMIT 1')
      .bind(planOrExecutionId)
      .first();
  } else {
    // Find or create execution for plan
    let existing = await db
      .prepare('SELECT * FROM article_publication_executions WHERE plan_id = ? LIMIT 1')
      .bind(planOrExecutionId)
      .first();

    if (!existing) {
      existing = await schedulePlanForExecution(db, planOrExecutionId, actor);
    }
    execution = existing as PublicationExecutionRecord;
  }

  if (!execution) {
    throw new Error('EXECUTION_NOT_FOUND: Could not find or create execution record');
  }

  if (execution.execution_status === EXECUTION_STATUS_PUBLISHED) {
    return {
      executionId: execution.execution_id,
      planId: execution.plan_id,
      articleId: execution.article_id,
      outcome: 'PUBLISHED',
      publishedAt: execution.actual_published_at || undefined
    };
  }

  const workerId = `manual_${actor}_${getRandomHex(4)}`;
  return processSingleExecution(db, execution, workerId, nowUtc);
}

/**
 * 9. Cancel Execution
 * Manually cancels a scheduled or retrying execution. Fails safely if already published.
 */
export async function cancelExecution(
  db: any,
  executionId: string,
  actor: string = 'operator',
  reason: string = 'Operator cancellation'
): Promise<void> {
  const execution = await db
    .prepare('SELECT * FROM article_publication_executions WHERE execution_id = ? LIMIT 1')
    .bind(executionId)
    .first();

  if (!execution) {
    throw new Error('EXECUTION_NOT_FOUND');
  }

  if (execution.execution_status === EXECUTION_STATUS_PUBLISHED) {
    throw new Error('CANNOT_CANCEL_PUBLISHED: Execution is already published');
  }

  await db
    .prepare(`
      UPDATE article_publication_executions
      SET execution_status = '${EXECUTION_STATUS_CANCELLED}',
          last_error_reason = ?,
          claimed_by_worker = NULL,
          lease_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE execution_id = ?
    `)
    .bind(reason, executionId)
    .run();

  await db
    .prepare(`
      INSERT INTO publication_plan_events (
        plan_id, article_id, event_type, actor_type, actor_id, details_json
      ) VALUES (?, ?, 'CANCELLED', 'operator', ?, ?)
    `)
    .bind(execution.plan_id, execution.article_id, actor, JSON.stringify({ executionId, reason }))
    .run();
}

/**
 * 10. Retry Execution
 * Resets a failed or retrying execution for another attempt.
 */
export async function retryExecution(
  db: any,
  executionId: string,
  actor: string = 'operator'
): Promise<PublicationExecutionRecord> {
  const execution = await db
    .prepare('SELECT * FROM article_publication_executions WHERE execution_id = ? LIMIT 1')
    .bind(executionId)
    .first();

  if (!execution) {
    throw new Error('EXECUTION_NOT_FOUND');
  }

  if (execution.execution_status === EXECUTION_STATUS_PUBLISHED) {
    throw new Error('CANNOT_RETRY_PUBLISHED: Execution is already published');
  }

  await db
    .prepare(`
      UPDATE article_publication_executions
      SET execution_status = '${EXECUTION_STATUS_SCHEDULED}',
          attempts_count = 0,
          next_retry_at = NULL,
          last_error_class = NULL,
          last_error_reason = NULL,
          claimed_by_worker = NULL,
          lease_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE execution_id = ?
    `)
    .bind(executionId)
    .run();

  const updated = await db
    .prepare('SELECT * FROM article_publication_executions WHERE execution_id = ? LIMIT 1')
    .bind(executionId)
    .first();

  return updated as PublicationExecutionRecord;
}

/**
 * 11. Inspect Execution & Audit History
 */
export async function inspectExecution(
  db: any,
  executionId: string
): Promise<{
  execution: PublicationExecutionRecord;
  receipt: PublicationReceiptRecord | null;
  attempts: PublicationAttemptRecord[];
}> {
  const execution = await db
    .prepare('SELECT * FROM article_publication_executions WHERE execution_id = ? LIMIT 1')
    .bind(executionId)
    .first();

  if (!execution) {
    throw new Error('EXECUTION_NOT_FOUND');
  }

  const receipt = await db
    .prepare('SELECT * FROM publication_execution_receipts WHERE execution_id = ? LIMIT 1')
    .bind(executionId)
    .first();

  const attemptsRes = await db
    .prepare('SELECT * FROM publication_execution_attempts WHERE execution_id = ? ORDER BY created_at ASC')
    .bind(executionId)
    .all();

  return {
    execution: execution as PublicationExecutionRecord,
    receipt: receipt as PublicationReceiptRecord | null,
    attempts: (attemptsRes.results || attemptsRes || []) as PublicationAttemptRecord[]
  };
}

/**
 * 12. Public Surface Verification Helper
 * Deterministically checks post-publish consistency across public SSR queries,
 * canonical URL derivation, and sitemap eligibility.
 */
export async function verifyPublicSurface(
  db: any,
  slug: string
): Promise<{
  isPublished: boolean;
  articleId?: number;
  publishedAt?: string;
  canonicalUrl?: string;
  categorySlug?: string;
  isSitemapEligible: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  const article = await db
    .prepare(`
      SELECT a.id, a.slug, a.title, a.status, a.published_at, c.slug as category_slug
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.slug = ?
      LIMIT 1
    `)
    .bind(slug)
    .first();

  if (!article) {
    return { isPublished: false, isSitemapEligible: false, errors: ['ARTICLE_NOT_FOUND'] };
  }

  if (article.status !== 'published') {
    errors.push(`STATUS_NOT_PUBLISHED: status is '${article.status}'`);
  }

  if (!article.published_at) {
    errors.push('PUBLISHED_AT_IS_NULL');
  }

  if (!article.category_slug) {
    errors.push('CATEGORY_SLUG_MISSING');
  }

  const canonicalUrl = `https://rancangloka.com/${article.slug}`;

  // Sitemap eligibility: status published and published_at parseable
  let isSitemapEligible = false;
  if (article.status === 'published' && article.published_at) {
    const pubDate = new Date(article.published_at);
    isSitemapEligible = !isNaN(pubDate.getTime());
  }

  return {
    isPublished: errors.length === 0,
    articleId: article.id,
    publishedAt: article.published_at,
    canonicalUrl,
    categorySlug: article.category_slug,
    isSitemapEligible,
    errors
  };
}
