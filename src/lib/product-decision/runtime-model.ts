/**
 * ============================================================================
 * RancangLoka Product Decision Engine (PRODUCT_DECISION_ENGINE-1E)
 * Read-Only Production Model Resolution & D1 Bridge
 *
 * Invariants:
 * 1. NO_SILENT_PRODUCTION_FALLBACK
 *    Public production runtime must never silently fall back to static fixtures
 *    when D1 model is missing, stale, or corrupt.
 * 2. READ_ONLY_RUNTIME_BOUNDARY
 *    This module performs zero database mutations, zero activations, and zero I/O writes.
 * 3. CRYPTOGRAPHIC_INTEGRITY_VERIFICATION
 *    Every loaded active model must match its stored model_payload_hash and
 *    evidence_snapshot_hash prior to resolution.
 * 4. STALE_MODEL_MUST_NOT_PRODUCE_PUBLIC_RECOMMENDATION
 *    If authoritative evidence has drifted or is missing, resolution yields a
 *    typed failure preventing reader-facing evaluation.
 * ============================================================================
 */

import type {
  DecisionModelDefinition,
  DecisionModelRow,
  EvidenceBinding
} from './types.ts';
import {
  deserializeDecisionModel,
  computeModelPayloadHash
} from './store.ts';
import {
  deriveEvidenceFreshness,
  computeEvidenceSnapshotHash,
  extractAllModelBindings
} from './contracts.ts';

export interface ResolveModelOptions {
  /** Target model identifier (e.g. 'model_pde_kusen_tropis') */
  model_id: string;
  /** Optional map of version_key -> { published_content_hash } for freshness validation */
  authoritativeEvidenceMap?: Map<string, { published_content_hash: string }>;
  /** Runtime environment mode: 'production' | 'development' | 'test' (defaults to 'production') */
  mode?: 'production' | 'development' | 'test';
  /** Explicit opt-in for static fixture fallback. STRICTLY FORBIDDEN in 'production' mode */
  allowFallbackToStatic?: boolean;
  /** Static model reference provided exclusively when allowFallbackToStatic is true */
  staticFallbackModel?: DecisionModelDefinition;
}

export type ResolveModelResult =
  | {
      ok: true;
      status: 'RESOLVED';
      model: DecisionModelDefinition;
      source: 'D1_ACTIVE' | 'STATIC_FALLBACK';
      version_key: string;
      row?: DecisionModelRow;
    }
  | {
      ok: false;
      status: 'UNAVAILABLE_NO_ACTIVE_MODEL';
      model_id: string;
      error: string;
    }
  | {
      ok: false;
      status: 'UNAVAILABLE_INTEGRITY_MISMATCH';
      model_id: string;
      version_key: string;
      error: string;
      stored_hash: string;
      computed_hash: string;
    }
  | {
      ok: false;
      status: 'UNAVAILABLE_SNAPSHOT_MISMATCH';
      model_id: string;
      version_key: string;
      error: string;
    }
  | {
      ok: false;
      status: 'UNAVAILABLE_EVIDENCE_STALE';
      model_id: string;
      version_key: string;
      freshness: string;
      error: string;
    }
  | {
      ok: false;
      status: 'UNAVAILABLE_EVIDENCE_MISSING';
      model_id: string;
      version_key: string;
      freshness: string;
      error: string;
    }
  | {
      ok: false;
      status: 'UNAVAILABLE_DATABASE_ERROR';
      model_id: string;
      error: string;
    };

/**
 * Resolves the currently ACTIVE decision model from Cloudflare D1 with strict
 * integrity verification, evidence freshness checking, and anti-fallback enforcement.
 */
export async function resolveActiveDecisionModel(
  db: any,
  options: ResolveModelOptions
): Promise<ResolveModelResult> {
  const {
    model_id,
    authoritativeEvidenceMap,
    mode = 'production',
    allowFallbackToStatic = false,
    staticFallbackModel
  } = options;

  // Enforce NO_SILENT_PRODUCTION_FALLBACK
  if (mode === 'production' && allowFallbackToStatic) {
    throw new Error(
      'INVARIANT_VIOLATION: allowFallbackToStatic is strictly forbidden in production mode.'
    );
  }

  // 1. Attempt to query active model from D1
  let row: DecisionModelRow | null = null;
  try {
    if (db && typeof db.prepare === 'function') {
      const result = await db
        .prepare('SELECT * FROM decision_models WHERE model_id = ? AND status = ? LIMIT 1')
        .bind(model_id, 'ACTIVE')
        .first();
      row = (result as DecisionModelRow) || null;
    }
  } catch (err: any) {
    if (allowFallbackToStatic && staticFallbackModel) {
      return {
        ok: true,
        status: 'RESOLVED',
        model: staticFallbackModel,
        source: 'STATIC_FALLBACK',
        version_key: `${staticFallbackModel.model_id}@${staticFallbackModel.model_version}@${staticFallbackModel.criteria_version}`
      };
    }
    return {
      ok: false,
      status: 'UNAVAILABLE_DATABASE_ERROR',
      model_id,
      error: `Failed to query D1 database: ${err?.message || String(err)}`
    };
  }

  // 2. Handle missing active model in D1
  if (!row) {
    if (allowFallbackToStatic && staticFallbackModel) {
      return {
        ok: true,
        status: 'RESOLVED',
        model: staticFallbackModel,
        source: 'STATIC_FALLBACK',
        version_key: `${staticFallbackModel.model_id}@${staticFallbackModel.model_version}@${staticFallbackModel.criteria_version}`
      };
    }
    return {
      ok: false,
      status: 'UNAVAILABLE_NO_ACTIVE_MODEL',
      model_id,
      error: `No ACTIVE decision model found in production D1 for model_id: ${model_id}`
    };
  }

  // 3. Reconstruct model definition from raw D1 row
  const deserialized = deserializeDecisionModel(row);

  // 4. Verify Evidence Snapshot Hash against recomputed model evaluations
  const bindings = extractAllModelBindings(deserialized);
  const computedSnapshotHash = computeEvidenceSnapshotHash(bindings);
  if (computedSnapshotHash !== row.evidence_snapshot_hash) {
    return {
      ok: false,
      status: 'UNAVAILABLE_SNAPSHOT_MISMATCH',
      model_id,
      version_key: row.version_key,
      error: `Evidence snapshot hash mismatch: stored '${row.evidence_snapshot_hash}' != computed '${computedSnapshotHash}'`
    };
  }

  // 5. Verify Payload Hash Integrity
  const computedPayloadHash = computeModelPayloadHash(deserialized);
  if (computedPayloadHash !== row.model_payload_hash) {
    return {
      ok: false,
      status: 'UNAVAILABLE_INTEGRITY_MISMATCH',
      model_id,
      version_key: row.version_key,
      error: `Cryptographic payload hash mismatch: stored '${row.model_payload_hash}' != computed '${computedPayloadHash}'`,
      stored_hash: row.model_payload_hash,
      computed_hash: computedPayloadHash
    };
  }

  // 6. Verify Evidence Freshness (if authoritative map provided)
  if (authoritativeEvidenceMap) {
    let rawBindings: EvidenceBinding[] = [];
    try {
      rawBindings = JSON.parse(row.evidence_bindings_json) as EvidenceBinding[];
    } catch {
      rawBindings = [];
    }

    const freshness = deriveEvidenceFreshness(rawBindings, authoritativeEvidenceMap);
    if (freshness === 'NEEDS_RECALIBRATION') {
      return {
        ok: false,
        status: 'UNAVAILABLE_EVIDENCE_STALE',
        model_id,
        version_key: row.version_key,
        freshness,
        error: 'Authoritative evidence has drifted from model snapshot calibration: recalibration required.'
      };
    }

    if (freshness === 'EVIDENCE_UNAVAILABLE') {
      return {
        ok: false,
        status: 'UNAVAILABLE_EVIDENCE_MISSING',
        model_id,
        version_key: row.version_key,
        freshness,
        error: 'Authoritative evidence state is unavailable for verification.'
      };
    }
  }

  // 7. Successful resolution
  return {
    ok: true,
    status: 'RESOLVED',
    model: deserialized,
    source: 'D1_ACTIVE',
    version_key: row.version_key,
    row
  };
}
