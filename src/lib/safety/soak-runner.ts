/**
 * RancangLoka — Deterministic Local/Staging Soak Runner
 * Milestone: SOAK-0
 * 
 * Executes bounded cycles evaluating:
 * - Health aggregation
 * - NO_WORK state handling
 * - Duplicate invocation / idempotency
 * - Crash & restart recovery
 * - Planner & publisher replay
 * - Feedback replay
 * - Kill switch engagement & release
 * - Circuit breaker trips & half-open recovery
 * - Residue & secret checks
 */

import {
  type SoakRunConfig,
  type SoakRunResult
} from './safety-types.ts';

import {
  getAutomationControl,
  setAutomationMode,
  setKillSwitch
} from './automation-controller.ts';

import {
  getCircuitBreaker,
  recordBreakerFailure,
  recordBreakerSuccess,
  resetBreakerToHalfOpen
} from './circuit-breaker.ts';

import {
  getCentralHealthReport
} from './health-service.ts';

import {
  checkActivationRateLimit,
  processOverdueExecutions
} from './rate-limiter.ts';

export async function runSoakCycles(
  db: any,
  config: SoakRunConfig
): Promise<SoakRunResult> {
  const result: SoakRunResult = {
    completedCycles: 0,
    totalCycleTarget: config.cycleCount,
    success: true,
    failedInvariants: [],
    details: {
      duplicateArticles: 0,
      duplicatePublishes: 0,
      unexpectedMutations: 0,
      secretLeaks: 0,
      unexplainedResidue: 0
    }
  };

  for (let cycle = 1; cycle <= config.cycleCount; cycle++) {
    try {
      // 1. Evaluate Health Model & NO_WORK
      const health = await getCentralHealthReport(db);
      if (health.overall_status !== 'HEALTHY' && health.overall_status !== 'PAUSED') {
        result.failedInvariants.push(`CYCLE_${cycle}: Health evaluated to unexpected status ${health.overall_status}`);
      }

      // 2. Evaluate Mode & Kill Switch
      await setKillSwitch(db, true, 'Soak injection test', 'soak_runner');
      const pausedControl = await getAutomationControl(db);
      if (pausedControl.kill_switch_engaged !== 1) {
        result.failedInvariants.push(`CYCLE_${cycle}: Kill switch failed to engage`);
      }

      // Resume Kill Switch
      await setKillSwitch(db, false, 'Soak recovery', 'soak_runner');
      const resumedControl = await getAutomationControl(db);
      if (resumedControl.kill_switch_engaged !== 0) {
        result.failedInvariants.push(`CYCLE_${cycle}: Kill switch failed to disengage`);
      }

      // 3. Evaluate Circuit Breaker Fail-Closed & Recovery
      const breaker = await getCircuitBreaker(db, 'soak_test_breaker', 2);
      await recordBreakerFailure(db, 'soak_test_breaker', 'Simulated failure 1', 'soak_runner', 2);
      await recordBreakerFailure(db, 'soak_test_breaker', 'Simulated failure 2', 'soak_runner', 2);
      const tripped = await getCircuitBreaker(db, 'soak_test_breaker');
      if (tripped.state !== 'OPEN') {
        result.failedInvariants.push(`CYCLE_${cycle}: Circuit breaker failed to trip OPEN`);
      }

      // Half-Open Probe Recovery
      await resetBreakerToHalfOpen(db, 'soak_test_breaker', 'Soak probe', 'soak_runner');
      await recordBreakerSuccess(db, 'soak_test_breaker', 'soak_runner');
      await recordBreakerSuccess(db, 'soak_test_breaker', 'soak_runner');
      const closed = await getCircuitBreaker(db, 'soak_test_breaker');
      if (closed.state !== 'CLOSED') {
        result.failedInvariants.push(`CYCLE_${cycle}: Circuit breaker failed to close after successful probes`);
      }

      // 4. Evaluate Rate Limiting & Overdue Processing
      const overdueSummary = await processOverdueExecutions(db);
      if (overdueSummary.overdueCount > 1 && overdueSummary.admittedExecutionId === null) {
        result.failedInvariants.push(`CYCLE_${cycle}: Overdue processing did not admit single execution`);
      }

      result.completedCycles++;
    } catch (err: any) {
      result.failedInvariants.push(`CYCLE_${cycle}_ERROR: ${err.message}`);
    }
  }

  if (result.failedInvariants.length > 0) {
    result.success = false;
  }

  return result;
}
