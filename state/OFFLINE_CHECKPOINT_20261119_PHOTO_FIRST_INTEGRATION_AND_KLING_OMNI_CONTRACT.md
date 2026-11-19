# 🛡️ RancangLoka Offline Checkpoint: Photo-First v1.1 Integration & Kling Omni Reference Contract

**Tanggal / Waktu:** 2026-11-19T10:25:00+07:00  
**Baseline Git HEAD:** `43c4b42` on `feat/jev-lokamedia-integration`  
**Status Sesi:** `RANCANGLOKA_PHOTO_FIRST_V1_1_INTEGRATION_VERIFIED_SAFE`  
**Target Topik:** **Artikel #10011** (*Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding*)  
**Staging Target:** Cloudflare D1 Staging **Article ID 10** (Status: `DRAFT`, Persetujuan: `PENDING`)  
**Invarian Keselamatan:** `AUTO_PUBLISH = OFF` | `PRODUCTION_AUTHORITY = 0` | `JEV_MODE = shadow` | `Cron = OFF` | `PAID_GENERATION = NOT_AUTHORIZED ($0.00 spend)` | `Monetary Silence = 100% MUTLAK`

---

## 1. Ringkasan Implementasi & Kebijakan Editorial Photo-First v1.1

Sesuai arahan Owner, RancangLoka menetapkan kebijakan visual editorial berbasis fotografi (*Photo-First*):
1. **Fotografi Editorial Arsitektural sebagai Default:**
   - 1 Cover foto interior/arsitektur.
   - 2–4 Foto inline dengan peran fungsional spesifik:
     * `context`: Gambaran ruang dapur kompak dan hubungan spasialnya.
     * `problem_condition`: Masalah kelembapan, uap terperangkap di dekat kabinet atas kompor.
     * `relevant_detail`: Detail teknis filter grease / karbon aktif atau kisi jalusi ventilasi.
     * `realistic_solution_example`: Penerapan sistem ventilasi nyata pada ruang dapur kompak.
   - 0 Diagram SVG pada alur produksi standar (generator diagram lama tetap dipelihara via opsi `--legacy-diagrams`).
2. **House Identity Profile (`house-identity.ts`):**
   - Menetapkan profil arsitektur terpadu per artikel: gaya kontemporer tropis urban, palet HPL jati muda matte, countertop solid surface light cream, backsplash keramik subway putih krem vertikal, lantai teraso honed abu-abu muda, lis dark bronze anodized.
   - Menghasilkan token deskripsi spasial konsisten dan negative prompt terstandarisasi.
3. **Photo Quality Gate (`photo-quality-gate.ts`):**
   - 7 pilar verifikasi deterministik: `PHOTO_REALISM`, `SAME_HOUSE_VISUAL_CONSISTENCY`, `SPATIAL_CONTINUITY`, `ARTICLE_SEMANTIC_RELEVANCE`, `VISUAL_VARIATION`, `NO_MISLEADING_ARCHITECTURE`, `MONETARY_SILENCE`.
   - Menolak keras klaim `SAME_HOUSE_PASS` palsu (misal: perubahan material kabinet atau denah ruang acak).

---

## 2. Verifikasi Kontrak Kling Image 3.0 Omni (`kling-v3-omni`)

1. **Endpoint & Routing:**
   - Model: `"kling-v3-omni"` (atau `"kling-image-o1"`).
   - Submit Endpoint: `POST https://api-singapore.klingai.com/v1/images/omni-image`.
   - Query Status: `GET https://api-singapore.klingai.com/v1/images/omni-image/{task_id}`.
2. **Spesifikasi Payload & Kondisioning Referensi:**
   - **Cover Request:** Mengirimkan `model_name`, `prompt`, `resolution: "2k"`, `aspect_ratio: "16:9"`. Bidang `image_list` **tidak dikirim** (zero reference conditioning).
   - **Inline Request:** Mengirimkan `image_list: [{ image: cleanRefUrlOrBase64 }]`.
   - **Tag Prompt:** Otomatis menyematkan tag referensi `<<<image_1>>>` ke dalam teks prompt guna memandu konsistensi spasial model Omni.
   - **Isolasi Parameter:** Bidang `image_fidelity` **secara ketat tidak dikirim** ke `/v1/images/omni-image` (hanya berlaku pada endpoint standar `/v1/images/generations`).
   - **Pencegahan Kebocoran Kredensial:** Header `Authorization` disamarkan menjadi `Bearer [REDACTED_KLING_API_KEY]`.
3. **Unit Billing & Kalkulasi Biaya 2 Gambar Pilot (1 Cover + 1 Inline):**
   - Resolusi 2K: 8 unit Kling per gambar.
   - Total Unit: 16 unit untuk 2 gambar.
   - Biaya Efektif Paket Hemat ($2.45 / 1000 unit): **US$ 0.0392** ($\approx$ **Rp 639** pada kurs Rp 16.300/USD).
   - Biaya Standar List Price ($0.028 / 8 unit): **US$ 0.0560** ($\approx$ **Rp 913**).
   - **Status Pengeluaran Nyata:** **US$ 0.00 (STOP BEFORE PAID GENERATION — Menunggu otorisasi Owner)**.

---

## 3. Integrasi Runner Hermes EU (`hermes-eu-autonomous-runner.mjs`)

- Runner mendeteksi `storyboard.visual_policy === 'PHOTO_FIRST'` dan memetakan slot foto editorial (`media_type: 'photograph'`) terikat pada H2 heading naskah.
- Status ulasan ditetapkan `PENDING` dengan `storage_key: ''` menunggu panggilan API berbayar yang disetujui.
- Opsi `--legacy-diagrams` tetap berfungsi untuk menghasilkan diagram SVG arsitektur 16:9 saat dibutuhkan.

---

## 4. Hasil Uji Otomasi & Verifikasi Kode

```bash
# 1. Uji Kebijakan Editorial Photo-First (9/9 PASS - 100%)
node scripts/test-photo-first-visual-policy.mjs

# 2. Uji Kontrak Payload Kling Omni (4/4 PASS - 100%)
node scripts/test-kling-omni-reference-payload.mjs

# 3. Uji Visual Semantic Gate & Integrasi Render (7/7 PASS - 100%)
node scripts/test-visual-semantic-quality-gate.mjs

# 4. Uji Kontrak Naskah & Body Canary (6/6 PASS - 100%)
node scripts/test-canary-body-contract.mjs

# 5. Typecheck TypeScript Bebas Error (0 errors)
npx tsc --noEmit
```

---

## 5. Ringkasan Status Bukti Akhir

```yaml
TARGET_ARTICLE: Article ID 10 (Canary #10011)
EDITORIAL_POLICY: PHOTO_FIRST v1.1
HOUSE_IDENTITY_PROFILE: hip_kitchen_compact_ventilasi-dapur-tan
PROVIDER: Kling AI Image 3.0 Omni (kling-v3-omni)
ENDPOINT: POST /v1/images/omni-image
REFERENCE_CONDITIONING: image_list with <<<image_1>>> tag
ESTIMATED_PILOT_COST: US$ 0.0392 (~Rp 639) for 2 images (16 units)
REAL_AI_SPEND_CURRENT: US$ 0.00 (Zero paid API calls)
TSC_CHECK: 0 errors
TEST_SUITE_STATUS: 26/26 PASS (100%)
NEXT_ACTION: Request Owner authorization before executing live paid image generation.
```
