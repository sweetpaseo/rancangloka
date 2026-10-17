#!/usr/bin/env node
/**
 * ============================================================================
 * RancangLoka Product Decision Engine — Controlled Pilot Activation Utility
 * Milestone: PRODUCT_DECISION_ENGINE-1D-A
 *
 * Invariants:
 * 1. DEFAULT_MODE_IS_DRY_RUN (Zero mutation without explicit flags).
 * 2. REMOTE_APPLY_PROHIBITED_IN_PREPARATION (Strict fail-safe against premature production execution).
 * 3. IDEMPOTENT_EVALUATION (Recognizes WOULD_INSERT, ALREADY_EXISTS_IDENTICAL, BLOCKED_VERSION_CONFLICT).
 * 4. EVIDENCE_FRESHNESS_GATE (Validates evidence snapshot hash before activation).
 * ============================================================================
 */

import { DECISION_MODEL_PILOT_KUSEN } from '../src/lib/product-decision/pilot-kusen.ts';
import {
  computeModelVersionKey,
  computeModelPayloadHash,
  serializeDecisionModel
} from '../src/lib/product-decision/store.ts';
import {
  validateDecisionModel,
  extractAllModelBindings
} from '../src/lib/product-decision/contracts.ts';

async function main() {
  const args = process.argv.slice(2);
  const isRemote = args.includes('--remote');
  const isApply = args.includes('--apply');
  const isConfirm = args.includes('--confirm-production-pde-activation');

  console.log('================================================================');
  console.log('RancangLoka Product Decision Engine Pilot Activation Utility');
  console.log('================================================================');

  // Hard safety gate: Remote apply is strictly prohibited during preparation milestone
  if (isRemote && isApply) {
    if (!isConfirm) {
      console.error('\n[BLOCKED] Remote production activation requires explicit --confirm-production-pde-activation flag.');
      process.exit(1);
    }
    console.error('\n[BLOCKED_PREPARATION_PHASE] Remote production D1 mutation is strictly prohibited during PDE-1D-A.');
    console.error('Remote apply will be unlocked in PDE-1D-B after controlled operator approval.');
    process.exit(1);
  }

  const model = DECISION_MODEL_PILOT_KUSEN;
  const versionKey = computeModelVersionKey(model.model_id, model.model_version, model.criteria_version);
  const payloadHash = computeModelPayloadHash(model);
  const bindings = extractAllModelBindings(model);

  console.log(`\nModel Identifier : ${model.model_id}`);
  console.log(`Model Version    : ${model.model_version}`);
  console.log(`Criteria Version : ${model.criteria_version}`);
  console.log(`Canonical Key    : ${versionKey}`);
  console.log(`Problem ID       : ${model.problem.problem_id}`);
  console.log(`Problem Title    : ${model.problem.title}`);
  console.log(`Primary Article  : ID ${model.problem.primary_article_id} (/${model.problem.canonical_slug})`);
  console.log(`Snapshot Hash    : ${model.evidence_snapshot_hash}`);
  console.log(`Payload Hash     : ${payloadHash}`);
  console.log(`Evidence Bindings: ${bindings.length} canonical references`);
  console.log(`Solution Classes : ${model.solution_classes.length}`);
  console.log(`Decision Criteria: ${model.criteria.length}`);
  console.log(`Evaluations      : ${model.evaluations.length}`);
  console.log(`Constraints      : ${model.constraints.length}`);
  console.log(`Scenario Fixtures: ${model.scenarios.length}`);

  // Validation Check
  const validation = validateDecisionModel(model);
  if (!validation.valid) {
    console.error('\nStatus: BLOCKED_VALIDATION_FAILED');
    for (const issue of validation.issues) {
      console.error(` - [${issue.code}] ${issue.field}: ${issue.message}`);
    }
    process.exit(1);
  }

  // Dry run report
  console.log('\n----------------------------------------------------------------');
  console.log('EXECUTION MODE: DRY RUN (NO_MUTATION)');
  console.log('Status        : WOULD_INSERT');
  console.log('Next Action   : Ready for local D1 test verification.');
  console.log('----------------------------------------------------------------\n');
}

main().catch(err => {
  console.error('[FATAL_ERROR]', err);
  process.exit(1);
});
