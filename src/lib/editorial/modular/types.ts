/**
 * RancangLoka — Modular Article Architecture V1 (MAA-V1)
 * Canonical Component Contracts & Stable Section Identities
 * 
 * Strict Invariants:
 * 1. Zero cross-component data leakage.
 * 2. Stable section identities (sec_{articleId}_{idx}) protect media placement from heading edits.
 * 3. Content hash calculation is component-specific; full snapshot SHA-256 is assembly-specific.
 * 4. Deterministic and fail-closed: missing mandatory components block publication readiness.
 */

import { createHash } from 'node:crypto';

export type ArticleComponentType =
  | 'identity'
  | 'seo'
  | 'evidence_pack'
  | 'executive_summary'
  | 'key_takeaways'
  | 'narrative'
  | 'cover_hero'
  | 'inline_media'
  | 'faq'
  | 'internal_links'
  | 'technical_references'
  | 'metadata'
  | 'publication_schedule'
  | 'qa_receipts';

export type ActorRole =
  | 'seon'
  | 'irwan'
  | 'joko'
  | 'nadia'
  | 'budi'
  | 'rina'
  | 'sari'
  | 'owner';

export type ValidationStatus =
  | 'MISSING'
  | 'DRAFT'
  | 'VALIDATED'
  | 'STALE'
  | 'BLOCKED';

// ----------------------------------------------------------------------------
// 01. Article Identity
// ----------------------------------------------------------------------------
export interface ArticleIdentityComponent {
  article_id: number;
  title: string;
  canonical_slug: string;
  article_type: 'magazine_standard' | 'comparison' | 'explainer' | 'buyer_guide';
}

// ----------------------------------------------------------------------------
// 02. SEO Metadata
// ----------------------------------------------------------------------------
export interface SeoComponent {
  primary_natural_keyword: string;
  supporting_keywords: string[];
  search_intent: 'informational' | 'commercial_investigation' | 'transactional';
  description: string;
  meta_title?: string;
  canonical_url?: string;
}

// ----------------------------------------------------------------------------
// 03. Evidence Pack
// ----------------------------------------------------------------------------
export interface VerifiedSourceRecord {
  source_id: string;
  title: string;
  url?: string;
  publisher?: string;
  retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' | 'SOURCE_UNVERIFIED' | 'LOCAL_FIXTURE';
  source_origin: 'LIVE_RETRIEVAL' | 'LOCAL_FIXTURE' | 'MANUAL_CURATION';
  accessed_at: string;
}

export interface TechnicalClaimBinding {
  claim_id: string;
  statement: string;
  source_ids: string[];
  standards?: string[]; // e.g. ["SNI 03-6384-2000", "ASTM C1396"]
  confidence_score: number;
}

export interface EvidencePackComponent {
  verified_sources: VerifiedSourceRecord[];
  technical_claims: TechnicalClaimBinding[];
  retrieval_provenance: string;
}

// ----------------------------------------------------------------------------
// 04. Executive Summary
// ----------------------------------------------------------------------------
export interface ExecutiveSummaryComponent {
  summary_text: string;
}

// ----------------------------------------------------------------------------
// 05. Key Takeaways
// ----------------------------------------------------------------------------
export interface KeyTakeawaysComponent {
  takeaways: string[]; // Minimum 3 items for magazine standard
}

// ----------------------------------------------------------------------------
// 06. Narrative (With Stable Section Identities)
// ----------------------------------------------------------------------------
export interface ModularSection {
  section_id: string; // e.g. "sec_10019_01" (STABLE across heading edits)
  heading: string;
  level: number; // default 2
  paragraphs: string[];
  display_order: number;
}

export interface NarrativeComponent {
  opening: {
    paragraphs: string[];
  };
  sections: ModularSection[];
  closing: {
    heading?: string;
    paragraphs: string[];
  };
}

// ----------------------------------------------------------------------------
// 07. Cover Hero Media
// ----------------------------------------------------------------------------
export interface CoverHeroComponent {
  asset_id: string;
  storage_key: string;
  public_url: string;
  alt_text: string;
  caption?: string;
  width: number;
  height: number;
  review_status: 'PENDING' | 'APPROVED_TECHNICAL_TRUTH' | 'REJECTED';
  editorial_approval: 'PENDING' | 'APPROVED_FOR_INLINE_PUBLICATION' | 'REJECTED';
}

// ----------------------------------------------------------------------------
// 08. Inline Media (Bound to Stable Section IDs)
// ----------------------------------------------------------------------------
export interface ModularInlineMediaItem {
  slot_key: string;
  section_id: string; // STABLE BINDING to ModularSection.section_id
  position: 'after_heading' | 'before_heading' | 'after_paragraph_containing' | 'end_of_section';
  paragraph_phrase?: string;
  asset_id: string;
  storage_key: string;
  public_url: string;
  alt_text: string;
  caption?: string;
  width?: number;
  height?: number;
  review_status: 'PENDING' | 'APPROVED_TECHNICAL_TRUTH' | 'REJECTED';
  editorial_approval: 'PENDING' | 'APPROVED_FOR_INLINE_PUBLICATION' | 'REJECTED';
}

export interface InlineMediaComponent {
  items: ModularInlineMediaItem[]; // Exactly 4 required for magazine standard
}

// ----------------------------------------------------------------------------
// 09. FAQ
// ----------------------------------------------------------------------------
export interface ModularFaqItem {
  faq_id: string; // e.g. "faq_10019_01"
  question: string;
  answer: string;
  evidence_binding?: string;
}

export interface FaqComponent {
  items: ModularFaqItem[];
}

// ----------------------------------------------------------------------------
// 10. Internal Links
// ----------------------------------------------------------------------------
export interface InternalLinkItem {
  link_id: string;
  target_slug: string;
  anchor_text: string;
  section_id: string;
  status: 'PROPOSED' | 'VALIDATED' | 'DISABLED';
}

export interface InternalLinksComponent {
  links: InternalLinkItem[];
}

// ----------------------------------------------------------------------------
// 11. Technical References
// ----------------------------------------------------------------------------
export interface TechnicalReferenceItem {
  ref_id: string;
  standard_name: string; // e.g. "SNI 03-6384-2000"
  organization: string; // e.g. "BSN" or "ASTM"
  description: string;
}

export interface TechnicalReferencesComponent {
  references: TechnicalReferenceItem[];
}

// ----------------------------------------------------------------------------
// 12. Author & Category Metadata
// ----------------------------------------------------------------------------
export interface MetadataComponent {
  author_id: number;
  category_id: number;
  pillar_role: 'STANDALONE' | 'PILLAR' | 'CLUSTER';
  parent_pillar_id?: number | null;
  reading_time_minutes: number;
}

// ----------------------------------------------------------------------------
// 13. Publication Schedule & Authority
// ----------------------------------------------------------------------------
export interface PublicationScheduleComponent {
  status: 'draft' | 'scheduled' | 'published';
  manual_hold: number; // 1 = held, 0 = released
  manual_hold_reason?: string | null;
  manual_hold_at?: string | null;
  manual_hold_by?: string | null;
  scheduled_at?: string | null;
  published_at?: string | null;
}

// ----------------------------------------------------------------------------
// 14. Quality Evaluation Receipts
// ----------------------------------------------------------------------------
export interface QualityReceiptRecord {
  receipt_id: string;
  evaluator: 'nadia_semantic_qa' | 'rina_dod_gate_a' | 'rina_dod_gate_b' | 'budi_visual_qa' | 'jev_supervision' | 'seo_audit';
  score?: number;
  verdict: 'PASS' | 'REVISION_REQUIRED' | 'BLOCKED' | 'NOT_EVALUATED' | 'CONFIRM_PASS';
  target_component_version: number;
  target_content_hash: string;
  evaluated_at: string;
  details_json?: string;
}

export interface QaReceiptsComponent {
  receipts: QualityReceiptRecord[];
}

// ----------------------------------------------------------------------------
// Canonical Component Container Mapping
// ----------------------------------------------------------------------------
export type ComponentDataMap = {
  identity: ArticleIdentityComponent;
  seo: SeoComponent;
  evidence_pack: EvidencePackComponent;
  executive_summary: ExecutiveSummaryComponent;
  key_takeaways: KeyTakeawaysComponent;
  narrative: NarrativeComponent;
  cover_hero: CoverHeroComponent;
  inline_media: InlineMediaComponent;
  faq: FaqComponent;
  internal_links: InternalLinksComponent;
  technical_references: TechnicalReferencesComponent;
  metadata: MetadataComponent;
  publication_schedule: PublicationScheduleComponent;
  qa_receipts: QaReceiptsComponent;
};

export interface StoredArticleComponent<T extends ArticleComponentType = ArticleComponentType> {
  article_id: number;
  component_type: T;
  schema_version: number;
  component_version: number;
  content_hash: string;
  content: ComponentDataMap[T];
  validation_status: ValidationStatus;
  updated_by: ActorRole;
  updated_at: string;
}

export interface ComponentVersionManifestItem {
  component_type: ArticleComponentType;
  version: number;
  hash: string;
  validation_status: ValidationStatus;
  updated_by: ActorRole;
}

export interface ArticleSnapshotManifest {
  snapshot_id: string;
  article_id: number;
  schema_version: number;
  snapshot_version: number;
  components: Record<ArticleComponentType, ComponentVersionManifestItem>;
  assembly_hash: string;
  assembly_status: 'COMPLETE' | 'INCOMPLETE';
  created_by: ActorRole;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Content Hash Utility
// ----------------------------------------------------------------------------
export function computeJsonContentHash(payload: unknown): string {
  const normalized = JSON.stringify(payload, Object.keys(payload as any || {}).sort());
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}
