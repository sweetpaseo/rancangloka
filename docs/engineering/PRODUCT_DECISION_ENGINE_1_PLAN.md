# 🧭 RancangLoka — PRODUCT_DECISION_ENGINE-1
## Architecture, Data-Contract & Decision Support Planning

> **Milestone:** `PRODUCT_DECISION_ENGINE-1`  
> **Status:** `PLANNING_ONLY_READ_ONLY_AUDIT`  
> **Target Repository:** `rancangloka-astro/`  
> **Production Baseline:** Worker `8f174086-8679-4f31-aec9-1c64844e8bd9` | Cloudflare D1 `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`) | Publication DNA: 5 Active Immutable Rows  
> **Date:** 2026-10-16  
> **Governing Principle:** *"The product is not the center of the decision. The reader's problem is."*

---

## 1. Executive Summary & Core Principle

### 1.1 Prinsip Fundamental (The Core Principle)
> **"THE PRODUCT IS NOT THE CENTER OF THE DECISION. THE READER'S PROBLEM IS."**  
> *(Produk bukanlah pusat keputusan. Masalah dan realitas hidup pembaca adalah pusatnya.)*

RancangLoka dibangun sebagai media digital arsitektur dan hunian independen yang memposisikan diri sebagai **konsultan teknis terpercaya bagi pemilik rumah**. Ketika seorang pembaca menghadapi kebingungan dalam renovasi atau pembangunan rumah, mereka tidak bangun di pagi hari dengan keinginan membeli SKU produk tertentu; mereka bangun dengan masalah nyata:
- *"Kusen jendela di lantai 2 sering rembes air saat hujan angin dan cepat panas saat sore."*
- *"Ruang keluarga terasa panas dan pengap, padahal sudah pasang AC 1 PK."*
- *"Dak beton di atas dapur bocor berulang meski sudah dicat anti-bocor dua kali."*

Sistem mesin keputusan konvensional di internet gagal karena mereka berpusat pada katalog produk, peringkat afiliasi, atau matriks perbandingan generik yang mengabaikan konteks pemakaian.

### 1.2 Alur Keputusan Pembaca (The Reader Decision Path)
Product Decision Engine RancangLoka dirancang untuk memandu pembaca secara runtut melalui lintasan pemecahan masalah yang disiplin:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. PROBLEM / GOAL (Masalah nyata, kegagalan fungsi, atau sasaran renovasi)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. CONTEXT (Tipe rumah, orientasi matahari, lantai, paparan cuaca tropis)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. CONSTRAINTS (Anggaran bertahap, toleransi perawatan, kapabilitas tukang) │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. VIABLE SOLUTION CLASSES (Kelas solusi yang relevan secara fisik/teknis)  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. TRADEOFFS & SCENARIO FIT (Kompromi tak terelakkan pada tiap opsi)        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 6. ADVISORY RECOMMENDATION (Rekomendasi bersyarat: cocok vs tidak cocok)    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 7. NEXT PRACTICAL ACTION (Langkah teknis nyata sebelum mengeluarkan uang)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Apa yang DILARANG pada Product Decision Engine
Product Decision Engine RancangLoka secara ketat dan permanen **DILARANG BERPERILAKU SEBAGAI**:
1. ❌ **Katalog Produk (Product Catalog):** Daftar inventaris barang tanpa penalaran masalah.
2. ❌ **Pasar / E-commerce (Marketplace):** Etalase transaksi dengan keranjang belanja atau tombol beli instan.
3. ❌ **Tabel Komparasi Generik (Generic Comparison Grid):** Matriks tanda centang statis yang membandingkan fitur permukaan tanpa bobot konsekuensi.
4. ❌ **Mesin Pemeringkat Afiliasi (Affiliate Ranking Engine):** Urutan produk yang diurutkan berdasar komisi penjualan, bayaran sponsor, atau rasio konversi klik.
5. ❌ **Pabrik SEO "Top 10" (SEO Slop Farm):** Artikel agregasi dangkal *"10 Rekomendasi Kusen Terbaik 2026"* yang diciptakan semata-mata untuk menjaring klik pencarian mesin telusur.
6. ❌ **Mesin Rekomendasi Sponsor (Sponsored Picker):** Mengubah hasil keputusan demi kepentingan produsen material atau merek tertentu.

---

## 2. Relasi Terhadap Ekosistem Editorial & Sistem yang Ada

Product Decision Engine (PDE) tidak berdiri di ruang hampa. PDE adalah perpanjangan komputasional dari fondasi editorial yang telah beroperasi di RancangLoka. PDE tidak boleh menduplikasi tanggung jawab yang telah diemban oleh modul lain.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                      RANCANGLOKA CORE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Editorial Pipeline:                                                      │
│    Irwan (Evidence) → Joko (Writer) → Nadia (Voice) → Rina (QA)             │
│    → Human Approval → Sari (Readiness)                                      │
│                                                                             │
│ 2. Editorial Depth Model (8 Dimensi):                                       │
│    WHAT, WHY, WHO, WHEN, WHERE, HOW, WHICH, WHAT NEXT                       │
│                                                                             │
│ 3. Semantic Internal Link Engine:                                           │
│    Plane A (Dynamic Cards) & Plane B (Inline Anchor Text)                   │
│                                                                             │
│ 4. Article Support & Edge Cache (CONTENT_PROTECTION-1A):                    │
│    Selective Purge, Reverse Invalidation via support-target-<id>            │
│                                                                             │
│ 5. Publication DNA (CONTENT_PROTECTION-1B):                                 │
│    Immutable Fingerprint, MinHash, Structural Signature, Provenance Ledger  │
│                                                                             │
│ 6. PRODUCT DECISION ENGINE (PDE-1) [MODUL BARU]:                            │
│    Deterministic Constraint Evaluator, Scenario Matcher, Explainable Advice │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Peta Batas Tanggung Jawab (Separation of Concerns)

| Modul Eksisting | Tanggung Jawab Modul Eksisting | Interaksi / Batas dengan Product Decision Engine |
| :--- | :--- | :--- |
| **Editorial Pipeline** | Riset bukti, penulisan narasi panjang, penjagaan nada ramah (*Warm Advisory Tone*), dan validasi faktual. | **PDE mengonsumsi naskah editorial sebagai landasan fakta.** PDE tidak menulis narasi baru yang independen dari korpus riset Irwan dan Joko. |
| **Decision Depth (8 Dimensi)** | Struktur artikel mendalam: *WHAT* (akar masalah), *WHY* (fisika bangunan), *HOW* (metode), *WHICH* (trade-off), *WHAT NEXT* (tindakan). | **PDE memformalkan dimensi *WHICH* dan *WHAT NEXT* menjadi evaluasi terstruktur.** PDE mengubah matriks trade-off naratif menjadi pohon keputusan logika deterministik. |
| **Internal Link Engine** | Menghubungkan artikel secara semantis melalui relasi `RELATED_DECISION`, `PARENT_PILLAR`, `RELATED_MATERIAL`, `NEXT_STEP`. | **PDE berfungsi sebagai target atau sumber relasi `RELATED_DECISION`.** Pembaca yang membaca artikel komparasi dapat diarahkan ke evaluasi skenario PDE, dan sebaliknya. |
| **Article Support & Cache** | Mengelola invalidasi edge cache saat artikel induk diperbarui (`support-target-<id>`). | **Evaluasi PDE terikat pada cache tag artikel induk.** Jika fakta artikel diperbarui, representasi keputusan terkait otomatis ter-purge. |
| **Publication DNA** | Mengunci sidik jari kriptografis naskah terbitan dan bukti provenansi tanda terima atomik. | **PDE mereferensikan `content_hash` artikel yang berstatus DNA Verified.** PDE tidak dapat merumuskan aturan dari draf yang belum disetujui. |

---

## 3. Model Keputusan Pembaca (The Reader Decision Model)

Pemilik rumah di Indonesia memiliki kendala yang sangat riil dan praktis. Memaksa pembaca menjawab 20 parameter akademis akan membuat sistem tidak berguna. Sebaliknya, menyederhanakannya menjadi 2 opsi biner akan menghilangkan nuansa teknis.

Berikut adalah taksonomi evaluasi terhadap seluruh dimensi keputusan kandidat:

### 3.1 Klasifikasi Dimensi Kandidat

```text
DIMENSI KEPUTUSAN KANDIDAT
   ├── CORE (Wajib di Setiap Evaluasi V1)
   │     ├── 1. Problem / Goal (Masalah Utama / Sasaran)
   │     ├── 2. Building Context (Tipe & Karakter Bangunan)
   │     ├── 3. Climate / Weather Exposure (Paparan Cuaca & Orientasi)
   │     ├── 4. Room / Application Location (Lokasi Pemasangan Spesifik)
   │     ├── 5. Budget Class & Capital Staging (Kategori Anggaran & Tahapan Dana)
   │     └── 6. Maintenance Tolerance (Toleransi Perawatan Jangka Panjang)
   │
   ├── OPTIONAL (Kondisional / Sesuai Skenario)
   │     ├── 7. Build Phase (Renovasi Rumah Huni vs Bangun Baru Kosong)
   │     ├── 8. Comfort Priority (Isolasi Suhu Termal vs Meredam Kebisingan Akustik)
   │     └── 9. Security & Privacy Need (Kebutuhan Keamanan Fisik / Privasi)
   │
   ├── DOMAIN-SPECIFIC (Khusus Kategori Material / Sistem Tertentu)
   │     ├── 10. Installation Constraints (Beban Struktur, Tebal Dinding, Bukaan Eksisting)
   │     ├── 11. Local Contractor / Tukang Capability (Tukang Harian vs Aplikator Resmi)
   │     └── 12. Service Life Expectation (Ekspektasi Umur Pakai: 5–10 thn vs Seumur Bangunan)
   │
   └── REJECT (Ditolak Secara Tegas)
         ├── 13. Subjective Aesthetic / Color Preference (Selera Warna / Tren Visual Murni)
         ├── 14. Prestige / Social Status Index ("Kesan Mewah", "Gengsi Perumahan")
         └── 15. Brand Popularity / Marketplace Sales Volume (Banyaknya Terjual di Toko Online)
```

### 3.2 Rincian Dimensi CORE (V1 Foundation)

1. **Problem / Goal (`problem_goal`):**
   - *Mengapa:* Tanpa sasaran jelas, tidak ada keputusan yang bermakna.
   - *Nilai Khas:* Mengganti kusen lapuk/rayap, mencegah rembesan air tempias, mereduksi panas ruangan sore, meredam bising jalan raya, efisiensi biaya awal.
2. **Building Context (`building_context`):**
   - *Mengapa:* Fisika bangunan rumah 1 lantai di perumahan padat berbeda dengan lantai 3 townhouse terbuka.
   - *Nilai Khas:* Rumah Tapak 1 Lantai, Rumah Tingkat 2–3 Lantai, Rumah Sudut (Hook) Terbuka, Townhouse/Klaster Dinding Bersama.
3. **Climate & Orientation Exposure (`climate_exposure`):**
   - *Mengapa:* Realitas iklim mikro Indonesia (panas matahari barat, tempias hujan deras monsoon, angin kencang).
   - *Nilai Khas:* Fasad Barat (Panas Sore Intens), Fasad Selatan/Utara (Teduh/Biasa), Bukaan Atas Terbuka (Tempias Hujan Deras), Area Bawah Terlindung Kanopi.
4. **Room / Application Location (`application_location`):**
   - *Mengapa:* Kamar tidur ber-AC menuntut performa berbeda dibanding jendela dapur atau ruang servis belakang.
   - *Nilai Khas:* Kamar Tidur Utama (Prioritas Akustik & Suhu), Ruang Keluarga / Fasad Depan, Kamar Mandi / Dapur Lembap, Pintu/Jendela Area Servis Luar.
5. **Budget Class & Capital Staging (`budget_class`):**
   - *Mengapa:* Keputusan orang rumah selalu terikat ketersediaan dana tunai dan skema renovasi bertahap (*rumah tumbuh*).
   - *Nilai Khas:* Anggaran Ketat / Terbatas, Anggaran Menengah Terukur, Anggaran Bebas / Investasi Jangka Panjang.
6. **Maintenance Tolerance (`maintenance_tolerance`):**
   - *Mengapa:* Banyak material tampak murah di awal tetapi membebani pemilik rumah dengan pengecatan ulang, penyegelan sealer berkala, atau pembersihan rutin.
   - *Nilai Khas:* Ingin Bebas Perawatan (*Fit & Forget*), Bersedia Perawatan Ringan Berkala (1–2 tahun sekali).

---

## 4. Objek Domain Keputusan (Minimal Domain Objects)

Untuk menghindari jebakan "ontologi kelas korporat" yang rumit tanpa manfaat nyata, PDE mendefinisikan himpunan objek minimal yang saling mengikat secara bersih:

```text
┌──────────────────────┐         1..* ┌──────────────────────┐
│   DecisionProblem    │─────────────▶│    SolutionClass     │
└──────────┬───────────┘              └──────────┬───────────┘
           │                                     │ 1..*
           │ 1..*                                │ (Di Masa Depan)
           ▼                                     ▼
┌──────────────────────┐              ┌──────────────────────┐
│   DecisionScenario   │              │   (ConcreteProduct)  │
└──────────┬───────────┘              │   *Fase Berikutnya*  │
           │                          └──────────────────────┘
           │ 1..*
           ▼
┌──────────────────────┐         1..* ┌──────────────────────┐
│    Recommendation    │─────────────▶│       Tradeoff       │
└──────────┬───────────┘              └──────────────────────┘
           │
           │ 1..*
           ▼
┌──────────────────────┐
│   EvidenceBinding    │ (Terikat ke Artikel & Claim Otoritatif)
└──────────────────────┘
```

### 4.1 Definisi Objek Inti

1. **`DecisionProblem`:**
   Representasi tantangan teknis atau dilema pemilihan material/sistem hunian yang berdiri sendiri (misal: `dp_exterior_window_frame_tropics`: *Pemilihan Kusen Jendela Eksterior Rumah Tropis*).
2. **`SolutionClass`:**
   Kategori solusi teknis generik yang menyelesaikan masalah tanpa menyebut merek komersial (misal: `sol_aluminium_powder_coated`, `sol_upvc_chambered`).
3. **`DecisionConstraint`:**
   Kondisi pembatas yang dapat menggugurkan (*disqualify*) atau mendowngrade kelas solusi tertentu (misal: `c_budget_low`, `c_extreme_weather_west`, `c_wood_termite_risk`).
4. **`DecisionCriterion`:**
   Tolok ukur evaluasi obyektif yang berbasis bukti teknis (misal: *Konduktivitas Termal / Nilai U*, *Kedap Suara / STC*, *Ketahanan Karat / Korosi*, *Kebutuhan Perawatan*).
5. **`Tradeoff`:**
   Konsekuensi negatif atau biaya kompromi yang tak terpisahkan dari suatu keunggulan kelas solusi (misal: *"uPVC lebih kedap dan dingin, namun profil lebih tebal/masif dan bobot lebih berat membutuhkan perkuatan engsel"*).
6. **`DecisionScenario`:**
   Kombinasi parameter konteks pembaca (misal: *Rumah Tingkat 2, Kamar Tidur Utama Hadap Barat, Anggaran Menengah, Ingin Bebas Perawatan*).
7. **`Recommendation`:**
   Keluaran evaluasi bersyarat yang mengaitkan skenario dengan kelas solusi yang paling tepat, lengkap dengan alasan dan alternatifnya.
8. **`EvidenceBinding`:**
   Penunjuk otoritatif yang menautkan kriteria atau trade-off ke artikel publikasi RancangLoka dan kelas klaimnya (`VERIFIED_FACT`, `TECHNICAL_CONSENSUS`).

---

## 5. Invarian: Kelas Solusi Mendahului Produk (Solution Class Precedes Product)

### 5.1 Invarian Permanen
> **`SOLUTION_CLASS_PRECEDES_PRODUCT_SELECTION`**  
> *(Penalaran mesin keputusan wajib memilih kelas solusi teknis sebelum mengaitkan merek, produk konkret, atau penawaran pasar.)*

### 5.2 Rasionalitas Arsitektur
Jika sistem melompat langsung dari masalah ke produk individual (misal: langsung menyodorkan *"Kusen Merek X Seri Y"*), mesin tersebut telah terdegradasi menjadi etalase promosi komersial.

Dalam rekayasa bangunan:
1. Pemilik rumah pertama-tama harus memutuskan apakah kondisi jendelanya membutuhkan **Aluminium** atau **uPVC**.
2. Jika Aluminium dipilih, apakah membutuhkan **Aluminium Standar (Powder Coating tebal 1.3mm)** atau **Aluminium Thermal Break**.
3. Baru setelah kelas solusi teknis terbukti cocok dengan iklim dan anggaran pembaca, pembaca dapat melihat contoh produk konkret atau aplikator terverifikasi di pasar Indonesia.

Ekonomi afiliasi, ketersediaan stok merchant, atau komisi penjualan **DILARANG KERAS** memengaruhi penentuan kelas solusi yang cocok untuk rumah pembaca.

---

## 6. Model Kriteria & Trade-Off (Penolakan Presisi Semu)

### 6.1 Larangan Presisi Semu (Anti-Fake Precision)
Situs web teknologi dan e-commerce sering menampilkan skor numerik semu seperti:
- *"Skor Keseluruhan: 8.7 / 10"*
- *"Kecocokan: 94%"*
- *"Pilihan Terbaik Mutlak (#1 Editor's Choice)"*

Angka-angka desimal di atas adalah manipulasi psikologis tanpa dasar metodologis ilmiah yang dapat diverifikasi (*fake precision*). Tidak ada rumus matematis yang secara sah menyatakan kusen A bernilai 8.7 sedangkan kusen B bernilai 8.4 untuk rumah yang berbeda orientasi dan anggaran.

### 6.2 Taksonomi Kesesuaian Terpilih (Explainable Fit Taxonomy)
PDE menggantikan skor numerik dengan 4 status kesesuaian terstruktur yang dapat dijelaskan secara rasional:

```text
┌───────────────────────────────┬────────────────────────────────────────────────────────┐
│ Status Kesesuaian             │ Makna Operasional bagi Pemilik Rumah                   │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ 1. STRONG_FIT                 │ Pilihan optimal: unggul pada prioritas utama tanpa     │
│    (Sangat Cocok)             │ membentur kendala fatal yang dimiliki skenario.        │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ 2. GOOD_FIT_WITH_TRADEOFF     │ Pilihan layak: menyelesaikan masalah utama dengan baik,│
│    (Cocok dengan Kompromi)    │ namun pemilik rumah wajib menerima kompromi tertentu.  │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ 3. CONDITIONAL_FIT            │ Cocok bersyarat: hanya disarankan jika ada modifikasi  │
│    (Cocok Bersyarat)          │ teknis tambahan (misal: wajib tambah kanopi pelindung).│
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ 4. POOR_FIT                   │ Tidak disarankan: berisiko gagal fungsi atau membuang  │
│    (Kurang / Tidak Cocok)     │ biaya karena bertentangan dengan kendala utama.        │
└───────────────────────────────┴────────────────────────────────────────────────────────┘
```

Setiap penetapan status di atas wajib disertai:
- **Basis Bukti Teknis:** Sifat material yang mendasari kesimpulan (misal: koefisien konduktivitas termal aluminium $\approx 160\text{ W/m}\cdot\text{K}$ vs uPVC $\approx 0.17\text{ W/m}\cdot\text{K}$).
- **Ketergantungan Skenario:** Mengapa status ini berlaku di fasad barat tetapi berbeda di fasad dalam.
- **Tingkat Keyakinan Bukti:** Berdasarkan konsensus industri atau pengujian lapangan.

---

## 7. Kontrak Rekomendasi (The Recommendation Contract)

Rekomendasi yang dipancarkan oleh PDE harus memiliki struktur data yang baku, transparan, dan dapat diaudit.

### 7.1 Skema Kontrak Rekomendasi (TypeScript Interface)

```typescript
export interface DecisionRecommendationOutput {
  decision_problem_id: string;
  scenario_id: string;
  recommended_solution_class: {
    id: string;
    name: string;
    fit_status: 'STRONG_FIT' | 'GOOD_FIT_WITH_TRADEOFF' | 'CONDITIONAL_FIT';
    core_rationale: string; // Penjelasan ringkas mengapa opsi ini menang
  };
  alternative_solution_class?: {
    id: string;
    name: string;
    fit_status: 'GOOD_FIT_WITH_TRADEOFF' | 'CONDITIONAL_FIT' | 'POOR_FIT';
    comparison_context: string; // Mengapa opsi ini menjadi pilihan kedua
  };
  target_profile: {
    fits_who: string[];      // Profil pemilik rumah / skenario yang sangat cocok
    does_not_fit_who: string[]; // Profil yang sebaiknya menghindari opsi ini
  };
  critical_tradeoffs: Array<{
    aspect: string;           // e.g. "Biaya Awal", "Ketebalan Kusen", "Perawatan"
    consequence: string;      // Dampak nyata yang harus diterima pemilik rumah
    mitigation_tip?: string;  // Saran praktis untuk meminimalkan dampak
  }>;
  pivot_conditions: Array<{
    trigger_condition: string; // Kondisi perubahan (misal: "Jika bukaan berada di lantai 1 terlindung...")
    pivots_to_solution_id: string; // Solusi yang otomatis menjadi lebih relevan
    rationale: string;
  }>;
  next_practical_action: {
    step_title: string;       // e.g. "Ukur Tebal Tembok dan Cek Sertifikasi Profil"
    checklist: string[];      // 2–4 langkah teknis konkret sebelum transaksi
  };
  evidence_references: Array<{
    article_id: number;
    article_slug: string;
    claim_type: 'VERIFIED_FACT' | 'TECHNICAL_CONSENSUS' | 'EDITORIAL_RECOMMENDATION';
    evidence_summary: string;
  }>;
  model_version: string;
  evaluated_at: string;
}
```

### 7.2 Sifat Rekomendasi
Rekomendasi RancangLoka bersifat **penasihat independen (advisory)**. PDE tidak pernah mendeklarasikan "pemenang universal mutlak" karena perubahan satu variabel konteks (misalnya adanya tempias hujan atau kenaikan lantai) secara sah dapat membalikkan rekomendasi terbaik.

---

## 8. Disiplin Bukti & Pengikatan Bukti (Evidence Discipline)

Product Decision Engine wajib tunduk pada tata kelola klaim RancangLoka. Aturan rekomendasi tidak boleh diciptakan dari asumsi perancang perangkat lunak, melainkan harus dipetakan secara eksplisit ke kelas klaim kanonikal:

### 8.1 Pemetaan Kelas Klaim ke Komponen Keputusan

```text
┌─────────────────────────────────┬────────────────────────────────────────────────────────┐
│ Kelas Klaim Kanonikal           │ Penggunaan pada Product Decision Engine                │
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ 1. VERIFIED_FACT                │ Sifat fisik material terukur (konduktivitas panas,     │
│                                 │ koefisien muai panjang, massa jenis, standar SNI).     │
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ 2. TECHNICAL_CONSENSUS          │ Praktik baku konstruksi (kebutuhan thermal break pada  │
│                                 │ aluminium, perkuatan besi galvanis di dalam rongga uPVC)│
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ 3. USER_EXPERIENCE_SIGNAL       │ Masalah operasional lapangan (karet seal mengeras,     │
│                                 │ sudut kusen renggang, rembesan pada sekrup dynabolt).  │
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ 4. EDITORIAL_INFERENCE          │ Pemetaan kecocokan skenario iklim mikro Indonesia      │
│                                 │ (fasad barat vs tempias angin monsoon).                │
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ 5. EDITORIAL_RECOMMENDATION     │ Serah-terima keputusan akhir berdasar kompromi         │
│                                 │ (*Warm Decision Handoff*).                             │
└─────────────────────────────────┴────────────────────────────────────────────────────────┘
```

### 8.2 Minimisasi Penyimpanan Bukti
PDE **tidak menduplikasi paragraf panjang artikel** ke dalam database keputusan. Pengikatan bukti dilakukan secara ringan via pointer:
- `article_id`
- `article_slug`
- `content_hash` (penunjuk integritas Publication DNA)
- `claim_class`
- `claim_pointer_id` (ID bagian artikel atau ringkasan klaim ringkas $\le 200$ karakter)

---

## 9. Realitas Hunian Indonesia (Indonesian Housing Realities)

PDE dibangun khusus dari realitas lapangan hunian di Indonesia, bukan mengadopsi mentah-mentah aturan konstruksi iklim empat musim (Eropa/Amerika) atau apartemen tinggi kompak (Singapura/Hong Kong):

1. **Iklim Tropis Lembap & Tempias Monsoon:** Curah hujan deras disertai angin bertekanan tinggi menuntut evaluasi ketahanan sistem drainase kusen dan seal, bukan sekadar ketahanan air statis.
2. **Panas Radiasi Sore Matahari Barat:** Rumah di Indonesia sering mengalami overheating ekstrem pada ruangan lantai atas yang menghadap barat antara pukul 14.00–17.30 WIB.
3. **Konstruksi Rumah Tumbuh & Bertahap:** Pemilik rumah sering kali membangun lantai 1 terlebih dahulu, kemudian melanjutkan renovasi lantai 2 beberapa tahun kemudian saat dana terkumpul. Opsi material harus memperhitungkan kesinambungan modul.
4. **Renovasi pada Rumah yang Sedang Dihuni:** Pembongkaran kusen kayu lama menjadi kusen baru sering menimbulkan kerusakan plesteran dan debu bata di ruang tidur yang aktif dipakai. Tingkat kerumitan instalasi (*retrofit friction*) menjadi variabel kritis.
5. **Variabilitas Kualitas Tukang Lokal:** Tidak semua daerah memiliki aplikator bersertifikat. Solusi yang menuntut presisi mikrometer berisiko gagal jika dipasang oleh tukang harian umum tanpa alat kalibrasi khusus.
6. **Polusi Debu Jalanan & Air Tanah:** Jalur rel geser pintu/jendela rawan tersumbat debu tanah, dan air siraman dengan kadar mineral tinggi dapat menimbulkan kerak pada profil tertentu.

---

## 10. Keterjelasan Keputusan (Explainability Architecture)

Setiap rekomendasi yang dihasilkan sistem—baik yang dilihat oleh editor di panel admin maupun oleh pembaca di kemudian hari—wajib dapat menjawab tiga pertanyaan emas (*The 3 Golden Questions*):

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. MENGAPA OPSI INI YANG DIREKOMENDASIKAN?                                  │
│    (Sebutkan secara eksplisit sifat fisik/karakteristik teknis material     │
│    yang langsung menjawab masalah utama pembaca.)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. MENGAPA BUKAN OPSI LAINNYA?                                              │
│    (Jelaskan kelemahan atau risiko spesifik dari opsi tandingan dalam        │
│    menghadapi batasan atau paparan cuaca yang dialami skenario ini.)        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. KONDISI APA YANG AKAN MEMBALIKKAN HASIL INI?                             │
│    (Sebutkan 1–2 perubahan variabel kontekstual yang akan membuat opsi      │
│    tandingan seketika menjadi lebih unggul dan rasional.)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

PDE secara arsitektural menolak segala bentuk algoritma pembobotan acak (*black-box machine learning classifier*) yang tidak dapat dilacak alur logikanya oleh editor manusia.

---

## 11. Pembagian Peran: Logika Deterministik vs Bantuan AI

Untuk menjamin keandalan mutlak dan mencegah halusinasi AI dalam rekomendasi bangunan yang berisiko finansial tinggi bagi pemilik rumah, PDE menetapkan batas tegas antara mesin deterministik dan bantuan AI:

```text
┌──────────────────────────────────────────────┐
│ DETERMINISTIC LOGIC ENGINE (100% KODE/SQL)   │
├──────────────────────────────────────────────┤
│ • Validasi kecocokan batasan (Constraints)   │
│ • Evaluasi kriteria teknis objektif          │
│ • Pemetaan skenario ke kelas solusi          │
│ • Pengelompokan status kesesuaian (Fit Status│
│ • Penentuan kondisi pembalik (Pivot Triggers)│
│ • Penegakan batasan komersial & afiliasi     │
└──────────────────────┬───────────────────────┘
                       │ Output Terstruktur (JSON Murni)
                       ▼
┌──────────────────────────────────────────────┐
│ AI ADVISORY ASSISTANCE (LLM / JOKO & NADIA)  │
├──────────────────────────────────────────────┤
│ • Penyusunan prosa penjelasan ramah pembaca  │
│ • Penyederhanaan istilah teknis rumit        │
│ • Penerjemahan JSON terstruktur ke bahasa ibu│
│ • Pembuatan ringkasan saran bagi editor      │
└──────────────────────┬───────────────────────┘
                       │ Draf Penjelasan
                       ▼
┌──────────────────────────────────────────────┐
│ HUMAN EDITORIAL AUTHORITY (CHIEF EDITOR)     │
├──────────────────────────────────────────────┤
│ • Otoritas mutlak persetujuan logika & naskah│
│ • Verifikasi kebenaran teknis & netralitas   │
│ • Penguncian versi keputusan publik          │
└──────────────────────────────────────────────┘
```

**Aturan Keselamatan AI:**
- AI dilarang keras menciptakan kriteria keputusan baru di luar aturan deterministik yang telah disetujui editor.
- AI dilarang keras mengarang angka spesifikasi teknis atau klaim pengujian fisik.
- Jika API AI mengalami timeout atau kegagalan, sistem deterministik tetap menyajikan data rekomendasi terstruktur tanpa terganggu (*graceful fallback*).

---

## 12. Model Penyimpanan Data (Minimal Additive D1 Model Blueprint)

Berikut adalah cetak biru skema D1 aditif minimal. Skema ini dirancang strictly additive, berintegritas tinggi, dan tidak mengubah tabel publikasi artikel yang sedang aktif di produksi.

*(Catatan: Ini adalah cetak biru perencanaan, tidak dieksekusi atau dimigrasikan pada sesi ini).*

```sql
-- 1. Tabel Masalah Keputusan Utama
CREATE TABLE IF NOT EXISTS decision_problems (
  problem_id TEXT PRIMARY KEY,               -- e.g. 'dp_exterior_window_frame_tropics'
  canonical_slug TEXT NOT NULL UNIQUE,       -- e.g. 'pilih-kusen-jendela-rumah-tropis'
  title TEXT NOT NULL,                       -- e.g. 'Panduan Keputusan: Kusen Aluminium vs uPVC'
  description TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  primary_article_id INTEGER NOT NULL,       -- Link ke artikel pilar otoritatif
  status TEXT NOT NULL DEFAULT 'DRAFT',      -- 'DRAFT', 'ACTIVE', 'ARCHIVED'
  model_version TEXT NOT NULL DEFAULT 'v1.0',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Kelas Solusi yang Relevan untuk Masalah Terkait
CREATE TABLE IF NOT EXISTS decision_solution_classes (
  solution_id TEXT PRIMARY KEY,              -- e.g. 'sol_aluminium_powder_coated', 'sol_upvc_chambered'
  problem_id TEXT NOT NULL,
  solution_name TEXT NOT NULL,               -- e.g. 'Kusen Aluminium Powder Coating 1.3mm'
  solution_category TEXT NOT NULL,           -- 'MATERIAL', 'BUILDING_SYSTEM', 'ASSEMBLY'
  description TEXT NOT NULL,
  inherent_strengths_json TEXT NOT NULL,     -- Array of strings
  inherent_weaknesses_json TEXT NOT NULL,    -- Array of strings
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (problem_id) REFERENCES decision_problems(problem_id)
);

-- 3. Matriks Kriteria Evaluasi Objektif
CREATE TABLE IF NOT EXISTS decision_criteria (
  criterion_id TEXT PRIMARY KEY,             -- e.g. 'crit_thermal_insulation', 'crit_water_leakage_resistance'
  problem_id TEXT NOT NULL,
  criterion_name TEXT NOT NULL,
  dimension_type TEXT NOT NULL,              -- 'CORE', 'OPTIONAL', 'DOMAIN_SPECIFIC'
  evaluation_unit TEXT,                      -- e.g. 'W/m²K', 'dB', 'Qualitative Tier'
  weight_class TEXT NOT NULL DEFAULT 'HIGH', -- 'CRITICAL', 'HIGH', 'MEDIUM'
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (problem_id) REFERENCES decision_problems(problem_id)
);

-- 4. Pengikatan Bukti Kriteria ke Kelas Solusi
CREATE TABLE IF NOT EXISTS decision_criteria_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  criterion_id TEXT NOT NULL,
  solution_id TEXT NOT NULL,
  performance_tier TEXT NOT NULL,            -- 'EXCELLENT', 'ADEQUATE', 'POOR'
  factual_basis TEXT NOT NULL,               -- Keterangan fakta singkat
  claim_class TEXT NOT NULL,                 -- 'VERIFIED_FACT', 'TECHNICAL_CONSENSUS'
  evidence_article_id INTEGER NOT NULL,      -- Rujukan artikel sumber
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (criterion_id) REFERENCES decision_criteria(criterion_id),
  FOREIGN KEY (solution_id) REFERENCES decision_solution_classes(solution_id)
);

-- 5. Skenario Matriks dan Rekomendasi Terstruktur (Canonical Scenarios)
CREATE TABLE IF NOT EXISTS decision_scenarios (
  scenario_id TEXT PRIMARY KEY,              -- e.g. 'scen_west_facing_upper_floor_mid_budget'
  problem_id TEXT NOT NULL,
  scenario_title TEXT NOT NULL,              -- e.g. 'Kamar Tidur Lantai 2 Menghadap Barat'
  context_hash TEXT NOT NULL,                -- Hash deterministik dari kombinasi parameter konteks
  context_parameters_json TEXT NOT NULL,     -- JSON parameter: { floor: 2, orientation: 'WEST', budget: 'MID' }
  recommended_solution_id TEXT NOT NULL,     -- Solusi utama
  alternative_solution_id TEXT,              -- Solusi alternatif
  fit_status TEXT NOT NULL,                  -- 'STRONG_FIT', 'GOOD_FIT_WITH_TRADEOFF', 'CONDITIONAL_FIT'
  rationale_summary TEXT NOT NULL,           -- Mengapa opsi ini
  counter_rationale TEXT NOT NULL,           -- Mengapa bukan opsi tandingan
  pivot_trigger TEXT NOT NULL,               -- Kondisi pembalik rekomendasi
  tradeoffs_json TEXT NOT NULL,              -- Array of tradeoff objects
  next_action_json TEXT NOT NULL,            -- Array of next action steps
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (problem_id) REFERENCES decision_problems(problem_id),
  FOREIGN KEY (recommended_solution_id) REFERENCES decision_solution_classes(solution_id)
);
```

### 12.1 Klasifikasi Lapisan Field (Data Integrity Guard)
- **SOURCE-OF-TRUTH Fields:** `context_parameters_json`, `recommended_solution_id`, `fit_status`, `evidence_article_id`, `claim_class`.
- **DERIVED Fields:** `context_hash` (dihitung secara deterministik via SHA-256 dari parameter terurut), `performance_tier`.
- **EDITORIAL Fields:** `rationale_summary`, `counter_rationale`, `pivot_trigger`, `tradeoffs_json`, `next_action_json`.
- **RUNTIME Fields:** Waktu evaluasi sesi, preferensi seleksi pembaca saat interaksi dinamis (hanya di memori peramban/klien, tidak dicatat ke database produksi).

---

## 13. Pelacakan Versi & Keterlacakan (Versioning & Provenance)

Rekomendasi teknis konstruksi dapat bergeser seiring waktu (misal: munculnya standar material baru atau pemutakhiran SNI). Oleh karena itu, setiap entitas keputusan memuat kontrak versi:

1. **`model_version`:** Mengidentifikasi versi pohon logika keputusan (misal: `v1.0`).
2. **`criteria_version`:** Mengidentifikasi himpunan kriteria evaluasi yang aktif.
3. **`evidence_snapshot_hash`:** Hash SHA-256 dari seluruh data evaluasi dan kutipan artikel terkait saat rekomendasi dibekukan oleh editor.
4. **Relasi Artikel Otoritatif:** Setiap keputusan terikat secara eksplisit ke `primary_article_id` dan `content_hash` terbitan artikel tersebut di tabel `articles` / `article_dna_signatures`.

Jika artikel pilar terkait diperbarui naskahnya di kemudian hari (misalnya Artikel 5 direvisi), sistem mendeteksi ketidakcocokan hash dan menandai entitas keputusan sebagai `NEEDS_RECALIBRATION`, tanpa mengubah aturan secara diam-diam.

---

## 14. Integrasi dengan Artikel Editorial (Article Integration)

### 14.1 Pembagian Peran yang Sehat
- **ARTIKEL:** Menyediakan narasi menyeluruh, pemahaman konseptual, analogi ramah pembaca, dokumentasi visual, dan pembuktian fakta secara mendalam (*Long-Form Context & Education*).
- **DECISION ENGINE:** Menyediakan alat bantu kalkulasi atau pemilihan skenario praktis yang langsung merespons situasi spesifik rumah pembaca (*Structured Scenario Evaluation*).

Artikel tidak boleh digantikan oleh halaman keputusan tipis, dan mesin keputusan tidak boleh membebankan pembaca dengan membaca ulang 3.000 kata naskah jika pembaca hanya ingin memverifikasi skenario rumahnya.

### 14.2 Rekomendasi Tahap Penerapan: ADMIN/EDITORIAL-FIRST
> **REKOMENDASI KANONIKAL:**  
> **Product Decision Engine V1 wajib diimplementasikan sebagai `ADMIN/EDITORIAL-FIRST`, BUKAN langsung menjadi antarmuka publik.**

**Rasionalitas:**
1. **Verifikasi Integritas Logika:** Redaksi (Irwan, Joko, Rina) dan Chief Editor harus dapat menyusun, menguji, dan memvalidasi keakuratan pohon keputusan pada panel admin sebelum dibuka ke publik.
2. **Pengujian Stabilitas Aturan:** Menghindari rilis instrumen publik dengan celah logika skenario yang belum terkalibrasi.
3. **Penyelarasan dengan Korpus Artikel:** Memastikan seluruh data kriteria benar-benar memiliki jangkar naskah yang kokoh di korpus artikel terbitan.
4. **Keamanan Ekosistem:** Mengisolasi mutasi dan interaksi baru di balik otentikasi admin, menjaga permukaan publik tetap ramping dan bebas risiko regresi performa edge cache.

---

## 15. SEO, Pengindeksan & Batas Mesin Telusur (SEO & Indexing Guard)

Salah satu bahaya terbesar dari mesin keputusan interaktif adalah terciptanya **ribuan halaman kombinatorial tipis (thin programmatic SEO pages)** yang dapat memicu penalti kualitas dari mesin telusur seperti Google (*Spammy Automatically Generated Content*).

### 15.1 Kebijakan Pengindeksan Bersih (Indexing Rules)
1. **Halaman Publik Otoritatif Bersifat Kanonikal:** Hanya halaman artikel pilar (misal: `/kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`) yang diindeks secara penuh oleh Google News dan web crawler (`index, follow`).
2. **Komponen Keputusan adalah Modul Interaktif Sisi-Klien / API Internal:**
   - Interaksi seleksi parameter konteks dijalankan secara mulus di sisi klien (in-memory DOM state) atau melalui endpoint API internal `/api/decision/...`.
   - Perubahan kombinasi input pembaca **TIDAK MENCIPTAKAN URL BARU BERIKANAN MESIN TELUSUR** (zero dynamic querystring sprawl seperti `?budget=mid&floor=2&facing=west`).
   - Jika di masa mendatang dibuat rute URL skenario publik, rute tersebut wajib membawa header `X-Robots-Tag: noindex, follow` dan menyertakan tag `<link rel="canonical">` yang merujuk kembali ke artikel pilar induk.

---

## 16. Batas Perlindungan Afiliasi Masa Depan (Future Affiliate Boundary)

Meskipun monetisasi afiliasi dan *Product Review Desk* secara eksplisit **DITUNDA** dan bukan bagian dari tonggak PDE-1 ini, arsitektur PDE harus memiliki sekat pengaman permanen agar integrasi komersial di masa mendatang tidak dapat merusak netralitas keputusan:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PRODUCT DECISION ENGINE (PDE)                         │
│               [100% INDEPENDENT, EDITORIAL & EVIDENCE FIRST]                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Evaluasi Masalah & Kebutuhan Fisik Bangunan                              │
│ 2. Seleksi Kelas Solusi (e.g. Aluminium Thermal Break vs uPVC Multi-Chamber)│
│ 3. Peringatan Risiko, Keterbatasan & Trade-off Nyata                        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ TEMBOK PEMISAH MUTLAK (HARD BOUNDARY)
                                       │ • Zero Affiliate Influence
                                       │ • Zero Merchant Bidding
                                       │ • Zero Commission Weighting
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 FUTURE PRODUCT REVIEW & AFFILIATE LAYER                     │
│                           [DEFERRED / FASE 2]                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Pencocokan Penawaran Pasar terhadap Solusi yang SUDAH Terpilih            │
│ • Informasi Harga Riil & Penjual Terpercaya                                │
│ • Transparansi Tautan Afiliasi Sesuai Etika Jurnalistik                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Invarian Perlindungan Komersial:**
1. Mesin keputusan mengevaluasi kelayakan teknis secara buta terhadap ada atau tidaknya tautan afiliasi (*commission-blind evaluation*).
2. Jika sebuah kelas solusi tidak memiliki produk afiliasi di pasar, kelas solusi tersebut **TETAP WAJIB DIREKOMENDASIKAN** jika memang secara teknis paling tepat untuk rumah pembaca.
3. Pendapatan komisi, status sponsor, atau margin keuntungan mitra dilarang keras masuk sebagai parameter fungsi pembobotan keputusan.

---

## 17. Rekomendasi Domain Uji Coba Pertama (The Pilot Decision Domain)

### 17.1 Pemilihan Kandidat Pilot
Dua kandidat utama dari korpus artikel produksi terbitan RancangLoka:
- **Kandidat A:** *Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia* (Artikel 5 / `kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`).
- **Kandidat B:** *Sistem Shading Luar Rumah Tropis* (Artikel 9 / `memilih-sistem-shading-luar-rumah-tropis`).

### 17.2 Rekomendasi Terpilih: KANDIDAT A (Kusen Aluminium vs uPVC)
> **PILIHAN PILOT UTAMA:**  
> **Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia (Artikel 5)**

**Alasan Pemilihan (Rationale):**
1. **Dilema Klasik Pemilik Rumah:** Merupakan perdebatan renovasi paling umum dan frekuen di kalangan pemilik rumah Indonesia saat mengganti kusen kayu lama yang dimakan rayap.
2. **Ketersediaan Bukti Teknis yang Matang:** Artikel 5 telah memiliki basis data perbandingan fisika material yang lengkap (konduktivitas termal, muai panjang, redaman suara, ketahanan korosi asam/garam, kebutuhan perkuatan profil baja).
3. **Trade-off yang Sangat Kontras & Nyata:**
   - Aluminium: Profil ramping, tahan lama, tidak melengkung, namun menghantarkan panas (*thermal bridge*) dan seal sudut rawan bocor jika tukang kurang rapi.
   - uPVC: Sangat kedap suara, isolator panas unggul, sambungan sudut dilas mati tahan bocor, namun profil lebih tebal/masif, bobot berat, dan mutu sangat tergantung pada ketebalan baja penguat di dalam rongga.
4. **Uji Keterjelasan (*Explainability Testbed*):** Sangat mudah menguji logika *"Mengapa opsi ini?"* dan *"Kondisi apa yang membalikkan rekomendasi?"* (misal: penambahan kanopi eksterior atau perpindahan orientasi kamar tidur langsung mengubah rekomendasi dari uPVC ke Aluminium atau sebaliknya).

---

## 18. Pembagian Tanggung Jawab Staf Redaksi & Rekayasa

Sesuai tradisi tata kelola RancangLoka, tanggung jawab didistribusikan secara jelas tanpa menciptakan peran baru yang tidak perlu:

```text
┌───────────────┬─────────────────────────────────────────────────────────────┐
│ Staf          │ Tanggung Jawab pada Product Decision Engine                 │
├───────────────┼─────────────────────────────────────────────────────────────┤
│ **Irwan**     │ Mengumpulkan spesifikasi teknis, standar sertifikasi (SNI,  │
│ (Research)    │ ISO), manual aplikator, dan data pengujian lab independen.  │
│               │ Mengaitkan bukti ke tabel kriteria evaluasi objektif.       │
├───────────────┼─────────────────────────────────────────────────────────────┤
│ **Joko**      │ Menyusun naskah penjelasan rekomendasi dalam bahasa orang   │
│ (Writer)      │ rumah (*Warm Advisory Tone*), menguraikan kompromi nyata,   │
│               │ dan merumuskan langkah praktis berikutnya (*Next Action*).  │
├───────────────┼─────────────────────────────────────────────────────────────┤
│ **Nadia**     │ Menjaga suara pembaca (*Reader Voice QA*), memverifikasi    │
│ (Language)    │ bahwa tidak ada jargon teknis tanpa penjelasan, serta       │
│               │ mengawasi kesesuaian konteks budaya lokal (*Dimensi K*).    │
├───────────────┼─────────────────────────────────────────────────────────────┤
│ **Rina**      │ Menegakkan integritas kebenaran faktual (*Editorial QA*),   │
│ (QA)          │ memvalidasi bahwa seluruh kriteria memiliki dasar bukti,    │
│               │ dan memverifikasi batas netralitas komersial.               │
├───────────────┼─────────────────────────────────────────────────────────────┤
│ **Dimas**     │ Mengawasi integritas skema data terstruktur, konsistensi    │
│ (Data/Tech)   │ foreign key, dan keterlacakan sidik jari Publication DNA.   │
├───────────────┼─────────────────────────────────────────────────────────────┤
│ **Sari**      │ Memeriksa kesiapan operasional rilis keputusan pada panel   │
│ (Ops)         │ admin di bawah pengawasan otorisasi manusia penuh.          │
├───────────────┼─────────────────────────────────────────────────────────────┤
│ **Chief Ed**  │ Otoritas tunggal penentu dan penyetuju logika keputusan.     │
│ (Human Final) │ Menolak secara mutlak otomatisasi penerbitan (*Zero Auto*). │
├───────────────┼─────────────────────────────────────────────────────────────┤
│ **Jefry**     │ *STRICTLY SHADOW ADVISORY ONLY*. Mengamati telemetri risiko │
│ (TypeSafe Jev)│ keputusan tanpa hak mengubah atau mempublikasikan logika.   │
└───────────────┴─────────────────────────────────────────────────────────────┘
```

---

## 19. Batas Ruang Lingkup MVP (The MVP Boundary)

Untuk mencegah pembengkakan cakupan (*feature creep*) dan menjaga disiplin rekayasa, batas implementasi V1 dikunci secara tegas:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. IN V1 (Cakupan Terpilih PDE-1)                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Model data terstruktur D1 untuk Decision Problems, Solution Classes,     │
│   Criteria, Evaluations, dan Scenarios.                                     │
│ • Mesin evaluasi logika deterministik (TypeScript pure functions).          │
│ • Kontrak rekomendasi terstruktur (Fit Status, Rationale, Tradeoffs,       │
│   Pivot Triggers, Next Action).                                             │
│ • Pengikatan bukti ke naskah Artikel 5 (Kusen Aluminium vs uPVC).           │
│ • Panel admin internal untuk inspeksi, simulasi, dan audit keputusan.      │
│ • Pengujian unit dan integrasi deterministik 100% lulus.                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. DEFERRED (Ditunda ke Fase Berikutnya)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Antarmuka pembaca publik interaktif di situs web utama rancangloka.com.    │
│ • Pengikatan produk konkret komersial (merek / SKU tertentu).               │
│ • Mesin integrasi afiliasi, pelacakan harga pasar, dan komisi merchant.     │
│ • Ekspansi ke domain keputusan lain (Ventilasi, Shading, Waterproofing).    │
│ • Otomatisasi parafrase teks AI runtime (tetap menggunakan teks editorial). │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. REJECTED (Ditolak Permanen)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Sistem pemeringkatan skor numerik tunggal (8.7/10, 95%, Best Overall).    │
│ • Fitur keranjang belanja, checkout, atau transaksi e-commerce.             │
│ • Penempatan produk bersponsor yang mengubah urutan rekomendasi.            │
│ • Pembuatan ribuan halaman programmatic SEO otomatis berbasis querystring.  │
│ • Pengambilan keputusan otomatis tanpa pengawasan dan persetujuan redaksi.  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 20. Audit Risiko & Mitigasi (Risk Audit & Mitigations)

| # | Skenario Risiko | Dampak Teknis / Redaksional | Strategi Mitigasi Terkunci |
| :- | :--- | :--- | :--- |
| **1** | **Presisi Semu (*Fake Precision*)** | Pembaca disesatkan oleh angka desimal yang terkesan ilmiah padahal artifisial. | Melarang skor desimal numerik; wajib menggunakan taksonomi kualitatif terstruktur (`STRONG_FIT`, dll.). |
| **2** | **Overfitting pada Satu Artikel** | Struktur tabel terlalu kaku dan hanya bekerja untuk kusen jendela, gagal untuk topik lain. | Merancang model relasi generik (`SolutionClass`, `DecisionProblem`, `DecisionCriterion`) yang agnostik terhadap kategori fisik. |
| **3** | **Rekomendasi Tanpa Bukti** | Sistem merekomendasikan solusi atas dasar asumsi pribadi insinyur perangkat lunak. | Menegakkan foreign key wajib ke artikel terbitan yang memiliki hash `Publication DNA` valid. |
| **4** | **Pengaruh Bias Komersial** | Pilihan teknis terdistorsi oleh ketersediaan tautan afiliasi atau tawaran sponsor. | Mengunci invarian `SOLUTION_CLASS_PRECEDES_PRODUCT_SELECTION` dan menolak parameter komisi dari mesin keputusan. |
| **5** | **Banjir Halaman Tipis SEO** | Situs terkena penalti Google akibat ribuan variasi kombinasi input yang diindeks. | Komponen keputusan berjalan di sisi klien/API internal; halaman publik tetap kanonikal dengan proteksi `noindex`. |
| **6** | **Halusinasi Keputusan AI** | LLM menyarankan solusi berbahaya (misal: pemasangan tanpa seal air di bukaan terbuka). | Logika evaluasi kelayakan 100% deterministik; peran AI dibatasi hanya pada penghalusan bahasa di bawah persetujuan editor. |
| **7** | **Bukti Usang (*Stale Evidence*)** | Rekomendasi bertahan pada standar lama padahal material atau SNI telah direvisi. | Memasang audit integritas versi: perubahan naskah artikel pilar otomatis memicu status `NEEDS_RECALIBRATION`. |
| **8** | **Pergeseran Aturan (*Rule Drift*)** | Logika keputusan berubah tanpa jejak siapa dan kapan yang memodifikasi. | Setiap keputusan membawa `model_version`, `criteria_version`, dan snapshot stempel waktu di bawah pengawasan Chief Editor. |
| **9** | **Kerumitan Bahasa Konsultan** | Pembaca bingung oleh istilah teknik bangunan yang terlalu rumit. | Gerbang nada Nadia (*Reader Voice QA*) memeriksa ulang draf penjelasan agar menggunakan kosakata orang rumah (*Common words first*). |

---

## 21. Tahapan Rencana Implementasi (Implementation Roadmap)

Untuk menjaga eksekusi tetap terukur, terkendali, dan aman dari regresi, peta jalan rekayasa dibagi menjadi 5 fase terpisah:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ PDE-1A: DATA CONTRACT & PILOT FIXTURE (LOKAL)                               │
│ • Pembuatan definisi tipe TypeScript murni & kontrak skema D1 aditif.       │
│ • Penyusunan fixture data statis pilot: Kusen Aluminium vs uPVC.            │
│ • Validasi golden vectors keputusan tanpa mutasi database produksi.         │
├─────────────────────────────────────────────────────────────────────────────┤
│ PDE-1B: DETERMINISTIC EVALUATOR RUNTIME (LOKAL)                             │
│ • Implementasi pure evaluation engine (Constraint Matching & Scenario Fit). │
│ • Pengujian unit deterministik: pembuktian 3 pertanyaan keterjelasan.       │
│ • Penegakan taksonomi fit status tanpa skor numerik semu.                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ PDE-1C: EDITORIAL / ADMIN INSPECTION TOOL                                   │
│ • Pembangunan antarmuka panel admin internal (/admin/decisions).            │
│ • Simulator evaluasi skenario untuk Chief Editor, Irwan, Joko, dan Rina.   │
│ • Gerbang audit dan penguncian versi keputusan.                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ PDE-1D: CONTROLLED D1 MIGRATION & PILOT ACTIVATION                          │
│ • Aplikasi migrasi skema D1 aditif ke produksi di bawah kontrol ganda.      │
│ • Penyimpanan data terstruktur pilot Kusen Aluminium vs uPVC.              │
│ • Pembuktian integritas data dan verifikasi nol dampak pada edge cache.     │
├─────────────────────────────────────────────────────────────────────────────┤
│ PDE-1E: FUTURE BOUNDARY & PUBLIC INTEGRATION ARCHITECTURE                   │
│ • Perancangan modul UI publik yang ringan dan bebas dampak SEO buruk.       │
│ • Penguncian batas perlindungan afiliasi dan persiapan Product Review Desk. │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 22. Status Audit Kesiapan

1. **Kode Runtime Eksisting:** Bersih, tidak tersentuh, dan stabil di Worker `8f174086-8679-4f31-aec9-1c64844e8bd9`.
2. **Database Cloudflare D1:** Mempertahankan integritas penuh 5 baris Publication DNA, 0 mutasi pada sesi ini.
3. **Penyimpanan R2 & Dashboard:** 0 mutasi.
4. **Keselamatan Produksi:** Seluruh invarian `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, dan `JEV_MODE = shadow` aktif 100%.

---

*Dokumen Perencanaan ini disiapkan secara resmi untuk menutup fase audit dan perencanaan arsitektur Product Decision Engine.*  
*Klasifikasi: `PRODUCT_DECISION_ENGINE_1_PLAN_PASS`*  
---

## 23. PDE-1A Implementasi Kontrak Data & Fixture Pilot (Implementasi Selesai)

### 23.1 Kontrak Tipe Final (`src/lib/product-decision/types.ts`)
Kontrak tipe inti TypeScript murni diimplementasikan tanpa dependensi database, Astro, atau runtime UI:
- **`DecisionProblem`:** Identitas masalah keputusan kanonikal (`problem_id`, `canonical_slug`, `title`, `description`, `primary_article_id`).
- **`DecisionContext`:** 6 dimensi CORE wajib (`problem_goal`, `building_context`, `climate_exposure`, `application_location`, `budget_class`, `maintenance_tolerance`) dan dimensi opsional terdefinisi (`build_phase`, `comfort_priority`, `security_priority`, `installation_constraints`, `applicator_complexity`, `service_life_expectation`).
- **`DecisionConstraint`:** Klasifikasi batasan `HARD` (menggugurkan kelas solusi) dan `SOFT` (mempengaruhi kecocokan/kompromi).
- **`SolutionClass`:** Pilihan sistem teknologi arsitektural (`solution_id`, `name`, `tradeoffs`, `display_order`), bebas dari entitas merek/SKU/komersial.
- **`DecisionCriterion` & `CriterionEvaluation`:** Kriteria evaluasi dengan nilai bukti kualitatif tanpa angka semu (`BOOLEAN`, `ORDINAL`, `QUALITATIVE_CATEGORY`, `MEASURED_VALUE`).
- **`Tradeoff`:** Kompromi rekayasa terstruktur (`benefit`, `cost_or_compromise`, `affected_contexts`, `evidence_binding`).
- **`RecommendationContract`:** Kontrak rekomendasi menjawab 3 Pertanyaan Emas: *Mengapa Opsi Ini?*, *Mengapa Bukan Opsi Tandingan?*, dan *Kondisi Apa yang Membalikkan Hasil?*.
- **`DecisionScenario`:** Definisi skenario keputusan konkret dengan ekspektasi rekomendasi kanonikal.
- **`DecisionModelDefinition`:** Wadah model statis dengan `model_id`, `model_version`, `criteria_version`, dan `evidence_snapshot_hash`.

### 23.2 Dukungan Bukti Kualitatif (Anti Fake Numeric Precision)
- Tipe data kriteria mewajibkan `evidence_value_type` bernilai `BOOLEAN`, `ORDINAL`, `QUALITATIVE_CATEGORY`, atau `MEASURED_VALUE`.
- Dilarang keras mensintesis skor angka tunggal, rating bintang, atau persentase kecocokan buatan (`WINNER_SCORE`, `8.7/10`, `94_PERCENT_FIT`).
- Taksonomi kecocokan dikunci tepat pada 4 status V1: `STRONG_FIT`, `GOOD_FIT_WITH_TRADEOFF`, `CONDITIONAL_FIT`, `POOR_FIT`.

### 23.3 Pengikatan Versi Bukti Otoritatif (`EvidenceBinding`)
Setiap bukti terikat secara presisi pada sidik jari Publication DNA artikel otoritatif:
- `article_id: 5`
- `article_slug: "kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia"`
- `publication_version_key: "receipt:rcpt_bbae85b48e1b2f8d"`
- `published_content_hash: "14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277"`
- `source_fidelity: "NORMALIZED_HASH_VERIFIED"` (bukan `BYTE_EXACT_HASH_VERIFIED`)
- `claim_class`: Menjaga derajat epistemik (`VERIFIED_FACT`, `TECHNICAL_CONSENSUS`, `EDITORIAL_INFERENCE`, `EDITORIAL_RECOMMENDATION`). Ringkasan bukti dibatasi maksimal 200 karakter.

### 23.4 Penghitungan Snapshot Hash & Status Rekalibrasi Terderivasi
- **`evidence_snapshot_hash`:** Dihitung deterministik via SHA-256 atas entitas bukti terurut (deduplikasi set identitas `${article_id}|${publication_version_key}|${claim_class}|${published_content_hash}`).
- **Status Rekalibrasi Terderivasi:** `NEEDS_RECALIBRATION` tidak disimpan sebagai boolean mutabel di dalam data model, melainkan dihitung secara fungsional dinamis via `deriveEvidenceFreshness(model, authoritativeMap)`. Menghasilkan `CURRENT`, `NEEDS_RECALIBRATION` saat terjadi pergeseran hash bukti, atau `EVIDENCE_UNAVAILABLE` jika bukti hilang.

### 23.5 Batas Pengaman Bebas Komersial (Affiliate & Commercial Boundary)
- Modul `contracts.ts` memuat scanner struktural ketat `scanForForbiddenFields` yang memindai objek model secara rekursif terhadap 18 kata kunci komersial dan skor semu (`affiliate_url`, `commission`, `merchant`, `merchant_rank`, `payout`, `offer_price`, `affiliate_priority`, `sponsored_rank`, `price`, `best_overall`, `winner_score`, `star_rating`, dll.). Model ditolak jika ditemukan satu pun field komersial.

### 23.6 Fixture Pilot Artikel 5 (`src/lib/product-decision/pilot-kusen.ts`)
- **2 Solution Classes:** `sol_aluminium_standar` (Aluminium Arsitektural Ekstrusi Standar) dan `sol_upvc_multi_chamber` (uPVC Multi-Chamber dengan Tulangan Baja Galvanis).
- **7 Criteria Nyata:** Konduktivitas termal bingkai, kekakuan struktural bentang besar, ketahanan rembes air sambungan sudut, insulasi akustik, ketahanan korosi udara pesisir, stabilitas muai-panjang termal, dan ketebalan profil visual (*sightline*).
- **3 Constraints:** 1 HARD (`c_massive_opening_rigidity`) dan 2 SOFT (`c_west_afternoon_heat_bedroom`, `c_tight_initial_budget`).
- **5 Canonical Scenarios:**
  1. `scen_west_facing_master_bedroom` -> Preferensi `sol_upvc_multi_chamber` (`STRONG_FIT`).
  2. `scen_large_living_sliding_door` -> Preferensi `sol_aluminium_standar` (`STRONG_FIT`).
  3. `scen_coastal_rain_exposed_facade` -> Preferensi `sol_upvc_multi_chamber` (`STRONG_FIT`).
  4. `scen_tight_budget_standard_renovation` -> Preferensi `sol_aluminium_standar` (`STRONG_FIT`).
  5. `scen_low_maintenance_family_home` -> Preferensi `sol_upvc_multi_chamber` (`STRONG_FIT`).
- **Golden Evidence Snapshot Hash:** `40a1b92e59e5f764a851d451240166dcf1ee7da9c1b3f9ff7900b868e82ef474`.

---

*Status Lanjutan: `PRODUCT_DECISION_ENGINE_1A_PASS`*
*Status Berikutnya: `READY_TO_IMPLEMENT_PRODUCT_DECISION_ENGINE_1B`*
