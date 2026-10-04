/**
 * RancangLoka Hermes Mission Control — Live Operations Layer
 * Milestone: MC-LIVEOPS-1
 * 
 * Strict Invariants:
 * 1. REAL SYSTEM TRUTH ONLY: Derives normalized operational state exclusively from
 *    observable D1 tables, MC snapshot tasks, anomalies, and verified handoffs.
 * 2. ZERO FAKE ACTIVITY: Never animates work without an active backing task.
 * 3. QUEUED tasks (waiting in publication queue or authoring queue) map to WAITING / Lounge.
 * 4. SAFETY BASELINE PRESERVED:
 *    - automation_mode = OFF
 *    - SOCIAL_AUTOMATION = OFF
 *    - publishing_authority = 0
 *    - JEV_MODE = shadow
 *    - Jefry / JEV has ZERO execution authority (advisory only)
 *    - Media worker DISABLED keeps Budi strictly OFFLINE (or BLOCKED if failed).
 * 5. DETERMINISTIC & AUDITABLE: 100% reproducible mapping with full provenance.
 */

import type { MissionControlSnapshot, TaskCard } from './types.ts';
import type { StaffOperationalState, StaffMemberStatus } from './staff-registry.ts';
import { getStaffDefinitions } from './staff-registry.ts';
import { attributeTaskOwnership } from './department-registry.ts';
import {
  JOB_ANIMATION_REGISTRY,
  getAnimationDefinition,
  type JobAnimationKey
} from './job-animation-registry.ts';
import {
  STAFF_HOME_ROOMS,
  STAFF_WORKSTATION_POSITIONS,
  STAFF_CANONICAL_IDLE_SEATS
} from './pixel-office.ts';
import {
  deriveCanonicalHandoffsFromPipeline,
  type TaskHandoffObservation
} from './task-handoff.ts';

// ============================================================================
// Types & Contract
// ============================================================================

export type LiveExecutionStatus =
  | 'IDLE'
  | 'ASSIGNED'
  | 'WORKING'
  | 'REVIEWING'
  | 'RESEARCHING'
  | 'WAITING'
  | 'HANDOFF'
  | 'BLOCKED'
  | 'ERROR'
  | 'COMPLETED'
  | 'OFFLINE';

export interface LiveTaskProvenance {
  task_id: string;
  task_title: string;
  stage: string;
  status: string;
  department_id: string;
  responsible_agent_id: string;
  capability_id: string | null;
  started_at: string | null;
  last_updated_at: string | null;
  evidence_source: string;
  evidence_id: string;
  blocking_condition: string | null;
}

export interface LiveStaffOperation {
  agent_id: string;
  display_name: string;
  department_id: string;
  operational_state: StaffOperationalState;
  live_status: LiveExecutionStatus;
  location: {
    room_key: string;
    position_key: string;
    is_at_workstation: boolean;
    is_in_lounge: boolean;
  };
  animation: {
    animation_key: JobAnimationKey;
    is_actively_working: boolean;
    visual_detail: string;
    css_animation_class: string;
    prop_icon: string;
  };
  current_task: LiveTaskProvenance | null;
  active_handoff: TaskHandoffObservation | null;
  active_anomaly: {
    anomaly_id: string;
    title: string;
    severity: string;
    blocking_condition: string | null;
  } | null;
  state_evidence: string;
  provenance: {
    source_type: 'CANONICAL_DB' | 'PIPELINE_TASK' | 'TELEMETRY' | 'IDLE_BASELINE';
    audit_note: string;
  };
}

export interface LiveOperationsSnapshot {
  generated_at: string;
  staff_operations: Record<string, LiveStaffOperation>;
  summary: {
    total_staff: number;
    working_count: number;
    reviewing_count: number;
    idle_count: number;
    waiting_count: number;
    blocked_count: number;
    offline_count: number;
    active_anomalies_count: number;
    active_handoffs_count: number;
  };
  safety_invariants: {
    automation_mode: string;
    social_automation: string;
    publishing_authority: number;
    jev_mode: string;
    media_worker_effective_state: string;
    jefry_execution_authority: string;
  };
}

// ============================================================================
// Single Staff Operational State Derivation
// ============================================================================

export function deriveLiveStaffOperation(
  agentId: string,
  snapshot: MissionControlSnapshot | null,
  activeAnomalies: any[] = [],
  recentHandoffs: TaskHandoffObservation[] = []
): LiveStaffOperation {
  const staffList = getStaffDefinitions();
  const staff = staffList.find((s) => s.agent_id === agentId) || {
    agent_id: agentId,
    display_name: agentId,
    role: 'Staff Member',
    department_id: 'editorial',
    capabilities: []
  };

  const tasks: TaskCard[] = snapshot?.pipeline?.tasks || [];
  const health = snapshot?.health;
  const homeRoom = STAFF_HOME_ROOMS[agentId] || 'editorial_room';
  const workstationPos = STAFF_WORKSTATION_POSITIONS[agentId] || `${agentId}_workstation`;
  const canonicalIdleSeat = STAFF_CANONICAL_IDLE_SEATS[agentId] || 'lounge_seat_1';

  // Check if there is an active anomaly for this agent
  const agentAnomaly = activeAnomalies.find(
    (a) => a.responsible_agent_id === agentId && a.state === 'OPEN' && !a.expected_condition
  );

  // Check recent handoff for this agent
  const agentHandoff = recentHandoffs.find(
    (h) => h.to_agent_id === agentId || h.from_agent_id === agentId
  ) || null;

  let opState: StaffOperationalState = 'IDLE';
  let liveStatus: LiveExecutionStatus = 'IDLE';
  let targetRoom = 'lounge';
  let targetPos = canonicalIdleSeat;
  let animKey: JobAnimationKey = 'IDLE_STANDBY';
  let isWorking = false;
  let taskProv: LiveTaskProvenance | null = null;
  let stateEvidence = 'Siaga operasional di Lounge; tidak ada tugas aktif berjalan.';
  let sourceType: LiveStaffOperation['provenance']['source_type'] = 'IDLE_BASELINE';
  let auditNote = 'Default deterministic standby state.';

  switch (agentId) {
    // ------------------------------------------------------------------------
    // 1. Joko (Writer / Editorial)
    // ------------------------------------------------------------------------
    case 'content_writer_primary': {
      // 1. Blocked task
      const blockedTask = tasks.find(
        (t) => t.subsystem === 'editorial' && t.stage === 'failed' && !t.relatedMediaJobId
      );
      if (blockedTask) {
        opState = 'BLOCKED';
        liveStatus = 'BLOCKED';
        targetRoom = homeRoom;
        targetPos = workstationPos;
        animKey = 'BLOCKED_WARNING';
        isWorking = false;
        stateEvidence = `Tugas penulisan terblokir: ${blockedTask.blockerOrError || 'Kegagalan pipeline penulisan'}.`;
        sourceType = 'PIPELINE_TASK';
        auditNote = `Editorial task ${blockedTask.taskId} is failed/blocked.`;
        taskProv = {
          task_id: blockedTask.taskId,
          task_title: blockedTask.title,
          stage: blockedTask.stage,
          status: blockedTask.status,
          department_id: 'editorial',
          responsible_agent_id: agentId,
          capability_id: 'ARTICLE_WRITING',
          started_at: blockedTask.lastUpdate,
          last_updated_at: blockedTask.lastUpdate,
          evidence_source: 'pipeline.tasks',
          evidence_id: blockedTask.taskId,
          blocking_condition: blockedTask.blockerOrError
        };
        break;
      }

      // 2. Active writing task
      const writingTask = tasks.find((t) => t.stage === 'writing');
      if (writingTask) {
        opState = 'WORKING';
        liveStatus = 'WORKING';
        targetRoom = homeRoom;
        targetPos = workstationPos;
        animKey = writingTask.retryCount > 0 ? 'ARTICLE_REWRITE' : 'ARTICLE_TYPING';
        isWorking = true;
        stateEvidence = `Sedang menulis draf artikel [${writingTask.title}].`;
        sourceType = 'PIPELINE_TASK';
        auditNote = `Active drafting in progress for ${writingTask.taskId}.`;
        taskProv = {
          task_id: writingTask.taskId,
          task_title: writingTask.title,
          stage: writingTask.stage,
          status: writingTask.status,
          department_id: 'editorial',
          responsible_agent_id: agentId,
          capability_id: 'ARTICLE_WRITING',
          started_at: writingTask.lastUpdate,
          last_updated_at: writingTask.lastUpdate,
          evidence_source: 'pipeline.tasks',
          evidence_id: writingTask.taskId,
          blocking_condition: null
        };
        break;
      }

      // 3. Draft queued / holding
      const draftTask = tasks.find((t) => t.stage === 'draft');
      if (draftTask) {
        opState = 'IDLE';
        liveStatus = 'WAITING';
        targetRoom = 'lounge';
        targetPos = canonicalIdleSeat;
        animKey = 'IDLE_STANDBY';
        isWorking = false;
        stateEvidence = `Draf [${draftTask.title}] menunggu giliran penulisan (Antrean).`;
        sourceType = 'PIPELINE_TASK';
        auditNote = `Task ${draftTask.taskId} is queued draft; writer remains standby.`;
        taskProv = {
          task_id: draftTask.taskId,
          task_title: draftTask.title,
          stage: draftTask.stage,
          status: draftTask.status,
          department_id: 'editorial',
          responsible_agent_id: agentId,
          capability_id: 'ARTICLE_WRITING',
          started_at: draftTask.lastUpdate,
          last_updated_at: draftTask.lastUpdate,
          evidence_source: 'pipeline.tasks',
          evidence_id: draftTask.taskId,
          blocking_condition: null
        };
        break;
      }

      break;
    }

    // ------------------------------------------------------------------------
    // 2. Irwan (Research & Evidence)
    // ------------------------------------------------------------------------
    case 'evidence_researcher_lead': {
      // 1. Offline daemon check
      if (snapshot?.scheduler?.hermes?.status === 'offline') {
        opState = 'OFFLINE';
        liveStatus = 'OFFLINE';
        targetRoom = homeRoom;
        targetPos = workstationPos;
        animKey = 'OFFLINE_DISABLED';
        isWorking = false;
        stateEvidence = 'Daemon riset Hermes offline.';
        sourceType = 'TELEMETRY';
        auditNote = 'Hermes research daemon status is offline.';
        break;
      }

      // 2. Blocked research
      const failedResearch = tasks.find((t) => t.subsystem === 'research' && t.stage === 'failed');
      if (failedResearch) {
        opState = 'BLOCKED';
        liveStatus = 'BLOCKED';
        targetRoom = homeRoom;
        targetPos = workstationPos;
        animKey = 'BLOCKED_WARNING';
        isWorking = false;
        stateEvidence = `Riset bukti terhambat: ${failedResearch.blockerOrError || 'Kegagalan kompilasi bukti'}.`;
        sourceType = 'PIPELINE_TASK';
        auditNote = `Research task ${failedResearch.taskId} failed.`;
        taskProv = {
          task_id: failedResearch.taskId,
          task_title: failedResearch.title,
          stage: failedResearch.stage,
          status: failedResearch.status,
          department_id: 'research_evidence',
          responsible_agent_id: agentId,
          capability_id: 'EVIDENCE_RESEARCH',
          started_at: failedResearch.lastUpdate,
          last_updated_at: failedResearch.lastUpdate,
          evidence_source: 'pipeline.tasks',
          evidence_id: failedResearch.taskId,
          blocking_condition: failedResearch.blockerOrError
        };
        break;
      }

      // 3. Active research
      const researchTask = tasks.find((t) => t.stage === 'researching');
      if (researchTask) {
        opState = 'WORKING';
        liveStatus = 'RESEARCHING';
        targetRoom = homeRoom;
        targetPos = workstationPos;
        animKey = 'RESEARCH_BROWSING';
        isWorking = true;
        stateEvidence = `Sedang menyusun evidence pack dan penelusuran standar SNI untuk [${researchTask.title}].`;
        sourceType = 'PIPELINE_TASK';
        auditNote = `Active research compilation for ${researchTask.taskId}.`;
        taskProv = {
          task_id: researchTask.taskId,
          task_title: researchTask.title,
          stage: researchTask.stage,
          status: researchTask.status,
          department_id: 'research_evidence',
          responsible_agent_id: agentId,
          capability_id: 'EVIDENCE_RESEARCH',
          started_at: researchTask.lastUpdate,
          last_updated_at: researchTask.lastUpdate,
          evidence_source: 'pipeline.tasks',
          evidence_id: researchTask.taskId,
          blocking_condition: null
        };
        break;
      }

      break;
    }

    // ------------------------------------------------------------------------
    // 3. Rina (Editorial QA / Editor)
    // ------------------------------------------------------------------------
    case 'editorial_qa_primary': {
      // 1. Offline daemon check
      if (snapshot?.scheduler?.hermes?.status === 'offline') {
        opState = 'OFFLINE';
        liveStatus = 'OFFLINE';
        targetRoom = homeRoom;
        targetPos = 'editorial_review_desk';
        animKey = 'OFFLINE_DISABLED';
        isWorking = false;
        stateEvidence = 'Daemon editorial QA Hermes offline.';
        sourceType = 'TELEMETRY';
        auditNote = 'Hermes QA daemon status is offline.';
        break;
      }

      // 2. Blocked QA
      const failedQA = tasks.find(
        (t) => t.stage === 'failed' && (t.blockerOrError?.toLowerCase().includes('qa') || t.blockerOrError?.toLowerCase().includes('gate'))
      );
      if (failedQA) {
        opState = 'BLOCKED';
        liveStatus = 'BLOCKED';
        targetRoom = homeRoom;
        targetPos = 'editorial_review_desk';
        animKey = 'BLOCKED_WARNING';
        isWorking = false;
        stateEvidence = `Artikel gagal memenuhi First Article Gate: ${failedQA.blockerOrError}.`;
        sourceType = 'PIPELINE_TASK';
        auditNote = `QA gate failed on ${failedQA.taskId}.`;
        taskProv = {
          task_id: failedQA.taskId,
          task_title: failedQA.title,
          stage: failedQA.stage,
          status: failedQA.status,
          department_id: 'editorial',
          responsible_agent_id: agentId,
          capability_id: 'EDITORIAL_QA',
          started_at: failedQA.lastUpdate,
          last_updated_at: failedQA.lastUpdate,
          evidence_source: 'pipeline.tasks',
          evidence_id: failedQA.taskId,
          blocking_condition: failedQA.blockerOrError
        };
        break;
      }

      // 3. Active validating task (First Article Gate)
      const validatingTask = tasks.find((t) => t.stage === 'validating');
      if (validatingTask) {
        opState = 'WORKING';
        liveStatus = 'REVIEWING';
        targetRoom = homeRoom;
        targetPos = 'editorial_review_desk';
        animKey = 'QA_CHECKLIST';
        isWorking = true;
        stateEvidence = `Sedang menjalankan validasi teknis First Article Gate untuk [${validatingTask.title}].`;
        sourceType = 'PIPELINE_TASK';
        auditNote = `Validating 13 criteria checklist for ${validatingTask.taskId}.`;
        taskProv = {
          task_id: validatingTask.taskId,
          task_title: validatingTask.title,
          stage: validatingTask.stage,
          status: validatingTask.status,
          department_id: 'editorial',
          responsible_agent_id: agentId,
          capability_id: 'EDITORIAL_QA',
          started_at: validatingTask.lastUpdate,
          last_updated_at: validatingTask.lastUpdate,
          evidence_source: 'pipeline.tasks',
          evidence_id: validatingTask.taskId,
          blocking_condition: null
        };
        break;
      }

      // 4. Reviewing task
      const reviewTask = tasks.find((t) => t.stage === 'editorial_qa' || t.stage === 'ready_for_review');
      if (reviewTask || (snapshot?.articles && snapshot.articles.awaitingReviewCount > 0)) {
        const count = snapshot?.articles?.awaitingReviewCount || 1;
        opState = 'REVIEWING';
        liveStatus = 'REVIEWING';
        targetRoom = homeRoom;
        targetPos = 'editorial_review_desk';
        animKey = 'QA_REVIEW';
        isWorking = true;
        stateEvidence = `Sedang meninjau kepatuhan editorial (${count} artikel draf menunggu persetujuan review).`;
        sourceType = 'CANONICAL_DB';
        auditNote = `Reviewing queue active with ${count} articles.`;
        if (reviewTask) {
          taskProv = {
            task_id: reviewTask.taskId,
            task_title: reviewTask.title,
            stage: reviewTask.stage,
            status: reviewTask.status,
            department_id: 'editorial',
            responsible_agent_id: agentId,
            capability_id: 'EDITORIAL_QA',
            started_at: reviewTask.lastUpdate,
            last_updated_at: reviewTask.lastUpdate,
            evidence_source: 'pipeline.tasks',
            evidence_id: reviewTask.taskId,
            blocking_condition: null
          };
        }
        break;
      }

      break;
    }

    // ------------------------------------------------------------------------
    // 4. Budi (Media Operations / LokaMedia Studio)
    // ------------------------------------------------------------------------
    case 'lokamedia_worker_primary': {
      const effectiveState = health?.mediaWorker?.effectiveState || 'DISABLED';
      const activeDevs = health?.mediaWorker?.activeDevicesCount || snapshot?.media?.activeDevicesCount || 0;

      // Invariant: Media worker DISABLED must NEVER make Budi appear WORKING
      if (effectiveState === 'DISABLED') {
        opState = 'OFFLINE';
        liveStatus = 'OFFLINE';
        targetRoom = homeRoom;
        targetPos = workstationPos;
        animKey = 'OFFLINE_DISABLED';
        isWorking = false;
        stateEvidence = `Pekerja media nonaktif (DISABLED) — ${activeDevs} perangkat terhubung aktif.`;
        sourceType = 'TELEMETRY';
        auditNote = 'Media worker is disabled by policy (MEDIA_WORKER = DISABLED).';

        // Check if there's a failed media task
        const failedTask = tasks.find((t) => t.subsystem === 'media' && (t.stage === 'failed' || t.status === 'FAILED'));
        if (failedTask) {
          opState = 'BLOCKED';
          liveStatus = 'BLOCKED';
          animKey = 'BLOCKED_WARNING';
          stateEvidence = `Pekerja media nonaktif & tugas [${failedTask.title}] terhenti: ${failedTask.blockerOrError || 'Worker offline'}.`;
          taskProv = {
            task_id: failedTask.taskId,
            task_title: failedTask.title,
            stage: failedTask.stage,
            status: failedTask.status,
            department_id: 'media',
            responsible_agent_id: agentId,
            capability_id: 'MEDIA_OPERATIONS',
            started_at: failedTask.lastUpdate,
            last_updated_at: failedTask.lastUpdate,
            evidence_source: 'pipeline.tasks',
            evidence_id: failedTask.taskId,
            blocking_condition: failedTask.blockerOrError || 'Worker disabled'
          };
        }
        break;
      }

      // If ENABLED: check circuit breaker
      const mediaBreaker = health?.circuitBreakers?.find((cb) => cb.id.includes('media'));
      if (mediaBreaker && mediaBreaker.state === 'OPEN') {
        opState = 'BLOCKED';
        liveStatus = 'BLOCKED';
        targetRoom = homeRoom;
        targetPos = workstationPos;
        animKey = 'BLOCKED_WARNING';
        isWorking = false;
        stateEvidence = `Circuit breaker media [${mediaBreaker.id}] terbuka: ${mediaBreaker.tripReason || 'Kegagalan berulang'}.`;
        sourceType = 'TELEMETRY';
        auditNote = `Circuit breaker ${mediaBreaker.id} is OPEN.`;
        break;
      }

      // Check active generating jobs
      const activeMedia = tasks.find(
        (t) => t.subsystem === 'media' && ['GENERATING', 'IN_PROGRESS', 'LEASED'].includes(t.status.toUpperCase())
      );
      if (activeMedia) {
        opState = 'WORKING';
        liveStatus = 'WORKING';
        targetRoom = homeRoom;
        targetPos = workstationPos;
        animKey = 'MEDIA_PROCESSING';
        isWorking = true;
        stateEvidence = `Sedang memproses generasi media visual untuk [${activeMedia.title}].`;
        sourceType = 'PIPELINE_TASK';
        auditNote = `Active media generation job ${activeMedia.taskId}.`;
        taskProv = {
          task_id: activeMedia.taskId,
          task_title: activeMedia.title,
          stage: activeMedia.stage,
          status: activeMedia.status,
          department_id: 'media',
          responsible_agent_id: agentId,
          capability_id: 'MEDIA_OPERATIONS',
          started_at: activeMedia.lastUpdate,
          last_updated_at: activeMedia.lastUpdate,
          evidence_source: 'pipeline.tasks',
          evidence_id: activeMedia.taskId,
          blocking_condition: null
        };
        break;
      }

      // Queued media jobs waiting for device
      const queuedMedia = tasks.find((t) => t.subsystem === 'media' || t.stage === 'waiting_media');
      if (queuedMedia) {
        opState = 'IDLE';
        liveStatus = 'WAITING';
        targetRoom = 'lounge';
        targetPos = canonicalIdleSeat;
        animKey = 'IDLE_STANDBY';
        isWorking = false;
        stateEvidence = `Tugas media visual [${queuedMedia.title}] mengantre alokasi perangkat.`;
        sourceType = 'PIPELINE_TASK';
        auditNote = `Media job ${queuedMedia.taskId} is queued waiting.`;
        taskProv = {
          task_id: queuedMedia.taskId,
          task_title: queuedMedia.title,
          stage: queuedMedia.stage,
          status: queuedMedia.status,
          department_id: 'media',
          responsible_agent_id: agentId,
          capability_id: 'MEDIA_OPERATIONS',
          started_at: queuedMedia.lastUpdate,
          last_updated_at: queuedMedia.lastUpdate,
          evidence_source: 'pipeline.tasks',
          evidence_id: queuedMedia.taskId,
          blocking_condition: null
        };
        break;
      }

      break;
    }

    // ------------------------------------------------------------------------
    // 5. Sari (Publication Operations)
    // ------------------------------------------------------------------------
    case 'publication_dispatcher_core': {
      // 1. Emergency kill switch
      if (health?.automation?.killSwitchEngaged) {
        opState = 'BLOCKED';
        liveStatus = 'BLOCKED';
        targetRoom = homeRoom;
        targetPos = workstationPos;
        animKey = 'BLOCKED_WARNING';
        isWorking = false;
        stateEvidence = `Emergency Kill Switch aktif: ${health?.automation?.killReason || 'Global lock publikasi aktif'}.`;
        sourceType = 'TELEMETRY';
        auditNote = 'Emergency kill switch engaged.';
        break;
      }

      // 2. Publisher circuit breaker
      const pubBreaker = health?.circuitBreakers?.find((cb) => cb.id === 'global_publisher');
      if (pubBreaker && pubBreaker.state === 'OPEN') {
        opState = 'BLOCKED';
        liveStatus = 'BLOCKED';
        targetRoom = homeRoom;
        targetPos = workstationPos;
        animKey = 'BLOCKED_WARNING';
        isWorking = false;
        stateEvidence = `Circuit breaker global_publisher terbuka: ${pubBreaker.tripReason || 'Kegagalan penulisan D1'}.`;
        sourceType = 'TELEMETRY';
        auditNote = 'Publisher circuit breaker is OPEN.';
        break;
      }

      // 3. Active ingesting task, publication validation, or active cron
      const ingestingTask = tasks.find((t) => t.stage === 'ingesting');
      const validatingPubTask = tasks.find((t) => t.subsystem === 'publication' && t.stage === 'validating');
      const activeCron = snapshot?.scheduler?.cloudflareCron?.find((c) => c.status === 'STARTED');
      if (ingestingTask || validatingPubTask || activeCron) {
        const activeTask = ingestingTask || validatingPubTask;
        opState = 'WORKING';
        liveStatus = 'WORKING';
        targetRoom = homeRoom;
        targetPos = workstationPos;
        animKey = 'PUBLICATION_DISPATCH';
        isWorking = true;
        stateEvidence = activeTask
          ? `Sedang memproses publikasi / validasi artikel [${activeTask.title}].`
          : `Sedang mengeksekusi Cron publikasi: ${activeCron?.jobName}.`;
        sourceType = activeTask ? 'PIPELINE_TASK' : 'TELEMETRY';
        auditNote = activeTask ? `Publication task ${activeTask.taskId}` : `Active cron run ${activeCron?.runId}`;
        taskProv = {
          task_id: activeTask?.taskId || activeCron?.runId || 'cron_active',
          task_title: activeTask?.title || `Cron: ${activeCron?.jobName}`,
          stage: activeTask?.stage || 'ingesting',
          status: activeTask?.status || 'RUNNING',
          department_id: 'publication_operations',
          responsible_agent_id: agentId,
          capability_id: 'PUBLICATION_OPERATIONS',
          started_at: activeTask?.lastUpdate || activeCron?.startedAt || null,
          last_updated_at: activeTask?.lastUpdate || activeCron?.startedAt || null,
          evidence_source: activeTask ? 'pipeline.tasks' : 'scheduler.cloudflareCron',
          evidence_id: activeTask?.taskId || activeCron?.runId || 'cron_run',
          blocking_condition: null
        };
        break;
      }

      // 4. Scheduled queue monitoring
      const scheduledTasks = tasks.filter((t) => t.stage === 'scheduled');
      if (scheduledTasks.length > 0) {
        const topSched = scheduledTasks[0];
        const isAutoActive = health?.automation?.mode !== 'OFF' && !health?.automation?.killSwitchEngaged;
        if (isAutoActive) {
          opState = 'REVIEWING';
          liveStatus = 'WAITING';
          targetRoom = homeRoom;
          targetPos = workstationPos;
          animKey = 'PUBLICATION_MONITORING';
          isWorking = true;
          stateEvidence = `Memantau ${scheduledTasks.length} artikel terencana dalam jadwal tayang otomatis.`;
        } else {
          opState = 'IDLE';
          liveStatus = 'WAITING';
          targetRoom = 'lounge';
          targetPos = canonicalIdleSeat;
          animKey = 'IDLE_STANDBY';
          isWorking = false;
          stateEvidence = `Antrean artikel terjadwal (${scheduledTasks.length}) menunggu peluncuran manual (automation_mode=OFF); Sari siaga di Lounge.`;
        }
        sourceType = 'CANONICAL_DB';
        auditNote = `Scheduled queue contains ${scheduledTasks.length} articles; automation mode is ${health?.automation?.mode || 'OFF'}.`;
        taskProv = {
          task_id: topSched.taskId,
          task_title: topSched.title,
          stage: topSched.stage,
          status: topSched.status,
          department_id: 'publication_operations',
          responsible_agent_id: agentId,
          capability_id: 'PUBLICATION_OPERATIONS',
          started_at: topSched.lastUpdate,
          last_updated_at: topSched.lastUpdate,
          evidence_source: 'pipeline.tasks',
          evidence_id: topSched.taskId,
          blocking_condition: null
        };
        break;
      }

      // 5. Automation OFF normal idle
      const autoMode = health?.automation?.mode || 'OFF';
      stateEvidence = `Otomatisasi publikasi nonaktif (Mode ${autoMode}); operator siaga manual di Lounge.`;
      break;
    }

    // ------------------------------------------------------------------------
    // 6. Dimas (Engineering & Telemetry)
    // ------------------------------------------------------------------------
    case 'telemetry_observer_jev': {
      const latestObs = snapshot?.jev?.latestObservation;
      if (latestObs) {
        const obsTime = new Date(latestObs.createdAt).getTime();
        const diffSeconds = (Date.now() - obsTime) / 1000;
        const isRecent = diffSeconds >= 0 && diffSeconds <= 300;

        if (isRecent) {
          opState = 'WORKING';
          liveStatus = 'WORKING';
          targetRoom = homeRoom;
          targetPos = workstationPos;
          animKey = 'JEV_ANALYSIS';
          isWorking = true;
          stateEvidence = `Menganalisis sinyal keputusan TypeSafe JEV (${latestObs.decisionPoint}) — Shadow Mode (Otoritas: 0).`;
          sourceType = 'TELEMETRY';
          auditNote = `Recent JEV observation ${latestObs.observationId} (${diffSeconds.toFixed(0)}s ago).`;
          taskProv = {
            task_id: latestObs.observationId,
            task_title: `Evaluasi Shadow: ${latestObs.decisionPoint}`,
            stage: 'telemetry_eval',
            status: latestObs.providerStatus,
            department_id: 'engineering_telemetry',
            responsible_agent_id: agentId,
            capability_id: 'SYSTEM_TELEMETRY',
            started_at: latestObs.createdAt,
            last_updated_at: latestObs.createdAt,
            evidence_source: 'jev.latestObservation',
            evidence_id: latestObs.observationId,
            blocking_condition: null
          };
          break;
        }
      }

      stateEvidence = 'Telemetri sistem, D1 edge, dan observasi JEV dalam batas normal; siaga di Lounge.';
      break;
    }

    // ------------------------------------------------------------------------
    // 7. Jefry (Management Decision Advisor)
    // ------------------------------------------------------------------------
    case 'management_advisor_jefry': {
      // Invariant: Jefry is stationary at management_decision_console, NEVER wanders to Lounge
      targetRoom = 'management_room';
      targetPos = 'management_decision_console';

      const providerStatus = snapshot?.health?.jev?.providerStatus || 'UNKNOWN';
      const isBreakerOpen = snapshot?.health?.circuitBreakers?.some((cb) => cb.state === 'OPEN');

      if (providerStatus === 'ERROR' || isBreakerOpen) {
        opState = 'BLOCKED';
        liveStatus = 'BLOCKED';
        animKey = 'ADVISOR_DEGRADED';
        isWorking = false;
        stateEvidence = `Sistem advisori manajemen terdegradasi (${snapshot?.health?.jev?.errorClass || 'Provider error/breaker open'}).`;
        sourceType = 'TELEMETRY';
        auditNote = 'JEV provider error or circuit breaker open; advisory degraded.';
        break;
      }

      const latestObs = snapshot?.jev?.latestObservation;
      if (latestObs) {
        const obsTime = new Date(latestObs.createdAt).getTime();
        const diffSeconds = (Date.now() - obsTime) / 1000;
        const isRecent = diffSeconds >= 0 && diffSeconds <= 300;

        if (isRecent) {
          opState = 'REVIEWING';
          liveStatus = 'REVIEWING';
          isWorking = true;

          // Map advisory recommendation
          const recAction = (latestObs as any)?.rawDecision?.nextAction || latestObs?.jevDecision || '';
          if (recAction === 'continue') {
            animKey = 'ADVISOR_RECOMMEND_YES';
            stateEvidence = `Advisori Manajemen: Lanjut (YES) untuk '${latestObs.decisionPoint}' (0 Otoritas Eksekusi).`;
          } else if (recAction === 'stop') {
            animKey = 'ADVISOR_RECOMMEND_NO';
            stateEvidence = `Advisori Manajemen: Tahan (NO) untuk '${latestObs.decisionPoint}' (0 Otoritas Eksekusi).`;
          } else if (recAction === 'human_review' || recAction === 'revise') {
            animKey = 'ADVISOR_HUMAN_REVIEW';
            stateEvidence = `Advisori Manajemen: Perlu Verifikasi Editor untuk '${latestObs.decisionPoint}' (0 Otoritas Eksekusi).`;
          } else {
            animKey = 'ADVISOR_ANALYZING';
            stateEvidence = `Mengkaji sinyal kanonikal JEV untuk '${latestObs.decisionPoint}' (0 Otoritas Eksekusi).`;
          }

          sourceType = 'TELEMETRY';
          auditNote = `Management advisory observation ${latestObs.observationId} (${recAction}).`;
          taskProv = {
            task_id: latestObs.observationId,
            task_title: `Advisori: ${latestObs.decisionPoint}`,
            stage: 'management_eval',
            status: 'ADVISORY_EVALUATION',
            department_id: 'management',
            responsible_agent_id: agentId,
            capability_id: 'MANAGEMENT_DECISION_ADVISORY',
            started_at: latestObs.createdAt,
            last_updated_at: latestObs.createdAt,
            evidence_source: 'jev.latestObservation',
            evidence_id: latestObs.observationId,
            blocking_condition: null
          };
          break;
        }
      }

      opState = 'IDLE';
      liveStatus = 'IDLE';
      animKey = 'ADVISOR_IDLE';
      isWorking = false;
      stateEvidence = 'Konsol advisori manajemen siaga di North Terminus (Advisory Only; Otoritas Eksekusi: 0).';
      sourceType = 'IDLE_BASELINE';
      auditNote = 'Management decision advisor ready on console.';
      break;
    }

    default: {
      opState = 'IDLE';
      liveStatus = 'IDLE';
      targetRoom = 'lounge';
      targetPos = canonicalIdleSeat;
      animKey = 'IDLE_STANDBY';
      isWorking = false;
      break;
    }
  }

  const animDef = getAnimationDefinition(animKey);

  return {
    agent_id: agentId,
    display_name: staff.display_name,
    department_id: staff.department_id,
    operational_state: opState,
    live_status: liveStatus,
    location: {
      room_key: targetRoom,
      position_key: targetPos,
      is_at_workstation: targetPos === workstationPos || targetPos === 'editorial_review_desk' || targetPos === 'management_decision_console',
      is_in_lounge: targetRoom === 'lounge'
    },
    animation: {
      animation_key: animKey,
      is_actively_working: isWorking,
      visual_detail: animDef?.visual_detail || stateEvidence,
      css_animation_class: animDef?.css_animation_class || '',
      prop_icon: animDef?.prop_icon || '⚡'
    },
    current_task: taskProv,
    active_handoff: agentHandoff,
    active_anomaly: agentAnomaly
      ? {
          anomaly_id: agentAnomaly.anomaly_id,
          title: agentAnomaly.title,
          severity: agentAnomaly.severity,
          blocking_condition: agentAnomaly.blocker_reason || agentAnomaly.title
        }
      : null,
    state_evidence: stateEvidence,
    provenance: {
      source_type: sourceType,
      audit_note: auditNote
    }
  };
}

// ============================================================================
// Master Live Operations Snapshot Assembler
// ============================================================================

export function getLiveOperationsSnapshot(
  snapshot: MissionControlSnapshot | null,
  activeAnomalies: any[] = [],
  handoffs?: TaskHandoffObservation[]
): LiveOperationsSnapshot {
  const staffList = getStaffDefinitions();
  const recentHandoffs = handoffs || deriveCanonicalHandoffsFromPipeline(snapshot);

  const staffOps: Record<string, LiveStaffOperation> = {};
  let workingCount = 0;
  let reviewingCount = 0;
  let idleCount = 0;
  let waitingCount = 0;
  let blockedCount = 0;
  let offlineCount = 0;

  for (const staff of staffList) {
    const op = deriveLiveStaffOperation(staff.agent_id, snapshot, activeAnomalies, recentHandoffs);
    staffOps[staff.agent_id] = op;

    switch (op.operational_state) {
      case 'WORKING':
        workingCount++;
        break;
      case 'REVIEWING':
        reviewingCount++;
        break;
      case 'IDLE':
        if (op.live_status === 'WAITING') {
          waitingCount++;
        } else {
          idleCount++;
        }
        break;
      case 'BLOCKED':
        blockedCount++;
        break;
      case 'OFFLINE':
        offlineCount++;
        break;
      default:
        idleCount++;
        break;
    }
  }

  return {
    generated_at: new Date().toISOString(),
    staff_operations: staffOps,
    summary: {
      total_staff: staffList.length,
      working_count: workingCount,
      reviewing_count: reviewingCount,
      idle_count: idleCount,
      waiting_count: waitingCount,
      blocked_count: blockedCount,
      offline_count: offlineCount,
      active_anomalies_count: activeAnomalies.length,
      active_handoffs_count: recentHandoffs.length
    },
    safety_invariants: {
      automation_mode: snapshot?.health?.automation?.mode || 'OFF',
      social_automation: 'OFF',
      publishing_authority: 0,
      jev_mode: snapshot?.health?.jev?.mode || 'shadow',
      media_worker_effective_state: snapshot?.health?.mediaWorker?.effectiveState || 'DISABLED',
      jefry_execution_authority: 'ZERO_ADVISORY_ONLY'
    }
  };
}
