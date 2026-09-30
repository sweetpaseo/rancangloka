/**
 * RancangLoka Hermes Mission Control — Department Operations & Organizational State
 * Milestone: HERMES-MC-3
 * 
 * Strict Invariants:
 * 1. Read-only presentation layer. Zero database writes, zero execution authority.
 * 2. Deterministic department health derivation:
 *    Precedence: NOT_AVAILABLE > UNKNOWN > BLOCKED > OFFLINE > DEGRADED > ACTIVE > HEALTHY.
 * 3. Machine vs presentation separation: Department IDs are immutable keys; presentation labels are configurable.
 * 4. Staff membership aggregates genuine MC-2 staff models.
 * 5. Social department is strictly NOT_AVAILABLE and UNSTAFFED.
 * 6. Task ownership & activity attribution derive strictly from real signals.
 * 7. Handoffs represent real cross-department transitions only where evidence exists.
 * 8. Room metadata (room_key, workstation_zone) prepared for MC-4 Pixel Office.
 */

import type {
  ActivityEvent,
  MissionControlSnapshot,
  TaskCard
} from './types.ts';
import {
  type DepartmentId,
  type StaffMemberStatus,
  getStaffRoster,
  getStaffDefinitions
} from './staff-registry.ts';
import {
  type MissionControlCapabilityDefinition,
  getCapabilityDefinition,
  resolveCapabilityOwnership
} from './capability-registry.ts';
import { sanitizeString } from './redact.ts';

export type DepartmentHealth =
  | 'HEALTHY'
  | 'ACTIVE'
  | 'DEGRADED'
  | 'BLOCKED'
  | 'OFFLINE'
  | 'UNKNOWN'
  | 'NOT_AVAILABLE';

export type DepartmentAvailability =
  | 'AVAILABLE'
  | 'NOT_AVAILABLE'
  | 'AVAILABLE_READ_ONLY'
  | 'AVAILABLE_CONTROLLED';

export type ResponsibilityConfidence = 'EXACT' | 'DERIVED' | 'UNASSIGNED';

export type DepartmentHandoffState = 'PENDING' | 'READY' | 'COMPLETE' | 'BLOCKED' | 'UNKNOWN';

export interface TaskOwnershipInfo {
  department_id: DepartmentId | null;
  responsible_agent_id: string | null;
  responsibility_confidence: ResponsibilityConfidence;
}

export interface DepartmentBlocker {
  blocker_id: string;
  department_id: DepartmentId;
  task_id: string | null;
  severity: 'CRITICAL' | 'WARNING';
  error_class: string;
  summary: string;
  detected_at: string;
  retryable: boolean;
  operator_action_required: boolean;
  evidence_reference: string | null;
}

export interface DepartmentHandoff {
  source_department_id: DepartmentId;
  destination_department_id: DepartmentId;
  task_id: string;
  task_title: string;
  handoff_state: DepartmentHandoffState;
  timestamp: string;
  evidence: string;
}

export interface MissionControlDepartmentDefinition {
  department_id: DepartmentId;
  display_name: string;
  short_name?: string;
  description: string;
  availability: DepartmentAvailability;
  is_staffed: boolean;
  capabilities: string[];
  source_systems: string[];
  staff_roles?: string[];
  room_key: string;
  workstation_zone: string;
  display_order: number;
  health_adapter?: string | null;
  task_adapter?: string | null;
  activity_adapter?: string | null;
  anomaly_adapter?: string | null;
  conversation_enabled?: boolean;
  pixel_office_enabled?: boolean;
  feature_flags?: Record<string, boolean>;
}

export type DepartmentCanonicalConfig = MissionControlDepartmentDefinition;

export interface DepartmentOperationalStatus extends DepartmentCanonicalConfig {
  health: DepartmentHealth;
  health_evidence: string;
  staff: StaffMemberStatus[];
  staff_count: number;
  active_task_count: number;
  reviewing_task_count: number;
  blocked_task_count: number;
  latest_activity_at: string | null;
  current_blockers: DepartmentBlocker[];
  tasks: TaskCard[];
  recent_activities: ActivityEvent[];
  handoffs: DepartmentHandoff[];
}

export interface OrganizationSummary {
  total_departments: number;
  active_departments: number;
  healthy_departments: number;
  degraded_departments: number;
  blocked_departments: number;
  offline_departments: number;
  unavailable_departments: number;
  unknown_departments: number;
  total_staff: number;
  staff_working: number;
  staff_idle: number;
  staff_reviewing: number;
  staff_blocked: number;
  staff_offline: number;
  total_active_tasks: number;
  total_blockers: number;
}

export interface OrganizationSnapshot {
  generated_at: string;
  summary: OrganizationSummary;
  departments: DepartmentOperationalStatus[];
  handoffs: DepartmentHandoff[];
}

// ============================================================================
// Canonical Department Metadata & Pixel Office Preparation
// ============================================================================

export const CANONICAL_DEPARTMENTS: DepartmentCanonicalConfig[] = [
  {
    department_id: 'editorial',
    display_name: 'Editorial',
    description: 'Perencanaan topik, penulisan naskah arsitektur & hunian (anti-slop, human voice), serta kontrol mutu editorial.',
    availability: 'AVAILABLE',
    is_staffed: true,
    capabilities: ['ARTICLE_WRITING', 'EDITORIAL_QA', 'FIRST_ARTICLE_GATE', 'DRAFT_REFINEMENT'],
    source_systems: ['hermes_pipeline', 'hermes_qa', 'd1_articles'],
    room_key: 'editorial_room',
    workstation_zone: 'Zone E - Writing & Editorial QA Desks',
    display_order: 1
  },
  {
    department_id: 'research_evidence',
    display_name: 'Research & Evidence',
    description: 'Riset fakta teknis konstruksi, penelusuran standar bangunan (SNI/literatur), serta kompilasi evidence pack terverifikasi.',
    availability: 'AVAILABLE',
    is_staffed: true,
    capabilities: ['EVIDENCE_RESEARCH', 'FACT_CHECKING', 'SNI_VERIFICATION', 'CITATION_AUDIT'],
    source_systems: ['hermes_research', 'evidence_packs'],
    room_key: 'research_lab',
    workstation_zone: 'Zone R - Fact Checking & Reference Lab',
    display_order: 2
  },
  {
    department_id: 'media',
    display_name: 'Media Operations',
    description: 'Manajemen antrean visual LokaMedia, generasi gambar autentik, pemrosesan metadata, penanganan retry, dan penyimpanan R2.',
    availability: 'AVAILABLE',
    is_staffed: true,
    capabilities: ['MEDIA_OPERATIONS', 'VISUAL_GENERATION', 'TECHNICAL_QA', 'DURABLE_RETRY', 'R2_STORAGE'],
    source_systems: ['lokamedia_worker', 'd1_media_jobs', 'cloudflare_r2'],
    room_key: 'media_room',
    workstation_zone: 'Zone M - Visual Processing & Media Queue',
    display_order: 3
  },
  {
    department_id: 'publication_operations',
    display_name: 'Publication Operations',
    description: 'Orkestrasi jadwal tayang, kuota harian, penegakan safety envelope, atomic dispatch, dan audit log penerbitan.',
    availability: 'AVAILABLE',
    is_staffed: true,
    capabilities: ['PUBLICATION_OPERATIONS', 'SCHEDULE_DISPATCH', 'SAFETY_ENVELOPE', 'KILL_SWITCH_GATE', 'RECEIPT_AUDIT'],
    source_systems: ['publication_engine', 'cloudflare_cron', 'd1_receipts', 'automation_control'],
    room_key: 'publication_room',
    workstation_zone: 'Zone P - Dispatch Console & Safety Gates',
    display_order: 4
  },
  {
    department_id: 'engineering_telemetry',
    display_name: 'Engineering & Telemetry',
    description: 'Observabilitas edge, integritas circuit breaker, detak jantung daemon Hermes, serta evaluasi keputusan TypeSafe Jev bayangan.',
    availability: 'AVAILABLE',
    is_staffed: true,
    capabilities: ['SYSTEM_TELEMETRY', 'CIRCUIT_BREAKER_AUDIT', 'JEV_SHADOW_OBSERVATION', 'HEARTBEAT_EVALUATION'],
    source_systems: ['typesafe_jev', 'edge_runtime', 'd1_observations', 'circuit_breakers'],
    room_key: 'operations_room',
    workstation_zone: 'Zone O - Telemetry Monolith & Decision Console',
    display_order: 5
  },
  {
    department_id: 'social',
    display_name: 'Social & Distribution',
    description: 'Distribusi multi-kanal dan sindikasi ke media sosial (kapasitas organisasi masa depan; belum diimplementasikan di MC-3).',
    availability: 'NOT_AVAILABLE',
    is_staffed: false,
    capabilities: ['SOCIAL_DISTRIBUTION', 'MULTI_CHANNEL_SYNC'],
    source_systems: ['future_social_bridge'],
    room_key: 'social_room',
    workstation_zone: 'Zone S - Unstaffed Distribution Bay',
    display_order: 6
  }
];

// In-memory dynamic department store initialized with canonical baseline
let dynamicDepartmentStore: Map<string, MissionControlDepartmentDefinition> = new Map(
  CANONICAL_DEPARTMENTS.map((d) => [d.department_id, { ...d }])
);

/**
 * Register a new department dynamically into Mission Control.
 * Throws if department_id is missing or already registered.
 */
export function registerDepartment(definition: MissionControlDepartmentDefinition): void {
  if (!definition || !definition.department_id) {
    throw new Error('[DepartmentRegistry] Department registration requires a valid department_id');
  }

  if (dynamicDepartmentStore.has(definition.department_id)) {
    throw new Error(`[DepartmentRegistry] Department with ID '${definition.department_id}' is already registered.`);
  }

  dynamicDepartmentStore.set(definition.department_id, { ...definition });
}

/**
 * Unregister a department (primarily used in tests).
 */
export function unregisterDepartment(departmentId: string): boolean {
  return dynamicDepartmentStore.delete(departmentId);
}

/**
 * Reset department store to canonical baseline.
 */
export function resetDepartmentRegistry(): void {
  dynamicDepartmentStore = new Map(CANONICAL_DEPARTMENTS.map((d) => [d.department_id, { ...d }]));
}

/**
 * Retrieve all currently registered departments.
 */
export function getRegisteredDepartments(): MissionControlDepartmentDefinition[] {
  return Array.from(dynamicDepartmentStore.values()).sort((a, b) => a.display_order - b.display_order);
}

/**
 * Retrieve a specific department definition by machine ID.
 */
export function getDepartmentDefinition(departmentId: string): MissionControlDepartmentDefinition | null {
  return dynamicDepartmentStore.get(departmentId) || null;
}

export const STAFF_ROOM_MAP: Record<string, string> = {
  content_writer_primary: 'editorial_room',
  editorial_qa_primary: 'editorial_room',
  evidence_researcher_lead: 'research_lab',
  lokamedia_worker_primary: 'media_room',
  publication_dispatcher_core: 'publication_room',
  telemetry_observer_jev: 'operations_room'
};

// ============================================================================
// Task Ownership & Attribution
// ============================================================================

/**
 * Deterministically attributes a task to a department and staff agent where derivable.
 */
export function attributeTaskOwnership(task: TaskCard): TaskOwnershipInfo {
  if (!task) {
    return { department_id: null, responsible_agent_id: null, responsibility_confidence: 'UNASSIGNED' };
  }

  const stage = String(task.stage || '').toLowerCase();
  const sub = String(task.subsystem || '').toLowerCase();

  // 1. Research Stage -> Research & Evidence (Irwan)
  if (stage === 'researching' || sub === 'research') {
    return {
      department_id: 'research_evidence',
      responsible_agent_id: 'evidence_researcher_lead',
      responsibility_confidence: 'EXACT'
    };
  }

  // 2. Writing Stage -> Editorial (Joko)
  if (stage === 'writing') {
    return {
      department_id: 'editorial',
      responsible_agent_id: 'content_writer_primary',
      responsibility_confidence: 'EXACT'
    };
  }

  // 3. Validating / Editorial QA Stage -> Editorial (Rina)
  if (stage === 'validating' || stage === 'editorial_qa') {
    return {
      department_id: 'editorial',
      responsible_agent_id: 'editorial_qa_primary',
      responsibility_confidence: 'EXACT'
    };
  }

  // 4. Ready for review -> Editorial (Rina)
  if (stage === 'ready_for_review') {
    return {
      department_id: 'editorial',
      responsible_agent_id: 'editorial_qa_primary',
      responsibility_confidence: 'DERIVED'
    };
  }

  // 5. Media Stage or Subsystem -> Media Operations (Budi)
  if (stage === 'waiting_media' || sub === 'media' || Boolean(task.relatedMediaJobId)) {
    return {
      department_id: 'media',
      responsible_agent_id: 'lokamedia_worker_primary',
      responsibility_confidence: task.subsystem === 'media' ? 'EXACT' : 'DERIVED'
    };
  }

  // 6. Ingesting, Scheduled, Published -> Publication Operations (Sari)
  if (stage === 'ingesting' || stage === 'scheduled' || stage === 'published' || sub === 'publication') {
    return {
      department_id: 'publication_operations',
      responsible_agent_id: 'publication_dispatcher_core',
      responsibility_confidence: sub === 'publication' ? 'EXACT' : 'DERIVED'
    };
  }

  // 7. Draft without other flags -> Editorial (Joko)
  if (stage === 'draft' && sub === 'editorial') {
    return {
      department_id: 'editorial',
      responsible_agent_id: 'content_writer_primary',
      responsibility_confidence: 'DERIVED'
    };
  }

  // 8. Dynamic Capability-based attribution
  const taskCapability = (task as any).capability_id;
  if (taskCapability) {
    const ownership = resolveCapabilityOwnership(taskCapability);
    if (ownership.department_id) {
      return {
        department_id: ownership.department_id,
        responsible_agent_id: ownership.responsible_agent_id,
        responsibility_confidence: 'EXACT'
      };
    }
  }

  // 9. Dynamic registered department subsystem match
  if (sub) {
    const matchedDept = getDepartmentDefinition(sub);
    if (matchedDept) {
      const staffList = getStaffDefinitions().filter((s) => s.department_id === matchedDept.department_id);
      return {
        department_id: matchedDept.department_id,
        responsible_agent_id: staffList.length === 1 ? staffList[0].agent_id : null,
        responsibility_confidence: 'DERIVED'
      };
    }
  }

  // 10. Unassigned fallback
  return {
    department_id: null,
    responsible_agent_id: null,
    responsibility_confidence: 'UNASSIGNED'
  };
}

// ============================================================================
// Department Activity Attribution
// ============================================================================

export interface DepartmentActivityAttribution {
  attributedDepartmentId: DepartmentId | null;
  attributedAgentId: string | null;
  confidence: ResponsibilityConfidence;
}

/**
 * Attributes an audit / activity event to a department and agent with confidence classification.
 */
export function attributeActivityToDepartment(event: ActivityEvent): DepartmentActivityAttribution {
  if (!event || !event.eventType) {
    return { attributedDepartmentId: null, attributedAgentId: null, confidence: 'UNASSIGNED' };
  }

  const evType = event.eventType.toUpperCase();
  const sub = String(event.subsystem || '').toLowerCase();

  // Media Operations -> media / Budi
  if (sub === 'media' || evType.includes('MEDIA_') || evType.includes('LOKAMEDIA')) {
    return {
      attributedDepartmentId: 'media',
      attributedAgentId: 'lokamedia_worker_primary',
      confidence: 'EXACT'
    };
  }

  // Engineering & Telemetry -> engineering_telemetry / Dimas
  if (evType === 'JEV_SHADOW_OBSERVATION' || evType.includes('JEV_') || sub === 'engineering') {
    return {
      attributedDepartmentId: 'engineering_telemetry',
      attributedAgentId: 'telemetry_observer_jev',
      confidence: 'EXACT'
    };
  }

  // Publication Operations -> publication_operations / Sari
  if (
    sub === 'publication' ||
    evType === 'PUBLICATION_CRON_EXECUTION' ||
    evType === 'AUTOMATION_CONTROL_CHANGE' ||
    (evType === 'CIRCUIT_BREAKER_TRANSITION' && event.entityReference?.includes('publisher'))
  ) {
    return {
      attributedDepartmentId: 'publication_operations',
      attributedAgentId: 'publication_dispatcher_core',
      confidence: 'EXACT'
    };
  }

  // Research & Evidence -> research_evidence / Irwan
  if (sub === 'research' || evType.includes('EVIDENCE_') || evType.includes('RESEARCH_PACK')) {
    return {
      attributedDepartmentId: 'research_evidence',
      attributedAgentId: 'evidence_researcher_lead',
      confidence: 'EXACT'
    };
  }

  // Editorial -> editorial (Joko or Rina)
  if (sub === 'editorial' || evType.includes('ARTICLE_') || evType.includes('EDITORIAL_') || evType.includes('GATE')) {
    const isQA = evType.includes('QA') || evType.includes('GATE') || evType.includes('REVIEW') || evType.includes('VALIDATION');
    return {
      attributedDepartmentId: 'editorial',
      attributedAgentId: isQA ? 'editorial_qa_primary' : 'content_writer_primary',
      confidence: 'DERIVED'
    };
  }

  // Ambiguous system fallback
  return {
    attributedDepartmentId: null,
    attributedAgentId: null,
    confidence: 'UNASSIGNED'
  };
}

// ============================================================================
// Department Blockers Derivation
// ============================================================================

/**
 * Extracts and categorizes real operational blockers per department from snapshot telemetry.
 */
export function deriveDepartmentBlockers(
  departmentId: DepartmentId,
  snapshot: MissionControlSnapshot | null
): DepartmentBlocker[] {
  if (!snapshot) return [];

  const blockers: DepartmentBlocker[] = [];
  const { health, pipeline, scheduler } = snapshot;

  switch (departmentId) {
    case 'publication_operations': {
      // 1. Kill Switch
      if (health?.automation?.killSwitchEngaged) {
        blockers.push({
          blocker_id: 'blocker_kill_switch',
          department_id: 'publication_operations',
          task_id: null,
          severity: 'CRITICAL',
          error_class: 'EMERGENCY_KILL_SWITCH_ACTIVE',
          summary: `Emergency Kill Switch aktif: ${health.automation.killReason || 'Global lock publikasi dipicu'}`,
          detected_at: health.automation.updatedAt || new Date().toISOString(),
          retryable: false,
          operator_action_required: true,
          evidence_reference: 'automation_control'
        });
      }
      // 2. Publisher Breaker Open
      const pubBreaker = health?.circuitBreakers?.find((cb) => cb.id === 'global_publisher');
      if (pubBreaker && pubBreaker.state === 'OPEN') {
        blockers.push({
          blocker_id: 'blocker_breaker_global_publisher',
          department_id: 'publication_operations',
          task_id: null,
          severity: 'CRITICAL',
          error_class: 'CIRCUIT_BREAKER_OPEN',
          summary: `Circuit breaker global_publisher terbuka: ${pubBreaker.tripReason || 'Kegagalan batas penulisan D1'}`,
          detected_at: pubBreaker.lastStateChangeAt || new Date().toISOString(),
          retryable: true,
          operator_action_required: true,
          evidence_reference: 'circuit_breakers:global_publisher'
        });
      }
      // 3. Failed Cron
      const cronRuns = scheduler?.cloudflareCron || [];
      const failedCron = cronRuns.find((c) => c.status === 'FAILED');
      if (failedCron) {
        blockers.push({
          blocker_id: `blocker_cron_${failedCron.runId}`,
          department_id: 'publication_operations',
          task_id: failedCron.runId,
          severity: 'WARNING',
          error_class: 'CRON_JOB_FAILED',
          summary: `Cloudflare Cron '${failedCron.jobName}' gagal: ${failedCron.errorSummary || 'Kesalahan runner'}`,
          detected_at: failedCron.startedAt,
          retryable: true,
          operator_action_required: false,
          evidence_reference: `publication_cron_runs:${failedCron.runId}`
        });
      }
      break;
    }

    case 'media': {
      // 1. Media Breaker
      const mediaBreaker = health?.circuitBreakers?.find((cb) => cb.id.includes('media'));
      if (mediaBreaker && mediaBreaker.state === 'OPEN') {
        blockers.push({
          blocker_id: `blocker_breaker_${mediaBreaker.id}`,
          department_id: 'media',
          task_id: null,
          severity: 'CRITICAL',
          error_class: 'CIRCUIT_BREAKER_OPEN',
          summary: `Circuit breaker media [${mediaBreaker.id}] terbuka: ${mediaBreaker.tripReason || 'Kegagalan generasi media'}`,
          detected_at: mediaBreaker.lastStateChangeAt || new Date().toISOString(),
          retryable: true,
          operator_action_required: true,
          evidence_reference: `circuit_breakers:${mediaBreaker.id}`
        });
      }
      // 2. Failed Media Tasks
      const failedMediaTasks = pipeline?.tasks?.filter((t) => t.subsystem === 'media' && t.stage === 'failed') || [];
      for (const t of failedMediaTasks) {
        blockers.push({
          blocker_id: `blocker_task_${t.taskId}`,
          department_id: 'media',
          task_id: t.taskId,
          severity: 'WARNING',
          error_class: 'MEDIA_JOB_FAILED',
          summary: `Pekerjaan media [${t.title}] gagal: ${t.blockerOrError || 'Percobaan habis'}`,
          detected_at: t.lastUpdate,
          retryable: t.retryCount < 3,
          operator_action_required: t.retryCount >= 3,
          evidence_reference: t.relatedMediaJobId || t.taskId
        });
      }
      break;
    }

    case 'editorial': {
      // Failed authoring/QA tasks
      const failedEditorialTasks = pipeline?.tasks?.filter((t) => t.subsystem === 'editorial' && t.stage === 'failed') || [];
      for (const t of failedEditorialTasks) {
        blockers.push({
          blocker_id: `blocker_editorial_${t.taskId}`,
          department_id: 'editorial',
          task_id: t.taskId,
          severity: 'WARNING',
          error_class: 'EDITORIAL_TASK_FAILED',
          summary: `Naskah [${t.title}] terhambat: ${t.blockerOrError || 'Kegagalan validasi naskah'}`,
          detected_at: t.lastUpdate,
          retryable: true,
          operator_action_required: true,
          evidence_reference: `articles:${t.taskId}`
        });
      }
      break;
    }

    case 'research_evidence': {
      // Failed research tasks
      const failedResearch = pipeline?.tasks?.filter((t) => t.subsystem === 'research' && t.stage === 'failed') || [];
      for (const t of failedResearch) {
        blockers.push({
          blocker_id: `blocker_research_${t.taskId}`,
          department_id: 'research_evidence',
          task_id: t.taskId,
          severity: 'WARNING',
          error_class: 'RESEARCH_PACK_FAILED',
          summary: `Riset bukti terhambat: ${t.blockerOrError || 'Kegagalan kompilasi sitasi'}`,
          detected_at: t.lastUpdate,
          retryable: true,
          operator_action_required: false,
          evidence_reference: t.taskId
        });
      }
      break;
    }

    case 'engineering_telemetry': {
      // JEV Provider Hard Error
      if (health?.jev?.providerStatus === 'ERROR') {
        blockers.push({
          blocker_id: 'blocker_jev_provider_error',
          department_id: 'engineering_telemetry',
          task_id: null,
          severity: 'WARNING',
          error_class: 'JEV_PROVIDER_UNREACHABLE',
          summary: `Koneksi provider TypeSafe JEV (OpenRouter) mengalami kesalahan: ${health.jev.errorClass || 'HTTP Error'}`,
          detected_at: health.jev.latestTimestamp || new Date().toISOString(),
          retryable: true,
          operator_action_required: false,
          evidence_reference: 'typesafe_jev'
        });
      }
      break;
    }

    default:
      break;
  }

  return blockers;
}

// ============================================================================
// Organizational Handoff Model
// ============================================================================

/**
 * Derives genuine cross-department workflow handoffs from active articles and media jobs.
 * Strict Invariant: Does not invent workflow transitions where evidence is absent.
 */
export function deriveDepartmentHandoffs(snapshot: MissionControlSnapshot | null): DepartmentHandoff[] {
  if (!snapshot) return [];

  const handoffs: DepartmentHandoff[] = [];
  const tasks = snapshot.pipeline?.tasks || [];

  for (const task of tasks) {
    // 1. Article awaiting media: Editorial -> Media Operations
    if (task.stage === 'waiting_media' && task.relatedMediaJobId) {
      const isFailed = task.status === 'FAILED' || task.status === 'FAILED_TERMINAL';
      handoffs.push({
        source_department_id: 'editorial',
        destination_department_id: 'media',
        task_id: task.taskId,
        task_title: task.title,
        handoff_state: isFailed ? 'BLOCKED' : 'READY',
        timestamp: task.lastUpdate,
        evidence: isFailed
          ? `Generasi media visual terhambat: ${task.blockerOrError || 'Error'}`
          : `Naskah diserahkan ke Media Operations untuk penyiapan gambar (${task.relatedMediaJobId})`
      });
    }

    // 2. Media attached awaiting QA: Media Operations -> Editorial
    if (task.stage === 'editorial_qa') {
      handoffs.push({
        source_department_id: 'media',
        destination_department_id: 'editorial',
        task_id: task.taskId,
        task_title: task.title,
        handoff_state: 'READY',
        timestamp: task.lastUpdate,
        evidence: 'Aset visual telah terpasang, menunggu verifikasi First Article Gate oleh Editorial QA'
      });
    }

    // 3. Article approved and scheduled: Editorial -> Publication Operations
    if (task.stage === 'scheduled') {
      const pubBreaker = snapshot.health?.circuitBreakers?.find((cb) => cb.id === 'global_publisher');
      const isBlocked = snapshot.health?.automation?.killSwitchEngaged || pubBreaker?.state === 'OPEN';
      handoffs.push({
        source_department_id: 'editorial',
        destination_department_id: 'publication_operations',
        task_id: task.taskId,
        task_title: task.title,
        handoff_state: isBlocked ? 'BLOCKED' : 'READY',
        timestamp: task.lastUpdate,
        evidence: isBlocked
          ? 'Publikasi terblokir oleh pemutus sirkuit atau saklar darurat global'
          : 'Naskah disetujui Chief Editor, dialihkan ke Publication Operations untuk dispatch jadwal'
      });
    }

    // 4. Ingesting: Publication Operations in-flight
    if (task.stage === 'ingesting') {
      handoffs.push({
        source_department_id: 'editorial',
        destination_department_id: 'publication_operations',
        task_id: task.taskId,
        task_title: task.title,
        handoff_state: 'READY',
        timestamp: task.lastUpdate,
        evidence: 'Sedang dalam proses transmisi dan validasi ingest Cloudflare D1'
      });
    }

    // 5. Research Stage: Research & Evidence -> Editorial
    if (task.stage === 'researching') {
      handoffs.push({
        source_department_id: 'research_evidence',
        destination_department_id: 'editorial',
        task_id: task.taskId,
        task_title: task.title,
        handoff_state: 'PENDING',
        timestamp: task.lastUpdate,
        evidence: 'Evidence pack dan verifikasi SNI sedang disiapkan sebelum penulisan naskah'
      });
    }
  }

  // Sort descending by timestamp
  return handoffs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ============================================================================
// Department Health Model (Exact Precedence)
// ============================================================================

export interface DerivedDepartmentHealthResult {
  health: DepartmentHealth;
  evidence: string;
}

/**
 * Deterministically evaluates department health according to exact precedence:
 * NOT_AVAILABLE > UNKNOWN > BLOCKED > OFFLINE > DEGRADED > ACTIVE > HEALTHY
 */
export function deriveDepartmentHealth(
  deptConfig: DepartmentCanonicalConfig,
  snapshot: MissionControlSnapshot | null,
  staffMembers: StaffMemberStatus[],
  blockers: DepartmentBlocker[],
  departmentTasks: TaskCard[]
): DerivedDepartmentHealthResult {
  // Precedence 1: NOT_AVAILABLE
  if (deptConfig.availability === 'NOT_AVAILABLE' || !deptConfig.is_staffed) {
    return {
      health: 'NOT_AVAILABLE',
      evidence: 'Departemen belum tersedia dalam arsitektur runtime (unstaffed / future capacity).'
    };
  }

  // Precedence 2: UNKNOWN (missing snapshot or null database)
  if (!snapshot || !snapshot.health) {
    return {
      health: 'UNKNOWN',
      evidence: 'Data telemetri departemen tidak tersedia atau belum diinisialisasi.'
    };
  }

  // Precedence 3: BLOCKED
  // Critical blockers, open breakers, or kill switch
  const criticalBlockers = blockers.filter((b) => b.severity === 'CRITICAL');
  if (criticalBlockers.length > 0) {
    return {
      health: 'BLOCKED',
      evidence: criticalBlockers[0].summary
    };
  }

  // Any staff member explicitly BLOCKED
  const blockedStaff = staffMembers.find((s) => s.state === 'BLOCKED');
  if (blockedStaff) {
    return {
      health: 'BLOCKED',
      evidence: `Staf [${blockedStaff.display_name}] terblokir: ${blockedStaff.state_evidence}`
    };
  }

  // Precedence 4: OFFLINE
  // Dedicated canonical offline rules per department
  if (deptConfig.department_id === 'media') {
    if (snapshot.health.mediaWorker?.effectiveState === 'DISABLED') {
      return {
        health: 'OFFLINE',
        evidence: `Pekerja media nonaktif (DISABLED) - ${snapshot.health.mediaWorker.activeDevicesCount} perangkat terhubung.`
      };
    }
  }

  if (deptConfig.department_id === 'editorial' || deptConfig.department_id === 'research_evidence') {
    if (snapshot.scheduler?.hermes?.status === 'offline') {
      return {
        health: 'OFFLINE',
        evidence: 'Daemon container Hermes berstatus offline (>600 detik tanpa detak jantung).'
      };
    }
  }

  // If all staff in department are offline
  if (staffMembers.length > 0 && staffMembers.every((s) => s.state === 'OFFLINE')) {
    return {
      health: 'OFFLINE',
      evidence: 'Seluruh staf dalam departemen ini berstatus luring (offline).'
    };
  }

  // Precedence 5: DEGRADED
  // Warnings, retries, stale scheduler, or fallback providers
  const warningBlockers = blockers.filter((b) => b.severity === 'WARNING');
  if (warningBlockers.length > 0) {
    return {
      health: 'DEGRADED',
      evidence: warningBlockers[0].summary
    };
  }

  if (deptConfig.department_id === 'editorial' || deptConfig.department_id === 'research_evidence') {
    if (snapshot.scheduler?.hermes?.status === 'stale') {
      return {
        health: 'DEGRADED',
        evidence: 'Detak jantung Hermes basi (301-600 detik sejak transmisi terakhir).'
      };
    }
  }

  if (deptConfig.department_id === 'engineering_telemetry') {
    if (snapshot.health.jev?.providerStatus === 'FALLBACK') {
      return {
        health: 'DEGRADED',
        evidence: 'Provider TypeSafe JEV menggunakan fallback deterministik.'
      };
    }
  }

  // Tasks with retries > 0
  const retryingTasks = departmentTasks.filter((t) => t.retryCount > 0);
  if (retryingTasks.length > 0) {
    return {
      health: 'DEGRADED',
      evidence: `Terdapat ${retryingTasks.length} tugas yang sedang dalam siklus retry.`
    };
  }

  // Precedence 6: ACTIVE
  // Genuine in-progress work or staff in WORKING / REVIEWING state
  const workingStaff = staffMembers.find((s) => s.state === 'WORKING' || s.state === 'REVIEWING');
  const activeTasks = departmentTasks.filter((t) => t.stage !== 'published');
  if (workingStaff || activeTasks.length > 0) {
    const activeSummary = workingStaff
      ? `Staf [${workingStaff.display_name}] aktif (${workingStaff.state}): ${workingStaff.state_evidence}`
      : `Memproses ${activeTasks.length} tugas aktif dalam pipeline.`;
    return {
      health: 'ACTIVE',
      evidence: activeSummary
    };
  }

  // Precedence 7: HEALTHY
  // Zero active tasks + healthy dormant subsystem
  if (deptConfig.department_id === 'publication_operations') {
    const mode = snapshot.health.automation?.mode || 'OFF';
    return {
      health: 'HEALTHY',
      evidence: `Sistem operasi publikasi sehat dan siaga (Mode: ${mode}; Gerbang keselamatan normal).`
    };
  }

  return {
    health: 'HEALTHY',
    evidence: 'Subsistem sehat dan siaga operasional; tidak ada tugas atau hambatan yang tertunda.'
  };
}

// ============================================================================
// Department Operations Snapshot Compiler (Read-Only Master Aggregator)
// ============================================================================

/**
 * Compiles full organization and department snapshot from live Mission Control data.
 * Enforces zero writes, zero data fabrication, and accurate health derivation.
 */
export function getOrganizationSnapshot(snapshot: MissionControlSnapshot | null): OrganizationSnapshot {
  const staffRoster = getStaffRoster(snapshot);
  const allHandoffs = deriveDepartmentHandoffs(snapshot);
  const allTasks = snapshot?.pipeline?.tasks || [];
  const allActivities = snapshot?.activity || [];

  const registeredDepts = getRegisteredDepartments();

  const summary: OrganizationSummary = {
    total_departments: registeredDepts.length,
    active_departments: 0,
    healthy_departments: 0,
    degraded_departments: 0,
    blocked_departments: 0,
    offline_departments: 0,
    unavailable_departments: 0,
    unknown_departments: 0,
    total_staff: staffRoster.summary.total,
    staff_working: staffRoster.summary.working,
    staff_idle: staffRoster.summary.idle,
    staff_reviewing: staffRoster.summary.reviewing,
    staff_blocked: staffRoster.summary.blocked,
    staff_offline: staffRoster.summary.offline,
    total_active_tasks: 0,
    total_blockers: 0
  };

  const departments: DepartmentOperationalStatus[] = registeredDepts.map((deptConfig) => {
    // 1. Filter staff members belonging to this department
    const deptStaff = staffRoster.staff.filter((s) => s.department_id === deptConfig.department_id);

    // 2. Filter tasks belonging to this department
    const deptTasks = allTasks.filter((task) => {
      const ownership = attributeTaskOwnership(task);
      return ownership.department_id === deptConfig.department_id;
    });

    // 3. Derive blockers
    const deptBlockers = deriveDepartmentBlockers(deptConfig.department_id, snapshot);

    // 4. Derive health
    const { health, evidence: healthEvidence } = deriveDepartmentHealth(
      deptConfig,
      snapshot,
      deptStaff,
      deptBlockers,
      deptTasks
    );

    // 5. Workload counts
    const activeCount = deptTasks.filter((t) => ['writing', 'researching', 'validating', 'waiting_media', 'ingesting'].includes(t.stage)).length;
    const reviewingCount = deptTasks.filter((t) => ['editorial_qa', 'ready_for_review', 'scheduled'].includes(t.stage)).length;
    const blockedCount = deptTasks.filter((t) => t.stage === 'failed').length + deptBlockers.length;

    // 6. Filter department activities
    const deptActivities = allActivities.filter((act) => {
      const attr = attributeActivityToDepartment(act);
      return attr.attributedDepartmentId === deptConfig.department_id;
    });

    // 7. Filter department handoffs (as source or destination)
    const deptHandoffs = allHandoffs.filter(
      (h) => h.source_department_id === deptConfig.department_id || h.destination_department_id === deptConfig.department_id
    );

    // 8. Latest activity timestamp
    const latestActivityAt = deptActivities[0]?.timestamp || deptTasks[0]?.lastUpdate || null;

    // Update global summary counts
    switch (health) {
      case 'ACTIVE':
        summary.active_departments++;
        break;
      case 'HEALTHY':
        summary.healthy_departments++;
        break;
      case 'DEGRADED':
        summary.degraded_departments++;
        break;
      case 'BLOCKED':
        summary.blocked_departments++;
        break;
      case 'OFFLINE':
        summary.offline_departments++;
        break;
      case 'NOT_AVAILABLE':
        summary.unavailable_departments++;
        break;
      default:
        summary.unknown_departments++;
        break;
    }

    summary.total_active_tasks += activeCount + reviewingCount;
    summary.total_blockers += deptBlockers.length;

    return {
      ...deptConfig,
      status: deptConfig.availability,
      health,
      health_evidence: healthEvidence,
      staff: deptStaff,
      staff_count: deptStaff.length,
      active_task_count: activeCount,
      reviewing_task_count: reviewingCount,
      blocked_task_count: blockedCount,
      latest_activity_at: latestActivityAt,
      current_blockers: deptBlockers,
      tasks: deptTasks,
      recent_activities: deptActivities.slice(0, 10),
      handoffs: deptHandoffs
    };
  });

  return {
    generated_at: new Date().toISOString(),
    summary,
    departments,
    handoffs: allHandoffs
  };
}

/**
 * Get operational status for a single department by ID.
 */
export function getDepartmentById(
  departmentId: string,
  snapshot: MissionControlSnapshot | null
): DepartmentOperationalStatus | null {
  const org = getOrganizationSnapshot(snapshot);
  return org.departments.find((d) => d.department_id === departmentId) || null;
}
