# 🛡️ RancangLoka Offline Checkpoint: Kling Omni Image Series Integration

**Tanggal / Waktu:** 2026-11-19T12:38:00+07:00  
**Baseline Git HEAD:** `94c10d7` on `feat/jev-lokamedia-integration`  
**Status Sesi:** `RANCANGLOKA_KLING_OMNI_IMAGE_SERIES_V1_VERIFIED_SAFE`  
**Target Topik:** **Artikel #10011** (*Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding*)  
**Staging Target:** Cloudflare D1 Staging **Article ID 10** (Status: `DRAFT`, Persetujuan: `PENDING`)  
**Invarian Keselamatan:** `AUTO_PUBLISH = OFF` | `PRODUCTION_AUTHORITY = 0` | `JEV_MODE = shadow` | `Cron = OFF` | `PAID_GENERATION = NOT_AUTHORIZED ($0.00 spend)` | `Monetary Silence = 100% MUTLAK`

---

## 1. Ringkasan Fitur: Kling Omni Image Series Mode (`result_type: "series"`)

Sesuai arahan Owner, RancangLoka beralih memanfaatkan kemampuan asli Kling Image 3.0 Omni untuk menghasilkan **seri foto editorial berkaitan dari satu rumah sekaligus**, menggantikan alur generasi inline satu per satu.

### Spesifikasi Resmi Kling Omni:
- **Endpoint:** `POST /v1/images/omni-image`
- **Model:** `kling-v3-omni`
- **Parameter Payload Seri:**
  - `result_type: "series"`
  - `series_amount: 3` (didukung 2..9 gambar)
  - `aspect_ratio: "16:9"`
  - `resolution: "2k"`
  - `image_list: [{ image: cleanCoverBase64 }]`
  - `prompt`: Teks terstruktur memuat `[IMMUTABLE HOUSE & KITCHEN IDENTITY]` dan sequence `SHOT 1`, `SHOT 2`, `SHOT 3` dengan conditioning `<<<image_1>>>`.
  - `n`: Dihapus/ditiadakan dalam mode seri (Kling menggunakan `series_amount`).
- **Struktur Respons Polling:**
  - `task_result.series_images`: Array berisi frame dengan urutan index `0`, `1`, `2` dan URL CDN masing-masing.

---

## 2. Keterbatasan Adapter Lama & Solusi yang Diimplementasikan

| Aspek | Adapter Lama | Adapter Baru (v1.2 Series) |
|---|---|---|
| **Mode Hasil** | Hanya `result_type: "single"` | Mendukung `result_type: "series"` dan `"single"` (backward compatible) |
| **Jumlah Output** | Terikat pada `n` (1..9 salinan) | Mendukung `series_amount: 2..9` untuk sequence terhubung |
| **Parsing Polling** | Hanya membaca `task_result.images` (gagal jika seri mengembalikan `series_images`) | Mendukung pembacaan `task_result.series_images` dengan fallback aman ke `images` |
| **Metadata Output** | Hasil tunggal / array `batch_images` | Mengembalikan `series_images` dengan `frame_index` dan penugasan peran foto `shot_role` |
| **Evaluasi QA** | Evaluasi satu per satu gambar | Evaluasi lintas-frame (`evaluateImageSeriesQualityGate`) memeriksa 6 invarian: konsistensi rumah, kompor tetap, kesinambungan denah, variasi sudut nyata, relevansi naskah, dan fotorealisme |

---

## 3. Akuntansi Kuota & Estimasi Biaya

- **Basis Perhitungan Billing Resmi Kling:** Dihitung berdasarkan **JUMLAH GAMBAR OUTPUT**, bukan jumlah request API.
  - Resolusi 2K: 8 Kling units / gambar.
  - Resolusi 4K: 16 Kling units / gambar.
- **Kebutuhan Unit untuk Seri 3 Gambar (2K):**
  - **3 gambar × 8 unit = 24 Kling units**.
  - **Biaya Efektif Paket Trial ($0.00245/unit):** **US$ 0.0588** (~ **Rp 958**).
  - **List Price ($0.0035/unit):** **US$ 0.0840** (~ **Rp 1.369**).
- **Saldo Akun Kling Terverifikasi (via `GET /account/costs`):**
  - Paket: `Trial-Image-Advanced-1000Units-9Con-1Months`
  - Total Kuota Awal: 1.000 units
  - **Sisa Kuota Aktif Saat Ini:** **960 units** (Cukup untuk 40 gambar 2K atau 13 seri 3-shot).
  - Sisa setelah pilot seri: 960 - 24 = 936 units.
- **Biaya Sesi Ini:** **US$ 0.00** ($0.00 new spend, stop at preflight).

---

## 4. Hasil Pengujian Otomasi Offline (100% PASS)

1. `test-kling-omni-series-contract.mjs`: **7/7 PASS (100%)**
   - T01: Konstruksi payload seri (`result_type: "series"`, `series_amount: 3`, omisi `n`, injeksi `<<<image_1>>>`).
   - T02: Penolakan nilai `series_amount` di luar rentang (<2 atau >9).
   - T03: Penjaminan kompatibilitas mundur untuk permintaan gambar tunggal (`result_type: "single"`).
   - T04: Parsing polling `task_result.series_images` dan ekstraksi 3 frame dengan metadata `shot_role`.
   - T05: Perhitungan biaya 24 unit untuk 3 output 2K.
   - T06: Penyusunan prompt seri 3-shot dengan penguncian immutable arsitektur dan peralatan.
   - T07: Nadia Series QA Gate mengevaluasi seluruh 6 invarian, menolak sudut kamera duplikat atau kompor gas yang bermutasi.
2. Suite Pelengkap:
   - `test-kling-image-adapter.mjs`: 15/15 PASS.
   - `test-kling-omni-reference-payload.mjs`: 4/4 PASS.
   - `npx tsc --noEmit`: 0 errors.

---

## 5. Perintah Pilot yang Aman (Setelah Disetujui Owner)

```bash
node scripts/execute-kling-omni-image-series-pilot.mjs --authorized-generate
```
