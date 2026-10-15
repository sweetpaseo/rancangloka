# 🧭 RancangLoka — Article Support Thumbnail Production Acceptance Checkpoint

**Tanggal:** 2026-10-15T21:25:00+07:00
**Status Operasional:** `ARTICLE_SUPPORT_THUMBNAIL_PRODUCTION_COMPLETE`
**Otorisasi:** Chief Editor Production Authorization (`AUTHORIZE ARTICLE_SUPPORT_THUMBNAIL PRODUCTION DEPLOYMENT`)
**Branch Aktif:** `feat/jev-lokamedia-integration`
**Accepted Commits:**
- `76e03f7` `feat(ui): add thumbnails to semantic article support module`
- `39078ef` `perf(media): add compact derivatives for article support thumbnails`
- `e180431` `fix(media): harden thumbnail derivative lifecycle and cache safety`
- `9461c9e` `fix(media): make thumbnail generation runtime-safe`
**Worker Deployment:**
- Previous Worker Version: `d81c7b65-eee6-468d-b517-36d6ac77dcf6`
- New Worker Version: `8eab73f4-8533-441d-9c36-f3e23f6da455`
**Klasifikasi:** `ARTICLE_SUPPORT_THUMBNAIL_PRODUCTION_COMPLETE`

---

## 1. Problem Statement & Baseline Measurement
- **Masalah:** Modul *"Artikel Pendukung untuk Keputusan Ini"* sebelumnya memuat gambar sampul editorial penuh (~1200–1315 px lebar, 146–218 KB per gambar) untuk menampilkan thumbnail berukuran 80x80 px (desktop) dan 56x56 px (mobile).
- **Baseline Payload Artikel 8 (3 kartu dukungan: Artikel 9, 7, 5):**
  - Artikel 9 (`4ee03637...webp`): 218.0 KB (223,288 B)
  - Artikel 7 (`b5cd5019...webp`): 193.1 KB (197,716 B)
  - Artikel 5 (`631baf7a...webp`): 166.8 KB (170,766 B)
  - **Total Baseline Artikel 8:** **577.9 KB** (591,740 bytes).
- **Total 5 Sampul Editorial (Artikel 5–9):** **872.1 KB** (893,176 bytes).

---

## 2. Derivative Architecture & Implementation
1. **Dimensi & Format Kanonikal:**
   - Dimensi sumber: **160x160 px** (1:1 square crop, Lanczos resampling) untuk mendukung densitas 2x (Retina) pada display CSS 80x80 px / 56x56 px.
   - Format: **WebP** (VP8, quality=85).
2. **Katalog Preset (`src/lib/image.ts`):**
   - Menambahkan preset `compactThumb: { width: 160, height: 160, aspect: '1/1' }` pada `MAGAZINE_IMAGE_PRESETS`.
   - Mengimplementasikan `getCanonicalThumbnailUrl(url?: string): string | null` yang memetakan path R2 kanonikal `/media/images/<filename>` atau `/media/<filename>` ke `/media/thumbnails/<filename>`, mempertahankan origin dan query fallback untuk aset uji external/Unsplash.
3. **Modul Pendukung (`src/components/ArticleSupportModule.astro`):**
   - Menggunakan `getCanonicalThumbnailUrl(link.target_featured_image)` untuk thumbnail gambar pendukung dengan fallback aman ke gambar asli jika resolusi derivatif gagal.
4. **Pencegahan Kegagalan Edge & Cache Safety (`src/pages/media/[...key].ts`):**
   - Cloudflare Workers runtime-safe: derivatif thumbnail di-stream langsung dari R2 dengan header `Cache-Control: public, max-age=31536000, immutable`.
   - Jika derivatif belum ada di R2, endpoint fallback ke gambar penuh dengan header `Cache-Control: no-cache, must-revalidate` dan `X-RL-Thumbnail-Fallback: true` untuk mencegah pencemaran cache (*cache poisoning*).
   - Seluruh transformasi gambar berat dijalankan di lingkungan Node/Python persiapan media dan Worker bertugas murni sebagai penyaji/penyimpan derivatif (zero sharp/native binary dependencies in Worker).
5. **Skrip Pembangkit Derivatif Reproducibel:**
   - `scripts/create-thumbnail-derivatives.py` membangkitkan 5 berkas WebP derivatif ke folder `artifacts/thumbnails/`.

---

## 3. Production R2 Backfill & Object Verification
Kelima objek derivatif WebP 160x160 telah berhasil diunggah ke bucket produksi `rancangloka-media` di bawah kunci `thumbnails/<filename>` dan diverifikasi langsung:
1. `thumbnails/631baf7a25e9986b9f0d01073633cb434ae162b3df1241ddac56b977026276e9.webp`
   - Status: HTTP 200 | Content-Type: `image/webp` | Bytes: 7,256 B | Dimensi: 160x160
2. `thumbnails/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman-8422.webp`
   - Status: HTTP 200 | Content-Type: `image/webp` | Bytes: 9,338 B | Dimensi: 160x160
3. `thumbnails/b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp`
   - Status: HTTP 200 | Content-Type: `image/webp` | Bytes: 5,662 B | Dimensi: 160x160
4. `thumbnails/8ecd77ff40bb4d933e27e44980bcec9ebb040e0cb971de72e5387ff6b463247d.webp`
   - Status: HTTP 200 | Content-Type: `image/webp` | Bytes: 4,628 B | Dimensi: 160x160
5. `thumbnails/4ee0363758a41bd45aae735349028ab19ca6256964c20ec1d98af4e65c578bf4.webp`
   - Status: HTTP 200 | Content-Type: `image/webp` | Bytes: 7,238 B | Dimensi: 160x160

Total ukuran backfill R2: **34.12 KB** (zero data mutasi pada artikel asli atau tabel D1).

---

## 4. Measured Production Payload Optimization Results
- **Artikel 5 Thumbnail:** 166.8 KB $\rightarrow$ **7.09 KB** (7,256 B) [**95.8% reduction**]
- **Artikel 6 Thumbnail:** 148.0 KB $\rightarrow$ **9.12 KB** (9,338 B) [**93.8% reduction**]
- **Artikel 7 Thumbnail:** 193.1 KB $\rightarrow$ **5.53 KB** (5,662 B) [**97.1% reduction**]
- **Artikel 8 Thumbnail:** 146.3 KB $\rightarrow$ **4.52 KB** (4,628 B) [**96.9% reduction**]
- **Artikel 9 Thumbnail:** 218.0 KB $\rightarrow$ **7.07 KB** (7,238 B) [**96.8% reduction**]
- **Total 5 Thumbnail:** 872.1 KB $\rightarrow$ **33.32 KB** (34,122 B) [**96.2% overall savings**, rerata ~6.66 KB per thumbnail].
- **Modul 3 Kartu Artikel 8 (9, 7, 5):**
  - Sebelum: **577.9 KB** (591,740 B)
  - Sesudah: **19.68 KB** (20,156 B)
  - **Pengurangan Bersih:** **-558.2 KB (96.6% bandwidth saving)**.

---

## 5. Production Smoke Test Verification
- **Artikel 5 (`/kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`):**
  - HTTP Status: **200 OK**
  - Kartu Dukungan: **1 kartu** (Artikel 8)
  - Thumbnail URL: `/media/thumbnails/8ecd77ff40bb4d933e27e44980bcec9ebb040e0cb971de72e5387ff6b463247d.webp`
- **Artikel 6 (`/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman`):**
  - HTTP Status: **200 OK**
  - Kartu Dukungan: **1 kartu** (Artikel 9)
  - Thumbnail URL: `/media/thumbnails/4ee0363758a41bd45aae735349028ab19ca6256964c20ec1d98af4e65c578bf4.webp`
- **Artikel 7 (`/jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge`):**
  - HTTP Status: **200 OK**
  - Kartu Dukungan: **2 kartu** (Artikel 8 & Artikel 9)
  - Thumbnail URLs: `/media/thumbnails/8ecd77ff...webp` & `/media/thumbnails/4ee03637...webp`
- **Artikel 8 (`/thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi`):**
  - HTTP Status: **200 OK**
  - Kartu Dukungan: **3 kartu** (Artikel 9, Artikel 7, Artikel 5)
  - Thumbnail URLs: `/media/thumbnails/4ee03637...webp`, `/media/thumbnails/b5cd5019...webp`, `/media/thumbnails/631baf7a...webp`
  - Transferred payload 3 kartu: **19.68 KB**
  - Cache Header: `Cache-Control: public, max-age=31536000, immutable`
  - Fallback Header: `X-RL-Thumbnail-Fallback` tidak ada (direct hit).
- **Artikel 9 (`/memilih-sistem-shading-luar-rumah-tropis`):**
  - HTTP Status: **200 OK**
  - Kartu Dukungan: **2 kartu** (Artikel 8 & Artikel 6)
  - Thumbnail URLs: `/media/thumbnails/8ecd77ff...webp` & `/media/thumbnails/rekayasa-ventilasi-silang...webp`

---

## 6. Visual Smoke Verification
- **Desktop (1366x900):** Terverifikasi bersih via browser automation. Thumbnail 80x80 px merender tajam tanpa distorsi, judul tetap dominan, alasan redaksi terbaca jelas, zero layout overflow, tampilan editorial premium tenang (*quiet premium editorial*).
- **Mobile (390x844):** Terverifikasi responsif, thumbnail 56x56 px, tata letak teks rapi, zero horizontal scroll, zero CLS.
- **Integritas Gambar:** Zero broken images, zero missing assets.

---

## 7. Invariant & Regression Verification
- **Zero Client JS:** Tetap SSR statis murni, zero hydration overhead.
- **Layout Stability:** Explicit `width="80"`, `height="80"` (desktop) / `width="56"`, `height="56"` (mobile), `aspect-ratio: 1/1` (CLS = 0).
- **Aksesibilitas:** `alt=""` dan `aria-hidden="true"` pada thumbnail dekoratif terjaga penuh.
- **Graf Semantik Produksi:**
  - `PLANE_A_DYNAMIC` ACTIVE = **9**
  - `PLANE_B_INLINE` = **0**
  - `orphan_article_count` = **0**
  - Seluruh relasi semantik dan alasan redaksi utuh tanpa mutasi.
- **Integritas Naskah & Kriptografi:**
  - Artikel C draft & live SHA-256: `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28` 100% utuh tanpa mutasi.
  - Artikel 5, 6, 7, 8 hashes terverifikasi identik di D1 produksi.
- **Invarian Keselamatan:**
  - `automation_mode` = `OFF`
  - `SOCIAL_AUTOMATION` = `OFF`
  - `AUTO_PUBLISH` = `OFF`
  - `publishingAuthority` = `0`
  - `JEV_MODE` = `shadow`
  - `autonomous media worker` = `DISABLED`
  - `autonomous publishing` = `OFF`
