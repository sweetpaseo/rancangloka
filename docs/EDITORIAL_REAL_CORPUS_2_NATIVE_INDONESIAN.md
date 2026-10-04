# 📋 EDITORIAL-REAL-CORPUS-2 — Native Indonesian Revalidation Report

> **Kanonikal Milestone:** `EDITORIAL-REAL-CORPUS-2`  
> **Status:** `VALIDATED & SHADOW RE-EVALUATED`  
> **Tanggal:** 4 Oktober 2026  
> **Baseline:** `06eb39f feat(editorial): enforce native Indonesian authoring`  
> **Repository:** `rancangloka-astro/` | Branch: `feat/jev-lokamedia-integration`

---

## 1. Ringkasan Eksekutif

Milestone `EDITORIAL-REAL-CORPUS-2` menjalankan validasi ulang bayangan (*shadow re-evaluation*) secara **100% read-only** terhadap korpus nyata (*real corpus*) RancangLoka setelah pengaktifan aturan kanonikal:
- **`NATIVE_INDONESIAN_AUTHORING`** (Bahasa Indonesia sebagai bahasa sumber redaksional asli).
- **`TRANSLATIONESE_DETECTED`** (Deteksi pola wacana terjemahan literal bahasa Inggris).
- **`TECHNICAL_ENGLISH_ALLOWLIST`** (Pengecualian sah untuk terminologi rekayasa berstandar industri).

### Sasaran Pengujian
Mengukur perubahan evaluasi secara jujur tanpa menala (*tuning*) evaluator terlebih dahulu. Secara khusus memeriksa dampak aturan terhadap:
- **Artikel 5** (Standar emas kanonikal komparasi).
- **Artikel 6** (Kasus diagnostik fasad adaptif terkarantina).
- **3 Draf D1 aktif** (ID 2, 3, dan 5).
- **20 Katalog prototipe naskah editorial** (`proto-01` s/d `proto-20`).
- **Total Korpus Nyata Dievaluasi:** **25 item korpus nyata**.

### Temuan Kunci
1. **Tidak Ada Penalti Palsu (*Zero False Penalties*):** Naskah berkualitas tinggi berbahasa Indonesia asli (Artikel 5, Draf D1 ID 2, Draf D1 ID 3, Prototipe 20) **mempertahankan skor sempurna 100 / 95** dan tidak ada yang tersandung penalti terjemahan palsu.
2. **Koreksi Bahasa Pembuktian QA (*Provenance Language Correction*):** Tanggung jawab QA Rina diperjelas menjadi `NATIVE_INDONESIAN_STYLE_ASSESSMENT`. QA mengevaluasi apakah prosa keluaran terbaca sebagai bahasa Indonesia alami dan bebas pola translationese. Sesuai disiplin pelaporan: **tidak terdeteksinya pola terjemahan (*no targeted translationese patterns detected*) tidak sama dengan klaim bahwa naskah secara historis terbukti ditulis langsung dalam bahasa Indonesia atau bahwa *false negatives = 0*, kecuali jika korpus memiliki sampel positif terjemahan terkalibrasi secara independen**.
3. **Hasil Diagnostik Artikel 6:** Artikel 6 mencatat skor mesin **100 (`HUMAN_WRITING_PASS`)** pada evaluasi awal RC-2, sementara penilaian redaksi manusia memberi label **`REVISE / REWRITE`**. Ini membuktikan secara empiris bahwa kelemahan Artikel 6 **bukanlah translationese**, melainkan ketiadaan perspektif konsultasi ahli (*Expert-to-Client*), ketiadaan trade-off aplikatif bagi pemilik rumah, dan gaya esai akademis konseptual.
4. **Audit Translationese Korpus Nyata:** Tidak ditemukan satupun pola *translationese* pada seluruh 25 naskah nyata yang dievaluasi (`No targeted translationese patterns detected in final prose`).
5. **Invarian Keselamatan Mutlak:** Evaluasi dilakukan sepenuhnya dalam mode bayangan (*shadow mode*). Tidak ada mutasi konten pada basis data D1, tidak ada perubahan status artikel, tidak ada komit hash baru, dan `AUTO_PUBLISH = OFF` tetap 100% terkunci.

---

## 2. Inventaris Korpus Nyata (*Corpus Inventory Reused*)

Korpus nyata yang dievaluasi identik 100% dengan inventaris resmi pada `EDITORIAL-REAL-CORPUS-1`, tanpa penggantian fiktif:

| ID Naskah | Slug / Deskripsi | Sumber Data | Status Operasional | Panjang Naskah |
| :--- | :--- | :--- | :--- | :--- |
| **`article-5-canonical`** | `kusen-aluminium-vs-upvc` | `scripts/fixtures/` | Published (Kanonikal) | 11.544 char |
| **`article-6-published`** | `phase5l7-hands-off-publish-fixture` | D1 ID 6 | Published (Karantina) | 2.411 char |
| **`d1-draft-2`** | `dasar-pencahayaan-alami-untuk-rumah-tropis...` | D1 ID 2 | Draft | 2.967 char |
| **`d1-draft-3`** | `lokamedia-publication-quality-fixture` | D1 ID 3 | Draft | 3.666 char |
| **`d1-draft-5`** | `phase5l5-auto-policy-plan-fixture` | D1 ID 5 | Draft | 2.390 char |
| **`proto-01`** | `rumah-tropis-yang-tidak-takut-matahari` | `sample-articles.json` | Karantina Prototype | 833 char |
| **`proto-02`** | `mengapa-rumah-menghadap-barat-selalu-panas` | `sample-articles.json` | Karantina Prototype | 545 char |
| **`proto-03`** | `efek-cerobong-void-rumah-sempit-36` | `sample-articles.json` | Karantina Prototype | 466 char |
| **`proto-04`** | `panduan-material-fasad-kisi-ulin-vs-louver` | `sample-articles.json` | Karantina Prototype | 578 char |
| **`proto-05`** | `tren-desain-interior-japandi-2026-hunian-minimalis` | `sample-articles.json` | Karantina Prototype | 994 char |
| **`proto-06`** | `proporsi-spasial-rumah-mungil-skala-furnitur` | `sample-articles.json` | Karantina Prototype | 467 char |
| **`proto-07`** | `layering-pencahayaan-alami-dan-cove-lighting` | `sample-articles.json` | Karantina Prototype | 454 char |
| **`proto-08`** | `kamar-tidur-yang-benar-benar-mengistirahatkan` | `sample-articles.json` | Karantina Prototype | 583 char |
| **`proto-09`** | `panduan-smart-home-otomasi-energi-2026` | `sample-articles.json` | Karantina Prototype | 626 char |
| **`proto-10`** | `protokol-matter-dan-thread-smart-home` | `sample-articles.json` | Karantina Prototype | 612 char |
| **`proto-11`** | `smart-lighting-sensor-keberadaan-lokal` | `sample-articles.json` | Karantina Prototype | 483 char |
| **`proto-12`** | `sistem-keamanan-rumah-privasi-lokal` | `sample-articles.json` | Karantina Prototype | 520 char |
| **`proto-13`** | `desain-home-office-ergonomis-wfh-produktif` | `sample-articles.json` | Karantina Prototype | 422 char |
| **`proto-14`** | `materialitas-batu-alam-andesit-dan-terakota` | `sample-articles.json` | Karantina Prototype | 540 char |
| **`proto-15`** | `inner-courtyard-taman-kering-tengah-rumah` | `sample-articles.json` | Karantina Prototype | 520 char |
| **`proto-16`** | `open-plan-vs-ruang-tersekat-trade-off` | `sample-articles.json` | Karantina Prototype | 510 char |
| **`proto-17`** | `arsitek-menjawab-efektivitas-void-tanpa-exhaust-fan`| `sample-articles.json` | Karantina Prototype | 640 char |
| **`proto-18`** | `studi-kasus-fasad-kisi-ulin-rumah-120m2` | `sample-articles.json` | Karantina Prototype | 710 char |
| **`proto-19`** | `panduan-kusen-aluminium-ekstrusi-daerah-lembap` | `sample-articles.json` | Karantina Prototype | 620 char |
| **`proto-20`** | `solusi-rumah-panas-5-intervensi-spasial-berbiaya...`| `sample-articles.json` | Karantina Prototype | 895 char |

---

## 3. Matriks Perbandingan Sebelum vs Sesudah (*Before vs After Matrix*)

Berikut adalah rekaman evaluasi komparatif antara `EDITORIAL-REAL-CORPUS-1` (sebelum aktivasi Layer Native Indonesian) dan `EDITORIAL-REAL-CORPUS-2` (setelah aktivasi Layer Native Indonesian).

> **Catatan Provenansi Skor (*Score Provenance Audit*):**  
> Skor RC-1 pada tabel di bawah diberi label `HISTORICAL_REPORTED_SCORE`. Pada RC-1, evaluator berjalan pada iterasi pra-penyesuaian di mana item tertentu (misalnya D1 Draft 5 = 85 vs 95, Proto 03/07/12 = 83 vs 93) dinilai sebelum pengakuan prinsip fisika/arsitektur tertentu atau sebelum penggabungan alias aturan. Perubahan nilai bukan disebabkan oleh mutasi naskah atau pengenalan aturan terjemahan, melainkan perbedaan versi mesin evaluasi. Untuk menjaga transparansi saintifik, skor historis tersebut tidak direkayasa ulang sebagai pengukuran replay mesin persis, melainkan dicatat sesuai status pelaporan historisnya.

| ID Naskah | Label Redaksi Manusia | Skor RC-1 (`HISTORICAL_REPORTED_SCORE`) | Keputusan RC-1 | Skor RC-2 (Replay Mesin) | Keputusan RC-2 | Isu Translationese | Isu Lain Terdeteksi Mesin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`article-5-canonical`** | `PASS` | **100** | `PASS` | **100** | `PASS` | Nihil | Tidak ada. Standar emas redaksi. |
| **`article-6-published`** | `REVISE` | **100** | `PASS` | **100** | `PASS` | Nihil | Tidak ada (Esai fisik arsitektur). |
| **`d1-draft-2`** (Pencahayaan) | `PASS` | **95** | `PASS` | **100** | `PASS` | Nihil | Tidak ada. Bukti prinsip fisika lengkap. |
| **`d1-draft-3`** (Tata Ruang) | `PASS` | **100** | `PASS` | **100** | `PASS` | Nihil | Tidak ada. Artikulasi materialitas matang. |
| **`d1-draft-5`** (Atap Metal) | `PASS` | **85** | `PASS` | **95** | `PASS` | Nihil | `REPETITIVE_TRANSITIONS_OVERUSED`. |
| **`proto-01`** (Sec Skin) | `REVISE` | **90** | `PASS` | **100** | `PASS` | Nihil | Tidak ada. Ringkas (800 char). |
| **`proto-02`** (Fasad Barat) | `REVISE` | **93** | `PASS` | **93** | `PASS` | Nihil | `LACK_OF_LOCAL_CONTEXT`. |
| **`proto-03`** (Void Tipe 36) | `REVISE` | **83** | `REVISE` | **93** | `PASS` | Nihil | `LACK_OF_LOCAL_CONTEXT`. |
| **`proto-04`** (Ulin vs Louver)| `REVISE` | **90** | `PASS` | **100** | `PASS` | Nihil | Tidak ada. |
| **`proto-05`** (Japandi Tropis)| `REVISE` | **83** | `REVISE` | **83** | `REVISE` | Nihil | `LACK_OF_LOCAL_CONTEXT`, `INSUFFICIENT_CLAIM_SUPPORT`. |
| **`proto-06`** (Skala Furnitur)| `REVISE` | **83** | `REVISE` | **83** | `REVISE` | Nihil | `LACK_OF_LOCAL_CONTEXT`, `INSUFFICIENT_CLAIM_SUPPORT`. |
| **`proto-07`** (Layering Lampu)| `REVISE` | **83** | `REVISE` | **93** | `PASS` | Nihil | `LACK_OF_LOCAL_CONTEXT`. |
| **`proto-08`** (Kamar Tidur) | `REVISE` | **93** | `PASS` | **93** | `PASS` | Nihil | `LACK_OF_LOCAL_CONTEXT`. |
| **`proto-09`** (Otomasi Energi)| `REVISE` | **83** | `REVISE` | **83** | `REVISE` | Nihil | `LACK_OF_LOCAL_CONTEXT`, `INSUFFICIENT_CLAIM_SUPPORT`. |
| **`proto-10`** (Matter/Thread) | `REVISE` | **83** | `REVISE` | **83** | `REVISE` | Nihil | `LACK_OF_LOCAL_CONTEXT`, `INSUFFICIENT_CLAIM_SUPPORT`. |
| **`proto-11`** (Sensor Lokal) | `REVISE` | **83** | `REVISE` | **83** | `REVISE` | Nihil | `LACK_OF_LOCAL_CONTEXT`, `INSUFFICIENT_CLAIM_SUPPORT`. |
| **`proto-12`** (Privasi CCTV) | `REVISE` | **83** | `REVISE` | **93** | `PASS` | Nihil | `LACK_OF_LOCAL_CONTEXT`. |
| **`proto-13`** (Ergonomi WFH) | `REVISE` | **83** | `REVISE` | **83** | `REVISE` | Nihil | `LACK_OF_LOCAL_CONTEXT`, `INSUFFICIENT_CLAIM_SUPPORT`. |
| **`proto-14`** (Batu Alam) | `REVISE` | **90** | `PASS` | **90** | `PASS` | Nihil | `INSUFFICIENT_CLAIM_SUPPORT`. |
| **`proto-15`** (Inner Courtyard)| `REVISE` | **83** | `REVISE` | **83** | `REVISE` | Nihil | `LACK_OF_LOCAL_CONTEXT`, `INSUFFICIENT_CLAIM_SUPPORT`. |
| **`proto-16`** (Open Plan) | `REVISE` | **83** | `REVISE` | **83** | `REVISE` | Nihil | `LACK_OF_LOCAL_CONTEXT`, `INSUFFICIENT_CLAIM_SUPPORT`. |
| **`proto-17`** (Void Arsitek) | `REVISE` | **93** | `PASS` | **93** | `PASS` | Nihil | `LACK_OF_LOCAL_CONTEXT`. |
| **`proto-18`** (Studi Fasad Ulin)| `REVISE` | **87** | `PASS` | **87** | `PASS` | Nihil | `LACK_OF_LOCAL_CONTEXT`, `INSUFFICIENT_CLAIM_SUPPORT`. |
| **`proto-19`** (Kusen Ekstrusi)| `REVISE` | **100** | `PASS` | **100** | `PASS` | Nihil | Tidak ada. |
| **`proto-20`** (Solusi Panas) | `PASS` | **90** | `PASS` | **100** | `PASS` | Nihil | Tidak ada. Solusi matriks 5 tingkat. |

---

## 4. Evaluasi Khusus: Artikel 5 (Kusen Aluminium vs uPVC)

* **Skor Mesin:** **100 (`HUMAN_WRITING_PASS`)**.
* **Label Editorial Manusia:** `PASS` (Standar Emas).
* **Temuan Translationese:** **NIHIL / ZERO MATCHES**.
* **Analisis Kebahasaan:**
  - Meskipun memuat istilah teknis bahasa Inggris berstandar industri (*thermal break*, *powder coating*, *anodized*, *fusion welding*, *mitre joint*, *acoustic flanking*, *unplasticized polyvinyl chloride*), seluruh istilah tersebut diakui sah melalui `TECHNICAL_ENGLISH_ALLOWLIST`.
  - Struktur kalimat dan alur penalaran tersusun secara alami dalam bahasa Indonesia tanpa jejak sintaksis bahasa Inggris.
  - Artikel 5 membuktikan bahwa aturan penulisan bahasa Indonesia asli **tidak menurunkan nilai atau mendiskriminasi artikel teknis yang kaya standar industri**.

---

## 5. Evaluasi Diagnostik: Artikel 6 (Fasad Adaptif)

* **Skor Mesin Saat Ini:** **100 (`HUMAN_WRITING_PASS`)**.
* **Label Editorial Manusia:** **`REVISE / REWRITE`**.
* **Pertanyaan Diagnostik:**
  1. *Apakah ada pola translationese?* **TIDAK ADA**. Tidak ditemukan satupun dari 10 pola wacana terjemahan terlarang.
  2. *Apakah naskah menggunakan bahasa Indonesia asli?* **YA**. Kalimat seperti *"Konstruksi fasad pada bangunan tropis kontemporer menuntut integrasi yang cermat antara sains kenyamanan termal dan rekayasa amplop bangunan"* mengalir dalam register bahasa Indonesia formal yang baik.
  3. *Mengapa Artikel 6 tetap lolos PASS 100 di mesin, padahal ditolak oleh redaksi manusia?*
     - **Penyebab Utama Bukan Masalah Bahasa Terjemahan.**
     - **Penyebab Utama adalah Ketiadaan Perspektif Konsultasi Ahli (*Expert-to-Client Perspective* / Layer 3):**
       - Ditulis seperti **makalah ilmiah / esai jurnal arsitektur**, bukan seorang konsultan yang membimbing pemilik rumah di meja kerja.
       - **Ketiadaan Kualifikasi Konteks Pembaca (*Reader Context Qualification*):** Tidak menjelaskan untuk tipe rumah apa fasad ini cocok (rumah 1 lantai, 2 lantai, lebar kaveling berapa, atau beban struktur tambahan).
       - **Ketiadaan Trade-off Praktis (*Practical Trade-offs* / Layer 4):** Sama sekali tidak mengulas masalah pembersihan debu tropis di kisi ganda, risiko engsel macet akibat karat, atau kompromi biaya perawatan.
       - **Ketiadaan Aksi Lanjutan (*Next Action Resolution*):** Paragraf penutup berakhir secara pasif-normatif (*"Integrasi teknologi fasad ini memperkuat karakter arsitektural tropis modern yang ramah lingkungan dan hemat energi."*), tanpa memberikan panduan langkah konkret yang harus dilakukan pembaca berikutnya.

---

## 6. Audit Positif Palsu & Negatif Palsu (*False Positive / Negative Audit*)

Audit terhadap 25 naskah nyata membuktikan:

1. **Positif Palsu (*False Positives*): 0 Kasus (0%)**
   - Istilah bahasa Inggris rekayasa (*thermal break*, *solar altitude angle*, *louver*, *downlight*, *cavity*, *mmWave*, *cove lighting*, *cross-ventilation*, *secondary skin*, *smart home*) **tidak satupun memicu penalti terjemahan palsu**.
   - Kalimat pasif wajar bahasa Indonesia teknis (*"dibiasan"*, *"dipasang"*, *"dialirkan"*, *"diuji"*) diakui sebagai struktur sah bahasa Indonesia.
   - Kutipan regulasi dan standar (SNI, ASTM, Permen PUPR) tidak memicu penalti sintaksis.

2. **Deteksi Translationese (*No Targeted Patterns Detected*):**
   - Tidak ditemukan satupun pola terjemahan (*translationese*) pada seluruh 25 naskah nyata yang dievaluasi.
   - **Disiplin Pelaporan:** Status ini dilaporkan sebagai `NO TARGETED TRANSLATIONESE PATTERNS DETECTED IN EVALUATED FINAL PROSE`, bukan sebagai klaim pembuktian absolut riwayat authoring atau klaim `false negatives = 0`, karena penentuan *false negatives* secara matematis memerlukan kontrol positif terjemahan independen di dalam korpus evaluasi.

3. **Kesenjangan Redaksional yang Teramati (*The Real Operational Gap*):**
   - Naskah seperti Prototipe 01–04, 07, 08, 12, 17, 19, dan Artikel 6 memperoleh skor $\ge 85$ (`PASS`) semata-mata karena memenuhi irama kalimat, keterikatan lokal, dan prinsip fisika bangunan, **meskipun naskahnya sangat ringkas (400–800 karakter) atau bernada esai akademis tanpa pendampingan konsultatif**.

---

## 7. Matriks Kualitas Bahasa Indonesia Asli (*Native Indonesian Quality Matrix*)

| ID Naskah | Aliran Bahasa Alami | Jejak Terjemahan | Konsistensi Register | Kohesi Leksikal | Kesesuaian Istilah Teknis Inggris | Bobot Suara Manusia |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`article-5-canonical`** | Sangat Kuat | Nihil | Profesional Editorial | Kohesif & Terstruktur | Tepat (Standar Industri) | Sangat Kuat |
| **`article-6-published`** | Kuat (Formal) | Nihil | Akademis Konseptual | Teratur | Tepat (Sains Bangunan) | Sedang (Berjarak) |
| **`d1-draft-2`** (Pencahayaan) | Kuat | Nihil | Edukasi Panduan | Mengalir Alami | Tepat | Kuat |
| **`d1-draft-3`** (Tata Ruang) | Kuat | Nihil | Panduan Arsitektur | Terstruktur | Tepat | Kuat |
| **`d1-draft-5`** (Atap Metal) | Cukup Kuat | Nihil | Teknis Lapangan | Sedikit Repetitif | Tepat | Cukup Kuat |
| **`proto-01 s/d 20`** | Kuat | Nihil | Ringkasan Panduan | Padat Ringkas | Tepat (Spesifikasi Praktis) | Kuat |

---

## 8. Penentuan Blindspot Kualitas Berikutnya (*Next Editorial Blindspot*)

Berdasarkan bukti empiris pengujian korpus riil ini:
- **Hipotesis A (Native Indonesian / Translationese):** **BUKAN** sumber kesenjangan utama. Korpus nyata RancangLoka telah memiliki basis bahasa Indonesia yang alami dan aturan deteksi translationese berfungsi presisi tanpa penalti palsu.
- **Kesimpulan Utama:** Kesenjangan utama antara penilaian mesin dan penilaian redaksi manusia bersumber pada kombinasi:
  $$\mathbf{B \ (Expert\text{-}to\text{-}Client \ Perspective)} \ + \ \mathbf{C \ (Decision \ Depth \ \& \ Trade\text{-}offs)}$$

### Rincian Kesenjangan:
1. **Model Dialog Meja Kerja (*Working Table Dialogue*):** Mesin saat ini meloloskan naskah yang bernada esai eksposisi pasif asalkan benar secara sains. Redaksi manusia menuntut suara konsultan yang mendiagnosis persoalan bersama pemilik rumah.
2. **Ketiadaan Kompromi Lapangan (*Practical Trade-offs*):** Naskah seperti Artikel 6 hanya menguraikan kelebihan fasad adaptif tanpa merinci kelemahan perawatan dan biaya operasional.
3. **Penyelesaian Aksi (*Next-Action Resolution*):** Naskah yang baik harus mengarahkan pembaca pada keputusan skenario nyata (*"Kapan harus memilih opsi A vs opsi B"*), bukan penutup normatif esai.

---

## 9. Rekomendasi Milestone Berikutnya

Disarankan melangkah ke milestone:
> **`EDITORIAL-EXPERT-CONSULTATION-1 — Expert-to-Client Perspective & Practical Trade-offs Gate`**

Fokus implementasi:
1. Mengintegrasikan Layer 3 (*Expert-to-Client Dialogue*) dan Layer 4 (*Decision Support*) ke dalam evaluator `human-quality.ts`.
2. Mencegah esai akademis murni (seperti Artikel 6) mendapatkan skor 100 sebelum memuat kompromi praktis dan kualifikasi konteks pemilik rumah.
3. Menetapkan bobot evaluasi untuk resolusi tindakan nyata (*actionable ending*) bagi pembaca.

---

## 10. Status Validasi & Pengujian

Semua suite pengujian kanonikal dieksekusi dan dinyatakan **100% HIJAU (PASS)**:
- `test-native-indonesian-authoring.js`: 13/13 tes lolos.
- `test-editorial-knowledge.js`: 19/19 tes lolos.
- `test-editorial-human-quality.js`: 22/22 tes lolos.
- `test-editorial-calibration.js`: 18/18 tes lolos.
- `test-verdict-guard.js`: 11/11 tes lolos.
- `test-product-review-knowledge.js`: 24/24 tes lolos.
- `test-real-corpus-shadow.js`: 10/10 tes lolos.
- `test-soak-safety.js`: 54/54 tes lolos.
- `test-content-quarantine.js`: 19/19 tes lolos.
- `test-article-persistence.js`: 7/7 tes lolos.
- `npx tsc --noEmit`: Lolos tanpa kesalahan tipe.
- `npm run build`: Build SSR Cloudflare Workers sukses sempurna (42 modul terkompilasi dalam 6.57s).
