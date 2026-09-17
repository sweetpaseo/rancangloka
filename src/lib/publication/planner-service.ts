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

/**
 * 1. Eligible Inventory Query
 * Consumes ONLY articles that have verified READY_TO_SCHEDULE gate status,
 * strictly matching content_hash, active featured media, and approved sign-off.
 */
export async function getEligibleReadyCandidates(db: any): Promise<PlannerCandidate[]> {
  const query = `
    SELECT a.id, a.slug, a.title, a.status, a.content_hash, a.category_id,
           a.author_id, a.focus_keyword, a.reading_time_minutes,
           a.is_featured, a.is_trending, a.is_sponsored,
           r.id as readiness_id, r.is_ready, r.overall_status, r.evaluated_at, r.snapshot_json,
           app.approved_by, app.approved_asset_id, app.approval_status
    FROM articles a
    JOIN article_publication_readiness r ON a.id = r.article_id
    JOIN article_editorial_approvals app ON a.id = app.article_id
    JOIN article_media am ON a.id = am.article_id AND am.role = 'featured' AND am.is_active = 1
    WHERE a.status = 'draft'
      AND r.is_ready = 1
      AND r.overall_status = 'READY_TO_SCHEDULE'
      AND a.content_hash = r.content_hash
      AND app.approval_status = 'APPROVED'
      AND app.approved_content_hash = a.content_hash
      AND app.approved_asset_id = am.asset_id
      AND r.id = (
        SELECT id FROM article_publication_readiness
        WHERE article_id = a.id
        ORDER BY evaluated_at DESC, id DESC
        LIMIT 1
      )
      AND app.id = (
        SELECT id FROM article_editorial_approvals
        WHERE article_id = a.id
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      )
    ORDER BY r.evaluated_at ASC;
  `;

  const result = await db.prepare(query).all();
  const rows = result.results || result || [];

  return rows.map((row: any) => ({
    articleId: row.id,
    slug: row.slug,
    title: row.title,
    categoryId: row.category_id,
    authorId: row.author_id,
    contentHash: row.content_hash,
    readinessSnapshotId: row.readiness_id,
    readinessEvaluatedAt: row.evaluated_at,
    approvedBy: row.approved_by,
    approvedAssetId: row.approved_asset_id,
    focusKeyword: row.focus_keyword || null,
    readingTimeMinutes: row.reading_time_minutes || 3,
    isFeatured: Boolean(row.is_featured),
    isTrending: Boolean(row.is_trending),
    isSponsored: Boolean(row.is_sponsored),
    operatorPriority: 0
  }));
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
    .prepare('SELECT id, status, content_hash FROM articles WHERE id = ? LIMIT 1')
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

  // Check current approval
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
  if (isAutomated && !caps.canPlan) {
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
  const candidates = await getEligibleReadyCandidates(db);

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
  }> = [];

  for (const p of planned) {
    explanations.push({
      articleId: p.candidate.articleId,
      action: 'PLANNED',
      slotIndex: p.slotIndex,
      targetPublishLocal: p.targetPublishLocal,
      reasons: p.reasonCodes
    });
  }

  for (const d of deferred) {
    explanations.push({
      articleId: d.articleId,
      action: 'DEFERRED',
      reasons: ['DAILY_CAPACITY_CEILING_REACHED', 'DEFERRED_TO_NEXT_CYCLE']
    });
  }

  // 7. Persist plans idempotently unless dryRun
  if (!options.dryRun) {
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
      await db
        .prepare(`
          INSERT INTO article_publication_plans (
            plan_id, article_id, readiness_id, content_hash, featured_asset_id,
            target_publish_at, target_publish_local, timezone, plan_status,
            planner_profile, planner_version, priority_score, slot_index,
            jitter_seconds, reason_codes, supersedes_plan_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '${PLAN_STATUS_PLANNED}', ?, ?, ?, ?, ?, ?, ?)
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
          supersedesId
        )
        .run();

      // Log plan creation event
      await db
        .prepare(`
          INSERT INTO publication_plan_events (plan_id, article_id, event_type, actor_type, actor_id, details_json)
          VALUES (?, ?, 'CREATED', 'planner', 'publication1-planner', ?)
        `)
        .bind(planId, candidate.articleId, JSON.stringify({ targetPublishLocal, slotIndex }))
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
    plannedCount: planned.length,
    deferredCount: deferred.length,
    blockedCount: 0,
    plans: planned,
    deferredArticleIds: deferred.map(d => d.articleId),
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
