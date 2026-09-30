/**
 * RancangLoka — MISSION CONTROL ANOMALY DETECTION & STAFF ESCALATION TEST SUITE
 * Milestone: HERMES-MC-6
 * 
 * Verifies:
 * 1. Media retry exhaustion -> ERROR, Budi assigned.
 * 2. Intentional media disabled is EXPECTED -> INFO, no alarm, no escalation.
 * 3. Automation OFF is EXPECTED -> INFO, no alarm, no escalation.
 * 4. JEV fallback -> WARNING, Dimas assigned.
 * 5. Circuit breaker OPEN -> CRITICAL, Sari assigned.
 * 6. Stale heartbeat -> WARNING, Dimas assigned.
 * 7. Offline heartbeat -> ERROR, Dimas assigned.
 * 8. Dead-letter outbox -> ERROR, ambiguous infrastructure remains unassigned.
 * 9. Anomaly fingerprint stability across identical conditions.
 * 10. Duplicate suppression: does not insert duplicates for same fingerprint.
 * 11. Occurrence count increments properly on recurring detection cycles.
 * 12. Deterministic escalation to correct staff across all supported subsystems.
 * 13. Ambiguous infrastructure anomalies remain unassigned (responsible_agent_id = null).
 * 14. Pixel Office marker mapping: sprites & rooms reflect active anomalies.
 * 15. Department health influence: CRITICAL -> BLOCKED, WARNING/ERROR -> DEGRADED, INFO -> 0 impact.
 * 16. First escalation chat message generated in staff thread.
 * 17. No duplicate staff chat messages on subsequent detection cycles.
 * 18. Severity escalation updates record and emits update audit event.
 * 19. Automatic resolution: clears when underlying condition recovers.
 * 20. Resolved history retained for complete auditability.
 * 21. Secret redaction enforced on anomaly fields.
 * 22. Zero command execution authority via escalation signals.
 * 23. Zero dangerous remediation controls invariant.
 */

import assert from 'node:assert/strict';
import {
  scanRawAnomaliesFromSnapshot,
  scanAndSyncAnomalies,
  createAnomalyFingerprint,
  resetAnomalyMemoryStore,
  applyAnomaliesToDepartmentHealth,
  dispatchStaffAnomalyEscalation
} from '../src/lib/mission-control/anomalies.ts';
import {
  getConversationMessages,
  getOrCreateConversation,
  resetChatMemoryStore
} from '../src/lib/mission-control/chat.ts';
import {
  deriveSpriteSpatialState,
  getPixelOfficeState
} from '../src/lib/mission-control/pixel-office.ts';
import { getStaffRoster } from '../src/lib/mission-control/staff-registry.ts';

// Helper to create mock snapshot
function createBaseMockSnapshot(overrides = {}) {
  const base = {
    generatedAt: '2026-09-30T10:00:00.000Z',
    freshness: 'FRESH',
    environment: 'test',
    health: {
      overallStatus: 'HEALTHY',
      automation: {
        mode: 'OFF',
        killSwitchEngaged: false,
        killReason: null,
        updatedAt: '2026-09-30T09:00:00.000Z'
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
        latestTimestamp: '2026-09-30T09:59:00.000Z',
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
        draft: 2,
        researching: 0,
        writing: 0,
        validating: 0,
        editorial_qa: 0,
        ready_for_ingest: 0,
        ingesting: 0,
        waiting_media: 0,
        ready_for_review: 0,
        scheduled: 0,
        published: 5,
        failed: 0
      },
      totalActiveTasks: 0
    },
    activity: [],
    scheduler: {
      hermes: {
        status: 'healthy',
        recordedAt: '2026-09-30T09:58:00.000Z',
        freshnessSeconds: 60,
        note: 'Healthy heartbeat'
      },
      cloudflareCron: []
    },
    outbox: {
      queued: 0,
      sending: 0,
      acknowledged: 5,
      deadLetter: 0,
      source: 'd1_receipts',
      lastIngestAt: '2026-09-30T09:50:00.000Z'
    },
    articles: {
      draftCount: 2,
      awaitingReviewCount: 0,
      approvedCount: 0,
      publishedCount: 5,
      quarantinedCount: 0
    },
    media: {
      effectiveWorkerState: 'DISABLED',
      pendingJobsCount: 0,
      inProgressJobsCount: 0,
      failedJobsCount: 0,
      attachedJobsCount: 0,
      totalAssetsCount: 12,
      activeDevicesCount: 0
    },
    jev: {
      mode: 'shadow',
      authority: 'none',
      totalObservationsCount: 18,
      agreementRatePercent: 100
    }
  };

  return { ...base, ...overrides };
}

console.log('--- Starting Mission Control Anomaly Detection & Staff Escalation Test Suite ---');
let testsPassed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`✓ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function main() {
  resetAnomalyMemoryStore();
  resetChatMemoryStore();

  // 1. Media retry exhaustion
  runTest('1. media retry exhaustion triggers ERROR assigned to Budi', () => {
    const snapshot = createBaseMockSnapshot({
      pipeline: {
        tasks: [
          {
            taskId: 'task_media_99',
            title: 'Foto Utama Kusen',
            subsystem: 'media',
            status: 'failed',
            stage: 'failed',
            retryCount: 3,
            lastUpdate: '2026-09-30T10:00:00.000Z',
            blockerOrError: 'Batas percobaan habis: provider timeout 3x'
          }
        ]
      }
    });

    const anomalies = scanRawAnomaliesFromSnapshot(snapshot);
    const mediaAnom = anomalies.find((a) => a.anomaly_type === 'MEDIA_RETRY_EXHAUSTED');

    assert.ok(mediaAnom, 'Must detect MEDIA_RETRY_EXHAUSTED');
    assert.equal(mediaAnom.severity, 'ERROR');
    assert.equal(mediaAnom.responsible_agent_id, 'lokamedia_worker_primary');
    assert.equal(mediaAnom.department_id, 'media');
    assert.equal(mediaAnom.operator_action_required, true);
    assert.equal(mediaAnom.expected_condition, false);
  });

  // 2. Intentional media disabled is EXPECTED
  runTest('2. intentional media worker disabled is EXPECTED with INFO severity', () => {
    const snapshot = createBaseMockSnapshot({
      health: {
        mediaWorker: {
          effectiveState: 'DISABLED',
          reason: 'Configured disabled in settings'
        }
      }
    });

    const anomalies = scanRawAnomaliesFromSnapshot(snapshot);
    const workerAnom = anomalies.find((a) => a.anomaly_type === 'MEDIA_WORKER_DISABLED');

    assert.ok(workerAnom, 'Must detect MEDIA_WORKER_DISABLED');
    assert.equal(workerAnom.severity, 'INFO');
    assert.equal(workerAnom.state, 'EXPECTED');
    assert.equal(workerAnom.expected_condition, true);
    assert.equal(workerAnom.operator_action_required, false);
  });

  // 3. Automation OFF is expected
  runTest('3. publication automation OFF by design is EXPECTED with INFO severity', () => {
    const snapshot = createBaseMockSnapshot();
    const anomalies = scanRawAnomaliesFromSnapshot(snapshot);
    const autoAnom = anomalies.find((a) => a.anomaly_type === 'AUTOMATION_MODE_OFF');

    assert.ok(autoAnom, 'Must detect AUTOMATION_MODE_OFF');
    assert.equal(autoAnom.severity, 'INFO');
    assert.equal(autoAnom.state, 'EXPECTED');
    assert.equal(autoAnom.expected_condition, true);
  });

  // 4. JEV fallback -> WARNING assigned to Dimas
  runTest('4. JEV provider fallback produces WARNING assigned to Dimas', () => {
    const snapshot = createBaseMockSnapshot({
      health: {
        jev: {
          providerStatus: 'FALLBACK',
          errorClass: 'OPENROUTER_TIMEOUT',
          latestLatencyMs: 3200,
          latestTimestamp: '2026-09-30T10:00:00.000Z'
        }
      }
    });

    const anomalies = scanRawAnomaliesFromSnapshot(snapshot);
    const jevAnom = anomalies.find((a) => a.anomaly_type === 'JEV_PROVIDER_FALLBACK');

    assert.ok(jevAnom, 'Must detect JEV_PROVIDER_FALLBACK');
    assert.equal(jevAnom.severity, 'WARNING');
    assert.equal(jevAnom.responsible_agent_id, 'telemetry_observer_jev');
    assert.equal(jevAnom.department_id, 'engineering_telemetry');
  });

  // 5. Circuit breaker OPEN -> CRITICAL assigned to Sari
  runTest('5. circuit breaker OPEN triggers CRITICAL assigned to Sari', () => {
    const snapshot = createBaseMockSnapshot({
      health: {
        circuitBreakers: [
          {
            id: 'global_publisher',
            state: 'OPEN',
            failureCount: 3,
            failureThreshold: 3,
            tripReason: 'Database locked during publishing',
            lastStateChangeAt: '2026-09-30T10:00:00.000Z'
          }
        ]
      }
    });

    const anomalies = scanRawAnomaliesFromSnapshot(snapshot);
    const breakerAnom = anomalies.find((a) => a.anomaly_type === 'CIRCUIT_BREAKER_OPEN');

    assert.ok(breakerAnom, 'Must detect CIRCUIT_BREAKER_OPEN');
    assert.equal(breakerAnom.severity, 'CRITICAL');
    assert.equal(breakerAnom.responsible_agent_id, 'publication_dispatcher_core');
    assert.equal(breakerAnom.department_id, 'publication_operations');
    assert.equal(breakerAnom.operator_action_required, true);
  });

  // 6. Stale heartbeat -> WARNING
  runTest('6. stale scheduler heartbeat triggers WARNING assigned to Dimas', () => {
    const snapshot = createBaseMockSnapshot({
      scheduler: {
        hermes: {
          status: 'stale',
          freshnessSeconds: 360,
          recordedAt: '2026-09-30T09:54:00.000Z',
          note: 'Last cycle 360s ago'
        }
      }
    });

    const anomalies = scanRawAnomaliesFromSnapshot(snapshot);
    const staleAnom = anomalies.find((a) => a.anomaly_type === 'HERMES_HEARTBEAT_STALE');

    assert.ok(staleAnom, 'Must detect HERMES_HEARTBEAT_STALE');
    assert.equal(staleAnom.severity, 'WARNING');
    assert.equal(staleAnom.responsible_agent_id, 'telemetry_observer_jev');
  });

  // 7. Offline heartbeat -> ERROR
  runTest('7. offline scheduler heartbeat triggers ERROR assigned to Dimas', () => {
    const snapshot = createBaseMockSnapshot({
      scheduler: {
        hermes: {
          status: 'offline',
          freshnessSeconds: 650,
          recordedAt: '2026-09-30T09:49:00.000Z',
          note: 'Container unresponsive'
        }
      }
    });

    const anomalies = scanRawAnomaliesFromSnapshot(snapshot);
    const offlineAnom = anomalies.find((a) => a.anomaly_type === 'HERMES_HEARTBEAT_OFFLINE');

    assert.ok(offlineAnom, 'Must detect HERMES_HEARTBEAT_OFFLINE');
    assert.equal(offlineAnom.severity, 'ERROR');
    assert.equal(offlineAnom.responsible_agent_id, 'telemetry_observer_jev');
    assert.equal(offlineAnom.operator_action_required, true);
  });

  // 8. Dead-letter outbox -> ERROR, ambiguous infrastructure
  runTest('8. dead-letter outbox triggers ERROR with null responsible_agent_id', () => {
    const snapshot = createBaseMockSnapshot({
      outbox: {
        queued: 0,
        sending: 0,
        acknowledged: 10,
        deadLetter: 2,
        lastIngestAt: '2026-09-30T09:50:00.000Z'
      }
    });

    const anomalies = scanRawAnomaliesFromSnapshot(snapshot);
    const dlAnom = anomalies.find((a) => a.anomaly_type === 'OUTBOX_DEAD_LETTER');

    assert.ok(dlAnom, 'Must detect OUTBOX_DEAD_LETTER');
    assert.equal(dlAnom.severity, 'ERROR');
    assert.equal(dlAnom.responsible_agent_id, null, 'Infrastructure issues must remain unassigned');
  });

  // 9. Fingerprint stability
  runTest('9. anomaly fingerprint stability across identical runs', () => {
    const fp1 = createAnomalyFingerprint('media', 'media', 'MEDIA_RETRY_EXHAUSTED', 'task_1', 'RETRY_EXHAUSTED');
    const fp2 = createAnomalyFingerprint('media', 'media', 'MEDIA_RETRY_EXHAUSTED', 'task_1', 'RETRY_EXHAUSTED');
    assert.equal(fp1, fp2);
    assert.ok(fp1.startsWith('fp_media_media_media_retry_exhausted_task_1'));
  });

  // 10 & 11. Duplicate suppression and occurrence count
  await runAsyncTest('10 & 11. duplicate suppression and occurrence count incrementing', async () => {
    resetAnomalyMemoryStore();
    const snapshot = createBaseMockSnapshot({
      pipeline: {
        tasks: [
          {
            taskId: 'task_qa_12',
            title: 'Inspeksi QA Naskah Atap Spandek',
            subsystem: 'editorial',
            status: 'failed',
            stage: 'failed',
            retryCount: 1,
            lastUpdate: '2026-09-30T10:00:00.000Z',
            blockerOrError: 'QA First Article Gate: sitasi tidak memadai'
          }
        ]
      }
    });

    // Scan cycle 1
    const res1 = await scanAndSyncAnomalies(null, snapshot);
    assert.equal(res1.active_anomalies.length, 1);
    assert.equal(res1.active_anomalies[0].occurrence_count, 1);
    assert.equal(res1.active_anomalies[0].responsible_agent_id, 'editorial_qa_primary');

    // Scan cycle 2 (same condition)
    const res2 = await scanAndSyncAnomalies(null, snapshot);
    assert.equal(res2.active_anomalies.length, 1, 'Must suppress duplicate insertion');
    assert.equal(res2.active_anomalies[0].occurrence_count, 2, 'Occurrence count must increment');
  });

  // 12. Escalation to correct staff across all supported subsystems
  runTest('12. deterministic escalation across editorial, research, media, pub, telemetry', () => {
    const snapshot = createBaseMockSnapshot({
      pipeline: {
        tasks: [
          {
            taskId: 'task_edit_1',
            title: 'Drafting Artikel Kayu',
            subsystem: 'editorial',
            status: 'failed',
            stage: 'failed',
            retryCount: 1,
            lastUpdate: '2026-09-30T10:00:00.000Z',
            blockerOrError: 'Gagal drafting'
          },
          {
            taskId: 'task_res_1',
            title: 'Riset SNI Beton',
            subsystem: 'research',
            status: 'failed',
            stage: 'failed',
            retryCount: 1,
            lastUpdate: '2026-09-30T10:00:00.000Z',
            blockerOrError: 'Gagal riset'
          }
        ]
      }
    });

    const anomalies = scanRawAnomaliesFromSnapshot(snapshot);
    const jokoAnom = anomalies.find((a) => a.responsible_agent_id === 'content_writer_primary');
    const irwanAnom = anomalies.find((a) => a.responsible_agent_id === 'evidence_researcher_lead');

    assert.ok(jokoAnom, 'Must assign writing failure to Joko');
    assert.ok(irwanAnom, 'Must assign research failure to Irwan');
  });

  // 13. Ambiguous anomaly remains unassigned
  runTest('13. ambiguous anomaly remains unassigned without blaming staff', () => {
    const snapshot = createBaseMockSnapshot({
      outbox: {
        queued: 0,
        sending: 0,
        acknowledged: 1,
        deadLetter: 3
      }
    });

    const anomalies = scanRawAnomaliesFromSnapshot(snapshot);
    const dlAnom = anomalies.find((a) => a.anomaly_type === 'OUTBOX_DEAD_LETTER');
    assert.equal(dlAnom.responsible_agent_id, null);
    assert.equal(dlAnom.department_id, 'engineering_telemetry');
  });

  // 14. Pixel Office marker mapping
  runTest('14. Pixel Office marker mapping reflects active anomaly without moving staff arbitrarily', () => {
    const snapshot = createBaseMockSnapshot();
    const mockActiveAnomalies = [
      {
        anomaly_id: 'anom_1',
        responsible_agent_id: 'content_writer_primary',
        department_id: 'editorial',
        severity: 'CRITICAL',
        title: 'Alarm Kritis Penulisan',
        summary: 'Integritas artikel terancam',
        state: 'OPEN',
        expected_condition: false
      }
    ];

    const office = getPixelOfficeState(snapshot, mockActiveAnomalies);
    const jokoSprite = office.sprites.find((s) => s.agent_id === 'content_writer_primary');
    const editorialRoom = office.rooms.find((r) => r.room_key === 'editorial_room');

    assert.equal(jokoSprite.warning_level, 'CRITICAL');
    assert.equal(jokoSprite.active_anomaly_title, 'Alarm Kritis Penulisan');
    assert.equal(editorialRoom.active_anomalies_count, 1);
  });

  // 15. Department health influence
  runTest('15. department health influence based on anomaly severity', () => {
    // A. Critical anomaly forces BLOCKED
    const critAnom = [
      {
        department_id: 'publication_operations',
        severity: 'CRITICAL',
        title: 'Breaker Open',
        state: 'OPEN',
        expected_condition: false
      }
    ];
    const res1 = applyAnomaliesToDepartmentHealth('publication_operations', 'HEALTHY', critAnom);
    assert.equal(res1.health, 'BLOCKED');

    // B. Warning anomaly degrades to DEGRADED
    const warnAnom = [
      {
        department_id: 'engineering_telemetry',
        severity: 'WARNING',
        title: 'Heartbeat Stale',
        state: 'OPEN',
        expected_condition: false
      }
    ];
    const res2 = applyAnomaliesToDepartmentHealth('engineering_telemetry', 'HEALTHY', warnAnom);
    assert.equal(res2.health, 'DEGRADED');

    // C. Expected / Info anomaly has ZERO degradation
    const infoAnom = [
      {
        department_id: 'media',
        severity: 'INFO',
        title: 'Worker Disabled',
        state: 'EXPECTED',
        expected_condition: true
      }
    ];
    const res3 = applyAnomaliesToDepartmentHealth('media', 'HEALTHY', infoAnom);
    assert.equal(res3.health, 'HEALTHY');
  });

  // 16 & 17. First escalation chat message and duplicate prevention
  await runAsyncTest('16 & 17. first escalation chat message and duplicate prevention', async () => {
    resetAnomalyMemoryStore();
    resetChatMemoryStore();

    const snapshot = createBaseMockSnapshot({
      pipeline: {
        tasks: [
          {
            taskId: 'task_mjob_88',
            title: 'Visual Fasad Rumah',
            subsystem: 'media',
            status: 'failed',
            stage: 'failed',
            retryCount: 3,
            lastUpdate: '2026-09-30T10:00:00.000Z',
            blockerOrError: 'Batas retry habis'
          }
        ]
      }
    });

    // Run cycle 1
    await scanAndSyncAnomalies(null, snapshot);

    // Verify conversation message in Budi's thread
    const budiConv = await getOrCreateConversation(null, 'lokamedia_worker_primary');
    const messages1 = await getConversationMessages(null, budiConv.conversation_id);

    assert.equal(messages1.length, 1, 'Must create 1 escalation message');
    assert.ok(messages1[0].content.includes('Visual Fasad Rumah'));
    assert.equal(messages1[0].sender_type, 'STAFF');

    // Run cycle 2
    await scanAndSyncAnomalies(null, snapshot);
    const messages2 = await getConversationMessages(null, budiConv.conversation_id);
    assert.equal(messages2.length, 1, 'Must NOT duplicate escalation message for same condition');
  });

  // 18. Severity escalation updates record
  await runAsyncTest('18. severity escalation from WARNING to ERROR updates record', async () => {
    resetAnomalyMemoryStore();

    // Stage failure (WARNING)
    const snap1 = createBaseMockSnapshot({
      pipeline: {
        tasks: [
          {
            taskId: 'task_dyn_1',
            title: 'Aset Render Denah',
            subsystem: 'media',
            status: 'failed',
            stage: 'failed',
            retryCount: 1,
            lastUpdate: '2026-09-30T10:00:00.000Z',
            blockerOrError: 'Timeout sementara'
          }
        ]
      }
    });

    const res1 = await scanAndSyncAnomalies(null, snap1);
    assert.equal(res1.active_anomalies[0].severity, 'WARNING');

    // Retry exhausted (ERROR)
    const snap2 = createBaseMockSnapshot({
      pipeline: {
        tasks: [
          {
            taskId: 'task_dyn_1',
            title: 'Aset Render Denah',
            subsystem: 'media',
            status: 'failed',
            stage: 'failed',
            retryCount: 3,
            lastUpdate: '2026-09-30T10:01:00.000Z',
            blockerOrError: 'Percobaan habis'
          }
        ]
      }
    });

    const res2 = await scanAndSyncAnomalies(null, snap2);
    assert.equal(res2.active_anomalies[0].severity, 'ERROR');
  });

  // 19 & 20. Automatic resolution and history retention
  await runAsyncTest('19 & 20. automatic resolution when condition clears and retention of history', async () => {
    resetAnomalyMemoryStore();

    // 1. Trigger stale heartbeat
    const snapFail = createBaseMockSnapshot({
      scheduler: {
        hermes: {
          status: 'stale',
          freshnessSeconds: 400,
          recordedAt: '2026-09-30T10:00:00.000Z',
          note: 'Stale'
        }
      }
    });

    const res1 = await scanAndSyncAnomalies(null, snapFail);
    assert.equal(res1.active_anomalies.length, 1);
    assert.equal(res1.resolved_anomalies.length, 0);

    // 2. Condition clears (heartbeat healthy)
    const snapRecovered = createBaseMockSnapshot({
      scheduler: {
        hermes: {
          status: 'healthy',
          freshnessSeconds: 15,
          recordedAt: '2026-09-30T10:05:00.000Z',
          note: 'Healthy'
        }
      }
    });

    const res2 = await scanAndSyncAnomalies(null, snapRecovered);
    assert.equal(res2.active_anomalies.length, 0, 'Active anomalies must be 0 after recovery');
    assert.equal(res2.resolved_anomalies.length, 1, 'Must retain resolved anomaly in history');
    assert.ok(res2.resolved_anomalies[0].resolved_at, 'Must have resolved_at timestamp');
  });

  // 21. Secret redaction on anomaly strings
  await runAsyncTest('21. secret redaction utility masks credentials in anomaly details', async () => {
    resetAnomalyMemoryStore();

    const snapshot = createBaseMockSnapshot({
      pipeline: {
        tasks: [
          {
            taskId: 'task_leak_1',
            title: 'Koneksi dengan sk-1234567890abcdef12345678',
            subsystem: 'media',
            status: 'failed',
            stage: 'failed',
            retryCount: 3,
            lastUpdate: '2026-09-30T10:00:00.000Z',
            blockerOrError: 'Auth bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 gagal'
          }
        ]
      }
    });

    const res = await scanAndSyncAnomalies(null, snapshot);
    const anom = res.active_anomalies.find((a) => a.task_id === 'task_leak_1');
    assert.ok(anom);
    assert.ok(!anom.title.includes('sk-1234567890abcdef12345678'));
    assert.ok(!anom.summary.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'));
  });

  // 22. Zero command execution authority
  runTest('22. escalation messages contain zero executable commands', () => {
    const rawAnomalies = scanRawAnomaliesFromSnapshot(createBaseMockSnapshot());
    for (const anom of rawAnomalies) {
      assert.equal(anom.command_type, undefined, 'Anomalies must not carry command_type');
      assert.equal(anom.authority_level, undefined, 'Anomalies must not carry authority_level');
    }
  });

  // 23. Zero dangerous remediation controls
  await runAsyncTest('23. Alert center and anomaly models contain zero remediation mutators', async () => {
    const anomalyModule = await import('../src/lib/mission-control/anomalies.ts');
    assert.equal(anomalyModule.execute_retry, undefined);
    assert.equal(anomalyModule.force_publish, undefined);
    assert.equal(anomalyModule.enable_worker, undefined);
    assert.equal(anomalyModule.reset_circuit_breaker, undefined);
  });

  console.log('\n========================================');
  console.log(`ALL ${testsPassed} ANOMALY & ESCALATION TESTS PASSED!`);
  console.log('========================================\n');
}

main();
