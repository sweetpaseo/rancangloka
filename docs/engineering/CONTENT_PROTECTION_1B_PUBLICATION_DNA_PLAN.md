# 🧬 RancangLoka — CONTENT_PROTECTION-1B Architecture & Implementation Plan
## Phase 1B: Publication DNA (Provenance, Cryptographic Identity & Forensic Similarity)

**Milestone:** `CONTENT_PROTECTION-1B`  
**Phase:** `PUBLICATION DNA ARCHITECTURE & PLANNING`  
**Parent Blueprint:** [`docs/engineering/CONTENT_PROTECTION_1_BLUEPRINT.md`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/docs/engineering/CONTENT_PROTECTION_1_BLUEPRINT.md)  
**Target Repository:** `rancangloka-astro/`  
**Status:** `CONTENT_PROTECTION_1B_PLAN_PASS`  
**Date:** 2026-10-16  
**Current Production Worker:** `624b040f-52ed-4fde-8b6b-fd4d3d413586`  
**Current Source HEAD:** `125d61c`  
**Branch:** `feat/jev-lokamedia-integration`  

---

## 1. Executive Summary & Purpose

Inisiatif **CONTENT_PROTECTION-1B (Publication DNA)** merancang arsitektur pencatatan identitas, provenansi kriptografis, dan bukti kemiripan (*similarity evidence*) yang kokoh, deterministik, dan dapat diverifikasi untuk seluruh naskah dan aset media yang diterbitkan oleh redaksi RancangLoka.

### Objektif Inti (Core Purpose):
Memungkinkan RancangLoka di masa depan membuktikan secara matematis, historis, dan forensik:
1. **Naskah Apa yang Disetujui:** Naskah kanonikal persis yang disetujui oleh Chief Editor (`approved_content_hash`).
2. **Naskah Apa yang Diterbitkan:** Konten aktual persis yang aktif di web publik (`published_content_hash`).
3. **Kapan Diterbitkan:** Jejak waktu otoritatif yang dicatat langsung oleh server basis data (`actual_published_at`).
4. **Tanda Terima Apa yang Mengesahkan:** Tanda terima penerbitan atomik yang mengikat eksekusi (`publication_receipt_id`).
5. **Aset Apa yang Melekat:** Hash SHA-256 dan silsilah aset media unggulan yang diotorisasi (`featured_asset_sha256`).
6. **Apakah Teks Pihak Ketiga Merupakan Derivasi/Kloning:** Bukti kemiripan struktural, parsial, dan corpus-relative ketika teks lain di web terbuka tampak disalin atau diaransemen ulang secara substansial.

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
- **IDENTITY (Identitas Kriptografis):** Sidik jari pasti (SHA-256) atas teks dan media asli.
- **SIMILARITY EVIDENCE (Bukti Kemiripan):** Sinyal matematis pasif (paragraf, MinHash, struktur) untuk membandingkan derajat tumpang-tindih.
- **FORENSIC SUPPORT (Dukungan Forensik):** Data pendukung bagi editor manusia dan penasihat hukum ketika mengevaluasi dugaan pelanggaran hak cipta.

### Batas yang TIDAK BOLEH Dilampaui:
Publication DNA **BUKAN**:
- ❌ **DRM (Digital Rights Management)**
- ❌ **Pencegah Penyalinan Otomatis (Copy Prevention)**
- ❌ **Hakim Hak Cipta Otomatis (Automatic Copyright Adjudication)**
- ❌ **Mesin Penuduh Pencurian Otomatis (Automatic Theft Accusation)**

Dilarang keras menggunakan terminologi teknis yang mengklaim bahwa Publication DNA secara sepihak "membuktikan pelanggaran hak cipta secara hukum". Kemiripan matematis hanyalah alat bantu forensik; penentuan hukum tetap merupakan domain yurisdiksi dan pertimbangan manusia.

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

## 4. Struktur Rekam DNA Kanonikal (Canonical DNA Record)

Rekam DNA Publikasi dirancang untuk menangkap snapshot forensik tanpa redundansi sia-sia. Setiap field dievaluasi secara ketat:

| Nama Field | Tipe Data | Klasifikasi Peran | Penjelasan Arsitektur |
|---|---|---|---|
| `dna_id` | `TEXT PRIMARY KEY` | **SOURCE OF TRUTH FIELD** | Format `dna_<sha256_prefix8>`, identitas unik rekam DNA. |
| `article_id` | `INTEGER NOT NULL` | **SOURCE OF TRUTH FIELD** | Relasi ke entitas artikel (`articles.id`). |
| `publication_receipt_id` | `TEXT NOT NULL` | **SOURCE OF TRUTH FIELD** | Kunci asing otoritatif ke `publication_execution_receipts.receipt_id`. |
| `publication_execution_id` | `TEXT NOT NULL` | **SOURCE OF TRUTH FIELD** | Relasi ke batch eksekusi `article_publication_executions.execution_id`. |
| `canonical_slug` | `TEXT NOT NULL` | **DUPLICATED FOR FORENSIC SNAPSHOT** | Snapshot slug saat publikasi, melindungi bukti jika di masa depan ada migrasi slug. |
| `canonical_url` | `TEXT NOT NULL` | **DUPLICATED FOR FORENSIC SNAPSHOT** | Snapshot URL publik resmi (`https://rancangloka.com/[slug]`). |
| `approved_content_hash` | `TEXT NOT NULL` | **DUPLICATED FOR FORENSIC SNAPSHOT** | Snapshot hash persetujuan Chief Editor dari `article_editorial_approvals`. |
| `published_content_hash` | `TEXT NOT NULL` | **DUPLICATED FOR FORENSIC SNAPSHOT** | Hash SHA-256 dari naskah Markdown kanonikal yang diterbitkan. Wajib identik dengan `articles.content_hash`. |
| `approved_at` | `DATETIME` | **DUPLICATED FOR FORENSIC SNAPSHOT** | Waktu persetujuan Chief Editor disahkan. |
| `actual_published_at` | `DATETIME NOT NULL` | **DUPLICATED FOR FORENSIC SNAPSHOT** | Stempel waktu atomik dari server basis data saat transaksi publikasi dieksekusi. |
| `featured_asset_id` | `TEXT` | **DUPLICATED FOR FORENSIC SNAPSHOT** | ID aset media unggulan yang terikat saat terbit. |
| `featured_asset_sha256` | `TEXT` | **DUPLICATED FOR FORENSIC SNAPSHOT** | Hash SHA-256 binary gambar master/derivatif unggulan. |
| `dna_version` | `TEXT NOT NULL` | **SOURCE OF TRUTH FIELD** | Versi algoritma DNA (misal: `'v1.0'`). |
| `normalization_version` | `TEXT NOT NULL` | **SOURCE OF TRUTH FIELD** | Versi kontrak normalisasi teks (misal: `'norm-v1'`). |
| `normalized_text_hash` | `TEXT NOT NULL` | **DERIVED FIELD** | SHA-256 dari teks naskah setelah normalisasi deterministik. |
| `structural_signature` | `TEXT NOT NULL` | **DERIVED FIELD** | JSON representasi arsitektur dokumen (heading hierarchy, paragraph count, card slots). |
| `paragraph_hashes` | `TEXT NOT NULL` | **DERIVED FIELD** | JSON array SHA-256 dari setiap paragraf yang telah dinormalisasi. |
| `minhash_signature` | `TEXT NOT NULL` | **DERIVED FIELD** | JSON array dari 64 integer MinHash (k-shingle 4 perkataan). |
| `rare_phrases` | `TEXT NOT NULL` | **DERIVED FIELD** | JSON array 5–10 n-gram langka relatif terhadap korpus RancangLoka. |
| `provenance_class` | `TEXT NOT NULL` | **SOURCE OF TRUTH FIELD** | Status kelengkapan jejak (`FULL_PROVENANCE` vs `PARTIAL_HISTORICAL_PROVENANCE`). |
| `generator_version` | `TEXT NOT NULL` | **SOURCE OF TRUTH FIELD** | Versi pustaka pembangkit DNA (misal: `'dna-engine/1.0.0'`). |
| `created_at` | `DATETIME NOT NULL` | **SOURCE OF TRUTH FIELD** | Waktu rekaman DNA dimaterialisasi ke D1. |

### Field yang Dievaluasi namun DITOLAK (UNNECESSARY FIELDS):
- ❌ `full_text_backup`: Ditolak. Naskah Markdown sudah tersimpan aman di tabel `articles.content_md` dan `article_state_snapshots`. Menyimpan naskah penuh di tabel DNA akan memboroskan kuota D1 hingga 3x lipat.
- ❌ `html_rendered_hash`: Ditolak. Template HTML Astro dapat berubah ketika ada pembaruan CSS, komponen UI, atau perbaikan markup tanpa mengubah makna artikel. Menggunakan hash HTML akan memicu false positive invalidasi forensik.
- ❌ `simhash_64`: Ditolak / Ditunda (`DEFERRED`). SimHash redundant dengan MinHash 64-vector (lihat Bagian 10).

---

## 5. Audit Data Kanonikal Eksisting & Tradeoff Duplikasi

Berdasarkan audit langsung pada runtime dan migrasi database (`0001` s/d `0026`), sistem publikasi RancangLoka telah memiliki fondasi data otoritatif berikut:

| Entitas Data Eksisting | Tabel Sumber Otoritatif | Kolom Otoritatif yang Digunakan |
|---|---|---|
| **Approval Hash & Waktu** | `article_editorial_approvals` | `approved_content_hash`, `approved_by`, `approved_role`, `created_at` (id persetujuan). |
| **Kesiapan Naskah** | `article_publication_readiness` | `content_hash`, `snapshot_json`, `is_ready`, `created_at`. |
| **Rencana Publikasi** | `article_publication_plans` | `plan_id`, `content_hash`, `featured_asset_id`, `target_publish_at`. |
| **Eksekusi Publikasi** | `article_publication_executions` | `execution_id`, `actual_published_at`, `execution_status`. |
| **Tanda Terima Kriptografis** | `publication_execution_receipts` | `receipt_id`, `content_hash`, `canonical_url`, `actual_published_at`, `publisher_version`. |
| **Naskah Publik Aktif** | `articles` | `id`, `slug`, `content_md`, `content_hash`, `status`, `published_at`. |
| **Aset Media Aktif** | `article_media` & `media_assets` | `asset_id`, `role = 'featured'`, `sha256`, `storage_key`. |

### Analisis Tradeoff: Referensi Kunci Asing vs Snapshot Forensik

Ada dua pendekatan arsitektur untuk data identitas:
1. **Pendekatan Murni Relasional (Normalisasi Database Ketat):** Tabel DNA hanya menyimpan `receipt_id` dan `foreign keys`, sementara data waktu, hash, dan URL ditarik lewat `JOIN`.
2. **Pendekatan Snapshot Forensik Terisolasi (Forensic Snapshot Model):** Tabel DNA mereferensikan kunci asing, namun **secara sengaja menduplikasi nilai-nilai kunci yang bersifat abadi (immutable)** seperti `canonical_slug`, `published_content_hash`, `actual_published_at`, dan `featured_asset_sha256`.

### Keputusan Arsitektur:
> **PILIHAN: FORENSIC SNAPSHOT MODEL.**  
> **Alasan Keamanan Forensik:** Rekam DNA dirancang untuk dapat diekspor, diaudit, atau diverifikasi oleh auditor eksternal/pengadilan secara terisolasi tanpa memerlukan dependensi hidup ke relasi tabel lain. Jika di masa depan tabel operasional dibersihkan (*partitioned / archived*), rekaman DNA tetap utuh sebagai dokumen bukti mandiri (*self-contained cryptographic evidence*).

---

## 6. Normalisasi Teks Deterministik (Text Normalization)

Normalisasi teks digunakan **HANYA** untuk komputasi sidik jari forensik dan komparasi kesamaan. Normalisasi ini **TIDAK PERNAH** memodifikasi teks artikel yang disimpan atau disajikan kepada pembaca.

### Tahapan Pipeline Normalisasi (`normalization_version = 'norm-v1'`):
1. **Unicode Canonical Normalization:** Menerapkan Unicode Normalization Form KC (`NFKC`) untuk menstandarkan karakter beraksen, simbol tipografi, dan variasi ligatur.
2. **End-of-Line Standardization:** Mengubah seluruh variasi baris baru (`\r\n` Windows, `\r` Mac klasik) menjadi `\n` (Unix LF).
3. **HTML / Markdown Stripping Konservatif:**
   - Menghapus tag HTML inline (`<p>`, `<div>`, `<span>`, `<strong>`, dll.) menggunakan regex non-backtracking yang aman.
   - Menghapus penanda sintaks Markdown khusus tautan (`[teks](url)` $\rightarrow$ `teks`), gambar (`![alt](url)` $\rightarrow$ diabaikan), format penekanan (`**teks**`, `*teks*` $\rightarrow$ `teks`), dan penanda kutipan blockquote (`> `).
4. **Heading & Block Extraction:** Mengekstrak teks judul (H1, H2, H3, H4) dan teks item daftar (*bullet/numbered lists*) sebagai blok semantik terpisah.
5. **Whitespace Collapsing:** Menggabungkan spasi ganda atau tab horizontal berurutan menjadi satu spasi tunggal (`\t+` $\rightarrow$ `' '`, `' {2,}'` $\rightarrow$ `' '`). Menghilangkan spasi di awal dan akhir setiap baris (*trimming*).
6. **Case & Punctuation Handling untuk Similarity Matching:**
   - Untuk **Exact Cryptographic Identity**, case dan tanda baca asli dipertahankan penuh (lihat Bagian 7).
   - Untuk **Similarity / Shingling**, teks ditransformasikan ke huruf kecil (*case-folded lowercase*) dan tanda baca non-alfanumerik dibersihkan dengan mempertahankan batas kata.

### Kontrak Versi Eksplisit:
Untuk mencegah inkonsistensi sidik jari di masa depan, setiap rekam DNA wajib menyertakan:
- `normalization_version`: Menjamin bahwa dua teks yang dibandingkan diproses menggunakan aturan normalisasi yang identik.

---

## 7. Identitas Kriptografis Pasti (Cryptographic Identity)

RancangLoka memisahkan secara tegas antara **Identitas Pasti (Exact Identity)** dan **Kemiripan (Similarity)**.

```
┌────────────────────────────────────────────────────────┐
│                   NASKAH ARTIKEL                       │
└────────────────────────────────────────────────────────┘
          │                                  │
          ▼                                  ▼
[ EXACT CRYPTOGRAPHIC IDENTITY ]    [ SIMILARITY FORENSICS ]
  - Canonical Markdown SHA-256        - Paragraph-level SHA-256
  - Normalized PlainText SHA-256      - 64-vector MinHash
  - Zero tolerance (1 bit = beda)     - Structural Vector
  - Menjawab: "Apakah ini persis      - Rare Phrase Set
    artikel yang terbit?"             - Menjawab: "Berapa persen
                                        kesamaan derivasi teks ini?"
```

### Integrasi dengan `articles.content_hash`:
- Kolom `articles.content_hash` yang sudah ada di basis data dihitung dari string naskah Markdown kanonikal utuh (`sha256(canonical_markdown)`).
- Hash ini telah diverifikasi oleh Chief Editor (`approved_content_hash`) dan dicatat dalam `publication_execution_receipts`.
- **Keputusan:** Publication DNA **TIDAK MENGGANTI** hash tepercaya ini. DNA menyimpan snapshot `published_content_hash` (yang bernilai sama dengan `articles.content_hash`) serta melengkapinya dengan `normalized_text_hash` untuk verifikasi lintas format.

---

## 8. Tanda Tangan Tingkat Paragraf (Paragraph Signatures)

### Tujuan:
Memungkinkan deteksi penyalinan sebagian (*partial copy*), pencurian bagian naskah tertentu, atau pengacakan urutan paragraf (*paragraph reordering*) tanpa memerlukan modifikasi teks.

### Aturan Segmentasi Paragraf Deterministik:
1. Pemisahan dilakukan berdasarkan pembatas blok standar: dua baris baru berurutan (`\n\n+`).
2. Fragmen kosong, baris pemisah horizontal (`---`), dan baris metadata murni diabaikan.
3. Setiap paragraf yang valid diproses melalui normalisasi konservatif (`norm-v1`).
4. Tanda tangan dihitung: `sha256(normalized_paragraph)`.

### Format Penyimpanan D1:
Array tanda tangan disimpan dalam format JSON:
```json
[
  {"idx": 0, "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "words": 42},
  {"idx": 1, "hash": "845942468d66cf7bfb08e2f896eb997da645c065f463c5d6c5bb8cb3dd7d294d", "words": 58}
]
```

### Estimasi Biaya Penyimpanan (Storage Cost Estimate — `DESIGN_ESTIMATE`):
- Rata-rata artikel RancangLoka memiliki 15–30 paragraf.
- Setiap objek paragraf berukuran ~80 byte (hash heksadesimal 64 karakter + metadata indeks).
- Total ukuran kolom `paragraph_hashes`: **1.5 KB – 2.5 KB per artikel**.
- Dampak terhadap kapasitas D1: Sangat ringan dan efisien.

---

## 9. Sidik Jari Shingles & MinHash (Corpus-Relative Similarity)

### Tujuan:
Menghasilkan representasi kompak naskah untuk mengukur indeks kesamaan Jaccard (*Jaccard Similarity Coefficient*) terhadap teks lain. Sangat efektif untuk mendeteksi:
- Naskah yang disalin dalam jumlah besar namun diselingi kalimat pengisi.
- Naskah dengan kalimat-kalimat yang ditukar urutannya.
- Naskah yang mengalami parafrasa ringan.

### Spesifikasi Teknis MinHash V1:
- **Unit Shingle:** 4-gram perkataan (*4-word token shingles*). Contoh: `"kusen aluminium memiliki keunggulan"` $\rightarrow$ satu shingle.
- **Ukuran Tanda Tangan:** **64 hash integers** (vektor 64 dimensi).
- **Fungsi Hash:** 64 fungsi hash linier independen berdistribusi seragam:
  $$h_i(x) = (a_i \cdot x + b_i) \pmod p$$
  di mana $a_i, b_i$ adalah konstanta pseudo-random acak deterministik ber-seed tetap, dan $p$ adalah bilangan prima besar ($2^{61}-1$).
- **Format Penyimpanan:** JSON array berisi 64 bilangan bulat tak bertanda (*unsigned integers*): `[1849204, 9823019, ...]`.

### Estimasi Ukuran Penyimpanan (`DESIGN_ESTIMATE`):
- 64 integer dalam array JSON: **~512 – 600 byte per artikel**.

### Batasan Forensik Mutlak MinHash (Forensic Limitations):
1. MinHash adalah **bukti kemiripan matematis**, BUKAN identitas kriptografis.
2. Nilai kesamaan Jaccard 85% membuktikan adanya tumpang-tindih teks yang masif, namun **tidak membuktikan arah penyalinan (*copying direction*)**. Arah penyalinan hanya dapat ditentukan melalui perbandingan kronologis publikasi (`actual_published_at` vs stempel waktu pihak ketiga).
3. MinHash **tidak membuktikan kepengarangan asli (*authorship*)** secara mandiri; ia membuktikan kepemilikan tanggal publikasi atas teks tersebut di pihak RancangLoka.

---

## 10. Evaluasi SimHash: Keputusan dan Rasional

### Perbandingan Karakteristik:

| Dimensi | MinHash (Dipilih) | SimHash (Dievaluasi) |
|---|---|---|
| **Metrik Matematika** | Memperkirakan koefisien Jaccard ($|A \cap B| / |A \cup B|$). | Mengukur jarak Hamming pada ruang kosinus. |
| **Kelebihan Utama** | Sangat sensitif terhadap tumpang-tindih sebagian (*containment* & *partial copy*). | Sangat cepat untuk menyaring dokumen yang 95%+ identik dalam skala jutaan korpus. |
| **Kesesuaian Teks Arsitektur** | Sangat baik untuk mendeteksi pencurian 2–3 bab dari artikel panduan komprehensif. | Cenderung bias jika artikel diubah panjangnya atau dicampur dengan konten lain. |
| **Kebutuhan Komputasi** | Sedang (64 iterasi hash per shingle). | Rendah (64-bit vector projection). |

### Keputusan Arsitektur:
> **STATUS KEPUTUSAN: `DEFER` (DITUNDA).**  
> **Rasional:** Untuk ukuran korpus RancangLoka saat ini dan pola penyalinan yang paling sering terjadi di media digital Indonesia (pencurian selektif artikel panjang atau komparasi spesifik), **MinHash jauh lebih unggul dan informatif** dalam mendeteksi *partial overlap*. Menambahkan SimHash pada Fase 1B hanya akan menciptakan redundansi sinyal dan menambah beban komputasi Worker tanpa memberikan nilai forensik baru.

---

## 11. Tanda Tangan Struktural (Structural Signature)

Ketika pihak ketiga menyalin artikel dengan memparafrasa seluruh kalimat menggunakan AI pemutar kata (*word spinner*), struktur intelektual dan alur argumen dokumen sering kali tetap dipertahankan.

### Parameter Tanda Tangan Struktural Pasif:
Tanda tangan ini diekstrak dari hierarki semantik murni Markdown/HTML tanpa mengikat class CSS yang rentan berubah saat redesign:
1. **Heading Hierarchy Vector:** Urutan dan kedalaman judul, misal:
   `["H2:prinsip-dasar", "H3:ventilasi-silang", "H3:jalur-angin", "H2:material-rekomendasi"]`
2. **Block Counts:**
   - Jumlah paragraf (`paragraph_count`)
   - Jumlah daftar berbutir/bernomor (`list_count`)
   - Jumlah tabel komparasi (`table_count`)
   - Jumlah slot kartu dukungan (*support card slots*)
3. **Media Anchor Distribution:** Posisi peletakan aset visual relatif terhadap paragraf (misal: gambar featured di atas H2-1, diagram di antara H2-2 dan H2-3).

### Format Penyimpanan JSON:
```json
{
  "h_levels": ["H2", "H3", "H3", "H2"],
  "h_count": 4,
  "p_count": 18,
  "tables": 1,
  "lists": 2,
  "media_slots": [0, 8]
}
```

---

## 12. Sinyal Rangkaian Frasa Langka (Corpus-Relative Rare Phrases)

### Prinsip Keamanan & Redaksi:
- "Langka" didefinisikan secara matematis **relatif terhadap korpus internal RancangLoka** (misalnya n-gram 3–4 kata dengan frekuensi dokumen rendah di korpus sendiri, namun menjadi jangkar pembahasan teknis).
- **DILARANG MENGGUNAKAN DAFTAR KATA TEBAKAN (HARDCODED GUESS).**
- **DILARANG MENYISIPKAN KATA ANEH KE DALAM PROSA EDITORIAL.**
- Data frasa langka disimpan dalam basis data privat internal dan **TIDAK DIPUBLIKASIKAN** di antarmuka publik atau meta tag agar pihak penyalin tidak dapat membersihkannya secara selektif.

---

## 13. Asset DNA (Provenansi & Sidik Jari Media)

Berdasarkan audit tabel `media_assets` dan `article_media`, sistem RancangLoka saat ini telah mencatat:
- `sha256`: Hash kriptografis pasti dari file gambar biner.
- `storage_key`: Jalur penyimpanan di R2 bucket `media/images/...`.
- `article_media.role`: Peran media dalam artikel (`featured`, dll.).

### Perluasan Konseptual Asset DNA:
Asset DNA mencatat silsilah lengkap media:
1. `asset_id`: ID unik aset (misal: `ast_4ee0363758a41bd45aae7353`).
2. `sha256`: Hash biner master/derivatif.
3. `source_type`: Klasifikasi taksonomi aset (lihat Bagian 14).
4. `master_asset_id`: Hubungan derivatif ke file master beresolusi penuh di R2 privat.
5. `article_binding`: Ikatan artikel tempat aset diterbitkan secara sah.
6. `perceptual_hash` (dHash/pHash 64-bit): Sidik jari persepsi visual untuk mendeteksi penggunaan ulang gambar yang telah diubah ukurannya (*resized*), dikompresi ulang (*recompressed*), atau mengalami sedikit penyesuaian gamma.

### Batasan Mutlak Perceptual Hash:
- pHash/dHash adalah **`SIMILARITY EVIDENCE ONLY`**, bukan bukti kepemilikan mutlak.
- Efektif untuk: Resize skala, konversi WebP/JPEG, perubahan rasio kompresi.
- Terbatas/Tidak Efektif untuk: Pemotongan ekstrem (*heavy crop*), penggabungan kolase (*composites*), atau distorsi geometris berat.

---

## 14. Integrasi Kebijakan Identitas Visual (Visual Identity Policy)

Publication DNA wajib tunduk pada **`RANCANGLOKA_VISUAL_IDENTITY_POLICY`** yang telah disahkan. Taksonomi aset RancangLoka meliputi:

1. `RANCANGLOKA_ORIGINAL`: Karya visual arsitektur asli ciptaan tim redaksi.
2. `RANCANGLOKA_HANDS_ON`: Foto dokumentasi langsung di lapangan/proyek/bengkel.
3. `EDITORIAL_CONCEPT_VISUAL`: Visual konsep arsitektur yang diproduksi untuk tujuan ilustrasi artikel.
4. `MANUFACTURER_SOURCE`: Gambar teknis/spesifikasi resmi dari produsen material.
5. `OFFICIAL_SELLER_SOURCE`: Materi dari distributor resmi berlisensi.
6. `LICENSED_THIRD_PARTY`: Gambar berlisensi pihak ketiga dengan hak siar.
7. `USER_SUPPLIED`: Foto yang diserahkan oleh pemilik rumah/pembaca dengan izin redaksi.
8. `THUMBNAIL_DERIVATIVE`: Derivatif WebP 160x160 px untuk navigasi antarmuka.

### Aturan Semantik Kepemilikan:
- **Dilarang Menerapkan Semantik Kepemilikan (*Ownership*) pada Aset Pihak Ketiga:** Untuk aset bertipe `MANUFACTURER_SOURCE` atau `LICENSED_THIRD_PARTY`, Asset DNA membuktikan bahwa **RancangLoka memiliki izin publikasi dan mencatat stempel waktu penyajian**, BUKAN mengklaim hak cipta atas foto milik produsen/pihak ketiga.

---

## 15. Kebijakan Privasi Metadata EXIF (Sensitive EXIF Stripping)

Menegakkan kebijakan permanen:
> **`PUBLIC_DERIVATIVES_STRIP_SENSITIVE_EXIF`**  
> *(Seluruh derivatif publik wajib bersih dari data sensitif pribadi.)*

### Aturan Pemisahan Metadata:
1. **Derivatif Publik (`/media/images/*`, `/media/thumbnails/*`):**
   - Dilarang keras memuat koordinat GPS, nomor seri kamera (*camera serial number*), nama perangkat (*device username*), atau stempel waktu pribadi fotografer.
2. **Master Internal Privat di R2:**
   - Foto `RANCANGLOKA_HANDS_ON` asli dapat menyimpan metadata EXIF lengkap di bucket privat untuk kepentingan arsip forensik redaksi jika diperlukan pembuktian keaslian fisik lapangan.
3. **Publication DNA:**
   - Menyimpan referensi hash dan stempel waktu tanpa mengekspos koordinat GPS atau data privat fotografer ke peramban publik.

---

## 16. Model Penyimpanan D1 (Proposed D1 Schema)

Dirancang sebagai ekstensi skema minimal, aditif, dan tidak merusak tabel yang sudah ada.

### 1. Tabel Utama: `article_dna_signatures`
```sql
CREATE TABLE IF NOT EXISTS article_dna_signatures (
  dna_id TEXT PRIMARY KEY,
  article_id INTEGER NOT NULL,
  publication_receipt_id TEXT NOT NULL,
  publication_execution_id TEXT NOT NULL,
  canonical_slug TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  approved_content_hash TEXT NOT NULL,
  published_content_hash TEXT NOT NULL,
  approved_at DATETIME,
  actual_published_at DATETIME NOT NULL,
  featured_asset_id TEXT,
  featured_asset_sha256 TEXT,
  dna_version TEXT NOT NULL DEFAULT 'v1.0',
  normalization_version TEXT NOT NULL DEFAULT 'norm-v1',
  normalized_text_hash TEXT NOT NULL,
  structural_signature TEXT NOT NULL,
  paragraph_hashes TEXT NOT NULL,
  minhash_signature TEXT NOT NULL,
  rare_phrases TEXT NOT NULL,
  provenance_class TEXT NOT NULL DEFAULT 'FULL_PROVENANCE',
  generator_version TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id),
  FOREIGN KEY (publication_receipt_id) REFERENCES publication_execution_receipts(receipt_id)
);

CREATE INDEX IF NOT EXISTS idx_article_dna_article_id ON article_dna_signatures(article_id);
CREATE INDEX IF NOT EXISTS idx_article_dna_receipt_id ON article_dna_signatures(publication_receipt_id);
CREATE INDEX IF NOT EXISTS idx_article_dna_published_hash ON article_dna_signatures(published_content_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_article_dna_article_receipt ON article_dna_signatures(article_id, publication_receipt_id);
```

### 2. Tabel Pendukung Aset: `media_asset_dna`
```sql
CREATE TABLE IF NOT EXISTS media_asset_dna (
  asset_dna_id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'RANCANGLOKA_ORIGINAL',
  perceptual_hash TEXT,
  dna_version TEXT NOT NULL DEFAULT 'v1.0',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asset_id) REFERENCES media_assets(asset_id)
);

CREATE INDEX IF NOT EXISTS idx_media_dna_asset_id ON media_asset_dna(asset_id);
CREATE INDEX IF NOT EXISTS idx_media_dna_sha256 ON media_asset_dna(sha256);
```

### Identitas Versi Kanonikal (Canonical Version Identity):
- Identitas unik satu versi publikasi adalah pasangan: **`(article_id, publication_receipt_id, published_content_hash)`**.
- Rekam DNA terikat pada **VERSI PUBLIKASI SPESIFIK**, bukan sekadar `article_id`.

---

## 17. Model Immutability & Riwayat Forensik

### Prinsip Append-Only:
- Seluruh baris di tabel `article_dna_signatures` bersifat **IMMUTABLE (ABADI)**.
- Dilarang menjalankan operasi `UPDATE` pada data sidik jari publikasi yang sudah terbentuk.
- **Siklus Revisi Artikel di Masa Depan:**
  $$\text{Revisi Naskah} \longrightarrow \text{Approval Baru} \longrightarrow \text{Receipt Publikasi Baru} \longrightarrow \text{Baris DNA Baru}$$
- Rekam DNA versi lama tetap tersimpan sebagai bukti sejarah bahwa naskah versi lama pernah terbit pada rentang waktu tersebut.

### Pengecualian Sah & Audit Perbaikan Administratif:
Satu-satunya pengecualian di mana modifikasi dapat dipertimbangkan adalah:
1. Kegagalan kalkulasi akibat bug pustaka generator DNA.
2. Kerusakan data biner akibat migrasi database.
Perbaikan administratif wajib dicatat secara transparan ke dalam `audit_logs` dengan mencantumkan aktor manusia, alasan teknis, dan hash sebelum/sesudah perbaikan.

---

## 18. Titik Pembangkitan DNA Runtime (Generation Point)

### Evaluasi Kandidat Titik Pembangkitan:
- **A. Saat Human Approval:** Terlalu awal. Naskah yang disetujui belum tentu langsung terbit (bisa tertahan di hold atau dibatalkan perencanaannya).
- **B. Saat Readiness Snapshot:** Terlalu awal. Masih berstatus pre-flight.
- **C. Saat Publication Planning:** Masih dalam tahap penjadwalan.
- **D. Saat Publication Execution Dimulai:** Belum menjamin transaksi berhasil.
- **E. Segera Setelah Atomic Publication Batch Selesai & Receipt Terbit:** **TITIK TERPILIH.**

### Arsitektur Alur Kerja Kanonikal:
Di dalam `src/lib/publication/publisher-service.ts`:
```
[ executeAtomicPublication ]
             │
             ▼
1. Commit Atomic Batch (D1):
   - UPDATE articles (status = 'published')
   - UPDATE article_publication_executions (status = 'PUBLISHED')
   - INSERT INTO publication_execution_receipts (receipt_id generated)
             │
             ▼
2. Validasi Keberhasilan Batch (artChanges === 1)
             │
             ├──► [ Cache Invalidation ] (Fail-Safe)
             │
             └──► [ Publication DNA Generation ] (Fail-Safe, Post-Receipt Trigger)
                  - Ekstrak naskah dari snapshot terbit
                  - Hitung Normalized Hash, Paragraph Hashes, MinHash, Struktur
                  - INSERT INTO article_dna_signatures
```

---

## 19. Semantik Kegagalan (Failure Semantics)

### Pertanyaan Kritis:
> *Apakah kegagalan komputasi DNA boleh menggagalkan penerbitan artikel publik?*

### Keputusan:
> **`PUBLICATION_SUCCEEDS_DNA_PENDING` (FAIL-SAFE UNTUK REDAKSI).**  
> Penerbitan artikel ke pembaca **TIDAK BOLEH DIBATALKAN ATAU DIBLOKIR** hanya karena generator sidik jari DNA mengalami kehabisan CPU atau error sementara.

### Mesin Status Siklus Hidup DNA:
- `DNA_GENERATED`: Pembangkitan berhasil, sidik jari lengkap tersimpan di D1.
- `DNA_PENDING`: Artikel telah terbit, proses kalkulasi DNA dijadwalkan ke background queue.
- `DNA_GENERATION_FAILED`: Kalkulasi mengalami kesalahan fatal (dicatat ke telemetri Dimas).
- `DNA_RETRY_REQUIRED`: Kegagalan sementara, siap dicoba ulang secara aman oleh sistem.

---

## 20. Strategi Backfill Korpus Historis (Articles 5–9)

Berdasarkan audit empiris langsung pada basis data produksi (`rancangloka_db` remote) tanggal 16 Oktober 2026:

| ID | Slug Artikel | Hash Konten Otoritatif | Status Receipt Eksisting | Klasifikasi Provenansi |
|:---:|---|---|---|:---:|
| **5** | `kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia` | `1427591202905...` | `rcpt_bbae85b48e1b2f8d` (Ada) | **`FULL_PROVENANCE`** |
| **6** | `rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman` | `18a20463523fc...` | *Tidak Ada* (Pra-arsitektur receipt) | **`PARTIAL_HISTORICAL_PROVENANCE`** |
| **7** | `jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge` | `00dc804d7f3bd...` | `rcpt_artA_d476e9020634` (Ada) | **`FULL_PROVENANCE`** |
| **8** | `thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi` | `66094cf52d2d1...` | `rcpt_artB_f3fb92d8c53d` (Ada) | **`FULL_PROVENANCE`** |
| **9** | `memilih-sistem-shading-luar-rumah-tropis` | `12c59631d3b29...` | `rcpt_artC_8341d2fda3bc` (Ada) | **`FULL_PROVENANCE`** |

### Aturan Ketat Backfill:
1. **READ-ONLY PADA DATA PUBLIKASI:** Script backfill hanya membaca naskah dari `articles` dan metadata receipt yang ada.
2. **DILARANG MENGUBAH PROSA:** Dilarang mengedit `content_md`, `content_html`, `content_hash`, atau `published_at`.
3. **DILARANG MEMALSUKAN DATA HISTORIS:** Untuk **Article 6**, ketiadaan receipt diakui secara jujur (`publication_receipt_id = 'HISTORICAL_PRE_RECEIPT_LEGACY'`) dan diklasifikasikan sebagai `PARTIAL_HISTORICAL_PROVENANCE`. Dilarang membuat tanda terima fiktif mundur ke belakang!

---

## 21. Klasifikasi Komparasi Kloning Masa Depan (Future Clone Comparison)

Ketika di masa depan modul pemeriksa kemiripan dijalankan untuk membandingkan teks eksternal dengan DNA RancangLoka, output status dibatasi secara konservatif:

```
[ Input Teks Eksternal ] ──► [ Pipeline Normalisasi norm-v1 ] ──► [ Matriks Bukti ]
                                                                        │
        ┌───────────────────────────────────────────────────────────────┘
        ▼
[ Evaluasi Ambang Batas Konservatif ]
  ├─ Kesamaan MinHash < 30% ──────────────────────────► LOW_SIMILARITY
  ├─ Kesamaan 30% - 60% ATAU Paragraf 1-2 cocok ─────► REVIEW_REQUIRED
  ├─ Kesamaan 60% - 85% + Struktur Identik ──────────► SUSPECTED_DERIVED_CONTENT
  └─ Exact Hash Match ATAU MinHash > 85% + Paragraf ─► PROBABLE_CONTENT_CLONE
```

### Larangan Label Otomatis:
Sistem dilarang keras mengeluarkan label:
- ❌ `STOLEN`
- ❌ `PLAGIARIZED`
- ❌ `COPYRIGHT_INFRINGEMENT`

Label-label tersebut membutuhkan verifikasi itikad, lisensi, atribusi, dan telaah hukum oleh Chief Editor dan tim legal manusia.

---

## 22. Batasan Ruang Lingkup: Bukan Mesin Perayap (Detection Engine Out of Scope)

Fase **CONTENT_PROTECTION-1B** berfokus pada:
- **IDENTITAS (Identity)**
- **PROVENANSI (Provenance)**
- **PENYIMPANAN SIDIK JARI (Fingerprint Storage)**

Fase 1B **TIDAK MEMBANGUN**:
- ❌ Mesin perayap web terjadwal (*scheduled web crawler*).
- ❌ Bot scraping internet terbuka.
- ❌ Modul penegakan hukum atau pelaporan DMCA otomatis.

Fitur pemindaian aktif dapat dievaluasi pada fase lanjutan (`CONTENT_PROTECTION-1C` atau modul pendeteksi khusus) setelah tata kelola identitas internal terbukti stabil.

---

## 23. Kebijakan Eksposur Publik vs Forensik Privat

Untuk mencegah pihak penyalin mempelajari cara mengakali (*gaming/evasion*) sidik jari kemiripan, data DNA dipisahkan secara tegas:

| Elemen DNA | Status Akses | Lokasi Penyajian | Rasional Keamanan |
|---|---|---|---|
| `canonical_url` | **PUBLIK** | HTML `<link rel="canonical">` | Standar SEO web terbuka. |
| `published_at` | **PUBLIK** | HTML `<meta property="article:published_time">` | Standar metadata penanggalan. |
| `content_hash` | **PUBLIK TERBATAS** | Header respons `X-RL-Provenance-Hash` | Bukti kriptografis terbuka atas integritas konten. |
| Endpoint Verifikasi | **PUBLIK** | `/api/verify-provenance?hash=...` | Verifikasi keberadaan naskah secara pasif. |
| `paragraph_hashes` | **PRIVAT** | D1 internal (hanya Admin/Editor) | Rahasia forensik agar tidak disunting spesifik per paragraf. |
| `minhash_signature` | **PRIVAT** | D1 internal (hanya Admin/Editor) | Mencegah penyerang mendesain varian shingle yang lolos deteksi. |
| `structural_signature`| **PRIVAT** | D1 internal (hanya Admin/Editor) | Melindungi analisis tata letak dokumen. |
| `rare_phrases` | **PRIVAT** | D1 internal (hanya Admin/Editor) | Mencegah penghapusan selektif atas frasa-frasa penting. |
| `asset_dna_phashes` | **PRIVAT** | D1 internal (hanya Admin/Editor) | Mencegah pemrosesan gambar khusus penipu pHash. |

---

## 24. Jaminan Nol Dampak SEO, CWV & Aksesibilitas

Arsitektur Publication DNA V1 menjamin:
1. **Zero Text Mutation:** 0 perubahan kata, tanda baca, atau spasi pada teks yang dirender.
2. **Zero DOM Obfuscation:** Struktur HTML artikel tetap semantik murni (`<article>`, `<h1>`, `<h2>`, `<p>`).
3. **Zero Layout Shift (CLS = 0):** Tidak ada elemen dinamis tersembunyi yang disisipkan ke area konten pembaca.
4. **Zero Client JavaScript:** Tidak memerlukan JavaScript peramban untuk validasi; performa INP dan LCP tetap optimal.
5. **Aksesibilitas 100%:** Screen reader membaca naskah asli tanpa terganggu karakter aneh atau tag tak kasat mata.

---

## 25. Analisis Performa & Estimasi Biaya (Performance & Cost Estimates)

Seluruh angka di bawah ini diklasifikasikan secara jujur sebagai:
> **`DESIGN_ESTIMATE / TO_BE_MEASURED`**  
> *(Perkiraan Rancangan / Wajib Diukur di Lingkungan Nyata)*

| Komponen | Estimasi Beban Komputasi / Penyimpanan | Kategori Biaya |
|---|---|---|
| **CPU Worker saat Terbit** | ~10–25 ms untuk normalisasi teks, 64-MinHash, dan SHA-256 paragraf. | Sangat ringan, terjadi hanya sekali saat publikasi artikel. |
| **Pembacaan Publik (Traffic)** | **0 ms CPU & 0 D1 Reads.** Peramban pembaca tidak membaca tabel DNA. | Nol dampak terhadap biaya trafik pembaca biasa. |
| **Ukuran Baris D1 per Artikel**| ~3.5 KB – 5.5 KB per rekam DNA (termasuk JSON MinHash & paragraf). | Sangat hemat (1000 artikel hanya membutuhkan ~5 MB storage). |
| **Komputasi pHash Gambar** | ~30–50 ms per aset media (opsional/asinkron). | Dijalankan saat persiapan media LokaMedia di browser/worker. |

---

## 26. Audit Keamanan & Pencegahan Kebocoran Draf (Security Invariants)

1. **Isolasi Naskah Belum Terbit:**
   - Rekam DNA **HANYA** dimaterialisasikan untuk artikel yang telah melewati gerbang persetujuan Chief Editor dan berstatus resmi `published`.
   - Dilarang membuat rekaman DNA pada tabel publik untuk draf privat atau naskah yang masih dalam pengujian lab editorial Joko/Nadia.
2. **Perlindungan Rute Admin:**
   - Seluruh endpoint inspeksi forensik DNA ditempatkan di bawah jalur `/admin/*` yang dilindungi oleh autentikasi cookie PBKDF2 SHA-256 dan validasi CSRF Origin.

---

## 27. Rencana Tahapan Implementasi (Implementation Phases)

Implementasi teknis 1B direkomendasikan dalam 4 sub-fase terkontrol:

```
[ 1B-A: Core DNA Library & Schema Migration ]
  - Pustaka deterministik: normalization-v1, sha256 helpers, paragraph segmenter, minhash-64.
  - Skema migrasi D1 aditif: article_dna_signatures & media_asset_dna.
  - Unit tests komprehensif (100% test passing).
         │
         ▼
[ 1B-B: Publisher Service Integration ]
  - Kaitkan generator DNA ke executeAtomicPublication() di publisher-service.ts.
  - Terapkan semantik PUBLICATION_SUCCEEDS_DNA_PENDING (non-blocking).
  - Integrasikan pencatatan audit log & telemetri Dimas.
         │
         ▼
[ 1B-C: Historic Corpus Backfill (Articles 5–9) ]
  - Script backfill read-only yang menghasilkan rekaman DNA untuk Articles 5–9.
  - Klasifikasi jujur: Article 5, 7, 8, 9 (FULL) vs Article 6 (PARTIAL).
         │
         ▼
[ 1B-D: Admin Forensic Inspection Interface ]
  - Tampilan visual read-only di panel admin untuk melihat status DNA artikel.
  - Pemeriksaan integritas hash dan pelaporan status kemiripan.
```

---

## 28. Mitigasi Risiko & Strategi Rollback (Migration & Rollback)

1. **Sifat Migrasi Aditif:**
   - Tabel `article_dna_signatures` dan `media_asset_dna` adalah tabel baru yang sepenuhnya independen.
   - Tidak ada pengubahan kolom (*ALTER*) atau penghapusan (*DROP*) pada tabel operasional eksisting.
2. **Strategi Rollback:**
   - Jika terjadi kendala pada runtime DNA, flag generator dinonaktifkan (`ENABLE_PUBLICATION_DNA = false`).
   - Artikel publik tetap terbit dan disajikan normal tanpa dependensi ke tabel DNA.
   - Tabel D1 yang sudah terisi data DNA dapat dibiarkan aman tanpa merusak integritas website.

---

## 29. Pembagian Tanggung Jawab Staf (Staff Responsibilities)

Menyelaraskan operasional Publication DNA dengan struktur redaksi dan tim RancangLoka:

| Anggota Staf | Peran Operasional Publication DNA |
|---|---|
| **Dimas (System & Security)** | Bertanggung jawab atas integritas runtime generator DNA, pemantauan telemetri error, konsistensi skema D1, dan deteksi anomali. |
| **Sari (Publication Gatekeeper)** | Mengawasi eksekusi atomik penerbitan dan memverifikasi keterkaitan tanda terima publikasi dengan materialisasi DNA. |
| **Irwan (Research & Source Truth)** | Menganalisis bukti kemiripan tekstual dan membedakan sitasi ilmiah wajar dari indikasi kloning saat investigasi forensik. |
| **Rina (Editorial QA & Accuracy)** | Memverifikasi kebenaran laporan kemiripan dan mencegah kesalahan interpretasi (*false positive review*). |
| **Budi (Visual & Media Specialist)** | Mengelola provenansi aset media, pHash, dan kepatuhan terhadap aturan penghapusan EXIF sensitif. |
| **Nadia (Audience & Voice)** | Menjaga agar seluruh proses forensik tidak mencemari kemurnian suara pembaca dan memastikan skor detektor AI tetap *advisory only*. |
| **Chief Editor (Human Authority)** | Otoritas tunggal penentu keputusan eskalasi hukum/redaksi saat ditemukan konten terduga kloning (`PROBABLE_CONTENT_CLONE`). |
| **Jefry (Shadow AI)** | Berstatus strictly **SHADOW ADVISORY ONLY** (tanpa otoritas mutasi atau keputusan). |

---

## 30. Kesimpulan & Status Kesiapan (Readiness Verdict)

Rancangan arsitektur **CONTENT_PROTECTION-1B: PUBLICATION DNA** telah memenuhi seluruh prinsip keselamatan editorial RancangLoka, menolak ilusi DRM palsu, menegakkan invarian keaslian prosa, dan memanfaatkan infrastruktur tanda terima publikasi yang sudah terbukti di produksi.

**Klasifikasi Evaluasi:**  
# `CONTENT_PROTECTION_1B_PLAN_PASS`

Dokumen ini menjadi rujukan tunggal resmi untuk tahap implementasi teknis berikutnya.
