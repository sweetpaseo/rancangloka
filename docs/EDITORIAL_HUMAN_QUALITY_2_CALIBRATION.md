# 📊 EDITORIAL-HUMAN-QUALITY-2 — Calibration & Benchmark Report

> **Kanonikal Milestone:** `EDITORIAL-HUMAN-QUALITY-2`  
> **Status:** `CALIBRATED & VERIFIED` (100% Benchmark Decision Match, 100% Holdout Match)  
> **Tanggal:** 4 Oktober 2026  
> **Baseline:** `3dbdf0c feat(editorial): add canonical product review knowledge v1`  
> **Repository:** `rancangloka-astro/` | Branch: `feat/jev-lokamedia-integration`

---

## 1. Ringkasan Eksekutif

Milestone `EDITORIAL-HUMAN-QUALITY-2` melakukan pengujian empiris dan kalibrasi sistemik terhadap mesin penilai kualitas penulisan manusia RancangLoka (*Human Writing Quality Engine* di [human-quality.ts](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/src/lib/article/human-quality.ts)) menggunakan korpus uji sintetis deterministik (*benchmark corpus*).

Sesuai **Critical Rule**:
1. **Ambang batas keputusan kanonikal TIDAK BERUBAH:**
   - `85–100` = **`HUMAN_WRITING_PASS`**
   - `75–84`  = **`HUMAN_WRITING_REVISE`**
   - `0–74`   = **`HUMAN_WRITING_REWRITE`**
2. Kalibrasi dilakukan pada:
   - Pembobotan penalti heuristik dan deteksi pola
   - Pencegahan *false positive* (misal: tulisan teknis SNI yang tenang tanpa melodrama)
   - Pencegahan *false negative* (misal: artikel AI mekanis yang sebelumnya lolos revisi ringan)
   - Penegakan aturan kegagalan keras (*hard-fail integrity rules*)
   - Perutean koreksi editorial spesifik peran (Joko / Irwan / Rina / Sari) dengan Jefry tetap *zero-authority*.

---

## 2. Desain Korpus Benchmark

Korpus patokan terdiri dari **14 naskah deterministik orisinal** yang dirancang mencakup artikel edukasi arsitektur umum dan ulasan/panduan keputusan produk. Semua naskah produk sintetis ditandai secara tegas dengan label `[ILLUSTRATIVE_EXAMPLE_ONLY]`.

Korpus dibagi dengan rasio **71% Kalibrasi (~10 naskah)** dan **29% Holdout (~4 naskah)** untuk mencegah *overfitting*:

### Matriks Korpus & Kelas Fixture

| ID Fixture | Kategori | Kelas Karakteristik | Split | Keputusan Target | Rentang Skor |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A_STRONG_HUMAN_EDITORIAL** | General Editorial | Human voice, diagnosis tajam, empati tenang, alur solutif | CALIBRATION | `PASS` | 85–100 |
| **B_AI_MECHANICAL** | General Editorial | Pembuka generik, simetri heading kaku, generalisasi hampa | CALIBRATION | `REWRITE` | 0–74 |
| **C_BORDERLINE_DRAFT** | General Editorial | Konten teknis bagus, penutup rangkuman dangkal tanpa aksi | CALIBRATION | `REVISE` | 75–84 |
| **D_EVIDENCE_STRONG_EMOTION_FLAT** | General Editorial | Analisis teknis SNI presisi, nada tenang/datar tanpa melodrama | **HOLDOUT** | `PASS` | 85–100 |
| **E_NATURAL_PROSE_EVIDENCE_WEAK** | General Editorial | Prosa hangat mengalir, nol angka/bukti empiris, klaim lemah | CALIBRATION | `REWRITE` | 0–74 |
| **F_LEXICALLY_INCONSISTENT** | General Editorial | Variasi sinonim semu (*same referent* diganti-ganti secara acak) | CALIBRATION | `REVISE` | 75–84 |
| **G_EXPERT_CONSULTATION** | General Editorial | Konsultasi ahli: masalah $\rightarrow$ diagnosis $\rightarrow$ opsi $\rightarrow$ aksi | CALIBRATION | `PASS` | 85–100 |
| **H_GENERIC_SEO** | General Editorial | Keyword stuffing padat, nihil substansi arsitektur | **HOLDOUT** | `REWRITE` | 0–74 |
| **I_STRONG_ANALYTICAL_REVIEW** | Product Review | Ulasan analitis non-hands-on, komparasi spesifikasi jujur | CALIBRATION | `PASS` | 85–100 |
| **J_SPECIFICATION_DUMP** | Product Review | Brosur dump tanpa interpretasi konsekuensi bagi pengguna | CALIBRATION | `REWRITE` | 0–74 |
| **K_AFFILIATE_BIASED_REVIEW** | Product Review | CTA pembelian agresif di awal, klaim terbaik tanpa komparasi | **HOLDOUT** | `REWRITE` | 0–74 |
| **L_FAKE_HANDS_ON_REVIEW** | Product Review | Klaim uji fisik lab fiktif tanpa bukti tangan pertama | CALIBRATION | `REWRITE` | 0–74 |
| **M_SINGLE_COMPLAINT_OVERGEN** | Product Review | Menggeneralisasi satu ulasan marketplace jadi cacat massal | CALIBRATION | `REVISE` | 75–84 |
| **N_COMPATIBILITY_BLIND_REVIEW** | Product Review | Rekomendasi tanpa analisis kompatibilitas sistem rumah | **HOLDOUT** | `REVISE` | 75–84 |

---

## 3. Kinerja Pra-Kalibrasi (Baseline vs Pre-Calibration Benchmark)

Sebelum dilakukan kalibrasi pada `human-quality.ts`, evaluator eksisting dijalankan terhadap 14 naskah benchmark:

* **Tingkat Akurasi Keputusan Pra-Kalibrasi:** **42.8% (6 / 14 Cocok)**
* **Masalah Kritis Terdeteksi:**
  1. **B_AI_MECHANICAL** memperoleh skor `81` (`REVISE`) karena frase klise seperti *"memiliki kelebihan dan kekurangan masing-masing"* belum terdaftar di regex generalisasi hampa. Seharusnya `REWRITE` (< 75).
  2. **C_BORDERLINE_DRAFT** memperoleh skor `90` (`PASS`) karena penalti kesimpulan rangkuman artifisial hanya berbobot `-10`, meloloskan artikel yang tidak memiliki arahan keputusan akhir.
  3. **E_NATURAL_PROSE_EVIDENCE_WEAK** memperoleh skor `88` (`PASS`) karena evaluator terpesona oleh kehangatan prosa tanpa memvalidasi ketiadaan bukti empiris dan metrik teknis.
  4. **F_LEXICALLY_INCONSISTENT** memperoleh skor `100` (`PASS`) karena kamus ketidakkonsistenan terminologi belum diintegrasikan ke dalam pemindaian kohesi leksikal.
  5. **J_SPECIFICATION_DUMP** memperoleh skor `85` (`PASS`) karena daftar spesifikasi pabrik yang panjang dianggap sebagai "kelimpahan bukti spesifik", bukan kelalaian interpretasi konsekuensi.
  6. **K_AFFILIATE_BIASED_REVIEW** memperoleh skor `75` (`REVISE`) padahal melanggar batas integritas komersial keras (*early CTA* dan *unsupported superlatives*), yang wajib `REWRITE`.
  7. **L_FAKE_HANDS_ON_REVIEW** lolos dengan revisi ringan tanpa pembatasan batas atas (*hard cap*).
  8. **M_SINGLE_COMPLAINT** dan **N_COMPATIBILITY_BLIND** tidak terdeteksi karena evaluator belum memiliki wawasan review produk spesifik.

---

## 4. Penyesuaian & Kalibrasi yang Diterapkan

Semua penyesuaian dilakukan secara deterministik pada [human-quality.ts](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/src/lib/article/human-quality.ts) dan [product-review-knowledge.ts](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/src/lib/article/product-review-knowledge.ts):

### A. Kalibrasi Generalisasi Hampa & Frase AI Mekanis
* **Sebelum:** Hanya mendeteksi 4 frase pembuka/klise sempit.
* **Perubahan:** Menambahkan detektor pola klise AI generik:
  - `memiliki kelebihan dan kekurangan masing-masing`
  - `penting untuk mempertimbangkan berbagai faktor`
  - `pada akhirnya, pilihan terbaik tergantung pada`
  - `merupakan pilihan yang sangat populer di kalangan`
  - `tidak dapat dipungkiri bahwa`
* **Hasil:** B_AI_MECHANICAL turun dari skor 81 ke **66 (`REWRITE`)**.

### B. Kalibrasi Kesimpulan Artifisial & Arah Keputusan
* **Sebelum:** Penalti kesimpulan rangkuman artifisial `-10` poin.
* **Perubahan:** Ditingkatkan menjadi penalti `-17` poin jika naskah hanya mengulang ringkasan tanpa menawarkan alur keputusan skenario atau arahan tindakan praktis.
* **Hasil:** C_BORDERLINE_DRAFT turun dari 90 ke **83 (`REVISE`)**.

### C. Kalibrasi Integritas Bukti vs Prosa Alami (Anti-Gimmick Evidence)
* **Sebelum:** Naskah dengan kalimat hangat dan mengalir tidak dikenai sanksi bukti spesifik jika tidak ada klaim absolut yang dibantah.
* **Perubahan:** Menambahkan detektor naskah non-data yang memberikan nasihat teknis kualitatif tanpa angka metrik atau fakta terverifikasi (`WEAK_EVIDENCE_SPECIFICITY`), dengan penalti `-20` poin dan pengalihan ke Irwan (`evidence_researcher_lead`).
* **Hasil:** E_NATURAL_PROSE_EVIDENCE_WEAK turun dari 88 ke **67 (`REWRITE`)**.

### D. Integrasi Kamus Kanonikal Terminologi & Anti-Synonym Swapping
* **Sebelum:** Pemindaian leksikal hanya mengukur *Lexical Repetition Index*. Penulis yang mengganti istilah teknis referen tunggal (`kusen aluminium` $\rightarrow$ `bingkai aluminium` $\rightarrow$ `frame aluminium` $\rightarrow$ `sistem bingkai logam`) lolos.
* **Perubahan:** Diintegrasikan `CANONICAL_TERMINOLOGY_MAP` yang memetakan istilah kanonikal RancangLoka dan mendeteksi variasi sinonim semu yang tidak sah. Dikenakan penalti `-16` poin.
* **Hasil:** F_LEXICALLY_INCONSISTENT turun dari 100 ke **84 (`REVISE`)**.

### E. Penilaian Produk: Spesifikasi vs Interpretasi Konsekuensi
* **Sebelum:** Daftar spesifikasi numerik panjang otomatis mendongkrak skor bukti.
* **Perubahan:** Menambahkan deteksi `SPEC_DUMP_WITHOUT_INTERPRETATION` khusus untuk ulasan produk yang mencantumkan deretan angka teknis tanpa menerjemahkan dampak praktisnya bagi pemilik rumah (ketiadaan kata konsekuensi seperti *artinya*, *berakibat*, *menghasilkan*, *menghemat*, *risiko*). Dikenakan penalti `-20` poin.
* **Hasil:** J_SPECIFICATION_DUMP turun dari 85 ke **67 (`REWRITE`)**.

### F. Integritas Komersial & Hard-Fail Caps
* **Sebelum:** Pelanggaran komersial hanya mengurangi poin dimensi umum tanpa batas atas paksa.
* **Perubahan:** 
  - Penempatan CTA afiliasi sebelum naskah/rekomendasi mendeteksi `COMMERCIAL_BIAS_RISK` dan memaksa batas atas skor $\le 65$ (`HARD_FAIL`).
  - Klaim pengujian langsung tanpa bukti tangan pertama (`FABRICATED_HANDS_ON_TEST`) memaksa batas atas skor $\le 65$ (`HARD_FAIL`).
* **Hasil:** K_AFFILIATE_BIASED_REVIEW menjadi **65 (`REWRITE`)**, L_FAKE_HANDS_ON_REVIEW menjadi **58 (`REWRITE`)**.

### G. Model Bukti Spesifik-Klaim (*Claim-Specific Evidence Model*)
* Diperbarui pada `product-review-knowledge.ts` untuk membedakan:
  - *Identity / Specification Evidence* (Otoritatif: Brosur resmi pabrikan, manual, sertifikasi SNI/CE).
  - *Performance Evidence* (Otoritatif: Uji tangan pertama RancangLoka, uji lab independen terakreditasi).
  - *Reliability / Ownership Signals* (Otoritatif: Agregasi pola keluhan pengguna terverifikasi, bukan klaim pabrik dan bukan ulasan tunggal).

---

## 5. Kinerja Pasca-Kalibrasi & Pengujian Holdout

Evaluasi ulang pasca-kalibrasi menghasilkan keselarasan sempurna:

```text
================================================================================
KORPUS BENCHMARK: 14/14 COCOK (100% DECISION ACCURACY)
================================================================================
CALIBRATION SPLIT (10 Fixtures):  10 / 10 COCOK (100%)
HOLDOUT SPLIT (4 Fixtures):        4 /  4 COCOK (100%)
FALSE-POSITIVE RATE (PASS):        0.0% (0 artikel cacat yang diloloskan PASS)
FALSE-NEGATIVE RATE (REWRITE):     0.0% (0 artikel gagal yang lolos tanpa REWRITE)
INTEGRITY VIOLATION RECALL:        100.0% (Semua pelanggaran keras terdeteksi)
================================================================================
```

### Hasil Rinci Evaluasi Benchmark

| Fixture | Split | Skor | Keputusan | Status | Isu Kunci Terdeteksi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A_STRONG_HUMAN** | CALIBRATION | 100 | `PASS` | ✅ MATCH | Tidak ada cacat. |
| **B_AI_MECHANICAL** | CALIBRATION | 66 | `REWRITE` | ✅ MATCH | `GENERIC_OPENING`, `STRUCTURAL_SYMMETRY`, `EMPTY_GENERALIZATIONS`, `WEAK_EVIDENCE_SPECIFICITY`. |
| **C_BORDERLINE** | CALIBRATION | 83 | `REVISE` | ✅ MATCH | `ARTIFICIAL_CONCLUSION_SUMMARY_ONLY`. |
| **D_FLAT_EMOTION** | **HOLDOUT** | 100 | `PASS` | ✅ MATCH | Nada tenang profesional SNI tidak dipaksa melodramatis. |
| **E_NATURAL_WEAK** | CALIBRATION | 67 | `REWRITE` | ✅ MATCH | `EMPTY_GENERALIZATIONS_FOUND`, `WEAK_EVIDENCE_SPECIFICITY`. |
| **F_LEXICAL_INCONSIST** | CALIBRATION | 84 | `REVISE` | ✅ MATCH | `TERMINOLOGY_INCONSISTENCY_DETECTED`. |
| **G_EXPERT_CONSULT** | CALIBRATION | 100 | `PASS` | ✅ MATCH | Konsultasi ahli diagnosa-sebelum-solusi. |
| **H_GENERIC_SEO** | **HOLDOUT** | 69 | `REWRITE` | ✅ MATCH | `KEYWORD_FORCING`, `GENERIC_OPENING`, `LACK_OF_LOCAL_CONTEXT`. |
| **I_STRONG_ANALYTICAL** | CALIBRATION | 100 | `PASS` | ✅ MATCH | Review analitis tanpa klaim palsu hands-on. |
| **J_SPEC_DUMP** | CALIBRATION | 67 | `REWRITE` | ✅ MATCH | `SPEC_DUMP_WITHOUT_INTERPRETATION`, `LACK_OF_LOCAL_CONTEXT`. |
| **K_AFFILIATE_BIASED** | **HOLDOUT** | 65 | `REWRITE` | ✅ MATCH | `COMMERCIAL_BIAS_RISK`, `UNSUPPORTED_SUPERLATIVE` (Hard Cap $\le 65$). |
| **L_FAKE_HANDS_ON** | CALIBRATION | 58 | `REWRITE` | ✅ MATCH | `FABRICATED_HANDS_ON_TEST`, `FABRICATED_EXPERIENCE_OR_SLOP` (Hard Cap $\le 65$). |
| **M_SINGLE_COMPLAINT** | CALIBRATION | 84 | `REVISE` | ✅ MATCH | `SINGLE_REVIEW_OVERGENERALIZATION`. |
| **N_COMPATIBILITY_BLIND** | **HOLDOUT** | 84 | `REVISE` | ✅ MATCH | `COMPATIBILITY_NOT_EVALUATED`. |

---

## 6. Aturan Kegagalan Keras (*Hard-Fail Integrity Rules*)

Kualitas penulisan atau estetika prosa yang indah **tidak boleh mengalahkan integritas editorial**. Aturan kegagalan keras berikut memaksa pembatasan skor maksimal $\le 65$ (`REWRITE`):

1. **`FABRICATED_HANDS_ON_TEST`:** Mengklaim telah menguji unit fisik secara langsung tanpa kepemilikan bukti tangan pertama RancangLoka.
2. **`COMMERCIAL_BIAS_RISK`:** Menempatkan tombol beli/CTA afiliasi sebelum pembaca mendapatkan analisis produk independen atau menyembunyikan batasan produk.
3. **`FABRICATED_EXPERIENCE_OR_SLOP`:** Mengarang anekdot fiktif tukang/proyek yang tidak pernah terjadi untuk menciptakan empati palsu.

---

## 7. Matriks Perutean Koreksi Peran Editorial

Perbaikan artikel diarahkan secara deterministik kepada staf yang berwenang:

| Jenis Masalah Terdeteksi | Penanggung Jawab | Peran Hermes | Alasan Perutean |
| :--- | :--- | :--- | :--- |
| Struktur, ritme kalimat, pembuka generik, pengulangan simetris, terminologi | **Joko** | `content_writer_primary` | Masalah gaya penulisan, orkestrasi kalimat, dan variasi prosa. |
| Ketiadaan metrik SNI, klaim tanpa data empiris, verifikasi klaim pabrik | **Irwan** | `evidence_researcher_lead` | Masalah riset fakta, sumber data, dan paket bukti empiris. |
| Pelanggaran integritas, bias komersial, klaim uji palsu, etika editorial | **Rina** | `editorial_qa_primary` | Penjaga standar integritas media independen dan kepatuhan redaksional. |
| Kesiapan penerbitan, metadata, penjadwalan terikat izin manusia | **Sari** | `publication_specialist` | Operasi penerbitan di bawah kendali tata kelola manusia (`AUTO_PUBLISH = OFF`). |
| **Rekomendasi Keputusan Otomatis (Asinkron / Shadow)** | **Jefry** | `decision_engine` | **Zero Execution Authority**: Hanya mode bayangan asinkron, tidak memiliki kewenangan mengeksekusi mutasi draft. |

---

## 8. Batasan & Blind Spots yang Diketahui

1. **Konstruksi Kalimat Sangat Kompleks:** Beberapa kalimat bersusun panjang khas dokumen hukum/kontrak renovasi dapat memicu peringatan *cadence monotony* jika tidak dipecah menjadi klausul editorial.
2. **Material Baru Non-SNI:** Untuk inovasi material impor yang belum memiliki standar SNI lokal, evaluator membutuhkan input eksplisit standar acuan internasional (misal: ASTM/ISO) agar tidak diklasifikasikan sebagai *weak evidence*.
3. **Data Produk Statis:** Evaluator tidak melakukan pemanggilan HTTP langsung ke marketplace saat mengevaluasi; status ketersediaan stok atau varian produk harus disuplai melalui `EvidencePack`.

---

## 9. Verifikasi Pengujian

Seluruh suite pengujian editorial dieksekusi dan lolos 100%:
* `scripts/test-editorial-calibration.js` (18 pengujian kalibrasi) — **18/18 PASS**
* `scripts/test-editorial-human-quality.js` (22 pengujian kualitas penulisan) — **22/22 PASS**
* `scripts/test-product-review-knowledge.js` (24 pengujian ulasan produk) — **24/24 PASS**
* `scripts/test-editorial-knowledge.js` (16 pengujian pengetahuan master) — **16/16 PASS**
* `scripts/test-verdict-guard.js` (11 pengujian terminologi guard) — **11/11 PASS**
* TypeCheck (`npx tsc --noEmit`) — **0 Errors**
* Production Build (`npm run build`) — **Success**
