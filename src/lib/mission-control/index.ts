/**
 * RancangLoka Hermes Mission Control — Master Data Layer Aggregator
 * Milestone: HERMES-MC-1
 * 
 * Strict Invariants:
 * 1. Read-only data access. No database mutations or commands executed.
 * 2. Real telemetry only. Missing data explicitly mapped to UNKNOWN.
 * 3. Token and secret redaction applied.
 */

import type { MissionControlSnapshot } from './types.ts';
import { getSystemHealth } from './health.ts';
import { getPipelineBoard } from './tasks.ts';
import { getActivityFeed } from './activity.ts';
import { getSchedulerHeartbeat } from './scheduler.ts';
import {
  getOutboxSummary,
  getArticleOperationsSummary,
  getMediaOperationsSummary,
  getJevObservabilitySummary
} from './summaries.ts';
import { getStaffRoster } from './staff-registry.ts';
import { getOrganizationSnapshot } from './department-registry.ts';
import { getPixelOfficeState } from './pixel-office.ts';

export * from './types.ts';
export * from './redact.ts';
export * from './health.ts';
export * from './tasks.ts';
export * from './activity.ts';
export * from './scheduler.ts';
export * from './summaries.ts';
export * from './staff-registry.ts';
export * from './department-registry.ts';
export * from './pixel-office.ts';

export async function getMissionControlSnapshot(db: any, env?: any): Promise<MissionControlSnapshot> {
  const [
    health,
    pipeline,
    activity,
    scheduler,
    outbox,
    articles,
    media,
    jev
  ] = await Promise.all([
    getSystemHealth(db, env),
    getPipelineBoard(db),
    getActivityFeed(db, 30),
    getSchedulerHeartbeat(db, env),
    getOutboxSummary(db, env),
    getArticleOperationsSummary(db),
    getMediaOperationsSummary(db),
    getJevObservabilitySummary(db)
  ]);

  // Determine Overall Freshness
  let freshness: MissionControlSnapshot['freshness'] = 'FRESH';
  if (scheduler.hermes.status === 'stale') {
    freshness = 'STALE';
  } else if (scheduler.hermes.status === 'unknown' && !db) {
    freshness = 'UNKNOWN';
  }

  const snapshot: MissionControlSnapshot = {
    generatedAt: new Date().toISOString(),
    freshness,
    environment: env?.ENVIRONMENT || 'production',
    health,
    pipeline,
    activity,
    scheduler,
    outbox,
    articles,
    media,
    jev
  };

  // Derive staff roster deterministically from snapshot
  snapshot.staff = getStaffRoster(snapshot);

  // Derive organization snapshot deterministically from snapshot
  snapshot.organization = getOrganizationSnapshot(snapshot);

  // Derive pixel office state deterministically from snapshot
  snapshot.office = getPixelOfficeState(snapshot);

  return snapshot;
}
