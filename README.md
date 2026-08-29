# 📰 Metro Magazine - Cloudflare Serverless Platform

Platform blog dan portal berita bergaya **Magazine** modern yang berjalan **100% Gratis di atas ekosistem Serverless Cloudflare** (Cloudflare Pages, Cloudflare D1 SQL Database, dan Cloudflare R2 Object Storage).

Dibangun dengan arsitektur **Mobile-First (App-like UX)**, mematuhi standar **SEO 2026**, dilengkapi **Theme Color Customizer (Anti-FOUC)**, **Smart Markdown Importer dengan Deteksi Duplikat**, dan **Admin CMS Dashboard ala WordPress**.

---

## 🌟 Fitur Utama

- 📱 **Mobile-First & App-like Navigation:**
  - Floating Bottom Navigation Bar (Home, Search, Topics, Quick Share / TOC).
  - Horizontal Swipeable Category Pills yang nyaman digeser dengan jempol.
  - Instant Search Modal (Ctrl + K) dengan pencarian secepat kilat.
- 📰 **Rich Magazine Layout:**
  - Hero Section (1 Featured Story Besar + 3 Side Articles).
  - Bento Grids per Kategori & Breaking News Running Ticker.
- 🚀 **SEO 2026 Built-in On-Build:**
  - Schema.org JSON-LD (NewsArticle, BreadcrumbList, E-E-A-T Person/Author, Organization, WebSite).
  - Breadcrumbs otomatis & Table of Contents (Daftar Isi) interaktif dengan accordion di HP.
  - **Key Takeaways / AI Summary Box** (format kutipan utama untuk Google AI Overviews & ChatGPT Search).
  - Paginasi **Sitemap Index** terbagi (`/sitemap.xml`, `/sitemap-posts-1.xml`, `/sitemap-news.xml` Google News 48 Jam).
  - Dynamic RSS Feed (`/rss.xml`).
- 🎨 **Theme Engine Customizer:**
  - Ubah warna tema langsung dari menu Admin (Preset Classic Editorial, Cyber Tech, Breaking News, Creative Violet) + Custom Color Hex Picker.
  - Injeksi langsung di `<head>` (Anti-FOUC / bebas kedipan putih saat dibuka).
- 📥 **Smart Markdown Importer:**
  - Drag & Drop upload file `.md` satuan atau massal.
  - **Multi-Layer Duplicate Detection:** Pengecekan Slug + SHA-256 Content Fingerprint (Pilihan: *Skip*, *Overwrite*, atau *Auto-rename*).
  - **Auto Dimension & Crop Cover Image:** 16:9 WebP multi-resolution responsive ke R2.
- ✍️ **Admin Dashboard CMS (`/admin`):**
  - All Posts management dengan filter, status (Publish/Draft), dan pencarian.
  - Dual-Mode Editor (Visual WYSIWYG & Markdown Split Preview).
  - Live Google Search SERP Preview Box.
  - 1-Klik Backup Database ke file JSON.

---

## 🛠️ Tech Stack

- **Framework:** Astro (v4/v5) + `@astrojs/cloudflare`
- **Styling:** Tailwind CSS + CSS Custom Properties
- **Database:** Cloudflare D1 (Serverless SQLite on Edge)
- **Media Storage:** Cloudflare R2 (S3-compatible Object Storage, 0 Egress)
- **CDN & Compute:** Cloudflare Pages & Workers

---

## 🚀 Panduan Menjalankan Lokal

```bash
# 1. Masuk ke direktori
cd cloudflare

# 2. Install dependencies (jika belum)
npm install

# 3. Jalankan development server
npm run dev
```

Buka browser di `http://localhost:4321` untuk melihat halaman publik magazine, dan `http://localhost:4321/admin` untuk membuka Dashboard CMS (Login default: `admin` / `admin123`).

---

## ☁️ Panduan Deploy ke Cloudflare Pages & D1

### Langkah 1: Buat Database D1 di Cloudflare
Jalankan perintah berikut di terminal:
```bash
npx wrangler d1 create magazine_blog_db
```
Salin `database_id` yang muncul ke file `wrangler.toml`.

### Langkah 2: Inisialisasi Skema Database
```bash
npx wrangler d1 execute magazine_blog_db --file=./db/schema.sql
```

### Langkah 3: Deploy ke Cloudflare Pages
```bash
npm run build
npx wrangler pages deploy dist
```

---

## 🐙 Panduan Upload / Push ke GitHub

Untuk mengunggah seluruh project ini ke repository GitHub Anda:

```bash
# 1. Inisialisasi Git
git init

# 2. Tambahkan seluruh file
git add .

# 3. Buat commit pertama
git commit -m "feat: initial commit cloudflare magazine blog platform seo 2026"

# 4. Buat branch main
git branch -M main

# 5. Hubungkan ke repository GitHub Anda (ganti URL dengan repo Anda)
git remote add origin https://github.com/USERNAME_ANDA/NAMA_REPO_ANDA.git

# 6. Push ke GitHub
git push -u origin main
```

---

© 2026 Metro Magazine. Powered 100% by Cloudflare Serverless.
