/**
 * RancangLoka — Local Human Casting Policy v1.0
 * Module: src/lib/editorial/local-human-casting-policy.ts
 *
 * OWNER EDITORIAL DECISION:
 * Menetapkan kebijakan casting manusia untuk seluruh gambar AI editorial RancangLoka:
 * Cover, Inline images, Kling Image Series, Thumbnail, dan materi sosial media turunan.
 *
 * RULES:
 * 1. Jika visual memerlukan manusia, prioritaskan penampilan khas masyarakat Indonesia / Asia Tenggara.
 * 2. Berlaku bagi pria, wanita, anak-anak, orang tua, dan keluarga.
 * 3. Jangan menggunakan default model Western, European, atau Caucasian dalam generasi foto editorial RancangLoka.
 * 4. Gunakan pakaian, gestur, aktivitas, dan lingkungan yang autentik dengan kehidupan Indonesia.
 * 5. Pertahankan proporsi tubuh, anatomi, dan ekspresi alami (5 jari tangan, tanpa deformasi AI).
 * 6. Jangan memaksakan manusia pada komposisi arsitektur yang tidak memerlukannya.
 * 7. Jika menggunakan Image Series, pertahankan konsistensi identitas dan penampilan model manusia antar-shot.
 * 8. Tambahkan instruksi casting ke Budi Prompt Engine dan storyboard Nadia.
 * 9. Rina mengevaluasi relevansi visual terhadap target pembaca Indonesia. Jangan mengklaim asal etnis seseorang dapat dipastikan hanya dari wajah.
 * 10. Jangan mengubah foto existing atau melakukan generasi berbayar.
 */

export const LOCAL_HUMAN_CASTING_POLICY_VERSION = 'v1.0';

export type HumanPresenceType = 'NONE' | 'BACKGROUND_SCALE' | 'DOMESTIC_ACTIVITY';

export type HumanDemographicType =
  | 'ADULT_MALE'
  | 'ADULT_FEMALE'
  | 'CHILD'
  | 'ELDERLY'
  | 'COUPLE'
  | 'FAMILY'
  | 'UNSPECIFIED';

export interface HumanCastingSpec {
  /**
   * Presence of human in the visual composition (Rule 6).
   * Default is 'NONE' to avoid forcing human figures onto pure architectural views.
   */
  presence: HumanPresenceType;
  demographic?: HumanDemographicType;
  activity_description?: string;
  clothing_style?: string;
  consistency_id?: string; // For multi-shot series continuity (Rule 7)
  is_architectural_primary?: boolean; // True by default (Rule 6)
}

export interface HumanCastingPromptTokens {
  positive_tokens: string;
  negative_tokens: string[];
  is_active: boolean;
  presence: HumanPresenceType;
}

/**
 * Standard negative constraints that eliminate Western/Caucasian defaults,
 * fashion catalog poses, and synthetic AI human deformities.
 */
export const CANONICAL_HUMAN_CASTING_NEGATIVES = [
  'caucasian model',
  'western features',
  'european default model',
  'blonde hair',
  'blue eyes',
  'western fashion catalog pose',
  'artificial studio model styling',
  'heavy cosmetic makeup',
  'commercial stock photo pose',
  'glamour model pose',
  'deformed hands',
  'extra fingers',
  'missing fingers',
  'mutated anatomy',
  'uncanny valley facial expression'
];

/**
 * Standard negative tokens when NO human figures should appear in architectural shots.
 */
export const ARCHITECTURAL_NO_HUMAN_NEGATIVES = [
  'people',
  'person',
  'human figures',
  'man',
  'woman',
  'crowd',
  'model posing',
  'face'
];

/**
 * Compiles human casting prompt tokens for Budi Prompt Engine according to Policy v1.0.
 */
export function compileHumanCastingPromptTokens(
  spec?: HumanCastingSpec,
  options?: {
    is_series?: boolean;
    shot_index?: number;
  }
): HumanCastingPromptTokens {
  const presence = spec?.presence || 'NONE';

  // Rule 6: Do not force humans onto compositions that don't need them
  if (presence === 'NONE') {
    return {
      positive_tokens: 'pure architectural interior photography, unpopulated space, no people, clean structural focus',
      negative_tokens: [...ARCHITECTURAL_NO_HUMAN_NEGATIVES, ...CANONICAL_HUMAN_CASTING_NEGATIVES],
      is_active: false,
      presence: 'NONE'
    };
  }

  const demographic = spec?.demographic || 'UNSPECIFIED';
  let demographicLabel = 'an authentic Indonesian / Southeast Asian resident';

  switch (demographic) {
    case 'ADULT_MALE':
      demographicLabel = 'an authentic Indonesian man in his 30s-40s';
      break;
    case 'ADULT_FEMALE':
      demographicLabel = 'an authentic Indonesian woman in her 30s-40s';
      break;
    case 'CHILD':
      demographicLabel = 'an Indonesian child in comfortable domestic clothing';
      break;
    case 'ELDERLY':
      demographicLabel = 'an Indonesian grandparent with warm, gentle domestic expression';
      break;
    case 'COUPLE':
      demographicLabel = 'an authentic Indonesian couple at home';
      break;
    case 'FAMILY':
      demographicLabel = 'an authentic Indonesian family living naturally at home';
      break;
    default:
      demographicLabel = 'an authentic Southeast Asian / Indonesian resident';
      break;
  }

  // Authentic clothing & lived-in context (Rule 4)
  const clothing =
    spec?.clothing_style ||
    'wearing comfortable authentic Indonesian domestic homeware (such as relaxed cotton t-shirt, casual linen/cotton shorts or lounge trousers, neat unpretentious domestic appearance)';

  // Natural activity / gesture (Rule 4 & 5)
  const activity =
    spec?.activity_description ||
    (presence === 'BACKGROUND_SCALE'
      ? 'standing casually in the background providing architectural scale, completely unposed, looking away or engaged in domestic routine'
      : 'naturally preparing food or interacting with the home environment with authentic domestic gestures');

  const anatomicalInvariant =
    'physically plausible human anatomy, realistic five-fingered hands, natural unforced posture, warm natural Indonesian complexion, authentic lived-in expression';

  const parts = [
    `FEATURING: ${demographicLabel}`,
    `ATTIRE: ${clothing}`,
    `GESTURE & ACTIVITY: ${activity}`,
    `ANATOMY & SCALE: ${anatomicalInvariant}`
  ];

  // Rule 7: Series continuity for human model
  if (options?.is_series && spec?.consistency_id) {
    parts.push(
      `SERIES CONTINUITY: Maintain 100% identical facial features, age, hairstyle, and wardrobe for the model across all shots (model ID: ${spec.consistency_id}).`
    );
  }

  return {
    positive_tokens: parts.join(', '),
    negative_tokens: CANONICAL_HUMAN_CASTING_NEGATIVES,
    is_active: true,
    presence
  };
}

/**
 * Input for Rina's Visual Audience Relevance Evaluation (Rule 9).
 */
export interface RinaHumanCastingAuditInput {
  has_human_present: boolean;
  spec?: HumanCastingSpec;
  observed: {
    clothing_authenticity: 'AUTHENTIC_INDONESIAN_DOMESTIC' | 'NEUTRAL_CASUAL' | 'WESTERN_CATALOG_FORMAL' | 'UNVERIFIABLE';
    activity_authenticity: 'NATURAL_HOME_ROUTINE' | 'COMMERCIAL_STAGED_POSE' | 'UNVERIFIABLE';
    anatomical_quality: 'NATURAL' | 'AI_DEFORMITY_DETECTED';
    western_caucasian_default_detected: boolean;
    series_model_consistency?: 'CONSISTENT' | 'DRIFT_DETECTED' | 'NOT_APPLICABLE';
  };
}

export interface RinaHumanCastingAuditResult {
  verdict: 'PASS' | 'NEEDS_REVIEW' | 'FAIL';
  score: number;
  notes: string[];
  rejection_reasons: string[];
  evaluation_basis: string;
}

/**
 * Rina evaluates visual relevance for the Indonesian audience (Rule 9).
 *
 * STRICT PRINCIPLE: Rina evaluates contextual cues (wardrobe, domestic setting,
 * activity, naturalness, absence of Caucasian catalog styling).
 * Does NOT claim ethnic origin can be determined solely by facial features.
 */
export function evaluateRinaHumanCastingCompliance(
  input: RinaHumanCastingAuditInput
): RinaHumanCastingAuditResult {
  const notes: string[] = [];
  const rejection_reasons: string[] = [];
  const evaluationBasis =
    'Evaluasi kepatuhan casting manusia berbasis relevansi kontekstual (pakaian rumah tangga, gestur alami, dan ketiadaan tropa model katalog Western) untuk audiens Indonesia, tanpa klaim esensialisasi etnis dari fitur wajah semata.';

  // If no human figure is present, verify architectural priority is respected (Rule 6)
  if (!input.has_human_present) {
    notes.push('Komposisi arsitektur murni tanpa figur manusia: Mematuhi Rule 6 (arsitektur adalah subjek utama).');
    return {
      verdict: 'PASS',
      score: 100,
      notes,
      rejection_reasons,
      evaluation_basis: evaluationBasis
    };
  }

  let score = 95;

  // 1. Check for Western / Caucasian default drift (Rule 3)
  if (input.observed.western_caucasian_default_detected) {
    score -= 40;
    rejection_reasons.push('Terdeteksi model default Western / Caucasian, melanggar Kebijakan Casting Manusia Lokal v1.0 (Rule 3).');
  }

  // 2. Check clothing authenticity (Rule 4)
  if (input.observed.clothing_authenticity === 'WESTERN_CATALOG_FORMAL') {
    score -= 20;
    notes.push('Pakaian terlalu bernuansa katalog formal Barat, kurang mencerminkan kebiasaan rumah tangga Indonesia.');
  } else if (input.observed.clothing_authenticity === 'AUTHENTIC_INDONESIAN_DOMESTIC') {
    notes.push('Pakaian mencerminkan busana rumah tangga Indonesia yang autentik dan santai.');
  }

  // 3. Check activity / posing authenticity (Rule 4)
  if (input.observed.activity_authenticity === 'COMMERCIAL_STAGED_POSE') {
    score -= 15;
    notes.push('Pose terlihat seperti model komersial bergaya buatan, bukan aktivitas rumah tangga yang wajar.');
  } else if (input.observed.activity_authenticity === 'NATURAL_HOME_ROUTINE') {
    notes.push('Gestur dan aktivitas menyatu alami dengan ruang hunian.');
  }

  // 4. Check anatomical plausibility (Rule 5)
  if (input.observed.anatomical_quality === 'AI_DEFORMITY_DETECTED') {
    score -= 30;
    rejection_reasons.push('Terdeteksi deformasi anatomi AI pada figur manusia (misal: jari ganda atau proporsi janggal).');
  }

  // 5. Check series consistency if applicable (Rule 7)
  if (input.observed.series_model_consistency === 'DRIFT_DETECTED') {
    score -= 25;
    rejection_reasons.push('Terjadi pergeseran identitas model manusia antar-shot dalam Image Series (Rule 7).');
  }

  let verdict: 'PASS' | 'NEEDS_REVIEW' | 'FAIL' = 'PASS';
  if (rejection_reasons.length > 0) {
    verdict = score < 60 ? 'FAIL' : 'NEEDS_REVIEW';
  } else if (score < 80) {
    verdict = 'NEEDS_REVIEW';
  }

  return {
    verdict,
    score: Math.max(0, score),
    notes,
    rejection_reasons,
    evaluation_basis: evaluationBasis
  };
}
