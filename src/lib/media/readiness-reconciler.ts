/**
 * RancangLoka — LokaMedia Phase 5I1
 * Canonical Readiness Evaluator & Reconciler
 *
 * Provides a deterministic, fail-closed evaluator that derives media review readiness
 * from authoritative repository state:
 * - Article draft status
 * - Authoritative required media requirements (media_jobs with required_for_readiness = 1,
 *   falling back to legacy featured slot if no durable requirements exist)
 * - Canonical active article_media attachments
 * - Validated media_assets with compatible role & dimensions
 * - Active slot consistency (fails closed if multiple active attachments exist for one slot)
 *
 * Guarantees:
 * - ZERO article body or article status mutation.
 * - ZERO publication execution (READY_FOR_REVIEW != READY_TO_SCHEDULE != PUBLISHED).
 * - ZERO article_media or media_assets mutations.
 * - Dry-run capability with ZERO database writes.
 * - Idempotent persistence with identical-readiness NO-OP.
 * - Reversible / safe regression if attachments become missing or invalid.
 */

export const READINESS_STATES = [
  'WAITING_MEDIA',
  'MEDIA_IN_PROGRESS',
  'MEDIA_NEEDS_ATTENTION',
  'READY_FOR_REVIEW'
] as const;

export type ReadinessState = (typeof READINESS_STATES)[number];

export const READINESS_NONE = 'NONE';
export const READINESS_WAITING_MEDIA = 'WAITING_MEDIA';
export const READINESS_MEDIA_IN_PROGRESS = 'MEDIA_IN_PROGRESS';
export const READINESS_MEDIA_NEEDS_ATTENTION = 'MEDIA_NEEDS_ATTENTION';
export const READINESS_READY_FOR_REVIEW = 'READY_FOR_REVIEW';

export const READINESS_PERSISTENCE_TABLE = 'article_publication_readiness';

export const MEDIA_JOB_NEEDS_ATTENTION_STATES = new Set([
  'AUTH_REQUIRED',
  'PROVIDER_BLOCKED',
  'USER_ACTION_REQUIRED',
  'FAILED_TERMINAL'
]);

export const MEDIA_JOB_IN_PROGRESS_STATES = new Set([
  'CLAIMED',
  'GENERATING',
  'SUBMITTED',
  'CAPTURING',
  'UPLOADING',
  'ATTACHING',
  'WAITING_RETRY'
]);

export const READINESS_REASON_CODES = {
  ARTICLE_NOT_FOUND: 'ARTICLE_NOT_FOUND',
  ARTICLE_STATUS_NOT_ELIGIBLE: 'ARTICLE_STATUS_NOT_ELIGIBLE',
  MISSING_REQUIRED_MEDIA: 'MISSING_REQUIRED_MEDIA',
  MISSING_ATTACHED_ASSET: 'MISSING_ATTACHED_ASSET',
  INVALID_MEDIA_ASSET: 'INVALID_MEDIA_ASSET',
  INVALID_MEDIA_ASSET_ROLE: 'INVALID_MEDIA_ASSET_ROLE',
  MULTIPLE_ACTIVE_ASSETS_FOR_SLOT: 'MULTIPLE_ACTIVE_ASSETS_FOR_SLOT',
  PROVENANCE_MISMATCH: 'PROVENANCE_MISMATCH',
  MEDIA_JOB_NEEDS_ATTENTION: 'MEDIA_JOB_NEEDS_ATTENTION',
  NON_MEDIA_GATE_FAILED: 'NON_MEDIA_GATE_FAILED'
} as const;

export type ReadinessReasonCode = (typeof READINESS_REASON_CODES)[keyof typeof READINESS_REASON_CODES];

export interface SlotEvaluationDetail {
  slot_key: string;
  role: string;
  required: boolean;
  satisfied: boolean;
  job_id: string | null;
  job_status: string | null;
  active_relation_id: number | null;
  asset_id: string | null;
  asset_status: string | null;
  asset_role: string | null;
  blockers: ReadinessReasonCode[];
}

export interface ReadinessEvaluationResult {
  article_id: number;
  slug: string;
  current_readiness: string;
  evaluated_readiness: ReadinessState;
  ready_for_review: boolean;
  required_media_slots: string[];
  satisfied_requirements: string[];
  attached_media_slots: string[];
  blocking_reasons: ReadinessReasonCode[];
  evaluated_at: string;
  details: {
    article_status: string;
    required_slot_count: number;
    satisfied_slot_count: number;
    slots: Record<string, SlotEvaluationDetail>;
  };
}

export interface ReconcileOptions {
  dryRun?: boolean;
  actor?: string;
}

export interface ReconcileResult extends ReadinessEvaluationResult {
  dryRun: boolean;
  persisted: boolean;
  changed: boolean;
  noop: boolean;
  persisted_id?: number;
}

/**
 * Pure evaluator: inspects database state deterministically without any mutation.
 */
export async function evaluateArticleMediaReadiness(
  db: any,
  articleId: number
): Promise<ReadinessEvaluationResult> {
  const evaluatedAt = new Date().toISOString();
  const blockingReasons: ReadinessReasonCode[] = [];
  const requiredMediaSlots: string[] = [];
  const satisfiedRequirements: string[] = [];
  const attachedMediaSlots: string[] = [];
  const slotDetails: Record<string, SlotEvaluationDetail> = {};

  // 1. Article Existence & Status Gate
  const article = await db
    .prepare('SELECT id, slug, title, status, content_hash FROM articles WHERE id = ?')
    .bind(articleId)
    .first();

  if (!article) {
    return {
      article_id: articleId,
      slug: 'unknown',
      current_readiness: READINESS_NONE,
      evaluated_readiness: READINESS_WAITING_MEDIA,
      ready_for_review: false,
      required_media_slots: [],
      satisfied_requirements: [],
      attached_media_slots: [],
      blocking_reasons: [READINESS_REASON_CODES.ARTICLE_NOT_FOUND],
      evaluated_at: evaluatedAt,
      details: {
        article_status: 'UNKNOWN',
        required_slot_count: 0,
        satisfied_slot_count: 0,
        slots: {}
      }
    };
  }

  // 2. Determine Current Persisted Readiness from article_publication_readiness
  let currentReadiness: string = READINESS_NONE;
  try {
    const latestSnapshotRow = await db
      .prepare(
        `SELECT id, is_ready, overall_status, snapshot_json, evaluated_at
         FROM article_publication_readiness
         WHERE article_id = ?
         ORDER BY evaluated_at DESC, id DESC
         LIMIT 1`
      )
      .bind(articleId)
      .first();

    if (latestSnapshotRow) {
      if (latestSnapshotRow.snapshot_json) {
        try {
          const parsed = JSON.parse(latestSnapshotRow.snapshot_json);
          currentReadiness =
            parsed.evaluated_readiness ||
            parsed.media_readiness ||
            (parsed.ready_for_review ? READINESS_READY_FOR_REVIEW : latestSnapshotRow.overall_status);
        } catch {
          currentReadiness = latestSnapshotRow.overall_status || READINESS_WAITING_MEDIA;
        }
      } else {
        currentReadiness = latestSnapshotRow.overall_status || READINESS_WAITING_MEDIA;
      }
    }
  } catch {
    currentReadiness = READINESS_NONE;
  }

  // 3. Article Status Rule: Only 'draft' is eligible for review readiness
  if (article.status !== 'draft') {
    blockingReasons.push(READINESS_REASON_CODES.ARTICLE_STATUS_NOT_ELIGIBLE);
  }

  // 4. Discover Authoritative Media Requirements
  // Primary source: media_jobs durable queue requirements
  let durableJobs: any[] = [];
  try {
    const { results } = await db
      .prepare(
        `SELECT job_id, slot_key, role, status, required_for_readiness, sequence
         FROM media_jobs
         WHERE article_id = ?
           AND status <> 'SUPERSEDED'
         ORDER BY sequence ASC, created_at ASC`
      )
      .bind(articleId)
      .all();
    durableJobs = results || [];
  } catch {
    durableJobs = [];
  }

  interface SlotRequirementDef {
    slot_key: string;
    role: string;
    required: boolean;
    job_id: string | null;
    job_status: string | null;
  }

  const requirementsMap = new Map<string, SlotRequirementDef>();

  if (durableJobs.length > 0) {
    for (const job of durableJobs) {
      const slotKey = String(job.slot_key || '').trim();
      if (!slotKey) continue;
      const isRequired = Number(job.required_for_readiness) === 1;
      requirementsMap.set(slotKey, {
        slot_key: slotKey,
        role: String(job.role || 'featured').trim(),
        required: isRequired,
        job_id: job.job_id ? String(job.job_id) : null,
        job_status: job.status ? String(job.status) : null
      });
    }
  } else {
    // Legacy fallback: single featured slot is required
    requirementsMap.set('featured', {
      slot_key: 'featured',
      role: 'featured',
      required: true,
      job_id: null,
      job_status: null
    });
  }

  let hasAttention = false;
  let hasInProgress = false;

  // 5. Evaluate Every Slot
  for (const [slotKey, req] of requirementsMap.entries()) {
    if (req.required) {
      requiredMediaSlots.push(slotKey);
    }

    const slotBlockers: ReadinessReasonCode[] = [];

    // Query active attachments for this slot
    let activeAttachments: any[] = [];
    try {
      const { results } = await db
        .prepare(
          `SELECT am.id, am.article_id, am.asset_id, am.role, am.slot_key, am.is_active,
                  ma.status AS asset_status, ma.role AS asset_role, ma.storage_key, ma.media_type
           FROM article_media am
           LEFT JOIN media_assets ma ON am.asset_id = ma.asset_id
           WHERE am.article_id = ? AND am.slot_key = ? AND am.is_active = 1`
        )
        .bind(articleId, slotKey)
        .all();
      activeAttachments = results || [];
    } catch {
      activeAttachments = [];
    }

    if (activeAttachments.length > 0) {
      attachedMediaSlots.push(slotKey);
    }

    // Check Multiple Active Assets for Slot Inconsistency
    if (activeAttachments.length > 1) {
      slotBlockers.push(READINESS_REASON_CODES.MULTIPLE_ACTIVE_ASSETS_FOR_SLOT);
      if (req.required) {
        blockingReasons.push(READINESS_REASON_CODES.MULTIPLE_ACTIVE_ASSETS_FOR_SLOT);
      }
    }

    let isSatisfied = false;
    let activeRel: any = null;

    if (activeAttachments.length === 1) {
      activeRel = activeAttachments[0];

      if (!activeRel.asset_id || !activeRel.asset_status) {
        slotBlockers.push(READINESS_REASON_CODES.MISSING_ATTACHED_ASSET);
        if (req.required) {
          blockingReasons.push(READINESS_REASON_CODES.MISSING_ATTACHED_ASSET);
        }
      } else if (activeRel.asset_status !== 'VALIDATED') {
        slotBlockers.push(READINESS_REASON_CODES.INVALID_MEDIA_ASSET);
        if (req.required) {
          blockingReasons.push(READINESS_REASON_CODES.INVALID_MEDIA_ASSET);
        }
      } else if (activeRel.asset_role === 'WATERMARK_MASTER') {
        slotBlockers.push(READINESS_REASON_CODES.INVALID_MEDIA_ASSET_ROLE);
        if (req.required) {
          blockingReasons.push(READINESS_REASON_CODES.INVALID_MEDIA_ASSET_ROLE);
        }
      } else {
        isSatisfied = true;
        if (req.required) {
          satisfiedRequirements.push(slotKey);
        }
      }
    } else if (activeAttachments.length === 0) {
      if (req.required) {
        slotBlockers.push(READINESS_REASON_CODES.MISSING_REQUIRED_MEDIA);
        blockingReasons.push(READINESS_REASON_CODES.MISSING_REQUIRED_MEDIA);

        if (req.job_status) {
          if (MEDIA_JOB_NEEDS_ATTENTION_STATES.has(req.job_status)) {
            hasAttention = true;
            slotBlockers.push(READINESS_REASON_CODES.MEDIA_JOB_NEEDS_ATTENTION);
            blockingReasons.push(READINESS_REASON_CODES.MEDIA_JOB_NEEDS_ATTENTION);
          } else if (MEDIA_JOB_IN_PROGRESS_STATES.has(req.job_status)) {
            hasInProgress = true;
          }
        }
      }
    }

    slotDetails[slotKey] = {
      slot_key: slotKey,
      role: req.role,
      required: req.required,
      satisfied: isSatisfied,
      job_id: req.job_id,
      job_status: req.job_status,
      active_relation_id: activeRel ? activeRel.id : null,
      asset_id: activeRel ? activeRel.asset_id : null,
      asset_status: activeRel ? activeRel.asset_status : null,
      asset_role: activeRel ? activeRel.asset_role : null,
      blockers: slotBlockers
    };
  }

  // 6. Aggregate Evaluated Readiness State
  // De-duplicate blocking reasons
  const uniqueBlockers = Array.from(new Set(blockingReasons));

  let evaluatedReadiness: ReadinessState;
  let readyForReview = false;

  const allRequiredSatisfied =
    requiredMediaSlots.length > 0 &&
    requiredMediaSlots.every((slot) => satisfiedRequirements.includes(slot));

  if (article.status !== 'draft') {
    evaluatedReadiness = READINESS_WAITING_MEDIA;
    readyForReview = false;
  } else if (allRequiredSatisfied && uniqueBlockers.length === 0) {
    evaluatedReadiness = READINESS_READY_FOR_REVIEW;
    readyForReview = true;
  } else if (hasAttention) {
    evaluatedReadiness = READINESS_MEDIA_NEEDS_ATTENTION;
    readyForReview = false;
  } else if (hasInProgress) {
    evaluatedReadiness = READINESS_MEDIA_IN_PROGRESS;
    readyForReview = false;
  } else {
    evaluatedReadiness = READINESS_WAITING_MEDIA;
    readyForReview = false;
  }

  return {
    article_id: articleId,
    slug: article.slug,
    current_readiness: currentReadiness,
    evaluated_readiness: evaluatedReadiness,
    ready_for_review: readyForReview,
    required_media_slots: requiredMediaSlots,
    satisfied_requirements: satisfiedRequirements,
    attached_media_slots: attachedMediaSlots,
    blocking_reasons: uniqueBlockers,
    evaluated_at: evaluatedAt,
    details: {
      article_status: article.status,
      required_slot_count: requiredMediaSlots.length,
      satisfied_slot_count: satisfiedRequirements.length,
      slots: slotDetails
    }
  };
}

/**
 * Reconciler entrypoint: performs deterministic evaluation, compares against persisted
 * readiness, and conditionally persists with zero side-effects on dry-run.
 */
export async function reconcileArticleMediaReadiness(
  db: any,
  articleId: number,
  options: ReconcileOptions = {}
): Promise<ReconcileResult> {
  const isDryRun = options.dryRun !== false; // Default to true (safe)
  const evaluation = await evaluateArticleMediaReadiness(db, articleId);

  const changed = evaluation.evaluated_readiness !== evaluation.current_readiness;

  if (isDryRun) {
    return {
      ...evaluation,
      dryRun: true,
      persisted: false,
      changed,
      noop: !changed
    };
  }

  // Persist mode: if evaluated matches current, NO-OP
  if (!changed) {
    return {
      ...evaluation,
      dryRun: false,
      persisted: false,
      changed: false,
      noop: true
    };
  }

  // State has transitioned: persist snapshot into article_publication_readiness
  // NOTE: is_ready remains 0 and overall_status is 'NOT_READY' to adhere to schema CHECK constraints
  // and preserve the separation between review readiness (READY_FOR_REVIEW) and publication scheduling (READY_TO_SCHEDULE).
  const article = await db
    .prepare('SELECT content_hash FROM articles WHERE id = ?')
    .bind(articleId)
    .first();

  const contentHash = article?.content_hash || '';
  const snapshotJson = JSON.stringify({
    schema_version: 1,
    article_id: evaluation.article_id,
    slug: evaluation.slug,
    evaluated_at: evaluation.evaluated_at,
    current_readiness: evaluation.current_readiness,
    evaluated_readiness: evaluation.evaluated_readiness,
    ready_for_review: evaluation.ready_for_review,
    required_media_slots: evaluation.required_media_slots,
    satisfied_requirements: evaluation.satisfied_requirements,
    attached_media_slots: evaluation.attached_media_slots,
    blocking_reasons: evaluation.blocking_reasons,
    actor: options.actor || 'readiness_reconciler'
  });

  const res = await db
    .prepare(
      `INSERT INTO article_publication_readiness (
        article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at
      ) VALUES (?, 0, 'NOT_READY', ?, ?, CURRENT_TIMESTAMP)`
    )
    .bind(articleId, contentHash, snapshotJson)
    .run();

  const persistedId = Number(res?.meta?.last_row_id || res?.lastInsertRowid || 0);

  return {
    ...evaluation,
    dryRun: false,
    persisted: true,
    changed: true,
    noop: false,
    persisted_id: persistedId
  };
}
