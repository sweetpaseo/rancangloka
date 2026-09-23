/**
 * RancangLoka — Adaptive Publication Planner Service Layer
 * Milestone: PUBLICATION-1
 * 
 * Provides database persistence, eligible candidate filtering,
 * stale plan protection, idempotency, and human override management.
 */

function getRandomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteCount; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
import {
  PLANNER_PROFILE_GROWING,
  PLANNER_VERSION,
  CANONICAL_TIMEZONE,
  PLAN_STATUS_PLANNED,
  PLAN_STATUS_SUPERSEDED,
  PLAN_STATUS_CANCELLED,
  PLAN_STATUS_BLOCKED,
  type PlannerProfile,
  type PlannerCandidate,
  type IndexHealthSignals,
  type PlannerExecutionResult,
  type PublicationPlanRecord,
  type PlanEventRecord
} from './planner-types.ts';
import {
  DEFAULT_PROFILES,
  calculateEffectiveCapacity,
  scoreAndRankCandidates,
  assignPublicationWindows
} from './planner-engine.ts';
import {
  getAutomationControl,
  getCapabilityMatrix
} from '../safety/automation-controller.ts';
import {
  computeEffectiveCapacity,
  DEFAULT_ACTIVATION_ENVELOPE
} from '../safety/rate-limiter.ts';
import { observeCandidateShadowDecision } from '../decision/decision-observer.ts';

/**
 * 1. Eligible Inventory Query
 * Evaluates candidate draft articles for publication planning across two distinct paths:
 * A. EDITORIAL SIGNOFF PATH: Valid human approval + READY_TO_SCHEDULE gate status.
 * B. AUTO POLICY PATH: system_policy_pass = true + operational auto-schedule eligibility,
 *    without requiring human approval.
 * 
 * Precedence Rule: Explicit valid human approval resolves to candidateSource='editorial_signoff'.
 * Legacy Snapshot Rule: Snapshots without policy.system_policy_pass fail closed for auto-policy.
 */
export async function getEligibleReadyCandidates(
  db: any,
  options?: {
    plannerMode?: 'all' | 'manual' | 'auto';
    autoScheduleEnabled?: boolean;
    includeObservationOnly?: boolean;
  }
): Promise<PlannerCandidate[]> {
  // A. Resolve auto_schedule_enabled
  let autoScheduleEnabled = options?.autoScheduleEnabled;
  if (autoScheduleEnabled === undefined) {
    try {
      const row = await db
        .prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled' LIMIT 1")
        .first();
      autoScheduleEnabled = Boolean(row && (row.value === 'true' || row.value === '1'));
    } catch {
      autoScheduleEnabled = false;
    }
  }

  // B. Resolve automation control & capability matrix
  let autoControl = { mode: 'OFF', kill_switch_engaged: 0 };
  try {
    autoControl = await getAutomationControl(db);
  } catch {
    autoControl = { mode: 'OFF', kill_switch_engaged: 0 };
  }

  const killSwitchEngaged = Boolean(autoControl.kill_switch_engaged === 1);
  const caps = getCapabilityMatrix(autoControl.mode as any, killSwitchEngaged);

  // C. Check if planner is globally paused
  let plannerPaused = false;
  try {
    const pauseSetting = await db
      .prepare("SELECT value FROM settings WHERE key = 'planner_paused' LIMIT 1")
      .first();
    plannerPaused = Boolean(pauseSetting && (pauseSetting.value === '1' || pauseSetting.value === 'true'));
  } catch {
    plannerPaused = false;
  }

  const canAutoPlan = Boolean(
    autoScheduleEnabled &&
    !killSwitchEngaged &&
    (caps.canPlan || (options?.includeObservationOnly && caps.canObserve)) &&
    !plannerPaused
  );

  // D. Query draft articles with active featured media, latest readiness snapshot, and latest approval
  const query = `
    SELECT a.id, a.slug, a.title, a.status, a.content_hash, a.category_id,
           a.author_id, a.focus_keyword, a.reading_time_minutes,
           a.is_featured, a.is_trending, a.is_sponsored,
           COALESCE(a.manual_hold, 0) AS manual_hold,
           am.asset_id AS featured_asset_id,
           r.id AS readiness_id, r.is_ready, r.overall_status, r.evaluated_at,
           r.content_hash AS readiness_content_hash, r.snapshot_json,
           app.id AS approval_id, app.approved_by, app.approved_asset_id,
           app.approval_status, app.approved_content_hash
    FROM articles a
    JOIN article_media am ON a.id = am.article_id AND am.role = 'featured' AND am.is_active = 1
    LEFT JOIN article_publication_readiness r ON a.id = r.article_id
      AND r.id = (
        SELECT id FROM article_publication_readiness
        WHERE article_id = a.id
        ORDER BY evaluated_at DESC, id DESC
        LIMIT 1
      )
    LEFT JOIN article_editorial_approvals app ON a.id = app.article_id
      AND app.id = (
        SELECT id FROM article_editorial_approvals
        WHERE article_id = a.id
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      )
    WHERE a.status = 'draft'
    ORDER BY r.evaluated_at ASC, a.id ASC;
  `;

  const result = await db.prepare(query).all();
  const rows = result.results || result || [];
  const candidates: PlannerCandidate[] = [];

  for (const row of rows) {
    const manualHold = Boolean(row.manual_hold === 1);
    if (manualHold) {
      // Manual hold excludes article from automatic planning
      continue;
    }

    // Active or completed execution conflict check
    let hasActiveExecution = false;
    try {
      const activeExec = await db
        .prepare(
          `SELECT execution_id FROM article_publication_executions
           WHERE article_id = ?
             AND execution_status IN ('SCHEDULED', 'CLAIMED', 'PUBLISHING', 'RETRY_WAIT', 'PUBLISHED')
           LIMIT 1`
        )
        .bind(row.id)
        .first();
      hasActiveExecution = Boolean(activeExec);
    } catch {
      hasActiveExecution = false;
    }

    if (hasActiveExecution) {
      continue;
    }

    // Active plan conflict check
    let hasActivePlan = false;
    try {
      const activePlan = await db
        .prepare(
          `SELECT plan_id FROM article_publication_plans
           WHERE article_id = ? AND plan_status = 'PLANNED'
           LIMIT 1`
        )
        .bind(row.id)
        .first();
      hasActivePlan = Boolean(activePlan);
    } catch {
      hasActivePlan = false;
    }

    // Parse readiness snapshot payload
    let snapshotPayload: any = null;
    if (row.snapshot_json) {
      try {
        snapshotPayload = JSON.parse(row.snapshot_json);
      } catch {
        snapshotPayload = null;
      }
    }

    // Resolve system_policy_pass (Fail closed on legacy snapshot missing the field)
    let systemPolicyPass = false;
    if (snapshotPayload && typeof snapshotPayload.policy?.system_policy_pass === 'boolean') {
      systemPolicyPass = snapshotPayload.policy.system_policy_pass;
    } else {
      systemPolicyPass = false;
    }

    // Resolve human approval pass
    const humanApprovalPass = Boolean(
      row.approval_id &&
      row.approval_status === 'APPROVED' &&
      row.approved_content_hash === row.content_hash &&
      row.approved_asset_id === row.featured_asset_id
    );

    // Path A: Editorial Signoff Eligibility
    const isEditorialEligible = Boolean(
      humanApprovalPass &&
      row.readiness_id &&
      row.is_ready === 1 &&
      row.overall_status === 'READY_TO_SCHEDULE' &&
      row.readiness_content_hash === row.content_hash
    );

    // Path B: Auto Policy Eligibility (no human approval required)
    const isAutoPolicyEligible = Boolean(
      canAutoPlan &&
      systemPolicyPass &&
      row.readiness_content_hash === row.content_hash &&
      !hasActivePlan
    );

    // Precedence: Valid human approval takes precedence as editorial_signoff
    let candidateSource: 'editorial_signoff' | 'auto_policy' | null = null;
    if (isEditorialEligible) {
      candidateSource = 'editorial_signoff';
    } else if (isAutoPolicyEligible) {
      candidateSource = 'auto_policy';
    }

    if (!candidateSource) {
      continue;
    }

    // Invocation mode filtering if specified
    if (options?.plannerMode === 'manual' && candidateSource !== 'editorial_signoff') {
      continue;
    }
    if (options?.plannerMode === 'auto' && candidateSource !== 'auto_policy') {
      continue;
    }

    candidates.push({
      articleId: row.id,
      slug: row.slug,
      title: row.title,
      categoryId: row.category_id,
      authorId: row.author_id,
      contentHash: row.content_hash,
      readinessSnapshotId: row.readiness_id,
      readinessEvaluatedAt: row.evaluated_at || new Date().toISOString(),
      approvedBy: candidateSource === 'editorial_signoff' ? row.approved_by : null,
      approvedAssetId: row.featured_asset_id,
      focusKeyword: row.focus_keyword || null,
      readingTimeMinutes: row.reading_time_minutes || 3,
      isFeatured: Boolean(row.is_featured),
      isTrending: Boolean(row.is_trending),
      isSponsored: Boolean(row.is_sponsored),
      operatorPriority: 0,
      candidateSource,
      schedulingMode: candidateSource,
      systemPolicyPass,
      humanApprovalPass,
      manualHold
    });
  }

  return candidates;
}

/**
 * 2. Stale Plan Protection & Validation
 * Revalidates an active plan before any downstream dispatch or inspection.
 * If article content, featured media, or human approval changed after planning,
 * the plan is immediately transitioned to BLOCKED.
 */
export async function validatePlanFreshness(
  db: any,
  planId: string
): Promise<{ isValid: boolean; reason?: string; plan?: PublicationPlanRecord }> {
  const planRes = await db
    .prepare('SELECT * FROM article_publication_plans WHERE plan_id = ? LIMIT 1')
    .bind(planId)
    .first();

  if (!planRes) {
    return { isValid: false, reason: 'PLAN_NOT_FOUND' };
  }

  const plan = planRes as PublicationPlanRecord;

  if (plan.plan_status !== PLAN_STATUS_PLANNED) {
    return { isValid: false, reason: `PLAN_INACTIVE_${plan.plan_status}`, plan };
  }

  // Fetch current article
  const art = await db
    .prepare('SELECT id, status, content_hash, COALESCE(manual_hold, 0) AS manual_hold FROM articles WHERE id = ? LIMIT 1')
    .bind(plan.article_id)
    .first();

  if (!art || art.status !== 'draft') {
    await markPlanBlocked(db, plan.plan_id, plan.article_id, 'ARTICLE_NOT_DRAFT');
    return { isValid: false, reason: 'ARTICLE_NOT_DRAFT', plan };
  }

  // Cryptographic content hash check
  if (art.content_hash !== plan.content_hash) {
    await markPlanBlocked(db, plan.plan_id, plan.article_id, 'CONTENT_CHANGED_AFTER_PLANNING');
    return { isValid: false, reason: 'CONTENT_CHANGED', plan };
  }

  // Check active featured media
  const activeMedia = await db
    .prepare("SELECT asset_id FROM article_media WHERE article_id = ? AND role = 'featured' AND is_active = 1 LIMIT 1")
    .bind(plan.article_id)
    .first();

  if (!activeMedia || activeMedia.asset_id !== plan.featured_asset_id) {
    await markPlanBlocked(db, plan.plan_id, plan.article_id, 'MEDIA_CHANGED_AFTER_PLANNING');
    return { isValid: false, reason: 'MEDIA_CHANGED', plan };
  }

  // Path-specific revalidation:
  if (plan.scheduling_mode === 'auto_policy') {
    // A. Manual hold check
    if (art.manual_hold === 1) {
      await markPlanBlocked(db, plan.plan_id, plan.article_id, 'MANUAL_HOLD_ENGAGED_AFTER_PLANNING');
      return { isValid: false, reason: 'MANUAL_HOLD_ENGAGED', plan };
    }

    // B. Revalidate latest readiness snapshot policy.system_policy_pass
    const latestReadiness = await db
      .prepare('SELECT is_ready, overall_status, content_hash, snapshot_json FROM article_publication_readiness WHERE article_id = ? ORDER BY evaluated_at DESC, id DESC LIMIT 1')
      .bind(plan.article_id)
      .first();

    let systemPolicyPass = false;
    if (latestReadiness?.snapshot_json) {
      try {
        const payload = JSON.parse(latestReadiness.snapshot_json);
        if (typeof payload.policy?.system_policy_pass === 'boolean') {
          systemPolicyPass = payload.policy.system_policy_pass;
        }
      } catch {
        systemPolicyPass = false;
      }
    }

    if (!latestReadiness || !systemPolicyPass || latestReadiness.content_hash !== plan.content_hash) {
      await markPlanBlocked(db, plan.plan_id, plan.article_id, 'SYSTEM_POLICY_INVALIDATED_AFTER_PLANNING');
      return { isValid: false, reason: 'SYSTEM_POLICY_INVALID', plan };
    }

    return { isValid: true, plan };
  }

  // Editorial signoff / legacy path revalidation: requires valid human approval and READY_TO_SCHEDULE
  const latestApproval = await db
    .prepare('SELECT approval_status, approved_content_hash, approved_asset_id FROM article_editorial_approvals WHERE article_id = ? ORDER BY created_at DESC, id DESC LIMIT 1')
    .bind(plan.article_id)
    .first();

  if (
    !latestApproval ||
    latestApproval.approval_status !== 'APPROVED' ||
    latestApproval.approved_content_hash !== plan.content_hash ||
    latestApproval.approved_asset_id !== plan.featured_asset_id
  ) {
    await markPlanBlocked(db, plan.plan_id, plan.article_id, 'APPROVAL_INVALIDATED_AFTER_PLANNING');
    return { isValid: false, reason: 'APPROVAL_INVALID', plan };
  }

  // Check current readiness snapshot
  const latestReadiness = await db
    .prepare('SELECT is_ready, overall_status, content_hash FROM article_publication_readiness WHERE article_id = ? ORDER BY evaluated_at DESC, id DESC LIMIT 1')
    .bind(plan.article_id)
    .first();

  if (!latestReadiness || latestReadiness.is_ready !== 1 || latestReadiness.overall_status !== 'READY_TO_SCHEDULE') {
    await markPlanBlocked(db, plan.plan_id, plan.article_id, 'READINESS_INVALIDATED_AFTER_PLANNING');
    return { isValid: false, reason: 'READINESS_INVALID', plan };
  }

  return { isValid: true, plan };
}

/**
 * Helper: Marks plan as BLOCKED and logs event
 */
async function markPlanBlocked(db: any, planId: string, articleId: number, reason: string): Promise<void> {
  await db
    .prepare(`
      UPDATE article_publication_plans 
      SET plan_status = '${PLAN_STATUS_BLOCKED}', updated_at = CURRENT_TIMESTAMP 
      WHERE plan_id = ?
    `)
    .bind(planId)
    .run();

  await db
    .prepare(`
      INSERT INTO publication_plan_events (plan_id, article_id, event_type, actor_type, actor_id, details_json)
      VALUES (?, ?, 'BLOCKED', 'planner', 'publication1-guard', ?)
    `)
    .bind(planId, articleId, JSON.stringify({ reason }))
    .run();
}

/**
 * 3. Execute Publication Planner Run
 * Fully deterministic, idempotent, and audit-logged planner execution.
 */
export async function executePublicationPlanner(
  db: any,
  options: {
    targetDate?: string;                  // 'YYYY-MM-DD', default today in WIB
    profile?: PlannerProfile;             // default GROWING
    signals?: IndexHealthSignals;
    capacityOverride?: number | null;
    scoringWeights?: any;
    dryRun?: boolean;
    actor?: string;
    plannerMode?: 'all' | 'manual' | 'auto';
    autoScheduleEnabled?: boolean;
    env?: any;
  } = {}
): Promise<PlannerExecutionResult> {
  const profile = options.profile || PLANNER_PROFILE_GROWING;
  const config = DEFAULT_PROFILES[profile];
  if (!config) {
    throw new Error(`Invalid planner profile: ${profile}`);
  }

  // Determine target date in Asia/Jakarta (WIB = UTC+7)
  const now = new Date();
  const wibTime = new Date(now.getTime() + 7 * 3600 * 1000);
  const targetDate = options.targetDate || wibTime.toISOString().slice(0, 10);

  // 0. SOAK-0 Outer Safety Envelope: Automation Mode, Kill Switch
  let autoControl;
  try {
    autoControl = await getAutomationControl(db);
  } catch {
    autoControl = { mode: 'OFF', kill_switch_engaged: 0 };
  }

  // A. Global Kill Switch Check
  if (autoControl.kill_switch_engaged === 1) {
    throw new Error('KILL_SWITCH_ENGAGED: Publication planning is blocked by global emergency kill switch');
  }

  // B. Automation Mode Capability Check
  const caps = getCapabilityMatrix(autoControl.mode as any, Boolean(autoControl.kill_switch_engaged));
  const isAutomated = options.actor === 'cron' || options.actor === 'scheduler' || options.actor === 'system';
  if (isAutomated && !caps.canPlan && !caps.canObserve) {
    throw new Error(`AUTOMATION_MODE_${autoControl.mode}: Publication planning is blocked under mode ${autoControl.mode}`);
  }

  // Check if planner is globally paused
  const pauseSetting = await db
    .prepare("SELECT value FROM settings WHERE key = 'planner_paused' LIMIT 1")
    .first()
    .catch(() => null);

  if (pauseSetting && (pauseSetting.value === '1' || pauseSetting.value === 'true')) {
    throw new Error('PLANNER_PAUSED: Automated publication planning is currently paused by operator');
  }

  const runId = `prun_${getRandomHex(6)}`;

  // 1. Fetch eligible ready candidates
  const candidates = await getEligibleReadyCandidates(db, {
    plannerMode: options.plannerMode,
    autoScheduleEnabled: options.autoScheduleEnabled,
    includeObservationOnly: Boolean(caps.canObserve)
  });

  // 2. Fetch operator priority overrides from settings or draft metadata if any
  for (const c of candidates) {
    const prioRow = await db
      .prepare("SELECT value FROM settings WHERE key = ? LIMIT 1")
      .bind(`article_priority_${c.articleId}`)
      .first()
      .catch(() => null);
    if (prioRow && Number.isFinite(Number(prioRow.value))) {
      c.operatorPriority = Number(prioRow.value);
    }
  }

  // 2b. JEV-SHADOW-1: Trigger non-authoritative shadow decision observation (Minimal State, zero execution authority)
  for (const c of candidates) {
    try {
      await observeCandidateShadowDecision({
        project: 'RancangLoka',
        articleId: c.articleId,
        slug: c.slug,
        articleGenerationCompleted: true,
        editorialValidationPassed: true,
        referencesPresent: true,
        heroImagePresent: true,
        duplicateSlug: false,
        readinessStatus: 'READY_TO_SCHEDULE',
        readingTimeMinutes: c.readingTimeMinutes,
        isSponsored: c.isSponsored
      }, {
        correlationId: runId,
        db,
        env: options.env
      });
    } catch {
      // Failsafe: zero impact on deterministic planner
    }
  }

  // 3. Fetch historical published articles (last 7 days) for category balancing
  const historicalPublished: Array<{ categoryId: number; focusKeyword?: string; publishedAt: string }> = [];
  try {
    const histRows = await db
      .prepare(`
        SELECT category_id, focus_keyword, published_at 
        FROM articles 
        WHERE status = 'published' 
          AND published_at >= datetime('now', '-7 days')
      `)
      .all();
    for (const r of (histRows.results || histRows || [])) {
      historicalPublished.push({
        categoryId: r.category_id,
        focusKeyword: r.focus_keyword,
        publishedAt: r.published_at
      });
    }
  } catch {
    // ignore if mock or query failure
  }

  // 4. Calculate effective capacity
  let { effectiveCapacity, reasons: capReasons, multipliers } = calculateEffectiveCapacity(
    config,
    options.signals,
    candidates.length,
    options.capacityOverride
  );

  // Rate limiter ceiling interaction: safety ceiling caps automated capacity
  if (isAutomated) {
    effectiveCapacity = computeEffectiveCapacity(effectiveCapacity, DEFAULT_ACTIVATION_ENVELOPE);
  }

  // 5. Deterministic scoring & ranking
  const ranked = scoreAndRankCandidates(
    candidates,
    historicalPublished,
    options.scoringWeights,
    now.getTime()
  );

  // 6. Temporal window sequencing
  const { planned, deferred } = assignPublicationWindows(
    ranked,
    targetDate,
    config,
    effectiveCapacity,
    PLANNER_VERSION
  );

  const explanations: Array<{
    articleId: number;
    action: 'PLANNED' | 'DEFERRED' | 'BLOCKED';
    slotIndex?: number;
    targetPublishLocal?: string;
    reasons: string[];
    candidateSource?: 'editorial_signoff' | 'auto_policy';
    schedulingMode?: 'editorial_signoff' | 'auto_policy';
    systemPolicyPass?: boolean;
    humanApprovalPass?: boolean;
    manualHold?: boolean;
  }> = [];

  for (const p of planned) {
    explanations.push({
      articleId: p.candidate.articleId,
      action: 'PLANNED',
      slotIndex: p.slotIndex,
      targetPublishLocal: p.targetPublishLocal,
      reasons: p.reasonCodes,
      candidateSource: p.candidate.candidateSource,
      schedulingMode: p.candidate.schedulingMode,
      systemPolicyPass: p.candidate.systemPolicyPass,
      humanApprovalPass: p.candidate.humanApprovalPass,
      manualHold: p.candidate.manualHold
    });
  }

  for (const d of deferred) {
    explanations.push({
      articleId: d.articleId,
      action: 'DEFERRED',
      reasons: ['DAILY_CAPACITY_CEILING_REACHED', 'DEFERRED_TO_NEXT_CYCLE'],
      candidateSource: d.candidateSource,
      schedulingMode: d.schedulingMode,
      systemPolicyPass: d.systemPolicyPass,
      humanApprovalPass: d.humanApprovalPass,
      manualHold: d.manualHold
    });
  }

  // 7. Persist plans idempotently unless dryRun OR automated planning capability is disabled (e.g. OBSERVE_ONLY)
  const canPersistPlans = !options.dryRun && (!isAutomated || caps.canPlan);
  if (canPersistPlans) {
    for (const assignment of planned) {
      const { candidate, planId, slotIndex, targetPublishAt, targetPublishLocal, timezone, jitterSeconds, reasonCodes } = assignment;

      // Check if candidate already has an active plan
      const existingPlan = await db
        .prepare(`SELECT * FROM article_publication_plans WHERE article_id = ? AND plan_status = '${PLAN_STATUS_PLANNED}' LIMIT 1`)
        .bind(candidate.articleId)
        .first();

      let supersedesId: string | null = null;

      if (existingPlan) {
        // If identical target date and time within 60s, keep existing plan (idempotent)
        const diffMs = Math.abs(new Date(existingPlan.target_publish_at).getTime() - new Date(targetPublishAt).getTime());
        if (diffMs <= 60000 && existingPlan.content_hash === candidate.contentHash) {
          continue; // Idempotent: plan is identical and active
        }

        // Otherwise, supersede previous plan
        supersedesId = existingPlan.plan_id;
        await db
          .prepare(`UPDATE article_publication_plans SET plan_status = '${PLAN_STATUS_SUPERSEDED}', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .bind(existingPlan.id)
          .run();

        await db
          .prepare(`
            INSERT INTO publication_plan_events (plan_id, article_id, event_type, actor_type, actor_id, details_json)
            VALUES (?, ?, 'SUPERSEDED', 'planner', 'publication1-planner', ?)
          `)
          .bind(existingPlan.plan_id, candidate.articleId, JSON.stringify({ superseding_plan_id: planId }))
          .run();
      }

      // Insert new active plan
      const planSchedulingMode = candidate.schedulingMode || (candidate.candidateSource === 'auto_policy' ? 'auto_policy' : 'editorial_signoff');
      await db
        .prepare(`
          INSERT INTO article_publication_plans (
            plan_id, article_id, readiness_id, content_hash, featured_asset_id,
            target_publish_at, target_publish_local, timezone, plan_status,
            planner_profile, planner_version, priority_score, slot_index,
            jitter_seconds, reason_codes, supersedes_plan_id, scheduling_mode
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '${PLAN_STATUS_PLANNED}', ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          planId,
          candidate.articleId,
          candidate.readinessSnapshotId,
          candidate.contentHash,
          candidate.approvedAssetId,
          targetPublishAt,
          targetPublishLocal,
          timezone,
          profile,
          PLANNER_VERSION,
          candidate.priorityScore,
          slotIndex,
          jitterSeconds,
          JSON.stringify(reasonCodes),
          supersedesId,
          planSchedulingMode
        )
        .run();

      // Log plan creation event
      await db
        .prepare(`
          INSERT INTO publication_plan_events (plan_id, article_id, event_type, actor_type, actor_id, details_json)
          VALUES (?, ?, 'CREATED', 'planner', 'publication1-planner', ?)
        `)
        .bind(
          planId,
          candidate.articleId,
          JSON.stringify({
            targetPublishLocal,
            slotIndex,
            scheduling_mode: planSchedulingMode
          })
        )
        .run();
    }

    // Persist planner run record
    await db
      .prepare(`
        INSERT INTO publication_planner_runs (
          run_id, planner_profile, planner_version, target_date,
          eligible_count, planned_count, deferred_count, blocked_count,
          effective_capacity, signals_json, explanations_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        runId,
        profile,
        PLANNER_VERSION,
        targetDate,
        candidates.length,
        planned.length,
        deferred.length,
        0,
        effectiveCapacity,
        JSON.stringify({ signals: options.signals || {}, multipliers, capReasons }),
        JSON.stringify(explanations)
      )
      .run();
  }

  return {
    runId,
    targetDate,
    profile,
    effectiveCapacity,
    eligibleCount: candidates.length,
    plannedCount: canPersistPlans ? planned.length : 0,
    deferredCount: canPersistPlans ? deferred.length : 0,
    blockedCount: 0,
    plans: canPersistPlans ? planned : [],
    deferredArticleIds: canPersistPlans ? deferred.map(d => d.articleId) : [],
    signalsUsed: options.signals || {},
    explanations
  };
}

/**
 * 4. Human Editorial Controls
 */

export async function prioritizeArticle(
  db: any,
  articleId: number,
  priorityScore: number,
  operator: string = 'editor'
): Promise<void> {
  const boundedScore = Math.max(0, Math.min(100, priorityScore));
  await db
    .prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `)
    .bind(`article_priority_${articleId}`, String(boundedScore))
    .run();
}

export async function reschedulePlan(
  db: any,
  planId: string,
  newTargetIso: string,
  operator: string = 'editor',
  notes?: string
): Promise<{ success: boolean; plan: PublicationPlanRecord }> {
  const check = await validatePlanFreshness(db, planId);
  if (!check.isValid || !check.plan) {
    throw new Error(`CANNOT_RESCHEDULE: Plan is not fresh (${check.reason})`);
  }

  const d = new Date(newTargetIso);
  if (isNaN(d.getTime())) {
    throw new Error('INVALID_TARGET_DATE: Must be valid ISO 8601');
  }

  // Compute local WIB string
  const wibTime = new Date(d.getTime() + 7 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const localStr = `${wibTime.toISOString().slice(0, 10)} ${pad(wibTime.getUTCHours())}:${pad(wibTime.getUTCMinutes())}:${pad(wibTime.getUTCSeconds())} WIB`;

  await db
    .prepare(`
      UPDATE article_publication_plans 
      SET target_publish_at = ?, target_publish_local = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE plan_id = ?
    `)
    .bind(newTargetIso, localStr, planId)
    .run();

  await db
    .prepare(`
      INSERT INTO publication_plan_events (plan_id, article_id, event_type, actor_type, actor_id, details_json)
      VALUES (?, ?, 'RESCHEDULED', 'operator', ?, ?)
    `)
    .bind(planId, check.plan.article_id, operator, JSON.stringify({ oldTime: check.plan.target_publish_at, newTime: newTargetIso, notes }))
    .run();

  const updated = await db
    .prepare('SELECT * FROM article_publication_plans WHERE plan_id = ? LIMIT 1')
    .bind(planId)
    .first();

  return { success: true, plan: updated as PublicationPlanRecord };
}

export async function movePlanEarlier(
  db: any,
  planId: string,
  minutes: number,
  operator: string = 'editor'
): Promise<{ success: boolean; plan: PublicationPlanRecord }> {
  const check = await validatePlanFreshness(db, planId);
  if (!check.isValid || !check.plan) {
    throw new Error(`CANNOT_MOVE_EARLIER: Plan is not fresh (${check.reason})`);
  }

  const currentMs = new Date(check.plan.target_publish_at).getTime();
  const newMs = currentMs - minutes * 60 * 1000;
  return reschedulePlan(db, planId, new Date(newMs).toISOString(), operator, `Moved earlier by ${minutes}m`);
}

export async function movePlanLater(
  db: any,
  planId: string,
  minutes: number,
  operator: string = 'editor'
): Promise<{ success: boolean; plan: PublicationPlanRecord }> {
  const check = await validatePlanFreshness(db, planId);
  if (!check.isValid || !check.plan) {
    throw new Error(`CANNOT_MOVE_LATER: Plan is not fresh (${check.reason})`);
  }

  const currentMs = new Date(check.plan.target_publish_at).getTime();
  const newMs = currentMs + minutes * 60 * 1000;
  return reschedulePlan(db, planId, new Date(newMs).toISOString(), operator, `Moved later by ${minutes}m`);
}

export async function cancelPlan(
  db: any,
  planId: string,
  operator: string = 'editor',
  reason: string = 'Manual cancellation'
): Promise<void> {
  const plan = await db
    .prepare('SELECT * FROM article_publication_plans WHERE plan_id = ? LIMIT 1')
    .bind(planId)
    .first();

  if (!plan) {
    throw new Error('PLAN_NOT_FOUND');
  }

  await db
    .prepare(`
      UPDATE article_publication_plans 
      SET plan_status = '${PLAN_STATUS_CANCELLED}', updated_at = CURRENT_TIMESTAMP 
      WHERE plan_id = ?
    `)
    .bind(planId)
    .run();

  await db
    .prepare(`
      INSERT INTO publication_plan_events (plan_id, article_id, event_type, actor_type, actor_id, details_json)
      VALUES (?, ?, 'CANCELLED', 'operator', ?, ?)
    `)
    .bind(planId, plan.article_id, operator, JSON.stringify({ reason }))
    .run();
}

export async function setPlannerPause(
  db: any,
  paused: boolean,
  operator: string = 'editor'
): Promise<void> {
  await db
    .prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES ('planner_paused', ?, CURRENT_TIMESTAMP)
    `)
    .bind(paused ? '1' : '0')
    .run();
}

export async function overrideDailyCapacity(
  db: any,
  dateStr: string,
  capacity: number,
  operator: string = 'editor'
): Promise<void> {
  await db
    .prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `)
    .bind(`planner_capacity_override_${dateStr}`, String(capacity))
    .run();
}

export async function getActivePlans(
  db: any,
  options: { dateStr?: string; limit?: number } = {}
): Promise<PublicationPlanRecord[]> {
  let query = `
    SELECT * FROM article_publication_plans 
    WHERE plan_status = '${PLAN_STATUS_PLANNED}'
  `;
  const params: any[] = [];

  if (options.dateStr) {
    query += ` AND target_publish_local LIKE ?`;
    params.push(`${options.dateStr}%`);
  }

  query += ` ORDER BY target_publish_at ASC`;

  if (options.limit) {
    query += ` LIMIT ?`;
    params.push(options.limit);
  }

  const res = await db.prepare(query).bind(...params).all();
  return (res.results || res || []) as PublicationPlanRecord[];
}
