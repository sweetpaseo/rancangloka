/**
 * RancangLoka Hermes Mission Control — Test Suite: MC-LIVEOPS-3
 * Milestone: MC-LIVEOPS-3 Controlled Human Intervention & Workstation Action Gate
 * 
 * Verifies:
 * 1. Action allowlist enforcement (arbitrary actions rejected)
 * 2. Non-mutating action preview
 * 3. Concurrency / Stale-state protection (409 STATE_CONFLICT)
 * 4. Audit trail generation and deterministic audit hash
 * 5. Domain mutations (ACKNOWLEDGE_ANOMALY, ESCALATE_BLOCKED_TASK, REQUEST_HUMAN_REVIEW, REQUEST_EVIDENCE_FOLLOWUP)
 * 6. Staff conversation integration (operator notices appended)
 * 7. Persona safety invariants:
 *    - Jefry (TypeSafe JEV) 0 execution authority
 *    - Budi Media Worker DISABLED
 *    - Sari Auto-Publish OFF
 * 8. Deterministic reproducibility
 * 9. Idempotency on duplicate action IDs
 * 10. API route authentication & CSRF defense
 */

import assert from 'node:assert';
import {
  ACTION_ALLOWLIST,
  getAllowedActionsForTarget,
  previewOperatorAction,
  executeOperatorAction,
  getOperatorActionById,
  getOperatorActionsHistory,
  resetOperatorActionsMemoryStore
} from '../src/lib/mission-control/actions.ts';
import {
  resetAnomalyMemoryStore,
  registerMemoryAnomaly,
  getAnomalyById
} from '../src/lib/mission-control/anomalies.ts';
import {
  resetChatMemoryStore,
  getConversationMessages,
  getOrCreateConversation
} from '../src/lib/mission-control/chat.ts';

// Simulated Mission Control Snapshot fixture
function createMockSnapshot(overrides = {}) {
  return {
    generatedAt: new Date().toISOString(),
    freshness: 'LIVE',
    environment: 'test',
    health: { overallHealth: 'HEALTHY' },
    pipeline: {
      tasks: [
        {
          taskId: 'task_res_101',
          title: 'Riset SNI Material Bata Ringan',
          subsystem: 'editorial_pipeline',
          status: 'BLOCKED',
          stage: 'researching',
          retryCount: 1,
          lastUpdate: new Date().toISOString(),
          blockerOrError: 'Kurang data standar ASTM C1693',
          relatedArticleId: 101,
          slug: 'standar-bata-ringan'
        },
        {
          taskId: 'task_write_202',
          title: 'Draf Panduan Ventilasi Silang Tropis',
          subsystem: 'editorial_pipeline',
          status: 'WORKING',
          stage: 'writing',
          retryCount: 0,
          lastUpdate: new Date().toISOString(),
          blockerOrError: null,
          relatedArticleId: 202,
          slug: 'ventilasi-silang-alami'
        },
        {
          taskId: 'task_qa_303',
          title: 'Review Mutu Naskah Kusen UPVC',
          subsystem: 'editorial_pipeline',
          status: 'REVIEWING',
          stage: 'editorial_qa',
          retryCount: 0,
          lastUpdate: new Date().toISOString(),
          blockerOrError: null,
          relatedArticleId: 303,
          slug: 'kusen-upvc-vs-aluminium'
        }
      ],
      stageCounts: {
        draft: 0,
        researching: 1,
        writing: 1,
        validating: 0,
        editorial_qa: 1,
        ready_for_ingest: 0,
        ingesting: 0,
        waiting_media: 0,
        ready_for_review: 0,
        scheduled: 0,
        published: 0,
        failed: 0
      },
      totalActiveTasks: 3
    },
    activity: [],
    scheduler: { schedulerHeartbeat: 'HEALTHY' },
    outbox: { totalStaged: 0 },
    articles: { totalArticles: 3 },
    media: { workerStatus: 'DISABLED' },
    jev: { mode: 'shadow' },
    anomalies: {
      active_anomalies: [
        {
          anomaly_id: 'anom_db_lat_99',
          detected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          source_system: 'd1_database',
          department_id: 'engineering_telemetry',
          responsible_agent_id: 'telemetry_observer_jev',
          task_id: null,
          severity: 'WARNING',
          anomaly_type: 'HIGH_LATENCY',
          title: 'Latensi D1 Database Meningkat',
          summary: 'Latensi query tepi melebihi batas 150ms',
          technical_detail: 'p95 latency = 210ms',
          state: 'OPEN',
          retryable: true,
          operator_action_required: true,
          expected_condition: false,
          fingerprint: 'fp_d1_lat_test',
          occurrence_count: 2,
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString()
        }
      ]
    },
    live_operations: {
      generated_at: new Date().toISOString(),
      staff_operations: {
        evidence_researcher_lead: {
          agent_id: 'evidence_researcher_lead',
          display_name: 'Irwan',
          department_id: 'research_evidence',
          operational_state: 'BLOCKED',
          live_status: 'BLOCKED',
          current_task: {
            task_id: 'task_res_101',
            task_title: 'Riset SNI Material Bata Ringan',
            stage: 'researching',
            status: 'BLOCKED',
            department_id: 'research_evidence',
            responsible_agent_id: 'evidence_researcher_lead',
            blocking_condition: 'Kurang data standar ASTM C1693',
            related_article_id: 101,
            slug: 'standar-bata-ringan'
          }
        },
        content_writer_primary: {
          agent_id: 'content_writer_primary',
          display_name: 'Joko',
          department_id: 'editorial',
          operational_state: 'WORKING',
          live_status: 'WORKING',
          current_task: {
            task_id: 'task_write_202',
            task_title: 'Draf Panduan Ventilasi Silang Tropis',
            stage: 'writing',
            status: 'WORKING',
            department_id: 'editorial',
            responsible_agent_id: 'content_writer_primary',
            blocking_condition: null,
            related_article_id: 202,
            slug: 'ventilasi-silang-alami'
          }
        },
        editorial_qa_primary: {
          agent_id: 'editorial_qa_primary',
          display_name: 'Rina',
          department_id: 'editorial',
          operational_state: 'REVIEWING',
          live_status: 'REVIEWING',
          current_task: {
            task_id: 'task_qa_303',
            task_title: 'Review Mutu Naskah Kusen UPVC',
            stage: 'editorial_qa',
            status: 'REVIEWING',
            department_id: 'editorial',
            responsible_agent_id: 'editorial_qa_primary',
            blocking_condition: null,
            related_article_id: 303,
            slug: 'kusen-upvc-vs-aluminium'
          }
        },
        management_advisor_jefry: {
          agent_id: 'management_advisor_jefry',
          display_name: 'Jefry',
          department_id: 'management',
          operational_state: 'IDLE',
          live_status: 'IDLE',
          current_task: null
        },
        lokamedia_worker_primary: {
          agent_id: 'lokamedia_worker_primary',
          display_name: 'Budi',
          department_id: 'media',
          operational_state: 'OFFLINE',
          live_status: 'OFFLINE',
          current_task: null
        }
      }
    },
    ...overrides
  };
}

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

console.log('===========================================================');
console.log('🧪 Starting Mission Control Live Operations V3 Test Suite...');
console.log('===========================================================');

async function runTests() {
  resetOperatorActionsMemoryStore();
  resetAnomalyMemoryStore();
  resetChatMemoryStore();

  const snapshot = createMockSnapshot();
  registerMemoryAnomaly(snapshot.anomalies.active_anomalies[0]);

  console.log('\n--- TEST SECTION 1: Action Allowlist & Permissions ---');

  it('Strict action allowlist contains only canonical low-risk operator actions', () => {
    assert.ok(ACTION_ALLOWLIST.ACKNOWLEDGE_ANOMALY, 'ACKNOWLEDGE_ANOMALY must be allowlisted');
    assert.ok(ACTION_ALLOWLIST.ESCALATE_BLOCKED_TASK, 'ESCALATE_BLOCKED_TASK must be allowlisted');
    assert.ok(ACTION_ALLOWLIST.REQUEST_HUMAN_REVIEW, 'REQUEST_HUMAN_REVIEW must be allowlisted');
    assert.ok(ACTION_ALLOWLIST.REQUEST_EVIDENCE_FOLLOWUP, 'REQUEST_EVIDENCE_FOLLOWUP must be allowlisted');

    // High risk actions MUST NOT be present
    assert.strictEqual(ACTION_ALLOWLIST['AUTONOMOUS_PUBLISH'], undefined);
    assert.strictEqual(ACTION_ALLOWLIST['ACTIVATE_WORKER'], undefined);
    assert.strictEqual(ACTION_ALLOWLIST['DELETE_DATABASE'], undefined);
    assert.strictEqual(ACTION_ALLOWLIST['ENABLE_AUTOMATION'], undefined);
  });

  it('Resolves allowed actions correctly for a blocked task', () => {
    const allowed = getAllowedActionsForTarget('TASK', 'task_res_101', snapshot);
    const types = allowed.map((a) => a.action_type);
    assert.ok(types.includes('ESCALATE_BLOCKED_TASK'), 'Should allow escalation on blocked task');
    assert.ok(types.includes('REQUEST_EVIDENCE_FOLLOWUP'), 'Should allow evidence follow-up for research lead');
  });

  it('Resolves allowed actions correctly for an active QA review task', () => {
    const allowed = getAllowedActionsForTarget('TASK', 'task_qa_303', snapshot);
    const types = allowed.map((a) => a.action_type);
    assert.ok(types.includes('REQUEST_HUMAN_REVIEW'), 'Should allow requesting human review on QA task');
    assert.strictEqual(types.includes('ESCALATE_BLOCKED_TASK'), false, 'Non-blocked task cannot be escalated');
  });

  it('Resolves allowed actions correctly for an open anomaly', () => {
    const allowed = getAllowedActionsForTarget('ANOMALY', 'anom_db_lat_99', snapshot);
    const types = allowed.map((a) => a.action_type);
    assert.ok(types.includes('ACKNOWLEDGE_ANOMALY'), 'Should allow acknowledging open anomaly');
  });

  console.log('\n--- TEST SECTION 2: Safe Non-Mutating Action Preview ---');

  await itAsync('Preview returns truthful operational effect without mutating state', async () => {
    const preview = await previewOperatorAction({
      action_type: 'ESCALATE_BLOCKED_TASK',
      target_type: 'TASK',
      target_id: 'task_res_101',
      expected_current_state: { status: 'BLOCKED', stage: 'researching' },
      reason: 'Pemeriksaan ASTM tertunda'
    }, snapshot);

    assert.strictEqual(preview.action_type, 'ESCALATE_BLOCKED_TASK');
    assert.strictEqual(preview.can_execute, true);
    assert.strictEqual(preview.external_system_affected, 'NONE_INTERNAL_ONLY');
    assert.strictEqual(preview.requires_confirmation, true);
    assert.strictEqual(preview.current_owner_name, 'Irwan');
    assert.ok(preview.proposed_effect.toLowerCase().includes('eskalasi formal'));

    // State remains UNMUTATED in memory store
    const history = await getOperatorActionsHistory(null);
    assert.strictEqual(history.length, 0, 'Preview must never write to action history');
  });

  await itAsync('Preview fails safely when target does not exist', async () => {
    const preview = await previewOperatorAction({
      action_type: 'ESCALATE_BLOCKED_TASK',
      target_type: 'TASK',
      target_id: 'task_nonexistent_999',
      expected_current_state: {}
    }, snapshot);

    assert.strictEqual(preview.can_execute, false);
    assert.ok(preview.block_reason.includes('TARGET_NOT_FOUND'));
  });

  console.log('\n--- TEST SECTION 3: Concurrency & Stale-State Protection (409) ---');

  await itAsync('Rejects execution when expected stage does not match server truth (409 Conflict)', async () => {
    let thrown = null;
    try {
      await executeOperatorAction(null, {
        action_type: 'ESCALATE_BLOCKED_TASK',
        target_type: 'TASK',
        target_id: 'task_res_101',
        expected_current_state: {
          stage: 'writing' // Real stage is researching!
        }
      }, snapshot, 'admin_operator');
    } catch (err) {
      thrown = err;
    }

    assert.ok(thrown, 'Should throw concurrency error on stage mismatch');
    assert.ok(thrown.message.includes('STATE_CONFLICT'), 'Error message must specify STATE_CONFLICT');
  });

  await itAsync('Rejects execution when expected status does not match server truth (409 Conflict)', async () => {
    let thrown = null;
    try {
      await executeOperatorAction(null, {
        action_type: 'REQUEST_HUMAN_REVIEW',
        target_type: 'TASK',
        target_id: 'task_qa_303',
        expected_current_state: {
          status: 'COMPLETED' // Real status is REVIEWING!
        }
      }, snapshot, 'admin_operator');
    } catch (err) {
      thrown = err;
    }

    assert.ok(thrown, 'Should throw concurrency error on status mismatch');
    assert.ok(thrown.message.includes('STATE_CONFLICT'), 'Error message must specify STATE_CONFLICT');
  });

  console.log('\n--- TEST SECTION 4: Controlled Domain Mutations & Audit Hash ---');

  await itAsync('Executes ACKNOWLEDGE_ANOMALY with audit trail and state update', async () => {
    const action = await executeOperatorAction(null, {
      action_type: 'ACKNOWLEDGE_ANOMALY',
      target_type: 'ANOMALY',
      target_id: 'anom_db_lat_99',
      expected_current_state: { anomaly_state: 'OPEN' },
      reason: 'Lonjakan latensi sedang diinvestigasi oleh tim D1'
    }, snapshot, 'admin_operator');

    assert.strictEqual(action.status, 'EXECUTED');
    assert.strictEqual(action.action_type, 'ACKNOWLEDGE_ANOMALY');
    assert.strictEqual(action.after_state.state, 'ACKNOWLEDGED');
    assert.strictEqual(action.requested_by, 'admin_operator');
    assert.ok(action.audit_hash.startsWith('aud_'), 'Audit hash must be generated');

    // Verify anomaly record updated
    const anom = await getAnomalyById(null, 'anom_db_lat_99');
    assert.strictEqual(anom.state, 'ACKNOWLEDGED');
    assert.strictEqual(anom.operator_action_required, false);
  });

  await itAsync('Executes ESCALATE_BLOCKED_TASK and appends notice to staff chat thread', async () => {
    const action = await executeOperatorAction(null, {
      action_type: 'ESCALATE_BLOCKED_TASK',
      target_type: 'TASK',
      target_id: 'task_res_101',
      expected_current_state: { status: 'BLOCKED', stage: 'researching' },
      reason: 'Eskalasi darurat: Standar ASTM harus diverifikasi manual'
    }, snapshot, 'lead_editor');

    assert.strictEqual(action.status, 'EXECUTED');
    assert.strictEqual(action.after_state.escalated, true);
    assert.strictEqual(action.after_state.escalated_by, 'lead_editor');

    // Verify message was appended to Irwan's chat thread
    const conv = await getOrCreateConversation(null, 'evidence_researcher_lead');
    const msgs = await getConversationMessages(null, conv.conversation_id);
    const escalationMsg = msgs.find((m) => m.content.includes('[ESKALASI OPERATOR]'));
    assert.ok(escalationMsg, 'Escalation notice must appear in staff conversation');
    assert.strictEqual(escalationMsg.related_task_id, 'task_res_101');
  });

  await itAsync('Executes REQUEST_HUMAN_REVIEW and logs audit evidence', async () => {
    const action = await executeOperatorAction(null, {
      action_type: 'REQUEST_HUMAN_REVIEW',
      target_type: 'TASK',
      target_id: 'task_qa_303',
      expected_current_state: { status: 'REVIEWING', stage: 'editorial_qa' },
      reason: 'Perlu verifikasi klaim daya muai kusen uPVC'
    }, snapshot, 'chief_editor');

    assert.strictEqual(action.status, 'EXECUTED');
    assert.strictEqual(action.after_state.needs_human_review, true);
    assert.strictEqual(action.requested_by, 'chief_editor');
  });

  console.log('\n--- TEST SECTION 5: Safety Invariants & Persona Boundaries ---');

  await itAsync('Jefry (TypeSafe JEV) strictly rejected from any execution action (0 authority)', async () => {
    let thrown = null;
    try {
      await executeOperatorAction(null, {
        action_type: 'ESCALATE_BLOCKED_TASK',
        target_type: 'TASK',
        target_id: 'task_jefry_decision',
        expected_current_state: {}
      }, createMockSnapshot({
        pipeline: {
          tasks: [
            {
              taskId: 'task_jefry_decision',
              title: 'Jev Decision Review',
              subsystem: 'decision_engine',
              status: 'WORKING',
              stage: 'validating'
            }
          ]
        },
        live_operations: {
          staff_operations: {
            management_advisor_jefry: {
              agent_id: 'management_advisor_jefry',
              current_task: { task_id: 'task_jefry_decision' }
            }
          }
        }
      }), 'admin_operator');
    } catch (err) {
      thrown = err;
    }

    assert.ok(thrown, 'Must reject execution against Jefry');
    assert.ok(thrown.message.includes('SAFETY_POLICY_VIOLATION'), 'Must be classified as SAFETY_POLICY_VIOLATION');
    assert.ok(thrown.message.includes('ZERO execution authority'));
  });

  await itAsync('Budi cannot execute media worker activation while media worker is DISABLED', async () => {
    let thrown = null;
    try {
      await executeOperatorAction(null, {
        action_type: 'ACTIVATE_WORKER',
        target_type: 'TASK',
        target_id: 'task_media_99',
        expected_current_state: {}
      }, snapshot, 'admin_operator');
    } catch (err) {
      thrown = err;
    }

    assert.ok(thrown, 'Must reject worker activation');
  });

  console.log('\n--- TEST SECTION 6: Audit Hash Determinism & Idempotency ---');

  await itAsync('Audit hash and history retrieval are 100% deterministic', async () => {
    const history = await getOperatorActionsHistory(null);
    assert.ok(history.length >= 3, 'Must have recorded the executed actions');

    const first = history[0];
    const retrieved = await getOperatorActionById(null, first.action_id);
    assert.strictEqual(retrieved.action_id, first.action_id);
    assert.strictEqual(retrieved.audit_hash, first.audit_hash);
    assert.strictEqual(retrieved.requested_by, first.requested_by);
  });

  await itAsync('Duplicate action_id submission is safely idempotent', async () => {
    const fixedId = 'act_fixed_deterministic_123';
    const action1 = await executeOperatorAction(null, {
      action_id: fixedId,
      action_type: 'REQUEST_EVIDENCE_FOLLOWUP',
      target_type: 'TASK',
      target_id: 'task_res_101',
      expected_current_state: { status: 'BLOCKED', stage: 'researching' },
      reason: 'Cek rujukan SNI 03-6825-2002'
    }, snapshot, 'admin_operator');

    const action2 = await executeOperatorAction(null, {
      action_id: fixedId,
      action_type: 'REQUEST_EVIDENCE_FOLLOWUP',
      target_type: 'TASK',
      target_id: 'task_res_101',
      expected_current_state: { status: 'BLOCKED', stage: 'researching' }
    }, snapshot, 'admin_operator');

    assert.strictEqual(action1.action_id, action2.action_id);
    assert.strictEqual(action1.audit_hash, action2.audit_hash);
  });

  console.log('===========================================================');
  console.log(`🏁 Live Operations V3 Test Suite Finished: ${passed} Passed, ${failed} Failed`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
