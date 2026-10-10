# 📋 RancangLoka — Checkpoint LOKAMEDIA-ARTICLE-IDENTITY-AUDIT-1 & FEATURED-MEDIA-PROMOTE-ARTICLE-A-2
## Article Identity Resolution, 1315x660 Derivative Generation, and Cloudflare Ingestion Invariants

> **Checkpoint ID:** `LOKAMEDIA-ARTICLE-IDENTITY-AND-MEDIA-PROMOTION-A2-CHECKPOINT-20261007`  
> **Timestamp:** `2026-10-07T23:25:00+07:00`  
> **Branch:** `feat/jev-lokamedia-integration`  
> **Canonical Extension Version:** `0.1.5`  
> **Target Job:** `mjob_9654a1ff6c242ce49711a664` (*Article A Featured Visual*)  
> **Classifications:**  
> - `LOKAMEDIA_IDENTITY_AUDIT_PASS` (Forensic verification of Article ID 7 identity and topic)  
> - `PRODUCTION_MEDIA_UPLOAD_BLOCKED` (Fail-closed hold due to expired Wrangler OAuth session)  
> **Safety State:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, Zero Unauthorized Remote D1/R2 Mutations.

---

## 1. Ringkasan Eksekutif & Investigasi Anomali Identitas (Audit 1)

### A. Rekonsiliasi Anomali Judul ("Mengenal Bata Ringan AAC")
- **Isu:** Laporan operasional UX-2 sebelumnya menyebutkan bahwa `mjob_9654a1ff6c242ce49711a664` terasosiasi dengan judul *"Mengenal Bata Ringan AAC: Ukuran, Karakteristik, dan Alasan Populer di Proyek Modern"*.
- **Akar Masalah (Root Cause):** Ditemukan bahwa string tersebut berasal dari fixture tiruan (*synthetic test mock*) pada file pengujian `scripts/test-lokamedia-operator-ux-2.js` yang secara keliru dikutip ke laporan pengujian.
- **Hasil Audit Database Riil:**
  - Pada Local D1 dan Production D1, `id = 7` secara konsisten mereferensikan artikel:  
    **"Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?"**
  - Slug: `jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge`
  - Content Hash: `00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298`
  - Tidak ada artikel Bata Ringan di database lokal maupun produksi (`HTTP 404`).
  - Job prompt dan visual terbukti 100% spesifik untuk kondensasi jendela aluminium residensial.
  - Klasifikasi: **`LOKAMEDIA_IDENTITY_AUDIT_PASS`**.

### B. Aturan Penargetan Aman (*Safe Targeting Rule*)
- Dilarang menggunakan *naked numeric ID* lintas lingkungan (lokal vs produksi).
- Penargetan media diwajibkan melalui resolusi slug kanonikal terlebih dahulu (`jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge`).
- Dilanjutkan dengan atestasi 4 poin: slug match, title match, content hash match, dan publication status match sebelum mutasi apa pun.

---

## 2. Integritas Binary & Pembuatan Derivatif 1315×660 (Promote A-2)

### A. Integritas Sumber Binary
- **Path Storage Lokal:** `.wrangler/state/v3/r2/rancangloka-media/blobs/1b8d90dd98fe44a1f77d6048df72afdba607cf710ca406502e023e69c5a1539f000001a1169dbb7b`
- **Ukuran Asli:** `2,623,727` bytes (1770 × 889 PNG)
- **SHA-256 Terverifikasi:** `cb5c343af17ef91b13e63c23a818604040512ad6a79282ffd3d1c2520c956144` (100% cocok dengan rekaman run LokaMedia `run_1791380727041_abddb752`).

### B. Derivatif Standar Editorial (1315 × 660 WebP)
- **Rasio Aspek:** Asli 1.9910 : 1 vs Target 1.9924 : 1.
- **Geometri Pemotongan:** Hanya 0.63px tinggi dipotong secara simetris (`crop_box: (0, 0.32, 1770, 888.68)`), mempertahankan komposisi arsitektural tanpa distorsi.
- **Hasil Kompresi & Kualitas:**
  - File: `artifacts/cover-1315x660.webp`
  - Dimensi: `1315 × 660` px
  - Format: `image/webp`
  - Ukuran: `197,762` bytes
  - SHA-256: `b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4`
- **Rantai Provenans:**
  `cb5c343af17ef91b13e63c23a818604040512ad6a79282ffd3d1c2520c956144` (SOURCE)  
  $\to$ `b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4` (DERIVATIVE 1315x660)

---

## 3. Investigasi Autentikasi Cloudflare & Status Upload Produksi

### A. Kondisi Sesi Wrangler OAuth
- Saat eksekusi remote D1 / R2 dicoba, Wrangler CLI melempar error:
  `Failed to fetch auth token: 400 Bad Request`
  `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.`
- Investigasi pada `C:\Users\Fanto\AppData\Roaming\xdg.config\.wrangler\config\default.toml` mendapati:
  - `expiration_time = "2026-10-07T04:24:48.821Z"` (Sesi telah kedaluwarsa ~11.5 jam sebelumnya).
  - Refresh token OAuth Cloudflare ditolak dengan HTTP 400.

### B. Penegakan Prinsip Fail-Closed (*No Fabricated Success*)
- Sesuai dengan instruksi keselamatan mutlak (*"Do NOT fabricate success if upload fails"*):
  - Upload ke production R2 dihentikan dengan status **`PRODUCTION_MEDIA_UPLOAD_BLOCKED`**.
  - Database produksi D1 tidak dimutasi (nol dangling assets, nol relasi prematur).
  - Placeholder lama (`/media/images/631baf7a25e9986b9f0d01073633cb434ae162b3df1241ddac56b977026276e9.webp`) tetap aktif di rute publik `https://rancangloka.com/jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge`.
  - Naskah artikel dan `content_hash` tetap `00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298` (100% utuh).
  - Artikel B tetap tidak disentuh.

---

## 4. Langkah Lanjutan Saat Unblocking
Setelah operator memperbarui sesi Cloudflare via `npx wrangler login` atau menyetel `CLOUDFLARE_API_TOKEN`:
1. Upload `artifacts/cover-1315x660.webp` ke R2 produksi dengan key:  
   `media/images/b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp`
2. Daftarkan rekaman `media_assets` dengan metadata provenans di D1 produksi.
3. Repoint `articles.featured_image`, `articles.image_alt`, dan `article_media(role='featured')` untuk Artikel 7.
4. Verifikasi live render di `https://rancangloka.com/jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge`.
