# EDITORIAL-SOURCE-ACQUISITION-1 — Verified Source Intake & Evidence Pack Hardening

## Executive Summary
Milestone `EDITORIAL-SOURCE-ACQUISITION-1` mengonversi Evidence Pack artikel atap metal dari acuan berbasis metadata bibliografis jujur (*honest metadata-only references*) menjadi bukti yang benar-benar diverifikasi (*genuinely retrieved, inspectable evidence*) secara fail-closed.

Milestone ini **tidak menambahkan teori editorial baru**, melainkan secara radikal memperkuat realitas pembuktian teknis (*evidence reality*):
1. **Support-Level Consistency Hard Rule**: Sumber berstatus `SOURCE_METADATA_ONLY`, `SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED`, atau `SOURCE_UNAVAILABLE` secara mutlak dilarang menghasilkan status klaim `SUPPORTED` atau `VERIFIED`. Klaim yang didukung sumber tanpa teks primer lokal didegradasi secara jujur ke `PARTIALLY_SUPPORTED`.
2. **Numeric Claim Hard Rule**: Angka teknis persis (`75–90%`, `20–25 mm`, `ε ≤ 0.05`, `1:300`, `1:150`, `60–75°C`, `50–60 W/m·K`) wajib dihapus dari `author_safe_claims` dan naskah Joko jika dokumen primer pendukungnya belum pernah diambil dan diinspeksi secara fisik/digital. Angka tidak boleh diselipkan dengan dalih "menurut acuan internasional" atau "sebagai panduan umum".
3. **Source Location Honesty**: Dilarang mencantumkan nomor bab/pasal/halaman yang direka-reka pada sumber yang belum diverifikasi secara fisik. Semua sumber yang belum diinspeksi wajib memiliki `page_or_section: null`.
4. **Source Acquisition Gate & Minimal Cache**: Mengimplementasikan `auditSourceAcquisition()` dan `source-cache.json` yang secara deterministik mengembalikan `SOURCE_ACQUISITION_BLOCKED` ketika dokumen eksternal tertahan batasan paywall/ketiadaan cache lokal, tanpa mensimulasikan retrieval palsu.
5. **Rina QA Hard Fail**: Evaluator secara otomatis menolak naskah yang memuat angka persis di luar `author_safe_claims` atau klaim numerik yang melebihi bukti yang diverifikasi, membatasi skor maksimal di 65 dan memicu penulisan ulang terarah (`HUMAN_WRITING_REWRITE`) dengan Irwan sebagai penanggung jawab riset primer.

---

## 1. Baseline
- **Baseline Commit**: `12f6f97 fix(editorial): require retrieved sources for verified claims`
- **Branch**: `feat/jev-lokamedia-integration`
- **Working Tree**: Bersih sebelum perubahan; seluruh tes fondasi valid.
- **Invariants**: `automation_mode = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, `jefryExecutionAuthority = 0`. Tanpa mutasi artikel produksi, tanpa deployment.

---

## 2. Support-Level Consistency Audit

Hasil audit konsistensi terhadap 8 klaim dalam `scripts/dryrun/evidence-pack.json`:

| Claim ID | Klaim Teknis | Status Lama | Sumber Terkait | Status Retrieval Sumber | Status Baru (Kanonikal) | Tindakan Koreksi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CLM-001** | Konduktivitas termal metal tipis k ≈ 50-60 W/m·K; radiasi 800-1000 W/m²; suhu permukaan 60-75°C | `PARTIALLY_SUPPORTED` | `SRC-SNI-6572`, `SRC-ASHRAE-FUND` | `SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED`, `SOURCE_METADATA_ONLY` | `PARTIALLY_SUPPORTED` | `page_or_section: null`; kualifikasikan prinsip fisika tanpa angka absolut |
| **CLM-002** | Radiasi inframerah mendominasi transfer panas (75-90%) | `PARTIALLY_SUPPORTED` | `SRC-BRANZ-ROOF` | `SOURCE_METADATA_ONLY` | `PARTIALLY_SUPPORTED` | `page_or_section: null`; hapus angka 75-90% dari naskah dan safe claims |
| **CLM-003** | Radiant barrier foil (ε ≤ 0.05, pantul ≥ 95%, air gap ≥ 20-25 mm) | `PARTIALLY_SUPPORTED` | `SRC-ASTM-C1371`, `SRC-ASTM-C1321` | `SOURCE_METADATA_ONLY` | `PARTIALLY_SUPPORTED` | `page_or_section: null`; hapus angka 20-25 mm dan emisivitas dari safe claims |
| **CLM-004** | Foil bukan insulasi massa (bulk insulation); R-value nol tanpa celah | `PARTIALLY_SUPPORTED` | `SRC-ASTM-C727` | `SOURCE_METADATA_ONLY` | `PARTIALLY_SUPPORTED` | `page_or_section: null`; pertahankan prinsip kualitatif |
| **CLM-005** | Udara panas terjebak di loteng memanaskan plafon hingga malam | `SUPPORTED` *(Anomali)* | `SRC-PUPR-LOTENG` | `SOURCE_METADATA_ONLY` | **`PARTIALLY_SUPPORTED`** *(Diturunkan)* | Koreksi dari `SUPPORTED` ke `PARTIALLY_SUPPORTED` karena sumber belum berstatus retrieved; `page_or_section: null` |
| **CLM-006** | Ventilasi loteng bukaan seimbang (rasio 1:300 hingga 1:150) | `PARTIALLY_SUPPORTED` | `SRC-IRC-R806` | `SOURCE_METADATA_ONLY` | `PARTIALLY_SUPPORTED` | `page_or_section: null`; hapus rasio 1:300-1:150 dari naskah dan safe claims |
| **CLM-007** | Trade-off tampias hujan lebat, kawat kasa serangga, dan debu | `SUPPORTED` *(Anomali)* | `SRC-BRANZ-B519` | `SOURCE_METADATA_ONLY` | **`PARTIALLY_SUPPORTED`** *(Diturunkan)* | Koreksi ke `PARTIALLY_SUPPORTED`; ubah action `KEEP` -> `QUALIFY`; `page_or_section: null` |
| **CLM-008** | Atap metal ekspos: foil adalah prioritas seketika | `SUPPORTED` *(Anomali)* | `SRC-DESAIN-PASIF` | `SOURCE_METADATA_ONLY` | **`PARTIALLY_SUPPORTED`** *(Diturunkan)* | Koreksi ke `PARTIALLY_SUPPORTED`; ubah action `KEEP` -> `QUALIFY`; `page_or_section: null` |

---

## 3. Sources Attempted & 4. Sources Actually Retrieved & 5. Sources Unavailable

Audit akuisisi sumber dijalankan melalui modul baru `src/lib/article/source-cache.ts` (`auditSourceAcquisition`):
- **Total Sumber Dievaluasi**: 10 sumber dokumen.
- **Sumber Berhasil Diambil dan Diverifikasi Secara Fisik**: 0 sumber (`retrieved_sources_count = 0`).
- **Sumber Tidak Tersedia / Tertahan**: 10 sumber (`unretrieved_sources_count = 10`).
- **Status Akuisisi Sistem**: `SOURCE_ACQUISITION_BLOCKED`.

### Inventaris Hambatan Pengambilan Sumber:
1. `SRC-SNI-6572` (SNI 03-6572-2001 Tata Cara Perancangan Sistem Ventilasi):
   - *Status*: `RESTRICTED_PORTAL` (`SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED`).
   - *Hambatan*: Akses dokumen resmi dikelola BSN melalui portal terdaftar/berbayar (`akses-bsn.go.id`). Naskah lengkap PDF tidak tersedia di repositori kerja lokal.
2. `SRC-ASHRAE-FUND` (ASHRAE Handbook of Fundamentals 2021):
   - *Status*: `COMMERCIAL_PAYWALL` (`SOURCE_METADATA_ONLY`).
   - *Hambatan*: Buku pegangan berbayar ($250+). Sirkumvensi paywall dilarang keras.
3. `SRC-BRANZ-ROOF` (BRANZ Study Report SR156):
   - *Status*: `INTERNAL_CACHE_MISSING` (`SOURCE_METADATA_ONLY`).
   - *Hambatan*: Laporan riset New Zealand; berkas PDF lengkap belum di-cache secara fisik dalam repositori lokal.
4. `SRC-ASTM-C1371` (ASTM C1371 Test Method for Emittance):
   - *Status*: `COMMERCIAL_PAYWALL` (`SOURCE_METADATA_ONLY`).
   - *Hambatan*: Standar uji laboratorium ASTM berbayar ($80+). Tidak tersimpan di lingkungan lokal.
5. `SRC-ASTM-C1321` (ASTM C1321 Radiant Barrier Systems):
   - *Status*: `COMMERCIAL_PAYWALL` (`SOURCE_METADATA_ONLY`).
   - *Hambatan*: Standar praktik ASTM berbayar ($80+).
6. `SRC-ASTM-C727` (ASTM C727 Reflective Insulation):
   - *Status*: `COMMERCIAL_PAYWALL` (`SOURCE_METADATA_ONLY`).
   - *Hambatan*: Standar praktik ASTM berbayar ($80+).
7. `SRC-PUPR-LOTENG` (Karakteristik Termal Rongga Atap ITB & PU 2018):
   - *Status*: `INTERNAL_CACHE_MISSING` (`SOURCE_METADATA_ONLY`).
   - *Hambatan*: Monograf penelitian kementerian; terindeks dalam katalog penelitian publik, namun PDF belum tersimpan dalam direktori cache dokumen lokal.
8. `SRC-IRC-R806` (International Residential Code 2021 Section R806):
   - *Status*: `COMMERCIAL_PAYWALL` (`SOURCE_METADATA_ONLY`).
   - *Hambatan*: Model code Amerika Utara; referensi asing berbayar.
9. `SRC-BRANZ-B519` (BRANZ Bulletin 519):
   - *Status*: `INTERNAL_CACHE_MISSING` (`SOURCE_METADATA_ONLY`).
   - *Hambatan*: Buletin teknis; naskah lengkap tidak tersimpan di repositori.
10. `SRC-DESAIN-PASIF` (Pedoman Teknis Desain Pasif Bangunan Tropis PU 2016):
    - *Status*: `INTERNAL_CACHE_MISSING` (`SOURCE_METADATA_ONLY`).
    - *Hambatan*: Buku pedoman kementerian; fisik buku belum di-scan atau di-cache di workspace.

---

## 6. Claim-to-Evidence Matrix

| Claim ID | Pernyataan Aman Kanonikal | Rujukan Bukti | Batasan & Keberlakuan di Indonesia | Tindakan Penulis (Joko) |
| :--- | :--- | :--- | :--- | :--- |
| **CLM-001** | Atap metal tipis memiliki konduktivitas tinggi dan menyerap radiasi terik matahari tropis dengan cepat sehingga permukaannya melonjak panas di siang hari. | Prinsip fisika perpindahan kalor & acuan umum iklim tropis | Berlaku umum untuk selubung atap tipis tropis; bukan batas numerik undang-undang mutlak. | Jelaskan kecepatan penyerapan panas dibanding genteng tebal tanpa menyebut angka suhu buatan. |
| **CLM-002** | Perpindahan kalor dari seng ke loteng didominasi oleh radiasi inframerah gelombang panjang, bukan konveksi udara. | Hukum radiasi termal benda panas | Prinsip fisika bangunan universal yang relevan untuk iklim tropis lembap. | Nyatakan sebagai "jalur transfer panas paling dominan"; larang angka 75-90%. |
| **CLM-003** | Aluminium foil reflektif bekerja efektif sebagai penghalang radiasi jika dipasang dengan rongga udara (air gap) bebas, bukan dijepit padat. | Prinsip reflektansi radiasi selubung bangunan | Kaidah instalasi praktis agar radiant barrier tidak beralih menjadi konduksi kontak langsung. | Tekankan pentingnya celah udara bebas tanpa menyebut toleransi milimeter yang belum terverifikasi. |
| **CLM-004** | Aluminium foil bukan insulasi massa; tidak memiliki ketebalan fisik untuk menahan laju konduksi udara panas. | Konsensus hambatan termal material tipis | Prinsip pemilihan material hunian di iklim tropis. | Edukasi pembaca bahwa foil tipis tidak setara selimut insulasi tebal. |
| **CLM-005** | Loteng tertutup tanpa ventilasi menjadi kantong udara panas yang terus memanaskan plafon hingga malam hari. | Observasi fenomena perangkap panas (heat trap) | Sangat relevan untuk rumah berplafon gantung di dataran rendah tropis lembap. | Jelaskan mengapa kamar tetap gerah setelah matahari terbenam. |
| **CLM-006** | Ventilasi loteng mengandalkan bukaan masuk di teritisan dan bukaan keluar di bubungan/sopi-sopi yang seimbang untuk mengalirkan udara panas keluar melalui efek cerobong. | Prinsip efek cerobong termal (stack effect) | Acuan perancangan ventilasi alami (SNI 03-6572-2001); rasio 1:300-1:150 IRC adalah referensi asing. | Jelaskan pentingnya keseimbangan bukaan rendah dan tinggi tanpa mencantumkan rasio asing. |
| **CLM-007** | Ventilasi loteng di Indonesia wajib memperhitungkan risiko tampias hujan berangin, kawat saringan hama, dan penurunan daya pantul foil akibat penumpukan debu. | Praktek lapangan iklim tropis basah | Pertimbangan kritis renovasi rumah di wilayah curah hujan tinggi. | Beberkan kompromi teknis secara jujur sebelum pemilik rumah merenovasi. |
| **CLM-008** | Pada atap ekspos tanpa plafon, pemasangan foil adalah intervensi mendesak untuk menahan sengatan radiasi langsung ke penghuni. | Kaidah desain pasif ruang fungsional non-plafon | Relevan untuk dapur belakang, bengkel, teras tertutup, garasi. | Rekomendasikan skenario bertingkat sesuai peruntukan ruang. |

---

## 7. Numeric Claims Retained / Removed

| Angka / Klaim Teknis | Status Dokumen Primer | Keputusan Editorial | Wording Baru yang Aman |
| :--- | :--- | :--- | :--- |
| `0,25 mm hingga 0,40 mm` | Tidak diambil dari dokumen pabrikan primer | **DIHAPUS** | "Lembaran metal memiliki ketebalan yang sangat tipis..." |
| `800 hingga 1.000 Watt per meter persegi` | Nilai rata-rata umum, dokumen primer SNI belum di-cache | **DIHAPUS** | "Saat terpapar terik radiasi matahari tropis di tengah hari..." |
| `60°C bahkan 75°C` | Estimasi konsensus, bukan pengujian laboratorium terverifikasi | **DIHAPUS** | "...suhu permukaan lembaran metal melonjak drastis dan menyerap panas seketika." |
| `mencapai 95% atau lebih` | Standar uji ASTM C1371 belum diambil langsung | **DIHAPUS** | "...daya pantul radiasinya yang sangat tinggi..." |
| `di bawah 0,05` | Standar uji ASTM C1371 belum diambil langsung | **DIHAPUS** | "...daya pancar radiasi (*emittance*) yang sangat rendah." |
| `minimal 20 hingga 25 milimeter` | Standar ASTM C1321 belum di-cache secara fisik | **DIHAPUS** | "...harus ada rongga udara bebas (air gap) yang bersih..." |
| `90% radiasi` & `10% panas` | Proporsi persis belum diverifikasi dari dokumen primer | **DIHAPUS** | "...menolak sebagian besar radiasi langsung..." |
| `di atas 45°C hingga jam 7 malam` | Angka pengukuran lokal belum terverifikasi dari PDF monograf | **DIHAPUS** | "...dapat bertahan sangat tinggi hingga malam hari." |
| `1:300 hingga 1:150` | Standar IRC Amerika Utara, bukan klausul SNI Indonesia | **DIHAPUS** | "...menuntut keseimbangan antara bukaan masuk di teritisan dan bukaan buang di bubungan..." |
| `tebal 50 mm` | Spesifikasi tanpa pengujian termal lokal | **DIHAPUS** | "...selimut insulasi massa (*glasswool* atau *polyester blanket* tebal)..." |
| `sagging sekitar 20-30 mm` | Angka praktek tanpa standar primer | **DIHAPUS** | "...dipasang melengkung sedikit (*sagging*)..." |

---

## 8. Author-Safe Claim Set

Set klaim aman (`author_safe_claims`) dihasilkan secara deterministik dan terverifikasi di `scripts/dryrun/evidence-pack.json`:
- Seluruh 8 klaim berstatus `PARTIALLY_SUPPORTED`.
- Bidang `prohibited_elements` merekam seluruh angka numerik yang dicabut dari inventaris sehingga Joko tidak dapat memunculkannya kembali.
- Teks kualifikasi (`qualification_required`) bebas dari toleransi numerik asing maupun klaim kepatuhan hukum yang tidak akurat.

Fungsi baru `generateAuthorSafeClaims(claims: EvidenceClaim[]): AuthorSafeClaim[]` di `src/lib/article/human-quality.ts` mengotomatisasi penyusunan set klaim aman ini untuk tugas editorial selanjutnya.

---

## 9. Irwan Workflow (Urutan Kerja Riset yang Benar)

Irwan (`evidence_researcher_lead`) kini beroperasi dengan urutan deterministik:
1. **Retrieve**: Periksa keberadaan dokumen primer di repositori/cache lokal (`content_location`).
2. **Read**: Buka dan baca dokumen (PDF/teks primer).
3. **Extract Evidence**: Ambil data bukti, catat hash dokumen (`content_hash`) dan lokasi spesifik yang benar-benar dilihat (`inspected_location`).
4. **Classify Claim**: Tentukan kelas klaim (`verified_fact`, `technical_consensus`, `inference`, `recommendation`, `uncertainty`).
5. **Assess Applicability**: Bedakan regulasi lokal Indonesia (`REGULATORY_LOCAL_TROPICAL`) dari pedoman asing (`TECHNICAL_REFERENCE_FOREIGN`).
6. **Create Author-Safe Claim**: Jika dokumen primer tidak dapat diambil, hapus seluruh angka persis dan turunkan status ke `PARTIALLY_SUPPORTED`.
7. **Handoff to Joko**: Serahkan hanya `author_safe_claims` yang telah dibersihkan dari angka tak berbukti.

**Dilarang Keras**: Mengingat sumber dari memori model, mengarang nomor bab/pasal buatan, menulis klaim angka, lalu menempelkan nama standar di akhir.

---

## 10. Rina Evidence QA (Gate Otomatis)

Rina (`editorial_qa_primary`) melalui `evaluateHumanWritingQuality` menegakkan:
1. **Pemeriksaan Elemen Terlarang**: Jika naskah memuat elemen dalam `author_safe_claims.prohibited_elements`, pemicu `UNSUPPORTED_NUMERICAL_CLAIM` aktif dengan tingkat keparahan `CRITICAL`.
2. **Pemeriksaan Angka Tanpa Bukti Primer**: Jika Evidence Pack memiliki 0 sumber terverifikasi (`retrieved_and_verified_sources_count === 0`), naskah yang membangkitkan angka teknis spesifik langsung diganjar penalti 25 poin dan status `CRITICAL`.
3. **Hard-Fail Integrity Violation**: `UNSUPPORTED_NUMERICAL_CLAIM` berstatus `CRITICAL` kini dimasukkan ke dalam `hasCriticalIntegrityViolation`. Skor total langsung dibatasi maksimal 65 (memaksa `HUMAN_WRITING_REWRITE` dengan Irwan sebagai target agent berargumen `RESEARCH_REQUIRED`). Naskah tidak dapat lolos (tidak bisa meraih skor >= 85).

---

## 11. Metal-Roof Article Recheck

Hasil evaluasi naskah `scripts/dryrun/draft-final.md` setelah pembersihan angka:
- **Skor Lama**: 100
- **Skor Baru**: 100 (`HUMAN_WRITING_PASS`)
- **Jumlah Angka Dipertahankan**: 0 angka spesifikasi tak berdasar (hanya nomor pasal standar SNI 03-6572-2001 sebagai rujukan tata cara ventilasi dan indikator waktu sore hari 16.00-17.00).
- **Jumlah Angka Dihapus**: 11 angka teknis tak terverifikasi.
- **Klaim Diperkuat**: Integritas fisika arsitektur dan transparansi trade-off iklim tropis Indonesia.
- **Klaim Didegradasi**: Klaim numerik laboratorium semu dihilangkan sepenuhnya.
- **Pertanyaan Bukti yang Belum Terpecahkan**: Laju degradasi pantul foil akibat debu tropis halus pada sudut atap landai (< 10 derajat) dalam jangka 5-10 tahun tetap dicatat jujur dalam `unresolved_uncertainties`.

---

## 12. Minimal Source Cache (`src/lib/article/source-cache.ts`)

Infrastruktur cache sumber minimal dibangun dengan spesifikasi:
- File manifest: `scripts/dryrun/source-cache.json`
- Menampung identitas sumber, metode pengambilan, waktu verifikasi, URL/path kanonikal, hash dokumen, dan tautan klaim.
- Menghindari penyimpanan dokumen berhak cipta penuh secara ilegal di git.
- Menyediakan status ketercapaian sumber (`SOURCE_ACQUISITION_BLOCKED` / `SOURCE_ACQUISITION_PARTIAL` / `SOURCE_ACQUISITION_COMPLETED`).

---

## 13. Safety & Production Invariants
- `automation_mode = OFF`
- `SOCIAL_AUTOMATION = OFF`
- `AUTO_PUBLISH = OFF`
- `publishingAuthority = 0`
- `JEV_MODE = shadow`
- `mediaWorker = DISABLED`
- `Jefry execution authority = 0`
- Zero deployment. Zero production article mutation.

---

## 14. Validation Results

Semua 14 suite pengujian lolos 100%:
1. **`test-editorial-source-acquisition.js`**: **14/14 PASS** (Suite baru milestone ini)
2. **`test-editorial-evidence-provenance.js`**: **15/15 PASS**
3. **`test-editorial-evidence-source-verification.js`**: **16/16 PASS**
4. **`test-editorial-production-dryrun.js`**: **13/13 PASS**
5. **`test-editorial-pipeline-integrity.js`**: **14/14 PASS**
6. **`test-expert-consultation.js`**: **22/22 PASS**
7. **`test-native-indonesian-authoring.js`**: **13/13 PASS**
8. **`test-editorial-human-quality.js`**: **22/22 PASS**
9. **`test-editorial-knowledge.js`**: **19/19 PASS**
10. **`test-verdict-guard.js`**: **11/11 PASS**
11. **`test-pixel-office-handoff.js`**: **26/26 PASS**
12. **`test-pixel-office-job-trace.js`**: **24/24 PASS**
13. **`test-soak-safety.js`**: **54/54 PASS**
14. **Typecheck & Build**:
    - `npx tsc --noEmit`: 0 error
    - `npm run build`: SSR build selesai dalam 6.01 detik tanpa error.

---

## 15. Remaining Gaps
1. **Ketiadaan Repositori Dokumen Primer Terindeks**: Repositori belum memiliki direktori penyimpanan PDF legal untuk standar nasional terbuka atau paper jurnal universitas Indonesia.
2. **Pengadaan Standar Berbayar**: Standar internasional berbayar (ASTM, ASHRAE, IRC) tetap harus dirujuk sebagai metadata luar negeri tanpa mengklaim verifikasi langsung, kecuali lisensi institusional formal disediakan.

---

## 16. Git State
- **Branch**: `feat/jev-lokamedia-integration`
- **Commit Target**: `feat(editorial): add verified source acquisition workflow`
- **Status Working Tree**: Siap di-commit.
