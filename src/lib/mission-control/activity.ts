/**
 * RancangLoka Hermes Mission Control — Activity & Audit Feed Reader
 * Milestone: HERMES-MC-1
 * 
 * Strict Invariant: Read-only. Consolidates real chronological events from D1 without fabricating activity.
 */

import type { ActivityEvent } from './types.ts';
import { sanitizeString } from './redact.ts';

export async function getActivityFeed(db: any, limit = 30): Promise<ActivityEvent[]> {
  const events: ActivityEvent[] = [];

  if (!db || typeof db.prepare !== 'function') {
    return [];
  }

  // 1. Automation Control Audit
  try {
    const { results } = await db
      .prepare('SELECT id, audit_id, event_type, actor_id, previous_value, new_value, reason, created_at FROM automation_control_audit ORDER BY id DESC LIMIT 15')
      .all();

    if (Array.isArray(results)) {
      for (const row of results) {
        events.push({
          eventId: sanitizeString(row.audit_id || `audit_auto_${row.id}`),
          timestamp: row.created_at || new Date().toISOString(),
          subsystem: 'publication',
          eventType: sanitizeString(row.event_type || 'AUTOMATION_CONTROL_CHANGE'),
          statusOrSeverity: row.new_value === 'UNATTENDED' ? 'WARNING' : 'INFO',
          summary: sanitizeString(
            `Automation '${row.event_type}': ${row.previous_value} -> ${row.new_value} by ${row.actor_id}${row.reason ? ` (${row.reason})` : ''}`
          ),
          entityReference: `event:${row.event_type}`
        });
      }
    }
  } catch {
    // Audit table may be empty or unmigrated in dev
  }

  // 2. Circuit Breaker Transition Events
  try {
    const { results } = await db
      .prepare('SELECT id, breaker_id, from_state, to_state, reason, created_at FROM circuit_breaker_events ORDER BY id DESC LIMIT 15')
      .all();

    if (Array.isArray(results)) {
      for (const row of results) {
        const isTrip = row.to_state === 'OPEN';
        events.push({
          eventId: `audit_cb_${row.id}`,
          timestamp: row.created_at || new Date().toISOString(),
          subsystem: 'publication',
          eventType: 'CIRCUIT_BREAKER_TRANSITION',
          statusOrSeverity: isTrip ? 'CRITICAL' : row.to_state === 'HALF_OPEN' ? 'WARNING' : 'SUCCESS',
          summary: sanitizeString(
            `Breaker '${row.breaker_id}' transitioned from ${row.from_state} to ${row.to_state}: ${row.reason || 'Threshold evaluation'}`
          ),
          entityReference: sanitizeString(row.breaker_id)
        });
      }
    }
  } catch {
    // Breaker events may be empty
  }

  // 3. Media Job Events
  try {
    const { results } = await db
      .prepare('SELECT event_id, job_id, event_type, stage, attempt, created_at FROM media_job_events ORDER BY created_at DESC LIMIT 15')
      .all();

    if (Array.isArray(results)) {
      for (const row of results) {
        const isError = row.event_type.includes('ERROR') || row.event_type.includes('FAIL');
        events.push({
          eventId: sanitizeString(row.event_id || `mje_${Math.random()}`),
          timestamp: row.created_at || new Date().toISOString(),
          subsystem: 'media',
          eventType: sanitizeString(row.event_type || 'MEDIA_STAGE_EVENT'),
          statusOrSeverity: isError ? 'WARNING' : 'INFO',
          summary: sanitizeString(`Media stage '${row.stage || 'process'}' event ${row.event_type} (attempt ${row.attempt || 0})`),
          entityReference: sanitizeString(row.job_id)
        });
      }
    }
  } catch {
    // Media job events may be empty
  }

  // 4. Publication Cron Runs
  try {
    const { results } = await db
      .prepare('SELECT run_id, job_name, trigger_source, status, error_summary, started_at FROM publication_cron_runs ORDER BY started_at DESC LIMIT 15')
      .all();

    if (Array.isArray(results)) {
      for (const row of results) {
        const isFail = row.status === 'FAILED';
        const isBlocked = row.status === 'BLOCKED';
        events.push({
          eventId: sanitizeString(row.run_id),
          timestamp: row.started_at || new Date().toISOString(),
          subsystem: 'publication',
          eventType: 'PUBLICATION_CRON_EXECUTION',
          statusOrSeverity: isFail ? 'CRITICAL' : isBlocked ? 'WARNING' : 'SUCCESS',
          summary: sanitizeString(
            `Cron job '${row.job_name}' (${row.trigger_source}) completed with status: ${row.status}${row.error_summary ? ` - ${row.error_summary}` : ''}`
          ),
          entityReference: sanitizeString(row.job_name)
        });
      }
    }
  } catch {
    // Cron runs table may be empty
  }

  // 5. Decision Observations (JEV Shadow Mode)
  try {
    const { results } = await db
      .prepare('SELECT observation_id, decision_point, authoritative_decision, provider_status, created_at FROM decision_observations ORDER BY created_at DESC LIMIT 10')
      .all();

    if (Array.isArray(results)) {
      for (const row of results) {
        const isFallback = row.provider_status === 'FALLBACK';
        events.push({
          eventId: sanitizeString(row.observation_id),
          timestamp: row.created_at || new Date().toISOString(),
          subsystem: 'engineering',
          eventType: 'JEV_SHADOW_OBSERVATION',
          statusOrSeverity: isFallback ? 'WARNING' : 'INFO',
          summary: sanitizeString(
            `JEV shadow observation at '${row.decision_point}' - Authoritative decision: ${row.authoritative_decision} (Provider: ${row.provider_status})`
          ),
          entityReference: sanitizeString(row.observation_id)
        });
      }
    }
  } catch {
    // Decision observations may be empty
  }

  // Sort descending by timestamp
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events.slice(0, limit);
}
