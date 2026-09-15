/**
 * RancangLoka — SOAK-0 Safety, Automation Control, and Health Types
 * Milestone: SOAK-0
 * 
 * Formal state machines, interfaces, and contracts for:
 * - Global Automation Mode Controller
 * - Global Emergency Kill Switch
 * - Activation Gate
 * - Circuit Breaker Pattern
 * - Activation Rate Limiting & Overdue Burst Protection
 * - Consolidated Run Ledger Read Model
 * - Subsystem Health Model
 */

// ==========================================
// 1. GLOBAL AUTOMATION MODE
// ==========================================

export const AUTOMATION_MODES = [
  'OFF',
  'OBSERVE_ONLY',
  'PLAN_ONLY',
  'CONTROLLED',
  'UNATTENDED'
] as const;

export type AutomationMode = typeof AUTOMATION_MODES[number];

export interface AutomationControlRecord {
  id: number;
  mode: AutomationMode;
  kill_switch_engaged: number; // 0 or 1
  kill_reason: string | null;
  updated_at: string;
  updated_by: string;
}

export interface AutomationCapabilityMatrix {
  canObserve: boolean;
  canPlan: boolean;
  canScheduleControlled: boolean;
  canPublishUnattended: boolean;
  canMutateArticle: boolean; // Always FALSE by design
}

// ==========================================
// 2. HEALTH MODEL
// ==========================================

export const HEALTH_STATUSES = [
  'HEALTHY',
  'DEGRADED',
  'BLOCKED',
  'NO_WORK',
  'PAUSED'
] as const;

export type HealthStatus = typeof HEALTH_STATUSES[number];

export interface SubsystemHealth {
  status: HealthStatus;
  details?: Record<string, any>;
  reason_code?: string;
  timestamp: string;
}

export interface CentralHealthReport {
  timestamp: string;
  overall_status: HealthStatus;
  automation_mode: AutomationMode;
  kill_switch_engaged: boolean;
  circuit_breaker: {
    state: BreakerState;
    failures_recorded: number;
  };
  subsystems: {
    hermes_bridge: SubsystemHealth;
    browser_inspector: SubsystemHealth;
    orchestrator: SubsystemHealth;
    outbox_sender: SubsystemHealth;
    loka_media: SubsystemHealth;
    readiness_gate: SubsystemHealth;
    planner: SubsystemHealth;
    publisher: SubsystemHealth;
    feedback_observer: SubsystemHealth;
    overall_automation: SubsystemHealth;
  };
}

// ==========================================
// 3. CIRCUIT BREAKER
// ==========================================

export const BREAKER_STATES = [
  'CLOSED',
  'OPEN',
  'HALF_OPEN'
] as const;

export type BreakerState = typeof BREAKER_STATES[number];

export interface CircuitBreakerRecord {
  id: string; // e.g. 'global_publisher', 'd1_database'
  state: BreakerState;
  failure_count: number;
  failure_threshold: number;
  last_failure_at: string | null;
  last_state_change_at: string;
  trip_reason: string | null;
  probe_success_count: number;
  probe_required_successes: number;
}

export interface CircuitBreakerTransitionEvent {
  breaker_id: string;
  from_state: BreakerState;
  to_state: BreakerState;
  reason: string;
  timestamp: string;
  actor: string;
}

// ==========================================
// 4. ACTIVATION RATE LIMITER & CATCH-UP
// ==========================================

export interface ActivationSafetyEnvelope {
  maxPublishesPer24h: number;     // e.g. 2
  minSpacingHours: number;        // e.g. 4.0
  maxConcurrentPublishes: number; // 1
  maxCatchUpPerRun: number;       // 1
  staleExecutionThresholdHours: number; // 48
}

export interface OverdueProcessingSummary {
  overdueCount: number;
  admittedExecutionId: string | null;
  rescheduledExecutionIds: string[];
  supersededExecutionIds: string[];
  skippedDueToRateLimit: boolean;
}

// ==========================================
// 5. ACTIVATION GATE PREDICATES
// ==========================================

export interface ActivationGatePredicates {
  orch_recovery_pass: boolean;
  restart_safe_bridge_pass: boolean;
  pub0_frozen: boolean;
  pub1_frozen: boolean;
  pub2_frozen: boolean;
  pub3_production_install_pass: boolean;
  pub3_first_genuine_live_observation_pass: boolean;
  soak_pass: boolean;
  global_kill_switch_pass: boolean;
  circuit_breaker_pass: boolean;
  overall_health_acceptable: boolean;
  no_unexplained_residue: boolean;
}

export interface ActivationGateResult {
  unattended_allowed: boolean;
  predicates: ActivationGatePredicates;
  failing_predicates: string[];
  reason: string;
}

// ==========================================
// 6. FIRST GENUINE ARTICLE GATE
// ==========================================

export interface FirstGenuineArticlePreflight {
  production_health_ok: boolean;
  automation_mode_controlled: boolean;
  kill_switch_disengaged: boolean;
  circuit_breakers_closed: boolean;
  article_editorial_guards_pass: boolean;
  content_hash_verified: boolean;
  media_validated: boolean;
  approval_verified: boolean;
  readiness_ready_to_schedule: boolean;
  plan_active: boolean;
  canonical_conflict_free: boolean;
  publisher_ready: boolean;
  production_cron_disabled: boolean;
}

export interface FirstGenuineArticleGateResult {
  status: 'READY' | 'HOLD';
  reasons: string[];
  preflight: FirstGenuineArticlePreflight;
}

// ==========================================
// 7. CONSOLIDATED RUN LEDGER READ MODEL
// ==========================================

export interface RunLedgerEntry {
  correlation_id: string; // primary correlation key
  topic: string | null;
  orchestration_job_id: string | null;
  evidence_hash: string | null;
  outbox_job_id: string | null;
  ingest_request_id: string | null;
  ingest_receipt_id: string | null;
  d1_article_id: string | null;
  article_slug: string | null;
  article_status: string | null;
  media_job_id: string | null;
  media_asset_id: string | null;
  readiness_snapshot_id: string | null;
  readiness_status: string | null;
  editorial_approval_id: string | null;
  plan_id: string | null;
  planned_target_time: string | null;
  execution_id: string | null;
  execution_status: string | null;
  publication_receipt_id: string | null;
  actual_published_at: string | null;
  feedback_observation_id: string | null;
  authoritative_index_state: string | null;
}

// ==========================================
// 8. SOAK RUNNER CONFIG & RESULT
// ==========================================

export interface SoakRunConfig {
  cycleCount: number;
  injectFailures: boolean;
  testCases: string[];
}

export interface SoakRunResult {
  completedCycles: number;
  totalCycleTarget: number;
  success: boolean;
  failedInvariants: string[];
  details: {
    duplicateArticles: number;
    duplicatePublishes: number;
    unexpectedMutations: number;
    secretLeaks: number;
    unexplainedResidue: number;
  };
}
