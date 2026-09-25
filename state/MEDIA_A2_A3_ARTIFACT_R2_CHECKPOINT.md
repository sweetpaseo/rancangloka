# 📸 RancangLoka — Checkpoint MEDIA-A2 & MEDIA-A3
## Provider-Neutral Artifact Normalization, Watermark Derivative, and Production R2 Canary

> **Checkpoint ID:** `MEDIA-A2-A3-CHECKPOINT-20260925`  
> **Timestamp:** `2026-09-25T16:45:00+07:00`  
> **Branch:** `feat/jev-lokamedia-integration`  
> **Commits:**  
> - `f8bc39f67318cb91a6e8ce60bde0eda2d0282f88` (`feat: normalize generated media artifacts`)  
> - `2e617c302afc94908e7a73299b903d695b3903a7` (`feat: watermark and store production media artifact`)  
> **Status:** `PRODUCTION_R2_CANARY_PROVEN` (MEDIA-A2 PASS, MEDIA-A3 PASS, READY_FOR_MEDIA_A4)

---

## 1. Ringkasan Eksekutif & Arsitektur

Milestone **MEDIA-A2** dan **MEDIA-A3** membangun jembatan kanonikal antara fase pembuatan gambar (baik otonom via `fal.ai` maupun manual via `ChatGPT Plus` browser bridge) menuju fase pemrosesan watermark, penyimpanan persisten di Cloudflare R2, dan registrasi media kanonikal.

```
[ Headless Provider (fal.ai / DALL-E) ] ──┐
                                          ├──► [ normalize*() ] ──► [ GeneratedImageArtifact ]
[ Browser Bridge (ChatGPT / LokaMedia) ] ─┤                              │ (MEDIA-A2)
                                          │                              ▼
[ Safe Local Fixture (Repository) ] ──────┘                 [ Text Watermark Engine ]
                                                                         │
                                                                         ▼
                                                            [ WatermarkDerivativeResult ]
                                                                         │
                                                                         ▼
                                                            [ Production R2 Upload ] (rancangloka-media)
                                                                         │
                                                                         ▼
                                                            [ Independent Re-download & SHA-256 Proof ]
                                                                         │
                                                                         ▼
                                                            [ StoredGeneratedImageArtifact ] (MEDIA-A3 / A4 Handoff)
```

---

## 2. Rincian Milestone MEDIA-A2: Provider-Neutral Artifact Normalization

### A. Kontrak Kanonikal (`src/lib/media/generated-image-artifact.ts`)
- **`GeneratedImageArtifact`:**
  - `artifact_id`: Aturan identitas deterministik content-addressed: `art_${sha256.substring(0, 24)}`.
  - `source_type`: `'fal_api' | 'chatgpt_browser_bridge' | 'local_fixture'`.
  - `provider`: Provider asal (`'fal'`, `'chatgpt'`, `'local_fixture'`).
  - `image_bytes`: `Uint8Array` biner asli terverifikasi.
  - `mime_type`: `'image/png' | 'image/jpeg' | 'image/webp'`.
  - `width`, `height`, `byte_size`, `sha256`.
  - `prompt_hash`, `prompt_version`, `media_role`, `purpose`, `created_at`, `provenance`.
- **Fungsi Normalisasi:**
  - `normalizeHeadlessResult(result, options)`: Menormalkan hasil headless (`ImageGenerationResult`).
  - `normalizeChatGptBridgeResult(bridgeResult, options)`: Menormalkan hasil tangkapan ekstensi browser LokaMedia.
  - `normalizeLocalFixture(options)`: Menormalkan aset fixture repositori lokal.
- **Model Error Bertipe (`MediaA2ErrorCode` & `MediaArtifactError`):**
  - `EMPTY_IMAGE`, `INVALID_IMAGE_SIGNATURE`, `UNSUPPORTED_MIME`, `DIMENSION_INVALID`, `HASH_FAILURE`, `PROVENANCE_INVALID`, `SOURCE_MISSING`, `NORMALIZATION_ERROR`.
- **Secret & Privacy Firewall:**
  - Fungsi `sanitizeProvenance()` dan `sanitizeUrl()` memindai dan menghapus seluruh token otentikasi (`FAL_KEY`, `authorization: Bearer ...`, cookies, session tokens, serta query parameter URL sensitif seperti `?key=`, `?sig=`, `?token=`).
- **Verifikasi Anti-Spoofing:**
  - Memeriksa magic bytes asli (bukan ekstensi file).
  - Menolak payload HTML/JSON error yang menyamar sebagai file gambar.
  - Memverifikasi kesesuaian antara dimensi dan MIME yang dideklarasikan dengan biner aktual.

### B. Hasil Tes Unit MEDIA-A2 (`scripts/test-media-a2-normalization.js`)
- **14/14 Tes LULUS (PASS):**
  1. Headless ImageGenerationResult Normalization
  2. ChatGPT / LokaMedia Bridge Normalization
  3. Local Fixture Normalization & Real Canary
  4. Binary Magic Byte Validation
  5. MIME Validation & Anti-Spoofing
  6. Dimension Extraction & Anti-Spoofing
  7. Deterministic SHA-256 Content Hashing
  8. Artifact Identity Semantics (`art_${sha256.substring(0, 24)}`)
  9. Provenance Normalization
  10. Secret / Privacy Firewall
  11. Invalid HTML Error Payload Rejection
  12. Invalid JSON Error Payload Rejection
  13. Empty & Truncated Bytes Rejection
  14. MEDIA-A3 Input Contract Creation

---

## 3. Rincian Milestone MEDIA-A3: Watermark Derivative & Production R2 Canary

### A. Komponen & Mesin Transformasi (`src/lib/media/stored-image-artifact.ts`)
- **`renderTextWatermarkDerivative()`:**
  - Menggunakan modul kanonikal `@napi-rs/canvas` untuk merender watermark teks dengan rumus geometri deterministik dari `extensions/lokamedia/src/watermark-engine.js`.
  - Teks: `rancangloka.com`, posisi: `bottom-right`, `opacity=0.62`, `font_size_ratio=0.022`.
  - Efek visual: Shadow halus gelap (`rgba(0, 0, 0, 0.45)`) + teks putih kontras (`#ffffff`).
  - Preservasi dimensi mutlak: Dimensi sumber (169×512) dipertahankan persis pada derivatif (169×512).
- **`StoredGeneratedImageArtifact`:**
  - Kontrak serah-terima kanonikal untuk tahapan MEDIA-A4.
  - Memuat `artifact_id`, `source_artifact_id`, `storage_provider: 'cloudflare_r2'`, `bucket`, `storage_key`, `mime_type`, `width`, `height`, `byte_size`, `sha256`, `watermark_applied: true`, `watermark_type: 'TEXT'`, `watermark_config_hash`, `provenance`, `created_at`.

### B. Eksekusi Live Canary R2 Produksi (`scripts/run-media-a3-r2-canary.js`)
- **Aset Sumber Aman (Safe Source Fixture):** `public/stitch-homepage.png`
  - `SOURCE_BEFORE_SHA256`: `92eca8e32eb2f0f4e176054d82ce8830faf103044ddb75f59f778e204763676d`
  - `SOURCE_ARTIFACT_ID`: `art_92eca8e32eb2f0f4e176054d`
  - Dimensi Sumber: 169×512 px, 58.941 bytes.
- **Hasil Render Derivatif:**
  - `DERIVATIVE_SHA256`: `7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967`
  - Ukuran Derivatif: 66.377 bytes
  - Dimensi Derivatif: 169×512 px (100% presisi)
  - Format: `image/png`
  - `R2_DERIVATIVE_IDEMPOTENCY`: **PASS** (re-render deterministik menghasilkan hash identik)
- **Pemeriksaan Pra-Upload (Fail-Closed Guard):**
  - Storage Key: `media/canary/media-a3/7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967.png`
  - Pemeriksaan keberadaan objek di bucket produksi `rancangloka-media` sebelum upload: Terkonfirmasi **KOSONG / BELUM ADA** (404/Key does not exist).
- **Upload Produksi R2 (Tepat 1 Percobaan):**
  - Perintah: `wrangler r2 object put rancangloka-media/media/canary/media-a3/... --content-type image/png`
  - `PRODUCTION_R2_UPLOAD_ATTEMPTS`: `1`
  - `PRODUCTION_R2_UPLOAD_SUCCESS`: **YES**
- **Re-Download & Pembuktian Integritas Biner:**
  - Objek diunduh ulang secara independen dari bucket produksi `rancangloka-media`.
  - `R2_DOWNLOADED_SHA256`: `7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967`
  - `R2_DOWNLOADED_BYTE_SIZE`: `66377`
  - `R2_DOWNLOADED_MIME`: `image/png`
  - `R2_DOWNLOADED_WIDTH`: `169`
  - `R2_DOWNLOADED_HEIGHT`: `512`
  - `R2_BYTE_INTEGRITY`: **PASS** (`R2_DOWNLOADED_SHA256 === DERIVATIVE_SHA256`)
- **Pembuktian Imutabilitas Sumber Asli:**
  - `SOURCE_AFTER_SHA256`: `92eca8e32eb2f0f4e176054d82ce8830faf103044ddb75f59f778e204763676d`
  - `SOURCE_IMMUTABLE`: **PASS** (100% identik dengan byte sebelum eksekusi).
- **Evaluasi Pengiriman Publik (Public Delivery):**
  - `PUBLIC_MEDIA_DELIVERY`: `NOT_APPLICABLE_UNTIL_MEDIA_A4` (Route `/media/[key]` hanya menerima segmen tunggal tanpa slash, sesuai antisipasi spesifikasi).
- **Handoff Contract MEDIA-A4:**
  - File: `artifacts/stored-generated-image-artifact.json`
  - `MEDIA_A4_STORAGE_CONTRACT`: **READY**

---

## 4. Invarian Keselamatan & Firewall Produksi

| Firewall Parameter | Nilai Terverifikasi | Keterangan |
| :--- | :--- | :--- |
| **`FAL_API_CALLS`** | `0` | Live call fal.ai ditangguhkan aman (`DEFERRED_FUNDING`). |
| **`OTHER_PAID_PROVIDER_CALLS`** | `0` | Zero pemanggilan ke provider berbayar. |
| **`PRODUCTION_D1_MUTATIONS`** | `0` | Database produksi D1 100% tidak tersentuh. |
| **`MEDIA_ASSETS_ROWS_CREATED`** | `0` | Zero insert ke tabel `media_assets`. |
| **`ARTICLE_MEDIA_ATTACHMENTS`** | `0` | Zero binding/relasi ke `article_media`. |
| **`ARTICLE_MUTATIONS`** | `0` | Seluruh draf & artikel terbit tidak termutasi. |
| **`PUBLICATION_MUTATIONS`** | `0` | Sistem publikasi tetap `mode=OFF`, `kill_switch=0`. |
| **`PRODUCTION_DEPLOYED`** | `NO` | Zero deployment worker baru. |
| **Authorized Production Mutation** | `1 R2 Object` | Tepat 1 objek canary baru diunggah ke `rancangloka-media`. |

---

## 5. Ringkasan Tes & Regresi

1. `node scripts/test-media-a2-normalization.js`: **14/14 PASSED**
2. `node scripts/test-media-a3-r2-canary.js`: **6/6 PASSED**
3. `node scripts/run-media-a3-r2-canary.js`: **CANARY SUCCEEDED (Upload & Download Verified)**
4. `node scripts/test-lokamedia-phase5d4a-watermark-settings.js`: **14/14 PASSED**
5. `node scripts/test-lokamedia-phase5d4b-watermark-asset-storage.js`: **12/12 PASSED**
6. `node scripts/test-headless-image-provider.js`: **7/7 PASSED**
7. `node scripts/test-fal-image-provider.js`: **7/7 PASSED (MOCK ONLY)**
8. `node scripts/test-lokamedia-phase5k3b-r2-fullres-capture.js`: **6/6 PASSED**
9. `node scripts/test-lokamedia-phase5g1-asset-registration.js`: **40/40 PASSED**
10. `node scripts/test-decision-media-planning.js`: **16/16 PASSED**
11. `npx tsc --noEmit`: **0 ERROR (Typecheck Clean)**
12. `npm run build`: **ASTRO SSR BUILD CLEAN (4.74s)**

---

## 6. Status Kesiapan Tahapan Selanjutnya

- **`MEDIA_A2`:** **`PASS`**
- **`MEDIA_A3`:** **`PASS`**
- **`READY_FOR_MEDIA_A4`:** **`YES`**
- **Next Step (MEDIA-A4):** Integrasi `StoredGeneratedImageArtifact` ke alur pendaftaran media kanonikal (`media_assets`), pembuatan route penyajian publik/CDN untuk derivatif terunggah, dan pelaporan siklus hidup media lengkap ke Run Ledger.
