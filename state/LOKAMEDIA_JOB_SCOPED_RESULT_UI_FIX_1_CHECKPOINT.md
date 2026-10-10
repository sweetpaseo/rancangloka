# 📋 RancangLoka — Checkpoint LOKAMEDIA-JOB-SCOPED-RESULT-UI-FIX-1
## Forensic + Repair Cross-Job Prompt / Result / Workflow State Leak

> **Checkpoint ID:** `LOKAMEDIA-JOB-SCOPED-RESULT-UI-FIX-1-CHECKPOINT-20261010`  
> **Timestamp:** `2026-10-10T20:15:00+07:00`  
> **Branch:** `feat/jev-lokamedia-integration`  
> **Extension Version:** `0.1.7` (Bumped from `0.1.6`)  
> **Target Job (Article B):** `mjob_9a381066fb65ee5dcbadbd51` (Article 8: *Thermal Bridge Kusen Aluminium...*)  
> **Protected Completed Job (Article A):** `mjob_9654a1ff6c242ce49711a664` (Article 7: *Jendela Berkondensasi...*)  
> **Classifications:**  
> - `ARTICLE_B_ALREADY_UPLOADED_RECONCILED`  
> - `LOKAMEDIA_JOB_SCOPED_RESULT_UI_FIX_PASS`  
> - `ARTICLE_A_IMMUTABLE_PRESERVED`  
> - `ARTICLE_B_LOCAL_ASSET_VERIFIED`  
> **Safety State:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, Zero Remote D1/R2 Mutations, Zero Additional Provider Submissions.

---

## 1. Ringkasan Investigasi Forensik

### Gejala Masalah:
Setelah perbaikan run-gate v0.1.6, operator berhasil mengirimkan prompt Artikel B ke tab ChatGPT yang terikat secara eksplisit. ChatGPT menerima prompt Artikel B dan memproduksi gambar jendela aluminium dengan junction detail kusen-kaca-dinding. Namun, antarmuka side panel LokaMedia menampilkan status yang tidak konsisten:
- **Active Stage:** `UPLOAD COMPLETE`
- **Prompt Preview Title:** *Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?* (Artikel A)
- **Prompt Text:** Naskah prompt lama Artikel A (kondensasi jendela)
- **Result Review:** *No image candidate captured*, tetapi menampilkan metadata dimensi `1770 × 889` dan SHA-256 `cb5c343af17ef91b13e63c23a818604040512ad6a79282ffd3d1c2520c956144` (SHA asli milik Artikel A).

### Temuan Forensik Inti:
1. **Penyelidikan Ekstensi (LevelDB Chrome `000126.log`)**:
   - Prompt Artikel B terbukti telah terkirim dan diterima secara valid:
     - `run_id`: `run_1791421093266_922c06a6`
     - `job_id`: `mjob_9a381066fb65ee5dcbadbd51`
     - `article_id`: 8
     - `prompt_hash`: `5ea3cfb98af3801bc61445e80dda3d964b9126bf1c0f966876a95762785a98e3`
   - Seluruh 16 event audit terekam lengkap: `RUN_GATE_CHECK_PASS`, `JOB_ACQUIRED`, `SUBMISSION_GATE_ARMED`, `SUBMISSION_GATE_CONSUMED`, `PROVIDER_PRECHECK_PASS`, `PROVIDER_PREPARE_PASS`, `PROVIDER_SUBMIT_START`, `PROVIDER_SUBMIT_ACCEPTED`, `GENERATION_OBSERVER_START`, `GENERATION_IMAGE_DETECTED`, `CAPTURE_START`, `CAPTURE_PERSISTED`, `UPLOAD_START`, `UPLOAD_RECEIVED`, `ATTACHMENT_CONFIRMED`, `JOB_COMPLETE`, `RUN_COMPLETE`.
2. **Penyelidikan Local D1 SQLite (`media_jobs`, `media_job_receipts`, `media_assets`, `article_media`)**:
   - `media_jobs`: Status `COMPLETE`, attempt 0, lease_owner `dev_chr_local`, revision 3, completed_at `2026-10-08 00:58:56`.
   - `media_job_receipts`: Tanda terima `UPLOAD_RECEIVED` dan `ATTACHMENT_CONFIRMED` untuk asset `ast_U0qJsAPBnIga9ExfH385kNUp` (SHA `f87275adaf3df50eb3a27982e54cf1fc9f5d27107e62560beff20da263613903`).
   - `media_assets`: Tercatat `ast_U0qJsAPBnIga9ExfH385kNUp`, PNG 1770 × 889, ukuran 2.327.052 bytes, status `VALIDATED`.
   - `article_media`: Row 8 terikat sebagai relasi featured aktif (`is_active = 1`).
   - Kesimpulan D1: Artikel B telah berstatus **`ARTICLE_B_COMPLETE`** dan terunggah penuh secara lokal.
3. **Akar Masalah Kebocoran UI**:
   - `resolveCurrentJob` memiliki bias short-circuit pada `state.currentJobId`. Ketika Artikel A selesai, `currentJobId` tertahan pada Artikel A dan mengabaikan antrean pekerjaan lain.
   - Tidak adanya pemodelan operasional terisolasi (`jobOperationalStates[job_id]`).
   - `side-panel.js` mengisi metadata DOM dimensi dan SHA secara terpisah dari pemeriksaan keberadaan blob fisik. Saat pemanggilan preview blob gagal (karena blob lokal Artikel A telah dihapus pasca-unggah), placeholder menampilkan string kegagalan ("No image candidate captured") sementara label teks di sekelilingnya tetap memuat dimensi dan SHA Artikel A.
   - Alur kerja (workflow stage) dievaluasi dari satu objek global yang bias ke Artikel A (`UPLOAD COMPLETE`).

---

## 2. Arsitektur Perbaikan

1. **Generic Operational State Model (`storage.js`)**:
   - Menambahkan struktur `state.jobOperationalStates[job_id]` pada storage ekstensi.
   - Menerapkan fungsi migrasi otomatis `migrateLegacyOperationalState` saat inisialisasi dan setiap pembaruan state.
   - Menambahkan API `getJobOperationalState(jobId)` dan `updateJobOperationalState(jobId, patch)`.
2. **Prioritas Resolusi Job Sehat (`popup-core.js`)**:
   - `resolveCurrentJob`:
     1. `explicitJobId` (jika diminta).
     2. In-flight active processing jobs (`SUBMITTING`, `GENERATING`, `IMAGE_DETECTED`, `CAPTURING`, `CAPTURED`, `UPLOADING`).
     3. Active armed non-completed gate job.
     4. Queued / waiting retry jobs (`QUEUED`, `WAITING_RETRY`).
     5. `currentJobId` hanya jika berstatus aktif/antrean.
     6. Rejected jobs.
     7. Most recently updated/completed job (Job B mengalahkan Job A berdasarkan timestamp terbaru).
3. **Isolasi Kepemilikan Prompt & Result (`popup-core.js` & `side-panel.js`)**:
   - Prompt preview, target dimensions (1315 × 660), slot, dan title di-resolve secara eksklusif dari job target aktif.
   - Candidate result wajib memvalidasi kepemilikan `candidate.job_id === targetJobId`.
   - Jika job aktif tidak memiliki kandidat, Result Review wajib mereset seluruh teks metadata ke strip (`--`) dan placeholder ke `No image candidate captured`.
4. **Isolasi Error (`side-panel.js`)**:
   - Error spesifik pekerjaan (`job_error`) hanya dirender untuk job yang bersangkutan. Residu error historis tidak pernah bocor ke job berikutnya.
5. **Version Alignment (`v0.1.7`)**:
   - `manifest.json`: `0.1.7`
   - `constants.js`: `0.1.7`
   - `background.js`: `0.1.7`
   - `side-panel.html`: `Extension v0.1.7 — CURRENT`
   - Handshake server di `version.ts`: `0.1.7`

---

## 3. Hasil Pengujian Regresi (7 Suite / 56 Tes)

1. `test-lokamedia-job-scoped-ui-state.js`: 4/4 PASS
2. `test-lokamedia-job-scoped-gate.js`: 4/4 PASS
3. `test-lokamedia-operator-ux-2.js`: 12/12 PASS
4. `test-lokamedia-provider-tab-binding.js`: 6/6 PASS
5. `test-lokamedia-runonce-recovery.js`: 11/11 PASS
6. `test-lokamedia-side-panel.js`: 10/10 PASS
7. `test-lokamedia-dom-contract-recovery.js`: 9/9 PASS
8. TypeScript Compiler (`npx tsc --noEmit`): **0 Error (PASS)**
