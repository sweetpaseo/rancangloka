# 📋 RancangLoka — Checkpoint LOKAMEDIA-DOM-CONTRACT-RECOVERY-1 & JOB-A RETRY STATE CLEANUP
## ChatGPT DOM Contract Recovery, Extension v0.1.2 Bump, and Job A Durable Reconcile

> **Checkpoint ID:** `LOKAMEDIA-DOM-CONTRACT-RECOVERY-1-CHECKPOINT-20261007`  
> **Timestamp:** `2026-10-07T16:45:00+07:00`  
> **Branch:** `feat/jev-lokamedia-integration`  
> **Extension Version:** `0.1.2` (Bumped from `0.1.1`)  
> **Target Job:** `mjob_9654a1ff6c242ce49711a664` (*Article A Featured Visual*)  
> **Classifications:**  
> - `PROVIDER_SUBMISSION_NOT_OCCURRED` (Forensic audit of failed run `run_1791360425560_0a89be9d`)  
> - `LOKAMEDIA_DOM_CONTRACT_RECOVERED` (Adapter fix & version 0.1.2 handshake)  
> - `LOKAMEDIA_JOB_A_RETRY_READY` (Clean durable state reconciliation & Run Once eligibility)  
> **Safety State:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, `Brave Search = OFF`, Zero Remote D1/R2 Mutations.

---

## 1. Ringkasan Eksekutif & Investigasi Forensik

Pada run `run_1791360425560_0a89be9d` untuk Job A (`mjob_9654a1ff6c242ce49711a664`), pipeline LokaMedia berhenti dengan status:
`PROVIDER_SUBMIT_START` $\to$ `PROVIDER_SUBMIT_FAIL = DOM_CONTRACT_UNSUPPORTED` $\to$ `RUN_FAILED = DOM_CONTRACT_UNSUPPORTED`.

### Temuan Forensik Inti:
1. **Bukti Ketidakterjadian Submisi (*PROVIDER_SUBMISSION_NOT_OCCURRED*)**:
   - Teks prompt **belum pernah dimasukkan** ke dalam composer ChatGPT.
   - Tombol kirim (*Send*) **belum pernah diklik**.
   - `media_job_events` = 0, `media_job_receipts` = 0, `attempt` = 0.
   - Tidak ada mutasi prompt atau gambar yang lolos ke sesi browser ChatGPT.
2. **Akar Masalah DOM Contract Failure**:
   - `selectors.js` secara kaku mencari `[contenteditable="true"]`, menolak variasi atribut ProseMirror ChatGPT modern.
   - `content-script.js` memvalidasi kehadiran `SEND_CONTROL_PRESENT` sebelum memasukkan prompt. Di UI ChatGPT terkini, input kosong menampilkan `button[data-testid="composer-speech-button"]` (Voice Mode) dan tombol kirim baru di-mount setelah teks terdeteksi di dalam editor.
3. **Cacat Konsistensi Precheck vs Submit**:
   - Precheck di `controller.js` melewati evaluasi live prepare (`provider.prepare(job)`), menghasilkan `PROVIDER_PRECHECK_PASS` palsu beberapa milidetik sebelum submit gagal.
4. **Semantik Gerbang Submisi**:
   - Gerbang konsumsi submisi (`submission_consumed`) diaktifkan terlalu dini sebelum bukti kirim nyata terkonfirmasi, menghalangi retry operator saat kegagalan kontrak DOM terjadi pra-kirim.

---

## 2. Solusi Rekayasa & Implementasi Adapter Generik

### A. Selektor Resilien & Adaptasi Kontrak DOM (`selectors.js` & `capability-detector.js`)
- Memperluas selektor composer dengan fallback semantik: `#prompt-textarea`, `div[contenteditable="true"][role="textbox"]`, `[data-testid="prompt-textarea"]`, dan textarea fallback.
- Mendukung transisi tombol dinamis: mendeteksi `composer-speech-button` saat kosong dan menunggu `button[data-testid="send-button"]` aktif setelah teks prompt diinjeksi.
- `detectChatGptCapabilities()` mengevaluasi status editable composer secara deterministik.

### B. Injeksi & Verifikasi Prompt Aman (`content-script.js`)
- Menggantikan injeksi mentah dengan struktur paragraf `<p>` ProseMirror disertai event native `input` dan `change`.
- Menambahkan fungsi `verifyComposerContent()`: memastikan teks prompt benar-benar berada di composer sebelum memicu klik send.
- Melarang keras injeksi berbasis clipboard.

### C. Gerbang Submisi Aman: ARMED != CONSUMED (`storage.js` & `controller.js`)
- Kegagalan sebelum prompt terkirim (`submission_escaped: false`) secara otomatis memanggil `disarmPhase4bSubmission()`, mengembalikan gerbang ke status `DISARMED` dan memungkinkan retry aman oleh operator.
- Kegagalan setelah prompt terkirim (`submission_escaped: true`) mempertahankan kunci duplikasi (`submission_consumed: true`) hingga rekonsiliasi manual.

### D. Version Bump & Handshake 0.1.2
- Patch version dinaikkan dari `0.1.1` ke `0.1.2`:
  - `extensions/lokamedia/manifest.json`: `"version": "0.1.2"`
  - `extensions/lokamedia/src/constants.js`: `EXTENSION_VERSION = '0.1.2'`
  - `extensions/lokamedia/src/background.js`: fallback `'0.1.2'`
  - `extensions/lokamedia/src/side-panel.html` & `side-panel.js`: `Extension v0.1.2 — CURRENT`
  - `src/lib/media/version.ts`: `EXPECTED_LOKAMEDIA_EXTENSION_VERSION` terhubung langsung ke `manifest.json`.

---

## 3. Rekonsiliasi Status Job A di Local D1

Untuk memulihkan Job A tanpa menghapus rekam jejak forensik:
1. Event historis dicatat secara permanen di tabel `media_job_events`:
   - `event_id`: `mevt_d02ab7f3a591359d0e222d5e`
   - `event_type`: `JOB_RECOVERING`
   - `stage`: `RECOVERY`
   - `attempt`: `0`
   - `safe_payload_json`: `{"historical_error_code":"DOM_CONTRACT_UNSUPPORTED","historical_message_safe":"ChatGPT DOM contract unsupported prior to prompt submission","recovery_action":"QUEUED","historical":true,"submission_occurred":false}`
2. Baris `media_jobs` diperbarui ke status retryable bersih:
   - `status = 'QUEUED'`
   - `lease_owner = NULL`
   - `lease_expires_at = NULL`
   - `heartbeat_at = NULL`
   - `last_error_code = NULL`
   - `last_error_message_safe = NULL`
   - `attempt = 0` (tetap 0, tidak direset destruktif)
   - `job_revision = 4`

---

## 4. Evaluasi Kelayakan Predikat Run Once (v0.1.2)

Evaluasi kanonikal `evaluateRunOnceEligibility()` membuktikan seluruh 13 predikat bernilai `true`:

1. `extension_enabled`: `true`
2. `runtime_version_current`: `true` (`0.1.2 === 0.1.2`)
3. `server_online`: `true`
4. `provider_connected`: `true`
5. `auth_ready`: `true`
6. `dom_supported`: `true`
7. `composer_ready`: `true`
8. `lane_idle`: `true`
9. `backpressure_off`: `true`
10. `no_transfer`: `true`
11. `submission_not_consumed`: `true`
12. `needs_attention_clear`: `true`
13. `waiting_featured_job`: `true`

**Hasil Evaluasi**: `{ eligible: true, reason: '' }` $\to$ Tombol **Run Once** berstatus **`ENABLED`**.

---

## 5. Hasil Verifikasi Pengujian Regresi

Semua pengujian lolos tanpa kegagalan:
- `scripts/test-lokamedia-dom-contract-recovery.js`: **9/9 PASS** (mencakup semua 9 kriteria kontrak DOM & pemulihan)
- `scripts/test-lokamedia-runonce-recovery.js`: **10/10 PASS**
- `scripts/test-lokamedia-side-panel.js`: **10/10 PASS**
- `scripts/test-lokamedia-phase3-extension.js`: **22/22 PASS**
- `scripts/test-lokamedia-phase4a-chatgpt-provider.js`: **6/6 PASS**
- `scripts/test-lokamedia-phase4b1a-5c2b-preflight.js`: **10/10 PASS**
- `scripts/test-media-a5-orchestrator.js`: **18/18 PASS**
- `scripts/test-media-a5-durable-retry.js`: **17/17 PASS**
- `scripts/test-media-a5-retry-policy.js`: **25/25 PASS**
- `npx tsc --noEmit`: **0 errors (Exit code 0)**

---

## 6. Status Akhir & Panduan Operator

- **Extension Side Panel**:
  - `Extension v0.1.2 — CURRENT`
  - `Connection: ChatGPT ready, RancangLoka online`
  - `Current: Jendela Berkondensasi... (Waiting)`
  - `Queue: Total 3, Active 0, Waiting 1, Done 0`
  - `Provider: connected, auth ready, DOM supported, composer ready, lane idle`
  - `Last error: none, Last action: Idle`
  - `Run Once`: **ENABLED**
- **Klasifikasi**: **`LOKAMEDIA_JOB_A_RETRY_READY`**
- **Tindakan**: Berhenti aman. Tombol Run Once siap dieksekusi secara terkontrol oleh operator manusia.
