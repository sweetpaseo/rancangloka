/**
 * RancangLoka Hermes Mission Control — Type Definitions
 * Milestone: HERMES-MC-1
 * 
 * Strict Invariants:
 * 1. Read-only data contract.
 * 2. Zero fabricated state — missing telemetry is strictly UNKNOWN or NOT_AVAILABLE.
 * 3. Secret redaction enforced across all display models.
 */

export type FreshnessState = 'FRESH' | 'STALE' | 'UNKNOWN';

export type SubsystemName = 
  | 'editorial'
  | 'research'
  | 'seo'
  | 'media'
  | 'publication'
  | 'engineering'
  | 'system';

export type OverallSystemHealth = 'HEALTHY' | 'DEGRADED' | 'BLOCKED' | 'PAUSED' | 'UNKNOWN';

export interface SystemHealthData {
  overallStatus: OverallSystemHealth;
  automation: {
    mode: 'OFF' | 'OBSERVE_ONLY' | 'PLAN_ONLY' | 'CONTROLLED' | 'UNATTENDED' | 'UNKNOWN';
    killSwitchEngaged: boolean;
    killReason: string | null;
    updatedAt: string | null;
  };
  mediaWorker: {
    dbGate: 'ENABLED' | 'DISABLED' | 'UNKNOWN';
    effectiveState: 'ENABLED' | 'DISABLED' | 'UNKNOWN';
    activeDevicesCount: number;
    reason: string;
  };
  jev: {
    mode: 'shadow' | 'active' | 'unknown';
    authority: 'none' | 'advisory' | 'authoritative';
    providerStatus: 'SUCCESS' | 'ERROR' | 'FALLBACK' | 'UNKNOWN';
    latestObservationId: string | null;
    latestLatencyMs: number | null;
    latestTimestamp: string | null;
    errorClass: string | null;
  };
  circuitBreakers: Array<{
    id: string;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' | 'UNKNOWN';
    failureCount: number;
    failureThreshold: number;
    tripReason: string | null;
    lastFailureAt: string | null;
    lastStateChangeAt: string | null;
  }>;
}

export type TaskStage =
  | 'draft'
  | 'researching'
  | 'writing'
  | 'validating'
  | 'editorial_qa'
  | 'ready_for_ingest'
  | 'ingesting'
  | 'waiting_media'
  | 'ready_for_review'
  | 'scheduled'
  | 'published'
  | 'failed';

export interface TaskCard {
  taskId: string;
  title: string;
  subsystem: SubsystemName;
  status: string;
  stage: TaskStage;
  retryCount: number;
  lastUpdate: string;
  blockerOrError: string | null;
  relatedArticleId?: number | null;
  relatedMediaJobId?: string | null;
  slug?: string;
}

export interface PipelineBoardData {
  tasks: TaskCard[];
  stageCounts: Record<TaskStage, number>;
  totalActiveTasks: number;
}

export interface ActivityEvent {
  eventId: string;
  timestamp: string;
  subsystem: SubsystemName | string;
  eventType: string;
  statusOrSeverity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
  summary: string;
  entityReference: string | null;
}

export interface SchedulerHeartbeatData {
  hermes: {
    status: 'healthy' | 'stale' | 'offline' | 'unknown';
    recordedAt: string | null;
    senderStatus: string | null;
    cycleStatus: string | null;
    freshnessSeconds: number | null;
    note: string;
  };
  cloudflareCron: Array<{
    runId: string;
    jobName: string;
    triggerSource: string;
    status: 'STARTED' | 'SUCCEEDED' | 'BLOCKED' | 'FAILED' | 'UNKNOWN';
    startedAt: string;
    finishedAt: string | null;
    errorSummary: string | null;
  }>;
}

export interface OutboxSummaryData {
  queued: number;
  sending: number;
  acknowledged: number;
  deadLetter: number;
  source: 'd1_receipts' | 'hermes_daemon' | 'unknown';
  lastIngestAt: string | null;
}

export interface ArticleOperationsSummary {
  draftCount: number;
  awaitingReviewCount: number;
  approvedCount: number;
  publishedCount: number;
  quarantinedCount: number;
  latestPublished: {
    id: number;
    title: string;
    slug: string;
    publishedAt: string | null;
  } | null;
  latestApproval: {
    articleId: number;
    chiefEditor: string;
    approvedAt: string;
  } | null;
  latestReceipt: {
    jobId: string;
    articleId: number | null;
    createdAt: string;
  } | null;
}

export interface MediaOperationsSummary {
  effectiveWorkerState: 'DISABLED' | 'ENABLED' | 'UNKNOWN';
  pendingJobsCount: number;
  inProgressJobsCount: number;
  failedJobsCount: number;
  attachedJobsCount: number;
  totalAssetsCount: number;
  activeDevicesCount: number;
  recentEvent: {
    eventId: string;
    jobId: string;
    eventType: string;
    createdAt: string;
  } | null;
}

export interface JevObservabilitySummary {
  mode: 'shadow';
  authority: 'none';
  totalObservationsCount: number;
  agreementRatePercent: number | null;
  latestObservation: {
    observationId: string;
    decisionPoint: string;
    authoritativeDecision: string;
    jevDecision: string | null;
    providerStatus: string;
    latencyMs: number;
    createdAt: string;
  } | null;
  recentObservations: Array<{
    observationId: string;
    decisionPoint: string;
    authoritativeDecision: string;
    jevDecision: string | null;
    disagreementClassification: string;
    providerStatus: string;
    latencyMs: number;
    createdAt: string;
  }>;
}

export interface MissionControlSnapshot {
  generatedAt: string;
  freshness: FreshnessState;
  environment: string;
  health: SystemHealthData;
  pipeline: PipelineBoardData;
  activity: ActivityEvent[];
  scheduler: SchedulerHeartbeatData;
  outbox: OutboxSummaryData;
  articles: ArticleOperationsSummary;
  media: MediaOperationsSummary;
  jev: JevObservabilitySummary;
  staff?: any;
  organization?: any;
  office?: any;
  anomalies?: any;
}
