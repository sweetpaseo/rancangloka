/**
 * RancangLoka LokaMedia — Execution vs Review State Engine
 *
 * Invariants:
 * 1. SEPARATION OF CONCERNS: In-flight execution locks are strictly decoupled
 *    from review-pending candidates (CAPTURED / RESULT READY).
 * 2. ZERO UNINTENDED PROVIDER LOCK: A passive candidate awaiting human review
 *    must never lock the browser to a specific provider.
 * 3. EXECUTION INTEGRITY: Genuine prompt submission, generation, capturing,
 *    uploading, and checkpoint recovery operations maintain unbroken locks.
 * 4. GRANULAR QUEUE ACCOUNTING: Separates executing, awaiting-review, complete,
 *    failed/rejected, and waiting jobs without breaking backward compatibility.
 */

export const IN_FLIGHT_EXECUTION_STATES = Object.freeze(new Set([
  'SUBMITTING',
  'GENERATING',
  'IMAGE_DETECTED',
  'CAPTURING',
  'UPLOADING',
  'RECOVERING'
]));

export const REVIEW_PENDING_STATES = Object.freeze(new Set([
  'CAPTURED',
  'RESULT_READY'
]));

export const WAITING_QUEUE_STATES = Object.freeze(new Set([
  'QUEUED',
  'WAITING_RETRY'
]));

export const TERMINAL_COMPLETE_STATES = Object.freeze(new Set([
  'COMPLETE',
  'UPLOAD_COMPLETE'
]));

export const FAILED_OR_REJECTED_STATES = Object.freeze(new Set([
  'RESULT_REJECTED',
  'FAILED_TERMINAL',
  'CANCELLED',
  'SUPERSEDED'
]));

/**
 * Authoritative predicate determining whether an active browser provider execution
 * is in-flight and must retain its tab/provider lock.
 *
 * @param {object} state LokaMedia extension state
 * @returns {boolean}
 */
export function isProviderExecutionInFlight(state = {}) {
  if (!state || typeof state !== 'object') return false;

  // 1. Explicit activeRun lock held during active execution cycle
  if (state.locks?.activeRun && state.locks.activeRun.run_id) {
    return true;
  }

  // 2. Explicit providerLock held for a specific running job
  if (state.locks?.providerLock && state.locks.providerLock.jobId && state.locks.providerLock.providerId) {
    return true;
  }

  // 3. Any job in the queue currently in an in-flight execution state
  const jobs = Object.values(state.jobs ?? {});
  for (const job of jobs) {
    const localState = job.local_state ?? job.status;
    if (IN_FLIGHT_EXECUTION_STATES.has(localState)) {
      return true;
    }
  }

  // 4. In-flight single-run gate actively submitting or generating
  const gate = state.phase4bSingleRun;
  if (gate && !gate.completed_at && gate.outcome !== 'complete') {
    if (gate.submission_in_flight || gate.generation_in_flight) {
      return true;
    }
  }

  return false;
}

/**
 * Computes granular queue counters.
 *
 * @param {object} state LokaMedia extension state
 * @returns {object} Granular counters object
 */
export function computeQueueCounters(state = {}) {
  const jobs = Object.values(state?.jobs ?? {});
  let executing = 0;
  let awaitingReview = 0;
  let complete = 0;
  let failedRejected = 0;
  let waiting = 0;

  for (const job of jobs) {
    const s = job.local_state ?? job.status;
    if (IN_FLIGHT_EXECUTION_STATES.has(s)) {
      executing++;
    } else if (REVIEW_PENDING_STATES.has(s)) {
      awaitingReview++;
    } else if (TERMINAL_COMPLETE_STATES.has(s)) {
      complete++;
    } else if (FAILED_OR_REJECTED_STATES.has(s) || job.needs_attention) {
      failedRejected++;
    } else if (WAITING_QUEUE_STATES.has(s)) {
      waiting++;
    }
  }

  return {
    totalJobs: jobs.length,
    active: executing,
    executing,
    awaitingReview,
    complete,
    failedRejected,
    waiting
  };
}
