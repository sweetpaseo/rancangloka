# 📸 RancangLoka — Checkpoint MEDIA-A5 (A5.1 – A5.4)
## Automated Media QA, Retry Policy, Durable Accounting & Pipeline Orchestrator

> **Checkpoint ID:** `MEDIA-A5-OFFLINE-CHECKPOINT-20260926`  
> **Timestamp:** `2026-09-26T13:20:00+07:00`  
> **Branch:** `feat/jev-lokamedia-integration`  
> **Starting HEAD:** `1b2123733cd450c62a5a46e5619b58d188bb2f04`  
> **Current HEAD:** `c9a62abfda275252189b1ff1d01acff5a638cd74`  
> **Status:**  
> - `MEDIA-A5.1 = PASS_LOCAL` (Commit `f24cd7a`)  
> - `MEDIA-A5.2 = PASS_LOCAL` (Commit `a008e82`)  
> - `MEDIA-A5.3 = PASS_LOCAL` (Commit `6cff6aa`)  
> - `MEDIA-A5.4 = PASS_LOCAL` (Commit `c9a62ab`)  
> - `READY_FOR_MEDIA_A5_5 = YES`  

---

## 1. Ringkasan Eksekutif

Milestone **MEDIA-A5** mengimplementasikan lapisan orkestrasi, jaminan mutu teknis otomatis (*Deterministic Technical QA*), kebijakan keputusan retry (*Retry Policy*), dan pencatatan state persisten (*Durable Retry Accounting*) untuk seluruh siklus hidup pembuatan media visual di ekosistem RancangLoka.

Seluruh fase A5.1 hingga A5.4 telah selesai, teruji 100% secara lokal, bebas efek samping terhadap produksi, dan siap untuk dilanjutkan ke fase **MEDIA-A5.5** (Worker daemon polling loop & live provider wiring) saat proyek diaktifkan kembali.

---

## 2. Rincian Fase Selesai (MEDIA-A5.1 s/d A5.4)

### A. MEDIA-A5.1 — Deterministic Technical Media QA Service (`src/lib/media/qa-service.ts`)
* **Tujuan:** Lapisan verifikasi integritas biner dan kualitas teknis yang deterministik dan bebas efek samping sebelum gambar diproses lebih lanjut.
* **Fitur Utama:**
  * **QA-0 (Artifact Integrity):** Deteksi biner kosong, header terpotong, payload error HTML/JSON, validasi magic bytes (PNG, JPEG, WebP), dan verifikasi SHA-256.
  * **QA-1 (Technical Quality):** Penegakan aturan dimensi spesifik peran (`featured`: min 1200×630 px; `inline`: min 600×338 px), rasio aspek, batas ukuran file (min 20 KiB, max 5 MiB).
  * **QA-2 (Provenance & Privacy Firewall):** Pemeriksaan provenance, firewall rahasia otomatis (redaksi Bearer tokens, API keys, cookies).
  * **QA-3/4/5 (Transform, Storage, Attachment Eligibility):** Evaluasi eligibilitas watermark, upload R2, dan mitigasi konflik slot artikel.
  * **Semantic QA Boundary:** Evaluasi semantik vision secara *fail-safe* defaulting ke `DEFERRED` (tidak pernah false `PASS`).
* **Pengujian:** `scripts/test-media-a5-technical-qa.js` (39/39 tes PASS).
* **Commit:** `f24cd7a` (`feat: add deterministic media QA contract`).

### B. MEDIA-A5.2 — Media Retry Classification & Pure Decision Policy (`src/lib/media/retry-policy.ts`)
* **Tujuan:** Mesin penentu kebijakan retry (*side-effect free*) yang menerjemahkan kode kegagalan menjadi rekomendasi aksi kanonikal.
* **Klasifikasi Retry:**
  * `RETRY_SAME_STAGE`: Retry pada stage yang sama (misal `WATERMARK_FAILED` di `TRANSFORM`, `R2_UPLOAD_FAILED` di `STORAGE`) tanpa mengulang pembuatan gambar upstream.
  * `RETRY_FROM_SOURCE`: Pengambilan ulang dari provider tanpa merubah prompt (misal `PROVIDER_TIMEOUT`, `PROVIDER_RATE_LIMIT`).
  * `RETRY_WITH_REPROMPT`: Re-prompting dengan parameter alternatif (misal kegagalan dimensi teknis pada autonomous provider).
  * `OPERATOR_REQUIRED`: Memerlukan intervensi manusia/editor (misal `PROVIDER_AUTH_FAILED`, `PROVIDER_CONTENT_REJECTED`, atau kegagalan pada `MANUAL_BROWSER_BRIDGE`).
  * `TERMINAL`: Kegagalan fatal non-retryable (kebocoran rahasia, kuota percobaan habis).
  * `NO_RETRY`: Kondisi bukan kegagalan atau aset terduplikasi yang dapat digunakan kembali.
* **Fitur Pendukung:** Perhitungan backoff eksponensial deterministik (`computeRetryDelay`) tanpa fungsi sleep/timer acak.
* **Pengujian:** `scripts/test-media-a5-retry-policy.js` (25/25 tes PASS).
* **Commit:** `a008e82` (`feat: add media retry decision policy`).

### C. MEDIA-A5.3 — Durable Retry Accounting & Decision Adapter (`src/lib/media/durable-retry.ts`)
* **Tujuan:** Jembatan antara kebijakan murni (`retry-policy.ts`) dan tabel persisten database SQLite/D1 (`media_jobs`, `media_job_events`, `media_job_receipts`).
* **Fitur Utama:**
  * **Normalisasi Attempt Kuota Generasi vs Stage:**
    * `media_jobs.attempt` HANYA bertambah untuk retry provider/generasi (`consume_attempt = true`).
    * Retry `TRANSFORM` dan `STORAGE` **TIDAK MENGKONSUMSI** kuota generasi (`consume_attempt = false`). Stage retries dihitung durabel dari tabel `media_job_events`.
    * Memecahkan celah arsitektur `ATTEMPT_COUNTER_GAP` tanpa mutasi skema/migrasi (`SCHEMA_CHANGE_REQUIRED = NO`).
  * **Proteksi Status Terminal:** Menolak pembukaan kembali pekerjaan yang sudah `COMPLETE`, `FAILED_TERMINAL`, `SUPERSEDED`, atau `CANCELLED`.
  * **Optimistic Concurrency Control (OCC):** Deteksi konflik `job_revision` untuk menggagalkan keputusan kadaluarsa (*stale decision safety*).
  * **Idempotensi Penjadwalan:** Mencegah konsumsi kuota ganda pada pengulangan payload yang sama.
  * **Firewall Redaksi Rahasia:** Memastikan string error yang disimpan di database bebas dari token atau kunci API.
  * **Kompatibilitas Event Legasi:** Fungsi penghitung stage retry mentolerir event lama dengan payload `null` atau tanpa `retry_stage`.
* **Pengujian:** `scripts/test-media-a5-durable-retry.js` (17/17 tes PASS).
* **Commit:** `6cff6aa` (`feat: integrate durable media retry decisions`).

### D. MEDIA-A5.4 — Media Pipeline Orchestrator & Local DI Runtime (`src/lib/media/orchestrator.ts`)
* **Tujuan:** Pengendali alur kerja terpadu (*single canonical orchestrator*) yang mengeksekusi pipeline media dari hulu ke hilir dengan injeksi executor lokal.
* **Fitur Utama:**
  * **Fungsi Utama:** `processMediaJob(db, jobId, options)`.
  * **Minimal Stage Resume:** Memanfaatkan cache artefak intermediat (`artifactStore`). Jika kegagalan terjadi di `TRANSFORM`, saat diulang proses langsung mulai dari `TRANSFORM` tanpa memanggil ulang `sourceExecutor`. Begitu juga kegagalan di `STORAGE` langsung melanjutkan di `STORAGE`.
  * **Single Policy Authority:** 100% evaluasi kegagalan didelegasikan ke `classifyMediaRetry` dan persistensi ke `applyMediaRetryDecision`. Tidak ada pemetaan status manual di orchestrator.
  * **Firewall Status Non-Runnable:** Otomatis memblokir eksekusi pada pekerjaan berstatus `COMPLETE`, `FAILED_TERMINAL`, `SUPERSEDED`, `CANCELLED`, `AUTH_REQUIRED`, `PROVIDER_BLOCKED`, atau `USER_ACTION_REQUIRED`.
  * **Recovery & Concurrency:** Memverifikasi kepemilikan lease (`deviceId`), masa berlaku lease (`lease_expires_at`), serta pemulihan pasca-crash sebelum atau sesudah persistensi keputusan.
  * **Safe Local Mock Executors:** Injeksi executor deterministik lokal untuk testing tanpa memicu API jaringan, provider berbayar, atau mutasi R2.
* **Pengujian:** `scripts/test-media-a5-orchestrator.js` (18/18 tes PASS).
* **Commit:** `c9a62ab` (`feat: integrate media retry orchestrator`).

---

## 3. Matriks Verifikasi & Hasil Uji Regresi

| Suite Uji | File Skrip | Jumlah Tes | Status |
| :--- | :--- | :---: | :---: |
| **A5.4 Media Orchestrator** | `scripts/test-media-a5-orchestrator.js` | 18 | **PASS** |
| **A5.3 Durable Retry Accounting** | `scripts/test-media-a5-durable-retry.js` | 17 | **PASS** |
| **A5.2 Retry Decision Policy** | `scripts/test-media-a5-retry-policy.js` | 25 | **PASS** |
| **A5.1 Deterministic Technical QA** | `scripts/test-media-a5-technical-qa.js` | 39 | **PASS** |
| **A4B.1 Article Media Detach** | `scripts/test-media-a4b1-detach.js` | 8 | **PASS** |
| **A4B Prep Canonical Attach** | `scripts/test-media-a4b-prep.js` | 9 | **PASS** |
| **A4A Prep Asset Registration** | `scripts/test-media-a4a-prep.js` | 10 | **PASS** |
| **A2 Artifact Normalization** | `scripts/test-media-a2-normalization.js` | 14 | **PASS** |
| **Media Delivery & Path Security** | `scripts/test-media-delivery-route.js` | 16 | **PASS** |
| **Canonical Publication Preflight State** | `scripts/test-publication-preflight-canonical-state.js` | 7 | **PASS** |
| **TypeScript Typecheck** | `npx tsc --noEmit` | - | **PASS (0 Error)** |
| **Astro Production Build** | `npm run build` | - | **PASS (Built in 4.7s)** |

---

## 4. Invarian Keamanan & Kondisi Produksi Terkini

* **Zero Production Mutation:**
  * `PRODUCTION_D1_MUTATIONS = 0`
  * `PRODUCTION_R2_MUTATIONS = 0`
  * `ARTICLE_MUTATIONS = 0`
  * `ARTICLE_MEDIA_MUTATIONS = 0`
  * `PUBLICATION_MUTATIONS = 0`
* **Zero Production Deployment:** `PRODUCTION_DEPLOYED = NO`
* **Zero Paid Provider Calls:** `FAL_API_CALLS = 0`, `PAID_PROVIDER_CALLS = 0`
* **Database Schema Migrations:** `0` (Tidak ada penambahan kolom/tabel baru).
* **Live Provider Generation Funding:** `DEFERRED_FUNDING` (Tetap aman tanpa pemanggilan live Fal.ai).

---

## 5. Panduan Melanjutkan Proyek (Next Steps — MEDIA-A5.5)

Ketika sesi pengerjaan kembali dibuka, langkah selanjutnya adalah:
1. **Target:** Implementasi **MEDIA-A5.5 (Worker Daemon Polling Loop & Live Adapter Contract Wiring)**.
2. **Fokus:**
   * Menghubungkan orchestrator `processMediaJob` ke daemon background worker / polling queue `/api/internal/v1/media/jobs/next`.
   * Integrasi adapter `fal-image-adapter.ts` dan browser bridge dalam mode contract verification (dry-run / mock) tanpa tagihan berbayar sebelum persetujuan operator.
   * Memastikan continuous heartbeat dan reconciler menangani lease timeout secara otomatis.
