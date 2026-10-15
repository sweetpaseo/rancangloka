# 🛑 RancangLoka & Hermes — Offline Master Checkpoint
**Tanggal / Waktu:** 2026-10-15T23:30:00+07:00
**Status Sesi:** Penutupan Sesi Rekayasa 15 Oktober 2026 / Master Checkpoint Sinkronisasi
**Branch:** `feat/jev-lokamedia-integration`
**Git HEAD:** `0f83537` (`docs(history): record article support mobile balance rollout`)
**Active Production Worker:** `1ec3dfd1-60b9-493f-aa48-ea63ea1dde0f`
**Status Operasional:** `ARTICLE_SUPPORT_MODULE_CLOSED` | `INTERNAL_LINK_ENGINE_STABILIZED` | `PRODUCT_REVIEW_AFFILIATE_ROADMAP_REGISTERED`

---

## 1. Status Ringkasan Ekosistem (Executive Summary — 15 Oktober 2026 Closeout)

Hari ini seluruh agenda rekayasa perangkat lunak, publikasi artikel produksi, kedalaman redaksi (*Premium Editorial Depth*), jembatan serah-terima visual Dimas $\to$ Budi, penerimaan produksi Internal Link Engine V1, remediasi artikel yatim, optimasi payload thumbnail modul dukungan, penataan hierarki konten kartu, hingga penyempurnaan keseimbangan visual mobile telah diselesaikan dengan integritas 100% tanpa pelanggaran batas keselamatan:

### 1. Eksekusi Publikasi Produksi Artikel C (Live di Edge)
- **Otorisasi Eksplisit:** Perintah resmi Chief Editor `AUTHORIZE ARTICLE C FINAL PUBLICATION` dieksekusi via `scripts/publish-article-c-production.js`.
- **Identitas & Kriptografi:**
  - Judul: *Memilih Sistem Shading Luar untuk Rumah Tropis: Overhang, Louver, Awning, atau Secondary Facade?*
  - Slug: `memilih-sistem-shading-luar-rumah-tropis`
  - URL Kanonikal Publik: `https://rancangloka.com/memilih-sistem-shading-luar-rumah-tropis`
  - Hash Naskah Kanonikal: `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28`
  - Database Article ID: `9`
  - Featured Asset ID: `ast_4ee0363758a41bd45aae7353` (tervalidasi di Cloudflare R2 & D1)
  - Teks Alt Disetujui: *"Detail sistem peneduh luar berupa overhang dan louver pada fasad rumah tropis modern yang melindungi bukaan kaca dari radiasi matahari langsung."*
- **Audit Tanda Terima:**
  - Persetujuan Manusia: `REVISED_CONTENT_APPROVED` (ID 12)
  - Kesiapan Publikasi: `READY_TO_SCHEDULE` (ID 34)
  - Plan ID: `plan_artC_f0a74ec8a117` | Execution ID: `pexec_artC_ecf45a651b90` | Receipt ID: `rcpt_artC_8341d2fda3bc`
  - Status HTTP Produksi: **200 OK** (Zero-JS comparison component, penutup hangat, dan metadata SEO terverifikasi aktif).

### 2. Milestone `INTERNAL-LINK-ENGINE-1` & Produksi Edge (Live & Stabilized)
- **Migrasi D1 0033:** Tabel `article_internal_links` diterapkan di D1 produksi (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`).
- **Graf Semantik Plane A (9 Relasi Aktif, 0 Orphan):**
  - Artikel 5 $\leftrightarrow$ Artikel 8 (`RELATED_MATERIAL` / `RELATED_DECISION`)
  - Artikel 6 $\leftrightarrow$ Artikel 9 (`RELATED_SYSTEM` / `RELATED_SYSTEM`)
  - Artikel 7 $\rightarrow$ Artikel 8 & 9 (`BACKGROUND_EXPLAINER` / `RELATED_SYSTEM`)
  - Artikel 8 $\rightarrow$ Artikel 9 & 7 & 5 (`RELATED_DECISION` / `RELATED_PROBLEM` / `RELATED_DECISION`)
  - Artikel 9 $\rightarrow$ Artikel 8 & 6 (`RELATED_MATERIAL` / `RELATED_SYSTEM`)
- **Corpus Orphan Count:** **0** (Zero isolated published articles).
- **Integritas Naskah:** Naskah & hash kelima artikel terbit (5, 6, 7, 8, 9) 100% utuh tanpa mutasi.
- **Status Status:** **CLOSED / LIVE / STABILIZED**.

### 3. Modul Dukungan Artikel (`ARTICLE_SUPPORT_MODULE` — Final Public Design & Closed)
- **Status Modul:** **CLOSED** (`ARTICLE_SUPPORT_MOBILE_BALANCE_PRODUCTION_COMPLETE`, `ARTICLE_SUPPORT_UI_POLISH_CLOSED`).
- **Active Worker:** `1ec3dfd1-60b9-493f-aa48-ea63ea1dde0f` (Cloudflare Workers edge runtime).
- **Desain Publik Kanonikal Final:**
  - **DESKTOP (sm: min-width 640px / 1280–1366px):**
    - Kolom kiri: Thumbnail derivatif kompak 80x80 px (160x160 WebP sumber).
    - Kolom kanan: Vertikal mengalir: **JUDUL ARTIKEL** $\rightarrow$ **EKSERP PROSA PEMBUKA** $\rightarrow$ **METADATA HUBUNGAN & WAKTU BACA**.
  - **MOBILE (375–390px):**
    - **Baris 1:** Thumbnail kompak 56x56 px berdampingan dengan JUDUL ARTIKEL. Menghilangkan masalah thumbnail "gantung" (*hanging thumbnail*) dan void kosong canggung.
    - **Baris 2:** EKSERP PROSA PEMBUKA merentang selebar kartu (*full card width*) di bawah baris judul-thumbnail, memberikan ruang bernapas optimal.
    - **Baris 3:** METADATA HUBUNGAN & WAKTU BACA merentang selebar kartu.
  - **Perilaku Desain & Aksesibilitas:**
    - Judul adalah elemen utama/dominan (semantic crawlable `<a>`).
    - Ekserp bersumber dari prosa pembuka naskah artikel target (`content_md` $\rightarrow$ `content_html` $\rightarrow$ fallback `description`).
    - `reader_reason` tersimpan aman di D1 sebagai metadata semantik internal redaksi dan **TIDAK dirender ke publik**.
    - Metadata relasi bersifat tersier.
    - Murni CSS Grid responsif (`grid grid-cols-[auto_1fr] sm:grid-cols-[80px_1fr]`), **zero client-side JS**, **zero DOM duplication**.
    - Derivatif `/media/thumbnails/...` 160x160 px WebP (`Cache-Control: public, max-age=31536000, immutable`), penghematan bandwidth 96.6% pada modul 3-kartu Artikel 8.
    - Image-induced CLS protection terjaga penuh.

---

## 2. Invarian Data & Graf Semantik Kanonikal

```
Plane A Dynamic Active Edges (9 edges, 0 orphans):
  5 -> 8 RELATED_MATERIAL
  6 -> 9 RELATED_SYSTEM
  7 -> 8 BACKGROUND_EXPLAINER
  7 -> 9 RELATED_SYSTEM
  8 -> 9 RELATED_DECISION
  8 -> 7 RELATED_PROBLEM
  8 -> 5 RELATED_DECISION
  9 -> 8 RELATED_MATERIAL
  9 -> 6 RELATED_SYSTEM

PLANE_A_DYNAMIC ACTIVE = 9
PLANE_B_INLINE         = 0
orphan_article_count   = 0
```

- **Article C Canonical SHA-256:**
  `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28`
- **Mutasi Naskah Artikel Terbit:** **0** (Semua teks artikel 5, 6, 7, 8, 9 terlindungi mutlak).

---

## 3. Pelajaran Pelaporan & Aturan Pelaporan Entitas Kanonikal (Learned Rule)

### `CANONICAL_ENTITY_REPORTING_RULE`
Saat melaporkan artikel produksi atau target tautan semantik dalam acceptance report Antigravity:
- **Article ID**, **Title**, **Slug**, dan **Relationship Type** **WAJIB** dibaca langsung dari data sumber kanonikal (tabel D1 `articles` dan `article_internal_links`).
- **Dilarang keras** mengarang, memparafrasekan, mengganti nama, meringkas secara manual, atau mengubah judul/slug artikel kanonikal di dalam teks laporan penerimaan.
- **Rasional:** Pelaporan sebelumnya sempat memicu sinyal *false debugging* saat redaksi mengira ada ketidaksesuaian binding data pada kode layanan, padahal binding kode sudah 100% tepat dan ketidaksesuaian hanya timbul karena teks laporan menggunakan judul parafrase/sintetis.
- **Standar Laporan:** Laporan penerimaan wajib membedakan secara tegas antara **DATA PRODUKSI NYATA (REAL PRODUCTION DATA)** dan **DATA PENGUJIAN SINTETIS (SYNTHETIC TEST FIXTURE DATA)**.

---

## 4. Invarian Keselamatan Produksi Wajib (Safety State)

| Parameter | Nilai Aktif | Keterangan |
|---|---|---|
| `automation_mode` | `OFF` | Otomasi publikasi mandiri nonaktif |
| `SOCIAL_AUTOMATION` | `OFF` | Otomasi distribusi sosial nonaktif |
| `AUTO_PUBLISH` | `OFF` | Semua artikel AI berhenti di status DRAFT |
| `JEV_MODE` | `shadow` | Decision engine hanya mode bayangan tanpa wewenang mutasi |
| `publishingAuthority` (Budi) | `0` | Budi dilarang mempublikasi secara mandiri |
| `publishingAuthority` (Nadia) | `0` | Nadia nol otoritas publikasi |
| `publishingAuthority` (Rina) | `0` | Rina mengawasi kebenaran, bukan penerbit akhir |
| `publishingAuthority` (Jefry) | `0` | Jefry strictly shadow/advisory only |
| `Autonomous Media Gen` | `DISABLED` | Media job Budi berstatus QUEUED, menunggu persetujuan dual-gate |
| `kill_switch_engaged` | `0` | Sistem berjalan normal tanpa intervensi darurat |
| Mutasi Naskah Artikel Terbit | `0` | Seluruh `content_md`, `content_html`, dan `content_hash` terlindungi |
| Push Git Remote | `0` | Seluruh komit berada di branch lokal `feat/jev-lokamedia-integration` |
| Pipeline Kanonikal | `Irwan -> Joko -> (Dimas/Budi) -> Nadia -> Rina -> Human Approval -> Sari` | Zero shortcut & zero bypass ditegakkan penuh |

---

## 5. Hasil Pengujian & Integritas Kode

- **Pengujian Internal Link Engine:**
  `node scripts/test-internal-link-engine.js` ➔ **29/29 PASSED (100%)**
- **Pengujian LiveOps Mission Control:**
  `node scripts/test-mission-control-liveops.js` ➔ **78/78 PASSED (100%)**
- **TypeScript Typecheck:**
  `npx tsc --noEmit` ➔ **0 ERRORS (Clean compilation)**
- **Astro Production Build:**
  `npm run build` ➔ **SUCCEEDED (Server & Client edge bundle optimal)**
- **Git Whitespace & Diff Check:**
  `git diff --check` ➔ **CLEAN (0 issues)**

---

## 6. Git Commit Sesi 15 Oktober 2026 (Urutan Terkini)

```text
0f83537 docs(history): record article support mobile balance rollout
1525d8a style(ui): polish mobile visual balance for article support cards
2fc2c93 docs(checkpoint): record article support card hierarchy rollout
eddd3d6 fix(ui): verify support card target metadata binding
e80adfe fix(ui): use article opening prose in support card excerpts
3346082 fix(ui): prioritize title and excerpt in article support cards
9461c9e fix(media): make thumbnail generation runtime-safe
e180431 fix(media): harden thumbnail derivative lifecycle and cache safety
c41b6ce docs(checkpoint): record article support thumbnail payload optimization
39078ef perf(media): add compact derivatives for article support thumbnails
76e03f7 feat(ui): add thumbnails to semantic article support module
cb1dde0 docs(checkpoint): close initial internal link orphan remediation
db219dd docs(checkpoint): record Internal Link Engine production acceptance
0ffbbfe fix(internal-link): harden semantic graph invariants
1de30b6 feat(internal-link): implement semantic link engine v1
05b776d feat(editorial): connect visual briefs to Budi runtime
```

---

## 7. Master Engineering Roadmap & Urutan Milestone

Urutan rekayasa utama RancangLoka telah ditetapkan secara kanonikal oleh Chief Editor dan **DILARANG DIUBAH URUTANNYA**:

1. **`INTERNAL_LINK_ENGINE`** ➔ **CLOSED / LIVE / STABILIZED**
2. **`ARTICLE_SUPPORT_MODULE`** ➔ **CLOSED / PRODUCTION ACCEPTED / RESPONSIVE POLISH COMPLETE**
3. **`CONTENT_PROTECTION-1`** ➔ **NEXT MAJOR ENGINEERING MILESTONE** (Fokus: Proteksi hak cipta konten, anti-scraping, mitigasi crawler liar, integritas feed/aset).
4. **`PRODUCT_DECISION_ENGINE`** ➔ **UPCOMING MILESTONE** (Mesin pembuat keputusan pemilihan produk, komparasi trade-off arsitektural, dan rekomendasi alternatif).
5. **`INTELLIGENCE_LAYER-1`** ➔ **SUBSEQUENT MILESTONE** (Lapisan analitik privat berbobot tinggi, telemetri niat komersial, atribusi konversi etis).

> **Peringatan Tata Kelola Roadmap:** Pendaftaran konsep *Product Review Affiliate* **TIDAK MENGUBAH** urutan prioritas di atas. `CONTENT_PROTECTION-1` tetap menjadi pekerjaan teknis berikutnya.

---

## 8. Registrasi Milestone Masa Depan: `PRODUCT_REVIEW_AFFILIATE-1`

### Identitas Milestone
- **Kode Milestone:** `PRODUCT_REVIEW_AFFILIATE-1`
- **Parent:** `PRODUCT_DECISION_ENGINE`
- **Status:** `PLANNED` | `DESIGN INTENT CAPTURED` | `IMPLEMENTATION NOT STARTED`
- **Permukaan Operasional:** **`PRODUCT REVIEW DESK`** (Berada terintegrasi di dalam Mission Control, bukan aplikasi terpisah).

### 1. Filosofi Editorial Review Produk
> **"THE PRODUCT IS NOT THE CENTER OF THE ARTICLE. THE READER'S DECISION IS."**
> *(Produk bukanlah pusat dari artikel. Keputusan pembaca lah pusatnya.)*

RancangLoka dilarang menjadi *thin affiliate SEO farm* yang sekadar mengejar komisi. Ulasan produk RancangLoka wajib menjawab:
- Siapa yang tepat membeli produk ini?
- Siapa yang sebaiknya **menghindarinya**?
- Kondisi rumah, bangunan, atau kelistrikan tropis seperti apa yang cocok?
- Syarat pemasangan dan instalasi riil apa yang harus dipenuhi?
- Apa *trade-off* nyata di balik harga murah atau fitur canggih?
- Spesifikasi mana yang benar-benar berpengaruh pada pemakaian harian?
- Masalah berulang apa yang dilaporkan oleh pembeli riil?
- Apa alternatif produk yang lebih masuk akal?

### 2. Alur Kerja Inti Product Review Desk (Chief Editor Flow)
- **Akses:** `Mission Control` $\rightarrow$ `Product Review Desk` $\rightarrow$ Tombol `+ Review Produk Baru`.
- **Input Minimum Wajib dari Chief Editor:**
  1. **Product Source URL:** Tautan listing produk/sumber informasi asli (input riset redaksi & bukti).
  2. **Affiliate CTA URL:** Tautan afiliasi komersial (tujuan transaksi pembaca).
  - *Invarian:* `PRODUCT SOURCE URL` (sumber bukti) dan `AFFILIATE CTA URL` (tujuan komersial) **WAJIB DIPISAHKAN SECARA KONSEPTUAL DAN DATA**.
- **Input Opsional:** Marketplace, fokus redaksi, target audiens/skenario rumah, catatan khusus Chief Editor.
- **Pipeline Staf Redaksi Kanonikal:**
  1. *Chief Editor* memasukkan URL produk & afiliasi.
  2. *Irwan* mengekstraksi bukti & spesifikasi (*research/evidence extraction*).
  3. *Joko* menyusun draf naskah artikel analitis (*editorial drafting*).
  4. *Budi* menyiapkan ilustrasi konsep pendukung (*supporting visual preparation*).
  5. *Nadia* mengaudit suara pembaca & kejelasan bahasa (*reader voice review*).
  6. *Rina* memverifikasi kebenaran klaim teknis & ketiadaan overreach (*claims QA*).
  7. *Chief Editor* memberikan persetujuan final (*human approval boundary*).
  8. *Sari* menjadwalkan & mempublikasikan naskah (*controlled publication*).
  9. *Dimas* memonitor kesegaran data komersial & anomali (*post-pub commerce monitoring*).

### 3. Model Data Produk & Komersial (Anti-Fragile Architecture)
Arsitektur data masa depan **DILARANG MENGANGGAP 1 URL = 1 PRODUK ABADI**. Entitas konseptual minimum:
- **`PRODUCT`**: Identitas produk editorial kanonikal (brand, nama model, kategori).
- **`VARIANT`**: Model, ukuran, kapasitas, warna, konfigurasi daya.
- **`OFFER`**: Listing marketplace tertentu + penjual/toko + ketersediaan. (Satu produk dapat memiliki banyak Offers di berbagai seller/marketplace).
- **`AFFILIATE_DESTINATION`**: Tujuan komersial CTA afiliasi.
- **`PRICE_SNAPSHOT`**: Harga teramati + stempel waktu pencatatan.
- **`SPEC_SNAPSHOT`**: Spesifikasi teknis teramati + stempel waktu pencatatan.
- **`REVIEW_SNAPSHOT`**: Agregasi sinyal ulasan konsumen + stempel waktu.
- **`EVIDENCE_SOURCE`**: Provenansi bukti sumber klaim redaksi.
- **`ARTICLE_PRODUCT_BINDING`**: Relasi terikat antara artikel editorial dan produk kanonikal.

### 4. Proteksi Pergeseran Identitas Produk (*Product Identity Drift*)
URL marketplace rentan berganti isi tanpa pemberitahuan:
- **Pendeteksian Anomali:** Judul listing berubah drastis, perubahan SKU/model, gambar produk berganti total, spesifikasi teknis berubah, pergantian toko/penjual, atau penggunaan ulang URL listing lama (*listing reuse*) dengan mewarisi ulasan produk sebelumnya.
- **Status Sinyal:** `LISTING_REPURPOSE_SUSPECTED` $\rightarrow$ Memicu peninjauan manual redaksi (*editorial review*), bukan secara diam-diam mengubah kesimpulan rekomendasi artikel.

### 5. Ingesti Sumber Produk (*Product Source Ingestion*)
- Atribut yang diekstraksi: Nama produk, brand, model/SKU, nama toko, status Official Store, varian, gambar listing, spesifikasi, klaim penjual/pabrik, harga teramati, diskon/promo, rating, jumlah ulasan, jumlah terjual, sinyal ulasan pembeli, stempel waktu snapshot.
- Preferensi ekstraksi: Sumber data terstruktur/resmi $\rightarrow$ Ekstraksi halaman browser $\rightarrow$ Fallback manual operator.
- **Dilarang keras mengarang data produk yang hilang.** Kegagalan ekstraksi menghasilkan status `PRODUCT_SOURCE_REQUIRES_MANUAL_REVIEW`.

### 6. Tipe Editorial Review Produk & Aturan Anti-Bohong
- **Tipe Default:** **`ANALYTICAL_REVIEW`** (ulasan analitis berbasis data dan bukti empiris).
- **Larangan Keras:** **DILARANG MENGGUNAKAN LABEL "Tested by RancangLoka"** kecuali tim redaksi benar-benar memegang, menguji, dan mendokumentasikan produk fisik tersebut secara langsung.
- **Aturan Permanen:**
  `SPONSORED_OR_AFFILIATE_CONTENT_CANNOT_CLAIM_HANDS_ON_TESTING_WITHOUT_PRIMARY_EVIDENCE`

### 7. Pengelolaan Sinyal Ulasan Konsumen (*Customer Review Signals*)
- Rating atau testimoni marketplace **bukan fakta ilmiah terverifikasi**, melainkan diklasifikasikan sebagai: **`USER_EXPERIENCE_SIGNAL`**.
- Entitas snapshot memuat: `review_snapshot_id`, `source`, `sample_size`, `snapshot_date`, `rating_distribution`, `positive_themes`, `negative_themes`, `recurring_issue_count`, `variant_scope`, `confidence`.
- Mitigasi blindspot: Varian campur aduk, ulasan lama vs revisi produk baru, manipulasi ulasan/bot, pergantian seller.
- Redaksi dilarang hanya mengutip ulasan positif (cherry-picking). Ringkasan keluhan/kekurangan berulang wajib disajikan secara proporsional.

### 8. Arsitektur Harga Dinamis Terpisah dari Naskah
> **`PRICE_IS_DYNAMIC_COMMERCE_DATA_NOT_ARTICLE_PROSE`**
> *(Harga adalah data komersial dinamis, bukan bagian naskah prosa artikel yang statis.)*

- Harga marketplace transien **DILARANG DITULIS PERMANEN DI DALAM TEKS PROSA NASKAH ARTIKEL**.
- Tubuh naskah artikel tetap stabil secara editorial, sedangkan harga disajikan melalui komponen UI komersial dinamis SSR di edge.
- Status kesegaran harga: `PRICE_FRESH`, `PRICE_RECENT`, `PRICE_STALE`, `PRICE_UNAVAILABLE`.
- Jika harga kedaluwarsa (*stale*), sistem dilarang menyajikan angka basi sebagai kebenaran. UI menampilkan fallback anggun: *"Cek harga terbaru di Official Store"*. Ambang batas kesegaran dapat dikonfigurasi.
- **Zero Synchronous Scraping:** Dilarang melakukan scraping marketplace secara sinkron pada setiap permintaan halaman artikel. Skema yang benar: Penjadwal latar belakang $\rightarrow$ Snapshot harga ke D1 $\rightarrow$ Komponen komersial membaca D1 secara instan di SSR.

### 9. Blindspot Rentang Harga & Promosi
- Klasifikasi tampilan harga: `display_price_type` = `EXACT` | `RANGE` | `PROMO` | `UNAVAILABLE`.
- Dilarang mengiklankan harga varian termurah (misal: kabel adaptor kecil) sebagai harga produk utama jika terdapat perbedaan harga material antar-varian.

### 10. Pergeseran Spesifikasi Material (*Specification Drift*)
Perubahan harga cukup memperbarui tabel komersial D1 tanpa mengubah hash artikel. Namun jika terjadi perubahan material pada: dimensi, bahan material, daya listrik, kompatibilitas, masa garansi, sertifikasi, rating keselamatan, atau revisi model:
- Sistem wajib menerbitkan sinyal `SPEC_CHANGE_REVIEW_REQUIRED`. Rekomendasi artikel tidak boleh berubah diam-diam jika realitas produk telah berubah.

### 11. Provenansi Klaim Garansi & Sertifikasi
Sistem wajib mencatat atribusi klaim teknis (SNI, IP rating, CE, FCC, durasi garansi):
- Wajib membedakan antara klaim pabrikan, klaim penjual, dan bukti independen.
- Istilah "Garansi 1 tahun" harus transparan: garansi resmi brand, garansi distributor, atau garansi toko.

### 12. Tombol Aksi Afiliasi (Affiliate CTA) & Pemisahan Komersial
- Bahasa CTA publik yang tenang dan bersahaja: *"Cek harga & varian terbaru di Shopee"* atau *"Cek produk di Official Store"*. Hindari bahasa agresif/slop seperti *"BELI SEKARANG!!!"*.
- Atribut tautan: `rel="sponsored nofollow noopener"` dengan pengungkapan afiliasi yang transparan (*clear affiliate disclosure*).
- **Prinsip Permanen:**
  - `COMMERCIAL_DESTINATION_IS_SEPARATE_FROM_EDITORIAL_EVIDENCE`
  - `AFFILIATE_REVENUE_CANNOT_MODIFY_EDITORIAL_RECOMMENDATION`
  - Persentase komisi afiliasi dilarang keras mempengaruhi peringkat editorial, rekomendasi Joko, atau hasil validasi Rina.

### 13. Diskontinuitas Produk & Alternatif
Artikel editorial yang bermanfaat tidak boleh dihapus hanya karena satu toko kehabisan stok. Komponen komersial cukup menyatakan produk tidak lagi tersedia pada seller yang dimonitor, dan Product Decision Engine dapat merekomendasikan alternatif produk yang setara.

### 14. Visual Pendukung Budi (*Supporting Visuals*)
Budi dapat menyiapkan diagram konteks instalasi, diagram kompatibilitas, visual skenario pemakaian, atau ilustrasi komparasi. Visual ini secara internal berstatus `EDITORIAL_CONCEPT_VISUAL` dan dilarang mengindikasikan bahwa RancangLoka telah menguji produk fisik secara langsung jika pengujian fisik tidak dilakukan.

### 15. Struktur Konseptual Naskah Ulasan Produk
1. Konteks masalah & keputusan pembaca
2. Identitas produk & model
3. Pengungkapan tipe Analytical Review
4. Penilaian RancangLoka
5. Cocok untuk (profil pengguna/rumah)
6. Kurang cocok untuk (kondisi yang harus menghindari)
7. Spesifikasi teknis utama
8. Makna spesifikasi tersebut dalam pemakaian nyata
9. Kelebihan teknis
10. Batasan, kekurangan, & risiko pemakaian
11. Syarat pemasangan & kompatibilitas rumah
12. Sinyal Ulasan Konsumen riil (positif & negatif berimbang)
13. Alternatif produk & komparasi trade-off
14. Rekomendasi & serah-terima keputusan pembaca
15. Komponen komersial harga dinamis & CTA afiliasi resmi

### 16. Antarmuka Masa Depan di Mission Control
- **Daftar Produk:** Menampilkan nama produk, marketplace, seller, kesegaran penawaran, status harga, status afiliasi, tahapan editorial, status publikasi, dan tanda peringatan anomali.
- **Filter:** `ALL`, `RESEARCH`, `DRAFT`, `QA`, `APPROVAL`, `PUBLISHED`, `PRICE_STALE`, `LINK_PROBLEM`, `PRODUCT_UNAVAILABLE`, `SPEC_REVIEW_REQUIRED`.
- **Workspace:** Bagian `SOURCE`, `COMMERCE`, `EDITORIAL`, `CUSTOMER SIGNALS`, `VISUAL BRIEF`, dan `CHANGE HISTORY`.

### 17. Telemetri & Analitik Masa Depan (Integrasi `INTELLIGENCE_LAYER-1`)
Metrik berorientasi privasi: Traffic ulasan, sesi dengan niat komersial (*commercial-intent sessions*), klik CTA afiliasi, atribusi klik artikel $\rightarrow$ produk $\rightarrow$ penawaran, distribusi marketplace, CTR afiliasi, dan pendapatan riil terverifikasi (tanpa fabrikasi data).

---

## 9. Rencana Tindakan Sesi Berikutnya

1. **Persiapan Milestone `CONTENT_PROTECTION-1`:** Lakukan analisis kebutuhan proteksi konten, mitigasi scraping liar terhadap artikel RancangLoka, pengamanan aset gambar di R2, perlindungan RSS/feed, serta pembatasan akses bot AI tanpa izin.
2. **Penyusunan Desain `PRODUCT_DECISION_ENGINE`:** Siapkan spesifikasi skema D1 untuk entitas produk, penawaran, snapshot harga, dan mesin pencocokan alternatif rekomendasi.
3. **Penyatuan Branch:** Bila diperintahkan Chief Editor, siapkan merge/rebase branch `feat/jev-lokamedia-integration` dengan tetap mempertahankan integritas edge Cloudflare Workers.
