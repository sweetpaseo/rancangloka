/**
 * Research Discovery Query Planner & Concept Decomposition
 * Milestone: RESEARCH-DISCOVERY-CAPABILITY-1
 *
 * Decomposes editorial topics into structured building-science concepts,
 * strips conversational prose noise, and generates bounded bilingual (ID + EN)
 * query plans targeted at scholarly, encyclopedic, and open-web discovery providers.
 */

import type {
  EditorialResearchQuestion,
  ResearchQuestionCategory
} from './research-questions.ts';

import type { ArticleIntentProfile } from '../article/human-quality.ts';

export interface ConceptDecomposition {
  problem_entities: string[];
  symptoms: string[];
  mechanisms: string[];
  interventions: string[];
  measurements: string[];
  standards_intent: string[];
}

export interface DiscoveryQueryVariant {
  language: 'id' | 'en';
  query: string;
  intent: string;
  target_provider: 'CROSSREF' | 'WIKIPEDIA' | 'OPEN_WEB' | 'ALL';
}

export interface StructuredDiscoveryQuery {
  query_id: string;
  research_question_id?: string;
  category: ResearchQuestionCategory | string;
  target_provider: 'CROSSREF' | 'WIKIPEDIA' | 'OPEN_WEB' | 'ALL';
  concepts: ConceptDecomposition;
  variants: DiscoveryQueryVariant[];
  derived_from_concepts: string[];
}

export interface ResearchDiscoveryQueryPlan {
  query_plan_id: string;
  pass_number: number;
  topic: string;
  decomposition: ConceptDecomposition;
  planned_queries: StructuredDiscoveryQuery[];
  metrics: {
    total_queries: number;
    id_query_count: number;
    en_query_count: number;
    max_query_length: number;
  };
}

export interface QueryPlannerInput {
  topic: string;
  contentFamily?: string;
  researchQuestions?: EditorialResearchQuestion[];
  missingResearchCategories?: ResearchQuestionCategory[];
  passNumber: number;
  intentProfile?: ArticleIntentProfile;
}

// Bounds constants
export const MAX_QUERY_LENGTH = 80;
export const MAX_CONCEPTS_PER_QUERY = 4;
export const MAX_VARIANTS_PER_QUERY = 2;
export const MAX_QUERIES_PER_PASS = 8;

// Conversational filler patterns to strip
const CONVERSATIONAL_FILLERS = [
  /\bmeski sudah\b/gi,
  /\bwalau sudah\b/gi,
  /\bsudah pakai\b/gi,
  /\btetap\b/gi,
  /\bapakah\b/gi,
  /\bmana yang lebih baik\b/gi,
  /\bbagaimana cara\b/gi,
  /\bkenapa\b/gi,
  /\bmengapa\b/gi,
  /\bsolusi terbaik\b/gi,
  /\btips\b/gi,
  /\bcara mengatasi\b/gi,
  /\bataukah\b/gi,
  /\batau\b/gi,
  /\bvs\.?\b/gi,
  /\bversus\b/gi
];

// Generalized technical bilingual vocabulary map
const TECHNICAL_VOCABULARY_MAP: Record<string, { en: string; id: string; category: keyof ConceptDecomposition }> = {
  // Ventilation & HVAC
  'exhaust fan': { en: 'exhaust fan ventilation', id: 'exhaust fan ventilasi', category: 'problem_entities' },
  'fan': { en: 'ventilation fan', id: 'kipas ventilasi', category: 'problem_entities' },
  'ventilasi': { en: 'ventilation', id: 'ventilasi', category: 'interventions' },
  'kamar mandi': { en: 'bathroom', id: 'kamar mandi', category: 'problem_entities' },
  'uap': { en: 'water vapor', id: 'uap air', category: 'mechanisms' },
  'sumber uap': { en: 'moisture generation source', id: 'sumber uap air', category: 'mechanisms' },
  'jalur udara masuk': { en: 'make-up air intake', id: 'jalur udara masuk', category: 'interventions' },
  'aliran udara': { en: 'airflow pattern', id: 'aliran udara', category: 'mechanisms' },
  'kapasitas fan': { en: 'fan airflow capacity CFM', id: 'kapasitas fan', category: 'measurements' },
  'durasi operasi': { en: 'ventilation run-time', id: 'durasi operasi', category: 'interventions' },
  'cfm': { en: 'airflow CFM', id: 'debit aliran CFM', category: 'measurements' },
  'air change': { en: 'air change rate ACH', id: 'pergantian udara ACH', category: 'measurements' },

  // Moisture, Walls & Waterproofing
  'lembap': { en: 'moisture dampness', id: 'kelembapan', category: 'symptoms' },
  'kelembapan': { en: 'relative humidity moisture', id: 'kelembapan relatif', category: 'symptoms' },
  'kondensasi': { en: 'surface condensation', id: 'kondensasi permukaan', category: 'mechanisms' },
  'jamur': { en: 'mold microbial growth', id: 'pertumbuhan jamur', category: 'symptoms' },
  'dinding': { en: 'masonry wall assembly', id: 'dinding bata plester', category: 'problem_entities' },
  'tembok': { en: 'wall substrate', id: 'bidang tembok', category: 'problem_entities' },
  'rembes': { en: 'water seepage capillary', id: 'rembesan air kapiler', category: 'mechanisms' },
  'rembesan': { en: 'water penetration', id: 'penetrasi air', category: 'mechanisms' },
  'kapiler': { en: 'capillary suction rising damp', id: 'daya kapilaritas', category: 'mechanisms' },
  'waterproofing': { en: 'waterproofing membrane', id: 'pelapis waterproofing', category: 'interventions' },
  'cat': { en: 'surface coating paint', id: 'cat pelapis', category: 'interventions' },

  // Roof, Attic & Drainage
  'atap': { en: 'roof envelope', id: 'konstruksi atap', category: 'problem_entities' },
  'loteng': { en: 'attic cavity', id: 'rongga loteng', category: 'problem_entities' },
  'plafon': { en: 'ceiling assembly', id: 'plafon langit-langit', category: 'problem_entities' },
  'talang': { en: 'gutter roof drainage', id: 'talang air atap', category: 'problem_entities' },
  'talang air': { en: 'gutter drainage channel', id: 'talang air drainase', category: 'problem_entities' },
  'kemiringan': { en: 'drainage slope pitch', id: 'kemiringan kemiringan', category: 'interventions' },
  'slope': { en: 'drainage slope gradient', id: 'derajat kemiringan', category: 'measurements' },
  'limpasan': { en: 'stormwater runoff drainage', id: 'limpasan air hujan', category: 'mechanisms' },
  'panas': { en: 'radiant heat gain', id: 'akumulasi panas', category: 'symptoms' },
  'radiant barrier': { en: 'radiant barrier foil', id: 'penghalang radiasi foil', category: 'interventions' },
  'foil': { en: 'reflective foil insulation', id: 'aluminium foil pemantul', category: 'interventions' },
  'rongga udara': { en: 'air gap airspace requirement', id: 'rongga udara berhadapan', category: 'mechanisms' },
  'debu': { en: 'dust accumulation emittance', id: 'akumulasi debu', category: 'mechanisms' },

  // Flooring, Tiles & Foundation
  'lantai': { en: 'floor substrate', id: 'lantai dasar', category: 'problem_entities' },
  'keramik': { en: 'ceramic tile flooring', id: 'ubin keramik', category: 'problem_entities' },
  'ubin': { en: 'floor tile adhesion', id: 'ubin lantai', category: 'problem_entities' },
  'popping': { en: 'tile tenting debonding buckling', id: 'keramik meledak popping', category: 'symptoms' },
  'terangkat': { en: 'tile buckling detachment', id: 'keramik terangkat lepas', category: 'symptoms' },
  'retak': { en: 'shrinkage cracks fracture', id: 'retak struktur muai', category: 'symptoms' },
  'nat': { en: 'grout expansion joint', id: 'nat celah dilatasi', category: 'interventions' },
  'expansion joint': { en: 'movement expansion joint', id: 'sambungan dilatasi ekspansi', category: 'interventions' },
  'semen': { en: 'thinset mortar adhesive', id: 'mortar semen perekat', category: 'interventions' },
  'adhesi': { en: 'bonding adhesion shear stress', id: 'daya lekat adhesi', category: 'mechanisms' },
  'muai': { en: 'thermal expansion moisture expansion', id: 'muai susut termal', category: 'mechanisms' },

  // Fenestration & Openings
  'kusen': { en: 'window frame fenestration', id: 'profil kusen', category: 'problem_entities' },
  'jendela': { en: 'window system opening', id: 'daun jendela', category: 'problem_entities' },
  'aluminium': { en: 'aluminium profile thermal conductivity', id: 'profil aluminium', category: 'interventions' },
  'upvc': { en: 'uPVC profile multi-chamber insulation', id: 'profil uPVC', category: 'interventions' },
  'kedap suara': { en: 'acoustic sound insulation STC', id: 'insulasi kedap suara', category: 'measurements' },
  'thermal break': { en: 'polyamide thermal break', id: 'penghambat panas thermal break', category: 'interventions' },

  // Standards & Codes
  'ashrae': { en: 'ASHRAE standard ventilation guidance', id: 'standar ASHRAE ventilasi', category: 'standards_intent' },
  'sni': { en: 'SNI standar nasional bangunan', id: 'standar SNI bangunan', category: 'standards_intent' },
  'hvi': { en: 'HVI Home Ventilating Institute standard', id: 'panduan HVI pengujian', category: 'standards_intent' },
  'astm': { en: 'ASTM standard testing specification', id: 'spesifikasi standar ASTM', category: 'standards_intent' },
  'pupr': { en: 'pedoman teknis PUPR bangunan', id: 'pedoman kementerian PUPR', category: 'standards_intent' }
};

/**
 * Truncates query string at word boundary up to maxLength.
 */
function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > 20) {
    return cut.slice(0, lastSpace).trim();
  }
  return cut.trim();
}

/**
 * Decomposes an editorial topic string into normalized concept classes.
 */
export function decomposeTopicConcepts(topic: string): ConceptDecomposition {
  let cleaned = topic.replace(/[?:!]/g, ' ');
  for (const filler of CONVERSATIONAL_FILLERS) {
    cleaned = cleaned.replace(filler, ' ');
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim().toLowerCase();

  const decomposition: ConceptDecomposition = {
    problem_entities: [],
    symptoms: [],
    mechanisms: [],
    interventions: [],
    measurements: [],
    standards_intent: []
  };

  // Match recognized domain concepts
  for (const [key, mapping] of Object.entries(TECHNICAL_VOCABULARY_MAP)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(cleaned)) {
      const bucket = decomposition[mapping.category];
      if (!bucket.includes(key)) {
        bucket.push(key);
      }
    }
  }

  // Fallback term extraction if no entities matched
  if (decomposition.problem_entities.length === 0) {
    const words = cleaned.split(' ').filter(w => w.length > 3);
    if (words.length > 0) {
      decomposition.problem_entities.push(words[0]);
    }
  }

  return decomposition;
}

/**
 * Derives English technical equivalents for matched concepts.
 */
function deriveEnglishConceptEquivalents(concepts: ConceptDecomposition): {
  enEntities: string[];
  enSymptoms: string[];
  enMechanisms: string[];
  enInterventions: string[];
  enMeasurements: string[];
  enStandards: string[];
} {
  const getMapped = (list: string[]) =>
    list.map(term => TECHNICAL_VOCABULARY_MAP[term]?.en || term).filter(Boolean);

  return {
    enEntities: getMapped(concepts.problem_entities),
    enSymptoms: getMapped(concepts.symptoms),
    enMechanisms: getMapped(concepts.mechanisms),
    enInterventions: getMapped(concepts.interventions),
    enMeasurements: getMapped(concepts.measurements),
    enStandards: getMapped(concepts.standards_intent)
  };
}

/**
 * ResearchDiscoveryQueryPlanner
 * Main orchestrator for generating structured, compact, bilingual query plans.
 */
export class ResearchDiscoveryQueryPlanner {
  /**
   * Plans structured queries for a given pass and topic.
   */
  static planQueries(input: QueryPlannerInput): ResearchDiscoveryQueryPlan {
    const decomposition = decomposeTopicConcepts(input.topic);
    const enConcepts = deriveEnglishConceptEquivalents(decomposition);
    const passNum = input.passNumber || 1;
    const missingCats = input.missingResearchCategories || [];

    const plannedQueries: StructuredDiscoveryQuery[] = [];
    let queryIndex = 1;

    // Helper to generate a structured query
    const addQuery = (params: {
      category: ResearchQuestionCategory | string;
      rqId?: string;
      targetProvider: 'CROSSREF' | 'WIKIPEDIA' | 'OPEN_WEB' | 'ALL';
      idKeywords: string[];
      enKeywords: string[];
      intent: string;
    }) => {
      if (plannedQueries.length >= MAX_QUERIES_PER_PASS) return;

      const cleanIdWords = Array.from(new Set(params.idKeywords)).slice(0, MAX_CONCEPTS_PER_QUERY);
      const cleanEnWords = Array.from(new Set(params.enKeywords)).slice(0, MAX_CONCEPTS_PER_QUERY);

      const rawIdQuery = cleanIdWords.join(' ').trim();
      const rawEnQuery = cleanEnWords.join(' ').trim();

      const finalIdQuery = truncateAtWordBoundary(rawIdQuery, MAX_QUERY_LENGTH);
      const finalEnQuery = truncateAtWordBoundary(rawEnQuery, MAX_QUERY_LENGTH);

      // Prevent duplicate queries
      const isDuplicate = plannedQueries.some(pq =>
        pq.variants.some(v => v.query.toLowerCase() === finalIdQuery.toLowerCase() || v.query.toLowerCase() === finalEnQuery.toLowerCase())
      );
      if (isDuplicate) return;

      const qId = `Q-PLAN-P${passNum}-${queryIndex++}`;
      const queryItem: StructuredDiscoveryQuery = {
        query_id: qId,
        research_question_id: params.rqId,
        category: params.category,
        target_provider: params.targetProvider,
        concepts: decomposition,
        variants: [
          {
            language: 'id',
            query: finalIdQuery,
            intent: `${params.intent} (Indonesian technical)`,
            target_provider: params.targetProvider
          },
          {
            language: 'en',
            query: finalEnQuery,
            intent: `${params.intent} (English technical)`,
            target_provider: params.targetProvider
          }
        ],
        derived_from_concepts: [...cleanIdWords]
      };

      plannedQueries.push(queryItem);
    };

    const primaryEntityId = decomposition.problem_entities.slice(0, 2).join(' ') || 'bangunan';
    const primaryEntityEn = enConcepts.enEntities.slice(0, 2).join(' ') || 'building';

    const primarySymptomId = decomposition.symptoms[0] || 'masalah fisik';
    const primarySymptomEn = enConcepts.enSymptoms[0] || 'problem';

    const primaryMechId = decomposition.mechanisms[0] || 'mekanisme';
    const primaryMechEn = enConcepts.enMechanisms[0] || 'mechanism';

    const primaryInterventionId = decomposition.interventions[0] || 'solusi teknis';
    const primaryInterventionEn = enConcepts.enInterventions[0] || 'intervention';

    if (passNum === 1 || missingCats.length === 0) {
      // Pass 1: Balanced foundational discovery across categories

      // 1. Mechanism / Cause
      addQuery({
        category: 'PLAUSIBLE_CAUSES',
        rqId: 'RQ-001',
        targetProvider: 'ALL',
        idKeywords: [primaryEntityId, primarySymptomId, primaryMechId, 'mekanisme fisika'],
        enKeywords: [primaryEntityEn, primarySymptomEn, primaryMechEn, 'causes physics'],
        intent: 'Investigate physical causes and transport mechanisms'
      });

      // 2. Differential Diagnosis / Distinction
      addQuery({
        category: 'DIFFERENTIAL_DIAGNOSIS',
        rqId: 'RQ-002',
        targetProvider: 'ALL',
        idKeywords: [primaryEntityId, primarySymptomId, 'diagnosis membedakan'],
        enKeywords: [primaryEntityEn, primarySymptomEn, 'differential diagnosis inspection'],
        intent: 'Distinguish symptomatic causes and boundary indicators'
      });

      // 3. Intervention / Effectiveness
      addQuery({
        category: 'INTERVENTION_MAPPING',
        rqId: 'RQ-003',
        targetProvider: 'ALL',
        idKeywords: [primaryEntityId, primaryInterventionId, 'efektivitas solusi'],
        enKeywords: [primaryEntityEn, primaryInterventionEn, 'effectiveness airflow mitigation'],
        intent: 'Evaluate technical intervention effectiveness'
      });

      // 4. Standards & Guidance
      addQuery({
        category: 'EMPIRICAL_RECOMMENDATION_SUPPORT',
        rqId: 'RQ-006',
        targetProvider: 'ALL',
        idKeywords: [primaryEntityId, 'standar teknis SNI pedoman'],
        enKeywords: [primaryEntityEn, 'building science standards ASHRAE code'],
        intent: 'Retrieve institutional and empirical building standards'
      });
    } else {
      // Pass 2: Targeted gap-directed queries for missing categories only
      for (const cat of missingCats) {
        if (cat === 'PLAUSIBLE_CAUSES') {
          addQuery({
            category: 'PLAUSIBLE_CAUSES',
            rqId: 'RQ-001',
            targetProvider: 'ALL',
            idKeywords: [primaryEntityId, primarySymptomId, 'mekanisme penyebab sumber'],
            enKeywords: [primaryEntityEn, primarySymptomEn, 'underlying physical cause transport'],
            intent: 'Gap-directed physical cause investigation'
          });
        } else if (cat === 'DIFFERENTIAL_DIAGNOSIS') {
          addQuery({
            category: 'DIFFERENTIAL_DIAGNOSIS',
            rqId: 'RQ-002',
            targetProvider: 'ALL',
            idKeywords: [primaryEntityId, primarySymptomId, 'tanda diagnosis perbedaan'],
            enKeywords: [primaryEntityEn, primarySymptomEn, 'diagnostic signs differentiation'],
            intent: 'Gap-directed diagnostic differentiation'
          });
        } else if (cat === 'INTERVENTION_MAPPING') {
          addQuery({
            category: 'INTERVENTION_MAPPING',
            rqId: 'RQ-003',
            targetProvider: 'ALL',
            idKeywords: [primaryEntityId, primaryInterventionId, 'efektivitas perbaikan'],
            enKeywords: [primaryEntityEn, primaryInterventionEn, 'remediation effectiveness performance'],
            intent: 'Gap-directed intervention mapping'
          });
        } else if (cat === 'LIMITATIONS_AND_FALSE_FIXES') {
          addQuery({
            category: 'LIMITATIONS_AND_FALSE_FIXES',
            rqId: 'RQ-004',
            targetProvider: 'ALL',
            idKeywords: [primaryEntityId, primaryInterventionId, 'keterbatasan kegagalan batas fisik'],
            enKeywords: [primaryEntityEn, primaryInterventionEn, 'limitations false fixes failure modes'],
            intent: 'Gap-directed limitations and failure boundary investigation'
          });
        } else if (cat === 'ESCALATION_CONDITIONS') {
          addQuery({
            category: 'ESCALATION_CONDITIONS',
            rqId: 'RQ-005',
            targetProvider: 'ALL',
            idKeywords: [primaryEntityId, primarySymptomId, 'kondisi inspeksi ahli risiko'],
            enKeywords: [primaryEntityEn, primarySymptomEn, 'inspection criteria escalation risk assessment'],
            intent: 'Gap-directed escalation criteria'
          });
        } else if (cat === 'EMPIRICAL_RECOMMENDATION_SUPPORT') {
          addQuery({
            category: 'EMPIRICAL_RECOMMENDATION_SUPPORT',
            rqId: 'RQ-006',
            targetProvider: 'ALL',
            idKeywords: [primaryEntityId, 'standar pengujian konsensus teknis'],
            enKeywords: [primaryEntityEn, 'empirical testing building standards guidelines'],
            intent: 'Gap-directed empirical consensus retrieval'
          });
        }
      }
    }

    const totalQueries = plannedQueries.length;
    const idCount = plannedQueries.reduce((acc, q) => acc + q.variants.filter(v => v.language === 'id').length, 0);
    const enCount = plannedQueries.reduce((acc, q) => acc + q.variants.filter(v => v.language === 'en').length, 0);
    const maxLen = Math.max(
      ...plannedQueries.flatMap(q => q.variants.map(v => v.query.length)),
      0
    );

    return {
      query_plan_id: `plan_${Date.now()}_p${passNum}`,
      pass_number: passNum,
      topic: input.topic,
      decomposition,
      planned_queries: plannedQueries,
      metrics: {
        total_queries: totalQueries,
        id_query_count: idCount,
        en_query_count: enCount,
        max_query_length: maxLen
      }
    };
  }
}
