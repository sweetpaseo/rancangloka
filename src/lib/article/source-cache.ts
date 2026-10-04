/**
 * RancangLoka Source Cache & Acquisition Architecture
 * Milestone: EDITORIAL-SOURCE-ACQUISITION-1
 *
 * Implements a minimal, verifiable evidence cache and source intake auditor.
 * Distinguishes genuine retrieval from metadata-only and known unretrieved references.
 * Never fabricates access, page numbers, or unverified technical numbers.
 */

import type {
  EvidencePackInput,
  EvidenceSource,
  EvidenceClaim,
  AuthorSafeClaim,
  SourceRetrievalStatus,
  SourceApplicability
} from './human-quality.ts';

export interface SourceCacheEntry {
  source_id: string;
  document_title: string;
  publisher?: string;
  edition_or_date?: string;
  retrieval_status: SourceRetrievalStatus;
  retrieval_method: string;
  retrieved_at: string;
  canonical_url_or_path: string | null;
  content_hash: string | null;
  inspected_location: string | null;
  applicability: SourceApplicability | string;
  claim_ids: string[];
  notes?: string;
}

export interface SourceAcquisitionAttempt {
  source_id: string;
  document_title: string;
  publisher?: string;
  retrieval_status: SourceRetrievalStatus;
  is_available: boolean;
  why_unavailable?: string;
  attempted_method: string;
  legal_status: 'OPEN_PUBLIC' | 'RESTRICTED_PORTAL' | 'COMMERCIAL_PAYWALL' | 'INTERNAL_CACHE_MISSING';
}

export interface SourceAcquisitionReport {
  acquisition_status: 'SOURCE_ACQUISITION_COMPLETED' | 'SOURCE_ACQUISITION_PARTIAL' | 'SOURCE_ACQUISITION_BLOCKED';
  evaluated_at: string;
  total_sources_evaluated: number;
  retrieved_sources_count: number;
  unretrieved_sources_count: number;
  sources_attempted: SourceAcquisitionAttempt[];
  claims_affected: string[];
  safe_qualitative_claims_remaining: string[];
  cache_entries: SourceCacheEntry[];
  summary: string;
}

/**
 * Known retrieval barriers for technical standards and engineering publications.
 */
export const KNOWN_SOURCE_RETRIEVAL_CATALOG: Record<
  string,
  {
    legal_status: 'OPEN_PUBLIC' | 'RESTRICTED_PORTAL' | 'COMMERCIAL_PAYWALL' | 'INTERNAL_CACHE_MISSING';
    reason: string;
  }
> = {
  'SRC-SNI-6572': {
    legal_status: 'RESTRICTED_PORTAL',
    reason: 'Dokumen SNI resmi dikelola oleh Badan Standardisasi Nasional (BSN) melalui portal berbayar/terdaftar (akses-bsn.go.id). Teks lengkap tidak di-cache di repositori lokal.'
  },
  'SRC-ASHRAE-FUND': {
    legal_status: 'COMMERCIAL_PAYWALL',
    reason: 'Buku pegangan teknik ASHRAE adalah publikasi komersial berbayar berhak cipta tinggi ($250+). Sirkumvensi paywall dilarang.'
  },
  'SRC-BRANZ-ROOF': {
    legal_status: 'INTERNAL_CACHE_MISSING',
    reason: 'Laporan riset BRANZ New Zealand (SR156); metadata bibliografis tercatat namun file PDF dokumen primer belum di-cache secara fisik dalam repositori.'
  },
  'SRC-ASTM-C1371': {
    legal_status: 'COMMERCIAL_PAYWALL',
    reason: 'Standar uji laboratorium ASTM berbayar ($80+). Dokumen primer tidak disimpan di lingkungan lokal untuk menjaga kepatuhan hak cipta.'
  },
  'SRC-ASTM-C1321': {
    legal_status: 'COMMERCIAL_PAYWALL',
    reason: 'Standar praktik ASTM berbayar ($80+). Lokasi pasal spesifik tidak dapat diverifikasi tanpa naskah resmi terinspeksi.'
  },
  'SRC-ASTM-C727': {
    legal_status: 'COMMERCIAL_PAYWALL',
    reason: 'Standar praktik ASTM berbayar ($80+). Tidak tersedia berkas PDF lokal.'
  },
  'SRC-PUPR-LOTENG': {
    legal_status: 'INTERNAL_CACHE_MISSING',
    reason: 'Monograf penelitian Kementerian PU & ITB; terindeks dalam katalog penelitian publik tetapi berkas PDF primer belum diunduh ke cache lokal.'
  },
  'SRC-IRC-R806': {
    legal_status: 'COMMERCIAL_PAYWALL',
    reason: 'Model building code internasional (ICC IRC 2021); rujukan teknik asing dan bukan regulasi wajib Indonesia.'
  },
  'SRC-BRANZ-B519': {
    legal_status: 'INTERNAL_CACHE_MISSING',
    reason: 'Buletin teknis BRANZ; metadata tercatat namun dokumen belum di-cache secara lokal.'
  },
  'SRC-DESAIN-PASIF': {
    legal_status: 'INTERNAL_CACHE_MISSING',
    reason: 'Buku pedoman desain pasif PU; buku fisik kementerian belum di-scan atau di-cache di repositori.'
  }
};

/**
 * Audits source acquisition for an Evidence Pack.
 * If external sources cannot be verified or legally fetched, deterministically
 * returns SOURCE_ACQUISITION_BLOCKED or SOURCE_ACQUISITION_PARTIAL without simulating retrieval.
 */
export function auditSourceAcquisition(
  evidencePack: EvidencePackInput,
  evaluatedAt: string = new Date().toISOString()
): SourceAcquisitionReport {
  const claims = Array.isArray(evidencePack.claim_inventory) ? evidencePack.claim_inventory : [];
  const sourcesAttempted: SourceAcquisitionAttempt[] = [];
  const cacheEntries: SourceCacheEntry[] = [];
  const claimsAffected = new Set<string>();
  const safeQualitativeClaims: string[] = [];

  let retrievedCount = 0;
  let unretrievedCount = 0;

  for (const claim of claims) {
    const claimSources = Array.isArray(claim.sources) ? claim.sources : [];
    let claimHasRetrieved = false;

    for (const src of claimSources) {
      const isRetrieved = src.retrieval_status === 'SOURCE_RETRIEVED_AND_VERIFIED';
      const barrier = KNOWN_SOURCE_RETRIEVAL_CATALOG[src.source_id] || {
        legal_status: isRetrieved ? 'OPEN_PUBLIC' : 'INTERNAL_CACHE_MISSING',
        reason: isRetrieved ? 'Dokumen primer tersedia dan terinspeksi.' : 'Dokumen tidak tersedia di repositori kerja lokal.'
      };

      if (isRetrieved) {
        retrievedCount++;
        claimHasRetrieved = true;
        sourcesAttempted.push({
          source_id: src.source_id,
          document_title: src.document_title,
          publisher: src.publisher_or_author,
          retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          is_available: true,
          attempted_method: src.retrieval_method || 'LOCAL_DOCUMENT_INSPECTION',
          legal_status: 'OPEN_PUBLIC'
        });

        cacheEntries.push({
          source_id: src.source_id,
          document_title: src.document_title,
          publisher: src.publisher_or_author,
          edition_or_date: src.publication_or_revision_date,
          retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          retrieval_method: src.retrieval_method || 'LOCAL_DOCUMENT_INSPECTION',
          retrieved_at: src.retrieved_at || evaluatedAt,
          canonical_url_or_path: src.content_location || null,
          content_hash: src.content_hash || null,
          inspected_location: src.page_or_section || null,
          applicability: src.applicability,
          claim_ids: [claim.claim_id]
        });
      } else {
        unretrievedCount++;
        claimsAffected.add(claim.claim_id);
        sourcesAttempted.push({
          source_id: src.source_id,
          document_title: src.document_title,
          publisher: src.publisher_or_author,
          retrieval_status: src.retrieval_status || 'SOURCE_METADATA_ONLY',
          is_available: false,
          why_unavailable: barrier.reason,
          attempted_method: src.retrieval_method || 'BIBLIOGRAPHIC_METADATA_INSPECTION',
          legal_status: barrier.legal_status
        });
      }
    }

    if (!claimHasRetrieved) {
      safeQualitativeClaims.push(
        `${claim.claim_id}: Prinsip kualitatif dipertahankan; angka persis tidak boleh digunakan.`
      );
    }
  }

  let acquisitionStatus: SourceAcquisitionReport['acquisition_status'];
  if (retrievedCount > 0 && unretrievedCount === 0) {
    acquisitionStatus = 'SOURCE_ACQUISITION_COMPLETED';
  } else if (retrievedCount > 0 && unretrievedCount > 0) {
    acquisitionStatus = 'SOURCE_ACQUISITION_PARTIAL';
  } else {
    acquisitionStatus = 'SOURCE_ACQUISITION_BLOCKED';
  }

  const summary =
    acquisitionStatus === 'SOURCE_ACQUISITION_BLOCKED'
      ? `Akses dokumen primer tidak tersedia (${unretrievedCount} sumber berstatus metadata/unretrieved karena batasan paywall komersial atau ketiadaan cache dokumen lokal). Seluruh klaim (${claimsAffected.size}) dialihkan ke prinsip kualitatif tanpa angka persis.`
      : acquisitionStatus === 'SOURCE_ACQUISITION_PARTIAL'
      ? `Akses dokumen primer parsial (${retrievedCount} terverifikasi, ${unretrievedCount} tertahan). Klaim yang tidak memiliki dokumen fisik wajib menggunakan perumusan kualitatif.`
      : `Seluruh dokumen primer (${retrievedCount}) berhasil diverifikasi dan di-cache secara sah.`;

  return {
    acquisition_status: acquisitionStatus,
    evaluated_at: evaluatedAt,
    total_sources_evaluated: retrievedCount + unretrievedCount,
    retrieved_sources_count: retrievedCount,
    unretrieved_sources_count: unretrievedCount,
    sources_attempted: sourcesAttempted,
    claims_affected: Array.from(claimsAffected),
    safe_qualitative_claims_remaining: safeQualitativeClaims,
    cache_entries: cacheEntries,
    summary
  };
}
