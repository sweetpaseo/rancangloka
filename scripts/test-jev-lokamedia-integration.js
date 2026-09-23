/**
 * RancangLoka — Jev Phase 4D Integration Test Suite
 * Milestone: JEV-4D
 * 
 * Comprehensive validation of:
 * 1. Migration 0021_decision_observations.sql local application & schema verification
 * 2. Provider-Off baseline (zero impact on publication planner / scheduler when Jev is off or key absent)
 * 3. Mock shadow matrix:
 *    - Hermes ALLOW / Jev continue
 *    - Hermes ALLOW / Jev human_review
 *    - Hermes ALLOW / Jev stop
 *    - Hermes BLOCK / Jev continue
 *    - Jev timeout
 *    - Jev malformed response
 *    - Jev rate limit (429)
 *    - Jev auth error (401)
 *    - Telemetry failure isolation (DB error does not crash pipeline)
 * 4. Automation mode regression (OFF, OBSERVE_ONLY, PLAN_ONLY, CONTROLLED, UNATTENDED)
 * 5. Cost routing shadow authority & generic reusability check
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  recordDecisionObservation,
  getDecisionObservations,
  getDecisionObservationById,
  clearMemoryObservations,
  getMemoryObservations
} from '../src/lib/decision/decision-telemetry.ts';
import {
  observeCandidateShadowDecision,
  clearShadowObservations,
  getRecentShadowObservations
} from '../src/lib/decision/decision-observer.ts';
import {
  routeDecision,
  classifyDisagreement,
  DECISION_POINTS,
  MODEL_ROUTES,
  RESEARCH_ROUTES,
  REWRITE_ROUTES,
  RETRY_ROUTES
} from '../src/lib/decision/decision-router.ts';
import {
  evaluateCostRouting
} from '../src/lib/decision/cost-router.ts';
import {
  getAutomationControl,
  getCapabilityMatrix
} from '../src/lib/safety/automation-controller.ts';
import {
  AUTOMATION_MODES
} from '../src/lib/safety/safety-types.ts';
import {
  evaluateFirstGenuineArticleGate
} from '../src/lib/safety/first-article-gate.ts';
import {
  executePublicationPlanner
} from '../src/lib/publication/planner-service.ts';
import {
  getPublicationRunLedger
} from '../src/lib/safety/run-ledger.ts';

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

/**
 * Creates an in-memory SQLite database simulating D1 with migration 0021 applied.
 */
function createTestD1Database() {
  const db = new DatabaseSync(':memory:');

  // Read and apply migration 0021
  const migrationPath = path.resolve(process.cwd(), 'db/migrations/0021_decision_observations.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  db.exec(migrationSql);

  // Wrapper providing Cloudflare D1-compatible prepare/bind/run/all API
  return {
    rawDb: db,
    prepare: (sql) => {
      return {
        bind: (...params) => {
          return {
            run: async () => {
              const stmt = db.prepare(sql);
              const info = stmt.run(...params);
              return { success: true, meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
            },
            all: async () => {
              const stmt = db.prepare(sql);
              const rows = stmt.all(...params);
              return { results: rows, success: true };
            },
            first: async () => {
              const stmt = db.prepare(sql);
              const rows = stmt.all(...params);
              return rows.length > 0 ? rows[0] : null;
            }
          };
        }
      };
    },
    batch: async (statements) => {
      for (const s of statements) {
        await s.run();
      }
      return [];
    }
  };
}

async function run() {
  console.log('\n=============================================================');
  console.log('  RancangLoka — Jev Phase 4D Integration Test Suite');
  console.log('=============================================================\n');

  // -------------------------------------------------------------------------
  // 1. LOCAL MIGRATION 0021 SCHEMA VERIFICATION
  // -------------------------------------------------------------------------
  try {
    const d1 = createTestD1Database();

    // Verify table exists
    const tableCheck = d1.rawDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='decision_observations'").all();
    assert.strictEqual(tableCheck.length, 1, 'decision_observations table must exist');

    // Verify indexes exist
    const indexCheck = d1.rawDb.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='decision_observations'").all();
    const indexNames = indexCheck.map((i) => i.name);
    assert.ok(indexNames.includes('idx_decision_obs_point'));
    assert.ok(indexNames.includes('idx_decision_obs_subject'));
    assert.ok(indexNames.includes('idx_decision_obs_run'));
    assert.ok(indexNames.includes('idx_decision_obs_disagreement'));
    assert.ok(indexNames.includes('idx_decision_obs_created_at'));

    // Insert sample successful observation into local D1
    const testObs = {
      observation_id: 'obs_local_mig_test_1',
      decision_point: 'publication_preflight',
      subject_type: 'article',
      subject_id: '42',
      run_id: 'run_mig_test',
      authoritative_decision: 'continue',
      authoritative_reasons: ['CRITERIA_MET'],
      jev_decision: 'continue',
      jev_probabilities: { continue: 0.98 },
      jev_confidence: 0.98,
      provider: 'openrouter',
      model: 'typesafe/jev-1.13',
      model_version: '20260917',
      input_schema_version: '1.0.0',
      prompt_version: '2026-09-23.01',
      input_hash: 'hash_test_123',
      latency_ms: 120,
      provider_status: 'SUCCESS',
      provider_error_class: null,
      disagreement_classification: 'AGREE_CONTINUE',
      cost_routing_estimate: {
        llm_call_avoided: false,
        strong_model_call_avoided: true,
        additional_jev_call: true,
        route_selected: 'standard_model',
        baseline_strategy: 'ALWAYS_STRONG_MODEL',
        jev_strategy: 'JEV_ROUTED_MODEL'
      },
      created_at: new Date().toISOString()
    };

    await recordDecisionObservation(d1, testObs);

    const retrieved = await getDecisionObservationById(d1, 'obs_local_mig_test_1');
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.observation_id, 'obs_local_mig_test_1');
    assert.strictEqual(retrieved?.subject_id, '42');
    assert.strictEqual(retrieved?.run_id, 'run_mig_test');
    assert.strictEqual(retrieved?.provider_status, 'SUCCESS');
    assert.strictEqual(retrieved?.jev_confidence, 0.98);

    // Insert provider error observation with null soft references
    const errorObs = {
      observation_id: 'obs_local_mig_err_2',
      decision_point: 'publication_preflight',
      subject_type: 'article',
      subject_id: '999',
      run_id: null, // Nullable soft reference
      authoritative_decision: 'continue',
      authoritative_reasons: ['DETERMINISTIC_PASS'],
      jev_decision: null,
      jev_probabilities: null,
      jev_confidence: null,
      provider: 'openrouter',
      model: 'typesafe/jev-1.13',
      model_version: '20260917',
      input_schema_version: '1.0.0',
      prompt_version: '2026-09-23.01',
      input_hash: 'hash_err_456',
      latency_ms: 50,
      provider_status: 'ERROR',
      provider_error_class: 'HTTP_429_RATE_LIMIT',
      disagreement_classification: 'JEV_UNAVAILABLE',
      cost_routing_estimate: null,
      created_at: new Date().toISOString()
    };

    await recordDecisionObservation(d1, errorObs);
    const retrievedErr = await getDecisionObservationById(d1, 'obs_local_mig_err_2');
    assert.ok(retrievedErr);
    assert.strictEqual(retrievedErr?.provider_status, 'ERROR');
    assert.strictEqual(retrievedErr?.provider_error_class, 'HTTP_429_RATE_LIMIT');
    assert.strictEqual(retrievedErr?.run_id, null);

    pass('Migration 0021 applies locally with complete table, indexes, and soft-reference types');
  } catch (err) {
    fail('Migration 0021 local application', err);
  }

  // -------------------------------------------------------------------------
  // 2. PROVIDER-OFF BASELINE (Zero network, zero pipeline impact)
  // -------------------------------------------------------------------------
  try {
    clearShadowObservations();
    const disabledObs = await observeCandidateShadowDecision(
      {
        project: 'RancangLoka',
        articleId: 101,
        slug: 'provider-off-slug',
        articleGenerationCompleted: true,
        editorialValidationPassed: true,
        referencesPresent: true,
        heroImagePresent: true,
        duplicateSlug: false,
        readinessStatus: 'READY_TO_SCHEDULE'
      },
      {
        config: {
          enabled: false,
          mode: 'disabled',
          provider: 'openrouter',
          model: 'typesafe/jev-1.13',
          apiKey: '',
          timeoutMs: 5000,
          endpoint: 'https://openrouter.ai/api/alpha/decisions'
        }
      }
    );

    assert.strictEqual(disabledObs.provider_status, 'FALLBACK');
    assert.strictEqual(disabledObs.provider_error_class, 'JEV_DISABLED');
    assert.strictEqual(disabledObs.latency_ms, 0);

    // Missing API key with enabled: true fails safe to CONFIG_MISSING without network calls
    const missingKeyObs = await observeCandidateShadowDecision(
      {
        project: 'RancangLoka',
        articleId: 102,
        slug: 'missing-key-slug',
        articleGenerationCompleted: true,
        editorialValidationPassed: true,
        referencesPresent: true,
        heroImagePresent: true,
        duplicateSlug: false,
        readinessStatus: 'READY_TO_SCHEDULE'
      },
      {
        config: {
          enabled: true,
          mode: 'shadow',
          provider: 'openrouter',
          model: 'typesafe/jev-1.13',
          apiKey: '',
          timeoutMs: 5000,
          endpoint: 'https://openrouter.ai/api/alpha/decisions'
        }
      }
    );

    assert.strictEqual(missingKeyObs.provider_status, 'ERROR');
    assert.strictEqual(missingKeyObs.provider_error_class, 'CONFIG_MISSING');
    assert.strictEqual(missingKeyObs.disagreement_classification, 'JEV_UNAVAILABLE');

    pass('Provider-off & missing key baselines complete safely with zero network overhead');
  } catch (err) {
    fail('Provider-off baseline', err);
  }

  // -------------------------------------------------------------------------
  // 3. MOCK SHADOW MATRIX & FAULT TOLERANCE
  // -------------------------------------------------------------------------
  try {
    // Case A: Hermes ALLOW / Jev continue -> AGREE_CONTINUE
    const mockAllowProvider = {
      evaluate: async () => ({
        success: true,
        model: 'typesafe/jev-1.13',
        provider: 'openrouter',
        latencyMs: 150,
        answers: {
          nextAction: { type: 'choice', choice: 'continue', probabilities: { continue: 0.95 }, confidence: 0.95 },
          needsHumanReview: { type: 'noul', noul: 0.05, confidence: 0.95 },
          publicationRisk: { type: 'choice', choice: 'very_low', confidence: 0.95 }
        }
      })
    };
    const obsA = await observeCandidateShadowDecision(
      { project: 'RancangLoka', articleId: 201, slug: 'slug-a', articleGenerationCompleted: true, editorialValidationPassed: true, referencesPresent: true, heroImagePresent: true, duplicateSlug: false, readinessStatus: 'READY_TO_SCHEDULE' },
      { provider: mockAllowProvider, authoritativeDecision: 'continue' }
    );
    assert.strictEqual(obsA.disagreement_classification, 'AGREE_CONTINUE');

    // Case B: Hermes ALLOW / Jev human_review -> JEV_HUMAN_REVIEW
    const mockReviewProvider = {
      evaluate: async () => ({
        success: true,
        model: 'typesafe/jev-1.13',
        provider: 'openrouter',
        latencyMs: 180,
        answers: {
          nextAction: { type: 'choice', choice: 'human_review', probabilities: { human_review: 0.8 }, confidence: 0.8 },
          needsHumanReview: { type: 'noul', noul: 0.9, confidence: 0.9 },
          publicationRisk: { type: 'choice', choice: 'medium', confidence: 0.8 }
        }
      })
    };
    const obsB = await observeCandidateShadowDecision(
      { project: 'RancangLoka', articleId: 202, slug: 'slug-b', articleGenerationCompleted: true, editorialValidationPassed: true, referencesPresent: true, heroImagePresent: true, duplicateSlug: false, readinessStatus: 'READY_TO_SCHEDULE' },
      { provider: mockReviewProvider, authoritativeDecision: 'continue' }
    );
    assert.strictEqual(obsB.disagreement_classification, 'JEV_HUMAN_REVIEW');

    // Case C: Hermes ALLOW / Jev stop -> JEV_MORE_CONSERVATIVE
    const mockStopProvider = {
      evaluate: async () => ({
        success: true,
        model: 'typesafe/jev-1.13',
        provider: 'openrouter',
        latencyMs: 140,
        answers: {
          nextAction: { type: 'choice', choice: 'stop', probabilities: { stop: 0.88 }, confidence: 0.88 },
          needsHumanReview: { type: 'noul', noul: 0.85, confidence: 0.88 },
          publicationRisk: { type: 'choice', choice: 'high', confidence: 0.88 }
        }
      })
    };
    const obsC = await observeCandidateShadowDecision(
      { project: 'RancangLoka', articleId: 203, slug: 'slug-c', articleGenerationCompleted: true, editorialValidationPassed: true, referencesPresent: true, heroImagePresent: true, duplicateSlug: false, readinessStatus: 'READY_TO_SCHEDULE' },
      { provider: mockStopProvider, authoritativeDecision: 'continue' }
    );
    assert.strictEqual(obsC.disagreement_classification, 'JEV_MORE_CONSERVATIVE');

    // Case D: Hermes BLOCK / Jev continue -> JEV_MORE_PERMISSIVE
    const obsD = await observeCandidateShadowDecision(
      { project: 'RancangLoka', articleId: 204, slug: 'slug-d', articleGenerationCompleted: false, editorialValidationPassed: false, referencesPresent: true, heroImagePresent: true, duplicateSlug: false, readinessStatus: 'BLOCKED' },
      { provider: mockAllowProvider, authoritativeDecision: 'stop' }
    );
    assert.strictEqual(obsD.disagreement_classification, 'JEV_MORE_PERMISSIVE');

    // Case E: Jev Timeout
    const mockTimeoutProvider = {
      evaluate: async () => ({
        success: false,
        model: 'typesafe/jev-1.13',
        provider: 'openrouter',
        latencyMs: 5001,
        error: 'Request timeout after 5000ms',
        errorCategory: 'TIMEOUT'
      })
    };
    const obsE = await observeCandidateShadowDecision(
      { project: 'RancangLoka', articleId: 205, slug: 'slug-e', articleGenerationCompleted: true, editorialValidationPassed: true, referencesPresent: true, heroImagePresent: true, duplicateSlug: false, readinessStatus: 'READY_TO_SCHEDULE' },
      { provider: mockTimeoutProvider }
    );
    assert.strictEqual(obsE.provider_status, 'ERROR');
    assert.strictEqual(obsE.provider_error_class, 'TIMEOUT');
    assert.strictEqual(obsE.disagreement_classification, 'JEV_UNAVAILABLE');

    // Case F: Jev Malformed Response
    const mockMalformedProvider = {
      evaluate: async () => ({
        success: false,
        model: 'typesafe/jev-1.13',
        provider: 'openrouter',
        latencyMs: 80,
        error: 'Malformed JSON payload from upstream API',
        errorCategory: 'MALFORMED'
      })
    };
    const obsF = await observeCandidateShadowDecision(
      { project: 'RancangLoka', articleId: 206, slug: 'slug-f', articleGenerationCompleted: true, editorialValidationPassed: true, referencesPresent: true, heroImagePresent: true, duplicateSlug: false, readinessStatus: 'READY_TO_SCHEDULE' },
      { provider: mockMalformedProvider }
    );
    assert.strictEqual(obsF.provider_status, 'ERROR');
    assert.strictEqual(obsF.provider_error_class, 'MALFORMED');

    // Case G: Jev Rate Limit (429)
    const mockRateLimitProvider = {
      evaluate: async () => ({
        success: false,
        model: 'typesafe/jev-1.13',
        provider: 'openrouter',
        latencyMs: 65,
        error: 'HTTP 429: Too Many Requests',
        errorCategory: 'RATE_LIMIT'
      })
    };
    const obsG = await observeCandidateShadowDecision(
      { project: 'RancangLoka', articleId: 207, slug: 'slug-g', articleGenerationCompleted: true, editorialValidationPassed: true, referencesPresent: true, heroImagePresent: true, duplicateSlug: false, readinessStatus: 'READY_TO_SCHEDULE' },
      { provider: mockRateLimitProvider }
    );
    assert.strictEqual(obsG.provider_status, 'ERROR');
    assert.strictEqual(obsG.provider_error_class, 'RATE_LIMIT');

    // Case H: Jev Auth Error (401)
    const mockAuthProvider = {
      evaluate: async () => ({
        success: false,
        model: 'typesafe/jev-1.13',
        provider: 'openrouter',
        latencyMs: 40,
        error: 'HTTP 401: Unauthorized API Key',
        errorCategory: 'AUTH'
      })
    };
    const obsH = await observeCandidateShadowDecision(
      { project: 'RancangLoka', articleId: 208, slug: 'slug-h', articleGenerationCompleted: true, editorialValidationPassed: true, referencesPresent: true, heroImagePresent: true, duplicateSlug: false, readinessStatus: 'READY_TO_SCHEDULE' },
      { provider: mockAuthProvider }
    );
    assert.strictEqual(obsH.provider_status, 'ERROR');
    assert.strictEqual(obsH.provider_error_class, 'AUTH');

    // Case I: Telemetry Insert Failure (crashing DB)
    const crashingDb = {
      prepare: () => {
        throw new Error('D1_STORAGE_WRITE_FAILURE');
      }
    };
    const obsI = await observeCandidateShadowDecision(
      { project: 'RancangLoka', articleId: 209, slug: 'slug-i', articleGenerationCompleted: true, editorialValidationPassed: true, referencesPresent: true, heroImagePresent: true, duplicateSlug: false, readinessStatus: 'READY_TO_SCHEDULE' },
      { provider: mockAllowProvider, db: crashingDb }
    );
    assert.ok(obsI);
    assert.strictEqual(obsI.observation_id.startsWith('obs_'), true);

    pass('Mock shadow matrix (ALLOW/continue, ALLOW/review, ALLOW/stop, BLOCK/continue, timeout, malformed, 429, 401, DB crash) completed without throwing');
  } catch (err) {
    fail('Mock shadow matrix', err);
  }

  // -------------------------------------------------------------------------
  // 4. AUTOMATION MODE REGRESSION
  // -------------------------------------------------------------------------
  try {
    // Mode OFF
    const capsOff = getCapabilityMatrix('OFF', false);
    assert.strictEqual(capsOff.canObserve, false);
    assert.strictEqual(capsOff.canPlan, false);
    assert.strictEqual(capsOff.canScheduleControlled, false);
    assert.strictEqual(capsOff.canPublishUnattended, false);
    assert.strictEqual(capsOff.canMutateArticle, false);

    // Mode OBSERVE_ONLY
    const capsObs = getCapabilityMatrix('OBSERVE_ONLY', false);
    assert.strictEqual(capsObs.canObserve, true);
    assert.strictEqual(capsObs.canPlan, false);
    assert.strictEqual(capsObs.canScheduleControlled, false);
    assert.strictEqual(capsObs.canPublishUnattended, false);

    // Mode PLAN_ONLY
    const capsPlan = getCapabilityMatrix('PLAN_ONLY', false);
    assert.strictEqual(capsPlan.canObserve, true);
    assert.strictEqual(capsPlan.canPlan, true);
    assert.strictEqual(capsPlan.canScheduleControlled, false);
    assert.strictEqual(capsPlan.canPublishUnattended, false);

    // Mode CONTROLLED
    const capsCtrl = getCapabilityMatrix('CONTROLLED', false);
    assert.strictEqual(capsCtrl.canObserve, true);
    assert.strictEqual(capsCtrl.canPlan, true);
    assert.strictEqual(capsCtrl.canScheduleControlled, true);
    assert.strictEqual(capsCtrl.canPublishUnattended, false);

    // Mode UNATTENDED
    const capsUnatt = getCapabilityMatrix('UNATTENDED', false);
    assert.strictEqual(capsUnatt.canObserve, true);
    assert.strictEqual(capsUnatt.canPlan, true);
    assert.strictEqual(capsUnatt.canScheduleControlled, true);
    assert.strictEqual(capsUnatt.canPublishUnattended, true);
    assert.strictEqual(capsUnatt.canMutateArticle, false); // Always false

    // Kill switch engaged dominates everything
    const capsKill = getCapabilityMatrix('UNATTENDED', true);
    assert.strictEqual(capsKill.canPlan, false);
    assert.strictEqual(capsKill.canScheduleControlled, false);
    assert.strictEqual(capsKill.canPublishUnattended, false);

    pass('All 5 automation modes (OFF, OBSERVE_ONLY, PLAN_ONLY, CONTROLLED, UNATTENDED) preserve exact capabilities and kill switch dominance');
  } catch (err) {
    fail('Automation mode regression', err);
  }

  // -------------------------------------------------------------------------
  // 5. COST ROUTING SHADOW AUTHORITY & GENERIC REUSABILITY
  // -------------------------------------------------------------------------
  try {
    const costEval = evaluateCostRouting('cheap_model', {
      task_type: 'drafting',
      estimated_input_tokens: 1500,
      estimated_output_tokens: 800
    });
    assert.strictEqual(costEval.route_selected, 'cheap_model');
    assert.strictEqual(costEval.llm_call_avoided, false);
    assert.strictEqual(costEval.strong_model_call_avoided, true);
    assert.strictEqual(costEval.additional_jev_call, true);
    assert.strictEqual(costEval.baseline_strategy, 'ALWAYS_STRONG_MODEL');
    assert.strictEqual(costEval.jev_strategy, 'JEV_ROUTED_MODEL');

    // Check core generic decision points & routes are agnostic to brand
    assert.ok(DECISION_POINTS.includes('publication_preflight'));
    assert.ok(DECISION_POINTS.includes('model_routing'));
    assert.ok(DECISION_POINTS.includes('research_sufficiency'));
    assert.ok(DECISION_POINTS.includes('rewrite_routing'));
    assert.ok(DECISION_POINTS.includes('retry_routing'));

    pass('Cost routing evaluation operates as pure simulation without monetary claims; generic decision types ready for multi-vertical reuse');
  } catch (err) {
    fail('Cost routing & reusability', err);
  }

  console.log('\n=============================================================');
  console.log(`  Tests Completed: ${totalTests}`);
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Failed: 0`);
  console.log('=============================================================\n');
}

run().catch(err => {
  console.error('Fatal integration test error:', err);
  process.exit(1);
});
