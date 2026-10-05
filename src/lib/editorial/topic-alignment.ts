/**
 * RancangLoka Topic ↔ Evidence Alignment Gate
 * Milestone: EDITORIAL-RUNTIME-4A
 *
 * Implements the pre-writing invariant:
 * EVIDENCE_PACK_MUST_ADDRESS_REQUESTED_TOPIC
 *
 * Rejects internally valid but off-topic evidence packs with:
 * - TOPIC_EVIDENCE_ALIGNMENT_FAIL
 * - RESEARCH_COVERAGE_INSUFFICIENT
 */

import type {
  EvidencePackInput
} from '../article/human-quality.ts';

import {
  generateEditorialResearchQuestions,
  validateResearchQuestionCoverage,
  type EditorialResearchQuestion,
  type ResearchCoverageResult
} from './research-questions.ts';

export type BuildingDomain =
  | 'MOISTURE_WALL_REMEDIATION'
  | 'ROOF_THERMAL_ATTIC'
  | 'FENESTRATION_WINDOW_DOOR'
  | 'FLOORING_SURFACE'
  | 'STRUCTURAL_FOUNDATION'
  | 'GENERAL_BUILDING';

export interface TopicAlignmentResult {
  aligned: boolean;
  topic: string;
  topic_domain: BuildingDomain;
  evidence_domain: BuildingDomain;
  topic_entities: string[];
  evidence_entities: string[];
  entity_overlap_score: number;
  domain_match: boolean;
  research_coverage?: ResearchCoverageResult;
  rejection_code?: 'TOPIC_EVIDENCE_ALIGNMENT_FAIL' | 'RESEARCH_COVERAGE_INSUFFICIENT' | 'ADMISSIBLE_COVERAGE_AUTHORITY_MISMATCH';
  rejection_reason?: string;
}

const DOMAIN_VOCABULARIES: Record<BuildingDomain, string[]> = {
  MOISTURE_WALL_REMEDIATION: [
    'dinding', 'tembok', 'lembap', 'jamur', 'berjamur', 'waterproofing', 'rembes',
    'kapiler', 'plester', 'aci', 'cat', 'semen', 'bocor', 'air', 'moisture',
    'mold', 'mould', 'efflorescence', 'damp', 'rising damp', 'water'
  ],
  ROOF_THERMAL_ATTIC: [
    'atap', 'metal', 'seng', 'galvalum', 'foil', 'radiant', 'barrier', 'loteng',
    'attic', 'plafon', 'ventilasi', 'radiasi', 'panas', 'soffit', 'ridge',
    'solar', 'thermal', 'heat transfer', 'conduction', 'emittance', 'emissivity'
  ],
  FENESTRATION_WINDOW_DOOR: [
    'kusen', 'jendela', 'pintu', 'aluminium', 'upvc', 'kaca', 'profil',
    'frame', 'window', 'door', 'acoustic', 'kedap suara', 'seal'
  ],
  FLOORING_SURFACE: [
    'lantai', 'keramik', 'granit', 'popping', 'nat', 'screed', 'vinil', 'spc',
    'tile', 'mortar', 'subfloor'
  ],
  STRUCTURAL_FOUNDATION: [
    'pondasi', 'retak', 'amblas', 'tanah', 'tiang', 'sloof', 'kolom',
    'settlement', 'foundation', 'soil', 'structural'
  ],
  GENERAL_BUILDING: [
    'bangunan', 'rumah', 'material', 'biaya', 'renovasi', 'tukang', 'kontraktor'
  ]
};

/**
 * Classifies the primary building domain of a topic or text snippet.
 */
export function classifyBuildingDomain(text: string): { domain: BuildingDomain; score: number; detectedTerms: string[] } {
  const lower = text.toLowerCase();
  let bestDomain: BuildingDomain = 'GENERAL_BUILDING';
  let maxMatches = 0;
  let bestTerms: string[] = [];

  for (const [dom, vocab] of Object.entries(DOMAIN_VOCABULARIES)) {
    if (dom === 'GENERAL_BUILDING') continue;
    const matches = vocab.filter(term => {
      const pattern = new RegExp(`\\b${term}\\b`, 'i');
      return pattern.test(lower);
    });

    if (matches.length > maxMatches) {
      maxMatches = matches.length;
      bestDomain = dom as BuildingDomain;
      bestTerms = matches;
    }
  }

  return { domain: bestDomain, score: maxMatches, detectedTerms: bestTerms };
}

/**
 * Deterministically audits topic-to-evidence alignment.
 */
export function auditTopicEvidenceAlignment(
  topic: string,
  evidencePack: EvidencePackInput,
  options?: {
    researchQuestions?: EditorialResearchQuestion[];
    minOverlapScore?: number;
  }
): TopicAlignmentResult {
  const topicClassification = classifyBuildingDomain(topic);
  const topicDomain = topicClassification.domain;
  const topicEntities = topicClassification.detectedTerms;

  // Aggregate all textual evidence in the pack
  const passages = Array.isArray(evidencePack.evidence_passages) ? evidencePack.evidence_passages : [];
  const claims = Array.isArray(evidencePack.claim_inventory) ? evidencePack.claim_inventory : [];
  const docs = Array.isArray(evidencePack.retrieved_documents) ? evidencePack.retrieved_documents : [];

  const evidenceTextCorp = [
    docs.map(d => `${d.title} ${d.limitations || ''}`).join(' '),
    passages.map(p => `${p.locator} ${p.exact_or_normalized_excerpt || (p as any).exact_text || ''}`).join(' '),
    claims.map(c => `${c.statement} ${c.relevance || ''}`).join(' ')
  ].join(' ');

  const evidenceClassification = classifyBuildingDomain(evidenceTextCorp);
  const evidenceDomain = evidenceClassification.domain;
  const evidenceEntities = evidenceClassification.detectedTerms;

  // Check domain entity presence in evidence
  const matchingEntitiesInEvidence = topicEntities.filter(entity => {
    const pattern = new RegExp(`\\b${entity}\\b`, 'i');
    return pattern.test(evidenceTextCorp);
  });

  const overlapScore = topicEntities.length > 0
    ? matchingEntitiesInEvidence.length / topicEntities.length
    : (evidenceEntities.length > 0 ? 1 : 0);

  // Domain mismatch rule:
  // If topic belongs to a specific domain (e.g. MOISTURE_WALL_REMEDIATION) and evidence belongs
  // to an entirely different specific domain (e.g. ROOF_THERMAL_ATTIC), or overlap is 0:
  const isDirectDomainMismatch =
    topicDomain !== 'GENERAL_BUILDING' &&
    evidenceDomain !== 'GENERAL_BUILDING' &&
    topicDomain !== evidenceDomain;

  const hasZeroTopicEntities = topicEntities.length > 0 && matchingEntitiesInEvidence.length === 0;

  if (isDirectDomainMismatch || hasZeroTopicEntities) {
    return {
      aligned: false,
      topic,
      topic_domain: topicDomain,
      evidence_domain: evidenceDomain,
      topic_entities: topicEntities,
      evidence_entities: evidenceEntities,
      entity_overlap_score: overlapScore,
      domain_match: false,
      rejection_code: 'TOPIC_EVIDENCE_ALIGNMENT_FAIL',
      rejection_reason: `TOPIC_EVIDENCE_ALIGNMENT_FAIL: Paket bukti berada pada ranah domain yang salah (${evidenceDomain}), tidak mencakup topik artikel yang diminta (${topicDomain}: "${topic}"). Entitas topik terdeteksi: [${topicEntities.join(', ')}], namun bukti membahas domain [${evidenceEntities.slice(0, 5).join(', ')}].`
    };
  }

  // Validate Research Questions coverage
  const questions = options?.researchQuestions || generateEditorialResearchQuestions(topic);
  const coverageResult = validateResearchQuestionCoverage(questions, evidencePack, {
    executionType: (evidencePack as any).execution_type || (options as any)?.executionType,
    minCoverageRatio: options?.minOverlapScore
  });

  if (!coverageResult.covered) {
    const code = coverageResult.rejection_code || 'RESEARCH_COVERAGE_INSUFFICIENT';
    return {
      aligned: false,
      topic,
      topic_domain: topicDomain,
      evidence_domain: evidenceDomain,
      topic_entities: topicEntities,
      evidence_entities: evidenceEntities,
      entity_overlap_score: overlapScore,
      domain_match: true,
      research_coverage: coverageResult,
      rejection_code: code,
      rejection_reason: coverageResult.rejection_reason
    };
  }

  return {
    aligned: true,
    topic,
    topic_domain: topicDomain,
    evidence_domain: evidenceDomain,
    topic_entities: topicEntities,
    evidence_entities: evidenceEntities,
    entity_overlap_score: overlapScore,
    domain_match: true,
    research_coverage: coverageResult
  };
}
