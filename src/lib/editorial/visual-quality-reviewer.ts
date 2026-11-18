/**
 * RancangLoka — Visual Quality Reviewer & Multi-Agent Scorecard (HERMES-VISUAL-EDITORIAL-V1)
 *
 * Implements role-separated evaluation contracts for candidate images:
 * - BUDI: Photorealism, lighting, composition, premium aesthetics, AI artifacts/deformities.
 * - IRWAN: Structural realism, construction logic, load-bearing integrity, ventilation physics.
 * - RINA: Editorial relevance, caption fit, alt-text fidelity, editorial dignity.
 * - JEV: Cost-benefit assessment, multi-angle consistency, retry recommendation.
 *
 * HARD REJECTION INVARIANTS:
 * Any candidate with a critical failure in ANY dimension is immediately REJECTED (PASS = false).
 */

import type { VisualIntentContract } from './nadia-visual-storyboard.ts';

export interface BudiScorecard {
  photorealism_score: number; // 0-100
  lighting_fidelity: 'NATURAL' | 'SYNTHETIC_GLOSSY' | 'HARSH_OVEREXPOSED';
  composition_balance: 'BALANCED' | 'CLUTTERED' | 'AWKWARD_CROP';
  ai_deformities_detected: string[];
  verdict: 'PASS' | 'FAIL';
  notes: string;
}

export interface IrwanScorecard {
  structural_plausibility: 'REALISTIC' | 'QUESTIONABLE' | 'IMPOSSIBLE';
  material_authenticity: 'AUTHENTIC_INDONESIAN' | 'GENERIC_WESTERN' | 'SYNTHETIC_PLASTIC';
  ventilation_physics_correct: boolean;
  load_bearing_logic_respected: boolean;
  hard_construction_flaws: string[];
  verdict: 'PASS' | 'FAIL';
  notes: string;
}

export interface RinaScorecard {
  editorial_relevance_score: number; // 0-100
  educational_value: 'HIGH' | 'MODERATE' | 'PURELY_DECORATIVE';
  caption_match: boolean;
  alt_text_accuracy: boolean;
  editorial_dignity: 'PREMIUM_EDITORIAL' | 'COMMERCIAL_BROCHURE' | 'AI_SLOP';
  verdict: 'PASS' | 'FAIL';
  notes: string;
}

export interface JevSupervision {
  cost_usd: number;
  cost_per_accepted_image_usd?: number;
  quality_vs_cost_ratio: 'EXCELLENT' | 'FAIR' | 'POOR';
  recommendation: 'APPROVE_FOR_OWNER' | 'RETRY_WITH_REVISED_PROMPT' | 'DISCARD_MODEL';
  retry_budget_permitted: boolean;
}

export type RequirementStatus = 'PASS' | 'FAIL' | 'UNCERTAIN';
export type GateVerdict = 'RECOMMENDED_FOR_OWNER' | 'NEEDS_REVIEW' | 'REJECTED';

export interface MandatoryRequirementCheck {
  id: string;
  description: string;
  status: RequirementStatus;
  observed_evidence: string;
  reason: string;
}

export interface StrictVisualQualityGateResult {
  candidate_id: string;
  slot_key: string;
  model: string;
  cost_usd: number;
  mandatory_requirements: {
    status: RequirementStatus;
    checks: MandatoryRequirementCheck[];
  };
  architectural_plausibility: {
    status: RequirementStatus;
    notes: string;
    flaws_detected: string[];
  };
  editorial_explanation_clarity: {
    status: RequirementStatus;
    notes: string;
  };
  aesthetic_quality_score: {
    score: number; // 0-100
    cannot_override_gate: true;
    notes: string;
  };
  final_gate_verdict: GateVerdict;
  hard_rejection_reasons: string[];
  reviewed_at: string;
}

export interface EditorialVisionRubricV2 {
  editorial_relevance_score: number; // 30% weight
  architectural_accuracy_score: number; // 25% weight
  visual_explanation_clarity_score: number; // 20% weight
  photorealism_score: number; // 15% weight
  premium_composition_score: number; // 10% weight
  weighted_total_score: number; // 0-100
  verdict: 'PASS' | 'FAIL';
  breakdown: {
    editorial_relevance_notes: string;
    architectural_accuracy_notes: string;
    explanation_clarity_notes: string;
    photorealism_notes: string;
    composition_notes: string;
  };
  missing_required_evidence: string[];
  hard_fail_triggers: string[];
}

export interface VisualEvaluationResult {
  candidate_id: string;
  slot_key: string;
  model: string;
  overall_verdict: 'PASS' | 'FAIL';
  gate_verdict?: GateVerdict;
  hard_reject_reasons: string[];
  mandatory_check_failures?: string[];
  budi_review: BudiScorecard;
  irwan_review: IrwanScorecard;
  rina_review: RinaScorecard;
  jev_supervision: JevSupervision;
  rubric_v2?: EditorialVisionRubricV2;
  reviewed_at: string;
}

/**
 * Deterministic evaluator for visual candidate quality.
 */
export function evaluateVisualCandidate(input: {
  candidate_id: string;
  slot_key: string;
  model: string;
  cost_usd: number;
  signals: {
    has_impossible_geometry?: boolean;
    has_cgi_plastic_look?: boolean;
    has_broken_structure?: boolean;
    has_closed_skylight_as_ventilation?: boolean;
    has_text_or_watermark?: boolean;
    is_purely_decorative?: boolean;
    contradicts_article?: boolean;
    photorealism_raw?: number;
    relevance_raw?: number;

    // Storyboard Nadia 5 Mandatory Hard Gates
    primary_subject_mismatch?: boolean;
    primary_subject_mismatch_reason?: string;
    spatial_layout_inaccurate?: boolean;
    spatial_layout_inaccurate_reason?: string;
    building_proportions_invalid?: boolean;
    building_proportions_invalid_reason?: string;
    construction_implausible?: boolean;
    construction_implausible_reason?: string;
    contradicts_article_concept?: boolean;
    contradicts_article_concept_reason?: string;
  }
}): VisualEvaluationResult {
  const { candidate_id, slot_key, model, cost_usd, signals } = input;
  const hardRejects: string[] = [];

  // 1. Mandatory Hard Gate: Kesesuaian Objek Utama
  if (signals.primary_subject_mismatch) {
    hardRejects.push(`[MANDATORY_FAIL: OBJEK UTAMA] ${signals.primary_subject_mismatch_reason || 'Objek utama visual tidak sesuai spesifikasi slot'}`);
  }

  // 2. Mandatory Hard Gate: Akurasi Susunan Ruang
  if (signals.spatial_layout_inaccurate) {
    hardRejects.push(`[MANDATORY_FAIL: SUSUNAN RUANG] ${signals.spatial_layout_inaccurate_reason || 'Susunan ruang tidak mencerminkan denah yang benar'}`);
  }

  // 3. Mandatory Hard Gate: Proporsi Bangunan & Kavling
  if (signals.building_proportions_invalid) {
    hardRejects.push(`[MANDATORY_FAIL: PROPORSI BANGUNAN] ${signals.building_proportions_invalid_reason || 'Proporsi bangunan tidak mencerminkan skala kavling 5-6 meter'}`);
  }

  // 4. Mandatory Hard Gate: Kelayakan Konstruksi
  if (signals.construction_implausible) {
    hardRejects.push(`[MANDATORY_FAIL: KELAYAKAN KONSTRUKSI] ${signals.construction_implausible_reason || 'Kaidah struktur atau konstruksi bangunan melanggar logika fisik'}`);
  }

  // 5. Mandatory Hard Gate: Keselarasan Konsep Artikel
  if (signals.contradicts_article_concept) {
    hardRejects.push(`[MANDATORY_FAIL: KONSEP ARTIKEL] ${signals.contradicts_article_concept_reason || 'Elemen visual bertentangan dengan konsep teknis artikel'}`);
  }

  // Budi dimension
  const deformities: string[] = [];
  if (signals.has_impossible_geometry) deformities.push('Impossible spatial geometry');
  if (signals.has_text_or_watermark) deformities.push('Text or watermark artifacts');
  if (signals.has_cgi_plastic_look) deformities.push('Unrealistic glossy CGI plastic finish');

  const photorealism = signals.photorealism_raw ?? (deformities.length > 0 ? 55 : 92);
  const budiVerdict = photorealism >= 80 && deformities.length === 0 ? 'PASS' : 'FAIL';
  if (budiVerdict === 'FAIL') {
    hardRejects.push(...deformities.map(d => `[BUDI] ${d}`));
  }

  const budi_review: BudiScorecard = {
    photorealism_score: photorealism,
    lighting_fidelity: signals.has_cgi_plastic_look ? 'SYNTHETIC_GLOSSY' : 'NATURAL',
    composition_balance: 'BALANCED',
    ai_deformities_detected: deformities,
    verdict: budiVerdict,
    notes: budiVerdict === 'PASS' ? 'Pencahayaan natural dan material tropis meyakinkan.' : 'Terdapat artefak deformitas atau tampilan render CGI artifisial.'
  };

  // Irwan dimension
  const flaws: string[] = [];
  if (signals.has_broken_structure) flaws.push('Elemen struktur runtuh / melayang tanpa tumpuan balok');
  if (signals.has_closed_skylight_as_ventilation) flaws.push('Skylight kaca mati diklaim sebagai ventilasi (efek rumah kaca)');

  const irwanVerdict = flaws.length === 0 ? 'PASS' : 'FAIL';
  if (irwanVerdict === 'FAIL') {
    hardRejects.push(...flaws.map(f => `[IRWAN] ${f}`));
  }

  const irwan_review: IrwanScorecard = {
    structural_plausibility: signals.has_broken_structure ? 'IMPOSSIBLE' : 'REALISTIC',
    material_authenticity: 'AUTHENTIC_INDONESIAN',
    ventilation_physics_correct: !signals.has_closed_skylight_as_ventilation,
    load_bearing_logic_respected: !signals.has_broken_structure,
    hard_construction_flaws: flaws,
    verdict: irwanVerdict,
    notes: irwanVerdict === 'PASS' ? 'Logika konstruksi dinding dan bukaan sesuai standar SNI.' : 'Melanggar kaidah fisika bangunan atau struktur bangunan nyata.'
  };

  // Rina dimension
  const relevance = signals.relevance_raw ?? (signals.contradicts_article ? 40 : 90);
  const isDecorative = Boolean(signals.is_purely_decorative);
  const rinaVerdict = relevance >= 75 && !signals.contradicts_article && !isDecorative ? 'PASS' : 'FAIL';
  if (signals.contradicts_article) hardRejects.push('[RINA] Gambar bertentangan dengan isi naskah artikel');
  if (isDecorative) hardRejects.push('[RINA] Gambar bersifat dekoratif tanpa nilai edukatif');

  const rina_review: RinaScorecard = {
    editorial_relevance_score: relevance,
    educational_value: isDecorative ? 'PURELY_DECORATIVE' : 'HIGH',
    caption_match: !signals.contradicts_article,
    alt_text_accuracy: true,
    editorial_dignity: signals.contradicts_article ? 'AI_SLOP' : 'PREMIUM_EDITORIAL',
    verdict: rinaVerdict,
    notes: rinaVerdict === 'PASS' ? 'Kesesuaian editorial sangat tinggi, memperjelas isi pembahasan.' : 'Gambar gagal mendukung pesan editorial artikel.'
  };

  // Jev supervision: Evaluates cost-effectiveness separately from visual quality
  const overallPass = hardRejects.length === 0 && budiVerdict === 'PASS' && irwanVerdict === 'PASS' && rinaVerdict === 'PASS';
  const jev_supervision: JevSupervision = {
    cost_usd,
    cost_per_accepted_image_usd: overallPass ? cost_usd : undefined,
    // Quality vs cost ratio reflects value delivered:
    // When visual quality passes, high-fidelity models (Seedream Pro $0.0675, Kling $0.0280)
    // achieve EXCELLENT ratio because they produce authentic publishable architecture under $0.10.
    quality_vs_cost_ratio: overallPass && cost_usd <= 0.08 ? 'EXCELLENT' : (cost_usd <= 0.15 ? 'FAIR' : 'POOR'),
    recommendation: overallPass ? 'APPROVE_FOR_OWNER' : 'RETRY_WITH_REVISED_PROMPT',
    retry_budget_permitted: cost_usd <= 0.20
  };

  return {
    candidate_id,
    slot_key,
    model,
    overall_verdict: overallPass ? 'PASS' : 'FAIL',
    gate_verdict: overallPass ? 'RECOMMENDED_FOR_OWNER' : 'REJECTED',
    hard_reject_reasons: hardRejects,
    budi_review,
    irwan_review,
    rina_review,
    jev_supervision,
    reviewed_at: new Date().toISOString()
  };
}

/**
 * Strict Editorial Vision Gate V2 (HERMES-VISUAL-EDITORIAL-V2)
 *
 * Explicit 5-dimensional weighted evaluation:
 * - Editorial relevance: 30%
 * - Architectural accuracy: 25%
 * - Visual explanation clarity: 20%
 * - Photorealism: 15%
 * - Premium composition: 10%
 *
 * HARD FAIL TRIGGERS:
 * - Visual fails main slot idea
 * - Missing required visual evidence per VISUAL_INTENT_CONTRACT
 * - Misleading or impossible architecture
 * - Critical construction flaw
 * - Inline image purely decorative without informational takeaway
 * - Duplicates another slot's visual function
 */
export function evaluateEditorialVisionV2(input: {
  candidate_id: string;
  slot_key: string;
  model: string;
  cost_usd: number;
  contract?: VisualIntentContract;
  scores: {
    editorial_relevance: number; // 0-100
    architectural_accuracy: number; // 0-100
    visual_explanation_clarity: number; // 0-100
    photorealism: number; // 0-100
    premium_composition: number; // 0-100
  };
  notes?: {
    editorial_relevance?: string;
    architectural_accuracy?: string;
    explanation_clarity?: string;
    photorealism?: string;
    composition?: string;
  };
  signals?: {
    // Storyboard Nadia 5 Mandatory Hard Gates:
    primary_subject_mismatch?: boolean;
    primary_subject_mismatch_reason?: string;

    spatial_layout_inaccurate?: boolean;
    spatial_layout_inaccurate_reason?: string;

    building_proportions_invalid?: boolean;
    building_proportions_invalid_reason?: string;

    construction_implausible?: boolean;
    construction_implausible_reason?: string;

    contradicts_article_concept?: boolean;
    contradicts_article_concept_reason?: string;

    // Additional specific signals
    fails_main_idea?: boolean;
    missing_required_evidence?: string[];
    is_misleading_architecture?: boolean;
    has_critical_construction_flaw?: boolean;
    is_purely_decorative?: boolean;
    duplicates_another_slot?: boolean;
    has_cgi_plastic_look?: boolean;
    has_text_or_watermark?: boolean;
    has_broken_structure?: boolean;
    has_closed_skylight_as_ventilation?: boolean;
  };
}): VisualEvaluationResult {
  const { candidate_id, slot_key, model, cost_usd, contract, scores, notes, signals } = input;
  const hardFailTriggers: string[] = [];
  const missingEvidence: string[] = [];
  const mandatoryFailures: string[] = [];

  // =========================================================================
  // NADIA STORYBOARD 5 MANDATORY HARD GATES
  // If ANY of these 5 gates fail, the candidate is strictly REJECTED.
  // Aesthetic or photorealism score (even 95+) CANNOT override these failures.
  // =========================================================================

  // 1. Kesesuaian Objek Utama (Primary Subject Fidelity)
  if (signals?.primary_subject_mismatch || signals?.fails_main_idea) {
    const reason = `[MANDATORY_GATE_FAIL: OBJEK UTAMA] ${signals?.primary_subject_mismatch_reason || 'Objek utama visual tidak sesuai spesifikasi slot storyboard'}`;
    hardFailTriggers.push(reason);
    mandatoryFailures.push(reason);
  }

  // 2. Akurasi Susunan Ruang (Spatial Layout Accuracy)
  if (signals?.spatial_layout_inaccurate) {
    const reason = `[MANDATORY_GATE_FAIL: SUSUNAN RUANG] ${signals?.spatial_layout_inaccurate_reason || 'Susunan ruang dan zoning tidak mencerminkan denah yang benar'}`;
    hardFailTriggers.push(reason);
    mandatoryFailures.push(reason);
  }

  // 3. Proporsi Bangunan & Kavling (Building & Lot Proportions)
  if (signals?.building_proportions_invalid) {
    const reason = `[MANDATORY_GATE_FAIL: PROPORSI BANGUNAN] ${signals?.building_proportions_invalid_reason || 'Proporsi bangunan tidak mencerminkan skala kavling atau ruang yang disyaratkan'}`;
    hardFailTriggers.push(reason);
    mandatoryFailures.push(reason);
  }

  // 4. Kelayakan Konstruksi (Constructability & Structural Plausibility)
  if (
    signals?.construction_implausible ||
    signals?.is_misleading_architecture ||
    signals?.has_broken_structure ||
    signals?.has_critical_construction_flaw ||
    signals?.has_closed_skylight_as_ventilation
  ) {
    const reason = `[MANDATORY_GATE_FAIL: KELAYAKAN KONSTRUKSI] ${
      signals?.construction_implausible_reason ||
      (signals?.has_closed_skylight_as_ventilation
        ? 'Detail konstruksi penting salah / skylight tertutup diklaim ventilasi'
        : signals?.is_misleading_architecture
        ? 'Arsitektur menyesatkan atau tidak masuk akal secara fisik'
        : 'Detail konstruksi atau pembebanan struktur melanggar logika fisik bangunan')
    }`;
    hardFailTriggers.push(reason);
    mandatoryFailures.push(reason);
  }

  // 5. Keselarasan Konsep Artikel (No Contradiction with Article Concept)
  if (signals?.contradicts_article_concept) {
    const reason = `[MANDATORY_GATE_FAIL: KONSEP ARTIKEL] ${signals?.contradicts_article_concept_reason || 'Terdapat elemen visual yang bertentangan dengan pesan dan solusi teknis artikel'}`;
    hardFailTriggers.push(reason);
    mandatoryFailures.push(reason);
  }

  // Supporting signals
  if (signals?.missing_required_evidence && signals.missing_required_evidence.length > 0) {
    missingEvidence.push(...signals.missing_required_evidence);
    hardFailTriggers.push(
      `[HARD_FAIL] Tidak menampilkan fitur penting sesuai VISUAL_INTENT_CONTRACT: ${signals.missing_required_evidence.join(', ')}`
    );
  }
  if (signals?.is_purely_decorative) {
    hardFailTriggers.push('[HARD_FAIL] Foto inline hanya dekoratif tanpa informasi edukatif');
  }
  if (signals?.duplicates_another_slot) {
    hardFailTriggers.push('[HARD_FAIL] Gambar mengulangi fungsi visual slot lain');
  }
  if (signals?.has_text_or_watermark) {
    hardFailTriggers.push('[HARD_FAIL] Terdapat artefak teks, watermark, atau logo');
  }

  // Calculate weighted total
  const rel = Math.max(0, Math.min(100, scores.editorial_relevance));
  const arch = Math.max(0, Math.min(100, scores.architectural_accuracy));
  const clar = Math.max(0, Math.min(100, scores.visual_explanation_clarity));
  const photo = Math.max(0, Math.min(100, scores.photorealism));
  const comp = Math.max(0, Math.min(100, scores.premium_composition));

  const weightedTotal = Math.round(
    rel * 0.30 +
    arch * 0.25 +
    clar * 0.20 +
    photo * 0.15 +
    comp * 0.10
  );

  // INVARIANT: If ANY mandatory gate or hard fail trigger is present,
  // the candidate is strictly FAIL / REJECTED, regardless of high photorealism (even 95+).
  const hasHardFail = hardFailTriggers.length > 0;
  const verdict = !hasHardFail && weightedTotal >= 75 ? 'PASS' : 'FAIL';
  const gateVerdict: GateVerdict = hasHardFail
    ? 'REJECTED'
    : (verdict === 'PASS' ? 'RECOMMENDED_FOR_OWNER' : 'NEEDS_REVIEW');

  const rubric_v2: EditorialVisionRubricV2 = {
    editorial_relevance_score: rel,
    architectural_accuracy_score: arch,
    visual_explanation_clarity_score: clar,
    photorealism_score: photo,
    premium_composition_score: comp,
    weighted_total_score: weightedTotal,
    verdict,
    breakdown: {
      editorial_relevance_notes: notes?.editorial_relevance || (rel >= 80 ? 'Sangat relevan dengan pesan editorial artikel.' : 'Kesesuaian editorial masih perlu ditingkatkan.'),
      architectural_accuracy_notes: notes?.architectural_accuracy || (arch >= 80 ? 'Konstruksi dan proporsi masuk akal sesuai fisik hunian tropis.' : 'Terdapat kekeliruan arsitektural.'),
      explanation_clarity_notes: notes?.explanation_clarity || (clar >= 80 ? 'Berhasil menjelaskan konsep teknis tanpa membingungkan pembaca.' : 'Kurang jelas dalam menyampaikan fungsi teknis.'),
      photorealism_notes: notes?.photorealism || (photo >= 80 ? 'Material dan pencahayaan alami tanpa kesan CGI glossy.' : 'Terlihat seperti render 3D artifisial.'),
      composition_notes: notes?.composition || (comp >= 80 ? 'Komposisi seimbang, kedalaman ruang terasa alami.' : 'Komposisi canggung atau terdistorsi.')
    },
    missing_required_evidence: missingEvidence,
    hard_fail_triggers: hardFailTriggers
  };

  // Legacy scorecards for backward compatibility
  const budi_review: BudiScorecard = {
    photorealism_score: photo,
    lighting_fidelity: signals?.has_cgi_plastic_look ? 'SYNTHETIC_GLOSSY' : 'NATURAL',
    composition_balance: comp >= 75 ? 'BALANCED' : 'AWKWARD_CROP',
    ai_deformities_detected: signals?.has_text_or_watermark ? ['Text/Watermark'] : [],
    verdict: photo >= 75 && !signals?.has_text_or_watermark ? 'PASS' : 'FAIL',
    notes: rubric_v2.breakdown.photorealism_notes
  };

  const irwan_review: IrwanScorecard = {
    structural_plausibility: arch >= 75 && !signals?.is_misleading_architecture ? 'REALISTIC' : 'IMPOSSIBLE',
    material_authenticity: 'AUTHENTIC_INDONESIAN',
    ventilation_physics_correct: !signals?.has_closed_skylight_as_ventilation,
    load_bearing_logic_respected: !signals?.has_broken_structure,
    hard_construction_flaws: signals?.has_critical_construction_flaw ? ['Critical flaw'] : [],
    verdict: arch >= 75 && hardFailTriggers.filter(t => t.includes('Arsitektur') || t.includes('konstruksi')).length === 0 ? 'PASS' : 'FAIL',
    notes: rubric_v2.breakdown.architectural_accuracy_notes
  };

  const rina_review: RinaScorecard = {
    editorial_relevance_score: rel,
    educational_value: signals?.is_purely_decorative ? 'PURELY_DECORATIVE' : 'HIGH',
    caption_match: true,
    alt_text_accuracy: true,
    editorial_dignity: 'PREMIUM_EDITORIAL',
    verdict: rel >= 75 && !signals?.is_purely_decorative && !signals?.fails_main_idea ? 'PASS' : 'FAIL',
    notes: rubric_v2.breakdown.editorial_relevance_notes
  };

  const jev_supervision: JevSupervision = {
    cost_usd,
    cost_per_accepted_image_usd: verdict === 'PASS' ? cost_usd : undefined,
    // Quality vs cost ratio reflects value delivered:
    // Seedream Pro ($0.0675) and Kling ($0.0280) achieve EXCELLENT ratio when verdict is PASS
    quality_vs_cost_ratio: verdict === 'PASS' && cost_usd <= 0.08 ? 'EXCELLENT' : (cost_usd <= 0.15 ? 'FAIR' : 'POOR'),
    recommendation: verdict === 'PASS' ? 'APPROVE_FOR_OWNER' : 'RETRY_WITH_REVISED_PROMPT',
    retry_budget_permitted: cost_usd <= 0.20
  };

  return {
    candidate_id,
    slot_key,
    model,
    overall_verdict: verdict,
    gate_verdict: gateVerdict,
    hard_reject_reasons: hardFailTriggers,
    mandatory_check_failures: mandatoryFailures,
    budi_review,
    irwan_review,
    rina_review,
    jev_supervision,
    rubric_v2,
    reviewed_at: new Date().toISOString()
  };
}

/**
 * Strict Visual Evidence Gate V2.2 (HERMES-VISUAL-QUALITY-GATE-CORRECTION-V2.2)
 *
 * Enforces strict separation between:
 * A. Mandatory Visual Requirements (PASS / FAIL / UNCERTAIN)
 * B. Architectural Plausibility (PASS / FAIL / UNCERTAIN)
 * C. Editorial Explanation Clarity (PASS / FAIL / UNCERTAIN)
 * D. Aesthetic Quality Score (0-100) — STRICTLY CANNOT OVERRIDE GATE FAILURES
 *
 * An image with 95+ aesthetic quality MUST BE REJECTED if it violates spatial
 * relationships (e.g. dining table on outdoor gravel) or structural intent (e.g. rooftop patio instead of interior lightwell).
 */
export function evaluateStrictVisualEvidenceGate(input: {
  candidate_id: string;
  slot_key: string;
  model: string;
  cost_usd: number;
  mandatory_checks: MandatoryRequirementCheck[];
  architectural_plausibility: {
    status: RequirementStatus;
    notes: string;
    flaws_detected?: string[];
  };
  editorial_explanation_clarity: {
    status: RequirementStatus;
    notes: string;
  };
  aesthetic_quality_score: {
    score: number;
    notes: string;
  };
}): StrictVisualQualityGateResult {
  const {
    candidate_id,
    slot_key,
    model,
    cost_usd,
    mandatory_checks,
    architectural_plausibility,
    editorial_explanation_clarity,
    aesthetic_quality_score
  } = input;

  const hardRejectionReasons: string[] = [];

  // Check mandatory requirements
  const failedChecks = mandatory_checks.filter(c => c.status === 'FAIL');
  const uncertainChecks = mandatory_checks.filter(c => c.status === 'UNCERTAIN');

  for (const c of failedChecks) {
    hardRejectionReasons.push(`[MANDATORY_FAIL] ${c.description}: ${c.reason} (Observed: ${c.observed_evidence})`);
  }
  for (const c of uncertainChecks) {
    hardRejectionReasons.push(`[UNCERTAIN_EVIDENCE] ${c.description}: ${c.reason} (Observed: ${c.observed_evidence})`);
  }

  // Check architectural plausibility
  if (architectural_plausibility.status === 'FAIL') {
    hardRejectionReasons.push(`[ARCH_PLAUSIBILITY_FAIL] ${architectural_plausibility.notes}`);
  } else if (architectural_plausibility.status === 'UNCERTAIN') {
    hardRejectionReasons.push(`[ARCH_PLAUSIBILITY_UNCERTAIN] ${architectural_plausibility.notes}`);
  }

  // Check editorial explanation clarity
  if (editorial_explanation_clarity.status === 'FAIL') {
    hardRejectionReasons.push(`[EDITORIAL_CLARITY_FAIL] ${editorial_explanation_clarity.notes}`);
  } else if (editorial_explanation_clarity.status === 'UNCERTAIN') {
    hardRejectionReasons.push(`[EDITORIAL_CLARITY_UNCERTAIN] ${editorial_explanation_clarity.notes}`);
  }

  // Determine overall gate verdict
  let finalVerdict: GateVerdict;
  let overallMandatoryStatus: RequirementStatus = 'PASS';

  if (failedChecks.length > 0 || architectural_plausibility.status === 'FAIL' || editorial_explanation_clarity.status === 'FAIL') {
    finalVerdict = 'REJECTED';
    overallMandatoryStatus = 'FAIL';
  } else if (uncertainChecks.length > 0 || architectural_plausibility.status === 'UNCERTAIN' || editorial_explanation_clarity.status === 'UNCERTAIN') {
    finalVerdict = 'NEEDS_REVIEW';
    overallMandatoryStatus = 'UNCERTAIN';
  } else {
    // Only if all mandatory requirements, architectural plausibility, and editorial clarity pass
    if (aesthetic_quality_score.score >= 75) {
      finalVerdict = 'RECOMMENDED_FOR_OWNER';
      overallMandatoryStatus = 'PASS';
    } else {
      finalVerdict = 'REJECTED';
      overallMandatoryStatus = 'FAIL';
      hardRejectionReasons.push('[AESTHETIC_FAIL] Aesthetic quality score below 75 threshold.');
    }
  }

  return {
    candidate_id,
    slot_key,
    model,
    cost_usd,
    mandatory_requirements: {
      status: overallMandatoryStatus,
      checks: mandatory_checks
    },
    architectural_plausibility: {
      status: architectural_plausibility.status,
      notes: architectural_plausibility.notes,
      flaws_detected: architectural_plausibility.flaws_detected || []
    },
    editorial_explanation_clarity: {
      status: editorial_explanation_clarity.status,
      notes: editorial_explanation_clarity.notes
    },
    aesthetic_quality_score: {
      score: aesthetic_quality_score.score,
      cannot_override_gate: true,
      notes: aesthetic_quality_score.notes
    },
    final_gate_verdict: finalVerdict,
    hard_rejection_reasons: hardRejectionReasons,
    reviewed_at: new Date().toISOString()
  };
}

/**
 * Evaluates candidate against Nadia's Storyboard 5 Mandatory Hard Gates:
 * 1. Primary Subject Fidelity (Kesesuaian Objek Utama)
 * 2. Spatial Layout Accuracy (Akurasi Susunan Ruang)
 * 3. Building & Lot Proportions (Proporsi Bangunan & Kavling)
 * 4. Constructability & Load Logic (Kelayakan Konstruksi)
 * 5. Concept Fidelity (Tidak ada elemen visual yang bertentangan dengan konsep artikel)
 *
 * Invariant: If ANY of these 5 gates fail, the candidate is strictly REJECTED,
 * regardless of high aesthetic or photorealism score (even 95+).
 */
export function evaluateCandidateWithNadiaMandatoryGates(input: {
  candidate_id: string;
  slot_key: string;
  model: string;
  cost_usd: number;
  contract?: VisualIntentContract;
  evidence: {
    primary_subject_observed: string;
    primary_subject_status: 'PASS' | 'FAIL';
    primary_subject_fail_reason?: string;

    spatial_layout_observed: string;
    spatial_layout_status: 'PASS' | 'FAIL';
    spatial_layout_fail_reason?: string;

    building_proportions_observed: string;
    building_proportions_status: 'PASS' | 'FAIL';
    building_proportions_fail_reason?: string;

    construction_logic_observed: string;
    construction_logic_status: 'PASS' | 'FAIL';
    construction_logic_fail_reason?: string;

    concept_alignment_observed: string;
    concept_alignment_status: 'PASS' | 'FAIL';
    concept_alignment_fail_reason?: string;
  };
  scores: {
    editorial_relevance: number;
    architectural_accuracy: number;
    visual_explanation_clarity: number;
    photorealism: number;
    premium_composition: number;
  };
}): VisualEvaluationResult {
  const { candidate_id, slot_key, model, cost_usd, contract, evidence, scores } = input;

  return evaluateEditorialVisionV2({
    candidate_id,
    slot_key,
    model,
    cost_usd,
    contract,
    scores,
    signals: {
      primary_subject_mismatch: evidence.primary_subject_status === 'FAIL',
      primary_subject_mismatch_reason: evidence.primary_subject_fail_reason || evidence.primary_subject_observed,

      spatial_layout_inaccurate: evidence.spatial_layout_status === 'FAIL',
      spatial_layout_inaccurate_reason: evidence.spatial_layout_fail_reason || evidence.spatial_layout_observed,

      building_proportions_invalid: evidence.building_proportions_status === 'FAIL',
      building_proportions_invalid_reason: evidence.building_proportions_fail_reason || evidence.building_proportions_observed,

      construction_implausible: evidence.construction_logic_status === 'FAIL',
      construction_implausible_reason: evidence.construction_logic_fail_reason || evidence.construction_logic_observed,

      contradicts_article_concept: evidence.concept_alignment_status === 'FAIL',
      contradicts_article_concept_reason: evidence.concept_alignment_fail_reason || evidence.concept_alignment_observed
    }
  });
}
