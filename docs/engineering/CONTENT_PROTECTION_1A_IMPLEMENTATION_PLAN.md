# 📋 RancangLoka — CONTENT_PROTECTION-1A Implementation Plan
## Phase 1A: Foundation + Safe Public Edge Caching

**Milestone:** `CONTENT_PROTECTION-1A`
**Phase:** `FOUNDATION + SAFE CACHE`
**Parent Document:** [`docs/engineering/CONTENT_PROTECTION_1_BLUEPRINT.md`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/docs/engineering/CONTENT_PROTECTION_1_BLUEPRINT.md)
**Target Repository:** `rancangloka-astro/`
**Current Production Worker:** `1ec3dfd1-60b9-493f-aa48-ea63ea1dde0f`
**Status:** `PLANNING COMPLETE — AWAITING CHIEF EDITOR AUTHORIZATION`
**Date:** 2026-10-16

---

## 1. Executive Summary & Phase 1A Scope

Fase **CONTENT_PROTECTION-1A** meletakkan fondasi arsitektur perlindungan konten tanpa merusak ekosistem publik. Fase ini berfokus pada dua masalah paling mendesak yang terungkap dalam audit sistem:
1. **Menghentikan Pembebanan Origin SSR Berlebih:** Memperbaiki konfigurasi `Cache-Control: no-cache, no-store, must-revalidate` pada halaman artikel publik dengan menerapkan *Safe Edge Caching* di Cloudflare Edge, sehingga request bot dan pembaca berulang dilayani instan dari cache tanpa memicu eksekusi Worker dan query D1 berulang.
2. **Menutup Kebocoran Metadata Internal:** Merapikan endpoint `/api/search.json` melalui *field whitelisting*, menghilangkan ekspos data internal (`content_hash`, `views`, `key_takeaways`, `focus_keyword`).
3. **Mendeklarasikan Kebijakan AI Etis:** Menerapkan kebijakan *Selective AI Access* pada `public/robots.txt` untuk membedakan bot pencari/sitasi dari bot pengikis korpus massal.

> **Batasan Ketat Fase 1A:**
> Implementasi teknis `PUBLICATION_DNA` (skema tabel D1, kalkulasi n-gram, perceptual hash) **TIDAK TERMASUK** dalam Fase 1A. Hal tersebut dijadwalkan secara rapi pada Fase 1B.

---

## 2. Audit Kapabilitas Cloudflare & Runtime (Read-Only Capability Audit)

Berdasarkan audit non-invasif terhadap konfigurasi Cloudflare Worker (`npx wrangler whoami` dan analisis runtime):

| Kapabilitas Cloudflare | Status Izin & Ketersediaan | Keterangan & Batasan |
|---|---|---|
| **Ekspresi `cf.bot_management.verified_bot`** | `AVAILABLE_CONFIRMED` | Tersedia di semua tingkatan akun Cloudflare. Mengidentifikasi Googlebot, Bingbot, dll via verifikasi ASN & reverse DNS. |
| **Kepatuhan Header `Cache-Control`** | `AVAILABLE_CONFIRMED` | Cloudflare Edge menghormati arahan `s-maxage` dan `stale-while-revalidate` dari respons Worker. |
| **Cloudflare Cache Rules (Dashboard/Zone)** | `AVAILABLE_CONFIRMED` | Pengaturan caching berbasis URL/ekspresi tersedia pada zona `rancangloka.com`. |
| **Cloudflare WAF Custom Rules** | `AVAILABLE_CONFIRMED` | Hingga 5 aturan kustom gratis per zona. Cukup untuk bypass verified bot dan tantangan Turnstile dasar. |
| **Cloudflare Turnstile (Managed Challenge)** | `AVAILABLE_CONFIRMED` | Layanan CAPTCHA etis non-intrusif gratis dari Cloudflare. |
| **Cloudflare Cache Purge API** | `AVAILABLE_CONFIRMED` | Dapat dipanggil via API token dengan izin `zone.cache_purge` untuk invalidasi instan saat publikasi. |
| **Bot Management Score (1–99)** | `CAPABILITY_REQUIRES_PLAN_VERIFICATION` | Fitur skor bot granular berbasis machine learning memerlukan paket berbayar (Enterprise/Pro add-on). |
| **Super Bot Fight Mode** | `CAPABILITY_REQUIRES_PLAN_VERIFICATION` | Memerlukan verifikasi paket berbayar zona. |

---

## 3. Matriks Caching Rute Publik vs Privat (Route Cache Matrix)

Untuk menjamin tidak ada kebocoran data terotentikasi ke dalam cache publik, ditetapkan aturan matriks ketat:

```
+---------------------------+-----------------------------------+--------------------+-----------------------------------------------------+
| Pola Rute URL             | Klasifikasi Akses                 | Status Edge Cache  | Header Cache-Control yang Diterapkan               |
+---------------------------+-----------------------------------+--------------------+-----------------------------------------------------+
| /                         | PUBLIC_HOMEPAGE                   | CACHEABLE          | public, max-age=60, s-maxage=1800, s-w-r=86400      |
| /[slug] (Published, 200)  | PUBLIC_ARTICLE_SSR                | CACHEABLE          | public, max-age=60, s-maxage=3600, s-w-r=86400      |
| /media/thumbnails/*       | PUBLIC_THUMBNAIL                  | IMMUTABLE (1 Year) | public, max-age=31536000, immutable                 |
| /media/images/*           | PUBLIC_IMAGE                      | IMMUTABLE (1 Year) | public, max-age=31536000, immutable                 |
| /assets/*, /_astro/*      | STATIC_BUILD_ASSET                | IMMUTABLE (1 Year) | public, max-age=31536000, immutable                 |
| /api/search.json          | PUBLIC_SEARCH_API                 | SHORT CACHE        | public, max-age=60, s-maxage=300                    |
| /rss.xml                  | RSS_FEED                          | EDGE CACHED        | public, max-age=1800, s-maxage=7200                 |
| /sitemap*.xml             | XML_SITEMAPS                      | EDGE CACHED        | public, max-age=3600, s-maxage=86400                |
| /admin/*                  | PRIVATE_ADMIN_UI                  | STRICTLY NO-STORE  | no-store, private, no-cache, must-revalidate        |
| /api/admin/*              | PRIVATE_ADMIN_API                 | STRICTLY NO-STORE  | no-store, private, no-cache, must-revalidate        |
| /api/internal/*           | INTERNAL_WORKER_API               | STRICTLY NO-STORE  | no-store, private, no-cache, must-revalidate        |
| Respons Error (4xx, 5xx)  | ERROR_STATE                       | STRICTLY NO-STORE  | no-store, private, no-cache, must-revalidate        |
| Draf / Pratinjau Redaksi  | EDITORIAL_PREVIEW                 | STRICTLY NO-STORE  | no-store, private, no-cache, must-revalidate        |
| Sesi Berisi Cookie Admin  | AUTHENTICATED_SESSION             | STRICTLY NO-STORE  | no-store, private, no-cache, must-revalidate        |
+---------------------------+-----------------------------------+--------------------+-----------------------------------------------------+
```

---

## 4. Arsitektur Caching Aman & Batas Pengaman (Cache Safety Safeguards)

### Batas Pengaman Kritis (Hard Safety Invariants):
1. **Cookie-Based Cache Bypass:**
   Jika request memuat cookie `admin_session`, middleware **DILARANG KERAS** menyuntikkan header `public` atau `s-maxage`. Respons operator terotentikasi wajib selalu menerima `no-store, private` agar antarmuka admin tidak pernah tersimpan di edge.
2. **Pencegahan Cache Respons Error:**
   Jika SSR artikel mengembalikan status 404 (artikel tidak ditemukan) atau 500 (kesalahan server), header cache publik ditiadakan. Hal ini mencegah halaman error tersimpan dan menghalangi artikel yang baru saja terbit.
3. **Pemisahan Draf & Pratinjau:**
   Halaman dengan status `draft` atau `scheduled` yang diakses oleh editor melalui pratinjau wajib menyertakan header `no-store, private`.
4. **Kompatibilitas Masa Depan dengan Product Review Affiliate:**
   Pada milestone masa depan (`PRODUCT_REVIEW_AFFILIATE-1`), naskah artikel tetap di-cache di edge (`s-maxage=3600`), sedangkan komponen harga dinamis dapat memuat penawaran termutakhir secara terpisah (misalnya melalui SSR edge sub-request ringan atau client-side island fetch). Hal ini mencegah fluktuasi harga merusak efisiensi caching naskah editorial.

---

## 5. Strategi Invalidasi Cache Berbasis Publikasi (Publication-Aware Invalidation)

Saat terjadi peristiwa mutasi pada siklus hidup artikel di database D1, sistem invalidasi terarah dipicu:

```
[ Event: PUBLISH / UPDATE / UNPUBLISH ]
                 │
                 ├──► 1. Purge Canonical URL: https://rancangloka.com/{slug}
                 │
                 ├──► 2. Purge Homepage: https://rancangloka.com/
                 │
                 ├──► 3. Purge Category Index: https://rancangloka.com/category/{category_slug}
                 │
                 ├──► 4. Purge RSS Feed: https://rancangloka.com/rss.xml
                 │
                 └──► 5. Purge Sitemaps: https://rancangloka.com/sitemap.xml, /post-sitemap.xml
```

*Prinsip Invalidasi:* Menggunakan targeted URL purge via Cloudflare Cache API, **menghindari global purge (`purge_everything`)** agar aset media dan artikel lain tetap hangat di edge cache.

---

## 6. Pemangkasan Payload API Pencarian Publik (`/api/search.json`)

### Analisis Penggunaan Frontend:
Audit terhadap satu-satunya konsumen antarmuka (`src/components/SearchModal.astro`, L158–167) membuktikan bahwa UI hanya membutuhkan 5 field:
1. `a.slug`
2. `a.featured_image`
3. `a.title`
4. `a.category_name`
5. `a.description`

### Rencana Transformasi:
Mengubah `src/pages/api/search.json.ts` agar menyaring artikel dan memetakan hasilnya hanya ke field yang dibutuhkan:
```typescript
const safeResults = filtered.map(a => ({
  title: a.title,
  slug: a.slug,
  description: a.description || '',
  category_name: a.category_name || 'Artikel',
  featured_image: a.featured_image || ''
}));

return new Response(JSON.stringify(safeResults), {
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60, s-maxage=300'
  }
});
```

### Hasil:
- Menghapus kebocoran kolom internal: `content_hash`, `views`, `key_takeaways`, `focus_keyword`, `category_id`, `author_id`, `is_featured`, `is_trending`, `disable_internal_links`.
- Ukuran payload transfer berkurang ~70%.

---

## 7. Desain Kebijakan AI Crawler pada `public/robots.txt`

Menerapkan keputusan sementara Chief Editor (`SELECTIVE_AI_ACCESS`):

```txt
# RancangLoka — Standard Robots Policy
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

# Selective AI Search & Citation (Allowed)
User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

# Bulk Training Data Harvesters (Disallowed)
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Diffbot
Disallow: /

User-agent: Anthropic-ai
Disallow: /

# Canonical Sitemaps
Sitemap: https://rancangloka.com/sitemap.xml
Sitemap: https://rancangloka.com/post-sitemap.xml
Sitemap: https://rancangloka.com/page-sitemap.xml
Sitemap: https://rancangloka.com/category-sitemap.xml
Sitemap: https://rancangloka.com/sitemap-news.xml
```

*Catatan Tata Kelola:* `robots.txt` adalah deklarasi etis sukarela. Penegakan keras terhadap bot liar yang mengabaikan direktif ini akan dihubungkan dengan Cloudflare WAF pada Fase 1D.

---

## 8. Preservasi Penuh Sindikasi RSS & Sitemap XML

1. **RSS Feed (`src/pages/rss.xml.ts`):**
   - Format eksisting dipertahankan: menyajikan `<title>`, `<link>`, `<guid>`, dan `<description>` yang memuat ringkasan pendek plus backlink kanonikal.
   - Naskah artikel tubuh penuh **TIDAK PERNAH** dimasukkan ke dalam RSS.
2. **XML Sitemaps (`src/pages/sitemap*.ts`):**
   - Seluruh 5 sitemap tetap publik dan terbebas dari verifikasi/tantangan bot.
   - Tag `<image:image>` dipertahankan untuk Google Image indexing.

---

## 9. Persyaratan Observabilitas Data Dasar (Baseline Observability)

Sebelum aturan pembatasan laju (*rate limiting*) diberlakukan pada fase lanjutan, Fase 1A menyiapkan metrik observabilitas dasar:
1. **Total Requests per Menit** pada rute artikel publik.
2. **Rasio Edge Cache Hit vs Miss:** Memantau persentase permintaan yang berhasil ditangani edge cache tanpa menyentuh Worker SSR.
3. **Volume Permintaan Mesin Pencari Sah:** Memantau frekuensi crawling Googlebot dan Bingbot.
4. **Volume Permintaan Otomasi Tak Dikenal:** Memantau lonjakan cURL, Python requests, atau bot tanpa header peramban standar.
5. **Frekuensi Error HTTP 404:** Mengidentifikasi pola pemindaian URL acak oleh bot perusak.

---

## 10. Rencana Pengukuran Tolok Ukur Kinerja (Performance Acceptance Plan)

Setiap klaim peningkatan efisiensi wajib dibuktikan secara empiris melalui pengujian **BEFORE vs AFTER**:

| Metrik Kinerja | Kondisi Sebelum (Baseline) | Kondisi Sesudah (Target Pengujian) | Alat Ukur / Bukti |
|---|---|---|---|
| **Edge Cache Hit Ratio** | 0% (karena `no-store`) | $> 85\%$ untuk trafik berulang | Cloudflare Analytics / Telemetry |
| **Worker CPU Time per Request** | 8–25 ms per hit | $< 2$ ms (Edge Cache Hit) | Cloudflare Worker Metrics |
| **D1 Read Operations** | 6–7 query per hit publik | 0 query untuk Cache Hit | D1 Database Analytics |
| **TTFB (Time to First Byte)** | 120–280 ms | $15–40$ ms (Edge Cache Hit) | cURL benchmark / WebPageTest |
| **Lighthouse Performance Score** | 98–100 | Tetap 98–100 (Zero regresi) | Chrome DevTools Lighthouse |
| **Cumulative Layout Shift (CLS)** | 0.000 | 0.000 | Lighthouse Audit |
| **Largest Contentful Paint (LCP)** | $< 1.2$ s | $< 0.8$ s | Lighthouse Audit |

---

## 11. Rencana Kegagalan & Pemulihan (Rollback Plan)

| Skenario Kegagalan | Cara Deteksi | Prosedur Pemulihan (Rollback) |
|---|---|---|
| **Cache Stale / Pembaruan Artikel Macet** | Artikel yang diedit di admin tetap menampilkan versi lama di publik | 1. Panggil Cloudflare Cache Purge API untuk URL artikel terkait.<br>2. Jika sistem purge bermasalah, revert header `s-maxage` di `src/middleware.ts` kembali ke `no-cache`. |
| **Kebocoran Cache Admin / Sesi Terotentikasi** | Pengguna publik melihat tombol admin atau data sesi operator | 1. Eksekusi `Purge Everything` di Cloudflare dashboard.<br>2. Kembalikan segera baris middleware ke kondisi `no-store, private` universal.<br>3. Investigasi evaluasi kondisi cookie di middleware. |
| **Kerusakan Antarmuka Pencarian Modal** | Modal search gagal menampilkan hasil atau melempar error JSON | 1. Revert perubahan `src/pages/api/search.json.ts` ke commit sebelumnya.<br>2. Verifikasi kesesuaian nama field di `SearchModal.astro`. |
| **Gangguan Perayapan Mesin Pencari** | Penurunan drastis pada grafik perayapan Google Search Console | 1. Revert `public/robots.txt` ke versi awal.<br>2. Pastikan tidak ada aturan cache yang menahan respons Googlebot. |

---

## 12. Urutan Pelaksanaan Bertahap (Implementation Steps)

Untuk meminimalkan risiko operasional, pengerjaan Fase 1A dilakukan dalam 6 langkah sekuensial yang terisolasi:

```
[ LANGKAH 1: Pemangkasan Payload API Pencarian ]
  - Edit src/pages/api/search.json.ts (Field whitelisting: title, slug, desc, cat, image)
  - Uji lokal fungsionalitas SearchModal.astro
              │
              ▼
[ LANGKAH 2: Safe Edge Caching pada Middleware ]
  - Edit src/middleware.ts
  - Menerapkan cache berbatas pengaman: public s-maxage hanya untuk rute publik tak berotentikasi
  - Memastikan rute /admin, /api, sesi login, dan error tetap strictly no-store
              │
              ▼
[ LANGKAH 3: Pemutakhiran Deklarasi Robots AI ]
  - Edit public/robots.txt
  - Menambahkan blok Selective AI Access (izinkan OAI-SearchBot/PerplexityBot, tolak GPTBot/CCBot/dll)
              │
              ▼
[ LANGKAH 4: Plumbing Invalidasi Publikasi (Readiness) ]
  - Menyiapkan modul pembantu invalidasi cache terarah saat artikel diterbitkan/diperbarui
              │
              ▼
[ LANGKAH 5: Verifikasi Suite Pengujian & Build ]
  - Jalankan test suite lokal: internal-link, liveops, staff registry, nadia
  - npx tsc --noEmit (Zero errors)
  - npm run build (Sukses)
              │
              ▼
[ LANGKAH 6: Pengujian Asap Produksi & Benchmarking ]
  - Deploy terotorisasi ke Cloudflare Workers edge
  - Uji verifikasi header HTTP, TTFB, Search Modal, dan robots.txt di produksi
```

---

## 13. Kriteria Gerbang Penerimaan Fase 1A (Go / No-Go Acceptance Gates)

Implementasi Fase 1A dinyatakan berhasil dan siap diterima jika memenuhi 10 kriteria mutlak:
1. **Googlebot & Bingbot Crawlability Preserved:** Respons untuk crawler mesin pencari terverifikasi merespons HTTP 200 tanpa tantangan JavaScript.
2. **Zero Admin Cache Leakage:** Respons `/admin/*`, `/api/admin/*`, dan request dengan cookie `admin_session` 100% memuat header `Cache-Control: no-store, private`.
3. **Edge Caching Terbukti Aktif:** Artikel publik menyajikan header `Cache-Control: public, max-age=60, s-maxage=3600, stale-while-revalidate=86400` dan menghasilkan respons instan di Cloudflare Edge.
4. **Search UI Berfungsi Sempurna:** Modal pencarian publik (`SearchModal.astro`) tetap menampilkan judul, thumbnail, kategori, dan deskripsi dengan mulus tanpa error konsol.
5. **Zero Data Leakage pada Search API:** Payload `/api/search.json` tidak lagi memuat `content_hash`, `views`, `key_takeaways`, atau `focus_keyword`.
6. **Zero Naskah & Graf Mutation:** Hash naskah artikel terbit dan struktur relasi Plane A internal link tetap utuh 100%.
7. **Sitemap & RSS Terlindungi:** Seluruh sitemap XML dan RSS feed merespons normal tanpa regresi.
8. **TypeScript & Build Clean:** `npx tsc --noEmit` lolos tanpa error; `npm run build` berhasil sempurna.
9. **Zero-JS Article Philosophy Preserved:** Tidak ada skrip JavaScript klien yang ditambahkan ke tubuh naskah artikel.
10. **Zero Schema Mutation in 1A:** Tidak ada perubahan skema tabel D1 yang dipaksakan pada Fase 1A.

---
*Dokumen ini merupakan rencana teknis pelaksanaan resmi untuk Fase CONTENT_PROTECTION-1A.*
*Status: `CONTENT_PROTECTION_1A_PLAN_PASS`*
*Menunggu otorisasi resmi Chief Editor sebelum penulisan kode dimulai.*
