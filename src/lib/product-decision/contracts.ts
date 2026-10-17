/**
 * ============================================================================
 * RancangLoka Product Decision Engine (PRODUCT_DECISION_ENGINE-1A)
 * Pure Contract Validation & Provenance Helpers
 * ============================================================================
 */

import { createHash } from 'node:crypto';
import type {
  DecisionModelDefinition,
  DecisionContext,
  EvidenceBinding,
  EvidenceFreshnessState,
  FitTaxonomy,
  ConstraintPredicate,
  ConstraintRule
} from './types.ts';
import { FIT_TAXONOMY_VALUES } from './types.ts';

/**
 * List of strictly forbidden commercial and fake-precision field names.
 * Permanent invariant: NO_COMMERCE_FIELDS and NO_FAKE_NUMERIC_PRECISION.
 */
export const FORBIDDEN_CONTRACT_FIELDS = Object.freeze([
  'affiliate_url',
  'affiliate_link',
  'affiliate_id',
  'affiliate_priority',
  'commission',
  'commission_rate',
  'merchant',
  'merchant_id',
  'merchant_rank',
  'payout',
  'offer_price',
  'sponsored_rank',
  'sponsored_tier',
  'winner_score',
  'star_rating',
  'score_numeric',
  'overall_score',
  'rating_10'
]);

export interface ValidationIssue {
  code: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Scans an arbitrary JavaScript object recursively to detect any forbidden commerce
 * or fake-precision field names.
 */
export function scanForForbiddenFields(obj: unknown, path = ''): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!obj || typeof obj !== 'object') {
    return issues;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      issues.push(...scanForForbiddenFields(item, `${path}[${index}]`));
    });
    return issues;
  }

  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const currentPath = path ? `${path}.${key}` : key;
    const lowerKey = key.toLowerCase();

    for (const forbidden of FORBIDDEN_CONTRACT_FIELDS) {
      if (lowerKey === forbidden || lowerKey.includes(forbidden)) {
        issues.push({
          code: 'FORBIDDEN_COMMERCE_FIELD',
          field: currentPath,
          message: `Field '${currentPath}' violates commercial/precision boundaries: matches forbidden pattern '${forbidden}'.`
        });
      }
    }

    issues.push(...scanForForbiddenFields(record[key], currentPath));
  }

  return issues;
}

/**
 * Computes a deterministic SHA-256 snapshot hash over a set of evidence bindings.
 * Guarantees order-independent, reproducible identity for model calibration.
 */
export function computeEvidenceSnapshotHash(bindings: EvidenceBinding[]): string {
  // 1. Normalize and deduplicate by canonical composite key
  const uniqueMap = new Map<string, {
    article_id: number;
    article_slug: string;
    publication_version_key: string;
    published_content_hash: string;
    claim_class: string;
    source_fidelity: string;
  }>();

  for (const b of bindings) {
    const compositeKey = `${b.article_id}|${b.publication_version_key}|${b.claim_class}|${b.published_content_hash}`;
    if (!uniqueMap.has(compositeKey)) {
      uniqueMap.set(compositeKey, {
        article_id: b.article_id,
        article_slug: b.article_slug,
        publication_version_key: b.publication_version_key,
        published_content_hash: b.published_content_hash,
        claim_class: b.claim_class,
        source_fidelity: b.source_fidelity
      });
    }
  }

  // 2. Sort deterministically
  const canonicalItems = Array.from(uniqueMap.values());
  canonicalItems.sort((a, b) => {
    const keyA = `${a.article_id}|${a.publication_version_key}|${a.claim_class}`;
    const keyB = `${b.article_id}|${b.publication_version_key}|${b.claim_class}`;
    return keyA.localeCompare(keyB);
  });

  // 3. Stable serialization
  const payload = JSON.stringify(canonicalItems);
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Derives evidence freshness dynamically by comparing expected evidence versions
 * with current authoritative publication state (e.g. from D1 / Publication DNA).
 * Note: Never store a mutable boolean inside the static decision model.
 */
export function deriveEvidenceFreshness(
  expectedBindings: EvidenceBinding[],
  authoritativeMap: Map<string, { published_content_hash: string }>
): EvidenceFreshnessState {
  if (expectedBindings.length === 0) {
    return 'CURRENT';
  }

  for (const expected of expectedBindings) {
    const active = authoritativeMap.get(expected.publication_version_key);
    if (!active) {
      return 'EVIDENCE_UNAVAILABLE';
    }

    if (active.published_content_hash !== expected.published_content_hash) {
      return 'NEEDS_RECALIBRATION';
    }
  }

  return 'CURRENT';
}

/**
 * Validates a DecisionContext instance for presence of the 6 mandatory CORE dimensions.
 */
export function validateDecisionContext(context: DecisionContext): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!context.problem_goal || typeof context.problem_goal !== 'string' || context.problem_goal.trim() === '') {
    issues.push({ code: 'MISSING_CORE_DIMENSION', field: 'problem_goal', message: 'Core dimension problem_goal is required.' });
  }
  if (!context.building_context) {
    issues.push({ code: 'MISSING_CORE_DIMENSION', field: 'building_context', message: 'Core dimension building_context is required.' });
  }
  if (!context.climate_exposure) {
    issues.push({ code: 'MISSING_CORE_DIMENSION', field: 'climate_exposure', message: 'Core dimension climate_exposure is required.' });
  }
  if (!context.application_location) {
    issues.push({ code: 'MISSING_CORE_DIMENSION', field: 'application_location', message: 'Core dimension application_location is required.' });
  }
  if (!context.budget_class) {
    issues.push({ code: 'MISSING_CORE_DIMENSION', field: 'budget_class', message: 'Core dimension budget_class is required.' });
  }
  if (!context.maintenance_tolerance) {
    issues.push({ code: 'MISSING_CORE_DIMENSION', field: 'maintenance_tolerance', message: 'Core dimension maintenance_tolerance is required.' });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validates full structural and referential integrity of a DecisionModelDefinition.
 */
export function validateDecisionModel(model: DecisionModelDefinition): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Scan for forbidden commercial / fake precision fields
  issues.push(...scanForForbiddenFields(model));

  // 2. Model Header checks
  if (!model.model_id || !model.model_version || !model.criteria_version) {
    issues.push({
      code: 'INVALID_MODEL_METADATA',
      field: 'model_id',
      message: 'model_id, model_version, and criteria_version are required non-empty strings.'
    });
  }

  // 3. Duplicate Solution Class IDs
  const solutionIds = new Set<string>();
  for (const sol of model.solution_classes) {
    if (solutionIds.has(sol.solution_id)) {
      issues.push({
        code: 'DUPLICATE_SOLUTION_ID',
        field: `solution_classes.${sol.solution_id}`,
        message: `Duplicate solution_id detected: '${sol.solution_id}'.`
      });
    }
    solutionIds.add(sol.solution_id);
  }

  // 4. Duplicate Criteria IDs
  const criteriaIds = new Set<string>();
  for (const crit of model.criteria) {
    if (criteriaIds.has(crit.criterion_id)) {
      issues.push({
        code: 'DUPLICATE_CRITERION_ID',
        field: `criteria.${crit.criterion_id}`,
        message: `Duplicate criterion_id detected: '${crit.criterion_id}'.`
      });
    }
    criteriaIds.add(crit.criterion_id);
  }

  // 5. Referential integrity in Evaluations
  for (const ev of model.evaluations) {
    if (!solutionIds.has(ev.solution_id)) {
      issues.push({
        code: 'UNKNOWN_SOLUTION_REFERENCE',
        field: `evaluations.${ev.criterion_id}.${ev.solution_id}`,
        message: `Evaluation references non-existent solution_id '${ev.solution_id}'.`
      });
    }
    if (!criteriaIds.has(ev.criterion_id)) {
      issues.push({
        code: 'UNKNOWN_CRITERION_REFERENCE',
        field: `evaluations.${ev.criterion_id}`,
        message: `Evaluation references non-existent criterion_id '${ev.criterion_id}'.`
      });
    }
    if (ev.evidence_binding) {
      if (ev.evidence_binding.evidence_summary.length > 200) {
        issues.push({
          code: 'EVIDENCE_SUMMARY_TOO_LONG',
          field: `evaluations.${ev.criterion_id}.evidence_summary`,
          message: `Evidence summary exceeds maximum length of 200 characters (${ev.evidence_binding.evidence_summary.length} chars).`
        });
      }
    }
  }

  // 6. Referential integrity in Tradeoffs
  for (const sol of model.solution_classes) {
    for (const tr of sol.tradeoffs) {
      if (tr.solution_id !== sol.solution_id) {
        issues.push({
          code: 'TRADEOFF_SOLUTION_MISMATCH',
          field: `solution_classes.${sol.solution_id}.tradeoffs.${tr.tradeoff_id}`,
          message: `Tradeoff '${tr.tradeoff_id}' specifies solution_id '${tr.solution_id}' but is nested under '${sol.solution_id}'.`
        });
      }
    }
  }

  // 7. Scenario integrity & Fit Taxonomy check
  const scenarioIds = new Set<string>();
  for (const sc of model.scenarios) {
    if (scenarioIds.has(sc.scenario_id)) {
      issues.push({
        code: 'DUPLICATE_SCENARIO_ID',
        field: `scenarios.${sc.scenario_id}`,
        message: `Duplicate scenario_id detected: '${sc.scenario_id}'.`
      });
    }
    scenarioIds.add(sc.scenario_id);

    // Validate Context dimensions
    const ctxRes = validateDecisionContext(sc.context);
    for (const issue of ctxRes.issues) {
      issues.push({
        ...issue,
        field: `scenarios.${sc.scenario_id}.context.${issue.field}`
      });
    }

    // Validate Fit Taxonomy enums
    const rec = sc.expected_recommendation;
    if (!FIT_TAXONOMY_VALUES.includes(rec.recommended_fit)) {
      issues.push({
        code: 'INVALID_FIT_TAXONOMY',
        field: `scenarios.${sc.scenario_id}.expected_recommendation.recommended_fit`,
        message: `Invalid fit value '${rec.recommended_fit}'. Must be one of: ${FIT_TAXONOMY_VALUES.join(', ')}.`
      });
    }
    if (rec.alternative_fit && !FIT_TAXONOMY_VALUES.includes(rec.alternative_fit)) {
      issues.push({
        code: 'INVALID_FIT_TAXONOMY',
        field: `scenarios.${sc.scenario_id}.expected_recommendation.alternative_fit`,
        message: `Invalid alternative fit value '${rec.alternative_fit}'. Must be one of: ${FIT_TAXONOMY_VALUES.join(', ')}.`
      });
    }

    // Validate referenced solution IDs in scenarios
    if (!solutionIds.has(rec.recommended_solution_id)) {
      issues.push({
        code: 'UNKNOWN_SOLUTION_REFERENCE',
        field: `scenarios.${sc.scenario_id}.recommended_solution_id`,
        message: `Scenario references non-existent recommended solution '${rec.recommended_solution_id}'.`
      });
    }
    if (rec.alternative_solution_id && !solutionIds.has(rec.alternative_solution_id)) {
      issues.push({
        code: 'UNKNOWN_SOLUTION_REFERENCE',
        field: `scenarios.${sc.scenario_id}.alternative_solution_id`,
        message: `Scenario references non-existent alternative solution '${rec.alternative_solution_id}'.`
      });
    }

    // Validate non-empty rationale
    if (!rec.why_recommended || rec.why_recommended.trim() === '') {
      issues.push({
        code: 'EMPTY_RATIONALE',
        field: `scenarios.${sc.scenario_id}.why_recommended`,
        message: 'Scenario why_recommended must be a non-empty explanation.'
      });
    }
  }

  // 8. Snapshot hash verification
  const allBindings: EvidenceBinding[] = [];
  model.evaluations.forEach(e => allBindings.push(e.evidence_binding));
  model.solution_classes.forEach(s => s.tradeoffs.forEach(t => allBindings.push(t.evidence_binding)));
  model.scenarios.forEach(sc => sc.expected_recommendation.evidence_bindings.forEach(eb => allBindings.push(eb)));
  const calculatedHash = computeEvidenceSnapshotHash(allBindings);

  if (model.evidence_snapshot_hash !== calculatedHash) {
    issues.push({
      code: 'EVIDENCE_SNAPSHOT_HASH_MISMATCH',
      field: 'evidence_snapshot_hash',
      message: `Declared snapshot hash '${model.evidence_snapshot_hash}' does not match computed '${calculatedHash}'.`
    });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Pure deterministic evaluation of a declarative constraint predicate against DecisionContext.
 * Guaranteed 100% side-effect free, edge-runtime safe, with zero eval() or new Function().
 */
export function evaluateConstraintPredicate(
  predicate: ConstraintPredicate,
  context: DecisionContext
): boolean {
  if (!predicate || !Array.isArray(predicate.rules) || predicate.rules.length === 0) {
    return false;
  }

  const evalRule = (rule: ConstraintRule): boolean => {
    const val = context[rule.field];
    switch (rule.operator) {
      case 'EQUALS':
        return val === rule.value;
      case 'NOT_EQUALS':
        return val !== rule.value;
      case 'INCLUDES':
        return String(val ?? '').toLowerCase().includes(String(rule.value ?? '').toLowerCase());
      case 'IN':
        return Array.isArray(rule.value) && rule.value.includes(val);
      default:
        return false;
    }
  };

  if (predicate.operator === 'ANY') {
    return predicate.rules.some(evalRule);
  }
  return predicate.rules.every(evalRule);
}

/**
 * Deduplicates and sorts an array of evidence bindings deterministically.
 */
export function canonicalizeEvidenceBindings(bindings: EvidenceBinding[]): EvidenceBinding[] {
  const map = new Map<string, EvidenceBinding>();
  for (const b of bindings) {
    const key = `${b.article_id}|${b.publication_version_key}|${b.claim_class}|${b.published_content_hash}`;
    if (!map.has(key)) {
      map.set(key, { ...b });
    }
  }

  const result = Array.from(map.values());
  result.sort((a, b) => {
    if (a.article_id !== b.article_id) {
      return a.article_id - b.article_id;
    }
    const classDiff = a.claim_class.localeCompare(b.claim_class);
    if (classDiff !== 0) {
      return classDiff;
    }
    return a.evidence_summary.localeCompare(b.evidence_summary);
  });
  return result;
}

/**
 * Extracts all evidence bindings from a decision model definition for freshness audit.
 */
export function extractAllModelBindings(model: DecisionModelDefinition): EvidenceBinding[] {
  const bindings: EvidenceBinding[] = [];
  for (const ev of model.evaluations) {
    if (ev.evidence_binding) {
      bindings.push(ev.evidence_binding);
    }
  }
  for (const sol of model.solution_classes) {
    for (const tr of sol.tradeoffs) {
      if (tr.evidence_binding) {
        bindings.push(tr.evidence_binding);
      }
    }
  }
  for (const sc of model.scenarios) {
    if (sc.expected_recommendation?.evidence_bindings) {
      for (const eb of sc.expected_recommendation.evidence_bindings) {
        bindings.push(eb);
      }
    }
  }
  return canonicalizeEvidenceBindings(bindings);
}
