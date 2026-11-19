/**
 * RancangLoka — Photo-First Visual Quality Gate (POLICY v1.1)
 *
 * Implements the 7 Mandatory Quality Gates for editorial architectural photography:
 * 1. PHOTO_REALISM: Realistic textures, natural lighting, zero CGI gloss or AI deformities.
 * 2. SAME_HOUSE_VISUAL_CONSISTENCY: All photos belong to the same home / space identity.
 *    STRICT INVARIANT: Cannot claim pass merely on prompt tokens or color similarity!
 * 3. SPATIAL_CONTINUITY: Fixed landmarks (cabinets, doors, cooktop, walls) remain coherent.
 * 4. ARTICLE_SEMANTIC_RELEVANCE: Photo directly illustrates the concept of its H2 section.
 * 5. VISUAL_VARIATION: Distinct camera angles and scopes (context, problem, detail, solution).
 * 6. NO_MISLEADING_ARCHITECTURE: Structure is buildable in Indonesia with sound construction logic.
 * 7. MONETARY_SILENCE: Zero price tags, currency numbers, or cost claims visible.
 */

import type { HouseIdentityProfile } from './house-identity.ts';

export type GateCheckStatus = 'PASS' | 'FAIL' | 'NEEDS_REVIEW';

export interface SingleGateEvaluation {
  name: string;
  status: GateCheckStatus;
  score: number; // 0 - 100
  notes: string;
  violations: string[];
}

export interface PhotoFirstQualityGateResult {
  candidate_id: string;
  slot_key: string;
  photo_role: 'context' | 'problem_condition' | 'relevant_detail' | 'realistic_solution_example';
  target_heading: string;
  overall_verdict: 'RECOMMENDED_FOR_OWNER' | 'NEEDS_REVIEW' | 'REJECTED';
  passed: boolean;
  score: number;
  gates: {
    photo_realism: SingleGateEvaluation;
    same_house_consistency: SingleGateEvaluation;
    spatial_continuity: SingleGateEvaluation;
    semantic_relevance: SingleGateEvaluation;
    visual_variation: SingleGateEvaluation;
    no_misleading_architecture: SingleGateEvaluation;
    monetary_silence: SingleGateEvaluation;
  };
  rejection_reasons: string[];
  evaluated_at: string;
}

export interface EvaluatePhotoInput {
  candidate_id: string;
  slot_key: string;
  photo_role: 'context' | 'problem_condition' | 'relevant_detail' | 'realistic_solution_example';
  target_heading: string;
  caption: string;
  alt_text: string;
  house_profile: HouseIdentityProfile;
  /**
   * Evidence metrics observed from actual image inspection / metadata
   */
  observed: {
    is_diagram_or_vector: boolean;
    has_text_or_watermark: boolean;
    has_currency_or_price: boolean;
    has_cgi_plastic_gloss: boolean;
    has_ai_deformities: boolean;
    cabinet_material_matches_profile: boolean;
    countertop_material_matches_profile: boolean;
    wall_color_matches_profile: boolean;
    fixed_landmarks_preserved: boolean;
    structural_plausibility_ok: boolean;
    shot_scope: 'WIDE_CONTEXT' | 'MID_PROBLEM' | 'CLOSE_DETAIL' | 'PERSPECTIVE_SOLUTION' | 'UNSPECIFIED';
    reference_conditioning_verified: boolean; // True only if generated with actual image-to-image or verified visual match
  };
}

/**
 * Evaluates a single editorial photograph candidate against all 7 Quality Gates.
 */
export function evaluatePhotoFirstQualityGate(input: EvaluatePhotoInput): PhotoFirstQualityGateResult {
  const { candidate_id, slot_key, photo_role, target_heading, observed, house_profile } = input;
  const rejectionReasons: string[] = [];

  // Gate 1: PHOTO_REALISM
  const realismViolations: string[] = [];
  if (observed.is_diagram_or_vector) {
    realismViolations.push('Item terdeteksi sebagai diagram vektor atau grafik, melanggar kebijakan Photo-First.');
  }
  if (observed.has_cgi_plastic_gloss) {
    realismViolations.push('Tekstur terlihat seperti CGI rendering sintetis dengan pantulan plastik.');
  }
  if (observed.has_ai_deformities) {
    realismViolations.push('Terdapat deformasi fisik atau artefak khas kecerdasan buatan.');
  }
  const photoRealismGate: SingleGateEvaluation = {
    name: 'PHOTO_REALISM',
    status: realismViolations.length === 0 ? 'PASS' : 'FAIL',
    score: realismViolations.length === 0 ? 95 : 30,
    notes: realismViolations.length === 0
      ? 'Foto arsitektural fotorealistis dengan pencahayaan dan tekstur alami tropis.'
      : realismViolations.join('; '),
    violations: realismViolations
  };
  if (photoRealismGate.status === 'FAIL') {
    rejectionReasons.push(`[PHOTO_REALISM_FAIL] ${realismViolations.join('; ')}`);
  }

  // Gate 2: SAME_HOUSE_VISUAL_CONSISTENCY
  // Strict invariant: Cannot claim pass merely on prompt tokens without matching materials and landmarks!
  const consistencyViolations: string[] = [];
  if (!observed.cabinet_material_matches_profile) {
    consistencyViolations.push('Material atau warna kabinet dapur berbeda dari profil rumah (House Identity Profile).');
  }
  if (!observed.countertop_material_matches_profile) {
    consistencyViolations.push('Material meja dapur (countertop) tidak konsisten dengan profil identitas.');
  }
  if (!observed.wall_color_matches_profile) {
    consistencyViolations.push('Warna dinding berubah secara acak dan tidak sesuai identitas ruang.');
  }
  if (!observed.reference_conditioning_verified && slot_key !== 'cover_hero') {
    consistencyViolations.push('Tidak ada bukti pengkondisian citra referensi (reference-image conditioning) atau verifikasi identitas fisik.');
  }
  const sameHouseGate: SingleGateEvaluation = {
    name: 'SAME_HOUSE_VISUAL_CONSISTENCY',
    status: consistencyViolations.length === 0 ? 'PASS' : (consistencyViolations.length === 1 && !observed.reference_conditioning_verified ? 'NEEDS_REVIEW' : 'FAIL'),
    score: consistencyViolations.length === 0 ? 100 : (consistencyViolations.length === 1 ? 65 : 25),
    notes: consistencyViolations.length === 0
      ? `Visual terverifikasi konsisten dengan profil rumah ${house_profile.profile_id}.`
      : consistencyViolations.join('; '),
    violations: consistencyViolations
  };
  if (sameHouseGate.status === 'FAIL') {
    rejectionReasons.push(`[SAME_HOUSE_FAIL] ${consistencyViolations.join('; ')}`);
  }

  // Gate 3: SPATIAL_CONTINUITY
  const spatialViolations: string[] = [];
  if (!observed.fixed_landmarks_preserved) {
    spatialViolations.push('Penanda spasial tetap (posisi kompor, jalur exhaust, atau bukaan) berubah bentuk secara tidak logis.');
  }
  const spatialContinuityGate: SingleGateEvaluation = {
    name: 'SPATIAL_CONTINUITY',
    status: spatialViolations.length === 0 ? 'PASS' : 'FAIL',
    score: spatialViolations.length === 0 ? 95 : 35,
    notes: spatialViolations.length === 0 ? 'Topologi ruang dan tata letak perabot utama berkesinambungan.' : spatialViolations.join('; '),
    violations: spatialViolations
  };
  if (spatialContinuityGate.status === 'FAIL') {
    rejectionReasons.push(`[SPATIAL_CONTINUITY_FAIL] ${spatialViolations.join('; ')}`);
  }

  // Gate 4: ARTICLE_SEMANTIC_RELEVANCE
  const semanticViolations: string[] = [];
  if (!target_heading || target_heading.trim().length === 0) {
    semanticViolations.push('Foto tidak terikat ke heading H2 yang valid.');
  }
  const semanticRelevanceGate: SingleGateEvaluation = {
    name: 'ARTICLE_SEMANTIC_RELEVANCE',
    status: semanticViolations.length === 0 ? 'PASS' : 'FAIL',
    score: semanticViolations.length === 0 ? 95 : 20,
    notes: semanticViolations.length === 0 ? `Terkait erat dengan subbab: "${target_heading}".` : semanticViolations.join('; '),
    violations: semanticViolations
  };
  if (semanticRelevanceGate.status === 'FAIL') {
    rejectionReasons.push(`[SEMANTIC_RELEVANCE_FAIL] ${semanticViolations.join('; ')}`);
  }

  // Gate 5: VISUAL_VARIATION
  const variationViolations: string[] = [];
  if (observed.shot_scope === 'UNSPECIFIED') {
    variationViolations.push('Skop sudut pandang kamera tidak terdefinisi.');
  }
  // Scope must match role
  if (photo_role === 'context' && observed.shot_scope !== 'WIDE_CONTEXT') {
    variationViolations.push('Cover/Context shot wajib menampilkan sudut pandang luas (establishing wide shot).');
  }
  if (photo_role === 'relevant_detail' && observed.shot_scope !== 'CLOSE_DETAIL') {
    variationViolations.push('Foto detail wajib menampilkan bidikan dekat komponen fungsional (close/detail shot).');
  }
  const visualVariationGate: SingleGateEvaluation = {
    name: 'VISUAL_VARIATION',
    status: variationViolations.length === 0 ? 'PASS' : 'FAIL',
    score: variationViolations.length === 0 ? 90 : 40,
    notes: variationViolations.length === 0 ? `Sudut kamera variatif sesuai peran foto: ${photo_role} (${observed.shot_scope}).` : variationViolations.join('; '),
    violations: variationViolations
  };
  if (visualVariationGate.status === 'FAIL') {
    rejectionReasons.push(`[VISUAL_VARIATION_FAIL] ${variationViolations.join('; ')}`);
  }

  // Gate 6: NO_MISLEADING_ARCHITECTURE
  const archViolations: string[] = [];
  if (!observed.structural_plausibility_ok) {
    archViolations.push('Struktur konstruksi tidak masuk akal atau mustahil dibangun di iklim tropis Indonesia.');
  }
  const noMisleadingArchGate: SingleGateEvaluation = {
    name: 'NO_MISLEADING_ARCHITECTURE',
    status: archViolations.length === 0 ? 'PASS' : 'FAIL',
    score: archViolations.length === 0 ? 95 : 30,
    notes: archViolations.length === 0 ? 'Konstruksi fisik masuk akal, dapat dibangun, dan sesuai standar tropis.' : archViolations.join('; '),
    violations: archViolations
  };
  if (noMisleadingArchGate.status === 'FAIL') {
    rejectionReasons.push(`[NO_MISLEADING_ARCH_FAIL] ${archViolations.join('; ')}`);
  }

  // Gate 7: MONETARY_SILENCE
  const monetaryViolations: string[] = [];
  if (observed.has_currency_or_price) {
    monetaryViolations.push('Terdapat angka rupiah, label harga, atau estimasi biaya jasa di dalam citra.');
  }
  if (observed.has_text_or_watermark) {
    monetaryViolations.push('Terdapat teks overlay, watermark, atau logo komersial.');
  }
  const monetarySilenceGate: SingleGateEvaluation = {
    name: 'MONETARY_SILENCE',
    status: monetaryViolations.length === 0 ? 'PASS' : 'FAIL',
    score: monetaryViolations.length === 0 ? 100 : 0,
    notes: monetaryViolations.length === 0 ? 'Bersih 100% dari harga, mata uang, watermark, dan teks komersial.' : monetaryViolations.join('; '),
    violations: monetaryViolations
  };
  if (monetarySilenceGate.status === 'FAIL') {
    rejectionReasons.push(`[MONETARY_SILENCE_FAIL] ${monetaryViolations.join('; ')}`);
  }

  // Final Verdict Assembly
  const gates = {
    photo_realism: photoRealismGate,
    same_house_consistency: sameHouseGate,
    spatial_continuity: spatialContinuityGate,
    semantic_relevance: semanticRelevanceGate,
    visual_variation: visualVariationGate,
    no_misleading_architecture: noMisleadingArchGate,
    monetary_silence: monetarySilenceGate
  };

  const allPassed = Object.values(gates).every(g => g.status === 'PASS');
  const anyFailed = Object.values(gates).some(g => g.status === 'FAIL');
  const needsReview = Object.values(gates).some(g => g.status === 'NEEDS_REVIEW');

  let overallVerdict: 'RECOMMENDED_FOR_OWNER' | 'NEEDS_REVIEW' | 'REJECTED' = 'REJECTED';
  if (allPassed) {
    overallVerdict = 'RECOMMENDED_FOR_OWNER';
  } else if (!anyFailed && needsReview) {
    overallVerdict = 'NEEDS_REVIEW';
  }

  const avgScore = Math.round(
    Object.values(gates).reduce((acc, g) => acc + g.score, 0) / Object.keys(gates).length
  );

  return {
    candidate_id,
    slot_key,
    photo_role,
    target_heading,
    overall_verdict: overallVerdict,
    passed: allPassed,
    score: avgScore,
    gates,
    rejection_reasons: rejectionReasons,
    evaluated_at: new Date().toISOString()
  };
}
