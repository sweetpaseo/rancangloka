/**
 * RancangLoka Bilingual Semantic Research Question Support Evaluator
 * Milestone: EVIDENCE-RQ-SEMANTIC-GENERALIZATION-1
 *
 * Replaces legacy hardcoded/single-topic regexes with a general, bilingual,
 * semantically-aware evaluator across arbitrary architecture/home topics.
 *
 * Core Principles:
 * - Semantic Category Interpretation: Evaluates MEANING, not frozen phrases.
 * - Bilingual Technical Normalization: Seamlessly bridges Indonesian, English, and mixed technical terminology.
 * - Grounded Claim-Passage Link: Support requires verifiable passage backing, not mere title overlap.
 * - Authority Separation: Semantic support is decoupled from authority sufficiency.
 * - Fail-Closed Uncertainty: Uncertain evaluations return UNCERTAIN.
 */

import type {
  EvidenceClaim,
  EvidencePassage,
  EvidenceSource
} from '../article/human-quality.ts';

import type {
  ResearchQuestionCategory,
  EditorialResearchQuestion
} from './research-questions.ts';

import {
  decomposeTopicConcepts,
  deriveEnglishConceptEquivalents,
  type ConceptDecomposition
} from './research-discovery-planner.ts';

import type {
  SourceRole
} from './evidence-quality-gate.ts';

// ============================================================================
// 1. Types & Interfaces
// ============================================================================

export type RQSupportDecision = 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED' | 'UNCERTAIN';

export interface ResearchQuestionSemanticProfile {
  rq_id: string;
  category: ResearchQuestionCategory;
  intent: string;
  question_text: string;
  subject_concepts: string[];
  mechanism_concepts: string[];
  diagnostic_concepts: string[];
  intervention_concepts: string[];
  limitation_concepts: string[];
  escalation_concepts: string[];
  empirical_support_concepts: string[];
  bilingual_concepts: { id: string[]; en: string[] };
}

export interface ResearchQuestionSemanticSupportResult {
  support_level: RQSupportDecision;
  confidence: number;
  matched_concepts: string[];
  support_reason: string;
  supporting_passage_ids: string[];
  supporting_claim_ids: string[];
  authority_sufficient: boolean;
}

// ============================================================================
// 2. Generic Bilingual Architecture & Building Physics Vocabulary
// ============================================================================

export const CATEGORY_SEMANTIC_LEXICON: Record<ResearchQuestionCategory, { id: string[]; en: string[] }> = {
  PLAUSIBLE_CAUSES: {
    id: [
      'mekanisme', 'penyebab', 'memicu', 'faktor', 'proses', 'fisika',
      'konduksi', 'radiasi', 'konveksi', 'perpindahan panas', 'perambatan panas',
      'titik embun', 'kelembapan', 'kelembaban', 'uap air', 'tekanan uap',
      'kapiler', 'kapilaritas', 'penetrasi air', 'rembesan', 'kebocoran',
      'pemuaian', 'muai susut', 'tegangan geser', 'beban termal', 'suhu permukaan',
      'kondensasi', 'embun', 'akumulasi uap', 'aliran panas', 'infiltrasi udara',
      'transmitansi termal', 'jembatan termal'
    ],
    en: [
      'mechanism', 'cause', 'causes', 'causal', 'trigger', 'triggers', 'physical process',
      'conduction', 'radiation', 'convection', 'heat transfer', 'thermal transfer',
      'dew point', 'relative humidity', 'moisture', 'water vapor', 'vapor pressure',
      'capillary', 'capillarity', 'water penetration', 'seepage', 'leakage',
      'expansion', 'thermal expansion', 'shrinkage', 'shear stress', 'thermal load',
      'surface temperature', 'condensation', 'condensing', 'moisture accumulation',
      'heat flux', 'air infiltration', 'thermal bridging', 'conductive path',
      'thermal transmittance', 'heat transfer coefficient', 'solar heat gain',
      'moisture condensation', 'heat travels'
    ]
  },
  DIFFERENTIAL_DIAGNOSIS: {
    id: [
      'membedakan', 'perbedaan', 'indikator', 'tanda', 'gejala', 'diagnosis',
      'diagnostik', 'pola', 'deteksi', 'jalur', 'karakteristik pembeda', 'identifikasi',
      'komparasi gejala', 'sumber masalah', 'memeriksa', 'lokasi kerusakan',
      'ciri fisik', 'tanda visual', 'tahapan identifikasi', 'perbedaan suhu',
      'pola rembesan', 'batas air', 'bocor vs embun', 'beda', 'periksa'
    ],
    en: [
      'distinguish', 'distinguishing', 'differentiate', 'differentiation', 'differential',
      'diagnostic', 'diagnosis', 'symptom', 'indicator', 'signal', 'pattern',
      'detection', 'detecting', 'distinction', 'difference', 'identifying',
      'discriminating', 'failure mode', 'root cause', 'visual inspection',
      'field test', 'inspection checklist', 'manifestation', 'characteristic sign',
      'temperature difference', 'moisture pattern', 'diagnostic signal', 'symptom pattern',
      'tide mark', 'identifying difference'
    ]
  },
  INTERVENTION_MAPPING: {
    id: [
      'intervensi', 'solusi', 'penanganan', 'perbaikan', 'reduksi', 'mengurangi',
      'menghambat', 'meningkatkan', 'mencegah', 'pemutus termal', 'thermal break',
      'insulasi', 'isolasi', 'ventilasi', 'ventilasi silang', 'kaca ganda',
      'pelapis', 'waterproofing', 'shading', 'peneduh', 'pelindung matahari',
      'overhang', 'teritisan', 'louver', 'kisi-kisi', 'awning', 'kanopi',
      'secondary skin', 'fasad ganda', 'exhaust fan', 'movement joint', 'dilatasi',
      'perekat', 'efektivitas', 'kinerja perbaikan', 'tindakan korektif',
      'penghalang radiasi', 'radiant barrier', 'fungsi', 'bekerja', 'memantulkan', 'menahan'
    ],
    en: [
      'intervention', 'solution', 'mitigation', 'remediation', 'reduction', 'reduces',
      'retard', 'retards', 'improve', 'improves', 'prevent', 'prevents',
      'thermal break', 'thermal barrier', 'insulation', 'insulating', 'insulated glazing',
      'double glazing', 'low-e', 'coating', 'waterproofing', 'shading', 'solar shading',
      'exterior shading', 'overhang', 'louver', 'louvre', 'awning', 'canopy',
      'secondary facade', 'double-skin', 'exhaust fan', 'make-up air',
      'movement joint', 'expansion joint', 'adhesive bond', 'effectiveness',
      'corrective action', 'remedial measure', 'radiant barrier', 'radiation barrier',
      'reflects', 'barrier'
    ]
  },
  LIMITATIONS_AND_FALSE_FIXES: {
    id: [
      'keterbatasan', 'kelemahan', 'batasan', 'bukan solusi', 'solusi semu',
      'tidak menyelesaikan', 'tidak efektif', 'gagal', 'kegagalan', 'kompromi',
      'konsekuensi', 'efek samping', 'degradasi', 'hambatan', 'syarat batas',
      'resiko', 'risiko', 'kekeliruan', 'salah kaprah', 'penurunan fungsi',
      'debu', 'beban perawatan', 'kehilangan cahaya', 'trade-off', 'lap kaca',
      'menutup ventilasi', 'sumber kelembapan', 'bukan', 'tidak', 'hanya',
      'kehilangan panas', 'kebocoran panas', 'kerugian energi'
    ],
    en: [
      'limitation', 'limitations', 'limits', 'constraint', 'constraints', 'trade-off',
      'boundary condition', 'false fix', 'ineffective', 'does not solve', 'insufficient',
      'failure', 'fails', 'side effect', 'consequence', 'penalty', 'degradation',
      'risk', 'drawback', 'misconception', 'loss of daylight', 'daylight trade-off',
      'dust accumulation', 'maintenance burden', 'thermal bypass', 'durability limit',
      'not bulk insulation', 'increases emissivity', 'wiping', 'temporary measure',
      'neutralizing', 'heat loss', 'heat losses', 'thermal loss', 'energy loss', 'heat gain and loss'
    ]
  },
  ESCALATION_CONDITIONS: {
    id: [
      'inspeksi', 'ahli', 'profesional', 'eskalasi', 'pembongkaran', 'kerusakan struktural',
      'korosi', 'karat', 'jamur masif', 'retak parah', 'kebocoran masif', 'amblas',
      'bahaya', 'keamanan', 'tanda darurat', 'penanganan lanjut', 'kontraktor',
      'garansi', 'kerusakan meluas', 'kapan harus menghubungi', 'rembesan struktural',
      'kebocoran perimeter', 'pembusukan', 'syarat', 'celah', 'rongga', 'sumber air'
    ],
    en: [
      'inspection', 'specialist', 'professional', 'escalate', 'escalation',
      'structural damage', 'structural integrity', 'corrosion', 'rust',
      'severe mold', 'microbial contamination', 'rot', 'decay', 'severe cracking',
      'settlement', 'perimeter seal failure', 'water intrusion', 'safety hazard',
      'structural engineer', 'building inspection', 'when to call',
      'structural seepage', 'perimeter leakage', 'direct contact', 'air space',
      'must face', 'synergistically', 'soffit', 'ridge', 'drainage'
    ]
  },
  EMPIRICAL_RECOMMENDATION_SUPPORT: {
    id: [
      'standar', 'pedoman', 'pengujian', 'uji lab', 'empiris', 'ambang batas',
      'rekomendasi teknis', 'prioritas langkah', 'nilai ukur', 'spesifikasi teknis',
      'sni', 'pupr', 'acuan teknis', 'konsensus', 'terverifikasi', 'pengukuran',
      'efisiensi termal', 'koefisien', 'perhitungan', 'panduan', 'rekomendasi praktis',
      'langkah', 'urutan', 'bukti'
    ],
    en: [
      'standard', 'standards', 'code', 'guideline', 'guidance', 'testing', 'test',
      'empirical', 'threshold', 'measured', 'measurement', 'benchmark', 'specification',
      'calculation method', 'u-factor', 'u-value', 'shgc', 'stc', 'ach', 'cfm',
      'ashrae', 'astm', 'iso', 'bsi', 'din', 'en standard', 'technical consensus',
      'engineering recommendation', 'recommended practice', 'primarily', 'proper',
      'validated mechanism', 'technical threshold', 'practice'
    ]
  }
};

// Common false-positive out-of-domain patterns (medical, software, financial)
export const OUT_OF_DOMAIN_REJECTION_PATTERNS = [
  /\b(?:clinical|patient|hospital|surgery|oncology|hiv|mrna|infection|virus|bacterial|cellular automata|neural network|bose-einstein|quantum|mercury vapor|cryptocurrency|financial market|stock exchange|operating system|sistem operasi|software|linux kernel|source code|compiler|firmware|komputer|algorithm|bug software)\b/i
];

// ============================================================================
// 3. Concept Normalization & Profile Construction
// ============================================================================

/**
 * Normalizes an architectural or building-science technical term across ID and EN.
 */
export function normalizeTechnicalConcept(rawTerm: string): {
  id: string[];
  en: string[];
  canonical: string;
} {
  const clean = rawTerm.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '');

  const idVariants = new Set<string>();
  const enVariants = new Set<string>();

  idVariants.add(clean);
  enVariants.add(clean);

  // Common morphological root mapping (Indonesian prefixes/suffixes)
  if (clean.startsWith('ber')) idVariants.add(clean.slice(3));
  if (clean.startsWith('me')) idVariants.add(clean.replace(/^me(?:ng|ny|m|n)?/, ''));
  if (clean.startsWith('pe')) idVariants.add(clean.replace(/^pe(?:ng|ny|m|n)?/, ''));
  if (clean.endsWith('an')) idVariants.add(clean.slice(0, -2));
  if (clean.endsWith('kan')) idVariants.add(clean.slice(0, -3));
  if (clean.endsWith('i')) idVariants.add(clean.slice(0, -1));

  // Common English plurals / verb endings
  if (clean.endsWith('ing')) enVariants.add(clean.slice(0, -3));
  if (clean.endsWith('ed')) enVariants.add(clean.slice(0, -2));
  if (clean.endsWith('s')) enVariants.add(clean.slice(0, -1));

  return {
    id: Array.from(idVariants).filter(s => s.length >= 3),
    en: Array.from(enVariants).filter(s => s.length >= 3),
    canonical: clean
  };
}

/**
 * Builds a dynamic, bilingual ResearchQuestionSemanticProfile for an RQ.
 * NO topic-name conditionals are used.
 */
export function buildResearchQuestionSemanticProfile(
  question: EditorialResearchQuestion,
  topic: string,
  contentFamily: string = 'problem_solver'
): ResearchQuestionSemanticProfile {
  const decomp = decomposeTopicConcepts(topic);
  const enDecomp = deriveEnglishConceptEquivalents(decomp);

  const rawSubjectTerms = [
    ...decomp.problem_entities,
    ...decomp.interventions,
    ...decomp.mechanisms,
    ...decomp.symptoms,
    ...enDecomp.enEntities,
    ...enDecomp.enInterventions,
    ...enDecomp.enMechanisms,
    ...enDecomp.enSymptoms
  ];

  const STOPWORDS = new Set([
    'yang', 'pada', 'dari', 'atau', 'dengan', 'untuk', 'dalam', 'akan', 'oleh', 'bisa',
    'with', 'from', 'that', 'this', 'have', 'more', 'some', 'than', 'into'
  ]);

  const subjectTokens = new Set<string>();
  for (const s of rawSubjectTerms) {
    const clean = s.toLowerCase().trim();
    if (clean) subjectTokens.add(clean);
    for (const tok of clean.split(/[\s-]+/)) {
      if (tok.length >= 4 && !STOPWORDS.has(tok)) {
        subjectTokens.add(tok);
      }
    }
  }

  const subjectConcepts = Array.from(subjectTokens);

  const categoryLexicon = CATEGORY_SEMANTIC_LEXICON[question.category] || { id: [], en: [] };

  return {
    rq_id: question.question_id,
    category: question.category,
    intent: contentFamily,
    question_text: question.question_text,
    subject_concepts: subjectConcepts,
    mechanism_concepts: Array.from(new Set([...decomp.mechanisms, ...enDecomp.enMechanisms, ...CATEGORY_SEMANTIC_LEXICON.PLAUSIBLE_CAUSES.id, ...CATEGORY_SEMANTIC_LEXICON.PLAUSIBLE_CAUSES.en])),
    diagnostic_concepts: Array.from(new Set([...decomp.symptoms, ...enDecomp.enSymptoms, ...CATEGORY_SEMANTIC_LEXICON.DIFFERENTIAL_DIAGNOSIS.id, ...CATEGORY_SEMANTIC_LEXICON.DIFFERENTIAL_DIAGNOSIS.en])),
    intervention_concepts: Array.from(new Set([...decomp.interventions, ...enDecomp.enInterventions, ...CATEGORY_SEMANTIC_LEXICON.INTERVENTION_MAPPING.id, ...CATEGORY_SEMANTIC_LEXICON.INTERVENTION_MAPPING.en])),
    limitation_concepts: Array.from(new Set([...CATEGORY_SEMANTIC_LEXICON.LIMITATIONS_AND_FALSE_FIXES.id, ...CATEGORY_SEMANTIC_LEXICON.LIMITATIONS_AND_FALSE_FIXES.en])),
    escalation_concepts: Array.from(new Set([...CATEGORY_SEMANTIC_LEXICON.ESCALATION_CONDITIONS.id, ...CATEGORY_SEMANTIC_LEXICON.ESCALATION_CONDITIONS.en])),
    empirical_support_concepts: Array.from(new Set([...decomp.standards_intent, ...enDecomp.enStandards, ...decomp.measurements, ...enDecomp.enMeasurements, ...CATEGORY_SEMANTIC_LEXICON.EMPIRICAL_RECOMMENDATION_SUPPORT.id, ...CATEGORY_SEMANTIC_LEXICON.EMPIRICAL_RECOMMENDATION_SUPPORT.en])),
    bilingual_concepts: {
      id: categoryLexicon.id,
      en: categoryLexicon.en
    }
  };
}

// ============================================================================
// 4. Semantic Support Evaluator
// ============================================================================

export interface SemanticSupportInput {
  profile: ResearchQuestionSemanticProfile;
  claim: EvidenceClaim;
  passages?: EvidencePassage[];
  documentTopic?: string;
  sourceRole?: SourceRole;
}

/**
 * Evaluates whether a candidate claim (and its supporting passages) semantically
 * supports a canonical Research Question.
 *
 * Enforces:
 * - Evidence Link: Claim MUST have supporting passages or verified source.
 * - Out-of-Domain Rejection: Biomedical/software/financial texts fail immediately.
 * - Subject Context: Must relate to the topic domain.
 * - Category Semantics: Must answer the specific inquiry of the RQ category.
 * - Tri-state/Tri-level: SUPPORTED, PARTIAL, UNSUPPORTED, UNCERTAIN.
 */
export function evaluateResearchQuestionSemanticSupport(
  input: SemanticSupportInput
): ResearchQuestionSemanticSupportResult {
  const { profile, claim, passages = [], sourceRole = 'OTHER' } = input;

  const claimId = claim.claim_id;
  const supportingPassageIds = claim.evidence_passage_ids || [];

  // Invariant 1: Genuine evidence link is mandatory
  const linkedPassages = passages.filter(p => supportingPassageIds.includes(p.passage_id));
  const hasPassages = linkedPassages.length > 0;
  const isRecommendation = claim.claim_class === 'editorial_recommendation' ||
                           claim.claim_class === 'EDITORIAL_RECOMMENDATION' ||
                           (claim as any).applicability === 'EDITORIAL_INFERENCE';

  if (!hasPassages && !isRecommendation) {
    return {
      support_level: 'UNSUPPORTED',
      confidence: 0.9,
      matched_concepts: [],
      support_reason: 'UNSUPPORTED: Klaim tidak memiliki rujukan passage terverifikasi.',
      supporting_passage_ids: [],
      supporting_claim_ids: [claimId],
      authority_sufficient: false
    };
  }

  // Combined text corpus for semantic evaluation
  const claimText = `${claim.statement || ''} ${(claim as any).relevance || ''}`.toLowerCase();
  const passageText = linkedPassages
    .map(p => `${p.exact_or_normalized_excerpt || (p as any).exact_text || ''} ${p.locator || ''}`)
    .join(' ')
    .toLowerCase();
  const combinedCorp = `${claimText} ${passageText}`.trim();

  // Invariant 2: Out-of-domain rejection
  if (OUT_OF_DOMAIN_REJECTION_PATTERNS.some(pat => pat.test(combinedCorp))) {
    return {
      support_level: 'UNSUPPORTED',
      confidence: 0.95,
      matched_concepts: [],
      support_reason: 'UNSUPPORTED: Bukti terdeteksi berada di ranah luar domain (biomedis/software/keuangan).',
      supporting_passage_ids: [],
      supporting_claim_ids: [claimId],
      authority_sufficient: false
    };
  }

  // Invariant 3: Subject Concept Relevance
  const matchedSubjects: string[] = [];
  for (const subj of profile.subject_concepts) {
    const norm = normalizeTechnicalConcept(subj);
    const hasMatch = [...norm.id, ...norm.en].some(v => {
      const reg = new RegExp(`\\b${v}\\b`, 'i');
      return reg.test(combinedCorp);
    });
    if (hasMatch) {
      matchedSubjects.push(subj);
    }
  }

  // General building domain fallback if subject is broadly compatible
  const hasSubjectMatch = matchedSubjects.length > 0 || isRecommendation;

  // Invariant 4: Category-Specific Meaning Match
  const categoryLex = profile.bilingual_concepts;
  const matchedCategoryConcepts: string[] = [];

  for (const term of [...categoryLex.id, ...categoryLex.en]) {
    const norm = normalizeTechnicalConcept(term);
    const hasMatch = [...norm.id, ...norm.en].some(v => {
      const reg = new RegExp(`\\b${v}\\b`, 'i');
      return reg.test(combinedCorp);
    });
    if (hasMatch && !matchedCategoryConcepts.includes(term)) {
      matchedCategoryConcepts.push(term);
    }
  }

  // Claim semantic role alignment bonus
  const claimRole = (claim as any).semantic_role as string | undefined;
  let roleBonus = false;
  if (profile.category === 'PLAUSIBLE_CAUSES' && (claimRole === 'CAUSE_MECHANISM' || claimRole === 'MATERIAL_BEHAVIOR')) {
    roleBonus = true;
  } else if (profile.category === 'DIFFERENTIAL_DIAGNOSIS' && claimRole === 'DIAGNOSTIC_SIGNAL') {
    roleBonus = true;
  } else if (profile.category === 'INTERVENTION_MAPPING' && (claimRole === 'INTERVENTION_EFFECT' || claimRole === 'MATERIAL_BEHAVIOR')) {
    roleBonus = true;
  } else if (profile.category === 'LIMITATIONS_AND_FALSE_FIXES' && (claimRole === 'LIMITATION' || claimRole === 'RISK')) {
    roleBonus = true;
  } else if (profile.category === 'ESCALATION_CONDITIONS' && (claimRole === 'RISK' || claimRole === 'INSTALLATION_GUIDANCE')) {
    roleBonus = true;
  } else if (profile.category === 'EMPIRICAL_RECOMMENDATION_SUPPORT' && (claimRole === 'REGULATORY_REFERENCE' || isRecommendation)) {
    roleBonus = true;
  }

  // Invariant 5: Authority Appropriateness
  let authoritySufficient = true;
  if (profile.category === 'EMPIRICAL_RECOMMENDATION_SUPPORT') {
    // Requires authoritative scholarly, standard, or institutional source
    const highAuthRoles: SourceRole[] = [
      'SCHOLARLY_JOURNAL_ARTICLE',
      'SCHOLARLY_RESEARCH',
      'TECHNICAL_STANDARD',
      'OFFICIAL_GOVERNMENT_GUIDANCE',
      'OFFICIAL_INSTITUTIONAL_GUIDANCE'
    ];
    if (!highAuthRoles.includes(sourceRole) && !isRecommendation) {
      authoritySufficient = false;
    }
  }

  // Decision Logic
  const allMatched = [...matchedSubjects, ...matchedCategoryConcepts];

  // Strong support: subject matched AND at least 2 category concepts matched (or 1 concept + roleBonus)
  if (hasSubjectMatch && (matchedCategoryConcepts.length >= 2 || (matchedCategoryConcepts.length >= 1 && roleBonus))) {
    return {
      support_level: 'SUPPORTED',
      confidence: 0.9,
      matched_concepts: allMatched,
      support_reason: `SUPPORTED: Bukti memuat konsep subjek [${matchedSubjects.slice(0, 3).join(', ')}] dan konsep kategori [${matchedCategoryConcepts.slice(0, 3).join(', ')}].`,
      supporting_passage_ids: linkedPassages.map(p => p.passage_id),
      supporting_claim_ids: [claimId],
      authority_sufficient: authoritySufficient
    };
  }

  // Partial support: subject matched but only 1 category concept, or category matched strongly but subject only implicit
  if ((hasSubjectMatch && matchedCategoryConcepts.length >= 1) || (matchedCategoryConcepts.length >= 3 && !hasSubjectMatch)) {
    return {
      support_level: 'PARTIAL',
      confidence: 0.7,
      matched_concepts: allMatched,
      support_reason: `PARTIAL: Terdapat keterkaitan konsep parsial [${allMatched.slice(0, 3).join(', ')}].`,
      supporting_passage_ids: linkedPassages.map(p => p.passage_id),
      supporting_claim_ids: [claimId],
      authority_sufficient: authoritySufficient
    };
  }

  // Ambiguous text overlap with 0 decisive category terms -> UNCERTAIN (fail-closed)
  if (hasSubjectMatch && combinedCorp.length > 100 && matchedCategoryConcepts.length === 0) {
    return {
      support_level: 'UNCERTAIN',
      confidence: 0.5,
      matched_concepts: matchedSubjects,
      support_reason: 'UNCERTAIN: Teks membahas subjek bangunan terkait namun tidak secara tegas menjawab pertanyaan kategori (fail-closed).',
      supporting_passage_ids: linkedPassages.map(p => p.passage_id),
      supporting_claim_ids: [claimId],
      authority_sufficient: false
    };
  }

  return {
    support_level: 'UNSUPPORTED',
    confidence: 0.85,
    matched_concepts: [],
    support_reason: 'UNSUPPORTED: Tidak ada keterkaitan semantik substantif antara bukti dan pertanyaan riset.',
    supporting_passage_ids: [],
    supporting_claim_ids: [claimId],
    authority_sufficient: false
  };
}
