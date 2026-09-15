/**
 * RancangLoka — Adaptive Publication Planner Domain Types & Contracts
 * Milestone: PUBLICATION-1
 */

export const PLANNER_PROFILE_NEW = 'NEW';
export const PLANNER_PROFILE_GROWING = 'GROWING';
export const PLANNER_PROFILE_ESTABLISHED = 'ESTABLISHED';
export const PLANNER_PROFILE_HIGH_AUTHORITY = 'HIGH_AUTHORITY';

export type PlannerProfile =
  | typeof PLANNER_PROFILE_NEW
  | typeof PLANNER_PROFILE_GROWING
  | typeof PLANNER_PROFILE_ESTABLISHED
  | typeof PLANNER_PROFILE_HIGH_AUTHORITY;

export const PLAN_STATUS_UNPLANNED = 'UNPLANNED';
export const PLAN_STATUS_PLANNED = 'PLANNED';
export const PLAN_STATUS_SUPERSEDED = 'SUPERSEDED';
export const PLAN_STATUS_CANCELLED = 'CANCELLED';
export const PLAN_STATUS_BLOCKED = 'BLOCKED';

export type PlanStatus =
  | typeof PLAN_STATUS_UNPLANNED
  | typeof PLAN_STATUS_PLANNED
  | typeof PLAN_STATUS_SUPERSEDED
  | typeof PLAN_STATUS_CANCELLED
  | typeof PLAN_STATUS_BLOCKED;

export const PLANNER_VERSION = '1.0.0';
export const CANONICAL_TIMEZONE = 'Asia/Jakarta';

/**
 * Normalized Telemetry Signals for Future PUBLICATION-3 Integration
 */
export interface IndexHealthSignals {
  domain?: string;
  evaluatedPeriodDays?: number;
  
  // Indexation Performance
  articlesSubmittedCount?: number;
  articlesIndexedCount?: number;
  indexingSuccessRatio?: number; // 0.00 to 1.00
  medianIndexLatencyHours?: number;
  
  // Crawl Health
  sitemapLastCrawledAt?: string | null;
  crawlErrorRate?: number; // 0.00 to 1.00
  
  // Publish/Execution Stability
  publicationErrorRate?: number; // 0.00 to 1.00
  recent5xxRate?: number; // 0.00 to 1.00
  duplicateRate?: number; // 0.00 to 1.00
  qualityFailureRate?: number; // 0.00 to 1.00
  
  // Traffic & Visibility Trends
  searchVisibilityTrend?: 'GROWING' | 'STABLE' | 'DECLINING';
  observedAt?: string;
}

/**
 * Profile Configuration Parameters
 */
export interface ProfileConfig {
  profile: PlannerProfile;
  baseCapacity: number;           // Standard daily target
  maxCeiling: number;             // Configurable safety ceiling
  minCapacity: number;            // Minimum active target
  minSpacingMinutes: number;      // Inter-article spacing
  categorySpacingMinutes: number; // Spacing between articles of same category
  windowStartHour: number;        // Local window start (WIB) e.g. 7
  windowEndHour: number;          // Local window end (WIB) e.g. 22
  maxJitterMinutes: number;       // Jitter limit e.g. 15 min
}

/**
 * Scoring weights for deterministic non-LLM candidate ranking
 */
export interface ScoringWeights {
  wAge: number;         // Weight for FIFO wait time (default: 0.35)
  wOperator: number;    // Weight for operator priority (default: 0.40)
  wBalance: number;     // Weight for taxonomy scarcity (default: 0.25)
  pCannibalism: number; // Penalty for recent topic conflict (default: 50.0)
}

/**
 * Candidate extracted from PUBLICATION-0 READY_TO_SCHEDULE pool
 */
export interface PlannerCandidate {
  articleId: number;
  slug: string;
  title: string;
  categoryId: number;
  categorySlug?: string;
  authorId: number;
  contentHash: string;
  
  // Readiness Provenance
  readinessSnapshotId: number;
  readinessEvaluatedAt: string;
  approvedBy: string;
  approvedAssetId: string;
  
  // Metadata & Diversity
  focusKeyword?: string | null;
  readingTimeMinutes?: number;
  isFeatured?: boolean;
  isTrending?: boolean;
  isSponsored?: boolean;
  
  // Operator Override / Priority (0 to 100)
  operatorPriority?: number;
}

/**
 * Scored Candidate with Deterministic Audit Trail
 */
export interface ScoredCandidate extends PlannerCandidate {
  priorityScore: number;
  scoreBreakdown: {
    ageScore: number;
    operatorScore: number;
    balanceScore: number;
    cannibalismPenalty: number;
  };
  reasonCodes: string[];
}

/**
 * Planned Assignment
 */
export interface PlannedAssignment {
  candidate: ScoredCandidate;
  planId: string;
  slotIndex: number;
  targetPublishAt: string;     // UTC ISO 8601
  targetPublishLocal: string;  // 'YYYY-MM-DD HH:MM:SS WIB'
  timezone: string;           // 'Asia/Jakarta'
  jitterSeconds: number;
  reasonCodes: string[];
}

/**
 * Database Record: article_publication_plans
 */
export interface PublicationPlanRecord {
  id: number;
  plan_id: string;
  article_id: number;
  readiness_id: number;
  content_hash: string;
  featured_asset_id: string;
  target_publish_at: string;
  target_publish_local: string;
  timezone: string;
  plan_status: PlanStatus;
  planner_profile: PlannerProfile;
  planner_version: string;
  priority_score: number;
  slot_index: number;
  jitter_seconds: number;
  reason_codes: string;
  supersedes_plan_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Database Record: publication_planner_runs
 */
export interface PlannerRunRecord {
  id: number;
  run_id: string;
  planner_profile: PlannerProfile;
  planner_version: string;
  target_date: string;
  eligible_count: number;
  planned_count: number;
  deferred_count: number;
  blocked_count: number;
  effective_capacity: number;
  signals_json: string;
  explanations_json: string;
  created_at: string;
}

/**
 * Database Record: publication_plan_events
 */
export interface PlanEventRecord {
  id: number;
  plan_id: string;
  article_id: number;
  event_type: 'CREATED' | 'SUPERSEDED' | 'RESCHEDULED' | 'PRIORITIZED' | 'CANCELLED' | 'BLOCKED';
  actor_type: 'planner' | 'operator';
  actor_id: string;
  details_json: string;
  created_at: string;
}

/**
 * Execution Result of a Planner Run
 */
export interface PlannerExecutionResult {
  runId: string;
  targetDate: string;
  profile: PlannerProfile;
  effectiveCapacity: number;
  eligibleCount: number;
  plannedCount: number;
  deferredCount: number;
  blockedCount: number;
  plans: PlannedAssignment[];
  deferredArticleIds: number[];
  signalsUsed: IndexHealthSignals;
  explanations: Array<{
    articleId: number;
    action: 'PLANNED' | 'DEFERRED' | 'BLOCKED';
    slotIndex?: number;
    targetPublishLocal?: string;
    reasons: string[];
  }>;
}
