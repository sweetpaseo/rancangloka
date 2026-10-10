# 📋 RancangLoka — Checkpoint LOKAMEDIA-HUMAN-APPROVAL-BOUNDARY-1
## Stop Automatic Upload After Generation and Require Explicit Human Approval

> **Checkpoint ID:** `LOKAMEDIA-HUMAN-APPROVAL-BOUNDARY-1-CHECKPOINT-20261010`  
> **Timestamp:** `2026-10-10T21:55:00+07:00`  
> **Branch:** `feat/jev-lokamedia-integration`  
> **Extension Version:** `0.1.8` (Bumped from `0.1.7`)  
> **Legacy Auto-Upload Job (Article B):** `mjob_9a381066fb65ee5dcbadbd51` (`LEGACY_AUTO_UPLOAD_COMPLETE`)  
> **Protected Completed Job (Article A):** `mjob_9654a1ff6c242ce49711a664` (`/media/images/b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp`)  
> **Classifications:**  
> - `LOKAMEDIA_HUMAN_APPROVAL_BOUNDARY_PASS`  
> - `ARTICLE_B_ALREADY_UPLOADED_RECONCILED`  
> - `ARTICLE_A_IMMUTABLE_PRESERVED`  
> - `SERVER_FAIL_CLOSED_APPROVAL_ENFORCED`  
> **Safety State:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, Zero Remote Production D1/R2 Mutations, Zero Additional Submissions.

---

## 1. Analisis Cacat & Root Cause

### Kronologi Masalah:
Forensik dari eksekusi nyata Artikel B membuktikan bahwa siklus hidup sebelumnya berjalan sebagai berikut:
`PROVIDER_SUBMIT_ACCEPTED` → `GENERATION_OBSERVER_START` → `GENERATION_IMAGE_DETECTED` → `CAPTURE_START` → `CAPTURE_PERSISTED` → `UPLOAD_START` → `UPLOAD_RECEIVED` → `ATTACHMENT_CONFIRMED` → `JOB_COMPLETE` → `RUN_COMPLETE`.

Ini melanggar kontrak UX dan keselamatan editorial:
- Alur yang diinginkan operator adalah:
  `SEND TO CHATGPT` → `GENERATING` → `RESULT READY` → `HUMAN VISUAL REVIEW` → `APPROVE & UPLOAD` → `UPLOADING` → `UPLOAD COMPLETE`.
- Controller sebelumnya memanggil `this.storage.enqueueUpload` dan `this.uploads.drain()` secara otomatis begitu binary gambar tertangkap di `runJob` dan `_executeCaptureFromCheckpoint`, melompati gerbang persetujuan manusia.

---

## 2. Invarian Keras Batas Persetujuan Manusia

1. **Pemisahan State Eksplisit:**
   `GENERATED` != `CAPTURED` != `APPROVED` != `UPLOADED` != `FEATURED IN PRODUCTION`.
2. **Penghentian Pasca-Capture:**
   Setiap generasi ChatGPT yang berhasil wajib berhenti tepat di status **`RESULT READY`**.
3. **Larangan Otomatis:**
   Tindakan `UPLOAD_START`, server upload, media asset persistence, `article_media` attachment, dan `JOB_COMPLETE` **dilarang keras** berjalan tanpa klik eksplisit operator pada tombol `APPROVE & UPLOAD`.
4. **Tanggung Jawab `SEND TO CHATGPT`:**
   Hanya menyelesaikan job aktif, memvalidasi target tab ChatGPT terikat, mengunci provider submission gate, menyuntikkan prompt, mengamati generasi, menangkap binary kanonikal, menyimpan kandidat lokal, menghitung metadata, dan mengalihkan job ke `RESULT READY`.
5. **Aksi `REJECT RESULT`:**
   Menghapus blob lokal yang ditolak, mencatat rejeksi manusia (`HUMAN_REJECTION_RECORDED`), beralih ke `RESULT_REJECTED`, dengan zero upload, zero mutasi, dan gerbang submit tetap terkonsumsi tanpa regenerasi otomatis.
6. **Proteksi Duplikasi & Idempotensi:**
   Tombol `APPROVE & UPLOAD` dilindungi gerbang konsumsi bertingkat berdasarkan `job_id + candidate_sha256`. Panggilan ganda diblokir secara idempoten (`APPROVAL_ALREADY_CONSUMED`) dengan zero duplicate upload.
7. **Server-Side Fail-Closed Defense:**
   Endpoint `/api/internal/v1/media/upload` memvalidasi keberadaan `approval_record` untuk setiap permintaan dari ekstensi (`sourceType === 'lokamedia_extension'`). Permintaan tanpa approval record yang sah, atau dengan SHA-256 yang tidak cocok dengan binary yang diunggah, ditolak dengan kode status 403 / 422.

---

## 3. Komponen Perubahan

1. **Ekstensi LokaMedia:**
   - `manifest.json`: Versi dinaikkan ke `0.1.8`.
   - `src/constants.js`: `EXTENSION_VERSION = '0.1.8'`.
   - `src/background.js`: Sinkronisasi fallback versi ke `0.1.8`.
   - `src/side-panel.html`: Badge versi `Extension v0.1.8 — CURRENT`, penambahan tombol `approve-upload` dan `reject-result`.
   - `src/side-panel.js`: Integrasi handler `APPROVE & UPLOAD` dan `REJECT RESULT`, disabled state gates, dan fallback `0.1.8`.
   - `src/storage.js`: Penambahan `jobApprovals` dan `jobRejections`, metode `recordHumanApproval`, `getHumanApproval`, `consumeHumanApproval`, `recordHumanRejection`, serta event audit baru di `appendAuditEvent`.
   - `src/controller.js`:
     - Pemotongan upload otomatis pada `runJob` dan `_executeCaptureFromCheckpoint`, berhenti di `RESULT READY`.
     - Implementasi `approveAndUpload`: validasi job, stage, candidate SHA, konsumsi approval, enqueue upload, upload drain, dan transisi ke `UPLOAD_COMPLETE`.
     - Implementasi `rejectResult`: pembersihan blob lokal, pencatatan rejeksi manusia, zero upload, zero mutasi server.
   - `src/upload-worker-pool.js`: Meneruskan `job.approval_record` ke API client.
   - `src/api-client.js`: Melampirkan `approval_record` ke FormData upload.
   - `src/popup-core.js`: Evaluasi `can_approve_upload` yang memerlukan `stage === 'RESULT READY'`, unconsumed approval, dan un-uploaded candidate.

2. **Server Astro & D1 Media Model:**
   - `src/lib/media/jobs-service.ts`: Penambahan status `JOB_STATUS_AWAITING_REVIEW = 'AWAITING_REVIEW'` dan event audit baru (`RESULT_READY`, `HUMAN_APPROVAL_RECORDED`, `HUMAN_REJECTION_RECORDED`, `UPLOAD_APPROVAL_GATE_PASS`, `UPLOAD_APPROVAL_GATE_FAIL`).
   - `src/lib/media/service.ts`: Penambahan `AWAITING_REVIEW` pada state in-progress dan validasi `approvalRecord.candidate_sha256` pada service upload.
   - `src/lib/media/readiness-reconciler.ts`: Penambahan `AWAITING_REVIEW` pada state in-progress.
   - `src/pages/api/internal/v1/media/upload.ts`: Validasi fail-closed `approval_record` untuk unggahan dari ekstensi.

---

## 4. Hasil Verifikasi Pengujian

| Test Suite | File | Jumlah Tes | Status |
| :--- | :--- | :--- | :--- |
| **Human Approval Boundary Suite** | `scripts/test-lokamedia-human-approval-boundary.js` | 8 tes | **PASS** |
| **Job-Scoped UI State Suite** | `scripts/test-lokamedia-job-scoped-ui-state.js` | 4 tes | **PASS** |
| **Job-Scoped Run Gate Suite** | `scripts/test-lokamedia-job-scoped-gate.js` | 4 tes | **PASS** |
| **Operator UX 2 Suite** | `scripts/test-lokamedia-operator-ux-2.js` | 12 tes | **PASS** |
| **Provider Tab Binding Suite** | `scripts/test-lokamedia-provider-tab-binding.js` | 6 tes | **PASS** |
| **Run Once Recovery Suite** | `scripts/test-lokamedia-runonce-recovery.js` | 11 tes | **PASS** |
| **Side Panel Core Suite** | `scripts/test-lokamedia-side-panel.js` | 10 tes | **PASS** |
| **DOM Contract Recovery Suite** | `scripts/test-lokamedia-dom-contract-recovery.js` | 9 tes | **PASS** |
| **TypeScript Typecheck** | `npx tsc --noEmit` | 0 errors | **PASS** |

---

## 5. Status Artikel Terkait

1. **Artikel B (`mjob_9a381066fb65ee5dcbadbd51`):**
   - Diakui dan dicatat sebagai `LEGACY_AUTO_UPLOAD_COMPLETE`.
   - Tidak dilakukan regenerasi, tidak dilakukan re-upload, dan tidak dimutasi ke produksi.
   - Asset lokal: `ast_U0qJsAPBnIga9ExfH385kNUp` (SHA `f87275adaf3df50eb3a27982e54cf1fc9f5d27107e62560beff20da263613903`).
2. **Artikel A (`mjob_9654a1ff6c242ce49711a664`):**
   - Tetap 100% terjaga dan immutable di produksi (`/media/images/b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp`).
