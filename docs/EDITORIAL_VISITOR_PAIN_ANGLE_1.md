# RancangLoka Editorial System — Visitor Problem Context & Opening Diversity
**Milestone:** `EDITORIAL-VISITOR-PAIN-ANGLE-1`  
**Status:** `HUMAN_VISITOR_PAIN_SELECTION_REQUIRED`  
**Authority:** Research (Irwan) & Content Writer (Joko) & Editorial QA (Rina)  
**Safety Governance:** Automation Mode `OFF`, Jev `shadow`, Publishing Authority `0`, Auto-Publish `OFF`.

---

## 1. Core Principle & Architectural Purpose

> *"Do not vary the sentence. Vary the human reason for seeking the answer."*

Pola pembuka artikel yang repetitif lintas korpus sering kali keliru diselesaikan dengan membuat kamus sinonim (*sentence spinner* atau *canned sentence bank*). Pendekatan tersebut dangkal karena hanya menukar kata tanpa mengubah motif naratif.

RancangLoka menerapkan pendekatan editorial berbasis **Visitor Problem Context**. Keragaman pembuka (*opening diversity*) lahir secara alami dari kombinasi:
```text
SEARCH INTENT
     ↓
VISITOR PROBLEM CONTEXT (Situational Specificity)
     ↓
PAIN / DECISION STATE (16 Pain Dimensions)
     ↓
OPENING ANGLE (18 Repertoire Angles)
     ↓
FRESH NATIVE INDONESIAN PROSE (Joko Authoring)
     ↓
ARTICLE NARRATIVE (Diagnostic & Decision-Support)
```

---

## 2. Visitor Problem Context Model

Model data kanonik merepresentasikan situasi nyata di balik pencarian pembaca tanpa melakukan pemrofilan personal (*no personal profiling*):

```typescript
export interface VisitorProblemContext {
  context_id: string;
  primary_problem: string;

  pain_dimension: PainDimension;
  secondary_pain_dimensions?: PainDimension[];

  pain_state: string;
  decision_state?: string;

  existing_condition?: string;
  failed_attempt?: string;

  timing_or_trigger?: string;
  property_context?: string;

  risk_or_concern?: string;
  desired_outcome?: string;

  knowledge_gap?: string;
  competing_options?: string[];

  confidence: 'LOW' | 'MEDIUM' | 'HIGH';

  basis: ReasoningBasis[];
  source_mode: SignalSourceMode;
}
```

### Prinsip Etika: Rasa Sakit (*Pain*) Sebagai Konteks Diagnosa, Bukan Manipulasi Pemasaran
RancangLoka **melarang keras** manipulasi emosi pembaca:
* Dilarang menggunakan *fear marketing*, *melodrama*, atau *fake urgency*.
* Dilarang membuat kutipan narasumber fiktif (*"kata Pak Budi..."*).
* Dilarang mengarang kunjungan lapangan palsu (*"kami mengunjungi rumah bapak di Bekasi..."*).
* Definisi *pain*: *"Masalah apa yang sedang ingin diselesaikan pembaca?"*, bukan *"Bagaimana menakut-nakuti pembaca?"*.

---

## 3. Taksonomi 16 Dimensi Masalah Pembaca (*Pain Taxonomy*)

1. **`PHYSICAL_DISCOMFORT`**: Ketidaknyamanan fisik ruang (panas menyengat di siang hari, silau, pengap).
2. **`FAILED_SOLUTION`**: Solusi yang sudah dicoba namun gagal (foil sudah dipasang tapi kamar tetap panas).
3. **`DECISION_UNCERTAINTY`**: Keraguan komparasi antar-sistem (bingung pilih foil vs ventilasi atap).
4. **`FINANCIAL_RISK`**: Kekhawatiran pemborosan anggaran renovasi untuk material yang salah.
5. **`PERFORMANCE_GAP`**: Kesenjangan performa aktual material dibanding klaim brosur toko.
6. **`MAINTENANCE_BURDEN`**: Beban pembersihan jangka panjang (debu halus di atas foil, pembersihan talang).
7. **`INSTALLATION_RISK`**: Risiko kesalahan pasang oleh tukang (misal foil dijepit tanpa *air gap*).
8. **`COMPATIBILITY_UNCERTAINTY`**: Keraguan kecocokan dengan struktur eksisting (baja ringan, plafon gipsum).
9. **`SAFETY_CONCERN`**: Keamanan instalasi listrik atau risiko tampias air hujan badai.
10. **`DURABILITY_CONCERN`**: Umur pakai, korosi sekrup atap, ketahanan terhadap hama.
11. **`ENERGY_COST`**: Lonjakan tagihan listrik akibat AC bekerja non-stop melawan radiasi plafon.
12. **`CLIMATE_FIT`**: Kesesuaian iklim tropis lembap dengan malam hari yang memerangkap panas.
13. **`RETROFIT_DIFFICULTY`**: Keterbatasan ruang renovasi pada rumah eksisting yang sudah dihuni.
14. **`INFORMATION_CONFLICT`**: Pertentangan saran antar-tukang, mandor, dan toko material.
15. **`DIAGNOSTIC_UNCERTAINTY`**: Pembaca merasakan gejala gerah tetapi tidak tahu letak sumber panasnya.
16. **`DESIRED_OUTCOME_GAP`**: Target hasil spesifik (menyejukkan kamar atas tanpa tambah AC).

---

## 4. Perbedaan Mendasar: Intensi Pencarian vs Kondisi Masalah (*Intent vs Pain*)

Satu *search intent* dapat menaungi banyak konteks masalah yang sangat berbeda:
* **Topik:** `Atap metal terasa panas`
* **Search Intent:** `PROBLEM_SOLVING` (Tunggal)
* **Plausible Visitor Pain Contexts:**
  * Kamar terasa membara di siang terik (`PHYSICAL_DISCOMFORT`).
  * Kamar tetap gerah di larut malam (`CLIMATE_FIT`).
  * Foil sudah dipasang namun kamar tetap panas (`FAILED_SOLUTION`).
  * Tagihan listrik AC melonjak tajam (`ENERGY_COST`).
  * Dilema belanja foil vs renovasi ventilasi (`DECISION_UNCERTAINTY`).
  * Takut membuang uang jutaan rupiah untuk peredam mubazir (`FINANCIAL_RISK`).
  * Disparitas suhu lantai 1 vs lantai 2 (`RETROFIT_DIFFICULTY`).
  * Atap seng dapur terbuka tanpa plafon (`PERFORMANCE_GAP`).
  * Saran tukang dan mandor saling bertolak belakang (`INFORMATION_CONFLICT`).
  * Tidak tahu apakah panas berasal dari radiasi atap atau udara loteng (`DIAGNOSTIC_UNCERTAINTY`).

---

## 5. Repertoar 18 Sudut Pembuka Naratif (*Opening Angle Repertoire*)

* `SENSORY_SCENE`: Deskripsi sensoris suasana fisik nyata di lapangan.
* `DIAGNOSTIC_MYSTERY`: Menelusuri teka-teki sumber panas yang sering salah ditebak.
* `DECISION_FORK`: Membuka langsung dari persimpangan dua pilihan belanja material.
* `COMMON_MISTAKE`: Mengangkat kekeliruan pemahaman umum yang sering terjadi di lapangan.
* `CONTRARIAN_INSIGHT`: Membongkar asumsi keliru (misal: tebal foil bukan penentu utama).
* `QUESTION_FIRST`: Membuka dengan pertanyaan diagnostik yang membimbing cara berpikir pembaca.
* `CONSEQUENCE_FIRST`: Mengangkat akibat langsung (misal: kamar panas berjam-jam setelah matahari terbenam).
* `OBJECT_FIRST`: Membuka dari perilaku fisik material penutup atap (seng tipis).
* `EXPERT_OBSERVATION`: Pengamatan pola kegagalan yang sering dijumpai di lapangan.
* `MYTH_CORRECTION`: Mengoreksi mitos toko bangunan.
* `COST_OF_WRONG_DECISION`: Menyorot kerugian biaya operasional (tagihan listrik AC).
* `BEFORE_AFTER_CONTRAST`: Kontras nyata antara dua kondisi (lantai 1 sejuk vs lantai 2 membara).
* `MICRO_SCENARIO`: Skenario mikro aktivitas penghuni (memasak di bawah atap terbuka).
* `SYSTEM_EXPLANATION`: Membuka dari interaksi antar-elemen atap.
* `TRADE_OFF_FIRST`: Membuka dari pertimbangan kompromi teknis.
* `LOCAL_CLIMATE_CONTEXT`: Membuka dari karakteristik cuaca kemarau tropis lokal.
* `MATERIAL_BEHAVIOR`: Membuka dari sifat hantar panas material konduktor.
* `FAILURE_AFTER_SOLUTION`: Membuka dari kekecewaan setelah renovasi selesai namun tidak efektif.

---

## 6. Sidik Struktur Pembuka & Memori Korpus (*Opening Signature & Anti-Template*)

Sistem menurunkan *structural flow signature* dari setiap draf pembuka:
* Contoh signature:
  * `SCENE > SYMPTOM > DIAGNOSIS`
  * `FAILED_FIX > CONTRADICTION > ROOT_CAUSE`
  * `DECISION > TRADEOFF > QUESTION`
  * `COST > SYMPTOM > ACTION`
  * `QUESTION > SYMPTOM > DIAGNOSIS`

### Analisis Ketergantungan Template Lintas Korpus
Fungsi `detectOpeningTemplateRepetition` memeriksa ketergantungan pola (seperti pembuka repetitif *"Banyak pemilik rumah..."* atau *"Di era modern..."*) bila muncul $\ge 3$ kali pada korpus artikel, **tanpa membatasi atau menghukum frasa alami bahasa Indonesia pada artikel tunggal**.

---

## 7. Rujukan 10 Kandidat Konteks & 10 Pembuka Kasus Atap Metal

Paket seleksi tersimpan pada file `scripts/dryrun/visitor-pain-package.json`.
Berikut adalah 10 kombinasi unik yang siap dipilih oleh Human Editor:

| ID Konteks | Dimensi Masalah | Sudut Pembuka (*Opening Angle*) | Sidik Alur (*Signature*) | Fokus Pembuka |
| :--- | :--- | :--- | :--- | :--- |
| `CTX-01` | `PHYSICAL_DISCOMFORT` | `SENSORY_SCENE` | `SCENE > SYMPTOM > DIAGNOSIS` | Puncak terik siang, kipas angin hanya memutar udara kering. |
| `CTX-02` | `CLIMATE_FIT` | `CONSEQUENCE_FIRST` | `SCENE > CONTRADICTION > ROOT_CAUSE` | Kamar tetap membara larut malam meski jendela dibuka lebar. |
| `CTX-03` | `FAILED_SOLUTION` | `FAILURE_AFTER_SOLUTION` | `FAILED_FIX > CONTRADICTION > ROOT_CAUSE` | Foil sudah dibeli dan dipasang, tetapi kamar tetap gerah (air gap). |
| `CTX-04` | `ENERGY_COST` | `COST_OF_WRONG_DECISION` | `COST > SYMPTOM > ACTION` | AC disetel 18°C kompresor menderu, tagihan listrik melonjak. |
| `CTX-05` | `DECISION_UNCERTAINTY` | `DECISION_FORK` | `DECISION > TRADEOFF > QUESTION` | Dilema belanja foil vs bobok sopi-sopi ventilasi atap. |
| `CTX-06` | `FINANCIAL_RISK` | `COMMON_MISTAKE` | `MISTAKE > COST > DIAGNOSIS` | Kekeliruan paling mahal: membeli material yang salah sasaran. |
| `CTX-07` | `RETROFIT_DIFFICULTY` | `BEFORE_AFTER_CONTRAST` | `SCENE > CONTRADICTION > DIAGNOSIS` | Naik tangga dari lantai 1 sejuk ke lantai 2 yang seperti sauna. |
| `CTX-08` | `PERFORMANCE_GAP` | `OBJECT_FIRST` | `OBJECT > SYMPTOM > ACTION` | Seng telanjang tanpa plafon di dapur belakang membakar kepala. |
| `CTX-09` | `INFORMATION_CONFLICT` | `DIAGNOSTIC_MYSTERY` | `CONTEXT > CONTRADICTION > ROOT_CAUSE` | 3 tukang memberi 3 saran yang saling bertolak belakang. |
| `CTX-10` | `DIAGNOSTIC_UNCERTAINTY` | `QUESTION_FIRST` | `QUESTION > SYMPTOM > DIAGNOSIS` | Apakah panas dari sengatan seng atau udara loteng terjebak? |

---

## 8. Pemisahan Bukti: Inferred Context vs First-Party Signals

Arsitektur dirancang kompatibel ke depan dengan `INTELLIGENCE-LAYER-1`:
* **Saat ini (`INFERRED_EDITORIAL_CONTEXT`):** Konteks diturunkan secara deterministik dari intensi pencarian, bahasa query, topik artikel, dan skenario hunian yang diketahui.
* **Masa depan (`OBSERVED_FIRST_PARTY_SIGNAL`):** Konteks dapat diperkaya dari sinyal riil first-party (riwayat pencarian internal, klik alat komparasi, navigasi Problem Solver).
* **Aturan Mutlak:** Sistem dilarang berpura-pura bahwa konteks inferensi berasal dari analitik pengunjung nyata.

---

## 9. Gate Persetujuan Manusia (*Human Selection Gate*)

Milestone ini secara sengaja **TIDAK MENGUBAH** file naskah `scripts/dryrun/draft-final.md`.  
Status pengoperasian berakhir pada gerbang:
**`HUMAN_VISITOR_PAIN_SELECTION_REQUIRED`**

Operator/Human Editor akan meninjau paket pada `scripts/dryrun/visitor-pain-package.json`, memilih satu *primary visitor context* dan satu *opening angle*, sebelum Joko diinstruksikan menulis revisi pembuka pada naskah utama.
