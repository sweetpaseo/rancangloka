/**
 * ============================================================================
 * RancangLoka Product Review Desk & Affiliate Firewall (PRODUCT_REVIEW_AFFILIATE-1A)
 * Synthetic Product & Commerce Fixtures
 * ============================================================================
 *
 * NOTE: These fixtures are strictly synthetic reference data for proving
 * architectural contracts, commercial firewall boundaries, and identity drift.
 * They do NOT impersonate real commercial brands, products, or merchant stores.
 */

import type {
  Product,
  EditorialProductReview,
  Variant,
  Offer,
  AffiliateDestination,
  PriceSnapshot,
  SpecSnapshot,
  ReviewSnapshot,
  EvidenceSource,
  ArticleProductBinding
} from './types.ts';

/**
 * Synthetic Evidence Sources
 */
export const SYNTHETIC_EVIDENCE_MANUFACTURER: EvidenceSource = Object.freeze({
  source_id: 'src_synth_mfg_01',
  source_type: 'MANUFACTURER',
  source_url: 'https://specs.fictional-nusantara-lab.id/datasheet-nh-kus-x1.pdf',
  publisher: 'Nusantara Hardware ArchLab Corp',
  retrieved_at: '2026-10-14T08:00:00Z',
  evidence_scope: 'Physical profile extrusion specifications and thermal chamber standards',
  claim_class: 'TECHNICAL_CONSENSUS',
  source_fidelity: 'PRIMARY_DOCUMENT',
  product_identity_reference: 'prod_synthetic_upvc_01'
});

export const SYNTHETIC_EVIDENCE_LAB_TEST: EvidenceSource = Object.freeze({
  source_id: 'src_synth_lab_02',
  source_type: 'TECHNICAL_DATASHEET',
  source_url: 'https://specs.fictional-nusantara-lab.id/lab-report-water-tightness.pdf',
  publisher: 'Balai Uji Material Tropis Nusantara (Fiktif)',
  retrieved_at: '2026-10-15T10:00:00Z',
  evidence_scope: 'Wind-driven rain air tightness testing at 600 Pa',
  claim_class: 'VERIFIED_FACT',
  source_fidelity: 'PRIMARY_DOCUMENT',
  product_identity_reference: 'prod_synthetic_upvc_01'
});

export const SYNTHETIC_EVIDENCE_PRIMARY_TEST: EvidenceSource = Object.freeze({
  source_id: 'src_synth_primary_test_03',
  source_type: 'RANCANGLOKA_PRIMARY_TEST',
  source_url: 'https://rancangloka.id/lab/reports/2026-10-nh-kus-x1-test.pdf',
  publisher: 'RancangLoka Editorial Lab',
  retrieved_at: '2026-10-16T15:00:00Z',
  evidence_scope: 'Physical acoustic & thermal chamber measurement',
  claim_class: 'VERIFIED_FACT',
  source_fidelity: 'PRIMARY_DOCUMENT',
  product_identity_reference: 'prod_synthetic_upvc_01',
  testing_provenance: Object.freeze({
    testing_date: '2026-10-16',
    tester_identity: 'Irwan & Tim Teknis RancangLoka',
    testing_location: 'Workshop Pengujian Fasade Jakarta Barat',
    methodology_notes: 'Pengujian insulasi suara lapangan 34 dB dan permeabilitas udara siklonik 600 Pa.'
  })
});

/**
 * Synthetic Spec Snapshot
 */
export const SYNTHETIC_SPEC_SNAPSHOT: SpecSnapshot = Object.freeze({
  spec_snapshot_id: 'spec_snap_synth_01',
  product_id: 'prod_synthetic_upvc_01',
  variant_id: 'var_synth_white_60mm',
  captured_at: '2026-10-15T12:00:00Z',
  source_id: 'src_synth_mfg_01',
  specs: Object.freeze({
    chamber_count: 5,
    thermal_transmittance_u_value: 1.4,
    profile_depth_mm: 60,
    reinforcement_steel_gauge_mm: 1.5,
    corner_joint_method: 'WELDED_FUSION',
    acoustic_reduction_db: 34,
    uv_stabilizer_type: 'TIO2_TROPICAL_GRADE',
    corrosion_resistant: true
  }),
  source_fidelity: 'PRIMARY_DOCUMENT'
});

/**
 * Synthetic Variants
 */
export const SYNTHETIC_VARIANT_1: Variant = Object.freeze({
  variant_id: 'var_synth_white_60mm',
  product_id: 'prod_synthetic_upvc_01',
  sku_or_model: 'NH-KUS-X1-W60',
  variant_name: 'Profil 60mm Putih Standard Tropis',
  specific_specs: Object.freeze({
    color: 'Signal White RAL 9003',
    wall_thickness_mm: 2.5
  }),
  identity_state: 'CURRENT'
});

export const SYNTHETIC_VARIANT_2: Variant = Object.freeze({
  variant_id: 'var_synth_anthracite_70mm',
  product_id: 'prod_synthetic_upvc_01',
  sku_or_model: 'NH-KUS-X1-A70',
  variant_name: 'Profil 70mm Abu Anthracite Multi-Chamber HD',
  specific_specs: Object.freeze({
    color: 'Anthracite Grey RAL 7016',
    wall_thickness_mm: 2.8,
    acoustic_reduction_db: 38
  }),
  identity_state: 'CURRENT'
});

/**
 * Synthetic External User Review Snapshot
 * Note: External reviews are USER_EXPERIENCE_SIGNAL, not VERIFIED_FACT.
 */
export const SYNTHETIC_REVIEW_SNAPSHOT: ReviewSnapshot = Object.freeze({
  review_snapshot_id: 'rev_snap_synth_01',
  product_id: 'prod_synthetic_upvc_01',
  variant_id: 'var_synth_white_60mm',
  source_id: 'src_synth_mfg_01',
  captured_at: '2026-10-16T09:00:00Z',
  external_review_count: 42,
  external_rating: 4.8,
  external_rating_max: 5.0,
  source_label: 'Agregasi Ulasan Toko Bangunan Terverifikasi (Fiktif)',
  recurring_themes: Object.freeze([
    {
      sentiment: 'POSITIVE' as const,
      topic: 'Kedap Suara',
      summary: 'Suara bising kendaraan jalan raya berkurang drastis setelah pemasangan.'
    },
    {
      sentiment: 'NEUTRAL' as const,
      topic: 'Pemasangan',
      summary: 'Memerlukan tukang spesialis yang teliti saat penyetelan engsel multi-point.'
    }
  ])
});

/**
 * Canonical Synthetic Product (Pure Physical Identity - Independent of Editorial Review & Commerce)
 * Permanent Invariant: EDITORIAL_REVIEW_STATE_MUST_NOT_MUTATE_PRODUCT_IDENTITY
 */
export const SYNTHETIC_PRODUCT: Product = Object.freeze({
  product_id: 'prod_synthetic_upvc_01',
  brand: 'Nusantara Hardware ArchLab (Fictional)',
  canonical_name: 'Kusen Jendela uPVC Multi-Chamber Seri X1',
  category_id: 'cat_kusen_jendela',
  solution_class_id: 'sol_upvc_multi_chamber',
  identity_state: 'CURRENT',
  variants: Object.freeze([SYNTHETIC_VARIANT_1, SYNTHETIC_VARIANT_2]),
  spec_snapshots: Object.freeze([SYNTHETIC_SPEC_SNAPSHOT]),
  evidence_sources: Object.freeze([
    SYNTHETIC_EVIDENCE_MANUFACTURER,
    SYNTHETIC_EVIDENCE_LAB_TEST
  ]),
  review_snapshots: Object.freeze([SYNTHETIC_REVIEW_SNAPSHOT])
});

/**
 * Canonical Synthetic Editorial Review: ANALYTICAL_REVIEW
 * Invariant: tested_by_rancangloka must be false for analytical reviews.
 */
export const SYNTHETIC_EDITORIAL_REVIEW_ANALYTICAL: EditorialProductReview = Object.freeze({
  review_id: 'rev_synth_analytical_01',
  product_id: 'prod_synthetic_upvc_01',
  variant_id: 'var_synth_white_60mm',
  article_id: 5,
  review_mode: 'ANALYTICAL_REVIEW',
  tested_by_rancangloka: false,
  editorial_status: 'REVIEWED',
  reviewed_at: '2026-10-15T14:00:00Z',
  reviewer_identity: 'Tim Editorial RancangLoka',
  notes: 'Analisis komprehensif berbasis lembar data manufaktur dan hasil pengujian lab independen.'
});

/**
 * Canonical Synthetic Editorial Review: HANDS_ON_REVIEW
 * Invariant: TESTED_BY_RANCANGLOKA_REQUIRES_PRIMARY_TEST_PROVENANCE.
 */
export const SYNTHETIC_EDITORIAL_REVIEW_HANDS_ON: EditorialProductReview = Object.freeze({
  review_id: 'rev_synth_handson_02',
  product_id: 'prod_synthetic_upvc_01',
  variant_id: 'var_synth_white_60mm',
  article_id: 5,
  review_mode: 'HANDS_ON_REVIEW',
  tested_by_rancangloka: true,
  testing_provenance: Object.freeze({
    testing_date: '2026-10-16',
    tester_identity: 'Irwan & Tim Teknis RancangLoka',
    testing_location: 'Workshop Pengujian Fasade Jakarta Barat',
    methodology_notes: 'Pengujian insulasi suara lapangan 34 dB dan permeabilitas udara siklonik 600 Pa.'
  }),
  editorial_status: 'PUBLISHED',
  reviewed_at: '2026-10-16T16:00:00Z',
  reviewer_identity: 'Irwan (Kepala Riset Redaksi)',
  notes: 'Verifikasi fisik profil uPVC di fasilitas workshop fasade redaksi.'
});

/**
 * Synthetic Commerce Layer: Offers from two distinct merchants
 */
export const SYNTHETIC_OFFER_MERCHANT_A: Offer = Object.freeze({
  offer_id: 'off_merchant_a_01',
  product_id: 'prod_synthetic_upvc_01',
  variant_id: 'var_synth_white_60mm',
  merchant_id: 'merch_distributor_resmi_a',
  merchant_name: 'Mitra Bangunan Sejahtera (Fiktif)',
  listing_title: 'Kusen Jendela uPVC Nusantara ArchLab X1 60mm Putih Termal',
  listing_identity: 'LIST-A-98124',
  listing_url: 'https://fictional-store-a.id/products/nh-kus-x1-w60',
  current_availability: 'IN_STOCK'
});

export const SYNTHETIC_OFFER_MERCHANT_B: Offer = Object.freeze({
  offer_id: 'off_merchant_b_02',
  product_id: 'prod_synthetic_upvc_01',
  variant_id: 'var_synth_white_60mm',
  merchant_id: 'merch_toko_kusen_b',
  merchant_name: 'Depo Kusen Sentosa (Fiktif)',
  listing_title: 'Jual Kusen uPVC ArchLab X1 Seri 60mm Bergaransi',
  listing_identity: 'LIST-B-44219',
  listing_url: 'https://fictional-store-b.id/item/nh-kus-x1',
  current_availability: 'IN_STOCK'
});

/**
 * Synthetic Dynamic Price Snapshots
 */
export const SYNTHETIC_PRICE_SNAPSHOT_A: PriceSnapshot = Object.freeze({
  price_snapshot_id: 'price_snap_a_01',
  offer_id: 'off_merchant_a_01',
  captured_at: '2026-10-16T15:00:00Z',
  currency: 'IDR',
  observed_price: 450000,
  availability: 'IN_STOCK',
  source_url: 'https://fictional-store-a.id/products/nh-kus-x1-w60'
});

export const SYNTHETIC_PRICE_SNAPSHOT_B: PriceSnapshot = Object.freeze({
  price_snapshot_id: 'price_snap_b_02',
  offer_id: 'off_merchant_b_02',
  captured_at: '2026-10-16T15:30:00Z',
  currency: 'IDR',
  observed_price: 475000,
  availability: 'IN_STOCK',
  source_url: 'https://fictional-store-b.id/item/nh-kus-x1'
});

/**
 * Synthetic Affiliate Destinations
 */
export const SYNTHETIC_AFFILIATE_DESTINATION_A: AffiliateDestination = Object.freeze({
  destination_id: 'aff_dest_a_01',
  offer_id: 'off_merchant_a_01',
  provider: 'involve_asia',
  affiliate_destination_url: 'https://outbound.rancangloka.id/c/aff-merchant-a-x1?sub_id=art5',
  tracking_metadata: Object.freeze({
    campaign: 'pde_article_5_pilot',
    commission_bracket: 'tier_standard'
  }),
  is_active: true
});

export const SYNTHETIC_AFFILIATE_DESTINATION_B: AffiliateDestination = Object.freeze({
  destination_id: 'aff_dest_b_02',
  offer_id: 'off_merchant_b_02',
  provider: 'shopee_affiliate',
  affiliate_destination_url: 'https://outbound.rancangloka.id/c/aff-merchant-b-x1?sub_id=art5',
  tracking_metadata: Object.freeze({
    campaign: 'pde_article_5_pilot',
    commission_bracket: 'tier_builder'
  }),
  is_active: true
});

/**
 * Synthetic Article Product Binding
 */
export const SYNTHETIC_ARTICLE_PRODUCT_BINDING: ArticleProductBinding = Object.freeze({
  binding_id: 'bind_art5_prod_upvc_01',
  article_id: 5,
  product_id: 'prod_synthetic_upvc_01',
  variant_id: 'var_synth_white_60mm',
  editorial_role: 'EXAMPLE',
  section_anchor: 'karakteristik-upvc-multi-chamber',
  commercial_disclosure: Object.freeze({
    has_affiliate_links: true,
    is_sponsored_content: false,
    is_product_supplied_by_brand: false,
    disclosure_statement:
      'Tautan merchant pada produk ini dapat menghasilkan komisi afiliasi untuk operasional redaksi RancangLoka tanpa menambah biaya bagi pembaca. Seluruh evaluasi teknis dilakukan secara independen.'
  })
});
