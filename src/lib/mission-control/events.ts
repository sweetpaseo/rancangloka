/**
 * RancangLoka Hermes Mission Control — Real-Time Operational Event Delivery
 * Milestone: MC-LIVEOPS-4
 * 
 * Strict Invariants:
 * 1. READ-ONLY DELIVERY INFRASTRUCTURE: Zero mutations, zero execution authority.
 * 2. SINGLE SOURCE OF TRUTH: Events are change notifications ("something changed"),
 *    NOT an alternate source of state truth. Client always reconciles from canonical snapshot.
 * 3. DETERMINISTIC CHANGE TOKEN: Revision tokens derive exclusively from observable state
 *    (audit actions, anomaly records, task hashes, messages). Zero random UUIDs.
 * 4. LIGHTWEIGHT & EFFICIENT: Unchanged requests return `{ changed: false }` (< 100 bytes).
 * 5. SAFETY BASELINE PRESERVED:
 *    - automation_mode = OFF
 *    - SOCIAL_AUTOMATION = OFF
 *    - publishing_authority = 0
 *    - JEV_MODE = shadow
 *    - mediaWorker = DISABLED
 *    - autonomous publishing = OFF
 *    - Jefry execution authority = NONE
 */

import type { MissionControlSnapshot, TaskCard } from './types.ts';
import { getOperatorActionsHistory } from './actions.ts';
import { getMissionControlSnapshot } from './index.ts';

// ============================================================================
// Types & Contracts
// ============================================================================

export type OperationalEventScope =
  | 'STAFF'
  | 'TASK'
  | 'ANOMALY'
  | 'ACTION'
  | 'CHAT'
  | 'PIPELINE';

export interface OperationalEventEnvelope {
  event_id: string;
  event_type: string;
  occurred_at: string;
  scope: OperationalEventScope;
  target_id?: string | null;
  actor?: string | null;
  summary: string;
  revision: string;
}

export interface OperationalEventsResponse {
  changed: boolean;
  current_revision: string;
  server_timestamp: string;
  event_count: number;
  events: OperationalEventEnvelope[];
  telemetry_status: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED';
}

// ============================================================================
// Deterministic Hash Helper
// ============================================================================

export function computeStateHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ============================================================================
// Revision Derivation Engine
// ============================================================================

/**
 * Derives a deterministic revision string from canonical system telemetry.
 * Identical system states yield 100% identical revision strings.
 */
export function deriveCanonicalRevision(
  snapshot: MissionControlSnapshot | null,
  actionsHistory: any[] = []
): string {
  if (!snapshot) return 'rev_empty_00000000';

  const parts: string[] = [];

  // 1. Latest Operator Action Signature
  if (actionsHistory.length > 0) {
    const latestAction = actionsHistory[0];
    parts.push(`act:${latestAction.action_id}:${latestAction.completed_at || latestAction.requested_at}`);
  } else {
    parts.push('act:none');
  }

  // 2. Anomalies Signature
  const anomalies = snapshot.anomalies?.active_anomalies || [];
  parts.push(`anom_count:${anomalies.length}`);
  if (anomalies.length > 0) {
    const sortedAnoms = [...anomalies].sort((a: any, b: any) =>
      (b.updated_at || b.detected_at || '').localeCompare(a.updated_at || a.detected_at || '')
    );
    const latestAnom = sortedAnoms[0];
    parts.push(`latest_anom:${latestAnom.anomaly_id}:${latestAnom.state}:${latestAnom.severity || 'UNKNOWN'}:${latestAnom.occurrence_count || 1}:${latestAnom.updated_at || latestAnom.detected_at}`);
  }

  // 3. Pipeline Tasks Signature
  const tasks = snapshot.pipeline?.tasks || [];
  parts.push(`task_count:${tasks.length}`);
  if (tasks.length > 0) {
    const taskSignatures = tasks.map((t: TaskCard) => `${t.taskId}:${t.stage}:${t.status}:${t.retryCount}:${t.blockerOrError ? '1' : '0'}`);
    parts.push(`tasks:${computeStateHash(taskSignatures.sort().join('|'))}`);
  }

  // 4. Live Operations Staff Operational States Signature
  const liveStaff = snapshot.live_operations?.staff_operations || {};
  const staffKeys = Object.keys(liveStaff).sort();
  const staffSignatures = staffKeys.map((k) => {
    const s = liveStaff[k];
    return `${k}:${s.operational_state}:${s.live_status}:${s.location?.room_key}:${s.location?.position_key}:${s.current_task?.task_id || 'none'}`;
  });
  parts.push(`staff:${computeStateHash(staffSignatures.join('|'))}`);

  // 5. System Health & Environment
  parts.push(`hlth:${snapshot.health?.overallStatus || 'HEALTHY'}`);
  parts.push(`env:${snapshot.environment || 'production'}`);

  return 'rev_' + computeStateHash(parts.join(';'));
}

// ============================================================================
// Recent Events Aggregator
// ============================================================================

/**
 * Returns change status and lightweight event envelopes since a client revision cursor.
 * If client revision matches current server revision, returns changed = false immediately.
 */
export async function getRecentOperationalEvents(
  db: any,
  sinceRevision?: string | null,
  limit = 20,
  injectedSnapshot?: MissionControlSnapshot | null
): Promise<OperationalEventsResponse> {
  const now = new Date().toISOString();

  // 1. Fetch or use snapshot
  const snapshot = injectedSnapshot || (await getMissionControlSnapshot(db, {}));
  const actions = await getOperatorActionsHistory(db, 20);

  // 2. Compute current canonical revision
  const currentRevision = deriveCanonicalRevision(snapshot, actions);

  // 3. Check cursor match (Unchanged fast-path)
  if (sinceRevision && sinceRevision.trim() === currentRevision) {
    return {
      changed: false,
      current_revision: currentRevision,
      server_timestamp: now,
      event_count: 0,
      events: [],
      telemetry_status: 'HEALTHY'
    };
  }

  // 4. State has changed or client has no cursor — Compile lightweight envelopes
  const envelopes: OperationalEventEnvelope[] = [];

  // A. From Operator Actions
  for (const act of actions) {
    envelopes.push({
      event_id: `ev_${act.action_id}`,
      event_type: `OPERATOR_ACTION_${act.action_type}`,
      occurred_at: act.completed_at || act.requested_at,
      scope: 'ACTION',
      target_id: act.target_id,
      actor: act.requested_by,
      summary: act.result_summary || `Operator action ${act.action_type} executed`,
      revision: currentRevision
    });
  }

  // B. From Active Anomalies
  const activeAnoms = snapshot.anomalies?.active_anomalies || [];
  for (const anom of activeAnoms) {
    envelopes.push({
      event_id: `ev_anom_${anom.anomaly_id}_${anom.state}`,
      event_type: `ANOMALY_${anom.state}`,
      occurred_at: anom.updated_at || anom.detected_at,
      scope: 'ANOMALY',
      target_id: anom.anomaly_id,
      actor: anom.responsible_agent_id || 'system',
      summary: anom.title,
      revision: currentRevision
    });
  }

  // C. From Active Pipeline Tasks
  const tasks = snapshot.pipeline?.tasks || [];
  for (const t of tasks) {
    envelopes.push({
      event_id: `ev_task_${t.taskId}_${t.stage}`,
      event_type: `TASK_${t.stage.toUpperCase()}`,
      occurred_at: t.lastUpdate || now,
      scope: 'TASK',
      target_id: t.taskId,
      actor: t.subsystem,
      summary: t.title,
      revision: currentRevision
    });
  }

  // Sort descending by timestamp and limit
  envelopes.sort((a, b) => (b.occurred_at || '').localeCompare(a.occurred_at || ''));
  const sliced = envelopes.slice(0, Math.max(1, limit));

  return {
    changed: true,
    current_revision: currentRevision,
    server_timestamp: now,
    event_count: sliced.length,
    events: sliced,
    telemetry_status: 'HEALTHY'
  };
}
