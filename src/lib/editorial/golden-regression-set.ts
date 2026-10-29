/**
 * RancangLoka Immutable Golden Regression Set
 * Milestone: PHASE-2B-CROSS-LINGUAL-GROUNDING
 * Target: scripts/content-bootstrap/trials/trial-20261024-luna-restore1-artb/
 *
 * Contains:
 * - Actual real trial entries: CLM-045, CLM-021, AST-034, AST-047
 * - Independent Negative Controls:
 *   1. Opposite Polarity (Contradiction)
 *   2. Changed Numerical Thresholds
 *   3. Changed Material Identity
 *   4. Changed Building Assembly Scope
 *   5. Missing Required Preconditions
 *   6. Stronger Extreme Certainty Than Source
 *   7. Homograph False Collision (Indonesian "air" vs English "air")
 *   8. False Equivalence (Condensation vs Rain Leakage)
 *
 * All golden labels are independently justified from physical & semantic ground truth.
 */

export interface GoldenTestCase {
  id: string;
  category:
    | 'ACTUAL_TRIAL_CASE'
    | 'NEGATIVE_CONTROL_OPPOSITE_POLARITY'
    | 'NEGATIVE_CONTROL_NUMERICAL_THRESHOLD'
    | 'NEGATIVE_CONTROL_CHANGED_MATERIAL'
    | 'NEGATIVE_CONTROL_CHANGED_ASSEMBLY'
    | 'NEGATIVE_CONTROL_MISSING_CONDITION'
    | 'NEGATIVE_CONTROL_EXTREME_CERTAINTY'
    | 'NEGATIVE_CONTROL_HOMOGRAPH_COLLISION'
    | 'NEGATIVE_CONTROL_FALSE_EQUIVALENCE'
    | 'ACTUAL_TRIAL_ASSERTION';
  claimId?: string;
  assertionId?: string;
  sourcePassage: string;
  claimStatement: string;
  articleExcerpt: string;
  qualificationRequired?: string;
  legacyVerifierResult: 'ENTAILED' | 'NOT_ENTAILED' | 'UNCERTAIN';
  goldenExpectedVerdict: 'ENTAILED' | 'NOT_ENTAILED' | 'UNCERTAIN';
  goldenClassification?: 'EVIDENCE_BACKED' | 'NON_CLAIM_PROSE' | 'EDITORIAL_INFERENCE' | 'UNRESOLVED';
  independentJustification: string;
}

export const GOLDEN_REGRESSION_SET: GoldenTestCase[] = [
  // ===========================================================================
  // ACTUAL REAL TRIAL CASES
  // ===========================================================================
  {
    id: 'GOLDEN-ACTUAL-CLM-045',
    category: 'ACTUAL_TRIAL_CASE',
    claimId: 'CLM-045',
    sourcePassage:
      'Insulating buildings during construction is much easier than retrofitting, as generally the insulation is hidden, and parts of the building need to be deconstructed to reach them. Depending on the country there are different regulations as to which type of insulation is the best alternative for buildings, considering energy efficiency and environmental factors.',
    claimStatement:
      'Insulating buildings during construction is much easier than retrofitting, as generally the insulation is hidden, and parts of the building need to be deconstructed to reach them.',
    articleExcerpt:
      'Pada rumah yang masih dalam tahap pembangunan, penempatan insulasi dan detail sambungan lebih mudah disiapkan sebelum lapisan dinding ditutup.',
    qualificationRequired: undefined,
    legacyVerifierResult: 'NOT_ENTAILED', // Legacy verifier had 0 shared tokens
    goldenExpectedVerdict: 'ENTAILED',
    goldenClassification: 'EVIDENCE_BACKED',
    independentJustification:
      'The Indonesian draft asserts that during construction stage, insulation placement and joint details are easier to prepare before wall layers are closed. This semantically entails the English source proposition that insulating buildings during construction is much easier than retrofitting before elements are hidden.'
  },
  {
    id: 'GOLDEN-ACTUAL-CLM-021',
    category: 'ACTUAL_TRIAL_CASE',
    claimId: 'CLM-021',
    sourcePassage:
      'When water is trapped in the insulation, the latent heats of evaporation and condensation influence the thermal performance. Kunzel found that although the inter-reaction between moisture and energy is complex, it is predictable and mostly less dramatic than often assumed.',
    claimStatement:
      'When water is trapped in the insulation, the latent heats of evaporation and condensation influence the thermal performance.',
    articleExcerpt:
      'Jika material insulasi atau lapisan dinding sudah basah, kondisi tersebut perlu dinilai sebelum penambahan insulasi karena air yang terperangkap dapat memengaruhi kinerja termal.',
    qualificationRequired: undefined,
    legacyVerifierResult: 'UNCERTAIN', // Legacy verifier failed on "air" homograph & lemma stems
    goldenExpectedVerdict: 'ENTAILED',
    goldenClassification: 'EVIDENCE_BACKED',
    independentJustification:
      'The assertion asserts that trapped water can influence thermal performance in damp insulation or wall assemblies. This is a direct paraphrase and entailment of the verified physics claim that water trapped in insulation influences thermal performance.'
  },
  {
    id: 'GOLDEN-ACTUAL-AST-034',
    category: 'ACTUAL_TRIAL_ASSERTION',
    assertionId: 'AST-034',
    sourcePassage:
      'Condensation occurs when surface temperature drops below dew point. Rain leakage occurs through openings or defective flashings. Seepage occurs through porous masonry.',
    claimStatement:
      'Condensation, rain penetration, and capillary rising damp have distinct physical mechanisms despite all resulting in visible moisture.',
    articleExcerpt:
      'Embun, kebocoran hujan, dan rembesan dinding sama-sama menghasilkan air di sekitar kusen, tetapi penanganannya berbeda.',
    legacyVerifierResult: 'UNCERTAIN',
    goldenExpectedVerdict: 'ENTAILED',
    goldenClassification: 'EDITORIAL_INFERENCE',
    independentJustification:
      'This sentence introduces section 3 as diagnostic problem framing. It synthesizes the differential diagnosis of visible moisture origins (condensation, rain leaks, wall seepage) and emphasizes distinct handling, without asserting new unsupported laboratory measurements.'
  },
  {
    id: 'GOLDEN-ACTUAL-AST-047',
    category: 'ACTUAL_TRIAL_ASSERTION',
    assertionId: 'AST-047',
    sourcePassage: 'N/A - Procedural Sequencing Step',
    claimStatement: 'N/A - Structural sequencing without empirical lab claim',
    articleExcerpt:
      'Langkah keempat adalah memperbaiki penyebab yang paling jelas terlebih dahulu.',
    legacyVerifierResult: 'UNCERTAIN',
    goldenExpectedVerdict: 'ENTAILED',
    goldenClassification: 'NON_CLAIM_PROSE',
    independentJustification:
      'This sentence is a pure procedural sequencing step (Step four is fixing the most obvious cause first). It contains zero empirical claims, zero numeric metrics, and zero lab values. It must be accounted for as NON_CLAIM_PROSE (procedural action) rather than an ungrounded substantive failure.'
  },

  // ===========================================================================
  // INDEPENDENT NEGATIVE CONTROLS
  // ===========================================================================
  {
    id: 'GOLDEN-NEG-01-OPPOSITE-POLARITY',
    category: 'NEGATIVE_CONTROL_OPPOSITE_POLARITY',
    claimId: 'CLM-045',
    sourcePassage:
      'Insulating buildings during construction is much easier than retrofitting, as generally the insulation is hidden, and parts of the building need to be deconstructed to reach them.',
    claimStatement:
      'Insulating buildings during construction is much easier than retrofitting.',
    articleExcerpt:
      'Pemasangan insulasi pada rumah saat tahap pembangunan jauh lebih sulit dan merugikan dibandingkan renovasi.',
    legacyVerifierResult: 'NOT_ENTAILED',
    goldenExpectedVerdict: 'NOT_ENTAILED',
    independentJustification:
      'The assertion reverses the polarity and meaning of the source (claims building during construction is harder/more difficult instead of easier). Must be strictly rejected as NOT_ENTAILED.'
  },
  {
    id: 'GOLDEN-NEG-02-NUMERICAL-THRESHOLD',
    category: 'NEGATIVE_CONTROL_NUMERICAL_THRESHOLD',
    claimId: 'CLM-021',
    sourcePassage:
      'Changing humidity from 0% to 90-95% increased thermal conductivity (ƛ) by 2% (rockwool) to 45% (lightweight cellular concretes). With PUR, ƛ increases ~ 5% from 1→100% humidity.',
    claimStatement:
      'Changing humidity from 0% to 90-95% increased thermal conductivity by 2% for rockwool and up to 45% for lightweight concrete.',
    articleExcerpt:
      'Kenaikan kelembapan udara hingga 95% meningkatkan konduktivitas termal rockwool hingga 85%.',
    legacyVerifierResult: 'NOT_ENTAILED',
    goldenExpectedVerdict: 'NOT_ENTAILED',
    independentJustification:
      'The assertion fabricates a contradictory numeric threshold (85% for rockwool instead of 2%). Must be strictly rejected as NOT_ENTAILED.'
  },
  {
    id: 'GOLDEN-NEG-03-CHANGED-MATERIAL',
    category: 'NEGATIVE_CONTROL_CHANGED_MATERIAL',
    claimId: 'CLM-021',
    sourcePassage:
      'When water is trapped in the insulation, the latent heats of evaporation and condensation influence the thermal performance.',
    claimStatement:
      'When water is trapped in the insulation, the latent heats of evaporation and condensation influence the thermal performance.',
    articleExcerpt:
      'Air yang terperangkap di dalam tembaga padat memengaruhi kinerja termal material tersebut.',
    legacyVerifierResult: 'NOT_ENTAILED',
    goldenExpectedVerdict: 'NOT_ENTAILED',
    independentJustification:
      'The assertion substitutes insulation with solid copper (tembaga padat). Material identity contradiction must be rejected as NOT_ENTAILED.'
  },
  {
    id: 'GOLDEN-NEG-04-CHANGED-ASSEMBLY',
    category: 'NEGATIVE_CONTROL_CHANGED_ASSEMBLY',
    claimId: 'CLM-045',
    sourcePassage:
      'Insulating buildings during construction is much easier than retrofitting, as generally the insulation is hidden, and parts of the building need to be deconstructed to reach them.',
    claimStatement:
      'Insulating buildings during construction is much easier than retrofitting.',
    articleExcerpt:
      'Memasang pondasi tiang pancang gedung jauh lebih mudah dilakukan setelah bangunan selesai dihuni.',
    legacyVerifierResult: 'NOT_ENTAILED',
    goldenExpectedVerdict: 'NOT_ENTAILED',
    independentJustification:
      'The assertion changes building assembly to deep foundation piling (tiang pancang) and post-occupancy installation. Complete assembly mismatch must be rejected as NOT_ENTAILED.'
  },
  {
    id: 'GOLDEN-NEG-05-MISSING-CONDITION',
    category: 'NEGATIVE_CONTROL_MISSING_CONDITION',
    claimId: 'CLM-021',
    sourcePassage:
      'When water is trapped in the insulation, the latent heats of evaporation and condensation influence the thermal performance.',
    claimStatement:
      'When water is trapped in the insulation, the latent heats of evaporation and condensation influence the thermal performance.',
    articleExcerpt:
      'Semua material insulasi selalu mengalami penurunan kinerja termal secara konstan bahkan dalam kondisi kering total tanpa kelembapan.',
    legacyVerifierResult: 'NOT_ENTAILED',
    goldenExpectedVerdict: 'NOT_ENTAILED',
    independentJustification:
      'The assertion asserts constant performance degradation in totally dry conditions, completely violating the necessary condition of trapped water and moisture. Must be rejected as NOT_ENTAILED.'
  },
  {
    id: 'GOLDEN-NEG-06-EXTREME-CERTAINTY',
    category: 'NEGATIVE_CONTROL_EXTREME_CERTAINTY',
    claimId: 'CLM-021',
    sourcePassage:
      'When water is trapped in the insulation, the latent heats of evaporation and condensation influence the thermal performance.',
    claimStatement:
      'When water is trapped in the insulation, the latent heats of evaporation and condensation influence the thermal performance.',
    articleExcerpt:
      'Air yang terperangkap pada insulasi pasti langsung menghancurkan seluruh dinding dan merobohkan kusen secara instan.',
    legacyVerifierResult: 'NOT_ENTAILED',
    goldenExpectedVerdict: 'NOT_ENTAILED',
    independentJustification:
      'The assertion invents catastrophic physical destruction far exceeding the moderate physical principle stated in the source. Must be rejected as NOT_ENTAILED.'
  },
  {
    id: 'GOLDEN-NEG-07-HOMOGRAPH-COLLISION',
    category: 'NEGATIVE_CONTROL_HOMOGRAPH_COLLISION',
    claimId: 'CLM-HOMOGRAPH',
    sourcePassage:
      'Adequate air circulation and ventilation reduces interior relative humidity.',
    claimStatement:
      'Adequate air circulation reduces interior relative humidity.',
    articleExcerpt:
      'Sirkulasi air yang mengalir deras di lantai terbukti mengurangi kelembapan udara ruangan.',
    legacyVerifierResult: 'NOT_ENTAILED',
    goldenExpectedVerdict: 'NOT_ENTAILED',
    independentJustification:
      'Indonesian "air" (liquid water running on floor) is falsely substituted for English "air" (atmospheric ventilation). Must NOT match based solely on the identical spelling of "air".'
  },
  {
    id: 'GOLDEN-NEG-08-FALSE-EQUIVALENCE',
    category: 'NEGATIVE_CONTROL_FALSE_EQUIVALENCE',
    claimId: 'CLM-FALSE-EQUIV',
    sourcePassage:
      'Condensation occurs when warm moist air touches a cold surface below dew point.',
    claimStatement:
      'Condensation occurs when moisture touches a cold surface below dew point.',
    articleExcerpt:
      'Kondensasi embun pada kusen aluminium adalah tanda pasti bahwa kusen mengalami kebocoran air hujan dari genteng.',
    legacyVerifierResult: 'NOT_ENTAILED',
    goldenExpectedVerdict: 'NOT_ENTAILED',
    independentJustification:
      'The assertion asserts a false equivalence between surface thermal condensation and rainwater leakage from roof tiles. Must be rejected as NOT_ENTAILED.'
  },
  {
    id: 'GOLDEN-NEG-09-PROCEDURAL-WITH-FACTUAL-ASSERTION',
    category: 'NEGATIVE_CONTROL_NUMERICAL_THRESHOLD',
    assertionId: 'AST-NEG-PROC-FACT',
    sourcePassage: 'N/A',
    claimStatement: 'N/A',
    articleExcerpt:
      'Langkah keempat adalah memasang sealant silikon setebal 12mm yang dijamin menurunkan suhu ruangan sebesar 8°C.',
    legacyVerifierResult: 'NOT_ENTAILED',
    goldenExpectedVerdict: 'NOT_ENTAILED',
    goldenClassification: 'UNRESOLVED',
    independentJustification:
      'A sentence starting with "Langkah keempat adalah..." that introduces unsupported technical numbers (12mm, 8°C temperature drop guarantee) MUST NOT be exempted as non-claim prose. It asserts factual propositions and must remain UNRESOLVED if unsupported.'
  }
];
