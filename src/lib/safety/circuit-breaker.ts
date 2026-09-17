/**
 * RancangLoka — Deterministic Circuit Breaker Engine
 * Milestone: SOAK-0
 * 
 * Implements bounded thresholds, fail-closed transitions, probe trials,
 * and auditable transition logging for publication and subsystem mutations.
 */

import {
  type BreakerState,
  type CircuitBreakerRecord,
  type CircuitBreakerTransitionEvent
} from './safety-types.ts';

export const DEFAULT_BREAKER_THRESHOLDS = {
  PUBLISHER_CONSECUTIVE_FAILURES: 3,
  D1_CONSECUTIVE_FAILURES: 2,
  CANONICAL_CONFLICTS: 1,
  STALE_BACKLOG_SURGE: 5,
  REQUIRED_PROBE_SUCCESSES: 2
};

/**
 * 1. Get or Initialize Circuit Breaker State
 */
export async function getCircuitBreaker(
  db: any,
  breakerId: string = 'global_publisher',
  defaultThreshold: number = DEFAULT_BREAKER_THRESHOLDS.PUBLISHER_CONSECUTIVE_FAILURES
): Promise<CircuitBreakerRecord> {
  const row = await db
    .prepare('SELECT id, state, failure_count, failure_threshold, last_failure_at, last_state_change_at, trip_reason, probe_success_count, probe_required_successes FROM circuit_breakers WHERE id = ? LIMIT 1')
    .bind(breakerId)
    .first();

  if (!row) {
    const nowIso = new Date().toISOString();
    return {
      id: breakerId,
      state: 'CLOSED',
      failure_count: 0,
      failure_threshold: defaultThreshold,
      last_failure_at: null,
      last_state_change_at: nowIso,
      trip_reason: null,
      probe_success_count: 0,
      probe_required_successes: DEFAULT_BREAKER_THRESHOLDS.REQUIRED_PROBE_SUCCESSES
    };
  }

  return {
    id: row.id,
    state: row.state as BreakerState,
    failure_count: Number(row.failure_count || 0),
    failure_threshold: Number(row.failure_threshold || defaultThreshold),
    last_failure_at: row.last_failure_at || null,
    last_state_change_at: row.last_state_change_at,
    trip_reason: row.trip_reason || null,
    probe_success_count: Number(row.probe_success_count || 0),
    probe_required_successes: Number(row.probe_required_successes || DEFAULT_BREAKER_THRESHOLDS.REQUIRED_PROBE_SUCCESSES)
  };
}

/**
 * 2. Record Breaker Failure & Determine State Transition
 */
export async function recordBreakerFailure(
  db: any,
  breakerId: string,
  reason: string,
  actor: string = 'system',
  threshold?: number
): Promise<CircuitBreakerRecord> {
  const current = await getCircuitBreaker(db, breakerId, threshold);
  const nowIso = new Date().toISOString();
  const nextFailureCount = current.failure_count + 1;
  const failureThreshold = threshold !== undefined ? threshold : current.failure_threshold;

  let nextState: BreakerState = current.state;
  let tripReason = current.trip_reason;

  if (current.state === 'HALF_OPEN') {
    // Failure during probe returns immediately to OPEN
    nextState = 'OPEN';
    tripReason = `PROBE_FAILED: ${reason}`;
  } else if (current.state === 'CLOSED' && nextFailureCount >= failureThreshold) {
    // Threshold reached -> TRIP to OPEN
    nextState = 'OPEN';
    tripReason = `THRESHOLD_EXCEEDED: ${reason} (failures: ${nextFailureCount}/${failureThreshold})`;
  }

  // Update circuit_breakers table
  await db
    .prepare(`
      INSERT INTO circuit_breakers (
        id, state, failure_count, failure_threshold, last_failure_at, 
        last_state_change_at, trip_reason, probe_success_count, probe_required_successes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      ON CONFLICT(id) DO UPDATE SET
        state = excluded.state,
        failure_count = excluded.failure_count,
        failure_threshold = excluded.failure_threshold,
        last_failure_at = excluded.last_failure_at,
        last_state_change_at = CASE WHEN excluded.state != circuit_breakers.state THEN excluded.last_state_change_at ELSE circuit_breakers.last_state_change_at END,
        trip_reason = excluded.trip_reason,
        probe_success_count = 0
    `)
    .bind(
      breakerId,
      nextState,
      nextFailureCount,
      failureThreshold,
      nowIso,
      nowIso,
      tripReason,
      current.probe_required_successes
    )
    .run();

  // Log transition if changed
  if (nextState !== current.state) {
    await recordBreakerEvent(db, {
      breaker_id: breakerId,
      from_state: current.state,
      to_state: nextState,
      reason: tripReason || reason,
      timestamp: nowIso,
      actor
    });
  }

  return getCircuitBreaker(db, breakerId);
}

/**
 * 3. Record Breaker Success (for Probe & Health)
 */
export async function recordBreakerSuccess(
  db: any,
  breakerId: string,
  actor: string = 'system'
): Promise<CircuitBreakerRecord> {
  const current = await getCircuitBreaker(db, breakerId);
  const nowIso = new Date().toISOString();

  if (current.state === 'HALF_OPEN') {
    const nextSuccessCount = current.probe_success_count + 1;
    if (nextSuccessCount >= current.probe_required_successes) {
      // Required probe successes achieved -> CLOSE breaker
      await db
        .prepare(`
          UPDATE circuit_breakers
          SET state = 'CLOSED',
              failure_count = 0,
              probe_success_count = 0,
              trip_reason = NULL,
              last_state_change_at = ?
          WHERE id = ?
        `)
        .bind(nowIso, breakerId)
        .run();

      await recordBreakerEvent(db, {
        breaker_id: breakerId,
        from_state: 'HALF_OPEN',
        to_state: 'CLOSED',
        reason: `Probe successful (${nextSuccessCount}/${current.probe_required_successes} consecutive successes)`,
        timestamp: nowIso,
        actor
      });
    } else {
      await db
        .prepare(`
          UPDATE circuit_breakers
          SET probe_success_count = ?
          WHERE id = ?
        `)
        .bind(nextSuccessCount, breakerId)
        .run();
    }
  } else if (current.state === 'CLOSED' && current.failure_count > 0) {
    // Reset intermittent failure counter
    await db
      .prepare(`
        UPDATE circuit_breakers
        SET failure_count = 0
        WHERE id = ?
      `)
      .bind(breakerId)
      .run();
  }

  return getCircuitBreaker(db, breakerId);
}

/**
 * 4. Manual or Supervised Reset / Transition to HALF_OPEN
 */
export async function resetBreakerToHalfOpen(
  db: any,
  breakerId: string,
  reason: string = 'Supervised operator probe',
  actor: string = 'operator'
): Promise<CircuitBreakerRecord> {
  const current = await getCircuitBreaker(db, breakerId);
  const nowIso = new Date().toISOString();

  if (current.state !== 'OPEN') {
    return current;
  }

  await db
    .prepare(`
      UPDATE circuit_breakers
      SET state = 'HALF_OPEN',
          probe_success_count = 0,
          last_state_change_at = ?,
          trip_reason = ?
      WHERE id = ?
    `)
    .bind(nowIso, `HALF_OPEN_PROBE: ${reason}`, breakerId)
    .run();

  await recordBreakerEvent(db, {
    breaker_id: breakerId,
    from_state: 'OPEN',
    to_state: 'HALF_OPEN',
    reason,
    timestamp: nowIso,
    actor
  });

  return getCircuitBreaker(db, breakerId);
}

/**
 * 5. Record Auditable Transition Event
 */
export async function recordBreakerEvent(
  db: any,
  event: CircuitBreakerTransitionEvent
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO circuit_breaker_events (breaker_id, from_state, to_state, reason, created_at, actor)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(event.breaker_id, event.from_state, event.to_state, event.reason, event.timestamp, event.actor)
    .run();
}
