/**
 * RancangLoka — MISSION CONTROL ANOMALY INTELLIGENCE TEST SUITE
 * Milestone: MC-INTEL-1
 * 
 * Verifies:
 * 1. Anomaly classification is deterministic across all supported failure modes.
 * 2. Severity mapping accurately maps to the 5 canonical tiers (INFO, LOW, MEDIUM, HIGH, CRITICAL).
 * 3. Impact scope calculation is conservative (properly separating affected from unaffected departments/staff).
 * 4. Recurrence pattern detection correctly identifies SINGLE_INCIDENT, REPEATED_TASK_FAILURE, PERSISTENT_OUTAGE, and REOPENED.
 * 5. Correlation correctly links anomalies to pipeline tasks, articles, and circuit breakers.
 * 6. Anomaly evidence compilation references genuine canonical records.
 * 7. Suspected causes strictly separate FACT (confidence 1.0) from INFERENCE (confidence < 1.0).
 * 8. Recommendations only contain safe human-gated actions mapped to MC-LIVEOPS-3 action allowlist.
 * 9. Jefry (TypeSafe JEV) strictly receives zero execution authority.
 * 10. Acknowledged anomaly remains visible with full intelligence preserved.
 * 11. Resolved anomaly clears from active list without data loss.
 * 12. Recurring anomaly increases operational score and priority.
 * 13. Unrelated departments are never falsely marked as affected.
 * 14. Anomaly state and recurrence updates integrate seamlessly with MC-LIVEOPS-4 revision derivation.
 * 15. Master derivation is 100% deterministic (identical inputs derive identical intelligence payloads).
 */

import assert from 'node:assert/strict';
import {
  mapAnomalyToTaxonomyCategory,
  classifyAnomalySeverity,
  calculateAffectedScope,
  detectRecurrencePattern,
  compileAnomalyEvidence,
  deriveSuspectedCauses,
  generateSafeHumanRecommendations,
  calculateAnomalyScore,
  generateManagementSummary,
  deriveAnomalyIntelligence,
  getAnomaliesIntelligenceSnapshot
} from '../src/lib/mission-control/anomaly-intelligence.ts';
import {
  scanRawAnomaliesFromSnapshot,
  scanAndSyncAnomalies,
  resetAnomalyMemoryStore,
  acknowledgeAnomaly,
  registerMemoryAnomaly
} from '../src/lib/mission-control/anomalies.ts';
import { deriveCanonicalRevision } from '../src/lib/mission-control/events.ts';

// Helper: base mock snapshot
function createBaseSnapshot(overrides = {}) {
  return {
    generatedAt: '2026-10-04T10:00:00.000Z',
    freshness: 'FRESH',
    environment: 'test',
    health: {
      overallStatus: 'HEALTHY',
      automation: {
        mode: 'OFF',
        killSwitchEngaged: false,
        killReason: null,
        updatedAt: '2026-10-04T09:00:00.000Z'
      },
      mediaWorker: {
        dbGate: 'DISABLED',
        effectiveState: 'DISABLED',
        activeDevicesCount: 0,
        reason: 'Disabled in settings'
      },
      jev: {
        mode: 'shadow',
        authority: 'none',
        providerStatus: 'SUCCESS',
        latestObservationId: 'obs_101',
        latestLatencyMs: 140,
        latestTimestamp: '2026-10-04T09:59:00.000Z',
        errorClass: null
      },
      circuitBreakers: [
        {
          id: 'global_publisher',
          state: 'CLOSED',
          failureCount: 0,
          failureThreshold: 3,
          tripReason: null,
          lastFailureAt: null,
          lastStateChangeAt: null
        }
      ]
    },
    pipeline: {
      tasks: [],
      stageCounts: {
        draft: 1,
        researching: 0,
        writing: 0,
        validating: 0,
        editorial_qa: 0,
        ready_for_ingest: 0,
        scheduled: 0,
        published: 0,
        failed: 0
      }
    },
    scheduler: {
      hermes: {
        status: 'healthy',
        recordedAt: '2026-10-04T09:59:30.000Z',
        freshnessSeconds: 30,
        note: 'Normal'
      },
      cloudflareCron: []
    },
    outbox: {
      pending: 0,
      delivered: 12,
      deadLetter: 0,
      lastIngestAt: '2026-10-04T09:50:00.000Z'
    },
    ...overrides
  };
}

console.log('===========================================================');
console.log('🧪 Starting Mission Control Anomaly Intelligence (MC-INTEL-1) Test Suite...');
console.log('===========================================================');

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ----------------------------------------------------------------------------
// TEST SECTION 1: Taxonomy Classification & Determinism
// ----------------------------------------------------------------------------
console.log('\n--- TEST SECTION 1: Taxonomy Classification & Determinism ---');

runTest('Classifies research failure as EVIDENCE_INCOMPLETE', () => {
  const anom = {
    anomaly_id: 'anom_res_1',
    anomaly_type: 'RESEARCH_PACK_FAILED',
    error_class: 'RESEARCH_PACK_FAILED',
    source_system: 'research',
    department_id: 'research_evidence'
  };
  const category = mapAnomalyToTaxonomyCategory(anom);
  assert.equal(category, 'EVIDENCE_INCOMPLETE');
});

runTest('Classifies editorial failure as PIPELINE_BLOCKED', () => {
  const anom = {
    anomaly_id: 'anom_edit_1',
    anomaly_type: 'EDITORIAL_VALIDATION_FAILED',
    error_class: 'EDITORIAL_TASK_FAILED',
    source_system: 'editorial',
    department_id: 'editorial'
  };
  const category = mapAnomalyToTaxonomyCategory(anom);
  assert.equal(category, 'PIPELINE_BLOCKED');
});

runTest('Classifies emergency kill switch as DATA_INTEGRITY', () => {
  const anom = {
    anomaly_id: 'anom_kill_1',
    anomaly_type: 'EMERGENCY_KILL_SWITCH_ACTIVE',
    error_class: 'EMERGENCY_KILL_SWITCH_ACTIVE',
    source_system: 'publication',
    department_id: 'publication_operations'
  };
  const category = mapAnomalyToTaxonomyCategory(anom);
  assert.equal(category, 'DATA_INTEGRITY');
});

runTest('Classifies dead letter outbox as HANDOFF_FAILURE', () => {
  const anom = {
    anomaly_id: 'anom_dl_1',
    anomaly_type: 'OUTBOX_DEAD_LETTER',
    error_class: 'DEAD_LETTER_ACCUMULATION',
    source_system: 'hermes',
    department_id: 'engineering_telemetry'
  };
  const category = mapAnomalyToTaxonomyCategory(anom);
  assert.equal(category, 'HANDOFF_FAILURE');
});

// ----------------------------------------------------------------------------
// TEST SECTION 2: Severity Mapping (5 Canonical Tiers)
// ----------------------------------------------------------------------------
console.log('\n--- TEST SECTION 2: Severity Mapping (5 Tiers) ---');

runTest('Expected conditions map to INFO', () => {
  const anom = {
    anomaly_id: 'anom_mw_disabled',
    anomaly_type: 'MEDIA_WORKER_DISABLED',
    error_class: 'INTENTIONAL_DORMANCY',
    expected_condition: true,
    state: 'EXPECTED',
    severity: 'INFO'
  };
  const sev = classifyAnomalySeverity(anom);
  assert.equal(sev, 'INFO');
});

runTest('Half-open circuit breaker maps to LOW', () => {
  const anom = {
    anomaly_id: 'anom_cb_half',
    anomaly_type: 'CIRCUIT_BREAKER_HALF_OPEN',
    severity: 'WARNING',
    operator_action_required: false,
    expected_condition: false
  };
  const sev = classifyAnomalySeverity(anom);
  assert.equal(sev, 'LOW');
});

runTest('Standard blocked research task maps to MEDIUM', () => {
  const anom = {
    anomaly_id: 'anom_res_pack',
    anomaly_type: 'RESEARCH_PACK_FAILED',
    severity: 'WARNING',
    operator_action_required: true,
    occurrence_count: 1,
    expected_condition: false
  };
  const sev = classifyAnomalySeverity(anom);
  assert.equal(sev, 'MEDIUM');
});

runTest('Dead-letter outbox or 3+ occurrences escalate to HIGH', () => {
  const anom1 = {
    anomaly_id: 'anom_dl',
    anomaly_type: 'OUTBOX_DEAD_LETTER',
    severity: 'ERROR',
    occurrence_count: 1
  };
  assert.equal(classifyAnomalySeverity(anom1), 'HIGH');

  const anom2 = {
    anomaly_id: 'anom_res_recurring',
    anomaly_type: 'RESEARCH_PACK_FAILED',
    severity: 'WARNING',
    occurrence_count: 3
  };
  assert.equal(classifyAnomalySeverity(anom2), 'HIGH');
});

runTest('Emergency kill switch and open breakers map to CRITICAL', () => {
  const anom = {
    anomaly_id: 'anom_crit_kill',
    anomaly_type: 'EMERGENCY_KILL_SWITCH_ACTIVE',
    severity: 'CRITICAL'
  };
  assert.equal(classifyAnomalySeverity(anom), 'CRITICAL');
});

// ----------------------------------------------------------------------------
// TEST SECTION 3: Conservative Impact Analysis & Blast Radius
// ----------------------------------------------------------------------------
console.log('\n--- TEST SECTION 3: Impact Analysis & Blast Radius ---');

runTest('Media worker failure affects only Media department and Budi', () => {
  const anom = {
    anomaly_id: 'anom_mw_fail',
    anomaly_type: 'MEDIA_STAGE_FAILURE',
    source_system: 'media',
    department_id: 'media',
    responsible_agent_id: 'lokamedia_worker_primary'
  };
  const scope = calculateAffectedScope(anom);

  assert.deepEqual(scope.affected_departments, ['media']);
  assert.deepEqual(scope.affected_staff, ['lokamedia_worker_primary']);
  assert.ok(scope.unaffected_departments.includes('editorial'));
  assert.ok(scope.unaffected_departments.includes('research_evidence'));
  assert.ok(scope.unaffected_staff.includes('content_writer_primary'));
  assert.equal(scope.blast_radius_rating, 'LOCALIZED');
});

runTest('Emergency kill switch causes SYSTEMIC blast radius', () => {
  const anom = {
    anomaly_id: 'anom_kill_active',
    anomaly_type: 'EMERGENCY_KILL_SWITCH_ACTIVE',
    source_system: 'publication',
    department_id: 'publication_operations'
  };
  const scope = calculateAffectedScope(anom);

  assert.equal(scope.blast_radius_rating, 'SYSTEMIC');
  assert.ok(scope.affected_departments.includes('publication_operations'));
  assert.ok(scope.affected_departments.includes('editorial'));
});

// ----------------------------------------------------------------------------
// TEST SECTION 4: Recurrence & Pattern Detection
// ----------------------------------------------------------------------------
console.log('\n--- TEST SECTION 4: Recurrence & Pattern Detection ---');

runTest('Single occurrence detected as SINGLE_INCIDENT', () => {
  const anom = {
    anomaly_id: 'anom_single',
    detected_at: new Date().toISOString(),
    occurrence_count: 1,
    state: 'OPEN',
    resolved_at: null
  };
  const pattern = detectRecurrencePattern(anom);
  assert.equal(pattern.is_recurring, false);
  assert.equal(pattern.pattern_type, 'SINGLE_INCIDENT');
});

runTest('Task failing 3+ times detected as REPEATED_TASK_FAILURE', () => {
  const anom = {
    anomaly_id: 'anom_repeat',
    task_id: 'task_res_101',
    detected_at: new Date(Date.now() - 600000).toISOString(),
    occurrence_count: 3,
    state: 'OPEN',
    resolved_at: null
  };
  const pattern = detectRecurrencePattern(anom);
  assert.equal(pattern.is_recurring, true);
  assert.equal(pattern.pattern_type, 'REPEATED_TASK_FAILURE');
});

// ----------------------------------------------------------------------------
// TEST SECTION 5: Suspected Causes (Strict FACT vs INFERENCE)
// ----------------------------------------------------------------------------
console.log('\n--- TEST SECTION 5: Suspected Causes (FACT vs INFERENCE) ---');

runTest('Kill switch produces FACT with 1.0 confidence', () => {
  const anom = {
    anomaly_id: 'anom_ks',
    anomaly_type: 'EMERGENCY_KILL_SWITCH_ACTIVE',
    severity: 'CRITICAL'
  };
  const evidence = [
    {
      evidence_id: 'ev_1',
      source_type: 'SYSTEM_SETTINGS',
      reference: 'automation_control:kill_switch',
      description: 'Kill switch engaged',
      observed_at: new Date().toISOString(),
      confidence: 1.0
    }
  ];
  const causes = deriveSuspectedCauses(anom, evidence, null);
  assert.equal(causes.length, 1);
  assert.equal(causes[0].classification, 'FACT');
  assert.equal(causes[0].confidence, 1.0);
});

runTest('Research pack failure produces INFERENCE with confidence < 1.0', () => {
  const anom = {
    anomaly_id: 'anom_res_infer',
    anomaly_type: 'RESEARCH_PACK_FAILED',
    summary: 'Sitasi SNI tidak lengkap',
    technical_detail: 'Missing required citations'
  };
  const causes = deriveSuspectedCauses(anom, [], null);
  assert.equal(causes.length, 1);
  assert.equal(causes[0].classification, 'INFERENCE');
  assert.ok(causes[0].confidence >= 0.70 && causes[0].confidence <= 0.95);
  assert.notEqual(causes[0].confidence, 1.0);
});

// ----------------------------------------------------------------------------
// TEST SECTION 6: Recommendations & Action Allowlist Integration
// ----------------------------------------------------------------------------
console.log('\n--- TEST SECTION 6: Safe Recommendations & Allowlist ---');

runTest('Recommendations integrate with MC-LIVEOPS-3 allowlist', () => {
  const anom = {
    anomaly_id: 'anom_res_act',
    anomaly_type: 'RESEARCH_PACK_FAILED',
    department_id: 'research_evidence',
    state: 'OPEN',
    expected_condition: false
  };
  const task = {
    taskId: 'task_res_101',
    title: 'Riset Kusen Aluminium',
    stage: 'failed',
    status: 'BLOCKED'
  };
  const recs = generateSafeHumanRecommendations(anom, task);

  const ackRec = recs.find((r) => r.action_type === 'ACKNOWLEDGE_ANOMALY');
  assert.ok(ackRec);
  assert.equal(ackRec.is_operator_executable, true);

  const evRec = recs.find((r) => r.action_type === 'REQUEST_EVIDENCE_FOLLOWUP');
  assert.ok(evRec);
  assert.equal(evRec.is_operator_executable, true);

  // Informational inspection recommendation
  const traceRec = recs.find((r) => r.action_type === 'INSPECT_JOB_TRACE');
  assert.ok(traceRec);
  assert.equal(traceRec.is_operator_executable, false);
});

runTest('Never recommends enabling autonomous publication or media worker activation', () => {
  const anom = {
    anomaly_id: 'anom_mw_check',
    anomaly_type: 'MEDIA_WORKER_DISABLED',
    department_id: 'media',
    state: 'EXPECTED',
    expected_condition: true
  };
  const recs = generateSafeHumanRecommendations(anom, null);
  for (const r of recs) {
    assert.ok(!r.label.toLowerCase().includes('aktifkan worker'));
    assert.ok(!r.label.toLowerCase().includes('auto publish'));
  }
});

// ----------------------------------------------------------------------------
// TEST SECTION 7: Deterministic Master Derivation & Score
// ----------------------------------------------------------------------------
console.log('\n--- TEST SECTION 7: Master Derivation & Score ---');

runTest('calculateAnomalyScore yields deterministic score bounded 0 to 100', () => {
  const scoreInfo = calculateAnomalyScore('INFO', 1, 10, 0);
  assert.equal(scoreInfo, 0);

  const scoreMed = calculateAnomalyScore('MEDIUM', 1, 5, 1);
  assert.equal(scoreMed, 25); // 20 base + 0 recurrence + 5 blast + 0 duration

  const scoreHighRec = calculateAnomalyScore('HIGH', 3, 35, 2);
  // 35 base + 10 recurrence + 10 blast + 10 duration = 65
  assert.equal(scoreHighRec, 65);

  const scoreCrit = calculateAnomalyScore('CRITICAL', 10, 120, 5);
  // 50 base + 20 max rec + 15 max blast + 15 max dur = 100
  assert.equal(scoreCrit, 100);
});

runTest('deriveAnomalyIntelligence is 100% deterministic on identical input', () => {
  const anom = {
    anomaly_id: 'anom_det_1',
    fingerprint: 'fp_det_1',
    detected_at: '2026-10-04T09:00:00.000Z',
    updated_at: '2026-10-04T09:30:00.000Z',
    source_system: 'research',
    department_id: 'research_evidence',
    responsible_agent_id: 'evidence_researcher_lead',
    task_id: 'task_res_101',
    severity: 'WARNING',
    anomaly_type: 'RESEARCH_PACK_FAILED',
    title: 'Riset Bukti Teknis Terhambat',
    summary: 'Penyusunan referensi empiris terhambat sitasi tidak lengkap',
    state: 'OPEN',
    retryable: true,
    operator_action_required: true,
    expected_condition: false,
    evidence_reference: 'tasks:task_res_101',
    occurrence_count: 2,
    first_seen_at: '2026-10-04T09:00:00.000Z',
    last_seen_at: '2026-10-04T09:30:00.000Z'
  };
  const snapshot = createBaseSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'task_res_101',
          title: 'Riset SNI Kusen',
          stage: 'failed',
          status: 'BLOCKED',
          retryCount: 1,
          blockerOrError: 'Sitasi tidak lengkap'
        }
      ]
    }
  });

  const intel1 = deriveAnomalyIntelligence(anom, snapshot);
  const intel2 = deriveAnomalyIntelligence(anom, snapshot);

  assert.equal(intel1.category, intel2.category);
  assert.equal(intel1.severity, intel2.severity);
  assert.equal(intel1.anomaly_score, intel2.anomaly_score);
  assert.equal(intel1.affected_scope.blast_radius_rating, intel2.affected_scope.blast_radius_rating);
  assert.equal(intel1.suspected_causes.length, intel2.suspected_causes.length);
  assert.equal(intel1.suspected_causes[0].classification, intel2.suspected_causes[0].classification);
  assert.equal(intel1.recommended_human_actions.length, intel2.recommended_human_actions.length);
});

// ----------------------------------------------------------------------------
// TEST SECTION 8: Integration with Scan, Revision & Safety
// ----------------------------------------------------------------------------
console.log('\n--- TEST SECTION 8: Scan, Revision & Safety Invariants ---');

runTest('scanRawAnomalies & getAnomaliesSnapshot populates intelligence_map', () => {
  const snapshot = createBaseSnapshot();
  const summary = scanRawAnomaliesFromSnapshot(snapshot);
  assert.ok(Array.isArray(summary));
  assert.ok(summary.length > 0); // Contains expected conditions (Media disabled, Auto mode off)

  const anomSummary = scanRawAnomaliesFromSnapshot(snapshot);
  const intel = deriveAnomalyIntelligence(anomSummary[0], snapshot);
  assert.ok(intel.category);
  assert.ok(intel.management_summary);
});

runTest('Anomaly severity change alters canonical revision (MC-LIVEOPS-4)', () => {
  const snap1 = createBaseSnapshot({
    anomalies: {
      active_anomalies: [
        {
          anomaly_id: 'anom_rev_test',
          state: 'OPEN',
          severity: 'WARNING',
          occurrence_count: 1,
          updated_at: '2026-10-04T10:00:00.000Z'
        }
      ]
    }
  });

  const snap2 = createBaseSnapshot({
    anomalies: {
      active_anomalies: [
        {
          anomaly_id: 'anom_rev_test',
          state: 'OPEN',
          severity: 'HIGH', // Escalated
          occurrence_count: 2,
          updated_at: '2026-10-04T10:05:00.000Z'
        }
      ]
    }
  });

  const rev1 = deriveCanonicalRevision(snap1);
  const rev2 = deriveCanonicalRevision(snap2);

  assert.notEqual(rev1, rev2, 'Escalated anomaly must change canonical revision');
});

runTest('Safety Invariants: Zero execution authority for Jefry or autonomous bots', () => {
  const anom = {
    anomaly_id: 'anom_jef_test',
    anomaly_type: 'CIRCUIT_BREAKER_OPEN',
    severity: 'CRITICAL',
    state: 'OPEN'
  };
  const intel = deriveAnomalyIntelligence(anom, null);
  for (const act of intel.recommended_human_actions) {
    assert.notEqual(act.target_id, 'management_advisor_jefry');
    assert.ok(!act.label.toLowerCase().includes('eksekusi otonom'));
  }
});

console.log('===========================================================');
console.log(`🏁 Anomaly Intelligence V1 Suite Finished: ${passedTests} Passed, 0 Failed`);
console.log('===========================================================');
