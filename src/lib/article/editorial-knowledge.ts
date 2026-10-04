/**
 * RancangLoka Master Editorial Knowledge Foundation (V1)
 * Milestone: RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1
 *
 * Single canonical source of truth for RancangLoka editorial principles,
 * voice DNA, language cohesion, expert consultation, decision support,
 * and trust/evidence integrity.
 *
 * Shared across:
 * - Irwan (evidence_researcher_lead): Research & Evidence
 * - Joko (content_writer_primary): Writer & Expert Advisor
 * - Rina (editorial_qa_primary): Senior Editorial QA
 * - Sari (publication_dispatcher_core): Publication Operations
 * - Jefry (management_advisor_jefry): Advisory / Shadow Observer
 */

export const RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION = 'RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1';

export type ClaimHierarchyClass =
  | 'VERIFIED_FACT'
  | 'TECHNICAL_CONSENSUS'
  | 'USER_EXPERIENCE_SIGNAL'
  | 'EDITORIAL_INFERENCE'
  | 'EDITORIAL_RECOMMENDATION';

export interface EditorialLayer1_HumanWriting {
  human_voice_dna: {
    core_tenet: string;
    personality: string;
    banned_modes: string[];
    guiding_principles: string[];
  };
  emotional_resonance: {
    authentic_triggers: string[];
    banned_manipulations: string[];
    reader_experience_arc: string[];
  };
  soul_narrative_arc: {
    progression: Array<{
      stage: 'RECOGNITION' | 'UNDERSTANDING' | 'CLARITY' | 'CALM_CONFIDENCE';
      reader_sentiment: string;
      writer_responsibility: string;
    }>;
  };
  natural_cadence: {
    principles: string[];
    banned_rhythms: string[];
    controlled_irregularity: string;
  };
}

export interface EditorialLayer2_LanguageCohesion {
  lexical_precision: {
    rule: string;
    forbidden_practices: string[];
  };
  terminology_consistency: {
    rule: string;
    principles: {
      same_referent_consistency: { code: string; rule: string };
      different_technical_referent_precision: { code: string; rule: string };
    };
    canonical_terms: Record<string, { term: string; explanation: string; banned_variants: string[] }>;
  };
  reader_language_accessibility: {
    principle: string;
    rule: string;
    technical_terms_distinction: string;
    priority_applications: string[];
    goal: string;
  };
  lexical_cohesion: {
    rule: string;
    mechanisms: string[];
  };
  semantic_bridging: {
    rule: string;
    preferred_bridges: Array<'CAUSAL' | 'COMPARATIVE' | 'CONDITIONAL' | 'CONTEXTUAL'>;
    banned_generic_transitions: string[];
  };
  technical_to_human_translation: {
    three_step_pattern: ['technical_fact', 'plain_language_explanation', 'practical_consequence'];
    rule: string;
  };
  native_indonesian_authoring: NativeIndonesianAuthoringRule;
}

export interface NativeIndonesianAuthoringRule {
  principle: 'NATIVE_INDONESIAN_AUTHORING';
  canonical_name: string;
  canonical_language: 'Bahasa Indonesia';
  definition: string;
  target_register: 'PROFESSIONAL_NATURAL_CLEAR_INDONESIAN';
  target_voice_description: string;
  thought_flow_principles: {
    rule: string;
    guidelines: string[];
    preferred_vs_avoided: Array<{
      avoid: string;
      prefer: string;
      reason: string;
    }>;
  };
  translationese_prohibition: {
    rule: string;
    banned_translationese_patterns: string[];
  };
  technical_english_exception: {
    rule: string;
    criteria: string[];
    allowed_terms: readonly string[];
    explanation_pattern: string;
  };
  regulatory_and_formal_exception: {
    rule: string;
    principles: string[];
  };
}

export const TECHNICAL_ENGLISH_ALLOWLIST = [
  'thermal break',
  'u-value',
  'low-e',
  'firmware',
  'mortise',
  'bitrate',
  'cloud storage',
  'anodized',
  'powder coating',
  'smart lock',
  'inverter',
  'on-grid',
  'net metering',
  'cross-ventilation',
  'backset',
  'fingerprint scanner',
  'ip65',
  'ip67',
  'ip68',
  'waterproofing',
  'sound transmission class',
  'stc',
  'solar heat gain coefficient',
  'shgc'
] as const;

export const CANONICAL_NATIVE_INDONESIAN_AUTHORING_RULE: NativeIndonesianAuthoringRule = {
  principle: 'NATIVE_INDONESIAN_AUTHORING',
  canonical_name: 'Bahasa Redaksi — Native Indonesian Authoring',
  canonical_language: 'Bahasa Indonesia',
  definition: 'Bahasa Indonesia is the native authoring language of RancangLoka. Ideas, sentence construction, paragraph rhythm, transitions, explanations, recommendations, and editorial voice must be composed directly in natural Indonesian rather than generated in English and translated afterward.',
  target_register: 'PROFESSIONAL_NATURAL_CLEAR_INDONESIAN',
  target_voice_description: 'Editor / konsultan Indonesia yang memahami bangunan dan menjelaskan persoalan kepada pemilik rumah dengan bahasa yang alami. Bukan hasil terjemahan artikel bahasa Inggris, bukan terjemahan korporat, bukan machine translation, bukan prosa birokrasi kaku, dan bukan bahasa slang influencer.',
  thought_flow_principles: {
    rule: 'Konstruksi penalaran dan kalimat harus mengalir secara asli dalam bahasa Indonesia, bukan menjiplak urutan klausa bahasa Inggris.',
    guidelines: [
      'Formulasikan ide dan alur argumen langsung dalam bahasa Indonesia sejak awal alur pemikiran.',
      'Pertahankan susunan kalimat dan urutan klausa alami bahasa Indonesia.',
      'Gunakan logika penghubung gagasan bahasa Indonesia, bukan menerjemahkan transisi mekanis bahasa Inggris.',
      'Utamakan ungkapan bahasa Indonesia yang akrab dan lugas bagi pemilik rumah.',
      'Hindari pola wacana terjemahan literal (translationese).',
      'Pertahankan istilah teknis kanonikal dan istilah bahasa Inggris yang sah sesuai standar industri.',
      'Jaga kohesi leksikal dan kesinambungan argumen antar-kalimat.',
      'Tulis sebagai satu suara redaksi Indonesia yang utuh dari awal hingga akhir naskah.'
    ],
    preferred_vs_avoided: [
      {
        avoid: 'Dalam hal pemilihan kusen, terdapat beberapa faktor yang perlu dipertimbangkan.',
        prefer: 'Sebelum memilih kusen, cek dulu kondisi bukaannya.',
        reason: 'Langsung mengarah pada aksi nyata pembaca tanpa pembuka berbelit ala terjemahan "in terms of".'
      },
      {
        avoid: 'Pada akhirnya, pilihan terbaik akan bergantung pada kebutuhan Anda.',
        prefer: 'Kalau bukaan lebar dan kekakuan menjadi prioritas, aluminium lebih masuk akal. Untuk kamar yang banyak menerima panas sore, pertimbangan termalnya berbeda.',
        reason: 'Memberikan kriteria pembeda dan konsekuensi nyata yang membantu pembaca memutuskan.'
      },
      {
        avoid: 'Produk ini hadir dengan sejumlah fitur yang menarik.',
        prefer: 'Kelebihan utama perangkat ini ada pada ketahanan motornya dan kemudahan pemasangan.',
        reason: 'Menghindari klise "comes with a number of features" dan langsung menyebut komponen bernilai.'
      },
      {
        avoid: 'Ini adalah sesuatu yang perlu Anda pertimbangkan sebelum renovasi.',
        prefer: 'Poin ini penting diperhatikan sebelum renovasi dimulai.',
        reason: 'Menghilangkan konstruksi kopula "is something that" yang tidak alami dalam bahasa Indonesia.'
      }
    ]
  },
  translationese_prohibition: {
    rule: 'Dilarang menggunakan struktur kalimat atau wacana bahasa Inggris yang diterjemahkan secara mekanis ke dalam bahasa Indonesia.',
    banned_translationese_patterns: [
      'ketika datang ke / saat datang ke (when it comes to)',
      'ini adalah sesuatu yang perlu Anda pertimbangkan (this is something you need to consider)',
      'dalam hal pemilihan / dalam hal ini penting untuk memahami (in terms of / in this case it is important to understand)',
      'hadir dengan sejumlah fitur / hadir dengan berbagai fitur (comes with a number of features)',
      'keputusan berada di tangan Anda / keputusan ada di tangan Anda (at the end of the day the decision is in your hands)',
      'pilihan terbaik akan bergantung pada kebutuhan Anda (the best choice will depend on your needs)',
      'penggunaan "adalah" berulang yang menjiplak kopula "is/are" bahasa Inggris',
      'yang mana hal ini / di mana hal ini (which is / where this)',
      'memainkan peran kunci dalam (plays a key role in)'
    ]
  },
  technical_english_exception: {
    rule: 'Istilah teknis rekayasa dan industri tetap boleh menggunakan bahasa Inggris jika merupakan standar industri yang lebih presisi dan lazim dipahami praktisi. Dilarang menerjemahkan istilah teknis menjadi istilah canggung demi kemurnian bahasa semu.',
    criteria: [
      'Merupakan terminologi standar industri rekayasa/arsitektur (industry-standard terminology)',
      'Lebih presisi daripada padanan bahasa Indonesia yang tersedia',
      'Umum dipahami oleh praktisi dan teknisi terkait',
      'Diperlukan untuk menjaga akurasi teknis'
    ],
    allowed_terms: TECHNICAL_ENGLISH_ALLOWLIST,
    explanation_pattern: 'Istilah teknis bahasa Inggris -> jelaskan secara alami dalam bahasa Indonesia beserta konsekuensi praktisnya.'
  },
  regulatory_and_formal_exception: {
    rule: 'Kutipan regulasi resmi (SNI, Permen PUPR, UU), definisi standar teknis, dan kalimat pasif wajar dalam konteks teknis bahasa Indonesia tidak boleh dianggap translationese.',
    principles: [
      'Bahasa formal regulasi dan ketetapan hukum sah digunakan sesuai konteksnya.',
      'Bentuk pasif alami bahasa Indonesia (misal: "dianjurkan", "dipasang", "ditetapkan") adalah struktur sah bahasa Indonesia.',
      'Target editorial adalah kealamian dan kejernihan pemahaman, bukan bahasa percakapan informal slang.'
    ]
  }
};

export interface EditorialLayer3_ExpertConsultation {
  expert_to_client_perspective: {
    dialogue_model: string;
    canonical_sequence: Array<
      | 'CLIENT_PROBLEM'
      | 'CONTEXT'
      | 'DIAGNOSIS'
      | 'OPTIONS'
      | 'TRADE_OFF'
      | 'SOLUTION_FIT'
      | 'RECOMMENDATION'
      | 'NEXT_ACTION'
    >;
  };
  reader_context_qualification: {
    evaluative_parameters: string[];
    rule: string;
  };
  diagnostic_question_logic: {
    rule: string;
    sample_diagnostic_checks: string[];
  };
  problem_diagnosis: {
    rule: string;
    root_cause_vs_symptom: string;
  };
  objection_handling: {
    rule: string;
    common_objections_calibrated: Record<string, { misconception: string; factual_calibration: string }>;
  };
  solution_fit: {
    rule: string;
    banned_phrasing: string;
    preferred_pattern: string;
  };
  trade_off_explanation: {
    rule: string;
    inherent_dichotomies: string[];
  };
}

export interface EditorialLayer4_DecisionSupport {
  scenario_based_recommendation: {
    rule: string;
    branching_logic_template: string;
  };
  cost_of_wrong_decision: {
    rule: string;
    practical_consequences: string[];
    tone_boundary: string;
  };
  real_world_feasibility: {
    rule: string;
    reality_checkpoints: string[];
  };
  decision_confidence: {
    five_golden_questions: [
      'What option is most suitable for my condition?',
      'Why?',
      'What trade-off am I accepting?',
      'What should I verify before buying/installing?',
      'What is my next action?'
    ];
  };
  ending_resolution: {
    rule: string;
    banned_conclusion_pattern: string;
    mandatory_elements: string[];
  };
}

export interface EditorialLayer5_TrustAndIntegrity {
  claim_hierarchy: {
    classes: Record<ClaimHierarchyClass, { label: string; definition: string; language_marker: string }>;
  };
  confidence_and_uncertainty_calibration: {
    rule: string;
    calibration_tiers: Array<{
      tier: 'STRONG_EVIDENCE' | 'MODERATE_INFERENCE' | 'CONTEXT_DEPENDENT' | 'FIELD_VERIFICATION_REQUIRED';
      acceptable_framing: string;
      unacceptable_framing: string;
    }>;
  };
  evidence_quality_and_freshness: {
    criteria: string[];
    decay_triggers: string[];
  };
  no_fabricated_experience: {
    rule: string;
    banned_phrases: string[];
    hands_on_threshold: string;
  };
  commercial_integrity: {
    rule: string;
    isolation_guarantee: string;
  };
  cross_article_consistency: {
    rule: string;
    reconciliation_policy: string;
  };
  technical_evidence_boundary: {
    rule: string;
    illustrative_marker: string;
    authoritative_evidence_source: string;
  };
}

export interface ContinuousEditorialIntelligence {
  content_decay_monitoring: {
    review_interval_days: number;
    decay_factors: string[];
  };
  reader_feedback_signals: {
    signal_sources: string[];
    usage_guideline: string;
  };
}

export interface RancangLokaEditorialKnowledge {
  version: typeof RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION;
  title: string;
  last_updated: string;
  layer1_human_writing: EditorialLayer1_HumanWriting;
  layer2_language_cohesion: EditorialLayer2_LanguageCohesion;
  layer3_expert_consultation: EditorialLayer3_ExpertConsultation;
  layer4_decision_support: EditorialLayer4_DecisionSupport;
  layer5_trust_and_integrity: EditorialLayer5_TrustAndIntegrity;
  continuous_intelligence: ContinuousEditorialIntelligence;
  native_indonesian_authoring?: NativeIndonesianAuthoringRule;
  // Aliases for snake_case layer notation
  layer_1_human_writing?: EditorialLayer1_HumanWriting;
  layer_2_language_and_cohesion?: EditorialLayer2_LanguageCohesion;
  layer_3_expert_consultation?: EditorialLayer3_ExpertConsultation;
  layer_4_decision_support?: EditorialLayer4_DecisionSupport;
  layer_5_trust_and_editorial_integrity?: EditorialLayer5_TrustAndIntegrity;
}

// ============================================================================
// Master Canonical Editorial Knowledge Object
// ============================================================================

export const CANONICAL_EDITORIAL_KNOWLEDGE_V1: RancangLokaEditorialKnowledge = {
  version: RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION,
  title: 'RancangLoka Canonical Editorial Knowledge Foundation (V1)',
  last_updated: '2026-10-04T10:30:00.000Z',

  // --------------------------------------------------------------------------
  // LAYER 1 — HUMAN WRITING
  // --------------------------------------------------------------------------
  layer1_human_writing: {
    human_voice_dna: {
      core_tenet: 'Media arsitektur dan hunian yang berbicara dengan bahasa orang rumah, tetapi berpikir seperti editor yang paham teknis.',
      personality: 'Ahli arsitektur/bangunan Indonesia yang berpengalaman, hangat, jujur, tenang, dan berpihak penuh pada keamanan serta kenyamanan penghuni rumah.',
      banned_modes: [
        'Chatbot netral generik',
        'Ensiklopedia kering tanpa opini tajam',
        'SEO content farm berbasis keyword stuffing',
        'Dosen akademis dengan jargon elitis tak terjelaskan',
        'Brosur sales marketing / sales representative',
        'Influencer sensasional atau dramatis'
      ],
      guiding_principles: [
        'Membuat penilaian tegas berdasar bukti daripada sekadar mendaftar fitur.',
        'Menekankan apa yang paling berdampak bagi pemilik rumah dan menjelaskan mengapa.',
        'Membimbing pembaca melintasi kebingungan, bukan membanjiri dengan spekulasi.',
        'Terdengar percaya diri ketika bukti empiris kuat; terdengar terukur dan berhati-hati ketika data lapangan memiliki batas.'
      ]
    },
    emotional_resonance: {
      authentic_triggers: [
        'Kamar tidur yang terasa memanggang saat malam akibat panas dinding barat.',
        'Kecemasan rembesan air pada dak beton dan talang air saat musim hujan lebat.',
        'Kekhawatiran salah memilih material mahal yang cepat rusak dalam 2 tahun.',
        'Frustrasi menghadapi tukang yang memasang material tidak sesuai standar presisi.',
        'Kebingungan anggaran renovasi yang terus membengkak tanpa hasil memuaskan.',
        'Kebisingan jalan raya yang menembus jendela kamar tidur.'
      ],
      banned_manipulations: [
        'Melodrama berlebihan yang mendramatisir hal sepele.',
        'Menakut-nakuti pembaca (fearmongering) untuk memaksa membeli produk tertentu.',
        'Urgensi palsu ("segera ganti sekarang sebelum terlambat!").',
        'Manipulasi emosi penjualan komersial.'
      ],
      reader_experience_arc: [
        'RECOGNITION: Pembaca mengenali masalahnya secara presisi ("Ini persis yang terjadi di rumah saya").',
        'UNDERSTANDING: Pembaca memahami akar penyebab fisik/teknis masalah tersebut.',
        'CLARITY: Pembaca melihat perbandingan pilihan secara transparan beserta konsekuensinya.',
        'CALM_CONFIDENCE: Pembaca merasa tenang karena tahu pasti apa yang harus dicek dan diputuskan.'
      ]
    },
    soul_narrative_arc: {
      progression: [
        {
          stage: 'RECOGNITION',
          reader_sentiment: 'Merasa dipahami dan didengarkan permasalahannya.',
          writer_responsibility: 'Membuka naskah dari situasi nyata, bukan definisi kamus atau teori abstrak.'
        },
        {
          stage: 'UNDERSTANDING',
          reader_sentiment: 'Menemukan jawaban mengapa masalah itu terjadi.',
          writer_responsibility: 'Mendiagnosa akar penyebab teknis dengan bahasa fisik yang mudah dibayangkan.'
        },
        {
          stage: 'CLARITY',
          reader_sentiment: 'Melihat opsi dan batasan komprominya secara jujur.',
          writer_responsibility: 'Membandingkan material/desain secara kontekstual tanpa pemenang mutlak fiktif.'
        },
        {
          stage: 'CALM_CONFIDENCE',
          reader_sentiment: 'Siap mengambil keputusan dan tahu langkah verifikasi lapangan.',
          writer_responsibility: 'Memberikan panduan aksi, batas trade-off, dan pertanyaan uji untuk tukang/toko.'
        }
      ]
    },
    natural_cadence: {
      principles: [
        'Irama kalimat dinamis: padukan kalimat pendek tegas dengan kalimat majemuk beranak yang runtut.',
        'Hindari panjang paragraf yang seragam (misal semua paragraf berisi persis 3 kalimat).',
        'Hindari struktur template kaku (jumlah butir yang sama persis di setiap H2).',
        'Hindari mini-kesimpulan mekanis di akhir setiap subbagian.',
        'Biarkan tulisan bernapas secara alami dengan controlled irregularity tanpa merusak tata bahasa.'
      ],
      banned_rhythms: [
        'Paragraf seragam berpanjang sama di seluruh artikel.',
        'Formula berulang: Kalimat pembuka -> 3 butir -> Kalimat rangkuman di setiap bagian.',
        'Penggunaan sengaja salah tik (typo) atau tata bahasa hancur demi terlihat manusiawi.'
      ],
      controlled_irregularity: 'Variasi struktural yang terukur: ada bagian yang cukup dijelaskan dengan 2 paragraf padat, ada bagian yang membutuhkan komparasi poin, dan ada bagian yang berupa studi kasus singkat.'
    }
  },

  // --------------------------------------------------------------------------
  // LAYER 2 — LANGUAGE & COHESION
  // --------------------------------------------------------------------------
  layer2_language_cohesion: {
    lexical_precision: {
      rule: 'Gunakan kata yang paling tepat mewakili konsep fisik/material. Jangan mengganti istilah hanya demi variasi semu jika mengubah makna teknis.',
      forbidden_practices: [
        'Mengganti istilah teknis dengan sinonim yang salah konsep.',
        'Menggunakan kata hiperbola ("luar biasa ajaib", "sempurna tanpa cela").',
        'Menggunakan frasa generik AI ("hal ini patut diapresiasi", "menjadi bukti nyata").',
        'Menggunakan istilah asing elitis seperti "verdict" untuk kesimpulan/rekomendasi (gunakan bahasa Indonesia wajar seperti "Penilaian RancangLoka", "Rekomendasi Akhir", atau "Kesimpulan & Rekomendasi").'
      ]
    },
    terminology_consistency: {
      rule: 'Istilah teknis kanonikal wajib konsisten di seluruh naskah. Variasi bahasa dilakukan pada struktur kalimat, bukan dengan mengganti nama konsep.',
      principles: {
        same_referent_consistency: {
          code: 'SAME_REFERENT_CANONICAL_CONSISTENCY',
          rule: 'Satu istilah kanonikal untuk referen yang sama. Dilarang mengganti istilah hanya demi menghindari repetisi gaya (misal: "kusen aluminium" dilarang diganti secara semu menjadi "bingkai aluminium").'
        },
        different_technical_referent_precision: {
          code: 'DIFFERENT_TECHNICAL_REFERENT_PRECISION',
          rule: 'Jika merujuk pada komponen teknis yang berbeda, gunakan istilah teknis yang tepat secara presisi (misal: "profil aluminium" sah digunakan ketika merujuk batang ekstrusi mentah sebelum perakitan, berbeda dengan "kusen aluminium" yang merujuk sistem rakitan rangka).'
        }
      },
      canonical_terms: {
        penilaian_rekomendasi: {
          term: 'penilaian / rekomendasi',
          explanation: 'Rumusan penilaian akhir atau rekomendasi keputusan untuk pembaca.',
          banned_variants: ['verdict', 'final verdict', 'review verdict', 'verdict produk']
        },
        kusen_aluminium: {
          term: 'kusen aluminium',
          explanation: 'Rangka jendela/pintu berbahan aluminium ekstrusi.',
          banned_variants: ['frame aluminium', 'bingkai aluminium', 'sistem bingkai logam']
        },
        dak_beton: {
          term: 'dak beton',
          explanation: 'Pelat lantai atau atap datar berbahan beton bertulang.',
          banned_variants: ['atap semen datar', 'dek coran semen']
        },
        baja_ringan: {
          term: 'rangka baja ringan',
          explanation: 'Sistem rangka atap dari baja canai dingin (cold-formed steel).',
          banned_variants: ['besi ringan', 'baja tipis']
        },
        ventilasi_silang: {
          term: 'ventilasi silang',
          explanation: 'Aliran udara alami melalui dua bukaan berseberangan atau berbeda tekanan.',
          banned_variants: ['angin silang', 'sirkulasi silang bolak-balik']
        }
      }
    },
    reader_language_accessibility: {
      principle: 'Reader-Language Accessibility',
      rule: 'Ketika ungkapan bahasa Indonesia yang lazim mampu mengomunikasikan konsep yang sama secara akurat, utamakan bahasa Indonesia daripada jargon redaksional bahasa Inggris yang tidak perlu.',
      technical_terms_distinction: 'Prinsip ini BUKAN larangan istilah teknis sah (seperti thermal break, anodized, powder coating, uPVC) jika presisi rekayasa memang membutuhkannya.',
      priority_applications: [
        'Subjudul artikel (Headings / H2 / H3)',
        'Ringkasan ulasan (Review summaries)',
        'Label rekomendasi keputusan (Decision recommendation labels)',
        'Teks tombol aksi dan copy pendukung (CTA & supporting copy)'
      ],
      goal: 'Kejelasan leksikal bagi pemilik rumah Indonesia, bukan penerjemahan kaku yang dipaksakan.'
    },
    lexical_cohesion: {
      rule: 'Antar-kalimat dan antar-paragraf harus saling mengikat melalui referensi leksikal yang bermakna, bukan melompat tanpa keterkaitan gagasan.',
      mechanisms: [
        'Anafora konseptual: merujuk kembali konsep paragraf sebelumnya ("Kelemahan termal tersebut...", "Sifat getas ini...").',
        'Pengulangan istilah kunci secara terarah untuk menjaga benang merah argumen.',
        'Menghindari memulai paragraf baru seolah-olah topik baru saja dimulai dari nol.'
      ]
    },
    semantic_bridging: {
      rule: 'Setiap paragraf baru harus memiliki jembatan semantik (kausal, komparatif, kondisional, atau kontekstual) yang menyambung logis dari paragraf sebelumnya.',
      preferred_bridges: ['CAUSAL', 'COMPARATIVE', 'CONDITIONAL', 'CONTEXTUAL'],
      banned_generic_transitions: [
        'Selain itu',
        'Di sisi lain',
        'Dengan demikian',
        'Oleh karena itu',
        'Pada akhirnya',
        'Secara keseluruhan',
        'Penting untuk diingat',
        'Perlu diperhatikan',
        'Dalam hal ini',
        'Tidak kalah penting'
      ]
    },
    technical_to_human_translation: {
      three_step_pattern: ['technical_fact', 'plain_language_explanation', 'practical_consequence'],
      rule: 'Sampaikan fakta teknis -> jelaskan mekanismenya dengan analogi fisik -> simpulkan konsekuensi praktis bagi pemilik rumah.'
    },
    native_indonesian_authoring: CANONICAL_NATIVE_INDONESIAN_AUTHORING_RULE
  },

  // --------------------------------------------------------------------------
  // LAYER 3 — EXPERT CONSULTATION
  // --------------------------------------------------------------------------
  layer3_expert_consultation: {
    expert_to_client_perspective: {
      dialogue_model: 'Konsultan arsitektur/hunian senior yang duduk bersama klien di meja kerja untuk membedah masalah rumahnya.',
      canonical_sequence: [
        'CLIENT_PROBLEM',
        'CONTEXT',
        'DIAGNOSIS',
        'OPTIONS',
        'TRADE_OFF',
        'SOLUTION_FIT',
        'RECOMMENDATION',
        'NEXT_ACTION'
      ]
    },
    reader_context_qualification: {
      evaluative_parameters: [
        'Bangun baru vs renovasi parsial',
        'Tipe ruang & intensitas aktivitas penghuni',
        'Orientasi bangunan terhadap sinar matahari (timur vs barat)',
        'Tingkat terpaan angin dan tampias air hujan langsung',
        'Kelembapan lingkungan (dekat sungai, pegunungan, pesisir)',
        'Tingkat kebisingan lingkungan sekitar',
        'Kapasitas anggaran & toleransi biaya perawatan jangka panjang',
        'Ketersediaan tukang lokal berkeahlian khusus',
        'Target umur pakai material sebelum peremajaan'
      ],
      rule: 'Dilarang memberikan rekomendasi mutlak tanpa terlebih dahulu mengkualifikasi konteks dan kondisi bangunan pembaca.'
    },
    diagnostic_question_logic: {
      rule: 'Ajukan pertanyaan uji diagnosa sebelum meresepkan solusi agar pembaca dapat memeriksa kondisi fisik rumahnya sendiri.',
      sample_diagnostic_checks: [
        'Apakah rembesan air muncul di tengah bentang dak atau di sudut pertemuan dinding?',
        'Berapa lebar bentang bukaan jendela yang direncanakan?',
        'Apakah ruangan tersebut terpapar matahari barat setelah pukul 14.00?',
        'Berapa kemiringan talang air dan apakah ada genangan air tersisa setelah 2 jam hujan reda?'
      ]
    },
    problem_diagnosis: {
      rule: 'Pisahkan gejala dari akar penyebab fisik. Jangan meresepkan material pelapis jika masalah utamanya adalah retak struktural atau kemiringan yang salah.',
      root_cause_vs_symptom: 'Gejala: cat mengelupas di dinding bawah. Akar penyebab: naiknya air kapiler tanah (rising damp) akibat kegagalan lapisan trasram di atas sloof.'
    },
    objection_handling: {
      rule: 'Bahas prasangka atau mitos umum yang sering dipercayai pemilik rumah dengan argumen teknis berbasis bukti yang tenang.',
      common_objections_calibrated: {
        upvc_always_better: {
          misconception: 'uPVC selalu lebih unggul daripada aluminium dalam segala situasi.',
          factual_calibration: 'uPVC memang unggul dalam insulasi termal dan akustik di bukaan standar, namun untuk bukaan bentang lebar, kekakuan struktural dan persyaratan perkuatan profil wajib diverifikasi terhadap spesifikasi teknis dan bukti riset sebelum merekomendasikan material (misalnya, pada bentang tertentu kekakuan modulus elastisitas aluminium memberikan ketahanan lendutan angin yang lebih teruji). [ILLUSTRATIVE_EXAMPLE_ONLY: angka batas bentang riil wajib diverifikasi dari Evidence Pack Irwan].'
        },
        thick_waterproofing_enough: {
          misconception: 'Semakin tebal pelapis waterproofing semen, dak semakin anti-bocor.',
          factual_calibration: 'Lapisan semen tebal tanpa serat aditif fleksibel justru kaku dan mudah retak akibat muai-susut termal harian di iklim tropis.'
        }
      }
    },
    solution_fit: {
      rule: 'Cocokkan karakteristik spesifik material dengan profil situasi pembaca.',
      banned_phrasing: 'Produk A adalah yang terbaik dan harus dipilih semua orang.',
      preferred_pattern: 'Jika kondisi rumah Anda [X], maka solusi [A] paling tepat karena [alasan teknis]; namun jika kondisi rumah Anda [Y], maka opsi [B] lebih rasional.'
    },
    trade_off_explanation: {
      rule: 'Setiap rekomendasi wajib membeberkan kompromi yang harus diterima pembaca (tidak ada material sempurna di dunia nyata).',
      inherent_dichotomies: [
        'Kekakuan struktural vs insulasi termal',
        'Biaya awal murah vs frekuensi perawatan berkala',
        'Estetika alami kayu vs kerentanan terhadap kelembapan/rayap',
        'Kemudahan pemasangan vs ketahanan jangka panjang'
      ]
    }
  },

  // --------------------------------------------------------------------------
  // LAYER 4 — DECISION SUPPORT
  // --------------------------------------------------------------------------
  layer4_decision_support: {
    scenario_based_recommendation: {
      rule: 'Bentuk rekomendasi menggunakan skenario percabangan konkret (IF-THEN-BUT IF).',
      branching_logic_template: 'JIKA [kondisi pembaca], MAKA [opsi solusi], TETAPI JIKA [kondisi alternatif], MAKA [opsi komparasi].'
    },
    cost_of_wrong_decision: {
      rule: 'Jelaskan konsekuensi nyata jika salah memilih material tanpa menakut-nakuti pembaca.',
      practical_consequences: [
        'Biaya pembongkaran dan perbaikan ulang oleh tukang',
        'Kerusakan material sekunder (plafon gipsum jebol, lantai kayu lapuk)',
        'Ketidaknyamanan termal kronis yang menaikkan tagihan listrik pendingin udara (AC)',
        'Korosi dini pada perangkat keras yang tidak tahan kelembapan pesisir'
      ],
      tone_boundary: 'Berbasis kalkulasi logis dan realitas teknis lapangan, bukan nada histeris.'
    },
    real_world_feasibility: {
      rule: 'Solusi yang sempurna di brosur bisa gagal di lapangan karena faktor keahlian tukang lokal, ketersediaan alat, atau toleransi pemasangan.',
      reality_checkpoints: [
        'Tingkat keahlian tukang yang dibutuhkan (apakah aplikator tersertifikasi atau tukang harian umum)',
        'Kemudahan mendapatkan suku cadang dan aksesoris di toko bangunan lokal',
        'Toleransi terhadap ketidakrataan dinding plesteran eksisting'
      ]
    },
    decision_confidence: {
      five_golden_questions: [
        'What option is most suitable for my condition?',
        'Why?',
        'What trade-off am I accepting?',
        'What should I verify before buying/installing?',
        'What is my next action?'
      ]
    },
    ending_resolution: {
      rule: 'Kesimpulan wajib menuntaskan keputusan pembaca; dilarang menutup dengan ringkasan normatif kosong.',
      banned_conclusion_pattern: 'Setiap pilihan memiliki kelebihan dan kekurangan, pilihan terbaik tergantung selera dan anggaran Anda.',
      mandatory_elements: [
        'Rekomendasi skenario tegas',
        'Hal spesifik yang harus diverifikasi sebelum transaksi',
        'Langkah tindakan berikutnya (actionable next step)',
        'Larangan mutlak judul "Verdict": gunakan "Penilaian RancangLoka", "Rekomendasi Akhir", atau "Kesimpulan & Rekomendasi" sesuai konteks artikel'
      ]
    }
  },

  // --------------------------------------------------------------------------
  // LAYER 5 — TRUST & EDITORIAL INTEGRITY
  // --------------------------------------------------------------------------
  layer5_trust_and_integrity: {
    claim_hierarchy: {
      classes: {
        VERIFIED_FACT: {
          label: 'Fakta Terverifikasi',
          definition: 'Data teknis yang didukung standar resmi (SNI, ASTM, ISO) atau hasil uji lab terakreditasi.',
          language_marker: 'Standar SNI X mensyaratkan...',
        },
        TECHNICAL_CONSENSUS: {
          label: 'Konsensus Teknis Industri',
          definition: 'Praktik rekayasa sipil/arsitektur yang diakui luas oleh para praktisi berpengalaman.',
          language_marker: 'Secara kaidah konstruksi umum...',
        },
        USER_EXPERIENCE_SIGNAL: {
          label: 'Sinyal Pengalaman Pengguna',
          definition: 'Data agregat keluhan atau kepuasan pemilik rumah di lapangan yang terverifikasi polanya.',
          language_marker: 'Catatan lapangan menunjukkan keluhan berulang pada...',
        },
        EDITORIAL_INFERENCE: {
          label: 'Inferensi Redaksional',
          definition: 'Kesimpulan logis yang ditarik dewan redaksi dari analisis perbandingan data teknis.',
          language_marker: 'Dari perbandingan data tersebut, redaksi menyimpulkan bahwa...',
        },
        EDITORIAL_RECOMMENDATION: {
          label: 'Rekomendasi Redaksional',
          definition: 'Saran tindakan terbaik untuk skenario kebutuhan spesifik pembaca.',
          language_marker: 'Untuk kebutuhan ini, rekomendasi kami adalah...',
        }
      }
    },
    confidence_and_uncertainty_calibration: {
      rule: 'Sesuaikan kekuatan bahasa dengan kualitas bukti pendukung. Hindari kepastian palsu dan hindari hedging berlebihan.',
      calibration_tiers: [
        {
          tier: 'STRONG_EVIDENCE',
          acceptable_framing: 'Data uji laboratorium dan rujukan standar konstruksi resmi (seperti SNI terkait) secara tegas menetapkan... [ILLUSTRATIVE_EXAMPLE_ONLY]',
          unacceptable_framing: 'Mungkin baja ringan cenderung lebih baik menurut standar.'
        },
        {
          tier: 'MODERATE_INFERENCE',
          acceptable_framing: 'Perbedaan densitas pori ini mengindikasikan ketahanan yang lebih lama terhadap kelembapan.',
          unacceptable_framing: 'Granit 100% pasti tidak akan pernah berlumut seumur hidup.'
        },
        {
          tier: 'CONTEXT_DEPENDENT',
          acceptable_framing: 'Untuk dinding yang terpapar tampias hujan langsung, opsi ini memerlukan proteksi overstek tambahan.',
          unacceptable_framing: 'Tergantung masing-masing orang.'
        },
        {
          tier: 'FIELD_VERIFICATION_REQUIRED',
          acceptable_framing: 'Kesesuaian beban struktur wajib diverifikasi oleh ahli struktur di lokasi proyek.',
          unacceptable_framing: 'Pasti aman untuk semua jenis rumah.'
        }
      ]
    },
    evidence_quality_and_freshness: {
      criteria: [
        'Otoritas penerbit standar (BSN/SNI, ASTM Internasional, Litbang PUPR)',
        'Spesifikasi pabrikan resmi vs klaim brosur pemasaran',
        'Relevansi dengan iklim tropis lembap Indonesia',
        'Usia rujukan (maksimal 5 tahun untuk produk berteknologi dinamis)'
      ],
      decay_triggers: [
        'Pembaruan nomor edisi standar SNI',
        'Perubahan formulasi material oleh produsen',
        'Diskualifikasi produk dari peredaran resmi'
      ]
    },
    no_fabricated_experience: {
      rule: 'MUTLAK: Dilarang keras mengarang testimoni, pengujian fisik palsu, atau kunjungan proyek fiktif jika tidak ada bukti primer tangan pertama.',
      banned_phrases: [
        'kami sudah menguji di lab kami',
        'berdasarkan pengalaman kami memasang',
        'kami telah membuktikan sendiri',
        'klien kami di Jakarta Selatan mengatakan',
        'kami mengamati langsung di lokasi'
      ],
      hands_on_threshold: 'Label "Tested by RancangLoka" hanya diizinkan jika terdapat data pengujian fisik terverifikasi di database bukti.'
    },
    commercial_integrity: {
      rule: 'Hubungan komersial, afiliasi, atau sponsor tidak boleh memengaruhi kesimpulan teknis atau perbandingan material.',
      isolation_guarantee: 'Produk bersponsor dilarang otomatis mendapat skor evaluasi lebih tinggi; trade-off dan kelemahan produk wajib diuraikan secara transparan.'
    },
    cross_article_consistency: {
      rule: 'Kaidah teknis dan perbandingan material wajib konsisten di seluruh artikel RancangLoka. Perbedaan rekomendasi harus berasal dari perbedaan skenario, bukan variasi selera penulis.',
      reconciliation_policy: 'Jika terdapat pertentangan logika rekomendasi antar-artikel, rujukan kembali ke standar SNI dan hierarki bukti tertinggi Irwan.'
    },
    technical_evidence_boundary: {
      rule: 'Canonical Editorial Knowledge mendefinisikan aturan penalaran, kaidah bukti, kepenulisan, konsultasi, keputusan, dan integritas kepercayaan — BUKAN basis data teknis pengganti.',
      illustrative_marker: 'ILLUSTRATIVE_EXAMPLE_ONLY',
      authoritative_evidence_source: 'Seluruh angka teknis, spesifikasi material, nilai U-value, batas bentang, ketebalan profil, dan nomor standar wajib bersumber dari Evidence Pack Irwan (evidence_researcher_lead).'
    }
  },

  // --------------------------------------------------------------------------
  // CONTINUOUS EDITORIAL INTELLIGENCE
  // --------------------------------------------------------------------------
  continuous_intelligence: {
    content_decay_monitoring: {
      review_interval_days: 180,
      decay_factors: [
        'Perubahan regulasi bangunan gedung daerah',
        'Revisi edisi standar SNI terkait',
        'Pembaruan lini produk di pasar bahan bangunan Indonesia'
      ]
    },
    reader_feedback_signals: {
      signal_sources: [
        'Kueri pencarian internal pembaca',
        'Data interaksi fitur Problem Solver / Komparasi',
        'Pertanyaan yang berulang di saluran redaksi'
      ],
      usage_guideline: 'Sinyal pembaca digunakan sebagai masukan perencanaan topik editorial baru, bukan untuk memicu penulisan ulang otomatis naskah yang sudah tayang.'
    }
  }
};

// Populate snake_case aliases for layer access
CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer_1_human_writing = CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer1_human_writing;
CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer_2_language_and_cohesion = CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer2_language_cohesion;
CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer_3_expert_consultation = CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer3_expert_consultation;
CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer_4_decision_support = CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer4_decision_support;
CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer_5_trust_and_editorial_integrity = CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer5_trust_and_integrity;
CANONICAL_EDITORIAL_KNOWLEDGE_V1.native_indonesian_authoring = CANONICAL_NATIVE_INDONESIAN_AUTHORING_RULE;

// Master alias
export const CANONICAL_EDITORIAL_KNOWLEDGE = CANONICAL_EDITORIAL_KNOWLEDGE_V1;

export const CLAIM_HIERARCHY_CLASSES: ClaimHierarchyClass[] = [
  'VERIFIED_FACT',
  'TECHNICAL_CONSENSUS',
  'USER_EXPERIENCE_SIGNAL',
  'EDITORIAL_INFERENCE',
  'EDITORIAL_RECOMMENDATION'
];

export const UNCERTAINTY_CALIBRATION_TIERS = {
  HIGH_CONFIDENCE: {
    code: 'HIGH_CONFIDENCE',
    tier: 'STRONG_EVIDENCE',
    acceptable_framing: 'Data uji laboratorium dan rujukan standar konstruksi resmi (seperti SNI terkait) secara tegas menetapkan... [ILLUSTRATIVE_EXAMPLE_ONLY]',
    unacceptable_framing: 'Mungkin baja ringan cenderung lebih baik menurut standar.'
  },
  MODERATE_INFERENCE: {
    code: 'MODERATE_INFERENCE',
    tier: 'MODERATE_INFERENCE',
    acceptable_framing: 'Perbedaan densitas pori ini mengindikasikan ketahanan yang lebih lama terhadap kelembapan.',
    unacceptable_framing: 'Granit 100% pasti tidak akan pernah berlumut seumur hidup.'
  },
  CONTEXT_DEPENDENT: {
    code: 'CONTEXT_DEPENDENT',
    tier: 'CONTEXT_DEPENDENT',
    acceptable_framing: 'Untuk dinding yang terpapar tampias hujan langsung, opsi ini memerlukan proteksi overstek tambahan.',
    unacceptable_framing: 'Tergantung masing-masing orang.'
  },
  UNKNOWN_FIELD_VERIFICATION_REQUIRED: {
    code: 'UNKNOWN_FIELD_VERIFICATION_REQUIRED',
    tier: 'FIELD_VERIFICATION_REQUIRED',
    acceptable_framing: 'Kesesuaian beban struktur wajib diverifikasi oleh ahli struktur di lokasi proyek.',
    unacceptable_framing: 'Pasti aman untuk semua jenis rumah.'
  }
} as const;

export const READER_QUALIFICATION_FACTORS = [
  'project_type_new_vs_renovation',
  'room_type_and_occupant_activity',
  'sunlight_orientation',
  'rain_and_wind_exposure',
  'ambient_humidity_and_coastal_environment',
  'ambient_noise_level',
  'budget_and_maintenance_tolerance',
  'local_craftsman_skill_availability',
  'target_service_lifespan'
] as const;

export const DECISION_CONFIDENCE_QUESTIONS = [
  'What option is most suitable for my specific condition?',
  'Why is it the right choice based on physical and technical realities?',
  'What real trade-offs and compromises am I accepting?',
  'What specific details must I inspect or verify before purchasing or installing?',
  'What is my immediate next action?'
] as const;

/**
 * Phase 5: Preparation for RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_V1
 * Enforces plain, reader-friendly Indonesian decision and review terminology.
 * Strictly bans "verdict" and technical foreign jargon in user-facing content.
 */
export const RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_VERSION = 'RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_V1';

export const CANONICAL_PRODUCT_REVIEW_TERMINOLOGY = {
  version: RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_VERSION,
  overall_assessment: {
    primary: 'Penilaian RancangLoka',
    alternative: 'Rekomendasi Akhir',
    comparison_ending: 'Kesimpulan & Rekomendasi'
  },
  assessment_headings: {
    product_review: 'Penilaian RancangLoka',
    final_recommendation: 'Rekomendasi Akhir',
    comparison_summary: 'Kesimpulan & Rekomendasi'
  },
  decision_sections: {
    suitable_for: 'Cocok untuk',
    unsuitable_for: 'Kurang cocok untuk',
    strengths: 'Kelebihan',
    limitations: 'Keterbatasan',
    buying_considerations: 'Pertimbangan sebelum membeli'
  },
  decision_recommendations: {
    general: 'Rekomendasi',
    more_suitable_choice: 'Pilihan yang Lebih Cocok',
    context_fit: 'Rekomendasi untuk Kondisi Anda'
  },
  banned_terms: [
    'verdict',
    'final verdict',
    'review verdict',
    'verdict produk',
    'pros & cons',
    'pros and cons'
  ]
} as const;

export interface DistinctTechnicalReferent {
  term: string;
  explanation: string;
}

export interface CanonicalTermEntry {
  canonical: string;
  explanation: string;
  prohibited_alternations: string[];
  distinct_technical_referents?: DistinctTechnicalReferent[];
}

export const CANONICAL_TERMINOLOGY_MAP: Record<string, CanonicalTermEntry> = {
  'rekomendasi / penilaian': {
    canonical: 'rekomendasi / penilaian',
    explanation: 'Istilah penutup ulasan produk atau komparasi yang dilarang menggunakan kata verdict karena terlalu elitis/asing bagi pembaca.',
    prohibited_alternations: ['verdict', 'final verdict', 'review verdict', 'verdict produk']
  },
  'penilaian rancangloka': {
    canonical: 'Penilaian RancangLoka',
    explanation: 'Penilaian akhir redaksional untuk ulasan produk atau tinjauan spesifikasi.',
    prohibited_alternations: ['verdict', 'product verdict', 'review verdict']
  },
  'kesimpulan & rekomendasi': {
    canonical: 'Kesimpulan & Rekomendasi',
    explanation: 'Bagian penutup menuntaskan keputusan untuk artikel komparasi atau panduan edukasi.',
    prohibited_alternations: ['final verdict', 'verdict']
  },
  'kusen aluminium': {
    canonical: 'kusen aluminium',
    explanation: 'Rangka jendela/pintu berbahan aluminium ekstrusi sebagai kesatuan rakitan bukaan.',
    prohibited_alternations: ['frame aluminium', 'bingkai aluminium', 'sistem bingkai logam'],
    distinct_technical_referents: [
      {
        term: 'profil aluminium',
        explanation: 'Batang logam hasil ekstrusi sebelum dirakit menjadi kusen (sah digunakan ketika merujuk komponen spesifik).'
      },
      {
        term: 'daun jendela aluminium',
        explanation: 'Bagian bukaan bergerak/berengsel yang dipasang pada rangka kusen.'
      }
    ]
  },
  'dak beton': {
    canonical: 'dak beton',
    explanation: 'Pelat lantai atau atap datar berbahan beton bertulang.',
    prohibited_alternations: ['atap semen datar', 'dek coran semen']
  },
  'baja ringan': {
    canonical: 'rangka baja ringan',
    explanation: 'Sistem rangka atap dari baja canai dingin (cold-formed steel).',
    prohibited_alternations: ['besi ringan', 'baja tipis']
  },
  'ventilasi silang': {
    canonical: 'ventilasi silang',
    explanation: 'Aliran udara alami melalui dua bukaan berseberangan atau berbeda tekanan.',
    prohibited_alternations: ['angin silang', 'sirkulasi silang bolak-balik']
  }
};


export function getCanonicalTerm(termOrVariant: string): {
  canonical: string;
  explanation: string;
  is_prohibited_variation: boolean;
  distinct_referent?: DistinctTechnicalReferent;
} | null {
  const normalized = termOrVariant.toLowerCase().trim();
  // Check prohibited variations first
  for (const entry of Object.values(CANONICAL_TERMINOLOGY_MAP)) {
    if (entry.prohibited_alternations.some(v => v.toLowerCase() === normalized)) {
      return {
        canonical: entry.canonical,
        explanation: entry.explanation,
        is_prohibited_variation: true
      };
    }
  }
  // Check distinct technical referents (different technical referent -> precise correct term)
  for (const entry of Object.values(CANONICAL_TERMINOLOGY_MAP)) {
    if (entry.distinct_technical_referents) {
      for (const d of entry.distinct_technical_referents) {
        if (d.term.toLowerCase() === normalized) {
          return {
            canonical: d.term,
            explanation: d.explanation,
            is_prohibited_variation: false,
            distinct_referent: d
          };
        }
      }
    }
  }
  // Check canonical terms
  for (const [canonicalKey, entry] of Object.entries(CANONICAL_TERMINOLOGY_MAP)) {
    if (normalized === canonicalKey.toLowerCase() || normalized === entry.canonical.toLowerCase()) {
      return {
        canonical: entry.canonical,
        explanation: entry.explanation,
        is_prohibited_variation: false
      };
    }
  }
  return null;
}

// ============================================================================
// Role-Specific Knowledge Views / Adapters
// ============================================================================

export interface IrwanEvidenceKnowledgeView {
  persona: string;
  role: string;
  voice_ownership: boolean;
  authority: {
    author_human_voice: boolean;
    verify_evidence: boolean;
    override_standards: boolean;
    autonomous_publishing: boolean;
  };
  evidence_and_trust: {
    no_fabricated_experience: EditorialLayer5_TrustAndIntegrity['no_fabricated_experience'];
    evidence_quality_and_freshness: EditorialLayer5_TrustAndIntegrity['evidence_quality_and_freshness'];
    monetary_silence: string;
  };
  claim_hierarchy: EditorialLayer5_TrustAndIntegrity['claim_hierarchy'];
  uncertainty_calibration: EditorialLayer5_TrustAndIntegrity['confidence_and_uncertainty_calibration'];
  canonical_terms: EditorialLayer2_LanguageCohesion['terminology_consistency']['canonical_terms'];
}

export interface JokoAuthoringKnowledgeView {
  persona: string;
  role: string;
  voice_ownership: boolean;
  authority: {
    author_human_voice: boolean;
    override_technical_facts: boolean;
    bypass_editorial_qa: boolean;
    autonomous_publishing: boolean;
  };
  human_writing: EditorialLayer1_HumanWriting;
  language_and_cohesion: EditorialLayer2_LanguageCohesion;
  expert_consultation: EditorialLayer3_ExpertConsultation;
  decision_support: EditorialLayer4_DecisionSupport;
  native_indonesian_authoring: NativeIndonesianAuthoringRule;
  joko_authoring_rules: string[];
  trust_boundaries: {
    no_fabricated_experience: EditorialLayer5_TrustAndIntegrity['no_fabricated_experience'];
    commercial_integrity: EditorialLayer5_TrustAndIntegrity['commercial_integrity'];
    monetary_silence: string;
    confidence_calibration: EditorialLayer5_TrustAndIntegrity['confidence_and_uncertainty_calibration'];
  };
}

export interface RinaQAKnowledgeView {
  persona: string;
  role: string;
  voice_ownership: boolean;
  authority: {
    evaluate_editorial_quality: boolean;
    silent_rewrite_authoring: boolean;
    approve_for_publication_readiness: boolean;
    autonomous_publishing: boolean;
  };
  layer_1_human_writing: EditorialLayer1_HumanWriting;
  layer_2_language_and_cohesion: EditorialLayer2_LanguageCohesion;
  layer_3_expert_consultation: EditorialLayer3_ExpertConsultation;
  layer_4_decision_support: EditorialLayer4_DecisionSupport;
  layer_5_trust_and_editorial_integrity: EditorialLayer5_TrustAndIntegrity;
  native_indonesian_language_qa: {
    responsibility: 'NATIVE_INDONESIAN_LANGUAGE_QA';
    rule: string;
    checks: string[];
    routing: string;
  };
  qa_responsibilities: {
    minimum_passing_score: number;
    revise_score_range: [number, number];
    rewrite_score_range: [number, number];
    max_rewrite_attempts: number;
    escalation_state: 'HUMAN_REVIEW_REQUIRED';
    rewrite_policy: string;
  };
}

export interface SariPublicationKnowledgeView {
  persona: string;
  role: string;
  authority: {
    publish_live: boolean;
    override_editorial_qa_rejection: boolean;
    override_evidence_failure: boolean;
    override_human_review_required: boolean;
  };
  prerequisites: string[];
  publication_invariants: {
    requires_editorial_approval: boolean;
    requires_human_writing_pass: boolean;
    auto_publish_state: 'OFF';
    publishing_authority: number;
  };
}

export interface JefryAdvisoryKnowledgeView {
  persona: string;
  role: string;
  operating_mode: 'SHADOW_MODE_ONLY';
  authority: {
    autonomous_execution: boolean;
    editorial_approval: boolean;
    publishing_authority: boolean;
    authoring_authority: boolean;
  };
  observation_scope: string[];
}

/**
 * Derives role-specific view of canonical knowledge for Irwan (Evidence & Research).
 */
export function getIrwanEvidenceKnowledge(): IrwanEvidenceKnowledgeView {
  return {
    persona: 'Irwan — Research & Evidence Specialist',
    role: 'Irwan — Lead Technical Researcher',
    voice_ownership: false,
    authority: {
      author_human_voice: false,
      verify_evidence: true,
      override_standards: false,
      autonomous_publishing: false
    },
    evidence_and_trust: {
      no_fabricated_experience: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer5_trust_and_integrity.no_fabricated_experience,
      evidence_quality_and_freshness: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer5_trust_and_integrity.evidence_quality_and_freshness,
      monetary_silence: 'STRICT_EMPIRICAL_RESEARCH_ONLY_NO_GUESSES'
    },
    claim_hierarchy: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer5_trust_and_integrity.claim_hierarchy,
    uncertainty_calibration: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer5_trust_and_integrity.confidence_and_uncertainty_calibration,
    canonical_terms: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer2_language_cohesion.terminology_consistency.canonical_terms
  };
}

/**
 * Derives role-specific view of canonical knowledge for Joko (Human-First Authoring).
 */
export function getJokoAuthoringKnowledge(): JokoAuthoringKnowledgeView {
  return {
    persona: 'Joko — Writer / Expert Advisor',
    role: 'Joko — Content Writer & Expert Advisor',
    voice_ownership: true,
    authority: {
      author_human_voice: true,
      override_technical_facts: false,
      bypass_editorial_qa: false,
      autonomous_publishing: false
    },
    human_writing: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer1_human_writing,
    language_and_cohesion: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer2_language_cohesion,
    expert_consultation: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer3_expert_consultation,
    decision_support: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer4_decision_support,
    native_indonesian_authoring: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer2_language_cohesion.native_indonesian_authoring,
    joko_authoring_rules: [
      'Formulasikan naskah artikel langsung dalam bahasa Indonesia sejak awal alur pemikiran.',
      'Pertahankan susunan kalimat dan urutan klausa alami bahasa Indonesia.',
      'Gunakan logika penghubung gagasan Indonesia, bukan menerjemahkan transisi mekanis bahasa Inggris.',
      'Utamakan ungkapan bahasa Indonesia yang akrab dan lugas bagi pemilik rumah.',
      'Hindari pola wacana terjemahan literal (translationese).',
      'Pertahankan istilah teknis kanonikal dan istilah bahasa Inggris yang sah sesuai standar industri.',
      'Jaga kohesi leksikal dan kesinambungan argumen antar-kalimat.',
      'Tulis sebagai satu suara redaksi Indonesia yang utuh dari awal hingga akhir naskah.',
      'DILARANG menggunakan draf bahasa Inggris sebagai artefak antara kecuali ditugaskan secara eksplisit.'
    ],
    trust_boundaries: {
      no_fabricated_experience: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer5_trust_and_integrity.no_fabricated_experience,
      commercial_integrity: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer5_trust_and_integrity.commercial_integrity,
      monetary_silence: 'STRICT_EMPIRICAL_RESEARCH_ONLY_NO_GUESSES',
      confidence_calibration: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer5_trust_and_integrity.confidence_and_uncertainty_calibration
    }
  };
}

/**
 * Derives role-specific view of canonical knowledge for Rina (Senior Editorial QA).
 */
export function getRinaQAKnowledge(): RinaQAKnowledgeView {
  return {
    persona: 'Rina — Senior Editorial QA',
    role: 'Rina — Senior Editorial QA',
    voice_ownership: false,
    authority: {
      evaluate_editorial_quality: true,
      silent_rewrite_authoring: false,
      approve_for_publication_readiness: true,
      autonomous_publishing: false
    },
    layer_1_human_writing: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer1_human_writing,
    layer_2_language_and_cohesion: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer2_language_cohesion,
    layer_3_expert_consultation: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer3_expert_consultation,
    layer_4_decision_support: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer4_decision_support,
    layer_5_trust_and_editorial_integrity: CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer5_trust_and_integrity,
    native_indonesian_language_qa: {
      responsibility: 'NATIVE_INDONESIAN_LANGUAGE_QA',
      rule: 'Rina mengevaluasi apakah naskah terdengar alami ditulis dalam bahasa Indonesia asli atau terindikasi translationese (gaya terjemahan bahasa Inggris).',
      checks: [
        'sounds originally written in Indonesian',
        'contains translationese patterns',
        'uses unnatural English-derived syntax',
        'shifts unexpectedly into translated corporate language',
        'uses unnecessary English editorial jargon',
        'has natural Indonesian transitions',
        'preserves technical accuracy and allowed technical English terms'
      ],
      routing: 'Jika artikel secara teknis akurat namun kental gaya translationese, arahkan ke Joko untuk REVISE atau REWRITE sesuai tingkat keparahan.'
    },
    qa_responsibilities: {
      minimum_passing_score: 85,
      revise_score_range: [75, 84],
      rewrite_score_range: [0, 74],
      max_rewrite_attempts: 2,
      escalation_state: 'HUMAN_REVIEW_REQUIRED',
      rewrite_policy: 'STRUCTURED_BRIEF_TO_JOKO_MAX_2_ATTEMPTS'
    }
  };
}

/**
 * Derives role-specific view of canonical knowledge for Sari (Publication Operations).
 */
export function getSariPublicationKnowledge(): SariPublicationKnowledgeView {
  return {
    persona: 'Sari — Publication Operator',
    role: 'Sari — Publication Operations & Safety Lead',
    authority: {
      publish_live: true,
      override_editorial_qa_rejection: false,
      override_evidence_failure: false,
      override_human_review_required: false
    },
    prerequisites: [
      'Irwan technical evidence verification',
      'Rina editorial quality approval (score >= 85)',
      'First Article Gate checklist pass',
      'Human operator explicit confirmation'
    ],
    publication_invariants: {
      requires_editorial_approval: true,
      requires_human_writing_pass: true,
      auto_publish_state: 'OFF',
      publishing_authority: 0
    }
  };
}

/**
 * Derives role-specific view of canonical knowledge for Jefry (Shadow Advisory).
 */
export function getJefryAdvisoryKnowledge(): JefryAdvisoryKnowledgeView {
  return {
    persona: 'Jefry — Management Decision Advisor (TypeSafe JEV)',
    role: 'Jefry / TypeSafe JEV — Shadow Editorial Decision Advisor',
    operating_mode: 'SHADOW_MODE_ONLY',
    authority: {
      autonomous_execution: false,
      editorial_approval: false,
      publishing_authority: false,
      authoring_authority: false
    },
    observation_scope: [
      'quality_scores_distribution',
      'common_revision_reasons',
      'editorial_velocity_telemetry'
    ]
  };
}

