/**
 * RancangLoka Hermes Mission Control — Systematic Debugging Engine for Dimas
 * Milestone: SKILL-ADOPTION-MILESTONE-1
 *
 * Implements:
 * 1. 4-Phase Root Cause Debugging Protocol (Investigation -> Pattern Analysis -> Hypothesis -> Fix & Verification)
 * 2. Invariant: NO FIX BEFORE ROOT CAUSE INVESTIGATION
 * 3. Dimas Ownership: investigator_agent_id is strictly 'telemetry_observer_jev'
 * 4. Zero Publishing Authority: publishing_authority is strictly 0
 * 5. Full regression verification gate before transition to RESOLVED
 */

export type InvestigationPhaseState =
  | 'ROOT_CAUSE_INVESTIGATION'
  | 'HYPOTHESIS_TESTING'
  | 'FIX_VERIFICATION'
  | 'RESOLVED';

export interface ReproductionContract {
  command_or_script: string;
  is_deterministic: boolean;
  failure_observed: string;
}

export interface TestedHypothesisContract {
  test_description: string;
  result: 'CONFIRMED' | 'DISPROVED';
  notes: string;
}

export interface MinimalFixContract {
  target_files: string[];
  rationale: string;
  status: 'NOT_STARTED' | 'PROPOSED' | 'IMPLEMENTED' | 'VERIFIED';
}

export interface RegressionVerificationContract {
  repro_passed: boolean;
  typecheck_passed: boolean;
  build_passed: boolean;
  suites_verified: string[];
}

export interface SystematicInvestigationRecord {
  investigation_id: string;
  anomaly_id?: string | null;
  created_at: string;
  updated_at: string;
  investigator_agent_id: 'telemetry_observer_jev';
  subsystem: string;
  problem: string;
  reproduction: ReproductionContract;
  observed_evidence: string[];
  candidate_cause?: string | null;
  tested_hypothesis?: TestedHypothesisContract | null;
  confirmed_root_cause?: string | null;
  minimal_fix?: MinimalFixContract | null;
  regression_verification?: RegressionVerificationContract | null;
  status: InvestigationPhaseState;
  publishing_authority: 0;
}

// In-memory store of active and completed investigations
const investigationStore: Map<string, SystematicInvestigationRecord> = new Map();

/**
 * Creates a new systematic investigation record starting strictly in Phase 1 (ROOT_CAUSE_INVESTIGATION).
 */
export function createInvestigationRecord(params: {
  investigation_id: string;
  anomaly_id?: string | null;
  subsystem: string;
  problem: string;
  reproduction: ReproductionContract;
  observed_evidence: string[];
}): SystematicInvestigationRecord {
  if (!params.problem || params.problem.trim().length === 0) {
    throw new Error('[SystematicDebugging] Problem description is required');
  }
  if (!params.reproduction || !params.reproduction.command_or_script) {
    throw new Error('[SystematicDebugging] Phase 1 requires a valid reproduction command or tight feedback loop');
  }

  const record: SystematicInvestigationRecord = {
    investigation_id: params.investigation_id,
    anomaly_id: params.anomaly_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    investigator_agent_id: 'telemetry_observer_jev',
    subsystem: params.subsystem,
    problem: params.problem,
    reproduction: { ...params.reproduction },
    observed_evidence: [...params.observed_evidence],
    candidate_cause: null,
    tested_hypothesis: null,
    confirmed_root_cause: null,
    minimal_fix: null,
    regression_verification: null,
    status: 'ROOT_CAUSE_INVESTIGATION',
    publishing_authority: 0
  };

  investigationStore.set(record.investigation_id, record);
  return record;
}

/**
 * Records a hypothesis test in Phase 3 (HYPOTHESIS_TESTING).
 */
export function recordHypothesisTest(
  investigationId: string,
  candidateCause: string,
  hypothesis: TestedHypothesisContract
): SystematicInvestigationRecord {
  const record = investigationStore.get(investigationId);
  if (!record) {
    throw new Error(`[SystematicDebugging] Investigation '${investigationId}' not found`);
  }

  record.candidate_cause = candidateCause;
  record.tested_hypothesis = { ...hypothesis };
  record.updated_at = new Date().toISOString();

  if (hypothesis.result === 'CONFIRMED') {
    record.confirmed_root_cause = candidateCause;
    record.status = 'HYPOTHESIS_TESTING';
  } else {
    record.confirmed_root_cause = null;
    // Remains in root cause investigation if hypothesis was disproved
    record.status = 'ROOT_CAUSE_INVESTIGATION';
  }

  return record;
}

/**
 * Proposes a minimal fix in Phase 4 (FIX_VERIFICATION).
 * Strictly enforces THE IRON LAW: NO FIX BEFORE ROOT CAUSE INVESTIGATION.
 */
export function proposeMinimalFix(
  investigationId: string,
  fix: { target_files: string[]; rationale: string }
): SystematicInvestigationRecord {
  const record = investigationStore.get(investigationId);
  if (!record) {
    throw new Error(`[SystematicDebugging] Investigation '${investigationId}' not found`);
  }

  // The Iron Law enforcement:
  if (!record.confirmed_root_cause || !record.tested_hypothesis || record.tested_hypothesis.result !== 'CONFIRMED') {
    throw new Error(
      `[SystematicDebugging] VIOLATION OF THE IRON LAW: Cannot propose a fix before root cause investigation and hypothesis confirmation.`
    );
  }

  record.minimal_fix = {
    target_files: [...fix.target_files],
    rationale: fix.rationale,
    status: 'PROPOSED'
  };
  record.status = 'FIX_VERIFICATION';
  record.updated_at = new Date().toISOString();

  return record;
}

/**
 * Verifies the fix against the reproduction loop, typecheck, build, and regressions.
 * Enforces that all verification steps pass before resolving.
 */
export function verifyAndResolveInvestigation(
  investigationId: string,
  verification: RegressionVerificationContract
): SystematicInvestigationRecord {
  const record = investigationStore.get(investigationId);
  if (!record) {
    throw new Error(`[SystematicDebugging] Investigation '${investigationId}' not found`);
  }

  if (record.status !== 'FIX_VERIFICATION') {
    throw new Error(
      `[SystematicDebugging] Cannot verify and resolve an investigation that has not reached FIX_VERIFICATION stage (current: ${record.status})`
    );
  }

  record.regression_verification = { ...verification };
  record.updated_at = new Date().toISOString();

  const isAllPassed =
    verification.repro_passed &&
    verification.typecheck_passed &&
    verification.build_passed &&
    verification.suites_verified.length > 0;

  if (!isAllPassed) {
    throw new Error(
      `[SystematicDebugging] VERIFICATION_FAILED: All verification gates (reproduction, typecheck, build, regression suites) must pass before resolution.`
    );
  }

  if (record.minimal_fix) {
    record.minimal_fix.status = 'VERIFIED';
  }
  record.status = 'RESOLVED';

  return record;
}

/**
 * Retrieves an investigation record by ID.
 */
export function getInvestigationRecord(investigationId: string): SystematicInvestigationRecord | null {
  return investigationStore.get(investigationId) || null;
}

/**
 * Resets the in-memory investigation store (for test suite cleanup).
 */
export function resetInvestigationStore(): void {
  investigationStore.clear();
}
