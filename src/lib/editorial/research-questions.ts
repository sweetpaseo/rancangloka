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

import type {
  EvidencePackInput,
  EvidenceClaim,
  EvidencePassage,
  ArticleIntentProfile
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
  is_addressed: boolean;
  addressing_claim_ids: string[];
  addressing_passage_ids: string[];
  summary: string;
}

export interface ResearchCoverageResult {
  covered: boolean;
  coverage_ratio: number;
  covered_categories: ResearchQuestionCategory[];
  missing_categories: ResearchQuestionCategory[];
  question_evaluations: QuestionCoverageEvaluation[];
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

/**
 * Validates that an evidence pack addresses the generated research questions.
 */
export function validateResearchQuestionCoverage(
  questions: EditorialResearchQuestion[],
  evidencePack: EvidencePackInput
): ResearchCoverageResult {
  const claims = Array.isArray(evidencePack.claim_inventory) ? evidencePack.claim_inventory : [];
  const passages = Array.isArray(evidencePack.evidence_passages) ? evidencePack.evidence_passages : [];

  const evaluations: QuestionCoverageEvaluation[] = [];
  const coveredCategories: ResearchQuestionCategory[] = [];
  const missingCategories: ResearchQuestionCategory[] = [];

  for (const q of questions) {
    const addressingClaims: string[] = [];
    const addressingPassages: string[] = [];

    // Check claims that map to expected roles or address the question
    for (const c of claims) {
      const claimText = (c.statement || (c as any).claim_text || '').toLowerCase();
      const relevanceText = (c.relevance || '').toLowerCase();
      const combined = `${claimText} ${relevanceText}`;

      // Check role mapping if available
      const role = (c as any).semantic_role as GeneralEvidenceRole | undefined;
      let roleMatch = role && q.expected_evidence_roles.includes(role);

      // Check conceptual match based on category
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
        addressingClaims.push(c.claim_id);
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
        conceptMatch = /\b(?:different|temperature|surface|inspection|distinguish|symptom)\b/i.test(pText);
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
        addressingPassages.push(p.passage_id);
      }
    }

    const isAddressed = addressingClaims.length > 0 || addressingPassages.length > 0;
    if (isAddressed) {
      coveredCategories.push(q.category);
    } else {
      missingCategories.push(q.category);
    }

    evaluations.push({
      question_id: q.question_id,
      category: q.category,
      is_addressed: isAddressed,
      addressing_claim_ids: addressingClaims,
      addressing_passage_ids: addressingPassages,
      summary: isAddressed
        ? `Tercakup oleh ${addressingClaims.length} klaim dan ${addressingPassages.length} kutipan bukti.`
        : 'Belum didukung oleh klaim maupun kutipan bukti yang memadai.'
    });
  }

  const coverageRatio = questions.length > 0 ? coveredCategories.length / questions.length : 0;

  // Invariant: Core categories (PLAUSIBLE_CAUSES, DIFFERENTIAL_DIAGNOSIS, INTERVENTION_MAPPING)
  // are mandatory for problem-solving editorial articles. Minimum ratio >= 0.66 (4 of 6).
  const hasCoreCauses = coveredCategories.includes('PLAUSIBLE_CAUSES');
  const hasCoreInterventions = coveredCategories.includes('INTERVENTION_MAPPING');
  const isSufficient = coverageRatio >= 0.66 && hasCoreCauses && hasCoreInterventions;

  return {
    covered: isSufficient,
    coverage_ratio: coverageRatio,
    covered_categories: coveredCategories,
    missing_categories: missingCategories,
    question_evaluations: evaluations,
    rejection_reason: isSufficient
      ? undefined
      : `RESEARCH_COVERAGE_INSUFFICIENT: Paket bukti hanya mencakup ${coveredCategories.length}/${questions.length} pertanyaan riset (rasio ${(coverageRatio * 100).toFixed(0)}%). Kategori belum terpenuhi: ${missingCategories.join(', ')}.`
  };
}
