# 📋 EDITORIAL-PRODUCTION-DRYRUN-1 — First Full Editorial Workflow Dry Run Report

> **Kanonikal Milestone:** `EDITORIAL-PRODUCTION-DRYRUN-1`  
> **Status:** Dry Run Completed & Verified (Human Review Stop Gate Enforced)  
> **Baseline Commit:** `6c08ed9 fix(editorial): close quality pipeline integrity gaps`  
> **Tanggal Pelaksanaan:** 4 Oktober 2026  
> **Topik Naskah Baru:** *Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?*  
> **Otoritas:** 100% Fail-safe, Controlled Dry Run, Zero Autonomous Publishing, Zero Deployment  

---

## 1. Latar Belakang & Tujuan Dry Run

Milestone `EDITORIAL-PRODUCTION-DRYRUN-1` menjalankan uji coba alur kerja editorial penuh pertama (*first full editorial workflow dry run*) dari hulu ke hilir untuk memproduksi satu artikel RancangLoka baru dari nol (*from zero*), melibatkan seluruh peran staf editorial:
1. **Irwan (`evidence_researcher_lead`):** Riset fisika bangunan tropis dan penyusunan *Evidence Pack*.
2. **Joko (`content_writer_primary`):** Penulisan naskah langsung dalam bahasa Indonesia asli (*Native Indonesian Authoring*) dengan perspektif konsultan ahli untuk pemilik rumah.
3. **Rina (`editorial_qa_primary`):** Pengujian kualitas kepenulisan manusia (*Human Writing Quality Gate*) menggunakan rubrik kanonikal 100 poin.
4. **Gerbang Penghentian Manusia (*Human Stop Gate*):** Mengakhiri alur kerja pada status `HUMAN_REVIEW_REQUIRED` untuk peninjauan manual operator manusia tanpa publikasi otomatis.

Dry run ini **TIDAK** menambahkan lapisan teori baru dan **TIDAK** mengubah penalti atau ambang batas demi meloloskan artikel. Sistem dievaluasi murni berdasar arsitektur mutu yang telah distabilkan.

---

## 2. Invarian Keselamatan Operasi Kering (*Controlled Dry Run Invariants*)

Seluruh batasan keselamatan produksi mutlak aktif:
```text
automation_mode = OFF
SOCIAL_AUTOMATION = OFF
AUTO_PUBLISH = OFF
publishingAuthority = 0
JEV_MODE = shadow
mediaWorker = DISABLED
Jefry execution authority = 0
```
- **Nol Publikasi Otomatis:** Naskah tidak diterbitkan ke publik.
- **Nol Deployment:** Tidak ada eksekusi Cloudflare Workers / Wrangler deploy.
- **Nol Mutasi Database Produksi:** Data publik D1 dan naskah terbitan lama tidak dimutasi.

---

## 3. Tugas Editorial & Deteksi Intensi (Phase 1)

Pembuatan tugas editorial dry run (`scripts/dryrun/editorial-job.json`):
- **Task ID:** `task_dryrun_metal_roof_01`
- **Article Working ID:** `art_dryrun_metal_roof_01`
- **Topik Permintaan:** *Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?*
- **Hasil Deteksi Intensi (`detectArticleIntentProfile`):**
  - `primary_intent`: **`PROBLEM_SOLVING`**
  - `secondary_intents`: `['COMPARISON', 'EXPLANATORY']`
  - `confidence`: **`HIGH`**
  - *Sinyal:* Judul membingkai masalah riil hunian tropis dan membandingkan dua opsi intervensi termal.
- **Tahap Awal:** `researching` pada departemen `research` (Irwan).

---

## 4. Paket Bukti & Riset Irwan (Phase 2 & 3)

Irwan menyusun *Evidence Pack* teknis berbasis fisika bangunan tropis dan standar resmi (`scripts/dryrun/evidence-pack.json`):

### A. Inventaris Klaim & Klasifikasi
| ID Klaim | Pernyataan Fakta Teknis | Kelas Klaim | Rujukan Otoritatif |
| :--- | :--- | :---: | :--- |
| **CLM-001** | Atap metal (zincalume/galvalum) memiliki konduktivitas tinggi ($k \approx 50-60\text{ W/m}\cdot\text{K}$) dan massa tipis; suhu permukaan di bawah matahari tropis ($800-1000\text{ W/m}^2$) mencapai $60^\circ\text{C}-75^\circ\text{C}$. | `verified_fact` | SNI 03-6572-2001 & ASHRAE Handbook of Fundamentals |
| **CLM-002** | Perpindahan kalor ke rongga loteng dan plafon didominasi radiasi inframerah gelombang panjang ($75\% - 90\%$). | `technical_consensus` | BRE & BRANZ Thermal Performance of Roof Cavities |
| **CLM-003** | Aluminium foil bekerja sebagai *radiant barrier* ($\epsilon \le 0.05$, reflektansi $\ge 95\%$), tetapi **HANYA BERFUNGSI EFEKTIF bila berhadapan dengan rongga udara (*air gap*) minimal $20-25\text{ mm}$**. | `verified_fact` | ASTM C1371 & ASTM C1321 |
| **CLM-004** | Foil bukan insulasi massa (*bulk insulation*); nilai hambatan termal konduktifnya ($R$-value) hampir nol tanpa rongga udara. | `verified_fact` | ASHRAE Standard 90.1 & ASTM C727 |
| **CLM-005** | Di loteng tertutup tanpa ventilasi, udara panas terperangkap memanaskan plafon yang kemudian memancarkan panas sekunder ke ruang tidur hingga malam hari. | `inference` | Puslitbang Permukiman PU & ITB Lab Sains Bangunan |
| **CLM-006** | Ventilasi atap membuang akumulasi udara panas via efek cerobong (*stack effect*); rasio bukaan bersih ideal adalah $1:300$ hingga $1:150$ terhadap luas lantai loteng dengan bukaan seimbang di teritisan (*inlet*) dan bubungan (*outlet*). | `technical_consensus` | SNI 03-6572-2001 & IRC Section R806 |
| **CLM-007** | Ventilasi atap tropis wajib memiliki kisi penahan tampias hujan lebat dan kawat kasa anti-serangga; debu halus seiring waktu dapat meningkatkan emisivitas foil. | `recommendation` | Pedoman Teknis Bangunan Tropis & BRANZ 519 |
| **CLM-008** | Pada atap metal ekspos tanpa plafon, radiasi langsung mengenai penghuni; foil berpenopang kawat memberikan dampak instan pemotong radiasi (*radiant cut-off*). | `recommendation` | Panduan Desain Pasif Tropis |

### B. Batasan Ketat yang Ditetapkan Irwan:
- **Kepatuhan Monetary Silence Mutlak:** Dilarang melempar estimasi rupiah/biaya fiktif.
- **Anti-Fabrikasi:** Dilarang mengklaim hasil uji lab buatan sendiri atau testimoni personal palsu.
- **Larangan "Verdict":** Dilarang menggunakan istilah asing elitis.

---

## 5. Serah Terima Tugas Irwan → Joko (Phase 4)

Artefak serah terima tersimpan di `scripts/dryrun/handoff-irwan-joko.json`:
- `from_agent_id`: `evidence_researcher_lead` (Irwan)
- `to_agent_id`: `content_writer_primary` (Joko)
- `from_department_id`: `research` $\to$ `to_department_id`: `editorial`
- `from_stage`: `researching` $\to$ `to_stage`: `writing`
- `requires_movement`: `true` (perpindahan antar-departemen tercatat pada koordinat Pixel Office)
- `validation`: Lolos uji keselamatan handoff (`validateHandoffSafety`).

---

## 6. Penulisan Naskah Joko (Phase 5 & 6)

Joko menulis naskah secara penuh langsung dalam Bahasa Indonesia alami (`scripts/dryrun/draft-final.md`).

### Karakteristik Penulisan Joko:
1. **Bahasa Indonesia Asli (*Native Indonesian Authoring*):** Bersih dari wacana terjemahan literal bahasa Inggris (*anti-translationese*). Tidak menggunakan pola *"ketika datang ke"*, *"hadir dengan sejumlah fitur"*, atau *"dalam hal ini penting untuk memahami"*.
2. **Diagnosa Sebelum Resep:** Naskah tidak langsung menyuruh beli foil atau pasang turbin, melainkan membedah 3 jalur perpindahan panas (radiasi inframerah, konveksi udara loteng, konduksi plafon).
3. **Jawaban Tegas & Bersyarat:**
   - Menjelaskan rahasia celah udara minimal $20-25\text{ mm}$ agar foil berfungsi.
   - Menjelaskan mengapa foil yang dijepit rapat akan kehilangan sifat pemantul radiasinya.
   - Menjelaskan fenomena kantong udara panas loteng (*heat trap*) yang bertahan hingga malam hari.
4. **Keterbukaan Kompromi Fisik (*Transparent Trade-Offs*):** Memaparkan risiko tampias hujan lebat, penyusupan hama tikus/burung bila kawat kasa terabaikan, dan penurunan daya pantul akibat debu jangka panjang.
5. **Panduan Skenario Nyata:** Memisahkan 3 kondisi konkret (atap ekspos tanpa plafon, loteng tertutup berplafon, dan kamar lantai atas ber-AC).
6. **Langkah Pengecekan Mandiri:** 4 langkah pemeriksaan lapangan sebelum pemilik rumah mengeluarkan anggaran renovasi.

---

## 7. Evaluasi Mutu Rina QA (Phase 9 & 10)

Rina mengevaluasi naskah final menggunakan mesin deterministik `evaluateHumanWritingQuality` (`scripts/dryrun/qa-result-final.json`):

- **Knowledge Version:** `RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1`
- **Total Skor:** **100 / 100**
- **Keputusan Mutu:** **`HUMAN_WRITING_PASS`**
- **Status Kelulusan:** `passed = true`
- **Intensi Terdeteksi:** `PROBLEM_SOLVING`
- **Jumlah Cacat / Isu:** **0 (Nol)**

### Rincian Rubrik 100 Poin:
| Dimensi Rubrik | Skor Maks | Skor Diperoleh | Catatan Evaluator Rina |
| :--- | :---: | :---: | :--- |
| **Irama & Variasi Kalimat** | 20 | 20 | Kalimat pendek lugas berpadu dengan penjelasan analitis bertingkat. |
| **Spesifisitas Detail Teknis** | 15 | 15 | Angka fisik akurat ($60-75^\circ\text{C}$, celah $20-25\text{ mm}$, rasio $1:300$). |
| **Relevansi Kontekstual Tropis** | 15 | 15 | Terik kemarau, kelembapan malam, tampias hujan badai angin kencang. |
| **Suara Redaksional RancangLoka** | 15 | 15 | Bahasa orang rumah yang paham teknis bangunan. |
| **Struktur Non-Templat** | 10 | 10 | Alur mengalir organik tanpa pola simetri kaku. |
| **Integrasi Bukti & Standar** | 10 | 10 | SNI 03-6572-2001 dan hukum fisika perpindahan kalor terjalin rapi. |
| **Perspektif Pembaca Hunian** | 10 | 10 | Fokus pada kenyamanan tidur malam dan penghematan biaya renovasi. |
| **Orisinalitas Kesimpulan** | 5 | 5 | Menegaskan sintesis peran foil (radiasi) vs ventilasi (konveksi). |

---

## 8. Pengamatan Isu Ganda (*Multi-Issue Propagation Observation*, Phase 12)

Dalam simulasi pengujian draf mentah yang sengaja dibuat cacat dengan 4 pelanggaran sekaligus (`GENERIC_OPENING`, `EMPTY_GENERALIZATION`, `LACK_OF_LOCAL_CONTEXT`, dan `NEXT_ACTION_MISSING`), dilakukan audit terhadap transmisi metadata:

### Temuan Observasi:
1. **Evaluator Inti (`human-quality.ts`):** Berhasil mendeteksi seluruh 4 isu secara simultan dalam array `res.issues`, dan menyusun 4 butir tindakan perbaikan pada `res.rewrite_brief.required_actions`.
2. **Keterbatasan Field Tunggal (`quality_issue`):** Field `StructuredRewriteBrief.quality_issue` hanya menyimpan satu kode isu primer (`GENERIC_OPENING_DETECTED`).
3. **Dampak pada Task Handoff & Job Trace:** Field `quality_metadata.quality_issue` pada `TaskHandoffObservation` dan `details.quality_issue` pada `JobTraceEvent` hanya memuat satu string isu. Isu-isu sekunder tidak tampil pada ringkasan singkat kartu tugas (meskipun tersimpan utuh di array detail `brief`).
4. **Dokumentasi Kesenjangan:** Fenomena ini dicatat secara resmi sebagai **`MULTI_ISSUE_PROPAGATION_GAP`**. Pada iterasi arsitektur berikutnya, field ringkasan dapat diperluas menjadi `quality_issues: string[]` tanpa mengubah logika deterministik yang sudah ada.

---

## 9. Jejak Alur Kerja & Observabilitas Pixel Office (Phase 15)

Rekonstruksi kronologis tugas dry run melalui `job-trace.ts`:
- **`TASK_CREATED`:** Tugas dry run diinisialisasi untuk Irwan di departemen riset.
- **`HANDOFF`:** Penyerahan Evidence Pack dari Irwan ke Joko dengan bukti `evpack_metal_roof_heat_01`.
- **`STAGE_ENTERED` (`writing`):** Joko memasuki workstation penulisan di departemen editorial.
- **Status Operasional:** Karena `automation_mode = OFF`, status operasional tercatat secara jujur sebagai **`QUEUED`** (menunggu persetujuan manusia, tidak bekerja otonom tanpa izin).

---

## 10. Paket Peninjauan Manusia & Penghentian Mutlak (Phase 13 & 14)

Paket peninjauan manusia lengkap dikompilasi pada `scripts/dryrun/human-review-package.json`:
- **Status Alur Kerja:** **`HUMAN_REVIEW_REQUIRED`**
- **Ringkasan Evaluasi:**
  - Naskah siap ditinjau di `scripts/dryrun/draft-final.md`.
  - Skor QA: 100 (`HUMAN_WRITING_PASS`).
  - Nol pelanggaran integritas.
- **Self-Check Editorial:**
  - *Apakah terdengar asli bahasa Indonesia?* **YA.**
  - *Apakah terasa seperti ahli berbicara ke pemilik rumah?* **YA.**
  - *Apakah mendiagnosis sebelum memberi solusi?* **YA.**
  - *Apakah kompromi lapangan dijelaskan jujur?* **YA.**
  - *Apakah pembaca tahu apa yang harus diperiksa?* **YA.**
- **Penghentian Operasional:** Tidak ada publikasi ke Cloudflare D1/R2, tidak ada penjadwalan otomatis. Operator manusia memegang kendali penuh untuk meninjau naskah akhir.

---

## 11. Validasi Pengujian

Seluruh rangkaian pengujian (13 tes dry-run baru + seluruh suite regresi sistem) lolos 100%:

```bash
# 1. Editorial Production Dry Run Suite Baru (13 tes)
node scripts/test-editorial-production-dryrun.js  --> PASS (13/13)

# 2. Pipeline Integrity & Plumbing Audit (14 tes)
node scripts/test-editorial-pipeline-integrity.js --> PASS (14/14)

# 3. Expert Consultation Stabilization (22 tes)
node scripts/test-expert-consultation.js          --> PASS (22/22)

# 4. Native Indonesian Authoring (13 tes)
node scripts/test-native-indonesian-authoring.js  --> PASS (13/13)

# 5. Human Writing Quality Gate Core (22 tes)
node scripts/test-editorial-human-quality.js      --> PASS (22/22)

# 6. Safety SOAK-0 Suite (54 tes)
node scripts/test-soak-safety.js                  --> PASS (54/54)
```

---

## 12. Ringkasan Status Git

- **Branch:** `feat/jev-lokamedia-integration`
- **Commit Baseline:** `6c08ed9`
- **Artefak Dry Run Tercipta:**
  - `scripts/dryrun/editorial-job.json`
  - `scripts/dryrun/evidence-pack.json`
  - `scripts/dryrun/handoff-irwan-joko.json`
  - `scripts/dryrun/draft-v1.md`
  - `scripts/dryrun/draft-final.md`
  - `scripts/dryrun/qa-result-final.json`
  - `scripts/dryrun/human-review-package.json`
  - `scripts/test-editorial-production-dryrun.js`
  - `docs/EDITORIAL_PRODUCTION_DRYRUN_1.md`
- **Status Produksi:** Naskah tersimpan aman sebagai draf peninjauan manual; zero deployment; sistem stabil dan siap untuk peninjauan manusia.
