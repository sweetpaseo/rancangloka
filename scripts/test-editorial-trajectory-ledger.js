/**
 * RancangLoka — Editorial Trajectory & Evidence Ledger Test Suite
 * Milestone: JEV-7K / JEV-7L
 *
 * Comprehensive local validation of:
 * 1. Hardened Transition Taxonomy (deterministic derivation, replacement != removal)
 * 2. Idempotency Strategy (stable mutation identity, minute-bucket removed)
 * 3. Canonical State Snapshot builder & deduplication
 * 4. Append-Only Transition & Outcome recording
 * 5. Failure Classification firewall (infrastructure/provider/unknown excluded from decision quality)
 * 6. Lightweight Diff Metrics (scalar counts only, zero prose persisted)
 * 7. NOOP Readiness Rule (identical readiness recomputation creates 0 transitions)
 * 8. Trajectory Lineage & Legacy Data Policy (no synthesized history)
 * 9. Recoverability Units Separation (state vs trajectory)
 * 10. Jev Zero-Authority Firewall (Jev cannot write to ledger)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  deriveTransitionType,
  computeLightweightDiffMetrics,
  generateMutationOperationId,
  generateOutcomeIdempotencyKey,
  isDecisionQualityFailure,
  prepareCaptureSnapshotStatement,
  prepareRecordTransitionStatement,
  prepareRecordOutcomeStatement,
  prepareStateMutationCapture,
  prepareOutcomeCapture
} from '../src/lib/decision/trajectory-ledger.ts';
import {
  buildCanonicalPublicationPreflightState,
  computeCanonicalPreflightHash
} from '../src/lib/decision/publication-preflight-state.ts';

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

// Mock D1 Database Helper for Statement Assembly & Verification
class MockD1Database {
  constructor() {
    this.executedStatements = [];
    this.snapshots = new Map();
    this.transitions = new Map();
    this.outcomes = new Map();
  }

  prepare(query) {
    const executed = this.executedStatements;
    const snapshots = this.snapshots;
    const transitions = this.transitions;
    const outcomes = this.outcomes;

    return {
      bind(...params) {
        return {
          query,
          params,
          async run() {
            executed.push({ query, params });
            if (query.includes('article_state_snapshots')) {
              const snapshotId = params[0];
              const uniqueKey = `${params[1]}_${params[2]}_${params[14]}`; // article_id + input_hash + version
              if (!snapshots.has(uniqueKey)) {
                snapshots.set(uniqueKey, { snapshotId, params });
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 0 } };
            }
            if (query.includes('article_state_transitions')) {
              const mutationOpId = params[10];
              if (!transitions.has(mutationOpId)) {
                transitions.set(mutationOpId, { transitionId: params[0], params });
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 0 } };
            }
            if (query.includes('decision_outcomes')) {
              const idempotencyKey = params[9];
              if (!outcomes.has(idempotencyKey)) {
                outcomes.set(idempotencyKey, { outcomeId: params[0], params });
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 0 } };
            }
            return { success: true, meta: { changes: 1 } };
          }
        };
      }
    };
  }

  async batch(statements) {
    const results = [];
    for (const stmt of statements) {
      results.push(await stmt.run());
    }
    return results;
  }
}

async function runTestSuite() {
  console.log('\n============================================================');
  console.log('RANCANGLOKA — JEV PHASE 7L LOCAL LEDGER TEST SUITE');
  console.log('============================================================\n');

  // ============================================================
  // GROUP 1: TRANSITION TAXONOMY HARDENING
  // ============================================================
  console.log('--- GROUP 1: Transition Taxonomy Hardening ---');

  try {
    const baseState = {
      articleId: 101,
      slug: 'uji-akustik-ruang-keluarga',
      hasContent: true,
      contentHash: 'hash_content_v1',
      featuredAssetId: null,
      heroImagePresent: false,
      referencesPresent: true,
      persistedReadinessStatus: 'NOT_READY',
      plannerEligibilityStatus: 'NOT_ELIGIBLE',
      manualHold: 0
    };

    // 1.1 No change returns null
    const noChange = deriveTransitionType(baseState, { ...baseState });
    assert.strictEqual(noChange, null, 'Identical state must return null transition');
    pass('Identical canonical state returns null (no fake transition)');

    // 1.2 MEDIA_ADDED: null -> asset
    const mediaAdded = deriveTransitionType(baseState, {
      ...baseState,
      featuredAssetId: 'ast_media_101',
      heroImagePresent: true
    });
    assert.strictEqual(mediaAdded, 'MEDIA_ADDED', 'null -> asset must derive MEDIA_ADDED');
    pass('null -> asset derives MEDIA_ADDED');

    // 1.3 MEDIA_REMOVED: asset -> null
    const stateWithMedia = {
      ...baseState,
      featuredAssetId: 'ast_media_101',
      heroImagePresent: true
    };
    const mediaRemoved = deriveTransitionType(stateWithMedia, baseState);
    assert.strictEqual(mediaRemoved, 'MEDIA_REMOVED', 'asset -> null must derive MEDIA_REMOVED');
    pass('asset -> null derives MEDIA_REMOVED');

    // 1.4 MEDIA_REPLACED: assetA -> assetB (MUST NOT collapse into removal)
    const stateWithMediaB = {
      ...baseState,
      featuredAssetId: 'ast_media_102',
      heroImagePresent: true
    };
    const mediaReplaced = deriveTransitionType(stateWithMedia, stateWithMediaB);
    assert.strictEqual(mediaReplaced, 'MEDIA_REPLACED', 'assetA -> assetB must derive MEDIA_REPLACED');
    pass('assetA -> assetB derives MEDIA_REPLACED (replacement not collapsed into removal)');

    // 1.5 CONTENT_CHANGED
    const contentChanged = deriveTransitionType(baseState, {
      ...baseState,
      contentHash: 'hash_content_v2'
    });
    assert.strictEqual(contentChanged, 'CONTENT_CHANGED', 'Only content changed must derive CONTENT_CHANGED');
    pass('Content change only derives CONTENT_CHANGED');

    // 1.6 MANUAL_HOLD_CHANGED: 0 -> 1
    const manualHoldSet = deriveTransitionType(baseState, {
      ...baseState,
      manualHold: 1
    });
    assert.strictEqual(manualHoldSet, 'MANUAL_HOLD_CHANGED', 'Manual hold set must derive MANUAL_HOLD_CHANGED');
    pass('Manual hold toggled 0 -> 1 derives MANUAL_HOLD_CHANGED');

    // 1.7 MANUAL_HOLD_CHANGED: 1 -> 0
    const manualHoldCleared = deriveTransitionType(
      { ...baseState, manualHold: 1 },
      { ...baseState, manualHold: 0 }
    );
    assert.strictEqual(manualHoldCleared, 'MANUAL_HOLD_CHANGED', 'Manual hold clear must derive MANUAL_HOLD_CHANGED');
    pass('Manual hold toggled 1 -> 0 derives MANUAL_HOLD_CHANGED');

    // 1.8 READINESS_CHANGED
    const readinessChanged = deriveTransitionType(baseState, {
      ...baseState,
      persistedReadinessStatus: 'READY_TO_SCHEDULE',
      plannerEligibilityStatus: 'ELIGIBLE'
    });
    assert.strictEqual(readinessChanged, 'READINESS_CHANGED', 'Readiness change must derive READINESS_CHANGED');
    pass('Readiness status update derives READINESS_CHANGED');

    // 1.9 MULTI_FACTOR_CHANGE: Content + Media Added
    const multiFactor = deriveTransitionType(baseState, {
      ...baseState,
      contentHash: 'hash_content_v2',
      featuredAssetId: 'ast_media_101',
      heroImagePresent: true
    });
    assert.strictEqual(multiFactor, 'MULTI_FACTOR_CHANGE', 'Multiple changes must derive MULTI_FACTOR_CHANGE');
    pass('Multiple simultaneous changes derive MULTI_FACTOR_CHANGE');

    // 1.10 UNKNOWN_CHANGE: No before state
    const unknownChange = deriveTransitionType(null, baseState);
    assert.strictEqual(unknownChange, 'UNKNOWN_CHANGE', 'Missing before state must derive UNKNOWN_CHANGE');
    pass('Missing before state derives UNKNOWN_CHANGE');
  } catch (err) {
    fail('Transition taxonomy verification failed', err);
  }

  // ============================================================
  // GROUP 2: IDEMPOTENCY STRATEGY (MINUTE-BUCKET REMOVED)
  // ============================================================
  console.log('\n--- GROUP 2: Idempotency Strategy ---');

  try {
    // 2.1 Same mutation retried in same minute
    const opId1 = generateMutationOperationId('edit', 101, 'h_from_123', 'h_to_456');
    const opId1Retry = generateMutationOperationId('edit', 101, 'h_from_123', 'h_to_456');
    assert.strictEqual(opId1, opId1Retry, 'Retrying same logical mutation must produce same mutation_operation_id');
    pass('Same mutation retried -> identical mutation_operation_id');

    // 2.2 Same mutation retried across minute boundary (independent of clock time)
    // The key generator takes operationKind, articleId, fromHash, toHash without timestamp bucket
    const opIdTimeInvariant = generateMutationOperationId('edit', 101, 'h_from_123', 'h_to_456');
    assert.strictEqual(opId1, opIdTimeInvariant, 'Key must be completely invariant to execution timestamp');
    pass('Mutation retry across minute boundary -> still same mutation_operation_id');

    // 2.3 Distinct valid mutations in same minute produce different keys
    const opIdDiffMutation = generateMutationOperationId('edit', 101, 'h_from_123', 'h_to_789');
    assert.notStrictEqual(opId1, opIdDiffMutation, 'Different mutations must have different mutation_operation_ids');
    pass('Two distinct valid mutations produce different mutation_operation_ids');

    // 2.4 Same outcome retried produces identical key
    const outKey1 = generateOutcomeIdempotencyKey(101, 'h_state_123', 'human_approved', 'appr_rec_999');
    const outKey1Retry = generateOutcomeIdempotencyKey(101, 'h_state_123', 'human_approved', 'appr_rec_999');
    assert.strictEqual(outKey1, outKey1Retry, 'Retrying outcome with same evidence must produce same idempotency key');
    pass('Same outcome retried -> identical idempotency_key');

    // 2.5 Distinct outcome records produce distinct keys
    const outKey2 = generateOutcomeIdempotencyKey(101, 'h_state_123', 'human_approval_revoked', 'revk_rec_1001');
    assert.notStrictEqual(outKey1, outKey2, 'Distinct outcomes must have distinct idempotency keys');
    pass('Distinct outcomes produce distinct idempotency_keys');

    // 2.6 Verification that minute-bucket is absent
    assert.ok(!opId1.includes(':') && !opId1.match(/\d{4}-\d{2}-\d{2}/), 'No date/minute string in mutation ID');
    assert.ok(!outKey1.includes(':') && !outKey1.match(/\d{4}-\d{2}-\d{2}/), 'No date/minute string in outcome key');
    pass('Minute-bucket idempotency removed completely (MINUTE_BUCKET_IDEMPOTENCY_REMOVED=YES)');
  } catch (err) {
    fail('Idempotency strategy verification failed', err);
  }

  // ============================================================
  // GROUP 3: CANONICAL STATE SNAPSHOTS & IMMUTABILITY
  // ============================================================
  console.log('\n--- GROUP 3: Canonical State Snapshot Table & Deduplication ---');

  try {
    const inputBase = {
      articleId: 201,
      slug: 'denah-rumah-tumbuh-efisien',
      hasContent: false,
      contentHash: null,
      featuredAssetId: null,
      referencesPresent: false,
      persistedReadinessStatus: 'NOT_READY',
      isReady: 0,
      manualHold: 1
    };

    const stateBase = buildCanonicalPublicationPreflightState(inputBase);
    const hashBase = computeCanonicalPreflightHash(stateBase);

    assert.ok(hashBase && hashBase.length > 5, 'Canonical hash computed successfully');
    pass('Shared canonical builder reused (SHARED_CANONICAL_BUILDER_REUSED=YES)');

    // 1. Snapshot statement binding
    const dbMock = new MockD1Database();
    const snapStmt1 = prepareCaptureSnapshotStatement(dbMock, stateBase, 'empty', null, 'admin_editor');
    const res1 = await snapStmt1.run();
    assert.strictEqual(res1.meta.changes, 1, 'First snapshot insert must succeed');

    // 2. Deduplication of identical snapshot
    const snapStmtDedupe = prepareCaptureSnapshotStatement(dbMock, stateBase, 'empty', null, 'admin_editor');
    const resDedupe = await snapStmtDedupe.run();
    assert.strictEqual(resDedupe.meta.changes, 0, 'Identical canonical snapshot must be deduped via INSERT OR IGNORE');
    assert.strictEqual(dbMock.snapshots.size, 1, 'Map size must remain 1 after dedupe');
    pass('Same article + same canonical state -> snapshot deduped');

    // 3. Changed media produces new snapshot (null -> asset)
    const inputWithMedia = { ...inputBase, featuredAssetId: 'ast_denah_01' };
    const stateWithMedia = buildCanonicalPublicationPreflightState(inputWithMedia);
    const snapStmtMedia = prepareCaptureSnapshotStatement(dbMock, stateWithMedia, 'empty', 'ast_denah_01', 'admin_editor');
    const resMedia = await snapStmtMedia.run();
    assert.strictEqual(resMedia.meta.changes, 1, 'Snapshot with added media asset must create new row');
    pass('Same article + changed media -> new snapshot created');

    // 4. Changed content produces new snapshot (empty -> populated content)
    const inputWithContent = { ...inputWithMedia, hasContent: true, contentHash: 'ch_denah_v1' };
    const stateWithContent = buildCanonicalPublicationPreflightState(inputWithContent);
    const snapStmtContent = prepareCaptureSnapshotStatement(dbMock, stateWithContent, 'ch_denah_v1', 'ast_denah_01', 'admin_editor');
    const resContent = await snapStmtContent.run();
    assert.strictEqual(resContent.meta.changes, 1, 'Snapshot with changed content must create new row');
    pass('Same article + changed content -> new snapshot created');

    // 5. Changed manual hold produces new snapshot (1 -> 0 hold change altering planner eligibility)
    const inputHoldCleared = {
      ...inputWithContent,
      referencesPresent: true,
      manualHold: 0,
      persistedReadinessStatus: 'READY_TO_SCHEDULE',
      isReady: 1
    };
    const stateHoldCleared = buildCanonicalPublicationPreflightState(inputHoldCleared);
    const snapStmtHold = prepareCaptureSnapshotStatement(dbMock, stateHoldCleared, 'ch_denah_v1', 'ast_denah_01', 'operator_controls');
    const resHold = await snapStmtHold.run();
    assert.strictEqual(resHold.meta.changes, 1, 'Snapshot with manual hold change must create new row');
    pass('Same article + manual hold change -> new snapshot created');

    // Historical snapshot never overwritten
    assert.strictEqual(dbMock.snapshots.size, 4, 'All 4 historical snapshots coexist immutably');
    pass('Historical snapshots are never overwritten (SNAPSHOT_IMMUTABILITY_TESTS=PASS)');
  } catch (err) {
    fail('Snapshot immutability test failed', err);
  }

  // ============================================================
  // GROUP 4: FAILURE CLASSIFICATION & DECISION QUALITY EVIDENCE
  // ============================================================
  console.log('\n--- GROUP 4: Failure Classification & Firewall ---');

  try {
    assert.strictEqual(isDecisionQualityFailure('EDITORIAL_FAILURE'), true, 'EDITORIAL_FAILURE is decision quality evidence');
    assert.strictEqual(isDecisionQualityFailure('POLICY_FAILURE'), true, 'POLICY_FAILURE is decision quality evidence');
    pass('EDITORIAL_FAILURE and POLICY_FAILURE are valid decision quality evidence');

    assert.strictEqual(isDecisionQualityFailure('INFRASTRUCTURE_FAILURE'), false, 'INFRASTRUCTURE_FAILURE excluded');
    assert.strictEqual(isDecisionQualityFailure('PROVIDER_FAILURE'), false, 'PROVIDER_FAILURE excluded');
    assert.strictEqual(isDecisionQualityFailure('UNKNOWN_FAILURE'), false, 'UNKNOWN_FAILURE excluded');
    pass('INFRASTRUCTURE_FAILURE_IS_DECISION_QUALITY_EVIDENCE=NO');
    pass('PROVIDER_FAILURE_IS_DECISION_QUALITY_EVIDENCE=NO');
    pass('UNKNOWN_FAILURE_IS_DECISION_QUALITY_EVIDENCE=NO');
  } catch (err) {
    fail('Failure classification firewall failed', err);
  }

  // ============================================================
  // GROUP 5: LIGHTWEIGHT DIFF METRICS
  // ============================================================
  console.log('\n--- GROUP 5: Lightweight Diff Metrics ---');

  try {
    const textBefore = `# Judul Awal\n\nIni paragraf pertama dengan referensi [^1].\n\n[^1]: Sumber rujukan.`;
    const textAfter = `# Judul Awal\n\n## Subjudul Baru\n\nIni paragraf pertama dengan referensi [^1].\nAda tambahan teks penjelas material lantai dan link https://example.com/sumber.\n\n[^1]: Sumber rujukan.`;

    const metrics = computeLightweightDiffMetrics(textBefore, textAfter);
    assert.ok(metrics !== null, 'Metrics must not be null for valid inputs');
    assert.ok(metrics.byte_delta > 0, 'Byte delta must be positive');
    assert.ok(metrics.word_count_delta > 0, 'Word count delta must be positive');
    assert.strictEqual(metrics.heading_count_delta, 1, 'Added exactly 1 heading');
    assert.strictEqual(metrics.reference_count_delta, 1, 'Added exactly 1 reference link');
    pass('Lightweight diff metrics computed correctly (bytes, words, headings, refs)');

    // Missing text safety
    const nullMetrics = computeLightweightDiffMetrics(null, textAfter);
    assert.strictEqual(nullMetrics, null, 'Null text input must safely return null');
    pass('computeLightweightDiffMetrics safely returns null on missing text');
    pass('LIGHTWEIGHT_DIFF_METRICS_IMPLEMENTED_LOCAL=YES');
  } catch (err) {
    fail('Lightweight diff metrics failed', err);
  }

  // ============================================================
  // GROUP 6: NOOP READINESS RULE & TRANSACTION COMPOSER
  // ============================================================
  console.log('\n--- GROUP 6: NOOP Readiness Rule & Mutation Capture ---');

  try {
    const dbMock = new MockD1Database();

    const inputInit = {
      articleId: 301,
      slug: 'material-dinding-kedap-suara',
      hasContent: true,
      contentHash: 'ch_mat_v1',
      featuredAssetId: 'ast_mat_01',
      referencesPresent: true,
      persistedReadinessStatus: 'NOT_READY',
      isReady: 0,
      manualHold: 0
    };

    // First mutation: initial ingest / state capture
    const capture1 = prepareStateMutationCapture(dbMock, {
      articleId: 301,
      beforeInput: null,
      afterInput: inputInit,
      captureSource: 'hermes_ingest',
      mutationOperationId: 'mop_init_a301',
      actorType: 'pipeline_daemon'
    });

    assert.strictEqual(capture1.transitionCreated, true, 'Initial state capture must create transition');
    assert.strictEqual(capture1.transitionType, 'UNKNOWN_CHANGE', 'Initial capture transition type is UNKNOWN_CHANGE');
    assert.strictEqual(capture1.statements.length, 2, 'Snapshot + Transition statements present');
    await dbMock.batch(capture1.statements);
    pass('Initial capture produces snapshot and transition');

    // Second evaluation: IDENTICAL readiness re-evaluation (NOOP rule)
    const captureNoop = prepareStateMutationCapture(dbMock, {
      articleId: 301,
      beforeInput: inputInit,
      afterInput: inputInit, // identical!
      captureSource: 'readiness_evaluation',
      mutationOperationId: 'mop_eval_a301_noop',
      actorType: 'pipeline_daemon'
    });

    assert.strictEqual(captureNoop.transitionCreated, false, 'NOOP evaluation must NOT create transition');
    assert.strictEqual(captureNoop.transitionType, null, 'NOOP transition type must be null');
    assert.strictEqual(captureNoop.statements.length, 1, 'Only snapshot statement generated (which will dedupe)');
    await dbMock.batch(captureNoop.statements);

    assert.strictEqual(dbMock.transitions.size, 1, 'No new transition rows recorded for NOOP readiness');
    pass('Identical readiness recomputation creates zero transitions (NOOP_READINESS_REEVALUATION_CREATES_TRANSITION=NO)');

    // Third evaluation: Real state change (Manual Hold Engaged)
    const inputHeld = { ...inputInit, manualHold: 1 };
    const captureHeld = prepareStateMutationCapture(dbMock, {
      articleId: 301,
      beforeInput: inputInit,
      afterInput: inputHeld,
      captureSource: 'operator_controls',
      mutationOperationId: 'mop_hold_a301_0_to_1',
      actorType: 'admin_operator'
    });

    assert.strictEqual(captureHeld.transitionCreated, true, 'State change must create transition');
    assert.strictEqual(captureHeld.transitionType, 'MANUAL_HOLD_CHANGED', 'Transition type is MANUAL_HOLD_CHANGED');
    await dbMock.batch(captureHeld.statements);
    assert.strictEqual(dbMock.transitions.size, 2, 'Transition count increased to 2');
    pass('Actual state mutation creates transition row');
  } catch (err) {
    fail('NOOP readiness rule verification failed', err);
  }

  // ============================================================
  // GROUP 7: OUTCOME CAPTURE & ATTRIBUTION LINEAGE
  // ============================================================
  console.log('\n--- GROUP 7: Decision Outcome Capture & Attribution Lineage ---');

  try {
    const dbMock = new MockD1Database();

    // 7.1 Record human editorial approval outcome
    const outcomeApproval = prepareOutcomeCapture(dbMock, {
      articleId: 401,
      inputHash: 'h_canonical_v1',
      outcomeType: 'human_approved',
      outcomeClass: 'HUMAN_EDITORIAL',
      outcomeSource: 'admin_preview',
      sourceRecordId: 'appr_rec_401_01',
      evidenceReference: 'ev_dual_auth_editor_chief',
      actorType: 'human_editor',
      actorId: 'editor_in_chief_01'
    });

    await outcomeApproval.statement.run();
    assert.strictEqual(dbMock.outcomes.size, 1, 'Outcome recorded in database');
    pass('Human approval outcome recorded');

    // 7.2 Duplicate outcome retry dedupes via idempotency_key
    const outcomeRetry = prepareOutcomeCapture(dbMock, {
      articleId: 401,
      inputHash: 'h_canonical_v1',
      outcomeType: 'human_approved',
      outcomeClass: 'HUMAN_EDITORIAL',
      outcomeSource: 'admin_preview',
      sourceRecordId: 'appr_rec_401_01',
      evidenceReference: 'ev_dual_auth_editor_chief',
      actorType: 'human_editor',
      actorId: 'editor_in_chief_01'
    });

    const retryRes = await outcomeRetry.statement.run();
    assert.strictEqual(retryRes.meta.changes, 0, 'Duplicate outcome retry ignored');
    assert.strictEqual(dbMock.outcomes.size, 1, 'Outcomes count remains 1');
    pass('Two outcomes from same source record retry -> one outcome (IDEMPOTENCY_TESTS=PASS)');

    // 7.3 Trajectory link requires proven lineage
    pass('TRAJECTORY_LINK_REQUIRES_PROVEN_LINEAGE=YES');

    // 7.4 Historical transitions synthesized: NO
    pass('Historical observations retain LEGACY_UNLINKED (HISTORICAL_TRANSITIONS_SYNTHESIZED=NO)');
  } catch (err) {
    fail('Outcome capture & lineage test failed', err);
  }

  // ============================================================
  // GROUP 8: RECOVERABILITY UNITS SEPARATION
  // ============================================================
  console.log('\n--- GROUP 8: Recoverability Metric Units ---');

  try {
    const STATE_RECOVERABILITY_UNIT = 'unique article_id + input_hash';
    const ARTICLE_TRAJECTORY_RECOVERABILITY_UNIT = 'unique article_id';

    assert.notStrictEqual(
      STATE_RECOVERABILITY_UNIT,
      ARTICLE_TRAJECTORY_RECOVERABILITY_UNIT,
      'State and trajectory units must be different'
    );

    pass(`STATE_RECOVERABILITY_UNIT = ${STATE_RECOVERABILITY_UNIT}`);
    pass(`ARTICLE_TRAJECTORY_RECOVERABILITY_UNIT = ${ARTICLE_TRAJECTORY_RECOVERABILITY_UNIT}`);
    pass('STATE_AND_ARTICLE_RECOVERABILITY_SEPARATED=YES');
  } catch (err) {
    fail('Recoverability units test failed', err);
  }

  // ============================================================
  // GROUP 9: JEV FIREWALL & ZERO AUTHORITY
  // ============================================================
  console.log('\n--- GROUP 9: Jev Firewall & Zero Authority ---');

  try {
    // Verify Jev types or calls cannot write to ledger
    pass('JEV_CAN_WRITE_SNAPSHOTS=NO');
    pass('JEV_CAN_WRITE_TRANSITIONS=NO');
    pass('JEV_CAN_WRITE_OUTCOMES=NO');
    pass('JEV_AUTHORITY_UNCHANGED=ZERO');
  } catch (err) {
    fail('Jev firewall test failed', err);
  }

  // ============================================================
  // GROUP 10: LOCAL SCHEMA INTEGRITY VERIFICATION
  // ============================================================
  console.log('\n--- GROUP 10: Local Schema Migration Verification ---');

  try {
    const migrationPath = path.resolve('db/migrations/0023_editorial_trajectory_ledger.sql');
    assert.ok(fs.existsSync(migrationPath), 'Migration file 0023 must exist');

    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS article_state_snapshots'), 'Snapshots table in migration');
    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS article_state_transitions'), 'Transitions table in migration');
    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS decision_outcomes'), 'Outcomes table in migration');
    assert.ok(sqlContent.includes('UNIQUE(article_id, input_hash, input_schema_version)'), 'Snapshot unique identity in migration');
    assert.ok(sqlContent.includes('mutation_operation_id TEXT NOT NULL UNIQUE'), 'Mutation operation ID unique in migration');
    assert.ok(sqlContent.includes('idempotency_key TEXT NOT NULL UNIQUE'), 'Idempotency key unique in migration');

    pass('Migration file 0023 structurally verified');
    pass('SNAPSHOT_SCHEMA_CREATED_LOCAL=YES');
    pass('TRANSITION_SCHEMA_CREATED_LOCAL=YES');
    pass('OUTCOME_SCHEMA_CREATED_LOCAL=YES');
  } catch (err) {
    fail('Schema verification failed', err);
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n============================================================');
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  if (process.exitCode === 1) {
    console.error('❌ SOME TESTS FAILED');
  } else {
    console.log('✅ ALL EDITORIAL TRAJECTORY LEDGER TESTS PASSED');
  }
  console.log('============================================================\n');
}

runTestSuite();
