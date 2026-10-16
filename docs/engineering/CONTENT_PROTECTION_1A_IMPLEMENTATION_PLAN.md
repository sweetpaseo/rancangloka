# 📋 RancangLoka — CONTENT_PROTECTION-1A Final Implementation Plan
## Phase 1A: Foundation + Safe Public Edge Caching Architecture

**Milestone:** `CONTENT_PROTECTION-1A`
**Phase:** `FOUNDATION + SAFE CACHE`
**Parent Blueprint:** [`docs/engineering/CONTENT_PROTECTION_1_BLUEPRINT.md`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/docs/engineering/CONTENT_PROTECTION_1_BLUEPRINT.md)
**Target Repository:** `rancangloka-astro/`
**Current Production Worker:** `1ec3dfd1-60b9-493f-aa48-ea63ea1dde0f`
**Status:** `CONTENT_PROTECTION_1A_PLAN = PASS WITH FINAL ARCHITECTURE CORRECTION`
**Date:** 2026-10-16

---

## 1. Executive Summary & Phase 1A Scope

Fase **CONTENT_PROTECTION-1A** meletakkan fondasi perlindungan konten dan efisiensi infrastruktur RancangLoka tanpa merusak ekosistem publik atau keaslian editorial.

Fase ini menyelesaikan empat masalah arsitektur mendesak:
1. **Menghentikan Pembebanan Origin SSR Berlebih:** Mengoreksi konfigurasi `Cache-Control: no-cache, no-store, must-revalidate` pada halaman publik dengan memilih dan mengonfigurasi bidang cache (*cache plane*) kanonikal yang tepat di Cloudflare Edge.
2. **Menutup Kebocoran Metadata Internal:** Merapikan endpoint `/api/search.json` melalui pemangkasan field (*field whitelisting*), terbukti mengurangi payload sebesar **63.6%** pada pengujian empiris.
3. **Mendeklarasikan Kebijakan AI Etis:** Menerapkan kebijakan *Selective AI Access* pada `public/robots.txt` untuk membedakan bot pencari/sitasi dari bot pengikis korpus massal.
4. **Membangun Model Dependensi & Invalidasi Terarah:** Menegakkan invalidasi balik (*reverse internal-link invalidation*) sehingga pembaruan target Plane A otomatis membersihkan cache halaman sumber pendukung.

> **Batasan Ketat Fase 1A (Hard Invariants):**
> - Implementasi teknis `PUBLICATION_DNA` (skema tabel D1, kalkulasi n-gram, perceptual hash) **TIDAK TERMASUK** dalam Fase 1A (dijadwalkan pada Fase 1B).
> - Seluruh pengujian performa diklasifikasikan sebagai **`OBSERVATION GOALS / HYPOTHESES`**, bukan ambang batas mutlak yang memblokir rilis.
> - Tidak ada perubahan skema database D1 pada Fase 1A.

---

## 2. Pemilihan Bidang Cache Kanonikal (Canonical Cache Plane Selection)

### Audit Runtime & Tooling Aktual Proyek
- **Versi Wrangler Terpasang:** `3.114.17` (devDependencies `"wrangler": "^3.72.0"`).
- **Runtime Compute Edge:** Cloudflare Workers via adapter `@astrojs/cloudflare` (v11.1.0) dengan `mode: 'advanced'` dan `output: 'server'`.
- **Target Kompatibilitas:** `compatibility_date = "2024-09-01"`, `compatibility_flags = ["nodejs_compat"]`.
- **Entrypoint Worker:** `src/worker.ts` membungkus Astro SSR (`astroWorker.fetch(request, env, ctx)`) dan native `scheduled(event, env, ctx)` router.
- **Konfigurasi Cache di `wrangler.toml` Saat Ini:** Belum ada blok `[cache]`.
- **Konfigurasi Cache di `src/middleware.ts` Saat Ini:** Menginjeksi `Cache-Control: no-cache, no-store, must-revalidate` ke seluruh respons HTML. Setiap permintaan bot maupun pembaca memicu SSR penuh dan 6–7 query D1.

### Evaluasi Perbandingan 3 Kandidat Bidang Cache

| Dimensi Evaluasi | A. Cloudflare Workers Caching (`[cache] enabled = true`) | B. Workers Cache API (`caches.default`) | C. Zone-Level Cloudflare Cache Rules |
|---|---|---|---|
| **Apakah Worker mengeksekusi kode saat Cache Hit?** | **TIDAK.** Cache berada di depan Worker. Edge menyajikan respons sebelum Worker berjalan (0 CPU ms, 0 query D1). | **YA.** Worker *selalu* berjalan untuk mengeksekusi `fetch()`, membaca `caches.default.match()`, dan mengembalikan clone response. | **TIDAK.** Edge menyajikan respons sebelum Worker rute dipanggil. |
| **Perilaku Global vs Lokal** | Global Edge Network Cloudflare dengan dukungan Tiered Cache terintegrasi. | Lokal per-PoP data center (kecuali Tiered Cache aktif pada zona). | Global Edge Network Cloudflare dengan Tiered Cache. |
| **Request Collapsing / Stampede** | **Natif di edge.** Lonjakan request simultan ke URL yang sama digabungkan (*collapsed*) menjadi 1 fetch ke origin. | Tidak otomatis. Harus dibuatkan koordinasi in-worker manual yang kompleks. | Natif di edge. |
| **Mekanisme Invalidasi** | Worker-owned invalidation / version scoping / targeted purge. | `caches.default.delete(url)` hanya membersihkan PoP lokal saat itu. | Cloudflare Zone Cache Purge API (butuh token zona dan API call eksternal). |
| **Dukungan Cache Tags** | URL-based kanonikal; tag tersedia pada tier Enterprise. | Tidak ada dukungan tag bawaan (hanya URL key). | Tag purge hanya tersedia di tier Enterprise. |
| **Perilaku Deployment / Versi** | **Version-scoped secara default.** Deployment Worker baru otomatis memulai namespace cache bersih. | Cache bertahan lintas deployment kecuali manual versioning URL. | Cache bertahan lintas deployment kecuali di-purge via webhook/script deploy. |
| **Kompleksitas Implementasi** | **RENDAH.** Dideklarasikan di `wrangler.toml` dan diatur via header HTTP di `src/middleware.ts`. | **TINGGI.** Perlu custom wrapper di `src/worker.ts`, penanganan streaming body, dan sanitasi header manual. | **SEDANG.** Konfigurasi terpisah di Cloudflare dashboard/API (rawan *configuration drift* dari Git). |
| **Kesesuaian SSR Artikel HTML** | **SANGAT TINGGI.** Menghilangkan beban Worker dan kuota D1 sepenuhnya untuk trafik berulang. | Sedang. Menghemat D1, namun kuota CPU Worker tetap terpakai pada setiap request. | Baik, tetapi pengelolaan aturan berada di luar kontrol Git. |
| **Kesesuaian Homepage, RSS, Sitemap** | **SANGAT TINGGI.** | Sedang. | Baik. |
| **Kemudahan Rollback** | **SANGAT MUDAH.** Revert `s-maxage` di middleware atau redeploy Worker langsung membersihkan cache. | Butuh perubahan kode imperatif. | Memerlukan mutasi API Cloudflare zona. |

### Keputusan Arsitektur Kanonikal untuk Fase 1A:
> **PILIHAN: Cloudflare Workers Caching (`[cache] enabled = true` di `wrangler.toml`) + Kebijakan Respons Deklaratif `Cache-Control` di `src/middleware.ts`.**
> **Alasan:** Ini adalah satu-satunya arsitektur yang menjamin **Worker dan D1 sama sekali tidak dijalankan pada cache hit**, dikelola 100% secara deklaratif di dalam repositori Git, memiliki isolasi versi alami, dan tidak membebani kode aplikasi dengan boilerplate imperatif.

---

## 3. Koreksi Mekanisme Purge & Kepemilikan Cache (Worker-Owned Invalidation)

### Koreksi Aturan Purge:
Zona Cache Purge API (`https://api.cloudflare.com/client/v4/zones/.../purge_cache`) **BUKAN** mekanisme invalidasi kanonikal utama untuk Workers Caching. Workers Caching dimiliki dan dikendalikan oleh Worker itu sendiri:

1. **Deployment-Scoped Invalidation (Default):**
   Setiap kali versi Worker baru dideploy ke produksi, Cloudflare Workers Caching secara default mengisolasi namespace cache ke versi tersebut. Cache lama tidak bocor ke runtime baru.
2. **Worker-Owned Runtime Tag Purge:**
   Jika invalidasi instan diperlukan dalam siklus hidup Worker saat artikel dimutasi, invalidasi dilakukan melalui Workers Cache tag purge selector: `cache.purge({ tags: [...] })` (dari `cloudflare:workers` atau `ctx.cache.purge({ tags: [...] })`). Workers Cache tidak menerima purges berbasis raw URL string.
3. **Pemisahan Header Browser vs Cloudflare Edge:**
   Cloudflare Workers Cache mendokumentasikan bahwa penggunaan `s-maxage` mengimplikasikan `proxy-revalidate` dan menonaktifkan `stale-while-revalidate`. Oleh karena itu, arsitektur memisahkan kebijakan browser dan Cloudflare edge:
   - Browser: `Cache-Control: public, max-age=<browser_ttl>`
   - Cloudflare Edge: `Cloudflare-CDN-Cache-Control: public, max-age=<edge_ttl>, stale-while-revalidate=<window>`

---

## 4. Perilaku Cache Lintas Deployment & Keputusan Versi

### Keputusan: KEEP DEFAULT VERSION-SCOPED CACHE

Pada peluncuran Fase 1A, RancangLoka menetapkan:
> **KEBIJAKAN: Mempertahankan perilaku default *version-scoped cache*. Dilarang mengaktifkan cross-version cache pada Fase 1A.**

### Rasio Rekayasa (Engineering Rationale):
- **Zero Stale HTML Leakage:** Ketika ada pembaruan layout Astro, skrip analitik, perbaikan CSS Tailwind, atau struktur DOM, deployment Worker baru langsung menyajikan HTML termutakhir kepada pembaca tanpa risiko menampilkan markup basi dari versi rilis sebelumnya.
- **Zero Deployment Coordination:** Tidak diperlukan skrip deployment tambahan yang rumit untuk memanggil API purge global setiap kali selesai deploy.
- **Biaya Pemanasan (Warm-up) Sangat Rendah:** Korpus publik RancangLoka saat ini terdiri dari 9–10 artikel kanonikal. Pemanasan cache untuk seluruh korpus hanya membutuhkan beberapa puluh kilobyte transfer data.

---

## 5. Model Tag & Dependensi Cache (Cache Dependency Model)

Sebuah halaman artikel `https://rancangloka.com/[slug]` **TIDAK BERDIRI SENDIRI**. Komposisi SSR artikel memuat elemen-elemen berikut:
1. **Article Prose & Metadata:** Judul, slug, naskah markdown/HTML, waktu baca, tanggal terbit (`articles`).
2. **Featured Media:** URL gambar sampul, teks alt, dimensi (`articles.featured_image`, `articles.image_alt`).
3. **Category Metadata:** Nama kategori dan slug kategori (`categories`).
4. **Article Support Module:** Kartu artikel terkait dan rekomendasi bacaan.
5. **Semantic Plane A Target Metadata:** Judul, slug, kutipan pembuka, waktu baca, dan thumbnail milik **artikel target** yang ditampilkan di dalam kartu pendukung artikel sumber.
6. **Site Settings:** Judul situs, deskripsi, dan preferensi global (`site_settings`).

### Tag & Dependensi Logis:
- `article-<article_id>`: Halaman kanonikal artikel itu sendiri.
- `category-<category_id>`: Halaman arsip/kategori yang menaungi artikel.
- `homepage`: Halaman depan `/`.
- `rss`: Feed sindikasi `/rss.xml`.
- `sitemap`: Indeks dan berkas `/sitemap*.xml`.
- `search`: Endpoint API pencarian `/api/search.json`.
- `support-target-<target_article_id>`: Kumpulan artikel sumber yang menautkan artikel target ini melalui Plane A.

---

## 6. Dependensi Balik Tautan Internal (Mandatory Reverse Internal-Link Invalidation)

### Masalah Inkonsistensi Data:
Contoh nyata:
> **Artikel 8** memuat modul Article Support yang menargetkan **Artikel 9**.
> Kartu pendukung pada Artikel 8 menampilkan: judul Artikel 9, cuplikan prosa pembuka Artikel 9, waktu baca Artikel 9, dan thumbnail Artikel 9.
> Jika **Artikel 9** mengalami perubahan (judul disunting, slug diubah, naskah pembuka diperbaiki, atau gambar diperbarui), maka cache halaman **Artikel 8** akan menyajikan metadata Artikel 9 yang basi (*stale*) jika hanya Artikel 9 yang di-purge.

### Solusi: Reverse Invalidation Trigger pada Publication Engine
Ketika sebuah artikel target ($T$) mengalami mutasi:
1. Publication engine menjalankan kueri deterministik pada skema kanonikal graf relasi D1:
   ```sql
   SELECT DISTINCT source_article_id
   FROM article_internal_links
   WHERE target_article_id = ?
     AND placement_plane = 'PLANE_A_DYNAMIC'
     AND status = 'ACTIVE';
   ```
2. Menggunakan Workers Cache `Cache-Tag`, pembersihan cukup mem-purge tag:
   - `article-<T>`
   - `support-target-<T>`
   Setiap artikel sumber yang menautkan target $T$ pada Article Support merender tag `support-target-<T>` pada responsnya. Saat `support-target-<T>` di-purge, seluruh halaman sumber terkait otomatis menjadi MISS tanpa perlu melakukan kueri URL manual.
3. **Karakteristik Operasional:** Kueri dan tag purge ini dieksekusi secara deterministik pasca-mutasi basis data, **TIDAK MENGUBAH** struktur graf Plane A, dan fail-safe.

---

## 7. Matriks Invalidasi Pembaruan Artikel (Article Update Invalidation Matrix)

| Peristiwa Siklus Hidup Artikel | Permukaan Cache yang Wajib Diinvalidasi | Keterangan & Batasan |
|---|---|---|
| **`ARTICLE_PUBLISHED`** | - Canonical URL (`/[slug]`)<br>- Homepage (`/`)<br>- Category Archive (`/category/[slug]`)<br>- RSS Feed (`/rss.xml`)<br>- Sitemaps (`/sitemap.xml`, `/post-sitemap.xml`, `/sitemap-news.xml`)<br>- Search API (`/api/search.json`) | Artikel baru menambah entri di feed, sitemap, dan beranda. Belum ada reverse-link karena tautan baru dibentuk setelah terbit. |
| **`ARTICLE_REVISED`**<br>*(Perbaikan prosa dalam tubuh artikel; judul, slug, dan pembuka tetap)* | - Canonical URL (`/[slug]`) | **Targeted Invalidation.** Homepage, RSS, sitemap, dan reverse-link sumber **TIDAK PERLU** di-purge karena ringkasan dan metadata kartu pendukung tidak berubah. |
| **`ARTICLE_UNPUBLISHED`** | - Canonical URL (`/[slug]`)<br>- Reverse-link source articles (semua artikel sumber Plane A)<br>- Homepage (`/`)<br>- Category Archive (`/category/[slug]`)<br>- RSS Feed (`/rss.xml`)<br>- Sitemaps (`/sitemap.xml`, `/post-sitemap.xml`, `/sitemap-news.xml`)<br>- Search API (`/api/search.json`) | Seluruh kartu pendukung di artikel sumber wajib me-render ulang agar tidak menampilkan tautan ke artikel yang sudah tidak terbit. |
| **`ARTICLE_SLUG_CHANGED`** | - URL Slug Lama (`/[old-slug]`)<br>- URL Slug Baru (`/[new-slug]`)<br>- Reverse-link source articles (semua artikel sumber Plane A)<br>- Homepage, Category, RSS, Sitemaps, Search API | Slug lama wajib dibersihkan agar mengembalikan redirect 301/404 yang benar; kartu pendukung artikel sumber wajib memuat tautan baru. |
| **`ARTICLE_TITLE_CHANGED`** | - Canonical URL (`/[slug]`)<br>- Reverse-link source articles (semua artikel sumber Plane A)<br>- Homepage, Category, RSS, Sitemaps, Search API | Judul baru wajib diperbarui di kartu pendukung artikel sumber, beranda, dan feed. |
| **`ARTICLE_FEATURED_IMAGE_CHANGED`** | - Canonical URL (`/[slug]`)<br>- Reverse-link source articles (semua artikel sumber Plane A)<br>- Homepage, Category, RSS, Sitemaps (Image Sitemap), Search API | Thumbnail baru wajib ditampilkan di kartu pendukung artikel sumber dan beranda. |
| **`ARTICLE_OPENING_PROSE_CHANGED`** | - Canonical URL (`/[slug]`)<br>- Reverse-link source articles (semua artikel sumber Plane A)<br>- Homepage (jika menampilkan cuplikan), RSS Feed | Excerpt kartu pendukung pada artikel sumber diturunkan dari prosa pembuka target, sehingga wajib diinvalidasi. |
| **`ARTICLE_READING_TIME_CHANGED`** | - Canonical URL (`/[slug]`)<br>- Reverse-link source articles (semua artikel sumber Plane A) | Waktu baca target tercantum pada metadata kartu pendukung artikel sumber. |
| **`INTERNAL_LINK_GRAPH_CHANGED`**<br>*(Aktivasi edge Plane A baru atau pertukaran target)* | - Source Article URL (`/[source_slug]`) | Hanya artikel sumber yang kartu pendukungnya berubah yang diinvalidasi. |

> **Prinsip Keselamatan:** Pembersihan global (`purge_everything`) **DILARANG KERAS** digunakan sebagai alur kerja operasional standar.

---

## 8. Kompatibilitas Masa Depan dengan Product Review & Data Penawaran (Affiliate Pricing)

### Koreksi Asumsi Desain:
> **Fakta Rekayasa:** Komponen sub-bagian di edge **TIDAK OTOMATIS BERSIFAT DINAMIS** jika halaman HTML di-cache secara penuh di edge. Full-page SSR caching membekukan seluruh payload HTML, termasuk teks harga atau penawaran komersial yang tertanam di dalamnya.

### Prinsip Permanen:
> **`PRICE_IS_DYNAMIC_COMMERCE_DATA_NOT_ARTICLE_PROSE`**
> *(Data harga dan stok penawaran komersial adalah data yang bergerak cepat, bukan prosa editorial yang statis.)*

### Evaluasi Opsi Desain Masa Depan:
- **Opsi A (Event-Driven Invalidation / Preferred Direction):** Pembaruan snapshot harga/penawaran mencari relasi `ARTICLE_PRODUCT_BINDING` dan memicu invalidasi cache halaman artikel terkait. Tetap menjaga filosofi zero-client-JS.
- **Opsi B (Shorter Cache Policy):** Mengurangi TTL `s-maxage` pada artikel ulasan produk (misal: 15–30 menit). Sederhana, namun meningkatkan beban SSR.
- **Opsi C (Client-Side Island Fetch):** Menjadikan komponen harga sebagai island dinamis via JavaScript. Bertentangan dengan prinsip zero-JS saat ini.
- **Opsi D (Edge SSI / Fragment Composition):** Menggunakan Cloudflare Workers sub-requests untuk menyusun halaman di edge. Menambah latensi edge assembly.

### Arahan Masa Depan yang Didokumentasikan:
Untuk mempertahankan filosofi naskah bersih dan **zero client-side JavaScript**, arah arsitektur yang dipilih pada milestone mendatang adalah **Opsi A**:
```
[ External Offer Snapshot Update ]
                 │
                 ▼
[ Query ARTICLE_PRODUCT_BINDING (D1) ]
                 │
                 ▼
[ Invalidate Bound Product-Review Page Cache ]
```
*(Catatan: Ini adalah dokumentasi niat desain masa depan dan TIDAK diimplementasikan pada Fase 1A).*

---

## 9. Matriks Caching Rute & Nilai TTL Kandidat (Route Cache Matrix)

Seluruh angka durasi cache diklasifikasikan sebagai **`CANDIDATE_INITIAL_TTL`** yang akan dikalibrasi berdasarkan pengamatan beban produksi nyata:

```
+---------------------------+-----------------------------------+--------------------+-----------------------------------------------------------------------------------------------------------------------+
| Pola Rute URL             | Klasifikasi Akses                 | Status Edge Cache  | Header Kebijakan Cache yang Diterapkan                                                                               |
+---------------------------+-----------------------------------+--------------------+-----------------------------------------------------------------------------------------------------------------------+
| /                         | PUBLIC_HOMEPAGE                   | CACHEABLE (1A)     | Browser: public, max-age=60 | Edge: Cloudflare-CDN-Cache-Control: public, max-age=1800, stale-while-revalidate=86400  |
| /[slug] (Published, 200)  | PUBLIC_ARTICLE_SSR                | CACHEABLE (1A)     | Browser: public, max-age=60 | Edge: Cloudflare-CDN-Cache-Control: public, max-age=3600, stale-while-revalidate=86400  |
| /media/thumbnails/*       | PUBLIC_THUMBNAIL                  | IMMUTABLE (1 Year) | public, max-age=31536000, immutable                                                                                   |
| /media/images/*           | PUBLIC_IMAGE                      | IMMUTABLE (1 Year) | public, max-age=31536000, immutable                                                                                   |
| /assets/*, /_astro/*      | STATIC_BUILD_ASSET                | IMMUTABLE (1 Year) | public, max-age=31536000, immutable                                                                                   |
| /api/search.json          | PUBLIC_SEARCH_API                 | SHORT CACHE (1A)   | Browser: public, max-age=60 | Edge: Cloudflare-CDN-Cache-Control: public, max-age=300                                  |
| /rss.xml                  | RSS_FEED                          | EDGE CACHED (1A)   | Browser: public, max-age=1800 | Edge: Cloudflare-CDN-Cache-Control: public, max-age=7200                                |
| /sitemap*.xml             | XML_SITEMAPS                      | EDGE CACHED (1A)   | Browser: public, max-age=3600 | Edge: Cloudflare-CDN-Cache-Control: public, max-age=86400                               |
| /admin/*                  | PRIVATE_ADMIN_UI                  | STRICTLY NO-STORE  | Cache-Control: no-store, private (Edge cache headers removed)                                                         |
| /api/admin/*              | PRIVATE_ADMIN_API                 | STRICTLY NO-STORE  | Cache-Control: no-store, private (Edge cache headers removed)                                                         |
| /api/internal/*           | INTERNAL_WORKER_API               | STRICTLY NO-STORE  | Cache-Control: no-store, private (Edge cache headers removed)                                                         |
| Respons Error (4xx, 5xx)  | ERROR_STATE                       | STRICTLY NO-STORE  | Cache-Control: no-store, private (Edge cache headers removed)                                                         |
| Draf / Pratinjau Redaksi  | EDITORIAL_PREVIEW                 | STRICTLY NO-STORE  | Cache-Control: no-store, private (Edge cache headers removed)                                                         |
| Sesi Berisi Cookie Admin  | AUTHENTICATED_SESSION             | STRICTLY NO-STORE  | Cache-Control: no-store, private (Edge cache headers removed)                                                         |
+---------------------------+-----------------------------------+--------------------+-----------------------------------------------------------------------------------------------------------------------+
```

### Pemisahan Lapisan TTL (Browser vs Cloudflare Edge):
- **Browser Policy (`Cache-Control: public, max-age=60`):** Berdurasi pendek agar pembaca mendapatkan pembaruan cepat.
- **Edge Policy (`Cloudflare-CDN-Cache-Control: public, max-age=1800–3600, stale-while-revalidate=86400`):** Berdurasi 30–60 menit di edge Cloudflare, menyerap burst scraping tanpa membebani SSR/D1. Tidak menggunakan `s-maxage` bersama `stale-while-revalidate` karena Cloudflare mendokumentasikan bahwa `s-maxage` menonaktifkan `stale-while-revalidate` pada Workers Cache.
- **Strictly No-Store:** Seluruh rute privat, admin, internal API, status error, atau permintaan bermutasi menerima `Cache-Control: no-store, private` dan header edge CDN dihapus.

---

## 10. Koreksi Ambang Batas Performa (Performance Acceptance Plan)

Angka-angka target performa sebelumnya diklasifikasikan ulang secara tegas sebagai:
> **`OBSERVATION GOALS / HYPOTHESES`**
> *(Tujuan Pengamatan / Hipotesis Kerja — Bukan Ambang Batas Kegagalan Mutlak)*

Implementasi tidak boleh digagalkan hanya karena angka persentase teoritis tidak tercapai seketika. Kriteria penerimaan utama adalah:
1. Caching edge terbukti bekerja aktif (*cache hits occur*).
2. Cache hit berhasil menghindari eksekusi Worker SSR dan kueri D1.
3. Tidak terjadi regresi fungsional pada tampilan artikel, modal pencarian, feed, maupun sitemap.
4. Metrik sebelum (*before*) dan sesudah (*after*) tercatat secara transparan.
5. Tidak terjadi regresi bermakna pada Core Web Vitals (LCP, CLS, INP).

| Metrik Kinerja | Status Saat Ini (Baseline) | Hipotesis Pengamatan (Observation Goal) | Instrumen Verifikasi |
|---|---|---|---|
| **Edge Cache Behavior** | 0% Hit (selalu `no-store`) | Menghasilkan Cache Hit pada permintaan berulang | Cloudflare Analytics / Response Headers |
| **Worker CPU Time** | 8–25 ms per request | Menurun drastis pada Cache Hit | Cloudflare Worker Metrics |
| **D1 Database Reads** | 6–7 query per hit publik | 0 query saat Cache Hit | D1 Database Analytics |
| **TTFB (Time to First Byte)** | 120–280 ms | Lebih cepat pada Cache Hit edge | cURL benchmark / WebPageTest |
| **Lighthouse Performance** | 98–100 | Tetap 98–100 (Zero regresi) | Chrome DevTools Lighthouse |

---

## 11. Pengukuran Empiris Payload API Pencarian Publik (`/api/search.json`)

### Hasil Pengukuran Riil (Bukan Klaim Teoritis):
Audit pembacaan data riil (*read-only measurement*) dilakukan terhadap database D1 dengan sampel representatif 4 artikel terbit:

| Kondisi Payload | Ukuran JSON Transfer | Rata-rata per Artikel | Penghematan Byte | Reduksi Riil |
|---|---|---|---|---|
| **Payload Saat Ini (Unfiltered)** | **5.393 bytes** | ~1.348 bytes | — | Baseline |
| **Payload Terminimalisasi (Whitelisted)** | **1.961 bytes** | ~490 bytes | **3.432 bytes** | **63.6%** |

*Catatan Tata Kelola:* Angka reduksi riil tercatat sebesar **63.6%**, menggantikan estimasi kasar sebelumnya (~70%).

### Verifikasi Konsumen Frontend:
Pemeriksaan kode terhadap konsumen tunggal endpoint ini (`src/components/SearchModal.astro`, L158–167) mengonfirmasi bahwa antarmuka **HANYA** memerlukan 5 field:
1. `slug`
2. `featured_image`
3. `title`
4. `category_name`
5. `description`

Kolom internal yang dipangkas dari keluaran publik:
- `content_hash`
- `views`
- `key_takeaways`
- `focus_keyword`
- `category_id`
- `author_id`
- `is_featured`
- `is_trending`
- `disable_internal_links`

---

## 12. Klasifikasi Kapabilitas Cloudflare Berbasis Bukti (Capability Matrix)

Untuk menghindari asumsi palsu dari perintah `npx wrangler whoami` (yang hanya membuktikan identitas otentikasi token akun, bukan entitlement zona):

| Kapabilitas Cloudflare | Status Klasifikasi Bukti | Dasar Verifikasi & Keterangan |
|---|---|---|
| **Workers Caching (`[cache]`)** | `DOCUMENTATION_CONFIRMED` | Didukung oleh Wrangler 3.x dan runtime Cloudflare Workers. Dikonfigurasi di `wrangler.toml`. |
| **Kepatuhan Header `Cache-Control`** | `DOCUMENTATION_CONFIRMED` | Standar edge Cloudflare menghormati `s-maxage` dan `stale-while-revalidate`. |
| **Cloudflare Turnstile (Managed Challenge)** | `ACCOUNT_ENTITLEMENT_CONFIRMED` | Layanan gratis tersedia pada akun Cloudflare aktif. |
| **WAF Custom Rules (Bypass Verified Bots)** | `CAPABILITY_REQUIRES_PLAN_VERIFICATION` | Fitur ada di Free Plan dengan kuota terbatas (maksimal 5 aturan). Usability aturan tergantung sisa kuota zona. |
| **Ekspresi `cf.bot_management.verified_bot`** | `CAPABILITY_REQUIRES_PLAN_VERIFICATION` | Tersedia pada firewall rules dokumentasi Cloudflare, namun pada beberapa paket gratis field `cf.client.bot` adalah representasi bot terverifikasi yang lebih aman/tersedia. Wajib diverifikasi saat konfigurasi rule di 1D. |
| **Bot Management Score (1–99)** | `CAPABILITY_REQUIRES_PLAN_VERIFICATION` | Memerlukan add-on berbayar (Enterprise/Bot Management add-on). Dilarang diasumsikan tersedia di 1A. |
| **Cloudflare Zone Cache Purge API** | `ACCOUNT_ENTITLEMENT_CONFIRMED` | Memerlukan token API Cloudflare dengan izin `Cache Purge:Edit` untuk zona rancangloka.com. |

---

## 13. Kebijakan AI Crawler pada `public/robots.txt`

Menerapkan keputusan Chief Editor: **`SELECTIVE_AI_ACCESS`**.
Membedakan bot pencarian/sitasi (Search & Citation) dari bot penelan korpus pelatihan massal (Bulk Training Harvesters):

```txt
# RancangLoka — Standard Robots Policy
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

# Selective AI Search & Citation (Allowed for Discovery & Traffic Attribution)
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

*Kebijakan Pembaruan Identitas Bot:* Nama-nama perayap AI resmi wajib diverifikasi ulang terhadap dokumentasi resmi penyedia AI saat implementasi penegakan WAF (Fase 1D). Tidak membekukan nama crawler yang usang.

---

## 14. Kebijakan Privasi Media Publik (`PUBLIC_DERIVATIVES_STRIP_SENSITIVE_EXIF`)

Berdasarkan kesepakatan `RANCANGLOKA_VISUAL_IDENTITY_POLICY`:
- Untuk aset kelas **`RANCANGLOKA_HANDS_ON`**, metadata capture asli (seperti tipe sensor, stempel waktu internal) dapat disimpan dalam arsip master internal R2 untuk audit kepemilikan.
- Namun, **seluruh derivatif publik yang disajikan ke web (`/media/images/*`, `/media/thumbnails/*`) WAJIB membersihkan metadata EXIF sensitif (`PUBLIC_DERIVATIVES_STRIP_SENSITIVE_EXIF`)**, termasuk koordinat GPS presisi lokasi pemotretan, nomor seri kamera, dan identitas perangkat pengguna.
- Hanya metadata publik yang dipilih secara sadar (misalnya teks alt dan dimensi) yang disertakan dalam respons publik.

---

## 15. Estimasi Penyimpanan Publication DNA (`DESIGN_ESTIMATE`)

Kebutuhan penyimpanan skema D1 untuk Publication DNA (Fase 1B) dicatat sebagai:
> **`DESIGN_ESTIMATE (~1.5–2.5 KB per artikel)`**
> *(Perkiraan Desain Awal — Bukan Fakta Penyimpanan Terukur)*

Karakteristik teknis yang direncanakan:
- MinHash / SimHash 64–128 integer (~1 KB).
- Paragraph hash ringkas 10–20 baris (~500 B).
- Tidak menyimpan n-gram penuh secara redundan karena `content_md` asli abadi di D1 dan dapat dihitung ulang kapan saja (*rebuilt on demand*).

---

## 16. Urutan Pelaksanaan Teknis Fase 1A (Implementation Sequence)

Untuk menjamin risiko operasional minimal dan kepatuhan penuh terhadap batas pengaman, pengerjaan kode Fase 1A disusun dalam urutan 9 langkah:

```
[ LANGKAH 1: Pemangkasan Payload API Pencarian Publik ]
  - Berkas: src/pages/api/search.json.ts
  - Terapkan whitelist field: slug, featured_image, title, category_name, description.
  - Verifikasi lokal SearchModal.astro.
              │
              ▼
[ LANGKAH 2: Pengaturan Primitif Batas Pengaman Cache di Middleware ]
  - Berkas: src/middleware.ts
  - Terapkan bypass mutlak untuk admin_session cookie dan rute /admin/*, /api/*, error states.
  - Siapkan injeksi Cache-Control berbasis klasifikasi rute publik.
              │
              ▼
[ LANGKAH 3: Pengaktifan Mekanisme Workers Caching Kanonikal ]
  - Berkas: wrangler.toml
  - Daftarkan [cache] enabled = true sesuai spesifikasi Cloudflare Workers Caching.
              │
              ▼
[ LANGKAH 4: Definisi Tag & Dependensi Metadata Cache ]
  - Dokumentasikan dependensi logis pada modul publication invalidation.
              │
              ▼
[ LANGKAH 5: Logika Invalidasi Publikasi & Reverse Internal-Link Trigger ]
  - Implementasikan query balik D1 untuk mencari source_article_id Plane A saat target berubah.
  - Siapkan antrean invalidasi multi-permukaan.
              │
              ▼
[ LANGKAH 6: Pembaruan Deklarasi Robots AI ]
  - Berkas: public/robots.txt
  - Terapkan blok Selective AI Access (OAI-SearchBot/PerplexityBot izinkan, GPTBot/CCBot/dll tolak).
              │
              ▼
[ LANGKAH 7: Verifikasi Pengujian Lokal & Build ]
  - Jalankan test suite lokal (internal link engine, mission control, staff registry).
  - npx tsc --noEmit
  - npm run build
              │
              ▼
[ LANGKAH 8: Deployment Produksi Terotorisasi ]
  - Deploy Worker ke Cloudflare Edge via wrangler deploy setelah otorisasi Chief Editor.
              │
              ▼
[ LANGKAH 9: Pengukuran Empiris Sebelum vs Sesudah (Before/After Benchmark) ]
  - Ukur respons header HTTP, TTFB, cache hit/miss, dan fungsionalitas search modal di produksi.
```

---

## 17. Gerbang Keputusan Penerimaan Rencana (Go / No-Go Decision Gates)

Untuk menutup siklus perencanaan implementasi secara definitif, 6 pertanyaan arsitektur mendasar dijawab secara eksplisit:

1. **Teknologi cache apa yang dipilih untuk Fase 1A?**
   > **Cloudflare Workers Caching (`[cache] enabled = true` di `wrangler.toml`)** yang dikendalikan melalui pemisahan header `Cache-Control: public, max-age=<browser>` (browser) dan `Cloudflare-CDN-Cache-Control: public, max-age=<edge>, stale-while-revalidate=<window>` (edge) di `src/middleware.ts` dan route handlers.
2. **Bagaimana cara mengaktifkannya?**
   > Menambahkan blok `[cache]` dengan `enabled = true` pada `wrangler.toml`, dan memperbarui `src/middleware.ts` serta page/endpoint handlers agar menyuntikkan header cache publik pada rute publik yang valid (menggantikan `no-store` universal).
3. **Bagaimana cara cache tersebut dibersihkan (*purged*)?**
   > Secara default melalui isolasi versi Worker (*version-scoped cache*) pada setiap deployment baru, serta pembersihan terarah berbasis tag (`Cache-Tag`) via Workers Cache purge selector `cache.purge({ tags: [...] })` saat peristiwa publikasi terjadi.
4. **Bagaimana rute terotentikasi dibypass dari cache?**
   > Pada `src/middleware.ts`, setiap permintaan yang memuat cookie `admin_session`, atau mengarah ke `/admin/*`, `/api/admin/*`, `/api/internal/*`, non-GET/HEAD, atau menghasilkan status error (4xx/5xx) **wajib dan mutlak** menerima `Cache-Control: no-store, private` dan header edge CDN dihapus.
5. **Bagaimana dependensi balik Article Support diinvalidasi?**
   > Saat artikel target ($T$) disunting atau dibatalkan terbitnya, publication engine mengeksekusi kueri skema kanonikal:
   > `SELECT DISTINCT source_article_id FROM article_internal_links WHERE target_article_id = ? AND placement_plane = 'PLANE_A_DYNAMIC' AND status = 'ACTIVE';`
   > dan membersihkan tag `article-<T>` serta `support-target-<T>`. Seluruh artikel sumber yang merender tautan target otomatis menjadi MISS saat `support-target-<T>` di-purge.
6. **Bagaimana harga dinamis produk di masa depan dicegah agar tidak basi di dalam cache?**
   > Melalui pemisahan data komersial dari prosa statis (`PRICE_IS_DYNAMIC_COMMERCE_DATA_NOT_ARTICLE_PROSE`). Pembaruan snapshot harga akan mencari relasi `ARTICLE_PRODUCT_BINDING` di D1 dan memicu invalidasi terarah pada cache halaman ulasan produk terkait.

---

## 18. Kriteria Penerimaan Akhir Rencana (Plan Acceptance Status)

Berdasarkan jawaban eksplisit dan resolusi arsitektur di atas:

**Klasifikasi Status Rencana:**
```
CONTENT_PROTECTION_1A_FINAL_PLAN_PASS
```

**Instruksi Penutupan:**
Rencana implementasi dinyatakan mengikat dan ditutup. Tidak ada lagi siklus audit luas yang dibuka. Langkah berikutnya adalah menunggu otorisasi eksekusi dari Chief Editor.

---
*Dokumen ini merupakan spesifikasi arsitektur final untuk implementasi CONTENT_PROTECTION-1A.*
*Status: `READY_TO_IMPLEMENT_CONTENT_PROTECTION_1A`*
