/**
 * RancangLoka — Object-First Editorial Visuals Policy v1.0
 * Module: src/lib/editorial/object-first-visual-policy.ts
 *
 * OWNER EDITORIAL DIRECTIVE (2026-11-22):
 * "Owner has explicitly rejected infographic-style visual comparisons for normal editorial articles.
 *  RancangLoka is a premium digital architecture and interior design magazine, NOT a technical presentation or textbook.
 *  Always prioritize photorealistic images of the actual materials, objects, architectural elements, construction details,
 *  or spaces discussed in the article. When comparing products or materials, show physical objects side by side using
 *  premium editorial photography. Do NOT automatically create comparison tables or diagrams as images."
 *
 * CORE INVARIANTS:
 * 1. OBJECT-FIRST DEFAULT: Prioritize physical materials, architectural elements, and real spaces.
 * 2. PHYSICAL COMPARISON RULE: Material comparisons (e.g. SPC vs Vinyl LVP) must depict authentic physical samples
 *    side by side under natural daylight, displaying tactile surface textures and cut-edge profiles.
 * 3. FORBIDDEN BY DEFAULT: Infographics, comparison tables embedded in images, presentation slides, text-heavy diagrams,
 *    dark dashboard-style graphics, UI panels, excessive arrows, callouts, and artificial structures.
 * 4. OWNER OVERRIDE EXCEPTION: Technical diagrams/infographics allowed ONLY when explicitly authorized with an owner token.
 * 5. PIPELINE ENFORCEMENT: Enforced across Budi (Prompt & Generation), Joko/Rina (Placement & Review),
 *    Jefry (Supervision), and Sari (Pre-publication QA).
 */

export const OBJECT_FIRST_POLICY_VERSION = 'v1.1';
export const OBJECT_FIRST_MILESTONE = 'RANCANGLOKA_OBJECT_FIRST_VISUALS_V1_1';
export const PRE_CLOSING_VISUAL_RULE_VERSION = 'v1.1';

/**
 * Permanent Visual Distribution Target for Standard RancangLoka Editorial Articles:
 * - 1 Featured Cover Hero (16:9 or 1.99:1)
 * - 3 Inline Supporting Visuals (16:9)
 * - 1 Final Pre-Closing Visual (16:9, placed before closing/decision section)
 * Total standard minimum: 4 inlines + 1 cover = 5 visuals per article.
 */
export const CANONICAL_EDITORIAL_VISUAL_TARGETS = {
  COVER_HERO: 1,
  INLINE_SUPPORTING_MINIMUM: 3,
  PRE_CLOSING_MINIMUM: 1,
  TOTAL_INLINE_MINIMUM: 4,
  TOTAL_ARTICLE_MINIMUM: 5
} as const;

/**
 * Patterns identifying closing, recommendation, or decision sections in Indonesian editorial manuscripts.
 */
export const CLOSING_SECTION_HEADING_PATTERNS = [
  /^jadi[,\s]/i,
  /bagaimana mengambil keputusan/i,
  /menentukan pilihan/i,
  /kapan .* layak/i,
  /rekomendasi praktis/i,
  /pertimbangan akhir/i,
  /panduan memilih/i,
  /langkah penutup/i,
  /kesimpulan praktis/i,
  /solusi akhir/i
];

/**
 * Helper to detect and extract the pre-closing/closing heading from a list of headings or sections.
 */
export function detectClosingSectionHeading(headings: string[] | { title: string }[]): string | null {
  if (!headings || headings.length === 0) return null;

  const rawTitles = headings.map(h => (typeof h === 'string' ? h : h.title).trim());
  const nonContentPatterns = /faq|tanya-jawab|catatan|referensi|baca juga/i;
  const eligibleTitles = rawTitles.filter(t => !nonContentPatterns.test(t));

  if (eligibleTitles.length === 0) return null;

  // 1. First priority: match explicit closing patterns
  for (const title of eligibleTitles) {
    for (const pattern of CLOSING_SECTION_HEADING_PATTERNS) {
      if (pattern.test(title)) {
        return title;
      }
    }
  }

  // 2. Second priority: the last eligible heading if more than 2 headings exist
  if (eligibleTitles.length >= 3) {
    return eligibleTitles[eligibleTitles.length - 1];
  }

  return null;
}

/**
 * Visual styles strictly prohibited by default for normal editorial visuals.
 */
export const FORBIDDEN_VISUAL_STYLES = [
  'infographic',
  'comparison table embedded in image',
  'presentation slide',
  'pitch deck slide',
  'text-heavy diagram',
  'dark dashboard-style graphic',
  'ui panel masquerading as visual',
  'excessive arrows, callouts, and labels',
  'artificial or technically impossible material structures'
] as const;

/**
 * Canonical negative prompt tokens injected by default to prevent AI generators
 * from producing presentation graphics, tables, or synthetic UI panels.
 */
export const CANONICAL_OBJECT_FIRST_NEGATIVES = [
  'infographic',
  'comparison table',
  'data table',
  'presentation slide',
  'pitch deck',
  'bullet points in image',
  'dark tech background',
  'dashboard UI',
  'UI panel',
  'text overlay',
  'embedded typography',
  'callout arrows',
  'diagrammatic labels',
  'exploded diagram',
  'schematic illustration',
  '3D CGI render',
  'glossy plastic render',
  'cartoon',
  'vector art',
  'unrealistic synthetic materials',
  'watermark',
  'brand logo',
  'distorted geometry',
  'fake cross-section'
] as const;

/**
 * Required positive visual direction tokens for premium architectural photography.
 */
export const CANONICAL_OBJECT_FIRST_POSITIVE_DIRECTION = [
  'premium architectural editorial photography',
  'photorealistic physical materials and objects',
  'natural window daylight',
  'authentic physical proportions and real construction details',
  'clean sophisticated composition',
  'tactile realistic textures',
  'subtle depth of field',
  'minimal visual clutter',
  'no text in image',
  'no labels or callouts'
] as const;

export type VisualTopicType = 'material_comparison' | 'architectural_space' | 'construction_detail' | 'general_editorial';

export interface ObjectFirstPromptConfig {
  topic_type: VisualTopicType;
  subject_a?: string;
  subject_b?: string;
  context_surface?: string;
  lighting?: string;
  allow_infographic_override?: boolean;
  owner_authorization_token?: string;
}

export interface ObjectFirstPromptResult {
  positive_tokens: string;
  negative_tokens: string[];
  is_infographic_forbidden: boolean;
  is_owner_authorized_override: boolean;
  policy_version: string;
}

/**
 * Compiles object-first prompt tokens for Budi Prompt Engine.
 * If topic is a comparison (e.g. SPC vs Vinyl), enforces macro physical sample photography.
 */
export function compileObjectFirstPromptTokens(config: ObjectFirstPromptConfig): ObjectFirstPromptResult {
  const isOverride = Boolean(
    config.allow_infographic_override &&
    config.owner_authorization_token &&
    config.owner_authorization_token.startsWith('OWNER_AUTH_')
  );

  const negativeTokens = Array.from(new Set(CANONICAL_OBJECT_FIRST_NEGATIVES));

  if (isOverride) {
    return {
      positive_tokens: 'technical architectural schematic illustration, clean informative graphic',
      negative_tokens: ['watermark', 'logo', 'distorted geometry', 'advertisement'],
      is_infographic_forbidden: false,
      is_owner_authorized_override: true,
      policy_version: OBJECT_FIRST_POLICY_VERSION
    };
  }

  let positiveTokens = '';

  if (config.topic_type === 'material_comparison' && config.subject_a && config.subject_b) {
    const surface = config.context_surface || 'refined neutral tabletop or floor';
    const light = config.lighting || 'soft natural window daylight';
    positiveTokens = [
      `luxury editorial macro-style photograph of two flooring material samples comparing ${config.subject_a} and ${config.subject_b}`,
      `arranged side by side on a ${surface} in ${light}`,
      `emphasize the physical difference between the materials through tactile surface textures and cut-edge profiles`,
      `clean composition, shallow depth of field, realistic optical rendering, balanced exposure, subtle filmic color`,
      `natural material fidelity, no text, no labels, no comparison table, no infographic overlays`
    ].join(', ');
  } else {
    positiveTokens = CANONICAL_OBJECT_FIRST_POSITIVE_DIRECTION.join(', ');
  }

  return {
    positive_tokens: positiveTokens,
    negative_tokens: negativeTokens,
    is_infographic_forbidden: true,
    is_owner_authorized_override: false,
    policy_version: OBJECT_FIRST_POLICY_VERSION
  };
}

/**
 * Inspection helper to detect if a prompt, caption, or visual brief attempts
 * to produce forbidden infographic or presentation slide styles.
 */
export function detectForbiddenVisualStyles(text: string): { hasForbiddenStyles: boolean; detectedViolations: string[] } {
  if (!text) return { hasForbiddenStyles: false, detectedViolations: [] };

  const lower = text.toLowerCase();
  const violations: string[] = [];

  // Keywords that indicate presentation / infographic / table rather than real photography
  const forbiddenPatterns = [
    { pattern: /\binfographic\b/i, name: 'Infographic keyword' },
    { pattern: /\bcomparison table\b/i, name: 'Embedded comparison table' },
    { pattern: /\bpresentation slide\b/i, name: 'Presentation slide styling' },
    { pattern: /\bpitch deck\b/i, name: 'Pitch deck graphics' },
    { pattern: /\bdashboard (ui|panel)\b/i, name: 'Dashboard UI panel' },
    { pattern: /\bcallout arrows?\b/i, name: 'Excessive callout arrows' },
    { pattern: /\bdiagram with (labels|text)\b/i, name: 'Text-heavy labeled diagram' },
    { pattern: /\bexploded diagram\b/i, name: 'Exploded technical diagram' }
  ];

  for (const item of forbiddenPatterns) {
    if (item.pattern.test(lower)) {
      violations.push(item.name);
    }
  }

  return {
    hasForbiddenStyles: violations.length > 0,
    detectedViolations: violations
  };
}

export interface ObjectFirstGateInput {
  candidate_id: string;
  prompt?: string;
  negative_prompt?: string;
  caption?: string;
  media_type?: 'photograph' | 'diagram' | 'render' | 'unknown';
  is_infographic_flagged?: boolean;
  is_comparison_table?: boolean;
  is_presentation_slide?: boolean;
  allow_infographic_override?: boolean;
  owner_authorization_token?: string;
}

export interface ObjectFirstGateResult {
  passed: boolean;
  score: number; // 0 - 100
  verdict: 'PASS' | 'FAIL' | 'NEEDS_REVIEW';
  violations: string[];
  notes: string;
  policy_version: string;
}

/**
 * Automated policy gate evaluator consumed by Sari (Pre-publication QA),
 * Jefry (Operational Supervision), and Budi (Prompt & Candidate QA).
 */
export function evaluateObjectFirstPolicyGate(input: ObjectFirstGateInput): ObjectFirstGateResult {
  const isAuthorizedOverride = Boolean(
    input.allow_infographic_override &&
    input.owner_authorization_token &&
    input.owner_authorization_token.startsWith('OWNER_AUTH_')
  );

  if (isAuthorizedOverride) {
    return {
      passed: true,
      score: 100,
      verdict: 'PASS',
      violations: [],
      notes: 'Explicit Owner authorization override granted for technical schematic/infographic.',
      policy_version: OBJECT_FIRST_POLICY_VERSION
    };
  }

  const violations: string[] = [];

  // Check explicit flags
  if (input.is_infographic_flagged) {
    violations.push('Visual is marked as an infographic without Owner authorization.');
  }
  if (input.is_comparison_table) {
    violations.push('Visual contains an embedded comparison table.');
  }
  if (input.is_presentation_slide) {
    violations.push('Visual is formatted as a presentation slide / pitch deck.');
  }

  // Check text content in prompt and caption
  if (input.prompt) {
    const promptCheck = detectForbiddenVisualStyles(input.prompt);
    if (promptCheck.hasForbiddenStyles) {
      violations.push(...promptCheck.detectedViolations.map(v => `Prompt violation: ${v}`));
    }
  }

  if (input.caption) {
    const captionCheck = detectForbiddenVisualStyles(input.caption);
    if (captionCheck.hasForbiddenStyles) {
      violations.push(...captionCheck.detectedViolations.map(v => `Caption violation: ${v}`));
    }
  }

  // Enforce negative constraints presence in generation prompt if provided
  if (input.prompt && input.negative_prompt) {
    const negLower = input.negative_prompt.toLowerCase();
    const missingCrucialNegatives = ['infographic', 'table'].filter(term => !negLower.includes(term));
    if (missingCrucialNegatives.length > 0) {
      violations.push(`Negative prompt missing mandatory anti-infographic constraints: ${missingCrucialNegatives.join(', ')}`);
    }
  }

  if (violations.length > 0) {
    return {
      passed: false,
      score: Math.max(0, 100 - violations.length * 35),
      verdict: 'FAIL',
      violations,
      notes: 'Visual violates Object-First Editorial Policy: default must be physical object/material photography, not infographic or table.',
      policy_version: OBJECT_FIRST_POLICY_VERSION
    };
  }

  return {
    passed: true,
    score: 100,
    verdict: 'PASS',
    violations: [],
    notes: 'Complies with Object-First Editorial Policy: photorealistic material/architectural object direction verified.',
    policy_version: OBJECT_FIRST_POLICY_VERSION
  };
}

/**
 * RANCANGLOKA TOPIC-OBJECT SEMANTIC RELEVANCE AUDIT (GENERIC / REUSABLE)
 *
 * Implements the reusable topic-object-first policy:
 * 1. Extracts concrete physical construction objects from:
 *    - Article topic
 *    - Evidence-backed technical claims (Author Safe Claims)
 *    - Relevant section content/headings
 * 2. Rejects generic interior prompts that describe generic rooms without
 *    identifying the physical subject matter of the article.
 * 3. Never hardcodes to any specific article number or domain.
 */
export interface TopicObjectRelevanceAuditResult {
  passed: boolean;
  score: number; // 0 - 100
  verdict: 'PASS' | 'FAIL' | 'NEEDS_REVIEW';
  extracted_topic_objects: string[];
  matched_objects_in_prompt: string[];
  is_generic_slop: boolean;
  rejection_reasons: string[];
}

export function extractConcreteTopicObjects(params: {
  topic: string;
  claims?: Array<{ statement?: string; applicability?: string; claim_id?: string }>;
  sectionHeading?: string;
  sectionContent?: string;
}): string[] {
  const combinedText = [
    params.topic || '',
    params.sectionHeading || '',
    params.sectionContent || '',
    ...(params.claims || []).map(c => `${c.statement || ''} ${c.applicability || ''}`)
  ].join(' ').toLowerCase();

  // Common architectural stop words to ignore
  const stopWords = new Set([
    'cara', 'mengurangi', 'tanpa', 'membuat', 'memilih', 'panduan', 'solusi', 'antara', 'antarkamar',
    'rumah', 'hunian', 'indonesia', 'ruangan', 'kamar', 'pilihan', 'tepat', 'praktis', 'terbaik',
    'yang', 'untuk', 'dengan', 'pada', 'bisa', 'dalam', 'akan', 'atau', 'dari', 'lebih', 'adalah'
  ]);

  // Extract 2-word noun phrases or distinctive physical object terms
  const words = combinedText
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopWords.has(w));

  const objectFrequencies: Record<string, number> = {};
  for (const w of words) {
    objectFrequencies[w] = (objectFrequencies[w] || 0) + 1;
  }

  // Filter terms with meaningful technical resonance (frequency >= 2 or length >= 5)
  return Object.entries(objectFrequencies)
    .filter(([term, count]) => count >= 2 || term.length >= 6)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([term]) => term);
}

export function auditTopicObjectSemanticRelevance(params: {
  prompt: string;
  topic: string;
  claims?: Array<{ statement?: string; applicability?: string }>;
  sectionHeading?: string;
  role?: string;
}): TopicObjectRelevanceAuditResult {
  const { prompt, topic, claims, sectionHeading, role } = params;
  const promptLower = (prompt || '').toLowerCase();
  const rejectionReasons: string[] = [];

  const extractedObjects = extractConcreteTopicObjects({
    topic,
    claims,
    sectionHeading
  });

  // Check which concrete objects appear in the prompt
  const matchedObjects = extractedObjects.filter(obj => {
    const reg = new RegExp(`\\b${obj}\\b`, 'i');
    return reg.test(promptLower);
  });

  // Detect generic interior slop:
  // Mentions generic tropical residence, interior, or wooden structures, but ZERO topic objects
  const hasGenericInteriorKeywords = /contemporary indonesian (residence|home|interior)|authentic residential setting|living space/i.test(promptLower);
  const isGenericSlop = hasGenericInteriorKeywords && matchedObjects.length === 0;

  if (isGenericSlop) {
    rejectionReasons.push('Prompt is generic architectural interior filler: does not depict the physical subject matter of the article.');
  }

  if (matchedObjects.length === 0 && extractedObjects.length > 0) {
    rejectionReasons.push(`No concrete physical objects from topic/claims found in prompt. Expected terms like: ${extractedObjects.slice(0, 5).join(', ')}`);
  }

  const score = Math.min(100, Math.round((matchedObjects.length / Math.max(1, Math.min(4, extractedObjects.length))) * 100));
  const passed = !isGenericSlop && matchedObjects.length >= 1;

  return {
    passed,
    score,
    verdict: passed ? 'PASS' : (matchedObjects.length > 0 ? 'NEEDS_REVIEW' : 'FAIL'),
    extracted_topic_objects: extractedObjects,
    matched_objects_in_prompt: matchedObjects,
    is_generic_slop: isGenericSlop,
    rejection_reasons: rejectionReasons
  };
}
