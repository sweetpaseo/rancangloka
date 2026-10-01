# 🌐 SOCIAL-S0: Social Media Automation Pipeline Architecture & Mission Control Integration Discovery

> **Milestone:** `SOCIAL-S0`  
> **Status:** `DISCOVERY & ARCHITECTURE COMPLETE`  
> **Mode:** `DISCOVERY + ARCHITECTURE ONLY` (Zero Production Mutations, Zero Schema Changes, Zero Deployments)  
> **Target System:** RancangLoka Editorial Platform, Hermes Mission Control, Pixel Office  
> **Date:** 1 Oktober 2026  

---

## 1. Executive Summary & Purpose

Milestone **SOCIAL-S0** menetapkan landasan arsitektur kanonik bagi sistem otomatisasi dan distribusi media sosial (**Social Media Automation Pipeline**) RancangLoka yang terintegrasi secara mulus ke dalam lapisan pengawasan dan komando **Hermes Mission Control**.

### Prinsip Utama (Core Guiding Invariants):
1. **Evidence-Based Origin:** Konten media sosial bukan entitas terisolasi yang mengarang topik acak. Semua konten sosial harus berakar secara deterministik dari artikel RancangLoka yang telah terbit resmi dan memiliki bukti kriptografis (*publication receipt*).
2. **Strict Presentation / Execution Decoupling:** Antarmuka visual (Mission Control & Pixel Office) adalah lapisan observabilitas dan kontrol. Visualisasi tidak memiliki wewenang eksekusi independen dan dilarang merekayasa animasi kerja tanpa tugas riil (*zero fake work*).
3. **Staged Safety Authority:** Otomatisasi sosial diawali dalam status **`SOCIAL_AUTOMATION = OFF`**. Penerbitan ke platform pihak ketiga membutuhkan persetujuan operator manusia (*human approval gate*) yang dapat diverifikasi secara auditabel.
4. **Vendor Neutrality:** Mission Control tidak boleh terikat (*tightly coupled*) pada API vendor spesifik (Meta, TikTok, X, dsb). Integrasi pihak ketiga diisolasi di balik lapisan adaptor platform kanonik (*Platform Adapter Boundary*).
5. **Zero Secret Leakage:** Token akses OAuth, rahasia aplikasi, dan kredensial webhook dilarang keras masuk ke D1 tanpa enkripsi, dilarang masuk ke payload telemetri Mission Control, dan dilarang tampil pada Pixel Office atau log publik.

---

## 2. Inventarisasi & Penemuan Repositori (Repository Discovery)

Berdasarkan audit komprehensif pada repositori dan artefak lokal, status kapabilitas terkait media sosial diklasifikasikan sebagai berikut:

| Komponen / Aset | Jalur / Referensi | Status Realitas | Keterangan & Batasan |
|---|---|---|---|
| **Departemen Social MC** | `src/lib/mission-control/department-registry.ts` | **PARTIAL** | Terdaftar dengan ID `social`, nama `Social & Distribution`, status `availability: 'NOT_AVAILABLE'`, `is_staffed: false`. |
| **Kapabilitas MC** | `src/lib/mission-control/capability-registry.ts` | **PARTIAL** | Terdaftar sebagai `SOCIAL_DISTRIBUTION`, `default_agent_id: null`, status `NOT_AVAILABLE`. |
| **Pixel Office Spatial Room** | `src/lib/mission-control/pixel-office.ts` | **PARTIAL** | Ruang `social_room` dialokasikan pada denah (`Zone S - Unstaffed Distribution Bay`), status ruangan `UNSTAFFED` ("Kapasitas Masa Depan"). |
| **Tautan Profil Publik & Share Bar** | `src/pages/admin/settings.astro`, `SocialShareBar.astro` | **IMPLEMENTED** | Pengaturan tautan profil sosial di footer (Instagram, TikTok, X, YouTube, Pinterest, LinkedIn) dan tombol share pembaca di artikel. Bersifat web front-facing statis. |
| **Penerbitan Artikel Web** | `src/lib/publication/publisher-service.ts` | **IMPLEMENTED** | Engine penerbitan artikel D1, pembuatan kuitansi publikasi atomik `publication_execution_receipts`. |
| **LokaMedia Engine (Aset Visual)** | `src/lib/media/`, Cloudflare R2 | **IMPLEMENTED** | Pipeline generasi & watermarking aset visual gambar artikel di R2. Pekerja media saat ini `DISABLED`. |
| **D1 Schema / Migrations** | `db/migrations/0001` - `0025` | **ABSENT** | Tidak ada tabel khusus distribusi media sosial di basis data remote/lokal Cloudflare D1. |
| **Cron Triggers Social** | `wrangler.toml`, `src/worker.ts` | **ABSENT** | Tidak ada cron trigger yang didedikasikan untuk antrean sosial. |
| **Prototipe Eksternal Facebook/Meta** | `facebook auto post/facebook-auto-bot-main` | **EXPERIMENTAL** | Proyek mandiri berbasis Next.js 16 + Supabase + Meta Graph API. Bukan bagian dari runtime Astro edge RancangLoka. |
| **Rencana Integrasi Hermes Awal** | `facebook auto post/RANCANGLOKA_SOCIAL_INTEGRATION_PLAN.md` | **DOCUMENTED_ONLY** | Dokumen eksplorasi awal mengenai Meta Graph API (Feed & Carousel). |
| **Kredensial Provider Sosial** | Lingkungan Produksi Cloudflare | **ABSENT** | Belum ada token rahasia Meta/X/TikTok yang dikonfigurasi di environment variables aktif. |

---

## 3. Titik Langganan Alur Konten (Current Content Pipeline Subscription Boundary)

### 3.1. Siklus Hidup Konten RancangLoka Saat Ini
```
[ Ideasi / Topik Arsitektur ]
            │
            ▼
[ Riset & Evidence Pack (Irwan) ] ── (SNI, ASTM, Riset Empiris)
            │
            ▼
[ Penulisan Naskah Draft (Joko) ] ── (Human Voice Layer v2, Anti-Slop)
            │
            ▼
[ Editorial QA & First Article Gate (Rina) ] ── (Kepatuhan Teknis & Monetary Silence)
            │
            ▼
[ Aset Visual LokaMedia (Budi) ] ── (Foto Realistis R2, Watermark Kanonik)
            │
            ▼
[ Persetujuan Redaksi / Approval ] ── (Status: Approved Draft)
            │
            ▼
[ Publication Planner & Auto-Policy (Sari) ] ── (Alokasi Jadwal & Kuota Harian)
            │
            ▼
[ Atomic Publication Dispatcher ] ── (Status Artikel: 'published')
            │
            ▼
[ publication_execution_receipts ] ── (Kuitansi Kriptografis Imutabel)
            │
            ▼
[ Telemetri & Decision Feedback (Dimas) ] ── (JEV Shadow Mode, Run Ledger)
```

### 3.2. Evaluasi Titik Cabang Distribusi Media Sosial
Kami mengevaluasi 4 kandidat titik integrasi:

1. **Opsi A: Approved Article (`articles.status = 'approved'`)**
   * *Risiko:* Artikel yang disetujui mungkin dijadwalkan tayang 3 hari mendatang. Menyiapkan posting sosial terlalu dini berisiko membocorkan embargo atau mempublikasikan link yang masih 404 jika jadwal website bergeser.
2. **Opsi B: Publication Execution Receipt (`publication_execution_receipts`) — [DIREKOMENDASIKAN]**
   * *Keunggulan Arsitektur:*
     - **Jaminan URL Hidup:** Kuitansi hanya terbit setelah transaksi atomik D1 selesai, memastikan artikel 100% aktif dan dapat diakses pembaca publik melalui `canonical_url`.
     - **Integritas Kriptografis:** Kuitansi memuat `content_hash` dan `featured_asset_id` imutabel, memastikan materi promosi sosial merujuk pada versi naskah final yang sah, bukan draft sementara.
     - **Zero Orphan Posts:** Mencegah risiko posting media sosial yang mengarahkan pembaca ke halaman kosong/rusak.
3. **Opsi C: Content Object Sebelum Publikasi (Hermes AI Lab / Draft Level)**
   * *Risiko:* Ditolak keras. Naskah pada tahap ini masih rentan terhadap revisi editorial, perbaikan klaim teknis, atau penolakan oleh Chief Editor.
4. **Opsi D: Event Schedulable Plan (`article_publication_plans`)**
   * *Fungsi:* Dapat digunakan secara opsional **hanya** untuk fase *pre-staging* (menyiapkan draf copy/slide di antrean internal), namun **bukan** untuk trigger publikasi publik.

**Keputusan Arsitektur Kanonik:**  
Pemicu kanonik untuk penciptaan kandidat distribusi sosial (*Social Distribution Candidate*) adalah pencatatan sukses pada tabel **`publication_execution_receipts`** (`outcome = 'SUCCESS'`).

---

## 4. Model Domain Pipeline Media Sosial (Social Pipeline Domain Model)

Model domain sosial dirancang modular, deterministik, dan bebas dari keterikatan vendor:

```
[ EVENT: publication_execution_receipts ]
                   │
                   ▼
       1. SOCIAL_CANDIDATE (Draf Masuk)
                   │
                   ▼
       2. SOCIAL_BRIEF_GENERATION (Ekstraksi Sudut Pandang & Key Takeaways)
                   │
                   ▼
       3. PLATFORM_VARIANT_ADAPTATION (FB Narrative, IG Aesthetic, Carousel Slides)
                   │
                   ▼
       4. MEDIA_DERIVATIVE_PREPARATION (Rasio 1:1, 4:5, 9:16 dari R2 Master Asset)
                   │
                   ▼
       5. CONTENT_QA_GATE (Monetary Silence, Link Verification, Anti-Slop Copy)
                   │
                   ▼
       6. HUMAN_APPROVAL_GATE (Operator Sign-Off)
                   │
                   ▼
       7. SCHEDULED_IN_OUTBOX (Antrean Terjadwal Aman)
                   │
                   ▼
       8. DISPATCH_TO_ADAPTER (Meta Graph API / Provider Lain)
                   │
                   ▼
       9. SOCIAL_EXECUTION_RECEIPT (Kuitansi Platform Imutabel)
                   │
                   ▼
      10. POST_PUBLICATION_MONITORING (Audit Link, Cek Status Berjalan)
```

### Entitas Domain Inti:
1. **`SocialCampaign`:** Entitas pengelompokan yang mengikat satu artikel induk (`article_id`, `receipt_id`) dengan seluruh variasi distribusinya di berbagai platform.
2. **`SocialPostVariant`:** Representasi naskah dan aset yang disesuaikan untuk target platform tertentu (misal: Facebook Post, Instagram Carousel, X Thread).
3. **`SocialMediaAsset`:** Turunan visual teroptimasi dari media master R2 (misal: feed square 1080×1080 px, carousel slide PNG, story portrait 1080×1920 px).
4. **`SocialPublicationSchedule`:** Penetapan jendela waktu rilis posting sosial dengan proteksi jeda minimum (*rate limiting & anti-flooding*).
5. **`SocialExecutionReceipt`:** Catatan kriptografis imutabel setelah posting berhasil terbit di platform target (menyimpan `post_id` eksternal, URL permanen, timestamp rilis, dan hash payload).

---

## 5. Batas Lapisan Adaptor Platform (Platform Adapter Boundary)

Untuk menjaga Mission Control tetap agnostik terhadap vendor, seluruh interaksi pihak ketiga diisolasi melalui antarmuka adaptor terpadu:

```typescript
export interface SocialPlatformAdapter {
  readonly platform_id: string; // 'meta_facebook' | 'meta_instagram' | 'tiktok' | 'x_twitter'
  readonly platform_name: string;
  
  // 1. Validasi spesifikasi teks, batasan karakter, dan kepatuhan media
  validatePayload(variant: SocialPostVariant): Promise<ValidationResult>;
  
  // 2. Persiapan media container (misal: Meta Container API)
  prepareMediaContainer?(asset: SocialMediaAsset): Promise<ContainerResult>;
  
  // 3. Dispatch publikasi resmi ke platform
  publish(payload: NormalizedSocialPayload): Promise<PlatformPublishResult>;
  
  // 4. Verifikasi status posting setelah penerbitan
  verifyStatus(externalPostId: string): Promise<PlatformStatusResult>;
}
```

### Batasan Penting:
* **Normalisasi Status:** Adaptor mengonversi kesalahan vendor (misal: Meta error code 190, 368) ke dalam kelas kesalahan kanonik RancangLoka (`AUTH_EXPIRED`, `RATE_LIMIT_HIT`, `MEDIA_INVALID`).
* **Zero Credential Exposure:** Objek Mission Control dan telemetri hanya menerima hasil status yang telah dinormalisasi; token akses OAuth tidak pernah dialirkan ke lapisan observabilitas.

---

## 6. Gerbang Keselamatan & Kontrol Otoritas Bertingkat (Safety Gates & Staged Authority)

Sistem distribusi sosial menerapkan prinsip kontrol bertingkat yang konsisten dengan *Publication Safety Engine* RancangLoka:

```
Tingkat 0: SOCIAL_AUTOMATION = OFF (Default Mutlak Saat Ini)
   └── Seluruh eksekusi posting ke luar jaringan diblokir 100%.
       Semua pipeline berhenti pada status DRAFT / READY_FOR_REVIEW.

Tingkat 1: SHADOW / DRY-RUN MODE
   └── AI mengadaptasi naskah dan slide grafis, divalidasi ke validator platform,
       namun pemanggilan API publikasi digantikan dengan kuitansi simulasi lokal.

Tingkat 2: APPROVAL_REQUIRED (Human-in-the-Loop)
   └── Postingan terjadwal HANYA dapat diterbitkan jika operator manusia telah
       menandatangani persetujuan secara eksplisit di Mission Control.

Tingkat 3: SCHEDULED_CONTROLLED
   └── Penerbitan otomatis terbatas pada jendela waktu tertentu dengan kuota harian ketat
       (maksimal 1-2 post/hari) dan saklar darurat aktif.

Tingkat 4: FULL_AUTONOMOUS (TIDAK DIIZINKAN PADA FASE INI)
```

### Invarian Bukti Persetujuan (Approval Invariant):
Sebuah postingan sosial dilarang keras terbit hanya karena:
* AI selesai membuat caption.
* Staf di Pixel Office menampilkan animasi bekerja.
* Scheduler mendeteksi waktu jam tayang tiba.
* Tugas berada dalam antrean.

Penerbitan wajib memverifikasi **`approval_signature`** yang sah dari operator terotentikasi.

---

## 7. Desain Departemen & Integrasi Hermes Mission Control

Berdasarkan arsitektur modular yang telah dibangun pada **HERMES-MC-7** (`department-registry.ts` dan `capability-registry.ts`), departemen media sosial diintegrasikan secara terstruktur tanpa mengubah *core engine*:

### 7.1. Definisi Departemen Kanonik
* **`department_id`:** `social`
* **`display_name`:** `Social & Distribution`
* **`description`:** *Adaptasi naskah artikel ke format media sosial multi-kanal, pembuatan carousel edukatif arsitektur, verifikasi kepatuhan visual, dan orkestrasi distribusi aman.*
* **`room_key`:** `social_room` (Area Distribusi Spasial Pixel Office)
* **`workstation_zone`:** `Zone S - Social Operations & Distribution Hub`

### 7.2. Tanggung Jawab Operasional Departemen:
1. **Content Adaptation:** Menulis rangkuman berbobot dari artikel tanpa nada clickbait murahan.
2. **Visual Derivative Coordination:** Memastikan rasio aspek foto sesuai standar feed dan slide carousel terbaca jelas di layar ponsel.
3. **Evidence & Monetary Check:** Memastikan kepatuhan ketat terhadap prinsip *Evidence-First* dan *Monetary Silence* (tidak menyebarkan estimasi harga fiktif di media sosial).
4. **Scheduling & Outbox Governance:** Menjaga ritme distribusi agar tidak terjadi spam atau kanibalisasi topik.
5. **Incident & Anomaly Reporting:** Melaporkan kegagalan token atau penolakan API ke papan anomali Mission Control.

---

## 8. Pemodelan Staf & Analisis Kesenjangan Kapabilitas (Staff Gap Analysis)

### 8.1. Evaluasi Staf yang Ada:
* **Joko (`content_writer_primary`):** Berfokus pada penulisan artikel web panjang (1500+ kata) berbasis panduan human voice. Kurang efisien jika dibebani penulisan mikro-copy multi-slide dan tagar sosial harian.
* **Budi (`lokamedia_worker_primary`):** Menangani pipeline gambar artikel editorial R2.
* **Rina (`editorial_qa_primary`):** Bertanggung jawab atas First Article Gate artikel web.
* **Sari (`publication_dispatcher_core`):** Operator dispatch website RancangLoka.

### 8.2. Rekomendasi Kapabilitas & Staf Masa Depan (Rencana Masa Depan - Belum Didaftarkan):
Untuk mencegah tumpang tindih tanggung jawab, departemen sosial memerlukan identitas mesin tersendiri saat diaktifkan:
* **Kandidat Mesin:** `social_distribution_operator`
* **Nama Tampilan Kanonik (Usulan):** `Maya` (atau label netral `Social Specialist`)
* **Peran:** *Social Content & Distribution Specialist*
* **Kapabilitas Baru:** `SOCIAL_COPY_WRITING`, `CAROUSEL_CURATION`, `SOCIAL_DISPATCH`

---

## 9. Integrasi Pixel Office & Lapisan Animasi Kerja (MC-9 Compatibility)

Sesuai aturan ketat **HERMES-MC-9** (*The Invariant of Real Work*):
* **No Real Task = No Working Animation:** Staf sosial masa depan tidak boleh terlihat sibuk mengetik atau membuat posting jika tidak ada tugas aktif di antrean.
* **Queued Tasks:** Tugas dalam status `QUEUED` menempatkan staf di Lounge (`IDLE_STANDBY`).
* **Running Tasks:** Tugas dalam status `RUNNING` menempatkan staf di meja kerja Zone S dengan animasi kerja yang relevan:
  - Penulisan copy sosial → `SOCIAL_COPYWRITING` (reusable atau pemetaan ke `ARTICLE_TYPING`).
  - Kurasi slide grafis → `MEDIA_REVIEW` (menggunakan kembali kunci animasi kanonik MC-9).
  - Dispatch posting → `PUBLICATION_MONITORING` / `PUBLICATION_DISPATCH`.
* **Selesai / Idle:** Kembali ke Lounge dengan secangkir kopi (`IDLE_STANDBY`).

---

## 10. Taksonomi Anomali & Eskalasi (MC-6 Integration)

Anomali media sosial dipetakan secara deterministik ke dalam engine anomali Mission Control:

| Kelas Anomali | Tingkat Keparahan | Departemen Pemilik | Tindakan Operator Diperlukan | Penanganan Sistem |
|---|---|---|---|---|
| `SOCIAL_AUTH_TOKEN_EXPIRED` | **ERROR** | `social` | Ya (Re-autentikasi OAuth di Pengaturan) | Hentikan antrean keluar, cegah retry loop tanpa batas. |
| `SOCIAL_RATE_LIMIT_EXCEEDED` | **WARNING** | `social` | Tidak (Otomatis) | Tunda rilis dengan backoff eksponensial terikat. |
| `SOCIAL_MEDIA_REJECTED` | **ERROR** | `social` | Ya (Periksa format/rasio gambar) | Tandai posting `BLOCKED`, beri tahu staf QA. |
| `SOCIAL_MONETARY_SILENCE_BREACH` | **CRITICAL** | `social` | Ya (Redaksi wajib meninjau teks) | Batalkan publikasi seketika (*fail-closed*). |
| `SOCIAL_DUPLICATE_POST_RISK` | **WARNING** | `social` | Ya (Konfirmasi operator) | Kunci postingan yang identik dalam kurun 24 jam. |

---

## 11. Arsitektur Aliran Event Menyeluruh (End-to-End Event Flow)

Alur terbagi tegas ke dalam 5 lapisan otoritas:

```
[ 1. DOMAIN PLANE ]
  Website Article Published ──► D1: publication_execution_receipts (outcome='SUCCESS')
                                              │
[ 2. CONTROL PLANE ]                          ▼
  Hermes Social Pipeline Ingestion ──► Buat SocialCandidate (Draft)
                                              │
  AI Transformer / Caption Writer ────► Draf Variasi FB/IG
                                              │
  Human Approval Sign-Off ───────────► Operator menandatangani rilis (Status: APPROVED)
                                              │
[ 3. EXECUTION PLANE ]                        ▼
  Scheduled Social Outbox ───────────► Verifikasi Safety Switch (AUTOMATION_MODE != OFF)
                                              │
[ 4. PROVIDER EDGE ]                          ▼
  Platform Adapter Boundary ─────────► Meta Graph API / Provider Call
                                              │ (Kuitansi Eksternal Diterima)
                                              ▼
[ 5. OBSERVABILITY PLANE ]
  D1: social_execution_receipts ─────► Update Status Varian = 'PUBLISHED'
                                              │
  Mission Control Telemetry Snapshot ─► Staff State = IDLE, Anomali = 0
                                              │
  Pixel Office ──────────────────────► Staf kembali ke Lounge (Animasi kerja berhenti)
```

---

## 12. Rencana Perubahan Model Data (Proposed Data Model Delta — Tanpa Migrasi)

*Catatan: Dokumen ini HANYA mendesain struktur tabel. Tidak ada file migrasi SQL yang dibuat pada milestone SOCIAL-S0.*

Entitas yang diusulkan untuk fase berikutnya:
1. `social_campaigns`: Mengikat `article_id`, `receipt_id`, status kampanye, dan timestamp pembuatan.
2. `social_post_variants`: Menyimpan teks spesifik platform, target platform (`facebook_page`, `instagram_business`), rasio media, dan status persetujuan.
3. `social_execution_receipts`: Kuitansi imutabel yang mencatat keberhasilan posting eksternal (`platform_post_id`, `permalink`, `published_at`, `payload_hash`).

---

## 13. Keamanan & Kebijakan Kerahasiaan (Zero Secret Leaks)

* **Penyimpanan Kredensial:** Token akses jangka panjang Meta (Page Access Token) disimpan secara eksklusif pada Cloudflare Environment Secrets terenkripsi atau tabel D1 yang dienkripsi pada tingkat aplikasi dengan kunci master PBKDF2/AES-GCM.
* **Isolasi Log:** Dilarang mencetak token otorisasi ke konsol debugging atau mencantumkannya dalam payload `details_json` di tabel publikasi.
* **Redaksi Rahasia:** Menggunakan modul `redact.ts` yang sudah teruji pada MC-1 untuk menyaring string menyerupai token (`EAAB...`, `EAA...`) dari seluruh feed aktivitas dan pesan chat operator.

---

## 14. Roadmap Terencana: Jalur Bertahap SOCIAL (Phased Roadmap)

```
[SOCIAL-S0] (SELESAI) — Discovery Arsitektur, Invarian Keselamatan, & Kontrak MC
     │
     ▼
[SOCIAL-S1] (BERIKUTNYA) — Model Domain Kanonik, Outbox Staging, & D1 Schema Drafting
     │
     ▼
[SOCIAL-S2] — Integrasi Departemen Social Mission Control & Pixel Office Spatial Bay
     │
     ▼
[SOCIAL-S3] — Adaptor Platform Pertama (Meta Graph API: Facebook Page & Instagram Business)
     │
     ▼
[SOCIAL-S4] — Pipeline Generator Slide Multi-Gambar (Satori / Carousel 1080x1080)
     │
     ▼
[SOCIAL-S5] — Pengujian Asap Produksi, Audit Keamanan Token, & Go-Live Terkendali
```

---

*Spesifikasi arsitektur ini diverifikasi dan disahkan pada 1 Oktober 2026 sebagai dokumen dasar resmi untuk inisiatif Social Media Automation RancangLoka.*
