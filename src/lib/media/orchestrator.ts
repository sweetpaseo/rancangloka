/**
 * RancangLoka — Media Job Pipeline Orchestrator (MEDIA-A5.4)
 *
 * Coordinates execution of media jobs across stages with:
 * 1. Minimal Stage Resume:
 *    - Preserves upstream intermediate artifacts across stage retries
 *    - Failure at TRANSFORM resumes at TRANSFORM without re-running SOURCE
 *    - Failure at STORAGE resumes at STORAGE without re-running SOURCE or TRANSFORM
 *    - Failure at DELIVERY_VERIFY resumes at DELIVERY_VERIFY
 * 2. Authoritative Policy Authority:
 *    - 100% of failure evaluation delegates to classifyMediaRetry (retry-policy.ts)
 *    - 100% of retry state persistence delegates to applyMediaRetryDecision (durable-retry.ts)
 *    - Zero custom failure-code-to-status mappings in the orchestrator
 * 3. Bounded Local Executors (DI):
 *    - Completely dependency-injected executors
 *    - Supports deterministic fake / scripted test outcomes
 *    - FIREWALL: Zero live provider calls, zero fal.ai, zero sleep, zero production mutation
 * 4. Lease & Concurrency Protection:
 *    - Verifies active lease ownership and expiry
 *    - Rejects stale worker writes (OCC via job_revision)
 *    - Respects non-runnable state firewall
 */

import {
  classifyMediaRetry,
  type MediaRetryDecision,
  type MediaRetryStage,
  getMaxStageAttemptsForStage
} from './retry-policy.ts';
import {
  applyMediaRetryDecision,
  sanitizeErrorMessage,
  type ApplyMediaRetryDecisionResult
} from './durable-retry.ts';
import {
  getMediaJobById,
  isTerminalJobState,
  JOB_STATUS_COMPLETE,
  type MediaJobRecord
} from './jobs-service.ts';

export const NON_RUNNABLE_JOB_STATUSES = new Set([
  'COMPLETE',
  'FAILED_TERMINAL',
  'SUPERSEDED',
  'CANCELLED',
  'AUTH_REQUIRED',
  'PROVIDER_BLOCKED',
  'USER_ACTION_REQUIRED'
]);

export interface StageExecutionResult {
  success: boolean;
  artifact?: any;
  transformed?: any;
  stored?: any;
  delivery_url?: string;
  article_media_id?: number;
  failure_code?: string;
  error_message?: string;
  http_status?: number;
}

export interface ProcessMediaJobContext {
  db: any;
  job: MediaJobRecord;
  now: Date;
  deviceId?: string;
  idempotencyKey?: string;
  artifactStore: Map<string, any>;
  callCounts: Record<string, number>;
}

export interface MediaJobExecutors {
  sourceExecutor?: (job: MediaJobRecord, ctx: ProcessMediaJobContext) => Promise<StageExecutionResult>;
  qaExecutor?: (job: MediaJobRecord, artifact: any, ctx: ProcessMediaJobContext) => Promise<StageExecutionResult>;
  transformExecutor?: (job: MediaJobRecord, artifact: any, ctx: ProcessMediaJobContext) => Promise<StageExecutionResult>;
  storageExecutor?: (job: MediaJobRecord, transformed: any, ctx: ProcessMediaJobContext) => Promise<StageExecutionResult>;
  deliveryExecutor?: (job: MediaJobRecord, stored: any, ctx: ProcessMediaJobContext) => Promise<StageExecutionResult>;
  attachmentExecutor?: (job: MediaJobRecord, stored: any, ctx: ProcessMediaJobContext) => Promise<StageExecutionResult>;
}

export interface ProcessMediaJobOptions {
  deviceId?: string;
  now?: Date;
  idempotencyKey?: string;
  sourceChannel?: 'AUTONOMOUS_PROVIDER' | 'MANUAL_BROWSER_BRIDGE' | 'LOCAL_FIXTURE';
  provider?: string;
  artifactStore?: Map<string, any>;
  executors?: MediaJobExecutors;
  maxStageAttempts?: number | Record<string, number>;
}

export interface ProcessMediaJobResult {
  success: boolean;
  status: string;
  job_id: string;
  job_revision: number;
  attempt: number;
  stage_resumed_from?: MediaRetryStage | string;
  failure_code?: string;
  reason?: string;
  retry_decision?: MediaRetryDecision;
  durable_result?: ApplyMediaRetryDecisionResult;
  call_counts?: Record<string, number>;
}

/**
 * Creates default local mock executors that simulate successful pipeline progression.
 * Guarantees zero network, zero paid API, and zero live provider calls.
 */
export function createDefaultLocalExecutors(): MediaJobExecutors {
  return {
    async sourceExecutor(job) {
      return {
        success: true,
        artifact: {
          width: job.target_width || 1792,
          height: job.target_height || 1024,
          mime_type: 'image/webp',
          sha256: `sha256_mock_${job.job_id.slice(0, 8)}`,
          byte_size: 150000,
          provider: (job as any).provider || 'local_fixture',
          source_channel: (job as any).source_channel || 'LOCAL_FIXTURE'
        }
      };
    },
    async qaExecutor(_job, artifact) {
      return { success: true, artifact };
    },
    async transformExecutor(job, artifact) {
      return {
        success: true,
        transformed: {
          ...artifact,
          has_watermark: true,
          transformed_sha256: `sha256_wm_${job.job_id.slice(0, 8)}`
        }
      };
    },
    async storageExecutor(job, transformed) {
      return {
        success: true,
        stored: {
          ...transformed,
          asset_id: `asset_${job.job_id}`,
          r2_key: `media/images/${job.job_id}.webp`
        }
      };
    },
    async deliveryExecutor(_job, stored) {
      return {
        success: true,
        delivery_url: `https://media.rancangloka.com/${stored.r2_key}`
      };
    },
    async attachmentExecutor(job) {
      return {
        success: true,
        article_media_id: 100
      };
    }
  };
}

/**
 * Canonical Media Job Orchestration Engine (MEDIA-A5.4)
 *
 * Drives execution through one unified pipeline with strict stage resume and
 * single-authority retry classification.
 */
export async function processMediaJob(
  db: any,
  jobId: string,
  options: ProcessMediaJobOptions = {}
): Promise<ProcessMediaJobResult> {
  const now = options.now || new Date();
  const deviceId = options.deviceId;
  const artifactStore = options.artifactStore || new Map<string, any>();
  const defaultExecutors = createDefaultLocalExecutors();
  const executors: MediaJobExecutors = { ...defaultExecutors, ...options.executors };

  const callCounts: Record<string, number> = {
    source: 0,
    qa: 0,
    transform: 0,
    storage: 0,
    delivery: 0,
    attachment: 0
  };

  // 1. Fetch current job
  const fetchedJob = await getMediaJobById(db, jobId);
  if (!fetchedJob) {
    throw new Error(`Media job with ID '${jobId}' not found.`);
  }
  const currentJob: MediaJobRecord = fetchedJob;

  // 2. Non-runnable state firewall
  if (NON_RUNNABLE_JOB_STATUSES.has(currentJob.status)) {
    return {
      success: false,
      status: currentJob.status,
      job_id: jobId,
      job_revision: Number(currentJob.job_revision),
      attempt: Number(currentJob.attempt || 0),
      reason: 'NON_RUNNABLE_STATE_FIREWALL'
    };
  }

  // 3. Lease ownership & expiry verification
  if (deviceId) {
    if (currentJob.lease_owner && currentJob.lease_owner !== deviceId) {
      return {
        success: false,
        status: currentJob.status,
        job_id: jobId,
        job_revision: Number(currentJob.job_revision),
        attempt: Number(currentJob.attempt || 0),
        reason: 'LEASE_NOT_OWNED'
      };
    }
  }

  if (currentJob.lease_expires_at) {
    const expiresMs = new Date(currentJob.lease_expires_at).getTime();
    if (expiresMs <= now.getTime()) {
      return {
        success: false,
        status: currentJob.status,
        job_id: jobId,
        job_revision: Number(currentJob.job_revision),
        attempt: Number(currentJob.attempt || 0),
        reason: 'LEASE_EXPIRED'
      };
    }
  }

  const ctx: ProcessMediaJobContext = {
    db,
    job: currentJob,
    now,
    deviceId,
    idempotencyKey: options.idempotencyKey,
    artifactStore,
    callCounts
  };

  // 4. Centralized Failure Handler (Delegates 100% to classifyMediaRetry -> applyMediaRetryDecision)
  async function handleFailure(
    qaStage: MediaRetryStage,
    failureCode: string,
    errorMessage?: string,
    httpStatus?: number,
    artifactPresent: boolean = false
  ): Promise<ProcessMediaJobResult> {
    const policyInput = {
      failure_code: failureCode,
      qa_stage: qaStage,
      source_channel: options.sourceChannel || ((currentJob as any).source_channel as any) || 'AUTONOMOUS_PROVIDER',
      attempt_number: Number(currentJob.attempt || 0),
      max_attempts: Number(currentJob.max_attempts || 3),
      role: currentJob.role,
      slot_key: currentJob.slot_key,
      http_status: httpStatus,
      provider: options.provider || (currentJob as any).provider || undefined,
      has_bytes: artifactPresent
    };

    // AUTHORITATIVE SINGLE POLICY DECISION
    const decision = classifyMediaRetry(policyInput);
    if (errorMessage) {
      decision.evidence.reasons.unshift(sanitizeErrorMessage(errorMessage));
    }

    // Determine max stage budget
    let stageBudget: number | undefined;
    if (typeof options.maxStageAttempts === 'number') {
      stageBudget = options.maxStageAttempts;
    } else if (options.maxStageAttempts && typeof options.maxStageAttempts === 'object') {
      stageBudget = (options.maxStageAttempts as Record<string, number>)[decision.retry_stage];
    }
    if (stageBudget === undefined) {
      stageBudget = getMaxStageAttemptsForStage(decision.retry_stage);
    }

    // DURABLE ADAPTER PERSISTENCE
    const durableResult = await applyMediaRetryDecision(db, {
      jobId: currentJob.job_id,
      decision,
      expectedJobRevision: Number(currentJob.job_revision),
      now,
      idempotencyKey: options.idempotencyKey,
      maxStageAttempts: stageBudget
    });

    return {
      success: false,
      status: durableResult.status,
      job_id: currentJob.job_id,
      job_revision: durableResult.job_revision,
      attempt: durableResult.attempt,
      failure_code: failureCode,
      retry_decision: decision,
      durable_result: durableResult,
      call_counts: callCounts
    };
  }

  const job = currentJob;

  // 5. Minimal Stage Resume Resolution
  // Check artifact cache for previously completed stages
  const cachedArtifact = artifactStore.get(`${jobId}:source`);
  const cachedTransformed = artifactStore.get(`${jobId}:transform`);
  const cachedStored = artifactStore.get(`${jobId}:storage`);

  let resumeStage: MediaRetryStage = 'SOURCE_ACQUISITION';

  if (cachedStored) {
    resumeStage = 'DELIVERY_VERIFY';
  } else if (cachedTransformed) {
    resumeStage = 'STORAGE';
  } else if (cachedArtifact) {
    resumeStage = 'TRANSFORM';
  }

  // Track the actual stage we resumed from
  const actualResumedStage = resumeStage;

  let currentSource = cachedArtifact;
  let currentTransformed = cachedTransformed;
  let currentStored = cachedStored;

  // STAGE 1: SOURCE / GENERATION
  if (!currentSource && resumeStage === 'SOURCE_ACQUISITION') {
    callCounts.source++;
    const sourceRes = await executors.sourceExecutor!(job, ctx);
    if (!sourceRes.success) {
      artifactStore.delete(`${jobId}:source`);
      return handleFailure(
        'GENERATION',
        sourceRes.failure_code || 'UNKNOWN_SOURCE_ERROR',
        sourceRes.error_message,
        sourceRes.http_status,
        false
      );
    }
    currentSource = sourceRes.artifact;
    artifactStore.set(`${jobId}:source`, currentSource);

    // STAGE 2: ARTIFACT_QA
    callCounts.qa++;
    const qaRes = await executors.qaExecutor!(job, currentSource, ctx);
    if (!qaRes.success) {
      return handleFailure(
        'ARTIFACT_QA',
        qaRes.failure_code || 'INVALID_BINARY',
        qaRes.error_message,
        qaRes.http_status,
        true
      );
    }
  }

  // STAGE 3: TRANSFORM
  if (!currentTransformed && (resumeStage === 'SOURCE_ACQUISITION' || resumeStage === 'TRANSFORM')) {
    callCounts.transform++;
    const transformRes = await executors.transformExecutor!(job, currentSource, ctx);
    if (!transformRes.success) {
      return handleFailure(
        'TRANSFORM',
        transformRes.failure_code || 'WATERMARK_FAILED',
        transformRes.error_message,
        transformRes.http_status,
        true
      );
    }
    currentTransformed = transformRes.transformed;
    artifactStore.set(`${jobId}:transform`, currentTransformed);
  }

  // STAGE 4: STORAGE
  if (!currentStored && (resumeStage === 'SOURCE_ACQUISITION' || resumeStage === 'TRANSFORM' || resumeStage === 'STORAGE')) {
    callCounts.storage++;
    const storageRes = await executors.storageExecutor!(job, currentTransformed, ctx);
    if (!storageRes.success) {
      return handleFailure(
        'STORAGE',
        storageRes.failure_code || 'R2_UPLOAD_FAILED',
        storageRes.error_message,
        storageRes.http_status,
        true
      );
    }
    currentStored = storageRes.stored;
    artifactStore.set(`${jobId}:storage`, currentStored);
  }

  // STAGE 5: DELIVERY_VERIFY
  callCounts.delivery++;
  const deliveryRes = await executors.deliveryExecutor!(job, currentStored, ctx);
  if (!deliveryRes.success) {
    return handleFailure(
      'DELIVERY_VERIFY',
      deliveryRes.failure_code || 'PUBLIC_DELIVERY_FAILED',
      deliveryRes.error_message,
      deliveryRes.http_status,
      true
    );
  }

  // STAGE 6: ATTACHMENT
  callCounts.attachment++;
  const attachmentRes = await executors.attachmentExecutor!(job, currentStored, ctx);
  if (!attachmentRes.success) {
    return handleFailure(
      'ATTACHMENT',
      attachmentRes.failure_code || 'SLOT_OCCUPIED',
      attachmentRes.error_message,
      attachmentRes.http_status,
      true
    );
  }

  // 6. PIPELINE SUCCESS: Transition job to COMPLETE
  const completeRes = await db
    .prepare(
      `
      UPDATE media_jobs
      SET status = ?,
          completed_at = ?,
          lease_owner = NULL,
          lease_expires_at = NULL,
          heartbeat_at = NULL,
          last_error_code = NULL,
          last_error_message_safe = NULL,
          next_retry_at = NULL,
          job_revision = job_revision + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ? AND job_revision = ?
    `
    )
    .bind(JOB_STATUS_COMPLETE, now.toISOString(), jobId, job.job_revision)
    .run();

  const changes = Number(completeRes?.meta?.changes ?? completeRes?.changes ?? 0);
  if (changes !== 1) {
    const staleJob = await getMediaJobById(db, jobId);
    return {
      success: false,
      status: staleJob?.status || job.status,
      job_id: jobId,
      job_revision: Number(staleJob?.job_revision || job.job_revision),
      attempt: Number(staleJob?.attempt || job.attempt),
      reason: 'JOB_REVISION_CONFLICT'
    };
  }

  // Record completion event
  const eventId = `mje_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
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
      'JOB_COMPLETE',
      'COMPLETE',
      Number(job.attempt || 0),
      JSON.stringify({ status: 'COMPLETE', completed_at: now.toISOString() }),
      now.toISOString()
    )
    .run();

  const updatedJob = (await getMediaJobById(db, jobId))!;

  return {
    success: true,
    status: JOB_STATUS_COMPLETE,
    job_id: jobId,
    job_revision: Number(updatedJob.job_revision),
    attempt: Number(updatedJob.attempt),
    stage_resumed_from: actualResumedStage,
    call_counts: callCounts
  };
}
