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

  console.log('\n[Model Reconstruction Checks]');
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
