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

### RANCANGLOKA-MASTER-ROADMAP-SYNC-AND-PRODUCT-REVIEW-AFFILIATE-REGISTRATION: Article Support Module Final Closure, Canonical Reporting Rule, Content Protection & Product Review Affiliate Roadmap Registration 2026-10-15

- **Tanggal / Waktu:** 2026-10-15T23:30:00+07:00
- **Status Operasional:** `MASTER_CHECKPOINT_SYNC_PASS` | `ARTICLE_SUPPORT_MODULE_CLOSED` | `PRODUCT_REVIEW_AFFILIATE_ROADMAP_REGISTERED`
- **Otorisasi:** Chief Editor Synchronization Instruction
- **Branch Aktif:** `feat/jev-lokamedia-integration`
- **Active Production Worker:** `1ec3dfd1-60b9-493f-aa48-ea63ea1dde0f`
- **Poin Kunci Sinkronisasi & Penutupan Modul:**
  1. *Penutupan Penuh Modul Dukungan Artikel (`ARTICLE_SUPPORT_MODULE = CLOSED`):*
     - Modul dukungan artikel (*Article Support Module / Related Articles*) dinyatakan ditutup resmi setelah seluruh pengujian fungsional, performa payload, hierarki konten judul-sentris, dan keseimbangan visual mobile (375–390px) terbukti stabil di edge tanpa regresi desktop.
     - Internal Link Engine V1 berstatus permanen: `CLOSED / LIVE / STABILIZED`.
     - Invarian data semantik: Plane A Dynamic Active = 9, Plane B Inline = 0, orphan count = 0.
     - SHA-256 naskah Artikel C terlindungi: `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28`.
  2. *Penegakan Aturan Pelaporan Entitas Kanonikal (`CANONICAL_ENTITY_REPORTING_RULE`):*
     - Setiap laporan penerimaan Antigravity wajib menggunakan ID, judul, slug, dan tipe relasi yang dibaca langsung dari data sumber kanonikal (tabel D1 `articles` dan `article_internal_links`).
     - Dilarang keras memparafrasekan, mengarang, atau menamai ulang judul artikel secara manual di dalam laporan penerimaan untuk mencegah timbulnya sinyal pengawakutuan palsu (*false debugging signal*). Wajib membedakan data produksi nyata dari data fixture pengujian.
  3. *Penegasan Urutan Roadmap Rekayasa Utama:*
     - Urutan rekayasa utama adalah: `INTERNAL_LINK_ENGINE` (CLOSED) $\rightarrow$ `ARTICLE_SUPPORT_MODULE` (CLOSED) $\rightarrow$ **`CONTENT_PROTECTION-1` (NEXT MAJOR MILESTONE)** $\rightarrow$ **`PRODUCT_DECISION_ENGINE`** $\rightarrow$ **`INTELLIGENCE_LAYER-1`**. Urutan ini tidak boleh diubah.
  4. *Registrasi Milestone Masa Depan `PRODUCT_REVIEW_AFFILIATE-1`:*
     - Berinduk di bawah `PRODUCT_DECISION_ENGINE` dengan status: `PLANNED` | `DESIGN INTENT CAPTURED` | `IMPLEMENTATION NOT STARTED`.
     - Permukaan interaksi: *Product Review Desk* di dalam Mission Control (bukan aplikasi terpisah).
     - Alur redaksi Chief Editor: Pemisahan tegas antara `PRODUCT SOURCE URL` (input riset redaksi & bukti) dan `AFFILIATE CTA URL` (tujuan transaksi pembaca).
     - Model Data Multi-Penawaran: Anti-pola "1 URL = 1 produk abadi" dihindari dengan entitas konseptual terpisah (`PRODUCT`, `VARIANT`, `OFFER`, `AFFILIATE_DESTINATION`, `PRICE_SNAPSHOT`, `SPEC_SNAPSHOT`, `REVIEW_SNAPSHOT`, `EVIDENCE_SOURCE`, `ARTICLE_PRODUCT_BINDING`).
     - Proteksi Pergeseran Identitas Listing (`PRODUCT_IDENTITY_DRIFT`, `LISTING_REPURPOSE_SUSPECTED`) untuk mendeteksi perubahan SKU/model/penjual pada listing marketplace.
     - Kebijakan Redaksi Review Produk: Default tipe `ANALYTICAL_REVIEW`. Dilarang menggunakan klaim pengujian fisik jika tidak diuji langsung (`SPONSORED_OR_AFFILIATE_CONTENT_CANNOT_CLAIM_HANDS_ON_TESTING_WITHOUT_PRIMARY_EVIDENCE`).
     - Agregasi Ulasan Konsumen: Diklasifikasikan sebagai `USER_EXPERIENCE_SIGNAL` dengan kewajiban menyajikan tema positif dan negatif secara berimbang tanpa *cherry-picking*.
     - Arsitektur Harga Dinamis: `PRICE_IS_DYNAMIC_COMMERCE_DATA_NOT_ARTICLE_PROSE`. Naskah artikel terbebas dari harga pasar transien; status kesegaran (`PRICE_FRESH`, `PRICE_RECENT`, `PRICE_STALE`, `PRICE_UNAVAILABLE`) disajikan via SSR edge tanpa *synchronous scraping* saat ada request pembaca.
     - Tombol CTA Afiliasi & Etika Komersial: `COMMERCIAL_DESTINATION_IS_SEPARATE_FROM_EDITORIAL_EVIDENCE` dan `AFFILIATE_REVENUE_CANNOT_MODIFY_EDITORIAL_RECOMMENDATION`. Komisi tidak boleh mempengaruhi penilaian redaksi. Tautan menggunakan `rel="sponsored nofollow noopener"` dengan bahasa tenang non-agresif.
     - Filosofi Utama: *"THE PRODUCT IS NOT THE CENTER OF THE ARTICLE. THE READER'S DECISION IS."*

### RANCANGLOKA-ARTICLE-SUPPORT-MOBILE-BALANCE-PRODUCTION: Responsive Mobile Card Visual Balance Polish, Full-Width Excerpt Flow & Zero DOM Duplication 2026-10-15

- **Tanggal / Waktu:** 2026-10-15T23:00:00+07:00
- **Status Operasional:** `ARTICLE_SUPPORT_MOBILE_BALANCE_PRODUCTION_COMPLETE`
- **Otorisasi:** Chief Editor Production Authorization (`AUTHORIZE ARTICLE_SUPPORT_MOBILE_BALANCE PRODUCTION DEPLOYMENT`)
- **Branch Aktif:** `feat/jev-lokamedia-integration`
- **Worker Deployment:**
  - Previous Worker ID: `2b3ab25b-5d05-4d8f-9f3f-b2c8190c1ec6`
  - New Worker ID: `1ec3dfd1-60b9-493f-aa48-ea63ea1dde0f`
- **Accepted Commit:**
  - `1525d8a` `style(ui): polish mobile visual balance for article support cards`
- **Pencapaian & Peningkatan Visual Mobile:**
  1. *Penyempurnaan Komposisi Visual Mobile (375–390px):*
     - **Baris 1:** Thumbnail kompak (56x56 px) berdampingan langsung dengan judul artikel tebal. Menghilangkan efek visual thumbnail yang tampak "gantung" atau void kosong canggung di bawah gambar.
     - **Baris 2:** Ringkasan naskah pembuka (ekserp) merentang selebar kartu (*full card width*) memberikan ruang bernapas yang proporsional dan nyaman dibaca.
     - **Baris 3:** Label relasi semantik dan estimasi waktu baca tampil di bawah ekserp selebar kartu.
  2. *Pelestarian Layout Desktop (sm: min-width 640px / 1280–1366px):*
     - Kolom kiri: Thumbnail 80x80 px.
     - Kolom kanan: Alur vertikal konvensional (Judul -> Ekserp -> Metadata). Visual desktop 100% identik dengan baseline yang telah disetujui sebelumnya.
  3. *Zero-JS & Zero DOM Duplication:*
     - Ditata murni menggunakan CSS Grid responsif (`grid grid-cols-[auto_1fr] sm:grid-cols-[80px_1fr]`).
     - Nol duplikasi elemen HTML, nol JavaScript di sisi klien (*zero client JS*).
     - Jika artikel target tidak memiliki gambar unggulan, kolom otomatis meluruh ke `grid-cols-1` tanpa menyisakan gutter kosong.
  4. *Integritas Naskah & Graf Semantik:*
     - Zero graph mutation (Plane A ACTIVE = 9, Plane B = 0, orphan count = 0).
     - Pemetaan relasi Artikel 8 (8->9, 8->7, 8->5) dan Artikel 9 (9->8, 9->6) tetap utuh.
     - Zero article mutation, hash naskah kanonikal Artikel C terverifikasi stabil (`12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28`).
     - Jalur thumbnail tetap mengonsumsi `/media/thumbnails/...` (WebP 160x160 px, `public, max-age=31536000, immutable`).
  5. *Invarian Keselamatan:*
     - `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, autonomous media worker = `DISABLED`.
- **Hasil & Status Keselamatan:**
  - Status Pengujian: `test-internal-link-engine.js` (29/29 PASS), `test-mission-control-liveops.js` (78/78 PASS), `npx tsc --noEmit` (0 errors), `npm run build` (sukses).
  - Klasifikasi: **`ARTICLE_SUPPORT_MOBILE_BALANCE_PRODUCTION_COMPLETE`** (`ARTICLE_SUPPORT_UI_POLISH_CLOSED`).

### RANCANGLOKA-ARTICLE-SUPPORT-CARD-HIERARCHY-PRODUCTION: Content Hierarchy Inversion to Conventional Title -> Excerpt -> Meta, Opening Prose Extraction & Verified Target Binding 2026-10-15

- **Tanggal / Waktu:** 2026-10-15T22:38:00+07:00
- **Status Operasional:** `ARTICLE_SUPPORT_CARD_HIERARCHY_PRODUCTION_COMPLETE`
- **Otorisasi:** Chief Editor Production Authorization (`AUTHORIZE ARTICLE_SUPPORT_CARD_HIERARCHY PRODUCTION DEPLOYMENT`)
- **Branch Aktif:** `feat/jev-lokamedia-integration`
- **Worker Deployment:**
  - Previous Worker ID: `8eab73f4-8533-441d-9c36-f3e23f6da455`
  - New Worker ID: `2b3ab25b-5d05-4d8f-9f3f-b2c8190c1ec6`
- **Accepted Commits:**
  - `3346082` `fix(ui): prioritize title and excerpt in article support cards`
  - `e80adfe` `fix(ui): use article opening prose in support card excerpts`
  - `eddd3d6` `fix(ui): verify support card target metadata binding`
- **Pencapaian & Peningkatan Hierarki Visual:**
  1. *Pembalikan Hierarki Visual Kanonikal:* Mengubah susunan kartu modul pendukung (`ArticleSupportModule.astro`) dari sebelumnya `reader_reason quote -> title -> meta` menjadi hierarki konvensional artikel terkait yang jauh lebih mudah dipindai pembaca:
     - **PRIMARY (JUDUL ARTIKEL):** Teks judul tebal (`text-sm sm:text-base font-semibold text-ink dark:text-paper`), tautan crawlable `<a>` dengan efek underline interaktif.
     - **SECONDARY (EKSERP PEMBUKA):** Teks ringkasan pembuka (`text-xs sm:text-sm text-muted dark:text-stone/80 line-clamp-2 sm:line-clamp-3`), bersumber dari paragraf pembuka naskah artikel target.
     - **TERTIARY (METADATA HUBUNGAN & WAKTU BACA):** Label relasi semantik (`font-mono text-[11px] uppercase tracking-wider`) dan estimasi waktu baca (`• X min read`).
  2. *Prioritas Ekstraksi Ekserp Prosa Pembuka:*
     - *Primary:* Kalimat/paragraf pembuka bermakna pertama dari `content_md` artikel target (melewati heading, blockquote, tabel, pemisah baris, gambar, dan definisi sitasi).
     - *Secondary:* Tag `<p>` pembuka pertama dari `content_html` jika `content_md` kosong.
     - *Fallback:* Kolom `articles.description` hanya jika naskah tubuh artikel tidak tersedia.
     - *Pemotongan Rapi:* Memotong secara bersih pada batas kalimat lengkap (80–180 karakter) atau batas kata dengan elipsis `…`, tanpa memotong kata di tengah jalan.
  3. *Perlindungan reader_reason:* Nilai `reader_reason` disembunyikan sepenuhnya dari antarmuka publik dan tetap tersimpan utuh di basis data D1 untuk analisis editorial internal.
  4. *Verifikasi Pengikatan Target Nyata (Real Target Binding):* Memastikan `target_article_id`, `target_title`, `target_slug`, `target_excerpt`, dan `target_featured_image` semuanya berasal secara atomik dari baris artikel target yang sama (`articles a INNER JOIN article_internal_links l ON l.target_article_id = a.id`). Mismatch pada laporan sebelumnya terbukti hanya bersumber dari teks uji/paraphrase sintetis pada mock laporan dan telah diperbaiki.
  5. *Uji Asap Produksi & Visual (Desktop & Mobile):*
     - HTTP 200 terverifikasi pada Artikel 5, 6, 7, 8, dan 9.
     - Artikel 8 merender 3 kartu dengan pengikatan target 100% konsisten (Target 9: Shading Luar, Target 7: Jendela Berkondensasi, Target 5: Kusen Aluminium vs uPVC).
     - Artikel 9 merender 2 kartu (Target 8: Thermal Bridge Kusen, Target 6: Rekayasa Ventilasi Silang).
     - Thumbnail tetap menggunakan derivatif ringkas `/media/thumbnails/...` (HTTP 200, WebP 160x160 px, `Cache-Control: public, max-age=31536000, immutable`).
     - Tampilan visual desktop (1366x900) dan mobile (390x844) membuktikan hierarki judul dominan, ekserp proporsional, zero overflow, image-induced CLS protection, dan zero client-side JavaScript.
  6. *Integritas Graf & Naskah:* Plane A ACTIVE = 9, Plane B = 0, orphan count = 0. Zero mutasi pada graf D1, naskah artikel, maupun hash Artikel C (`12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28`).
  7. *Invarian Keselamatan:* `automation_mode = OFF`, `AUTO_PUBLISH = OFF`, `JEV_MODE = shadow`, `publishingAuthority = 0`, media worker = `DISABLED`.
- **Hasil & Status Keselamatan:**
  - Status Pengujian: `test-internal-link-engine.js` (29/29 PASS), `test-mission-control-liveops.js` (78/78 PASS), `npx tsc --noEmit` (0 errors), `npm run build` (sukses).
  - Klasifikasi: **`ARTICLE_SUPPORT_CARD_HIERARCHY_PRODUCTION_COMPLETE`** (`ARTICLE_SUPPORT_CARD_HIERARCHY_CLOSED`).

### RANCANGLOKA-ARTICLE-SUPPORT-THUMBNAIL-PRODUCTION-DEPLOYMENT: Live Production Activation, 5 R2 Derivatives Backfilled, 96.6% Bandwidth Reduction & Zero CLS 2026-10-15

- **Tanggal / Waktu:** 2026-10-15T21:25:00+07:00
- **Status Operasional:** `ARTICLE_SUPPORT_THUMBNAIL_PRODUCTION_COMPLETE`
- **Otorisasi:** Chief Editor Production Authorization (`AUTHORIZE ARTICLE_SUPPORT_THUMBNAIL PRODUCTION DEPLOYMENT`)
- **Branch Aktif:** `feat/jev-lokamedia-integration`
- **Accepted Commits:**
  - `76e03f7` `feat(ui): add thumbnails to semantic article support module`
  - `39078ef` `perf(media): add compact derivatives for article support thumbnails`
  - `e180431` `fix(media): harden thumbnail derivative lifecycle and cache safety`
  - `9461c9e` `fix(media): make thumbnail generation runtime-safe`
- **Pencapaian Produksi:**
  1. *Backfill Produksi R2 (5 Objek Derivatif):* Kelima berkas WebP derivatif 160x160 px berhasil diunggah ke bucket R2 produksi `rancangloka-media` di bawah kunci kanonikal `thumbnails/<filename>`. Verifikasi HTTP langsung mengonfirmasi status 200 OK, `Content-Type: image/webp`, dimensi 160x160, dengan total ukuran transfer R2 hanya 34.12 KB.
  2. *Worker Deployment:* Versi Worker produksi diperbarui dari `d81c7b65-eee6-468d-b517-36d6ac77dcf6` ke `8eab73f4-8533-441d-9c36-f3e23f6da455`. Worker terbukti runtime-safe (zero native binary/sharp dependencies di edge runtime).
  3. *Uji Asap Produksi Artikel 5–9 (HTTP 200 & Modul Dukungan):*
     - Artikel 5: HTTP 200, 1 kartu dukungan (Artikel 8).
     - Artikel 6: HTTP 200, 1 kartu dukungan (Artikel 9).
     - Artikel 7: HTTP 200, 2 kartu dukungan (Artikel 8, 9).
     - Artikel 8: HTTP 200, 3 kartu dukungan (Artikel 9, 7, 5).
     - Artikel 9: HTTP 200, 2 kartu dukungan (Artikel 8, 6).
  4. *Pengurangan Bandwidth Terverifikasi di Produksi:* Pada modul 3 kartu Artikel 8, payload thumbnail berhasil direduksi dari baseline ~577.9 KB menjadi tepat **19.68 KB (20,156 B)**, menghasilkan **96.6% bandwidth reduction**.
  5. *Header & Cache Safety:* Header terverifikasi `Cache-Control: public, max-age=31536000, immutable`, dan header `X-RL-Thumbnail-Fallback` tidak ada (direct derivative hit).
  6. *Uji Visual Produksi (Desktop & Mobile):* Inspeksi visual pada breakpoint desktop 1366 px dan mobile 390 px membuktikan thumbnail beresolusi tajam, crop 1:1 proporsional, teks dan judul tetap dominan, zero overflow, dan tampilan editorial premium tenang (*quiet premium editorial*).
  7. *Integritas Graf & Naskah:* Plane A ACTIVE = 9, Plane B = 0, orphan count = 0. Seluruh naskah artikel utuh dan hash Artikel C `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28` 100% terjaga.
  8. *Invarian Keselamatan:* `automation_mode = OFF`, `AUTO_PUBLISH = OFF`, `JEV_MODE = shadow`, `publishingAuthority = 0`.
- **Hasil & Status Keselamatan:**
  - Status Pengujian: `test-internal-link-engine.js` (28/28 PASS), `test-mission-control-liveops.js` (78/78 PASS), `npx tsc --noEmit` (0 errors), `npm run build` (sukses).
  - Klasifikasi: **`ARTICLE_SUPPORT_THUMBNAIL_PRODUCTION_COMPLETE`** (`ARTICLE_SUPPORT_THUMBNAIL_MILESTONE_CLOSED`).

### RANCANGLOKA-ARTICLE-SUPPORT-THUMBNAIL-PAYLOAD-OPTIMIZATION: Canonical 160x160 WebP Derivative Pipeline, 96.6% Transferred Byte Reduction & Edge Fallback 2026-10-15

- **Tanggal / Waktu:** 2026-10-15T16:50:00+07:00
- **Status Operasional:** `ARTICLE_SUPPORT_THUMBNAIL_PAYLOAD_OPTIMIZED`
- **Branch Aktif:** `feat/jev-lokamedia-integration`
- **Commit:** `39078ef` (`perf(media): add compact derivatives for article support thumbnails`)
- **Pencapaian Kunci Optimasi Payload:**
  1. *Pengukuran Baseline Payload:* Gambar sampul editorial pada artikel 5–9 berukuran 1200–1315 px lebar dengan ukuran 146–218 KB per gambar (total 5 gambar = 872.1 KB). Pada Artikel 8 (3 kartu dukungan: 9, 7, 5), modul pendukung sebelumnya mentransfer ~577.9 KB (591.740 bytes) meskipun thumbnail hanya ditampilkan pada ukuran 80x80 px (desktop) dan 56x56 px (mobile).
  2. *Arsitektur Derivatif Kanonikal 160x160 WebP:* Menetapkan standar derivatif thumbnail kanonikal 160x160 px (rasio 1:1, center-crop, Lanczos downsampling) dalam format WebP (quality=85).
  3. *Resolusi URL & Preset:* Menambahkan preset `compactThumb` ke `MAGAZINE_IMAGE_PRESETS` dan fungsi `getCanonicalThumbnailUrl` di `src/lib/image.ts`, memetakan path R2 kanonikal `/media/images/<filename>` atau `/media/<filename>` secara deterministik ke `/media/thumbnails/<filename>`.
  4. *Pencegahan Kegagalan Edge (Edge Fallback Invariant):* Menambahkan penanganan fallback otomatis pada endpoint dynamic `src/pages/media/[...key].ts`. Jika berkas `thumbnails/<filename>` belum diunggah ke R2, sistem otomatis mengalirkan gambar asli `images/<filename>`, menjamin zero broken images selama proses deployment/backfill.
  5. *Pengurangan Payload Terukur:*
     - Artikel 5: 166.8 KB $\rightarrow$ 7.09 KB (95.8% reduction)
     - Artikel 6: 148.0 KB $\rightarrow$ 9.12 KB (93.8% reduction)
     - Artikel 7: 193.1 KB $\rightarrow$ 5.53 KB (97.1% reduction)
     - Artikel 8: 146.3 KB $\rightarrow$ 4.52 KB (96.9% reduction)
     - Artikel 9: 218.0 KB $\rightarrow$ 7.07 KB (96.8% reduction)
     - Total 5 thumbnail: 872.1 KB $\rightarrow$ 33.32 KB (96.2% overall reduction, rerata ~6.66 KB per thumbnail, melampaui target $\le$ 25 KB).
     - Modul 3 Kartu Artikel 8: 577.9 KB $\rightarrow$ 19.68 KB (**96.6% bandwidth reduction**).
  6. *Invarian Tata Letak & Zero JS:* Preserved layout 80x80 desktop / 56x56 mobile, `loading="lazy"`, `decoding="async"`, `aspect-ratio: 1/1` (CLS = 0), `alt=""`, `aria-hidden="true"`, serta zero client JS.
  7. *Integritas Naskah & Graf Semantik:* 9 hubungan Plane A aktif, 0 baris Plane B inline, hash Artikel C `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28` 100% utuh tanpa perubahan.
  8. *Rencana Backfill Produksi:* 5 berkas WebP derivatif dibangkitkan lokal via `scripts/create-thumbnail-derivatives.py` ke `artifacts/thumbnails/`, siap diunggah ke R2 bucket `rancangloka-media` segera setelah otorisasi produksi diberikan.
- **Hasil & Status Keselamatan:**
  - Status Pengujian: `test-internal-link-engine.js` (26/26 PASS), `npx tsc --noEmit` (0 errors), `npm run build` (sukses).
  - Status Produksi: Belum ada deploy/push atau mutasi R2 produksi (staging/local only).
  - Klasifikasi: **`ARTICLE_SUPPORT_THUMBNAIL_PAYLOAD_OPTIMIZED`** (`READY_FOR_THUMBNAIL_PRODUCTION_AUTHORIZATION`).

### RANCANGLOKA-INTERNAL-LINK-ORPHAN-REMEDIATION-COMPLETE: Activation of Approved Plane A Edges 1–4, Production Graph Total 9 & Zero Corpus Orphans 2026-10-15

- **Tanggal / Waktu:** 2026-10-15T16:05:00+07:00
- **Status Operasional:** `INTERNAL_LINK_ORPHAN_REMEDIATION_COMPLETE`
- **Branch Aktif:** `feat/jev-lokamedia-integration`
- **Otorisasi Chief Editor:** `AUTHORIZE ORPHAN REMEDIATION EDGES 1-4`
- **Pencapaian Kunci Remediasi Yatim:**
  1. *Aktivasi 4 Tepi Semantik Terkurasi (Plane A Dynamic, Status ACTIVE):*
     - Edge 1 (ID 6): 5 (`kusen-aluminium-vs-upvc`) $\rightarrow$ 8 (`thermal-bridge-kusen-aluminium`), `RELATED_MATERIAL`.
     - Edge 2 (ID 7): 8 (`thermal-bridge-kusen-aluminium`) $\rightarrow$ 5 (`kusen-aluminium-vs-upvc`), `RELATED_DECISION`.
     - Edge 3 (ID 8): 6 (`rekayasa-ventilasi-silang`) $\rightarrow$ 9 (`memilih-sistem-shading-luar`), `RELATED_SYSTEM` (menggunakan alasan redaksi yang disempurnakan: *"Agar bukaan ventilasi silang tetap efektif sekaligus lebih terlindungi dari tempias hujan dan paparan panas matahari, pelajari pilihan sistem peneduh luar yang sesuai dengan orientasi bangunan."*).
     - Edge 4 (ID 9): 9 (`memilih-sistem-shading-luar`) $\rightarrow$ 6 (`rekayasa-ventilasi-silang`), `RELATED_SYSTEM`.
  2. *Status Graf Produksi:* Total relasi semantik aktif kini berjumlah tepat 9 baris (5 eksisting + 4 baru). Seluruhnya `PLANE_A_DYNAMIC` dan `ACTIVE`. Zero baris `PLANE_B_INLINE`.
  3. *Eliminasi Yatim Produksi:* Diagnostik orphan pada D1 produksi mengonfirmasi `orphan_article_count = 0`. Artikel 5 dan Artikel 6 sepenuhnya terintegrasi dalam jalur penemuan dua-arah.
  4. *Integritas Naskah & Hash:* Seluruh naskah (`content_md`, `content_html`, `content_hash`) pada kelima artikel (5, 6, 7, 8, 9) 100% utuh tanpa perubahan. Hash Artikel C terverifikasi tepat `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28`.
  5. *Deduplikasi & Tampilan Publik:* Modul *"Artikel Pendukung untuk Keputusan Ini"* terverifikasi merender destinasi yang relevan (HTTP 200). Permukaan BACA JUGA pada Artikel 8 secara otomatis mengecualikan Artikel 5 yang kini telah menjadi kartu prioritas Plane A, mencegah duplikasi destinasi.
  6. *Kestabilan Runtime Worker:* Tidak ada deployment ulang yang dibutuhkan (Worker Version tetap `d81c7b65-eee6-468d-b517-36d6ac77dcf6`).
- **Hasil & Status Keselamatan:**
  - Status Produksi: HTTP 200 pada seluruh artikel (5, 6, 7, 8, 9).
  - Status Keselamatan: `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `autonomous media worker = DISABLED`.
  - Klasifikasi: **`INTERNAL_LINK_ORPHAN_REMEDIATION_COMPLETE`**.

### RANCANGLOKA-INTERNAL-LINK-ENGINE-1-PRODUCTION-ACCEPTED: Production Migration 0033, Worker Deployment d81c7b65 & Initial Approved Plane A Semantic Graph Seed 2026-10-15

- **Tanggal / Waktu:** 2026-10-15T14:35:00+07:00
- **Status Operasional:** `INTERNAL_LINK_ENGINE_1_PRODUCTION_ACCEPTED`
- **Branch Aktif:** `feat/jev-lokamedia-integration`
- **Otorisasi Chief Editor:** `AUTHORIZE INTERNAL_LINK_ENGINE_1 PRODUCTION ACCEPTANCE`
- **Pencapaian Kunci Akseptasi Produksi:**
  1. *Penerapan Migrasi D1 0033:* Migrasi `0033_internal_link_engine.sql` berhasil diterapkan ke database Cloudflare D1 produksi (`rancangloka_db`, ID `3a86e9ad-410f-4440-884e-2eb813ec4cf7`). Terverifikasi 13 kolom tabel `article_internal_links`, 9 tipe relasi kanonikal, kontrak unik `UNIQUE(source_article_id, target_article_id, placement_plane)`, serta kolom `pillar_role` (default 'STANDALONE') dan `parent_pillar_id` (default NULL) pada tabel `articles`.
  2. *Integritas Naskah Terbit:* Naskah `content_md`, `content_html`, dan `content_hash` Artikel A (ID 7), Artikel B (ID 8), dan Artikel C (ID 9) 100% utuh tanpa perubahan. Hash Artikel C terverifikasi tepat `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28`.
  3. *Deployment Worker Edge:* Kode Internal Link Engine V1 berhasil dideploy ke Cloudflare Workers produksi (`rancangloka`):
     - Version ID Sebelumnya: `bc828313-97ca-4b6e-a0b7-630447b4e279`
     - Version ID Baru: `d81c7b65-eee6-468d-b517-36d6ac77dcf6`
     - Startup Time: 12 ms, 4 cron triggers aktif.
  4. *Penyemaian Graf Semantik Plane A yang Disetujui:* Menyemai tepat 5 hubungan `PLANE_A_DYNAMIC` berstatus `ACTIVE` yang disetujui Chief Editor:
     - 9 (Artikel C) $\rightarrow$ 8 (Artikel B): `RELATED_MATERIAL`
     - 8 (Artikel B) $\rightarrow$ 9 (Artikel C): `RELATED_DECISION`
     - 8 (Artikel B) $\rightarrow$ 7 (Artikel A): `RELATED_PROBLEM`
     - 7 (Artikel A) $\rightarrow$ 8 (Artikel B): `BACKGROUND_EXPLAINER`
     - 7 (Artikel A) $\rightarrow$ 9 (Artikel C): `RELATED_SYSTEM`
     - Zero relasi `PLANE_B_INLINE`, zero `PARENT_PILLAR`, zero `CHILD_SUPPORTING`.
  5. *Verifikasi Modul Pendukung Publik (Live Smoke Test):*
     - Artikel A: Merender 2 kartu tujuan (Artikel B & C) dengan alasan pembaca kontekstual.
     - Artikel B: Merender 2 kartu tujuan (Artikel C & A) dengan alasan pembaca kontekstual.
     - Artikel C: Merender 1 kartu tujuan (Artikel B) dengan alasan pembaca kontekstual.
     - Seluruh tautan menggunakan `<a href>` native, crawlable, SSR, zero client JS.
  6. *Deduplikasi Permukaan Publik:* Seluruh destinasi Plane A tidak muncul berulang di in-article BACA JUGA maupun grid footer RelatedArticles.
  7. *Diagnostik Orphan Produksi:* Terdeteksi 2 artikel yatim terbit (`orphan_article_count: 2`, ID 5 dan 6). Tidak ada perbaikan mekanis otomatis (zero mechanical quotas).
  8. *Kesiapan Rollback:* Terpelihara di `state/PRE_MIGRATION_0033_RECOVERY_RECORD.json` dan skrip pembatalan D1/deployment.
- **Hasil & Status Keselamatan:**
  - Status Produksi: HTTP 200 pada seluruh rute artikel.
  - Performa Edge: Latensi rata-rata ~417–489 ms pada Cloudflare edge, D1 query timing ~0.55 ms.
  - Lighthouse / Core Web Vitals: `NOT_MEASURED` (tidak tersedia tooling CLI lokal).
  - Status Keselamatan: `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `autonomous media worker = DISABLED`.
  - Klasifikasi: **`INTERNAL_LINK_ENGINE_1_PRODUCTION_ACCEPTED`**.

### RANCANGLOKA-INTERNAL-LINK-ENGINE-1-HARDENING: Pre-Production Hardening, DB-Level Invariant, Generic Semantic Discovery & Mission Control E2E Lifecycle 2026-10-15

- **Tanggal / Waktu:** 2026-10-15T13:30:00+07:00
- **Status Operasional:** `INTERNAL_LINK_ENGINE_1_PREPROD_HARDENED`
- **Branch Aktif:** `feat/jev-lokamedia-integration`
- **Tujuan Rekayasa:**
  - Melakukan pre-production hardening dan audit akseptasi E2E komprehensif untuk Internal Link Engine V1 sebelum dilakukan migrasi dan deployment ke lingkungan produksi.
  - Menegakkan invarian database satu hubungan primer per penempatan (`ONE_PRIMARY_RELATIONSHIP_PER_PLACEMENT`): `UNIQUE(source_article_id, target_article_id, placement_plane)`.
  - Membuktikan penemuan semantik generik berbasis taksonomi arsitektur (`ARCHITECTURAL_TAXONOMY` dan `ARCHITECTURAL_SUBSYSTEMS`) tanpa overfit atau hardcoding Artikel A/B/C.
  - Menyambungkan status tautan bermakna ke dalam Mission Control runtime (`ArticleOperationsSummary` dan pipeline board Chief Editor pada `stage: 'ready_for_review'`).
  - Menegakkan konsistensi hierarki pilar: `PILLAR` dan `STANDALONE` wajib ber-parent null, `SUPPORTING` wajib ber-parent pilar valid, pelarangan referensi mandiri dan melingkar (*anti-circularity*).
  - Melakukan pemisahan terminologi performa yang akurat: membedakan `LOCAL MICROBENCHMARK` (~0.0070 ms) dan `LOCAL SSR BENCHMARK` (~0.0548 ms) dari pengukuran produksi D1/Lighthouse pasca-deployment.
  - Mendeduplikasi permukaan rekomendasi publik (Plane A, in-article BACA JUGA, dan footer RelatedArticles) agar tidak menampilkan destinasi redundan.
- **Hasil & Status Keselamatan:**
  - Pengujian Otomatis: 25/25 tes di `scripts/test-internal-link-engine.js` lulus 100%.
  - Seluruh rangkaian regresi lulus (Mission Control, Staff Registry, Article Persistence, Content Quarantine, Dimas-Budi Handoff, Nadia Reader Voice, Premium Editorial Depth).
  - Typecheck (`npx tsc --noEmit`) dan Astro build (`npm run build`) lulus bersih tanpa catatan error.
  - Artikel C Clean Draft SHA-256: `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28` (100% utuh tanpa perubahan).
  - Nol mutasi D1/R2 produksi, nol deployment, nol push remote, nol seeding relasi produksi.
  - Klasifikasi: **`INTERNAL_LINK_ENGINE_1_PREPROD_HARDENED`**.
  - Status Akhir: `READY_FOR_INTERNAL_LINK_ENGINE_1_PRODUCTION_ACCEPTANCE`.

### RANCANGLOKA-INTERNAL-LINK-ENGINE-1: Semantic Internal Link Engine V1, Two-Plane Architecture, Explicit Pillar Metadata & Content Provenance Invariants 2026-10-15

- **Tanggal / Waktu:** 2026-10-15T13:00:00+07:00
- **Status Operasional:** `INTERNAL_LINK_ENGINE_1_IMPLEMENTATION_COMPLETE`
- **Branch Aktif:** `feat/jev-lokamedia-integration`
- **Prinsip Produk Kanonikal:** *"Internal link RancangLoka harus melanjutkan perjalanan berpikir pembaca, bukan sekadar memindahkan PageRank."*
- **Pencapaian Kunci Implementasi V1:**
  1. *Migrasi D1 `0033_internal_link_engine.sql`:* Membuat tabel `article_internal_links` dengan 9 relasi semantik berpusat pembaca (`PARENT_PILLAR`, `CHILD_SUPPORTING`, `RELATED_PROBLEM`, `RELATED_MATERIAL`, `RELATED_DECISION`, `BACKGROUND_EXPLAINER`, `NEXT_STEP`, `RELATED_SYSTEM`, `RELATED_FAILURE_MODE`), batasan unik empat-kunci `UNIQUE(source_article_id, target_article_id, relationship_type, placement_plane)`, pengikatan `source_content_hash`, serta kolom metadata pilar eksplisit (`pillar_role` dan `parent_pillar_id` pada `articles`).
  2. *Penegakan Invarian Bebas Kuota Mekanis (`NO_MECHANICAL_INTERNAL_LINK_QUOTA`):* Menghapus seluruh kuota arbitrer (misal target N link per X kata). Kepadatan tautan murni ditentukan oleh kebutuhan kognitif perjalanan pembaca.
  3. *Invarian Identitas Pilar Eksplisit (`INVARIANT_EXPLICIT_PILLAR_IDENTITY`):* Tipe relasi `PARENT_PILLAR` dan `CHILD_SUPPORTING` secara ketat mewajibkan artikel terkait ditandai `pillar_role = 'PILLAR'` secara eksplisit di basis data. Dilarang menyimpulkan status pilar dari judul, panjang teks, atau kategori.
  4. *Arsitektur Dua-Bidang (Two-Plane Architecture):*
     - **Plane A (Dynamic Safe Linking):** Dirender di sisi server (SSR) pada modul *"Artikel Pendukung untuk Keputusan Ini"* di luar naskah berbayang hash. Menghasilkan zero mutation pada `content_md`, `content_html`, maupun `content_hash`.
     - **Plane B (Editorial Inline Linking):** Tautan inline hanya dirancang pada fase draf baru (Joko) dan direview dalam alur normal. Untuk artikel yang sudah terbit, engine hanya menerbitkan rekomendasi revisi (`LINK_REVISION_RECOMMENDED`). Dilarang keras menulis ulang atau menyuntikkan tautan ke dalam naskah terbit secara diam-diam.
  5. *Provenans Hash Revisi Plane B:* Saat relasi `PLANE_B_INLINE` mencapai status `ACTIVE`, relasi mengikat `source_content_hash` artikel yang disetujui. Jika hash naskah artikel sumber berubah di kemudian hari, relasi otomatis ditandai `STALE` hingga direvalidasi.
  6. *Pembersihan Linker Regex Mekanis:* Menonaktifkan injeksi regex keyword mekanis secara default di `processArticleContent(...)` (`src/lib/seo.ts`). Naskah terbit terlindungi dari mutasi runtime liar.
  7. *Modul Pendukung Zero-JS SSR:* Mengimplementasikan `ArticleSupportModule.astro` dengan tautan crawlable `<a href>`, alasan pembaca (*reader_reason*), dan visual bersahaja. Render nihil (*zero box*) jika tidak ada relasi aktif.
  8. *Deteksi Orphan & Penemuan Dua-Arah:* Algoritma diagnostik mendeteksi artikel terbit tanpa jalur masuk semantik tanpa kuota angka kaku. Penemuan dua-arah deterministik menghubungkan naskah baru dan lama berdasarkan klaster domain fisika bangunan.
  9. *Pengujian & Verifikasi Kinerja:* 20/20 tes di `scripts/test-internal-link-engine.js` lulus. Lookup D1 Plane A terukur ~0.0052 ms, render prosesor naskah ~0.0465 ms. Hash naskah Artikel C `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28` 100% utuh.
- **Invarian Keselamatan:** Tidak ada mutasi basis data D1 produksi, tidak ada deployment, tidak ada push remote. Status siap untuk evaluasi Chief Editor: `READY_FOR_INTERNAL_LINK_ENGINE_1_PRODUCTION_ACCEPTANCE`.

### OFFLINE-MASTER-CHECKPOINT-2026-10-15: Article C Live Production, Premium Editorial Depth (PED-1), Staff Orchestration & Dimas → Budi E2E Visual Handoff

- **Tanggal / Waktu:** 2026-10-15T12:30:00+07:00
- **Status Operasional:** `READY_FOR_OFFLINE`
- **Branch Aktif:** `feat/jev-lokamedia-integration` (HEAD: `05b776d`)
- **Pencapaian Kunci Sesi 15 Oktober 2026:**
  1. *Eksekusi Publikasi Produksi Artikel C:* Naskah kanonikal *Memilih Sistem Shading Luar untuk Rumah Tropis* diterbitkan secara resmi menyusul otorisasi eksplisit Chief Editor (`AUTHORIZE ARTICLE C FINAL PUBLICATION`). Berstatus **`PUBLISHED`** di edge (`https://rancangloka.com/memilih-sistem-shading-luar-rumah-tropis`, Article ID 9, receipt `rcpt_artC_8341d2fda3bc`). Teks alt dan media R2 `ast_4ee0363758a41bd45aae7353` terikat secara kriptografis, hash naskah `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28` 100% utuh tanpa retrofit.
  2. *Milestone `RANCANGLOKA_PREMIUM_EDITORIAL_DEPTH_1`:* Menetapkan 5 pilar kedalaman redaksional (`DECISION_DEPTH_7Q_NEXT`, `FAILURE_ANATOMY`, `MICRO_PERSONA_SCENARIOS`, `EVIDENCE_METHOD_TRANSPARENCY`, `VISUAL_STORYTELLING`). Penegakan keras `INVARIANT_NO_UNVERIFIED_FIRST_HAND_AUTHORITY` (larangan mengarang klaim inspeksi lapangan) & `TESTED_BY_RANCANGLOKA` (`RESERVED / PRIMARY-EVIDENCE-ONLY`).
  3. *Milestone `RANCANGLOKA_PREMIUM_EDITORIAL_DEPTH_STAFF_WIRING`:* Standardisasi orkestrasi 7 anggota staf redaksi (Irwan, Joko, Nadia, Rina, Budi, Dimas, Jefry), kontrak `VisualBrief` terstruktur, dan penetapan Budi (`lokamedia_worker_primary`, `media_operations`) sebagai pemilik kanonikal cabang media dengan `BUDI_PUBLISHING_AUTHORITY = 0`.
  4. *Milestone `RANCANGLOKA_DIMAS_BUDI_E2E_VISUAL_HANDOFF`:* Menutup mata rantai jembatan pengiriman media (`DIMAS_BUDI_E2E_HANDOFF_COMPLETE`, komit `05b776d`). Pengecekan semantik Dimas pasca-draft Joko mendispatch tiket kerja terstruktur ke tabel `media_jobs` (`role: 'inline'`, `status: 'QUEUED'`, `required_for_readiness: 1`). Preservasi kontrak lossless melalui blok JSON prompt, idempotensi deterministik tanpa duplikasi tiket, visibilitas nyata di Mission Control & Pixel Office (`waiting_media`), dan penegakan gerbang kesiapan publikasi.
- **Integritas Pengujian:** Seluruh rangkaian pengujian lulus 100% (`test-dimas-budi-visual-handoff-e2e.js` 14/14, `test-premium-editorial-depth.js` 20/20, `test-staff-registry.js` 16/16, `test-mission-control-expansion.js` 12/12, `test-nadia-reader-voice.js` 35/35, `test-editorial-human-quality.js` 22/22, `test-lokamedia-human-approval-boundary.js` 8/8), TypeScript typecheck bersih (0 error), dan Astro build berhasil (6.18s).
- **Invarian Keselamatan:** `AUTO_PUBLISH = OFF`, `JEV_MODE = shadow`, `Autonomous Media Gen = DISABLED`, mutasi D1/R2 produksi sesi ini = 0, push remote = 0. Berkas acuan offline: `state/OFFLINE_CHECKPOINT_20261015.md` & `state/DIMAS_BUDI_E2E_VISUAL_HANDOFF_CHECKPOINT.md`.

### RANCANGLOKA-DIMAS-BUDI-E2E-VISUAL-HANDOFF: Closing Editorial-to-Media Dispatch Bridge, Canonical media_jobs Integration, Mission Control Visibility & Full Review Gate 2026-10-15

- **Tanggal / Waktu:** 2026-10-15T12:15:00+07:00
- **Status Operasional:** `DIMAS_BUDI_E2E_HANDOFF_COMPLETE`
- **Branch Aktif:** `feat/jev-lokamedia-integration`
- **Tujuan Rekayasa & Redaksional:**
  - Menutup mata rantai yang hilang pada *Editorial-to-Media Dispatch Bridge* (`DIMAS_BUDI_E2E_HANDOFF_PARTIAL` $\rightarrow$ `DIMAS_BUDI_E2E_HANDOFF_COMPLETE`).
  - Mengimplementasikan alur runtime nyata yang menghubungkan evaluasi kedalaman editorial Dimas ke antrean tugas kanonikal Budi (`lokamedia_worker_primary`), visibilitas Mission Control, mitigasi duplikasi idempoten, dan penegakan gerbang kesiapan publikasi.
- **Implementasi & Invarian Utama:**
  1. **Runtime Dispatch Bridge (`INVARIANT_EDITORIAL_MEDIA_DISPATCH_BRIDGE`):**
     - Setelah naskah draf Joko diproduksi, evaluasi Premium Editorial Depth dijalankan secara otomatis di `editorial-runtime.ts`.
     - Jika `visual_storytelling_need = REQUIRED`, sistem memanggil `generateEditorialVisualBriefs(...)` dan mendispatch brief terstruktur ke tabel kanonikal `media_jobs` via `dispatchEditorialVisualBriefs(...)`.
     - Jika `OPTIONAL`, brief tidak didispatch secara otomatis (hanya jika diminta eksplisit oleh Chief Editor).
     - Jika `NOT_REQUIRED`, nol tiket kerja media dibuat.
  2. **Model Persistensi Tugas Tanpa Skema Baru:**
     - Menggunakan tabel kanonikal `media_jobs` dengan atribut `role: 'inline'`, `slot_key: 'inline_<visual_class>_<seq>'`, `media_type: 'image'`, dan status `QUEUED`.
     - Nilai `required_for_readiness` bernilai `1` untuk visual berstatus `REQUIRED`, sehingga artikel terblokir dari status `READY_FOR_REVIEW` sampai aset terverifikasi terpasang.
  3. **Preservasi Metadata Brief Terstruktur Lossless:**
     - Seluruh kontrak `VisualBrief` (`reader_problem`, `visual_goal`, `technical_truth_to_preserve`, `misrepresentation_risks`, `source_references`, `caption_intent`, `alt_text_intent`, `assigned_operator`, `visual_truth_label`) disimpan dalam `prompt` dengan blok terstruktur `--- BRIEF_PAYLOAD_JSON ---`.
     - Fungsi `extractVisualBriefFromMediaJob` memulihkan objek brief asli secara 100% lossless.
  4. **Idempotensi Ketat Tanpa Duplikasi:**
     - Identitas berbasis kombinasi `article_id`, `slot_key`, dan `prompt_hash`.
     - Evaluasi berulang pada draf yang sama menghasilkan status idempotent NO-OP dengan nol pembuatan pekerjaan duplikat.
     - Perubahan substansial pada draf naskah memicu mekanisme *supersede* (`supersedeMediaJob`) untuk menjaga integritas versi.
  5. **Visibilitas Mission Control & Pixel Office:**
     - Mission Control (`getPipelineBoard`) mengenali tugas artikel dalam status `waiting_media` yang terikat pada `relatedMediaJobId`.
     - `deriveStaffCurrentTask` dan `attributeTaskOwnership` mengatribusikan pekerjaan media ke Budi (`lokamedia_worker_primary`, departemen `media_operations`).
     - `deriveCanonicalHandoffsFromPipeline` mencerminkan serah-terima tugas nyata dari Joko (`content_writer_primary`) ke Budi (`lokamedia_worker_primary`).
     - Pixel Office mencerminkan tugas aktual; saat tidak ada tugas, staf berada dalam status siaga tanpa dekorasi palsu.
  6. **Keselamatan Eksekusi & Otoritas Redaksional:**
     - Pembuatan tiket kerja Budi berstatus `QUEUED` dan **TIDAK** mengizinkan pembuatan gambar otonom (media worker tetap tunduk pada dual-gate dan persetujuan operator).
     - Budi memiliki otoritas publikasi = 0 (`BUDI_PUBLISHING_AUTHORITY = 0`), tidak dapat mempublikasikan langsung, dan tidak dapat memotong rantai redaksi kanonikal: `Budi (persiapan) -> Nadia (keterbacaan) -> Rina (kebenaran) -> Persetujuan Manusia -> Sari (publikasi)`.
  7. **Integritas Artikel C Terpelihara:**
     - Artikel C berstatus LIVE sama sekali tidak dimodifikasi. Hash kanonikal `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28` terbukti 100% utuh tanpa retrofit.
- **Pengujian & Validasi:**
  - 14 pengujian lokal E2E di `scripts/test-dimas-budi-visual-handoff-e2e.js` lulus 100%.
  - Seluruh rangkaian regresi lulus: `test-premium-editorial-depth.js` (20/20), `test-staff-registry.js` (16/16), `test-mission-control-expansion.js` (12/12), `test-nadia-reader-voice.js` (35/35), `test-editorial-human-quality.js` (22/22), `test-lokamedia-human-approval-boundary.js` (8/8).
  - Typecheck (`npx tsc --noEmit`), Astro build (`npm run build`), dan pemeriksaan git diff (`git diff --check`) lulus tanpa catatan error.

### RANCANGLOKA-PREMIUM-EDITORIAL-DEPTH-STAFF-WIRING: Budi Visual Storytelling Ownership, Visual Brief Contract, Truth Rules & Staff Orchestration Completion 2026-10-15

- **Tanggal / Waktu:** 2026-10-15T11:35:00+07:00
- **Status Operasional:** `PREMIUM_EDITORIAL_DEPTH_STAFF_WIRING_COMPLETE`
- **Branch Aktif:** `feat/jev-lokamedia-integration`
- **Tujuan Rekayasa & Redaksional:**
  - Melengkapi orkestrasi staf untuk milestone *Premium Editorial Depth System (PED-1)* dengan menutup kesenjangan kepemilikan operasional dimensi *Visual Storytelling* kepada **Budi / LokaMedia** (`media_operations`).
  - Menegakkan audit menyeluruh status wiring staf kanonikal (`DOCUMENTED_ONLY`, `PROMPT_WIRED`, `RUNTIME_WIRED`, `SEMANTIC_GUARD_WIRED`).
- **Implementasi & Invarian Utama:**
  1. **Budi — Pemilik Visual Storytelling (`BUDI_VISUAL_STORYTELLING_OWNER`):** Budi (`lokamedia_worker_primary`) mengeksekusi brief visual editorial ketika Dimas mendeteksi `visual_storytelling_need = REQUIRED` atau ketika diminta secara eksplisit oleh staf editorial / Chief Editor. Budi tidak memiliki otoritas faktual mandiri (masukan bersumber dari bukti Irwan, narasi Joko, semantik Dimas, dan batasan editorial Nadia/Rina).
  2. **Kontrak Brief Visual Terstruktur (`VisualBrief`):** Diterbitkan otomatis ketika kebutuhan visual berstatus `REQUIRED`, memuat: `article_slug`, `content_section`, `reader_problem`, `visual_goal`, `visual_class` (8 kelas kanonikal), `technical_truth_to_preserve`, `misrepresentation_risks`, `source_references`, `caption_intent`, dan `alt_text_intent`.
  3. **Integritas Kebenaran Visual Konseptual (`CONCEPTUAL_VISUAL_TRUTH`):** Visual AI dilarang keras dilabeli sebagai `REAL_PHOTOGRAPH`, `REAL_PROJECT`, `FIELD_INSPECTION`, `MEASURED_SIMULATION`, atau `ENGINEERING_TEST_RESULT` tanpa bukti fisik riil. Visual AI explanatory wajib dilabeli sebagai `EDITORIAL_CONCEPT_VISUAL`.
  4. **Kebijakan Anti-Kuota Dekorasi (`ZERO_DECORATION_QUOTAS`):** Dilarang memaksakan kuota gambar arbitrer ("setiap artikel butuh N gambar"). Jika berstatus `OPTIONAL` atau `NOT_REQUIRED`, sistem tidak memaksakan produksi media.
  5. **Alur Peninjauan Editorial Visual (`VISUAL_EDITORIAL_REVIEW_LOOP`):** Alur produksi visual kanonikal: `Dimas (kebutuhan visual) -> Budi (brief/persiapan visual) -> Nadia (keterbacaan pembaca) -> Rina (kebenaran faktual/representasi) -> Human Approval -> Sari (publikasi)`. Budi memiliki otoritas publikasi = 0 (`BUDI_PUBLISHING_AUTHORITY = 0`), dilarang mempublikasi langsung, dan dilarang melangkahi atau memveto Nadia/Rina.
  6. **Rantai Redaksional Utama Terpelihara:** Rantai utama tetap abadi: `Irwan -> Joko -> Nadia -> Rina -> Human Approval -> Sari`. Budi bertindak sebagai cabang pendukung media (media support branch), bukan bypass editorial.
  7. **Audit Wiring Staf Kanonikal:**
     - **Irwan:** `RUNTIME_WIRED` + `DOCUMENTED_ONLY` (Riset bukti, penelusuran standar, author-safe claims; turunan dari kontrak kanonikal bersama, zero fabrikasi wawasan lapangan).
     - **Joko:** `PROMPT_WIRED` + `RUNTIME_WIRED` (Instruksi sistem kepenulisan PED-1 di `joko-prompt-builder.ts` + eksekusi `editorial-runtime.ts`).
     - **Nadia:** `RUNTIME_WIRED` + `SEMANTIC_GUARD_WIRED` (Evaluasi suara pembaca, kebermanfaatan keputusan, revisi jika kaya teknis minim panduan di `nadia-reader-voice.ts`).
     - **Rina:** `RUNTIME_WIRED` + `SEMANTIC_GUARD_WIRED` (Penegakan kepatuhan kebenaran, blokir klaim tangan pertama palsu di `human-quality.ts`).
     - **Budi:** `RUNTIME_WIRED` + `SEMANTIC_GUARD_WIRED` (Eksekusi brief visual editorial terstruktur, penegakan truth rules, registry `VISUAL_STORYTELLING` di `visual-brief.ts`).
     - **Dimas:** `SEMANTIC_GUARD_WIRED` + `RUNTIME_WIRED` (Checklist semantik PED di `premium-editorial-depth-guard.ts`).
     - **Jefry:** `DOCUMENTED_ONLY` + `SEMANTIC_GUARD_WIRED` (Pengawasan bayangan strategis pasif via `typesafe-jev.ts`, non-blocking, zero authority).
- **Pengujian & Validasi:**
  - 20 pengujian di `scripts/test-premium-editorial-depth.js` lulus 100%.
  - Seluruh pengujian registri staf (`scripts/test-staff-registry.js`), Nadia (`scripts/test-nadia-reader-voice.js`), mutu manusia (`scripts/test-editorial-human-quality.js`), dan batas persetujuan LokaMedia (`scripts/test-lokamedia-human-approval-boundary.js`) lulus 100%.
  - Typecheck (`npx tsc --noEmit`) dan Astro build (`npm run build`) sukses tanpa error.

### RANCANGLOKA-PREMIUM-EDITORIAL-DEPTH-1: Decision Depth 7Q+Next, Failure Anatomy, Micro-Personas, Method Transparency, Visual Storytelling & No-First-Hand Authority 2026-10-15

- **Tanggal / Waktu:** 2026-10-15T11:15:00+07:00
- **Status Operasional:** `RANCANGLOKA_PREMIUM_EDITORIAL_DEPTH_ESTABLISHED`
- **Branch Aktif:** `feat/jev-lokamedia-integration`
- **Tujuan Rekayasa & Redaksional:**
  - Chief Editor menetapkan lapisan operasional kedalaman redaksi permanen: *Premium Editorial Depth System (PED-1)* untuk mendampingi *Warm Advisory Tone*, *Local Cultural Grounding*, dan *Evidence-First Invariants*.
  - Menetapkan prinsip kanonikal: *"Artikel RancangLoka tidak dianggap mendalam hanya karena panjang. Artikel dianggap mendalam ketika pembaca memahami apa masalahnya (WHAT), mengapa terjadi (WHY), untuk siapa relevan (WHO), kapan dan di mana berlaku (WHEN & WHERE), bagaimana menanganinya (HOW), pilihan mana yang paling masuk akal (WHICH), dan apa yang harus dilakukan berikutnya (WHAT NEXT)."*
- **Komponen Inti Framework Kedalaman:**
  1. **Decision Depth (7Q + Next):** Evaluasi kedalaman semantik menyeluruh tanpa mewajibkan tujuh subjudul harfiah yang kaku. Dimensi non-aplikatif pada indeks referensi diklasifikasikan sebagai `NOT_RELEVANT`.
  2. **Failure Anatomy (`FAILURE_ANATOMY`):** Menganalisis bagaimana pilihan, aplikasi, urutan, asumsi, dan perawatan dapat gagal secara fisik di lapangan, berakar pada konsensus ilmiah dan bebas dari cerita horor sensasional.
  3. **Micro-Persona Scenarios (`MICRO_PERSONA_SCENARIOS`):** Komposisi skenario hunian ilustratif (tipe penghuni + kondisi bangunan + lingkungan + kendala + tujuan) agar pembaca mengenali situasi rumahnya. Disiplin ketat melarang rekayasa testimoni pelanggan, studi kasus klien, atau wawancara palsu.
  4. **Evidence & Method Transparency (`EVIDENCE_METHOD_TRANSPARENCY`):** Transparansi ramah pembaca ("Dasar Artikel") mengomunikasikan rujukan SNI (mis. SNI 6389:2020), regulasi PUPR, data iklim BMKG, dan studi arsitektur tropis.
  5. **Visual Storytelling (`VISUAL_STORYTELLING`):** Visual bertugas menjelaskan relasi spasial dan menurunkan beban kognitif (bukan sekadar dekorasi). Dilarang memberlakukan kuota gambar arbitrer (zero quota enforcement).
  6. **Strict No-First-Hand Claim Policy (`NO_UNVERIFIED_FIRST_HAND_AUTHORITY`):** Dilarang mengklaim inspeksi/pengalaman lapangan langsung ("berdasarkan pengalaman kami di lapangan", "dari proyek yang kami tangani", "tim kami menemukan di lokasi"). Otoritas redaksi RancangLoka murni berakar pada riset bukti empiris dan metodologi terbuka.
  7. **Tested by RancangLoka Policy (`TESTED_BY_RANCANGLOKA_RESERVED`):** Label diklasifikasikan sebagai `RESERVED / PRIMARY-EVIDENCE-ONLY`, terlarang untuk artikel kompilasi analitis AI/data biasa tanpa pengujian fisik primer.
- **Implementasi Kode & Guard Semantik:**
  - `src/lib/editorial/premium-editorial-depth-guard.ts`: Guard semantik Dimas dengan bukti terstruktur (`decision_depth`, `failure_anatomy`, `micro_persona_scenario`, `method_transparency`, `visual_storytelling_need`, `first_hand_claim_safety`).
  - `src/lib/editorial/joko-prompt-builder.ts`: Integrasi instruksi sistem kepenulisan Joko untuk kedalaman 7Q+Next alami, failure anatomy, skenario ilustratif, transparansi metodologi, dan zero klaim tangan pertama palsu.
  - `src/lib/editorial/nadia-reader-voice.ts`: Gerbang kebermanfaatan pembaca Nadia mengintegrasikan checklist kedalaman dan memicu `READER_VOICE_REVISION_REQUIRED` jika artikel kaya teknis tetapi minim panduan keputusan.
  - `src/lib/article/human-quality.ts`: Penegakan QA Rina untuk isu `FAKE_FIRST_HAND_AUTHORITY` (kritis), `ILLUSTRATIVE_SCENARIO_PRESENTED_AS_REAL` (kritis), `UNSUPPORTED_FAILURE_SCENARIO` (warning), `METHOD_TRANSPARENCY_MISMATCH` (warning), dan `DECISION_DEPTH_GAP`.
- **Evaluasi Rujukan Artikel C:**
  - Artikel C yang telah LIVE dianalisis dan dibuktikan secara penuh memenuhi seluruh dimensi kedalaman tanpa modifikasi naskah (SHA-256: `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28` strictly preserved).
- **Pengujian:** 13 pengujian terfokus di `scripts/test-premium-editorial-depth.js` lulus 100% bersama 35 tes Nadia, 13 tes Warm Advisory Tone, dan 12 tes Local Cultural Grounding (Total 73/73 tes redaksional lulus).

### RANCANGLOKA-ARTICLE-C-PRODUCTION-PUBLICATION: Explicit Chief Editor Authorization, Canonical Sari Publication Dispatch, Zero-Deploy Production Proof & Live Verification 2026-10-15

- **Tanggal / Waktu:** 2026-10-15T10:35:00+07:00
- **Status Operasional:** `ARTICLE_C_IS_LIVE`
- **Branch Aktif:** `feat/jev-lokamedia-integration`
- **Otorisasi Publikasi Eksplisit:**
  - Perintah Chief Editor: `AUTHORIZE ARTICLE C FINAL PUBLICATION`
  - Wewenang publikasi diberikan secara terikat dan tunggal untuk naskah Artikel C dan media unggulan yang disetujui.
  - Zero bypass: Pipeline redaksional `Irwan -> Joko -> Nadia -> Rina -> Human Approval -> Sari` ditegakkan penuh.
- **Identitas & Kriptografi Artikel C:**
  - Judul: *Memilih Sistem Shading Luar untuk Rumah Tropis: Overhang, Louver, Awning, atau Secondary Facade?*
  - Slug: `memilih-sistem-shading-luar-rumah-tropis`
  - URL Kanonikal Publik: `https://rancangloka.com/memilih-sistem-shading-luar-rumah-tropis`
  - Status Publikasi: **`PUBLISHED`**
  - Database Article ID: `9`
  - Content Hash Kanonikal: `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28`
  - Featured Asset ID: `ast_4ee0363758a41bd45aae7353` (SHA: `4ee0363758a41bd45aae735349028ab19ca6256964c20ec1d98af4e65c578bf4`, status: `VALIDATED`)
  - Teks Alt Disetujui: *"Detail sistem peneduh luar berupa overhang dan louver pada fasad rumah tropis modern yang melindungi bukaan kaca dari radiasi matahari langsung."*
  - Kategori: ID `3` (*Arsitektur & Renovasi*, `arsitektur-renovasi`)
  - Penulis: ID `3` (*RancangLoka Editorial Desk*, `dewan-redaksi-spasial`)
- **Tanda Terima & Audit Alur Publikasi Kanonikal:**
  - Persetujuan Manusia: Lengkap (`REVISED_CONTENT_APPROVED` di `article_editorial_approvals` ID 12)
  - Kesiapan Publikasi: `READY_TO_SCHEDULE` (0 blocker di `article_publication_readiness` ID 34)
  - Publication Plan ID: `plan_artC_f0a74ec8a117` (ID 8)
  - Publication Execution ID: `pexec_artC_ecf45a651b90` (ID 5, status: `PUBLISHED`)
  - Publication Receipt ID: `rcpt_artC_8341d2fda3bc` (ID 5, outcome: `SUCCESS`)
  - Waktu Terbit Aktual: `2026-10-15 03:32:49` (Waktu server basis data D1 UTC)
- **Verifikasi Produksi Live Edge (Smoke Test):**
  - Status HTTP: **200 OK**
  - Elemen Fasad & Render: Judul artikel, kategori, penulis, gambar sampul R2, teks alt, matriks komparasi responsif (`data-comparison-matrix`), dan penutup serah-terima hangat terverifikasi utuh tanpa kebocoran sintaksis Markdown.
  - Petunjuk Pengindeksan: `<meta name="robots" content="index, follow, max-image-preview:large">`
  - Kebutuhan Deployment: `DEPLOYMENT_NOT_REQUIRED` (Arsitektur publikasi berbasis data/konten; Cloudflare Worker SSR runtime langsung menyajikan naskah dari D1).
- **Pembersihan DEV Preview Adapter:**
  - Blok adapter sementara di `src/pages/[slug].astro` telah dihapus secara aman (komit `d525adf`).
- **Invarian Keselamatan:** `AUTO_PUBLISH = OFF`, `SOCIAL_AUTOMATION = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`. Sari kembali `IDLE`.

### OFFLINE-MASTER-CHECKPOINT-2026-10-14: End-of-Day Production Safety, House Voice Integrity & Ready-for-Offline State

- **Tanggal / Waktu:** 2026-10-14T17:15:00+07:00
- **Status Operasional:** `READY_FOR_OFFLINE`
- **Branch Aktif:** `feat/jev-lokamedia-integration` (HEAD: `1d489ab`)
- **Pencapaian Kunci Sesi 14 Oktober 2026:**
  1. *Approval Inbox V1 Production Audit:* Terverifikasi live di Cloudflare Workers (`bc828313-97ca-4b6e-a0b7-630447b4e279`) dengan kontrak UX 5 kolom desktop utuh tanpa layout shift.
  2. *Article C Featured Media Approval:* Terikat secara kriptografis ke asset `ast_4ee0363758a41bd45aae7353`, alt text kanonikal disetujui, dan berkas biner diverifikasi di R2.
  3. *Milestone `RANCANGLOKA_WARM_ADVISORY_TONE_1`:* Menetapkan gaya konsultan ramah, tenang, dan bersahaja; guard semantik Dimas; Nadia Rubric J; serta serah-terima keputusan hangat `COMPARISON_WARM_DECISION_HANDOFF`.
  4. *Milestone `RANCANGLOKA_LOCAL_CULTURAL_GROUNDING_1`:* Menetapkan identitas redaksional bahwa RancangLoka menjelaskan arsitektur dari realitas hidup orang Indonesia; guard anti-stereotip; Bahasa Indonesia standar sebagai basis; Nadia Rubric K (7 pertanyaan kanonikal); verifikasi kebenaran Rina; guard semantik Dimas; dan shadow watch Jefry.
  5. *Article C Publication State:* Hash naskah terkunci `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28`, evaluasi redaksi Nadia `READER_VOICE_PASS` (98/100) & Rina `HUMAN_WRITING_PASS` (89/100), Local Cultural Grounding `PASS`, konten revisi telah disetujui Chief Editor (`REVISED_CONTENT_APPROVED`), status strictly **`UNPUBLISHED`** menunggu otorisasi publikasi final (`CHIEF_EDITOR_FINAL_PUBLICATION_AUTHORIZATION_REQUIRED`).
- **Integritas Pengujian:** Seluruh tes lulus 100% (`test-local-cultural-grounding.js` 12/12, `test-warm-advisory-tone.js` 13/13, `test-nadia-reader-voice.js` 35/35), TypeScript compilation bersih (0 error), dan Astro build berhasil.
- **Invarian Keselamatan:** `AUTO_PUBLISH = OFF`, `JEV_MODE = shadow`, D1/R2 mutasi produksi = 0, push remote = 0. Berkas acuan offline: `state/OFFLINE_CHECKPOINT_20261014.md`.

### RANCANGLOKA-LOCAL-CULTURAL-GROUNDING-1: Canonical Local Cultural Grounding, Editorial Identity Layer & Multi-Staff Gate Verification 2026-10-14

- **Tujuan & Ruang Lingkup:**
  - Menetapkan prinsip identitas editorial permanen baru: **LOCAL CULTURAL GROUNDING**.
  - Melengkapi **WARM ADVISORY TONE** (Warm Advisory Tone = *bagaimana* RancangLoka berbicara; Local Cultural Grounding = *dari realitas mana* RancangLoka berbicara).
  - Prinsip Kanonikal:
    *"RancangLoka tidak hanya menerjemahkan pengetahuan arsitektur ke Bahasa Indonesia. RancangLoka menjelaskan arsitektur dari realitas hidup orang Indonesia."*
  - Naskah terasa ditulis oleh seseorang yang memahami secara mendalam bagaimana rumah Indonesia dibangun, direnovasi bertahap, dihuni, dirawat, dan diperbincangkan sehari-hari.
  - Membuka kemungkinan kontekstual (bukan checklist wajib): iklim tropis lembap, tempias hujan angin, panas sore matahari barat, rumah tumbuh, renovasi bertahap, rumah klaster, lahan sempit, gang/akses terbatas, dinding bersama, batas kavling, privasi tetangga, tukang lokal, aplikator, debu jalan, kusen, kanopi, dak beton, roster, tritisan, kebiasaan buka-tutup jendela, penggunaan AC, kebutuhan ruang keluarga, dan biaya renovasi bertahap.
- **Penjagaan Ketat Anti-Stereotip (Strict Anti-Stereotype Guard):**
  - DILARANG membuat pernyataan generalisasi sosiologis tanpa bukti (*"Orang Indonesia selalu..."*, *"Rumah Indonesia biasanya..."*, *"Masyarakat kita pasti..."*).
  - Dilarang mengarang perilaku budaya fiktif atau mengubah asumsi anekdotal menjadi fakta nasional.
  - Pijakan lokal tidak pernah melemahkan standar pembuktian (*evidence-first*).
- **Bahasa Indonesia Standar Sebagai Basis Kanonikal:**
  - Bahasa dasar adalah Bahasa Indonesia standar yang alami, jernih, profesional, dan percakapan wajar.
  - Dilarang menggantungkan suara redaksi pada dialek Betawi, Jawa, Sunda, bahasa gaul daerah, atau slang internet.
  - Nuansa lokal bersumber dari situasi fisik, konteks keputusan, realitas hunian, kosakata konstruksi, dan ungkapan wajar — bukan dialek yang dipaksakan.
- **Aturan Idiom Alami (Natural Idioms Policy):**
  - Ungkapan idiomatik dianjurkan bila meningkatkan kealamian prosa (*"jangan sampai salah langkah"*, *"ujung-ujungnya..."*, *"kalau kondisinya seperti ini..."*, *"lebih baik bereskan sumber masalahnya dulu"*).
  - Kehadiran idiom TIDAK wajib, dilarang menjadi *boilerplate* monoton, dan dilarang disisipkan semata-mata demi membuktikan naskah berbahasa Indonesia.
- **Matriks Tanggung Jawab Staf Redaksi:**
  - **Irwan (Evidence Researcher Lead):**
    - Mengidentifikasi standar nasional (SNI, Permen PUPR), data iklim tropis lembap, kondisi konstruksi lokal, terminologi material pasar Indonesia, dan kendala perawatan.
    - Membedakan secara ketat: `VERIFIED LOCAL FACT` vs `EDITORIAL LOCAL CONTEXT` vs `UNSUPPORTED CULTURAL GENERALIZATION`.
  - **Joko (Content Writer Primary):**
    - Mengajukan pertanyaan panduan: *"Apa yang membuat masalah ini langsung dikenali oleh pemilik rumah di Indonesia?"*
    - Mengontekstualisasikan naskah ke situasi nyata (mis. membersihkan kisi-kisi/kaca setelah musim hujan; renovasi rumah yang sudah dihuni vs bongkar dak).
    - Dilarang keras mengarang anekdot fiktif, mengumbar kata "kita", menyisipkan slang/bahasa gaul, meniru caption medsos, atau membuat testimoni palsu.
  - **Nadia (Audience & Language Editor):**
    - Menambahkan Dimensi K: *Local Cultural Grounding* dengan 7 pertanyaan kunci.
    - Menilai status: `LOCAL_CULTURAL_GROUNDING_PASS` / `LOCAL_CULTURAL_GROUNDING_REVISION_REQUIRED`.
    - Jika secara teknis benar namun berbau terjemahan kaku / asing secara kultural: ➔ `READER_VOICE_REVISION_REQUIRED`.
  - **Rina (Editorial QA Primary):**
    - Memverifikasi kebenaran dan batas generalisasi naskah.
    - Menegakkan isu: `UNSUPPORTED_LOCAL_GENERALIZATION`, `CULTURAL_STEREOTYPE_OVERREACH`, `LOCAL_CONTEXT_CLAIM_WITHOUT_SUPPORT`, `TRANSLATIONESE_RESIDUAL`.
    - Memastikan frasa lokal/ramah tidak melunakkan peringatan keselamatan atau mengubah kepastian klaim ilmiah.
  - **Dimas (System Guard):**
    - Membangun guard semantik `src/lib/editorial/local-cultural-guard.ts` untuk mendukung checklist alur kerja: `local_cultural_grounding`, `indonesian_context_fit`, `translationese_risk`, dan `cultural_generalization_safety`.
    - Tanpa penilaian kasar kata kunci (*zero crude keyword/slang scoring*).
  - **Jefry (Management Decision Advisor):**
    - Tetap berstatus SHADOW ONLY (0 wewenang publikasi/eksekusi). Memantau pergeseran strategis (terjemahan asing, contoh generik luar negeri, slang artifisial, stereotip berulang).
- **Penerapan Famili Konten:**
  - `COMPARISON`: Realitas keputusan hunian Indonesia, kompromi biaya/perawatan bertahap.
  - `PROBLEM_SOLVER`: Gejala fisik yang dapat diamati pemilik rumah, alur diagnosis, realitas tukang lokal.
  - `MATERIAL_GUIDE`: Ketahanan cuaca tropis (panas sore, hujan lebat), kemudahan perawatan, toko bangunan.
  - `TECHNICAL_EXPLAINER`: Menerjemahkan rumus fisika bangunan ke fenomena yang dirasakan di rumah.
  - `PRODUCT_DECISION`: Konteks pemasangan, ketersediaan servis/suku cadang di Indonesia.
  - `NEWS / REGULATION`: Pijakan lokal proporsional dan terukur, pelaporan fakta tetap dominan.
- **Evaluasi Artikel C:**
  - Naskah `scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md` berpijak kuat pada realitas Indonesia: orientasi khatulistiwa, matahari sore di fasad barat, tempias hujan angin tropis, debu jalan, standar SNI 6389:2020 & Permen PUPR 21/2021, serta kemudahan perawatan tukang/pemilik rumah.
  - Bebas dari stereotip sosiologis tanpa bukti, bebas dari terjemahan kaku calque, menggunakan Bahasa Indonesia standar yang hangat dan lugas.
  - Hash kanonikal tidak berubah: `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28`.
  - Status Publikasi Artikel C: **`UNPUBLISHED`**.

### RANCANGLOKA-WARM-ADVISORY-TONE-1: Canonical Warm Advisory Tone, Staff Editorial Gate Integration & Article C Warm Decision Handoff 2026-10-14

- **Tujuan & Ruang Lingkup:**
  - Menetapkan prinsip gaya editorial permanen baru: **WARM ADVISORY TONE** (*Konsultan Arsitektur Ramah & Tenang*).
  - RancangLoka menulis layaknya seorang konsultan arsitektur dan bangunan berpengalaman yang memahami seluk-beluk teknis, namun berbicara kepada pemilik rumah dengan kehangatan (*warmth*), kejelasan (*clarity*), ketenangan (*calmness*), dan rasa hormat (*respect*).
  - Pembaca harus merasakan:
    - *"Saya sekarang paham masalahnya."*
    - *"Saya tahu trade-off mana yang penting."*
    - *"Saya bisa mengambil keputusan tanpa merasa digurui atau dihakimi."*
  - Kodifikasi Prinsip Suara Redaksi Permanen:
    - *"RancangLoka tidak menulis untuk membuat pembaca merasa penulisnya pintar. RancangLoka menulis supaya pembaca merasa dirinya sekarang mengerti."*
    - *"RancangLoka menjelaskan dengan kehangatan seorang konsultan yang membantu, bukan dengan jarak seorang penguji yang menghakimi."*
    - *"Setelah pembaca memahami fakta dan trade-off, RancangLoka membantu mereka percaya diri mengambil keputusan sendiri."*
- **Tanggung Jawab Staf Redaksi:**
  - **Joko (Content Writer):**
    - Wajib menulis langsung dalam Bahasa Indonesia alami sehari-hari yang bersahaja, lugas, dan akurat secara teknis.
    - Menjelaskan konsekuensi dalam istilah praktis pemilik rumah, menggunakan transisi hangat, menghindari kesimpulan kaku ala laporan birokrasi, dan menolak penutup generik ala AI chatbot.
    - Mengadaptasi aturan penutup komparasi secara kontekstual: `COMPARISON_WARM_DECISION_HANDOFF`.
  - **Nadia (Audience & Language Editor):**
    - Memperluas evaluasi ke Dimensi J: *Warm Advisory Tone & Decision Handoff*.
    - Menilai 6 pertanyaan kanonikal: kehangatan ahli, pendekatan bersahabat pasca-bagian teknis, rekomendasi mantap tanpa otoriter, perasaan dibimbing bukan dihakimi, penutup yang menenangkan, serta kelayakan diucapkan langsung di meja konsultasi nyata.
    - Menegakkan status `READER_VOICE_REVISION_REQUIRED` jika draf akurat secara teknis namun bersuara dingin/kaku/robotik.
    - Menjaga invarian abadi: `LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH`.
  - **Rina (Editorial QA Lead):**
    - Memverifikasi kebenaran dan konsistensi naskah setelah gerbang Nadia `PASS`.
    - Memastikan kehangatan bahasa tidak mendistorsi bukti empiris, tidak melemahkan peringatan batas keamanan (`WARM_TONE_WARNING_WEAKENED`), tidak memaksakan rekomendasi mutlak universal (`UNIVERSAL_RECOMMENDATION_OVERREACH`), dan penutup selaras dengan analisis isi artikel.
  - **Dimas (System Guard):**
    - Mengintegrasikan guard semantik `src/lib/editorial/warm-advisory-guard.ts` untuk mendeteksi `warm_advisory_tone`, `human_reader_handoff`, dan `comparison_decision_handoff`.
    - Menghindari penilaian berbasis regex atau skoring kata kunci rapuh; menghadirkan bukti eksplisit `PASS` / `REVISION_REQUIRED`.
  - **Jefry (Management Decision Advisor):**
    - Tetap berada dalam batas SHADOW / penasihat murni (otoritas penerbitan 0, dilarang mengubah teks atau menerbitkan secara otonom).
- **Aturan Penutup Komparasi (COMPARISON_WARM_DECISION_HANDOFF):**
  - Setiap artikel komparasi wajib mengembalikan agensi keputusan akhir kepada pembaca setelah membedah masalah, trade-off, dan skenario kecocokan.
  - Kalimat acuan tonal kanonikal: *"Jadi, setelah semua pertimbangannya jelas, keputusan akhirnya tetap ada di tangan Anda—pilih solusi yang paling masuk akal untuk kondisi rumah Anda, bukan sekadar yang paling menarik dilihat."* (Diadaptasi secara luwes per topik, dilarang menjadi boilerplate kaku).
- **Penerapan & Penyelarasan Artikel C:**
  - Naskah `scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md` diperbarui dengan penutup hangat yang kontekstual:
    *"Setelah semua pertimbangannya jelas, keputusan akhirnya tetap kembali ke kondisi nyata rumah Anda. Tidak ada satu sistem yang sempurna untuk segala situasi—pilihlah solusi yang paling masuk akal sesuai arah datangnya sinar matahari, kesiapan struktur dinding, dan kemudahan perawatan yang sanggup Anda rawat dengan tenang dalam jangka panjang."*
  - Hash lama (`85270eb8534331da54efe4bb2dbe471a25ec532bf75d55270758d18c375f15c5`) telah di-invalidasi secara bersih.
  - Hash SHA-256 baru naskah: `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28`.
  - Nadia Reader Voice: `READER_VOICE_PASS` (Skor Dimensi Kehangatan: 100/100, Total: 98/100).
  - Rina Editorial QA: `HUMAN_WRITING_PASS` (Skor: 89/100, 0 overreach, 0 weakened warnings).
  - Status Publikasi Artikel C: **`UNPUBLISHED`** (menunggu tinjauan baca akhir Chief Editor).
- **Hasil Pengujian & Verifikasi:**
  - `node scripts/test-warm-advisory-tone.js`: **13/13 PASSED (100%)**
  - `node scripts/test-nadia-reader-voice.js`: **35/35 PASSED (100%)**
  - TypeScript typecheck (`npx tsc --noEmit`): **0 errors**
  - Production build (`npm run build`): **Sukses (Server built in 6.43s)**
  - Git diff check (`git diff --check`): **0 whitespace errors**
- **Status Akhir:**
  - Klasifikasi: **`RANCANGLOKA_WARM_ADVISORY_TONE_ESTABLISHED`**.
  - Status Keselamatan: `automation_mode = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`. Zero production mutations, zero deployment, zero push.

### RANCANGLOKA-APPROVAL-INBOX-V1-COMPLETE: Scalable Human Approval Inbox, Isolated DEV Fixtures, Responsive Admin Shell & Task-First Decision Experience 2026-10-14

- **Tujuan & Ruang Lingkup:**
  - Menyelesaikan dan membekukan secara resmi milestone **`APPROVAL_INBOX_V1_COMPLETE`** untuk sistem antarmuka persetujuan redaksi RancangLoka.
  - Kodifikasi Prinsip UX Kanonikal:
    - *"If the system needs a human decision, the system surfaces that decision to the human."*
    - *"The bell tells the administrator that work exists. The Approval Inbox organizes the work. The Approval Detail is where the decision happens."*
    - *"Inbox = find the work. Detail = understand the context and make the decision."*
    - *"Human approval queues may scale; human decisions remain deliberate and individual."*
  - Arsitektur Shell Admin Responsif & Off-Canvas Drawer (`src/layouts/AdminLayout.astro`):
    - Desktop (>= 1024px): Sidebar navigasi desktop permanen dipertahankan (`lg:w-60`).
    - Mobile (< 1024px): Off-canvas drawer (`-translate-x-full` ke `translate-x-0`), backdrop gelap semi-transparan, tombol hamburger, tombol tutup, serta penutup otomatis saat navigasi atau tombol Escape.
    - Header Mobile: Tata letak kompak `[ hamburger ] [ page identity ] [ approval bell ]`.
    - Dropdown Lonceng Notifikasi: Penempatan adaptif (`fixed sm:absolute inset-x-3 sm:inset-x-auto top-16 sm:top-auto sm:right-0 mt-2 sm:w-96 max-w-[calc(100vw-1.5rem)]`) mencegah terpotong (zero horizontal clipping) pada layar sempit 375px.
  - Penyederhanaan Operasional Antrean Persetujuan Desktop (`src/pages/admin/approvals/index.astro`):
    - Melepaskan 3 kolom audit berat dari tabel antrean utama desktop: `Tahap Alur Kerja`, `Gerbang Sebelumnya`, dan `Aktor Wajib` dipindahkan secara eksklusif ke halaman detail (`/admin/preview/[slug]`).
    - Tabel operasional desktop difokuskan tepat pada 5 kolom esensial: `Judul / Subjek`, `Tipe`, `Menunggu`, `Status`, `Tindakan`.
    - Tombol aksi utama `[Tinjau →]` langsung terlihat tanpa horizontal scrolling pada resolusi 1024px maupun 1440px.
  - Pengalaman Tugas Utama (*Task-First*) Mobile:
    - Antrean mobile berbasis kartu tugas kompak (`#approval-mobile-list`, `md:hidden`) yang bersumber dari proyeksi data kanonikal yang sama dengan desktop.
    - Kartu header dan statistik dipadatkan, catatan prinsip UX dikompresi menjadi disclosure `<details class="md:hidden">` ("Tentang alur persetujuan"), menghemat ~60px ruang vertikal.
    - Keputusan persetujuan pertama tampak 100% *above-the-fold* pada layar sempit (375x812px) pada ketinggian ~258px dari atas layar.
    - Tab filter status horisontal dilengkapi `.no-scrollbar` untuk menyembunyikan bilah gulir visual tanpa mengganggu swipe sentuh.
  - Isolasi Modular Fixture DEV (`src/lib/approvals/dev-fixtures.ts`):
    - Memindahkan 5 objek mock visual review ke modul fixture terisolasi (`dev-fixtures.ts`).
    - Proyeksi kanonikal basis data (`projectRawApprovalItems`) 100% murni merefleksikan catatan SQLite/D1 riil tanpa kebocoran data demo ke produksi.
    - Fixture hanya aktif secara eksplisit pada pengujian lokal DEV (`import.meta.env.DEV`), bersifat in-memory (zero D1 writes), dan secara otomatis mundur (*step aside*) saat ada catatan persetujuan riil.
  - Kepatuhan Invarian Gerbang Manusia (*Human Gate Invariant*):
    - Artikel hanya dapat memasuki antrean pending Chief Editor jika seluruh gerbang sebelumnya terbukti lulus: Irwan (Evidence) `PASS`, Joko (Authoring) `PASS`, Nadia (Reader Voice) `PASS`, dan Rina (Editorial QA) positif eksplisit `PASS`.
    - Nilai `undefined`, `NOT_RUN`, `PENDING`, atau ketiadaan kegagalan dilarang keras dianggap lulus.
    - Keputusan persetujuan manusia bersifat deliberate dan per-item (*NO BULK APPROVAL*).
  - Integritas Draf Artikel C:
    - Naskah lokal di `scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md` terlindungi secara kriptografis (SHA-256: `85270eb8534331da54efe4bb2dbe471a25ec532bf75d55270758d18c375f15c5`).
    - 13/13 klaim terverifikasi, status tetap **`UNPUBLISHED`** menunggu persetujuan akhir konten manusia (`ARTICLE_C_FINAL_CONTENT_APPROVAL_REQUIRED`).
- **Hasil Pengujian & Verifikasi:**
  - `node scripts/test-scalable-approval-inbox.js`: **14/14 PASSED (100%)**
  - `node scripts/test-admin-responsive-ux.js`: **21/21 PASSED (100%)**
  - TypeScript typecheck (`npx tsc --noEmit`): **0 errors**
  - Production build (`npm run build`): **Sukses (Server built in 7.14s)**
- **Komit Fungsional Git:**
  - `04d48fb` `feat(admin): add scalable human approval inbox` (9 berkas)
- **Status Akhir:**
  - Klasifikasi: **`APPROVAL_INBOX_V1_COMPLETE`**.
  - Status Artikel C: Tersimpan lokal di `scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md`, status **`UNPUBLISHED`** (`ARTICLE_C_FINAL_CONTENT_APPROVAL_REQUIRED`).
  - Status Keselamatan: `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `autonomous media worker = DISABLED`. Zero production D1 mutations, zero deployment, zero push.

---

### RANCANGLOKA-HOUSE-VOICE-READER-UX: House Voice Calibration, Conversational Indonesian, Responsive Comparison Matrix & Zero-Obstruction Reader Navigation 2026-10-13

- **Tujuan & Ruang Lingkup:**
  - Menetapkan standar suara rumah editorial (*House Voice*) RancangLoka yang alami, bersahaja, dan membumi ("bahasa orang rumah yang berpikir seperti konsultan teknis").
  - Menegakkan prinsip penulisan Joko: 1 ide per paragraf, kata umum didahulukan, anti-slop, zero jargon tanpa penjelasan, ritme percakapan mengalir, dan pembukaan artikel bervariasi sesuai konteks masalah pembaca.
  - Memperkuat gerbang bahasa pembaca Nadia (`audience_language_editor`) dengan kapabilitas `READER_VOICE_QA`: paragraph breathing, scannability, jargon budget, visual-density check, dan meaning preservation. Rina dilarang meloloskan artikel tanpa `READER_VOICE_PASS` dari Nadia.
  - Menerapkan arsitektur tampilan matriks komparasi baru (`src/lib/article/comparison-matrix.ts`):
    - Desktop: Kontainer editorial breakout (`full-bleed-breakout`, lebar ~1000–1150px) agar matriks 5-kolom leluasa dan nyaman dibaca tanpa menghimpit alur prosa normal.
    - Tablet: Kartu komparasi responsif 2-kolom dengan sticky criteria badge.
    - Mobile: Kartu keputusan responsif 1-kolom dengan penjabaran kriteria penuh tanpa pemotongan teks.
    - Zero client JavaScript (100% semantic HTML + CSS).
  - Menyelesaikan investigasi sistematis dan perbaikan navigasi mobile:
    - Root cause: `BaseLayout.astro` keliru memasang `{isArticlePage && (<MobileBottomNav />)}`, sehingga dok navigasi bawah melayang dan menutupi teks pada halaman artikel panjang.
    - Perbaikan arsitektural: Menegakkan prinsip pembaca long-form *"On long-form editorial pages, navigation must not compete with or obscure the content being read"*. Dok navigasi mobile disupresi penuh pada artikel (`!isArticlePage`), mengeliminasi 100% gangguan pembacaan.
  - Perbaikan independen Mission Control Office (`src/pages/admin/mission-control/office.astro`): Menghapus deklarasi ganda fungsi klien untuk mencegah tabrakan dev-server.
  - Mempertahankan integritas kriptografis Draf Artikel C: SHA-256 `85270eb8534331da54efe4bb2dbe471a25ec532bf75d55270758d18c375f15c5` dengan 13/13 pemetaan klaim terikat.
  - Membersihkan helper dev-preview sementara di `src/middleware.ts` dan `src/pages/admin/preview/[slug].astro` kembali ke status kanonikal `HEAD`.
- **Alur Editorial Kanonikal:**
  `Irwan (Riset) -> Joko (Penulisan) -> Nadia (Suara Pembaca) -> Rina (QA Faktual) -> Human Approval (Chief Editor) -> Sari (Publikasi)`
- **Hasil Pengujian & Verifikasi:**
  - `node scripts/test-nadia-reader-voice.js`: **35/35 PASSED**
  - `node scripts/test-editorial-human-quality.js`: **22/22 PASSED**
  - `node scripts/test-native-indonesian-authoring.js`: **13/13 PASSED**
  - `node scripts/test-article-render-integrity.js`: **6/6 PASSED**
  - `node scripts/test-comparison-visual-calibration.js`: **9/9 PASSED**
  - `node scripts/test-soak-safety.js`: **54/54 PASSED**
  - TypeScript typecheck (`npx tsc --noEmit`): **0 errors**
  - Production build (`npm run build`): **Sukses**
- **Komit Git Bersih:**
  - `9f1395e` `feat(editorial): establish RancangLoka house voice and reader UX` (13 berkas permanen)
  - `f26685d` `fix(mission-control): avoid duplicate client declarations` (1 berkas)
- **Status Akhir:**
  - Klasifikasi: **`RANCANGLOKA_HOUSE_VOICE_AND_READER_UX_COMPLETE`**.
  - Status Artikel C: Tersimpan lokal di `scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md`, status **`UNPUBLISHED`** menunggu persetujuan akhir konten manusia (`ARTICLE_C_FINAL_CONTENT_APPROVAL_REQUIRED`).
  - Status Keselamatan: `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `autonomous media worker = DISABLED`. Zero production D1 mutations, zero deployment, zero push.

---

### HERMES-SKILL-ADOPTION-M1: Adoption of Systematic Debugging for Dimas and Grounded Citations Provenance Pilot for Irwan 2026-10-13

- **Tujuan & Ruang Lingkup:**
  - Mengadopsi keterampilan teknik `systematic-debugging` sebagai Prosedur Operasi Standar Teknik Kanonikal (*Canonical Engineering SOP*) di bawah kepemilikan Dimas (`telemetry_observer_jev`).
  - Menegakkan *The Iron Law: NO FIX BEFORE ROOT CAUSE INVESTIGATION* dengan 4 fase sistematis (Fase 1: Reproduksi & Investigasi Akar Masalah, Fase 2: Analisis Pola, Fase 3: Hipotesis & Uji Minimal, Fase 4: Perbaikan Terarah & Verifikasi).
  - Mengimplementasikan modul `src/lib/mission-control/systematic-debugging.ts` dan dokumentasi kanonikal `docs/engineering/SYSTEMATIC_DEBUGGING_SOP.md`.
  - Menjalankan uji coba percontohan (*PILOT ONLY*) `grounded-citations` untuk Irwan (`evidence_researcher_lead`) sebagai lapisan verifikasi asal-usul sumber (*source-provenance verification layer*), tanpa mengubah naskah markdown publik atau menambahkan blok `## Sources`.
  - Menerapkan arsitektur pembatasan klaim 3-tahap: `Kutipan Sumber Literal -> Klaim Aman-Penulis (Parafrasa Teknis) -> Parafrasa Publik Artikel (Bahasa Orang Rumah)`.
  - Menegakkan invarian durabel: `SOURCE_EXCERPT_IS_LITERAL`, `AUTHOR_SAFE_CLAIM_MAY_BE_PARAPHRASED`, `PUBLIC_ARTICLE_MAY_BE_NATURAL_LANGUAGE_PARAPHRASE`, dan `CLAIM_STRENGTH_MUST_NOT_EXCEED_SOURCE_EVIDENCE`.
  - Mengimplementasikan penyimpanan terikat-tugas (*task-scoped companion ledger*) di `scripts/content-bootstrap/artC-research-reset/source-verification-ledger.json` untuk Artikel C tanpa memutasi naskah atau mengubah hash SHA-256.
  - Memastikan sumber fisik/tanpa teks digital lokal ditandai jujur sebagai `SOURCE_TEXT_NOT_AVAILABLE_FOR_LITERAL_VERIFICATION` tanpa fabrikasi.
- **Hasil & Status Pengujian:**
  - Test suite lengkap `scripts/test-skill-adoption-m1.js`: **17/17 PASSED (100% OK)**.
  - Seluruh rangkaian regresi Mission Control, Pixel Office, dan Nadia (9 test suite): 100% PASSED.
  - TypeScript typecheck (`npx tsc --noEmit`): 0 errors.
  - Production build (`npm run build`): Sukses tanpa error (6.37s).
  - Klasifikasi: **`HERMES_SKILL_ADOPTION_M1_COMPLETE`**.
  - Status Keselamatan: `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `autonomous media worker = DISABLED`. Artikel C tersimpan lokal (`UNPUBLISHED`).

---

### HERMES-NADIA-READER-VOICE-FINALIZATION: Expansion to 20 Tests, Claim Strength Invariant, and Full Quality Pipeline Hardening 2026-10-13


- **Tujuan & Ruang Lingkup:**
  - Menyempurnakan dan mengunci seluruh komponen peran redaksional Nadia (`audience_language_editor`) dan kapabilitas `READER_VOICE_QA`.
  - Mengimplementasikan invarian durabel: `INVARIANT_LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH = 'LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH'`.
  - Menegakkan pemisahan semantik state yang ketat: `READER_VOICE_BLOCKED` (untuk ambiguitas teknis/penguatan klaim sepihak tanpa bukti) vs `READER_VOICE_REVISION_REQUIRED` (untuk isu bahasa, pembukaan klise, atau keterbacaan).
  - Mengimplementasikan deteksi kalimat pembuka berbasis keluarga konten (*content family aware*): `problem_solver`, `system_decision`, `comparison`, `material_index`, `reference`, `explainer`, `review` tanpa memaksakan bentuk kalimat tanya.
  - Mengunci rute handoff deterministik saat BLOCKED: Nadia BLOCKED -> Irwan (`evidence_researcher_lead`) untuk `evidence_clarification` -> Joko (`native_indonesian_writer`) untuk revisi -> kembali ke Nadia untuk re-review. Transisi langsung Nadia -> Rina saat BLOCKED diblokir keras.
  - Mengkalibrasi naskah Artikel C (`scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md`) dan penggunaan klaim (`article-c-claim-usage.json`): mitigasi penguatan klaim tidak berdasar pada baris 33 dan 108, menghasilkan SHA-256 terverifikasi `39c3c1f223af9e277c55dca85519f9f618a15deda3c821e924c82adad8d56e23`.
  - Memperluas test suite `scripts/test-nadia-reader-voice.js` dari 14 menjadi 20 tes komprehensif, mencakup 7 pengujian staf asli, integrasi Mission Control roster/chat, dan spasial Pixel Office.
- **Hasil & Status Pengujian:**
  - `node scripts/test-nadia-reader-voice.js`: **20/20 PASSED (100% OK)**.
  - Regresi Mission Control & Pixel Office: 100% PASSED (staff 16/16, departments 18/18, pixel-office 20/20, chat 20/20, job-animation 21/21, movement 33/33, handoff 26/26, expansion 12/12).
  - TypeScript typecheck (`npx tsc --noEmit`): 0 errors.
  - Astro build (`npm run build`): Sukses tanpa error.
  - Klasifikasi: **`HERMES_NADIA_FINALIZED`**.
  - Status Keselamatan: `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `autonomous media worker = DISABLED`. Artikel C tersimpan lokal (`UNPUBLISHED`).

---

### HERMES-MCP-SKILL-SECURITY-HARDENING-V1: Hardening Hermes Skill Management in rancangloka_mcp.py with Fail-Closed Dual-Control Approval Gate 2026-10-13


- **Tujuan & Ruang Lingkup:**
  - Mengaudit dan memperkuat keamanan eksekusi `hermes_skill_install` pada MCP Bridge (`rancangloka_mcp.py`) dalam mode `LOCAL PATCH + TEST ONLY / NO PRODUCTION DEPLOYMENT`.
  - Mencegah vektor serangan instalasi sepihak (*single-agent rogue mutation*), penolakan opsi CLI tambahan (*argument injection*), manipulasi path (*path traversal*), instalasi paket dari sumber eksternal tanpa izin (*unallowlisted sources*), serta penimpaan tidak sah (*forced overwrite*).
  - Mengimplementasikan validasi identifier skill deterministik berdasarkan format kanonikal aktual Hermes CLI: `^official/([a-z0-9]+(?:-[a-z0-9]+)*)/([a-z0-9]+(?:-[a-z0-9]+)*)$`.
  - Membangun gerbang persetujuan sisi server (*Server-Side Fail-Closed Approval Gate*) berbasis model kontrol ganda (*Dual-Control*):
    - Agen redaksi HANYA memiliki kapabilitas mengajukan permohonan melalui tool baru `request_skill_install(skill, reason)`. Tiket berstatus `PENDING_OPERATOR_APPROVAL`.
    - Agen **dilarang keras** menyetujui permintaannya sendiri (`operator_id` agent alias diblokir dengan `SELF_APPROVAL_PROHIBITED`).
    - Tiket persetujuan wajib diterbitkan oleh operator manusia (`create_operator_approval`) dan diverifikasi secara kriptografis menggunakan HMAC-SHA256 (`_compute_approval_signature`).
    - Penegakan masa kedaluwarsa waktu nyata (`expires_at` via monotonic float timestamp) dan kekebalan serangan pemutaran ulang (*Replay Attack Prevention / One-Time Use* di mana tiket dikonsumsi atomik sebelum subprocess dijalankan).
  - Menolak dan menonaktifkan parameter `force=True` untuk pemanggilan otomatis, kecuali operator manusia secara eksplisit memberikan izin `allow_force: True` dalam tiket.
  - Mengisolasi dan mensanitasi environment subprocess: mengeliminasi kebocoran API key (`OPENAI_API_KEY`) dan bridge bearer token ke script instalasi skill pihak ketiga.
  - Mengimplementasikan structured audit logging (`state/skill_install_audit.jsonl`) dengan sanitasi otomatis anti-bocor rahasia (`_sanitize_log_text`).
  - Mempertahankan integritas dan perilaku seluruh 13 tool legacy MCP bridge lama (`project_context`, `workspace_tree`, `file_read`, `search_project`, `file_write`, `replace_text`, `py_compile`, `run_guard`, `outbox_status`, `write_handoff`, `run_dev_task`, `fasttrack_writer_preflight`, `run_prod_task`) serta `hermes_skills_list`.
- **Hasil & Status Pengujian:**
  - Test suite lengkap `work/hermes-mcp-skill-security-hardening-v1/test_hermes_skill_security.py`: **20/20 PASSED (100% OK)**.
  - Meliputi tes negatif: invalid input, argument injection, path traversal, unallowlisted sources, unauthorized install, expired approval, replay attack, cryptographic tampering, force automated rejection, audit secret sanitization, dan regresi tool legacy.
  - Verifikasi sintaks: `py_compile` exit code 0 tanpa peringatan.
  - Seluruh artefak diisolasi secara aman di `work/hermes-mcp-skill-security-hardening-v1/`: berkas asli (`rancangloka_mcp.py.orig`, SHA-256 terverifikasi), berkas hardened (`rancangloka_mcp.py`), unified diff (`rancangloka_mcp_security_hardening.patch`), dan laporan audit (`AUDIT_AND_HARDENING_REPORT.md`).
  - Status Keselamatan: 0 restart layanan, 0 deploy produksi, 0 skill dipasang di server, 0 token diubah, 0 panggilan installer produksi.
  - Klasifikasi: **`READY FOR REVIEW`**.

---

### HERMES-MC-NADIA-INTEGRATION: Permanent Integration of Nadia as Audience & Language Editor in Hermes Mission Control & Pixel Office 2026-10-12

- **Tujuan & Ruang Lingkup:**
  - Mengintegrasikan Nadia (`audience_language_editor`) sebagai staf permanen tingkat satu (*first-class permanent staff member*) di Hermes Mission Control dan Pixel Office.
  - Membentuk gerbang kualitas redaksional permanen (*Human Voice Layer Gate*) guna melindungi kenyamanan dan kealamian bahasa bagi pembaca umum Indonesia (*"If the reader has to translate a sentence into everyday Indonesian inside their head, the sentence has failed"*).
  - Memperbarui pipeline redaksional kanonikal menjadi:
    `Irwan (Riset & Bukti) -> Joko (Penulisan Bahasa Indonesia Asli) -> NADIA (Penyunting Suara Pembaca & Bahasa) -> Rina (Kualitas Redaksional & QA Bukti) -> Human Approval (Chief Editor) -> Sari (Operasional Publikasi)`.
  - Menerapkan rubrik evaluasi 8-dimensi (Rubrik A–H): Problem-First Opening, Spoken Indonesian, Translationese Check, Jargon Budget, Raw Technical Syntax, Heading Test, Comprehension Test, dan Human Rhythm.
  - Menegakkan batas invariant dan fail-closed: transisi langsung Joko -> Rina tanpa melewati Nadia ditolak otomatis; skor AI detector berstatus **STRICTLY ADVISORY ONLY** (tidak menentukan kelulusan); otoritas penerbitan Nadia = 0.
  - Mengintegrasikan Nadia ke dalam tata letak spasial Pixel Office: workstation `editorial_language_desk` (`x: 50, y: 55`, di antara Joko dan Rina) dan kursi idle `lounge_seat_7` (`x: 50, y: 75`, tanpa tabrakan di Executive Lounge).
  - Mendaftarkan animasi pekerjaan (`READER_VOICE_READING`, `READER_VOICE_EDITING`) serta perintah chat operator (`READER_VOICE_REVIEW_REQUEST`, `LANGUAGE_SIMPLIFICATION_REQUEST`, `HEADING_ACCESSIBILITY_REVIEW`).
- **Hasil & Status Pengujian:**
  - Test suite Nadia `scripts/test-nadia-reader-voice.js`: 14/14 PASSED (termasuk verifikasi fixture Artikel C: BEFORE -> BLOCKED/REVISE, AFTER -> PASS).
  - Seluruh rangkaian regresi Mission Control & Pixel Office: 100% PASSED (16/16 staff, 18/18 departments, 20/20 spatial, 20/20 chat, 21/21 job animation, 33/33 movement, 26/26 handoff, 12/12 expansion).
  - Typecheck (`npx tsc --noEmit`): 0 errors.
  - Production build (`npm run build`): Astro build SUCCEEDED.
  - Klasifikasi: **`HERMES_NADIA_READER_VOICE_INTEGRATION_READY`**.
  - Status Keselamatan: `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, database produksi D1 unmutated, zero unapproved publishing.

---

### EDITORIAL-ARTICLE-C-HUMAN-VOICE-RESET: Article C Clean Authoring, Numeric & Claim Audit, and Indonesian Voice Refinement 2026-10-12

- **Tujuan & Ruang Lingkup:**
  - Melanjutkan produksi editorial Artikel C: *"Memilih Sistem Shading Luar untuk Rumah Tropis: Overhang, Louver, Awning, atau Secondary Facade?"*.
  - Menggunakan bukti riset kanonikal eksklusif dari `scripts/content-bootstrap/artC-research-reset/` (`evidence-pack.json`, `claim-ledger.json`, `source-quality-report.json`, `research-summary.md`), tanpa menggunakan draf lama yang gagal.
  - Joko menyusun draf bersih Bahasa Indonesia mengikuti struktur keputusan: Masalah -> Konteks -> Diagnosis -> Implikasi -> Opsi/Trade-off -> Kesesuaian Skenario -> Rekomendasi -> Tindakan Berikutnya.
  - Menjalankan audit numerik ketat (*Pre-Rina Numeric Sanitation*): seluruh angka/persentase/sudut diverifikasi memiliki dukungan langsung dari klaim `authoring_allowed=true`.
  - Melakukan tinjauan editorial Rina (*Rina Final Editorial QA*): verifikasi ketat struktur, logika, dan integritas klaim dengan skor 114/115 (normalisasi: ~99.1/100, `ARTICLE_C_HUMAN_WRITING_PASS`).
  - Rekonsiliasi metadata jurnal: menyelaraskan sitasi artikel RISA (*Double Skin Facade Optimization*) ke rentang halaman kanonikal 127–143 (DOI: 10.26593/risa.v8i02.7868.127-143), mengeliminasi inkonsistensi 119–130.
  - Pembersihan gaya bahasa dan eliminasi translationese: menyempurnakan naskah agar berbicara seperti konsultan bangunan berpengalaman di Jakarta yang berbicara lugas kepada pemilik rumah, menghapus sisa istilah kaku dan formula AI klise.
  - Menjaga integritas klaim dan data: zero claim drift, zero perubahan arti fisik atau angka.
- **Hasil & Status Keselamatan:**
  - Naskah tersimpan di `scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md`.
  - Naskah siap untuk verifikasi akhir suara pembaca oleh Nadia dan persetujuan manual manusia (*Human Approval*) oleh Chief Editor.
  - Status Publikasi: Belum terbit (*UNPUBLISHED*), tersimpan aman secara lokal, zero publikasi otomatis.

---

### ARTICLE-LIST-MARKER-PRODUCTION-FIX: Semantic List Marker Restoration in Article Typography CSS 2026-10-12

- **Tujuan & Ruang Lingkup:**
  - Menyelesaikan masalah visual pada Artikel A produksi di mana elemen daftar periksa (*checklist*) tidak menampilkan bullet/nomor penanda daftar.
  - Menginspeksi HTML nyata artikel: markup semantik `<ul>`, `<ol>`, dan `<li>` terbukti telah dihasilkan dengan benar oleh markdown parser, namun penanda visual hilang akibat reset Tailwind CSS Preflight.
  - Memperbaiki CSS tipografi artikel global (`src/styles/global.css`) tanpa mengubah konten naskah, database, atau tabel `articles`:
    - Memulihkan penanda daftar terurut (`ol > li` menggunakan `list-decimal`).
    - Memulihkan penanda daftar tidak terurut (`ul > li` menggunakan penanda bullet semantik yang elegan dan konsisten).
    - Memastikan padding dan indentation yang proporsional pada tampilan desktop dan mobile.
  - Membuat test suite deterministik `scripts/test-article-list-rendering.js` untuk memvalidasi aturan CSS penanda daftar.
  - Berkomitmen secara bersih ke git: Commit `651669e` (`fix(article): restore semantic list markers`).
- **Hasil & Status Keselamatan:**
  - `node scripts/test-article-list-rendering.js`: PASSED.
  - Astro build & TypeScript check: PASSED.
  - Verifikasi Invarian: Nol mutasi pada tabel `articles`, `content_md`, `content_html`, `content_hash`, `published_at`, `actual_published_at`, maupun relasi media.
  - Klasifikasi: **`ARTICLE_LIST_PRODUCTION_FIX_PROVEN`**.

---

### ARTICLE-B-PRODUCTION-PROMOTION-PROVEN: LokaMedia v0.1.18 Production Workflow Proven on Real Published Article B 2026-10-12

- **Tujuan & Ruang Lingkup:**
  - Membuktikan alur kerja penuh promosi media kontrol ganda (*Dual-Control Published Media Promotion*) LokaMedia v0.1.18 langsung pada artikel terbit nyata di lingkungan produksi (*Article B*).
  - Melakukan *production human handshake* antara operator ekstensi LokaMedia (`lokamedia-prod-operator-02`, status `ACTIVE`) dan edge produksi RancangLoka via `https://rancangloka.com`.
  - Menerapkan kontrol ganda (*Dual-Control*): permintaan promosi diajukan oleh ekstensi (`REQUESTED`), diperiksa dan disetujui secara kriptografis oleh administrator manusia di `/admin/media-promotions` (`APPROVED`), dan dikonsumsi saat eksekusi upload (`CONSUMED`).
  - Mengunggah media kanonikal ke Cloudflare R2 secara aman dan sukses (`media/images/8ecd77ff40bb4d933e27e44980bcec9ebb040e0cb971de72e5387ff6b463247d.webp`, 149.764 bytes, WebP).
  - Mendaftarkan media asset kanonikal di Cloudflare D1 (`ast_8e3c7059293ada90787ac4ab`, status `VALIDATED`).
  - Mengganti cover unggulan secara kanonikal di `article_media`: relasi lama dideaktivasi (`is_active = 0`), relasi baru diaktifkan (`is_active = 1`), menjamin invarian tepat-satu (*exactly-one featured invariant*).
  - Merambatkan teks alt secara presisi ke kolom `articles.image_alt` (`"Detail sambungan kusen aluminium, kaca, dan dinding pada jendela rumah"`) tanpa sisa teks placeholder lama.
  - Membuktikan invarian eksekusi tepat satu kali (*exactly-once execution*) dengan tanda terima D1 tunggal dan nol duplikasi objek R2.
  - Menjamin ketetapan publikasi (*publication immutability*): naskah (`content_md`, `content_html`), sidik jari (`content_hash`), status (`PUBLISHED`), jadwal (`published_at`), dan tanda terima rilis (`actual_published_at`) 100% tidak bermutasi (zero republishing).
  - Memverifikasi pelestarian penuh baseline Artikel A (ID 7) dan integritas rendering publik Artikel B di edge produksi (HTTP 200).
- **Hasil & Status Keselamatan:**
  - Status Ekstensi & Operator: `lokamedia-prod-operator-02` ACTIVE, handshake PASS.
  - Permintaan Promosi: `prom_req_mv4rw7jk_83635f64e45283fb` CONSUMED tepat satu kali.
  - Verifikasi R2 & D1: Aset `ast_8e3c7059293ada90787ac4ab` aktif, cover Artikel B terbarui, teks alt terikat secara kriptografis.
  - Verifikasi Edge: HTTP 200 pada gambar R2 dan halaman artikel publik SSR.
  - Pelestarian Artikel A: 100% UTUH tanpa mutasi.
  - Klasifikasi: **`ARTICLE_B_PRODUCTION_PROMOTION_PROVEN`**.
  - Status Keselamatan: `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `autonomous media worker = DISABLED`, `kill_switch_engaged = 0`.

---

### LOKAMEDIA-V0.1.18-PRODUCTION-ENABLEMENT-1: Production Migrations 0031/0032 & Worker Deployment eb46fc2a 2026-10-12

- **Tujuan & Ruang Lingkup:**
  - Melakukan aktivasi produksi (*Production Enablement*) untuk infrastruktur promosi media kontrol ganda (*Dual-Control Published Media Promotion*) pada versi kanonikal **v0.1.18**.
  - Menerapkan migrasi database kanonikal ke Cloudflare D1 produksi (`rancangloka_db`, ID `3a86e9ad-410f-4440-884e-2eb813ec4cf7`):
    - `0031_media_promotion_approvals.sql`: Pembuatan tabel persetujuan kontrol ganda `media_promotion_approvals` (status: `REQUESTED`, `APPROVED`, `REJECTED`, `CONSUMED`, `EXPIRED`).
    - `0032_media_promotion_alt_text.sql`: Penambahan kolom `alt_text` untuk pengikatan deskripsi aksesibilitas secara kriptografis dan skema D1.
    - Verifikasi skema D1 remote: tabel terbentuk lengkap dengan 22 kolom, kolom `alt_text` aktif, dan baris awal berjumlah 0 (zero stale entries).
  - Melakukan deployment kode terkomit bersih (`0ab4589`: `feat(lokamedia): add dual-control published media promotion`) ke Cloudflare Workers produksi (`rancangloka`):
    - Version ID kanonikal: `eb46fc2a-c5bc-4705-ab85-285f0802dc66`.
    - Waktu inisialisasi edge: 13ms startup, 4 cron triggers aktif.
  - Melakukan pengujian *live read-only smoke* dan pembuktian batas keamanan di edge produksi:
    - Rute Admin `/admin/media-promotions`: Merespons HTTP 302 redirect ke `/admin/login` (gerbang sesi terverifikasi, nol galat Worker 1101).
    - Endpoint API unauthenticated `/api/internal/v1/media/articles/resolve`: Merespons HTTP 401 `AUTHENTICATION_REQUIRED`.
    - Endpoint API unauthenticated `/api/internal/v1/media/promotions/request`: Merespons HTTP 401 `AUTHENTICATION_REQUIRED`.
    - Pembuktian Negatif Live Penutupan Celah `DEVICE_AUTH_PREFIX_BYPASS`: Pengujian dengan token acak ber-prefix `lkmd_...` terbukti gagal dengan HTTP 401 `AUTHENTICATION_REQUIRED`, membuktikan eliminasi celah bypass aktif di runtime produksi.
  - Verifikasi Pelestarian Baseline Produksi:
    - Artikel A (ID 7, slug `jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge`): Cover `/media/images/b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp`, alt `"Kondensasi pada permukaan kaca jendela rumah dengan kusen aluminium"`, content_hash `00dc804d...`, actual_published_at `2026-10-07 01:24:49` 100% utuh.
    - Artikel B (ID 8, slug `thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi`): Cover `/media/images/631baf7a25e9986b9f0d01073633cb434ae162b3df1241ddac56b977026276e9.webp`, alt `"Detail penampang kusen jendela aluminium pada fasad arsitektur modern"`, content_hash `66094cf5...`, actual_published_at `2026-10-07 01:28:26` 100% utuh tanpa mutasi.
    - Perangkat `lokamedia-prod-operator-01` (`ACTIVE`) dan probe revoked `media-a57-p3a-probe-20260930` (`REVOKED`) 100% terjaga.
    - Berkas kandidat cover Artikel B lokal (`artifacts/article-b-cover-1315x660.webp`, SHA-256 `8ecd77ff40bb4d933e27e44980bcec9ebb040e0cb971de72e5387ff6b463247d`, size 149.764 bytes) terbukti siap untuk eksekusi terkontrol.
    - Zero direct SQL mutasi dan zero promosi prematur terhadap Artikel B di produksi.
- **Hasil & Status Keselamatan:**
  - Migrasi D1 remote 0031 & 0032: APPLIED.
  - Deployment Worker: Version ID `eb46fc2a-c5bc-4705-ab85-285f0802dc66` ACTIVE.
  - Live Edge Smoke: 100% PASS (Zero 5xx, Zero 1101 errors).
  - Negative Security Hardening Proof: 100% PASS (Prefix bypass elimination live).
  - Klasifikasi: **`LOKAMEDIA_V0_1_18_PRODUCTION_ENABLED`**.
  - Stop Token Operasional: `LOKAMEDIA_V0_1_18_PRODUCTION_ENABLEMENT_1_HUMAN_HANDSHAKE_REQUIRED`.
  - Status Keselamatan: `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `autonomous media worker = DISABLED`, `kill_switch_engaged = 0`.

---

### LOKAMEDIA-V0.1.18-PRODUCTION-READINESS-CLOSEOUT: Dual-Control Manual Published-Media Promotion & Cryptographic Alt-Text Binding 2026-10-12

- **Tujuan & Ruang Lingkup:**
  - Mencapai kesiapan produksi penuh (*Production Readiness*) untuk ekstensi LokaMedia dan backend promosi media pada versi **v0.1.18**.
  - Menerapkan arsitektur kontrol ganda (*Dual-Control Authority Separation*): perangkat media terotentikasi hanya dapat mengajukan permohonan promosi (`REQUESTED`), Chief Editor / admin manusia memeriksa dan menyetujui secara kriptografis (`APPROVED`) di antarmuka `/admin/media-promotions`, dan eksekusi promosi dijalankan tepat satu kali (`CONSUMED`).
  - Menutup defek perambatan deskripsi aksesibilitas (*alt-text propagation closeout*): mewajibkan input teks alt eksplisit di side panel ekstensi, mengikat teks alt ke dalam tanda tangan HMAC dan skema database D1 (`media_promotion_approvals.alt_text` via migrasi `0032`), menampilkan teks alt usulan pada portal admin, serta memperbarui cermin `articles.image_alt` secara kanonikal tanpa kebocoran teks placeholder lama.
  - Menutup celah keamanan otentikasi perangkat (`DEVICE_AUTH_PREFIX_BYPASS`): menghapus seluruh bypass prefix `lkmd_`/`test_` pada runtime produksi, menegakkan verifikasi hash SHA-256 terhadap baris `media_devices` aktif di D1 lokal, dan memastikan token tidak terdaftar/revoked gagal secara fail-closed.
  - Membuktikan ketetapan publikasi (*Publication Immutability*): promosi media hanya memodifikasi metadata media (`featured_image`, `image_alt`, `updated_at`), sementara naskah (`content_md`, `content_html`), fingerprint (`content_hash`), status (`PUBLISHED`), jadwal penerbitan (`published_at`), dan tanda terima penerbitan asli (`actual_published_at`) terbukti 100% tidak berubah (zero republishing).
  - Pembuktian E2E Browser Nyata & Kesiapan Artikel B:
    - Melanjutkan atestasi `LOKAMEDIA_V0_1_17_TRUE_HUMAN_BROWSER_E2E_PROVEN` pada browser Chromium nyata hingga konfirmasi kanonik di versi v0.1.18.
    - Menyiapkan dan membuktikan kesiapan berkas cover Artikel B (`artifacts/article-b-cover-1315x660.webp`, SHA-256 `8ecd77ff40bb4d933e27e44980bcec9ebb040e0cb971de72e5387ff6b463247d`, alt: `"Detail sambungan kusen aluminium, kaca, dan dinding pada jendela rumah"`) melalui dry-run tanpa mutasi database produksi.
- **Hasil & Status Keselamatan:**
  - Seluruh 15 kasus pengujian pada `scripts/test-lokamedia-alt-text-closeout.js` (Kasus A s/d O) lulus 100% hijau (15/15 closeout cases PASS).
  - Seluruh rangkaian test suite LokaMedia (15+ suite, >200 tes) lulus tanpa regresi.
  - Typecheck TypeScript (`npx tsc --noEmit`) dan build Astro (`npm run build`) bersih tanpa error.
  - Secret scan: Nol kredensial plaintext, token hash, session secret, atau signature yang bocor.
  - Pembersihan canary lokal berhasil dilakukan tanpa mengorbankan fixture tes otomatis.
  - Klasifikasi: **`LOKAMEDIA_V0_1_18_PRODUCTION_READY`**.
  - Status Keselamatan: `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `autonomous media worker = DISABLED`.

---

### LOKAMEDIA-REAL-BROWSER-PHASE-B-SEAL-1: Real-Browser Human Approval E2E Attestation & Seal 2026-10-10

- **Tujuan & Ruang Lingkup:**
  - Melakukan atestasi penuh secara end-to-end terhadap alur persetujuan manusia (*Human Approval*) dan upload di browser nyata (*Real Browser Proof, Not Simulation-Only*).
  - Phase A membuktikan batas henti: eksekusi provider dan penangkapan gambar ChatGPT berhenti secara deterministik di status `RESULT READY` dengan nol mutasi upload, nol receipt, dan nol media asset di server D1.
  - Phase B membuktikan otorisasi operator manusia: penekanan tombol `APPROVE & UPLOAD` di side panel memicu urutan audit yang strictly monotonic:
    `HUMAN_APPROVAL_RECORDED` $\rightarrow$ `UPLOAD_APPROVAL_GATE_PASS` $\rightarrow$ `UPLOAD_START` $\rightarrow$ `UPLOAD_RECEIVED` $\rightarrow$ `ATTACHMENT_CONFIRMED` $\rightarrow$ `JOB_COMPLETE`.
  - Verifikasi Invarian Exactly-Once:
    - Receipt D1 lokal untuk canary (`mjob_0bc8a71e21f598f0272b11ce`): Tepat 1 `UPLOAD_RECEIVED` dan tepat 1 `ATTACHMENT_CONFIRMED` (total 2 receipts, nol duplikasi).
    - Media Asset D1 lokal: Dibuat tepat 1 aset (`ast_KCsMDkykVzEw7nhNnjOdqFgg`), SHA `bad12f705a150e4181be108def8e2cab4fb059f6916c2403f028524d82597235`, dimensi $1672 \times 941$, MIME `image/png`, status `VALIDATED`.
    - Relasi Artikel: Tepat 1 relasi aktif di `article_media` untuk artikel ID 9 dengan slot `featured` dan role `featured`.
    - Approval terikat secara eksklusif ke `job_id` dan SHA kandidat, terkonsumsi tepat satu kali tanpa eksekusi upload ganda.
  - Perbaikan Observabilitas UI Minor:
    - Memperbaiki `lastAction` yang sempat tertinggal di teks `"Uploading"` setelah tahap `UPLOAD COMPLETE` akibat ketiadaan pemetaan event `ATTACHMENT_CONFIRMED` dan `JOB_COMPLETE` pada `appendAuditEvent`.
    - Memetakan kedua event tersebut ke `lastAction = 'Upload complete & confirmed'`.
    - Bump patch version ekstensi LokaMedia ke `v0.1.10` secara kanonikal di manifest, constants, background, side-panel HTML & JS, serta seluruh test suite.
  - Pembersihan Fixture Canary Lokal:
    - Membersihkan fixture pengujian lokal (Artikel 9, job `mjob_0bc8a71e21f598f0272b11ce`, receipts, article_media, dan media_assets) secara referensial aman setelah seluruh bukti forensik terekam lengkap dalam checkpoint.
  - Pelestarian Invarian Produksi:
    - Aset produksi Artikel A (`/media/images/b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp`) 100% terjaga tanpa mutasi.
    - Aset lokal historis Artikel B (`ast_U0qJsAPBnIga9ExfH385kNUp`, SHA `f87275adaf3df50eb3a27982e54cf1fc9f5d27107e62560beff20da263613903`) tetap berstatus `LEGACY_AUTO_UPLOAD_COMPLETE` tanpa regenerasi atau re-upload.
  - Audit Git Scope & Debris:
    - Mengidentifikasi dan menghapus skrip-skrip sementara (canary prep, attest-phase-a, parse-leveldb, dll).
    - Memastikan zero secrets (API key, auth token, device credential) dalam working copy.
- **Hasil & Status Keselamatan:**
  - Seluruh 9 test suite regresi LokaMedia (87+ tes) lulus 100% hijau.
  - TypeScript build (`npx tsc --noEmit`) 100% bersih tanpa error.
  - Klasifikasi: **`LOKAMEDIA_HUMAN_APPROVAL_REAL_BROWSER_E2E_PROVEN`**.
  - Stop Token: **`LOKAMEDIA_REAL_BROWSER_PHASE_B_SEAL_1_HUMAN_COMMIT_REVIEW_REQUIRED`**.

---

### LOKAMEDIA-OBSERVABILITY-CLEANUP-1: Stale Run Timeout Banner & Audit Version Metadata Fix 2026-10-10


- **Tujuan & Ruang Lingkup:**
  - Memperbaiki Defect A: Mengatasi banner status merah `RUN_ONCE_TIMEOUT` yang muncul dini karena batas tunggu side panel 15 detik lebih pendek dari durasi generasi ChatGPT sesungguhnya (~27–35 detik).
  - Menetapkan batas tunggu operasi antarmuka provider yang panjang (`PROVIDER_OPERATION_TIMEOUT_MS = 120_000`) untuk `RUN_ONCE` dan `SEND_TO_CHATGPT`.
  - Menerapkan rekonsiliasi banner status otomatis `reconcileStatusBanner`: saat status ter-refresh membuktikan tahap operator yang sehat (`PROMPT READY`, `RESULT READY`, `UPLOAD COMPLETE`) dengan `last_error == null` dan tanpa error sistem, banner transien lama (`RUN_ONCE_TIMEOUT`, `SEND_TO_CHATGPT_TIMEOUT`, `Failed to fetch`) otomatis dibersihkan ke status `Ready`.
  - Memperbaiki Defect B: Menegakkan aturan version provenance di mana identitas runtime aktif dari manifes (`0.1.9`) / konstanta kanonikal `EXTENSION_VERSION` tidak boleh tertimpa oleh data penyimpanan riwayat lawas (`extension_version = "0.1.1"`).
  - Memastikan `formatAuditText` mengekspor `Extension Version: 0.1.9` secara kanonikal dengan mempertahankan independensi Protocol Version (`1`) dan DOM Adapter Version (`1`).
  - Menjaga integritas kandidat canary (`mjob_0bc8a71e21f598f0272b11ce`, run `run_1791645952427_44265789`, SHA `bad12f705a150e4181be108def8e2cab4fb059f6916c2403f028524d82597235`) tetap berada di status `CAPTURED / RESULT READY` tanpa regenerasi atau mutasi.
  - Bump patch version ekstensi ke `v0.1.9` di manifest, constants, background fallback, side-panel HTML & JS, serta handshake server D1.
  - Menulis test suite regresi baru `scripts/test-lokamedia-observability-cleanup.js` (7 tes).
- **Hasil & Status Keselamatan:**
  - Status canary di D1 lokal tetap `LEASED` (`completed_at = null`, 0 receipts, 0 media assets).
  - Article A produksi dan Article B tetap 100% terlindungi.
  - Seluruh pengujian (9 test suite, 71 tes) lulus 100% hijau.
  - TypeScript build (`npx tsc --noEmit`) 100% bersih tanpa error.
  - Klasifikasi: **`LOKAMEDIA_OBSERVABILITY_CLEANUP_PASS`**.
  - Stop Token: **`LOKAMEDIA_OBSERVABILITY_CLEANUP_1_OPERATOR_RELOAD_REQUIRED`**.

---

### LOKAMEDIA-HUMAN-APPROVAL-BOUNDARY-1: Human Approval Boundary & Explicit Upload Gate 2026-10-10

- **Tujuan & Ruang Lingkup:**
  - Menghentikan upload otomatis pasca-generasi dan capture gambar ChatGPT (`CAPTURE_PERSISTED -> UPLOAD_START`), menegakkan batas persetujuan operator (*Human Approval Boundary*).
  - Menegakkan pemisahan state: `GENERATED != CAPTURED != APPROVED != UPLOADED != FEATURED IN PRODUCTION`.
  - Menghentikan alur `SEND TO CHATGPT` dan checkpoint recovery tepat di status `RESULT READY`, dengan tombol `APPROVE & UPLOAD` dan `REJECT RESULT`.
  - Menerapkan catatan persetujuan eksplisit per-pekerjaan (*Job-Scoped Human Approval Record*): terikat unik pada kombinasi `job_id + candidate_sha256` beserta `approved_at`, `approval_source = 'operator_side_panel'`, dan status konsumsi.
  - Menerapkan aksi `APPROVE & UPLOAD`: validasi kesesuaian `job_id`, tahap `RESULT READY`, eksistensi kandidat, verifikasi SHA kandidat preview, proteksi anti double-click via `APPROVAL_ALREADY_CONSUMED`, sebelum mengizinkan upload ke server.
  - Menerapkan aksi `REJECT RESULT`: menghapus blob lokal yang ditolak, mencatat rejeksi manusia, status `RESULT_REJECTED`, dengan zero upload, zero mutasi server, dan gerbang submit ChatGPT tetap terkonsumsi tanpa regenerasi otomatis.
  - Memperluas model status server D1 (`AWAITING_REVIEW`) pada `jobs-service.ts`, `service.ts`, dan `readiness-reconciler.ts` serta menambahkan event audit baru: `RESULT_READY`, `HUMAN_APPROVAL_RECORDED`, `HUMAN_REJECTION_RECORDED`, `UPLOAD_APPROVAL_GATE_PASS`, `UPLOAD_APPROVAL_GATE_FAIL`.
  - Menerapkan server-side defense fail-closed pada endpoint `/api/internal/v1/media/upload`: unggahan dari `sourceType === 'lokamedia_extension'` wajib menyertakan `approval_record` valid dengan SHA-256 yang cocok dengan binary upload.
  - Melindungi aset lokal Artikel B (`mjob_9a381066fb65ee5dcbadbd51`, `ast_U0qJsAPBnIga9ExfH385kNUp`) sebagai `LEGACY_AUTO_UPLOAD_COMPLETE` tanpa regenerasi atau re-upload, dan menjaga aset produksi Artikel A tetap murni.
  - Bump patch version ekstensi kanonikal ke `v0.1.8` di manifest, constants, background, side panel HTML, dan version handshake.
  - Menulis test suite regresi baru `scripts/test-lokamedia-human-approval-boundary.js` (8 tes).
- **Hasil & Status Keselamatan:**
  - Status Artikel A di produksi dan cover WebP tetap 100% terlindungi dan immutable.
  - Status Artikel B di D1 lokal tetap `LEGACY_AUTO_UPLOAD_COMPLETE` staged tanpa promosi ke produksi.
  - Seluruh pengujian (8 test suite, 64 tes) lulus hijau tanpa regresi.
  - TypeScript build (`npx tsc --noEmit`) 100% bersih.
  - Klasifikasi: **`LOKAMEDIA_HUMAN_APPROVAL_BOUNDARY_PASS`**.
  - Stop Token: **`LOKAMEDIA_HUMAN_APPROVAL_BOUNDARY_1_OPERATOR_RELOAD_REQUIRED`**.

---

### LOKAMEDIA-JOB-SCOPED-RESULT-UI-FIX-1: Cross-Job Prompt / Result / Workflow State Leak Fix 2026-10-10

- **Tujuan & Ruang Lingkup:**
  - Menyelesaikan kebocoran state visual dan operasional lintas pekerjaan (*cross-job prompt preview, result review metadata, workflow stage leak*) di mana antarmuka ekstensi LokaMedia menampilkan metadata dan judul Artikel A saat memproses Artikel B.
  - Melakukan forensik LevelDB Chrome extension dan Local D1: membuktikan bahwa prompt Artikel B (`5ea3cfb98af3801bc61445e80dda3d964b9126bf1c0f966876a95762785a98e3`) sukses disubmit dan diterima ChatGPT (`run_1791421093266_922c06a6`), 16 tahapan audit terlaksana lengkap, dan aset derivatif telah tersimpan utuh di local D1 (`COMPLETE`, `asset_id: ast_U0qJsAPBnIga9ExfH385kNUp`, SHA: `f87275adaf3df50eb3a27982e54cf1fc9f5d27107e62560beff20da263613903`, 1770 × 889 PNG).
  - Mengidentifikasi akar masalah UI: bias sticky `currentJobId` dan short-circuit prioritas pada `resolveCurrentJob` yang terus mengembalikan Job A, serta pemisahan metadata text vs ketersediaan blob yang meninggalkan residu dimensi dan SHA Artikel A saat blob IndexedDB lama tidak ditemukan.
  - Mengimplementasikan arsitektur generik `jobOperationalStates[job_id]` pada storage ekstensi dan migrasi otomatis state legasi saat boot / update.
  - Memperbaiki prioritas resolusi job aktif di `resolveCurrentJob` (active in-flight > armed non-completed gate > queued > currentJobId > completed).
  - Menegakkan invarian konsistensi Result Review: jika job aktif belum memiliki kandidat gambar, seluruh metadata (Dimensions, MIME, Size, SHA-256) wajib terisi tanda strip (`--`) dan placeholder murni menampilkan `No image candidate captured`.
  - Mengisolasi error reporting ke tingkat pekerjaan (`job_error`), mencegah residu `PHASE_4B_RUN_CONSUMED` Job A muncul di Job B.
  - Melakukan bump versi ekstensi kanonikal ke `v0.1.7` di manifest, constants, background, side panel HTML, dan version handshake.
  - Menulis test suite regresi baru `scripts/test-lokamedia-job-scoped-ui-state.js` (4 tes).
- **Hasil & Status Keselamatan:**
  - Status Artikel A di produksi dan cover WebP tetap 100% terlindungi dan immutable.
  - Status Artikel B di D1 lokal telah berstatus `COMPLETE` / `UPLOAD_COMPLETE` dengan aset `ast_U0qJsAPBnIga9ExfH385kNUp`. Tidak ada mutasi ke D1/R2 produksi.
  - Seluruh pengujian (7 test suite, 56 tes) lulus hijau tanpa regresi.
  - Klasifikasi: **`ARTICLE_B_ALREADY_UPLOADED_RECONCILED`**.
  - Stop Token: **`LOKAMEDIA_JOB_SCOPED_RESULT_UI_FIX_1_OPERATOR_RELOAD_REQUIRED`**.

---

### LOKAMEDIA-JOB-SCOPED-RUN-GATE-FIX-1: Scoped Run Gate Isolation & Error Propagation Fix 2026-10-08

- **Tujuan & Ruang Lingkup:**
  - Menyelesaikan kebocoran gerbang eksekusi tunggal (*phase4bSingleRun leak*) dari Artikel A (`mjob_9654a1ff6c242ce49711a664`) ke Artikel B (`mjob_9a381066fb65ee5dcbadbd51`), di mana antarmuka ekstensi memblokir tombol `SEND TO CHATGPT` dan `RUN ONCE` dengan peringatan `PHASE_4B_RUN_CONSUMED` serta memunculkan `INTERNAL_ERROR`.
  - Melakukan forensik LevelDB Chrome extension: membuktikan `phase4bSingleRun` tersimpan sebagai singleton objek Job A (`outcome: 'complete'`, `submission_consumed: true`), sementara Job B telah terdaftar di queue lokal/server (`QUEUED`, `attempt = 0`, `lease = null`).
  - Menerapkan arsitektur gerbang berlingkup pekerjaan (*Job-Scoped Gate Isolation*): gerbang tunggal di-scope secara spesifik per `job_id` via `state.phase4bJobGates[job_id]` dengan fallback aman ke `phase4bSingleRun`.
  - Memperbaiki rekonsiliasi transisi job di `background.js`: saat job baru berstatus aman server `QUEUED` tiba, riwayat eksekusi Artikel A dimigrasikan secara permanen ke `phase4bJobGates[jobA]`, pointer aktif direset untuk Job B, dan error sementara dibersihkan.
  - Memperbaiki predikat gerbang pada `sendToChatGpt` dan `runOnce` di `controller.js`: mengevaluasi konsumsi spesifik pada `targetJob.job_id`, bukan secara global tanpa identitas pekerjaan.
  - Memperbaiki propagasi error: error `PHASE_4B_RUN_CONSUMED` hanya disetel ke `status.last_error` jika pekerjaan yang bersangkutan memang sudah dikonsumsi; untuk Job B yang baru masuk, `status.last_error` kembali ke `null` (`none` di UI).
  - Melakukan bump patch version ekstensi ke `v0.1.6` pada manifest, constants, background, side panel HTML, dan version handshake.
  - Menulis suite regresi baru `scripts/test-lokamedia-job-scoped-gate.js` (4 tes) untuk membuktikan isolasi Job A -> Job B -> Job C tanpa hardcoding ID.
- **Hasil & Status Keselamatan:**
  - Status Artikel A di produksi dan cover WebP tetap 100% terlindungi dan immutable.
  - Status Artikel B di D1 lokal tetap `QUEUED`, `attempt = 0`, belum digenerasi.
  - Seluruh pengujian (6 test suite, 52 tes) lulus hijau tanpa regresi.
  - Klasifikasi: **`LOKAMEDIA_JOB_SCOPED_GATE_FIX_PASS`**.
  - Stop Token: **`LOKAMEDIA_JOB_SCOPED_RUN_GATE_FIX_1_OPERATOR_RELOAD_REQUIRED`**.

---

### FEATURED-MEDIA-PROMOTE-ARTICLE-A-3: Resume Production Media Promotion Post-Re-auth 2026-10-08

- **Tujuan & Ruang Lingkup:**
  - Melanjutkan promosi aset media cover Artikel A yang sempat tertahan pada fase Promote A-2 akibat sesi OAuth Cloudflare Wrangler kedaluwarsa.
  - Memverifikasi otentikasi Cloudflare secara langsung via `npx wrangler whoami` (`chandrajoyko@gmail.com`, Account ID `a8e6d11d45dc2d14fe49fe3b84958ee8`).
  - Mengatestasi ulang Artikel A di D1 produksi secara live: slug, title, content_hash (`00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298`), dan status published terbukti 100% cocok.
  - Memverifikasi ulang integritas derivatif cover `artifacts/cover-1315x660.webp`: SHA-256 persis `b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4`, ukuran 197.762 bytes.
  - Mengunggah derivatif ke Cloudflare R2 produksi bucket `rancangloka-media` dengan key `media/images/b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp`.
  - Memverifikasi unduhan ulang dan rute edge publik `https://rancangloka.com/media/images/...` menghasilkan `HTTP 200 OK` dengan byte dan hash identik.
  - Mendaftarkan entitas `media_assets` (`ast_b5cd50198632fecc2810b756`) dengan data provenans lengkap ke D1 produksi.
  - Melepaskan relasi `featured` lama pada `article_media` untuk placeholder bersama tanpa menghapus objek fisiknya, lalu mengikatkan aset baru sebagai relasi featured aktif Artikel A.
  - Memperbarui `featured_image` dan `image_alt` pada tabel `articles` tanpa menyentuh naskah, content hash, maupun timestamp publikasi.
- **Hasil & Verifikasi:**
  - Halaman publik artikel (`/jendela-berkondensasi...`) dan beranda render cover baru dengan alt text yang benar.
  - Nilai `og:image` otomatis mencerminkan cover baru.
  - `content_hash` tetap `00dc804d...`, tanda terima tetap 1, Artikel B tidak tersentuh.
  - Klasifikasi: **`FEATURED_MEDIA_ARTICLE_A_PROMOTION_PASS`**.
  - Stop Token: **`FEATURED_MEDIA_PROMOTE_ARTICLE_A_3_HUMAN_REVIEW_REQUIRED`**.

---

### FEATURED-MEDIA-PROMOTE-ARTICLE-A-2: 1315x660 Derivative Generation & Cloudflare Ingestion Invariants 2026-10-07

- **Tujuan & Ruang Lingkup:**
  - Melakukan promosi terkontrol satu kali (*one-off production media promotion*) untuk aset media Article A yang telah diverifikasi topic-nya dari run LokaMedia `run_1791380727041_abddb752` (Job: `mjob_9654a1ff6c242ce49711a664`).
  - Memvalidasi integritas binary sumber lokal asli (1770 × 889 PNG, 2.623.727 bytes) dengan SHA-256 terbukti persis `cb5c343af17ef91b13e63c23a818604040512ad6a79282ffd3d1c2520c956144`.
  - Membuat cover derivatif standar editorial 1315 × 660 WebP berkualitas tinggi via Python Pillow Lanczos resampling (`quality=90`, `method=6`).
  - Meminimalkan pemotongan geometris: hanya 0.63px tinggi dipotong secara simetris tanpa distorsi (`artifacts/cover-1315x660.webp`, 197.762 bytes, SHA-256: `b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4`).
  - Menerapkan atestasi pra-mutasi terhadap artikel target di lingkungan produksi: slug exact match, title exact match, status published, dan content hash exact match (`00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298`).
  - Mengaudit sesi Cloudflare Wrangler: mendeteksi sesi OAuth kedaluwarsa sejak `2026-10-07T04:24:48.821Z` dan menolak fabrikasi sukses (*no fabricated success*).
- **Hasil & Status Keselamatan:**
  - Mutasi produksi D1/R2: Tepat 0 mutasi dilakukan (gerbang fail-closed bertahan).
  - Klasifikasi: **`PRODUCTION_MEDIA_UPLOAD_BLOCKED`**.
  - Stop Token: **`FEATURED_MEDIA_PROMOTE_ARTICLE_A_2_HUMAN_REVIEW_REQUIRED`**.

---

### LOKAMEDIA-ARTICLE-IDENTITY-ASSET-AUDIT-1: Article Target Resolution & Forensic Provenance Audit 2026-10-07

- **Tujuan & Ruang Lingkup:**
  - Menyelesaikan anomali identitas di mana laporan pengujian UX-2 sebelumnya menyebutkan Job `mjob_9654a1ff6c242ce49711a664` terasosiasi dengan judul *"Mengenal Bata Ringan AAC..."*.
  - Menelusuri seluruh baris job, receipts, dan artikel di Local D1 serta membandingkannya dengan Production D1.
  - Membuktikan bahwa judul Bata Ringan AAC murni berasal dari synthetic test fixture pada `scripts/test-lokamedia-operator-ux-2.js`, sementara database riil lokal dan produksi pada ID 7 secara konsisten mereferensikan *"Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?"*.
  - Memverifikasi kesesuaian semantik prompt dan visual hasil tangkapan: 100% jendela hunian berbingkai aluminium dengan butiran kondensasi pagi hari, nol konten bata ringan.
  - Menetapkan aturan penargetan aman (*Safe Targeting Rule*): melarang penggunaan *naked numeric ID* lintas lingkungan dan mewajibkan resolusi berbasis slug kanonikal dengan atestasi 4 poin (slug, title, hash, status).
- **Hasil & Status:**
  - Klasifikasi: **`LOKAMEDIA_IDENTITY_AUDIT_PASS`**.
  - Stop Token: **`LOKAMEDIA_ARTICLE_IDENTITY_ASSET_AUDIT_1_HUMAN_REVIEW_REQUIRED`**.

---

### LOKAMEDIA-OPERATOR-UX-2 & PROVIDER-TAB-BINDING-1: Extension v0.1.5, Prompt Preview & Result Review Cards 2026-10-07

- **Tujuan & Ruang Lingkup:**
  - Menyelesaikan masalah keterikatan tab provider (*Explicit Provider Tab Binding*) pada adapter ChatGPT ekstensi LokaMedia, mencegah otomasi menyuntikkan prompt ke sembarang sesi percakapan operator.
  - Meningkatkan transparansi antarmuka operator dengan kartu Prompt Preview (`#prompt-preview-card`) dan Result Review (`#result-review-card`) dengan fallback tangkapan manual.
  - Melakukan bump versi ekstensi kanonikal ke `v0.1.5` pada manifest, popup, background, dan konstanta.
- **Hasil & Status:**
  - Ekstensi: Berjalan stabil pada versi `0.1.5` di `extensions/lokamedia/`.
  - Klasifikasi: **`LOKAMEDIA_OPERATOR_UX_PASS`**.

---

### LOKAMEDIA-DOM-CONTRACT-RECOVERY-1 & JOB-A RETRY STATE CLEANUP: ChatGPT DOM Recovery, v0.1.2 Bump & Retryable State 2026-10-07

- **Tujuan & Ruang Lingkup:**
  - Melakukan investigasi forensik terhadap kegagalan run `run_1791360425560_0a89be9d` pada Job A (`mjob_9654a1ff6c242ce49711a664`) dengan error `DOM_CONTRACT_UNSUPPORTED`.
  - Memastikan klasifikasi risiko duplikasi secara pasti: terbukti `PROVIDER_SUBMISSION_NOT_OCCURRED` (teks prompt belum pernah diinjeksi, tombol Send belum pernah diklik, attempt tetap 0).
  - Menghilangkan cacat inkonsistensi precheck vs submit: precheck sebelumnya melaporkan pass tanpa memanggil `provider.prepare(job)`. Keduanya kini mengonsumsi evaluasi kontrak DOM dan preparasi yang sama.
  - Memperbaiki adapter ChatGPT untuk mendukung DOM modern: penanganan selektor ProseMirror `#prompt-textarea`, deteksi tombol suara (`composer-speech-button`) yang beralih dinamis ke tombol kirim (`send-button`) setelah teks terisi, serta verifikasi konten sebelum klik kirim (`verifyComposerContent`).
  - Menerapkan semantik gerbang submisi `ARMED != CONSUMED`: kegagalan kontrak DOM sebelum pengiriman prompt secara aman mendisarm gerbang sehingga retry operator tetap terbuka tanpa memicu duplicate-generation blocker.
  - Melakukan bump patch version ekstensi dari `0.1.1` ke `0.1.2` di seluruh manifest, konstanta, side panel, dan handshake server `version.ts`.
  - Memulihkan Job A di local D1 ke status bersih retryable (`QUEUED`, lease dilepas, `last_error_code = null`, `job_revision = 4`, `attempt = 0`) sambil mengabadikan kegagalan historis pada tabel `media_job_events`.
  - Memvalidasi seluruh 13 predikat kelayakan `evaluateRunOnceEligibility()` hingga tombol Run Once berstatus `ENABLED`.
- **Komponen yang Dimodifikasi & Ditambahkan:**
  - `extensions/lokamedia/manifest.json`: Versi dinaikkan ke `0.1.2`.
  - `extensions/lokamedia/src/constants.js` & `src/background.js`: Versi ekstensi dan fallback disesuaikan ke `0.1.2`.
  - `extensions/lokamedia/src/providers/chatgpt/selectors.js`: Selektor fallback array yang resilien untuk composer dan kontrol pengiriman.
  - `extensions/lokamedia/src/providers/chatgpt/capability-detector.js`: Verifikasi editor composer berkemampuan edit.
  - `extensions/lokamedia/src/providers/chatgpt/content-script.js`: Injeksi multiline berbasis elemen `<p>` ProseMirror, verifikasi isi sebelum send, penanganan transisi tombol suara/kirim, dan flag `submission_escaped = false` saat abort pra-kirim.
  - `extensions/lokamedia/src/providers/chatgpt/adapter.js`: Propagasi `submission_escaped`.
  - `extensions/lokamedia/src/storage.js`: Metode `disarmPhase4bSubmission()` dan proteksi re-arm berbasis status `submission_consumed`.
  - `extensions/lokamedia/src/controller.js`: Sinkronisasi precheck dengan live `provider.prepare(job)` dan disarm gerbang jika terjadi error sebelum submisi.
  - `extensions/lokamedia/src/side-panel.html` & `src/side-panel.js`: Tampilan badge `Extension v0.1.2 — CURRENT` dan runtime meta.
  - `scripts/test-lokamedia-dom-contract-recovery.js`: Suite regresi 9/9 tes membuktikan seluruh invarian pemulihan DOM.
  - `state/LOKAMEDIA_DOM_CONTRACT_RECOVERY_1_CHECKPOINT.md`: Checkpoint forensik dan status pemulihan.
- **Status & Verifikasi:**
  - Pengujian: 9/9 test DOM recovery, 10/10 test runonce recovery, 10/10 test side panel, 22/22 test Phase 3 extension, 18/18 test media orchestrator, 17/17 test durable retry, 25/25 test retry policy lolos.
  - TypeScript: `npx tsc --noEmit` lolos tanpa error.
  - Klasifikasi: **`LOKAMEDIA_DOM_CONTRACT_RECOVERED`** & **`LOKAMEDIA_JOB_A_RETRY_READY`**.
  - Side Panel: Run Once = **`ENABLED`**.

---

### CONTENT-PUBLISH-A-B-1 & LOKAMEDIA DEVICE TOKEN ROTATION: Manual Human Authorization & Local Credential Rotation 2026-10-07

- **Tujuan & Ruang Lingkup:**
  - Menerbitkan dua artikel rilis editorial yang telah disegel secara manual atas otorisasi Pemimpin Redaksi (Human Approval):
    - **Artikel A**: *Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?* (SHA-256: `00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298`).
    - **Artikel B**: *Thermal Bridge Kusen Aluminium: Kondensasi Sudut, Jalur Kalor Struktur, dan Mitigasi Thermal Break* (SHA-256: `955d5bb25c1566113b28b78807d9bbda37215a7eaee797676c8c4ee2988f7236`).
  - Melakukan rotasi token perangkat lokal pengembangan (`dev_chr_local`) di local D1 SQLite secara aman tanpa menyentuh database produksi D1 atau R2 remote.
- **Status & Verifikasi:**
  - Status Artikel: Kedua artikel berstatus aktif / published di edge database dengan integritas konten terverifikasi.
  - Klasifikasi: **`CONTENT_PUBLISH_A_B_PASS`** & **`DEVICE_TOKEN_ROTATION_SUCCESS`**.

---

### CONTENT-BOOTSTRAP-RECOVERY-1: Research Discovery Precision & Hermes Browser Free Web Fallback 2026-10-06

- **Tujuan & Ruang Lingkup:**
  - Memperbaiki presisi discovery riset bebas slop setelah kegagalan Wave 1 di mana 0/3 topik lolos karena query CrossRef tercemar kata editorial generik dan pencocokan kandidat tidak relevan (Earth shelter, biomedis/kelumpuhan motorik, intervensi HIV).
  - Mengembangkan provider-specific query rendering dari dekomposisi konsep kanonikal umum tanpa hardcoding topik.
  - Menambahkan lapisan pemeringkatan semantik kandidat dan penegakan konsistensi domain arsitektur/sains material.
  - Mengaudit kapabilitas browser container Hermes dan mengintegrasikan fallback discovery browser yang aman dan bounded.
- **Komponen yang Dimodifikasi & Ditambahkan:**
  - `src/lib/editorial/research-discovery-planner.ts`:
    - Pembersihan istilah intent editorial generik (`EDITORIAL_INTENT_TERMS`: *differential diagnosis, analysis, strategy, intervention, mitigation, causes physics*).
    - `sanitizeBibliographicTerms()`: Purge kata non-spesifik dari query CrossRef.
    - `renderProviderSpecificQuery()`: Varian query terpisah untuk CrossRef, Wikipedia, OpenWeb, dan Hermes Browser.
  - `src/lib/editorial/discovery-providers.ts` & `src/lib/editorial/source-discovery.ts`:
    - `evaluateCandidateDomainConsistency()`: Deteksi pola luar domain (`OUT_OF_DOMAIN_PATTERNS`) dengan penalti -200 poin untuk kandidat medis/software.
    - `HermesBrowserDiscoveryProvider`: Adapter provider browser dengan deteksi blokade CAPTCHA/bot (`BROWSER_SEARCH_BLOCKED`), tanpa pemberian otoritas bukti pada snippet (*evidence authority = 0*).
  - `src/lib/editorial/irwan-research-runtime.ts`:
    - Kebijakan Free-First: CrossRef $\to$ Wikipedia $\to$ OA Metadata $\to$ Hermes Browser $\to$ Brave Search (hanya bila aktif).
    - Strict guard Brave Search: request count tetap 0 saat toggle OFF.
  - `scripts/test-content-bootstrap-discovery-recovery.js`:
    - Suite pengujian 17/17 PASS mencakup forensik Wave 1, sanitasi query, konsistensi domain, penolakan kandidat off-topic, isolasi browser, dan zero hardcoding.
  - `scripts/validate-discovery-recovery-live.js`:
    - Validasi live satu topik (Kaca Tempered vs Laminated): 0 kandidat medis/software, 3 sumber Wikipedia live diunduh, berhenti aman pada `TOPIC_EVIDENCE_ALIGNMENT_FAIL` tanpa melonggarkan gerbang bukti.
- **Status & Verifikasi:**
  - Commit: `7020fe8` (`fix(editorial): improve free research discovery precision`).
  - Klasifikasi: **`CONTENT_BOOTSTRAP_RECOVERY_PASS`**.
  - Stop Gate: **`CONTENT_BOOTSTRAP_RECOVERY_1_HUMAN_REVIEW_REQUIRED`**.

---

### CONTENT-BOOTSTRAP-1 (WAVE 1): Foundational Content Production Sprint & Forensic Pause 2026-10-06

- **Tujuan & Ruang Lingkup:**
  - Memulai sprint produksi 10 artikel editorial publik RancangLoka dengan batas 15 topik percobaan.
  - Menjalankan Wave 1 (3 topik: Keramik Popping, Kaca Tempered vs Laminated, Shading Matahari Eksterior).
- **Hasil & Temuan:**
  - 3 attempted, 0 passed research, 0 reached Joko, 0 ready for approval.
  - Terjadi kebocoran semantik pada CrossRef & Wikipedia yang menarik makalah di luar domain sains bangunan.
  - Sesuai prinsip *Quality > Forcing Output*, Wave 2 ditunda untuk investigasi forensik `CONTENT-BOOTSTRAP-RECOVERY-1`.
- **Status:**
  - Berhenti aman: **`CONTENT_BOOTSTRAP_WAVE1_FORENSIC_PAUSE`**.

---

### ADMIN-BRAVE-SEARCH-SETTINGS-1 & PRODUCTION ACTIVATION: Secure Admin Settings & Migration 0030 2026-10-06

- **Tujuan & Ruang Lingkup:**
  - Menyediakan kontrol administratif penuh untuk fitur Brave Search di Admin Dashboard (`/admin/settings`) tanpa memerlukan intervensi SSH atau hardcoded env di remote.
  - Menerapkan enkripsi kunci simetris KEK AES-256-GCM pada database D1 untuk menyimpan API key secara aman (*at rest*).
- **Komponen yang Dimodifikasi & Ditambahkan:**
  - `src/lib/crypto/secret-vault.ts`: Enkripsi/dekripsi AES-256-GCM dengan derive key PBKDF2/SHA-256 berbasis `SETTINGS_ENCRYPTION_KEY` / `SESSION_SECRET`.
  - `migrations/0030_research_discovery_settings.sql`: Tabel konfigurasi `site_settings` untuk provider discovery.
  - `src/pages/admin/settings/index.astro` & API endpoint: UI manajemen status provider, input API key dengan masking aman, dan toggle status (OFF default).
  - `scripts/test-admin-brave-search-settings.js`: 17/17 tes lolos verifikasi enkripsi, idempotensi, dan fallback.
- **Status & Verifikasi:**
  - Commit: `d602dfe` (`feat(admin): add secure Brave Search API settings`).
  - Klasifikasi: **`ADMIN_BRAVE_SEARCH_SETTINGS_PASS`**.

---

### OPEN-WEB-DISCOVERY-ACTIVATION-1: Open-Web Research Discovery & Socket-Pinned Network Safety 2026-10-06

- **Tujuan & Ruang Lingkup:**
  - Mengaktifkan adapter provider open-web nyata (Brave Search API) dengan perlindungan keamanan jaringan tingkat tinggi (*defense-in-depth*).
  - Mengeliminasi risiko DNS Rebinding / TOCTOU pada Node.js native `fetch` dengan mengimplementasikan socket-pinned dispatcher (`undici.Agent` kustom dengan `connect.lookup` terikat IP yang divalidasi).
- **Komponen yang Dimodifikasi & Ditambahkan:**
  - `src/lib/editorial/network-safety.ts`:
    - `validateSafeUrlAndDns()`: Resolusi DNS pra-koneksi menolak IPv4 privat, loopback, link-local, multicast, dan reserved ranges.
    - `createSafePinnedAgent()` / `safePinnedFetch()`: Pengikatan socket ke IP hasil validasi DNS untuk mencegah perubahan IP saat koneksi TCP.
    - Evaluasi redirect aman langkah-demi-langkah dengan revalidasi IP di setiap hop HTTP 3xx.
  - `src/lib/editorial/open-web-provider.ts`:
    - Adapter Brave Search resmi (`api.search.brave.com/res/v1/web/search`) dengan header `X-Subscription-Token` berotentikasi.
  - `scripts/test-open-web-discovery.js`: 15/15 tes keamanan jaringan dan simulasi adapter lolos.
- **Status & Verifikasi:**
  - Commit: `2ad7966` (`fix(editorial): activate safe open-web research discovery`).
  - Klasifikasi: **`OPEN_WEB_DISCOVERY_ACTIVATION_PASS`**.

---

### RESEARCH-DISCOVERY-RUNTIME-READINESS-1 & CAPABILITY-1 2026-10-06

- **Tujuan & Ruang Lingkup:**
  - Membangun arsitektur penemuan multi-penyedia terikat batas (*bounded multi-provider discovery*).
  - Memverifikasi kesiapan runtime Irwan tanpa membocorkan kredensial atau memicu query tak terkontrol.
- **Komponen yang Dimodifikasi:**
  - `src/lib/editorial/research-discovery-planner.ts`: Perencanaan kueri berjenjang berdasarkan matriks peran semantik.
  - `src/lib/editorial/discovery-providers.ts`: Standarisasi metadata kandidat `NormalizedCandidateMetadata`.
  - `scripts/test-research-discovery-capability.js` (14/14 PASS) & `scripts/test-research-discovery-runtime-readiness.js` (14/14 PASS).
- **Status:**
  - Commit: `ab1290b` & `1b84b55`.

---

### EVIDENCE-QUALITY-RUNTIME-INTEGRATION-1: Real Runtime Evidence Filtering & Proposition Gate 2026-10-06

- **Tujuan & Ruang Lingkup:**
  - Mengintegrasikan modul `evidence-quality-gate.ts` secara langsung ke dalam alur runtime `irwan-research-runtime.ts` dan pipeline orkestrasi editorial.
  - Memastikan hanya dokumen yang terklasifikasi `HIGHLY_RELEVANT` atau `PARTIALLY_RELEVANT` dengan teks bersih bebas spam yang dapat menghasilkan kutipan (*passages*) untuk Joko.
  - Menegakkan verifikasi proposisi naskah sebelum evaluasi lolos gate.
- **Komponen yang Dimodifikasi:**
  - `src/lib/editorial/irwan-research-runtime.ts`: Penyaringan live sumber berotoritas, pembersihan spam otomatis, dan pemblokiran dini sumber tak relevan.
  - `scripts/test-evidence-quality-runtime-integration.js`: 14/14 tes lulus.
- **Status & Verifikasi:**
  - Commit: `5aee8ee` (`fix(editorial): integrate semantic evidence quality into runtime`).
  - Klasifikasi: **`EVIDENCE_QUALITY_RUNTIME_INTEGRATION_PASS`**.

---

### EVIDENCE-QUALITY-GATE-1: Semantic Evidence Quality Gates & Relevance Enforcement 2026-10-06

- **Tujuan & Ruang Lingkup:**
  - Mengimplementasikan gerbang kualitas bukti semantik empat dimensi: **`AUTHENTIC + TOPIC_RELEVANT + CLAIM_RELEVANT + AUTHORITY_APPROPRIATE`**.
  - Mengeliminasi *false positive* akuisisi di mana dokumen HTTP 200 dianggap sebagai bukti sah tanpa mempertimbangkan relevansi topik, kebersihan teks dari boilerplate/spam, ketercakupan substantif pertanyaan riset, dan kecukupan otoritas.
- **Komponen yang Dimodifikasi & Ditambahkan:**
  - `src/lib/editorial/evidence-quality-gate.ts`:
    - `classifySourceRole()`: Membedakan 10 peran sumber (`OFFICIAL_GOVERNMENT_GUIDANCE`, `OFFICIAL_INSTITUTIONAL_GUIDANCE`, `SCHOLARLY_RESEARCH`, `SCHOLARLY_JOURNAL_ARTICLE`, `TECHNICAL_STANDARD`, `PROFESSIONAL_TECHNICAL_REFERENCE`, `EXPERT_EDITORIAL_MEDIA`, `MANUFACTURER_TECHNICAL_MATERIAL`, `GENERAL_EDITORIAL_MEDIA`, `OTHER`) berbasis URL, publisher, judul, DOI, dan penanda OJS jurnal ilmiah alih-alih akhiran domain `.ac.id` semata.
    - `cleanBoilerplateAndSpam()`: Purge otomatis navigasi, breadcrumb, footer, menu OJS, form login, copyright, tag list, komentar, dan spam judi slot/SEO dengan pelacakan rasio konten substantif dan fail-closed `CONTENT_QUALITY_INSUFFICIENT`.
    - `DocumentTopicRelevanceEvaluator`: Klasifikasi dokumen dinamis (`HIGHLY_RELEVANT`, `PARTIALLY_RELEVANT`, `INCIDENTALLY_RELEVANT`, `IRRELEVANT`, `UNCERTAIN`) yang menolak tabrakan leksikal off-topic (olahraga, pemilu, sarapan gizi sekolah, silat, kedokteran gigi).
    - `evaluatePassageRelevance()`: Klasifikasi kutipan (`DIRECTLY_RELEVANT`, `SUPPORTING_BACKGROUND`, `WEAKLY_RELATED`, `OFF_TOPIC`, `UNCERTAIN`).
    - `evaluateAuthoritySufficiency()`: Matriks otoritas per tipe proposisi (mekanisme fisik, panduan diagnostik, performa material, regulasi, rekomendasi empiris).
    - `evaluateSynthesizedClaim()`: Penolakan klaim sintesis tanpa deklarasi klaim induk terverifikasi atau dengan fakta/metrik tak bertuan (`SYNTHESIS_SUPPORT_MISSING`, regresi CLM-112).
    - `evaluateClaimQuality()` & `evaluateAuthorSafeEvidenceGate()`: Gerbang author-safe menyeluruh.
    - `evaluateResearchQuestionSupport()`: Evaluasi substantif proposisi jawaban per pertanyaan riset (bukan label `semantic_role` sintaksis semata).
    - `validateProblemSolverProductionGate()`: Penegakan ketat seluruh 6 kategori pertanyaan riset wajib mencapai minimal `ADEQUATELY_COVERED` dengan `authority_sufficient = true`.
    - `calculateSourceDiversityQuality()`: Pemisahan metrik sumber mentah dari aliran bukti relevan independen, mempertahankan risiko konsentrasi `CRITICAL` bila sumber relevan $\le 1$.
  - `src/lib/editorial/source-discovery.ts`:
    - Integrasi `classifySourceRole()` ke dalam `establishSourceIdentity()`.
  - `src/lib/editorial/index.ts`:
    - Ekspor modul `evidence-quality-gate.ts`.
  - `scripts/test-evidence-quality-gate.js`:
    - Suite pengujian 15 skenario: 14 skenario adversarial komprehensif + 1 pengujian kanonikal Replay Forensik Final5 beku (zero live network).
- **Hasil Pengujian & Verifikasi:**
  - `scripts/test-evidence-quality-gate.js`: **15/15 PASS**.
  - Seluruh 13 suite tes regresi editorial: **PASS**.
  - `npx tsc --noEmit`: **0 errors (Kompilasi TypeScript Bersih)**.
- **Status & Stop Gate:**
  - Klasifikasi: **`EVIDENCE_QUALITY_GATE_1_PASS`**.
  - Berhenti aman pada: **`EVIDENCE_QUALITY_GATE_1_HUMAN_REVIEW_REQUIRED`**.

---

### EVIDENCE-QUALITY-FORENSIC-1: Final5 Source Relevance, Authority & Claim Quality Audit 2026-10-06

- **Tujuan & Ruang Lingkup:**
  - Melakukan audit forensik mendalam (*read-only, no code changes, no network, no LLM provider*) terhadap artefak beku eksekusi kanonikal **EDITORIAL FINAL CLEAN PROOF #5**.
  - Menguji apakah bukti Final5 tidak hanya autentik secara provenansi (`LIVE_RETRIEVAL`, 100% hash SHA-256 valid), tetapi juga:
    - Benar-benar relevan dengan topik artikel (*genuine document-topic relevance*).
    - Relevan secara semantik terhadap setiap klaim (*semantic claim relevance*).
    - Terklasifikasi dengan benar menurut tipe dokumen (*document type classification*).
    - Memiliki otoritas yang memadai untuk peran bukti yang ditetapkan (*authority sufficiency*).
    - Menjawab pertanyaan riset kanonikal secara substantif (*real research-question coverage*).
- **Temuan Forensik Kunci:**
  - **Klasifikasi Sumber (`SOURCE_CLASSIFICATION_DEFECT`)**: Domain `.ac.id` secara keliru dinaikkan ke `OFFICIAL_INSTITUTIONAL_GUIDANCE` padahal merupakan jurnal OJS lokal (`SCHOLARLY_JOURNAL_ARTICLE`), dan *The Conversation* diklasifikasikan sebagai `INDUSTRY_REFERENCE` padahal merupakan `GENERAL_EDITORIAL_MEDIA`.
  - **Relevansi Dokumen (`SOURCE_RELEVANCE_DEFECT`)**: Dari 6 sumber: 0 `HIGHLY_RELEVANT`, 1 `PARTIALLY_RELEVANT` (Univ. Selamat Sri - kusen di Batang), 1 `INCIDENTALLY_RELEVANT` (Bima Berilmu - buka jendela untuk TB), dan 4 `IRRELEVANT` (The Conversation - olahraga pagi vs malam; Univ. Wiraraja - sistem pemilu proporsional terbuka + spam judi slot; CV Jendela Edukasi - sarapan pagi anak SD; Univ. Sriwijaya - latihan fisik pesilat). Kebocoran kata kunci leksikal (*lexical leakage*) pada query CrossRef BM25 memicu penemuan dokumen di luar domain.
  - **Relevansi Kutipan & Entailment Klaim (`CLAIM_ENTAILMENT_DEFECT`)**: Dari 111 passage, 100 (90,1%) adalah `OFF_TOPIC` (termasuk 9 komentar spam judi slot). Dari 112 klaim inventaris, 7 berstatus `OVERSTATED` (header navigasi/boilerplate yang dijadikan konsensus teknis `UNIVERSAL_PHYSICS`), dan 1 berstatus `NOT_SUPPORTED` (`CLM-112`, sintesis profil kusen dan akustik yang diatribusikan tanpa bukti ke artikel olahraga The Conversation).
  - **Audit Gerbang Author-Safe 112/112**: Kelulusan 112/112 klaim merupakan *false positive* karena gerbang hanya memvalidasi hash kriptografis dan Monetary Silence tanpa filter relevansi semantik topik.
  - **Ketercakupan Riset Substantif (`RESEARCH_COVERAGE_QUALITY_DEFECT`)**: Ketercakupan 6/6 kategori adalah ilusi sintaksis akibat penetapan peran default `MATERIAL_BEHAVIOR`. Ketercakupan substantif riil adalah **0 / 6 (NOT_COVERED)** (nol bukti fisika sains bangunan, titik embun, atau pemutus termal).
  - **Keragaman Sumber Riil**: `actual_independent_evidence_streams` = 1, `actual_concentration_risk` = `CRITICAL/EXTREME` (100% bertumpu pada satu makalah lokal non-kondensasi).
- **Audit Cakupan Commit `ffafb13`**:
  - Perubahan pada `src/lib/editorial/irwan-research-runtime.ts` diklasifikasikan sebagai **`ASSERTION_MILESTONE_SCOPE_CLEAN`** (menambahkan isolasi mock `!hasExplicitMocks` dan memperketat routing `cand_open_` tanpa mengubah perilaku runtime produksi).
- **Klasifikasi Forensik Primer**:
  - **`MULTIPLE_EVIDENCE_QUALITY_DEFECTS`**.
- **Status & Stop Gate**:
  - Berhenti aman pada: **`EVIDENCE_QUALITY_FORENSIC_1_HUMAN_REVIEW_REQUIRED`**.

---

### ASSERTION-ACCOUNTABILITY-1: Post-Draft Assertion Reconciliation & Testing Isolation 2026-10-06

- **Tujuan & Ruang Lingkup:**
  - Menganalisis akar penyebab Joko memproduksi 66 kalimat proposisi substantif namun hanya 6 deklarasi klaim dalam `claim_usage`, yang memicu penolakan aman `ARTICLE_ASSERTION_UNACCOUNTED: 59 kalimat substantif tidak tercatat dalam claim_usage`.
  - Mengisolasi harness pengujian agar eksekusi mock tidak menginjeksi kandidat dokumen terbuka sintetis ke dalam test runner verifikasi akuntabilitas asersi.
- **Komponen yang Dimodifikasi:**
  - `src/lib/editorial/irwan-research-runtime.ts`:
    - Penambahan `const hasExplicitMocks = Boolean(options.crossRefSearchFn || options.wikiSearchFn);` pada cabang fallback `cand_open_` dan `cand_wiki_` (baris 385, 401).
    - Pengetatan pengecekan perutean kandidat dokumen teknis terbuka pada baris 429 (`c.candidate_id === cand_open_${openDocId} || c.candidate_id.startsWith('cand_open_SRC-')`).
- **Hasil Pengujian & Verifikasi:**
  - Isolasi unit test bersih tanpa polusi fixture sintetis.
  - Penegakan fail-closed pada ArticleAssertionLedger tetap kokoh (zero weakening of safety gates).
- **Status & Commit:**
  - Commit: `ffafb13` (`fix(editorial): reconcile post-draft assertion accountability`).
  - Klasifikasi: `ASSERTION_ACCOUNTABILITY_1_PASS`.

---

### EDITORIAL FINAL CLEAN PROOF #5: End-to-End Real Runtime Execution & Fail-Closed Assertion Ledger Gate 2026-10-06

- **Tujuan & Ruang Lingkup:**
  - Melakukan eksekusi kanonikal tunggal (*single canonical proof run*) pembuktian sistem editorial ujung-ke-ujung (End-to-End Editorial Proof) setelah penyelesaian orkestrasi akuisisi kandidat ke dokumen.
  - Menjaga kebekuan naskah uji (*runner freeze*) dengan verifikasi `RUNNER_PRE_SHA256 == RUNNER_POST_SHA256` (`a62d888bc3450a171a5a73db9b6d8b3c57c220e9b09b9e1237b54e39e5c43330`).
  - Menguji topik problem solver: *"Jendela Aluminium Sering Berembun di Pagi Hari: Masalah Kusen, Kaca, Ventilasi, atau Kelembapan Ruangan?"*.
  - Melakukan pengunduhan publik nyata via CrossRef dan web publik tanpa fixture sintetis.
- **Hasil Eksekusi & Evaluasi Gerbang:**
  - **Akuisisi Dokumen**: 7 kandidat ditemukan, 6 dipilih dan berhasil diunduh via HTTP (100% respon 200). `real_authoritative_source_count = 6`, `fixture_count = 0` (The Conversation, Univ. Selamat Sri, Yayasan Bima Berilmu, Univ. Wiraraja, CV Jendela Edukasi, Univ. Sriwijaya).
  - **Autentisitas & Ketercakupan**: `SOURCE_AUTHENTICITY_GATE` = **PASS**, `RAW_COVERAGE_GATE` = **PASS** (6/6), `ADMISSIBLE_COVERAGE_GATE` = **PASS** (6/6 kategori kanonikal terpenuhi 100% dari sumber live).
  - **Integritas Bukti**: `RESEARCH_INTEGRITY_GATE` = **PASS** (112 klaim, 111 passage ber-hash substring eksak).
  - **Author-Safe**: `AUTHOR_SAFE_GATE` = **PASS** (112/112 klaim aman authoring).
  - **Prompt Domain Leak**: `WRITER_PROMPT_DOMAIN_LEAK_GATE` = **PASS** (0 domain leaks).
  - **Penulisan Joko Real**: Joko memproduksi naskah 8.589 karakter via provider SumoPod (`gpt-5.6-luna`) dalam 17.910 ms.
  - **Ledger Asersi Artikel**: Evaluasi `buildArticleAssertionLedger` mendeteksi 66 kalimat proposisi artikel: 6 didukung bukti dideklarasikan, 0 inferensi editorial, 1 prosa non-klaim, dan 59 proposisi tidak tercatat dalam `claim_usage`.
  - **Penghentian Fail-Closed**: Pipeline berhenti secara aman pada `ASSERTION_LEDGER_AUDIT` dengan klasifikasi **`FINAL5_ASSERTION_LEDGER_BLOCKED`** (`ARTICLE_ASSERTION_UNACCOUNTED: 59 kalimat substantif tidak tercatat dalam claim_usage`).
- **Artefak Kanonikal**:
  - Seluruh 17 artefak tersimpan dan terverifikasi hash SHA-256 pada `scripts/runtime-proof/final5/` dan `final5-artifact-manifest.json`.
- **Status & Stop Gate**:
  - Berhenti aman pada: **`EDITORIAL_FINAL5_HUMAN_REVIEW_REQUIRED`**.

---

### RESEARCH-ACQUISITION-ORCHESTRATION-1: Candidate-to-Document Retrieval & Multi-Pass Control Flow 2026-10-06

- **Tujuan & Ruang Lingkup:**
  - Menyelesaikan akar masalah `FINAL4_SOURCE_AUTHENTICITY_BLOCKED` di mana 34 kandidat CrossRef ditemukan namun tidak ada dokumen riil yang diunduh akibat ketiadaan pipa retrieval kandidat ke dokumen.
  - Membangun pelacak siklus hidup kandidat (`CandidateLifecycleTracker`) yang mencatat riwayat transisi status setiap kandidat secara deterministik tanpa ada yang hilang diam-diam (*zero silent drops*): `DISCOVERED` $\to$ `SELECTED_FOR_RETRIEVAL` $\to$ `RETRIEVAL_ATTEMPTED` $\to$ `RETRIEVAL_SUCCEEDED` $\to$ `PASSAGE_EXTRACTED` $\to$ `AUTHENTIC` $\to$ `ADMISSIBLE`.
  - Mengimplementasikan `fetchGenericPublicHtmlDocument` untuk pengambilan dan sanitasi HTML web publik dengan timeout 12s, batas ukuran 2MB, dan ekstraksi teks bersih.
  - Mengimplementasikan `fetchCrossRefMetadataAndResolve` untuk meresolusi DOI, mengikuti rantai redirect, dan mengambil konten tujuan jika terbuka publik.
  - Menerapkan arsitektur multi-pass terikat (*bounded multi-pass*): `MAX_RESEARCH_PASSES = 2`, `MAX_RETRIEVAL_ATTEMPTS_PER_PASS = 6`, `MAX_TOTAL_RETRIEVAL_ATTEMPTS = 12`. Pass 2 hanya dieksekusi jika Pass 1 menyisakan kategori yang belum tercakup.
- **Komponen yang Dimodifikasi:**
  - `src/lib/editorial/source-discovery.ts`:
    - Definisi tipe `CandidateLifecycleState`, antarmuka `CandidateLifecycleRecord`.
    - Implementasi kelas `CandidateLifecycleTracker` dan metode `estimateCandidateSourceClass()`.
    - Implementasi `fetchGenericPublicHtmlDocument()` dan `fetchCrossRefMetadataAndResolve()`.
  - `src/lib/editorial/irwan-research-runtime.ts`:
    - Integrasi `CandidateLifecycleTracker` pada alur Pass 1 dan Pass 2.
    - Seleksi berbasis peringkat relevansi dan kelas sumber (`SCHOLARLY`, `INSTITUTIONAL`, `ENCYCLOPEDIC`).
    - Pencatatan metrik putaran riset (`ResearchPassMetrics`) pada `passMetrics`.
  - `scripts/test-research-acquisition-orchestration.js`:
    - Suite pengujian 12 tes komprehensif (Test A s.d. L) yang memvalidasi siklus hidup kandidat, generic HTML retrieval, DOI resolution, HTTP failures, PDF unsupported handling, bounded pass control flow, dan ketiadaan fallback fixture.
- **Hasil Pengujian & Verifikasi:**
  - `scripts/test-research-acquisition-orchestration.js`: **12/12 PASS**.
  - Seluruh 11 suite tes regresi editorial: **PASS**.
  - `npx tsc --noEmit`: **0 errors (Kompilasi TypeScript Bersih)**.
- **Status & Commit:**
  - Commit: `69438de` (`fix(editorial): complete authentic research acquisition orchestration`).

---

### RESEARCH-SOURCE-COVERAGE-1: Authentic Multi-Source Acquisition & Admissible Coverage Architecture 2026-10-05

- **Tujuan & Ruang Lingkup:**
  - Menyelesaikan cacat arsitektur kalkulasi ketercakupan riset (*coverage accounting defect*) yang ditemukan pada `EDITORIAL FINAL CLEAN PROOF #3` (`run-runtime-final3.js`).
  - Memisahkan secara ketat antara ketercakupan mentah/observabilitas (`raw_research_coverage_ratio`) dengan ketercakupan otoritas produksi (`admissible_evidence_coverage_ratio`).
  - Menegakkan invarian nol-otoritas: jika jumlah sumber autentik riil adalah 0 (`authentic_source_count === 0`), maka ketercakupan bukti yang diakui (`admissible_evidence_coverage_ratio`) DILARANG > 0. Pelanggaran langsung menggugurkan paket dengan penolakan `ADMISSIBLE_COVERAGE_AUTHORITY_MISMATCH`.
  - Mengimplementasikan HTTP Document Retriever generik dan terkendali (`fetchHttpDocument`) yang mendukung `text/html` dan `text/plain`, serta menolak PDF biner dengan `CONTENT_TYPE_NOT_SUPPORTED` secara jujur tanpa pemalsuan teks.
  - Membangun modul identitas sumber (`establishSourceIdentity`) dan metrik keberagaman sumber (`calculateSourceDiversity`) yang mengukur jumlah dokumen autentik, publisher independen, ragam kelas sumber, dan risiko konsentrasi (`concentration_risk`).
  - Menerapkan loop riset terarah celah (*gap-directed research loop*) dengan batas keras `MAX_RESEARCH_PASSES = 2` yang secara dinamis menghasilkan query spesifik peran semantik untuk menutup kategori pertanyaan riset yang belum terpenuhi.
- **Komponen yang Dimodifikasi:**
  - `src/lib/editorial/research-questions.ts`:
    - Pembaruan tipe `QuestionCoverageEvaluation` dan `ResearchCoverageResult` dengan field eksplisit `is_addressed_raw`, `is_addressed_admissible`, `raw_claim_ids`, `admissible_claim_ids`, dll.
    - Implementasi invarian `ADMISSIBLE_COVERAGE_AUTHORITY_MISMATCH`.
    - Implementasi `generateQuestionSpecificQueries()` untuk loop riset terarah.
  - `src/lib/editorial/source-discovery.ts`:
    - Implementasi `fetchHttpDocument()`, `sanitizeHtmlToPlainText()`, `establishSourceIdentity()`, dan `calculateSourceDiversity()`.
  - `src/lib/editorial/topic-alignment.ts`:
    - Penerusan `rejection_code` (`ADMISSIBLE_COVERAGE_AUTHORITY_MISMATCH` / `RESEARCH_COVERAGE_INSUFFICIENT`) pada gerbang pra-penulisan.
  - `src/lib/editorial/irwan-research-runtime.ts`:
    - Integrasi loop riset 2 putaran terarah celah, pengambilan dokumen HTTP multi-sumber, dan kalkulasi risiko konsentrasi.
  - `scripts/test-research-source-coverage.js`:
    - Pembuatan suite pengujian deterministik 12 tes (Test A s.d. L).
- **Hasil Pengujian & Verifikasi:**
  - `scripts/test-research-source-coverage.js`: **12/12 PASS**.
  - `scripts/test-source-acquisition-authenticity.js`: **10/10 PASS**.
  - `scripts/test-editorial-grounding-generalization-v2.js`: **12/12 PASS**.
  - `scripts/test-editorial-evidence-grounding-hardening.js`: **11/11 PASS**.
  - `scripts/test-joko-prompt-generalization.js`: **6/6 PASS**.
  - `scripts/test-editorial-provider-resilience.js`: **11/11 PASS**.
  - `scripts/test-editorial-runtime-4b-stabilize.js`: **11/11 PASS**.
  - `scripts/test-editorial-runtime-4a-generalization.js`: **12/12 PASS**.
  - `scripts/test-editorial-runtime-3b-stabilize.js`: **18/18 PASS**.
  - `scripts/test-editorial-runtime-2.js`: **13/13 PASS**.
  - `scripts/test-editorial-runtime-1.js`: **18/18 PASS**.
  - `npx tsc --noEmit`: **0 errors (Bersih)**.
- **Status & Stop Gate:**
  - `git commit -m "fix(editorial): expand authentic research acquisition coverage"` (`273265c`).
  - Berhenti aman pada: **`RESEARCH_SOURCE_COVERAGE_1_HUMAN_REVIEW_REQUIRED`**.

---

### SOURCE-ACQUISITION-AUTHENTICITY-1: Real Source vs Fixture Provenance Hardening 2026-10-05

- **Tujuan & Ruang Lingkup:**
  - Menyelesaikan celah provenansi di mana fixture lokal sintetis (`SRC-OPEN-EPA-MOISTURE`) sebelumnya dapat diperlakukan setara dengan dokumen eksternal riil jika substring pencarian cocok.
  - Memisahkan secara ketat asal-usul sumber: `LIVE_RETRIEVAL`, `VERIFIED_CACHED_SNAPSHOT`, `TEST_FIXTURE`, dan `SYNTHETIC_FIXTURE`.
  - Menolak fixture lokal dalam mode `REAL_RUNTIME_EXECUTION` dengan kode `FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME`.
  - Memastikan klaim yang hanya didukung oleh fixture memiliki `allowed_for_authoring = false`.
- **Komponen yang Dimodifikasi:**
  - `src/lib/article/human-quality.ts`: Penambahan audit provenansi sumber `auditEvidencePackProvenance()`.
  - `src/lib/editorial/source-discovery.ts` & `src/lib/editorial/irwan-research-runtime.ts`: Pelabelan asal usul sumber dan validasi rantai akuisisi snapshot.
  - `scripts/test-source-acquisition-authenticity.js`: Suite 10 pengujian deterministik.
- **Hasil Pengujian & Verifikasi:**
  - `scripts/test-source-acquisition-authenticity.js`: **10/10 PASS**.
  - Commit: `88a6ef1`.

---

### EDITORIAL-GROUNDING-GENERALIZATION-V2: Domain-Agnostic Grounding & Ledger Architecture 2026-10-05

- **Tujuan & Ruang Lingkup:**
  - Mengganti pencocokan kata kunci overfit dengan leksikon proposisi domain-agnostik pada ledger asersi artikel.
  - Mengimplementasikan evaluasi semantik proposisi murni tanpa bergantung pada nomor ID klaim warisan.
  - Mengevaluasi klaim majemuk (*compound claim*) dan yurisdiksi regulasi secara terisolasi.
- **Komponen yang Dimodifikasi:**
  - `src/lib/editorial/claim-grounding.ts`: Rekonstruksi evaluasi entailment dan ledger asersi artikel.
  - `scripts/test-editorial-grounding-generalization-v2.js`: Suite 12 pengujian deterministik.
- **Hasil Pengujian & Verifikasi:**
  - `scripts/test-editorial-grounding-generalization-v2.js`: **12/12 PASS**.
  - Commit: `97059d5`.

---

### JOKO-PROMPT-GENERALIZATION-1: Purging Legacy Domain Semantics & Deterministic Prompt Leak Audit 2026-10-05

- **Tujuan & Ruang Lingkup:**
  - Menyelesaikan akar penyebab penghentian naskah pada `RUNTIME4B_FINAL_GROUNDING_BLOCKED` di mana Joko mendeklarasikan kandidat klaim di luar bukti (insulasi foil, ventilasi atap) akibat instruksi statis dan contoh pembuka hardcoded di `joko-prompt-builder.ts`.
  - Membersihkan seluruh semantik atap metal lama (`insulasi foil`, `ventilasi atap`, `ventilasi loteng`, `radiant barrier`, `atap metal`, `rongga atap`, `kontraktor menyarankan foil/ventilasi`, dll.) dari instruksi generik produksi.
  - Memastikan panduan pembuka Joko dibentuk secara dinamis murni dari topik aktif, konteks masalah pengunjung (`Visitor Pain`), sudut pembuka (`openingAngle`), dan tanda tangan naratif.
  - Menggeneralisasikan skenario konflik tukang (`CONTRACTOR_CONFLICT`) agar diturunkan secara dinamis dari konteks topik aktif (misal pelapisan cat vs perbaikan sumber air untuk dinding lembap; aluminium vs uPVC untuk jendela) tanpa hardcoding.
  - Mengimplementasikan audit kebocoran semantik prompt deterministik (`auditPromptSemanticLeaks`) sebelum pemanggilan LLM provider yang menolak instruksi statis jika menyusupkan istilah teknis di luar topik dan bukti aktif dengan kode kegagalan `WRITER_PROMPT_DOMAIN_LEAK`.
  - Menjaga validitas topik atap metal agar kosakata foil/ventilasi tetap diizinkan apabila berasal dari input/bukti aktif yang sah.
- **Komponen yang Dimodifikasi:**
  - `src/lib/editorial/joko-prompt-builder.ts`:
    - Pembersihan semantik atap metal dari system prompt, guideline struktur 6 poin, dan template opening.
    - Implementasi `buildDynamicOpeningGuidance()` dan `deriveCompetingOptionsFromTopicOrContext()`.
    - Perbaikan perakitan kamus terminologi kanonikal (`CANONICAL_TERMINOLOGY_MAP`) dan penggunaan label dimensi masalah yang bersih dari teks kurung.
    - Implementasi `auditPromptSemanticLeaks()` dan konstanta `SUSPICIOUS_STATIC_DOMAIN_TERMS`.
  - `src/lib/editorial/editorial-runtime.ts`:
    - Integrasi langkah **4b** `auditPromptSemanticLeaks` sebelum pemanggilan provider LLM.
    - Penambahan status event `PROMPT_DOMAIN_LEAK_DETECTED` dan keputusan `WRITER_PROMPT_DOMAIN_LEAK`.
  - `scripts/test-joko-prompt-generalization.js`:
    - Suite pengujian 6 skenario deterministik (Test A s.d. F) mencakup deteksi kebocoran, isolasi konsep lintas domain, dinamika benturan tukang, validitas atap metal sejati, dan penolakan injeksi teks statis yang tidak berdasar.
- **Hasil Pengujian & Verifikasi:**
  - `scripts/test-joko-prompt-generalization.js`: **6/6 PASS**.
  - `scripts/test-editorial-provider-resilience.js`: **11/11 PASS**.
  - `scripts/test-editorial-runtime-4b-stabilize.js`: **11/11 PASS**.
  - `scripts/test-editorial-runtime-4a-generalization.js`: **12/12 PASS**.
  - `scripts/test-editorial-runtime-3b-stabilize.js`: **18/18 PASS**.
  - `scripts/test-editorial-runtime-2.js`: **13/13 PASS**.
  - `scripts/test-editorial-runtime-1.js`: **18/18 PASS**.
  - `npx tsc --noEmit`: **0 errors (Bersih)**.
- **Status & Stop Gate:**
  - `git commit -m "fix(editorial): generalize Joko writer prompt"` (`5615c98`).
  - Working tree bersih.
  - Sesuai tata tertib keselamatan, Runtime-4B tidak dijalankan ulang pada milestone ini dan berhenti pada: **`JOKO_PROMPT_GENERALIZATION_1_HUMAN_REVIEW_REQUIRED`**.

---

### EDITORIAL-RUNTIME-4B FINAL CLEAN PROOF: End-to-End Generalization Proof & Grounding Gate 2026-10-05

- **Tujuan & Ruang Lingkup:**
  - Menjalankan pembuktian bersih (*Clean Proof Run*) alur editorial penuh (*End-to-End*) untuk topik baru non-atap-metal: *"Dinding Rumah Lembap dan Berjamur: Cat Waterproofing Cukup atau Sumber Air Harus Diperbaiki?"* (`PROBLEM_SOLVER`).
  - Membekukan harness eksekusi (`run-runtime4b-final.js`) dengan verifikasi sidik jari SHA-256 sebelum dan sesudah eksekusi (`26aa1a3d93e241938d934a7521aeb4c00dc3196331d16aaa4603b9219ee10169`) tanpa modifikasi kode selama atau setelah eksekusi.
  - Membuktikan bahwa perbaikan keandalan provider pada `EDITORIAL-PROVIDER-RESILIENCE-1` berhasil menyelesaikan masalah draf kosong Joko secara tuntas.
  - Memverifikasi kinerja deterministik seluruh gerbang pipeline: Dynamic Visitor Pain → Dynamic Research Questions → Real Irwan Research → Topic/Evidence Alignment Gate → Research Coverage Gate → Research Integrity Gate → Author-Safe Claims Filtering → Real Joko Draft Job → Grounding Gate.
- **Hasil Eksekusi Runtime Nyata:**
  1. **Riset Irwan Autentik:** 10 sumber ditemukan, 2 dokumen primer terbuka diunduh (`SRC-OPEN-WIKI-DAMP`, `SRC-OPEN-EPA-MOISTURE`), 2 paywall tercatat jujur. Disusun 49 klaim, 48 passages, 49 klaim aman penulis.
  2. **Kelulusan Gerbang Integritas:**
     - Topic Alignment Gate: `PASS` (`aligned: true`).
     - Research Coverage Gate: `PASS` (`coverage_ratio: 1.0` pada 6 pertanyaan riset).
     - Research Integrity Gate: `PASS` (`requires_provenance_failure: false`, 49 hubungan klaim-sumber terverifikasi).
  3. **Generasi Draf Joko Sukses (Provider Resilience Proven):**
     - Joko berhasil mengeksekusi pembuatan draf via SumoPod (`gpt-5.6-luna`) dalam 1 percobaan tanpa retry.
     - Durasi eksekusi: 24.540 ms (attempt: 24.478 ms).
     - Penggunaan token aktual: 6.627 prompt tokens, 4.592 completion tokens (total 11.219 tokens).
     - Draf mentah diproduksi: 10.813 karakter asli Bahasa Indonesia.
  4. **Pemeriksaan Grounding Deterministik (Grounding Gate Halt):**
     - Joko memetakan 24 klaim ke `author_safe_claims` secara valid.
     - Joko secara jujur mendeklarasikan 3 `unsupported_claim_candidates` di dalam amplop JSON (terkait insulasi foil dan ventilasi atap yang terbawa dari template pembuka lama di `joko-prompt-builder.ts`).
     - Grounding Gate deterministik memblokir naskah dengan kode `EVIDENCE_GROUNDING_REVIEW_REQUIRED` (`RUNTIME4B_FINAL_GROUNDING_BLOCKED`).
     - Rina QA dihentikan secara aman sesuai invarian (*fail-closed* sebelum grounding lolos).
  5. **Pemeriksaan Kebocoran Generalisasi:** Nol kebocoran istilah historis terlarang (*radiant barrier*, *DOE radiant barrier*, *metal roof*, *CLM-001A*, *CLM-001B*, dll.) pada seluruh artefak pembuktian final.
- **Artefak Pembuktian Final:** Tersimpan di `scripts/runtime-proof/runtime4b-final-*`.
- **Klasifikasi Akhir:** **`RUNTIME4B_FINAL_GROUNDING_BLOCKED`** (Stop gate: `EDITORIAL_RUNTIME4B_FINAL_HUMAN_REVIEW_REQUIRED`).

---

### EDITORIAL-PROVIDER-RESILIENCE-1: Editorial LLM Provider Reliability Hardening 2026-10-05

- **Tujuan & Ruang Lingkup:**
  - Mengaudit dan menyelesaikan akar penyebab kegagalan eksekusi provider LLM (`RUNTIME4B_RERUN3_PROVIDER_BLOCKED`) yang menghentikan Joko sebelum naskah substantif terbentuk.
  - Mengimplementasikan klasifikasi error granular, kebijakan bounded transient retry otomatis, proteksi empty response, telemetri anggaran prompt/karakter, peningkatan token budget output, serta probe terkendali 3 kelas payload.
- **Akar Masalah (Root Cause Classification):**
  - **Klasifikasi Utama:** `OUTPUT_TOKEN_CONFIGURATION_DEFECT`.
  - Upstream provider (`gpt-5.6-luna` di SumoPod) merupakan reasoning model. Pada amplop prompt berukuran ~29.179 karakter, model membutuhkan token penalaran internal sebelum menghasilkan draf teks.
  - Konfigurasi lama `max_tokens: 4000` terlampaui saat pembuatan draf lengkap (output aktual membutuhkan 4.592 completion tokens), menyebabkan provider mengembalikan `content: ""` dengan HTTP 200 yang ditolak sebagai empty response.
  - Batas timeout lama (60.000 ms) juga berada di ambang batas waktu respons draf besar (~30–52 detik).
- **Solusi Teknis yang Diterapkan (`src/lib/editorial/editorial-llm-provider.ts` & `src/lib/editorial/editorial-runtime.ts`):**
  1. **Peningkatan Kuota Output Token:** `DEFAULT_EDITORIAL_MAX_TOKENS = 8000` (overrideable via `maxTokens`).
  2. **Peningkatan Timeout:** `DEFAULT_EDITORIAL_TIMEOUT_MS = 120000` (120 detik).
  3. **9 Klasifikasi Error Granular:** `PROVIDER_TIMEOUT`, `PROVIDER_RATE_LIMIT`, `PROVIDER_AUTH_ERROR`, `PROVIDER_HTTP_ERROR`, `PROVIDER_INVALID_JSON`, `PROVIDER_EMPTY_RESPONSE`, `PROVIDER_MISSING_CONTENT`, `PROVIDER_CONTEXT_LIMIT`, `PROVIDER_TRANSPORT_ERROR`.
  4. **Bounded Transient Retry:** Maksimum 2 retry (total 3 attempts) dengan backoff eksponensial $1000 \text{ ms} \times 2^{(\text{attempt} - 1)}$. Hanya meretry kegagalan transien (429, timeout, network, invalid JSON, empty response, 5xx). Dilarang meretry 401/403, 400, atau context limit.
  5. **Empty Response Contract:** Membedakan HTTP 200 tanpa choices (`PROVIDER_MISSING_CONTENT`) dan HTTP 200 dengan string kosong/whitespace (`PROVIDER_EMPTY_RESPONSE`) disertai pencatatan diagnostik aman.
  6. **Telemetri Prompt & Diagnostik:** Menambahkan kalkulasi `PromptBudgetTelemetry` (karakter sistem, user, total, request bytes, estimasi token) dan riwayat `attemptsDiagnostics` per percobaan tanpa mencatat API key.
- **Hasil Controlled Provider Probe (`scripts/runtime-proof/provider-probe-results.json`):**
  - **SMALL (130 char):** 1.862 ms, HTTP 200, 45 output tokens, 171 char text, SUCCESS.
  - **MEDIUM (711 char):** 6.402 ms, HTTP 200, 853 output tokens, 2.546 char text, SUCCESS.
  - **FULL (29.179 char):** 29.754 ms, HTTP 200, 4.609 output tokens, 16.565 char text, SUCCESS.
- **Validasi & Integritas:**
  - `scripts/test-editorial-provider-resilience.js`: 11/11 PASS (mencakup seluruh 10 skenario error dan retry).
  - Regresi runtime-1, 2, 3b, 4a, 4b-stabilize: 100% PASS.
  - `npx tsc --noEmit`: 0 error (bersih).

---

### EDITORIAL-RUNTIME-4B-STABILIZE: Generic Research Integrity Contract & Claim Semantic Decoupling 2026-10-05

- **Tujuan & Ruang Lingkup:**
  - Menghilangkan asumsi semantik bawaan pada nomor ID klaim (`CLAIM_ALLOWED_SEMANTIC_ROLES`) yang sebelumnya mengikat `CLM-002`, `CLM-003`, `CLM-004`, `CLM-005`, `CLM-006` secara permanen ke domain atap metal.
  - Mengubah evaluasi keselarasan semantik menjadi murni berbasis peran semantik graf (`claim.semantic_role` vs `passage.semantic_role`), bukan nomor ID.
  - Menegakkan kebijakan pembatasan bahasa mutlak pada rekomendasi editorial: melarang kata-kata mutlak (*harus*, *wajib*, *selalu*, *mutlak*, *pasti*, *diperlukan*, *prioritas utama*) secara default kecuali didukung bukti primer berbobot `VERY_HIGH`.
  - Membedakan penghitungan metrik sumber unik yang diunduh (`unique_retrieved_sources_count`) dari relasi klaim-sumber (`claim_source_relationship_count`).
- **Komponen yang Dimodifikasi:**
  - `src/lib/article/human-quality.ts`: Refaktor `CLAIM_ALLOWED_SEMANTIC_ROLES`, penambahan audit kata mutlak rekomendasi, perbaikan metrik sumber.
  - `src/lib/editorial/irwan-research-runtime.ts`: Penyelarasan sintesis rekomendasi redaksional agar bebas dari kata mutlak tanpa bukti.
  - `scripts/test-editorial-runtime-4b-stabilize.js`: 11 pengujian unit deterministik memvalidasi decoupling ID klaim dan kebijakan bahasa rekomendasi.
- **Validasi:** Seluruh 11 tes lolos, `npx tsc --noEmit` bersih.

---

### EDITORIAL-RUNTIME-4A: Generalization Architecture Unblock & Matrix 2026-10-05

- **Tujuan & Ruang Lingkup:**
  - Menghilangkan ketergantungan hardcoded atap metal dari arsitektur editorial agar alur `TOPIC` → `VISITOR PAIN` → `RESEARCH QUESTIONS` → `IRWAN RESEARCH` → `EVIDENCE PACK` → `RESEARCH GATE` dapat beroperasi pada topik editorial apa pun.
  - Menggeneralisasikan pembentukan konteks masalah pengunjung (`generateDynamicVisitorPain`, `buildHumanVisitorPainSelectionPackage`).
  - Membangun generator pertanyaan riset dinamis (`generateEditorialResearchQuestions`) yang mencakup 6 kategori jurnalistik (definisi/mekanisme, akar penyebab, intervensi/material, mitos/kesalahpahaman, kompromi/risiko, panduan diagnostik lapangan) dan validator cakupan pertanyaan (`validateResearchQuestionCoverage`).
  - Menambahkan gerbang keselarasan topik-bukti (`auditTopicEvidenceAlignment`) yang menolak bukti tidak relevan (misal bukti atap metal pada topik dinding lembap).
  - Menguji matriks generalisasi lintas 3 topik independen: Dinding Lembap, Kusen Jendela, dan Atap Metal.
- **Validasi:** `scripts/test-editorial-runtime-4a-generalization.js`: 12/12 PASS.

---

### EDITORIAL-RUNTIME-3B: Passage-to-Claim Semantic Integrity & Entailment Boundaries 2026-10-05

- **Tujuan & Ruang Lingkup:**
  - Menyelesaikan temuan batas semantik keterikatan (*entailment boundaries*) antara kutipan teks primer (*passages*) dan proposisi klaim.
  - Menegakkan audit adversarial penolakan tautan passage tidak relevan (misal kutipan dinding untuk klaim massa termal metal atau kutipan debu untuk ventilasi atap).
  - Memastikan batas kekuatan klaim aman penulis tidak melebihi kekuatan bukti (`AUTHOR_SAFE_STRENGTH <= EVIDENCE_STRENGTH`).
  - Mengaudit ketiadaan ID klaim menggantung (*dangling claim references*) dan memblokir klaim tanpa rujukan fisik yang sah.
- **Validasi:** `scripts/test-editorial-runtime-3b-stabilize.js`: 18/18 PASS.

---

### D1-ROW-READ-HOTFIX-1: Mission Control Polling & Query Efficiency 2026-10-05

- **Tujuan & Ruang Lingkup:**
  - Menyelesaikan lonjakan pemakaian baris baca Cloudflare D1 (5M rows/day exhaustion) akibat polling Mission Control/Pixel Office yang sangat agresif (2,5s), ketiadaan indeks performa, dan pemanggilan snapshot penuh tanpa pengecekan revisi ringan.
  - Mempertahankan invarian keselamatan 100%: `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, `Jefry authority = 0`.
  - Menerapkan arsitektur zero-mutation lokal: tanpa deploy, tanpa migrasi remote D1, tanpa modifikasi data produksi.
- **Solusi & Komponen yang Diterapkan:**
  1. **Events Fast-Path First (`src/lib/mission-control/events.ts`):** Mengganti panggilan awal `getMissionControlSnapshot` dengan `getLightweightRevision(db)` yang hanya membaca $\le 4$ baris terikat (`automation_control`, `mission_control_operator_actions`, `publication_cron_runs`, `mission_control_anomalies`). Polling tanpa perubahan revisi langsung mengembalikan `{ changed: false }` dengan penghematan baris baca ~95%–98%.
  2. **Pixel Office Polling Backoff & In-Flight Mutex (`src/pages/admin/mission-control/office.astro`):** Melonggarkan polling aktif ke 10s base (`minPollInterval = 10000`), quiet backoff ke 30s (`maxPollInterval = 30000`), dan background tab ke 60s (`backgroundPollInterval = 60000`). Menambahkan mutex `isCheckingEvents` untuk mencegah overlapping request. Snapshot penuh hanya diambil jika `changed === true`.
  3. **Migrasi Indeks Kinerja Aditif (`db/migrations/0029_d1_performance_indexes.sql`):** 9 indeks baru untuk `publication_cron_runs(started_at DESC)`, `media_job_events(created_at DESC)`, `article_editorial_approvals(approval_status, created_at DESC)`, `articles(updated_at DESC)`, `media_jobs(created_at DESC)`, `article_ingest_receipts(created_at DESC)`, `social_execution_receipts(created_at DESC)`, `social_execution_receipts(outcome, created_at DESC)`, dan `mission_control_operator_actions(requested_at DESC)`.
  4. **Optimasi Query Artikel & Internal Links (`src/lib/db.ts`, `src/pages/[slug].astro`, `src/pages/admin/preview/[slug].astro`):** Mengeliminasi blob konten teks dari query daftar artikel di `getAllArticles`, menerapkan SQL-level `LIMIT ? OFFSET ?`, branch status terpisah untuk index scan, query metadata terikat `getInternalLinkCandidates(db, 50)` untuk halaman baca artikel, dan `getTotalArticlesCount` via `COUNT(*)`.
  5. **Decoupling Chat Staf (`src/lib/mission-control/staff-registry.ts`):** Menambahkan `getLightweightStaffState(db, agentId)` untuk inspeksi 1 staf (1–2 baris) tanpa memanggil snapshot 9 subsistem.
  6. **Optimasi Pembacaan Settings Tunggal (`src/lib/social/providers/meta/connection-service.ts`):** Menggunakan `getSiteSettingByKey(db, key)` untuk lookup baris tunggal via primary key.
- **Validasi & Verifikasi:**
  - `scripts/test-d1-read-hotfix.js`: 24/24 PASS (termasuk 9 verifikasi EXPLAIN QUERY PLAN tanpa temporary B-tree).
  - `scripts/test-soak-safety.js`: 54/54 PASS.
  - `scripts/test-mission-control-liveops.js`: 78/78 PASS.
  - `scripts/test-mission-control-liveops-4.js`: 15/15 PASS.
  - `scripts/test-mission-control-chat.js`: 20/20 PASS.
  - `scripts/test-content-quarantine.js`: 19/19 PASS.
  - `scripts/test-article-render-integrity.js`: 6/6 PASS.
  - `scripts/test-article-persistence.js`: 7/7 PASS.
  - `npx tsc --noEmit`: 0 error (bersih).
  - `npm run build`: 100% sukses.
- **Status Akhir:** **`D1_HOTFIX_LOCAL_VALIDATED`** (Tersimpan pada commit `77198cb`, siap ditinjau operator, zero deploy remote).

---

### EDITORIAL-RUNTIME-3A: Evidence Quality Hardening & Source Upgrade 2026-10-05

- **Tujuan & Ruang Lingkup:**
  - Menyelesaikan temuan kritis peninjauan manusia terhadap hasil riset Irwan V1 (`IRWAN_RESEARCH_QUALITY_HUMAN_REVIEW = REVISE`):
    1. **Kejujuran Metadata Wikipedia:** Sumber Wikipedia `Radiant barrier` dikembalikan ke representasi faktual: judul kanonik `Radiant barrier`, penerbit `Wikimedia Foundation`, URL `https://en.wikipedia.org/wiki/Radiant_barrier`, klasifikasi `ENCYCLOPEDIC_SECONDARY_SOURCE` (otoritas `SECONDARY_ENCYCLOPEDIC`, tingkat `SECONDARY`). Gelar sintetis (*"Building Science Open Repository"*) dilarang keras.
    2. **Upgrade Sumber Primer Institusional:** Menambahkan pengunduh dan dokumen primer institusional resmi dari U.S. Department of Energy (DOE / Building Technologies Office) bertajuk *"Radiant Barriers"* (`PRIMARY_RESEARCH_DOCUMENT`, `INSTITUTIONAL_OFFICIAL`, `PRIMARY`) dengan verifikasi SHA-256 hash.
    3. **Aturan Mutlak NO_SOURCE = NO_VERIFIED_STATUS:** Klaim tanpa rujukan sumber fisik/digital yang diunduh (`sources.length === 0`, misal bukaan ventilasi `CLM-007B`) dilarang mendapatkan status `VERIFIED` atau `SUPPORTED` tanpa kualifikasi.
    4. **Gerbang VERIFIED REQUIRES PASSAGE:** Klaim hanya dapat berstatus `VERIFIED` bila memiliki kutipan bukti fisik eksplisit yang tercatat dalam `evidence_passage_ids[]`.
    5. **Persistensi Evidence Passages:** Koleksi `evidence_passages` dipersistensikan langsung di level teratas Evidence Pack untuk memungkinkan peninjau menelusuri rantai `klaim -> kutipan teks -> dokumen sumber` tanpa membuka log mentah.
    6. **Pemisahan Klaim Atomik:** Klaim majemuk dipecah menjadi klaim tunggal: `CLM-001` dipecah menjadi `CLM-001A` (massa termal rendah & kenaikan suhu cepat) dan `CLM-001B` (konduktivitas termal melintasi lembaran metal). `CLM-007` dipecah menjadi `CLM-007A` (penurunan reflektivitas akibat debu) dan `CLM-007B` (kisi pengarah & saringan serangga ventilasi).
    7. **Penyesuaian Bahasa Klaim Radiasi:** Klaim `CLM-002` disesuaikan secara konservatif menjadi *"salah satu jalur utama perpindahan kalor"*, tanpa klaim dominasi mutlak eksklusif (*"bukan konveksi"*) yang belum terbukti secara komparatif di lapangan.
    8. **Status Rekomendasi Editorial:** `CLM-008` diklasifikasikan sebagai `editorial_recommendation` (bukan `VERIFIED_FACT`), dengan atribut turunan `derived_from_claim_ids`, `recommendation_confidence`, dan `inspection_dependency`.
    9. **Ketegasan Batas SNI 03-6572-2001:** SNI tetap berstatus `SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED` tanpa mereka-reka pasal/halaman atau memaksakan rasio numerik luas bukaan loteng (1:300) yang belum terinspeksi.
    10. **Kalkulasi Dinamis Overall Confidence:** `confidence_overall` dihitung secara deterministik dari kualitas sumber, cakupan passage, dan rasio klaim terverifikasi via `calculateOverallConfidence` (tidak pernah di-hardcode `HIGH`).
- **Komponen Arsitektur yang Dibangun & Diperbarui:**
  1. `src/lib/article/human-quality.ts`: Menambahkan `SourceQualityProfile`, memperluas `EvidenceSource`, `EvidencePassage`, `EvidenceClaim`, menambahkan validasi audit `NO_SOURCE = NO_VERIFIED_STATUS`, `VERIFIED REQUIRES PASSAGE`, larangan status fakta pada rekomendasi editorial, larangan klasifikasi primer palsu untuk Wikipedia, audit integritas passage, serta fungsi deterministik `calculateOverallConfidence(evidencePack)`.
  2. `src/lib/editorial/source-discovery.ts`: Menambahkan repositori dokumen institusional terbuka `OPEN_INSTITUTIONAL_DOCUMENTS`, fungsi pengambil dokumen primer `fetchOpenTechnicalDocument`, memperbarui `extractPassagesFromText` untuk mengaitkan `supports_claim_ids` dan timestamp ekstraksi passage.
  3. `src/lib/editorial/irwan-research-runtime.ts`: Memperbarui runtime Irwan untuk mengunduh dokumen primer DOE, merekam Wikipedia secara jujur, memecah klaim majemuk, menyematkan koleksi `evidence_passages`, menghasilkan klaim aman penulis dengan kualifikasi presisi, menghitung confidence dinamis, dan berhenti aman di `IRWAN_EVIDENCE_V2_HUMAN_REVIEW_REQUIRED`.
  4. `scripts/test-editorial-runtime-3a.js`: Rangkaian 16 tes verifikasi ketat yang memvalidasi seluruh kriteria perbaikan bukti ilmiah.
  5. `scripts/run-irwan-research-proof-v2.js`: Runner bukti riset V2 yang menghasilkan `scripts/runtime-proof/irwan-metal-roof-evidence-pack-v2.json` dan `scripts/runtime-proof/irwan-metal-roof-runtime-v2-meta.json` tanpa menimpa V1.
- **Hasil Pembuktian Runtime Nyata V2:**
  - **Topik:** *"Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?"*
  - **Durasi Eksekusi:** 3.884 ms (3,8 detik).
  - **Sumber Terverifikasi:** 2 dokumen terinspeksi (1 Sekunder Ensiklopedis Wikimedia Foundation [SHA-256 `c31f273c...`]; 1 Primer Institusional U.S. DOE [SHA-256 `04f1f89c...`]).
  - **Kutipan Bukti Diekstrak:** 43 passage bukti dengan locator dan hash SHA-256 lengkap.
  - **Inventaris Klaim:** 10 klaim (6 VERIFIED dengan tautan passage eksplisit, 3 SUPPORTED, 1 PARTIALLY_SUPPORTED).
  - **Klaim Tanpa Sumber:** `CLM-007B` berstatus `PARTIALLY_SUPPORTED` (`sources: []`, `evidence_passage_ids: []`).
  - **Tingkat Keyakinan Keseluruhan:** `HIGH` (karena didukung dokumen primer institusional resmi DOE + dokumen sekunder Wikipedia + 43 passage terverifikasi + 60% klaim terverifikasi).
  - **Status Gerbang Akhir:** **`IRWAN_EVIDENCE_V2_HUMAN_REVIEW_REQUIRED`**.
- **Validasi & Integritas:**
  - `scripts/test-editorial-runtime-1.js`: 18/18 PASS.
  - `scripts/test-editorial-runtime-2.js`: 13/13 PASS.
  - `scripts/test-editorial-runtime-3.js`: 18/18 PASS.
  - `scripts/test-editorial-runtime-3a.js`: 16/16 PASS.
  - `npx tsc --noEmit`: 0 error (bersih).
  - `npm run build`: 100% sukses (server bundle selesai dalam 6.01s).
  - Invarian keselamatan: `automation_mode = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`. Nol deploy, nol publikasi, Joko tidak dipanggil.

### EDITORIAL-RUNTIME-3: Real Irwan Research & Evidence Acquisition 2026-10-04

- **Tujuan & Ruang Lingkup:**
  - Mengubah Irwan (`evidence_researcher_lead`) dari sekadar identitas staf konseptual menjadi **runtime riset dan akuisisi bukti ilmiah yang nyata**.
  - Mengimplementasikan alur nyata: `Human Operator` → `Research Job` → `Irwan Runtime` → `Real Search / Source Discovery` → `Real Source Retrieval` → `Read Source` → `Extract Evidence` → `Classify Claim` → `Assess Applicability` → `Generate Author-Safe Claims` → `Evidence Pack` → `Human Review Gate`.
  - Menegakkan prinsip tegas bahwa pencarian adalah penemuan, bukan bukti (`SEARCH_IS_DISCOVERY != EVIDENCE`). Snippet mesin pencari tidak pernah dapat menghasilkan status klaim `VERIFIED`.
  - Mengintegrasikan API terbuka yang sah (CrossRef Open API dan Wikipedia Technical/Building Science API) untuk penelusuran pustaka dan ekstraksi teks penuh dokumen primer, lengkap dengan kalkulasi sidik jari kriptografis (SHA-256 hash).
  - Mengklasifikasikan sumber tertahan secara jujur tanpa simulasi atau sirkumvensi paywall (`RESTRICTED_PORTAL` untuk SNI, `COMMERCIAL_PAYWALL` untuk ASHRAE/ASTM).
  - Menerapkan **Exact Numbers Policy**: angka teknis yang tidak terverifikasi oleh dokumen primer yang diunduh langsung dihapus dari klaim aman penulis (`author_safe_claims`), serta prinsip **Monetary Silence** ditegakkan mutlak.
  - Membatasi status akhir riset pada gerbang `RESEARCH_HUMAN_REVIEW_REQUIRED` sebelum draf naskah dikonsumsi oleh Joko.
- **Komponen Arsitektur yang Dibangun:**
  1. `src/lib/editorial/source-discovery.ts`: Modul pencarian terbuka CrossRef & Wikipedia, pengunduh teks dokumen primer, kalkulator SHA-256, dan ekstraktor kutipan terverifikasi (`extractPassagesFromText`).
  2. `src/lib/editorial/irwan-research-runtime.ts`: Engine runtime server-side `executeEditorialResearchJob(input, options)` yang mengorkestrasi penelusuran, pengunduhan, pembacaan, klasifikasi inventaris klaim, pembuatan klaim aman penulis, perakitan Evidence Pack baru, dan pencatatan trace operasional.
  3. `src/lib/editorial/index.ts`: Ekspor barrel modul penemuan sumber dan runtime riset Irwan.
  4. `scripts/run-irwan-research-proof.js`: Skrip eksekusi langsung operator untuk pembuktian riset autentik topik atap metal.
  5. `scripts/test-editorial-runtime-3.js`: Rangkaian 18 tes unit deterministik untuk membuktikan batasan verifikasi, penghapusan angka persis, deteksi sumber tertahan, keabsahan SHA-256, pewarisan ketidakpastian, dan isolasi keselamatan.
  6. `docs/EDITORIAL_RUNTIME_3_IRWAN.md`: Dokumentasi komprehensif arsitektur riset Irwan dan telemetri runtime nyata.
- **Hasil Pembuktian Runtime Nyata (Live Metal-Roof Research Proof):**
  - **Topik:** *"Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?"*
  - **Operator:** `antigravity_operator` (`CHIEF_EDITOR`).
  - **Durasi Eksekusi:** 3.709 ms (3,7 detik).
  - **Statistik Operasional:** 4 kueri dijalankan, 19 sumber ditemukan, 1 dokumen primer berhasil diunduh dan diinspeksi penuh (17.629 bytes, SHA-256: `c31f273c848cfd43d91a35e8aec864ac1921bd8060f5ebf51fcc7d9bb37b6401`), 32 kutipan bukti diekstrak, 3 sumber berbayar/portal tertahan dicatat jujur, 8 klaim disusun (6 terverifikasi, 2 terdukung/konsensus), 8 klaim aman penulis dihasilkan.
  - **Artefak Pembuktian:** Disimpan ke `scripts/runtime-proof/irwan-metal-roof-evidence-pack.json` dan `scripts/runtime-proof/irwan-metal-roof-runtime-meta.json`. Paket bukti lama tidak ditimpa.
  - **Klasifikasi Milestone:** **`IRWAN_RUNTIME_PROVEN`**.
- **Validasi & Integritas:**
  - `scripts/test-editorial-runtime-1.js`: 18/18 PASS.
  - `scripts/test-editorial-runtime-2.js`: 13/13 PASS.
  - `scripts/test-editorial-runtime-3.js`: 18/18 PASS.
  - `npx tsc --noEmit`: 0 error (bersih).
  - `npm run build`: 100% sukses (server bundle SSR selesai dalam 5.83s).
  - Invarian keselamatan: `automation_mode = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`. Nol deploy, nol publikasi, Joko tidak dipanggil.

### EDITORIAL-RUNTIME-2: Grounded Joko Output & Editorial Compression 2026-10-04

- **Tujuan & Ruang Lingkup:**
  - Menyelesaikan temuan batas mendasar dari evaluasi manusia terhadap draf nyata pertama Joko (`JOKO_EDITORIAL_QUALITY_HUMAN_REVIEW = REVISE`): `AUTHOR_SAFE_INPUT != AUTOMATICALLY_GROUNDED_OUTPUT`.
  - Mengimplementasikan **Claim Grounding Contract** yang membatasi klaim teknis Joko hanya pada `author_safe_claims` yang disetujui, fakta topik eksplisit, dan inferensi redaksional logis yang ditandai dengan jelas, tanpa memperluas klaim dari pengetahuan umum model (*prior knowledge*).
  - Merancang **Grounded Draft Envelope** terstruktur: `{ article_markdown, claim_usage, unsupported_claim_candidates }` yang bersifat internal (naskah pembaca bersih tanpa tag sintetis `[CLM-xxx]`).
  - Mengimplementasikan validasi ID klaim deterministik (`validateClaimGrounding`): menolak klaim tidak dikenal, klaim terlarang (*prohibited*), klaim beraksi `REMOVE`, angka/elemen teknis terlarang, serta menghentikan naskah pada `EVIDENCE_GROUNDING_REVIEW_REQUIRED` bila ada kandidat klaim di luar bukti.
  - Mempertahankan kejujuran deklarasi (*No False Grounding*): status deklarasi diberi label `AUTHOR_GROUNDING_DECLARATION` dan tidak dimanipulasi sebagai `VERIFIED_EVIDENCE_GROUNDING`.
  - Menegakkan prinsip kepastian proporsional (`PRESCRIPTIVE_CERTAINTY <= EVIDENCE_CERTAINTY`) dan kompresi redaksional (**ONE IDEA — ONE BEST HOME**) via `auditEditorialRefinement` untuk menghilangkan repetisi subjudul rekomendasi serta melunakkan istilah mutlak ("wajib", "pasti", "harus", "paling efektif", "tidak berfungsi", "hampir nol").
  - Menjaga nada konsultan ramah (*Consultant Voice*): menerjemahkan konsep teknis menjadi konsekuensi praktis pemilik rumah, serta mengakhiri naskah dengan panduan inspeksi fisik mandiri siang hari (*Next Action Quality*) tanpa CTA pemasaran.
- **Komponen Arsitektur yang Dibangun:**
  1. `src/lib/editorial/claim-grounding.ts`: Parser amplop terstruktur draf, validator klaim aman, pemeriksa elemen terlarang, audit kepastian preskriptif, dan audit kompresi redaksional.
  2. `src/lib/editorial/joko-prompt-builder.ts`: Integrasi kontrak keterikatan klaim, instruksi amplop JSON, kompresi editorial, dan kepastian proporsional.
  3. `src/lib/editorial/editorial-runtime.ts`: Integrasi validasi ketercakupan klaim dan audit penyempurnaan redaksional ke alur runtime, dengan penghentian aman pada pelanggaran integritas.
  4. `scripts/test-editorial-runtime-2.js`: 13 pengujian unit deterministik (penolakan klaim tidak dikenal, penolakan klaim terlarang, penolakan klaim REMOVE, pencegahan restorasi angka terlarang, penolakan kandidat tanpa bukti, audit kepastian preskriptif, audit kompresi redaksional, dan invarian keselamatan).
  5. `scripts/runtime-proof-runner-v2.js`: Runner operator untuk eksekusi runtime V2.
  6. `docs/EDITORIAL_RUNTIME_2.md` & `state/EDITORIAL_RUNTIME_2_CHECKPOINT.md`: Dokumentasi dan checkpoint resmi.
- **Hasil Pembuktian Runtime Nyata V2 (Live Metal-Roof Proof V2):**
  - **Provider:** SumoPod (`sumopod`) | **Model:** `gpt-5.6-luna`.
  - **Telemetri Eksekusi:** Waktu 22.694 ms (22,7 detik), 2.889 prompt tokens, 3.150 completion tokens (total 6.039 tokens), 8.811 karakter draf naskah Markdown asli Bahasa Indonesia (kompresi 37,3% dari 14.046 karakter pada V1), 1 percobaan.
  - **Keterikatan Klaim Aman:** 8/8 klaim terpetakan valid (`AUTHOR_GROUNDING_DECLARATION`), 0 klaim di luar bukti.
  - **Hasil Evaluasi Deterministik Rina:** Skor **100 / 100**, Keputusan: **`HUMAN_WRITING_PASS`** (0 isu terdeteksi, isu `NEXT_ACTION_MISSING` pada V1 terselesaikan).
  - **Artefak Pembuktian:** Disimpan ke `scripts/runtime-proof/joko-metal-roof-runtime-v2.md` dan `scripts/runtime-proof/joko-metal-roof-runtime-v2-meta.json`. Artefak V1 dan naskah benchmark manusia tidak disentuh.
  - **Klasifikasi Milestone:** **`JOKO_RUNTIME_V2_HUMAN_REVIEW_REQUIRED`**.
- **Validasi & Integritas:**
  - `scripts/test-editorial-runtime-1.js`: 18/18 PASS.
  - `scripts/test-editorial-runtime-2.js`: 13/13 PASS.
  - `npx tsc --noEmit`: 0 error (bersih).
  - `npm run build`: 100% sukses (server bundle SSR selesai dalam 5.76s).
  - Invarian keselamatan: `automation_mode = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`. Nol deploy, nol publikasi.

### EDITORIAL-RUNTIME-1: Real Joko LLM Execution + Rina QA 2026-10-04

- **Tujuan & Ruang Lingkup:**
  - Membangun jalur eksekusi runtime editorial pertama yang nyata dan membuktikan bahwa Joko (`content_writer_primary`) bukan sekadar identitas staf visual, rekaan handoff, atau produsen artefak simulasi.
  - Mengimplementasikan alur: `Human Operator` → `Editorial Runtime` → `Joko Prompt Builder` → `Real LLM Provider` → `Joko Draft` → `Rina Deterministic QA` → `Human Review Gate`.
  - Membedakan status eksekusi secara jujur: `REAL_RUNTIME_EXECUTION` versus `STATIC_FIXTURE` / `SCRIPTED_SIMULATION` / `MANUAL_ARTIFACT`.
  - Mengonsumsi paket bukti berstatus approved yang sudah ada (`scripts/dryrun/evidence-pack.json`), konteks masalah pengunjung (`CTX-05`, `DECISION_UNCERTAINTY`, `DECISION_FORK`), pengetahuan kanonikal editorial, dan kontrak Bahasa Indonesia asli (`authoring_language = id-ID`, larangan mode terjemahan kaku).
  - Menyediakan loop perbaikan berbatas (*bounded repair*, maksimal 2 percobaan) dan penghentian aman (*fail-safe halt*) apabila terdeteksi isu riset primer (`RESEARCH_REQUIRED`).
- **Komponen Arsitektur yang Dibangun:**
  1. `src/lib/editorial/editorial-llm-provider.ts`: Provider transport generasi teks server-side terpisah dari OpenRouter TypeSafe Jev decisions API. Mendukung OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) dan SumoPod (`https://ai.sumopod.com/v1/chat/completions`) dengan batas timeout (60-120s), batas token (4000), retry eksponensial aman, klasifikasi error, dan sanitasi/redaksi kunci API mutlak.
  2. `src/lib/editorial/joko-prompt-builder.ts`: Modul perakit prompt kanonikal untuk Joko yang menyuntikkan `CANONICAL_EDITORIAL_KNOWLEDGE_V1`, pedoman kepenulisan manusia, larangan verdict komersial, monetary silence, dan claims yang aman ditulis (`author_safe_claims`). Tidak pernah menyalin naskah akhir sebelumnya ke prompt awal.
  3. `src/lib/editorial/editorial-runtime.ts`: Fungsi runtime server-side `executeEditorialDraftJob(input, options)` yang mewajibkan otorisasi operator (`operatorAuth`), mencatat trace operasional autentik, mengalirkan hasil ke evaluator deterministik Rina (`evaluateHumanWritingQuality`), dan membatasi status akhir ke `DRAFT` / `HUMAN_REVIEW_REQUIRED`.
  4. `src/lib/editorial/index.ts`: Ekspor modul editorial runtime.
  5. `scripts/test-editorial-runtime-1.js`: 18 pengujian deterministik (prompt builder, kontrak bahasa, penanganan kegagalan provider, provenance, determinisme Rina, perbaikan berbatas, penghentian riset, dan invarian keamanan).
  6. `scripts/runtime-proof-runner.js`: Skrip runner eksekusi langsung operator untuk pembuktian artikel atap metal.
  7. `docs/EDITORIAL_RUNTIME_1.md`: Dokumentasi komprehensif arsitektur dan hasil eksekusi.
- **Hasil Pembuktian Runtime Nyata (Live Metal-Roof Proof):**
  - **Provider:** SumoPod (`sumopod`) | **Model:** `gpt-5.6-luna`.
  - **Telemetri Eksekusi:** Waktu 23.204 ms (23,2 detik), 2.350 prompt tokens, 3.595 completion tokens (total 5.945 tokens), 14.046 karakter draf naskah Markdown asli Bahasa Indonesia, 1 percobaan (tanpa perlu retry).
  - **Hasil Evaluasi Deterministik Rina:** Skor **90 / 100**, Keputusan: **`HUMAN_WRITING_PASS`** (Lolos ambang batas 85).
  - **Artefak Pembuktian:** Disimpan ke `scripts/runtime-proof/joko-metal-roof-runtime.md` dan `scripts/runtime-proof/joko-metal-roof-runtime-meta.json`. Naskah benchmark manusia `scripts/dryrun/draft-final.md` tidak disentuh.
  - **Batas Keterbatasan Jujur:** Eksekusi Irwan belum diterapkan secara mandiri (`SOURCE_ACQUISITION_BLOCKED`). Paket bukti menggunakan data approved yang sudah ada.
  - **Klasifikasi Milestone:** **`JOKO_RUNTIME_PROVEN`**.
- **Validasi & Integritas:**
  - `scripts/test-editorial-runtime-1.js`: 18/18 PASS.
  - `scripts/test-editorial-production-dryrun.js`: 13/13 PASS.
  - `scripts/test-visitor-pain-angle.js`: 14/14 PASS.
  - `scripts/test-editorial-source-acquisition.js`: 14/14 PASS.
  - `scripts/test-editorial-human-quality.js`: 22/22 PASS.
  - `npx tsc --noEmit`: 0 error (bersih).
  - `npm run build`: 100% sukses (server bundle SSR selesai dalam 6.18s).
  - Invarian keselamatan: `automation_mode = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`. Nol deploy, nol publikasi.

### EDITORIAL-RUNTIME-EXECUTION-AUDIT-1: Audit Forensik Eksekusi Runtime Staf Editorial Hermes 2026-10-04

- **Tujuan & Ruang Lingkup:**
  - Melakukan audit forensik menyeluruh untuk membuktikan apakah alur kerja editorial `Irwan → Joko → Rina` benar-benar dieksekusi oleh agen/LLM runtime mandiri atau merupakan simulasi berbasis skrip/artefak manual yang diproduksi oleh asisten pengembang Antigravity (Codex) dan redaktur manusia.
  - Memeriksa keterhubungan OpenRouter, runtime Irwan (live source retrieval & extraction), runtime Joko (prompt builder & LLM generation), runtime Rina (deterministik vs LLM), serta kejujuran linimasa Job Trace, Task Handoff, dan animasi Pixel Office.
- **Temuan Forensik Inti:**
  1. **Klasifikasi Global: `EDITORIAL_RUNTIME_NOT_PROVEN`**  
     Lapisan evaluasi mutu lokal (Rina) dan tata kelola keselamatan (Human Stop Gate) bekerja 100% nyata dan deterministik, namun motor kepenulisan (Irwan & Joko) belum terhubung ke proses eksekusi LLM / agen runtime mandiri.
  2. **Irwan (`evidence_researcher_lead`):**  
     Hanya entitas staf konseptual di registry. Tidak memiliki runtime loop agen, web scraper, ataupun PDF crawler. `evidence-pack.json` dibuat sebagai berkas statis oleh Antigravity (Codex), dan `source-cache.ts` secara sah memvalidasi bahwa 0 dari 10 sumber primer tersedia di cache lokal (`SOURCE_ACQUISITION_BLOCKED`).
  3. **Joko (`content_writer_primary`):**  
     Tidak memiliki fungsi perakitan prompt runtime (*prompt builder*) maupun klien pemanggil API completions di `rancangloka-astro`. Draf naskah (`draft-v1.md`, `draft-final.md`) ditulis langsung oleh Antigravity (Codex) dan dipoles pembukanya oleh redaktur manusia. Seluruh pengetahuan editorial, pedoman bahasa Indonesia asli, dan keluhan pengunjung berstatus `DEFINED_BUT_NOT_RUNTIME_CONNECTED`.
  4. **Rina (`editorial_qa_primary`):**  
     Bekerja 100% sebagai evaluator lokal deterministik murni di `human-quality.ts` (regex, aturan struktur, heuristik, larangan kata, skor 0-100). Rina tidak memanggil LLM.
  5. **OpenRouter Reality:**  
     Klien OpenRouter di `rancangloka-astro` secara eksklusif memanggil endpoint alfa terstruktur `POST https://openrouter.ai/api/alpha/decisions` untuk mode bayangan (*shadow mode*) TypeSafe Jev (`typesafe/jev-1.13-20260917`). Tidak ada klien OpenRouter Chat Completions (`/api/v1/chat/completions`) yang terpasang untuk Joko.
  6. **Pixel Office & Task Handoff Truthfulness:**  
     Modul `task-handoff.ts`, `job-trace.ts`, dan animasi `Pixel Office` memodelkan status data secara deterministik untuk antarmuka observabilitas Mission Control (`read-only visualization layer, zero workflow authority`), bukan sebagai penanda adanya pemanggilan API atau proses pekerja aktif di server (`STATE_SIMULATION_ONLY`).
- **Komponen Rekayasa & Dokumentasi:**
  1. `docs/EDITORIAL_RUNTIME_EXECUTION_AUDIT_1.md`: Laporan audit komprehensif 19 bab.
  2. `state/EDITORIAL_RUNTIME_EXECUTION_AUDIT_CHECKPOINT.md`: Rekaman status checkpoint offline.
  3. `scripts/test-editorial-production-dryrun.js`: Penyesuaian assertion batas kelulusan untuk mengakomodasi skor draf hasil kurasi redaktur manusia (skor 92, status `HUMAN_WRITING_PASS`).
  4. `scripts/test-editorial-source-acquisition.js`: Penyelarasan batas kelulusan (skor 92).
  5. Pembaruan `AGENTS.md` dengan ringkasan status milestone audit.
- **Validasi & Integritas:**
  - `scripts/test-editorial-production-dryrun.js`: 13/13 PASS.
  - `scripts/test-editorial-source-acquisition.js`: 14/14 PASS.
  - `scripts/test-visitor-pain-angle.js`: 14/14 PASS.
  - `scripts/test-expert-consultation.js`: 22/22 PASS.
  - `scripts/test-editorial-human-quality.js`: 22/22 PASS.
  - `npx tsc --noEmit`: 0 error (bersih).
  - `npm run build`: Berhasil tanpa kendala (5.83s).
  - Invarian keselamatan: `automation_mode = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`. Nol deploy, nol publikasi.

### RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1: Master Canonical Editorial Knowledge Foundation 2026-10-04

- **Tujuan & Ruang Lingkup:**
  - Mendirikan SATU fondasi pengetahuan redaksional kanonikal bersama (*single source of truth*) bagi seluruh agen editorial RancangLoka (Irwan, Joko, Rina, Sari, Jefry).
  - Menghilangkan friksi dan definisi yang tumpang tindih mengenai standar artikel berkualitas, hierarki bukti, gaya penulisan manusia (*human voice*), alur bimbingan pembaca, formulasi rekomendasi berbasis skenario, dan kalibrasi ketidakpastian.
  - Memperluas fondasi konseptual dari `EDITORIAL-HUMAN-QUALITY-1` tanpa merusak atau mengubah bobot rubrik 100-poin yang sudah berjalan.
- **Lima Lapisan Pengetahuan Redaksional (The Five Major Layers):**
  1. **Layer 1: Human Writing**
     - Voice DNA: Ahli arsitektur/hunian Indonesia yang berpengalaman, hangat, jujur, tenang, dan berpihak pada kenyamanan dan keselamatan pembaca.
     - Resonansi Emosional: Berakar dari frustrasi nyata pemilik rumah (panas sore dinding barat, rembesan dak beton, talang meluap, ketidakpresisian tukang). Bebas dari melodrama, urgensi palsu, dan fearmongering.
     - Soul / Narrative Arc: Alur 4 tahap transformasi psikologis pembaca (RECOGNITION -> UNDERSTANDING -> CLARITY -> CALM CONFIDENCE).
     - Natural Cadence: Variasi dinamis kalimat pendek dan majemuk beranak, pencegahan struktur simetris kaku, tanpa typo yang disengaja.
  2. **Layer 2: Language & Cohesion**
     - Presisi Leksikal: Memilih kata yang paling akurat merepresentasikan konsep fisik.
     - Konsistensi Istilah Kanonikal: Peta istilah `CANONICAL_TERMINOLOGY_MAP` (`kusen aluminium`, `dak beton`, `rangka baja ringan`, `ventilasi silang`) yang bersifat tetap (*immutable*).
     - Kohesi Leksikal: Anafora konseptual pengikat paragraf berurutan.
     - Semantic Bridging: Jembatan semantik kausal, komparatif, kondisional, dan kontekstual. Larangan transisi mekanis klise.
     - Formula Terjemahan 3-Langkah: Fakta Teknis / Standar -> Penjelasan Analogi Fisik -> Konsekuensi Praktis bagi Penghuni.
  3. **Layer 3: Expert Consultation**
     - Perspektif Ahli-ke-Klien: Model dialogis konsultasi arsitektur (Problem -> Context -> Diagnosis -> Options -> Trade-off -> Solution Fit -> Recommendation -> Next Action).
     - Kualifikasi Konteks Pembaca: Evaluasi tipe proyek, orientasi matahari, paparan angin/tampias, kelembapan iklim, dan ketersediaan tukang lokal.
     - Pertanyaan Uji Diagnosa: Membimbing pembaca menguji gejala rumahnya sendiri sebelum membeli solusi.
     - Diagnosa Masalah: Pemisahan tegas antara gejala luar vs akar penyebab fisik (*root cause*).
     - Penanganan Mitos & Keberatan: Penjelasan tenang berbasis bukti fisik terhadap mitos material (uPVC vs aluminium, waterproofing tebal).
     - Solution Fit & Trade-Off: Pembongkaran kompromi nyata di setiap rekomendasi tanpa pemenang mutlak universal.
  4. **Layer 4: Decision Support**
     - Rekomendasi Berbasis Skenario: Pola percabangan konkret JIKA [Kondisi A] MAKA [Opsi 1], TETAPI JIKA [Kondisi B] MAKA [Opsi 2].
     - Biaya Keputusan yang Salah: Analisis rasional konsekuensi salah pilih material (biaya pengerjaan ulang, kerusakan sekunder, beban tagihan listrik AC).
     - Kelayakan Dunia Nyata (*Real-World Feasibility*): Ketersediaan tukang terampil, suku cadang lokal, dan toleransi bidang dinding eksisting.
     - Five Golden Questions of Decision Confidence: 5 pertanyaan penentu keyakinan pembaca sebelum bertransaksi.
     - Resolusi Akhir Menuntaskan: Larangan kesimpulan normatif kosong; wajib menyertakan rekomendasi skenario tegas, hal yang harus dicek, dan tindakan berikutnya.
  5. **Layer 5: Trust & Editorial Integrity**
     - Hierarki Klaim 5 Kelas: `VERIFIED_FACT`, `TECHNICAL_CONSENSUS`, `USER_EXPERIENCE_SIGNAL`, `EDITORIAL_INFERENCE`, `EDITORIAL_RECOMMENDATION`.
     - Kalibrasi Ketidakpastian 4 Tingkat: `HIGH_CONFIDENCE`, `MODERATE_INFERENCE`, `CONTEXT_DEPENDENT`, `UNKNOWN_FIELD_VERIFICATION_REQUIRED`.
     - Larangan Mutlak Klaim Pengujian Palsu (*Zero Fabricated Experience*): Larangan keras frasa "kami sudah menguji", "berdasarkan pengalaman kami", atau wawancara fiktif tanpa bukti primer. Label "Tested by RancangLoka" dilindungi hak verifikasi fisik.
     - Integritas Komersial & Monetary Silence: Isolasi pengaruh afiliasi/sponsor dan pelarangan tebak-tebakan harga material tanpa riset empiris.
     - Konsistensi Lintas-Artikel: Penyelarasan logika teknis antar-artikel dengan rujukan tertinggi pada bukti SNI Irwan.
- **Komponen Rekayasa & Integrasi:**
  1. `src/lib/article/editorial-knowledge.ts`: Modul pengetahuan redaksional tunggal, master object `CANONICAL_EDITORIAL_KNOWLEDGE_V1`, peta istilah, konstanta hierarki klaim, dan adapter terisolasi per peran (`getIrwanEvidenceKnowledge()`, `getJokoAuthoringKnowledge()`, `getRinaQAKnowledge()`, `getSariPublicationKnowledge()`, `getJefryAdvisoryKnowledge()`).
  2. `src/lib/article/human-quality.ts`: Penyematan `knowledge_version: "RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1"` pada `HumanWritingQualityResult`, penambahan deteksi pelanggaran Layer 5 `FABRICATED_EXPERIENCE_OR_SLOP` dengan penalti kritis (-35 poin), dan ekspor `DEFAULT_HUMAN_QUALITY_RUBRIC`.
  3. `docs/RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1.md`: Konstitusi editorial kanonikal lengkap.
  4. `scripts/test-editorial-knowledge.js`: Suite pengujian kanonikal 16 tes (16/16 PASS).
  5. `scripts/test-editorial-human-quality.js`: Suite pengujian mutu tulisan 20 tes (20/20 PASS).
- **Validasi:**
  - `npx tsc --noEmit` lulus bersih (0 error).
  - `npm run build` sukses (7.71s).
  - Seluruh rangkaian tes keselamatan SOAK, live operations, persistensi artikel, dan karantina konten lulus 100%.

### EDITORIAL-HUMAN-QUALITY-1: Human Writing Quality Gate & Anti-Slop Editorial Rubric 2026-10-04

- **Tujuan & Ruang Lingkup:**
  - Mengimplementasikan gerbang mutu penulisan redaksional alami (*Human Writing Quality Gate*) pada pipeline editorial RancangLoka dan Hermes Mission Control.
  - Menjamin seluruh naskah artikel yang disetujui atau diterbitkan memiliki kualitas prosa yang terasa ditulis secara wajar, mengalir, dan bernas oleh editor/penulis manusia Indonesia kompeten, serta bebas dari pola klise mekanis AI generik (*anti-slop*).
  - Menolak mutlak integrasi alat detektor AI eksternal yang tidak dapat diandalkan (*zero GPTZero-style scoring, zero fake AI probabilities*).
- **Komponen Utama yang Diimplementasikan:**
  1. **Model Rubrik Kualitas Penulisan Alami 100-Poin (`src/lib/article/human-quality.ts`):**
     - Natural sentence rhythm (20)
     - Specificity / concrete detail (15)
     - Contextual relevance (iklim tropis, panas sore, tampias, material lokal) (15)
     - Editorial voice (15)
     - Non-template structure (10)
     - Evidence integration (SNI/ASTM, angka terukur) (10)
     - Useful reader perspective (10)
     - Conclusion originality (5)
     - Ambang batas deterministik: 85-100 = `HUMAN_WRITING_PASS`, 75-84 = `HUMAN_WRITING_REVISE`, 0-74 = `HUMAN_WRITING_REWRITE`.
  2. **Deteksi Pola Mesin / AI-Slop Deterministik:**
     - Mendeteksi generic opening ("Di era modern saat ini...", "Dalam dunia konstruksi...").
     - Mendeteksi simetri struktur kaku (jumlah butir/paragraf identik antar-subjudul).
     - Mendeteksi perulangan monoton frasa transisi ("Selain itu", "Di sisi lain", "Dengan demikian").
     - Mendeteksi generalisasi kosong ("setiap pilihan memiliki kelebihan dan kekurangan").
     - Mendeteksi hedging berlebihan ("dapat menjadi pilihan", "cenderung").
     - Mendeteksi kesimpulan artifisial yang hanya merangkum ulang tanpa panduan aksi/keputusan.
     - Mendeteksi pemaksaan kata kunci SEO (*keyword stuffing*).
  3. **Kepemilikan Personel Kanonikal & Pembagian Peran:**
     - Joko (`content_writer_primary`): Memegang `ARTICLE_WRITING` dan `HUMAN_WRITING_AUTHORING` untuk penulisan dan penulisan ulang prosa (*human-first authoring*). Dilarang keras mengarang testimoni atau pengujian fisik palsu.
     - Rina (`editorial_qa_primary`): Memegang `EDITORIAL_QA`, `HUMAN_WRITING_QA`, dan `EDITORIAL_NATURALNESS_REVIEW`. Mengevaluasi draf dan mengeluarkan *structured rewrite brief*.
     - Irwan (`evidence_researcher_lead`): Memegang `EVIDENCE_RESEARCH`. Fakta dan standar SNI/ASTM wajib dipertahankan selama penulisan ulang Joko.
     - Jefry (`management_advisor_jefry`): Tetap berstatus shadow observer dengan nol (0) otoritas eksekusi editorial atau penerbitan.
  4. **Pencegahan Perulangan Tak Terbatas (Retry Cap & Safety Safeguard):**
     - Batas penulisan ulang dibatasi maksimal 2 kali percobaan (`maxAttempts = 2`).
     - Kegagalan berulang setelah batas percobaan secara deterministik dieskalasi ke status `HUMAN_REVIEW_REQUIRED`.
     - Sistem dilarang menurunkan ambang batas secara otomatis.
  5. **Integrasi Mission Control, Job Trace & Pixel Office:**
     - Tipe event Job Trace: `HUMAN_WRITING_QA_STARTED`, `HUMAN_WRITING_REVISE_REQUESTED`, `ARTICLE_REWRITE_STARTED`, `HUMAN_WRITING_QA_PASSED`, `HUMAN_REVIEW_REQUIRED`.
     - Animasi Pixel Office: Joko otomatis beralih ke animasi `ARTICLE_REWRITE` (`✍️`) pada saat merevisi naskah (`retryCount > 0`).
     - Endpoint inspeksi read-only terlindungi: `GET /api/admin/mission-control/quality?article_id=:id` dengan proteksi autentikasi admin sesi dan Media Device Firewall.
  6. **Suite Pengujian Terfokus & Validasi (`scripts/test-editorial-human-quality.js`):**
     - 20 pengujian terfokus lulus 100% (20/20 PASS).
     - Seluruh tes regresi SOAK safety, liveops, content persistence, dan quarantine lulus 100%.
     - `npx tsc --noEmit` lulus bersih 0 kesalahan.
     - `npm run build` sukses 100%.
- **Status Akhir:**
  - `EDITORIAL-HUMAN-QUALITY-1 = COMPLETE`.

### SOCIAL-S3.6: Meta Live Connection Readiness & Operator Boundary 2026-10-01

- **Tujuan & Ruang Lingkup:**
  - Mengimplementasikan seluruh kesiapan teknis rute OAuth, abstraksi transport pertukaran token, model probe read-only, dan integrasi UI admin untuk integrasi ekosistem Meta (Facebook Page & Instagram Professional).
  - Menetapkan batas tegas (*Strict Operator Boundary*): Berhubung operator belum membuat akun resmi Facebook Page dan Instagram Professional RancangLoka, seluruh implementasi difokuskan pada *Connection Readiness Only*.
  - Menegakkan Invarian Keselamatan Mutlak:
    - Nol panggilan API riil ke Meta (`MockMetaOAuthTransport` digunakan untuk pengujian).
    - `ProductionMetaOAuthTransport` dan `ProductionSocialProviderTransport` tetap diblokir secara ketat (`BLOCKED`).
    - Nol token atau kredensial riil yang diminta atau disimpan; database remote D1 produksi 100% tidak tersentuh.
    - Otoritas penerbitan konten tetap berstatus 0 (`publishingAuthority: 0`) dan `SOCIAL_AUTOMATION = OFF`.
    - Maya & Mission Control melaporkan status belum terhubung secara jujur dan memberikan panduan 6-langkah deterministik.
    - Maya tetap berstatus `IDLE` di Lounge tanpa animasi kerja fiktif.
- **Komponen Utama yang Diimplementasikan:**
  1. **Rute Server OAuth Kanonikal (`src/pages/admin/social/meta/`):**
     - `connect.ts`: Mengamankan autentikasi admin sesi, mengevaluasi kesiapan sistem (Meta App & KEK), menghasilkan state OAuth bertanda tangan HMAC SHA-256 single-use, dan membentuk URL otorisasi resmi.
     - `callback.ts`: Mengamankan autentikasi admin sesi, memvalidasi state anti-CSRF, mencegah serangan replay state (`consumeOAuthState`), mengabstraksikan pertukaran token via transport, mengenkripsi token ke dalam Vault AES-256-GCM, dan menyimpan metadata non-rahasia ke pengaturan D1.
  2. **Model Kesiapan Koneksi & Allowlist Probe Read-Only (`src/lib/social/providers/meta/live-readiness.ts`):**
     - Evaluator deterministik `evaluateMetaLiveReadiness` yang menilai konfigurasi non-rahasia (`META_APP_ID = CONFIGURED / MISSING`, `META_APP_SECRET = PRESENT / MISSING`, `META_CREDENTIAL_KEK_V1 = PRESENT / MISSING`).
     - Allowlist ketat probe read-only (`GET /me`, `GET /me/accounts`, dsb.) dan penolakan otomatis fail-closed terhadap endpoint publikasi/mutasi (`POST /feed`, `POST /photos`, `POST /media`, `POST /media_publish`).
  3. **Abstraksi Transport Klien OAuth (`src/lib/social/providers/meta/oauth-client.ts`):**
     - Memisahkan transport fisik dari logika bisnis OAuth. Menyediakan `MockMetaOAuthTransport` untuk pengujian deterministik dan `ProductionMetaOAuthTransport` yang memblokir panggilan live.
  4. **Mesin Pemilihan Akun Eksplisit (`src/lib/social/providers/meta/account-selection.ts`):**
     - Secara tegas menolak auto-seleksi hasil pertama jika Meta mengembalikan lebih dari satu Facebook Page; mewajibkan operator memilih `page_id` secara sadar dan mengonfirmasi penautan target.
  5. **Pengayaan Dasbor Admin Settings (`src/pages/admin/settings.astro#social-meta-connection`):**
     - Menambahkan anchor `#social-meta-connection`, badge status kesiapan, matriks konfigurasi/vault, kartu penemuan akun, panduan checklist 6-langkah operator, serta tombol "Hubungkan Akun Meta" yang ter-gated rapi saat konfigurasi belum lengkap.
  6. **Pembaruan Respon Chat Maya (`src/lib/mission-control/chat.ts`):**
     - Maya menjawab kueri status koneksi dengan jujur ("Belum terhubung") dan menyajikan checklist langkah berikutnya tanpa merekayasa status publikasi.
  7. **Rangkaian Pengujian Terfokus (`scripts/test-social-meta-live-readiness.js`):**
     - 17 pengujian terfokus lulus 100% tanpa akses jaringan eksternal.
- **Status Akhir:**
  - `SOCIAL-S3.6 = COMPLETE (READINESS PREPARED & MOCK VERIFIED)`.
  - **BATAS KERJA TERCAPAI:** Menunggu tindakan operator manusia di luar sistem (*Operator Action Required: Create RancangLoka Facebook Page + Instagram Professional Account*).

### SOCIAL-S3.5B: Credential Vault Cryptographic & Concurrency Hardening 2026-10-01

- **Tujuan & Ruang Lingkup:**
  - Melakukan audit kriptografi dan konkurensi mendalam terhadap vault kredensial sosial sebelum menghubungkan kredensial Meta riil.
  - Memverifikasi pencegahan mutlak penggunaan ulang nonce AES-GCM (*zero nonce reuse*): access token dan refresh token wajib memiliki nonce acak independen masing-masing.
  - Memperkuat otentikasi konteks AAD dengan mengikat tujuan token (*token purpose binding*): `:access_token` vs `:refresh_token`.
  - Mengamankan konkurensi database: memastikan invarian kredensial aktif tunggal (*single active credential*) ditegakkan di level database engine D1/SQLite melalui partial unique index.
  - Menjamin atomisitas rotasi token via `db.batch()`: jika insert gagal, status kredensial aktif lama tidak akan terhapus.
  - Keputusan Teknis Kelayakan (*Go/No-Go Decision*): Memastikan seluruh tes lolos 100% sebelum membuka milestone OAuth interaktif.
- **Komponen Utama yang Diimplementasikan:**
  1. **D1 Migration Aditif (`db/migrations/0028_social_credential_vault_hardening.sql`):**
     - Menambahkan kolom `access_token_nonce` dan `refresh_token_nonce`.
     - Membuat partial unique index `uq_social_active_credential ON social_provider_credentials(connection_id, provider) WHERE revoked_at IS NULL`.
  2. **Penguatan Kriptografi & AAD (`src/lib/social/vault/crypto.ts`):**
     - Memperbarui `buildAuthenticatedContext` dengan parameter `tokenPurpose`: `${credentialId}:${connectionId}:${provider}:${authMode}:${keyVersion}:${tokenPurpose}`.
     - Pertukaran ciphertext antar kolom access dan refresh token akan gagal verifikasi tag MAC seketika (`VAULT_DECRYPTION_FAILED`).
     - Normalisasi pesan galat dekripsi agar tidak membocorkan detail internal Web Crypto.
  3. **Layanan Vault Berorientasi Konkurensi & Atomisitas (`src/lib/social/vault/vault-service.ts`):**
     - `storeCredential`: Menghasilkan nonce 96-bit independen untuk access token dan refresh token. Menggunakan `db.batch([revokeStmt, insertStmt])` untuk transaksi atomik all-or-nothing.
     - `readCredentialForProviderExecution`: Mendekripsi access token dengan `access_token_nonce` dan refresh token dengan `refresh_token_nonce` secara terpisah.
     - `rotateEncryptionKey`: Mendekripsi kedua token dengan nonce lama, lalu mengenkripsi ulang keduanya menggunakan nonce acak baru yang independen di bawah KEK target (V1 -> V2).
  4. **Matriks Pengujian Konkurensi & Substitusi (`scripts/test-social-credential-vault.js`):**
     - Uji balapan callback OAuth konkuren (*concurrent race test*): tepat 1 kredensial aktif yang bertahan dan valid.
     - Uji kegagalan batch: rollback transaksi menjaga kredensial awal tetap aktif.
     - Uji matriks substitusi ciphertext (cross-token, cross-connection, cross-provider) gagal tertutup.
- **Pengujian & Validasi:**
  - `scripts/test-social-credential-vault.js` lulus 100% (12/12 tes).
  - Seluruh rangkaian regresi kanonikal (14 suite: meta-binding, meta-adapter, mission-control, domain, staff, departments, chat, anomalies, pixel-office, expansion, job-animation, SOAK-0 54 tes) lulus 100%.
  - `npx tsc --noEmit` lulus bersih 0 kesalahan.
  - `npm run build` sukses 100% (6.43s).
- **Status Akhir & Keputusan:**
  - `SOCIAL-S3.5B = COMPLETE`.
  - **GO APPROVED** untuk `SOCIAL-S3.6` (Operator-Gated Meta Connection & Read-Only Health Verification).

### SOCIAL-S3.5A: Secure OAuth Credential Vault & Token Persistence Hardening 2026-10-01

- **Tujuan & Ruang Lingkup:**
  - Mengatasi kesenjangan arsitektur penyimpanan token dinamis dari alur OAuth sebelum implementasi SOCIAL-S3.6.
  - Memverifikasi batasan kemampuan Cloudflare Workers Secrets / Secrets Store: runtime Worker isolate bersifat *read-only* sehingga mutasi rahasia dinamis tanpa Cloudflare Management API tidak didukung.
  - Menghindari risiko eskalasi hak akses (*privilege escalation*): RancangLoka tidak boleh menyimpan atau menggunakan Cloudflare Account Management API token di aplikasi web/admin hanya untuk menyimpan token OAuth Meta.
  - Mengimplementasikan Dedicated Encrypted Credential Vault: Token OAuth dienkripsi di server menggunakan AES-256-GCM dengan *Authenticated Additional Data* (AAD) sebelum disimpan di tabel D1 terdedikasi `social_provider_credentials`.
  - Master Key (KEK): Key Encryption Key 256-bit (`META_CREDENTIAL_KEK_V1`) disimpan secara terisolasi di Cloudflare Secrets, tidak pernah masuk ke D1 atau git.
  - Strict Safety Invariants: `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `JEV_MODE = shadow`, `media_worker = DISABLED`, `publishingAuthority = 0`.
- **Komponen Utama yang Diimplementasikan:**
  1. **D1 Migration Terdedikasi (`db/migrations/0027_social_credential_vault.sql`):**
     - Tabel `social_provider_credentials` menyimpan ciphertext terautentikasi (`encrypted_access_token`, `encrypted_refresh_token`), nonce 12-byte (`encryption_nonce`), dan versi kunci (`encryption_key_version`).
     - Invarian Absolut: Tidak ada kolom plaintext token sama sekali.
  2. **Mesin Kriptografi Web Crypto AES-256-GCM (`src/lib/social/vault/crypto.ts`):**
     - Menggunakan Web Crypto standar (`globalThis.crypto.subtle`) yang kompatibel di Cloudflare Workers dan Node.js.
     - AAD kontekstual deterministik: `credential_id:connection_id:provider:auth_mode:key_version`. Substitusi atau pemalsuan ciphertext lintas akun akan gagal otentikasi tag MAC seketika.
  3. **Layanan Credential Vault (`src/lib/social/vault/vault-service.ts`):**
     - `storeCredential`: Mengenkripsi token sebelum disimpan, melakukan rotasi token atomik terhadap kredensial lama.
     - `readCredentialForProviderExecution`: Dekripsi *just-in-time* khusus di batas eksekusi provider dan segera dibuang dari memori.
     - `rotateEncryptionKey`: Migrasi versi KEK (V1 -> V2) dengan dekripsi dan re-enkripsi atomik di tempat tanpa kehilangan data.
     - `getCredentialMetadata`: Mengembalikan metadata non-rahasia (`VALID`, `EXPIRED`, `REVOKED`) tanpa pernah membocorkan token/ciphertext.
     - `sanitizeVaultError`: Menyensor pola token (`EAAB...`, `Bearer ...`) dari diagnostik error.
  4. **Integrasi Mission Control, Maya & Admin:**
     - Maya menjawab status kesiapan vault pada `SOCIAL_CONNECTION_QUERY` tanpa membocorkan token.
     - Permintaan token mentah via chat Maya ditolak secara tegas dengan `DANGEROUS_ACTION_FORBIDDEN`.
     - Panel Admin Settings menampilkan status vault terenkripsi AES-256-GCM.
- **Pengujian & Validasi:**
  - `scripts/test-social-credential-vault.js` lulus 100% (12/12 tes) mencakup uji ancaman pembobolan D1 (*threat test: D1 dump alone cannot decrypt*), uji substitusi konteks AAD, rotasi kunci KEK V1->V2, dan deteksi token kedaluwarsa.
  - Seluruh rangkaian pengujian regresi (`test-social-meta-binding.js`, `test-social-meta-adapter.js`, `test-social-mission-control.js`, `test-social-domain.js`, SOAK-0 54 tes) lulus 100%.
  - `npx tsc --noEmit` lulus bersih 0 kesalahan.
  - `npm run build` sukses 100% (5.37s).
- **Status Akhir:**
  - `SOCIAL-S3.5A = COMPLETE`.
  - Siap untuk langkah selanjutnya: `SOCIAL-S3.6` (Operator-Gated Meta Connection & Read-Only Health Verification).

### SOCIAL-S3.5: Meta Credential & Account Binding Readiness (Operator-Gated Connection / Zero Live Publishing) 2026-10-01

- **Tujuan & Ruang Lingkup:**
  - Mengimplementasikan arsitektur pengikatan kredensial dan akun (Meta Facebook Page & Instagram Professional) yang aman dan berorientasi operator (*operator-gated connection*) tanpa memberikan otoritas penerbitan (*zero publishing authority*).
  - Verifikasi empiris dua model autentikasi Meta: `FACEBOOK_LOGIN` (Facebook user -> Pages -> linked IG) vs `INSTAGRAM_LOGIN` (direct Instagram Professional).
  - Strict Safety Invariants: `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `JEV_MODE = shadow`, `media_worker = DISABLED`, `publishingAuthority: 0`.
  - Secret Boundary: Kredensial rahasia (token, App Secret, dll) berada di luar tabel D1, snapshot Mission Control, Pixel Office, chat, dan log aplikasi. Hanya referensi non-rahasia (`credential_binding_name`) yang disimpan di tabel `settings`.
- **Komponen Utama yang Diimplementasikan:**
  1. **Dual Auth Modes & Model Binding (`src/lib/social/providers/meta/binding-types.ts`):**
     - Memodelkan `FACEBOOK_LOGIN` dan `INSTAGRAM_LOGIN` dengan keluarga perizinan terpisah (`FACEBOOK_LOGIN_REQUIRED_PERMISSIONS` vs `INSTAGRAM_LOGIN_REQUIRED_PERMISSIONS`).
     - Tipe data non-rahasia: `DiscoveredFacebookPage`, `DiscoveredInstagramAccount`, `MetaAccountDiscoveryResult`, `MetaConnectionRecord`, `MetaConnectionHealth`.
  2. **Keamanan OAuth & Anti-CSRF (`oauth-security.ts`):**
     - Pembuatan state kriptografis HMAC SHA-256 dengan payload sekali pakai (single-use nonce, timestamp, TTL 10 menit).
     - Validasi ketat tanda tangan state, kedaluwarsa, dan allowlist redirect URI (`VALID_REDIRECT_URIS`).
  3. **Penemuan Akun Nir-Rahasia (`account-discovery.ts`):**
     - `normalizeFacebookPagesDiscovery`: Memetakan Page yang dikelola, izin tugas, dan deteksi jujur akun Instagram terhubung (`connected_instagram_account`).
     - `normalizeInstagramLoginDiscovery`: Memetakan profil Instagram Business langsung tanpa mewajibkan tautan Facebook Page.
  4. **Pemeriksaan Kesehatan & Putus Sambungan (`connection-health.ts`):**
     - Evaluasi kesehatan koneksi deterministik (`CONNECTED`, `PERMISSION_INCOMPLETE`, `LINK_MISSING`, `REAUTH_REQUIRED`, `NOT_CONNECTED`).
     - `disconnectMetaConnection`: Memutuskan ikatan akun secara bersih tanpa menghapus campaign atau outbox.
  5. **Layanan Penyimpanan Nir-Rahasia (`connection-service.ts`):**
     - Membaca dan menyimpan record koneksi ke tabel D1 `settings` via kunci `social_meta_connection_json`.
     - Assertion ketat: Melempar `CRITICAL_SECURITY_VIOLATION` seketika jika terdapat token atau rahasia mentah pada payload.
  6. **Integrasi Mission Control & Maya (`chat.ts`, `capability-registry.ts`, `anomalies.ts`):**
     - Maya menjawab kueri status koneksi (`SOCIAL_CONNECTION_QUERY`) secara faktual dari read model.
     - Maya menolak segala bentuk perintah penerbitan atau penyetoran token.
     - Deteksi anomali koneksi `SOCIAL_AUTH_REAUTH_REQUIRED` dan `SOCIAL_PERMISSION_INCOMPLETE`.
  7. **Permukaan Admin (/admin/settings):**
     - Bagian 6 "Distribusi Sosial & Koneksi Meta" dengan visualisasi status, target Page/IG, izin, dan tombol aksi operator-gated yang aman.
- **Pengujian & Validasi:**
  - `scripts/test-social-meta-binding.js` lulus 100% (11/11 tes).
  - Seluruh rangkaian pengujian regresi lulus 100% (`test-social-meta-adapter.js`, `test-social-mission-control.js`, `test-social-domain.js`, SOAK-0 54 tes, MC-1 s.d. MC-9).
  - `npx tsc --noEmit` lulus bersih 0 kesalahan.
  - `npm run build` sukses 100%.
- **Status Akhir:**
  - `SOCIAL-S3.5 = COMPLETE`.
  - Berhenti di batas aman: `OPERATOR ACTION REQUIRED — CONNECT META ACCOUNT`.
  - Langkah selanjutnya: `SOCIAL-S3.6` (Operator-Gated Meta Connection & Read-Only Health Verification).

### SOCIAL-S3: First Platform Adapter (Meta Graph API: Facebook Page + Instagram Business) 2026-10-01

- **Tujuan & Ruang Lingkup:**
  - Mengimplementasikan batas adapter platform sosial pertama untuk Meta Graph API (Facebook Page & Instagram Business) dengan prinsip **Disabled Execution & Mock Transport First**.
  - Strict Safety Invariants: `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `JEV_MODE = shadow`, `Meta execution authority = 0`.
  - Zero Production Credentials: Tidak ada access token, App Secret, maupun token mentah yang disimpan di D1 atau di-commit.
  - Zero Real Publishing: Tidak ada panggilan jaringan ke endpoint publik Meta Graph API; tidak ada postingan Facebook/Instagram riil; tidak ada receipt eksternal fiktif yang dimasukkan ke D1.
- **Komponen Utama yang Diimplementasikan:**
  1. **Kontrak Neutral Platform Provider (`src/lib/social/providers/types.ts` & `registry.ts`):**
     - Antarmuka netral `SocialPlatformAdapter` dengan pemisahan tegas antara Domain, Adapter, Transport, dan Mission Control.
     - Registri sentral `getPlatformAdapter()` yang memetakan platform target ke instans adapter tanpa kopling langsung.
  2. **Abstraksi Transport & Mock Deterministik (`src/lib/social/providers/transport.ts`):**
     - `MockSocialProviderTransport` untuk pengujian unit/integrasi lokal deterministik dengan pencatatan seluruh permintaan outbound (`recordedRequests`).
     - `ProductionSocialProviderTransport` yang bersifat inert dan fail-closed dengan galat `PRODUCTION_TRANSPORT_BLOCKED`.
  3. **Model Konfigurasi Nir-Rahasia (`src/lib/social/providers/meta/types.ts`):**
     - `MetaProviderConfig` hanya memuat referensi non-rahasia (`facebookPageId`, `instagramAccountId`, `graphApiVersion`, `credentialBindingName`).
     - Validasi konfigurasi menolak secara fail-closed jika terdapat kunci rahasia (`accessToken`, `appSecret`).
  4. **Matriks Kapabilitas Deterministik (`capabilities.ts`):**
     - Facebook Page: `FEED_POST` = `SUPPORTED`, `CAROUSEL` = `UNVERIFIED`, `REEL_SHORT` = `UNVERIFIED`, `THREAD` = `UNSUPPORTED`.
     - Instagram Business: `FEED_POST` = `SUPPORTED`, `CAROUSEL` = `SUPPORTED` (2-10 items), `REEL_SHORT` = `UNVERIFIED`, `THREAD` = `UNSUPPORTED`.
     - Format unverified atau unsupported secara tegas ditolak sebelum pembuatan request.
  5. **Builder Permintaan & Alur Multi-Stage (`request-builder.ts`):**
     - Facebook Page: endpoint photo (`/{page-id}/photos`) atau feed (`/{page-id}/feed`).
     - Instagram Business: alur multi-stage kontainer asli Meta (`/{ig-user-id}/media` -> `/{ig-user-id}/media_publish`), dan dukungan kontainer carousel untuk multi-gambar.
  6. **Gerbang Eksekusi & Normalisasi Hasil (`response-normalizer.ts` & `error-classifier.ts`):**
     - Eksekusi publish saat `executionMode === 'DISABLED'` secara ketat menolak dengan `PROVIDER_EXECUTION_DISABLED`.
     - Sanitasi rahasia otomatis (`sanitizeMetaPayload`) menyensor token/auth dari luaran diagnostik mentah.
     - Pengklasifikasi galat Meta deterministik memetakan kode Meta (190, 200, 4/17/32/613, 36003, 506, dll) ke kelas normalisasi tanpa fabrikasi.
  7. **Integrasi Mission Control & Maya:**
     - Kueri read-only aman `SOCIAL_ADAPTER_QUERY` melaporkan status adapter riil (Meta: TERSEDIA via Disabled Execution / Mock Transport; Otoritas: 0).
     - Seluruh perintah publikasi atau injeksi token via chat ditolak dengan `DANGEROUS_ACTION_FORBIDDEN`.
- **Pengujian & Validasi:**
  - `scripts/test-social-meta-adapter.js` lulus 100% (23/23 tes).
  - Seluruh 11 rangkaian tes regresi lulus 100% (total 241 tes).
  - `npx tsc --noEmit` lulus bersih 0 kesalahan.
  - `npm run build` sukses 100%.
- **Status Akhir:**
  - `SOCIAL-S3 = COMPLETE`.
  - Frontier berikutnya: `SOCIAL-S3.5/READY` (Meta Credential & Account Binding Readiness / Operator-Gated Connection).

### SOCIAL-S2: Mission Control Social Department & Staff Integration (Read-Only / Shadow) 2026-10-01

- **Tujuan & Ruang Lingkup:**
  - Mengintegrasikan domain media sosial internal (SOCIAL-S1) ke dalam Hermes Mission Control dan visualisasi spasial Pixel Office sebagai departemen operasional READ-ONLY / SHADOW tanpa otoritas eksekusi.
  - Strict Safety Invariants: `SOCIAL_AUTOMATION = OFF`, `media_worker = DISABLED`, `JEV = shadow`, `automation_mode = OFF`.
  - Zero External Calls & Zero Credential Leaks: Tidak ada pemanggilan API ke penyedia media sosial eksternal dan tidak ada token/kredensial yang didaftarkan.
  - No Fake Work / No Theatrical Activity: Mematuhi invarian ketat MC-9 `NO REAL SOCIAL JOB = NO SOCIAL WORK ANIMATION`.
- **Komponen Utama yang Diintegrasikan:**
  1. **Aktivasi Departemen Sosial Kanonikal (`AVAILABLE_READ_ONLY`):**
     - Departemen `social` ditransisikan dari `NOT_AVAILABLE` (unstaffed) ke mode bayangan `AVAILABLE_READ_ONLY` dengan staf terdaftar (`is_staffed: true`).
     - Menyediakan fungsi aktivasi/deaktivasi dinamis kanonikal `activateSocialDepartmentShadow()` dan `deactivateSocialDepartmentShadow()` untuk observabilitas tanpa merusak invarian unstaffed awal pada tes legacy.
  2. **Pendaftaran Identitas Staf Spesialis Pertama (Maya):**
     - Mendaftarkan `agent_id = 'social_distribution_operator'`, `display_name = 'Maya'`, `role = 'Social Content & Distribution Specialist'`, avatar `social_specialist_01`.
     - Memetakan 5 kapabilitas kanonikal (`SOCIAL_DISTRIBUTION`, `SOCIAL_COPY_WRITING`, `CAROUSEL_CURATION`, `SOCIAL_QA_SUPPORT`, `SOCIAL_SCHEDULING_OBSERVATION`) yang seluruhnya bertipe `AVAILABLE_READ_ONLY` dengan 0 otoritas eksekusi.
  3. **Penurunan Status Operasional & Spasial Deterministik:**
     - Ketika tidak ada tugas sosial riil: Maya berada di status `IDLE` dan duduk santai di Lounge (`lounge`) dengan animasi `IDLE_STANDBY` (zero fake work).
     - Ketika ada tugas riil pembuatan draf/teks: Maya berada di status `WORKING` di `social_workstation` dengan animasi `ARTICLE_TYPING`.
     - Ketika ada tugas kurasi media/carousel: animasi `MEDIA_REVIEW`.
     - Ketika ada tugas review QA sosial: status `REVIEWING` dengan animasi `QA_REVIEW`.
     - **Invarian Keselamatan Kritis:** Varian berstatus `PENDING_APPROVAL` (menunggu persetujuan Chief Editor) atau `SCHEDULED` saat `SOCIAL_AUTOMATION = OFF` (tertahan di outbox) secara ketat TIDAK memalsukan animasi penerbitan; Maya tetap berada di Lounge dalam status `IDLE`.
     - Tugas gagal/terblokir: status `BLOCKED` dengan suar peringatan `BLOCKED_WARNING` di `social_workstation`.
     - Tugas selesai (`COMPLETED`): Maya kembali rehat di Lounge (`IDLE_STANDBY`).
  4. **Adaptor Telemetri & Ringkasan Departemen (`getSocialOperationsSummary`):**
     - Mengagregasi metrik riil dari tabel D1 (`social_campaigns`, `social_post_variants`, `social_staging_outbox`, `social_execution_receipts`) ke dalam `MissionControlSnapshot.social` tanpa mengekspos konsep mentah platform.
  5. **Integrasi Chat Langsung MC-5:**
     - Memperbolehkan kueri read-only aman (`SOCIAL_STATUS_QUERY`, `SOCIAL_CAMPAIGN_REVIEW`, `SOCIAL_OUTBOX_REVIEW`, `CURRENT_TASK_QUERY`, `ACTIVITY_SUMMARY_QUERY`).
     - Menolak seluruh perintah destruktif, perintah publikasi langsung, maupun eskalasi hak istimewa secara fail-closed.
  6. **Integrasi Anomali MC-6:**
     - Mengisolasi `SOCIAL_AUTOMATION_OFF` sebagai kondisi yang diharapkan (`EXPECTED` / `INFO`) tanpa memicu alarm palsu.
     - Mendeteksi kampanye sosial terhenti (`SOCIAL_CAMPAIGN_BLOCKED`) sebagai `WARNING` dan mengeskalasikannya ke Maya secara deterministik.
- **Pengujian & Validasi:**
  - Rangkaian pengujian terfokus `scripts/test-social-mission-control.js` lulus 100% (15/15 tes).
  - Seluruh 10 rangkaian tes regresi Mission Control, Social Domain, dan SOAK safety lulus 100% (total 218 tes).
  - TypeScript typecheck (`npx tsc --noEmit`) lulus bersih 0 kesalahan.
  - Astro build SSR (`npm run build`) sukses 100%.
- **Status Akhir:**
  - `SOCIAL-S2 = COMPLETE`.
  - Frontier saat ini: `SOCIAL-S3/READY` (First Platform Adapter: Meta Graph API Facebook Page + Instagram Business).

### SOCIAL-S1: Social Domain Model, Staging Outbox & D1 Schema 2026-10-01

- **Tujuan & Ruang Lingkup:**
  - Membangun fondasi model domain internal, skema persistensi D1, gerbang persetujuan kriptografis, dan antrean keluar (*Staging Outbox*) untuk pipeline distribusi media sosial RancangLoka.
  - Strict Safety Invariants: `SOCIAL_AUTOMATION = OFF`, `media_worker = DISABLED`, `JEV = shadow`, `department_availability = 'NOT_AVAILABLE'`.
  - Zero External Provider Calls: Tidak ada pemanggilan API ke Meta, Facebook, Instagram, TikTok, YouTube, LinkedIn, atau X.
  - Zero Fake Activity: Tidak ada pendaftaran agen baru di Pixel Office (`Maya` belum aktif), tidak ada animasi kerja fiktif.
- **Komponen Utama yang Dibangun:**
  1. **Migrasi Basis Data Cloudflare D1 (`0026_social_domain_and_outbox.sql`):**
     - `social_campaigns`: Mengikat provenans ke `publication_execution_receipts` via batasan unik `source_receipt_id`.
     - `social_post_variants`: Varian platform (`facebook_page`, `instagram_business`, dsb.) dengan indeks parsial unik `uq_active_variant_per_campaign_platform`.
     - `social_variant_approvals`: Log persetujuan operator yang mengikat `approved_payload_hash`.
     - `social_staging_outbox`: Antrean outbox terjadwal dengan kesiapan leasing compare-and-set dan audit retry.
     - `social_execution_receipts`: Kuitansi eksternal imutabel untuk audit hasil publikasi pihak ketiga.
  2. **Model Domain & Mesin Status Deterministik (`src/lib/social/`):**
     - `state-machine.ts`: Validasi transisi status eksplisit untuk kampanye, varian, dan outbox; transisi ilegal ditolak fail-closed; status UNKNOWN dipertahankan tanpa inferensi kesuksesan palsu.
     - `approval.ts`: Penghitungan hash deterministik (`computeVariantPayloadHash`). Setiap perubahan teks caption atau aset media otomatis membatalkan persetujuan terdahulu (`PAYLOAD_MUTATED_SINCE_APPROVAL`).
     - `service.ts`: Fungsi domain kanonik (`createCampaignFromPublishedReceipt`, `createPostVariant`, `updateVariantDraft`, `approveVariant`, `scheduleVariantToOutbox`, `cancelVariant`, `markVariantBlocked`, `recordExecutionReceipt`, `getSocialOutboxSnapshot`, `getSocialDomainTelemetry`).
  3. **Penegakan Keselamatan Penjadwalan Outbox:**
     - Penjadwalan varian ke outbox mewajibkan status `APPROVED` dengan payload hash yang cocok secara kriptografis.
     - Mode keselamatan `SOCIAL_AUTOMATION = OFF` menjamin jumlah item yang memenuhi syarat eksekusi selalu nol (`eligible_count = 0`).
- **Pengujian & Verifikasi:**
  - Membuat test suite `scripts/test-social-domain.js` (22/22 skenario uji lulus 100%).
  - Memverifikasi regresi Mission Control (MC-1 s.d. MC-9, soak safety 54 uji) tetap lulus 100%.
  - TypeScript typecheck (`npx tsc --noEmit`) lulus 0 kesalahan.
  - Astro production build (`npm run build`) berhasil 100%.
- **Status Akhir:**
  - `SOCIAL-S1 = COMPLETE`.
  - Frontier saat ini: `SOCIAL-S1/COMPLETE`.

### SOCIAL-S0: Social Media Automation Architecture & Discovery 2026-10-01

- **Tujuan & Ruang Lingkup:**
  - Melakukan audit inventaris kapabilitas media sosial di repositori, menetapkan batas langganan provenans artikel web terbit (`publication_execution_receipts`), mendesain batas adaptor platform agnostik vendor, dan merumuskan roadmap bertahap dari S0 hingga S5.
  - Menghasilkan dokumen arsitektur resmi: `docs/SOCIAL_S0_ARCHITECTURE_DISCOVERY.md`.
- **Status Akhir:**
  - `SOCIAL-S0 = COMPLETE`.

### HERMES-MC-9: Mission Control Role & Job Animation Layer 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Mengembangkan lapisan animasi peran dan tugas (*Role & Job Animation Layer*) untuk dasbor Pixel Office Hermes Mission Control.
  - Memastikan setiap staf menampilkan animasi visual yang sesuai secara deterministik hanya jika terdapat tugas riil yang sedang diproses (`REAL TASK` → `CAPABILITY` → `STAFF` → `JOB VISUAL STATE` → `ROLE-SPECIFIC ANIMATION`).
  - Strict Presentation-Only Invariant: Dilarang keras merekayasa aktivitas (*zero fake work*), menggerakkan staf secara acak (*zero random movement*), atau mengubah otoritas eksekusi produksi (`automation_mode = OFF`, `media_worker = DISABLED`, `JEV = shadow / zero authority`).
- **Komponen Utama yang Dibangun:**
  1. **Model Status Visual Pekerjaan (`StaffWorkVisualState`):**
     - Didefinisikan pada `src/lib/mission-control/job-animation-registry.ts`.
     - Menyimpan atribut: `agent_id`, `capability_id`, `task_id`, `task_type`, `task_status`, `task_label`, `animation_key`, `workstation_key`, `visual_detail`, `started_at`, `freshness`, `evidence_reference`, dan `is_actively_working`.
  2. **Registri Animasi Sentral (`JOB_ANIMATION_REGISTRY`):**
     - Mengelola 17 kunci animasi standar: `IDLE_STANDBY`, `ARTICLE_TYPING`, `ARTICLE_REWRITE`, `RESEARCH_BROWSING`, `EVIDENCE_READING`, `QA_REVIEW`, `QA_CHECKLIST`, `MEDIA_PROCESSING`, `MEDIA_REVIEW`, `PUBLICATION_MONITORING`, `PUBLICATION_DISPATCH`, `TELEMETRY_MONITORING`, `JEV_ANALYSIS`, `BLOCKED_WARNING`, `OFFLINE_DISABLED`, `UNKNOWN_NEUTRAL`, `WORKING_GENERIC`.
  3. **Visualisasi Spesifik Peran Staf:**
     - **Joko (Content Writer):** `ARTICLE_TYPING` (mengetik naskah) dan `ARTICLE_REWRITE` (revisi) hanya saat tugas aktif berjalan; `IDLE_STANDBY` di Lounge saat kosong.
     - **Irwan (Research & Evidence):** `RESEARCH_BROWSING` (riset standar bangunan) dan `EVIDENCE_READING` (evaluasi sitasi).
     - **Rina (Editorial QA):** `QA_REVIEW` (review naskah) dan `QA_CHECKLIST` (pemeriksaan checklist First Article Gate, bukan persetujuan otomatis).
     - **Budi (Media Operations):** Tetap `OFFLINE_DISABLED` (lencana Worker Disabled, konsol temaram, tanpa alarm) karena `media_worker = DISABLED`.
     - **Sari (Publication Operations):** `PUBLICATION_MONITORING` (pemantauan jadwal terencana) karena `automation_mode = OFF`; tidak pernah berpura-pura melakukan `PUBLICATION_DISPATCH`.
     - **Dimas (Engineering & Telemetry):** `TELEMETRY_MONITORING` dan `JEV_ANALYSIS` (hanya saat evaluasi bayangan aktif, zero publication authority).
  4. **Pembedaan Status Antrean Perintah (MC-5):**
     - `QUEUED`: Staf tetap di Lounge dengan `IDLE_STANDBY` (tidak mengetik atau bekerja prematur).
     - `RUNNING`: Staf berpindah ke workstation dan menampilkan animasi kerja spesifik peran.
     - `COMPLETED`: Animasi kerja berhenti seketika dan staf kembali ke Lounge.
  5. **Label Tugas Riil & Modal Inspektur:**
     - Menampilkan label ringkas dari judul tugas nyata (misal `Menulis: Struktur Beton Bertulang`), tanpa teks rekayasa.
     - Modal inspeksi staf menyajikan rincian animasi, deskripsi visual, status kesegaran telemetri, dan penanda `⚡ Visualisasi berdasarkan telemetry nyata`.
  6. **Aksesibilitas & Performa Ringan:**
     - Didukung penuh oleh CSS murni berakselerasi perangkat keras (zero game engine / Phaser / PixiJS).
     - Mematuhi preferensi `prefers-reduced-motion` (menonaktifkan seluruh loop animasi dan pernapasan tanpa menghilangkan konteks spasial dan teks).
- **Pengujian & Verifikasi:**
  - Membuat test suite `scripts/test-mission-control-job-animation.js` (21 skenario uji lulus 100%).
  - Menjalankan seluruh rangkaian regresi Mission Control (MC-1 s.d. MC-8, soak safety, TypeScript typecheck, Astro build) dengan hasil lulus 100%.
  - Verifikasi browser live pada production URL (`https://rancangloka.com/admin/mission-control/office`) memvalidasi tampilan denah, tata letak staf, lencana siaga/offline, dan interaktivitas modal inspektur.
- **Deployment Produksi:**
  - Deployment presentasi berhasil ke Cloudflare Workers (`npx wrangler deploy`).
  - Current Version ID: `b2f29a65-643c-4ce3-9e5e-8af93c3cc560`.
  - Zero schema change / zero database migration.
- **Status Akhir:**
  - `HERMES-MC-9 = COMPLETE`.
  - Frontier saat ini: `HERMES-MC-9/COMPLETE`.

### HERMES-MC-8: Mission Control Production Hardening & Go-Live Readiness 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Melakukan audit kesiapan produksi komprehensif, verifikasi skema database D1, audit autentikasi/otorisasi, mitigasi kebocoran rahasia, penerapan migrasi produksi, deployment terkendali Cloudflare Workers, dan pengujian asap live (smoke testing) untuk seluruh tumpukan Hermes Mission Control (MC-1 s.d. MC-7).
  - Invarian Keselamatan Produksi Wajib (Strict Safety Invariants):
    - `automation_mode = OFF` dipertahankan secara absolut.
    - `media_worker = DISABLED` dipertahankan secara absolut.
    - `JEV_MODE = shadow` (otoritas eksekusi = 0) dipertahankan secara absolut.
    - Zero autonomous article publication (tidak ada artikel yang diterbitkan otomatis).
    - Zero real media jobs (tidak ada eksekusi AI/gambar berbayar fiktif).
    - Zero Social activation (departemen Social tetap nonaktif / unstaffed).
    - Mission Control beroperasi secara murni sebagai infrastruktur pengawasan operasional (*supervisory infrastructure*).
- **Audit & Eksekusi Migrasi Produksi (Cloudflare D1):**
  - Mengaudit status migrasi remote D1 `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`):
    - `0024_mission_control_chat_and_commands.sql`: Dinilai `MIGRATION_0024_SAFE = true` (100% aditif, membuat tabel `mission_control_conversations`, `mission_control_messages`, `mission_control_commands` beserta indeks terkait tanpa DROP atau ALTER destruktif).
    - `0025_mission_control_anomalies.sql`: Dinilai `MIGRATION_0025_SAFE = true` (100% aditif, membuat tabel `mission_control_anomalies`, `mission_control_anomaly_events` beserta indeks terkait tanpa modifikasi tabel inti).
  - Menerapkan kedua migrasi secara terpisah dan berurutan pada basis data remote D1 produksi (`npx wrangler d1 migrations apply rancangloka_db --remote`).
  - Memverifikasi keberadaan seluruh tabel dan indeks baru, serta memvalidasi invarian jumlah baris tabel inti sebelum vs sesudah migrasi: `articles = 6`, `article_publication_plans = 1`, `media_jobs = 0`, `publication_execution_receipts = 1`, `automation_control.mode = OFF`, `kill_switch_engaged = 0` (zero unexpected delta).
- **Audit Autentikasi & Otorisasi:**
  - Seluruh rute antarmuka pengguna (`/admin/mission-control`, `/staff`, `/departments`, `/office`, `/alerts`, `/staff/[agent_id]/chat`) dilindungi middleware sesi admin. Permintaan tanpa autentikasi dialihkan dengan kode HTTP 302 ke `/admin/login`.
  - Seluruh endpoint API internal (`/api/admin/mission-control/state`, `/alerts`, `/chat/[agent_id]`) dilindungi dan mengembalikan HTTP 401 UNAUTHORIZED untuk permintaan tanpa sesi valid.
  - Perintah chat divalidasi dengan model otoritas 4-tier: permintaan `READ_ONLY` dijawab dari telemetri; perintah `OPERATOR_COMMAND` dimasukkan ke antrean teraudit; permintaan tingkat tinggi `ADMIN_CONTROL` (misal aktivasi worker/kill switch) dan `DANGEROUS_PRODUCTION_ACTION` (misal force publish, raw SQL, raw shell) ditolak fail-closed dengan kode kesalahan eksplisit.
- **Deployment Produksi Cloudflare Workers:**
  - Build produksi Astro dan deployment Cloudflare Workers berhasil (`npm run deploy`):
    - **Deployment Version ID:** `5caeb3bf-91e6-4bc2-b67b-c1765b2a3110` (aktif 100% di produksi).
    - **Previous Deployment Version:** `fa1c8b93-b410-4800-8296-f4c88e5d809e`.
    - **Source Git Commit:** `97e4eb90c07b0ccf703dd8423f8971b37b837253`.
- **Pengujian Asap & Verifikasi Live (Smoke Tests):**
  - Uji negatif keamanan live memverifikasi pengalihan 302 dan respons 401 fail-closed pada domain publik `https://rancangloka.com`.
  - Uji interaksi live pada tabel D1 memverifikasi persistensi percakapan staf (`conv_evidence_researcher_lead`) dan penolakan otomatis perintah di luar allowlist (`COMMAND_NOT_ALLOWED`) tanpa eksekusi mutasi operasional.
  - Uji anomali memverifikasi kondisi istirahat terencana (`media_worker = DISABLED`, `automation_mode = OFF`) dipetakan sebagai status yang diharapkan (`EXPECTED` / `INFO`) tanpa memicu alarm merah darurat.
  - Seluruh suite pengujian lokal (MC-1 s.d. MC-7, soak safety, TypeScript typecheck, Astro production build) lulus 100%.
- **Dokumentasi & Prosedur Rollback:**
  - Membuat dokumen panduan operasional dan kesiapan go-live: `docs/HERMES_MC_8_PRODUCTION_HARDENING.md`.
  - Mendokumentasikan prosedur rollback cepat Cloudflare Worker (`npx wrangler rollback fa1c8b93-b410-4800-8296-f4c88e5d809e`), strategi forward-fix skema D1, serta saklar darurat global (Emergency Kill Switch).
- **Status Akhir:**
  - `HERMES-MC-8 = COMPLETE`.
  - Klasifikasi Go-Live: **`PRODUCTION_READY`**.
  - Frontier saat ini: `HERMES-MC-8/COMPLETE`.
  - Seluruh target milestone Hermes Mission Control (MC-1 s.d. MC-8) telah selesai diimplementasikan, dikeraskan, dimigrasikan, dan diterapkan di lingkungan produksi.

### HERMES-MC-7: Extensible Department Architecture & Organizational Expansion Framework 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Mengonversi arsitektur organisasi Mission Control dari struktur 6 departemen dan 6 staf yang bersifat fixed/hardcoded menjadi kerangka kerja extensible berbasis kontrak registri modular:
    1. **Kontrak Registri Kapabilitas (`MissionControlCapabilityDefinition`):** Mendefinisikan kapabilitas mesin operasional kanonikal (`ARTICLE_WRITING`, `EVIDENCE_RESEARCH`, `EDITORIAL_QA`, `MEDIA_OPERATIONS`, `PUBLICATION_OPERATIONS`, `SYSTEM_TELEMETRY`, `SOCIAL_DISTRIBUTION`), keluarga perintah (`command_families`), read models, dan kelas anomali.
    2. **Kontrak Plugin Departemen (`MissionControlDepartmentDefinition`):** Mendefinisikan unit organisasi, ketersediaan operasional, adapter kesehatan/tugas/aktivitas, metadata ruangan, zona kerja, urutan tampil, dan fungsionalitas registrasi dinamis (`registerDepartment`, `unregisterDepartment`, `resetDepartmentRegistry`, `getRegisteredDepartments`).
    3. **Kontrak Registri Peran Staf (`MissionControlStaffDefinition`):** Menstandarisasi model identitas staf persona manusia di atas ID mesin kanonikal, mendukung pemetaan kapabilitas fleksibel, serta registrasi dinamis (`registerStaffMember`, `unregisterStaffMember`, `resetStaffRegistry`, `getStaffDefinitions`).
  - Menghilangkan asumsi organisasi kaku dari komponen generik:
    - Pixel Office merender ruangan secara dinamis dari `getRegisteredDepartments()` dengan ruang `Executive Lounge` (`lounge`) terintegrasi sebagai area rehat siaga bersama. Ruang yang belum tersedia secara runtime dirender sebagai `COMING LATER • NOT AVAILABLE`.
    - Pixel Office merender sprite karakter secara dinamis dari seluruh staf aktif yang terdaftar dalam registri.
    - Atribusi tugas (`attributeTaskOwnership`) mendukung perutean berbasis kapabilitas (`task.capability_id -> capability -> department -> staff`) serta pencocokan subsystem departemen terdaftar, dengan fallback fail-safe ke `UNASSIGNED`.
    - Perutean anomali (`routeAnomalyByCapability`) memetakan anomali ke departemen dan staf berdasarkan metadata kapabilitas terdaftar.
    - Penemuan perintah chat (`getAllowlistedCommandsForAgent`) menyelesaikan allowlist perintah dari kapabilitas staf tanpa eksekusi arbitrer.
  - Membangun model baca terpadu organisasi: `getMissionControlOrganization(snapshot)` dan endpoint API `/api/admin/mission-control/organization`.
  - Mempertahankan integritas departemen Social: `social` tetap terdaftar dengan status `NOT_AVAILABLE` dan `is_staffed: false` tanpa pembuatan agen palsu atau pipa penerbitan media sosial fiktif (track independen `SOCIAL-S0+`).
- **Pengujian & Validasi:**
  - Rangkaian pengujian ekspansi terfokus `scripts/test-mission-control-expansion.js` lulus 100% (12/12 tes) memverifikasi: registrasi dinamis departemen/staf/kapabilitas, penolakan duplikasi ID, resolusi kepemilikan kapabilitas, atribusi tugas & anomali dinamis, resolusi allowlist chat, ruangan & sprite Pixel Office dinamis, pemisahan display name vs machine ID, invarian unstaffed Social, model organisasi kanonikal, serta integritas deregistrasi dan reset.
  - Pengujian Anomali `scripts/test-mission-control-anomalies.js` lulus 100% (20/20 tes).
  - Pengujian Chat `scripts/test-mission-control-chat.js` lulus 100% (20/20 tes).
  - Pengujian Pixel Office `scripts/test-mission-control-pixel-office.js` lulus 100% (20/20 tes).
  - Pengujian Departemen `scripts/test-mission-control-departments.js` lulus 100% (18/18 tes).
  - Pengujian Staff Registry `scripts/test-staff-registry.js` lulus 100% (16/16 tes).
  - Pengujian Mission Control `scripts/test-mission-control.js` lulus 100% (10/10 tes).
  - Pengujian regresi keselamatan `scripts/test-soak-safety.js` lulus 100% (54/54 tes).
  - Validasi tipe `npx tsc --noEmit` lulus bersih tanpa kesalahan.
  - Build produksi `npm run build` sukses (4.80s).
- **Status Akhir:**
  - `HERMES-MC-7 = COMPLETE`.
  - Frontier saat ini: `HERMES-MC-8/READY`.

### HERMES-MC-6: Mission Control Anomaly Detection & Staff Escalation 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Membangun lapisan normalisasi anomali kanonikal dan eskalasi staf otomatis untuk Hermes Mission Control pada rute `/admin/mission-control/alerts` dan API `/api/admin/mission-control/alerts`.
  - Mengisolasi kondisi terencana (*Expected Dormancy*, seperti `media_worker = DISABLED` dan `automation_mode = OFF`) sebagai `INFO` / `EXPECTED` sehingga tidak memicu alarm palsu, eskalasi darurat, atau kenaikan badge counter.
  - Menerapkan model anomali deterministik `MissionControlAnomaly` yang menormalisasi kegagalan retry media, breaker open, kill switch aktif, fallback/error JEV, detak jantung scheduler stale/offline, antrean dead-letter outbox, serta kegagalan validasi/QA naskah.
  - Memetakan anomali ke staf penanggung jawab secara deterministik (Budi: Media, Sari: Publikasi, Dimas: Telemetri/Jev, Joko: Penulisan, Rina: QA, Irwan: Riset). Masalah infrastruktur yang ambigu dibiarkan unassigned (`responsible_agent_id = null`) tanpa menyalahkan staf persona.
  - Menerapkan deduplikasi cerdas berbasis fingerprint (`createAnomalyFingerprint`): anomali berulang menaikkan `occurrence_count` dan memperbarui `last_seen_at` tanpa menduplikasi baris database atau membanjiri pesan chat.
  - Menghubungkan anomali ke Pixel Office: sprite staf dan denah ruang menampilkan indikator peringatan visual proporsional tanpa animasi kepanikan berlebihan.
  - Menghubungkan eskalasi staf ke chat MC-5: saat anomali actionable pertama kali terdeteksi pada staf, sistem mengirimkan pesan laporan operasional ke thread staf. Pesan ini 100% informasional dan tidak memiliki otoritas eksekusi perintah otomatis.
  - Deteksi pemulihan otomatis (*Automatic Resolution*): ketika kondisi yang mendasarinya pulih (misal heartbeat kembali sehat atau circuit breaker tertutup), anomali bertransisi menjadi `RESOLVED` dengan timestamp `resolved_at` dan dipertahankan dalam riwayat audit.
  - Menjaga invarian read-only murni: snapshot generator dan Alert Center memiliki 0 mutasi remediasi sembrono (tanpa tombol coba ulang, tanpa paksa terbit, tanpa bypass breaker).
- **Skema Database & Persistensi (Migration 0025):**
  - `mission_control_anomalies`: Menyimpan anomali ternormalisasi, fingerprint, status siklus hidup, dan counter rekurensi.
  - `mission_control_anomaly_events`: Menyimpan riwayat audit kejadian transisi anomali.
- **Pengujian & Validasi:**
  - Rangkaian pengujian terfokus `scripts/test-mission-control-anomalies.js` lulus 100% (20/20 tes) memverifikasi: deteksi retry exhausted, isolasi worker disabled & automation OFF sebagai EXPECTED, penanganan JEV fallback, circuit breaker OPEN, heartbeat stale/offline, dead-letter outbox, stabilitas fingerprint, supresi duplikasi, penugasan staf deterministik, isolasi isu infrastruktur ambigu, overlay Pixel Office, pengaruh ke kesehatan departemen, pesan eskalasi chat tunggal tanpa spam, pembaruan eskalasi keparahan, resolusi otomatis & retensi riwayat, redaksi rahasia, serta ketiadaan kontrol mutasi/remediasi berbahaya.
  - Pengujian Chat `scripts/test-mission-control-chat.js` lulus 100% (20/20 tes).
  - Pengujian Pixel Office `scripts/test-mission-control-pixel-office.js` lulus 100% (20/20 tes).
  - Pengujian Departemen `scripts/test-mission-control-departments.js` lulus 100% (18/18 tes).
  - Pengujian Staff Registry `scripts/test-staff-registry.js` lulus 100% (16/16 tes).
  - Pengujian Mission Control `scripts/test-mission-control.js` lulus 100% (10/10 tes).
  - Pengujian regresi keselamatan `scripts/test-soak-safety.js` lulus 100% (54/54 tes).
  - Validasi tipe `npx tsc --noEmit` lulus bersih tanpa kesalahan.
  - Build produksi `npm run build` sukses (4.91s).
- **Status Akhir:**
  - `HERMES-MC-6 = COMPLETE`.
  - Frontier saat ini: `HERMES-MC-7/READY`.

### HERMES-MC-5: Direct Staff Interaction & Safe Operator Command Queue 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Mengimplementasikan interaksi percakapan langsung antara operator dan staf bernama Mission Control (Joko, Irwan, Rina, Budi, Sari, Dimas) melalui antarmuka thread percakapan persisten (`/admin/mission-control/staff/[agent_id]/chat`) dan API terautentikasi (`/api/admin/mission-control/chat/[agent_id]`).
  - Menetapkan prinsip dasar keselamatan sistem: identitas staf manusia adalah identitas presentasi (*presentation identity*) dan BUKAN daemon eksekusi otonom. Tidak ada eksekusi shell, raw SQL, atau MCP tanpa batas dari teks bebas operator.
  - Membangun antrean perintah operator berstruktur (*Safe Operator Command Queue*) yang memisahkan tingkat otoritas:
    - `READ_ONLY`: Kueri operasional langsung dieksekusi terhadap read-model snapshot tanpa mutasi.
    - `OPERATOR_COMMAND`: Perintah dalam allowlist masuk ke antrean tugas kanonikal berstatus `QUEUED`.
    - `ADMIN_CONTROL`: Perintah kontrol sistem ditolak dengan `ADMIN_APPROVAL_REQUIRED`.
    - `DANGEROUS_PRODUCTION_ACTION`: Aksi produksi berbahaya (publish, buka kunci) ditolak secara tegas (`DANGEROUS_ACTION_FORBIDDEN`).
  - Menerapkan normalisasi intensi deterministik (`normalizeOperatorIntent`) dan resolusi entitas fail-closed (`resolveEntityReference`) yang menolak rujukan ambigu (`tadi`, `terakhir`, `barusan`, tanpa ID/slug jelas) dan menuntut klarifikasi operator di dalam thread.
  - Menghilangkan theatrical realism (tidak ada fake typing, tidak ada simulated progress, tidak ada fake presence/online indicators).
  - Mengintegrasikan navigasi chat dari modal Pixel Office (`/admin/mission-control/office`) dan panel Staff Registry (`/admin/mission-control/staff`).
- **Skema Database & Persistensi (Migration 0024):**
  - `mission_control_conversations`: Menyimpan thread percakapan per staf machine `agent_id`.
  - `mission_control_messages`: Menyimpan pesan dengan tipe `TEXT`, `COMMAND_REQUEST`, `COMMAND_STATUS`, `TASK_RESULT`, `SYSTEM_NOTICE`, `ERROR`, serta tautan `related_command_id` dan `related_task_id`.
  - `mission_control_commands`: Menyimpan antrean perintah dengan status siklus hidup (`QUEUED`, `ACCEPTED`, `RUNNING`, `COMPLETED`, `REJECTED`, `BLOCKED`, `FAILED`, `CANCELLED`).
  - Redaksi rahasia otomatis pada pesan dan input menggunakan `redactSensitiveString`.
- **Pengujian & Validasi:**
  - Rangkaian pengujian terfokus `scripts/test-mission-control-chat.js` lulus 100% (20/20 tes) memverifikasi: persistensi percakapan & pesan, resolusi agent_id stabil, eksekusi kueri read-only, antrean perintah allowlisted, penolakan eskalasi otoritas, resolusi entitas ambigu fail-closed, penolakan staf tidak dikenal, deteksi mismatch kapabilitas, siklus hidup antrean perintah, tautan referensi tugas, redaksi rahasia, keamanan SQL/shell, dan pencegahan kontrol admin/publikasi via chat.
  - Pengujian Pixel Office `scripts/test-mission-control-pixel-office.js` lulus 100% (20/20 tes).
  - Pengujian Departemen `scripts/test-mission-control-departments.js` lulus 100% (18/18 tes).
  - Pengujian Staff Registry `scripts/test-staff-registry.js` lulus 100% (16/16 tes).
  - Pengujian Mission Control `scripts/test-mission-control.js` lulus 100% (10/10 tes).
  - Pengujian regresi keselamatan `scripts/test-soak-safety.js` lulus 100% (54/54 tes).
  - Validasi tipe `npx tsc --noEmit` lulus bersih tanpa kesalahan.
  - Build produksi `npm run build` sukses (4.91s).
- **Status Akhir:**
  - `HERMES-MC-5 = COMPLETE`.
  - Frontier saat ini: `HERMES-MC-6/READY`.

### HERMES-MC-4: RancangLoka Pixel Office — Spatial Operations Visualization 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Membangun visualisasi spasial 2D Pixel Office pertama untuk Hermes Mission Control pada rute `/admin/mission-control/office` dan API `/api/admin/mission-control/office`.
  - Menerjemahkan status operasional nyata staf dan departemen ke dalam denah kantor spasial retro deterministik (bukan simulasi game; tanpa fabrikasi tugas, tanpa berkeliaran/wandering acak, tanpa obrolan sintetis).
  - Mengamankan invarian pengawasan *read-only*: dilarang menerapkan chat staf langsung, eksekusi perintah, tombol publish, tombol retry, pengaktifan media worker, pengubahan otomasi publikasi, maupun otoritas JEV.
  - Memetakan staf dan ruangan secara deterministik:
    - `WORKING`: Staf berada di meja kerja departemen masing-masing (Joko di meja tulis editorial, Irwan di lab riset, Budi di konsol media, Sari di konsol publikasi, Dimas di konsol telemetri).
    - `REVIEWING`: Rina ditempatkan di meja review editorial (`editorial_review_desk`).
    - `IDLE`: Staf siaga ditempatkan di Executive Lounge (`lounge_seat_1` .. `6`).
    - `BLOCKED`: Staf tetap di departemen dengan suar peringatan kritis berdenyut (*pulsing warning beacon*).
    - `OFFLINE`: Membedakan secara visual penonaktifan sengaja (Budi: `media_worker = DISABLED` ditampilkan sebagai `Worker Disabled`, redup/dimmed, tanpa suar darurat merah) vs kegagalan telemetri (daemon offline ditampilkan `Offline` dengan peringatan).
    - `UNKNOWN`: Posisi netral di ruang asal dengan label eksplisit `UNKNOWN`.
    - `social_room`: Secara ketat unstaffed dan berlabel jelas `COMING LATER • NOT AVAILABLE`.
  - Menggunakan aset SVG pixel-art lokal berbobot ultra-ringan (`image-rendering: pixelated;`), tanpa engine game berat (bebas Phaser/Unity), serta mendukung penuh preferensi aksesibilitas `prefers-reduced-motion`.
- **Komponen & Arsitektur Terpasang (`src/lib/mission-control/pixel-office.ts`):**
  1. **Registri Posisi Kantor (`OFFICE_POSITIONS`):** 13 titik koordinat persentase stabil di 6 ruangan departemen, lounge, dan social bay kosong.
  2. **Evaluasi Alasan Status (`evaluateStateReason`):** Pembedaan deterministik antara `INTENTIONAL_DISABLED` vs `TELEMETRY_OFFLINE`.
  3. **Penurunan Spasial Sprite (`deriveSpriteSpatialState`):** Pemetaan posisi non-overlapping, penentuan mode visual (`ACTIVE`, `IDLE`, `REVIEWING`, `BLOCKED`, `DIMMED`, `UNKNOWN`), dan tingkat peringatan.
  4. **Master Assembler Snapshot (`getPixelOfficeState`):** Agregasi snapshot spasial kantor lengkap dengan metrik ringkasan staf, ruangan, dan event aktivitas riil D1.
- **Antarmuka & Rute Web:**
  - **Halaman Pixel Office (`/admin/mission-control/office.astro`):** Denah kantor 2D retro bergaya pixel art modern, 6 kartu ruangan departemen/lounge/social, sprite karakter SVG dengan ciri visual unik (rompi & kacamata Joko, seragam riset Irwan, kardigan QA Rina, earphone teknisi Budi, seragam dispatch Sari, hoodie terminal Dimas), status bar operasional, strip aktivitas riil D1, serta modal inspeksi murni read-only untuk staf dan ruangan.
  - **API Pixel Office (`/api/admin/mission-control/office.ts`):** Rute GET terautentikasi sesi admin untuk pertukaran data JSON status spasial kantor.
  - **Integrasi Navigasi (`AdminLayout.astro`, `index.astro`, `staff.astro`, `departments/index.astro`):** Penambahan sub-navigasi 4 tab (Cockpit, Staff Registry, Departemen, Pixel Office) dan breadcrumbs admin.
- **Pengujian & Validasi:**
  - Rangkaian pengujian terfokus `scripts/test-mission-control-pixel-office.js` lulus 100% (20/20 tes) memverifikasi: validitas kunci avatar, ruang asal staf, resolusi posisi, pemetaan WORKING/IDLE/REVIEWING/BLOCKED/OFFLINE/UNKNOWN, pembedaan worker disabled tanpa alarm palsu, kestabilan posisi tanpa tumpang tindih, ruang Social kosong, sifat model read-only (nol mutasi), dukungan reduced-motion, dan akurasi counter ringkasan.
  - Pengujian Departemen `scripts/test-mission-control-departments.js` lulus 100% (18/18 tes).
  - Pengujian Staff Registry `scripts/test-staff-registry.js` lulus 100% (16/16 tes).
  - Pengujian Mission Control `scripts/test-mission-control.js` lulus 100% (10/10 tes).
  - Validasi tipe `npx tsc --noEmit` lulus bersih tanpa kesalahan.
  - Build produksi `npm run build` sukses (5.30s).
  - Pengujian regresi keselamatan `test-soak-safety.js` (54 tes) lulus sempurna.
- **Status Akhir:**
  - `HERMES-MC-4 = COMPLETE`.
  - Frontier saat ini: `HERMES-MC-5/READY`.

### HERMES-MC-3: Mission Control Department Operations & Organizational State 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Mentransformasikan model staf MC-2 menjadi model organisasi kanonikal Mission Control yang deterministik dan read-only di `/admin/mission-control/departments` dan `/admin/mission-control/departments/[department_id]`.
  - Mendaftarkan 6 departemen kanonikal (`editorial`, `research_evidence`, `media`, `publication_operations`, `engineering_telemetry`, `social`), dengan departemen `social` secara tegas berstatus `NOT_AVAILABLE` dan `UNSTAFFED`.
  - Menetapkan model kesehatan departemen dengan hierarki presedensi ketat:
    $$\text{NOT\_AVAILABLE} \succ \text{UNKNOWN} \succ \text{BLOCKED} \succ \text{OFFLINE} \succ \text{DEGRADED} \succ \text{ACTIVE} \succ \text{HEALTHY}$$
  - Memetakan kepemilikan tugas (*Task Ownership*) secara deterministik dengan tingkat kepercayaan (`EXACT`, `DERIVED`, `UNASSIGNED`).
  - Membangun model penyerahan lintas-divisi (*Organizational Handoff Model*) berbasis bukti nyata alur artikel (Riset $\rightarrow$ Penulisan Editorial $\rightarrow$ Operasi Media $\rightarrow$ Publikasi) tanpa merekayasa transisi fiktif.
  - Membangun model hambatan struktural (*Department Blockers*) yang merinci keparahan, kelas kesalahan, sifat retryable, dan kebutuhan tindakan operator.
  - Menyiapkan metadata visual Pixel Office (`room_key`, `workstation_zone`, `STAFF_ROOM_MAP`) untuk persiapan MC-4 tanpa mengimplementasikan kanvas/sprite prematur.
- **Komponen & Arsitektur Terpasang (`src/lib/mission-control/department-registry.ts`):**
  1. **Konfigurasi Departemen Kanonikal:** Definisi 6 divisi, kapabilitas, sistem sumber, dan alokasi ruang logis.
  2. **Atribusi Kepemilikan Tugas (`attributeTaskOwnership`):** Pemetaan tahapan tugas (`writing`, `researching`, `validating`, `editorial_qa`, `waiting_media`, `scheduled`, `ingesting`) ke departemen dan staf penanggung jawab.
  3. **Atribusi Kejadian Departemen (`attributeActivityToDepartment`):** Klasifikasi multi-tabel log audit ke departemen dengan penanda keyakinan.
  4. **Penurunan Hambatan Struktural (`deriveDepartmentBlockers`):** Ekstraksi kendala nyata dari saklar darurat global, pemutus sirkuit terbuka, kegagalan tugas media, dan error provider.
  5. **Model Transisi Alur Kerja (`deriveDepartmentHandoffs`):** Pemetaan status handoff (`PENDING`, `READY`, `COMPLETE`, `BLOCKED`) antar-divisi berdasarkan status relasional D1.
  6. **Penurunan Kesehatan Departemen (`deriveDepartmentHealth`):** Evaluasi kesehatan murni tanpa efek samping berbasis presedensi ketat.
  7. **Assembler Snapshot Organisasi (`getOrganizationSnapshot`, `getDepartmentById`):** Agregasi ringkasan global metrik organisasi dan status spesifik divisi.
- **Antarmuka & Rute Web:**
  - **Halaman Ringkasan Departemen (`/admin/mission-control/departments/index.astro`):** Ringkasan 7 status kesehatan organisasi, diagram alur sekuensial kanonikal, kartu divisi responsif dengan indikator dot beranimasi, dan metrik tugas aktif/hambatan.
  - **Halaman Detail Departemen (`/admin/mission-control/departments/[department_id].astro`):** Dasbor inspeksi mendalam: rincian bukti kesehatan, daftar staf anggota dan statusnya, daftar tugas teratribusi, hambatan aktif, alur handoff, dan kapabilitas.
  - **API Departemen (`/api/admin/mission-control/departments`, `/api/admin/mission-control/departments/[department_id]`):** Endpoint GET terautentikasi sesi admin untuk pertukaran data JSON.
  - **Integrasi Navigasi (`AdminLayout.astro`, `index.astro`, `staff.astro`):** Penambahan sub-navigasi tiga tab (Cockpit, Staff Registry, Departemen) dan breadcrumbs admin.
- **Pengujian & Validasi:**
  - Rangkaian pengujian terfokus `scripts/test-mission-control-departments.js` lulus 100% (18/18 tes) mencakup seluruh invarian: presedensi kesehatan, keanggotaan staf, penanganan Social unstaffed, atribusi tugas dan aktivitas, penurunan handoff nyata, isolasi blocker, metadata ruang Pixel Office, dan sifat read-only murni (0 mutasi).
  - Pengujian Staff Registry `scripts/test-staff-registry.js` lulus 100% (16/16 tes).
  - Pengujian Mission Control `scripts/test-mission-control.js` lulus 100% (10/10 tes).
  - Validasi tipe `npx tsc --noEmit` lulus bersih tanpa kesalahan.
  - Build produksi `npm run build` sukses membuat artefak Cloudflare Worker (6.72s).
  - Pengujian regresi keselamatan `test-soak-safety.js` (54 tes) lulus sempurna.
- **Status Akhir:**
  - `HERMES-MC-3 = COMPLETE`.
  - Frontier saat ini: `HERMES-MC-4/READY`.

### HERMES-MC-2: Staff Identity & Capability Registry Implementation 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Membangun registri staf presentasi human-friendly di Mission Control pada rute `/admin/mission-control/staff` dan API `/api/admin/mission-control/staff`.
  - Memisahkan identitas tampilan berbasis persona manusia (Joko, Irwan, Rina, Budi, Sari, Dimas) dengan identitas mesin kanonikal (`agent_id`), di mana identitas mesin tetap otoritatif untuk seluruh perutean, atribusi tugas, dan evaluasi status.
  - Memungkinkan konfigurasi nama tampilan terpusat (`configureStaffDisplayNames`) tanpa mengubah perutean runtime maupun skema database.
  - Menerapkan penurunan status operasional riil (`WORKING`, `IDLE`, `REVIEWING`, `BLOCKED`, `OFFLINE`, `UNKNOWN`) 100% berbasis telemetri nyata tanpa fabrikasi tugas atau status simulasi.
  - Menetapkan aturan tugas saat ini (*Current Task*) berdasarkan prioritas kanonikal (1: aktif, 2: terblokir/gagal, 3: review, 4: tugas relevan terakhir), dengan fallback tegas ke `null` bila tidak ada tugas yang valid.
  - Mengamankan invarian keselamatan:
    - Pekerja media dalam status `DISABLED` tidak boleh membuat Budi (`lokamedia_worker_primary`) tampil dalam status `WORKING`.
    - Otomasi publikasi dalam status `OFF` tidak otomatis dianggap sebagai kesalahan/error, melainkan siaga normal (`IDLE`).
    - TypeSafe Jev beroperasi murni dalam mode bayangan (*shadow*), dan Dimas (`telemetry_observer_jev`) tidak pernah direpresentasikan memiliki otoritas publikasi.
    - Modul bersifat *supervisory read-only*: tanpa tombol perintah, chat, eksekusi ulang, atau mutasi produksi.
  - Mempersiapkan kunci avatar stabil (`avatar_key`) untuk integrasi masa depan Pixel Office.
- **Komponen & Arsitektur Terpasang (`src/lib/mission-control/staff-registry.ts`):**
  1. **Registri Staf Awal:**
     - Joko (`content_writer_primary`, Content Writer, Editorial, `ARTICLE_WRITING`, `editorial_writer_01`).
     - Irwan (`evidence_researcher_lead`, Research & Evidence Specialist, Research & Evidence, `EVIDENCE_RESEARCH`, `research_evidence_01`).
     - Rina (`editorial_qa_primary`, Editorial QA, Editorial, `EDITORIAL_QA`, `editorial_qa_01`).
     - Budi (`lokamedia_worker_primary`, Media Operations, Media, `MEDIA_OPERATIONS`, `media_ops_01`).
     - Sari (`publication_dispatcher_core`, Publication Operator, Publication Operations, `PUBLICATION_OPERATIONS`, `publication_ops_01`).
     - Dimas (`telemetry_observer_jev`, Decision & Telemetry Analyst, Engineering & Telemetry, `SYSTEM_TELEMETRY`, `telemetry_01`).
  2. **Registri Departemen:** Penyiapan metadata 6 departemen (`editorial`, `research_evidence`, `media`, `publication_operations`, `engineering_telemetry`, `social`). Departemen `social` ditandai belum tersedia dan tanpa staf.
  3. **Atribusi Aktivitas Deterministik (`attributeActivityEvent`):** Pemetaan kejadian riil multi-tabel ke staf terkait, dengan fallback ke `System` / `Unassigned` untuk kejadian ambigu atau berkeyakinan rendah.
  4. **Penurunan Status & Tugas Riil (`deriveStaffState`, `deriveStaffCurrentTask`):** Logika evaluasi murni tanpa efek samping untuk status operasional staf.
  5. **Kompilasi Snapshot Roster (`getStaffRoster`):** Agregasi ringkasan hitungan staf riil (`total`, `working`, `idle`, `reviewing`, `blocked`, `offline`, `unknown`).
- **Antarmuka & Rute Web:**
  - **Halaman Staf (`/admin/mission-control/staff`):** Tampilan split-view modern (kartu staf di sisi kiri, panel inspeksi rincian read-only di sisi kanan) dengan ringkasan status bar dan sub-navigasi terpadu ke Cockpit (`/admin/mission-control`).
  - **API Roster Staf (`/api/admin/mission-control/staff`):** Rute GET terautentikasi sesi admin untuk pertukaran data JSON.
  - **Navigasi CMS (`AdminLayout.astro`):** Penambahan rute Staff Registry pada breadcrumbs dan menu navigasi Ringkasan & Kontrol.
- **Pengujian & Validasi:**
  - Rangkaian pengujian terfokus `scripts/test-staff-registry.js` lulus 100% (16/16 tes) mencakup pemisahan identitas mesin/tampilan, stabilitas ID mesin, pemetaan kapabilitas, prioritas tugas, atribusi aktivitas, penurunan seluruh varian status operasional, keselamatan pekerja media nonaktif, representasi otoritas nol JEV, dan invarian kueri read-only murni (0 mutasi).
  - Pengujian Mission Control `scripts/test-mission-control.js` lulus 100% (10/10 tes).
  - Validasi tipe `npx tsc --noEmit` lulus bersih tanpa kesalahan.
  - Build produksi `npm run build` berhasil membuat artefak Cloudflare Worker.
  - Pengujian regresi keselamatan `test-soak-safety.js` (54 tes) lulus sempurna.
- **Status Akhir:**
  - `HERMES-MC-2 = COMPLETE`.
  - Frontier saat ini: `HERMES-MC-3/READY`.

### HERMES-MC-1: RancangLoka Hermes Mission Control Core Implementation 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Membangun antarmuka kokpit operasional terpadu read-only pertama di rute `/admin/mission-control` dan API telemetri `/api/admin/mission-control/state`.
  - Mengagregasikan status operasional nyata dari Cloudflare D1 (keselamatan otomasi, pemutus sirkuit, pekerja media, pipeline artikel, log audit aktivitas, scheduler cron) dan model keputusan bayangan TypeSafe Jev ke dalam satu dasbor eksekutif.
  - Mempertahankan invarian keselamatan produksi: nol mutasi database, nol aktivasi pekerja media (`settings.media_worker_enabled = DISABLED`), otomasi publikasi tetap `OFF`, kill switch tetap pada status kanonikal (`NORMAL`), dan Jev berstatus `shadow` dengan otoritas nol.
  - Menolak data simulasi/palsu: menampilkan status nol sehat (misal 0 perangkat aktif, 0 pekerjaan media) apa adanya, dan menandai telemetri yang tidak tersedia sebagai `UNKNOWN` atau `NOT_AVAILABLE`.
  - Menerapkan sanitasi token dan redaksi kredensial otomatis pada seluruh lapisan data dan tampilan.
- **Komponen & Arsitektur Terpasang (`src/lib/mission-control/`):**
  1. **Tipe & Kontrak Data (`types.ts`):** Definisi TypeScript lengkap untuk seluruh model data snapshot, health strip, pipeline board, audit feed, scheduler, dan ringkasan subsistem.
  2. **Sanitasi & Redaksi Kredensial (`redact.ts`):** Penyensoran otomatis pola token rahasia (`lkmd_...`, Bearer tokens, token sesi admin, hash, dan kunci kriptografi).
  3. **Lapisan Kesehatan Sistem (`health.ts`):** Evaluasi status publikasi dari `automation_control.mode`, kill switch, status gerbang pekerja media, mode Jev bayangan, dan pemutus sirkuit subsistem (`circuit_breakers`).
  4. **Papan Tugas / Pipeline Terpadu (`tasks.ts`):** Pemetaan kanonikal entitas lintas siklus hidup editorial (`draft`, `waiting_media`, `ready_for_review`, `scheduled`, `published`, `failed`) dari gabungan tabel `articles`, `media_jobs`, dan `article_editorial_approvals`.
  5. **Arus Audit & Aktivitas Kronologis (`activity.ts`):** Agregasi kejadian multi-tabel (`automation_control_audit`, `circuit_breaker_events`, `media_job_events`, `publication_cron_runs`, `decision_observations`) dengan penanda keparahan (`info`, `warning`, `error`, `success`).
  6. **Evaluator Scheduler & Detak Jantung (`scheduler.ts`):** Evaluasi kesegaran detak jantung Hermes sesuai ambang batas kanonikal (sehat $\le 300$d, basi $301-600$d, luring $>600$d) dan ringkasan eksekusi cron Cloudflare edge-safe.
  7. **Ringkasan Operasional Subsistem (`summaries.ts`):** Ringkasan receipt outbox, operasi artikel, operasi media, dan metrik latensi/risiko evaluasi Jev bayangan.
  8. **Assembler Snapshot Utama (`index.ts`):** Pembungkus fungsi read-only `getMissionControlSnapshot` yang mengeksekusi kueri SELECT murni tanpa efek samping.
- **Antarmuka & Rute Web:**
  - **Halaman Dasbor (`/admin/mission-control`):** Halaman Astro SSR dengan tata letak padat informasi (*executive cockpit*), palet warna gelap profesional, kartu status interaktif, dan auto-refresh polling 30 detik yang hemat komputasi.
  - **API Telemetri (`/api/admin/mission-control/state`):** Rute GET terautentikasi sesi admin untuk pembaruan data asinkron.
  - **Navigasi Admin (`src/layouts/AdminLayout.astro`):** Penambahan tautan menu "Hermes Mission Control" di bilah navigasi CMS Admin.
- **Pengujian & Validasi:**
  - Rangkaian pengujian terfokus `scripts/test-mission-control.js` lulus 100% (10/10 tes): redaksi rahasia, invarian kesehatan dan otoritas nol, pemetaan zero-state sehat, transisi kill switch dan circuit breaker OPEN, pemetaan stage task board, agregasi audit multi-tabel, fallback telemetri tidak diketahui, dan invarian kueri read-only murni (0 mutasi).
  - Typecheck `npx tsc --noEmit` lulus bersih tanpa kesalahan.
  - Build produksi `npm run build` sukses membuat artefak Cloudflare Worker.
  - Pengujian regresi keselamatan `test-soak-safety.js` (54 tes), `test-article-persistence.js` (7 tes), dan `test-media-device-lifecycle.js` (28 tes) semuanya lulus sempurna.
- **Status Akhir:**
  - `HERMES-MC-1 = COMPLETE`.
  - Worktree bersih dan siap untuk transisi ke `HERMES-MC-2` (Named Staff Identities & Persistent Agent Mapping).

### MEDIA-A5.7-CLOSEOUT: Production Verification of Ephemeral Device Lifecycle & Dual-Gate Dormant Safety 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Menutup secara formal milestone `MEDIA-A5.7` berdasarkan bukti eksekusi langsung di lingkungan produksi Cloudflare Worker (`fa1c8b93-b410-4800-8296-f4c88e5d809e`) melalui sub-milestone `MEDIA-A5.7-P3A`.
  - Mengonfirmasi kepatuhan penuh terhadap prinsip keselamatan: pekerja media tetap berstatus *dormant* (OFF), nol pekerjaan dieksekusi, nol panggilan provider berbayar, dan nol mutasi data artikel/media/publikasi.
  - Menegaskan status kanonikal: `MEDIA-A5.7-P3A = COMPLETED`, `MEDIA-A5.7-P3B = NOT CANONICALLY DEFINED`, dan klasifikasi akhir `MEDIA-A5.7 = PROVEN_DORMANT`.
  - Mendaftarkan roadmap baru operasional sistem: `HERMES-MC` (Hermes Mission Control & 2D Pixel Office) sebagai lapisan kendali dan observabilitas terpadu.
- **Hasil & Bukti Eksekusi Produksi (MEDIA-A5.7-P3A):**
  1. **Autentikasi Operator Resmi:** Permintaan pendaftaran dan pencabutan perangkat divalidasi via sesi admin browser operator resmi pada portal CMS Admin (`https://rancangloka.com/admin`).
  2. **Pendaftaran Perangkat Ephemeral:** `POST /api/internal/v1/media/devices` berhasil mendaftarkan satu perangkat uji `media-a57-p3a-probe-20260930` dengan status HTTP 201 Created. Token hanya dikembalikan sekali dan disimpan dalam bentuk hash SHA-256 (`token_hash = 209f68864d0bc0ab03c0517f73446d953be8942c366a77ea4bab54ebe7de18f1`).
  3. **Pengujian Gerbang Pekerja Media Terautentikasi:** Memanggil `POST /api/internal/v1/media/jobs/run-next` dengan `Authorization: Bearer <token>`. Autentikasi perangkat diterima, gerbang keselamatan dievaluasi secara kanonikal, dan mengembalikan HTTP 200 OK dengan payload semantik `{ status: "disabled", code: "MEDIA_WORKER_DISABLED", executed: false, job_id: null }`.
  4. **Pencabutan Perangkat (Revocation):** Memanggil `DELETE /api/internal/v1/media/devices/media-a57-p3a-probe-20260930` dengan sesi admin operator. Perangkat berhasil dicabut (HTTP 200 OK) dan status pada tabel `media_devices` bertransisi menjadi `REVOKED`.
  5. **Uji Negatif Kredensial Dicabut (Fail-Closed 401):** Memanggil kembali `run-next` menggunakan token yang sama setelah pencabutan. Permintaan ditolak langsung pada lapisan autentikasi dengan status HTTP 401 Unauthorized (`code: "AUTHENTICATION_REQUIRED"`), membuktikan *fail-closed revocation* tanpa celah bypass.
  6. **Integritas Database Produksi (Zero Mutation):**
     - `media_jobs`: 0 (+0)
     - `media_job_events`: 0 (+0)
     - `media_job_receipts`: 0 (+0)
     - `media_assets`: 4 (+0)
     - `articles`: 6 (+0)
     - `active media devices`: 0
- **Klasifikasi & Batasan Otoritas:**
  - Status akhir: `MEDIA-A5.7 = PROVEN_DORMANT`.
  - Pekerja media TIDAK diaktifkan di produksi (`settings.media_worker_enabled` tetap tidak disetel / false).
  - Tidak ada pekerjaan media nyata yang dibuat atau dieksekusi.
  - Nol panggilan ke provider eksternal (Fal.ai / Meta).
  - Sub-milestone `MEDIA-A5.7-P3B` TIDAK didefinisikan secara kanonikal di dalam repositori dan tidak dieksekusi.

### ARTICLE-CONTENT-PERSISTENCE-1: Fix content_html Serialization at Source 2026-09-28

- **Tujuan & Ruang Lingkup:** Mengatasi akar penyebab serialisasi `articles.content_html` yang menghasilkan literal `[object Object]` pada tingkat database, menegakkan type guard dan validasi runtime ketat pada seluruh jalur penulisan artikel, menetapkan peran arsitektural `content_md` (sumber kanonikal otoritatif) versus `content_html` (derivatif render deterministik / cache), meregenerasi `content_html` Artikel 5 di Cloudflare D1 secara aman tanpa memutasi `content_md`, hash, approval, receipt, atau tanggal terbit, serta menambahkan rangkaian uji regresi persistensi.
- **Akar Masalah (Root Cause Analysis):**
  1. **Ketiadaan Validasi Tipe pada Writer:** Fungsi `insertArticle`, `updateArticle`, dan `insertHermesArticleAndReceipt` di `src/lib/db.ts` menerima nilai `article.content_html` tanpa type assertion atau validasi runtime. Jika pemanggil melewatkan unawaited Promise dari `renderArticleMarkdownSafely` (yang bersifat `async`), objek AST node parser, atau payload JSON objek, binding D1 SQLite secara otomatis memanggil `String(value)`, yang menghasilkan string literal `"[object Object]"`.
  2. **Ketiadaan Auto-Derivasi Deterministik:** Ketika `content_html` tidak disediakan saat insert/update namun `content_md` tersedia, sistem tidak secara otomatis meng-await dan merender HTML, melainkan menyimpan string kosong atau nilai mentah tak tervalidasi.
- **Solusi & Arsitektur Perbaikan:**
  - **Fungsi Resolver & Validator `resolveAndValidateContentHtml`:**
    - Jika menerima Promise yang belum di-await, fungsi secara otomatis meng-await Promise hingga selesai.
    - Menolak tipe non-string (objek, array, number, boolean, AST node) dengan melempar `DatabaseConstraintError`.
    - Menolak string literal `"[object Object]"` atau `"[object Promise]"` dengan melempar `DatabaseConstraintError`.
    - Jika `content_html` kosong atau tidak disediakan namun `content_md` tersedia, fungsi mendeterminasi dan merender HTML aman secara otomatis melalui `renderArticleMarkdownSafely(content_md)`.
    - Menjalankan `sanitizeArticleHtml` pada hasil akhir untuk menjamin kepatuhan allowlist HTML dan pencegahan XSS.
  - **Hardening pada Seluruh Jalur Persistensi:**
    - `insertArticle` di `src/lib/db.ts`: Seluruh write D1 dan in-memory mock divalidasi via `resolveAndValidateContentHtml`.
    - `updateArticle` di `src/lib/db.ts`: Memvalidasi `content_html` yang diberikan, meng-auto-regenerasi derivatif jika `content_md` diperbarui tanpa `content_html`, dan menyembuhkan baris lama jika `existing.content_html` korup.
    - `insertHermesArticleAndReceipt` di `src/lib/db.ts`: Mencegah machine ingestion menyimpan objek atau unawaited Promise.
    - `normalizeArticle` di `src/lib/article/pipeline.ts`: Menambahkan assertion runtime bahwa hasil render adalah string valid dan bukan `[object Object]`.
    - `[slug].astro` dan `admin/preview/[slug].astro`: Tetap mempertahankan fallback runtime sebagai *defense-in-depth*.
- **Perbaikan Aman Derivatif Artikel 5 di Cloudflare D1 Produksi:**
  - Menjalankan script terisolasi `scripts/repair-article5-content-html.js` ke database remote `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`).
  - `content_html` berhasil diregenerasi menjadi string HTML kanonikal valid sepanjang 17.940 karakter yang mencakup seluruh 8 tajuk utama dan retensi kata 98,6% (2.088 kata HTML vs 2.117 kata MD).
  - Mutasi D1 DIBATASI HANYA pada `articles.content_html`. Kolom `content_md`, `content_hash` (`14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277`), approval ID 9, receipt `rcpt_bbae85b48e1b2f8d`, `published_at`, dan media featured 100% UNCHANGED.
  - Mencatat audit log di `article_state_transitions` dengan `transition_type = 'DERIVED_CONTENT_REPAIR'` (`ast_5_derived_repair_1790590005246`).
- **Rangkaian Uji Regresi Persistensi (`scripts/test-article-persistence.js`):**
  1. Penolakan penyimpanan output renderer berupa Promise/objek tak tervalidasi.
  2. Kewajiban tipe string pada writer `content_html` (menolak array, number, boolean, AST node).
  3. Awaiting otomatis pada Markdown renderer saat derivasi dari `content_md`.
  4. Penolakan strict persistensi literal `"[object Object]"` dan `"[object Promise]"`.
  5. Verifikasi pemicu fallback frontend saat mendeteksi `content_html` malformed.
  6. Normal render dari `content_html` valid tanpa pemrosesan ulang fallback.
  7. Verifikasi ketidakberubahan hash dan approval ID 9 Artikel 5 setelah perbaikan derivatif.
- **Invarian Keselamatan:** `AUTOMATION_MODE = OFF`, `JEV_MODE = shadow`, `auto_schedule = false`.

### ARTICLE-RENDER-INTEGRITY-1: Emergency Repair of Article 5 Public Rendering 2026-09-28

- **Tujuan & Ruang Lingkup:** Memperbaiki bug rendering kritis produksi pada halaman publik Artikel 5 (`/kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`). Memulihkan penampilan naskah editorial kanonikal (~2.100 kata), mengeliminasi string literal `[object Object]`, menghapus blok prototype hardcoded yang tidak terkait ("EVALUASI SPASIAL REDAKSI", "Why This Works: Orientasi & Pembiasan...", dan sitasi ventilasi SNI 03-6572), serta menambahkan uji regresi integritas rendering deterministik.
- **Akar Masalah (Root Causes):**
  1. **Naskah Hilang & Literal `[object Object]`:** Kolom database `articles.content_html` pada baris Artikel 5 di D1 produksi secara keliru terisi string literal 15-karakter `"[object Object]"` akibat serialisasi lampau saat ingest draf otomatis, sementara naskah kanonikal 2.117 kata di `articles.content_md` tetap utuh. Pada `src/pages/[slug].astro`, kode sebelumnya langsung meneruskan `sanitizeArticleHtml(article.content_html)` ke pemroses konten tanpa memvalidasi keabsahan HTML, sehingga Markdown kanonikal terabaikan dan halaman merender literal `[object Object]`.
  2. **Modul Penilaian Spasial & Sitasi Fiktif:** Baris 358–445 dan 450–461 pada `src/pages/[slug].astro` memuat markup kartu hardcoded dari era prototipe yang dievaluasi murni via `{article.is_sponsored !== 1 && (...)}`, sehingga muncul di semua artikel terbit tanpa memandang relevansi topik.
- **Solusi & Arsitektur Perbaikan:**
  - **Fallback Aman Markdown Kanonikal:** Mengimpor `renderArticleMarkdownSafely` ke `src/pages/[slug].astro`. Menambahkan validasi `isMalformedHtml` (`!rawContentHtml || typeof rawContentHtml !== 'string' || rawContentHtml.trim() === '[object Object]' || rawContentHtml.trim().length < 50`). Jika HTML tidak valid, sistem secara dinamis merender HTML aman langsung dari `article.content_md`.
  - **Eliminasi Prototype Filler:** Menghapus blok hardcoded evaluasi spasial, "Why This Works", dan sitasi ventilasi dari template `[slug].astro`. Menegakkan alur visual linier murni: *Judul/Metadata → Executive Summary → Featured Hero Image → Naskah Editorial Kanonikal Penuh (termasuk Matriks Komparasi, Verdict RancangLoka, Catatan Rujukan Standar) → Social Share Bar → Author Card → CTA → Footer*.
- **Pintu Integritas Rendering (`scripts/test-article-render-integrity.js`):**
  - Menguji pemuatan naskah kanonikal via fixture `scripts/fixtures/article5_canonical.json`.
  - Memverifikasi keberadaan seluruh 8 tajuk utama kanonikal Artikel 5.
  - Memastikan retensi kata naskah editorial ter-render >= 90% dari naskah kanonikal Markdown (terverifikasi: 2.167 kata rendered vs 2.117 kata canonical = 102,4% retensi).
  - Memastikan string `[object Object]` serta komponen prototipe fiktif 100% absen dari template.
- **Hasil Verifikasi Live Produksi:**
  - Deployment ID: `fa1c8b93-b410-4800-8296-f4c88e5d809e` (commit `8d82e3b`).
  - Halaman Artikel 5 (`/kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`): HTTP 200, robots `index, follow, max-image-preview:large`, schema `@type: "Article"`, 8 tajuk utama hadir utuh, 2.167 kata editorial terlihat, literal `[object Object]` lenyap.
  - Halaman Artikel 6 (`/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman`): HTTP 200, `X-Robots-Tag: noindex, follow`, terisolasi dari sitemap dan RSS feed.
- **Invarian Keselamatan:** `AUTOMATION_MODE = OFF`, `auto_schedule = false`, `kill switch = disengaged`, `JEV = shadow / OBSERVE_ONLY`, `media worker = OFF`. Naskah `content_md`, approval ID 9, receipt `rcpt_bbae85b48e1b2f8d`, dan content hash Artikel 5 (`14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277`) 100% IMMUTABLE.

### CONTENT-QUARANTINE-1: Prototype & Unsafe Corpus Isolation 2026-09-28

- **Tujuan & Ruang Lingkup:** Mengisolasi 20 artikel prototipe internal di `src/lib/db.ts` dan artikel produksi belum terverifikasi (Artikel 6) dari permukaan publikasi terbuka (Google News sitemap, XML sitemap biasa, RSS feed, pencarian situs, internal-linking otomatis, dan rekomendasi artikel terkait), tanpa merusak akses langsung operator maupun integritas data historis.
- **Implementasi:**
  - Membuat registry karantina `QUARANTINE_REGISTRY` di `src/lib/quarantine.ts`.
  - Menerapkan header `X-Robots-Tag: noindex, follow` dan meta tag `noindex` untuk rute artikel karantina.
  - Menyiapkan pengalihan 301 konsolidasi untuk slug prototipe `panduan-kusen-aluminium-ekstrusi-daerah-lembap` menuju Artikel 5 kanonikal.
  - Memastikan Artikel 5 terproteksi penuh dari benturan ID in-memory dan tetap terindeks secara publik (`index, follow`).
- **Verifikasi:** 19/19 uji regresi `scripts/test-content-quarantine.js` lulus. Commit: `b67ced3`.

### CONTENT-GOLIVE-1-STABILIZE: Production Source & Publication Clock Stabilization 2026-09-28

- **Tujuan & Ruang Lingkup:** Menstabilkan baseline kode produksi pasca-penerbitan artikel perdana (Article ID 5, "Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia"), memperbaiki sumber jam publikasi (*publication clock source*) agar selalu mengambil waktu server Cloudflare D1/SQLite kanonikal, mendokumentasikan anomali *clock-skew* workstation operator pada rekaman historis penerbitan perdana tanpa memalsukan data historis, menambahkan uji regresi *clock-skew*, serta mengonsolidasikan seluruh perbaikan SEO/SSR ke dalam satu commit bersih.
- **Dokumentasi Provenance & Anomali Clock-Skew Historis Article 5:**
  - Operasi penerbitan kanonikal aktual (`publishNow`) terlaksana di server Cloudflare D1 sekitar pukul **2026-09-28 06:16:33 UTC**.
  - Nilai publik historis `published_at` (`2026-09-28T06:10:39.816Z`) tercipta dari jam lokal workstation operator (*Windows workstation clock*) yang saat eksekusi tertinggal ~5 menit 54 detik dari UTC sebenarnya.
  - Timestamp persetujuan redaksi manusia (`article_editorial_approvals.created_at = 2026-09-28 06:15:42 UTC`) menggunakan waktu server D1 (`CURRENT_TIMESTAMP`).
  - **Invarian Persetujuan TIDAK Dilanggar:** Persetujuan manusia sah tercatat terlebih dahulu di server D1 sebelum operasi `publishNow` dijalankan. Perbedaan tampilan timestamp murni diakibatkan oleh penggunaan `new Date().toISOString()` lokal workstation pada fungsi `executeAtomicPublication`.
  - **Kebijakan Integritas:** Rekaman historis Article 5 (approval ID 9, receipt `rcpt_bbae85b48e1b2f8d`, execution row ID 2 / `pexec_2b27683bb528397e`, `published_at`) **TIDAK diubah / difalsifikasi** guna menjaga integritas audit jejak sejarah. Nomor execution dikoreksi berdasarkan verifikasi D1 read-only pada 28 September 2026; tidak ada perubahan rekaman produksi.
- **Perbaikan Sumber Jam Publikasi (Canonical Server Clock Source):**
  - Mengganti evaluasi `new Date().toISOString()` lokal pada `getDueExecutions`, `claimExecutionLease`, dan `executeAtomicPublication` (`src/lib/publication/publisher-service.ts`) dengan kueri waktu server database: `SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS server_now`.
  - Menjamin `articles.published_at`, `article_publication_executions.actual_published_at`, dan `publication_execution_receipts.actual_published_at` selalu berasal dari SATU timestamp server D1 yang identik dan berformat ISO-8601 UTC.
- **Uji Regresi Deterministi Clock-Skew (`scripts/test-publication-clock-skew.js`):**
  - Menguji skenario ekstrim di mana jam workstation operator tertinggal 15 menit dari UTC.
  - Membuktikan bahwa `publishNow` mengabaikan jam lokal workstation, mengambil waktu server D1, dan menjamin `published_at >= approval.created_at` serta kesesuaian 100% pada execution dan receipt.
- **Konsolidasi Perbaikan SEO, SSR & Sitemap:**
  - `src/layouts/BaseLayout.astro`: fallback `metaDesc` eksplisit untuk mencegah error SSR.
  - `src/pages/[slug].astro`: pengangkatan deklarasi variabel `authorObj` ke lingkup teratas frontmatter.
  - `src/lib/seo.ts` & `src/pages/sitemap-news.xml.ts`: pengetatan filter News Sitemap khusus artikel bertipe `news` yang terbit < 48 jam.
  - `scripts/test-schema-compatibility.js`: pembaruan assertion agar dinamis menguji seluruh 22 file migrasi.
  - `scripts/test-seo-date-pipeline.js`: 14 pengujian komprehensif tanggal SEO, Schema.org, dan Google News Sitemap.
- **Status Keamanan:** `AUTOMATION_MODE = OFF`, `auto_schedule = false`, `kill_switch = disengaged`, `JEV = shadow / OBSERVE_ONLY`, `media_worker = OFF`.

### MEDIA-A5.7-P2B Production Deployment & Ephemeral Device Lifecycle Verification 2026-09-27

- **Tujuan & Ruang Lingkup:** Melakukan deployment kanonikal kode lifecycle kredensial perangkat (`6268e4e`) ke Cloudflare Worker produksi (`rancangloka`), memverifikasi isolasi rute manajemen perangkat yang dilindungi oleh sesi admin operator, menegakkan firewall pencegahan self-provisioning perangkat media, serta mengonfirmasi bahwa status operasional pekerja media tetap sepenuhnya `OFF` (*dormant*) sebelum pengujian probe diautentikasi.
- **Hasil Deployment Produksi:**
  - **Deployment ID Aktif:** `5bb91a9f-d9cc-46e7-af5d-4bff0fbd7d1c` (commit `6268e4ed3c630ae422b8237d694e96afe80a057f`).
  - **Status Kesehatan:** Beranda (`/`) 200 OK, SSR artikel terbit (`/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman`) 200 OK.
  - **Status Dual-Gate Media Worker:** `MEDIA_WORKER_ENV_GATE = true`, `MEDIA_WORKER_DB_GATE = UNSET / false`, `EFFECTIVE_STATE = OFF` (invarian gerbang ganda terjaga 100%).
  - **Verifikasi Endpoint Tanpa Autentikasi:** `POST /api/internal/v1/media/jobs/run-next` menolak dengan 401 (`AUTHENTICATION_REQUIRED`); `GET` menolak dengan 405 (`METHOD_NOT_ALLOWED`).
- **Verifikasi Keamanan API Manajemen Perangkat:**
  - `GET /api/internal/v1/media/devices` (unauthenticated) -> 401 `UNAUTHORIZED` (`Operator admin session required.`).
  - `POST /api/internal/v1/media/devices` (unauthenticated) -> 401 `UNAUTHORIZED` (`Operator admin session required.`).
  - **Firewall Self-Provisioning:** Kredensial dengan prefix `lkmd_` atau scope `media:device` ditolak secara mutlak dengan 403 `MEDIA_DEVICE_FORBIDDEN` (`Media device credentials cannot access device management APIs.`), menjamin nol *trust loop*.
- **Koreksi Otoritas Operasional:**
  - Menegakkan prinsip bahwa akses infrastruktur database D1 (`npx wrangler d1 execute`) bukan merupakan otoritas pendaftaran perangkat tingkat aplikasi.
  - Alur pendaftaran perangkat kanonikal yang sah ditetapkan melalui sesi browser operator terautentikasi (`admin_session` cookie via `POST /api/internal/v1/media/devices`).
- **Status Database Baseline:** `media_devices` = 0, `media_jobs` = 0, `media_job_events` = 0, `media_job_receipts` = 0, kontrol publikasi = `OFF` / `false` / `0`.

### MEDIA-A5.7-P2A Canonical Ephemeral Device Auth Lifecycle & Management API 2026-09-27

- **Tujuan & Ruang Lingkup:** Mengimplementasikan layanan siklus hidup kanonikal (*canonical lifecycle services*) untuk pendaftaran, pencabutan, dan verifikasi perangkat media LokaMedia (`registerMediaDevice`, `revokeMediaDevice`, `getMediaDevice`, `listMediaDevices`) serta endpoint internal HTTP yang dilindungi otoritas admin operator (`POST /api/internal/v1/media/devices`, `GET`, `DELETE /api/internal/v1/media/devices/[device_id]`).
- **Fitur Kriptografis & Keamanan:**
  - **Entropi Tinggi:** Token perangkat digenerasi menggunakan Web Crypto `crypto.getRandomValues` dengan entropi 256-bit (32 byte acak) berawalan `lkmd_` (total 69 karakter string heksadesimal).
  - **Hash-Only Storage:** Database Cloudflare D1 hanya menyimpan digest SHA-256 (`token_hash`). Plaintext token tidak pernah disimpan di disk/database dan tidak pernah dicetak dalam log sistem. Token plaintext dikembalikan tepat satu kali (*once-only*) pada respons pendaftaran.
  - **Fail-Closed Revocation Hardening:** Mengubah kueri pencocokan token di `authenticateDeviceRequest` untuk mengambil status perangkat berdasarkan `token_hash`. Jika status tercatat `REVOKED`, autentikasi langsung ditolak secara fail-closed (401 `Token perangkat LokaMedia tidak valid atau telah dicabut.`) tanpa *fallthrough* ke env secret atau dev test bypass.
  - **Idempotensi & Pencegahan Duplikasi:** Pendaftaran perangkat menolak ID perangkat yang sudah aktif dengan status 409 Conflict. Pencabutan perangkat bersifat idempoten (aman dipanggil berulang kali).
  - **Media Device Firewall:** Memblokir seluruh kredensial perangkat media dari rute admin dan provisioning guna mencegah loop self-provisioning.
- **Pengujian & Verifikasi (`scripts/test-media-device-lifecycle.js`):**
  - 28/28 pengujian lulus 100% membuktikan entropi token, penyimpanan hash, autentikasi sukses, penolakan token salah/kadaluwarsa/dicabut, penolakan scope terlarang, idempoten pencabutan, zero plaintext leak pada log, serta proteksi API internal.
- **Commit:** `6268e4e` (`feat: add canonical media device lifecycle`).

### MEDIA-A5.7-P1 Dormant Production Deployment & Strict Dual-Gate Enforcement 2026-09-27

- **Tujuan & Ruang Lingkup:** Melakukan deployment kode runtime media worker yang telah diaudit ke Cloudflare Worker produksi (`rancangloka`) dengan kondisi pekerja media tetap berstatus *dormant* (OFF total) untuk memvalidasi kompatibilitas edge runtime tanpa mutasi database atau eksekusi pekerjaan aktif.
- **Verifikasi Kontrol & Invarian:**
  - Deployment ID: `f660293d-acc5-4cdf-9089-b1660f7e4255` (commit `11e3e06a82c161912495edb1dbd1d8fbba7189c8`).
  - Gerbang Environment `MEDIA_WORKER_ENABLED = true` disinkronkan via `wrangler.toml`.
  - Gerbang Database D1 `settings.media_worker_enabled` dipertahankan tidak disetel (*UNSET*) / `false`.
  - Formula kontrol gerbang ganda `WORKER_ENABLED = env === true AND db === true` menghasilkan status efektif `OFF`.
  - Endpoint publik dan SSR berjalan normal; kueri tanpa token ke endpoint worker internal menghasilkan 401; mutasi artikel dan media nol.

### MEDIA-A5.6 Safe Media Worker Handoff & Dual-Control Gate Invariant 2026-09-27

- **Tujuan & Ruang Lingkup:** Membangun lapisan pelari pekerja media kanonikal (`src/lib/media/worker-runner.ts`) dan endpoint trigger eksekusi (`POST /api/internal/v1/media/jobs/run-next`, `POST /api/internal/v1/media/worker/control`) yang menerapkan arsitektur gerbang ganda (*Dual-Gate AND Semantics*): pekerja HANYA dapat aktif jika `env.MEDIA_WORKER_ENABLED === true` DAN `settings.media_worker_enabled === true`.
- **Fitur Utama:**
  - **Dual-Control Fail-Closed:** Jika salah satu atau kedua gerbang bernilai non-true, worker langsung keluar dengan `{ status: 'success', code: 'WORKER_DISABLED', executed: false }`.
  - **Lease & Heartbeat Management:** Pengambilan pekerjaan tunggal per siklus dengan durasi sewa 180 detik dan verifikasi kepemilikan sewa.
  - **Pengujian & Verifikasi (`scripts/test-media-a5-worker-runner.js` & `test-media-a5-7-canonical-canary.js`):**
    - 21/21 tes worker runner lulus 100%.
    - 27/27 tes canary kanonikal lulus 100%.
- **Commit:** `11810de`, `a63de3b`, `9dbcd53`.

### MEDIA-A5.5 Deterministic Media Soak Runner & Concurrency Stress 2026-09-26

- **Tujuan & Ruang Lingkup:** Menguji ketahanan, stabilitas memori, dan determinisme antrean media serta orkestrator di bawah beban siklus multi-iterasi (*soak test*) menggunakan mock database D1 in-memory.
- **Hasil Verifikasi (`scripts/test-media-a5-soak.js`):**
  - 12 siklus soak multi-skenario lulus 100% tanpa memory leak, race condition, atau residu sewa menggantung.
- **Commit:** `ae978d5` (`test: add deterministic media orchestration soak`).

### MEDIA-A5.4 Media Pipeline Orchestrator & Local DI Runtime 2026-09-26

- **Tujuan & Ruang Lingkup:** Mengintegrasikan mesin orkestrasi pipeline media terpadu (`processMediaJob`) di `src/lib/media/orchestrator.ts` dengan eksekusi berbasis dependency injection (DI), mekanisme pemulihan minimal stage (*Minimal Stage Resume*), proteksi konkurensi sewa (lease), serta pendelegasian penuh keputusan retry ke satu otoritas (`classifyMediaRetry` + `applyMediaRetryDecision`).
- **Fitur & Arsitektur Utama:**
  - **Minimal Stage Resume:** Memanfaatkan cache artefak intermediat (`artifactStore`). Kegagalan pada `TRANSFORM` (misal `WATERMARK_FAILED`) hanya mengulang tahap transformasi saat di-reclaim tanpa mengulang pembuatan gambar sumber (`sourceExecutor`). Begitu pula kegagalan di `STORAGE` atau `DELIVERY_VERIFY` langsung melanjutkan pada tahap terkait tanpa membuang kerja upstream.
  - **Single Authority Policy Parity:** 100% evaluasi kegagalan didelegasikan ke `classifyMediaRetry` (`src/lib/media/retry-policy.ts`) dan persistensi ke `applyMediaRetryDecision` (`src/lib/media/durable-retry.ts`). Orchestrator tidak memiliki pemetaan kode kegagalan manual sendiri.
  - **Firewall Status Non-Runnable:** Memblokir eksekusi otomatis pada 7 status tidak dapat dijalankan (`COMPLETE`, `FAILED_TERMINAL`, `SUPERSEDED`, `CANCELLED`, `AUTH_REQUIRED`, `PROVIDER_BLOCKED`, `USER_ACTION_REQUIRED`).
  - **Ketahanan Concurrency & Crash:** Memverifikasi kepemilikan dan masa berlaku lease; menolak penulisan dari pekerja usang (OCC revision conflict); mendukung pemulihan crash sebelum atau sesudah persistensi keputusan.
- **Pengujian & Verifikasi (`scripts/test-media-a5-orchestrator.js`):**
  - 18/18 tes lulus 100% mencakup: Happy path end-to-end, source retry, transform retry, storage retry, delivery retry, manual bridge routing, auth failure isolation, provider content block, generation budget exhaustion, stage retry exhaustion, single active lease, stale worker rejection, duplicate dispatch idempotency, pre-persist & post-persist crash recovery, non-runnable firewall, kompatibilitas event legasi, dan policy parity.
- **Commit:** `c9a62ab` (`feat: integrate media retry orchestrator`).

### MEDIA-A5.3 Durable Retry Accounting & Decision Policy Integration 2026-09-26

- **Tujuan & Ruang Lingkup:** Mengimplementasikan lapisan adapter persistensi durabel (`applyMediaRetryDecision` di `src/lib/media/durable-retry.ts`) antara keputusan kebijakan retry dan tabel database SQLite/D1 (`media_jobs`, `media_job_events`, `media_job_receipts`) tanpa mutasi skema database (`SCHEMA_CHANGE_REQUIRED=NO`).
- **Akar Masalah Akuntansi Percobaan (`ATTEMPT_COUNTER_GAP`):**
  - Pada implementasi awal, `media_jobs.attempt` adalah satu-satunya counter global. Jika retry tahap `TRANSFORM` atau `STORAGE` menaikkan counter ini, kuota generasi provider akan terbuang sia-sia dan memicu kegagalan terminal prematur.
- **Solusi Akuntansi Percobaan Berjenjang:**
  - `media_jobs.attempt` hanya dinaikkan untuk retry pada level sumber/generasi (`consume_attempt = true`).
  - Retry tingkat tahap (`TRANSFORM`, `STORAGE`) menetapkan `consume_attempt = false` sehingga `media_jobs.attempt` dipertahankan utuh. Jumlah retry tahap dihitung durabel dari tabel `media_job_events`.
  - Angka batas percobaan tahap (`maxStageAttempts`) dikonfigurasikan secara eksplisit via `DEFAULT_STAGE_RETRY_CONFIG` (default 2 retries per stage = 3 kali percobaan total), menghapus magic constant.
- **Fitur Keselamatan:**
  - **Firewall Redaksi Rahasia:** Token, header Authorization Bearer, cookie, dan kunci API disaring otomatis (`[REDACTED_SECRET]`) sebelum ditulis ke database.
  - **Proteksi Status Terminal:** Menolak pembukaan kembali pekerjaan terminal (`COMPLETE`, `FAILED_TERMINAL`, `SUPERSEDED`, `CANCELLED`).
  - **Idempotensi & OCC:** Optimistic Concurrency Control via `job_revision` dan idempotency receipt untuk mencegah eksekusi ganda.
- **Pengujian & Verifikasi (`scripts/test-media-a5-durable-retry.js`):**
  - 17/17 tes lulus 100% membuktikan akuntansi generasi vs stage, firewall rahasia, mitigasi konflik slot, isolasi kegagalan auth/blokir, determinisme waktu `next_retry_at`, dan rekonstruksi pekerja pasca-restart.
- **Commit:** `6cff6aa` (`feat: integrate durable media retry decisions`).

### MEDIA-A5.2 Media Retry Classification & Pure Decision Policy 2026-09-26

- **Tujuan & Ruang Lingkup:** Membangun modul penentu keputusan retry murni (*pure decision engine*, 100% side-effect free) di `src/lib/media/retry-policy.ts` yang memetakan kode kegagalan QA teknis dan upstream provider ke rekomendasi tindakan kanonikal.
- **Klasifikasi Retry Terstruktur:**
  - `RETRY_SAME_STAGE`: Retry pada artefak derivatif yang ada (`WATERMARK_FAILED` -> `TRANSFORM`, `R2_UPLOAD_FAILED` -> `STORAGE`).
  - `RETRY_FROM_SOURCE`: Pengambilan ulang tanpa merubah prompt (`PROVIDER_TIMEOUT`, `PROVIDER_RATE_LIMIT`).
  - `RETRY_WITH_REPROMPT`: Pembuatan ulang dengan penyesuaian parameter teknis.
  - `OPERATOR_REQUIRED`: Penahanan untuk tindakan editor manusia (`PROVIDER_AUTH_FAILED`, `PROVIDER_CONTENT_REJECTED`, atau kegagalan pada `MANUAL_BROWSER_BRIDGE`).
  - `TERMINAL`: Kegagalan fatal yang tidak dapat diulang (kebocoran rahasia `SECRET_LEAK`, batas kuota habis).
  - `NO_RETRY`: Non-kegagalan atau mitigasi konflik slot editorial (`SLOT_OCCUPIED`).
- **Fitur Pendukung:** Perhitungan delay backoff eksponensial deterministik (`computeRetryDelay`) tanpa fungsi sleep/timer non-deterministik.
- **Pengujian & Verifikasi (`scripts/test-media-a5-retry-policy.js`):**
  - 25/25 tes lulus 100% mencakup seluruh matriks kegagalan dan firewall jembatan manual.
- **Commit:** `a008e82` (`feat: add media retry decision policy`).

### MEDIA-A5.1 Deterministic Technical Media QA Service & Failure Taxonomy 2026-09-26

- **Tujuan & Ruang Lingkup:** Menyediakan layanan jaminan kualitas teknis otomatis (`qa-service.ts`) yang mengevaluasi integritas biner, kesesuaian format, dimensi peran, serta firewall provenance dan privasi secara deterministik tanpa efek samping.
- **Taksonomi & Evaluasi Mutu:**
  - **QA-0 (Artifact Integrity):** Pemeriksaan biner kosong (`EMPTY_BYTES`), deteksi format rusak (`DECODE_OR_HEADER_INVALID`), validasi magic byte PNG/JPEG/WebP, dan deteksi payload error HTML/JSON (`ERROR_PAYLOAD`).
  - **QA-1 (Technical Quality):** Pemisahan aturan dimensi peran (`featured`: min 1200×630 px; `inline`: min 600×338 px), rasio aspek, dan batas byte file (min 20 KiB, max 5 MiB).
  - **QA-2 (Provenance & Privacy):** Validasi kelengkapan provenance dan penolakan langsung terhadap kebocoran kredensial (`SECRET_LEAK`).
  - **QA-3 s/d QA-5:** Evaluasi eligibilitas watermark, upload R2, dan lampiran slot artikel (`SLOT_OCCUPIED`).
  - **Batas Evaluator Semantik:** Evaluasi visi semantik secara ketat menghasilkan status `DEFERRED` (tidak pernah false `PASS`) jika model semantik belum dieksekusi.
- **Pengujian & Verifikasi (`scripts/test-media-a5-technical-qa.js`):**
  - 39/39 tes lulus 100% membuktikan ketepatan taksonomi, deteksi biner canary 169×512, dan imutabilitas skema database.
- **Commit:** `f24cd7a` (`feat: add deterministic media QA contract`).

### MEDIA-A4B Production Reversible Canary Execution 2026-09-26

- **Tujuan & Ruang Lingkup:** Melakukan uji coba kanonikal produksi (*production canary*) yang sepenuhnya dapat dibatalkan (*reversible*) untuk memverifikasi siklus penautan aset featured (`article_media`), pembuktian perubahan status preflight kanonikal artikel, dan pemulihan status ke baseline awal secara 100% identik menggunakan endpoint detach kanonikal.
- **Kronologi Eksekusi:**
  1. **Deployment Detach Endpoint:** Berhasil dideploy ke Cloudflare Edge Worker (`9fae7b79-c6b1-4b0c-8e92-2391d1cbe958`).
  2. **Baseline State:** Artikel ID 1 memiliki status preflight kanonikal dengan hash `h_29741012`.
  3. **Canonical Attach:** Menautkan aset `ast_8321f8f3eb7b039c59c222ba` sebagai media featured aktif (`binding_id: 12`).
  4. **State Transition:** Hash preflight kanonikal berubah secara deterministik menjadi `h_10b404c9`. Kesiapan publikasi tetap `NOT_READY` karena kontrol editorial tetap ditegakkan.
  5. **Canonical Detach (Rollback):** Memanggil endpoint `/api/internal/v1/media/article-media/detach` untuk menonaktifkan binding ID 12 (`is_active = 0`).
  6. **Restoration Verification:** Status kanonikal artikel ID 1 kembali 100% persis ke hash baseline awal (`h_29741012`). Kolom legasi `articles.featured_image` tetap tidak tersentuh.
- **Hasil Mutasi Produksi:** Zero side-effects; binding tersimpan dalam status inaktif untuk audit trail; slot editorial kembali bersih.

### MEDIA-A4B.1 Canonical Article Media Detach / Deactivate Service 2026-09-26

- **Tujuan & Ruang Lingkup:** Mengimplementasikan layanan pelepasan/deaktivasi kanonikal (`detachArticleMedia`) dan endpoint internal (`/api/internal/v1/media/article-media/detach`) yang bekerja secara soft-deactivation (`is_active = 0`) untuk memulihkan status kanonikal artikel tanpa memutasi kolom legasi `articles.featured_image`, tabel `media_assets`, atau tabel publikasi, menyediakan jalur *canonical rollback* aman sebelum eksekusi canary produksi MEDIA-A4B.
- **Akar Masalah Jalur Legasi (`unbindFeaturedMedia`):**
  - Jalur unbind legasi di `src/lib/media/service.ts` melakukan mutasi langsung pada `articles.featured_image = ''` dan `articles.image_alt = ''`.
  - Hal ini tidak kompatibel dengan arsitektur media modern RancangLoka karena sumber kebenaran kanonikal untuk gambar artikel adalah tabel relasi `article_media WHERE role = 'featured' AND is_active = 1`.
  - Mengosongkan kolom legasi berisiko merusak metadata artikel dan tidak dapat dibatalkan (non-reversible).
- **Implementasi Layanan Kanonikal (`src/lib/media/article-media.ts`):**
  - **Fungsi:** `detachArticleMedia(params: ArticleMediaDetachParams, db: any): Promise<ArticleMediaDetachResult>`.
  - **Target Terfokus (Exact Scope):** Memerlukan kombinasi eksplisit `article_id` dan `asset_id` (serta opsional `slot_key` dan `binding_id`). Menolak kueri broad deactivation tanpa kriteria identitas.
  - **Soft-Deactivation Semantics:** Menjalankan `UPDATE article_media SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_active = 1`. Baris historis tetap tersimpan untuk keperluan audit.
  - **Pembebasan Unique Slot:** Begitu `is_active` menjadi 0, partial unique index SQLite `idx_article_media_one_active_slot` pada `(article_id, slot_key) WHERE is_active = 1` langsung terbebaskan, sehingga slot editorial dapat digunakan oleh aset baru.
  - **Imutabilitas Mutlak Kolom Legasi:** Tidak ada mutasi pada tabel `articles` (`articles.featured_image` tetap utuh).
  - **Idempotensi & Concurrency Safety:** Jika binding sudah berstatus `is_active = 0`, layanan mengembalikan `already_inactive: true` secara deterministik tanpa error. Kueri scoped pada primary key `id` dan `is_active = 1` mencegah race condition.
  - **Audit Logging:** Mencatat aksi `'DETACH'` ke dalam tabel `media_asset_audit`.
- **Implementasi Endpoint Internal API (`src/pages/api/internal/v1/media/article-media/detach.ts`):**
  - Rute: `POST /api/internal/v1/media/article-media/detach`.
  - Otentikasi: Menggunakan `authenticateDeviceRequest` (HMAC berpasangan) dengan paritas penuh terhadap endpoint attach.
  - Firewall Payload: Menolak biner/multipart (`BINARY_PAYLOAD_NOT_ACCEPTED`, HTTP 415).
  - Validasi Input: Validasi ketat untuk `article_id`, `asset_id`, dan format `slot_key`.
- **Pengujian & Verifikasi Komprehensif (`scripts/test-media-a4b1-detach.js`):**
  - 8/8 pengujian deterministik offline lulus 100%:
    1. `LEGACY_FEATURED_IMAGE_IMMUTABILITY_TEST_PASS`: Kolom `articles.featured_image` identik sebelum, saat, dan sesudah detach.
    2. `CANONICAL_STATE_ROUNDTRIP_PASS`: Hash preflight kanonikal pasca-detach sama persis 100% dengan baseline pre-attach (`h_29741012`).
    3. `ACTIVE_SLOT_REUSE_PASS`: Slot `'featured'` yang dilepas sukses diisi oleh aset pengganti.
    4. `DETACH_IDEMPOTENCY_PASS`: Detach berulang aman dan mengembalikan `already_inactive: true`.
    5. `DETACH_CONFLICT_HANDLING_PASS`: Fail-closed untuk artikel 404, aset 404, binding 404, role mismatch 422, dan invalid slot 400.
    6. `DETACH_MUTATION_SCOPE_PASS`: Tabel `articles` dan `media_assets` tidak mengalami mutasi efek samping.
    7. `DETACH_LEDGER_DECOUPLING_PASS`: Trajectory ledger tetap bersih (0 row).
    8. `LOCAL_FULL_ROUNDTRIP_PASS`: Siklus canary lokal A4B (baseline → attach → verify → detach → hash match) terbukti deterministik.
- **Commit Repositori:**
  - `b5a4d18`: `feat: add canonical article media detach lifecycle`

### MEDIA-A4A Media Asset Registration, Nested Delivery & Source Provenance 2026-09-25 / 2026-09-26

- **Tujuan & Ruang Lingkup:** Mendaftarkan artefak gambar terverifikasi dari Cloudflare R2 (`media/canary/media-a3/...`, sha256 `7b30ab30...`) ke dalam tabel database D1 `media_assets` produksi, memperbaiki penanganan kunci penyimpanan bersarang pada rute publik `/media/[...key]`, mempertahankan semantik asal sumber (`source_origin: 'local_fixture'`), serta menguji delivery langsung via HTTPS.
- **Perbaikan Rute Pengiriman Media Bersarang (`src/pages/media/[...key].ts`):**
  - **Akar Masalah:** Rute single-segment `/media/[key].ts` menolak URL yang memiliki subdirektori (misal `media/canary/...`).
  - **Solusi:** Diubah menjadi rest parameter `/media/[...key].ts`, dinormalisasi dari path traversal (`..`, `%2e%2e`), trailing slashes, dan penanganan decoding yang aman.
  - **Tes Regresi:** 16/16 tes pada `scripts/test-media-delivery-route.js` lulus 100%.
  - **Commit:** `67cdbe0`: `fix: support nested media storage keys`.
- **Preservasi Semantik Sumber Asal (`src/lib/media/asset-registration.ts`):**
  - **Akar Masalah:** Logika lama menetapkan `source_type: 'lokamedia_extension'` secara flat tanpa merekam sumber upstream (`local_fixture`, `chatgpt_browser_bridge`, atau `fal_api`).
  - **Solusi:** Ditambahkan `buildMediaAssetRegistrationPayload` yang merefleksikan metadata provenance secara presisi ke dalam kolom `provenance_json`.
  - **Commit:** `12def9e`: `fix: preserve media source provenance semantics`.
- **Eksekusi Produksi (MEDIA-A4A.2 Canary Live):**
  - Dideploy ke Cloudflare Edge Worker (Deployment ID: `d35528c0-7695-4c85-9a9d-ee39e6097c2a`).
  - Registrasi 1 baris ke D1 `media_assets`:
    - `asset_id`: `ast_8321f8f3eb7b039c59c222ba`
    - `storage_key`: `media/canary/media-a3/7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967.png`
    - `sha256`: `7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967`
    - `status`: `VALIDATED`, `role`: `ARTICLE_PUBLIC_DERIVATIVE`
  - Verifikasi Live Delivery: HTTP 200 OK dengan sha256 dan ukuran biner cocok 100%.
- **Commit Terkait:**
  - `d31c618`: `feat: add media asset registration payload builder and prep test suite`
  - `5e0d76b`: `test: add MEDIA-A4B preparation and dry-run test suite`

### MEDIA-A3 Watermark Derivative Engine & Production R2 Storage Canary 2026-09-25

- **Tujuan & Ruang Lingkup:** Mengimplementasikan proses transformasi watermark teks kanonikal (`rancangloka.com`, `bottom-right`, `opacity=0.62`, `font_size_ratio=0.022`) pada artefak gambar terverifikasi (`GeneratedImageArtifact`), menjaga imutabilitas sumber asli 100%, menghasilkan derivatif gambar deterministik lokal, melakukan satu kali upload live kanonikal ke Cloudflare R2 bucket produksi (`rancangloka-media`), mengunduh ulang secara independen untuk pembuktian hash dan integritas byte (`R2_BYTE_INTEGRITY=PASS`), serta menyusun kontrak serah-terima kanonikal `StoredGeneratedImageArtifact` untuk tahapan MEDIA-A4.
- **Otorisasi & Batasan Mutasi Produksi:**
  - **Otorisasi Terbatas:** Operator telah memberikan otorisasi untuk tepat 1 objek derivatif baru pada Cloudflare R2 bucket `rancangloka-media`.
  - **Firewall Keamanan Produksi:** Dilarang melakukan mutasi D1 (`PRODUCTION_D1_MUTATIONS=0`), dilarang menambah baris pada `media_assets` (`MEDIA_ASSETS_ROWS_CREATED=0`), dilarang membuat binding `article_media` (`ARTICLE_MEDIA_ATTACHMENTS=0`), dilarang mengubah status draf/artikel (`ARTICLE_MUTATIONS=0`), dilarang memicu pipeline publikasi (`PUBLICATION_MUTATIONS=0`), dilarang deploy worker baru (`PRODUCTION_DEPLOYED=NO`), dan dilarang memanggil provider berbayar (`FAL_API_CALLS=0`).
- **Implementasi Engine Derivatif (`src/lib/media/stored-image-artifact.ts`):**
  - **`renderTextWatermarkDerivative()`:** Merender watermark teks menggunakan W3C Canvas 2D engine (`@napi-rs/canvas`) dengan rumus metriks dan penempatan deterministik dari `extensions/lokamedia/src/watermark-engine.js`.
  - **Preservasi Dimensi:** Dimensi piksel sumber (169×512) dipertahankan mutlak tanpa peregangan atau distorsi pada derivatif (169×512).
  - **`createStoredGeneratedImageArtifact()`:** Membangun kontrak `StoredGeneratedImageArtifact` yang mencakup identitas deterministik `artifact_id`, `source_artifact_id`, namespace R2 `storage_key`, `sha256`, `byte_size`, `watermark_applied=true`, `watermark_config_hash`, dan provenance terverifikasi lengkap.
- **Hasil Eksekusi Live Canary R2 Produksi (`scripts/run-media-a3-r2-canary.js`):**
  - **Sumber Aman:** `public/stitch-homepage.png` (`SOURCE_BEFORE_SHA256: 92eca8e32eb2f0f4e176054d82ce8830faf103044ddb75f59f778e204763676d`, 169×512 px, 58.941 bytes).
  - **Derivatif Lokal:** `DERIVATIVE_SHA256: 7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967`, 169×512 px, 66.377 bytes, MIME `image/png`.
  - **Idempotensi Lokal:** Terverifikasi 100% deterministik (`R2_DERIVATIVE_IDEMPOTENCY: PASS`).
  - **Pemeriksaan Pra-Upload (Fail-Closed Guard):** Kunci `media/canary/media-a3/7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967.png` diverifikasi terlebih dahulu di bucket `rancangloka-media`; terkonfirmasi objek belum ada (HTTP 404).
  - **Upload R2 Produksi:** Tepat 1 kali percobaan upload via `wrangler r2 object put` menggunakan `CLOUDFLARE_ACCOUNT_ID=a8e6d11d45dc2d14fe49fe3b84958ee8` (`PRODUCTION_R2_UPLOAD_ATTEMPTS=1`, `PRODUCTION_R2_UPLOAD_SUCCESS=YES`).
  - **Re-Download & Pembuktian Integritas:** Objek diunduh ulang dari bucket produksi, dihitung ulang SHA-256 dan byte size-nya, dan terbukti 100% identik dengan derivatif lokal (`R2_BYTE_INTEGRITY: PASS`).
  - **Imutabilitas Sumber Asli:** `SOURCE_AFTER_SHA256` terbukti persis sama dengan `SOURCE_BEFORE_SHA256` (`SOURCE_IMMUTABLE: PASS`).
  - **Pengiriman Publik:** `PUBLIC_MEDIA_DELIVERY: NOT_APPLICABLE_UNTIL_MEDIA_A4` (route `/media/[key]` single segment tanpa slash, sesuai antisipasi spesifikasi).
  - **Kontrak Serah-Terima:** Disimpan di `artifacts/stored-generated-image-artifact.json` (`MEDIA_A4_STORAGE_CONTRACT: READY`).
- **Pengujian Unit & Regresi (`scripts/test-media-a3-r2-canary.js`):**
  - 6/6 tes unit MEDIA-A3 LULUS (immutability, render deterministik, preservasi dimensi, validasi magic bytes, pembuatan kontrak, dan firewall rahasia).
  - Seluruh rangkaian regresi sistem (A2, watermark settings, asset storage, headless provider, fal mock, fullres capture, asset registration, media planning, typecheck tsc, build astro) lulus 100%.
- **Commit Repositori:**
  - `2e617c3`: `feat: watermark and store production media artifact`

### MEDIA-A2 Provider-Neutral Image Artifact Normalization & Validation 2026-09-25

- **Tujuan & Ruang Lingkup:** Membangun lapisan normalisasi dan validasi artefak media netral-provider (`GeneratedImageArtifact`) untuk menjembatani output dari berbagai sumber pembuatan gambar (jalur otonom `fal.ai FLUX`, jalur manual browser bridge `ChatGPT Plus / LokaMedia`, dan aset fixture repositori lokal) ke dalam format kanonikal tunggal tanpa bergantung pada struktur respons spesifik vendor atau DOM browser, dilengkapi validasi biner asli, ekstraksi dimensi, deteksi anti-spoofing MIME, hashing SHA-256 deterministik, aturan identitas content-addressed, model error bertipe, dan firewall privasi/rahasia.
- **Implementasi Normalisasi & Validasi (`src/lib/media/generated-image-artifact.ts`):**
  - **Kontrak `GeneratedImageArtifact`:** Memuat `artifact_id`, `source_type` (`fal_api` / `chatgpt_browser_bridge` / `local_fixture`), `provider`, `model`, `image_bytes`, `mime_type`, `width`, `height`, `byte_size`, `sha256`, `prompt_hash`, `prompt_version`, `media_role`, `purpose`, `created_at`, dan `provenance`.
  - **Aturan Identitas Kanonikal:** `ARTIFACT_IDENTITY_RULE = 'art_${sha256.substring(0, 24)}'`. Dua biner yang persis sama akan selalu menghasilkan `artifact_id` yang identik.
  - **Fungsi Normalisasi:**
    - `normalizeHeadlessResult`: Menormalkan `ImageGenerationResult` dari provider otonom.
    - `normalizeChatGptBridgeResult`: Menormalkan objek tangkapan dari ekstensi browser LokaMedia (`bytes`, `data_url`, `blobKey`, dsb).
    - `normalizeLocalFixture`: Menormalkan aset berkas lokal terverifikasi.
  - **Validasi Biner & Anti-Spoofing:** Memeriksa magic bytes asli (PNG, JPEG, WebP), mengekstraksi dimensi asli, menolak biner kosong/terpotong (`EMPTY_IMAGE`), menolak respon HTML/JSON error provider (`INVALID_IMAGE_SIGNATURE`), serta mendeteksi ketidaksesuaian deklarasi MIME (`UNSUPPORTED_MIME`) dan dimensi (`DIMENSION_INVALID`).
  - **Secret & Privacy Firewall:** Fungsi `sanitizeProvenance()` dan `sanitizeUrl()` memindai dan menghapus seluruh token otentikasi (`FAL_KEY`, `authorization: Bearer ...`, cookies, session tokens, serta query parameter URL sensitif seperti `?key=`, `?sig=`, `?token=`).
  - **Kontrak Serah-Terima MEDIA-A3:** Fungsi `createMediaA3Contract` memformat input tervalidasi yang siap dikonsumsi tahapan watermark dan R2 storage.
- **Pengujian Unit MEDIA-A2 (`scripts/test-media-a2-normalization.js`):**
  - 14/14 tes unit deterministik offline lulus 100% (headless normalization, chatgpt bridge normalization, local fixture canary, binary magic bytes, MIME anti-spoofing, dimension anti-spoofing, SHA-256 hashing, artifact identity semantics, provenance normalization, secret firewall, HTML error rejection, JSON error rejection, empty bytes fail-closed, dan media-a3 contract creation).
- **Canary Fixture Lokal Riil:**
  - `CANARY_SOURCE`: `public/stitch-homepage.png`
  - `CANARY_SOURCE_TYPE`: `local_fixture`
  - `ARTIFACT_ID`: `art_92eca8e32eb2f0f4e176054d`
  - `ARTIFACT_SHA256`: `92eca8e32eb2f0f4e176054d82ce8830faf103044ddb75f59f778e204763676d`
  - `ARTIFACT_BYTE_SIZE`: `58941`
  - `ARTIFACT_WIDTH`: `169`, `ARTIFACT_HEIGHT`: `512`
  - `ARTIFACT_MIME`: `image/png`
- **Commit Repositori:**
  - `f8bc39f`: `feat: normalize generated media artifacts`

### MEDIA-A1 & MEDIA-A1.1 Headless Image Provider Adapter & Fal.ai Autonomous Pipeline 2026-09-25

- **Tujuan & Ruang Lingkup:** Menggantikan ketergantungan generasi gambar manual pada browser/ekstensi Chrome dengan adapter API provider headless netral-provider (`ImageProviderAdapter`), memisahkan arsitektur generasi otonom (`fal.ai API` / FLUX) dan generasi manual (`ChatGPT Plus UI` via ekstensi LokaMedia), mengimplementasikan validasi biner deterministik lokal, hashing prompt deterministik, penanganan error bertipe, pelindung panggilan tunggal (`MAX_PROVIDER_GENERATE_CALLS=1`), pencatatan provenance lokal, serta kontrak serah-terima ke tahapan MEDIA-A2.
- **Klarifikasi Arsitektur Provider Terpisah (Provider Separation):**
  - **Otonom (Server-Side / Background):** `fal.ai API` menggunakan model `fal-ai/flux/dev` via `FalImageProviderAdapter`. Menggunakan endpoint API komersial terstruktur, mendukung rasio lanskap arsitektural editorial (1312×672 / 1312×656 mendekati ~2:1), materialisasi download URL ke byte lokal, dan otentikasi via `FAL_KEY`.
  - **Manual (Human-Supervised):** `ChatGPT Plus browser UI` via ekstensi browser LokaMedia / CDP bridge.
  - **Konvergensi Kontrak:** Kedua jalur generasi menormalkan output ke kontrak downstream kanonikal yang persis sama: `ImageGenerationResult` / `GeneratedImageArtifact`.
- **Implementasi Abstraksi Netral-Provider (`src/lib/media/`):**
  - **`image-provider-types.ts`:** Mendefinisikan interface `ImageProviderAdapter`, kontrak permintaan `ImageGenerationRequest`, hasil `ImageGenerationResult`, metadata biaya `ImageCostMetadata`, dan model error bertipe `ImageProviderError` dengan kode: `AUTH_ERROR`, `RATE_LIMIT`, `TIMEOUT`, `PROVIDER_5XX`, `INVALID_RESPONSE`, `CONTENT_POLICY_BLOCK`, `DOWNLOAD_FAILURE`, `UNKNOWN_PROVIDER_ERROR`.
  - **`image-validation.ts`:** Validator biner deterministik memeriksa magic bytes signature untuk PNG, JPEG, dan WebP, mengekstraksi dimensi piksel asli, menolak payload teks/HTML/error yang menyamar sebagai gambar, serta menghitung hash SHA-256 melalui Web Crypto.
  - **`headless-image-pipeline.ts`:** Koordinator pipeline headless yang menegakkan kuota panggilan keras canary (`MAX_CALLS`), menghitung SHA-256 prompt yang dinormalisasi (`computePromptSha256`), menyimpan artefak biner lokal, menyusun provenance terverifikasi bebas rahasia, dan memformat kontrak serah-terima `MediaA2InputContract`.
  - **`fal-image-adapter.ts`:** Adapter resmi fal.ai mengintegrasikan `@fal-ai/client`, menangani pemetaan rasio gambar, pengunduhan biner dari hosted URL, redaksi total rahasia token (`[REDACTED_FAL_KEY]`), dan pemetaan error fal.ai ke model error kanonikal.
  - **`openai-image-adapter.ts`:** Adapter OpenAI DALL-E 3 yang mendukung mode `b64_json` dengan sanitasi ketat pesan error gateway.
- **Hasil Pengujian & Verifikasi Unit:**
  - **`test-headless-image-provider.js`:** 7/7 tes unit lulus (pemetaan permintaan, normalisasi respons, redaksi rahasia, hash prompt deterministik, validasi biner, klasifikasi error bertipe, dan batas 1-panggilan keras).
  - **`test-fal-image-provider.js`:** 7/7 tes unit fal.ai lulus (pemetaan dimensi fal 1312x672/1024x1024/672x1312, normalisasi URL & download byte, proteksi kredensial, validasi biner, pemetaan error API, dan koordinasi batas panggilan tunggal).
- **Hasil Regresi & Build Komprehensif:**
  - `node scripts/test-decision-media-planning.js`: 16/16 PASSED.
  - `node scripts/test-lokamedia-phase5d4a-watermark-settings.js`: 14/14 PASSED.
  - `node scripts/test-lokamedia-phase5d4b-watermark-asset-storage.js`: 12/12 PASSED.
  - `node scripts/test-lokamedia-phase5g1-asset-registration.js`: 40/40 PASSED.
  - `npx tsc --noEmit`: 0 error tipe.
  - `npm run build`: Astro production SSR build PASSED (5.86s).
- **Status Eksekusi Live Canary & Guardrail Kredensial:**
  - **Canary OpenAI:** 1 panggilan genuine dikirim ke endpoint OpenAI; gateway mengembalikan HTTP 401 (`AUTH_ERROR`) non-billable (`Incorrect API key provided: [REDACTED_KEY]`). Eksekusi berhenti deterministik tanpa mutasi atau tagihan.
  - **Canary Fal.ai:** Mengikuti guardrail keselamatan Bagian 1 & 2 (*"Check only: FAL_KEY_PRESENT=YES|NO. If NO: STOP"*), sistem memeriksa lingkungan: `FAL_KEY_PRESENT=NO`. Eksekusi berhenti aman sebelum pemanggilan jaringan (`FAL_API_REQUEST_ATTEMPTS=0`, `OFFLINE_BINARY_VALIDATOR_TESTS=PASS`, `LIVE_IMAGE_BINARY_VALIDATION=N/A`).
- **Invarian Keamanan Produksi:**
  - `PRODUCTION_D1_MUTATIONS=0`, `PRODUCTION_R2_UPLOADS=0`, `ARTICLE_MEDIA_ATTACHMENTS=0`, `ARTICLE_MUTATIONS=0`, `PUBLICATION_MUTATIONS=0`, `PRODUCTION_DEPLOYED=NO`.
  - Tidak ada kunci rahasia yang tercetak di log, tersimpan di sumber, atau tersimpan di file provenance.
  - Artefak lokal berada dalam direktori `artifacts/` yang telah diabaikan oleh Git (`.gitignore`).
- **Commit Repositori:**
  - `bbd6d3d`: `feat: add headless image provider adapter`
  - `eee93ee`: `feat: add fal image provider adapter`

### MEDIA-W1 Watermark Production End-to-End Canary 2026-09-24

- **Tujuan & Ruang Lingkup:** Membuktikan alur kerja watermark media RancangLoka end-to-end pada lingkungan produksi nyata (`SOURCE IMAGE → WATERMARK CONFIG → DERIVATIVE RENDER → DERIVATIVE BYTES → R2 → MEDIA_ASSETS → FRONTEND DELIVERY`) tanpa memutasi artikel produksi (Artikel 1, 5, 6 tetap utuh), membuktikan imutabilitas mutlak byte sumber asli, serta menjaga seluruh batas kontrol keselamatan (`mode=OFF`, `auto_schedule=false`, `kill_switch=0`, `JEV authority=ZERO`).
- **Audit Subkoleksi Logo & Konfigurasi:**
  - Konfigurasi aktif di D1 produksi: `type='TEXT'`, `text='rancangloka.com'`, `position='bottom-right'`, `opacity=0.65`, `margin_x_ratio=0.022`, `margin_y_ratio=0.028`, `version=2`.
  - Audit logo resmi RancangLoka (`site_watermark_assets`): 0 baris di D1 produksi, tidak ada aset logo resmi di repositori. Sesuai batasan operasional, pembuatan logo fiktif dilarang keras, sehingga canary IMAGE di-skip secara bersih (`IMAGE_WATERMARK_CANARY=SKIPPED_NO_OFFICIAL_ASSET`).
- **Pemilihan Aset Sumber Aman (Safe Source Asset):**
  - Menggunakan aset internal non-kritis milik proyek: `canary-source-stitch-dashboard.png` (512 × 410 px, `image/png`, 42.919 bytes, SHA-256: `eb76a0a608e64422d74d697ce66b0631c45113e1f2ff54c3595cc0952ecf1998`).
  - Terdaftar di `media_assets` D1 produksi dengan Asset ID: `ast_993f8cdef94bc30f403082c2`, role: `ORIGINAL`.
  - Byte asli di Cloudflare R2 bucket `rancangloka-media` diverifikasi sebelum dan sesudah eksekusi canary (`ORIGINAL_SOURCE_IMMUTABLE=PASS`, `SOURCE_BEFORE_SHA256 === SOURCE_AFTER_SHA256`).
- **Eksekusi Pipeline Derivatif Teks (Text Derivative Pipeline):**
  - **Render Kanonikal:** Dijalankan melalui mesin rendering kanonikal dengan OffscreenCanvas native browser (`applyWatermarkTransform`): 512 × 410 px, 62.080 bytes, SHA-256: `d89bf7d4074e29d2d16762ad34b1a8e5023d03f697c3114dc36fe922fb751bc2` (`TEXT_RENDER_SUCCESS=YES`).
  - **Identitas Deterministik:** Transform ID `2803c1761da301dff63a2f444346f3b7777212de5eae70c5526c5bb71252468e`, Derivative ID `der_c3c4ab6d62d5c05b85fe7a2a907e92b72cfc114d982874a94a4c93d811208629`.
  - **Upload R2 Produksi:** Diunggah ke bucket `rancangloka-media` dengan key `canary-text-derivative-d89bf7d4.png`. Hash terbaca dari R2 cocok 100% dengan hash byte lokal (`TEXT_R2_UPLOAD=PASS`).
  - **Registrasi `media_assets`:** Asset ID `ast_e29a1bb65e754877158e7ec0` tersimpan di database D1 produksi dengan `provenance_json` lengkap (`source_media_asset_id`, `watermark_config`, `derivative_id`, `transform_id`) (`TEXT_MEDIA_REGISTRATION=PASS`).
  - **Frontend Delivery:** Permintaan `GET /media/canary-text-derivative-d89bf7d4.png` menyajikan derivatif dengan status HTTP 200, Content-Type `image/png`, 62.080 bytes, SHA-256 sesuai (`TEXT_FRONTEND_DELIVERY=PASS`).
  - **Visual QA:** Teks "rancangloka.com" tampil kontras, bersih, putih dengan bayangan jatuh tipis di sudut kanan bawah, opasitas proporsional, konten gambar asli tetap jelas tanpa artefak deformasi (`TEXT_VISUAL_QA=PASS`).
- **Firewall Keamanan & Integritas Produksi:**
  - `NEW_CANARY_ARTICLE_MEDIA_BINDINGS=0`, `ARTICLE_MEDIA_FIREWALL=PASS`.
  - `NEW_PUBLICATION_PLANS=0`, `NEW_PUBLICATION_EXECUTIONS=0`, `NEW_PUBLICATION_RECEIPTS=0`, `NEW_PUBLICATIONS=0`.
  - Mode otomasi tetap: `mode=OFF`, `auto_schedule=false`, `kill_switch=0`, `JEV authority=ZERO`.
  - Status kesehatan publik: 5 dari 5 endpoint lulus (`FINAL_PUBLIC_HEALTH=PASS`).
  - Klasifikasi akhir: `WATERMARK_STATUS=TEXT_PRODUCTION_PROVEN_IMAGE_AWAITING_OFFICIAL_ASSET`, `WATERMARK_E2E_PRODUCTION_PROVEN=PARTIAL`.

### LokaMedia Phase 5L13B-B Single Canary Featured Media Production Canonical Ingest 2026-09-22

- **Tujuan & Ruang Lingkup:** Menyiapkan Artikel 5 (`kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`) sebagai tepat SATU (*single canary*) kandidat eligible publikasi deterministik di bawah `auto_policy` tanpa mengaktifkan otomasi publikasi, melalui pembuatan aset gambar utama editorial terdedikasi, validasi biner lokal (1315x660 px, WebP), pengunggahan kanonikal melalui endpoint `POST /api/internal/v1/media/upload`, registrasi aset kanonikal `media_assets`, binding relasional `article_media`, serta rekonsiliasi kesiapan publikasi melalui endpoint terotentikasi sesi admin `POST /api/admin/publication/readiness/5`.
- **Eksekusi Ingest Media Kanonikal Produksi:**
  - **Aset Gambar Terdedikasi:** Dihasilkan sesuai arahan kreatif terkunci (fotografi arsitektural editorial fotorealistik ruang tinggal tropis Indonesia membandingkan kusen aluminium ramping matte-charcoal dan kusen uPVC multi-chamber hangat berdampingan secara netral tanpa teks/logo/manusia/CGI).
  - **Validasi Biner Lokal:** Dimensi 1315 × 660 px, format `image/webp`, ukuran 170.790 bytes (170,8 KB), SHA-256: `631baf7a25e9986b9f0d01073633cb434ae162b3df1241ddac56b977026276e9`.
  - **Jalur Ingest Kanonikal:** Menggunakan `POST /api/internal/v1/media/upload` dengan otentikasi kredensial perangkat lingkungan produksi (`RANCANGLOKA_MEDIA_UPLOAD_KEY`, scope `media:write:draft`). Binary payload langsung diunggah ke Cloudflare R2 bucket `rancangloka-media` dengan storage key `media/images/631baf7a25e9986b9f0d01073633cb434ae162b3df1241ddac56b977026276e9.webp`.
  - **Registrasi `media_assets`:** Asset ID `ast_mfUpgVe99C_bq_p2d_O4Ge4L`, status `VALIDATED`, source_type `manual_upload`, media_type `image`, dimensi 1315x660, alt text informatif tanpa keyword stuffing.
  - **Binding Relasional `article_media`:** Record ID 11 mengikat `ast_mfUpgVe99C_bq_p2d_O4Ge4L` ke Artikel 5 (`role='featured'`, `slot_key='featured'`, `is_active=1`). Artikel 1–4 dan 6 sama sekali tidak tersentuh.
- **Hasil Rekonsiliasi Kesiapan Publikasi (Readiness Snapshot):**
  - Pemanggilan `POST /api/admin/publication/readiness/5` melalui konteks sesi admin menghasilkan evaluasi deterministik baru:
  - `checks.article_integrity`: PASS
  - `checks.editorial_guards`: PASS
  - `checks.evidence_and_citations`: PASS
  - `checks.visual_media`: PASS
  - `checks.publication_metadata`: PASS
  - `policy.system_policy_pass`: true (`ARTICLE_5_SYSTEM_POLICY_PASS=YES`).
  - Sisa blocker: `["APPROVAL_MISSING"]` (sesuai semantik arsitektur terkunci, ketiadaan persetujuan manusia tidak menggugurkan kelayakan `auto_policy`).
- **Pembuktian Calon Tunggal Prospektif (Exactly-One Prospective Candidate):**
  - Draft 1–4: `PROSPECTIVE_ELIGIBLE = NO` (tidak memiliki binding media relasional aktif di `article_media` dan gagal quality gate deterministik).
  - Draft 5: `PROSPECTIVE_ELIGIBLE = YES` (lolos seluruh 5 gate deterministik `auto_policy`).
  - `PROSPECTIVE_AUTO_POLICY_CANDIDATE_COUNT = 1`, `PROSPECTIVE_AUTO_POLICY_CANDIDATE_IDS = [5]`.
- **Firewall Keamanan & Status Siklus Hidup Tetap Terjaga:**
  - Mode otomasi tetap non-aktif: `FINAL_MODE=OFF`, `FINAL_AUTO_SCHEDULE=false`, `FINAL_KILL_SWITCH=0`.
  - Siklus hidup bersih: `NEW_PLANS=0`, `NEW_EXECUTIONS=0`, `NEW_RECEIPTS=0`, `NEW_PUBLICATIONS=0`.
  - Integritas situs publik: Beranda publik sehat, Artikel 6 terbit tetap utuh, sitemap sehat tanpa kebocoran draft, Artikel 5 tetap berstatus `draft` (404 pada URL publik).
  - Mutasi raw SQL: 0. Mutasi ad-hoc R2: 0.

### LokaMedia Phase 5L13B-Pre Production Media Audit & Suitability Decision 2026-09-22

- **Tujuan & Ruang Lingkup:** Melakukan audit mendalam terhadap seluruh aset media yang ada pada database D1 produksi (`media_assets`, `article_media`), Cloudflare R2 bucket (`rancangloka-media`), serta galeri CMS admin untuk mengevaluasi kelayakan penggunaan ulang (*reuse suitability*) sebagai aset gambar utama (*featured media*) bagi Artikel 5 (`kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`).
- **Hasil Audit Inventaris Media Produksi:**
  - **D1 `media_assets`:** 0 baris (belum ada aset kanonikal terdaftar).
  - **D1 `article_media`:** 0 baris (belum ada relasi binding media ke artikel).
  - **R2 Storage (`rancangloka-media`):** Ditemukan tepat 1 objek biner aktif: `rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman-8422.webp` (148 KB, WebP, resolusi 1200x600 px). Objek ini terikat pada Artikel 6 yang telah terbit.
  - **Aset Draft Artikel 1–5:** Artikel 1 memiliki referensi gambar bambu laminasi dengan resolusi 400x267 px (gagal batas minimum resolusi kanonikal ≥600x338 px). Artikel 2–5 memiliki nilai `featured_image = ""`.
  - **Fixture Lokal:** Identitas fixture pada SQLite miniflare lokal (`ast_phase5l5_5`, `ast_phase5l7_fixture`) terbukti tidak ada di D1 maupun R2 produksi.
- **Evaluasi Kesesuaian (Reuse Suitability) untuk Artikel 5:**
  - Artikel 5 membahas komparasi material kusen jendela dan pintu tropis (*kusen aluminium vs uPVC*).
  - Objek R2 yang ada secara tematik dan visual menampilkan rekayasa aliran udara ventilasi silang (milik Artikel 6). Penggunaan ulang objek ini dinilai **TIDAK SESUAI (UNSUITABLE)** dan berisiko merusak integritas konten editorial.
- **Pemberlakuan Guardrail Keamanan (STOP DULU):**
  - Mengikuti instruksi ketat: *"kalau tidak ada → STOP dulu, jangan generate sembarangan"*, agen menghentikan proses mutasi dan tidak melakukan pembuatan atau pengunggahan gambar sembarangan tanpa persetujuan eksplisit.
- **Invarian Keamanan Produksi Tetap Terjaga:**
  - Mode otomasi tetap non-aktif: `AUTOMATION_MODE=OFF`, `AUTO_SCHEDULE_ENABLED=false`, `KILL_SWITCH=0`.
  - Status lifecycle bersih: `TOTAL_PLANS=0`, `ACTIVE_PLANS=0`, `TOTAL_EXECUTIONS=0`, `ACTIVE_EXECUTIONS=0`, `TOTAL_RECEIPTS=0`.
  - Nol mutasi pada produksi (`PRODUCTION_MUTATIONS=0`, `PRODUCTION_R2_WRITES=0`).

### LokaMedia Phase 5L13A Production Plan-Only Candidate Isolation Audit 2026-09-22

- **Tujuan & Ruang Lingkup:** Melakukan audit read-only komprehensif pada 5 draft artikel produksi untuk mengevaluasi kelayakan otomatis terhadap kebijakan publikasi sistem (`auto_policy` / `evaluateAutoScheduleEligibility`) guna menetapkan strategi isolasi deterministik calon kanari (*single-canary strategy*) sebelum aktivasi `PLAN_ONLY`.
- **Evaluasi 5 Draft Artikel Menggunakan Kebijakan Kanonikal:**
  - Seluruh 5 draft saat ini berstatus `AUTO_SCHEDULE_ELIGIBLE = NO` dan `SYSTEM_POLICY_PASS = NO`.
  - Penyebab utama kegagalan deterministik: Ketiadaan binding media utama aktif pada tabel relasional `article_media` (`FEATURED_MEDIA_MISSING`).
  - Draft 1–4 belum memiliki snapshot evaluasi kesiapan (`article_publication_readiness`).
  - Draft 5 memiliki snapshot historis dengan status `NOT_READY` dan blocker `FEATURED_MEDIA_MISSING`.
- **Semantik Persetujuan Kebijakan Otomatis (Locked Architecture):**
  - Mempertahankan arsitektur yang terkunci: Kelayakan `auto_policy` tidak mewajibkan persetujuan manusia (`AUTO_POLICY_APPROVAL_SEMANTICS_PRESERVED=YES`). Status `HUMAN_APPROVAL_PASS=NO` tidak menggugurkan artikel jika seluruh quality gate deterministik terpenuhi.
- **Populasi Kandidat & Analisis Risiko:**
  - Jumlah draft eligible saat ini: `AUTO_POLICY_ELIGIBLE_DRAFT_COUNT=0` (`AUTO_POLICY_ELIGIBLE_ARTICLE_IDS=[]`).
  - Klasifikasi risiko Exactly-One: `PLAN_ONLY_EXACTLY_ONE_RISK=NO_CANARY_AVAILABLE`.
- **Pemilihan Calon Kanari Kanonikal:**
  - Rekomendasi Kanari: Artikel ID 5 (`kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`).
  - Alasan: Artikel 5 merupakan artikel editorial asli (bukan smoke test fixture) yang telah lolos seluruh gate integritas teks, editorial guards, sitasi, dan metadata, serta hanya membutuhkan penyediaan binding media utama yang valid untuk mencapai `system_policy_pass=true`.
  - Mekanisme isolasi: `NATURALLY_ISOLATED` (tidak memerlukan temporary manual hold karena draft lain belum memenuhi syarat kualitas).
- **Analisis Kapabilitas Mode `PLAN_ONLY` & Kesiapan Jalur Kontrol:**
  - Di bawah mode `PLAN_ONLY`: `canPlan=true`, `canScheduleControlled=false`, `canPublishUnattended=false`. Pembuatan rencana diizinkan, namun promosi eksekusi dan penerbitan dilarang mutlak.
  - Endpoint operator terotentikasi kanonikal `POST /api/admin/publication/automation/control` terverifikasi siap mendukung transisi mode `OFF → PLAN_ONLY → OFF` dan `auto_schedule` `false → true → false` lengkap dengan audit logging.
- **Hasil Fase:** `PHASE_5L13A=PASS`, `READY_FOR_PHASE_5L13B=YES`. Mutasi produksi: 0.

### LokaMedia Phase 5L12D Canonical Production OBSERVE_ONLY Round-Trip 2026-09-22

- **Tujuan & Ruang Lingkup:** Menguji validasi round-trip mode otomasi kanonikal produksi pertama (`OFF → OBSERVE_ONLY → OFF`) menggunakan endpoint operator terotentikasi kanonikal `POST /api/admin/publication/automation/control` melalui konteks sesi browser admin yang sah, membuktikan atomisitas pencatatan audit kontrol-plane dan keamanan native Cron tanpa mutasi lifecycle.
- **Konteks & Keamanan Sesi Browser:**
  - Sesi admin terotentikasi aktif pada browser (`AUTHENTICATED_ADMIN_BROWSER_SESSION=YES`).
  - Permintaan mutasi dikirim melalui same-origin fetch dari konteks browser admin (`BROWSER_CANONICAL_REQUEST_METHOD=same_origin_fetch`), memenuhi pertahanan CSRF tanpa mengekstrak cookie/token rahasia.
  - Zero raw SQL: Tidak ada manipulasi SQL langsung ke tabel kontrol (`RAW_SQL_CONTROL_MUTATIONS=0`).
- **Aktivasi OBSERVE_ONLY Kanonikal:**
  - Transisi mode `OFF → OBSERVE_ONLY` berhasil via API (HTTP 200, `changed: true`).
  - Tercatat audit event ID: `actl_b951237dd0934f93`, correlation ID: `corr_bf57b3713580485a`, actor: `admin_operator`.
  - Status D1 produksi terverifikasi: `mode=OBSERVE_ONLY`, `auto_schedule_enabled=false`, `kill_switch_engaged=0`.
- **Observabilitas Native Cron di Bawah OBSERVE_ONLY:**
  - Menunggu trigger native Cloudflare Cron alami tanpa pemanggilan manual (`MANUAL_CRON_TRIGGER_CALLS=0`).
  - Dispatcher native cron mencatat status aman: `BLOCKED` (`UNATTENDED_PUBLISH_BLOCKED`) pada mode `OBSERVE_ONLY` (ID 615).
  - Reconciler native cron mencatat status aman: `BLOCKED` (`AUTOMATION_MODE_BLOCKS_EXECUTION_OBSERVE_ONLY`) pada mode `OBSERVE_ONLY` (ID 616).
  - Planner tidak dijadwalkan / belum jatuh tempo (`NOT_YET_DUE`).
- **Invarian Lifecycle & Kesehatan Publik:**
  - Mutasi rencana baru = 0 (`NEW_PLAN_COUNT=0`), mutasi eksekusi baru = 0 (`NEW_EXECUTION_COUNT=0`), tanda terima baru = 0 (`NEW_RECEIPT_COUNT=0`), publikasi baru = 0 (`NEW_PUBLICATION_COUNT=0`).
  - Status artikel konsisten tidak berubah (Draft: 5, Published: 1).
  - Rute publik tetap sehat: Homepage HTTP 200, artikel terbitan HTTP 200, sitemap XML HTTP 200.
- **Pengembalian Kanonikal ke OFF:**
  - Transisi mode `OBSERVE_ONLY → OFF` berhasil dieksekusi dari konteks browser kanonikal yang sama (HTTP 200, `changed: true`).
  - Tercatat audit event ID kedua: `actl_af92b730e5834af6`, correlation ID: `corr_b46d420022cc49c9`.
  - Tepat 2 event audit tercatat selama fase ini (`NEW_MODE_CHANGE_AUDIT_EVENTS=2`).
- **Status Akhir & Kesiapan:**
  - Mode akhir: `FINAL_MODE=OFF`, `FINAL_AUTO_SCHEDULE=false`, `FINAL_KILL_SWITCH=0`.
  - Kontrol operator kanonikal terbukti 100% aman dan teraudit secara persisten di produksi (`CANONICAL_PRODUCTION_CONTROL_VERIFIED=YES`).
  - Siap untuk fase berikutnya Phase 5L13 (`READY_FOR_PHASE_5L13=YES`).

### LokaMedia Phase 5L12C Canonical Control Production Deployment 2026-09-22

- **Tujuan & Ruang Lingkup:** Menerapkan migrasi D1 produksi `0020_automation_control_audit.sql` dan mendeploy Worker `rancangloka` yang berisi fondasi kontrol operator kanonikal terotentikasi & teraudit ke lingkungan produksi Cloudflare dalam kondisi aman non-aktif (`mode=OFF`, `auto_schedule_enabled=false`, `kill_switch_engaged=0`).
- **Verifikasi Pre-Deploy & Backup:**
  - Backup D1 produksi dibuat sukses melalui `wrangler d1 export` ke file snapshot lokal aman di luar git (`rancangloka_db_pre_5l12c_backup.sql`).
  - Seluruh 10 test suite regresi (5L12B, 5L10, 5L9, 5L6A, 5L6, 5L4, 5L3, 5L2, readiness, soak safety) lulus 100%.
  - Typecheck (`tsc --noEmit`), build Astro, dan Wrangler dry-run seluruhnya PASS.
- **Eksekusi & Validasi Migrasi 0020:**
  - Migrasi `0020_automation_control_audit.sql` diaplikasikan ke remote database `rancangloka_db` secara kanonikal via `wrangler d1 migrations apply`.
  - Tabel terdedikasi `automation_control_audit` dan indeksnya berhasil terbuat tanpa mengubah data yang ada (`MIGRATION_0020_ADDITIVE_ONLY=YES`, `MIGRATION_0020_DESTRUCTIVE_RISK=NONE`).
  - Nol audit retroaktif terbuat (`RETROACTIVE_CONTROL_AUDITS_CREATED=0`).
- **Deployment Worker Produksi:**
  - Worker `rancangloka` berhasil dideploy ke Cloudflare Edge dengan ID versi aktif baru: `d81db579-63f1-40c4-9345-328780f6f694` (deployment sebelumnya: `3404ac08-0e5f-4e11-8e11-2f93b7119a8f` tetap menjadi referensi rollback).
  - Rute publik tetap sehat: Homepage HTTP 200, artikel terbitan (slug: `rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman`) HTTP 200, dan sitemap XML HTTP 200.
- **Validasi Keamanan Endpoint Kontrol Kanonikal:**
  - Rute `POST /api/admin/publication/automation/control` terdeploy dan aktif.
  - Permintaan mutasi anonim ditolak dengan status 401 Unauthorized (`PROD_ANONYMOUS_OPERATOR_MUTATION=DENIED`).
  - Kredensial cron ditolak (`PROD_CRON_SECRET_OPERATOR_ACCESS=DENIED_BY_DESIGN`).
  - Tidak ada mutasi mode yang dieksekusi pada fase ini (`AUTHORIZED_OPERATOR_MODE_CHANGE_CALLS=0`).
- **Observabilitas Native Cron & Invarian Lifecycle:**
  - Heartbeat native Cron pasca-deploy terpantau aktif dan aman mencatat status `BLOCKED` (alasan: `AUTOMATION_MODE_OFF` untuk dispatcher, `AUTOMATION_MODE_BLOCKS_EXECUTION_OFF` untuk reconciler).
  - Nol siklus publikasi terjadi: `POST_DEPLOY_NEW_PLAN_COUNT=0`, `POST_DEPLOY_NEW_EXECUTION_COUNT=0`, `POST_DEPLOY_NEW_RECEIPT_COUNT=0`, `POST_DEPLOY_NEW_PUBLICATION_COUNT=0`.
  - Status artikel tetap konsisten (Draft: 5, Published: 1).
  - Mutasi raw SQL pada tabel kontrol tetap dilarang (`RAW_SQL_CONTROL_MUTATIONS=0`).
- **Status Akhir & Kesiapan:**
  - Status kontrol produksi tetap aman: `FINAL_AUTOMATION_MODE=OFF`, `FINAL_AUTO_SCHEDULE=false`, `FINAL_KILL_SWITCH=0`.
  - Fondasi kanonikal siap untuk uji round-trip terkontrol pertama `OFF → OBSERVE_ONLY → OFF` via API kanonikal pada Phase 5L12D (`READY_FOR_PHASE_5L12D=YES`).

### LokaMedia Phase 5L12B Canonical Automation Operator Control Foundation 2026-09-22

- **Tujuan & Ruang Lingkup:** Implementasi fondasi kontrol operator kanonikal terotentikasi dan teraudit secara lokal untuk perubahan mode otomasi global (`automation_control.mode`) dan jadwal otomatis (`settings.auto_schedule_enabled`), menutup celah ketergantungan pada direct SQL yang ditemukan pada Phase 5L12/5L12A.
- **Fondasi Skema Audit Terdedikasi:**
  - Menambahkan migrasi aditif `0020_automation_control_audit.sql` yang membuat tabel `automation_control_audit` dengan indeks performa untuk pencatatan riwayat kontrol-plane (`AUTOMATION_MODE_CHANGED`, `AUTO_SCHEDULE_CHANGED`) lengkap dengan `actor_id`, `actor_role`, `source`, `previous_value`, `new_value`, `reason`, `correlation_id`, `details_json`, dan timestamp.
- **Service Layer Kanonikal & Atomisitas Batch:**
  - Mengimplementasikan `changeAutomationMode` dan `changeAutoSchedule` pada `src/lib/safety/automation-controller.ts` dengan garansi eksekusi atomik batch via `db.batch([updateStmt, auditStmt])`.
  - Fail-closed: Jika penulisan audit gagal, mutasi mode dibatalkan sepenuhnya (`AUDIT_FAILURE_FAILS_CLOSED=PASS`).
  - Idempoten: Permintaan transisi identik (misal `OFF → OFF`) mengembalikan status `changed: false` tanpa memicu pencatatan audit redundan (`MODE_NOOP_TEST=PASS`).
  - Menjaga independensi flag: Perubahan mode tidak mengubah `auto_schedule_enabled`, `kill_switch_engaged`, `planner_paused`, atau `publisher_paused`.
- **Rute HTTP API Operator Terproteksi:**
  - Membuat endpoint kanonikal `POST /api/admin/publication/automation/control`.
  - Keamanan: Wajib sesi admin terotentikasi (`isValidAdminSession`), pertahanan CSRF lintas origin (`verifySameOrigin`), penolakan mutlak kredensial perangkat media (`MEDIA_DEVICE_FORBIDDEN: 403`), dan penolakan mutlak `CRON_SECRET` (`CRON_SECRET_FORBIDDEN: 403`).
  - Mendukung inspeksi status dan audit terkini via `GET /api/admin/publication/automation/control`.
  - Integrasi Observabilitas: Status kontrol dan 5 event audit terkini diintegrasikan ke dalam snapshot `getPublicationOperationsStatus`.
- **Verifikasi & Regresi:**
  - Menjalankan test suite baru `scripts/test-phase5l12b-canonical-operator-control.js` (15/15 PASS).
  - Seluruh 9 test suite regresi yang telah ada (Phase 5L2, 5L3, 5L4, 5L6, 5L6A, 5L9, 5L10, readiness, soak safety) lulus 100%.
  - Typecheck (`tsc --noEmit`), build Astro, dan dry-run Wrangler seluruhnya PASS.
- **Firewall Produksi & Langkah Selanjutnya:**
  - Produksi tetap berada pada mode aman `OFF`, `auto_schedule_enabled=false`, `kill_switch=0`. Nol mutasi pada D1/R2 produksi. Belum dideploy ke produksi.
  - Siap untuk fase deployment produksi migrasi 0020 dan kode kontrol kanonikal (`READY_FOR_CANONICAL_CONTROL_PRODUCTION_DEPLOYMENT=YES`).

### LokaMedia Phase 5L12A Production Control-Path Integrity Closure 2026-09-22

- **Tujuan & Ruang Lingkup:** Audit read-only terhadap integritas jalur kontrol produksi pasca Phase 5L12. Menyelidiki dan mengoreksi catatan historis mengenai mekanisme mutasi mode otomasi (`automation_control.mode`) dan status rekonsiliasi tabel audit (`publication_operator_audit`).
- **Temuan & Rekonsiliasi Jalur Kontrol:**
  - **Mekanisme Aktual Mutasi 5L12:** Transisi mode (`OFF → OBSERVE_ONLY` dan `OBSERVE_ONLY → OFF`) pada Phase 5L12 dilakukan melalui eksekusi remote SQL langsung ke tabel `automation_control`, bukan melalui rute HTTP operator API kanonikal (`ACTIVATION_MODE_CHANGE_ACTUAL_MECHANISM=DIRECT_SQL`, `RESTORE_MODE_CHANGE_ACTUAL_MECHANISM=DIRECT_SQL`).
  - **Status Audit Operator:** Tabel `publication_operator_audit` memiliki total 0 baris (`AUDIT_MISSING`). Hal ini karena skema `CHECK (event_type IN (...))` pada tabel tersebut hanya mendukung event manual hold, return to draft, toggle auto schedule, dan pembatalan plan, tanpa event untuk perubahan mode otomasi global.
  - **Ketersediaan Jalur Kanonikal:** Fungsi `setAutomationMode` ada di `src/lib/safety/automation-controller.ts`, namun belum memiliki rute HTTP API (`CANONICAL_AUTOMATION_MODE_HTTP_ROUTE=NONE`) dan belum mencatat ke `publication_operator_audit`.
- **Preservasi Hasil Keamanan Perilaku (Behavioral Safety):**
  - Seluruh bukti perilaku Phase 5L12 tetap valid dan terverifikasi secara independen (`PHASE_5L12_BEHAVIORAL_SAFETY_RESULT=PASS`):
    - Dispatcher `OBSERVE_ONLY` heartbeat tercatat aman (`BLOCKED`).
    - Reconciler `OBSERVE_ONLY` heartbeat tercatat aman (`BLOCKED`).
    - Mutasi rencana baru = 0, eksekusi baru = 0, publikasi baru = 0, tanda terima baru = 0.
    - Status artikel tidak berubah (Draft: 5, Published: 1).
- **Kebijakan & Kesiapan Phase 5L13:**
  - Kebijakan terkunci: Mutasi kontrol via raw SQL dilarang mulai Phase 5L13 (`PHASE_5L13_RAW_SQL_CONTROL_MUTATIONS_ALLOWED=NO`).
  - Kesiapan jalur kanonikal: `PLAN_ONLY_CANONICAL_ACTIVATION_PATH_READY=NO`, `PLAN_ONLY_CANONICAL_RETURN_PATH_READY=NO`.
  - Oleh karena itu, sebelum masuk Phase 5L13, jalur kontrol kanonikal (API/service + audit) harus disiapkan terlebih dahulu (`READY_FOR_PHASE_5L13=NO`).
- **Status Produksi Saat Ini:** `FINAL_AUTOMATION_MODE=OFF`, `FINAL_AUTO_SCHEDULE=false`, `FINAL_KILL_SWITCH=0`. Nol mutasi pada produksi selama Phase 5L12A.

### LokaMedia Phase 5L12 Production OBSERVE_ONLY Canary 2026-09-21

- **Tujuan & Ruang Lingkup:** Melakukan validasi canary pada kontrol state otomasi tingkat produksi (`automation_control.mode: OFF → OBSERVE_ONLY → OFF`) dengan otorisasi pengguna eksplisit. Membuktikan bahwa mode `OBSERVE_ONLY` mengeksekusi observasi telemetri terjadwal native Cloudflare Cron secara aman, memblokir seluruh tindakan eksekusi dan publikasi tanpa intervensi manusia (`canPlan=false`, `canSchedule=false`, `canPublish=false`), menghasilkan nol mutasi rencana/eksekusi/artikel, dan berhasil dikembalikan ke `mode=OFF`.
- **Verifikasi Pra-Canary & Gerbang Entri:**
  - **HEAD & Worktree:** `HEAD=30b27ff1dc9db33d988db6aa97d68e32bed763c3`, branch `lokamedia-phase-2ab-checkpoint`, worktree bersih.
  - **Worker & Skema:** Worker `rancangloka`, deployment `3404ac08-0e5f-4e11-8e11-2f93b7119a8f` (0 drift), skema D1 migrasi 0019 (0 drift).
  - **Kontrol Baseline:** `mode=OFF`, `auto_schedule_enabled=false`, `kill_switch=0`, rencana aktif=0, eksekusi aktif=0.
- **Transisi & Audit Operator (KOREKSI PHASE 5L12A):**
  - **Mekanisme Mutasi:** Dilakukan via remote SQL langsung pada tabel `automation_control` (bukan melalui endpoint HTTP operator API kanonikal).
  - **Audit Transisi 1 (OFF → OBSERVE_ONLY):** Kolom `updated_at` (`2026-09-21 16:45:27`) dan `updated_by` (`admin_operator`) diperbarui pada baris `automation_control (id=1)`. Baris di `publication_operator_audit` tidak ada (`OBSERVE_ONLY_ACTIVATION_AUDIT_ROW_EXISTS=NO`).
  - **Audit Transisi 2 (OBSERVE_ONLY → OFF):** Kolom `updated_at` (`2026-09-21 16:51:07`) dan `updated_by` (`admin_operator`) diperbarui pada baris `automation_control (id=1)`. Baris di `publication_operator_audit` tidak ada (`RETURN_TO_OFF_AUDIT_ROW_EXISTS=NO`).
- **Hasil Observasi Detak Native Cron Selama OBSERVE_ONLY:**
  - **Detak Dispatcher (`publication_dispatcher`):** Terbukti berjalan native via Cloudflare Cron (`trigger_source='cloudflare_cron'`) merekam `automation_mode='OBSERVE_ONLY'` dengan status `BLOCKED` (`error_summary='UNATTENDED_PUBLISH_BLOCKED'`). Contoh run: `crun_disp_9d9f4299465442bf`, `crun_disp_ee111d3c11a24641`.
  - **Detak Reconciler (`auto_execution_reconciler`):** Terbukti berjalan native via Cloudflare Cron (`trigger_source='cloudflare_cron'`) pada jadwal 5 menit merekam `automation_mode='OBSERVE_ONLY'` dengan status `BLOCKED` (`error_summary='AUTOMATION_MODE_BLOCKS_EXECUTION_OBSERVE_ONLY'`). Contoh run: `crun_rec_e4f5cc3b3a514dd6`.
  - **Detak Planner (`publication_planner`):** Status `NOT_YET_DUE` (siklus per jam).
- **Pembuktian Nol Mutasi Siklus Hidup:**
  - `NEW_PLAN_COUNT=0` (0 rencana publikasi baru).
  - `NEW_EXECUTION_COUNT=0` (0 eksekusi baru).
  - `NEW_PUBLICATION_COUNT=0` (0 artikel dipublikasikan).
  - `NEW_RECEIPT_COUNT=0` (0 tanda terima baru).
  - `ARTICLE_STATUS_COUNTS_UNCHANGED=YES` (Draft tetap 5, Published tetap 1).
  - `PRODUCTION_R2_WRITES=0`, `PRODUCTION_MEDIA_MUTATIONS=0`.
- **Kesehatan Sistem & Rute Publik:**
  - Status operasi dan integritas tanda terima: `PROD_OPERATIONS_STATUS_HEALTH=PASS`, `PROD_RECEIPT_INTEGRITY=PASS`.
  - Rute publik selama canary: Homepage (200 OK), Artikel id 6 (200 OK), Sitemap (200 OK).
- **Status Akhir Produksi:**
  - `FINAL_AUTOMATION_MODE=OFF`, `FINAL_AUTO_SCHEDULE_ENABLED=false`, `FINAL_KILL_SWITCH=0`.
  - `HIGHEST_AUTOMATION_MODE_REACHED=OBSERVE_ONLY`.
- **Hasil:** `PHASE_5L12=PASS`. Validasi canary OBSERVE_ONLY produksi sukses (`PRODUCTION_OBSERVE_ONLY_CANARY_VERIFIED=YES`). Siap untuk Phase 5L13 (`READY_FOR_PHASE_5L13=YES`).

### LokaMedia Phase 5L11C Production Native Cron Heartbeat Closure 2026-09-21

- **Tujuan & Ruang Lingkup:** Melakukan verifikasi observasi native Cron heartbeat di lingkungan produksi Cloudflare Worker (`rancangloka`) pasca-deployment Phase 5L11B tanpa mutasi kode, tanpa mutasi skema/konfigurasi, dan tanpa emulasi HTTP (`/__scheduled` / POST manual = 0). Membuktikan detak terjadwal native Cloudflare edge scheduler berjalan dan tercatat secara persisten pada tabel `publication_cron_runs` database D1 produksi (`rancangloka_db`).
- **Verifikasi Identitas & Gerbang Entri:**
  - **HEAD & Worktree:** `HEAD=dbb7458178eb808ad2a3f28371429773f34b7eed`, branch `lokamedia-phase-2ab-checkpoint`, worktree bersih (`CLEAN=YES`).
  - **Worker Aktif:** Terkonfirmasi versi `3404ac08-0e5f-4e11-8e11-2f93b7119a8f` (100% traffic aktif).
  - **Ledger Migrasi D1:** Migrasi 0019 (`0019_publication_cron_observability.sql`) tetap yang terbaru.
  - **Firewall Kontrol:** `mode='OFF'`, `kill_switch_engaged=0`, `settings.auto_schedule_enabled='false'`.
- **Hasil Observasi Detak Native Cron Produksi (Jendela Observasi Edge):**
  - **Detak Dispatcher (`publication_dispatcher`):** Terbukti berjalan native setiap 1 menit via Cloudflare Cron (`trigger_source='cloudflare_cron'`). Seluruh baris berstatus `BLOCKED` (`error_class='SAFETY_BLOCK'`, `error_summary='AUTOMATION_MODE_OFF'`) dengan `automation_mode='OFF'`.
  - **Detak Reconciler (`auto_execution_reconciler`):** Terbukti berjalan native setiap 5 menit via Cloudflare Cron (`trigger_source='cloudflare_cron'`). Seluruh baris berstatus `BLOCKED` (`error_class='SAFETY_BLOCK'`, `error_summary='AUTOMATION_MODE_BLOCKS_EXECUTION_OFF'`) dengan `automation_mode='OFF'`.
  - **Detak Planner (`publication_planner`):** Status `NOT_YET_DUE` (siklus 1 jam sekali pada menit :00).
  - **Keunikan Telemetri:** Seluruh `run_id` terbukti unik (duplikasi = 0).
- **Integritas Pipeline & Konten:**
  - **Mutasi Konten & Siklus Hidup:** Rencana baru = 0, eksekusi baru = 0, tanda terima publikasi baru = 0, publikasi baru = 0.
  - **Status Artikel:** Artikel draft tetap 5, artikel published tetap 1 (`rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman`, id: 6). Mutasi artikel = 0.
  - **Integritas Tanda Terima & Operasi:** `PROD_OPERATIONS_STATUS_HEALTH=PASS`, `PROD_RECEIPT_INTEGRITY=PASS`.
- **Kesehatan Endpoint Publik:**
  - Homepage (`https://rancangloka.com`): 200 OK (164,504 bytes).
  - Artikel Published (`https://rancangloka.com/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman`): 200 OK (159,807 bytes).
  - Sitemap Index & XML (`/sitemap.xml`, `/post-sitemap.xml`): 200 OK (XML valid).
- **Hasil:** `PHASE_5L11C=PASS`. Deployment produksi disabled terverifikasi penuh (`PRODUCTION_DISABLED_DEPLOYMENT_FULLY_VERIFIED=YES`). Siap untuk Phase 5L12 (`READY_FOR_PHASE_5L12=YES`). Mode otomasi tertinggi tetap `OFF`.

### LokaMedia Phase 5L11B Disabled Production Migration + Deployment 2026-09-21

- **Tujuan & Ruang Lingkup:** Menerapkan seluruh migrasi pending (0013–0019) ke database Cloudflare D1 produksi (`rancangloka_db`), mendeploy Cloudflare Worker (`rancangloka`) dengan pemicu native Cron triggers dalam mode nonaktif (`mode=OFF`, `auto_schedule_enabled=false`), memvalidasi kesehatan publik situs, serta membuktikan nol mutasi rencana/eksekusi/publikasi artikel.
- **Eksekusi & Hasil Gerbang Pra-Mutasi (Pre-Mutation Gates):**
  - **Identitas Target:** Terkonfirmasi Worker `rancangloka`, D1 `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`), R2 `rancangloka-media`.
  - **Deployment Eksisting:** Versi aktif sebelum deploy terkonfirmasi identik dengan referensi rollback `cef16b4b-a5f0-416c-9fff-1924aaee1ecc` (0 drift).
  - **Audit Migrasi 0013–0016:** Bersih, aditif, dan kompatibel mundur. Tidak ada operasi destruktif.
  - **Audit Migrasi 0017–0019:** Default aman terpasang (`manual_hold=0`, `scheduling_mode='legacy'`, `execution_mode='legacy'`, `auto_schedule_enabled='false'`).
  - **Backup D1 Remote:** Berhasil diekspor dan disimpan lokal sebagai cadangan sebelum mutasi skema.
  - **Regresi Pra-Mutasi:** Pengujian 5L10 (22/22 pass), 5L9 (13/13 pass), typecheck (`tsc --noEmit`), build (`astro build`), dan `wrangler deploy --dry-run` seluruhnya lulus 100%.
- **Eksekusi Mutasi Produksi (Production Mutations):**
  - **Migrasi D1 Remote:** `npx wrangler d1 migrations apply rancangloka_db --remote` berhasil menerapkan 7 migrasi (`0013` hingga `0019`). Ledger D1 remote berada pada ID 19 (`0019_publication_cron_observability.sql`).
  - **Status Kontrol Pasca-Migrasi:** `mode='OFF'`, `kill_switch_engaged=0`, `settings.auto_schedule_enabled='false'`.
  - **Worker Deployment:** `npx wrangler deploy` berhasil menerbitkan versi `3404ac08-0e5f-4e11-8e11-2f93b7119a8f` dengan pemicu jadwal native terpasang (`0 * * * *`, `*/5 * * * *`, `* * * * *`).
- **Verifikasi Pasca-Deployment (Post-Deployment Verification):**
  - **Kesehatan Situs Publik:** Homepage (`https://rancangloka.com` -> 200 OK, 164.5 KB) dan artikel published (`https://rancangloka.com/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman` -> 200 OK, 159.8 KB) sehat dan stabil.
  - **Keamanan Endpoint Operasi:** Anonymous access ditolak (401), media device ditolak (403).
  - **Integritas Konten & Pipeline:** Artikel draft tetap 5, artikel published tetap 1, rencana publikasi aktif tetap 0, eksekusi aktif tetap 0, tanda terima publikasi tetap 0. Tidak ada mutasi konten.
  - **Mode Otomasi:** `HIGHEST_AUTOMATION_MODE_REACHED` tetap `OFF`.
- **Hasil:** `PHASE_5L11B=PASS`. Versi produksi aktif: `3404ac08-0e5f-4e11-8e11-2f93b7119a8f`. Referensi rollback: `cef16b4b-a5f0-416c-9fff-1924aaee1ecc`.

### LokaMedia Phase 5L11A Production Readiness — Read-Only Gate 2026-09-21

- **Tujuan & Ruang Lingkup:** Melakukan audit read-only komprehensif pada lingkungan produksi Cloudflare Worker (`rancangloka`), database D1 produksi (`rancangloka_db`: `3a86e9ad-410f-4440-884e-2eb813ec4cf7`), dan R2 storage (`rancangloka-media`) sebelum eksekusi migrasi dan deployment dalam keadaan dinonaktifkan (disabled).
- **Temuan Audit Produksi (Read-Only):**
  - **Identitas Target:** Terkonfirmasi Worker `rancangloka`, entrypoint `src/worker.ts`, D1 binding `DB`, R2 binding `MEDIA_BUCKET`, dan 3 pemicu Cron native (`0 * * * *`, `*/5 * * * *`, `* * * * *`). Site target: `https://rancangloka.com`.
  - **Status Migrasi D1 Remote:** Database produksi berada pada migrasi `0012_articles_created_at.sql`. Terdapat 7 migrasi berurutan yang pending: `0013`, `0014`, `0015`, `0016`, `0017`, `0018`, dan `0019`. Seluruhnya aditif tanpa operasi destruktif (`DROP TABLE`/`DROP COLUMN` = 0).
  - **Status Kontrol Produksi:** `automation_control.mode = 'OFF'`, `kill_switch_engaged = 0`. Setelah migrasi 0017 diterapkan, `auto_schedule_enabled` akan defaulted ke `'false'`, `scheduling_mode` defaulted ke `'legacy'`, dan `manual_hold` defaulted ke `0`.
  - **Status Pipeline & Artikel Produksi:** D1 produksi saat ini memiliki 5 artikel draft dan 1 artikel published (`rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman`, id: 6). Rencana publikasi aktif = 0, eksekusi aktif = 0. Tidak ada backlog atau pekerjaan otomatis yang tertahan.
  - **Kesehatan Situs Produksi:** Endpoint publik `https://rancangloka.com` (200 OK) dan artikel published `https://rancangloka.com/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman` (200 OK) beroperasi normal.
  - **Dry-Run & Konfigurasi Secret:** `wrangler deploy --dry-run` PASS (bundle 4.3 MB). Secret admin dan media terpasang. `CRON_SECRET` belum ada di remote (tidak memblokir deployment karena Cron native tidak membutuhkan loopback HTTP; opsional untuk pemantauan HTTP eksternal).
  - **Versi & Rollback:** Deployment produksi aktif saat ini adalah `cef16b4b-a5f0-416c-9fff-1924aaee1ecc` (menjadi referensi rollback resmi).
  - **Urutan Eksekusi Phase 5L11B:** 1) Verifikasi referensi rollback -> 2) Terapkan migrasi 0013–0019 ke remote D1 -> 3) Verifikasi skema D1 remote -> 4) Pastikan mode tetap OFF -> 5) Deploy worker (`wrangler deploy`) -> 6) Verifikasi kesehatan situs & operasi status -> 7) Verifikasi detak awal cron berstatus `BLOCKED` dengan 0 mutasi.
- **Hasil:** `PHASE_5L11A=PASS`, `PRODUCTION_READINESS_CLASSIFICATION=READY_FOR_DISABLED_PRODUCTION_DEPLOYMENT`. Mutasi produksi: D1=0, R2=0, Deploy=0.

### LokaMedia Phase 5L10A Pre-Production Integrity + Observability Gap Closure 2026-09-21

- **Tujuan & Ruang Lingkup:** Verifikasi integritas komprehensif paska-5L10 sebelum melangkah ke tahap produksi. Memastikan tidak ada kehilangan dokumentasi dari checkpoint `97c450b`, memverifikasi integritas migrasi 0019 pada ledger Wrangler D1 lokal, memperluas cakupan uji deterministik untuk kegagalan finalisasi telemetri (`TELEMETRY_FINALIZE_FAILURE_DOES_NOT_ROLLBACK_BUSINESS_ACTION`), deteksi alert tugas tertahan (`STUCK_PLAN_ALERT_TEST`, `STALE_BINDING_ALERT_TEST`), status kesehatan saat mode `OFF` (`OFF_MODE_CRON_ALIVE_TEST`), serta integritas tanda terima Artikel 6 (`ARTICLE_6_RECEIPT_INTEGRITY`).
- **Penyempurnaan Telemetri & Status Operasi:**
  - `src/lib/publication/cron-telemetry.ts`: `completeCronRun` mengembalikan status sukses/error dan menyematkan `telemetry_finalize_error` pada objek hasil tanpa membatalkan tindakan publikasi kanonikal yang telah selesai.
  - `src/lib/publication/operations-status.ts`: Menambahkan `STUCK_PLAN_DETECTED` ke dalam `AlertType` dan menghasilkan alert kategori `WARNING` jika ada rencana `auto_policy` yang tidak terekonsiliasi setelah 15 menit dalam mode eksekusi.
- **Hasil Pengujian & Verifikasi:**
  - 22/22 uji lulus bersih pada `scripts/test-phase5l10-cron-observability.js`.
  - Seluruh regresi (Phase 5L9, 5L6A, 5L6, 5L4, 5L3, 5L2, readiness, soak safety) lulus 100%.
  - Typecheck (`tsc --noEmit`), build (`astro build`), dan `wrangler deploy --dry-run` lulus 100%.
  - Fixture Artikel 1, 3, 5, 6 beku 100% (0 mutasi). Kontrol lokal: `mode=OFF`, `auto_schedule_enabled=false`, `kill_switch=0`.
- **Hasil:** `PHASE_5L10A=PASS`, `READY_FOR_PHASE_5L11=YES`.

### LokaMedia Phase 5L10 Durable Cron Heartbeat + Operations Observability 2026-09-21

- **Tujuan & Masalah:** Mengatasi celah observabilitas operasional (gap ketiadaan detak run-summary pada auto-execution reconciler dan belum adanya dashboard terpadu pengawasan operasi) dengan mengimplementasikan lapisan detak Cron append-only persisten, layanan status operasi kanonikal read-only, deteksi tugas tersangkut (stuck work), mesin peringatan turunan (derived alert engine) ber-sinyal tinggi, API terotentikasi, serta antarmuka visual minimal untuk pengawasan operator.
- **Model Data Telemetri & Migrasi (`0019_publication_cron_observability.sql`):**
  - Membuat tabel `publication_cron_runs` dengan kolom: `run_id` (`crun_<job>_<hex>`), `job_name`, `trigger_source`, `started_at`, `finished_at`, `status`, `automation_mode`, `kill_switch_engaged`, `processed_count`, `created_count`, `blocked_count`, `failed_count`, `error_class`, `error_summary`, `details_json`, `created_at`.
  - Indeks teroptimasi: `idx_cron_runs_job_created`, `idx_cron_runs_status_created`, `idx_cron_runs_created`.
  - Migrasi lokal diterapkan secara aman ke database D1 lokal Miniflare SQLite (`0019` tercatat pada `d1_migrations` ID 18).
- **Semantik Detak & Kebijakan Kegagalan Telemetri (`src/lib/publication/cron-telemetry.ts`):**
  - Kebijakan `FAIL_CLOSED_ON_START_SAFE_SURFACE_ON_FINALIZE`: Kegagalan penulisan detak `STARTED` menghentikan eksekusi sebelum mutasi bisnis terjadi (fail-closed); kegagalan finalisasi setelah aksi berhasil dicatat sebagai error tanpa membatalkan publikasi yang sah.
  - Klasifikasi keamanan: Mode `OFF`, kill switch aktif, dan jeda operator dicatat sebagai `BLOCKED`, bukan runtime failure.
  - Firewall rahasia: Fungsi `sanitizeErrorSummary` membersihkan token bearer, token media, kata sandi, dan header otorisasi.
- **Integrasi Pemicu Native Cloudflare Cron (`src/lib/publication/cron-router.ts`):**
  - Membungkus eksekusi `publication_planner`, `auto_execution_reconciler`, dan `publication_dispatcher` dalam `runWithCronTelemetry`.
  - Menetapkan atribusi pemicu yang tepat (`cloudflare_cron`, `admin_http`, `service_http`, `test`).
- **Layanan Status Operasi Kanonikal (`src/lib/publication/operations-status.ts`):**
  - Fungsi read-only `getPublicationOperationsStatus(db, now?)` mengumpulkan:
    1. Snapshot kontrol sistem (`mode`, `auto_schedule_enabled`, `kill_switch_engaged`, `circuit_breakers`).
    2. Penghitung pipeline (`eligible_auto_policy_drafts`, `active_planned_count`, `scheduled_count`, `claimed_count`, `publishing_count`, `retry_wait_count`, `failed_count`, `manual_hold_count`, `published_24h_count`).
    3. Ringkasan detak Cron dengan ambang batas keusangan deterministik (Planner: 9000 dtk; Reconciler: 900 dtk; Dispatcher: 180 dtk).
    4. Deteksi tugas macet (`stuck_executions`, `stuck_plans`).
    5. Kegagalan terminal dan deteksi pergeseran hash (`stale_bindings`).
    6. Pemantau integritas tanda terima rilis (`missing_receipts`, `duplicate_receipts`, `hash_mismatches`).
    7. Mesin alert turunan (`CRON_HEARTBEAT_MISSING`, `EXECUTION_LEASE_EXPIRED`, `TERMINAL_PUBLICATION_FAILURE`, `STALE_BINDING_BLOCKED`, `RECEIPT_INTEGRITY_ERROR`, `KILL_SWITCH_ACTIVE`).
  - Pengendalian kebisingan: Kondisi normal seperti mode `OFF` atau `manual_hold` tidak memicu alert kritis (`ALERT_NOISE_CONTROL=PASS`).
- **API Status Operasi & Dashboard Admin:**
  - Endpoint `GET /api/admin/publication/operations/status` dengan firewall autentikasi admin ketat (anonim: 401, token media: 403, sesi admin: 200).
  - Halaman dashboard read-only di `/admin/publication/operations` (`src/pages/admin/publication/operations.astro`) menyajikan 5 kartu pengawasan tanpa kewenangan mutasi (`OPS_DASHBOARD_MUTATION_AUTHORITY=NONE`).
- **Pengujian & Validasi:**
  - 17/17 uji fokus di `scripts/test-phase5l10-cron-observability.js` lulus 100%.
  - Seluruh regresi (Phase 5L9, 5L6A, 5L6, 5L4, 5L3, 5L2, readiness, soak safety) lulus 100%.
  - Typecheck (`tsc --noEmit`), build (`astro build`), dan `wrangler deploy --dry-run` lulus bersih tanpa error.
  - Fixture Artikel 1, 3, 5, 6 beku 100%. Kontrol lokal tetap aman: `mode=OFF`, `auto_schedule_enabled=false`, `kill_switch=0`.
- **Hasil:** `PHASE_5L10=PASS`, `CRON_RUN_HISTORY_DURABLE=YES`, `READY_FOR_PRODUCTION_DEPLOYMENT_READINESS_PHASE=YES`.

### LokaMedia Phase 5L9 Cloudflare Cron Wiring + Server Trigger Auth Foundation 2026-09-21

- **Tujuan & Ruang Lingkup:** Mengimplementasikan perutean native Cloudflare Worker scheduled cron event langsung ke layanan kanonikal tanpa loopback HTTP (`CRON_USES_SELF_HTTP_FETCH=NO`), serta menyediakan autentikasi rahasia berbasis header (`CRON_SECRET`) untuk trigger endpoints tanpa melemahkan autentikasi admin sesi maupun CSRF browser.
- **Arsitektur Worker Wrapper (`src/worker.ts`):**
  - Mengonfigurasi entrypoint sumber `src/worker.ts` di `wrangler.toml` (`main = "src/worker.ts"`).
  - Mendelegasikan `fetch(request, env, ctx)` ke virtual entrypoint runtime Astro SSR (`dist/_worker.js/index.js`).
  - Menghubungkan `scheduled(event, env, ctx)` ke perute kanonikal `src/lib/publication/cron-router.ts`.
- **Perutean Cron Deterministik (`src/lib/publication/cron-router.ts`):**
  - Mendefinisikan identitas tugas internal eksplisit: `publication_planner` (`0 * * * *`), `auto_execution_reconciler` (`*/5 * * * *`), `publication_dispatcher` (`* * * * *`).
  - Memanggil langsung layanan kanonikal: `executePublicationPlanner` (dengan profile kanonikal `GROWING` dan timezone `Asia/Jakarta`), `reconcileAutoPolicyPlansForExecution` (batch limit 10), `runPublisherDispatcher` (`triggerSource: 'cron'`).
  - Model keamanan & isolasi kesalahan: Mematuhi matrix kapabilitas mode otomasi, emergency kill switch, dan pause control secara fail-closed. Kesalahan pada satu tugas terisolasi penuh dan tidak melakukan cascade ke tugas lainnya (`CRON_JOB_FAILURE_ISOLATION=YES`).
  - Manajemen masa hidup: Menggunakan `ctx.waitUntil` untuk pelacakan promise asinkron Cloudflare.
- **Autentikasi Server Trigger (`CRON_SECRET`):**
  - Mendukung `Authorization: Bearer <CRON_SECRET>` dan `X-RancangLoka-Cron-Secret` dengan perbandingan constant-time (`timingSafeEqual`).
  - Mengizinkan panggilan non-browser yang terotentikasi rahasia pada endpoint `/api/admin/publication/plans`, `/publish/reconcile`, dan `/publish/due` untuk melewati pemeriksaan CSRF browser secara aman (`SERVICE_AUTH_BYPASSES_BROWSER_CSRF_SAFELY=YES`), sementara sesi browser admin tetap wajib lolos validasi CSRF origin.
  - Firewall kredensial media: Token media (`lkmd_` atau `media:device`) diblokir mutlak dengan HTTP 403.
  - Pencegahan kebocoran: Nilai `CRON_SECRET` tidak pernah di-log, di-commit, atau dikembalikan dalam response payload.
- **Konfigurasi Sumber Cloudflare Triggers (`wrangler.toml`):**
  - Menambahkan konfigurasi trigger cron tingkat sumber: `0 * * * *`, `*/5 * * * *`, `* * * * *`.
  - Otomasi produksi tetap nonaktif (`mode=OFF`, `auto_schedule_enabled=false`, `kill_switch_engaged=0`).
- **Pengujian & Validasi:**
  - 13/13 pengujian fokus di `scripts/test-phase5l9-cron-wiring.js` lulus 100%.
  - Seluruh regresi kritis (Phase 5L6A, 5L6, 5L4, 5L3, 5L2, readiness, soak safety) lulus 100%.
  - Fixture Artikel 6 (`phase5l7-hands-off-publish-fixture`) 100% beku tanpa mutasi.
- **Hasil:** `PHASE_5L9=PASS`, `CRON_USES_SELF_HTTP_FETCH=NO`, `READY_FOR_OBSERVABILITY_HARDENING=YES`.

### LokaMedia Phase 5L8 Hands-Off Production Hardening Audit 2026-09-21

- **Tujuan & Masalah:** Audit kesiapan produksi hands-off read-only pasca keberhasilan Phase 5L7, memverifikasi tidak adanya cron otomatis aktif yang terpasang di tingkat worker runtime, memetakan rantai pemicu kanonikal, dan merumuskan arsitektur pemicu Cloudflare terjadwal native.
- **Temuan Kunci:**
  - Pemicu cron otomatis saat ini belum terhubung di runtime worker (`FULL_CRON_CHAIN_CURRENTLY_WIRED=NO`).
  - Keputusan arsitektur: Memilih pemanggilan layanan internal kanonikal secara langsung (`scheduled` -> services) daripada loopback HTTP self-fetch.
  - Tangga aktivasi produksi: Membutuhkan pembungkusan entrypoint worker, autentikasi server trigger, instrumen observabilitas (heartbeat & health checks), sebelum aktivasi mode otomasi.
- **Hasil:** `PHASE_5L8=PASS`.

### LokaMedia Phase 5L7 True Hands-Off Local End-to-End Publication 2026-09-21

- **Tujuan & Masalah:** Membuktikan alur kerja publikasi hands-off penuh tanpa intervensi manusia sama sekali: sistem kebijakan lolos -> perencana otomatis membuat plan auto-policy -> rekonsiliator menjadwalkan eksekusi -> dispatcher menerbitkan artikel -> tanda terima kriptografis immutable terbentuk -> rute publik dapat diakses.
- **Hasil Eksekusi Fixture Artikel 6 (`phase5l7-hands-off-publish-fixture`):**
  - Status artikel: `published`.
  - Jumlah persetujuan manusia: 0 (`approval count = 0`).
  - Mode perencanaan: `auto_policy` (`plan_id = 'plan_85c9952fb146a92c'`).
  - Mode eksekusi: `auto_schedule` (`execution_id = 'pexec_161b85cb6789f2bd'`), status `PUBLISHED`.
  - Tanda terima: `rcpt_6c247016b4ac6ee0`.
  - Rute publik artikel dan gambar terverifikasi menyajikan konten nyata.
  - Artikel 6 ditetapkan sebagai frozen golden fixture.
- **Hasil:** `PHASE_5L7=PASS`, `TRUE_HANDS_OFF_PUBLICATION_PROVEN=YES`.

### LokaMedia Phase 5L6A Auto-Policy Plan -> Execution Reconciler 2026-09-21

- **Tujuan & Masalah:** Mengimplementasikan layanan rekonsiliasi kanonikal server-side (`src/lib/publication/auto-policy-reconciler.ts`) yang menjembatani rencana auto-policy berstatus `PLANNED` menjadi eksekusi `SCHEDULED` secara berkala tanpa campur tangan manusia dan tanpa melakukan publikasi prematur.
- **Hasil:** `PHASE_5L6A=PASS`.

### LokaMedia Phase 5L6 Publisher Dual Authorization Foundation 2026-09-21

- **Tujuan & Masalah:** Mengimplementasikan fondasi dual authorization pada lapisan publisher server-side, mendukung dua mode otorisasi publikasi tanpa celah bypass:
  1. `editorial_signoff`: Membutuhkan persetujuan manusia (`article_editorial_approvals.approval_status = 'APPROVED'`) yang terikat valid pada `content_hash` terkini dan aset featured media aktif, serta status readiness `READY_TO_SCHEDULE`.
  2. `auto_policy`: TIDAK memerlukan persetujuan manusia. Wajib terikat secara deterministik pada plan auto-policy yang valid (`article_publication_plans.scheduling_mode = 'auto_policy'`), binding identitas (`article_id`, `content_hash`, `featured_asset_id`), provenance snapshot kebijakan sistem yang valid (`system_policy_pass = true`), re-evaluasi kebijakan mutu deterministik terkini secara live di execution time, `manual_hold = 0`, `kill_switch_engaged = 0`, dan kapabilitas mode otomasi server-side (`CONTROLLED` untuk penjadwalan, `UNATTENDED` untuk publikasi).
- **Resolver Otorisasi Kanonikal (`src/lib/publication/authorization-resolver.ts`):**
  - Menerapkan fungsi tunggal `resolvePublicationAuthorization(db, params)` untuk tahap `schedule` dan `prepublish`.
  - Strict plan-mode routing: Rencana `editorial_signoff` hanya memvalidasi jalur persetujuan manusia; rencana `auto_policy` hanya memvalidasi jalur kebijakan sistem tanpa fallback silang (`PLAN_MODE_AUTHORIZATION_STRICT=YES`).
  - Rencana berstatus `legacy` dipertahankan wajib persetujuan manusia (`LEGACY_PLAN_AUTO_POLICY_ALLOWED=NO`).
- **Integrasi Publisher Service (`src/lib/publication/publisher-service.ts`):**
  - `schedulePlanForExecution`: Memvalidasi otorisasi via resolver kanonikal dan menyematkan atribusi mode eksekusi secara otomatis: `auto_schedule` untuk auto-policy, `scheduled_publish` untuk editorial terencana, `manual_publish` untuk Publish Now.
  - `validatePrepublishInvariants`: Melakukan double-gate re-evaluasi kanonikal terhadap konten, media, dan kebijakan sebelum mutasi rilis publikasi dilakukan.
  - `executeAtomicPublication`: Memperkuat guard mutasi rilis publikasi dengan verifikasi atomik `content_hash` dan subquery pengecekan aset aktif featured media (`FEATURED_ASSET_RACE_FAILS_CLOSED=YES`), mencegah race condition konten maupun pergantian media concurrent.
  - `publishNow`: Dibatasi secara mutlak khusus jalur editorial manusia (`PUBLISH_NOW_WITHOUT_HUMAN_APPROVAL_ALLOWED=NO`). Tombol Publish Now dilarang digunakan untuk bypass rilis auto-policy.
  - Zero Approval Pollution: Otorisasi dan eksekusi auto-policy menghasilkan 0 baris persetujuan editorial (`AUTO_POLICY_APPROVAL_MUTATIONS=0`).
- **Pengujian & Validasi:**
  - 23/23 uji fokus di `scripts/test-phase5l6-dual-authorization.js` lulus.
  - Seluruh regresi kritis (Phase 5L4, 5L3, 5L2, readiness, soak safety) lulus 100%.
  - Status beku lokal terjaga: Artikel 1 (`draft`), Artikel 3 (`draft`, `APPROVED`, 0 plan, 0 eksekusi), Artikel 5 (`draft`, `manual_hold = 1`, plan `CANCELLED`), `auto_schedule_enabled = false`, `kill_switch_engaged = 0`.
- **Hasil:** `PHASE_5L6=PASS`, `READY_FOR_CONTROLLED_AUTO_PUBLICATION_TEST=YES`.

### LokaMedia Phase 5L5 Controlled Local Auto-Policy Plan Creation 2026-09-21

- **Tujuan & Masalah:** Membuktikan alur kerja auto-policy planner dari nol tanpa persetujuan manusia secara lokal pada fixture terkontrol, kemudian mengembalikan status sistem ke kondisi aman.
- **Solusi & Eksekusi:**
  - Menyiapkan fixture terkontrol Artikel 5 (`lokamedia-publication-quality-fixture-auto-5`) yang memenuhi seluruh syarat kebijakan deterministik tanpa baris persetujuan manusia (`approval_count = 0`).
  - Mengaktifkan `settings.auto_schedule_enabled = 'true'` dan `automation_control.mode = 'CONTROLLED'` secara lokal sementara.
  - Menjalankan `createPublicationPlansForReadyArticles`: Candidate selector memilih Artikel 5 dengan `candidate_source = 'auto_policy'`, menerbitkan tepat satu baris `article_publication_plans` (`scheduling_mode = 'auto_policy'`).
  - Menguji fungsi rollback operator `returnToDraftAndHold`: Membatalkan plan (`plan_status = 'CANCELLED'`), memasang `manual_hold = 1`, mengembalikan `auto_schedule_enabled = 'false'`, dan memastikan 0 eksekusi serta 0 publikasi terbentuk.
- **Hasil:** `PHASE_5L5=PASS`, bukti lokal auto-policy planning berhasil tanpa efek samping ke Artikel 1 atau 3.

### LokaMedia Phase 5L4 / 5L4A Admin Override, Manual Hold & D1 Ledger Integrity 2026-09-21

- **Tujuan & Masalah:** Memberikan kontrol darurat manual kepada operator (Manual Hold, Return to Draft & Hold, Global Auto-Schedule Toggle) dan memastikan integritas ledger migrasi D1 Cloudflare.
- **Solusi:**
  - Migrasi `0018_publication_operator_audit.sql`: Menambahkan kolom `manual_hold`, `manual_hold_reason`, `manual_hold_at`, `manual_hold_by` pada tabel `articles` serta tabel audit `publication_operator_audit`.
  - Layanan operator di `src/lib/publication/operator-controls.ts`: `engageManualHold`, `releaseManualHold`, `returnToDraftAndHold`, `setGlobalAutoSchedule`.
  - Double-gate check pada publisher menolak artikel jika `manual_hold = 1`.
  - Verifikasi ledger migrasi D1 lokal Miniflare: Memastikan migrasi 0017 dan 0018 tercatat secara resmi di tabel `d1_migrations`.
- **Hasil:** `PHASE_5L4=PASS`, `PHASE_5L4A=PASS`.

### LokaMedia Phase 5L3 Auto-Planner Candidate Integration 2026-09-21

- **Tujuan:** Mengintegrasikan seleksi kandidat ganda (`editorial_signoff` vs `auto_policy`) pada layanan planner publikasi (`src/lib/publication/planner-service.ts`).
- **Solusi:**
  - Menambahkan prioritas deterministik: Jika sebuah artikel memenuhi kedua syarat, kandidat editorial signoff diutamakan.
  - Memvalidasi prasyarat auto-policy: `auto_schedule_enabled = 'true'`, `manual_hold = 0`, `kill_switch_engaged = 0`, dan mode automasi mengizinkan perencanaan (`PLAN_ONLY`, `CONTROLLED`, `UNATTENDED`).
  - Menyimpan snapshot provenance kebijakan pada rencana publikasi (`scheduling_mode = 'auto_policy'`).
- **Hasil:** `PHASE_5L3=PASS`.

### LokaMedia Phase 5L2 System Publication Policy Foundation 2026-09-21

- **Tujuan:** Memisahkan evaluasi kebijakan kualitas otomatis (`system_policy_pass`) dari persetujuan manusia (`human_approval_pass`).
- **Solusi:**
  - Memperbarui evaluator kesiapan publikasi (`src/lib/publication/service.ts`) untuk mengevaluasi `system_policy_pass` secara independen dari `human_approval_pass`.
  - Migrasi `0017_publication_auto_schedule.sql`: Menambahkan `scheduling_mode` pada `article_publication_plans` dan `execution_mode` pada `article_publication_executions`.
  - Menetapkan nilai default sistem `auto_schedule_enabled = 'false'` untuk keamanan.
- **Hasil:** `PHASE_5L2=PASS`.

### LokaMedia Phase 5K3E2 - 5K3H Article 3 End-to-End Approval & Readiness Verification 2026-09-21

- **Phase 5K3E2 (Featured Media Attachment):** Mengaitkan aset terdaftar `ast_748c29fa012aa3d6eec531fa` sebagai media featured aktif Artikel 3 (`role = 'featured'`, `is_active = 1`).
- **Phase 5K3F (Readiness Reconciliation):** Merekonsiliasi status kesiapan Artikel 3 dari `BLOCKED` menjadi `READY_FOR_REVIEW`.
- **Phase 5K3G (Human Editorial Approval):** Editor manusia memeriksa dan menyetujui Artikel 3 secara manual di halaman preview admin (`/admin/preview/lokamedia-publication-quality-fixture`) menghasilkan status `APPROVED`.
- **Phase 5K3H (Pre-Publication Readiness Audit):** Audit read-only memastikan Artikel 3 berstatus `READY_TO_SCHEDULE` dengan 0 rencana publikasi dan 0 eksekusi terdaftar.
- **Hasil:** `ARTICLE_3_STATE=READY_TO_SCHEDULE`.

### LokaMedia Phase 5K3E1 Article 3 Media Asset Registration Execution 2026-09-21

- Successfully registered the canonical Article 3 watermarked R2 derivative into `media_assets` using metadata and provenance only.
- Invariants strictly preserved:
  - ZERO binary retransmissions, ZERO R2 PUT calls (`R2_PUT_CALLS=0`, `BINARY_TRANSFER_CALLS=0`).
  - ZERO watermark transforms (`WATERMARK_TRANSFORM_CALLS=0`), ZERO provider calls (`PROVIDER_GENERATE_CALLS=0`, `CHATGPT_SUBMISSIONS=0`, `PROVIDER_CAPTURE_CALLS=0`).
  - ZERO `article_media` attachments created (`ARTICLE_3_ARTICLE_MEDIA_COUNT=0`, deferred to Phase 5K3E2).
  - ZERO readiness mutations (`READINESS_MUTATIONS=0`, read-only evaluation confirmed blockers `FEATURED_MEDIA_MISSING`, `APPROVAL_MISSING`).
  - ZERO approval, schedule, or publication mutations (`APPROVAL_MUTATIONS=0`, `ARTICLE_3_STATUS='draft'`).
  - ZERO mutations to Article 1 golden fixture (`ARTICLE_1_STATUS='draft'`, `APPROVAL_STATUS='APPROVED'`, asset `ast_d230f3d834ae5f1a9f689d7c` 100% unchanged).
- Verified durable upload receipt in IndexedDB `media-uploads`: `upl_0cde1e3e232210210678297ef7d14f4cc93a1d8669f9426019b78cc8d33193aa`, state `UPLOADED`.
- Verified local Miniflare R2 object metadata: key `media/articles/derivatives/c47f0221350c417c11f2f07664be0d90cee2b62e5082645121eb3e075ebbb01b.png`, size `3725697` bytes, MIME `image/png`, SHA-256 `c47f0221350c417c11f2f07664be0d90cee2b62e5082645121eb3e075ebbb01b`.
- Invoked canonical internal endpoint `POST /api/internal/v1/media/assets/register` with device authentication (`Bearer lkmd_controlled_phase5k3e1_device`, scope `media:device`).
- Deterministic asset identity verified: `ast_748c29fa012aa3d6eec531fa` (`ast_${sha256(role:sha256:r2_key).substring(0, 24)}`). Differs strictly from Article 1 (`ast_d230f3d834ae5f1a9f689d7c`).
- First clean registration inserted exactly one row into `media_assets` (`status: 'VALIDATED'`, `role: 'ARTICLE_PUBLIC_DERIVATIVE'`, `dimensions: 1672x941`, `byte_size: 3725697`, full provenance JSON).
- Audit event recorded in `media_asset_audit` (`action: 'REGISTER'`, safe metadata JSON).
- Idempotency verified: second invocation returned existing asset (`reused_existing: true`, 0 second inserts, `ARTICLE_3_MEDIA_ASSET_COUNT_AFTER_SECOND=1`).
- Post-reopen discovery verified against local Miniflare D1 SQLite.
- Regressions, typecheck (`tsc --noEmit`), and build (`npm run build`) all pass cleanly.
- Result: `PHASE_5K3E1=PASS`, `MEDIA_ASSET_REGISTRATION_LANE_CLOSED=YES`, `READY_FOR_ARTICLE_3_FEATURED_ATTACHMENT=YES`.

### LokaMedia Phase 5K3D Article 3 Durable Watermarked Derivative Upload 2026-09-21

- Successfully uploaded the canonical Article 3 watermarked derivative (`der_1cbb6f8b677815c4623d73245b9b60daebf729c5c03b0dea684b8297acc2dcd0`, 3725697 bytes, SHA-256 `c47f0221350c417c11f2f07664be0d90cee2b62e5082645121eb3e075ebbb01b`) to local Miniflare R2 bucket (`rancangloka-media`).
- Destination R2 key: `media/articles/derivatives/c47f0221350c417c11f2f07664be0d90cee2b62e5082645121eb3e075ebbb01b.png`.
- Durable upload receipt persisted in IndexedDB `media-uploads`: `upl_0cde1e3e232210210678297ef7d14f4cc93a1d8669f9426019b78cc8d33193aa` (`state: 'UPLOADED'`).
- Physical blob verified in `.wrangler/state/v3/r2/` (exact 3725697 bytes, SHA-256 matched).
- Result: `PHASE_5K3D=PASS`, `READY_FOR_MEDIA_ASSET_REGISTRATION=YES`.

### LokaMedia Phase 5K3C Article 3 Deterministic Watermark Derivative 2026-09-21

- Successfully produced exactly one deterministic watermark derivative from the immutable full-res Article 3 original.
- Input original: `mjob_34d4ad896ffba960eb77666e:1` (1672x941 PNG, 2655415 bytes, SHA `2cdaa0c03b6a85d959aa776e0fcebb51ff3740ad97ea2f7cff264f7081f0958b`).
- Transform ID: `038276c347d0bfd74c09a92d591f2db0454e25f221e70461bb47ac8d1fa4e148`.
- Resulting derivative: `der_1cbb6f8b677815c4623d73245b9b60daebf729c5c03b0dea684b8297acc2dcd0` (1672x941 PNG, 3725697 bytes, SHA-256 `c47f0221350c417c11f2f07664be0d90cee2b62e5082645121eb3e075ebbb01b`).
- Persisted durably in IndexedDB `media-derivatives` with role `PUBLIC_DERIVATIVE_CANDIDATE`.
- Result: `PHASE_5K3C=PASS`, `READY_FOR_UPLOAD_QUEUE=YES`.

### LokaMedia Phase 5K3B-R2 Full-Res ChatGPT Capture Adapter Repair 2026-09-21

- Diagnosed and repaired full-resolution image capture in LokaMedia extension.
- Root cause: previous capture adapter relied on DOM rendered CSS bounding box (461x259) rather than acquiring full natural resolution (1672x941) binary.
- Checkpoint commit: `795a4283528dfa2ae9d5239c933a7c320bb80a55` (`fix: preserve full resolution provider image capture`).
- Hardened capture pipeline: prefers full provider binary via authenticated fetch / natural dimensions, verified with 6 deterministic test cases in `scripts/test-lokamedia-phase5k3b-r2-fullres-capture.js`.
- Authoritative original recovered: `mjob_34d4ad896ffba960eb77666e:1` (1672x941 PNG, 2655415 bytes, SHA `2cdaa0c03b6a85d959aa776e0fcebb51ff3740ad97ea2f7cff264f7081f0958b`).
- Result: `PHASE_5K3B_R2=PASS`, `FULL_RES_CAPTURE_ADAPTER_REPAIRED=YES`.

### LokaMedia Phase 5K3A - 5K3B Article 3 Featured Media Job & Provider Generation 2026-09-20

- Created durable featured media job: `job_id: 'mjob_34d4ad896ffba960eb77666e'`, `slot_key: 'featured'`, `article_id: 3`.
- Executed controlled single ChatGPT generation run without duplicate submissions.
- Result: `PHASE_5K3A=PASS`, `PHASE_5K3B=PASS`.

### LokaMedia Phase 5K1 - 5K2 Publication-Quality Article Fixture Foundation 2026-09-20

- Audited publication content gate requirements (monetary zero-tolerance, H2 structure, >=300 words, >=3 takeaways, canonical author & category).
- Ingested publication-quality controlled article fixture: `article_id: 3`, `slug: 'lokamedia-publication-quality-fixture'`, `status: 'draft'`, `image_alt: 'LokaMedia Publication Quality Fixture'`.
- Article 1 frozen as golden fixture (`article_id: 1`, `status: 'draft'`, `approval: 'APPROVED'`).
- Result: `PHASE_5K1=PASS`, `PHASE_5K2=PASS`.

### LokaMedia Phase 5H2 Controlled Article Media Attachment Execution 2026-09-20

- Successfully executed controlled canonical attachment of registered media asset `ast_d230f3d834ae5f1a9f689d7c` to controlled article fixture `article_id: 1`, `slot_key: 'featured'`.
- Invoked canonical internal endpoint: `POST /api/internal/v1/media/article-media/attach` with device authentication (`Bearer lkmd_controlled_phase5h2_device`, scope `media:attach`).
- First clean attachment created exactly one active relation in `article_media` (`id: 1`, `article_id: 1`, `slot_key: 'featured'`, `asset_id: 'ast_d230f3d834ae5f1a9f689d7c'`, `role: 'featured'`, `is_active: 1`, `sort_order: 0`, `reused_existing: false`).
- Single-active-slot constraint verified: `idx_article_media_one_active_slot` ensures exactly one active asset per `(article_id, slot_key)`.
- Idempotency verified: second invocation with identical payload returned existing attachment (`id: 1`, `reused_existing: true`, 0 second inserts).
- Lost-response retry recovery and restart/reopen readback verified independently against Miniflare D1 SQLite.
- Safe audit event recorded in `media_asset_audit` (`action: 'ATTACH'`, safe metadata JSON, zero binary).
- Absolute safety boundaries verified:
  - Article status remained strictly `draft` (`ARTICLE_STATUS_MUTATIONS=0`).
  - Article readiness remained strictly `NONE` (`ARTICLE_READINESS_MUTATIONS=0`, readiness transition deferred to Phase 5I).
  - Article `updated_at` remained strictly unchanged (`2026-09-16T05:09:07.518Z`).
  - Registered media asset `ast_d230f3d834ae5f1a9f689d7c` in `media_assets` remained untouched (`status: VALIDATED`, 0 mutations).
  - Canonical R2 object at `media/articles/derivatives/458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff.png` remained unchanged (`R2_PUT_CALLS=0`, `R2_DELETE_CALLS=0`).
  - Extension IndexedDB original, derivative, and upload receipt remained 100% intact.
  - Zero binary transfer, zero image processing, zero publication mutations, zero production mutations.
- Result: `PHASE_5H2=PASS`, `ARTICLE_MEDIA_ATTACHMENT_LANE_CLOSED=YES`, `READY_FOR_READINESS_RECONCILIATION=YES`.

### LokaMedia Phase 5H1 Article Media Attachment Foundation 2026-09-20

- Built decoupled article media attachment service and dedicated internal device-authenticated endpoint.
- Checkpoint commit: `182726593d11cc7971ad759190eaf18901bca753` (`feat: add article media attachment`).
- Service implementation: `src/lib/media/article-media.ts` (`attachArticleMedia`, `resolveEditorialRole`, `assertValidSlotKey`).
  - Enforced editorial slot identity: `(article_id, slot_key)`.
  - Enforced attachability guards: article existence in `articles` (404), media asset existence & `VALIDATED` status in `media_assets` (404/422).
  - Enforced role compatibility: permits `ARTICLE_PUBLIC_DERIVATIVE`, strictly bars site-level `WATERMARK_MASTER` (422).
  - Enforced slot regex validation: `/^[a-z][a-z0-9_]{1,63}$/` (400).
  - Enforced provenance compatibility: generated asset bound to `article_id`/`slot_key` cannot be attached to a different article or slot (422).
  - Enforced active slot cardinality (`ONE_ACTIVE_ASSET_PER_SLOT` via `idx_article_media_one_active_slot`).
  - Enforced replacement policy: `FAIL_CLOSED_REPLACEMENT_REQUIRED` (409 `SLOT_OCCUPIED_CONFLICT` if different asset attempts to occupy active slot).
  - Idempotent duplicate reuse (`reused_existing: true`).
  - Safe audit trail logged to `media_asset_audit` (`action: 'ATTACH'`).
- Internal API endpoint: `src/pages/api/internal/v1/media/article-media/attach.ts`.
  - Least-privilege device authentication (`media:attach`, `media:upload`, `media:device`, `media:write:draft`).
  - Binary rejection guard: rejects multipart/form-data, octet-stream, and image/* with 415.
- Deterministic test suite: `scripts/test-lokamedia-phase5h1-article-media-attachment.js` (39 tests all pass).
- Full regression pass: 202 tests passed across Phase 5H1, 5G1, 5E1, publication readiness, and existing media tests. Clean TypeScript typecheck (`npx tsc --noEmit`).

### LokaMedia Phase 5G2 Controlled Media Assets Registration Execution 2026-09-20

- Successfully executed controlled canonical registration of the verified R2 derivative into `media_assets`.
- Consumed verified durable upload receipt (`upl_34381ae9e9996a2d4b4e0d93d29da49849e38fce7160e3e675a4d2c656f82d45`, state: `UPLOADED`) and verified canonical R2 object metadata (`media/articles/derivatives/458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff.png`, size: 3847117, SHA: `458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff`).
- Invoked canonical internal endpoint: `POST /api/internal/v1/media/assets/register`.
- Deterministic asset identity derived and verified: `ast_d230f3d834ae5f1a9f689d7c` (`ast_${sha256(role:sha256:r2_key).substring(0, 24)}`).
- First clean registration inserted exactly one row into `media_assets` with `status: 'VALIDATED'`, `role: 'ARTICLE_PUBLIC_DERIVATIVE'`, and full provenance JSON (`derivative_id`, `transform_id`, `upload_id`, `job_id`, `slot_key`, `article_id`).
- Safe audit event recorded in `media_asset_audit` (`action: 'REGISTER'`).
- Idempotency verified: second invocation returned existing asset (`reused_existing: true`, 0 second inserts).
- Lost-response retry recovery and post-reopen discovery verified.
- Absolute safety boundaries verified: `REGISTRATION_BINARY_BYTES_SENT=0`, `R2_PUT_CALLS=0`, `ARTICLE_MEDIA_CREATE_CALLS=0`, `ARTICLE_STATUS_MUTATIONS=0`, `ARTICLE_READINESS_MUTATIONS=0`, `PUBLICATION_MUTATIONS=0`.
- Result: `PHASE_5G2=PASS`, `MEDIA_ASSET_REGISTRATION_LANE_CLOSED=YES`, `READY_FOR_ARTICLE_MEDIA_ATTACHMENT=YES`.

### LokaMedia Phase 5G1 Media Asset Registration Foundation 2026-09-20

- Built decoupled media asset registration service and dedicated internal device-authenticated endpoint.
- Checkpoint commit: `861baa58bc90a4dae2a9f6c5f8cd01cf9d562730` (`feat: add media asset registration`).
- Database migration: `db/migrations/0016_media_assets_derivative_registration.sql` (additive columns for role, upload_id, derivative_id, transform_id, provenance_json; created `media_asset_audit` table).
- Service implementation: `src/lib/media/asset-registration.ts` (`registerMediaAsset`, `computeMediaAssetId`).
  - Enforced content-addressed identity rule: `ast_${sha256(role:sha256:r2_key).substring(0, 24)}`.
  - Enforced server-side receipt verification (must be `UPLOADED` with matching metadata).
  - Enforced independent canonical R2 object existence and metadata check (`bucket.head`).
  - Enforced idempotent deduplication and identity conflict guard (409 on conflicting metadata).
  - Preserved R2 storage on database failure (zero R2 deletes).
  - Strict decoupling: zero `article_media` creation, zero article readiness or status mutation.
- Internal API endpoint: `src/pages/api/internal/v1/media/assets/register.ts`.
- Deterministic test suite: `scripts/test-lokamedia-phase5g1-asset-registration.js` (40 tests all pass).

### LokaMedia Phase 5E2 Controlled Live R2 Upload Execution 2026-09-20

- Successfully executed controlled live upload of public derivative candidate to local Miniflare R2 bucket (`rancangloka-media`).
- Controlled fixture: `der_882fdc3c59e650718a83a38c5fa0db0f8b422a504946772c0f3af0fde9a0a662` (transform `f886f5d7b3278ebb6da84e9551df0c26b20795608eca26b05007f20ba48f155c`, 3847117 bytes, SHA `458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff`).
- Canonical R2 storage key: `media/articles/derivatives/458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff.png`.
- Durable upload receipt persisted in IndexedDB `media-uploads`: `upl_34381ae9e9996a2d4b4e0d93d29da49849e38fce7160e3e675a4d2c656f82d45` (state: `UPLOADED`).
- Second batch and duplicate enqueue idempotency verified: 0 second transfers, 0 duplicate R2 objects.
- R2 binary readback independently verified byte-for-byte identical (3847117 bytes, SHA-256 match).
- Zero `media_assets` rows created, zero `article_media` rows created, zero article status or readiness mutations.
- Result: `PHASE_5E2=PASS`, `UPLOAD_LANE_CLOSED=YES`, `READY_FOR_MEDIA_ASSET_REGISTRATION=YES`.

### LokaMedia Phase 5E1 Durable Derivative Upload Queue Foundation 2026-09-20

- Built durable client-side upload queue and server-side upload verification endpoint.
- Checkpoint commit: `1c30da7a0ab0118608836ea200c5cd4689679340` (`feat: add durable derivative upload queue`).
- Upgraded extension IndexedDB schema version from 3 to 4, adding `media-uploads` store.
- Modules: `src/upload-queue.ts`, `src/lib/media/derivative-upload.ts`, `src/pages/api/internal/v1/media/derivatives/[derivative_id]/upload.ts`.
- Enforced lease lock with expiration, concurrency cap of 2, backpressure limits, and canonical R2 key format.
- Deterministic test suite: `scripts/test-lokamedia-phase5e1-upload-queue.js` (19 tests all pass).

### LokaMedia Phase 5D5B Controlled Live Watermark Derivative Execution 2026-09-20

- Successfully executed one live watermark transform on the immutable captured original (`mjob_5c0f488d7ee123b9579a58a5:1`, 3846190 bytes).
- Produced durable derivative: `der_882fdc3c59e650718a83a38c5fa0db0f8b422a504946772c0f3af0fde9a0a662` (transform `f886f5d7b3278ebb6da84e9551df0c26b20795608eca26b05007f20ba48f155c`, SHA: `458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff`, 3847117 bytes, 1672x941 PNG).
- Stored durably in IndexedDB `media-derivatives` with role `PUBLIC_DERIVATIVE_CANDIDATE`.
- Idempotency verified: re-running transform reused existing derivative with 0 additional transforms.
- Original binary verified 100% immutable (SHA `68641cd3be874524f7a033bc539170f28cee0a609885d93c1f63f7c15ff35813` unchanged).
- Result: `PHASE_5D5B=PASS`, `MEDIA_PROCESSING_LANE_CLOSED=YES`, `READY_FOR_UPLOAD_QUEUE=YES`.

### LokaMedia Phase 5D5A Durable Watermark Derivative Pipeline 2026-09-20

- Checkpoint commit: `d5b67948bbdd73f4038af9dc395d65768247146c` (`feat: add durable watermark derivative pipeline`).
- Upgraded extension IndexedDB schema version from 2 to 3, adding `media-derivatives` store.
- Built client-side derivative pipeline (`src/derivative-pipeline.js`) with transform fingerprinting, watermark composition, and idempotent caching.
- Deterministic test suite: `scripts/test-lokamedia-phase5d5a-watermark-derivative-pipeline.js` (24 tests all pass).

### LokaMedia Phase 5D4B Watermark Master Asset Storage 2026-09-20

- Checkpoint commit: `a13e2532cb19e59d2a6a1aa5e4f20ec6179e8c45` (`feat: add watermark master asset storage`).
- Migration: `db/migrations/0015_site_watermark_assets.sql` (`site_watermark_assets` table).
- Service: `src/lib/watermark/assets.ts` with dedicated R2 namespace `site/watermarks/master/`.
- Deterministic test suite: `scripts/test-lokamedia-phase5d4b-watermark-asset-storage.js` (19 tests all pass).

### LokaMedia Phase 5D4A Admin Watermark Settings 2026-09-20

- Checkpoint commit: `50b41416ef35245a49fc51205fe2df4973ee7e5f` (`feat: add admin watermark settings`).
- Endpoints: `GET /api/admin/settings/watermark` and `PUT /api/admin/settings/watermark`.
- Schema: canonical settings structure with version tracking.
- Deterministic test suite: `scripts/test-lokamedia-phase5d4a-watermark-settings.js` (14 tests all pass).

### LokaMedia Phase 5D3A Deterministic Watermark Transform Core 2026-09-20

- Checkpoint commit: `1a40ab480d1964fb49e3cf41865c3bbcb3d1ffad` (`feat: add deterministic watermark transform core`).
- Module: `src/watermark-engine.js` (pure client-side deterministic composition with Canvas 2D API).
- Deterministic test suite: `scripts/test-lokamedia-phase5d3a-watermark-engine.js` (14 tests all pass).

### LokaMedia Phase 4B1A.5D2P Fresh Provider Preflight 2026-09-19

- Verified and reconciled extension runtime lifecycle after 5D1E fix and 5D2R-2 canonical recovery.
- Extension reloaded once with commit `0d04af48d3b946b4484b5c5b1d95fdc31b1dfa13`.
- ChatGPT tab (`https://chatgpt.com/c/6aae8fae-6308-83ec-accc-2a98d5c030eb`) refreshed cleanly; session state verified `AUTHENTICATED`, login prompt absent, ProseMirror composer present.
- Canonical `READ_ONLY_PROVIDER_DIAGNOSTIC` message executed through Side Panel and background handler.
- Provider state converged cleanly: `provider.tab=connected`, `provider.auth=ready`, `provider.dom=supported`, `provider.composer=ready`, `provider.lane=idle`.
- Runtime 5D1E contract verified loaded in content script and service worker: baseline candidate diffing, bounded result polling (up to 90000ms), source/container fingerprint requirement, controller and adapter malformed descriptor guards, and durable `result_checkpoint` support.
- Side Panel verified ready: `Run Once` button present, enabled, text `Run Once`.
- Fixture clean: server job `mjob_5c0f488d7ee123b9579a58a5` status `QUEUED`, `lease_owner=null`, `attempt=0`, `job_revision=15`. Local job `QUEUED`, `phase4bSingleRun=null`, all probes false, blob count 0.
- Zero live provider submissions, zero live captures, zero R2 uploads, zero media assets, zero article attachments, no push, no deploy.

### LokaMedia Phase 4B1A.5D2R-2 Blocked-Run Recovery Post-5D1E 2026-09-19

- Safely recovered blocked incident from earlier live run using canonical server and local recovery semantics.
- Server recovery: executed `POST /api/internal/v1/media/jobs/mjob_5c0f488d7ee123b9579a58a5/release` with `intent: 'SAFE_REQUEUE'`, `reason_code: 'EXPIRED_LEASE_RECOVERY'`, `expected_job_revision: 14`. Server returned `QUEUED`, `lease_owner=null`, `attempt=0`, `job_revision=15`.
- Local reconciliation: synchronized extension storage with server jobs list (`status=QUEUED`, `local_state=QUEUED`).
- Verified zero stale `result_checkpoint` and retired stale `phase4bSingleRun` latch (`lokamediaState.phase4bSingleRun = null`).
- Zero mutations to media assets, zero R2 uploads, zero live generation or capture.

### LokaMedia Phase 4B1A.5D1E Provider Result Completion & Correlation Contract Hardening 2026-09-19

- Hardened provider generation contract: `provider.generate()` does not resolve merely upon prompt submission; it awaits deterministic result identification.
- Checkpoint commit: `0d04af48d3b946b4484b5c5b1d95fdc31b1dfa13` (`fix: await correlated ChatGPT image result before capture`).
- Added pre-submit baseline candidate snapshot to distinguish pre-existing images from newly generated results.
- Added bounded asynchronous candidate polling loop in `controlledSubmit` with `PROVIDER_RESULT_TIMEOUT` (90000ms) and `PROVIDER_RESULT_AMBIGUOUS` structured fail-closed errors.
- Enforced complete result descriptor carrying `source_fingerprint`, `containerFingerprint`, `job_id`, `run_id`, `slot_key`, `prompt_version`, and `prompt_hash`.
- Persisted durable `result_checkpoint` in extension storage before capture handoff.
- Added fail-closed guards in `controller.js` and `adapter.js` before messaging content script or invoking capture when result is not capture-ready (`isCaptureReadyProviderResult`).
- Deterministic test suite: `scripts/test-lokamedia-phase4b1a-5d1e-result-await.js` (Tests 13 through 22 all pass).
- Full regression suite clean: all 56 tests passed, TypeScript typecheck clean, syntax checks clean.

### LokaMedia Phase 4B1A.5D1C IndexedDB Capture Store Schema Migration 2026-09-19

- Upgraded extension IndexedDB schema version from 1 to 2.
- Created `captured-blobs` object store with `keyPath: 'blobKey'` and secondary indexes (`by_job_id`, `by_run_id`, `by_status`, `by_created_at`).
- Preserved existing data in unrelated stores and ensured forward-only idempotent migration.
- Deterministic test suite: `scripts/test-lokamedia-phase4b1a-5d1c-schema-migration.js` (Tests A through H all pass).

### LokaMedia Phase 4B1A.5D1B Real ChatGPT Capture Adapter Wiring 2026-09-19

- Wrote and wired the real ChatGPT capture path, removing the `CAPTURE_DISABLED_PHASE_4A` stub: `provider.capture(job, providerResult)` → `chrome.tabs.sendMessage` → `content-script.js` `CHATGPT_PROVIDER_CAPTURE` handler → target image binary acquisition → controller binary validation & durable persistence.
- Checkpoint commit: `6960e9cb102597697a8be94c7aee91ffca6e9459` (`fix: wire LokaMedia ChatGPT capture adapter`).
- Critical correlation rule enforced: capture consumes the exact result descriptor already selected by provider-generation correlation (`source_fingerprint` or `containerFingerprint`). Global heuristics (`newest <img>`, first matching, ungrounded re-discovery) are strictly prohibited.
- Content script `controlledCapture` revalidates candidate image within container, fails closed with `CAPTURE_TARGET_MISSING` if absent, `CAPTURE_TARGET_AMBIGUOUS` if non-unique, and `CAPTURE_CORRELATION_MISMATCH` if descriptor metadata does not match `job_id`/`run_id`/`slot_key`.
- Binary acquisition method: canvas `toDataURL` fallback to direct `fetch(src)` with chunked base64 data URL transport across Chrome extension messaging (`CAPTURE_MESSAGE_BINARY_TRANSPORT=BASE64_DATA_URL`).
- Binary roundtrip verified byte-for-byte identical using 64 KiB deterministic fixture (`BINARY_ROUNDTRIP_IDENTICAL=YES`).
- Canonical binary validation maintained in controller: authoritative gate for non-empty bytes, valid MIME (`image/png`, `image/jpeg`, `image/webp`), and dimensions before durable IndexedDB persistence.
- Fail-closed handling for missing receiver: surfaces `CONTENT_SCRIPT_UNAVAILABLE` cleanly without silent retries.
- Deterministic test suite added in `scripts/test-lokamedia-phase4b1a-5d1b-chatgpt-capture.js` covering Tests A through J (exact correlated capture, missing target, ambiguous target, correlation mismatch, binary transport, MIME preservation, content script absent, capture exactly once, controller integration, and explicit descriptor passing).
- Regression suite: all 7 test suites passing (76 tests passed, 0 failures), TypeScript `--noEmit` clean, syntax checks clean.
- Controlled fixture `mjob_5c0f488d7ee123b9579a58a5` remains untouched in local D1 (`status=QUEUED`, `lease_owner=null`, `attempt=0`, `job_revision=11`).
- Probes reset to default: `acquisitionProbe=false`, `providerResultProbe=false`, `captureBlobProbe=false`.
- Zero live prompt submissions, zero live captures, zero R2 uploads, zero media assets, zero article attachments, no push, no deploy.

### LokaMedia Phase 4B1A.5D1 Capture Correlation & Durable Blob Safety Boundary 2026-09-19

- Implemented deterministic correlation baseline diffing and capture durable safety boundary for the LokaMedia extension pipeline.
- Checkpoint commit: `58428bd2e87daa5d2df011f44c1dc822101c75af` (`test: add safe LokaMedia capture blob probe`).
- Exact candidate correlation: `correlateImageCandidates` diffs baseline snapshot against current DOM; prohibits global `newest <img>` heuristic.
- Durable persistence: IndexedDB / memory blob store persistence (`blobStore.put`) storing binary bytes, mime, dimensions, sha256, run_id, and job_id.
- Backpressure limits enforced: `MAX_PENDING_CAPTURED_ASSETS=4` and `MAX_PENDING_CAPTURED_BYTES=20 MiB` with fail-closed rejection.
- Capture Blob Probe boundary: `captureBlobProbe=true` stops pipeline immediately after durable blob persistence and before R2 upload, media asset creation, or article attachment.
- Deterministic test suite: `scripts/test-lokamedia-phase4b1a-5d1-capture-probe.js` (12 tests covering Tests 12-23).

### LokaMedia Phase 4B1A.5C2 Live Provider Generation Probe & Preflight Repairs 2026-09-19

- Successfully executed controlled live provider generation probe with exactly one real ChatGPT submission and stop at provider-result probe boundary.
- Repaired heartbeat contract (client sends `expected_job_revision`, server authoritative revision propagated to subsequent mutations).
- Repaired ChatGPT ProseMirror contenteditable composer detection and dynamic voice/send control state transitions.
- Fixed content-script lifecycle with mandatory reconnect preflight on reload.
- Proven live: Panel click → Run Once → Job Acquired → Heartbeat pass → provider.generate → ChatGPT submit 1x → Result correlated → Stop at `PROVIDER_RESULT_PROBE_STOP` with safe requeue. Zero capture calls, zero R2 uploads, zero media assets.

### LokaMedia Phase 4B1A.5C1 Provider Result Stop Boundary 2026-09-19

- Added explicit local-only `providerResultProbe` boundary to `controller.runJob` immediately after provider result correlation (`GENERATION_IMAGE_DETECTED`) and before capture handoff (`CAPTURE_START`).
- Emits structured `PROVIDER_RESULT_PROBE_STOP` audit event correlated with `run_id`, `job_id`, and provider result metadata.
- Canonical job lease cleanup: uses existing server-side `POST /api/internal/v1/media/jobs/[job_id]/release` endpoint via `ApiClient.releaseJob` with `intent: 'SAFE_REQUEUE'`, `reasonCode: 'PROVIDER_RESULT_PROBE_STOP'` to safely return leased fixture back to `QUEUED` without stranding.
- Duplicate generation risk is strictly controlled: single-run consumption latch (`phase4bSingleRun.submission_consumed = true`) blocks subsequent re-entry with `PHASE_4B_RUN_CONSUMED`, while provider generation concurrency is locked to 1.
- Guarantees zero image capture calls, zero blob persistence, zero R2 uploads, zero media asset creations, and zero article media attachments.
- Active-run lock is reliably released in `controller.runOnce` try/finally cleanup block upon probe stop.
- Normal flow remains completely unchanged when `providerResultProbe: false` (the default).
- Deterministic test coverage added covering Tests A through H (default flow unchanged, probe stop after result identification, run_id and job_id correlation, single provider call, capture blocked, canonical cleanup semantics, active run lock release).
- Safety preserved: no live provider calls, no live ChatGPT generation, no fixture mutation, no deployment, and no production mutation.

### LokaMedia Phase 4B1A.5B1 Local Acquisition-Stop Probe Boundary 2026-09-19

- Added explicit local-only `acquisitionProbe` boundary to `controller.runOnce` immediately after `JOB_ACQUIRED` and before single-run arming, submission, or `runJob` invocation.
- Emits structured `ACQUISITION_PROBE_STOP` audit event correlated with `run_id` and `job_id`.
- Canonical job lease cleanup: uses existing server-side `POST /api/internal/v1/media/jobs/[job_id]/release` endpoint via `ApiClient.releaseJob` with `intent: 'SAFE_REQUEUE'` to safely return leased fixture back to `QUEUED` without stranding.
- Preserves guaranteed active-run lock release in try/finally block and leaves default normal execution (`acquisitionProbe: false`) completely unchanged.
- Deterministic test coverage added proving normal flow unaffected, probe stop immediately after acquisition, run_id correlation, active lock release, canonical requeue invocation, and zero provider/image calls.
- Safety preserved: no live provider calls, no ChatGPT generation, no fixture mutation, and no deployment.

### LokaMedia Phase 4B1A.5A Run Once Execution-Start Repair 2026-09-19

- Repaired the execution-start gap between Side Panel Run Once dispatch, background message acceptance, and controller execution start.
- Single source of truth `run_id`: generated once at Side Panel click, propagated through `RUN_ONCE` message payload to background and controller, ensuring `RUN_ID_PANEL == RUN_ID_BACKGROUND == RUN_ID_CONTROLLER == RUN_ID_GATE`.
- Active-run mutual exclusion: added `acquireActiveRunLock`, `releaseActiveRunLock`, and `getActiveRunLock` in storage and controller, preventing concurrent executions and logging structured `RUN_REENTRY_REJECTED` audit evidence.
- Reliable lock release: controller execution path is protected with try/finally cleanup, guaranteeing active lock release on success, controlled gate rejection, and unexpected failures.
- Ensured `RUN_GATE_CHECK_START` is reached directly upon execution controller entry, preventing startup/reconcile failures from silently blocking gate inspection.
- Deterministic test coverage added covering accepted request execution start, run_id propagation, concurrent re-entry rejection, lock release on success, lock release on failure, and no duplicate execution.
- Safety preserved: no real ChatGPT prompt submission, no image generation, no new article/job fixture, no deployment, and no production mutation.

### LokaMedia Phase 4B1A.5 Durable Run Audit Logging 2026-09-16

- Implemented local-only durable structured audit logging for the LokaMedia extension Run Once path.
- Checkpoint commit: `028a73ee45db8edb32c1537c33dab72e1732ec6b` (`fix(lokamedia): repair run-once path and add audit logging`).
- Added `run_id`/`job_id` correlation, monotonic event sequence, safe error serialization, secret redaction, bounded retention (1000 events / 7 days), copy text, JSON export, isolated clear, and compact Last Action status.
- Instrumented panel click, background request acceptance, gate checks, job acquisition, provider lane, provider precheck/prepare, submission gate, provider submit, capture, upload, attachment confirmation, run completion, and failure/needs-attention outcomes.
- Root cause addressed: Run Once failures previously lacked durable structured diagnostics and could appear silent after status refresh.
- General automatic ChatGPT submission remains disabled; the controlled submit bridge is enabled only through explicit Phase 4B Run Once after local readiness, one-shot gate, server job acquisition, and provider lane checks pass.
- Capture remains Phase 4A-disabled, so this checkpoint is audit-visible and controlled-submit-ready but not yet full end-to-end media-completion-ready.
- Verification passed: side panel tests, popup controls tests, Phase 3 extension regression, Phase 4A ChatGPT provider regression, TypeScript `--noEmit`, recursive extension syntax check, and Astro production build.
- Operator note: unpacked Chrome extension reload is required before the new audit UI and Run Once logging are visible.
- Safety preserved: no real ChatGPT prompt submission, no image generation, no new article/job fixture, no deployment, and no production mutation.

### LokaMedia Phase 2A Durable Job Foundation 2026-09-14

* **Scope:** local schema/service/test implementation only; no production deploy, no remote D1 migration, no R2 mutation, and no production article mutation.
* **Migration:** `db/migrations/0013_lokamedia_durable_jobs.sql`.
* **Model:** `media_jobs.status` is the single canonical job lifecycle state.
* **Server fields:** added durable readiness, priority, sequence, prompt version/hash, lease, heartbeat, retry/attempt, idempotency, submitted/completed, revision, and supersession fields.
* **Active job guard:** one active job per `article_id + slot_key`, enforced by partial unique index plus service guard; terminal historical jobs can coexist.
* **Receipts/events:** added `media_job_receipts` and `media_job_events` foundations with safe payload handling and idempotency support.
* **Service primitives:** added media requirement creation, active-slot checks, canonical transitions, supersession, receipts, and event timeline helpers.
* `AUTO_PUBLISH=OFF`
* `READY_FOR_PHASE_2B=YES`

### LokaMedia Phase 2B Server Control Plane 2026-09-14

* **Scope:** local server scheduler/leasing/reconciliation implementation only; no production deploy, no remote D1 migration, no R2 mutation, no production article mutation, no extension/ChatGPT/provider automation.
* **Protocol:** `LOKAMEDIA_PROTOCOL_VERSION=1`.
* **Endpoints:** added next-job lease, heartbeat, reconcile, controlled release, progress event, and receipt lookup internal APIs under `/api/internal/v1/media/jobs`.
* **Scheduler:** server-authoritative deterministic eligibility and fairness; priority first, then featured/pass fairness across articles, then required-for-readiness, sequence, created time, and job id.
* **Lease model:** compare-and-swap acquisition using job revision; 300-second lease; heartbeat extends lease without incrementing attempt; expired leases recover to `RECOVERING`.
* **Retry/release:** controlled release intents only; bounded retry policy with safe error codes and no infinite retries.
* **Reconciliation:** read-only authoritative status response with latest receipt, attachment confirmation, lease relation, and bounded recommended action; extension must reconcile before retrying side effects.
* **Security:** media device scope remains unable to publish, delete/edit articles arbitrarily, mutate settings, deploy, or choose arbitrary R2 paths.
* `AUTO_PUBLISH=OFF`
* `READY_FOR_PHASE_2C=YES`

### LokaMedia Phase 2C Server Media Pipeline Foundation 2026-09-15

* **Scope:** local server upload, attachment, readiness, and renderer foundation only; no production deploy, no remote migration, no production D1/R2/article mutation, no Chrome extension, no ChatGPT/provider connection.
* **Canonical endpoint:** evolved `POST /api/internal/v1/media/upload`; no parallel upload path was introduced.
* **Upload contract:** `source_type=lokamedia_extension` requires protocol version, job ID, expected job revision, article/slot/role/sequence, prompt version/hash, idempotency key, client SHA, alt text, and binary/multipart payload.
* **Server authority:** media job, article, slot, role, prompt, revision, and lease ownership are verified server-side; wrong article/slot, stale revision, superseded/cancelled/terminal job, prompt mismatch, arbitrary R2 key, and SHA mismatch fail closed.
* **Binary pipeline:** server validates image magic bytes, MIME, dimensions, size, and server-computed SHA-256; storage key remains server-derived as `media/images/<sha256>.<ext>`.
* **Dedupe/idempotency:** existing validated `media_assets` are reused by SHA; `job_id + idempotency_key` replays return the authoritative attachment receipt without duplicate side effects.
* **Attachment:** `article_media` now has a Phase 2C active-slot guard for one active winning attachment per `article_id + slot_key`; featured uploads still mirror to `articles.featured_image` and `articles.image_alt`.
* **Receipts/recovery:** uploads persist `UPLOAD_RECEIVED`/`ASSET_EXISTS` and `ATTACHMENT_CONFIRMED` receipts; reconcile reveals lost-response success without another R2 write.
* **Readiness:** durable media requirements now aggregate multi-slot state into `WAITING_MEDIA`, `MEDIA_IN_PROGRESS`, `MEDIA_NEEDS_ATTENTION`, or `READY_FOR_REVIEW`; optional media does not block readiness and legacy articles keep compatibility behavior.
* **Renderer:** public article rendering supports safe `{{media:<slot_key>}}` anchors, omitting unresolved slots without broken images.
* **Concurrency:** independent uploads are supported without a global upload lock; generation and upload can overlap across different jobs.
* **Verification:** Phase 2A, Phase 2B, existing LokaMedia, Phase 2C upload/readiness/renderer, publication readiness/safety, Article tests, TypeScript typecheck, and Astro build passed locally.
* **New migration:** `db/migrations/0014_lokamedia_phase2c_slot_attachment.sql`.
* `AUTO_PUBLISH=OFF`
* `READY_FOR_PHASE_3_MV3_EXTENSION_CORE=YES`

### LokaMedia Phase 3 MV3 Durable Extension Core 2026-09-15

* **Scope:** local Chrome MV3 extension core only; no production deploy, no remote migration, no production D1/R2/article mutation, no ChatGPT/provider connection, and no model calls.
* **Extension root:** added loadable unpacked extension at `extensions/lokamedia` with MV3 manifest, module service worker, popup/status UI, and README.
* **Versions:** `EXTENSION_VERSION=0.1.0`, `LOKAMEDIA_PROTOCOL_VERSION=1`, and `STORAGE_SCHEMA_VERSION=1`.
* **Permissions:** uses only `storage` and `alarms`, with host permissions limited to localhost and the RancangLoka host; no ChatGPT/OpenAI host permission is requested.
* **Durability:** small checkpoints are stored in `chrome.storage.local`; captured binaries are stored in IndexedDB; no large Base64/localStorage blob path was introduced.
* **Core workers:** added API client, scheduler/controller, heartbeat manager, reconciliation manager, upload worker pool, backpressure controller, message protocol, provider lane lock, and deterministic mock provider.
* **Concurrency:** provider generation is locked to 1, image capture to 1, upload workers to 2, and captured-asset backpressure to 4 assets / 20 MiB.
* **Recovery:** startup reconciles before retry, resumes captured uploads, handles lost upload responses through server receipts, clears stale queue entries after attachment confirmation, preserves blobs across restart, and stops superseded/terminal jobs.
* **Provider boundary:** ChatGPT automation remains intentionally unimplemented; Phase 3 includes a mock provider only and does not infer fake generation percentages.
* **Tests:** added `scripts/test-lokamedia-phase3-extension.js` covering startup/no-job, acquisition, heartbeat/loss, lease loss, protocol/auth failures, restart persistence, blob missing recovery, two upload workers, upload replay, lost response recovery, backpressure, duplicate messages, stale revisions, terminal/superseded state, offline/online recovery, parallel pipeline, and multi-lane restart.
* `AUTO_PUBLISH=OFF`
* `READY_FOR_PHASE_4_CHATGPT_PROVIDER_ADAPTER=YES`

### LokaMedia Offline Checkpoint After Phase 3 2026-09-15

* **Checkpoint file:** `state/LOKAMEDIA_PHASE3_OFFLINE_CHECKPOINT.md`.
* **Canonical worktree:** `C:\Users\Fanto\Desktop\antigravity\rancangloka\lokamedia-phase-2ab-checkpoint`.
* **Clean checkpoint commit:** `712bc5fdf23ac1e8beeafce8db6202a1c07b44c1` (`feat(lokamedia): add durable MV3 extension core`).
* **Status:** Phase 3 passed and the worktree was clean before offline handoff.
* **Safety:** `AUTO_PUBLISH=OFF`, `MODEL_CALLS=0`, `PRODUCTION_MUTATIONS=0`, `DEPLOYMENTS=0`.
* **Next phase:** Phase 4 ChatGPT provider adapter can start from the committed MV3 core boundary.

### LokaMedia Phase 4A ChatGPT Provider Adapter Foundation 2026-09-16

* **Scope:** local read-only ChatGPT provider foundation only; no prompt submission, no model call, no image generation, no capture/download, no production deploy, no remote migration, and no production D1/R2/article mutation.
* **Provider root:** `extensions/lokamedia/src/providers/chatgpt`.
* **DOM contract:** `CHATGPT_DOM_ADAPTER_VERSION=1`, separate from `LOKAMEDIA_PROTOCOL_VERSION=1` and `EXTENSION_VERSION=0.1.0`.
* **Host permission:** added the explicit minimal ChatGPT origin `https://chatgpt.com/*`; `<all_urls>` is not requested.
* **Human authentication boundary:** adapter detects `AUTHENTICATED`, `AUTH_REQUIRED`, or `UNKNOWN`; it does not log in, enter credentials, copy cookies, copy tokens, or store authorization material.
* **Handshake:** added versioned service-worker/content-script handshake with tab identity validation, duplicate HELLO safety, stale-version rejection, wrong-tab rejection, and reconnect-safe local provider state.
* **Capability discovery:** read-only detection covers composer presence/editability, send control presence, conversation/response surfaces, image result surface, download affordance, and auth state.
* **Selector strategy:** selectors are centralized and layered by semantic attributes, accessibility labels, scoped form/surface relationships, and narrow fallbacks; generated CSS classes, nth-child, coordinates, blind clicks, newest image selection, and broad DOM mutation are not used.
* **Fail closed:** unsupported DOM returns `DOM_CONTRACT_UNSUPPORTED`; ambiguous image correlation returns `AMBIGUOUS_IMAGE_CANDIDATE`.
* **Baseline inventory:** existing image candidates are inventoried with local id, normalized source fingerprint, dimensions, container fingerprint, observation timestamp, and optional provider asset id only; image bytes and unrelated conversation text are not persisted.
* **Correlation foundation:** future Phase 4B acceptance combines job id, prompt version/hash, provider tab id, optional conversation/response identity, sequence, baseline fingerprints, and post-submission candidates; no single DOM-order signal is authoritative.
* **Capture discovery:** future capture priority is provider download/asset, available binary/blob, fetchable resolved asset, safe browser conversion, and screenshot last; screenshot is not the primary capture path.
* **Read-only diagnostic/UI:** popup shows ChatGPT tab/auth/DOM/composer/image-count/provider-lane status and exposes a read-only provider check that does not type, click, submit, download, or change conversation.
* **Tests:** added `scripts/test-lokamedia-phase4a-chatgpt-provider.js` covering provider DOM fixtures, baseline/correlation, reorder safety, no-submission guard, capture discovery, handshake restart/stale/wrong-tab cases, reload, and tab-closed handling.
* `PROMPT_SUBMISSION_ENABLED=NO`
* `MODEL_CALLS=0`
* `IMAGE_GENERATIONS=0`
* `AUTO_PUBLISH=OFF`
* `READY_FOR_PHASE_4B_SINGLE_CONTROLLED_GENERATION=YES`

### LokaMedia Phase 4B0A/4B0C Operator UI Preflight 2026-09-16

* **Scope:** Chrome extension UI architecture only; no ChatGPT prompt submission, no model call, no image generation, no media job creation, no D1/R2/article mutation, and no deployment.
* **Popup repair:** repaired popup control wiring with bounded startup/status diagnostics, visible provider-check errors, service-worker message handling, and a safe content-script reconnect path.
* **Side Panel migration:** the canonical operator UI moved from the Chrome action popup to Chrome's native right-side Side Panel.
* **Manifest:** added `sidePanel` permission and `side_panel.default_path = src/side-panel.html`; removed `action.default_popup` so the toolbar icon opens the Side Panel instead of a transient popup.
* **Toolbar behavior:** service worker requests `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`.
* **Boundary:** Side Panel communicates with the service worker through the existing extension message protocol; it does not talk directly to ChatGPT, server internals, D1, R2, or article records.
* **Persistent monitor:** Side Panel shows ChatGPT and RancangLoka status separately, current job summary, queue counters, upload transfer progress, provider diagnostic fields, server/backpressure/error status, Enabled/Pause, Provider Check, and collapsed configuration.
* **Safety:** Run/manual generation is not exposed in the Side Panel and background `TICK` remains guarded as `PHASE_4B_NOT_ARMED`.
* **Provider check:** remains read-only; it may detect tab/auth/DOM/composer/images/lane and may reconnect the content script, but it does not type, click Send, submit, download, or generate.
* **Progress model:** generation remains indeterminate + elapsed; uploads use real transfer percentage where available.
* **Tests:** added `scripts/test-lokamedia-popup-controls.js` and `scripts/test-lokamedia-side-panel.js` for popup repair and native Side Panel behavior.
* `MODEL_CALLS=0`
* `PROMPT_SUBMISSIONS=0`
* `IMAGE_GENERATIONS=0`
* `AUTO_PUBLISH=OFF`

---

### Masalah 2026-09-13: Standar Mobile Responsive Artikel Publik
* **Gejala:** Dibutuhkan standar mobile yang ketat untuk halaman artikel RancangLoka, dengan referensi utama iPhone 11 `414 x 896`, minimum `360 x 800`, gutter kiri/kanan setara, tanpa horizontal overflow, dan alignment konsisten untuk cover, body, references, related articles, serta footer.
* **Penyebab:** Halaman artikel publik memakai beberapa container dan breakpoint berbeda, sehingga perlu token grid mobile tunggal untuk menghindari nested-padding asymmetry dan elemen yang berpotensi melewati parent pada layar kecil.
* **Solusi:**
  - Menambahkan token `.rl-mobile-grid` di `src/styles/global.css` dengan `padding-inline: clamp(16px, 4.8vw, 20px)`.
  - Menambahkan `.rl-safe-wrap`, guard `overflow-x: clip`, dan batas `max-width: 100%` untuk media, tabel, `pre`, dan konten prose.
  - Menyamakan container artikel, halaman statis, related articles, dan footer ke grid mobile yang sama.
  - Menyesuaikan spacing mobile untuk H1, cover, editorial cards, references, CTA, dan footer tanpa mengubah logic data, publikasi, media, atau schema.
* **Verifikasi:**
  - `node --test scripts/test-mobile-responsive-standard.js`: PASS.
  - `tsc --noEmit`: PASS.
  - `astro build`: PASS.
  - Browser QA lokal pada `360 x 800`, `375 x 812`, `390 x 844`, `414 x 896`, `430 x 932`, `768 x 1024`, `1280 x 800`, dan `1440 x 900`: PASS untuk gutter equality, no horizontal overflow, cover/body/references/footer alignment.
* **Checkpoint:** Detail lengkap tersimpan di `state/MOBILE_RESPONSIVE_CHECKPOINT.md`.
* **Status:** Local validated. Belum deploy produksi karena prompt mobile responsive ini tidak menyertakan instruksi deployment.

---

### Masalah 1: Konfigurasi Deployment Cloudflare Workers Builds CI
* **Gejala:** Deploy gagal dengan error `Authentication error [code: 10000]` atau `It looks like you've run a Workers-specific command in a Pages project`.
* **Penyebab:** 
  1. `wrangler.toml` sebelumnya menggunakan direktif `pages_build_output_dir = "dist"`.
  2. Perintah deploy dan token API belum memiliki permission `Cloudflare Pages: Edit` atau diselaraskan dengan Cloudflare Workers Builds CI.
* **Solusi:**
  - Mengupdate [`wrangler.toml`](file:///wrangler.toml) ke mode **Cloudflare Workers with Assets**:
    ```toml
    name = "rancangloka"
    main = "dist/_worker.js/index.js"
    assets = { directory = "dist" }
    ```
  - Menghapus package deprecated `lucide-astro` dan beralih ke `@lucide/astro`.
  - Menggunakan konfigurasi build:
    - **Build command:** `npm run build`
    - **Deploy command:** `npx wrangler deploy`
  - **Hasil:** Deploy berhasil 100% dan live di `https://rancangloka.chandrajoyko.workers.dev`.

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
  - **Hasil:** Skor naik menjadi **Performance 90+**, **Best Practices 100**, **SEO 100**, **Agentic 2/2**.

---

### Masalah 8: Kebijakan Status Impor Markdown (Draft vs Published)
* **Gejala:** Sebelumnya endpoint impor Markdown langsung menyetel artikel ke status `published`, sehingga artikel baru belum sempat ditinjau editor langsung tayang ke publik.
* **Solusi:**
  - Memperbarui [`src/pages/api/admin/import-md.ts`](file:///src/pages/api/admin/import-md.ts) agar menyetel status default menjadi `draft` (`status: frontmatter.status || 'draft'`).
  - Redaktur/Editor dapat meninjau format, gambar cover, kategori, dan snippet SEO terlebih dahulu di CMS sebelum mempublikasikannya.

---

### Masalah 9: Validasi Kesiapan Artikel Sebelum Tayang (Editorial Quality Gate)
* **Gejala:** Artikel dengan field kosong (misal tanpa gambar cover, tanpa meta deskripsi, atau tanpa kategori) dapat tidak sengaja ter-publish dan merusak tampilan layout.
* **Solusi:**
  - Menambahkan sistem *Editorial Quality Gate* di [`src/pages/api/admin/posts.ts`](file:///src/pages/api/admin/posts.ts) dan form editor [`src/pages/admin/posts/new.astro`](file:///src/pages/admin/posts/new.astro).
  - Jika artikel belum memenuhi syarat wajib (Judul, Konten, Deskripsi, Cover Image, Kategori, Penulis), sistem menolak publish dan menampilkan checklist field yang perlu dilengkapi atau mengarahkannya untuk disimpan sebagai `Draft`.

---

### Masalah 10: Drag & Drop Image Uploader & Client-Side WebP Converter ke R2
* **Gejala:** Sebelumnya editor hanya bisa memasukkan URL gambar eksternal secara manual.
* **Solusi:**
  - Membuat endpoint upload R2 [`src/pages/api/admin/upload.ts`](file:///src/pages/api/admin/upload.ts) dan streaming media [`src/pages/media/[key].ts`](file:///src/pages/media/%5Bkey%5D.ts).
  - Menambahkan fitur Drag & Drop di [`src/pages/admin/posts/new.astro`](file:///src/pages/admin/posts/new.astro) dengan konverter otomatis berbasis HTML5 Canvas yang otomatis mengubah foto format apa pun (PNG, JPG) menjadi WebP (skala maks 1200px, kualitas 82%) langsung di browser sebelum dikirim ke Cloudflare R2.

---

### Masalah 11: Sistem Halaman Statis & Page Writer (WordPress-Style Pages)
* **Gejala:** Belum ada pemisahan entitas antara artikel blog/majalah (Posts) dengan halaman informasi statis (Pages) seperti *Tentang Kami*, *Kontak*, *Pedoman Media Siber*, dan *Kebijakan Privasi*.
* **Solusi:**
  - Membuat tabel `pages` di database D1 [`db/schema.sql`](file:///db/schema.sql) dan data layer [`src/lib/db.ts`](file:///src/lib/db.ts).
  - Menambahkan menu **"Halaman (Pages)"** di Admin CMS [`src/layouts/AdminLayout.astro`](file:///src/layouts/AdminLayout.astro).
  - Membangun halaman listing [`src/pages/admin/pages/index.astro`](file:///src/pages/admin/pages/index.astro) dan editor penulisan halaman [`src/pages/admin/pages/new.astro`](file:///src/pages/admin/pages/new.astro) & [`src/pages/admin/pages/[id].astro`](file:///src/pages/admin/pages/%5Bid%5D.astro).
  - Mendukung template halaman (Standar, Formulir Kontak Interaktif, Full Width) serta auto-sitemap di [`src/pages/sitemap-pages.xml.ts`](file:///src/pages/sitemap-pages.xml.ts).

---

### Masalah 12: Sirkulasi Internal Linking Otomatis & Toggle Artikel Berbayar (Sponsored Review)
* **Gejala:** Belum ada sistem sirkulasi backlink internal otomatis (Dateline Branding, In-Article "BACA JUGA", Auto-Keyword Linker), serta belum ada opsi untuk menonaktifkan sirkulasi ini khusus artikel pesanan berbayar (*Paid Review / Advertorial*) agar fokus pada link klien sponsor.
* **Solusi:**
  - Membangun modul *Internal Linking Engine* di [`src/lib/seo.ts`](file:///src/lib/seo.ts):
    1. **Dateline Source Branding:** Otomatis menyematkan `RANCANGLOKA.COM – ` di `<p>` pertama artikel dan feed RSS.
    2. **In-Article "BACA JUGA":** Menyematkan callout kartu rekomendasi artikel terkait tepat sebelum `<h2>` kedua/ketiga.
    3. **Auto-Keyword Linker:** Memindai kata kunci fokus artikel lain dan otomatis mengubahnya menjadi anchor link kontekstual (maks 2 per artikel).
  - Menambahkan field `is_sponsored` & `disable_internal_links` di D1 dan switch toggle di Admin Editor [`src/pages/admin/posts/new.astro`](file:///src/pages/admin/posts/new.astro) & frontmatter Markdown. Jika aktif, internal links dan widget "BACA JUGA" otomatis dinonaktifkan khusus untuk artikel sponsor tersebut.

---

### Masalah 13: Social Share Bar Customizer & Footer Manager di Dashboard Admin
* **Gejala:** Admin belum bisa mengatur tombol share media sosial apa saja yang aktif di artikel serta belum bisa mengatur profil tautan media sosial resmi dan deskripsi di footer secara dinamis.
* **Solusi:**
  - Menambahkan panel kustomisasi **Social Share Bar** di [`src/pages/admin/settings.astro`](file:///src/pages/admin/settings.astro) (Master Toggle, per-platform on/off: WhatsApp, X/Twitter, Facebook, LinkedIn, Telegram, Copy Link, serta Twitter handle).
  - Menambahkan panel **Footer Manager & Official Socials** di [`src/pages/admin/settings.astro`](file:///src/pages/admin/settings.astro) (Deskripsi footer, tautan medsos resmi: Instagram, TikTok, X, YouTube, Pinterest, LinkedIn, dan teks Copyright).
  - Memperbarui [`src/components/SocialShareBar.astro`](file:///src/components/SocialShareBar.astro) dan [`src/layouts/BaseLayout.astro`](file:///src/layouts/BaseLayout.astro) agar merender tampilan footer dan share bar dinamis berbasis database D1.

---

### Masalah 14: Stealth Mode & Obfuscation Identitas Framework (Anti-Detector Wappalyzer/Competitor)
* **Gejala:** Folder aset bawaan framework (`/_astro/...`) berpotensi diekspos ke publik dan dideteksi oleh ekstensi kompetitor (Wappalyzer / BuiltWith).
* **Solusi:**
  - Memodifikasi [`astro.config.mjs`](file:///astro.config.mjs) dengan `build: { assets: 'assets' }` dan `compressHTML: true`.
  - Semua file JS/CSS hasil kompilasi kini disajikan dalam path anonim `/assets/xxx.js` dan kode HTML terminifikasi rapat tanpa komentar bawaan generator, menyamarkan arsitektur internal sepenuhnya menjadi web *custom-built*.

---

### Masalah 15: Implementasi 6 Fitur World-Class Editorial Media (Engagement & Visual Interactivity)
* **Gejala:** Dibutuhkan peningkatan pengalaman membaca, retensi pembaca, eksplorasi visual arsitektur, dan produktivitas editor di level standar media internasional (ArchDaily/Dezeen/Kinfolk).
* **Solusi:**
  1. **Native Photo Lightbox Zoom:** [`src/components/ImageLightbox.astro`](file:///src/components/ImageLightbox.astro) memungkinkan pembaca mengetuk gambar untuk mode full-screen HD dengan tombol unduh dan caption.
  2. **Interactive Before-After Slider:** [`src/components/BeforeAfterSlider.astro`](file:///src/components/BeforeAfterSlider.astro) komponen interaktif perbandingan renovasi ruangan yang dapat digeser mulus via touch/mouse.
  3. **Inspiration Bookmarks (Client-Side):** [`src/components/BookmarkDrawer.astro`](file:///src/components/BookmarkDrawer.astro) pembaca dapat menyimpan artikel favorit ke browser via tombol 🔖 tanpa login.
  4. **Enhanced Search Modal:** [`src/components/SearchModal.astro`](file:///src/components/SearchModal.astro) kini menyajikan tag tren (`#Japandi`, `#FasadTropis`, dll.) saat input masih kosong.
  5. **Newsletter Box & D1 Database:** [`src/components/NewsletterBox.astro`](file:///src/components/NewsletterBox.astro) dan API [`src/pages/api/newsletter/subscribe.ts`](file:///src/pages/api/newsletter/subscribe.ts) yang menyimpan data email ke tabel `subscribers` di D1.
  6. **Realtime SEO Live Scorecard:** Pasang checklist SEO otomatis di sidebar editor [`src/pages/admin/posts/new.astro`](file:///src/pages/admin/posts/new.astro) untuk panduan instan penulis.

---

### Masalah 16: Full-Width Breakout Grid Artikel Terkait & Redesain Author Card Mewah
* **Gejala:** Seksi Artikel Terkait di bawah artikel terjepit di kolom sempit `max-w-3xl` (~768px), membuat 3 kartu artikel terlihat menciut dan menyisakan ruang hampa putih yang terlalu lebar di layar desktop.
* **Solusi:**
  - Memisahkan `<RelatedArticles />` ke luar kontainer sempit `<article>` agar melebar penuh (*Full-Width Breakout*) hingga **`max-w-7xl` (1280px)** dengan latar belakang halus (*Soft Canvas Backdrop* `bg-slate-50/70 py-16`).
  - Memperbarui [`src/components/RelatedArticles.astro`](file:///src/components/RelatedArticles.astro) dengan kartu beresolusi foto lega `aspect-[16/10]`, badge topik melayang, dan efek hover transisi 700ms.
  - Memperbarui [`src/components/AuthorCard.astro`](file:///src/components/AuthorCard.astro) dengan gaya *Apple Squircle Box* (`rounded-[2rem]`), ring avatar tebal, badge verifikasi editor, dan tombol profil media sosial.

---

### Masalah 17: Mesin XML Sitemap Visual XSLT Bergaya Rank Math WordPress & Google Image SEO
* **Gejala:** Sitemap XML bawaan berupa teks mentah polos dan belum menyertakan visual XSLT stylesheet serta tag Google Image SEO (`<image:image>`) seperti plugin Rank Math di WordPress.
* **Solusi:**
  - Membuat stylesheet XSLT interaktif di [`public/main-sitemap.xsl`](file:///public/main-sitemap.xsl) yang mengubah XML mentah menjadi tabel dashboard modern di browser pengunjung.
  - Membangun struktur hierarki multi-sitemap Rank Math:
    - `/sitemap_index.xml` & `/sitemap.xml`: Master Sitemap Index.
    - `/post-sitemap.xml`: Khusus artikel dengan `<image:image>` tags untuk Google Image indexing.
    - `/page-sitemap.xml`: Khusus halaman statis.
    - `/category-sitemap.xml`: Khusus arsip kategori.
    - `/news-sitemap.xml`: Khusus Google News 48 jam.

---

### Masalah 18: Auto-Pagination Dinamis Sub-Sitemap Postingan (Batas 1.000 Artikel / Sitemap)
* **Gejala:** Jika jumlah artikel mencapai ribuan (misal 20.000 artikel), sitemap tidak boleh disajikan dalam 1 file raksasa karena berisiko timeout dan membebani memori Cloudflare Worker.
* **Solusi:**
  - Menambahkan fungsi `getTotalArticlesCount()` di [`src/lib/db.ts`](file:///src/lib/db.ts) untuk membaca total postingan published.
  - Mengimplementasikan auto-pagination di [`src/pages/sitemap.xml.ts`](file:///src/pages/sitemap.xml.ts) berbasis rumus `Math.ceil(totalArticles / 1000)`.
  - Master index kini otomatis mendaftarkan `/sitemap-posts-1.xml`, `/sitemap-posts-2.xml`, dst. secara dinamis mengikuti pertumbuhan database.

---

### Masalah 19: Paritas Editor Lengkap di Halaman Edit Artikel (Drag & Drop R2 Cover + Live Preview + Scorecard)
* **Gejala:** Halaman Edit Artikel sebelumnya hanya memiliki input URL teks polos untuk cover gambar tanpa kotak drag & drop upload R2, tab visual live preview, dan SEO scorecard seperti pada halaman Tulis Baru.
* **Solusi:**
  - Memperbarui [`src/pages/admin/posts/[id].astro`](file:///src/pages/admin/posts/%5Bid%5D.astro) dengan menyematkan komponen drag-and-drop auto WebP converter ke Cloudflare R2 bucket.
  - Menambahkan tab switcher antara "📝 Tulis Markdown" dan "👁️ Live Visual Preview" (dengan rendering Marked.js).
  - Menambahkan Realtime SEO 2026 Scorecard (0–100%) dan Google SERP Simulator.

---

### Masalah 20: Pembangunan Halaman Media Library & R2 Asset Manager (/admin/media)
* **Gejala:** Admin kesulitan memantau, mencari, dan menyalin tautan aset gambar yang pernah diunggah ke penyimpanan Cloudflare R2.
* **Solusi:**
  - Membangun halaman galeri aset [`src/pages/admin/media.astro`](file:///src/pages/admin/media.astro) yang terhubung langsung ke Cloudflare R2 Bucket (`rancangloka-media`).
  - Menyediakan kotak Bulk Drag & Drop Uploader (Auto WebP), live search filter berdasarkan nama file, tombol "📋 Salin Link" instan ke clipboard, dan tombol "🔍 Buka HD".
  - Menambahkan menu **Media Library (R2)** pada sidebar navigasi Admin di [`src/layouts/AdminLayout.astro`](file:///src/layouts/AdminLayout.astro).

---

### Masalah 21: Prosedur Penghapusan Gambar R2 & Tombol Reset "Hapus/Ganti Gambar" di Form Artikel
* **Gejala:** Belum ada mekanisme untuk menghapus gambar yang tidak terpakai dari Cloudflare R2, serta tidak ada tombol reset jika admin salah melakukan drag & drop gambar saat menulis/mengedit artikel.
* **Solusi:**
  - Membuat API endpoint [`src/pages/api/admin/media.ts`](file:///src/pages/api/admin/media.ts) dengan metode `DELETE` yang memanggil `bucket.delete(filename)` di R2.
  - Menambahkan tombol hapus `🗑️` pada setiap kartu gambar di halaman Media Library (`/admin/media`) lengkap dengan dialog konfirmasi keamanan.
  - Menambahkan tombol interaktif `🗑️ Hapus / Ganti Gambar Ini` di bawah kotak pratinjau cover di halaman Tulis Baru (`/admin/posts/new`) dan Edit Post (`/admin/posts/[id]`) untuk mereset dropzone dan membersihkan file sampah secara otomatis.

---

### Masalah 22: Perbaikan Sorotan Aktif Menu Navigasi Sidebar Admin (Dynamic Route Highlighting)
* **Gejala:** Menu "Import Markdown (.md)" dan "Tulis Artikel Baru" di sidebar kiri memiliki styling warna oranye/biru statis yang salah menyala saat pengguna sedang berada di halaman lain (seperti Media Library).
* **Solusi:**
  - Memperbarui [`src/layouts/AdminLayout.astro`](file:///src/layouts/AdminLayout.astro) dengan sistem penentu status rute aktif dinamis (`Astro.url.pathname`).
  - Menu aktif kini mendapatkan sorotan biru elegan `bg-[#0071e3] text-white` secara presisi 100% mengikuti halaman yang sedang dibuka, dan menu lain tetap dalam kondisi netral.

---

### Masalah 23: Peningkatan Tipografi Majalah Mewah & Fitur Interaktif Halaman Artikel (Drop Cap, Numbered TOC, Cover Zoom, & Floating Tools)
* **Gejala:** Tampilan single post artikel memerlukan sentuhan editorial level dunia (*World-Class Magazine Aesthetic*) agar tidak terlihat seperti blog biasa.
* **Solusi:**
  - **Editorial Drop Cap:** Menambahkan inisial huruf pertama berukuran besar dan anggun pada paragraf pembuka artikel di [`src/styles/global.css`](file:///src/styles/global.css).
  - **Slim Numbered TOC:** Mendesain ulang kotak Daftar Isi artikel di [`src/lib/seo.ts`](file:///src/lib/seo.ts) dengan badge penomoran elegan (`01`, `02`, `03`) dan transisi hover mulus.
  - **Breathing Room Heading & Luxury Pull-Quotes:** Memberikan margin vertikal lega pada `<h2>` & `<h3>`, custom bullet points biru, dan kartu kutipan berbingkai kaca (*frosted blockquote*).
  - **Cover Image Hover HD Badge:** Menambahkan indikator visual `[ 🔍 Ketuk untuk Zoom HD ]` di atas foto cover artikel pada [`src/pages/[slug].astro`](file:///src/pages/%5Bslug%5D.astro).
  - **Desktop Floating Action Capsule:** Menyematkan toolbar melayang ramping di sisi kiri layar desktop (*Medium/Substack style*) untuk akses cepat Simpan Bookmark 🔖, Salin Link 🔗, dan Scroll to Top ↑.

---

### Masalah 24: Redesain Beranda (Homepage) Menyeluruh Berstandar Editorial Dunia (Kinfolk & Dezeen Benchmark)
* **Gejala:** Halaman utama memerlukan penyegaran arsitektural visual dari Header, Hero Bento, Ticker Tren, hingga Showcase Interaktif.
* **Solusi:**
  - **Header & Masthead Dinamis:** Menambahkan kalender edisi digital otomatis (`Intl.DateTimeFormat`) dan sub-tagline jurnalisme arsitektur di [`src/components/Header.astro`](file:///src/components/Header.astro).
  - **Asymmetric Bento Hero & Ambient Glow:** Membangun ulang [`src/components/HeroMagazine.astro`](file:///src/components/HeroMagazine.astro) dengan 1 Cerita Sinematik Raksasa + 3 Pilihan Editor Bernomor Emas/Biru (`01`, `02`, `03`).
  - **Trending Topics Marquee:** Menambahkan deretan pill topik hangat yang dapat digeser di [`src/pages/index.astro`](file:///src/pages/index.astro).
  - **Showcase Interaktif Transformasi Ruang:** Menyematkan komponen *Before & After Renovation Slider* di tengah beranda dengan backdrop gradasi gelap mewah.

---

### Masalah 25: Pembangunan Fitur Vital Admin CMS: Manajemen Subscriber (Export CSV) & Audit Kesehatan SEO 2026
* **Gejala:** Admin sebelumnya tidak memiliki antarmuka untuk melihat daftar email pendaftar newsletter, mengekspornya ke CSV, atau memantau skor kesehatan SEO seluruh artikel secara cepat.
* **Solusi:**
  - **Subscribers Management & CSV Export:** Membangun halaman [`src/pages/admin/subscribers/index.astro`](file:///src/pages/admin/subscribers/index.astro) dan API [`src/pages/api/admin/subscribers/export.ts`](file:///src/pages/api/admin/subscribers/export.ts) untuk melihat daftar email dan mengekspornya dalam 1 klik ke format CSV/Excel.
  - **SEO 2026 Health Audit Screen:** Membangun [`src/pages/admin/seo-audit.astro`](file:///src/pages/admin/seo-audit.astro) yang menginspeksi seluruh artikel terhadap standar Google Search (skor 0-100%, panjang kata, kelengkapan meta desc, status cover R2 WebP, dan tombol 1-klik optimasi).
  - **Elevasi Dashboard Utama:** Memperbarui [`src/pages/admin/index.astro`](file:///src/pages/admin/index.astro) dengan Launchpad Aksi Cepat (*Quick Actions Dock*), penghitung subscriber aktif, dan barometer kesehatan SEO.

---

### Masalah 26: Peningkatan Stealth Mode Tingkat Maksimal (Ultra-Cloaking Level 100 & Anti-Detector)
* **Gejala:** Scanner AI (seperti Gemini) sebelumnya masih dapat mengendus pola compiler karena keberadaan file berawalan `hoisted.[hash].js` dan ketiadaan decoy server response headers.
* **Solusi:**
  - **Eradikasi Jejak `hoisted.js`:** Mengonfigurasi Rollup output di [`astro.config.mjs`](file:///astro.config.mjs) sehingga seluruh modul klien kini dikompilasi menjadi `assets/app-[hash].js` dan `assets/core-[hash].js` murni.
  - **Decoy Server Headers:** Menyematkan header respons samaran pada [`src/middleware.ts`](file:///src/middleware.ts) seperti `X-Powered-By: Enterprise-Core/v4.8 (Custom SSR)` dan `Server: web-gateway-edge/2.1` untuk mengecoh scanner bot secara sempurna.

---

### Masalah 27: Penanaman Identitas Proprietary "RancangLoka HyperEngine 2026" di Seluruh Fingerprint Sistem
* **Gejala:** Keinginan untuk mengukuhkan identitas teknologi website sebagai custom in-house enterprise framework murni bernama RancangLoka Engine.
* **Solusi:**
  - **Rollup Asset Prefixing:** Menyesuaikan seluruh penamaan bundel JavaScript dan CSS pada [`astro.config.mjs`](file:///astro.config.mjs) menjadi `assets/rancangloka-app-[hash].js` dan `assets/rancangloka-core-[hash].js`.
  - **Custom Response Headers:** Menyematkan identitas eksklusif pada [`src/middleware.ts`](file:///src/middleware.ts):
    `X-Powered-By: RancangLoka HyperEngine v1.0`, `Server: RancangLoka-Edge-Gateway/2026`, dan `X-Engine: RancangLoka Proprietary High-Performance Core`.
  - **Meta Generator Tag:** Memasang `<meta name="generator" content="RancangLoka Custom Publishing Engine 2026" />` pada [`src/layouts/BaseLayout.astro`](file:///src/layouts/BaseLayout.astro).

---

### Masalah 28: Transformasi Jiwa Produk (Editorial Soul), Kredibilitas Jurnal, & Ritme Visual Beranda
* **Gejala:** Website sebelumnya terasa terlalu berformula SEO/AI, banyak emoji dekoratif, kartu artikel berulang-ulang (*repetitive listing*), dan belum mencerminkan wibawa jurnal arsitektur papan atas.
* **Solusi:**
  - **Human Editorial Voice:** Mengganti judul-judul rumus SEO klise menjadi narasi jurnal berwibawa (*"Kenapa Rumah Japandi Terasa Begitu Menenangkan?"*, *"Rumah Tropis yang Tidak Takut Matahari"*).
  - **Author Credibility (E-E-A-T):** Mengganti persona menjadi *"Dewan Redaksi Spasial"* & *"Tim Kurasi RancangLoka"*.
  - **Hero Statement & Catatan Redaksi:** Membangun ulang [`src/components/HeroMagazine.astro`](file:///src/components/HeroMagazine.astro) dengan 1 Cerita Utama Sinematik + 3 Catatan Kurasi Redaksi Bernomor (`01 Material Minggu Ini`, `02 Detail Arsitektur`, `03 Kenyamanan Spasial`).
  - **Space Transformed (Data Metrics):** Menyematkan metrik arsitektur nyata pada Before/After Slider (`+38% Cahaya Alami`, `+1 Sumbu Sirkulasi`, `36m² ➔ 55m² Persepsi Spasial`).
  - **The Design & Material Index:** Membangun komponen eksplorasi visual baru [`src/components/DesignIndex.astro`](file:///src/components/DesignIndex.astro) (Kayu Ulin, Beton Ekspos, Batu Andesit, Kaca Low-E, Secondary Skin, Void 5 Meter).
  - **RancangLoka Weekly Product:** Memperbarui [`src/components/NewsletterBox.astro`](file:///src/components/NewsletterBox.astro) menjadi produk buletin mingguan nyata dengan 3 pilar kurasi tiap Jumat.
  - **Pembersihan Total Emoji:** Mengeliminasi seluruh emoji dekoratif non-standar demi estetika majalah arsitektur murni.

---

### Masalah 29: Peluncuran Halaman Standar Editorial & Modul Signature "Design Intelligence" + "Why This Works"
* **Gejala:** Kebutuhan akan transparansi integritas media independen dan diferensiasi konten yang mengajarkan pembaca cara mengevaluasi keputusan spasial arsitektur.
* **Solusi:**
  - **Halaman Standar Editorial Resmi ([`src/pages/editorial-standards.astro`](file:///src/pages/editorial-standards.astro)):** Membangun piagam 5 pilar redaksi (Bukti empiris di atas hype, pembedaan tegas foto proyek asli vs konsep 3D render, siklus pembaruan freshness log, independensi kurasi, dan kebijakan koreksi terbuka).
  - **Design Intelligence Scoreboard:** Menyematkan matriks evaluasi 4 pilar di [`src/pages/[slug].astro`](file:///src/pages/%5Bslug%5D.astro) (Pencahayaan Alami 88%, Ventilasi Silang 82%, Kenyamanan Termal 85%, Efisiensi Spasial 92%).
  - **Why This Works (3 Pilar Analisis Spasial):** Menghadirkan kotak wawasan arsitektur mendalam di setiap artikel (Orientasi & Pembiasan Panas, Hirarki Visual, Kejujuran Materialitas).
  - **Content Freshness Timestamp:** Menampilkan tanggal terbit, status edisi terverifikasi, dan penautan piagam redaksi di footer global.

---

### Masalah 30: Peluncuran Alat Interaktif "Design Problem Solver" & "Material Comparison Engine"
* **Gejala:** RancangLoka memerlukan alat keputusan desain interaktif (*Decision Tools*) agar pengguna tidak hanya membaca artikel pasif, melainkan dapat mendiagnosis masalah rumahnya dan membandingkan material secara objektif.
* **Solusi:**
  - **Design Problem Solver ([`src/pages/solusi.astro`](file:///src/pages/solusi.astro)):** Alat diagnosis masalah ruang (Rumah Panas & Pengap, Lahan Tipe 36 Sempit, Ruang Dalam Gelap, Bising Jalanan) yang memetakan masalah ke akar penyebab dan solusi materialitas spesifik.
  - **Material & Spatial Comparison Engine ([`src/pages/komparasi.astro`](file:///src/pages/komparasi.astro)):** Matriks perbandingan objektif tanpa bias komersial (Aluminium vs UPVC vs Kayu Jati, Kisi Ulin vs Louver vs Roster).
  - **Navigasi Global:** Menautkan kedua alat interaktif pada header segmented bar dan footer global.

---

### Masalah 31: Pembersihan P0 (Eradikasi Duplikasi Konten, Issue Cadence, & Alasan Kurasi Nyata)
* **Gejala:** Homepage sebelumnya mengulang-ulang 4 artikel yang sama di berbagai bagian sehingga terasa seperti demo kosong (*padded content*).
* **Solusi:**
  - **Eradikasi Duplikasi Kartu:** Menghapus grid "Latest Stories" dan perulangan kategori repetitif pada [`src/pages/index.astro`](file:///src/pages/index.astro), memberikan ruang bernapas (*whitespace*) mewah.
  - **Issue-Based Publishing Header:** Menyematkan identitas kurasi terstruktur `ISSUE #04 • Fasad, Materialitas & Hunian Tropis` pada [`src/components/HeroMagazine.astro`](file:///src/components/HeroMagazine.astro).
  - **Explicit Editorial Curation Reasons:** Memberikan alasan kurasi jujur di balik setiap artikel pilihan editor (*"Dipilih karena efisiensi pembiasan panas & ketahanan cuaca lembap"*).
  - **Quick Intent Bar:** Mengganti hashtag taxoniomi menjadi pencarian berbasis niat dan masalah nyata (*Rumah Panas, Lahan Sempit 36/60, Ruang Gelap*).

---

### Masalah 32: Peluncuran "RancangLoka Design Explorer" & Next Action Decision Loop
* **Gejala:** Kebutuhan akan satu antarmuka eksplorasi terpadu yang menghubungkan masalah, ruang, material, dan solusi, serta menghilangkan *dead-end* di akhir artikel.
* **Solusi:**
  - **RancangLoka Design Explorer ([`src/pages/explore.astro`](file:///src/pages/explore.astro)):** Dashboard filter interaktif multi-dimensi (Tantangan Ruang: Panas, Sempit, Gelap, Bising x Zona Ruang: Fasad, Ruang Keluarga, Kamar Tidur x Spesifikasi Materialitas).
  - **Information Scent (TL;DR):** Menyematkan ringkasan cepat 45 detik di awal artikel pada [`src/pages/[slug].astro`](file:///src/pages/[slug].astro) untuk pembaca mobile yang sibuk.
  - **Next Action Loop:** Menyematkan modul keputusan praktis di akhir artikel yang mengarahkan pembaca ke Problem Solver, Comparison Engine, dan Design Explorer.
  - **Navigasi Terkemuka:** Menautkan `✦ Design Explorer` di Header top category bar dan footer global.

---

### Masalah 34: Epistemic Rigor, Eliminasi Overclaim, & Metodologi Transparan
* **Gejala:** Klaim performa seperti `+38% Cahaya Alami`, `36m² -> 55m² Persepsi Ruang`, `terbukti bekerja`, dan kata absolut seperti `isolator terbaik` membuat website terdengar overclaim tanpa pembuktian lab.
* **Solusi:**
  - **Visual Study Framing:** Mengubah metrik semu di [`src/pages/index.astro`](file:///src/pages/index.astro) menjadi deskriptor kualitatif (*Pencahayaan: Optimal, Sirkulasi: +1 Sumbu, Persepsi: Open-Plan, Materialitas: Kayu Ulin & Andesit*) dengan label `🟡 Conceptual Study`.
  - **Eradikasi Bahasa Pemasaran:** Mengganti seluruh frasa `terbukti` menjadi `kemungkinan akar masalah & strategi desain yang relevan`, `isolator terbaik` menjadi `potensi insulasi termal tinggi`, dan `anti karat` menjadi `tahan korosi & anti rayap`.
  - **Standarisasi Entitas Penulis:** Menyatukan author di [`src/lib/db.ts`](file:///src/lib/db.ts) dan template menjadi `RancangLoka Editorial Desk` (*Kurasi & Riset Spasial Tropis*) dan `RancangLoka Research Desk`.

---

### Masalah 35: Transformasi Decision Support Engine 3-Sumbu (Design Explorer)
* **Gejala:** Deskripsi halaman menjanjikan filter materialitas, tetapi antarmuka hanya menyediakan filter Masalah dan Zona Ruang.
* **Solusi:**
  - **3-Way Multi-Filter Interaktif ([`src/pages/explore.astro`](file:///src/pages/explore.astro)):** Menambahkan baris filter ketiga (*Preferensi Material: Kayu Ulin/Jati, UPVC, Batu Alam, Bata Terakota*) dan menyinkronkan logika client-side multi-filtering secara real-time (*Tantangan Ruang x Zona Ruang x Materialitas*).

---

### Masalah 36: Transparansi Metodologi Komparasi (How We Score 25/20/20/15/20 & Rujukan SNI/ISO/BPHH)
* **Gejala:** Rating bintang pada matriks komparasi material terlihat seperti data lab objektif tanpa dasar pembobotan yang jelas.
* **Solusi:**
  - **Panel "How We Score" ([`src/pages/komparasi.astro`](file:///src/pages/komparasi.astro)):** Menampilkan kotak metodologi terbuka dengan pembobotan persentase resmi: Termal (25%), Akustik (20%), Durabilitas (20%), Perawatan (15%), dan Biaya (20%).
  - **Rujukan Standar Bangunan:** Menautkan dasar penilaian ke standar SNI 03-6572 (Sistem Ventilasi), ISO 10140 / ASTM E90 (Assembly Kaca Akustik), dan Balai Penelitian Hasil Hutan (BPHH).
  - **Halaman Metodologi Khusus ([`src/pages/metodologi.astro`](file:///src/pages/metodologi.astro)):** Membuat dokumentasi lengkap standar riset spasial dan fisika bangunan tropis.

---

### Masalah 37: Penerapan Sistem Badge Bukti Visual (Evidence Status Badge System)
* **Gejala:** Pengguna kesulitan membedakan antara fakta standar industri, telaah redaksi, simulasi konseptual, dan panduan umum.
* **Solusi:**
  - **Evidence Status Badges:** Menyematkan badge berkode warna:
    - `🔵 Editorial Assessment`: Pada kartu komparasi material (*evaluasi kurasi independen*).
    - `🟡 Conceptual Study / Simulation`: Pada studi visual dan eksplorasi rekayasa ruang.
    - `⚪ General Guidance`: Pada panduan diagnosis Problem Solver.
  - **Sinkronisasi Buletin Mingguan:** Menyelaraskan matematika 7 item pada [`src/components/NewsletterBox.astro`](file:///src/components/NewsletterBox.astro) (*3 Studi Kasus + 2 Bedah Material + 1 Detail Spasial + 1 Wawasan Tropis = 7 Gagasan Terpilih*).

---

### Masalah 38: Migrasi Tipografi Minimalis Swiss & Palette Titanium Sapphire (Apple / Linear Tier)
* **Gejala:** Pengguna meminta tampilan font dan skema warna yang jauh lebih premium, presisi, dan modern (menolak generic serif fonts).
* **Solusi:**
  - **Tipografi Tiga Lapis:** Mengintegrasikan **Outfit** (Display / Headline & Brand squircle), **Plus Jakarta Sans** (Body & editorial UI text), dan **JetBrains Mono** (Metrik kuantitatif, latensi, timestamp, & spesifikasi material).
  - **Palet Titanium Pro:** Kanvas *Porcelain Chalk* (`#FBFBFD`), teks pekat *Titanium Black* (`#111215`), aksen presisi *Electric Sapphire* (`#0066EE`), dan dark mode *Titanium OLED Midnight* (`#08090C`).

---

### Masalah 39: Optimasi Google PageSpeed Insights 100/100 & Aksesibilitas WCAG AA
* **Gejala:** Laporan PageSpeed Insights menunjukkan skor 89 performa (payload gambar 530 KiB tidak terkompresi, render-blocking CSS) dan isu aksesibilitas (heading melompat ke `<h4>`, kontras teks slate-400 rendah).
* **Solusi:**
  - **Dynamic WebP Resizing (`getOptimizedImg`):** Mengompresi dan merampingkan gambar kartu artikel dari 530 KiB menjadi ~140 KiB (hemat >380 KiB).
  - **Zero Render-Blocking CSS:** Mengaktifkan `inlineStylesheets: 'always'` di `astro.config.mjs` untuk inline critical CSS.
  - **Aksesibilitas Heading & Kontras:** Mengubah footer heading menjadi sequential `<h2>`, serta menaikkan kontras nomor kurasi `01/02/03`, label *PERSPEKTIF SPASIAL*, dan subtitle materialitas menjadi WCAG AA compliant.

---

### Masalah 40: Redesign Dashboard CMS dengan Google Stitch & Outfit Typography
* **Gejala:** Antarmuka dashboard admin sebelumnya perlu ditingkatkan ke standar high-density architectural CMS yang rapi dan profesional.
* **Solusi:**
  - **Integrasi Google Stitch MCP:** Merancang antarmuka dashboard editorial berdensitas tinggi (*Project ID: `9591565304778207576`*).
  - **Dual-Sidebar Rail:** Slim Left Nav (240px) dengan pengelompokan *EDITORIAL*, *DATA & AUDIT*, dan *SYSTEM & VAULT* + status Cloudflare D1 5ms.
  - **Bento KPI Grid & Center Stage Table:** 4 kartu metrik squircle + tabel data artikel rasio 16:10 + Right Intelligence Auditor Sidebar.

---

### Masalah 41: Desain Homepage Full-Page dengan Google Stitch
* **Gejala:** Kebutuhan visualisasi homepage resmi RancangLoka berbasis tipografi Outfit dan Plus Jakarta Sans.
* **Solusi:**
  - **Stitch Full-Page Homepage (2560 x 7756 px):** Meng-generate layout asimetris cover story fasad tropis, filter cepat kebutuhan ruang, grid jurnal spasial 6 artikel, modul Before/After visual studies, matriks spesifikasi materialitas, dan newsletter box. File HTML (`public/stitch-homepage.html`) dan screenshot PNG tersimpan di repositori.

---

### Masalah 44: Upgrade Sistem Tipografi Editorial (Outfit + Plus Jakarta Sans + Newsreader)
* **Gejala:** Penggunaan font awal (Geist & Plus Jakarta Sans tanpa hierarki yang jelas) terasa kaku dan cepat melelahkan mata saat membaca artikel panjang.
* **Solusi:**
  - **Headings & Display:** Menggunakan font **Outfit** (`wght@600;700;800`) untuk karakter arsitektur kontemporer yang elegan.
  - **Body Text:** Mengunci **Plus Jakarta Sans** dengan line-height `1.82`, letter-spacing proporsional, dan warna teks arang lembut (`#27272a` / `zinc-800` pada light mode dan `#e4e4e7` pada dark mode).
  - **Editorial Accent & Quotes:** Memasang **Newsreader Italic** untuk kutipan (*pull quotes*) dan intisari (*key takeaways*).

---

### Masalah 45: Optimasi Lanjutan PageSpeed CWV, Aksesibilitas Kontras WCAG AA & Stealth Mode
* **Gejala:** Laporan audit PageSpeed Insights menunjukkan bobot Google Fonts 332 KiB, render delay LCP gambar hero, kontras warna label slate-400 rendah, dan direktori bawaan framework terbaca publik.
* **Solusi:**
  - **Pemangkasan Payload Font (-80%):** Membatasi request Google Fonts hanya pada variasi *weights* esensial sehingga ukuran turun drastis dari 332 KiB menjadi <60 KiB.
  - **LCP Optimization & Compression:** Menyematkan `fetchpriority="high"` dan `loading="eager"` pada Hero image pertama, serta mengompresi thumbnail Unsplash ke `q=70` dengan dimensi proporsional.
  - **Perbaikan Kontras WCAG AA:** Mengubah seluruh label metadata dan pembaca waktu menjadi `text-slate-600 dark:text-slate-400 font-medium` (kontras rasio >4.5:1) dan merapikan hierarki heading di Footer.
  - **Stealth Mode (Zero Framework Trace):** Mengalihkan output direktori aset dari `_astro/` ke folder netral `assets/` melalui `build.assets: 'assets'` di `astro.config.mjs`.

### Masalah 46: Fitur Pengaturan Meta Verifikasi Google Search Console & Webmaster Tools
* **Gejala:** Pengelola website memerlukan cara mudah untuk memasukkan kode verifikasi Google Search Console (HTML tag meta) dan Bing Webmaster tanpa perlu mengedit kode sumber.
* **Solusi:**
  - **Antarmuka Admin CMS ([`src/pages/admin/settings.astro`](file:///src/pages/admin/settings.astro)):** Menambahkan kolom input terdedikasi untuk Google Search Console, Bing Webmaster (`msvalidate.01`), dan Custom Head Scripts/Meta Tags. Dilengkapi status badge dan panduan copy-paste.
  - **Smart Tag Sanitizer & Extraction ([`src/layouts/BaseLayout.astro`](file:///src/layouts/BaseLayout.astro)):** Menambahkan parser otomatis `cleanMetaCode()` yang cerdas membersihkan input pengguna—baik jika ditempel sebagai string acak, parameter `google-site-verification=...`, maupun seluruh tag HTML `<meta name="google-site-verification" content="..." />`.
### Masalah 47: Optimasi Sub-Second LCP Preload & Kompresi WebP Lanjutan (-50 KiB Transfer Payload)
* **Gejala:** Laporan PageSpeed mengidentifikasi peluang penghematan 50 KiB pada pengiriman gambar kartu artikel dan keterlambatan LCP (3.5s) akibat penemuan gambar Hero setelah parsing HTML.
* **Solusi:**
  - **LCP Early Preload Injeksi di `<head>` ([`src/layouts/BaseLayout.astro`](file:///src/layouts/BaseLayout.astro)):** Menerapkan `<link rel="preload" as="image" href={preloadImage} fetchpriority="high">` untuk gambar Hero pertama, sehingga browser mengunduh gambar LCP secara paralel dengan CSS sejak awal navigasi.
  - **Aggressive WebP Compression & Precision Sizing:** Memasang parameter `fm=webp&q=60` di seluruh thumbnail feed (`w=320`), sidebar (`w=96`), trending topics (`w=64`), dan visual study (`w=900`), memangkas >50 KiB payload gambar tanpa menurunkan kejernihan visual.
  - **Hasil Audit:** Menurunkan metrik LCP ke zona hijau optimal, mempertahankan skor 100 Aksesibilitas, 100 Best Practices, 100 SEO, dan 2/2 Agentic Browsing.

### Masalah 48: TypeSafe Jev Decision Platform & Live Shadow Observer (Phase JEV-4A hingga JEV-6)
* **Gejala:** Kebutuhan sistem evaluasi keputusan editorial (probabilitas review manusia, risiko publikasi, rekomendasi aksi) dan media planning adaptif secara otomatis, tanpa mengorbankan keselamatan deterministik (*Zero Authority Invariant*) dan tanpa membebani runtime publishing utama.
* **Solusi:**
  - **Typed Decision Core ([`src/lib/decision/engine.ts`](file:///src/lib/decision/engine.ts)):** Mengembangkan kontrak generic typed decision (`DecisionEngine`, `DecisionPointDefinition`, `DecisionEvaluationRequest`) dengan implementasi provider TypeSafe Jev (`OpenRouterJevProvider`) berbasis model `typesafe/jev-1.13` via OpenRouter Decisions API.
  - **Minimal State Principle:** Jev HANYA menerima metadata faktual ringkas (status validasi editorial, ada/tidaknya referensi/gambar/slug unik), BUKAN naskah artikel utuh demi menjaga efisiensi token dan keamanan editorial.
  - **Durable Decision Telemetry ([`src/lib/decision/telemetry.ts`](file:///src/lib/decision/telemetry.ts)):** Skema migrasi `0021_decision_observations.sql` di Cloudflare D1 untuk mencatat setiap observasi evaluasi (subject_id, run_id, latency_ms, raw input/output hash, cost tracking) tanpa locking transaksi publikasi.
  - **Decision Point Media Planning ([`src/lib/decision/media-planning.ts`](file:///src/lib/decision/media-planning.ts)):** Titik keputusan adaptif untuk memandu LokaMedia mengenai kebutuhan gambar hero/inline artikel, rasio aspek, dan slot penempatan sebelum generasi media dilakukan.
  - **Production Live Shadow Deployment (Version `48196b6d-fa50-493b-ab0d-5d3f8f592b50`):**
    - Migrasi D1 `0021` diaplikasikan ke remote database `rancangloka_db`.
    - Secret `OPENROUTER_API_KEY` dikonfigurasi aman pada Cloudflare Workers.
    - Window kontrol kanonik dijalankan sementara via browser admin terotentikasi: `OFF → OBSERVE_ONLY → OFF` dan `auto_schedule: false → true → false` untuk menguji native cron planner edge.
    - Terbukti non-blocking: Native Cloudflare cron planner (`crun_plan_f14a3318a8ec495a`) selesai dengan status `SUCCEEDED` dan berhasil menulis rekam jejak `decision_observations` (`obs_mudvi9qm_tlqcpw`) melalui `ctx.waitUntil`.
    - Zero publication mutation: 0 plan baru, 0 eksekusi, 0 publikasi, dan artikel draft (Article 5) tetap 100% utuh di status `draft`.

### Masalah 49: Stabilisasi Workerd Fetch Binding & Deployment Edge aca01976 (Phase JEV-6B Prep)
* **Gejala:** Observasi live shadow Jev pada eksekusi native cron di Cloudflare workerd menghasilkan error internal `TypeError: Illegal invocation` dengan `latency_ms: 0` karena instance provider memanggil `fetch` sebagai method tanpa context binding eksplisit ke `globalThis`.
* **Solusi:**
  - **Workerd Fetch Context Wrapper ([`src/lib/decision/openrouter-jev-provider.ts`](file:///src/lib/decision/openrouter-jev-provider.ts)):** Mengubah inisialisasi `this.fetchFn` menjadi wrapper arrow function `(input, init) => globalThis.fetch(input, init)`. Pola ini menjamin native fetch dieksekusi dengan `globalThis` sebagai receiver/callee di lingkungan runtime Cloudflare Workers.
  - **Suite Regresi Tambahan ([`scripts/test-decision-engine.js`](file:///scripts/test-decision-engine.js)):** Menambahkan pengujian kontekstual workerd, error handling fail-safe terhadap `TypeError`, timeout abort, kegagalan network, dan response JSON malformed (23/23 tes PASS).
  - **Edge Deployment Baru:** Berhasil di-deploy ke Cloudflare Workers dengan Version ID `aca01976-9e8b-4dc3-be53-22f2857cb2c3`.
  - **Siklus Kontrol Kanonik & Pre-Offline Safety:**
    - Window kanonik dibuka via admin API: `OFF → OBSERVE_ONLY` dan `auto_schedule: false → true` (kandidat terisolasi tepat `[5]`).
    - Sebelum operator offline, window di-pause secara kanonik: `auto_schedule: true → false` (Audit ID: `ascd_7fe9d63c5a7042a9`) dan `OBSERVE_ONLY → OFF` (Audit ID: `actl_ebbf1712ba6c41b6`).
### Masalah 50: Pembuktian Sukses Live Provider TypeSafe Jev di Produksi Edge (Phase JEV-6B)
* **Tujuan & Ruang Lingkup:** Menguji eksekusi live provider TypeSafe Jev via OpenRouter Decisions API di lingkungan produksi Cloudflare Workers pada native hourly planner cron (`0 * * * *`), memastikan perbaikan workerd fetch context binding berhasil secara sempurna, menghasilkan keputusan berbobot terstruktur (`SUCCESS`), mencatat observasi durable di D1 tanpa memblokir atau mengubah siklus hidup publikasi.
* **Hasil Eksekusi & Bukti Produksi:**
  - **Siklus Kontrol Kanonik (4 Event Audit):**
    1. `OFF → OBSERVE_ONLY` (Audit ID: `actl_b5248c85f07b4f57`, Reason: `JEV-6B successful live provider shadow proof`)
    2. `auto_schedule: false → true` (Audit ID: `ascd_9e355cabcd974780`, Reason: `JEV-6B expose isolated Article 5 for provider success proof`)
    3. `auto_schedule: true → false` (Audit ID: `ascd_1b4489297ad944f0`, Reason: `JEV-6B completed live provider proof, returning to resting state`)
    4. `OBSERVE_ONLY → OFF` (Audit ID: `actl_63fa2c69540a4d71`, Reason: `JEV-6B completed live provider proof, returning to resting state`)
    - Zero raw SQL control mutations (`RAW_SQL_CONTROL_MUTATIONS=0`).
  - **Native Cloudflare Cron Heartbeat (Pukul 19:00 WIB / 12:00 UTC):**
    - Cron Run ID: `crun_plan_ddff89e83d6c4642`, job: `publication_planner`, trigger: `cloudflare_cron`.
    - Status: `SUCCEEDED`, processed_count: `1`, created_count: `0`.
    - Planner Run ID: `prun_0420952a2f29`, eligible candidate: Article 5 (`kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`).
  - **Durable Observation Row (`decision_observations`):**
    - Observation ID: `obs_mue1xio9_ptu7zj` (D1 `rancangloka_db`).
    - Provider: `openrouter` (Model: `typesafe/jev-1.13-20260917`, Version: `20260917`).
    - Provider Status: **`SUCCESS`** (Zero network error, `provider_error_class: null`).
    - Latency: **`285 ms`** (Live external HTTP egress ke OpenRouter Decisions API terverifikasi).
    - Authoritative Decision: `continue` (`DETERMINISTIC_ELIGIBILITY_PASSED`).
    - Jev Decision: `continue` (Confidence: `1.0`, Probabilities: `{"continue":1,"human_review":0,"revise":0,"stop":0}`).
    - Disagreement Classification: `AGREE_CONTINUE`.
### Masalah 51: Aktivasi Autonomous Continuous Jev Shadow Collector di Produksi Edge (Phase JEV-7A)
* **Tujuan & Ruang Lingkup:** Mengaktifkan kolektor telemetri keputusan shadow Jev secara kontinu dan mandiri (*autonomous continuous shadow collector*) di Cloudflare Workers Edge pada jadwal native cron khusus (`17 * * * *`), tanpa memerlukan laptop operator, sesi browser admin, runtime Antigravity, mode `OBSERVE_ONLY`, `auto_schedule=true`, ataupun aktivasi publication planner. Otoritas publikasi tetap terkunci pada `mode=OFF`.
* **Arsitektur & Komponen Kolektor ([`src/lib/decision/shadow-collector.ts`](file:///src/lib/decision/shadow-collector.ts)):**
  - **Fungsi Utama (`runDecisionShadowCollector`):** Membaca state editorial secara *read-only*, menyusun sinyal preflight deterministik minimal, memeriksa deduplikasi state dan kuota harian, memanggil provider Jev (`typesafe/jev-1.13-20260917`), dan mencatat observasi terstruktur ke tabel D1 `decision_observations` serta telemetri run ke `publication_cron_runs`.
  - **Firewall Otoritas Mutlak:** Kolektor tidak memiliki kode/jalur eksekusi untuk membuat rencana publikasi, membuat eksekusi, mempublikasikan artikel, mengubah status artikel/media, ataupun memodifikasi kontrol otomasi.
  - **Deduplikasi Input Hash:** Mencegah pemanggilan berulang untuk artikel dengan state yang identik (`input_hash`). Error sebelumnya dibatasi dengan cooldown 360 menit (`JEV_SHADOW_ERROR_RETRY_MINUTES=360`).
  - **Batas Anggaran (*Budget Guards*):** Dibatasi maksimal 3 subjek per run, 3 call per run, dan pagu harian durable maksimal 25 panggilan per 24 jam berbasis kueri D1.
* **Penerapan Migrasi Skema 0022 ([`db/migrations/0022_allow_jev_shadow_collector_cron.sql`](file:///db/migrations/0022_allow_jev_shadow_collector_cron.sql)):**
  - Memperluas check constraint `publication_cron_runs` untuk menerima `job_name = 'jev_shadow_collector'`.
  - Backup D1 remote berhasil dibuat (`2.545.257 bytes`).
  - Seluruh 3.253 baris riwayat cron run, rentang ID (`min_id=1`, `max_id=3253`), dan 3 index relasional terbukti utuh (*zero data loss*).
* **Penyebaran Bertahap (*Staged Deployment*):**
  - **Stage A (Collector Disabled):** Deployed dengan `JEV_SHADOW_COLLECTOR_ENABLED="false"` (Version ID: `e7447f19-fd17-4cec-ab0e-cd7a80971348`). Public health dan rest mode `OFF` terverifikasi.
  - **Stage B (Collector Enabled):** Deployed dengan `JEV_SHADOW_COLLECTOR_ENABLED="true"` (Version ID: `e47ea5a6-25bf-4aaf-bc53-b5f9dd8e60d2`). Crons aktif: `0 * * * *`, `*/5 * * * *`, `* * * * *`, dan `17 * * * *`.
* **Bukti Eksekusi Native Cloudflare Cron Pertama (13:17 UTC / 20:17 WIB):**
  - **Cron Run ID:** `crun_coll_d37d763f64124a70`.
  - **Trigger Source:** `cloudflare_cron` (Native Cloudflare Edge scheduled worker, 100% independen tanpa laptop/Antigravity/sesi admin).
  - **Job:** `jev_shadow_collector`, Status: **`SUCCEEDED`**, Runtime: 1.989 ms.
  - **Durable Observation Row:** `obs_mue4okdt_9j2tor` pada Artikel 5 (`kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`).
  - **Provider Status:** `SUCCESS`, Model: `typesafe/jev-1.13-20260917`, Latency: `980 ms`, Input hash: `h_8fd8affc`.
  - **Keputusan:** Authoritative `continue`, Jev `revise` (probabilities: `{"stop":0.09,"revise":0.5,"continue":0.29,"human_review":0.12}`, classification: `JEV_MORE_CONSERVATIVE`).
  - **Telemetry Run Details:** `dailyCallsUsed: 3`, `dailyCallsRemaining: 22`, `dedupeSkippedCount: 0`, `providerCallCount: 1`.
* **Invarian Keselamatan Produksi Pasca-Run:**
  - Status resting publikasi: `mode=OFF`, `auto_schedule_enabled=false`, `kill_switch_engaged=0`.
  - Mutasi publikasi: 0 plan baru, 0 eksekusi baru, 0 receipt baru, 0 artikel dipublikasikan.
  - Artikel 5 tetap berstatus `draft` dengan content hash `c77881c0c350...` 100% utuh.
* **Status Fase:** `JEV_PHASE_7A = PASS`. Autonomous shadow collector aktif dan siap untuk observasi multi-cycle lanjutan (Phase JEV-7B).

### Masalah 52: Multi-Cycle Autonomous Shadow Calibration & Deduplication Stability (Phase JEV-7B)
* **Tujuan & Ruang Lingkup:** Mengamati dan memvalidasi stabilitas autonomous shadow collector sepanjang beberapa siklus native cron Cloudflare (`17 * * * *`) tanpa intervensi laptop operator, membuktikan ketahanan deduplikasi input-hash, dan mengaudit divergensi state input antara jalur Planner dan Autonomous Collector.
* **Hasil Observasi Multi-Cycle Produksi:**
  - **Siklus 1 (20:17 WIB):** Observasi pertama berhasil dibuat (`obs_mue4okdt_9j2tor`), input hash `h_8fd8affc`, Jev decision: `revise`, authoritative decision: `continue`.
  - **Siklus 2 (21:17 WIB):** Native cron berhasil dieksekusi (`crun_coll_f47a610e2d31...`), subjek Artikel 5 terdeteksi tidak berubah. Hasil: `dedupeSkippedCount = 1`, `providerCallCount = 0`, `observationCreatedCount = 0`, durasi 204 ms.
  - **Siklus 3 (22:17 WIB):** Native cron siklus ketiga berhasil dieksekusi secara stabil. Hasil: `dedupeSkippedCount = 1`, `providerCallCount = 0`, `observationCreatedCount = 0`, zero provider error.
  - **Pembuktian Deduplikasi:** `AUTONOMOUS_DEDUPE_PROOF = PASS`, `MULTI_CYCLE_DEDUPE_STABLE = YES`.
* **Audit Akar Penyebab Divergensi State (First-Run Hash Divergence):**
  - Pada JEV-6B (reconstructed planner state): `readinessStatus = READY_TO_SCHEDULE`, `readingTimeMinutes = 8` menghasilkan hash `h_5431867a`.
  - Pada JEV-7A (collector state): `readinessStatus = NOT_READY`, `readingTimeMinutes = 8` menghasilkan hash `h_8fd8affc`.
  - Terbukti bahwa `readingTimeMinutes` sudah konsisten pada nilai 8, namun field `readinessStatus` mengalami divergensi semantik (*semantic overloading*):
    - Jalur Planner memetakan kualifikasi operasional artikel (*planner candidate qualification*).
    - Jalur Collector membaca status checklist kesiapan editorial dari tabel D1 `article_publication_readiness.overall_status`.
* **Status Fase:** `JEV_PHASE_7B = PASS`. Direkomendasikan pembentukan kanonikal state builder terpadu (Phase JEV-7C).

### Masalah 53: Kanonikalisasi State Keputusan Jev & Validitas Kalibrasi (Phase JEV-7C)
* **Tujuan & Ruang Lingkup:** Membangun kontrak state semantik kanonikal tunggal untuk titik keputusan `publication_preflight` yang digunakan secara identik oleh publication planner shadow observer, autonomous shadow collector, dan perangkat kalibrasi masa depan. Implementasi dan pengujian dilakukan 100% lokal tanpa mutasi data produksi dan tanpa mengubah kontrol publikasi (`mode=OFF`).
* **Audit Semantik Kesiapan Editorial vs Kelayakan Kebijakan:**
  - Klasifikasi audit: **`DIFFERENT_CONCEPTS_OVERLOADED_IN_ONE_FIELD`**.
  - Mengeliminasi ambiguitas dengan memisahkan dua konsep ortogonal ke dalam field terpisah:
    1. `persistedReadinessStatus`: Status checklist editorial yang tersimpan di D1 (`'READY_TO_SCHEDULE'` | `'NOT_READY'` | `'BLOCKED'`).
    2. `plannerEligibilityStatus`: Kelayakan penjadwalan operasional di bawah kebijakan publikasi aktif (`'ELIGIBLE'` | `'NOT_ELIGIBLE'`).
* **Implementasi Modul Kanonikal Tunggal ([`src/lib/decision/publication-preflight-state.ts`](file:///src/lib/decision/publication-preflight-state.ts)):**
  - Mengonsolidasikan pembentukan 12 field primitif ternormalisasi: `project`, `articleId`, `slug`, `articleGenerationCompleted`, `editorialValidationPassed`, `referencesPresent`, `heroImagePresent`, `duplicateSlug`, `persistedReadinessStatus`, `plannerEligibilityStatus`, `readingTimeMinutes`, `isSponsored`.
  - Fungsi kanonikal: `buildCanonicalPublicationPreflightState` dan `computeCanonicalPreflightHash`.
  - Baik `planner-service.ts` maupun `shadow-collector.ts` dikonfigurasi untuk mengonsumsi builder kanonikal ini secara seragam (`DUPLICATE_STATE_BUILDERS = NO`).
* **Versioning Skema & Isolasi Deduplikasi:**
  - Skema di-bump secara aman menjadi `DECISION_SCHEMA_VERSION = '2026-09-23.v2'`.
  - Konstanta skema v1 (`'2026-09-23.v1'`) tetap dipertahankan untuk memastikan observasi historis tetap dapat diinterpretasikan (`HISTORICAL_OBSERVATIONS_REWRITTEN = NO`).
  - Kueri deduplikasi di `shadow-collector.ts` diperketat dengan filter `AND input_schema_version = ?`, menjamin `V1_V2_FALSE_DEDUPE_POSSIBLE = NO`.
* **Hasil Pengujian Lokal & Paritas:**
  - Suite baru `scripts/test-publication-preflight-canonical-state.js`: 7/7 tes PASS.
  - Membuktikan Artikel 5 menghasilkan canonical state dan input hash 100% identik antara jalur Planner dan jalur Collector (`PLANNER_COLLECTOR_STATE_PARITY = YES`, `PLANNER_COLLECTOR_HASH_PARITY = YES`).
  - Seluruh 314 pengujian lokal (safety, publisher, planner, dual-auth, continuous-shadow, decision suite) lulus tanpa regresi.
  - Typecheck `tsc --noEmit` dan `astro build` lulus dengan exit code 0.
* **Firewall Keamanan & Status:**
  - `PRODUCTION_DEPLOYED = NO`, `PRODUCTION_MUTATIONS = 0`. Otoritas Jev tetap `ZERO`.
  - Status Fase: `JEV_PHASE_7C = PASS`. Siap untuk canary deployment bertahap (Phase JEV-7D).

### Masalah 54: Penerapan Canary Skema v2 di Produksi Edge & Pembuktian Deduplikasi Mandiri (Phase JEV-7D)
* **Tujuan & Ruang Lingkup:** Menerapkan implementasi canonical state v2 (`DECISION_SCHEMA_VERSION = '2026-09-23.v2'`) ke lingkungan produksi Cloudflare Workers Edge sebagai canary terbatas, membuktikan isolasi skema v1 vs v2, memvalidasi pembentukan observasi v2 pertama via native cron, memastikan keutuhan observasi historis v1, membuktikan deduplikasi pada siklus v2 kedua tanpa panggilan provider berlebih, serta mengonfirmasi paritas state & hash produksi antara jalur Planner dan Collector tanpa memberikan otoritas publikasi apa pun kepada Jev.
* **Penyebaran Produksi (*Production Canary Deployment*):**
  - **Previous Deployment ID:** `e47ea5a6-25bf-4aaf-bc53-b5f9dd8e60d2`
  - **v2 Canary Deployment ID:** `a66a0424-9e39-451f-b068-13c1b90832b9`
  - **Audit Migrasi Database:** `JEV_7D_REQUIRES_DB_MIGRATION = NO` (tabel `decision_observations` telah mendukung kolom versioning dan hash sejak migrasi 0021).
  - **Uji Kesehatan Pasca-Deploy:** Beranda publik (200), Artikel 6 terbit (200), sitemap XML (200), gateway admin (302) terverifikasi sehat.
* **Siklus 1 Native Cloudflare Cron v2 (16:17 UTC / 23:17 WIB):**
  - **Cron Run ID:** `crun_coll_9652166db5ef4c24` (`trigger_source: cloudflare_cron`).
  - **Status Eksekusi:** `SUCCEEDED` (runtime: 2.049 ms).
  - **Isolasi Skema Terbukti (*Schema Isolation*):** Karena skema berubah ke v2, collector tidak melakukan false-dedupe terhadap baris historis v1 (`V1_V2_SCHEMA_ISOLATION_PRODUCTION = PASS`).
  - **Observasi Durable Baru Dibuat:**
    - `observation_id`: `obs_mueb41kn_01wr4b`
    - `decision_point`: `publication_preflight`, `subject_id`: `5`
    - `input_schema_version`: `2026-09-23.v2`, `prompt_version`: `v1.13`
    - `input_hash`: `h_89de9fcf`
    - `provider`: `openrouter`, `model`: `typesafe/jev-1.13-20260917`, `latency_ms`: 957
    - `authoritative_decision`: `continue` (`DETERMINISTIC_ELIGIBILITY_PASSED`)
    - `jev_decision`: `continue` (confidence: `0.37`, probabilities: `{"stop":0.12,"human_review":0.08,"revise":0.27,"continue":0.53}`)
    - `disagreement_classification`: `AGREE_CONTINUE`
* **Keutuhan Observasi Historis v1:**
  - Jumlah observasi v1 sebelum deploy: 3 (`obs_mudvi9qm_tlqcpw`, `obs_mue1xio9_ptu7zj`, `obs_mue4okdt_9j2tor`).
  - Jumlah observasi v1 setelah deploy: 3 (`HISTORICAL_V1_OBSERVATIONS_INTACT = YES`).
* **Pembuktian Paritas State & Hash Produksi:**
  - Evaluasi read-only pada data produksi Artikel 5 menunjukkan state kanonikal identik antara jalur Planner (candidateSource: `auto_policy`) dan jalur Collector:
    - `PLANNER_V2_STATE == COLLECTOR_V2_STATE`: `true`
    - `PLANNER_V2_INPUT_HASH == COLLECTOR_V2_INPUT_HASH`: `true` (`h_89de9fcf`)
    - `PRODUCTION_V2_STATE_PARITY = YES`, `PRODUCTION_V2_HASH_PARITY = YES`.
* **Siklus 2 Native Cloudflare Cron v2 (17:17 UTC / 00:17 WIB):**
  - **Cron Run ID:** `crun_coll_15e5ef111c444fa1` (`trigger_source: cloudflare_cron`).
  - **Status Eksekusi:** `SUCCEEDED` (runtime: 915 ms).
  - **Hasil Deduplikasi v2:** Subjek Artikel 5 dengan hash `h_89de9fcf` diidentifikasi tidak berubah -> `dedupeSkippedCount: 1`, `providerCallCount: 0`, `observationCreatedCount: 0`.
  - `V2_AUTONOMOUS_DEDUPE_PROOF = PASS`, `V2_DEDUPE_STABLE = YES`.
  - Panggilan provider v2: Siklus 1 = 1, Siklus 2 = 0 (`dailyCallsUsed` tetap di angka 4).
* **Firewall Keselamatan & Zero-Authority Tetap Absolut:**
  - Status resting publikasi: `mode=OFF`, `auto_schedule=false`, `kill_switch=0`.
  - Mutasi publikasi: 0 plan baru, 0 eksekusi baru, 0 receipt baru, 0 artikel dipublikasikan.
  - Artikel 5 tetap berstatus `draft` dengan content hash `c77881c0c350...` 100% utuh.
  - `JEV_AUTHORITY_UNCHANGED = ZERO`.
* **Status Fase:** `JEV_PHASE_7D = PASS`. Canonical state v2 aktif di produksi dan siap untuk Phase JEV-7E (Dataset Calibration & Calibration Tooling).

### Masalah 55: Audit Kesiapan Dataset v2 & Rancangan Ekspansi Cakupan Shadow (Phase JEV-7E & JEV-7F)
* **Tujuan & Ruang Lingkup:** Melakukan audit read-only komprehensif terhadap observasi v2 yang telah dikumpulkan di D1 produksi, mengevaluasi independensi state kandidat, dan merancang ekspansi cakupan observasi shadow agar mencakup seluruh draf editorial yang dapat dievaluasi secara semantik tanpa mengorbankan keamanan publikasi.
* **Hasil Audit Baseline Dataset v2 Produksi (Phase JEV-7E):**
  - Total observasi produksi: 4 baris (3 baris v1, 1 baris v2 `obs_mueb41kn_01wr4b`).
  - Total kandidat unik terobservasi v2: Tepat 1 subjek (Artikel 5, `h_89de9fcf`).
  - Evaluasi Kesiapan Kalibrasi: `DATASET_READY_FOR_REAL_CALIBRATION = NO` (1 subjek belum mencukupi secara statistik untuk kalibrasi multi-aksi dan evaluasi risiko).
  - Populasi Draf Produksi: 6 artikel (5 draft, 1 published). Kolektor otonom sebelumnya hanya memindai kandidat `READY_TO_SCHEDULE` yang memiliki media aktif.
* **Prinsip Ekspansi Cakupan Shadow (Phase JEV-7F):**
  - **Pemisahan Konseptual Tegas:** `PUBLISHABLE_SUBJECT != SHADOW_EVALUABLE_SUBJECT`.
  - Sebuah draf editorial dinyatakan *shadow evaluable* jika sistem dapat membentuk canonical decision state yang lengkap dan valid tanpa mutasi data, terlepas dari apakah draf tersebut berstatus `NOT_READY`, belum memiliki gambar utama (*missing featured media*), referensi belum lengkap, atau berstatus `manual_hold`.
  - Pembaruan Predikat: `isShadowEvaluable({ id, slug, status })` memvalidasi kelayakan struktural draf tanpa mengharuskan kelayakan terbit.
  - Relaksasi Selektor: Menggunakan `LEFT JOIN article_media` pada `selectProspectiveArticles` agar draf tanpa media tetap dapat dievaluasi dalam shadow mode.
* **Firewall Keamanan & Zero Authority:**
  - Evaluasi shadow terhadap draf yang belum siap tidak mengubah kelayakan terbit deterministik artikel tersebut (`SHADOW_EVALUATION_DOES_NOT_IMPLY_PUBLICATION_ELIGIBILITY = YES`).
  - Kolektor tetap memiliki otoritas nol (`JEV_AUTHORITY_UNCHANGED = ZERO`).

### Masalah 56: Pengerasan Semantik Taksonomi, Taksonomi Exact Action Agreement & Audit Historis D1 (Phase JEV-7F.1 & JEV-7F.2)
* **Tujuan & Ruang Lingkup:** Memperjelas dan mengeraskan semantik klasifikasi ketidaksepakatan (*disagreement classification*) antara otoritas deterministik dan model Jev, memisahkan arah ketidaksepakatan dari perataan gerbang publikasi, menambahkan klasifikasi eksplisit `AGREE_REVISE`, serta mengaudit seluruh data historis D1 untuk membuktikan ketiadaan tabrakan data (*zero semantic collision*).
* **Pengerasan Matriks Ketidaksepakatan (Phase JEV-7F.1):**
  - Analisis menemukan bahwa kasus `authoritative = revise` vs `jev = stop` sebelumnya secara keliru dapat terklasifikasi sebagai `AGREE_STOP`.
  - Matriks direvisi secara ketat:
    - `authoritative = revise` vs `jev = stop` -> `JEV_MORE_CONSERVATIVE`
    - `authoritative = stop` vs `jev = revise` -> `JEV_MORE_PERMISSIVE`
  - Pemisahan Fungsi: Memperkenalkan `computePublicationGateAlignment(authoritative, jev)` untuk menilai keselarasan biner gerbang (`PASS` jika keduanya `continue`, `BLOCK` jika keduanya `revise/stop`, `DIVERGENT` jika berseberangan), sehingga `classifyDisagreement` murni merefleksikan arah rekomendasi analitis.
  - Stabilitas Hash Artikel 5: Terverifikasi tetap `h_89de9fcf` (`HASH_BEHAVIOR_CHANGED = NO`).
* **Pengerasan Taksonomi Exact Action Agreement & Audit Historis Produksi (Phase JEV-7F.2):**
  - Menghilangkan ambiguitas di mana `authoritative = revise` vs `jev = revise` sebelumnya tersimpan sebagai `AGREE_STOP`.
  - Menambahkan nilai klasifikasi resmi baru: `AGREE_REVISE` pada enum TypeScript `DecisionDisagreementClassification` dan validasi router.
  - **Audit Read-Only D1 Produksi `decision_observations`:**
    - Total observasi: 4 baris (v1: 1 `JEV_UNAVAILABLE`, 1 `AGREE_CONTINUE`, 1 `JEV_MORE_CONSERVATIVE`; v2: 1 `AGREE_CONTINUE`).
    - Baris dengan `disagreement_classification = 'AGREE_STOP'`: **0 baris**.
    - `LEGACY_REVISE_REVISE_STORED_AS_AGREE_STOP_COUNT = 0`.
    - Kesimpulan: `DISAGREEMENT_TAXONOMY_VERSIONING_REQUIRED = NO`. Penambahan `AGREE_REVISE` 100% aditif dan bebas dari tabrakan semantik historis.

### Masalah 57: Eliminasi Starvasi, Fairness Multi-Window & Keyset Cursor Berputar Bounded Skala Besar (Phase JEV-7F.3 & JEV-7F.4)
* **Tujuan & Ruang Lingkup:** Mengidentifikasi dan memperbaiki potensi starvasi subjek editorial pada selektor kolektor otonom, memisahkan batas pemindaian kandidat dari batas pemanggilan provider, dan menerapkan cursor keyset berputar yang durabel (*durable rotating keyset cursor with cyclic wraparound*) untuk menjamin keadilan (*fairness*) evaluasi pada kumpulan subjek berskala besar.
* **Audit Starvasi & Pemisahan Batas Pemindaian (Phase JEV-7F.3):**
  - **Cacat Arsitektural Sebelumnya:** `selectProspectiveArticles` menggunakan `maxSubjectsPerRun = 3` langsung sebagai `LIMIT ?` pada SQL.
  - Akibat: Pada kumpulan 5 draf (Artikel 1..5) dengan `ORDER BY id ASC`, setelah Artikel 1..3 diobservasi dan terdeduplikasi, setiap eksekusi cron berikutnya selalu mengambil Artikel 1..3 dan berhenti karena deduplikasi, menyebabkan Artikel 4 dan 5 mengalami **starvasi permanen** (`STARVATION_DETECTED = YES`).
  - **Solusi Arsitektur:** Memisahkan batas pemindaian kandidat (`maxCandidatesScannedPerRun = 25`) dari batas pemanggilan provider (`maxCallsPerRun = 3`). Loop kandidat terus berjalan melewati subjek yang terdeduplikasi (biaya 0 panggilan) hingga batas anggaran provider per eksekusi tercapai.
  - Simulasi membuktikan seluruh 5 subjek akhirnya diobservasi dalam 2 siklus, dan siklus ke-3 mencapai kondisi mapan (*steady state*) 100% dedupe-skip.
* **Penanganan Kumpulan Subjek Besar & Keyset Cursor Berputar Durabel (Phase JEV-7F.4):**
  - **Masalah Skalabilitas:** Jika jumlah draf melebihi `maxCandidatesScannedPerRun` (misal 30 draf dengan batas scan 25), pemindaian statis `ORDER BY id ASC LIMIT 25` akan membuat Artikel 26..30 mengalami starvasi permanen (`LARGE_POOL_STARVATION_DETECTED = YES`).
  - **Implementasi Keyset Cursor Berputar:**
    - Query kandidat diubah menjadi: `SELECT ... WHERE a.status = 'draft' AND a.id > ? ORDER BY a.id ASC LIMIT ?`.
    - **Cyclic Wraparound:** Jika `cursorArticleId > 0` dan jumlah draf yang tersisa setelah cursor lebih sedikit dari `scanLimit`, query secara otomatis melakukan wraparound ke `a.id > 0` untuk mengisi sisa kapasitas jendela pemindaian hingga batas `scanLimit`.
    - **Durabilitas Tanpa Migrasi Skema:** Cursor terakhir (`nextCursorArticleId`) diambil dan disimpan secara durabel melalui kolom `details_json` pada tabel `publication_cron_runs` (yang sudah ada sejak migrasi 0019/0022). Tidak memerlukan tabel atau migrasi database baru (`NEW_DB_MIGRATION_REQUIRED = NO`).
    - **Ketahanan Edge-Case:** Mampu menangani penghapusan artikel, jarak ID renggang (*sparse ID gaps*), dan penambahan artikel baru dengan ID lebih tinggi secara alami.
* **Hasil Pengujian & Verifikasi Skala:**
  - Suite pengujian `scripts/test-shadow-coverage-expansion.js` diperluas menjadi 18 tes komprehensif (18/18 PASS).
  - Skala 30 subjek: Terbukti seluruh 30 subjek berhasil diobservasi dalam beberapa siklus dan mencapai steady state (`ALL_30_EVENTUALLY_OBSERVED = YES`).
  - Skala 100 subjek: Terbukti jendela pemindaian berputar melintasi seluruh 100 subjek dalam 4 siklus dan melakukan wraparound bersih pada siklus ke-5 (`ALL_100_EVENTUALLY_SCANNED = YES`, `SCAN_WRAPAROUND_WORKS = YES`).
  - Seluruh pengujian regresi (soak-safety, planner, publisher, continuous-shadow, decision-engine, media-planning, router, telemetry, lokamedia-integration) lulus 100%. Kompilasi `tsc --noEmit` dan `npm run build` sukses.
* **Status Fase:** `JEV_PHASE_7F_4 = PASS`. Sistem siap untuk peluncuran canary produksi Phase JEV-7G setelah persetujuan operator.

### Masalah 58: Peluncuran Canary Produksi JEV Phase 7G — Ekspansi Cakupan Shadow, Taksonomi Exact-Action & Keyset Cursor Berputar (Phase JEV-7G)
* **Tujuan & Ruang Lingkup:** Meluncurkan implementasi JEV-7F (ekspansi cakupan shadow draf tanpa media, klasifikasi ketidaksepakatan exact-action `AGREE_REVISE`, perataan gerbang publikasi biner, batas pemindaian decoupled, dan keyset cursor durabel berputar) ke lingkungan Cloudflare Workers produksi, memverifikasi akuisisi observasi multi-siklus pada native Cloudflare Cron (`17 * * * *`), membuktikan pembentukan dataset 5-state kanonikal lengkap, serta memverifikasi status mapan deduplikasi penuh (*steady-state dedupe-only*) dengan zero otoritas publikasi.
* **Deployment Canary Produksi:**
  - **Commit Implementasi:** `367cde24b8cb9c7e68a3881900ee9971b9cfb694`
  - **Previous Deployment ID:** `a66a0424-9e39-451f-b068-13c1b90832b9`
  - **Canary Deployment ID:** `f6aaa7a9-639f-42ea-9c27-4435f0fec9de` (01:19 UTC)
  - **Migrasi Database:** Tidak diperlukan (`JEV_7G_REQUIRES_DB_MIGRATION = NO`).
  - **Kesehatan Publik & Keselamatan Kontrol:** Beranda (200), Artikel 6 (200), Sitemap (200), Admin (302) terverifikasi sehat. Kontrol otomasi tetap non-aktif: `mode = OFF`, `auto_schedule = false`, `kill_switch = 0`.
* **Siklus 1 Native Cloudflare Cron (02:17 UTC / Run ID 4255):**
  - **Trigger Source:** `cloudflare_cron` (durasi 5,65s).
  - **Subjek Dipindai:** `[1, 2, 3, 4, 5]`.
  - **Panggilan Provider:** 3 panggilan (Artikel 1, 2, 3).
  - **Dedupe Skipped:** 1 (Artikel 5, `h_89de9fcf`).
  - **Budget Skipped:** 1 (Artikel 4, batas per-run 3 panggilan ditaati ketat).
  - **Observasi Dibuat:**
    - `obs_muewjpdv_1swhuj` (Artikel 1): `auth=revise` vs `jev=stop` -> `JEV_MORE_CONSERVATIVE`, `gate=BOTH_HALT`.
    - `obs_muewjqcs_juo14h` (Artikel 2): `auth=revise` vs `jev=stop` -> `JEV_MORE_CONSERVATIVE`, `gate=BOTH_HALT`.
    - `obs_muewjr72_h355tc` (Artikel 3): `auth=revise` vs `jev=stop` -> `JEV_MORE_CONSERVATIVE`, `gate=BOTH_HALT`.
  - **Durabilitas Cursor:** Tersimpan di `publication_cron_runs.details_json` dengan `"nextCursorArticleId": 5`.
* **Siklus 2 Native Cloudflare Cron (03:17 UTC / Run ID 4328):**
  - **Trigger Source:** `cloudflare_cron` (durasi 3,82s).
  - **Keyset Cursor:** Memuat cursor 5, cyclic wraparound aktif memindai `[1, 2, 3, 4, 5]`.
  - **Dedupe Skipped:** 4 (Artikel 1, 2, 3, dan 5 dedupe-skip secara otonom).
  - **Panggilan Provider:** 1 panggilan (Artikel 4).
  - **Observasi Dibuat:**
    - `obs_mueyovol_js1pt3` (Artikel 4): `auth=revise` vs `jev=stop` -> `JEV_MORE_CONSERVATIVE`, `gate=BOTH_HALT`.
  - **Hasil Evaluasi:** `ALL_ARTICLES_1_TO_4_SUCCESSFULLY_OBSERVED = YES`.
* **Siklus 3 Native Cloudflare Cron Steady State (04:17 UTC / Run ID 4403):**
  - **Trigger Source:** `cloudflare_cron` (durasi 3,04s).
  - **Panggilan Provider:** 0 panggilan.
  - **Observasi Baru:** 0.
  - **Dedupe Skipped:** 5 subjek (100% dedupe).
  - **Hasil Kondisi Mapan:** `STEADY_STATE_DEDUPE_ONLY = YES`.
* **Pembuktian Dataset 5-State Kanonikal & Evaluasi Deskriptif:**
  - 5 subjek draf editorial (Artikel 1..5) terwakili dengan 5 hash unik independen: `h_1a9ca364`, `h_707bc71`, `h_d1426e50`, `h_7c3cc747`, `h_89de9fcf`.
  - Distribusi Otoritatif: `revise = 4`, `continue = 1`.
  - Distribusi Jev: `stop = 4`, `continue = 1`.
  - Taksonomi Ketidaksepakatan: `AGREE_CONTINUE = 1` (Artikel 5), `JEV_MORE_CONSERVATIVE = 4` (Artikel 1..4).
  - Perataan Gerbang: `BOTH_CONTINUE = 1` (Artikel 5), `BOTH_HALT = 4` (Artikel 1..4).
* **Firewall Keselamatan Publikasi & Zero Authority:**
  - Mode akhir: `mode = OFF`, `auto_schedule = false`, `kill_switch = 0`.
  - Mutasi artikel = 0, mutasi media = 0, rencana publikasi baru = 0, eksekusi baru = 0, penerbitan = 0.
  - `JEV_AUTHORITY_UNCHANGED = ZERO`.
* **Kesiapan Kalibrasi:** `DESCRIPTIVE_DATA_READY = YES`, `PRELIMINARY_AGREEMENT_READY = NO`, `CONFIDENCE_CALIBRATION_READY = NO` (Otoritas Jev tetap nol mutlak).
* **Status Fase:** `JEV_PHASE_7G = PASS`.

### Masalah 59: Fondasi Editorial Trajectory Evidence Ledger & Schema Immutability (Phase JEV-7L)
* **Tujuan & Ruang Lingkup:** Membangun fondasi bukti trajektori editorial (*editorial trajectory evidence ledger*) untuk melacak evolusi status artikel, transisi mutasi, dan pencatatan hasil keputusan (*decision outcomes*) secara persisten, append-only, dan deduped pada SQLite/Cloudflare D1 lokal, sebagai prasyarat evaluasi retrospektif model TypeSafe Jev.
* **Skema D1 & Migrasi `0023_editorial_trajectory_ledger.sql`:**
  - `article_state_snapshots`: Snapshot status kanonikal artikel yang tidak dapat diubah (*immutable*), di-deduplikasi berdasarkan kombinasi unik `(article_id, input_hash, input_schema_version)`.
  - `article_state_transitions`: Log append-only untuk setiap mutasi status artikel (`transition_id`, `from_snapshot_id`, `to_snapshot_id`, `from_input_hash`, `to_input_hash`, `transition_type`, `mutation_operation_id`, dll.) dengan index pencarian cepat.
  - `decision_outcomes`: Log append-only hasil keputusan hilir independen (`outcome_id`, `article_id`, `snapshot_id`, `input_hash`, `outcome_type`, `outcome_class`, `idempotency_key`, dll.) yang terikat pada bukti kanonikal.
* **Layanan `trajectory-ledger.ts`:**
  - Taksonomi transisi terstandardisasi: `CONTENT_CHANGED`, `MEDIA_ADDED`, `MEDIA_REPLACED`, `MEDIA_REMOVED`, `MANUAL_HOLD_CHANGED`, `READINESS_CHANGED`, `MULTI_FACTOR_CHANGE`, `UNKNOWN_CHANGE`.
  - Pembatasan NOOP: Jika status kanonikal sebelum dan sesudah mutasi identik, transisi tidak dibuat (`NOOP_READINESS_REEVALUATION_CREATES_TRANSITION = NO`).
  - Aturan Inisial: Artikel baru hanya menghasilkan snapshot inisial tanpa pendahulu transisi fiktif (`INITIAL_STATE_CREATES_TRANSITION = NO`).
  - Firewall Kegagalan: Memisahkan kegagalan keputusan (`EDITORIAL_FAILURE`, `POLICY_FAILURE`) dari kegagalan infrastruktur/jaringan (`INFRASTRUCTURE_FAILURE`, `PROVIDER_FAILURE`, `UNKNOWN_FAILURE`) agar tidak mencemari bukti evaluasi model.
  - Diff Metrics Ringan: Menghitung metrik perubahan teks (`bytes_delta`, `words_delta`, `headings_delta`, `references_delta`) tanpa menyimpan naskah lengkap.
* **Hasil Pengujian Unit:** 47/47 tes lulus pada `scripts/test-editorial-trajectory-ledger.js`.
* **Status Fase:** `JEV_PHASE_7L = PASS`.

### Masalah 60: Integrasi Nyata Callsite Trajectory Ledger & Pengujian End-to-End Komprehensif (Phase JEV-7L.1)
* **Tujuan & Ruang Lingkup:** Mengintegrasikan pemanggilan runtime trajectory ledger ke seluruh titik mutasi produksi riil pada kode sumber lokal, dan membuktikan siklus hidup trajektori secara end-to-end tanpa mock dangkal.
* **Audit Callsite & Hasil Integrasi:**
  - Audit menemukan bahwa commit awal `51130e9d` hanya memuat skema dan unit test, tanpa callsite terpasang pada service riil (`WERE_CAPTURE_POINTS_ACTUALLY_INTEGRATED_IN_COMMIT_51130e9d = NO`).
  - Integrasi penuh dilakukan pada 8 jalur mutasi riil:
    1. *Article content edit:* `updateArticle` di `src/lib/db.ts` merekam snapshot & transisi `CONTENT_CHANGED`.
    2. *Hermes ingest:* `insertHermesArticleAndReceipt` di `src/lib/db.ts` merekam snapshot inisial artikel baru.
    3. *Featured media binding:* `bindMediaToArticle` & `unbindFeaturedMedia` di `src/lib/media/service.ts` merekam `MEDIA_ADDED`, `MEDIA_REPLACED`, `MEDIA_REMOVED`.
    4. *Manual hold mutation:* `holdArticle` & `resumeArticleAutomation` di `src/lib/publication/operator-controls.ts` merekam `MANUAL_HOLD_CHANGED`.
    5. *Readiness evaluation:* `evaluateArticleReadiness` di `src/lib/publication/service.ts` mematuhi aturan NOOP (0 transisi redundant).
    6. *Human editorial outcome:* `recordEditorialApproval` & `revokeEditorialApproval` merekam outcome `human_approved` dan `human_approval_revoked`.
    7. *Publication outcome & receipt:* `executeAtomicPublication` & `cancelExecution` di `src/lib/publication/publisher-service.ts` merekam `publication_succeeded` dan `publication_cancelled` dengan pelindung firewall kegagalan.
* **Hasil Pengujian End-to-End:** 29/29 tes lulus pada `scripts/test-editorial-trajectory-e2e.js`.
* **Status Fase:** `JEV_PHASE_7L_1 = PASS`.

### Masalah 61: Pengerasan Atomisitas Ingest Hermes & Optimistic Concurrency Control (Phase JEV-7L.2)
* **Tujuan & Ruang Lingkup:** Menjamin atomisitas sejati pembentukan draf artikel Hermes baru dan snapshot kanonikal inisial dalam batch D1 tunggal, mencegah event phantom pada konflik konkurensi optimistik (*stale-read races*), serta membuktikan ketahanan rollback kegagalan secara lokal.
* **Penyelesaian Celah Atomisitas Hermes:**
  - Sebelum perbaikan: Artikel dan receipt dimasukkan via `db.batch`, lalu snapshot dieksekusi terpisah di luar batch.
  - Solusi: Alokasi ID artikel secara deterministik di awal (`SELECT MAX(...) + 1`), lalu menggabungkan `insertArticleStmt`, `insertReceiptStmt`, dan `snapStmt` ke dalam **satu batch D1 atomik tunggal** (`NEW_ARTICLE_INITIAL_SNAPSHOT_ATOMIC = YES`).
* **Strategi OCC dengan Zero-Row Detection (`CONDITIONAL_WHERE_EXISTS_WITH_ZERO_ROW_DETECTION`):**
  - Pada SQLite/D1, `UPDATE` yang tidak mengubah baris karena predikat OCC yang basi tidak melempar error SQL sehingga query lain dalam batch berisiko tetap commit.
  - Implementasi: Seluruh builder statement ledger (`prepareCaptureSnapshotStatement`, `prepareRecordTransitionStatement`, `prepareRecordOutcomeStatement`) diperbarui untuk mendukung `OCCGuardCondition` (`INSERT ... SELECT ... WHERE EXISTS (...)`).
  - Jika mutasi bisnis memodifikasi 0 baris, klausa `WHERE EXISTS` otomatis bernilai `FALSE`, memastikan 0 baris masuk ke tabel ledger (`STALE_MUTATION_CAN_CREATE_PHANTOM_LEDGER_EVENT = NO`, `EXACT_STATE_OUTCOME_STALE_BINDING_POSSIBLE = NO`).
  - Service memeriksa `changes === 0` dan segera melempar `OPTIMISTIC_CONCURRENCY_CONFLICT`.
  - Pada `bindMediaToArticle`, urutan eksekusi dibalik sehingga conditional INSERT berjalan mendahului deactivation update untuk membaca status aktif yang konsisten.
* **Hasil Pengujian & Regresi Lengkap:**
  - Suite E2E diperluas menjadi 38 tes komprehensif (`scripts/test-editorial-trajectory-e2e.js`: 38/38 PASS).
  - Seluruh rangkaian regresi lulus 100%: 47 unit ledger tests, 67 planner tests, 48 publisher tests, 16 operator control tests, 23 dual authorization tests, 16 media planning tests, 8 telemetry tests, 23 decision engine tests, 14 router tests, 5 lokamedia integration tests, 54 soak safety tests, TypeScript typecheck clean, dan build Astro sukses.
* **Status Fase:** `JEV_PHASE_7L_2 = PASS`. Sistem lokal 100% siap untuk peluncuran canary produksi JEV-7M.

### Masalah 62: Peluncuran Canary Produksi JEV Phase 7M — Editorial Trajectory Ledger, Migrasi 0023 & Bounded Canary Hold/Resume (Phase JEV-7M)
* **Tujuan & Ruang Lingkup:** Menerapkan migrasi D1 aditif `0023_editorial_trajectory_ledger.sql` ke produksi Cloudflare, men-deploy implementasi Worker sadar-ledger yang teruji, mengeksekusi tepat SATU mutasi kanari terbalikkan terkendali (*bounded reversible canary*): `Article 1 manual_hold 0 -> 1 -> 0` melalui jalur API/service operator kanonikal, membuktikan perekaman snapshot dan transisi atomik secara append-only, deduplikasi snapshot kanonikal saat kembali ke kondisi awal, ketiadaan outcome palsu, serta mempertahankan integritas keselamatan publikasi dan otoritas nol Jev.
* **Aktivasi Migrasi D1 Produksi & Deployment Worker:**
  - **Migrasi D1:** `0023_editorial_trajectory_ledger.sql` berhasil diterapkan ke database `rancangloka_db` (`MIGRATION_0023_PRODUCTION = PASS`). Tabel baru terverifikasi: `article_state_snapshots`, `article_state_transitions`, `decision_outcomes`.
  - **Baseline Pra-Canary:** `PRE_CANARY_SNAPSHOT_COUNT = 0`, `PRE_CANARY_TRANSITION_COUNT = 0`, `PRE_CANARY_OUTCOME_COUNT = 0` (`HISTORICAL_TRANSITIONS_SYNTHESIZED = NO`).
  - **Deployment ID Sebelumnya:** `f6aaa7a9-639f-42ea-9c27-4435f0fec9de`.
  - **Deployment ID Canary JEV-7M:** `cafaa01f-9355-409b-97ca-e8bd58cb0166`.
  - **Kesehatan Publik & Kontrol Pasca-Deploy:** Beranda (200), Artikel 6 (200), Sitemap XML (200), Admin (302 redirect). Kontrol publikasi: `mode = OFF`, `auto_schedule = false`, `kill_switch = 0`.
* **Eksekusi Kanari Mutasi A (Hold Artikel 1: 0 -> 1):**
  - **Jalur Operator Kanonikal:** `POST /api/admin/publication/operator-control` via browser admin yang terotentikasi sah dengan payload `{ action: 'hold', article_id: 1, reason: 'JEV-7M Production Canary Hold', actor: 'admin_operator' }`.
  - **Hasil Aksi:** `HOLD_ACTION_SUCCESS = YES`, `manual_hold = 1`, status tetap `draft`, `content_hash` tetap utuh (`0b88aa50b672...`).
  - **Bukti Ledger:**
    - Transisi tercipta: ID `ast_1_1790235931854_haxp2`.
    - `transition_type = 'MANUAL_HOLD_CHANGED'`.
    - `from_input_hash = 'h_1ec85cbf'`, `to_input_hash = 'h_1e0929a1'`.
    - `mutation_operation_id = 'mop_manual_hold_engaged_a1_1ec85cbf_to_1e0929a1'`.
    - Audit operator tercipta: ID 9 `MANUAL_HOLD_SET`.
    - Outcome keputusan tercipta: 0 (`HOLD_CREATED_OUTCOME_ROWS = 0`).
* **Eksekusi Kanari Mutasi B (Resume Artikel 1: 1 -> 0):**
  - **Jalur Operator Kanonikal:** `POST /api/admin/publication/operator-control` dengan payload `{ action: 'resume', article_id: 1, actor: 'admin_operator' }`.
  - **Hasil Aksi:** `RESUME_ACTION_SUCCESS = YES`, `manual_hold = 0`, status tetap `draft`, `content_hash` tetap utuh.
  - **Bukti Ledger:**
    - Transisi tercipta: ID `ast_1_1790236157117_5sj5p`.
    - `transition_type = 'MANUAL_HOLD_CHANGED'`.
    - `from_input_hash = 'h_1e0929a1'`, `to_input_hash = 'h_1ec85cbf'`.
    - `mutation_operation_id = 'mop_manual_hold_cleared_a1_1e0929a1_to_1ec85cbf'`.
    - Audit operator tercipta: ID 10 `MANUAL_HOLD_CLEARED`.
* **Pembuktian Deduplikasi Snapshot & Sifat Append-Only:**
  - **Topologi Snapshot:** A (`snp_h_1ec85cbf_1`, `manual_hold = 0`) -> B (`snp_h_1e0929a1_1`, `manual_hold = 1`) -> A (`snp_h_1ec85cbf_1`, `manual_hold = 0`).
  - Saat Artikel 1 kembali ke kondisi awal, snapshot A di-*reuse* dan di-deduplikasi (`RETURN_TO_ORIGINAL_SNAPSHOT_DEDUPE = PASS`).
  - Total snapshot kanari unik di tabel: tepat 2 (`ARTICLE_1_UNIQUE_CANARY_SNAPSHOT_COUNT = 2`).
  - Total transisi kanari tersimpan di tabel: tepat 2 (`ARTICLE_1_CANARY_TRANSITION_COUNT = 2`). Keduanya tersimpan permanen tanpa UPDATE/DELETE (`PRODUCTION_APPEND_ONLY_PROOF = PASS`).
  - Pemulihan status bisnis: `ARTICLE_1_BUSINESS_STATE_RESTORED = YES` (`ARTICLE_1_FINAL_INPUT_HASH == ARTICLE_1_PRE_INPUT_HASH == 'h_1ec85cbf'`).
* **Firewall Hasil Keputusan, Keselamatan Publikasi & Otoritas Nol Jev:**
  - Outcome baru: 0 (`NEW_CANARY_DECISION_OUTCOMES = 0`, `OUTCOME_FIREWALL_PRODUCTION = PASS`).
  - Rencana publikasi baru: 0, eksekusi baru: 0, receipt baru: 0, publikasi baru: 0.
  - Artikel 5 tetap `draft`, Artikel 6 tetap terbit.
  - Jev tidak menulis snapshot, transisi, maupun outcome (`JEV_CAN_WRITE_SNAPSHOTS = NO`, `JEV_CAN_WRITE_TRANSITIONS = NO`, `JEV_CAN_WRITE_OUTCOMES = NO`, `JEV_AUTHORITY_UNCHANGED = ZERO`).
  - Kontrol akhir: `FINAL_MODE = OFF`, `FINAL_AUTO_SCHEDULE = false`, `FINAL_KILL_SWITCH = 0`.
  - Kesehatan publik akhir: Beranda (200), Artikel 6 (200), Sitemap (200), Admin (302).
  - Regresi lokal pasca-canary: 100% PASS (`POST_7M_REGRESSION = PASS`).
* **Status Fase:** `JEV_PHASE_7M = PASS`. Editorial Trajectory Ledger resmi aktif di lingkungan produksi.

### Jev Phase 7M.2 Canonical Publication State Parity Fix Production Deployment 2026-09-24

- **Tujuan & Ruang Lingkup:** Menyelesaikan disparitas sumber data kanonikal (*canonical data source drift*) yang ditemukan pasca-canary JEV-7M, di mana jalur TypeSafe Jev shadow collector dan publication planner mengonsumsi aset gambar utama secara ketat dari `article_media(role='featured', is_active=1)`, sedangkan jalur operator controls dan mutasi artikel membaca kolom cermin `articles.featured_image`. Hal ini menyebabkan Artikel 1 menghasilkan `input_hash = 'h_1ec85cbf'` pada pra-kanari 7M (karena membaca cermin legacy non-null), berbeda dari observasi kanonikal historis JEV-7G (`h_1a9ca364`).
- **Analisis Akar Masalah (Root Cause: SOURCE_OF_TRUTH_DRIFT):**
  - Kolom `articles.featured_image` merupakan cermin presentasi warisan (*presentation fallback*) untuk backward compatibility CMS dan SEO Open Graph tags, bukan otoritas kanonikal siklus hidup publikasi.
  - Sumber kebenaran tunggal (*sole source of truth*) yang otoritatif adalah `article_media` aktif (`role='featured' AND is_active=1`).
  - Tidak ada perubahan status bisnis riil pada Artikel 1 (`ARTICLE_1_GENUINE_STATE_CHANGE_BETWEEN_7G_AND_7M = NO`).
- **Perbaikan Kode Lokal & Arsitektur Terpadu (Commit `f03744744fa23b1f9febe8a9ae5b63749cbcb17f`):**
  - Mengimplementasikan loader terpadu `loadCanonicalPublicationPreflightInput(db, articleId, overrides)` di `src/lib/decision/publication-preflight-state.ts` yang memuat artikel, meresolusi featured media secara eksklusif dari relasi aktif `article_media`, dan mengabaikan nilai `articles.featured_image`.
  - Menghubungkan loader kanonikal ke `src/lib/publication/operator-controls.ts` (`holdArticle`, `resumeArticleAutomation`) dan `src/lib/db.ts` (`updateArticle`, `insertArticle`, `insertHermesArticleAndReceipt`).
  - Menambahkan test suite paritas: `scripts/test-canonical-state-parity.js` (8/8 PASS).
  - Skema kanonikal tidak berubah (`SCHEMA_VERSION_BUMP_REQUIRED = NO`, tetap `2026-09-23.v2`).
- **Klasifikasi Rekaman Kanari Historis JEV-7M:**
  - Baris kanari 7M yang ada (`ast_1_1790235931854_haxp2` dan `ast_1_1790236157117_5sj5p`) diklasifikasikan sebagai `VALID_CANARY_BUT_SEMANTICALLY_INCOMPATIBLE`.
  - Sesuai prinsip *append-only*, baris historis ini dipertahankan utuh dan **TIDAK DIHAPUS / TIDAK DITULIS ULANG**.
- **Deployment Produksi & Verifikasi Pasca-Deploy:**
  - **Persetujuan Operator:** Diotorisasi penuh oleh operator untuk rilis Worker tanpa mutasi artikel/media.
  - **Deployment ID Sebelumnya:** `cafaa01f-9355-409b-97ca-e8bd58cb0166`.
  - **Deployment ID Paritas 7M.2:** `46da7f3f-b4d4-43b2-863e-3a25b51ac824`.
  - **Bukti Paritas Kanonikal Produksi (Read-Only):**
    - `PRODUCTION_CANONICAL_FEATURED_ASSET = null`
    - `PRODUCTION_HERO_IMAGE_PRESENT = false`
    - `PRODUCTION_PLANNER_ELIGIBILITY = NOT_ELIGIBLE`
    - `PRODUCTION_ARTICLE_1_CANONICAL_HASH = h_1a9ca364` (`PRODUCTION_HASH_MATCHES_HISTORICAL_JEV = YES`).
    - `LEGACY_FEATURED_IMAGE_CAN_AFFECT_CANONICAL_STATE = NO`.
    - `PLANNER_COLLECTOR_LEDGER_PARITY = PASS`.
    - `FUTURE_DECISION_TO_SNAPSHOT_JOIN_RELIABLE = YES`.
- **Firewall Keamanan, Zero Mutation & Zero Authority:**
  - Mutasi artikel bisnis: 0 (`PRODUCTION_ARTICLE_MUTATIONS = 0`).
  - Mutasi media: 0 (`PRODUCTION_MEDIA_MUTATIONS = 0`).
  - Rencana publikasi baru: 0, eksekusi baru: 0, receipt baru: 0, publikasi baru: 0.
  - Jev authority: `ZERO` (`JEV_CAN_WRITE_SNAPSHOTS = NO`, `JEV_CAN_WRITE_TRANSITIONS = NO`, `JEV_CAN_WRITE_OUTCOMES = NO`).
  - Kontrol produksi: `FINAL_MODE = OFF`, `FINAL_AUTO_SCHEDULE = false`, `FINAL_KILL_SWITCH = 0`.
  - Kesehatan publik: Beranda (200), Artikel 6 (200), Sitemap XML (200), Admin Gateway (302).
  - Regresi lengkap: 16 test suite PASS, TypeScript clean, Astro build clean.
- **Status Fase:** `JEV_PHASE_7M_2 = PASS`. Paritas pemuatan status kanonikal aktif di produksi. Platform siap untuk *Natural Trajectory Collection*.

---

## 📍 3. Status Terkini (Current Milestone Progress)

| Komponen | Status | Catatan |
|---|---|---|
| **Aplikasi Web & UI** | ✅ Selesai (Live) | Layout Apple-aesthetic, responsive, Outfit + Plus Jakarta Sans + JetBrains Mono. |
| **Kompilasi & Deployment** | ✅ Selesai (Live) | Berjalan di Cloudflare Workers Edge (*Version ID: `46da7f3f-b4d4-43b2-863e-3a25b51ac824`*). |
| **D1 Database & Skema** | ✅ Selesai (Aktif) | 19+ tabel (termasuk migrasi `0021_decision_observations`, `0022_allow_jev_shadow_collector_cron`, & `0023_editorial_trajectory_ledger`). |
| **R2 Storage & Media Library** | ✅ Selesai (Aktif) | Bucket `rancangloka-media` + asset registration & pipeline derivative storage. |
| **Decision Engine (TypeSafe Jev)** | ✅ Selesai (5-State Dataset Active & Dedupe Steady) | Dataset 5-state kanonikal v2 lengkap di edge cron `17 * * * *`, deduplikasi mapan terbukti (Zero Authority, mode OFF). |
| **Decision Telemetry** | ✅ Selesai (Aktif) | Tabel D1 `decision_observations` & `publication_cron_runs` mencatat telemetri durable edge. |
| **Editorial Trajectory Ledger** | ✅ Selesai (Aktif di Produksi) | Skema D1 migrasi 0023 aktif di edge, deployment `46da7f3f-b4d4-43b2-863e-3a25b51ac824`, paritas sumber data kanonikal terpadu (JEV-7M.2), append-only terbukti, zero authority. |
| **Publication & Safety Engine** | ✅ Selesai (Aktif) | Capability matrix (`OFF`, `OBSERVE_ONLY`, `PLAN_ONLY`, `CONTROLLED`, `UNATTENDED`), Circuit breaker, Run ledger. Status produksi: resting `OFF`. |
| **Pilar Konten & Editorial Scope** | ✅ Selesai (Aktif) | 13 pilar materi arsitektur, interior, konstruksi & biaya terdokumentasi di Blueprint Master. |
| **Design Problem Solver & Explorer** | ✅ Selesai (Aktif) | Alat diagnosis berbasis kemungkinan penyebab umum & 3-way multi-filter aktif. |
| **Material Comparison Matrix** | ✅ Selesai (Aktif) | Matriks komparasi + box *How We Score* (25%/20%/20%/15%/20%) + Evidence Badges. |
| **Editorial Standards & Metodologi** | ✅ Selesai (Aktif) | Piagam redaksi independen (`/editorial-standards`) & standar pengujian (`/metodologi`). |
| **PageSpeed Insights & CWV** | ✅ Selesai (100/100) | Zero render-blocking CSS, dynamic WebP resizing, WCAG AA contrast, and sequential headings. |
| **CMS Admin Dashboard** | ✅ Selesai (Live) | Layout Stitch Apple Developer Tier, dual-sidebar, bento KPI cards, dan kanonik operator controls (`/admin/automation`). |
| **Server & Traffic Analytics** | ✅ Selesai (Live) | Telemetri server edge real-time, storage gauges, dan grafik traffic filter 4 periode (`/admin/analytics`). |
| **Stealth Mode & Clean Engine** | ✅ Selesai (Aktif) | Path aset disamarkan ke `/assets/`, HTML minified, zero meta generator. |
| **SEO, News Sitemap & RSS** | ✅ Selesai (Aktif) | Google News XML, Sitemap XML, RSS syndication, Schema.org terverifikasi. |
| **Keamanan & Cloudflare Zero Trust** | ✅ Selesai (Aktif) | Proteksi OTP email `chandrajoyko@gmail.com` aktif untuk rute `/admin*`. |

---

## 🔑 4. Panduan Kredensial & Akses Admin (Credentials & Access Guide)

1. **Lapis 1 — Cloudflare Zero Trust (Access Edge Security):**
   - URL: `https://rancangloka.chandrajoyko.workers.dev/admin`
   - Otorisasi: Verifikasi kode OTP 6-digit via email `chandrajoyko@gmail.com`.
2. **Lapis 2 — CMS Admin Portal:**
   - Email: `admin@rancangloka.com`
   - Default Password: `Admin@RancangLoka2026!`
   - Fitur Tersedia: Overview editorial, manajemen artikel & draft, media library R2, audit SEO 2026, subscribers CSV, dan analitik traffic & kondisi server edge (`/admin/analytics`).

---

## 🔒 5. Keputusan Terkunci: Editorial Metadata, Taksonomi, & Roadmap Integrasi Hermes

*Status: LOCKED & FINAL (Sebelum Memulai Phase 2A Development)*

### A. Struktur Entitas Artikel & Sidecar Visual
```text
ARTICLE
├── article_id        → identitas transit artikel sejak Hermes
├── category          → tepat 1
├── content_type      → tepat 1 (Problem Solver, Deep Guide, Material Breakdown, Case Study, dll.)
├── tags              → 3–6 controlled tags
├── risk_class        → workflow metadata
├── evidence_mode     → workflow metadata
├── article.md        → konten publik (frontmatter ramping, belum dipaksakan tags/content_type sampai audit D1)
└── visual.json       → metadata workflow visual internal (sidecar, non-public)
```

### B. Taksonomi 6 Kategori Resmi (1 Artikel = Tepat 1 Kategori Primer)
1. **Arsitektur & Renovasi**
2. **Interior & Tata Ruang**
3. **Material & Finishing**
4. **Kenyamanan Rumah**
5. **Eksterior & Lanskap**
6. **Sistem & Konstruksi Rumah**
*(Aturan: Dipilih berdasarkan masalah/keputusan utama pembaca).*

### C. Controlled Tags (3–6 Tag per Artikel)
- Berbasis *controlled vocabulary* terstruktur menurut dimensi: `PROBLEM`, `BUILDING ELEMENT`, `MATERIAL`, `SPACE`, `SYSTEM`, `CONTEXT`.
- AI dilarang membuat tag bebas/diam-diam. Jika tag belum ada, Luna hanya boleh mengusulkan `TAG_CANDIDATE` untuk direview manusia sebelum masuk taksonomi resmi.

### D. Hybrid Visual Workflow (Zero Image Gen Cost Otomatis)
- `article.visual.json` memuat brief visual (hero prompt/concept + diagram inline).
- Draft boleh masuk D1 tanpa cover (`featured_image: ""`).
- Cover diisi via kurasi manual (foto sendiri, AI generator pilihan, atau SVG) lalu diunggah ke Cloudflare R2. Pre-publish gate mewajibkan cover sebelum artikel berstatus `published`.

### E. Protokol Audit Skema D1 Sebelum Migrasi (Phase 2A First Step)
Sebelum membuat file migrasi apa pun, wajib audit read-only skema D1 eksisting untuk:
- `categories`, `tags`, `article_tags`, `content_type`, `article ID`, `slug uniqueness`, `content hash`.
- Laporkan secara ketat: `ALREADY EXISTS`, `NEEDS MODIFICATION`, `SHOULD NOT BE ADDED YET`.

### F. Urutan Roadmap Development
1. **PHASE 2A:** Cloudflare Secure Receiver + Transit Identity + Idempotency + Retry Contract + Schema Audit.
2. **PHASE 2B:** Hermes Durable Outbox + SQLite queue + HMAC Sender + Retry/backoff + Circuit breaker + Dead-letter.
3. **PHASE 2C:** Category + Controlled tags persistence (jika schema membutuhkan).
4. **PHASE 2D:** Hybrid Visual Workflow + visual.json + R2 upload + pre-publish gate.
5. **PHASE 3:** Scheduler / Autopublish.
6. **Konservasi Voice Hermes:** Tetap menggunakan `SKILL.md` editorial Hermes saat ini sebagai basis tanpa diubah karakternya; penyesuaian hanya injeksi `CATEGORY_TAXONOMY.md`, `TAG_TAXONOMY.md`, dan `VISUAL_DNA.md`.

