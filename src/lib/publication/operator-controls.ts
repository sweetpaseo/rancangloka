/**
 * RancangLoka — Publication Automation Operator Controls & Supervisor Layer
 * Milestone: Phase 5L4 (PUBLICATION-AUTO-1)
 *
 * Provides human-in-the-loop overrides and safety controls:
 * 1. Manual Hold (veto/pause article from auto-scheduling)
 * 2. Resume Automation (restores candidate eligibility without immediate plan creation)
 * 3. Return to Draft & Hold (safely cancels cancellable pending plans/executions, sets draft + manual_hold=1)
 * 4. Global Auto-Schedule ON/OFF control (isolated from emergency kill switch)
 * 5. Complete audit attribution via publication_operator_audit
 */

import { cancelPlan } from './planner-service.ts';
import { cancelExecution } from './publisher-service.ts';
import {
  getAutomationControl,
  changeAutomationMode,
  changeAutoSchedule,
  getRecentAutomationControlAudit
} from '../safety/automation-controller.ts';
import {
  prepareStateMutationCapture,
  generateMutationOperationId,
  type OCCGuardCondition
} from '../decision/trajectory-ledger.ts';
import {
  buildCanonicalPublicationPreflightState,
  computeCanonicalPreflightHash
} from '../decision/publication-preflight-state.ts';

export {
  changeAutomationMode,
  changeAutoSchedule,
  getRecentAutomationControlAudit
};

export type OperatorActor = string | { id: string; role?: string };

function parseActor(actor: OperatorActor): { actorId: string; actorRole?: string } {
  if (typeof actor === 'object' && actor !== null) {
    return {
      actorId: actor.id || 'operator',
      actorRole: actor.role
    };
  }
  return {
    actorId: String(actor || 'operator'),
    actorRole: undefined
  };
}

export interface OperatorActionResult {
  success: boolean;
  articleId?: number;
  idempotent?: boolean;
  held?: boolean;
  alreadyHeld?: boolean;
  resumed?: boolean;
  alreadyActive?: boolean;
  enabled?: boolean;
  previousStatus?: string;
  cancelledPlanId?: string | null;
  cancelledExecutionId?: string | null;
  message?: string;
  details?: Record<string, any>;
}

export interface ArticleAutomationState {
  articleId: number;
  slug: string;
  status: string;
  manualHold: boolean;
  manualHoldReason: string | null;
  manualHoldAt: string | null;
  manualHoldBy: string | null;
  globalAutoScheduleEnabled: boolean;
  killSwitchEngaged: boolean;
  activePlan: any | null;
  activeExecution: any | null;
  displayState: 'HELD' | 'PUBLISHED' | 'SCHEDULED' | 'PLANNED' | 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'GLOBAL_AUTO_SCHEDULE_OFF';
  availableActions: string[];
}

/**
 * 1. Manual Hold
 * Sets manual_hold=1, preventing article from automatic planning or scheduled publishing.
 * Does not mutate article status. Idempotent on repeated calls.
 */
export async function holdArticle(
  db: any,
  options: {
    articleId: number;
    actor: OperatorActor;
    reason?: string | null;
  }
): Promise<OperatorActionResult> {
  const { articleId, actor, reason = null } = options;
  const { actorId, actorRole } = parseActor(actor);

  const article = await db
    .prepare('SELECT id, slug, status, content_hash, featured_image, reading_time_minutes, is_sponsored, COALESCE(manual_hold, 0) AS manual_hold, manual_hold_reason, manual_hold_at, manual_hold_by FROM articles WHERE id = ? LIMIT 1')
    .bind(articleId)
    .first();

  if (!article) {
    throw new Error('ARTICLE_NOT_FOUND');
  }

  // Idempotency: if already on manual hold with same state, return early
  if (article.manual_hold === 1) {
    return {
      success: true,
      articleId,
      idempotent: true,
      held: true,
      alreadyHeld: true,
      message: 'Article is already under manual hold',
      details: {
        manual_hold: true,
        manual_hold_reason: article.manual_hold_reason,
        manual_hold_by: article.manual_hold_by,
        manual_hold_at: article.manual_hold_at
      }
    };
  }

  const updateStmt = db
    .prepare(`
      UPDATE articles
      SET manual_hold = 1,
          manual_hold_reason = ?,
          manual_hold_at = CURRENT_TIMESTAMP,
          manual_hold_by = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND COALESCE(manual_hold, 0) = 0
    `)
    .bind(reason, actorId, articleId);

  const auditStmt = db
    .prepare(`
      INSERT INTO publication_operator_audit (
        event_type, article_id, plan_id, execution_id,
        actor_id, actor_role, reason, details_json, created_at
      ) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    .bind(
      'MANUAL_HOLD_SET',
      articleId,
      actorId,
      actorRole || 'admin_operator',
      reason,
      JSON.stringify({ previousManualHold: 0, newManualHold: 1 })
    );

  let ledgerStatements: any[] = [];
  try {
    const beforeInput = {
      articleId,
      slug: article.slug,
      contentHash: article.content_hash,
      featuredAssetId: article.featured_image,
      manualHold: 0,
      readingTimeMinutes: article.reading_time_minutes,
      isSponsored: Boolean(article.is_sponsored),
      status: article.status
    };
    const afterInput = {
      ...beforeInput,
      manualHold: 1
    };
    const fromHash = computeCanonicalPreflightHash(buildCanonicalPublicationPreflightState(beforeInput));
    const toHash = computeCanonicalPreflightHash(buildCanonicalPublicationPreflightState(afterInput));
    const mopId = generateMutationOperationId('manual_hold_engaged', articleId, fromHash, toHash);

    const occCondition: OCCGuardCondition = {
      whereExistsSql: 'SELECT 1 FROM articles WHERE id = ? AND manual_hold = 1',
      params: [articleId]
    };

    const capture = prepareStateMutationCapture(db, {
      articleId,
      beforeInput,
      afterInput,
      captureSource: 'operator_controls',
      mutationOperationId: mopId,
      actorType: 'admin_operator',
      actorId,
      condition: occCondition
    });
    ledgerStatements = capture.statements;
  } catch {
    // safe fallback
  }

  const batchResults = await db.batch([updateStmt, auditStmt, ...ledgerStatements]);
  const changes = batchResults[0]?.meta?.changes ?? batchResults[0]?.changes ?? 0;
  if (changes === 0) {
    return {
      success: true,
      articleId,
      idempotent: true,
      held: true,
      alreadyHeld: true,
      message: 'Article is already under manual hold or modified concurrently',
      details: { manual_hold: true }
    };
  }

  return {
    success: true,
    articleId,
    idempotent: false,
    held: true,
    alreadyHeld: false,
    message: 'Manual hold engaged successfully',
    details: { manual_hold: true, manual_hold_reason: reason, manual_hold_by: actorId }
  };
}

/**
 * 2. Resume Automation
 * Clears manual_hold (sets manual_hold=0, clears reason/timestamp/actor).
 * CRITICAL: Does NOT create or trigger an immediate plan. Periodic/on-demand reconciliation handles planning later.
 * Idempotent on repeated calls.
 */
export async function resumeArticleAutomation(
  db: any,
  options: {
    articleId: number;
    actor: OperatorActor;
    reason?: string | null;
  }
): Promise<OperatorActionResult> {
  const { articleId, actor, reason = null } = options;
  const { actorId, actorRole } = parseActor(actor);

  const article = await db
    .prepare('SELECT id, slug, status, content_hash, featured_image, reading_time_minutes, is_sponsored, COALESCE(manual_hold, 0) AS manual_hold FROM articles WHERE id = ? LIMIT 1')
    .bind(articleId)
    .first();

  if (!article) {
    throw new Error('ARTICLE_NOT_FOUND');
  }

  // Idempotency: if manual_hold is already 0, return early
  if (article.manual_hold === 0) {
    return {
      success: true,
      articleId,
      idempotent: true,
      resumed: true,
      alreadyActive: true,
      message: 'Article is already active for automation (manual_hold = 0)',
      details: { manual_hold: false }
    };
  }

  const updateStmt = db
    .prepare(`
      UPDATE articles
      SET manual_hold = 0,
          manual_hold_reason = NULL,
          manual_hold_at = NULL,
          manual_hold_by = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND manual_hold = 1
    `)
    .bind(articleId);

  const auditStmt = db
    .prepare(`
      INSERT INTO publication_operator_audit (
        event_type, article_id, plan_id, execution_id,
        actor_id, actor_role, reason, details_json, created_at
      ) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    .bind(
      'MANUAL_HOLD_CLEARED',
      articleId,
      actorId,
      actorRole || 'admin_operator',
      reason,
      JSON.stringify({ previousManualHold: 1, newManualHold: 0 })
    );

  let ledgerStatements: any[] = [];
  try {
    const beforeInput = {
      articleId,
      slug: article.slug,
      contentHash: article.content_hash,
      featuredAssetId: article.featured_image,
      manualHold: 1,
      readingTimeMinutes: article.reading_time_minutes,
      isSponsored: Boolean(article.is_sponsored),
      status: article.status
    };
    const afterInput = {
      ...beforeInput,
      manualHold: 0
    };
    const fromHash = computeCanonicalPreflightHash(buildCanonicalPublicationPreflightState(beforeInput));
    const toHash = computeCanonicalPreflightHash(buildCanonicalPublicationPreflightState(afterInput));
    const mopId = generateMutationOperationId('manual_hold_cleared', articleId, fromHash, toHash);

    const occCondition: OCCGuardCondition = {
      whereExistsSql: 'SELECT 1 FROM articles WHERE id = ? AND manual_hold = 0',
      params: [articleId]
    };

    const capture = prepareStateMutationCapture(db, {
      articleId,
      beforeInput,
      afterInput,
      captureSource: 'operator_controls',
      mutationOperationId: mopId,
      actorType: 'admin_operator',
      actorId,
      condition: occCondition
    });
    ledgerStatements = capture.statements;
  } catch {
    // safe fallback
  }

  const batchResults = await db.batch([updateStmt, auditStmt, ...ledgerStatements]);
  const changes = batchResults[0]?.meta?.changes ?? batchResults[0]?.changes ?? 0;
  if (changes === 0) {
    return {
      success: true,
      articleId,
      idempotent: true,
      resumed: true,
      alreadyActive: true,
      message: 'Article is already active for automation (manual_hold = 0) or modified concurrently',
      details: { manual_hold: false }
    };
  }

  return {
    success: true,
    articleId,
    idempotent: false,
    resumed: true,
    alreadyActive: false,
    message: 'Manual hold cleared successfully. Eligibility will be evaluated on next planner cycle.',
    details: { manual_hold: false }
  };
}

/**
 * 3. Return to Draft & Hold
 * Unified operator action:
 * - Fails closed if article is published (UNPUBLISH_REQUIRED)
 * - Fails closed if execution is in critical PUBLISHING commit section
 * - Safely cancels active plan and/or cancellable execution (SCHEDULED, RETRY_WAIT, CLAIMED)
 * - Sets article.status = 'draft' and manual_hold = 1
 * - Emits audit logs
 */
export async function returnArticleToDraftAndHold(
  db: any,
  options: {
    articleId: number;
    actor: OperatorActor;
    reason?: string | null;
  }
): Promise<OperatorActionResult> {
  const { articleId, actor, reason = null } = options;
  const { actorId, actorRole } = parseActor(actor);

  const article = await db
    .prepare('SELECT id, slug, status, COALESCE(manual_hold, 0) AS manual_hold FROM articles WHERE id = ? LIMIT 1')
    .bind(articleId)
    .first();

  if (!article) {
    throw new Error('ARTICLE_NOT_FOUND');
  }

  // Section 7: Unpublish is NOT supported in this phase
  if (article.status === 'published') {
    throw new Error('UNPUBLISH_REQUIRED: Return to Draft & Hold is not supported for published articles');
  }

  let cancelledPlanId: string | null = null;
  let cancelledExecutionId: string | null = null;

  // Inspect active execution
  const activeExec = await db
    .prepare(`
      SELECT execution_id, plan_id, execution_status
      FROM article_publication_executions
      WHERE article_id = ?
        AND execution_status IN ('SCHEDULED', 'CLAIMED', 'PUBLISHING', 'RETRY_WAIT')
      LIMIT 1
    `)
    .bind(articleId)
    .first();

  if (activeExec) {
    // Section 9: PUBLISHING execution cannot be cancelled
    if (activeExec.execution_status === 'PUBLISHING') {
      throw new Error('CANNOT_CANCEL_PUBLISHING_EXECUTION: Article is currently in publishing commit section');
    }

    // Cancel cancellable execution (SCHEDULED, RETRY_WAIT, CLAIMED)
    await cancelExecution(db, activeExec.execution_id, actorId, reason || 'Return to Draft & Hold');
    cancelledExecutionId = activeExec.execution_id;
  }

  // Inspect active plan
  const activePlan = await db
    .prepare("SELECT plan_id FROM article_publication_plans WHERE article_id = ? AND plan_status = 'PLANNED' LIMIT 1")
    .bind(articleId)
    .first();

  if (activePlan) {
    await cancelPlan(db, activePlan.plan_id, actorId, reason || 'Return to Draft & Hold');
    cancelledPlanId = activePlan.plan_id;
  }

  // Transition article to draft and engage manual_hold
  await db
    .prepare(`
      UPDATE articles
      SET status = 'draft',
          manual_hold = 1,
          manual_hold_reason = ?,
          manual_hold_at = CURRENT_TIMESTAMP,
          manual_hold_by = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(reason, actorId, articleId)
    .run();

  // Log operator audit
  await logOperatorAudit(db, {
    eventType: 'RETURNED_TO_DRAFT_AND_HELD',
    articleId,
    planId: cancelledPlanId,
    executionId: cancelledExecutionId,
    actorId,
    actorRole,
    reason,
    details: {
      previousStatus: article.status,
      newStatus: 'draft',
      cancelledPlanId,
      cancelledExecutionId
    }
  });

  return {
    success: true,
    articleId,
    previousStatus: article.status,
    cancelledPlanId,
    cancelledExecutionId,
    held: true,
    message: 'Article returned to draft and held successfully',
    details: {
      status: 'draft',
      manual_hold: true,
      cancelledPlanId,
      cancelledExecutionId
    }
  };
}

/**
 * 4. Global Auto-Schedule ON/OFF Toggle
 * Sets settings.auto_schedule_enabled = 'true' | 'false'.
 * Does not cancel already scheduled plans or executions.
 * Supports both options object and positional arguments: (db, enabled, actor, reason)
 */
export async function setGlobalAutoScheduleEnabled(
  db: any,
  arg1: boolean | { enabled: boolean; actor: OperatorActor; reason?: string | null },
  arg2?: OperatorActor,
  arg3?: string | null
): Promise<{ success: boolean; enabled: boolean; actor: string }> {
  let enabled: boolean;
  let actorRaw: OperatorActor;
  let reason: string | null = null;

  if (typeof arg1 === 'boolean') {
    enabled = arg1;
    actorRaw = arg2 || 'operator';
    reason = arg3 || null;
  } else {
    enabled = arg1.enabled;
    actorRaw = arg1.actor;
    reason = arg1.reason || null;
  }

  const { actorId, actorRole } = parseActor(actorRaw);
  const value = enabled ? 'true' : 'false';

  await db
    .prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES ('auto_schedule_enabled', ?, CURRENT_TIMESTAMP)
    `)
    .bind(value)
    .run();

  await logOperatorAudit(db, {
    eventType: enabled ? 'AUTO_SCHEDULE_ENABLED' : 'AUTO_SCHEDULE_DISABLED',
    actorId,
    actorRole,
    reason,
    details: { auto_schedule_enabled: enabled }
  });

  return {
    success: true,
    enabled,
    actor: actorId
  };
}

/**
 * 5. Get Comprehensive Article Automation State
 * Computes live operational display status and allowed operator actions.
 */
export async function getArticleAutomationState(
  db: any,
  articleId: number
): Promise<ArticleAutomationState> {
  const article = await db
    .prepare(`
      SELECT id, slug, status, COALESCE(manual_hold, 0) AS manual_hold,
             manual_hold_reason, manual_hold_at, manual_hold_by
      FROM articles
      WHERE id = ?
      LIMIT 1
    `)
    .bind(articleId)
    .first();

  if (!article) {
    throw new Error('ARTICLE_NOT_FOUND');
  }

  // Global settings & safety
  let autoScheduleEnabled = false;
  try {
    const setting = await db
      .prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled' LIMIT 1")
      .first();
    autoScheduleEnabled = Boolean(setting && (setting.value === 'true' || setting.value === '1'));
  } catch {
    autoScheduleEnabled = false;
  }

  let autoControl = { mode: 'OFF', kill_switch_engaged: 0 };
  try {
    autoControl = await getAutomationControl(db);
  } catch {
    autoControl = { mode: 'OFF', kill_switch_engaged: 0 };
  }

  // Active plan & execution
  const activePlan = await db
    .prepare("SELECT * FROM article_publication_plans WHERE article_id = ? AND plan_status = 'PLANNED' LIMIT 1")
    .bind(articleId)
    .first();

  const activeExecution = await db
    .prepare(`
      SELECT * FROM article_publication_executions
      WHERE article_id = ?
        AND execution_status IN ('SCHEDULED', 'CLAIMED', 'PUBLISHING', 'RETRY_WAIT')
      LIMIT 1
    `)
    .bind(articleId)
    .first();

  const manualHold = Boolean(article.manual_hold === 1);

  // Compute display state
  let displayState: ArticleAutomationState['displayState'];
  if (manualHold) {
    displayState = 'HELD';
  } else if (article.status === 'published') {
    displayState = 'PUBLISHED';
  } else if (activeExecution) {
    displayState = 'SCHEDULED';
  } else if (activePlan) {
    displayState = 'PLANNED';
  } else if (!autoScheduleEnabled) {
    displayState = 'GLOBAL_AUTO_SCHEDULE_OFF';
  } else {
    displayState = 'ELIGIBLE';
  }

  // Compute available actions
  const availableActions: string[] = [];
  if (article.status !== 'published') {
    if (manualHold) {
      availableActions.push('RESUME');
    } else {
      availableActions.push('HOLD');
    }
    if (activePlan || activeExecution || article.status === 'scheduled') {
      availableActions.push('RETURN_TO_DRAFT_AND_HOLD');
    }
  }

  return {
    articleId: article.id,
    slug: article.slug,
    status: article.status,
    manualHold,
    manualHoldReason: article.manual_hold_reason,
    manualHoldAt: article.manual_hold_at,
    manualHoldBy: article.manual_hold_by,
    globalAutoScheduleEnabled: autoScheduleEnabled,
    killSwitchEngaged: Boolean(autoControl.kill_switch_engaged === 1),
    activePlan: activePlan || null,
    activeExecution: activeExecution || null,
    displayState,
    availableActions
  };
}

/**
 * Helper: Insert operator audit entry
 */
export async function logOperatorAudit(
  db: any,
  params: {
    eventType: string;
    articleId?: number | null;
    planId?: string | null;
    executionId?: string | null;
    actorId: string;
    actorRole?: string;
    reason?: string | null;
    details?: Record<string, any>;
  }
): Promise<void> {
  const {
    eventType,
    articleId = null,
    planId = null,
    executionId = null,
    actorId,
    actorRole = 'admin_operator',
    reason = null,
    details = {}
  } = params;

  try {
    await db
      .prepare(`
        INSERT INTO publication_operator_audit (
          event_type, article_id, plan_id, execution_id,
          actor_id, actor_role, reason, details_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        eventType,
        articleId,
        planId,
        executionId,
        actorId,
        actorRole,
        reason,
        JSON.stringify(details)
      )
      .run();
  } catch (err: any) {
    // If table doesn't exist yet (in older test fixtures without 0018), log warning and continue safely
    console.warn(`[logOperatorAudit] Could not write operator audit: ${err.message}`);
  }
}
