/**
 * RancangLoka Hermes Mission Control — Staff Identity & Capability Registry
 * Milestone: HERMES-MC-2
 * 
 * Strict Invariants:
 * 1. Read-only presentation layer.
 * 2. Human names MUST NOT be used as runtime IDs — Machine IDs (agent_id) remain authoritative.
 * 3. Display names are centrally configurable without affecting execution routing.
 * 4. Deterministic state derivation from real telemetry only (zero fabricated states).
 * 5. Current task priority: 1) active, 2) blocked, 3) reviewing, 4) latest relevant task. If none: null.
 * 6. Media worker DISABLED must never make Budi appear WORKING.
 * 7. Publication automation OFF must not automatically be labeled an error.
 * 8. JEV remains shadow/advisory; Dimas must never be presented as having publication authority.
 * 9. Low-confidence activity attribution must be 'System' or 'Unassigned' — never guess.
 * 10. Social department remains unstaffed/not available in MC-2.
 */

import type {
  ActivityEvent,
  MissionControlSnapshot,
  TaskCard
} from './types.ts';
import { sanitizeString } from './redact.ts';

export type StaffCapability =
  | 'ARTICLE_WRITING'
  | 'HUMAN_WRITING_AUTHORING'
  | 'EVIDENCE_RESEARCH'
  | 'EDITORIAL_QA'
  | 'HUMAN_WRITING_QA'
  | 'EDITORIAL_NATURALNESS_REVIEW'
  | 'MEDIA_OPERATIONS'
  | 'PUBLICATION_OPERATIONS'
  | 'SYSTEM_TELEMETRY';

export type StaffOperationalState =
  | 'WORKING'
  | 'IDLE'
  | 'REVIEWING'
  | 'BLOCKED'
  | 'OFFLINE'
  | 'UNKNOWN';

export type DepartmentId = string;

export interface DepartmentDefinition {
  department_id: DepartmentId;
  name: string;
  description: string;
  is_available: boolean;
  is_staffed: boolean;
  lead_role?: string;
  sort_order: number;
}

export interface MissionControlStaffDefinition {
  agent_id: string;
  display_name: string;
  role: string;
  department_id: DepartmentId;
  description: string;
  avatar_key: string;
  capabilities: string[];
  source_system: string;
  active: boolean;
  sort_order: number;
  source_systems?: string[];
  capability_ids?: string[];
  state_adapter?: string | null;
  task_adapter?: string | null;
  activity_adapter?: string | null;
  conversation_policy?: Record<string, any>;
  alert_policy?: Record<string, any>;
  room_policy?: Record<string, any>;
}

export type StaffDefinition = MissionControlStaffDefinition;

export interface StaffCurrentTask {
  current_task_id: string;
  current_task_title: string;
  current_task_status: string;
  current_task_updated_at: string;
}

export interface StaffAttributedActivity {
  eventId: string;
  timestamp: string;
  eventType: string;
  summary: string;
  severity: string;
  entityReference: string | null;
}

export interface StaffMemberStatus extends StaffDefinition {
  state: StaffOperationalState;
  state_evidence: string;
  current_task: StaffCurrentTask | null;
  last_activity_at: string | null;
  recent_activities: StaffAttributedActivity[];
}

export interface StaffSummaryCounts {
  total: number;
  working: number;
  idle: number;
  reviewing: number;
  blocked: number;
  offline: number;
  unknown: number;
}

export interface StaffRosterSnapshot {
  generated_at: string;
  summary: StaffSummaryCounts;
  staff: StaffMemberStatus[];
  departments: DepartmentDefinition[];
}

// ============================================================================
// Canonical Departments Metadata
// ============================================================================

export const DEPARTMENTS_METADATA: DepartmentDefinition[] = [
  {
    department_id: 'management',
    name: 'Management & Decision Chamber',
    description: 'Lapisan kepemimpinan supervisi dan penasihat keputusan redaksional (strictly advisory, non-execution, zero publication authority).',
    is_available: true,
    is_staffed: true,
    lead_role: 'Management Decision Advisor',
    sort_order: 0
  },
  {
    department_id: 'editorial',
    name: 'Editorial',
    description: 'Perencanaan konten, penulisan naskah arsitektur & hunian berbasis panduan human voice, serta QA editorial.',
    is_available: true,
    is_staffed: true,
    lead_role: 'Editorial QA & Content Writer',
    sort_order: 1
  },
  {
    department_id: 'research_evidence',
    name: 'Research & Evidence',
    description: 'Riset fakta teknis, penelusuran standar bangunan (SNI/literatur), serta kompilasi evidence pack kredibel.',
    is_available: true,
    is_staffed: true,
    lead_role: 'Research & Evidence Specialist',
    sort_order: 2
  },
  {
    department_id: 'media',
    name: 'Media Operations',
    description: 'Manajemen antrean visual LokaMedia, generasi gambar autentik, pemrosesan metadata, dan penyimpanan R2.',
    is_available: true,
    is_staffed: true,
    lead_role: 'Media Operations Specialist',
    sort_order: 3
  },
  {
    department_id: 'publication_operations',
    name: 'Publication Operations',
    description: 'Orkestrasi jadwal tayang, pemantauan safety envelope, kuota harian, serta dispatch publikasi atomic.',
    is_available: true,
    is_staffed: true,
    lead_role: 'Publication Operator',
    sort_order: 4
  },
  {
    department_id: 'engineering_telemetry',
    name: 'Engineering & Telemetry',
    description: 'Observabilitas edge, integritas circuit breaker, serta evaluasi keputusan TypeSafe Jev mode bayangan.',
    is_available: true,
    is_staffed: true,
    lead_role: 'Decision & Telemetry Analyst',
    sort_order: 5
  },
  {
    department_id: 'social',
    name: 'Social & Distribution',
    description: 'Distribusi dan sindikasi konten ke jejaring media sosial (belum tersedia runtime di MC-2).',
    is_available: false,
    is_staffed: false,
    sort_order: 6
  }
];

// ============================================================================
// Canonical Staff Definitions (Initial Baseline)
// ============================================================================

export const CANONICAL_JEFRY_STAFF_DEFINITION: StaffDefinition = {
  agent_id: 'management_advisor_jefry',
  display_name: 'Jefry',
  role: 'Management Decision Advisor',
  department_id: 'management',
  description: 'Penasihat keputusan strategis manajemen berbasis evaluasi TypeSafe JEV (strictly advisory, zero execution authority).',
  avatar_key: 'management_advisor_01',
  capabilities: ['MANAGEMENT_DECISION_ADVISORY'],
  source_system: 'typesafe_jev',
  active: true,
  sort_order: 0
};

const DEFAULT_STAFF_DEFINITIONS: StaffDefinition[] = [
  CANONICAL_JEFRY_STAFF_DEFINITION,
  {
    agent_id: 'content_writer_primary',
    display_name: 'Joko',
    role: 'Content Writer',
    department_id: 'editorial',
    description: 'Penulis naskah artikel utama berbasis bukti dan panduan teknis RancangLoka (anti-slop, human voice layer).',
    avatar_key: 'editorial_writer_01',
    capabilities: ['ARTICLE_WRITING', 'HUMAN_WRITING_AUTHORING'],
    source_system: 'hermes_pipeline',
    active: true,
    sort_order: 1
  },
  {
    agent_id: 'evidence_researcher_lead',
    display_name: 'Irwan',
    role: 'Research & Evidence Specialist',
    department_id: 'research_evidence',
    description: 'Riset fakta teknis, penelusuran standar SNI/literatur konstruksi, dan penyusunan evidence pack terverifikasi.',
    avatar_key: 'research_evidence_01',
    capabilities: ['EVIDENCE_RESEARCH'],
    source_system: 'hermes_research',
    active: true,
    sort_order: 2
  },
  {
    agent_id: 'editorial_qa_primary',
    display_name: 'Rina',
    role: 'Editorial QA',
    department_id: 'editorial',
    description: 'Pemeriksaan kepatuhan redaksional, tone of voice, kelayakan naskah, dan verifikasi checklist First Article Gate.',
    avatar_key: 'editorial_qa_01',
    capabilities: ['EDITORIAL_QA', 'HUMAN_WRITING_QA', 'EDITORIAL_NATURALNESS_REVIEW'],
    source_system: 'hermes_qa',
    active: true,
    sort_order: 3
  },
  {
    agent_id: 'lokamedia_worker_primary',
    display_name: 'Budi',
    role: 'Media Operations',
    department_id: 'media',
    description: 'Operator pekerja media LokaMedia, pipeline generasi visual, serta pengelolaan aset foto Cloudflare R2.',
    avatar_key: 'media_ops_01',
    capabilities: ['MEDIA_OPERATIONS'],
    source_system: 'lokamedia_worker',
    active: true,
    sort_order: 4
  },
  {
    agent_id: 'publication_dispatcher_core',
    display_name: 'Sari',
    role: 'Publication Operator',
    department_id: 'publication_operations',
    description: 'Operator dispatch publikasi, manajemen kuota jadwal terbit, dan pengawasan gerbang keselamatan otomatisasi.',
    avatar_key: 'publication_ops_01',
    capabilities: ['PUBLICATION_OPERATIONS'],
    source_system: 'publication_engine',
    active: true,
    sort_order: 5
  },
  {
    agent_id: 'telemetry_observer_jev',
    display_name: 'Dimas',
    role: 'Telemetry & JEV Systems Operator',
    department_id: 'engineering_telemetry',
    description: 'Operator sistem telemetri edge dan observasi keputusan TypeSafe JEV (strictly shadow mode, zero execution authority; provider health, latency, heartbeat, dan circuit breakers).',
    avatar_key: 'telemetry_01',
    capabilities: ['SYSTEM_TELEMETRY'],
    source_system: 'typesafe_jev',
    active: true,
    sort_order: 6
  }
];

/**
 * Canonical Social Department Staff Member (Milestone: SOCIAL-S2)
 * Maya — Social Content & Distribution Specialist (Shadow / Read-only)
 */
export const CANONICAL_SOCIAL_STAFF_DEFINITION: MissionControlStaffDefinition = {
  agent_id: 'social_distribution_operator',
  display_name: 'Maya',
  role: 'Social Content & Distribution Specialist',
  department_id: 'social',
  description: 'Spesialis kurasi konten visual dan distribusi media sosial RancangLoka (mode shadow / read-only, zero authority).',
  avatar_key: 'social_specialist_01',
  capabilities: [
    'SOCIAL_DISTRIBUTION',
    'SOCIAL_COPY_WRITING',
    'CAROUSEL_CURATION',
    'SOCIAL_QA_SUPPORT',
    'SOCIAL_SCHEDULING_OBSERVATION'
  ],
  source_system: 'social_staging_outbox',
  active: true,
  sort_order: 7
};


// In-memory dynamic staff registry store initialized with defaults
let dynamicStaffStore: Map<string, MissionControlStaffDefinition> = new Map(
  DEFAULT_STAFF_DEFINITIONS.map((s) => [s.agent_id, { ...s }])
);

// Central in-memory registry of display name overrides
let customDisplayNames: Record<string, string> = {};

/**
 * Configure or override staff display names centrally without affecting machine IDs or routing.
 */
export function configureStaffDisplayNames(overrides: Record<string, string>): void {
  customDisplayNames = { ...customDisplayNames, ...overrides };
}

/**
 * Reset staff display names to canonical defaults.
 */
export function resetStaffDisplayNames(): void {
  customDisplayNames = {};
}

/**
 * Register a new staff member dynamically into Mission Control.
 * Throws if agent_id is invalid or already registered.
 */
export function registerStaffMember(definition: MissionControlStaffDefinition): void {
  if (!definition || !definition.agent_id) {
    throw new Error('[StaffRegistry] Staff registration requires a valid agent_id');
  }

  if (dynamicStaffStore.has(definition.agent_id)) {
    throw new Error(`[StaffRegistry] Staff member with ID '${definition.agent_id}' is already registered.`);
  }

  dynamicStaffStore.set(definition.agent_id, {
    ...definition,
    capabilities: definition.capabilities || definition.capability_ids || []
  });
}

/**
 * Unregister a staff member (primarily for testing and dynamic teardown).
 */
export function unregisterStaffMember(agentId: string): boolean {
  return dynamicStaffStore.delete(agentId);
}

/**
 * Reset staff definitions store and display names to canonical defaults.
 */
export function resetStaffRegistry(): void {
  dynamicStaffStore = new Map(DEFAULT_STAFF_DEFINITIONS.map((s) => [s.agent_id, { ...s }]));
  customDisplayNames = {};
}

/**
 * Get active staff definitions with any centrally configured display names applied.
 */
export function getStaffDefinitions(): StaffDefinition[] {
  return Array.from(dynamicStaffStore.values()).map((def) => ({
    ...def,
    display_name: customDisplayNames[def.agent_id] || def.display_name
  }));
}

/**
 * Get a specific staff definition by authoritative machine ID.
 */
export function getStaffDefinitionByAgentId(agentId: string): StaffDefinition | null {
  const definitions = getStaffDefinitions();
  return definitions.find((d) => d.agent_id === agentId) || null;
}

// ============================================================================
// Activity Attribution (Deterministic & Low-Confidence Rules)
// ============================================================================

export interface ActivityAttributionResult {
  attributedAgentId: string | null;
  attributedStaffName: string;
  confidence: 'HIGH' | 'LOW' | 'NONE';
}

/**
 * Deterministically attributes a system activity event to a staff member.
 * If confidence is low or event is generic, returns System / Unassigned.
 */
export function attributeActivityEvent(event: ActivityEvent): ActivityAttributionResult {
  const staff = getStaffDefinitions();
  const getStaffName = (agentId: string) => staff.find((s) => s.agent_id === agentId)?.display_name || agentId;

  if (!event || !event.eventType) {
    return { attributedAgentId: null, attributedStaffName: 'System', confidence: 'NONE' };
  }

  const evType = event.eventType.toUpperCase();
  const sub = String(event.subsystem || '').toLowerCase();

  // 1. Media Operations -> Budi (lokamedia_worker_primary)
  if (sub === 'media' || evType.includes('MEDIA_') || evType.includes('LOKAMEDIA')) {
    return {
      attributedAgentId: 'lokamedia_worker_primary',
      attributedStaffName: getStaffName('lokamedia_worker_primary'),
      confidence: 'HIGH'
    };
  }

  // 2A. Management Advisory Observation -> Jefry (management_advisor_jefry)
  if (evType === 'JEV_ADVISORY_OBSERVATION' || (sub === 'management' && evType.includes('ADVISORY'))) {
    return {
      attributedAgentId: 'management_advisor_jefry',
      attributedStaffName: getStaffName('management_advisor_jefry'),
      confidence: 'HIGH'
    };
  }

  // 2B. Decision / Telemetry -> Dimas (telemetry_observer_jev)
  if (evType === 'JEV_SHADOW_OBSERVATION' || evType.includes('JEV_') || (sub === 'engineering' && evType.includes('DECISION'))) {
    return {
      attributedAgentId: 'telemetry_observer_jev',
      attributedStaffName: getStaffName('telemetry_observer_jev'),
      confidence: 'HIGH'
    };
  }

  // 3. Publication Events -> Sari (publication_dispatcher_core)
  if (
    evType === 'PUBLICATION_CRON_EXECUTION' ||
    evType === 'AUTOMATION_CONTROL_CHANGE' ||
    (evType === 'CIRCUIT_BREAKER_TRANSITION' && event.entityReference?.includes('publisher')) ||
    (sub === 'publication' && (evType.includes('DISPATCH') || evType.includes('SCHEDULE') || evType.includes('PUBLISH')))
  ) {
    return {
      attributedAgentId: 'publication_dispatcher_core',
      attributedStaffName: getStaffName('publication_dispatcher_core'),
      confidence: 'HIGH'
    };
  }

  // 4. Writer-stage Article Events -> Joko (content_writer_primary)
  if (
    evType === 'ARTICLE_DRAFT_INGEST' ||
    evType === 'ARTICLE_WRITING_COMPLETED' ||
    evType.includes('WRITER_') ||
    (sub === 'editorial' && evType.includes('DRAFT_CREATED'))
  ) {
    return {
      attributedAgentId: 'content_writer_primary',
      attributedStaffName: getStaffName('content_writer_primary'),
      confidence: 'HIGH'
    };
  }

  // 5. Evidence & Research Events -> Irwan (evidence_researcher_lead)
  if (sub === 'research' || evType.includes('EVIDENCE_') || evType.includes('RESEARCH_PACK')) {
    return {
      attributedAgentId: 'evidence_researcher_lead',
      attributedStaffName: getStaffName('evidence_researcher_lead'),
      confidence: 'HIGH'
    };
  }

  // 6. QA & Review Events -> Rina (editorial_qa_primary)
  if (
    evType.includes('EDITORIAL_QA') ||
    evType.includes('VALIDATION_PASSED') ||
    evType.includes('FIRST_ARTICLE_GATE') ||
    (sub === 'editorial' && (evType.includes('REVIEW') || evType.includes('QA_CHECK')))
  ) {
    return {
      attributedAgentId: 'editorial_qa_primary',
      attributedStaffName: getStaffName('editorial_qa_primary'),
      confidence: 'HIGH'
    };
  }

  // 7. Social & Distribution Events -> Maya (social_distribution_operator)
  if (sub === 'social' || evType.includes('SOCIAL_') || evType.includes('OUTBOX_')) {
    return {
      attributedAgentId: 'social_distribution_operator',
      attributedStaffName: getStaffName('social_distribution_operator'),
      confidence: 'HIGH'
    };
  }

  // Fallback: low confidence / generic system events
  return {
    attributedAgentId: null,
    attributedStaffName: 'System',
    confidence: 'NONE'
  };
}

// ============================================================================
// Current Task Derivation (Strict Priority & Null Fallback)
// ============================================================================

/**
 * Derives current task for a staff member based on canonical priority:
 * 1. Active / in-progress
 * 2. Blocked / failed
 * 3. Reviewing
 * 4. Latest relevant task
 * If no reliable task exists: returns null. Never invents placeholder tasks.
 */
export function deriveStaffCurrentTask(
  agentId: string,
  snapshot: MissionControlSnapshot | null
): StaffCurrentTask | null {
  if (!snapshot) return null;

  const tasks = snapshot.pipeline?.tasks || [];

  switch (agentId) {
    case 'content_writer_primary': {
      // 1. Active writing task
      const active = tasks.find((t) => t.stage === 'writing');
      if (active) {
        return {
          current_task_id: active.taskId,
          current_task_title: active.title,
          current_task_status: 'IN_PROGRESS',
          current_task_updated_at: active.lastUpdate
        };
      }
      // 2. Blocked writing task
      const blocked = tasks.find((t) => t.subsystem === 'editorial' && t.stage === 'failed' && !t.relatedMediaJobId);
      if (blocked) {
        return {
          current_task_id: blocked.taskId,
          current_task_title: blocked.title,
          current_task_status: 'BLOCKED',
          current_task_updated_at: blocked.lastUpdate
        };
      }
      // 3. Draft in progress (authoring stage)
      const draft = tasks.find((t) => t.stage === 'draft');
      if (draft) {
        return {
          current_task_id: draft.taskId,
          current_task_title: draft.title,
          current_task_status: 'DRAFT',
          current_task_updated_at: draft.lastUpdate
        };
      }
      return null;
    }

    case 'evidence_researcher_lead': {
      // 1. Active researching task
      const active = tasks.find((t) => t.stage === 'researching');
      if (active) {
        return {
          current_task_id: active.taskId,
          current_task_title: active.title,
          current_task_status: 'RESEARCHING',
          current_task_updated_at: active.lastUpdate
        };
      }
      // 2. Blocked research
      const blocked = tasks.find((t) => t.subsystem === 'research' && t.stage === 'failed');
      if (blocked) {
        return {
          current_task_id: blocked.taskId,
          current_task_title: blocked.title,
          current_task_status: 'BLOCKED',
          current_task_updated_at: blocked.lastUpdate
        };
      }
      return null;
    }

    case 'editorial_qa_primary': {
      // 1. Active validating task
      const validating = tasks.find((t) => t.stage === 'validating');
      if (validating) {
        return {
          current_task_id: validating.taskId,
          current_task_title: validating.title,
          current_task_status: 'VALIDATING',
          current_task_updated_at: validating.lastUpdate
        };
      }
      // 2. Blocked QA task
      const blocked = tasks.find((t) => t.stage === 'failed' && (t.blockerOrError?.toLowerCase().includes('qa') || t.blockerOrError?.toLowerCase().includes('gate')));
      if (blocked) {
        return {
          current_task_id: blocked.taskId,
          current_task_title: blocked.title,
          current_task_status: 'BLOCKED',
          current_task_updated_at: blocked.lastUpdate
        };
      }
      // 3. Reviewing task
      const reviewing = tasks.find((t) => t.stage === 'editorial_qa' || t.stage === 'ready_for_review');
      if (reviewing) {
        return {
          current_task_id: reviewing.taskId,
          current_task_title: reviewing.title,
          current_task_status: 'REVIEWING',
          current_task_updated_at: reviewing.lastUpdate
        };
      }
      return null;
    }

    case 'lokamedia_worker_primary': {
      // If media worker is DISABLED, Budi cannot have an active working task
      const isEnabled = snapshot.health?.mediaWorker?.effectiveState === 'ENABLED';
      
      // Blocked media job
      const blocked = tasks.find((t) => t.subsystem === 'media' && (t.stage === 'failed' || t.status === 'FAILED'));

      if (!isEnabled) {
        if (blocked) {
          return {
            current_task_id: blocked.taskId,
            current_task_title: blocked.title,
            current_task_status: 'FAILED',
            current_task_updated_at: blocked.lastUpdate
          };
        }
        const queuedOrStalled = tasks.find((t) => t.subsystem === 'media' || t.stage === 'waiting_media');
        if (queuedOrStalled) {
          return {
            current_task_id: queuedOrStalled.taskId,
            current_task_title: queuedOrStalled.title,
            current_task_status: 'WAITING_WORKER',
            current_task_updated_at: queuedOrStalled.lastUpdate
          };
        }
        return null;
      }

      // 1. Active generating media task (only if worker enabled)
      const active = tasks.find((t) => t.subsystem === 'media' && ['GENERATING', 'IN_PROGRESS', 'LEASED'].includes(t.status.toUpperCase()));
      if (active) {
        return {
          current_task_id: active.taskId,
          current_task_title: active.title,
          current_task_status: active.status,
          current_task_updated_at: active.lastUpdate
        };
      }

      // 2. Blocked media job
      if (blocked) {
        return {
          current_task_id: blocked.taskId,
          current_task_title: blocked.title,
          current_task_status: 'FAILED',
          current_task_updated_at: blocked.lastUpdate
        };
      }

      // 3. Media job in queue waiting
      const queued = tasks.find((t) => t.subsystem === 'media' || t.stage === 'waiting_media');
      if (queued) {
        return {
          current_task_id: queued.taskId,
          current_task_title: queued.title,
          current_task_status: queued.status,
          current_task_updated_at: queued.lastUpdate
        };
      }
      return null;
    }

    case 'publication_dispatcher_core': {
      // 1. Active ingesting task
      const active = tasks.find((t) => t.stage === 'ingesting');
      if (active) {
        return {
          current_task_id: active.taskId,
          current_task_title: active.title,
          current_task_status: 'INGESTING',
          current_task_updated_at: active.lastUpdate
        };
      }
      // 2. Active Cron execution
      const activeCron = snapshot.scheduler?.cloudflareCron?.find((c) => c.status === 'STARTED');
      if (activeCron) {
        return {
          current_task_id: activeCron.runId,
          current_task_title: `Cron: ${activeCron.jobName}`,
          current_task_status: 'RUNNING',
          current_task_updated_at: activeCron.startedAt
        };
      }
      // 3. Blocked task / cron
      const failedCron = snapshot.scheduler?.cloudflareCron?.find((c) => c.status === 'FAILED' || c.status === 'BLOCKED');
      if (failedCron) {
        return {
          current_task_id: failedCron.runId,
          current_task_title: `Cron: ${failedCron.jobName}`,
          current_task_status: failedCron.status,
          current_task_updated_at: failedCron.startedAt
        };
      }
      // 4. Scheduled task
      const scheduled = tasks.find((t) => t.stage === 'scheduled');
      if (scheduled) {
        return {
          current_task_id: scheduled.taskId,
          current_task_title: scheduled.title,
          current_task_status: 'SCHEDULED',
          current_task_updated_at: scheduled.lastUpdate
        };
      }
      return null;
    }

    case 'telemetry_observer_jev': {
      // Dimas monitors shadow decision observations
      const latestObs = snapshot.jev?.latestObservation;
      if (latestObs) {
        return {
          current_task_id: latestObs.observationId,
          current_task_title: `Shadow Evaluation: ${latestObs.decisionPoint}`,
          current_task_status: latestObs.providerStatus,
          current_task_updated_at: latestObs.createdAt
        };
      }
      return null;
    }

    case 'management_advisor_jefry': {
      // Invariant: Jefry does NOT own pipeline execution tasks.
      // Shows latest active JEV advisory evaluation observation context if available.
      const latestObs = snapshot.jev?.latestObservation;
      if (latestObs) {
        return {
          current_task_id: latestObs.observationId,
          current_task_title: `Advisory Evaluation: ${latestObs.decisionPoint}`,
          current_task_status: 'ADVISORY_EVALUATION',
          current_task_updated_at: latestObs.createdAt
        };
      }
      return null;
    }

    case 'social_distribution_operator': {
      // 1. Blocked / Failed social task
      const blockedTask = tasks.find(
        (t) => (t.subsystem === 'social' || (t as any).capability_id?.startsWith('SOCIAL_')) &&
               (t.stage === 'failed' || t.status === 'BLOCKED' || t.status === 'FAILED')
      );
      if (blockedTask) {
        return {
          current_task_id: blockedTask.taskId,
          current_task_title: blockedTask.title,
          current_task_status: 'BLOCKED',
          current_task_updated_at: blockedTask.lastUpdate
        };
      }
      if (snapshot.social && snapshot.social.blockedCampaigns > 0) {
        return {
          current_task_id: snapshot.social.latestCampaign?.campaignId || 'social_blocked',
          current_task_title: `Kampanye Sosial Terblokir [${snapshot.social.latestCampaign?.title || 'Review Required'}]`,
          current_task_status: 'BLOCKED',
          current_task_updated_at: snapshot.social.latestCampaign?.createdAt || new Date().toISOString()
        };
      }

      // 2. Active writing task (draft variant / campaign preparing)
      const writingTask = tasks.find(
        (t) => (t.subsystem === 'social' || (t as any).capability_id === 'SOCIAL_COPY_WRITING' || (t as any).capability_id === 'CAROUSEL_CURATION') &&
               (t.stage === 'writing' || t.stage === 'draft' || t.status === 'DRAFT' || t.status === 'PREPARING')
      );
      if (writingTask) {
        return {
          current_task_id: writingTask.taskId,
          current_task_title: writingTask.title,
          current_task_status: 'DRAFT',
          current_task_updated_at: writingTask.lastUpdate
        };
      }
      if (snapshot.social && (snapshot.social.draftCampaigns > 0 || snapshot.social.activeWorkload?.writingCount > 0)) {
        return {
          current_task_id: snapshot.social.latestCampaign?.campaignId || 'social_draft',
          current_task_title: `Kurasi Konten: ${snapshot.social.latestCampaign?.title || 'Draf Posting Medsos'}`,
          current_task_status: 'DRAFT',
          current_task_updated_at: snapshot.social.latestCampaign?.createdAt || new Date().toISOString()
        };
      }

      // 3. Reviewing / QA task (ready_for_qa / qa_review)
      const reviewingTask = tasks.find(
        (t) => (t.subsystem === 'social' || (t as any).capability_id === 'SOCIAL_QA_SUPPORT') &&
               (t.stage === 'editorial_qa' || t.stage === 'ready_for_review' || t.status === 'READY_FOR_QA' || t.status === 'QA_REVIEW')
      );
      if (reviewingTask) {
        return {
          current_task_id: reviewingTask.taskId,
          current_task_title: reviewingTask.title,
          current_task_status: 'REVIEWING',
          current_task_updated_at: reviewingTask.lastUpdate
        };
      }
      if (snapshot.social && (snapshot.social.variantsAwaitingQa > 0 || snapshot.social.activeWorkload?.reviewingCount > 0)) {
        return {
          current_task_id: 'social_qa_queue',
          current_task_title: `QA Peninjauan Format (${snapshot.social.variantsAwaitingQa} varian)`,
          current_task_status: 'REVIEWING',
          current_task_updated_at: new Date().toISOString()
        };
      }

      // Strict Invariant: Pending approval, scheduled (with automation OFF), or completed do NOT generate active tasks.
      return null;
    }

    default:
      return null;
  }
}

// ============================================================================
// Real State Derivation
// ============================================================================

export interface DerivedStateResult {
  state: StaffOperationalState;
  evidence: string;
}

/**
 * Deterministically derives staff operational state from actual system signals.
 * Guarantees:
 * - Media worker DISABLED never makes Budi appear WORKING.
 * - Publication automation OFF is NOT automatically an error.
 * - JEV remains shadow/advisory; Dimas never has publication authority.
 */
export function deriveStaffState(
  agentId: string,
  snapshot: MissionControlSnapshot | null
): DerivedStateResult {
  if (!snapshot) {
    return {
      state: 'UNKNOWN',
      evidence: 'Data snapshot telemetri tidak tersedia atau belum diinisialisasi.'
    };
  }

  const { health, pipeline, scheduler, jev, articles, media } = snapshot;

  switch (agentId) {
    case 'content_writer_primary': {
      // 1. Offline telemetry check
      if (scheduler?.hermes?.status === 'offline') {
        return {
          state: 'OFFLINE',
          evidence: `Daemon container Hermes liveness berstatus offline (${scheduler.hermes.note || 'Tidak ada detak jantung'}).`
        };
      }
      // 2. Working task check
      const writingTask = pipeline?.tasks?.find((t) => t.stage === 'writing');
      if (writingTask) {
        return {
          state: 'WORKING',
          evidence: `Sedang menulis naskah artikel untuk [${writingTask.title}].`
        };
      }
      if (snapshot.outbox && snapshot.outbox.sending > 0) {
        return {
          state: 'WORKING',
          evidence: `Mengirimkan ${snapshot.outbox.sending} naskah draf ke pipeline penerimaan ingest.`
        };
      }
      // 3. Blocked task check
      const failedAuthoring = pipeline?.tasks?.find((t) => t.subsystem === 'editorial' && t.stage === 'failed' && !t.relatedMediaJobId);
      if (failedAuthoring) {
        return {
          state: 'BLOCKED',
          evidence: `Naskah [${failedAuthoring.title}] terhambat: ${failedAuthoring.blockerOrError || 'Kegagalan penulis'}.`
        };
      }
      // 4. Idle / Unknown
      if (!health || scheduler?.hermes?.status === 'unknown') {
        return {
          state: 'UNKNOWN',
          evidence: 'Bukti telemetri editor belum mencukupi untuk menentukan status.'
        };
      }
      return {
        state: 'IDLE',
        evidence: 'Pipeline penulisan sehat dan siaga; tidak ada draf yang sedang dalam fase penulisan aktif.'
      };
    }

    case 'evidence_researcher_lead': {
      // 1. Offline telemetry
      if (scheduler?.hermes?.status === 'offline') {
        return {
          state: 'OFFLINE',
          evidence: 'Daemon riset Hermes offline.'
        };
      }
      // 2. Working check
      const researchTask = pipeline?.tasks?.find((t) => t.stage === 'researching');
      if (researchTask) {
        return {
          state: 'WORKING',
          evidence: `Sedang menyusun evidence pack dan penelusuran standar SNI untuk [${researchTask.title}].`
        };
      }
      // 3. Blocked check
      const failedResearch = pipeline?.tasks?.find((t) => t.subsystem === 'research' && t.stage === 'failed');
      if (failedResearch) {
        return {
          state: 'BLOCKED',
          evidence: `Riset bukti terhambat: ${failedResearch.blockerOrError || 'Kegagalan kompilasi bukti'}.`
        };
      }
      // 4. Idle / Unknown
      if (!health || scheduler?.hermes?.status === 'unknown') {
        return {
          state: 'UNKNOWN',
          evidence: 'Telemetri riset bukti belum tersedia.'
        };
      }
      return {
        state: 'IDLE',
        evidence: 'Evidence pack dan repositori standar konstruksi siap; tidak ada riset aktif berjalan.'
      };
    }

    case 'editorial_qa_primary': {
      // 1. Offline telemetry
      if (scheduler?.hermes?.status === 'offline') {
        return {
          state: 'OFFLINE',
          evidence: 'Daemon editorial QA Hermes offline.'
        };
      }
      // 2. Working check
      const validatingTask = pipeline?.tasks?.find((t) => t.stage === 'validating');
      if (validatingTask) {
        return {
          state: 'WORKING',
          evidence: `Sedang menjalankan validasi teknis First Article Gate untuk [${validatingTask.title}].`
        };
      }
      // 3. Reviewing check
      const reviewTask = pipeline?.tasks?.find((t) => t.stage === 'editorial_qa' || t.stage === 'ready_for_review');
      if (reviewTask || (articles && articles.awaitingReviewCount > 0)) {
        const count = articles?.awaitingReviewCount || 1;
        return {
          state: 'REVIEWING',
          evidence: `Sedang meninjau kepatuhan editorial (${count} artikel draf menunggu persetujuan review).`
        };
      }
      // 4. Blocked check
      const failedQA = pipeline?.tasks?.find((t) => t.stage === 'failed' && (t.blockerOrError?.toLowerCase().includes('qa') || t.blockerOrError?.toLowerCase().includes('gate')));
      if (failedQA) {
        return {
          state: 'BLOCKED',
          evidence: `Artikel gagal memenuhi First Article Gate: ${failedQA.blockerOrError}.`
        };
      }
      // 5. Idle / Unknown
      if (!health || scheduler?.hermes?.status === 'unknown') {
        return {
          state: 'UNKNOWN',
          evidence: 'Telemetri editorial QA belum tersedia.'
        };
      }
      return {
        state: 'IDLE',
        evidence: 'Antrean pemeriksaan editorial bersih; seluruh draf telah disetujui atau diproses.'
      };
    }

    case 'lokamedia_worker_primary': {
      // Invariant: Media worker DISABLED must NEVER make Budi appear WORKING
      const effectiveState = health?.mediaWorker?.effectiveState || 'DISABLED';
      const activeDevs = health?.mediaWorker?.activeDevicesCount || media?.activeDevicesCount || 0;

      if (effectiveState === 'DISABLED') {
        return {
          state: 'OFFLINE',
          evidence: `Pekerja media nonaktif (DISABLED) - ${activeDevs} perangkat terhubung aktif.`
        };
      }

      // If ENABLED, check breakers and failures
      const mediaBreaker = health?.circuitBreakers?.find((cb) => cb.id.includes('media'));
      if (mediaBreaker && mediaBreaker.state === 'OPEN') {
        return {
          state: 'BLOCKED',
          evidence: `Circuit breaker pekerja media [${mediaBreaker.id}] terbuka: ${mediaBreaker.tripReason || 'Kegagalan berulang'}.`
        };
      }

      const mediaFailed = pipeline?.tasks?.find((t) => t.subsystem === 'media' && t.stage === 'failed');
      if (mediaFailed) {
        return {
          state: 'BLOCKED',
          evidence: `Tugas generasi media [${mediaFailed.title}] gagal: ${mediaFailed.blockerOrError || 'Percobaan habis'}.`
        };
      }

      // Active working jobs check
      const inProgressCount = media?.inProgressJobsCount || 0;
      const activeMediaTask = pipeline?.tasks?.find((t) => t.subsystem === 'media' && ['GENERATING', 'IN_PROGRESS', 'LEASED'].includes(t.status.toUpperCase()));
      if (inProgressCount > 0 || activeMediaTask) {
        return {
          state: 'WORKING',
          evidence: `Sedang memproses ${inProgressCount || 1} pekerjaan generasi media visual aktif.`
        };
      }

      // Queued tasks waiting for device
      const pendingCount = media?.pendingJobsCount || 0;
      if (pendingCount > 0) {
        return {
          state: 'WORKING',
          evidence: `Pekerja media aktif, mengantre ${pendingCount} pekerjaan untuk dialokasikan.`
        };
      }

      return {
        state: 'IDLE',
        evidence: `Pekerja media aktif dan siap (${activeDevs} perangkat terdaftar); antrean visual kosong.`
      };
    }

    case 'publication_dispatcher_core': {
      // Invariant: Publication automation OFF must NOT automatically be labeled an error
      const killSwitchEngaged = Boolean(health?.automation?.killSwitchEngaged);
      if (killSwitchEngaged) {
        return {
          state: 'BLOCKED',
          evidence: `Emergency Kill Switch aktif: ${health?.automation?.killReason || 'Global lock publikasi aktif'}.`
        };
      }

      // Check publisher breaker
      const pubBreaker = health?.circuitBreakers?.find((cb) => cb.id === 'global_publisher');
      if (pubBreaker && pubBreaker.state === 'OPEN') {
        return {
          state: 'BLOCKED',
          evidence: `Circuit breaker global_publisher terbuka: ${pubBreaker.tripReason || 'Kegagalan penulisan D1'}.`
        };
      }

      // Check cron failures
      const cronRuns = scheduler?.cloudflareCron || [];
      const latestCron = cronRuns[0];
      if (latestCron && latestCron.status === 'FAILED') {
        return {
          state: 'BLOCKED',
          evidence: `Eksekusi Cloudflare Cron publikasi terakhir gagal: ${latestCron.errorSummary || 'Kesalahan runner'}.`
        };
      }

      // Working check
      const ingestingTask = pipeline?.tasks?.find((t) => t.stage === 'ingesting');
      if (ingestingTask || (latestCron && latestCron.status === 'STARTED')) {
        return {
          state: 'WORKING',
          evidence: `Sedang melakukan ingest / dispatch publikasi artikel.`
        };
      }

      // Check review queue
      const scheduledTasks = pipeline?.tasks?.filter((t) => t.stage === 'scheduled');
      if (scheduledTasks && scheduledTasks.length > 0) {
        return {
          state: 'REVIEWING',
          evidence: `Memantau ${scheduledTasks.length} artikel terencana dalam jadwal tayang.`
        };
      }

      // Automation mode check (OFF is normal idle dormant state, NOT an error)
      const mode = health?.automation?.mode || 'OFF';
      if (mode === 'OFF') {
        return {
          state: 'IDLE',
          evidence: 'Otomatisasi publikasi nonaktif (Mode OFF / Draft-only); operator dalam status siaga manual.'
        };
      }

      return {
        state: 'IDLE',
        evidence: `Sistem dispatch publikasi beroperasi normal (Mode: ${mode}); tidak ada dispatch yang tertunda.`
      };
    }

    case 'telemetry_observer_jev': {
      // Invariant: JEV remains shadow/advisory; Dimas must NEVER have publication authority
      const providerStatus = health?.jev?.providerStatus || 'UNKNOWN';

      if (providerStatus === 'ERROR') {
        return {
          state: 'BLOCKED',
          evidence: `Provider TypeSafe Jev (OpenRouter) mengalami kesalahan: ${health?.jev?.errorClass || 'Koneksi gagal'}.`
        };
      }

      if (providerStatus === 'UNKNOWN' && (!jev || jev.totalObservationsCount === 0)) {
        return {
          state: 'UNKNOWN',
          evidence: 'Belum ada telemetri observasi bayangan Jev yang tercatat.'
        };
      }

      // Recent active observation check (within 5 minutes = 300s)
      const latestObs = jev?.latestObservation;
      if (latestObs) {
        const obsTime = new Date(latestObs.createdAt).getTime();
        const diffSeconds = (Date.now() - obsTime) / 1000;
        if (diffSeconds >= 0 && diffSeconds <= 300) {
          return {
            state: 'WORKING',
            evidence: `Menganalisis keputusan bayangan di '${latestObs.decisionPoint}' (Latency: ${latestObs.latencyMs}ms; 0 Otoritas Publikasi).`
          };
        }
      }

      return {
        state: 'IDLE',
        evidence: `Pengamat telemetri siaga (Mode: shadow; Provider: ${providerStatus}; Otoritas: none / non-blocking).`
      };
    }

    case 'management_advisor_jefry': {
      // Invariant: Jefry is Management Decision Advisor (ADVISORY_ONLY; zero execution authority)
      const providerStatus = health?.jev?.providerStatus || 'UNKNOWN';
      const isBreakerOpen = health?.circuitBreakers?.some((cb) => cb.state === 'OPEN');

      if (providerStatus === 'ERROR' || isBreakerOpen) {
        return {
          state: 'BLOCKED',
          evidence: `Sistem advisori manajemen terdegradasi (${health?.jev?.errorClass || 'Koneksi provider JEV terganggu atau circuit breaker terbuka'}). Status: DEGRADED.`
        };
      }

      const latestObs = jev?.latestObservation;
      if (latestObs) {
        const obsTime = new Date(latestObs.createdAt).getTime();
        const diffSeconds = (Date.now() - obsTime) / 1000;
        if (diffSeconds >= 0 && diffSeconds <= 300) {
          return {
            state: 'REVIEWING',
            evidence: `Menilai advisori keputusan untuk '${latestObs.decisionPoint}' (Rekomendasi Terderivasi; 0 Otoritas Eksekusi).`
          };
        }
      }

      return {
        state: 'IDLE',
        evidence: 'Decision advisor siaga di Konsol Manajemen (Advisory Only; Otoritas Eksekusi: 0).'
      };
    }

    case 'social_distribution_operator': {
      if (!snapshot || !snapshot.health) {
        return {
          state: 'UNKNOWN',
          evidence: 'Telemetri operasional departemen sosial belum diinisialisasi atau data hilang.'
        };
      }

      const tasks = snapshot.pipeline?.tasks || [];

      // 1. Blocked check
      const blockedTask = tasks.find(
        (t) => (t.subsystem === 'social' || (t as any).capability_id?.startsWith('SOCIAL_')) &&
               (t.stage === 'failed' || t.status === 'BLOCKED' || t.status === 'FAILED')
      );
      if (blockedTask) {
        return {
          state: 'BLOCKED',
          evidence: `Varian atau kampanye sosial terblokir: ${blockedTask.blockerOrError || 'Kegagalan pemrosesan'}.`
        };
      }
      if (snapshot.social && snapshot.social.blockedCampaigns > 0) {
        return {
          state: 'BLOCKED',
          evidence: `Terdapat ${snapshot.social.blockedCampaigns} kampanye sosial yang terblokir.`
        };
      }

      // 2. Working check (writing/drafting copy or curating media)
      const writingTask = tasks.find(
        (t) => (t.subsystem === 'social' || (t as any).capability_id === 'SOCIAL_COPY_WRITING' || (t as any).capability_id === 'CAROUSEL_CURATION') &&
               (t.stage === 'writing' || t.stage === 'draft' || t.status === 'DRAFT' || t.status === 'PREPARING')
      );
      if (writingTask) {
        return {
          state: 'WORKING',
          evidence: `Sedang menyiapkan materi posting sosial untuk [${writingTask.title}].`
        };
      }
      if (snapshot.social && (snapshot.social.draftCampaigns > 0 || snapshot.social.activeWorkload?.writingCount > 0)) {
        return {
          state: 'WORKING',
          evidence: `Sedang menyusun materi konten sosial (${snapshot.social.draftCampaigns} kampanye draf).`
        };
      }

      // 3. Reviewing check (ready_for_qa / reviewing)
      const reviewingTask = tasks.find(
        (t) => (t.subsystem === 'social' || (t as any).capability_id === 'SOCIAL_QA_SUPPORT') &&
               (t.stage === 'editorial_qa' || t.stage === 'ready_for_review' || t.status === 'READY_FOR_QA' || t.status === 'QA_REVIEW')
      );
      if (reviewingTask) {
        return {
          state: 'REVIEWING',
          evidence: `Sedang meninjau kesiapan format dan checklist QA untuk [${reviewingTask.title}].`
        };
      }
      if (snapshot.social && (snapshot.social.variantsAwaitingQa > 0 || snapshot.social.activeWorkload?.reviewingCount > 0)) {
        return {
          state: 'REVIEWING',
          evidence: `Sedang melakukan QA format pada ${snapshot.social.variantsAwaitingQa} varian posting sosial.`
        };
      }

      // 4. Pending Approval & Scheduled check (Strict Invariant: NOT working, maps to IDLE in Lounge)
      if (snapshot.social && (snapshot.social.variantsAwaitingApproval > 0 || snapshot.social.variantsScheduledHeld > 0)) {
        return {
          state: 'IDLE',
          evidence: `Varian posting menunggu persetujuan (${snapshot.social.variantsAwaitingApproval}) atau tertahan di outbox (${snapshot.social.variantsScheduledHeld}) saat SOCIAL_AUTOMATION=OFF; staf siaga di Lounge.`
        };
      }

      // 5. Idle check
      return {
        state: 'IDLE',
        evidence: 'Pipeline sosial siaga operasional dalam mode shadow; tidak ada materi posting yang sedang dipersiapkan.'
      };
    }

    default:
      return {
        state: 'UNKNOWN',
        evidence: 'Identitas mesin tidak terdaftar.'
      };
  }
}

// ============================================================================
// Staff Roster Snapshot Compiler (Read-Only Master Aggregator)
// ============================================================================

/**
 * Compiles full staff roster with real derived operational states and activities.
 * Enforces zero mutations and strict machine/display separation.
 */
export function getStaffRoster(snapshot: MissionControlSnapshot | null): StaffRosterSnapshot {
  const definitions = getStaffDefinitions();
  const activities = Array.isArray(snapshot?.activity)
    ? snapshot.activity
    : (Array.isArray((snapshot?.activity as any)?.events) ? (snapshot?.activity as any).events : []);

  const summary: StaffSummaryCounts = {
    total: definitions.length,
    working: 0,
    idle: 0,
    reviewing: 0,
    blocked: 0,
    offline: 0,
    unknown: 0
  };

  const staffMembers: StaffMemberStatus[] = definitions.map((def) => {
    const { state, evidence } = deriveStaffState(def.agent_id, snapshot);
    const currentTask = deriveStaffCurrentTask(def.agent_id, snapshot);

    // Filter attributed recent activities for this staff member
    const attributedActivities: StaffAttributedActivity[] = [];
    let lastActivityAt: string | null = null;

    for (const event of activities) {
      const attribution = attributeActivityEvent(event);
      if (attribution.attributedAgentId === def.agent_id) {
        if (!lastActivityAt || new Date(event.timestamp).getTime() > new Date(lastActivityAt).getTime()) {
          lastActivityAt = event.timestamp;
        }
        attributedActivities.push({
          eventId: event.eventId,
          timestamp: event.timestamp,
          eventType: event.eventType,
          summary: event.summary,
          severity: event.statusOrSeverity,
          entityReference: event.entityReference
        });
      }
    }

    // Update summary counts
    switch (state) {
      case 'WORKING':
        summary.working++;
        break;
      case 'IDLE':
        summary.idle++;
        break;
      case 'REVIEWING':
        summary.reviewing++;
        break;
      case 'BLOCKED':
        summary.blocked++;
        break;
      case 'OFFLINE':
        summary.offline++;
        break;
      default:
        summary.unknown++;
        break;
    }

    return {
      ...def,
      state,
      state_evidence: evidence,
      current_task: currentTask,
      last_activity_at: lastActivityAt,
      recent_activities: attributedActivities.slice(0, 5)
    };
  });

  return {
    generated_at: new Date().toISOString(),
    summary,
    staff: staffMembers,
    departments: DEPARTMENTS_METADATA
  };
}
