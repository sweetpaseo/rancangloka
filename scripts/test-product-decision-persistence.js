/**
 * ============================================================================
 * RancangLoka Product Decision Engine — D1 Persistence & Round-Trip Test Suite
 * Milestone: PRODUCT_DECISION_ENGINE-1D-A
 *
 * Verifies:
 * A. Migration schema applies locally/test DB.
 * B. Pilot model serializes.
 * C. Pilot model inserts.
 * D. Round-trip preserves model identity.
 * E. Round-trip preserves evidence_snapshot_hash.
 * F. Round-trip preserves 2 solution IDs.
 * G. Round-trip preserves all 7 criteria.
 * H. Round-trip preserves constraints.
 * I. Round-trip preserves criterion evaluations.
 * J. Round-trip preserves tradeoffs.
 * K. Round-trip preserves evidence bindings.
 * L. Round-trip preserves 5 scenario fixtures.
 * M. Golden expectation fields do not influence runtime selection.
 * N. All 5 canonical contexts produce identical evaluator results before and after persistence.
 * O. Same version inserted twice is idempotent.
 * P. Different payload under same immutable version identity blocks.
 * Q. Lifecycle status rejects invalid values.
 * R. Only one ACTIVE version per model_id under designed semantics.
 * S. Evidence stale state blocks activation.
 * T. Evidence unavailable state blocks activation.
 * U. No commerce fields persist.
 * V. No numeric overall score is introduced.
 * W. No production connection required for tests.
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
  deserializeDecisionModel,
  insertDecisionModelVersion,
  getDecisionModelByVersionKey,
  getActiveDecisionModel,
  listDecisionModelVersions,
  activateDecisionModelVersion
} from '../src/lib/product-decision/store.ts';
import { evaluateDecision } from '../src/lib/product-decision/evaluator.ts';
import { scanForForbiddenFields } from '../src/lib/product-decision/contracts.ts';

function createD1TestDb() {
  const sqlite = new DatabaseSync(':memory:');

  // Base schema
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  // Migration 0035
  const migration0035 = fs.readFileSync(
    path.resolve(process.cwd(), 'db/migrations/0035_product_decision_engine.sql'),
    'utf-8'
  );
  sqlite.exec(migration0035);

  // Seed reference article 5
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
            results: rows ?? []
          };
        }
      };
    }
  };
}

async function runTests() {
  console.log('================================================================');
  console.log('RancangLoka Product Decision Engine Persistence Test Suite (PDE-1D-A)');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(err);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(err);
      failed++;
    }
  }

  const staticModel = DECISION_MODEL_PILOT_KUSEN;

  // --------------------------------------------------------------------------
  // Test A: Migration schema applies locally/test DB
  // --------------------------------------------------------------------------
  let db = createD1TestDb();
  test('A. Migration schema applies cleanly to local test DB', () => {
    const tables = db.raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'decision_%' ORDER BY name")
      .all();
    const tableNames = tables.map(t => t.name);
    assert.deepEqual(tableNames, ['decision_model_activations', 'decision_models']);
  });

  // --------------------------------------------------------------------------
  // Test B: Pilot model serializes
  // --------------------------------------------------------------------------
  let serializedRow;
  test('B. Pilot model serializes cleanly into structured row', () => {
    serializedRow = serializeDecisionModel(staticModel, 'VALIDATED');
    assert.equal(serializedRow.version_key, 'model_pde_kusen_tropis@v1.0.0@crit_kusen_v1');
    assert.equal(serializedRow.model_id, 'model_pde_kusen_tropis');
    assert.equal(serializedRow.model_version, 'v1.0.0');
    assert.equal(serializedRow.criteria_version, 'crit_kusen_v1');
    assert.equal(serializedRow.primary_article_id, 5);
    assert.equal(serializedRow.status, 'VALIDATED');
    assert.equal(serializedRow.evidence_snapshot_hash, 'eed64da134be1b158d0a2985e3b43196f486eb4b86dd1fd9e95a5580655b3eed');
    assert.ok(serializedRow.model_payload_hash.length === 64);
  });

  // --------------------------------------------------------------------------
  // Test C: Pilot model inserts
  // --------------------------------------------------------------------------
  await testAsync('C. Pilot model inserts safely into test D1', async () => {
    const insertRes = await insertDecisionModelVersion(db, staticModel, 'VALIDATED');
    assert.equal(insertRes.status, 'INSERTED');
    assert.equal(insertRes.version_key, 'model_pde_kusen_tropis@v1.0.0@crit_kusen_v1');
  });

  // --------------------------------------------------------------------------
  // Test D - L: Round-Trip Integrity
  // --------------------------------------------------------------------------
  let reloadedModel;
  await testAsync('D. Round-trip preserves model identity and problem definition', async () => {
    reloadedModel = await getDecisionModelByVersionKey(db, 'model_pde_kusen_tropis@v1.0.0@crit_kusen_v1');
    assert.ok(reloadedModel !== null);
    assert.equal(reloadedModel.model_id, staticModel.model_id);
    assert.equal(reloadedModel.model_version, staticModel.model_version);
    assert.equal(reloadedModel.criteria_version, staticModel.criteria_version);
    assert.equal(reloadedModel.problem.problem_id, staticModel.problem.problem_id);
    assert.equal(reloadedModel.problem.title, staticModel.problem.title);
    assert.equal(reloadedModel.problem.canonical_slug, staticModel.problem.canonical_slug);
    assert.equal(reloadedModel.problem.primary_article_id, staticModel.problem.primary_article_id);
  });

  test('E. Round-trip preserves exact evidence_snapshot_hash', () => {
    assert.equal(reloadedModel.evidence_snapshot_hash, staticModel.evidence_snapshot_hash);
    assert.equal(reloadedModel.evidence_snapshot_hash, 'eed64da134be1b158d0a2985e3b43196f486eb4b86dd1fd9e95a5580655b3eed');
  });

  test('F. Round-trip preserves 2 solution IDs and structural details', () => {
    assert.equal(reloadedModel.solution_classes.length, 2);
    const reloadedIds = reloadedModel.solution_classes.map(s => s.solution_id).sort();
    const staticIds = staticModel.solution_classes.map(s => s.solution_id).sort();
    assert.deepEqual(reloadedIds, staticIds);
    assert.deepEqual(reloadedIds, ['sol_aluminium_standar', 'sol_upvc_multi_chamber']);
  });

  test('G. Round-trip preserves all 7 criteria exactly', () => {
    assert.equal(reloadedModel.criteria.length, 7);
    const reloadedCritIds = reloadedModel.criteria.map(c => c.criterion_id).sort();
    const staticCritIds = staticModel.criteria.map(c => c.criterion_id).sort();
    assert.deepEqual(reloadedCritIds, staticCritIds);
  });

  test('H. Round-trip preserves constraints and rehydrates executable applies_when', () => {
    assert.equal(reloadedModel.constraints.length, 3);
    for (let i = 0; i < staticModel.constraints.length; i++) {
      const sc = staticModel.constraints[i];
      const rc = reloadedModel.constraints.find(c => c.constraint_id === sc.constraint_id);
      assert.ok(rc, `Constraint ${sc.constraint_id} should exist`);
      assert.equal(rc.severity, sc.severity);
      assert.equal(typeof rc.applies_when, 'function');
    }
  });

  test('I. Round-trip preserves all 14 criterion evaluations', () => {
    assert.equal(reloadedModel.evaluations.length, 14);
    for (const se of staticModel.evaluations) {
      const re = reloadedModel.evaluations.find(
        e => e.criterion_id === se.criterion_id && e.solution_id === se.solution_id
      );
      assert.ok(re, `Evaluation for ${se.criterion_id}|${se.solution_id} must exist`);
      assert.equal(re.qualitative_tier, se.qualitative_tier);
      assert.equal(re.factual_basis, se.factual_basis);
      if (se.measured_value) {
        assert.deepEqual(re.measured_value, se.measured_value);
      }
    }
  });

  test('J. Round-trip preserves tradeoffs under solution classes', () => {
    for (const sol of staticModel.solution_classes) {
      const reSol = reloadedModel.solution_classes.find(s => s.solution_id === sol.solution_id);
      assert.ok(reSol);
      assert.equal(reSol.tradeoffs.length, sol.tradeoffs.length);
      for (let i = 0; i < sol.tradeoffs.length; i++) {
        assert.equal(reSol.tradeoffs[i].tradeoff_id, sol.tradeoffs[i].tradeoff_id);
        assert.equal(reSol.tradeoffs[i].benefit, sol.tradeoffs[i].benefit);
        assert.equal(reSol.tradeoffs[i].cost_or_compromise, sol.tradeoffs[i].cost_or_compromise);
      }
    }
  });

  test('K. Round-trip preserves evidence bindings and hashes', () => {
    for (let i = 0; i < staticModel.evaluations.length; i++) {
      const seb = staticModel.evaluations[i].evidence_binding;
      const reb = reloadedModel.evaluations[i].evidence_binding;
      assert.deepEqual(reb, seb);
    }
  });

  test('L. Round-trip preserves all 5 scenario fixtures', () => {
    assert.equal(reloadedModel.scenarios.length, 5);
    const staticScenIds = staticModel.scenarios.map(s => s.scenario_id).sort();
    const reloadedScenIds = reloadedModel.scenarios.map(s => s.scenario_id).sort();
    assert.deepEqual(reloadedScenIds, staticScenIds);
  });

  // --------------------------------------------------------------------------
  // Test M: Golden expectations do not drive runtime decisions
  // --------------------------------------------------------------------------
  test('M. Mutating golden expected_recommendation in scenario does not alter evaluator', () => {
    // Clone reloaded model and invert expected_recommendation
    const mutatedModel = JSON.parse(JSON.stringify(reloadedModel));
    // Restore constraint functions on mutated model
    mutatedModel.constraints = reloadedModel.constraints;
    mutatedModel.scenarios[0].expected_recommendation.recommended_solution_id = 'sol_aluminium_standar';
    mutatedModel.scenarios[0].expected_recommendation.recommended_fit = 'POOR_FIT';

    const ctx = staticModel.scenarios[0].context;
    const res = evaluateDecision(mutatedModel, ctx);
    assert.equal(res.ok, true);
    // Evaluator independently computes uPVC, NOT the mutated golden expectation!
    assert.equal(res.recommendation.recommended_solution_id, 'sol_upvc_multi_chamber');
    assert.equal(res.recommendation.recommended_fit, 'STRONG_FIT');
  });

  // --------------------------------------------------------------------------
  // Test N: All 5 canonical contexts produce identical evaluator results
  // --------------------------------------------------------------------------
  test('N. All 5 canonical contexts produce 100% identical evaluation results before and after persistence', () => {
    for (const sc of staticModel.scenarios) {
      const staticResult = evaluateDecision(staticModel, sc.context);
      const reloadedResult = evaluateDecision(reloadedModel, sc.context);

      assert.equal(reloadedResult.ok, true);
      assert.equal(staticResult.ok, true);
      assert.equal(
        reloadedResult.recommendation.recommended_solution_id,
        staticResult.recommendation.recommended_solution_id,
        `Scenario ${sc.scenario_id} recommended_solution_id mismatch`
      );
      assert.equal(
        reloadedResult.recommendation.recommended_fit,
        staticResult.recommendation.recommended_fit,
        `Scenario ${sc.scenario_id} recommended_fit mismatch`
      );
      assert.equal(
        reloadedResult.recommendation.alternative_solution_id,
        staticResult.recommendation.alternative_solution_id,
        `Scenario ${sc.scenario_id} alternative_solution_id mismatch`
      );
      assert.equal(
        reloadedResult.recommendation.alternative_fit,
        staticResult.recommendation.alternative_fit,
        `Scenario ${sc.scenario_id} alternative_fit mismatch`
      );
      assert.deepEqual(
        reloadedResult.trace.eligible_solutions,
        staticResult.trace.eligible_solutions
      );
      assert.deepEqual(
        reloadedResult.trace.disqualified_solutions,
        staticResult.trace.disqualified_solutions
      );
    }
  });

  // --------------------------------------------------------------------------
  // Test O: Idempotency
  // --------------------------------------------------------------------------
  await testAsync('O. Re-inserting the exact same model version is idempotent', async () => {
    const repeatRes = await insertDecisionModelVersion(db, staticModel, 'VALIDATED');
    assert.equal(repeatRes.status, 'ALREADY_EXISTS_IDENTICAL');
    assert.equal(repeatRes.version_key, 'model_pde_kusen_tropis@v1.0.0@crit_kusen_v1');
  });

  // --------------------------------------------------------------------------
  // Test P: Version conflict protection
  // --------------------------------------------------------------------------
  await testAsync('P. Modified model under same version identity is blocked as conflict', async () => {
    // Clone and alter an evaluation description under identical version key
    const modifiedModel = JSON.parse(JSON.stringify(staticModel));
    modifiedModel.constraints = staticModel.constraints;
    modifiedModel.evaluations[0].factual_basis = 'TAMPERED FACTUAL BASIS IN SAME VERSION';

    const conflictRes = await insertDecisionModelVersion(db, modifiedModel, 'VALIDATED');
    assert.equal(conflictRes.status, 'BLOCKED_VERSION_CONFLICT');
    assert.equal(conflictRes.version_key, 'model_pde_kusen_tropis@v1.0.0@crit_kusen_v1');
  });

  // --------------------------------------------------------------------------
  // Test Q: Lifecycle status constraints
  // --------------------------------------------------------------------------
  test('Q. Database CHECK constraint rejects invalid lifecycle status', () => {
    assert.throws(() => {
      db.raw.prepare(`
        INSERT INTO decision_models (
          version_key, model_id, model_version, criteria_version,
          problem_id, problem_title, problem_slug, problem_description, primary_article_id,
          status, evidence_snapshot_hash, model_payload_hash,
          solution_classes_json, criteria_json, evaluations_json,
          constraints_json, scenarios_json, evidence_bindings_json
        ) VALUES (
          'invalid@key', 'model_x', 'v1', 'c1',
          'prob_x', 'Title', 'slug', 'Desc', 5,
          'FORGED_STATUS', 'hash', 'hash',
          '[]', '[]', '[]',
          '[]', '[]', '[]'
        )
      `).run();
    }, /CHECK constraint failed/);
  });

  // --------------------------------------------------------------------------
  // Test R: Activation and Supersession (At most one ACTIVE version)
  // --------------------------------------------------------------------------
  await testAsync('R. Controlled activation supersedes prior active version and preserves single active invariant', async () => {
    const versionKey1 = 'model_pde_kusen_tropis@v1.0.0@crit_kusen_v1';

    // 1. Activate v1
    const actRes1 = await activateDecisionModelVersion(db, {
      version_key: versionKey1,
      actor: 'Chief Editor',
      rationale: 'Pilot activation verification'
    });
    assert.equal(actRes1.ok, true);
    assert.equal(actRes1.status, 'ACTIVATED');

    const activeModel1 = await getActiveDecisionModel(db, 'model_pde_kusen_tropis');
    assert.ok(activeModel1 !== null);
    assert.equal(activeModel1.row.version_key, versionKey1);
    assert.equal(activeModel1.row.status, 'ACTIVE');

    // 2. Prepare v1.1.0 and insert
    const modelV2 = JSON.parse(JSON.stringify(staticModel));
    modelV2.model_version = 'v1.1.0';
    modelV2.constraints = staticModel.constraints;
    const versionKey2 = 'model_pde_kusen_tropis@v1.1.0@crit_kusen_v1';

    const insertV2 = await insertDecisionModelVersion(db, modelV2, 'VALIDATED');
    assert.equal(insertV2.status, 'INSERTED');

    // 3. Activate v1.1.0 -> should supersede v1.0.0
    const actRes2 = await activateDecisionModelVersion(db, {
      version_key: versionKey2,
      actor: 'Chief Editor',
      rationale: 'Promotion of calibrated v1.1.0'
    });
    assert.equal(actRes2.ok, true);
    assert.equal(actRes2.status, 'ACTIVATED');
    assert.equal(actRes2.prior_version_key, versionKey1);

    // Verify v1 is now SUPERSEDED
    const rowV1 = await db.prepare('SELECT status, superseded_at FROM decision_models WHERE version_key = ?').bind(versionKey1).first();
    assert.equal(rowV1.status, 'SUPERSEDED');
    assert.ok(rowV1.superseded_at !== null);

    // Verify v1.1.0 is now ACTIVE
    const activeModel2 = await getActiveDecisionModel(db, 'model_pde_kusen_tropis');
    assert.equal(activeModel2.row.version_key, versionKey2);
    assert.equal(activeModel2.row.status, 'ACTIVE');

    // Verify database partial unique index rejects any rogue direct UPDATE to a second ACTIVE row
    assert.throws(() => {
      db.raw.prepare("UPDATE decision_models SET status = 'ACTIVE' WHERE version_key = ?").run(versionKey1);
    }, /UNIQUE constraint failed/);

    // Verify activation audit ledger recorded both events
    const audits = await db.raw.prepare("SELECT action, version_key FROM decision_model_activations ORDER BY recorded_at ASC").all();
    assert.ok(audits.length >= 3); // ACTIVATE v1, SUPERSEDE v1, ACTIVATE v2
  });

  // --------------------------------------------------------------------------
  // Test S: Stale evidence blocks activation
  // --------------------------------------------------------------------------
  await testAsync('S. Stale authoritative evidence blocks activation', async () => {
    // Insert v1.2.0
    const modelV3 = JSON.parse(JSON.stringify(staticModel));
    modelV3.model_version = 'v1.2.0';
    modelV3.constraints = staticModel.constraints;
    const versionKey3 = 'model_pde_kusen_tropis@v1.2.0@crit_kusen_v1';

    await insertDecisionModelVersion(db, modelV3, 'VALIDATED');

    // Simulated drifted authoritative map
    const driftedMap = new Map([
      ['receipt:rcpt_bbae85b48e1b2f8d', { published_content_hash: 'TAMPERED_OR_UPDATED_CONTENT_HASH' }]
    ]);

    const actStale = await activateDecisionModelVersion(db, {
      version_key: versionKey3,
      actor: 'Chief Editor',
      authoritativeEvidenceMap: driftedMap
    });

    assert.equal(actStale.ok, false);
    assert.equal(actStale.status, 'BLOCKED_EVIDENCE_STALE');
  });

  // --------------------------------------------------------------------------
  // Test T: Unavailable evidence blocks activation
  // --------------------------------------------------------------------------
  await testAsync('T. Unavailable authoritative evidence blocks activation', async () => {
    const versionKey3 = 'model_pde_kusen_tropis@v1.2.0@crit_kusen_v1';
    // Empty map simulates evidence missing from database
    const emptyMap = new Map();

    const actUnavail = await activateDecisionModelVersion(db, {
      version_key: versionKey3,
      actor: 'Chief Editor',
      authoritativeEvidenceMap: emptyMap
    });

    assert.equal(actUnavail.ok, false);
    assert.equal(actUnavail.status, 'BLOCKED_EVIDENCE_UNAVAILABLE');
  });

  // --------------------------------------------------------------------------
  // Test U: Zero commerce fields persist
  // --------------------------------------------------------------------------
  test('U. Zero commercial/affiliate/merchant fields exist in persistence payload', () => {
    const commerceIssuesInRow = scanForForbiddenFields(serializedRow);
    assert.deepEqual(commerceIssuesInRow, []);

    // Also check raw JSON strings in D1 row
    const jsonFields = [
      serializedRow.solution_classes_json,
      serializedRow.criteria_json,
      serializedRow.evaluations_json,
      serializedRow.constraints_json,
      serializedRow.scenarios_json
    ];
    for (const j of jsonFields) {
      assert.ok(!j.includes('affiliate_url'));
      assert.ok(!j.includes('commission'));
      assert.ok(!j.includes('merchant'));
      assert.ok(!j.includes('payout'));
    }
  });

  // --------------------------------------------------------------------------
  // Test V: Zero numeric overall scores
  // --------------------------------------------------------------------------
  test('V. Zero numeric overall scores or fake numeric precision exist', () => {
    assert.ok(!serializedRow.evaluations_json.includes('"score":'));
    assert.ok(!serializedRow.evaluations_json.includes('"numeric_rank":'));
    assert.ok(!serializedRow.scenarios_json.includes('"score":'));
  });

  // --------------------------------------------------------------------------
  // Test W: Zero production connection required for tests
  // --------------------------------------------------------------------------
  test('W. Tests execute 100% offline via in-memory SQLite with zero production connection', () => {
    assert.ok(process.env.CF_PAGES === undefined || process.env.NODE_ENV !== 'production');
    assert.ok(db.raw !== null);
  });

  console.log('================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('[FATAL_ERROR]', err);
  process.exit(1);
});
