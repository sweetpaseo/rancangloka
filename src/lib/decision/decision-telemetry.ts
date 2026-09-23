/**
 * RancangLoka — Durable Decision Telemetry Service
 * Milestone: JEV-4A/4B
 * 
 * Persists and queries structured DecisionObservation records.
 * 
 * Invariants:
 * - Telemetry failures MUST NEVER block or fail the authoritative pipeline.
 * - Both D1/SQLite persistence and memory ring-buffer are supported.
 * - Provider errors must remain observable and persistable.
 * - Zero secrets or auth headers stored.
 */

import {
  type DecisionObservation,
  type DecisionPoint,
  type DisagreementClassification
} from './decision-types.ts';

const memoryRingBuffer: DecisionObservation[] = [];
const MAX_MEMORY_OBSERVATIONS = 200;

export function getMemoryObservations(): DecisionObservation[] {
  return [...memoryRingBuffer];
}

export function clearMemoryObservations(): void {
  memoryRingBuffer.length = 0;
}

/**
 * Persists a decision observation to both memory buffer and D1 database (if available).
 * Fail-safe: Any database error is swallowed gracefully and logged to memory only.
 */
export async function recordDecisionObservation(
  db: any | null | undefined,
  observation: DecisionObservation
): Promise<void> {
  // 1. Always record to memory ring buffer
  memoryRingBuffer.unshift(observation);
  if (memoryRingBuffer.length > MAX_MEMORY_OBSERVATIONS) {
    memoryRingBuffer.length = MAX_MEMORY_OBSERVATIONS;
  }

  // 2. Persist to D1 if db handle provided
  if (!db || typeof db.prepare !== 'function') {
    return;
  }

  try {
    await db
      .prepare(`
        INSERT INTO decision_observations (
          observation_id,
          decision_point,
          subject_type,
          subject_id,
          run_id,
          authoritative_decision,
          authoritative_reasons_json,
          jev_decision,
          jev_probabilities_json,
          jev_confidence,
          provider,
          model,
          model_version,
          input_schema_version,
          prompt_version,
          input_hash,
          latency_ms,
          provider_status,
          provider_error_class,
          disagreement_classification,
          cost_routing_estimate_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        observation.observation_id,
        observation.decision_point,
        observation.subject_type,
        observation.subject_id,
        observation.run_id || null,
        observation.authoritative_decision,
        JSON.stringify(observation.authoritative_reasons || []),
        observation.jev_decision || null,
        observation.jev_probabilities ? JSON.stringify(observation.jev_probabilities) : null,
        observation.jev_confidence ?? null,
        observation.provider,
        observation.model,
        observation.model_version,
        observation.input_schema_version,
        observation.prompt_version,
        observation.input_hash,
        observation.latency_ms,
        observation.provider_status,
        observation.provider_error_class || null,
        observation.disagreement_classification,
        observation.cost_routing_estimate ? JSON.stringify(observation.cost_routing_estimate) : null,
        observation.created_at
      )
      .run();
  } catch (err: any) {
    // Invariant: telemetry failure must not block execution
    console.warn(`[decision-telemetry] Failed to persist observation to D1: ${err?.message || String(err)}`);
  }
}

/**
 * Queries decision observations from D1 with fallback to memory buffer.
 */
export async function getDecisionObservations(
  db: any | null | undefined,
  filter: {
    decision_point?: DecisionPoint;
    decisionPoint?: DecisionPoint;
    subject_id?: string;
    subjectId?: string;
    run_id?: string;
    runId?: string;
    disagreement_classification?: DisagreementClassification;
    limit?: number;
  } = {}
): Promise<DecisionObservation[]> {
  const limit = Math.min(filter.limit || 50, 200);
  const decisionPoint = filter.decision_point || filter.decisionPoint;
  const subjectId = filter.subject_id || filter.subjectId;
  const runId = filter.run_id || filter.runId;
  const disagreement = filter.disagreement_classification;

  if (db && typeof db.prepare === 'function') {
    try {
      let sql = 'SELECT * FROM decision_observations WHERE 1=1';
      const params: any[] = [];

      if (decisionPoint) {
        sql += ' AND decision_point = ?';
        params.push(decisionPoint);
      }
      if (subjectId) {
        sql += ' AND subject_id = ?';
        params.push(subjectId);
      }
      if (runId) {
        sql += ' AND run_id = ?';
        params.push(runId);
      }
      if (disagreement) {
        sql += ' AND disagreement_classification = ?';
        params.push(disagreement);
      }

      sql += ` ORDER BY created_at DESC LIMIT ${limit}`;

      const rows = await db.prepare(sql).bind(...params).all();
      const results = rows?.results || rows || [];

      if (Array.isArray(results) && results.length > 0) {
        return results.map((r: any) => ({
          observation_id: r.observation_id,
          decision_point: r.decision_point as DecisionPoint,
          subject_type: r.subject_type,
          subject_id: r.subject_id,
          run_id: r.run_id || null,
          authoritative_decision: r.authoritative_decision,
          authoritative_reasons: r.authoritative_reasons_json ? JSON.parse(r.authoritative_reasons_json) : [],
          jev_decision: r.jev_decision || null,
          jev_probabilities: r.jev_probabilities_json ? JSON.parse(r.jev_probabilities_json) : null,
          jev_confidence: r.jev_confidence,
          provider: r.provider,
          model: r.model,
          model_version: r.model_version,
          input_schema_version: r.input_schema_version,
          prompt_version: r.prompt_version,
          input_hash: r.input_hash,
          latency_ms: r.latency_ms,
          provider_status: r.provider_status,
          provider_error_class: r.provider_error_class || null,
          disagreement_classification: r.disagreement_classification as DisagreementClassification,
          cost_routing_estimate: r.cost_routing_estimate_json ? JSON.parse(r.cost_routing_estimate_json) : null,
          created_at: r.created_at
        }));
      }
    } catch {
      // Fallback to memory
    }
  }

  // Memory buffer fallback
  return memoryRingBuffer
    .filter(o => {
      if (decisionPoint && o.decision_point !== decisionPoint) return false;
      if (subjectId && o.subject_id !== subjectId) return false;
      if (runId && o.run_id !== runId) return false;
      if (disagreement && o.disagreement_classification !== disagreement) return false;
      return true;
    })
    .slice(0, limit);
}

/**
 * Lookup a specific decision observation by ID.
 */
export async function getDecisionObservationById(
  db: any | null | undefined,
  observationId: string
): Promise<DecisionObservation | null> {
  if (db && typeof db.prepare === 'function') {
    try {
      const row = await db
        .prepare('SELECT * FROM decision_observations WHERE observation_id = ? LIMIT 1')
        .bind(observationId)
        .first();

      if (row) {
        return {
          observation_id: row.observation_id,
          decision_point: row.decision_point as DecisionPoint,
          subject_type: row.subject_type,
          subject_id: row.subject_id,
          run_id: row.run_id || null,
          authoritative_decision: row.authoritative_decision,
          authoritative_reasons: row.authoritative_reasons_json ? JSON.parse(row.authoritative_reasons_json) : [],
          jev_decision: row.jev_decision || null,
          jev_probabilities: row.jev_probabilities_json ? JSON.parse(row.jev_probabilities_json) : null,
          jev_confidence: row.jev_confidence,
          provider: row.provider,
          model: row.model,
          model_version: row.model_version,
          input_schema_version: row.input_schema_version,
          prompt_version: row.prompt_version,
          input_hash: row.input_hash,
          latency_ms: row.latency_ms,
          provider_status: row.provider_status,
          provider_error_class: row.provider_error_class || null,
          disagreement_classification: row.disagreement_classification as DisagreementClassification,
          cost_routing_estimate: row.cost_routing_estimate_json ? JSON.parse(row.cost_routing_estimate_json) : null,
          created_at: row.created_at
        };
      }
    } catch {
      // Fallback to memory
    }
  }

  const memoryMatch = memoryRingBuffer.find(o => o.observation_id === observationId);
  return memoryMatch || null;
}
