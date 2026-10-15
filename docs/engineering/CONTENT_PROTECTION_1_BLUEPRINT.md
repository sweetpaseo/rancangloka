# 🛡️ RancangLoka — Content Protection & Security Architecture Blueprint (CONTENT_PROTECTION-1)

**Milestone:** `CONTENT_PROTECTION-1`
**Status:** `AUDIT & ARCHITECTURAL BLUEPRINT HARDENED` (Implementation Not Authorized — Design & Hardening Completed)
**Parent Document:** `docs/BLUEPRINT.md`
**Target Repository:** `rancangloka-astro/`
**Current Production Worker:** `1ec3dfd1-60b9-493f-aa48-ea63ea1dde0f`
**Date:** 2026-10-15

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
| **Pencarian Publik API** | `src/pages/api/search.json.ts` | Endpoint publik GET `?q=`. **GAP:** Mengekspos field metadata internal (`content_hash`, `views`, `key_takeaways`, `focus_keyword`) dalam payload JSON. |
| **Watermark Engine** | `src/lib/watermark/` & `stored-image-artifact.ts` | Model pengaturan watermark di D1 (`watermark_settings`) dan master asset di R2 (`site/watermarks/master/`). LokaMedia mendukung watermark teks `rancangloka.com` deterministik (posisi bottom-right, opacity 0.62) saat pembuatan gambar. |
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
|    - Rare technical phrase signatures (istilah teknis arsitektur: thermal bridge, louver, dll)         |
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
|    - Perceptual image hash (pHash / dHash untuk deteksi gambar hasil crop/kompresi)                     |
|    - asset_id & source_type                                                                             |
|    - article_binding & derivative lineage                                                               |
|    - Label kebenaran asal-usul visual: EDITORIAL_CONCEPT_VISUAL                                         |
+---------------------------------------------------------------------------------------------------------+
```

### Bahasa & Status Deteksi Kloning (Clone Detection Language):
Sistem dilarang secara gegabah melabeli situs lain sebagai "pencuri" hanya berdasarkan kemiripan teks. Sistem analitik Dimas menggunakan status kandidat terukur:
- `LOW_SIMILARITY`: Kemiripan wajar akibat topik arsitektur yang sama.
- `REVIEW_REQUIRED`: Terdapat kemiripan frasa teknis langka dan struktur heading yang mencurigakan.
- `SUSPECTED_DERIVED_CONTENT`: Naskah parafrase berat dengan alur keputusan identik dan urutan paragraf serupa.
- `PROBABLE_CONTENT_CLONE`: Naskah identik, tabel identik, atau gambar dengan hash perceptual serupa yang dipublikasikan setelah stempel waktu RancangLoka.

*Ambang batas kemiripan (thresholds) TIDAK difinalisasi pada cetak biru ini; ambang batas akan dikalibrasi berdasarkan pengujian korpus.* Peninjauan manusia (*human review*) tetap wajib sebelum dilakukan eskalasi formal.

### Pemanfaatan Infrastruktur Provenansi yang Sudah Ada:
Publication DNA **TIDAK MEMBUAT SISTEM DUPLIKAT BARU**, melainkan memperluas infrastruktur yang sudah terbukti di RancangLoka:
- **Digunakan Kembali 100%:** `content_hash`, `published_at`, `actual_published_at`, tanda terima penerbitan (`publication_runs`), riwayat persetujuan manusia (`approval_records`), ID aset R2 (`asset_id`), dan tabel relasi `article_media`.
- **Tambahan Baru yang Dibutuhkan Nanti:** Tabel pembantu ringan di D1 untuk menyimpan n-gram/rare phrase hash (`article_dna_signatures`) dan perceptual hash gambar (`media_asset_phashes`).

### Pemisahan Tegas dari AI Text Detector:
> **`PUBLICATION DNA != AI TEXT DETECTION`**
- Publication DNA **sama sekali tidak bertujuan** mengoptimasi skor, memanipulasi, atau mengecoh detektor AI pihak ketiga (seperti ZeroGPT, GPTZero, Copyleaks, dsb).
- Skor dari AI detector berstatus **`ADVISORY ONLY`** (hanya pertimbangan penasihat).
- Kualitas kepenulisan manusia tetap dijaga oleh manusia dan staf redaksi internal (Joko, Nadia, Rina, Chief Editor).
- Provenansi dan kepemilikan naskah diatur secara independen oleh Publication DNA.

---

## 7. Kebijakan Mesin Pencari & Keselamatan Pengindeksan (Search Engine Safety)

Googlebot dan Bingbot adalah urat nadi distribusi pembaca RancangLoka. Setiap kebijakan proteksi konten yang merusak pengindeksan adalah **kegagalan fatal**.

### Invarian Keselamatan Pengindeksan (Hard Invariants):
1. **Zero JavaScript Challenge untuk Search Engines:** WAF rule dilarang menampilkan Turnstile/CAPTCHA/JS Challenge kepada request yang terverifikasi sebagai `cf.bot_management.verified_bot`.
2. **Preservasi Google Image Indexing:** Aset `/media/*` dan `<image:image>` dalam sitemap XML tidak boleh dihalangi oleh hotlink defense jika pengakses adalah bot pencari gambar (*Googlebot-Image*).
3. **Canonical Header & URL Terlindungi:** Header `Link: <https://rancangloka.com/...>; rel="canonical"` dan meta tag kanonikal tetap disajikan utuh.
4. **Sitemap & RSS Selalu Bebas Tantangan:** Endpoint `/sitemap*.xml` dan `/rss.xml` bebas dari tantangan interaktif agar RSS reader dan crawler sitemap tidak terputus.

---

## 8. Kebijakan AI Crawler (Robots vs Network Enforcement)

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

## 9. Arsitektur Pertahanan Laju & Caching Edge yang Aman (Safe Edge Caching)

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

## 10. Pertahanan Laju Adaptif Tanpa Ambang Batas Buatan (Adaptive Rate Defense)

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

## 11. Pertahanan Hotlink Bertahap (Staged Hotlink Defense)

### Keputusan Sementara Chief Editor (Provisional Decision):
**`OBSERVE_FIRST_THEN_SELECTIVE_403`:**
- Menolak strategi pengalihan ke banner promo (*redirect-to-banner*) karena membuang komputasi dan bandwidth.

### Tahapan Pelaksanaan:
- **FASE 1 (OBSERVE):** Pasang pencatatan telemetri di `/media/[...key].ts` untuk mengukur:
  - Domain `Referer` eksternal yang paling sering memanggil aset RancangLoka.
  - Persentase pembaca sah dengan `Referer` kosong (mode penyamaran, browser privasi).
  - Lalu lintas perayap gambar resmi (Googlebot-Image) dan aplikasi pesan instan.
- **FASE 2 (SELECTIVE ENFORCEMENT):**
  - Izinkan request dengan `Referer` kosong.
  - Izinkan request dari `rancangloka.com` dan mesin pencari terverifikasi.
  - Kembalikan *HTTP 403 Forbidden* ringan (0 byte) hanya untuk domain eksternal yang terbukti melakukan hotlinking abusif.
- Header `Referer` diposisikan murni sebagai sinyal penghematan bandwidth, bukan bukti otentikasi identitas yang kokoh.

---

## 12. Strategi Watermark Redaksional yang Dikoreksi

### Koreksi Cetak Biru:
Rekomendasi sebelumnya yang mewajibkan watermark 0.5–0.6 opacity pada setiap visual konsep **DIBATALKAN**.

### Prinsip Kanonikal:
> **`PUBLICATION_DNA_FIRST, VISIBLE_WATERMARK_SECONDARY`**
> *(DNA Publikasi adalah pertahanan utama; watermark kasat mata bersifat sekunder dan kontekstual.)*

### Kebijakan Sementara Chief Editor:
**`PASSIVE_PUBLICATION_DNA_DEFAULT, VISIBLE_WATERMARK_CONTEXTUAL_ONLY`**

| Kategori Visual | Kebijakan Watermark | Rasional Teknis & Estetika |
|---|---|---|
| **Foto Dokumenter Arsitektur** | *DEFAULT: NO VISIBLE WATERMARK* + Passive Provenance | Menjaga kemewahan estetika visual spasial dan detail bangunan; tidak merusak apresiasi fotografi. |
| **Visual Konsep Editorial (Budi)** | *DEFAULT: PASSIVE PROVENANCE*. (Watermark kasat mata opsional hanya jika diinstruksikan Chief Editor). | Provenansi dicatat di D1 (`EDITORIAL_CONCEPT_VISUAL`); watermark tidak dipaksakan secara seragam. |
| **Infografis & Diagram** | *INTEGRATED BRANDING* | Branding RancangLoka menyatu secara alami sebagai elemen desain diagram/tabel, bukan stempel mengganggu. |
| **Gambar Sumber Produk** | *NO RANCANGLOKA WATERMARK* | Menghormati hak kekayaan intelektual manufaktur; dilarang mengklaim gambar produk pihak ketiga. |
| **Aset Turunan Media Sosial** | *VISIBLE CORNER BADGE* | Format media sosial dibaca di platform pihak ketiga sehingga memerlukan penanda identitas yang lebih tegas. |

*Tingkat opasitas teks dilarang dikunci secara permanen sebelum dilakukan uji visual pada layar.*

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
Pangkas payload `search.json.ts` hanya menyajikan:
- `title`
- `slug`
- `description`
- `category_name`
- `category_color`
- `featured_image`
- `reading_time_minutes`

Menutup kebocoran metrik internal (`content_hash`, `views`, `key_takeaways`, `focus_keyword`) dan menghemat ukuran payload hingga ~65%.

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
  - Pembangkitan sidik jari n-gram, struktur, dan pHash media saat publikasi
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
3. Googlebot dan Bingbot terverifikasi menerima bypass tanpa tantangan JavaScript.
4. Seluruh bentuk *security theater* (anti-klik kanan, seleksi teks, DOM obfuscation, login-wall pembaca) ditolak mutlak.
5. Pemanfaatan infrastruktur provenansi yang sudah ada (`content_hash`, tanda terima D1) tanpa menduplikasi sistem.
6. Pemisahan mutlak: `PUBLICATION DNA != AI TEXT DETECTION` (Detektor AI eksternal bersifat *advisory only*).

### B. PROVISIONAL (Keputusan Sementara Chief Editor):
1. **AI Crawler:** `SELECTIVE AI ACCESS` (Izinkan mesin pencari/rujukan, larang penelan korpus pelatihan massal di robots).
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
2. Menghapus seluruh angka ambang batas rate-limit buatan dan menegakkan `RATE_LIMIT_THRESHOLDS_REQUIRE_BASELINE_OBSERVATION`.
3. Mengoreksi klaim reduksi performa menjadi hipotesis yang wajib diuji tolok ukurnya di produksi.
4. Menegaskan klasifikasi `CAPABILITY_REQUIRES_PLAN_VERIFICATION` pada fitur Cloudflare tingkat lanjut.
5. Memperbarui kebijakan watermark menjadi pasif sebagai default dan kasat mata secara kontekstual.
6. Mempertahankan keselamatan 100% Googlebot, Bingbot, sitemap, dan RSS.
7. Tidak mengubah satu baris pun kode aplikasi produksi atau pengaturan database/storage.

---
*Dokumen ini merupakan cetak biru resmi yang telah dikeraskan untuk arsitektur perlindungan konten dan DNA publikasi RancangLoka.*
*Status: `CONTENT_PROTECTION_BLUEPRINT_HARDENED`*
*Siap untuk perencanaan teknis implementasi tahap CONTENT_PROTECTION-1A setelah disetujui Chief Editor.*
