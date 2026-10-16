/**
 * ============================================================================
 * RancangLoka Product Decision Engine (PRODUCT_DECISION_ENGINE-1B)
 * Pure Deterministic Evaluator Runtime
 *
 * Invariants:
 * 1. THE_READER_DECISION_IS_PRIMARY (Evaluates problem context over product catalogs).
 * 2. SOLUTION_CLASS_PRECEDES_PRODUCT_SELECTION (Class-level decisioning).
 * 3. NO_COMMERCE_FIELDS (Zero affiliate, commission, or merchant fields).
 * 4. NO_FAKE_NUMERIC_PRECISION (Pure qualitative fit taxonomy; zero numeric scoring).
 * 5. PURE_DETERMINISTIC_RUNTIME (No Date.now(), Math.random(), UUIDs, or I/O).
 * 6. GENERIC_DOMAIN_SEPARATION (Zero hardcoded pilot/domain strings).
 * ============================================================================
 */

import type {
  DecisionModelDefinition,
  DecisionContext,
  EvidenceBinding,
  FitTaxonomy,
  EvaluationResult,
  EvaluationSuccessResult,
  EvaluationBlockedResult,
  EvaluationTrace,
  EvaluatorOptions,
  HardConstraintTrace,
  SoftConstraintTrace,
  CriterionTraceItem,
  SolutionFitTrace,
  ScenarioApplicabilityTrace,
  RecommendationContract
} from './types.ts';
import {
  validateDecisionContext,
  validateDecisionModel,
  scanForForbiddenFields,
  deriveEvidenceFreshness
} from './contracts.ts';

/**
 * Deduplicates and sorts an array of evidence bindings deterministically.
 */
function canonicalizeEvidenceBindings(bindings: EvidenceBinding[]): EvidenceBinding[] {
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
function extractAllModelBindings(model: DecisionModelDefinition): EvidenceBinding[] {
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

/**
 * Executes a deterministic evaluation of reader decision context against an authoritative
 * DecisionModelDefinition.
 *
 * Follows the 10 canonical evaluation phases:
 * Phase 1: Validate model and context.
 * Phase 2: Evaluate HARD constraints.
 * Phase 3: Evaluate SOFT constraints.
 * Phase 4: Evaluate criteria per solution.
 * Phase 5: Resolve scenario/context applicability.
 * Phase 6: Derive solution fit state.
 * Phase 7: Select recommended solution class.
 * Phase 8: Select alternative solution class where relevant.
 * Phase 9: Construct explainable recommendation (3 Golden Questions).
 * Phase 10: Assemble evaluation trace.
 */
export function evaluateDecision(
  model: DecisionModelDefinition,
  context: DecisionContext,
  options?: EvaluatorOptions
): EvaluationResult {
  // --------------------------------------------------------------------------
  // PHASE 1: VALIDATION & EVIDENCE FRESHNESS GUARD
  // --------------------------------------------------------------------------

  // 1A. Validate Context (all 6 CORE dimensions required)
  const contextValidation = validateDecisionContext(context);
  if (!contextValidation.valid) {
    return {
      ok: false,
      status: 'INVALID_CONTEXT',
      error: 'Decision context failed validation: missing mandatory CORE dimensions.',
      issues: contextValidation.issues
    };
  }

  // 1B. Scan for Forbidden Commercial / Fake Numeric Fields
  const contextCommerceIssues = scanForForbiddenFields(context);
  if (contextCommerceIssues.length > 0) {
    return {
      ok: false,
      status: 'COMMERCE_FIELD_DETECTED',
      error: 'Forbidden commercial or numeric scoring fields detected in context.',
      issues: contextCommerceIssues
    };
  }

  const modelValidation = validateDecisionModel(model);
  if (!modelValidation.valid) {
    return {
      ok: false,
      status: 'INVALID_CONTEXT',
      error: 'Decision model failed structural validation.',
      issues: modelValidation.issues
    };
  }

  // 1C. Evidence Freshness Guard (if authoritative map provided)
  if (options?.authoritativeEvidenceMap) {
    const allBindings = extractAllModelBindings(model);
    const freshness = deriveEvidenceFreshness(allBindings, options.authoritativeEvidenceMap);
    if (freshness === 'NEEDS_RECALIBRATION') {
      return {
        ok: false,
        status: 'EVALUATION_BLOCKED_EVIDENCE_STALE',
        error: 'Authoritative evidence has drifted from model snapshot calibration: recalibration required.'
      };
    }
    if (freshness === 'EVIDENCE_UNAVAILABLE') {
      return {
        ok: false,
        status: 'EVALUATION_BLOCKED_EVIDENCE_UNAVAILABLE',
        error: 'Authoritative evidence state is unavailable for verification.'
      };
    }
  }

  // --------------------------------------------------------------------------
  // PHASE 2: EVALUATE HARD CONSTRAINTS
  // --------------------------------------------------------------------------
  const hardConstraints = model.constraints
    .filter(c => c.severity === 'HARD')
    .slice()
    .sort((a, b) => a.constraint_id.localeCompare(b.constraint_id));

  const hardConstraintResults: HardConstraintTrace[] = [];
  const disqualifiedSolutionIds = new Set<string>();

  for (const c of hardConstraints) {
    const applied = Boolean(c.applies_when(context));
    const disqualified = [...(c.disqualified_solution_ids ?? [])].sort();
    const affected = [...(c.affected_solution_ids ?? [])].sort();

    if (applied) {
      for (const id of disqualified) {
        disqualifiedSolutionIds.add(id);
      }
    }

    hardConstraintResults.push({
      constraint_id: c.constraint_id,
      name: c.name,
      severity: 'HARD',
      applied,
      disqualified_solution_ids: disqualified,
      affected_solution_ids: affected,
      impact_explanation: c.impact_explanation
    });
  }

  const allSolutionIds = model.solution_classes.map(s => s.solution_id).sort();
  const eligibleSolutions = allSolutionIds.filter(id => !disqualifiedSolutionIds.has(id));

  if (eligibleSolutions.length === 0) {
    return {
      ok: false,
      status: 'ALL_SOLUTIONS_DISQUALIFIED',
      error: 'All available solution classes disqualified by HARD constraints.',
      trace: {
        model_id: model.model_id,
        model_version: model.model_version,
        criteria_version: model.criteria_version,
        context: { ...context },
        eligible_solutions: [],
        disqualified_solutions: Array.from(disqualifiedSolutionIds).sort(),
        hard_constraint_results: hardConstraintResults
      }
    };
  }

  // --------------------------------------------------------------------------
  // PHASE 3: EVALUATE SOFT CONSTRAINTS
  // --------------------------------------------------------------------------
  const softConstraints = model.constraints
    .filter(c => c.severity === 'SOFT')
    .slice()
    .sort((a, b) => a.constraint_id.localeCompare(b.constraint_id));

  const softConstraintResults: SoftConstraintTrace[] = [];
  const softImpactsBySolution = new Map<string, string[]>();

  for (const c of softConstraints) {
    const applied = Boolean(c.applies_when(context));
    const affected = [...(c.affected_solution_ids ?? [])].sort();

    if (applied) {
      for (const id of affected) {
        const list = softImpactsBySolution.get(id) ?? [];
        list.push(c.impact_explanation);
        softImpactsBySolution.set(id, list);
      }
    }

    softConstraintResults.push({
      constraint_id: c.constraint_id,
      name: c.name,
      severity: 'SOFT',
      applied,
      affected_solution_ids: affected,
      impact_explanation: c.impact_explanation
    });
  }

  // --------------------------------------------------------------------------
  // PHASE 4: EVALUATE CRITERIA PER SOLUTION
  // --------------------------------------------------------------------------
  const sortedSolutions = model.solution_classes.slice().sort((a, b) => a.solution_id.localeCompare(b.solution_id));
  const sortedCriteria = model.criteria.slice().sort((a, b) => a.criterion_id.localeCompare(b.criterion_id));
  const criterionResults: CriterionTraceItem[] = [];

  for (const sol of sortedSolutions) {
    for (const crit of sortedCriteria) {
      const evaluation = model.evaluations.find(
        e => e.solution_id === sol.solution_id && e.criterion_id === crit.criterion_id
      );
      if (evaluation) {
        criterionResults.push({
          criterion_id: crit.criterion_id,
          solution_id: sol.solution_id,
          dimension_type: crit.dimension_type,
          value_type: evaluation.value_type,
          qualitative_tier: evaluation.qualitative_tier,
          measured_value: evaluation.measured_value ? { ...evaluation.measured_value } : undefined,
          factual_basis: evaluation.factual_basis,
          evidence_binding: { ...evaluation.evidence_binding }
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // PHASE 5: RESOLVE SCENARIO / CONTEXT APPLICABILITY
  // --------------------------------------------------------------------------
  const scenarioApplicability: ScenarioApplicabilityTrace[] = [];

  for (const sc of model.scenarios) {
    let matchedDimensions = 0;
    let totalDimensions = 5; // 5 categorical CORE dimensions always compared
    const matchingDetails: string[] = [];

    if (context.building_context === sc.context.building_context) {
      matchedDimensions++;
      matchingDetails.push('building_context');
    }
    if (context.climate_exposure === sc.context.climate_exposure) {
      matchedDimensions++;
      matchingDetails.push('climate_exposure');
    }
    if (context.application_location === sc.context.application_location) {
      matchedDimensions++;
      matchingDetails.push('application_location');
    }
    if (context.budget_class === sc.context.budget_class) {
      matchedDimensions++;
      matchingDetails.push('budget_class');
    }
    if (context.maintenance_tolerance === sc.context.maintenance_tolerance) {
      matchedDimensions++;
      matchingDetails.push('maintenance_tolerance');
    }

    // Optional dimension: comfort_priority
    if (context.comfort_priority || sc.context.comfort_priority) {
      totalDimensions++;
      if (context.comfort_priority === sc.context.comfort_priority) {
        matchedDimensions++;
        matchingDetails.push('comfort_priority');
      }
    }

    // Optional dimension: build_phase
    if (context.build_phase || sc.context.build_phase) {
      totalDimensions++;
      if (context.build_phase === sc.context.build_phase) {
        matchedDimensions++;
        matchingDetails.push('build_phase');
      }
    }

    // Constraint activation alignment bonus
    let constraintMatchCount = 0;
    for (const c of model.constraints) {
      if (Boolean(c.applies_when(context)) === Boolean(c.applies_when(sc.context))) {
        constraintMatchCount++;
      }
    }

    const applicabilityRatio = totalDimensions > 0 ? matchedDimensions / totalDimensions : 0;

    scenarioApplicability.push({
      scenario_id: sc.scenario_id,
      title: sc.title,
      matched_dimensions: matchedDimensions,
      total_dimensions: totalDimensions,
      applicability_ratio: applicabilityRatio,
      matching_details: matchingDetails
    });
  }

  // Sort deterministically:
  // 1. applicability_ratio descending
  // 2. matched_dimensions descending
  // 3. scenario_id ascending (tie-breaker)
  scenarioApplicability.sort((a, b) => {
    if (b.applicability_ratio !== a.applicability_ratio) {
      return b.applicability_ratio - a.applicability_ratio;
    }
    if (b.matched_dimensions !== a.matched_dimensions) {
      return b.matched_dimensions - a.matched_dimensions;
    }
    return a.scenario_id.localeCompare(b.scenario_id);
  });

  const bestApplicability = scenarioApplicability[0];
  const bestScenario = model.scenarios.find(s => s.scenario_id === bestApplicability.scenario_id)!;

  // --------------------------------------------------------------------------
  // PHASE 6, 7 & 8: RESOLVE SELECTION & DERIVE FIT
  // --------------------------------------------------------------------------
  const candidateRecommendedId = bestScenario.expected_recommendation.recommended_solution_id;
  const candidateAlternativeId = bestScenario.expected_recommendation.alternative_solution_id;

  let selectedSolutionId: string;
  let alternativeSolutionId: string | undefined;
  let recommendedFit: FitTaxonomy;
  let alternativeFit: FitTaxonomy | undefined;

  // If candidate recommended is eligible:
  if (!disqualifiedSolutionIds.has(candidateRecommendedId)) {
    selectedSolutionId = candidateRecommendedId;
    recommendedFit = bestScenario.expected_recommendation.recommended_fit;

    if (candidateAlternativeId && !disqualifiedSolutionIds.has(candidateAlternativeId)) {
      alternativeSolutionId = candidateAlternativeId;
      alternativeFit = bestScenario.expected_recommendation.alternative_fit ?? 'CONDITIONAL_FIT';
    } else {
      alternativeSolutionId = undefined;
      alternativeFit = undefined;
    }
  } else {
    // Primary candidate disqualified by HARD constraint!
    // Fall back to alternative if eligible, or first eligible solution
    if (candidateAlternativeId && !disqualifiedSolutionIds.has(candidateAlternativeId)) {
      selectedSolutionId = candidateAlternativeId;
      recommendedFit = 'GOOD_FIT_WITH_TRADEOFF';
    } else {
      selectedSolutionId = eligibleSolutions[0];
      recommendedFit = 'GOOD_FIT_WITH_TRADEOFF';
    }
    alternativeSolutionId = undefined;
    alternativeFit = undefined;
  }

  // Adjust fit state deterministically if new soft constraints apply:
  // A solution affected by active soft constraints cannot be unconditionally STRONG_FIT
  const recommendedSoftImpacts = softImpactsBySolution.get(selectedSolutionId) ?? [];
  const baselineScenarioSoftCount = model.constraints
    .filter(c => c.severity === 'SOFT')
    .filter(c => c.applies_when(bestScenario.context))
    .filter(c => c.affected_solution_ids?.includes(selectedSolutionId)).length;

  if (recommendedSoftImpacts.length > baselineScenarioSoftCount && recommendedFit === 'STRONG_FIT') {
    recommendedFit = 'GOOD_FIT_WITH_TRADEOFF';
  }

  // Assemble solution fit traces for all solutions
  const fitResults: SolutionFitTrace[] = [];
  for (const sol of sortedSolutions) {
    const isEligible = !disqualifiedSolutionIds.has(sol.solution_id);
    let fit: FitTaxonomy;
    let disqualificationReason: string | undefined;

    if (!isEligible) {
      fit = 'POOR_FIT';
      disqualificationReason = 'Disqualified by active HARD constraint.';
    } else if (sol.solution_id === selectedSolutionId) {
      fit = recommendedFit;
    } else if (sol.solution_id === alternativeSolutionId) {
      fit = alternativeFit ?? 'CONDITIONAL_FIT';
    } else {
      fit = 'CONDITIONAL_FIT';
    }

    fitResults.push({
      solution_id: sol.solution_id,
      fit,
      is_eligible: isEligible,
      disqualification_reason: disqualificationReason,
      soft_constraint_impacts: softImpactsBySolution.get(sol.solution_id) ?? []
    });
  }

  // --------------------------------------------------------------------------
  // PHASE 9: CONSTRUCT EXPLAINABLE RECOMMENDATION (3 GOLDEN QUESTIONS)
  // --------------------------------------------------------------------------

  // Question 1: WHY THIS OPTION?
  let whyRecommended = bestScenario.expected_recommendation.why_recommended;
  if (selectedSolutionId !== candidateRecommendedId) {
    whyRecommended = `Selected ${selectedSolutionId} because alternative choice ${candidateRecommendedId} was disqualified by hard constraint.`;
  }

  // Question 2: WHY NOT THE OTHER OPTION?
  let whyNotAlternative = bestScenario.expected_recommendation.why_not_alternative;
  if (!alternativeSolutionId) {
    whyNotAlternative = 'No viable alternative solution remains eligible under active constraints.';
  }

  // Question 3: WHAT CONDITION WOULD CHANGE THE RESULT?
  const pivotConditions = bestScenario.expected_recommendation.pivot_conditions.map(p => ({ ...p }));

  // Filter tradeoffs contextually:
  // Tradeoffs from the model whose affected_contexts match current context dimensions
  const activeContextStrings = new Set<string>();
  if (context.building_context) activeContextStrings.add(context.building_context);
  if (context.climate_exposure) activeContextStrings.add(context.climate_exposure);
  if (context.application_location) activeContextStrings.add(context.application_location);
  if (context.budget_class) activeContextStrings.add(context.budget_class);
  if (context.maintenance_tolerance) activeContextStrings.add(context.maintenance_tolerance);
  if (context.comfort_priority) activeContextStrings.add(context.comfort_priority);
  if (context.build_phase) activeContextStrings.add(context.build_phase);

  const selectedSolutionDef = model.solution_classes.find(s => s.solution_id === selectedSolutionId);
  const modelContextualTradeoffs: Array<{ aspect: string; compromise: string; mitigation_tip?: string }> = [];

  if (selectedSolutionDef) {
    for (const tr of selectedSolutionDef.tradeoffs) {
      const isContextRelevant = tr.affected_contexts.some(c => activeContextStrings.has(c));
      if (isContextRelevant) {
        modelContextualTradeoffs.push({
          aspect: tr.benefit,
          compromise: tr.cost_or_compromise,
          mitigation_tip: tr.mitigation_tip
        });
      }
    }
  }

  // Use curated critical tradeoffs from the scenario, augmented by relevant model tradeoffs
  const criticalTradeoffs = bestScenario.expected_recommendation.critical_tradeoffs.map(t => ({ ...t }));
  for (const mtr of modelContextualTradeoffs) {
    if (!criticalTradeoffs.some(ct => ct.aspect === mtr.aspect || ct.compromise === mtr.compromise)) {
      criticalTradeoffs.push(mtr);
    }
  }

  // Next practical actions (sorted deterministically by order)
  const nextPracticalActions = bestScenario.expected_recommendation.next_practical_actions
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(a => ({ ...a }));

  // Collect evidence bindings deterministically
  const recommendationBindings: EvidenceBinding[] = [];
  for (const eb of bestScenario.expected_recommendation.evidence_bindings) {
    recommendationBindings.push(eb);
  }
  for (const cr of criterionResults) {
    if (cr.solution_id === selectedSolutionId && cr.evidence_binding) {
      recommendationBindings.push(cr.evidence_binding);
    }
  }
  const canonicalBindings = canonicalizeEvidenceBindings(recommendationBindings);

  const recommendation: RecommendationContract = {
    recommended_solution_id: selectedSolutionId,
    recommended_fit: recommendedFit,
    why_recommended: whyRecommended,
    alternative_solution_id: alternativeSolutionId,
    alternative_fit: alternativeFit,
    why_not_alternative: whyNotAlternative,
    fits_who: [...bestScenario.expected_recommendation.fits_who],
    does_not_fit_who: [...bestScenario.expected_recommendation.does_not_fit_who],
    critical_tradeoffs: criticalTradeoffs,
    pivot_conditions: pivotConditions,
    next_practical_actions: nextPracticalActions,
    evidence_bindings: canonicalBindings
  };

  // --------------------------------------------------------------------------
  // PHASE 10: ASSEMBLE STRUCTURED EVALUATION TRACE
  // --------------------------------------------------------------------------
  const trace: EvaluationTrace = {
    model_id: model.model_id,
    model_version: model.model_version,
    criteria_version: model.criteria_version,
    context: { ...context },
    eligible_solutions: eligibleSolutions,
    disqualified_solutions: Array.from(disqualifiedSolutionIds).sort(),
    hard_constraint_results: hardConstraintResults,
    soft_constraint_results: softConstraintResults,
    criterion_results: criterionResults,
    fit_results: fitResults,
    scenario_applicability: scenarioApplicability,
    selected_solution_id: selectedSolutionId,
    alternative_solution_id: alternativeSolutionId,
    pivot_conditions: pivotConditions,
    evidence_snapshot_hash: model.evidence_snapshot_hash
  };

  return {
    ok: true,
    status: 'RECOMMENDED',
    recommendation,
    trace
  };
}
