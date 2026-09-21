/**
 * RancangLoka — Auto-Policy Plan Execution Reconciler
 * Phase: 5L6A
 *
 * Implements a restart-safe, idempotent server-side reconciler that bridges
 * PLANNED auto_policy publication plans to canonical SCHEDULED executions
 * without human intervention and without publishing.
 *
 * Invariants:
 * 1. AUTO-POLICY ONLY: Strictly processes plans with scheduling_mode = 'auto_policy'.
 * 2. NO HUMAN APPROVAL REQUIRED: Uses canonical resolvePublicationAuthorization for auto_policy.
 * 3. SAFETY CONTROLS:
 *    - Respects kill_switch_engaged (fails closed).
 *    - Respects automation capability matrix (only CONTROLLED and UNATTENDED permit execution promotion).
 *    - Requires article.status = 'draft' and manual_hold = 0.
 * 4. EXISTING PLAN PROMOTION INDEPENDENT OF GLOBAL NEW-PLAN TOGGLE:
 *    auto_schedule_enabled = false stops new plan generation, but does NOT invalidate existing legitimate plans.
 * 5. CANONICAL AUTHORIZATION & IDEMPOTENCY:
 *    Invokes schedulePlanForExecution to guarantee dual authorization, bounds, and race-safe single execution per plan.
 * 6. PUBLICATION FIREWALL: Never calls publishNow, due dispatcher, or publish mutations.
 * 7. ZERO APPROVAL MUTATIONS: Produces zero rows in article_editorial_approvals.
 * 8. HONEST AUDIT ATTRIBUTION: Logs system_policy / auto_scheduler attribution.
 */

import {
  schedulePlanForExecution
} from './publisher-service.ts';
import {
  EXECUTION_STATUS_SCHEDULED
} from './publisher-types.ts';
import {
  PLAN_STATUS_PLANNED
} from './planner-types.ts';
import {
  getAutomationControl,
  getCapabilityMatrix
} from '../safety/automation-controller.ts';

export const RECONCILER_DEFAULT_BATCH_LIMIT = 10;
export const RECONCILER_ACTOR_ID = 'auto_scheduler';
export const RECONCILER_ACTOR_TYPE = 'system_policy';

export interface AutoPolicyReconcilerOptions {
  batchLimit?: number;
  actor?: string;
  nowUtc?: string;
}

export type AutoPolicyPlanReconcileStatus = 'scheduled' | 'reused' | 'blocked' | 'failed';

export interface AutoPolicyReconcilerPlanResult {
  planId: string;
  articleId: number;
  status: AutoPolicyPlanReconcileStatus;
  executionId?: string;
  executionMode?: string;
  reason?: string;
  error?: string;
}

export interface AutoPolicyReconcilerResult {
  status: 'success' | 'blocked';
  reason?: string;
  batchLimit: number;
  processedCount: number;
  scheduledCount: number;
  reusedCount: number;
  blockedCount: number;
  failedCount: number;
  plans: AutoPolicyReconcilerPlanResult[];
}

/**
 * Reconciles eligible PLANNED auto_policy plans into SCHEDULED executions.
 */
export async function reconcileAutoPolicyPlansForExecution(
  db: any,
  options: AutoPolicyReconcilerOptions = {}
): Promise<AutoPolicyReconcilerResult> {
  const batchLimit = Math.max(1, options.batchLimit || RECONCILER_DEFAULT_BATCH_LIMIT);
  const actor = options.actor || RECONCILER_ACTOR_ID;

  // 1. Global Kill Switch Check
  const control = await getAutomationControl(db);
  if (control && control.kill_switch_engaged) {
    return {
      status: 'blocked',
      reason: 'KILL_SWITCH_ENGAGED',
      batchLimit,
      processedCount: 0,
      scheduledCount: 0,
      reusedCount: 0,
      blockedCount: 0,
      failedCount: 0,
      plans: []
    };
  }

  // 2. Automation Capability Matrix Check
  const matrix = getCapabilityMatrix(
    control ? control.mode : 'OFF',
    control ? Boolean(control.kill_switch_engaged) : false
  );
  if (!matrix.canScheduleControlled) {
    return {
      status: 'blocked',
      reason: `AUTOMATION_MODE_BLOCKS_EXECUTION_${control ? control.mode.toUpperCase() : 'UNKNOWN'}`,
      batchLimit,
      processedCount: 0,
      scheduledCount: 0,
      reusedCount: 0,
      blockedCount: 0,
      failedCount: 0,
      plans: []
    };
  }

  // 3. Query eligible PLANNED auto_policy plans
  // Strictly filter scheduling_mode = 'auto_policy' and plan_status = 'PLANNED'
  const eligibleQuery = `
    SELECT 
      p.id,
      p.plan_id,
      p.article_id,
      p.content_hash,
      p.featured_asset_id,
      p.target_publish_at,
      p.plan_status,
      p.scheduling_mode,
      a.status as article_status,
      COALESCE(a.manual_hold, 0) as manual_hold
    FROM article_publication_plans p
    JOIN articles a ON p.article_id = a.id
    WHERE p.plan_status = '${PLAN_STATUS_PLANNED}'
      AND p.scheduling_mode = 'auto_policy'
    ORDER BY p.target_publish_at ASC, p.id ASC
    LIMIT ?;
  `;

  const queryRes = await db.prepare(eligibleQuery).bind(batchLimit).all();
  const rawPlans: any[] = queryRes.results || queryRes || [];

  const planResults: AutoPolicyReconcilerPlanResult[] = [];
  let scheduledCount = 0;
  let reusedCount = 0;
  let blockedCount = 0;
  let failedCount = 0;

  // 4. Process each candidate plan with strict per-plan isolation
  for (const plan of rawPlans) {
    // 4a. Article Status Guard: Article must be in 'draft' status
    if (plan.article_status !== 'draft') {
      blockedCount++;
      planResults.push({
        planId: plan.plan_id,
        articleId: plan.article_id,
        status: 'blocked',
        reason: `ARTICLE_NOT_DRAFT: Status is '${plan.article_status}'`
      });
      continue;
    }

    // 4b. Manual Hold Guard: Article must not be on manual hold
    if (plan.manual_hold === 1) {
      blockedCount++;
      planResults.push({
        planId: plan.plan_id,
        articleId: plan.article_id,
        status: 'blocked',
        reason: 'MANUAL_HOLD_ENGAGED'
      });
      continue;
    }

    // 4c. Idempotency pre-check: Check if execution already exists for this plan
    const existingPlanExec = await db
      .prepare('SELECT execution_id, execution_status, execution_mode FROM article_publication_executions WHERE plan_id = ? LIMIT 1')
      .bind(plan.plan_id)
      .first();

    if (existingPlanExec) {
      reusedCount++;
      planResults.push({
        planId: plan.plan_id,
        articleId: plan.article_id,
        status: 'reused',
        executionId: existingPlanExec.execution_id,
        executionMode: existingPlanExec.execution_mode,
        reason: existingPlanExec.execution_status === EXECUTION_STATUS_SCHEDULED
          ? 'EXECUTION_ALREADY_SCHEDULED'
          : `EXECUTION_IN_STATE_${existingPlanExec.execution_status}`
      });
      continue;
    }

    // 4d. Canonical promotion via schedulePlanForExecution
    try {
      const execution = await schedulePlanForExecution(db, plan.plan_id, actor);

      // Check if execution was newly created vs already existing
      // If schedulePlanForExecution returned an existing record (including via concurrent race recovery)
      const isReused = Boolean((execution as any)?.reused_existing) || (existingPlanExec !== null && existingPlanExec !== undefined);

      if (isReused) {
        reusedCount++;
        planResults.push({
          planId: plan.plan_id,
          articleId: plan.article_id,
          status: 'reused',
          executionId: execution.execution_id,
          executionMode: execution.execution_mode,
          reason: 'EXECUTION_ALREADY_SCHEDULED'
        });
      } else {
        scheduledCount++;
        planResults.push({
          planId: plan.plan_id,
          articleId: plan.article_id,
          status: 'scheduled',
          executionId: execution.execution_id,
          executionMode: execution.execution_mode
        });

        // Audit attribution: Log honest system event in publication_plan_events
        try {
          await db
            .prepare(`
              INSERT INTO publication_plan_events (
                plan_id, article_id, event_type, actor_type, actor_id, details_json
              ) VALUES (?, ?, 'RESCHEDULED', 'planner', ?, ?)
            `)
            .bind(
              plan.plan_id,
              plan.article_id,
              actor,
              JSON.stringify({
                event: 'EXECUTION_SCHEDULED',
                actor_type: RECONCILER_ACTOR_TYPE,
                actor_id: actor,
                execution_id: execution.execution_id,
                execution_mode: execution.execution_mode,
                stage: 'reconcileAutoPolicyPlansForExecution'
              })
            )
            .run();
        } catch {
          // Non-fatal if event log table fails
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      // Determine if error is a safety/policy block or an unexpected failure
      const isBlocked = (
        errMsg.includes('MANUAL_HOLD') ||
        errMsg.includes('KILL_SWITCH') ||
        errMsg.includes('AUTOMATION_MODE') ||
        errMsg.includes('AUTHORIZATION_DENIED') ||
        errMsg.includes('SYSTEM_POLICY_FAILED') ||
        errMsg.includes('CURRENT_POLICY_FAILURE') ||
        errMsg.includes('POLICY') ||
        errMsg.includes('CONTENT_HASH') ||
        errMsg.includes('FEATURED_MEDIA') ||
        errMsg.includes('PLAN_NOT_PLANNED') ||
        errMsg.includes('ARTICLE_NOT_DRAFT') ||
        errMsg.includes('ACTIVE_EXECUTION_EXISTS') ||
        errMsg.includes('POLICY_GATE_FAILED') ||
        errMsg.includes('MISSING_POLICY_BINDING') ||
        errMsg.includes('PLAN_PROVENANCE_TAMPERED')
      );

      if (isBlocked) {
        blockedCount++;
        planResults.push({
          planId: plan.plan_id,
          articleId: plan.article_id,
          status: 'blocked',
          reason: errMsg
        });
      } else {
        failedCount++;
        planResults.push({
          planId: plan.plan_id,
          articleId: plan.article_id,
          status: 'failed',
          error: errMsg
        });
      }
    }
  }

  return {
    status: 'success',
    batchLimit,
    processedCount: rawPlans.length,
    scheduledCount,
    reusedCount,
    blockedCount,
    failedCount,
    plans: planResults
  };
}
