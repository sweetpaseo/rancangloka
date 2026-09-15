/**
 * RancangLoka — Crawl & Index Feedback Type Definitions
 * Milestone: PUBLICATION-3
 * 
 * Provides type contracts and interfaces for discrete observations,
 * point-in-time snapshots, rolling aggregates, and provider adapters.
 */

import type { IndexHealthSignals } from './planner-types.ts';

export const FEEDBACK_VERSION = '1.0.0';
export const FRESHNESS_TTL_HOURS = 72; // 3 days
export const MIN_COHORT_SAMPLE_SIZE = 5;
export const DEFAULT_OBSERVER_BATCH_SIZE = 25;

// Source Classes
export const SOURCE_CLASS_FIRST_PARTY = 'FIRST_PARTY_RUNTIME';
export const SOURCE_CLASS_SITEMAP = 'SITEMAP_PARSER';
export const SOURCE_CLASS_SEARCH_CONSOLE = 'SEARCH_CONSOLE';
export const SOURCE_CLASS_ANALYTICS = 'ANALYTICS';
export const SOURCE_CLASS_MANUAL = 'MANUAL_OPERATOR';
export const SOURCE_CLASS_FUTURE_ADAPTER = 'FUTURE_ADAPTER';

export type SourceClass =
  | typeof SOURCE_CLASS_FIRST_PARTY
  | typeof SOURCE_CLASS_SITEMAP
  | typeof SOURCE_CLASS_SEARCH_CONSOLE
  | typeof SOURCE_CLASS_ANALYTICS
  | typeof SOURCE_CLASS_MANUAL
  | typeof SOURCE_CLASS_FUTURE_ADAPTER;

// Confidence Classes
export const CONFIDENCE_AUTHORITATIVE = 'AUTHORITATIVE';
export const CONFIDENCE_DIRECT_PROBE = 'DIRECT_PROBE';
export const CONFIDENCE_HEURISTIC = 'HEURISTIC';

export type ConfidenceClass =
  | typeof CONFIDENCE_AUTHORITATIVE
  | typeof CONFIDENCE_DIRECT_PROBE
  | typeof CONFIDENCE_HEURISTIC;

// Observation Types
export const OBS_TYPE_EDGE_STATUS = 'EDGE_STATUS';
export const OBS_TYPE_SITEMAP_PRESENT = 'SITEMAP_PRESENT';
export const OBS_TYPE_INDEX_STATUS = 'INDEX_STATUS';
export const OBS_TYPE_INDEX_LATENCY_HOURS = 'INDEX_LATENCY_HOURS';
export const OBS_TYPE_CANONICAL_MATCH = 'CANONICAL_MATCH';
export const OBS_TYPE_ROBOTS_ALLOWED = 'ROBOTS_ALLOWED';
export const OBS_TYPE_SEARCH_IMPRESSIONS = 'SEARCH_IMPRESSIONS';
export const OBS_TYPE_PUBLIC_5XX_COUNT = 'PUBLIC_5XX_COUNT';

export type ObservationType =
  | typeof OBS_TYPE_EDGE_STATUS
  | typeof OBS_TYPE_SITEMAP_PRESENT
  | typeof OBS_TYPE_INDEX_STATUS
  | typeof OBS_TYPE_INDEX_LATENCY_HOURS
  | typeof OBS_TYPE_CANONICAL_MATCH
  | typeof OBS_TYPE_ROBOTS_ALLOWED
  | typeof OBS_TYPE_SEARCH_IMPRESSIONS
  | typeof OBS_TYPE_PUBLIC_5XX_COUNT;

// Index States
export const INDEX_STATUS_UNKNOWN = 'UNKNOWN';
export const INDEX_STATUS_NOT_INDEXED = 'NOT_INDEXED';
export const INDEX_STATUS_INDEXED = 'INDEXED';

export type IndexStatus =
  | typeof INDEX_STATUS_UNKNOWN
  | typeof INDEX_STATUS_NOT_INDEXED
  | typeof INDEX_STATUS_INDEXED;

// Health Regimes
export const REGIME_UNKNOWN = 'UNKNOWN';
export const REGIME_STALE = 'STALE';
export const REGIME_PARTIAL = 'PARTIAL';
export const REGIME_HEALTHY = 'HEALTHY';
export const REGIME_DEGRADED = 'DEGRADED';

export type HealthRegime =
  | typeof REGIME_UNKNOWN
  | typeof REGIME_STALE
  | typeof REGIME_PARTIAL
  | typeof REGIME_HEALTHY
  | typeof REGIME_DEGRADED;

// Planner Recommendations
export const RECOMMENDATION_HOLD = 'HOLD';
export const RECOMMENDATION_INCREASE_ONE_STEP = 'INCREASE_ONE_STEP';
export const RECOMMENDATION_DECREASE_ONE_STEP = 'DECREASE_ONE_STEP';
export const RECOMMENDATION_PAUSE_GROWTH = 'PAUSE_GROWTH';

export type PlannerRecommendation =
  | typeof RECOMMENDATION_HOLD
  | typeof RECOMMENDATION_INCREASE_ONE_STEP
  | typeof RECOMMENDATION_DECREASE_ONE_STEP
  | typeof RECOMMENDATION_PAUSE_GROWTH;

// Freshness States
export const FRESHNESS_FRESH = 'FRESH';
export const FRESHNESS_STALE = 'STALE';
export const FRESHNESS_UNKNOWN = 'UNKNOWN';

export type FreshnessState =
  | typeof FRESHNESS_FRESH
  | typeof FRESHNESS_STALE
  | typeof FRESHNESS_UNKNOWN;

/**
 * 1. Raw Discrete Observation Record
 */
export interface PublicationObservationRecord {
  id?: number;
  observation_id: string;
  article_id: number;
  receipt_id: string | null;
  canonical_url: string;
  source_class: SourceClass;
  source_name: string;
  observation_type: ObservationType;
  status_value: string;
  metric_value: number | null;
  confidence_class: ConfidenceClass;
  reason_code: string | null;
  raw_payload_json: string | null;
  dedup_hash: string;
  observed_at: string;
  source_timestamp: string | null;
  created_at?: string;
}

/**
 * 2. Point-in-time Resolved Feedback Snapshot
 */
export interface PublicationFeedbackSnapshotRecord {
  article_id: number;
  receipt_id: string | null;
  canonical_url: string;
  in_sitemap: number; // 0 or 1
  in_news_sitemap: number; // 0 or 1
  last_sitemap_check_at: string | null;
  edge_http_status: number | null;
  canonical_matches: number; // 0 or 1
  robots_indexable: number; // 0 or 1
  last_edge_probe_at: string | null;
  index_status: IndexStatus;
  first_indexed_at: string | null;
  index_latency_hours: number | null;
  index_source: string | null;
  last_index_check_at: string | null;
  has_conflicts: number; // 0 or 1
  conflict_notes: string | null;
  updated_at?: string;
}

/**
 * 3. Rolling Cohort Feedback Aggregate
 */
export interface PublicationFeedbackAggregateRecord {
  aggregate_id: string;
  window_start: string;
  window_end: string;
  evaluated_at: string;
  cohort_sample_size: number;
  observation_coverage_ratio: number;
  articles_indexed_count: number;
  articles_not_indexed_count: number;
  articles_unknown_count: number;
  indexing_success_ratio: number | null;
  median_index_latency_hours: number | null;
  sitemap_coverage_ratio: number;
  sitemap_last_verified_at: string | null;
  recent_5xx_rate: number;
  canonical_mismatch_rate: number;
  publication_error_rate: number;
  health_regime: HealthRegime;
  planner_recommendation: PlannerRecommendation;
  signals_payload_json: string;
  created_at?: string;
}

/**
 * 4. Run Execution Record
 */
export interface PublicationFeedbackRunRecord {
  run_id: string;
  trigger_source: 'manual' | 'test' | 'cron';
  actor: string;
  locked_until: string | null;
  run_status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  articles_evaluated: number;
  observations_recorded: number;
  unchanged_count: number;
  errors_count: number;
  aggregate_id: string | null;
  started_at: string;
  completed_at: string | null;
  details_json: string | null;
}

/**
 * External Telemetry Adapter Contracts
 */
export interface UrlInspectionResult {
  url: string;
  indexStatus: IndexStatus;
  coverageState?: string;
  crawledAs?: string;
  lastCrawlTime?: string;
  pageFetchState?: string;
  robotsTxtState?: string;
  userCanonical?: string;
  googleCanonical?: string;
  referringUrls?: string[];
  raw?: Record<string, any>;
}

export interface ExternalTelemetryAdapter {
  providerName: string;
  isConfigured(): boolean;
  inspectUrls(urls: string[]): Promise<UrlInspectionResult[]>;
}
