/**
 * RancangLoka — Hands-Off Auto-Schedule Publication Policy (PUBLICATION-AUTO-0)
 * Milestone: Phase 5L2
 *
 * Provides deterministic, server-side evaluation of an article's operational
 * eligibility for automated publication scheduling WITHOUT mandatory human approval.
 *
 * Strict Guarantees:
 * 1. Zero plan / execution creation in this phase (read-only eligibility check).
 * 2. Zero human approval fabrication (human approval remains human-only).
 * 3. Does not depend on legacy approval-dependent READY_TO_SCHEDULE overall_status.
 * 4. Fails closed on manual_hold = 1, global auto_schedule_enabled = false, kill switch, or mode limits.
 * 5. Re-evaluates or consumes system_policy_pass from deterministic publication gates.
 */

import {
  getAutomationControl,
  getCapabilityMatrix
} from '../safety/automation-controller.ts';
import { evaluateArticleReadiness } from './service.ts';
import type { ReadinessSnapshotPayload } from './types.ts';

export interface AutoScheduleEligibilityResult {
  article_id: number;
  eligible: boolean;
  system_policy_pass: boolean;
  manual_hold: boolean;
  auto_schedule_enabled: boolean;
  automation_mode_allowed: boolean;
  kill_switch_engaged: boolean;
  has_active_plan: boolean;
  has_active_execution: boolean;
  reasons: string[];
  details?: Record<string, any>;
}

/**
 * Evaluates whether an article is currently eligible for automated publication scheduling.
 *
 * Canonical Rule:
 * AUTO_SCHEDULE_ELIGIBLE =
 *   system_policy_pass = true
 *   AND article.status = 'draft'
 *   AND manual_hold = false
 *   AND auto_schedule_enabled = true
 *   AND automation_control allows planning
 *   AND kill_switch_engaged = false
 *   AND no conflicting active plan
 *   AND no active/completed conflicting execution
 */
export async function evaluateAutoScheduleEligibility(
  db: any,
  articleId: number,
  options?: {
    forceLiveReadinessEvaluation?: boolean;
    readinessSnapshot?: ReadinessSnapshotPayload;
  }
): Promise<AutoScheduleEligibilityResult> {
  const reasons: string[] = [];

  // 1. Fetch Article & Manual Hold State
  const article = await db
    .prepare(
      `SELECT id, slug, status, content_hash, COALESCE(manual_hold, 0) AS manual_hold,
              manual_hold_reason, manual_hold_at, manual_hold_by
       FROM articles
       WHERE id = ?
       LIMIT 1`
    )
    .bind(articleId)
    .first();

  if (!article) {
    return {
      article_id: articleId,
      eligible: false,
      system_policy_pass: false,
      manual_hold: false,
      auto_schedule_enabled: false,
      automation_mode_allowed: false,
      kill_switch_engaged: false,
      has_active_plan: false,
      has_active_execution: false,
      reasons: ['ARTICLE_NOT_FOUND']
    };
  }

  if (article.status !== 'draft') {
    reasons.push('ARTICLE_NOT_DRAFT');
  }

  const manualHold = Boolean(article.manual_hold === 1);
  if (manualHold) {
    reasons.push('MANUAL_HOLD_ENGAGED');
  }

  // 2. Global Auto-Schedule Setting Check
  let autoScheduleEnabled = false;
  try {
    const settingRow = await db
      .prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled' LIMIT 1")
      .first();
    autoScheduleEnabled = Boolean(settingRow && (settingRow.value === 'true' || settingRow.value === '1'));
  } catch {
    autoScheduleEnabled = false;
  }

  if (!autoScheduleEnabled) {
    reasons.push('GLOBAL_AUTO_SCHEDULE_DISABLED');
  }

  // 3. Safety Envelope: Kill Switch & Automation Control Mode
  let autoControl = { mode: 'OFF', kill_switch_engaged: 0 };
  try {
    autoControl = await getAutomationControl(db);
  } catch {
    autoControl = { mode: 'OFF', kill_switch_engaged: 0 };
  }

  const killSwitchEngaged = Boolean(autoControl.kill_switch_engaged === 1);
  if (killSwitchEngaged) {
    reasons.push('KILL_SWITCH_ENGAGED');
  }

  const caps = getCapabilityMatrix(autoControl.mode as any, killSwitchEngaged);
  const automationModeAllowed = Boolean(caps.canPlan);
  if (!automationModeAllowed) {
    reasons.push(`AUTOMATION_MODE_BLOCKED_${autoControl.mode}`);
  }

  // Check if planner is globally paused
  try {
    const pauseSetting = await db
      .prepare("SELECT value FROM settings WHERE key = 'planner_paused' LIMIT 1")
      .first();
    if (pauseSetting && (pauseSetting.value === '1' || pauseSetting.value === 'true')) {
      reasons.push('PLANNER_PAUSED');
    }
  } catch {
    // ignore
  }

  // 4. Resolve System Policy Pass (Independent of Human Approval)
  let systemPolicyPass = false;
  let snapshotPayload: ReadinessSnapshotPayload | null = options?.readinessSnapshot || null;

  if (!snapshotPayload && !options?.forceLiveReadinessEvaluation) {
    try {
      const latestRow = await db
        .prepare(
          `SELECT snapshot_json
           FROM article_publication_readiness
           WHERE article_id = ?
           ORDER BY evaluated_at DESC, id DESC
           LIMIT 1`
        )
        .bind(articleId)
        .first();

      if (latestRow?.snapshot_json) {
        snapshotPayload = JSON.parse(latestRow.snapshot_json);
      }
    } catch {
      snapshotPayload = null;
    }
  }

  // If no cached snapshot or live evaluation requested, evaluate live
  if (!snapshotPayload || options?.forceLiveReadinessEvaluation) {
    try {
      snapshotPayload = await evaluateArticleReadiness(db, articleId);
    } catch (err: any) {
      reasons.push(`READINESS_EVALUATION_ERROR: ${err.message}`);
    }
  }

  if (snapshotPayload) {
    // If snapshot has policy.system_policy_pass, consume directly; otherwise evaluate checks
    if (typeof snapshotPayload.policy?.system_policy_pass === 'boolean') {
      systemPolicyPass = snapshotPayload.policy.system_policy_pass;
    } else {
      // Deterministic gates evaluation: article integrity, editorial guards, evidence/citations, visual media, publication metadata
      const checks = snapshotPayload.checks;
      systemPolicyPass = Boolean(
        checks &&
        checks.article_integrity === 'PASS' &&
        checks.editorial_guards === 'PASS' &&
        checks.evidence_and_citations === 'PASS' &&
        checks.visual_media === 'PASS' &&
        checks.publication_metadata === 'PASS' &&
        article.status === 'draft'
      );
    }
  }

  if (!systemPolicyPass) {
    reasons.push('SYSTEM_POLICY_FAILED');
  }

  // 5. Active Plan Conflict Check
  let hasActivePlan = false;
  try {
    const activePlan = await db
      .prepare("SELECT plan_id FROM article_publication_plans WHERE article_id = ? AND plan_status = 'PLANNED' LIMIT 1")
      .bind(articleId)
      .first();
    hasActivePlan = Boolean(activePlan);
  } catch {
    hasActivePlan = false;
  }

  if (hasActivePlan) {
    reasons.push('ACTIVE_PLAN_EXISTS');
  }

  // 6. Active / Completed Execution Conflict Check
  let hasActiveExecution = false;
  try {
    const activeExec = await db
      .prepare(
        `SELECT execution_id, execution_status
         FROM article_publication_executions
         WHERE article_id = ?
           AND execution_status IN ('SCHEDULED', 'CLAIMED', 'PUBLISHING', 'RETRY_WAIT', 'PUBLISHED')
         LIMIT 1`
      )
      .bind(articleId)
      .first();
    hasActiveExecution = Boolean(activeExec);
  } catch {
    hasActiveExecution = false;
  }

  if (hasActiveExecution) {
    reasons.push('ACTIVE_OR_COMPLETED_EXECUTION_EXISTS');
  }

  const eligible = reasons.length === 0;

  return {
    article_id: articleId,
    eligible,
    system_policy_pass: systemPolicyPass,
    manual_hold: manualHold,
    auto_schedule_enabled: autoScheduleEnabled,
    automation_mode_allowed: automationModeAllowed,
    kill_switch_engaged: killSwitchEngaged,
    has_active_plan: hasActivePlan,
    has_active_execution: hasActiveExecution,
    reasons,
    details: {
      slug: article.slug,
      content_hash: article.content_hash,
      blockers: snapshotPayload?.blockers || []
    }
  };
}
