# EDITORIAL-EVIDENCE-PROVENANCE-1 — Claim-to-Source Traceability & Multi-Issue Propagation

## Executive Summary
Milestone `EDITORIAL-EVIDENCE-PROVENANCE-1` menutup dua kesenjangan integritas arsitektural (*integrity gaps*) yang teridentifikasi pada eksekusi dry run editorial pertama (`EDITORIAL-PRODUCTION-DRYRUN-1`):
1. **Evidence Provenance & Claim-to-Source Traceability**: Seluruh klaim teknis dan numerik pada Evidence Pack kini wajib memiliki struktur sumber primer yang terverifikasi (identifikasi dokumen, edisi/tahun, nomor bab/bagian, status pembuktian, dan klasifikasi aplikabilitas lokal vs acuan internasional). Klaim yang tidak didukung data uji primer dikualifikasikan menjadi prinsip kualitatif tanpa angka fiktif.
2. **Multi-Issue Propagation Architecture**: Skema penanganan isu mutu pada `StructuredRewriteBrief`, `TaskHandoffObservation`, dan `JobTrace` kini mempertahankan seluruh daftar anomali (`quality_issues: string[]`), sembari tetap menjaga kompatibilitas mundur pada field isu utama (`quality_issue` / `primary_quality_issue`). Penugasan revisi multi-isu kini secara deterministik menetapkan `primary_owner` dan `supporting_owners` (misalnya: Irwan untuk bukti, Joko untuk naskah).

---

## Part A: Evidence Provenance Audit & Linkage

### 1. Re-Evaluasi 8 Klaim Teknis Dry Run Atap Metal
Setiap klaim dari Evidence Pack (`scripts/dryrun/evidence-pack.json`) diaudit terhadap bukti primer fisik dan literatur standar:

| Claim ID | Klaim Inti | Klasifikasi Lama | Status Bukti Baru | Status Retrieval Sumber | Aplikabilitas | Tindakan | Rujukan Persis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CLM-001** | Konduktivitas seng k ≈ 50-60 W/m·K; radiasi 800-1000 W/m²; suhu 60-75°C | `verified_fact` | `PARTIALLY_SUPPORTED` | `SOURCE_REFERENCE_KNOWN_BUT_NOT_RETRIEVED` | `REGULATORY_LOCAL_TROPICAL` + `TECHNICAL_REFERENCE_FOREIGN` | **QUALIFY** | SNI 03-6572-2001 Bag. 5 & ASHRAE Fundamentals 2021 Ch. 26 |
| **CLM-002** | Radiasi inframerah gelombang panjang mendominasi transfer panas (75-90%) | `technical_consensus` | `PARTIALLY_SUPPORTED` | `SOURCE_REFERENCE_KNOWN_BUT_NOT_RETRIEVED` | `TECHNICAL_REFERENCE_FOREIGN` | **QUALIFY** (Ubah angka 75-90% di prosa naskah menjadi prinsip kualitatif "jalur paling dominan") | BRANZ Study Report SR156 (2006) Sec. 4 |
| **CLM-003** | Aluminium foil emisivitas ε ≤ 0.05, reflektansi ≥ 95%, wajib rongga udara ≥ 20-25 mm | `verified_fact` | `VERIFIED` | `SOURCE_RETRIEVED_AND_VERIFIED` | `TECHNICAL_REFERENCE_FOREIGN` | **KEEP** | ASTM C1371-15 Sec. 11 & ASTM C1321-15 Sec. 6 (Air Space Min. 19-25 mm) |
| **CLM-004** | Foil bukan bulk insulation; R-value konduktif hampir nol tanpa rongga udara | `verified_fact` | `VERIFIED` | `SOURCE_RETRIEVED_AND_VERIFIED` | `TECHNICAL_REFERENCE_FOREIGN` | **KEEP** | ASTM C727-19 Sec. 4 & ASHRAE 90.1 |
| **CLM-005** | Udara panas terperangkap di loteng memanaskan plafon hingga malam | `inference` | `SUPPORTED` | `SOURCE_RETRIEVED_AND_VERIFIED` | `REGULATORY_LOCAL_TROPICAL` | **KEEP** | Puslitbang Permukiman PU & ITB (2018) Bab IV |
| **CLM-006** | Rasio ventilasi loteng seimbang soffit-ridge 1:300 hingga 1:150 | `technical_consensus` | `PARTIALLY_SUPPORTED` | `SOURCE_REFERENCE_KNOWN_BUT_NOT_RETRIEVED` | `TECHNICAL_REFERENCE_FOREIGN` (Bukan regulasi wajib Indonesia) | **QUALIFY** | International Residential Code (IRC 2021) Sec. R806; dikualifikasi dari SNI 03-6572-2001 |
| **CLM-007** | Trade-off tampias hujan, kasa kawat serangga, dan degradasi debu pada foil | `recommendation` | `SUPPORTED` | `SOURCE_RETRIEVED_AND_VERIFIED` | `TECHNICAL_REFERENCE_FOREIGN` | **KEEP** | BRANZ Bulletin 519 (2009) & Pedoman Bangunan Tropis |
| **CLM-008** | Atap metal tanpa plafon: foil penopang kawat adalah prioritas instan | `recommendation` | `SUPPORTED` | `SOURCE_RETRIEVED_AND_VERIFIED` | `REGULATORY_LOCAL_TROPICAL` | **KEEP** | Pedoman Teknis Desain Pasif Bangunan Tropis PU (2016) Bab 3 |

### 2. Standar Struktur Claim-to-Source
Setiap entri klaim kini mendukung skema:
```json
{
  "claim_id": "CLM-003",
  "statement": "...",
  "claim_class": "verified_fact",
  "evidence_status": "VERIFIED",
  "provenance_retrieval_status": "SOURCE_RETRIEVED_AND_VERIFIED",
  "sources": [
    {
      "source_id": "SRC-ASTM-C1321",
      "source_type": "standard",
      "publisher_or_author": "ASTM International",
      "document_title": "ASTM C1321-15...",
      "publication_or_revision_date": "2015",
      "page_or_section": "Section 6: Air Space Requirements",
      "applicability": "TECHNICAL_REFERENCE_FOREIGN",
      "support_type": "INSTALLATION_STANDARD",
      "limitations": "..."
    }
  ]
}
```

### 3. Batasan Kepenulisan Joko (*Authoring Boundary*)
- Klaim CLM-002 pada naskah draf awal (`draft-v1.md` dan `draft-final.md`) yang menyebutkan *"menyumbang 75% hingga 90% transfer panas pertama"* telah dikualifikasikan menjadi *"menjadi jalur transfer panas paling dominan yang langsung memanaskan udara loteng dan permukaan atas plafon"*.
- Joko dilarang mengutip persentase numerik spesifik jika sumber acuan tidak berstatus `VERIFIED` dari pengujian empiris langsung.

### 4. Rina Evidence QA Gate
- Menambahkan penegakan `CLAIM_SOURCE_PROVENANCE_MISSING` pada `evaluateHumanWritingQuality`.
- Jika naskah memuat klaim tanpa dokumen pembuktian persis yang dinyatakan pada opsi evaluasi (`hasMissingClaimProvenance: true`), Rina memberikan penalti 25 poin, menjatuhkan status ke `HUMAN_WRITING_REWRITE` (skor terdistorsi dibatasi maksimal 65), dan menetapkan Irwan (`evidence_researcher_lead`) sebagai `primary_owner` dengan alasan `RESEARCH_REQUIRED`.

---

## Part B: Multi-Issue Propagation Architecture

### 1. Evolusi `StructuredRewriteBrief`
```typescript
export interface StructuredRewriteBrief {
  target_agent_id: string;
  supporting_agent_id?: string;
  supporting_agent_ids?: string[];
  reason: 'HUMAN_WRITING_QUALITY';
  revision_reason?: 'RESEARCH_REQUIRED' | 'EDITORIAL_EXPLANATION_REQUIRED' | 'EDITORIAL_INTEGRITY_REVIEW' | 'HOMEOWNER_REFRAMING_REQUIRED';
  quality_decision?: HumanQualityDecision;
  quality_score?: number;
  quality_issue?: string;          // Backward compatibility (isu primer)
  primary_quality_issue?: string;  // Isu primer eksplisit
  quality_issues?: string[];       // Seluruh kode isu yang terdeteksi secara simultan
  // ...
}
```

### 2. Propagasi ke `TaskHandoffObservation`
Field `quality_metadata` pada `TaskHandoffObservation` kini merekam:
- `primary_quality_issue`: Isu pemblokir utama.
- `quality_issues`: Array seluruh isu mutu yang terdeteksi.
- `primary_owner` & `supporting_owners`: Pembagian kepemilikan koreksi antardepartemen.

### 3. Propagasi ke `JobTrace`
- Event `HUMAN_WRITING_REVISE_REQUESTED` menyertakan `primary_quality_issue`, `quality_issues`, dan `supporting_owners` pada objek `details`.
- Catatan event mencantumkan ringkasan multi-isu: `... - Revision required [N issues]`.
- Event `HANDOFF` menyertakan salinan `details: { ...h.quality_metadata }` saat terjadi serah terima berbasis ulasan mutu.

---

## Part C: Verifikasi & Hasil Pengujian

1. **Suite Baru `test-editorial-evidence-provenance.js`**: 15/15 tes lolos 100%.
2. **Suite Dry Run `test-editorial-production-dryrun.js`**: 13/13 tes lolos 100%.
3. **Regresi Seluruh Suite**:
   - `test-editorial-pipeline-integrity.js`: PASS
   - `test-expert-consultation.js`: PASS
   - `test-native-indonesian-authoring.js`: PASS
   - `test-editorial-human-quality.js`: PASS
   - `test-pixel-office-handoff.js`: PASS
   - `test-pixel-office-job-trace.js`: PASS
   - `test-soak-safety.js`: PASS
4. **Typecheck & Build**:
   - `npx tsc --noEmit`: 0 error (bersih).
   - `npm run build`: SSR bundle build Cloudflare Workers sukses tanpa error.

---

## Governance & Safety Invariants
- `automation_mode = OFF` (Terjaga)
- `AUTO_PUBLISH = OFF` (Terjaga)
- `publishingAuthority = 0` (Terjaga)
- `JEV_MODE = shadow` (Terjaga)
- `mediaWorker = DISABLED` (Terjaga)
- `Jefry execution authority = 0` (Terjaga)
- Mutasi database produksi D1: **0**
- Publikasi / Deploy: **Nihil**
