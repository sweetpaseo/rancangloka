/**
 * RancangLoka — Activation Rate Limiter & Catch-Up Protection
 * Milestone: SOAK-0
 * 
 * Enforces:
 * - Temporary activation safety ceilings (e.g. max 2 publishes/24h, min 4h spacing)
 * - Safe effective capacity: min(PUB1_CAPACITY, ACTIVATION_SAFETY_CEILING)
 * - Anti-burst overdue processing (FIFO claim 1, reschedule spacing, supersede stale)
 */

import {
  type ActivationSafetyEnvelope,
  type OverdueProcessingSummary
} from './safety-types.ts';

export const DEFAULT_ACTIVATION_ENVELOPE: ActivationSafetyEnvelope = {
  maxPublishesPer24h: 2,
  minSpacingHours: 4.0,
  maxConcurrentPublishes: 1,
  maxCatchUpPerRun: 1,
  staleExecutionThresholdHours: 48
};

/**
 * 1. Compute Effective Daily Publication Capacity
 * Never raises PUB-1 capacity.
 */
export function computeEffectiveCapacity(
  pub1Capacity: number,
  activationEnvelope: ActivationSafetyEnvelope = DEFAULT_ACTIVATION_ENVELOPE
): number {
  return Math.min(pub1Capacity, activationEnvelope.maxPublishesPer24h);
}

/**
 * 2. Check if a new publication conforms to the activation rate envelope
 */
export async function checkActivationRateLimit(
  db: any,
  envelope: ActivationSafetyEnvelope = DEFAULT_ACTIVATION_ENVELOPE,
  nowIso: string = new Date().toISOString()
): Promise<{ allowed: boolean; reason?: string; recentPublishesCount: number; lastPublishTime?: string }> {
  const nowDate = new Date(nowIso);
  const windowStartIso = new Date(nowDate.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Query actual receipts published in the last 24 hours
  const recentReceipts = await db
    .prepare('SELECT actual_published_at as published_at FROM publication_execution_receipts WHERE actual_published_at >= ? ORDER BY actual_published_at DESC')
    .bind(windowStartIso)
    .all();

  const count = (recentReceipts?.results || []).length;
  if (count >= envelope.maxPublishesPer24h) {
    return {
      allowed: false,
      reason: `ACTIVATION_RATE_LIMIT_EXCEEDED: ${count}/${envelope.maxPublishesPer24h} publishes executed in last 24h`,
      recentPublishesCount: count,
      lastPublishTime: recentReceipts.results[0]?.published_at
    };
  }

  // Check minimum spacing against the most recent publish
  if (count > 0) {
    const lastPublishDate = new Date(recentReceipts.results[0].published_at);
    const elapsedHours = (nowDate.getTime() - lastPublishDate.getTime()) / (1000 * 60 * 60);

    if (elapsedHours < envelope.minSpacingHours) {
      return {
        allowed: false,
        reason: `MINIMUM_SPACING_VIOLATION: ${elapsedHours.toFixed(2)}h elapsed since last publish, minimum required is ${envelope.minSpacingHours}h`,
        recentPublishesCount: count,
        lastPublishTime: recentReceipts.results[0].published_at
      };
    }
  }

  return {
    allowed: true,
    recentPublishesCount: count,
    lastPublishTime: recentReceipts?.results?.[0]?.published_at
  };
}

/**
 * 3. Process Overdue Executions without Bursting
 * On restart/downtime recovery:
 * - Scans overdue executions (target_publish_at <= now AND execution_status = 'SCHEDULED')
 * - If overdueCount > 1, admits exactly ONE (FIFO)
 * - Supersedes executions older than 48 hours
 * - Reschedules remaining valid executions with >= 4h spacing
 */
export async function processOverdueExecutions(
  db: any,
  envelope: ActivationSafetyEnvelope = DEFAULT_ACTIVATION_ENVELOPE,
  nowIso: string = new Date().toISOString()
): Promise<OverdueProcessingSummary> {
  const nowDate = new Date(nowIso);

  // Fetch overdue scheduled executions ordered by target_publish_at ASC (FIFO)
  const overdueRows = await db
    .prepare(`
      SELECT execution_id, plan_id, target_publish_at, execution_status
      FROM article_publication_executions
      WHERE execution_status = 'SCHEDULED' AND target_publish_at <= ?
      ORDER BY target_publish_at ASC
    `)
    .bind(nowIso)
    .all();

  const overdue = overdueRows?.results || [];
  const summary: OverdueProcessingSummary = {
    overdueCount: overdue.length,
    admittedExecutionId: null,
    rescheduledExecutionIds: [],
    supersededExecutionIds: [],
    skippedDueToRateLimit: false
  };

  if (overdue.length === 0) {
    return summary;
  }

  // Check activation rate limit
  const rateLimit = await checkActivationRateLimit(db, envelope, nowIso);
  if (!rateLimit.allowed) {
    summary.skippedDueToRateLimit = true;
    return summary;
  }

  const staleThresholdMs = envelope.staleExecutionThresholdHours * 60 * 60 * 1000;
  let admitted = false;
  let nextRescheduleTime = new Date(nowDate.getTime() + envelope.minSpacingHours * 60 * 60 * 1000);

  for (let i = 0; i < overdue.length; i++) {
    const item = overdue[i];
    const itemTargetDate = new Date(item.target_publish_at);
    const ageMs = nowDate.getTime() - itemTargetDate.getTime();

    if (ageMs > staleThresholdMs) {
      // Stale execution (> 48h): SUPERSEDE and block
      await db
        .prepare(`
          UPDATE article_publication_executions
          SET execution_status = 'CANCELLED',
              last_error_reason = 'SUPERSEDED_STALE_OVERDUE: Exceeded 48h threshold'
          WHERE execution_id = ?
        `)
        .bind(item.execution_id)
        .run();

      await db
        .prepare(`
          UPDATE article_publication_plans
          SET plan_status = 'CANCELLED'
          WHERE plan_id = ?
        `)
        .bind(item.plan_id)
        .run();

      summary.supersededExecutionIds.push(item.execution_id);
      continue;
    }

    if (!admitted) {
      // Admit exactly ONE execution for immediate processing
      summary.admittedExecutionId = item.execution_id;
      admitted = true;
    } else {
      // Remaining executions: Reschedule into future spacing
      const newTargetIso = nextRescheduleTime.toISOString();
      await db
        .prepare(`
          UPDATE article_publication_executions
          SET target_publish_at = ?
          WHERE execution_id = ?
        `)
        .bind(newTargetIso, item.execution_id)
        .run();

      summary.rescheduledExecutionIds.push(item.execution_id);
      // Advance next scheduled slot by spacing
      nextRescheduleTime = new Date(nextRescheduleTime.getTime() + envelope.minSpacingHours * 60 * 60 * 1000);
    }
  }

  return summary;
}
