# 📜 History & Progress Catatan Proyek Rancangloka

Dokumen ini mencatat seluruh riwayat permasalahan, akar penyebab, solusi teknis yang telah diterapkan, serta status progres terkini dari platform media editorial **Rancangloka**.

---

## 🏗️ 1. Arsitektur & Spesifikasi Proyek
* **Framework:** Astro 4 (SSR Mode dengan `@astrojs/cloudflare` adapter)
* **Styling:** Tailwind CSS (Apple Minimalist Aesthetic & Dark Mode Support)
* **Compute & Hosting:** Cloudflare Workers CI / Cloudflare Edge Runtime
* **Database (Relational):** Cloudflare D1 (SQLite Edge) — Database: `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`)
* **Object Storage:** Cloudflare R2 Bucket — `rancangloka-media`
* **Keamanan:** Kriptografi PBKDF2 SHA-256 (100.000 iterasi) + Cloudflare Zero Trust (Access)
* **SEO & Performa:** Skor PageSpeed 90-100 (Google News Sitemap, RSS XML, Schema.org, WCAG AA Contrast)

---

## 🛠️ 2. Log Masalah & Solusi (Problem & Resolution History)

### Masalah 1: Build Error 10000 (Authentication Error) pada Cloudflare Pages
* **Gejala:** Deploy gagal dengan error `Authentication error [code: 10000]`.
* **Penyebab:** Pada dashboard Cloudflare, opsi *Build command* terisi perintah deployment `npx wrangler pages deploy dist` alih-alih perintah kompilasi `npm run build`.
* **Solusi:** 
  - Mengubah konfigurasi build dashboard menjadi:
    - **Build command:** `npm run build`
    - **Deploy command:** `npx wrangler deploy`

---

### Masalah 2: Wrangler Assets Leaking Error (`_worker.js`)
* **Gejala:** Deploy gagal pada tahap deploying dengan pesan `Uploading a Pages _worker.js directory as an asset. This could expose your private server-side code...`.
* **Penyebab:** Wrangler memvalidasi folder `dist` dan menemukan direktori server `_worker.js` saat menyiapkan static assets.
* **Solusi:**
  - Membuat file [`.assetsignore`](file:///.assetsignore) dan [`public/.assetsignore`](file:///public/.assetsignore) berisi:
    ```text
    _worker.js
    _routes.json
    ```

---

### Masalah 3: D1 Database Validation Error 10021
* **Gejala:** Deploy terhenti dengan error `binding DB of type d1 must have a valid database_id specified [code: 10021]`.
* **Penyebab:** `wrangler.toml` masih menggunakan placeholder `your-d1-database-id-here`.
* **Solusi:**
  - Membuat database D1 `rancangloka_db` di Cloudflare Dashboard.
  - Memasukkan ID asli `3a86e9ad-410f-4440-884e-2eb813ec4cf7` ke [`wrangler.toml`](file:///wrangler.toml).
  - Membuat bucket R2 `rancangloka-media` untuk penyimpanan media.

---

### Masalah 4: Query Malformed Error pada D1 Web Console
* **Gejala:** Eksekusi skema SQL di D1 Console menghasilkan error `The request is malformed: Requests without any query are not supported`.
* **Penyebab:** Parser D1 Web Studio menolak baris komentar SQL (`-- ...`) dan baris kosong.
* **Solusi:**
  - Menyusun ulang query SQL bersih tanpa komentar untuk pembuatan tabel (`categories`, `authors`, `articles`, `settings`, `users`, `sessions`) dan seed data awal. Seluruh tabel berhasil dibuat dan terverifikasi.

---

### Masalah 5: Gambar Artikel Rusak / 404
* **Gejala:** Gambar artikel *7 Trik Menata Kamar Tidur Minimalis* tidak muncul pada kartu web.
* **Penyebab:** Link aset dari Unsplash lama tidak lagi tersedia di CDN.
* **Solusi:**
  - Mengganti URL gambar kamar tidur Japandi aktif di [`src/lib/db.ts`](file:///src/lib/db.ts).
  - Menambahkan proteksi otomatis `onerror="this.onerror=null;this.src='...'"` di seluruh kartu artikel sehingga website tidak akan pernah menampilkan icon gambar rusak jika ada CDN luar yang bermasalah.

---

### Masalah 6: Header Freeze / Menempel Saat Halaman Di-scroll
* **Gejala:** Header dan logo besar tetap mengunci di atas layar dan memakan ruang baca.
* **Penyebab:** Class CSS `sticky top-0` pada elemen `<header>`.
* **Solusi:**
  - Mengubah class `<header>` menjadi `relative` di [`src/components/Header.astro`](file:///src/components/Header.astro) sehingga header bergeser dan menghilang secara natural saat halaman di-scroll ke bawah.

---

### Masalah 7: Optimasi Core Web Vitals & PageSpeed Insights
* **Gejala:** Skor Performance awal 89 dengan waktu muat tertahan oleh font dan gambar berukuran 1200px pada layar mobile.
* **Penyebab:** `@import` font di dalam file CSS memblokir proses rendering (render-blocking ~1.670 ms), gambar artikel terlalu berat, dan teks abu-abu terang tidak lulus kontras rasio WCAG AA.
* **Solusi:**
  - Menghapus `@import` dari `global.css`.
  - Menambahkan `preconnect` DNS untuk Google Fonts dan Unsplash.
  - Memuat Google Fonts secara asinkron non-blocking (`media="print" onload="this.media='all'"`).
  - Mengoptimasi parameter kompresi gambar Unsplash (`w=720&q=75&auto=format`).
  - Menyesuaikan kontras warna teks menjadi `text-slate-600` / `text-slate-700` (WCAG AA Compliant).
  - Menambahkan atribut unik `aria-label` pada tombol navigasi kategori.
  - **Hasil:** Skor naik menjadi **Performance 90+**, **Best Practices 100**, **SEO 100**, **Agentic 2/2**.

---

## 📍 3. Status Terkini (Current Milestone Progress)

| Komponen | Status | Catatan |
|---|---|---|
| **Aplikasi Web & UI** | ✅ Selesai (Live) | Layout Apple-aesthetic, responsive, dark mode, dynamic styling. |
| **Kompilasi & Deployment** | ✅ Selesai (Live) | Berjalan otomatis via Cloudflare Workers CI dari branch `main`. |
| **D1 Database & Skema** | ✅ Selesai (Aktif) | 6 tabel inti dan data seed awal kategori & penulis sudah aktif. |
| **R2 Storage** | ✅ Selesai (Aktif) | Bucket `rancangloka-media` siap menampung gambar cover dan upload. |
| **SEO & Feed** | ✅ Selesai | Google News XML, Sitemap XML, RSS feed, Schema.org aktif. |
| **Keamanan Level Kode** | ✅ Selesai | Hashing PBKDF2, session token acak 24-byte, SQL parameterization. |
| **Cloudflare Zero Trust (Access)** | ✅ Selesai (Aktif) | Proteksi OTP email `chandrajoyko@gmail.com` aktif untuk rute `/admin*`. |
| **Custom Domain** | ⏳ Siap Dipasang | Menunggu pengguna menghubungkan domain kustom via tab *Domains*. |

---

## 🔑 4. Panduan Kredensial & Akses Admin (Credentials & Access Guide)

1. **Lapis 1 — Cloudflare Zero Trust (Access Edge Security):**
   - URL: `https://rancangloka.chandrajoyko.workers.dev/admin`
   - Otorisasi: Verifikasi kode OTP 6-digit via email `chandrajoyko@gmail.com`.
2. **Lapis 2 — CMS Admin Portal:**
   - Email: `admin@rancangloka.com`
   - Default Password: `Admin@RancangLoka2026!`
   - Fitur Tersedia: Manajemen posting artikel, kategori bento/3-col, author EEAT, SEO settings, dan upload gambar R2.

