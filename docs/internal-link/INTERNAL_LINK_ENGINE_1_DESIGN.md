# 🧭 RancangLoka & Hermes — Internal Link Engine (INTERNAL-LINK-ENGINE-1)
## Baseline Audit & Architecture Design Specification

**Tanggal:** 2026-10-15  
**Milestone:** `INTERNAL-LINK-ENGINE-1`  
**Fase:** `V1_IMPLEMENTATION_COMPLETE`  
**Status Kontrak Desain:** `INTERNAL_LINK_ENGINE_1_IMPLEMENTATION_COMPLETE` (Zero code regression, zero production mutation, zero content hash disruption)

---

## 1. Prinsip Produk Kanonikal (Canonical Product Principle)

> **"Internal link RancangLoka harus melanjutkan perjalanan berpikir pembaca, bukan sekadar memindahkan PageRank."**

Dalam jurnalisme arsitektur dan panduan hunian RancangLoka, tautan internal (*internal links*) bukan instrumen manipulasi mesin pencari (*search engine optimization trickery*). Tautan internal hadir semata-mata karena artikel tujuan memberikan jawaban logis berikutnya atas pertanyaan nyata pemilik rumah yang sedang membaca.

Setiap tautan internal wajib lolos uji kebermanfaatan pembaca (*Reader Utility Test*):
* *"Apa yang didapatkan pembaca ketika mengklik tautan ini?"*
* Jika jawabannya semata-mata *"Menambah PageRank"* atau *"Mengejar target kuota SEO"*, maka kandidat tautan tersebut **wajib ditolak**.

Tautan internal memandu pembaca melalui 5 tahapan kognitif pengambilan keputusan arsitektural:
1. **Diagnosis Masalah (*Problem Discovery*):** Mengenali gejala kegagalan ruang (embun di kaca, hawa panas sore, tagihan AC membengkak).
2. **Pemahaman Fisika Bangunan (*Root Cause Understanding*):** Memahami mengapa hal tersebut terjadi (radiasi matahari baur BMKG, konduksi panas aluminium, jembatan termal).
3. **Komparasi Pilihan (*Options Exploration*):** Menimbang solusi arsitektural (tritisan vs louver vs awning vs fasad kedua).
4. **Kedalaman Keputusan (*Decision Depth*):** Menilai trade-off biaya, durabilitas, iklim tropis, dan standar teknis SNI/PUPR.
5. **Langkah Konkret Berikutnya (*Next Step Action*):** Mengetahui detail pemasangan, perawatan material, atau penataan ruang pendukung.

---

## 2. Hirarki Arsitektur Informasi (Target Information Architecture)

Struktur informasi RancangLoka dirancang berlapis secara hierarkis dan kontekstual:

```mermaid
graph TD
    Home["Beranda (Homepage)<br/>Kurasi Pilihan & Kajian Terkini"] --> CatHub["Category / Topic Hub<br/>(Arsitektur, Material, Kenyamanan)"]
    CatHub --> Pillar["Pillar Article<br/>(Hanya dengan Identitas Metadata Eksplisit)"]
    
    Pillar --> Supporting1["Supporting Article 1<br/>(Deep-dive Spesifik Komponen)"]
    Pillar --> Supporting2["Supporting Article 2<br/>(Deep-dive Spesifik Material)"]
    
    Supporting1 <-->|"Bidirectional Semantic Link"| Supporting2
    Supporting1 <-->|"Diagnostic Symptom Link"| RelatedProblem["Related Diagnostic Article<br/>(Pemecahan Gejala Masalah)"]
```

### Empat Famili Tautan:
1. **STRUCTURAL (Struktural):** Header global, footer, navigasi kategori, dan breadcrumbs berjenjang.
2. **HIERARCHICAL (Hierarkis):** Hub Topik $\leftrightarrow$ Artikel Pilar, dan Artikel Pilar $\leftrightarrow$ Artikel Pendukung (*Supporting Articles*).
3. **CONTEXTUAL (Kontekstual):** Tautan di dalam naskah yang merujuk pada konsep prasyarat, pembuktian ilmiah, atau terminologi material terkait.
4. **BIDIRECTIONAL (Dua Arah):** Hubungan timbal balik simetris seperti Masalah $\leftrightarrow$ Solusi, Gejala $\leftrightarrow$ Akar Penyebab, atau Pilihan Material $\leftrightarrow$ Mitigasi Kegagalan.

---

## 3. Tipe Hubungan Semantik Kanonikal (Canonical Semantic Relationship Types)

Sistem Internal Link Engine V1 mendukung 9 tipe hubungan semantik yang berpusat pada pembaca:

| Tipe Hubungan | Definisi & Nilai Tambah Pembaca | Contoh Kasus Nyata |
|---|---|---|
| `PARENT_PILLAR` | Artikel tujuan adalah panduan induk komprehensif yang memayungi domain arsitektural ini (Wajib memiliki metadata pilar eksplisit). | Naskah *Louver Aluminium* menunjuk ke *Panduan Sistem Shading Luar Fasad Tropis*. |
| `CHILD_SUPPORTING` | Artikel tujuan membedah secara teknis detail komponen, rumus kalkulasi, atau studi kasus turunan dari artikel pilar. | Naskah *Sistem Shading Luar* menunjuk ke *Detail Sambungan Dak Beton Tritisan*. |
| `RELATED_PROBLEM` | Artikel tujuan mendiagnosis gejala masalah hunian yang sering terjadi bersamaan atau menjadi akar persoalan. | Naskah *Kondensasi Jendela Kaca* menunjuk ke *Masalah Sirkulasi Ruang Pengap & Lembap*. |
| `RELATED_MATERIAL` | Artikel tujuan mengulas karakteristik fisik, durabilitas, atau trade-off material yang disebutkan dalam naskah. | Naskah *Sistem Shading* menunjuk ke *Spesifikasi Fisik & Ketahanan Kayu Ulin vs Aluminium*. |
| `RELATED_DECISION` | Artikel tujuan memandu pertimbangan keputusan alternatif atau komplementer. | Naskah *Peneduh Fasad Luar* menunjuk ke *Memilih Kaca Low-E vs Kaca Bening*. |
| `BACKGROUND_EXPLAINER` | Artikel tujuan menjelaskan dasar sains fisika bangunan, standar SNI, atau metode iklim BMKG yang melandasi artikel. | Naskah yang mengutip SNI 6389:2020 menunjuk ke *Memahami Batas OTTV 35 W/m² untuk Rumah Tinggal*. |
| `NEXT_STEP` | Artikel tujuan memandu langkah operasional setelah keputusan diambil (instalasi, tukang, perawatan berkala). | Naskah *Pemasangan Louver Fasad* menunjuk ke *Jadwal & Metode Perawatan Kisi-kisi Luar*. |
| `RELATED_SYSTEM` | Artikel tujuan menghubungkan sistem bukaan dengan sistem selubung bangunan lain (atap, ventilasi silang, dinding). | Naskah *Peneduh Jendela* menunjuk ke *Rekayasa Ventilasi Silang Plafon Tropis*. |
| `RELATED_FAILURE_MODE` | Artikel tujuan menjelaskan bagaimana material atau konfigurasi tersebut dapat gagal jika salah pasang/rawat. | Naskah *Pemasangan Louver* menunjuk ke *Penyebab Tempias Air Hujan pada Bukaan Fasad*. |

> **Aturan Kebijakan Invarian Pilar (`INVARIANT_EXPLICIT_PILLAR_IDENTITY`):**
> Relasi `PARENT_PILLAR` dan `CHILD_SUPPORTING` **hanya boleh digunakan** apabila identitas pilar pada artikel sumber/target tersimpan secara eksplisit dalam metadata kanonikal (misal `pillar_role = 'PILLAR'` atau flag pilar terverifikasi di basis data). Dilarang keras menyimpulkan status pilar semata-mata dari panjang judul, jumlah kata naskah, cakupan topik umum, kategori, atau skor semantik.
> Tipe relasi generik seperti `RELATED_CONTEXT` **ditolak dan dilarang**. Setiap relasi wajib memiliki intensi pembaca yang tajam.

---

## 4. Audit Baseline: Kondisi Nyata RancangLoka Saat Ini

Audit menyeluruh terhadap basis kode aktif (`rancangloka-astro/`) mengungkap fakta implementasi berikut:

```
+------------------------------------+--------------------------+-------------------------------------------------------+
| Komponen Arsitektur                | Status Saat Ini          | Temuan Audit Struktur Tautan                          |
+------------------------------------+--------------------------+-------------------------------------------------------+
| Article Renderer ([slug].astro)    | IMPLEMENTED (MECHANICAL) | Memproses HTML via regex keyword & kategori recency.  |
| Database Schema (db/schema.sql)    | ABSENT                   | Tabel relasi link / graph belum ada di basis data.   |
| Taxonomy / Tags                    | ABSENT                   | Tidak ada tabel tags; hanya 8 kategori flat.          |
| Breadcrumbs                        | PARTIAL                  | Flat 2-tingkat (Home > Kategori > Judul Artikel).      |
| In-Article "BACA JUGA" Box         | IMPLEMENTED (NAIVE)      | Mengambil artikel terbaru dari kategori yang sama.    |
| Auto-Keyword Linker (seo.ts)       | IMPLEMENTED (MECHANICAL) | Regex string match focus_keyword (max 2 link/artikel).|
| Related Articles Footer Grid       | PARTIAL (NAIVE)          | Grid 3 kartu terikat strictly pada category_id yang sama|
| Problem Solver (/solusi)           | PARTIAL (DECOUPLED)      | Masalah & solusi terisolasi; link ke /search?q=...     |
| Comparison Engine (/komparasi)     | MANUAL (ISOLATED)        | Matriks statis tanpa link ke artikel naskah terkait.  |
| Design Explorer (/explore)         | PARTIAL (CLIENT-JS)      | Filter material client-side JS; decoupled dari graph. |
| Pillar / Supporting Relationship   | ABSENT                   | Tidak ada konsep pilar dalam model data.              |
| Orphan Detection                   | ABSENT                   | Tidak ada deteksi artikel yang terisolasi.            |
| Bidirectional Link Discovery       | ABSENT                   | Tidak ada rekomendasi backlink saat artikel baru terbit|
| Content Hash Protection            | WIRED & ENFORCED         | Hash naskah (SHA-256) diproteksi gerbang Chief Editor. |
+------------------------------------+--------------------------+-------------------------------------------------------+
```

### Masalah Kritis Sistem Saat Ini:
1. **Silo Kategori Kaku:** Karena `RelatedArticles` dan box `"BACA JUGA"` mengandalkan `WHERE category_id = ?`, dua artikel yang saling melengkapi tetapi berbeda kategori sama sekali tidak akan pernah saling merekomendasikan.
2. **Auto-Keyword Naif & Buta Konteks:** `injectAutoKeywordLinks` di `src/lib/seo.ts` mencocokkan string `focus_keyword` secara mekanis melalui regex saat render runtime. Ini mengabaikan intensi pembaca dan berisiko menautkan teks ke artikel yang tidak relevan secara kontekstual.
3. **Decoupling Hub Interaktif:** Halaman `/solusi` dan `/komparasi` bekerja sebagai pulau terisolasi. Rekomendasi solusi di `/solusi` hanya mengarahkan pembaca ke query pencarian acak (`/search?q=secondary+skin`), bukan ke panduan terkurasi mendalam.

---

## 5. Audit Sampel Konten Produksi: Artikel A, B, dan C

Audit struktur tautan terhadap tiga artikel live di ekosistem RancangLoka:

* **Artikel A (ID 7):** *Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?* (Kategori: `Kenyamanan Rumah` / ID 6)
* **Artikel B (ID 8):** *Thermal Bridge Kusen Aluminium: Mengapa Permukaan Kusen Terasa Sangat Panas atau Dingin?* (Kategori: `Material & Finishing` / ID 5)
* **Artikel C (ID 9):** *Memilih Sistem Shading Luar untuk Rumah Tropis: Overhang, Louver, Awning, atau Secondary Facade?* (Kategori: `Arsitektur & Renovasi` / ID 3)

### Fakta Keterkaitan Semantik Struktur Konten:
Ketiga artikel ini secara sains fisika bangunan merupakan satu klaster pengetahuan yang saling melengkapi:
* **Artikel C** adalah **Solusi Makro Fasad** (mencegah radiasi matahari menyentuh bukaan kaca luar).
* **Artikel B** adalah **Detail Konduksi Material** (bagaimana kusen aluminium tetap mengalirkan panas/dingin secara konduksi meski dinaungi, serta peran thermal break).
* **Artikel A** adalah **Diagnosis Masalah Ruang & Fisika Embun** (gejala kondensasi yang timbul akibat pertemuan udara lembap tropis dengan permukaan dingin pada kaca dan kusen aluminium tanpa thermal break).

### Realitas Tautan Saat Ini:
* **Tautan Masuk Antar-Artikel (*Inbound Article Links*):** **0** (Nol).
* **Tautan Keluar di Naskah (*Outbound Prose Links*):** **0** (Nol).
* **Visibilitas di Kotak Rekomendasi:** **0%** (Karena ketiganya berada di kategori yang berbeda—ID 3, ID 5, dan ID 6—sistem `getRelatedArticles` dan `"BACA JUGA"` tidak akan pernah menampilkan salah satu di antara mereka pada artikel lainnya).
* **Status Isolasi:** **TERISOLASI PENUH (*Functionally Orphaned Cluster*)**. Pembaca yang membaca Artikel C tidak memiliki rute navigasi terkurasi untuk mendalami jembatan termal kusen di Artikel B atau masalah kondensasi di Artikel A.
* **Status Metadata Pilar:** Tidak ada satupun dari Artikel A, B, atau C yang saat ini ditandai sebagai artikel pilar dalam basis data. Oleh karena itu, hubungan antar ketiganya dalam graf sampel wajib menggunakan relasi horizontal yang didukung.

---

## 6. Invarian Integritas Content-Hash & Arsitektur Dua-Bidang (Two-Plane Architecture)

### Invarian Keselamatan Mutlak:
> **Setiap artikel yang telah diterbitkan (PUBLISHED) memiliki tanda tangan `content_hash` (SHA-256) resmi yang disetujui Chief Editor. Sistem Internal Link Engine DILARANG KERAS memutasi atau menulis ulang naskah Markdown/HTML artikel terbit di balik layar.**

Untuk menjamin kepatuhan mutlak terhadap invarian ini, RancangLoka menetapkan **Arsitektur Dua-Bidang (*Two-Plane Architecture*)**:

```
+-------------------------------------------------------------------------------------------------------+
| PLANE A: SAFE DYNAMIC LINKING (BIDANG DINAMIS AMAN)                                                   |
| - Lokasi: Luar naskah berbayang hash (Header, Breadcrumbs, Modul Pendukung, Footer, Hubs).             |
| - Mekanisme: Dirender deterministik pada sisi server (SSR) dari graph relasi di basis data.           |
| - Status Naskah: ZERO MUTATION (Hash SHA-256 artikel terbit tetap 100% identik abadi).                 |
| - Komponen: Breadcrumb 3-Level, Modul "Artikel Pendukung Keputusan", Kartu "Langkah Berikutnya".      |
+-------------------------------------------------------------------------------------------------------+
| PLANE B: EDITORIAL INLINE LINKING (BIDANG TAUTAN DALAM NASKAH)                                         |
| - Lokasi: Di dalam kalimat/paragraf naskah artikel (Markdown inline anchor).                          |
| - Naskah Draf Baru: Dianalisis & direkomendasikan saat fase Joko, diuji oleh Nadia & Rina.            |
| - Naskah Terbit: Engine HANYA menghasilkan rekomendasi revisi (LINK_REVISION_RECOMMENDED).            |
| - Larangan: Dilarang menyuntikkan link otomatis ke naskah terbit tanpa alur revisi Chief Editor.      |
+-------------------------------------------------------------------------------------------------------+
```

---

## 7. Kualitas Tautan Kontekstual & Kebijakan Teks Jangkar (Anchor Text Policy)

### Prinsip Bebas Kuota Mekanis (`NO_MECHANICAL_INTERNAL_LINK_QUOTA`):
Kepadatan tautan internal **tidak diatur oleh hitungan kata mekanis** (misal: dilarang memberlakukan aturan *"maksimal 1 link per 350 kata"* atau target kuota N link per artikel). Kehadiran tautan kontekstual murni ditentukan oleh kebutuhan pembaca (*Semantic Journey Need*).

### Kriteria Penilaian Semantik (*Semantic Scoring Signals*):
Engine tidak menggunakan pencocokan kata kunci mentah (*raw keyword matching*). Kandidat tautan dinilai berdasarkan:
1. **Relevansi Intensi (*Reader Intent Alignment*):** Apakah artikel tujuan menjawab keraguan logis pembaca pada paragraf tersebut?
2. **Kedekatan Domain Masalah (*Shared Problem Domain*):** Apakah keduanya berbagi konteks kegagalan atau solusi fisika bangunan yang sama?
3. **Ketergantungan Prasyarat (*Conceptual Prerequisite*):** Apakah pemahaman artikel A diperlukan sebelum mempraktikkan artikel B?
4. **Kesesuaian Konteik Iklim (*Tropical Context Proximity*):** Keselarasan konteks iklim tropis lembap Indonesia.

### Larangan Keras (*Strict Anti-Pattern Bans*):
* ❌ **Repeated Destination Spam:** Dilarang menautkan artikel tujuan yang sama berulang kali dalam satu halaman.
* ❌ **Redundant Question Answering:** Dilarang menyertakan beberapa tautan yang menjawab pertanyaan kognitif yang sama dalam satu bagian.
* ❌ **Dense Anchor Clustering:** Dilarang menumpuk gugusan tautan padat dalam satu paragraf tunggal.
* ❌ **SEO Count Link Filling:** Dilarang menyisipkan tautan semata-mata demi memenuhi target kuota algoritma mesin pencari.
* ❌ **Anchor Generik AI/SEO:** Dilarang menggunakan anchor *"klik di sini"*, *"baca di sini"*, *"artikel ini"*, atau *"tautan berikut"*.
* ❌ **Tautan Sirkular / Diri Sendiri:** Dilarang menautkan artikel ke dirinya sendiri atau membuat loop rekursif tanpa akhir.

### Standar Teks Jangkar Alami (*Natural Indonesian Anchors*):
Anchor harus merupakan frasa deskriptif bahasa Indonesia yang mengalir luwes dalam kalimat yang sudah ada:
* ✅ *"terjadinya fenomena thermal bridge pada kusen aluminium"* $\to$ mengarah ke ulasan jembatan termal.
* ✅ *"memilih peneduh luar yang sesuai untuk orientasi barat"* $\to$ mengarah ke komparasi peneduh fasad.
* ✅ *"penyebab embun kondensasi pada permukaan kaca"* $\to$ mengarah ke diagnosis kondensasi jendela.

---

## 8. Desain Modul Publik: "Artikel Pendukung untuk Keputusan Ini"

Modul publik Plane A ini diletakkan tepat di bawah naskah penutup komparasi/artikel, sebelum footer komentar/author.

### Format & Konsep Presentasi:
Modul tidak menampilkan daftar kartu acak, melainkan menyajikan **Alasan Pembaca (*Reader Reason*)** yang mengaitkan kondisi rumah pembaca dengan artikel tujuan:

```
+----------------------------------------------------------------------------------------------------+
| 🧭 PANDUAN PENDUKUNG KEPUTUSAN RUANG                                                               |
| Teruskan pertimbangan desain Anda berdasarkan kondisi nyata rumah:                                |
|                                                                                                    |
| [KUSEN & KONDUKSI PANAS]                                                                           |
| "Jika panas sore tetap terasa menyengat dari rangka jendela meski sudah dipasangi louver:"         |
| ➔ Thermal Bridge Kusen Aluminium: Mengapa Permukaan Kusen Terasa Sangat Panas atau Dingin?        |
|    Hubungan: Spesifikasi Material & Konduksi • 5 mnt baca                                          |
|                                                                                                    |
| [DIAGNOSIS EMBUN & UDARA LEMBAP]                                                                  |
| "Jika di pagi hari kaca kamar Anda justru berembun tebal saat pendingin udara dinyalakan:"         |
| ➔ Jendela Berkondensasi: Kelembapan Ruangan, Suhu Kaca, Ventilasi, atau Thermal Bridge?            |
|    Hubungan: Diagnosis Gejala Masalah • 6 mnt baca                                                 |
+----------------------------------------------------------------------------------------------------+
```

### Karakteristik Teknis Modul:
* **Zero Client-Side JavaScript:** Murni render server-side HTML/CSS. Ringan, cepat, dan 100% crawlable.
* **Tipografi Bersahaja:** Mengikuti standar Apple Minimalist & Warm Editorial RancangLoka tanpa carousel berkedip atau banner mencolok.

---

## 9. Model Hubungan Pilar ↔ Artikel Pendukung (Pillar / Supporting Model)

### Representasi Metadata Eksplisit:
Relasi hierarkis pilar tunduk pada `INVARIANT_EXPLICIT_PILLAR_IDENTITY`:
* `pillar_role`: `PILLAR` (Artikel Induk), `SUPPORTING` (Artikel Pendukung), atau `STANDALONE` (Artikel Mandiri).
* `parent_pillar_id`: ID artikel induk (berlaku untuk artikel pendukung yang terdaftar).

### Alur Graf Dua-Arah (*Bidirectional Navigation*):
1. **Pillar $\to$ Supporting:** Halaman Pilar menampilkan indeks kurasi topik terstruktur (*Topic Navigation Block*) yang merinci seluruh sub-bab teknis pendukungnya.
2. **Supporting $\to$ Pillar:** Halaman Pendukung menampilkan tautan induk kontekstual di bagian atas (melalui Breadcrumbs 3-level: `Beranda > Kategori > Artikel Pilar > Artikel Ini`) serta banner konteks pilar di akhir naskah.

---

## 10. Deteksi Artikel Terisolasi (Orphan Detection) & Penemuan Balik Dua-Arah

### Definisi Artikel Terisolasi (*Orphan Article*):
Sebuah artikel berstatus `PUBLISHED` diklasifikasikan sebagai **ORPHAN** apabila:
1. Memiliki **0 tautan masuk semantik** (*zero inbound semantic links*) dari artikel lain di Plane A maupun Plane B.
2. Tidak terikat sebagai *Supporting Article* pada artikel pilar mana pun (`parent_pillar_id IS NULL`).
3. Tidak terdaftar dalam modul diagnosis `/solusi` maupun komparasi `/komparasi`.

### Alur Penemuan Balik Dua-Arah (*Bidirectional Discovery Engine*):
Ketika artikel baru hendak diterbitkan:
1. **Forward Discovery:** Engine memindai korpus artikel yang sudah terbit untuk merekomendasikan tautan keluar dari artikel baru ke artikel lama.
2. **Backlink Discovery:** Engine mencari artikel-artikel lama yang relevan dan semestinya merujuk ke artikel baru ini.
   - Untuk artikel lama, engine **TIDAK** memodifikasi naskah lama secara otomatis.
   - Engine mendaftarkan relasi ke **Plane A Dynamic Graph** (sehingga artikel baru langsung muncul di modul *"Artikel Pendukung"* artikel lama).
   - Engine mengirimkan kartu rekomendasi revisi inline ke Mission Control bagi Chief Editor untuk ditinjau saat jadwal pembaruan naskah berkala.

---

## 11. Alur Kerja Redaksional & Pembagian Peran Staf (Staff Ownership)

Integrasi Internal Link Engine ke dalam alur redaksi kanonikal tidak menambah persona baru, melainkan memberdayakan staf yang ada secara presisi:

```mermaid
graph LR
    Irwan["Irwan<br/>(Bukti & Sumber)"] --> Joko["Joko<br/>(Draf Naskah)"]
    Joko --> Dimas["Dimas<br/>(Analisis Graf & Relevansi)"]
    Dimas --> Nadia["Nadia<br/>(Evaluasi Suara Pembaca)"]
    Nadia --> Rina["Rina<br/>(Validasi Kebenaran Klaim)"]
    Rina --> Chief["Chief Editor<br/>(Persetujuan Manusia)"]
    Chief --> Sari["Sari<br/>(Publikasi Kanonikal)"]
```

| Staf | Peran dalam Internal Link Engine | Tanggung Jawab Operasional |
|---|---|---|
| **Dimas** | *Semantic Graph & Health Analyst* | Menghitung relasi semantik, mendeteksi orphan articles, menganalisis kedalaman perjalanan keputusan, dan menghitung skor relevansi kandidat tautan. |
| **Joko** | *Natural Prose Insertion* | Memasukkan rekomendasi tautan ke dalam kalimat draf secara alami tanpa memaksakan kata kunci asing. |
| **Nadia** | *Reader Flow & Anchor Auditor* | Menguji apakah teks jangkar terdengar alami, tidak membingungkan pembaca, dan benar-benar membantu kelancaran membaca (*Reading Flow Integrity*). |
| **Rina** | *Truth & Context Validator* | Memverifikasi bahwa artikel tujuan benar-benar membuktikan atau melengkapi klaim yang dibuat, mencegah misleading context link. |
| **Jefry** | *Shadow Strategic Topology Watch* | Memantau kepadatan graf, mencegah over-linking, dan memberikan observasi bayangan non-blocking (*zero authority*). |
| **Chief Editor** | *Human Gatekeeper* | Otoritas tunggal yang menyetujui penambahan tautan inline pada artikel terbit atau menyetujui graf relasi pilar. |
| **Sari** | *Publication Operator* | Menerbitkan naskah akhir dan memperbarui indeks sitemap. |

---

## 12. Skema Basis Data Relasi Graf (Proposed Minimalist D1 Schema)

### Kontrak Unik Dua-Bidang (*Two-Plane Uniqueness Contract*):
Relasi semantik yang sama dapat secara sah hadir tepat satu kali pada bidang dinamis luar naskah (`PLANE_A_DYNAMIC`), dan secara terpisah satu kali pada teks inline naskah (`PLANE_B_INLINE`). Penempatan duplikat dalam bidang yang **sama** dicegah oleh indeks unik komposit:

```sql
-- Tabel Kanonikal Graf Tautan Internal RancangLoka
CREATE TABLE IF NOT EXISTS article_internal_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  target_article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK(relationship_type IN (
    'PARENT_PILLAR',
    'CHILD_SUPPORTING',
    'RELATED_PROBLEM',
    'RELATED_MATERIAL',
    'RELATED_DECISION',
    'BACKGROUND_EXPLAINER',
    'NEXT_STEP',
    'RELATED_SYSTEM',
    'RELATED_FAILURE_MODE'
  )),
  reader_reason TEXT NOT NULL,
  placement_plane TEXT NOT NULL CHECK(placement_plane IN ('PLANE_A_DYNAMIC', 'PLANE_B_INLINE')),
  anchor_text TEXT,
  confidence_score REAL DEFAULT 1.0,
  status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('CANDIDATE', 'APPROVED', 'ACTIVE', 'REJECTED', 'STALE')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  reviewed_by TEXT,
  UNIQUE(source_article_id, target_article_id, relationship_type, placement_plane)
);

CREATE INDEX IF NOT EXISTS idx_internal_links_source ON article_internal_links(source_article_id, status);
CREATE INDEX IF NOT EXISTS idx_internal_links_target ON article_internal_links(target_article_id, status);
```

### Pemeriksaan Koherensi Kontrak Skema V1 (`V1_SCHEMA_CONTRACT_COHERENT`):
1. **Koherensi Dua-Bidang:** Penambahan `placement_plane` pada batasan `UNIQUE` memungkinkan Plane A dan Plane B hidup berdampingan tanpa saling menolak atau memicu tabel terpisah yang berlebihan.
2. **Integritas Hash Konten:** Plane A membaca relasi aktif murni sebagai data pendukung tampilan SSR tanpa menyentuh kolom `articles.content_md` maupun `articles.content_hash`.
3. **Siklus Hidup Status (`status`):** Mendukung transisi `CANDIDATE` $\to$ `APPROVED` $\to$ `ACTIVE`, serta penolakan `REJECTED` atau invalidasi `STALE`.
4. **Penanganan Status Terbit Target:** Kueri runtime Plane A menyaring `WHERE target.status = 'published'`. Jika artikel tujuan ditarik dari peredaran, tautan otomatis hilang seketika (*fail-safe zero 404*).
5. **Kekebalan Perubahan Slug:** Relasi mengikat `target_article_id` (foreign key numerik permanen). Perubahan slug pada tabel `articles` langsung tercermin tanpa memutus relasi graf.
6. **Dukungan Deteksi Orphan:** Deteksi dilakukan melalui kueri agregasi sederhana `LEFT JOIN article_internal_links ON articles.id = target_article_id` yang terindeks cepat.

---

## 13. Visibilitas Mission Control (Operator UX)

Sesuai filosofi operasional RancangLoka: *"RancangLoka harus membawa keputusan yang memerlukan tindakan ke meja administrator; administrator tidak boleh dipaksa mencari-cari ke pelosok dashboard."*

Mission Control menambahkan kartu tindakan terkurasi pada antarmuka operator:
1. **Kartu `ORPHAN_DETECTED`:** Memberitahu redaksi jika ada artikel baru yang belum memiliki jalur navigasi masuk yang memadai.
2. **Kartu `BACKLINK_RECOMMENDED`:** Memberikan rekomendasi spesifik: *"Artikel C sangat cocok dirujuk oleh Artikel B pada bagian solusi radiasi fasad. Setujui untuk dimasukkan ke modul pendukung?"*
3. **Metrik Kesehatan Graf Internal:**
   * Jumlah Artikel Terisolasi (*Orphan Count*)
   * Cakupan Perjalanan Keputusan (*Decision Journey Coverage %*)
   * Rata-rata Tautan Masuk Bernilai Pembaca (*Meaningful Inbound Ratio*)
   * **Bebas Kuota Arbitrer:** Dilarang membuat target mekanis seperti *"setiap artikel wajib memiliki 5 tautan"*.

---

## 14. Graf Contoh Nyata untuk Klaster Artikel A, B, dan C (Revisi Relasi Horizontal)

Berdasarkan analisis struktur naskah aktual—dan mengingat **Artikel C belum ditetapkan sebagai pilar dalam metadata kanonikal**—seluruh tepi graf disusun menggunakan relasi horizontal yang sepenuhnya didukung:

```
                                  [ ARTIKEL C ]
             "Memilih Sistem Shading Luar untuk Rumah Tropis:
           Overhang, Louver, Awning, atau Secondary Facade?"
                           (Solusi Fasad Makro)
                                ▲            │
         RELATED_SYSTEM /       │            │  RELATED_MATERIAL /
         RELATED_DECISION       │            │  BACKGROUND_EXPLAINER
                                │            ▼
[ ARTIKEL A ] ◄──────────────────────── [ ARTIKEL B ]
"Jendela Berkondensasi:             "Thermal Bridge Kusen Aluminium:
 Kelembapan Ruangan, Suhu Kaca,      Mengapa Permukaan Kusen Terasa
 Ventilasi, atau Thermal Bridge?"     Sangat Panas atau Dingin?"
 (Diagnosis Masalah Embun Ruang)     (Detail Konduksi Panas Kusen)
               RELATED_FAILURE_MODE / RELATED_PROBLEM
```

### Rincian Tepi Graf (*Graph Edge Specifications*):

1. **Edge 1: Dari Artikel C $\to$ Artikel B**
   * **Sumber:** Artikel C (`memilih-sistem-shading-luar-rumah-tropis`, ID 9)
   * **Target:** Artikel B (`thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi`, ID 8)
   * **Tipe Relasi:** `RELATED_MATERIAL` / `BACKGROUND_EXPLAINER`
   * **Rekomendasi Penempatan:** `PLANE_A_DYNAMIC` (Modul Pendukung) & opsional `PLANE_B_INLINE` pada pembahasan louver aluminium.
   * **Alasan Pembaca (*Reader Reason*):** *"Jika Anda memilih sirip louver atau kusen berbahan aluminium, pahami bagaimana material logam menghantarkan panas secara konduksi ke dalam ruangan."*
   * **Anchor Alami (Plane B jika disetujui):** *"konduktivitas termal pada profil aluminium"*

2. **Edge 2: Dari Artikel B $\to$ Artikel C**
   * **Sumber:** Artikel B (`thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi`, ID 8)
   * **Target:** Artikel C (`memilih-sistem-shading-luar-rumah-tropis`, ID 9)
   * **Tipe Relasi:** `RELATED_DECISION` / `RELATED_SYSTEM`
   * **Rekomendasi Penempatan:** `PLANE_A_DYNAMIC` (Modul Pendukung) & opsional `PLANE_B_INLINE` pada sub-bab peredam panas pasif.
   * **Alasan Pembaca (*Reader Reason*):** *"Sebelum mengganti kusen atau membongkar jendela, pertimbangkan menaungi bukaan kaca dari luar menggunakan sistem peneduh fasad tropis."*
   * **Anchor Alami (Plane B jika disetujui):** *"memasang sistem peneduh luar pada jendela"*

3. **Edge 3: Dari Artikel B $\to$ Artikel A**
   * **Sumber:** Artikel B (`thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi`, ID 8)
   * **Target:** Artikel A (`jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge`, ID 7)
   * **Tipe Relasi:** `RELATED_PROBLEM` / `RELATED_FAILURE_MODE`
   * **Rekomendasi Penempatan:** `PLANE_A_DYNAMIC` (Modul Pendukung)
   * **Alasan Pembaca (*Reader Reason*):** *"Kusen aluminium yang dingin di malam hari akibat AC sering kali memicu tetesan air embun pada sambungan kaca dan dinding."*
   * **Anchor Alami (Plane B jika disetujui):** *"risiko pengembunan pada kaca dan kusen jendela"*

4. **Edge 4: Dari Artikel A $\to$ Artikel B**
   * **Sumber:** Artikel A (`jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge`, ID 7)
   * **Target:** Artikel B (`thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi`, ID 8)
   * **Tipe Relasi:** `BACKGROUND_EXPLAINER` / `RELATED_MATERIAL`
   * **Rekomendasi Penempatan:** `PLANE_A_DYNAMIC` (Modul Pendukung) & opsional `PLANE_B_INLINE` pada pembahasan akar jembatan termal.
   * **Alasan Pembaca (*Reader Reason*):** *"Pelajari mekanisme jembatan termal pada rangka jendela yang menyebabkan perbedaan suhu ekstrem pemicu embun."*
   * **Anchor Alami (Plane B jika disetujui):** *"terjadinya jembatan termal pada kusen jendela"*

5. **Edge 5: Dari Artikel A $\to$ Artikel C**
   * **Sumber:** Artikel A (`jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge`, ID 7)
   * **Target:** Artikel C (`memilih-sistem-shading-luar-rumah-tropis`, ID 9)
   * **Tipe Relasi:** `RELATED_SYSTEM` / `RELATED_DECISION`
   * **Rekomendasi Penempatan:** `PLANE_A_DYNAMIC` (Modul Pendukung)
   * **Alasan Pembaca (*Reader Reason*):** *"Ketahui bagaimana naungan atap dan kisi luar membantu menjaga suhu permukaan kaca tetap stabil dari sengatan cuaca luar."*
   * **Anchor Alami (Plane B jika disetujui):** *"perlindungan naungan atap dan peneduh luar"*

---

## 15. Sasaran Performa & Penerimaan Teknis (Performance Targets & Acceptance Goals)

Seluruh metrik performa dalam fase desain ini merupakan **target performa / sasaran akseptasi (*acceptance goals*)**, bukan klaim pengukuran runtime (pengukuran empiris wajib dilakukan pada fase pengujian akseptasi implementasi):

* **Target Kueri Relasi Edge:** Kueri D1 untuk Plane A (`article_internal_links`) dirancang seringan mungkin melalui indeks komposit (`idx_internal_links_source`), dengan target lookup yang optimal pada Cloudflare Workers edge.
* **Arsitektur Zero Client-Side JS:** Seluruh tautan Plane A dan Plane B dirender sebagai tag HTML native `<a href="...">` murni pada SSR, tanpa membutuhkan runtime client-side JavaScript.
* **Sasaran Integritas Lighthouse:** Penambahan modul pendukung ditargetkan tidak menimbulkan regresi material pada skor performa Google Lighthouse dan Core Web Vitals (LCP, CLS, INP) yang saat ini sudah berada di kisaran 90–100.
* **Protokol Verifikasi:** Benchmark latensi kueri D1 dan uji render HTML akan diukur secara empiris dengan skrip pengujian otomatis saat implementasi mesin dijalankan.

---

## 16. Batasan Ruang Lingkup V1 vs Fase Masa Depan

### Termasuk dalam V1 (`INTERNAL-LINK-ENGINE-1`):
* [x] Audit komprehensif basis kode dan struktur tautan klaster konten nyata.
* [x] Penetapan prinsip kanonikal *"melanjutkan perjalanan berpikir pembaca"*.
* [x] Spesifikasi taksonomi 9 relasi semantik berpusat pada pembaca.
* [x] Arsitektur Dua-Bidang (Plane A Dinamis Aman vs Plane B Editorial Inline).
* [x] Desain modul publik *"Artikel Pendukung untuk Keputusan Ini"* (Zero-JS).
* [x] Skema basis data relasi graf minimalis (`article_internal_links`) dengan kontrak unik empat-kunci.
* [x] Algoritma deteksi orphan articles & penemuan balik dua-arah (*bidirectional discovery*).
* [x] Pemetaan peran staf redaksi kanonikal (Dimas, Joko, Nadia, Rina, Chief Editor, Sari).
* [x] Proteksi integritas naskah terbit (Zero mutation on published content hash).

### Ditunda ke Fase Berikutnya (*Explicitly Deferred Scope*):
* ⏸️ **Automated LLM Vector Embeddings:** Penilaian semantik V1 mengandalkan pemetaan relasi terstruktur dan aturan domain fisika bangunan, bukan pencarian vektor berbiaya tinggi per request.
* ⏸️ **Modifikasi Tampilan Beranda & Kategori:** Halaman beranda dan kategori tidak diubah dalam tahap desain ini.
* ⏸️ **Perombakan Problem Solver (/solusi):** Integrasi tautan graf ke dalam `/solusi` dan `/komparasi` akan dikerjakan pada implementasi runtime berikutnya.

---

## 17. Kesimpulan & Rekomendasi Arsitektur

Kontrak desain arsitektur **INTERNAL-LINK-ENGINE-1** telah disempurnakan dan diverifikasi koheren secara menyeluruh. Sistem ini mengeliminasi jebakan SEO mekanis kuno, menghormati `INVARIANT_NO_UNVERIFIED_FIRST_HAND_AUTHORITY`, menegakkan invarian identitas pilar eksplisit, mengunci kontrak unik dua-bidang, dan sepenuhnya menjaga integritas kriptografis artikel yang telah diterbitkan.

---

## 18. Laporan Implementasi V1 (V1 Implementation Record)

### Komponen Terimplementasi:
1. **Migrasi Basis Data:** `db/migrations/0033_internal_link_engine.sql`
   - Tabel `article_internal_links` dengan 9 relasi kanonikal, kontrak unik empat-kunci `(source_article_id, target_article_id, relationship_type, placement_plane)`, dan pengikatan `source_content_hash`.
   - Kolom metadata pilar eksplisit pada `articles` (`pillar_role` dan `parent_pillar_id`).
2. **Modul Layanan Tautan Semantik:** `src/lib/internal-link/` (`types.ts`, `service.ts`, `index.ts`)
   - Validasi ketat invarian pilar (`INVARIANT_EXPLICIT_PILLAR_IDENTITY`).
   - Penolakan tautan diri sendiri (*self-link*).
   - Pengikatan hash sumber pada aktivasi Plane B dan rekonsiliasi otomatis status `STALE` saat naskah berubah.
   - Kueri Plane A dinamis dengan eliminasi target unreleased, resolusi slug runtime, dan deduplikasi tujuan.
   - Deteksi orphan terstruktur dan penemuan kandidat dua-arah deterministik (*forward & backlink*).
   - Penderivasian status tindakan Mission Control (`LINK_REVIEW_REQUIRED`, `ORPHAN_DETECTED`, `BACKLINK_RECOMMENDED`, `LINK_REVISION_RECOMMENDED`).
3. **Komponen Publik SSR Zero-JS:** `src/components/ArticleSupportModule.astro`
   - Judul resmi: *"Artikel Pendukung untuk Keputusan Ini"*.
   - Menyajikan `reader_reason` kontekstual dan tautan crawlable `<a href>`.
   - Render nihil (*zero box*) jika tidak ada relasi aktif.
4. **Pencegahan Mutasi Naskah Diam-diam:**
   - `processArticleContent` di `src/lib/seo.ts` menonaktifkan injeksi regex keyword mekanis secara default.
   - Stored markdown/HTML dan `content_hash` artikel terbit (termasuk Artikel A, B, C) 100% terlindungi.
5. **Hasil Pengujian & Benchmark Empiris Awal:**
   - 20/20 tes di `scripts/test-internal-link-engine.js` lulus.

---

## 19. Laporan Hardening Pra-Produksi & Audit E2E (Pre-Production Hardening & E2E Acceptance Audit)

**Tanggal:** 2026-10-15  
**Klasifikasi:** `INTERNAL_LINK_ENGINE_1_PREPROD_HARDENED`

### 1. Invarian Hubungan Utama Basis Data (`ONE_PRIMARY_RELATIONSHIP_PER_PLACEMENT`)
- **Koreksi Skema:** Kontrak skema `db/migrations/0033_internal_link_engine.sql` dan `db/schema.sql` diperbaiki dari empat-kunci menjadi tiga-kunci:
  ```sql
  UNIQUE(source_article_id, target_article_id, placement_plane)
  ```
- **Rasional:** Untuk pasangan `(source, target, placement_plane)` hanya boleh ada tepat SATU hubungan semantik primer. Atribut `relationship_type` mencatat hubungan primer tersebut. Alasan/argumen semantik sekunder dicatat di dalam kolom `reader_reason`, bukan dengan menduplikasi baris relasi/kartu.

### 2. Penemuan Semantik Generik Tanpa Overfit (`GENERIC_DISCOVERY_NOT_ARTICLE_SPECIFIC`)
- **Audit Kemandirian Topik:** `discoverBidirectionalCandidates` dibersihkan dari seluruh keterikatan hardcoded terhadap Artikel A, B, atau C (tidak ada ID, slug, atau judul naskah spesifik yang di-hardcode).
- **Taksonomi Arsitektural Bersifat Komposabel:** Menggunakan domain taxonomy arsitektur generik (`ARCHITECTURAL_TAXONOMY`) dan pemetaan subsistem (`ARCHITECTURAL_SUBSYSTEMS`: `envelope`, `roofing`, `air_and_moisture`, `thermal_acoustics`) yang otomatis memetakan relasi `RELATED_PROBLEM`, `RELATED_MATERIAL`, `RELATED_SYSTEM`, dan `RELATED_FAILURE_MODE` untuk topik-topik masa depan yang belum pernah ada sebelumnya (*unseen future topics* seperti ventilasi pasif / rumah pengap, waterproofing atap bocor, acoustic glazing kebisingan jalan, dsb.).
- **Pengujian Topik Baru:** Diverifikasi pada 4 artikel sintetik baru tanpa ada aturan khusus di kode layanan.

### 3. Integrasi Nyata E2E Mission Control (`MISSION_CONTROL_ACTIONABLE_LINK_STATES`)
- **Penyambungan Runtime Otoritatif:** Fungsi `deriveInternalLinkActionableStates` disambungkan secara nyata ke dalam:
  - `src/lib/mission-control/types.ts`: `ArticleOperationsSummary.internalLinks` merekam `{ actionableCount: number, actions: InternalLinkActionableState[] }`.
  - `src/lib/mission-control/summaries.ts`: Mengagregasikan status tautan aktif per artikel untuk ringkasan operasional Chief Editor.
  - `src/lib/mission-control/tasks.ts`: Menyuntikkan kartu tugas terstruktur ke dalam antrean review Chief Editor (`stage: 'ready_for_review'`) saat terdeteksi `ORPHAN_DETECTED`, `LINK_REVIEW_REQUIRED`, `BACKLINK_RECOMMENDED`, atau `LINK_REVISION_RECOMMENDED`.
- **Invarian Kebersihan Dasbor:** Hubungan berstatus `ACTIVE` yang sehat tetap tidak terlihat di antrean tugas (zero clutter). Begitu relasi diperbaiki atau disetujui, kartu tugas otomatis terhapus dari antrean.

### 4. Konsistensi Metadata Pilar
- Validasi fungsi `validatePillarMetadataSync` dan `validatePillarMetadata` menegakkan:
  - `PILLAR`: `parent_pillar_id` wajib `NULL`.
  - `STANDALONE`: `parent_pillar_id` wajib `NULL`.
  - `SUPPORTING`: `parent_pillar_id` wajib mereferensikan artikel yang berstatus `PILLAR`.
  - Pelarangan relasi mandiri (*self-parenting*) dan lingkaran referensi (*circularity*).
- Artikel A, B, dan C tetap berstatus `STANDALONE`.

### 5. Klasifikasi Bahasa Pengukuran Performa yang Akurat
- **[LOCAL MICROBENCHMARK]:** Lookup in-memory `getActivePlaneALinks` memakan waktu rata-rata **0.0070 ms per lookup** (500 iterasi).
- **[LOCAL SSR BENCHMARK]:** Render in-memory `processArticleContent` memakan waktu rata-rata **0.0548 ms per render** (500 iterasi).
- **[PRODUCTION MEASUREMENT STATUS]:** Latensi Cloudflare D1 aktual dan skor Google Lighthouse di lingkungan produksi secara ketat diklasifikasikan sebagai *To be measured post-deployment*. Tidak ada klaim performa produksi prematur sebelum deployment nyata.

### 6. Transisi Permukaan Tautan Publik (Deduplikasi Tampilan)
- Diperiksa dan diimplementasikan pada `src/pages/[slug].astro`:
  - `Plane A Dynamic Safe` (*Artikel Pendukung untuk Keputusan Ini*) memiliki prioritas tertinggi.
  - Rekomendasi in-article `BACA JUGA` difilter untuk mengecualikan target yang sudah tampil di Plane A.
  - Grid rekomendasi artikel di footer (`RelatedArticles`) difilter untuk mengecualikan target yang sudah ada di Plane A dan naskah BACA JUGA.
  - Zero duplikasi destinasi rekomendasi di hadapan pembaca.

### 7. Hasil Pengujian Lengkap
- `scripts/test-internal-link-engine.js`: 25/25 lulus uji tanpa regresi.
- `scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md`: SHA-256 tetap tepat `12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28`.
- Typecheck (`npx tsc --noEmit`): 0 error.
- SSR Build (`npm run build`): Sukses sempurna.
