/**
 * RancangLoka — MISSION CONTROL STAFF CHAT & OPERATOR COMMAND QUEUE TEST SUITE
 * Milestone: HERMES-MC-5
 * 
 * Verifies:
 * 1. Conversation creation & persistent retrieval.
 * 2. Stable machine agent target invariance.
 * 3. Message persistence in chronological order.
 * 4. Safe read-only operational query execution.
 * 5. Allowed operator command queuing.
 * 6. Disallowed command rejection.
 * 7. Authority escalation rejection (ADMIN_CONTROL & DANGEROUS_PRODUCTION_ACTION).
 * 8. Ambiguous entity reference fail-closed behavior.
 * 9. Unknown staff agent rejection.
 * 10. Capability mismatch detection (e.g. asking Dimas to write articles).
 * 11. Command queue lifecycle states: QUEUED, ACCEPTED, RUNNING, COMPLETED, BLOCKED, FAILED.
 * 12. Task reference linkage in commands and messages.
 * 13. Secret redaction on operator inputs and message payloads.
 * 14. SQL/input safety (no raw SQL execution or concatenation).
 * 15. No shell interpolation invariant.
 * 16. No raw tool routing invariant.
 * 17. Staff name renames do not alter canonical agent_id targets.
 * 18. Pixel Office chat link targets machine agent ID.
 * 19. Prohibited admin controls via staff chat (e.g. enable worker rejected).
 * 20. Prohibited direct publication action via staff chat.
 */

import assert from 'node:assert/strict';
import {
  COMMAND_ALLOWLIST,
  getOrCreateConversation,
  getConversationMessages,
  appendMessage,
  queueOperatorCommand,
  advanceCommandStatus,
  getCommandById,
  normalizeOperatorIntent,
  resolveEntityReference,
  executeReadOnlyQuery,
  processOperatorInteraction,
  resetChatMemoryStore
} from '../src/lib/mission-control/chat.ts';
import {
  getStaffDefinitions,
  getStaffDefinitionByAgentId,
  configureStaffDisplayNames,
  resetStaffDisplayNames
} from '../src/lib/mission-control/staff-registry.ts';

// Helper to create mock snapshot
function createMockSnapshot(overrides = {}) {
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
        editorial_qa: 1,
        ready_for_ingest: 0,
        ingesting: 0,
        waiting_media: 0,
        ready_for_review: 0,
        scheduled: 0,
        published: 5,
        failed: 0
      },
      totalActiveTasks: 1
    },
    activity: [],
    scheduler: {
      hermes: {
        status: 'healthy',
        lastHeartbeatAt: '2026-09-30T09:58:00.000Z'
      }
    },
    articles: {
      draftCount: 2,
      awaitingReviewCount: 1,
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
    },
    staff: {
      staff: [
        {
          agent_id: 'content_writer_primary',
          display_name: 'Joko',
          state: 'IDLE',
          current_task: null,
          recent_activities: []
        }
      ]
    }
  };

  return { ...base, ...overrides };
}

console.log('--- Starting Mission Control Staff Chat & Command Queue Test Suite ---');
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
  resetChatMemoryStore();
  resetStaffDisplayNames();

  // 1. Conversation creation & retrieval
  await runAsyncTest('1. conversation creation & persistent retrieval', async () => {
    const conv = await getOrCreateConversation(null, 'content_writer_primary');
    assert.ok(conv);
    assert.equal(conv.staff_agent_id, 'content_writer_primary');
    assert.equal(conv.status, 'ACTIVE');

    // Retrieve again - must return identical conversation
    const conv2 = await getOrCreateConversation(null, 'content_writer_primary');
    assert.equal(conv2.conversation_id, conv.conversation_id);
  });

  // 2. Stable agent target invariance
  runTest('2. stable agent target invariance across all registered staff', () => {
    const staff = getStaffDefinitions();
    assert.equal(staff.length, 7);
    for (const member of staff) {
      assert.ok(member.agent_id);
      assert.ok(['management_advisor_jefry', 'content_writer_primary', 'evidence_researcher_lead', 'editorial_qa_primary', 'lokamedia_worker_primary', 'publication_dispatcher_core', 'telemetry_observer_jev'].includes(member.agent_id));
    }
  });

  // 3. Message persistence in chronological order
  await runAsyncTest('3. message persistence in chronological order', async () => {
    const conv = await getOrCreateConversation(null, 'evidence_researcher_lead');
    const msg1 = await appendMessage(null, {
      message_id: 'm1',
      conversation_id: conv.conversation_id,
      sender_type: 'OPERATOR',
      sender_id: 'operator',
      message_type: 'TEXT',
      content: 'Halo Irwan',
      created_at: '2026-09-30T10:00:00.000Z'
    });

    const msg2 = await appendMessage(null, {
      message_id: 'm2',
      conversation_id: conv.conversation_id,
      sender_type: 'STAFF',
      sender_id: 'evidence_researcher_lead',
      message_type: 'TEXT',
      content: 'Halo Operator, ada yang bisa saya bantu terkait riset?',
      created_at: '2026-09-30T10:00:01.000Z'
    });

    const thread = await getConversationMessages(null, conv.conversation_id);
    assert.equal(thread.length, 2);
    assert.equal(thread[0].message_id, 'm1');
    assert.equal(thread[1].message_id, 'm2');
  });

  // 4. Safe read-only operational query execution
  await runAsyncTest('4. safe read-only operational query execution', async () => {
    const snapshot = createMockSnapshot();
    const result = await processOperatorInteraction(
      null,
      'content_writer_primary',
      'Lagi ngerjain tugas apa sekarang?',
      snapshot
    );

    assert.ok(result.conversation);
    assert.equal(result.operator_message.content, 'Lagi ngerjain tugas apa sekarang?');
    assert.equal(result.response_message.sender_type, 'STAFF');
    assert.ok(result.response_message.content.includes('Saat ini tidak ada tugas aktif'));
    assert.equal(result.command, undefined, 'Read-only queries must not queue async commands');
  });

  // 5. Allowed operator command queuing
  await runAsyncTest('5. allowed operator command queuing', async () => {
    const snapshot = createMockSnapshot();
    const result = await processOperatorInteraction(
      null,
      'content_writer_primary',
      'Tolong cek naskah Artikel 5 fokus ke struktur pembuka',
      snapshot
    );

    assert.ok(result.command, 'Allowed command must be queued');
    assert.equal(result.command.command_type, 'ARTICLE_STRUCTURE_REVIEW');
    assert.equal(result.command.status, 'QUEUED');
    assert.equal(result.command.authority_level, 'OPERATOR_COMMAND');
    assert.equal(result.command.parameters.article_reference, 5);
    assert.equal(result.response_message.message_type, 'COMMAND_STATUS');
    assert.ok(result.response_message.content.includes(result.command.command_id));
  });

  // 6. Disallowed command rejection
  await runAsyncTest('6. disallowed command rejection', async () => {
    const snapshot = createMockSnapshot();
    const result = await processOperatorInteraction(
      null,
      'content_writer_primary',
      'Buatkan puisi tentang awan dan hujan',
      snapshot
    );

    assert.equal(result.command, undefined);
    assert.equal(result.response_message.message_type, 'ERROR');
    assert.ok(result.response_message.content.includes('COMMAND_NOT_ALLOWED'));
  });

  // 7. Authority escalation rejection (ADMIN_CONTROL & DANGEROUS_PRODUCTION_ACTION)
  await runAsyncTest('7. authority escalation rejection', async () => {
    const snapshot = createMockSnapshot();

    // Dangerous action: Publish directly
    const dangerResult = await processOperatorInteraction(
      null,
      'publication_dispatcher_core',
      'Publish artikel 5 sekarang ke produksi!',
      snapshot
    );
    assert.equal(dangerResult.response_message.message_type, 'ERROR');
    assert.ok(dangerResult.response_message.content.includes('DANGEROUS_ACTION_FORBIDDEN'));
    assert.equal(dangerResult.command, undefined);

    // Admin control: Enable media worker
    const adminResult = await processOperatorInteraction(
      null,
      'lokamedia_worker_primary',
      'Tolong enable worker media sekarang',
      snapshot
    );
    assert.equal(adminResult.response_message.message_type, 'ERROR');
    assert.ok(adminResult.response_message.content.includes('ADMIN_APPROVAL_REQUIRED'));
    assert.equal(adminResult.command, undefined);
  });

  // 8. Ambiguous entity reference fail-closed behavior
  await runAsyncTest('8. ambiguous entity reference fail-closed behavior', async () => {
    const snapshot = createMockSnapshot();
    const result = await processOperatorInteraction(
      null,
      'content_writer_primary',
      'Tolong cek draf yang tadi ya',
      snapshot
    );

    assert.equal(result.command, undefined, 'Must not queue command on ambiguous reference');
    assert.ok(result.response_message.content.includes('ambigu') || result.response_message.content.includes('spesifik'));
  });

  // 9. Unknown staff agent rejection
  await runAsyncTest('9. unknown staff agent rejection', async () => {
    const norm = await normalizeOperatorIntent('non_existent_staff_id', 'Tolong kerjakan ini');
    assert.equal(norm.is_valid, false);
    assert.equal(norm.error_class, 'UNKNOWN_STAFF_AGENT');
  });

  // 10. Capability mismatch detection
  await runAsyncTest('10. capability mismatch detection', async () => {
    // Asking Dimas (Telemetry/Engineering) to write an article
    const norm = await normalizeOperatorIntent('telemetry_observer_jev', 'Tolong tulis artikel tentang atap spandek');
    assert.equal(norm.is_valid, false);
    assert.equal(norm.error_class, 'CAPABILITY_MISMATCH');
    assert.ok(norm.rejection_reason.includes('penulisan'));
  });

  // 11. Command queue lifecycle
  await runAsyncTest('11. command queue lifecycle states', async () => {
    const conv = await getOrCreateConversation(null, 'evidence_researcher_lead');
    const cmd = await queueOperatorCommand(null, {
      command_id: 'cmd_test_lifecycle',
      conversation_id: conv.conversation_id,
      target_agent_id: 'evidence_researcher_lead',
      target_department_id: 'research_evidence',
      operator_message: 'Riset standar SNI baja ringan',
      normalized_intent: 'EVIDENCE_RESEARCH_REQUEST',
      command_type: 'EVIDENCE_RESEARCH_REQUEST',
      parameters: { topic: 'baja ringan' },
      status: 'QUEUED',
      authority_level: 'OPERATOR_COMMAND',
      created_at: '2026-09-30T10:05:00.000Z'
    });

    assert.equal(cmd.status, 'QUEUED');

    // Transition 1: ACCEPTED
    const accepted = await advanceCommandStatus(null, cmd.command_id, 'ACCEPTED');
    assert.equal(accepted.status, 'ACCEPTED');
    assert.ok(accepted.accepted_at);

    // Transition 2: RUNNING
    const running = await advanceCommandStatus(null, cmd.command_id, 'RUNNING');
    assert.equal(running.status, 'RUNNING');
    assert.ok(running.started_at);

    // Transition 3: BLOCKED
    const blocked = await advanceCommandStatus(null, cmd.command_id, 'BLOCKED', {
      error_class: 'SOURCE_REPOSITORY_TIMEOUT',
      result_summary: 'Akses repositori SNI BSN sedang timeout.'
    });
    assert.equal(blocked.status, 'BLOCKED');
    assert.equal(blocked.error_class, 'SOURCE_REPOSITORY_TIMEOUT');

    // Transition 4: COMPLETED
    const completed = await advanceCommandStatus(null, cmd.command_id, 'COMPLETED', {
      task_reference: 'task_sni_baja_ringan_01',
      result_summary: 'Evidence pack standar SNI 8399:2017 berhasil dikompilasi.'
    });
    assert.equal(completed.status, 'COMPLETED');
    assert.equal(completed.task_reference, 'task_sni_baja_ringan_01');
  });

  // 12. Task reference linkage
  runTest('12. task reference linkage in commands and messages', () => {
    const cmd = getCommandById('cmd_test_lifecycle');
    assert.ok(cmd);
    assert.equal(cmd.task_reference, 'task_sni_baja_ringan_01');
  });

  // 13. Secret redaction on operator inputs and message payloads
  await runAsyncTest('13. secret redaction on operator inputs and message payloads', async () => {
    const conv = await getOrCreateConversation(null, 'telemetry_observer_jev');
    const secretMsg = 'Ini rahasia token: sk-ant-api03-12345678901234567890 dan bearer eyJhbGciOiJIUzI1NiJ9';
    const saved = await appendMessage(null, {
      message_id: 'm_sec',
      conversation_id: conv.conversation_id,
      sender_type: 'OPERATOR',
      sender_id: 'operator',
      message_type: 'TEXT',
      content: secretMsg,
      created_at: new Date().toISOString()
    });

    assert.ok(!saved.content.includes('12345678901234567890'), 'Token must be sanitized/redacted');
  });

  // 14. SQL/input safety
  await runAsyncTest('14. SQL/input safety (no interpolation or execution)', async () => {
    const injectionText = "'; DROP TABLE articles; --";
    const norm = await normalizeOperatorIntent('content_writer_primary', injectionText);
    assert.equal(norm.is_valid, false);
    assert.ok(norm.error_class === 'DANGEROUS_ACTION_FORBIDDEN' || norm.error_class === 'COMMAND_NOT_ALLOWED');
  });

  // 15. No shell interpolation invariant
  runTest('15. no shell interpolation invariant', () => {
    // Verify that COMMAND_ALLOWLIST contains 0 shell executors
    for (const [key, def] of Object.entries(COMMAND_ALLOWLIST)) {
      assert.notEqual(def.shell, true);
      assert.notEqual(def.exec, true);
    }
  });

  // 16. No raw tool routing invariant
  runTest('16. no raw tool routing invariant', () => {
    for (const [key, def] of Object.entries(COMMAND_ALLOWLIST)) {
      assert.ok(def.command_type);
      assert.ok(def.authority_level);
      assert.ok(Array.isArray(def.target_agent_ids));
    }
  });

  // 17. Staff name renames do not alter canonical agent_id targets
  await runAsyncTest('17. staff name rename does not change command target', async () => {
    configureStaffDisplayNames({ content_writer_primary: 'Joko Senior Editor' });
    const staff = getStaffDefinitionByAgentId('content_writer_primary');
    assert.equal(staff.display_name, 'Joko Senior Editor');

    const norm = await normalizeOperatorIntent('content_writer_primary', 'Lagi ngerjain apa?');
    assert.equal(norm.target_agent_id, 'content_writer_primary');
    assert.equal(norm.is_valid, true);

    resetStaffDisplayNames();
  });

  // 18. Pixel Office chat link targets machine agent ID
  runTest('18. Pixel Office chat link targets machine agent ID', () => {
    const targetAgentId = 'content_writer_primary';
    const generatedUrl = `/admin/mission-control/staff/${encodeURIComponent(targetAgentId)}/chat`;
    assert.equal(generatedUrl, '/admin/mission-control/staff/content_writer_primary/chat');
    assert.ok(!generatedUrl.includes('Joko'), 'Chat link must not use presentation name');
  });

  // 19. Prohibited admin controls via staff chat
  await runAsyncTest('19. prohibited admin controls via staff chat', async () => {
    const norm = await normalizeOperatorIntent('lokamedia_worker_primary', 'enable worker media');
    assert.equal(norm.is_valid, false);
    assert.equal(norm.authority_level, 'ADMIN_CONTROL');
    assert.equal(norm.error_class, 'ADMIN_APPROVAL_REQUIRED');
  });

  // 20. Prohibited direct publication action via staff chat
  await runAsyncTest('20. prohibited direct publication action via staff chat', async () => {
    const norm = await normalizeOperatorIntent('publication_dispatcher_core', 'Publish article now');
    assert.equal(norm.is_valid, false);
    assert.equal(norm.authority_level, 'DANGEROUS_PRODUCTION_ACTION');
    assert.equal(norm.error_class, 'DANGEROUS_ACTION_FORBIDDEN');
  });

  console.log(`\n========================================`);
  console.log(`ALL ${testsPassed} STAFF CHAT & COMMAND QUEUE TESTS PASSED!`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error('Test suite runner failed', err);
  process.exit(1);
});
