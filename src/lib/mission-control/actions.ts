/**
 * RancangLoka Hermes Mission Control — Controlled Human Intervention & Workstation Action Gate
 * Milestone: MC-LIVEOPS-3
 * 
 * Strict Invariants:
 * 1. EXPLICIT HUMAN INTENT: All mutations require an authenticated human operator and explicit confirmation.
 * 2. ZERO AUTONOMOUS AUTHORITY: Jefry (TypeSafe JEV) is shadow advisory only (0 execution authority).
 * 3. STRICT ACTION ALLOWLIST: Only allowlisted, low-risk internal workflow actions are permitted.
 * 4. SAFE PREVIEW BEFORE EXECUTION: Every action can be previewed without state mutation.
 * 5. CONCURRENCY & STALE-STATE PROTECTION: Validates expected_current_state against canonical system truth (returns 409 on conflict).
 * 6. AUDIT TRAIL: Every executed action generates immutable audit evidence linked to tasks, staff, and job traces.
 * 7. SAFETY BASELINE PRESERVED:
 *    - automation_mode = OFF
 *    - SOCIAL_AUTOMATION = OFF
 *    - publishing_authority = 0
 *    - mediaWorker = DISABLED
 *    - autonomous publishing = OFF
 */

import type { MissionControlSnapshot, TaskCard } from './types.ts';
import { sanitizeString } from './redact.ts';
import { getStaffDefinitionByAgentId } from './staff-registry.ts';
import { getOrCreateConversation, appendMessage } from './chat.ts';
import { getAnomalyById, acknowledgeAnomaly, type MissionControlAnomaly } from './anomalies.ts';

// ============================================================================
// Types & Contracts
// ============================================================================

export type OperatorActionType =
  | 'ACKNOWLEDGE_ANOMALY'
  | 'ESCALATE_BLOCKED_TASK'
  | 'REQUEST_HUMAN_REVIEW'
  | 'REQUEST_EVIDENCE_FOLLOWUP';

export type ActionTargetType = 'TASK' | 'ANOMALY' | 'STAFF' | 'ARTICLE';

export type ActionSafetyClass = 'LOW_RISK_INTERNAL' | 'GOVERNANCE_REVIEW';

export interface ExpectedCurrentState {
  owner_agent_id?: string | null;
  stage?: string | null;
  status?: string | null;
  anomaly_state?: string | null;
}

export interface HumanOperatorActionRequest {
  action_id?: string;
  action_type: OperatorActionType;
  target_type: ActionTargetType;
  target_id: string;
  expected_current_state: ExpectedCurrentState;
  reason?: string | null;
  payload?: Record<string, any>;
}

export interface HumanOperatorAction {
  action_id: string;
  action_type: OperatorActionType;
  target_type: ActionTargetType;
  target_id: string;
  requested_by: string;
  requested_at: string;
  completed_at: string;
  reason?: string | null;
  expected_current_state: ExpectedCurrentState;
  before_state: Record<string, any>;
  after_state: Record<string, any>;
  safety_class: ActionSafetyClass;
  status: 'EXECUTED' | 'REJECTED' | 'FAILED';
  result_summary: string;
  audit_hash: string;
  related_task_id?: string | null;
  related_anomaly_id?: string | null;
  related_agent_id?: string | null;
}

export interface OperatorActionPreview {
  action_type: OperatorActionType;
  action_label: string;
  target_type: ActionTargetType;
  target_id: string;
  target_title: string;
  current_owner: string | null;
  current_owner_name: string | null;
  current_state: Record<string, any>;
  proposed_effect: string;
  subsystem_affected: string;
  external_system_affected: 'NONE_INTERNAL_ONLY';
  audit_entry_description: string;
  is_reversible: boolean;
  safety_class: ActionSafetyClass;
  safety_boundary_note: string;
  requires_confirmation: boolean;
  can_execute: boolean;
  block_reason?: string | null;
}

export interface ActionDefinition {
  action_type: OperatorActionType;
  label: string;
  description: string;
  target_type: ActionTargetType;
  safety_class: ActionSafetyClass;
  required_fields: string[];
  requires_confirmation: boolean;
  is_reversible: boolean;
  subsystem_affected: string;
}

// ============================================================================
// Action Allowlist
// ============================================================================

export const ACTION_ALLOWLIST: Record<OperatorActionType, ActionDefinition> = {
  ACKNOWLEDGE_ANOMALY: {
    action_type: 'ACKNOWLEDGE_ANOMALY',
    label: 'Akui Anomali (Acknowledge)',
    description: 'Menandai anomali aktif sebagai diketahui operator manusia untuk audit dan peredaman alarm ganda.',
    target_type: 'ANOMALY',
    safety_class: 'LOW_RISK_INTERNAL',
    required_fields: ['target_id'],
    requires_confirmation: true,
    is_reversible: false,
    subsystem_affected: 'mission_control_anomalies'
  },
  ESCALATE_BLOCKED_TASK: {
    action_type: 'ESCALATE_BLOCKED_TASK',
    label: 'Eskalasi Tugas Terhambat',
    description: 'Mencatat eskalasi formal untuk tugas terhambat ke antrean perhatian Chief Editor/Lead.',
    target_type: 'TASK',
    safety_class: 'LOW_RISK_INTERNAL',
    required_fields: ['target_id'],
    requires_confirmation: true,
    is_reversible: false,
    subsystem_affected: 'editorial_pipeline'
  },
  REQUEST_HUMAN_REVIEW: {
    action_type: 'REQUEST_HUMAN_REVIEW',
    label: 'Minta Peninjauan Manusia (Human Review)',
    description: 'Menandai naskah/tugas draf aktif untuk pemeriksaan manual mendalam oleh editor sebelum berlanjut.',
    target_type: 'TASK',
    safety_class: 'GOVERNANCE_REVIEW',
    required_fields: ['target_id'],
    requires_confirmation: true,
    is_reversible: true,
    subsystem_affected: 'editorial_pipeline'
  },
  REQUEST_EVIDENCE_FOLLOWUP: {
    action_type: 'REQUEST_EVIDENCE_FOLLOWUP',
    label: 'Minta Tindak Lanjut Bukti',
    description: 'Menugaskan pencarian bukti empiris/sitasi tambahan pada tugas riset yang sedang berlangsung.',
    target_type: 'TASK',
    safety_class: 'LOW_RISK_INTERNAL',
    required_fields: ['target_id'],
    requires_confirmation: true,
    is_reversible: true,
    subsystem_affected: 'research_evidence'
  }
};

// ============================================================================
// In-Memory Dual Store Fallback
// ============================================================================

const memoryOperatorActions: Map<string, HumanOperatorAction> = new Map();
const memoryOperatorActionHistory: HumanOperatorAction[] = [];

export function resetOperatorActionsMemoryStore(): void {
  memoryOperatorActions.clear();
  memoryOperatorActionHistory.length = 0;
}

// ============================================================================
// Deterministic Hash Helper
// ============================================================================

function generateAuditHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return 'aud_' + (hash >>> 0).toString(16).padStart(8, '0');
}

// ============================================================================
// Target Resolution & State Check
// ============================================================================

export function resolveActionTarget(
  targetType: ActionTargetType,
  targetId: string,
  snapshot: MissionControlSnapshot | null
): {
  found: boolean;
  target_id: string;
  target_title: string;
  current_owner: string | null;
  current_state: Record<string, any>;
  blocking_condition?: string | null;
} {
  const normId = targetId.trim();

  if (targetType === 'ANOMALY') {
    const activeAnoms = snapshot?.anomalies?.active_anomalies || [];
    const anom = activeAnoms.find((a: any) => a.anomaly_id === normId) || null;
    if (anom) {
      return {
        found: true,
        target_id: anom.anomaly_id,
        target_title: anom.title,
        current_owner: anom.responsible_agent_id || null,
        current_state: {
          state: anom.state,
          severity: anom.severity,
          department_id: anom.department_id,
          operator_action_required: anom.operator_action_required
        },
        blocking_condition: anom.technical_detail || null
      };
    }
  }

  // Check in Tasks
  const tasks = snapshot?.pipeline?.tasks || [];
  const task = tasks.find((t: TaskCard) => t.taskId === normId || String(t.relatedArticleId) === normId);
  if (task) {
    let owner: string | null = null;
    if (task.stage === 'researching') owner = 'evidence_researcher_lead';
    else if (task.stage === 'writing' || task.stage === 'draft') owner = 'content_writer_primary';
    else if (task.stage === 'editorial_qa' || task.stage === 'validating' || task.stage === 'ready_for_review') owner = 'editorial_qa_primary';
    else if (task.stage === 'waiting_media') owner = 'lokamedia_worker_primary';
    else if (task.stage === 'scheduled' || task.stage === 'published') owner = 'publication_dispatcher_core';

    return {
      found: true,
      target_id: task.taskId,
      target_title: task.title,
      current_owner: owner,
      current_state: {
        stage: task.stage,
        status: task.status,
        blockerOrError: task.blockerOrError,
        relatedArticleId: task.relatedArticleId,
        retryCount: task.retryCount
      },
      blocking_condition: task.blockerOrError || null
    };
  }

  // Check in Live Operations staff tasks
  const liveOps = snapshot?.live_operations?.staff_operations || {};
  for (const [agentId, op] of Object.entries(liveOps)) {
    if (op.current_task && (op.current_task.task_id === normId || String(op.current_task.related_article_id) === normId)) {
      return {
        found: true,
        target_id: op.current_task.task_id,
        target_title: op.current_task.task_title,
        current_owner: agentId,
        current_state: {
          stage: op.current_task.stage,
          status: op.current_task.status,
          blocking_condition: op.current_task.blocking_condition,
          relatedArticleId: op.current_task.related_article_id
        },
        blocking_condition: op.current_task.blocking_condition || null
      };
    }
  }

  return {
    found: false,
    target_id: normId,
    target_title: normId,
    current_owner: null,
    current_state: {}
  };
}

// ============================================================================
// Action Allowed For Target & State
// ============================================================================

export function getAllowedActionsForTarget(
  targetType: ActionTargetType,
  targetId: string,
  snapshot: MissionControlSnapshot | null
): ActionDefinition[] {
  const target = resolveActionTarget(targetType, targetId, snapshot);
  if (!target.found) return [];

  // Jefry Safety Guard: No execution actions on Jefry
  if (target.current_owner === 'management_advisor_jefry' || target.target_id.includes('jefry') || target.target_id.includes('jev')) {
    return [];
  }

  // Budi Safety Guard: Media Worker is DISABLED
  if (target.current_owner === 'lokamedia_worker_primary') {
    // Only anomaly acknowledgement or read-only/escalation if blocked
    if (targetType === 'ANOMALY') {
      return [ACTION_ALLOWLIST.ACKNOWLEDGE_ANOMALY];
    }
    return [];
  }

  const allowed: ActionDefinition[] = [];

  if (targetType === 'ANOMALY') {
    if (target.current_state.state === 'OPEN') {
      allowed.push(ACTION_ALLOWLIST.ACKNOWLEDGE_ANOMALY);
    }
    return allowed;
  }

  if (targetType === 'TASK') {
    const isBlocked = Boolean(target.blocking_condition) || target.current_state.status === 'BLOCKED' || target.current_state.stage === 'failed';
    if (isBlocked) {
      allowed.push(ACTION_ALLOWLIST.ESCALATE_BLOCKED_TASK);
      if (target.current_owner === 'evidence_researcher_lead') {
        allowed.push(ACTION_ALLOWLIST.REQUEST_EVIDENCE_FOLLOWUP);
      }
    } else {
      // Normal running / reviewing tasks
      if (['writing', 'draft', 'editorial_qa', 'validating', 'ready_for_review'].includes(target.current_state.stage)) {
        allowed.push(ACTION_ALLOWLIST.REQUEST_HUMAN_REVIEW);
      }
      if (target.current_owner === 'evidence_researcher_lead') {
        allowed.push(ACTION_ALLOWLIST.REQUEST_EVIDENCE_FOLLOWUP);
      }
    }
  }

  return allowed;
}

// ============================================================================
// Action Preview
// ============================================================================

export async function previewOperatorAction(
  request: HumanOperatorActionRequest,
  snapshot: MissionControlSnapshot | null
): Promise<OperatorActionPreview> {
  const def = ACTION_ALLOWLIST[request.action_type];
  if (!def) {
    throw new Error(`UNSUPPORTED_ACTION: Action type ${request.action_type} is not in the allowed action registry.`);
  }

  const target = resolveActionTarget(request.target_type, request.target_id, snapshot);
  if (!target.found) {
    return {
      action_type: request.action_type,
      action_label: def.label,
      target_type: request.target_type,
      target_id: request.target_id,
      target_title: request.target_id,
      current_owner: null,
      current_owner_name: null,
      current_state: {},
      proposed_effect: 'Target tidak ditemukan dalam sistem telemetri.',
      subsystem_affected: def.subsystem_affected,
      external_system_affected: 'NONE_INTERNAL_ONLY',
      audit_entry_description: 'Akan ditolak: Target tidak ditemukan.',
      is_reversible: def.is_reversible,
      safety_class: def.safety_class,
      safety_boundary_note: 'Gagal: Target tidak valid.',
      requires_confirmation: def.requires_confirmation,
      can_execute: false,
      block_reason: 'TARGET_NOT_FOUND: Target tidak ditemukan dalam snapshot aktif.'
    };
  }

  // Safety Invariants Check
  if (target.current_owner === 'management_advisor_jefry' || target.target_id.includes('jefry') || target.target_id.includes('jev')) {
    return {
      action_type: request.action_type,
      action_label: def.label,
      target_type: request.target_type,
      target_id: target.target_id,
      target_title: target.target_title,
      current_owner: target.current_owner,
      current_owner_name: 'Jefry (TypeSafe JEV)',
      current_state: target.current_state,
      proposed_effect: 'Ditolak: Jefry beroperasi dalam mode shadow tanpa wewenang eksekusi.',
      subsystem_affected: def.subsystem_affected,
      external_system_affected: 'NONE_INTERNAL_ONLY',
      audit_entry_description: 'Pelanggaran keamanan: Otoritas eksekusi Jefry adalah 0.',
      is_reversible: false,
      safety_class: def.safety_class,
      safety_boundary_note: 'TypeSafe JEV bersifat Shadow Advisory Only. Zero otoritas eksekusi.',
      requires_confirmation: true,
      can_execute: false,
      block_reason: 'JEFRY_ZERO_AUTHORITY: Tindakan eksekusi terhadap entitas penasihat manajemen ditolak secara mutlak.'
    };
  }

  let ownerName = target.current_owner;
  if (target.current_owner) {
    const staffDef = getStaffDefinitionByAgentId(target.current_owner);
    if (staffDef) ownerName = staffDef.display_name;
  }

  let proposedEffect = '';
  let auditEntryDesc = '';

  switch (request.action_type) {
    case 'ACKNOWLEDGE_ANOMALY':
      proposedEffect = `Ubah status anomali '${target.target_title}' menjadi ACKNOWLEDGED, nonaktifkan alarm berulang, dan catat pengakuan ke riwayat audit staf.`;
      auditEntryDesc = `Operator manusia mengakui anomali ${target.target_id}.`;
      break;

    case 'ESCALATE_BLOCKED_TASK':
      proposedEffect = `Catat eskalasi formal untuk tugas #${target.target_id} (${target.target_title}), beri tanda perhatian prioritas, dan kirimkan laporan eskalasi ke thread staf ${ownerName}.`;
      auditEntryDesc = `Operator manusia mengekskalasi tugas terhambat ${target.target_id} dengan alasan: ${request.reason || 'Penyelidikan teknis mendesak'}.`;
      break;

    case 'REQUEST_HUMAN_REVIEW':
      proposedEffect = `Tandai tugas #${target.target_id} (${target.target_title}) membutuhkan peninjauan manual Chief Editor sebelum diizinkan melangkah ke tahap berikutnya.`;
      auditEntryDesc = `Operator manusia meminta peninjauan redaksi mendalam untuk ${target.target_id}.`;
      break;

    case 'REQUEST_EVIDENCE_FOLLOWUP':
      proposedEffect = `Catat permintaan tindak lanjut kelengkapan bukti empiris / rujukan standar untuk tugas #${target.target_id} ke antrean riset ${ownerName}.`;
      auditEntryDesc = `Operator meminta rujukan bukti tambahan untuk ${target.target_id}.`;
      break;
  }

  return {
    action_type: request.action_type,
    action_label: def.label,
    target_type: request.target_type,
    target_id: target.target_id,
    target_title: target.target_title,
    current_owner: target.current_owner,
    current_owner_name: ownerName,
    current_state: target.current_state,
    proposed_effect: proposedEffect,
    subsystem_affected: def.subsystem_affected,
    external_system_affected: 'NONE_INTERNAL_ONLY',
    audit_entry_description: auditEntryDesc,
    is_reversible: def.is_reversible,
    safety_class: def.safety_class,
    safety_boundary_note: 'Otoritas operator manusia terbatas pada sistem internal RancangLoka. Zero autonomous publishing • Media worker disabled.',
    requires_confirmation: def.requires_confirmation,
    can_execute: true,
    block_reason: null
  };
}

// ============================================================================
// Action Execution with Concurrency Guard & Audit Logging
// ============================================================================

export async function executeOperatorAction(
  db: any,
  request: HumanOperatorActionRequest,
  snapshot: MissionControlSnapshot | null,
  actor = 'admin_operator'
): Promise<HumanOperatorAction> {
  const def = ACTION_ALLOWLIST[request.action_type];
  if (!def) {
    throw new Error(`UNSUPPORTED_ACTION: Action type ${request.action_type} is not in the allowed action registry.`);
  }

  const target = resolveActionTarget(request.target_type, request.target_id, snapshot);
  if (!target.found) {
    throw new Error(`TARGET_NOT_FOUND: Target ${request.target_id} (${request.target_type}) not found in telemetry state.`);
  }

  // Safety Invariant Check: Jefry
  if (target.current_owner === 'management_advisor_jefry' || target.target_id.includes('jefry') || target.target_id.includes('jev')) {
    throw new Error('SAFETY_POLICY_VIOLATION: Jefry (TypeSafe JEV) has ZERO execution authority.');
  }

  // Safety Invariant Check: Media Worker Activation
  if (request.action_type as any === 'ACTIVATE_WORKER' || (target.current_owner === 'lokamedia_worker_primary' && request.action_type !== 'ACKNOWLEDGE_ANOMALY')) {
    throw new Error('SAFETY_POLICY_VIOLATION: Media Worker is strictly DISABLED by policy.');
  }

  // ==========================================================================
  // Concurrency & Stale-State Guard
  // ==========================================================================
  const expected = request.expected_current_state || {};
  if (expected.stage && target.current_state.stage && expected.stage !== target.current_state.stage) {
    throw new Error(`STATE_CONFLICT: Expected task stage '${expected.stage}' but found '${target.current_state.stage}'.`);
  }
  if (expected.status && target.current_state.status && expected.status !== target.current_state.status) {
    throw new Error(`STATE_CONFLICT: Expected task status '${expected.status}' but found '${target.current_state.status}'.`);
  }
  if (expected.anomaly_state && target.current_state.state && expected.anomaly_state !== target.current_state.state) {
    throw new Error(`STATE_CONFLICT: Expected anomaly state '${expected.anomaly_state}' but found '${target.current_state.state}'.`);
  }

  const now = new Date().toISOString();
  const actionId = request.action_id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Duplicate Check / Idempotency
  if (memoryOperatorActions.has(actionId)) {
    return memoryOperatorActions.get(actionId)!;
  }

  const beforeState = { ...target.current_state };
  const afterState = { ...target.current_state };
  let resultSummary = '';

  // ==========================================================================
  // Execute Domain Mutation
  // ==========================================================================
  switch (request.action_type) {
    case 'ACKNOWLEDGE_ANOMALY': {
      await acknowledgeAnomaly(db, target.target_id, actor, request.reason);
      afterState.state = 'ACKNOWLEDGED';
      afterState.operator_action_required = false;
      resultSummary = `Anomali '${target.target_title}' (${target.target_id}) berhasil diakui oleh ${actor}.`;
      break;
    }

    case 'ESCALATE_BLOCKED_TASK': {
      afterState.escalated = true;
      afterState.escalated_at = now;
      afterState.escalated_by = actor;
      afterState.escalation_reason = request.reason || 'Eskalasi operator atas hambatan teknis';

      resultSummary = `Tugas terhambat #${target.target_id} (${target.target_title}) berhasil dieskalasikan ke lead editorial.`;

      // Notify staff conversation
      if (target.current_owner) {
        try {
          const conv = await getOrCreateConversation(db, target.current_owner, actor);
          await appendMessage(db, {
            message_id: `msg_esc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            conversation_id: conv.conversation_id,
            sender_type: 'OPERATOR',
            sender_id: actor,
            message_type: 'SYSTEM_NOTICE',
            content: `📢 [ESKALASI OPERATOR]: Tugas #${target.target_id} (${target.target_title}) telah dieskalasikan oleh operator manusia.\nAlasan: ${request.reason || 'Tindak lanjut prioritas diperlukan.'}`,
            created_at: now,
            related_task_id: target.target_id
          });
        } catch {
          // Non-blocking notification
        }
      }
      break;
    }

    case 'REQUEST_HUMAN_REVIEW': {
      afterState.needs_human_review = true;
      afterState.review_requested_at = now;
      afterState.review_requested_by = actor;

      resultSummary = `Tugas #${target.target_id} (${target.target_title}) ditandai untuk peninjauan redaksi manusia.`;

      if (target.current_owner) {
        try {
          const conv = await getOrCreateConversation(db, target.current_owner, actor);
          await appendMessage(db, {
            message_id: `msg_rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            conversation_id: conv.conversation_id,
            sender_type: 'OPERATOR',
            sender_id: actor,
            message_type: 'SYSTEM_NOTICE',
            content: `🔍 [PERMINTAAN REVIEW REDAKSI]: Operator meminta verifikasi manual naskah untuk tugas #${target.target_id} (${target.target_title}).`,
            created_at: now,
            related_task_id: target.target_id
          });
        } catch {
          // Non-blocking notification
        }
      }
      break;
    }

    case 'REQUEST_EVIDENCE_FOLLOWUP': {
      afterState.evidence_followup_requested = true;
      afterState.evidence_followup_at = now;

      resultSummary = `Permintaan tindak lanjut bukti untuk #${target.target_id} telah dicatat.`;

      if (target.current_owner) {
        try {
          const conv = await getOrCreateConversation(db, target.current_owner, actor);
          await appendMessage(db, {
            message_id: `msg_evf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            conversation_id: conv.conversation_id,
            sender_type: 'OPERATOR',
            sender_id: actor,
            message_type: 'TEXT',
            content: `📚 [TINDAK LANJUT BUKTI]: Operator meminta penambahan bukti/sitasi rujukan untuk tugas #${target.target_id}.\nCatatan: ${request.reason || 'Mohon verifikasi sitasi standar teknis.'}`,
            created_at: now,
            related_task_id: target.target_id
          });
        } catch {
          // Non-blocking notification
        }
      }
      break;
    }
  }

  const auditString = `${actionId}:${request.action_type}:${target.target_id}:${actor}:${now}`;
  const auditHash = generateAuditHash(auditString);

  const completedAction: HumanOperatorAction = {
    action_id: actionId,
    action_type: request.action_type,
    target_type: request.target_type,
    target_id: target.target_id,
    requested_by: actor,
    requested_at: now,
    completed_at: now,
    reason: request.reason || null,
    expected_current_state: request.expected_current_state,
    before_state: beforeState,
    after_state: afterState,
    safety_class: def.safety_class,
    status: 'EXECUTED',
    result_summary: resultSummary,
    audit_hash: auditHash,
    related_task_id: request.target_type === 'TASK' ? target.target_id : undefined,
    related_anomaly_id: request.target_type === 'ANOMALY' ? target.target_id : undefined,
    related_agent_id: target.current_owner || undefined
  };

  // Persist to D1 if available
  if (db && typeof db.prepare === 'function') {
    try {
      await db.prepare(
        `INSERT INTO mission_control_operator_actions (
          action_id, action_type, target_type, target_id, requested_by, requested_at, completed_at,
          reason, expected_state_json, before_state_json, after_state_json, safety_class, status,
          result_summary, audit_hash, related_task_id, related_anomaly_id, related_agent_id, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        completedAction.action_id,
        completedAction.action_type,
        completedAction.target_type,
        completedAction.target_id,
        completedAction.requested_by,
        completedAction.requested_at,
        completedAction.completed_at,
        completedAction.reason || null,
        JSON.stringify(completedAction.expected_current_state || {}),
        JSON.stringify(completedAction.before_state || {}),
        JSON.stringify(completedAction.after_state || {}),
        completedAction.safety_class,
        completedAction.status,
        completedAction.result_summary,
        completedAction.audit_hash,
        completedAction.related_task_id || null,
        completedAction.related_anomaly_id || null,
        completedAction.related_agent_id || null,
        request.payload ? JSON.stringify(request.payload) : null
      ).run();
    } catch {
      // Memory fallback
    }
  }

  // Update memory store
  memoryOperatorActions.set(completedAction.action_id, completedAction);
  memoryOperatorActionHistory.unshift(completedAction);

  return completedAction;
}

// ============================================================================
// Query Functions
// ============================================================================

export async function getOperatorActionById(db: any, actionId: string): Promise<HumanOperatorAction | null> {
  if (memoryOperatorActions.has(actionId)) {
    return memoryOperatorActions.get(actionId)!;
  }
  if (db && typeof db.prepare === 'function') {
    try {
      const row = await db.prepare('SELECT * FROM mission_control_operator_actions WHERE action_id = ?').bind(actionId).first();
      if (row) {
        return {
          action_id: row.action_id,
          action_type: row.action_type,
          target_type: row.target_type,
          target_id: row.target_id,
          requested_by: row.requested_by,
          requested_at: row.requested_at,
          completed_at: row.completed_at,
          reason: row.reason,
          expected_current_state: row.expected_state_json ? JSON.parse(row.expected_state_json) : {},
          before_state: row.before_state_json ? JSON.parse(row.before_state_json) : {},
          after_state: row.after_state_json ? JSON.parse(row.after_state_json) : {},
          safety_class: row.safety_class,
          status: row.status,
          result_summary: row.result_summary,
          audit_hash: row.audit_hash,
          related_task_id: row.related_task_id,
          related_anomaly_id: row.related_anomaly_id,
          related_agent_id: row.related_agent_id
        };
      }
    } catch {
      // Fallback
    }
  }
  return null;
}

export async function getOperatorActionsHistory(db: any, limit = 50): Promise<HumanOperatorAction[]> {
  if (db && typeof db.prepare === 'function') {
    try {
      const { results } = await db.prepare('SELECT * FROM mission_control_operator_actions ORDER BY requested_at DESC LIMIT ?').bind(limit).all();
      if (Array.isArray(results) && results.length > 0) {
        return results.map((row: any) => ({
          action_id: row.action_id,
          action_type: row.action_type,
          target_type: row.target_type,
          target_id: row.target_id,
          requested_by: row.requested_by,
          requested_at: row.requested_at,
          completed_at: row.completed_at,
          reason: row.reason,
          expected_current_state: row.expected_state_json ? JSON.parse(row.expected_state_json) : {},
          before_state: row.before_state_json ? JSON.parse(row.before_state_json) : {},
          after_state: row.after_state_json ? JSON.parse(row.after_state_json) : {},
          safety_class: row.safety_class,
          status: row.status,
          result_summary: row.result_summary,
          audit_hash: row.audit_hash,
          related_task_id: row.related_task_id,
          related_anomaly_id: row.related_anomaly_id,
          related_agent_id: row.related_agent_id
        }));
      }
    } catch {
      // Memory fallback
    }
  }
  return memoryOperatorActionHistory.slice(0, limit);
}
