/**
 * ============================================================================
 * RancangLoka Product Review Desk (PRODUCT_REVIEW_AFFILIATE-1C)
 * Admin Product Review Desk & Editorial Inspector Helper Module
 *
 * Core Principles & Invariants:
 * 1. THE_PRODUCT_IS_NOT_THE_CENTER_OF_THE_ARTICLE
 *    The reader's architectural decision is primary. Product review operates
 *    strictly downstream of the PDE solution class decision.
 * 2. EDITORIAL_CONCLUSION_MUST_NOT_VISUALLY_APPEAR_COMMERCE_DRIVEN
 *    Editorial reviews, technical evidence, and specifications are segregated
 *    from marketplace offers, prices, and affiliate links.
 * 3. NO_FAKE_NUMERIC_PRECISION
 *    Zero overall scores, ratings, or percentages. Pure qualitative match taxonomy.
 * 4. ADMIN_MUST_KNOW_WHICH_DATA_SOURCE_IS_BEING_INSPECTED
 *    Clear identification of SYNTHETIC_TEST_DATA vs LOCAL_DATABASE vs PRODUCTION_D1.
 * 5. NO_AUTONOMOUS_APPROVAL
 *    Read-only inspection by default; Chief Editor retains final human authority.
 * ============================================================================
 */

import type {
  Product,
  EditorialProductReview,
  Variant,
  EvidenceSource,
  SpecSnapshot,
  ReviewSnapshot,
  Offer,
  PriceSnapshot,
  AffiliateDestination,
  ArticleProductBinding,
  CommercialDisclosure,
  ProductIdentityState,
  ReviewMode,
  EditorialReviewStatus,
  ProductMatchStatus,
  ProductMatchResult,
  ProductReviewHandoffContract,
  SourceFidelity,
  ReviewClaimClass,
  EvidenceSourceType
} from './types.ts';
import {
  SYNTHETIC_PRODUCT,
  SYNTHETIC_VARIANT_1,
  SYNTHETIC_VARIANT_2,
  SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL,
  SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON,
  SYNTHETIC_SPEC_SNAPSHOT,
  SYNTHETIC_EVIDENCE_MANUFACTURER,
  SYNTHETIC_EVIDENCE_LAB_TEST,
  SYNTHETIC_EVIDENCE_PRIMARY_TEST,
  SYNTHETIC_REVIEW_SNAPSHOT,
  SYNTHETIC_OFFER_MERCHANT_A,
  SYNTHETIC_OFFER_MERCHANT_B,
  SYNTHETIC_PRICE_SNAPSHOT_A,
  SYNTHETIC_PRICE_SNAPSHOT_B,
  SYNTHETIC_AFFILIATE_DESTINATION_A,
  SYNTHETIC_AFFILIATE_DESTINATION_B,
  SYNTHETIC_ARTICLE_PRODUCT_BINDING
} from './fixtures.ts';
import {
  evaluateEntityFreshness,
  DEFAULT_FRESHNESS_POLICY,
  type FreshnessEvaluation,
  type FreshnessStatus
} from './freshness.ts';
import {
  evaluateTechnicalProductMatch,
  validateIdentityDrift,
  scanForForbiddenReviewCommerceFields
} from './contracts.ts';
import {
  assembleTechnicalMatchInput,
  type TechnicalMatchInputDTO
} from './store.ts';

// ============================================================================
// 1. DATA SOURCE DEFINITIONS
// ============================================================================

export type AdminReviewDataSource =
  | 'SYNTHETIC_TEST_DATA'
  | 'LOCAL_DATABASE'
  | 'PRODUCTION_D1';

export interface DataSourceMetadata {
  source: AdminReviewDataSource;
  label: string;
  badgeClass: string;
  bannerClass: string;
  description: string;
  isTestOnly: boolean;
}

export const DATA_SOURCE_CONFIG: Record<AdminReviewDataSource, DataSourceMetadata> = {
  SYNTHETIC_TEST_DATA: {
    source: 'SYNTHETIC_TEST_DATA',
    label: 'Data Uji Sintesis (SYNTHETIC_TEST_DATA)',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
    bannerClass: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-200',
    description: 'Data uji coba terisolasi untuk simulasi alur kerja redaksi. Tidak menggunakan merek riil komersial atau listing marketplace nyata.',
    isTestOnly: true
  },
  LOCAL_DATABASE: {
    source: 'LOCAL_DATABASE',
    label: 'Database Lokal (LOCAL_DATABASE)',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800',
    bannerClass: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-200',
    description: 'Data bersumber dari database SQLite lokal (tabel product_review_*).',
    isTestOnly: false
  },
  PRODUCTION_D1: {
    source: 'PRODUCTION_D1',
    label: 'Cloudflare D1 Produksi (PRODUCTION_D1)',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
    bannerClass: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-200',
    description: 'Data langsung dari Cloudflare D1 Production. Mode inspeksi aman (read-only).',
    isTestOnly: false
  }
};

// ============================================================================
// 2. EDITORIAL READINESS STATE
// ============================================================================

export type EditorialReadinessState =
  | 'READY_FOR_EDITORIAL_REVIEW'
  | 'EVIDENCE_INCOMPLETE'
  | 'SPEC_STALE'
  | 'IDENTITY_REVIEW_REQUIRED'
  | 'HANDS_ON_PROVENANCE_INCOMPLETE'
  | 'INSUFFICIENT_TECHNICAL_EVIDENCE';

export interface EditorialReadinessConfig {
  state: EditorialReadinessState;
  label: string;
  badgeClass: string;
  description: string;
  actionHint: string;
}

export const EDITORIAL_READINESS_CONFIG: Record<EditorialReadinessState, EditorialReadinessConfig> = {
  READY_FOR_EDITORIAL_REVIEW: {
    state: 'READY_FOR_EDITORIAL_REVIEW',
    label: 'Siap Ulasan Editorial',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    description: 'Identitas produk valid, spesifikasi teknis segar, dan bukti empiris terverifikasi lengkap.',
    actionHint: 'Dapat dilanjutkan oleh Joko (penulisan ulasan) atau Rina (verifikasi integritas).'
  },
  EVIDENCE_INCOMPLETE: {
    state: 'EVIDENCE_INCOMPLETE',
    label: 'Bukti Belum Lengkap',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    description: 'Belum ada sumber bukti otoritatif (dokumen teknis/manual) yang dilampirkan.',
    actionHint: 'Irwan perlu melengkapi sumber bukti primer atau dokumen pabrikan.'
  },
  SPEC_STALE: {
    state: 'SPEC_STALE',
    label: 'Spesifikasi Kadaluarsa',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    description: 'Snapshot spesifikasi teknis telah melewati batas umur kebijakan kesegaran.',
    actionHint: 'Perlu pengambilan snapshot spesifikasi baru dari dokumen pabrikan termutakhir.'
  },
  IDENTITY_REVIEW_REQUIRED: {
    state: 'IDENTITY_REVIEW_REQUIRED',
    label: 'Perlu Tinjauan Identitas',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
    description: 'Terdeteksi pergeseran identitas produk (varian baru, listing ambigu, atau pergantian generasi).',
    actionHint: 'Editor perlu memverifikasi apakah ini produk yang sama atau SKU berbeda.'
  },
  HANDS_ON_PROVENANCE_INCOMPLETE: {
    state: 'HANDS_ON_PROVENANCE_INCOMPLETE',
    label: 'Provenansi Pengujian Tidak Lengkap',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    description: 'Ulasan berstatus Hands-On namun kekurangan data uji lab/workshop primer.',
    actionHint: 'Lengkapi tanggal pengujian, identitas penguji, lokasi, metodologi, dan lembar uji primer.'
  },
  INSUFFICIENT_TECHNICAL_EVIDENCE: {
    state: 'INSUFFICIENT_TECHNICAL_EVIDENCE',
    label: 'Bukti Teknis Tidak Cukup',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800',
    description: 'Spesifikasi fisik tidak mencukupi untuk menentukan kecocokan dengan solusi arsitektur.',
    actionHint: 'Dilarang menebak kualitas produk; peroleh dokumen uji tambahan sebelum publikasi.'
  }
};

/**
 * Validates whether a Hands-On review strictly meets primary test provenance invariants.
 */
export function validateHandsOnProvenance(
  review: EditorialProductReview,
  evidenceSources?: EvidenceSource[] | readonly EvidenceSource[]
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (review.review_mode !== 'HANDS_ON_REVIEW') {
    return { valid: true, issues: [] };
  }

  if (!review.tested_by_rancangloka) {
    issues.push('tested_by_rancangloka wajib bernilai true untuk HANDS_ON_REVIEW.');
  }

  const prov = review.testing_provenance;
  if (!prov) {
    issues.push('Objek testing_provenance wajib tersedia untuk HANDS_ON_REVIEW.');
  } else {
    if (!prov.testing_date || prov.testing_date.trim() === '') {
      issues.push('testing_date (tanggal pengujian) wajib dicantumkan.');
    }
    if (!prov.tester_identity || prov.tester_identity.trim() === '') {
      issues.push('tester_identity (identitas penguji) wajib dicantumkan.');
    }
    if (!prov.testing_location || prov.testing_location.trim() === '') {
      issues.push('testing_location (lokasi workshop/fasilitas uji) wajib dicantumkan.');
    }
    if (!prov.methodology_notes || prov.methodology_notes.trim() === '') {
      issues.push('methodology_notes (catatan metodologi pengujian) wajib dicantumkan.');
    }
  }

  if (evidenceSources) {
    const hasPrimaryTest = evidenceSources.some(
      src => src.source_type === 'RANCANGLOKA_PRIMARY_TEST'
    );
    if (!hasPrimaryTest) {
      issues.push('Minimal harus memiliki satu EvidenceSource bertipe RANCANGLOKA_PRIMARY_TEST.');
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Derives the editorial readiness state for a product inspection view.
 */
export function deriveEditorialReadiness(params: {
  product: Product;
  reviews: EditorialProductReview[];
  specSnapshot?: SpecSnapshot;
  evidenceSources?: EvidenceSource[] | readonly EvidenceSource[];
  technicalMatch?: ProductMatchResult;
}): { state: EditorialReadinessState; reasons: string[] } {
  const { product, reviews, specSnapshot, evidenceSources, technicalMatch } = params;
  const reasons: string[] = [];

  // 1. Identity state check
  if (product.identity_state !== 'CURRENT') {
    reasons.push(`Identitas produk berstatus '${product.identity_state}', memerlukan verifikasi redaksi.`);
    return { state: 'IDENTITY_REVIEW_REQUIRED', reasons };
  }

  // 2. Hands-on provenance check for any hands-on reviews
  for (const rev of reviews) {
    if (rev.review_mode === 'HANDS_ON_REVIEW') {
      const check = validateHandsOnProvenance(rev, evidenceSources);
      if (!check.valid) {
        reasons.push(...check.issues);
        return { state: 'HANDS_ON_PROVENANCE_INCOMPLETE', reasons };
      }
    }
  }

  // 3. Evidence sources check
  if (!evidenceSources || evidenceSources.length === 0) {
    reasons.push('Tidak ada dokumen bukti empiris yang terhubung ke produk ini.');
    return { state: 'EVIDENCE_INCOMPLETE', reasons };
  }

  // 4. Spec snapshot freshness check
  if (!specSnapshot) {
    reasons.push('Belum ada snapshot spesifikasi teknis.');
    return { state: 'SPEC_STALE', reasons };
  }

  const specFreshness = evaluateEntityFreshness('spec_snapshot', specSnapshot.captured_at);
  if (!specFreshness.is_fresh) {
    reasons.push(`Spesifikasi teknis berstatus '${specFreshness.status}' (diambil ${specSnapshot.captured_at}).`);
    return { state: 'SPEC_STALE', reasons };
  }

  // 5. Technical match adequacy check
  if (technicalMatch && technicalMatch.match_status === 'INSUFFICIENT_EVIDENCE') {
    reasons.push('Data spesifikasi belum mencukupi untuk evaluasi kecocokan arsitektural.');
    return { state: 'INSUFFICIENT_TECHNICAL_EVIDENCE', reasons };
  }

  return {
    state: 'READY_FOR_EDITORIAL_REVIEW',
    reasons: ['Seluruh persyaratan integritas data teknis dan provenansi redaksi terpenuhi.']
  };
}

// ============================================================================
// 3. TAXONOMY DISPLAY CONFIGURATIONS (INDONESIAN LABELS & QUALITATIVE BADGES)
// ============================================================================

export const PRODUCT_IDENTITY_STATE_CONFIG: Record<ProductIdentityState, { label: string; badgeClass: string; warning?: string }> = {
  CURRENT: {
    label: 'Identitas Valid (CURRENT)',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
  },
  IDENTITY_CHANGED: {
    label: 'Generasi Baru (IDENTITY_CHANGED)',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    warning: 'Produk ini telah diperbarui atau digantikan oleh model revisi baru oleh pabrikan.'
  },
  VARIANT_CHANGED: {
    label: 'SKU Bergeser (VARIANT_CHANGED)',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    warning: 'Terdapat perbedaan nomor model/SKU listing penjual dibanding model terdaftar di database.'
  },
  LISTING_AMBIGUOUS: {
    label: 'Listing Ambigu (LISTING_AMBIGUOUS)',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
    warning: 'Judul listing toko pihak ketiga menyimpang dari nama kanonikal produk pabrikan.'
  },
  DISCONTINUED: {
    label: 'Dihentikan Pabrikan (DISCONTINUED)',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    warning: 'Produk tidak lagi diproduksi oleh pabrikan resmi.'
  },
  UNAVAILABLE: {
    label: 'Stok Kosong Menyeluruh (UNAVAILABLE)',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    warning: 'Tidak ditemukan penawaran merchant aktif yang menyediakan produk ini.'
  }
};

export const REVIEW_MODE_CONFIG: Record<ReviewMode, { label: string; badgeClass: string; testedBadge: string }> = {
  ANALYTICAL_REVIEW: {
    label: 'Ulasan Analitis (ANALYTICAL_REVIEW)',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
    testedBadge: 'Tidak (Analytical Only)'
  },
  HANDS_ON_REVIEW: {
    label: 'Ulasan Uji Fisik (HANDS_ON_REVIEW)',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    testedBadge: 'Ya (Tested by RancangLoka)'
  }
};

export const EDITORIAL_STATUS_CONFIG: Record<EditorialReviewStatus, { label: string; badgeClass: string }> = {
  DRAFT: {
    label: 'Draf (DRAFT)',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
  },
  REVIEWED: {
    label: 'Telah Ditinjau (REVIEWED)',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
  },
  PUBLISHED: {
    label: 'Terpublikasi (PUBLISHED)',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
  },
  ARCHIVED: {
    label: 'Arsip (ARCHIVED)',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
  }
};

export const PRODUCT_MATCH_CONFIG: Record<ProductMatchStatus, { label: string; badgeClass: string; description: string }> = {
  MATCH: {
    label: 'Cocok Penuh (MATCH)',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    description: 'Produk memenuhi seluruh karakteristik teknis arsitektur yang disyaratkan oleh keputusan PDE.'
  },
  MATCH_WITH_TRADEOFF: {
    label: 'Cocok dengan Kompromi (MATCH_WITH_TRADEOFF)',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
    description: 'Produk cocok dengan kelas solusi namun memiliki kompromi fisik yang perlu dimitigasi.'
  },
  CONDITIONAL_MATCH: {
    label: 'Cocok Bersyarat (CONDITIONAL_MATCH)',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    description: 'Hanya cocok jika prasyarat instalasi teknis tertentu terpenuhi di lapangan.'
  },
  NOT_MATCH: {
    label: 'Tidak Cocok (NOT_MATCH)',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    description: 'Produk tidak sesuai dengan kelas solusi yang direkomendasikan atau melanggar kriteria red-line.'
  },
  INSUFFICIENT_EVIDENCE: {
    label: 'Bukti Kurang (INSUFFICIENT_EVIDENCE)',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    description: 'Spesifikasi teknis terverifikasi belum mencukupi untuk penilaian deterministik.'
  }
};

export type InspectionFreshnessState = 'FRESH' | 'AGING' | 'STALE' | 'UNAVAILABLE';

export const INSPECTION_FRESHNESS_CONFIG: Record<InspectionFreshnessState, { label: string; badgeClass: string }> = {
  FRESH: {
    label: 'Termutakhir (FRESH)',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
  },
  AGING: {
    label: 'Mendekati Usang (AGING)',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
  },
  STALE: {
    label: 'Kadaluarsa (STALE)',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
  },
  UNAVAILABLE: {
    label: 'Tidak Tersedia (UNAVAILABLE)',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
  }
};

export function resolveInspectionFreshness(evaluation?: FreshnessEvaluation): InspectionFreshnessState {
  if (!evaluation) return 'UNAVAILABLE';
  if (!evaluation.is_fresh) return 'STALE';
  if (evaluation.days_remaining <= 14) return 'AGING';
  return 'FRESH';
}

export const SOURCE_FIDELITY_CONFIG: Record<SourceFidelity, { label: string; badgeClass: string }> = {
  PRIMARY_DOCUMENT: {
    label: 'Dokumen Primer (PRIMARY_DOCUMENT)',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
  },
  SECONDARY_ANALYSIS: {
    label: 'Analisis Sekunder (SECONDARY_ANALYSIS)',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
  },
  USER_OBSERVATION: {
    label: 'Observasi Pengguna (USER_OBSERVATION)',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
  },
  MANUFACTURER_CLAIM: {
    label: 'Klaim Pabrikan (MANUFACTURER_CLAIM)',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
  }
};

export const SOURCE_TYPE_LABELS: Record<EvidenceSourceType, string> = {
  MANUFACTURER: 'Dokumen Resmi Pabrikan',
  OFFICIAL_MANUAL: 'Buku Manual Resmi',
  TECHNICAL_DATASHEET: 'Lembar Spesifikasi Teknis',
  INDEPENDENT_REVIEW: 'Ulasan Teknis Independen',
  MERCHANT_LISTING: 'Informasi Listing Merchant',
  USER_REVIEW_AGGREGATE: 'Agregator Pengalaman Pengguna',
  RANCANGLOKA_PRIMARY_TEST: 'Uji Primer Lab Redaksi RancangLoka'
};

// ============================================================================
// 4. CANONICAL SYNTHETIC PDE HANDOFF (PDE-1C -> PRODUCT REVIEW DESK INTEGRATION)
// ============================================================================

export const SYNTHETIC_PDE_HANDOFF: ProductReviewHandoffContract = {
  problem_id: 'prob_kusen_jendela_tropis',
  solution_class_id: 'sol_upvc_multi_chamber',
  selected_solution_class_id: 'sol_upvc_multi_chamber',
  required_characteristics: [
    'chamber_count: 5',
    'uv_stabilizer_type: TIO2_TROPICAL_GRADE',
    'corner_joint_method: WELDED_FUSION',
    'corrosion_resistant: true'
  ],
  important_tradeoffs: [
    {
      benefit: 'Insulasi termal u-value 1.4 dan reduksi akustik 34 dB superior untuk kamar tidur barat',
      compromise: 'Bobot profil 60mm membutuhkan penguat baja 1.5mm dan tukang terlatih'
    }
  ],
  must_avoid_characteristics: [
    'profil_single_chamber',
    'sambungan_sekrup_mekanikal_bocor'
  ],
  context_summary: {
    problem_title: 'Pemilihan Kusen Jendela untuk Kamar Tidur Utama Paparan Barat',
    building_context: 'Rumah Tinggal Tropis Lembap',
    climate_exposure: 'Panas Sore Intensif & Tempias Hujan Barat',
    priority: 'Kenyamanan Akustik & Hambatan Panas Maksimal'
  },
  model_version_key: 'model_pde_kusen_tropis_v1',
  evidence_version: '1427598835821c609d43bf7cfab7ef4a7be6ff12398481329c0f97d26425333f',
  commercial_data_allowed: false
};

// ============================================================================
// 5. EXTENDED SYNTHETIC FIXTURE CATALOG (DEMONSTRATING DRIFT & FRESHNESS)
// ============================================================================

const VARIANT_ALUM_DRIFT: Variant = {
  variant_id: 'var_synth_alum_black_4in',
  product_id: 'prod_synthetic_alum_drift_02',
  sku_or_model: 'IA-ALUM-4IN-BK',
  variant_name: 'Profil 4 Inch Hitam Doff',
  identity_state: 'LISTING_AMBIGUOUS'
};

const SPEC_ALUM_DRIFT: SpecSnapshot = {
  spec_snapshot_id: 'spec_snap_alum_02',
  product_id: 'prod_synthetic_alum_drift_02',
  captured_at: '2026-10-10T10:00:00Z',
  source_id: 'src_synth_mfg_alum_01',
  specs: {
    profile_depth_mm: 101.6,
    wall_thickness_mm: 1.35,
    coating_type: 'POWDER_COAT_80_MICRON',
    thermal_break: false
  },
  source_fidelity: 'PRIMARY_DOCUMENT'
};

const EVIDENCE_ALUM_DRIFT: EvidenceSource = {
  source_id: 'src_synth_mfg_alum_01',
  source_type: 'MANUFACTURER',
  source_url: 'https://specs.fictional-indoalum.id/datasheet-4in.pdf',
  publisher: 'IndoAlum Arch Profiles Corp',
  retrieved_at: '2026-10-10T09:00:00Z',
  evidence_scope: 'Architectural aluminum profile thickness and anodizing/powder coating standards',
  claim_class: 'TECHNICAL_CONSENSUS',
  source_fidelity: 'PRIMARY_DOCUMENT',
  product_identity_reference: 'prod_synthetic_alum_drift_02'
};

/**
 * Product 2: Demonstrating Identity Drift (LISTING_AMBIGUOUS)
 */
export const SYNTHETIC_PRODUCT_DRIFTED: Product = {
  product_id: 'prod_synthetic_alum_drift_02',
  brand: 'IndoAlum Jaya (Fictional)',
  canonical_name: 'Kusen Aluminium Powder Coated 4 Inch',
  category_id: 'cat_kusen_jendela',
  solution_class_id: 'sol_aluminium_powder_coated',
  identity_state: 'LISTING_AMBIGUOUS',
  variants: [VARIANT_ALUM_DRIFT],
  spec_snapshots: [SPEC_ALUM_DRIFT],
  evidence_sources: [EVIDENCE_ALUM_DRIFT],
  review_snapshots: []
};

export const SYNTHETIC_EDITORIAL_REVIEW_DRIFTED: EditorialProductReview = {
  review_id: 'rev_synth_alum_drift_01',
  product_id: 'prod_synthetic_alum_drift_02',
  review_mode: 'ANALYTICAL_REVIEW',
  tested_by_rancangloka: false,
  editorial_status: 'DRAFT',
  reviewed_at: '2026-10-11T11:00:00Z',
  reviewer_identity: 'Joko (Editor Konstruksi)',
  notes: 'Analisis awal profil aluminium 4 inch. Listing merchant menyimpang menjadi "Kusen Alum Murah Universal".'
};

const SPEC_WPC_STALE: SpecSnapshot = {
  spec_snapshot_id: 'spec_snap_wpc_old_03',
  product_id: 'prod_synthetic_wood_composite_03',
  captured_at: '2026-05-10T08:00:00Z', // > 150 days old -> STALE
  source_id: 'src_synth_wpc_mfg',
  specs: {
    polymer_wood_ratio: '60/40',
    density_g_cm3: 1.15,
    water_absorption_rate_pct: 0.8
  },
  source_fidelity: 'SECONDARY_ANALYSIS'
};

const EVIDENCE_WPC_STALE: EvidenceSource = {
  source_id: 'src_synth_wpc_mfg',
  source_type: 'TECHNICAL_DATASHEET',
  source_url: 'https://specs.fictional-rimba-wpc.id/wpc-datasheet-2026.pdf',
  publisher: 'Rimba Tropika WPC Engineering',
  retrieved_at: '2026-05-10T08:00:00Z',
  evidence_scope: 'Polymer wood composite density and swelling test',
  claim_class: 'TECHNICAL_CONSENSUS',
  source_fidelity: 'SECONDARY_ANALYSIS',
  product_identity_reference: 'prod_synthetic_wood_composite_03'
};

/**
 * Product 3: Demonstrating Stale Spec Snapshot (> 90 days)
 */
export const SYNTHETIC_PRODUCT_STALE_SPEC: Product = {
  product_id: 'prod_synthetic_wood_composite_03',
  brand: 'Rimaba Tropika WPC (Fictional)',
  canonical_name: 'Pintu & Kusen WPC Tahan Rayap Seri Eko',
  category_id: 'cat_kusen_pintu',
  solution_class_id: 'sol_wpc_engineered',
  identity_state: 'CURRENT',
  variants: [],
  spec_snapshots: [SPEC_WPC_STALE],
  evidence_sources: [EVIDENCE_WPC_STALE],
  review_snapshots: []
};

export const SYNTHETIC_EDITORIAL_REVIEW_STALE: EditorialProductReview = {
  review_id: 'rev_synth_wpc_stale_01',
  product_id: 'prod_synthetic_wood_composite_03',
  review_mode: 'ANALYTICAL_REVIEW',
  tested_by_rancangloka: false,
  editorial_status: 'DRAFT',
  reviewed_at: '2026-05-12T09:00:00Z',
  reviewer_identity: 'Irwan (Riset)',
  notes: 'Spesifikasi teknis terakhir diambil Mei 2026. Memerlukan audit spesifikasi tahunan.'
};

// ============================================================================
// 6. PRODUCT DESK PROJECTION & DATA ASSEMBLY
// ============================================================================

export interface ProductDeskSummaryItem {
  product_id: string;
  canonical_name: string;
  brand: string;
  category_id: string;
  solution_class_id: string;
  identity_state: ProductIdentityState;
  variant_count: number;
  editorial_review_count: number;
  latest_review_mode: ReviewMode;
  evidence_freshness_status: InspectionFreshnessState;
  technical_match_status: ProductMatchStatus;
  readiness_state: EditorialReadinessState;
}

export interface ProductDetailProjection {
  product: Product;
  variants: Variant[];
  editorial_reviews: EditorialProductReview[];
  spec_snapshot?: SpecSnapshot;
  spec_freshness_eval?: FreshnessEvaluation;
  spec_freshness_state: InspectionFreshnessState;
  evidence_sources: EvidenceSource[];
  review_snapshot?: ReviewSnapshot;
  review_freshness_eval?: FreshnessEvaluation;
  review_freshness_state: InspectionFreshnessState;
  offers: Offer[];
  offer_freshness_map: Record<string, { eval: FreshnessEvaluation; state: InspectionFreshnessState }>;
  price_snapshots: PriceSnapshot[];
  price_freshness_map: Record<string, { eval: FreshnessEvaluation; state: InspectionFreshnessState }>;
  affiliate_destinations: AffiliateDestination[];
  article_binding?: ArticleProductBinding;
  commercial_disclosure: CommercialDisclosure;
  technical_match: ProductMatchResult;
  technical_input: TechnicalMatchInputDTO;
  pde_handoff: ProductReviewHandoffContract;
  readiness: { state: EditorialReadinessState; reasons: string[] };
}

export interface ProductDeskProjection {
  data_source: AdminReviewDataSource;
  data_source_meta: DataSourceMetadata;
  products_list: ProductDeskSummaryItem[];
  selected_product_id: string;
  detail?: ProductDetailProjection;
  is_empty: boolean;
  empty_reason?: string;
  active_tab: string;
}

/**
 * Assembles the full projection for the Product Review Desk Admin Inspector.
 */
export function getSyntheticProductDeskProjection(options?: {
  productId?: string;
  activeTab?: string;
  forceEmpty?: boolean;
}): ProductDeskProjection {
  if (options?.forceEmpty) {
    return {
      data_source: 'SYNTHETIC_TEST_DATA',
      data_source_meta: DATA_SOURCE_CONFIG.SYNTHETIC_TEST_DATA,
      products_list: [],
      selected_product_id: '',
      is_empty: true,
      empty_reason: 'Belum ada produk yang masuk ke Product Review Desk.',
      active_tab: 'overview'
    };
  }

  const catalog = [
    {
      product: SYNTHETIC_PRODUCT,
      reviews: [SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL, SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON],
      variants: [SYNTHETIC_VARIANT_1, SYNTHETIC_VARIANT_2],
      specs: SYNTHETIC_SPEC_SNAPSHOT,
      evidence: [SYNTHETIC_EVIDENCE_MANUFACTURER, SYNTHETIC_EVIDENCE_LAB_TEST, SYNTHETIC_EVIDENCE_PRIMARY_TEST],
      reviewSnapshot: SYNTHETIC_REVIEW_SNAPSHOT,
      offers: [SYNTHETIC_OFFER_MERCHANT_A, SYNTHETIC_OFFER_MERCHANT_B],
      prices: [SYNTHETIC_PRICE_SNAPSHOT_A, SYNTHETIC_PRICE_SNAPSHOT_B],
      affiliates: [SYNTHETIC_AFFILIATE_DESTINATION_A, SYNTHETIC_AFFILIATE_DESTINATION_B],
      binding: SYNTHETIC_ARTICLE_PRODUCT_BINDING
    },
    {
      product: SYNTHETIC_PRODUCT_DRIFTED,
      reviews: [SYNTHETIC_EDITORIAL_REVIEW_DRIFTED],
      variants: [...(SYNTHETIC_PRODUCT_DRIFTED.variants || [])],
      specs: SYNTHETIC_PRODUCT_DRIFTED.spec_snapshots?.[0],
      evidence: [...(SYNTHETIC_PRODUCT_DRIFTED.evidence_sources || [])],
      reviewSnapshot: undefined,
      offers: [],
      prices: [],
      affiliates: [],
      binding: undefined
    },
    {
      product: SYNTHETIC_PRODUCT_STALE_SPEC,
      reviews: [SYNTHETIC_EDITORIAL_REVIEW_STALE],
      variants: [],
      specs: SYNTHETIC_PRODUCT_STALE_SPEC.spec_snapshots?.[0],
      evidence: [...(SYNTHETIC_PRODUCT_STALE_SPEC.evidence_sources || [])],
      reviewSnapshot: undefined,
      offers: [],
      prices: [],
      affiliates: [],
      binding: undefined
    }
  ];

  const selectedId = options?.productId || SYNTHETIC_PRODUCT.product_id;
  const activeItem = catalog.find(c => c.product.product_id === selectedId) || catalog[0];

  // Build summary list (strictly NO commission, payout, or merchant ranking fields)
  const summaries: ProductDeskSummaryItem[] = catalog.map(item => {
    const specEval = item.specs
      ? evaluateEntityFreshness('spec_snapshot', item.specs.captured_at)
      : undefined;
    const specFreshnessState = resolveInspectionFreshness(specEval);

    const match = evaluateTechnicalProductMatch(
      SYNTHETIC_PDE_HANDOFF,
      item.product,
      item.specs
    );

    const readiness = deriveEditorialReadiness({
      product: item.product,
      reviews: item.reviews,
      specSnapshot: item.specs,
      evidenceSources: item.evidence,
      technicalMatch: match
    });

    const latestReview = item.reviews[item.reviews.length - 1];

    return {
      product_id: item.product.product_id,
      canonical_name: item.product.canonical_name,
      brand: item.product.brand,
      category_id: item.product.category_id,
      solution_class_id: item.product.solution_class_id,
      identity_state: item.product.identity_state,
      variant_count: item.variants.length,
      editorial_review_count: item.reviews.length,
      latest_review_mode: latestReview ? latestReview.review_mode : 'ANALYTICAL_REVIEW',
      evidence_freshness_status: specFreshnessState,
      technical_match_status: match.match_status,
      readiness_state: readiness.state
    };
  });

  // Build detail projection for active product
  const specEval = activeItem.specs
    ? evaluateEntityFreshness('spec_snapshot', activeItem.specs.captured_at)
    : undefined;
  const specFreshnessState = resolveInspectionFreshness(specEval);

  const reviewEval = activeItem.reviewSnapshot
    ? evaluateEntityFreshness('review_snapshot', activeItem.reviewSnapshot.captured_at)
    : undefined;
  const reviewFreshnessState = resolveInspectionFreshness(reviewEval);

  const offerFreshnessMap: Record<string, { eval: FreshnessEvaluation; state: InspectionFreshnessState }> = {};
  for (const off of activeItem.offers) {
    const ev = evaluateEntityFreshness('offer', '2026-10-16T12:00:00Z');
    offerFreshnessMap[off.offer_id] = {
      eval: ev,
      state: resolveInspectionFreshness(ev)
    };
  }

  const priceFreshnessMap: Record<string, { eval: FreshnessEvaluation; state: InspectionFreshnessState }> = {};
  for (const price of activeItem.prices) {
    const ev = evaluateEntityFreshness('price_snapshot', price.captured_at);
    priceFreshnessMap[price.price_snapshot_id] = {
      eval: ev,
      state: resolveInspectionFreshness(ev)
    };
  }

  const technicalMatch = evaluateTechnicalProductMatch(
    SYNTHETIC_PDE_HANDOFF,
    activeItem.product,
    activeItem.specs
  );

  let technicalInput: TechnicalMatchInputDTO;
  if (activeItem.specs) {
    technicalInput = assembleTechnicalMatchInput({
      product: activeItem.product,
      variant: activeItem.variants[0],
      specSnapshot: activeItem.specs,
      evidenceSources: activeItem.evidence
    });
  } else {
    technicalInput = {
      product_id: activeItem.product.product_id,
      canonical_name: activeItem.product.canonical_name,
      brand: activeItem.product.brand,
      solution_class_id: activeItem.product.solution_class_id,
      specs: {},
      source_fidelity: 'SECONDARY_ANALYSIS',
      verified_claims: []
    };
  }

  const readiness = deriveEditorialReadiness({
    product: activeItem.product,
    reviews: activeItem.reviews,
    specSnapshot: activeItem.specs,
    evidenceSources: activeItem.evidence,
    technicalMatch
  });

  const detail: ProductDetailProjection = {
    product: activeItem.product,
    variants: activeItem.variants,
    editorial_reviews: activeItem.reviews,
    spec_snapshot: activeItem.specs,
    spec_freshness_eval: specEval,
    spec_freshness_state: specFreshnessState,
    evidence_sources: activeItem.evidence,
    review_snapshot: activeItem.reviewSnapshot,
    review_freshness_eval: reviewEval,
    review_freshness_state: reviewFreshnessState,
    offers: activeItem.offers,
    offer_freshness_map: offerFreshnessMap,
    price_snapshots: activeItem.prices,
    price_freshness_map: priceFreshnessMap,
    affiliate_destinations: activeItem.affiliates,
    article_binding: activeItem.binding,
    commercial_disclosure: activeItem.binding?.commercial_disclosure || {
      has_affiliate_links: false,
      is_sponsored_content: false,
      is_product_supplied_by_brand: false,
      disclosure_statement: 'Tidak ada hubungan komersial aktif.'
    },
    technical_match: technicalMatch,
    technical_input: technicalInput,
    pde_handoff: SYNTHETIC_PDE_HANDOFF,
    readiness
  };

  return {
    data_source: 'SYNTHETIC_TEST_DATA',
    data_source_meta: DATA_SOURCE_CONFIG.SYNTHETIC_TEST_DATA,
    products_list: summaries,
    selected_product_id: activeItem.product.product_id,
    detail,
    is_empty: false,
    active_tab: options?.activeTab || 'overview'
  };
}

/**
 * Assembles the production projection for the Product Review Desk Admin Inspector
 * directly querying Cloudflare D1.
 *
 * Permanent Invariant:
 * NO_SILENT_PRODUCT_REVIEW_PRODUCTION_FALLBACK
 * When connected to production D1 (or running in production mode), an empty database
 * must NEVER fall back silently to synthetic fixtures (Nusantara Hardware ArchLab,
 * synthetic prices, or fake affiliate links). It MUST return an explicit EMPTY_STATE
 * labeled PRODUCTION_D1.
 */
export async function getProductionProductDeskProjection(
  db: any,
  options?: {
    productId?: string;
    activeTab?: string;
    forceEmpty?: boolean;
  }
): Promise<ProductDeskProjection> {
  const activeTab = options?.activeTab || 'overview';

  // If forceEmpty is specified or db is absent, return PRODUCTION_D1 empty state
  if (!db || options?.forceEmpty) {
    return {
      data_source: 'PRODUCTION_D1',
      data_source_meta: DATA_SOURCE_CONFIG.PRODUCTION_D1,
      products_list: [],
      selected_product_id: '',
      is_empty: true,
      empty_reason: 'Belum ada produk yang masuk ke Product Review Desk.',
      active_tab: activeTab
    };
  }

  try {
    const rows = await db
      .prepare('SELECT * FROM product_review_products ORDER BY created_at DESC')
      .all();
    const products = rows?.results ?? (Array.isArray(rows) ? rows : []);

    if (products.length === 0) {
      return {
        data_source: 'PRODUCTION_D1',
        data_source_meta: DATA_SOURCE_CONFIG.PRODUCTION_D1,
        products_list: [],
        selected_product_id: '',
        is_empty: true,
        empty_reason: 'Belum ada produk yang masuk ke Product Review Desk.',
        active_tab: activeTab
      };
    }

    // In future milestones with real products, build projections from D1 rows.
    // For now, rows are strictly 0 in initial production.
    return {
      data_source: 'PRODUCTION_D1',
      data_source_meta: DATA_SOURCE_CONFIG.PRODUCTION_D1,
      products_list: [],
      selected_product_id: '',
      is_empty: true,
      empty_reason: 'Belum ada produk yang masuk ke Product Review Desk.',
      active_tab: activeTab
    };
  } catch (err) {
    console.warn('Failed to query production D1 for product desk:', err);
    return {
      data_source: 'PRODUCTION_D1',
      data_source_meta: DATA_SOURCE_CONFIG.PRODUCTION_D1,
      products_list: [],
      selected_product_id: '',
      is_empty: true,
      empty_reason: 'Belum ada produk yang masuk ke Product Review Desk.',
      active_tab: activeTab
    };
  }
}
