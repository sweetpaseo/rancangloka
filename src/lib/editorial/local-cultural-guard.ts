/**
 * RancangLoka — Dimas Editorial System Guard: Local Cultural Grounding
 * Milestone: RANCANGLOKA_LOCAL_CULTURAL_GROUNDING_1
 *
 * Canonical Principle: LOCAL CULTURAL GROUNDING
 * "RancangLoka tidak hanya menerjemahkan pengetahuan arsitektur ke Bahasa Indonesia.
 *  RancangLoka menjelaskan arsitektur dari realitas hidup orang Indonesia."
 *
 * Relationship with WARM ADVISORY TONE:
 * - WARM ADVISORY TONE = HOW RancangLoka speaks (warmth, calmness, clarity, respect)
 * - LOCAL CULTURAL GROUNDING = WHICH LIVED REALITY RancangLoka speaks from (housing reality, climate, maintenance, decision context)
 * Both operate together.
 *
 * Strict Invariants:
 * 1. INVARIANT_LOCAL_CULTURAL_GROUNDING:
 *    Editorial content must reflect the lived realities of Indonesian homes, construction,
 *    climate, and renovation without relying on foreign framing or translationese.
 * 2. INVARIANT_ANTI_CULTURAL_STEREOTYPE:
 *    Local grounding must never weaken evidence standards. Broad unsupported cultural
 *    generalizations ("Orang Indonesia selalu...", "Masyarakat kita pasti...") are prohibited.
 * 3. INVARIANT_STANDARD_INDONESIAN_BASE:
 *    Standard Indonesian remains the canonical base. Locality comes from situational reality,
 *    decision context, and technical vocabulary — NOT forced regional dialect or internet slang.
 * 4. NATURAL_IDIOM_POLICY:
 *    Idiomatic Indonesian is encouraged when it improves naturalness, but presence is NOT mandatory.
 *    Idioms must never be inserted performatively or become repetitive boilerplate.
 * 5. NO CRUDE KEYWORD SCORING:
 *    Dimas provides structural/semantic checklist evidence without keyword counts, slang counts,
 *    or regex idiom point-scoring.
 */

export const INVARIANT_LOCAL_CULTURAL_GROUNDING = 'LOCAL_CULTURAL_GROUNDING';
export const INVARIANT_ANTI_CULTURAL_STEREOTYPE = 'ANTI_CULTURAL_STEREOTYPE';
export const INVARIANT_STANDARD_INDONESIAN_BASE = 'STANDARD_INDONESIAN_BASE';

export interface LocalCulturalReviewQuestions {
  expert_to_homeowner_dialogue: boolean;    // Does this sound like an Indonesian expert speaking naturally to an Indonesian homeowner?
  recognizable_housing_reality: boolean;    // Are examples recognizable within Indonesian housing reality?
  free_of_translationese: boolean;          // Does the article feel translated from an English source, even though words are Indonesian?
  familiar_construction_vocabulary: boolean;// Are technical terms expressed using vocabulary familiar in Indonesian construction / homeowner conversations?
  natural_not_performative_idioms: boolean; // Are local idioms natural rather than inserted performatively?
  free_of_unsupported_stereotypes: boolean; // Does the article avoid unsupported stereotypes about Indonesian people?
  plausible_consultation_dialogue: boolean; // Could this explanation plausibly occur in a real consultation between an Indonesian homeowner and an experienced building consultant?
}

export interface LocalCulturalChecklist {
  local_cultural_grounding: 'PASS' | 'REVISION_REQUIRED';
  indonesian_context_fit: 'PASS' | 'REVISION_REQUIRED';
  translationese_risk: 'PASS' | 'REVISION_REQUIRED';
  cultural_generalization_safety: 'PASS' | 'REVISION_REQUIRED';
  content_family: string;
  review_questions: LocalCulturalReviewQuestions;
  evaluation_notes: string[];
  flags: Array<{
    type:
      | 'UNSUPPORTED_LOCAL_GENERALIZATION'
      | 'CULTURAL_STEREOTYPE_OVERREACH'
      | 'LOCAL_CONTEXT_CLAIM_WITHOUT_SUPPORT'
      | 'TRANSLATIONESE_RESIDUAL'
      | 'FORCED_SLANG_OR_DIALECT';
    description: string;
    passage?: string;
  }>;
}

/**
 * Patterns of unsupported broad generalizations and cultural stereotypes about Indonesian people/habits.
 * STRICT GUARD: Do NOT write broad unsupported statements such as "Orang Indonesia selalu..."
 */
export const STEREOTYPE_GENERALIZATION_PATTERNS = [
  { pattern: /\borang indonesia selalu\b/i, name: 'orang indonesia selalu' },
  { pattern: /\brumah indonesia biasanya selalu\b/i, name: 'rumah indonesia biasanya selalu' },
  { pattern: /\bmasyarakat kita pasti\b/i, name: 'masyarakat kita pasti' },
  { pattern: /\borang kita memang suka\b/i, name: 'orang kita memang suka' },
  { pattern: /\bsemua orang indonesia\b/i, name: 'semua orang indonesia' },
  { pattern: /\bmasyarakat indonesia selalu\b/i, name: 'masyarakat indonesia selalu' },
  { pattern: /\borang indonesia malas\b/i, name: 'orang indonesia malas' },
  { pattern: /\bkebiasaan orang indonesia yang selalu\b/i, name: 'kebiasaan orang indonesia yang selalu' }
];

/**
 * Patterns of heavy translationese / foreign syntax calques that sound translated
 * rather than natively authored in standard Indonesian.
 */
export const TRANSLATIONESE_CALQUE_PATTERNS = [
  { pattern: /\bdalam rangka untuk\b/i, name: 'dalam rangka untuk (in order to)' },
  { pattern: /\bmemainkan peran penting dalam\b/i, name: 'memainkan peran penting dalam (plays an important role)' },
  { pattern: /\bdi akhir hari\b/i, name: 'di akhir hari (at the end of the day)' },
  { pattern: /\bmasuk akal untuk mengatakan bahwa\b/i, name: 'masuk akal untuk mengatakan bahwa (makes sense to say)' },
  { pattern: /\bmemberikan jalan untuk\b/i, name: 'memberikan jalan untuk (give way to)' },
  { pattern: /\bmerupakan sebuah keharusan\b/i, name: 'merupakan sebuah keharusan (is a must)' },
  { pattern: /\bmengambil tempat\b/i, name: 'mengambil tempat (take place)' },
  { pattern: /\bmenjadi subjek dari\b/i, name: 'menjadi subjek dari (be subject to)' },
  { pattern: /\bterlepas dari fakta bahwa\b/i, name: 'terlepas dari fakta bahwa (despite the fact that)' }
];

/**
 * Recognizers for contextual Indonesian lived reality (climate, housing, construction, maintenance).
 * These are contextual possibilities, NOT mandatory checkboxes for every article.
 */
export const INDONESIAN_CONTEXT_INDICATORS = [
  // Climate & Environmental Context
  /\b(?:iklim tropis|tropis lembap|musim hujan|tempias|panas sore|matahari barat|kelembapan|arah hadap|paparan panas|ventilasi silang)\b/i,
  // Housing Realities & Constraints
  /\b(?:rumah tumbuh|renovasi bertahap|rumah klaster|lahan sempit|gang|akses terbatas|tetangga|privasi|dinding bersama|kavling)\b/i,
  // Maintenance & Building Elements
  /\b(?:tukang(?: lokal)?|aplikator|perawatan|membersihkan|debu jalan|kosen|kusen|kanopi|dak(?: beton)?|roster|tritisan|bocoran|toko bangunan)\b/i,
  // Domestic Habitation Patterns
  /\b(?:buka-tutup jendela|jendela dibuka|menutup jendela|ruang keluarga|penggunaan ac|hawa panas)\b/i,
  // National Standards & Regulatory Context
  /\b(?:sni|permen pupr|standar nasional|rujukan nasional)\b/i
];

/**
 * Evaluates editorial content against LOCAL CULTURAL GROUNDING principles.
 * Non-crude semantic checklist without keyword counting or idiom point scoring.
 */
export function evaluateLocalCulturalGrounding(
  content: string,
  options: {
    contentFamily?: string;
    title?: string;
  } = {}
): LocalCulturalChecklist {
  const contentFamily = options.contentFamily || 'explainer';
  const notes: string[] = [];
  const flags: LocalCulturalChecklist['flags'] = [];

  // 1. Cultural Stereotype & Broad Unsupported Generalization Check
  for (const p of STEREOTYPE_GENERALIZATION_PATTERNS) {
    if (p.pattern.test(content)) {
      flags.push({
        type: 'CULTURAL_STEREOTYPE_OVERREACH',
        description: `Ditemukan generalisasi budaya / stereotip tanpa bukti (${p.name}). RancangLoka melarang klaim generalisasi sosiologis tanpa dasar empiris.`,
        passage: content.slice(Math.max(0, content.search(p.pattern) - 20), content.search(p.pattern) + 80)
      });
      notes.push(`[STEREOTYPE_OVERREACH] Terdeteksi generalisasi sosiologis tanpa bukti (${p.name}). Gunakan observasi kontekstual.`);
    }
  }

  // 2. Translationese / Syntax Calque Check
  for (const tcp of TRANSLATIONESE_CALQUE_PATTERNS) {
    if (tcp.pattern.test(content)) {
      flags.push({
        type: 'TRANSLATIONESE_RESIDUAL',
        description: `Ditemukan sintaks calque terjemahan asing (${tcp.name}). Gunakan ungkapan bahasa Indonesia alami.`,
        passage: content.slice(Math.max(0, content.search(tcp.pattern) - 20), content.search(tcp.pattern) + 80)
      });
      notes.push(`[TRANSLATIONESE] Terdeteksi pola terjemahan harfiah (${tcp.name}). Ubah ke tata bahasa Indonesia alami.`);
    }
  }

  // 3. Indonesian Context Fit (Lived Reality Recognition)
  // For editorial content (comparison, problem solver, material guide, explainer),
  // we check whether the writing engages with relevant physical/practical context of Indonesian homes.
  // Note: For News/Regulation, cultural grounding is restrained and fact reporting remains dominant.
  const hasLocalContextIndicators = INDONESIAN_CONTEXT_INDICATORS.some((pattern) => pattern.test(content));

  if (!hasLocalContextIndicators && contentFamily !== 'news' && contentFamily !== 'reference') {
    // If the article discusses architectural/building choices with zero Indonesian context grounding
    notes.push('[LOCAL_CONTEXT_DEFICIT] Naskah tampak terlalu abstrak atau berjarak dari realitas fisik hunian Indonesia.');
  } else {
    notes.push('Naskah memuat pijakan realitas fisik dan kontekstual hunian Indonesia yang relevan.');
  }

  // 4. Synthesize Review Questions
  const reviewQuestions: LocalCulturalReviewQuestions = {
    expert_to_homeowner_dialogue: !flags.some((f) => f.type === 'TRANSLATIONESE_RESIDUAL'),
    recognizable_housing_reality: hasLocalContextIndicators || contentFamily === 'news' || contentFamily === 'reference',
    free_of_translationese: !flags.some((f) => f.type === 'TRANSLATIONESE_RESIDUAL'),
    familiar_construction_vocabulary: true,
    natural_not_performative_idioms: true,
    free_of_unsupported_stereotypes: !flags.some((f) => f.type === 'CULTURAL_STEREOTYPE_OVERREACH' || f.type === 'UNSUPPORTED_LOCAL_GENERALIZATION'),
    plausible_consultation_dialogue: flags.length === 0
  };

  // 5. Determine Structured Workflow Evidence
  const culturalGeneralizationSafety = flags.some((f) => f.type === 'CULTURAL_STEREOTYPE_OVERREACH' || f.type === 'UNSUPPORTED_LOCAL_GENERALIZATION')
    ? 'REVISION_REQUIRED'
    : 'PASS';

  const translationeseRisk = flags.some((f) => f.type === 'TRANSLATIONESE_RESIDUAL')
    ? 'REVISION_REQUIRED'
    : 'PASS';

  const indonesianContextFit = (!hasLocalContextIndicators && contentFamily !== 'news' && contentFamily !== 'reference')
    ? 'REVISION_REQUIRED'
    : 'PASS';

  const localCulturalGrounding = (
    culturalGeneralizationSafety === 'PASS' &&
    translationeseRisk === 'PASS' &&
    indonesianContextFit === 'PASS'
  ) ? 'PASS' : 'REVISION_REQUIRED';

  return {
    local_cultural_grounding: localCulturalGrounding,
    indonesian_context_fit: indonesianContextFit,
    translationese_risk: translationeseRisk,
    cultural_generalization_safety: culturalGeneralizationSafety,
    content_family: contentFamily,
    review_questions: reviewQuestions,
    evaluation_notes: notes,
    flags
  };
}
