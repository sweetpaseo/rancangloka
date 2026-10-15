# 🛡️ RancangLoka — Content Protection & Security Architecture Blueprint (CONTENT_PROTECTION-1)

**Milestone:** `CONTENT_PROTECTION-1`  
**Status:** `AUDIT & ARCHITECTURAL DESIGN COMPLETED` (Implementation Not Started — Pending Chief Editor Authorization)  
**Parent Document:** `docs/BLUEPRINT.md`  
**Target Repository:** `rancangloka-astro/`  
**Current Production Worker:** `1ec3dfd1-60b9-493f-aa48-ea63ea1dde0f`  
**Date:** 2026-10-15  

---

## 1. Executive Summary & Core Engineering Philosophy

### The Inescapable Truth
> **"PUBLIC WEB CONTENT CANNOT BE MADE IMPOSSIBLE TO COPY."**  
> Jika sebuah halaman web dapat ditampilkan di layar pembaca manusia dan dibaca oleh mesin peramban (browser) atau mesin pencari (search engine), maka teks dan gambar di halaman tersebut **secara matematis dan teknis dapat disalin**.

Tujuan dari inisiatif **CONTENT_PROTECTION-1** bukanlah ilusi perlindungan palsu (*fake anti-copy protection*) yang merusak pengalaman pembaca atau membunuh SEO.  

### Objektif Strategis RancangLoka:
1. **Melindungi Infrastruktur & Anggaran Origin:** Menghentikan ekstraksi massal (*aggressive scraping*) yang membebani Cloudflare Workers invocation dan kuota baca D1.
2. **Membedakan Bot Sah vs Bot Liar:** Menjamin Googlebot, Bingbot, dan bot jejaring sosial tetap mendapatkan akses cepat dan bersih tanpa hambatan verifikasi (*zero friction*), sembari mendeteksi dan mengendalikan bot ekstraktor liar.
3. **Mencegah Hotlinking Media yang Boros Bandwidth:** Melindungi aset gambar dan derivatif WebP di Cloudflare R2 agar tidak dieksploitasi situs pihak ketiga sebagai CDN gratis.
4. **Menegakkan Provenansi & Jejak Hak Cipta:** Mempertahankan tanda terima publikasi kriptografis (*content hash* dan *timestamp*), watermark beretika pada media, serta atribusi editorial yang tak terbantahkan.
5. **Mempertahankan Nilai Inti Web:** Zero kerusakan pada Core Web Vitals (LCP, INP, CLS), zero perusakan aksesibilitas pembaca, zero pemutusan sindikasi RSS atau sitemap, dan zero taktik *security theater*.

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
| **Cache-Control HTML** | `src/middleware.ts` (L142–146) | **TEMUAN KRITIS:** `no-cache, no-store, must-revalidate` diterapkan pada seluruh halaman non-media/non-asset! Cloudflare Edge tidak meng-cache HTML artikel sama sekali; setiap hit scraper langsung memicu SSR penuh dan 6–7 query D1! |
| **Rute Artikel Publik** | `src/pages/[slug].astro` | SSR dinamis. Membaca D1: `getPublishedArticleBySlug`, `getPageBySlug`, `getAllCategories`, `getSiteSettings`, `getRelatedArticles`, `getInternalLinkCandidates`, `getActivePlaneALinks`. Sanitasi HTML aktif via `sanitizeArticleHtml`. |
| **Media Delivery Route** | `src/pages/media/[...key].ts` | Menangani `/media/images/...` dan `/media/thumbnails/...`. Proteksi traversal path aktif (`..`, backslash, null bytes, double-decode). Cache 1 tahun immutable untuk derivatif valid. **GAP:** Zero hotlinking check, zero rate limit. |
| **Robots Directives** | `public/robots.txt` | Aturan dasar: `Allow: /`, `Disallow: /admin/`, `Disallow: /api/`. Daftar 5 sitemap. **GAP:** Belum ada deklarasi spesifik untuk crawler AI (GPTBot, CCBot, ClaudeBot, dll). |
| **Sitemap XML** | `src/pages/sitemap*.ts` | Master sitemap index, post sitemap, page, category, dan news sitemap. Dilengkapi Google Image Sitemap tags (`<image:loc>`, `<image:title>`). Cache 1 jam browser, 24 jam CDN. |
| **Sindikasi RSS** | `src/pages/rss.xml.ts` | Menghasilkan RSS 2.0. **FAKTA BAIK:** Naskah penuh TIDAK terekspos; hanya memuat judul, ringkasan pendek (`a.description`), kategori, dan atribusi URL kanonikal. Cache 30m/2h. |
| **Pencarian Publik API** | `src/pages/api/search.json.ts` | Endpoint publik GET `?q=`. **GAP:** Mengekspos field metadata internal (`content_hash`, `views`, `key_takeaways`, `focus_keyword`) dalam payload JSON. |
| **Watermark Engine** | `src/lib/watermark/` & `stored-image-artifact.ts` | Model pengaturan watermark di D1 (`watermark_settings`) dan master asset di R2 (`site/watermarks/master/`). LokaMedia menerapkan watermark teks `rancangloka.com` deterministik (posisi bottom-right, opacity 0.62) saat pembuatan gambar. |
| **Cloudflare WAF / Rules** | Repositori / Edge | Belum ada aturan WAF custom atau rate-limit rule yang tercatat dalam repo. |

---

## 3. Peta Permukaan Perlindungan (Protection Surface Map)

| Domain Aset | Jalur / Rute | Klasifikasi Akses | Sifat Perlindungan |
|---|---|---|---|
| **A. Public Article HTML** | `/[slug]`, `/` | `PUBLIC` | `SEARCH_DISCOVERY_REQUIRED`. Wajib cepat, mudah diindeks, zero-JS friendly. Perlu edge caching & anti-burst abuse protection. |
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
| **Scraper Agresif / Bot Liar** | Ekstraksi seluruh korpus artikel dalam hitungan detik | TINGGI | TINGGI | Zero-JS render biasa | Cache-Control `no-store` memicu D1 spike & Worker exhaustion | Edge Cache Rule + Progressive Rate Limiting di Edge |
| **Pencuri Konten (Cloner Sites)** | Mengkloning naskah dan mempublikasikan ulang tanpa sitasi | TINGGI | SEDANG | Watermark teks LokaMedia pada media | Prosa teks tidak memiliki tanda bukti otomatis selain sitemap | Semantik Provenance JSON-LD + Content Hash Header + Feed Summary Only |
| **Hotlinker Gambar** | Memasang URL `/media/...` di situs luar sebagai CDN gambar | TINGGI | SEDANG | None (Worker mengalirkan stream R2 ke siapa saja) | Beban bandwidth egress R2 dan Worker CPU melonjak | Header Referer Filtering + Blanket Hotlink Defense (allow blank/search/own) |
| **AI Harvester Liar (Tanpa Izin)** | Menelan seluruh naskah untuk training LLM komersial | TINGGI | SEDANG | None | `robots.txt` belum memuat crawler AI spesifik | Deklarasi robots.txt untuk AI bot + WAF Managed Rule (Cloudflare AI Labyrinth / Block) |
| **Penyerang / Enumerator API** | Menyerang `/api/search.json` dengan kamus kata kunci | SEDANG | RENDAH | None (query 50 artikel per request) | Membocorkan views, keyword, takeaways, dan membebani D1 | Prune JSON payload (whitelist fields) + IP Rate Limit pada API search |
| **Bot Palsu (Spoofed Googlebot)** | Memalsukan User-Agent `Googlebot` untuk membobol proteksi | TINGGI | SEDANG | None | Verifikasi User-Agent berbasis string mudah dipalsukan | Cloudflare Verified Bots engine (ASN / reverse DNS verification) |
| **Sitemap Exploiter** | Membaca sitemap untuk melakukan sekuensial scraping | TINGGI | SEDANG | None (Sitemap publik normal) | Pemindaian otomatis seluruh URL terbit dalam hitungan menit | Edge Cache Sitemap (24 jam) + Rate limit anomali penelusuran cepat |
| **Brute-Force Admin** | Mencoba menebak password pada `/admin/login` | SEDANG | TINGGI | PBKDF2 hash, redirect guard | Tidak ada rate limit login atau Turnstile di form | Rate limiting login endpoint + Cloudflare Turnstile challenge |

---

## 5. Model Kepercayaan Crawler (Crawler Trust Model)

### Larangan Keras: Mengandalkan `User-Agent` Semata
Header `User-Agent` adalah string teks bebas yang dapat dipalsukan (*spoofed*) oleh skrip 3 baris Python/cURL. **Dilarang keras memberikan bypass keamanan hanya karena request menyertakan teks `Googlebot`**.

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
         ├──► 3. KNOWN_AI_BOT (GPTBot, ClaudeBot, CCBot, Bytespider, PerplexityBot)
         │       Verification: Verified Crawler list / Official CIDR
         │       Policy: GOVERNED BY CHIEF EDITOR POLICY (Allow, Rate-Limit, or Block)
         │
         ├──► 4. UNKNOWN_BOT / HEADLESS BROWSER (curl, python-requests, Puppeteer, Go-http)
         │       Verification: Unverified UA, Missing standard browser headers (sec-ch-ua, Accept-Language)
         │       Policy: RATE LIMITED, AGGRESSIVE SCRAPING -> MANAGED CHALLENGE
         │
         └──► 5. ABUSIVE_AUTOMATION (Rapid burst, sitemap walker loop, scrapers rotating IPs)
                 Verification: High velocity, sequential 404 enumeration, abnormal hit ratio
                 Policy: PROGRESSIVE ESCALATION (Observe -> Soft Rate Limit -> Block/Drop)
```

> **Catatan Kemampuan Cloudflare (`CAPABILITY_REQUIRES_PLAN_VERIFICATION`):**  
> Fitur *Cloudflare Verified Bots* tersedia secara gratis di semua paket (termasuk Free tier) melalui ekspresi WAF `cf.bot_management.verified_bot`. Namun, fitur tingkat lanjut seperti *Bot Management Score (1–99)* atau *Super Bot Fight Mode* membutuhkan paket Pro/Business/Enterprise.

---

## 6. Kebijakan Mesin Pencari & Keselamatan Pengindeksan (Search Engine Safety)

Googlebot dan Bingbot adalah urat nadi distribusi pembaca RancangLoka. Setiap kebijakan proteksi konten yang merusak pengindeksan adalah **kegagalan fatal**.

### Invarian Keselamatan Pengindeksan (Hard Invariants):
1. **Zero JavaScript Challenge untuk Search Engines:** WAF rule dilarang menampilkan Turnstile/CAPTCHA/JS Challenge kepada request yang terverifikasi sebagai `cf.bot_management.verified_bot`.
2. **Preservasi Google Image Indexing:** Aset `/media/*` dan `<image:image>` dalam sitemap XML tidak boleh dihalangi oleh hotlink defense jika pengakses adalah bot pencari gambar (*Googlebot-Image*).
3. **Canonical Header & URL Terlindungi:** Header `Link: <https://rancangloka.com/...>; rel="canonical"` dan meta tag kanonikal tetap disajikan utuh.
4. **Sitemap & RSS Selalu Bebas Tantangan:** Endpoint `/sitemap*.xml` dan `/rss.xml` bebas dari tantangan interaktif agar RSS reader dan crawler sitemap tidak terputus.

---

## 7. Kebijakan AI Crawler (Robots vs Network Enforcement)

### Dua Lapisan Pengendalian:
1. **Robots.txt Directive (Voluntary):** Petunjuk etis standar industri yang dipatuhi oleh penyedia AI bereputasi baik (OpenAI, Anthropic, Google). Biaya komputasi: nol.
2. **Network WAF Enforcement (Hard Control):** Pemblokiran atau penahanan di Cloudflare Edge. Berlaku untuk bot yang mengabaikan `robots.txt` (misalnya scraper anonim atau crawler liar).

### Opsi Keputusan untuk Chief Editor:

```
+---------------------------------------------------------------------------------------------------------+
| OPSI A: OPEN CITATION POLICY (Rekomendasi RancangLoka)                                                  |
| - Robots.txt: Izinkan AI Search (PerplexityBot, SearchGPT) agar RancangLoka dirujuk sebagai sumber.    |
| - Disallow: Training bot murni (CCBot, Bytespider, Diffbot) yang hanya mengambil data tanpa rujukan.    |
| - Dampak: RancangLoka tetap muncul di jawaban AI generik dengan link sitasi, tapi korpus tidak ditelan. |
+---------------------------------------------------------------------------------------------------------+
| OPSI B: TOTAL AI DISALLOW (Strict Proprietary)                                                          |
| - Robots.txt & WAF: Blokir seluruh AI bot (GPTBot, ClaudeBot, PerplexityBot, CCBot, dll).              |
| - Dampak: Nol paparan ke model AI; risiko trafik rujukan AI menjadi 0. Scraper liar tetap harus ditahan |
|   lewat WAF karena sering mengabaikan robots.txt.                                                       |
+---------------------------------------------------------------------------------------------------------+
| OPSI C: FULLY OPEN (Permissive)                                                                         |
| - Izinkan semua crawler AI tanpa batasan robots.                                                        |
| - Dampak: Konten diserap penuh ke model LLM; beban bandwidth edge lebih tinggi.                         |
+---------------------------------------------------------------------------------------------------------+
```

---

## 8. Arsitektur Pertahanan Laju & Caching Edge (Scraping Rate Defense)

### Masalah Utama yang Ditemukan dalam Audit:
Pada `src/middleware.ts`, baris 143:
```typescript
response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
```
Setiap halaman artikel publik diperintahkan untuk **tidak di-cache**. Ini berarti jika scraper mengirimkan 50 request per detik ke 50 artikel berbeda:
- 50 Worker invocations berjalan di edge.
- 50 × 7 query = **350 read operations ke Cloudflare D1 per detik**!
- Ini dapat menghabiskan kuota harian D1 dan memicu pelambatan database.

### Solusi Lapisan Caching & Rate Defense Terpadu:
1. **Edge Cache untuk Artikel Publik (Edge Stale-While-Revalidate):**
   - Publikasikan artikel dengan header `Cache-Control: public, max-age=60, s-maxage=3600, stale-while-revalidate=86400`.
   - Hasil: 98% request scraper berulang dilayani langsung dari Cloudflare Edge Cache (**0 CPU Worker, 0 D1 Reads**)!
   - Mekanisme Purge: Saat artikel diperbarui atau diterbitkan, panggil Cloudflare Cache Purge API untuk URL tersebut.
2. **Progressive Rate Limiting di Edge (Cloudflare WAF Custom Rules):**
   - *Ambang Batas Pengamatan (Baseline Observation):* Catat trafik normal sebelum mengaktifkan aksi pemblokiran (*block*).
   - *Eskalasi Bertingkat:*
     - Laju Wajar (Normal Reader): $< 30$ req/menit $\rightarrow$ **ALLOW (Edge Cached)**
     - Laju Mencurigakan (Unverified Bot Burst): $> 60$ req/menit $\rightarrow$ **MANAGED CHALLENGE** (Turnstile non-intrusif)
     - Laju Abusif (Rapid Harvester): $> 180$ req/menit $\rightarrow$ **TEMPORARY BLOCK (HTTP 429)** selama 10 menit.

---

## 9. Proteksi Media & Aset R2 (Hotlink Defense & Delivery)

### Audit Jalur Media RancangLoka:
- Rute: `https://rancangloka.com/media/...`
- Penyaji: `src/pages/media/[...key].ts` membaca R2 bucket `rancangloka-media`.
- Cache: `Cache-Control: public, max-age=31536000, immutable`.
- Format: Derivatif WebP 160x160 px (`/media/thumbnails/...`) dan gambar penuh WebP/JPEG (`/media/images/...`).

### Strategi Pertahanan Hotlink yang Ramah Ekosistem (Eco-Friendly Hotlink Defense):
Banyak skema hotlink protection yang salah kaprah memblokir request tanpa header `Referer`, sehingga merusak:
- Pengguna yang menggunakan ekstensi privasi / Tor / mode incognito (yang meniadakan Referer).
- Pengguna yang membuka gambar langsung di tab baru.
- Aplikasi messaging lokal.

### Aturan Hotlink Bersahaja RancangLoka:
```
IF request is for /media/*:
  IF Referer IS EMPTY:
    -> ALLOW (Direct view, privacy browser, messaging app)
  ELSE IF Referer HOSTNAME matches rancangloka.com OR *.rancangloka.com:
    -> ALLOW (Internal traffic)
  ELSE IF Referer HOSTNAME matches google.com, bing.com, yandex.com, etc.:
    -> ALLOW (Search engine preview & image search)
  ELSE IF Referer HOSTNAME matches localhost OR 127.0.0.1 (Dev mode):
    -> ALLOW
  ELSE:
    -> HOTLINK DETECTED:
       - Opsi 1: Sajikan gambar dengan watermark tegas / degradasi kualitas.
       - Opsi 2: Kembalikan HTTP 403 Forbidden dengan payload minimal (0 B).
```

---

## 10. Strategi Watermark & Identitas Visual

RancangLoka telah memiliki fondasi watermark di `src/lib/watermark/` dan `stored-image-artifact.ts`.

### Kebijakan Watermark Berdasarkan Tipe Aset:

| Tipe Aset Gambar | Rekomendasi Kebijakan | Alasan & Rasional |
|---|---|---|
| **Foto Arsitektur Dokumenter** | *NO VISIBLE WATERMARK* atau *Ultra-Subtle Bottom Corner* | Watermark besar merusak estetika premium majalah arsitektur dan mengganggu apresiasi spasial detail bangunan. |
| **Visual Konsep Editorial (Generated by Budi)** | *SUBTLE TEXT WATERMARK* (`rancangloka.com` di pojok kanan bawah, opacity 0.5–0.6) | Melindungi aset konsep dari pencurian langsung sembari mempertahankan transparansi asal-usul visual. |
| **Infografis / Diagram / Komparasi** | *BRANDED BANNER / INTEGRATED WATERMARK* | Diagram teknis dan tabel komparasi adalah kekayaan intelektual murni redaksi; logo RancangLoka menyatu secara elegan di dalam grafik. |
| **Gambar Sumber Produk (Product Review)** | *NO WATERMARK* | Gambar produk dari manufaktur/marketplace bukan milik eksklusif RancangLoka; dilarang mengklaim kepemilikan visual produk pihak ketiga. |
| **Aset Turunan Media Sosial** | *EXPLICIT CORNER BADGE* | Format media sosial (Instagram, X, Facebook) dibaca di luar situs; membutuhkan atribusi jelas untuk menarik pembaca kembali ke web. |

---

## 11. Lapisan Provenansi Kriptografis (Cryptographic Provenance Layer)

Bukan DRM (Digital Rights Management), melainkan sistem bukti forensik pasif (*passive cryptographic provenance*):

1. **Content Hash Tubuh Artikel:** `content_hash` SHA-256 yang dihitung secara deterministik atas naskah markdown kanonikal (`content_md`).
2. **Metadata Header HTTP Pasif:**
   Menyuntikkan header ringan yang tidak mengganggu rendering:
   ```http
   X-RL-Provenance-Hash: 12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28
   X-RL-Published-At: 2026-10-15T16:00:00Z
   ```
3. **Structured Data JSON-LD:**
   Skema Schema.org `Article` yang memuat:
   - `author`: Nama staf redaksi dan URL profil.
   - `publisher`: `RancangLoka` dengan URL logo kanonikal.
   - `datePublished` & `dateModified`: Stempel waktu ISO-8601 bersertifikat tanda terima D1.
   - `mainEntityOfPage`: URL kanonikal permanen.
4. **Tanda Terima Publikasi Abadi (Immutable Run Receipts):**
   Tabel D1 `publication_runs` dan `run_ledger` mencatat `receipt_id`, `plan_id`, `execution_id`, dan waktu publikasi aktual. Jika ada pihak yang mengklaim naskah, RancangLoka memiliki bukti catatan penerbitan terdahulu di Cloudflare D1.

---

## 12. Kebijakan Sindikasi Feed & Sitemap

### 1. Kebijakan RSS (`/rss.xml`):
- **Temuan Audit:** Repositori saat ini (`src/pages/rss.xml.ts`) sudah menggunakan format aman:
  ```xml
  <description><![CDATA[RANCANGLOKA – {description} (Sumber: {url})]]></description>
  ```
- **Prinsip:** **TIDAK MENGELUARKAN FULL CONTENT**. Hanya menyajikan ringkasan 1-2 kalimat beserta tautan sumber resmi. Scraper yang mengandalkan RSS parser otomatis hanya akan mendapatkan ringkasan singkat, bukan seluruh isi naskah.
- **Rekomendasi:** Pertahankan format saat ini, jangan ubah menjadi full-text feed.

### 2. Kebijakan Sitemap (`/sitemap.xml`, `/sitemap-news.xml`):
- Sitemap adalah kompas resmi bagi Googlebot. Menyembunyikan sitemap adalah tindakan kontra-produktif.
- **Proteksi:** Sitemap di-cache di Cloudflare Edge selama 24 jam (`s-maxage=86400`). Request ke sitemap dilayani murni dari cache Cloudflare, mencegah bot membebani D1 untuk memetakan seluruh artikel.

---

## 13. Audit Paparan API Publik & Perapihan Payload

### Audit `src/pages/api/search.json.ts`:
Saat ini endpoint search publik mengembalikan seluruh objek `Article` yang difilter:
```typescript
// Saat ini: mengembalikan semua kolom db
const filtered = articles.filter(...).slice(0, 8);
return new Response(JSON.stringify(filtered));
```
Objek ini memuat kolom-kolom internal yang tidak dibutuhkan oleh antarmuka pencarian publik:
- `content_hash`
- `views`
- `key_takeaways`
- `focus_keyword`
- `is_trending`, `is_sponsored`, `disable_internal_links`

### Rekomendasi Pemangkasan Field (Field Whitelisting):
Ubah payload keluaran `search.json.ts` hanya menyajikan subset data yang benar-benar ditampilkan UI pencarian:
```typescript
const safeResults = filtered.map(a => ({
  title: a.title,
  slug: a.slug,
  description: a.description,
  category_name: a.category_name,
  category_color: a.category_color,
  featured_image: a.featured_image,
  reading_time_minutes: a.reading_time_minutes
}));
```
Hal ini menghemat bandwidth payload hingga ~65% dan menutup celah kebocoran metrik internal redaksi.

---

## 14. Keamanan Admin & Mission Control

### Status Saat Ini (Sudah Sangat Kokoh):
1. **Middleware Auth Barrier:** Seluruh rute `/admin/*` (kecuali login/logout) mewajibkan cookie sesi PBKDF2 SHA-256 yang valid. Redirect ke `/admin/login` dengan header `Cache-Control: no-store, private`.
2. **CSRF Barrier:** Rute `/api/admin/*` memverifikasi header `Origin` vs `Host` untuk semua metode mutasi (`POST`, `PUT`, `PATCH`, `DELETE`).
3. **Media Device Firewall:** Token perangkat media (`lkmd_`) diblokir total dari seluruh rute `/api/admin/*`.
4. **Stealth Search Indexing:** Header `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` disuntikkan secara otomatis pada semua respons admin.

### Rekomendasi Peningkatan Masa Depan (Non-Breaking):
- Tambahkan rate-limit ketat pada rute `/admin/login` (maksimal 5 percobaan gagal per 15 menit per IP).
- Integrasikan Cloudflare Turnstile opsional pada formulir login admin untuk mitigasi serangan brute-force otomatis.

---

## 15. Audit & Rekomendasi Header Keamanan (Security Headers)

| Header HTTP | Status Saat Ini | Klasifikasi | Tindakan yang Direkomendasikan |
|---|---|---|---|
| `X-Content-Type-Options` | `nosniff` | `PRESENT` | Pertahankan (mencegah MIME sniffing). |
| `X-Frame-Options` | `SAMEORIGIN` | `PRESENT` | Pertahankan (mencegah clickjacking). |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `PRESENT` | Pertahankan (melindungi privasi URL referer). |
| `Permissions-Policy` | `camera=(), microphone=(), ...` | `PRESENT` | Pertahankan (menonaktifkan API perangkat berlebih). |
| `Strict-Transport-Security` | `max-age=31536000; preload` | `PRESENT` | Pertahankan (menegakkan HTTPS penuh). |
| `Content-Security-Policy` (CSP) | *TIDAK ADA* | `MISSING` | **Rekomendasi Tahap 1C:** Terapkan CSP terukur yang mengizinkan font Google, gambar Unsplash/R2, dan Cloudflare Turnstile, tanpa merusak inline styles Astro. |
| `X-Robots-Tag` | Aktif pada `/admin` & `/api/admin` | `PRESENT` | Pertahankan. |

---

## 16. Penolakan Tegas Taktik "Security Theater" (What We REJECT)

RancangLoka secara sadar dan eksplisit **MENOLAK** taktik-taktik berikut karena merupakan ilusi keamanan (*security theater*) yang merusak reputasi media:

1. ❌ **Menonaktifkan Klik Kanan (`contextmenu` blocking):**
   - *Alasan Penolakan:* Sangat mudah dilewati (cukup matikan JS atau gunakan inspect element), mempermalukan media di mata pembaca profesional, dan merusak aksesibilitas pembaca tunanetra atau pengguna trackpad.
2. ❌ **Menonaktifkan Seleksi Teks (`user-select: none`):**
   - *Alasan Penolakan:* Menjengkelkan pembaca yang ingin mencatat istilah teknis atau mengutip 1 kalimat; sama sekali tidak menghentikan scraper yang mengambil HTML via cURL/Python.
3. ❌ **Pengaburan DOM / Obfuscated HTML (misal merender teks sebagai canvas atau font berantakan):**
   - *Alasan Penolakan:* Menghancurkan SEO Google secara total, membuat pembaca layar tunanetra tidak bisa membaca artikel, dan merusak skor Lighthouse secara masif.
4. ❌ **Enkripsi Sisi Klien Naskah Publik:**
   - *Alasan Penolakan:* Kunci dekripsi harus dikirimkan ke browser untuk merender teks di layar; scraper tinggal mengeksekusi fungsi dekripsi yang sama di Node/Puppeteer.
5. ❌ **Tantangan CAPTCHA / Turnstile Universal pada Seluruh Halaman Artikel:**
   - *Alasan Penolakan:* Membunuh rasio pentalan (*bounce rate*), merusak First Contentful Paint (FCP), dan memperlakukan setiap manusia normal layaknya penjahat.
6. ❌ **Signed URL Kedaluwarsa untuk Gambar Artikel Publik:**
   - *Alasan Penolakan:* Membunuh browser caching, merusak Cloudflare Edge cache hit ratio, dan menggagalkan pengindeksan Google Images.
7. ❌ **Paywall Wajib Login untuk Membaca:**
   - *Alasan Penolakan:* Bertentangan dengan identitas RancangLoka sebagai media terbuka publik yang mudah diakses seluruh pemilik rumah di Indonesia.

---

## 17. Telemetri & Observabilitas Dimas (Mission Control Integration)

Perlindungan konten bukan sistem bisu. Dimas (Operational Intelligence & Telemetry) memantau anomali di Mission Control:

### Metrik & Sinyal Anomali Terukur:
1. `SCRAPER_BURST_DETECTED`: Lonjakan request $> 60$ req/menit dari rentang IP atau subnet tertentu ke rute artikel.
2. `HOTLINK_SPIKE`: Lonjakan request `/media/*` dengan header `Referer` dari domain asing yang tidak dikenal.
3. `MEDIA_BANDWIDTH_ANOMALY`: Lonjakan volume transfer data keluar (egress) R2 melebihi batas baseline harian.
4. `UNVERIFIED_BOT_VOLUME`: Bot tak dikenal yang mengaku Googlebot tetapi gagal verifikasi `cf.bot_management.verified_bot`.
5. `ADMIN_LOGIN_BURST`: Lebih dari 5 percobaan login gagal dalam 10 menit.

### Tingkat Keparahan (Severity Scale):
- **`INFO`**: Crawler sah terverifikasi (Google, Bing) melakukan penelusuran korpus normal.
- **`WATCH`**: Crawler tak dikenal melakukan crawling dengan kecepatan moderat.
- **`WARNING`**: Indikasi hotlinking dari domain eksternal atau scraper yang mendekati ambang batas laju.
- **`CRITICAL`**: Serangan scraping masif yang memicu lonjakan CPU Worker atau percobaan intrusi admin.

---

## 18. Privasi Pembaca (Privacy Guarantees)

- **Zero Invasive Fingerprinting:** Dilarang mengumpulkan sidik jari kanvas (*canvas fingerprinting*), audio context, atau data sensor perangkat pembaca.
- **Minimisasi Log IP:** Log keamanan di level aplikasi hanya mencatat hash subnet/IP terpotong (misal: `/24` pada IPv4 atau `/48` pada IPv6) untuk deteksi laju sementara, tanpa menyimpan riwayat penjelajahan pembaca individual.
- **Kepatuhan Etis:** Telemetri murni difokuskan pada perlindungan infrastruktur server dan atribusi hak cipta naskah.

---

## 19. Estimasi Dampak Kinerja & Anggaran Biaya (Performance & Cost Analysis)

| Dimensi | Dampak yang Diharapkan | Rasional Teknik |
|---|---|---|
| **CPU Worker** | **TURUN 60–80%** | Penerapan Edge Caching pada artikel publik menghilangkan beban eksekusi SSR berulang untuk trafik bot/scraper. |
| **D1 Database Reads** | **TURUN 70–90%** | Sebagian besar pembacaan artikel dilayani langsung dari Cloudflare Edge Cache tanpa menyentuh D1. |
| **R2 Bandwidth** | **TERKONTROL** | Hotlink defense mencegah pencurian bandwidth gambar oleh situs eksternal. |
| **TTFB (Time to First Byte)** | **LEBIH CEPAT** | Artikel yang di-cache di edge merespons dalam 15–35 ms (vs 120–250 ms SSR penuh). |
| **Lighthouse / Core Web Vitals** | **TIDAK ADA REGRESI (100/100)** | Zero client-side JS ditambahkan; zero layout shift; zero dynamic script blocking. |
| **Biaya Tambahan Cloudflare** | **Rp 0 / TERCANGKUP** | Memanfaatkan kapabilitas bawaan Cloudflare WAF free tier, Cache Rules, dan ekspresi bot terverifikasi. (*CAPABILITY_REQUIRES_PLAN_VERIFICATION* untuk fitur Pro lanjutan). |

---

## 20. Rencana Tahapan Implementasi Terukur (Phased Implementation Roadmap)

```
[ CONTENT_PROTECTION-1 ] (Audit & Blueprint) ➔ SELESAI
         │
         ▼
[ CONTENT_PROTECTION-1A ] (Fondasi Edge Caching & Pembersihan API)
  - Penyesuaian Cache-Control artikel publik (Edge caching aman via Cloudflare Cache Rules)
  - Pemangkasan payload /api/search.json (hanya field publik)
  - Penyempurnaan robots.txt dengan direktif AI crawler etis
         │
         ▼
[ CONTENT_PROTECTION-1B ] (Hotlink Defense & Proteksi Media R2)
  - Implementasi Referer-based hotlink validation pada /media/[...key].ts
  - Pengecualian eksplisit untuk Googlebot-Image, pratinjau medsos, dan referer kosong
  - Penerapan watermark teks LokaMedia yang konsisten pada visual konsep
         │
         ▼
[ CONTENT_PROTECTION-1C ] (Cloudflare WAF Custom Rules & Progressive Rate Limiting)
  - WAF Rule: Bypass verifikasi penuh untuk cf.bot_management.verified_bot
  - Rate Limiting Rule: Tantangan Turnstile untuk burst scraper tak dikenal (> 60 req/menit)
  - Perlindungan rute login admin
         │
         ▼
[ CONTENT_PROTECTION-1D ] (Observabilitas Dimas & Anomali Telemetri)
  - Integrasi event telemetri keamanan ke Mission Control
  - Dashboard pemantauan bandwidth media dan rasio cache hit
```

---

## 21. Antrean Keputusan Chief Editor (Chief Editor Decision Queue)

Terdapat **5 keputusan kebijakan strategis** yang memerlukan arahan Chief Editor sebelum implementasi kode dimulai:

### Keputusan 1: Kebijakan Crawler AI (AI Crawler Policy)
- **Opsi A (Direkomendasikan):** *Open Citation & Selective Disallow*. Izinkan bot pencari (PerplexityBot, SearchGPT) agar artikel RancangLoka dirujuk dengan link balik, tetapi larang bot penelan korpus murni (CCBot, Bytespider, Diffbot) via `robots.txt`.
- **Opsi B:** *Strict AI Block*. Blokir seluruh crawler AI di `robots.txt` dan WAF. (Konsekuensi: Nol paparan data ke AI, namun nol rujukan dari mesin AI).
- **Opsi C:** *Fully Open*. Buka penuh untuk seluruh bot AI.
- **Rekomendasi:** **OPSI A**. Menyeimbangkan perlindungan korpus dengan visibilitas rujukan mesin pencari generasi baru.

### Keputusan 2: Kebijakan Watermark Visual Redaksi (Visual Watermark Policy)
- **Opsi A (Direkomendasikan):** Terapkan watermark teks halus (`rancangloka.com` opacity 0.5–0.6 di pojok bawah) hanya pada **Visual Konsep Editorial** yang dihasilkan Budi dan **Infografis/Diagram**. Biarkan foto arsitektur dokumenter murni bersih tanpa watermark.
- **Opsi B:** Berikan watermark pada seluruh gambar tanpa pengecualian. (Konsekuensi: Menurunkan cita rasa estetika majalah arsitektur premium).
- **Opsi C:** Nol watermark pada seluruh gambar. (Konsekuensi: Gambar konsep mudah disalin tanpa jejak).
- **Rekomendasi:** **OPSI A**. Mempertahankan kemewahan visual arsitektur sembari melindungi aset infografis orisinal.

### Keputusan 3: Penanganan Sindikasi RSS Feed (RSS Syndication Policy)
- **Opsi A (Direkomendasikan):** Pertahankan format ringkasan saat ini (*Summary Only + Backlink Attribution*). Scraper feed hanya mendapatkan 1-2 kalimat deskripsi dan wajib mengunjungi situs untuk membaca artikel utuh.
- **Opsi B:** Sajikan naskah artikel penuh di RSS feed. (Konsekuensi: Memudahkan pembaca aplikasi RSS, tetapi memudahkan situs kloningan menduplikasi artikel secara instan).
- **Rekomendasi:** **OPSI A**. Standar emas industri media untuk melindungi konten dari sindikasi liar tak berizin.

### Keputusan 4: Tindakan terhadap Hotlinking Media (Hotlinking Enforcement Action)
- **Opsi A (Direkomendasikan):** Kembalikan respons *HTTP 403 Forbidden* ringan (0 byte) untuk request gambar dengan Referer asing mencurigakan. (Pengecualian: Referer kosong, Google, Bing, WhatsApp, Telegram tetap diizinkan).
- **Opsi B:** Alihkan (*redirect*) ke gambar banner kecil: *"Gambar ini berasal dari rancangloka.com"*. (Konsekuensi: Menggunakan sedikit bandwidth ekstra untuk promosi balik).
- **Rekomendasi:** **OPSI A**. Menghemat 100% bandwidth transfer dan komputasi edge.

### Keputusan 5: Tingkat Ketegasan terhadap Otomasi Tak Dikenal (Unidentified Automation Strictness)
- **Opsi A (Direkomendasikan):** *Progressive Defense*. Biarkan request bot tak dikenal selama lajunya santai ($< 30$ req/menit), beri tantangan (*Managed Challenge*) hanya saat melakukan burst ($> 60$ req/menit), dan blokir sementara jika abusif ($> 180$ req/menit).
- **Opsi B:** *Strict Challenge*. Tantang setiap peramban tanpa header lengkap. (Konsekuensi: Risiko false positive bagi pengguna peramban lawas atau privasi tinggi).
- **Rekomendasi:** **OPSI A**. Menjaga keterbukaan web dan meminimalkan friksi pembaca manusia.

---

## 22. Kriteria Penerimaan Arsitektur (Acceptance Criteria)

Blueprint ini dinyatakan lolos jika:
1. Menegakkan prinsip bahwa konten publik tidak dapat dikunci 100%, tetapi infrastruktur dan hak cipta dapat dilindungi secara efektif.
2. Mempertahankan 100% aksesibilitas bagi Googlebot, Bingbot, sitemap, dan RSS.
3. Menolak seluruh bentuk *security theater* (anti-klik kanan, seleksi teks, DOM obfuscation).
4. Menyajikan audit berbasis kode nyata dan mengidentifikasi celah krusial (termasuk *Cache-Control* HTML dan *field over-exposure*).
5. Tidak mengubah satu baris pun kode aplikasi produksi atau pengaturan database/storage.

---
*Dokumen ini merupakan cetak biru resmi untuk arsitektur perlindungan konten RancangLoka.*  
*Status: `CONTENT_PROTECTION_BLUEPRINT_PASS`*  
*Menunggu keputusan Chief Editor untuk melanjutkan ke implementasi `CONTENT_PROTECTION-1A`.*
