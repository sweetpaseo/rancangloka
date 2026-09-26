/**
 * RancangLoka — Durable Media Retry Accounting & Decision Adapter (MEDIA-A5.3)
 *
 * Integrates:
 *   MediaQaResult / failure_code -> retry-policy.ts -> durable media_jobs / events / receipts
 *
 * Core Invariants:
 * 1. Single Authoritative Policy: All retry decisions are determined by retry-policy.ts.
 * 2. Stage-Aware Attempt Accounting:
 *    - Generation / Source retries consume media_jobs.attempt (bounded by max_attempts)
 *    - Transform (watermark) & Storage (R2) retries do NOT consume generation attempt budget.
 *      Instead, stage attempts are counted durably from media_job_events.
 * 3. Terminal State Protection: Never reopens COMPLETE, FAILED_TERMINAL, SUPERSEDED, or CANCELLED jobs.
 * 4. Stale Decision Rejection (OCC): Mismatched job_revision fails closed without overwriting newer state.
 * 5. Scheduling Idempotency: Re-applying the same decision with identical idempotencyKey or state
 *    does not double-increment attempts or double-schedule retries.
 * 6. Secret Firewall: Leaked tokens, authorization headers, or cookies are redacted before DB write.
 * 7. 100% Side-Effect Free from Providers: Zero provider calls, zero sleep, zero R2 writes.
 */

import {
  decideMediaRetryPolicy,
  type MediaRetryDecision,
  type MediaRetryPolicyInput,
  type MediaRetryStage
} from './retry-policy.ts';
import {
  JOB_STATUS_QUEUED,
  JOB_STATUS_LEASED,
  JOB_STATUS_COMPLETE,
  JOB_STATUS_FAILED_TERMINAL,
  JOB_STATUS_SUPERSEDED,
  JOB_STATUS_CANCELLED,
  JOB_STATUS_WAITING_RETRY,
  JOB_STATUS_AUTH_REQUIRED,
  JOB_STATUS_PROVIDER_BLOCKED,
  JOB_STATUS_USER_ACTION_REQUIRED,
  isTerminalJobState,
  getMediaJobById,
  type MediaJobRecord
} from './jobs-service.ts';

export interface ApplyMediaRetryDecisionParams {
  jobId: string;
  decision: MediaRetryDecision;
  expectedJobRevision?: number;
  now?: Date;
  idempotencyKey?: string;
  maxStageAttempts?: number;
}

export interface ApplyMediaRetryDecisionResult {
  applied: boolean;
  status: string;
  attempt: number;
  stage_attempt: number;
  next_retry_at: string | null;
  job_revision: number;
  reason?: string;
  event_id?: string;
  receipt_id?: string;
}

const SECRET_PATTERNS = [
  /bearer\s+[a-zA-Z0-9._~+/-]+=*/gi,
  /fal_key_[a-zA-Z0-9_-]+/gi,
  /api_?key[:=]\s*['"]?[a-zA-Z0-9_-]+['"]?/gi,
  /token[:=]\s*['"]?[a-zA-Z0-9._~+/-]+['"]?/gi,
  /cookie[:=]\s*['"]?[^'";\n]+['"]?/gi,
  /secret[:=]\s*['"]?[a-zA-Z0-9._~+/-]+['"]?/gi
];

/**
 * Sanitizes an error message or string before durable persistence to prevent secret leaks.
 */
export function sanitizeErrorMessage(message: string | null | undefined): string {
  if (!message) return '';
  let sanitized = String(message);
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
  }
  return sanitized.trim();
}

/**
 * Counts durable stage retries recorded in media_job_events for a specific job and stage.
 */
export async function countStageRetries(db: any, jobId: string, stage: string): Promise<number> {
  const row = await db
    .prepare(
      `
      SELECT COUNT(*) as cnt
      FROM media_job_events
      WHERE job_id = ?
        AND stage = ?
    `
    )
    .bind(jobId, stage)
    .first();

  return Number(row?.cnt || 0);
}

/**
 * Authoritative Durable Retry Adapter: Applies a MediaRetryDecision to a durable media_jobs record.
 */
export async function applyMediaRetryDecision(
  db: any,
  params: ApplyMediaRetryDecisionParams
): Promise<ApplyMediaRetryDecisionResult> {
  const {
    jobId,
    decision,
    expectedJobRevision,
    now = new Date(),
    idempotencyKey,
    maxStageAttempts = 3
  } = params;

  // 1. Fetch current durable job state
  const job = await getMediaJobById(db, jobId);
  if (!job) {
    throw new Error(`Media job with ID '${jobId}' not found.`);
  }

  // 2. Terminal State Protection: Cannot retry a terminal job
  if (isTerminalJobState(job.status)) {
    return {
      applied: false,
      status: job.status,
      attempt: Number(job.attempt || 0),
      stage_attempt: 0,
      next_retry_at: null,
      job_revision: Number(job.job_revision),
      reason: 'TERMINAL_STATE_PROTECTED'
    };
  }

  // 3. Stale Decision Protection (OCC)
  if (expectedJobRevision !== undefined && Number(job.job_revision) !== Number(expectedJobRevision)) {
    return {
      applied: false,
      status: job.status,
      attempt: Number(job.attempt || 0),
      stage_attempt: 0,
      next_retry_at: job.next_retry_at,
      job_revision: Number(job.job_revision),
      reason: 'JOB_REVISION_CONFLICT'
    };
  }

  // 4. Idempotency Check via Receipts
  if (idempotencyKey) {
    const existingReceipt = await db
      .prepare(
        `
        SELECT receipt_id, receipt_type, created_at
        FROM media_job_receipts
        WHERE job_id = ? AND idempotency_key = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
      )
      .bind(jobId, idempotencyKey)
      .first();

    if (existingReceipt) {
      const stageAttempt = decision.retry_stage !== 'NONE'
        ? await countStageRetries(db, jobId, decision.retry_stage)
        : 0;

      return {
        applied: false,
        status: job.status,
        attempt: Number(job.attempt || 0),
        stage_attempt: stageAttempt,
        next_retry_at: job.next_retry_at,
        job_revision: Number(job.job_revision),
        receipt_id: String(existingReceipt.receipt_id),
        reason: 'IDEMPOTENT_ALREADY_APPLIED'
      };
    }
  }

  // Also check if already in the target status with identical error code & attempt
  if (
    job.status === decision.next_job_status &&
    job.last_error_code === decision.evidence.failure_code &&
    !decision.consume_attempt
  ) {
    const stageAttempt = decision.retry_stage !== 'NONE'
      ? await countStageRetries(db, jobId, decision.retry_stage)
      : 0;

    return {
      applied: false,
      status: job.status,
      attempt: Number(job.attempt || 0),
      stage_attempt: stageAttempt,
      next_retry_at: job.next_retry_at,
      job_revision: Number(job.job_revision),
      reason: 'IDEMPOTENT_ALREADY_APPLIED'
    };
  }

  // 5. Stage Retry Accounting vs Global Generation Attempt Accounting
  const isSameStageRetry = decision.retry_class === 'RETRY_SAME_STAGE' && decision.retry_stage !== 'NONE';
  let stageAttempt = 0;

  if (isSameStageRetry) {
    const currentStageRetries = await countStageRetries(db, jobId, decision.retry_stage);
    stageAttempt = currentStageRetries + 1;
  }

  // Determine effective status & attempt values
  let finalStatus = decision.next_job_status;
  let nextAttempt = Number(job.attempt || 0);

  // If consume_attempt is true (provider generation / source retry), increment global attempt
  if (decision.consume_attempt) {
    nextAttempt = Number(job.attempt || 0) + 1;
    if (nextAttempt >= Number(job.max_attempts || 3)) {
      finalStatus = JOB_STATUS_FAILED_TERMINAL;
    }
  } else if (isSameStageRetry && stageAttempt >= maxStageAttempts) {
    // Stage-specific attempt budget exhaustion
    finalStatus = JOB_STATUS_FAILED_TERMINAL;
  }

  // Calculate next_retry_at
  let nextRetryAt: string | null = null;
  if (finalStatus === JOB_STATUS_WAITING_RETRY) {
    const delayMs = decision.suggested_delay_ms || 2000;
    nextRetryAt = new Date(now.getTime() + delayMs).toISOString();
  }

  // Sanitize error message and reasons
  const rawMsg = decision.evidence.reasons?.[0] || decision.terminal_reason || decision.operator_reason || decision.evidence.failure_code;
  const safeErrorMessage = sanitizeErrorMessage(rawMsg);

  // 6. Update media_jobs
  const res = await db
    .prepare(
      `
      UPDATE media_jobs
      SET status = ?,
          attempt = ?,
          next_retry_at = ?,
          last_error_code = ?,
          last_error_message_safe = ?,
          lease_owner = NULL,
          lease_expires_at = NULL,
          heartbeat_at = NULL,
          job_revision = job_revision + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ? AND job_revision = ?
    `
    )
    .bind(
      finalStatus,
      nextAttempt,
      nextRetryAt,
      decision.evidence.failure_code,
      safeErrorMessage,
      jobId,
      job.job_revision
    )
    .run();

  const changes = Number(res?.meta?.changes ?? res?.changes ?? 0);
  if (changes !== 1) {
    return {
      applied: false,
      status: job.status,
      attempt: Number(job.attempt || 0),
      stage_attempt: stageAttempt,
      next_retry_at: job.next_retry_at,
      job_revision: Number(job.job_revision),
      reason: 'JOB_REVISION_CONFLICT'
    };
  }

  const updatedJob = (await getMediaJobById(db, jobId))!;

  // 7. Emit durable media_job_event
  const eventId = `mje_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const eventType = finalStatus === JOB_STATUS_FAILED_TERMINAL ? 'JOB_FAILED' : 'JOB_PROGRESS';
  const eventStage = decision.retry_stage !== 'NONE' ? decision.retry_stage : finalStatus;

  const eventPayload = {
    failure_code: decision.evidence.failure_code,
    retry_class: decision.retry_class,
    retry_stage: decision.retry_stage,
    stage_attempt: stageAttempt,
    next_job_status: finalStatus,
    next_retry_at: nextRetryAt,
    consume_attempt: decision.consume_attempt,
    reasons: decision.evidence.reasons.map((r: string) => sanitizeErrorMessage(r))
  };

  await db
    .prepare(
      `
      INSERT INTO media_job_events (
        event_id, job_id, event_type, stage, attempt, safe_payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    )
    .bind(
      eventId,
      jobId,
      eventType,
      eventStage,
      nextAttempt,
      JSON.stringify(eventPayload),
      now.toISOString()
    )
    .run();

  // 8. Emit milestone receipt if idempotencyKey provided
  let receiptId: string | undefined;
  if (idempotencyKey) {
    receiptId = `mjr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const receiptType =
      finalStatus === JOB_STATUS_FAILED_TERMINAL ? 'TERMINAL_ERROR' :
      finalStatus === JOB_STATUS_WAITING_RETRY ? 'RETRYABLE_ERROR' :
      'REJECTED';

    await db
      .prepare(
        `
        INSERT OR IGNORE INTO media_job_receipts (
          receipt_id, job_id, idempotency_key, receipt_type, safe_payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
      )
      .bind(
        receiptId,
        jobId,
        idempotencyKey,
        receiptType,
        JSON.stringify(eventPayload),
        now.toISOString()
      )
      .run();
  }

  return {
    applied: true,
    status: updatedJob.status,
    attempt: Number(updatedJob.attempt),
    stage_attempt: stageAttempt,
    next_retry_at: updatedJob.next_retry_at,
    job_revision: Number(updatedJob.job_revision),
    event_id: eventId,
    receipt_id: receiptId
  };
}

/**
 * Reconciles scheduleMediaJobRetry from jobs-service.ts with authoritative retry policy.
 */
export async function executeDurableRetry(
  db: any,
  jobId: string,
  errorCode: string,
  options: {
    sourceChannel?: 'AUTONOMOUS_PROVIDER' | 'MANUAL_BROWSER_BRIDGE' | 'LOCAL_FIXTURE';
    qaStage?: MediaRetryStage | string;
    errorMessageSafe?: string;
    now?: Date;
    idempotencyKey?: string;
  } = {}
): Promise<ApplyMediaRetryDecisionResult> {
  const job = await getMediaJobById(db, jobId);
  if (!job) throw new Error(`Media job with ID '${jobId}' not found.`);

  const sourceChannel = options.sourceChannel || 'AUTONOMOUS_PROVIDER';
  const policyInput: MediaRetryPolicyInput = {
    failure_code: errorCode,
    qa_stage: options.qaStage,
    source_channel: sourceChannel,
    attempt_number: Number(job.attempt || 0),
    max_attempts: Number(job.max_attempts || 3),
    role: job.role,
    slot_key: job.slot_key
  };

  const decision = decideMediaRetryPolicy(policyInput);
  if (options.errorMessageSafe) {
    decision.evidence.reasons.unshift(options.errorMessageSafe);
  }

  return applyMediaRetryDecision(db, {
    jobId,
    decision,
    expectedJobRevision: job.job_revision,
    now: options.now || new Date(),
    idempotencyKey: options.idempotencyKey
  });
}
