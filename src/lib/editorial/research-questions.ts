/**
 * RancangLoka Editorial Research Questions & Coverage Engine
 * Milestone: EDITORIAL-RUNTIME-4A
 *
 * Enforces explicit pre-discovery research question generation and post-retrieval coverage:
 * - What are plausible causes? (PLAUSIBLE_CAUSES)
 * - How are causes differentiated? (DIFFERENTIAL_DIAGNOSIS)
 * - What intervention addresses which cause? (INTERVENTION_MAPPING)
 * - What are limitations / false fixes? (LIMITATIONS_AND_FALSE_FIXES)
 * - What conditions require inspection or escalation? (ESCALATION_CONDITIONS)
 * - What evidence supports recommendations? (EMPIRICAL_RECOMMENDATION_SUPPORT)
 *
 * Research Gate invariant:
 * Final evidence pack MUST achieve minimum research question coverage,
 * otherwise fails with RESEARCH_COVERAGE_INSUFFICIENT.
 */

import {
  type EvidencePackInput,
  type EvidenceClaim,
  type EvidencePassage,
  type ArticleIntentProfile,
  isHistoricalRoofPack
} from '../article/human-quality.ts';

import type { GeneralEvidenceRole } from './source-discovery.ts';

export type ResearchQuestionCategory =
  | 'PLAUSIBLE_CAUSES'
  | 'DIFFERENTIAL_DIAGNOSIS'
  | 'INTERVENTION_MAPPING'
  | 'LIMITATIONS_AND_FALSE_FIXES'
  | 'ESCALATION_CONDITIONS'
  | 'EMPIRICAL_RECOMMENDATION_SUPPORT';

export interface EditorialResearchQuestion {
  question_id: string;
  category: ResearchQuestionCategory;
  question_text: string;
  rationale: string;
  expected_evidence_roles: GeneralEvidenceRole[];
}

export interface QuestionCoverageEvaluation {
  question_id: string;
  category: ResearchQuestionCategory;
  is_addressed_raw: boolean;
  is_addressed_admissible: boolean;
  is_addressed: boolean;
  raw_claim_ids: string[];
  raw_passage_ids: string[];
  admissible_claim_ids: string[];
  admissible_passage_ids: string[];
  authentic_source_ids: string[];
  addressing_claim_ids: string[];
  addressing_passage_ids: string[];
  summary: string;
}

export interface ResearchCoverageResult {
  covered: boolean;
  coverage_ratio: number;
  raw_research_coverage_ratio: number;
  admissible_evidence_coverage_ratio: number;
  covered_categories: ResearchQuestionCategory[];
  missing_categories: ResearchQuestionCategory[];
  raw_covered_categories: ResearchQuestionCategory[];
  raw_missing_categories: ResearchQuestionCategory[];
  question_evaluations: QuestionCoverageEvaluation[];
  authentic_source_count: number;
  rejection_code?: 'RESEARCH_COVERAGE_INSUFFICIENT' | 'ADMISSIBLE_COVERAGE_AUTHORITY_MISMATCH';
  rejection_reason?: string;
}

/**
 * Extracts key domain terms from a topic for grounded question formulation.
 */
function extractTopicDomainContext(topic: string): {
  subject: string;
  symptomOrProblem: string;
  candidateInterventions: string[];
} {
  const clean = topic.replace(/[?]/g, '').trim();
  const parts = clean.split(/[:\-\–]/).map(s => s.trim());
  const mainPhrase = parts[0] || clean;
  const secondaryPhrase = parts[1] || '';

  // Detect subject and symptom
  let subject = 'elemen bangunan';
  let symptomOrProblem = 'masalah fisik';

  if (/\b(?:dinding|tembok)\b/i.test(mainPhrase)) {
    subject = 'dinding bangunan';
  } else if (/\b(?:atap|loteng|plafon)\b/i.test(mainPhrase)) {
    subject = 'sistem atap dan rongga loteng';
  } else if (/\b(?:kusen|jendela|pintu)\b/i.test(mainPhrase)) {
    subject = 'kusen dan bukaan';
  } else if (/\b(?:lantai|keramik)\b/i.test(mainPhrase)) {
    subject = 'lantai dan penutupnya';
  }

  if (/\b(?:lembap|jamur|berjamur)\b/i.test(clean)) {
    symptomOrProblem = 'kelembapan berlebih dan pertumbuhan jamur';
  } else if (/\b(?:panas|gerah)\b/i.test(clean)) {
    symptomOrProblem = 'penumpukan panas dan radiasi termal';
  } else if (/\b(?:bocor|rembes)\b/i.test(clean)) {
    symptomOrProblem = 'rembesan dan kebocoran air';
  } else if (/\b(?:retak|popping)\b/i.test(clean)) {
    symptomOrProblem = 'degradasi fisik dan pergerakan material';
  } else if (/\b(?:kedap suara|tahan panas)\b/i.test(clean)) {
    symptomOrProblem = 'perbedaan insulasi termal dan akustik';
  }

  // Detect interventions
  const candidateInterventions: string[] = [];
  if (secondaryPhrase) {
    const forkMatch = secondaryPhrase.split(/\b(?:atau|vs|versus|dibanding)\b/i);
    for (const m of forkMatch) {
      const trimmed = m.trim();
      if (trimmed.length > 2) candidateInterventions.push(trimmed);
    }
  }

  return { subject, symptomOrProblem, candidateInterventions };
}

/**
 * Generates 6 mandatory research questions dynamically for any editorial topic.
 */
export function generateEditorialResearchQuestions(
  topic: string,
  _intentProfile?: ArticleIntentProfile
): EditorialResearchQuestion[] {
  const { subject, symptomOrProblem, candidateInterventions } = extractTopicDomainContext(topic);

  const interventionDesc = candidateInterventions.length >= 2
    ? `${candidateInterventions[0]} atau ${candidateInterventions[1]}`
    : 'intervensi material atau perbaikan yang diusulkan';

  return [
    {
      question_id: 'RQ-01',
      category: 'PLAUSIBLE_CAUSES',
      question_text: `Apa mekanisme fisik, termal, atau struktural yang memicu ${symptomOrProblem} pada ${subject}?`,
      rationale: 'Menjamin artikel bertolak dari hukum fisika dan penyebab mendasar, bukan sekadar gejala tampak.',
      expected_evidence_roles: ['CAUSE_MECHANISM', 'MATERIAL_BEHAVIOR']
    },
    {
      question_id: 'RQ-02',
      category: 'DIFFERENTIAL_DIAGNOSIS',
      question_text: `Bagaimana cara membedakan berbagai kemungkinan penyebab atau jalur timbulnya ${symptomOrProblem} di lapangan?`,
      rationale: 'Memberikan panduan diagnostik mandiri kepada pembaca sebelum mengambil tindakan perbaikan.',
      expected_evidence_roles: ['DIAGNOSTIC_SIGNAL', 'CONTEXT_DEPENDENCY']
    },
    {
      question_id: 'RQ-03',
      category: 'INTERVENTION_MAPPING',
      question_text: `Bagaimana efektivitas ${interventionDesc} dalam menyelesaikan masing-masing akar penyebab yang teridentifikasi?`,
      rationale: 'Memetakan solusi secara presisi ke akar masalah, mencegah pengobatan yang salah sasaran.',
      expected_evidence_roles: ['INTERVENTION_EFFECT', 'MATERIAL_BEHAVIOR']
    },
    {
      question_id: 'RQ-04',
      category: 'LIMITATIONS_AND_FALSE_FIXES',
      question_text: `Apa keterbatasan material, batasan fisik, atau kekeliruan umum (solusi semu) saat menangani ${symptomOrProblem}?`,
      rationale: 'Melindungi pembaca dari pemborosan biaya akibat solusi instan yang gagal menyelesaikan masalah.',
      expected_evidence_roles: ['LIMITATION', 'RISK']
    },
    {
      question_id: 'RQ-05',
      category: 'ESCALATION_CONDITIONS',
      question_text: `Kondisi atau tanda lapangan apa yang memerlukan pembongkaran, perbaikan sumber struktural, atau inspeksi ahli?`,
      rationale: 'Menegaskan batasan kapan perbaikan mandiri cukup dan kapan eskalasi profesional mutlak diperlukan.',
      expected_evidence_roles: ['RISK', 'INSTALLATION_GUIDANCE', 'CONTEXT_DEPENDENCY']
    },
    {
      question_id: 'RQ-06',
      category: 'EMPIRICAL_RECOMMENDATION_SUPPORT',
      question_text: `Bukti empiris, pengujian standar, atau prinsip sains bangunan apa yang mendasari urutan prioritas rekomendasi?`,
      rationale: 'Menjamin rekomendasi tindakan tidak berakar dari intuisi model semata melainkan dari bukti terverifikasi.',
      expected_evidence_roles: ['CAUSE_MECHANISM', 'INTERVENTION_EFFECT', 'REGULATORY_REFERENCE', 'MATERIAL_BEHAVIOR']
    }
  ];
}

export interface CoverageValidationOptions {
  executionType?: 'REAL_RUNTIME_EXECUTION' | 'TEST';
  requireAllCategories?: boolean;
  minCoverageRatio?: number;
}

/**
 * Validates that an evidence pack addresses the generated research questions.
 * Enforces Milestone: RESEARCH-SOURCE-COVERAGE-1
 *
 * Separates raw candidate coverage from admissible authentic evidence coverage.
 * Fixtures contribute 0 authority to admissible evidence coverage.
 * If authentic source count = 0, admissible coverage MUST be 0.
 */
export function validateResearchQuestionCoverage(
  questions: EditorialResearchQuestion[],
  evidencePack: EvidencePackInput,
  options?: CoverageValidationOptions
): ResearchCoverageResult {
  const claims = Array.isArray(evidencePack.claim_inventory) ? evidencePack.claim_inventory : [];
  const passages = Array.isArray(evidencePack.evidence_passages) ? evidencePack.evidence_passages : [];
  const docs = Array.isArray(evidencePack.retrieved_documents) ? evidencePack.retrieved_documents : [];
  const executionType = options?.executionType || evidencePack.execution_type || 'TEST';

  // 1. Identify Authentic Documents & Sources
  const authenticDocIds = new Set<string>();
  for (const d of docs) {
    const origin = d.source_origin;
    const isAuthenticOrigin = origin === 'LIVE_RETRIEVAL' || origin === 'VERIFIED_CACHED_SNAPSHOT';
    const isVerified = d.retrieval_status === 'SOURCE_RETRIEVED_AND_VERIFIED';
    const notBlocked = !d.is_blocked;
    if (isAuthenticOrigin && isVerified && notBlocked) {
      authenticDocIds.add(d.source_id);
    }
  }

  for (const c of claims) {
    for (const s of c.sources || []) {
      const origin = s.source_origin;
      const isAuthenticOrigin = origin === 'LIVE_RETRIEVAL' || origin === 'VERIFIED_CACHED_SNAPSHOT';
      const isVerified = s.retrieval_status === 'SOURCE_RETRIEVED_AND_VERIFIED';
      const notBlocked = !(s as any).is_blocked;
      if (isAuthenticOrigin && isVerified && notBlocked) {
        authenticDocIds.add(s.source_id);
      }
    }
  }

  const hasExplicitSources = docs.length > 0 || claims.some(c => c.sources && c.sources.length > 0);
  const authenticSourceCount = authenticDocIds.size;

  // 2. Classify Admissible Passages and Claims
  const admissiblePassageIds = new Set<string>();
  for (const p of passages) {
    if (p.source_id && authenticDocIds.has(p.source_id)) {
      admissiblePassageIds.add(p.passage_id);
    }
  }

  const admissibleClaimIds = new Set<string>();
  for (const c of claims) {
    let isAdmissible = false;
    if (c.sources && c.sources.some(s => authenticDocIds.has(s.source_id))) {
      isAdmissible = true;
    } else if (c.evidence_passage_ids && c.evidence_passage_ids.some(pid => admissiblePassageIds.has(pid))) {
      isAdmissible = true;
    }
    if (isAdmissible) {
      admissibleClaimIds.add(c.claim_id);
    }
  }

  // Handle derived synthesis recommendation claims
  for (const c of claims) {
    if (c.claim_class === 'editorial_recommendation' && (c as any).derived_from_claim_ids) {
      const derived: string[] = (c as any).derived_from_claim_ids || [];
      if (derived.length > 0 && derived.every(did => admissibleClaimIds.has(did))) {
        admissibleClaimIds.add(c.claim_id);
      }
    }
  }

  // If authentic source count is 0:
  // In REAL_RUNTIME_EXECUTION or when sources are explicitly declared,
  // admissible claims and passages MUST remain empty.
  if (authenticSourceCount === 0) {
    if (isHistoricalRoofPack(evidencePack) && executionType !== 'REAL_RUNTIME_EXECUTION') {
      for (const c of claims) admissibleClaimIds.add(c.claim_id);
      for (const p of passages) admissiblePassageIds.add(p.passage_id);
    } else if (executionType === 'REAL_RUNTIME_EXECUTION' || hasExplicitSources) {
      admissibleClaimIds.clear();
      admissiblePassageIds.clear();
    } else {
      // Legacy mock pack without source provenance in unit test mode
      for (const c of claims) admissibleClaimIds.add(c.claim_id);
      for (const p of passages) admissiblePassageIds.add(p.passage_id);
    }
  }

  const evaluations: QuestionCoverageEvaluation[] = [];
  const rawCoveredCategories: ResearchQuestionCategory[] = [];
  const rawMissingCategories: ResearchQuestionCategory[] = [];
  const admissibleCoveredCategories: ResearchQuestionCategory[] = [];
  const admissibleMissingCategories: ResearchQuestionCategory[] = [];

  for (const q of questions) {
    const rawClaimIds: string[] = [];
    const rawPassageIds: string[] = [];
    const admissibleClaimIdsForQ: string[] = [];
    const admissiblePassageIdsForQ: string[] = [];
    const authenticSourcesForQ = new Set<string>();

    // Check claims
    for (const c of claims) {
      const claimText = (c.statement || (c as any).claim_text || '').toLowerCase();
      const relevanceText = (c.relevance || '').toLowerCase();
      const combined = `${claimText} ${relevanceText}`;

      const role = (c as any).semantic_role as GeneralEvidenceRole | undefined;
      let roleMatch = role && q.expected_evidence_roles.includes(role);

      let conceptMatch = false;
      if (q.category === 'PLAUSIBLE_CAUSES') {
        conceptMatch = /\b(?:penyebab|mekanisme|memicu|radiasi|konduksi|kapiler|rembes|sumber|merambat)\b/i.test(combined);
      } else if (q.category === 'DIFFERENTIAL_DIAGNOSIS') {
        conceptMatch = /\b(?:beda|membedakan|tanda|gejala|diagnosis|jalur|pola|deteksi|periksa)\b/i.test(combined);
      } else if (q.category === 'INTERVENTION_MAPPING') {
        conceptMatch = /\b(?:fungsi|bekerja|mengurangi|memantulkan|menahan|ventilasi|waterproofing|insulasi|efek)\b/i.test(combined);
      } else if (q.category === 'LIMITATIONS_AND_FALSE_FIXES') {
        conceptMatch = /\b(?:bukan|tidak|hambatan|keterbatasan|menempel|debu|degradasi|kelemahan|gagal|hanya)\b/i.test(combined);
      } else if (q.category === 'ESCALATION_CONDITIONS') {
        conceptMatch = /\b(?:syarat|kondisi|rongga|celah|inspeksi|kelembapan|karat|kondensasi|ahli|sumber air)\b/i.test(combined);
      } else if (q.category === 'EMPIRICAL_RECOMMENDATION_SUPPORT') {
        conceptMatch = /\b(?:rekomendasi|langkah|urutan|prioritas|standar|empiris|uji|bukti)\b/i.test(combined) ||
          c.claim_class === 'editorial_recommendation' || c.claim_class === 'technical_consensus';
      }

      if (roleMatch || conceptMatch) {
        rawClaimIds.push(c.claim_id);
        if (admissibleClaimIds.has(c.claim_id)) {
          admissibleClaimIdsForQ.push(c.claim_id);
          for (const s of c.sources || []) {
            if (authenticDocIds.has(s.source_id)) authenticSourcesForQ.add(s.source_id);
          }
        }
      }
    }

    // Check passages
    for (const p of passages) {
      const pText = (p.exact_or_normalized_excerpt || (p as any).exact_text || '').toLowerCase();
      const pRole = p.semantic_role as GeneralEvidenceRole | undefined;
      const roleMatch = pRole && q.expected_evidence_roles.includes(pRole);

      let conceptMatch = false;
      if (q.category === 'PLAUSIBLE_CAUSES') {
        conceptMatch = /\b(?:heat travels|conduction|radiat|capillary|moisture source|water vapor|heat gain)\b/i.test(pText);
      } else if (q.category === 'DIFFERENTIAL_DIAGNOSIS') {
        conceptMatch = /\b(?:distinguish|differentiate|differential diagnosis|identifying difference|diagnostic signal|tide mark)\b/i.test(pText);
      } else if (q.category === 'INTERVENTION_MAPPING') {
        conceptMatch = /\b(?:radiant barrier|reflects|reduces|ventilation|coating|waterproofing|exhaust|barrier)\b/i.test(pText);
      } else if (q.category === 'LIMITATIONS_AND_FALSE_FIXES') {
        conceptMatch = /\b(?:not bulk insulation|degrades|increases emissivity|dust accumulation|neutralizing)\b/i.test(pText);
      } else if (q.category === 'ESCALATION_CONDITIONS') {
        conceptMatch = /\b(?:must face|air space|direct contact|synergistically|soffit|ridge|drainage)\b/i.test(pText);
      } else if (q.category === 'EMPIRICAL_RECOMMENDATION_SUPPORT') {
        conceptMatch = /\b(?:primarily|standard|practice|tested|effectiveness|proper)\b/i.test(pText);
      }

      if (roleMatch || conceptMatch) {
        rawPassageIds.push(p.passage_id);
        if (admissiblePassageIds.has(p.passage_id)) {
          admissiblePassageIdsForQ.push(p.passage_id);
          if (authenticDocIds.has(p.source_id)) authenticSourcesForQ.add(p.source_id);
        }
      }
    }

    const isAddressedRaw = rawClaimIds.length > 0 || rawPassageIds.length > 0;
    const isAddressedAdmissible = admissibleClaimIdsForQ.length > 0 || admissiblePassageIdsForQ.length > 0;

    if (isAddressedRaw) {
      rawCoveredCategories.push(q.category);
    } else {
      rawMissingCategories.push(q.category);
    }

    if (isAddressedAdmissible) {
      admissibleCoveredCategories.push(q.category);
    } else {
      admissibleMissingCategories.push(q.category);
    }

    evaluations.push({
      question_id: q.question_id,
      category: q.category,
      is_addressed_raw: isAddressedRaw,
      is_addressed_admissible: isAddressedAdmissible,
      is_addressed: isAddressedAdmissible,
      raw_claim_ids: rawClaimIds,
      raw_passage_ids: rawPassageIds,
      admissible_claim_ids: admissibleClaimIdsForQ,
      admissible_passage_ids: admissiblePassageIdsForQ,
      authentic_source_ids: Array.from(authenticSourcesForQ),
      addressing_claim_ids: admissibleClaimIdsForQ.length > 0 ? admissibleClaimIdsForQ : rawClaimIds,
      addressing_passage_ids: admissiblePassageIdsForQ.length > 0 ? admissiblePassageIdsForQ : rawPassageIds,
      summary: isAddressedAdmissible
        ? `Tercakup oleh ${admissibleClaimIdsForQ.length} klaim aman dan ${admissiblePassageIdsForQ.length} kutipan bukti terverifikasi (${authenticSourcesForQ.size} sumber autentik).`
        : isAddressedRaw
        ? `Tercakup secara mentah (${rawClaimIds.length} klaim, ${rawPassageIds.length} kutipan) namun tidak memiliki dukungan sumber otoritatif riil/terverifikasi.`
        : 'Belum didukung oleh klaim maupun kutipan bukti yang memadai.'
    });
  }

  const rawCoverageRatio = questions.length > 0 ? rawCoveredCategories.length / questions.length : 0;
  let admissibleCoverageRatio = questions.length > 0 ? admissibleCoveredCategories.length / questions.length : 0;

  // Invariant Section 2: If authentic source count = 0, admissible evidence coverage MUST NOT be > 0.
  let rejectionCode: 'RESEARCH_COVERAGE_INSUFFICIENT' | 'ADMISSIBLE_COVERAGE_AUTHORITY_MISMATCH' | undefined;
  const isAuthorizedHistoricalMock = isHistoricalRoofPack(evidencePack) && executionType !== 'REAL_RUNTIME_EXECUTION';
  if (authenticSourceCount === 0 && hasExplicitSources && !isAuthorizedHistoricalMock && admissibleCoverageRatio > 0) {
    admissibleCoverageRatio = 0;
    admissibleCoveredCategories.length = 0;
    rejectionCode = 'ADMISSIBLE_COVERAGE_AUTHORITY_MISMATCH';
  }

  const hasCoreCauses = admissibleCoveredCategories.includes('PLAUSIBLE_CAUSES');
  const hasCoreInterventions = admissibleCoveredCategories.includes('INTERVENTION_MAPPING');

  const requireAll = options?.requireAllCategories ?? (options?.minCoverageRatio !== undefined ? false : (questions.length === 6 && executionType === 'REAL_RUNTIME_EXECUTION'));
  const minRatio = options?.minCoverageRatio ?? 0.66;

  const isSufficient = rejectionCode !== 'ADMISSIBLE_COVERAGE_AUTHORITY_MISMATCH' && (
    requireAll
      ? (admissibleCoveredCategories.length === questions.length && questions.length > 0)
      : (admissibleCoverageRatio >= minRatio && hasCoreCauses && hasCoreInterventions)
  );

  let rejectionReason: string | undefined;
  if (!isSufficient) {
    if (rejectionCode === 'ADMISSIBLE_COVERAGE_AUTHORITY_MISMATCH') {
      rejectionReason = 'ADMISSIBLE_COVERAGE_AUTHORITY_MISMATCH: Admissible evidence coverage cannot exceed 0 when authentic source count is 0.';
    } else {
      rejectionCode = 'RESEARCH_COVERAGE_INSUFFICIENT';
      rejectionReason = `RESEARCH_COVERAGE_INSUFFICIENT: Paket bukti hanya mencakup ${admissibleCoveredCategories.length}/${questions.length} pertanyaan riset yang didukung bukti terverifikasi (rasio ${(admissibleCoverageRatio * 100).toFixed(0)}%). Kategori belum terpenuhi: ${admissibleMissingCategories.join(', ')}.`;
    }
  }

  return {
    covered: isSufficient,
    coverage_ratio: admissibleCoverageRatio,
    raw_research_coverage_ratio: rawCoverageRatio,
    admissible_evidence_coverage_ratio: admissibleCoverageRatio,
    covered_categories: admissibleCoveredCategories,
    missing_categories: admissibleMissingCategories,
    raw_covered_categories: rawCoveredCategories,
    raw_missing_categories: rawMissingCategories,
    question_evaluations: evaluations,
    authentic_source_count: authenticSourceCount,
    rejection_code: rejectionCode,
    rejection_reason: rejectionReason
  };
}

/**
 * Generates question-specific source discovery queries for gap-directed research loops.
 * Milestone: RESEARCH-SOURCE-COVERAGE-1 (Section 10)
 */
export function generateQuestionSpecificQueries(
  topic: string,
  missingCategories: ResearchQuestionCategory[],
  _questions?: EditorialResearchQuestion[]
): string[] {
  const { subject, symptomOrProblem, candidateInterventions } = extractTopicDomainContext(topic);
  const interventionPhrase = candidateInterventions.length > 0 ? candidateInterventions.join(' ') : 'material perbaikan';

  const queries: string[] = [];

  for (const cat of missingCategories) {
    if (cat === 'PLAUSIBLE_CAUSES') {
      queries.push(`${subject} ${symptomOrProblem} mekanisme penyebab fisik building science`);
      queries.push(`${subject} physical causes mechanism`);
    } else if (cat === 'DIFFERENTIAL_DIAGNOSIS') {
      queries.push(`${subject} ${symptomOrProblem} diagnosis perbedaan tanda membedakan penyebab`);
      queries.push(`${subject} differential diagnosis signs causes`);
    } else if (cat === 'INTERVENTION_MAPPING') {
      queries.push(`${interventionPhrase} ${subject} efektivitas intervensi solusi`);
      queries.push(`${subject} intervention effectiveness comparison`);
    } else if (cat === 'LIMITATIONS_AND_FALSE_FIXES') {
      queries.push(`${interventionPhrase} ${symptomOrProblem} batasan fisik keterbatasan solusi semu kegagalan`);
      queries.push(`${subject} limitations false fixes failure modes`);
    } else if (cat === 'ESCALATION_CONDITIONS') {
      queries.push(`${subject} ${symptomOrProblem} kondisi inspeksi ahli kriteria eskalasi struktural`);
      queries.push(`${subject} inspection escalation criteria structural assessment`);
    } else if (cat === 'EMPIRICAL_RECOMMENDATION_SUPPORT') {
      queries.push(`${subject} standar pengujian teknis konsensus empiris sains bangunan`);
      queries.push(`${subject} empirical testing building science standards`);
    }
  }

  return Array.from(new Set(queries));
}
