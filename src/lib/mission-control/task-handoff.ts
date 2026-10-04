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
  quality_metadata?: {
    quality_issue?: string;
    primary_quality_issue?: string;
    quality_issues?: string[];
    quality_score?: number;
    quality_decision?: string;
    article_intent?: string;
    primary_owner?: string;
    supporting_owner?: string;
    supporting_owners?: string[];
    revision_reason?: string;
    article_id?: number | string;
    task_id?: string;
    attempt?: number;
  } | null;
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
  // 1. JEV / Jefry / Management cannot be workflow owner or handoff sender/recipient
  if (
    handoff.to_agent_id === 'telemetry_observer_jev' ||
    handoff.from_agent_id === 'telemetry_observer_jev' ||
    handoff.to_agent_id === 'management_advisor_jefry' ||
    handoff.from_agent_id === 'management_advisor_jefry' ||
    handoff.to_department_id === 'management' ||
    handoff.from_department_id === 'management' ||
    (handoff as any).to_agent_id === 'jev'
  ) {
    return {
      allowed: false,
      reason: 'TypeSafe JEV operates in shadow mode with zero workflow ownership authority (Jefry / Management operates as a supervisory advisory layer with zero operational handoff authority).'
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
 * Strictly requires verifiable canonical evidence (e.g. linked D1 media jobs or approval rows).
 * No guessing or synthetic stage chain reconstruction from current stage alone!
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

    // Fail closed: Task must have an authoritative canonical timestamp.
    // Zero fallback to Date.now() or new Date().toISOString()!
    if (!task.lastUpdate || typeof task.lastUpdate !== 'string' || !task.lastUpdate.trim()) {
      continue;
    }

    const taskTitle = task.title || task.slug || task.taskId;
    const artifactId = String(task.relatedArticleId || task.taskId);
    const timestamp = task.lastUpdate;

    // 1. Article awaiting media: Editorial -> Media
    // Verifiable canonical evidence: D1 media job foreign key in media_jobs table
    if (task.stage === 'waiting_media' && task.relatedMediaJobId) {
      const isFailed = task.status === 'FAILED' || task.status === 'FAILED_TERMINAL';
      const isWorkerEnabled = snapshot.health?.mediaWorker?.effectiveState === 'ENABLED';

      const observation: TaskHandoffObservation = {
        handoff_id: deriveDeterministicHandoffId(
          task.taskId,
          'writing',
          'waiting_media',
          'content_writer_primary',
          isWorkerEnabled ? 'lokamedia_worker_primary' : null,
          timestamp
        ),
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
    // Verifiable canonical evidence: Completed media job attached to article
    else if (task.stage === 'editorial_qa' && task.relatedMediaJobId) {
      const observation: TaskHandoffObservation = {
        handoff_id: deriveDeterministicHandoffId(
          task.taskId,
          'waiting_media',
          'editorial_qa',
          'lokamedia_worker_primary',
          'editorial_qa_primary',
          timestamp
        ),
        workflow_id: task.taskId,
        task_id: task.taskId,
        artifact_id: artifactId,
        task_title: taskTitle,
        from_agent_id: 'lokamedia_worker_primary',
        to_agent_id: 'editorial_qa_primary',
        from_department_id: 'media',
        to_department_id: 'editorial',
        from_stage: 'waiting_media',
        to_stage: 'editorial_qa',
        handoff_state: 'RUNNING',
        transition_timestamp: timestamp,
        evidence_source: 'd1_media_jobs:attached',
        evidence_id: task.relatedMediaJobId,
        confidence: 'EXACT',
        requires_movement: true
      };

      const safety = validateHandoffSafety(observation, snapshot);
      if (safety.allowed) {
        handoffs.push(observation);
      }
    }

    // 3. Article approved and scheduled: Editorial QA -> Publication Operations
    // Verifiable canonical evidence: Explicit row in article_editorial_approvals in D1
    else if (task.stage === 'scheduled' && task.approvalEvidence) {
      const pubBreaker = snapshot.health?.circuitBreakers?.find((cb) => cb.id === 'global_publisher');
      const isBlocked = snapshot.health?.automation?.killSwitchEngaged || pubBreaker?.state === 'OPEN';
      const isAutomationOff = snapshot.health?.automation?.mode === 'OFF';
      const approvalTime = task.approvalEvidence.approvedAt || timestamp;

      const observation: TaskHandoffObservation = {
        handoff_id: deriveDeterministicHandoffId(
          task.taskId,
          'editorial_qa',
          'scheduled',
          task.approvalEvidence.approvedBy || 'editorial_qa_primary',
          'publication_dispatcher_core',
          approvalTime
        ),
        workflow_id: task.taskId,
        task_id: task.taskId,
        artifact_id: artifactId,
        task_title: taskTitle,
        from_agent_id: task.approvalEvidence.approvedBy || 'editorial_qa_primary',
        to_agent_id: 'publication_dispatcher_core',
        from_department_id: 'editorial',
        to_department_id: 'publication_operations',
        from_stage: 'editorial_qa',
        to_stage: 'scheduled',
        handoff_state: isBlocked ? 'BLOCKED' : (isAutomationOff ? 'QUEUED' : 'RUNNING'),
        transition_timestamp: approvalTime,
        evidence_source: 'd1_article_editorial_approvals',
        evidence_id: `approval_${task.relatedArticleId || task.taskId}`,
        confidence: 'EXACT',
        // Invariant: QUEUED next stage does NOT cause staff movement!
        requires_movement: !isBlocked && !isAutomationOff
      };

      const safety = validateHandoffSafety(observation, snapshot);
      if (safety.allowed) {
        handoffs.push(observation);
      }
    }

    // 4. Quality Gate Revision Handoff: Editorial QA -> Primary Revision Owner (Joko or Irwan)
    else if (task.qualityReview && (task.stage === 'writing' || task.stage === 'researching' || task.stage === 'editorial_qa')) {
      const targetAgent = task.qualityReview.primary_owner || (task.stage === 'researching' ? 'evidence_researcher_lead' : 'content_writer_primary');
      const targetDept: DepartmentId = targetAgent === 'evidence_researcher_lead' ? 'research' : 'editorial';
      const observation: TaskHandoffObservation = {
        handoff_id: deriveDeterministicHandoffId(
          task.taskId,
          'editorial_qa',
          task.stage,
          'editorial_qa_primary',
          targetAgent,
          task.lastUpdate || timestamp
        ),
        workflow_id: task.taskId,
        task_id: task.taskId,
        artifact_id: artifactId,
        task_title: taskTitle,
        from_agent_id: 'editorial_qa_primary',
        to_agent_id: targetAgent,
        from_department_id: 'editorial',
        to_department_id: targetDept,
        from_stage: 'editorial_qa',
        to_stage: task.stage,
        handoff_state: 'RUNNING',
        transition_timestamp: task.lastUpdate || timestamp,
        evidence_source: 'human_quality_brief',
        evidence_id: `brief_${task.relatedArticleId || task.taskId}`,
        confidence: 'EXACT',
        requires_movement: true,
        quality_metadata: {
          quality_issue: task.qualityReview.primary_quality_issue || task.qualityReview.quality_issue,
          primary_quality_issue: task.qualityReview.primary_quality_issue || task.qualityReview.quality_issue,
          quality_issues: task.qualityReview.quality_issues || (task.qualityReview.quality_issue ? [task.qualityReview.quality_issue] : []),
          quality_score: task.qualityReview.quality_score,
          quality_decision: task.qualityReview.quality_decision,
          article_intent: task.qualityReview.article_intent,
          primary_owner: task.qualityReview.primary_owner,
          supporting_owner: task.qualityReview.supporting_owner,
          supporting_owners: task.qualityReview.supporting_owners || (task.qualityReview.supporting_owner ? [task.qualityReview.supporting_owner] : []),
          revision_reason: task.qualityReview.revision_reason,
          article_id: task.relatedArticleId || undefined,
          task_id: task.taskId,
          attempt: task.qualityReview.attempt
        }
      };

      const safety = validateHandoffSafety(observation, snapshot);
      if (safety.allowed) {
        handoffs.push(observation);
      }
    }

    // Strict invariant: Tasks without verifiable canonical transition evidence
    // (e.g. stage alone without approval or media job) CANNOT fabricate history. Fail closed!
  }

  // Sort descending by timestamp
  return handoffs.sort((a, b) => new Date(b.transition_timestamp).getTime() - new Date(a.transition_timestamp).getTime());
}

/**
 * Detects dynamic real handoffs when comparing two consecutive Mission Control snapshots.
 * 
 * Strict Truthfulness Rules:
 * 1. Must share the EXACT SAME taskId / workflow identity.
 * 2. Monotonicity & Stale Snapshot Rejection: currTask.lastUpdate must be strictly newer than prevTask.lastUpdate.
 * 3. Timing coincidence across different task IDs is strictly REJECTED.
 * 4. Completion without a proven next owner/stage is NOT a handoff.
 * 5. Out-of-order snapshots (currTime <= prevTime) fail closed; zero reverse handoffs.
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

    // RULE 1: Find task with identical task_id (Different task IDs = NOT a handoff)
    const prevTask = prevTasks.find((t) => t.taskId === currTask.taskId);
    if (!prevTask) continue;

    // RULE 2: Stage or status must have canonically transitioned
    if (prevTask.stage === currTask.stage && prevTask.status === currTask.status) {
      continue;
    }

    // RULE 3: Strict Monotonicity & Out-of-Order / Stale Snapshot Rejection
    // The current task timestamp must be strictly newer than the previous task timestamp.
    // If currTime <= prevTime, the snapshot is stale, cached, out-of-order, or identical.
    // Fail closed immediately to prevent reverse or fake handoffs!
    const prevTime = prevTask.lastUpdate ? new Date(prevTask.lastUpdate).getTime() : NaN;
    const currTime = currTask.lastUpdate ? new Date(currTask.lastUpdate).getTime() : NaN;

    if (isNaN(currTime) || isNaN(prevTime) || currTime <= prevTime) {
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

    const timestamp = currTask.lastUpdate;
    const isNextBlocked = currTask.stage === 'failed' || currTask.status === 'BLOCKED' || currTask.status === 'FAILED';
    const isNextQueued = currTask.stage === 'scheduled' || currTask.status === 'QUEUED';

    let handoffState: TaskHandoffState = 'RUNNING';
    if (isNextBlocked) {
      handoffState = 'BLOCKED';
    } else if (isNextQueued) {
      handoffState = 'QUEUED';
    }

    // Check for genuine workflow rollback (e.g. editorial_qa -> writing)
    const isRollback =
      (prevTask.stage === 'editorial_qa' && currTask.stage === 'writing') ||
      (prevTask.stage === 'scheduled' && (currTask.stage === 'editorial_qa' || currTask.stage === 'writing'));

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
      evidence_source: isRollback ? 'snapshot_delta:workflow_rollback' : 'snapshot_delta:pipeline_tasks',
      evidence_id: `${currTask.taskId}:${prevTask.stage}->${currTask.stage}@${timestamp}`,
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
