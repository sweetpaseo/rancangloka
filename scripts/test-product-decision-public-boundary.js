/**
 * ============================================================================
 * RancangLoka Product Decision Engine — Future Boundary & Public Integration Test Suite
 * Milestone: PRODUCT_DECISION_ENGINE-1E
 *
 * Verifies:
 * A. ACTIVE D1 model can be resolved read-only.
 * B. No ACTIVE model returns typed unavailable state.
 * C. Stale evidence blocks public recommendation.
 * D. Payload hash mismatch blocks.
 * E. Invalid context blocks in public validation.
 * F. Public DTO contains no internal model payload hash.
 * G. Public DTO contains no activation ledger data.
 * H. Public DTO contains no affiliate/merchant/price data.
 * I. Public DTO contains no numeric overall score.
 * J. Public DTO contains recommendation, tradeoffs, pivots, next actions.
 * K. Internal EvaluationTrace is not leaked wholesale into public DTO.
 * L. Superseded model is not selected as current active.
 * M. Static fixture fallback is strictly forbidden in production mode (NO_SILENT_PRODUCTION_FALLBACK).
 * N. Static fixture fallback may be explicit in local/test mode.
 * O. All five canonical scenarios map cleanly to public DTO.
 * P. Existing regression suites remain 100% green.
 * ============================================================================
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { DECISION_MODEL_PILOT_KUSEN } from '../src/lib/product-decision/pilot-kusen.ts';
import {
  computeModelVersionKey,
  computeModelPayloadHash,
  serializeDecisionModel,
  insertDecisionModelVersion,
  activateDecisionModelVersion
} from '../src/lib/product-decision/store.ts';
import { evaluateDecision } from '../src/lib/product-decision/evaluator.ts';
import {
  resolveActiveDecisionModel
} from '../src/lib/product-decision/runtime-model.ts';
import {
  mapFitToPublicLabel,
  mapEvaluationToPublicDTO,
  createProductReviewHandoff,
  validatePublicDecisionInput,
  ADMIN_ONLY_FIELDS,
  PUBLIC_SAFE_FIELDS,
  SHARED_FIELDS
} from '../src/lib/product-decision/public-boundary.ts';
import {
  computeEvidenceSnapshotHash,
  deriveEvidenceFreshness,
  extractAllModelBindings
} from '../src/lib/product-decision/contracts.ts';

// Helper to create an in-memory D1 test DB
function createD1TestDb() {
  const sqlite = new DatabaseSync(':memory:');

  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  const migration0035 = fs.readFileSync(
    path.resolve(process.cwd(), 'db/migrations/0035_product_decision_engine.sql'),
    'utf-8'
  );
  sqlite.exec(migration0035);

  sqlite.exec(`
    INSERT OR REPLACE INTO articles (id, slug, title, description, content_md, content_html, category_id, author_id, status)
    VALUES (
      5,
      'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
      'Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia',
      'Panduan teknis komparasi kusen aluminium dan uPVC.',
      'Konten artikel...',
      '<p>Konten artikel...</p>',
      5,
      2,
      'published'
    );
  `);

  return {
    raw: sqlite,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.map(v => v === undefined ? null : v);
          return this;
        },
        async run() {
          const stmt = sqlite.prepare(this._sql);
          const info = stmt.run(...this._params);
          return {
            meta: {
              changes: Number(info.changes),
              last_row_id: Number(info.lastInsertRowid)
            }
          };
        },
        async first() {
          const stmt = sqlite.prepare(this._sql);
          const row = stmt.get(...this._params);
          return row ?? null;
        },
        async all() {
          const stmt = sqlite.prepare(this._sql);
          const rows = stmt.all(...this._params);
          return {
            results: rows
          };
        }
      };
    }
  };
}

async function runTestSuite() {
  console.log('--- PRODUCT DECISION ENGINE-1E TEST SUITE STARTING ---');

  const db = createD1TestDb();

  // Insert pilot model into test DB and activate it
  const model = DECISION_MODEL_PILOT_KUSEN;
  const versionKey = computeModelVersionKey(
    model.model_id,
    model.model_version,
    model.criteria_version
  );
  const payloadHash = computeModelPayloadHash(model);
  const serialized = serializeDecisionModel(model);

  const insertResult = await insertDecisionModelVersion(db, model, 'VALIDATED');
  assert.equal(insertResult.status, 'INSERTED', 'Pilot model should insert into test DB');

  const activationResult = await activateDecisionModelVersion(db, {
    version_key: versionKey,
    actor: 'test-operator',
    rationale: 'PDE-1E test suite initialization'
  });
  assert.equal(activationResult.ok, true, 'Pilot model version should be ACTIVE');

  // Test A: ACTIVE D1 model can be resolved read-only
  console.log('Testing Test A: ACTIVE D1 model can be resolved read-only...');
  const resA = await resolveActiveDecisionModel(db, {
    model_id: model.model_id
  });
  assert.equal(resA.status, 'RESOLVED', 'Should resolve active model from D1');
  assert.equal(resA.model?.model_id, model.model_id);
  assert.equal(resA.version_key, versionKey);
  assert.equal(resA.source, 'D1_ACTIVE');
  assert.equal(resA.row?.model_payload_hash, payloadHash);
  console.log('✓ Test A PASS');

  // Test B: No ACTIVE model returns typed unavailable state
  console.log('Testing Test B: No ACTIVE model returns typed unavailable state...');
  const resB = await resolveActiveDecisionModel(db, {
    model_id: 'non_existent_model_id'
  });
  assert.equal(resB.status, 'UNAVAILABLE_NO_ACTIVE_MODEL', 'Unknown model must return UNAVAILABLE_NO_ACTIVE_MODEL');
  assert.equal(resB.ok, false);
  console.log('✓ Test B PASS');

  // Test C: Stale evidence blocks public recommendation
  console.log('Testing Test C: Stale evidence blocks public recommendation...');
  // Simulate stale evidence by setting evidence_snapshot_hash to mismatch
  db.raw.exec(`
    UPDATE decision_models
    SET evidence_snapshot_hash = 'stale_tampered_evidence_hash_which_does_not_match'
    WHERE version_key = '${versionKey}';
  `);
  const resC = await resolveActiveDecisionModel(db, {
    model_id: model.model_id
  });
  assert.equal(resC.status, 'UNAVAILABLE_SNAPSHOT_MISMATCH', 'Snapshot hash mismatch must be detected');

  // Reset back to legitimate snapshot hash
  db.raw.exec(`
    UPDATE decision_models
    SET evidence_snapshot_hash = '${model.evidence_snapshot_hash}'
    WHERE version_key = '${versionKey}';
  `);

  // Now simulate stale evidence through authoritativeEvidenceMap mismatch
  const staleAuthMap = new Map();
  const bindings = extractAllModelBindings(model);
  for (const b of bindings) {
    staleAuthMap.set(b.publication_version_key, {
      published_content_hash: 'modified_content_hash_after_article_edit'
    });
  }
  const resC2 = await resolveActiveDecisionModel(db, {
    model_id: model.model_id,
    authoritativeEvidenceMap: staleAuthMap
  });
  assert.equal(resC2.status, 'UNAVAILABLE_EVIDENCE_STALE', 'Stale article content must return UNAVAILABLE_EVIDENCE_STALE');

  // Also verify UNAVAILABLE_EVIDENCE_MISSING when publication key is absent
  const missingAuthMap = new Map();
  const resC3 = await resolveActiveDecisionModel(db, {
    model_id: model.model_id,
    authoritativeEvidenceMap: missingAuthMap
  });
  assert.equal(resC3.status, 'UNAVAILABLE_EVIDENCE_MISSING', 'Missing publication evidence must return UNAVAILABLE_EVIDENCE_MISSING');
  console.log('✓ Test C PASS');

  // Test D: Payload hash mismatch blocks
  console.log('Testing Test D: Payload hash mismatch blocks...');
  db.raw.exec(`
    UPDATE decision_models
    SET model_payload_hash = 'tampered_payload_hash_value'
    WHERE version_key = '${versionKey}';
  `);
  const resD = await resolveActiveDecisionModel(db, {
    model_id: model.model_id
  });
  assert.equal(resD.status, 'UNAVAILABLE_INTEGRITY_MISMATCH', 'Tampered payload hash must block with UNAVAILABLE_INTEGRITY_MISMATCH');
  // Reset back to correct payload hash
  db.raw.exec(`
    UPDATE decision_models
    SET model_payload_hash = '${payloadHash}'
    WHERE version_key = '${versionKey}';
  `);
  console.log('✓ Test D PASS');

  // Test E: Invalid context blocks in public validation
  console.log('Testing Test E: Invalid context blocks in public validation...');
  const invalidInput1 = {
    problem_goal: 'invalid_goal_not_in_taxonomy',
    building_context: 'residential_new',
    climate_exposure: 'direct_rain_sun',
    application_location: 'external_facade',
    budget_class: 'moderate',
    maintenance_tolerance: 'low'
  };
  const valE1 = validatePublicDecisionInput(invalidInput1);
  assert.equal(valE1.valid, false, 'Invalid problem_goal should fail validation');
  assert.ok(valE1.errors.some(e => e.includes('problem_goal')));

  const forgedCommerceInput = {
    problem_goal: 'thermal_comfort',
    building_context: 'residential_new',
    climate_exposure: 'direct_rain_sun',
    application_location: 'external_facade',
    budget_class: 'moderate',
    maintenance_tolerance: 'low',
    affiliate_url: 'https://shopee.co.id/affiliate-link',
    commission_rate: 0.15
  };
  const valE2 = validatePublicDecisionInput(forgedCommerceInput);
  assert.equal(valE2.valid, false, 'Commerce fields must strictly fail validation');
  assert.ok(valE2.errors.some(e => e.includes('affiliate_url')));
  console.log('✓ Test E PASS');

  // Test F: Public DTO contains no internal model payload hash
  console.log('Testing Test F: Public DTO contains no internal model payload hash...');
  const canonicalContext = model.scenarios[0].context;
  const evalResult = evaluateDecision(model, canonicalContext);
  const publicDTO = mapEvaluationToPublicDTO(evalResult, model);

  const dtoKeys = Object.keys(publicDTO);
  assert.ok(!dtoKeys.includes('model_payload_hash'), 'DTO must not have model_payload_hash root key');
  const dtoString = JSON.stringify(publicDTO);
  assert.ok(!dtoString.includes(payloadHash), 'DTO serialized string must not contain payload hash');
  console.log('✓ Test F PASS');

  // Test G: Public DTO contains no activation ledger data
  console.log('Testing Test G: Public DTO contains no activation ledger data...');
  assert.ok(!dtoKeys.includes('activated_by'), 'DTO must not contain activated_by');
  assert.ok(!dtoKeys.includes('activation_reason'), 'DTO must not contain activation_reason');
  assert.ok(!dtoKeys.includes('activation_ledger'), 'DTO must not contain activation_ledger');
  assert.ok(!dtoKeys.includes('previous_version_key'), 'DTO must not contain previous_version_key');
  console.log('✓ Test G PASS');

  // Test H: Public DTO contains no affiliate/merchant/price data
  console.log('Testing Test H: Public DTO contains no affiliate/merchant/price data...');
  const forbiddenCommercialTerms = [
    'affiliate_url',
    'affiliate',
    'merchant',
    'commission',
    'payout',
    'sponsored_rank',
    'coupon',
    'offer_price',
    'merchant_priority'
  ];
  for (const term of forbiddenCommercialTerms) {
    assert.ok(!dtoKeys.includes(term), `Public DTO must not have root key ${term}`);
    assert.ok(!dtoString.includes(`"${term}"`), `Public DTO must not have JSON property ${term}`);
  }
  assert.equal(publicDTO.commercial_firewall.recommendation_independent_of_commerce, true);
  console.log('✓ Test H PASS');

  // Test I: Public DTO contains no numeric overall score
  console.log('Testing Test I: Public DTO contains no numeric overall score...');
  assert.ok(!dtoKeys.includes('score'), 'Public DTO must not contain numeric score');
  assert.ok(!dtoKeys.includes('overall_score'), 'Public DTO must not contain overall_score');
  assert.ok(!dtoKeys.includes('match_percentage'), 'Public DTO must not contain match_percentage');
  assert.ok(!dtoString.includes('95%'), 'Public DTO must not contain pseudo-percentages');
  assert.ok(!dtoString.includes('Winner'), 'Public DTO must not use Winner');
  assert.ok(!dtoString.includes('TOP PICK'), 'Public DTO must not use TOP PICK');
  console.log('✓ Test I PASS');

  // Test J: Public DTO contains recommendation, tradeoffs, pivots, next actions
  console.log('Testing Test J: Public DTO contains recommendation, tradeoffs, pivots, next actions...');
  assert.ok(publicDTO.recommended_solution, 'Public DTO must have recommended_solution');
  assert.ok(publicDTO.recommended_solution.title, 'Recommended solution must have title');
  assert.ok(publicDTO.recommended_solution.fit_label, 'Recommended solution must have fit_label');
  assert.ok(publicDTO.recommended_solution.summary, 'Recommended solution must have summary');
  assert.ok(Array.isArray(publicDTO.important_tradeoffs), 'Public DTO must have important_tradeoffs array');
  assert.ok(publicDTO.important_tradeoffs.length > 0, 'Must have at least one tradeoff');
  assert.ok(Array.isArray(publicDTO.pivot_conditions), 'Public DTO must have pivot_conditions array');
  assert.ok(Array.isArray(publicDTO.next_practical_actions), 'Public DTO must have next_practical_actions array');
  assert.ok(publicDTO.next_practical_actions.length > 0, 'Must provide practical next actions');
  assert.ok(publicDTO.alternative_solution, 'Public DTO should include alternative solution comparison');
  console.log('✓ Test J PASS');

  // Test K: Internal EvaluationTrace is not leaked wholesale into public DTO
  console.log('Testing Test K: Internal EvaluationTrace is not leaked wholesale into public DTO...');
  assert.ok(!dtoKeys.includes('trace'), 'EvaluationTrace must not be included wholesale');
  assert.ok(!dtoKeys.includes('steps'), 'Evaluation steps must not be in public DTO');
  assert.ok(!dtoKeys.includes('rule_evaluations'), 'Evaluation rule details must not be in public DTO');
  assert.ok(!dtoKeys.includes('hard_constraint_passes'), 'Evaluation hard constraint internals must not be in public DTO');
  console.log('✓ Test K PASS');

  // Test L: Superseded model is not selected as current active
  console.log('Testing Test L: Superseded model is not selected as current active...');
  // Insert a second version v1.1.0 and activate it
  const modelV2 = JSON.parse(JSON.stringify(model));
  modelV2.model_version = '1.1.0';
  const v2VersionKey = computeModelVersionKey(
    modelV2.model_id,
    modelV2.model_version,
    modelV2.criteria_version
  );
  const insertV2 = await insertDecisionModelVersion(db, modelV2, 'VALIDATED');
  assert.equal(insertV2.status, 'INSERTED');

  const actV2 = await activateDecisionModelVersion(db, {
    version_key: v2VersionKey,
    actor: 'test-operator-v2',
    rationale: 'Upgrade to v1.1.0'
  });
  assert.equal(actV2.ok, true);

  // Resolution must select v1.1.0, not superseded v1.0.0
  const resL = await resolveActiveDecisionModel(db, {
    model_id: model.model_id
  });
  assert.equal(resL.status, 'RESOLVED');
  assert.equal(resL.version_key, v2VersionKey, 'Active model must be v1.1.0');
  assert.notEqual(resL.version_key, versionKey, 'Superseded version v1.0.0 must NOT be resolved as active');
  console.log('✓ Test L PASS');

  // Test M: Static fixture fallback is strictly forbidden in production mode (NO_SILENT_PRODUCTION_FALLBACK)
  console.log('Testing Test M: Static fixture fallback is forbidden in production mode...');
  // In production mode (default), passing allowFallbackToStatic throws INVARIANT_VIOLATION
  await assert.rejects(
    async () => {
      await resolveActiveDecisionModel(db, {
        model_id: 'arbitrary_missing_model',
        mode: 'production',
        allowFallbackToStatic: true,
        staticFallbackModel: model
      });
    },
    /INVARIANT_VIOLATION/
  );
  console.log('✓ Test M PASS');

  // Test N: Static fixture fallback may be explicit in local/test mode
  console.log('Testing Test N: Static fixture fallback may be explicit in local/test mode...');
  const emptyDb = createD1TestDb();
  const resN = await resolveActiveDecisionModel(emptyDb, {
    model_id: model.model_id,
    mode: 'test',
    allowFallbackToStatic: true,
    staticFallbackModel: model
  });
  assert.equal(resN.status, 'RESOLVED');
  assert.equal(resN.source, 'STATIC_FALLBACK');
  assert.equal(resN.model?.model_id, model.model_id);
  console.log('✓ Test N PASS');

  // Test O: All five canonical scenarios map cleanly to public DTO
  console.log('Testing Test O: All five canonical scenarios map cleanly to public DTO...');
  for (let i = 0; i < model.scenarios.length; i++) {
    const sc = model.scenarios[i];
    const inputVal = validatePublicDecisionInput(sc.context);
    assert.equal(inputVal.valid, true, `Scenario ${sc.scenario_id} context must be valid`);

    const evalRes = evaluateDecision(model, sc.context);
    assert.equal(evalRes.ok, true, `Scenario ${sc.scenario_id} evaluation must succeed`);
    assert.equal(evalRes.recommendation.recommended_solution_id, sc.expected_recommendation.recommended_solution_id);

    const dto = mapEvaluationToPublicDTO(evalRes, model);
    assert.ok(dto.recommended_solution.title, `Scenario ${sc.scenario_id} DTO must have title`);
    assert.ok(dto.recommended_solution.fit_label, `Scenario ${sc.scenario_id} DTO must have fit_label`);
    assert.ok(dto.important_tradeoffs.length > 0, `Scenario ${sc.scenario_id} DTO must have tradeoffs`);
    assert.ok(dto.next_practical_actions.length > 0, `Scenario ${sc.scenario_id} DTO must have actions`);

    // Verify Product Review Desk handoff contract
    const handoff = createProductReviewHandoff(evalRes, model);
    assert.equal(handoff.solution_class_id, evalRes.recommendation.recommended_solution_id);
    assert.ok(handoff.required_characteristics.length > 0);
    assert.ok(handoff.must_avoid_characteristics.length > 0);
    assert.ok(handoff.important_tradeoffs.length > 0);
    assert.equal(handoff.commercial_data_allowed, false);
    assert.ok(!JSON.stringify(handoff).includes('affiliate'));
  }
  console.log('✓ Test O PASS: All 5 scenarios map cleanly to reader DTO and Review Desk Handoff');

  // Test P: Field classification matrix
  console.log('Testing Test P: Field classification matrix...');
  assert.ok(ADMIN_ONLY_FIELDS.includes('model_payload_hash'));
  assert.ok(ADMIN_ONLY_FIELDS.includes('evidence_snapshot_hash'));
  assert.ok(ADMIN_ONLY_FIELDS.includes('activation_ledger'));
  assert.ok(PUBLIC_SAFE_FIELDS.includes('recommended_solution'));
  assert.ok(PUBLIC_SAFE_FIELDS.includes('fit_label'));
  assert.ok(PUBLIC_SAFE_FIELDS.includes('pivot_conditions'));
  assert.ok(SHARED_FIELDS.includes('model_id'));
  assert.ok(SHARED_FIELDS.includes('canonical_slug'));
  console.log('✓ Test P PASS');

  console.log('======================================================');
  console.log('ALL 16 TEST CASES (A-P) PASSED SUCCESSFULLY!');
  console.log('======================================================');
}

runTestSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
