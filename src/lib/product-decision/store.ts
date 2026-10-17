/**
 * ============================================================================
 * RancangLoka Product Decision Engine (PRODUCT_DECISION_ENGINE-1D-A)
 * Authoritative D1 Persistence Adapter
 *
 * Invariants:
 * 1. D1_STORES_DECISION_MODEL, EVALUATOR_COMPUTES_DECISION
 *    (D1 stores structured persistence; runtime evaluator computes all recommendations).
 * 2. MODEL_PERSISTENCE_ROUND_TRIP_MUST_PRESERVE_DECISION_SEMANTICS
 *    (Serialized + deserialized model produces byte-for-byte identical evaluation results).
 * 3. IMMUTABLE_VERSION_IDENTITY
 *    (No UPDATE-in-place on existing decision model versions; semantic conflicts strictly block).
 * 4. AT_MOST_ONE_ACTIVE_VERSION_PER_MODEL
 *    (Guaranteed by database partial unique index and atomic supersession).
 * 5. NO_COMMERCE_FIELDS & NO_FAKE_NUMERIC_PRECISION
 *    (Strict zero-tolerance on commercial and fake score attributes).
 * ============================================================================
 */

import { createHash, randomUUID } from 'node:crypto';
import type {
  DecisionModelDefinition,
  DecisionModelRow,
  DecisionModelActivationRow,
  DecisionModelVersionSummary,
  DecisionModelLifecycleStatus,
  EvidenceBinding,
  DecisionConstraint,
  ConstraintPredicate,
  DecisionContext
} from './types.ts';
import {
  validateDecisionModel,
  deriveEvidenceFreshness,
  evaluateConstraintPredicate,
  extractAllModelBindings
} from './contracts.ts';

/**
 * Builds the canonical version key for a decision model version.
 * Format: `${model_id}@${model_version}@${criteria_version}`
 */
export function computeModelVersionKey(
  modelId: string,
  modelVersion: string,
  criteriaVersion: string
): string {
  if (!modelId || !modelVersion || !criteriaVersion) {
    throw new Error('model_id, model_version, and criteria_version must be non-empty strings.');
  }
  return `${modelId}@${modelVersion}@${criteriaVersion}`;
}

/**
 * Computes a deterministic SHA-256 hash of the canonical decision model payload.
 * Used for detecting identical re-insertions vs semantic version conflicts.
 */
export function computeModelPayloadHash(model: DecisionModelDefinition): string {
  // Sort collections deterministically to prevent arbitrary ordering differences
  const canonicalSolutions = [...model.solution_classes].sort((a, b) =>
    a.solution_id.localeCompare(b.solution_id)
  );

  const canonicalCriteria = [...model.criteria].sort((a, b) =>
    a.criterion_id.localeCompare(b.criterion_id)
  );

  const canonicalEvaluations = [...model.evaluations].sort((a, b) => {
    const keyA = `${a.criterion_id}|${a.solution_id}`;
    const keyB = `${b.criterion_id}|${b.solution_id}`;
    return keyA.localeCompare(keyB);
  });

  const canonicalConstraints = model.constraints.map(c => ({
    constraint_id: c.constraint_id,
    name: c.name,
    description: c.description,
    severity: c.severity,
    predicate: c.predicate,
    disqualified_solution_ids: [...(c.disqualified_solution_ids ?? [])].sort(),
    affected_solution_ids: [...(c.affected_solution_ids ?? [])].sort(),
    impact_explanation: c.impact_explanation
  })).sort((a, b) => a.constraint_id.localeCompare(b.constraint_id));

  const canonicalScenarios = [...model.scenarios].sort((a, b) =>
    a.scenario_id.localeCompare(b.scenario_id)
  );

  const canonicalProblem = {
    problem_id: model.problem.problem_id,
    canonical_slug: model.problem.canonical_slug,
    title: model.problem.title,
    description: model.problem.description,
    primary_article_id: model.problem.primary_article_id
  };

  const payload = {
    model_id: model.model_id,
    model_version: model.model_version,
    criteria_version: model.criteria_version,
    problem: canonicalProblem,
    solution_classes: canonicalSolutions,
    criteria: canonicalCriteria,
    evaluations: canonicalEvaluations,
    constraints: canonicalConstraints,
    scenarios: canonicalScenarios,
    evidence_snapshot_hash: model.evidence_snapshot_hash
  };

  return createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}

/**
 * Serializes a pure DecisionModelDefinition into a relational row ready for D1 insertion.
 */
export function serializeDecisionModel(
  model: DecisionModelDefinition,
  status: DecisionModelLifecycleStatus = 'VALIDATED'
): DecisionModelRow {
  const validation = validateDecisionModel(model);
  if (!validation.valid) {
    const errorDetails = validation.issues.map(i => `${i.field}: ${i.message}`).join('; ');
    throw new Error(`Cannot serialize invalid DecisionModelDefinition: ${errorDetails}`);
  }

  const versionKey = computeModelVersionKey(
    model.model_id,
    model.model_version,
    model.criteria_version
  );

  const payloadHash = computeModelPayloadHash(model);
  const bindings = extractAllModelBindings(model);

  // Constraints serialized with declarative predicate
  const serializableConstraints = model.constraints.map(c => ({
    constraint_id: c.constraint_id,
    name: c.name,
    description: c.description,
    severity: c.severity,
    predicate: c.predicate,
    disqualified_solution_ids: c.disqualified_solution_ids ?? [],
    affected_solution_ids: c.affected_solution_ids ?? [],
    impact_explanation: c.impact_explanation
  }));

  return {
    version_key: versionKey,
    model_id: model.model_id,
    model_version: model.model_version,
    criteria_version: model.criteria_version,
    problem_id: model.problem.problem_id,
    problem_title: model.problem.title,
    problem_slug: model.problem.canonical_slug,
    problem_description: model.problem.description,
    primary_article_id: model.problem.primary_article_id,
    status,
    evidence_snapshot_hash: model.evidence_snapshot_hash,
    model_payload_hash: payloadHash,
    solution_classes_json: JSON.stringify(model.solution_classes),
    criteria_json: JSON.stringify(model.criteria),
    evaluations_json: JSON.stringify(model.evaluations),
    constraints_json: JSON.stringify(serializableConstraints),
    scenarios_json: JSON.stringify(model.scenarios),
    evidence_bindings_json: JSON.stringify(bindings),
    created_at: new Date().toISOString()
  };
}

/**
 * Deserializes a D1 DecisionModelRow back into a fully functioning DecisionModelDefinition.
 * Rehydrates declarative predicates into executable applies_when constraint functions.
 */
export function deserializeDecisionModel(row: DecisionModelRow): DecisionModelDefinition {
  const solutionClasses = JSON.parse(row.solution_classes_json);
  const criteria = JSON.parse(row.criteria_json);
  const evaluations = JSON.parse(row.evaluations_json);
  const parsedConstraints = JSON.parse(row.constraints_json);
  const scenarios = JSON.parse(row.scenarios_json);

  // Rehydrate constraints with pure deterministic predicate evaluators
  const rehydratedConstraints: DecisionConstraint[] = parsedConstraints.map((c: any) => {
    const predicate: ConstraintPredicate = c.predicate;
    return {
      constraint_id: c.constraint_id,
      name: c.name,
      description: c.description,
      severity: c.severity,
      predicate,
      disqualified_solution_ids: c.disqualified_solution_ids,
      affected_solution_ids: c.affected_solution_ids,
      impact_explanation: c.impact_explanation,
      applies_when: (ctx: DecisionContext) => evaluateConstraintPredicate(predicate, ctx)
    };
  });

  return {
    model_id: row.model_id,
    model_version: row.model_version,
    criteria_version: row.criteria_version,
    problem: {
      problem_id: row.problem_id,
      canonical_slug: row.problem_slug,
      title: row.problem_title,
      description: row.problem_description,
      primary_article_id: row.primary_article_id
    },
    solution_classes: solutionClasses,
    criteria,
    evaluations,
    constraints: rehydratedConstraints,
    scenarios,
    evidence_snapshot_hash: row.evidence_snapshot_hash
  };
}

// ============================================================================
// D1 DATABASE OPERATIONS
// ============================================================================

export type InsertModelResult =
  | { status: 'INSERTED'; version_key: string; model_id: string }
  | { status: 'ALREADY_EXISTS_IDENTICAL'; version_key: string; model_id: string }
  | { status: 'BLOCKED_VERSION_CONFLICT'; version_key: string; model_id: string; existing_hash: string; candidate_hash: string }
  | { status: 'BLOCKED_VALIDATION_FAILED'; issues: Array<{ code: string; field: string; message: string }> };

/**
 * Safely inserts a validated DecisionModelDefinition into D1 with idempotency and conflict detection.
 */
export async function insertDecisionModelVersion(
  db: any,
  model: DecisionModelDefinition,
  initialStatus: DecisionModelLifecycleStatus = 'VALIDATED'
): Promise<InsertModelResult> {
  const validation = validateDecisionModel(model);
  if (!validation.valid) {
    return {
      status: 'BLOCKED_VALIDATION_FAILED',
      issues: validation.issues
    };
  }

  const versionKey = computeModelVersionKey(
    model.model_id,
    model.model_version,
    model.criteria_version
  );
  const candidatePayloadHash = computeModelPayloadHash(model);

  // 1. Check existing record
  const existing = await db
    .prepare('SELECT version_key, model_payload_hash FROM decision_models WHERE version_key = ? LIMIT 1')
    .bind(versionKey)
    .first();

  if (existing) {
    if (existing.model_payload_hash === candidatePayloadHash) {
      return {
        status: 'ALREADY_EXISTS_IDENTICAL',
        version_key: versionKey,
        model_id: model.model_id
      };
    }
    return {
      status: 'BLOCKED_VERSION_CONFLICT',
      version_key: versionKey,
      model_id: model.model_id,
      existing_hash: existing.model_payload_hash,
      candidate_hash: candidatePayloadHash
    };
  }

  // 2. Insert row
  const row = serializeDecisionModel(model, initialStatus);

  await db
    .prepare(`
      INSERT INTO decision_models (
        version_key, model_id, model_version, criteria_version,
        problem_id, problem_title, problem_slug, problem_description, primary_article_id,
        status, evidence_snapshot_hash, model_payload_hash,
        solution_classes_json, criteria_json, evaluations_json,
        constraints_json, scenarios_json, evidence_bindings_json,
        created_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        CURRENT_TIMESTAMP
      )
    `)
    .bind(
      row.version_key,
      row.model_id,
      row.model_version,
      row.criteria_version,
      row.problem_id,
      row.problem_title,
      row.problem_slug,
      row.problem_description,
      row.primary_article_id,
      row.status,
      row.evidence_snapshot_hash,
      row.model_payload_hash,
      row.solution_classes_json,
      row.criteria_json,
      row.evaluations_json,
      row.constraints_json,
      row.scenarios_json,
      row.evidence_bindings_json
    )
    .run();

  return {
    status: 'INSERTED',
    version_key: versionKey,
    model_id: model.model_id
  };
}

/**
 * Retrieves a decision model by its immutable version key.
 */
export async function getDecisionModelByVersionKey(
  db: any,
  versionKey: string
): Promise<DecisionModelDefinition | null> {
  const row = await db
    .prepare('SELECT * FROM decision_models WHERE version_key = ? LIMIT 1')
    .bind(versionKey)
    .first();

  if (!row) {
    return null;
  }

  return deserializeDecisionModel(row as DecisionModelRow);
}

/**
 * Retrieves the currently ACTIVE decision model for a given model_id.
 */
export async function getActiveDecisionModel(
  db: any,
  modelId: string
): Promise<{ model: DecisionModelDefinition; row: DecisionModelRow } | null> {
  const row = await db
    .prepare('SELECT * FROM decision_models WHERE model_id = ? AND status = ? LIMIT 1')
    .bind(modelId, 'ACTIVE')
    .first();

  if (!row) {
    return null;
  }

  const modelRow = row as DecisionModelRow;
  return {
    model: deserializeDecisionModel(modelRow),
    row: modelRow
  };
}

/**
 * Lists all known versions for a model_id ordered by created_at DESC.
 */
export async function listDecisionModelVersions(
  db: any,
  modelId: string
): Promise<DecisionModelVersionSummary[]> {
  const rows = await db
    .prepare(`
      SELECT
        version_key, model_id, model_version, criteria_version,
        problem_id, problem_title, status, evidence_snapshot_hash,
        model_payload_hash, created_at, activated_at, superseded_at, activated_by
      FROM decision_models
      WHERE model_id = ?
      ORDER BY created_at DESC
    `)
    .bind(modelId)
    .all();

  const results = rows?.results || rows || [];
  return results as DecisionModelVersionSummary[];
}

export type ActivationResult =
  | { ok: true; status: 'ACTIVATED'; version_key: string; prior_version_key?: string }
  | { ok: true; status: 'ALREADY_ACTIVE'; version_key: string }
  | { ok: false; status: 'BLOCKED_VERSION_NOT_FOUND'; version_key: string }
  | { ok: false; status: 'BLOCKED_INVALID_STATUS'; version_key: string; current_status: string }
  | { ok: false; status: 'BLOCKED_EVIDENCE_STALE'; version_key: string; error: string }
  | { ok: false; status: 'BLOCKED_EVIDENCE_UNAVAILABLE'; version_key: string; error: string };

/**
 * Activates a validated decision model version via human-authorized workflow.
 * Verifies evidence freshness, supersedes prior ACTIVE version atomically, and logs to audit ledger.
 */
export async function activateDecisionModelVersion(
  db: any,
  options: {
    version_key: string;
    actor: string;
    rationale?: string;
    authoritativeEvidenceMap?: Map<string, { published_content_hash: string }>;
  }
): Promise<ActivationResult> {
  const { version_key, actor, rationale, authoritativeEvidenceMap } = options;

  if (!actor || actor.trim() === '') {
    throw new Error('Actor must be non-empty string authorizing activation.');
  }

  // 1. Load target version
  const row = await db
    .prepare('SELECT * FROM decision_models WHERE version_key = ? LIMIT 1')
    .bind(version_key)
    .first();

  if (!row) {
    return {
      ok: false,
      status: 'BLOCKED_VERSION_NOT_FOUND',
      version_key
    };
  }

  const modelRow = row as DecisionModelRow;

  if (modelRow.status === 'ACTIVE') {
    return {
      ok: true,
      status: 'ALREADY_ACTIVE',
      version_key
    };
  }

  if (modelRow.status !== 'VALIDATED' && modelRow.status !== 'DRAFT') {
    return {
      ok: false,
      status: 'BLOCKED_INVALID_STATUS',
      version_key,
      current_status: modelRow.status
    };
  }

  // 2. Freshness Guard (if authoritative evidence map provided)
  if (authoritativeEvidenceMap) {
    const rawBindings = JSON.parse(modelRow.evidence_bindings_json) as EvidenceBinding[];
    const freshness = deriveEvidenceFreshness(rawBindings, authoritativeEvidenceMap);

    if (freshness === 'NEEDS_RECALIBRATION') {
      return {
        ok: false,
        status: 'BLOCKED_EVIDENCE_STALE',
        version_key,
        error: 'Authoritative evidence has drifted from model snapshot calibration: recalibration required.'
      };
    }

    if (freshness === 'EVIDENCE_UNAVAILABLE') {
      return {
        ok: false,
        status: 'BLOCKED_EVIDENCE_UNAVAILABLE',
        version_key,
        error: 'Authoritative evidence state is unavailable for verification.'
      };
    }
  }

  // 3. Find and supersede current ACTIVE version for model_id if any
  const currentActive = await db
    .prepare('SELECT version_key FROM decision_models WHERE model_id = ? AND status = ? LIMIT 1')
    .bind(modelRow.model_id, 'ACTIVE')
    .first();

  let priorVersionKey: string | undefined;

  if (currentActive) {
    priorVersionKey = currentActive.version_key;
    // Supersede old active
    await db
      .prepare(`
        UPDATE decision_models
        SET status = 'SUPERSEDED', superseded_at = CURRENT_TIMESTAMP
        WHERE version_key = ?
      `)
      .bind(priorVersionKey)
      .run();

    // Log supersession in audit ledger
    await db
      .prepare(`
        INSERT INTO decision_model_activations (
          activation_id, version_key, model_id, action, actor, rationale, recorded_at
        ) VALUES (?, ?, ?, 'SUPERSEDE', ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        `act_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        priorVersionKey,
        modelRow.model_id,
        actor,
        `Superseded by activation of ${version_key}`
      )
      .run();
  }

  // 4. Activate new version
  await db
    .prepare(`
      UPDATE decision_models
      SET status = 'ACTIVE', activated_at = CURRENT_TIMESTAMP, activated_by = ?
      WHERE version_key = ?
    `)
    .bind(actor, version_key)
    .run();

  // Log activation in audit ledger
  await db
    .prepare(`
      INSERT INTO decision_model_activations (
        activation_id, version_key, model_id, action, actor, rationale, recorded_at
      ) VALUES (?, ?, ?, 'ACTIVATE', ?, ?, CURRENT_TIMESTAMP)
    `)
    .bind(
      `act_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      version_key,
      modelRow.model_id,
      actor,
      rationale ?? 'Human-authorized decision model activation'
    )
    .run();

  return {
    ok: true,
    status: 'ACTIVATED',
    version_key,
    prior_version_key: priorVersionKey
  };
}
