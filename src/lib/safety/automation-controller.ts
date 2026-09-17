/**
 * RancangLoka — Global Automation Controller & Activation Gate
 * Milestone: SOAK-0
 * 
 * Provides deterministic mode management, emergency kill switch control,
 * capability matrix resolution, and strict activation gating.
 */

import {
  type AutomationMode,
  AUTOMATION_MODES,
  type AutomationControlRecord,
  type AutomationCapabilityMatrix,
  type ActivationGatePredicates,
  type ActivationGateResult
} from './safety-types.ts';

/**
 * 1. Deterministic Capability Matrix
 */
export function getCapabilityMatrix(
  mode: AutomationMode,
  killSwitchEngaged: boolean
): AutomationCapabilityMatrix {
  // If kill switch is engaged, NO automated mutations or executions are allowed
  if (killSwitchEngaged) {
    return {
      canObserve: true, // Observation is read-only
      canPlan: false,
      canScheduleControlled: false,
      canPublishUnattended: false,
      canMutateArticle: false // Article body mutation is forbidden permanently
    };
  }

  switch (mode) {
    case 'OFF':
      return {
        canObserve: false,
        canPlan: false,
        canScheduleControlled: false,
        canPublishUnattended: false,
        canMutateArticle: false
      };
    case 'OBSERVE_ONLY':
      return {
        canObserve: true,
        canPlan: false,
        canScheduleControlled: false,
        canPublishUnattended: false,
        canMutateArticle: false
      };
    case 'PLAN_ONLY':
      return {
        canObserve: true,
        canPlan: true,
        canScheduleControlled: false,
        canPublishUnattended: false,
        canMutateArticle: false
      };
    case 'CONTROLLED':
      return {
        canObserve: true,
        canPlan: true,
        canScheduleControlled: true, // Requires explicit operator action
        canPublishUnattended: false,
        canMutateArticle: false
      };
    case 'UNATTENDED':
      return {
        canObserve: true,
        canPlan: true,
        canScheduleControlled: true,
        canPublishUnattended: true,
        canMutateArticle: false
      };
    default:
      // Unknown mode fails closed to OFF semantics
      return {
        canObserve: false,
        canPlan: false,
        canScheduleControlled: false,
        canPublishUnattended: false,
        canMutateArticle: false
      };
  }
}

/**
 * 2. Get Automation Control State
 */
export async function getAutomationControl(db: any): Promise<AutomationControlRecord> {
  let row: any = null;
  try {
    row = await db
      .prepare('SELECT id, mode, kill_switch_engaged, kill_reason, updated_at, updated_by FROM automation_control WHERE id = 1 LIMIT 1')
      .first();
  } catch {
    row = null;
  }

  if (!row) {
    // Default safe state: OFF, kill switch 0
    return {
      id: 1,
      mode: 'OFF',
      kill_switch_engaged: 0,
      kill_reason: null,
      updated_at: new Date().toISOString(),
      updated_by: 'system_default'
    };
  }

  return {
    id: row.id,
    mode: row.mode as AutomationMode,
    kill_switch_engaged: Number(row.kill_switch_engaged || 0),
    kill_reason: row.kill_reason || null,
    updated_at: row.updated_at,
    updated_by: row.updated_by
  };
}

/**
 * 3. Set Automation Mode (with Activation Gate validation)
 */
export async function setAutomationMode(
  db: any,
  targetMode: AutomationMode,
  actor: string = 'operator',
  activationPredicates?: Partial<ActivationGatePredicates>
): Promise<{ success: boolean; mode: AutomationMode; reason?: string }> {
  if (!AUTOMATION_MODES.includes(targetMode)) {
    return {
      success: false,
      mode: 'OFF',
      reason: `INVALID_MODE: Mode '${targetMode}' is not recognized`
    };
  }

  // If attempting to activate UNATTENDED, evaluate Activation Gate
  if (targetMode === 'UNATTENDED') {
    const gateResult = evaluateActivationGate(activationPredicates || {});
    if (!gateResult.unattended_allowed) {
      return {
        success: false,
        mode: 'OFF',
        reason: `ACTIVATION_GATE_BLOCKED: ${gateResult.reason}`
      };
    }
  }

  const nowIso = new Date().toISOString();
  await db
    .prepare(`
      INSERT INTO automation_control (id, mode, kill_switch_engaged, kill_reason, updated_at, updated_by)
      VALUES (1, ?, 0, NULL, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        mode = excluded.mode,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `)
    .bind(targetMode, nowIso, actor)
    .run();

  return {
    success: true,
    mode: targetMode
  };
}

/**
 * 4. Global Emergency Kill Switch
 */
export async function setKillSwitch(
  db: any,
  engaged: boolean,
  reason: string,
  actor: string = 'operator'
): Promise<AutomationControlRecord> {
  const nowIso = new Date().toISOString();
  const engagedInt = engaged ? 1 : 0;

  await db
    .prepare(`
      INSERT INTO automation_control (id, mode, kill_switch_engaged, kill_reason, updated_at, updated_by)
      VALUES (1, 'OFF', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        kill_switch_engaged = excluded.kill_switch_engaged,
        kill_reason = excluded.kill_reason,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `)
    .bind(engagedInt, reason, nowIso, actor)
    .run();

  return getAutomationControl(db);
}

/**
 * 5. Deterministic Activation Gate Evaluation
 * Fails closed if ANY predicate is false or missing.
 */
export function evaluateActivationGate(
  predicates: Partial<ActivationGatePredicates>
): ActivationGateResult {
  const required: ActivationGatePredicates = {
    orch_recovery_pass: Boolean(predicates.orch_recovery_pass),
    restart_safe_bridge_pass: Boolean(predicates.restart_safe_bridge_pass),
    pub0_frozen: Boolean(predicates.pub0_frozen),
    pub1_frozen: Boolean(predicates.pub1_frozen),
    pub2_frozen: Boolean(predicates.pub2_frozen),
    pub3_production_install_pass: Boolean(predicates.pub3_production_install_pass),
    pub3_first_genuine_live_observation_pass: Boolean(predicates.pub3_first_genuine_live_observation_pass),
    soak_pass: Boolean(predicates.soak_pass),
    global_kill_switch_pass: Boolean(predicates.global_kill_switch_pass),
    circuit_breaker_pass: Boolean(predicates.circuit_breaker_pass),
    overall_health_acceptable: Boolean(predicates.overall_health_acceptable),
    no_unexplained_residue: Boolean(predicates.no_unexplained_residue)
  };

  const failing: string[] = [];
  for (const [key, val] of Object.entries(required)) {
    if (!val) {
      failing.push(key);
    }
  }

  if (failing.length > 0) {
    return {
      unattended_allowed: false,
      predicates: required,
      failing_predicates: failing,
      reason: `Failing predicates: ${failing.join(', ')}`
    };
  }

  return {
    unattended_allowed: true,
    predicates: required,
    failing_predicates: [],
    reason: 'All activation predicates passed'
  };
}
