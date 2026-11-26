/**
 * RancangLoka — Article Structure Standard 3.0 (RASS 3.0)
 * Blueprint Engine & Universal Component Registry
 * 
 * Strict Invariants:
 * 1. Profiles adapt component requirements to user search intent.
 * 2. Deterministic validation: required components must be VALIDATED for blueprint pass.
 * 3. Zero AI improvisation: structural rules are pure TypeScript contracts.
 */

import type { ArticleComponentType, ComponentDataMap, ValidationStatus } from './types.ts';

export type ArticleProfileType =
  | 'material_comparison'
  | 'technical_guide'
  | 'problem_solution'
  | 'cost_guide'
  | 'product_review'
  | 'tutorial'
  | 'general_editorial';

export interface ConditionalComponentRule {
  component: ArticleComponentType;
  condition: string;
  evaluator: (components: Partial<ComponentDataMap>) => boolean;
}

export interface StructuralInvariants {
  min_sections: number;
  max_sections: number;
  requires_comparison_table: boolean;
  min_faq_items: number;
  max_faq_items: number;
  exact_inline_media_count: number;
  requires_technical_references: boolean;
  max_paragraph_words: number;
  advisory_word_count?: {
    min: number;
    max: number;
    guideline_name: string;
  };
}

export interface ArticleBlueprintDefinition {
  profile: ArticleProfileType;
  title: string;
  description: string;
  search_intent: 'informational' | 'commercial_investigation' | 'transactional';
  required_components: ArticleComponentType[];
  optional_components: ArticleComponentType[];
  conditional_components: ConditionalComponentRule[];
  structural_invariants: StructuralInvariants;
}

/**
 * Universal Component Registry for RASS 3.0
 */
export const UNIVERSAL_COMPONENT_REGISTRY: Record<ArticleComponentType, {
  name: string;
  owner: string;
  description: string;
  is_content_bearing: boolean;
}> = {
  identity: {
    name: 'Article Identity',
    owner: 'seon',
    description: 'Title, canonical slug, and article archetype',
    is_content_bearing: false,
  },
  seo: {
    name: 'SEO Metadata',
    owner: 'seon',
    description: 'Focus keyword, intent, meta description, and search geometry',
    is_content_bearing: false,
  },
  evidence_pack: {
    name: 'Evidence Pack',
    owner: 'irwan',
    description: 'Verified sources, technical standards, and empirical claim bindings',
    is_content_bearing: true,
  },
  executive_summary: {
    name: 'Executive Summary',
    owner: 'joko',
    description: 'Rapid takeaway block for quick reader scanning',
    is_content_bearing: true,
  },
  key_takeaways: {
    name: 'Key Takeaways',
    owner: 'joko',
    description: 'Bulleted action points and core decisions',
    is_content_bearing: true,
  },
  narrative: {
    name: 'Narrative Body',
    owner: 'joko',
    description: 'Structured sections with stable section IDs and short paragraph blocks',
    is_content_bearing: true,
  },
  cover_hero: {
    name: 'Cover Hero Media',
    owner: 'budi',
    description: 'Primary 16:9 visual anchor with authentic physical context',
    is_content_bearing: true,
  },
  inline_media: {
    name: 'Inline Explanatory Media',
    owner: 'budi',
    description: 'Stable section-anchored visual evidence supporting adjacent H2 explanations',
    is_content_bearing: true,
  },
  faq: {
    name: 'Homeowner FAQ',
    owner: 'joko',
    description: 'High-utility, concise questions and answers addressing real homeowner anxiety',
    is_content_bearing: true,
  },
  internal_links: {
    name: 'Semantic Internal Links',
    owner: 'seon',
    description: 'Contextual bridge links connecting related knowledge clusters',
    is_content_bearing: true,
  },
  technical_references: {
    name: 'Technical References & Standards',
    owner: 'irwan',
    description: 'SNI, ASTM, and manufacturer manual citations',
    is_content_bearing: true,
  },
  metadata: {
    name: 'Author & Category Taxonomy',
    owner: 'sari',
    description: 'Author attribution, category ID, pillar role, and reading duration',
    is_content_bearing: false,
  },
  publication_schedule: {
    name: 'Publication Authority & Schedule',
    owner: 'sari',
    description: 'Publication state, manual hold lock, and timestamp provenance',
    is_content_bearing: false,
  },
  qa_receipts: {
    name: 'Quality Assurance Receipts',
    owner: 'rina',
    description: 'Cryptographically bound evaluation records from Nadia, Rina, Budi, and Jev',
    is_content_bearing: false,
  },
};

/**
 * Standard Blueprint Profiles
 */
export const ARTICLE_BLUEPRINT_REGISTRY: Record<ArticleProfileType, ArticleBlueprintDefinition> = {
  material_comparison: {
    profile: 'material_comparison',
    title: 'Material Head-to-Head Comparison',
    description: 'Objective comparative analysis of two or more building materials based on physical properties, climate resilience, and installation behavior.',
    search_intent: 'commercial_investigation',
    required_components: [
      'identity',
      'seo',
      'evidence_pack',
      'executive_summary',
      'key_takeaways',
      'narrative',
      'cover_hero',
      'inline_media',
      'faq',
      'technical_references',
      'metadata',
      'publication_schedule',
      'qa_receipts',
    ],
    optional_components: ['internal_links'],
    conditional_components: [],
    structural_invariants: {
      min_sections: 4,
      max_sections: 8,
      requires_comparison_table: true,
      min_faq_items: 4,
      max_faq_items: 6,
      exact_inline_media_count: 4,
      requires_technical_references: true,
      max_paragraph_words: 60,
      advisory_word_count: {
        min: 1200,
        max: 1600,
        guideline_name: 'Material Comparison'
      }
    },
  },

  technical_guide: {
    profile: 'technical_guide',
    title: 'Technical Implementation Guide',
    description: 'Deep dive into structural, installation, or building engineering details with code-compliant specifications.',
    search_intent: 'informational',
    required_components: [
      'identity',
      'seo',
      'evidence_pack',
      'key_takeaways',
      'narrative',
      'cover_hero',
      'inline_media',
      'technical_references',
      'metadata',
      'publication_schedule',
      'qa_receipts',
    ],
    optional_components: ['executive_summary', 'faq', 'internal_links'],
    conditional_components: [],
    structural_invariants: {
      min_sections: 4,
      max_sections: 10,
      requires_comparison_table: false,
      min_faq_items: 3,
      max_faq_items: 5,
      exact_inline_media_count: 4,
      requires_technical_references: true,
      max_paragraph_words: 60,
      advisory_word_count: {
        min: 1500,
        max: 2500,
        guideline_name: 'Deep Technical Guide'
      }
    },
  },

  problem_solution: {
    profile: 'problem_solution',
    title: 'Defect Diagnosis & Solution Guide',
    description: 'Troubleshooting home defects (e.g. leaking, cracking, sagging) by identifying root causes before prescribing repairs.',
    search_intent: 'informational',
    required_components: [
      'identity',
      'seo',
      'evidence_pack',
      'key_takeaways',
      'narrative',
      'cover_hero',
      'inline_media',
      'faq',
      'metadata',
      'publication_schedule',
      'qa_receipts',
    ],
    optional_components: ['executive_summary', 'internal_links', 'technical_references'],
    conditional_components: [],
    structural_invariants: {
      min_sections: 4,
      max_sections: 8,
      requires_comparison_table: false,
      min_faq_items: 3,
      max_faq_items: 5,
      exact_inline_media_count: 4,
      requires_technical_references: false,
      max_paragraph_words: 55,
      advisory_word_count: {
        min: 800,
        max: 1200,
        guideline_name: 'Problem & Solution'
      }
    },
  },

  cost_guide: {
    profile: 'cost_guide',
    title: 'Empirical Cost & Budgeting Guide',
    description: 'Verified material and labor estimates adhering strictly to Monetary Silence invariants.',
    search_intent: 'commercial_investigation',
    required_components: [
      'identity',
      'seo',
      'evidence_pack',
      'key_takeaways',
      'narrative',
      'cover_hero',
      'inline_media',
      'faq',
      'technical_references',
      'metadata',
      'publication_schedule',
      'qa_receipts',
    ],
    optional_components: ['executive_summary', 'internal_links'],
    conditional_components: [],
    structural_invariants: {
      min_sections: 4,
      max_sections: 7,
      requires_comparison_table: true,
      min_faq_items: 4,
      max_faq_items: 6,
      exact_inline_media_count: 4,
      requires_technical_references: true,
      max_paragraph_words: 60,
      advisory_word_count: {
        min: 1000,
        max: 1500,
        guideline_name: 'Buying Guide'
      }
    },
  },

  product_review: {
    profile: 'product_review',
    title: 'Building Product Field Evaluation',
    description: 'Practical evaluation of brand specific products without verdict bias or promotional jargon.',
    search_intent: 'commercial_investigation',
    required_components: [
      'identity',
      'seo',
      'evidence_pack',
      'key_takeaways',
      'narrative',
      'cover_hero',
      'inline_media',
      'faq',
      'metadata',
      'publication_schedule',
      'qa_receipts',
    ],
    optional_components: ['executive_summary', 'internal_links', 'technical_references'],
    conditional_components: [],
    structural_invariants: {
      min_sections: 4,
      max_sections: 8,
      requires_comparison_table: true,
      min_faq_items: 3,
      max_faq_items: 5,
      exact_inline_media_count: 4,
      requires_technical_references: false,
      max_paragraph_words: 60,
      advisory_word_count: {
        min: 1000,
        max: 1500,
        guideline_name: 'Buying Guide'
      }
    },
  },

  tutorial: {
    profile: 'tutorial',
    title: 'Step-by-Step Installation Tutorial',
    description: 'Actionable installation procedures for builders, supervisors, or capable homeowners.',
    search_intent: 'informational',
    required_components: [
      'identity',
      'seo',
      'evidence_pack',
      'key_takeaways',
      'narrative',
      'cover_hero',
      'inline_media',
      'technical_references',
      'metadata',
      'publication_schedule',
      'qa_receipts',
    ],
    optional_components: ['executive_summary', 'faq', 'internal_links'],
    conditional_components: [],
    structural_invariants: {
      min_sections: 5,
      max_sections: 10,
      requires_comparison_table: false,
      min_faq_items: 3,
      max_faq_items: 5,
      exact_inline_media_count: 4,
      requires_technical_references: true,
      max_paragraph_words: 50,
      advisory_word_count: {
        min: 500,
        max: 800,
        guideline_name: 'Simple Tips'
      }
    },
  },

  general_editorial: {
    profile: 'general_editorial',
    title: 'Standard Architectural Editorial',
    description: 'Thoughtful essays on home design, spatial planning, and living environments.',
    search_intent: 'informational',
    required_components: [
      'identity',
      'seo',
      'evidence_pack',
      'key_takeaways',
      'narrative',
      'cover_hero',
      'inline_media',
      'metadata',
      'publication_schedule',
      'qa_receipts',
    ],
    optional_components: ['executive_summary', 'faq', 'internal_links', 'technical_references'],
    conditional_components: [],
    structural_invariants: {
      min_sections: 4,
      max_sections: 8,
      requires_comparison_table: false,
      min_faq_items: 0,
      max_faq_items: 5,
      exact_inline_media_count: 4,
      requires_technical_references: false,
      max_paragraph_words: 60,
      advisory_word_count: {
        min: 800,
        max: 1200,
        guideline_name: 'Design Inspiration'
      }
    },
  },
};

export interface BlueprintValidationResult {
  passed: boolean;
  profile: ArticleProfileType;
  missing_required: ArticleComponentType[];
  structural_violations: string[];
  warnings: string[];
}

/**
 * Validate an article assembly or component map against its assigned Blueprint.
 */
export function validateArticleAgainstBlueprint(
  profile: ArticleProfileType,
  components: Partial<ComponentDataMap>,
  validationStatuses: Record<ArticleComponentType, ValidationStatus>
): BlueprintValidationResult {
  const blueprint = ARTICLE_BLUEPRINT_REGISTRY[profile];
  if (!blueprint) {
    throw new Error(`[BlueprintEngine] Unknown profile '${profile}'.`);
  }

  const missing_required: ArticleComponentType[] = [];
  const structural_violations: string[] = [];
  const warnings: string[] = [];

  // 1. Check required components
  for (const compType of blueprint.required_components) {
    const data = components[compType];
    const status = validationStatuses[compType];
    if (!data || status === 'MISSING' || status === 'BLOCKED') {
      missing_required.push(compType);
    }
  }

  // 2. Structural invariants
  const narrative = components.narrative;
  if (narrative) {
    const sectionCount = narrative.sections.length;
    if (sectionCount < blueprint.structural_invariants.min_sections) {
      structural_violations.push(
        `Narrative has ${sectionCount} sections; minimum required is ${blueprint.structural_invariants.min_sections}`
      );
    }
    if (sectionCount > blueprint.structural_invariants.max_sections) {
      structural_violations.push(
        `Narrative has ${sectionCount} sections; maximum permitted is ${blueprint.structural_invariants.max_sections}`
      );
    }

    // Check comparison table requirement
    if (blueprint.structural_invariants.requires_comparison_table) {
      const hasTable = narrative.sections.some(s => 
        s.paragraphs.some(p => p.includes('<table>') || (/\|/.test(p) && /\|[\s:-]+---/.test(p)))
      );
      if (!hasTable) {
        structural_violations.push(
          `Profile '${profile}' requires a comparison table, but none was detected in narrative sections.`
        );
      }
    }
  }

  // 3. FAQ requirements
  const faq = components.faq;
  if (blueprint.structural_invariants.min_faq_items > 0) {
    const faqCount = faq?.items?.length || 0;
    if (faqCount < blueprint.structural_invariants.min_faq_items) {
      structural_violations.push(
        `FAQ has ${faqCount} items; minimum required is ${blueprint.structural_invariants.min_faq_items}`
      );
    }
    if (faqCount > blueprint.structural_invariants.max_faq_items) {
      warnings.push(
        `FAQ has ${faqCount} items; recommended maximum is ${blueprint.structural_invariants.max_faq_items}`
      );
    }
  }

  // 4. Inline media requirements
  const inlineMedia = components.inline_media;
  if (inlineMedia) {
    const mediaCount = inlineMedia.items?.length || 0;
    if (mediaCount !== blueprint.structural_invariants.exact_inline_media_count) {
      structural_violations.push(
        `Inline media has ${mediaCount} items; exact requirement is ${blueprint.structural_invariants.exact_inline_media_count}`
      );
    }
  }

  // 5. Technical references requirement
  if (blueprint.structural_invariants.requires_technical_references) {
    const refs = components.technical_references;
    if (!refs || refs.references.length === 0) {
      structural_violations.push(
        `Profile '${profile}' requires technical references, but none are registered.`
      );
    }
  }

  return {
    passed: missing_required.length === 0 && structural_violations.length === 0,
    profile,
    missing_required,
    structural_violations,
    warnings,
  };
}
