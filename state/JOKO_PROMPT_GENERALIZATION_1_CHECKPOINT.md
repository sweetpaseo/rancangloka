# 📋 RancangLoka — Checkpoint JOKO-PROMPT-GENERALIZATION-1
## Removal of Legacy Topic Semantics from Writer Prompt & Deterministic Pre-Provider Prompt Audit

> **Checkpoint ID:** `JOKO-PROMPT-GENERALIZATION-1-CHECKPOINT-20261005`  
> **Timestamp:** `2026-10-05T16:42:00+07:00`  
> **Branch:** `feat/jev-lokamedia-integration`  
> **Baseline Commit:** `5615c98` (`fix(editorial): generalize Joko writer prompt`)  
> **Milestones Covered:** `JOKO-PROMPT-GENERALIZATION-1`  
> **Classification:** **`JOKO_PROMPT_GENERALIZATION_1_PASS`**  
> **Stop Gate:** **`JOKO_PROMPT_GENERALIZATION_1_HUMAN_REVIEW_REQUIRED`**  
> **Safety State:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, `Jefry execution authority = 0`

---

## 1. Ringkasan Eksekutif

Pada pengujian pembuktian akhir `EDITORIAL-RUNTIME-4B FINAL CLEAN PROOF`, seluruh gerbang hulu (Dynamic Visitor Pain, Dynamic Research Questions, Riset Irwan Autentik, Alignment Gate, Coverage Gate, Integrity Gate, dan Provider LLM `gpt-5.6-luna`) berhasil lolos dengan sukses. Joko berhasil memproduksi draf substantif 10.813 karakter asli Bahasa Indonesia.

Namun, naskah terhenti secara deterministik di **Grounding Gate** (`RUNTIME4B_FINAL_GROUNDING_BLOCKED`) karena Joko mendeklarasikan 3 `unsupported_claim_candidates` di dalam amplop JSON (terkait insulasi foil dan ventilasi atap). Audit mendalam membuktikan bahwa Joko tergiring membahas konsep di luar topik dinding lembap akibat instruksi statis dan contoh pembuka hardcoded di [joko-prompt-builder.ts](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/src/lib/editorial/joko-prompt-builder.ts) yang masih mewarisi semantik artikel atap metal terdahulu.

Milestone **JOKO-PROMPT-GENERALIZATION-1** menuntaskan masalah ini secara mikro dan presisi tanpa menyentuh arsitektur riset Irwan, aturan ketercakupan bukti, maupun gerbang QA Rina.

---

## 2. Rincian Teknis & Solusi Terapan

### A. Pembersihan Semantik Atap Metal dari Prompt Statis
1. Menghapus seluruh asumsi dan contoh hardcoded atap metal dari instruksi sistem generic, panduan struktur artikel 6 poin, dan template opening:
   - Dihilangkan: `insulasi foil`, `aluminium foil`, `ventilasi atap`, `ventilasi loteng`, `radiant barrier`, `atap metal`, `rongga atap`, `kontraktor menyarankan foil/ventilasi`, `karat atap`, `kondensasi atap`.
2. Memperbaiki pemformatan `CANONICAL_TERMINOLOGY_MAP` agar menyusun pasangan istilah kanonikal tanpa menghasilkan residu string `[object Object]`.
3. Mengganti injeksi deskripsi dimensi masalah yang memuat contoh dalam kurung (`painDef.description`) dengan label murni domain-neutral (`painDef.label`) agar tidak membocorkan istilah komparasi atap.

### B. Generalisasi Panduan Pembuka (Human Context & Opening Angle)
- Mengimplementasikan `buildDynamicOpeningGuidance()`:
  - Instruksi pembuka dibentuk secara dinamis murni dari: topik aktif, `primaryContextId`, `openingAngle`, dan `preferredSignature`.
  - Pada `DECISION_FORK`: alih-alih mendikte skenario foil vs ventilasi atap, instruksi secara dinamis memandu Joko memulai dari dua pilihan nyata yang sedang dipertimbangkan pemilik rumah pada topik aktif, lalu menjelaskan mengapa diagnosis fisik dibutuhkan sebelum memilih solusi.

### C. Generalisasi Rekomendasi Benturan Tukang (CONTRACTOR_CONFLICT)
- Mengimplementasikan `deriveCompetingOptionsFromTopicOrContext()`:
  - Rekomendasi yang saling bertentangan diturunkan secara dinamis dari konteks aktif atau topik:
    - *Topik dinding lembap:* pelapisan cat waterproofing vs perbaikan sumber air lembap.
    - *Topik kusen jendela:* kusen aluminium vs kusen uPVC.
    - *Topik atap:* insulasi foil vs ventilasi atap.
  - Untuk topik di luar ketiga contoh tersebut, fallback menggunakan bahasa netral murni tanpa asumsi domain: *"Rekomendasi A vs Rekomendasi B yang berlawanan pada topik ini"*.

### D. Audit Deterministik Kebocoran Semantik Prompt (`auditPromptSemanticLeaks`)
- Menambahkan fungsi deterministik `auditPromptSemanticLeaks(compiledPrompt, context)`:
  - Mendaftar istilah domain teknis sensitif (`SUSPICIOUS_STATIC_DOMAIN_TERMS`).
  - Mengisolasi seluruh input aktif (topik, judul, konteks pengunjung, author safe claims, inventaris klaim, dan passages bukti).
  - Jika suatu istilah domain teknis sensitif muncul di instruksi sistem statis, struktur statis, atau teks prompt Joko tanpa hadir di input aktif, audit gagal dengan kode: **`WRITER_PROMPT_DOMAIN_LEAK`**.
- Mengintegrasikan audit ini sebagai gerbang **Langkah 4b** pada `executeEditorialDraftJob` di [editorial-runtime.ts](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/src/lib/editorial/editorial-runtime.ts) sebelum pemanggilan LLM provider.

### E. Validitas Topik Atap Metal Tetap Terjaga
- Untuk topik atap metal yang sesungguhnya dengan bukti riset atap metal, istilah `foil`, `ventilasi atap`, dan `radiant barrier` tetap diizinkan dan lolos audit secara wajar karena istilah tersebut berasal dari input aktif (topik dan bukti), bukan dari teks instruksi statis yang dipaksakan.

---

## 3. Hasil Pengujian & Verifikasi

### A. Pengujian Khusus (`scripts/test-joko-prompt-generalization.js`):
- **Test 1 (Damp-Wall Topic):** Zero roof concepts inherited in compiled prompt -> `PASS`
- **Test 2 (Window Topic):** Zero damp-wall or roof concepts in static instructions -> `PASS`
- **Test 3 (Metal-Roof Topic Validity):** Roof vocabulary allowed when present in active evidence -> `PASS`
- **Test 4 (Adversarial Static Injection):** Injected roof terms into static instructions triggers `WRITER_PROMPT_DOMAIN_LEAK` -> `PASS`
- **Test 5 (Dynamic Contractor Conflict):** Derived dynamically per topic -> `PASS`
- **Test 6 (Canonical Invariants):** Master editorial guidelines & non-slop contracts intact -> `PASS`
- **Hasil:** **6/6 PASS**.

### B. Suite Regresi Penuh:
1. `node scripts/test-editorial-provider-resilience.js` -> **11/11 PASS**
2. `node scripts/test-editorial-runtime-4b-stabilize.js` -> **11/11 PASS**
3. `node scripts/test-editorial-runtime-4a-generalization.js` -> **12/12 PASS**
4. `node scripts/test-editorial-runtime-3b-stabilize.js` -> **18/18 PASS**
5. `node scripts/test-editorial-runtime-2.js` -> **13/13 PASS**
6. `node scripts/test-editorial-runtime-1.js` -> **18/18 PASS**
7. `npx tsc --noEmit` -> **0 ERRORS (Clean)**

---

## 4. Git & Audit Log

- **Commit SHA:** `5615c98`
- **Commit Message:** `fix(editorial): generalize Joko writer prompt`
- **File Dimodifikasi:**
  - `src/lib/editorial/joko-prompt-builder.ts`
  - `src/lib/editorial/editorial-runtime.ts`
  - `scripts/test-joko-prompt-generalization.js` (baru)
- **Status Working Tree:** Bersih (`git status --short` kosong).

---

## 5. Gerbang Berhenti (Stop Gate)

Sesuai instruksi keselamatan, eksekusi Runtime-4B **TIDAK** dijalankan ulang pada milestone ini.

**Status Akhir:**
`JOKO_PROMPT_GENERALIZATION_1_HUMAN_REVIEW_REQUIRED`
