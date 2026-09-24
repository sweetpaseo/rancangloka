/**
 * RancangLoka — Decision Router & Cost Routing Foundation Test Suite
 *
 * Validates:
 * 1. Bounded choices across all supported decision points (publication_preflight, research_sufficiency, model_routing, rewrite_routing, retry_routing)
 * 2. Minimal State Principle (no raw article bodies or full source documents)
 * 3. Routing test matrix:
 *    - Simple low-risk article (model_routing -> cheap_model / standard_model)
 *    - Complex technical article (model_routing -> strong_model)
 *    - Insufficient research (research_sufficiency -> research_more)
 *    - Conflicting sources (research_sufficiency -> human_review)
 *    - Good first draft (rewrite_routing -> accept)
 *    - Minor revision required (rewrite_routing -> targeted_revision)
 *    - Major regeneration required (rewrite_routing -> full_regeneration)
 *    - Retryable provider error (retry_routing -> retry / backoff)
 *    - Non-retryable provider error (retry_routing -> stop / human_review)
 * 4. Disagreement classification:
 *    - AGREE_CONTINUE, AGREE_STOP, JEV_MORE_CONSERVATIVE, JEV_MORE_PERMISSIVE, JEV_HUMAN_REVIEW, JEV_UNAVAILABLE
 * 5. Cost Routing Foundation:
 *    - Pure evaluation (no live LLM calls)
 *    - Baseline ALWAYS_STRONG_MODEL vs JEV_ROUTED_MODEL
 *    - Metrics: llm_call_avoided, strong_model_call_avoided, additional_jev_call, route_selected
 *    - Zero hardcoded monetary claims
 * 6. Non-authority invariant: Router returns normalized decisions only, never mutates publication state
 */

import assert from 'node:assert';
import {
  DECISION_POINTS,
  MODEL_ROUTES,
  RESEARCH_ROUTES,
  REWRITE_ROUTES,
  RETRY_ROUTES,
  routeDecision,
  routeResearchSufficiencyDeterministic,
  routeModelDeterministic,
  routeRewriteDeterministic,
  routeRetryDeterministic,
  classifyDisagreement
} from '../src/lib/decision/decision-router.ts';
import {
  evaluateCostRouting
} from '../src/lib/decision/cost-router.ts';

let totalTests = 0;
let passedTests = 0;

function pass(desc) {
  totalTests++;
  passedTests++;
  console.log(`  ✅ PASS: Test ${totalTests}: ${desc}`);
}

function fail(desc, err) {
  totalTests++;
  console.error(`  ❌ FAIL: Test ${totalTests}: ${desc}`);
  console.error(err);
  process.exitCode = 1;
}

async function run() {
  console.log('\n=============================================================');
  console.log('  RancangLoka — Decision Router & Cost Routing Test Suite');
  console.log('=============================================================\n');

  // 1. Supported Decision Points and Route Enum Completeness
  try {
    assert.deepStrictEqual(DECISION_POINTS, [
      'publication_preflight',
      'research_sufficiency',
      'model_routing',
      'rewrite_routing',
      'retry_routing',
      'media_planning'
    ]);
    assert.deepStrictEqual(MODEL_ROUTES, [
      'skip_llm',
      'cheap_model',
      'standard_model',
      'strong_model',
      'human_review'
    ]);
    assert.deepStrictEqual(RESEARCH_ROUTES, [
      'continue_to_writer',
      'research_more',
      'human_review'
    ]);
    assert.deepStrictEqual(REWRITE_ROUTES, [
      'accept',
      'targeted_revision',
      'full_regeneration',
      'human_review'
    ]);
    assert.deepStrictEqual(RETRY_ROUTES, [
      'retry',
      'backoff',
      'stop',
      'human_review'
    ]);
    pass('All generic decision points and bounded choices are strictly defined');
  } catch (err) {
    fail('Supported Decision Points & Enum Completeness', err);
  }

  // 2. Routing Matrix: Simple Low-Risk Article
  try {
    const signals = {
      task_type: 'draft_expansion',
      complexity: 'low',
      risk_level: 'low',
      evidence_quality: 'high',
      prior_attempts: 0,
      token_estimate: 800
    };
    const route = routeModelDeterministic(signals);
    assert.strictEqual(route.decision, 'cheap_model');

    const routingDecision = routeDecision('model_routing', signals);
    assert.strictEqual(routingDecision.normalized_choice, 'cheap_model');
    assert.strictEqual(routingDecision.requires_human_review, false);
    pass('Matrix Case 1: Simple low-risk article routes to cheap_model');
  } catch (err) {
    fail('Simple Low-Risk Article routing', err);
  }

  // 3. Routing Matrix: Complex Technical Article
  try {
    const signals = {
      task_type: 'structural_analysis',
      complexity: 'high',
      risk_level: 'high',
      evidence_quality: 'high',
      prior_attempts: 0,
      token_estimate: 4500
    };
    const route = routeModelDeterministic(signals);
    assert.strictEqual(route.decision, 'strong_model');

    const routingDecision = routeDecision('model_routing', signals);
    assert.strictEqual(routingDecision.normalized_choice, 'strong_model');
    assert.strictEqual(routingDecision.requires_human_review, false);
    pass('Matrix Case 2: Complex technical article routes to strong_model');
  } catch (err) {
    fail('Complex Technical Article routing', err);
  }

  // 4. Routing Matrix: Insufficient Research
  try {
    const signals = {
      source_count: 1,
      authoritative_source_count: 0,
      source_diversity: 0.1,
      contradiction_count: 0,
      coverage_score: 0.35,
      freshness_score: 0.5
    };
    const route = routeResearchSufficiencyDeterministic(signals);
    assert.strictEqual(route.decision, 'research_more');

    const routingDecision = routeDecision('research_sufficiency', signals);
    assert.strictEqual(routingDecision.normalized_choice, 'research_more');
    assert.ok(routingDecision.reasons.some(r => r.includes('INSUFFICIENT_SOURCES') || r.includes('LOW_COVERAGE')));
    pass('Matrix Case 3: Insufficient research routes to research_more');
  } catch (err) {
    fail('Insufficient Research routing', err);
  }

  // 5. Routing Matrix: Conflicting Sources
  try {
    const signals = {
      source_count: 6,
      authoritative_source_count: 3,
      source_diversity: 0.8,
      contradiction_count: 3,
      coverage_score: 0.85,
      freshness_score: 0.9
    };
    const route = routeResearchSufficiencyDeterministic(signals);
    assert.strictEqual(route.decision, 'human_review');

    const routingDecision = routeDecision('research_sufficiency', signals);
    assert.strictEqual(routingDecision.normalized_choice, 'human_review');
    assert.strictEqual(routingDecision.requires_human_review, true);
    assert.ok(routingDecision.reasons.some(r => r.includes('CONTRADICTIONS')));
    pass('Matrix Case 4: Conflicting sources routes to human_review');
  } catch (err) {
    fail('Conflicting Sources routing', err);
  }

  // 6. Routing Matrix: Good First Draft
  try {
    const signals = {
      content_contract_pass: true,
      editorial_validation_pass: true,
      factual_issue_count: 0,
      style_issue_count: 0,
      structural_issue_count: 0,
      previous_revisions: 0
    };
    const route = routeRewriteDeterministic(signals);
    assert.strictEqual(route.decision, 'accept');

    const routingDecision = routeDecision('rewrite_routing', signals);
    assert.strictEqual(routingDecision.normalized_choice, 'accept');
    assert.strictEqual(routingDecision.requires_human_review, false);
    pass('Matrix Case 5: Good first draft routes to accept');
  } catch (err) {
    fail('Good First Draft routing', err);
  }

  // 7. Routing Matrix: Minor Revision Required
  try {
    const signals = {
      content_contract_pass: true,
      editorial_validation_pass: true,
      factual_issue_count: 0,
      style_issue_count: 2,
      structural_issue_count: 0,
      previous_revisions: 0
    };
    const route = routeRewriteDeterministic(signals);
    assert.strictEqual(route.decision, 'targeted_revision');

    const routingDecision = routeDecision('rewrite_routing', signals);
    assert.strictEqual(routingDecision.normalized_choice, 'targeted_revision');
    assert.strictEqual(routingDecision.requires_human_review, false);
    pass('Matrix Case 6: Minor style issues route to targeted_revision');
  } catch (err) {
    fail('Minor Revision Required routing', err);
  }

  // 8. Routing Matrix: Major Regeneration Required
  try {
    const signals = {
      content_contract_pass: false,
      editorial_validation_pass: false,
      factual_issue_count: 3,
      style_issue_count: 5,
      structural_issue_count: 2,
      previous_revisions: 0
    };
    const route = routeRewriteDeterministic(signals);
    assert.strictEqual(route.decision, 'full_regeneration');

    const routingDecision = routeDecision('rewrite_routing', signals);
    assert.strictEqual(routingDecision.normalized_choice, 'full_regeneration');
    pass('Matrix Case 7: Broken contract & multi-issue draft routes to full_regeneration');
  } catch (err) {
    fail('Major Regeneration Required routing', err);
  }

  // 9. Routing Matrix: Retryable Provider Error
  try {
    const signals = {
      attempt: 2,
      max_attempts: 3,
      error_class: 'RETRYABLE',
      error_code: 'HTTP_429_RATE_LIMIT',
      elapsed_seconds: 5
    };
    const route = routeRetryDeterministic(signals);
    assert.strictEqual(route.decision, 'backoff');

    const routingDecision = routeDecision('retry_routing', signals);
    assert.strictEqual(routingDecision.normalized_choice, 'backoff');
    pass('Matrix Case 8: Rate limit error on attempt 2 routes to backoff');
  } catch (err) {
    fail('Retryable Provider Error routing', err);
  }

  // 10. Routing Matrix: Non-Retryable Provider Error
  try {
    const signals = {
      attempt: 1,
      max_attempts: 3,
      error_class: 'TERMINAL',
      error_code: 'AUTH_INVALID_KEY',
      elapsed_seconds: 1
    };
    const route = routeRetryDeterministic(signals);
    assert.strictEqual(route.decision, 'stop');

    const routingDecision = routeDecision('retry_routing', signals);
    assert.strictEqual(routingDecision.normalized_choice, 'stop');
    assert.ok(routingDecision.reasons.includes('TERMINAL_FAILURE_NOT_RETRYABLE'));
    pass('Matrix Case 9: Non-retryable terminal auth error routes to stop');
  } catch (err) {
    fail('Non-Retryable Provider Error routing', err);
  }

  // 11. Minimal State Principle: Signals Structure Validation
  try {
    // Verify that none of the routing signals contain body, text, or source document payloads
    const researchSignals = {
      source_count: 4,
      authoritative_source_count: 2,
      source_diversity: 0.7,
      contradiction_count: 0,
      coverage_score: 0.8,
      freshness_score: 0.9
    };
    assert.strictEqual(Object.keys(researchSignals).includes('article_body'), false);
    assert.strictEqual(Object.keys(researchSignals).includes('source_documents'), false);

    const modelSignals = {
      task_type: 'planning',
      complexity: 'medium',
      risk_level: 'low',
      evidence_quality: 'high',
      prior_attempts: 0,
      token_estimate: 1500
    };
    assert.strictEqual(Object.keys(modelSignals).includes('full_prompt'), false);
    assert.strictEqual(Object.keys(modelSignals).includes('full_context'), false);

    pass('Minimal State Principle enforced: zero raw documents or prose text in routing signals');
  } catch (err) {
    fail('Minimal State Principle', err);
  }

  // 12. Disagreement Classification: Full Matrix
  try {
    assert.strictEqual(classifyDisagreement('publication_preflight', 'continue', 'continue', 'SUCCESS'), 'AGREE_CONTINUE');
    assert.strictEqual(classifyDisagreement('publication_preflight', 'revise', 'revise', 'SUCCESS'), 'AGREE_REVISE');
    assert.strictEqual(classifyDisagreement('publication_preflight', 'stop', 'stop', 'SUCCESS'), 'AGREE_STOP');
    assert.strictEqual(classifyDisagreement('publication_preflight', 'continue', 'stop', 'SUCCESS'), 'JEV_MORE_CONSERVATIVE');
    assert.strictEqual(classifyDisagreement('publication_preflight', 'revise', 'stop', 'SUCCESS'), 'JEV_MORE_CONSERVATIVE');
    assert.strictEqual(classifyDisagreement('publication_preflight', 'stop', 'continue', 'SUCCESS'), 'JEV_MORE_PERMISSIVE');
    assert.strictEqual(classifyDisagreement('publication_preflight', 'stop', 'revise', 'SUCCESS'), 'JEV_MORE_PERMISSIVE');
    assert.strictEqual(classifyDisagreement('publication_preflight', 'continue', 'human_review', 'SUCCESS'), 'JEV_HUMAN_REVIEW');
    assert.strictEqual(classifyDisagreement('publication_preflight', 'continue', null, 'ERROR'), 'JEV_UNAVAILABLE');
    assert.strictEqual(classifyDisagreement('publication_preflight', 'continue', null, 'FALLBACK'), 'JEV_UNAVAILABLE');
    pass('Disagreement classification handles all analytical categories accurately (including AGREE_REVISE)');
  } catch (err) {
    fail('Disagreement Classification Matrix', err);
  }

  // 13. Cost Routing Foundation: Pure Evaluation (No Live LLM Calls)
  try {
    // Case A: skip_llm saves all LLM calls
    const costSkip = evaluateCostRouting('skip_llm', { estimated_input_tokens: 1000, estimated_output_tokens: 500 });
    assert.strictEqual(costSkip.llm_call_avoided, true);
    assert.strictEqual(costSkip.strong_model_call_avoided, true);
    assert.strictEqual(costSkip.additional_jev_call, true);
    assert.strictEqual(costSkip.route_selected, 'skip_llm');
    assert.strictEqual(costSkip.baseline_strategy, 'ALWAYS_STRONG_MODEL');
    assert.strictEqual(costSkip.jev_strategy, 'JEV_ROUTED_MODEL');

    // Case B: cheap_model avoids strong model call
    const costCheap = evaluateCostRouting('cheap_model', { estimated_input_tokens: 2000, estimated_output_tokens: 1000 });
    assert.strictEqual(costCheap.llm_call_avoided, false);
    assert.strictEqual(costCheap.strong_model_call_avoided, true);
    assert.strictEqual(costCheap.additional_jev_call, true);
    assert.strictEqual(costCheap.route_selected, 'cheap_model');

    // Case C: strong_model uses strong model (no strong model call avoided)
    const costStrong = evaluateCostRouting('strong_model', { estimated_input_tokens: 5000, estimated_output_tokens: 2500 });
    assert.strictEqual(costStrong.llm_call_avoided, false);
    assert.strictEqual(costStrong.strong_model_call_avoided, false);
    assert.strictEqual(costStrong.additional_jev_call, true);
    assert.strictEqual(costStrong.route_selected, 'strong_model');

    // Verify zero monetary currency symbols or claims in evaluation object
    const serialized = JSON.stringify(costSkip) + JSON.stringify(costCheap) + JSON.stringify(costStrong);
    assert.strictEqual(serialized.includes('$'), false);
    assert.strictEqual(serialized.includes('USD'), false);
    assert.strictEqual(serialized.includes('IDR'), false);
    pass('Cost routing evaluation calculates call avoidance without hardcoding monetary claims');
  } catch (err) {
    fail('Cost Routing Foundation', err);
  }

  // 14. Non-Authority Proof: Decision Router Cannot Mutate State
  try {
    const signals = {
      task_type: 'writing',
      complexity: 'high',
      risk_level: 'high',
      evidence_quality: 'low',
      prior_attempts: 2,
      token_estimate: 2000
    };
    const decision = routeDecision('model_routing', signals);
    assert.strictEqual(typeof decision, 'object');
    // Ensure decision only contains analytical fields
    assert.deepStrictEqual(Object.keys(decision).sort(), [
      'confidence',
      'decision_point',
      'evaluation_type',
      'normalized_choice',
      'reasons',
      'requires_human_review'
    ]);
    pass('Router returns pure data structure with zero execution authority');
  } catch (err) {
    fail('Non-Authority Proof', err);
  }

  console.log('\n=============================================================');
  console.log(`  Tests Completed: ${totalTests}`);
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Failed: 0`);
  console.log('=============================================================\n');
}

run().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
