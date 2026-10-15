# 🛡️ RancangLoka — Content Protection & Security Architecture Blueprint (CONTENT_PROTECTION-1)

**Milestone:** `CONTENT_PROTECTION-1`
**Status:** `AUDIT & ARCHITECTURAL BLUEPRINT HARDENED` (Implementation Not Authorized — Design & Hardening Completed)
**Parent Document:** `docs/BLUEPRINT.md`
**Target Repository:** `rancangloka-astro/`
**Current Production Worker:** `1ec3dfd1-60b9-493f-aa48-ea63ea1dde0f`
**Date:** 2026-10-16

---

## 1. Executive Summary & Core Engineering Philosophy

### The Inescapable Truth
> **"PUBLIC WEB CONTENT CANNOT BE MADE IMPOSSIBLE TO COPY."**
> Jika sebuah halaman web dapat ditampilkan di layar pembaca manusia dan dibaca oleh mesin peramban (browser) atau mesin pencari (search engine), maka teks dan gambar di halaman tersebut **secara matematis dan teknis dapat disalin**.

Inisiatif **CONTENT_PROTECTION-1** tidak mengejar ilusi perlindungan palsu (*fake anti-copy protection*) yang merusak pengalaman pembaca atau membunuh pengindeksan mesin pencari.

### Dua Pilar Perlindungan:
1. **CONTENT PROTECTION (Pertahanan Ekstraksi & Infrastruktur):** Mengurangi ekstraksi massal otomatis tanpa izin, melindungi beban server origin (Worker CPU dan kuota D1), menyaring hotlinking media boros bandwidth, serta membedakan bot sah dari bot perusak.
2. **CONTENT IDENTITY PROTECTION / PUBLICATION DNA (Forensik & Bukti Pasca-Salin):** Menyediakan jejak bukti forensik kriptografis dan sidik jari struktural/semantik yang tak terbantahkan ketika konten publik telah disalin, dikloning, atau diderivasi oleh pihak ketiga.

### Objektif Strategis RancangLoka:
- Melindungi infrastruktur edge dan basis data D1 dari konsumsi kuota akibat scraping sekuensial cepat.
- Menjamin Googlebot, Bingbot, dan bot jejaring sosial tetap mendapatkan akses cepat dan bersih tanpa hambatan verifikasi (*zero friction*).
- Menegakkan tata kelola media R2 dari eksploitasi hotlinking pihak ketiga.
- Membangun jejak DNA publikasi pasif tanpa memanipulasi keaslian prosa editorial.
- Menjaga integritas Core Web Vitals (LCP, INP, CLS), aksesibilitas pembaca, sindikasi RSS, dan sitemap discovery.
- Menolak seluruh bentuk *security theater*.

---

## 2. Inventarisasi Sistem Aktual (Current System Inventory)

Audit berbasis bukti langsung (*evidence-based audit*) terhadap repositori `rancangloka-astro/`:

| Komponen | Berkas Otoritatif | Status & Temuan Aktual |
|---|---|---|
| **Worker Entrypoint** | `src/worker.ts` | Entrypoint native membungkus Astro SSR (`astroWorker.fetch`) dan menangani Cron triggers native Cloudflare. |
| **Edge Compute Adapter** | `astro.config.mjs` | `@astrojs/cloudflare` mode `advanced`, `imageService: 'passthrough'`. Bundle SSR berjalan di edge. |
| **Basis Data Relasional** | `wrangler.toml` | D1 database `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`) terikat ke runtime. |
| **Object Storage** | `wrangler.toml` | R2 bucket `rancangloka-media` terikat ke `MEDIA_BUCKET`. Tidak ada domain publik langsung (`r2.dev` tidak aktif). Akses murni lewat Worker. |
| **Middleware & Guards** | `src/middleware.ts` | Menegakkan auth cookie `/admin`, CSRF origin check untuk mutating `/api/admin`, pemblokiran kredensial media device `lkmd_`, dan injeksi header keamanan standar. |
| **Cache-Control HTML** | `src/middleware.ts` (L142–146) | **TEMUAN KRITIS:** `no-cache, no-store, must-revalidate` diterapkan pada seluruh halaman non-media/non-asset. Cloudflare Edge tidak meng-cache HTML artikel sama sekali; setiap hit scraper langsung memicu SSR penuh dan 6–7 query D1. |
| **Rute Artikel Publik** | `src/pages/[slug].astro` | SSR dinamis. Membaca D1: `getPublishedArticleBySlug`, `getPageBySlug`, `getAllCategories`, `getSiteSettings`, `getRelatedArticles`, `getInternalLinkCandidates`, `getActivePlaneALinks`. Sanitasi HTML aktif via `sanitizeArticleHtml`. |
| **Media Delivery Route** | `src/pages/media/[...key].ts` | Menangani `/media/images/...` dan `/media/thumbnails/...`. Proteksi traversal path aktif (`..`, backslash, null bytes, double-decode). Cache 1 tahun immutable untuk derivatif valid. **GAP:** Zero hotlinking check, zero rate limit. |
| **Robots Directives** | `public/robots.txt` | Aturan dasar: `Allow: /`, `Disallow: /admin/`, `Disallow: /api/`. Daftar 5 sitemap. **GAP:** Belum ada deklarasi spesifik untuk crawler AI (GPTBot, CCBot, ClaudeBot, dll). |
| **Sitemap XML** | `src/pages/sitemap*.ts` | Master sitemap index, post sitemap, page, category, dan news sitemap. Dilengkapi Google Image Sitemap tags (`<image:loc>`, `<image:title>`). Cache 1 jam browser, 24 jam CDN. |
| **Sindikasi RSS** | `src/pages/rss.xml.ts` | Menghasilkan RSS 2.0. **FAKTA BAIK:** Naskah penuh TIDAK terekspos; hanya memuat judul, ringkasan pendek (`a.description`), kategori, dan atribusi URL kanonikal. Cache 30m/2h. |
| **Pencarian Publik API** | `src/pages/api/search.json.ts` | Endpoint publik GET `?q=`. **GAP:** Mengekspos field metadata internal (`content_hash`, `views`, `key_takeaways`, `focus_keyword`, `category_id`, `author_id`) dalam payload JSON. |
| **Watermark Engine** | `src/lib/watermark/` & `stored-image-artifact.ts` | Model pengaturan watermark di D1 (`watermark_settings`) dan master asset di R2 (`site/watermarks/master/`). LokaMedia mendukung watermark teks `rancangloka.com` deterministik saat pembuatan gambar. |
| **Cloudflare WAF / Rules** | Repositori / Edge | Belum ada aturan WAF custom atau rate-limit rule yang tercatat dalam repo. |

---

## 3. Peta Permukaan Perlindungan (Protection Surface Map)

| Domain Aset | Jalur / Rute | Klasifikasi Akses | Sifat Perlindungan |
|---|---|---|---|
| **A. Public Article HTML** | `/[slug]`, `/` | `PUBLIC` | `SEARCH_DISCOVERY_REQUIRED`. Wajib cepat, mudah diindeks, zero-JS friendly. Perlu edge caching aman & anti-burst abuse protection. |
| **B. Product / Decision Content** | `/[slug]` (Komponen Komparasi) | `PUBLIC` | `SEARCH_DISCOVERY_REQUIRED`. Prosa stabil, komponen harga dinamis SSR. |
| **C. Public Images** | `/media/images/*` | `PUBLIC_BUT_RATE_LIMITABLE` | Terbuka untuk pembaca dan Google Image bot, namun rentan hotlinking dan scraping massal. |
| **D. Thumbnail Derivatives** | `/media/thumbnails/*` | `PUBLIC_BUT_RATE_LIMITABLE` | Derivatif 160x160 WebP ringan. Cache 1 tahun immutable. Terbuka publik. |
| **E. RSS Feed** | `/rss.xml` | `PUBLIC_BUT_RATE_LIMITABLE` | `SEARCH_DISCOVERY_REQUIRED`. Hanya summary + backlink. Jangan ditutup. |
| **F. XML Sitemaps** | `/sitemap*.xml`, `/post-sitemap.xml` | `PUBLIC_BUT_RATE_LIMITABLE` | `SEARCH_DISCOVERY_REQUIRED`. Wajib terbuka untuk search engine. Perlu mitigasi rapid harvesting. |
| **G. Public JSON API** | `/api/search.json` | `PUBLIC_BUT_RATE_LIMITABLE` | Rentan enumerasi kamus. Perlu pemangkasan field & rate limiting. |
| **H. Admin & Mission Control** | `/admin/*`, `/api/admin/*` | `PRIVATE` | Terkunci auth cookie, CSRF check, stealth route, IP/Turnstile opsional. `X-Robots-Tag: noindex`. |
| **I. Basis Data D1** | `DB` binding | `INTERNAL_ONLY` | Tidak ada akses langsung internet. Diakses murni lewat kode Worker berizin. |
| **J. Penyimpanan R2 Asli** | `MEDIA_BUCKET` binding | `INTERNAL_ONLY` | Bucket privat tanpa domain publik langsung. Dimediasi penuh oleh Worker. |
| **K. Internal Worker APIs** | `/api/internal/v1/*` | `INTERNAL_ONLY` | HMAC-SHA256 signature / device bearer token. Terisolasi dari publik. |
| **L. Data Operasional Redaksi** | Audit log, preflight, JEV shadow | `INTERNAL_ONLY` | Metadata tertutup untuk internal editorial engine. |

---

## 4. Model Ancaman Komprehensif (Threat Model Matrix)

| Aktor / Pola Ancaman | Ancaman Spesifik | Kemungkinan | Dampak | Kontrol Saat Ini | Celah (Gap) | Kontrol Usulan (Proposed) |
|---|---|:---:|:---:|---|---|---|
| **Scraper Agresif / Bot Liar** | Ekstraksi seluruh korpus artikel secara cepat | TINGGI | TINGGI | Zero-JS render biasa | Cache-Control `no-store` memicu D1 spike & Worker exhaustion | Edge Cache Rule Terukur + Progressive Rate Limiting di Edge |
| **Pencuri Konten (Cloner Sites)** | Mengkloning naskah dan mempublikasikan ulang tanpa sitasi | TINGGI | SEDANG | Watermark teks LokaMedia pada media | Prosa teks tidak memiliki sidik bukti otomatis selain sitemap | Content Identity Protection / Publication DNA + Feed Summary Only |
| **Hotlinker Gambar** | Memasang URL `/media/...` di situs luar sebagai CDN gambar | TINGGI | SEDANG | None (Worker mengalirkan stream R2 ke siapa saja) | Beban bandwidth egress R2 dan Worker CPU melonjak | Staged Hotlink Defense (Observe $\rightarrow$ Selective 403) |
| **AI Harvester Liar (Tanpa Izin)** | Menelan seluruh naskah untuk training LLM komersial | TINGGI | SEDANG | None | `robots.txt` belum memuat crawler AI spesifik | Deklarasi Selective AI Access di robots.txt + Cloudflare WAF rule |
| **Penyerang / Enumerator API** | Menyerang `/api/search.json` dengan kamus kata kunci | SEDANG | RENDAH | None (query 50 artikel per request) | Membocorkan views, keyword, takeaways, dan membebani D1 | Prune JSON payload (whitelist fields) + IP Rate Limit pada API search |
| **Bot Palsu (Spoofed Googlebot)** | Memalsukan User-Agent `Googlebot` untuk membobol proteksi | TINGGI | SEDANG | None | Verifikasi User-Agent berbasis string mudah dipalsukan | Cloudflare Verified Bots engine (ASN / reverse DNS verification) |
| **Sitemap Exploiter** | Membaca sitemap untuk melakukan sekuensial scraping | TINGGI | SEDANG | None (Sitemap publik normal) | Pemindaian otomatis seluruh URL terbit dalam hitungan menit | Edge Cache Sitemap (24 jam) + Rate limit anomali penelusuran cepat |
| **Brute-Force Admin** | Mencoba menebak password pada `/admin/login` | SEDANG | TINGGI | PBKDF2 hash, redirect guard | Tidak ada rate limit login atau Turnstile di form | Rate limiting login endpoint + Cloudflare Turnstile challenge |

---

## 5. Model Kepercayaan Crawler (Crawler Trust Model)

### Larangan Keras: Mengandalkan `User-Agent` Semata
Header `User-Agent` adalah string teks bebas yang dapat dipalsukan (*spoofed*). **Dilarang keras memberikan bypass keamanan hanya karena request menyertakan teks `Googlebot`**.

### Klasifikasi Crawler RancangLoka:

```
[ Incoming Request ]
         │
         ├──► 1. TRUSTED_SEARCH (Googlebot, Bingbot, YandexBot)
         │       Verification: Cloudflare Verified Bot flag = TRUE (Reverse DNS / ASN valid)
         │       Policy: ALLOW UNCONDITIONAL, ZERO FRICTION, NO JS CHALLENGE
         │
         ├──► 2. TRUSTED_PREVIEW (WhatsApp, Telegram, FacebookExternalHit, Twitterbot, LinkedInBot)
         │       Verification: Cloudflare Verified Bot flag OR Validated Social ASN
         │       Policy: ALLOW UNCONDITIONAL (Needed for rich link unfurling & cards)
         │
         ├──► 3. KNOWN_AI_BOT (SearchGPT/OAI-SearchBot, PerplexityBot vs CCBot, Bytespider, Diffbot)
         │       Verification: Verified Crawler list / Official CIDR (diverifikasi saat implementasi)
         │       Policy: SELECTIVE AI ACCESS (Search/citation allowed; bulk corpus training disallowed)
         │
         ├──► 4. UNKNOWN_AUTOMATION (Headless Chrome, curl, python-requests, Puppeteer, Go-http)
         │       Verification: Unverified UA, Missing standard browser headers (sec-ch-ua, Accept-Language)
         │       Policy: PROGRESSIVE DEFENSE (Observe -> Log -> Soft Rate Limit -> Managed Challenge)
         │
         └──► 5. ABUSIVE_AUTOMATION (Rapid burst, sitemap walker loop, scrapers rotating IPs)
                 Verification: High velocity, sequential 404 enumeration, abnormal hit pattern
                 Policy: ESCALATION TO TEMPORARY BLOCK (HTTP 429)
```

> **Verifikasi Identitas Crawler Dinamis:**
> Nama bot, token User-Agent, dan alamat IP crawler AI berkembang sangat cepat. Implementasi teknis **DILARANG membekukan daftar string bot kaku** berdasarkan pengetahuan cetak biru masa lalu; daftar crawler wajib diverifikasi terhadap registri resmi Cloudflare dan dokumentasi vendor terkini saat fase implementasi tiba.

---

## 6. Sub-Lapisan Perlindungan Identitas Konten (Content Identity Protection / Publication DNA)

### Prinsip Utama yang Permanen
> **`PUBLICATION_DNA_MUST_NOT_ALTER_EDITORIAL_PROSE`**
> *(DNA Publikasi Dilarang Mengubah Naskah Prosa Editorial.)*

*Content Protection* berusaha menahan ekstraksi liar di depan pintu gerbang. Namun jika konten publik sudah telanjur disalin, dikloning, atau diderivasi oleh situs pihak ketiga, *Content Identity Protection* menyediakan jejak forensik untuk membuktikan kepemilikan dan prioritas publikasi RancangLoka.

### Larangan Keras Taktik Manipulasi Teks V1:
Publication DNA V1 wajib bersifat **100% PASIF**. Dilarang keras menyisipkan:
- Karakter Unicode zero-width (`\u200B`, `\u200C`, `\u200D`, `\uFEFF`).
- Penanda Unicode tersembunyi atau homoglif.
- Typo / salah eja yang disengaja.
- Variasi sinonim atau kalimat yang dipaksakan untuk menyandikan bit data.
- Trik watermark HTML tersembunyi yang merusak DOM.
- Taktik *textual canary* atau *encoded prose watermark* diklasifikasikan sebagai: **`EXPERIMENTAL / NOT_V1`**.

Kualitas bahasa Indonesia ragam konsultan arsitektur RancangLoka, aksesibilitas screen reader, keterbacaan manusia, dan optimasi mesin pencari **tidak boleh dikorbankan** demi trik penandaan teks tersembunyi.

### Model Komponen PUBLICATION_DNA (Per Artikel / Versi Terbit):

```
+---------------------------------------------------------------------------------------------------------+
|                                        PUBLICATION_DNA V1                                              |
+---------------------------------------------------------------------------------------------------------+
| A. CRYPTOGRAPHIC PROOF:                                                                                |
|    - article_id                                                                                         |
|    - canonical_url                                                                                      |
|    - content_hash (SHA-256 naskah markdown kanonikal pasca-persetujuan)                                |
|    - published_at & actual_published_at                                                                 |
|    - publication_receipt (receipt_id, plan_id, execution_id di D1)                                     |
|    - fingerprint_version                                                                                |
+---------------------------------------------------------------------------------------------------------+
| B. PASSIVE TEXT FINGERPRINT (Dihitung otomatis tanpa mengubah naskah):                                  |
|    - Normalized n-gram signatures (3-gram & 5-gram token naskah bersih)                                |
|    - Corpus-relative distinctive phrase signatures (Bukan sekadar jargon arsitektur umum)              |
|    - Paragraph SHA-256 sequence (fingerprint per paragraf terbit)                                      |
|    - Sentence boundary fingerprints (pola pembuka dan penutup kalimat)                                 |
+---------------------------------------------------------------------------------------------------------+
| C. STRUCTURAL FINGERPRINT:                                                                             |
|    - Heading sequence hierarchy (urutan H2, H3 spesifik)                                                |
|    - Content block ordering (teks -> tabel -> callout -> visual anchor -> warm handoff)                |
|    - Table schema & comparison structure                                                               |
|    - Decision-flow sequence (alur logika pertimbangan keputusan pembaca)                               |
+---------------------------------------------------------------------------------------------------------+
| D. SEMANTIC SIGNATURE (Bukti Kemiripan Parafrase):                                                     |
|    - Vector/topic signature untuk mendeteksi naskah turunan hasil spin/parafrase LLM                     |
|    - Sifat: Merupakan bukti kemiripan (similarity evidence), BUKAN bukti otomatis plagiarisme          |
+---------------------------------------------------------------------------------------------------------+
| E. ASSET FINGERPRINT (Untuk Media Milik RancangLoka):                                                  |
|    - Cryptographic asset hash (SHA-256 berkas biner asli)                                               |
|    - Perceptual image hash (pHash/dHash untuk mendeteksi resize/kompresi minor; crop terbatas)         |
|    - asset_id & source_type                                                                             |
|    - article_binding & derivative lineage                                                               |
|    - Label kebenaran asal-usul visual: EDITORIAL_CONCEPT_VISUAL                                         |
+---------------------------------------------------------------------------------------------------------+
```

### Koreksi Definisi "Frasa Khas" (Distinctive Phrase Correction):
Istilah "frasa langka" (*rare phrase*) **WAJIB DIARTIKAN SEBAGAI**:
> **CORPUS-RELATIVE DISTINCTIVE PHRASE / SIGNATURE**
> *(Frasa khas yang unik secara relatif dalam korpus RancangLoka).*

Frasa ini **BUKAN** sekadar kosakata domain arsitektur umum seperti `thermal bridge`, `kusen uPVC`, `louver`, atau `ventilasi silang`. Istilah teknis umum digunakan oleh seluruh industri dan tidak boleh diklaim sebagai bukti kepemilikan naskah. Sidik jari teks difokuskan pada kombinasi multi-kata khas (*distinctive word chains*), analogi spesifik konsultan RancangLoka, urutan logika kalimat, dan pola pembuka kalimat kontekstual.

### Koreksi Batasan Perceptual Hash (Perceptual Hash Boundary):
Perceptual hash (seperti pHash atau dHash) **memiliki batasan teknis yang jelas**:
- **Sangat Kuat Terhadap:** Perubahan skala resolusi (*resize*), re-kompresi format (JPEG ke WebP), dan penyesuaian gamma/kontras minor.
- **Terbatas Terhadap Pemotongan (*Crop*):** Perceptual hash global tidak tahan terhadap pemotongan gambar yang drastis (*arbitrary cropping*). Kemampuan crop robustness terbatas dan wajib diuji melalui tolok ukur sebelum implementasi.
- **Sifat Bukti:** Nilai *distance* pHash adalah bukti kemiripan visual (*visual similarity evidence*), bukan bukti keaslian mutlak.

### Skalabilitas Penyimpanan Publication DNA di D1 (Storage Scalability):
Menyimpan seluruh bita n-gram mentah (3-gram dan 5-gram) untuk ribuan artikel akan memicu ledakan ukuran database (*storage bloat*) di D1. Oleh karena itu, arsitektur V1 mengadopsi pendekatan ringkas:
- **Pendekatan Kompak:** Menggunakan *selected hashed shingles*, *MinHash sketches* (64–128 integer hash per artikel), atau *SimHash* ringkas (~1 KB per artikel).
- **Paragraph Hashes:** 10–20 baris hash paragraf per artikel (~500 B).
- **Reproducibility on Demand:** Karena `content_md` asli tersimpan secara abadi di D1 dan tidak pernah bermutasi, sidik jari n-gram lengkap dapat dihitung ulang kapan saja (*rebuilt on demand*) jika dibutuhkan untuk analisis forensik mendalam, tanpa perlu disimpan permanen secara berlebihan di D1.
- **Estimasi Beban D1 (`DESIGN_ESTIMATE`):** Diperkirakan hanya ~1.5–2.5 KB per artikel (~2.5 MB per 1.000 artikel) sebagai perkiraan desain awal (*design estimate*), bukan fakta konsumsi penyimpanan terukur permanen.

### Bahasa & Status Deteksi Kloning (Clone Detection Language):
Sistem analitik Dimas menggunakan status kandidat terukur:
- `LOW_SIMILARITY`: Kemiripan wajar akibat topik arsitektur yang sama.
- `REVIEW_REQUIRED`: Terdapat kemiripan frasa khas korpus dan struktur heading yang mencurigakan.
- `SUSPECTED_DERIVED_CONTENT`: Naskah parafrase berat dengan alur keputusan identik dan urutan paragraf serupa.
- `PROBABLE_CONTENT_CLONE`: Naskah identik, tabel identik, atau gambar dengan hash perceptual serupa yang dipublikasikan setelah stempel waktu RancangLoka.

Peninjauan manusia (*human review*) tetap wajib sebelum dilakukan eskalasi formal.

### Pemisahan Tegas dari AI Text Detector:
> **`PUBLICATION DNA != AI TEXT DETECTION`**
- Publication DNA **sama sekali tidak bertujuan** mengoptimasi skor atau mengecoh detektor AI pihak ketiga (ZeroGPT, GPTZero, dsb).
- Skor dari AI detector berstatus **`ADVISORY ONLY`**. Kualitas kepenulisan manusia tetap dijaga oleh Joko, Nadia, Rina, dan Chief Editor.

---

## 7. Kebijakan Identitas Visual RancangLoka (RANCANGLOKA_VISUAL_IDENTITY_POLICY)

### 10 Aturan Inti Identitas Visual:
1. **Semua aset visual editorial/publikasi wajib memiliki provenansi:** Setiap berkas gambar terikat pada `asset_id`, stempel waktu pembuatan, tipe sumber, dan catatan lisensi di D1.
2. **Watermark kepemilikan hanya untuk aset milik RancangLoka:** Hanya gambar yang dibuat sendiri atau dimiliki secara sah oleh RancangLoka yang boleh memuat watermark `rancangloka.com`.
3. **Larangan keras watermark pada aset pihak ketiga:** Gambar dari manufaktur, toko resmi (Official Store), atau seller pihak ketiga **DILARANG KERAS** diberi watermark RancangLoka yang dapat mengesankan klaim kepemilikan palsu.
4. **Master original RancangLoka selalu bersih:** Berkas master resolusi tinggi di R2 selalu tersimpan tanpa watermark permanen (*clean master*).
5. **Watermark kasat mata hanya diterapkan pada derivatif publik:** Watermark diaplikasikan saat persiapan derivatif publik, bukan dibakar mati ke dalam master original.
6. **Publication DNA / asset provenance adalah identitas forensik utama:** Hash kriptografis dan stempel waktu adalah bukti hukum utama; watermark kasat mata hanyalah efek pencegah sekunder.
7. **Watermark kasat mata bersifat pencegah sekunder (secondary deterrence):** Mengutamakan estetika visual majalah arsitektur premium di atas paranoia pencurian.
8. **Thumbnail derivatif tidak dipaksa memuat watermark kecil:** Derivatif 160x160 WebP tidak dipaksa memuat teks watermark yang dapat merusak keterbacaan thumbnail.
9. **Aset turunan media sosial boleh menggunakan penanda visual lebih tegas:** Format media sosial dibaca di luar ekosistem web sehingga branding visual diperbolehkan lebih kuat.
10. **Dokumentasi hands-on langsung boleh menggunakan watermark kepemilikan:** Foto fisik yang diambil langsung oleh tim RancangLoka adalah bukti primer orisinal dan berhak memuat watermark kepemilikan halus. **Kebijakan Privasi Media (`PUBLIC_DERIVATIVES_STRIP_SENSITIVE_EXIF`):** Provenansi internal diizinkan menyimpan metadata penangkapan untuk keperluan audit, namun derivatif publik wajib membersihkan (*strip*) EXIF sensitif seperti koordinat GPS presisi dan metadata identitas perangkat/pengguna yang tidak perlu.

### Klasifikasi Kelas Sumber Aset (Asset Source Classes):

| Kelas Sumber Aset | Hak Kepemilikan | Kewajiban Kredit Sumber | Kewajiban Provenansi | Kelayakan Watermark Kasat Mata | Perilaku Publication DNA |
|---|---|---|---|---|---|
| **`RANCANGLOKA_ORIGINAL`** | Milik RancangLoka | Internal Editorial Desk | WAJIB (`asset_id`, hash) | DIIZINKAN (Halus pada derivatif) | Cryptographic hash + pHash |
| **`RANCANGLOKA_HANDS_ON`** | Milik RancangLoka (Bukti Primer) | Fotografer/Tim RancangLoka | WAJIB (Metadata alat/waktu internal, `PUBLIC_DERIVATIVES_STRIP_SENSITIVE_EXIF` pada publik) | DIIZINKAN (Halus pada derivatif) | Cryptographic hash + pHash + EXIF proof internal |
| **`EDITORIAL_CONCEPT_VISUAL`** | Dihasilkan AI/Budi untuk RancangLoka | Label `EDITORIAL_CONCEPT_VISUAL` | WAJIB (Prompt/seed/Budi ID) | OPSIONAL / Kontekstual | Hash biner + lineage generator |
| **`MANUFACTURER_SOURCE`** | Milik Manufaktur/Brand | WAJIB menyertakan nama brand | WAJIB (URL sumber katalog) | **DILARANG KERAS** | Hash biner + lisensi sumber |
| **`OFFICIAL_SELLER_SOURCE`** | Milik Toko/Seller Resmi | WAJIB menyertakan nama toko | WAJIB (Listing source URL) | **DILARANG KERAS** | Hash biner + snapshot offer |
| **`LICENSED_THIRD_PARTY`** | Pihak Ketiga (Unsplash/Stock) | Sesuai syarat lisensi | WAJIB (ID lisensi/kreator) | **DILARANG KERAS** | Hash biner + attribution string |
| **`USER_SUPPLIED`** | Pembaca/Kontributor | Nama kontributor | WAJIB (Persetujuan rilis) | **DILARANG KERAS** | Hash biner + persetujuan |

### Arsitektur Master & Derivatif:

```
[ PRIVATE CLEAN MASTER (R2) ]
(Resolusi Penuh, Bersih Tanpa Watermark Mati)
              │
              ▼
   [ MEDIA PREPARATION PIPELINE ]
(Resize, Format WebP, Quality 85, Apply Contextual Watermark)
              │
              ├──► PUBLIC_ARTICLE (WebP 1200px / 800px)
              ├──► THUMBNAIL (WebP 160x160 px, Tanpa Teks Watermark Rusak)
              ├──► SOCIAL_PREVIEW (Open Graph 1200x630 px)
              ├──► SOCIAL_DISTRIBUTION (Format Khusus Instagram/X dengan Branding Tegas)
              └──► OG_IMAGE (Optimal untuk Unfurling di Pesan Instan)
```

### Perilaku Watermark yang Fleksibel:
- Nilai opasitas, posisi, ukuran font, dan margin **DILARANG DIKUNCI MATI** di cetak biru sebelum dilakukan uji visual pada layar pembaca nyata.
- Penempatan watermark wajib mendukung *safe-area selection* agar tidak menutupi fokus arsitektur bangunan.
- Teks penanda identitas tetap minimal: `rancangloka.com`.

---

## 8. Kebijakan Mesin Pencari & Keselamatan Pengindeksan (Search Engine Safety)

Googlebot dan Bingbot adalah urat nadi distribusi pembaca RancangLoka. Setiap kebijakan proteksi konten yang merusak pengindeksan adalah **kegagalan fatal**.

### Invarian Keselamatan Pengindeksan (Hard Invariants):
1. **Zero JavaScript Challenge untuk Search Engines:** WAF rule dilarang menampilkan Turnstile/CAPTCHA/JS Challenge kepada request yang terverifikasi sebagai `cf.bot_management.verified_bot`.
2. **Preservasi Google Image Indexing:** Aset `/media/*` dan `<image:image>` dalam sitemap XML tidak boleh dihalangi oleh hotlink defense jika pengakses adalah bot pencari gambar (*Googlebot-Image*).
3. **Canonical Header & URL Terlindungi:** Header `Link: <https://rancangloka.com/...>; rel="canonical"` dan meta tag kanonikal tetap disajikan utuh.
4. **Sitemap & RSS Selalu Bebas Tantangan:** Endpoint `/sitemap*.xml` dan `/rss.xml` bebas dari tantangan interaktif agar RSS reader dan crawler sitemap tidak terputus.

---

## 9. Kebijakan AI Crawler (Robots vs Network Enforcement)

### Dua Lapisan Pengendalian:
1. **Robots.txt Directive (Voluntary):** Petunjuk etis standar industri yang dipatuhi oleh penyedia AI bereputasi baik (OpenAI, Anthropic, Google). Biaya komputasi: nol.
2. **Network WAF Enforcement (Hard Control):** Pemblokiran atau penahanan di Cloudflare Edge. Berlaku untuk bot yang mengabaikan `robots.txt` (misalnya scraper anonim atau crawler liar).

### Keputusan Sementara Chief Editor (Provisional Decision):
**`SELECTIVE AI ACCESS` (Opsi A):**
- Izinkan bot pencarian dan rujukan (SearchGPT / OAI-SearchBot, PerplexityBot) agar artikel RancangLoka dirujuk dengan tautan sitasi resmi.
- Larang bot penelan korpus pelatihan murni (CCBot, Bytespider, Diffbot) di `robots.txt` dan tahan di edge jika melanggar.
- Bot tak dikenal ditangani melalui pertahanan perilaku bertingkat (*progressive behavior-based treatment*).
- *Catatan:* String User-Agent bot spesifik diverifikasi ulang saat fase implementasi.

---

## 10. Arsitektur Pertahanan Laju & Caching Edge yang Aman (Safe Edge Caching)

### Celah Temuan Audit:
Pada `src/middleware.ts`, baris 143:
```typescript
response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
```
Setiap halaman artikel publik diperintahkan untuk **tidak di-cache**. Ini membuka celah serangan DoS scraping di mana setiap hit memicu eksekusi SSR penuh dan 6–7 query D1.

### Rancangan Solusi Caching Aman (Safe Public Edge Caching):
1. **Nilai Kandidat Default (Candidate Defaults — Bukan Kebijakan Kaku):**
   - Header usulan: `Cache-Control: public, max-age=60, s-maxage=3600, stale-while-revalidate=86400`.
   - Angka ini adalah default awal yang akan disesuaikan saat pengujian beban nyata.
2. **Pengecualian Mutlak (Strict Exclusions):**
   Dilarang keras menerapkan caching artikel publik pada:
   - `/admin/*` dan seluruh antarmuka Mission Control.
   - `/api/admin/*` dan seluruh endpoint mutasi.
   - `/api/internal/*` (API ingest/worker).
   - Seluruh respons yang memuat cookie autentikasi (`admin_session`).
   - Halaman draf (*draft*) atau pratinjau redaksi (*editorial preview*).
3. **Penyelaras Cache & Purge:**
   - Memastikan respons error (HTTP 500/404) atau halaman tantangan WAF tidak di-cache sebagai halaman normal.
   - Mengintegrasikan Cloudflare Cache Purge API saat artikel diperbarui atau didegradasi statusnya.

---

## 11. Pertahanan Laju Adaptif Tanpa Ambang Batas Buatan (Adaptive Rate Defense)

### Koreksi Cetak Biru:
Angka-angka ambang batas sebelumnya ($<30$, $>60$, $>180$ req/menit) **DIHAPUS DARI STATUS KEBIJAKAN PRODUKSI**. Menetapkan angka laju tanpa data dasar riil berisiko memblokir pembaca manusia sah yang membuka banyak tab sekaligus (*false positive*).

### Prinsip Permanen:
> **`RATE_LIMIT_THRESHOLDS_REQUIRE_BASELINE_OBSERVATION`**
> *(Ambang batas laju wajib ditentukan setelah pengamatan data dasar lalu lintas nyata di produksi.)*

### Klasifikasi Status Konseptual:
1. `HUMAN_NORMAL`: Pola jelajah manusia wajar (pembacaan artikel, klik link internal, jeda scroll).
2. `TRUSTED_CRAWLER`: Mesin pencari sah terverifikasi (bebas hambatan).
3. `UNKNOWN_AUTOMATION`: Permintaan dari pustaka skrip tanpa header peramban lengkap.
4. `SUSPICIOUS_AUTOMATION`: Penelusuran sekuensial cepat, rasio hit artikel abnormal, lonjakan 404.
5. `ABUSIVE_AUTOMATION`: Lonjakan frekuensi tinggi yang mengancam stabilitas Worker origin.

### Eskalasi Bertingkat (Progressive Escalation):
`OBSERVE` (Ukur baseline) $\rightarrow$ `LOG` (Catat ke telemetri) $\rightarrow$ `SOFT_RATE_LIMIT` (Perlambat respons) $\rightarrow$ `MANAGED_CHALLENGE` (Tantangan Turnstile tanpa blokir) $\rightarrow$ `TEMPORARY_BLOCK` (HTTP 429 sementara untuk bot yang mengabaikan tantangan).

---

## 12. Pertahanan Hotlink Bertahap (Staged Hotlink Defense)

### Keputusan Sementara Chief Editor (Provisional Decision):
**`OBSERVE_FIRST_THEN_SELECTIVE_403`:**
- Menolak strategi pengalihan ke banner promo (*redirect-to-banner*) karena membuang komputasi dan bandwidth.

### Tahapan Pelaksanaan:
- **FASE 1 (OBSERVE):** Pasang pencatatan telemetri di `/media/[...key].ts` untuk mengukur domain referer eksternal, volume referer kosong, dan bot perayap gambar resmi.
- **FASE 2 (SELECTIVE ENFORCEMENT):**
  - Izinkan request dengan `Referer` kosong.
  - Izinkan request dari `rancangloka.com` dan mesin pencari terverifikasi.
  - Kembalikan *HTTP 403 Forbidden* ringan (0 byte) hanya untuk domain eksternal yang terbukti melakukan hotlinking abusif.
- Header `Referer` diposisikan murni sebagai sinyal penghematan bandwidth, bukan bukti otentikasi identitas yang kokoh.

---

## 13. Kebijakan Sindikasi Feed & Sitemap

### Kebijakan RSS (`/rss.xml`):
- **Keputusan Sementara Chief Editor:** **`SUMMARY_ONLY_PLUS_CANONICAL_BACKLINK`**.
- Format eksisting di repositori (`src/pages/rss.xml.ts`) sudah sesuai: menyajikan judul, ringkasan pendek 1-2 kalimat (`a.description`), kategori, dan tautan kanonikal resmi.
- Tidak ada naskah tubuh penuh yang dikeluarkan melalui feed, menutup celah scraper otomatis berbasis agregator RSS.

### Kebijakan Sitemap (`/sitemap.xml`, `/sitemap-news.xml`):
- Sitemap tetap dibuka penuh tanpa rintangan agar Googlebot dapat merayapi artikel baru secara instan.
- Di-cache di Cloudflare Edge selama 24 jam (`s-maxage=86400`) untuk mencegah bot membebani D1 untuk memetakan korpus.

---

## 14. Audit Paparan API Publik & Perapihan Payload

### Audit `src/pages/api/search.json.ts`:
Saat ini endpoint search publik mengembalikan seluruh objek `Article` yang difilter, membocorkan kolom internal yang tidak relevan bagi pembaca.

### Tindakan (Field Whitelisting):
Pangkas payload `search.json.ts` hanya menyajikan subset data yang dikonsumsi oleh `SearchModal.astro`:
- `title`
- `slug`
- `description`
- `category_name`
- `featured_image`

Menutup kebocoran metrik internal (`content_hash`, `views`, `key_takeaways`, `focus_keyword`, `category_id`, `author_id`) dan menghemat ukuran payload hingga ~70%.

---

## 15. Keamanan Admin & Mission Control

### Status Keamanan Terverifikasi:
1. **Middleware Auth Barrier:** Rute `/admin/*` terlindungi cookie sesi PBKDF2 SHA-256 dengan redirect aman dan header `Cache-Control: no-store, private`.
2. **CSRF Barrier:** Rute `/api/admin/*` memverifikasi header `Origin` vs `Host` untuk seluruh metode mutasi.
3. **Media Device Firewall:** Token `lkmd_` ditolak dari seluruh endpoint admin.
4. **Stealth Search Indexing:** Header `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` aktif.

### Peningkatan Masa Depan:
- Tambahkan rate-limit pada `/admin/login` (maksimal 5 percobaan gagal per 15 menit).
- Pertimbangkan integrasi Cloudflare Turnstile pada login admin untuk menahan serangan kamus otomatis.

---

## 16. Audit Header Keamanan (Security Headers)

- **Aktif Saat Ini:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Strict-Transport-Security`.
- **Rencana Content-Security-Policy (CSP):** Disiapkan pada fase 1C dengan profil terukur yang mengizinkan font Google, gambar R2, dan Turnstile tanpa merusak inline style Astro.

---

## 17. Penolakan Tegas Taktik "Security Theater"

RancangLoka secara sadar dan permanen **MENOLAK**:
1. ❌ Menonaktifkan klik kanan (`contextmenu` blocking).
2. ❌ Menonaktifkan seleksi teks (`user-select: none`).
3. ❌ Pengaburan DOM / Obfuscated HTML.
4. ❌ Enkripsi sisi klien naskah publik.
5. ❌ Tantangan Turnstile universal pada setiap pembaca artikel.
6. ❌ Signed URL berbatas waktu untuk gambar artikel publik.
7. ❌ Paywall wajib login untuk membaca.

---

## 18. Telemetri & Observabilitas Dimas (Mission Control Integration)

Dimas memantau anomali keamanan di Mission Control dengan klasifikasi keparahan:
- `INFO`: Crawler sah terverifikasi (Google, Bing) melakukan penelusuran korpus normal.
- `WATCH`: Perayapan intensif oleh bot tak dikenal (`UNVERIFIED_BOT_VOLUME`).
- `WARNING`: Deteksi anomali hotlinking (`HOTLINK_SPIKE`), lonjakan laju ekstraksi (`SCRAPER_BURST_DETECTED`), atau sinyal konten terduga kloning (`SUSPECTED_DERIVED_CONTENT`).
- `CRITICAL`: Serangan scraping masif yang mengancam kapasitas edge atau percobaan intrusi admin (`ADMIN_LOGIN_BURST`).

---

## 19. Jaminan Privasi Pembaca (Privacy Guarantees)

- **Zero Invasive Fingerprinting:** Nol pelacakan sidik jari kanvas (*canvas fingerprinting*), audio context, atau data sensor perangkat.
- **Minimisasi Log IP:** Log keamanan aplikasi hanya mencatat hash subnet terpotong (`/24` IPv4 atau `/48` IPv6) untuk mitigasi laju sementara, tanpa menyimpan riwayat penjelajahan pembaca individual.

---

## 20. Koreksi Klaim Kinerja & Verifikasi Kapabilitas Cloudflare

### Koreksi Klaim Kinerja:
Klaim persentase reduksi sebelumnya diklasifikasikan ulang secara jujur sebagai:
> **`EXPECTED / HYPOTHESIS / TO BE BENCHMARKED`**
> *(Perkiraan Berdasarkan Teori / Hipotesis / Wajib Diuji Melalui Tolok Ukur Nyata)*

Tidak ada klaim sepihak seperti "100% Lighthouse dipertahankan" tanpa pengukuran tolok ukur pasca-implementasi nyata di edge. Metrik yang wajib diuji baseline vs terlindungi:
- Worker Requests & CPU Time.
- D1 Database Reads.
- Edge Cache Hit Ratio.
- TTFB, LCP, INP, dan CLS.

### Verifikasi Kapabilitas Cloudflare (`CAPABILITY_REQUIRES_PLAN_VERIFICATION`):
Sebelum implementasi teknis dimulai, wajib dilakukan audit izin akun Cloudflare secara *read-only* untuk memverifikasi ketersediaan:
- Ekspresi `cf.bot_management.verified_bot` (Tersedia di Free/semua paket).
- WAF Custom Rules & Rate Limiting (Kuota aturan tergantung paket).
- Managed Challenge / Turnstile.
- Bot Management Score (1–99) & Super Bot Fight Mode (Memerlukan paket berbayar).
- Cloudflare Cache Rules & Cache Purge API.

---

## 21. Revisi Tahapan Implementasi (Revised Implementation Phases)

```
[ CONTENT_PROTECTION-1 ] (Audit, Blueprint & Hardening) ➔ SELESAI
         │
         ▼
[ CONTENT_PROTECTION-1A ] (Fondasi Edge Caching Aman, Pembersihan API & Robots AI)
  - Audit kapabilitas Cloudflare secara read-only
  - Penyesuaian Cache-Control artikel publik dengan batas pengaman rute privat
  - Pemangkasan payload /api/search.json (hanya field publik)
  - Deklarasi kebijakan Selective AI Access di robots.txt
         │
         ▼
[ CONTENT_PROTECTION-1B ] (Identitas Konten / Publication DNA)
  - Perluasan skema D1 untuk tanda bukti Publication DNA pasif
  - Pembangkitan sidik jari n-gram kompak, struktur, dan pHash media saat publikasi
  - Integrasi header pasif X-RL-Provenance-Hash
  - Penetapan status kandidat kloning (tanpa pemindai otomatis berat di V1)
         │
         ▼
[ CONTENT_PROTECTION-1C ] (Proteksi Media R2 & Watermark Kontekstual)
  - Fase Pengamatan Hotlink (Observe Phase) pada /media/[...key].ts
  - Standardisasi watermark kontekstual (foto arsitektur bersih, infografis menyatu)
  - Validasi penanganan Googlebot-Image dan pratinjau media sosial
         │
         ▼
[ CONTENT_PROTECTION-1D ] (Pengendalian Laju Adaptif & WAF di Edge)
  - Analisis data dasar lalu lintas riil (Baseline Observation)
  - Konfigurasi WAF: Bypass verified search engine, tantangan bertingkat untuk bot liar
  - Penegakan selektif hotlink 403 setelah fase pengamatan selesai
  - Perlindungan rate-limit pada login admin
         │
         ▼
[ CONTENT_PROTECTION-1E ] (Intelijen Keamanan Dimas di Mission Control)
  - Integrasi event telemetri keamanan dan anomali ke Mission Control
  - Dashboard pemantauan rasio cache hit, lonjakan hotlink, dan status Publication DNA
```

---

## 22. Status Keputusan Cetak Biru (Blueprint Decision Status)

Untuk transparansi tata kelola rekayasa, seluruh parameter cetak biru diklasifikasikan ke dalam 4 kuadran status:

### A. DECIDED (Sudah Diputuskan & Mengikat):
1. Konten web publik tidak dapat dibuat mustahil disalin; perlindungan difokuskan pada infrastruktur, bot liar, hotlinking, dan pembuktian hak cipta.
2. Invarian: `PUBLICATION_DNA_MUST_NOT_ALTER_EDITORIAL_PROSE` (V1 100% pasif; zero-width, homoglif, dan typo buatan ditolak).
3. Kebijakan Identitas Visual: `RANCANGLOKA_VISUAL_IDENTITY_POLICY` mengikat 10 aturan inti identitas aset.
4. Googlebot dan Bingbot terverifikasi menerima bypass tanpa tantangan JavaScript.
5. Seluruh bentuk *security theater* (anti-klik kanan, seleksi teks, DOM obfuscation, login-wall pembaca) ditolak mutlak.
6. Pemanfaatan infrastruktur provenansi yang sudah ada (`content_hash`, tanda terima D1) tanpa menduplikasi sistem.
7. Pemisahan mutlak: `PUBLICATION DNA != AI TEXT DETECTION` (Detektor AI eksternal bersifat *advisory only*).

### B. PROVISIONAL (Keputusan Sementara Chief Editor):
1. **AI Crawler:** `SELECTIVE AI ACCESS` (Izinkan bot pencari/sitasi, larang penelan korpus pelatihan massal di robots).
2. **Watermark Visual:** `PASSIVE_PUBLICATION_DNA_DEFAULT` + `VISIBLE_WATERMARK_CONTEXTUAL_ONLY` (Foto dokumenter bersih tanpa watermark; infografis menyatu secara alami; watermark kasat mata hanya opsional jika ada kebutuhan khusus).
3. **Sindikasi RSS:** `SUMMARY_ONLY_PLUS_CANONICAL_BACKLINK` (Pertahankan format ringkasan saat ini).
4. **Hotlink Defense:** `OBSERVE_FIRST_THEN_SELECTIVE_403` (Amati lalu lintas terlebih dahulu sebelum memblokir referer asing; hindari redirect-to-banner).
5. **Otomasi Tak Dikenal:** `PROGRESSIVE_DEFENSE` (Eskalasi bertingkat berdasarkan perilaku dan volume, bukan tantangan universal kaku).

### C. REQUIRES IMPLEMENTATION-TIME VERIFICATION:
1. Token User-Agent dan subnet crawler AI resmi terkini sebelum dimasukkan ke dalam `robots.txt` atau aturan edge.
2. Hak akses dan kuota paket Cloudflare akun (`CAPABILITY_REQUIRES_PLAN_VERIFICATION`).
3. Baseline lalu lintas normal untuk kalibrasi ambang batas laju (*rate limit thresholds*).
4. Dampak nyata penyesuaian cache terhadap TTFB dan rasio cache hit di Cloudflare Edge.

### D. REQUIRES FUTURE CHIEF EDITOR DECISION:
1. Otomasi pemindai kloning konten di web terbuka (apakah Dimas akan menjalankan *active web scanner* atau sekadar *passive forensic verification* saat ada laporan).
2. Prosedur hukum/tindakan redaksi saat ditemukan kloning konten dengan status `PROBABLE_CONTENT_CLONE`.

---

## 23. Kriteria Penerimaan Cetak Biru (Acceptance Criteria)

Cetak biru yang dikeraskan ini dinyatakan lolos verifikasi jika:
1. Mengintegrasikan sub-lapisan **Content Identity Protection** dengan invarian `PUBLICATION_DNA_MUST_NOT_ALTER_EDITORIAL_PROSE`.
2. Mengintegrasikan **`RANCANGLOKA_VISUAL_IDENTITY_POLICY`** dengan 10 aturan inti dan 7 kelas sumber aset.
3. Menghapus seluruh angka ambang batas rate-limit buatan dan menegakkan `RATE_LIMIT_THRESHOLDS_REQUIRE_BASELINE_OBSERVATION`.
4. Mengoreksi klaim reduksi performa menjadi hipotesis yang wajib diuji tolok ukurnya di produksi.
5. Menegaskan klasifikasi `CAPABILITY_REQUIRES_PLAN_VERIFICATION` pada fitur Cloudflare tingkat lanjut.
6. Memperbarui kebijakan watermark menjadi pasif sebagai default dan kasat mata secara kontekstual.
7. Mempertahankan keselamatan 100% Googlebot, Bingbot, sitemap, dan RSS.
8. Tidak mengubah satu baris pun kode aplikasi produksi atau pengaturan database/storage.

---
*Dokumen ini merupakan cetak biru resmi yang telah dikeraskan untuk arsitektur perlindungan konten dan DNA publikasi RancangLoka.*
*Status: `CONTENT_PROTECTION_BLUEPRINT_HARDENED`*
*Siap untuk perencanaan teknis implementasi tahap CONTENT_PROTECTION-1A setelah disetujui Chief Editor.*
