# 📋 RancangLoka — Checkpoint LOKAMEDIA-JOB-SCOPED-RUN-GATE-FIX-1
## Scoped Run Gate Isolation & Stale Error Propagation Hotfix

> **Checkpoint ID:** `LOKAMEDIA-JOB-SCOPED-RUN-GATE-FIX-1-CHECKPOINT-20261008`  
> **Timestamp:** `2026-10-08T07:55:00+07:00`  
> **Branch:** `feat/jev-lokamedia-integration`  
> **Extension Version:** `0.1.6` (Bumped from `0.1.5`)  
> **Active Target Job (Article B):** `mjob_9a381066fb65ee5dcbadbd51` (Article 8: *Thermal Bridge Kusen Aluminium...*)  
> **Protected Completed Job (Article A):** `mjob_9654a1ff6c242ce49711a664` (Article 7: *Jendela Berkondensasi...*)  
> **Classifications:**  
> - `LOKAMEDIA_JOB_SCOPED_GATE_FIX_PASS`  
> - `LOKAMEDIA_MULTI_JOB_ISOLATION_CONFIRMED`  
> - `ARTICLE_A_IMMUTABLE_PRESERVED`  
> - `ARTICLE_B_PRISTINE_QUEUED_CONFIRMED`  
> **Safety State:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, Zero Remote D1/R2 Mutations, Zero Image Generation for Article B during repair.

---

## 1. Ringkasan Masalah & Investigasi Forensik

### Gejala Masalah di UI Operator:
Saat operator membuka ekstensi LokaMedia v0.1.5 untuk memproses **Artikel B** (`mjob_9a381066fb65ee5dcbadbd51`), antarmuka side panel menampilkan status anomali:
- Tombol **`SEND TO CHATGPT`** dan **`RUN ONCE`** berstatus disabled (terkunci).
- Status panel menampilkan **`PHASE_4B_RUN_CONSUMED`**.
- Audit log mencatat **`RUN_GATE_CHECK_FAIL`** dengan error code `PHASE_4B_RUN_CONSUMED`.
- Bidang **Last error** menampilkan string **`INTERNAL_ERROR`**.

### Temuan Forensik Inti:
1. **Penyimpanan Extension Storage (LevelDB `000054.log`)**:
   - `phase4bSingleRun` tersimpan sebagai objek tunggal global milik **Artikel A**:
     ```json
     {
       "phase4b_single_run_id": "run_1791380727041_abddb752",
       "job_id": "mjob_9654a1ff6c242ce49711a664",
       "submission_consumed": true,
       "generation_consumed": true,
       "completed_at": "2026-10-07T13:46:38.639Z",
       "outcome": "complete"
     }
     ```
   - Database server/lokal D1 sudah bergeser ke **Artikel B**: `job_id = mjob_9a381066fb65ee5dcbadbd51`, `status = QUEUED`, `attempt = 0`, `lease_owner = null`.
2. **Cacat Evaluasi Gerbang Global Tanpa Lingkup Pekerjaan**:
   - `controller.js:sendToChatGpt()` memeriksa `gate?.submission_consumed || gate?.completed_at` secara global di baris 1015 sebelum mereferensikan pekerjaan target (`targetJob`). Akibatnya, status selesai Artikel A langsung memblokir setiap klik Send untuk pekerjaan baru manapun.
   - `controller.js:runOnce()` juga mengevaluasi `gate?.outcome === 'complete'` di baris 83 secara global tanpa memperhatikan apakah antrean lokal telah memuat job baru yang bersih.
3. **Penyebab `INTERNAL_ERROR` di Last Error**:
   - Poling latar belakang `refreshServerState()` sempat mengalami kegagalan sementara yang menyimpan `status.last_error = 'INTERNAL_ERROR'`.
   - Logika pembersihan error di baris 100 `background.js` hanya mencari substring `WorkerGlobalScope|Illegal_invocation|fetch|HTTP_\d+|SERVER_UNAVAILABLE|ECONNREFUSED` tanpa menyertakan `INTERNAL_ERROR`.
   - Gerbang Artikel A yang tertahan juga mencegah rekonsiliasi pembersihan error di blok `canSafelyClearGate`.
   - Akibatnya, `INTERNAL_ERROR` menjadi residu permanen yang membingungkan operator.

---

## 2. Arsitektur Perbaikan: Job-Scoped Gate Isolation

### A. Penyimpanan Gerbang Berlingkup Pekerjaan (`storage.js`)
- Menambahkan registry multi-pekerjaan `state.phase4bJobGates = {}` yang mengindeks gerbang secara unik berdasarkan `job_id`.
- `armPhase4bSingleRun({ jobId, runId })`:
  - Mengarsipkan gerbang aktif lama ke `state.phase4bJobGates[gate.job_id]`.
  - Memeriksa konsumsi secara spesifik pada `jobId`:
    ```javascript
    const gate = jobId ? (state.phase4bJobGates[jobId] || (state.phase4bSingleRun?.job_id === jobId ? state.phase4bSingleRun : null)) : state.phase4bSingleRun;
    if (gate && (!jobId || gate.job_id === jobId) && (gate.submission_consumed || gate.generation_consumed || (gate.completed_at && gate.outcome === 'complete'))) {
      return { armed: false, reason: 'PHASE_4B_RUN_CONSUMED', gate };
    }
    ```
  - Mendaftarkan gerbang baru di `state.phase4bJobGates[jobId]` dan menunjuk `state.phase4bSingleRun = newGate`.
- Seluruh mutasi gerbang (`disarmPhase4bSubmission`, `consumePhase4bSubmission`, `completePhase4bSingleRun`) terindeks ketat pada `job_id`.
- Rekor konsumsi Artikel A tidak pernah dihapus dan tidak dapat tertimpa oleh pekerjaan berikutnya.

### B. Rekonsiliasi Transisi Pekerjaan (`background.js`)
Saat poling mendeteksi pekerjaan baru berstatus aman server (`status === 'QUEUED'`, `attempt === 0`, `lease_owner === null`):
1. Gerbang Artikel A yang sudah selesai tetap diabadikan di `phase4bJobGates['mjob_9654a1ff6c242ce49711a664']`.
2. Pointer aktif `phase4bSingleRun` yang sebelumnya mengarah ke Artikel A dilepas (`nextState.phase4bSingleRun = null`) agar Artikel B memulai dengan status bersih (`submission_consumed = false`, `generation_consumed = false`, `error = null`).
3. Residu error `status.last_error` dibersihkan menjadi `null` sehingga UI menampilkan `none`.

### C. Resolusi Target & Gerbang Pada Eksekusi (`controller.js`)
- `sendToChatGpt()`:
  - Menyelesaikan `targetJob` terlebih dahulu.
  - Memeriksa apakah `targetJob.job_id` telah dikonsumsi di `phase4bJobGates[targetJob.job_id]`.
  - Jika belum (seperti Artikel B): eksekusi diizinkan berjalan normal.
  - Jika sudah (seperti Artikel A yang coba dijalankan ulang): menolak dengan `PHASE_4B_RUN_CONSUMED` dan mencatat `RUN_GATE_CHECK_FAIL`.
- `runOnce()`:
  - Mengidentifikasi identitas pekerjaan target.
  - Pekerjaan lama yang sudah `COMPLETE` tidak memblokir pekerjaan baru yang berstatus `QUEUED`.

### D. Perbaikan Kelayakan Antarmuka (`popup-core.js`)
- `evaluateRunOnceEligibility()` dan `getJobWorkflowDetails()`:
  - Mengambil gerbang yang cocok dengan `current.job_id`.
  - Untuk Artikel B: gerbang belum dikonsumsi, `isConsumed = false`, `stage = 'PROMPT READY'`, dan `can_send = true`.
  - Tombol `SEND TO CHATGPT` dan `RUN ONCE` aktif dan siap digunakan operator.

### E. Propagasi Error Bounded yang Akurat
- Residu `INTERNAL_ERROR` dibersihkan saat koneksi server online dan pekerjaan berstatus bersih `QUEUED`.
- String `PHASE_4B_RUN_CONSUMED` hanya disetel ke `status.last_error` jika pekerjaan target yang diminta memang sudah terkonsumsi.
- Untuk Artikel B, `status.last_error` adalah `null` (`none` di UI).

---

## 3. Version Bump: v0.1.6

Versi ekstensi dinaikkan secara sinkron dari `0.1.5` ke `0.1.6`:
- `extensions/lokamedia/manifest.json`: `"version": "0.1.6"`
- `extensions/lokamedia/src/constants.js`: `export const EXTENSION_VERSION = '0.1.6';`
- `extensions/lokamedia/src/background.js`: `RUNTIME_EXTENSION_VERSION = '0.1.6'`
- `extensions/lokamedia/src/side-panel.html`: `Extension v0.1.6 — CURRENT` dan `Runtime: v0.1.6`
- `extensions/lokamedia/src/side-panel.js`: Fallback diperbarui ke `'0.1.6'`
- `src/lib/media/version.ts`: Mengimpor `manifest.json` (`EXPECTED_LOKAMEDIA_EXTENSION_VERSION = "0.1.6"`).

---

## 4. Hasil Verifikasi & Uji Regresi

Seluruh pengujian lokal (6 suite, 52 tes) lulus 100%:

| Test Suite | Jumlah Tes | Hasil | Keterangan |
|---|:---:|:---:|---|
| `scripts/test-lokamedia-job-scoped-gate.js` | 4 | **PASS** | Membuktikan isolasi Job A $\to$ Job B $\to$ Job C tanpa hardcoding |
| `scripts/test-lokamedia-operator-ux-2.js` | 12 | **PASS** | Prompt preview, review card, isolasi versi 0.1.6 |
| `scripts/test-lokamedia-provider-tab-binding.js` | 6 | **PASS** | Keterikatan tab ChatGPT eksplisit & proteksi rerun Job A |
| `scripts/test-lokamedia-runonce-recovery.js` | 11 | **PASS** | Handshake versi 0.1.6 & pemulihan error |
| `scripts/test-lokamedia-side-panel.js` | 10 | **PASS** | Navigasi native side panel & kontrol UI |
| `scripts/test-lokamedia-dom-contract-recovery.js` | 9 | **PASS** | Kontrak DOM ChatGPT & handshake versi |
| `npx tsc --noEmit` | - | **PASS** | 0 TypeScript errors |

---

## 5. Pelestarian Invarian Produksi & Artikel

1. **Artikel A (Kondensasi Jendela - ID 7)**:
   - File cover produksi: `/media/images/b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp`
   - Hash naskah: `00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298`
   - Status: `published`, zero drift.
   - Status gerbang: Permanen dikonsumsi di `phase4bJobGates`, tidak dapat dipicu ulang.
2. **Artikel B (Thermal Bridge Kusen Aluminium - ID 8)**:
   - Local media job: `mjob_9a381066fb65ee5dcbadbd51`
   - Status lokal: `QUEUED`, `attempt = 0`, `lease_owner = null`.
   - Featured placeholder produksi: `ast_mfUpgVe99C_bq_p2d_O4Ge4L` (belum tersentuh).
   - Generasi gambar: **0 panggilan ke ChatGPT selama perbaikan**, tidak ada mutasi data Artikel B.

---

## 6. Panduan Tindakan Operator (Operator Reload)

1. Buka browser Chrome pada halaman manajemen ekstensi: `chrome://extensions/`.
2. Temukan ekstensi **RancangLoka LokaMedia** (`gbpnahdmddgbbkngdcnnfodmbhahckdm`).
3. Klik tombol **Reload** (🔄).
4. Buka kembali Side Panel LokaMedia.
5. Verifikasi label pada header menampilkan: **`Extension v0.1.6 — CURRENT`**.
6. Periksa kartu status Artikel B:
   - **Stage:** `PROMPT READY`
   - **Tombol `SEND TO CHATGPT`:** `ENABLED` (Warna aksen aktif)
   - **Tombol `RUN ONCE`:** `ENABLED`
   - **Last error:** `none`
