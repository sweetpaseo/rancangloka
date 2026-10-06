# 📋 RancangLoka — Checkpoint EVIDENCE-QUALITY-FORENSIC-1 & ASSERTION-ACCOUNTABILITY-1
## Forensic Audit of Final Clean Proof #5: Source Relevance, Domain Authority, Claim Entailment & Assertion Accountability

> **Checkpoint ID:** `EVIDENCE-QUALITY-FORENSIC-1-CHECKPOINT-20261006`  
> **Timestamp:** `2026-10-06T08:45:00+07:00`  
> **Branch:** `feat/jev-lokamedia-integration`  
> **Baseline Commit:** `ffafb13` (`fix(editorial): reconcile post-draft assertion accountability`)  
> **Milestones Covered:** `ASSERTION-ACCOUNTABILITY-1`, `EVIDENCE-QUALITY-FORENSIC-1`  
> **Forensic Classification:** **`MULTIPLE_EVIDENCE_QUALITY_DEFECTS`**  
> **Stop Gate:** **`EVIDENCE_QUALITY_FORENSIC_1_HUMAN_REVIEW_REQUIRED`**  
> **Safety State:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, `Jefry execution authority = 0`

---

## 1. Ringkasan Eksekutif & Konteks

Setelah keberhasilan eksekusi kanonikal **EDITORIAL FINAL CLEAN PROOF #5** yang membuktikan integritas akuisisi langsung (*live HTTP acquisition*) dan penolakan aman (*fail-closed enforcement*) pada `ARTICLE_ASSERTION_UNACCOUNTED`, dilakukan dua tahapan tindak lanjut yang kritis:

1. **ASSERTION-ACCOUNTABILITY-1 (`ffafb13`)**: Rekonsiliasi akuntabilitas asersi pasca-draf yang memverifikasi mengapa Joko menghasilkan 66 span proposisi dengan hanya 6 deklarasi klaim, serta isolasi regresi pada runtime penelitian Irwan (`hasExplicitMocks` guard).
2. **EVIDENCE-QUALITY-FORENSIC-1 (Audit Forensik Kualitas Bukti)**: Audit forensik menyeluruh tanpa mutasi kode, tanpa panggilan jaringan/LLM, menggunakan artefak beku Final5 untuk memverifikasi apakah sumber yang diakuisisi secara autentik juga relevan secara semantik, berkategori otoritas yang tepat, dan mampu menjawab pertanyaan riset kanonikal.

---

## 2. Hasil Audit Forensik EVIDENCE-QUALITY-FORENSIC-1

### A. Klasifikasi Sumber & Cacat Otoritas
Dari 6 sumber terakuisisi live:
- **`The Conversation`** diklasifikasikan sebagai `INDUSTRY_REFERENCE` padahal secara substansi adalah `GENERAL_EDITORIAL_MEDIA` (jurnalisme sains populer).
- **Domain `.ac.id`** (Univ. Selamat Sri, Univ. Sriwijaya) secara otomatis dinaikkan ke `OFFICIAL_INSTITUTIONAL_GUIDANCE` oleh aturan heuristik, padahal merupakan jurnal OJS lokal dan studi kasus pengabdian masyarakat (`SCHOLARLY_JOURNAL_ARTICLE`), bukan standar institusional resmi.
- **Temuan:** Ditemukan **`SOURCE_CLASSIFICATION_DEFECT`**.

### B. Relevansi Topik Dokumen (*Topic Relevance*)
Topik naskah adalah: *"Jendela Aluminium Sering Berembun di Pagi Hari: Masalah Kusen, Kaca, Ventilasi, atau Kelembapan Ruangan?"*
- `HIGHLY_RELEVANT`: **0 / 6**
- `PARTIALLY_RELEVANT`: **1 / 6** (Univ. Selamat Sri — Kusen aluminium di Batang, fokus pada anti-rayap dan keawetan, tanpa fisika embun/kondensasi).
- `INCIDENTALLY_RELEVANT`: **1 / 6** (Yayasan Bima Berilmu — Buka jendela pagi hari untuk pencegahan Tuberkulosis).
- `IRRELEVANT`: **4 / 6** (The Conversation: olahraga pagi vs sore; Univ. Wiraraja: sistem pemilu proporsional terbuka + spam judi slot OJS; CV Jendela Edukasi: sarapan pagi siswa SD Jember; Univ. Sriwijaya: latihan fisik pagi vs malam pesilat).
- **Akar Masalah Penemuan:** Kebocoran leksikal (*lexical keyword leakage*) pada query CrossRef BM25 yang mencocokkan kata-kata terisolasi (`"pagi hari"`, `"mekanisme"`, `"jendela"`, `"fisik"`).

### C. Relevansi Passage & Entailment Klaim
- Dari 111 kutipan (*passages*):
  - `DIRECTLY_RELEVANT`: **0**
  - `SUPPORTING_BACKGROUND`: **2** (1,8%)
  - `WEAKLY_RELATED`: **9** (8,1%)
  - `OFF_TOPIC`: **100** (90,1%) (termasuk 9 komentar spam judi slot).
- Dari 112 klaim inventaris:
  - `DIRECTLY_ENTAILED` ke teks sumber: 104 (namun memuat proposisi non-topik seperti pemilu, gizi sarapan, latihan silat).
  - `OVERSTATED`: 7 (header navigasi/boilerplate yang dijadikan konsensus teknis berstatus `UNIVERSAL_PHYSICS`).
  - `NOT_SUPPORTED`: 1 (`CLM-112`, sintesis profil kusen dan akustik yang diatribusikan secara keliru ke artikel olahraga The Conversation).

### D. Audit Author-Safe 112/112
- Status 112/112 klaim aman authoring pada Final5 merupakan **false positive** karena gerbang hanya memvalidasi hash kriptografis dan ketiadaan harga nominal (*Monetary Silence*), tanpa filter relevansi semantik topik maupun kualifikasi domain.

### E. Ketercakupan Pertanyaan Riset (Research Coverage Quality)
- Ketercakupan 6/6 (100%) yang dilaporkan pada Final5 terjadi semata-mata karena seluruh 111 klaim secara default diberi peran `MATERIAL_BEHAVIOR` sehingga memenuhi ekspektasi peran secara sintaksis.
- Evaluasi substantif: **0 / 6 kategori terpenuhi** (`NOT_COVERED`). Tidak ada prinsip fisika sains bangunan (*building science*), titik embun (*dew point*), pemutus termal (*thermal break*), atau diferensiasi diagnostik yang terakuisisi.

### F. Keragaman Sumber Riil
- `actual_independent_evidence_streams`: **1** (Univ. Selamat Sri).
- `actual_concentration_risk`: **CRITICAL / EXTREME** (ketergantungan 100% pada satu makalah studi kasus lokal non-kondensasi).

---

## 3. Audit Cakupan Commit ffafb13 (ASSERTION-ACCOUNTABILITY-1)

Commit `ffafb13` pada `src/lib/editorial/irwan-research-runtime.ts`:
- Menambahkan penjaga `!hasExplicitMocks` pada baris 385 dan 401 agar kandidat fallback sintetis tidak mengotori eksekusi pengujian yang menyediakan fungsi mock eksplisit.
- Memperketat perutean kandidat pada baris 429 (`cand_open_${openDocId}`).
- **Klasifikasi:** **`ASSERTION_MILESTONE_SCOPE_CLEAN`**. Tidak ada perubahan logika produksi yang tidak terkait.

---

## 4. Klasifikasi Akhir & Rekomendasi Langkah Lanjutan

- **Klasifikasi Forensik Primer:** **`MULTIPLE_EVIDENCE_QUALITY_DEFECTS`**
  (Menggabungkan `SOURCE_RELEVANCE_DEFECT`, `SOURCE_CLASSIFICATION_DEFECT`, `CLAIM_ENTAILMENT_DEFECT`, dan `RESEARCH_COVERAGE_QUALITY_DEFECT`).
- **Pemberhentian Aman:** **`EVIDENCE_QUALITY_FORENSIC_1_HUMAN_REVIEW_REQUIRED`**.
- **Rekomendasi Arsitektur Selanjutnya (Pasca-Review Manusia):**
  1. Pengetatan query CrossRef/Web dengan frasa wajib (*phrase quote enforcement* / domain boundary gating, misal: `"kondensasi"`, `"embun"`, `"dew point"`, `"thermal break"`).
  2. Filter pra-ekstraksi passage untuk membersihkan boilerplate/navigasi/komentar OJS.
  3. Pemisahan kelas `SCHOLARLY_JOURNAL_ARTICLE` dari `OFFICIAL_INSTITUTIONAL_GUIDANCE` berbasis metadata DOI/ISSN, bukan akhiran domain semata.
  4. Penyempurnaan `AuthorSafeClaimGate` dengan penilaian semantik relevansi terhadap topik artikel sebelum meloloskan klaim ke meja Joko.
