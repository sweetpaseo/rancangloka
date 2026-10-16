/**
 * ============================================================================
 * RancangLoka Product Decision Engine (PRODUCT_DECISION_ENGINE-1C)
 * Admin & Editorial Decision Inspection Suite
 *
 * Requirements (A to R):
 * A. Admin decision route/module exists.
 * B. Uses DECISION_MODEL_PILOT_KUSEN.
 * C. Uses evaluateDecision() rather than duplicate logic.
 * D. Scenario presets populate context only.
 * E. No expected_recommendation field reaches evaluator.
 * F. All six CORE context fields represented.
 * G. Recommendation displays qualitative fit only.
 * H. Three Golden Questions represented.
 * I. HARD/SOFT trace represented.
 * J. Criterion evidence represented.
 * K. Evidence identity represented.
 * L. Source fidelity NORMALIZED_HASH_VERIFIED shown correctly.
 * M. Evidence stale/unavailable states handled.
 * N. No affiliate/merchant/price/commission fields.
 * O. Admin cache/auth safety preserved.
 * P. No numeric overall score UI.
 * Q. Existing PDE-1A suite passes.
 * R. Existing PDE-1B evaluator suite passes.
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
  BUILDING_CONTEXT_OPTIONS,
  CLIMATE_EXPOSURE_OPTIONS,
  APPLICATION_LOCATION_OPTIONS,
  BUDGET_CLASS_OPTIONS,
  MAINTENANCE_TOLERANCE_OPTIONS
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
// TEST A: Admin decision route/module exists
// ----------------------------------------------------------------------------
test('PDE-1C [Test A]: Admin decision route and inspection modules exist', () => {
  const astroPage = readRepoFile('src/pages/admin/decisions.astro');
  const helperModule = readRepoFile('src/lib/product-decision/admin-inspector.ts');

  assert.ok(astroPage.length > 500, 'src/pages/admin/decisions.astro must contain complete inspection UI');
  assert.ok(helperModule.length > 500, 'src/lib/product-decision/admin-inspector.ts must contain helper logic');
});

// ----------------------------------------------------------------------------
// TEST B: Uses DECISION_MODEL_PILOT_KUSEN
// ----------------------------------------------------------------------------
test('PDE-1C [Test B]: Admin inspection uses canonical DECISION_MODEL_PILOT_KUSEN', () => {
  const astroPage = readRepoFile('src/pages/admin/decisions.astro');
  const helperModule = readRepoFile('src/lib/product-decision/admin-inspector.ts');

  assert.match(astroPage, /DECISION_MODEL_PILOT_KUSEN/);
  assert.match(helperModule, /DECISION_MODEL_PILOT_KUSEN/);
  assert.equal(DECISION_MODEL_PILOT_KUSEN.model_id, 'model_pde_kusen_tropis');
});

// ----------------------------------------------------------------------------
// TEST C: Uses evaluateDecision() rather than duplicate logic
// ----------------------------------------------------------------------------
test('PDE-1C [Test C]: Uses pure evaluateDecision() directly without duplicate recommendation logic', () => {
  const helperModule = readRepoFile('src/lib/product-decision/admin-inspector.ts');
  const astroPage = readRepoFile('src/pages/admin/decisions.astro');

  assert.match(helperModule, /import\s+{[^}]*evaluateDecision[^}]*}\s+from\s+['"]\.\/evaluator\.ts['"]/);
  assert.match(helperModule, /evaluateDecision\(model,\s*context,\s*options\)/);

  // Invariant: UI does NOT do ad-hoc if-statements to decide winner
  assert.doesNotMatch(astroPage, /if\s*\(.*climate_exposure.*===.*WEST_AFTERNOON_HEAT.*\)\s*\{/);
  assert.doesNotMatch(astroPage, /if\s*\(.*sol_upvc_multi_chamber.*\)\s*recommend/);
});

// ----------------------------------------------------------------------------
// TEST D & E: Scenario presets populate context only (SCENARIO_PRESET_IS_CONTEXT_ONLY)
// ----------------------------------------------------------------------------
test('PDE-1C [Test D & E]: Presets strictly populate context only; zero oracle expectation reaches evaluator', () => {
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
// TEST F: All six CORE context fields represented
// ----------------------------------------------------------------------------
test('PDE-1C [Test F]: All six CORE context dimensions are fully represented in controls & parser', () => {
  const astroPage = readRepoFile('src/pages/admin/decisions.astro');

  const coreFields = [
    'problem_goal',
    'building_context',
    'climate_exposure',
    'application_location',
    'budget_class',
    'maintenance_tolerance'
  ];

  for (const field of coreFields) {
    assert.match(astroPage, new RegExp(`name="${field}"`), `Form must contain field ${field}`);
  }

  // Check options counts
  assert.equal(BUILDING_CONTEXT_OPTIONS.length, 4);
  assert.equal(CLIMATE_EXPOSURE_OPTIONS.length, 4);
  assert.equal(APPLICATION_LOCATION_OPTIONS.length, 4);
  assert.equal(BUDGET_CLASS_OPTIONS.length, 3);
  assert.equal(MAINTENANCE_TOLERANCE_OPTIONS.length, 2);
});

// ----------------------------------------------------------------------------
// TEST G: Recommendation displays qualitative fit only
// ----------------------------------------------------------------------------
test('PDE-1C [Test G]: Qualitative fit labels exist in Indonesian; zero numeric scoring', () => {
  assert.equal(FIT_LABELS_ID.STRONG_FIT.label, 'Sangat Cocok');
  assert.equal(FIT_LABELS_ID.GOOD_FIT_WITH_TRADEOFF.label, 'Cocok dengan Kompromi');
  assert.equal(FIT_LABELS_ID.CONDITIONAL_FIT.label, 'Cocok dengan Syarat');
  assert.equal(FIT_LABELS_ID.POOR_FIT.label, 'Kurang Cocok');

  const astroPage = readRepoFile('src/pages/admin/decisions.astro');
  assert.match(astroPage, /FIT_LABELS_ID/);
});

// ----------------------------------------------------------------------------
// TEST H: Three Golden Questions represented
// ----------------------------------------------------------------------------
test('PDE-1C [Test H]: Three Golden Questions are prominently displayed', () => {
  const astroPage = readRepoFile('src/pages/admin/decisions.astro');

  assert.match(astroPage, /1\.\s*Mengapa Opsi Ini\?/);
  assert.match(astroPage, /2\.\s*Mengapa Bukan Alternatifnya\?/);
  assert.match(astroPage, /3\.\s*Kondisi Apa yang Dapat Mengubah Rekomendasi\?\s*\(Pivot Conditions\)/);

  assert.match(astroPage, /why_recommended/);
  assert.match(astroPage, /why_not_alternative/);
  assert.match(astroPage, /pivot_conditions/);
});

// ----------------------------------------------------------------------------
// TEST I: HARD/SOFT constraint trace represented
// ----------------------------------------------------------------------------
test('PDE-1C [Test I]: HARD and SOFT constraint traces are distinctly rendered', () => {
  const astroPage = readRepoFile('src/pages/admin/decisions.astro');

  assert.match(astroPage, /HARD CONSTRAINTS/);
  assert.match(astroPage, /SOFT CONSTRAINTS/);
  assert.match(astroPage, /hard_constraint_results/);
  assert.match(astroPage, /soft_constraint_results/);
  assert.match(astroPage, /disqualified_solution_ids/);
});

// ----------------------------------------------------------------------------
// TEST J: Criterion evidence represented
// ----------------------------------------------------------------------------
test('PDE-1C [Test J]: Criterion evaluations, factual basis, and claim classes are rendered in trace table', () => {
  const astroPage = readRepoFile('src/pages/admin/decisions.astro');

  assert.match(astroPage, /criterion_results/);
  assert.match(astroPage, /qualitative_tier/);
  assert.match(astroPage, /factual_basis/);
  assert.match(astroPage, /claim_class/);
  assert.match(astroPage, /CLAIM_CLASS_LABELS_ID/);
});

// ----------------------------------------------------------------------------
// TEST K & L: Evidence identity and source fidelity
// ----------------------------------------------------------------------------
test('PDE-1C [Test K & L]: Evidence identity matches Article 5 and NORMALIZED_HASH_VERIFIED', () => {
  const astroPage = readRepoFile('src/pages/admin/decisions.astro');

  assert.equal(ARTICLE_5_EVIDENCE_BASE.article_id, 5);
  assert.equal(ARTICLE_5_EVIDENCE_BASE.publication_version_key, 'receipt:rcpt_bbae85b48e1b2f8d');
  assert.equal(ARTICLE_5_EVIDENCE_BASE.published_content_hash, '14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277');
  assert.equal(ARTICLE_5_EVIDENCE_BASE.source_fidelity, 'NORMALIZED_HASH_VERIFIED');

  assert.match(astroPage, /ARTICLE_5_EVIDENCE_BASE\.article_id/);
  assert.match(astroPage, /ARTICLE_5_EVIDENCE_BASE\.publication_version_key/);
  assert.match(astroPage, /ARTICLE_5_EVIDENCE_BASE\.published_content_hash/);
  assert.match(astroPage, /ARTICLE_5_EVIDENCE_BASE\.source_fidelity/);
  assert.match(astroPage, /Bukan BYTE_EXACT/);
});

// ----------------------------------------------------------------------------
// TEST M: Evidence stale/unavailable states handled (fail-safe gate)
// ----------------------------------------------------------------------------
test('PDE-1C [Test M]: Stale or unavailable evidence blocks normal recommendation', () => {
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

// ----------------------------------------------------------------------------
// TEST N & P: Commercial firewall & zero fake precision
// ----------------------------------------------------------------------------
test('PDE-1C [Test N & P]: Zero commercial/affiliate/merchant fields; zero numeric overall score', () => {
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
    // Assert no form inputs or bindings for these
    assert.doesNotMatch(astroPage, new RegExp(`name=["']${term}["']`, 'i'), `Forbidden form field: ${term}`);
  }

  // Check forbidden fields scanner on helper exports
  assert.equal(scanForForbiddenFields(FIT_LABELS_ID).length, 0);
  assert.equal(scanForForbiddenFields(CLAIM_CLASS_LABELS_ID).length, 0);

  // Assert no numeric fake precision percentages or star ratings
  assert.doesNotMatch(astroPage, /\d+%\s*cocok/i);
  assert.doesNotMatch(astroPage, /\/10\s*bintang/i);
  assert.doesNotMatch(astroPage, /winner\s*badge/i);
});

// ----------------------------------------------------------------------------
// TEST O: Admin cache & auth safety preserved
// ----------------------------------------------------------------------------
test('PDE-1C [Test O]: Admin cache-control and private headers enforced', () => {
  const astroPage = readRepoFile('src/pages/admin/decisions.astro');
  const middlewareSrc = readRepoFile('src/middleware.ts');

  assert.match(astroPage, /Cache-Control['"],\s*['"]no-store,\s*private['"]/);
  assert.match(astroPage, /X-Robots-Tag['"],\s*['"]noindex,\s*nofollow/);

  // Middleware covers /admin and /admin/decisions
  assert.match(middlewareSrc, /pathname\.startsWith\('\/admin'\)/);
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
    // 1. Simulate query params loading via helper
    const searchParams = new URLSearchParams({ scenario: tc.id });
    const { context, selectedScenarioId, evidenceMode } = parseDecisionContextFromParams(searchParams);

    assert.equal(selectedScenarioId, tc.id);
    assert.equal(evidenceMode, 'current');

    // Invariant: Verify context does NOT contain oracle fields
    assert.equal(context.expected_recommendation, undefined);
    assert.equal(context.scenario_id, undefined);

    // 2. Evaluate raw context
    const res = runDecisionInspection(context, evidenceMode);
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
// TEST Q: Existing PDE-1A suite passes
// ----------------------------------------------------------------------------
test('PDE-1C [Test Q]: Existing PDE-1A contract test suite passes cleanly', () => {
  const output = execSync('node scripts/test-product-decision-engine-contract.js', {
    cwd: ROOT_DIR,
    encoding: 'utf8'
  });
  assert.match(output, /14 passed,\s*0 failed/);
});

// ----------------------------------------------------------------------------
// TEST R: Existing PDE-1B evaluator suite passes
// ----------------------------------------------------------------------------
test('PDE-1C [Test R]: Existing PDE-1B evaluator test suite passes cleanly', () => {
  const output = execSync('node scripts/test-product-decision-engine-evaluator.js', {
    cwd: ROOT_DIR,
    encoding: 'utf8'
  });
  assert.match(output, /22 passed,\s*0 failed/);
});

