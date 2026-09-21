# 📜 History & Progress Catatan Proyek Rancangloka

Dokumen ini mencatat seluruh riwayat permasalahan, akar penyebab, solusi teknis yang telah diterapkan, serta status progres terkini dari platform media editorial **Rancangloka**.

---

## 🏗️ 1. Arsitektur & Spesifikasi Proyek
* **Framework:** Astro 4 (SSR Mode dengan `@astrojs/cloudflare` adapter)
* **Styling:** Tailwind CSS (Apple Minimalist Aesthetic & Dark Mode Support)
* **Compute & Hosting:** Cloudflare Workers CI / Cloudflare Edge Runtime
* **Database (Relational):** Cloudflare D1 (SQLite Edge) — Database: `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`)
* **Object Storage:** Cloudflare R2 Bucket — `rancangloka-media`
* **Keamanan:** Kriptografi PBKDF2 SHA-256 (100.000 iterasi) + Cloudflare Zero Trust (Access)
* **SEO & Performa:** Skor PageSpeed 90-100 (Google News Sitemap, RSS XML, Schema.org, WCAG AA Contrast)

---

## 🛠️ 2. Log Masalah & Solusi (Problem & Resolution History)

### LokaMedia Phase 5L12B Canonical Automation Operator Control Foundation 2026-09-22

- **Tujuan & Ruang Lingkup:** Implementasi fondasi kontrol operator kanonikal terotentikasi dan teraudit secara lokal untuk perubahan mode otomasi global (`automation_control.mode`) dan jadwal otomatis (`settings.auto_schedule_enabled`), menutup celah ketergantungan pada direct SQL yang ditemukan pada Phase 5L12/5L12A.
- **Fondasi Skema Audit Terdedikasi:**
  - Menambahkan migrasi aditif `0020_automation_control_audit.sql` yang membuat tabel `automation_control_audit` dengan indeks performa untuk pencatatan riwayat kontrol-plane (`AUTOMATION_MODE_CHANGED`, `AUTO_SCHEDULE_CHANGED`) lengkap dengan `actor_id`, `actor_role`, `source`, `previous_value`, `new_value`, `reason`, `correlation_id`, `details_json`, dan timestamp.
- **Service Layer Kanonikal & Atomisitas Batch:**
  - Mengimplementasikan `changeAutomationMode` dan `changeAutoSchedule` pada `src/lib/safety/automation-controller.ts` dengan garansi eksekusi atomik batch via `db.batch([updateStmt, auditStmt])`.
  - Fail-closed: Jika penulisan audit gagal, mutasi mode dibatalkan sepenuhnya (`AUDIT_FAILURE_FAILS_CLOSED=PASS`).
  - Idempoten: Permintaan transisi identik (misal `OFF → OFF`) mengembalikan status `changed: false` tanpa memicu pencatatan audit redundan (`MODE_NOOP_TEST=PASS`).
  - Menjaga independensi flag: Perubahan mode tidak mengubah `auto_schedule_enabled`, `kill_switch_engaged`, `planner_paused`, atau `publisher_paused`.
- **Rute HTTP API Operator Terproteksi:**
  - Membuat endpoint kanonikal `POST /api/admin/publication/automation/control`.
  - Keamanan: Wajib sesi admin terotentikasi (`isValidAdminSession`), pertahanan CSRF lintas origin (`verifySameOrigin`), penolakan mutlak kredensial perangkat media (`MEDIA_DEVICE_FORBIDDEN: 403`), dan penolakan mutlak `CRON_SECRET` (`CRON_SECRET_FORBIDDEN: 403`).
  - Mendukung inspeksi status dan audit terkini via `GET /api/admin/publication/automation/control`.
  - Integrasi Observabilitas: Status kontrol dan 5 event audit terkini diintegrasikan ke dalam snapshot `getPublicationOperationsStatus`.
- **Verifikasi & Regresi:**
  - Menjalankan test suite baru `scripts/test-phase5l12b-canonical-operator-control.js` (15/15 PASS).
  - Seluruh 9 test suite regresi yang telah ada (Phase 5L2, 5L3, 5L4, 5L6, 5L6A, 5L9, 5L10, readiness, soak safety) lulus 100%.
  - Typecheck (`tsc --noEmit`), build Astro, dan dry-run Wrangler seluruhnya PASS.
- **Firewall Produksi & Langkah Selanjutnya:**
  - Produksi tetap berada pada mode aman `OFF`, `auto_schedule_enabled=false`, `kill_switch=0`. Nol mutasi pada D1/R2 produksi. Belum dideploy ke produksi.
  - Siap untuk fase deployment produksi migrasi 0020 dan kode kontrol kanonikal (`READY_FOR_CANONICAL_CONTROL_PRODUCTION_DEPLOYMENT=YES`).

### LokaMedia Phase 5L12A Production Control-Path Integrity Closure 2026-09-22

- **Tujuan & Ruang Lingkup:** Audit read-only terhadap integritas jalur kontrol produksi pasca Phase 5L12. Menyelidiki dan mengoreksi catatan historis mengenai mekanisme mutasi mode otomasi (`automation_control.mode`) dan status rekonsiliasi tabel audit (`publication_operator_audit`).
- **Temuan & Rekonsiliasi Jalur Kontrol:**
  - **Mekanisme Aktual Mutasi 5L12:** Transisi mode (`OFF → OBSERVE_ONLY` dan `OBSERVE_ONLY → OFF`) pada Phase 5L12 dilakukan melalui eksekusi remote SQL langsung ke tabel `automation_control`, bukan melalui rute HTTP operator API kanonikal (`ACTIVATION_MODE_CHANGE_ACTUAL_MECHANISM=DIRECT_SQL`, `RESTORE_MODE_CHANGE_ACTUAL_MECHANISM=DIRECT_SQL`).
  - **Status Audit Operator:** Tabel `publication_operator_audit` memiliki total 0 baris (`AUDIT_MISSING`). Hal ini karena skema `CHECK (event_type IN (...))` pada tabel tersebut hanya mendukung event manual hold, return to draft, toggle auto schedule, dan pembatalan plan, tanpa event untuk perubahan mode otomasi global.
  - **Ketersediaan Jalur Kanonikal:** Fungsi `setAutomationMode` ada di `src/lib/safety/automation-controller.ts`, namun belum memiliki rute HTTP API (`CANONICAL_AUTOMATION_MODE_HTTP_ROUTE=NONE`) dan belum mencatat ke `publication_operator_audit`.
- **Preservasi Hasil Keamanan Perilaku (Behavioral Safety):**
  - Seluruh bukti perilaku Phase 5L12 tetap valid dan terverifikasi secara independen (`PHASE_5L12_BEHAVIORAL_SAFETY_RESULT=PASS`):
    - Dispatcher `OBSERVE_ONLY` heartbeat tercatat aman (`BLOCKED`).
    - Reconciler `OBSERVE_ONLY` heartbeat tercatat aman (`BLOCKED`).
    - Mutasi rencana baru = 0, eksekusi baru = 0, publikasi baru = 0, tanda terima baru = 0.
    - Status artikel tidak berubah (Draft: 5, Published: 1).
- **Kebijakan & Kesiapan Phase 5L13:**
  - Kebijakan terkunci: Mutasi kontrol via raw SQL dilarang mulai Phase 5L13 (`PHASE_5L13_RAW_SQL_CONTROL_MUTATIONS_ALLOWED=NO`).
  - Kesiapan jalur kanonikal: `PLAN_ONLY_CANONICAL_ACTIVATION_PATH_READY=NO`, `PLAN_ONLY_CANONICAL_RETURN_PATH_READY=NO`.
  - Oleh karena itu, sebelum masuk Phase 5L13, jalur kontrol kanonikal (API/service + audit) harus disiapkan terlebih dahulu (`READY_FOR_PHASE_5L13=NO`).
- **Status Produksi Saat Ini:** `FINAL_AUTOMATION_MODE=OFF`, `FINAL_AUTO_SCHEDULE=false`, `FINAL_KILL_SWITCH=0`. Nol mutasi pada produksi selama Phase 5L12A.

### LokaMedia Phase 5L12 Production OBSERVE_ONLY Canary 2026-09-21

- **Tujuan & Ruang Lingkup:** Melakukan validasi canary pada kontrol state otomasi tingkat produksi (`automation_control.mode: OFF → OBSERVE_ONLY → OFF`) dengan otorisasi pengguna eksplisit. Membuktikan bahwa mode `OBSERVE_ONLY` mengeksekusi observasi telemetri terjadwal native Cloudflare Cron secara aman, memblokir seluruh tindakan eksekusi dan publikasi tanpa intervensi manusia (`canPlan=false`, `canSchedule=false`, `canPublish=false`), menghasilkan nol mutasi rencana/eksekusi/artikel, dan berhasil dikembalikan ke `mode=OFF`.
- **Verifikasi Pra-Canary & Gerbang Entri:**
  - **HEAD & Worktree:** `HEAD=30b27ff1dc9db33d988db6aa97d68e32bed763c3`, branch `lokamedia-phase-2ab-checkpoint`, worktree bersih.
  - **Worker & Skema:** Worker `rancangloka`, deployment `3404ac08-0e5f-4e11-8e11-2f93b7119a8f` (0 drift), skema D1 migrasi 0019 (0 drift).
  - **Kontrol Baseline:** `mode=OFF`, `auto_schedule_enabled=false`, `kill_switch=0`, rencana aktif=0, eksekusi aktif=0.
- **Transisi & Audit Operator (KOREKSI PHASE 5L12A):**
  - **Mekanisme Mutasi:** Dilakukan via remote SQL langsung pada tabel `automation_control` (bukan melalui endpoint HTTP operator API kanonikal).
  - **Audit Transisi 1 (OFF → OBSERVE_ONLY):** Kolom `updated_at` (`2026-09-21 16:45:27`) dan `updated_by` (`admin_operator`) diperbarui pada baris `automation_control (id=1)`. Baris di `publication_operator_audit` tidak ada (`OBSERVE_ONLY_ACTIVATION_AUDIT_ROW_EXISTS=NO`).
  - **Audit Transisi 2 (OBSERVE_ONLY → OFF):** Kolom `updated_at` (`2026-09-21 16:51:07`) dan `updated_by` (`admin_operator`) diperbarui pada baris `automation_control (id=1)`. Baris di `publication_operator_audit` tidak ada (`RETURN_TO_OFF_AUDIT_ROW_EXISTS=NO`).
- **Hasil Observasi Detak Native Cron Selama OBSERVE_ONLY:**
  - **Detak Dispatcher (`publication_dispatcher`):** Terbukti berjalan native via Cloudflare Cron (`trigger_source='cloudflare_cron'`) merekam `automation_mode='OBSERVE_ONLY'` dengan status `BLOCKED` (`error_summary='UNATTENDED_PUBLISH_BLOCKED'`). Contoh run: `crun_disp_9d9f4299465442bf`, `crun_disp_ee111d3c11a24641`.
  - **Detak Reconciler (`auto_execution_reconciler`):** Terbukti berjalan native via Cloudflare Cron (`trigger_source='cloudflare_cron'`) pada jadwal 5 menit merekam `automation_mode='OBSERVE_ONLY'` dengan status `BLOCKED` (`error_summary='AUTOMATION_MODE_BLOCKS_EXECUTION_OBSERVE_ONLY'`). Contoh run: `crun_rec_e4f5cc3b3a514dd6`.
  - **Detak Planner (`publication_planner`):** Status `NOT_YET_DUE` (siklus per jam).
- **Pembuktian Nol Mutasi Siklus Hidup:**
  - `NEW_PLAN_COUNT=0` (0 rencana publikasi baru).
  - `NEW_EXECUTION_COUNT=0` (0 eksekusi baru).
  - `NEW_PUBLICATION_COUNT=0` (0 artikel dipublikasikan).
  - `NEW_RECEIPT_COUNT=0` (0 tanda terima baru).
  - `ARTICLE_STATUS_COUNTS_UNCHANGED=YES` (Draft tetap 5, Published tetap 1).
  - `PRODUCTION_R2_WRITES=0`, `PRODUCTION_MEDIA_MUTATIONS=0`.
- **Kesehatan Sistem & Rute Publik:**
  - Status operasi dan integritas tanda terima: `PROD_OPERATIONS_STATUS_HEALTH=PASS`, `PROD_RECEIPT_INTEGRITY=PASS`.
  - Rute publik selama canary: Homepage (200 OK), Artikel id 6 (200 OK), Sitemap (200 OK).
- **Status Akhir Produksi:**
  - `FINAL_AUTOMATION_MODE=OFF`, `FINAL_AUTO_SCHEDULE_ENABLED=false`, `FINAL_KILL_SWITCH=0`.
  - `HIGHEST_AUTOMATION_MODE_REACHED=OBSERVE_ONLY`.
- **Hasil:** `PHASE_5L12=PASS`. Validasi canary OBSERVE_ONLY produksi sukses (`PRODUCTION_OBSERVE_ONLY_CANARY_VERIFIED=YES`). Siap untuk Phase 5L13 (`READY_FOR_PHASE_5L13=YES`).

### LokaMedia Phase 5L11C Production Native Cron Heartbeat Closure 2026-09-21

- **Tujuan & Ruang Lingkup:** Melakukan verifikasi observasi native Cron heartbeat di lingkungan produksi Cloudflare Worker (`rancangloka`) pasca-deployment Phase 5L11B tanpa mutasi kode, tanpa mutasi skema/konfigurasi, dan tanpa emulasi HTTP (`/__scheduled` / POST manual = 0). Membuktikan detak terjadwal native Cloudflare edge scheduler berjalan dan tercatat secara persisten pada tabel `publication_cron_runs` database D1 produksi (`rancangloka_db`).
- **Verifikasi Identitas & Gerbang Entri:**
  - **HEAD & Worktree:** `HEAD=dbb7458178eb808ad2a3f28371429773f34b7eed`, branch `lokamedia-phase-2ab-checkpoint`, worktree bersih (`CLEAN=YES`).
  - **Worker Aktif:** Terkonfirmasi versi `3404ac08-0e5f-4e11-8e11-2f93b7119a8f` (100% traffic aktif).
  - **Ledger Migrasi D1:** Migrasi 0019 (`0019_publication_cron_observability.sql`) tetap yang terbaru.
  - **Firewall Kontrol:** `mode='OFF'`, `kill_switch_engaged=0`, `settings.auto_schedule_enabled='false'`.
- **Hasil Observasi Detak Native Cron Produksi (Jendela Observasi Edge):**
  - **Detak Dispatcher (`publication_dispatcher`):** Terbukti berjalan native setiap 1 menit via Cloudflare Cron (`trigger_source='cloudflare_cron'`). Seluruh baris berstatus `BLOCKED` (`error_class='SAFETY_BLOCK'`, `error_summary='AUTOMATION_MODE_OFF'`) dengan `automation_mode='OFF'`.
  - **Detak Reconciler (`auto_execution_reconciler`):** Terbukti berjalan native setiap 5 menit via Cloudflare Cron (`trigger_source='cloudflare_cron'`). Seluruh baris berstatus `BLOCKED` (`error_class='SAFETY_BLOCK'`, `error_summary='AUTOMATION_MODE_BLOCKS_EXECUTION_OFF'`) dengan `automation_mode='OFF'`.
  - **Detak Planner (`publication_planner`):** Status `NOT_YET_DUE` (siklus 1 jam sekali pada menit :00).
  - **Keunikan Telemetri:** Seluruh `run_id` terbukti unik (duplikasi = 0).
- **Integritas Pipeline & Konten:**
  - **Mutasi Konten & Siklus Hidup:** Rencana baru = 0, eksekusi baru = 0, tanda terima publikasi baru = 0, publikasi baru = 0.
  - **Status Artikel:** Artikel draft tetap 5, artikel published tetap 1 (`rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman`, id: 6). Mutasi artikel = 0.
  - **Integritas Tanda Terima & Operasi:** `PROD_OPERATIONS_STATUS_HEALTH=PASS`, `PROD_RECEIPT_INTEGRITY=PASS`.
- **Kesehatan Endpoint Publik:**
  - Homepage (`https://rancangloka.com`): 200 OK (164,504 bytes).
  - Artikel Published (`https://rancangloka.com/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman`): 200 OK (159,807 bytes).
  - Sitemap Index & XML (`/sitemap.xml`, `/post-sitemap.xml`): 200 OK (XML valid).
- **Hasil:** `PHASE_5L11C=PASS`. Deployment produksi disabled terverifikasi penuh (`PRODUCTION_DISABLED_DEPLOYMENT_FULLY_VERIFIED=YES`). Siap untuk Phase 5L12 (`READY_FOR_PHASE_5L12=YES`). Mode otomasi tertinggi tetap `OFF`.

### LokaMedia Phase 5L11B Disabled Production Migration + Deployment 2026-09-21

- **Tujuan & Ruang Lingkup:** Menerapkan seluruh migrasi pending (0013–0019) ke database Cloudflare D1 produksi (`rancangloka_db`), mendeploy Cloudflare Worker (`rancangloka`) dengan pemicu native Cron triggers dalam mode nonaktif (`mode=OFF`, `auto_schedule_enabled=false`), memvalidasi kesehatan publik situs, serta membuktikan nol mutasi rencana/eksekusi/publikasi artikel.
- **Eksekusi & Hasil Gerbang Pra-Mutasi (Pre-Mutation Gates):**
  - **Identitas Target:** Terkonfirmasi Worker `rancangloka`, D1 `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`), R2 `rancangloka-media`.
  - **Deployment Eksisting:** Versi aktif sebelum deploy terkonfirmasi identik dengan referensi rollback `cef16b4b-a5f0-416c-9fff-1924aaee1ecc` (0 drift).
  - **Audit Migrasi 0013–0016:** Bersih, aditif, dan kompatibel mundur. Tidak ada operasi destruktif.
  - **Audit Migrasi 0017–0019:** Default aman terpasang (`manual_hold=0`, `scheduling_mode='legacy'`, `execution_mode='legacy'`, `auto_schedule_enabled='false'`).
  - **Backup D1 Remote:** Berhasil diekspor dan disimpan lokal sebagai cadangan sebelum mutasi skema.
  - **Regresi Pra-Mutasi:** Pengujian 5L10 (22/22 pass), 5L9 (13/13 pass), typecheck (`tsc --noEmit`), build (`astro build`), dan `wrangler deploy --dry-run` seluruhnya lulus 100%.
- **Eksekusi Mutasi Produksi (Production Mutations):**
  - **Migrasi D1 Remote:** `npx wrangler d1 migrations apply rancangloka_db --remote` berhasil menerapkan 7 migrasi (`0013` hingga `0019`). Ledger D1 remote berada pada ID 19 (`0019_publication_cron_observability.sql`).
  - **Status Kontrol Pasca-Migrasi:** `mode='OFF'`, `kill_switch_engaged=0`, `settings.auto_schedule_enabled='false'`.
  - **Worker Deployment:** `npx wrangler deploy` berhasil menerbitkan versi `3404ac08-0e5f-4e11-8e11-2f93b7119a8f` dengan pemicu jadwal native terpasang (`0 * * * *`, `*/5 * * * *`, `* * * * *`).
- **Verifikasi Pasca-Deployment (Post-Deployment Verification):**
  - **Kesehatan Situs Publik:** Homepage (`https://rancangloka.com` -> 200 OK, 164.5 KB) dan artikel published (`https://rancangloka.com/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman` -> 200 OK, 159.8 KB) sehat dan stabil.
  - **Keamanan Endpoint Operasi:** Anonymous access ditolak (401), media device ditolak (403).
  - **Integritas Konten & Pipeline:** Artikel draft tetap 5, artikel published tetap 1, rencana publikasi aktif tetap 0, eksekusi aktif tetap 0, tanda terima publikasi tetap 0. Tidak ada mutasi konten.
  - **Mode Otomasi:** `HIGHEST_AUTOMATION_MODE_REACHED` tetap `OFF`.
- **Hasil:** `PHASE_5L11B=PASS`. Versi produksi aktif: `3404ac08-0e5f-4e11-8e11-2f93b7119a8f`. Referensi rollback: `cef16b4b-a5f0-416c-9fff-1924aaee1ecc`.

### LokaMedia Phase 5L11A Production Readiness — Read-Only Gate 2026-09-21

- **Tujuan & Ruang Lingkup:** Melakukan audit read-only komprehensif pada lingkungan produksi Cloudflare Worker (`rancangloka`), database D1 produksi (`rancangloka_db`: `3a86e9ad-410f-4440-884e-2eb813ec4cf7`), dan R2 storage (`rancangloka-media`) sebelum eksekusi migrasi dan deployment dalam keadaan dinonaktifkan (disabled).
- **Temuan Audit Produksi (Read-Only):**
  - **Identitas Target:** Terkonfirmasi Worker `rancangloka`, entrypoint `src/worker.ts`, D1 binding `DB`, R2 binding `MEDIA_BUCKET`, dan 3 pemicu Cron native (`0 * * * *`, `*/5 * * * *`, `* * * * *`). Site target: `https://rancangloka.com`.
  - **Status Migrasi D1 Remote:** Database produksi berada pada migrasi `0012_articles_created_at.sql`. Terdapat 7 migrasi berurutan yang pending: `0013`, `0014`, `0015`, `0016`, `0017`, `0018`, dan `0019`. Seluruhnya aditif tanpa operasi destruktif (`DROP TABLE`/`DROP COLUMN` = 0).
  - **Status Kontrol Produksi:** `automation_control.mode = 'OFF'`, `kill_switch_engaged = 0`. Setelah migrasi 0017 diterapkan, `auto_schedule_enabled` akan defaulted ke `'false'`, `scheduling_mode` defaulted ke `'legacy'`, dan `manual_hold` defaulted ke `0`.
  - **Status Pipeline & Artikel Produksi:** D1 produksi saat ini memiliki 5 artikel draft dan 1 artikel published (`rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman`, id: 6). Rencana publikasi aktif = 0, eksekusi aktif = 0. Tidak ada backlog atau pekerjaan otomatis yang tertahan.
  - **Kesehatan Situs Produksi:** Endpoint publik `https://rancangloka.com` (200 OK) dan artikel published `https://rancangloka.com/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman` (200 OK) beroperasi normal.
  - **Dry-Run & Konfigurasi Secret:** `wrangler deploy --dry-run` PASS (bundle 4.3 MB). Secret admin dan media terpasang. `CRON_SECRET` belum ada di remote (tidak memblokir deployment karena Cron native tidak membutuhkan loopback HTTP; opsional untuk pemantauan HTTP eksternal).
  - **Versi & Rollback:** Deployment produksi aktif saat ini adalah `cef16b4b-a5f0-416c-9fff-1924aaee1ecc` (menjadi referensi rollback resmi).
  - **Urutan Eksekusi Phase 5L11B:** 1) Verifikasi referensi rollback -> 2) Terapkan migrasi 0013–0019 ke remote D1 -> 3) Verifikasi skema D1 remote -> 4) Pastikan mode tetap OFF -> 5) Deploy worker (`wrangler deploy`) -> 6) Verifikasi kesehatan situs & operasi status -> 7) Verifikasi detak awal cron berstatus `BLOCKED` dengan 0 mutasi.
- **Hasil:** `PHASE_5L11A=PASS`, `PRODUCTION_READINESS_CLASSIFICATION=READY_FOR_DISABLED_PRODUCTION_DEPLOYMENT`. Mutasi produksi: D1=0, R2=0, Deploy=0.

### LokaMedia Phase 5L10A Pre-Production Integrity + Observability Gap Closure 2026-09-21

- **Tujuan & Ruang Lingkup:** Verifikasi integritas komprehensif paska-5L10 sebelum melangkah ke tahap produksi. Memastikan tidak ada kehilangan dokumentasi dari checkpoint `97c450b`, memverifikasi integritas migrasi 0019 pada ledger Wrangler D1 lokal, memperluas cakupan uji deterministik untuk kegagalan finalisasi telemetri (`TELEMETRY_FINALIZE_FAILURE_DOES_NOT_ROLLBACK_BUSINESS_ACTION`), deteksi alert tugas tertahan (`STUCK_PLAN_ALERT_TEST`, `STALE_BINDING_ALERT_TEST`), status kesehatan saat mode `OFF` (`OFF_MODE_CRON_ALIVE_TEST`), serta integritas tanda terima Artikel 6 (`ARTICLE_6_RECEIPT_INTEGRITY`).
- **Penyempurnaan Telemetri & Status Operasi:**
  - `src/lib/publication/cron-telemetry.ts`: `completeCronRun` mengembalikan status sukses/error dan menyematkan `telemetry_finalize_error` pada objek hasil tanpa membatalkan tindakan publikasi kanonikal yang telah selesai.
  - `src/lib/publication/operations-status.ts`: Menambahkan `STUCK_PLAN_DETECTED` ke dalam `AlertType` dan menghasilkan alert kategori `WARNING` jika ada rencana `auto_policy` yang tidak terekonsiliasi setelah 15 menit dalam mode eksekusi.
- **Hasil Pengujian & Verifikasi:**
  - 22/22 uji lulus bersih pada `scripts/test-phase5l10-cron-observability.js`.
  - Seluruh regresi (Phase 5L9, 5L6A, 5L6, 5L4, 5L3, 5L2, readiness, soak safety) lulus 100%.
  - Typecheck (`tsc --noEmit`), build (`astro build`), dan `wrangler deploy --dry-run` lulus 100%.
  - Fixture Artikel 1, 3, 5, 6 beku 100% (0 mutasi). Kontrol lokal: `mode=OFF`, `auto_schedule_enabled=false`, `kill_switch=0`.
- **Hasil:** `PHASE_5L10A=PASS`, `READY_FOR_PHASE_5L11=YES`.

### LokaMedia Phase 5L10 Durable Cron Heartbeat + Operations Observability 2026-09-21

- **Tujuan & Masalah:** Mengatasi celah observabilitas operasional (gap ketiadaan detak run-summary pada auto-execution reconciler dan belum adanya dashboard terpadu pengawasan operasi) dengan mengimplementasikan lapisan detak Cron append-only persisten, layanan status operasi kanonikal read-only, deteksi tugas tersangkut (stuck work), mesin peringatan turunan (derived alert engine) ber-sinyal tinggi, API terotentikasi, serta antarmuka visual minimal untuk pengawasan operator.
- **Model Data Telemetri & Migrasi (`0019_publication_cron_observability.sql`):**
  - Membuat tabel `publication_cron_runs` dengan kolom: `run_id` (`crun_<job>_<hex>`), `job_name`, `trigger_source`, `started_at`, `finished_at`, `status`, `automation_mode`, `kill_switch_engaged`, `processed_count`, `created_count`, `blocked_count`, `failed_count`, `error_class`, `error_summary`, `details_json`, `created_at`.
  - Indeks teroptimasi: `idx_cron_runs_job_created`, `idx_cron_runs_status_created`, `idx_cron_runs_created`.
  - Migrasi lokal diterapkan secara aman ke database D1 lokal Miniflare SQLite (`0019` tercatat pada `d1_migrations` ID 18).
- **Semantik Detak & Kebijakan Kegagalan Telemetri (`src/lib/publication/cron-telemetry.ts`):**
  - Kebijakan `FAIL_CLOSED_ON_START_SAFE_SURFACE_ON_FINALIZE`: Kegagalan penulisan detak `STARTED` menghentikan eksekusi sebelum mutasi bisnis terjadi (fail-closed); kegagalan finalisasi setelah aksi berhasil dicatat sebagai error tanpa membatalkan publikasi yang sah.
  - Klasifikasi keamanan: Mode `OFF`, kill switch aktif, dan jeda operator dicatat sebagai `BLOCKED`, bukan runtime failure.
  - Firewall rahasia: Fungsi `sanitizeErrorSummary` membersihkan token bearer, token media, kata sandi, dan header otorisasi.
- **Integrasi Pemicu Native Cloudflare Cron (`src/lib/publication/cron-router.ts`):**
  - Membungkus eksekusi `publication_planner`, `auto_execution_reconciler`, dan `publication_dispatcher` dalam `runWithCronTelemetry`.
  - Menetapkan atribusi pemicu yang tepat (`cloudflare_cron`, `admin_http`, `service_http`, `test`).
- **Layanan Status Operasi Kanonikal (`src/lib/publication/operations-status.ts`):**
  - Fungsi read-only `getPublicationOperationsStatus(db, now?)` mengumpulkan:
    1. Snapshot kontrol sistem (`mode`, `auto_schedule_enabled`, `kill_switch_engaged`, `circuit_breakers`).
    2. Penghitung pipeline (`eligible_auto_policy_drafts`, `active_planned_count`, `scheduled_count`, `claimed_count`, `publishing_count`, `retry_wait_count`, `failed_count`, `manual_hold_count`, `published_24h_count`).
    3. Ringkasan detak Cron dengan ambang batas keusangan deterministik (Planner: 9000 dtk; Reconciler: 900 dtk; Dispatcher: 180 dtk).
    4. Deteksi tugas macet (`stuck_executions`, `stuck_plans`).
    5. Kegagalan terminal dan deteksi pergeseran hash (`stale_bindings`).
    6. Pemantau integritas tanda terima rilis (`missing_receipts`, `duplicate_receipts`, `hash_mismatches`).
    7. Mesin alert turunan (`CRON_HEARTBEAT_MISSING`, `EXECUTION_LEASE_EXPIRED`, `TERMINAL_PUBLICATION_FAILURE`, `STALE_BINDING_BLOCKED`, `RECEIPT_INTEGRITY_ERROR`, `KILL_SWITCH_ACTIVE`).
  - Pengendalian kebisingan: Kondisi normal seperti mode `OFF` atau `manual_hold` tidak memicu alert kritis (`ALERT_NOISE_CONTROL=PASS`).
- **API Status Operasi & Dashboard Admin:**
  - Endpoint `GET /api/admin/publication/operations/status` dengan firewall autentikasi admin ketat (anonim: 401, token media: 403, sesi admin: 200).
  - Halaman dashboard read-only di `/admin/publication/operations` (`src/pages/admin/publication/operations.astro`) menyajikan 5 kartu pengawasan tanpa kewenangan mutasi (`OPS_DASHBOARD_MUTATION_AUTHORITY=NONE`).
- **Pengujian & Validasi:**
  - 17/17 uji fokus di `scripts/test-phase5l10-cron-observability.js` lulus 100%.
  - Seluruh regresi (Phase 5L9, 5L6A, 5L6, 5L4, 5L3, 5L2, readiness, soak safety) lulus 100%.
  - Typecheck (`tsc --noEmit`), build (`astro build`), dan `wrangler deploy --dry-run` lulus bersih tanpa error.
  - Fixture Artikel 1, 3, 5, 6 beku 100%. Kontrol lokal tetap aman: `mode=OFF`, `auto_schedule_enabled=false`, `kill_switch=0`.
- **Hasil:** `PHASE_5L10=PASS`, `CRON_RUN_HISTORY_DURABLE=YES`, `READY_FOR_PRODUCTION_DEPLOYMENT_READINESS_PHASE=YES`.

### LokaMedia Phase 5L9 Cloudflare Cron Wiring + Server Trigger Auth Foundation 2026-09-21

- **Tujuan & Ruang Lingkup:** Mengimplementasikan perutean native Cloudflare Worker scheduled cron event langsung ke layanan kanonikal tanpa loopback HTTP (`CRON_USES_SELF_HTTP_FETCH=NO`), serta menyediakan autentikasi rahasia berbasis header (`CRON_SECRET`) untuk trigger endpoints tanpa melemahkan autentikasi admin sesi maupun CSRF browser.
- **Arsitektur Worker Wrapper (`src/worker.ts`):**
  - Mengonfigurasi entrypoint sumber `src/worker.ts` di `wrangler.toml` (`main = "src/worker.ts"`).
  - Mendelegasikan `fetch(request, env, ctx)` ke virtual entrypoint runtime Astro SSR (`dist/_worker.js/index.js`).
  - Menghubungkan `scheduled(event, env, ctx)` ke perute kanonikal `src/lib/publication/cron-router.ts`.
- **Perutean Cron Deterministik (`src/lib/publication/cron-router.ts`):**
  - Mendefinisikan identitas tugas internal eksplisit: `publication_planner` (`0 * * * *`), `auto_execution_reconciler` (`*/5 * * * *`), `publication_dispatcher` (`* * * * *`).
  - Memanggil langsung layanan kanonikal: `executePublicationPlanner` (dengan profile kanonikal `GROWING` dan timezone `Asia/Jakarta`), `reconcileAutoPolicyPlansForExecution` (batch limit 10), `runPublisherDispatcher` (`triggerSource: 'cron'`).
  - Model keamanan & isolasi kesalahan: Mematuhi matrix kapabilitas mode otomasi, emergency kill switch, dan pause control secara fail-closed. Kesalahan pada satu tugas terisolasi penuh dan tidak melakukan cascade ke tugas lainnya (`CRON_JOB_FAILURE_ISOLATION=YES`).
  - Manajemen masa hidup: Menggunakan `ctx.waitUntil` untuk pelacakan promise asinkron Cloudflare.
- **Autentikasi Server Trigger (`CRON_SECRET`):**
  - Mendukung `Authorization: Bearer <CRON_SECRET>` dan `X-RancangLoka-Cron-Secret` dengan perbandingan constant-time (`timingSafeEqual`).
  - Mengizinkan panggilan non-browser yang terotentikasi rahasia pada endpoint `/api/admin/publication/plans`, `/publish/reconcile`, dan `/publish/due` untuk melewati pemeriksaan CSRF browser secara aman (`SERVICE_AUTH_BYPASSES_BROWSER_CSRF_SAFELY=YES`), sementara sesi browser admin tetap wajib lolos validasi CSRF origin.
  - Firewall kredensial media: Token media (`lkmd_` atau `media:device`) diblokir mutlak dengan HTTP 403.
  - Pencegahan kebocoran: Nilai `CRON_SECRET` tidak pernah di-log, di-commit, atau dikembalikan dalam response payload.
- **Konfigurasi Sumber Cloudflare Triggers (`wrangler.toml`):**
  - Menambahkan konfigurasi trigger cron tingkat sumber: `0 * * * *`, `*/5 * * * *`, `* * * * *`.
  - Otomasi produksi tetap nonaktif (`mode=OFF`, `auto_schedule_enabled=false`, `kill_switch_engaged=0`).
- **Pengujian & Validasi:**
  - 13/13 pengujian fokus di `scripts/test-phase5l9-cron-wiring.js` lulus 100%.
  - Seluruh regresi kritis (Phase 5L6A, 5L6, 5L4, 5L3, 5L2, readiness, soak safety) lulus 100%.
  - Fixture Artikel 6 (`phase5l7-hands-off-publish-fixture`) 100% beku tanpa mutasi.
- **Hasil:** `PHASE_5L9=PASS`, `CRON_USES_SELF_HTTP_FETCH=NO`, `READY_FOR_OBSERVABILITY_HARDENING=YES`.

### LokaMedia Phase 5L8 Hands-Off Production Hardening Audit 2026-09-21

- **Tujuan & Masalah:** Audit kesiapan produksi hands-off read-only pasca keberhasilan Phase 5L7, memverifikasi tidak adanya cron otomatis aktif yang terpasang di tingkat worker runtime, memetakan rantai pemicu kanonikal, dan merumuskan arsitektur pemicu Cloudflare terjadwal native.
- **Temuan Kunci:**
  - Pemicu cron otomatis saat ini belum terhubung di runtime worker (`FULL_CRON_CHAIN_CURRENTLY_WIRED=NO`).
  - Keputusan arsitektur: Memilih pemanggilan layanan internal kanonikal secara langsung (`scheduled` -> services) daripada loopback HTTP self-fetch.
  - Tangga aktivasi produksi: Membutuhkan pembungkusan entrypoint worker, autentikasi server trigger, instrumen observabilitas (heartbeat & health checks), sebelum aktivasi mode otomasi.
- **Hasil:** `PHASE_5L8=PASS`.

### LokaMedia Phase 5L7 True Hands-Off Local End-to-End Publication 2026-09-21

- **Tujuan & Masalah:** Membuktikan alur kerja publikasi hands-off penuh tanpa intervensi manusia sama sekali: sistem kebijakan lolos -> perencana otomatis membuat plan auto-policy -> rekonsiliator menjadwalkan eksekusi -> dispatcher menerbitkan artikel -> tanda terima kriptografis immutable terbentuk -> rute publik dapat diakses.
- **Hasil Eksekusi Fixture Artikel 6 (`phase5l7-hands-off-publish-fixture`):**
  - Status artikel: `published`.
  - Jumlah persetujuan manusia: 0 (`approval count = 0`).
  - Mode perencanaan: `auto_policy` (`plan_id = 'plan_85c9952fb146a92c'`).
  - Mode eksekusi: `auto_schedule` (`execution_id = 'pexec_161b85cb6789f2bd'`), status `PUBLISHED`.
  - Tanda terima: `rcpt_6c247016b4ac6ee0`.
  - Rute publik artikel dan gambar terverifikasi menyajikan konten nyata.
  - Artikel 6 ditetapkan sebagai frozen golden fixture.
- **Hasil:** `PHASE_5L7=PASS`, `TRUE_HANDS_OFF_PUBLICATION_PROVEN=YES`.

### LokaMedia Phase 5L6A Auto-Policy Plan -> Execution Reconciler 2026-09-21

- **Tujuan & Masalah:** Mengimplementasikan layanan rekonsiliasi kanonikal server-side (`src/lib/publication/auto-policy-reconciler.ts`) yang menjembatani rencana auto-policy berstatus `PLANNED` menjadi eksekusi `SCHEDULED` secara berkala tanpa campur tangan manusia dan tanpa melakukan publikasi prematur.
- **Hasil:** `PHASE_5L6A=PASS`.

### LokaMedia Phase 5L6 Publisher Dual Authorization Foundation 2026-09-21

- **Tujuan & Masalah:** Mengimplementasikan fondasi dual authorization pada lapisan publisher server-side, mendukung dua mode otorisasi publikasi tanpa celah bypass:
  1. `editorial_signoff`: Membutuhkan persetujuan manusia (`article_editorial_approvals.approval_status = 'APPROVED'`) yang terikat valid pada `content_hash` terkini dan aset featured media aktif, serta status readiness `READY_TO_SCHEDULE`.
  2. `auto_policy`: TIDAK memerlukan persetujuan manusia. Wajib terikat secara deterministik pada plan auto-policy yang valid (`article_publication_plans.scheduling_mode = 'auto_policy'`), binding identitas (`article_id`, `content_hash`, `featured_asset_id`), provenance snapshot kebijakan sistem yang valid (`system_policy_pass = true`), re-evaluasi kebijakan mutu deterministik terkini secara live di execution time, `manual_hold = 0`, `kill_switch_engaged = 0`, dan kapabilitas mode otomasi server-side (`CONTROLLED` untuk penjadwalan, `UNATTENDED` untuk publikasi).
- **Resolver Otorisasi Kanonikal (`src/lib/publication/authorization-resolver.ts`):**
  - Menerapkan fungsi tunggal `resolvePublicationAuthorization(db, params)` untuk tahap `schedule` dan `prepublish`.
  - Strict plan-mode routing: Rencana `editorial_signoff` hanya memvalidasi jalur persetujuan manusia; rencana `auto_policy` hanya memvalidasi jalur kebijakan sistem tanpa fallback silang (`PLAN_MODE_AUTHORIZATION_STRICT=YES`).
  - Rencana berstatus `legacy` dipertahankan wajib persetujuan manusia (`LEGACY_PLAN_AUTO_POLICY_ALLOWED=NO`).
- **Integrasi Publisher Service (`src/lib/publication/publisher-service.ts`):**
  - `schedulePlanForExecution`: Memvalidasi otorisasi via resolver kanonikal dan menyematkan atribusi mode eksekusi secara otomatis: `auto_schedule` untuk auto-policy, `scheduled_publish` untuk editorial terencana, `manual_publish` untuk Publish Now.
  - `validatePrepublishInvariants`: Melakukan double-gate re-evaluasi kanonikal terhadap konten, media, dan kebijakan sebelum mutasi rilis publikasi dilakukan.
  - `executeAtomicPublication`: Memperkuat guard mutasi rilis publikasi dengan verifikasi atomik `content_hash` dan subquery pengecekan aset aktif featured media (`FEATURED_ASSET_RACE_FAILS_CLOSED=YES`), mencegah race condition konten maupun pergantian media concurrent.
  - `publishNow`: Dibatasi secara mutlak khusus jalur editorial manusia (`PUBLISH_NOW_WITHOUT_HUMAN_APPROVAL_ALLOWED=NO`). Tombol Publish Now dilarang digunakan untuk bypass rilis auto-policy.
  - Zero Approval Pollution: Otorisasi dan eksekusi auto-policy menghasilkan 0 baris persetujuan editorial (`AUTO_POLICY_APPROVAL_MUTATIONS=0`).
- **Pengujian & Validasi:**
  - 23/23 uji fokus di `scripts/test-phase5l6-dual-authorization.js` lulus.
  - Seluruh regresi kritis (Phase 5L4, 5L3, 5L2, readiness, soak safety) lulus 100%.
  - Status beku lokal terjaga: Artikel 1 (`draft`), Artikel 3 (`draft`, `APPROVED`, 0 plan, 0 eksekusi), Artikel 5 (`draft`, `manual_hold = 1`, plan `CANCELLED`), `auto_schedule_enabled = false`, `kill_switch_engaged = 0`.
- **Hasil:** `PHASE_5L6=PASS`, `READY_FOR_CONTROLLED_AUTO_PUBLICATION_TEST=YES`.

### LokaMedia Phase 5L5 Controlled Local Auto-Policy Plan Creation 2026-09-21

- **Tujuan & Masalah:** Membuktikan alur kerja auto-policy planner dari nol tanpa persetujuan manusia secara lokal pada fixture terkontrol, kemudian mengembalikan status sistem ke kondisi aman.
- **Solusi & Eksekusi:**
  - Menyiapkan fixture terkontrol Artikel 5 (`lokamedia-publication-quality-fixture-auto-5`) yang memenuhi seluruh syarat kebijakan deterministik tanpa baris persetujuan manusia (`approval_count = 0`).
  - Mengaktifkan `settings.auto_schedule_enabled = 'true'` dan `automation_control.mode = 'CONTROLLED'` secara lokal sementara.
  - Menjalankan `createPublicationPlansForReadyArticles`: Candidate selector memilih Artikel 5 dengan `candidate_source = 'auto_policy'`, menerbitkan tepat satu baris `article_publication_plans` (`scheduling_mode = 'auto_policy'`).
  - Menguji fungsi rollback operator `returnToDraftAndHold`: Membatalkan plan (`plan_status = 'CANCELLED'`), memasang `manual_hold = 1`, mengembalikan `auto_schedule_enabled = 'false'`, dan memastikan 0 eksekusi serta 0 publikasi terbentuk.
- **Hasil:** `PHASE_5L5=PASS`, bukti lokal auto-policy planning berhasil tanpa efek samping ke Artikel 1 atau 3.

### LokaMedia Phase 5L4 / 5L4A Admin Override, Manual Hold & D1 Ledger Integrity 2026-09-21

- **Tujuan & Masalah:** Memberikan kontrol darurat manual kepada operator (Manual Hold, Return to Draft & Hold, Global Auto-Schedule Toggle) dan memastikan integritas ledger migrasi D1 Cloudflare.
- **Solusi:**
  - Migrasi `0018_publication_operator_audit.sql`: Menambahkan kolom `manual_hold`, `manual_hold_reason`, `manual_hold_at`, `manual_hold_by` pada tabel `articles` serta tabel audit `publication_operator_audit`.
  - Layanan operator di `src/lib/publication/operator-controls.ts`: `engageManualHold`, `releaseManualHold`, `returnToDraftAndHold`, `setGlobalAutoSchedule`.
  - Double-gate check pada publisher menolak artikel jika `manual_hold = 1`.
  - Verifikasi ledger migrasi D1 lokal Miniflare: Memastikan migrasi 0017 dan 0018 tercatat secara resmi di tabel `d1_migrations`.
- **Hasil:** `PHASE_5L4=PASS`, `PHASE_5L4A=PASS`.

### LokaMedia Phase 5L3 Auto-Planner Candidate Integration 2026-09-21

- **Tujuan:** Mengintegrasikan seleksi kandidat ganda (`editorial_signoff` vs `auto_policy`) pada layanan planner publikasi (`src/lib/publication/planner-service.ts`).
- **Solusi:**
  - Menambahkan prioritas deterministik: Jika sebuah artikel memenuhi kedua syarat, kandidat editorial signoff diutamakan.
  - Memvalidasi prasyarat auto-policy: `auto_schedule_enabled = 'true'`, `manual_hold = 0`, `kill_switch_engaged = 0`, dan mode automasi mengizinkan perencanaan (`PLAN_ONLY`, `CONTROLLED`, `UNATTENDED`).
  - Menyimpan snapshot provenance kebijakan pada rencana publikasi (`scheduling_mode = 'auto_policy'`).
- **Hasil:** `PHASE_5L3=PASS`.

### LokaMedia Phase 5L2 System Publication Policy Foundation 2026-09-21

- **Tujuan:** Memisahkan evaluasi kebijakan kualitas otomatis (`system_policy_pass`) dari persetujuan manusia (`human_approval_pass`).
- **Solusi:**
  - Memperbarui evaluator kesiapan publikasi (`src/lib/publication/service.ts`) untuk mengevaluasi `system_policy_pass` secara independen dari `human_approval_pass`.
  - Migrasi `0017_publication_auto_schedule.sql`: Menambahkan `scheduling_mode` pada `article_publication_plans` dan `execution_mode` pada `article_publication_executions`.
  - Menetapkan nilai default sistem `auto_schedule_enabled = 'false'` untuk keamanan.
- **Hasil:** `PHASE_5L2=PASS`.

### LokaMedia Phase 5K3E2 - 5K3H Article 3 End-to-End Approval & Readiness Verification 2026-09-21

- **Phase 5K3E2 (Featured Media Attachment):** Mengaitkan aset terdaftar `ast_748c29fa012aa3d6eec531fa` sebagai media featured aktif Artikel 3 (`role = 'featured'`, `is_active = 1`).
- **Phase 5K3F (Readiness Reconciliation):** Merekonsiliasi status kesiapan Artikel 3 dari `BLOCKED` menjadi `READY_FOR_REVIEW`.
- **Phase 5K3G (Human Editorial Approval):** Editor manusia memeriksa dan menyetujui Artikel 3 secara manual di halaman preview admin (`/admin/preview/lokamedia-publication-quality-fixture`) menghasilkan status `APPROVED`.
- **Phase 5K3H (Pre-Publication Readiness Audit):** Audit read-only memastikan Artikel 3 berstatus `READY_TO_SCHEDULE` dengan 0 rencana publikasi dan 0 eksekusi terdaftar.
- **Hasil:** `ARTICLE_3_STATE=READY_TO_SCHEDULE`.

### LokaMedia Phase 5K3E1 Article 3 Media Asset Registration Execution 2026-09-21

- Successfully registered the canonical Article 3 watermarked R2 derivative into `media_assets` using metadata and provenance only.
- Invariants strictly preserved:
  - ZERO binary retransmissions, ZERO R2 PUT calls (`R2_PUT_CALLS=0`, `BINARY_TRANSFER_CALLS=0`).
  - ZERO watermark transforms (`WATERMARK_TRANSFORM_CALLS=0`), ZERO provider calls (`PROVIDER_GENERATE_CALLS=0`, `CHATGPT_SUBMISSIONS=0`, `PROVIDER_CAPTURE_CALLS=0`).
  - ZERO `article_media` attachments created (`ARTICLE_3_ARTICLE_MEDIA_COUNT=0`, deferred to Phase 5K3E2).
  - ZERO readiness mutations (`READINESS_MUTATIONS=0`, read-only evaluation confirmed blockers `FEATURED_MEDIA_MISSING`, `APPROVAL_MISSING`).
  - ZERO approval, schedule, or publication mutations (`APPROVAL_MUTATIONS=0`, `ARTICLE_3_STATUS='draft'`).
  - ZERO mutations to Article 1 golden fixture (`ARTICLE_1_STATUS='draft'`, `APPROVAL_STATUS='APPROVED'`, asset `ast_d230f3d834ae5f1a9f689d7c` 100% unchanged).
- Verified durable upload receipt in IndexedDB `media-uploads`: `upl_0cde1e3e232210210678297ef7d14f4cc93a1d8669f9426019b78cc8d33193aa`, state `UPLOADED`.
- Verified local Miniflare R2 object metadata: key `media/articles/derivatives/c47f0221350c417c11f2f07664be0d90cee2b62e5082645121eb3e075ebbb01b.png`, size `3725697` bytes, MIME `image/png`, SHA-256 `c47f0221350c417c11f2f07664be0d90cee2b62e5082645121eb3e075ebbb01b`.
- Invoked canonical internal endpoint `POST /api/internal/v1/media/assets/register` with device authentication (`Bearer lkmd_controlled_phase5k3e1_device`, scope `media:device`).
- Deterministic asset identity verified: `ast_748c29fa012aa3d6eec531fa` (`ast_${sha256(role:sha256:r2_key).substring(0, 24)}`). Differs strictly from Article 1 (`ast_d230f3d834ae5f1a9f689d7c`).
- First clean registration inserted exactly one row into `media_assets` (`status: 'VALIDATED'`, `role: 'ARTICLE_PUBLIC_DERIVATIVE'`, `dimensions: 1672x941`, `byte_size: 3725697`, full provenance JSON).
- Audit event recorded in `media_asset_audit` (`action: 'REGISTER'`, safe metadata JSON).
- Idempotency verified: second invocation returned existing asset (`reused_existing: true`, 0 second inserts, `ARTICLE_3_MEDIA_ASSET_COUNT_AFTER_SECOND=1`).
- Post-reopen discovery verified against local Miniflare D1 SQLite.
- Regressions, typecheck (`tsc --noEmit`), and build (`npm run build`) all pass cleanly.
- Result: `PHASE_5K3E1=PASS`, `MEDIA_ASSET_REGISTRATION_LANE_CLOSED=YES`, `READY_FOR_ARTICLE_3_FEATURED_ATTACHMENT=YES`.

### LokaMedia Phase 5K3D Article 3 Durable Watermarked Derivative Upload 2026-09-21

- Successfully uploaded the canonical Article 3 watermarked derivative (`der_1cbb6f8b677815c4623d73245b9b60daebf729c5c03b0dea684b8297acc2dcd0`, 3725697 bytes, SHA-256 `c47f0221350c417c11f2f07664be0d90cee2b62e5082645121eb3e075ebbb01b`) to local Miniflare R2 bucket (`rancangloka-media`).
- Destination R2 key: `media/articles/derivatives/c47f0221350c417c11f2f07664be0d90cee2b62e5082645121eb3e075ebbb01b.png`.
- Durable upload receipt persisted in IndexedDB `media-uploads`: `upl_0cde1e3e232210210678297ef7d14f4cc93a1d8669f9426019b78cc8d33193aa` (`state: 'UPLOADED'`).
- Physical blob verified in `.wrangler/state/v3/r2/` (exact 3725697 bytes, SHA-256 matched).
- Result: `PHASE_5K3D=PASS`, `READY_FOR_MEDIA_ASSET_REGISTRATION=YES`.

### LokaMedia Phase 5K3C Article 3 Deterministic Watermark Derivative 2026-09-21

- Successfully produced exactly one deterministic watermark derivative from the immutable full-res Article 3 original.
- Input original: `mjob_34d4ad896ffba960eb77666e:1` (1672x941 PNG, 2655415 bytes, SHA `2cdaa0c03b6a85d959aa776e0fcebb51ff3740ad97ea2f7cff264f7081f0958b`).
- Transform ID: `038276c347d0bfd74c09a92d591f2db0454e25f221e70461bb47ac8d1fa4e148`.
- Resulting derivative: `der_1cbb6f8b677815c4623d73245b9b60daebf729c5c03b0dea684b8297acc2dcd0` (1672x941 PNG, 3725697 bytes, SHA-256 `c47f0221350c417c11f2f07664be0d90cee2b62e5082645121eb3e075ebbb01b`).
- Persisted durably in IndexedDB `media-derivatives` with role `PUBLIC_DERIVATIVE_CANDIDATE`.
- Result: `PHASE_5K3C=PASS`, `READY_FOR_UPLOAD_QUEUE=YES`.

### LokaMedia Phase 5K3B-R2 Full-Res ChatGPT Capture Adapter Repair 2026-09-21

- Diagnosed and repaired full-resolution image capture in LokaMedia extension.
- Root cause: previous capture adapter relied on DOM rendered CSS bounding box (461x259) rather than acquiring full natural resolution (1672x941) binary.
- Checkpoint commit: `795a4283528dfa2ae9d5239c933a7c320bb80a55` (`fix: preserve full resolution provider image capture`).
- Hardened capture pipeline: prefers full provider binary via authenticated fetch / natural dimensions, verified with 6 deterministic test cases in `scripts/test-lokamedia-phase5k3b-r2-fullres-capture.js`.
- Authoritative original recovered: `mjob_34d4ad896ffba960eb77666e:1` (1672x941 PNG, 2655415 bytes, SHA `2cdaa0c03b6a85d959aa776e0fcebb51ff3740ad97ea2f7cff264f7081f0958b`).
- Result: `PHASE_5K3B_R2=PASS`, `FULL_RES_CAPTURE_ADAPTER_REPAIRED=YES`.

### LokaMedia Phase 5K3A - 5K3B Article 3 Featured Media Job & Provider Generation 2026-09-20

- Created durable featured media job: `job_id: 'mjob_34d4ad896ffba960eb77666e'`, `slot_key: 'featured'`, `article_id: 3`.
- Executed controlled single ChatGPT generation run without duplicate submissions.
- Result: `PHASE_5K3A=PASS`, `PHASE_5K3B=PASS`.

### LokaMedia Phase 5K1 - 5K2 Publication-Quality Article Fixture Foundation 2026-09-20

- Audited publication content gate requirements (monetary zero-tolerance, H2 structure, >=300 words, >=3 takeaways, canonical author & category).
- Ingested publication-quality controlled article fixture: `article_id: 3`, `slug: 'lokamedia-publication-quality-fixture'`, `status: 'draft'`, `image_alt: 'LokaMedia Publication Quality Fixture'`.
- Article 1 frozen as golden fixture (`article_id: 1`, `status: 'draft'`, `approval: 'APPROVED'`).
- Result: `PHASE_5K1=PASS`, `PHASE_5K2=PASS`.

### LokaMedia Phase 5H2 Controlled Article Media Attachment Execution 2026-09-20

- Successfully executed controlled canonical attachment of registered media asset `ast_d230f3d834ae5f1a9f689d7c` to controlled article fixture `article_id: 1`, `slot_key: 'featured'`.
- Invoked canonical internal endpoint: `POST /api/internal/v1/media/article-media/attach` with device authentication (`Bearer lkmd_controlled_phase5h2_device`, scope `media:attach`).
- First clean attachment created exactly one active relation in `article_media` (`id: 1`, `article_id: 1`, `slot_key: 'featured'`, `asset_id: 'ast_d230f3d834ae5f1a9f689d7c'`, `role: 'featured'`, `is_active: 1`, `sort_order: 0`, `reused_existing: false`).
- Single-active-slot constraint verified: `idx_article_media_one_active_slot` ensures exactly one active asset per `(article_id, slot_key)`.
- Idempotency verified: second invocation with identical payload returned existing attachment (`id: 1`, `reused_existing: true`, 0 second inserts).
- Lost-response retry recovery and restart/reopen readback verified independently against Miniflare D1 SQLite.
- Safe audit event recorded in `media_asset_audit` (`action: 'ATTACH'`, safe metadata JSON, zero binary).
- Absolute safety boundaries verified:
  - Article status remained strictly `draft` (`ARTICLE_STATUS_MUTATIONS=0`).
  - Article readiness remained strictly `NONE` (`ARTICLE_READINESS_MUTATIONS=0`, readiness transition deferred to Phase 5I).
  - Article `updated_at` remained strictly unchanged (`2026-09-16T05:09:07.518Z`).
  - Registered media asset `ast_d230f3d834ae5f1a9f689d7c` in `media_assets` remained untouched (`status: VALIDATED`, 0 mutations).
  - Canonical R2 object at `media/articles/derivatives/458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff.png` remained unchanged (`R2_PUT_CALLS=0`, `R2_DELETE_CALLS=0`).
  - Extension IndexedDB original, derivative, and upload receipt remained 100% intact.
  - Zero binary transfer, zero image processing, zero publication mutations, zero production mutations.
- Result: `PHASE_5H2=PASS`, `ARTICLE_MEDIA_ATTACHMENT_LANE_CLOSED=YES`, `READY_FOR_READINESS_RECONCILIATION=YES`.

### LokaMedia Phase 5H1 Article Media Attachment Foundation 2026-09-20

- Built decoupled article media attachment service and dedicated internal device-authenticated endpoint.
- Checkpoint commit: `182726593d11cc7971ad759190eaf18901bca753` (`feat: add article media attachment`).
- Service implementation: `src/lib/media/article-media.ts` (`attachArticleMedia`, `resolveEditorialRole`, `assertValidSlotKey`).
  - Enforced editorial slot identity: `(article_id, slot_key)`.
  - Enforced attachability guards: article existence in `articles` (404), media asset existence & `VALIDATED` status in `media_assets` (404/422).
  - Enforced role compatibility: permits `ARTICLE_PUBLIC_DERIVATIVE`, strictly bars site-level `WATERMARK_MASTER` (422).
  - Enforced slot regex validation: `/^[a-z][a-z0-9_]{1,63}$/` (400).
  - Enforced provenance compatibility: generated asset bound to `article_id`/`slot_key` cannot be attached to a different article or slot (422).
  - Enforced active slot cardinality (`ONE_ACTIVE_ASSET_PER_SLOT` via `idx_article_media_one_active_slot`).
  - Enforced replacement policy: `FAIL_CLOSED_REPLACEMENT_REQUIRED` (409 `SLOT_OCCUPIED_CONFLICT` if different asset attempts to occupy active slot).
  - Idempotent duplicate reuse (`reused_existing: true`).
  - Safe audit trail logged to `media_asset_audit` (`action: 'ATTACH'`).
- Internal API endpoint: `src/pages/api/internal/v1/media/article-media/attach.ts`.
  - Least-privilege device authentication (`media:attach`, `media:upload`, `media:device`, `media:write:draft`).
  - Binary rejection guard: rejects multipart/form-data, octet-stream, and image/* with 415.
- Deterministic test suite: `scripts/test-lokamedia-phase5h1-article-media-attachment.js` (39 tests all pass).
- Full regression pass: 202 tests passed across Phase 5H1, 5G1, 5E1, publication readiness, and existing media tests. Clean TypeScript typecheck (`npx tsc --noEmit`).

### LokaMedia Phase 5G2 Controlled Media Assets Registration Execution 2026-09-20

- Successfully executed controlled canonical registration of the verified R2 derivative into `media_assets`.
- Consumed verified durable upload receipt (`upl_34381ae9e9996a2d4b4e0d93d29da49849e38fce7160e3e675a4d2c656f82d45`, state: `UPLOADED`) and verified canonical R2 object metadata (`media/articles/derivatives/458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff.png`, size: 3847117, SHA: `458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff`).
- Invoked canonical internal endpoint: `POST /api/internal/v1/media/assets/register`.
- Deterministic asset identity derived and verified: `ast_d230f3d834ae5f1a9f689d7c` (`ast_${sha256(role:sha256:r2_key).substring(0, 24)}`).
- First clean registration inserted exactly one row into `media_assets` with `status: 'VALIDATED'`, `role: 'ARTICLE_PUBLIC_DERIVATIVE'`, and full provenance JSON (`derivative_id`, `transform_id`, `upload_id`, `job_id`, `slot_key`, `article_id`).
- Safe audit event recorded in `media_asset_audit` (`action: 'REGISTER'`).
- Idempotency verified: second invocation returned existing asset (`reused_existing: true`, 0 second inserts).
- Lost-response retry recovery and post-reopen discovery verified.
- Absolute safety boundaries verified: `REGISTRATION_BINARY_BYTES_SENT=0`, `R2_PUT_CALLS=0`, `ARTICLE_MEDIA_CREATE_CALLS=0`, `ARTICLE_STATUS_MUTATIONS=0`, `ARTICLE_READINESS_MUTATIONS=0`, `PUBLICATION_MUTATIONS=0`.
- Result: `PHASE_5G2=PASS`, `MEDIA_ASSET_REGISTRATION_LANE_CLOSED=YES`, `READY_FOR_ARTICLE_MEDIA_ATTACHMENT=YES`.

### LokaMedia Phase 5G1 Media Asset Registration Foundation 2026-09-20

- Built decoupled media asset registration service and dedicated internal device-authenticated endpoint.
- Checkpoint commit: `861baa58bc90a4dae2a9f6c5f8cd01cf9d562730` (`feat: add media asset registration`).
- Database migration: `db/migrations/0016_media_assets_derivative_registration.sql` (additive columns for role, upload_id, derivative_id, transform_id, provenance_json; created `media_asset_audit` table).
- Service implementation: `src/lib/media/asset-registration.ts` (`registerMediaAsset`, `computeMediaAssetId`).
  - Enforced content-addressed identity rule: `ast_${sha256(role:sha256:r2_key).substring(0, 24)}`.
  - Enforced server-side receipt verification (must be `UPLOADED` with matching metadata).
  - Enforced independent canonical R2 object existence and metadata check (`bucket.head`).
  - Enforced idempotent deduplication and identity conflict guard (409 on conflicting metadata).
  - Preserved R2 storage on database failure (zero R2 deletes).
  - Strict decoupling: zero `article_media` creation, zero article readiness or status mutation.
- Internal API endpoint: `src/pages/api/internal/v1/media/assets/register.ts`.
- Deterministic test suite: `scripts/test-lokamedia-phase5g1-asset-registration.js` (40 tests all pass).

### LokaMedia Phase 5E2 Controlled Live R2 Upload Execution 2026-09-20

- Successfully executed controlled live upload of public derivative candidate to local Miniflare R2 bucket (`rancangloka-media`).
- Controlled fixture: `der_882fdc3c59e650718a83a38c5fa0db0f8b422a504946772c0f3af0fde9a0a662` (transform `f886f5d7b3278ebb6da84e9551df0c26b20795608eca26b05007f20ba48f155c`, 3847117 bytes, SHA `458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff`).
- Canonical R2 storage key: `media/articles/derivatives/458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff.png`.
- Durable upload receipt persisted in IndexedDB `media-uploads`: `upl_34381ae9e9996a2d4b4e0d93d29da49849e38fce7160e3e675a4d2c656f82d45` (state: `UPLOADED`).
- Second batch and duplicate enqueue idempotency verified: 0 second transfers, 0 duplicate R2 objects.
- R2 binary readback independently verified byte-for-byte identical (3847117 bytes, SHA-256 match).
- Zero `media_assets` rows created, zero `article_media` rows created, zero article status or readiness mutations.
- Result: `PHASE_5E2=PASS`, `UPLOAD_LANE_CLOSED=YES`, `READY_FOR_MEDIA_ASSET_REGISTRATION=YES`.

### LokaMedia Phase 5E1 Durable Derivative Upload Queue Foundation 2026-09-20

- Built durable client-side upload queue and server-side upload verification endpoint.
- Checkpoint commit: `1c30da7a0ab0118608836ea200c5cd4689679340` (`feat: add durable derivative upload queue`).
- Upgraded extension IndexedDB schema version from 3 to 4, adding `media-uploads` store.
- Modules: `src/upload-queue.ts`, `src/lib/media/derivative-upload.ts`, `src/pages/api/internal/v1/media/derivatives/[derivative_id]/upload.ts`.
- Enforced lease lock with expiration, concurrency cap of 2, backpressure limits, and canonical R2 key format.
- Deterministic test suite: `scripts/test-lokamedia-phase5e1-upload-queue.js` (19 tests all pass).

### LokaMedia Phase 5D5B Controlled Live Watermark Derivative Execution 2026-09-20

- Successfully executed one live watermark transform on the immutable captured original (`mjob_5c0f488d7ee123b9579a58a5:1`, 3846190 bytes).
- Produced durable derivative: `der_882fdc3c59e650718a83a38c5fa0db0f8b422a504946772c0f3af0fde9a0a662` (transform `f886f5d7b3278ebb6da84e9551df0c26b20795608eca26b05007f20ba48f155c`, SHA: `458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff`, 3847117 bytes, 1672x941 PNG).
- Stored durably in IndexedDB `media-derivatives` with role `PUBLIC_DERIVATIVE_CANDIDATE`.
- Idempotency verified: re-running transform reused existing derivative with 0 additional transforms.
- Original binary verified 100% immutable (SHA `68641cd3be874524f7a033bc539170f28cee0a609885d93c1f63f7c15ff35813` unchanged).
- Result: `PHASE_5D5B=PASS`, `MEDIA_PROCESSING_LANE_CLOSED=YES`, `READY_FOR_UPLOAD_QUEUE=YES`.

### LokaMedia Phase 5D5A Durable Watermark Derivative Pipeline 2026-09-20

- Checkpoint commit: `d5b67948bbdd73f4038af9dc395d65768247146c` (`feat: add durable watermark derivative pipeline`).
- Upgraded extension IndexedDB schema version from 2 to 3, adding `media-derivatives` store.
- Built client-side derivative pipeline (`src/derivative-pipeline.js`) with transform fingerprinting, watermark composition, and idempotent caching.
- Deterministic test suite: `scripts/test-lokamedia-phase5d5a-watermark-derivative-pipeline.js` (24 tests all pass).

### LokaMedia Phase 5D4B Watermark Master Asset Storage 2026-09-20

- Checkpoint commit: `a13e2532cb19e59d2a6a1aa5e4f20ec6179e8c45` (`feat: add watermark master asset storage`).
- Migration: `db/migrations/0015_site_watermark_assets.sql` (`site_watermark_assets` table).
- Service: `src/lib/watermark/assets.ts` with dedicated R2 namespace `site/watermarks/master/`.
- Deterministic test suite: `scripts/test-lokamedia-phase5d4b-watermark-asset-storage.js` (19 tests all pass).

### LokaMedia Phase 5D4A Admin Watermark Settings 2026-09-20

- Checkpoint commit: `50b41416ef35245a49fc51205fe2df4973ee7e5f` (`feat: add admin watermark settings`).
- Endpoints: `GET /api/admin/settings/watermark` and `PUT /api/admin/settings/watermark`.
- Schema: canonical settings structure with version tracking.
- Deterministic test suite: `scripts/test-lokamedia-phase5d4a-watermark-settings.js` (14 tests all pass).

### LokaMedia Phase 5D3A Deterministic Watermark Transform Core 2026-09-20

- Checkpoint commit: `1a40ab480d1964fb49e3cf41865c3bbcb3d1ffad` (`feat: add deterministic watermark transform core`).
- Module: `src/watermark-engine.js` (pure client-side deterministic composition with Canvas 2D API).
- Deterministic test suite: `scripts/test-lokamedia-phase5d3a-watermark-engine.js` (14 tests all pass).

### LokaMedia Phase 4B1A.5D2P Fresh Provider Preflight 2026-09-19

- Verified and reconciled extension runtime lifecycle after 5D1E fix and 5D2R-2 canonical recovery.
- Extension reloaded once with commit `0d04af48d3b946b4484b5c5b1d95fdc31b1dfa13`.
- ChatGPT tab (`https://chatgpt.com/c/6aae8fae-6308-83ec-accc-2a98d5c030eb`) refreshed cleanly; session state verified `AUTHENTICATED`, login prompt absent, ProseMirror composer present.
- Canonical `READ_ONLY_PROVIDER_DIAGNOSTIC` message executed through Side Panel and background handler.
- Provider state converged cleanly: `provider.tab=connected`, `provider.auth=ready`, `provider.dom=supported`, `provider.composer=ready`, `provider.lane=idle`.
- Runtime 5D1E contract verified loaded in content script and service worker: baseline candidate diffing, bounded result polling (up to 90000ms), source/container fingerprint requirement, controller and adapter malformed descriptor guards, and durable `result_checkpoint` support.
- Side Panel verified ready: `Run Once` button present, enabled, text `Run Once`.
- Fixture clean: server job `mjob_5c0f488d7ee123b9579a58a5` status `QUEUED`, `lease_owner=null`, `attempt=0`, `job_revision=15`. Local job `QUEUED`, `phase4bSingleRun=null`, all probes false, blob count 0.
- Zero live provider submissions, zero live captures, zero R2 uploads, zero media assets, zero article attachments, no push, no deploy.

### LokaMedia Phase 4B1A.5D2R-2 Blocked-Run Recovery Post-5D1E 2026-09-19

- Safely recovered blocked incident from earlier live run using canonical server and local recovery semantics.
- Server recovery: executed `POST /api/internal/v1/media/jobs/mjob_5c0f488d7ee123b9579a58a5/release` with `intent: 'SAFE_REQUEUE'`, `reason_code: 'EXPIRED_LEASE_RECOVERY'`, `expected_job_revision: 14`. Server returned `QUEUED`, `lease_owner=null`, `attempt=0`, `job_revision=15`.
- Local reconciliation: synchronized extension storage with server jobs list (`status=QUEUED`, `local_state=QUEUED`).
- Verified zero stale `result_checkpoint` and retired stale `phase4bSingleRun` latch (`lokamediaState.phase4bSingleRun = null`).
- Zero mutations to media assets, zero R2 uploads, zero live generation or capture.

### LokaMedia Phase 4B1A.5D1E Provider Result Completion & Correlation Contract Hardening 2026-09-19

- Hardened provider generation contract: `provider.generate()` does not resolve merely upon prompt submission; it awaits deterministic result identification.
- Checkpoint commit: `0d04af48d3b946b4484b5c5b1d95fdc31b1dfa13` (`fix: await correlated ChatGPT image result before capture`).
- Added pre-submit baseline candidate snapshot to distinguish pre-existing images from newly generated results.
- Added bounded asynchronous candidate polling loop in `controlledSubmit` with `PROVIDER_RESULT_TIMEOUT` (90000ms) and `PROVIDER_RESULT_AMBIGUOUS` structured fail-closed errors.
- Enforced complete result descriptor carrying `source_fingerprint`, `containerFingerprint`, `job_id`, `run_id`, `slot_key`, `prompt_version`, and `prompt_hash`.
- Persisted durable `result_checkpoint` in extension storage before capture handoff.
- Added fail-closed guards in `controller.js` and `adapter.js` before messaging content script or invoking capture when result is not capture-ready (`isCaptureReadyProviderResult`).
- Deterministic test suite: `scripts/test-lokamedia-phase4b1a-5d1e-result-await.js` (Tests 13 through 22 all pass).
- Full regression suite clean: all 56 tests passed, TypeScript typecheck clean, syntax checks clean.

### LokaMedia Phase 4B1A.5D1C IndexedDB Capture Store Schema Migration 2026-09-19

- Upgraded extension IndexedDB schema version from 1 to 2.
- Created `captured-blobs` object store with `keyPath: 'blobKey'` and secondary indexes (`by_job_id`, `by_run_id`, `by_status`, `by_created_at`).
- Preserved existing data in unrelated stores and ensured forward-only idempotent migration.
- Deterministic test suite: `scripts/test-lokamedia-phase4b1a-5d1c-schema-migration.js` (Tests A through H all pass).

### LokaMedia Phase 4B1A.5D1B Real ChatGPT Capture Adapter Wiring 2026-09-19

- Wrote and wired the real ChatGPT capture path, removing the `CAPTURE_DISABLED_PHASE_4A` stub: `provider.capture(job, providerResult)` → `chrome.tabs.sendMessage` → `content-script.js` `CHATGPT_PROVIDER_CAPTURE` handler → target image binary acquisition → controller binary validation & durable persistence.
- Checkpoint commit: `6960e9cb102597697a8be94c7aee91ffca6e9459` (`fix: wire LokaMedia ChatGPT capture adapter`).
- Critical correlation rule enforced: capture consumes the exact result descriptor already selected by provider-generation correlation (`source_fingerprint` or `containerFingerprint`). Global heuristics (`newest <img>`, first matching, ungrounded re-discovery) are strictly prohibited.
- Content script `controlledCapture` revalidates candidate image within container, fails closed with `CAPTURE_TARGET_MISSING` if absent, `CAPTURE_TARGET_AMBIGUOUS` if non-unique, and `CAPTURE_CORRELATION_MISMATCH` if descriptor metadata does not match `job_id`/`run_id`/`slot_key`.
- Binary acquisition method: canvas `toDataURL` fallback to direct `fetch(src)` with chunked base64 data URL transport across Chrome extension messaging (`CAPTURE_MESSAGE_BINARY_TRANSPORT=BASE64_DATA_URL`).
- Binary roundtrip verified byte-for-byte identical using 64 KiB deterministic fixture (`BINARY_ROUNDTRIP_IDENTICAL=YES`).
- Canonical binary validation maintained in controller: authoritative gate for non-empty bytes, valid MIME (`image/png`, `image/jpeg`, `image/webp`), and dimensions before durable IndexedDB persistence.
- Fail-closed handling for missing receiver: surfaces `CONTENT_SCRIPT_UNAVAILABLE` cleanly without silent retries.
- Deterministic test suite added in `scripts/test-lokamedia-phase4b1a-5d1b-chatgpt-capture.js` covering Tests A through J (exact correlated capture, missing target, ambiguous target, correlation mismatch, binary transport, MIME preservation, content script absent, capture exactly once, controller integration, and explicit descriptor passing).
- Regression suite: all 7 test suites passing (76 tests passed, 0 failures), TypeScript `--noEmit` clean, syntax checks clean.
- Controlled fixture `mjob_5c0f488d7ee123b9579a58a5` remains untouched in local D1 (`status=QUEUED`, `lease_owner=null`, `attempt=0`, `job_revision=11`).
- Probes reset to default: `acquisitionProbe=false`, `providerResultProbe=false`, `captureBlobProbe=false`.
- Zero live prompt submissions, zero live captures, zero R2 uploads, zero media assets, zero article attachments, no push, no deploy.

### LokaMedia Phase 4B1A.5D1 Capture Correlation & Durable Blob Safety Boundary 2026-09-19

- Implemented deterministic correlation baseline diffing and capture durable safety boundary for the LokaMedia extension pipeline.
- Checkpoint commit: `58428bd2e87daa5d2df011f44c1dc822101c75af` (`test: add safe LokaMedia capture blob probe`).
- Exact candidate correlation: `correlateImageCandidates` diffs baseline snapshot against current DOM; prohibits global `newest <img>` heuristic.
- Durable persistence: IndexedDB / memory blob store persistence (`blobStore.put`) storing binary bytes, mime, dimensions, sha256, run_id, and job_id.
- Backpressure limits enforced: `MAX_PENDING_CAPTURED_ASSETS=4` and `MAX_PENDING_CAPTURED_BYTES=20 MiB` with fail-closed rejection.
- Capture Blob Probe boundary: `captureBlobProbe=true` stops pipeline immediately after durable blob persistence and before R2 upload, media asset creation, or article attachment.
- Deterministic test suite: `scripts/test-lokamedia-phase4b1a-5d1-capture-probe.js` (12 tests covering Tests 12-23).

### LokaMedia Phase 4B1A.5C2 Live Provider Generation Probe & Preflight Repairs 2026-09-19

- Successfully executed controlled live provider generation probe with exactly one real ChatGPT submission and stop at provider-result probe boundary.
- Repaired heartbeat contract (client sends `expected_job_revision`, server authoritative revision propagated to subsequent mutations).
- Repaired ChatGPT ProseMirror contenteditable composer detection and dynamic voice/send control state transitions.
- Fixed content-script lifecycle with mandatory reconnect preflight on reload.
- Proven live: Panel click → Run Once → Job Acquired → Heartbeat pass → provider.generate → ChatGPT submit 1x → Result correlated → Stop at `PROVIDER_RESULT_PROBE_STOP` with safe requeue. Zero capture calls, zero R2 uploads, zero media assets.

### LokaMedia Phase 4B1A.5C1 Provider Result Stop Boundary 2026-09-19

- Added explicit local-only `providerResultProbe` boundary to `controller.runJob` immediately after provider result correlation (`GENERATION_IMAGE_DETECTED`) and before capture handoff (`CAPTURE_START`).
- Emits structured `PROVIDER_RESULT_PROBE_STOP` audit event correlated with `run_id`, `job_id`, and provider result metadata.
- Canonical job lease cleanup: uses existing server-side `POST /api/internal/v1/media/jobs/[job_id]/release` endpoint via `ApiClient.releaseJob` with `intent: 'SAFE_REQUEUE'`, `reasonCode: 'PROVIDER_RESULT_PROBE_STOP'` to safely return leased fixture back to `QUEUED` without stranding.
- Duplicate generation risk is strictly controlled: single-run consumption latch (`phase4bSingleRun.submission_consumed = true`) blocks subsequent re-entry with `PHASE_4B_RUN_CONSUMED`, while provider generation concurrency is locked to 1.
- Guarantees zero image capture calls, zero blob persistence, zero R2 uploads, zero media asset creations, and zero article media attachments.
- Active-run lock is reliably released in `controller.runOnce` try/finally cleanup block upon probe stop.
- Normal flow remains completely unchanged when `providerResultProbe: false` (the default).
- Deterministic test coverage added covering Tests A through H (default flow unchanged, probe stop after result identification, run_id and job_id correlation, single provider call, capture blocked, canonical cleanup semantics, active run lock release).
- Safety preserved: no live provider calls, no live ChatGPT generation, no fixture mutation, no deployment, and no production mutation.

### LokaMedia Phase 4B1A.5B1 Local Acquisition-Stop Probe Boundary 2026-09-19

- Added explicit local-only `acquisitionProbe` boundary to `controller.runOnce` immediately after `JOB_ACQUIRED` and before single-run arming, submission, or `runJob` invocation.
- Emits structured `ACQUISITION_PROBE_STOP` audit event correlated with `run_id` and `job_id`.
- Canonical job lease cleanup: uses existing server-side `POST /api/internal/v1/media/jobs/[job_id]/release` endpoint via `ApiClient.releaseJob` with `intent: 'SAFE_REQUEUE'` to safely return leased fixture back to `QUEUED` without stranding.
- Preserves guaranteed active-run lock release in try/finally block and leaves default normal execution (`acquisitionProbe: false`) completely unchanged.
- Deterministic test coverage added proving normal flow unaffected, probe stop immediately after acquisition, run_id correlation, active lock release, canonical requeue invocation, and zero provider/image calls.
- Safety preserved: no live provider calls, no ChatGPT generation, no fixture mutation, and no deployment.

### LokaMedia Phase 4B1A.5A Run Once Execution-Start Repair 2026-09-19

- Repaired the execution-start gap between Side Panel Run Once dispatch, background message acceptance, and controller execution start.
- Single source of truth `run_id`: generated once at Side Panel click, propagated through `RUN_ONCE` message payload to background and controller, ensuring `RUN_ID_PANEL == RUN_ID_BACKGROUND == RUN_ID_CONTROLLER == RUN_ID_GATE`.
- Active-run mutual exclusion: added `acquireActiveRunLock`, `releaseActiveRunLock`, and `getActiveRunLock` in storage and controller, preventing concurrent executions and logging structured `RUN_REENTRY_REJECTED` audit evidence.
- Reliable lock release: controller execution path is protected with try/finally cleanup, guaranteeing active lock release on success, controlled gate rejection, and unexpected failures.
- Ensured `RUN_GATE_CHECK_START` is reached directly upon execution controller entry, preventing startup/reconcile failures from silently blocking gate inspection.
- Deterministic test coverage added covering accepted request execution start, run_id propagation, concurrent re-entry rejection, lock release on success, lock release on failure, and no duplicate execution.
- Safety preserved: no real ChatGPT prompt submission, no image generation, no new article/job fixture, no deployment, and no production mutation.

### LokaMedia Phase 4B1A.5 Durable Run Audit Logging 2026-09-16

- Implemented local-only durable structured audit logging for the LokaMedia extension Run Once path.
- Checkpoint commit: `028a73ee45db8edb32c1537c33dab72e1732ec6b` (`fix(lokamedia): repair run-once path and add audit logging`).
- Added `run_id`/`job_id` correlation, monotonic event sequence, safe error serialization, secret redaction, bounded retention (1000 events / 7 days), copy text, JSON export, isolated clear, and compact Last Action status.
- Instrumented panel click, background request acceptance, gate checks, job acquisition, provider lane, provider precheck/prepare, submission gate, provider submit, capture, upload, attachment confirmation, run completion, and failure/needs-attention outcomes.
- Root cause addressed: Run Once failures previously lacked durable structured diagnostics and could appear silent after status refresh.
- General automatic ChatGPT submission remains disabled; the controlled submit bridge is enabled only through explicit Phase 4B Run Once after local readiness, one-shot gate, server job acquisition, and provider lane checks pass.
- Capture remains Phase 4A-disabled, so this checkpoint is audit-visible and controlled-submit-ready but not yet full end-to-end media-completion-ready.
- Verification passed: side panel tests, popup controls tests, Phase 3 extension regression, Phase 4A ChatGPT provider regression, TypeScript `--noEmit`, recursive extension syntax check, and Astro production build.
- Operator note: unpacked Chrome extension reload is required before the new audit UI and Run Once logging are visible.
- Safety preserved: no real ChatGPT prompt submission, no image generation, no new article/job fixture, no deployment, and no production mutation.

### LokaMedia Phase 2A Durable Job Foundation 2026-09-14

* **Scope:** local schema/service/test implementation only; no production deploy, no remote D1 migration, no R2 mutation, and no production article mutation.
* **Migration:** `db/migrations/0013_lokamedia_durable_jobs.sql`.
* **Model:** `media_jobs.status` is the single canonical job lifecycle state.
* **Server fields:** added durable readiness, priority, sequence, prompt version/hash, lease, heartbeat, retry/attempt, idempotency, submitted/completed, revision, and supersession fields.
* **Active job guard:** one active job per `article_id + slot_key`, enforced by partial unique index plus service guard; terminal historical jobs can coexist.
* **Receipts/events:** added `media_job_receipts` and `media_job_events` foundations with safe payload handling and idempotency support.
* **Service primitives:** added media requirement creation, active-slot checks, canonical transitions, supersession, receipts, and event timeline helpers.
* `AUTO_PUBLISH=OFF`
* `READY_FOR_PHASE_2B=YES`

### LokaMedia Phase 2B Server Control Plane 2026-09-14

* **Scope:** local server scheduler/leasing/reconciliation implementation only; no production deploy, no remote D1 migration, no R2 mutation, no production article mutation, no extension/ChatGPT/provider automation.
* **Protocol:** `LOKAMEDIA_PROTOCOL_VERSION=1`.
* **Endpoints:** added next-job lease, heartbeat, reconcile, controlled release, progress event, and receipt lookup internal APIs under `/api/internal/v1/media/jobs`.
* **Scheduler:** server-authoritative deterministic eligibility and fairness; priority first, then featured/pass fairness across articles, then required-for-readiness, sequence, created time, and job id.
* **Lease model:** compare-and-swap acquisition using job revision; 300-second lease; heartbeat extends lease without incrementing attempt; expired leases recover to `RECOVERING`.
* **Retry/release:** controlled release intents only; bounded retry policy with safe error codes and no infinite retries.
* **Reconciliation:** read-only authoritative status response with latest receipt, attachment confirmation, lease relation, and bounded recommended action; extension must reconcile before retrying side effects.
* **Security:** media device scope remains unable to publish, delete/edit articles arbitrarily, mutate settings, deploy, or choose arbitrary R2 paths.
* `AUTO_PUBLISH=OFF`
* `READY_FOR_PHASE_2C=YES`

### LokaMedia Phase 2C Server Media Pipeline Foundation 2026-09-15

* **Scope:** local server upload, attachment, readiness, and renderer foundation only; no production deploy, no remote migration, no production D1/R2/article mutation, no Chrome extension, no ChatGPT/provider connection.
* **Canonical endpoint:** evolved `POST /api/internal/v1/media/upload`; no parallel upload path was introduced.
* **Upload contract:** `source_type=lokamedia_extension` requires protocol version, job ID, expected job revision, article/slot/role/sequence, prompt version/hash, idempotency key, client SHA, alt text, and binary/multipart payload.
* **Server authority:** media job, article, slot, role, prompt, revision, and lease ownership are verified server-side; wrong article/slot, stale revision, superseded/cancelled/terminal job, prompt mismatch, arbitrary R2 key, and SHA mismatch fail closed.
* **Binary pipeline:** server validates image magic bytes, MIME, dimensions, size, and server-computed SHA-256; storage key remains server-derived as `media/images/<sha256>.<ext>`.
* **Dedupe/idempotency:** existing validated `media_assets` are reused by SHA; `job_id + idempotency_key` replays return the authoritative attachment receipt without duplicate side effects.
* **Attachment:** `article_media` now has a Phase 2C active-slot guard for one active winning attachment per `article_id + slot_key`; featured uploads still mirror to `articles.featured_image` and `articles.image_alt`.
* **Receipts/recovery:** uploads persist `UPLOAD_RECEIVED`/`ASSET_EXISTS` and `ATTACHMENT_CONFIRMED` receipts; reconcile reveals lost-response success without another R2 write.
* **Readiness:** durable media requirements now aggregate multi-slot state into `WAITING_MEDIA`, `MEDIA_IN_PROGRESS`, `MEDIA_NEEDS_ATTENTION`, or `READY_FOR_REVIEW`; optional media does not block readiness and legacy articles keep compatibility behavior.
* **Renderer:** public article rendering supports safe `{{media:<slot_key>}}` anchors, omitting unresolved slots without broken images.
* **Concurrency:** independent uploads are supported without a global upload lock; generation and upload can overlap across different jobs.
* **Verification:** Phase 2A, Phase 2B, existing LokaMedia, Phase 2C upload/readiness/renderer, publication readiness/safety, Article tests, TypeScript typecheck, and Astro build passed locally.
* **New migration:** `db/migrations/0014_lokamedia_phase2c_slot_attachment.sql`.
* `AUTO_PUBLISH=OFF`
* `READY_FOR_PHASE_3_MV3_EXTENSION_CORE=YES`

### LokaMedia Phase 3 MV3 Durable Extension Core 2026-09-15

* **Scope:** local Chrome MV3 extension core only; no production deploy, no remote migration, no production D1/R2/article mutation, no ChatGPT/provider connection, and no model calls.
* **Extension root:** added loadable unpacked extension at `extensions/lokamedia` with MV3 manifest, module service worker, popup/status UI, and README.
* **Versions:** `EXTENSION_VERSION=0.1.0`, `LOKAMEDIA_PROTOCOL_VERSION=1`, and `STORAGE_SCHEMA_VERSION=1`.
* **Permissions:** uses only `storage` and `alarms`, with host permissions limited to localhost and the RancangLoka host; no ChatGPT/OpenAI host permission is requested.
* **Durability:** small checkpoints are stored in `chrome.storage.local`; captured binaries are stored in IndexedDB; no large Base64/localStorage blob path was introduced.
* **Core workers:** added API client, scheduler/controller, heartbeat manager, reconciliation manager, upload worker pool, backpressure controller, message protocol, provider lane lock, and deterministic mock provider.
* **Concurrency:** provider generation is locked to 1, image capture to 1, upload workers to 2, and captured-asset backpressure to 4 assets / 20 MiB.
* **Recovery:** startup reconciles before retry, resumes captured uploads, handles lost upload responses through server receipts, clears stale queue entries after attachment confirmation, preserves blobs across restart, and stops superseded/terminal jobs.
* **Provider boundary:** ChatGPT automation remains intentionally unimplemented; Phase 3 includes a mock provider only and does not infer fake generation percentages.
* **Tests:** added `scripts/test-lokamedia-phase3-extension.js` covering startup/no-job, acquisition, heartbeat/loss, lease loss, protocol/auth failures, restart persistence, blob missing recovery, two upload workers, upload replay, lost response recovery, backpressure, duplicate messages, stale revisions, terminal/superseded state, offline/online recovery, parallel pipeline, and multi-lane restart.
* `AUTO_PUBLISH=OFF`
* `READY_FOR_PHASE_4_CHATGPT_PROVIDER_ADAPTER=YES`

### LokaMedia Offline Checkpoint After Phase 3 2026-09-15

* **Checkpoint file:** `state/LOKAMEDIA_PHASE3_OFFLINE_CHECKPOINT.md`.
* **Canonical worktree:** `C:\Users\Fanto\Desktop\antigravity\rancangloka\lokamedia-phase-2ab-checkpoint`.
* **Clean checkpoint commit:** `712bc5fdf23ac1e8beeafce8db6202a1c07b44c1` (`feat(lokamedia): add durable MV3 extension core`).
* **Status:** Phase 3 passed and the worktree was clean before offline handoff.
* **Safety:** `AUTO_PUBLISH=OFF`, `MODEL_CALLS=0`, `PRODUCTION_MUTATIONS=0`, `DEPLOYMENTS=0`.
* **Next phase:** Phase 4 ChatGPT provider adapter can start from the committed MV3 core boundary.

### LokaMedia Phase 4A ChatGPT Provider Adapter Foundation 2026-09-16

* **Scope:** local read-only ChatGPT provider foundation only; no prompt submission, no model call, no image generation, no capture/download, no production deploy, no remote migration, and no production D1/R2/article mutation.
* **Provider root:** `extensions/lokamedia/src/providers/chatgpt`.
* **DOM contract:** `CHATGPT_DOM_ADAPTER_VERSION=1`, separate from `LOKAMEDIA_PROTOCOL_VERSION=1` and `EXTENSION_VERSION=0.1.0`.
* **Host permission:** added the explicit minimal ChatGPT origin `https://chatgpt.com/*`; `<all_urls>` is not requested.
* **Human authentication boundary:** adapter detects `AUTHENTICATED`, `AUTH_REQUIRED`, or `UNKNOWN`; it does not log in, enter credentials, copy cookies, copy tokens, or store authorization material.
* **Handshake:** added versioned service-worker/content-script handshake with tab identity validation, duplicate HELLO safety, stale-version rejection, wrong-tab rejection, and reconnect-safe local provider state.
* **Capability discovery:** read-only detection covers composer presence/editability, send control presence, conversation/response surfaces, image result surface, download affordance, and auth state.
* **Selector strategy:** selectors are centralized and layered by semantic attributes, accessibility labels, scoped form/surface relationships, and narrow fallbacks; generated CSS classes, nth-child, coordinates, blind clicks, newest image selection, and broad DOM mutation are not used.
* **Fail closed:** unsupported DOM returns `DOM_CONTRACT_UNSUPPORTED`; ambiguous image correlation returns `AMBIGUOUS_IMAGE_CANDIDATE`.
* **Baseline inventory:** existing image candidates are inventoried with local id, normalized source fingerprint, dimensions, container fingerprint, observation timestamp, and optional provider asset id only; image bytes and unrelated conversation text are not persisted.
* **Correlation foundation:** future Phase 4B acceptance combines job id, prompt version/hash, provider tab id, optional conversation/response identity, sequence, baseline fingerprints, and post-submission candidates; no single DOM-order signal is authoritative.
* **Capture discovery:** future capture priority is provider download/asset, available binary/blob, fetchable resolved asset, safe browser conversion, and screenshot last; screenshot is not the primary capture path.
* **Read-only diagnostic/UI:** popup shows ChatGPT tab/auth/DOM/composer/image-count/provider-lane status and exposes a read-only provider check that does not type, click, submit, download, or change conversation.
* **Tests:** added `scripts/test-lokamedia-phase4a-chatgpt-provider.js` covering provider DOM fixtures, baseline/correlation, reorder safety, no-submission guard, capture discovery, handshake restart/stale/wrong-tab cases, reload, and tab-closed handling.
* `PROMPT_SUBMISSION_ENABLED=NO`
* `MODEL_CALLS=0`
* `IMAGE_GENERATIONS=0`
* `AUTO_PUBLISH=OFF`
* `READY_FOR_PHASE_4B_SINGLE_CONTROLLED_GENERATION=YES`

### LokaMedia Phase 4B0A/4B0C Operator UI Preflight 2026-09-16

* **Scope:** Chrome extension UI architecture only; no ChatGPT prompt submission, no model call, no image generation, no media job creation, no D1/R2/article mutation, and no deployment.
* **Popup repair:** repaired popup control wiring with bounded startup/status diagnostics, visible provider-check errors, service-worker message handling, and a safe content-script reconnect path.
* **Side Panel migration:** the canonical operator UI moved from the Chrome action popup to Chrome's native right-side Side Panel.
* **Manifest:** added `sidePanel` permission and `side_panel.default_path = src/side-panel.html`; removed `action.default_popup` so the toolbar icon opens the Side Panel instead of a transient popup.
* **Toolbar behavior:** service worker requests `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`.
* **Boundary:** Side Panel communicates with the service worker through the existing extension message protocol; it does not talk directly to ChatGPT, server internals, D1, R2, or article records.
* **Persistent monitor:** Side Panel shows ChatGPT and RancangLoka status separately, current job summary, queue counters, upload transfer progress, provider diagnostic fields, server/backpressure/error status, Enabled/Pause, Provider Check, and collapsed configuration.
* **Safety:** Run/manual generation is not exposed in the Side Panel and background `TICK` remains guarded as `PHASE_4B_NOT_ARMED`.
* **Provider check:** remains read-only; it may detect tab/auth/DOM/composer/images/lane and may reconnect the content script, but it does not type, click Send, submit, download, or generate.
* **Progress model:** generation remains indeterminate + elapsed; uploads use real transfer percentage where available.
* **Tests:** added `scripts/test-lokamedia-popup-controls.js` and `scripts/test-lokamedia-side-panel.js` for popup repair and native Side Panel behavior.
* `MODEL_CALLS=0`
* `PROMPT_SUBMISSIONS=0`
* `IMAGE_GENERATIONS=0`
* `AUTO_PUBLISH=OFF`

---

### Masalah 2026-09-13: Standar Mobile Responsive Artikel Publik
* **Gejala:** Dibutuhkan standar mobile yang ketat untuk halaman artikel RancangLoka, dengan referensi utama iPhone 11 `414 x 896`, minimum `360 x 800`, gutter kiri/kanan setara, tanpa horizontal overflow, dan alignment konsisten untuk cover, body, references, related articles, serta footer.
* **Penyebab:** Halaman artikel publik memakai beberapa container dan breakpoint berbeda, sehingga perlu token grid mobile tunggal untuk menghindari nested-padding asymmetry dan elemen yang berpotensi melewati parent pada layar kecil.
* **Solusi:**
  - Menambahkan token `.rl-mobile-grid` di `src/styles/global.css` dengan `padding-inline: clamp(16px, 4.8vw, 20px)`.
  - Menambahkan `.rl-safe-wrap`, guard `overflow-x: clip`, dan batas `max-width: 100%` untuk media, tabel, `pre`, dan konten prose.
  - Menyamakan container artikel, halaman statis, related articles, dan footer ke grid mobile yang sama.
  - Menyesuaikan spacing mobile untuk H1, cover, editorial cards, references, CTA, dan footer tanpa mengubah logic data, publikasi, media, atau schema.
* **Verifikasi:**
  - `node --test scripts/test-mobile-responsive-standard.js`: PASS.
  - `tsc --noEmit`: PASS.
  - `astro build`: PASS.
  - Browser QA lokal pada `360 x 800`, `375 x 812`, `390 x 844`, `414 x 896`, `430 x 932`, `768 x 1024`, `1280 x 800`, dan `1440 x 900`: PASS untuk gutter equality, no horizontal overflow, cover/body/references/footer alignment.
* **Checkpoint:** Detail lengkap tersimpan di `state/MOBILE_RESPONSIVE_CHECKPOINT.md`.
* **Status:** Local validated. Belum deploy produksi karena prompt mobile responsive ini tidak menyertakan instruksi deployment.

---

### Masalah 1: Konfigurasi Deployment Cloudflare Workers Builds CI
* **Gejala:** Deploy gagal dengan error `Authentication error [code: 10000]` atau `It looks like you've run a Workers-specific command in a Pages project`.
* **Penyebab:** 
  1. `wrangler.toml` sebelumnya menggunakan direktif `pages_build_output_dir = "dist"`.
  2. Perintah deploy dan token API belum memiliki permission `Cloudflare Pages: Edit` atau diselaraskan dengan Cloudflare Workers Builds CI.
* **Solusi:**
  - Mengupdate [`wrangler.toml`](file:///wrangler.toml) ke mode **Cloudflare Workers with Assets**:
    ```toml
    name = "rancangloka"
    main = "dist/_worker.js/index.js"
    assets = { directory = "dist" }
    ```
  - Menghapus package deprecated `lucide-astro` dan beralih ke `@lucide/astro`.
  - Menggunakan konfigurasi build:
    - **Build command:** `npm run build`
    - **Deploy command:** `npx wrangler deploy`
  - **Hasil:** Deploy berhasil 100% dan live di `https://rancangloka.chandrajoyko.workers.dev`.

---

### Masalah 2: Wrangler Assets Leaking Error (`_worker.js`)
* **Gejala:** Deploy gagal pada tahap deploying dengan pesan `Uploading a Pages _worker.js directory as an asset. This could expose your private server-side code...`.
* **Penyebab:** Wrangler memvalidasi folder `dist` dan menemukan direktori server `_worker.js` saat menyiapkan static assets.
* **Solusi:**
  - Membuat file [`.assetsignore`](file:///.assetsignore) dan [`public/.assetsignore`](file:///public/.assetsignore) berisi:
    ```text
    _worker.js
    _routes.json
    ```

---

### Masalah 3: D1 Database Validation Error 10021
* **Gejala:** Deploy terhenti dengan error `binding DB of type d1 must have a valid database_id specified [code: 10021]`.
* **Penyebab:** `wrangler.toml` masih menggunakan placeholder `your-d1-database-id-here`.
* **Solusi:**
  - Membuat database D1 `rancangloka_db` di Cloudflare Dashboard.
  - Memasukkan ID asli `3a86e9ad-410f-4440-884e-2eb813ec4cf7` ke [`wrangler.toml`](file:///wrangler.toml).
  - Membuat bucket R2 `rancangloka-media` untuk penyimpanan media.

---

### Masalah 4: Query Malformed Error pada D1 Web Console
* **Gejala:** Eksekusi skema SQL di D1 Console menghasilkan error `The request is malformed: Requests without any query are not supported`.
* **Penyebab:** Parser D1 Web Studio menolak baris komentar SQL (`-- ...`) dan baris kosong.
* **Solusi:**
  - Menyusun ulang query SQL bersih tanpa komentar untuk pembuatan tabel (`categories`, `authors`, `articles`, `settings`, `users`, `sessions`) dan seed data awal. Seluruh tabel berhasil dibuat dan terverifikasi.

---

### Masalah 5: Gambar Artikel Rusak / 404
* **Gejala:** Gambar artikel *7 Trik Menata Kamar Tidur Minimalis* tidak muncul pada kartu web.
* **Penyebab:** Link aset dari Unsplash lama tidak lagi tersedia di CDN.
* **Solusi:**
  - Mengganti URL gambar kamar tidur Japandi aktif di [`src/lib/db.ts`](file:///src/lib/db.ts).
  - Menambahkan proteksi otomatis `onerror="this.onerror=null;this.src='...'"` di seluruh kartu artikel sehingga website tidak akan pernah menampilkan icon gambar rusak jika ada CDN luar yang bermasalah.

---

### Masalah 6: Header Freeze / Menempel Saat Halaman Di-scroll
* **Gejala:** Header dan logo besar tetap mengunci di atas layar dan memakan ruang baca.
* **Penyebab:** Class CSS `sticky top-0` pada elemen `<header>`.
* **Solusi:**
  - Mengubah class `<header>` menjadi `relative` di [`src/components/Header.astro`](file:///src/components/Header.astro) sehingga header bergeser dan menghilang secara natural saat halaman di-scroll ke bawah.

---

### Masalah 7: Optimasi Core Web Vitals & PageSpeed Insights
* **Gejala:** Skor Performance awal 89 dengan waktu muat tertahan oleh font dan gambar berukuran 1200px pada layar mobile.
* **Penyebab:** `@import` font di dalam file CSS memblokir proses rendering (render-blocking ~1.670 ms), gambar artikel terlalu berat, dan teks abu-abu terang tidak lulus kontras rasio WCAG AA.
* **Solusi:**
  - Menghapus `@import` dari `global.css`.
  - Menambahkan `preconnect` DNS untuk Google Fonts dan Unsplash.
  - Memuat Google Fonts secara asinkron non-blocking (`media="print" onload="this.media='all'"`).
  - Mengoptimasi parameter kompresi gambar Unsplash (`w=720&q=75&auto=format`).
  - Menyesuaikan kontras warna teks menjadi `text-slate-600` / `text-slate-700` (WCAG AA Compliant).
  - **Hasil:** Skor naik menjadi **Performance 90+**, **Best Practices 100**, **SEO 100**, **Agentic 2/2**.

---

### Masalah 8: Kebijakan Status Impor Markdown (Draft vs Published)
* **Gejala:** Sebelumnya endpoint impor Markdown langsung menyetel artikel ke status `published`, sehingga artikel baru belum sempat ditinjau editor langsung tayang ke publik.
* **Solusi:**
  - Memperbarui [`src/pages/api/admin/import-md.ts`](file:///src/pages/api/admin/import-md.ts) agar menyetel status default menjadi `draft` (`status: frontmatter.status || 'draft'`).
  - Redaktur/Editor dapat meninjau format, gambar cover, kategori, dan snippet SEO terlebih dahulu di CMS sebelum mempublikasikannya.

---

### Masalah 9: Validasi Kesiapan Artikel Sebelum Tayang (Editorial Quality Gate)
* **Gejala:** Artikel dengan field kosong (misal tanpa gambar cover, tanpa meta deskripsi, atau tanpa kategori) dapat tidak sengaja ter-publish dan merusak tampilan layout.
* **Solusi:**
  - Menambahkan sistem *Editorial Quality Gate* di [`src/pages/api/admin/posts.ts`](file:///src/pages/api/admin/posts.ts) dan form editor [`src/pages/admin/posts/new.astro`](file:///src/pages/admin/posts/new.astro).
  - Jika artikel belum memenuhi syarat wajib (Judul, Konten, Deskripsi, Cover Image, Kategori, Penulis), sistem menolak publish dan menampilkan checklist field yang perlu dilengkapi atau mengarahkannya untuk disimpan sebagai `Draft`.

---

### Masalah 10: Drag & Drop Image Uploader & Client-Side WebP Converter ke R2
* **Gejala:** Sebelumnya editor hanya bisa memasukkan URL gambar eksternal secara manual.
* **Solusi:**
  - Membuat endpoint upload R2 [`src/pages/api/admin/upload.ts`](file:///src/pages/api/admin/upload.ts) dan streaming media [`src/pages/media/[key].ts`](file:///src/pages/media/%5Bkey%5D.ts).
  - Menambahkan fitur Drag & Drop di [`src/pages/admin/posts/new.astro`](file:///src/pages/admin/posts/new.astro) dengan konverter otomatis berbasis HTML5 Canvas yang otomatis mengubah foto format apa pun (PNG, JPG) menjadi WebP (skala maks 1200px, kualitas 82%) langsung di browser sebelum dikirim ke Cloudflare R2.

---

### Masalah 11: Sistem Halaman Statis & Page Writer (WordPress-Style Pages)
* **Gejala:** Belum ada pemisahan entitas antara artikel blog/majalah (Posts) dengan halaman informasi statis (Pages) seperti *Tentang Kami*, *Kontak*, *Pedoman Media Siber*, dan *Kebijakan Privasi*.
* **Solusi:**
  - Membuat tabel `pages` di database D1 [`db/schema.sql`](file:///db/schema.sql) dan data layer [`src/lib/db.ts`](file:///src/lib/db.ts).
  - Menambahkan menu **"Halaman (Pages)"** di Admin CMS [`src/layouts/AdminLayout.astro`](file:///src/layouts/AdminLayout.astro).
  - Membangun halaman listing [`src/pages/admin/pages/index.astro`](file:///src/pages/admin/pages/index.astro) dan editor penulisan halaman [`src/pages/admin/pages/new.astro`](file:///src/pages/admin/pages/new.astro) & [`src/pages/admin/pages/[id].astro`](file:///src/pages/admin/pages/%5Bid%5D.astro).
  - Mendukung template halaman (Standar, Formulir Kontak Interaktif, Full Width) serta auto-sitemap di [`src/pages/sitemap-pages.xml.ts`](file:///src/pages/sitemap-pages.xml.ts).

---

### Masalah 12: Sirkulasi Internal Linking Otomatis & Toggle Artikel Berbayar (Sponsored Review)
* **Gejala:** Belum ada sistem sirkulasi backlink internal otomatis (Dateline Branding, In-Article "BACA JUGA", Auto-Keyword Linker), serta belum ada opsi untuk menonaktifkan sirkulasi ini khusus artikel pesanan berbayar (*Paid Review / Advertorial*) agar fokus pada link klien sponsor.
* **Solusi:**
  - Membangun modul *Internal Linking Engine* di [`src/lib/seo.ts`](file:///src/lib/seo.ts):
    1. **Dateline Source Branding:** Otomatis menyematkan `RANCANGLOKA.COM – ` di `<p>` pertama artikel dan feed RSS.
    2. **In-Article "BACA JUGA":** Menyematkan callout kartu rekomendasi artikel terkait tepat sebelum `<h2>` kedua/ketiga.
    3. **Auto-Keyword Linker:** Memindai kata kunci fokus artikel lain dan otomatis mengubahnya menjadi anchor link kontekstual (maks 2 per artikel).
  - Menambahkan field `is_sponsored` & `disable_internal_links` di D1 dan switch toggle di Admin Editor [`src/pages/admin/posts/new.astro`](file:///src/pages/admin/posts/new.astro) & frontmatter Markdown. Jika aktif, internal links dan widget "BACA JUGA" otomatis dinonaktifkan khusus untuk artikel sponsor tersebut.

---

### Masalah 13: Social Share Bar Customizer & Footer Manager di Dashboard Admin
* **Gejala:** Admin belum bisa mengatur tombol share media sosial apa saja yang aktif di artikel serta belum bisa mengatur profil tautan media sosial resmi dan deskripsi di footer secara dinamis.
* **Solusi:**
  - Menambahkan panel kustomisasi **Social Share Bar** di [`src/pages/admin/settings.astro`](file:///src/pages/admin/settings.astro) (Master Toggle, per-platform on/off: WhatsApp, X/Twitter, Facebook, LinkedIn, Telegram, Copy Link, serta Twitter handle).
  - Menambahkan panel **Footer Manager & Official Socials** di [`src/pages/admin/settings.astro`](file:///src/pages/admin/settings.astro) (Deskripsi footer, tautan medsos resmi: Instagram, TikTok, X, YouTube, Pinterest, LinkedIn, dan teks Copyright).
  - Memperbarui [`src/components/SocialShareBar.astro`](file:///src/components/SocialShareBar.astro) dan [`src/layouts/BaseLayout.astro`](file:///src/layouts/BaseLayout.astro) agar merender tampilan footer dan share bar dinamis berbasis database D1.

---

### Masalah 14: Stealth Mode & Obfuscation Identitas Framework (Anti-Detector Wappalyzer/Competitor)
* **Gejala:** Folder aset bawaan framework (`/_astro/...`) berpotensi diekspos ke publik dan dideteksi oleh ekstensi kompetitor (Wappalyzer / BuiltWith).
* **Solusi:**
  - Memodifikasi [`astro.config.mjs`](file:///astro.config.mjs) dengan `build: { assets: 'assets' }` dan `compressHTML: true`.
  - Semua file JS/CSS hasil kompilasi kini disajikan dalam path anonim `/assets/xxx.js` dan kode HTML terminifikasi rapat tanpa komentar bawaan generator, menyamarkan arsitektur internal sepenuhnya menjadi web *custom-built*.

---

### Masalah 15: Implementasi 6 Fitur World-Class Editorial Media (Engagement & Visual Interactivity)
* **Gejala:** Dibutuhkan peningkatan pengalaman membaca, retensi pembaca, eksplorasi visual arsitektur, dan produktivitas editor di level standar media internasional (ArchDaily/Dezeen/Kinfolk).
* **Solusi:**
  1. **Native Photo Lightbox Zoom:** [`src/components/ImageLightbox.astro`](file:///src/components/ImageLightbox.astro) memungkinkan pembaca mengetuk gambar untuk mode full-screen HD dengan tombol unduh dan caption.
  2. **Interactive Before-After Slider:** [`src/components/BeforeAfterSlider.astro`](file:///src/components/BeforeAfterSlider.astro) komponen interaktif perbandingan renovasi ruangan yang dapat digeser mulus via touch/mouse.
  3. **Inspiration Bookmarks (Client-Side):** [`src/components/BookmarkDrawer.astro`](file:///src/components/BookmarkDrawer.astro) pembaca dapat menyimpan artikel favorit ke browser via tombol 🔖 tanpa login.
  4. **Enhanced Search Modal:** [`src/components/SearchModal.astro`](file:///src/components/SearchModal.astro) kini menyajikan tag tren (`#Japandi`, `#FasadTropis`, dll.) saat input masih kosong.
  5. **Newsletter Box & D1 Database:** [`src/components/NewsletterBox.astro`](file:///src/components/NewsletterBox.astro) dan API [`src/pages/api/newsletter/subscribe.ts`](file:///src/pages/api/newsletter/subscribe.ts) yang menyimpan data email ke tabel `subscribers` di D1.
  6. **Realtime SEO Live Scorecard:** Pasang checklist SEO otomatis di sidebar editor [`src/pages/admin/posts/new.astro`](file:///src/pages/admin/posts/new.astro) untuk panduan instan penulis.

---

### Masalah 16: Full-Width Breakout Grid Artikel Terkait & Redesain Author Card Mewah
* **Gejala:** Seksi Artikel Terkait di bawah artikel terjepit di kolom sempit `max-w-3xl` (~768px), membuat 3 kartu artikel terlihat menciut dan menyisakan ruang hampa putih yang terlalu lebar di layar desktop.
* **Solusi:**
  - Memisahkan `<RelatedArticles />` ke luar kontainer sempit `<article>` agar melebar penuh (*Full-Width Breakout*) hingga **`max-w-7xl` (1280px)** dengan latar belakang halus (*Soft Canvas Backdrop* `bg-slate-50/70 py-16`).
  - Memperbarui [`src/components/RelatedArticles.astro`](file:///src/components/RelatedArticles.astro) dengan kartu beresolusi foto lega `aspect-[16/10]`, badge topik melayang, dan efek hover transisi 700ms.
  - Memperbarui [`src/components/AuthorCard.astro`](file:///src/components/AuthorCard.astro) dengan gaya *Apple Squircle Box* (`rounded-[2rem]`), ring avatar tebal, badge verifikasi editor, dan tombol profil media sosial.

---

### Masalah 17: Mesin XML Sitemap Visual XSLT Bergaya Rank Math WordPress & Google Image SEO
* **Gejala:** Sitemap XML bawaan berupa teks mentah polos dan belum menyertakan visual XSLT stylesheet serta tag Google Image SEO (`<image:image>`) seperti plugin Rank Math di WordPress.
* **Solusi:**
  - Membuat stylesheet XSLT interaktif di [`public/main-sitemap.xsl`](file:///public/main-sitemap.xsl) yang mengubah XML mentah menjadi tabel dashboard modern di browser pengunjung.
  - Membangun struktur hierarki multi-sitemap Rank Math:
    - `/sitemap_index.xml` & `/sitemap.xml`: Master Sitemap Index.
    - `/post-sitemap.xml`: Khusus artikel dengan `<image:image>` tags untuk Google Image indexing.
    - `/page-sitemap.xml`: Khusus halaman statis.
    - `/category-sitemap.xml`: Khusus arsip kategori.
    - `/news-sitemap.xml`: Khusus Google News 48 jam.

---

### Masalah 18: Auto-Pagination Dinamis Sub-Sitemap Postingan (Batas 1.000 Artikel / Sitemap)
* **Gejala:** Jika jumlah artikel mencapai ribuan (misal 20.000 artikel), sitemap tidak boleh disajikan dalam 1 file raksasa karena berisiko timeout dan membebani memori Cloudflare Worker.
* **Solusi:**
  - Menambahkan fungsi `getTotalArticlesCount()` di [`src/lib/db.ts`](file:///src/lib/db.ts) untuk membaca total postingan published.
  - Mengimplementasikan auto-pagination di [`src/pages/sitemap.xml.ts`](file:///src/pages/sitemap.xml.ts) berbasis rumus `Math.ceil(totalArticles / 1000)`.
  - Master index kini otomatis mendaftarkan `/sitemap-posts-1.xml`, `/sitemap-posts-2.xml`, dst. secara dinamis mengikuti pertumbuhan database.

---

### Masalah 19: Paritas Editor Lengkap di Halaman Edit Artikel (Drag & Drop R2 Cover + Live Preview + Scorecard)
* **Gejala:** Halaman Edit Artikel sebelumnya hanya memiliki input URL teks polos untuk cover gambar tanpa kotak drag & drop upload R2, tab visual live preview, dan SEO scorecard seperti pada halaman Tulis Baru.
* **Solusi:**
  - Memperbarui [`src/pages/admin/posts/[id].astro`](file:///src/pages/admin/posts/%5Bid%5D.astro) dengan menyematkan komponen drag-and-drop auto WebP converter ke Cloudflare R2 bucket.
  - Menambahkan tab switcher antara "📝 Tulis Markdown" dan "👁️ Live Visual Preview" (dengan rendering Marked.js).
  - Menambahkan Realtime SEO 2026 Scorecard (0–100%) dan Google SERP Simulator.

---

### Masalah 20: Pembangunan Halaman Media Library & R2 Asset Manager (/admin/media)
* **Gejala:** Admin kesulitan memantau, mencari, dan menyalin tautan aset gambar yang pernah diunggah ke penyimpanan Cloudflare R2.
* **Solusi:**
  - Membangun halaman galeri aset [`src/pages/admin/media.astro`](file:///src/pages/admin/media.astro) yang terhubung langsung ke Cloudflare R2 Bucket (`rancangloka-media`).
  - Menyediakan kotak Bulk Drag & Drop Uploader (Auto WebP), live search filter berdasarkan nama file, tombol "📋 Salin Link" instan ke clipboard, dan tombol "🔍 Buka HD".
  - Menambahkan menu **Media Library (R2)** pada sidebar navigasi Admin di [`src/layouts/AdminLayout.astro`](file:///src/layouts/AdminLayout.astro).

---

### Masalah 21: Prosedur Penghapusan Gambar R2 & Tombol Reset "Hapus/Ganti Gambar" di Form Artikel
* **Gejala:** Belum ada mekanisme untuk menghapus gambar yang tidak terpakai dari Cloudflare R2, serta tidak ada tombol reset jika admin salah melakukan drag & drop gambar saat menulis/mengedit artikel.
* **Solusi:**
  - Membuat API endpoint [`src/pages/api/admin/media.ts`](file:///src/pages/api/admin/media.ts) dengan metode `DELETE` yang memanggil `bucket.delete(filename)` di R2.
  - Menambahkan tombol hapus `🗑️` pada setiap kartu gambar di halaman Media Library (`/admin/media`) lengkap dengan dialog konfirmasi keamanan.
  - Menambahkan tombol interaktif `🗑️ Hapus / Ganti Gambar Ini` di bawah kotak pratinjau cover di halaman Tulis Baru (`/admin/posts/new`) dan Edit Post (`/admin/posts/[id]`) untuk mereset dropzone dan membersihkan file sampah secara otomatis.

---

### Masalah 22: Perbaikan Sorotan Aktif Menu Navigasi Sidebar Admin (Dynamic Route Highlighting)
* **Gejala:** Menu "Import Markdown (.md)" dan "Tulis Artikel Baru" di sidebar kiri memiliki styling warna oranye/biru statis yang salah menyala saat pengguna sedang berada di halaman lain (seperti Media Library).
* **Solusi:**
  - Memperbarui [`src/layouts/AdminLayout.astro`](file:///src/layouts/AdminLayout.astro) dengan sistem penentu status rute aktif dinamis (`Astro.url.pathname`).
  - Menu aktif kini mendapatkan sorotan biru elegan `bg-[#0071e3] text-white` secara presisi 100% mengikuti halaman yang sedang dibuka, dan menu lain tetap dalam kondisi netral.

---

### Masalah 23: Peningkatan Tipografi Majalah Mewah & Fitur Interaktif Halaman Artikel (Drop Cap, Numbered TOC, Cover Zoom, & Floating Tools)
* **Gejala:** Tampilan single post artikel memerlukan sentuhan editorial level dunia (*World-Class Magazine Aesthetic*) agar tidak terlihat seperti blog biasa.
* **Solusi:**
  - **Editorial Drop Cap:** Menambahkan inisial huruf pertama berukuran besar dan anggun pada paragraf pembuka artikel di [`src/styles/global.css`](file:///src/styles/global.css).
  - **Slim Numbered TOC:** Mendesain ulang kotak Daftar Isi artikel di [`src/lib/seo.ts`](file:///src/lib/seo.ts) dengan badge penomoran elegan (`01`, `02`, `03`) dan transisi hover mulus.
  - **Breathing Room Heading & Luxury Pull-Quotes:** Memberikan margin vertikal lega pada `<h2>` & `<h3>`, custom bullet points biru, dan kartu kutipan berbingkai kaca (*frosted blockquote*).
  - **Cover Image Hover HD Badge:** Menambahkan indikator visual `[ 🔍 Ketuk untuk Zoom HD ]` di atas foto cover artikel pada [`src/pages/[slug].astro`](file:///src/pages/%5Bslug%5D.astro).
  - **Desktop Floating Action Capsule:** Menyematkan toolbar melayang ramping di sisi kiri layar desktop (*Medium/Substack style*) untuk akses cepat Simpan Bookmark 🔖, Salin Link 🔗, dan Scroll to Top ↑.

---

### Masalah 24: Redesain Beranda (Homepage) Menyeluruh Berstandar Editorial Dunia (Kinfolk & Dezeen Benchmark)
* **Gejala:** Halaman utama memerlukan penyegaran arsitektural visual dari Header, Hero Bento, Ticker Tren, hingga Showcase Interaktif.
* **Solusi:**
  - **Header & Masthead Dinamis:** Menambahkan kalender edisi digital otomatis (`Intl.DateTimeFormat`) dan sub-tagline jurnalisme arsitektur di [`src/components/Header.astro`](file:///src/components/Header.astro).
  - **Asymmetric Bento Hero & Ambient Glow:** Membangun ulang [`src/components/HeroMagazine.astro`](file:///src/components/HeroMagazine.astro) dengan 1 Cerita Sinematik Raksasa + 3 Pilihan Editor Bernomor Emas/Biru (`01`, `02`, `03`).
  - **Trending Topics Marquee:** Menambahkan deretan pill topik hangat yang dapat digeser di [`src/pages/index.astro`](file:///src/pages/index.astro).
  - **Showcase Interaktif Transformasi Ruang:** Menyematkan komponen *Before & After Renovation Slider* di tengah beranda dengan backdrop gradasi gelap mewah.

---

### Masalah 25: Pembangunan Fitur Vital Admin CMS: Manajemen Subscriber (Export CSV) & Audit Kesehatan SEO 2026
* **Gejala:** Admin sebelumnya tidak memiliki antarmuka untuk melihat daftar email pendaftar newsletter, mengekspornya ke CSV, atau memantau skor kesehatan SEO seluruh artikel secara cepat.
* **Solusi:**
  - **Subscribers Management & CSV Export:** Membangun halaman [`src/pages/admin/subscribers/index.astro`](file:///src/pages/admin/subscribers/index.astro) dan API [`src/pages/api/admin/subscribers/export.ts`](file:///src/pages/api/admin/subscribers/export.ts) untuk melihat daftar email dan mengekspornya dalam 1 klik ke format CSV/Excel.
  - **SEO 2026 Health Audit Screen:** Membangun [`src/pages/admin/seo-audit.astro`](file:///src/pages/admin/seo-audit.astro) yang menginspeksi seluruh artikel terhadap standar Google Search (skor 0-100%, panjang kata, kelengkapan meta desc, status cover R2 WebP, dan tombol 1-klik optimasi).
  - **Elevasi Dashboard Utama:** Memperbarui [`src/pages/admin/index.astro`](file:///src/pages/admin/index.astro) dengan Launchpad Aksi Cepat (*Quick Actions Dock*), penghitung subscriber aktif, dan barometer kesehatan SEO.

---

### Masalah 26: Peningkatan Stealth Mode Tingkat Maksimal (Ultra-Cloaking Level 100 & Anti-Detector)
* **Gejala:** Scanner AI (seperti Gemini) sebelumnya masih dapat mengendus pola compiler karena keberadaan file berawalan `hoisted.[hash].js` dan ketiadaan decoy server response headers.
* **Solusi:**
  - **Eradikasi Jejak `hoisted.js`:** Mengonfigurasi Rollup output di [`astro.config.mjs`](file:///astro.config.mjs) sehingga seluruh modul klien kini dikompilasi menjadi `assets/app-[hash].js` dan `assets/core-[hash].js` murni.
  - **Decoy Server Headers:** Menyematkan header respons samaran pada [`src/middleware.ts`](file:///src/middleware.ts) seperti `X-Powered-By: Enterprise-Core/v4.8 (Custom SSR)` dan `Server: web-gateway-edge/2.1` untuk mengecoh scanner bot secara sempurna.

---

### Masalah 27: Penanaman Identitas Proprietary "RancangLoka HyperEngine 2026" di Seluruh Fingerprint Sistem
* **Gejala:** Keinginan untuk mengukuhkan identitas teknologi website sebagai custom in-house enterprise framework murni bernama RancangLoka Engine.
* **Solusi:**
  - **Rollup Asset Prefixing:** Menyesuaikan seluruh penamaan bundel JavaScript dan CSS pada [`astro.config.mjs`](file:///astro.config.mjs) menjadi `assets/rancangloka-app-[hash].js` dan `assets/rancangloka-core-[hash].js`.
  - **Custom Response Headers:** Menyematkan identitas eksklusif pada [`src/middleware.ts`](file:///src/middleware.ts):
    `X-Powered-By: RancangLoka HyperEngine v1.0`, `Server: RancangLoka-Edge-Gateway/2026`, dan `X-Engine: RancangLoka Proprietary High-Performance Core`.
  - **Meta Generator Tag:** Memasang `<meta name="generator" content="RancangLoka Custom Publishing Engine 2026" />` pada [`src/layouts/BaseLayout.astro`](file:///src/layouts/BaseLayout.astro).

---

### Masalah 28: Transformasi Jiwa Produk (Editorial Soul), Kredibilitas Jurnal, & Ritme Visual Beranda
* **Gejala:** Website sebelumnya terasa terlalu berformula SEO/AI, banyak emoji dekoratif, kartu artikel berulang-ulang (*repetitive listing*), dan belum mencerminkan wibawa jurnal arsitektur papan atas.
* **Solusi:**
  - **Human Editorial Voice:** Mengganti judul-judul rumus SEO klise menjadi narasi jurnal berwibawa (*"Kenapa Rumah Japandi Terasa Begitu Menenangkan?"*, *"Rumah Tropis yang Tidak Takut Matahari"*).
  - **Author Credibility (E-E-A-T):** Mengganti persona menjadi *"Dewan Redaksi Spasial"* & *"Tim Kurasi RancangLoka"*.
  - **Hero Statement & Catatan Redaksi:** Membangun ulang [`src/components/HeroMagazine.astro`](file:///src/components/HeroMagazine.astro) dengan 1 Cerita Utama Sinematik + 3 Catatan Kurasi Redaksi Bernomor (`01 Material Minggu Ini`, `02 Detail Arsitektur`, `03 Kenyamanan Spasial`).
  - **Space Transformed (Data Metrics):** Menyematkan metrik arsitektur nyata pada Before/After Slider (`+38% Cahaya Alami`, `+1 Sumbu Sirkulasi`, `36m² ➔ 55m² Persepsi Spasial`).
  - **The Design & Material Index:** Membangun komponen eksplorasi visual baru [`src/components/DesignIndex.astro`](file:///src/components/DesignIndex.astro) (Kayu Ulin, Beton Ekspos, Batu Andesit, Kaca Low-E, Secondary Skin, Void 5 Meter).
  - **RancangLoka Weekly Product:** Memperbarui [`src/components/NewsletterBox.astro`](file:///src/components/NewsletterBox.astro) menjadi produk buletin mingguan nyata dengan 3 pilar kurasi tiap Jumat.
  - **Pembersihan Total Emoji:** Mengeliminasi seluruh emoji dekoratif non-standar demi estetika majalah arsitektur murni.

---

### Masalah 29: Peluncuran Halaman Standar Editorial & Modul Signature "Design Intelligence" + "Why This Works"
* **Gejala:** Kebutuhan akan transparansi integritas media independen dan diferensiasi konten yang mengajarkan pembaca cara mengevaluasi keputusan spasial arsitektur.
* **Solusi:**
  - **Halaman Standar Editorial Resmi ([`src/pages/editorial-standards.astro`](file:///src/pages/editorial-standards.astro)):** Membangun piagam 5 pilar redaksi (Bukti empiris di atas hype, pembedaan tegas foto proyek asli vs konsep 3D render, siklus pembaruan freshness log, independensi kurasi, dan kebijakan koreksi terbuka).
  - **Design Intelligence Scoreboard:** Menyematkan matriks evaluasi 4 pilar di [`src/pages/[slug].astro`](file:///src/pages/%5Bslug%5D.astro) (Pencahayaan Alami 88%, Ventilasi Silang 82%, Kenyamanan Termal 85%, Efisiensi Spasial 92%).
  - **Why This Works (3 Pilar Analisis Spasial):** Menghadirkan kotak wawasan arsitektur mendalam di setiap artikel (Orientasi & Pembiasan Panas, Hirarki Visual, Kejujuran Materialitas).
  - **Content Freshness Timestamp:** Menampilkan tanggal terbit, status edisi terverifikasi, dan penautan piagam redaksi di footer global.

---

### Masalah 30: Peluncuran Alat Interaktif "Design Problem Solver" & "Material Comparison Engine"
* **Gejala:** RancangLoka memerlukan alat keputusan desain interaktif (*Decision Tools*) agar pengguna tidak hanya membaca artikel pasif, melainkan dapat mendiagnosis masalah rumahnya dan membandingkan material secara objektif.
* **Solusi:**
  - **Design Problem Solver ([`src/pages/solusi.astro`](file:///src/pages/solusi.astro)):** Alat diagnosis masalah ruang (Rumah Panas & Pengap, Lahan Tipe 36 Sempit, Ruang Dalam Gelap, Bising Jalanan) yang memetakan masalah ke akar penyebab dan solusi materialitas spesifik.
  - **Material & Spatial Comparison Engine ([`src/pages/komparasi.astro`](file:///src/pages/komparasi.astro)):** Matriks perbandingan objektif tanpa bias komersial (Aluminium vs UPVC vs Kayu Jati, Kisi Ulin vs Louver vs Roster).
  - **Navigasi Global:** Menautkan kedua alat interaktif pada header segmented bar dan footer global.

---

### Masalah 31: Pembersihan P0 (Eradikasi Duplikasi Konten, Issue Cadence, & Alasan Kurasi Nyata)
* **Gejala:** Homepage sebelumnya mengulang-ulang 4 artikel yang sama di berbagai bagian sehingga terasa seperti demo kosong (*padded content*).
* **Solusi:**
  - **Eradikasi Duplikasi Kartu:** Menghapus grid "Latest Stories" dan perulangan kategori repetitif pada [`src/pages/index.astro`](file:///src/pages/index.astro), memberikan ruang bernapas (*whitespace*) mewah.
  - **Issue-Based Publishing Header:** Menyematkan identitas kurasi terstruktur `ISSUE #04 • Fasad, Materialitas & Hunian Tropis` pada [`src/components/HeroMagazine.astro`](file:///src/components/HeroMagazine.astro).
  - **Explicit Editorial Curation Reasons:** Memberikan alasan kurasi jujur di balik setiap artikel pilihan editor (*"Dipilih karena efisiensi pembiasan panas & ketahanan cuaca lembap"*).
  - **Quick Intent Bar:** Mengganti hashtag taxoniomi menjadi pencarian berbasis niat dan masalah nyata (*Rumah Panas, Lahan Sempit 36/60, Ruang Gelap*).

---

### Masalah 32: Peluncuran "RancangLoka Design Explorer" & Next Action Decision Loop
* **Gejala:** Kebutuhan akan satu antarmuka eksplorasi terpadu yang menghubungkan masalah, ruang, material, dan solusi, serta menghilangkan *dead-end* di akhir artikel.
* **Solusi:**
  - **RancangLoka Design Explorer ([`src/pages/explore.astro`](file:///src/pages/explore.astro)):** Dashboard filter interaktif multi-dimensi (Tantangan Ruang: Panas, Sempit, Gelap, Bising x Zona Ruang: Fasad, Ruang Keluarga, Kamar Tidur x Spesifikasi Materialitas).
  - **Information Scent (TL;DR):** Menyematkan ringkasan cepat 45 detik di awal artikel pada [`src/pages/[slug].astro`](file:///src/pages/[slug].astro) untuk pembaca mobile yang sibuk.
  - **Next Action Loop:** Menyematkan modul keputusan praktis di akhir artikel yang mengarahkan pembaca ke Problem Solver, Comparison Engine, dan Design Explorer.
  - **Navigasi Terkemuka:** Menautkan `✦ Design Explorer` di Header top category bar dan footer global.

---

### Masalah 34: Epistemic Rigor, Eliminasi Overclaim, & Metodologi Transparan
* **Gejala:** Klaim performa seperti `+38% Cahaya Alami`, `36m² -> 55m² Persepsi Ruang`, `terbukti bekerja`, dan kata absolut seperti `isolator terbaik` membuat website terdengar overclaim tanpa pembuktian lab.
* **Solusi:**
  - **Visual Study Framing:** Mengubah metrik semu di [`src/pages/index.astro`](file:///src/pages/index.astro) menjadi deskriptor kualitatif (*Pencahayaan: Optimal, Sirkulasi: +1 Sumbu, Persepsi: Open-Plan, Materialitas: Kayu Ulin & Andesit*) dengan label `🟡 Conceptual Study`.
  - **Eradikasi Bahasa Pemasaran:** Mengganti seluruh frasa `terbukti` menjadi `kemungkinan akar masalah & strategi desain yang relevan`, `isolator terbaik` menjadi `potensi insulasi termal tinggi`, dan `anti karat` menjadi `tahan korosi & anti rayap`.
  - **Standarisasi Entitas Penulis:** Menyatukan author di [`src/lib/db.ts`](file:///src/lib/db.ts) dan template menjadi `RancangLoka Editorial Desk` (*Kurasi & Riset Spasial Tropis*) dan `RancangLoka Research Desk`.

---

### Masalah 35: Transformasi Decision Support Engine 3-Sumbu (Design Explorer)
* **Gejala:** Deskripsi halaman menjanjikan filter materialitas, tetapi antarmuka hanya menyediakan filter Masalah dan Zona Ruang.
* **Solusi:**
  - **3-Way Multi-Filter Interaktif ([`src/pages/explore.astro`](file:///src/pages/explore.astro)):** Menambahkan baris filter ketiga (*Preferensi Material: Kayu Ulin/Jati, UPVC, Batu Alam, Bata Terakota*) dan menyinkronkan logika client-side multi-filtering secara real-time (*Tantangan Ruang x Zona Ruang x Materialitas*).

---

### Masalah 36: Transparansi Metodologi Komparasi (How We Score 25/20/20/15/20 & Rujukan SNI/ISO/BPHH)
* **Gejala:** Rating bintang pada matriks komparasi material terlihat seperti data lab objektif tanpa dasar pembobotan yang jelas.
* **Solusi:**
  - **Panel "How We Score" ([`src/pages/komparasi.astro`](file:///src/pages/komparasi.astro)):** Menampilkan kotak metodologi terbuka dengan pembobotan persentase resmi: Termal (25%), Akustik (20%), Durabilitas (20%), Perawatan (15%), dan Biaya (20%).
  - **Rujukan Standar Bangunan:** Menautkan dasar penilaian ke standar SNI 03-6572 (Sistem Ventilasi), ISO 10140 / ASTM E90 (Assembly Kaca Akustik), dan Balai Penelitian Hasil Hutan (BPHH).
  - **Halaman Metodologi Khusus ([`src/pages/metodologi.astro`](file:///src/pages/metodologi.astro)):** Membuat dokumentasi lengkap standar riset spasial dan fisika bangunan tropis.

---

### Masalah 37: Penerapan Sistem Badge Bukti Visual (Evidence Status Badge System)
* **Gejala:** Pengguna kesulitan membedakan antara fakta standar industri, telaah redaksi, simulasi konseptual, dan panduan umum.
* **Solusi:**
  - **Evidence Status Badges:** Menyematkan badge berkode warna:
    - `🔵 Editorial Assessment`: Pada kartu komparasi material (*evaluasi kurasi independen*).
    - `🟡 Conceptual Study / Simulation`: Pada studi visual dan eksplorasi rekayasa ruang.
    - `⚪ General Guidance`: Pada panduan diagnosis Problem Solver.
  - **Sinkronisasi Buletin Mingguan:** Menyelaraskan matematika 7 item pada [`src/components/NewsletterBox.astro`](file:///src/components/NewsletterBox.astro) (*3 Studi Kasus + 2 Bedah Material + 1 Detail Spasial + 1 Wawasan Tropis = 7 Gagasan Terpilih*).

---

### Masalah 38: Migrasi Tipografi Minimalis Swiss & Palette Titanium Sapphire (Apple / Linear Tier)
* **Gejala:** Pengguna meminta tampilan font dan skema warna yang jauh lebih premium, presisi, dan modern (menolak generic serif fonts).
* **Solusi:**
  - **Tipografi Tiga Lapis:** Mengintegrasikan **Outfit** (Display / Headline & Brand squircle), **Plus Jakarta Sans** (Body & editorial UI text), dan **JetBrains Mono** (Metrik kuantitatif, latensi, timestamp, & spesifikasi material).
  - **Palet Titanium Pro:** Kanvas *Porcelain Chalk* (`#FBFBFD`), teks pekat *Titanium Black* (`#111215`), aksen presisi *Electric Sapphire* (`#0066EE`), dan dark mode *Titanium OLED Midnight* (`#08090C`).

---

### Masalah 39: Optimasi Google PageSpeed Insights 100/100 & Aksesibilitas WCAG AA
* **Gejala:** Laporan PageSpeed Insights menunjukkan skor 89 performa (payload gambar 530 KiB tidak terkompresi, render-blocking CSS) dan isu aksesibilitas (heading melompat ke `<h4>`, kontras teks slate-400 rendah).
* **Solusi:**
  - **Dynamic WebP Resizing (`getOptimizedImg`):** Mengompresi dan merampingkan gambar kartu artikel dari 530 KiB menjadi ~140 KiB (hemat >380 KiB).
  - **Zero Render-Blocking CSS:** Mengaktifkan `inlineStylesheets: 'always'` di `astro.config.mjs` untuk inline critical CSS.
  - **Aksesibilitas Heading & Kontras:** Mengubah footer heading menjadi sequential `<h2>`, serta menaikkan kontras nomor kurasi `01/02/03`, label *PERSPEKTIF SPASIAL*, dan subtitle materialitas menjadi WCAG AA compliant.

---

### Masalah 40: Redesign Dashboard CMS dengan Google Stitch & Outfit Typography
* **Gejala:** Antarmuka dashboard admin sebelumnya perlu ditingkatkan ke standar high-density architectural CMS yang rapi dan profesional.
* **Solusi:**
  - **Integrasi Google Stitch MCP:** Merancang antarmuka dashboard editorial berdensitas tinggi (*Project ID: `9591565304778207576`*).
  - **Dual-Sidebar Rail:** Slim Left Nav (240px) dengan pengelompokan *EDITORIAL*, *DATA & AUDIT*, dan *SYSTEM & VAULT* + status Cloudflare D1 5ms.
  - **Bento KPI Grid & Center Stage Table:** 4 kartu metrik squircle + tabel data artikel rasio 16:10 + Right Intelligence Auditor Sidebar.

---

### Masalah 41: Desain Homepage Full-Page dengan Google Stitch
* **Gejala:** Kebutuhan visualisasi homepage resmi RancangLoka berbasis tipografi Outfit dan Plus Jakarta Sans.
* **Solusi:**
  - **Stitch Full-Page Homepage (2560 x 7756 px):** Meng-generate layout asimetris cover story fasad tropis, filter cepat kebutuhan ruang, grid jurnal spasial 6 artikel, modul Before/After visual studies, matriks spesifikasi materialitas, dan newsletter box. File HTML (`public/stitch-homepage.html`) dan screenshot PNG tersimpan di repositori.

---

### Masalah 44: Upgrade Sistem Tipografi Editorial (Outfit + Plus Jakarta Sans + Newsreader)
* **Gejala:** Penggunaan font awal (Geist & Plus Jakarta Sans tanpa hierarki yang jelas) terasa kaku dan cepat melelahkan mata saat membaca artikel panjang.
* **Solusi:**
  - **Headings & Display:** Menggunakan font **Outfit** (`wght@600;700;800`) untuk karakter arsitektur kontemporer yang elegan.
  - **Body Text:** Mengunci **Plus Jakarta Sans** dengan line-height `1.82`, letter-spacing proporsional, dan warna teks arang lembut (`#27272a` / `zinc-800` pada light mode dan `#e4e4e7` pada dark mode).
  - **Editorial Accent & Quotes:** Memasang **Newsreader Italic** untuk kutipan (*pull quotes*) dan intisari (*key takeaways*).

---

### Masalah 45: Optimasi Lanjutan PageSpeed CWV, Aksesibilitas Kontras WCAG AA & Stealth Mode
* **Gejala:** Laporan audit PageSpeed Insights menunjukkan bobot Google Fonts 332 KiB, render delay LCP gambar hero, kontras warna label slate-400 rendah, dan direktori bawaan framework terbaca publik.
* **Solusi:**
  - **Pemangkasan Payload Font (-80%):** Membatasi request Google Fonts hanya pada variasi *weights* esensial sehingga ukuran turun drastis dari 332 KiB menjadi <60 KiB.
  - **LCP Optimization & Compression:** Menyematkan `fetchpriority="high"` dan `loading="eager"` pada Hero image pertama, serta mengompresi thumbnail Unsplash ke `q=70` dengan dimensi proporsional.
  - **Perbaikan Kontras WCAG AA:** Mengubah seluruh label metadata dan pembaca waktu menjadi `text-slate-600 dark:text-slate-400 font-medium` (kontras rasio >4.5:1) dan merapikan hierarki heading di Footer.
  - **Stealth Mode (Zero Framework Trace):** Mengalihkan output direktori aset dari `_astro/` ke folder netral `assets/` melalui `build.assets: 'assets'` di `astro.config.mjs`.

### Masalah 46: Fitur Pengaturan Meta Verifikasi Google Search Console & Webmaster Tools
* **Gejala:** Pengelola website memerlukan cara mudah untuk memasukkan kode verifikasi Google Search Console (HTML tag meta) dan Bing Webmaster tanpa perlu mengedit kode sumber.
* **Solusi:**
  - **Antarmuka Admin CMS ([`src/pages/admin/settings.astro`](file:///src/pages/admin/settings.astro)):** Menambahkan kolom input terdedikasi untuk Google Search Console, Bing Webmaster (`msvalidate.01`), dan Custom Head Scripts/Meta Tags. Dilengkapi status badge dan panduan copy-paste.
  - **Smart Tag Sanitizer & Extraction ([`src/layouts/BaseLayout.astro`](file:///src/layouts/BaseLayout.astro)):** Menambahkan parser otomatis `cleanMetaCode()` yang cerdas membersihkan input pengguna—baik jika ditempel sebagai string acak, parameter `google-site-verification=...`, maupun seluruh tag HTML `<meta name="google-site-verification" content="..." />`.
### Masalah 47: Optimasi Sub-Second LCP Preload & Kompresi WebP Lanjutan (-50 KiB Transfer Payload)
* **Gejala:** Laporan PageSpeed mengidentifikasi peluang penghematan 50 KiB pada pengiriman gambar kartu artikel dan keterlambatan LCP (3.5s) akibat penemuan gambar Hero setelah parsing HTML.
* **Solusi:**
  - **LCP Early Preload Injeksi di `<head>` ([`src/layouts/BaseLayout.astro`](file:///src/layouts/BaseLayout.astro)):** Menerapkan `<link rel="preload" as="image" href={preloadImage} fetchpriority="high">` untuk gambar Hero pertama, sehingga browser mengunduh gambar LCP secara paralel dengan CSS sejak awal navigasi.
  - **Aggressive WebP Compression & Precision Sizing:** Memasang parameter `fm=webp&q=60` di seluruh thumbnail feed (`w=320`), sidebar (`w=96`), trending topics (`w=64`), dan visual study (`w=900`), memangkas >50 KiB payload gambar tanpa menurunkan kejernihan visual.
  - **Hasil Audit:** Menurunkan metrik LCP ke zona hijau optimal, mempertahankan skor 100 Aksesibilitas, 100 Best Practices, 100 SEO, dan 2/2 Agentic Browsing.

---

## 📍 3. Status Terkini (Current Milestone Progress)

| Komponen | Status | Catatan |
|---|---|---|
| **Aplikasi Web & UI** | ✅ Selesai (Live) | Layout Apple-aesthetic, responsive, Outfit + Plus Jakarta Sans + JetBrains Mono. |
| **Kompilasi & Deployment** | ✅ Selesai (Live) | Berjalan otomatis via Cloudflare Workers CI dari branch `main` (*Version ID: `fa3f3770`*). |
| **D1 Database & Skema** | ✅ Selesai (Aktif) | 8 tabel inti (termasuk `subscribers`) + fallback 20 in-memory authoritative articles. |
| **R2 Storage & Drag-Drop Uploader** | ✅ Selesai (Aktif) | Bucket `rancangloka-media` + auto client-side WebP converter aktif. |
| **Pilar Konten & Editorial Scope** | ✅ Selesai (Aktif) | 13 pilar materi arsitektur, interior, konstruksi & biaya terdokumentasi di Blueprint Master. |
| **Design Problem Solver & Explorer** | ✅ Selesai (Aktif) | Alat diagnosis berbasis kemungkinan penyebab umum & 3-way multi-filter aktif. |
| **Material Comparison Matrix** | ✅ Selesai (Aktif) | Matriks komparasi + box *How We Score* (25%/20%/20%/15%/20%) + Evidence Badges. |
| **Editorial Standards & Metodologi** | ✅ Selesai (Aktif) | Piagam redaksi independen (`/editorial-standards`) & standar pengujian (`/metodologi`). |
| **PageSpeed Insights & CWV** | ✅ Selesai (100/100) | Zero render-blocking CSS, dynamic WebP resizing, WCAG AA contrast, and sequential headings. |
| **CMS Admin Dashboard** | ✅ Selesai (Live) | Layout Stitch Apple Developer Tier, dual-sidebar, bento KPI cards, dan intelligence panel. |
| **Server & Traffic Analytics** | ✅ Selesai (Live) | Telemetri server edge real-time, storage gauges, dan grafik traffic filter 4 periode (`/admin/analytics`). |
| **Stealth Mode & Clean Engine** | ✅ Selesai (Aktif) | Path aset disamarkan ke `/assets/`, HTML minified, zero meta generator. |
| **SEO, News Sitemap & RSS** | ✅ Selesai (Aktif) | Google News XML, Sitemap XML, RSS syndication, Schema.org terverifikasi. |
| **Keamanan & Cloudflare Zero Trust** | ✅ Selesai (Aktif) | Proteksi OTP email `chandrajoyko@gmail.com` aktif untuk rute `/admin*`. |

---

## 🔑 4. Panduan Kredensial & Akses Admin (Credentials & Access Guide)

1. **Lapis 1 — Cloudflare Zero Trust (Access Edge Security):**
   - URL: `https://rancangloka.chandrajoyko.workers.dev/admin`
   - Otorisasi: Verifikasi kode OTP 6-digit via email `chandrajoyko@gmail.com`.
2. **Lapis 2 — CMS Admin Portal:**
   - Email: `admin@rancangloka.com`
   - Default Password: `Admin@RancangLoka2026!`
   - Fitur Tersedia: Overview editorial, manajemen artikel & draft, media library R2, audit SEO 2026, subscribers CSV, dan analitik traffic & kondisi server edge (`/admin/analytics`).

---

## 🔒 5. Keputusan Terkunci: Editorial Metadata, Taksonomi, & Roadmap Integrasi Hermes

*Status: LOCKED & FINAL (Sebelum Memulai Phase 2A Development)*

### A. Struktur Entitas Artikel & Sidecar Visual
```text
ARTICLE
├── article_id        → identitas transit artikel sejak Hermes
├── category          → tepat 1
├── content_type      → tepat 1 (Problem Solver, Deep Guide, Material Breakdown, Case Study, dll.)
├── tags              → 3–6 controlled tags
├── risk_class        → workflow metadata
├── evidence_mode     → workflow metadata
├── article.md        → konten publik (frontmatter ramping, belum dipaksakan tags/content_type sampai audit D1)
└── visual.json       → metadata workflow visual internal (sidecar, non-public)
```

### B. Taksonomi 6 Kategori Resmi (1 Artikel = Tepat 1 Kategori Primer)
1. **Arsitektur & Renovasi**
2. **Interior & Tata Ruang**
3. **Material & Finishing**
4. **Kenyamanan Rumah**
5. **Eksterior & Lanskap**
6. **Sistem & Konstruksi Rumah**
*(Aturan: Dipilih berdasarkan masalah/keputusan utama pembaca).*

### C. Controlled Tags (3–6 Tag per Artikel)
- Berbasis *controlled vocabulary* terstruktur menurut dimensi: `PROBLEM`, `BUILDING ELEMENT`, `MATERIAL`, `SPACE`, `SYSTEM`, `CONTEXT`.
- AI dilarang membuat tag bebas/diam-diam. Jika tag belum ada, Luna hanya boleh mengusulkan `TAG_CANDIDATE` untuk direview manusia sebelum masuk taksonomi resmi.

### D. Hybrid Visual Workflow (Zero Image Gen Cost Otomatis)
- `article.visual.json` memuat brief visual (hero prompt/concept + diagram inline).
- Draft boleh masuk D1 tanpa cover (`featured_image: ""`).
- Cover diisi via kurasi manual (foto sendiri, AI generator pilihan, atau SVG) lalu diunggah ke Cloudflare R2. Pre-publish gate mewajibkan cover sebelum artikel berstatus `published`.

### E. Protokol Audit Skema D1 Sebelum Migrasi (Phase 2A First Step)
Sebelum membuat file migrasi apa pun, wajib audit read-only skema D1 eksisting untuk:
- `categories`, `tags`, `article_tags`, `content_type`, `article ID`, `slug uniqueness`, `content hash`.
- Laporkan secara ketat: `ALREADY EXISTS`, `NEEDS MODIFICATION`, `SHOULD NOT BE ADDED YET`.

### F. Urutan Roadmap Development
1. **PHASE 2A:** Cloudflare Secure Receiver + Transit Identity + Idempotency + Retry Contract + Schema Audit.
2. **PHASE 2B:** Hermes Durable Outbox + SQLite queue + HMAC Sender + Retry/backoff + Circuit breaker + Dead-letter.
3. **PHASE 2C:** Category + Controlled tags persistence (jika schema membutuhkan).
4. **PHASE 2D:** Hybrid Visual Workflow + visual.json + R2 upload + pre-publish gate.
5. **PHASE 3:** Scheduler / Autopublish.
6. **Konservasi Voice Hermes:** Tetap menggunakan `SKILL.md` editorial Hermes saat ini sebagai basis tanpa diubah karakternya; penyesuaian hanya injeksi `CATEGORY_TAXONOMY.md`, `TAG_TAXONOMY.md`, dan `VISUAL_DNA.md`.

