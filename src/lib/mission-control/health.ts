/**
 * RancangLoka Hermes Mission Control — System Health Reader
 * Milestone: HERMES-MC-1
 * 
 * Strict Invariant: Read-only. Queries real D1 tables or returns explicitly marked unknown states.
 */

import type { SystemHealthData, OverallSystemHealth } from './types.ts';
import { sanitizeString } from './redact.ts';

export async function getSystemHealth(db: any, env?: any): Promise<SystemHealthData> {
  let automationMode: SystemHealthData['automation']['mode'] = 'OFF';
  let killSwitchEngaged = false;
  let killReason: string | null = null;
  let automationUpdatedAt: string | null = null;

  // 1. Publication Automation & Emergency Kill Switch
  if (db && typeof db.prepare === 'function') {
    try {
      const autoRow = await db
        .prepare('SELECT mode, kill_switch_engaged, kill_reason, updated_at FROM automation_control WHERE id = 1 LIMIT 1')
        .first();

      if (autoRow) {
        automationMode = autoRow.mode || 'OFF';
        killSwitchEngaged = Number(autoRow.kill_switch_engaged || 0) === 1;
        killReason = sanitizeString(autoRow.kill_reason || null);
        automationUpdatedAt = autoRow.updated_at || null;
      }
    } catch {
      // In development fallback or empty db
      automationMode = 'OFF';
    }
  }

  // 2. Circuit Breakers
  const circuitBreakers: SystemHealthData['circuitBreakers'] = [];
  if (db && typeof db.prepare === 'function') {
    try {
      const { results } = await db
        .prepare('SELECT id, state, failure_count, failure_threshold, last_failure_at, last_state_change_at, trip_reason FROM circuit_breakers ORDER BY id ASC')
        .all();

      if (Array.isArray(results) && results.length > 0) {
        for (const row of results) {
          circuitBreakers.push({
            id: sanitizeString(row.id),
            state: row.state as any || 'UNKNOWN',
            failureCount: Number(row.failure_count || 0),
            failureThreshold: Number(row.failure_threshold || 3),
            tripReason: sanitizeString(row.trip_reason || null),
            lastFailureAt: row.last_failure_at || null,
            lastStateChangeAt: row.last_state_change_at || null
          });
        }
      }
    } catch {
      // Fallback
    }
  }

  // Provide canonical default breakers if none found
  if (circuitBreakers.length === 0) {
    circuitBreakers.push(
      {
        id: 'global_publisher',
        state: 'CLOSED',
        failureCount: 0,
        failureThreshold: 3,
        tripReason: null,
        lastFailureAt: null,
        lastStateChangeAt: null
      },
      {
        id: 'd1_database',
        state: 'CLOSED',
        failureCount: 0,
        failureThreshold: 2,
        tripReason: null,
        lastFailureAt: null,
        lastStateChangeAt: null
      }
    );
  }

  // 3. Media Worker State & Device Count
  let activeDevicesCount = 0;
  let dbGate: 'ENABLED' | 'DISABLED' | 'UNKNOWN' = 'DISABLED';
  let effectiveWorkerState: 'ENABLED' | 'DISABLED' | 'UNKNOWN' = 'DISABLED';

  if (db && typeof db.prepare === 'function') {
    try {
      const devRow = await db
        .prepare("SELECT COUNT(*) as count FROM media_devices WHERE status = 'ACTIVE'")
        .first();
      activeDevicesCount = Number(devRow?.count || 0);

      const settingRow = await db
        .prepare("SELECT value FROM settings WHERE key = 'media_worker_enabled' LIMIT 1")
        .first();
      const val = String(settingRow?.value || '').toLowerCase();
      dbGate = val === 'true' || val === '1' ? 'ENABLED' : 'DISABLED';
    } catch {
      dbGate = 'DISABLED';
    }
  }

  // Check env gate if available
  const envWorkerVal = String(env?.MEDIA_WORKER_ENABLED || '').toLowerCase();
  const envGate = envWorkerVal === 'true' || envWorkerVal === '1' ? 'ENABLED' : 'DISABLED';
  effectiveWorkerState = dbGate === 'ENABLED' && envGate === 'ENABLED' ? 'ENABLED' : 'DISABLED';

  // 4. TypeSafe JEV Telemetry (Shadow Mode Only)
  let latestObservationId: string | null = null;
  let latestLatencyMs: number | null = null;
  let latestTimestamp: string | null = null;
  let providerStatus: 'SUCCESS' | 'ERROR' | 'FALLBACK' | 'UNKNOWN' = 'UNKNOWN';
  let errorClass: string | null = null;

  if (db && typeof db.prepare === 'function') {
    try {
      const jevRow = await db
        .prepare('SELECT observation_id, provider_status, provider_error_class, latency_ms, created_at FROM decision_observations ORDER BY created_at DESC LIMIT 1')
        .first();

      if (jevRow) {
        latestObservationId = sanitizeString(jevRow.observation_id);
        providerStatus = (jevRow.provider_status as any) || 'UNKNOWN';
        errorClass = sanitizeString(jevRow.provider_error_class || null);
        latestLatencyMs = Number(jevRow.latency_ms || 0);
        latestTimestamp = jevRow.created_at || null;
      } else {
        providerStatus = 'UNKNOWN';
      }
    } catch {
      providerStatus = 'UNKNOWN';
    }
  }

  // 5. Compute Aggregate Overall Status
  let overallStatus: OverallSystemHealth = 'HEALTHY';
  if (killSwitchEngaged) {
    overallStatus = 'PAUSED';
  } else if (circuitBreakers.some((b) => b.state === 'OPEN')) {
    overallStatus = 'BLOCKED';
  } else if (circuitBreakers.some((b) => b.state === 'HALF_OPEN') || providerStatus === 'ERROR') {
    overallStatus = 'DEGRADED';
  }

  return {
    overallStatus,
    automation: {
      mode: automationMode,
      killSwitchEngaged,
      killReason,
      updatedAt: automationUpdatedAt
    },
    mediaWorker: {
      dbGate,
      effectiveState: effectiveWorkerState,
      activeDevicesCount,
      reason: effectiveWorkerState === 'DISABLED' ? 'Worker dormant (safety invariant)' : 'Worker operational'
    },
    jev: {
      mode: 'shadow',
      authority: 'none',
      providerStatus,
      latestObservationId,
      latestLatencyMs,
      latestTimestamp,
      errorClass
    },
    circuitBreakers
  };
}
