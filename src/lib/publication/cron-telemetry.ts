/**
 * RancangLoka — Publication Automation Cron Heartbeat & Telemetry
 * Phase: 5L10
 *
 * Implements unified, append-only durable telemetry for native Cloudflare cron
 * runs and authenticated trigger invocations.
 *
 * Invariants:
 * 1. UNIFIED SCHEMA: All scheduled jobs record into publication_cron_runs.
 * 2. CORRELATED INVOCATION ID: Each run has a unique run_id (crun_<job>_<hex>).
 * 3. APPEND-ONLY RUNS: Heartbeat rows are inserted on start and completed with metrics.
 * 4. BLOCKED RUNS CLASSIFICATION: Safety blocks (mode=OFF, kill_switch, pauses)
 *    are recorded with status = 'BLOCKED', not 'FAILED'.
 * 5. TELEMETRY FAILURE POLICY:
 *    FAIL_CLOSED_ON_START: Failure to insert STARTED heartbeat aborts execution.
 *    SAFE_SURFACE_ON_FINALIZE: Failure to finalize heartbeat logs error without
 *    rolling back completed publication business action.
 * 6. SECRET FIREWALL: Sanitizes errors to strictly prevent tokens, credentials,
 *    and headers from being recorded or leaked.
 */

import { getAutomationControl } from '../safety/automation-controller.ts';

export const CRON_JOB_PLANNER = 'publication_planner' as const;
export const CRON_JOB_RECONCILER = 'auto_execution_reconciler' as const;
export const CRON_JOB_DISPATCHER = 'publication_dispatcher' as const;

export type CronJobIdentity =
  | typeof CRON_JOB_PLANNER
  | typeof CRON_JOB_RECONCILER
  | typeof CRON_JOB_DISPATCHER;

export type CronTriggerSource =
  | 'cloudflare_cron'
  | 'admin_http'
  | 'service_http'
  | 'test';

export type CronRunStatus =
  | 'STARTED'
  | 'SUCCEEDED'
  | 'BLOCKED'
  | 'FAILED';

export interface CronRunContext {
  runId: string;
  jobName: CronJobIdentity;
  triggerSource: CronTriggerSource;
  startedAt: string;
  automationMode?: string;
  killSwitchEngaged?: boolean;
}

/**
 * Sanitizes an error message or object to ensure no secrets, tokens,
 * passwords, or auth headers are stored in telemetry or returned to callers.
 */
export function sanitizeErrorSummary(error: any): string {
  if (!error) return 'Unknown error';
  let str = typeof error === 'string' ? error : error?.message || String(error);
  // Redact secrets, bearer tokens, media tokens
  str = str.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
  str = str.replace(/lkmd_[A-Za-z0-9_\-\.]+/gi, '[MEDIA_TOKEN_REDACTED]');
  str = str.replace(/token=[A-Za-z0-9_\-\.]+/gi, 'token=[REDACTED]');
  str = str.replace(/secret=[A-Za-z0-9_\-\.]+/gi, 'secret=[REDACTED]');
  str = str.replace(/password=[A-Za-z0-9_\-\.]+/gi, 'password=[REDACTED]');
  str = str.replace(/Authorization:\s*[^\r\n]+/gi, 'Authorization: [REDACTED]');
  // Bound string length
  if (str.length > 500) {
    str = str.slice(0, 497) + '...';
  }
  return str;
}

/**
 * Generates a unique, structured invocation correlation ID.
 */
export function generateCronRunId(jobName: CronJobIdentity): string {
  const shortName = jobName === CRON_JOB_PLANNER
    ? 'plan'
    : jobName === CRON_JOB_RECONCILER
    ? 'rec'
    : 'disp';
  const rand = crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) : Math.random().toString(36).substring(2, 10);
  return `crun_${shortName}_${rand}`;
}

/**
 * Starts a durable cron run record in publication_cron_runs with status 'STARTED'.
 * Inability to write this initial record fails closed (FAIL_CLOSED_ON_START).
 */
export async function startCronRun(
  db: any,
  jobName: CronJobIdentity,
  triggerSource: CronTriggerSource = 'cloudflare_cron',
  now: Date = new Date()
): Promise<CronRunContext> {
  const runId = generateCronRunId(jobName);
  const startedAt = now.toISOString();

  let mode = 'OFF';
  let killSwitch = 0;
  try {
    const ctrl = await getAutomationControl(db);
    mode = ctrl.mode || 'OFF';
    killSwitch = ctrl.kill_switch_engaged ? 1 : 0;
  } catch {
    // fallback if automation_control query fails
  }

  try {
    await db.prepare(`
      INSERT INTO publication_cron_runs (
        run_id, job_name, trigger_source, started_at, status,
        automation_mode, kill_switch_engaged, details_json, created_at
      ) VALUES (?, ?, ?, ?, 'STARTED', ?, ?, '{}', ?)
    `).bind(
      runId,
      jobName,
      triggerSource,
      startedAt,
      mode,
      killSwitch,
      startedAt
    ).run();
  } catch (err: any) {
    console.error(`[CronTelemetry] FATAL: Failed to establish STARTED heartbeat for ${jobName}:`, err);
    throw new Error(`CRON_TELEMETRY_START_FAILED: ${err.message}`);
  }

  return {
    runId,
    jobName,
    triggerSource,
    startedAt,
    automationMode: mode,
    killSwitchEngaged: killSwitch === 1
  };
}

/**
 * Completes a cron run record in publication_cron_runs.
 * Idempotent: multiple calls for the same run_id will update the single existing row.
 */
export async function completeCronRun(
  db: any,
  runContext: CronRunContext,
  result: {
    status: 'SUCCEEDED' | 'BLOCKED' | 'FAILED';
    processedCount?: number;
    createdCount?: number;
    blockedCount?: number;
    failedCount?: number;
    errorClass?: string;
    errorSummary?: string;
    detailsJson?: Record<string, any>;
  },
  now: Date = new Date()
): Promise<void> {
  const finishedAt = now.toISOString();
  const safeErrorSummary = result.errorSummary ? sanitizeErrorSummary(result.errorSummary) : null;
  const safeErrorClass = result.errorClass ? result.errorClass.slice(0, 100) : null;
  const detailsStr = JSON.stringify(result.detailsJson || {});

  try {
    await db.prepare(`
      UPDATE publication_cron_runs
      SET finished_at = ?,
          status = ?,
          processed_count = ?,
          created_count = ?,
          blocked_count = ?,
          failed_count = ?,
          error_class = ?,
          error_summary = ?,
          details_json = ?
      WHERE run_id = ?
    `).bind(
      finishedAt,
      result.status,
      result.processedCount ?? 0,
      result.createdCount ?? 0,
      result.blockedCount ?? 0,
      result.failedCount ?? 0,
      safeErrorClass,
      safeErrorSummary,
      detailsStr,
      runContext.runId
    ).run();
  } catch (err: any) {
    // SAFE_SURFACE_ON_FINALIZE: surface failure without canceling already completed actions
    console.error(`[CronTelemetry] ERROR: Failed to finalize heartbeat ${runContext.runId}:`, err);
  }
}

/**
 * Higher-order execution wrapper that executes a job with comprehensive durable telemetry.
 */
export async function runWithCronTelemetry<T extends {
  status: 'success' | 'blocked';
  reason?: string;
  processedCount?: number;
  createdCount?: number;
  blockedCount?: number;
  failedCount?: number;
  details?: any;
}>(
  db: any,
  jobName: CronJobIdentity,
  triggerSource: CronTriggerSource,
  fn: (runContext: CronRunContext) => Promise<T>,
  now?: Date
): Promise<T> {
  const runContext = await startCronRun(db, jobName, triggerSource, now);

  try {
    const result = await fn(runContext);

    if (result.status === 'blocked') {
      await completeCronRun(db, runContext, {
        status: 'BLOCKED',
        errorClass: 'SAFETY_BLOCK',
        errorSummary: result.reason || 'Safety block engaged',
        processedCount: result.processedCount ?? 0,
        createdCount: result.createdCount ?? 0,
        blockedCount: result.blockedCount ?? (result.processedCount ?? 1),
        failedCount: result.failedCount ?? 0,
        detailsJson: result.details
      }, now);
    } else {
      await completeCronRun(db, runContext, {
        status: 'SUCCEEDED',
        processedCount: result.processedCount ?? 0,
        createdCount: result.createdCount ?? 0,
        blockedCount: result.blockedCount ?? 0,
        failedCount: result.failedCount ?? 0,
        detailsJson: result.details
      }, now);
    }

    return result;
  } catch (err: any) {
    await completeCronRun(db, runContext, {
      status: 'FAILED',
      errorClass: err?.name || 'Error',
      errorSummary: sanitizeErrorSummary(err?.message || String(err)),
      detailsJson: { error: sanitizeErrorSummary(err?.message || String(err)) }
    }, now);
    throw err;
  }
}

/**
 * Retrieves latest heartbeat summaries for all publication cron jobs.
 */
export async function getLastCronHeartbeats(db: any) {
  const jobs: CronJobIdentity[] = [
    CRON_JOB_PLANNER,
    CRON_JOB_RECONCILER,
    CRON_JOB_DISPATCHER
  ];

  const results: Record<string, any> = {};

  for (const job of jobs) {
    const latest = await db.prepare(`
      SELECT * FROM publication_cron_runs
      WHERE job_name = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(job).first();

    const lastSuccess = await db.prepare(`
      SELECT finished_at, created_at FROM publication_cron_runs
      WHERE job_name = ? AND status = 'SUCCEEDED'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(job).first();

    const lastFailure = await db.prepare(`
      SELECT finished_at, created_at, error_class, error_summary FROM publication_cron_runs
      WHERE job_name = ? AND status = 'FAILED'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(job).first();

    results[job] = {
      latest: latest || null,
      lastSuccessAt: lastSuccess?.finished_at || lastSuccess?.created_at || null,
      lastFailureAt: lastFailure?.finished_at || lastFailure?.created_at || null,
      lastFailureError: lastFailure?.error_summary || null
    };
  }

  return results;
}
