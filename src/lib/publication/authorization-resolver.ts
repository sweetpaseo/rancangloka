/**
 * RancangLoka — Publisher Dual Authorization Resolver Layer
 * Milestone: Phase 5L6 (PUBLICATION-AUTO-2)
 *
 * Authoritative, server-side resolution for publication execution and dispatch.
 * Supports exactly two explicit authorization pathways:
 * 
 * 1. EDITORIAL SIGNOFF PATH:
 *    - Valid, current human approval bound to current content_hash and featured_asset_id
 *    - Canonical publication readiness (READY_TO_SCHEDULE)
 * 
 * 2. AUTO POLICY PATH:
 *    - ZERO human approval required
 *    - Valid, bound auto_policy plan (matching article_id, content_hash, featured_asset_id)
 *    - Valid policy provenance (persisted readiness record with system_policy_pass = true)
 *    - Current deterministic quality gates PASS (live re-evaluation)
 *    - manual_hold = 0
 *    - Kill switch disengaged (kill_switch_engaged = 0)
 *    - Server-side automation capability permits action (CONTROLLED / UNATTENDED)
 * 
 * Strict Guarantees:
 * - Fail-closed on missing, corrupt, or stale state
 * - Zero fallback between authorization pathways (strict plan-mode routing)
 * - Legacy plans require human editorial approval (never reinterpreted as auto_policy)
 * - Publish Now is strictly human-only (never an auto-policy bypass)
 * - system_policy_pass alone is NOT publication authorization (requires bound plan)
 */

import {
  getAutomationControl,
  getCapabilityMatrix
} from '../safety/automation-controller.ts';
import { evaluateArticleReadiness } from './service.ts';
import type { ReadinessSnapshotPayload } from './types.ts';

export type PublicationAuthorizationMode = 'editorial_signoff' | 'auto_policy';

export interface ResolvePublicationAuthorizationParams {
  planId?: string;
  executionId?: string;
  articleId?: number;
  stage: 'schedule' | 'prepublish' | 'manual_publish';
  actor?: string;
}

export interface PublicationAuthorizationResult {
  authorized: boolean;
  authorization_mode: PublicationAuthorizationMode;
  reason?: string;
  article_id: number;
  plan_id?: string;
  content_hash: string;
  featured_asset_id: string;
  policy_provenance?: {
    readiness_id?: number;
    system_policy_pass?: boolean;
    human_approval_pass?: boolean;
    overall_status?: string;
  };
  details?: Record<string, any>;
}

/**
 * Resolves whether an article, plan, or execution is currently authorized for publication.
 */
export async function resolvePublicationAuthorization(
  db: any,
  params: ResolvePublicationAuthorizationParams
): Promise<PublicationAuthorizationResult> {
  const { planId, executionId, stage, actor = 'system' } = params;

  // 1. Resolve Plan
  let plan: any = null;
  if (planId) {
    plan = await db
      .prepare('SELECT * FROM article_publication_plans WHERE plan_id = ? LIMIT 1')
      .bind(planId)
      .first();
  } else if (executionId) {
    const execution = await db
      .prepare('SELECT plan_id, article_id FROM article_publication_executions WHERE execution_id = ? LIMIT 1')
      .bind(executionId)
      .first();

    if (execution && execution.plan_id) {
      plan = await db
        .prepare('SELECT * FROM article_publication_plans WHERE plan_id = ? LIMIT 1')
        .bind(execution.plan_id)
        .first();
    }
  }

  // Auto-policy publication strictly requires a valid publication plan
  if (!plan) {
    return {
      authorized: false,
      authorization_mode: 'editorial_signoff',
      reason: 'PLAN_NOT_FOUND',
      article_id: params.articleId || 0,
      content_hash: '',
      featured_asset_id: '',
      details: { error: 'Valid publication plan is required for publication authorization' }
    };
  }

  const articleId = plan.article_id;

  // 2. Fetch Article State
  const article = await db
    .prepare(`
      SELECT id, slug, status, content_hash, COALESCE(manual_hold, 0) AS manual_hold
      FROM articles
      WHERE id = ?
      LIMIT 1
    `)
    .bind(articleId)
    .first();

  if (!article) {
    return {
      authorized: false,
      authorization_mode: 'editorial_signoff',
      reason: 'ARTICLE_NOT_FOUND',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: plan.content_hash,
      featured_asset_id: plan.featured_asset_id,
      details: { error: `Article ID ${articleId} not found` }
    };
  }

  // Invariant: Article must remain in draft status before publication
  if (article.status !== 'draft') {
    return {
      authorized: false,
      authorization_mode: 'editorial_signoff',
      reason: 'ARTICLE_NOT_DRAFT',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: plan.content_hash,
      featured_asset_id: plan.featured_asset_id,
      details: { status: article.status }
    };
  }

  // Invariant: Manual hold blocks all automated and scheduled publication
  if (article.manual_hold === 1) {
    return {
      authorized: false,
      authorization_mode: plan.scheduling_mode === 'auto_policy' ? 'auto_policy' : 'editorial_signoff',
      reason: 'MANUAL_HOLD_ENGAGED',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: article.content_hash,
      featured_asset_id: plan.featured_asset_id,
      details: { manual_hold: true, error: 'Article is under operator manual hold' }
    };
  }

  // Invariant: Content hash must match the plan's authorized content_hash
  if (article.content_hash !== plan.content_hash) {
    return {
      authorized: false,
      authorization_mode: plan.scheduling_mode === 'auto_policy' ? 'auto_policy' : 'editorial_signoff',
      reason: 'CONTENT_HASH_MISMATCH',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: article.content_hash,
      featured_asset_id: plan.featured_asset_id,
      details: { expected: plan.content_hash, actual: article.content_hash }
    };
  }

  // Invariant: Active featured media must match the plan's authorized featured_asset_id
  const activeMedia = await db
    .prepare("SELECT asset_id FROM article_media WHERE article_id = ? AND role = 'featured' AND is_active = 1 LIMIT 1")
    .bind(articleId)
    .first();

  if (!activeMedia || activeMedia.asset_id !== plan.featured_asset_id) {
    return {
      authorized: false,
      authorization_mode: plan.scheduling_mode === 'auto_policy' ? 'auto_policy' : 'editorial_signoff',
      reason: 'FEATURED_MEDIA_MISMATCH',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: article.content_hash,
      featured_asset_id: activeMedia?.asset_id || '',
      details: { expected: plan.featured_asset_id, actual: activeMedia?.asset_id }
    };
  }

  const mediaAsset = await db
    .prepare('SELECT status, media_type FROM media_assets WHERE asset_id = ? LIMIT 1')
    .bind(activeMedia.asset_id)
    .first();

  if (!mediaAsset || mediaAsset.status !== 'VALIDATED' || mediaAsset.media_type !== 'image') {
    return {
      authorized: false,
      authorization_mode: plan.scheduling_mode === 'auto_policy' ? 'auto_policy' : 'editorial_signoff',
      reason: 'FEATURED_MEDIA_MISMATCH',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: article.content_hash,
      featured_asset_id: activeMedia.asset_id,
      details: { media_status: mediaAsset?.status, media_type: mediaAsset?.media_type }
    };
  }

  // 3. Strict Plan Mode Routing
  // Legacy plans remain approval-required. Never reinterpret legacy as auto_policy.
  const isAutoPolicyPlan = plan.scheduling_mode === 'auto_policy';
  const targetAuthMode: PublicationAuthorizationMode = isAutoPolicyPlan ? 'auto_policy' : 'editorial_signoff';

  // Invariant: Manual Publish Now is strictly human-only. Cannot bypass auto_policy.
  if (stage === 'manual_publish' && isAutoPolicyPlan) {
    return {
      authorized: false,
      authorization_mode: 'auto_policy',
      reason: 'PUBLISH_NOW_WITHOUT_HUMAN_APPROVAL_ALLOWED_NO',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: article.content_hash,
      featured_asset_id: activeMedia.asset_id,
      details: { error: 'Manual Publish Now cannot be used for auto_policy plans without explicit human approval' }
    };
  }

  // =========================================================================
  // PATH A: EDITORIAL SIGNOFF (Human Approval Required)
  // =========================================================================
  if (targetAuthMode === 'editorial_signoff') {
    const latestApproval = await db
      .prepare(`
        SELECT approval_status, approved_content_hash, approved_asset_id
        FROM article_editorial_approvals
        WHERE article_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `)
      .bind(articleId)
      .first();

    if (
      !latestApproval ||
      latestApproval.approval_status !== 'APPROVED' ||
      latestApproval.approved_content_hash !== article.content_hash ||
      latestApproval.approved_asset_id !== activeMedia.asset_id
    ) {
      return {
        authorized: false,
        authorization_mode: 'editorial_signoff',
        reason: 'APPROVAL_REVOKED_OR_STALE',
        article_id: articleId,
        plan_id: plan.plan_id,
        content_hash: article.content_hash,
        featured_asset_id: activeMedia.asset_id,
        details: { approval_status: latestApproval?.approval_status }
      };
    }

    const latestReadiness = await db
      .prepare(`
        SELECT id, is_ready, overall_status, content_hash
        FROM article_publication_readiness
        WHERE article_id = ?
        ORDER BY evaluated_at DESC, id DESC
        LIMIT 1
      `)
      .bind(articleId)
      .first();

    if (
      !latestReadiness ||
      latestReadiness.is_ready !== 1 ||
      latestReadiness.overall_status !== 'READY_TO_SCHEDULE' ||
      latestReadiness.content_hash !== article.content_hash
    ) {
      return {
        authorized: false,
        authorization_mode: 'editorial_signoff',
        reason: 'READINESS_STALE_OR_INVALID',
        article_id: articleId,
        plan_id: plan.plan_id,
        content_hash: article.content_hash,
        featured_asset_id: activeMedia.asset_id,
        details: { overall_status: latestReadiness?.overall_status, is_ready: latestReadiness?.is_ready }
      };
    }

    return {
      authorized: true,
      authorization_mode: 'editorial_signoff',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: article.content_hash,
      featured_asset_id: activeMedia.asset_id,
      policy_provenance: {
        readiness_id: latestReadiness.id,
        system_policy_pass: true,
        human_approval_pass: true,
        overall_status: latestReadiness.overall_status
      }
    };
  }

  // =========================================================================
  // PATH B: AUTO POLICY (No Human Approval Required)
  // =========================================================================
  // 1. Plan Lifecycle Validity Check
  if (plan.plan_status !== 'PLANNED') {
    return {
      authorized: false,
      authorization_mode: 'auto_policy',
      reason: 'PLAN_NOT_PLANNED',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: article.content_hash,
      featured_asset_id: activeMedia.asset_id,
      details: { plan_status: plan.plan_status }
    };
  }

  // 2. Plan Provenance & Readiness Snapshot Binding
  if (!plan.readiness_id) {
    return {
      authorized: false,
      authorization_mode: 'auto_policy',
      reason: 'MISSING_POLICY_BINDING',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: article.content_hash,
      featured_asset_id: activeMedia.asset_id,
      details: { error: 'Plan has no associated readiness_id snapshot binding' }
    };
  }

  const boundReadiness = await db
    .prepare('SELECT id, article_id, content_hash, snapshot_json FROM article_publication_readiness WHERE id = ? LIMIT 1')
    .bind(plan.readiness_id)
    .first();

  if (!boundReadiness || boundReadiness.article_id !== articleId || boundReadiness.content_hash !== plan.content_hash) {
    return {
      authorized: false,
      authorization_mode: 'auto_policy',
      reason: 'PLAN_PROVENANCE_TAMPERED',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: article.content_hash,
      featured_asset_id: activeMedia.asset_id,
      details: { error: 'Plan readiness snapshot does not match article or content_hash' }
    };
  }

  let boundSnapshotPayload: ReadinessSnapshotPayload | null = null;
  try {
    boundSnapshotPayload = JSON.parse(boundReadiness.snapshot_json);
  } catch {
    boundSnapshotPayload = null;
  }

  if (!boundSnapshotPayload || boundSnapshotPayload.policy?.system_policy_pass !== true) {
    return {
      authorized: false,
      authorization_mode: 'auto_policy',
      reason: 'MISSING_POLICY_BINDING',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: article.content_hash,
      featured_asset_id: activeMedia.asset_id,
      details: { error: 'Bound readiness snapshot lacks system_policy_pass = true' }
    };
  }

  // 3. Server-Side Safety State: Emergency Kill Switch
  let autoControl = { mode: 'OFF', kill_switch_engaged: 0 };
  try {
    autoControl = await getAutomationControl(db);
  } catch {
    autoControl = { mode: 'OFF', kill_switch_engaged: 0 };
  }

  const killSwitchEngaged = Boolean(autoControl.kill_switch_engaged === 1);
  if (killSwitchEngaged) {
    return {
      authorized: false,
      authorization_mode: 'auto_policy',
      reason: 'KILL_SWITCH_ENGAGED',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: article.content_hash,
      featured_asset_id: activeMedia.asset_id,
      details: { kill_switch_engaged: true, error: 'Emergency kill switch is engaged' }
    };
  }

  // 4. Server-Side Safety State: Automation Capability Matrix
  const caps = getCapabilityMatrix(autoControl.mode as any, killSwitchEngaged);

  if (stage === 'schedule' && !caps.canScheduleControlled) {
    return {
      authorized: false,
      authorization_mode: 'auto_policy',
      reason: 'AUTOMATION_MODE_BLOCKED',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: article.content_hash,
      featured_asset_id: activeMedia.asset_id,
      details: { mode: autoControl.mode, canScheduleControlled: caps.canScheduleControlled }
    };
  }

  if (stage === 'prepublish' && !caps.canPublishUnattended) {
    return {
      authorized: false,
      authorization_mode: 'auto_policy',
      reason: 'AUTOMATION_MODE_BLOCKED',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: article.content_hash,
      featured_asset_id: activeMedia.asset_id,
      details: { mode: autoControl.mode, canPublishUnattended: caps.canPublishUnattended }
    };
  }

  // 5. Current Deterministic Policy Re-Evaluation (Authority)
  // Re-run canonical deterministic publication gates right now.
  let currentReadiness: ReadinessSnapshotPayload;
  try {
    currentReadiness = await evaluateArticleReadiness(db, articleId);
  } catch (err: any) {
    return {
      authorized: false,
      authorization_mode: 'auto_policy',
      reason: 'CURRENT_POLICY_EVALUATION_ERROR',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: article.content_hash,
      featured_asset_id: activeMedia.asset_id,
      details: { error: err.message }
    };
  }

  if (!currentReadiness.policy?.system_policy_pass) {
    return {
      authorized: false,
      authorization_mode: 'auto_policy',
      reason: 'CURRENT_POLICY_FAILURE',
      article_id: articleId,
      plan_id: plan.plan_id,
      content_hash: article.content_hash,
      featured_asset_id: activeMedia.asset_id,
      details: {
        blockers: currentReadiness.blockers,
        checks: currentReadiness.checks,
        error: 'Current deterministic publication policy evaluated to FAIL'
      }
    };
  }

  // 6. Authorized!
  return {
    authorized: true,
    authorization_mode: 'auto_policy',
    article_id: articleId,
    plan_id: plan.plan_id,
    content_hash: article.content_hash,
    featured_asset_id: activeMedia.asset_id,
    policy_provenance: {
      readiness_id: boundReadiness.id,
      system_policy_pass: true,
      human_approval_pass: false,
      overall_status: currentReadiness.overall_status
    }
  };
}
