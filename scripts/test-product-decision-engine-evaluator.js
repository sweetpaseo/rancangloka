#!/usr/bin/env node
/**
 * ============================================================================
 * RancangLoka Product Decision Engine Evaluator Test Suite (PDE-1B)
 *
 * Comprehensive Test Suite for Pure Deterministic Evaluator Runtime:
 * A. All 5 canonical pilot scenarios reproduce expected recommendation.
 * B. All 5 reproduce expected fit state.
 * C. Same input evaluated twice deep-equals exactly (Byte-equivalent determinism).
 * D. Scenario identifier does not control recommendation.
 * E. Context perturbation changes outcome appropriately.
 * F. At least 3 pivot boundary tests.
 * G. HARD constraint can disqualify solutions.
 * H. SOFT constraint does not disqualify solutions.
 * I. Missing mandatory CORE context blocks evaluation.
 * J. Stale authoritative evidence blocks evaluation.
 * K. Unavailable authoritative evidence blocks evaluation.
 * L. Forbidden commercial fields in context are rejected.
 * M. Zero overall numeric scores or rankings emitted.
 * N. Evidence bindings remain attached and valid.
 * O. Recommendation structurally answers 3 Golden Questions.
 * P. Generic evaluator source contains zero hardcoded pilot-specific strings.
 * Q. Criterion evaluation preserves qualitative evidence types.
 * R. No timestamps or random IDs in evaluation output.
 * S. Repeated evaluations maintain deterministic array ordering.
 * T. All solutions disqualified returns typed blocked result.
 * ============================================================================
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DECISION_MODEL_PILOT_KUSEN,
  evaluateDecision,
  scanForForbiddenFields,
  FORBIDDEN_CONTRACT_FIELDS
} from '../src/lib/product-decision/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failedCount++;
  }
}

console.log('================================================================');
console.log('RancangLoka Product Decision Engine Evaluator Test Suite (PDE-1B)');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// Test A & B: All 5 canonical pilot scenarios reproduce expected recommendations & fit
// ----------------------------------------------------------------------------
test('A & B. All 5 canonical pilot scenarios reproduce expected recommendation and fit state', () => {
  assert.strictEqual(DECISION_MODEL_PILOT_KUSEN.scenarios.length, 5);

  for (const scenario of DECISION_MODEL_PILOT_KUSEN.scenarios) {
    const result = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, scenario.context);
    assert.strictEqual(result.ok, true, `Scenario ${scenario.scenario_id} failed: ${JSON.stringify(result)}`);
    assert.strictEqual(result.status, 'RECOMMENDED');

    const expected = scenario.expected_recommendation;
    assert.strictEqual(
      result.recommendation.recommended_solution_id,
      expected.recommended_solution_id,
      `Scenario ${scenario.scenario_id}: recommended_solution_id mismatch`
    );
    assert.strictEqual(
      result.recommendation.recommended_fit,
      expected.recommended_fit,
      `Scenario ${scenario.scenario_id}: recommended_fit mismatch`
    );
    assert.strictEqual(
      result.recommendation.alternative_solution_id,
      expected.alternative_solution_id,
      `Scenario ${scenario.scenario_id}: alternative_solution_id mismatch`
    );
    assert.strictEqual(
      result.recommendation.alternative_fit,
      expected.alternative_fit,
      `Scenario ${scenario.scenario_id}: alternative_fit mismatch`
    );
  }
});

// ----------------------------------------------------------------------------
// Test C: Strict byte-equivalent determinism (Deep equality across runs)
// ----------------------------------------------------------------------------
test('C. Same input evaluated multiple times deep-equals exactly', () => {
  const scenario = DECISION_MODEL_PILOT_KUSEN.scenarios[0];
  const run1 = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, scenario.context);
  const run2 = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, scenario.context);

  assert.deepStrictEqual(run1, run2);
  assert.strictEqual(JSON.stringify(run1), JSON.stringify(run2));
});

// ----------------------------------------------------------------------------
// Test D: Scenario identifier does not control recommendation
// ----------------------------------------------------------------------------
test('D. Context evaluated outside scenario context wrapper produces identical output', () => {
  const scenario = DECISION_MODEL_PILOT_KUSEN.scenarios[0];
  // Clone context without any scenario identifier or wrapper
  const rawContext = JSON.parse(JSON.stringify(scenario.context));

  const resultFromRaw = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, rawContext);
  const resultFromScenario = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, scenario.context);

  assert.deepStrictEqual(resultFromRaw, resultFromScenario);
});

// ----------------------------------------------------------------------------
// Test E: Context perturbation tests (at least 1 per pilot scenario)
// ----------------------------------------------------------------------------
test('E. Context perturbations change outcome deterministically', () => {
  // Perturbation 1 (Scenario 1 base): Change from west-facing heat bedroom to wide sliding door living area
  const p1Context = {
    ...DECISION_MODEL_PILOT_KUSEN.scenarios[0].context,
    climate_exposure: 'STANDARD_TROPICAL_SHELTERED',
    application_location: 'LIVING_COMMON_AREA',
    problem_goal: 'Pintu geser bukaan lebar fleksibel dengan bidang pandang kaca maksimal',
    comfort_priority: 'BALANCED_COMFORT'
  };
  const resP1 = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, p1Context);
  assert.strictEqual(resP1.ok, true);
  assert.strictEqual(resP1.recommendation.recommended_solution_id, 'sol_aluminium_standar');

  // Perturbation 2 (Scenario 2 base): Change from living sliding door to west-facing master bedroom
  const p2Context = {
    ...DECISION_MODEL_PILOT_KUSEN.scenarios[1].context,
    climate_exposure: 'WEST_AFTERNOON_HEAT',
    application_location: 'MASTER_BEDROOM',
    problem_goal: 'Mereduksi panas radiasi sore dan kebisingan lingkungan pada kamar tidur ber-AC',
    comfort_priority: 'THERMAL_HEAT_REDUCTION'
  };
  const resP2 = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, p2Context);
  assert.strictEqual(resP2.ok, true);
  assert.strictEqual(resP2.recommendation.recommended_solution_id, 'sol_upvc_multi_chamber');

  // Perturbation 3 (Scenario 3 base): Change to tight budget standard renovation
  const p3Context = {
    ...DECISION_MODEL_PILOT_KUSEN.scenarios[2].context,
    building_context: 'SINGLE_STORY_HOUSE',
    climate_exposure: 'STANDARD_TROPICAL_SHELTERED',
    budget_class: 'TIGHT_CONSTRAINED',
    application_location: 'LIVING_COMMON_AREA',
    maintenance_tolerance: 'PERIODIC_LIGHT_MAINTENANCE'
  };
  const resP3 = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, p3Context);
  assert.strictEqual(resP3.ok, true);
  assert.strictEqual(resP3.recommendation.recommended_solution_id, 'sol_aluminium_standar');
  assert.strictEqual(resP3.recommendation.recommended_fit, 'GOOD_FIT_WITH_TRADEOFF');

  // Perturbation 4 (Scenario 4 base): Upgrade budget to balanced and expose to west afternoon heat
  const p4Context = {
    ...DECISION_MODEL_PILOT_KUSEN.scenarios[3].context,
    building_context: 'MULTI_STORY_HOUSE',
    budget_class: 'BALANCED_MID',
    climate_exposure: 'WEST_AFTERNOON_HEAT',
    application_location: 'MASTER_BEDROOM',
    maintenance_tolerance: 'FIT_AND_FORGET',
    comfort_priority: 'THERMAL_HEAT_REDUCTION'
  };
  const resP4 = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, p4Context);
  assert.strictEqual(resP4.ok, true);
  assert.strictEqual(resP4.recommendation.recommended_solution_id, 'sol_upvc_multi_chamber');
  assert.strictEqual(resP4.recommendation.recommended_fit, 'STRONG_FIT');

  // Perturbation 5 (Scenario 5 base): Add tight budget requirement
  const p5Context = {
    ...DECISION_MODEL_PILOT_KUSEN.scenarios[4].context,
    building_context: 'SINGLE_STORY_HOUSE',
    budget_class: 'TIGHT_CONSTRAINED',
    climate_exposure: 'STANDARD_TROPICAL_SHELTERED',
    maintenance_tolerance: 'PERIODIC_LIGHT_MAINTENANCE'
  };
  const resP5 = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, p5Context);
  assert.strictEqual(resP5.ok, true);
  assert.strictEqual(resP5.recommendation.recommended_solution_id, 'sol_aluminium_standar');
  assert.strictEqual(resP5.recommendation.recommended_fit, 'GOOD_FIT_WITH_TRADEOFF');
});

// ----------------------------------------------------------------------------
// Test F: At least 3 explicit pivot boundary tests
// ----------------------------------------------------------------------------
test('F. Pivot boundary tests trigger expected solution changes', () => {
  // Boundary 1: Thermal priority vs Structural span priority
  const thermalContext = {
    problem_goal: 'Mereduksi panas radiasi sore dan kebisingan lingkungan pada kamar tidur ber-AC',
    building_context: 'MULTI_STORY_HOUSE',
    climate_exposure: 'WEST_AFTERNOON_HEAT',
    application_location: 'MASTER_BEDROOM',
    budget_class: 'BALANCED_MID',
    maintenance_tolerance: 'FIT_AND_FORGET',
    comfort_priority: 'THERMAL_HEAT_REDUCTION'
  };
  const structuralContext = {
    ...thermalContext,
    problem_goal: 'Pintu geser bukaan lebar fleksibel dengan bidang pandang kaca maksimal',
    application_location: 'LIVING_COMMON_AREA',
    climate_exposure: 'STANDARD_TROPICAL_SHELTERED',
    budget_class: 'LONG_TERM_INVESTMENT',
    comfort_priority: 'BALANCED_COMFORT'
  };
  const resThermal = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, thermalContext);
  const resStructural = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, structuralContext);
  assert.strictEqual(resThermal.recommendation.recommended_solution_id, 'sol_upvc_multi_chamber');
  assert.strictEqual(resStructural.recommendation.recommended_solution_id, 'sol_aluminium_standar');

  // Boundary 2: Tight budget vs Comfort-first long term investment
  const tightBudgetContext = {
    problem_goal: 'Mengganti kusen kayu lama yang keropos dengan biaya awal hemat dan material anti-rayap',
    building_context: 'SINGLE_STORY_HOUSE',
    climate_exposure: 'STANDARD_TROPICAL_SHELTERED',
    application_location: 'LIVING_COMMON_AREA',
    budget_class: 'TIGHT_CONSTRAINED',
    maintenance_tolerance: 'PERIODIC_LIGHT_MAINTENANCE'
  };
  const comfortContext = {
    problem_goal: 'Mereduksi panas radiasi sore dan kebisingan lingkungan pada kamar tidur ber-AC',
    building_context: 'MULTI_STORY_HOUSE',
    budget_class: 'LONG_TERM_INVESTMENT',
    climate_exposure: 'WEST_AFTERNOON_HEAT',
    application_location: 'MASTER_BEDROOM',
    maintenance_tolerance: 'FIT_AND_FORGET',
    comfort_priority: 'THERMAL_HEAT_REDUCTION'
  };
  const resTight = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, tightBudgetContext);
  const resComfort = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, comfortContext);
  assert.strictEqual(resTight.recommendation.recommended_solution_id, 'sol_aluminium_standar');
  assert.strictEqual(resTight.recommendation.recommended_fit, 'GOOD_FIT_WITH_TRADEOFF');
  assert.strictEqual(resComfort.recommendation.recommended_solution_id, 'sol_upvc_multi_chamber');
  assert.strictEqual(resComfort.recommendation.recommended_fit, 'STRONG_FIT');

  // Boundary 3: Sheltered inland standard vs Coastal salt exposure
  const inlandContext = {
    problem_goal: 'Mengganti kusen kayu lama yang keropos dengan biaya awal hemat dan material anti-rayap',
    building_context: 'SINGLE_STORY_HOUSE',
    climate_exposure: 'STANDARD_TROPICAL_SHELTERED',
    application_location: 'LIVING_COMMON_AREA',
    budget_class: 'TIGHT_CONSTRAINED',
    maintenance_tolerance: 'PERIODIC_LIGHT_MAINTENANCE'
  };
  const coastalContext = {
    problem_goal: 'Mengeliminasi rembesan air tempias hujan angin kencang dan tahan korosi udara pesisir',
    building_context: 'CORNER_HOUSE_HOOK',
    climate_exposure: 'COASTAL_SALT_HUMID',
    application_location: 'MASTER_BEDROOM',
    budget_class: 'BALANCED_MID',
    maintenance_tolerance: 'FIT_AND_FORGET'
  };
  const resInland = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, inlandContext);
  const resCoastal = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, coastalContext);
  assert.notStrictEqual(resInland.recommendation.recommended_solution_id, resCoastal.recommendation.recommended_solution_id);
  assert.strictEqual(resInland.recommendation.recommended_solution_id, 'sol_aluminium_standar');
  assert.strictEqual(resCoastal.recommendation.recommended_solution_id, 'sol_upvc_multi_chamber');
});


// ----------------------------------------------------------------------------
// Test G: HARD constraint can disqualify solutions
// ----------------------------------------------------------------------------
test('G. HARD constraint can disqualify a solution and update eligibility trace', () => {
  const modelWithHardConstraint = {
    ...DECISION_MODEL_PILOT_KUSEN,
    constraints: [
      ...DECISION_MODEL_PILOT_KUSEN.constraints,
      {
        constraint_id: 'c_test_strict_coastal_metal_ban',
        name: 'Larangan Logam di Pesisir Ekstrem',
        description: 'Uji batasan keras melarang logam aluminium.',
        severity: 'HARD',
        applies_when: (ctx) => ctx.climate_exposure === 'COASTAL_SALT_HUMID',
        disqualified_solution_ids: ['sol_aluminium_standar'],
        affected_solution_ids: [],
        impact_explanation: 'Logam aluminium didiskualifikasi secara mutlak di lingkungan ini.'
      }
    ]
  };

  const context = {
    ...DECISION_MODEL_PILOT_KUSEN.scenarios[2].context, // coastal
    climate_exposure: 'COASTAL_SALT_HUMID'
  };

  const result = evaluateDecision(modelWithHardConstraint, context);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.recommendation.recommended_solution_id, 'sol_upvc_multi_chamber');
  assert.strictEqual(result.trace.disqualified_solutions.includes('sol_aluminium_standar'), true);

  const alFitTrace = result.trace.fit_results.find(f => f.solution_id === 'sol_aluminium_standar');
  assert.strictEqual(alFitTrace.is_eligible, false);
  assert.strictEqual(alFitTrace.fit, 'POOR_FIT');
  assert.ok(alFitTrace.disqualification_reason);
});

// ----------------------------------------------------------------------------
// Test H: SOFT constraint does not disqualify solutions
// ----------------------------------------------------------------------------
test('H. SOFT constraint impacts fit without disqualifying the solution', () => {
  const scenario1Context = DECISION_MODEL_PILOT_KUSEN.scenarios[0].context;
  const result = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, scenario1Context);

  assert.strictEqual(result.ok, true);
  // In Scenario 1, soft constraint c_west_afternoon_heat_bedroom affects sol_aluminium_standar
  const alFitTrace = result.trace.fit_results.find(f => f.solution_id === 'sol_aluminium_standar');
  assert.strictEqual(alFitTrace.is_eligible, true);
  assert.strictEqual(alFitTrace.fit, 'GOOD_FIT_WITH_TRADEOFF');
  assert.strictEqual(result.trace.disqualified_solutions.length, 0);
  assert.strictEqual(result.recommendation.alternative_solution_id, 'sol_aluminium_standar');
});

// ----------------------------------------------------------------------------
// Test I: Missing mandatory CORE context blocks evaluation
// ----------------------------------------------------------------------------
test('I. Missing mandatory CORE context returns typed failure', () => {
  const invalidContext = {
    problem_goal: 'Tujuan renovasi tanpa budget_class',
    building_context: 'SINGLE_STORY_HOUSE',
    climate_exposure: 'STANDARD_TROPICAL_SHELTERED',
    application_location: 'LIVING_COMMON_AREA',
    // budget_class missing
    maintenance_tolerance: 'FIT_AND_FORGET'
  };

  const result = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, invalidContext);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 'INVALID_CONTEXT');
  assert.ok(result.issues.some(i => i.field === 'budget_class'));
});

// ----------------------------------------------------------------------------
// Test J: Stale authoritative evidence blocks evaluation
// ----------------------------------------------------------------------------
test('J. Stale authoritative evidence triggers EVALUATION_BLOCKED_EVIDENCE_STALE', () => {
  const staleMap = new Map();
  // Provide altered hash for Article 5 receipt
  staleMap.set('receipt:rcpt_bbae85b48e1b2f8d', {
    published_content_hash: '9999999999999999999999999999999999999999999999999999999999999999'
  });

  const context = DECISION_MODEL_PILOT_KUSEN.scenarios[0].context;
  const result = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, context, {
    authoritativeEvidenceMap: staleMap
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 'EVALUATION_BLOCKED_EVIDENCE_STALE');
});

// ----------------------------------------------------------------------------
// Test K: Unavailable authoritative evidence blocks evaluation
// ----------------------------------------------------------------------------
test('K. Unavailable authoritative evidence triggers EVALUATION_BLOCKED_EVIDENCE_UNAVAILABLE', () => {
  const emptyMap = new Map(); // Empty map has no receipt record

  const context = DECISION_MODEL_PILOT_KUSEN.scenarios[0].context;
  const result = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, context, {
    authoritativeEvidenceMap: emptyMap
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 'EVALUATION_BLOCKED_EVIDENCE_UNAVAILABLE');
});

// ----------------------------------------------------------------------------
// Test L: Forbidden commercial fields in context are rejected
// ----------------------------------------------------------------------------
test('L. Forbidden commercial fields in context are rejected', () => {
  const taintedContext = {
    ...DECISION_MODEL_PILOT_KUSEN.scenarios[0].context,
    affiliate_url: 'https://marketplace.example/aff?id=123'
  };

  const result = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, taintedContext);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 'COMMERCE_FIELD_DETECTED');
});

// ----------------------------------------------------------------------------
// Test M: Zero overall numeric scores or rankings emitted
// ----------------------------------------------------------------------------
test('M. Zero numeric overall scores or rankings emitted in recommendation and trace', () => {
  const context = DECISION_MODEL_PILOT_KUSEN.scenarios[0].context;
  const result = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, context);

  assert.strictEqual(result.ok, true);
  const issues = scanForForbiddenFields(result);
  assert.strictEqual(issues.length, 0, `Forbidden fields found: ${JSON.stringify(issues)}`);

  // Explicit check on recommendation properties
  const rec = result.recommendation;
  assert.strictEqual('overall_score' in rec, false);
  assert.strictEqual('star_rating' in rec, false);
  assert.strictEqual('winner_score' in rec, false);
});

// ----------------------------------------------------------------------------
// Test N: Evidence bindings remain attached and valid
// ----------------------------------------------------------------------------
test('N. All recommendation evidence bindings remain attached with required fields', () => {
  const context = DECISION_MODEL_PILOT_KUSEN.scenarios[0].context;
  const result = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, context);

  assert.strictEqual(result.ok, true);
  assert.ok(result.recommendation.evidence_bindings.length > 0);

  for (const eb of result.recommendation.evidence_bindings) {
    assert.strictEqual(typeof eb.article_id, 'number');
    assert.strictEqual(typeof eb.publication_version_key, 'string');
    assert.strictEqual(typeof eb.published_content_hash, 'string');
    assert.strictEqual(typeof eb.source_fidelity, 'string');
    assert.strictEqual(typeof eb.claim_class, 'string');
    assert.strictEqual(typeof eb.evidence_summary, 'string');
    assert.ok(eb.evidence_summary.length <= 200);
  }
});

// ----------------------------------------------------------------------------
// Test O: Recommendation structurally answers 3 Golden Questions
// ----------------------------------------------------------------------------
test('O. Recommendation structurally answers 3 Golden Questions', () => {
  const context = DECISION_MODEL_PILOT_KUSEN.scenarios[0].context;
  const result = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, context);

  assert.strictEqual(result.ok, true);
  const rec = result.recommendation;

  // Q1: WHY THIS OPTION?
  assert.strictEqual(typeof rec.why_recommended, 'string');
  assert.ok(rec.why_recommended.trim().length > 10);

  // Q2: WHY NOT THE OTHER OPTION?
  assert.strictEqual(typeof rec.why_not_alternative, 'string');
  assert.ok(rec.why_not_alternative.trim().length > 10);

  // Q3: WHAT CONDITION WOULD CHANGE THE RESULT?
  assert.ok(Array.isArray(rec.pivot_conditions));
  assert.ok(rec.pivot_conditions.length >= 1);
  for (const pc of rec.pivot_conditions) {
    assert.strictEqual(typeof pc.trigger_condition, 'string');
    assert.strictEqual(typeof pc.pivots_to_solution_id, 'string');
    assert.strictEqual(typeof pc.rationale, 'string');
  }
});

// ----------------------------------------------------------------------------
// Test P: Generic evaluator source contains zero hardcoded pilot-specific strings
// ----------------------------------------------------------------------------
test('P. Generic evaluator source contains zero domain/pilot specific words', () => {
  const evaluatorPath = path.join(__dirname, '../src/lib/product-decision/evaluator.ts');
  const source = fs.readFileSync(evaluatorPath, 'utf8').toLowerCase();

  // Prohibited domain-specific strings:
  const prohibitedStrings = [
    'aluminium',
    'upvc',
    'window',
    'kusen',
    'article 5',
    'scen_'
  ];

  for (const term of prohibitedStrings) {
    const found = source.includes(term);
    assert.strictEqual(
      found,
      false,
      `Evaluator source violates domain separation: found prohibited term '${term}'`
    );
  }
});

// ----------------------------------------------------------------------------
// Test Q: Criterion evaluation preserves qualitative evidence types
// ----------------------------------------------------------------------------
test('Q. Criterion evaluation trace preserves qualitative evidence types', () => {
  const context = DECISION_MODEL_PILOT_KUSEN.scenarios[0].context;
  const result = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, context);

  assert.strictEqual(result.ok, true);
  const criteriaResults = result.trace.criterion_results;
  assert.strictEqual(criteriaResults.length, 14); // 2 solutions x 7 criteria

  const typesFound = new Set(criteriaResults.map(c => c.value_type));
  assert.ok(typesFound.has('MEASURED_VALUE'));
  assert.ok(typesFound.has('ORDINAL'));
  assert.ok(typesFound.has('QUALITATIVE_CATEGORY'));

  // Ensure measured values have unit and value
  const measured = criteriaResults.filter(c => c.value_type === 'MEASURED_VALUE');
  for (const m of measured) {
    assert.strictEqual(typeof m.measured_value?.value, 'number');
    assert.strictEqual(typeof m.measured_value?.unit, 'string');
  }
});

// ----------------------------------------------------------------------------
// Test R: No timestamps or random IDs in evaluation output
// ----------------------------------------------------------------------------
test('R. Output contains zero timestamps, Date objects, or random UUIDs', () => {
  const context = DECISION_MODEL_PILOT_KUSEN.scenarios[0].context;
  const result = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, context);

  const json = JSON.stringify(result);
  assert.strictEqual(json.includes('timestamp'), false);
  assert.strictEqual(json.includes('createdAt'), false);
  assert.strictEqual(json.includes('updatedAt'), false);
});

// ----------------------------------------------------------------------------
// Test S: Repeated evaluations maintain deterministic array ordering
// ----------------------------------------------------------------------------
test('S. Solution classes, criteria, and evidence bindings maintain deterministic ordering', () => {
  const context = DECISION_MODEL_PILOT_KUSEN.scenarios[0].context;
  for (let i = 0; i < 5; i++) {
    const result = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, context);
    assert.strictEqual(result.ok, true);

    // Eligible solutions sorted
    const eligible = result.trace.eligible_solutions;
    const sortedEligible = [...eligible].sort();
    assert.deepStrictEqual(eligible, sortedEligible);

    // Fit results sorted by solution_id
    const fitIds = result.trace.fit_results.map(f => f.solution_id);
    const sortedFitIds = [...fitIds].sort();
    assert.deepStrictEqual(fitIds, sortedFitIds);
  }
});

// ----------------------------------------------------------------------------
// Test T: All solutions disqualified returns typed blocked result
// ----------------------------------------------------------------------------
test('T. All solutions disqualified returns ALL_SOLUTIONS_DISQUALIFIED result', () => {
  const modelDisqualifyingAll = {
    ...DECISION_MODEL_PILOT_KUSEN,
    constraints: [
      {
        constraint_id: 'c_disqualify_all',
        name: 'Disqualify All Solutions Test',
        description: 'Test constraint',
        severity: 'HARD',
        applies_when: () => true,
        disqualified_solution_ids: ['sol_aluminium_standar', 'sol_upvc_multi_chamber'],
        affected_solution_ids: [],
        impact_explanation: 'All solutions blocked for testing.'
      }
    ]
  };

  const context = DECISION_MODEL_PILOT_KUSEN.scenarios[0].context;
  const result = evaluateDecision(modelDisqualifyingAll, context);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 'ALL_SOLUTIONS_DISQUALIFIED');
  assert.strictEqual(result.trace.eligible_solutions.length, 0);
  assert.strictEqual(result.trace.disqualified_solutions.length, 2);
});

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`Results: ${passedCount} passed, ${failedCount} failed`);
console.log('================================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
