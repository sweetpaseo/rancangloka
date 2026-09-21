/**
 * RancangLoka — Publication Automation Operations Status Service
 * Phase: 5L10
 *
 * Provides a canonical, read-only supervisory snapshot of the publication
 * automation system, including controls, pipeline counters, cron heartbeats,
 * stuck-work detection, receipt integrity checks, and high-signal derived alerts.
 *
 * Invariants:
 * 1. READ-ONLY: Never mutates or alters any operational or publication state.
 * 2. BOUNDED QUERIES: Uses bounded, indexed queries to prevent performance regressions.
 * 3. MODE-AWARE HEALTH: Distinguishes intentional safety blocks (mode=OFF) from failures.
 * 4. NOISE-CONTROLLED ALERTS: Normal operator states (mode=OFF, manual hold) do not produce
 *    critical noise.
 * 5. SECRET FIREWALL: All outputs are strictly sanitized with zero credentials or tokens.
 */

import {
  CRON_JOB_PLANNER,
  CRON_JOB_RECONCILER,
  CRON_JOB_DISPATCHER,
  type CronJobIdentity,
  sanitizeErrorSummary
} from './cron-telemetry.ts';

// Cadence and Staleness Thresholds (Section 18)
// Rationale:
// - Planner: hourly cadence (3600s). Multiplier 2.5x -> 9000s to allow for scheduling jitter.
// - Reconciler: 5-minute cadence (300s). Multiplier 3.0x -> 900s to tolerate brief worker reloads.
// - Dispatcher: 1-minute cadence (60s). Multiplier 3.0x -> 180s to quickly detect publishing loop stalls.
export const CADENCE_CONFIG: Record<CronJobIdentity, { cadenceSeconds: number; staleThresholdSeconds: number }> = {
  [CRON_JOB_PLANNER]: { cadenceSeconds: 3600, staleThresholdSeconds: 9000 },
  [CRON_JOB_RECONCILER]: { cadenceSeconds: 300, staleThresholdSeconds: 900 },
  [CRON_JOB_DISPATCHER]: { cadenceSeconds: 60, staleThresholdSeconds: 180 }
};

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type AlertType =
  | 'CRON_HEARTBEAT_MISSING'
  | 'EXECUTION_LEASE_EXPIRED'
  | 'TERMINAL_PUBLICATION_FAILURE'
  | 'STALE_BINDING_BLOCKED'
  | 'RECEIPT_INTEGRITY_ERROR'
  | 'KILL_SWITCH_ACTIVE'
  | 'DUPLICATE_RACE_DETECTED';

export interface DerivedAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  detected_at: string;
  article_id?: number;
  execution_id?: string;
  plan_id?: string;
  details?: Record<string, any>;
}

export interface JobHeartbeatStatus {
  job_name: CronJobIdentity;
  last_started_at: string | null;
  last_finished_at: string | null;
  last_status: 'STARTED' | 'SUCCEEDED' | 'BLOCKED' | 'FAILED' | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_failure_error: string | null;
  age_seconds: number | null;
  cadence_seconds: number;
  stale_threshold_seconds: number;
  is_stale: boolean;
  health: 'HEALTHY' | 'BLOCKED' | 'STALE' | 'ERROR' | 'UNKNOWN' | 'RUNNING';
}

export interface OperationsStatusSnapshot {
  timestamp: string;
  controls: {
    automation_mode: string;
    auto_schedule_enabled: boolean;
    kill_switch_engaged: boolean;
    kill_reason: string | null;
    planner_paused: boolean;
    publisher_paused: boolean;
    circuit_breakers: Array<{
      id: string;
      state: string;
      failure_count: number;
      last_failure_at: string | null;
      trip_reason: string | null;
    }>;
  };
  pipeline: {
    eligible_auto_policy_drafts: number;
    active_planned_count: number;
    scheduled_count: number;
    claimed_count: number;
    publishing_count: number;
    retry_wait_count: number;
    failed_count: number;
    manual_hold_count: number;
    published_24h_count: number;
  };
  heartbeats: Record<CronJobIdentity, JobHeartbeatStatus>;
  stuck_work: {
    stuck_executions: Array<{
      execution_id: string;
      article_id: number;
      execution_status: string;
      lease_expires_at: string | null;
      attempts_count: number;
    }>;
    stuck_plans: Array<{
      plan_id: string;
      article_id: number;
      created_at: string;
    }>;
  };
  terminal_failures: Array<{
    execution_id: string;
    article_id: number;
    error_class: string | null;
    error_summary: string | null;
    failed_at: string;
  }>;
  stale_bindings: Array<{
    execution_id: string;
    article_id: number;
    bound_hash: string;
    current_hash: string;
  }>;
  receipt_integrity: {
    missing_receipts: Array<{
      execution_id: string;
      article_id: number;
      published_at: string;
    }>;
    duplicate_receipts: Array<{
      execution_id: string;
      receipt_count: number;
    }>;
    hash_mismatches: Array<{
      receipt_id: string;
      execution_id: string;
      article_id: number;
    }>;
  };
  alerts: DerivedAlert[];
}

/**
 * Retrieves the full operations status snapshot.
 */
export async function getPublicationOperationsStatus(
  db: any,
  nowInput?: Date | string
): Promise<OperationsStatusSnapshot> {
  const now = nowInput instanceof Date
    ? nowInput
    : nowInput
    ? new Date(nowInput)
    : new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  // 1. Controls Snapshot
  let automationMode = 'OFF';
  let killSwitchEngaged = false;
  let killReason: string | null = null;
  try {
    const ctrl = await db.prepare(
      'SELECT mode, kill_switch_engaged, kill_reason FROM automation_control WHERE id = 1 LIMIT 1'
    ).first();
    if (ctrl) {
      automationMode = ctrl.mode || 'OFF';
      killSwitchEngaged = Number(ctrl.kill_switch_engaged) === 1;
      killReason = ctrl.kill_reason || null;
    }
  } catch {
    // fallback
  }

  let autoScheduleEnabled = false;
  let plannerPaused = false;
  let publisherPaused = false;
  try {
    const settingsRows = await db.prepare(
      "SELECT key, value FROM settings WHERE key IN ('auto_schedule_enabled', 'publication_planner_paused', 'publication_publisher_paused')"
    ).all();
    for (const row of settingsRows?.results || settingsRows || []) {
      if (row.key === 'auto_schedule_enabled') autoScheduleEnabled = row.value === 'true';
      if (row.key === 'publication_planner_paused') plannerPaused = row.value === 'true';
      if (row.key === 'publication_publisher_paused') publisherPaused = row.value === 'true';
    }
  } catch {
    // fallback
  }

  const circuitBreakers: any[] = [];
  try {
    const cbRows = await db.prepare(
      'SELECT id, state, failure_count, last_failure_at, trip_reason FROM circuit_breakers LIMIT 10'
    ).all();
    for (const row of cbRows?.results || cbRows || []) {
      circuitBreakers.push({
        id: row.id,
        state: row.state,
        failure_count: Number(row.failure_count || 0),
        last_failure_at: row.last_failure_at || null,
        trip_reason: row.trip_reason || null
      });
    }
  } catch {
    // fallback
  }

  // 2. Pipeline Counters (Bounded)
  let eligibleDraftsCount = 0;
  try {
    const eligibleDrafts = await db.prepare(`
      SELECT COUNT(DISTINCT a.id) as count
      FROM articles a
      JOIN article_publication_readiness r ON r.article_id = a.id
      WHERE a.status = 'draft'
        AND a.manual_hold = 0
        AND r.snapshot_json LIKE '%"system_policy_pass":true%'
    `).first();
    eligibleDraftsCount = Number(eligibleDrafts?.count || 0);
  } catch {
    // fallback
  }

  let plannedCount = 0;
  try {
    const r = await db.prepare("SELECT COUNT(*) as c FROM article_publication_plans WHERE plan_status = 'PLANNED'").first();
    plannedCount = Number(r?.c || 0);
  } catch {}

  let scheduledCount = 0;
  let claimedCount = 0;
  let publishingCount = 0;
  let retryWaitCount = 0;
  let failedCount = 0;
  try {
    const execCounts = await db.prepare(`
      SELECT execution_status, COUNT(*) as c
      FROM article_publication_executions
      GROUP BY execution_status
    `).all();
    for (const row of execCounts?.results || execCounts || []) {
      if (row.execution_status === 'SCHEDULED') scheduledCount = Number(row.c || 0);
      if (row.execution_status === 'CLAIMED') claimedCount = Number(row.c || 0);
      if (row.execution_status === 'PUBLISHING') publishingCount = Number(row.c || 0);
      if (row.execution_status === 'RETRY_WAIT') retryWaitCount = Number(row.c || 0);
      if (row.execution_status === 'FAILED') failedCount = Number(row.c || 0);
    }
  } catch {}

  let manualHoldCount = 0;
  try {
    const r = await db.prepare('SELECT COUNT(*) as c FROM articles WHERE manual_hold = 1').first();
    manualHoldCount = Number(r?.c || 0);
  } catch {}

  let published24hCount = 0;
  try {
    const since24h = new Date(nowMs - 24 * 3600 * 1000).toISOString();
    const r = await db.prepare(`
      SELECT COUNT(*) as c FROM article_publication_executions
      WHERE execution_status = 'PUBLISHED'
        AND actual_published_at >= ?
    `).bind(since24h).first();
    published24hCount = Number(r?.c || 0);
  } catch {}

  // 3. Heartbeats
  const heartbeats: Record<string, JobHeartbeatStatus> = {} as any;
  const jobs: CronJobIdentity[] = [CRON_JOB_PLANNER, CRON_JOB_RECONCILER, CRON_JOB_DISPATCHER];

  for (const job of jobs) {
    const config = CADENCE_CONFIG[job];
    let latest: any = null;
    let lastSuccess: any = null;
    let lastFailure: any = null;

    try {
      latest = await db.prepare(`
        SELECT * FROM publication_cron_runs
        WHERE job_name = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(job).first();

      lastSuccess = await db.prepare(`
        SELECT finished_at, created_at FROM publication_cron_runs
        WHERE job_name = ? AND status = 'SUCCEEDED'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(job).first();

      lastFailure = await db.prepare(`
        SELECT finished_at, created_at, error_summary FROM publication_cron_runs
        WHERE job_name = ? AND status = 'FAILED'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(job).first();
    } catch {
      // table may not exist yet or empty
    }

    let ageSeconds: number | null = null;
    if (latest?.created_at) {
      const runTime = new Date(latest.created_at).getTime();
      ageSeconds = Math.max(0, Math.floor((nowMs - runTime) / 1000));
    }

    const isStale = ageSeconds !== null ? ageSeconds > config.staleThresholdSeconds : false;

    let health: JobHeartbeatStatus['health'] = 'UNKNOWN';
    if (!latest) {
      health = 'UNKNOWN';
    } else if (isStale) {
      health = 'STALE';
    } else if (latest.status === 'FAILED') {
      health = 'ERROR';
    } else if (latest.status === 'BLOCKED') {
      health = 'BLOCKED';
    } else if (latest.status === 'SUCCEEDED') {
      health = 'HEALTHY';
    } else if (latest.status === 'STARTED') {
      health = 'RUNNING';
    }

    heartbeats[job] = {
      job_name: job,
      last_started_at: latest?.started_at || null,
      last_finished_at: latest?.finished_at || null,
      last_status: latest?.status || null,
      last_success_at: lastSuccess?.finished_at || lastSuccess?.created_at || null,
      last_failure_at: lastFailure?.finished_at || lastFailure?.created_at || null,
      last_failure_error: lastFailure?.error_summary ? sanitizeErrorSummary(lastFailure.error_summary) : null,
      age_seconds: ageSeconds,
      cadence_seconds: config.cadenceSeconds,
      stale_threshold_seconds: config.staleThresholdSeconds,
      is_stale: isStale,
      health
    };
  }

  // 4. Stuck Executions
  const stuckExecutions: any[] = [];
  try {
    const rows = await db.prepare(`
      SELECT execution_id, article_id, execution_status, lease_expires_at, attempts_count
      FROM article_publication_executions
      WHERE 
        (execution_status IN ('CLAIMED', 'PUBLISHING') AND lease_expires_at IS NOT NULL AND lease_expires_at < ?)
        OR (execution_status = 'RETRY_WAIT' AND next_retry_at IS NOT NULL AND next_retry_at < ?)
      LIMIT 20
    `).bind(nowIso, nowIso).all();
    for (const r of rows?.results || rows || []) {
      stuckExecutions.push({
        execution_id: r.execution_id,
        article_id: Number(r.article_id),
        execution_status: r.execution_status,
        lease_expires_at: r.lease_expires_at || null,
        attempts_count: Number(r.attempts_count || 0)
      });
    }
  } catch {}

  // 5. Stuck Plans
  const stuckPlans: any[] = [];
  const executionAllowed = automationMode === 'CONTROLLED' || automationMode === 'UNATTENDED';
  if (executionAllowed && !killSwitchEngaged) {
    try {
      const fifteenMinAgo = new Date(nowMs - 15 * 60 * 1000).toISOString();
      const rows = await db.prepare(`
        SELECT p.plan_id, p.article_id, p.created_at
        FROM article_publication_plans p
        JOIN articles a ON a.id = p.article_id
        WHERE p.plan_status = 'PLANNED'
          AND p.scheduling_mode = 'auto_policy'
          AND p.created_at < ?
          AND a.status = 'draft'
          AND a.manual_hold = 0
        LIMIT 20
      `).bind(fifteenMinAgo).all();
      for (const r of rows?.results || rows || []) {
        stuckPlans.push({
          plan_id: r.plan_id,
          article_id: Number(r.article_id),
          created_at: r.created_at
        });
      }
    } catch {}
  }

  // 6. Terminal Failures (Bounded 10)
  const terminalFailures: any[] = [];
  try {
    const rows = await db.prepare(`
      SELECT execution_id, article_id, last_error_class, last_error_reason, updated_at
      FROM article_publication_executions
      WHERE execution_status = 'FAILED'
      ORDER BY updated_at DESC
      LIMIT 10
    `).all();
    for (const r of rows?.results || rows || []) {
      terminalFailures.push({
        execution_id: r.execution_id,
        article_id: Number(r.article_id),
        error_class: r.last_error_class || 'UNKNOWN_ERROR',
        error_summary: sanitizeErrorSummary(r.last_error_reason),
        failed_at: r.updated_at
      });
    }
  } catch {}

  // 7. Stale Binding Visibility (Content Hash Drift)
  const staleBindings: any[] = [];
  try {
    const rows = await db.prepare(`
      SELECT e.execution_id, e.article_id, e.content_hash as bound_hash, a.content_hash as current_hash
      FROM article_publication_executions e
      JOIN articles a ON a.id = e.article_id
      WHERE e.execution_status IN ('SCHEDULED', 'CLAIMED', 'RETRY_WAIT')
        AND e.content_hash != a.content_hash
      LIMIT 10
    `).all();
    for (const r of rows?.results || rows || []) {
      staleBindings.push({
        execution_id: r.execution_id,
        article_id: Number(r.article_id),
        bound_hash: r.bound_hash,
        current_hash: r.current_hash
      });
    }
  } catch {}

  // 8. Receipt Integrity Checks
  const missingReceipts: any[] = [];
  const duplicateReceipts: any[] = [];
  const hashMismatches: any[] = [];
  try {
    const missing = await db.prepare(`
      SELECT e.execution_id, e.article_id, e.actual_published_at
      FROM article_publication_executions e
      LEFT JOIN publication_execution_receipts r ON r.execution_id = e.execution_id
      WHERE e.execution_status = 'PUBLISHED'
        AND r.id IS NULL
      LIMIT 10
    `).all();
    for (const r of missing?.results || missing || []) {
      missingReceipts.push({
        execution_id: r.execution_id,
        article_id: Number(r.article_id),
        published_at: r.actual_published_at
      });
    }

    const dups = await db.prepare(`
      SELECT execution_id, COUNT(*) as c
      FROM publication_execution_receipts
      GROUP BY execution_id
      HAVING c > 1
      LIMIT 10
    `).all();
    for (const r of dups?.results || dups || []) {
      duplicateReceipts.push({
        execution_id: r.execution_id,
        receipt_count: Number(r.c)
      });
    }

    const mismatches = await db.prepare(`
      SELECT r.receipt_id, r.execution_id, r.article_id
      FROM publication_execution_receipts r
      JOIN article_publication_executions e ON e.execution_id = r.execution_id
      WHERE r.article_id != e.article_id OR r.content_hash != e.content_hash
      LIMIT 10
    `).all();
    for (const r of mismatches?.results || mismatches || []) {
      hashMismatches.push({
        receipt_id: r.receipt_id,
        execution_id: r.execution_id,
        article_id: Number(r.article_id)
      });
    }
  } catch {}

  // 9. Derived Alert Engine (Sections 25, 26, 27)
  const alerts: DerivedAlert[] = [];

  // A. Kill Switch Alert
  if (killSwitchEngaged) {
    alerts.push({
      type: 'KILL_SWITCH_ACTIVE',
      severity: 'WARNING',
      message: `Emergency kill switch is engaged (${killReason || 'no reason specified'}). Automation is halted.`,
      detected_at: nowIso
    });
  }

  // B. Missing or Stale Cron Heartbeat
  for (const job of jobs) {
    const hb = heartbeats[job];
    if (hb.is_stale) {
      const isCritical = automationMode === 'CONTROLLED' || automationMode === 'UNATTENDED';
      alerts.push({
        type: 'CRON_HEARTBEAT_MISSING',
        severity: isCritical ? 'CRITICAL' : 'WARNING',
        message: `Cron heartbeat for ${job} is stale (${hb.age_seconds}s old; threshold is ${hb.stale_threshold_seconds}s).`,
        detected_at: nowIso,
        details: { job, age_seconds: hb.age_seconds, threshold: hb.stale_threshold_seconds }
      });
    }
  }

  // C. Stuck Executions
  for (const item of stuckExecutions) {
    alerts.push({
      type: 'EXECUTION_LEASE_EXPIRED',
      severity: 'CRITICAL',
      message: `Execution ${item.execution_id} on article ${item.article_id} has expired lease/retry window in status ${item.execution_status}.`,
      detected_at: nowIso,
      article_id: item.article_id,
      execution_id: item.execution_id
    });
  }

  // D. Terminal Publication Failures
  for (const item of terminalFailures) {
    alerts.push({
      type: 'TERMINAL_PUBLICATION_FAILURE',
      severity: 'CRITICAL',
      message: `Execution ${item.execution_id} on article ${item.article_id} failed terminally: ${item.error_summary || item.error_class}.`,
      detected_at: item.failed_at,
      article_id: item.article_id,
      execution_id: item.execution_id
    });
  }

  // E. Stale Binding Drift
  for (const item of staleBindings) {
    alerts.push({
      type: 'STALE_BINDING_BLOCKED',
      severity: 'WARNING',
      message: `Execution ${item.execution_id} on article ${item.article_id} is blocked by content hash drift.`,
      detected_at: nowIso,
      article_id: item.article_id,
      execution_id: item.execution_id
    });
  }

  // F. Receipt Integrity Errors
  for (const item of missingReceipts) {
    alerts.push({
      type: 'RECEIPT_INTEGRITY_ERROR',
      severity: 'CRITICAL',
      message: `Published execution ${item.execution_id} on article ${item.article_id} is missing a publication receipt.`,
      detected_at: item.published_at || nowIso,
      article_id: item.article_id,
      execution_id: item.execution_id
    });
  }

  for (const item of duplicateReceipts) {
    alerts.push({
      type: 'RECEIPT_INTEGRITY_ERROR',
      severity: 'CRITICAL',
      message: `Execution ${item.execution_id} has ${item.receipt_count} duplicate publication receipts.`,
      detected_at: nowIso,
      execution_id: item.execution_id
    });
  }

  for (const item of hashMismatches) {
    alerts.push({
      type: 'RECEIPT_INTEGRITY_ERROR',
      severity: 'CRITICAL',
      message: `Receipt ${item.receipt_id} has an article or hash mismatch with execution ${item.execution_id}.`,
      detected_at: nowIso,
      article_id: item.article_id,
      execution_id: item.execution_id
    });
  }

  return {
    timestamp: nowIso,
    controls: {
      automation_mode: automationMode,
      auto_schedule_enabled: autoScheduleEnabled,
      kill_switch_engaged: killSwitchEngaged,
      kill_reason: killReason,
      planner_paused: plannerPaused,
      publisher_paused: publisherPaused,
      circuit_breakers: circuitBreakers
    },
    pipeline: {
      eligible_auto_policy_drafts: eligibleDraftsCount,
      active_planned_count: plannedCount,
      scheduled_count: scheduledCount,
      claimed_count: claimedCount,
      publishing_count: publishingCount,
      retry_wait_count: retryWaitCount,
      failed_count: failedCount,
      manual_hold_count: manualHoldCount,
      published_24h_count: published24hCount
    },
    heartbeats,
    stuck_work: {
      stuck_executions: stuckExecutions,
      stuck_plans: stuckPlans
    },
    terminal_failures: terminalFailures,
    stale_bindings: staleBindings,
    receipt_integrity: {
      missing_receipts: missingReceipts,
      duplicate_receipts: duplicateReceipts,
      hash_mismatches: hashMismatches
    },
    alerts
  };
}
