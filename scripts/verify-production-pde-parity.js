import { execSync } from 'node:child_process';
import { deserializeDecisionModel } from '../src/lib/product-decision/store.ts';
import { evaluateDecision } from '../src/lib/product-decision/evaluator.ts';
import { DECISION_MODEL_PILOT_KUSEN } from '../src/lib/product-decision/pilot-kusen.ts';

function parseWranglerJson(raw) {
  const jsonStart = raw.indexOf('[');
  const jsonEnd = raw.lastIndexOf(']');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    return JSON.parse(raw.substring(jsonStart, jsonEnd + 1));
  }
  return JSON.parse(raw);
}

async function verifyProductionParity() {
  console.log('================================================================');
  console.log('RancangLoka PDE Production Round-Trip & Parity Verification');
  console.log('================================================================');

  const cmd = `npx wrangler d1 execute rancangloka_db --remote --json --command "SELECT * FROM decision_models WHERE version_key = 'model_pde_kusen_tropis@v1.0.0@crit_kusen_v1'"`;
  const raw = execSync(cmd, { encoding: 'utf8', maxBuffer: 25 * 1024 * 1024 });
  const parsed = parseWranglerJson(raw);
  const row = parsed[0]?.results?.[0];

  if (!row) {
    throw new Error('PRODUCTION_ROW_NOT_FOUND: Failed to read back model row from production D1.');
  }

  console.log('Successfully fetched model row from remote D1.');

  // Deserialize using canonical store deserializer
  const reconstructedModel = deserializeDecisionModel(row);

  console.log('\n[Model Reconstruction & Identity Checks]');
  console.log(`- Solution classes : ${reconstructedModel.solution_classes.length} (expected 2)`);
  console.log(`- Criteria         : ${reconstructedModel.criteria.length} (expected 7)`);
  console.log(`- Constraints      : ${reconstructedModel.constraints.length} (expected 3)`);
  console.log(`- Evaluations      : ${reconstructedModel.evaluations.length} (expected 14)`);
  console.log(`- Scenarios        : ${reconstructedModel.scenarios.length} (expected 5)`);
  const evidenceBindings = JSON.parse(row.evidence_bindings_json);
  console.log(`- Evidence Bindings: ${evidenceBindings.length} (expected 4)`);

  if (reconstructedModel.solution_classes.length !== 2) throw new Error('Solution classes count mismatch');
  if (reconstructedModel.criteria.length !== 7) throw new Error('Criteria count mismatch');
  if (reconstructedModel.constraints.length !== 3) throw new Error('Constraints count mismatch');
  if (reconstructedModel.evaluations.length !== 14) throw new Error('Evaluations count mismatch');
  if (reconstructedModel.scenarios.length !== 5) throw new Error('Scenarios count mismatch');
  if (evidenceBindings.length !== 4) throw new Error('Evidence bindings count mismatch');

  // Exact ID sets validation
  const expectedCriterionIds = [
    'crit_thermal_insulation',
    'crit_structural_rigidity',
    'crit_corner_water_tightness',
    'crit_acoustic_attenuation',
    'crit_coastal_corrosion_resistance',
    'crit_thermal_expansion_stability',
    'crit_slim_sightlines'
  ];
  const actualCriterionIds = reconstructedModel.criteria.map(c => c.criterion_id);
  if (JSON.stringify(actualCriterionIds) !== JSON.stringify(expectedCriterionIds)) {
    throw new Error(`CRITERION_ID_MISMATCH: expected ${JSON.stringify(expectedCriterionIds)}, got ${JSON.stringify(actualCriterionIds)}`);
  }
  console.log('  ✓ 7 Canonical Criterion IDs: 100% MATCH');

  const expectedSolutionIds = ['sol_aluminium_standar', 'sol_upvc_multi_chamber'];
  const actualSolutionIds = reconstructedModel.solution_classes.map(s => s.solution_id);
  if (JSON.stringify(actualSolutionIds) !== JSON.stringify(expectedSolutionIds)) {
    throw new Error(`SOLUTION_ID_MISMATCH: expected ${JSON.stringify(expectedSolutionIds)}, got ${JSON.stringify(actualSolutionIds)}`);
  }
  console.log('  ✓ 2 Solution IDs: 100% MATCH');

  const expectedConstraintIds = [
    'c_massive_opening_rigidity',
    'c_west_afternoon_heat_bedroom',
    'c_tight_initial_budget'
  ];
  const actualConstraintIds = reconstructedModel.constraints.map(c => c.constraint_id);
  if (JSON.stringify(actualConstraintIds) !== JSON.stringify(expectedConstraintIds)) {
    throw new Error(`CONSTRAINT_ID_MISMATCH: expected ${JSON.stringify(expectedConstraintIds)}, got ${JSON.stringify(actualConstraintIds)}`);
  }
  console.log('  ✓ 3 Constraint IDs: 100% MATCH');

  const { computeModelPayloadHash } = await import('../src/lib/product-decision/store.ts');
  const recomputedHash = computeModelPayloadHash(reconstructedModel);
  if (recomputedHash !== '1b7c9a2024cbc422015e3612a04077d47922f5dcf8a4d2dced5a309e89bfe9a0') {
    throw new Error(`PAYLOAD_HASH_MISMATCH: recomputed ${recomputedHash}`);
  }
  console.log('  ✓ Recomputed Payload Hash: 100% MATCH (1b7c9a2024cbc422015e3612a04077d47922f5dcf8a4d2dced5a309e89bfe9a0)');
  console.log('>> MODEL IDENTITY PARITY: PASS');

  console.log('\n[Scenario Decision Parity Verification]');
  for (let i = 0; i < DECISION_MODEL_PILOT_KUSEN.scenarios.length; i++) {
    const fixtureScenario = DECISION_MODEL_PILOT_KUSEN.scenarios[i];
    const reconScenario = reconstructedModel.scenarios[i];

    const baselineResult = evaluateDecision(DECISION_MODEL_PILOT_KUSEN, fixtureScenario.context);
    const reconResult = evaluateDecision(reconstructedModel, reconScenario.context);

    console.log(`\nScenario ${i + 1}: ${fixtureScenario.scenario_id}`);
    console.log(`  Title              : ${fixtureScenario.title}`);
    console.log(`  Baseline Rec       : ${baselineResult.recommendation.recommended_solution_id} (${baselineResult.recommendation.recommended_fit})`);
    console.log(`  Reconstructed Rec  : ${reconResult.recommendation.recommended_solution_id} (${reconResult.recommendation.recommended_fit})`);
    console.log(`  Alternative        : ${reconResult.recommendation.alternative_solution_id} (${reconResult.recommendation.alternative_fit})`);

    // Verify recommendations
    if (baselineResult.recommendation.recommended_solution_id !== reconResult.recommendation.recommended_solution_id) {
      throw new Error(`PARITY_MISMATCH in scenario ${fixtureScenario.scenario_id}: recommended_solution_id`);
    }
    if (baselineResult.recommendation.recommended_fit !== reconResult.recommendation.recommended_fit) {
      throw new Error(`PARITY_MISMATCH in scenario ${fixtureScenario.scenario_id}: recommended_fit`);
    }
    if (baselineResult.recommendation.alternative_solution_id !== reconResult.recommendation.alternative_solution_id) {
      throw new Error(`PARITY_MISMATCH in scenario ${fixtureScenario.scenario_id}: alternative_solution_id`);
    }
    if (baselineResult.recommendation.alternative_fit !== reconResult.recommendation.alternative_fit) {
      throw new Error(`PARITY_MISMATCH in scenario ${fixtureScenario.scenario_id}: alternative_fit`);
    }

    // Verify byte-level deep equality
    if (JSON.stringify(baselineResult) !== JSON.stringify(reconResult)) {
      throw new Error(`PARITY_MISMATCH: Deep equality failed in scenario ${fixtureScenario.scenario_id}`);
    }
    console.log(`  Parity Status      : 100% IDENTICAL DEEP-EQUALITY PASS`);
  }

  console.log('\n================================================================');
  console.log('ALL 5 CANONICAL SCENARIOS ACHIEVED 100% PRODUCTION PARITY PASS!');
  console.log('================================================================');
}

verifyProductionParity().catch(err => {
  console.error('[PARITY_FAILURE]', err);
  process.exit(1);
});
