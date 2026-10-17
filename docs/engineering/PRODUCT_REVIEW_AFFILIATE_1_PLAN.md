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

## 4. Model Entitas Inti (Core Entities)

Arsitektur data dirancang dengan pemisahan peran yang bersih guna mencegah ledakan entitas (*entity explosion*):

```text
┌─────────────────────────────────────────────────────────────┐
│                           PRODUCT                           │
│  (Identitas Kanonikal: Brand, Nama Produk, Solution Class) │
└──────┬───────────────────────┬──────────────────────────────┘
       │                       │
       ▼                       ▼
┌──────────────┐       ┌────────────────────────┐
│   VARIANT    │       │     SPEC SNAPSHOT      │
│ (SKU / Warna)│       │ (Spesifikasi Terversi) │
└──────┬───────┘       └────────────────────────┘
       │
       ▼
┌──────────────┐       ┌────────────────────────┐
│    OFFER     │◄──────┤     PRICE SNAPSHOT     │
│ (Listing Toko│       │   (Harga Volatil)      │
└──────┬───────┘       └────────────────────────┘
       │
       ▼
┌───────────────────────────┐
│   AFFILIATE DESTINATION   │
│  (Tautan Merchant / Out)  │
└───────────────────────────┘
```

1. **`Product`:** Identitas kanonikal produk independen dari toko (`product_id`, `brand`, `canonical_name`, `solution_class_id`, `identity_state`, `review_mode`).
2. **`Variant`:** Konfigurasi fisik, dimensi, atau sub-tipe spesifik (`variant_id`, `sku_or_model`, `variant_name`).
3. **`Offer`:** Penawaran komersial dari merchant tertentu (`offer_id`, `merchant_id`, `listing_title`, `listing_url`, `current_availability`). Perubahan toko penjual tidak mengubah identitas `Product`.
4. **`AffiliateDestination`:** Metadata teknis pelacakan komersial keluar (`destination_id`, `provider`, `affiliate_destination_url`, `is_active`). Bebas dari skor editorial.
5. **`SpecSnapshot`:** Rekaman terversi spesifikasi teknis (`specs`, `source_fidelity`, `captured_at`). Nilai numerik hanya dicatat jika benar-benar disediakan sumber terverifikasi.
6. **`PriceSnapshot`:** Rekaman berkala harga pasar (`observed_price`, `currency`, `availability`, `captured_at`).
7. **`ReviewSnapshot`:** Rekaman sinyal ulasan eksternal (`external_review_count`, `recurring_themes`).
8. **`EvidenceSource`:** Dokumen acuan bukti (`source_type`, `source_url`, `publisher`, `claim_class`, `source_fidelity`).
9. **`ArticleProductBinding`:** Pengikatan produk ke artikel dengan peran editorial (`PRIMARY_SUBJECT`, `ALTERNATIVE`, `EXAMPLE`, `MATCHED_PRODUCT`, `RELATED_PRODUCT`) dan pengungkapan komersial (`CommercialDisclosure`).

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

*Status Milestone: `PRODUCT_REVIEW_AFFILIATE_1A_PASS`*  
*Status Sesi: `READY_FOR_PRODUCT_REVIEW_AFFILIATE_1B`*
