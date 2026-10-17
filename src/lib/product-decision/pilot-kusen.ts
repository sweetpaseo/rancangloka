/**
 * ============================================================================
 * RancangLoka Product Decision Engine (PRODUCT_DECISION_ENGINE-1A)
 * Article 5 Pilot Decision Fixture: Kusen Aluminium vs uPVC
 *
 * Source Evidence:
 * - Article 5: "Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia"
 * - Slug: kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia
 * - Publication DNA Version Key: receipt:rcpt_bbae85b48e1b2f8d
 * - Authoritative Published Content Hash: 14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277
 * - Provenance: FULL_PROVENANCE
 * - Hash Contract: legacy-normalized-sha256-v0
 * - Source Fidelity: NORMALIZED_HASH_VERIFIED
 * ============================================================================
 */

import type {
  DecisionModelDefinition,
  EvidenceBinding,
  SolutionClass,
  DecisionCriterion,
  CriterionEvaluation,
  DecisionConstraint,
  DecisionScenario
} from './types.ts';
import { computeEvidenceSnapshotHash } from './contracts.ts';

/**
 * Authoritative Article 5 Publication Evidence Binding Base
 */
export const ARTICLE_5_EVIDENCE_BASE = Object.freeze({
  article_id: 5,
  article_slug: 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
  publication_version_key: 'receipt:rcpt_bbae85b48e1b2f8d',
  published_content_hash: '14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277',
  source_fidelity: 'NORMALIZED_HASH_VERIFIED' as const
});

// Helper to construct evidence binding with strict char-limit check
function createArt5Binding(
  claimClass: 'VERIFIED_FACT' | 'TECHNICAL_CONSENSUS' | 'USER_EXPERIENCE_SIGNAL' | 'EDITORIAL_INFERENCE' | 'EDITORIAL_RECOMMENDATION',
  summary: string,
  section?: string
): EvidenceBinding {
  if (summary.length > 200) {
    throw new Error(`Evidence summary exceeds 200 chars: ${summary}`);
  }
  return {
    ...ARTICLE_5_EVIDENCE_BASE,
    claim_class: claimClass,
    evidence_summary: summary,
    source_section: section
  };
}

// ============================================================================
// 1. SOLUTION CLASSES & TRADEOFFS
// ============================================================================

export const SOLUTION_CLASSES_PILOT: SolutionClass[] = [
  {
    solution_id: 'sol_aluminium_standar',
    name: 'Kusen Aluminium Arsitektural',
    indonesian_label: 'Kusen Aluminium',
    category: 'MATERIAL',
    description: 'Profil logam paduan aluminium ekstrusi dengan lapisan proteksi anodized atau powder coating arsitektural.',
    inherent_strengths: [
      'Kekakuan struktural tinggi dengan modulus elastisitas tinggi (minimal lendutan pada bentang lebar)',
      'Profil ramping (slim sightlines) memaksimalkan bidang pandang kaca dan masuknya cahaya alami',
      'Stabil terhadap radiasi sinar UV tropis tanpa degradasi atau kerapuhan polimer',
      'Tahan api dan tidak melunak pada suhu tinggi'
    ],
    inherent_weaknesses: [
      'Konduktivitas termal tinggi (menyerap radiasi matahari dan menghantarkan panas secara konduksi)',
      'Sambungan sudut mekanikal (mitre joint) mengandalkan presisi sekrup dan sealant internal',
      'Rentan korosi pitting di lingkungan pesisir berkadar garam tinggi jika lapisan proteksi tipis'
    ],
    tradeoffs: [
      {
        tradeoff_id: 'tr_al_rigidity_vs_heat',
        solution_id: 'sol_aluminium_standar',
        benefit: 'Kapasitas struktural tinggi memungkinkan bukaan berdimensi masif dan bingkai ramping.',
        cost_or_compromise: 'Menghantarkan panas konduksi luar ke dalam ruangan kecuali menggunakan sistem thermal break.',
        affected_contexts: ['WEST_AFTERNOON_HEAT', 'MASTER_BEDROOM'],
        mitigation_tip: 'Gunakan peneduh eksterior atau pertimbangkan gorden isolasi termal pada kamar tidur.',
        evidence_binding: createArt5Binding(
          'VERIFIED_FACT',
          'Aluminium memiliki konduktivitas termal tinggi (~160 W/mK) menghantarkan panas konduksi bingkai.',
          'Karakter Fisik Dasar: Konduktivitas Termal dan Kekakuan Struktural'
        )
      },
      {
        tradeoff_id: 'tr_al_joint_vs_water',
        solution_id: 'sol_aluminium_standar',
        benefit: 'Fabrikasi modular relatif cepat dan mudah disesuaikan dengan dimensi di lapangan.',
        cost_or_compromise: 'Kekedapan air sudut bingkai bergantung pada presisi mitre joint dan kualitas sealant.',
        affected_contexts: ['WIND_DRIVEN_RAIN'],
        mitigation_tip: 'Pastikan aplikator mengaplikasikan joint sealant anti-jamur di dalam sambungan potongan mitre.',
        evidence_binding: createArt5Binding(
          'TECHNICAL_CONSENSUS',
          'Kerapatan sudut aluminium mengandalkan sambungan mekanikal mitre joint dan sealant internal.',
          'Sambungan Sudut, Sistem Drainase, dan Ketahanan terhadap Hujan Angin'
        )
      }
    ]
  },
  {
    solution_id: 'sol_upvc_multi_chamber',
    name: 'Kusen uPVC Bersekat (Multi-Chamber)',
    indonesian_label: 'Kusen uPVC',
    category: 'MATERIAL',
    description: 'Profil polimer Unplasticized Polyvinyl Chloride dengan rongga bersekat multi-chamber dan tulangan baja galvanis internal.',
    inherent_strengths: [
      'Isolasi konduksi termal sangat baik (konduktivitas rendah menahan panas luar dan menjaga suhu bingkai sejuk)',
      'Sambungan sudut dilas fusi (fusion-welded) menyatu tanpa celah mekanikal sambungan sudut',
      'Struktur berongga membantu meredam transmisi getaran gelombang kebisingan lingkungan',
      'Tahan terhadap oksidasi asam dan udara berkadar garam tinggi di area pesisir'
    ],
    inherent_weaknesses: [
      'Profil lebih tebal dan masif mengurangi proporsi bidang pandang kaca pada bukaan sempit',
      'Bobot profil dan kaca ganda lebih berat memerlukan penopang dinding dan engsel berkualitas',
      'Koefisien muai panjang termal lebih tinggi memerlukan celah ekspansi perimeter yang presisi'
    ],
    tradeoffs: [
      {
        tradeoff_id: 'tr_upvc_thermal_vs_sightline',
        solution_id: 'sol_upvc_multi_chamber',
        benefit: 'Isolator termal polimer bersekat efektif menahan rambatan panas matahari tropis.',
        cost_or_compromise: 'Garis bingkai lebih tebal/masif membatasi luas kaca terbuka pada bukaan kecil.',
        affected_contexts: ['LIVING_COMMON_AREA', 'TIGHT_CONSTRAINED'],
        mitigation_tip: 'Terapkan pada bukaan dengan proporsi bidang luas atau kamar yang memprioritaskan privasi.',
        evidence_binding: createArt5Binding(
          'TECHNICAL_CONSENSUS',
          'uPVC bersekat efektif mereduksi panas konduksi namun profilnya berpenampang lebih tebal.',
          'Karakter Fisik Dasar: Konduktivitas Termal dan Kekakuan Struktural'
        )
      },
      {
        tradeoff_id: 'tr_upvc_weld_vs_expansion',
        solution_id: 'sol_upvc_multi_chamber',
        benefit: 'Sudut bingkai dilas fusi menyatu mengeliminasi risiko rembesan air pada sambungan sudut.',
        cost_or_compromise: 'Pemuaian termal polimer 2-3x lebih besar memerlukan celah ekspansi perimeter elastis.',
        affected_contexts: ['WEST_AFTERNOON_HEAT', 'WIND_DRIVEN_RAIN'],
        mitigation_tip: 'Wajib memberikan celah perimeter 5-10 mm di sekeliling opening kusen dan sealant elastis.',
        evidence_binding: createArt5Binding(
          'VERIFIED_FACT',
          'Sambungan sudut uPVC dilas fusi kedap air, tetapi pemuaian termal membutuhkan celah perimeter.',
          'Karakteristik Pemuaian dan Risiko Lapangan'
        )
      }
    ]
  }
];

// ============================================================================
// 2. CRITERIA & EVALUATIONS
// ============================================================================

export const CRITERIA_PILOT: DecisionCriterion[] = [
  {
    criterion_id: 'crit_thermal_insulation',
    name: 'Isolasi Konduksi Termal Bingkai',
    dimension_type: 'CORE',
    value_type: 'MEASURED_VALUE',
    description: 'Kemampuan material menghambat transmisi rambatan panas konduksi luar ke dalam ruangan.',
    evaluation_question: 'Seberapa efektif material mencegah bingkai jendela menjadi panas saat terkena radiasi terik matahari?'
  },
  {
    criterion_id: 'crit_structural_rigidity',
    name: 'Kekakuan Struktural Bentang Lebar',
    dimension_type: 'CORE',
    value_type: 'ORDINAL',
    description: 'Kapasitas material menahan lendutan beban angin dan berat kaca pada dimensi bukaan lebar.',
    evaluation_question: 'Apakah material memiliki modulus elastisitas tinggi untuk bukaan masif tanpa lendutan?'
  },
  {
    criterion_id: 'crit_corner_water_tightness',
    name: 'Keandalan Sambungan Sudut terhadap Rembes Air',
    dimension_type: 'CORE',
    value_type: 'QUALITATIVE_CATEGORY',
    description: 'Tingkat kekedapan air pada titik temu sambungan sudut bingkai saat terpaan hujan angin.',
    evaluation_question: 'Apakah sudut sambungan bingkai dilas mati kedap air atau mengandalkan sekrup mekanikal?'
  },
  {
    criterion_id: 'crit_acoustic_attenuation',
    name: 'Redaman Getaran Akustik Profil',
    dimension_type: 'OPTIONAL',
    value_type: 'QUALITATIVE_CATEGORY',
    description: 'Kemampuan struktur profil membantu meredam rambatan getaran suara lingkungan luar.',
    evaluation_question: 'Seberapa baik struktur profil membantu meredam kebisingan jalanan saat dipadu kaca rapat?'
  },
  {
    criterion_id: 'crit_coastal_corrosion_resistance',
    name: 'Ketahanan Korosi Garam Udara Pesisir',
    dimension_type: 'DOMAIN_SPECIFIC',
    value_type: 'QUALITATIVE_CATEGORY',
    description: 'Daya tahan permukaan profil terhadap oksidasi lingkungan pesisir berkadar garam tinggi.',
    evaluation_question: 'Apakah material kebal terhadap korosi pitting garam laut tanpa perawatan pelapisan khusus?'
  },
  {
    criterion_id: 'crit_thermal_expansion_stability',
    name: 'Stabilitas Dimensi terhadap Pemuaian Suhu',
    dimension_type: 'DOMAIN_SPECIFIC',
    value_type: 'MEASURED_VALUE',
    description: 'Stabilitas panjang profil saat mengalami fluktuasi panas matahari ekstrem.',
    evaluation_question: 'Seberapa kecil koefisien muai panjang material saat terpapar terik matahari langsung?'
  },
  {
    criterion_id: 'crit_slim_sightlines',
    name: 'Garis Bingkai Ramping (Slim Sightlines)',
    dimension_type: 'OPTIONAL',
    value_type: 'ORDINAL',
    description: 'Tingkat kerampingan visual profil dalam memaksimalkan bidang pandang kaca dan cahaya.',
    evaluation_question: 'Seberapa ramping bingkai profil agar tidak memakan luas pandang bukaan?'
  }
];

export const EVALUATIONS_PILOT: CriterionEvaluation[] = [
  // --- crit_thermal_insulation ---
  {
    criterion_id: 'crit_thermal_insulation',
    solution_id: 'sol_aluminium_standar',
    value_type: 'MEASURED_VALUE',
    qualitative_tier: 'HIGH_THERMAL_CONDUCTIVITY',
    measured_value: {
      value: 160,
      unit: 'W/m·K',
      standard_reference: 'Fisika Material Logam Aluminium'
    },
    factual_basis: 'Konduktivitas termal logam aluminium tinggi menyerap dan menghantarkan panas radiasi ke interior.',
    evidence_binding: createArt5Binding(
      'VERIFIED_FACT',
      'Konduktivitas termal aluminium ~160 W/mK menghantarkan panas konduksi kecuali dipasang thermal break.',
      'Karakter Fisik Dasar: Konduktivitas Termal dan Kekakuan Struktural'
    )
  },
  {
    criterion_id: 'crit_thermal_insulation',
    solution_id: 'sol_upvc_multi_chamber',
    value_type: 'MEASURED_VALUE',
    qualitative_tier: 'EXCELLENT_THERMAL_INSULATION',
    measured_value: {
      value: 0.17,
      unit: 'W/m·K',
      standard_reference: 'Fisika Polimer uPVC Multichamber'
    },
    factual_basis: 'Konduktivitas termal polimer rendah dengan rongga bersekat efektif menahan rambatan panas.',
    evidence_binding: createArt5Binding(
      'VERIFIED_FACT',
      'Konduktivitas uPVC ~0.17 W/mK bersekat multi-chamber menahan konduksi panas menjaga bingkai sejuk.',
      'Karakter Fisik Dasar: Konduktivitas Termal dan Kekakuan Struktural'
    )
  },

  // --- crit_structural_rigidity ---
  {
    criterion_id: 'crit_structural_rigidity',
    solution_id: 'sol_aluminium_standar',
    value_type: 'ORDINAL',
    qualitative_tier: 'SUPERIOR_RIGIDITY',
    factual_basis: 'Modulus elastisitas tinggi memberi kekakuan struktural prima untuk bentang masif dan pintu lebar.',
    evidence_binding: createArt5Binding(
      'TECHNICAL_CONSENSUS',
      'Kekakuan struktural aluminium sangat tinggi dengan modulus elastisitas tinggi minim lendutan.',
      'Karakter Fisik Dasar: Konduktivitas Termal dan Kekakuan Struktural'
    )
  },
  {
    criterion_id: 'crit_structural_rigidity',
    solution_id: 'sol_upvc_multi_chamber',
    value_type: 'ORDINAL',
    qualitative_tier: 'MODERATE_RIGIDITY_REINFORCED',
    factual_basis: 'Material polimer mengandalkan perkuatan tulangan baja galvanis di dalam rongga untuk bentang lebar.',
    evidence_binding: createArt5Binding(
      'TECHNICAL_CONSENSUS',
      'uPVC mengandalkan tulangan penguat baja galvanis di dalam rongga profil untuk bentang tertentu.',
      'Karakter Fisik Dasar: Konduktivitas Termal dan Kekakuan Struktural'
    )
  },

  // --- crit_corner_water_tightness ---
  {
    criterion_id: 'crit_corner_water_tightness',
    solution_id: 'sol_aluminium_standar',
    value_type: 'QUALITATIVE_CATEGORY',
    qualitative_tier: 'MECHANICAL_JOINT_DEPENDENT',
    factual_basis: 'Sambungan sudut mekanikal mitre joint mengandalkan presisi sekrup cleat dan sealant internal.',
    evidence_binding: createArt5Binding(
      'TECHNICAL_CONSENSUS',
      'Aluminium bergantung pada presisi mitre joint dan sealant internal untuk mencegah celah sudut.',
      'Sambungan Sudut, Sistem Drainase, dan Ketahanan terhadap Hujan Angin'
    )
  },
  {
    criterion_id: 'crit_corner_water_tightness',
    solution_id: 'sol_upvc_multi_chamber',
    value_type: 'QUALITATIVE_CATEGORY',
    qualitative_tier: 'FUSION_WELDED_HERMETIC',
    factual_basis: 'Sudut dilas fusi menyatu mengeliminasi sambungan mekanikal dan meniadakan kebocoran sudut bingkai.',
    evidence_binding: createArt5Binding(
      'VERIFIED_FACT',
      'Sudut uPVC dilas fusi fusion-welded menyatu mengeliminasi celah sambungan mekanikal sudut bingkai.',
      'Sambungan Sudut, Sistem Drainase, dan Ketahanan terhadap Hujan Angin'
    )
  },

  // --- crit_acoustic_attenuation ---
  {
    criterion_id: 'crit_acoustic_attenuation',
    solution_id: 'sol_aluminium_standar',
    value_type: 'QUALITATIVE_CATEGORY',
    qualitative_tier: 'SYSTEM_SEAL_DEPENDENT',
    factual_basis: 'Profil logam kaku merambatkan getaran suara; peredaman sangat ditentukan oleh kaca dan gasket.',
    evidence_binding: createArt5Binding(
      'TECHNICAL_CONSENSUS',
      'Aluminium meredam suara jika dipadu gasket kompresi dan kaca laminasi tebal.',
      'Membedakan Peredaman Suara dari Kerapatan Udara'
    )
  },
  {
    criterion_id: 'crit_acoustic_attenuation',
    solution_id: 'sol_upvc_multi_chamber',
    value_type: 'QUALITATIVE_CATEGORY',
    qualitative_tier: 'CHAMBER_DAMPED_ACOUSTICS',
    factual_basis: 'Struktur berongga multi-chamber membantu meredam transmisi getaran gelombang kebisingan.',
    evidence_binding: createArt5Binding(
      'TECHNICAL_CONSENSUS',
      'Struktur berongga uPVC membantu meredam getaran suara melalui profil.',
      'Membedakan Peredaman Suara dari Kerapatan Udara'
    )
  },

  // --- crit_coastal_corrosion_resistance ---
  {
    criterion_id: 'crit_coastal_corrosion_resistance',
    solution_id: 'sol_aluminium_standar',
    value_type: 'QUALITATIVE_CATEGORY',
    qualitative_tier: 'COATING_DEPENDENT',
    factual_basis: 'Perlu proteksi anodized atau powder coating arsitektural minimal 15-20 mikron di lingkungan pesisir.',
    evidence_binding: createArt5Binding(
      'TECHNICAL_CONSENSUS',
      'Aluminium tahan UV stabil dengan anodized/powder coat namun perlu spesifikasi tinggi di pesisir.',
      'Catatan Kritis Kusen Aluminium'
    )
  },
  {
    criterion_id: 'crit_coastal_corrosion_resistance',
    solution_id: 'sol_upvc_multi_chamber',
    value_type: 'QUALITATIVE_CATEGORY',
    qualitative_tier: 'INHERENTLY_CORROSION_PROOF',
    factual_basis: 'Polimer tidak mengalami korosi oksidasi garam laut dan kebal terhadap udara pesisir bergaram.',
    evidence_binding: createArt5Binding(
      'VERIFIED_FACT',
      'uPVC tahan terhadap garam udara pesisir dan tidak mengalami korosi permukaan bingkai.',
      'Pertimbangan Pemilihan Sistem Berdasarkan Kondisi Ruang'
    )
  },

  // --- crit_thermal_expansion_stability ---
  {
    criterion_id: 'crit_thermal_expansion_stability',
    solution_id: 'sol_aluminium_standar',
    value_type: 'MEASURED_VALUE',
    qualitative_tier: 'LOW_EXPANSION_STABLE',
    measured_value: {
      value: 24,
      unit: '×10⁻⁶/K',
      standard_reference: 'Koefisien Muai Panjang Aluminium'
    },
    factual_basis: 'Pemuaian termal rendah menjaga stabilitas dimensi profil saat terkena terik matahari siang.',
    evidence_binding: createArt5Binding(
      'VERIFIED_FACT',
      'Aluminium memiliki koefisien muai panjang rendah (~24×10⁻⁶/K) dimensi stabil saat panas.',
      'Karakteristik Pemuaian dan Risiko Lapangan'
    )
  },
  {
    criterion_id: 'crit_thermal_expansion_stability',
    solution_id: 'sol_upvc_multi_chamber',
    value_type: 'MEASURED_VALUE',
    qualitative_tier: 'HIGH_EXPANSION_GAP_REQUIRED',
    measured_value: {
      value: 70,
      unit: '×10⁻⁶/K',
      standard_reference: 'Koefisien Muai Panjang uPVC'
    },
    factual_basis: 'Pemuaian termal 2-3x lebih besar memerlukan celah ekspansi perimeter dan sealant elastis presisi.',
    evidence_binding: createArt5Binding(
      'VERIFIED_FACT',
      'uPVC memuai 2-3x lebih besar (~60-80×10⁻⁶/K) membutuhkan celah perimeter elastis.',
      'Karakteristik Pemuaian dan Risiko Lapangan'
    )
  },

  // --- crit_slim_sightlines ---
  {
    criterion_id: 'crit_slim_sightlines',
    solution_id: 'sol_aluminium_standar',
    value_type: 'ORDINAL',
    qualitative_tier: 'SLIM_MINIMALIST',
    factual_basis: 'Ketebalan penampang profil ramping memaksimalkan luas kaca dan pandangan estetika modern.',
    evidence_binding: createArt5Binding(
      'EDITORIAL_INFERENCE',
      'Aluminium menawarkan garis bingkai ramping slim sightlines memaksimalkan bidang pandang dan cahaya.',
      'Pertimbangan Pemilihan Sistem Berdasarkan Kondisi Ruang'
    )
  },
  {
    criterion_id: 'crit_slim_sightlines',
    solution_id: 'sol_upvc_multi_chamber',
    value_type: 'ORDINAL',
    qualitative_tier: 'BULKIER_PROFILE',
    factual_basis: 'Penampang profil lebih lebar/masif untuk menampung rongga sekat dan tulangan baja penguat.',
    evidence_binding: createArt5Binding(
      'EDITORIAL_INFERENCE',
      'uPVC memiliki penampang profil lebih tebal/masif untuk mengakomodasi rongga dan tulangan baja.',
      'Pertimbangan Pemilihan Sistem Berdasarkan Kondisi Ruang'
    )
  }
];

// ============================================================================
// 3. CONSTRAINTS
// ============================================================================

export const CONSTRAINTS_PILOT: DecisionConstraint[] = [
  {
    constraint_id: 'c_massive_opening_rigidity',
    name: 'Bukaan Masif / Pintu Geser Bentang Lebar',
    description: 'Bukaan dengan lebar lebih dari 3 meter atau partisi lipat tinggi membutuhkan kekakuan logam prima.',
    severity: 'HARD',
    applies_when: (ctx) => ctx.application_location === 'LIVING_COMMON_AREA' && ctx.problem_goal.toLowerCase().includes('lebar'),
    predicate: {
      operator: 'ALL',
      rules: [
        { field: 'application_location', operator: 'EQUALS', value: 'LIVING_COMMON_AREA' },
        { field: 'problem_goal', operator: 'INCLUDES', value: 'lebar' }
      ]
    },
    disqualified_solution_ids: [],
    affected_solution_ids: ['sol_upvc_multi_chamber'],
    impact_explanation: 'uPVC memerlukan tulangan baja khusus dan profil ekstra tebal pada bentang sangat lebar; aluminium lebih diutamakan.'
  },
  {
    constraint_id: 'c_west_afternoon_heat_bedroom',
    name: 'Paparan Panas Sore Kamar Tidur Utama',
    description: 'Kamar tidur lantai 2 ber-AC menghadap barat menuntut reduksi konduksi panas agar ruangan tidak pengap.',
    severity: 'SOFT',
    applies_when: (ctx) => ctx.climate_exposure === 'WEST_AFTERNOON_HEAT' && ctx.application_location === 'MASTER_BEDROOM',
    predicate: {
      operator: 'ALL',
      rules: [
        { field: 'climate_exposure', operator: 'EQUALS', value: 'WEST_AFTERNOON_HEAT' },
        { field: 'application_location', operator: 'EQUALS', value: 'MASTER_BEDROOM' }
      ]
    },
    affected_solution_ids: ['sol_aluminium_standar'],
    impact_explanation: 'Aluminium standar menghantarkan panas luar ke dalam kamar; uPVC bersekat lebih unggul menjaga suhu bingkai sejuk.'
  },
  {
    constraint_id: 'c_tight_initial_budget',
    name: 'Keterbatasan Anggaran Awal Renovasi',
    description: 'Pemilik rumah dengan alokasi dana renovasi terbatas memerlukan material dengan ketersediaan luas dan biaya awal hemat.',
    severity: 'SOFT',
    applies_when: (ctx) => ctx.budget_class === 'TIGHT_CONSTRAINED',
    predicate: {
      operator: 'ALL',
      rules: [
        { field: 'budget_class', operator: 'EQUALS', value: 'TIGHT_CONSTRAINED' }
      ]
    },
    affected_solution_ids: ['sol_upvc_multi_chamber'],
    impact_explanation: 'uPVC multi-chamber berkualitas memiliki biaya awal lebih tinggi; aluminium standar lebih terjangkau.'
  }
];

// ============================================================================
// 4. PILOT SCENARIOS (GOLDEN EXPECTATIONS FOR PDE-1B)
// ============================================================================

export const SCENARIOS_PILOT: DecisionScenario[] = [
  // --- SCENARIO 1: West-facing master bedroom heat ---
  {
    scenario_id: 'scen_west_facing_master_bedroom',
    title: 'Kamar Tidur Utama Lantai 2 Menghadap Panas Sore Barat',
    context: {
      problem_goal: 'Mereduksi panas radiasi sore dan kebisingan lingkungan pada kamar tidur ber-AC',
      building_context: 'MULTI_STORY_HOUSE',
      climate_exposure: 'WEST_AFTERNOON_HEAT',
      application_location: 'MASTER_BEDROOM',
      budget_class: 'BALANCED_MID',
      maintenance_tolerance: 'FIT_AND_FORGET',
      comfort_priority: 'THERMAL_HEAT_REDUCTION'
    },
    expected_recommendation: {
      recommended_solution_id: 'sol_upvc_multi_chamber',
      recommended_fit: 'STRONG_FIT',
      why_recommended: 'uPVC multi-chamber memiliki konduktivitas termal sangat rendah (~0.17 W/mK) yang menahan rambatan panas matahari sore barat ke dalam kamar tidur ber-AC.',
      alternative_solution_id: 'sol_aluminium_standar',
      alternative_fit: 'GOOD_FIT_WITH_TRADEOFF',
      why_not_alternative: 'Aluminium standar tanpa thermal break menghantarkan panas konduksi logam ke dalam ruangan kamar tidur.',
      fits_who: [
        'Pemilik rumah dengan kamar tidur ber-AC yang menghadap paparan matahari barat',
        'Keluarga yang menginginkan isolasi suhu sejuk dan peredaman suara jalanan'
      ],
      does_not_fit_who: [
        'Bukaan yang menuntut bingkai ultra-tipis untuk pemandangan minimalis',
        'Renovasi dengan anggaran sangat ketat'
      ],
      critical_tradeoffs: [
        {
          aspect: 'Ketebalan Bingkai',
          compromise: 'Profil uPVC berpenampang lebih tebal dibanding aluminium sehingga bidang kaca sedikit berkurang.',
          mitigation_tip: 'Gunakan tipe jendela jungkit dengan pembagian kaca yang proporsional.'
        }
      ],
      pivot_conditions: [
        {
          trigger_condition: 'Jika bukaan memiliki kanopi tritisan peneduh luar yang lebar atau menghadap arah selatan yang teduh',
          pivots_to_solution_id: 'sol_aluminium_standar',
          rationale: 'Beban rambatan panas berkurang drastis sehingga keuntungan bingkai ramping aluminium menjadi lebih relevan.'
        }
      ],
      next_practical_actions: [
        {
          order: 1,
          action_title: 'Cek Ketebalan Baja Tulangan',
          description: 'Pastikan aplikator uPVC menyertakan tulangan baja galvanis minimal 1.2–1.5 mm di dalam rongga profil.'
        },
        {
          order: 2,
          action_title: 'Verifikasi Expansion Gap',
          description: 'Pastikan tukang menyisakan celah ekspansi perimeter 5–10 mm yang diisi sealant elastis anti-bocor.'
        }
      ],
      evidence_bindings: [
        createArt5Binding(
          'EDITORIAL_RECOMMENDATION',
          'Bukaan kamar tidur yang memerlukan pengendalian kebisingan dan kenyamanan termal memanfaatkan uPVC.',
          'Verdict RancangLoka'
        )
      ]
    }
  },

  // --- SCENARIO 2: Large living room sliding door ---
  {
    scenario_id: 'scen_large_living_sliding_door',
    title: 'Pintu Geser Bentang Lebar Penghubung Ruang Keluarga ke Taman',
    context: {
      problem_goal: 'Pintu geser bukaan lebar fleksibel dengan bidang pandang kaca maksimal',
      building_context: 'MULTI_STORY_HOUSE',
      climate_exposure: 'STANDARD_TROPICAL_SHELTERED',
      application_location: 'LIVING_COMMON_AREA',
      budget_class: 'LONG_TERM_INVESTMENT',
      maintenance_tolerance: 'FIT_AND_FORGET',
      comfort_priority: 'BALANCED_COMFORT'
    },
    expected_recommendation: {
      recommended_solution_id: 'sol_aluminium_standar',
      recommended_fit: 'STRONG_FIT',
      why_recommended: 'Kekakuan struktural aluminium yang tinggi dengan modulus elastisitas tinggi meminimalkan lendutan pada bentang lebar dan menghasilkan profil ramping (slim sightlines).',
      alternative_solution_id: 'sol_upvc_multi_chamber',
      alternative_fit: 'CONDITIONAL_FIT',
      why_not_alternative: 'Profil uPVC lebih fleksibel dan memerlukan penampang tebal serta tulangan berat untuk pintu bentang lebar.',
      fits_who: [
        'Bukaan pintu geser lebar 3–6 meter penghubung area keluarga dan taman luar',
        'Desain arsitektur modern yang mengutamakan bidang kaca transparan luas'
      ],
      does_not_fit_who: [
        'Kamar tidur yang menghadap langsung matahari barat tanpa peneduh luar'
      ],
      critical_tradeoffs: [
        {
          aspect: 'Konduksi Suhu Bingkai',
          compromise: 'Bingkai aluminium menghantarkan suhu luar jika terkena sorot matahari langsung.',
          mitigation_tip: 'Pasang kanopi luar atau teras peneduh di atas pintu geser.'
        }
      ],
      pivot_conditions: [
        {
          trigger_condition: 'Jika pintu berada di area pesisir berkadar garam tinggi tanpa kanopi pelindung',
          pivots_to_solution_id: 'sol_upvc_multi_chamber',
          rationale: 'Ketahanan uPVC terhadap garam laut melampaui aluminium standar yang rentan pitting.'
        }
      ],
      next_practical_actions: [
        {
          order: 1,
          action_title: 'Pilih Ketebalan Profil Minimal 1.3 mm',
          description: 'Gunakan profil aluminium arsitektural dengan ketebalan dinding profil minimal 1.35–1.4 mm untuk pintu geser tinggi.'
        },
        {
          order: 2,
          action_title: 'Periksa Roda Rel Heavy Duty',
          description: 'Gunakan aksesoris roller rel bantalan ganda anti-karat agar daun pintu geser masif tetap ringan didorong.'
        }
      ],
      evidence_bindings: [
        createArt5Binding(
          'EDITORIAL_RECOMMENDATION',
          'Bukaan berskala besar di ruang bersama dapat memanfaatkan kapasitas struktural profil aluminium.',
          'Verdict RancangLoka'
        )
      ]
    }
  },

  // --- SCENARIO 3: Coastal rain-exposed upper facade ---
  {
    scenario_id: 'scen_coastal_rain_exposed_facade',
    title: 'Jendela Fasad Atas Terpaan Hujan Angin di Kawasan Pesisir',
    context: {
      problem_goal: 'Mengeliminasi rembesan air tempias hujan angin kencang dan tahan korosi udara pesisir',
      building_context: 'CORNER_HOUSE_HOOK',
      climate_exposure: 'COASTAL_SALT_HUMID',
      application_location: 'MASTER_BEDROOM',
      budget_class: 'BALANCED_MID',
      maintenance_tolerance: 'FIT_AND_FORGET'
    },
    expected_recommendation: {
      recommended_solution_id: 'sol_upvc_multi_chamber',
      recommended_fit: 'STRONG_FIT',
      why_recommended: 'Sambungan sudut dilas fusi menyatu tanpa celah mekanikal dan sifat polimer kebal terhadap korosi garam pesisir.',
      alternative_solution_id: 'sol_aluminium_standar',
      alternative_fit: 'CONDITIONAL_FIT',
      why_not_alternative: 'Mitre joint aluminium mengandalkan sealant yang dapat getas oleh garam laut dan memicu rembes air.',
      fits_who: [
        'Hunian di wilayah pesisir atau pulau dengan kadar garam udara tinggi',
        'Fasad sudut atas yang menerima terpaan angin monsoon dan tempias langsung'
      ],
      does_not_fit_who: [
        'Bukaan bentang sangat masif tanpa ruang untuk penampang profil tebal'
      ],
      critical_tradeoffs: [
        {
          aspect: 'Bobot Kusen',
          compromise: 'Bobot lebih berat menuntut perkuatan dynabolt dan struktur dinding opening yang kokoh.',
          mitigation_tip: 'Pastikan dinding opening diplester aci rapi dan gunakan sekrup jangkar galvanis anti-karat.'
        }
      ],
      pivot_conditions: [
        {
          trigger_condition: 'Jika aluminium menggunakan spesifikasi anodized marine-grade minimal 20 mikron dengan sealant polyurathene profesional',
          pivots_to_solution_id: 'sol_aluminium_standar',
          rationale: 'Proteksi anodized tebal mengatasi risiko korosi garam pesisir.'
        }
      ],
      next_practical_actions: [
        {
          order: 1,
          action_title: 'Verifikasi Sistem Lubang Air (Weep Holes)',
          description: 'Pastikan profil kusen memiliki lubang drainase air hujan dengan katup penutup searah (weep hole covers).'
        }
      ],
      evidence_bindings: [
        createArt5Binding(
          'VERIFIED_FACT',
          'uPVC tahan terhadap garam udara pesisir dan sambungan sudut fusi mengeliminasi celah rembesan.',
          'Pertimbangan Pemilihan Sistem Berdasarkan Kondisi Ruang'
        )
      ]
    }
  },

  // --- SCENARIO 4: Tight budget standard renovation ---
  {
    scenario_id: 'scen_tight_budget_standard_renovation',
    title: 'Renovasi Rumah Tapak dengan Anggaran Terbatas',
    context: {
      problem_goal: 'Mengganti kusen kayu lama yang keropos dengan biaya awal hemat dan material anti-rayap',
      building_context: 'SINGLE_STORY_HOUSE',
      climate_exposure: 'STANDARD_TROPICAL_SHELTERED',
      application_location: 'LIVING_COMMON_AREA',
      budget_class: 'TIGHT_CONSTRAINED',
      maintenance_tolerance: 'PERIODIC_LIGHT_MAINTENANCE'
    },
    expected_recommendation: {
      recommended_solution_id: 'sol_aluminium_standar',
      recommended_fit: 'GOOD_FIT_WITH_TRADEOFF',
      why_recommended: 'Aluminium standar memiliki ketersediaan profil dan aplikator luas dengan biaya awal paling rasional untuk menggantikan kusen kayu.',
      alternative_solution_id: 'sol_upvc_multi_chamber',
      alternative_fit: 'CONDITIONAL_FIT',
      why_not_alternative: 'uPVC multi-chamber berkualitas memiliki investasi awal yang lebih tinggi melampaui alokasi dana renovasi hemat.',
      fits_who: [
        'Renovasi rumah huni dengan anggaran bertahap / rumah tumbuh',
        'Bukaan standar terlindung kanopi atau atap tritisan'
      ],
      does_not_fit_who: [
        'Kamar tidur yang menghadap panas barat ekstrem tanpa peneduh'
      ],
      critical_tradeoffs: [
        {
          aspect: 'Perawatan Berkala Sealant',
          compromise: 'Sealant karet perimeter dan sambungan mitre perlu dicek elastisitasnya setiap 2–3 tahun.',
          mitigation_tip: 'Gunakan sealant silikon netral berkualitas arsitektural saat pemasangan awal.'
        }
      ],
      pivot_conditions: [
        {
          trigger_condition: 'Jika anggaran renovasi ditingkatkan atau dialokasikan khusus untuk kamar tidur ber-AC',
          pivots_to_solution_id: 'sol_upvc_multi_chamber',
          rationale: 'Efisiensi listrik AC jangka panjang dari isolasi uPVC mulai menjustifikasi selisih biaya awal.'
        }
      ],
      next_practical_actions: [
        {
          order: 1,
          action_title: 'Pilih Profil Aluminium Ketebalan Minimal 1.15–1.3 mm',
          description: 'Hindari profil aluminium tipis (di bawah 1.0 mm) yang rawan penyok dan melengkung saat disekrup.'
        }
      ],
      evidence_bindings: [
        createArt5Binding(
          'TECHNICAL_CONSENSUS',
          'Aluminium standar adalah opsi ekonomis anti-rayap jika dipasang dengan ketebalan memadai.',
          'Verdict RancangLoka'
        )
      ]
    }
  },

  // --- SCENARIO 5: Low-maintenance family home ---
  {
    scenario_id: 'scen_low_maintenance_family_home',
    title: 'Rumah Keluarga Bebas Perawatan Jangka Panjang',
    context: {
      problem_goal: 'Pintu dan jendela awet yang tidak memerlukan pengecatan ulang atau perbaikan rutin',
      building_context: 'MULTI_STORY_HOUSE',
      climate_exposure: 'WIND_DRIVEN_RAIN',
      application_location: 'LIVING_COMMON_AREA',
      budget_class: 'BALANCED_MID',
      maintenance_tolerance: 'FIT_AND_FORGET'
    },
    expected_recommendation: {
      recommended_solution_id: 'sol_upvc_multi_chamber',
      recommended_fit: 'GOOD_FIT_WITH_TRADEOFF',
      why_recommended: 'Warna material terintegrasi dalam massa polimer (bukan sekadar lapisan cat luar) dan sudut las menyatu meminimalkan risiko servis berkala.',
      alternative_solution_id: 'sol_aluminium_standar',
      alternative_fit: 'GOOD_FIT_WITH_TRADEOFF',
      why_not_alternative: 'Lapisan powder coat aluminium dapat tergores dan sambungan mekanikal memerlukan pengecekan sealant jika terpapar cuaca langsung.',
      fits_who: [
        'Keluarga yang menginginkan konsep fit & forget tanpa rutinitas servis berkala',
        'Area rumah dengan paparan hujan sering yang rawan rembes pada sudut'
      ],
      does_not_fit_who: [
        'Pintu lipat berdimensi sangat lebar yang menuntut profil super ramping'
      ],
      critical_tradeoffs: [
        {
          aspect: 'Sensitivitas Paparan Panas Ekstrem',
          compromise: 'uPVC memerlukan toleransi celah ekspansi perimeter agar tidak mengalami distorsi saat terpapar sinar matahari terik.',
          mitigation_tip: 'Pastikan pemasang tidak menyetel kusen terlalu pas tanpa celah muai.'
        }
      ],
      pivot_conditions: [
        {
          trigger_condition: 'Jika desain fasad menuntut pilihan warna kustom metalik arsitektural (anodized bronze, champagne, dll.)',
          pivots_to_solution_id: 'sol_aluminium_standar',
          rationale: 'Variasi warna anodized dan powder coat aluminium jauh lebih kaya dibanding uPVC yang dominan putih/cokelat/hitam.'
        }
      ],
      next_practical_actions: [
        {
          order: 1,
          action_title: 'Periksa Sertifikasi Garansi Profil',
          description: 'Minta kartu garansi resmi dari produsen profil (minimal 10 tahun untuk ketahanan warna dan kelengkungan).'
        }
      ],
      evidence_bindings: [
        createArt5Binding(
          'TECHNICAL_CONSENSUS',
          'Kedua material menawarkan ketahanan tinggi dibanding kayu, dengan uPVC unggul pada integrasi sambungan sudut.',
          'Catatan Kritis Kusen uPVC'
        )
      ]
    }
  }
];

// ============================================================================
// 5. ASSEMBLE COMPLETE PILOT DEFINITION & COMPUTE SNAPSHOT HASH
// ============================================================================

const allPilotBindings: EvidenceBinding[] = [];
EVALUATIONS_PILOT.forEach(e => allPilotBindings.push(e.evidence_binding));
SOLUTION_CLASSES_PILOT.forEach(s => s.tradeoffs.forEach(t => allPilotBindings.push(t.evidence_binding)));
SCENARIOS_PILOT.forEach(sc => sc.expected_recommendation.evidence_bindings.forEach(eb => allPilotBindings.push(eb)));

/**
 * Calculated deterministic evidence snapshot hash for Article 5 Pilot.
 */
export const PILOT_EVIDENCE_SNAPSHOT_HASH = computeEvidenceSnapshotHash(allPilotBindings);

/**
 * Master Decision Model Definition: Article 5 Pilot
 */
export const DECISION_MODEL_PILOT_KUSEN: DecisionModelDefinition = Object.freeze({
  model_id: 'model_pde_kusen_tropis',
  model_version: 'v1.0.0',
  criteria_version: 'crit_kusen_v1',
  problem: Object.freeze({
    problem_id: 'dp_kusen_jendela_tropis',
    canonical_slug: 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
    title: 'Pemilihan Material Kusen Jendela untuk Rumah Tropis di Indonesia',
    description: 'Panduan keputusan objektif berbasis fisika material dan iklim mikro hunian untuk memilih antara kusen Aluminium arsitektural dan uPVC multi-chamber.',
    primary_article_id: 5
  }),
  solution_classes: Object.freeze(SOLUTION_CLASSES_PILOT),
  criteria: Object.freeze(CRITERIA_PILOT),
  evaluations: Object.freeze(EVALUATIONS_PILOT),
  constraints: Object.freeze(CONSTRAINTS_PILOT),
  scenarios: Object.freeze(SCENARIOS_PILOT),
  evidence_snapshot_hash: PILOT_EVIDENCE_SNAPSHOT_HASH
});
