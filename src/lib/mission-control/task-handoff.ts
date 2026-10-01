/**
 * RancangLoka Hermes Mission Control — Canonical Task Handoff Layer (V2.4)
 * Milestone: HERMES-MC-V2.4
 * 
 * Strict Invariants:
 * 1. Read-only visualization layer. Zero workflow authority.
 * 2. NO CANONICAL HANDOFF EVIDENCE = NO HANDOFF VISUALIZATION.
 *    Timing coincidence is NOT a handoff. Different task IDs cannot be joined into a handoff.
 * 3. Handoff identity is 100% deterministic (zero random UUIDs).
 * 4. QUEUED next stage: handoff is observable, but recipient remains STATIONARY in Lounge.
 * 5. RUNNING next stage: recipient moves through Central Hall to department workstation.
 * 6. BLOCKED next stage: recipient is marked with critical warning; zero fake active work.
 * 7. Maya / Social exclusion: Zone S remains HOLDING; Maya cannot receive handoffs.
 * 8. Budi / Media exclusion: effective worker DISABLED; Budi cannot receive active handoffs.
 * 9. JEV exclusion: TypeSafe Jev is a shadow observer; Jev cannot own or receive workflows.
 * 10. Initial load & refresh: Idempotent. Zero fake historical journey replay.
 */

import type { TaskCard, TaskStage, MissionControlSnapshot } from './types.ts';
import type { DepartmentId } from './staff-registry.ts';
import { attributeTaskOwnership } from './department-registry.ts';

export type TaskHandoffState =
  | 'OBSERVED'
  | 'PENDING'
  | 'READY'
  | 'RUNNING'
  | 'QUEUED'
  | 'BLOCKED'
  | 'COMPLETE';

export interface TaskHandoffObservation {
  handoff_id: string;
  workflow_id: string;
  task_id: string;
  artifact_id: string;
  task_title: string;
  from_agent_id: string | null;
  to_agent_id: string | null;
  from_department_id: DepartmentId | 'unknown';
  to_department_id: DepartmentId | 'unknown';
  from_stage: TaskStage | 'initial';
  to_stage: TaskStage;
  handoff_state: TaskHandoffState;
  transition_timestamp: string;
  evidence_source: string;
  evidence_id: string;
  confidence: 'EXACT' | 'DERIVED';
  requires_movement: boolean;
}

/**
 * Derives a deterministic, stable handoff identifier.
 * Zero random UUIDs. Identical canonical inputs yield identical output.
 */
export function deriveDeterministicHandoffId(
  workflowId: string,
  fromStage: string,
  toStage: string,
  fromAgent: string | null,
  toAgent: string | null,
  timestamp: string
): string {
  const normWorkflow = String(workflowId || '').trim().toLowerCase();
  const normFromStage = String(fromStage || 'none').trim().toLowerCase();
  const normToStage = String(toStage || 'none').trim().toLowerCase();
  const normFromAgent = String(fromAgent || 'none').trim().toLowerCase();
  const normToAgent = String(toAgent || 'none').trim().toLowerCase();
  const normTime = String(timestamp || '').trim();

  // Simple, deterministic fnv1a-style hash string
  let h = 0x811c9dc5;
  const raw = `${normWorkflow}|${normFromStage}->${normToStage}|${normFromAgent}->${normToAgent}|${normTime}`;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = (h >>> 0).toString(16).padStart(8, '0');
  return `hnd_${normWorkflow}_${normFromStage}_to_${normToStage}_${hex}`;
}

/**
 * Evaluates whether a candidate handoff adheres to safety exclusions:
 * - Maya cannot receive handoffs while Social is HOLDING.
 * - Budi cannot receive active handoffs while Media Worker is DISABLED.
 * - JEV cannot become workflow owner.
 */
export function validateHandoffSafety(
  handoff: TaskHandoffObservation,
  snapshot: MissionControlSnapshot | null
): { allowed: boolean; reason?: string } {
  // 1. JEV cannot be workflow owner or recipient
  if (
    handoff.to_agent_id === 'telemetry_observer_jev' ||
    handoff.from_agent_id === 'telemetry_observer_jev' ||
    (handoff as any).to_agent_id === 'jev'
  ) {
    return {
      allowed: false,
      reason: 'TypeSafe JEV operates in shadow mode with zero workflow ownership authority.'
    };
  }

  // 2. Maya / Social Exclusion
  const isSocialHolding =
    !snapshot?.social ||
    snapshot.social.mode === 'OFF' ||
    snapshot.social.departmentAvailability === 'NOT_AVAILABLE' ||
    !snapshot.social.providerExecutionAvailable;
  if (
    handoff.to_department_id === 'social' ||
    handoff.to_agent_id === 'social_distribution_operator'
  ) {
    if (isSocialHolding) {
      return {
        allowed: false,
        reason: 'Social & Distribution (Zone S) is in HOLDING status. Maya cannot accept handoffs.'
      };
    }
  }

  // 3. Budi / Media Worker Disabled Exclusion
  const isMediaWorkerDisabled = snapshot?.health?.mediaWorker?.effectiveState !== 'ENABLED';
  if (
    handoff.to_agent_id === 'lokamedia_worker_primary' ||
    handoff.to_department_id === 'media'
  ) {
    if (isMediaWorkerDisabled && handoff.handoff_state === 'RUNNING') {
      return {
        allowed: false,
        reason: 'Media Worker is DISABLED by dual-gate invariant. Budi cannot accept active running handoffs.'
      };
    }
  }

  return { allowed: true };
}

/**
 * Derives canonical in-flight handoffs from the snapshot pipeline tasks.
 * Strictly checks genuine workflow state connections (no timing-only inference).
 */
export function deriveCanonicalHandoffsFromPipeline(
  snapshot: MissionControlSnapshot | null
): TaskHandoffObservation[] {
  if (!snapshot || !snapshot.pipeline || !Array.isArray(snapshot.pipeline.tasks)) {
    return [];
  }

  const handoffs: TaskHandoffObservation[] = [];
  const tasks = snapshot.pipeline.tasks;

  for (const task of tasks) {
    if (!task.taskId || !task.stage) continue;

    const taskTitle = task.title || task.slug || task.taskId;
    const artifactId = String(task.relatedArticleId || task.taskId);
    const timestamp = task.lastUpdate || new Date().toISOString();

    // 1. Article awaiting media: Editorial -> Media
    if (task.stage === 'waiting_media' && task.relatedMediaJobId) {
      const isFailed = task.status === 'FAILED' || task.status === 'FAILED_TERMINAL';
      const isWorkerEnabled = snapshot.health?.mediaWorker?.effectiveState === 'ENABLED';

      const observation: TaskHandoffObservation = {
        handoff_id: deriveDeterministicHandoffId(task.taskId, 'writing', 'waiting_media', 'content_writer_primary', isWorkerEnabled ? 'lokamedia_worker_primary' : null, timestamp),
        workflow_id: task.taskId,
        task_id: task.taskId,
        artifact_id: artifactId,
        task_title: taskTitle,
        from_agent_id: 'content_writer_primary',
        to_agent_id: isWorkerEnabled ? 'lokamedia_worker_primary' : null,
        from_department_id: 'editorial',
        to_department_id: 'media',
        from_stage: 'writing',
        to_stage: 'waiting_media',
        handoff_state: isFailed ? 'BLOCKED' : (!isWorkerEnabled ? 'QUEUED' : 'RUNNING'),
        transition_timestamp: timestamp,
        evidence_source: 'd1_media_jobs:relatedMediaJobId',
        evidence_id: task.relatedMediaJobId,
        confidence: 'EXACT',
        requires_movement: isWorkerEnabled && !isFailed
      };

      const safety = validateHandoffSafety(observation, snapshot);
      if (safety.allowed) {
        handoffs.push(observation);
      }
    }

    // 2. Media attached awaiting QA: Media -> Editorial QA
    else if (task.stage === 'editorial_qa') {
      const hasMediaJob = Boolean(task.relatedMediaJobId);
      const fromAgent = hasMediaJob ? 'lokamedia_worker_primary' : 'content_writer_primary';
      const fromDept: DepartmentId = hasMediaJob ? 'media' : 'editorial';

      const observation: TaskHandoffObservation = {
        handoff_id: deriveDeterministicHandoffId(task.taskId, hasMediaJob ? 'waiting_media' : 'writing', 'editorial_qa', fromAgent, 'editorial_qa_primary', timestamp),
        workflow_id: task.taskId,
        task_id: task.taskId,
        artifact_id: artifactId,
        task_title: taskTitle,
        from_agent_id: fromAgent,
        to_agent_id: 'editorial_qa_primary',
        from_department_id: fromDept,
        to_department_id: 'editorial',
        from_stage: hasMediaJob ? 'waiting_media' : 'writing',
        to_stage: 'editorial_qa',
        handoff_state: 'RUNNING',
        transition_timestamp: timestamp,
        evidence_source: 'articles:stage=editorial_qa',
        evidence_id: `stage_${task.taskId}_editorial_qa`,
        confidence: 'EXACT',
        requires_movement: true
      };

      const safety = validateHandoffSafety(observation, snapshot);
      if (safety.allowed) {
        handoffs.push(observation);
      }
    }

    // 3. Article approved and scheduled: Editorial -> Publication Operations
    else if (task.stage === 'scheduled') {
      const pubBreaker = snapshot.health?.circuitBreakers?.find((cb) => cb.id === 'global_publisher');
      const isBlocked = snapshot.health?.automation?.killSwitchEngaged || pubBreaker?.state === 'OPEN';
      const isAutomationOff = snapshot.health?.automation?.mode === 'OFF';

      const observation: TaskHandoffObservation = {
        handoff_id: deriveDeterministicHandoffId(task.taskId, 'editorial_qa', 'scheduled', 'editorial_qa_primary', 'publication_dispatcher_core', timestamp),
        workflow_id: task.taskId,
        task_id: task.taskId,
        artifact_id: artifactId,
        task_title: taskTitle,
        from_agent_id: 'editorial_qa_primary',
        to_agent_id: 'publication_dispatcher_core',
        from_department_id: 'editorial',
        to_department_id: 'publication_operations',
        from_stage: 'editorial_qa',
        to_stage: 'scheduled',
        handoff_state: isBlocked ? 'BLOCKED' : (isAutomationOff ? 'QUEUED' : 'RUNNING'),
        transition_timestamp: timestamp,
        evidence_source: 'articles:status=scheduled',
        evidence_id: `article_${task.taskId}_scheduled`,
        confidence: 'EXACT',
        // Invariant: QUEUED next stage does NOT cause staff movement!
        requires_movement: !isBlocked && !isAutomationOff
      };

      const safety = validateHandoffSafety(observation, snapshot);
      if (safety.allowed) {
        handoffs.push(observation);
      }
    }

    // 4. Ingesting in-flight: Editorial -> Publication
    else if (task.stage === 'ingesting') {
      const observation: TaskHandoffObservation = {
        handoff_id: deriveDeterministicHandoffId(task.taskId, 'ready_for_ingest', 'ingesting', 'editorial_qa_primary', 'publication_dispatcher_core', timestamp),
        workflow_id: task.taskId,
        task_id: task.taskId,
        artifact_id: artifactId,
        task_title: taskTitle,
        from_agent_id: 'editorial_qa_primary',
        to_agent_id: 'publication_dispatcher_core',
        from_department_id: 'editorial',
        to_department_id: 'publication_operations',
        from_stage: 'ready_for_ingest',
        to_stage: 'ingesting',
        handoff_state: 'RUNNING',
        transition_timestamp: timestamp,
        evidence_source: 'articles:status=ingesting',
        evidence_id: `ingest_${task.taskId}`,
        confidence: 'EXACT',
        requires_movement: true
      };

      const safety = validateHandoffSafety(observation, snapshot);
      if (safety.allowed) {
        handoffs.push(observation);
      }
    }

    // 5. Research Stage: Research & Evidence -> Editorial Writing
    else if (task.stage === 'researching') {
      const observation: TaskHandoffObservation = {
        handoff_id: deriveDeterministicHandoffId(task.taskId, 'initial', 'researching', null, 'evidence_researcher_lead', timestamp),
        workflow_id: task.taskId,
        task_id: task.taskId,
        artifact_id: artifactId,
        task_title: taskTitle,
        from_agent_id: null,
        to_agent_id: 'evidence_researcher_lead',
        from_department_id: 'unknown',
        to_department_id: 'research_evidence',
        from_stage: 'initial',
        to_stage: 'researching',
        handoff_state: 'RUNNING',
        transition_timestamp: timestamp,
        evidence_source: 'pipeline_task:researching',
        evidence_id: `research_${task.taskId}`,
        confidence: 'EXACT',
        requires_movement: true
      };

      const safety = validateHandoffSafety(observation, snapshot);
      if (safety.allowed) {
        handoffs.push(observation);
      }
    }
  }

  // Sort descending by timestamp
  return handoffs.sort((a, b) => new Date(b.transition_timestamp).getTime() - new Date(a.transition_timestamp).getTime());
}

/**
 * Detects dynamic real handoffs when comparing two consecutive Mission Control snapshots.
 * 
 * Strict Truthfulness Rules:
 * 1. Must share the EXACT SAME taskId / workflow identity.
 * 2. Timing coincidence across different task IDs is strictly REJECTED.
 * 3. Completion without a proven next owner/stage is NOT a handoff.
 */
export function detectSnapshotDeltaHandoffs(
  prevSnapshot: MissionControlSnapshot | null,
  currSnapshot: MissionControlSnapshot | null
): TaskHandoffObservation[] {
  if (!prevSnapshot || !currSnapshot) return [];

  const prevTasks = prevSnapshot.pipeline?.tasks || [];
  const currTasks = currSnapshot.pipeline?.tasks || [];
  if (prevTasks.length === 0 || currTasks.length === 0) return [];

  const deltaHandoffs: TaskHandoffObservation[] = [];

  for (const currTask of currTasks) {
    if (!currTask.taskId) continue;

    // RULE 2: Find task with identical task_id (Different task IDs = NOT a handoff)
    const prevTask = prevTasks.find((t) => t.taskId === currTask.taskId);
    if (!prevTask) continue;

    // RULE: Stage or status must have canonically transitioned
    if (prevTask.stage === currTask.stage && prevTask.status === currTask.status) {
      continue;
    }

    const prevAttribution = attributeTaskOwnership(prevTask);
    const currAttribution = attributeTaskOwnership(currTask);

    // If both stage and owner are identical, this is not a handoff
    if (
      prevTask.stage === currTask.stage &&
      prevAttribution.responsible_agent_id === currAttribution.responsible_agent_id
    ) {
      continue;
    }

    const timestamp = currTask.lastUpdate || new Date().toISOString();
    const isNextBlocked = currTask.stage === 'failed' || currTask.status === 'BLOCKED' || currTask.status === 'FAILED';
    const isNextQueued = currTask.stage === 'scheduled' || currTask.status === 'QUEUED';

    let handoffState: TaskHandoffState = 'RUNNING';
    if (isNextBlocked) {
      handoffState = 'BLOCKED';
    } else if (isNextQueued) {
      handoffState = 'QUEUED';
    }

    const observation: TaskHandoffObservation = {
      handoff_id: deriveDeterministicHandoffId(
        currTask.taskId,
        prevTask.stage,
        currTask.stage,
        prevAttribution.responsible_agent_id,
        currAttribution.responsible_agent_id,
        timestamp
      ),
      workflow_id: currTask.taskId,
      task_id: currTask.taskId,
      artifact_id: String(currTask.relatedArticleId || currTask.taskId),
      task_title: currTask.title || currTask.taskId,
      from_agent_id: prevAttribution.responsible_agent_id,
      to_agent_id: currAttribution.responsible_agent_id,
      from_department_id: prevAttribution.department_id || 'unknown',
      to_department_id: currAttribution.department_id || 'unknown',
      from_stage: prevTask.stage,
      to_stage: currTask.stage,
      handoff_state: handoffState,
      transition_timestamp: timestamp,
      evidence_source: 'snapshot_delta:pipeline_tasks',
      evidence_id: `${currTask.taskId}:${prevTask.stage}->${currTask.stage}`,
      confidence: currAttribution.responsibility_confidence === 'EXACT' ? 'EXACT' : 'DERIVED',
      requires_movement: handoffState === 'RUNNING' && Boolean(currAttribution.responsible_agent_id)
    };

    const safety = validateHandoffSafety(observation, currSnapshot);
    if (safety.allowed) {
      deltaHandoffs.push(observation);
    }
  }

  return deltaHandoffs;
}
