# Astro 7 Production Release Plan

Dokumen operasional rencana rilis produksi (production release) dan pemulihan darurat (rollback plan) untuk upgrade framework Astro 7 pada RancangLoka.

---

## 1. Release Identity

- **Repository:** `C:\Users\Fanto\Desktop\antigravity\rancangloka\rancangloka-astro`
- **Target Branch:** `main`
- **Application Release Candidate Checkpoint:** `b12d064725ef3a29e5a1b7fd1acf7ace23491865` (`b12d064`)
- **Final Release Documentation Checkpoint:** `e8954beeee215c3e95084aceb9ce9c976ef403e9` (`e8954be`)
- **Cloudflare Deployed Version ID:** `dfbd3ae4-2341-4776-90e4-080949f8d56a`
- **Deployed Timestamp:** 2026-09-19 10:21:18 WIB (03:21:18 UTC)
- **Deployment Status:** SUCCESS (Live pada `https://rancangloka.com`)
- **Framework Versions:**
  - Astro: `^7.3.3` (7.3.3)
  - @astrojs/cloudflare: `^14.3.2` (14.3.2)
  - TypeScript: `^5.9.2` (5.9.3)
  - Wrangler: `^4.133.0` (4.133.0)
- **Publication Invariants (Locked):**
  - `AUTO_PUBLISH = OFF`
  - `MEDIA_CAN_PUBLISH = NO`
  - Article 6 manual publication authority preserved

> **Catatan Distingsi Checkpoint:**
> - `APPLICATION_RELEASE_CHECKPOINT = b12d064` adalah checkpoint kode aplikasi final yang telah lulus browser release gate dan verifikasi CSS.
> - `FINAL_RELEASE_DOCUMENTATION_CHECKPOINT = e8954be` adalah checkpoint dokumentasi komprehensif yang di-push sebelum deploy.
> - Produksi aktif saat ini berjalan pada Version ID `dfbd3ae4-2341-4776-90e4-080949f8d56a`.

---

## 2. Pre-deploy Gate

Sebelum deployment produksi dijalankan di masa mendatang, seluruh gate berikut wajib berstatus PASS:

1. **Worktree Clean:** `git status --short` tidak memiliki modifikasi tak terduga.
2. **HEAD Known:** Berada pada branch `main` pada commit dokumentasi final.
3. **Diff Check:** `git diff --check` PASS (zero whitespace / conflict errors).
4. **Automated Build Gate:** `npm run build` PASS (server bundle & client assets terkompilasi).
5. **CSS Regression Guard Gate:** `npm run test:css-delivery` PASS (manifest terhubung ke `global.*.css`, 4 CSS assets, utility Tailwind terverifikasi).
6. **Browser Release Gate:** Lulus verifikasi visual browser lokal (masthead, bento card, typography, search icon normal).
7. **No Release Blockers:** `RELEASE_BLOCKERS = NONE`, `SHOULD_FIX_BEFORE_RELEASE = NONE`.
8. **Production Credentials:** Kredensial Cloudflare Worker & akses API tersedia bagi operator.
9. **Publication Invariants Confirmed:** `AUTO_PUBLISH=OFF` dan `MEDIA_CAN_PUBLISH=NO` terverifikasi.
10. **Explicit Human Deploy Approval:** Operator manusia telah memberikan instruksi persetujuan eksplisit untuk deploy.

---

## 3. Git Push Procedure

Prosedur pengunggahan branch rilis ke remote GitHub (hanya dijalankan setelah persetujuan rilis eksplisit):

```bash
# Pastikan berada di branch main dan worktree bersih
git checkout main
git status --short

# Dorong commit ke remote repository
git push origin main
```

*(Catatan: Jangan eksekusi perintah ini pada tahap persiapan/perencanaan saat ini).*

---

## 4. Production Deploy Procedure

Perintah kanonikal untuk membangun dan merilis worker ke Cloudflare:

```bash
# Canonical deployment command
npm run deploy
```

Perintah di atas menjalankan `astro build && wrangler deploy`.

*(Catatan: Jangan eksekusi perintah ini pada tahap persiapan/perencanaan saat ini).*

---

## 5. Production Smoke Test

Setelah deploy produksi selesai, operator atau agen verifikasi wajib memeriksa rute-rute produksi berikut di domain `https://rancangloka.com`:

### Target Rute & Validasi Status
- `https://rancangloka.com/` (HTTP 200)
- `https://rancangloka.com/rumah-tropis-yang-tidak-takut-matahari` (HTTP 200, artikel representatif)
- `https://rancangloka.com/editorial-standards` (HTTP 200)
- `https://rancangloka.com/solusi` (HTTP 200)
- `https://rancangloka.com/komparasi` (HTTP 200)
- `https://rancangloka.com/metodologi` (HTTP 200)
- `https://rancangloka.com/api/search.json` (HTTP 200, JSON valid, Cache-Control public)
- `https://rancangloka.com/robots.txt` (HTTP 200)
- `https://rancangloka.com/sitemap.xml` (HTTP 200)
- `https://rancangloka.com/admin` (HTTP 302 / redirect ke `/admin/login`)

### Aspek Validasi Kritis
- **HTTP Status:** 200 OK untuk seluruh rute publik, 302 untuk admin unauthenticated.
- **Visual Styling & CSS:** Seluruh styling CSS terpasang, grid & kartu rapi, masthead & footer utuh.
- **JavaScript Interactions:** Search modal berfungsi, TOC navigasi responsif, dialog/filter aktif.
- **Images & Assets:** Seluruh gambar hero dan ikon Lucide ter-render tanpa broken image.
- **Search API:** Mengembalikan JSON index artikel secara cepat dengan caching publik 60s/300s.
- **SEO & Meta:** OpenGraph tags, canonical link, dan JSON-LD schema terverifikasi.
- **Cache Headers:** Public HTML `no-cache, no-store, must-revalidate`, private admin route `no-cache` + `noindex`.
- **Admin Auth Safety:** Rute `/admin` terlindungi OTP / auth guard Cloudflare.

---

## 6. CSS Critical Verification

Karena migrasi Astro 7 sebelumnya sempat mengalami insiden CSS delivery (akibat `inlineStylesheets: "always"` pada SSR), smoke test produksi WAJIB memvalidasi secara eksplisit:

1. **Application Stylesheet Link Exists:** Tag `<link rel="stylesheet" href="/assets/global.*.css">` terdeteksi di dalam `<head>` HTML produksi.
2. **Stylesheet Returns HTTP 200:** Asset CSS dapat diunduh via HTTP GET dengan status 200 OK.
3. **Content-Type text/css:** Header respons asset CSS memiliki `Content-Type: text/css; charset=utf-8`.
4. **Stylesheet is Non-Empty:** Ukuran asset CSS di atas 70 KB (memuat utility Tailwind lengkap).
5. **Layout is Visually Styled:** Halaman tidak tampak seperti raw HTML; tipografi Outfit / Plus Jakarta Sans aktif.
6. **Search Icon Normal Size:** Ikon pencarian dan navigasi memiliki dimensi proporsional (bukan giant SVG).
7. **No Raw HTML Appearance:** Elemen halaman tidak berantakan atau bertumpuk vertikal tanpa layout.

---

## 7. Publication Safety

Invarian keamanan publikasi yang terkunci:

- `AUTO_PUBLISH = OFF`
- `MEDIA_CAN_PUBLISH = NO`
- Otoritas publikasi artikel tetap berada pada operator manusia.
- Artikel 6 yang sebelumnya telah dipublikasikan secara manual tetap dipertahankan.
- Deploy Astro 7 TIDAK BOLEH mengaktifkan otomatisasi publikasi apa pun.

---

## 8. Rollback Baseline

Jika terjadi insiden kritis pasca-deploy, sistem dapat dipulihkan ke baseline rilis produksi stabil sebelumnya:

- **Worker Name:** `rancangloka`
- **Production Domain:** `rancangloka.com`
- **Previous Production Version ID:** `1322e6ff-2c98-4c2e-8850-4af14bb40f9f`
- **Previous Production Git Commit:** `c13b0f505195ca0c34751f5c681012b08830134f`

---

## 9. Rollback Triggers

Rollback darurat wajib segera dipertimbangkan atau dipicu jika salah satu kondisi berikut ditemukan di produksi:

1. **Widespread 5xx Errors:** Rute utama (`/` atau artikel) menghasilkan HTTP 500 / 502 / 503 berkelanjutan.
2. **Homepage Failure:** Halaman utama gagal dimuat atau crash pada worker runtime.
3. **CSS Missing / Raw HTML:** Asset CSS publik gagal di-serve atau terjadi regresi tampilan raw HTML.
4. **Severe Layout Regression:** Kerusakan parah pada rendering UI yang menghalangi keterbacaan artikel.
5. **Admin Inaccessible:** Admin CMS tidak dapat diakses sama sekali oleh operator terotorisasi.
6. **D1 Incompatibility:** Query D1 SQLite gagal dieksekusi oleh Worker runtime produksi.
7. **Severe JS/Runtime Crashes:** Uncaught runtime exceptions yang melumpuhkan fungsionalitas inti.
8. **Publication Invariant Violation:** `AUTO_PUBLISH` aktif tanpa sengaja atau artikel termutasi tanpa izin.
9. **Unexpected Automated Publication:** Ditemukan operasi otomatisasi media atau publikasi liar.

---

## 10. Rollback Procedure

```text
ROLLBACK_COMMAND_REQUIRES_OPERATOR_CONFIRMATION
```

Prosedur pemulihan versi produksi:

1. **Opsi Cepat (Cloudflare Dashboard / Deployments):**
   - Buka Cloudflare Dashboard -> Workers & Pages -> Worker `rancangloka` -> Deployments.
   - Temukan Version ID `1322e6ff-2c98-4c2e-8850-4af14bb40f9f` (commit `c13b0f5`).
   - Pilih opsi *Rollback / Revert to this version*.
2. **Opsi CLI (Memerlukan Konfirmasi Operator):**
   - Jalankan perintah rollback spesifik Wrangler sesuai persetujuan operator:
     `npx wrangler rollback --version 1322e6ff-2c98-4c2e-8850-4af14bb40f9f`
     *(Konfirmasikan ketersediaan sintaks perintah ini dengan operator sebelum eksekusi).*
3. **Opsi Git Re-deploy (Fallback):**
   - Checkout commit produksi stabil sebelumnya:
     `git checkout c13b0f505195ca0c34751f5c681012b08830134f`
   - Bangun dan deploy ulang:
     `npm run deploy`
   - Verifikasi status pemulihan di domain produksi.

---

## 11. Post-deploy Observation

Setelah deployment selesai dan smoke test awal PASS, lakukan observasi sistem selama minimal 15–30 menit:

- **Worker Errors & Logs:** Pantau real-time telemetry / tail logs via `wrangler tail rancangloka` untuk mendeteksi runtime exceptions tersembunyi.
- **Public Routes:** Lakukan random sampling pada 5 artikel publik berbeda.
- **CSS / Assets CDN Caching:** Pastikan asset `/assets/*.css` dan `/assets/*.js` di-cache dengan benar oleh Cloudflare Edge.
- **Search API Performance:** Pastikan endpoint `/api/search.json` merespons dalam < 200ms dengan cache hit.
- **Admin Authentication:** Uji login dan pastikan session token valid.
- **Publication Invariants:** Pastikan tabel artikel tidak mengalami perubahan `status` yang tidak diinginkan.

---

## 12. Post-release Improvements (Non-Blocking Backlog)

Daftar peningkatan kualitas pasca-rilis yang telah diidentifikasi dan TIDAK menghambat rilis:

1. **Accessible Labels (Search):** Menambahkan atribut `aria-label="Pencarian artikel"` atau label eksplisit pada elemen input pencarian.
2. **Accessible Labels (Newsletter):** Menambahkan `aria-label="Alamat email"` pada input newsletter di footer.
3. **Single H1 Article Page:** Menyesuaikan kontainer branding/logo pada layout artikel agar judul artikel menjadi satu-satunya elemen `<h1>`.
4. **Image Attributes Consistency:** Menyempurnakan konsistensi atribut `width`, `height`, `srcset`, dan `sizes` pada elemen gambar artikel sekunder.
5. **Sitemap Query Optimization:** Mengoptimalkan query `COUNT(*)` pada endpoint generator sitemap.
6. **Inline Script Consolidation:** Mengonsolidasikan script utilitas publik inline ke dalam modul terpisah.
