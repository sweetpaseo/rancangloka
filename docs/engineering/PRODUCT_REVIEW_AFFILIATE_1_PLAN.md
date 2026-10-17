# 🛍️ RancangLoka Product Review Desk & Affiliate Firewall — Master Architecture & Data Contract Plan
> **Dokumen Arsitektur & Spesifikasi Kontrak Data:** Milestone `PRODUCT_REVIEW_AFFILIATE_1` (1A, 1B, 1C, 1D-A, 1D-B)
> **Status:** APPROVED, PRODUCTION ACTIVATED & FULLY CLOSED (`PRODUCT_REVIEW_AFFILIATE_1_COMPLETE`)
> **Status Produksi D1:** Migrasi 0036 Berhasil Diterapkan (10 Tabel Terverifikasi, 0 Baris Produk)
> **Status Worker Edge:** Terpasang & Aktif (`dea95d68-1708-4af7-8c02-3ea35c3af5ad`)
> **Status Modul Publik:** Non-Aktif (Nol Kebocoran UI/Toko/Harga, Artikel 5–9 Utuh)
> **Tahap Operasional Berikutnya:** `READY_FOR_CONTROLLED_REAL_PRODUCT_ONBOARDING`
> **Repositori Otoritatif:** `rancangloka-astro/`
> **Branch:** `feat/jev-lokamedia-integration`

---

## 1. Prinsip Utama (Permanent Editorial Principle)

> **"PRODUK BUKANLAH PUSAT DARI ARTIKEL. KEPUTUSAN PEMBACA LAH PUSATNYA."**  
> *"THE PRODUCT IS NOT THE CENTER OF THE ARTICLE. THE READER'S DECISION IS."*

### Alur Pipa Kanonikal (Canonical Pipeline):
```text
Konteks Kebutuhan Pembaca (Reader Context)
  │
  ▼
Keputusan Kelas Solusi Teknis (PDE Solution Class Decision)
  │
  ▼
Meja Ulasan Produk (Product Review Desk)
  │
  ▼
Pencocokan Karakteristik Teknis Produk (Product Match)
  │
  ▼
Penawaran Merchant / Destinasi Afiliasi (Offer / Affiliate Destination)
```

### Invarian Mutlak:
- **`AFFILIATE_REVENUE_CANNOT_AFFECT_RECOMMENDATION`:** Pendapatan komisi afiliasi, nilai payout merchant, atau prioritas sponsor dilarang keras mempengaruhi evaluasi teknis, ranking produk, atau rekomendasi editorial.
- **`SOURCE_URL_IS_NOT_AFFILIATE_DESTINATION`:** URL rujukan bukti (lembar spesifikasi, manual, uji lab) terpisah secara mutlak dari URL pelacakan afiliasi komersial.
- **`PRICE_IS_NOT_IMMUTABLE_EDITORIAL_PROSE`:** Harga marketplace adalah data komersial volatil dinamis yang tidak boleh ditanamkan secara kaku ke dalam naskah abadi artikel sebagai kebenaran mutlak.

---

## 2. Editorial Review Modes

RancangLoka menerapkan pemisahan mode ulasan yang ketat:

### A. `ANALYTICAL_REVIEW` (Default)
- Berbasis analisis fisika bangunan, standar teknis material, manual pabrikan, dan verifikasi empiris iklim tropis Indonesia.
- **Dilarang Keras:** Mengklaim *"Tested by RancangLoka"* atau menampilkan badge uji lab internal.

### B. `HANDS_ON_REVIEW`
- Hanya sah jika pengujian fisik langsung benar-benar dilakukan oleh tim redaksi/lab RancangLoka.
- **Syarat Wajib:**
  1. `tested_by_rancangloka = true`.
  2. Memiliki `testing_provenance` lengkap (`testing_date`, `tester_identity`, `testing_location`, `methodology_notes`).
  3. Memiliki minimal satu entri `EvidenceSource` bertipe `RANCANGLOKA_PRIMARY_TEST`.
  4. Status ini tidak boleh disimpulkan secara otomatis dari materi brosur, ulasan merchant, atau klaim AI.

---

## 3. Epistemologi & Sinyal Ulasan Pengguna

Ulasan marketplace atau testimoni pembeli diklasifikasikan sebagai **`USER_EXPERIENCE_SIGNAL`**, bukan **`VERIFIED_FACT`**.
- Rating bintang toko (misal 4.8 / 5.0) adalah metadata eksternal marketplace, **BUKAN skor RancangLoka**.
- Dilarang mengonversi rating eksternal menjadi status kualitas internal (misal: 4.9 bintang != `STRONG_FIT`).

---

## 4. Model Entitas Inti & Pemisahan Domain Bersih (Core Entities & Clean Domain Boundaries)

Arsitektur data dirancang dengan pemisahan tanggung jawab yang tegas:

```text
┌─────────────────────────────────────────────────────────────┐
│                           PRODUCT                           │
│     (Identitas Fisik Murni: Brand, Nama Produk, Kategori)   │
└──────┬───────────────────────┬──────────────────────────────┘
       │                       │
       ▼                       ▼
┌──────────────┐       ┌────────────────────────┐       ┌─────────────────────────────────┐
│   VARIANT    │       │     SPEC SNAPSHOT      │       │     EDITORIAL PRODUCT REVIEW    │
│ (SKU / Warna)│       │ (Spesifikasi Terversi) │       │(Ulasan RancangLoka: Mode & Lab) │
└──────┬───────┘       └────────────────────────┘       └─────────────────────────────────┘
       │                                                                  │
       ▼                                                                  ▼
┌──────────────┐       ┌────────────────────────┐       ┌─────────────────────────────────┐
│    OFFER     │◄──────┤     PRICE SNAPSHOT     │       │     ARTICLE PRODUCT BINDING     │
│ (Listing Toko│       │   (Harga Volatil)      │       │ (Konteks Artikel + Disclosure)  │
└──────┬───────┘       └────────────────────────┘       └─────────────────────────────────┘
       │
       ▼
┌───────────────────────────┐
│   AFFILIATE DESTINATION   │
│  (Tautan Merchant / Out)  │
└───────────────────────────┘
```

### Pembedaan Semantik Permanen:
1. **`Product != EditorialProductReview`:**
   - **`Product`:** Menjawab *"What product is this?"* (Identitas fisik produk murni: `product_id`, `canonical_name`, `brand`, `category_id`, `solution_class_id`, `identity_state`). Dilarang memuat `review_mode`, `tested_by_rancangloka`, atau `testing_provenance`.
   - **`EditorialProductReview`:** Menjawab *"How has RancangLoka reviewed this product?"* (Entitas ulasan editorial: `review_id`, `product_id`, `variant_id?`, `article_id?`, `review_mode`, `tested_by_rancangloka`, `testing_provenance`, `editorial_status`). Mendukung banyak ulasan historis (misal: Analytical Review hari ini, Hands-on Review di masa depan) tanpa mengubah identitas fisik Product.
2. **`ReviewSnapshot != EditorialProductReview`:**
   - **`ReviewSnapshot`:** Sinyal pengalaman pengguna luar dari toko/pasar (`USER_EXPERIENCE_SIGNAL` seperti rating marketplace atau ulasan pembeli).
   - **`EditorialProductReview`:** Pekerjaan ulasan dan pengujian independen dari redaksi RancangLoka sendiri.
3. **`ArticleProductBinding != EditorialProductReview`:**
   - **`ArticleProductBinding`:** Relasi penempatan produk di dalam artikel spesifik (`article_id`, `product_id`, `editorial_role`, `section_anchor`).
   - **`EditorialProductReview`:** Status penilaian dan metodologi ulasan redaksional atas produk tersebut.
4. **`CommercialDisclosure != EditorialProductReview`:**
   - **`CommercialDisclosure`:** Pengungkapan transparansi komersial (`has_affiliate_links`, `is_sponsored_content`, dll.).
   - Bebas dari penilaian teknis dan tidak mempengaruhi identitas produk maupun evaluasi hands-on.

1. **`Product`:** Identitas kanonikal produk independen dari toko (`product_id`, `brand`, `canonical_name`, `category_id`, `solution_class_id`, `identity_state`).
2. **`EditorialProductReview`:** Entitas kelas satu ulasan redaksi RancangLoka (`review_id`, `product_id`, `review_mode`, `tested_by_rancangloka`, `testing_provenance`, `editorial_status`).
3. **`Variant`:** Konfigurasi fisik, dimensi, atau sub-tipe spesifik (`variant_id`, `sku_or_model`, `variant_name`).
4. **`Offer`:** Penawaran komersial dari merchant tertentu (`offer_id`, `merchant_id`, `listing_title`, `listing_url`, `current_availability`). Perubahan toko penjual tidak mengubah identitas `Product`.
5. **`AffiliateDestination`:** Metadata teknis pelacakan komersial keluar (`destination_id`, `provider`, `affiliate_destination_url`, `is_active`). Bebas dari skor editorial.
6. **`SpecSnapshot`:** Rekaman terversi spesifikasi teknis (`specs`, `source_fidelity`, `captured_at`). Nilai numerik hanya dicatat jika benar-benar disediakan sumber terverifikasi.
7. **`PriceSnapshot`:** Rekaman berkala harga pasar (`observed_price`, `currency`, `availability`, `captured_at`).
8. **`ReviewSnapshot`:** Rekaman sinyal ulasan eksternal (`external_review_count`, `recurring_themes`).
9. **`EvidenceSource`:** Dokumen acuan bukti (`source_type`, `source_url`, `publisher`, `claim_class`, `source_fidelity`).
10. **`ArticleProductBinding`:** Pengikatan produk ke artikel dengan peran editorial (`PRIMARY_SUBJECT`, `ALTERNATIVE`, `EXAMPLE`, `MATCHED_PRODUCT`, `RELATED_PRODUCT`) dan pengungkapan komersial (`CommercialDisclosure`).

---

## 5. Pendeteksian Pergeseran Identitas (Identity Drift)

Perubahan pada listing merchant (judul, foto, SKU) tidak boleh mengubah identitas produk kanonikal secara diam-diam. Status transisi identitas:
- `CURRENT`: Identitas terverifikasi aktif.
- `VARIANT_CHANGED`: SKU atau sub-model terdeteksi berbeda.
- `LISTING_AMBIGUOUS`: Judul listing merchant menyimpang jauh dari nama produk kanonikal.
- `IDENTITY_CHANGED`: Produk telah berganti generasi/revisi.
- `DISCONTINUED`: Produk resmi dihentikan produksinya.
- `UNAVAILABLE`: Tidak ada stok penawaran yang aktif.

---

## 6. Integrasi Handoff PDE & Evaluator Pencocokan Teknis

Meja Ulasan Produk mengonsumsi kontrak handoff deterministik dari Product Decision Engine (`ProductReviewHandoffContract`):
- `problem_id`
- `solution_class_id`
- `required_characteristics`
- `must_avoid_characteristics`
- `important_tradeoffs`
- `commercial_data_allowed: false`

### Status Kecocokan Kualitatif (Anti-Fake Precision):
- `MATCH`: Memenuhi seluruh karakteristik wajib tanpa kriteria larangan.
- `MATCH_WITH_TRADEOFF`: Memenuhi kelas solusi namun memerlukan kompromi tertentu.
- `CONDITIONAL_MATCH`: Memerlukan prasyarat instalasi khusus.
- `NOT_MATCH`: Tidak cocok atau melanggar karakteristik red-line (*must_avoid*).
- `INSUFFICIENT_EVIDENCE`: Spesifikasi teknis tidak mencukupi untuk penilaian deterministik. **Dilarang menebak kualitas produk.**

---

## 7. Tembok Perlindungan Komersial & Sponsorship (Commercial Firewall)

- Fungsi validasi rekursif `scanForForbiddenReviewCommerceFields()` menolak keberadaan properti komersial pada objek keputusan teknis:
  - `commission`, `commission_rate`, `payout`, `affiliate_priority`, `merchant_priority`, `sponsored_rank`, `ad_budget`, `revenue_score`, `winner_score`, `star_rating`.
- **Sponsorship Firewall:** Status kemitraan komersial (`is_sponsored_content = true`, `is_product_supplied_by_brand = true`) wajib dicatat dalam `CommercialDisclosure`, namun **DILARANG MENGUBAH HASIL KECOCOKAN TEKNIS** atau menyembunyikan kelemahan produk.

---

## 8. Alur Kerja Editorial Product Review Desk (Staff Roles)

Alur kerja redaksional multi-disiplin RancangLoka ditegakkan tanpa otomasi sepihak:
1. **Irwan (Research & Source Acquisition):** Memverifikasi identitas produk, spesifikasi teknis, dan sumber bukti otoritatif.
2. **Joko (Authoring & Contextual Writing):** Menyusun ulasan mendalam berbasis komparasi kebutuhan pembaca.
3. **Budi (Media Production):** Memverifikasi hak cipta dan provenansi foto produk asli.
4. **Nadia (Audience & Reader Voice QA):** Mengawasi kehangatan nada ulasan (*Warm Advisory Tone*) dan kejelasan bahasa.
5. **Rina (Editorial Integrity QA):** Memverifikasi kesesuaian klaim terhadap lembar bukti dan kebenaran teknis.
6. **Chief Editor (Human Approval Boundary):** Memberikan otorisasi final sebelum publikasi.
7. **Sari (Publication Delivery):** Mengelola jadwal tayang dan audit penerimaan edge.
8. **Dimas (Post-Publication Observability):** Memantau integritas tautan dan observabilitas pasca-publikasi.

---

## 9. Hasil Pengujian Kontrak Data (`test-product-review-contract.js`)

Seluruh 22 skenario pengujian arsitektur dan kontrak data (A sampai V) lulus 100%:
- `Test A`: Entitas Product memvalidasi dengan benar.
- `Test B`: Entitas Variant memvalidasi dengan benar.
- `Test C`: Entitas Offer memvalidasi dengan benar.
- `Test D`: Entitas EvidenceSource memvalidasi dengan benar.
- `Test E`: Entitas SpecSnapshot memvalidasi dengan benar.
- `Test F`: Entitas PriceSnapshot memvalidasi dengan benar.
- `Test G`: Entitas ReviewSnapshot memvalidasi dengan benar.
- `Test H`: Entitas ArticleProductBinding memvalidasi dengan benar.
- `Test I`: `ANALYTICAL_REVIEW` dilarang mengklaim *Tested by RancangLoka*.
- `Test J`: `HANDS_ON_REVIEW` mewajibkan provenansi pengujian primer.
- `Test K`: Ulasan pengguna tetap berstatus `USER_EXPERIENCE_SIGNAL`.
- `Test L`: Perubahan komisi afiliasi tidak mengubah identitas teknis produk.
- `Test M`: Perubahan destinasi afiliasi tidak mengubah sumber bukti.
- `Test N`: Perubahan harga pasar tidak mengubah identitas spesifikasi produk.
- `Test O`: Hubungan sponsorship tidak mempengaruhi input pencocokan teknis.
- `Test P`: Bidang prioritas merchant ditolak dari kontrak evaluasi teknis.
- `Test Q`: Pergeseran identitas (*identity drift*) terdeteksi secara deterministik.
- `Test R`: Ketiadaan spesifikasi teknis andal menghasilkan `INSUFFICIENT_EVIDENCE`.
- `Test S`: Nol skor angka semu dalam hasil evaluasi teknis.
- `Test T`: Handoff PDE terbukti bebas dari data komersial.
- `Test U`: Fixture sintesis tidak meniru merek riil komersial.
- `Test V`: Nol dependensi jaringan / Cloudflare D1 / runtime Astro.

---

## 10. Canonical Roadmap Sequence & Milestone Definitions

Roadmap canonical untuk inisiatif `PRODUCT_REVIEW_AFFILIATE_1`:
1. **`PRODUCT_REVIEW_AFFILIATE_1A`:** Product Review Desk Architecture + Pure Data Contract (STATUS: `CLOSED / PASS`)
2. **`PRODUCT_REVIEW_AFFILIATE_1B`:** Product Review Desk Persistence Foundation & Technical Match Assembler (STATUS: `CLOSED / PASS`)
3. **`PRODUCT_REVIEW_AFFILIATE_1C`:** Admin Product Review Desk & Editorial Inspector (TARGET BERIKUTNYA)
4. **`PRODUCT_REVIEW_AFFILIATE_1D`:** Article Product Binding, Reader Decision Handoff & Edge Integration

---

## 11. Milestone 1B: Product Review Desk Persistence Foundation

### A. Batasan Skema Relasional vs JSON (`db/migrations/0036_product_review_desk.sql`)
Arsitektur database dirancang seimbang menghindari ekstrim tabel terlalu banyak maupun satu blob JSON raksasa:
- **Relasional Otoritatif:**
  - `product_review_products`: Identitas kanonikal produk fisik murni (`product_id`, `canonical_name`, `brand`, `category_id`, `solution_class_id`, `identity_state`). Bebas dari state review editorial.
  - `product_review_editorial_reviews`: State ulasan editorial RancangLoka (`review_id`, `product_id`, `variant_id`, `article_id`, `review_mode`, `tested_by_rancangloka`, `testing_provenance_json`, `editorial_status`). Mendukung banyak ulasan per produk.
  - `product_review_variants`: Identitas SKU fisik dan varian teknis.
  - `product_review_evidence_sources`: Provenansi sumber bukti, tipe, fidelitas, dan claim class.
  - `product_review_offers`: Penawaran komersial per merchant listing.
  - `product_review_affiliate_destinations`: Tautan keluar berpelacak komersial, terisolasi penuh dari ranking teknis.
  - `product_review_article_bindings`: Pengikatan relasional antara artikel dan produk dengan peran editorial (`ArticleProductRole`).
- **Append-Oriented Observation Snapshots:**
  - `product_review_spec_snapshots`: Snapshot spesifikasi terukur berbasis waktu dan bukti.
  - `product_review_review_snapshots`: Snapshot sinyal pengalaman pengguna eksternal (`USER_EXPERIENCE_SIGNAL`).
  - `product_review_price_snapshots`: Snapshot harga dinamis pasar (`observed_price`).
- **JSON Terstruktur (Field Tertentu):** Digunakan untuk atribut dinamis terukur (`specs_json`, `attributes_json`, `recurring_themes_json`, `tracking_metadata_json`, `commercial_disclosure_json`).

### B. Imutabilitas Identitas & Pencegahan Mutasi Diam-diam
- Invarian `COMMERCE_CHANGE_MUST_NOT_MUTATE_EDITORIAL_IDENTITY`: Perubahan harga, pergantian seller/toko, atau pergantian link afiliasi dilarang keras mengubah `product_id`, `variant_id`, atau provenansi lembar bukti.
- Invarian `SNAPSHOTS_ARE_APPEND_ORIENTED_OBSERVATIONS`: Snapshot tidak pernah di-UPDATE di tempat (*no update in place*). Setiap observasi baru membentuk baris baru dengan snapshot hash deterministik SHA-256. Duplikasi identik menghasilkan status `ALREADY_EXISTS_IDENTICAL`, sedangkan tabrakan konten menghasilkan `BLOCKED_SNAPSHOT_CONFLICT`.

### C. Kebijakan Kesegaran Data Terpusat & Terkonfigurasi (`freshness.ts`)
Invarian `FRESHNESS_POLICY_MUST_BE_CONFIGURABLE_AND_EXPLICIT` ditegakkan melalui modul kebijakan terpusat `DEFAULT_FRESHNESS_POLICY`:
- `product_identity_max_age_days`: 180 hari
- `spec_snapshot_max_age_days`: 90 hari
- `review_snapshot_max_age_days`: 30 hari
- `offer_max_age_days`: 7 hari
- `price_snapshot_max_age_hours`: 48 jam
- Mendukung override dinamis berdasarkan kategori produk dan sumber bukti tanpa perubahan skema.

### D. Tembok Pembatas Input Pencocokan Teknis (`assembleTechnicalMatchInput`)
- Invarian `TECHNICAL_MATCH_INPUT_MUST_BE_COMMERCE_BLIND`: Fungsi assembler memindai seluruh masukan dan secara tegas menolak bila ditemukan field komersial (`commission`, `payout`, `affiliate_priority`, dll.).
- Output DTO hanya memuat karakteristik fisik, varian, spesifikasi terverifikasi, dan klaim resmi.

### E. Halaman Inspeksi Admin Terisolasi (`/admin/product-review`)
- Route inspeksi privat hanya-baca (*read-only*), terproteksi auth admin, dengan header `Cache-Control: no-store, private` dan `X-Robots-Tag: noindex, nofollow`.
- Memisahkan secara visual antara blok DATA TEKNIS / BUKTI EDITORIAL dengan blok PENAWARAN MERCHANT / AFILIASI KOMERSIAL.

### F. Hasil Pengujian Persistensi (`test-product-review-persistence.js`)
Seluruh 26 skenario pengujian (A sampai Z) terbukti 100% lulus:
- `Test A`: Migrasi 0036 teraplikasi bersih di database uji lokal.
- `Test B` - `Test K`: Persistensi seluruh entitas (Product, Variant, EvidenceSource, SpecSnapshot, Offer, PriceSnapshot, ReviewSnapshot, AffiliateDestination, CommercialDisclosure, ArticleProductBinding).
- `Test L`: Round-trip identitas produk sintesis utuh tanpa kehilangan data.
- `Test M`: Idempotensi insert data duplikat identik.
- `Test N`: Konflik payload snapshot imutabel diblokir.
- `Test O` - `Test R`: Mutasi komersial (harga, merchant, link afiliasi, disclosure sponsor) terbukti 0% mempengaruhi input pencocokan teknis (deep-equal).
- `Test S`: Perubahan spesifikasi fisik terbukti mempengaruhi input teknis.
- `Test T`: Perubahan provenansi sumber bukti terdeteksi.
- `Test U` - `Test W`: Penegakan review mode, keharusan provenansi lab untuk hands-on, dan status review eksternal sebagai sinyal.
- `Test X` - `Test Z`: Nol skor angka semu, nol koneksi remote produksi, dan semantik evaluasi PDE eksisting 100% terjaga.

---

## 12. Milestone 1C: Admin Product Review Desk & Editorial Inspector

### A. Informasi Arsitektur & Antarmuka Meja Ulasan (`/admin/product-review`)
RancangLoka membangun antarmuka privat khusus redaksi (*Editorial Inspector*) yang menerapkan pemisahan visual mutlak antara pertimbangan fisik arsitektural dan penawaran komersial:
1. **Daftar Produk (Product List):**
   - Menampilkan `canonical_name`, `brand`, `solution_class_id`, `identity_state`, jumlah varian, jumlah ulasan, mode ulasan terakhir, status kesegaran bukti, status kecocokan teknis, dan kesiapan editorial.
   - **Invarian Ranking:** Dilarang menampilkan komisi, payout merchant, atau prioritas sponsor sebagai parameter ranking daftar. Produk tidak pernah disortir berdasarkan komisi.
2. **Inspektur Detail Produk (Product Detail Inspector):**
   - Menggunakan navigasi berbasis tab/seksi dengan pendekatan SSR (*minimal client JS*):
     - **Ringkasan & Kesiapan (Overview & Readiness):** Audit kesiapan menyeluruh dan ringkasan entitas.
     - **Identitas & Varian (Product Identity & Variants):** Menampilkan identitas murni (`product_id`, `brand`, `canonical_name`, `category_id`, `solution_class_id`, `identity_state`) dan sub-model varian tanpa mencampur review mode.
     - **Ulasan Editorial RancangLoka (Editorial Reviews):** Catatan historis ulasan redaksi (`EditorialProductReview`), membedakan `ANALYTICAL_REVIEW` dengan `HANDS_ON_REVIEW`.
     - **Bukti & Spesifikasi Fisik (Evidence & Specs):** Rekaman spesifikasi terukur (`SpecSnapshot`) dan daftar dokumen acuan terverifikasi (`EvidenceSource`) tanpa *source collapsing* tersembunyi.
     - **Pencocokan Teknis PDE (Technical Match Panel):** Evaluasi kecocokan kualitatif terhadap kelas solusi PDE (`MATCH`, `MATCH_WITH_TRADEOFF`, dll.) serta penayangan masukan konteks hunian (`ProductReviewHandoffContract` - read only). Nol skor angka, nol data harga/komisi.
     - **Pengalaman Pengguna Eksternal (External Review Signals):** Rekaman sinyal ulasan toko/pembeli bertanda `USER_EXPERIENCE_SIGNAL` yang tidak dicampur dengan ulasan editorial dan tidak dihitung ke skor teknis.
     - **Penawaran Komersial (Commerce / Offer Layer):** Penawaran merchant aktif dan harga volatil pasar, dilengkapi deklarasi wajib: *"Data komersial tidak memengaruhi penilaian teknis."*
     - **Transparansi & Afiliasi (Commercial Disclosure):** Pengungkapan hubungan afiliasi, sponsor, dan sampel barang.
     - **Pergeseran Identitas (Identity Drift):** Pendeteksian penyimpangan judul/SKU listing toko dengan peringatan redaksi tanpa *auto-overwrite*.
     - **Dashboard Kesegaran (Freshness Dashboard):** Evaluasi independen kesegaran spesifikasi, ulasan eksternal, dan harga pasar tanpa dilebur menjadi skor tunggal semu.

### B. Label Sumber Data & Keamanan Akses
- Invarian `ADMIN_MUST_KNOW_WHICH_DATA_SOURCE_IS_BEING_INSPECTED`: Antarmuka secara eksplisit menampilkan badge dan banner sumber data:
  - `SYNTHETIC_TEST_DATA` (dengan tanda tegas `DEVELOPMENT / TEST DATA`)
  - `LOCAL_DATABASE`
  - `PRODUCTION_D1`
- Akses route terproteksi via middleware admin (`isValidAdminSession`) dengan header privasi:
  - `Cache-Control: no-store, private`
  - `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`
  - Nol tautan publik dari header, footer, atau sitemap.

### C. State Kesiapan Editorial (Editorial Readiness States)
State kesiapan redaksi diturunkan secara deterministik (*read-only guidance*):
- `READY_FOR_EDITORIAL_REVIEW`: Identitas valid, bukti lengkap, spesifikasi segar, dan evaluasi teknis terpenuhi.
- `EVIDENCE_INCOMPLETE`: Belum ada dokumen bukti acuan yang dilampirkan.
- `SPEC_STALE`: Snapshot spesifikasi teknis telah kadaluarsa (> 90 hari).
- `IDENTITY_REVIEW_REQUIRED`: Terdeteksi pergeseran identitas listing merchant.
- `HANDS_ON_PROVENANCE_INCOMPLETE`: Ulasan Hands-On tidak memiliki catatan metodologi, penguji, lokasi, atau uji lab primer.
- `INSUFFICIENT_TECHNICAL_EVIDENCE`: Bukti spesifikasi belum mencukupi untuk keputusan kecocokan.

### D. Penanganan Empty State & Tanpa Otomasi
- Desain *empty state* eksplisit: *"Belum ada produk yang masuk ke Product Review Desk."*
- Sistem tidak melempar error saat tabel database produksi belum tersedia pada fase pra-produksi.
- Tidak ada kontrol publikasi/persetujuan otomatis (*no autonomous publication*); Chief Editor memegang otoritas penuh.

### E. Hasil Pengujian Admin Inspector (`test-product-review-admin.js`)
Seluruh 24 skenario pengujian inspektur admin (Test A sampai Test X) lulus 100%:
- `Test A`: Route admin `/admin/product-review` tersedia di disk.
- `Test B`: Middleware admin memproteksi route dengan sesi admin valid.
- `Test C`: Header `Cache-Control: no-store, private` terpasang.
- `Test D`: Header `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` terpasang.
- `Test E`: Identitas produk ditampilkan terpisah dari state ulasan.
- `Test F`: Entitas `EditorialProductReview` terpisah dan mendukung multi-ulasan.
- `Test G`: Ulasan analitis tidak dapat menampilkan badge *Tested by RancangLoka*.
- `Test H`: Ulasan Hands-On menampilkan provenansi pengujian fisik primer lengkap.
- `Test I`: Ulasan Hands-On tanpa provenansi memicu peringatan `HANDS_ON_PROVENANCE_INCOMPLETE`.
- `Test J`: Ulasan eksternal bertanda eksplisit `USER_EXPERIENCE_SIGNAL`.
- `Test K`: Panel pencocokan teknis terbebas dari seluruh bidang komersial.
- `Test L`: Penawaran komersial tidak dapat mengubah hasil kecocokan teknis.
- `Test M`: Nol skor angka semu (kesesuaian kualitatif murni).
- `Test N`: Fidelitas bukti dan kelas klaim terlihat tanpa *source collapsing*.
- `Test O`: Status kesegaran per entitas terpisah tanpa skor gabungan.
- `Test P`: Peringatan pergeseran identitas muncul bila state !== CURRENT.
- `Test Q`: Handoff PDE berstatus hanya-baca (*read-only*).
- `Test R`: Pengungkapan transparansi komersial dan sponsor terlihat jelas.
- `Test S`: Sumber data `SYNTHETIC_TEST_DATA` terlabeli secara tegas.
- `Test T`: Data uji sintesis ditandai `DEVELOPMENT / TEST DATA`.
- `Test U`: Fitur *empty state* berfungsi bersih tanpa error runtime.
- `Test V`: Nol eksposur route ke navigasi publik atau sitemap.
- `Test W`: Nol kontrol otomatisasi penerbitan/afiliasi mandiri.
- `Test X`: Pengujian 100% offline tanpa ketergantungan koneksi D1 produksi.

---

*Status Milestone Sebelumnya: `PRODUCT_REVIEW_AFFILIATE_1C_PASS` (`PRODUCT_REVIEW_AFFILIATE_1C_CLOSED`)*
*Status Milestone Saat Ini: `PRODUCT_REVIEW_AFFILIATE_1D_A_PASS` (Local / Pre-Production Integration Prep)*
*Target Milestone Berikutnya: `PRODUCT_REVIEW_AFFILIATE_1D_B` (Controlled Production Activation & Pilot Integration)*

---

## 13. Milestone 1D-A: Article Product Binding, Reader Decision Handoff & Edge Integration Prep

### A. Runtime Article Product Binding (`ArticleProductBinding`)
- Hubungan kanonikal antara artikel, produk, varian teknis, peran editorial (`ArticleProductRole`), dan jangkar bagian (`section_anchor`).
- **Invarian Penting:** Dilarang mengkodekan skor rekomendasi, komisi, payout afiliasi, atau prioritas merchant ke dalam `ArticleProductBinding`. Penempatan artikel murni berbasis relevansi arsitektur, bukan peringkat komersial.
- **Peran Editorial Kanonikal:**
  - `MATCHED_PRODUCT`: Produk pasaran yang spesifikasi fisiknya terbukti cocok dengan keputusan solusi arsitektur.
  - `PRIMARY_SUBJECT`: Produk yang menjadi fokus ulasan mendalam pada artikel ulasan produk.
  - `ALTERNATIVE`: Produk dari kelas solusi alternatif untuk perbandingan kebutuhan rumah berbeda.
  - `EXAMPLE`: Contoh material fisik yang beredar di distributor Indonesia.
  - `RELATED_PRODUCT`: Komponen pendukung (private / reserved secara default).

### B. Kontrak Reader Decision Handoff dari PDE
- Mengonsumsi `ProductReviewHandoffContract` murni dari Product Decision Engine (PDE).
- Memuat: `problem_id`, `solution_class_id`, `required_characteristics`, `important_tradeoffs`, `must_avoid_characteristics`, `context_summary`, `model_version_key`, `evidence_version`, dan penegasan `commercial_data_allowed = false`.
- Product Review Desk murni menerima (*read-only*), tanpa pernah memutasi atau menafsir ulang rekomendasi upstream PDE.

### C. DTO Aman Pembaca (`ReaderProductDTO`)
- Entitas publik terpisah yang bersih dari seluruh metadata internal:
  - Dihapus: hash internal, catatan admin, identitas/kontak pribadi penguji, lokasi workshop privat, trace bukti mentah, payout afiliasi, rate komisi, dan metrik prioritas merchant.
  - Dilarang: Skor numerik, peringkat bintang (*star rating*), atau skor angka semu.
- Label Ulasan Transparan:
  - `ANALYTICAL_REVIEW`: Menampilkan *"Analisis berbasis spesifikasi fisik terverifikasi, manual teknis pabrikan, dan konsensus material bangunan tropis (Bukan uji lab fisik)"*. Dilarang menampilkan *Tested by RancangLoka*.
  - `HANDS_ON_REVIEW`: Hanya menampilkan *Tested by RancangLoka* jika lolos verifikasi provenansi uji fisik primer.

### D. Gerbang Kelayakan Produk Pembaca (`deriveReaderProductEligibility`)
Produk hanya dapat direkomendasikan kepada pembaca jika memenuhi gerbang kelayakan murni teknis:
- Identitas produk berstatus `CURRENT` (lolos tanpa *identity drift*).
- Memiliki ulasan editorial resmi terdaftar.
- Hasil pencocokan teknis bukan `NOT_MATCH` dan bukan `INSUFFICIENT_EVIDENCE`.
- Snapshot spesifikasi teknis masih segar (`SPEC_FRESH`, usia <= 90 hari).
- State kelayakan: `ELIGIBLE`, `ELIGIBLE_WITH_TRADEOFF`, `BLOCKED_INSUFFICIENT_EVIDENCE`, `BLOCKED_STALE_SPEC`, `BLOCKED_IDENTITY_DRIFT`, `BLOCKED_TECHNICAL_MISMATCH`, atau `BLOCKED_EDITORIAL_REVIEW`.

### E. Pemisahan Kesegaran Teknis vs Kesegaran Komersial
- **Kesegaran Teknis:** Menentukan kelayakan rekomendasi arsitektur fisik (ambang 90 hari). Spesifikasi kadaluarsa memblokir rekomendasi produk.
- **Kesegaran Komersial:** Menentukan keakuratan harga observasi pasar (ambang 48 jam). Harga kadaluarsa atau ketiadaan toko/stok TIDAK menggugurkan analisis teknis produk yang valid.

### F. Batasan Penawaran Harga & CTA Afiliasi
- Harga pasar tidak pernah disuntikkan ke dalam teks prosa artikel yang statis dan abadi.
- Wording CTA netral redaksional: *"Cek harga & varian di toko mitra"*, *"Periksa ketersediaan & harga terkini"*. Menghindari bahasa klikbait/FOMO (*"BELI SEKARANG"*, *"BEST DEAL"*).
- Seluruh tautan afiliasi keluar otomatis menggunakan atribut: `rel="sponsored nofollow noopener"` dan `target="_blank"`.
- Transparansi pengungkapan komersial (`commercial_disclosure`) terpisah secara struktural dari kesimpulan ulasan teknis.

### G. Batasan SEO, Penempatan Artikel & Data Terstruktur
- **Penempatan:** Muncul SETELAH pembaca memahami kelas solusi/material, SEBELUM aksi pengadaan/pemasangan akhir.
- **SEO Invariant:** `NO_THIN_AFFILIATE_SEO_PAGES`. Kartu produk menyatu di dalam halaman artikel kanonikal. Tidak ada URL kombinasi filter/merchant/harga yang dapat diindeks crawler.
- **Data Terstruktur:** Dilarang mengarang Schema.org Product/Review sebelum ada data pasar riil yang terverifikasi.

### H. Batasan DNA Publikasi & Imutabilitas Prosa Artikel
- **Invarian Permanen:** `DYNAMIC_COMMERCE_DATA_MUST_NOT_INVALIDATE_ARTICLE_PROVENANCE`.
- Data modul produk dan harga dinamis dilampirkan saat SSR edge di luar hash prosa artikel.
- Prosa artikel, `articles.content_hash`, `published_at`, dan tanda terima penerbitan asli bersifat abadi (100% bit-identical).

### I. Invarian Fallback Produksi
- **Invarian Permanen:** `NO_SILENT_PRODUCT_REVIEW_PRODUCTION_FALLBACK`.
- Runtime produksi dilarang menukar data D1 yang hilang dengan fixture sintesis. Data sintesis hanya diizinkan secara eksplisit pada mode test/development offline.

### J. Hasil Pengujian Reader Boundary (`test-product-review-reader-boundary.js`)
Seluruh 22 skenario pengujian (Test A sampai Test V) terbukti 100% lulus:
- `Test A`: Resolusi `ArticleProductBinding` valid dan terikat ke artikel.
- `Test B`: Handoff PDE terbukti hanya-baca (*read-only*).
- `Test C`: Produk layak terpetakan ke `ReaderProductDTO` aman pembaca.
- `Test D`: `NOT_MATCH` memblokir rekomendasi ke pembaca.
- `Test E`: `INSUFFICIENT_EVIDENCE` memblokir rekomendasi.
- `Test F`: Spesifikasi teknis kadaluarsa memblokir rekomendasi (`BLOCKED_STALE_SPEC`).
- `Test G`: Pergeseran identitas memblokir rekomendasi (`BLOCKED_IDENTITY_DRIFT`).
- `Test H`: Ulasan analitis tidak pernah menampilkan *Tested by RancangLoka*.
- `Test I`: Ulasan Hands-On valid berhak menampilkan *Tested by RancangLoka*.
- `Test J`: Data komersial tidak dapat mengubah kelayakan teknis produk.
- `Test K`: Perubahan harga observasi tidak mengubah kelayakan teknis produk.
- `Test L`: Perubahan link afiliasi tidak mengubah kelayakan teknis produk.
- `Test M`: Hubungan sponsorship tidak mengubah status kelayakan teknis.
- `Test N`: Ketiadaan data komersial tidak menghapus analisis teknis yang valid.
- `Test O`: Nol komisi / payout pada DTO pembaca.
- `Test P`: Nol catatan admin / identitas penguji privat / trace bukti mentah.
- `Test Q`: Nol skor angka semu atau ranking numerik.
- `Test R`: Helper tautan afiliasi menyertakan `rel="sponsored nofollow noopener"`.
- `Test S`: Fixture sintesis diblokir tegas dari mode produksi.
- `Test T`: Nol fallback diam-diam pada mode produksi.
- `Test U`: Mutasi komersial dinamis terbukti 0% memutasi hash atau teks prosa artikel kanonikal.
- `Test V`: Pengujian 100% offline tanpa dependensi produk riil, merchant, atau jaringan.
- `Test W`: Ulasan editorial `DRAFT` diblokir mutlak dari DTO pembaca.
- `Test X`: Ulasan editorial `REVIEWED` (belum terbit) diblokir dari DTO pembaca.
- `Test Y`: Ulasan editorial `ARCHIVED` diblokir dari DTO pembaca.
- `Test Z`: Ulasan editorial `PUBLISHED` lolos kualifikasi saat seluruh syarat terpenuhi.
- `Test AA`: Peran `RELATED_PRODUCT` diblokir mutlak dari perenderan pembaca secara default.
- `Test AB`: Kebijakan visibilitas peran `isArticleProductRoleReaderVisible` terverifikasi deterministik.

---

## 7. Milestone 1D-B: Aktivasi Produksi Terkendali & Penutupan Final (Controlled Production Activation & Final Closure)

### A. Invarian Status Editorial Pembaca (Reader Editorial Status Invariant)
- **Invarian Permanen:** `UNPUBLISHED_EDITORIAL_REVIEW_MUST_NEVER_REACH_READER_OUTPUT`.
- Entri ulasan editorial berstatus `DRAFT`, `REVIEWED`, atau `ARCHIVED` diblokir secara deterministik (`BLOCKED_EDITORIAL_REVIEW`).
- Hanya ulasan berstatus `PUBLISHED` yang berhak berkontribusi ke output DTO pembaca.

### B. Kebijakan Visibilitas Peran Produk Artikel (Article Product Role Visibility)
- Peran `RELATED_PRODUCT` didefinisikan sebagai private/internal redaksi secara default dan TIDAK dirender ke pembaca.
- Fungsi pembatas terketik: `isArticleProductRoleReaderVisible(role: ArticleProductRole): boolean`.
- Peran publik sah: `MATCHED_PRODUCT`, `PRIMARY_SUBJECT`, `ALTERNATIVE`, `EXAMPLE`.

### C. Urutan Evaluasi Kelayakan Pembaca Deterministik (12 Tahap)
1. Keberadaan ikatan (`binding exists`).
2. Peran ikatan layak tampil ke publik (`binding role publicly eligible`).
3. Identitas produk berstatus `CURRENT`.
4. Varian produk valid.
5. `EditorialProductReview` terdaftar.
6. `editorial_status === 'PUBLISHED'`.
7. Provenansi ulasan valid (termasuk verifikasi lab primer untuk Hands-On).
8. Bukti teknis otoritatif mencukupi.
9. Kesegaran spesifikasi kritis dapat diterima.
10. Kecocokan teknis (`technical_match`) berstatus `STRONG_FIT` atau `MODERATE_FIT`.
11. DTO aman pembaca dihasilkan (bebas komisi, skor angka, atau data privat).
12. Data penawaran komersial dilampirkan secara opsional di hilir (*downstream attachment*).

### D. Hasil Audit & Eksekusi Migrasi 0036 di Produksi
- **Audit Pra-Migrasi:** D1 `rancangloka_db` remote bersih, migrasi `0036_product_review_desk.sql` berstatus `PENDING`, 0 tabel `product_review_%`.
- **Aplikasi Migrasi:** Sukses diterapkan via Wrangler remote D1:
  - `product_review_products`
  - `product_review_variants`
  - `product_review_editorial_reviews`
  - `product_review_evidence_sources`
  - `product_review_spec_snapshots`
  - `product_review_review_snapshots`
  - `product_review_offers`
  - `product_review_price_snapshots`
  - `product_review_affiliate_destinations`
  - `product_review_article_bindings`
- **Total Indeks:** 35 indeks terverifikasi aktif.
- **Invarian Integritas:** `SCHEMA_ACTIVATION_MUST_NOT_IMPLY_PRODUCT_INGESTION` (tepat 0 baris pada seluruh 10 tabel).

### E. Status Deployment Worker Produksi
- **Active Worker Version ID:** `dea95d68-1708-4af7-8c02-3ea35c3af5ad`.
- **Admin Desk (/admin/product-review):** Berhasil terhubung ke D1 Produksi, menampilkan label `PRODUCTION_D1`, status kosong (`Belum ada produk yang masuk ke Product Review Desk.`), dilindungi Cloudflare Access (302 redirect), `Cache-Control: no-store, private`, `X-Robots-Tag: noindex`.
- **Halaman Publik:** Nol kebocoran kartu produk, harga, tombol belanja, atau modul komersial di halaman publik (Homepage, Artikel 5, Artikel 9).
- **Integritas Artikel 5–9:** Hash prosa Artikel 5 (`14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277`), receipt (`rcpt_bbae85b48e1b2f8d`), dan artikel 6–9 tetap 100% utuh tanpa mutasi.
