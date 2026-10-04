# EDITORIAL-EVIDENCE-SOURCE-VERIFICATION-1 — Actual Source Retrieval & Automatic Provenance Gate

## Executive Summary
Milestone `EDITORIAL-EVIDENCE-SOURCE-VERIFICATION-1` menutup kesenjangan fundamental antara **keberadaan metadata sitasi terstruktur** (*structured citation metadata*) dan **verifikasi retrieval sumber dokumen yang sebenarnya** (*actual source verification*).

Pada milestone sebelumnya (`EDITORIAL-EVIDENCE-PROVENANCE-1`), sistem berhasil menyusun keterkaitan klaim-ke-sumber (*claim-to-source structure*). Namun, nama standar, nomor dokumen, bab, atau bagian standar **tidak boleh dianggap sebagai bukti terverifikasi** kecuali teks dokumen sumber memang benar-benar diakses/dibaca oleh sistem dari repositori dokumen atau sumber legal yang tersedia di lingkungan kerja. Ingatan model AI mengenai isi standar, pasal, atau bab **bukanlah proses retrieval**.

---

## 1. Prinsip Inti: Metadata vs Retrieval

Sistem membedakan secara ketat:
1. `SOURCE_METADATA_EXISTS`: Sistem memiliki judul dokumen, nomor standar, penerbit, atau nomor bab berdasarkan katalog acuan atau ingatan model.
2. `SOURCE_CONTENT_WAS_ACTUALLY_RETRIEVED_AND_VERIFIED`: Sistem mengakses dokumen fisik/digital (PDF repositori, dokumen lokal, atau teks primer resmi) selama alur kerja berlangsung, mencatat jalur file/URL, metode pengambilan, waktu verifikasi, dan hash konten.

### Larangan Fabrikasi
Model dilarang keras mengarang atau mereka-reka:
- Nomor pasal / nomor halaman yang seolah-olah dibaca
- Kutipan langsung dari dokumen berbayar yang tidak ada di workspace
- Tahun revisi yang tidak terverifikasi
- Kesimpulan uji laboratorium yang tidak pernah dilakukan
- Ambang batas numerik buatan tanpa rujukan primer terbuka

---

## 2. Audit Sumber Artikel Atap Metal (`scripts/dryrun/evidence-pack.json`)

Hasil audit kejujuran (*honesty audit*) terhadap seluruh sumber yang dirujuk:

| Source ID | Dokumen / Organisasi | Status Retrieval Riil | Status Klaim Turunan | Keterangan & Batasan |
| :--- | :--- | :--- | :--- | :--- |
| **SRC-SNI-6572** | BSN (SNI 03-6572-2001) | `SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED` | `PARTIALLY_SUPPORTED` | SNI ventilasi alami ruang hunian. Diakui sebagai acuan lokal, namun naskah lengkap tidak tersimpan di repositori. |
| **SRC-ASHRAE-FUND** | ASHRAE (Fundamentals Handbook 2021) | `SOURCE_METADATA_ONLY` | `PARTIALLY_SUPPORTED` | Buku pegangan berbayar; teks lengkap tidak tersedia di workspace. Nilai konduktivitas termal metal tipis disajikan sebagai konsensus. |
| **SRC-BRANZ-ROOF** | BRANZ (Study Report SR156) | `SOURCE_METADATA_ONLY` | `PARTIALLY_SUPPORTED` | Laporan riset luar negeri; teks lengkap tidak di-cache lokal. Angka radiasi (75-90%) wajib dikualifikasikan menjadi prinsip kualitatif "jalur paling dominan". |
| **SRC-ASTM-C1371** | ASTM International (C1371 Emittance) | `SOURCE_METADATA_ONLY` | `PARTIALLY_SUPPORTED` | Standar uji laboratorium berbayar; dokumen lengkap tidak tersimpan di lingkungan lokal. Dikualifikasikan menjadi konsensus teknis. |
| **SRC-ASTM-C1321** | ASTM International (C1321 Radiant Barrier) | `SOURCE_METADATA_ONLY` | `PARTIALLY_SUPPORTED` | Standar instalasi; ketentuan celah udara (air gap 19-25 mm) disajikan sebagai panduan praktik lapangan. |
| **SRC-ASTM-C727** | ASTM International (C727 Reflective Insulation)| `SOURCE_METADATA_ONLY` | `PARTIALLY_SUPPORTED` | Standar praktik instalasi insulasi reflektif; dokumen tidak diambil langsung. |
| **SRC-PUPR-LOTENG** | Puslitbang Permukiman PU & ITB (2018) | `SOURCE_METADATA_ONLY` | `SUPPORTED` | Laporan publikasi terbuka; dokumen indeks publik, bukan file PDF lokal terverifikasi. |
| **SRC-IRC-R806** | International Code Council (IRC 2021 R806) | `SOURCE_METADATA_ONLY` | `PARTIALLY_SUPPORTED` | Building code Amerika Utara; ditegaskan sebagai referensi teknis asing, bukan regulasi wajib Indonesia. |
| **SRC-BRANZ-B519** | BRANZ (Bulletin 519) | `SOURCE_METADATA_ONLY` | `SUPPORTED` | Catatan teknis lapangan luar negeri terkait debu dan serangga. |
| **SRC-DESAIN-PASIF**| Puslitbang Permukiman PU (2016) | `SOURCE_METADATA_ONLY` | `SUPPORTED` | Pedoman teknis desain pasif bangunan tropis. |

---

## 3. Matriks Verifikasi Klaim CLM-001 hingga CLM-008

| Claim ID | Pernyataan Ringkas | Status Bukti Baru | Status Retrieval | Tindakan Naskah | Status di Prosa Joko |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CLM-001** | Konduktivitas seng k ≈ 50-60 W/m·K; radiasi 800-1000 W/m²; suhu 60-75°C | `PARTIALLY_SUPPORTED` | `SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED` | **QUALIFY** | Disajikan sebagai prinsip fisika termal atap tipis di iklim tropis, bukan angka uji sertifikasi mutlak. |
| **CLM-002** | Radiasi inframerah mendominasi transfer panas (75-90%) | `PARTIALLY_SUPPORTED` | `SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED` | **QUALIFY** | Angka persentase 75-90% dihapus dari klaim faktual; diganti menjadi prinsip kualitatif "jalur transfer panas paling dominan". |
| **CLM-003** | Aluminium foil emisivitas ε ≤ 0.05, reflektansi ≥ 95%, air gap ≥ 20-25 mm | `PARTIALLY_SUPPORTED` | `SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED` | **QUALIFY** | Disajikan sebagai penjelasan mekanisme kerja radiant barrier dan perlunya celah udara agar tidak beralih menjadi konduksi kontak. |
| **CLM-004** | Foil bukan bulk insulation; R-value nol tanpa rongga udara | `PARTIALLY_SUPPORTED` | `SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED` | **QUALIFY** | Ditekankan sebagai edukasi bagi pembaca bahwa selembar foil tipis tidak menggantikan insulasi massa tebal. |
| **CLM-005** | Udara panas terperangkap di loteng memanaskan plafon hingga malam | `SUPPORTED` | `SOURCE_METADATA_ONLY` | **QUALIFY** | Dipaparkan sebagai fenomena perangkap panas (heat trap) harian. |
| **CLM-006** | Rasio ventilasi loteng seimbang 1:300 hingga 1:150 | `PARTIALLY_SUPPORTED` | `SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED` | **QUALIFY** | Dinyatakan sebagai acuan standar perancangan ventilasi konsensus internasional (IRC), bukan regulasi wajib Indonesia. |
| **CLM-007** | Trade-off tampias hujan lebat, kawat serangga, dan degradasi debu | `SUPPORTED` | `SOURCE_METADATA_ONLY` | **KEEP** | Trade-off fisik transparan disampaikan sebelum renovasi. |
| **CLM-008** | Atap metal ekspos: foil kawat penopang adalah prioritas seketika | `SUPPORTED` | `SOURCE_METADATA_ONLY` | **KEEP** | Rekomendasi skenario ruang fungsional non-plafon. |

---

## 4. Keamanan Klaim Numerik (*Numeric Claim Safety*)

Klaim numerik persis memerlukan pembuktian dokumen primer yang sebenarnya.
- Jika dokumen primer tidak diambil langsung: **angka tidak boleh disajikan sebagai fakta mutlak terverifikasi lab**.
- Jika prinsip kualitatifnya kokoh secara fisika bangunan: **pertahankan prinsip kualitatif, kualifikasikan atau hilangkan klaim angka yang tidak berbukti primer**.
- Di naskah Joko (`draft-final.md`): angka 75–90% telah digantikan dengan prinsip kualitatif "jalur transfer panas paling dominan", dan rasio 1:300–1:150 dikualifikasikan sebagai acuan teknis perancangan internasional.

---

## 5. Mekanisme Otomatis Derivasi Provenance (`auditEvidencePackProvenance`)

Pada `src/lib/article/human-quality.ts`:
- Fungsi `auditEvidencePackProvenance(evidencePack, contentMd)` secara deterministik menganalisis `claim_inventory`.
- Jika sebuah klaim berstatus `VERIFIED` namun tidak memiliki sumber berstatus `SOURCE_RETRIEVED_AND_VERIFIED`, atau jika klaim numerik tidak terverifikasi beraksi `KEEP`, fungsi otomatis mengembalikan `requires_provenance_failure: true`.
- Evaluator `evaluateHumanWritingQuality` memanfaatkan opsi `options.evidencePack`. Jika opsi ini diberikan, Rina QA **secara otomatis mendeteksi anomali provenance** (`CLAIM_SOURCE_PROVENANCE_MISSING`) tanpa bergantung pada boolean manual dari pemanggil (`hasMissingClaimProvenance: true`).
- Fail-Closed: Jika provenance tidak terbukti, evaluasi langsung jatuh ke `HUMAN_WRITING_REWRITE` dengan Irwan (`evidence_researcher_lead`) sebagai `primary_owner` revisi berargumen `RESEARCH_REQUIRED`.

---

## 6. Kesiapan Cache Dokumen Hermes (*Source Cache Readiness Gap*)

Audit infrastruktur saat ini menemukan:
- **Status Sekarang**: Repositori belum memiliki direktori penyimpanan cache dokumen standar PDF lokal (misalnya `docs/evidence_cache/` atau direktori terindeks khusus di container Hermes `/opt/data/rancangloka/sources/`).
- **Kesenjangan yang Didokumentasikan**: Seluruh rujukan standar asing (ASTM, ASHRAE, IRC, BRANZ) saat ini berstatus `SOURCE_METADATA_ONLY` atau `SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED`.
- **Rekomendasi Arsitektural Masa Depan**: Ketika sistem penyimpanan dokumen primer disiapkan, alurnya adalah:
  `Irwan -> Download/Ingest PDF -> Hash Dokumen -> Simpan di Cache -> Ekstrak Pasal/Paragraf Relevan -> Tautkan ke Claim Inventory -> Status SOURCE_RETRIEVED_AND_VERIFIED`.

---

## 7. Keamanan Hak Cipta & Kutipan (*Copyright / Quote Safety*)

- Sistem **tidak mereproduksi** naskah lengkap standar berbayar (ASTM, ASHRAE, SNI).
- Evidence Pack hanya mencatat parafrase presisi teknis, identitas standar, nomor bab/bagian, dan batasan penerapan (*limitations*).
- Dengan cara ini, ketertelusuran ilmiah tercapai tanpa melanggar batasan lisensi pihak ketiga.

---

## 8. Verifikasi & Pengujian

1. **Suite Baru `test-editorial-evidence-source-verification.js`**: 16/16 tes lolos 100%.
2. **Suite `test-editorial-evidence-provenance.js`**: 15/15 tes lolos 100%.
3. **Suite `test-editorial-production-dryrun.js`**: 13/13 tes lolos 100%.
4. **Regresi Seluruh Pipeline & Safety**:
   - `test-editorial-pipeline-integrity.js`: 14 tes PASS
   - `test-expert-consultation.js`: 22 tes PASS
   - `test-native-indonesian-authoring.js`: 13 tes PASS
   - `test-editorial-human-quality.js`: 22 tes PASS
   - `test-editorial-knowledge.js`: 19 tes PASS
   - `test-verdict-guard.js`: 11 tes PASS
   - `test-pixel-office-handoff.js`: 26 tes PASS
   - `test-pixel-office-job-trace.js`: 24 tes PASS
   - `test-article-persistence.js`: 7 tes PASS
   - `test-content-quarantine.js`: 19 tes PASS
   - `test-soak-safety.js`: 54 tes PASS
   - `npx tsc --noEmit`: 0 error
   - `npm run build`: SSR build sukses
