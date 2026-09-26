/**
 * RancangLoka — Canonical Media Worker Runner & Handoff (MEDIA-A5.6)
 *
 * Implements the single canonical worker invocation for background media job execution:
 *   durable media job queue -> acquire lease -> processMediaJob -> persist state
 *
 * Architectural Invariants:
 * 1. ONE JOB PER INVOCATION: Maximum 1 job leased and executed per invocation.
 *    No daemon loops, no sleep, no batching.
 * 2. ACTIVATION GATE: Defaults strictly to OFF (MEDIA_WORKER_ENABLED=false).
 *    When disabled, acquires zero leases, mutates zero rows, calls zero providers.
 * 3. NO BUSINESS LOGIC DUPLICATION:
 *    - 100% of failure evaluation delegates to classifyMediaRetry (retry-policy.ts).
 *    - 100% of retry state persistence delegates to applyMediaRetryDecision (durable-retry.ts).
 *    - 100% of pipeline stage orchestration delegates to processMediaJob (orchestrator.ts).
 * 4. PROVIDER SAFETY GATE: Zero real network or paid API calls if credentials or provider toggle disabled.
 * 5. MANUAL BRIDGE BOUNDARY: MANUAL_BROWSER_BRIDGE jobs never call autonomous providers or browser automation.
 */

import {
  processMediaJob,
  createDefaultLocalExecutors,
  type MediaJobExecutors,
  type ProcessMediaJobResult
} from './orchestrator.ts';
import {
  acquireMediaJobLease,
  getMediaJobById,
  type MediaJobRecord
} from './jobs-service.ts';

export interface RunNextMediaJobOptions {
  deviceId?: string;
  now?: Date;
  executors?: MediaJobExecutors;
  artifactStore?: Map<string, any>;
  idempotencyKey?: string;
  sourceChannel?: string;
  provider?: string;
  forceWorkerEnabled?: boolean;
  allowMockSource?: boolean;
}

export interface RunNextMediaJobResult {
  executed: boolean;
  status: 'disabled' | 'no_job' | 'success' | 'failed' | 'error';
  code?: string;
  job_id?: string;
  lease_owner?: string;
  process_result?: ProcessMediaJobResult;
  reason?: string;
}

/**
 * Checks whether the media worker execution is activated.
 * Default is strictly OFF (false).
 */
export async function isMediaWorkerEnabled(db?: any, env: Record<string, any> = {}): Promise<boolean> {
  // 1. Environment variable / Worker binding takes precedence
  if (env.MEDIA_WORKER_ENABLED === 'true' || env.MEDIA_WORKER_ENABLED === true) {
    return true;
  }
  if (env.MEDIA_WORKER_ENABLED === 'false' || env.MEDIA_WORKER_ENABLED === false) {
    return false;
  }

  // 2. Fall back to D1 settings table if present
  if (db) {
    try {
      const row = await db.prepare("SELECT value FROM settings WHERE key = 'media_worker_enabled'").first();
      if (row && (row.value === 'true' || row.value === '1')) {
        return true;
      }
    } catch {
      // Ignore database read errors and fail safe
    }
  }

  // Default: strictly OFF
  return false;
}

/**
 * Resolves safe executors enforcing provider and bridge boundaries.
 */
function buildSafeRuntimeExecutors(options: RunNextMediaJobOptions, env: Record<string, any>): MediaJobExecutors {
  if (options.executors) {
    return { ...createDefaultLocalExecutors(), ...options.executors };
  }

  const defaultExecutors = createDefaultLocalExecutors();

  return {
    ...defaultExecutors,
    async sourceExecutor(job, ctx) {
      // 1. Manual Browser Bridge Boundary:
      if ((job as any).source_channel === 'MANUAL_BROWSER_BRIDGE' || options.sourceChannel === 'MANUAL_BROWSER_BRIDGE') {
        const cached = ctx.artifactStore?.get(`${job.job_id}:source`);
        if (cached) {
          return { success: true, artifact: cached };
        }
        return {
          success: false,
          failure_code: 'USER_ACTION_REQUIRED',
          error_message: 'Manual browser bridge artifact required from operator'
        };
      }

      // 2. Autonomous Provider Gate (Fal.ai):
      const providerExplicitlyDisabled = env.MEDIA_PROVIDER_ENABLED === 'false' || env.MEDIA_PROVIDER_ENABLED === false;
      const hasRealProviderKey = Boolean(env.FAL_KEY || (typeof process !== 'undefined' ? process.env?.FAL_KEY : ''));

      // If provider is explicitly disabled or Fal credentials requested but missing
      if (providerExplicitlyDisabled || (env.REQUIRE_PROVIDER_CREDENTIALS && !hasRealProviderKey)) {
        return {
          success: false,
          failure_code: 'PROVIDER_AUTH_FAILED',
          error_message: 'Autonomous media provider credentials not configured or disabled'
        };
      }

      // Default safe mock executor (zero network, local fixtures)
      return defaultExecutors.sourceExecutor!(job, ctx);
    }
  };
}

/**
 * Executes exactly ONE eligible media job from the durable queue.
 */
export async function runNextMediaJob(
  db: any,
  env: Record<string, any> = {},
  options: RunNextMediaJobOptions = {}
): Promise<RunNextMediaJobResult> {
  const now = options.now || new Date();
  const deviceId = options.deviceId || 'canonical_media_worker';

  // 1. Activation Gate: Check if media worker execution is enabled
  const enabled = options.forceWorkerEnabled !== undefined
    ? options.forceWorkerEnabled
    : await isMediaWorkerEnabled(db, env);

  if (!enabled) {
    return {
      executed: false,
      status: 'disabled',
      code: 'MEDIA_WORKER_DISABLED',
      reason: 'Media worker execution is currently disabled (OFF).'
    };
  }

  // 2. Acquire at most ONE eligible job lease
  const lease = await acquireMediaJobLease(db, deviceId, { now });
  if (!lease.acquired || !lease.job) {
    return {
      executed: false,
      status: 'no_job',
      code: lease.code || 'NO_ELIGIBLE_JOB',
      reason: 'No eligible queued or retryable media job found in durable queue.'
    };
  }

  const job = lease.job;
  const executors = buildSafeRuntimeExecutors(options, env);

  // 3. Process the leased job through unified canonical orchestrator
  const processResult = await processMediaJob(db, job.job_id, {
    deviceId,
    now,
    executors,
    artifactStore: options.artifactStore,
    idempotencyKey: options.idempotencyKey || `worker_exec_${job.job_id}_rev${job.job_revision}`,
    sourceChannel: options.sourceChannel || (job as any).source_channel,
    provider: options.provider || (job as any).provider
  });

  return {
    executed: true,
    status: processResult.success ? 'success' : 'failed',
    code: processResult.success
      ? 'JOB_COMPLETED'
      : (processResult.failure_code || processResult.reason || 'JOB_FAILED'),
    job_id: job.job_id,
    lease_owner: deviceId,
    process_result: processResult
  };
}
