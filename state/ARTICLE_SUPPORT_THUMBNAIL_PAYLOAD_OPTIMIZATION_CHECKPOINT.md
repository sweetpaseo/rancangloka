# 🧭 RancangLoka — Article Support Thumbnail Payload Optimization Checkpoint

**Tanggal:** 2026-10-15T16:50:00+07:00  
**Status Operasional:** `ARTICLE_SUPPORT_THUMBNAIL_PAYLOAD_OPTIMIZED`  
**Branch Aktif:** `feat/jev-lokamedia-integration`  
**Commit:** `39078ef` (`perf(media): add compact derivatives for article support thumbnails`)  
**Klasifikasi:** `READY_FOR_THUMBNAIL_PRODUCTION_AUTHORIZATION`

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
4. **Pencegahan Kegagalan Edge (`src/pages/media/[...key].ts`):**
   - Menambahkan mekanisme fallback cerdas di Cloudflare Workers: jika objek `thumbnails/<filename>` belum diunggah ke bucket R2, endpoint secara otomatis mencari dan mengalirkan gambar asli `images/<filename>`.
   - Menjamin **zero broken images** saat masa transisi atau proses backfill bertahap.
5. **Skrip Pembangkit Derivatif Reproducibel:**
   - `scripts/create-thumbnail-derivatives.py` membangkitkan 5 berkas WebP derivatif ke folder `artifacts/thumbnails/`.

---

## 3. Measured Payload Optimization Results
- **Artikel 5 Thumbnail:** 166.8 KB $\rightarrow$ **7.09 KB** (7,256 B) [**95.8% reduction**]
- **Artikel 6 Thumbnail:** 148.0 KB $\rightarrow$ **9.12 KB** (9,338 B) [**93.8% reduction**]
- **Artikel 7 Thumbnail:** 193.1 KB $\rightarrow$ **5.53 KB** (5,662 B) [**97.1% reduction**]
- **Artikel 8 Thumbnail:** 146.3 KB $\rightarrow$ **4.52 KB** (4,628 B) [**96.9% reduction**]
- **Artikel 9 Thumbnail:** 218.0 KB $\rightarrow$ **7.07 KB** (7,238 B) [**96.8% reduction**]
- **Total 5 Thumbnail:** 872.1 KB $\rightarrow$ **33.32 KB** (34,122 B) [**96.2% overall savings**, rerata ~6.66 KB per thumbnail, melampaui target $\le$ 25 KB].
- **Modul 3 Kartu Artikel 8 (9, 7, 5):**
  - Sebelum: **577.9 KB** (591,740 B)
  - Sesudah: **19.68 KB** (20,156 B)
  - **Pengurangan Bersih:** **-558.2 KB (96.6% bandwidth saving)**.

---

## 4. Production Backfill Plan (Ready for Authorization)
- Berkas derivatif WebP telah tersedia di `artifacts/thumbnails/`:
  1. `thumbnails/631baf7a25e9986b9f0d01073633cb434ae162b3df1241ddac56b977026276e9.webp`
  2. `thumbnails/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman-8422.webp`
  3. `thumbnails/b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp`
  4. `thumbnails/8ecd77ff40bb4d933e27e44980bcec9ebb040e0cb971de72e5387ff6b463247d.webp`
  5. `thumbnails/4ee0363758a41bd45aae735349028ab19ca6256964c20ec1d98af4e65c578bf4.webp`
- **Tindakan Produksi Pasca-Otorisasi:** Unggah 5 berkas ke R2 bucket `rancangloka-media` via Wrangler CLI. Zero migrasi skema D1.
- **Dampak Penyimpanan R2:** Hanya menambahkan **34.12 KB** (~0.034 MB) pada R2.

---

## 5. Invariant & Regression Verification
- **Zero Client JS:** Tetap SSR statis murni, zero hydration.
- **Layout Stability:** Explicit `width="80"`, `height="80"`, `aspect-ratio: 1/1` (CLS = 0).
- **Aksesibilitas:** `alt=""` dan `aria-hidden="true"` pada thumbnail dekoratif tetap terjaga.
- **Graf Semantik:** 9 hubungan Plane A aktif, 0 inline Plane B, alasan pembaca utuh.
- **Integritas Hash Naskah:** Hash Artikel C `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28` terverifikasi 100% identik.
- **Hasil Pengujian Otomatis:**
  - `node scripts/test-internal-link-engine.js`: 26/26 PASS.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run build`: Sukses (7.49s).
  - `git diff --check`: 0 errors.
