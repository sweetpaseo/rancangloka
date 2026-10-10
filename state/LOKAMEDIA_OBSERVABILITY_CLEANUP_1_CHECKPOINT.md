# 📌 LOKAMEDIA OBSERVABILITY CLEANUP-1 CHECKPOINT

**Tanggal:** 10 Oktober 2026  
**Status:** `LOKAMEDIA_OBSERVABILITY_CLEANUP_PASS`  
**Stop Token:** `LOKAMEDIA_OBSERVABILITY_CLEANUP_1_OPERATOR_RELOAD_REQUIRED`  
**Extension Version:** `0.1.9` (Bumped dari `0.1.8`)  
**Server Expected Version:** `0.1.9`  
**Active Branch:** `feat/jev-lokamedia-integration`

---

## 1. Baseline Diterima & Bukti Real-Browser Phase A

Pengujian browser riil membuktikan bahwa alur `SEND TO CHATGPT` berhenti secara deterministik pada batas persetujuan manusia (*Human Approval Boundary*):
- **Canary Job ID:** `mjob_0bc8a71e21f598f0272b11ce`
- **Run ID:** `run_1791645952427_44265789`
- **Candidate SHA-256:** `bad12f705a150e4181be108def8e2cab4fb059f6916c2403f028524d82597235`
- **Dimensi & Format:** `1672 × 941` PNG
- **Tahap Operasional:** `CAPTURED / RESULT READY`
- **Status Database D1 Lokal:** `status = LEASED`, `completed_at = null`, receipts = 0, media assets = 0, article attachments = 0.
- **Audit Log Browser:** Berhenti persis di event sequence 132 `RESULT_READY`. Tidak ada event pra-persetujuan ilegal (`HUMAN_APPROVAL_RECORDED`, `UPLOAD_START`, `UPLOAD_RECEIVED`, `ATTACHMENT_CONFIRMED`, `JOB_COMPLETE`).

---

## 2. Defect A: Root Cause & Perbaikan Timeout / Banner Stale

### A. Akar Masalah Timeout (RUN_ONCE_TIMEOUT)
- `side-panel.js` menggunakan timeout permintaan 15.000 ms (`send('RUN_ONCE', { runId }, { timeoutMs: 15000 })`).
- Generasi gambar ChatGPT nyata membutuhkan waktu rata-rata 25–35+ detik (eksekusi riil canary memakan waktu ~27 detik).
- Walaupun background worker terus berjalan dengan sukses hingga `RESULT READY`, promise di side panel mengalami timeout dini (`RUN_ONCE_TIMEOUT`) dan menampilkan banner status merah.
- Polling berikutnya (`refresh({ quiet: true })`) tidak membersihkan `#panel-status` karena flag `quiet: true` melewatkan `setStatus`.

### B. Perbaikan Timeout
- Menambahkan konstanta kanonikal `PROVIDER_OPERATION_TIMEOUT_MS = 120_000` di `extensions/lokamedia/src/constants.js`.
- Menggunakan `PROVIDER_OPERATION_TIMEOUT_MS` (120 detik) untuk operasi `RUN_ONCE` dan `SEND_TO_CHATGPT` di `side-panel.js`.
- Tidak mengubah semantik generasi provider, gerbang eksekusi, atau membuat retry otomatis pasca-timeout.

### C. Rekonsiliasi Banner Stale Berbasis Kondisi Otoritatif
- Menambahkan fungsi deterministik `reconcileStatusBanner(state, workflow, displayError)` di `side-panel.js`.
- Pola banner transien: `RUN_ONCE_TIMEOUT`, `SEND_TO_CHATGPT_TIMEOUT`, dan `Failed to fetch`.
- Tahap operator sehat: `PROMPT READY`, `RESULT READY`, dan `UPLOAD COMPLETE`.
- Ketika status autoritatif yang di-refresh membuktikan tahap sehat dan `last_error == null` pada pekerjaan aktif serta tidak ada error sistem aktif (`!displayError`), banner transien lama otomatis dibersihkan ke status `Ready` (`data-state="ok"`).
- Error aktual yang sah (seperti kegagalan pekerjaan aktif atau kegagalan koneksi server yang valid) tetap dipertahankan dan tidak disembunyikan.

---

## 3. Defect B: Root Cause & Perbaikan Provenance Versi Audit

### A. Akar Masalah Versi Audit Stale
- Saat ekstensi diinisialisasi (`storage.js:initialize()`), `state.extension_version` dari `chrome.storage.local` lawas (berisi nilai `"0.1.1"` dari instalasi awal) menimpa `DEFAULT_STATE.extension_version`.
- Akibatnya, `formatAuditText()` membaca `state.extension_version || '0.1.0'` dan mencatat `Extension Version: 0.1.1` alih-alih versi runtime aktif.

### B. Aturan & Perbaikan Version Provenance
- Menegakkan pemisahan otoritas:
  - `extension_version`: Otoritas runtime ekstensi (berasal dari `chrome.runtime.getManifest().version` atau konstanta kanonikal `EXTENSION_VERSION`). Tidak boleh ditimpa oleh penyimpanan lawas.
  - `expected_extension_version`: Otoritas handshake server RancangLoka (berasal dari respons media API terautentikasi). Ekstensi **dilarang merekayasa** ekspektasi server dari versi runtime-nya sendiri.
- Pada `storage.js` (`initialize()` dan `migrateLegacyOperationalState()`):
  `state.extension_version = EXTENSION_VERSION;`
  `state.expected_extension_version` dipertahankan dari histori terakhir atau bernilai `null` jika belum ada handshake (tidak ditimpa dengan versi runtime).
- Pada `side-panel.js` (`renderVersionHeader`):
  Menampilkan `CURRENT` hanya jika server online dan `expected_extension_version === runtimeVersion`. Menampilkan `RELOAD REQUIRED (Expected v...)` jika ada mismatch. Menampilkan `UNVERIFIED` jika server offline dan tidak ada ekspektasi yang diketahui (tanpa fabrikasi kompatibilitas).
- Pada `audit-log.js` (`formatAuditText()`):
  Mengimpor `EXTENSION_VERSION` dan mengekstrak `activeVersion` dari `chrome.runtime?.getManifest?.()?.version ?? state.runtime_extension_version ?? state.extension_version ?? EXTENSION_VERSION`.
- Versi protokol (`1`) dan DOM adapter (`1`) tetap independen.
- Event audit historis tetap dipertahankan tanpa mutasi.

---

## 4. Pelestarian Kandidat Canary & Pembatasan Persetujuan Manusia

- Kandidat binary canary (`bad12f705a150e4181be108def8e2cab4fb059f6916c2403f028524d82597235`) di IndexedDB tetap utuh dan berada pada tahap `RESULT READY`.
- Server D1 lokal untuk canary `mjob_0bc8a71e21f598f0272b11ce` tetap pada status `LEASED`, `completed_at = null`, receipts = 0, media assets = 0.
- Tidak dilakukan regenerasi, submit prompt ulang, approval, upload, atau mutasi data.
- Gerbang keselamatan Human Approval Boundary tetap 100% aktif (tes `test-lokamedia-human-approval-boundary.js` lulus 8/8).

---

## 5. Ringkasan Versi

- Versi Ekstensi Sebelumnya: `0.1.8`
- Versi Ekstensi Baru: `0.1.9`
- Penyesuaian patch versi `0.1.9` dilakukan pada:
  1. `extensions/lokamedia/manifest.json` (`"version": "0.1.9"`)
  2. `extensions/lokamedia/src/constants.js` (`EXTENSION_VERSION = '0.1.9'`)
  3. `extensions/lokamedia/src/background.js` (fallback runtime version `'0.1.9'`)
  4. `extensions/lokamedia/src/side-panel.html` (`Extension v0.1.9 — CURRENT` & `v0.1.9`)
  5. `extensions/lokamedia/src/side-panel.js` (fallback version `'0.1.9'`)
  6. `src/lib/media/version.ts` (mengimpor `manifest.json`, mengekspor `0.1.9`)

---

## 6. Hasil Pengujian & Regresi

1. `scripts/test-lokamedia-observability-cleanup.js`: **11 PASS / 11 TESTS**
   - Version alignment 0.1.9 & PROVIDER_OPERATION_TIMEOUT_MS (120s) across system
   - Provider operation exceeding 15s completes safely under new UI timeout
   - Genuine timeout beyond maximum surfaces error
   - Stale transient banners cleared on healthy operator states
   - Genuine job errors strictly preserved
   - Scenario A & E: Stale storage fixture "0.1.1" migrates to "0.1.9" without overwriting server expected_extension_version
   - Scenario D (Storage): Unconnected state leaves expected_extension_version null without fabricated compatibility
   - Scenario B (UI): Version mismatch (0.1.9 vs 0.1.8) displays RELOAD REQUIRED and is NOT CURRENT
   - Scenario C (UI): Matching versions (0.1.9 vs 0.1.9) with online server displays CURRENT
   - Scenario D & E (UI): Offline states correctly distinguish UNVERIFIED, RELOAD REQUIRED, and CURRENT (cached)
   - Scenario F: formatAuditText canonically reports Extension Version: 0.1.9 independent of server expected version
2. `scripts/test-lokamedia-human-approval-boundary.js`: **8 PASS / 8 TESTS**
3. `scripts/test-lokamedia-job-scoped-ui-state.js`: **4 PASS / 4 TESTS**
4. `scripts/test-lokamedia-job-scoped-gate.js`: **4 PASS / 4 TESTS**
5. `scripts/test-lokamedia-operator-ux-2.js`: **12 PASS / 12 TESTS**
6. `scripts/test-lokamedia-provider-tab-binding.js`: **6 PASS / 6 TESTS**
7. `scripts/test-lokamedia-runonce-recovery.js`: **11 PASS / 11 TESTS**
8. `scripts/test-lokamedia-side-panel.js`: **10 PASS / 10 TESTS**
9. `scripts/test-lokamedia-dom-contract-recovery.js`: **9 PASS / 9 TESTS**
10. `npx tsc --noEmit`: **PASS (0 ERRORS)**

---

## 7. Keselamatan Produksi & Lingkungan

- **Article A Produksi:** Tidak disentuh, tetap terlindungi (`/media/images/b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp`).
- **Article B:** Aset lokal tetap `LEGACY_AUTO_UPLOAD_COMPLETE`, tidak diunggah ulang.
- **Production D1 / R2:** Zero mutation, zero deploy, zero publish.
- **Invarian Sistem:** `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `JEV_MODE = shadow`.
