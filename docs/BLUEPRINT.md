# 🏛️ BLUEPRINT ARSITEKTUR & SISTEM RANCANGLOKA.COM
> **Dokumentasi Lengkap Master Arsitektur, Infrastruktur Cloudflare, Database D1, Storage R2, Sistem Editorial, SEO 2026, dan UI/UX Engineering.**  
> *Versi: 1.0 (Production Ready) — Tahun Rilis: 2026*

---

## 📑 DAFTAR ISI BLUEPRINT
1. [Ringkasan Eksekutif & Identitas Platform](#1-ringkasan-eksekutif--identitas-platform)
2. [Arsitektur Infrastruktur Serverless (Cloudflare Edge)](#2-arsitektur-infrastruktur-serverless-cloudflare-edge)
3. [Arsitektur Database Cloudflare D1 & Skema Data](#3-arsitektur-database-cloudflare-d1--skema-data)
4. [Arsitektur Penyimpanan Media (Cloudflare R2 & WebP Converter)](#4-arsitektur-penyimpanan-media-cloudflare-r2--webp-converter)
5. [Keamanan Berlapis & Stealth Mode (Penyamaran Identitas)](#5-keamanan-berlapis--stealth-mode-penyamaran-identitas)
6. [Mesin Editorial & SEO 2026 Engine](#6-mesin-editorial--seo-2026-engine)
7. [Komponen Interaktif & Fitur World-Class Editorial](#7-komponen-interaktif--fitur-world-class-editorial)
8. [Struktur Folder & Peta File Proyek (*Code Map*)](#8-struktur-folder--peta-file-proyek-code-map)
9. [Panduan Operasional & Perawatan (*Operations & Deployment*)](#9-panduan-operasional--perawatan-operations--deployment)

---

## 1. RINGKASAN EKSEKUTIF & IDENTITAS PLATFORM

* **Nama Platform:** **RancangLoka** (`rancangloka.com`)
* **Kategori Niche:** Media Editorial Arsitektur Modern, Desain Interior Estetik, Solusi Rumah Pintar (*Smart Home*), dan Inovasi Hunian Tropis.
* **Prinsip Desain:** *Apple-Aesthetic Editorial Style* (Tipografi tegas, transisi halus, *breathing room* lega, *dark mode* bawaan, *zero layout shift*).
* **Filosofi Teknis:** *Zero Server Maintenance*, *Ultra-Fast Edge Delivery (<0.5s)*, *Zero Cost Egress Bandwidth*, dan *High-Security Zero Trust*.

### 📚 Pilar Konten & Cakupan Materi Artikel (*Editorial Taxonomy & Scope*):
RancangLoka menyajikan kurasi materi komprehensif seputar arsitektur, konstruksi, tata ruang, dan manajemen properti yang terbagi ke dalam **13 pilar materi utama**:

| No | Pilar Materi | Ikon | Fokus Pembahasan & Cakupan Materi |
|:---:|:---|:---:|:---|
| 1 | **Rumah** | 🏠 | Desain hunian tapak, rumah tinggal tropis, *compact house*, villa, *townhouse*, dan studi kasus renovasi rumah tinggal. |
| 2 | **Gedung** | 🏢 | Arsitektur perkantoran (*high-rise & mid-rise*), apartemen, gedung komersial, fasad modern, dan utilitas bangunan tinggi. |
| 3 | **Ruko** | 🏪 | Desain rumah toko & rukan fungsional, transformasi fasad komersial, efisiensi tata ruang usaha, dan optimalisasi kavling. |
| 4 | **Hotel** | 🏨 | Desain *hospitality*, resort, *boutique hotel*, *homestay*, *glamping*, serta standar estetika dan kenyamanan tamu. |
| 5 | **Retail** | 🏬 | Desain ruang komersial, outlet ritel, *coffee shop*, kafe, restoran, *showroom*, *visual merchandising*, dan *customer experience space*. |
| 6 | **Interior** | 🛋️ | Tata ruang dalam, pemilihan furnitur, ergonomi, eksplorasi gaya (*Japandi, Scandinavian, Modern Classic, Industrial, Wabi-sabi*), dan dekorasi. |
| 7 | **Jendela & Pintu** | 🪟 | Desain bukaan, ventilasi silang (*cross-ventilation*), sistem kusen (UPVC, aluminium, kayu solid), pintu pivot/sliding, serta insulasi termal & akustik. |
| 8 | **Material Bangunan** | 🧱 | Eksplorasi material struktur & finishing (beton ekspos, baja ringan, bata ringan, granit/marmer, kayu sintetis, insulasi, dan cat ramah lingkungan). |
| 9 | **Lighting** | 💡 | Desain tata cahaya arsitektural (*ambient, task, accent lighting*), temperatur warna (warm/cool), efisiensi energi LED, dan *natural daylighting*. |
| 10 | **Landscape** | 🌿 | Desain taman tropis, *rooftop garden*, *vertical garden*, *hardscape*, *softscape*, kolam renang/ikan, serta tata kelola drainase & resapan air. |
| 11 | **Teknologi Konstruksi** | 🏗️ | Inovasi metode konstruksi, struktur tahan gempa, prefabrikasi/modular, integrasi *Smart Home*, IoT, dan *Building Information Modeling* (BIM). |
| 12 | **Arsitektur** | 📐 | Teori, konsep & estetika arsitektur, denah/layout sirkulasi ruang, fasad bangunan kontemporer, orientasi iklim mikro, dan karya arsitek terkemuka. |
| 13 | **Biaya & Perencanaan** | 💰 | Rencana Anggaran Biaya (RAB), estimasi biaya bangun per m², tips efisiensi anggaran, manajemen kontrak/kontraktor, serta *timeline* proyek. |

### 🛠️ Stack Teknologi Inti:
```
┌───────────────────────────────────────────────────────────────┐
│                    RANCANGLOKA TECH STACK                     │
├───────────────────┬───────────────────────────────────────────┤
│ Web Framework     │ Astro 5 (Server-Side Rendering / SSR Mode)│
│ Runtime Backend   │ Cloudflare Workers (V8 Edge Isolates)     │
│ Relational DB     │ Cloudflare D1 (Global Serverless SQLite)  │
│ Object Storage    │ Cloudflare R2 (Zero-Egress Media Bucket)  │
│ Styling & Design  │ Tailwind CSS (Custom Magazine Design Sys) │
│ Edge Security     │ Cloudflare Zero Trust Access (Email OTP)  │
│ Image Pipeline    │ Client-Side Canvas WebP Converter         │
└───────────────────┴───────────────────────────────────────────┘
```

---

## 2. ARSITEKTUR INFRASTRUKTUR SERVERLESS (CLOUDFLARE EDGE)

Platform RancangLoka tidak berjalan di atas satu server fisik atau VPS tradisional, melainkan dieksekusi secara instan di **300+ data center Cloudflare di seluruh dunia**.

```
[ Pengunjung Web / Bot Google ]
              │
              ▼
┌───────────────────────────────────────────────────────────────┐
│ 🌐 CLOUDFLARE EDGE NETWORK (Anycast CDN, Anti-DDoS, SSL/TLS)  │
│  - Edge Cache TTL 1 Tahun untuk Aset Statis (/assets/*)       │
│  - HTTP/3 & QUIC Protocol Enabled                             │
│  - Proteksi WAF & Zero Trust Access untuk Rute /admin*        │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────┐
│ ⚡ CLOUDFLARE WORKER (Astro SSR Runtime)                       │
│  - Merender HTML dinamis secara instan (<20ms)                │
│  - Menjalankan Middleware Auth & Anti-FOUC Theme Engine       │
│  - Memproses Filter Internal Linking & Dateline Branding      │
└──────────────┬───────────────────────────────┬────────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│ 🗄️ CLOUDFLARE D1 DATABASE    │ │ 📦 CLOUDFLARE R2 STORAGE    │
│  (Data Artikel, Kategori,   │ │  (Foto WebP, Gambar Cover,  │
│   Penulis, Pages, Settings) │ │   Aset Editorial Media)     │
└─────────────────────────────┘ └─────────────────────────────┘
```

### 💡 Keunggulan Arsitektur:
1. **Tanpa Biaya Server Tetap:** Hanya membayar resource yang digunakan (*pay-per-request*).
2. **Kapasitas Skalabilitas Tanpa Batas:** Sanggup menahan lonjakan jutaan pembaca viral tanpa server *down*.
3. **Latensi Sangat Rendah:** Konten disajikan dari data center terdekat dari pembaca (Jakarta/Singapura).

---

## 3. ARSITEKTUR DATABASE CLOUDFLARE D1 & SKEMA DATA

Database RancangLoka menggunakan **Cloudflare D1** (Database SQLite Serverless Global) dengan 8 tabel inti yang saling terintegrasi:

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  categories  │1       *│   articles   │*       1│   authors    │
│──────────────│◄────────│──────────────│────────►│──────────────│
│ id           │         │ id           │         │ id           │
│ name         │         │ slug         │         │ name         │
│ slug         │         │ title        │         │ slug         │
│ color_badge  │         │ description  │         │ bio          │
│ layout_style │         │ content_md   │         │ avatar       │
│ show_on_home │         │ content_html │         │ role         │
└──────────────┘         │ category_id  │         │ social_links │
                         │ author_id    │         └──────────────┘
                         │ is_featured  │
                         │ is_trending  │         ┌──────────────┐
                         │ is_sponsored │         │    pages     │
                         │ key_takeaways│         │──────────────│
                         │ focus_keyword│         │ id, slug     │
                         └──────────────┘         │ title, desc  │
                                                  │ content_html │
┌──────────────┐         ┌──────────────┐         │ template     │
│   settings   │         │  subscribers │         └──────────────┘
│──────────────│         │──────────────│
│ key (PK)     │         │ id, email    │         ┌──────────────┐
│ value        │         │ status       │         │ users / auth │
│ updated_at   │         │ source       │         │──────────────│
└──────────────┘         │ created_at   │         │ id, email, pw│
                         └──────────────┘         └──────────────┘
```

### 📋 Rincian 8 Tabel Database (`db/schema.sql`):
1. **`articles`:** Menyimpan postingan artikel, konten Markdown & HTML hasil *render*, status *draft/published*, views counter, `is_sponsored`, `disable_internal_links`, dan JSON `key_takeaways`.
2. **`categories`:** Mengatur taksonomi kategori, warna aksen badge, urutan beranda, dan preferensi layout (`bento` vs `three-col`).
3. **`authors`:** Data kredibilitas penulis (E-E-A-T Google Signal) lengkap dengan foto avatar, biografi profesional, jabatan editor, dan link media sosial resmi.
4. **`pages`:** Sistem halaman statis ala WordPress (*Tentang Kami, Hubungi Redaksi, Pedoman Media Siber, Kebijakan Privasi*).
5. **`settings`:** Key-Value store untuk tema visual (*primary/accent color*), logo, favicon, Webmaster SEO code, toggle tombol share artikel, profil medsos footer, dan copyright.
6. **`subscribers`:** Database email langganan buletin mingguan (*newsletter*).
7. **`users`:** Akun administrator yang dienkripsi menggunakan hashing PBKDF2.
8. **`sessions`:** Session token acak 24-byte untuk autentikasi Dashboard Admin.

---

## 4. ARSITEKTUR PENYIMPANAN MEDIA (CLOUDFLARE R2 & WEBP CONVERTER)

### 🚀 Alur Upload Media Drag-and-Drop:
1. **Input:** Pengguna melakukan drag-and-drop file gambar (PNG/JPG/JPEG ukuran apa pun, bahkan foto 4K).
2. **Konversi Otomatis Sisi Klien (*Client-Side Canvas*):**
   - Gambar otomatis di-*downscale* ke resolusi optimal (lebar maksimal **1200px**).
   - Dikonversi menjadi format **`image/webp`** dengan kualitas 82%.
   - Ukuran file menyusut drastis dari 5–10 MB menjadi **60–120 KB**.
3. **Penyimpanan:** Diunggah langsung via REST API ke Cloudflare R2 Bucket (`rancangloka-media`).
4. **Distribusi Media (`/media/[key]`):**
   - Disajikan dengan header `Cache-Control: public, max-age=31536000, immutable`.
   - Di-cache permanen di seluruh data center Cloudflare dengan **biaya egress $0**.

---

## 5. KEAMANAN BERLAPIS & STEALTH MODE (PENYAMARAN IDENTITAS)

Platform RancangLoka dirancang dengan filosofi keamanan **"Benteng Tanpa Pintu Terbuka"**:

```
[ PENYERANG / BOT SCANNER ]
           │
           ▼
[ Lapis 1: Cloudflare Zero Trust (Edge Access) ] ──► GAGAL: Butuh OTP Email
           │
           ▼
[ Lapis 2: Session Token Acak & PBKDF2 Hashing ] ──► GAGAL: Anti-Brute Force
           │
           ▼
[ Lapis 3: D1 Internal Bindings (No Port 3306) ] ──► GAGAL: Tidak Ada Port Terbuka
```

### 🕵️‍♂️ Penyamaran Identitas (*Stealth Mode*):
* **Folder Aset Terenkapsulasi:** File JavaScript & CSS tidak menggunakan prefix `/_astro/`, melainkan dialihkan menjadi `/assets/hoisted.xxx.js` di [`astro.config.mjs`](file:///astro.config.mjs).
* **HTML Minification:** Output HTML dikompresi rapat tanpa komentar framework bawaan.
* **Server Header Anonim:** Response jaringan hanya menampilkan `Server: cloudflare`.
* **Zero Generator Tag:** Tidak ada tag `<meta name="generator" />` di `<head>`.
* **Hasil:** Alat seperti *Wappalyzer* dan *BuiltWith* mendeteksi sistem ini sebagai *“Custom Enterprise Static Engine”*.

---

## 6. MESIN EDITORIAL & SEO 2026 ENGINE

Modul SEO [`src/lib/seo.ts`](file:///src/lib/seo.ts) mengotomatiskan seluruh aturan optimasi Google 2026:

### 1. Dateline Source Branding (Anti-Scraping Protection)
* Paragraf pertama artikel dan deskripsi feed RSS secara otomatis diawali dengan:  
  `<strong><a href="...">RANCANGLOKA.COM</a></strong> – `
* **Fungsi:** Jika konten dicuri oleh situs agregator atau scraper otomatis, backlink dofollow ke domain RancangLoka akan tetap terbawa secara otomatis.

### 2. Mesin Internal Linking 3-Lapis (*Internal Linking Engine*)
* **Lapis 1:** Dateline Branding di awal artikel.
* **Lapis 2 (In-Article "BACA JUGA"):** Menyelipkan kartu rekomendasi artikel terkait tepat sebelum sub-bab `<h2>` ke-2 atau ke-3 (jauh di tengah artikel).
* **Lapis 3 (Auto-Keyword Linker):** Memindai kata kunci fokus (*focus keyword*) dari artikel lain di database dan otomatis mengubah teks pertama yang cocok menjadi anchor link kontekstual (maksimal 2 tautan per artikel).

### 3. Pacing Visual Anti-Clutter
* **Key Takeaways (Poin Kunci):** Berada di bagian paling atas (setelah Cover Banner) untuk menyajikan ringkasan instan bagi pembaca mobile & Google AI Overview.
* **Daftar Isi (TOC):** Diselipkan tepat **sebelum sub-bab `<h2>` pertama** (hanya muncul jika artikel memiliki $\ge 2$ sub-bab).
* **Hasil:** Menghilangkan tumpukan dua kotak yang menempel di awal artikel.

### 4. Perisai Artikel Berbayar (*Sponsored / Paid Review Shield*)
* Saat artikel ditandai `is_sponsored: 1`:
  - 🚫 Key Takeaways dimatikan.
  - 🚫 Daftar Isi (TOC) dimatikan.
  - 🚫 In-Article BACA JUGA dimatikan.
  - 🚫 Auto-Keyword Linker dimatikan.
  - 🚫 Grid Artikel Terkait Bawah dimatikan.
  - 🎯 Link equity 100% dialirkan ke situs klien sponsor.

---

## 7. KOMPONEN INTERAKTIF & FITUR WORLD-CLASS EDITORIAL

```
┌──────────────────────────────────────────────────────────────┐
│             FITUR-FITUR WORLD-CLASS EDITORIAL                │
├────────────────────────────┬─────────────────────────────────┤
│ 🖼️ Native Lightbox Zoom     │ Tap foto untuk Fullscreen HD +  │
│                            │ Backdrop Blur & Tombol Buka HD  │
├────────────────────────────┼─────────────────────────────────┤
│ 🎚️ Before-After Slider     │ Geser perbandingan transformasi │
│                            │ renovasi ruangan touch & mouse  │
├────────────────────────────┼─────────────────────────────────┤
│ 🔖 Inspiration Bookmarks   │ Simpan artikel favorit ke drawer│
│                            │ browser tanpa perlu registrasi  │
├────────────────────────────┼─────────────────────────────────┤
│ 🔍 Enhanced Search Modal   │ Pencarian instan ⌘K dengan tag  │
│                            │ tren (#Japandi, #Fasad, dll.)   │
├────────────────────────────┼─────────────────────────────────┤
│ 📬 Newsletter Engine       │ Pendaftaran buletin mingguan    │
│                            │ terhubung ke D1 subscribers     │
├────────────────────────────┼─────────────────────────────────┤
│ 📊 Realtime SEO Scorecard  │ Checklist SEO live (0–100%)     │
│                            │ saat penulis mengetik di admin  │
└────────────────────────────┴─────────────────────────────────┘
```

---

## 8. STRUKTUR FOLDER & PETA FILE PROYEK (*CODE MAP*)

```text
rancangloka/
├── db/
│   └── schema.sql                  # Skema D1 Database (8 Tabel, Index, Seed Data)
├── docs/
│   └── BLUEPRINT.md                # Dokumen Blueprint Master ini
├── public/                         # Aset statis publik & favicon
├── src/
│   ├── components/                 # Komponen UI Modular
│   │   ├── AuthorCard.astro        # Kartu profil penulis E-E-A-T
│   │   ├── BeforeAfterSlider.astro # Slider perbandingan renovasi interaktif
│   │   ├── BookmarkDrawer.astro    # Drawer koleksi inspirasi pembaca (LocalStorage)
│   │   ├── CategoryBentoGrid.astro # Layout grid bento modern
│   │   ├── CategoryThreeColGrid.astro # Layout grid 3-kolom standar
│   │   ├── Header.astro            # Header dengan live date, bookmark badge, & search
│   │   ├── HeroMagazine.astro      # Banner hero beranda (Featured Story)
│   │   ├── ImageLightbox.astro     # Modal zoom foto arsitektur full-screen HD
│   │   ├── MobileBottomNav.astro   # Navigasi bawah ramah sentuhan ponsel
│   │   ├── NewsletterBox.astro     # Form pendaftaran newsletter Apple-style
│   │   ├── RelatedArticles.astro   # Grid artikel terkait di dasar halaman
│   │   ├── SearchModal.astro       # Modal pencarian cepat dengan Trending Tags
│   │   ├── SocialShareBar.astro    # Baris tombol bagikan artikel yang bisa dikustom
│   │   └── TableOfContents.astro   # Daftar isi artikel otomatis
│   ├── layouts/
│   │   ├── BaseLayout.astro        # Template dasar frontend (SEO, Meta, Footer, CSS)
│   │   └── AdminLayout.astro       # Template dashboard CMS admin
│   ├── lib/
│   │   ├── auth.ts                 # Enkripsi password PBKDF2 & validasi sesi
│   │   ├── db.ts                   # ORM & Query Helpers Cloudflare D1
│   │   └── seo.ts                  # Engine Internal Linking, Dateline, & TOC Injector
│   ├── pages/
│   │   ├── [slug].astro            # Dynamic Handler (Artikel Post vs Halaman Statis)
│   │   ├── index.astro             # Halaman Beranda Utama
│   │   ├── 404.astro               # Halaman 404 estetik
│   │   ├── rss.xml.ts              # RSS Feed Generator bersindikasi dateline
│   │   ├── sitemap.xml.ts          # Sitemap Index XML
│   │   ├── sitemap-news.xml.ts     # Google News XML Sitemap
│   │   ├── sitemap-pages.xml.ts    # Sitemap Halaman Statis XML
│   │   ├── admin/                  # Portal Manajemen CMS Admin
│   │   │   ├── index.astro         # Dashboard metrik & statistik
│   │   │   ├── login.astro         # Form login admin
│   │   │   ├── settings.astro      # Pengaturan tema, SEO, share bar, & footer
│   │   │   ├── posts/              # Manajemen posting artikel & Markdown Importer
│   │   │   ├── pages/              # Manajemen halaman statis (WordPress-style)
│   │   │   └── authors/            # Manajemen profil penulis E-E-A-T
│   │   ├── api/                    # REST API Endpoints
│   │   │   ├── admin/              # API Admin CRUD (Posts, Pages, Settings, Upload R2)
│   │   │   ├── newsletter/         # API Berlangganan Newsletter
│   │   │   └── search.json.ts      # API Pencarian Instan
│   │   └── media/[key].ts          # Media Streaming Edge Route (Cloudflare R2)
│   └── styles/
│       └── global.css              # Typography Magazine & Custom Design Tokens
├── astro.config.mjs                # Konfigurasi Astro SSR & Stealth Assets
├── package.json                    # Dependensi proyek
├── wrangler.toml                   # Konfigurasi Cloudflare Workers, D1, & R2
├── HISTORY.md                      # Log riwayat lengkap 15 milestone pengembangan
└── contoh file md.txt              # Template standar penulisan Markdown SEO 2026
```

---

## 9. PANDUAN OPERASIONAL & PERAWATAN (*OPERATIONS & DEPLOYMENT*)

### 1. Alur Deploy CI/CD Otomatis:
Setiap *commit* yang di-push ke branch `main` di GitHub akan otomatis memicu Cloudflare Workers Build & Deploy secara instan:
```bash
git add .
git commit -m "feat: deskripsi perubahan"
git push origin main
```

### 2. Perintah Penting:
* **Uji Coba Kompilasi:** `npm run build`
* **Jalankan Lokal Server:** `npm run dev`

### 3. Panduan Hubungkan Domain Kustom (`rancangloka.com`):
1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com) -> Masuk ke menu **Workers & Pages**.
2. Pilih Worker **`rancangloka`** -> Pilih tab **Settings** -> **Domains & Routes**.
3. Klik **Add** -> Pilih **Custom Domain** -> Masukkan `rancangloka.com` (dan `www.rancangloka.com`).
4. Cloudflare akan otomatis mengonfigurasi DNS Record, menerbitkan sertifikat SSL/TLS gratis, dan mengaktifkan proteksi Anycast Edge secara instan!

---

*Blueprint ini adalah dokumen panduan arsitektur resmi platform RancangLoka.* 🏡✨
