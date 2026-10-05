# 📋 RancangLoka — Checkpoint RESEARCH-SOURCE-COVERAGE-1
## Authentic Multi-Source Acquisition & Admissible Coverage Architecture

> **Checkpoint ID:** `RESEARCH-SOURCE-COVERAGE-1-CHECKPOINT-20261005`  
> **Timestamp:** `2026-10-05T22:42:00+07:00`  
> **Branch:** `feat/jev-lokamedia-integration`  
> **Baseline Commit:** `273265cd7a51e49102b87c28f44cc4b508028975` (`fix(editorial): expand authentic research acquisition coverage`)  
> **Milestones Covered:** `RESEARCH-SOURCE-COVERAGE-1`  
> **Classification:** **`RESEARCH_SOURCE_COVERAGE_1_PASS`**  
> **Stop Gate:** **`RESEARCH_SOURCE_COVERAGE_1_HUMAN_REVIEW_REQUIRED`**  
> **Safety State:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, `Jefry execution authority = 0`

---

## 1. Ringkasan Eksekutif & Akar Masalah Final3

Pada eksekusi kanonikal **EDITORIAL FINAL CLEAN PROOF #3** (`run-runtime-final3.js`), pipeline berhenti secara aman (*fail-closed*) dengan status `FINAL3_RESEARCH_INSUFFICIENT` dan Joko tetap tidak terpanggil (`totalAttempts = 0`). Hasil ini membuktikan keandalan gerbang autentisitas:
- Kandidat ditemukan: 7; Dokumen diunduh: 2 (`SRC-OPEN-EPA-MOISTURE`, `SRC-OPEN-WIKI-DAMP`).
- Sumber riil terotentikasi: 0 (`test_fixture_source_count = 1`, `synthetic_fixture_source_count = 1`).
- Gerbang autentisitas sumber menolak wewenang kedua fixture lokal sintetis tersebut dalam `REAL_RUNTIME_EXECUTION`.

Namun, audit forensik menemukan **cacat arsitektur pada kalkulasi ketercakupan riset (*coverage accounting defect*)**:
- Riset melaporkan ketercakupan `3 / 6 categories = 50%` meskipun `real_authoritative_source_count = 0` dan `claim_source_relationship_count = 0`.
- **Akar Penyebab:** Validator ketercakupan sebelumnya menghitung rasio ketercakupan dari *seluruh* klaim/kutipan kandidat tanpa memisahkan apakah klaim tersebut didukung oleh sumber autentik atau hanya berasal dari fixture lokal.

Milestone **RESEARCH-SOURCE-COVERAGE-1** menuntaskan cacat ini dengan memisahkan otoritas ketercakupan secara deterministik, membangun modul HTTP document retriever generik, menerapkan loop riset terarah celah (*gap-directed research*), dan memperketat metrik keberagaman sumber.

---

## 2. Rincian Teknis & Solusi Terapan

### A. Pemisahan Metrik: Raw vs Admissible Coverage
Diperkenalkan pemisahan eksplisit pada [src/lib/editorial/research-questions.ts](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/src/lib/editorial/research-questions.ts):
1. **`raw_research_coverage_ratio` (Observabilitas / Eksplorasi):**
   - Menghitung seluruh kandidat klaim, fixture, dan passages untuk keperluan debug, trace, dan observabilitas.
   - Fixture tetap terlihat di trace dan eksplorasi kandidat, tidak dihapus dari observabilitas.
2. **`admissible_evidence_coverage_ratio` (Otoritas Produksi & Penulisan Joko):**
   - Hanya dihitung dari bukti yang didukung sumber terotentikasi: `source_origin = 'LIVE_RETRIEVAL'` atau `'VERIFIED_CACHED_SNAPSHOT'` dengan status `SOURCE_RETRIEVED_AND_VERIFIED`.
   - **Invarian Nol-Otoritas:** Jika `authentic_source_count === 0`, maka `admissible_evidence_coverage_ratio` **DILARANG melebihi 0**.
   - Pelanggaran terhadap invarian ini langsung menggugurkan paket dengan penolakan eksplisit: **`ADMISSIBLE_COVERAGE_AUTHORITY_MISMATCH`**.
   - Hanya `admissible_evidence_coverage_ratio` yang dapat meloloskan gerbang pra-penulisan (`auditTopicEvidenceAlignment`) yang memberi wewenang eksekusi bagi Joko.

### B. Generic HTTP Document Retriever
Diimplementasikan pada [src/lib/editorial/source-discovery.ts](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/src/lib/editorial/source-discovery.ts):
- Fungsi `fetchHttpDocument(url, options)`:
  - Mengambil dokumen web secara terkendali dengan batasan timeout (15 detik), envelope ukuran maksimal (2 MB), penanganan redirect, dan user-agent bot resmi (`RancangLokaEditorialBot/2.0`).
  - Mendukung ekstraksi teks bersih dari `text/html` (via sanitasi DOM/HTML parser) dan `text/plain`.
  - Untuk konten biner PDF (`application/pdf`), sistem secara jujur mencatat `CONTENT_TYPE_NOT_SUPPORTED` tanpa mengarang atau memalsukan isi teks.
  - Menghasilkan SHA-256 hash, byte length, canonical resolved URL, dan timestamp presisi dengan origin `LIVE_RETRIEVAL`.

### C. Identitas Sumber & Metrik Keberagaman (Source Diversity)
- Fungsi `establishSourceIdentity`:
  - Menetapkan publisher domain, canonical URL, dan kelas sumber (`source_class`).
  - Menolak domain spam SEO, content farms, atau forum sosial terbuka.
- Fungsi `calculateSourceDiversity`:
  - Mengukur `authentic_source_count` (jumlah dokumen unik terotentikasi), `independent_source_count` (jumlah domain publisher independen), dan `source_class_count`.
  - Mendeteksi risiko konsentrasi (`concentration_risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'`).
  - Mencegah labeling "HIGH confidence" jika seluruh klaim artikel kompleks hanya bersandar pada 1 sumber sekunder.

### D. Gap-Directed Research Loop (Loop Riset Terarah)
Diimplementasikan pada [src/lib/editorial/irwan-research-runtime.ts](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/src/lib/editorial/irwan-research-runtime.ts):
- Batasan tegas: `MAX_RESEARCH_PASSES = 2` (mencegah loop tak terhingga).
- Jika pada putaran pertama terdapat kategori penelitian wajib yang belum terpenuhi (misal `DIFFERENTIAL_DIAGNOSIS`, `LIMITATIONS_AND_FALSE_FIXES`, atau `ESCALATION_CONDITIONS`), sistem menghasilkan query lanjutan yang ditargetkan spesifik untuk mengisi peran semantik yang hilang tersebut via `generateQuestionSpecificQueries`.
- Query dibentuk secara murni dinamis berbasis entitas topik tanpa kebocoran kata kunci domain lama.

---

## 3. Hasil Pengujian & Verifikasi

### A. Pengujian Khusus (`scripts/test-research-source-coverage.js`):
1. **Test A:** 0 sumber autentik + klaim fixture $\to$ `admissible_evidence_coverage_ratio = 0` (**PASS**)
2. **Test B:** Fixture mencakup seluruh 6 pertanyaan riset $\to$ gerbang produksi tetap **FAIL** (**PASS**)
3. **Test C:** Passage autentik mencakup 3/6 $\to$ admissible coverage = 0.5 (**PASS**)
4. **Test D:** Passage autentik mencakup 6/6 $\to$ coverage **PASS** (**PASS**)
5. **Test E:** Baris metadata CrossRef tanpa full text $\to$ otoritas bukti 0 (**PASS**)
6. **Test F:** Kandidat HTML yang diunduh langsung $\to$ valid setelah verifikasi provenansi (**PASS**)
7. **Test G:** Kegagalan retrieval HTTP $\to$ tidak melakukan fallback ke fixture (**PASS**)
8. **Test H:** Putaran riset kedua fokus hanya pada kategori yang belum tercakup (**PASS**)
9. **Test I:** Riset mematuhi batas keras `MAX_RESEARCH_PASSES = 2` (**PASS**)
10. **Test J:** Topik baru acak menghasilkan query dinamis tanpa kebocoran kata kunci masa lalu (**PASS**)
11. **Test K:** Satu sumber yang dipakai berulang kali tidak menggelembungkan hitungan sumber autentik (**PASS**)
12. **Test L:** Metrik diversitas membedakan secara presisi antara jumlah dokumen unik dan relasi klaim-sumber (**PASS**)

**Hasil:** **12/12 TESTS PASSED** (0 gagal).

### B. Suite Regresi Lengkap:
- `scripts/test-source-acquisition-authenticity.js`: **10/10 PASS**
- `scripts/test-editorial-grounding-generalization-v2.js`: **12/12 PASS**
- `scripts/test-editorial-evidence-grounding-hardening.js`: **11/11 PASS**
- `scripts/test-joko-prompt-generalization.js`: **6/6 PASS**
- `scripts/test-editorial-provider-resilience.js`: **11/11 PASS**
- `scripts/test-editorial-runtime-4b-stabilize.js`: **11/11 PASS**
- `scripts/test-editorial-runtime-4a-generalization.js`: **12/12 PASS**
- `scripts/test-editorial-runtime-3b-stabilize.js`: **18/18 PASS**
- `scripts/test-editorial-runtime-2.js`: **13/13 PASS**
- `scripts/test-editorial-runtime-1.js`: **18/18 PASS**
- `npx tsc --noEmit`: **0 errors (Kompilasi TypeScript Bersih)**

---

## 4. Keamanan, Integritas Jaringan & Git

- **Jaringan Selama Tes:** 0 panggilan jaringan live. Seluruh panggilan HTTP pada pengujian rekayasa menggunakan mock deterministik (`mockFetch`).
- **Invarian Keselamatan:** `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, `Jefry authority = 0`.
- **Git Commit:** `273265cd7a51e49102b87c28f44cc4b508028975` (`fix(editorial): expand authentic research acquisition coverage`).
- **Artefak Final3:** Disimpan utuh, tidak di-commit sesuai kebijakan milestone rekayasa.
- **Status Akhir:** Berhenti aman pada: **`RESEARCH_SOURCE_COVERAGE_1_HUMAN_REVIEW_REQUIRED`**.
