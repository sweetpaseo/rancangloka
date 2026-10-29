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
  entity_profile?: EntityPinnedTopicProfile;
  variants: DiscoveryQueryVariant[];
  derived_from_concepts: string[];
}

export interface ResearchDiscoveryQueryPlan {
  query_plan_id: string;
  pass_number: number;
  topic: string;
  decomposition: ConceptDecomposition;
  entity_profile?: EntityPinnedTopicProfile;
  planned_queries: StructuredDiscoveryQuery[];
  metrics: {
    total_queries: number;
    id_query_count: number;
    en_query_count: number;
    max_query_length: number;
  };
}

export interface EntityPinnedTopicProfile {
  topic: string;
  primary_article_entity: string;
  material_or_building_system: string;
  reader_problem: string;
  research_question: string;
  evidence_requirement: string;
  geographic_applicability: 'TROPICAL_HUMID' | 'UNIVERSAL_PHYSICS';
  controlled_scholarly_anchor: string;
  controlled_physical_systems: string[];
  controlled_concepts: {
    id_terms: string[];
    en_terms: string[];
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
  /\bmemilih\b/gi,
  /\bsistem\b/gi,
  /\banalisis\b/gi,
  /\bperbandingan\b/gi,
  /\bkarakteristik\b/gi,
  /\bperan\b/gi,
  /\buntuk hunian\b/gi,
  /\buntuk\b/gi,
  /\bmengetahui\b/gi,
  /\brekomendasi\b/gi,
  /\bperbedaan\b/gi,
  /\bpanduan\b/gi,
  /\bcara\b/gi,
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
  'pemuaian': { en: 'thermal expansion moisture expansion', id: 'pemuaian muai susut', category: 'mechanisms' },
  'perekat': { en: 'thinset mortar adhesive bond', id: 'mortar semen perekat', category: 'interventions' },
  'movement joint': { en: 'movement expansion joint dilatasi', id: 'sambungan movement joint', category: 'interventions' },
  'delaminasi': { en: 'debonding delamination shear failure', id: 'lepas delaminasi adhesi', category: 'symptoms' },

  // Fenestration, Glazing & Architectural Glass
  'kaca': { en: 'architectural glass glazing', id: 'kaca bangunan', category: 'problem_entities' },
  'laminated': { en: 'laminated safety glass PVB', id: 'kaca laminated interlayer', category: 'problem_entities' },
  'tempered': { en: 'tempered toughened glass', id: 'kaca tempered', category: 'problem_entities' },
  'keamanan': { en: 'safety impact breakage', id: 'keamanan benturan', category: 'mechanisms' },
  'kekuatan': { en: 'mechanical structural strength', id: 'kekuatan mekanis', category: 'measurements' },
  'benturan': { en: 'impact resistance fracture', id: 'ketahanan benturan', category: 'mechanisms' },
  'isolasi suara': { en: 'acoustic sound transmission STC', id: 'isolasi suara akustik', category: 'measurements' },
  'pvb': { en: 'polyvinyl butyral PVB interlayer', id: 'interlayer PVB', category: 'interventions' },
  'pecah': { en: 'glass breakage shatter fracture', id: 'pecahan kaca', category: 'symptoms' },
  'kusen': { en: 'window frame fenestration', id: 'profil kusen', category: 'problem_entities' },
  'jendela': { en: 'window system opening', id: 'daun jendela', category: 'problem_entities' },
  'aluminium': { en: 'aluminium profile thermal conductivity', id: 'profil aluminium', category: 'interventions' },
  'upvc': { en: 'uPVC profile multi-chamber insulation', id: 'profil uPVC', category: 'interventions' },
  'kedap suara': { en: 'acoustic sound insulation STC', id: 'insulasi kedap suara', category: 'measurements' },
  'thermal break': { en: 'polyamide thermal break', id: 'penghambat panas thermal break', category: 'interventions' },

  // Shading, Solar Radiation & Facade
  'shading': { en: 'solar shading device facade', id: 'shading peneduh matahari', category: 'interventions' },
  'overhang': { en: 'overhang solar shading projection', id: 'overhang teritisan', category: 'interventions' },
  'louver': { en: 'louver louvre shading airflow', id: 'louver kisi-kisi', category: 'interventions' },
  'awning': { en: 'exterior awning canopy shading', id: 'kanopi awning', category: 'interventions' },
  'secondary skin': { en: 'double-skin facade secondary skin', id: 'secondary skin fasad ganda', category: 'interventions' },
  'fasad': { en: 'building facade envelope', id: 'fasad bangunan', category: 'problem_entities' },
  'tropis': { en: 'tropical climate building envelope', id: 'iklim tropis bangunan', category: 'mechanisms' },
  'radiasi': { en: 'solar radiation heat gain SHGC', id: 'radiasi matahari', category: 'mechanisms' },
  'shgc': { en: 'solar heat gain coefficient SHGC', id: 'koefisien panas matahari SHGC', category: 'measurements' },
  'ventilasi alami': { en: 'natural cross ventilation airflow', id: 'ventilasi alami silang', category: 'interventions' },

  // Standards & Codes
  'ashrae': { en: 'ASHRAE standard ventilation guidance', id: 'standar ASHRAE ventilasi', category: 'standards_intent' },
  'sni': { en: 'SNI standar nasional bangunan', id: 'standar SNI bangunan', category: 'standards_intent' },
  'hvi': { en: 'HVI Home Ventilating Institute standard', id: 'panduan HVI pengujian', category: 'standards_intent' },
  'astm': { en: 'ASTM standard testing specification', id: 'spesifikasi standar ASTM', category: 'standards_intent' },
  'pupr': { en: 'pedoman teknis PUPR bangunan', id: 'pedoman kementerian PUPR', category: 'standards_intent' }
};

// Generic editorial intent terms that must NOT dominate bibliographic/CrossRef search queries
export const EDITORIAL_INTENT_TERMS = [
  /\bdifferential diagnosis\b/gi,
  /\bdiagnosis\b/gi,
  /\binspection criteria\b/gi,
  /\binspection\b/gi,
  /\bcauses physics\b/gi,
  /\bairflow mitigation\b/gi,
  /\bmitigation\b/gi,
  /\bremediation effectiveness\b/gi,
  /\bremediation\b/gi,
  /\beffectiveness\b/gi,
  /\bfalse fixes\b/gi,
  /\blimitations\b/gi,
  /\bdiagnostic signs\b/gi,
  /\bdifferentiation\b/gi,
  /\bescalation risk\b/gi,
  /\brisk assessment\b/gi,
  /\bproblem\b/gi,
  /\bproblems\b/gi,
  /\bintervention\b/gi,
  /\binterventions\b/gi,
  /\bsolution\b/gi,
  /\bsolutions\b/gi,
  /\bunderlying physical cause\b/gi,
  /\bphysical cause transport\b/gi,
  /\btransport\b/gi,
  /\bcauses\b/gi,
  /\banalysis\b/gi,
  /\bevaluation\b/gi,
  /\bstrategy\b/gi,
  /\bstrategies\b/gi,
  /\bcomparison\b/gi,
  /\bcomparative\b/gi
];

/**
 * Strips generic editorial intent terms from bibliographic query strings.
 */
export function sanitizeBibliographicTerms(termString: string): string {
  let cleaned = termString;
  for (const pattern of EDITORIAL_INTENT_TERMS) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Renders provider-specific queries from decomposed concepts.
 */
export function renderProviderSpecificQuery(
  rawTerms: string,
  targetProvider: 'CROSSREF' | 'WIKIPEDIA' | 'OPEN_WEB' | 'HERMES_BROWSER' | 'ALL',
  language: 'id' | 'en' = 'en',
  domainContext?: string
): string {
  if (targetProvider === 'CROSSREF') {
    let sanitized = sanitizeBibliographicTerms(rawTerms);
    const words = sanitized.split(' ').filter(w => w.length > 2);
    let dedupedWords = Array.from(new Set(words));

    // Anchor enforcement: Ensure query is not unanchored
    const anchorTokens = domainContext
      ? domainContext.toLowerCase().split(/\s+/).filter(w => w.length > 2)
      : [];
    const hasAnchor = anchorTokens.some(tok => sanitized.toLowerCase().includes(tok));
    if (domainContext && !hasAnchor) {
      dedupedWords = [...anchorTokens.slice(0, 3), ...dedupedWords];
    }

    let result = dedupedWords.slice(0, 5).join(' ').trim();
    if (!result || result.length < 5) {
      result = (domainContext ? `${domainContext} ` : '') + 'materials engineering';
    }
    return truncateAtWordBoundary(result, MAX_QUERY_LENGTH);
  }

  if (targetProvider === 'WIKIPEDIA') {
    let sanitized = sanitizeBibliographicTerms(rawTerms);
    const words = sanitized.split(' ').filter(w => w.length > 2);
    const topWords = Array.from(new Set(words)).slice(0, 3);
    const result = topWords.join(' ').trim();
    return truncateAtWordBoundary(result || rawTerms, MAX_QUERY_LENGTH);
  }

  return truncateAtWordBoundary(rawTerms, MAX_QUERY_LENGTH);
}

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
export function deriveEnglishConceptEquivalents(concepts: ConceptDecomposition): {
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
 * Extracts a structured, entity-pinned topic profile separating the 6 key dimensions:
 * 1. Primary article entity
 * 2. Material or building system
 * 3. Reader problem
 * 4. Research question
 * 5. Evidence requirement
 * 6. Geographic applicability
 */
export function extractEntityPinnedTopicProfile(topic: string, requirements?: string[]): EntityPinnedTopicProfile {
  const lower = topic.toLowerCase();
  const decomp = decomposeTopicConcepts(topic);
  const enDecomp = deriveEnglishConceptEquivalents(decomp);

  // 1. Window Condensation & Dew Point (Evaluated before general glass terms to avoid misprofiling)
  if (/(?:ber)?kondensasi|embun|dew point/i.test(lower)) {
    return {
      topic,
      primary_article_entity: 'jendela dan bukaan berkondensasi',
      material_or_building_system: 'fenestration thermal envelope and condensation resistance',
      reader_problem: 'kondensasi permukaan kaca dan kusen akibat kelembapan tinggi dan suhu permukaan di bawah titik embun',
      research_question: 'Apa mekanisme fisik kondensasi pada bukaan hunian tropis dan efektivitas pemutus termal (thermal break) serta ventilasi?',
      evidence_requirement: 'Konduktivitas termal profil, titik embun (dew point), U-factor, relative humidity, dan psychrometric design',
      geographic_applicability: 'TROPICAL_HUMID',
      controlled_scholarly_anchor: 'window frame condensation thermal break',
      controlled_physical_systems: ['surface condensation dew point', 'polyamide thermal break', 'thermal transmittance U-factor', 'interior relative humidity'],
      controlled_concepts: {
        id_terms: ['jendela berkondensasi', 'titik embun', 'thermal break', 'kelembapan'],
        en_terms: ['window condensation', 'dew point', 'thermal break', 'relative humidity']
      }
    };
  }

  // 2. Thermal Bridge (Building Envelope / Concrete Substrates vs Aluminium Fenestration)
  if (/(?:thermal bridge|jembatan termal)/i.test(lower)) {
    const isConcreteOrMasonry = /\b(?:beton|dak|balok|dinding|tembok|slab|concrete|masonry)\b/i.test(lower);
    if (isConcreteOrMasonry) {
      return {
        topic,
        primary_article_entity: 'thermal bridge dinding dan balok beton',
        material_or_building_system: 'reinforced concrete and masonry building envelope thermal bridging',
        reader_problem: 'kebocoran panas konduktif dan titik dingin melalui elemen struktur beton tanpa insulasi',
        research_question: 'Bagaimana mekanisme transmisi panas linear pada pertemuan dak/balok beton dan efektivitas insulasi eksterior serta pemutus termal struktural?',
        evidence_requirement: 'Transmitansi termal linear Psi balok beton, insulasi eksternal (EIFS), thermal break struktural, dan pencegahan kondensasi',
        geographic_applicability: 'UNIVERSAL_PHYSICS',
        controlled_scholarly_anchor: 'concrete thermal bridge linear transmittance insulation',
        controlled_physical_systems: ['concrete thermal bridge', 'linear thermal transmittance Psi', 'exterior wall insulation', 'structural thermal break'],
        controlled_concepts: {
          id_terms: ['thermal bridge beton', 'balok beton', 'insulasi eksterior', 'transmitansi linear'],
          en_terms: ['concrete thermal bridge', 'reinforced concrete', 'exterior insulation', 'linear transmittance Psi']
        }
      };
    }

    return {
      topic,
      primary_article_entity: 'thermal bridge kusen aluminium',
      material_or_building_system: 'building envelope aluminium fenestration',
      reader_problem: 'kebocoran panas konduktif dan titik dingin profil logam',
      research_question: 'Bagaimana mekanisme transmisi panas linear pada profil aluminium dan mitigasi thermal break?',
      evidence_requirement: 'Transmitansi termal linear Psi, pemutus poliamida, simulasi THERM, dan termografi inframerah',
      geographic_applicability: 'UNIVERSAL_PHYSICS',
      controlled_scholarly_anchor: 'thermal bridge fenestration linear transmittance',
      controlled_physical_systems: ['polyamide thermal break', 'linear thermal transmittance Psi', 'frame heat conduction', 'infrared thermography'],
      controlled_concepts: {
        id_terms: ['thermal bridge', 'profil aluminium', 'penghambat panas', 'konduktivitas'],
        en_terms: ['thermal bridge', 'aluminium profile', 'thermal break', 'linear transmittance']
      }
    };
  }

  // 3. Ceramic Floor Popping & Movement Joints
  if (/\b(?:popping|meledak|terangkat|keramik|tile|lantai)\b/i.test(lower)) {
    return {
      topic,
      primary_article_entity: 'ubin keramik lantai terangkat (popping)',
      material_or_building_system: 'tiled floor screed and mortar bed system',
      reader_problem: 'keramik terangkat meledak akibat pemuaian termal dan ketiadaan dilatasi',
      research_question: 'Mengapa keramik lantai terangkat meledak dan bagaimana peranan nat serta movement joint?',
      evidence_requirement: 'Tegangan geser mortar semen, muai susut termal/kelembapan, dan standar celah dilatasi (movement joint)',
      geographic_applicability: 'TROPICAL_HUMID',
      controlled_scholarly_anchor: 'ceramic tile tenting buckling debonding',
      controlled_physical_systems: ['thinset mortar shear bond', 'thermal moisture expansion', 'movement expansion joint', 'concrete substrate shrinkage'],
      controlled_concepts: {
        id_terms: ['keramik lantai', 'keramik popping', 'sambungan dilatasi', 'mortar semen'],
        en_terms: ['ceramic tile flooring', 'tile tenting debonding', 'movement expansion joint', 'thinset mortar']
      }
    };
  }

  // 4. Fenestration & Architectural Glass
  if (/\b(?:kaca|glass|tempered|laminated)\b/i.test(lower)) {
    return {
      topic,
      primary_article_entity: 'kaca laminated dan kaca tempered',
      material_or_building_system: 'architectural safety glass and glazing systems',
      reader_problem: 'karakteristik keamanan pecah, ketahanan benturan, dan isolasi suara',
      research_question: 'Bagaimana perbandingan karakteristik mekanis, mitigasi benturan, dan batas kegagalan kaca laminated vs tempered?',
      evidence_requirement: 'Standar pengujian benturan (impact), tegangan termal, transmisi akustik STC, dan interlayer PVB/EVA',
      geographic_applicability: 'TROPICAL_HUMID',
      controlled_scholarly_anchor: 'laminated tempered architectural glass',
      controlled_physical_systems: ['laminated safety glass PVB', 'tempered toughened glass', 'acoustic sound transmission STC', 'impact resistance fracture'],
      controlled_concepts: {
        id_terms: ['kaca laminated', 'kaca tempered', 'ketahanan benturan', 'isolasi suara'],
        en_terms: ['laminated glass PVB', 'tempered glass', 'impact resistance', 'acoustic sound STC']
      }
    };
  }

  // 5. Moisture & Walls
  if (/\b(?:dinding|tembok|rembes|lembab|lembap)\b/i.test(lower)) {
    return {
      topic,
      primary_article_entity: 'dinding tembok rembes dan berjamur',
      material_or_building_system: 'masonry wall and waterproofing envelope',
      reader_problem: 'kelembapan rembesan air kapiler dan pertumbuhan jamur',
      research_question: 'Bagaimana mekanisme pergerakan air kapiler pada dinding dan batasan cat pelapis waterproofing?',
      evidence_requirement: 'Daya kapilaritas pasangan bata, tekanan uap air, dan permeabilitas membran waterproofing',
      geographic_applicability: 'TROPICAL_HUMID',
      controlled_scholarly_anchor: 'masonry wall dampness capillary moisture',
      controlled_physical_systems: ['capillary suction rising damp', 'vapor diffusion', 'waterproofing membrane', 'efflorescence'],
      controlled_concepts: {
        id_terms: ['dinding tembok', 'kelembapan rembesan', 'pelapis waterproofing', 'daya kapilaritas'],
        en_terms: ['masonry wall', 'moisture dampness', 'waterproofing membrane', 'capillary suction']
      }
    };
  }

  // 6. Generic Building Science Fallback
  const idEntities = decomp.problem_entities.slice(0, 2);
  const enEntities = enDecomp.enEntities.slice(0, 2);
  return {
    topic,
    primary_article_entity: idEntities.join(' ') || 'elemen bangunan',
    material_or_building_system: enEntities.join(' ') || 'building system',
    reader_problem: decomp.symptoms[0] || 'gangguan performa fisik',
    research_question: 'Investigate physical causes, diagnostic boundaries, and mitigation effectiveness',
    evidence_requirement: 'Empirical building science testing specifications and institutional guidelines',
    geographic_applicability: 'UNIVERSAL_PHYSICS',
    controlled_scholarly_anchor: enEntities.join(' ') || 'building materials engineering',
    controlled_physical_systems: enDecomp.enMechanisms.concat(enDecomp.enInterventions),
    controlled_concepts: {
      id_terms: idEntities,
      en_terms: enEntities
    }
  };
}

/**
 * Normalizes and anchors caller-supplied queries to prevent unanchored drift or out-of-domain searches.
 */
export function normalizeAndAnchorCallerQuery(
  rawQuery: string,
  topic: string,
  profile: EntityPinnedTopicProfile
): {
  normalizedQuery: string;
  action: 'ACCEPTED' | 'ANCHORED' | 'REJECTED';
  reason: string;
} {
  const clean = String(rawQuery || '').trim();
  const lower = clean.toLowerCase();

  // 1. Reject empty or ultra-short queries
  if (clean.length < 3) {
    return {
      normalizedQuery: '',
      action: 'REJECTED',
      reason: 'EMPTY_OR_TOO_SHORT: Caller query is under 3 characters.'
    };
  }

  // 2. Reject out-of-domain generic searches (medical, apparel, clinical AI, politics, gambling, spam)
  const isOutOfDomain = /\b(?:patient|hospital|clinical|therapy|disease|vaccine|chemotherapy|spondylodiscitis|skeletal atrophy|paralysis|ehr|electronic health records|mensurations|garment|fashion|election|political candidate|judi|slot|gacor|togel|casino|betting|poker|crypto|bitcoin|forex|porno|viagra)\b/i.test(lower);
  if (isOutOfDomain) {
    return {
      normalizedQuery: '',
      action: 'REJECTED',
      reason: 'OUT_OF_DOMAIN_REJECTION: Caller query contains out-of-domain concepts.'
    };
  }

  // 3. Sanitize generic editorial intent words
  const sanitized = sanitizeBibliographicTerms(clean);

  // 4. Check whether query contains domain anchor tokens
  const anchorTokens = [
    ...profile.controlled_scholarly_anchor.toLowerCase().split(/\s+/),
    ...profile.primary_article_entity.toLowerCase().split(/\s+/),
    ...profile.material_or_building_system.toLowerCase().split(/\s+/)
  ].filter(w => w.length > 2);

  const hasAnchor = anchorTokens.some(tok => lower.includes(tok));

  if (!hasAnchor) {
    // Unanchored query: Anchor it by prepending scholarly anchor
    const anchored = `${profile.controlled_scholarly_anchor} ${sanitized}`.trim();
    const finalQuery = truncateAtWordBoundary(anchored, MAX_QUERY_LENGTH);
    return {
      normalizedQuery: finalQuery,
      action: 'ANCHORED',
      reason: `UNANCHORED_QUERY: Prepend controlled anchor "${profile.controlled_scholarly_anchor}".`
    };
  }

  // Query is already anchored
  const finalQuery = truncateAtWordBoundary(sanitized, MAX_QUERY_LENGTH);
  return {
    normalizedQuery: finalQuery,
    action: 'ACCEPTED',
    reason: 'VALID_ANCHORED_QUERY: Query contains domain concepts and is well-bounded.'
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
    const profile = extractEntityPinnedTopicProfile(input.topic, input.contentFamily ? [input.contentFamily] : undefined);
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

      // Build provider-tailored variants
      const variants: DiscoveryQueryVariant[] = [
        {
          language: 'id',
          query: finalIdQuery,
          intent: `${params.intent} (Indonesian technical)`,
          target_provider: params.targetProvider
        },
        {
          language: 'en',
          query: params.targetProvider === 'CROSSREF'
            ? renderProviderSpecificQuery(finalEnQuery, 'CROSSREF', 'en', primaryEntityEn)
            : finalEnQuery,
          intent: `${params.intent} (English technical)`,
          target_provider: params.targetProvider
        }
      ];

      // Add specialized variants for CrossRef, Wikipedia, and OpenWeb if targetProvider is ALL
      if (params.targetProvider === 'ALL') {
        const crQuery = renderProviderSpecificQuery(rawEnQuery, 'CROSSREF', 'en', primaryEntityEn);
        const wikiQuery = renderProviderSpecificQuery(rawEnQuery, 'WIKIPEDIA', 'en');
        const wikiIdQuery = renderProviderSpecificQuery(rawIdQuery, 'WIKIPEDIA', 'id');
        const openWebQuery = renderProviderSpecificQuery(rawEnQuery, 'OPEN_WEB', 'en');

        if (crQuery && !variants.some(v => v.query === crQuery && v.target_provider === 'CROSSREF')) {
          variants.push({
            language: 'en',
            query: crQuery,
            intent: `${params.intent} (CrossRef scholarly concepts)`,
            target_provider: 'CROSSREF'
          });
        }
        if (wikiQuery && !variants.some(v => v.query === wikiQuery && v.target_provider === 'WIKIPEDIA')) {
          variants.push({
            language: 'en',
            query: wikiQuery,
            intent: `${params.intent} (Wikipedia encyclopedic concept EN)`,
            target_provider: 'WIKIPEDIA'
          });
        }
        if (wikiIdQuery && !variants.some(v => v.query === wikiIdQuery && v.target_provider === 'WIKIPEDIA')) {
          variants.push({
            language: 'id',
            query: wikiIdQuery,
            intent: `${params.intent} (Wikipedia encyclopedic concept ID)`,
            target_provider: 'WIKIPEDIA'
          });
        }
        if (openWebQuery && !variants.some(v => v.query === openWebQuery && v.target_provider === 'OPEN_WEB')) {
          variants.push({
            language: 'en',
            query: openWebQuery,
            intent: `${params.intent} (Open-web technical query)`,
            target_provider: 'OPEN_WEB'
          });
        }
      }

      const queryItem: StructuredDiscoveryQuery = {
        query_id: qId,
        research_question_id: params.rqId,
        category: params.category,
        target_provider: params.targetProvider,
        concepts: decomposition,
        entity_profile: profile,
        variants,
        derived_from_concepts: [...cleanIdWords]
      };

      plannedQueries.push(queryItem);
    };

    const primaryEntityId = profile.controlled_concepts.id_terms.slice(0, 2).join(' ') || decomposition.problem_entities.slice(0, 2).join(' ') || 'bangunan';
    const primaryEntityEn = profile.controlled_scholarly_anchor || enConcepts.enEntities.slice(0, 2).join(' ') || 'building';

    const primarySymptomId = decomposition.symptoms[0] || 'kerusakan';
    const primarySymptomEn = enConcepts.enSymptoms[0] || 'failure';

    const primaryMechId = decomposition.mechanisms[0] || 'mekanisme';
    const primaryMechEn = enConcepts.enMechanisms[0] || 'mechanism';

    const primaryInterventionId = decomposition.interventions[0] || 'solusi teknis';
    const primaryInterventionEn = enConcepts.enInterventions[0] || 'mitigation';

    if (passNum === 1 || missingCats.length === 0) {
      // Pass 1: Balanced foundational discovery across categories

      // 1. Mechanism / Cause
      addQuery({
        category: 'PLAUSIBLE_CAUSES',
        rqId: 'RQ-001',
        targetProvider: 'ALL',
        idKeywords: [primaryEntityId, primarySymptomId, primaryMechId, 'mekanisme kerusakan fisika'],
        enKeywords: [primaryEntityEn, primarySymptomEn, primaryMechEn, 'failure mechanism physics'],
        intent: 'Investigate physical causes and failure mechanisms'
      });

      // 2. Differential Diagnosis / Distinction
      addQuery({
        category: 'DIFFERENTIAL_DIAGNOSIS',
        rqId: 'RQ-002',
        targetProvider: 'ALL',
        idKeywords: [primaryEntityId, primarySymptomId, 'perbedaan komparasi spesifikasi'],
        enKeywords: [primaryEntityEn, primarySymptomEn, 'comparative performance distinction'],
        intent: 'Distinguish symptomatic causes and boundary indicators'
      });

      // 3. Intervention / Effectiveness
      addQuery({
        category: 'INTERVENTION_MAPPING',
        rqId: 'RQ-003',
        targetProvider: 'ALL',
        idKeywords: [primaryEntityId, primaryInterventionId, 'mitigasi perbaikan pemasangan'],
        enKeywords: [primaryEntityEn, primaryInterventionEn, 'remediation installation mitigation'],
        intent: 'Evaluate technical intervention and installation effectiveness'
      });

      // 4. Standards & Guidance
      addQuery({
        category: 'EMPIRICAL_RECOMMENDATION_SUPPORT',
        rqId: 'RQ-006',
        targetProvider: 'ALL',
        idKeywords: [primaryEntityId, 'standar teknis SNI pedoman'],
        enKeywords: [primaryEntityEn, 'building science standards testing specification'],
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
            enKeywords: [primaryEntityEn, primarySymptomEn, 'underlying failure mechanism physical'],
            intent: 'Gap-directed physical cause investigation'
          });
        } else if (cat === 'DIFFERENTIAL_DIAGNOSIS') {
          addQuery({
            category: 'DIFFERENTIAL_DIAGNOSIS',
            rqId: 'RQ-002',
            targetProvider: 'ALL',
            idKeywords: [primaryEntityId, primarySymptomId, 'tanda pembeda komparasi'],
            enKeywords: [primaryEntityEn, primarySymptomEn, 'comparative distinction boundary'],
            intent: 'Gap-directed diagnostic differentiation'
          });
        } else if (cat === 'INTERVENTION_MAPPING') {
          addQuery({
            category: 'INTERVENTION_MAPPING',
            rqId: 'RQ-003',
            targetProvider: 'ALL',
            idKeywords: [primaryEntityId, primaryInterventionId, 'efektivitas perbaikan'],
            enKeywords: [primaryEntityEn, primaryInterventionEn, 'remediation installation performance'],
            intent: 'Gap-directed intervention mapping'
          });
        } else if (cat === 'LIMITATIONS_AND_FALSE_FIXES') {
          addQuery({
            category: 'LIMITATIONS_AND_FALSE_FIXES',
            rqId: 'RQ-004',
            targetProvider: 'ALL',
            idKeywords: [primaryEntityId, primaryInterventionId, 'keterbatasan batas fisik kegagalan'],
            enKeywords: [primaryEntityEn, primaryInterventionEn, 'failure modes boundary conditions'],
            intent: 'Gap-directed limitations and failure boundary investigation'
          });
        } else if (cat === 'ESCALATION_CONDITIONS') {
          addQuery({
            category: 'ESCALATION_CONDITIONS',
            rqId: 'RQ-005',
            targetProvider: 'ALL',
            idKeywords: [primaryEntityId, primarySymptomId, 'kondisi inspeksi risiko struktural'],
            enKeywords: [primaryEntityEn, primarySymptomEn, 'inspection assessment risk criteria'],
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
      entity_profile: profile,
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
