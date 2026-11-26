/**
 * RancangLoka — Modular Article Architecture V1 (MAA-V1)
 * Component Ownership & Mutation Authority Matrix
 * 
 * Strict Invariants:
 * 1. Actor-specific component boundary enforcement at service & gateway level.
 * 2. Cross-component write attempts are rejected fail-closed.
 * 3. AI agents (SEON, Irwan, Joko, Nadia, Budi, Rina) only possess authority over their dedicated components.
 * 4. Owner possesses authorized manual override & publication authorization.
 */

import type { ArticleComponentType, ActorRole } from './types.ts';

export interface OwnershipRule {
  primary_author: ActorRole;
  allowed_mutators: ActorRole[];
  description: string;
}

export const COMPONENT_OWNERSHIP_MATRIX: Record<ArticleComponentType, OwnershipRule> = {
  identity: {
    primary_author: 'seon',
    allowed_mutators: ['seon', 'owner'],
    description: 'Title proposals, slug assignment, article category assignment'
  },
  seo: {
    primary_author: 'seon',
    allowed_mutators: ['seon', 'owner'],
    description: 'Natural focus keyword, supporting keywords, search intent, meta description'
  },
  evidence_pack: {
    primary_author: 'irwan',
    allowed_mutators: ['irwan', 'owner'],
    description: 'Verified source records, technical claims, claim-to-source bindings'
  },
  executive_summary: {
    primary_author: 'joko',
    allowed_mutators: ['joko', 'owner'],
    description: 'Concise summary of article scope and findings'
  },
  key_takeaways: {
    primary_author: 'joko',
    allowed_mutators: ['joko', 'owner'],
    description: '3-5 key practical takeaways for homeowners'
  },
  narrative: {
    primary_author: 'joko',
    allowed_mutators: ['joko', 'nadia', 'owner'],
    description: 'Opening, stable ordered sections (heading + paragraphs), closing'
  },
  cover_hero: {
    primary_author: 'budi',
    allowed_mutators: ['budi', 'owner'],
    description: 'Hero cover photograph, asset ID, alt text, caption, visual brief'
  },
  inline_media: {
    primary_author: 'budi',
    allowed_mutators: ['budi', 'owner'],
    description: 'Four inline editorial image slots bound to stable section IDs'
  },
  faq: {
    primary_author: 'joko',
    allowed_mutators: ['joko', 'irwan', 'owner'],
    description: 'FAQ items with evidence bindings where required'
  },
  internal_links: {
    primary_author: 'seon',
    allowed_mutators: ['seon', 'rina', 'owner'],
    description: 'Internal links mapped to verified published article slugs'
  },
  technical_references: {
    primary_author: 'irwan',
    allowed_mutators: ['irwan', 'owner'],
    description: 'SNI, ASTM, and manufacturer TDS technical references'
  },
  metadata: {
    primary_author: 'sari',
    allowed_mutators: ['sari', 'seon', 'owner'],
    description: 'Author ID, category ID, pillar role, reading time'
  },
  publication_schedule: {
    primary_author: 'sari',
    allowed_mutators: ['sari', 'owner'],
    description: 'Publication state, manual hold, scheduled publishing timestamps'
  },
  qa_receipts: {
    primary_author: 'rina',
    allowed_mutators: ['rina', 'nadia', 'budi', 'owner'],
    description: 'Nadia semantic QA, Rina DoD Gates, Budi visual QA, JEV supervision receipts'
  }
};

export class UnauthorizedMutationError extends Error {
  readonly actor: ActorRole;
  readonly componentType: ArticleComponentType;

  constructor(actor: ActorRole, componentType: ArticleComponentType) {
    const rule = COMPONENT_OWNERSHIP_MATRIX[componentType];
    super(
      `UNAUTHORIZED_COMPONENT_MUTATION: Actor '${actor}' is not authorized to mutate component '${componentType}'. ` +
      `Allowed mutators: [${rule?.allowed_mutators.join(', ') || 'none'}].`
    );
    this.name = 'UnauthorizedMutationError';
    this.actor = actor;
    this.componentType = componentType;
  }
}

/**
 * Validates that the requesting actor has write permission for the given component.
 * Throws UnauthorizedMutationError if permission is denied.
 */
export function enforceComponentWritePermission(actor: ActorRole, componentType: ArticleComponentType): void {
  const rule = COMPONENT_OWNERSHIP_MATRIX[componentType];
  if (!rule) {
    throw new Error(`UNKNOWN_COMPONENT_TYPE: '${componentType}' is not a recognized article component.`);
  }

  if (!rule.allowed_mutators.includes(actor) && actor !== 'owner') {
    throw new UnauthorizedMutationError(actor, componentType);
  }
}

/**
 * Pure predicate version of permission check
 */
export function hasComponentWritePermission(actor: ActorRole, componentType: ArticleComponentType): boolean {
  const rule = COMPONENT_OWNERSHIP_MATRIX[componentType];
  if (!rule) return false;
  return rule.allowed_mutators.includes(actor) || actor === 'owner';
}
