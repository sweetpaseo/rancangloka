/**
 * ============================================================================
 * RancangLoka Product Decision Engine (PRODUCT_DECISION_ENGINE-1C)
 * Admin & Editorial Decision Inspection Suite (Acceptance Hardening)
 *
 * Requirements (A to I + Section 26 + PDE-1A/1B Regressions):
 * A. Admin metadata criteria_version equals imported model.criteria_version.
 * B. Canonical criteria_version is crit_kusen_v1.
 * C. problem_goal uses controlled selector, not arbitrary free-text input.
 * D. Forged invalid problem_goal is rejected.
 * E. Forged invalid values for every CORE taxonomy field are rejected.
 * F. Valid canonical scenario preset values still evaluate correctly.
 * G. No expected recommendation data reaches evaluator (SCENARIO_PRESET_IS_CONTEXT_ONLY).
 * H. No numeric score UI.
 * I. No commerce fields.
 *
 * Section 26 Acceptance Fixtures:
 * 1. west-facing master bedroom -> uPVC -> STRONG_FIT
 * 2. large living sliding door -> aluminium -> STRONG_FIT
 * 3. coastal rain-exposed facade -> uPVC -> STRONG_FIT
 * 4. tight-budget renovation -> aluminium -> GOOD_FIT_WITH_TRADEOFF
 * 5. low-maintenance family home -> uPVC -> GOOD_FIT_WITH_TRADEOFF
 * ============================================================================
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import {
  DECISION_MODEL_PILOT_KUSEN,
  SCENARIOS_PILOT,
  ARTICLE_5_EVIDENCE_BASE
} from '../src/lib/product-decision/pilot-kusen.ts';
import {
  getCanonicalScenarioPresets,
  getPresetContext,
  parseDecisionContextFromParams,
  runDecisionInspection,
  FIT_LABELS_ID,
  CLAIM_CLASS_LABELS_ID,
  SOLUTION_LABELS_ID,
  PROBLEM_GOAL_OPTIONS,
  ALLOWED_PROBLEM_GOALS,
  BUILDING_CONTEXT_OPTIONS,
  ALLOWED_BUILDING_CONTEXTS,
  CLIMATE_EXPOSURE_OPTIONS,
  ALLOWED_CLIMATE_EXPOSURES,
  APPLICATION_LOCATION_OPTIONS,
  ALLOWED_APPLICATION_LOCATIONS,
  BUDGET_CLASS_OPTIONS,
  ALLOWED_BUDGET_CLASSES,
  MAINTENANCE_TOLERANCE_OPTIONS,
  ALLOWED_MAINTENANCE_TOLERANCES
} from '../src/lib/product-decision/admin-inspector.ts';
import { evaluateDecision } from '../src/lib/product-decision/evaluator.ts';
import { scanForForbiddenFields } from '../src/lib/product-decision/contracts.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT_DIR = resolve(__dirname, '..');

// Helper to read source files
function readRepoFile(relPath) {
  const fullPath = join(ROOT_DIR, relPath);
  assert.ok(existsSync(fullPath), `File must exist: ${relPath}`);
  return readFileSync(fullPath, 'utf8');
}

// ----------------------------------------------------------------------------
// TEST A & B: Criteria Version Source of Truth & Model Metadata
// Invariant: ADMIN_METADATA_MUST_RENDER_MODEL_SOURCE_TRUTH
// ----------------------------------------------------------------------------
test('PDE-1C [Test A & B]: Admin metadata criteria_version strictly equals model.criteria_version (crit_kusen_v1)', () => {
  const astroPage = readRepoFile('src/pages/admin/decisions.astro');

  // Verify imported source value directly
  assert.equal(
    DECISION_MODEL_PILOT_KUSEN.criteria_version,
    'crit_kusen_v1',
    'DECISION_MODEL_PILOT_KUSEN.criteria_version must be exactly crit_kusen_v1'
  );
  assert.equal(
    DECISION_MODEL_PILOT_KUSEN.model_id,
    'model_pde_kusen_tropis',
    'DECISION_MODEL_PILOT_KUSEN.model_id must be model_pde_kusen_tropis'
  );

  // Invariant: UI dynamically renders model.criteria_version without hardcoded strings
  assert.match(
    astroPage,
    /\{DECISION_MODEL_PILOT_KUSEN\.criteria_version\}/,
    'Astro UI must directly interpolate DECISION_MODEL_PILOT_KUSEN.criteria_version'
  );
  assert.doesNotMatch(
    astroPage,
    /Kriteria:\s*<strong[^>]*>v1\.0\.0<\/strong>/,
    'Astro UI must not render hardcoded v1.0.0 for criteria version'
  );
});

// ----------------------------------------------------------------------------
// TEST C: problem_goal uses controlled selector, NOT free-text input
// Invariant: EVALUATOR_CRITICAL_CONTEXT_MUST_USE_CONTROLLED_TAXONOMY
// ----------------------------------------------------------------------------
test('PDE-1C [Test C]: problem_goal uses controlled <select> populated from PROBLEM_GOAL_OPTIONS, not free text', () => {
  const astroPage = readRepoFile('src/pages/admin/decisions.astro');

  // Must have a <select name="problem_goal">
  assert.match(
    astroPage,
    /<select[^>]*name="problem_goal"[^>]*>/,
    'UI must render a controlled <select> for problem_goal'
  );

  // Must NOT have <input name="problem_goal">
  assert.doesNotMatch(
    astroPage,
    /<input[^>]*name="problem_goal"[^>]*>/,
    'UI must NOT permit arbitrary <input> for problem_goal'
  );

  // Must be populated from canonical options
  assert.match(
    astroPage,
    /PROBLEM_GOAL_OPTIONS\.map/,
    'Select options must map over PROBLEM_GOAL_OPTIONS'
  );
  assert.equal(PROBLEM_GOAL_OPTIONS.length, 5, 'Must have 5 canonical problem goals matching pilot scenarios');
});

// ----------------------------------------------------------------------------
// TEST D: Forged invalid problem_goal is rejected by server-side validation
// ----------------------------------------------------------------------------
test('PDE-1C [Test D]: Forged invalid problem_goal is rejected at server parse and evaluation gate', () => {
  const baseValidParams = {
    problem_goal: 'Mereduksi panas radiasi sore dan kebisingan lingkungan pada kamar tidur ber-AC',
    building_context: 'MULTI_STORY_HOUSE',
    climate_exposure: 'WEST_AFTERNOON_HEAT',
    application_location: 'MASTER_BEDROOM',
    budget_class: 'BALANCED_MID',
    maintenance_tolerance: 'FIT_AND_FORGET'
  };

  // 1. Manually forged query with bogus problem_goal
  const forgedParams = new URLSearchParams({
    ...baseValidParams,
    problem_goal: 'totally_invalid_free_text_value_12345'
  });

  const parsed = parseDecisionContextFromParams(forgedParams);
  assert.equal(parsed.valid, false, 'parseDecisionContextFromParams must return valid: false for forged problem_goal');
  assert.ok(parsed.validationErrors.some(e => e.field === 'problem_goal'));

  // 2. runDecisionInspection must reject it and return typed INVALID_CONTEXT
  const evalResult = runDecisionInspection(parsed);
  assert.equal(evalResult.ok, false, 'runDecisionInspection must return ok: false for invalid context');
  assert.equal(evalResult.status, 'INVALID_CONTEXT');
  assert.ok(evalResult.issues.some(iss => iss.field === 'problem_goal'));

  // 3. Direct context with invalid problem_goal passed directly must also be blocked
  const directContext = {
    ...baseValidParams,
    problem_goal: 'arbitrary_unapproved_goal'
  };
  const directResult = runDecisionInspection(directContext);
  assert.equal(directResult.ok, false);
  assert.equal(directResult.status, 'INVALID_CONTEXT');
});

// ----------------------------------------------------------------------------
// TEST E: Forged invalid values for EVERY CORE taxonomy field are rejected
// ----------------------------------------------------------------------------
test('PDE-1C [Test E]: Forged invalid values for every single CORE dimension are rejected at server gate', () => {
  const baseValidParams = {
    problem_goal: 'Mereduksi panas radiasi sore dan kebisingan lingkungan pada kamar tidur ber-AC',
    building_context: 'MULTI_STORY_HOUSE',
    climate_exposure: 'WEST_AFTERNOON_HEAT',
    application_location: 'MASTER_BEDROOM',
    budget_class: 'BALANCED_MID',
    maintenance_tolerance: 'FIT_AND_FORGET'
  };

  const fieldsToTest = [
    { field: 'building_context', invalidVal: 'TREEHOUSE_SKYSCRAPER' },
    { field: 'climate_exposure', invalidVal: 'ARCTIC_BLIZZARD' },
    { field: 'application_location', invalidVal: 'UNDERGROUND_BUNKER' },
    { field: 'budget_class', invalidVal: 'UNLIMITED_TRILLIONAIRE' },
    { field: 'maintenance_tolerance', invalidVal: 'ZERO_SECOND_LIFETIME' }
  ];

  for (const { field, invalidVal } of fieldsToTest) {
    const forged = new URLSearchParams({
      ...baseValidParams,
      [field]: invalidVal
    });

    const parsed = parseDecisionContextFromParams(forged);
    assert.equal(parsed.valid, false, `Field ${field} with invalid value '${invalidVal}' must fail parsing`);
    assert.ok(
      parsed.validationErrors.some(e => e.field === field),
      `Validation errors must cite field ${field}`
    );

    const evalResult = runDecisionInspection(parsed);
    assert.equal(evalResult.ok, false);
    assert.equal(evalResult.status, 'INVALID_CONTEXT');
    assert.ok(evalResult.issues.some(iss => iss.field === field));
  }
});

// ----------------------------------------------------------------------------
// TEST F & G: Valid canonical scenario preset values evaluate correctly & No expected recommendation reaches evaluator
// Invariant: SCENARIO_PRESET_IS_CONTEXT_ONLY
// ----------------------------------------------------------------------------
test('PDE-1C [Test F & G]: Presets populate context only; zero oracle expectation reaches evaluator', () => {
  const presets = getCanonicalScenarioPresets();
  assert.equal(presets.length, 5, 'Must provide all 5 canonical scenarios');

  for (const preset of presets) {
    const rawContext = getPresetContext(preset.scenario_id);
    assert.ok(rawContext, `Preset ${preset.scenario_id} must resolve to context`);

    // Invariant: Context contains strictly input dimensions
    assert.ok(rawContext.problem_goal, 'Context must have problem_goal');
    assert.ok(rawContext.building_context, 'Context must have building_context');
    assert.ok(rawContext.climate_exposure, 'Context must have climate_exposure');
    assert.ok(rawContext.application_location, 'Context must have application_location');
    assert.ok(rawContext.budget_class, 'Context must have budget_class');
    assert.ok(rawContext.maintenance_tolerance, 'Context must have maintenance_tolerance');

    // Invariant: Context MUST NOT have scenario_id or oracle expectations
    assert.equal(rawContext.scenario_id, undefined, 'Context must NOT contain scenario_id');
    assert.equal(rawContext.expected_recommendation, undefined, 'Context must NOT contain expected_recommendation');
    assert.equal(rawContext.expected_fit, undefined, 'Context must NOT contain expected_fit');

    // Evaluator must run cleanly on this pure context
    const res = runDecisionInspection(rawContext);
    assert.equal(res.ok, true, `Evaluation on preset ${preset.scenario_id} must succeed`);
    assert.equal(res.status, 'RECOMMENDED');
  }
});

// ----------------------------------------------------------------------------
// TEST H: No numeric score UI
// ----------------------------------------------------------------------------
test('PDE-1C [Test H]: Qualitative fit labels exist in Indonesian; zero numeric scoring or fake precision', () => {
  assert.equal(FIT_LABELS_ID.STRONG_FIT.label, 'Sangat Cocok');
  assert.equal(FIT_LABELS_ID.GOOD_FIT_WITH_TRADEOFF.label, 'Cocok dengan Kompromi');
  assert.equal(FIT_LABELS_ID.CONDITIONAL_FIT.label, 'Cocok dengan Syarat');
  assert.equal(FIT_LABELS_ID.POOR_FIT.label, 'Kurang Cocok');

  const astroPage = readRepoFile('src/pages/admin/decisions.astro');
  assert.match(astroPage, /FIT_LABELS_ID/);

  // Assert zero percentage bars, ratings, or scores
  assert.doesNotMatch(astroPage, /\d+%\s*cocok/i);
  assert.doesNotMatch(astroPage, /\/10\s*bintang/i);
  assert.doesNotMatch(astroPage, /winner\s*badge/i);
  assert.doesNotMatch(astroPage, /skor\s*:/i);
});

// ----------------------------------------------------------------------------
// TEST I: No commerce fields
// ----------------------------------------------------------------------------
test('PDE-1C [Test I]: Zero commercial/affiliate/merchant fields exist in UI or helper modules', () => {
  const astroPage = readRepoFile('src/pages/admin/decisions.astro');
  const helperModule = readRepoFile('src/lib/product-decision/admin-inspector.ts');

  const forbiddenTerms = [
    'affiliate_url',
    'affiliate',
    'commission',
    'merchant',
    'sponsored',
    'price',
    'sku',
    'product_listing'
  ];

  for (const term of forbiddenTerms) {
    assert.doesNotMatch(astroPage, new RegExp(`name=["']${term}["']`, 'i'), `Forbidden form field: ${term}`);
  }

  assert.equal(scanForForbiddenFields(FIT_LABELS_ID).length, 0);
  assert.equal(scanForForbiddenFields(CLAIM_CLASS_LABELS_ID).length, 0);
  assert.equal(scanForForbiddenFields(PROBLEM_GOAL_OPTIONS).length, 0);
});

// ----------------------------------------------------------------------------
// ADDITIONAL ENGINE & ADMIN SAFETY VERIFICATIONS
// ----------------------------------------------------------------------------
test('PDE-1C [Admin Structure]: Admin decision route exists and integrates AdminLayout', () => {
  const astroPage = readRepoFile('src/pages/admin/decisions.astro');
  assert.match(astroPage, /import AdminLayout from '\.\.\/\.\.\/layouts\/AdminLayout\.astro'/);
  assert.match(astroPage, /Cache-Control['"],\s*['"]no-store,\s*private['"]/);
  assert.match(astroPage, /X-Robots-Tag['"],\s*['"]noindex,\s*nofollow/);
});

test('PDE-1C [Evidence Freshness]: Stale or unavailable evidence blocks normal recommendation display', () => {
  const baseContext = getPresetContext('scen_west_facing_master_bedroom');

  // 1. Current mode -> SUCCESS
  const resCurrent = runDecisionInspection(baseContext, 'current');
  assert.equal(resCurrent.ok, true);
  assert.equal(resCurrent.status, 'RECOMMENDED');

  // 2. Drift mode -> BLOCKED (NEEDS_RECALIBRATION)
  const resDrift = runDecisionInspection(baseContext, 'drift');
  assert.equal(resDrift.ok, false);
  assert.equal(resDrift.status, 'EVALUATION_BLOCKED_EVIDENCE_STALE');

  // 3. Unavailable mode -> BLOCKED (EVIDENCE_UNAVAILABLE)
  const resUnavailable = runDecisionInspection(baseContext, 'unavailable');
  assert.equal(resUnavailable.ok, false);
  assert.equal(resUnavailable.status, 'EVALUATION_BLOCKED_EVIDENCE_UNAVAILABLE');

  // UI must render blocked alert banner
  const astroPage = readRepoFile('src/pages/admin/decisions.astro');
  assert.match(astroPage, /!result\.ok/);
  assert.match(astroPage, /EVALUASI DIBLOKIR/);
});

test('PDE-1C [Canonical Evidence Hash]: Snapshot hash strictly equals eed64da134be1b158d0a2985e3b43196f486eb4b86dd1fd9e95a5580655b3eed', () => {
  assert.equal(
    DECISION_MODEL_PILOT_KUSEN.evidence_snapshot_hash,
    'eed64da134be1b158d0a2985e3b43196f486eb4b86dd1fd9e95a5580655b3eed'
  );
  assert.equal(ARTICLE_5_EVIDENCE_BASE.article_id, 5);
  assert.equal(ARTICLE_5_EVIDENCE_BASE.source_fidelity, 'NORMALIZED_HASH_VERIFIED');
});

// ----------------------------------------------------------------------------
// SECTION 26: MANUAL ACCEPTANCE FIXTURES (All 5 Canonical Scenarios)
// ----------------------------------------------------------------------------
test('PDE-1C [Section 26]: All 5 canonical scenarios reproduce exact expected evaluator decisions', () => {
  const testCases = [
    {
      id: 'scen_west_facing_master_bedroom',
      expectedSolution: 'sol_upvc_multi_chamber',
      expectedFit: 'STRONG_FIT'
    },
    {
      id: 'scen_large_living_sliding_door',
      expectedSolution: 'sol_aluminium_standar',
      expectedFit: 'STRONG_FIT'
    },
    {
      id: 'scen_coastal_rain_exposed_facade',
      expectedSolution: 'sol_upvc_multi_chamber',
      expectedFit: 'STRONG_FIT'
    },
    {
      id: 'scen_tight_budget_standard_renovation',
      expectedSolution: 'sol_aluminium_standar',
      expectedFit: 'GOOD_FIT_WITH_TRADEOFF'
    },
    {
      id: 'scen_low_maintenance_family_home',
      expectedSolution: 'sol_upvc_multi_chamber',
      expectedFit: 'GOOD_FIT_WITH_TRADEOFF'
    }
  ];

  for (const tc of testCases) {
    const searchParams = new URLSearchParams({ scenario: tc.id });
    const parseResult = parseDecisionContextFromParams(searchParams);

    assert.equal(parseResult.valid, true);
    assert.equal(parseResult.selectedScenarioId, tc.id);
    assert.equal(parseResult.evidenceMode, 'current');

    // Invariant: Verify context does NOT contain oracle fields
    assert.equal(parseResult.context.expected_recommendation, undefined);
    assert.equal(parseResult.context.scenario_id, undefined);

    // Evaluate raw context
    const res = runDecisionInspection(parseResult);
    assert.equal(res.ok, true, `Scenario ${tc.id} must evaluate ok: true`);
    assert.equal(res.status, 'RECOMMENDED');
    assert.equal(res.recommendation.recommended_solution_id, tc.expectedSolution, `Scenario ${tc.id} must recommend ${tc.expectedSolution}`);
    assert.equal(res.recommendation.recommended_fit, tc.expectedFit, `Scenario ${tc.id} fit must match ${tc.expectedFit}`);

    // Verify 3 Golden Questions are populated
    assert.ok(res.recommendation.why_recommended.length > 20);
    assert.ok(res.recommendation.why_not_alternative.length > 20);
    assert.ok(res.recommendation.pivot_conditions.length > 0);
  }
});

// ----------------------------------------------------------------------------
// REGRESSION: PDE-1A & PDE-1B Test Suites
// ----------------------------------------------------------------------------
test('PDE-1C [Regression]: Existing PDE-1A contract test suite passes cleanly', () => {
  const output = execSync('node scripts/test-product-decision-engine-contract.js', {
    cwd: ROOT_DIR,
    encoding: 'utf8'
  });
  assert.match(output, /14 passed,\s*0 failed/);
});

test('PDE-1C [Regression]: Existing PDE-1B evaluator test suite passes cleanly', () => {
  const output = execSync('node scripts/test-product-decision-engine-evaluator.js', {
    cwd: ROOT_DIR,
    encoding: 'utf8'
  });
  assert.match(output, /22 passed,\s*0 failed/);
});
