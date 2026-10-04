/**
 * RancangLoka Hermes Mission Control — Deterministic Staff Movement Engine
 * Milestone: HERMES-MC-4 / V2.3
 * 
 * Strict Invariants:
 * 1. PRESENTATION ONLY. Zero execution authority. Never mutates D1 or Mission Control truth.
 * 2. NO REAL STATE TRANSITION = NO STAFF MOVEMENT.
 * 3. Initial load & page refresh = direct canonical placement, zero fake journeys.
 * 4. QUEUED tasks stay idle in Lounge; only RUNNING triggers departure.
 * 5. Media Worker DISABLED stays offline; Social Maya stays holding in Zone S.
 * 6. BLOCKED staff remain truthfully at their workstation with warning marker.
 * 7. Rapid changes reroute deterministically from the current node without teleportation.
 * 8. Respects prefers-reduced-motion accessibility rules.
 */

import type { OfficeStaffSprite } from './pixel-office.ts';
import {
  findDeterministicPath,
  deriveFacingDirection,
  getNodeVisualCoordinate,
  type FacingDirection,
  type NodeSpatialCoordinate
} from './office-route-graph.ts';

// ============================================================================
// Types
// ============================================================================

export type StaffMovementMode =
  | 'STATIONARY'
  | 'WALKING_TO_WORK'
  | 'WALKING_TO_LOUNGE'
  | 'REROUTING';

export interface StaffMovementState {
  agent_id: string;
  current_node_id: string;
  target_node_id: string;
  path: string[];
  path_index: number;
  is_moving: boolean;
  movement_mode: StaffMovementMode;
  facing_direction: FacingDirection;
  started_at: number;
  step_duration_ms: number;
}

export interface MovementTransitionPlan {
  agent_id: string;
  action: 'NONE' | 'START_JOURNEY' | 'REROUTE' | 'RECONCILE';
  from_node_id: string;
  to_node_id: string;
  path: string[];
  movement_mode: StaffMovementMode;
  reason: string;
}

// Canonical walking pace: 450ms per edge transition
export const DEFAULT_STEP_DURATION_MS = 450;

// ============================================================================
// Transition Observer & Evaluation
// ============================================================================

/**
 * Evaluates whether a new telemetry update warrants physical staff movement.
 * Fails closed to zero movement whenever real operational justification is absent.
 */
export function evaluateStaffMovementTransition(
  prevSprite: OfficeStaffSprite | null,
  nextSprite: OfficeStaffSprite,
  currentMovement?: StaffMovementState | null,
  isInitialLoad: boolean = false
): MovementTransitionPlan {
  const agentId = nextSprite.agent_id;
  const targetNodeId = nextSprite.position_key;

  // Invariant 1: Initial page load & page reload = direct placement without fake travel
  if (isInitialLoad || !prevSprite) {
    return {
      agent_id: agentId,
      action: 'NONE',
      from_node_id: targetNodeId,
      to_node_id: targetNodeId,
      path: [targetNodeId],
      movement_mode: 'STATIONARY',
      reason: 'Penempatan awal kanonikal (Initial load) — Tanpa animasi fiktif.'
    };
  }

  // Invariant 2: Social / Maya is in Zone S / HOLDING (Zero real task = Zero movement)
  if (agentId === 'social_distribution_operator') {
    return {
      agent_id: agentId,
      action: 'NONE',
      from_node_id: targetNodeId,
      to_node_id: targetNodeId,
      path: [targetNodeId],
      movement_mode: 'STATIONARY',
      reason: 'Zone S dalam status HOLDING / ACCOUNT REQUIRED — Tanpa pergerakan.'
    };
  }

  // Invariant 2B: Jefry is Management Decision Advisor (Stationary at management_decision_console)
  if (agentId === 'management_advisor_jefry') {
    return {
      agent_id: agentId,
      action: 'NONE',
      from_node_id: 'management_decision_console',
      to_node_id: 'management_decision_console',
      path: ['management_decision_console'],
      movement_mode: 'STATIONARY',
      reason: 'Jefry selalu siaga di konsol keputusan manajemen — Tanpa pergerakan koridor.'
    };
  }

  // Invariant 3: Media Worker DISABLED (Budi stays intentionally offline)
  if (agentId === 'lokamedia_worker_primary' && nextSprite.visual_mode === 'DIMMED') {
    return {
      agent_id: agentId,
      action: 'NONE',
      from_node_id: targetNodeId,
      to_node_id: targetNodeId,
      path: [targetNodeId],
      movement_mode: 'STATIONARY',
      reason: 'Media Worker dinonaktifkan secara sengaja — Budi tetap offline.'
    };
  }

  // Invariant 4: QUEUED tasks do NOT trigger travel (staf tetap siaga di Lounge)
  if (nextSprite.current_task_status === 'QUEUED') {
    return {
      agent_id: agentId,
      action: 'NONE',
      from_node_id: currentMovement?.current_node_id || prevSprite.position_key,
      to_node_id: currentMovement?.current_node_id || prevSprite.position_key,
      path: [currentMovement?.current_node_id || prevSprite.position_key],
      movement_mode: 'STATIONARY',
      reason: 'Tugas berstatus QUEUED — Menunggu giliran siaga, belum berjalan.'
    };
  }

  const currentNodeId = currentMovement?.is_moving
    ? currentMovement.current_node_id
    : prevSprite.position_key;

  // Invariant 5: Identical telemetry state = Zero movement (anti-jitter / anti-loop)
  if (
    prevSprite.visual_mode === nextSprite.visual_mode &&
    prevSprite.position_key === nextSprite.position_key &&
    !currentMovement?.is_moving
  ) {
    return {
      agent_id: agentId,
      action: 'NONE',
      from_node_id: targetNodeId,
      to_node_id: targetNodeId,
      path: [targetNodeId],
      movement_mode: 'STATIONARY',
      reason: 'State telemetri identik — Staf tetap pada posisi kanonikal.'
    };
  }

  // Invariant 6: BLOCKED staff remain truthfully at their workstation
  if (nextSprite.visual_mode === 'BLOCKED') {
    // If already at workstation, stay there
    if (currentNodeId === targetNodeId && !currentMovement?.is_moving) {
      return {
        agent_id: agentId,
        action: 'NONE',
        from_node_id: targetNodeId,
        to_node_id: targetNodeId,
        path: [targetNodeId],
        movement_mode: 'STATIONARY',
        reason: 'Tugas terblokir — Staf tetap di meja kerja dengan peringatan kritis.'
      };
    }
  }

  // Invariant 7: If already at destination and not moving, do nothing
  if (currentNodeId === targetNodeId && !currentMovement?.is_moving) {
    return {
      agent_id: agentId,
      action: 'NONE',
      from_node_id: targetNodeId,
      to_node_id: targetNodeId,
      path: [targetNodeId],
      movement_mode: 'STATIONARY',
      reason: 'Staf sudah berada di posisi target.'
    };
  }

  // Mode resolution
  let movementMode: StaffMovementMode = 'WALKING_TO_WORK';
  if (currentMovement?.is_moving) {
    movementMode = 'REROUTING';
  } else if (nextSprite.visual_mode === 'IDLE') {
    movementMode = 'WALKING_TO_LOUNGE';
  }

  // Compute deterministic shortest path
  try {
    const path = findDeterministicPath(currentNodeId, targetNodeId);

    const action = currentMovement?.is_moving ? 'REROUTE' : 'START_JOURNEY';

    return {
      agent_id: agentId,
      action,
      from_node_id: currentNodeId,
      to_node_id: targetNodeId,
      path,
      movement_mode: movementMode,
      reason: `Transisi nyata: ${prevSprite.visual_mode} → ${nextSprite.visual_mode}`
    };
  } catch (err: any) {
    // Fail-safe fallback: if topological path calculation fails, dock cleanly
    return {
      agent_id: agentId,
      action: 'RECONCILE',
      from_node_id: targetNodeId,
      to_node_id: targetNodeId,
      path: [targetNodeId],
      movement_mode: 'STATIONARY',
      reason: `Rekonsiliasi gagal rute: ${err.message}`
    };
  }
}

// ============================================================================
// Movement State Updater (Step Advancement)
// ============================================================================

export function advanceMovementStep(
  state: StaffMovementState
): { updatedState: StaffMovementState; isArrived: boolean } {
  if (!state.is_moving || state.path_index >= state.path.length - 1) {
    return {
      updatedState: {
        ...state,
        is_moving: false,
        movement_mode: 'STATIONARY',
        current_node_id: state.target_node_id
      },
      isArrived: true
    };
  }

  const nextIndex = state.path_index + 1;
  const nextNodeId = state.path[nextIndex];
  const isArrived = nextIndex >= state.path.length - 1;
  const facingDirection = deriveFacingDirection(state.current_node_id, nextNodeId);

  return {
    updatedState: {
      ...state,
      current_node_id: nextNodeId,
      path_index: nextIndex,
      facing_direction: facingDirection,
      is_moving: !isArrived,
      movement_mode: isArrived ? 'STATIONARY' : state.movement_mode
    },
    isArrived
  };
}
