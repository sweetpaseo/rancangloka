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
  getJevObservabilitySummary,
  getSocialOperationsSummary
} from './summaries.ts';
import {
  getStaffRoster,
  registerStaffMember,
  unregisterStaffMember,
  CANONICAL_SOCIAL_STAFF_DEFINITION
} from './staff-registry.ts';
import {
  getOrganizationSnapshot,
  updateDepartment,
  CANONICAL_SOCIAL_DEPARTMENT_DEFINITION
} from './department-registry.ts';
import { getPixelOfficeState } from './pixel-office.ts';
import { getAnomaliesSnapshot } from './anomalies.ts';
import { getRegisteredCapabilities,
  registerCapability,
  unregisterCapability,
  updateCapability,
  CANONICAL_SOCIAL_CAPABILITIES
} from './capability-registry.ts';
import { getLiveOperationsSnapshot } from './live-operations.ts';

export * from './types.ts';
export * from './redact.ts';
export * from './health.ts';
export * from './tasks.ts';
export * from './activity.ts';
export * from './scheduler.ts';
export * from './summaries.ts';
export * from './capability-registry.ts';
export * from './staff-registry.ts';
export * from './department-registry.ts';
export * from './pixel-office.ts';
export * from './job-animation-registry.ts';
export * from './chat.ts';
export * from './anomalies.ts';
export * from './anomaly-intelligence.ts';
export * from './office-route-graph.ts';
export * from './staff-movement.ts';
export * from './task-handoff.ts';
export * from './job-trace.ts';
export * from './live-operations.ts';
export * from './actions.ts';
export * from './events.ts';

export interface MissionControlOrganization {
  generated_at: string;
  departments: any[];
  staff: any[];
  capabilities: any[];
  rooms: any[];
  summary: any;
  availability: Record<string, string>;
  health: Record<string, string>;
  workload: {
    active_tasks: number;
    blockers: number;
  };
  alerts: {
    active_anomalies: number;
    critical_count: number;
    error_count: number;
  };
}

export function getMissionControlOrganization(
  snapshot: MissionControlSnapshot | null
): MissionControlOrganization {
  const orgSnapshot = getOrganizationSnapshot(snapshot);
  const staffRoster = getStaffRoster(snapshot);
  const capabilities = getRegisteredCapabilities();
  const officeState = getPixelOfficeState(snapshot, snapshot?.anomalies?.active_anomalies || []);
  const anomalies = snapshot?.anomalies;

  const availabilityMap: Record<string, string> = {};
  const healthMap: Record<string, string> = {};

  for (const dept of orgSnapshot.departments) {
    availabilityMap[dept.department_id] = dept.availability;
    healthMap[dept.department_id] = dept.health;
  }

  return {
    generated_at: new Date().toISOString(),
    departments: orgSnapshot.departments,
    staff: staffRoster.staff,
    capabilities,
    rooms: officeState.rooms,
    summary: orgSnapshot.summary,
    availability: availabilityMap,
    health: healthMap,
    workload: {
      active_tasks: orgSnapshot.summary.total_active_tasks,
      blockers: orgSnapshot.summary.total_blockers
    },
    alerts: {
      active_anomalies: anomalies?.open_anomalies_count || 0,
      critical_count: anomalies?.critical_count || 0,
      error_count: anomalies?.error_count || 0
    }
  };
}

/**
 * Activates the Social & Distribution department into SHADOW / READ-ONLY mode.
 * Transitions department availability to AVAILABLE_READ_ONLY, registers Maya (social_distribution_operator),
 * and maps all canonical social capabilities with ZERO execution authority.
 */
export function activateSocialDepartmentShadow(): void {
  // 1. Register Capabilities
  for (const cap of CANONICAL_SOCIAL_CAPABILITIES) {
    try {
      registerCapability(cap);
    } catch {
      updateCapability(cap.capability_id, cap);
    }
  }

  // 2. Register Staff Member Maya
  try {
    registerStaffMember(CANONICAL_SOCIAL_STAFF_DEFINITION);
  } catch {
    // Already registered
  }

  // 3. Update Department state to AVAILABLE_READ_ONLY and staffed
  updateDepartment('social', {
    availability: 'AVAILABLE_READ_ONLY',
    is_staffed: true,
    capabilities: [
      'SOCIAL_DISTRIBUTION',
      'SOCIAL_COPY_WRITING',
      'CAROUSEL_CURATION',
      'SOCIAL_QA_SUPPORT',
      'SOCIAL_SCHEDULING_OBSERVATION'
    ],
    workstation_zone: 'Zone S - Social Operations & Distribution Hub',
    description: 'Departemen distribusi konten sosial, kurasi visual, dan pemantauan terjadwal dalam mode bayangan (SHADOW / Read-Only).'
  });
}

/**
 * Deactivates Social & Distribution shadow mode back to baseline unstaffed state.
 */
export function deactivateSocialDepartmentShadow(): void {
  // 1. Remove Staff Member Maya
  unregisterStaffMember('social_distribution_operator');

  // 2. Remove auxiliary Capabilities and reset base capability
  for (const cap of CANONICAL_SOCIAL_CAPABILITIES) {
    if (cap.capability_id === 'SOCIAL_DISTRIBUTION') {
      try {
        updateCapability('SOCIAL_DISTRIBUTION', {
          operational_availability: 'NOT_AVAILABLE',
          default_agent_id: null,
          command_families: [],
          anomaly_classes: []
        });
      } catch {
        // ignore if not found
      }
    } else {
      unregisterCapability(cap.capability_id);
    }
  }

  // 3. Reset Department to NOT_AVAILABLE and unstaffed
  updateDepartment('social', {
    availability: 'NOT_AVAILABLE',
    is_staffed: false,
    capabilities: ['SOCIAL_DISTRIBUTION'],
    workstation_zone: 'Zone S - Unstaffed Distribution Bay',
    description: 'Departemen distribusi media sosial dan sindikasi multi-kanal (direncanakan).'
  });
}

export async function getMissionControlSnapshot(db: any, env?: any): Promise<MissionControlSnapshot> {
  const [
    health,
    pipeline,
    activity,
    scheduler,
    outbox,
    articles,
    media,
    jev,
    social
  ] = await Promise.all([
    getSystemHealth(db, env),
    getPipelineBoard(db),
    getActivityFeed(db, 30),
    getSchedulerHeartbeat(db, env),
    getOutboxSummary(db, env),
    getArticleOperationsSummary(db),
    getMediaOperationsSummary(db),
    getJevObservabilitySummary(db),
    getSocialOperationsSummary(db, env)
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
    jev,
    social
  };

  // Derive anomalies deterministically (pure read model with zero DB mutations)
  const anomalies = getAnomaliesSnapshot(snapshot);
  snapshot.anomalies = anomalies;

  // Derive staff roster deterministically from snapshot
  snapshot.staff = getStaffRoster(snapshot);

  // Derive organization snapshot deterministically from snapshot
  snapshot.organization = getOrganizationSnapshot(snapshot);

  // Derive pixel office state deterministically from snapshot
  snapshot.office = getPixelOfficeState(snapshot, anomalies.active_anomalies);

  // Derive live operations deterministically from snapshot
  snapshot.live_operations = getLiveOperationsSnapshot(snapshot);

  return snapshot;
}
