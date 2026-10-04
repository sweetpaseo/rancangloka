# 📋 EDITORIAL-EXPERT-CONSULTATION-1 — Expert-to-Client Perspective & Practical Decision Depth Report

> **Kanonikal Milestone:** `EDITORIAL-EXPERT-CONSULTATION-1`  
> **Status:** `IMPLEMENTED & VALIDATED`  
> **Tanggal:** 4 Oktober 2026  
> **Baseline:** `92836f2 test(editorial): revalidate real corpus with native Indonesian rules`  
> **Repository:** `rancangloka-astro/` | Branch: `feat/jev-lokamedia-integration`

---

## 1. Ringkasan Eksekutif

Milestone `EDITORIAL-EXPERT-CONSULTATION-1` menghubungkan pilar kanonikal:
- **Layer 3 — Expert Consultation** (Perspektif dialog konsultan senior ke klien pemilik rumah)
- **Layer 4 — Decision Support** (Kedalaman pengambilan keputusan, trade-off berimbang, dan langkah aksi konkret)

ke dalam mesin evaluasi penjamin mutu kepenulisan manusia (`human-quality.ts`).

### Masalah Utama yang Diselesaikan:
Sebelumnya, mesin evaluator mengalami celah diagnostik (*diagnostic blindspot*) pada **Artikel 6**: naskah tersebut kredibel secara teknis, menggunakan bahasa Indonesia alami, dan memiliki prinsip fisika yang benar, tetapi:
- Lemah dalam perspektif klien (*weak client perspective*).
- Ketiadaan kualifikasi konteks pembaca (*weak context qualification*).
- Ketiadaan kompromi praktis dan trade-off perawatan (*weak practical trade-offs*).
- Berakhir sebagai esai akademis pasif tanpa panduan tindakan lanjutan bagi pemilik rumah (*weak next action resolution*).

Dengan model intent-aware dan gerbang kedalaman keputusan ini, Artikel 6 secara deterministik terdeteksi memiliki isu `ACADEMIC_DISTANCE_EXCESSIVE` dan turun dari status kelulusan palsu (*false PASS* 100) ke tier **`HUMAN_WRITING_REVISE` (Skor 84)**, selaras dengan penilaian dewan redaksi manusia. Sementara itu, **Artikel 5 kanonikal tetap terlindungi 100 (`PASS`)**.

---

## 2. Model Klasifikasi Maksud Artikel (*Article Intent Model*)

Menghindari kesalahan memaksakan kedalaman keputusan yang seragam untuk semua tipe artikel, RancangLoka menetapkan klasifikasi intent artikel deterministik:

1. **`EXPLANATORY`:**
   - **Tujuan Utama:** Menjelaskan konsep, prinsip rekayasa, atau fenomena fisika bangunan.
   - **Ekspektasi:** Relevansi konsekuensi praktis bagi pemilik rumah, tidak bernada esai akademis berjarak. Tidak wajib memiliki pemenang komparasi.
2. **`PROBLEM_SOLVING`:**
   - **Tujuan Utama:** Mendiagnosis dan menyelesaikan masalah nyata pemilik rumah (panas, bocor, rembes, lembap).
   - **Ekspektasi:** Bingkai masalah pembaca jelas, diagnosis akar penyebab sebelum preskripsi solusi, dan panduan aksi lanjutan.
3. **`COMPARISON`:**
   - **Tujuan Utama:** Membantu pemilik rumah memilih di antara alternatif material atau sistem.
   - **Ekspektasi:** Membeberkan trade-off secara transparan, percabangan skenario ("jika X maka A, jika Y maka B"), menolak rekomendasi universal tanpa konteks, dan panduan aksi verifikasi.
4. **`PRODUCT_REVIEW`:**
   - **Tujuan Utama:** Mengevaluasi kesesuaian produk spesifik (mewarisi Product Review Knowledge).
   - **Ekspektasi:** Evaluasi kompatibilitas instalasi fisik, batasan pemakaian, dan rekomendasi berbasis skenario.
5. **`INSTALLATION_HOW_TO`:**
   - **Tujuan Utama:** Membimbing tindakan pemasangan atau perbaikan secara aman dan presisi.
   - **Ekspektasi:** Urutan tindakan, prasyarat alat, dan langkah verifikasi akhir.

---

## 3. Gerbang Konsultasi Ahli & Dukungan Keputusan (Section 17)

Penambahan kode temuan kualitas terstruktur (*structured quality findings*):

| Kode Isu | Kategori | Tingkat Keparahan | Penalti | Penjelasan Redaksional |
| :--- | :--- | :---: | :---: | :--- |
| **`READER_PROBLEM_UNCLEAR`** | `EXPERT_CONSULTATION_GAP` | WARNING | -8 | Pembuka artikel tidak membingkai masalah atau dilema nyata pemilik rumah secara jelas. |
| **`DIAGNOSIS_MISSING`** | `EXPERT_CONSULTATION_GAP` | WARNING | -10 | Artikel langsung meresepkan produk/tindakan tanpa mendiagnosis gejala dan akar penyebab fisik. |
| **`TRADE_OFFS_INCOMPLETE`** | `DECISION_SUPPORT_GAP` | CRITICAL | -16 | Artikel komparasi tidak membeberkan trade-off kompromi material bagi pemilik rumah. |
| **`SCENARIO_FIT_MISSING`** | `DECISION_SUPPORT_GAP` | WARNING | -10 | Rekomendasi bersifat mutlak tanpa percabangan skenario (kondisi jika X maka A, jika Y maka B). |
| **`NEXT_ACTION_MISSING`** | `DECISION_SUPPORT_GAP` | WARNING | -10 | Penutup tidak memberikan panduan langkah konkret (apa yang harus diinspeksi, diukur, atau diverifikasi). |
| **`ACADEMIC_DISTANCE_EXCESSIVE`** | `ACADEMIC_DISTANCE` | WARNING | -16 | Esai akademis yang berjarak dari pemilik rumah (nihil relevansi hunian, ketiadaan trade-off, tanpa aksi). |
| **`SCOPE_DEPTH_MISMATCH`** | `CONTENT_DEPTH_MISMATCH` | WARNING | -7 | Cakupan topik luas dibahas terlalu singkat (< 120 kata), menyisakan kesenjangan kedalaman keputusan. |

---

## 4. Evaluasi Artikel 5 vs Artikel 6

| Parameter Evaluasi | Artikel 5 (Kusen Aluminium vs uPVC) | Artikel 6 (Fasad Adaptif & Termal) |
| :--- | :---: | :---: |
| **Intent Terdeteksi** | `COMPARISON` | `EXPLANATORY` |
| **Skor Mesin Baru** | **100 (`HUMAN_WRITING_PASS`)** | **84 (`HUMAN_WRITING_REVISE`)** |
| **Label Redaksi Manusia** | `PASS` (Standar Emas) | `REVISE` (Esai berjarak) |
| **Status Keselarasan** | ✅ **100% MATCH** | ✅ **100% MATCH (Solved Blindspot)** |
| **Trade-offs Terurai** | Lengkap (modulus elastisitas, muai panjang, debu, seal perimeter) | Nihil (hanya memaparkan keunggulan teoritis) |
| **Kualifikasi Konteks** | Lengkap (kamar tidur, bentang lebar, ruang ber-AC, pesisir) | Nihil (hanya "bangunan tropis kontemporer") |
| **Resolusi Aksi** | Panduan pemilihan zona dan rujukan SNI/ASTM/ISO | Pasif normatif tanpa langkah aksi pemilik rumah |
| **Isu Terdeteksi** | Nihil | `ACADEMIC_DISTANCE_EXCESSIVE` |
| **Peran Penugasan Revisi** | - | **Joko** (`content_writer_primary`) |

---

## 5. Hasil Revalidasi Korpus Nyata (25 Naskah)

| Kelompok Naskah | Jumlah Item | Keputusan Mesin | Keselarasan dengan Redaksi Manusia |
| :--- | :---: | :---: | :--- |
| **Kanonikal Terbitan (Artikel 5)** | 1 | `PASS` (100) | 100% Match (Standar Emas). |
| **Karantina Terbitan (Artikel 6)** | 1 | `REVISE` (84) | 100% Match (Terdorong dari False Pass 100 ke REVISE 84). |
| **Draf Aktif D1 (ID 2, 3, 5)** | 3 | ID 2: `PASS` (100)<br>ID 3: `PASS` (100)<br>ID 5: `REWRITE` (73) | Match (D1 Draft 5 terdeteksi belum memiliki trade-off komparasi & transisi repetitif). |
| **Katalog Prototipe (`proto-01..20`)** | 20 | `PASS`: 8 item<br>`REVISE`: 8 item<br>`REWRITE`: 4 item | Draf prototipe ringkas yang minim trade-off kini tidak lagi meluncur bebas ke PASS 100. |
| **Total Korpus** | **25 Item** | **Terdiferensiasi Nyata** | Distribusi nilai sehat (60, 62, 64, 66, 73, 78, 79, 83, 84, 87, 90, 93, 100). |

---

## 6. Distribusi Penugasan Peran Redaksional (*Role Routing*)

Brief penulisan ulang terstruktur (`rewrite_brief`) mengarahkan isu ke pemilik yang sah:
- **Joko (`content_writer_primary`):**  
  Menangani masalah bingkai pembaca (`READER_PROBLEM_UNCLEAR`), ketiadaan trade-off (`TRADE_OFFS_INCOMPLETE`), percabangan skenario (`SCENARIO_FIT_MISSING`), panduan aksi lanjutan (`NEXT_ACTION_MISSING`), jarak akademis (`ACADEMIC_DISTANCE_EXCESSIVE`), dan penyesuaian kedalaman cakupan (`SCOPE_DEPTH_MISMATCH`).
- **Irwan (`evidence_researcher_lead`):**  
  Menangani ketiadaan dukungan bukti murni (`INSUFFICIENT_CLAIM_SUPPORT`, `WEAK_EVIDENCE_SPECIFICITY`) tanpa cacat gaya bahasa.
- **Rina (`editorial_qa_primary`):**  
  Menangani pelanggaran integritas keras (`FABRICATED_EXPERIENCE`, `COMMERCIAL_BIAS_RISK`, `FABRICATED_HANDS_ON_TEST`).
- **Sari (`publication_dispatcher_core`):**  
  Menerima naskah hanya jika telah lulus gerbang kepenulisan manusia (`status = HUMAN_WRITING_PASS`).
- **Jefry (`management_advisor_jefry`):**  
  Pengamat bayangan / advisory only. Otoritas eksekusi dan publikasi tetap 0 (nol).

---

## 7. Status Pengujian & Validasi

Suite pengujian dieksekusi dan dinyatakan **100% HIJAU (PASS)**:
- `test-expert-consultation.js`: 13/13 tes lolos (100%).
- `test-native-indonesian-authoring.js`: 13/13 tes lolos.
- `test-editorial-knowledge.js`: 19/19 tes lolos.
- `test-editorial-human-quality.js`: 22/22 tes lolos.
- `test-editorial-calibration.js`: 18/18 tes lolos.
- `test-verdict-guard.js`: 11/11 tes lolos.
- `test-product-review-knowledge.js`: 24/24 tes lolos.
- `test-real-corpus-shadow.js`: 10/10 tes lolos.
- `test-soak-safety.js`: 54/54 tes lolos.
- `test-publication-planner.js`: 67/67 tes lolos.
- `test-publication-publisher.js`: 48/48 tes lolos.
- `test-content-quarantine.js`: 19/19 tes lolos.
- `test-article-persistence.js`: 7/7 tes lolos.
- `npx tsc --noEmit`: Sukses tanpa kesalahan tipe.
- `npm run build`: Sukses (Astro Cloudflare SSR bundle 42 modul terkompilasi dalam 6.49s).
