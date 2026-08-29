# Product Requirement Document (PRD)
## Project: Cloudflare Serverless Magazine Blog Platform (Mobile-First, SEO 2026 Ready, 100% Free Tier)

---

## 1. Executive Summary & Objective
Membangun platform blog/portal berita bergaya **Magazine** modern yang beroperasi **100% di atas ekosistem Serverless Free-Tier Cloudflare** (Cloudflare Pages, Cloudflare D1 SQL Database, dan Cloudflare R2 Object Storage).

Platform ini dirancang dengan pendekatan **Mobile-First (App-like UX)** di smartphone dan **Rich Multi-column Magazine** di desktop, mematuhi standar **SEO 2026** (Core Web Vitals 100/100, AI Search Generative Optimization, Schema.org E-E-A-T, Paginated Sitemap Index), dilengkapi **Theme Engine Customizer**, **Smart Markdown Importer with Duplicate Detection**, serta **WordPress-style Admin CMS**.

---

## 2. Core Personas & Target Users
1. **Readers / Pembaca (Mobile & Desktop):** Menikmati pengalaman membaca berita yang instan, navigasi ala aplikasi di HP, dark mode otomatis, dan konten relevan.
2. **Blog Admin / Editor:** Mengelola artikel melalui editor visual (WYSIWYG) atau Markdown, mengimpor puluhan artikel via drag-and-drop, mengatur warna tema tanpa koding, serta memantau SEO.
3. **Search Engine & AI Crawlers (Googlebot, Google AI Overviews, Perplexity, Bingbot):** Mengindeks artikel secara cepat melalui micro-sitemaps dan structured data JSON-LD.

---

## 3. System Architecture & Tech Stack

| Layer | Technology | Role & Capability |
| :--- | :--- | :--- |
| **Framework** | **Astro (v4/v5)** | Zero-JS default rendering, hybrid SSG/SSR, sub-second TTFB, Islands Architecture |
| **Hosting & Edge CDN** | **Cloudflare Pages & Workers** | Global Edge CDN di 300+ kota, unlimited bandwidth, serverless compute |
| **Database** | **Cloudflare D1 (SQLite Edge)** | 5 GB storage, query < 10ms, full ACID transactions untuk posts, categories, settings |
| **Storage / Media** | **Cloudflare R2** | 10 GB storage, Zero Egress Fee untuk cover gambar WebP responsive |
| **Styling & UI** | **Tailwind CSS + CSS Custom Properties** | Mobile-First responsive styling + dynamic theme color switcher |
| **Authentication** | **Web Crypto Session Cookie** | Protected `/admin` login dengan HTTP-only secure cookies & rate-limiting |

---

## 4. Key Functional Requirements

### 4.1. Mobile-First & Responsive Magazine Experience
- **App-like Mobile Navigation:**
  - Sticky Top Bar dengan Logo, Instant Search Modal trigger, dan Dark Mode switch.
  - Horizontal Swipeable Category Pills (bisa digeser halus dengan jempol).
  - Floating Bottom Navigation Bar (Home, Search, Categories, Quick Share / TOC).
- **Desktop Magazine View:**
  - Hero Section (1 Featured Headline Utama + 3 Side Stories).
  - Category Bento Grids & 3-Column News Layout.
  - Breaking News Ticker (running text berita terbaru).
  - Sticky Header Mega Menu.

### 4.2. In-Article SEO 2026 Anatomy (Otomatis)
- **Breadcrumbs:** Navigasi hierarki `Home > Kategori > Judul` + Schema `BreadcrumbList`.
- **Table of Contents (Daftar Isi Otomatis):** Terbentuk dari `<h2>` & `<h3>` dengan jump-to-anchor links (accordion di mobile).
- **Reading Time & Progress Bar:** Estimasi waktu baca (`⏱️ 4 min read`) + scroll indicator bar di atas layar.
- **Key Takeaways / AI Summary Box:** Kotak ringkasan 3-4 poin untuk Google AI Overviews & ChatGPT Search.
- **E-E-A-T Author Box:** Foto, nama, bio keahlian, dan link media sosial terverifikasi.
- **Smart Related Articles:** Rekomendasi 3-4 artikel sejenis berdasarkan Kategori & Tags yang sama (dengan fallback cerdas).
- **Social Share:** Tombol share 1-klik ke WhatsApp, X/Twitter, LinkedIn, Facebook, & Copy Link.
- **Auto Dynamic OpenGraph (OG):** Banner media sosial 1200x630px otomatis per artikel.

### 4.3. Paginated Sitemap Index & Feeds
- Induk `/sitemap.xml` membagi URL secara otomatis:
  - `/sitemap-posts-1.xml`, `/sitemap-posts-2.xml` (maksimal 1.000 URL per chunk).
  - `/sitemap-categories.xml` & `/sitemap-pages.xml`.
  - `/sitemap-news.xml` (Artikel 48 jam terakhir untuk fast-indexing).
- `/rss.xml` & `/feed.xml` untuk sindikasi berita.

### 4.4. Content Pipeline & Smart Markdown Importer
- **Drag & Drop Upload:** Import file `.md` satuan atau bulk zip.
- **Multi-Layer Duplicate Detection:**
  - Pengecekan Slug & Title match.
  - Pengecekan SHA-256 Content Fingerprint Hash.
  - Opsi: *Skip (Lewati)*, *Overwrite (Perbarui)*, atau *Auto-rename*.
- **Auto Image Crop & Dimension Adjuster:**
  - Upload 1 gambar cover mentah -> Otomatis resize & konversi WebP (Hero 1200x675, Card 800x450, Mobile 400x225).
  - Aspect ratio 16:9 anti-gepeng dengan zero layout shift (CLS = 0).

### 4.5. Admin Dashboard CMS (`/admin`)
- **Login Keamanan:** Form login dengan hash password, anti-brute force, dan secure session cookie.
- **Post Management:** Listing artikel dengan filter kategori, status (Publish/Draft), live search, dan aksi cepat (Edit, Duplicate, Delete).
- **Dual-Mode Editor:** Mode Visual WYSIWYG & Mode Teks Markdown + Live Preview.
- **SEO & Google Search Preview Box:** Input Focus Keyword, Meta Title, Description, serta simulasi tampilan SERP.
- **Theme Color Customizer:** Preset warna magazine (Editorial Navy, Cyber Tech, Sunset Lifestyle, Crimson News) + Custom Color Picker (Hex).
- **General Settings & Webmaster:** Form input GA4 ID, Google Search Console Verification code, Site Title, Logo, Favicon.
- **1-Click Full Backup:** Download database artikel & settings dalam file JSON/ZIP.

---

## 5. Non-Functional Requirements
- **Performance:** Skor Google PageSpeed Mobile ≥ 95-100, LCP < 0.8s, CLS = 0, INP < 50ms.
- **Accessibility & SEO:** Skor Accessibility & SEO 100/100 (W3C Semantic HTML5, ARIA labels).
- **Cost:** 100% Rp 0 / Gratis operasional pada tier Cloudflare Free.
