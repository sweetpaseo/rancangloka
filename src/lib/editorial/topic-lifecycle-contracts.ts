/**
 * RancangLoka — Unified Topic Lifecycle & Intelligence System V1 (UTLIS-V1)
 * Domain Contracts, Canonical State Machine, and Article Lifecycle Alignment.
 */

export type TopicLifecycleStatus =
  | 'DISCOVERED'
  | 'KEYWORD_VALIDATED'
  | 'PRIORITIZED'
  | 'READY_FOR_RESEARCH'
  | 'RESERVED'
  | 'IN_RESEARCH'
  | 'RESEARCH_READY'
  | 'READY_FOR_WRITING'
  | 'IN_WRITING'
  | 'EDITORIAL_REVIEW'
  | 'MEDIA_PRODUCTION'
  | 'STAGED_IN_REVIEW'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'DEFERRED'
  | 'BLOCKED'
  | 'REJECTED'
  | 'MERGED'
  | 'CANCELLED'
  | 'ARCHIVED';

export type ProductionChannel = 'hermes' | 'loka_bridge' | 'reference_intake' | 'manual_owner';

export type EnvironmentScope = 'production' | 'staging' | 'local' | 'fixture';

export type ReservationStatus = 'ACTIVE' | 'RELEASED' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export type DuplicateAction = 'ALLOW' | 'BLOCK' | 'REVIEW' | 'MERGE_CANDIDATE' | 'REFRESH_EXISTING';

export type ResearchFreshnessStatus = 'FRESH' | 'STALE' | 'EXPIRED' | 'UNVERIFIED';

export const CANONICAL_TOPIC_STATUSES: TopicLifecycleStatus[] = [
  'DISCOVERED',
  'KEYWORD_VALIDATED',
  'PRIORITIZED',
  'READY_FOR_RESEARCH',
  'RESERVED',
  'IN_RESEARCH',
  'RESEARCH_READY',
  'READY_FOR_WRITING',
  'IN_WRITING',
  'EDITORIAL_REVIEW',
  'MEDIA_PRODUCTION',
  'STAGED_IN_REVIEW',
  'SCHEDULED',
  'PUBLISHED',
  'DEFERRED',
  'BLOCKED',
  'REJECTED',
  'MERGED',
  'CANCELLED',
  'ARCHIVED'
];

export const ACTIVE_IN_FLIGHT_STATUSES = new Set<TopicLifecycleStatus>([
  'RESERVED',
  'IN_RESEARCH',
  'RESEARCH_READY',
  'READY_FOR_WRITING',
  'IN_WRITING',
  'EDITORIAL_REVIEW',
  'MEDIA_PRODUCTION',
  'STAGED_IN_REVIEW',
  'SCHEDULED'
]);

export const DISPATCHABLE_STATUSES = new Set<TopicLifecycleStatus>([
  'PRIORITIZED',
  'READY_FOR_RESEARCH',
  'KEYWORD_VALIDATED'
]);

export const TERMINAL_NON_DISPATCHABLE_STATUSES = new Set<TopicLifecycleStatus>([
  'PUBLISHED',
  'REJECTED',
  'MERGED',
  'CANCELLED',
  'ARCHIVED'
]);

/**
 * Canonical state machine transition map aligned with Article Lifecycle.
 */
export const ALLOWED_TOPIC_TRANSITIONS: Record<TopicLifecycleStatus, TopicLifecycleStatus[]> = {
  DISCOVERED: ['KEYWORD_VALIDATED', 'DEFERRED', 'BLOCKED', 'REJECTED', 'MERGED', 'CANCELLED'],
  KEYWORD_VALIDATED: ['PRIORITIZED', 'READY_FOR_RESEARCH', 'RESERVED', 'DEFERRED', 'BLOCKED', 'REJECTED', 'MERGED', 'CANCELLED'],
  PRIORITIZED: ['READY_FOR_RESEARCH', 'RESERVED', 'DEFERRED', 'BLOCKED', 'REJECTED', 'MERGED', 'CANCELLED'],
  READY_FOR_RESEARCH: ['RESERVED', 'IN_RESEARCH', 'DEFERRED', 'BLOCKED', 'REJECTED', 'MERGED', 'CANCELLED'],
  RESERVED: ['IN_RESEARCH', 'READY_FOR_WRITING', 'READY_FOR_RESEARCH', 'BLOCKED', 'CANCELLED', 'DEFERRED'],
  IN_RESEARCH: ['RESEARCH_READY', 'READY_FOR_WRITING', 'BLOCKED', 'DEFERRED', 'CANCELLED'],
  RESEARCH_READY: ['READY_FOR_WRITING', 'RESERVED', 'DEFERRED', 'BLOCKED', 'CANCELLED'],
  READY_FOR_WRITING: ['IN_WRITING', 'RESERVED', 'BLOCKED', 'DEFERRED', 'CANCELLED'],
  IN_WRITING: ['EDITORIAL_REVIEW', 'STAGED_IN_REVIEW', 'BLOCKED', 'DEFERRED', 'CANCELLED'],
  EDITORIAL_REVIEW: ['MEDIA_PRODUCTION', 'STAGED_IN_REVIEW', 'READY_FOR_WRITING', 'BLOCKED', 'REJECTED', 'DEFERRED'],
  MEDIA_PRODUCTION: ['STAGED_IN_REVIEW', 'EDITORIAL_REVIEW', 'BLOCKED', 'DEFERRED'],
  STAGED_IN_REVIEW: ['SCHEDULED', 'PUBLISHED', 'EDITORIAL_REVIEW', 'DEFERRED', 'ARCHIVED'],
  SCHEDULED: ['PUBLISHED', 'STAGED_IN_REVIEW', 'CANCELLED', 'DEFERRED'],
  PUBLISHED: ['ARCHIVED', 'READY_FOR_RESEARCH'], // Refresh/revision cycles preserve identity via decision history
  DEFERRED: ['DISCOVERED', 'KEYWORD_VALIDATED', 'PRIORITIZED', 'READY_FOR_RESEARCH', 'ARCHIVED', 'CANCELLED'],
  BLOCKED: ['DISCOVERED', 'KEYWORD_VALIDATED', 'PRIORITIZED', 'READY_FOR_RESEARCH', 'DEFERRED', 'REJECTED', 'CANCELLED'],
  REJECTED: ['ARCHIVED', 'MERGED'],
  MERGED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED', 'DISCOVERED'],
  ARCHIVED: []
};

export function isValidTopicTransition(from: TopicLifecycleStatus, to: TopicLifecycleStatus): boolean {
  if (from === to) return true;
  return (ALLOWED_TOPIC_TRANSITIONS[from] || []).includes(to);
}

/**
 * Maps Article Lifecycle status to Topic Lifecycle status.
 */
export function mapArticleStatusToTopicStatus(
  articleStatus: string,
  environmentScope: EnvironmentScope,
  manualHold: number = 0
): TopicLifecycleStatus {
  const norm = (articleStatus || 'draft').toLowerCase().trim();
  if (norm === 'published' && environmentScope === 'production') return 'PUBLISHED';
  if (norm === 'scheduled') return 'SCHEDULED';
  if (norm === 'archived') return 'ARCHIVED';
  if (environmentScope === 'staging' || manualHold === 1) return 'STAGED_IN_REVIEW';
  return 'EDITORIAL_REVIEW';
}

export interface EditorialTopicRecord {
  topic_id: string;
  canonical_topic_key: string;
  angle_key: string;
  angle_index: number;
  category_id: number;
  subcategory: string | null;
  topic_family: string | null;
  topic_cluster: string | null;
  candidate_title: string;
  canonical_slug: string | null;
  focus_keyword: string;
  supporting_keywords_json: string;
  search_intent: string;
  content_angle: string;
  reader_need: string | null;
  archetype: string | null;
  seasonality: string;
  estimated_word_count: number;
  discovery_source: string;
  proposing_staff: string;
  discovered_at: string;
  epis_score: number;
  priority_rank: number;
  priority_rationale: string | null;
  lifecycle_status: TopicLifecycleStatus;
  related_task_id: string | null;
  related_research_id: string | null;
  related_article_id: number | null;
  canonical_article_uid: string | null;
  published_url: string | null;
  environment_scope: EnvironmentScope;
  is_test_fixture: number;
  duplicate_screening_json: string | null;
  decision_summary: string | null;
  updated_at: string;
}

export interface TopicDecisionHistoryRecord {
  decision_id: string;
  topic_id: string;
  previous_status: string | null;
  new_status: string;
  actor: string;
  reason: string;
  event_ref: string | null;
  task_id: string | null;
  override_flag: number;
  metadata_json: string | null;
  created_at: string;
}

export interface TopicReservationRecord {
  reservation_id: string;
  topic_id: string;
  canonical_topic_key: string;
  angle_key: string;
  task_id: string;
  production_channel: ProductionChannel;
  lease_owner: string;
  lease_expires_at: string;
  idempotency_key: string;
  fencing_token: number;
  reservation_status: ReservationStatus;
  created_at: string;
  updated_at: string;
}

export interface GlobalArticleIdentityRecord {
  canonical_article_uid: string;
  topic_id: string | null;
  angle_key: string | null;
  research_id: string | null;
  task_id: string | null;
  canonical_slug: string;
  title: string;
  focus_keyword: string | null;
  category_id: number | null;
  topic_family: string | null;
  staging_article_id: number | null;
  production_article_id: number | null;
  ingest_receipt_id: string | null;
  bridge_job_id: string | null;
  published_url: string | null;
  article_status: 'draft' | 'staged' | 'scheduled' | 'published' | 'archived';
  is_test_fixture: number;
  environment_freshness_at: string | null;
  sync_status: 'SYNCED' | 'STAGING_ONLY' | 'PRODUCTION_ONLY' | 'STALE' | 'PENDING_RECONCILIATION';
  lineage_proof_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearchEvidenceIndexRecord {
  research_id: string;
  topic_id: string | null;
  canonical_article_uid: string | null;
  research_domain: string;
  topic_keywords: string | null;
  evidence_claims_json: string;
  source_references_json: string;
  document_editions_json: string;
  section_references_json: string;
  source_provenance: string;
  verified_at: string | null;
  freshness_expires_at: string | null;
  freshness_status: ResearchFreshnessStatus;
  artifact_reference: string;
  reuse_count: number;
  reuse_history_json: string;
  created_at: string;
  updated_at: string;
}

export interface DuplicateMatchEvidence {
  layer: 'LAYER_1_EXACT' | 'LAYER_2_LEXICAL' | 'LAYER_3_SEMANTIC_INTENT' | 'LAYER_4_CONTENT_DNA' | 'LAYER_5_EDITORIAL_REVIEW';
  matched_topic_id?: string | null;
  matched_article_uid?: string | null;
  matched_title: string;
  matched_slug?: string | null;
  matched_focus_keyword?: string | null;
  matched_status: string;
  similarity_score: number; // 0.0 - 1.0
  conflict_type:
    | 'EXACT_SLUG'
    | 'EXACT_TITLE'
    | 'EXACT_KEYWORD_AND_INTENT'
    | 'ACTIVE_RESERVATION'
    | 'LEXICAL_OVERLAP'
    | 'SEMANTIC_INTENT_OVERLAP'
    | 'CONTENT_DNA_SHINGLE_OVERLAP'
    | 'MULTI_ANGLE_CAP_EXCEEDED';
  evidence_detail: string;
}

export interface DuplicateScreeningResult {
  action: DuplicateAction;
  is_allowed: boolean;
  requires_editorial_review: boolean;
  conflict_type: string | null;
  matched_topic_id: string | null;
  matched_article_uid: string | null;
  matched_title: string | null;
  highest_similarity_score: number;
  matches: DuplicateMatchEvidence[];
  decision_rationale: string;
  multi_angle_eligible: boolean;
  existing_angle_count: number;
  screened_at: string;
}

export interface TopicScreeningInput {
  topic_id?: string;
  canonical_topic_key?: string;
  angle_key?: string;
  title: string;
  slug?: string;
  focus_keyword: string;
  supporting_keywords?: string[];
  search_intent?: string;
  content_angle?: string;
  reader_need?: string;
  category_id?: number;
  topic_family?: string;
  content_md?: string; // Optional: triggers Layer 4 Content DNA MinHash check during assembly/pre-publish
  screening_stage?: 'DISCOVERY' | 'TOPIC_SELECTION' | 'PRE_DISPATCH' | 'RESEARCH_HANDOFF' | 'ARTICLE_ASSEMBLY' | 'PRE_PUBLICATION';
}

export const MAX_LEGITIMATE_ANGLES_PER_TOPIC = 5;
