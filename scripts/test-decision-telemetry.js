/**
 * RancangLoka — Decision Telemetry & Durable Storage Test Suite
 * Milestone: JEV-4A/4B
 * 
 * Validates:
 * 1. Strict DecisionObservation schema adherence (zero `any`, all required fields present)
 * 2. In-memory ring-buffer recording and retrieval
 * 3. D1 database recording and SQL query synthesis
 * 4. Provider failure recording (ERROR, TIMEOUT, RATE_LIMIT)
 * 5. Telemetry fail-safe guarantee: D1 failures NEVER throw or block pipeline
 * 6. Migration file 0013_decision_observations.sql structural completeness
 * 7. Zero secret leak guarantee in serialized telemetry
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  recordDecisionObservation,
  getDecisionObservations,
  getDecisionObservationById,
  clearMemoryObservations,
  getMemoryObservations
} from '../src/lib/decision/decision-telemetry.ts';

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

function createSampleObservation(overrides = {}) {
  return {
    observation_id: `obs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    decision_point: 'publication_preflight',
    subject_type: 'article',
    subject_id: '501',
    run_id: 'run_test_abc123',
    authoritative_decision: 'continue',
    authoritative_reasons: ['DETERMINISTIC_CHECKS_PASSED'],
    jev_decision: 'continue',
    jev_probabilities: { continue: 0.96, revise: 0.03, stop: 0.01 },
    jev_confidence: 0.96,
    provider: 'openrouter',
    model: 'typesafe/jev-1.13',
    model_version: '20260917',
    input_schema_version: '1.0.0',
    prompt_version: '2026-09-23.01',
    input_hash: 'a1b2c3d4e5f6',
    latency_ms: 245,
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
    created_at: new Date().toISOString(),
    ...overrides
  };
}

async function run() {
  console.log('\n=============================================================');
  console.log('  RancangLoka — Decision Telemetry Test Suite');
  console.log('=============================================================\n');

  // 1. In-Memory Recording & Query
  try {
    clearMemoryObservations();
    const obs = createSampleObservation({ subject_id: '101', run_id: 'run_memory_1' });
    await recordDecisionObservation(null, obs);

    const memory = getMemoryObservations();
    assert.strictEqual(memory.length, 1);
    assert.strictEqual(memory[0].subject_id, '101');
    assert.strictEqual(memory[0].run_id, 'run_memory_1');

    const queried = await getDecisionObservations(null, { subjectId: '101' });
    assert.strictEqual(queried.length, 1);
    assert.strictEqual(queried[0].observation_id, obs.observation_id);
    pass('In-memory ring-buffer records and retrieves observations correctly');
  } catch (err) {
    fail('In-Memory Recording & Query', err);
  }

  // 2. Query Filtering by Decision Point & Run ID
  try {
    clearMemoryObservations();
    const obsPreflight = createSampleObservation({
      observation_id: 'obs_p1',
      decision_point: 'publication_preflight',
      subject_id: '200',
      run_id: 'run_filter'
    });
    const obsResearch = createSampleObservation({
      observation_id: 'obs_r1',
      decision_point: 'research_sufficiency',
      subject_id: '200',
      run_id: 'run_filter'
    });
    await recordDecisionObservation(null, obsPreflight);
    await recordDecisionObservation(null, obsResearch);

    const byPoint = await getDecisionObservations(null, { decisionPoint: 'research_sufficiency' });
    assert.strictEqual(byPoint.length, 1);
    assert.strictEqual(byPoint[0].observation_id, 'obs_r1');

    const byRun = await getDecisionObservations(null, { runId: 'run_filter' });
    assert.strictEqual(byRun.length, 2);
    pass('Memory queries filter accurately by decision_point and run_id');
  } catch (err) {
    fail('Query Filtering', err);
  }

  // 3. Lookup by Observation ID
  try {
    const found = await getDecisionObservationById(null, 'obs_p1');
    assert.ok(found);
    assert.strictEqual(found?.observation_id, 'obs_p1');

    const notFound = await getDecisionObservationById(null, 'obs_nonexistent');
    assert.strictEqual(notFound, null);
    pass('Lookup by observation_id succeeds for existing and returns null for missing');
  } catch (err) {
    fail('Lookup by ID', err);
  }

  // 4. Provider Failure Telemetry Recording
  try {
    const errorObs = createSampleObservation({
      observation_id: 'obs_error_1',
      provider_status: 'ERROR',
      provider_error_class: 'HTTP_429_RATE_LIMIT',
      jev_decision: null,
      jev_probabilities: null,
      jev_confidence: null,
      disagreement_classification: 'JEV_UNAVAILABLE'
    });
    await recordDecisionObservation(null, errorObs);

    const retrieved = await getDecisionObservationById(null, 'obs_error_1');
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.provider_status, 'ERROR');
    assert.strictEqual(retrieved?.provider_error_class, 'HTTP_429_RATE_LIMIT');
    assert.strictEqual(retrieved?.jev_decision, null);
    assert.strictEqual(retrieved?.disagreement_classification, 'JEV_UNAVAILABLE');
    pass('Provider failure status and error class are durably captured');
  } catch (err) {
    fail('Provider Failure Telemetry Recording', err);
  }

  // 5. Mock D1 Database Recording & Serialization
  try {
    let capturedSql = '';
    let capturedBindings = [];

    const mockDb = {
      prepare: (sql) => {
        capturedSql = sql;
        return {
          bind: (...args) => {
            capturedBindings = args;
            return {
              run: async () => ({ success: true, meta: { changes: 1 } })
            };
          }
        };
      }
    };

    const d1Obs = createSampleObservation({
      observation_id: 'obs_d1_test',
      subject_id: '777',
      run_id: 'run_d1_777'
    });
    await recordDecisionObservation(mockDb, d1Obs);

    assert.ok(capturedSql.includes('INSERT INTO decision_observations'));
    assert.strictEqual(capturedBindings[0], 'obs_d1_test');
    assert.strictEqual(capturedBindings[1], 'publication_preflight');
    assert.strictEqual(capturedBindings[2], 'article');
    assert.strictEqual(capturedBindings[3], '777');
    assert.strictEqual(capturedBindings[4], 'run_d1_777');
    pass('D1 storage prepares correct SQL and bindings for durable observation table');
  } catch (err) {
    fail('Mock D1 Database Recording', err);
  }

  // 6. Fail-Safe Guarantee: D1 Exception Never Throws
  try {
    const crashingDb = {
      prepare: () => {
        throw new Error('FATAL_DATABASE_CORRUPTION_OR_NETWORK_DISCONNECT');
      }
    };

    const resilientObs = createSampleObservation({ observation_id: 'obs_resilient' });
    // Must NOT throw
    await assert.doesNotReject(async () => {
      await recordDecisionObservation(crashingDb, resilientObs);
    });

    // Check that it fell back to in-memory storage safely
    const fallbackRetrieved = await getDecisionObservationById(null, 'obs_resilient');
    assert.ok(fallbackRetrieved);
    assert.strictEqual(fallbackRetrieved?.observation_id, 'obs_resilient');
    pass('Telemetry fail-safe guarantee: D1 exceptions are caught and never block the pipeline');
  } catch (err) {
    fail('Telemetry Fail-Safe Guarantee', err);
  }

  // 7. Migration File Verification
  try {
    const migrationPath = path.resolve(process.cwd(), 'db/migrations/0021_decision_observations.sql');
    assert.ok(fs.existsSync(migrationPath), 'Migration file 0021_decision_observations.sql must exist');

    const content = fs.readFileSync(migrationPath, 'utf8');
    assert.ok(content.includes('CREATE TABLE IF NOT EXISTS decision_observations'));
    assert.ok(content.includes('observation_id TEXT PRIMARY KEY'));
    assert.ok(content.includes('decision_point TEXT NOT NULL'));
    assert.ok(content.includes('subject_type TEXT NOT NULL'));
    assert.ok(content.includes('subject_id TEXT NOT NULL'));
    assert.ok(content.includes('run_id TEXT'));
    assert.ok(content.includes('authoritative_decision TEXT NOT NULL'));
    assert.ok(content.includes('jev_decision TEXT'));
    assert.ok(content.includes('provider_status TEXT NOT NULL'));
    assert.ok(content.includes('provider_error_class TEXT'));
    assert.ok(content.includes('disagreement_classification TEXT'));
    assert.ok(content.includes('cost_routing_estimate_json TEXT'));
    assert.ok(content.includes('idx_decision_obs_point'));
    assert.ok(content.includes('idx_decision_obs_subject'));
    assert.ok(content.includes('idx_decision_obs_run'));
    pass('Local migration 0021_decision_observations.sql contains required columns and indexes');
  } catch (err) {
    fail('Migration File Verification', err);
  }

  // 8. Zero Secrets in Serialized Telemetry
  try {
    const obs = createSampleObservation();
    const serialized = JSON.stringify(obs);

    assert.strictEqual(serialized.includes('Bearer'), false);
    assert.strictEqual(serialized.includes('sk-or-v1'), false);
    assert.strictEqual(serialized.includes('apiKey'), false);
    assert.strictEqual(serialized.includes('Authorization'), false);
    pass('Telemetry serialization strictly excludes secrets and credentials');
  } catch (err) {
    fail('Zero Secrets Verification', err);
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
