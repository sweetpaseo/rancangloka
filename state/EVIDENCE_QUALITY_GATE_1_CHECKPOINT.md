# 📋 RancangLoka — Checkpoint EVIDENCE-QUALITY-GATE-1
## Semantic Evidence Quality Gate, Multi-Dimensional Filtering & Proposition-Level Research Coverage Validation

> **Checkpoint ID:** `EVIDENCE-QUALITY-GATE-1-CHECKPOINT-20261006`  
> **Timestamp:** `2026-10-06T10:20:00+07:00`  
> **Branch:** `feat/jev-lokamedia-integration`  
> **Baseline Commit:** `ffafb13` (`fix(editorial): reconcile post-draft assertion accountability`)  
> **Milestones Covered:** `EVIDENCE-QUALITY-GATE-1` (Resolving all defects identified in `EVIDENCE-QUALITY-FORENSIC-1`)  
> **Status Classification:** **`EVIDENCE_QUALITY_GATE_1_PASS`**  
> **Stop Gate:** **`EVIDENCE_QUALITY_GATE_1_HUMAN_REVIEW_REQUIRED`**  
> **Safety State:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, `Jefry execution authority = 0`

---

## 1. Ringkasan Eksekutif & Tujuan Milestone

Milestone **EVIDENCE-QUALITY-GATE-1** mengimplementasikan arsitektur penyaringan kualitas bukti deterministik multidimensi untuk menyelesaikan seluruh cacat (*defects*) yang diidentifikasi pada **EVIDENCE-QUALITY-FORENSIC-1** (audit forensik artefak beku Editorial Final Clean Proof #5):

1. **Empat Kualitas Independen untuk Kelayakan Bukti (*Author-Safe Qualification*):**
   - `AUTHENTIC`: Bukti berasal dari dokumen riil terverifikasi dengan checksum dan teks asli yang tersimpan (bukan fixture sintetis/mock).
   - `TOPIC_RELEVANT`: Dokumen memiliki relevansi semantik dengan topik arsitektur/hunian/material (menangkal kebocoran leksikal kata kunci seperti olahraga, pemilu, silat, atau gizi).
   - `CLAIM_RELEVANT`: Kutipan (*passage*) secara langsung atau kontekstual mendukung proposisi klaim (bukan kutipan navigasi, disclaimer, atau komentar).
   - `AUTHORITY_APPROPRIATE`: Peran sumber (*source role*) mencukupi tingkat otoritas yang disyaratkan oleh tipe proposisi (misal: fisika kondensasi menuntut standar teknik atau literatur ilmiah/institusional terpercaya, bukan media opini atau forum).

2. **Purging Boilerplate & Spam:**
   - Pembersihan deterministik terhadap menu OJS, navigasi web, footer, disclaimer hak cipta, dan spam komentar judi online (`slot`, `gacor`, `judi`, `togel`).
   - Penolakan *fail-closed* (`CONTENT_QUALITY_INSUFFICIENT`) apabila rasio konten substantif tidak memadai.

3. **Verifikasi Proposisi Pertanyaan Riset (*Proposition-Level RQ Validation*):**
   - Menghapus ketergantungan pada pencocokan label sintaksis (*semantic_role*).
   - Memvalidasi bahwa setiap dari 6 kategori pertanyaan riset kanonikal (*Problem Solver Framework*) benar-benar dijawab oleh proposisi yang relevan dan memiliki otoritas yang memadai.

---

## 2. Modul & Komponen yang Diimplementasikan

### A. [`src/lib/editorial/evidence-quality-gate.ts`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/src/lib/editorial/evidence-quality-gate.ts)
* **`classifySourceRole(source)`**: 10 peran sumber diskret (`OFFICIAL_GOVERNMENT_GUIDANCE`, `OFFICIAL_INSTITUTIONAL_GUIDANCE`, `SCHOLARLY_RESEARCH`, `SCHOLARLY_JOURNAL_ARTICLE`, `TECHNICAL_STANDARD`, `PROFESSIONAL_TECHNICAL_REFERENCE`, `EXPERT_EDITORIAL_MEDIA`, `MANUFACTURER_TECHNICAL_MATERIAL`, `GENERAL_EDITORIAL_MEDIA`, `OTHER`). Evaluasi berbasis nama penerbit, metadata jurnal OJS, DOI, dan judul (bukan akhiran `.ac.id` semata).
* **`cleanBoilerplateAndSpam(rawText)`**: Deteksi dan eliminasi baris navigasi/footer/menu serta pola spam perjudian/promosi.
* **`DocumentTopicRelevanceEvaluator`**: Pemetaan konsep topik vs leksikal dokumen. Menolak tabrakan leksikal seperti `pagi hari` (olahraga), `mekanisme` (hukum tata negara/pemilu), `jendela` (jurnal pendidikan/gizi anak), dan `silat`. Menetapkan level `HIGHLY_RELEVANT`, `PARTIALLY_RELEVANT`, `INCIDENTALLY_RELEVANT`, `IRRELEVANT`, `UNCERTAIN`.
* **`prioritizeCandidateRelevance(candidates, topicConcepts)`**: Pemeringkatan dan diskualifikasi kandidat dokumen sebelum retrieval.
* **`evaluatePassageRelevance(passage, topicConcepts)`**: Menilai keterkaitan kutipan (`DIRECTLY_RELEVANT`, `SUPPORTING_BACKGROUND`, `WEAKLY_RELATED`, `OFF_TOPIC`, `UNCERTAIN`) mendukung istilah teknis sains bangunan dwibahasa (Indonesia & Inggris).
* **`evaluateAuthoritySufficiency(propositionType, sourceRole)`**: Matriks kecukupan otoritas proposisi (`REGULATORY_REQUIREMENT`, `PHYSICAL_MECHANISM`, `MATERIAL_PERFORMANCE`, `EMPIRICAL_RECOMMENDATION`, `DIAGNOSTIC_GUIDANCE`, `PRACTICAL_BACKGROUND`).
* **`evaluateSynthesizedClaim(claim, parentClaims)`**: Validasi garis keturunan (*provenance lineage*), status parent author-safe, dan pencegahan atribut klaim sintetis tanpa dasar (mencegah cacat `CLM-112`).
* **`evaluateClaimQuality(claim, context)` & `evaluateAuthorSafeEvidenceGate(claims, context)`**: Evaluasi holistik 4 kualitas independen.
* **`evaluateResearchQuestionSupport(rq, claims, passages, sources)`**: Verifikasi substantif ketercakupan 6 kategori pertanyaan riset kanonikal.
* **`validateProblemSolverProductionGate(coverage)`**: Memastikan status produksi `READY_FOR_WRITING` hanya tercapai jika seluruh 6 kategori $\ge$ `ADEQUATELY_COVERED` dan memiliki otoritas mencukupi.
* **`calculateSourceDiversityQuality(sources, eligibleSourceIds)`**: Memisahkan metrik dokumen terakuisisi mentah dengan aliran bukti independen relevan. Menetapkan risiko konsentrasi `CRITICAL` jika aliran relevan $\le 1$.

### B. [`src/lib/editorial/source-discovery.ts`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/src/lib/editorial/source-discovery.ts)
* Integrasi `classifySourceRole()` ke dalam `establishSourceIdentity()` untuk memastikan setiap penemuan sumber langsung memiliki klasifikasi peran otoritas formal.

### C. [`scripts/test-evidence-quality-gate.js`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/scripts/test-evidence-quality-gate.js)
* Suite pengujian deterministik 15 skenario:
  - Skenario 1–3: Pencegahan tabrakan leksikal (olahraga, penerbit jurnal pendidikan, hukum pemilu).
  - Skenario 4: Studi kasus perumahan aluminium Batang dinilai secara presisi sebagai `PARTIALLY_RELEVANT`.
  - Skenario 5–6: Purging boilerplate dan spam komentar.
  - Skenario 7–8: Passage relevan vs off-topic entailment.
  - Skenario 9: Pemblokiran klaim sintetis tanpa pembuktian parent (`CLM-112`).
  - Skenario 10–11: Validasi proposisi pertanyaan riset dan kecukupan otoritas.
  - Skenario 12: Penegakan risiko konsentrasi `CRITICAL` pada domain tidak relevan.
  - Skenario 13–14: Uji invariansi (kebal penggantian ID klaim, topik independen tanpa overfit).
  - Skenario 15: Replay luring beku (*frozen offline replay*) artefak historis Final5.

---

## 3. Hasil Replay Forensik Final5 (Skenario 15)

Evaluasi artefak historis Final5 di bawah gerbang `EVIDENCE-QUALITY-GATE-1`:
- **Dokumen Terakuisisi Live:** 6 dokumen
- **Dokumen Lolos Kualifikasi:** **1 dokumen** (Univ. Selamat Sri, Batang — `PARTIALLY_RELEVANT`)
- **Dokumen Ditolak (Off-Topic / Spam / Incidentil):** **5 dokumen**
- **Aliran Bukti Relevan Independen:** **1**
- **Risiko Konsentrasi Topik:** **CRITICAL** (Tergantung 100% pada satu studi kasus non-kondensasi)
- **Klaim Mentah Historis:** 112 klaim
- **Klaim Lolos Author-Safe:** **10 klaim** (seluruh klaim non-topik dan boilerplate berhasil dieliminasi; `CLM-112` diblokir)
- **Kategori RQ Terjawab:** **2 / 6** (0/6 dengan otoritas fisika sains bangunan yang mencukupi)
- **Status Gerbang Produksi:** **`RESEARCH_COVERAGE_QUALITY_INSUFFICIENT`** (*Fail-closed gate triggered cleanly*)

---

## 4. Hasil Verifikasi Regresi Menyeluruh

Semua pengujian deterministik berjalan 100% PASS dan TypeScript kompilasi bersih (0 error):
1. `node scripts/test-evidence-quality-gate.js` -> **15/15 PASS**
2. `node scripts/test-assertion-accountability.js` -> **12/12 PASS**
3. `node scripts/test-research-acquisition-orchestration.js` -> **12/12 PASS**
4. `node scripts/test-research-source-coverage.js` -> **12/12 PASS**
5. `node scripts/test-source-acquisition-authenticity.js` -> **10/10 PASS**
6. `node scripts/test-editorial-grounding-generalization-v2.js` -> **12/12 PASS**
7. `node scripts/test-editorial-evidence-grounding-hardening.js` -> **11/11 PASS**
8. `node scripts/test-joko-prompt-generalization.js` -> **6/6 PASS**
9. `node scripts/test-editorial-provider-resilience.js` -> **11/11 PASS**
10. `node scripts/test-editorial-runtime-4b-stabilize.js` -> **11/11 PASS**
11. `node scripts/test-editorial-runtime-4a-generalization.js` -> **12/12 PASS**
12. `node scripts/test-editorial-runtime-3b-stabilize.js` -> **18/18 PASS**
13. `node scripts/test-editorial-runtime-2.js` -> **13/13 PASS**
14. `node scripts/test-editorial-runtime-1.js` -> **18/18 PASS**
15. `npx tsc --noEmit` -> **0 Error**

---

## 5. Batasan Operasional & Langkah Selanjutnya

- **Dilarang Menjalankan Final6:** Final6 tidak boleh dijalankan tanpa arahan operator manusia.
- **Kemandirian Bukti:** Untuk pengujian live di masa depan, query penemuan CrossRef/Google Scholar harus menggunakan filter gabungan multi-konsep (*multi-concept compound queries*) agar tidak menjaring dokumen olahraga/hukum/gizi.
- **Status Stop Gate:** Berhenti aman pada **`EVIDENCE_QUALITY_GATE_1_HUMAN_REVIEW_REQUIRED`**.
