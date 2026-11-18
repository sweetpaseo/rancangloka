# 🛡️ RancangLoka Offline Checkpoint: Hermes EU Autonomous Canary Preflight & Kling Integration V1 Closeout

**Tanggal / Waktu:** 2026-11-18T07:50:00+07:00  
**Baseline Git HEAD:** `97a9659` on `feat/jev-lokamedia-integration`  
**Status Sesi:** `RANCANGLOKA_REAL_CANARY_10011_PREFLIGHT_READY`  
**Target Topik:** **Artikel #10011** (*Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding*)  
**Eksekutor:** Tim Otonom Hermes & Redaksi RancangLoka (SEON, Irwan, Joko, Nadia, Budi, Sari, Rina, JEV)  
**Invarian Keselamatan:** `AUTO_PUBLISH = OFF` | `PRODUCTION_AUTHORITY = 0` | `JEV_MODE = shadow` | `Cron = OFF` | `Hard Budget Cap <= US$0.10` | `Golden Article #9993 FROZEN`

---

## 1. Kling Integration V1 & Visual Quality Gate V2.2 (Selesai & Tertutup Rapi)

1. **Penyelesaian Provider Kling Image 3.0**:
   - `KlingImageProviderAdapter` telah terintegrasi penuh dengan tarif resmi (2K: 8 unit / $0.028 list / $0.0196 prepaid trial; 4K: 16 unit / $0.056 list / $0.0392 prepaid trial).
   - Seluruh 15 unit tests pada `scripts/test-kling-image-adapter.mjs` berstatus **100% PASS**.
   - Pengembangan Kling dihentikan resmi; Seedream 5.0 Pro V2 tetap menjadi **DEFAULT** provider redaksi.

2. **Koreksi Visual Quality Gate V2.2 (Gerbang Wajib Storyboard Nadia)**:
   - Terpasang pada `src/lib/editorial/visual-quality-reviewer.ts` dengan 5 Hard Gate:
     1. Kesesuaian Objek Utama (`primary_subject_mismatch`)
     2. Akurasi Susunan Ruang (`spatial_layout_inaccurate`)
     3. Proporsi Bangunan & Kavling (`building_proportions_invalid`)
     4. Kelayakan Konstruksi & Fisika Bangunan (`construction_implausible`)
     5. Keselarasan Konsep Artikel (`contradicts_article_concept`)
   - **Invarian Mutlak**: Skor fotorealisme tinggi (90/100) tidak dapat membatalkan kegagalan gerbang wajib.
   - Kandidat live pertama (`task_id: 951797337209324835`, SHA-256 `36623e6c...`) dicatat permanen sebagai **`BENCHMARK_REJECTED`** (Keputusan: `TOLAK`) di `state/calibration_decisions.json`.
   - File binary dan URL R2 staging tetap utuh dan terverifikasi keterjangkauannya.

---

## 2. Pembuktian Remote Hermes EU & Ingestion Cloudflare Staging (PASS)

1. **Rotasi Kunci Kriptografis Staging**:
   - Pasangan kunci diperbarui ke `hermes_staging_key_v2`.
   - Staging Edge Worker Cloudflare menerima secret baru via `wrangler secret put RANCANGLOKA_HERMES_INGEST_KEY_CURRENT --env staging`.

2. **Verifikasi Eksekusi Nyata dari Container SumoPod EU**:
   - **Remote Hostname**: `1430fbde9a84` (Node.js `v26.12.1`)
   - **Workspace**: `/opt/data/rancangloka-runner`
   - **Status Respon**: **`HTTP 201 Created`** (`code: INGEST_CREATED`, `article_status: draft`).
   - **D1 Staging Article ID**: `9`
   - **Visual Manifest**: Persisted di tabel `settings` D1 staging.
   - **Financial Spend**: **US$0.00** (Zero LLM spend, Zero media spend).
   - Permasalahan HMAC dan plumbing staging edge resmi ditutup.

---

## 3. Kesiapan Real AI Canary #10011 (Preflight Ready)

1. **Kalibrasi Evidence Pack Objektif (Anti-Slop & Anti-Hiperbola)**:
   - Acuan regulasi: **SNI 6572-2:2024 / SNI 03-6572-2001** (*Tata Cara Perancangan Sistem Ventilasi Bangunan Gedung*).
   - Menghapus klaim mutlak 15–20 ACH tanpa pasal, klaim berlebihan 100% pembuangan, serta angka celah pintu / sudut ducting tanpa sumber.
   - Seluruh 6 klaim *author-safe* berstatus `VERIFIED` berbasis prinsip fisika penangkapan uap (*Local Exhaust Ventilation*), adsorpsi karbon aktif, dan hukum kontinuitas fluida (*make-up air*).

2. **Jalur Pemanggilan Nyata Model LLM (Joko / GPT-6 Luna)**:
   - Terintegrasi langsung dengan `EditorialLlmProvider` (`https://ai.sumopod.com/v1/chat/completions`) model `gpt-6-luna`.
   - Tidak menggunakan teks statis atau fixture tiruan.
   - Mendeteksi kunci multi-lokasi (`process.env.SUMOPOD_API_KEY`, `.env.staging`, `/opt/hermes/.env`) tanpa duplikasi kunci.

3. **Pipeline Visual & Telemetri**:
   - Budi menyintesis diagram teknis SVG Base64 (Plus Jakarta Sans, 16:9, status: `PENDING`, zero synthetic approval).
   - Pengeluaran media berbayar: **$0.00**.
   - Estimasi biaya LLM Canary: **~US$0.02 - $0.04** (Hard budget cap terjaga ketat: $\le \text{US}\$0.10$).

4. **Satu Perintah Eksekusi Web Terminal SumoPod**:
   ```bash
   cd /opt/data/rancangloka-runner && git pull origin feat/jev-lokamedia-integration && if [ -z "$SUMOPOD_API_KEY" ] && ! grep -q "SUMOPOD_API_KEY=" .env.staging 2>/dev/null && ! grep -q "SUMOPOD_API_KEY=" /opt/hermes/.env 2>/dev/null; then read -s -p "Paste SUMOPOD_API_KEY lalu tekan Enter: " K && echo "" && echo "SUMOPOD_API_KEY=$K" >> .env.staging && chmod 600 .env.staging && unset K; fi && node scripts/hermes-eu-autonomous-runner.mjs --canary
   ```

---

## 4. Status Pengujian & Typecheck Baseline

- `scripts/test-visual-quality-gate-correction.mjs`: **10 / 10 PASS (100%)**
- `scripts/test-kling-image-adapter.mjs`: **15 / 15 PASS (100%)**
- `scripts/hermes-eu-autonomous-runner.mjs --dry-run`: **PASS ($0.00 spend)**
- `npx tsc --noEmit`: **PASS (0 errors)**
- Branch: `feat/jev-lokamedia-integration` (Commit: `97a9659`)
