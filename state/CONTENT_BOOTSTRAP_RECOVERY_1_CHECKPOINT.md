# 📋 RancangLoka — Checkpoint CONTENT-BOOTSTRAP-RECOVERY-1
## Research Discovery Precision, Free-First Architecture & Hermes Browser Free Web Fallback

> **Checkpoint ID:** `CONTENT-BOOTSTRAP-RECOVERY-1-CHECKPOINT-20261006`  
> **Timestamp:** `2026-10-06T16:50:00+07:00`  
> **Branch:** `feat/jev-lokamedia-integration`  
> **Baseline Commit:** `9ff6a1397842932edf204f93222d0b0472a0371e`  
> **Recovery Commit:** `7020fe8aaf4b4fa475646ee3d4d0d4cccc4a59d8` (`fix(editorial): improve free research discovery precision`)  
> **Milestones Covered:** `CONTENT-BOOTSTRAP-RECOVERY-1`, `CONTENT-BOOTSTRAP-1 (WAVE 1 FORENSIC)`  
> **Classification:** **`CONTENT_BOOTSTRAP_RECOVERY_PASS`**  
> **Stop Gate:** **`CONTENT_BOOTSTRAP_RECOVERY_1_HUMAN_REVIEW_REQUIRED`**  
> **Safety State:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, `Jefry execution authority = 0`, `Brave Search = OFF`

---

## 1. Ringkasan Eksekutif & Kegagalan Wave 1

Pada pelaksanaan awal sprint produksi konten **CONTENT-BOOTSTRAP-1 (Wave 1)**, sistem mengeksekusi 3 topik kandidat awal:
1. **Topik 1 (Popping Keramik)**: Query penemuan menghasilkan kandidat Wikipedia *"Earth shelter"* yang sama sekali tidak berhubungan dengan kegagalan lantai ubin.
2. **Topik 2 (Kaca Tempered vs Laminated)**: Query CrossRef menghasilkan makalah biomedis (infeksi spinal, kelumpuhan motorik) dan evaluasi perangkat lunak alih-alih sains material kaca arsitektur.
3. **Topik 3 (Shading Matahari Eksterior)**: Query CrossRef menghasilkan makalah kebijakan intervensi kesehatan publik HIV di Kenya Barat alih-alih fisika bangunan.

**Hasil Wave 1**: 3 dicoba, 0 lolos riset, 0 diteruskan ke Joko, 0 siap approval.  
Sesuai arahan keselamatan, **Wave 2 dibatalkan sementara** untuk menyelesaikan akar masalah tanpa melonggarkan satu pun gerbang kualitas bukti (*no weakened gates*).

---

## 2. Audit Forensik Kueri Wave 1 (Root Cause Forensic)

Audit mendalam terhadap perencana kueri mengungkap cacat majemuk (*compound defects*):
1. **Dominasi Istilah Editorial Generik (*Generic Editorial Dominance*)**:
   - Kata-kata seperti *"differential diagnosis"*, *"problem"*, *"causes physics"*, *"remediation effectiveness"*, *"mitigation"*, *"inspection"*, *"evaluation"*, dan *"strategy"* mendominasi kueri bibliografis CrossRef.
   - Di repositori medis/akademis luas seperti CrossRef, frasa *"differential diagnosis"* memicu pencocokan BM25 terhadap jurnal patologi dan infeksi klinis alih-alih diagnosa kegagalan bangunan.
2. **Kueri Kantong Kata yang Terlalu Panjang (*Over-literal Bag-of-Words*)**:
   - Kueri Wikipedia mencapai 77 karakter tanpa bobot entitas, memicu halaman ensiklopedia luas seperti *"Earth shelter"* karena mengandung kata *"floor"* dan *"substrate"*.
3. **Absensi Pemeringkatan Semantik & Konsistensi Domain**:
   - Kandidat hasil pencarian langsung dinilai berdasarkan kehadiran DOI tanpa memeriksa apakah domain dokumen adalah arsitektur/teknik sipil atau medis/ilmu komputer.

---

## 3. Arsitektur Pemulihan yang Diimplementasikan

### A. Provider-Specific Query Planner (`research-discovery-planner.ts`)
- Dekomposisi konsep kanonikal umum diekstrak tanpa hardcoding topik:
  - Pembersihan kata pengisi percakapan editorial (`CONVERSATIONAL_FILLERS` & `EDITORIAL_INTENT_TERMS`).
  - Pemetaan terminologi teknis bangunan (`TECHNICAL_VOCABULARY_MAP`): Glass, Glazing, Façade, Shading, Ceramic, Tiles, Substrate, Movement joints, Deflection.
  - Sanitasi istilah bibliografis (`sanitizeBibliographicTerms`) khusus untuk penyedia akademis CrossRef.
- Fungsi rendering kueri spesifik per provider (`renderProviderSpecificQuery`):
  - **`CROSSREF`**: Konsep material teknis ringkas (maks 4 istilah esensial tanpa kata editorial generik).
  - **`WIKIPEDIA`**: Entitas arsitektur ringkas (maks 2-3 konsep inti).
  - **`OPEN_WEB` / `HERMES_BROWSER`**: Frasa teknis natural terfokus.

### B. Filter Semantik Kandidat & Konsistensi Domain (`discovery-providers.ts` & `source-discovery.ts`)
- Fungsi `evaluateCandidateDomainConsistency`:
  - Mendeteksi sinyal domain arsitektur/sains bangunan (`BUILDING_DOMAIN_SIGNALS`).
  - Mendeteksi pola di luar domain (`OUT_OF_DOMAIN_PATTERNS`): biomedis, farmasi, genetika, kardiologi, onkologi, algoritma software, NLP.
  - Memberikan penalti -200 poin dan penolakan deterministik (`score = -1`) untuk kandidat medis/software yang mencoba merebut anggaran unduhan pada topik arsitektur.
- Evaluasi tumpang tindih konsep (*concept overlap score*) memastikan kandidat yang dipilih memiliki keterkaitan substantif dengan topik.

### C. Audit Kapabilitas Hermes Browser & Browser Discovery Provider
- **Audit Kapabilitas**:
  - Container Hermes memiliki tool browser dasar (`browser_navigate`, `browser_snapshot`, `browser_click`).
  - Namun, pengujian navigasi pencarian visual publik (Google Search) menghasilkan bot challenge / consent gate (`/sorry`), membuktikan bahwa *DOM scraping SERP* memiliki reliabilitas sangat rendah (`HIGH_RISK_UNSTABLE`).
- **Implementasi Terisolasi (`HermesBrowserDiscoveryProvider`)**:
  - Diimplementasikan mengikuti kontrak ketat `ResearchDiscoveryProvider` & `NormalizedCandidateMetadata`.
  - Dilengkapi deteksi CAPTCHA/bot-block otomatis yang mengembalikan `BROWSER_SEARCH_BLOCKED` secara fail-safe tanpa error fatal atau loop tak terbatas.
  - Setiap URL yang ditemukan oleh browser wajib melalui gerbang keamanan jaringan standar (`validateSafeUrl`, `validateSafeUrlAndDns`, socket-pinning SSRF protection). Snippet browser tidak pernah menjadi bukti (*evidence authority = 0*).

### D. Kebijakan Pencarian Bebas Biaya (Free-First Discovery Policy)
- Urutan prioritas pencarian:
  1. **CrossRef** (Metadata akademis/standar teknis terbuka)
  2. **Wikipedia EN / ID** (Ensiklopedia teknis bebas biaya)
  3. **OA Metadata & DOI Resolver** (Unpaywall / open-access resolution)
  4. **Hermes Browser Discovery** (Bila lingkungan mendukung tanpa blokade bot)
  5. **Brave Search API** (HANYA jika toggle admin `ACTIVE` dan API key valid terkonfigurasi)
- Invarian: Toggle Brave Search tetap `OFF`, jumlah request Brave strictly 0.

---

## 4. Hasil Verifikasi Pengujian

### A. Pengujian Unit & Regresi Deterministik (17/17 PASS)
Dijalankan melalui `scripts/test-content-bootstrap-discovery-recovery.js`:
- ✅ Test 1: Rekonstruksi dan forensik kueri Wave 1 terbukti akurat dan konsisten.
- ✅ Test 2: Istilah editorial generik berhasil disanitasi dari kueri CrossRef.
- ✅ Test 3: Rendering kueri spesifik per provider menghasilkan format terpisah yang sesuai target.
- ✅ Test 4: Topik keramik popping menolak kandidat *"Earth shelter"*.
- ✅ Test 5: Topik kaca arsitektural menolak kandidat biomedis (*spinal cord injury*).
- ✅ Test 6: Kandidat rekayasa kaca struktural menempati peringkat teratas.
- ✅ Test 7: Topik shading eksterior menolak kandidat intervensi kesehatan HIV.
- ✅ Test 8: Kandidat fisika bangunan dan efisiensi energi menempati peringkat teratas.
- ✅ Test 9: Kandidat relevan mempertahankan eligibilitas pengunduhan.
- ✅ Test 10: Pemeringkatan kandidat tidak memberikan otoritas bukti (*evidence authority = 0*).
- ✅ Test 11: Deteksi kapabilitas browser Hermes terverifikasi akurat.
- ✅ Test 12: Normalisasi kandidat browser mengikuti kontrak `NormalizedCandidateMetadata`.
- ✅ Test 13: Deteksi blokade CAPTCHA/bot browser mengembalikan kegagalan bersih `BROWSER_SEARCH_BLOCKED`.
- ✅ Test 14: Snippet hasil penemuan browser dilarang keras menjadi bukti (*authority = 0*).
- ✅ Test 15: URL hasil temuan browser wajib lolos validasi jaringan aman SSRF.
- ✅ Test 16: Toggle Brave Search tetap OFF dengan total 0 request keluar.
- ✅ Test 17: Logika produksi bebas dari hardcoding topik tertentu (*zero topic hacks*).

### B. Validasi Riset Live Satu Topik (Topic H: Kaca Tempered vs Laminated)
Dijalankan via `scripts/validate-discovery-recovery-live.js`:
- **Hasil Penemuan**:
  - 5 kandidat ditemukan: 2 standar SAE (CrossRef) + 3 halaman ensiklopedia Wikipedia (`Architectural glass`, `Glazing (window)`, `Insulated glazing`).
  - 3 sumber Wikipedia berhasil diunduh secara live dengan 55 kutipan terverifikasi.
  - **Nol kandidat medis/software yang lolos** (100% bebas dari kebocoran topik).
- **Penegakan Gerbang Kualitas**:
  - Karena standar SAE berada di balik paywall dan materi Wikipedia belum mencukupi untuk menjawab matriks komparasi teknis komprehensif, pipeline berhenti secara aman pada status `TOPIC_EVIDENCE_ALIGNMENT_FAIL`.
  - Membuktikan bahwa perbaikan sistem discovery **tidak melonggarkan gerbang bukti** dan tetap menolak fabrikasi klaim tanpa data empiris primer yang memadai.

---

## 5. Status Keamanan & Operasional

| Komponen | Status | Nilai Invarian |
| :--- | :--- | :--- |
| **Automation Controller** | OFF | `automation_mode = OFF` |
| **Social Automation** | OFF | `SOCIAL_AUTOMATION = OFF` |
| **Auto Publish** | OFF | `AUTO_PUBLISH = OFF` |
| **Publishing Authority** | 0 | Human-in-the-loop mutlak |
| **TypeSafe Jev** | Shadow | `JEV_MODE = shadow` |
| **Media Workers** | Disabled | Tidak ada mutasi media otomatis |
| **Brave Search** | OFF | Request count = 0 |
| **TypeScript Compilation** | Pass | `0 errors` |
| **Astro Production Build** | Pass | `Built in 7.04s` |

---

## 6. Rekomendasi Langkah Selanjutnya

1. **Review Manusia**: Menunggu persetujuan atas hasil pemulihan presisi discovery.
2. **Aktivasi Penyedia Web Terbuka**: Untuk topik perbandingan komparatif material spesifik yang membutuhkan dokumen teknis terbuka non-jurnal paywall, pertimbangkan mengaktifkan Brave Search API di panel admin atau menghubungkan instance SearXNG lokal.
3. **Persiapan Wave 2**: Setelah review disetujui, jalankan topik Wave 2 dengan filter presisi discovery yang telah diperbaiki.
