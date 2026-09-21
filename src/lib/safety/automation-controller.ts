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
  type ActivationGateResult,
  type AutomationControlAuditRecord,
  type ChangeAutomationModeOptions,
  type ChangeAutomationModeResult,
  type ChangeAutoScheduleOptions,
  type ChangeAutoScheduleResult
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

function generateAuditId(prefix: string): string {
  if (typeof (globalThis as any).crypto?.randomUUID === 'function') {
    return prefix + '_' + (globalThis as any).crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return prefix + '_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

/**
 * 6. Change Automation Mode with Atomic Audit (Phase 5L12B)
 *
 * Canonical operator service to mutate global automation mode.
 * Guarantees:
 * - Strict mode validation (OFF, OBSERVE_ONLY, PLAN_ONLY, CONTROLLED, UNATTENDED)
 * - UNATTENDED requires activation gate pass
 * - Atomic batch execution: control record + automation_control_audit record commit together
 * - Fail-closed: If audit record write fails, mode mutation is rolled back
 * - Idempotent: If target mode === current mode, returns NO_CHANGE (changed = false) without creating audit row
 * - Preserves kill switch, auto_schedule, and pause flags
 */
export async function changeAutomationMode(
  db: any,
  options: ChangeAutomationModeOptions
): Promise<ChangeAutomationModeResult> {
  const {
    targetMode,
    actorId,
    actorRole = 'admin_operator',
    source = 'operator_api',
    reason = null,
    correlationId = null,
    activationPredicates
  } = options;

  if (!AUTOMATION_MODES.includes(targetMode)) {
    return {
      success: false,
      mode: 'OFF',
      previousMode: 'OFF',
      changed: false,
      auditId: null,
      correlationId: correlationId || null,
      reason: `INVALID_MODE: Mode '${targetMode}' is not recognized`
    };
  }

  const currentControl = await getAutomationControl(db);
  const previousMode = currentControl.mode;

  // Idempotent NOOP handling
  if (targetMode === previousMode) {
    return {
      success: true,
      mode: targetMode,
      previousMode,
      changed: false,
      auditId: null,
      correlationId: correlationId || null,
      message: `NO_CHANGE: Mode is already ${targetMode}`
    };
  }

  // Activation Gate evaluation for UNATTENDED
  if (targetMode === 'UNATTENDED') {
    const gateResult = evaluateActivationGate(activationPredicates || {});
    if (!gateResult.unattended_allowed) {
      return {
        success: false,
        mode: previousMode,
        previousMode,
        changed: false,
        auditId: null,
        correlationId: correlationId || null,
        reason: `ACTIVATION_GATE_BLOCKED: ${gateResult.reason}`
      };
    }
  }

  // Generate audit & correlation IDs
  const auditId = generateAuditId('actl');
  const finalCorrelationId = correlationId || generateAuditId('corr');
  const nowIso = new Date().toISOString();

  // Audit secret firewall: sanitize details
  const safeDetails = {
    source,
    actorRole,
    previousMode,
    targetMode
  };

  const updateStmt = db
    .prepare(`
      INSERT INTO automation_control (id, mode, kill_switch_engaged, kill_reason, updated_at, updated_by)
      VALUES (1, ?, 0, NULL, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        mode = excluded.mode,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `)
    .bind(targetMode, nowIso, actorId);

  const auditStmt = db
    .prepare(`
      INSERT INTO automation_control_audit (
        audit_id, event_type, actor_id, actor_role, source,
        previous_value, new_value, reason, correlation_id, details_json, created_at
      ) VALUES (?, 'AUTOMATION_MODE_CHANGED', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      auditId,
      actorId,
      actorRole,
      source,
      previousMode,
      targetMode,
      reason,
      finalCorrelationId,
      JSON.stringify(safeDetails),
      nowIso
    );

  // Atomic batch execution
  await db.batch([updateStmt, auditStmt]);

  return {
    success: true,
    mode: targetMode,
    previousMode,
    changed: true,
    auditId,
    correlationId: finalCorrelationId,
    message: `Automation mode changed from ${previousMode} to ${targetMode}`
  };
}

/**
 * 7. Change Auto-Schedule with Atomic Audit (Phase 5L12B)
 *
 * Canonical operator service to mutate settings.auto_schedule_enabled.
 * Guarantees:
 * - Atomic batch execution: settings update + automation_control_audit record commit together
 * - Fail-closed on audit write failure
 * - Idempotent: If target value === current value, returns NO_CHANGE without creating audit row
 * - Preserves mode, kill switch, and pause flags
 */
export async function changeAutoSchedule(
  db: any,
  options: ChangeAutoScheduleOptions
): Promise<ChangeAutoScheduleResult> {
  const {
    enabled,
    actorId,
    actorRole = 'admin_operator',
    source = 'operator_api',
    reason = null,
    correlationId = null
  } = options;

  let currentVal = false;
  try {
    const setting = await db
      .prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled' LIMIT 1")
      .first();
    currentVal = Boolean(setting && (setting.value === 'true' || setting.value === '1'));
  } catch {
    currentVal = false;
  }

  // Idempotent NOOP handling
  if (enabled === currentVal) {
    return {
      success: true,
      enabled,
      previousEnabled: currentVal,
      changed: false,
      auditId: null,
      correlationId: correlationId || null,
      message: `NO_CHANGE: auto_schedule_enabled is already ${enabled}`
    };
  }

  const auditId = generateAuditId('ascd');
  const finalCorrelationId = correlationId || generateAuditId('corr');
  const nowIso = new Date().toISOString();
  const stringVal = enabled ? 'true' : 'false';

  const safeDetails = {
    source,
    actorRole,
    previousValue: currentVal,
    newValue: enabled
  };

  const updateStmt = db
    .prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES ('auto_schedule_enabled', ?, ?)
    `)
    .bind(stringVal, nowIso);

  const auditStmt = db
    .prepare(`
      INSERT INTO automation_control_audit (
        audit_id, event_type, actor_id, actor_role, source,
        previous_value, new_value, reason, correlation_id, details_json, created_at
      ) VALUES (?, 'AUTO_SCHEDULE_CHANGED', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      auditId,
      actorId,
      actorRole,
      source,
      String(currentVal),
      String(enabled),
      reason,
      finalCorrelationId,
      JSON.stringify(safeDetails),
      nowIso
    );

  // Also keep publication_operator_audit updated for backwards compatibility
  const legacyAuditStmt = db
    .prepare(`
      INSERT INTO publication_operator_audit (
        event_type, article_id, plan_id, execution_id,
        actor_id, actor_role, reason, details_json, created_at
      ) VALUES (?, NULL, NULL, NULL, ?, ?, ?, ?, ?)
    `)
    .bind(
      enabled ? 'AUTO_SCHEDULE_ENABLED' : 'AUTO_SCHEDULE_DISABLED',
      actorId,
      actorRole,
      reason,
      JSON.stringify({ auto_schedule_enabled: enabled, source }),
      nowIso
    );

  await db.batch([updateStmt, auditStmt, legacyAuditStmt]);

  return {
    success: true,
    enabled,
    previousEnabled: currentVal,
    changed: true,
    auditId,
    correlationId: finalCorrelationId,
    message: `auto_schedule_enabled changed from ${currentVal} to ${enabled}`
  };
}

/**
 * 8. Retrieve Recent Automation Control Audit Records (Phase 5L12B)
 */
export async function getRecentAutomationControlAudit(
  db: any,
  limit: number = 20
): Promise<AutomationControlAuditRecord[]> {
  const boundedLimit = Math.max(1, Math.min(limit, 100));
  try {
    const res = await db
      .prepare(`
        SELECT id, audit_id, event_type, actor_id, actor_role, source,
               previous_value, new_value, reason, correlation_id, details_json, created_at
        FROM automation_control_audit
        ORDER BY id DESC
        LIMIT ?
      `)
      .bind(boundedLimit)
      .all();
    return res?.results || [];
  } catch {
    return [];
  }
}

