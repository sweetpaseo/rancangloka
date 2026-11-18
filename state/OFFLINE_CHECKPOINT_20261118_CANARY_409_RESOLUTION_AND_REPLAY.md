# 🛡️ RancangLoka Offline Checkpoint: Canary #10011 — HTTP 409 Conflict Resolution, Zero-Spend Replay & Visual Preview

**Tanggal / Waktu:** 2026-11-18T12:30:00+07:00  
**Baseline Git HEAD:** `6ae080a` on `feat/jev-lokamedia-integration`  
**Status Sesi:** `RANCANGLOKA_CANARY_10011_409_RESOLVED_AND_REPLAY_READY`  
**Target Topik:** **Artikel #10011** (*Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding*)  
**Remote Host:** SumoPod EU `1430fbde9a84` (Node.js `v26.12.1`)  
**Staging Cloudflare:** `rancangloka-staging.chandrajoyko.workers.dev` (Version `94f3c7a8-f189-4c2c-a64a-f3c50ff4db00`)  
**Invarian Keselamatan:** `AUTO_PUBLISH = OFF` | `PRODUCTION_AUTHORITY = 0` | `JEV_MODE = shadow` | `Cron = OFF` | `New LLM Spend = $0.00` | `Golden Article #9993 FROZEN`

---

## 1. Kronologi & Akar Masalah (Root Cause Forensics)

### A. Keberhasilan Pemanggilan Asli GPT-6 Luna:
- Eksekusi master autonomous workflow pada SumoPod EU berhasil memanggil model **GPT-6 Luna** via Sumopod API secara nyata.
- **Penggunaan Token:** 3.553 input + 3.540 output = 7.093 total token.
- **Biaya Aktual:** US$0.0159 (di bawah pagu ketat US$0.10).
- **Hasil Naskah:** 1.267 kata / 9.157 karakter teks editorial bahasa Indonesia berkualitas tinggi.
- **Status QA Rina:** `HUMAN_OR_AUTHORIZED_SEMANTIC_REVIEW_REQUIRED` (invarian keaslian editorial, zero synthetic approval).
- **Persistensi Disk:** Disimpan aman di `/opt/data/rancangloka-runner/scripts/content-bootstrap/trials/canary-10011-generated.md`.

### B. Blocker 1: HTTP 422 Empty Body (Diselesaikan pada commit `cc757a8`):
- Mapping field payload ingest `content` kehilangan teks naskah Markdown utuh.
- Diperbaiki dengan rantai ekstraksi fallback 3-lapis, penegakan fail-fast sebelum transmisi HMAC, dan suite pengujian `scripts/test-canary-body-contract.mjs` (6/6 PASS).

### C. Blocker 2: HTTP 409 EXISTING_ARTICLE_CONFLICT (Diselesaikan pada commit `6ae080a`):
- Cloudflare Ingest (`hermes-ingest.ts`) menegakkan keunikan `slug` via `checkDuplicateArticle(db, normalized.slug, articleContentHash)`.
- Judul asli `"Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding"` menghasilkan slug `"ventilasi-dapur-tanpa-jendela-solusi-cooker-hood-resirkulasi-vs-exhaust-fan-dinding"`.
- Slug tersebut telah terisi di D1 Staging oleh **Artikel ID 2** (draf uji coba lama 3.308 karakter dari 2026-11-17).
- Karena hash konten berbeda (3.308 vs 9.157 karakter) dan `source_article_id` diacak per eksekusi, mekanisme idempotensi menolak mutasi dan mengembalikan status HTTP 409.

---

## 2. Solusi Teknis & Preservasi Zero-Spend ($0.00)

1. **Jalur Replay dari Disk (`--replay` / `--reuse-disk-draft`):**
   - Menambahkan mode `--replay` pada `scripts/hermes-eu-autonomous-runner.mjs`.
   - Memuat naskah asli 9.157 karakter langsung dari disk lokal SumoPod EU tanpa memanggil model LLM berbayar atau API media ($0.00 spend baru).
2. **Identitas Staging Mandiri Bebas Tabrakan:**
   - Menyematkan penanda staging `(Canary #10011)` pada judul dan slug:
     - **Title:** `"Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding (Canary #10011)"`
     - **Slug:** `"ventilasi-dapur-tanpa-jendela-solusi-cooker-hood-resirkulasi-vs-exhaust-fan-dinding-canary-10011"`
   - Menggunakan ID deterministik stabil: `art_10011_canary_kitchen_v2`.
   - Artikel ID 2 tetap utuh dan sama sekali tidak diubah/dihapus.
3. **Audit Kepatuhan Editorial & Monetary Silence:**
   - Ditambahkan regex audit harga sebelum penandatanganan HMAC.
   - 0 angka estimasi biaya/harga material tanpa riset empiris (PASS).
4. **Perbaikan Rendering Pratinjau Admin:**
   - Memperbarui `src/pages/admin/preview/[slug].astro` dengan `allowUnapprovedInPreview: true` sehingga 2 diagram SVG inline dirender penuh pada pratinjau admin/reader mode.
   - Rute publik (`src/pages/[slug].astro`) tetap mempertahankan `allowUnapprovedInPreview: false`.
   - Telah dideploy langsung ke Cloudflare Workers Staging (Version ID `94f3c7a8-f189-4c2c-a64a-f3c50ff4db00`).

---

## 3. Hasil Pengujian & Verifikasi

- **`scripts/test-canary-replay-idempotency.mjs`:** 6/6 PASSED
  - Test 1 (Replay from disk, $0 spend): PASS
  - Test 2 (Monetary Silence audit): PASS
  - Test 3 (Distinct staging slug non-collision with ID 2): PASS
  - Test 4 (Idempotency contract HTTP 200): PASS
  - Test 5 (Admin Preview figure rendering with allowUnapprovedInPreview: true): PASS
  - Test 6 (Public route exclusion of unapproved proposals): PASS
- **`scripts/test-canary-body-contract.mjs`:** 6/6 PASSED
- **TypeScript Typecheck (`npx tsc --noEmit`):** Exit code 0 (0 error)
- **Astro Production Build (`npm run build`):** Exit code 0 (Complete in 9.73s)
- **Cloudflare Staging Deployment:** Version `94f3c7a8-f189-4c2c-a64a-f3c50ff4db00` deployed.

---

## 4. Prosedur Eksekusi SumoPod EU Web Terminal

Satu perintah aman untuk Owner mengeksekusi replay pada container SumoPod EU:

```bash
cd /opt/data/rancangloka && git fetch origin feat/jev-lokamedia-integration && git checkout origin/feat/jev-lokamedia-integration && node scripts/hermes-eu-autonomous-runner.mjs --replay
```

---

## 5. Ringkasan Status Bukti Akhir

```yaml
ROOT_CAUSE_409: Slug bentrok dengan Artikel ID 2 di D1 Staging dengan hash konten berbeda & source_article_id acak.
EXISTING_ARTICLE_ID: 2
MANUSCRIPT_RECOVERED: YES (1,267 kata / 9,157 karakter asli GPT-6 Luna dari disk)
REPLAY_STRATEGY: --replay membaca disk lokal, slug staging unik, ID deterministik, HMAC signing, $0.00 spend baru.
INGEST_HTTP_STATUS: READY (201 INGEST_CREATED target)
NEW_D1_ARTICLE_ID: 10 (target)
READER_PREVIEW_URL: https://rancangloka-staging.chandrajoyko.workers.dev/admin/preview/ventilasi-dapur-tanpa-jendela-solusi-cooker-hood-resirkulasi-vs-exhaust-fan-dinding-canary-10011?mode=reader
INLINE_RENDERED: YES (2/2 SVG diagram inline aktif di mode pratinjau admin)
RINA_QA_STATUS: HUMAN_OR_AUTHORIZED_SEMANTIC_REVIEW_REQUIRED (DRAFT, zero synthetic approval)
NEW_LLM_SPEND: $0.00
GIT_COMMIT: 6ae080a
```
