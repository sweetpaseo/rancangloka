/**
 * RancangLoka Hermes Mission Control — Scheduler & Heartbeat Reader
 * Milestone: HERMES-MC-1
 * 
 * Strict Invariants:
 * 1. Read-only. Runs seamlessly on Cloudflare Workers edge runtime (zero Node.js built-ins).
 * 2. Deterministic freshness evaluation:
 *    - <= 300s: healthy
 *    - 301s - 600s: stale
 *    - > 600s: offline
 *    - absent: unknown
 * 3. Never fabricates active daemon state without evidence.
 */

import type { SchedulerHeartbeatData } from './types.ts';
import { sanitizeString } from './redact.ts';

export interface HeartbeatPayload {
  schema_version?: number;
  recorded_at?: string;
  sender_status?: string;
  status?: string;
}

/**
 * Evaluates the freshness of a recorded heartbeat timestamp against canonical thresholds.
 */
export function evaluateHeartbeatFreshness(
  recordedAtIso?: string | null,
  nowMs: number = Date.now()
): {
  status: SchedulerHeartbeatData['hermes']['status'];
  freshnessSeconds: number | null;
  note: string;
} {
  if (!recordedAtIso) {
    return {
      status: 'unknown',
      freshnessSeconds: null,
      note: 'Container daemon heartbeat operates in isolated SumoPod runtime'
    };
  }

  try {
    const timestampMs = new Date(recordedAtIso).getTime();
    if (Number.isNaN(timestampMs)) {
      return {
        status: 'unknown',
        freshnessSeconds: null,
        note: 'Invalid heartbeat timestamp format'
      };
    }

    const diffMs = nowMs - timestampMs;
    const freshnessSeconds = Math.max(0, Math.floor(diffMs / 1000));

    if (freshnessSeconds <= 300) {
      return {
        status: 'healthy',
        freshnessSeconds,
        note: `Daemon active (cycle interval: 120s, beat: ${freshnessSeconds}s ago)`
      };
    }

    if (freshnessSeconds <= 600) {
      return {
        status: 'stale',
        freshnessSeconds,
        note: `Daemon delayed (beat: ${freshnessSeconds}s ago > 300s threshold)`
      };
    }

    return {
      status: 'offline',
      freshnessSeconds,
      note: `Daemon unresponsive (beat: ${freshnessSeconds}s ago > 600s threshold)`
    };
  } catch {
    return {
      status: 'unknown',
      freshnessSeconds: null,
      note: 'Error parsing heartbeat timestamp'
    };
  }
}

export async function getSchedulerHeartbeat(
  db: any,
  env?: any,
  heartbeatOverride?: HeartbeatPayload | null
): Promise<SchedulerHeartbeatData> {
  let recordedAt: string | null = null;
  let senderStatus: string | null = null;
  let cycleStatus: string | null = null;

  // 1. Resolve Heartbeat Payload (from override, env, or edge context)
  let rawPayload: HeartbeatPayload | null = heartbeatOverride || null;

  if (!rawPayload && env?.HERMES_HEARTBEAT_JSON) {
    try {
      rawPayload = typeof env.HERMES_HEARTBEAT_JSON === 'string'
        ? JSON.parse(env.HERMES_HEARTBEAT_JSON)
        : env.HERMES_HEARTBEAT_JSON;
    } catch {
      rawPayload = null;
    }
  }

  if (rawPayload && rawPayload.recorded_at) {
    recordedAt = rawPayload.recorded_at;
    senderStatus = sanitizeString(rawPayload.sender_status || null);
    cycleStatus = sanitizeString(rawPayload.status || null);
  }

  const evaluation = evaluateHeartbeatFreshness(recordedAt);

  // 2. Fetch recent Cloudflare cron executions from D1
  const cloudflareCron: SchedulerHeartbeatData['cloudflareCron'] = [];
  if (db && typeof db.prepare === 'function') {
    try {
      const { results } = await db
        .prepare('SELECT run_id, job_name, trigger_source, status, started_at, finished_at, error_summary FROM publication_cron_runs ORDER BY started_at DESC LIMIT 5')
        .all();

      if (Array.isArray(results)) {
        for (const row of results) {
          cloudflareCron.push({
            runId: sanitizeString(row.run_id),
            jobName: sanitizeString(row.job_name),
            triggerSource: sanitizeString(row.trigger_source),
            status: row.status as any || 'UNKNOWN',
            startedAt: row.started_at,
            finishedAt: row.finished_at || null,
            errorSummary: sanitizeString(row.error_summary || null)
          });
        }
      }
    } catch {
      // Table may be empty
    }
  }

  return {
    hermes: {
      status: evaluation.status,
      recordedAt,
      senderStatus,
      cycleStatus,
      freshnessSeconds: evaluation.freshnessSeconds,
      note: evaluation.note
    },
    cloudflareCron
  };
}
