/**
 * RancangLoka Product Review & Decision Support Knowledge Foundation (V1)
 * Milestone: RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_V1
 *
 * Canonical knowledge module for product reviews, buyer decision support,
 * compatibility evaluation, real-world performance signal synthesis,
 * limitation disclosure, and commercial integrity.
 *
 * INHERITANCE ARCHITECTURE:
 * RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1
 *   ├── Human Writing
 *   ├── Language & Cohesion
 *   ├── Expert Consultation
 *   ├── Decision Support
 *   └── Trust & Editorial Integrity
 *             │
 *             ▼
 * RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_V1
 *
 * Inherits all general editorial principles and adds product/purchase-specific
 * decision support logic. It does NOT replace the parent editorial constitution.
 *
 * CRITICAL PRODUCT REVIEW PRINCIPLE:
 * "Apakah produk ini cocok untuk kondisi saya, dan apa yang perlu saya ketahui sebelum membeli?"
 * (NOT: "Bagaimana membuat produk ini terlihat menarik?")
 */

import {
  RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION,
  CANONICAL_EDITORIAL_KNOWLEDGE_V1,
  CANONICAL_PRODUCT_REVIEW_TERMINOLOGY,
  type ClaimHierarchyClass,
  type RancangLokaEditorialKnowledge,
  type IrwanEvidenceKnowledgeView,
  type JokoAuthoringKnowledgeView,
  type RinaQAKnowledgeView,
  type SariPublicationKnowledgeView,
  type JefryAdvisoryKnowledgeView
} from './editorial-knowledge.ts';

export const RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_VERSION = 'RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_V1';

// ============================================================================
// Product Review Types
// ============================================================================

export type ProductReviewType = 'ANALYTICAL_REVIEW' | 'HANDS_ON_REVIEW' | 'COMPARISON_REVIEW';

export interface ProductReviewTypeDefinition {
  type: ProductReviewType;
  label: string;
  definition: string;
  data_sources: string[];
  hands_on_allowed: boolean;
  reader_facing_label: string;
  methodology_declaration_required: boolean;
  prerequisites: string[];
}

export const PRODUCT_REVIEW_TYPES: Record<ProductReviewType, ProductReviewTypeDefinition> = {
  ANALYTICAL_REVIEW: {
    type: 'ANALYTICAL_REVIEW',
    label: 'Tinjauan Analitis',
    definition: 'Ulasan mendalam berbasis spesifikasi resmi, dokumentasi teknis, pengujian pihak ketiga independen, dan agregasi sinyal pengguna nyata. DILARANG mengklaim atau menyiratkan pengujian fisik langsung oleh redaksi RancangLoka.',
    data_sources: [
      'Spesifikasi resmi produsen / pabrikan',
      'Manual instalasi dan buku panduan pengguna',
      'Dokumentasi kompatibilitas dan sertifikasi standar (SNI, ISO, dll.)',
      'Laporan pengujian laboratorium / pihak ketiga yang kredibel',
      'Agregasi ulasan dan keluhan berulang pengguna terverifikasi'
    ],
    hands_on_allowed: false,
    reader_facing_label: 'Tinjauan Spesifikasi & Analisis Produk',
    methodology_declaration_required: true,
    prerequisites: [
      'Verifikasi identitas spesifik varian produk',
      'Konfirmasi sumber spesifikasi resmi',
      'Pengungkapan bahwa ulasan bersifat analitis tanpa pengujian fisik'
    ]
  },
  HANDS_ON_REVIEW: {
    type: 'HANDS_ON_REVIEW',
    label: 'Ulasan Pengujian Langsung',
    definition: 'Ulasan yang HANYA diizinkan jika RancangLoka memiliki unit fisik riil dan mendokumentasikan bukti pengujian fisik (foto, catatan log, parameter uji terukur).',
    data_sources: [
      'Pengujian fisik langsung oleh tim redaksi RancangLoka',
      'Dokumentasi foto/video pengujian asli',
      'Log pengukuran parameter nyata di lapangan/studio',
      'Spesifikasi resmi produsen sebagai baseline komparasi'
    ],
    hands_on_allowed: true,
    reader_facing_label: 'Tested by RancangLoka',
    methodology_declaration_required: true,
    prerequisites: [
      'Unit fisik terverifikasi berada di tangan tim RancangLoka',
      'Protokol uji fisik terdokumentasi dengan bukti primer tersimpan',
      'Verifikasi bahwa unit sponsor tetap tunduk pada objektivitas editorial penuh'
    ]
  },
  COMPARISON_REVIEW: {
    type: 'COMPARISON_REVIEW',
    label: 'Ulasan Komparasi Produk',
    definition: 'Perbandingan komprehensif dua produk atau lebih menggunakan kriteria terstandarisasi, standar bukti setara, dan rekomendasi berbasis skenario tanpa pemenang tunggal yang sewenang-wenang.',
    data_sources: [
      'Dokumentasi resmi seluruh produk yang dibandingkan',
      'Standar evaluasi kriteria seragam (fairness matrix)',
      'Data harga dan ketersediaan dalam jendela waktu yang sama',
      'Pengujian terstandarisasi (jika hands-on) atau bukti analitis setara'
    ],
    hands_on_allowed: true, // Sah jika semua diuji atau metodologi analitis diterapkan setara
    reader_facing_label: 'Komparasi Produk & Panduan Pilihan',
    methodology_declaration_required: true,
    prerequisites: [
      'Kriteria perbandingan didefinisikan secara transparan sebelum analisis',
      'Varian yang dibandingkan berada di kelas/tujuan penggunaan yang sepadan',
      'Rekomendasi bersifat kondisional (cocok untuk skenario X vs Y), bukan pemenang mutlak tanpa konteks'
    ]
  }
};

// ============================================================================
// Hard Hands-On Boundary & Banned Claims
// ============================================================================

export const BANNED_HANDS_ON_PHRASES: string[] = [
  'kami sudah mencoba',
  'kami telah mencoba',
  'dalam pengujian kami',
  'setelah digunakan selama',
  'setelah kami gunakan selama',
  'kami memasangnya',
  'saat kami pasang',
  'hasil tes kami',
  'pengujian langsung kami',
  'unit uji kami',
  'kami uji di lapangan',
  'kami merasakannya sendiri',
  'laboratorium kami membuktikan',
  'kami unboxing'
];

export const HANDS_ON_BOUNDARY_RULES = {
  rule: 'Dilarang keras menggunakan frasa pengujian fisik langsung atau menyiratkan kepemilikan/penggunaan langsung oleh redaksi RancangLoka jika ulasan berstatus ANALYTICAL_REVIEW atau tidak memiliki bukti fisik primer terverifikasi.',
  sponsor_rule: 'Produk yang disuplai oleh sponsor atau pabrikan TIDAK secara otomatis berstatus "Tested by RancangLoka". Status tersebut menuntut pelaksanaan dan dokumentasi protokol uji independen.',
  affiliate_rule: 'Keberadaan produk dalam katalog afiliasi atau marketplace TIDAK memberikan dasar pengujian fisik.',
  spec_rule: 'Klaim brosur produsen BUKAN hasil pengujian RancangLoka.'
} as const;

// ============================================================================
// Product Evidence Hierarchy
// ============================================================================

export type ProductEvidenceTier =
  | 'FIRST_PARTY_TEST'
  | 'ACCREDITED_INDEPENDENT_TEST'
  | 'OFFICIAL_MANUFACTURER_DOCS'
  | 'CERTIFICATION_AND_STANDARDS'
  | 'REPUTABLE_TECHNICAL_SOURCES'
  | 'AGGREGATED_USER_SIGNALS'
  | 'INDIVIDUAL_ANECDOTE';

export interface ProductEvidenceHierarchyEntry {
  rank: number;
  tier: ProductEvidenceTier;
  label: string;
  definition: string;
  acceptable_usage: string;
  weight: 'HIGHEST' | 'HIGH' | 'MODERATE' | 'LOW' | 'SUPPLEMENTAL_ONLY';
}

export const PRODUCT_EVIDENCE_HIERARCHY: Record<ProductEvidenceTier, ProductEvidenceHierarchyEntry> = {
  FIRST_PARTY_TEST: {
    rank: 1,
    tier: 'FIRST_PARTY_TEST',
    label: 'Pengujian Fisik Langsung RancangLoka',
    definition: 'Hasil uji fisik primer langsung oleh tim RancangLoka dengan artefak dokumentasi asli (foto, data ukur, durasi pengujian).',
    acceptable_usage: 'Dapat digunakan untuk klaim performa empiris, durabilitas nyata, dan label "Tested by RancangLoka".',
    weight: 'HIGHEST'
  },
  ACCREDITED_INDEPENDENT_TEST: {
    rank: 2,
    tier: 'ACCREDITED_INDEPENDENT_TEST',
    label: 'Laporan Uji Laboratorium / Pihak Ketiga Terakreditasi',
    definition: 'Data uji dari laboratorium independen, lembaga konsumen bersertifikasi, atau riset akademis yang memiliki metodologi terbuka.',
    acceptable_usage: 'Digunakan untuk klaim keamanan material, ketahanan struktural, atau efisiensi energi terukur.',
    weight: 'HIGH'
  },
  OFFICIAL_MANUFACTURER_DOCS: {
    rank: 3,
    tier: 'OFFICIAL_MANUFACTURER_DOCS',
    label: 'Dokumentasi Resmi Produsen / Buku Manual',
    definition: 'Buku petunjuk, manual instalasi, spesifikasi resmi, dan syarat garansi dari pabrikan.',
    acceptable_usage: 'Digunakan sebagai rujukan spesifikasi nominal dan batas operasional resmi. Harus dibingkai sebagai klaim pabrikan, bukan bukti performa lapangan.',
    weight: 'MODERATE'
  },
  CERTIFICATION_AND_STANDARDS: {
    rank: 4,
    tier: 'CERTIFICATION_AND_STANDARDS',
    label: 'Data Sertifikasi & Standar Resmi (SNI, ISO, CE, dll.)',
    definition: 'Registrasi sertifikasi kepatuhan terhadap standar teknis nasional atau internasional.',
    acceptable_usage: 'Bukti pemenuhan regulasi dasar keselamatan dan mutu material.',
    weight: 'HIGH'
  },
  REPUTABLE_TECHNICAL_SOURCES: {
    rank: 5,
    tier: 'REPUTABLE_TECHNICAL_SOURCES',
    label: 'Sumber Teknis Bereputasi & Publikasi Industri',
    definition: 'Analisis dari asosiasi profesional, jurnal teknologi bahan bangunan, atau publikasi teknologi independen bereputasi.',
    acceptable_usage: 'Konteks teknis industri, tren kegagalan umum material sejenis, dan perbandingan arsitektural.',
    weight: 'MODERATE'
  },
  AGGREGATED_USER_SIGNALS: {
    rank: 6,
    tier: 'AGGREGATED_USER_SIGNALS',
    label: 'Agregasi Sinyal Pembeli & Ulasan Terverifikasi',
    definition: 'Pola keluhan atau kepuasan berulang dari puluhan ulasan pengguna terverifikasi di marketplace atau forum pengguna nyata.',
    acceptable_usage: 'Menunjukkan sinyal gesekan operasional nyata (aplikasi sering disconnect, baterai boros, baut mudah aus). BUKAN fakta teknis mutlak.',
    weight: 'MODERATE'
  },
  INDIVIDUAL_ANECDOTE: {
    rank: 7,
    tier: 'INDIVIDUAL_ANECDOTE',
    label: 'Anekdot Pengguna Tunggal',
    definition: 'Komentar atau ulasan individual tanpa pola konfirmasi dari pengguna lain.',
    acceptable_usage: 'Hanya boleh dipertimbangkan sebagai hipotesis awal investigasi, DILARANG dijadikan kesimpulan cacat produk umum.',
    weight: 'SUPPLEMENTAL_ONLY'
  }
};

// ============================================================================
// Claim Classification for Products
// ============================================================================

export const PRODUCT_CLAIM_CLASSES: Record<ClaimHierarchyClass, {
  label: string;
  definition: string;
  product_application: string;
}> = {
  VERIFIED_FACT: {
    label: 'Fakta Terverifikasi',
    definition: 'Dimensi fisik, berat, voltase, nomor model, material dasar yang tercantum resmi dan diverifikasi konsisten.',
    product_application: 'Menyebutkan spesifikasi fisik tanpa spekulasi.'
  },
  TECHNICAL_CONSENSUS: {
    label: 'Konsensus Teknis Industri',
    definition: 'Prinsip ketahanan material yang diakui umum (misal: kuningan lebih tahan korosi dibanding seng paduan).',
    product_application: 'Menerjemahkan konsekuensi pemilihan material terhadap umur pakai.'
  },
  USER_EXPERIENCE_SIGNAL: {
    label: 'Sinyal Pengalaman Pengguna',
    definition: 'Agregasi sentimen nyata dari pengguna di lapangan (misal: proses pairing awal butuh beberapa kali percobaan).',
    product_application: 'Memberikan gambaran gesekan instalasi tanpa memvonisnya sebagai cacat fatal.'
  },
  EDITORIAL_INFERENCE: {
    label: 'Inferensi Redaksional Berdasar Bukti',
    definition: 'Analisis logis RancangLoka menghubungkan spesifikasi dengan kondisi riil hunian di Indonesia.',
    product_application: 'Menyimpulkan bahwa sensor optik tanpa pelindung kanopi rentan false alarm saat hujan deras tropis.'
  },
  EDITORIAL_RECOMMENDATION: {
    label: 'Rekomendasi Keputusan Redaksional',
    definition: 'Saran tindakan terstruktur berbasis profil kebutuhan dan kompromi yang disepakati pembaca.',
    product_application: 'Menyarankan varian baterai AA untuk pemilik rumah yang enggan membongkar kunci untuk isi ulang berkala.'
  }
};

// ============================================================================
// 9 Canonical Decision Questions
// ============================================================================

export const PRODUCT_DECISION_QUESTIONS = [
  'Produk ini sebenarnya menyelesaikan masalah apa?',
  'Apakah cocok dengan kondisi rumah atau sistem saya?',
  'Apa keunggulan yang benar-benar relevan untuk kebutuhan sehari-hari?',
  'Apa keterbatasan nyata dan kompromi yang harus saya terima?',
  'Keluhan apa yang berulang kali dialami pengguna lain?',
  'Apa saja hal teknis yang wajib saya periksa sebelum membeli?',
  'Siapa profil pemilik rumah yang paling cocok menggunakan produk ini?',
  'Siapa yang sebaiknya mencari alternatif lain?',
  'Apakah nilai fungsional yang didapat sepadan dengan biaya kepemilikan totalnya?'
] as const;

// ============================================================================
// 7 Product Knowledge Layers
// ============================================================================

export interface ProductReviewLayer1_IdentityAndSpecs {
  product_identity: {
    mandatory_fields: Array<'brand' | 'model' | 'generation' | 'variant' | 'capacity' | 'size' | 'version' | 'region' | 'firmware_or_platform'>;
    variant_protection_rule: string;
    banned_practice: string;
  };
  official_specifications: {
    rule: string;
    three_way_distinction: {
      manufacturer_spec: string;
      measured_performance: string;
      user_experience: string;
    };
  };
  feature_consequence_translation: {
    rule: string;
    pattern: ['technical_spec', 'human_explanation', 'practical_consequence'];
    bad_example: string;
    good_example: string;
  };
}

export interface ProductReviewLayer2_UseCaseAndCompatibility {
  use_case_fit: {
    rule: string;
    conditional_recommendation_principle: string;
    banned_declaration: string;
  };
  reader_facing_labels: {
    suitable_for: 'Cocok untuk';
    unsuitable_for: 'Kurang cocok untuk';
    rule: string;
  };
  compatibility_dimensions: Record<string, {
    category: string;
    key_dimensions: string[];
    criticality: string;
  }>;
}

export interface ProductReviewLayer3_PerformanceSignals {
  user_review_signals: {
    rule: string;
    separation_rule: string;
    minimum_signal_threshold: string;
  };
  recurring_complaint_treatment: {
    rule: string;
    common_recurring_patterns: string[];
    prohibition: string;
  };
  recurring_positive_signals: {
    rule: string;
    common_positive_patterns: string[];
    balance_guarantee: string;
  };
  sentiment_as_evidence_boundary: {
    rule: string;
    limitation: string;
  };
}

export interface ProductReviewLayer4_LimitationsAndTradeOffs {
  mandatory_limitation_disclosure: {
    rule: string;
    core_questions: string[];
    prohibition: string;
  };
  trade_off_logic: {
    rule: string;
    common_dichotomies: Array<{
      advantage: string;
      consequence: string;
      explanation: string;
    }>;
  };
}

export interface ProductReviewLayer5_InstallationAndOwnership {
  ownership_reality_checkpoints: {
    rule: string;
    dimensions: string[];
  };
  installation_complexity_calibration: {
    rule: string;
    levels: Array<'DIY_MUDAH' | 'DIY_DENGAN_ALAT_STANDAR' | 'TEKNISI_AHLI_DISARANKAN' | 'INSTALASI_PROFESIONAL_WAJIB'>;
  };
}

export interface ProductReviewLayer6_ValueCalibration {
  definition_of_value: {
    rule: string;
    formula_components: Array<'FUNCTION' | 'FIT' | 'QUALITY' | 'EXPECTED_OWNERSHIP_BURDEN' | 'LIMITATIONS' | 'ALTERNATIVES'>;
    banned_reduction: string;
  };
  price_integrity: {
    rule: string;
    handling_price_volatility: string;
    prohibition: string;
  };
}

export interface ProductReviewLayer7_DecisionRecommendation {
  approved_reader_terminology: typeof CANONICAL_PRODUCT_REVIEW_TERMINOLOGY;
  recommendation_pattern: {
    rule: string;
    template: string;
    banned_pattern: string;
  };
  affiliate_cta_boundary: {
    rule: string;
    mandatory_flow: ['evidence', 'analysis', 'suitability', 'recommendation', 'optional_purchase_cta'];
    prohibition: string;
  };
  scoring_policy: {
    rule: string;
    v1_stance: string;
  };
}

export interface RancangLokaProductReviewKnowledge {
  version: typeof RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_VERSION;
  parent_editorial_version: typeof RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION;
  title: string;
  last_updated: string;
  core_principle: string;
  review_types: typeof PRODUCT_REVIEW_TYPES;
  hands_on_boundary: {
    banned_phrases: string[];
    rules: typeof HANDS_ON_BOUNDARY_RULES;
  };
  evidence_hierarchy: typeof PRODUCT_EVIDENCE_HIERARCHY;
  claim_classes: typeof PRODUCT_CLAIM_CLASSES;
  decision_questions: typeof PRODUCT_DECISION_QUESTIONS;
  layer1_identity_and_specs: ProductReviewLayer1_IdentityAndSpecs;
  layer2_use_case_and_compatibility: ProductReviewLayer2_UseCaseAndCompatibility;
  layer3_performance_signals: ProductReviewLayer3_PerformanceSignals;
  layer4_limitations_and_trade_offs: ProductReviewLayer4_LimitationsAndTradeOffs;
  layer5_installation_and_ownership: ProductReviewLayer5_InstallationAndOwnership;
  layer6_value_calibration: ProductReviewLayer6_ValueCalibration;
  layer7_decision_recommendation: ProductReviewLayer7_DecisionRecommendation;
  comparison_fairness: {
    rule: string;
    mandatory_checks: string[];
  };
  review_freshness: {
    tracked_metadata: string[];
    decay_triggers: string[];
  };
  commercial_integrity: {
    core_rule: string;
    isolation_guarantees: string[];
  };
}

// ============================================================================
// Master Canonical Product Review Knowledge Object (V1)
// ============================================================================

export const CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1: RancangLokaProductReviewKnowledge = {
  version: RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_VERSION,
  parent_editorial_version: RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION,
  title: 'RancangLoka Product Review & Decision Support Knowledge Foundation (V1)',
  last_updated: '2026-10-04T11:00:00.000Z',
  core_principle: 'Apakah produk ini cocok untuk kondisi saya, dan apa yang perlu saya ketahui sebelum membeli?',

  review_types: PRODUCT_REVIEW_TYPES,

  hands_on_boundary: {
    banned_phrases: BANNED_HANDS_ON_PHRASES,
    rules: HANDS_ON_BOUNDARY_RULES
  },

  evidence_hierarchy: PRODUCT_EVIDENCE_HIERARCHY,
  claim_classes: PRODUCT_CLAIM_CLASSES,
  decision_questions: PRODUCT_DECISION_QUESTIONS,

  // --------------------------------------------------------------------------
  // LAYER 1: PRODUCT IDENTITY & FACTS
  // --------------------------------------------------------------------------
  layer1_identity_and_specs: {
    product_identity: {
      mandatory_fields: [
        'brand',
        'model',
        'generation',
        'variant',
        'capacity',
        'size',
        'version',
        'region',
        'firmware_or_platform'
      ],
      variant_protection_rule: 'Setiap ulasan wajib mengidentifikasi secara pasti varian produk yang dibahas. Dilarang menggabungkan spesifikasi atau fitur dari varian, kapasitas, atau generasi regional yang berbeda.',
      banned_practice: 'Mencampuradukkan spesifikasi versi global dengan versi resmi Indonesia, atau versi baterai dengan versi kabel tanpa penjelasan tegas.'
    },
    official_specifications: {
      rule: 'Spesifikasi resmi wajib bersumber dari dokumentasi pabrikan yang kredibel. Redaksi wajib secara tegas memisahkan klaim nominal pabrikan dari performa terukur dan pengalaman nyata pengguna.',
      three_way_distinction: {
        manufacturer_spec: 'Angka nominal ideal di laboratorium pabrik (misal: baterai tahan hingga 12 bulan).',
        measured_performance: 'Data terukur di kondisi uji realistis oleh pihak ketiga atau tim penguji terakreditasi.',
        user_experience: 'Kenyataan operasional di rumah pembaca dengan beban buka-tutup dan suhu cuaca lokal.'
      }
    },
    feature_consequence_translation: {
      rule: 'Setiap spesifikasi penting harus diterjemahkan menjadi konsekuensi praktis bagi pembaca rumah (Three-step translation: Spesifikasi Teknis -> Penjelasan Sederhana -> Konsekuensi Sehari-hari).',
      pattern: ['technical_spec', 'human_explanation', 'practical_consequence'],
      bad_example: 'Kamera ini memiliki resolusi 3MP dan sensor 1/2.8 inci.',
      good_example: 'Sensor 3MP (2304x1296) memberikan ketajaman cukup untuk membaca plat nomor kendaraan pada jarak 5 meter di siang hari, namun dalam kondisi remang tanpa penerangan tambahan, detail wajah akan melunak karena kompresi noise digital.'
    }
  },

  // --------------------------------------------------------------------------
  // LAYER 2: USE-CASE & COMPATIBILITY
  // --------------------------------------------------------------------------
  layer2_use_case_and_compatibility: {
    use_case_fit: {
      rule: 'Ulasan produk harus menentukan masalah nyata apa yang diselesaikan dan untuk siapa produk ini bermanfaat. Setiap rekomendasi produk harus bersyarat pada situasi pemakaian.',
      conditional_recommendation_principle: 'Tidak ada produk yang secara universal sempurna atau buruk untuk semua orang. Kualitas produk selalu bergantung pada kecocokan konteks pemakaian.',
      banned_declaration: 'Menyatakan suatu produk "pilihan terbaik untuk semua rumah" tanpa membedakan profil pengguna.'
    },
    reader_facing_labels: {
      suitable_for: 'Cocok untuk',
      unsuitable_for: 'Kurang cocok untuk',
      rule: 'Gunakan label pembaca yang bersahabat dan terstruktur: "Cocok untuk" dan "Kurang cocok untuk". Hindari istilah asing elitis atau biner "Bagus/Jelek".'
    },
    compatibility_dimensions: {
      smart_lock: {
        category: 'Smart Lock / Digital Door Lock',
        key_dimensions: [
          'Material dan jenis pintu (kayu solid, hollow, aluminium, kaca, UPVC)',
          'Tipe mortise / bodi kunci dan ketebalan pintu minimum/maksimum',
          'Arah bukaan pintu (kiri/kanan, dorong/tarik)',
          'Protokol konektivitas (Bluetooth lokal, Wi-Fi 2.4GHz, Zigbee/Matter)',
          'Integrasi aplikasi/ekosistem (Tuya, Aqara, Apple Home, Google Home)'
        ],
        criticality: 'Inkompatibilitas fisik mortise atau material pintu dapat merusak daun pintu dan membatalkan garansi.'
      },
      cctv_security: {
        category: 'CCTV / Security Camera',
        key_dimensions: [
          'Jaringan nirkabel (Wi-Fi 2.4GHz only vs dual band, stabilitas sinyal di lokasi pemasangan)',
          'Penyimpanan rekaman (MicroSD lokal, NVR/ONVIF RTSP, cloud subscription)',
          'Sumber daya (baterai rechargable, solar panel, adaptor kabel permanen)',
          'Visibilitas malam & kondisi pencahayaan (Infrared hitam-putih vs Color Night Vision)',
          'Ketahanan cuaca & lokasi pasang (Rating IP65/IP66 vs indoor only, paparan tempias hujan tropis)',
          'Ekosistem pendukung aplikasi'
        ],
        criticality: 'CCTV luar ruangan tanpa sertifikasi cuaca atau tanpa pasokan daya stabil akan mati saat paling dibutuhkan.'
      },
      building_materials: {
        category: 'Material Bangunan / Pelapis / Cat / Kusen',
        key_dimensions: [
          'Substrat / permukaan dasar aplikasi (plesteran baru, beton, gypsum, kayu, logam)',
          'Paparan iklim dan radiasi UV (area luar terkena panas terik/hujan vs interior kering)',
          'Metode pemasangan dan kebutuhan adukan / perekat khusus',
          'Kompatibilitas aksesori dan sistem sambungan (sealant, sekrup anti-karat)'
        ],
        criticality: 'Ketidakcocokan material dengan substrat atau iklim tropis lembap menyebabkan keretakan, kebocoran, atau pelepasan dini.'
      }
    }
  },

  // --------------------------------------------------------------------------
  // LAYER 3: REAL-WORLD PERFORMANCE SIGNALS
  // --------------------------------------------------------------------------
  layer3_performance_signals: {
    user_review_signals: {
      rule: 'Ulasan pembeli di marketplace/forum adalah sinyal operasional berharga, tetapi BUKAN fakta teknis mutlak. Redaksi wajib membedakan keluhan sporadis dari pola masalah sistemik berulang.',
      separation_rule: 'Satu pembeli yang marah karena barang rusak akibat kurir pengiriman TIDAK boleh disimpulkan sebagai cacat produk. Sinyal keluhan baru sah jika dilaporkan secara konsisten oleh banyak pengguna independen dengan gejala serupa.',
      minimum_signal_threshold: 'Keluhan berulang menuntut konfirmasi dari sejumlah laporan terpisah mengenai kegagalan fungsional yang sama (misal: pembaruan firmware memutuskan koneksi cloud).'
    },
    recurring_complaint_treatment: {
      rule: 'Identifikasi dan sampaikan secara transparan keluhan yang sering dialami pengguna jangka panjang.',
      common_recurring_patterns: [
        'Koneksi aplikasi sering putus (disconnection / offline bug)',
        'Baterai boros jauh di bawah klaim resmi pabrik',
        'Aplikasi lambat, sering logout, atau notifikasi push terlambat',
        'Rembesan air pada unit outdoor (water ingress)',
        'Sensor gerak memicu alarm palsu akibat serangga atau daun bergoyang',
        'Baut/bracket bawaan berkualitas lunak dan mudah aus saat dipasang',
        'Layanan purna jual dan suku cadang sulit diperoleh di Indonesia'
      ],
      prohibition: 'Dilarang menyembunyikan keluhan berulang hanya demi menjaga peluang komisi tautan pembelian.'
    },
    recurring_positive_signals: {
      rule: 'Laporkan pula sinyal kepuasan berulang secara objektif agar ulasan tidak terjebak dalam bias keluhan semata.',
      common_positive_patterns: [
        'Proses pairing awal sangat mulus dan cepat',
        'Koneksi Wi-Fi stabil bahkan saat sinyal router 2 bar',
        'Daya tahan baterai nyata mendekati klaim spesifikasi',
        'Bodi fisik kokoh dan finishing rapi',
        'Fitur penyimpanan lokal berfungsi mandiri tanpa paksaan langganan cloud'
      ],
      balance_guarantee: 'Ulasan harus memberikan gambaran utuh antara kemudahan yang nyata dirasakan pembeli dan titik gesekan operasional.'
    },
    sentiment_as_evidence_boundary: {
      rule: 'Sentimen pengguna adalah sinyal keandalan perseptual dan ergonomi, bukan bukti fisik uji laboratorium. Sentimen tidak dapat membatalkan hukum fisika atau spesifikasi material terverifikasi.',
      limitation: 'Sentimen "terasa ringan dan murah" harus dikalibrasi dengan jenis material yang digunakan (misal: polimer ABS rekayasa memang ringan namun elastis terhadap benturan).'
    }
  },

  // --------------------------------------------------------------------------
  // LAYER 4: LIMITATIONS, RISKS & TRADE-OFFS
  // --------------------------------------------------------------------------
  layer4_limitations_and_trade_offs: {
    mandatory_limitation_disclosure: {
      rule: 'Setiap ulasan produk wajib mencantumkan bagian keterbatasan nyata secara jujur dan gamblang. Menghilangkan kelemahan produk adalah pelanggaran integritas editorial RancangLoka.',
      core_questions: [
        'Fitur penting apa yang absen dibanding produk sekelasnya?',
        'Kompromi apa yang harus diterima pemilik rumah jika memilih produk ini?',
        'Klaim pemasaran mana yang sebenarnya memiliki batasan ketat saat dipakai?',
        'Apa yang terjadi ketika kondisi pemakaian tidak ideal (mati lampu, hujan lebat, sinyal internet mati)?'
      ],
      prohibition: 'Dilarang memperhalus kekurangan fatal menjadi kata-kata promosi terselubung.'
    },
    trade_off_logic: {
      rule: 'Jelaskan kompromi logis di balik setiap pilihan desain produk. Membeli produk selalu berarti menerima trade-off tertentu.',
      common_dichotomies: [
        {
          advantage: 'Penyimpanan lokal microSD tanpa biaya bulanan',
          consequence: 'Jika kamera dirusak atau dicuri orang, rekaman rekaman ikut hilang bersama perangkat.',
          explanation: 'Kebebasan langganan vs keamanan fisik data rekaman.'
        },
        {
          advantage: 'Kunci pintu bertenaga baterai tanpa tarik kabel listrik',
          consequence: 'Wajib melakukan penggantian/pengisian ulang baterai secara berkala dan memantau indikator low battery.',
          explanation: 'Kemudahan instalasi vs rutinitas perawatan berkala.'
        },
        {
          advantage: 'Bahan stainless steel solid atau kuningan tahan karat',
          consequence: 'Biaya pembelian awal jauh lebih tinggi dibanding material paduan zinc alloy.',
          explanation: 'Daya tahan jangka panjang vs pengeluaran awal.'
        },
        {
          advantage: 'Instalasi mandiri (DIY) yang cepat tanpa tukang',
          consequence: 'Kustomisasi terbatas pada bukaan pintu eksisting tanpa opsi penyesuaian struktural.',
          explanation: 'Kepraktisan pasang vs fleksibilitas konfigurasi arsitektural.'
        }
      ]
    }
  },

  // --------------------------------------------------------------------------
  // LAYER 5: INSTALLATION & OWNERSHIP REALITY
  // --------------------------------------------------------------------------
  layer5_installation_and_ownership: {
    ownership_reality_checkpoints: {
      rule: 'Evaluasi kepemilikan produk tidak berhenti pada kotak kemasan. Redaksi wajib mengulas kenyataan biaya dan kerepotan merawat produk sepanjang masa pakainya.',
      dimensions: [
        'Tingkat kesulitan instalasi (apakah butuh bor khusus, pemahat kayu, atau teknisi listrik berizin)',
        'Kebutuhan kalibrasi awal dan risiko gagal setting',
        'Kebutuhan daya dan stabilitas voltase (risiko kerusakan akibat lonjakan tegangan PLN)',
        'Ketergantungan pada server cloud luar negeri atau pembaruan sistem operasi ponsel',
        'Biaya komponen habis pakai (consumables: filter, baterai, pelumas khusus)',
        'Ketersediaan suku cadang pengganti (kunci manual cadangan, motor penggerak, adaptor)',
        'Prosedur klaim garansi lokal di Indonesia (apakah ada service center resmi atau harus kirim mandiri)'
      ]
    },
    installation_complexity_calibration: {
      rule: 'Klasifikasikan kompleksitas instalasi secara realistis agar pembaca tidak salah mengukur kemampuan mandiri.',
      levels: [
        'DIY_MUDAH',
        'DIY_DENGAN_ALAT_STANDAR',
        'TEKNISI_AHLI_DISARANKAN',
        'INSTALASI_PROFESIONAL_WAJIB'
      ]
    }
  },

  // --------------------------------------------------------------------------
  // LAYER 6: VALUE CALIBRATION
  // --------------------------------------------------------------------------
  layer6_value_calibration: {
    definition_of_value: {
      rule: 'Nilai (Value) produk TIDAK BOLEH disederhanakan menjadi "murah vs mahal". Nilai adalah perbandingan holistik antara fungsi, kecocokan, kualitas, beban kepemilikan, keterbatasan, dan opsi alternatif.',
      formula_components: [
        'FUNCTION',
        'FIT',
        'QUALITY',
        'EXPECTED_OWNERSHIP_BURDEN',
        'LIMITATIONS',
        'ALTERNATIVES'
      ],
      banned_reduction: 'Menyimpulkan suatu produk "worth it" hanya karena harganya di bawah rata-rata pasar tanpa memperhitungkan risiko kerusakan cepat atau ketiadaan garansi.'
    },
    price_integrity: {
      rule: 'Data harga yang dicantumkan harus mencerminkan harga riil di pasar pada saat verifikasi dan mencantumkan waktu pengecekan.',
      handling_price_volatility: 'Jika harga produk bervariasi lebar antar-penjual atau rentan promo kilat, nyatakan rentang harga wajar daripada mencantumkan angka tunggal yang menyesatkan.',
      prohibition: 'Dilarang mengarang harga atau menyembunyikan biaya tambahan tak terduga (ongkos pasang, biaya langganan, aksesori wajib).'
    }
  },

  // --------------------------------------------------------------------------
  // LAYER 7: DECISION RECOMMENDATION
  // --------------------------------------------------------------------------
  layer7_decision_recommendation: {
    approved_reader_terminology: CANONICAL_PRODUCT_REVIEW_TERMINOLOGY,
    recommendation_pattern: {
      rule: 'Rekomendasi akhir harus menggunakan pola keputusan bersyarat berbasis skenario (Scenario-based branching).',
      template: 'Jika kebutuhan Anda X dan kondisi rumah Anda Y, produk ini masuk akal karena Z. Namun jika prioritas Anda adalah W atau kondisi rumah Anda V, keterbatasan A membuat alternatif B lebih cocok.',
      banned_pattern: 'Menyatakan "Produk ini terbaik di kelasnya dan wajib dibeli semua orang" tanpa syarat kontekstual.'
    },
    affiliate_cta_boundary: {
      rule: 'Tautan atau ajakan pembelian afiliasi HANYA boleh diletakkan di akhir setelah alur penalaran editorial selesai. Alur penalaran harus selalu: BUKTI -> ANALISIS -> KECOCOKAN -> REKOMENDASI -> (OPSIONAL: TAUTAN PEMBELIAN).',
      mandatory_flow: ['evidence', 'analysis', 'suitability', 'recommendation', 'optional_purchase_cta'],
      prohibition: 'Dilarang keras menyusun rekomendasi yang diarahkan oleh ketersediaan tautan afiliasi atau besaran komisi penjualan.'
    },
    scoring_policy: {
      rule: 'RancangLoka V1 mengutamakan kejelasan keputusan konsultatif daripada skor angka atau bintang yang dapat dimanipulasi secara gamified.',
      v1_stance: 'Fokus pada utilitas keputusan nyata pembaca: apakah cocok, apa komprominya, dan apa yang harus dicek sebelum membeli.'
    }
  },

  // --------------------------------------------------------------------------
  // COMPARISON FAIRNESS & REVIEW FRESHNESS & COMMERCIAL INTEGRITY
  // --------------------------------------------------------------------------
  comparison_fairness: {
    rule: 'Dalam komparasi produk, semua produk wajib dievaluasi dengan kriteria seragam, konteks kategori yang adil, standar bukti setara, dan varian yang sebanding.',
    mandatory_checks: [
      'Jangan membandingkan produk flagship mahal dengan produk entry-level murah lalu menyatakan flagship sebagai "pemenang mutlak" tanpa menguraikan perbedaan harga dan target pembeli.',
      'Gunakan jendela waktu harga dan pembaruan firmware yang sama untuk seluruh produk yang diperbandingkan.',
      'Sajikan perbandingan dalam tabel kecocokan skenario, bukan podium nomor urut semu.'
    ]
  },

  review_freshness: {
    tracked_metadata: [
      'review_published_date',
      'specifications_verified_date',
      'product_hardware_generation',
      'firmware_or_app_version_evaluated',
      'price_check_date',
      'evidence_source_freshness'
    ],
    decay_triggers: [
      'Pembaruan firmware mayor mengubah stabilitas fitur atau antarmuka aplikasi',
      'Peluncuran generasi baru (Gen 2 / Mark II) dari produk bersangkutan',
      'Perubahan syarat langganan fitur dasar (fitur lokal dipindah ke cloud berbayar)',
      'Penarikan produk (recall) atau penutupan layanan cloud resmi oleh produsen'
    ]
  },

  commercial_integrity: {
    core_rule: 'Pendapatan afiliasi atau sponsor komersial TIDAK BOLEH memengaruhi skor, rekomendasi, urutan produk, pengungkapan kelemahan, atau hasil komparasi.',
    isolation_guarantees: [
      'Dinding api total antara negosiasi komersial dan meja redaksi (Editor Rina & Joko memegang independensi penuh).',
      'Label sponsor atau kemitraan komersial wajib diungkapkan secara transparan kepada pembaca.',
      'Ulasan produk sponsor tetap wajib memuat bagian Keterbatasan dan Pertimbangan Sebelum Membeli.'
    ]
  }
};

// Canonical Alias
export const CANONICAL_PRODUCT_REVIEW_KNOWLEDGE = CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1;

// ============================================================================
// Rina Product Review QA Issue Codes
// ============================================================================

export type ProductReviewQAIssueCode =
  | 'SPEC_DUMP_WITHOUT_INTERPRETATION'
  | 'UNSUPPORTED_SUPERLATIVE'
  | 'VARIANT_IDENTITY_AMBIGUOUS'
  | 'COMPATIBILITY_NOT_EVALUATED'
  | 'LIMITATIONS_UNDERDISCLOSED'
  | 'SINGLE_REVIEW_OVERGENERALIZATION'
  | 'USER_SIGNAL_PRESENTED_AS_FACT'
  | 'FABRICATED_HANDS_ON_TEST'
  | 'COMMERCIAL_BIAS_RISK'
  | 'RECOMMENDATION_NOT_SCENARIO_BASED'
  | 'OUTDATED_PRODUCT_EVIDENCE';

export interface ProductReviewQAIssueDefinition {
  code: ProductReviewQAIssueCode;
  severity: 'CRITICAL_REJECT' | 'REVISE_REQUIRED' | 'WARNING';
  label: string;
  remediation: string;
}

export const PRODUCT_REVIEW_QA_ISSUE_DEFINITIONS: Record<ProductReviewQAIssueCode, ProductReviewQAIssueDefinition> = {
  SPEC_DUMP_WITHOUT_INTERPRETATION: {
    code: 'SPEC_DUMP_WITHOUT_INTERPRETATION',
    severity: 'REVISE_REQUIRED',
    label: 'Spesifikasi Ditumpuk Tanpa Terjemahan Konsekuensi',
    remediation: 'Joko wajib menerjemahkan angka spesifikasi teknis menjadi dampak praktis bagi penggunaan sehari-hari pembaca.'
  },
  UNSUPPORTED_SUPERLATIVE: {
    code: 'UNSUPPORTED_SUPERLATIVE',
    severity: 'REVISE_REQUIRED',
    label: 'Klaim Superlatif Tanpa Bukti Komparatif Kuat',
    remediation: 'Hapus klaim "terbaik di kelasnya", "tercanggih", atau "sempurna" kecuali didukung data uji komparasi valid.'
  },
  VARIANT_IDENTITY_AMBIGUOUS: {
    code: 'VARIANT_IDENTITY_AMBIGUOUS',
    severity: 'CRITICAL_REJECT',
    label: 'Identitas Varian Produk Samar atau Tercampur',
    remediation: 'Tentukan dengan tegas nomor model, generasi, kapasitas, atau varian konektivitas yang diulas.'
  },
  COMPATIBILITY_NOT_EVALUATED: {
    code: 'COMPATIBILITY_NOT_EVALUATED',
    severity: 'REVISE_REQUIRED',
    label: 'Dimensi Kompatibilitas Fisik/Sistem Tidak Diulas',
    remediation: 'Tambahkan analisis kecocokan (ketebalan pintu, tipe jaringan, orientasi cuaca, atau substrat dinding).'
  },
  LIMITATIONS_UNDERDISCLOSED: {
    code: 'LIMITATIONS_UNDERDISCLOSED',
    severity: 'CRITICAL_REJECT',
    label: 'Keterbatasan Produk Tidak Diungkapkan Secara Memadai',
    remediation: 'Wajib mencantumkan bagian kelemahan nyata, batasan fitur, dan kompromi yang harus diterima pembeli.'
  },
  SINGLE_REVIEW_OVERGENERALIZATION: {
    code: 'SINGLE_REVIEW_OVERGENERALIZATION',
    severity: 'REVISE_REQUIRED',
    label: 'Ulasan Pengguna Tunggal Digeneralisasi Jadi Cacat Produk',
    remediation: 'Pisahkan keluhan insidental individual dari pola kegagalan berulang yang terkonfirmasi banyak pengguna.'
  },
  USER_SIGNAL_PRESENTED_AS_FACT: {
    code: 'USER_SIGNAL_PRESENTED_AS_FACT',
    severity: 'REVISE_REQUIRED',
    label: 'Sinyal Persepsi Pengguna Disajikan Sebagai Fakta Teknis',
    remediation: 'Beri label sinyal sentimen pembeli secara jujur dan kalibrasikan dengan bukti teknis resmi.'
  },
  FABRICATED_HANDS_ON_TEST: {
    code: 'FABRICATED_HANDS_ON_TEST',
    severity: 'CRITICAL_REJECT',
    label: 'Klaim Pengujian Fisik Palsu atau Menyesatkan',
    remediation: 'Hapus seluruh frasa "kami sudah mencoba/menguji" jika artikel bertipe ulasan analitis tanpa unit fisik riil.'
  },
  COMMERCIAL_BIAS_RISK: {
    code: 'COMMERCIAL_BIAS_RISK',
    severity: 'CRITICAL_REJECT',
    label: 'Rekomendasi Didorong Penjualan Afiliasi / Kemitraan',
    remediation: 'Susun ulang alur penalaran murni berdasar kecocokan skenario pengguna. Tautan afiliasi hanya opsi pasif di penutup.'
  },
  RECOMMENDATION_NOT_SCENARIO_BASED: {
    code: 'RECOMMENDATION_NOT_SCENARIO_BASED',
    severity: 'REVISE_REQUIRED',
    label: 'Rekomendasi Bersifat Absolut Tanpa Skenario Pemakaian',
    remediation: 'Ubah rekomendasi menjadi format kondisional ("Cocok jika Anda butuh X, namun kurang cocok jika prioritas Anda Y").'
  },
  OUTDATED_PRODUCT_EVIDENCE: {
    code: 'OUTDATED_PRODUCT_EVIDENCE',
    severity: 'REVISE_REQUIRED',
    label: 'Data Spesifikasi atau Harga Produk Sudah Kedaluwarsa',
    remediation: 'Irwan wajib memperbarui verifikasi spesifikasi, status ketersediaan, atau pembaruan firmware terkini.'
  }
};

// ============================================================================
// Practical Validation Functions for Guards & Pipelines
// ============================================================================

/**
 * Checks for fabricated hands-on claims in an article text.
 */
export function detectFabricatedHandsOnClaims(
  content: string,
  reviewType: ProductReviewType = 'ANALYTICAL_REVIEW',
  hasFirstPartyPhysicalEvidence: boolean = false
): {
  has_violation: boolean;
  detected_phrases: string[];
  violation_code?: ProductReviewQAIssueCode;
} {
  if (reviewType === 'HANDS_ON_REVIEW' && hasFirstPartyPhysicalEvidence) {
    return { has_violation: false, detected_phrases: [] };
  }

  const lowerContent = content.toLowerCase();
  const detected: string[] = [];

  for (const phrase of BANNED_HANDS_ON_PHRASES) {
    if (lowerContent.includes(phrase.toLowerCase())) {
      detected.push(phrase);
    }
  }

  // Also check "tested by rancangloka" without first-party physical evidence
  if (lowerContent.includes('tested by rancangloka') && !hasFirstPartyPhysicalEvidence) {
    detected.push('tested by rancangloka');
  }

  return {
    has_violation: detected.length > 0,
    detected_phrases: detected,
    violation_code: detected.length > 0 ? 'FABRICATED_HANDS_ON_TEST' : undefined
  };
}

/**
 * Validates the affiliate CTA boundary to ensure editorial reasoning precedes purchase options.
 */
export function validateAffiliateCTABoundary(articleStructure: {
  has_evidence: boolean;
  has_analysis: boolean;
  has_suitability: boolean;
  has_recommendation: boolean;
  affiliate_cta_position: 'BEFORE_RECOMMENDATION' | 'AFTER_RECOMMENDATION' | 'NONE';
}): {
  is_valid: boolean;
  issue?: ProductReviewQAIssueCode;
  reason?: string;
} {
  if (articleStructure.affiliate_cta_position === 'BEFORE_RECOMMENDATION') {
    return {
      is_valid: false,
      issue: 'COMMERCIAL_BIAS_RISK',
      reason: 'Affiliate CTA muncul sebelum rekomendasi dan analisis editorial selesai.'
    };
  }

  if (articleStructure.affiliate_cta_position === 'AFTER_RECOMMENDATION') {
    if (!articleStructure.has_evidence || !articleStructure.has_analysis || !articleStructure.has_recommendation) {
      return {
        is_valid: false,
        issue: 'COMMERCIAL_BIAS_RISK',
        reason: 'Rekomendasi dan analisis tidak lengkap sebelum menampilkan tautan afiliasi.'
      };
    }
  }

  return { is_valid: true };
}

// ============================================================================
// Role-Specific Knowledge Views / Adapters for Product Reviews
// ============================================================================

export interface IrwanProductEvidenceKnowledgeView {
  persona: string;
  role: string;
  evidence_hierarchy: typeof PRODUCT_EVIDENCE_HIERARCHY;
  claim_classes: typeof PRODUCT_CLAIM_CLASSES;
  distinctions: {
    fact_vs_signal_vs_inference: string;
    manufacturer_vs_measured_vs_user: string;
  };
  recurring_complaint_threshold: string;
  freshness_rules: typeof CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.review_freshness;
  authority: {
    verify_specifications: boolean;
    audit_compatibility_evidence: boolean;
    verify_physical_test_artifacts: boolean;
    author_user_facing_copy: boolean;
  };
}

export interface JokoProductReviewKnowledgeView {
  persona: string;
  role: string;
  voice: {
    tone: string;
    banned_modes: string[];
    expert_to_client_flow: string[];
  };
  translation_pattern: ['technical_spec', 'human_explanation', 'practical_consequence'];
  use_case_and_compatibility: ProductReviewLayer2_UseCaseAndCompatibility;
  limitations_and_trade_offs: ProductReviewLayer4_LimitationsAndTradeOffs;
  recommendation_pattern: {
    template: string;
    banned_pattern: string;
  };
  reader_terminology: typeof CANONICAL_PRODUCT_REVIEW_TERMINOLOGY;
  hands_on_boundary: {
    banned_phrases: string[];
    rule: string;
  };
  authority: {
    author_review_copy: boolean;
    override_evidence_limits: boolean;
    insert_affiliate_prior_to_analysis: boolean;
  };
}

export interface RinaProductReviewQAKnowledgeView {
  persona: string;
  role: string;
  qa_issue_catalog: typeof PRODUCT_REVIEW_QA_ISSUE_DEFINITIONS;
  hands_on_boundary_check: typeof detectFabricatedHandsOnClaims;
  affiliate_boundary_check: typeof validateAffiliateCTABoundary;
  commercial_neutrality_rules: typeof CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.commercial_integrity;
  qa_responsibilities: {
    reject_unsupported_superlatives: boolean;
    reject_fabricated_hands_on: boolean;
    reject_unscenario_recommendations: boolean;
    enforce_limitation_disclosure: boolean;
    enforce_compatibility_checks: boolean;
  };
  authority: {
    approve_for_publication: boolean;
    reject_to_author: boolean;
    autonomous_publishing: boolean;
  };
}

export interface SariProductReviewPublicationKnowledgeView {
  persona: string;
  role: string;
  publication_invariants: {
    review_type_declared: boolean;
    commercial_disclosure_verified: boolean;
    reader_terminology_compliant: boolean;
    hands_on_evidence_verified_if_claimed: boolean;
    cannot_override_rina_or_irwan_rejection: boolean;
    auto_publish_state: 'OFF';
  };
  authority: {
    dispatch_publication: boolean;
    override_qa_failure: boolean;
  };
}

export interface JefryProductReviewAdvisoryKnowledgeView {
  persona: string;
  role: string;
  operating_mode: 'SHADOW_MODE_ONLY';
  authority: {
    autonomous_execution: boolean;
    review_writing: boolean;
    score_manipulation: boolean;
    product_recommendation_execution: boolean;
    commercial_influence: boolean;
  };
  observation_scope: string[];
}

/**
 * Derives role-specific view for Irwan (Product Evidence & Research Lead).
 */
export function getIrwanProductEvidenceKnowledge(): IrwanProductEvidenceKnowledgeView {
  return {
    persona: 'Irwan — Product Evidence & Research Lead',
    role: 'Irwan — Technical Documentation & Physical Verification Specialist',
    evidence_hierarchy: CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.evidence_hierarchy,
    claim_classes: CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.claim_classes,
    distinctions: {
      fact_vs_signal_vs_inference: 'Irwan memisahkan secara ketat data faktual spesifikasi, sinyal pengalaman pengguna, dan inferensi redaksional.',
      manufacturer_vs_measured_vs_user: 'Klaim brosur pabrikan tidak boleh dicampuradukkan dengan hasil ukur independen atau laporan keandalan di lapangan.'
    },
    recurring_complaint_threshold: 'Keluhan pengguna hanya diakui sebagai masalah berulang jika didukung pola konsisten dari minimal multi-laporan terpisah.',
    freshness_rules: CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.review_freshness,
    authority: {
      verify_specifications: true,
      audit_compatibility_evidence: true,
      verify_physical_test_artifacts: true,
      author_user_facing_copy: false
    }
  };
}

/**
 * Derives role-specific view for Joko (Product Review Writer & Expert Advisor).
 */
export function getJokoProductReviewKnowledge(): JokoProductReviewKnowledgeView {
  return {
    persona: 'Joko — Product Review Writer & Expert Advisor',
    role: 'Joko — Consumer Advocate & Architecture-Savvy Consultant',
    voice: {
      tone: 'Bahasa Indonesia lugas, jujur, hangat, dan berpihak pada keamanan serta anggaran pembeli.',
      banned_modes: [
        'Katalog produk kering',
        'Halaman sales marketplace',
        'Siaran pers humas produsen',
        'Artikel affiliate generik / spam review'
      ],
      expert_to_client_flow: [
        'Reader Problem',
        'Context Qualification',
        'Product Fit',
        'Evidence',
        'Feature Interpretation',
        'Compatibility',
        'Real-World Signals',
        'Limitations',
        'Trade-Offs',
        'Alternatives / Scenario Fit',
        'Recommendation',
        'Pre-Purchase Checklist'
      ]
    },
    translation_pattern: CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.layer1_identity_and_specs.feature_consequence_translation.pattern,
    use_case_and_compatibility: CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.layer2_use_case_and_compatibility,
    limitations_and_trade_offs: CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.layer4_limitations_and_trade_offs,
    recommendation_pattern: CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.layer7_decision_recommendation.recommendation_pattern,
    reader_terminology: CANONICAL_PRODUCT_REVIEW_TERMINOLOGY,
    hands_on_boundary: {
      banned_phrases: BANNED_HANDS_ON_PHRASES,
      rule: HANDS_ON_BOUNDARY_RULES.rule
    },
    authority: {
      author_review_copy: true,
      override_evidence_limits: false,
      insert_affiliate_prior_to_analysis: false
    }
  };
}

/**
 * Derives role-specific view for Rina (Product Review Editorial QA).
 */
export function getRinaProductReviewQAKnowledge(): RinaProductReviewQAKnowledgeView {
  return {
    persona: 'Rina — Product Review Senior Editorial QA',
    role: 'Rina — Commercial Neutrality & Evidence Integrity Guardian',
    qa_issue_catalog: PRODUCT_REVIEW_QA_ISSUE_DEFINITIONS,
    hands_on_boundary_check: detectFabricatedHandsOnClaims,
    affiliate_boundary_check: validateAffiliateCTABoundary,
    commercial_neutrality_rules: CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.commercial_integrity,
    qa_responsibilities: {
      reject_unsupported_superlatives: true,
      reject_fabricated_hands_on: true,
      reject_unscenario_recommendations: true,
      enforce_limitation_disclosure: true,
      enforce_compatibility_checks: true
    },
    authority: {
      approve_for_publication: true,
      reject_to_author: true,
      autonomous_publishing: false
    }
  };
}

/**
 * Derives role-specific view for Sari (Publication Operations & Safety Lead).
 */
export function getSariProductReviewPublicationKnowledge(): SariProductReviewPublicationKnowledgeView {
  return {
    persona: 'Sari — Publication Operations Lead',
    role: 'Sari — Product Review Gatekeeper & Dispatch Controller',
    publication_invariants: {
      review_type_declared: true,
      commercial_disclosure_verified: true,
      reader_terminology_compliant: true,
      hands_on_evidence_verified_if_claimed: true,
      cannot_override_rina_or_irwan_rejection: true,
      auto_publish_state: 'OFF'
    },
    authority: {
      dispatch_publication: true,
      override_qa_failure: false
    }
  };
}

/**
 * Derives role-specific view for Jefry (Shadow Advisory / TypeSafe JEV).
 */
export function getJefryProductReviewAdvisoryKnowledge(): JefryProductReviewAdvisoryKnowledgeView {
  return {
    persona: 'Jefry — Management Decision Advisor (TypeSafe JEV)',
    role: 'Jefry — Product Review Shadow Decision Observer',
    operating_mode: 'SHADOW_MODE_ONLY',
    authority: {
      autonomous_execution: false,
      review_writing: false,
      score_manipulation: false,
      product_recommendation_execution: false,
      commercial_influence: false
    },
    observation_scope: [
      'product_review_recommendation_distribution',
      'recurring_complaint_detection_accuracy',
      'commercial_neutrality_telemetry'
    ]
  };
}
