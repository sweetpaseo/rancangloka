/**
 * RancangLoka Semantic Internal Link Engine (INTERNAL-LINK-ENGINE-1)
 * Types and Invariants
 */

export const RELATIONSHIP_TYPES = [
  'PARENT_PILLAR',
  'CHILD_SUPPORTING',
  'RELATED_PROBLEM',
  'RELATED_MATERIAL',
  'RELATED_DECISION',
  'BACKGROUND_EXPLAINER',
  'NEXT_STEP',
  'RELATED_SYSTEM',
  'RELATED_FAILURE_MODE'
] as const;

export type RelationshipType = typeof RELATIONSHIP_TYPES[number];

export const PLACEMENT_PLANES = [
  'PLANE_A_DYNAMIC',
  'PLANE_B_INLINE'
] as const;

export type PlacementPlane = typeof PLACEMENT_PLANES[number];

export const LINK_STATUSES = [
  'CANDIDATE',
  'APPROVED',
  'ACTIVE',
  'REJECTED',
  'STALE'
] as const;

export type LinkStatus = typeof LINK_STATUSES[number];

export type PillarRole = 'PILLAR' | 'SUPPORTING' | 'STANDALONE';

export interface ArticleInternalLink {
  id?: number;
  source_article_id: number;
  target_article_id: number;
  relationship_type: RelationshipType;
  reader_reason: string;
  placement_plane: PlacementPlane;
  anchor_text?: string | null;
  confidence_score?: number;
  status: LinkStatus;
  source_content_hash?: string | null;
  created_at?: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export interface ResolvedPlaneALink {
  id?: number;
  source_article_id: number;
  target_article_id: number;
  relationship_type: RelationshipType;
  reader_reason: string;
  placement_plane: 'PLANE_A_DYNAMIC';
  confidence_score: number;
  target_title: string;
  target_slug: string;
  target_category_name?: string;
  target_reading_time_minutes?: number;
  target_featured_image?: string;
}

export interface OrphanDiagnosticResult {
  article_id: number;
  slug: string;
  title: string;
  status: string;
  pillar_role: PillarRole;
  parent_pillar_id: number | null;
  inbound_active_semantic_links_count: number;
  is_orphan: boolean;
  reason: string;
}

export interface DiscoveryCandidate {
  source_article_id: number;
  target_article_id: number;
  direction: 'FORWARD' | 'BACKLINK';
  relationship_type: RelationshipType;
  reader_reason: string;
  confidence_score: number;
  recommended_plane: PlacementPlane;
  status: 'CANDIDATE';
  match_rationale: string;
}

export interface InternalLinkActionableState {
  type: 'LINK_REVIEW_REQUIRED' | 'ORPHAN_DETECTED' | 'BACKLINK_RECOMMENDED' | 'LINK_REVISION_RECOMMENDED';
  article_id: number;
  article_title: string;
  article_slug: string;
  details: string;
  target_article_id?: number;
  target_article_title?: string;
  link_id?: number;
  severity: 'info' | 'warning' | 'action_required';
}
