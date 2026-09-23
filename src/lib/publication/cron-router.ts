/**
 * RancangLoka — Publication Automation Cron Router
 * Phase: 5L9
 *
 * Implements deterministic routing for native Cloudflare scheduled cron events
 * to canonical server services without self HTTP loops or secret dependencies.
 *
 * Invariants:
 * 1. DIRECT INVOCATION: Calls executePublicationPlanner, reconcileAutoPolicyPlansForExecution,
 *    and runPublisherDispatcher directly via D1 bindings (CRON_USES_SELF_HTTP_FETCH = NO).
 * 2. DETERMINISTIC ROUTING: Maps event.cron or event.job deterministically to a single job identity.
 * 3. NO CROSS-JOB CASCADE: Each cron job runs in total isolation. Failure in one job never
 *    opportunistically invokes another.
 * 4. NATIVE CRON INDEPENDENCE: Scheduled events do not require CRON_SECRET or HTTP headers.
 * 5. SAFETY & ERROR MODEL: Respects global kill-switch, automation mode capability matrix,
 *    and pause controls. Safety blocks fail closed returning structured status.
 *    Unexpected runtime errors are logged and bubbled for execution monitoring.
 * 6. LIFETIME MANAGEMENT: Coordinates async work via ctx.waitUntil.
 */

import { executePublicationPlanner } from './planner-service.ts';
import {
  reconcileAutoPolicyPlansForExecution,
  RECONCILER_DEFAULT_BATCH_LIMIT
} from './auto-policy-reconciler.ts';
import { runPublisherDispatcher } from './publisher-service.ts';
import {
  PLANNER_PROFILE_GROWING,
  CANONICAL_TIMEZONE,
  type PlannerProfile
} from './planner-types.ts';

import {
  runWithCronTelemetry,
  CRON_JOB_SHADOW_COLLECTOR,
  type CronTriggerSource
} from './cron-telemetry.ts';
import { runDecisionShadowCollector } from '../decision/shadow-collector.ts';

// Explicit internal Cron job identities
export const CRON_JOB_PLANNER = 'publication_planner' as const;
export const CRON_JOB_RECONCILER = 'auto_execution_reconciler' as const;
export const CRON_JOB_DISPATCHER = 'publication_dispatcher' as const;
export { CRON_JOB_SHADOW_COLLECTOR } from './cron-telemetry.ts';

export type CronJobIdentity =
  | typeof CRON_JOB_PLANNER
  | typeof CRON_JOB_RECONCILER
  | typeof CRON_JOB_DISPATCHER
  | typeof CRON_JOB_SHADOW_COLLECTOR;

// Canonical Cron Expressions
export const CRON_PLANNER_EXPRESSION = '0 * * * *';      // Hourly
export const CRON_RECONCILER_EXPRESSION = '*/5 * * * *';  // Every 5 minutes
export const CRON_DISPATCHER_EXPRESSION = '* * * * *';   // Every minute
export const CRON_COLLECTOR_EXPRESSION = '17 * * * *';   // 17 minutes past every hour (JEV-7A)

export interface ScheduledEvent {
  cron?: string;
  job?: string;
  scheduledTime?: number;
  type?: string;
}

export interface ExecutionContext {
  waitUntil: (promise: Promise<any>) => void;
  passThroughOnException?: () => void;
}

export interface CronExecutionResult {
  status: 'success' | 'blocked' | 'failed' | 'ignored';
  job?: CronJobIdentity;
  cron?: string;
  reason?: string;
  error?: string;
  details?: any;
  durationMs?: number;
}

/**
 * Resolves an incoming ScheduledEvent to an explicit internal CronJobIdentity.
 * Deterministic mapping:
 * - Explicit job name match (highest precedence)
 * - Exact cron expression match
 */
export function resolveCronJobIdentity(event: ScheduledEvent): CronJobIdentity | null {
  if (event.job) {
    if (
      event.job === CRON_JOB_PLANNER ||
      event.job === CRON_JOB_RECONCILER ||
      event.job === CRON_JOB_DISPATCHER ||
      event.job === CRON_JOB_SHADOW_COLLECTOR
    ) {
      return event.job;
    }
  }

  const cron = event.cron?.trim();
  if (!cron) {
    return null;
  }

  if (cron === CRON_PLANNER_EXPRESSION) {
    return CRON_JOB_PLANNER;
  }

  if (cron === CRON_RECONCILER_EXPRESSION) {
    return CRON_JOB_RECONCILER;
  }

  if (cron === CRON_DISPATCHER_EXPRESSION || cron === '*/1 * * * *') {
    return CRON_JOB_DISPATCHER;
  }

  if (cron === CRON_COLLECTOR_EXPRESSION) {
    return CRON_JOB_SHADOW_COLLECTOR;
  }

  return null;
}

/**
 * Retrieves the configured planner profile from database settings, or falls back
 * to the canonical default PLANNER_PROFILE_GROWING.
 */
async function resolvePlannerProfile(db: any): Promise<PlannerProfile> {
  try {
    const row = await db
      .prepare("SELECT value FROM settings WHERE key = 'planner_profile' LIMIT 1")
      .first();
    if (row && typeof row.value === 'string' && row.value.trim().length > 0) {
      return row.value.trim() as PlannerProfile;
    }
  } catch {
    // default to canonical profile
  }
  return PLANNER_PROFILE_GROWING;
}

/**
 * Executes a single, isolated Cron job by identity wrapped with durable run telemetry.
 */
export async function executeCronJob(
  job: CronJobIdentity,
  db: any,
  _env?: any,
  triggerSource: CronTriggerSource = 'cloudflare_cron'
): Promise<CronExecutionResult> {
  const startTime = Date.now();

  switch (job) {
    case CRON_JOB_PLANNER: {
      try {
        const result = await runWithCronTelemetry(
          db,
          CRON_JOB_PLANNER,
          triggerSource,
          async () => {
            const profile = await resolvePlannerProfile(db);
            try {
              const res = await executePublicationPlanner(db, {
                actor: 'cron',
                plannerMode: 'auto',
                profile,
                env: _env
              });
              return {
                status: 'success' as const,
                processedCount: res.eligibleCount || 0,
                createdCount: res.plannedCount || 0,
                blockedCount: res.blockedCount || 0,
                failedCount: 0,
                details: res
              };
            } catch (err: any) {
              const message = err?.message || String(err);
              if (
                message.includes('KILL_SWITCH_ENGAGED') ||
                message.includes('AUTOMATION_MODE_') ||
                message.includes('PLANNER_PAUSED')
              ) {
                console.warn(`[CronRouter] publication_planner safely blocked: ${message}`);
                return {
                  status: 'blocked' as const,
                  reason: message,
                  processedCount: 0,
                  createdCount: 0,
                  blockedCount: 1,
                  failedCount: 0,
                  details: { reason: message }
                };
              }
              console.error(`[CronRouter] publication_planner failed with unexpected error:`, err);
              throw err;
            }
          }
        );

        return {
          status: result.status,
          job: CRON_JOB_PLANNER,
          reason: result.reason,
          details: result.details,
          durationMs: Date.now() - startTime
        };
      } catch (err: any) {
        throw err;
      }
    }

    case CRON_JOB_RECONCILER: {
      try {
        const result = await runWithCronTelemetry(
          db,
          CRON_JOB_RECONCILER,
          triggerSource,
          async () => {
            const res = await reconcileAutoPolicyPlansForExecution(db, {
              batchLimit: RECONCILER_DEFAULT_BATCH_LIMIT,
              actor: 'auto_scheduler'
            });

            const isBlocked = res.status === 'blocked';
            if (isBlocked) {
              console.warn(`[CronRouter] auto_execution_reconciler blocked: ${res.reason}`);
            }

            return {
              status: isBlocked ? ('blocked' as const) : ('success' as const),
              reason: res.reason,
              processedCount: res.processedCount,
              createdCount: res.scheduledCount,
              blockedCount: res.blockedCount,
              failedCount: res.failedCount,
              details: res
            };
          }
        );

        return {
          status: result.status,
          job: CRON_JOB_RECONCILER,
          reason: result.reason,
          details: result.details,
          durationMs: Date.now() - startTime
        };
      } catch (err: any) {
        console.error(`[CronRouter] auto_execution_reconciler failed with unexpected error:`, err);
        throw err;
      }
    }

    case CRON_JOB_DISPATCHER: {
      try {
        const result = await runWithCronTelemetry(
          db,
          CRON_JOB_DISPATCHER,
          triggerSource,
          async () => {
            const res = await runPublisherDispatcher(db, {
              triggerSource: 'cron'
            });

            const isBlocked =
              res.reason === 'KILL_SWITCH_ENGAGED' ||
              res.reason === 'AUTOMATION_MODE_OFF' ||
              res.reason === 'UNATTENDED_PUBLISH_BLOCKED' ||
              res.reason === 'PUBLISHER_PAUSED';

            if (isBlocked) {
              console.warn(`[CronRouter] publication_dispatcher blocked: ${res.reason}`);
            }

            return {
              status: isBlocked ? ('blocked' as const) : ('success' as const),
              reason: res.reason,
              processedCount: (res as any).scanned || (res as any).due_count || 0,
              createdCount: (res as any).published || (res as any).published_count || 0,
              blockedCount: (res as any).blocked || (res as any).blocked_count || 0,
              failedCount: (res as any).failed || (res as any).failed_count || 0,
              details: res
            };
          }
        );

        return {
          status: result.status,
          job: CRON_JOB_DISPATCHER,
          reason: result.reason,
          details: result.details,
          durationMs: Date.now() - startTime
        };
      } catch (err: any) {
        console.error(`[CronRouter] publication_dispatcher failed with unexpected error:`, err);
        throw err;
      }
    }

    case CRON_JOB_SHADOW_COLLECTOR: {
      try {
        const result = await runWithCronTelemetry(
          db,
          CRON_JOB_SHADOW_COLLECTOR,
          triggerSource,
          async (runContext) => {
            const res = await runDecisionShadowCollector(db, _env, {
              triggerSource,
              runId: runContext.runId
            });

            const isBlocked = res.status === 'blocked';
            return {
              status: isBlocked ? ('blocked' as const) : ('success' as const),
              reason: res.reason,
              processedCount: res.processedCount,
              createdCount: res.observationCreatedCount,
              blockedCount: isBlocked ? 1 : 0,
              failedCount: res.providerErrorCount,
              details: {
                ...res.details,
                dedupeSkippedCount: res.dedupeSkippedCount,
                providerCallCount: res.providerCallCount
              }
            };
          }
        );

        return {
          status: result.status,
          job: CRON_JOB_SHADOW_COLLECTOR,
          reason: result.reason,
          details: result.details,
          durationMs: Date.now() - startTime
        };
      } catch (err: any) {
        console.error(`[CronRouter] jev_shadow_collector failed with unexpected error:`, err);
        throw err;
      }
    }

    default: {
      return {
        status: 'ignored',
        reason: `UNKNOWN_CRON_JOB: ${job}`,
        durationMs: Date.now() - startTime
      };
    }
  }
}

/**
 * Main Cloudflare scheduled handler entrypoint.
 * Routes scheduled events deterministically and protects execution lifecycle.
 */
export async function handleScheduledEvent(
  event: ScheduledEvent,
  env: any,
  ctx?: ExecutionContext
): Promise<CronExecutionResult> {
  const db = env?.DB;
  if (!db) {
    const error = new Error('D1 database binding (DB) is missing from env');
    console.error('[CronRouter] FATAL: Missing DB binding');
    throw error;
  }

  const job = resolveCronJobIdentity(event);
  if (!job) {
    console.warn(
      `[CronRouter] Unrecognized cron expression or job name (cron="${event.cron}", job="${event.job}"). Skipping.`
    );
    return {
      status: 'ignored',
      cron: event.cron,
      reason: 'UNRECOGNIZED_CRON_SCHEDULE'
    };
  }

  const runPromise = executeCronJob(job, db, env);

  // Lifetime tracking: ensure background task promises are tracked by Cloudflare runtime
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(
      runPromise.catch((err) => {
        console.error(`[CronRouter] Uncaught error tracked in ctx.waitUntil for job ${job}:`, err);
      })
    );
  }

  return await runPromise;
}
