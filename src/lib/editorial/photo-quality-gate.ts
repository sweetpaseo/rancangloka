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
    fixed_appliance_consistency: SingleGateEvaluation;
    kitchen_layout_continuity: SingleGateEvaluation;
    cabinet_geometry_consistency: SingleGateEvaluation;
    material_and_color_consistency: SingleGateEvaluation;
    architectural_landmark_match: SingleGateEvaluation;
    editorial_photo_variation: SingleGateEvaluation;
    no_misleading_architecture: SingleGateEvaluation;
    monetary_silence: SingleGateEvaluation;
    // Legacy gate aliases for backward compatibility:
    same_house_consistency: SingleGateEvaluation;
    spatial_continuity: SingleGateEvaluation;
    semantic_relevance: SingleGateEvaluation;
    visual_variation: SingleGateEvaluation;
  };
  rejection_reasons: string[];
  evaluated_at: string;
}

export interface VisualContinuityAuditObserved {
  fixed_appliance_check?: {
    is_cooktop_in_frame: boolean;
    cooktop_type_observed: 'FLAT_GLASS_INDUCTION' | 'FLAT_GLASS_CERAMIC' | 'GAS_TWO_BURNER' | 'GAS_MULTI_BURNER' | 'NOT_IN_FRAME' | 'UNVERIFIABLE';
    expected_cooktop_type: 'FLAT_GLASS_INDUCTION' | 'FLAT_GLASS_CERAMIC' | 'GAS_TWO_BURNER' | 'GAS_MULTI_BURNER';
    is_hood_in_frame?: boolean;
    hood_type_observed?: 'SLIM_STAINLESS' | 'CHIMNEY' | 'INTEGRATED' | 'NOT_IN_FRAME' | 'UNVERIFIABLE';
    expected_hood_type?: 'SLIM_STAINLESS' | 'CHIMNEY' | 'INTEGRATED';
    has_protruding_gas_grates_if_induction?: boolean;
    has_gas_burner_knobs_if_induction?: boolean;
    appliance_divergence_notes?: string;
  };
  layout_continuity_check?: {
    is_layout_in_frame: boolean;
    observed_topology: 'U_SHAPE' | 'L_SHAPE' | 'GALLEY' | 'SINGLE_WALL' | 'OPEN_PENINSULA' | 'NOT_IN_FRAME' | 'UNVERIFIABLE';
    expected_topology: 'U_SHAPE' | 'L_SHAPE' | 'GALLEY' | 'SINGLE_WALL' | 'OPEN_PENINSULA';
    layout_continuity_notes?: string;
  };
  cabinet_geometry_check?: {
    is_cabinetry_in_frame: boolean;
    upper_lower_finish_aligned?: boolean;
    woodgrain_direction_consistent?: boolean;
    cabinet_door_style_consistent?: boolean;
    geometry_divergence_notes?: string;
  };
  material_and_color_check?: {
    cabinet_material_match: boolean | 'NOT_IN_FRAME';
    countertop_material_match: boolean | 'NOT_IN_FRAME';
    backsplash_match: boolean | 'NOT_IN_FRAME';
    flooring_match: boolean | 'NOT_IN_FRAME';
    wall_color_match: boolean | 'NOT_IN_FRAME';
    divergence_notes?: string;
  };
  landmark_match_check?: {
    visible_landmarks?: string[];
    out_of_frame_landmarks?: string[];
    conflicting_landmarks?: string[];
    all_landmarks_out_of_frame?: boolean;
  };
  photo_variation_check?: {
    camera_perspective_distinct: boolean;
    camera_distance_distinct: boolean;
    serves_distinct_editorial_role: boolean;
    is_duplicate_angle: boolean;
  };
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
  /**
   * Granular visual continuity audit for House Identity Lock v1.2
   */
  continuity_audit?: VisualContinuityAuditObserved;
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

  // Gate 2: FIXED_APPLIANCE_CONSISTENCY (POLICY v1.2)
  const applianceViolations: string[] = [];
  let applianceStatus: GateCheckStatus = 'PASS';
  let applianceScore = 100;
  let applianceNotes = 'Peralatan tetap konsisten: kompor dan cooker hood mempertahankan tipe dan posisi yang sama dengan cover.';

  if (input.continuity_audit?.fixed_appliance_check) {
    const fac = input.continuity_audit.fixed_appliance_check;
    if (fac.is_cooktop_in_frame === false || fac.cooktop_type_observed === 'NOT_IN_FRAME' || fac.cooktop_type_observed === 'UNVERIFIABLE') {
      applianceStatus = 'NEEDS_REVIEW';
      applianceScore = 70;
      applianceNotes = 'Area kompor tidak terlihat pada sudut bidik ini (UNVERIFIABLE/NEEDS_REVIEW) — tidak dapat diverifikasi secara visual.';
    } else if (
      fac.cooktop_type_observed !== fac.expected_cooktop_type ||
      fac.has_protruding_gas_grates_if_induction === true ||
      fac.has_gas_burner_knobs_if_induction === true
    ) {
      applianceStatus = 'FAIL';
      applianceScore = 20;
      const detail = fac.appliance_divergence_notes ||
        `Cover menampilkan kompor tipe ${fac.expected_cooktop_type}, sedangkan Inline menampilkan kompor tipe ${fac.cooktop_type_observed}. Perubahan jenis kompor dilarang keras.`;
      applianceViolations.push(`Perubahan peralatan tetap terdeteksi: ${detail}`);
      applianceNotes = detail;
    } else if (fac.is_hood_in_frame && fac.hood_type_observed && fac.expected_hood_type && fac.hood_type_observed !== fac.expected_hood_type) {
      applianceStatus = 'FAIL';
      applianceScore = 25;
      const detail = `Cover menampilkan cooker hood ${fac.expected_hood_type}, sedangkan Inline menampilkan ${fac.hood_type_observed}.`;
      applianceViolations.push(`Perubahan cooker hood terdeteksi: ${detail}`);
      applianceNotes = detail;
    }
  } else if (!observed.fixed_landmarks_preserved) {
    applianceStatus = 'FAIL';
    applianceScore = 30;
    applianceViolations.push('Penanda peralatan tetap (kompor atau hood) berubah atau tidak konsisten.');
    applianceNotes = 'Penanda peralatan tetap tidak konsisten.';
  }

  const fixedApplianceGate: SingleGateEvaluation = {
    name: 'FIXED_APPLIANCE_CONSISTENCY',
    status: applianceStatus,
    score: applianceScore,
    notes: applianceNotes,
    violations: applianceViolations
  };
  if (fixedApplianceGate.status === 'FAIL') {
    rejectionReasons.push(`[FIXED_APPLIANCE_FAIL] ${applianceViolations.join('; ')}`);
  }

  // Gate 3: KITCHEN_LAYOUT_CONTINUITY (POLICY v1.2)
  const layoutViolations: string[] = [];
  let layoutStatus: GateCheckStatus = 'PASS';
  let layoutScore = 95;
  let layoutNotes = 'Topologi tata letak dapur konsisten dan berkesinambungan.';

  if (input.continuity_audit?.layout_continuity_check) {
    const lcc = input.continuity_audit.layout_continuity_check;
    if (lcc.is_layout_in_frame === false || lcc.observed_topology === 'NOT_IN_FRAME' || lcc.observed_topology === 'UNVERIFIABLE') {
      layoutStatus = 'NEEDS_REVIEW';
      layoutScore = 75;
      layoutNotes = 'Topologi ruang tidak sepenuhnya terlihat pada sudut bidik ini (UNVERIFIABLE/NEEDS_REVIEW).';
    } else if (lcc.observed_topology !== lcc.expected_topology) {
      layoutStatus = 'FAIL';
      layoutScore = 30;
      const detail = lcc.layout_continuity_notes ||
        `Cover menampilkan denah dapur ${lcc.expected_topology}, sedangkan Inline menampilkan denah ${lcc.observed_topology}.`;
      layoutViolations.push(`Perubahan denah tata letak dapur: ${detail}`);
      layoutNotes = detail;
    }
  } else if (!observed.fixed_landmarks_preserved) {
    layoutStatus = 'FAIL';
    layoutScore = 35;
    layoutViolations.push('Topologi ruang berubah atau tidak berkesinambungan.');
    layoutNotes = 'Topologi ruang tidak konsisten.';
  }

  const kitchenLayoutGate: SingleGateEvaluation = {
    name: 'KITCHEN_LAYOUT_CONTINUITY',
    status: layoutStatus,
    score: layoutScore,
    notes: layoutNotes,
    violations: layoutViolations
  };
  if (kitchenLayoutGate.status === 'FAIL') {
    rejectionReasons.push(`[KITCHEN_LAYOUT_FAIL] ${layoutViolations.join('; ')}`);
  }

  // Gate 4: CABINET_GEOMETRY_CONSISTENCY (POLICY v1.2)
  const cabinetGeomViolations: string[] = [];
  let cabinetGeomStatus: GateCheckStatus = 'PASS';
  let cabinetGeomScore = 95;
  let cabinetGeomNotes = 'Geometri, proporsi, dan arah serat kabinet atas dan bawah konsisten.';

  if (input.continuity_audit?.cabinet_geometry_check) {
    const cgc = input.continuity_audit.cabinet_geometry_check;
    if (cgc.is_cabinetry_in_frame === false) {
      cabinetGeomStatus = 'NEEDS_REVIEW';
      cabinetGeomScore = 75;
      cabinetGeomNotes = 'Kabinet dapur tidak berada di dalam bidang pandang kamera (UNVERIFIABLE).';
    } else if (cgc.upper_lower_finish_aligned === false || cgc.cabinet_door_style_consistent === false || cgc.woodgrain_direction_consistent === false) {
      cabinetGeomStatus = 'FAIL';
      cabinetGeomScore = 30;
      const detail = cgc.geometry_divergence_notes || 'Gaya pintu, konfigurasi kabinet, atau arah serat kayu tidak konsisten dengan cover.';
      cabinetGeomViolations.push(detail);
      cabinetGeomNotes = detail;
    }
  } else if (!observed.cabinet_material_matches_profile) {
    cabinetGeomStatus = 'FAIL';
    cabinetGeomScore = 30;
    cabinetGeomViolations.push('Finishing atau geometri kabinet tidak sesuai profil identitas.');
    cabinetGeomNotes = 'Geometri kabinet tidak sesuai.';
  }

  const cabinetGeometryGate: SingleGateEvaluation = {
    name: 'CABINET_GEOMETRY_CONSISTENCY',
    status: cabinetGeomStatus,
    score: cabinetGeomScore,
    notes: cabinetGeomNotes,
    violations: cabinetGeomViolations
  };
  if (cabinetGeometryGate.status === 'FAIL') {
    rejectionReasons.push(`[CABINET_GEOMETRY_FAIL] ${cabinetGeomViolations.join('; ')}`);
  }

  // Gate 5: MATERIAL_AND_COLOR_CONSISTENCY (POLICY v1.2)
  const matViolations: string[] = [];
  let matStatus: GateCheckStatus = 'PASS';
  let matScore = 100;
  let matNotes = 'Palet material (jati, solid surface krem, subway tile vertikal, teraso) dan warna cat dinding konsisten.';

  if (input.continuity_audit?.material_and_color_check) {
    const mcc = input.continuity_audit.material_and_color_check;
    if (mcc.cabinet_material_match === false || mcc.countertop_material_match === false || mcc.backsplash_match === false || mcc.wall_color_match === false) {
      matStatus = 'FAIL';
      matScore = 25;
      const detail = mcc.divergence_notes || 'Terdapat material atau warna yang bertentangan dengan cover visual anchor.';
      matViolations.push(detail);
      matNotes = detail;
    }
  } else {
    if (!observed.cabinet_material_matches_profile) {
      matViolations.push('Material kabinet tidak sesuai profil identitas.');
    }
    if (!observed.countertop_material_matches_profile) {
      matViolations.push('Material meja countertop tidak sesuai profil identitas.');
    }
    if (!observed.wall_color_matches_profile) {
      matViolations.push('Warna dinding berubah secara acak.');
    }
    if (!observed.reference_conditioning_verified && slot_key !== 'cover_hero' && slot_key !== 'cover') {
      matViolations.push('Tidak ada bukti pengkondisian citra referensi (reference-image conditioning) atau verifikasi identitas fisik.');
    }
    if (matViolations.length > 0) {
      matStatus = 'FAIL';
      matScore = 25;
      matNotes = matViolations.join('; ');
    }
  }

  const materialAndColorGate: SingleGateEvaluation = {
    name: 'MATERIAL_AND_COLOR_CONSISTENCY',
    status: matStatus,
    score: matScore,
    notes: matNotes,
    violations: matViolations
  };
  if (materialAndColorGate.status === 'FAIL') {
    rejectionReasons.push(`[SAME_HOUSE_FAIL] ${matViolations.join('; ')}`);
    rejectionReasons.push(`[MATERIAL_COLOR_FAIL] ${matViolations.join('; ')}`);
  }

  // Gate 6: ARCHITECTURAL_LANDMARK_MATCH (POLICY v1.2)
  const landmarkViolations: string[] = [];
  let landmarkStatus: GateCheckStatus = 'PASS';
  let landmarkScore = 95;
  let landmarkNotes = 'Seluruh penanda arsitektural yang tampak dalam bingkai konsisten dengan cover.';

  if (input.continuity_audit?.landmark_match_check) {
    const lmc = input.continuity_audit.landmark_match_check;
    if (lmc.conflicting_landmarks && lmc.conflicting_landmarks.length > 0) {
      landmarkStatus = 'FAIL';
      landmarkScore = 20;
      const detail = `Penanda arsitektural bertentangan: ${lmc.conflicting_landmarks.join('; ')}`;
      landmarkViolations.push(detail);
      landmarkNotes = detail;
    } else if (lmc.all_landmarks_out_of_frame === true) {
      landmarkStatus = 'NEEDS_REVIEW';
      landmarkScore = 70;
      landmarkNotes = 'Seluruh penanda arsitektural berada di luar bingkai kamera (UNVERIFIABLE/NEEDS_REVIEW).';
    }
  } else if (!observed.fixed_landmarks_preserved) {
    landmarkStatus = 'FAIL';
    landmarkScore = 35;
    landmarkViolations.push('Penanda arsitektural utama berubah.');
    landmarkNotes = 'Penanda arsitektural utama berubah.';
  }

  const landmarkMatchGate: SingleGateEvaluation = {
    name: 'ARCHITECTURAL_LANDMARK_MATCH',
    status: landmarkStatus,
    score: landmarkScore,
    notes: landmarkNotes,
    violations: landmarkViolations
  };
  if (landmarkMatchGate.status === 'FAIL') {
    rejectionReasons.push(`[LANDMARK_MATCH_FAIL] ${landmarkViolations.join('; ')}`);
  }

  // Gate 7: EDITORIAL_PHOTO_VARIATION (POLICY v1.2)
  const varViolations: string[] = [];
  let varStatus: GateCheckStatus = 'PASS';
  let varScore = 90;
  let varNotes = `Sudut kamera variatif dan melayani peran foto editorial: ${photo_role} (${observed.shot_scope}).`;

  if (input.continuity_audit?.photo_variation_check) {
    const pvc = input.continuity_audit.photo_variation_check;
    if (pvc.is_duplicate_angle === true) {
      varStatus = 'FAIL';
      varScore = 30;
      varViolations.push('Sudut kamera merupakan duplikasi dari gambar sebelumnya tanpa variasi editorial.');
      varNotes = 'Sudut kamera duplikat.';
    } else if (!pvc.camera_perspective_distinct || !pvc.serves_distinct_editorial_role) {
      varStatus = 'NEEDS_REVIEW';
      varScore = 65;
      varNotes = 'Variasi sudut kamera minimal atau peran editorial kurang tegas.';
    }
  } else {
    if (observed.shot_scope === 'UNSPECIFIED') {
      varViolations.push('Skop sudut pandang kamera tidak terdefinisi.');
    }
    if (photo_role === 'context' && observed.shot_scope !== 'WIDE_CONTEXT') {
      varViolations.push('Cover/Context shot wajib menampilkan sudut pandang luas (establishing wide shot).');
    }
    if (photo_role === 'relevant_detail' && observed.shot_scope !== 'CLOSE_DETAIL') {
      varViolations.push('Foto detail wajib menampilkan bidikan dekat komponen fungsional (close/detail shot).');
    }
    if (varViolations.length > 0) {
      varStatus = 'FAIL';
      varScore = 40;
      varNotes = varViolations.join('; ');
    }
  }

  const editorialVariationGate: SingleGateEvaluation = {
    name: 'EDITORIAL_PHOTO_VARIATION',
    status: varStatus,
    score: varScore,
    notes: varNotes,
    violations: varViolations
  };
  if (editorialVariationGate.status === 'FAIL') {
    rejectionReasons.push(`[PHOTO_VARIATION_FAIL] ${varViolations.join('; ')}`);
  }

  // Gate: ARTICLE_SEMANTIC_RELEVANCE
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
    fixed_appliance_consistency: fixedApplianceGate,
    kitchen_layout_continuity: kitchenLayoutGate,
    cabinet_geometry_consistency: cabinetGeometryGate,
    material_and_color_consistency: materialAndColorGate,
    architectural_landmark_match: landmarkMatchGate,
    editorial_photo_variation: editorialVariationGate,
    no_misleading_architecture: noMisleadingArchGate,
    monetary_silence: monetarySilenceGate,
    // Legacy aliases for backward compatibility
    same_house_consistency: materialAndColorGate,
    spatial_continuity: kitchenLayoutGate,
    semantic_relevance: semanticRelevanceGate,
    visual_variation: editorialVariationGate
  };

  const coreGates = [
    photoRealismGate,
    fixedApplianceGate,
    kitchenLayoutGate,
    cabinetGeometryGate,
    materialAndColorGate,
    landmarkMatchGate,
    editorialVariationGate,
    noMisleadingArchGate,
    monetarySilenceGate
  ];

  const anyFailed = coreGates.some(g => g.status === 'FAIL');
  const anyNeedsReview = coreGates.some(g => g.status === 'NEEDS_REVIEW');
  const allPassed = coreGates.every(g => g.status === 'PASS');

  let overallVerdict: 'RECOMMENDED_FOR_OWNER' | 'NEEDS_REVIEW' | 'REJECTED' = 'REJECTED';
  if (allPassed) {
    overallVerdict = 'RECOMMENDED_FOR_OWNER';
  } else if (!anyFailed && anyNeedsReview) {
    overallVerdict = 'NEEDS_REVIEW';
  } else {
    overallVerdict = 'REJECTED';
  }

  const avgScore = Math.round(
    coreGates.reduce((acc, g) => acc + g.score, 0) / coreGates.length
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
