# 🧬 RancangLoka — CONTENT_PROTECTION-1B Architecture & Implementation Plan
## Phase 1B: Publication DNA (Provenance, Cryptographic Identity & Forensic Similarity)

**Milestone:** `CONTENT_PROTECTION-1B`
**Phase:** `PUBLICATION DNA DATA-CONTRACT HARDENING & FINAL PLANNING`
**Parent Blueprint:** [`docs/engineering/CONTENT_PROTECTION_1_BLUEPRINT.md`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/docs/engineering/CONTENT_PROTECTION_1_BLUEPRINT.md)
**Target Repository:** `rancangloka-astro/`
**Status:** `CONTENT_PROTECTION_1B_PRODUCTION_ACCEPTED`
**Date:** 2026-10-16
**Current Production Worker:** `8f174086-8679-4f31-aec9-1c64844e8bd9` (Previous: `624b040f-52ed-4fde-8b6b-fd4d3d413586`)
**Current Source HEAD:** `cd1aabd`
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

## 17. Status Implementasi 1B-A

Implementasi dasar 1B-A telah diselesaikan pada commit `c155d43`:
- Modul inti murni: `src/lib/content-protection/publication-dna.ts`
- Migrasi aditif D1: `db/migrations/0034_article_publication_dna.sql`
- Suite pengujian offline: `scripts/test-publication-dna.js`

---

## 18. Audit Paritas Hash Otoritatif & Penguncian Vektor Golden (Determinism Lock)

### 1. Kontrak Kanonikal Content Hash (`articles.content_hash`)
Melalui audit repositori menyeluruh terhadap modul penerbitan (`publisher-service.ts`, `publish-article-c-production.js`, `run-publication-polish-1.js`), ditetapkan kontrak kanonikal tunggal:

> **`CANONICAL_CONTENT_HASH_V1 = SHA-256(raw UTF-8 bytes of articles.content_md exactly as persisted)`**

Helper `computeCanonicalContentHash(canonicalMarkdown)` pada Publication DNA mengimplementasikan kontrak ini secara eksak tanpa transformasi teks apa pun.

### 2. Hasil Audit Paritas Produksi (Articles 5–9)
Audit langsung secara read-only (SELECT ONLY) terhadap basis data produksi Cloudflare D1 (`rancangloka_db`) mengungkapkan fakta historis silsilah naskah:

| Article ID | Slug | Stored `content_hash` | `computeCanonicalContentHash` (Raw UTF-8) | Legacy `seo.ts` Hash (Normalized) | Klasifikasi Paritas |
|---|---|---|---|---|---|
| **5** | `kusen-aluminium-vs-upvc...` | `14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277` | `7d06b0ae...` (**MISMATCH**) | `14275912...` (**MATCH**) | Phase 1 Legacy Seed |
| **6** | `rekayasa-ventilasi-silang...` | `18a20463523fc5ada7287fc54e37b8346d0e69b90cef9656544950dd4bb4dd1d` | `3622730b...` (**MISMATCH**) | `18a20463...` (**MATCH**) | Phase 1 Legacy Seed |
| **7** | `jendela-berkondensasi...` | `00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298` | `00dc804d...` (**MATCH**) | `b2258047...` (**MISMATCH**) | Pipeline Modern (Art A) |
| **8** | `thermal-bridge-kusen...` | `66094cf52d2d10650b82141adace0cedc27fc9a3f63ae1f85e19a57c38d4e260` | `66094cf5...` (**MATCH**) | `a0e5ddb0...` (**MISMATCH**) | Pipeline Modern (Art B) |
| **9** | `memilih-sistem-shading...` | `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28` | `12c59631...` (**MATCH**) | `cd3e5653...` (**MISMATCH**) | Pipeline Modern (Art C) |

**Temuan Silsilah:**
- Seluruh artikel yang diproduksi oleh pipeline editorial modern (Artikel 7, 8, 9) memiliki **100% paritas eksak** dengan `computeCanonicalContentHash`.
- Artikel 5 dan 6 berasal dari fase impor awal pra-Hermes, di mana naskah di-hash menggunakan `src/lib/seo.ts:generateContentHash` (`content.replace(/\s+/g, ' ').trim().toLowerCase()`).
- Karena naskah dan hash produksi berstatus immutable, divergensi historis ini didokumentasikan sebagai bagian dari silsilah `PARTIAL_HISTORICAL_PROVENANCE`.

### 3. Aturan Vektor Golden Literal (Literal Golden-Vector Rule)
Pengujian regresi Publication DNA (`scripts/test-publication-dna.js`) wajib menggunakan konstanta literal terkomit (**FROZEN LITERAL CONSTANTS**) untuk:
- `published_content_hash`
- `normalized_text_hash`
- `block_hashes_json`
- `minhash_signature_json` (vektor 64-elemen lengkap)
- `structural_signature_json`

Dilarang keras menghitung nilai ekspektasi secara dinamis saat tes berjalan (`expected = generatePublicationDnaMaterial(...)`), guna mendeteksi segala bentuk pergeseran algoritma di masa mendatang.

### 4. Kontrak Pergeseran Parser Markdown (Markdown Parser Drift Contract)
Segmentasi blok semantik Publication DNA v1 bergantung pada `marked.lexer`.
- Perlindungan integritas ditegakkan melalui: lockfiles paket (`package-lock.json`), konstanta versi generator (`GENERATOR_VERSION = 'dna-engine/1.0.0'`), dan pengujian vektor golden literal.
- **Aturan Pembaruan:** Jika pembaruan pustaka pihak ketiga mengubah salah satu nilai vektor V1 yang telah dibekukan, dilarang memperbarui nilai tes secara diam-diam. Operator wajib menentukan apakah (A) terjadi regresi implementasi atau (B) semantik sidik jari sengaja diubah. Jika B, versi kontrak generator (`DNA_VERSION` / `GENERATOR_VERSION`) wajib dinaikkan.

### 5. Semantik Sentinel MinHash Kosong (`EMPTY_MINHASH_IS_SENTINEL`)
Teks kosong atau tanpa token substansial menghasilkan representasi deterministik:
- 64 komponen heksadesimal bernilai `'0000000000000000'`.
- Konstanta pengawas diekspor secara resmi: `EMPTY_MINHASH_IS_SENTINEL = true` dan `EMPTY_MINHASH_SENTINEL_ELEMENT = '0000000000000000'`.
- **Aturan Perbandingan Kemiripan:** Mesin pembanding forensik di masa depan wajib mendeteksi vektor sentinel ini secara eksplisit dan DILARANG menginterpretasikan dua tanda tangan nol sebagai 100% kemiripan tekstual.

---

## 19. Kontrak Content Hash Historis (Historical Content Hash Contracts)

### 1. Koeksistensi Dua Kontrak Hash Kanonikal
Berdasarkan audit forensik terhadap artikel yang telah terbit di basis data produksi Cloudflare D1, RancangLoka secara formal mengakui dan memelihara dua kontrak hashing naskah:

1. **`legacy-normalized-sha256-v0` (Phase 1 Legacy Seed):**
   - **Algoritma:** `SHA-256(content_md.replace(/\s+/g, ' ').trim().toLowerCase())`
   - **Cakupan Historis:** Artikel 5 (`kusen-aluminium-vs-upvc...`) dan Artikel 6 (`rekayasa-ventilasi-silang...`).
   - **Karakteristik:** Teks dinormalisasi (semua whitespace diubah menjadi spasi tunggal, di-trim, dan di-lowercase) sebelum komputasi SHA-256 dilakukan.

2. **`canonical-markdown-sha256-v1` (Modern Publication Pipeline):**
   - **Algoritma:** `SHA-256(raw UTF-8 bytes of articles.content_md exactly as persisted)`
   - **Cakupan:** Artikel 7, 8, 9, dan seluruh artikel baru di masa depan yang diterbitkan melalui pipeline kanonikal.
   - **Karakteristik:** Hash biner presisi bit-level tanpa modifikasi atau normalisasi string sedikit pun.

### 2. Invarian Permanen: `DO_NOT_REHASH_HISTORICAL_PUBLICATIONS_IN_PLACE`
> **`DO_NOT_REHASH_HISTORICAL_PUBLICATIONS_IN_PLACE`**
> *(Naskah publikasi historis dilarang keras di-rehash atau dimutasi di tempat demi menyesuaikan dengan konvensi hash yang lebih baru.)*

- Artikel 5 dan 6 **TIDAK RUSAK ATAU KORUP**. Nilai `content_hash` yang tersimpan adalah sah dan mengikat sesuai kontrak yang berlaku saat artikel tersebut diimpor/diaudit.
- Nilai `articles.content_hash` pada Artikel 5 dan 6 bersifat abadi (*immutable*), sama seperti prosa editorialnya.
- Publication DNA mencatat kolom `content_hash_contract` secara eksplisit pada setiap baris `article_dna_signatures` untuk mengetahui fungsi hashing yang mengatur rekaman tersebut.

### 3. Pemisahan Provenansi vs Kontrak Hash (Disentangling Provenance Class from Hash Contract)
Status kelengkapan jejak penerbitan (`provenance_class`) dan versi kontrak hash (`content_hash_contract`) adalah dua dimensi ortogonal yang terpisah:

| Article ID | Slug | `provenance_class` | `content_hash_contract` | Catatan Provenansi |
|---|---|---|---|---|
| **5** | `kusen-aluminium-vs-upvc...` | `FULL_PROVENANCE` | `legacy-normalized-sha256-v0` | Memiliki receipt penerbitan dan approval audit, namun menggunakan hash seed legacy v0. |
| **6** | `rekayasa-ventilasi-silang...` | `PARTIAL_HISTORICAL_PROVENANCE` | `legacy-normalized-sha256-v0` | Pra-sistem receipt atomik, menggunakan hash seed legacy v0. |
| **7** | `jendela-berkondensasi...` | `FULL_PROVENANCE` | `canonical-markdown-sha256-v1` | Pipeline modern kanonikal. |
| **8** | `thermal-bridge-kusen...` | `FULL_PROVENANCE` | `canonical-markdown-sha256-v1` | Pipeline modern kanonikal. |
| **9** | `memilih-sistem-shading...` | `FULL_PROVENANCE` | `canonical-markdown-sha256-v1` | Pipeline modern kanonikal. |

### 4. Penegakan Runtime Fail-Closed
- Helper `computeContentHashForContract(markdown, contract)` menyediakan *fail-closed dispatcher*. Jika kontrak yang diminta tidak dikenal, fungsi akan melempar *runtime error*.
- Pembuatan DNA baru melalui `generatePublicationDnaMaterial` selalu menggunakan `canonical-markdown-sha256-v1` secara default.

---

## 20. Integrasi Runtime Publikasi ke Publication DNA (CONTENT_PROTECTION-1B-B)

### 1. Titik Integrasi Pasca-Receipt Otoritatif
Materialisasi Publication DNA terintegrasi langsung ke dalam fungsi `executeAtomicPublication` (`src/lib/publication/publisher-service.ts`) persis setelah transaksi atomik D1 berhasil meng-commit:
1. Pembaruan status naskah menjadi `'published'`.
2. Pembaruan status eksekusi menjadi `'PUBLISHED'`.
3. Penyimpanan tanda terima penerbitan atomik (`publication_execution_receipts`).

Alur sekuensial kanonikal:
$$\text{Chief Editor Approval} \rightarrow \text{Readiness Snapshot} \rightarrow \text{Plan} \rightarrow \text{Publisher Batch Commit} \rightarrow \text{Receipt Created} \rightarrow \text{Publication DNA Materialization} \rightarrow \text{Workers Cache Invalidation}$$

### 2. Aturan Snapshot Publikasi Terkunci (Captured Publication Snapshot Rule)
> **`PUBLICATION_DNA_BINDS_TO_EXACT_PUBLISHED_CONTENT`**
> *(Publication DNA wajib mengikat naskah persis yang diterbitkan oleh transaksi basis data, bukan naskah dinamis yang mungkin termutasi kemudian hari.)*

- **Bebas Kondisi Balapan (*Zero Race Condition*):** Generator DNA dilarang keras melakukan re-query naskah Markdown dari tabel `articles` saat `waitUntil` berjalan di latar belakang.
- **Objek Snapshot Abadi (`PublicationDnaSourceSnapshot`):** Prosa kanonikal (`contentMarkdown`), hash (`contentHash`), slug, URL, metadata persetujuan (`approvedContentHash`, `approvedRecordedAt`), aset unggulan (`featuredAssetId`, `featuredAssetSha256`), ID eksekusi, ID tanda terima, dan stempel waktu server publikasi dibekukan ke dalam objek in-memory sebelum penjadwalan DNA dimulai.

### 3. Semantik Eksekusi `waitUntil` & Mode Non-Worker
- **Cloudflare Worker Runtime:** Ketika `options.ctx?.waitUntil` tersedia, materialisasi DNA dijadwalkan secara asinkron tanpa memblokir latensi respons HTTP ke pemanggil. Promise dilengkapi *catch handler* menyeluruh (`.catch(...)`) untuk menjamin zero unhandled rejections.
- **Node.js / CLI Local Execution:** Ketika dijalankan di luar runtime Worker (misal: pengujian otomatis atau skrip CLI lokal), fungsi publikasi secara eksplisit melakukan `await` terhadap promise materialisasi DNA guna menghindari *unhandled dangling promises*.

### 4. Penegakan Kontrak Hash Modern & Validasi Persetujuan
- **Modern Hash Enforcement:** Seluruh publikasi baru wajib menggunakan `CONTENT_HASH_CONTRACT_MARKDOWN_V1` (`'canonical-markdown-sha256-v1'`). `computeCanonicalContentHash(snapshot.contentMarkdown)` wajib cocok 100% dengan `snapshot.contentHash` dan `receipt.content_hash`. Jika terjadi diskrepansi, proses materialisasi mengembalikan `DNA_SOURCE_HASH_MISMATCH` dan tidak menyisipkan baris DNA apa pun.
- **Approval Provenance Validation:** Untuk status `FULL_PROVENANCE`, `approved_content_hash` wajib ada dan bernilai identik dengan `snapshot.contentHash`. Jika tidak cocok atau tidak tersedia, materialisasi mengembalikan `DNA_PROVENANCE_SOURCE_MISMATCH` dengan zero row insert.

### 5. Idempotensi & Deteksi Konflik Versi (Idempotency vs Conflict)
- Kunci versi kanonikal: `version_key = 'receipt:' + publication_receipt_id`.
- **Idempotensi Sempurna (`DNA_ALREADY_EXISTS`):** Eksekusi berulang untuk tanda terima yang sama dengan nilai field kritis yang identik mengembalikan rekam DNA yang sudah ada tanpa melakukan duplikasi baris.
- **Deteksi Konflik Ketat (`DNA_VERSION_CONFLICT`):** Jika `version_key` sudah ada namun field kritis (seperti `article_id`, `published_content_hash`, atau versi generator) tidak cocok, sistem menolak mutasi dengan status `DNA_VERSION_CONFLICT`. Baris asli yang abadi tidak akan pernah ditimpa (`NO UPDATE`).

### 6. Semantik Kegagalan Fail-Safe (`PUBLICATION_SUCCEEDS_DNA_PENDING`)
- Kegagalan materialisasi DNA terjadi **SETELAH** publikasi artikel dan pembuatan receipt berhasil dikomit ke basis data.
- Kegagalan DNA dilarang keras: (a) me-rollback publikasi artikel, (b) menghapus tanda terima, (c) mengubah status artikel kembali ke draf, atau (d) menggagalkan respons penerbitan.
- Kondisi di mana tanda terima terbit ada namun baris DNA belum terbuat secara operasional didefinisikan sebagai status **`DNA_PENDING`**.

### 7. Independensi Invalidation Cache (Content Protection 1A)
- Penjadwalan materialisasi DNA dan operasi invalidasi Workers Cache (`invalidateArticleCache`) adalah dua concern operasional pasca-penerbitan yang terpisah dan independen.
- Kegagalan DNA tidak membatalkan atau menghentikan invalidasi cache.
- Kegagalan invalidasi cache tidak mempengaruhi materialisasi DNA.

### 8. Taksonomi Status Operasional
| Status Hasil | Klasifikasi | Aksi Penyimpanan D1 |
|---|---|---|
| `DNA_GENERATED` | Sukses Bersih | Satu baris disisipkan ke `article_dna_signatures` |
| `DNA_ALREADY_EXISTS` | Idempotent | Zero insert, mengembalikan `dna_id` yang ada |
| `DNA_SOURCE_HASH_MISMATCH` | Error Sumber | Zero insert, pencatatan log operasional |
| `DNA_PROVENANCE_SOURCE_MISMATCH` | Error Provenansi | Zero insert, pencatatan log operasional |
| `DNA_VERSION_CONFLICT` | Konflik Integritas | Zero insert, baris lama dipertahankan, peringatan log |
| `DNA_GENERATION_FAILED` | Error Database/Runtime | Zero insert, status publikasi tetap sukses |

### 9. Dependensi Penerapan Migrasi
> **`MIGRATION_0034_MUST_EXIST_BEFORE_1B_RUNTIME_ACTIVATION`**
> *(Migrasi `db/migrations/0034_article_publication_dna.sql` wajib diaplikasikan ke basis data target sebelum runtime mengaktifkan persistensi DNA secara produksi.)*

---

## 21. Persiapan Backfill Produksi & Model Fidelitas Sumber (CONTENT_PROTECTION-1B-C)

### 1. Forensic Nuance — Pemisahan Provenansi vs Fidelitas Byte Sumber
Kelengkapan jejak provenansi editorial (`provenance_class`) dan fidelitas konten sumber (`source_fidelity`) adalah dua dimensi forensik yang independen:
- **`provenance_class`:** Menjawab apakah rantai persetujuan editorial manusia dan tanda terima penerbitan atomik tersedia secara lengkap (`FULL_PROVENANCE` vs `PARTIAL_HISTORICAL_PROVENANCE`).
- **`source_fidelity`:** Menjawab apakah naskah Markdown saat ini terbukti secara kriptografis identik hingga tingkat bit raw UTF-8 aslinya (`BYTE_EXACT_HASH_VERIFIED`), atau hanya terbukti kompatibel dengan kontrak normalisasi historis (`NORMALIZED_HASH_VERIFIED`).

**Kasus Khusus Artikel 5:**
Artikel 5 memiliki `provenance_class = FULL_PROVENANCE` (memiliki approval id=9 dan receipt id `rcpt_bbae85b48e1b2f8d`), namun fidelitas sumbernya adalah `NORMALIZED_HASH_VERIFIED`. Hash historisnya dihitung menggunakan `legacy-normalized-sha256-v0` yang menormalisasi spasi berlebih dan case sebelum hashing. Oleh karena itu, kecocokan hash membuktikan kepatuhan terhadap kontrak normalisasi historis, tetapi tidak membuktikan identitas byte-exact Markdown asli. RancangLoka tidak melakukan overclaim identitas byte untuk Artikel 5 dan 6.

### 2. Kontrak Fidelitas Sumber (`source_fidelity`)
Kolom permanen `source_fidelity TEXT NOT NULL` ditambahkan ke `article_dna_signatures` dengan nilai yang terdefinisi ketat (dilarang menggunakan label kabur seperti HIGH/MEDIUM/LOW):
- **`BYTE_EXACT_HASH_VERIFIED`:** Raw bytes Markdown kanonikal saat ini menghasilkan hash yang persis sama dengan `content_hash` publikasi di bawah algoritma `canonical-markdown-sha256-v1`.
- **`NORMALIZED_HASH_VERIFIED`:** Markdown saat ini mereproduksi hash otoritatif historis di bawah algoritma `legacy-normalized-sha256-v0`, namun kontrak hash historis tidak mengunci variasi byte kecil seperti whitespace/casing.

### 3. Matriks Klasifikasi Artikel 5–9
| Article ID | Slug | `provenance_class` | `content_hash_contract` | `source_fidelity` | Kunci Versi (`version_key`) |
|---|---|---|---|---|---|
| **5** | `kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia` | `FULL_PROVENANCE` | `legacy-normalized-sha256-v0` | `NORMALIZED_HASH_VERIFIED` | `receipt:rcpt_bbae85b48e1b2f8d` |
| **6** | `rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman` | `PARTIAL_HISTORICAL_PROVENANCE` | `legacy-normalized-sha256-v0` | `NORMALIZED_HASH_VERIFIED` | `historical:6:18a20463...` |
| **7** | `jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge` | `FULL_PROVENANCE` | `canonical-markdown-sha256-v1` | `BYTE_EXACT_HASH_VERIFIED` | `receipt:rcpt_artA_d476e9020634` |
| **8** | `thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi` | `FULL_PROVENANCE` | `canonical-markdown-sha256-v1` | `BYTE_EXACT_HASH_VERIFIED` | `receipt:rcpt_artB_f3fb92d8c53d` |
| **9** | `memilih-sistem-shading-luar-rumah-tropis` | `FULL_PROVENANCE` | `canonical-markdown-sha256-v1` | `BYTE_EXACT_HASH_VERIFIED` | `receipt:rcpt_artC_8341d2fda3bc` |

### 4. Amandemen Migrasi 0034
Karena migrasi `db/migrations/0034_article_publication_dna.sql` belum pernah diaplikasikan ke lingkungan produksi, migrasi tersebut diamandemen langsung di tempat (*in-place amendment*) tanpa membuat file 0035. Kolom `source_fidelity TEXT NOT NULL` ditambahkan ke dalam DDL `CREATE TABLE article_dna_signatures`.

### 5. Fidelitas Publikasi Baru di Masa Depan
Seluruh publikasi baru yang dihasilkan oleh publisher runtime kanonikal selalu menggunakan `canonical-markdown-sha256-v1`. Oleh karena itu, publisher runtime secara deterministik menetapkan:
$$\text{source\_fidelity} = \text{BYTE\_EXACT\_HASH\_VERIFIED}$$
Materializer (`publication-dna-store.ts`) secara ketat menolak upaya publikasi baru untuk memancarkan `NORMALIZED_HASH_VERIFIED` di bawah kontrak Markdown V1, serta menolak naskah Legacy V0 mengklaim `BYTE_EXACT_HASH_VERIFIED`.

### 6. Utilitas Backfill & Keamanan Eksekusi CLI
Utilitas backfill diimplementasikan pada `scripts/backfill-publication-dna.js`:
- **Scope Terbatas Ketat:** Hanya memproses `article_id IN (5,6,7,8,9)`. Artikel lain tidak akan disentuh secara implisit.
- **Tabel Sumber Read-Only:** Hanya melakukan pembacaan SELECT dari tabel `articles`, `article_editorial_approvals`, `publication_execution_receipts`, `article_publication_executions`, `media_assets`, dan `article_media`. Tidak ada operasi UPDATE, DELETE, atau ALTER di seluruh alur kerja backfill.
- **Satu-Satunya Target Tulis:** Hanya menyisipkan ke tabel `article_dna_signatures`.
- **Default Aman Dry-Run:** Default eksekusi adalah selalu `--dry-run`.
- **Gerbang Konfirmasi Ganda (*Dual Confirmation Gate*):** Mode tulis produksi wajib menyertakan DUA argumen eksplisit:
  `--apply --confirm-production-dna-backfill`
  Jika hanya salah satu yang diberikan, eksekusi secara otomatis bertahan di mode DRY RUN.
- **Prinsip Validasi Total Pra-Tulis:** Seluruh artikel dalam cakupan (5–9) harus menghasilkan status `WOULD_INSERT`. Jika terdapat satu saja artikel yang menghasilkan status `BLOCKED_*`, seluruh proses berhenti seketika tanpa ada penyisipan data.

### 7. Hasil Dry-Run Produksi Aktual (Cloudflare D1 `DB`)
Eksekusi verifikasi read-only dijalankan langsung terhadap basis data produksi Cloudflare D1 menggunakan perintah:
`node scripts/backfill-publication-dna.js --remote --dry-run`

Hasil yang diperoleh (100% konsisten dan valid):
```
===============================================================================================================================================================================
Article | Slug                                 | Version Key                    | Provenance | Contract      | Fidelity   | Hash Verif           | Appr | Rcpt | Asset | Planned Action
===============================================================================================================================================================================
5       | kusen-aluminium-vs-upvc-untuk-rumah- | receipt:rcpt_bbae85b48e1b2f8d  | FULL       | v0-legacy     | NORMALIZED | PASS_NORMALIZED_MATCH| VALID| VALID| RESOLV| WOULD_INSERT
6       | rekayasa-ventilasi-silang-alami-untu | historical:6:18a20463523fc5ada | PARTIAL    | v0-legacy     | NORMALIZED | PASS_NORMALIZED_MATCH| PRT_OK|PRT_OK| NONE  | WOULD_INSERT
7       | jendela-berkondensasi-kelembapan-suh | receipt:rcpt_artA_d476e9020634 | FULL       | v1-markdown   | BYTE_EXACT | PASS_BYTE_EXACT_MATCH| VALID| VALID| RESOLV| WOULD_INSERT
8       | thermal-bridge-kusen-aluminium-penye | receipt:rcpt_artB_f3fb92d8c53d | FULL       | v1-markdown   | BYTE_EXACT | PASS_BYTE_EXACT_MATCH| VALID| VALID| RESOLV| WOULD_INSERT
9       | memilih-sistem-shading-luar-rumah-tr | receipt:rcpt_artC_8341d2fda3bc | FULL       | v1-markdown   | BYTE_EXACT | PASS_BYTE_EXACT_MATCH| VALID| VALID| RESOLV| WOULD_INSERT
===============================================================================================================================================================================
Summary: 5 total, 5 WOULD_INSERT, 0 ALREADY_EXISTS, 0 BLOCKED. Mode: DRY_RUN
```
- Mutasi yang terjadi pada D1 produksi: **0 (NOL)**.
- Mutasi yang terjadi pada R2 produksi: **0 (NOL)**.

### 8. Prosedur Wajib Peluncuran Produksi (Mandatory Production Rollout Order)
*(BERHASIL DIEKSEKUSI PADA 2026-10-16)*

- **LANGKAH 1:** Aplikasikan migrasi 0034 ke D1 produksi:
  `npx wrangler d1 execute DB --remote --file=db/migrations/0034_article_publication_dna.sql` (SELESAI)
- **LANGKAH 2:** Verifikasi bahwa tabel `article_dna_signatures` telah terbentuk dan berstatus kosong (0 baris):
  `npx wrangler d1 execute DB --remote --command="SELECT COUNT(*) AS total FROM article_dna_signatures"` (SELESAI — 0 rows)
- **LANGKAH 3:** Deploy runtime Cloudflare Worker yang memuat dukungan `source_fidelity` (fase 1B-B dan 1B-C):
  `npx wrangler deploy` (SELESAI — Worker Version: `8f174086-8679-4f31-aec9-1c64844e8bd9`)
- **LANGKAH 4:** Lakukan smoke test terhadap perilaku publikasi, invalidasi cache, dan panel admin yang sedang berjalan untuk memastikan tidak ada regresi:
  (SELESAI — seluruh rute publik 200, edge cache HIT, admin/404 BYPASS no-store)
- **LANGKAH 5:** Jalankan kembali dry-run utilitas backfill untuk memvalidasi kesiapan akhir basis data:
  `node scripts/backfill-publication-dna.js --remote --dry-run` (SELESAI — 5 x WOULD_INSERT)
- **LANGKAH 6:** Jalankan backfill produksi dengan gerbang konfirmasi ganda:
  `node scripts/backfill-publication-dna.js --remote --apply --confirm-production-dna-backfill` (SELESAI — 5 DNA rows inserted)
- **LANGKAH 7:** Verifikasi bahwa tepat 5 baris DNA abadi telah tersimpan di D1 produksi:
  `npx wrangler d1 execute DB --remote --command="SELECT article_id, version_key, provenance_class, content_hash_contract, source_fidelity FROM article_dna_signatures ORDER BY article_id ASC"` (SELESAI — 5 rows verified)
- **LANGKAH 8:** Ulangi eksekusi skrip backfill untuk membuktikan idempotensi mutlak:
  Hasil yang diperoleh: **`5 x ALREADY_EXISTS_IDENTICAL`**, dengan 0 perubahan dan 0 baris tambahan.

---

## 9. Rekam Jejak Akseptansi Produksi (Production Acceptance Record)

Pada 16 Oktober 2026, seluruh rangkaian peluncuran produksi `CONTENT_PROTECTION-1B-C` telah diselesaikan dengan akseptansi penuh:

1. **Migrasi Database D1 Remote:**
   - Database: `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`)
   - Migrasi `db/migrations/0034_article_publication_dna.sql` berhasil diterapkan.
   - Tabel `article_dna_signatures` memiliki 27 kolom termasuk `source_fidelity TEXT NOT NULL`.
   - Pre-backfill row count: tepat 0.

2. **Deployment Cloudflare Worker Runtime:**
   - Active Version: `8f174086-8679-4f31-aec9-1c64844e8bd9` (100% produksi).
   - Baseline Rollback: `624b040f-52ed-4fde-8b6b-fd4d3d413586`.
   - Health smoke: Beranda (200), Artikel 5/7/8/9 (200), RSS/Sitemap/Search (200), Admin login (200 no-store/bypass), 404 (404 no-store/bypass). Cache MISS $\to$ HIT terverifikasi pada fetch kedua (Artikel 8 dan Beranda `Cf-Cache-Status: HIT`).

3. **Controlled Publication DNA Backfill (Articles 5–9):**
   - Tepat 5 baris disisipkan secara atomik dan immutable:
     - **Artikel 5:** `dna_5db18b85-b775-41ea-b5a3-62facacce785` | `receipt:rcpt_bbae85b48e1b2f8d` | `FULL_PROVENANCE` | `legacy-normalized-sha256-v0` | `NORMALIZED_HASH_VERIFIED`
     - **Artikel 6:** `dna_c6a6977b-05f2-4994-8a08-98e170c8ec79` | `historical:6:18a20463523fc5ada7287fc54e37b8346d0e69b90cef9656544950dd4bb4dd1d` | `PARTIAL_HISTORICAL_PROVENANCE` | `legacy-normalized-sha256-v0` | `NORMALIZED_HASH_VERIFIED`
     - **Artikel 7:** `dna_e8fcdd1e-0f8c-43a5-bcb5-dbdf8c2d80fd` | `receipt:rcpt_artA_d476e9020634` | `FULL_PROVENANCE` | `canonical-markdown-sha256-v1` | `BYTE_EXACT_HASH_VERIFIED`
     - **Artikel 8:** `dna_91f69443-eeeb-43c9-9b9a-5f9b20d625da` | `receipt:rcpt_artB_f3fb92d8c53d` | `FULL_PROVENANCE` | `canonical-markdown-sha256-v1` | `BYTE_EXACT_HASH_VERIFIED`
     - **Artikel 9:** `dna_c3a67801-04a0-4192-ad58-fd11b4a525f0` | `receipt:rcpt_artC_8341d2fda3bc` | `FULL_PROVENANCE` | `canonical-markdown-sha256-v1` | `BYTE_EXACT_HASH_VERIFIED`

4. **Kelengkapan Sidik Jari Kriptografis & Forensik:**
   - Seluruh baris memiliki `normalized_text_hash` (64 heksadesimal), `block_hashes_json` (4.607 s/d 9.824 karakter), `minhash_signature_json` (64 komponen afin, 1.217 karakter), dan `structural_signature_json` (177 s/d 227 karakter).
   - Seluruh baris memuat kontrak versi kanonikal: `dna_version = 'v1.0'`, `normalization_version = 'norm-v1'`, `shingle_version = 'shingle-4w-v1'`, `minhash_version = 'minhash-64h-v1'`, `generator_version = 'dna-engine/1.0.0'`.

5. **Bukti Idempotensi Produksi:**
   - Dry-run pasca-backfill menghasilkan tepat: **`5 x ALREADY_EXISTS_IDENTICAL`**, 0 WOULD_INSERT, 0 BLOCKED.

6. **Integritas Sumber Data Otoritatif:**
   - Hash naskah Artikel 5–9, tanda terima penerbitan (`publication_execution_receipts`), persetujuan editorial (`article_editorial_approvals`), dan eksekusi rilis **100% identik dan tanpa mutasi**.
   - Tidak ada mutasi R2 atau perubahan konfigurasi dashboard Cloudflare.
   - Seluruh invarian keselamatan (`automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, autonomous media = DISABLED) tetap aktif.
