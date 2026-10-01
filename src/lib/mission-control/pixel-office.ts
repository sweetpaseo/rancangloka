/**
 * RancangLoka Hermes Mission Control — Pixel Office View Model & Spatial Position Registry
 * Milestone: HERMES-MC-4
 * 
 * Strict Invariants:
 * 1. Read-only spatial visualization layer.
 * 2. Visualizes real deterministic Mission Control telemetry — zero simulated or fabricated activity.
 * 3. IDLE staff move to Lounge; WORKING staff appear at department workstation.
 * 4. BLOCKED staff remain at workstation with explicit warning markers.
 * 5. OFFLINE distinguishes intentional disablement (e.g. Media Worker DISABLED) vs telemetry failure.
 * 6. Social room is strictly unstaffed and labeled COMING LATER / NOT AVAILABLE.
 * 7. Position assignments are stable without sprite overlapping.
 * 8. Zero continuous JS loops, no heavy game engines (Phaser/Unity-free).
 */

import type { ActivityEvent, MissionControlSnapshot } from './types.ts';
import {
  type DepartmentId,
  type StaffMemberStatus,
  type StaffOperationalState,
  getStaffRoster
} from './staff-registry.ts';
import {
  type DepartmentHealth,
  getOrganizationSnapshot,
  getRegisteredDepartments,
  getDepartmentDefinition
} from './department-registry.ts';
import {
  type JobAnimationKey,
  type StaffWorkVisualState,
  deriveStaffWorkVisualState,
  getAnimationDefinition
} from './job-animation-registry.ts';
import {
  type TaskHandoffObservation,
  deriveCanonicalHandoffsFromPipeline
} from './task-handoff.ts';

export type OfficeStateReasonCategory =
  | 'ACTIVE_WORK'
  | 'ACTIVE_REVIEW'
  | 'IDLE_STANDBY'
  | 'BLOCKED_ERROR'
  | 'INTENTIONAL_DISABLED'
  | 'TELEMETRY_OFFLINE'
  | 'UNKNOWN';

export interface OfficeStateReason {
  category: OfficeStateReasonCategory;
  summary: string;
  is_intentional: boolean;
}

export interface OfficePosition {
  position_key: string;
  room_key: string;
  label: string;
  x: number; // percentage (0-100) within room
  y: number; // percentage (0-100) within room
}

export interface OfficeStaffSprite {
  agent_id: string;
  display_name: string;
  role: string;
  avatar_key: string;
  department_id: DepartmentId;
  room_key: string;
  position_key: string;
  x: number;
  y: number;
  staff_state: StaffOperationalState;
  state_reason: OfficeStateReason;
  current_task_title: string | null;
  current_task_status: string | null;
  visual_mode: 'ACTIVE' | 'IDLE' | 'REVIEWING' | 'BLOCKED' | 'DIMMED' | 'UNKNOWN';
  warning_level: 'NONE' | 'INFO' | 'WARNING' | 'CRITICAL';
  badge_text: string;
  capabilities: string[];
  last_activity_at: string | null;
  active_anomaly_title?: string | null;
  active_anomaly_severity?: string | null;
  animation_key: JobAnimationKey;
  work_visual_state: StaffWorkVisualState;
  task_label: string | null;
}

export interface OfficeRoom {
  room_key: string;
  title: string;
  subtitle: string;
  zone: string;
  department_id: DepartmentId | 'lounge';
  is_available: boolean;
  occupants: OfficeStaffSprite[];
  health: DepartmentHealth;
  health_evidence: string;
  active_tasks_count: number;
  blockers_count: number;
  active_anomalies_count?: number;
}

export interface PixelOfficeSummary {
  working: number;
  idle: number;
  reviewing: number;
  blocked: number;
  offline: number;
  unknown: number;
  automation_mode: string;
  media_worker: string;
  jev_mode: string;
  kill_switch_engaged: boolean;
}

export interface PixelOfficeState {
  generated_at: string;
  rooms: OfficeRoom[];
  sprites: OfficeStaffSprite[];
  summary: PixelOfficeSummary;
  positions: OfficePosition[];
  recent_activity: ActivityEvent[];
  recent_handoffs: TaskHandoffObservation[];
}

// ============================================================================
// Office Position Registry
// ============================================================================

export const OFFICE_POSITIONS: OfficePosition[] = [
  // Editorial Room Positions
  { position_key: 'editorial_writer_desk', room_key: 'editorial_room', label: 'Meja Penulisan Joko', x: 30, y: 55 },
  { position_key: 'editorial_review_desk', room_key: 'editorial_room', label: 'Meja Review Rina', x: 70, y: 55 },

  // Research Lab Positions
  { position_key: 'research_main_desk', room_key: 'research_lab', label: 'Konsol Riset Irwan', x: 50, y: 55 },

  // Media Room Positions
  { position_key: 'media_console', room_key: 'media_room', label: 'Konsol Media Budi', x: 50, y: 55 },

  // Publication Room Positions
  { position_key: 'publication_console', room_key: 'publication_room', label: 'Konsol Dispatch Sari', x: 50, y: 55 },

  // Operations Room Positions
  { position_key: 'operations_console', room_key: 'operations_room', label: 'Konsol Telemetri Dimas', x: 50, y: 55 },

  // Lounge (Idle Waiting Area) Positions
  { position_key: 'lounge_seat_1', room_key: 'lounge', label: 'Sofa Santai 1', x: 18, y: 40 },
  { position_key: 'lounge_seat_2', room_key: 'lounge', label: 'Sofa Santai 2', x: 34, y: 40 },
  { position_key: 'lounge_seat_3', room_key: 'lounge', label: 'Sofa Santai 3', x: 50, y: 40 },
  { position_key: 'lounge_seat_4', room_key: 'lounge', label: 'Sofa Santai 4', x: 66, y: 40 },
  { position_key: 'lounge_seat_5', room_key: 'lounge', label: 'Meja Kopi Timur', x: 30, y: 75 },
  { position_key: 'lounge_seat_6', room_key: 'lounge', label: 'Meja Kopi Barat', x: 70, y: 75 },

  // Social Bay
  { position_key: 'social_bay_empty', room_key: 'social_room', label: 'Area Distribusi Kosong', x: 50, y: 50 },
  { position_key: 'social_workstation', room_key: 'social_room', label: 'Workstation Distribusi Maya', x: 50, y: 55 }
];

// Department Home Room mapping
export const STAFF_HOME_ROOMS: Record<string, string> = {
  content_writer_primary: 'editorial_room',
  editorial_qa_primary: 'editorial_room',
  evidence_researcher_lead: 'research_lab',
  lokamedia_worker_primary: 'media_room',
  publication_dispatcher_core: 'publication_room',
  telemetry_observer_jev: 'operations_room',
  social_distribution_operator: 'social_room'
};

// Department Workstation Position mapping
export const STAFF_WORKSTATION_POSITIONS: Record<string, string> = {
  content_writer_primary: 'editorial_writer_desk',
  editorial_qa_primary: 'editorial_review_desk',
  evidence_researcher_lead: 'research_main_desk',
  lokamedia_worker_primary: 'media_console',
  publication_dispatcher_core: 'publication_console',
  telemetry_observer_jev: 'operations_console',
  social_distribution_operator: 'social_workstation'
};

// Canonical Dedicated Lounge Idle Seat mapping (Zero Idle Collision)
// Every simultaneously idle canonical staff member has a distinct deterministic seat
export const STAFF_CANONICAL_IDLE_SEATS: Record<string, string> = {
  content_writer_primary: 'lounge_seat_1',      // Joko (Sofa 1)
  telemetry_observer_jev: 'lounge_seat_2',      // Dimas (Sofa 2)
  editorial_qa_primary: 'lounge_seat_3',        // Rina (Armchair W)
  evidence_researcher_lead: 'lounge_seat_4',    // Irwan (Armchair E)
  publication_dispatcher_core: 'lounge_seat_5', // Sari (Stool Barat / Coffee Table 1)
  lokamedia_worker_primary: 'lounge_seat_6',    // Budi (Stool Timur / Coffee Table 2 - if active)
  social_distribution_operator: 'social_workstation' // Maya (Zone S)
};


// ============================================================================
// State Reason Evaluation (Distinguish Intentional Disabled vs Outage)
// ============================================================================

export function evaluateStateReason(
  staff: StaffMemberStatus,
  snapshot: MissionControlSnapshot | null
): OfficeStateReason {
  const { state, agent_id, state_evidence } = staff;

  switch (state) {
    case 'WORKING':
      return {
        category: 'ACTIVE_WORK',
        summary: staff.current_task ? `Mengerjakan: ${staff.current_task.current_task_title}` : state_evidence,
        is_intentional: true
      };

    case 'REVIEWING':
      return {
        category: 'ACTIVE_REVIEW',
        summary: staff.current_task ? `Meninjau: ${staff.current_task.current_task_title}` : state_evidence,
        is_intentional: true
      };

    case 'IDLE':
      return {
        category: 'IDLE_STANDBY',
        summary: 'Siaga operasional di Lounge; tidak ada tugas aktif berjalan.',
        is_intentional: true
      };

    case 'BLOCKED':
      return {
        category: 'BLOCKED_ERROR',
        summary: state_evidence || 'Terhambat oleh kendala teknis atau pemutus sirkuit.',
        is_intentional: false
      };

    case 'OFFLINE': {
      // Check if intentional disabled (e.g. Media worker disabled by setting)
      if (agent_id === 'lokamedia_worker_primary') {
        const isWorkerDisabled = snapshot?.health?.mediaWorker?.effectiveState === 'DISABLED';
        if (isWorkerDisabled) {
          return {
            category: 'INTENTIONAL_DISABLED',
            summary: 'Pekerja media dinonaktifkan secara sengaja oleh pengaturan sistem (settings).',
            is_intentional: true
          };
        }
      }
      return {
        category: 'TELEMETRY_OFFLINE',
        summary: state_evidence || 'Detak jantung daemon container terputus (>600 detik).',
        is_intentional: false
      };
    }

    default:
      return {
        category: 'UNKNOWN',
        summary: 'Data telemetri staf belum mencukupi.',
        is_intentional: false
      };
  }
}

// ============================================================================
// Spatial Placement & Sprite Model Compilation
// ============================================================================

export function deriveSpriteSpatialState(
  staff: StaffMemberStatus,
  loungeIndex: number,
  snapshot: MissionControlSnapshot | null,
  activeAnomalies: any[] = []
): OfficeStaffSprite {
  const deptDef = getDepartmentDefinition(staff.department_id);
  const homeRoom = STAFF_HOME_ROOMS[staff.agent_id] || deptDef?.room_key || 'editorial_room';
  const workPositionKey = STAFF_WORKSTATION_POSITIONS[staff.agent_id] || `${staff.agent_id}_workstation`;
  const stateReason = evaluateStateReason(staff, snapshot);
  const workVisualState = deriveStaffWorkVisualState(staff, snapshot);

  let targetRoomKey = homeRoom;
  let targetPositionKey = workPositionKey;
  let visualMode: OfficeStaffSprite['visual_mode'] = 'ACTIVE';
  let warningLevel: OfficeStaffSprite['warning_level'] = 'NONE';
  let badgeText: string = staff.state;
  let activeAnomTitle: string | null = null;
  let activeAnomSeverity: string | null = null;

  switch (staff.state) {
    case 'IDLE': {
      // Move to Lounge: use dedicated canonical non-overlapping idle seat
      const canonicalSeat = STAFF_CANONICAL_IDLE_SEATS[staff.agent_id];
      if (canonicalSeat) {
        targetPositionKey = canonicalSeat;
        targetRoomKey = canonicalSeat.startsWith('lounge_') ? 'lounge' : homeRoom;
      } else {
        targetRoomKey = 'lounge';
        const seatNumber = (loungeIndex % 6) + 1;
        targetPositionKey = `lounge_seat_${seatNumber}`;
      }
      visualMode = 'IDLE';
      badgeText = 'Di Lounge (Siaga)';
      break;
    }

    case 'WORKING': {
      targetRoomKey = homeRoom;
      targetPositionKey = workPositionKey;
      visualMode = 'ACTIVE';
      badgeText = workVisualState.task_label || 'Bekerja';
      break;
    }

    case 'REVIEWING': {
      targetRoomKey = homeRoom;
      targetPositionKey = staff.agent_id === 'editorial_qa_primary' ? 'editorial_review_desk' : workPositionKey;
      visualMode = 'REVIEWING';
      badgeText = workVisualState.task_label || 'Review Naskah';
      break;
    }

    case 'BLOCKED': {
      targetRoomKey = homeRoom;
      targetPositionKey = workPositionKey;
      visualMode = 'BLOCKED';
      warningLevel = 'CRITICAL';
      badgeText = 'Terblokir';
      break;
    }

    case 'OFFLINE': {
      targetRoomKey = homeRoom;
      targetPositionKey = workPositionKey;
      visualMode = 'DIMMED';
      if (stateReason.category === 'INTENTIONAL_DISABLED') {
        warningLevel = 'NONE';
        badgeText = 'Worker Disabled';
      } else {
        warningLevel = 'WARNING';
        badgeText = 'Offline';
      }
      break;
    }

    default: {
      targetRoomKey = homeRoom;
      targetPositionKey = workPositionKey;
      visualMode = 'UNKNOWN';
      badgeText = 'Unknown';
      break;
    }
  }

  // Active anomaly overlay
  const staffAnom = activeAnomalies.find(
    (a: any) => a.responsible_agent_id === staff.agent_id && a.state === 'OPEN' && !a.expected_condition
  );
  if (staffAnom) {
    activeAnomTitle = staffAnom.title;
    activeAnomSeverity = staffAnom.severity;
    if (staffAnom.severity === 'CRITICAL') {
      warningLevel = 'CRITICAL';
      badgeText = staff.state === 'BLOCKED' ? 'Terblokir' : 'Alarm Kritis';
    } else if (staffAnom.severity === 'ERROR' || staffAnom.severity === 'WARNING') {
      if (warningLevel !== 'CRITICAL') {
        warningLevel = 'WARNING';
        badgeText = staffAnom.title.length > 25 ? `${staffAnom.title.slice(0, 22)}...` : staffAnom.title;
      }
    }
  }

  // Lookup position coordinates
  const pos = OFFICE_POSITIONS.find((p) => p.position_key === targetPositionKey) || {
    x: 50,
    y: 50,
    position_key: targetPositionKey,
    room_key: targetRoomKey,
    label: 'Default'
  };

  return {
    agent_id: staff.agent_id,
    display_name: staff.display_name,
    role: staff.role,
    avatar_key: staff.avatar_key,
    department_id: staff.department_id,
    room_key: targetRoomKey,
    position_key: targetPositionKey,
    x: pos.x,
    y: pos.y,
    staff_state: staff.state,
    state_reason: stateReason,
    current_task_title: staff.current_task?.current_task_title || null,
    current_task_status: staff.current_task?.current_task_status || null,
    visual_mode: visualMode,
    warning_level: warningLevel,
    badge_text: badgeText,
    capabilities: staff.capabilities,
    last_activity_at: staff.last_activity_at,
    active_anomaly_title: activeAnomTitle,
    active_anomaly_severity: activeAnomSeverity,
    animation_key: workVisualState.animation_key,
    work_visual_state: workVisualState,
    task_label: workVisualState.task_label
  };
}

// ============================================================================
// Master Pixel Office Snapshot Assembler
// ============================================================================

export function getPixelOfficeState(
  snapshot: MissionControlSnapshot | null,
  activeAnomalies: any[] = []
): PixelOfficeState {
  const staffRoster = getStaffRoster(snapshot);
  const org = getOrganizationSnapshot(snapshot);

  let idleCount = 0;
  const sprites: OfficeStaffSprite[] = staffRoster.staff.map((s) => {
    let indexForLounge = 0;
    if (s.state === 'IDLE') {
      indexForLounge = idleCount;
      idleCount++;
    }
    return deriveSpriteSpatialState(s, indexForLounge, snapshot, activeAnomalies);
  });

  // Dynamic rooms derived from registered departments + shared lounge
  const registeredDepts = getRegisteredDepartments();
  const roomConfigs: Array<{
    room_key: string;
    title: string;
    subtitle: string;
    zone: string;
    department_id: string;
    is_available: boolean;
  }> = [];

  for (const dept of registeredDepts) {
    // If we've reached departments ordered after operations (or social), ensure lounge is inserted
    if (dept.display_order >= 6 && !roomConfigs.some((r) => r.room_key === 'lounge')) {
      roomConfigs.push({
        room_key: 'lounge',
        title: 'Executive Lounge',
        subtitle: 'Area Rehat & Siaga',
        zone: 'Zone L - Neutral Standby Lounge',
        department_id: 'lounge',
        is_available: true
      });
    }

    roomConfigs.push({
      room_key: dept.room_key,
      title: dept.display_name,
      subtitle: dept.department_id === 'social' && !dept.is_staffed
        ? 'Kapasitas Masa Depan (Unstaffed)'
        : dept.workstation_zone.split(' - ')[1] || dept.description.slice(0, 30),
      zone: dept.workstation_zone,
      department_id: dept.department_id,
      is_available: dept.availability !== 'NOT_AVAILABLE' && dept.is_staffed
    });
  }

  // Ensure lounge is always present if not already added
  if (!roomConfigs.some((r) => r.room_key === 'lounge')) {
    roomConfigs.push({
      room_key: 'lounge',
      title: 'Executive Lounge',
      subtitle: 'Area Rehat & Siaga',
      zone: 'Zone L - Neutral Standby Lounge',
      department_id: 'lounge',
      is_available: true
    });
  }

  const rooms: OfficeRoom[] = roomConfigs.map((cfg) => {
    const occupants = sprites.filter((spr) => spr.room_key === cfg.room_key);
    let health: DepartmentHealth = 'HEALTHY';
    let healthEvidence = 'Ruang rehat siaga operasional; tidak ada beban kerja.';
    let activeTasksCount = 0;
    let blockersCount = 0;

    if (cfg.department_id !== 'lounge') {
      const deptStatus = org.departments.find((d) => d.department_id === cfg.department_id);
      if (deptStatus) {
        health = deptStatus.health;
        healthEvidence = deptStatus.health_evidence;
        activeTasksCount = deptStatus.active_task_count;
        blockersCount = deptStatus.blocked_task_count;
      }
    } else {
      health = occupants.length > 0 ? 'ACTIVE' : 'HEALTHY';
      healthEvidence = `${occupants.length} staf siaga di Lounge.`;
    }

    let activeAnomaliesCount = 0;
    if (cfg.department_id !== 'lounge') {
      const roomAnoms = activeAnomalies.filter(
        (a: any) => a.department_id === cfg.department_id && a.state === 'OPEN' && !a.expected_condition
      );
      activeAnomaliesCount = roomAnoms.length;
    }

    return {
      room_key: cfg.room_key,
      title: cfg.title,
      subtitle: cfg.subtitle,
      zone: cfg.zone,
      department_id: cfg.department_id,
      is_available: cfg.is_available,
      occupants,
      health,
      health_evidence: healthEvidence,
      active_tasks_count: activeTasksCount,
      blockers_count: blockersCount,
      active_anomalies_count: activeAnomaliesCount
    };
  });

  return {
    generated_at: new Date().toISOString(),
    rooms,
    sprites,
    summary: {
      working: staffRoster.summary.working,
      idle: staffRoster.summary.idle,
      reviewing: staffRoster.summary.reviewing,
      blocked: staffRoster.summary.blocked,
      offline: staffRoster.summary.offline,
      unknown: staffRoster.summary.unknown,
      automation_mode: snapshot?.health?.automation?.mode || 'OFF',
      media_worker: snapshot?.health?.mediaWorker?.effectiveState || 'DISABLED',
      jev_mode: snapshot?.health?.jev?.mode || 'shadow',
      kill_switch_engaged: Boolean(snapshot?.health?.automation?.killSwitchEngaged)
    },
    positions: OFFICE_POSITIONS,
    recent_activity: snapshot?.activity?.slice(0, 8) || [],
    recent_handoffs: deriveCanonicalHandoffsFromPipeline(snapshot)
  };
}
