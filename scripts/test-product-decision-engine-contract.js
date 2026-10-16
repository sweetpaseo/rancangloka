#!/usr/bin/env node
/**
 * ============================================================================
 * RancangLoka Product Decision Engine Contract Test Suite (PRODUCT_DECISION_ENGINE-1A)
 *
 * Verifies:
 * A. Article 5 pilot model validates successfully.
 * B. Duplicate model/solution IDs fail validation.
 * C. Duplicate solution IDs fail validation.
 * D. Unknown solution references in evaluations/scenarios fail.
 * E. Unknown criterion references in evaluations fail.
 * F. Missing CORE context dimensions fail validation.
 * G. Evidence version key and hash integrity validate against Article 5.
 * H. Article 5 evidence preserves NORMALIZED_HASH_VERIFIED provenance.
 * I. No commerce/affiliate fields exist in contracts or pilot definitions.
 * J. No numeric overall score field exists.
 * K. Fit taxonomy only uses the approved 4 states.
 * L. Evidence snapshot hash is deterministic across input order.
 * M. Changing authoritative evidence hash changes snapshot hash.
 * N. Derived freshness returns NEEDS_RECALIBRATION on evidence drift.
 * O. Pure execution: no mutations, global state, or database access required.
 * ============================================================================
 */

import assert from 'node:assert';
import {
  DECISION_MODEL_PILOT_KUSEN,
  PILOT_EVIDENCE_SNAPSHOT_HASH,
  ARTICLE_5_EVIDENCE_BASE,
  validateDecisionModel,
  validateDecisionContext,
  scanForForbiddenFields,
  computeEvidenceSnapshotHash,
  deriveEvidenceFreshness,
  FIT_TAXONOMY_VALUES,
  FORBIDDEN_CONTRACT_FIELDS
} from '../src/lib/product-decision/index.ts';

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
console.log('RancangLoka Product Decision Engine Contract Test Suite (PDE-1A)');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// Test A: Pilot model validates cleanly
// ----------------------------------------------------------------------------
test('A. Article 5 pilot model validates without errors', () => {
  const result = validateDecisionModel(DECISION_MODEL_PILOT_KUSEN);
  assert.strictEqual(result.valid, true, `Validation failed: ${JSON.stringify(result.issues)}`);
  assert.strictEqual(result.issues.length, 0);
  assert.strictEqual(DECISION_MODEL_PILOT_KUSEN.model_id, 'model_pde_kusen_tropis');
  assert.strictEqual(DECISION_MODEL_PILOT_KUSEN.problem.canonical_slug, 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia');
  assert.strictEqual(DECISION_MODEL_PILOT_KUSEN.solution_classes.length, 2);
  assert.strictEqual(DECISION_MODEL_PILOT_KUSEN.criteria.length, 7);
  assert.strictEqual(DECISION_MODEL_PILOT_KUSEN.scenarios.length, 5);
});

// ----------------------------------------------------------------------------
// Test B & C: Duplicate solution IDs fail
// ----------------------------------------------------------------------------
test('B & C. Duplicate solution IDs fail validation', () => {
  const cloned = JSON.parse(JSON.stringify(DECISION_MODEL_PILOT_KUSEN));
  // Duplicate the first solution
  cloned.solution_classes.push({
    ...cloned.solution_classes[0],
    name: 'Copy of Solution'
  });
  // Recalculate hash so only duplicate triggers issue
  const allBindings = [];
  cloned.evaluations.forEach(e => allBindings.push(e.evidence_binding));
  cloned.solution_classes.forEach(s => s.tradeoffs.forEach(t => allBindings.push(t.evidence_binding)));
  cloned.evidence_snapshot_hash = computeEvidenceSnapshotHash(allBindings);

  const result = validateDecisionModel(cloned);
  assert.strictEqual(result.valid, false);
  const duplicateIssue = result.issues.find(i => i.code === 'DUPLICATE_SOLUTION_ID');
  assert.ok(duplicateIssue, 'Must flag DUPLICATE_SOLUTION_ID');
});

// ----------------------------------------------------------------------------
// Test D: Unknown solution references fail
// ----------------------------------------------------------------------------
test('D. Unknown solution references in evaluations or scenarios fail', () => {
  const cloned = JSON.parse(JSON.stringify(DECISION_MODEL_PILOT_KUSEN));
  cloned.evaluations[0].solution_id = 'sol_non_existent';
  const allBindings = [];
  cloned.evaluations.forEach(e => allBindings.push(e.evidence_binding));
  cloned.solution_classes.forEach(s => s.tradeoffs.forEach(t => allBindings.push(t.evidence_binding)));
  cloned.evidence_snapshot_hash = computeEvidenceSnapshotHash(allBindings);

  const result = validateDecisionModel(cloned);
  assert.strictEqual(result.valid, false);
  const unknownIssue = result.issues.find(i => i.code === 'UNKNOWN_SOLUTION_REFERENCE');
  assert.ok(unknownIssue, 'Must flag UNKNOWN_SOLUTION_REFERENCE');
});

// ----------------------------------------------------------------------------
// Test E: Unknown criterion references fail
// ----------------------------------------------------------------------------
test('E. Unknown criterion references in evaluations fail', () => {
  const cloned = JSON.parse(JSON.stringify(DECISION_MODEL_PILOT_KUSEN));
  cloned.evaluations[0].criterion_id = 'crit_made_up';
  const allBindings = [];
  cloned.evaluations.forEach(e => allBindings.push(e.evidence_binding));
  cloned.solution_classes.forEach(s => s.tradeoffs.forEach(t => allBindings.push(t.evidence_binding)));
  cloned.evidence_snapshot_hash = computeEvidenceSnapshotHash(allBindings);

  const result = validateDecisionModel(cloned);
  assert.strictEqual(result.valid, false);
  const unknownCritIssue = result.issues.find(i => i.code === 'UNKNOWN_CRITERION_REFERENCE');
  assert.ok(unknownCritIssue, 'Must flag UNKNOWN_CRITERION_REFERENCE');
});

// ----------------------------------------------------------------------------
// Test F: Missing CORE context dimensions fail
// ----------------------------------------------------------------------------
test('F. Missing required CORE context dimensions fail validation', () => {
  // Test missing building_context
  const partialContext = {
    problem_goal: 'Mengurangi panas kamar',
    // building_context missing
    climate_exposure: 'WEST_AFTERNOON_HEAT',
    application_location: 'MASTER_BEDROOM',
    budget_class: 'BALANCED_MID',
    maintenance_tolerance: 'FIT_AND_FORGET'
  };

  const res = validateDecisionContext(partialContext);
  assert.strictEqual(res.valid, false);
  const missingIssue = res.issues.find(i => i.field === 'building_context');
  assert.ok(missingIssue, 'Must flag missing building_context');
  assert.strictEqual(missingIssue.code, 'MISSING_CORE_DIMENSION');
});

// ----------------------------------------------------------------------------
// Test G: Evidence version key and hash integrity validate against Article 5
// ----------------------------------------------------------------------------
test('G. Evidence version key and hash integrity strictly match Article 5 baseline', () => {
  assert.strictEqual(ARTICLE_5_EVIDENCE_BASE.article_id, 5);
  assert.strictEqual(ARTICLE_5_EVIDENCE_BASE.article_slug, 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia');
  assert.strictEqual(ARTICLE_5_EVIDENCE_BASE.publication_version_key, 'receipt:rcpt_bbae85b48e1b2f8d');
  assert.strictEqual(ARTICLE_5_EVIDENCE_BASE.published_content_hash, '14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277');
});

// ----------------------------------------------------------------------------
// Test H: Article 5 evidence explicitly preserves NORMALIZED_HASH_VERIFIED
// ----------------------------------------------------------------------------
test('H. Article 5 evidence explicitly preserves NORMALIZED_HASH_VERIFIED source fidelity', () => {
  assert.strictEqual(ARTICLE_5_EVIDENCE_BASE.source_fidelity, 'NORMALIZED_HASH_VERIFIED');
  assert.notStrictEqual(ARTICLE_5_EVIDENCE_BASE.source_fidelity, 'BYTE_EXACT_HASH_VERIFIED');
});

// ----------------------------------------------------------------------------
// Test I: No commerce/affiliate fields exist in contracts or pilot definitions
// ----------------------------------------------------------------------------
test('I. No commerce/affiliate fields exist across the decision model', () => {
  const issues = scanForForbiddenFields(DECISION_MODEL_PILOT_KUSEN);
  assert.strictEqual(issues.length, 0, `Forbidden fields found: ${JSON.stringify(issues)}`);

  // Assert that injecting a commerce field is caught immediately
  const taintedObj = {
    solution_id: 'sol_test',
    affiliate_url: 'https://example.com/buy',
    merchant: 'Shopee'
  };
  const taintedIssues = scanForForbiddenFields(taintedObj);
  assert.strictEqual(taintedIssues.length, 2);
});

// ----------------------------------------------------------------------------
// Test J: No numeric overall score field exists
// ----------------------------------------------------------------------------
test('J. No numeric overall score field exists in evaluations or recommendations', () => {
  // Confirm FORBIDDEN_CONTRACT_FIELDS contains score patterns
  assert.ok(FORBIDDEN_CONTRACT_FIELDS.includes('overall_score'));
  assert.ok(FORBIDDEN_CONTRACT_FIELDS.includes('star_rating'));
  assert.ok(FORBIDDEN_CONTRACT_FIELDS.includes('winner_score'));

  const jsonStr = JSON.stringify(DECISION_MODEL_PILOT_KUSEN);
  assert(!/"overall_score":/i.test(jsonStr));
  assert(!/"star_rating":/i.test(jsonStr));
  assert(!/"winner_score":/i.test(jsonStr));
  assert(!/"score":/i.test(jsonStr));
});

// ----------------------------------------------------------------------------
// Test K: Fit taxonomy only uses the approved 4 states
// ----------------------------------------------------------------------------
test('K. Fit taxonomy strictly adheres to approved 4 qualitative states', () => {
  const approvedStates = ['STRONG_FIT', 'GOOD_FIT_WITH_TRADEOFF', 'CONDITIONAL_FIT', 'POOR_FIT'];
  assert.deepStrictEqual([...FIT_TAXONOMY_VALUES], approvedStates);

  for (const scenario of DECISION_MODEL_PILOT_KUSEN.scenarios) {
    const rec = scenario.expected_recommendation;
    assert.ok(approvedStates.includes(rec.recommended_fit), `Recommended fit '${rec.recommended_fit}' must be approved`);
    if (rec.alternative_fit) {
      assert.ok(approvedStates.includes(rec.alternative_fit), `Alternative fit '${rec.alternative_fit}' must be approved`);
    }
  }
});

// ----------------------------------------------------------------------------
// Test L: Evidence snapshot hash is deterministic across input order
// ----------------------------------------------------------------------------
test('L. Evidence snapshot hash is deterministic and order-independent', () => {
  const bindingA = {
    ...ARTICLE_5_EVIDENCE_BASE,
    claim_class: 'VERIFIED_FACT',
    evidence_summary: 'Alpha summary'
  };
  const bindingB = {
    ...ARTICLE_5_EVIDENCE_BASE,
    claim_class: 'TECHNICAL_CONSENSUS',
    evidence_summary: 'Beta summary'
  };

  const hash1 = computeEvidenceSnapshotHash([bindingA, bindingB]);
  const hash2 = computeEvidenceSnapshotHash([bindingB, bindingA]);

  assert.strictEqual(hash1, hash2, 'Order of input bindings must not alter snapshot hash');
  assert.strictEqual(typeof hash1, 'string');
  assert.strictEqual(hash1.length, 64);
});

// ----------------------------------------------------------------------------
// Test M: Changing authoritative evidence hash changes snapshot hash
// ----------------------------------------------------------------------------
test('M. Modifying published content hash changes evidence snapshot hash', () => {
  const baseBinding = {
    ...ARTICLE_5_EVIDENCE_BASE,
    claim_class: 'VERIFIED_FACT',
    evidence_summary: 'Baseline summary'
  };
  const driftedBinding = {
    ...baseBinding,
    published_content_hash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
  };

  const baseHash = computeEvidenceSnapshotHash([baseBinding]);
  const driftedHash = computeEvidenceSnapshotHash([driftedBinding]);

  assert.notStrictEqual(baseHash, driftedHash, 'Drifted content hash must produce different snapshot hash');
});

// ----------------------------------------------------------------------------
// Test N: Derived freshness returns NEEDS_RECALIBRATION on evidence drift
// ----------------------------------------------------------------------------
test('N. deriveEvidenceFreshness dynamically detects drift and missing evidence', () => {
  const binding = {
    ...ARTICLE_5_EVIDENCE_BASE,
    claim_class: 'VERIFIED_FACT',
    evidence_summary: 'Baseline'
  };

  // Case 1: Active matches expected -> CURRENT
  const authoritativeMapCurrent = new Map([
    [binding.publication_version_key, { published_content_hash: binding.published_content_hash }]
  ]);
  assert.strictEqual(deriveEvidenceFreshness([binding], authoritativeMapCurrent), 'CURRENT');

  // Case 2: Content hash drifted -> NEEDS_RECALIBRATION
  const authoritativeMapDrifted = new Map([
    [binding.publication_version_key, { published_content_hash: 'changed_hash_value_1234567890' }]
  ]);
  assert.strictEqual(deriveEvidenceFreshness([binding], authoritativeMapDrifted), 'NEEDS_RECALIBRATION');

  // Case 3: Version key missing -> EVIDENCE_UNAVAILABLE
  const authoritativeMapEmpty = new Map();
  assert.strictEqual(deriveEvidenceFreshness([binding], authoritativeMapEmpty), 'EVIDENCE_UNAVAILABLE');
});

// ----------------------------------------------------------------------------
// Test O: Pure execution: no mutations, global state, or database access
// ----------------------------------------------------------------------------
test('O. Decision model definition is immutable and executes purely without side effects', () => {
  assert.ok(Object.isFrozen(DECISION_MODEL_PILOT_KUSEN), 'Decision model must be frozen');
  assert.ok(Object.isFrozen(DECISION_MODEL_PILOT_KUSEN.solution_classes), 'Solution classes must be frozen');
  assert.ok(Object.isFrozen(DECISION_MODEL_PILOT_KUSEN.criteria), 'Criteria must be frozen');
  assert.ok(Object.isFrozen(DECISION_MODEL_PILOT_KUSEN.evaluations), 'Evaluations must be frozen');
  assert.ok(Object.isFrozen(DECISION_MODEL_PILOT_KUSEN.scenarios), 'Scenarios must be frozen');

  // Validate that calling validation repeatedly produces identical clean results
  const res1 = validateDecisionModel(DECISION_MODEL_PILOT_KUSEN);
  const res2 = validateDecisionModel(DECISION_MODEL_PILOT_KUSEN);
  assert.strictEqual(res1.valid, true);
  assert.strictEqual(res2.valid, true);
});

console.log('\n================================================================');
console.log(`Results: ${passedCount} passed, ${failedCount} failed`);
console.log('================================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
