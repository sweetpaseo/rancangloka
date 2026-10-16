# 🧬 RancangLoka — CONTENT_PROTECTION-1B Architecture & Implementation Plan
## Phase 1B: Publication DNA (Provenance, Cryptographic Identity & Forensic Similarity)

**Milestone:** `CONTENT_PROTECTION-1B`
**Phase:** `PUBLICATION DNA DATA-CONTRACT HARDENING & FINAL PLANNING`
**Parent Blueprint:** [`docs/engineering/CONTENT_PROTECTION_1_BLUEPRINT.md`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/docs/engineering/CONTENT_PROTECTION_1_BLUEPRINT.md)
**Target Repository:** `rancangloka-astro/`
**Status:** `CONTENT_PROTECTION_1B_FINAL_PLAN_PASS`
**Date:** 2026-10-16
**Current Production Worker:** `624b040f-52ed-4fde-8b6b-fd4d3d413586`
**Current Source HEAD:** `0271e8d`
**Branch:** `feat/jev-lokamedia-integration`

---

## 1. Executive Summary & Purpose

Inisiatif **CONTENT_PROTECTION-1B (Publication DNA)** menetapkan kontrak data, arsitektur pencatatan identitas, provenansi otoritatif, dan bukti kemiripan (*similarity evidence*) yang kokoh, deterministik, dan dapat diverifikasi untuk seluruh naskah yang diterbitkan oleh redaksi RancangLoka.

### Objektif Inti (Core Purpose):
Memungkinkan RancangLoka di masa depan membuktikan secara matematis, historis, dan forensik:
1. **Naskah Apa yang Disetujui:** Naskah kanonikal persis yang disetujui oleh Chief Editor (`approved_content_hash`).
2. **Naskah Apa yang Diterbitkan:** Konten aktual persis yang aktif di web publik (`published_content_hash`).
3. **Kapan Diterbitkan:** Jejak waktu otoritatif yang dicatat langsung oleh server basis data (`actual_published_at` atau `historical_published_at`).
4. **Tanda Terima Apa yang Mengesahkan:** Identifier tanda terima penerbitan atomik (`publication_receipt_id`), atau penandaan eksplisit ketiadaan tanda terima untuk artikel historis pra-sistem.
5. **Aset Apa yang Melekat:** Hash SHA-256 dan silsilah aset media unggulan yang diotorisasi (`featured_asset_sha256`).
6. **Apakah Teks Pihak Ketiga Merupakan Derivasi/Kloning:** Bukti kemiripan struktural dan blok naskah ketika teks lain di web terbuka tampak disalin atau diaransemen ulang secara substansial.

### Invarian Permanen Mutlak:
> **`PUBLICATION_DNA_MUST_NOT_ALTER_EDITORIAL_PROSE`**
> *(Publication DNA dilarang keras mengubah, menyisipkan, mengganti, atau memanipulasi satu karakter pun dari prosa editorial yang dibaca oleh manusia.)*

---

## 2. Batas Filosofi: Publication DNA Bukan DRM

### Prinsip Kanonikal:
> **"PUBLIC WEB CONTENT CANNOT BE MADE IMPOSSIBLE TO COPY."**
> *(Konten web publik yang disajikan kepada peramban manusia dan mesin perayap secara matematis tidak dapat dicegah 100% untuk tidak disalin.)*

### Definisi Sejati Publication DNA:
Publication DNA adalah:
- **PROVENANCE (Provenansi):** Rekaman silsilah rantai kepemilikan editorial dari persetujuan manusia hingga penerbitan atomik.
- **IDENTITY (Identitas Kriptografis):** Sidik jari pasti (SHA-256) atas teks asli.
- **SIMILARITY EVIDENCE (Bukti Kemiripan):** Sinyal matematis pasif (blok semantik, MinHash, struktur) untuk membandingkan derajat tumpang-tindih.
- **FORENSIC SUPPORT (Dukungan Forensik):** Data pendukung bagi editor manusia dan penasihat hukum ketika mengevaluasi dugaan pelanggaran hak cipta.

### Batas yang TIDAK BOLEH Dilampaui:
Publication DNA **BUKAN**:
- ❌ **DRM (Digital Rights Management)**
- ❌ **Pencegah Penyalinan Otomatis (Copy Prevention)**
- ❌ **Hakim Hak Cipta Otomatis (Automatic Copyright Adjudication)**
- ❌ **Mesin Penuduh Pencurian Otomatis (Automatic Theft Accusation)**

Dilarang keras menggunakan bahasa yang mengklaim bahwa Publication DNA secara sepihak "membuktikan pelanggaran hak cipta secara hukum". Kemiripan matematis hanyalah alat bantu forensik; penentuan hukum tetap merupakan domain yurisdiksi dan pertimbangan manusia.

---

## 3. Larangan Teknik Manipulatif (Strictly Forbidden Techniques)

Publication DNA V1 **DILARANG KERAS** menggunakan teknik-teknik manipulatif berikut:

| Teknik Terlarang | Alasan Penolakan Redaksi |
|---|---|
| **Zero-width Unicode (`\u200B`, `\uFEFF`, dll.)** | Merusak aksesibilitas screen reader, membingungkan parser teks, rawan dihapus pembersih teks scraper cerdas. |
| **Karakter Tersembunyi / Homoglif** | Mengurangi kemurnian tipografi, mengaburkan pencarian teks di peramban pembaca. |
| **Marker HTML Tak Kasat Mata (`<span class="sr-only">`)** | Mengotori DOM artikel, berisiko penalti cloaking/hidden text oleh algoritma Google Search Quality. |
| **Tipografi Sengaja Dibuat Salah (Intentional Typos)** | **PELANGGARAN BERAT.** Merendahkan martabat editorial RancangLoka dan melanggar prinsip *Human Voice Layer v2*. |
| **Forced Synonym Substitution / Sentence Mutation** | Mengubah nuansa rasa bahasa (*flavor*) dan melanggar integritas prosa Joko & Nadia. |
| **Whitespace Steganography (Pola Spasi/Tab)** | Rentan hilang saat normalisasi peramban, tidak stabil lintas sistem operasi. |
| **Varian Prosa Terenkripsi** | Membebani komputasi SSR dan menciptakan inkonsistensi rendering. |
| **Teks CSS Tersembunyi (`opacity: 0`, `font-size: 0`)** | Pelanggaran pedoman webmaster Google (manipulasi indexing). |

### Status Komponen Pendukung:
- **Text Canaries:** Berstatus **`EXPERIMENTAL`** dan **`NOT PART OF V1`**.
- **AI Detector Scores:** Berstatus **`ADVISORY ONLY`**, **`NOT IDENTITY PROOF`**, dan **`NOT PLAGIARISM PROOF`** (mengikuti invarian Nadia & Jefry).

---

## 4. Identitas Rekam DNA & Kunci Versi Kanonikal

### 1. Penggantian Identifier 32-Bit (`dna_id`):
- Format pendek `dna_<sha256_prefix8>` (32-bit) **DITOLAK** karena tidak memadai untuk identitas forensik durabel jangka panjang dan rawan tabrakan (*collision*).
- **Format Kanonikal Terpilih:** **UUID v4 / 128-bit UUID (~122 random bits after UUID version/variant fields) dengan prefix `dna_`**:
  ```typescript
  const dnaId = `dna_${crypto.randomUUID()}`;
  // Contoh: dna_8f1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d
  ```
  Menjamin resistansi benturan kriptografis berstandar industri dengan ergonomi prefix yang jelas.
  Modul implementasi resmi: `src/lib/content-protection/publication-dna.ts`.
  Konstanta versi resmi:
  - `DNA_VERSION = 'v1.0'`
  - `NORMALIZATION_VERSION = 'norm-v1'`
  - `SHINGLE_VERSION = 'shingle-4w-v1'`
  - `MINHASH_VERSION = 'minhash-64h-v1'`
  - `GENERATOR_VERSION = 'dna-engine/1.0.0'`

### 2. Kunci Versi Kanonikal (`version_key`):
Menyelesaikan masalah artikel pra-sistem seperti Article 6 yang tidak memiliki tanda terima tanpa perlu membuat data sintetis palsu:
- **Untuk Artikel Ber-Tanda Terima (`provenance_class = 'FULL_PROVENANCE'`):**
  $$\text{version\_key} = \text{"receipt:"} + \text{publication\_receipt\_id}$$
  *Contoh:* `receipt:rcpt_artA_d476e9020634`
- **Untuk Artikel Historis Tanpa Tanda Terima (`provenance_class = 'PARTIAL_HISTORICAL_PROVENANCE'`):**
  $$\text{version\_key} = \text{"historical:"} + \text{article\_id} + \text{":"} + \text{published\_content\_hash}$$
  *Contoh:* `historical:6:18a20463523fc5ada7287fc54e37b8346d0e69b90cef9656544950dd4bb4dd1d`

Kolom `version_key` memiliki konstrain `NOT NULL UNIQUE` pada tabel `article_dna_signatures`, menjamin bahwa satu versi publikasi hanya memiliki tepat satu rekam DNA.

---

## 5. Audit Data Otoritatif vs Snapshot Forensik

Berdasarkan audit langsung pada runtime dan skema produksi D1 (`rancangloka_db`), pemetaan otoritas data didefinisikan secara eksplisit:

| Kolom Rekam DNA | Klasifikasi Otoritas | Sumber Data Asli | Penjelasan Semantik |
|---|---|---|---|
| `dna_id` | **AUTHORITATIVE DNA IDENTITY** | Pembangkit runtime | UUID v4 unik rekam DNA. |
| `version_key` | **AUTHORITATIVE VERSION KEY** | Logika kontrak | Kunci unik versi publikasi (`receipt:...` atau `historical:...`). |
| `article_id` | **AUTHORITATIVE LIVE REFERENCE** | `articles.id` | Kunci asing relasional ke tabel naskah. |
| `publication_receipt_id` | **AUTHORITATIVE RECEIPT REFERENCE** | `publication_execution_receipts.receipt_id` | Identifier tanda terima penerbitan (NULL untuk pra-sistem). |
| `publication_execution_id` | **AUTHORITATIVE EXECUTION REFERENCE**| `article_publication_executions.execution_id` | Identifier eksekusi penerbitan (NULL untuk pra-sistem). |
| `provenance_class` | **AUTHORITATIVE METADATA** | Logika verifikasi | `FULL_PROVENANCE` atau `PARTIAL_HISTORICAL_PROVENANCE`. |
| `published_content_hash` | **IMMUTABLE FORENSIC SNAPSHOT** | `articles.content_hash` | Hash SHA-256 canonical Markdown saat publikasi terjadi. |
| `approved_content_hash` | **IMMUTABLE FORENSIC SNAPSHOT** | `article_editorial_approvals.approved_content_hash` | Hash SHA-256 yang disetujui Chief Editor (NULL untuk pra-sistem). |
| `canonical_slug` | **IMMUTABLE FORENSIC SNAPSHOT** | `articles.slug` | Slug artikel saat publikasi terjadi. |
| `canonical_url` | **IMMUTABLE FORENSIC SNAPSHOT** | Runtime URL builder | URL publik resmi saat publikasi terjadi. |
| `approved_recorded_at` | **IMMUTABLE FORENSIC SNAPSHOT** | `article_editorial_approvals.created_at` | **KOREKSI PENTING:** Menggunakan `created_at` (bukan `approved_at` yang fiktif) sebagai stempel waktu pencatatan baris persetujuan editorial. |
| `actual_published_at` | **IMMUTABLE FORENSIC SNAPSHOT** | `publication_execution_receipts.actual_published_at` | Stempel waktu atomik dari server basis data saat receipt dibuat. |
| `historical_published_at` | **IMMUTABLE FORENSIC SNAPSHOT** | `articles.published_at` | Digunakan untuk artikel historis yang tidak memiliki receipt atomik. |
| `featured_asset_id` | **IMMUTABLE FORENSIC SNAPSHOT** | `article_media.asset_id` | ID aset media unggulan yang aktif saat terbit. |
| `featured_asset_sha256` | **IMMUTABLE FORENSIC SNAPSHOT** | `media_assets.sha256` | Hash biner SHA-256 media unggulan saat terbit. |
| `dna_version` | **AUTHORITATIVE CONTRACT** | Konstanta kode | Versi spesifikasi DNA (misal: `'v1.0'`). |
| `normalization_version` | **AUTHORITATIVE CONTRACT** | Konstanta kode | Versi aturan normalisasi (misal: `'norm-v1'`). |
| `shingle_version` | **AUTHORITATIVE CONTRACT** | Konstanta kode | Versi tokenisasi shingle (misal: `'shingle-4w-v1'`). |
| `minhash_version` | **AUTHORITATIVE CONTRACT** | Konstanta kode | Versi fungsi MinHash (misal: `'minhash-64h-v1'`). |
| `normalized_text_hash` | **DERIVED SIGNATURE** | Output normalizer | SHA-256 dari teks naskah pasca-normalisasi `norm-v1`. |
| `block_hashes_json` | **DERIVED SIGNATURE** | Output block segmenter | JSON array hash SHA-256 per blok semantik. |
| `minhash_signature_json`| **DERIVED SIGNATURE** | Output MinHash engine | JSON array 64 string heksadesimal 16-karakter. |
| `structural_signature_json`| **DERIVED SIGNATURE**| Output structural parser | JSON struktur hierarki judul dan matriks blok. |
| `generator_version` | **AUTHORITATIVE CONTRACT** | Konstanta kode | Versi rilis pustaka generator (misal: `'dna-engine/1.0.0'`). |
| `created_at` | **AUTHORITATIVE AUDIT TIME** | Basis data | Waktu pembuatan baris rekam DNA. |

### Koreksi Semantik Terminologi Tanda Terima:
- Istilah *"tanda terima kriptografis"* diperbaiki menjadi **"identifier tanda terima penerbitan" (*publication receipt identifier*)**, karena `receipt_id` (misal: `rcpt_bbae85b48e1b2f8d`) adalah token identitas heksadesimal unik, bukan tanda tangan kriptografis berbasis kunci publik/privat (asimetris).

---

## 6. Normalisasi Teks Deterministik (`norm-v1`)

Normalisasi teks digunakan **HANYA** untuk komputasi kemiripan forensik. Normalisasi ini **TIDAK PERNAH** memodifikasi teks artikel yang disimpan atau disajikan kepada pembaca.

### Urutan Transformasi Deterministik (Parser Pipeline):
Input adalah string **Markdown Kanonikal Asli** dari `articles.content_md`.

1. **Unicode Canonical Normalization:** Menerapkan Unicode NFKC (`String.prototype.normalize('NFKC')`) untuk menstandarkan simbol tipografi, ligatur, dan karakter aksen.
2. **Line Ending Unification:** Mengubah seluruh `\r\n` dan `\r` menjadi `\n` tunggal.
3. **HTML Tag Stripping:** Menghapus tag HTML inline atau block (`<p>`, `<div>`, `<span>`, `<strong>`, `<em>`, dll.) dengan regex deterministik non-backtracking, menyisakan teks di dalamnya.
4. **Markdown Link & Media Stripping:**
   - Link `[teks](url)` diubah menjadi `teks` murni.
   - Gambar `![alt](url)` dihapus dari aliran teks prosa utama (informasi media ditangkap via `structural_signature_json`).
5. **Inline Code & Formatting Removal:**
   - Format tebal/miring (`**teks**`, `*teks*`, `__teks__`, `_teks_`) ditanggalkan sintaksnya, teks dipertahankan.
   - Inline code (`` `kode` ``) ditanggalkan backtick-nya, teks kode dipertahankan.
   - Code block (```` ```lang ... ``` ````) ditanggalkan penanda pagar dan nama bahasa.
6. **Blockquote Cleaning:** Menghilangkan penanda `>` di awal baris kutipan.
7. **Punctuation & Whitespace Collapsing (Similarity Stream):**
   - Tanda baca standar dinormalkan (curly quotes `“ ”` $\rightarrow$ `"`, dashes `— –` $\rightarrow$ `-`).
   - Spasi horizontal berlebih (`\t`, ` {2,}`) diciutkan menjadi spasi tunggal.
   - Teks di-lowercase untuk tokenisasi shingle.

---

## 7. Segmentasi Blok Semantik (Semantic Block Segmentation)

Menolak pendekatan naive `split(/\n\n+/)` yang memecah daftar atau tabel secara sembarangan.

### Klasifikasi Tipe Blok Semantik:
Setiap naskah diurai menjadi deretan blok semantik dengan format rekaman JSON:
```typescript
interface SemanticBlockRecord {
  index: number;
  block_type: 'heading' | 'paragraph' | 'list' | 'table' | 'quote' | 'code';
  hash: string;       // SHA-256 heksadesimal 64 karakter dari isi blok ternormalisasi
  token_count: number; // Jumlah kata dalam blok
}
```

### Aturan Segmentasi:
1. **Heading Block:** Setiap baris diawali `#` s/d `######` diidentifikasi sebagai blok judul independen.
2. **List Block:** Baris-baris daftar berurutan (`- `, `* `, `1. `) dikelompokkan sebagai satu kesatuan blok daftar semantik.
3. **Table Block:** Baris-baris tabel Markdown (memuat `|`) digabungkan sebagai satu kesatuan blok tabel.
4. **Paragraph Block:** Teks prosa berkelanjutan yang dipisahkan oleh dua baris baru (`\n\n+`) dan bukan merupakan judul, daftar, atau tabel.
5. **Blok Kosong:** Dieliminasi dari array.

### Keunggulan Forensik:
- Memungkinkan deteksi pencurian 1–2 paragraf atau pemindahan urutan bab tanpa menyimpan ulang prosa naskah secara redundan di basis data.

---

## 8. Spesifikasi & Keamanan Numerik MinHash

### 1. Masalah Keamanan Numerik JavaScript:
- Penggunaan modulo bilangan prima besar seperti $2^{61}-1$ pada lingkungan JavaScript berisiko memicu **kehilangan presisi numerik (*precision loss*)** jika dilewatkan sebagai tipe `Number` standar (yang batas amannya adalah `Number.MAX_SAFE_INTEGER = 2^53 - 1`).
- **Solusi Rekayasa:**
  - Perhitungan MinHash di dalam generator menggunakan tipe **`BigInt`** murni.
  - Hasil setiap hash disimpan dan dipersistensikan sebagai **string heksadesimal 16 karakter dengan padding nol di depan (*fixed-width 16-character hex string*)**.
  - Format penyimpanan di D1 (`minhash_signature_json`):
    ```json
    [
      "001a4f028b3c9d1e",
      "05f92a18c7e4b203",
      "..."
    ]
    ```
  - Format ini 100% aman dari masalah batas integer JSON parser di bahasa apa pun, mudah diinspeksi manusia, dan bebas dari pembulatan floating point.

### 2. Jaminan Determinisme MinHash:
- **DILARANG MENGGUNAKAN KOEFISIEN ACAK SAAT RUNTIME.**
- 64 pasangan koefisien hash linier $(a_i, b_i)$ didefinisikan sebagai **tabel konstanta statis (*hardcoded fixed coefficient table*)** yang diinisialisasi sekali dengan seed tetap.
- Konstanta modulo: $p = 2305843009213693951\text{n}$ ($2^{61}-1$ sebagai `BigInt`).
- **Pemetaan Shingle ke Elemen Field:** Setiap shingle 4 perkataan di-hash menggunakan SHA-256 (UTF-8). 8 byte pertama dibaca sebagai unsigned 64-bit integer big-endian (`readBigUInt64BE(0)`), lalu direduksi modulo $p = 2^{61}-1$.
- Persamaan hash untuk setiap shingle field element $x$:
  $$h_i(x) = (a_i \cdot x + b_i) \pmod p$$
- **Uji Keberterimaan Deterministik (Golden Acceptance Test):**
  Naskah artikel yang sama yang diproses 100 kali pada mesin atau Worker yang berbeda di bawah `minhash_version = 'minhash-64h-v1'` **WAJIB menghasilkan string array MinHash yang identik hingga tingkat byte**.

---

## 9. Status Keputusan Sinyal Pendukung

| Sinyal | Keputusan V1 | Rasional Rekayasa |
|---|---|---|
| **Exact Hash (`content_hash`)** | **`INCLUDE`** | Identitas absolut naskah Markdown kanonikal. |
| **Normalized Text Hash** | **`INCLUDE`** | Deteksi identitas format bebas whitespace/karakter aksen. |
| **Semantic Block Hashes** | **`INCLUDE`** | Bukti pencurian parsial, pengacakan bab, dan kutipan tanpa izin. |
| **64-Vector MinHash (Hex)** | **`INCLUDE`** | Estimasi koefisien Jaccard untuk deteksi parafrasa dan pemadatan teks. |
| **Structural Signature** | **`INCLUDE`** | Bukti kemiripan arsitektur dokumen independen dari kata-kata. |
| **SimHash** | **`DEFER`** | MinHash lebih selaras dengan kebutuhan deteksi tumpang-tindih sebagian (*partial-overlap*) dan perombakan paragraf. SimHash ditunda untuk menghindari redundansi komputasi di V1. |
| **Rare Phrase Signal** | **`DEFER`** | Korpus RancangLoka saat ini masih kecil. Frekuensi kata relatif terhadap korpus akan bergeser seiring pertumbuhan artikel, merusak stabilitas bukti historis. |
| **Asset Perceptual Hash (pHash)**| **`DEFER_TO_1B_ASSET_EXTENSION`** | Core 1B berfokus pada DNA naskah teks. Ekstensi pHash media akan dievaluasi terpisah pada sub-fase 1B-E. |
| **Public Provenance Header/API** | **`DEFER_TO_1B_D`** | Prioritas utama adalah pembentukan rekam forensik privat yang tak terbantahkan di D1. Eksposur header publik (`X-RL-Provenance-Hash`) atau verifikasi publik ditunda hingga data stabil. |
| **Automated Clone Crawler** | **`DEFER`** | Di luar cakupan milestone 1B (dijadwalkan pada fase perlindungan berikutnya). |

---

## 10. Kalibrasi Ambang Batas Kemiripan (Similarity Calibration)

Angka-angka persentase sebelumnya (30%, 60%, 85%) **DIHAPUS DARI STATUS KONSTANTA KONSTITUSIONAL**. Angka-angka tersebut kini diklasifikasikan sebagai:
> **`CALIBRATION_CANDIDATES / REQUIRING_EMPIRICAL_BENCHMARK`**

Sebelum RancangLoka memiliki korpus pembanding yang terkalibrasi (artikel berbeda topik, parafrasa AI, kutipan parsial), sistem analisis hanya akan mengeluarkan **laporan bukti matematis (*evidence report*)** untuk ditelaah oleh editor manusia.

### Label Status Hasil Telaah (Allowed Labels):
1. `LOW_SIMILARITY`: Bukti kemiripan sangat rendah, kemungkinan besar topik independen.
2. `REVIEW_REQUIRED`: Terdapat beberapa kecocokan blok semantik atau skor MinHash menengah; memerlukan evaluasi manusia.
3. `SUSPECTED_DERIVED_CONTENT`: Kecocokan struktur dan banyak blok semantik yang mengindikasikan penyalinan berbasis parafrasa.
4. `PROBABLE_CONTENT_CLONE`: Kecocokan hash naskah penuh atau tumpang-tindih blok mayoritas yang menunjukkan replikasi konten.

**Label yang Dilarang Keras Dikeluarkan Secara Otomatis oleh Mesin:** `STOLEN`, `PLAGIARIZED`, `COPYRIGHT_INFRINGEMENT`.

---

## 11. Skema Basis Data D1 yang Disempurnakan

Skema `article_dna_signatures` dirancang bersifat **APPEND-ONLY**, tahan benturan, mendukung artikel pra-sistem, dan memiliki konstrain keunikan idempotem:

```sql
-- Migration: 0034_article_publication_dna.sql
-- Description: Add immutable Publication DNA signatures table

CREATE TABLE IF NOT EXISTS article_dna_signatures (
  dna_id TEXT PRIMARY KEY,
  version_key TEXT NOT NULL UNIQUE,
  article_id INTEGER NOT NULL,
  publication_receipt_id TEXT NULL,
  publication_execution_id TEXT NULL,
  provenance_class TEXT NOT NULL,

  published_content_hash TEXT NOT NULL,
  approved_content_hash TEXT NULL,

  canonical_slug TEXT NOT NULL,
  canonical_url TEXT NOT NULL,

  approved_recorded_at DATETIME NULL,
  actual_published_at DATETIME NULL,
  historical_published_at DATETIME NULL,

  dna_version TEXT NOT NULL DEFAULT 'v1.0',
  normalization_version TEXT NOT NULL DEFAULT 'norm-v1',
  shingle_version TEXT NOT NULL DEFAULT 'shingle-4w-v1',
  minhash_version TEXT NOT NULL DEFAULT 'minhash-64h-v1',

  normalized_text_hash TEXT NOT NULL,
  block_hashes_json TEXT NOT NULL,
  minhash_signature_json TEXT NOT NULL,
  structural_signature_json TEXT NOT NULL,

  featured_asset_id TEXT NULL,
  featured_asset_sha256 TEXT NULL,

  generator_version TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (article_id) REFERENCES articles(id),
  FOREIGN KEY (publication_receipt_id) REFERENCES publication_execution_receipts(receipt_id)
);

CREATE INDEX IF NOT EXISTS idx_article_dna_article_id ON article_dna_signatures(article_id);
CREATE INDEX IF NOT EXISTS idx_article_dna_receipt_id ON article_dna_signatures(publication_receipt_id);
CREATE INDEX IF NOT EXISTS idx_article_dna_published_hash ON article_dna_signatures(published_content_hash);
CREATE INDEX IF NOT EXISTS idx_article_dna_normalized_hash ON article_dna_signatures(normalized_text_hash);
```

---

## 12. Model Immutability & Status Kegagalan Operasional

### Resolusi Kontradiksi Status:
Tabel `article_dna_signatures` adalah **CATATAN FORENSIK ABADI (IMMUTABLE)**. Dilarang menyimpan kolom status mutabel (seperti `status = 'PENDING'` lalu di-`UPDATE` menjadi `'GENERATED'`) di dalam tabel ini.

### Model State Terderivasi & Idempotensi:
1. **Status `DNA_PENDING` (Derived Operational State):**
   Terjadi jika kueri mendeteksi:
   ```sql
   SELECT r.receipt_id, r.article_id
   FROM publication_execution_receipts r
   LEFT JOIN article_dna_signatures dna ON dna.version_key = 'receipt:' || r.receipt_id
   WHERE dna.dna_id IS NULL;
   ```
   Sistem tidak perlu mengubah status baris apa pun; ketiadaan baris DNA untuk receipt yang sah mendefinisikan secara alami bahwa DNA berstatus `PENDING`.

2. **Pembangkitan Sukses:**
   Menjalankan `INSERT INTO article_dna_signatures (...)`.
   Karena `version_key` berkonstrain `UNIQUE`, pemanggilan ulang yang tidak disengaja akan ditolak secara aman (*idempotent*).

3. **Pencatatan Kegagalan (`DNA_GENERATION_FAILED`):**
   Jika kalkulasi DNA mengalami error (misal kehabisan memori atau CPU Worker), sistem **TIDAK MEMASUKKAN BARIS RUSAK KE `article_dna_signatures`**.
   Sebaliknya, kegagalan dicatat ke dalam log telemetri terstruktur (`audit_logs` atau Worker error console):
   ```json
   {
     "event": "DNA_GENERATION_FAILED",
     "article_id": 9,
     "receipt_id": "rcpt_artC_8341d2fda3bc",
     "content_hash": "12c59631d3b29...",
     "fingerprint_version": "v1.0",
     "error_class": "CPU_TIMEOUT",
     "error_message": "...",
     "timestamp": "2026-10-16T11:40:00.000Z"
   }
   ```
   Artikel publik tetap terbit dan disajikan dengan normal.

---

## 13. Model Eksekusi Runtime Post-Receipt

### Menjawab Mekanisme "Non-Blocking":
Dalam Cloudflare Workers SSR, kode tidak boleh memblokir pengiriman respons HTML kepada pembaca atau memperlambat transaksi basis data publikasi.

### Alur Eksekusi Kanonikal di `src/lib/publication/publisher-service.ts`:
1. **Tahap 1 — Transaksi Atomik Selesai:**
   Transaksi D1 atomik (`UPDATE articles`, `UPDATE article_publication_executions`, `INSERT INTO publication_execution_receipts`) dijalankan dan divalidasi berhasil (`changes === 1`). Tanda terima publikasi telah eksis dan sah.
2. **Tahap 2 — Eksekusi DNA yang Aman:**
   Generator DNA dipanggil **setelah** tanda terima berhasil dibuat.
   - Jika context Cloudflare Worker tersedia (`options.ctx?.waitUntil`), sistem membungkus pemanggilan:
     ```typescript
     if (options.ctx && typeof options.ctx.waitUntil === 'function') {
       options.ctx.waitUntil(materializePublicationDna(db, receiptId, execution));
     } else {
       // Lingkungan script/CLI atau fallback
       await materializePublicationDna(db, receiptId, execution).catch(err => {
         console.error('[PublicationDNA] Non-blocking DNA generation failed:', err);
       });
     }
     ```
3. **Invarian Keselamatan:**
   - Kegagalan kalkulasi DNA **DITANGKAP DALAM `try/catch`** dan **TIDAK PERNAH MENGGAGALKAN TRANSAKSI PENERBITAN**.
   - Pembaca yang mengakses URL artikel tidak terhambat oleh proses pembuatan sidik jari.

---

## 14. Kontrak Penanganan Korpus Historis (Articles 5–9)

Berdasarkan audit empiris produksi yang telah diverifikasi:

| ID | Slug Artikel | Hash Konten Otoritatif | Receipt Eksisting | Approval Eksisting | Klasifikasi Provenansi | Format `version_key` |
|:---:|---|---|---|---|:---:|---|
| **5** | `kusen-aluminium-vs-upvc...` | `1427591202905...` | `rcpt_bbae85b48e1b2f8d` | `created_at: 2026-09-28 06:15:42` | **`FULL_PROVENANCE`** | `receipt:rcpt_bbae85b48e1b2f8d` |
| **6** | `rekayasa-ventilasi-silang...` | `18a20463523fc...` | *None* | *None* | **`PARTIAL_HISTORICAL_PROVENANCE`** | `historical:6:18a20463523fc...` |
| **7** | `jendela-berkondensasi...` | `00dc804d7f3bd...` | `rcpt_artA_d476e9020634` | `created_at: 2026-10-07 01:24:49` | **`FULL_PROVENANCE`** | `receipt:rcpt_artA_d476e9020634` |
| **8** | `thermal-bridge-kusen...` | `66094cf52d2d1...` | `rcpt_artB_f3fb92d8c53d` | `created_at: 2026-10-07 01:28:26` | **`FULL_PROVENANCE`** | `receipt:rcpt_artB_f3fb92d8c53d` |
| **9** | `memilih-sistem-shading...` | `12c59631d3b29...` | `rcpt_artC_8341d2fda3bc` | `created_at: 2026-10-15 03:32:41` | **`FULL_PROVENANCE`** | `receipt:rcpt_artC_8341d2fda3bc` |

### Penegasan Terminologi Backfill:
- **`SOURCE DATA ACCESS = READ ONLY`:** Script backfill hanya membaca naskah dan metadata yang sudah ada di D1.
- **`TARGET DNA TABLE = INSERT ONLY`:** Script hanya menulis baris baru ke tabel `article_dna_signatures`.
- **`EXISTING PUBLICATION TABLES = ZERO MUTATION`:** Dilarang mengubah `articles`, `article_editorial_approvals`, atau `publication_execution_receipts`.
- Khusus **Article 6**, ketiadaan receipt dan approval diakui secara jujur:
  - `publication_receipt_id = NULL`
  - `approved_content_hash = NULL`
  - `approved_recorded_at = NULL`
  - `historical_published_at = '2026-09-13T23:05:51.804Z'`
  - **Nol pembuatan data palsu.**

---

## 15. Kebutuhan Pengujian Vektor Emas (Golden Vector Tests)

Pada implementasi sub-fase 1B-A, wajib disediakan serangkaian tes berbasis fixture independen tanpa dependensi ke jaringan atau database produksi:

1. **Uji Identitas Naskah:** Naskah kanonikal Markdown menghasilkan `normalized_text_hash` yang persis sama.
2. **Uji Segmentasi Blok:** Naskah dengan campuran judul, daftar, tabel, dan blockquote menghasilkan deretan `block_hashes_json` yang deterministik.
3. **Uji MinHash Byte-Identical:** Eksekusi berulang terhadap naskah menghasilkan 64-string hex MinHash yang persis sama.
4. **Uji Ketahanan Line-Ending:** Teks berakhiran `\r\n` (Windows) dan `\n` (Unix) menghasilkan sidik jari ternormalisasi yang 100% identik.
5. **Uji Ketahanan Whitespace:** Variasi spasi ganda dan tab horizontal pada prosa tidak mengubah sidik jari MinHash atau normalized hash.
6. **Uji Deteksi Perubahan Teks Bermakna:** Perubahan satu kata substansial mengubah `published_content_hash`, `normalized_text_hash`, dan hash blok terkait, sementara blok lain tetap cocok.
7. **Uji Pengacakan Paragraf:** Dua paragraf yang ditukar posisinya menghasilkan `published_content_hash` berbeda, namun seluruh tanda tangan blok individu tetap ditemukan dalam `block_hashes_json`.
8. **Uji Normalisasi Unicode NFKC:** Bentuk decomposed (`e` + accent) dan precomposed (`é`) menghasilkan hash ternormalisasi yang identik.

---

## 16. Penyederhanaan Tahapan Implementasi

Untuk menjamin keselamatan rekayasa, implementasi dibagi menjadi sub-fase terisolasi:

```
[ 1B-A: Core DNA Library & Additive Schema ]
  - Pustaka murni: normalizer norm-v1, semantic block segmenter, 64-MinHash BigInt engine.
  - Golden-vector tests (100% lulus tanpa koneksi jaringan).
  - File migrasi D1 aditif: 0034_article_publication_dna.sql.
         │
         ▼
[ 1B-B: Publisher Service Post-Receipt Integration ]
  - Integrasi materializePublicationDna() ke publisher-service.ts pasca-commit receipt.
  - Penegakan semantik PUBLICATION_SUCCEEDS_DNA_PENDING & logging error.
  - Uji integrasi penerbitan atomik + materialisasi DNA otomatis.
         │
         ▼
[ 1B-C: Historic Articles 5–9 Backfill ]
  - Script backfill terkontrol (Read-Only Source, Insert-Only Target DNA).
  - Verifikasi integritas: 4 FULL_PROVENANCE + 1 PARTIAL_HISTORICAL_PROVENANCE.
         │
         ▼
[ 1B-D: Admin Forensic Inspection & Comparison (Masa Depan) ]
  - Tampilan visual read-only di panel admin untuk melihat status DNA artikel.
  - Evaluasi kebutuhan endpoint verifikasi publik atau header respon.
         │
         ▼
[ 1B-E: Asset Perceptual Fingerprint Extension (Masa Depan) ]
  - Evaluasi algoritma pHash/dHash dan pipeline komputasi media R2.
```

*Sub-fase 1B-D dan 1B-E secara eksplisit DITUNDA dan TIDAK DIKERJAKAN pada langkah coding awal.*

---

## 17. Kesimpulan & Status Kesiapan

Kontrak data Publication DNA telah dikeraskan sepenuhnya:
- Menghapus asumsi kolom yang tidak ada (`approved_at` $\rightarrow$ `created_at`).
- Mengganti ID 32-bit dengan UUID v4 128-bit anti-benturan.
- Menetapkan `version_key` yang mendukung artikel historis tanpa memalsukan data.
- Menjamin keamanan numerik MinHash menggunakan BigInt dan format string heksadesimal 16-karakter.
- Memisahkan status operasional mutabel dari rekam forensik abadi.
- Menegakkan semantik eksekusi non-blocking pasca-receipt.

**Klasifikasi Evaluasi:**
# `CONTENT_PROTECTION_1B_FINAL_PLAN_PASS`

RancangLoka siap memasuki tahap implementasi teknis sub-fase **1B-A**.
