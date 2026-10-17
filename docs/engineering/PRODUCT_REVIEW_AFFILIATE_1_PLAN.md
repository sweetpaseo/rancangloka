# 🛍️ RancangLoka Product Review Desk & Affiliate Firewall — Master Architecture & Data Contract Plan
> **Dokumen Arsitektur & Spesifikasi Kontrak Data:** Milestone `PRODUCT_REVIEW_AFFILIATE_1A`  
> **Status:** APPROVED & ARCHITECTURALLY CLOSED (`PRODUCT_REVIEW_AFFILIATE_1A_PASS`)  
> **Target Milestone Berikutnya:** `PRODUCT_REVIEW_AFFILIATE_1B`  
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

*Status Milestone Sebelumnya: `PRODUCT_REVIEW_AFFILIATE_1B_PASS`*
*Status Milestone Saat Ini: `PRODUCT_REVIEW_AFFILIATE_1C_PASS` (`PRODUCT_REVIEW_AFFILIATE_1C_CLOSED`)*
*Target Milestone Berikutnya: `PRODUCT_REVIEW_AFFILIATE_1D` (Article Product Binding, Reader Decision Handoff & Edge Integration)*
