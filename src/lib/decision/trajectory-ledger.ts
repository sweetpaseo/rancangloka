/**
 * RancangLoka — Editorial Trajectory & Evidence Ledger Service
 * Milestone: JEV-7K / JEV-7L
 *
 * Implements the append-only evidence architecture for:
 * 1. Immutable Canonical State Snapshots (article_state_snapshots)
 * 2. Article State Transitions (article_state_transitions)
 * 3. Independent Decision Outcomes (decision_outcomes)
 *
 * Invariants:
 * - ZERO PUBLICATION AUTHORITY: Ledger is purely observative/telemetric.
 * - STRICT IMMUTABILITY: Historical snapshots and transitions are strictly append-only.
 * - MINIMAL STATE PRINCIPLE: Banned raw prose text/markdown bodies; stores only hashes,
 *   primitive flags, and scalar diff counts.
 * - STABLE MUTATION IDEMPOTENCY: Banned minute-bucket dedupe; uses deterministic mutation_operation_id.
 * - ZERO HALLUCINATED LINEAGE: Provenance must form a continuous chain; gap mutations marked UNKNOWN/MULTI_FACTOR.
 */

import {
  buildCanonicalPublicationPreflightState,
  computeCanonicalPreflightHash,
  type CanonicalPublicationPreflightInput,
  type PublicationPreflightCanonicalState
} from './publication-preflight-state.ts';
import { DECISION_SCHEMA_VERSION } from './decision-types.ts';

// ============================================================
// 1. TRANSITION & OUTCOME TAXONOMY
// ============================================================

export type TransitionType =
  | 'MEDIA_ADDED'
  | 'MEDIA_REMOVED'
  | 'MEDIA_REPLACED'
  | 'CONTENT_CHANGED'
  | 'MANUAL_HOLD_CHANGED'
  | 'READINESS_CHANGED'
  | 'MULTI_FACTOR_CHANGE'
  | 'UNKNOWN_CHANGE';

export type OutcomeType =
  | 'human_approved'
  | 'human_approval_revoked'
  | 'publication_succeeded'
  | 'publication_failed'
  | 'publication_cancelled';

export type OutcomeClass =
  | 'HUMAN_EDITORIAL'
  | 'PUBLICATION'
  | 'POST_PUBLICATION'
  | 'INFRASTRUCTURE';

export type FailureClass =
  | 'EDITORIAL_FAILURE'
  | 'POLICY_FAILURE'
  | 'INFRASTRUCTURE_FAILURE'
  | 'PROVIDER_FAILURE'
  | 'UNKNOWN_FAILURE';

export interface LightweightDiffMetrics {
  byte_delta: number;
  word_count_delta: number;
  heading_count_delta: number;
  reference_count_delta: number;
}

export interface CanonicalStateSnapshotRecord {
  snapshot_id: string;
  article_id: number;
  input_hash: string;
  content_hash: string;
  slug: string;
  featured_asset_id: string | null;
  hero_image_present: number;
  references_present: number;
  persisted_readiness_status: string | null;
  planner_eligibility_status: string;
  editorial_validation_passed: number;
  manual_hold: number;
  reading_time_minutes: number;
  is_sponsored: number;
  input_schema_version: string;
  captured_at: string;
  capture_source: string;
}

export interface ArticleStateTransitionRecord {
  transition_id: string;
  article_id: number;
  from_snapshot_id: string | null;
  to_snapshot_id: string;
  from_input_hash: string | null;
  to_input_hash: string;
  from_observation_id?: string | null;
  to_observation_id?: string | null;
  transition_type: TransitionType;
  transition_source: string;
  mutation_operation_id: string;
  occurred_at: string;
  recorded_at: string;
  actor_type: string;
  actor_id?: string | null;
  evidence_reference?: string | null;
  metadata_json?: string | null;
}

export interface DecisionOutcomeRecord {
  outcome_id: string;
  article_id: number;
  decision_observation_id?: string | null;
  snapshot_id?: string | null;
  input_hash: string;
  outcome_type: OutcomeType;
  outcome_class: OutcomeClass;
  outcome_source: string;
  source_record_id: string;
  idempotency_key: string;
  occurred_at: string;
  recorded_at: string;
  actor_type: string;
  actor_id?: string | null;
  evidence_reference: string;
  metadata_json?: string | null;
}

// ============================================================
// 2. DETERMINISTIC DERIVATION SERVICES
// ============================================================

/**
 * Computes scalar lightweight diff metrics between two markdown/text strings.
 * Preserves privacy: strictly returns scalar integer counts without storing text.
 */
export function computeLightweightDiffMetrics(
  beforeText?: string | null,
  afterText?: string | null
): LightweightDiffMetrics | null {
  if (beforeText === undefined || beforeText === null || afterText === undefined || afterText === null) {
    return null;
  }

  const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
  const countHeadings = (t: string) => (t.match(/^#{1,6}\s+/gm) || []).length;
  const countRefs = (t: string) => (t.match(/(\[\^.+?\]|https?:\/\/[^\s)]+)/g) || []).length;

  const byteBefore = new TextEncoder().encode(beforeText).length;
  const byteAfter = new TextEncoder().encode(afterText).length;

  return {
    byte_delta: byteAfter - byteBefore,
    word_count_delta: countWords(afterText) - countWords(beforeText),
    heading_count_delta: countHeadings(afterText) - countHeadings(beforeText),
    reference_count_delta: countRefs(afterText) - countRefs(beforeText)
  };
}

export type CanonicalStateComparisonSubject =
  | PublicationPreflightCanonicalState
  | CanonicalStateSnapshotRecord
  | (PublicationPreflightCanonicalState & {
      featuredAssetId?: string | null;
      featured_asset_id?: string | null;
      contentHash?: string | null;
      content_hash?: string | null;
      manualHold?: number | boolean | null;
      manual_hold?: number | boolean | null;
    })
  | (CanonicalPublicationPreflightInput & {
      heroImagePresent?: boolean;
      hero_image_present?: number | boolean;
    });

/**
 * Deterministically derives the transition type between two canonical preflight states.
 * Enforces hardened transition taxonomy:
 * - null -> asset  => MEDIA_ADDED
 * - asset -> null  => MEDIA_REMOVED
 * - assetA -> assetB => MEDIA_REPLACED
 */
export function deriveTransitionType(
  before: CanonicalStateComparisonSubject | null,
  after: CanonicalStateComparisonSubject
): TransitionType | null {
  if (!before) {
    return 'UNKNOWN_CHANGE';
  }

  const getAsset = (s: any) =>
    s.featured_asset_id !== undefined ? s.featured_asset_id : (s.featuredAssetId !== undefined ? s.featuredAssetId : null);
  const getHeroPresent = (s: any) =>
    Boolean(s.hero_image_present !== undefined ? s.hero_image_present : (s.heroImagePresent !== undefined ? s.heroImagePresent : (s.featuredAssetId || s.featured_asset_id)));
  const getContentHash = (s: any) =>
    s.content_hash !== undefined ? s.content_hash : s.contentHash;
  const getManualHold = (s: any) =>
    Number(s.manual_hold !== undefined ? s.manual_hold : (s.manualHold !== undefined ? (s.manualHold ? 1 : 0) : 0));
  const getPersistedReadiness = (s: any) =>
    s.persisted_readiness_status !== undefined ? s.persisted_readiness_status : s.persistedReadinessStatus;
  const getPlannerEligibility = (s: any) =>
    s.planner_eligibility_status !== undefined ? s.planner_eligibility_status : s.plannerEligibilityStatus;

  const beforeHero = getHeroPresent(before);
  const afterHero = getHeroPresent(after);
  const beforeAsset = getAsset(before);
  const afterAsset = getAsset(after);

  let mediaDelta: 'ADDED' | 'REMOVED' | 'REPLACED' | 'NONE' = 'NONE';
  if (!beforeHero && afterHero) {
    mediaDelta = 'ADDED';
  } else if (beforeHero && !afterHero) {
    mediaDelta = 'REMOVED';
  } else if (beforeHero && afterHero && beforeAsset && afterAsset && beforeAsset !== afterAsset) {
    mediaDelta = 'REPLACED';
  }

  const beforeContent = getContentHash(before);
  const afterContent = getContentHash(after);
  const contentChanged = Boolean(
    beforeContent !== undefined &&
    afterContent !== undefined &&
    beforeContent !== afterContent
  );

  const beforeHold = getManualHold(before);
  const afterHold = getManualHold(after);
  const manualHoldChanged = Boolean(
    ((before as any).manual_hold !== undefined || (before as any).manualHold !== undefined) &&
    ((after as any).manual_hold !== undefined || (after as any).manualHold !== undefined) &&
    beforeHold !== afterHold
  );

  const beforeReadiness = getPersistedReadiness(before);
  const afterReadiness = getPersistedReadiness(after);
  const beforeEligibility = getPlannerEligibility(before);
  const afterEligibility = getPlannerEligibility(after);
  const readinessChanged = Boolean(
    (beforeReadiness !== undefined && afterReadiness !== undefined && beforeReadiness !== afterReadiness) ||
    (beforeEligibility !== undefined && afterEligibility !== undefined && beforeEligibility !== afterEligibility)
  );

  let dimensionCount = 0;
  if (mediaDelta !== 'NONE') dimensionCount++;
  if (contentChanged) dimensionCount++;
  if (manualHoldChanged) dimensionCount++;
  if (readinessChanged) dimensionCount++;

  if (dimensionCount === 0) {
    return null; // Identical state: no transition occurred
  }

  if (dimensionCount > 1) {
    return 'MULTI_FACTOR_CHANGE';
  }

  if (mediaDelta === 'ADDED') return 'MEDIA_ADDED';
  if (mediaDelta === 'REMOVED') return 'MEDIA_REMOVED';
  if (mediaDelta === 'REPLACED') return 'MEDIA_REPLACED';
  if (contentChanged) return 'CONTENT_CHANGED';
  if (manualHoldChanged) return 'MANUAL_HOLD_CHANGED';
  if (readinessChanged) return 'READINESS_CHANGED';

  return 'UNKNOWN_CHANGE';
}

/**
 * Checks whether a failure class is eligible as decision-quality evidence of under-conservatism.
 * Strictly excludes INFRASTRUCTURE, PROVIDER, and UNKNOWN failures.
 */
export function isDecisionQualityFailure(failureClass: FailureClass): boolean {
  return failureClass === 'EDITORIAL_FAILURE' || failureClass === 'POLICY_FAILURE';
}

// ============================================================
// 3. IDEMPOTENCY KEY BUILDERS
// ============================================================

/**
 * Generates a stable mutation operation identity for state transitions.
 * BANNED: occurred_at_minute. Uses operation kind and logical seed.
 */
export function generateMutationOperationId(
  operationKind: string,
  articleId: number,
  fromHash: string | null,
  toHash: string,
  clientOpId?: string
): string {
  if (clientOpId && clientOpId.trim()) {
    return `mop_${clientOpId.trim()}`;
  }
  const cleanFrom = fromHash ? fromHash.replace(/^h_/, '') : 'init';
  const cleanTo = toHash.replace(/^h_/, '');
  return `mop_${operationKind}_a${articleId}_${cleanFrom}_to_${cleanTo}`;
}

/**
 * Generates an idempotent deduplication key for independent outcomes.
 */
export function generateOutcomeIdempotencyKey(
  articleId: number,
  inputHash: string,
  outcomeType: OutcomeType,
  evidenceReference: string
): string {
  const cleanHash = inputHash.replace(/^h_/, '');
  const cleanRef = evidenceReference.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `idem_doc_a${articleId}_${cleanHash}_${outcomeType}_${cleanRef}`;
}

// ============================================================
// 4. PREPARED STATEMENTS BUILDERS (SQLITE / D1 COMPATIBLE)
// ============================================================

/**
 * Prepares the SQL statement to insert/dedupe an immutable canonical state snapshot.
 */
export function prepareCaptureSnapshotStatement(
  db: any,
  state: PublicationPreflightCanonicalState,
  contentHash: string,
  featuredAssetId: string | null,
  captureSource: string,
  occurredAt?: string
): any {
  const inputHash = computeCanonicalPreflightHash(state);
  const snapshotId = `snp_${inputHash}_${state.articleId}`;
  const now = occurredAt || new Date().toISOString();

  const query = `
    INSERT OR IGNORE INTO article_state_snapshots (
      snapshot_id, article_id, input_hash, content_hash, slug,
      featured_asset_id, hero_image_present, references_present,
      persisted_readiness_status, planner_eligibility_status,
      editorial_validation_passed, manual_hold, reading_time_minutes,
      is_sponsored, input_schema_version, captured_at, capture_source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;

  return db.prepare(query).bind(
    snapshotId,
    state.articleId,
    inputHash,
    contentHash,
    state.slug,
    featuredAssetId,
    state.heroImagePresent ? 1 : 0,
    state.referencesPresent ? 1 : 0,
    state.persistedReadinessStatus,
    state.plannerEligibilityStatus,
    state.editorialValidationPassed ? 1 : 0,
    (state as any).manualHold ? 1 : 0,
    state.readingTimeMinutes,
    state.isSponsored ? 1 : 0,
    DECISION_SCHEMA_VERSION,
    now,
    captureSource
  );
}

/**
 * Prepares the SQL statement to insert an append-only article state transition.
 */
export function prepareRecordTransitionStatement(
  db: any,
  transition: ArticleStateTransitionRecord
): any {
  const query = `
    INSERT OR IGNORE INTO article_state_transitions (
      transition_id, article_id, from_snapshot_id, to_snapshot_id,
      from_input_hash, to_input_hash, from_observation_id, to_observation_id,
      transition_type, transition_source, mutation_operation_id,
      occurred_at, recorded_at, actor_type, actor_id, evidence_reference, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;

  return db.prepare(query).bind(
    transition.transition_id,
    transition.article_id,
    transition.from_snapshot_id,
    transition.to_snapshot_id,
    transition.from_input_hash,
    transition.to_input_hash,
    transition.from_observation_id || null,
    transition.to_observation_id || null,
    transition.transition_type,
    transition.transition_source,
    transition.mutation_operation_id,
    transition.occurred_at,
    transition.recorded_at,
    transition.actor_type,
    transition.actor_id || null,
    transition.evidence_reference || null,
    transition.metadata_json || null
  );
}

/**
 * Prepares the SQL statement to insert an append-only decision outcome.
 */
export function prepareRecordOutcomeStatement(
  db: any,
  outcome: DecisionOutcomeRecord
): any {
  const query = `
    INSERT OR IGNORE INTO decision_outcomes (
      outcome_id, article_id, decision_observation_id, snapshot_id,
      input_hash, outcome_type, outcome_class, outcome_source,
      source_record_id, idempotency_key, occurred_at, recorded_at,
      actor_type, actor_id, evidence_reference, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;

  return db.prepare(query).bind(
    outcome.outcome_id,
    outcome.article_id,
    outcome.decision_observation_id || null,
    outcome.snapshot_id || null,
    outcome.input_hash,
    outcome.outcome_type,
    outcome.outcome_class,
    outcome.outcome_source,
    outcome.source_record_id,
    outcome.idempotency_key,
    outcome.occurred_at,
    outcome.recorded_at,
    outcome.actor_type,
    outcome.actor_id || null,
    outcome.evidence_reference,
    outcome.metadata_json || null
  );
}

// ============================================================
// 5. TRANSACTIONAL COMPOSER FOR CAPTURE POINTS
// ============================================================

export interface CaptureTransitionParams {
  articleId: number;
  beforeInput: CanonicalPublicationPreflightInput | null;
  afterInput: CanonicalPublicationPreflightInput;
  captureSource: string;
  mutationOperationId: string;
  actorType: 'human_editor' | 'pipeline_daemon' | 'admin_operator';
  actorId?: string | null;
  evidenceReference?: string | null;
  metadata?: Record<string, any>;
  occurredAt?: string;
}

/**
 * High-level service method to compute canonical states and prepare atomic D1 statements
 * for snapshot capture + state transition.
 * 
 * Enforces NOOP rule: if beforeInput and afterInput produce identical hashes,
 * returns only the snapshot statement (or empty array) without creating a fake transition.
 */
export function prepareStateMutationCapture(
  db: any,
  params: CaptureTransitionParams
): {
  statements: any[];
  transitionCreated: boolean;
  toInputHash: string;
  fromInputHash: string | null;
  transitionType: TransitionType | null;
} {
  const statements: any[] = [];
  const afterState = buildCanonicalPublicationPreflightState(params.afterInput);
  const toHash = computeCanonicalPreflightHash(afterState);
  const toSnapshotId = `snp_${toHash}_${params.articleId}`;

  // 1. Prepare target snapshot statement (deduped via UNIQUE constraint)
  statements.push(
    prepareCaptureSnapshotStatement(
      db,
      afterState,
      params.afterInput.contentHash || 'empty',
      params.afterInput.featuredAssetId || null,
      params.captureSource,
      params.occurredAt
    )
  );

  let fromHash: string | null = null;
  let fromSnapshotId: string | null = null;
  let beforeState: PublicationPreflightCanonicalState | null = null;

  if (params.beforeInput) {
    beforeState = buildCanonicalPublicationPreflightState(params.beforeInput);
    fromHash = computeCanonicalPreflightHash(beforeState);
    fromSnapshotId = `snp_${fromHash}_${params.articleId}`;
  }

  // 2. Initial state check: a newly created article has no previous snapshot; capture snapshot only, NO fake transition
  if (!params.beforeInput) {
    return {
      statements,
      transitionCreated: false,
      toInputHash: toHash,
      fromInputHash: null,
      transitionType: null
    };
  }

  // 3. Derive transition type & Check for NOOP
  const transitionType = deriveTransitionType(params.beforeInput, params.afterInput);
  if (transitionType === null) {
    return {
      statements,
      transitionCreated: false,
      toInputHash: toHash,
      fromInputHash: fromHash,
      transitionType: null
    };
  }
  const now = params.occurredAt || new Date().toISOString();
  const transitionId = `ast_${params.articleId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const transitionRecord: ArticleStateTransitionRecord = {
    transition_id: transitionId,
    article_id: params.articleId,
    from_snapshot_id: fromSnapshotId,
    to_snapshot_id: toSnapshotId,
    from_input_hash: fromHash,
    to_input_hash: toHash,
    transition_type: transitionType,
    transition_source: params.captureSource,
    mutation_operation_id: params.mutationOperationId,
    occurred_at: now,
    recorded_at: now,
    actor_type: params.actorType,
    actor_id: params.actorId || null,
    evidence_reference: params.evidenceReference || null,
    metadata_json: params.metadata ? JSON.stringify(params.metadata) : null
  };

  statements.push(prepareRecordTransitionStatement(db, transitionRecord));

  return {
    statements,
    transitionCreated: true,
    toInputHash: toHash,
    fromInputHash: fromHash,
    transitionType
  };
}

/**
 * Prepares statement for recording a downstream authoritative outcome.
 */
export function prepareOutcomeCapture(
  db: any,
  params: {
    articleId: number;
    inputHash: string;
    outcomeType: OutcomeType;
    outcomeClass: OutcomeClass;
    outcomeSource: string;
    sourceRecordId: string;
    evidenceReference: string;
    actorType: 'human_editor' | 'system_publisher' | 'admin_operator';
    actorId?: string | null;
    decisionObservationId?: string | null;
    failureClass?: FailureClass;
    metadata?: Record<string, any>;
    occurredAt?: string;
  }
): { statement: any; idempotencyKey: string; outcomeId: string } {
  const now = params.occurredAt || new Date().toISOString();
  const snapshotId = `snp_${params.inputHash}_${params.articleId}`;
  const outcomeId = `doc_${params.articleId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const idempotencyKey = generateOutcomeIdempotencyKey(
    params.articleId,
    params.inputHash,
    params.outcomeType,
    params.evidenceReference
  );

  const meta = {
    ...(params.metadata || {}),
    ...(params.failureClass ? { failure_class: params.failureClass } : {})
  };

  const outcomeRecord: DecisionOutcomeRecord = {
    outcome_id: outcomeId,
    article_id: params.articleId,
    decision_observation_id: params.decisionObservationId || null,
    snapshot_id: snapshotId,
    input_hash: params.inputHash,
    outcome_type: params.outcomeType,
    outcome_class: params.outcomeClass,
    outcome_source: params.outcomeSource,
    source_record_id: params.sourceRecordId,
    idempotency_key: idempotencyKey,
    occurred_at: now,
    recorded_at: now,
    actor_type: params.actorType,
    actor_id: params.actorId || null,
    evidence_reference: params.evidenceReference,
    metadata_json: Object.keys(meta).length > 0 ? JSON.stringify(meta) : null
  };

  return {
    statement: prepareRecordOutcomeStatement(db, outcomeRecord),
    idempotencyKey,
    outcomeId
  };
}

/**
 * Executes state mutation capture directly against D1 (useful when not batching with outer statements).
 */
export async function recordStateTransition(
  db: any,
  params: CaptureTransitionParams
): Promise<{
  transitionCreated: boolean;
  toInputHash: string;
  fromInputHash: string | null;
  transitionType: TransitionType | null;
}> {
  const capture = prepareStateMutationCapture(db, params);
  if (capture.statements.length > 0) {
    await db.batch(capture.statements);
  }
  return {
    transitionCreated: capture.transitionCreated,
    toInputHash: capture.toInputHash,
    fromInputHash: capture.fromInputHash,
    transitionType: capture.transitionType
  };
}

/**
 * Executes outcome recording directly against D1.
 */
export async function recordDecisionOutcome(
  db: any,
  params: Parameters<typeof prepareOutcomeCapture>[1]
): Promise<{ outcomeId: string; idempotencyKey: string }> {
  const { statement, outcomeId, idempotencyKey } = prepareOutcomeCapture(db, params);
  await statement.run();
  return { outcomeId, idempotencyKey };
}

/**
 * Persists an immutable canonical snapshot for an article state.
 */
export async function persistCanonicalSnapshot(
  db: any,
  state: PublicationPreflightCanonicalState,
  contentHash: string,
  featuredAssetId: string | null,
  captureSource: string,
  occurredAt?: string
): Promise<void> {
  const stmt = prepareCaptureSnapshotStatement(db, state, contentHash, featuredAssetId, captureSource, occurredAt);
  await stmt.run();
}

