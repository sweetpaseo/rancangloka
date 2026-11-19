# 🛡️ RancangLoka Offline Checkpoint: House Identity Lock v1.2 & Visual Continuity QA

**Tanggal / Waktu:** 2026-11-19T11:28:00+07:00  
**Baseline Git HEAD:** `d42222c` on `feat/jev-lokamedia-integration`  
**Status Sesi:** `RANCANGLOKA_HOUSE_IDENTITY_LOCK_V1_2_VERIFIED_SAFE`  
**Target Topik:** **Artikel #10011** (*Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding*)  
**Staging Target:** Cloudflare D1 Staging **Article ID 10** (Status: `DRAFT`, Persetujuan: `PENDING`)  
**Invarian Keselamatan:** `AUTO_PUBLISH = OFF` | `PRODUCTION_AUTHORITY = 0` | `JEV_MODE = shadow` | `Cron = OFF` | `PAID_GENERATION = COMPLETED ($0.0392 pilot, $0.00 new spend)` | `Monetary Silence = 100% MUTLAK`

---

## 1. Analisis Akar Masalah (Root Cause Forensics)

Dari hasil evaluasi pilot nyata Kling Omni (1 Cover + 1 Inline) pada Canary #10011:
1. **Pergeseran Peralatan Tetap (Fixed Appliances Morphing):**
   - **Cover:** Menampilkan kompor tanam datar flush kaca induksi tanpa tungku (`FLAT_GLASS_INDUCTION`), cooker hood slim stainless di bawah kabinet, tata letak dapur berbentuk U kompak.
   - **Inline 1:** Menampilkan kompor gas 2-tungku dengan burner ring dan knob logam menonjol (`GAS_TWO_BURNER`).
   - Walaupun suasana (mood), palet warna kayu jati matte, countertop krem, dan pencahayaan konsisten, pergeseran peralatan tetap merusak ilusi "satu rumah yang sama".
2. **Kelemahan Budi Prompt Engine v1.1:**
   - Prompt inline sebelumnya menggabungkan seluruh deskripsi arsitektur dan perspektif kamera menjadi satu string naratif tanpa pemisahan tegas antara elemen yang *tidak boleh berubah* (immutable) dan elemen yang *boleh berubah* (mutable).
   - Tag referensi `<<<image_1>>>` dikirim tanpa negative prompt spesifik yang melarang kemunculan kompor gas, burner rings, grates, atau knobs ketika dapur awal bertipe induksi.
3. **Kelemahan Quality Gate v1.1 (False Pass Vulnerability):**
   - Gate lama hanya mengandalkan flag boolean `cooktop_type_match: true` dan skor kemiripan material makro tanpa memeriksa tipe peralatan teramati secara spesifik.
   - Audit sebelumnya meloloskan pasangan gambar tersebut dengan skor 96/100 (`RECOMMENDED_FOR_OWNER`).

---

## 2. Solusi Teknis & Arsitektur v1.2

### A. Cover-Driven House Lock (`house-identity.ts`)
- Fungsi `lockHouseIdentityFromCover(initialProfile, coverLock)`:
  - Mengambil realitas visual dari citra Cover yang diterima Owner sebagai *ground truth anchor*.
  - Mengunci topologi dapur: `observed_kitchen_topology: 'U_SHAPE'`, dengan catatan divergensi eksplisit (`topology_divergence_from_initial: true`).
  - Mengunci peralatan tetap:
    * Kompor: `FLAT_GLASS_INDUCTION` (tanpa tungku, tombol sentuh flush, permukaan kaca hitam).
    * Cooker hood: `SLIM_STAINLESS_UNDER_CABINET`.
  - Mengunci material kabinet: HPL jati muda matte di bawah, rak putih di atas.
  - Memperbarui versi profil ke `HOUSE_IDENTITY_V1.2`.

### B. Revised Budi Prompt Engine (`buildStructuredInlinePrompt`)
- Membagi prompt menjadi partisi yang strictly terisolasi:
  - **IMMUTABLE ARCHITECTURE & EQUIPMENT:**
    `<<<image_1>>> EXACT MATCH: Maintain the exact same kitchen architecture and fixed equipment from <<<image_1>>>. U-shaped compact kitchen topology. Cooktop must strictly remain flat black induction cooktop flush with countertop (no gas burners, no grates, no burner rings). Slim stainless under-cabinet cooker hood...`
  - **MUTABLE PERSPECTIVE & SCENE CONDITIONS:**
    Sudut kamera spesifik (wide / 45-degree angle / close-up), jarak bidik, pencahayaan alami/buatan, aktivitas masak realistis, panci stainless steel di atas kompor.
  - **DETERMINISTIC NEGATIVE PROMPT:**
    Secara otomatis menginjeksi larangan kompor gas, burner ring, grate, knob, api terbuka, dan perubahan denah jika kompor anchor adalah induksi.

### C. Nadia Visual Continuity Gate v1.2 (`photo-quality-gate.ts`)
- Menerapkan 9 gerbang deterministik terpisah:
  1. `photo_realism`: Menolak render 3D artifisial, diagram teks, atau vector art.
  2. `fixed_appliance_consistency`: Memeriksa tipe kompor dan hood teramati vs yang terkunci. Mismatch $\rightarrow$ `FAIL` (skor 20/100). Elemen di luar bingkai $\rightarrow$ `NEEDS_REVIEW`.
  3. `kitchen_layout_continuity`: Memeriksa konsistensi topologi denah (U-shape vs L-shape).
  4. `cabinet_geometry_consistency`: Memeriksa orientasi kabinet dan jenis bukaan.
  5. `material_and_color_consistency`: Memeriksa konsistensi palet material dan warna dinding.
  6. `architectural_landmark_match`: Memeriksa kesinambungan landmark fisik.
  7. `editorial_photo_variation`: Memastikan sudut kamera variatif dan sesuai peran foto (`context`, `problem_condition`, `relevant_detail`, `realistic_solution_example`).
  8. `no_misleading_architecture`: Memeriksa kelayakan konstruksi.
  9. `monetary_silence`: Memastikan nol harga atau mata uang pada visual.
- **Aturan Out-of-Frame:** Elemen yang berada di luar bingkai kamera atau terpotong wajib berstatus `NEEDS_REVIEW` (`UNVERIFIABLE`), dan dilarang keras menerima status `PASS` semu.
- **Logika Vonis:**
  - Ada `FAIL` pada gerbang manapun $\rightarrow$ `REJECTED`.
  - Ada `NEEDS_REVIEW` tanpa `FAIL` $\rightarrow$ `NEEDS_REVIEW`.
  - Hanya jika seluruh 9 gerbang `PASS` $\rightarrow$ `RECOMMENDED_FOR_OWNER`.

---

## 3. Hasil Pengujian Otomasi & Verifikasi Regresi

1. **`test-house-identity-lock-v12.mjs` (5/5 PASS - 100%):**
   - **Test 1 (Cover Lock):** Profil awal berhasil diselaraskan dengan kenyataan cover anchor (U-Shape + Kompor Induksi Kaca Datar).
   - **Test 2 (Prompt Engine):** Pemisahan immutable vs mutable terverifikasi bersih dengan negative prompt pencegah kompor gas.
   - **Test 3 (Regression Detection on Kling Omni #10011):** Pasangan Cover vs Inline 1 yang sebelumnya lolos semu kini **tertolak secara deterministik** dengan `fixed_appliance_consistency: FAIL (20/100)` dan `overall_verdict: 'REJECTED'`.
   - **Test 4 (Out-of-Frame Safety):** Elemen yang tidak terlihat dalam bingkai menerima `NEEDS_REVIEW (UNVERIFIABLE)`, bukan `PASS`.
   - **Test 5 (True Positive Verification):** Kandidat yang sepenuhnya konsisten lolos dengan skor 97/100 (`RECOMMENDED_FOR_OWNER`).
2. **Suite Tes Pelengkap (100% PASS):**
   - `test-photo-first-visual-policy.mjs`: 9/9 PASS.
   - `test-kling-omni-reference-payload.mjs`: 4/4 PASS.
   - `test-visual-semantic-quality-gate.mjs`: 7/7 PASS.
   - `test-canary-body-contract.mjs`: 6/6 PASS.
   - `npx tsc --noEmit`: 0 errors.

---

## 4. Status Keuangan & Integritas Operasional

- **Biaya Eksekusi Sesi Ini:** **US$ 0.00** ($0.00 new spend).
- **Total Biaya Kling Pilot Sejauh Ini:** **US$ 0.0392** (~ Rp 639) untuk 2 gambar (1 Cover + 1 Inline).
- **Status Cloudflare Staging Article ID 10:** Naskah utuh (1.267 kata), status `DRAFT`, persetujuan `PENDING`.
- **Status Produksi:** `AUTO_PUBLISH = OFF`, `PRODUCTION_AUTHORITY = 0`.
