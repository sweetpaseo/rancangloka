/**
 * RancangLoka — Modular Article Architecture V1 (MAA-V1)
 * Dependency-Aware Invalidation Engine
 * 
 * Strict Invariants:
 * 1. Component-level mutation cascades invalidate only affected downstream components or QA receipts.
 * 2. Narrative rewrites invalidate prior semantic QA and claim verification, but MUST PRESERVE media assets and placements.
 * 3. Heading text edits rebuild TOC projections while preserving stable section IDs (sec_{articleId}_{idx}).
 * 4. Publication schedule adjustments never invalidate narrative, media, or QA receipts.
 */

import type { ArticleComponentType, ValidationStatus } from './types.ts';

export interface InvalidationCascadeRule {
  targetComponent: ArticleComponentType;
  newStatus: ValidationStatus;
  reason: string;
}

export const COMPONENT_DEPENDENCY_GRAPH: Record<ArticleComponentType, InvalidationCascadeRule[]> = {
  narrative: [
    {
      targetComponent: 'qa_receipts',
      newStatus: 'STALE',
      reason: 'Narrative content was modified; prior Nadia semantic voice QA and Rina DoD receipts are now stale.'
    }
  ],
  seo: [
    {
      targetComponent: 'qa_receipts',
      newStatus: 'STALE',
      reason: 'Focus keyword or SEO metadata changed; opening/closing keyword checks and DoD must be re-evaluated.'
    }
  ],
  identity: [
    {
      targetComponent: 'seo',
      newStatus: 'STALE',
      reason: 'Article title or slug changed; SEO title length and slug alignment must be re-evaluated.'
    },
    {
      targetComponent: 'qa_receipts',
      newStatus: 'STALE',
      reason: 'Article title changed; DoD Gate A title criteria must be re-verified.'
    }
  ],
  evidence_pack: [
    {
      targetComponent: 'qa_receipts',
      newStatus: 'STALE',
      reason: 'Evidence pack or verified sources changed; factual claim grounding must be re-verified.'
    }
  ],
  cover_hero: [
    {
      targetComponent: 'qa_receipts',
      newStatus: 'STALE',
      reason: 'Cover hero asset or alt text updated; Gate B visual readiness must be re-evaluated.'
    }
  ],
  inline_media: [
    {
      targetComponent: 'qa_receipts',
      newStatus: 'STALE',
      reason: 'Inline media assignments updated; Budi visual QA and Gate B placement checks must be re-verified.'
    }
  ],
  faq: [
    {
      targetComponent: 'qa_receipts',
      newStatus: 'STALE',
      reason: 'FAQ items updated; FAQ formatting and schema checks must be re-verified.'
    }
  ],
  executive_summary: [],
  key_takeaways: [
    {
      targetComponent: 'qa_receipts',
      newStatus: 'STALE',
      reason: 'Key takeaways updated; Gate A takeaway checks must be re-evaluated.'
    }
  ],
  internal_links: [
    {
      targetComponent: 'qa_receipts',
      newStatus: 'STALE',
      reason: 'Internal links updated; Gate A link whitelist must be re-checked.'
    }
  ],
  technical_references: [
    {
      targetComponent: 'qa_receipts',
      newStatus: 'STALE',
      reason: 'Technical references updated; citation validity must be re-verified.'
    }
  ],
  metadata: [],
  publication_schedule: [], // Schedule updates NEVER invalidate content or media
  qa_receipts: []
};

/**
 * Computes which components must have their validation_status transitioned based on a mutation.
 */
export function getInvalidationCascades(mutatedComponent: ArticleComponentType): InvalidationCascadeRule[] {
  return COMPONENT_DEPENDENCY_GRAPH[mutatedComponent] || [];
}
