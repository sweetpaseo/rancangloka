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

### HERMES-MC-9: Mission Control Role & Job Animation Layer 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Mengembangkan lapisan animasi peran dan tugas (*Role & Job Animation Layer*) untuk dasbor Pixel Office Hermes Mission Control.
  - Memastikan setiap staf menampilkan animasi visual yang sesuai secara deterministik hanya jika terdapat tugas riil yang sedang diproses (`REAL TASK` → `CAPABILITY` → `STAFF` → `JOB VISUAL STATE` → `ROLE-SPECIFIC ANIMATION`).
  - Strict Presentation-Only Invariant: Dilarang keras merekayasa aktivitas (*zero fake work*), menggerakkan staf secara acak (*zero random movement*), atau mengubah otoritas eksekusi produksi (`automation_mode = OFF`, `media_worker = DISABLED`, `JEV = shadow / zero authority`).
- **Komponen Utama yang Dibangun:**
  1. **Model Status Visual Pekerjaan (`StaffWorkVisualState`):**
     - Didefinisikan pada `src/lib/mission-control/job-animation-registry.ts`.
     - Menyimpan atribut: `agent_id`, `capability_id`, `task_id`, `task_type`, `task_status`, `task_label`, `animation_key`, `workstation_key`, `visual_detail`, `started_at`, `freshness`, `evidence_reference`, dan `is_actively_working`.
  2. **Registri Animasi Sentral (`JOB_ANIMATION_REGISTRY`):**
     - Mengelola 17 kunci animasi standar: `IDLE_STANDBY`, `ARTICLE_TYPING`, `ARTICLE_REWRITE`, `RESEARCH_BROWSING`, `EVIDENCE_READING`, `QA_REVIEW`, `QA_CHECKLIST`, `MEDIA_PROCESSING`, `MEDIA_REVIEW`, `PUBLICATION_MONITORING`, `PUBLICATION_DISPATCH`, `TELEMETRY_MONITORING`, `JEV_ANALYSIS`, `BLOCKED_WARNING`, `OFFLINE_DISABLED`, `UNKNOWN_NEUTRAL`, `WORKING_GENERIC`.
  3. **Visualisasi Spesifik Peran Staf:**
     - **Joko (Content Writer):** `ARTICLE_TYPING` (mengetik naskah) dan `ARTICLE_REWRITE` (revisi) hanya saat tugas aktif berjalan; `IDLE_STANDBY` di Lounge saat kosong.
     - **Irwan (Research & Evidence):** `RESEARCH_BROWSING` (riset standar bangunan) dan `EVIDENCE_READING` (evaluasi sitasi).
     - **Rina (Editorial QA):** `QA_REVIEW` (review naskah) dan `QA_CHECKLIST` (pemeriksaan checklist First Article Gate, bukan persetujuan otomatis).
     - **Budi (Media Operations):** Tetap `OFFLINE_DISABLED` (lencana Worker Disabled, konsol temaram, tanpa alarm) karena `media_worker = DISABLED`.
     - **Sari (Publication Operations):** `PUBLICATION_MONITORING` (pemantauan jadwal terencana) karena `automation_mode = OFF`; tidak pernah berpura-pura melakukan `PUBLICATION_DISPATCH`.
     - **Dimas (Engineering & Telemetry):** `TELEMETRY_MONITORING` dan `JEV_ANALYSIS` (hanya saat evaluasi bayangan aktif, zero publication authority).
  4. **Pembedaan Status Antrean Perintah (MC-5):**
     - `QUEUED`: Staf tetap di Lounge dengan `IDLE_STANDBY` (tidak mengetik atau bekerja prematur).
     - `RUNNING`: Staf berpindah ke workstation dan menampilkan animasi kerja spesifik peran.
     - `COMPLETED`: Animasi kerja berhenti seketika dan staf kembali ke Lounge.
  5. **Label Tugas Riil & Modal Inspektur:**
     - Menampilkan label ringkas dari judul tugas nyata (misal `Menulis: Struktur Beton Bertulang`), tanpa teks rekayasa.
     - Modal inspeksi staf menyajikan rincian animasi, deskripsi visual, status kesegaran telemetri, dan penanda `⚡ Visualisasi berdasarkan telemetry nyata`.
  6. **Aksesibilitas & Performa Ringan:**
     - Didukung penuh oleh CSS murni berakselerasi perangkat keras (zero game engine / Phaser / PixiJS).
     - Mematuhi preferensi `prefers-reduced-motion` (menonaktifkan seluruh loop animasi dan pernapasan tanpa menghilangkan konteks spasial dan teks).
- **Pengujian & Verifikasi:**
  - Membuat test suite `scripts/test-mission-control-job-animation.js` (21 skenario uji lulus 100%).
  - Menjalankan seluruh rangkaian regresi Mission Control (MC-1 s.d. MC-8, soak safety, TypeScript typecheck, Astro build) dengan hasil lulus 100%.
  - Verifikasi browser live pada production URL (`https://rancangloka.com/admin/mission-control/office`) memvalidasi tampilan denah, tata letak staf, lencana siaga/offline, dan interaktivitas modal inspektur.
- **Deployment Produksi:**
  - Deployment presentasi berhasil ke Cloudflare Workers (`npx wrangler deploy`).
  - Current Version ID: `b2f29a65-643c-4ce3-9e5e-8af93c3cc560`.
  - Zero schema change / zero database migration.
- **Status Akhir:**
  - `HERMES-MC-9 = COMPLETE`.
  - Frontier saat ini: `HERMES-MC-9/COMPLETE`.

### HERMES-MC-8: Mission Control Production Hardening & Go-Live Readiness 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Melakukan audit kesiapan produksi komprehensif, verifikasi skema database D1, audit autentikasi/otorisasi, mitigasi kebocoran rahasia, penerapan migrasi produksi, deployment terkendali Cloudflare Workers, dan pengujian asap live (smoke testing) untuk seluruh tumpukan Hermes Mission Control (MC-1 s.d. MC-7).
  - Invarian Keselamatan Produksi Wajib (Strict Safety Invariants):
    - `automation_mode = OFF` dipertahankan secara absolut.
    - `media_worker = DISABLED` dipertahankan secara absolut.
    - `JEV_MODE = shadow` (otoritas eksekusi = 0) dipertahankan secara absolut.
    - Zero autonomous article publication (tidak ada artikel yang diterbitkan otomatis).
    - Zero real media jobs (tidak ada eksekusi AI/gambar berbayar fiktif).
    - Zero Social activation (departemen Social tetap nonaktif / unstaffed).
    - Mission Control beroperasi secara murni sebagai infrastruktur pengawasan operasional (*supervisory infrastructure*).
- **Audit & Eksekusi Migrasi Produksi (Cloudflare D1):**
  - Mengaudit status migrasi remote D1 `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`):
    - `0024_mission_control_chat_and_commands.sql`: Dinilai `MIGRATION_0024_SAFE = true` (100% aditif, membuat tabel `mission_control_conversations`, `mission_control_messages`, `mission_control_commands` beserta indeks terkait tanpa DROP atau ALTER destruktif).
    - `0025_mission_control_anomalies.sql`: Dinilai `MIGRATION_0025_SAFE = true` (100% aditif, membuat tabel `mission_control_anomalies`, `mission_control_anomaly_events` beserta indeks terkait tanpa modifikasi tabel inti).
  - Menerapkan kedua migrasi secara terpisah dan berurutan pada basis data remote D1 produksi (`npx wrangler d1 migrations apply rancangloka_db --remote`).
  - Memverifikasi keberadaan seluruh tabel dan indeks baru, serta memvalidasi invarian jumlah baris tabel inti sebelum vs sesudah migrasi: `articles = 6`, `article_publication_plans = 1`, `media_jobs = 0`, `publication_execution_receipts = 1`, `automation_control.mode = OFF`, `kill_switch_engaged = 0` (zero unexpected delta).
- **Audit Autentikasi & Otorisasi:**
  - Seluruh rute antarmuka pengguna (`/admin/mission-control`, `/staff`, `/departments`, `/office`, `/alerts`, `/staff/[agent_id]/chat`) dilindungi middleware sesi admin. Permintaan tanpa autentikasi dialihkan dengan kode HTTP 302 ke `/admin/login`.
  - Seluruh endpoint API internal (`/api/admin/mission-control/state`, `/alerts`, `/chat/[agent_id]`) dilindungi dan mengembalikan HTTP 401 UNAUTHORIZED untuk permintaan tanpa sesi valid.
  - Perintah chat divalidasi dengan model otoritas 4-tier: permintaan `READ_ONLY` dijawab dari telemetri; perintah `OPERATOR_COMMAND` dimasukkan ke antrean teraudit; permintaan tingkat tinggi `ADMIN_CONTROL` (misal aktivasi worker/kill switch) dan `DANGEROUS_PRODUCTION_ACTION` (misal force publish, raw SQL, raw shell) ditolak fail-closed dengan kode kesalahan eksplisit.
- **Deployment Produksi Cloudflare Workers:**
  - Build produksi Astro dan deployment Cloudflare Workers berhasil (`npm run deploy`):
    - **Deployment Version ID:** `5caeb3bf-91e6-4bc2-b67b-c1765b2a3110` (aktif 100% di produksi).
    - **Previous Deployment Version:** `fa1c8b93-b410-4800-8296-f4c88e5d809e`.
    - **Source Git Commit:** `97e4eb90c07b0ccf703dd8423f8971b37b837253`.
- **Pengujian Asap & Verifikasi Live (Smoke Tests):**
  - Uji negatif keamanan live memverifikasi pengalihan 302 dan respons 401 fail-closed pada domain publik `https://rancangloka.com`.
  - Uji interaksi live pada tabel D1 memverifikasi persistensi percakapan staf (`conv_evidence_researcher_lead`) dan penolakan otomatis perintah di luar allowlist (`COMMAND_NOT_ALLOWED`) tanpa eksekusi mutasi operasional.
  - Uji anomali memverifikasi kondisi istirahat terencana (`media_worker = DISABLED`, `automation_mode = OFF`) dipetakan sebagai status yang diharapkan (`EXPECTED` / `INFO`) tanpa memicu alarm merah darurat.
  - Seluruh suite pengujian lokal (MC-1 s.d. MC-7, soak safety, TypeScript typecheck, Astro production build) lulus 100%.
- **Dokumentasi & Prosedur Rollback:**
  - Membuat dokumen panduan operasional dan kesiapan go-live: `docs/HERMES_MC_8_PRODUCTION_HARDENING.md`.
  - Mendokumentasikan prosedur rollback cepat Cloudflare Worker (`npx wrangler rollback fa1c8b93-b410-4800-8296-f4c88e5d809e`), strategi forward-fix skema D1, serta saklar darurat global (Emergency Kill Switch).
- **Status Akhir:**
  - `HERMES-MC-8 = COMPLETE`.
  - Klasifikasi Go-Live: **`PRODUCTION_READY`**.
  - Frontier saat ini: `HERMES-MC-8/COMPLETE`.
  - Seluruh target milestone Hermes Mission Control (MC-1 s.d. MC-8) telah selesai diimplementasikan, dikeraskan, dimigrasikan, dan diterapkan di lingkungan produksi.

### HERMES-MC-7: Extensible Department Architecture & Organizational Expansion Framework 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Mengonversi arsitektur organisasi Mission Control dari struktur 6 departemen dan 6 staf yang bersifat fixed/hardcoded menjadi kerangka kerja extensible berbasis kontrak registri modular:
    1. **Kontrak Registri Kapabilitas (`MissionControlCapabilityDefinition`):** Mendefinisikan kapabilitas mesin operasional kanonikal (`ARTICLE_WRITING`, `EVIDENCE_RESEARCH`, `EDITORIAL_QA`, `MEDIA_OPERATIONS`, `PUBLICATION_OPERATIONS`, `SYSTEM_TELEMETRY`, `SOCIAL_DISTRIBUTION`), keluarga perintah (`command_families`), read models, dan kelas anomali.
    2. **Kontrak Plugin Departemen (`MissionControlDepartmentDefinition`):** Mendefinisikan unit organisasi, ketersediaan operasional, adapter kesehatan/tugas/aktivitas, metadata ruangan, zona kerja, urutan tampil, dan fungsionalitas registrasi dinamis (`registerDepartment`, `unregisterDepartment`, `resetDepartmentRegistry`, `getRegisteredDepartments`).
    3. **Kontrak Registri Peran Staf (`MissionControlStaffDefinition`):** Menstandarisasi model identitas staf persona manusia di atas ID mesin kanonikal, mendukung pemetaan kapabilitas fleksibel, serta registrasi dinamis (`registerStaffMember`, `unregisterStaffMember`, `resetStaffRegistry`, `getStaffDefinitions`).
  - Menghilangkan asumsi organisasi kaku dari komponen generik:
    - Pixel Office merender ruangan secara dinamis dari `getRegisteredDepartments()` dengan ruang `Executive Lounge` (`lounge`) terintegrasi sebagai area rehat siaga bersama. Ruang yang belum tersedia secara runtime dirender sebagai `COMING LATER • NOT AVAILABLE`.
    - Pixel Office merender sprite karakter secara dinamis dari seluruh staf aktif yang terdaftar dalam registri.
    - Atribusi tugas (`attributeTaskOwnership`) mendukung perutean berbasis kapabilitas (`task.capability_id -> capability -> department -> staff`) serta pencocokan subsystem departemen terdaftar, dengan fallback fail-safe ke `UNASSIGNED`.
    - Perutean anomali (`routeAnomalyByCapability`) memetakan anomali ke departemen dan staf berdasarkan metadata kapabilitas terdaftar.
    - Penemuan perintah chat (`getAllowlistedCommandsForAgent`) menyelesaikan allowlist perintah dari kapabilitas staf tanpa eksekusi arbitrer.
  - Membangun model baca terpadu organisasi: `getMissionControlOrganization(snapshot)` dan endpoint API `/api/admin/mission-control/organization`.
  - Mempertahankan integritas departemen Social: `social` tetap terdaftar dengan status `NOT_AVAILABLE` dan `is_staffed: false` tanpa pembuatan agen palsu atau pipa penerbitan media sosial fiktif (track independen `SOCIAL-S0+`).
- **Pengujian & Validasi:**
  - Rangkaian pengujian ekspansi terfokus `scripts/test-mission-control-expansion.js` lulus 100% (12/12 tes) memverifikasi: registrasi dinamis departemen/staf/kapabilitas, penolakan duplikasi ID, resolusi kepemilikan kapabilitas, atribusi tugas & anomali dinamis, resolusi allowlist chat, ruangan & sprite Pixel Office dinamis, pemisahan display name vs machine ID, invarian unstaffed Social, model organisasi kanonikal, serta integritas deregistrasi dan reset.
  - Pengujian Anomali `scripts/test-mission-control-anomalies.js` lulus 100% (20/20 tes).
  - Pengujian Chat `scripts/test-mission-control-chat.js` lulus 100% (20/20 tes).
  - Pengujian Pixel Office `scripts/test-mission-control-pixel-office.js` lulus 100% (20/20 tes).
  - Pengujian Departemen `scripts/test-mission-control-departments.js` lulus 100% (18/18 tes).
  - Pengujian Staff Registry `scripts/test-staff-registry.js` lulus 100% (16/16 tes).
  - Pengujian Mission Control `scripts/test-mission-control.js` lulus 100% (10/10 tes).
  - Pengujian regresi keselamatan `scripts/test-soak-safety.js` lulus 100% (54/54 tes).
  - Validasi tipe `npx tsc --noEmit` lulus bersih tanpa kesalahan.
  - Build produksi `npm run build` sukses (4.80s).
- **Status Akhir:**
  - `HERMES-MC-7 = COMPLETE`.
  - Frontier saat ini: `HERMES-MC-8/READY`.

### HERMES-MC-6: Mission Control Anomaly Detection & Staff Escalation 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Membangun lapisan normalisasi anomali kanonikal dan eskalasi staf otomatis untuk Hermes Mission Control pada rute `/admin/mission-control/alerts` dan API `/api/admin/mission-control/alerts`.
  - Mengisolasi kondisi terencana (*Expected Dormancy*, seperti `media_worker = DISABLED` dan `automation_mode = OFF`) sebagai `INFO` / `EXPECTED` sehingga tidak memicu alarm palsu, eskalasi darurat, atau kenaikan badge counter.
  - Menerapkan model anomali deterministik `MissionControlAnomaly` yang menormalisasi kegagalan retry media, breaker open, kill switch aktif, fallback/error JEV, detak jantung scheduler stale/offline, antrean dead-letter outbox, serta kegagalan validasi/QA naskah.
  - Memetakan anomali ke staf penanggung jawab secara deterministik (Budi: Media, Sari: Publikasi, Dimas: Telemetri/Jev, Joko: Penulisan, Rina: QA, Irwan: Riset). Masalah infrastruktur yang ambigu dibiarkan unassigned (`responsible_agent_id = null`) tanpa menyalahkan staf persona.
  - Menerapkan deduplikasi cerdas berbasis fingerprint (`createAnomalyFingerprint`): anomali berulang menaikkan `occurrence_count` dan memperbarui `last_seen_at` tanpa menduplikasi baris database atau membanjiri pesan chat.
  - Menghubungkan anomali ke Pixel Office: sprite staf dan denah ruang menampilkan indikator peringatan visual proporsional tanpa animasi kepanikan berlebihan.
  - Menghubungkan eskalasi staf ke chat MC-5: saat anomali actionable pertama kali terdeteksi pada staf, sistem mengirimkan pesan laporan operasional ke thread staf. Pesan ini 100% informasional dan tidak memiliki otoritas eksekusi perintah otomatis.
  - Deteksi pemulihan otomatis (*Automatic Resolution*): ketika kondisi yang mendasarinya pulih (misal heartbeat kembali sehat atau circuit breaker tertutup), anomali bertransisi menjadi `RESOLVED` dengan timestamp `resolved_at` dan dipertahankan dalam riwayat audit.
  - Menjaga invarian read-only murni: snapshot generator dan Alert Center memiliki 0 mutasi remediasi sembrono (tanpa tombol coba ulang, tanpa paksa terbit, tanpa bypass breaker).
- **Skema Database & Persistensi (Migration 0025):**
  - `mission_control_anomalies`: Menyimpan anomali ternormalisasi, fingerprint, status siklus hidup, dan counter rekurensi.
  - `mission_control_anomaly_events`: Menyimpan riwayat audit kejadian transisi anomali.
- **Pengujian & Validasi:**
  - Rangkaian pengujian terfokus `scripts/test-mission-control-anomalies.js` lulus 100% (20/20 tes) memverifikasi: deteksi retry exhausted, isolasi worker disabled & automation OFF sebagai EXPECTED, penanganan JEV fallback, circuit breaker OPEN, heartbeat stale/offline, dead-letter outbox, stabilitas fingerprint, supresi duplikasi, penugasan staf deterministik, isolasi isu infrastruktur ambigu, overlay Pixel Office, pengaruh ke kesehatan departemen, pesan eskalasi chat tunggal tanpa spam, pembaruan eskalasi keparahan, resolusi otomatis & retensi riwayat, redaksi rahasia, serta ketiadaan kontrol mutasi/remediasi berbahaya.
  - Pengujian Chat `scripts/test-mission-control-chat.js` lulus 100% (20/20 tes).
  - Pengujian Pixel Office `scripts/test-mission-control-pixel-office.js` lulus 100% (20/20 tes).
  - Pengujian Departemen `scripts/test-mission-control-departments.js` lulus 100% (18/18 tes).
  - Pengujian Staff Registry `scripts/test-staff-registry.js` lulus 100% (16/16 tes).
  - Pengujian Mission Control `scripts/test-mission-control.js` lulus 100% (10/10 tes).
  - Pengujian regresi keselamatan `scripts/test-soak-safety.js` lulus 100% (54/54 tes).
  - Validasi tipe `npx tsc --noEmit` lulus bersih tanpa kesalahan.
  - Build produksi `npm run build` sukses (4.91s).
- **Status Akhir:**
  - `HERMES-MC-6 = COMPLETE`.
  - Frontier saat ini: `HERMES-MC-7/READY`.

### HERMES-MC-5: Direct Staff Interaction & Safe Operator Command Queue 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Mengimplementasikan interaksi percakapan langsung antara operator dan staf bernama Mission Control (Joko, Irwan, Rina, Budi, Sari, Dimas) melalui antarmuka thread percakapan persisten (`/admin/mission-control/staff/[agent_id]/chat`) dan API terautentikasi (`/api/admin/mission-control/chat/[agent_id]`).
  - Menetapkan prinsip dasar keselamatan sistem: identitas staf manusia adalah identitas presentasi (*presentation identity*) dan BUKAN daemon eksekusi otonom. Tidak ada eksekusi shell, raw SQL, atau MCP tanpa batas dari teks bebas operator.
  - Membangun antrean perintah operator berstruktur (*Safe Operator Command Queue*) yang memisahkan tingkat otoritas:
    - `READ_ONLY`: Kueri operasional langsung dieksekusi terhadap read-model snapshot tanpa mutasi.
    - `OPERATOR_COMMAND`: Perintah dalam allowlist masuk ke antrean tugas kanonikal berstatus `QUEUED`.
    - `ADMIN_CONTROL`: Perintah kontrol sistem ditolak dengan `ADMIN_APPROVAL_REQUIRED`.
    - `DANGEROUS_PRODUCTION_ACTION`: Aksi produksi berbahaya (publish, buka kunci) ditolak secara tegas (`DANGEROUS_ACTION_FORBIDDEN`).
  - Menerapkan normalisasi intensi deterministik (`normalizeOperatorIntent`) dan resolusi entitas fail-closed (`resolveEntityReference`) yang menolak rujukan ambigu (`tadi`, `terakhir`, `barusan`, tanpa ID/slug jelas) dan menuntut klarifikasi operator di dalam thread.
  - Menghilangkan theatrical realism (tidak ada fake typing, tidak ada simulated progress, tidak ada fake presence/online indicators).
  - Mengintegrasikan navigasi chat dari modal Pixel Office (`/admin/mission-control/office`) dan panel Staff Registry (`/admin/mission-control/staff`).
- **Skema Database & Persistensi (Migration 0024):**
  - `mission_control_conversations`: Menyimpan thread percakapan per staf machine `agent_id`.
  - `mission_control_messages`: Menyimpan pesan dengan tipe `TEXT`, `COMMAND_REQUEST`, `COMMAND_STATUS`, `TASK_RESULT`, `SYSTEM_NOTICE`, `ERROR`, serta tautan `related_command_id` dan `related_task_id`.
  - `mission_control_commands`: Menyimpan antrean perintah dengan status siklus hidup (`QUEUED`, `ACCEPTED`, `RUNNING`, `COMPLETED`, `REJECTED`, `BLOCKED`, `FAILED`, `CANCELLED`).
  - Redaksi rahasia otomatis pada pesan dan input menggunakan `redactSensitiveString`.
- **Pengujian & Validasi:**
  - Rangkaian pengujian terfokus `scripts/test-mission-control-chat.js` lulus 100% (20/20 tes) memverifikasi: persistensi percakapan & pesan, resolusi agent_id stabil, eksekusi kueri read-only, antrean perintah allowlisted, penolakan eskalasi otoritas, resolusi entitas ambigu fail-closed, penolakan staf tidak dikenal, deteksi mismatch kapabilitas, siklus hidup antrean perintah, tautan referensi tugas, redaksi rahasia, keamanan SQL/shell, dan pencegahan kontrol admin/publikasi via chat.
  - Pengujian Pixel Office `scripts/test-mission-control-pixel-office.js` lulus 100% (20/20 tes).
  - Pengujian Departemen `scripts/test-mission-control-departments.js` lulus 100% (18/18 tes).
  - Pengujian Staff Registry `scripts/test-staff-registry.js` lulus 100% (16/16 tes).
  - Pengujian Mission Control `scripts/test-mission-control.js` lulus 100% (10/10 tes).
  - Pengujian regresi keselamatan `scripts/test-soak-safety.js` lulus 100% (54/54 tes).
  - Validasi tipe `npx tsc --noEmit` lulus bersih tanpa kesalahan.
  - Build produksi `npm run build` sukses (4.91s).
- **Status Akhir:**
  - `HERMES-MC-5 = COMPLETE`.
  - Frontier saat ini: `HERMES-MC-6/READY`.

### HERMES-MC-4: RancangLoka Pixel Office — Spatial Operations Visualization 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Membangun visualisasi spasial 2D Pixel Office pertama untuk Hermes Mission Control pada rute `/admin/mission-control/office` dan API `/api/admin/mission-control/office`.
  - Menerjemahkan status operasional nyata staf dan departemen ke dalam denah kantor spasial retro deterministik (bukan simulasi game; tanpa fabrikasi tugas, tanpa berkeliaran/wandering acak, tanpa obrolan sintetis).
  - Mengamankan invarian pengawasan *read-only*: dilarang menerapkan chat staf langsung, eksekusi perintah, tombol publish, tombol retry, pengaktifan media worker, pengubahan otomasi publikasi, maupun otoritas JEV.
  - Memetakan staf dan ruangan secara deterministik:
    - `WORKING`: Staf berada di meja kerja departemen masing-masing (Joko di meja tulis editorial, Irwan di lab riset, Budi di konsol media, Sari di konsol publikasi, Dimas di konsol telemetri).
    - `REVIEWING`: Rina ditempatkan di meja review editorial (`editorial_review_desk`).
    - `IDLE`: Staf siaga ditempatkan di Executive Lounge (`lounge_seat_1` .. `6`).
    - `BLOCKED`: Staf tetap di departemen dengan suar peringatan kritis berdenyut (*pulsing warning beacon*).
    - `OFFLINE`: Membedakan secara visual penonaktifan sengaja (Budi: `media_worker = DISABLED` ditampilkan sebagai `Worker Disabled`, redup/dimmed, tanpa suar darurat merah) vs kegagalan telemetri (daemon offline ditampilkan `Offline` dengan peringatan).
    - `UNKNOWN`: Posisi netral di ruang asal dengan label eksplisit `UNKNOWN`.
    - `social_room`: Secara ketat unstaffed dan berlabel jelas `COMING LATER • NOT AVAILABLE`.
  - Menggunakan aset SVG pixel-art lokal berbobot ultra-ringan (`image-rendering: pixelated;`), tanpa engine game berat (bebas Phaser/Unity), serta mendukung penuh preferensi aksesibilitas `prefers-reduced-motion`.
- **Komponen & Arsitektur Terpasang (`src/lib/mission-control/pixel-office.ts`):**
  1. **Registri Posisi Kantor (`OFFICE_POSITIONS`):** 13 titik koordinat persentase stabil di 6 ruangan departemen, lounge, dan social bay kosong.
  2. **Evaluasi Alasan Status (`evaluateStateReason`):** Pembedaan deterministik antara `INTENTIONAL_DISABLED` vs `TELEMETRY_OFFLINE`.
  3. **Penurunan Spasial Sprite (`deriveSpriteSpatialState`):** Pemetaan posisi non-overlapping, penentuan mode visual (`ACTIVE`, `IDLE`, `REVIEWING`, `BLOCKED`, `DIMMED`, `UNKNOWN`), dan tingkat peringatan.
  4. **Master Assembler Snapshot (`getPixelOfficeState`):** Agregasi snapshot spasial kantor lengkap dengan metrik ringkasan staf, ruangan, dan event aktivitas riil D1.
- **Antarmuka & Rute Web:**
  - **Halaman Pixel Office (`/admin/mission-control/office.astro`):** Denah kantor 2D retro bergaya pixel art modern, 6 kartu ruangan departemen/lounge/social, sprite karakter SVG dengan ciri visual unik (rompi & kacamata Joko, seragam riset Irwan, kardigan QA Rina, earphone teknisi Budi, seragam dispatch Sari, hoodie terminal Dimas), status bar operasional, strip aktivitas riil D1, serta modal inspeksi murni read-only untuk staf dan ruangan.
  - **API Pixel Office (`/api/admin/mission-control/office.ts`):** Rute GET terautentikasi sesi admin untuk pertukaran data JSON status spasial kantor.
  - **Integrasi Navigasi (`AdminLayout.astro`, `index.astro`, `staff.astro`, `departments/index.astro`):** Penambahan sub-navigasi 4 tab (Cockpit, Staff Registry, Departemen, Pixel Office) dan breadcrumbs admin.
- **Pengujian & Validasi:**
  - Rangkaian pengujian terfokus `scripts/test-mission-control-pixel-office.js` lulus 100% (20/20 tes) memverifikasi: validitas kunci avatar, ruang asal staf, resolusi posisi, pemetaan WORKING/IDLE/REVIEWING/BLOCKED/OFFLINE/UNKNOWN, pembedaan worker disabled tanpa alarm palsu, kestabilan posisi tanpa tumpang tindih, ruang Social kosong, sifat model read-only (nol mutasi), dukungan reduced-motion, dan akurasi counter ringkasan.
  - Pengujian Departemen `scripts/test-mission-control-departments.js` lulus 100% (18/18 tes).
  - Pengujian Staff Registry `scripts/test-staff-registry.js` lulus 100% (16/16 tes).
  - Pengujian Mission Control `scripts/test-mission-control.js` lulus 100% (10/10 tes).
  - Validasi tipe `npx tsc --noEmit` lulus bersih tanpa kesalahan.
  - Build produksi `npm run build` sukses (5.30s).
  - Pengujian regresi keselamatan `test-soak-safety.js` (54 tes) lulus sempurna.
- **Status Akhir:**
  - `HERMES-MC-4 = COMPLETE`.
  - Frontier saat ini: `HERMES-MC-5/READY`.

### HERMES-MC-3: Mission Control Department Operations & Organizational State 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Mentransformasikan model staf MC-2 menjadi model organisasi kanonikal Mission Control yang deterministik dan read-only di `/admin/mission-control/departments` dan `/admin/mission-control/departments/[department_id]`.
  - Mendaftarkan 6 departemen kanonikal (`editorial`, `research_evidence`, `media`, `publication_operations`, `engineering_telemetry`, `social`), dengan departemen `social` secara tegas berstatus `NOT_AVAILABLE` dan `UNSTAFFED`.
  - Menetapkan model kesehatan departemen dengan hierarki presedensi ketat:
    $$\text{NOT\_AVAILABLE} \succ \text{UNKNOWN} \succ \text{BLOCKED} \succ \text{OFFLINE} \succ \text{DEGRADED} \succ \text{ACTIVE} \succ \text{HEALTHY}$$
  - Memetakan kepemilikan tugas (*Task Ownership*) secara deterministik dengan tingkat kepercayaan (`EXACT`, `DERIVED`, `UNASSIGNED`).
  - Membangun model penyerahan lintas-divisi (*Organizational Handoff Model*) berbasis bukti nyata alur artikel (Riset $\rightarrow$ Penulisan Editorial $\rightarrow$ Operasi Media $\rightarrow$ Publikasi) tanpa merekayasa transisi fiktif.
  - Membangun model hambatan struktural (*Department Blockers*) yang merinci keparahan, kelas kesalahan, sifat retryable, dan kebutuhan tindakan operator.
  - Menyiapkan metadata visual Pixel Office (`room_key`, `workstation_zone`, `STAFF_ROOM_MAP`) untuk persiapan MC-4 tanpa mengimplementasikan kanvas/sprite prematur.
- **Komponen & Arsitektur Terpasang (`src/lib/mission-control/department-registry.ts`):**
  1. **Konfigurasi Departemen Kanonikal:** Definisi 6 divisi, kapabilitas, sistem sumber, dan alokasi ruang logis.
  2. **Atribusi Kepemilikan Tugas (`attributeTaskOwnership`):** Pemetaan tahapan tugas (`writing`, `researching`, `validating`, `editorial_qa`, `waiting_media`, `scheduled`, `ingesting`) ke departemen dan staf penanggung jawab.
  3. **Atribusi Kejadian Departemen (`attributeActivityToDepartment`):** Klasifikasi multi-tabel log audit ke departemen dengan penanda keyakinan.
  4. **Penurunan Hambatan Struktural (`deriveDepartmentBlockers`):** Ekstraksi kendala nyata dari saklar darurat global, pemutus sirkuit terbuka, kegagalan tugas media, dan error provider.
  5. **Model Transisi Alur Kerja (`deriveDepartmentHandoffs`):** Pemetaan status handoff (`PENDING`, `READY`, `COMPLETE`, `BLOCKED`) antar-divisi berdasarkan status relasional D1.
  6. **Penurunan Kesehatan Departemen (`deriveDepartmentHealth`):** Evaluasi kesehatan murni tanpa efek samping berbasis presedensi ketat.
  7. **Assembler Snapshot Organisasi (`getOrganizationSnapshot`, `getDepartmentById`):** Agregasi ringkasan global metrik organisasi dan status spesifik divisi.
- **Antarmuka & Rute Web:**
  - **Halaman Ringkasan Departemen (`/admin/mission-control/departments/index.astro`):** Ringkasan 7 status kesehatan organisasi, diagram alur sekuensial kanonikal, kartu divisi responsif dengan indikator dot beranimasi, dan metrik tugas aktif/hambatan.
  - **Halaman Detail Departemen (`/admin/mission-control/departments/[department_id].astro`):** Dasbor inspeksi mendalam: rincian bukti kesehatan, daftar staf anggota dan statusnya, daftar tugas teratribusi, hambatan aktif, alur handoff, dan kapabilitas.
  - **API Departemen (`/api/admin/mission-control/departments`, `/api/admin/mission-control/departments/[department_id]`):** Endpoint GET terautentikasi sesi admin untuk pertukaran data JSON.
  - **Integrasi Navigasi (`AdminLayout.astro`, `index.astro`, `staff.astro`):** Penambahan sub-navigasi tiga tab (Cockpit, Staff Registry, Departemen) dan breadcrumbs admin.
- **Pengujian & Validasi:**
  - Rangkaian pengujian terfokus `scripts/test-mission-control-departments.js` lulus 100% (18/18 tes) mencakup seluruh invarian: presedensi kesehatan, keanggotaan staf, penanganan Social unstaffed, atribusi tugas dan aktivitas, penurunan handoff nyata, isolasi blocker, metadata ruang Pixel Office, dan sifat read-only murni (0 mutasi).
  - Pengujian Staff Registry `scripts/test-staff-registry.js` lulus 100% (16/16 tes).
  - Pengujian Mission Control `scripts/test-mission-control.js` lulus 100% (10/10 tes).
  - Validasi tipe `npx tsc --noEmit` lulus bersih tanpa kesalahan.
  - Build produksi `npm run build` sukses membuat artefak Cloudflare Worker (6.72s).
  - Pengujian regresi keselamatan `test-soak-safety.js` (54 tes) lulus sempurna.
- **Status Akhir:**
  - `HERMES-MC-3 = COMPLETE`.
  - Frontier saat ini: `HERMES-MC-4/READY`.

### HERMES-MC-2: Staff Identity & Capability Registry Implementation 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Membangun registri staf presentasi human-friendly di Mission Control pada rute `/admin/mission-control/staff` dan API `/api/admin/mission-control/staff`.
  - Memisahkan identitas tampilan berbasis persona manusia (Joko, Irwan, Rina, Budi, Sari, Dimas) dengan identitas mesin kanonikal (`agent_id`), di mana identitas mesin tetap otoritatif untuk seluruh perutean, atribusi tugas, dan evaluasi status.
  - Memungkinkan konfigurasi nama tampilan terpusat (`configureStaffDisplayNames`) tanpa mengubah perutean runtime maupun skema database.
  - Menerapkan penurunan status operasional riil (`WORKING`, `IDLE`, `REVIEWING`, `BLOCKED`, `OFFLINE`, `UNKNOWN`) 100% berbasis telemetri nyata tanpa fabrikasi tugas atau status simulasi.
  - Menetapkan aturan tugas saat ini (*Current Task*) berdasarkan prioritas kanonikal (1: aktif, 2: terblokir/gagal, 3: review, 4: tugas relevan terakhir), dengan fallback tegas ke `null` bila tidak ada tugas yang valid.
  - Mengamankan invarian keselamatan:
    - Pekerja media dalam status `DISABLED` tidak boleh membuat Budi (`lokamedia_worker_primary`) tampil dalam status `WORKING`.
    - Otomasi publikasi dalam status `OFF` tidak otomatis dianggap sebagai kesalahan/error, melainkan siaga normal (`IDLE`).
    - TypeSafe Jev beroperasi murni dalam mode bayangan (*shadow*), dan Dimas (`telemetry_observer_jev`) tidak pernah direpresentasikan memiliki otoritas publikasi.
    - Modul bersifat *supervisory read-only*: tanpa tombol perintah, chat, eksekusi ulang, atau mutasi produksi.
  - Mempersiapkan kunci avatar stabil (`avatar_key`) untuk integrasi masa depan Pixel Office.
- **Komponen & Arsitektur Terpasang (`src/lib/mission-control/staff-registry.ts`):**
  1. **Registri Staf Awal:**
     - Joko (`content_writer_primary`, Content Writer, Editorial, `ARTICLE_WRITING`, `editorial_writer_01`).
     - Irwan (`evidence_researcher_lead`, Research & Evidence Specialist, Research & Evidence, `EVIDENCE_RESEARCH`, `research_evidence_01`).
     - Rina (`editorial_qa_primary`, Editorial QA, Editorial, `EDITORIAL_QA`, `editorial_qa_01`).
     - Budi (`lokamedia_worker_primary`, Media Operations, Media, `MEDIA_OPERATIONS`, `media_ops_01`).
     - Sari (`publication_dispatcher_core`, Publication Operator, Publication Operations, `PUBLICATION_OPERATIONS`, `publication_ops_01`).
     - Dimas (`telemetry_observer_jev`, Decision & Telemetry Analyst, Engineering & Telemetry, `SYSTEM_TELEMETRY`, `telemetry_01`).
  2. **Registri Departemen:** Penyiapan metadata 6 departemen (`editorial`, `research_evidence`, `media`, `publication_operations`, `engineering_telemetry`, `social`). Departemen `social` ditandai belum tersedia dan tanpa staf.
  3. **Atribusi Aktivitas Deterministik (`attributeActivityEvent`):** Pemetaan kejadian riil multi-tabel ke staf terkait, dengan fallback ke `System` / `Unassigned` untuk kejadian ambigu atau berkeyakinan rendah.
  4. **Penurunan Status & Tugas Riil (`deriveStaffState`, `deriveStaffCurrentTask`):** Logika evaluasi murni tanpa efek samping untuk status operasional staf.
  5. **Kompilasi Snapshot Roster (`getStaffRoster`):** Agregasi ringkasan hitungan staf riil (`total`, `working`, `idle`, `reviewing`, `blocked`, `offline`, `unknown`).
- **Antarmuka & Rute Web:**
  - **Halaman Staf (`/admin/mission-control/staff`):** Tampilan split-view modern (kartu staf di sisi kiri, panel inspeksi rincian read-only di sisi kanan) dengan ringkasan status bar dan sub-navigasi terpadu ke Cockpit (`/admin/mission-control`).
  - **API Roster Staf (`/api/admin/mission-control/staff`):** Rute GET terautentikasi sesi admin untuk pertukaran data JSON.
  - **Navigasi CMS (`AdminLayout.astro`):** Penambahan rute Staff Registry pada breadcrumbs dan menu navigasi Ringkasan & Kontrol.
- **Pengujian & Validasi:**
  - Rangkaian pengujian terfokus `scripts/test-staff-registry.js` lulus 100% (16/16 tes) mencakup pemisahan identitas mesin/tampilan, stabilitas ID mesin, pemetaan kapabilitas, prioritas tugas, atribusi aktivitas, penurunan seluruh varian status operasional, keselamatan pekerja media nonaktif, representasi otoritas nol JEV, dan invarian kueri read-only murni (0 mutasi).
  - Pengujian Mission Control `scripts/test-mission-control.js` lulus 100% (10/10 tes).
  - Validasi tipe `npx tsc --noEmit` lulus bersih tanpa kesalahan.
  - Build produksi `npm run build` berhasil membuat artefak Cloudflare Worker.
  - Pengujian regresi keselamatan `test-soak-safety.js` (54 tes) lulus sempurna.
- **Status Akhir:**
  - `HERMES-MC-2 = COMPLETE`.
  - Frontier saat ini: `HERMES-MC-3/READY`.

### HERMES-MC-1: RancangLoka Hermes Mission Control Core Implementation 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Membangun antarmuka kokpit operasional terpadu read-only pertama di rute `/admin/mission-control` dan API telemetri `/api/admin/mission-control/state`.
  - Mengagregasikan status operasional nyata dari Cloudflare D1 (keselamatan otomasi, pemutus sirkuit, pekerja media, pipeline artikel, log audit aktivitas, scheduler cron) dan model keputusan bayangan TypeSafe Jev ke dalam satu dasbor eksekutif.
  - Mempertahankan invarian keselamatan produksi: nol mutasi database, nol aktivasi pekerja media (`settings.media_worker_enabled = DISABLED`), otomasi publikasi tetap `OFF`, kill switch tetap pada status kanonikal (`NORMAL`), dan Jev berstatus `shadow` dengan otoritas nol.
  - Menolak data simulasi/palsu: menampilkan status nol sehat (misal 0 perangkat aktif, 0 pekerjaan media) apa adanya, dan menandai telemetri yang tidak tersedia sebagai `UNKNOWN` atau `NOT_AVAILABLE`.
  - Menerapkan sanitasi token dan redaksi kredensial otomatis pada seluruh lapisan data dan tampilan.
- **Komponen & Arsitektur Terpasang (`src/lib/mission-control/`):**
  1. **Tipe & Kontrak Data (`types.ts`):** Definisi TypeScript lengkap untuk seluruh model data snapshot, health strip, pipeline board, audit feed, scheduler, dan ringkasan subsistem.
  2. **Sanitasi & Redaksi Kredensial (`redact.ts`):** Penyensoran otomatis pola token rahasia (`lkmd_...`, Bearer tokens, token sesi admin, hash, dan kunci kriptografi).
  3. **Lapisan Kesehatan Sistem (`health.ts`):** Evaluasi status publikasi dari `automation_control.mode`, kill switch, status gerbang pekerja media, mode Jev bayangan, dan pemutus sirkuit subsistem (`circuit_breakers`).
  4. **Papan Tugas / Pipeline Terpadu (`tasks.ts`):** Pemetaan kanonikal entitas lintas siklus hidup editorial (`draft`, `waiting_media`, `ready_for_review`, `scheduled`, `published`, `failed`) dari gabungan tabel `articles`, `media_jobs`, dan `article_editorial_approvals`.
  5. **Arus Audit & Aktivitas Kronologis (`activity.ts`):** Agregasi kejadian multi-tabel (`automation_control_audit`, `circuit_breaker_events`, `media_job_events`, `publication_cron_runs`, `decision_observations`) dengan penanda keparahan (`info`, `warning`, `error`, `success`).
  6. **Evaluator Scheduler & Detak Jantung (`scheduler.ts`):** Evaluasi kesegaran detak jantung Hermes sesuai ambang batas kanonikal (sehat $\le 300$d, basi $301-600$d, luring $>600$d) dan ringkasan eksekusi cron Cloudflare edge-safe.
  7. **Ringkasan Operasional Subsistem (`summaries.ts`):** Ringkasan receipt outbox, operasi artikel, operasi media, dan metrik latensi/risiko evaluasi Jev bayangan.
  8. **Assembler Snapshot Utama (`index.ts`):** Pembungkus fungsi read-only `getMissionControlSnapshot` yang mengeksekusi kueri SELECT murni tanpa efek samping.
- **Antarmuka & Rute Web:**
  - **Halaman Dasbor (`/admin/mission-control`):** Halaman Astro SSR dengan tata letak padat informasi (*executive cockpit*), palet warna gelap profesional, kartu status interaktif, dan auto-refresh polling 30 detik yang hemat komputasi.
  - **API Telemetri (`/api/admin/mission-control/state`):** Rute GET terautentikasi sesi admin untuk pembaruan data asinkron.
  - **Navigasi Admin (`src/layouts/AdminLayout.astro`):** Penambahan tautan menu "Hermes Mission Control" di bilah navigasi CMS Admin.
- **Pengujian & Validasi:**
  - Rangkaian pengujian terfokus `scripts/test-mission-control.js` lulus 100% (10/10 tes): redaksi rahasia, invarian kesehatan dan otoritas nol, pemetaan zero-state sehat, transisi kill switch dan circuit breaker OPEN, pemetaan stage task board, agregasi audit multi-tabel, fallback telemetri tidak diketahui, dan invarian kueri read-only murni (0 mutasi).
  - Typecheck `npx tsc --noEmit` lulus bersih tanpa kesalahan.
  - Build produksi `npm run build` sukses membuat artefak Cloudflare Worker.
  - Pengujian regresi keselamatan `test-soak-safety.js` (54 tes), `test-article-persistence.js` (7 tes), dan `test-media-device-lifecycle.js` (28 tes) semuanya lulus sempurna.
- **Status Akhir:**
  - `HERMES-MC-1 = COMPLETE`.
  - Worktree bersih dan siap untuk transisi ke `HERMES-MC-2` (Named Staff Identities & Persistent Agent Mapping).

### MEDIA-A5.7-CLOSEOUT: Production Verification of Ephemeral Device Lifecycle & Dual-Gate Dormant Safety 2026-09-30

- **Tujuan & Ruang Lingkup:**
  - Menutup secara formal milestone `MEDIA-A5.7` berdasarkan bukti eksekusi langsung di lingkungan produksi Cloudflare Worker (`fa1c8b93-b410-4800-8296-f4c88e5d809e`) melalui sub-milestone `MEDIA-A5.7-P3A`.
  - Mengonfirmasi kepatuhan penuh terhadap prinsip keselamatan: pekerja media tetap berstatus *dormant* (OFF), nol pekerjaan dieksekusi, nol panggilan provider berbayar, dan nol mutasi data artikel/media/publikasi.
  - Menegaskan status kanonikal: `MEDIA-A5.7-P3A = COMPLETED`, `MEDIA-A5.7-P3B = NOT CANONICALLY DEFINED`, dan klasifikasi akhir `MEDIA-A5.7 = PROVEN_DORMANT`.
  - Mendaftarkan roadmap baru operasional sistem: `HERMES-MC` (Hermes Mission Control & 2D Pixel Office) sebagai lapisan kendali dan observabilitas terpadu.
- **Hasil & Bukti Eksekusi Produksi (MEDIA-A5.7-P3A):**
  1. **Autentikasi Operator Resmi:** Permintaan pendaftaran dan pencabutan perangkat divalidasi via sesi admin browser operator resmi pada portal CMS Admin (`https://rancangloka.com/admin`).
  2. **Pendaftaran Perangkat Ephemeral:** `POST /api/internal/v1/media/devices` berhasil mendaftarkan satu perangkat uji `media-a57-p3a-probe-20260930` dengan status HTTP 201 Created. Token hanya dikembalikan sekali dan disimpan dalam bentuk hash SHA-256 (`token_hash = 209f68864d0bc0ab03c0517f73446d953be8942c366a77ea4bab54ebe7de18f1`).
  3. **Pengujian Gerbang Pekerja Media Terautentikasi:** Memanggil `POST /api/internal/v1/media/jobs/run-next` dengan `Authorization: Bearer <token>`. Autentikasi perangkat diterima, gerbang keselamatan dievaluasi secara kanonikal, dan mengembalikan HTTP 200 OK dengan payload semantik `{ status: "disabled", code: "MEDIA_WORKER_DISABLED", executed: false, job_id: null }`.
  4. **Pencabutan Perangkat (Revocation):** Memanggil `DELETE /api/internal/v1/media/devices/media-a57-p3a-probe-20260930` dengan sesi admin operator. Perangkat berhasil dicabut (HTTP 200 OK) dan status pada tabel `media_devices` bertransisi menjadi `REVOKED`.
  5. **Uji Negatif Kredensial Dicabut (Fail-Closed 401):** Memanggil kembali `run-next` menggunakan token yang sama setelah pencabutan. Permintaan ditolak langsung pada lapisan autentikasi dengan status HTTP 401 Unauthorized (`code: "AUTHENTICATION_REQUIRED"`), membuktikan *fail-closed revocation* tanpa celah bypass.
  6. **Integritas Database Produksi (Zero Mutation):**
     - `media_jobs`: 0 (+0)
     - `media_job_events`: 0 (+0)
     - `media_job_receipts`: 0 (+0)
     - `media_assets`: 4 (+0)
     - `articles`: 6 (+0)
     - `active media devices`: 0
- **Klasifikasi & Batasan Otoritas:**
  - Status akhir: `MEDIA-A5.7 = PROVEN_DORMANT`.
  - Pekerja media TIDAK diaktifkan di produksi (`settings.media_worker_enabled` tetap tidak disetel / false).
  - Tidak ada pekerjaan media nyata yang dibuat atau dieksekusi.
  - Nol panggilan ke provider eksternal (Fal.ai / Meta).
  - Sub-milestone `MEDIA-A5.7-P3B` TIDAK didefinisikan secara kanonikal di dalam repositori dan tidak dieksekusi.

### ARTICLE-CONTENT-PERSISTENCE-1: Fix content_html Serialization at Source 2026-09-28

- **Tujuan & Ruang Lingkup:** Mengatasi akar penyebab serialisasi `articles.content_html` yang menghasilkan literal `[object Object]` pada tingkat database, menegakkan type guard dan validasi runtime ketat pada seluruh jalur penulisan artikel, menetapkan peran arsitektural `content_md` (sumber kanonikal otoritatif) versus `content_html` (derivatif render deterministik / cache), meregenerasi `content_html` Artikel 5 di Cloudflare D1 secara aman tanpa memutasi `content_md`, hash, approval, receipt, atau tanggal terbit, serta menambahkan rangkaian uji regresi persistensi.
- **Akar Masalah (Root Cause Analysis):**
  1. **Ketiadaan Validasi Tipe pada Writer:** Fungsi `insertArticle`, `updateArticle`, dan `insertHermesArticleAndReceipt` di `src/lib/db.ts` menerima nilai `article.content_html` tanpa type assertion atau validasi runtime. Jika pemanggil melewatkan unawaited Promise dari `renderArticleMarkdownSafely` (yang bersifat `async`), objek AST node parser, atau payload JSON objek, binding D1 SQLite secara otomatis memanggil `String(value)`, yang menghasilkan string literal `"[object Object]"`.
  2. **Ketiadaan Auto-Derivasi Deterministik:** Ketika `content_html` tidak disediakan saat insert/update namun `content_md` tersedia, sistem tidak secara otomatis meng-await dan merender HTML, melainkan menyimpan string kosong atau nilai mentah tak tervalidasi.
- **Solusi & Arsitektur Perbaikan:**
  - **Fungsi Resolver & Validator `resolveAndValidateContentHtml`:**
    - Jika menerima Promise yang belum di-await, fungsi secara otomatis meng-await Promise hingga selesai.
    - Menolak tipe non-string (objek, array, number, boolean, AST node) dengan melempar `DatabaseConstraintError`.
    - Menolak string literal `"[object Object]"` atau `"[object Promise]"` dengan melempar `DatabaseConstraintError`.
    - Jika `content_html` kosong atau tidak disediakan namun `content_md` tersedia, fungsi mendeterminasi dan merender HTML aman secara otomatis melalui `renderArticleMarkdownSafely(content_md)`.
    - Menjalankan `sanitizeArticleHtml` pada hasil akhir untuk menjamin kepatuhan allowlist HTML dan pencegahan XSS.
  - **Hardening pada Seluruh Jalur Persistensi:**
    - `insertArticle` di `src/lib/db.ts`: Seluruh write D1 dan in-memory mock divalidasi via `resolveAndValidateContentHtml`.
    - `updateArticle` di `src/lib/db.ts`: Memvalidasi `content_html` yang diberikan, meng-auto-regenerasi derivatif jika `content_md` diperbarui tanpa `content_html`, dan menyembuhkan baris lama jika `existing.content_html` korup.
    - `insertHermesArticleAndReceipt` di `src/lib/db.ts`: Mencegah machine ingestion menyimpan objek atau unawaited Promise.
    - `normalizeArticle` di `src/lib/article/pipeline.ts`: Menambahkan assertion runtime bahwa hasil render adalah string valid dan bukan `[object Object]`.
    - `[slug].astro` dan `admin/preview/[slug].astro`: Tetap mempertahankan fallback runtime sebagai *defense-in-depth*.
- **Perbaikan Aman Derivatif Artikel 5 di Cloudflare D1 Produksi:**
  - Menjalankan script terisolasi `scripts/repair-article5-content-html.js` ke database remote `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`).
  - `content_html` berhasil diregenerasi menjadi string HTML kanonikal valid sepanjang 17.940 karakter yang mencakup seluruh 8 tajuk utama dan retensi kata 98,6% (2.088 kata HTML vs 2.117 kata MD).
  - Mutasi D1 DIBATASI HANYA pada `articles.content_html`. Kolom `content_md`, `content_hash` (`14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277`), approval ID 9, receipt `rcpt_bbae85b48e1b2f8d`, `published_at`, dan media featured 100% UNCHANGED.
  - Mencatat audit log di `article_state_transitions` dengan `transition_type = 'DERIVED_CONTENT_REPAIR'` (`ast_5_derived_repair_1790590005246`).
- **Rangkaian Uji Regresi Persistensi (`scripts/test-article-persistence.js`):**
  1. Penolakan penyimpanan output renderer berupa Promise/objek tak tervalidasi.
  2. Kewajiban tipe string pada writer `content_html` (menolak array, number, boolean, AST node).
  3. Awaiting otomatis pada Markdown renderer saat derivasi dari `content_md`.
  4. Penolakan strict persistensi literal `"[object Object]"` dan `"[object Promise]"`.
  5. Verifikasi pemicu fallback frontend saat mendeteksi `content_html` malformed.
  6. Normal render dari `content_html` valid tanpa pemrosesan ulang fallback.
  7. Verifikasi ketidakberubahan hash dan approval ID 9 Artikel 5 setelah perbaikan derivatif.
- **Invarian Keselamatan:** `AUTOMATION_MODE = OFF`, `JEV_MODE = shadow`, `auto_schedule = false`.

### ARTICLE-RENDER-INTEGRITY-1: Emergency Repair of Article 5 Public Rendering 2026-09-28

- **Tujuan & Ruang Lingkup:** Memperbaiki bug rendering kritis produksi pada halaman publik Artikel 5 (`/kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`). Memulihkan penampilan naskah editorial kanonikal (~2.100 kata), mengeliminasi string literal `[object Object]`, menghapus blok prototype hardcoded yang tidak terkait ("EVALUASI SPASIAL REDAKSI", "Why This Works: Orientasi & Pembiasan...", dan sitasi ventilasi SNI 03-6572), serta menambahkan uji regresi integritas rendering deterministik.
- **Akar Masalah (Root Causes):**
  1. **Naskah Hilang & Literal `[object Object]`:** Kolom database `articles.content_html` pada baris Artikel 5 di D1 produksi secara keliru terisi string literal 15-karakter `"[object Object]"` akibat serialisasi lampau saat ingest draf otomatis, sementara naskah kanonikal 2.117 kata di `articles.content_md` tetap utuh. Pada `src/pages/[slug].astro`, kode sebelumnya langsung meneruskan `sanitizeArticleHtml(article.content_html)` ke pemroses konten tanpa memvalidasi keabsahan HTML, sehingga Markdown kanonikal terabaikan dan halaman merender literal `[object Object]`.
  2. **Modul Penilaian Spasial & Sitasi Fiktif:** Baris 358–445 dan 450–461 pada `src/pages/[slug].astro` memuat markup kartu hardcoded dari era prototipe yang dievaluasi murni via `{article.is_sponsored !== 1 && (...)}`, sehingga muncul di semua artikel terbit tanpa memandang relevansi topik.
- **Solusi & Arsitektur Perbaikan:**
  - **Fallback Aman Markdown Kanonikal:** Mengimpor `renderArticleMarkdownSafely` ke `src/pages/[slug].astro`. Menambahkan validasi `isMalformedHtml` (`!rawContentHtml || typeof rawContentHtml !== 'string' || rawContentHtml.trim() === '[object Object]' || rawContentHtml.trim().length < 50`). Jika HTML tidak valid, sistem secara dinamis merender HTML aman langsung dari `article.content_md`.
  - **Eliminasi Prototype Filler:** Menghapus blok hardcoded evaluasi spasial, "Why This Works", dan sitasi ventilasi dari template `[slug].astro`. Menegakkan alur visual linier murni: *Judul/Metadata → Executive Summary → Featured Hero Image → Naskah Editorial Kanonikal Penuh (termasuk Matriks Komparasi, Verdict RancangLoka, Catatan Rujukan Standar) → Social Share Bar → Author Card → CTA → Footer*.
- **Pintu Integritas Rendering (`scripts/test-article-render-integrity.js`):**
  - Menguji pemuatan naskah kanonikal via fixture `scripts/fixtures/article5_canonical.json`.
  - Memverifikasi keberadaan seluruh 8 tajuk utama kanonikal Artikel 5.
  - Memastikan retensi kata naskah editorial ter-render >= 90% dari naskah kanonikal Markdown (terverifikasi: 2.167 kata rendered vs 2.117 kata canonical = 102,4% retensi).
  - Memastikan string `[object Object]` serta komponen prototipe fiktif 100% absen dari template.
- **Hasil Verifikasi Live Produksi:**
  - Deployment ID: `fa1c8b93-b410-4800-8296-f4c88e5d809e` (commit `8d82e3b`).
  - Halaman Artikel 5 (`/kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`): HTTP 200, robots `index, follow, max-image-preview:large`, schema `@type: "Article"`, 8 tajuk utama hadir utuh, 2.167 kata editorial terlihat, literal `[object Object]` lenyap.
  - Halaman Artikel 6 (`/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman`): HTTP 200, `X-Robots-Tag: noindex, follow`, terisolasi dari sitemap dan RSS feed.
- **Invarian Keselamatan:** `AUTOMATION_MODE = OFF`, `auto_schedule = false`, `kill switch = disengaged`, `JEV = shadow / OBSERVE_ONLY`, `media worker = OFF`. Naskah `content_md`, approval ID 9, receipt `rcpt_bbae85b48e1b2f8d`, dan content hash Artikel 5 (`14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277`) 100% IMMUTABLE.

### CONTENT-QUARANTINE-1: Prototype & Unsafe Corpus Isolation 2026-09-28

- **Tujuan & Ruang Lingkup:** Mengisolasi 20 artikel prototipe internal di `src/lib/db.ts` dan artikel produksi belum terverifikasi (Artikel 6) dari permukaan publikasi terbuka (Google News sitemap, XML sitemap biasa, RSS feed, pencarian situs, internal-linking otomatis, dan rekomendasi artikel terkait), tanpa merusak akses langsung operator maupun integritas data historis.
- **Implementasi:**
  - Membuat registry karantina `QUARANTINE_REGISTRY` di `src/lib/quarantine.ts`.
  - Menerapkan header `X-Robots-Tag: noindex, follow` dan meta tag `noindex` untuk rute artikel karantina.
  - Menyiapkan pengalihan 301 konsolidasi untuk slug prototipe `panduan-kusen-aluminium-ekstrusi-daerah-lembap` menuju Artikel 5 kanonikal.
  - Memastikan Artikel 5 terproteksi penuh dari benturan ID in-memory dan tetap terindeks secara publik (`index, follow`).
- **Verifikasi:** 19/19 uji regresi `scripts/test-content-quarantine.js` lulus. Commit: `b67ced3`.

### CONTENT-GOLIVE-1-STABILIZE: Production Source & Publication Clock Stabilization 2026-09-28

- **Tujuan & Ruang Lingkup:** Menstabilkan baseline kode produksi pasca-penerbitan artikel perdana (Article ID 5, "Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia"), memperbaiki sumber jam publikasi (*publication clock source*) agar selalu mengambil waktu server Cloudflare D1/SQLite kanonikal, mendokumentasikan anomali *clock-skew* workstation operator pada rekaman historis penerbitan perdana tanpa memalsukan data historis, menambahkan uji regresi *clock-skew*, serta mengonsolidasikan seluruh perbaikan SEO/SSR ke dalam satu commit bersih.
- **Dokumentasi Provenance & Anomali Clock-Skew Historis Article 5:**
  - Operasi penerbitan kanonikal aktual (`publishNow`) terlaksana di server Cloudflare D1 sekitar pukul **2026-09-28 06:16:33 UTC**.
  - Nilai publik historis `published_at` (`2026-09-28T06:10:39.816Z`) tercipta dari jam lokal workstation operator (*Windows workstation clock*) yang saat eksekusi tertinggal ~5 menit 54 detik dari UTC sebenarnya.
  - Timestamp persetujuan redaksi manusia (`article_editorial_approvals.created_at = 2026-09-28 06:15:42 UTC`) menggunakan waktu server D1 (`CURRENT_TIMESTAMP`).
  - **Invarian Persetujuan TIDAK Dilanggar:** Persetujuan manusia sah tercatat terlebih dahulu di server D1 sebelum operasi `publishNow` dijalankan. Perbedaan tampilan timestamp murni diakibatkan oleh penggunaan `new Date().toISOString()` lokal workstation pada fungsi `executeAtomicPublication`.
  - **Kebijakan Integritas:** Rekaman historis Article 5 (approval ID 9, receipt `rcpt_bbae85b48e1b2f8d`, execution row ID 2 / `pexec_2b27683bb528397e`, `published_at`) **TIDAK diubah / difalsifikasi** guna menjaga integritas audit jejak sejarah. Nomor execution dikoreksi berdasarkan verifikasi D1 read-only pada 28 September 2026; tidak ada perubahan rekaman produksi.
- **Perbaikan Sumber Jam Publikasi (Canonical Server Clock Source):**
  - Mengganti evaluasi `new Date().toISOString()` lokal pada `getDueExecutions`, `claimExecutionLease`, dan `executeAtomicPublication` (`src/lib/publication/publisher-service.ts`) dengan kueri waktu server database: `SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS server_now`.
  - Menjamin `articles.published_at`, `article_publication_executions.actual_published_at`, dan `publication_execution_receipts.actual_published_at` selalu berasal dari SATU timestamp server D1 yang identik dan berformat ISO-8601 UTC.
- **Uji Regresi Deterministi Clock-Skew (`scripts/test-publication-clock-skew.js`):**
  - Menguji skenario ekstrim di mana jam workstation operator tertinggal 15 menit dari UTC.
  - Membuktikan bahwa `publishNow` mengabaikan jam lokal workstation, mengambil waktu server D1, dan menjamin `published_at >= approval.created_at` serta kesesuaian 100% pada execution dan receipt.
- **Konsolidasi Perbaikan SEO, SSR & Sitemap:**
  - `src/layouts/BaseLayout.astro`: fallback `metaDesc` eksplisit untuk mencegah error SSR.
  - `src/pages/[slug].astro`: pengangkatan deklarasi variabel `authorObj` ke lingkup teratas frontmatter.
  - `src/lib/seo.ts` & `src/pages/sitemap-news.xml.ts`: pengetatan filter News Sitemap khusus artikel bertipe `news` yang terbit < 48 jam.
  - `scripts/test-schema-compatibility.js`: pembaruan assertion agar dinamis menguji seluruh 22 file migrasi.
  - `scripts/test-seo-date-pipeline.js`: 14 pengujian komprehensif tanggal SEO, Schema.org, dan Google News Sitemap.
- **Status Keamanan:** `AUTOMATION_MODE = OFF`, `auto_schedule = false`, `kill_switch = disengaged`, `JEV = shadow / OBSERVE_ONLY`, `media_worker = OFF`.

### MEDIA-A5.7-P2B Production Deployment & Ephemeral Device Lifecycle Verification 2026-09-27

- **Tujuan & Ruang Lingkup:** Melakukan deployment kanonikal kode lifecycle kredensial perangkat (`6268e4e`) ke Cloudflare Worker produksi (`rancangloka`), memverifikasi isolasi rute manajemen perangkat yang dilindungi oleh sesi admin operator, menegakkan firewall pencegahan self-provisioning perangkat media, serta mengonfirmasi bahwa status operasional pekerja media tetap sepenuhnya `OFF` (*dormant*) sebelum pengujian probe diautentikasi.
- **Hasil Deployment Produksi:**
  - **Deployment ID Aktif:** `5bb91a9f-d9cc-46e7-af5d-4bff0fbd7d1c` (commit `6268e4ed3c630ae422b8237d694e96afe80a057f`).
  - **Status Kesehatan:** Beranda (`/`) 200 OK, SSR artikel terbit (`/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman`) 200 OK.
  - **Status Dual-Gate Media Worker:** `MEDIA_WORKER_ENV_GATE = true`, `MEDIA_WORKER_DB_GATE = UNSET / false`, `EFFECTIVE_STATE = OFF` (invarian gerbang ganda terjaga 100%).
  - **Verifikasi Endpoint Tanpa Autentikasi:** `POST /api/internal/v1/media/jobs/run-next` menolak dengan 401 (`AUTHENTICATION_REQUIRED`); `GET` menolak dengan 405 (`METHOD_NOT_ALLOWED`).
- **Verifikasi Keamanan API Manajemen Perangkat:**
  - `GET /api/internal/v1/media/devices` (unauthenticated) -> 401 `UNAUTHORIZED` (`Operator admin session required.`).
  - `POST /api/internal/v1/media/devices` (unauthenticated) -> 401 `UNAUTHORIZED` (`Operator admin session required.`).
  - **Firewall Self-Provisioning:** Kredensial dengan prefix `lkmd_` atau scope `media:device` ditolak secara mutlak dengan 403 `MEDIA_DEVICE_FORBIDDEN` (`Media device credentials cannot access device management APIs.`), menjamin nol *trust loop*.
- **Koreksi Otoritas Operasional:**
  - Menegakkan prinsip bahwa akses infrastruktur database D1 (`npx wrangler d1 execute`) bukan merupakan otoritas pendaftaran perangkat tingkat aplikasi.
  - Alur pendaftaran perangkat kanonikal yang sah ditetapkan melalui sesi browser operator terautentikasi (`admin_session` cookie via `POST /api/internal/v1/media/devices`).
- **Status Database Baseline:** `media_devices` = 0, `media_jobs` = 0, `media_job_events` = 0, `media_job_receipts` = 0, kontrol publikasi = `OFF` / `false` / `0`.

### MEDIA-A5.7-P2A Canonical Ephemeral Device Auth Lifecycle & Management API 2026-09-27

- **Tujuan & Ruang Lingkup:** Mengimplementasikan layanan siklus hidup kanonikal (*canonical lifecycle services*) untuk pendaftaran, pencabutan, dan verifikasi perangkat media LokaMedia (`registerMediaDevice`, `revokeMediaDevice`, `getMediaDevice`, `listMediaDevices`) serta endpoint internal HTTP yang dilindungi otoritas admin operator (`POST /api/internal/v1/media/devices`, `GET`, `DELETE /api/internal/v1/media/devices/[device_id]`).
- **Fitur Kriptografis & Keamanan:**
  - **Entropi Tinggi:** Token perangkat digenerasi menggunakan Web Crypto `crypto.getRandomValues` dengan entropi 256-bit (32 byte acak) berawalan `lkmd_` (total 69 karakter string heksadesimal).
  - **Hash-Only Storage:** Database Cloudflare D1 hanya menyimpan digest SHA-256 (`token_hash`). Plaintext token tidak pernah disimpan di disk/database dan tidak pernah dicetak dalam log sistem. Token plaintext dikembalikan tepat satu kali (*once-only*) pada respons pendaftaran.
  - **Fail-Closed Revocation Hardening:** Mengubah kueri pencocokan token di `authenticateDeviceRequest` untuk mengambil status perangkat berdasarkan `token_hash`. Jika status tercatat `REVOKED`, autentikasi langsung ditolak secara fail-closed (401 `Token perangkat LokaMedia tidak valid atau telah dicabut.`) tanpa *fallthrough* ke env secret atau dev test bypass.
  - **Idempotensi & Pencegahan Duplikasi:** Pendaftaran perangkat menolak ID perangkat yang sudah aktif dengan status 409 Conflict. Pencabutan perangkat bersifat idempoten (aman dipanggil berulang kali).
  - **Media Device Firewall:** Memblokir seluruh kredensial perangkat media dari rute admin dan provisioning guna mencegah loop self-provisioning.
- **Pengujian & Verifikasi (`scripts/test-media-device-lifecycle.js`):**
  - 28/28 pengujian lulus 100% membuktikan entropi token, penyimpanan hash, autentikasi sukses, penolakan token salah/kadaluwarsa/dicabut, penolakan scope terlarang, idempoten pencabutan, zero plaintext leak pada log, serta proteksi API internal.
- **Commit:** `6268e4e` (`feat: add canonical media device lifecycle`).

### MEDIA-A5.7-P1 Dormant Production Deployment & Strict Dual-Gate Enforcement 2026-09-27

- **Tujuan & Ruang Lingkup:** Melakukan deployment kode runtime media worker yang telah diaudit ke Cloudflare Worker produksi (`rancangloka`) dengan kondisi pekerja media tetap berstatus *dormant* (OFF total) untuk memvalidasi kompatibilitas edge runtime tanpa mutasi database atau eksekusi pekerjaan aktif.
- **Verifikasi Kontrol & Invarian:**
  - Deployment ID: `f660293d-acc5-4cdf-9089-b1660f7e4255` (commit `11e3e06a82c161912495edb1dbd1d8fbba7189c8`).
  - Gerbang Environment `MEDIA_WORKER_ENABLED = true` disinkronkan via `wrangler.toml`.
  - Gerbang Database D1 `settings.media_worker_enabled` dipertahankan tidak disetel (*UNSET*) / `false`.
  - Formula kontrol gerbang ganda `WORKER_ENABLED = env === true AND db === true` menghasilkan status efektif `OFF`.
  - Endpoint publik dan SSR berjalan normal; kueri tanpa token ke endpoint worker internal menghasilkan 401; mutasi artikel dan media nol.

### MEDIA-A5.6 Safe Media Worker Handoff & Dual-Control Gate Invariant 2026-09-27

- **Tujuan & Ruang Lingkup:** Membangun lapisan pelari pekerja media kanonikal (`src/lib/media/worker-runner.ts`) dan endpoint trigger eksekusi (`POST /api/internal/v1/media/jobs/run-next`, `POST /api/internal/v1/media/worker/control`) yang menerapkan arsitektur gerbang ganda (*Dual-Gate AND Semantics*): pekerja HANYA dapat aktif jika `env.MEDIA_WORKER_ENABLED === true` DAN `settings.media_worker_enabled === true`.
- **Fitur Utama:**
  - **Dual-Control Fail-Closed:** Jika salah satu atau kedua gerbang bernilai non-true, worker langsung keluar dengan `{ status: 'success', code: 'WORKER_DISABLED', executed: false }`.
  - **Lease & Heartbeat Management:** Pengambilan pekerjaan tunggal per siklus dengan durasi sewa 180 detik dan verifikasi kepemilikan sewa.
  - **Pengujian & Verifikasi (`scripts/test-media-a5-worker-runner.js` & `test-media-a5-7-canonical-canary.js`):**
    - 21/21 tes worker runner lulus 100%.
    - 27/27 tes canary kanonikal lulus 100%.
- **Commit:** `11810de`, `a63de3b`, `9dbcd53`.

### MEDIA-A5.5 Deterministic Media Soak Runner & Concurrency Stress 2026-09-26

- **Tujuan & Ruang Lingkup:** Menguji ketahanan, stabilitas memori, dan determinisme antrean media serta orkestrator di bawah beban siklus multi-iterasi (*soak test*) menggunakan mock database D1 in-memory.
- **Hasil Verifikasi (`scripts/test-media-a5-soak.js`):**
  - 12 siklus soak multi-skenario lulus 100% tanpa memory leak, race condition, atau residu sewa menggantung.
- **Commit:** `ae978d5` (`test: add deterministic media orchestration soak`).

### MEDIA-A5.4 Media Pipeline Orchestrator & Local DI Runtime 2026-09-26

- **Tujuan & Ruang Lingkup:** Mengintegrasikan mesin orkestrasi pipeline media terpadu (`processMediaJob`) di `src/lib/media/orchestrator.ts` dengan eksekusi berbasis dependency injection (DI), mekanisme pemulihan minimal stage (*Minimal Stage Resume*), proteksi konkurensi sewa (lease), serta pendelegasian penuh keputusan retry ke satu otoritas (`classifyMediaRetry` + `applyMediaRetryDecision`).
- **Fitur & Arsitektur Utama:**
  - **Minimal Stage Resume:** Memanfaatkan cache artefak intermediat (`artifactStore`). Kegagalan pada `TRANSFORM` (misal `WATERMARK_FAILED`) hanya mengulang tahap transformasi saat di-reclaim tanpa mengulang pembuatan gambar sumber (`sourceExecutor`). Begitu pula kegagalan di `STORAGE` atau `DELIVERY_VERIFY` langsung melanjutkan pada tahap terkait tanpa membuang kerja upstream.
  - **Single Authority Policy Parity:** 100% evaluasi kegagalan didelegasikan ke `classifyMediaRetry` (`src/lib/media/retry-policy.ts`) dan persistensi ke `applyMediaRetryDecision` (`src/lib/media/durable-retry.ts`). Orchestrator tidak memiliki pemetaan kode kegagalan manual sendiri.
  - **Firewall Status Non-Runnable:** Memblokir eksekusi otomatis pada 7 status tidak dapat dijalankan (`COMPLETE`, `FAILED_TERMINAL`, `SUPERSEDED`, `CANCELLED`, `AUTH_REQUIRED`, `PROVIDER_BLOCKED`, `USER_ACTION_REQUIRED`).
  - **Ketahanan Concurrency & Crash:** Memverifikasi kepemilikan dan masa berlaku lease; menolak penulisan dari pekerja usang (OCC revision conflict); mendukung pemulihan crash sebelum atau sesudah persistensi keputusan.
- **Pengujian & Verifikasi (`scripts/test-media-a5-orchestrator.js`):**
  - 18/18 tes lulus 100% mencakup: Happy path end-to-end, source retry, transform retry, storage retry, delivery retry, manual bridge routing, auth failure isolation, provider content block, generation budget exhaustion, stage retry exhaustion, single active lease, stale worker rejection, duplicate dispatch idempotency, pre-persist & post-persist crash recovery, non-runnable firewall, kompatibilitas event legasi, dan policy parity.
- **Commit:** `c9a62ab` (`feat: integrate media retry orchestrator`).

### MEDIA-A5.3 Durable Retry Accounting & Decision Policy Integration 2026-09-26

- **Tujuan & Ruang Lingkup:** Mengimplementasikan lapisan adapter persistensi durabel (`applyMediaRetryDecision` di `src/lib/media/durable-retry.ts`) antara keputusan kebijakan retry dan tabel database SQLite/D1 (`media_jobs`, `media_job_events`, `media_job_receipts`) tanpa mutasi skema database (`SCHEMA_CHANGE_REQUIRED=NO`).
- **Akar Masalah Akuntansi Percobaan (`ATTEMPT_COUNTER_GAP`):**
  - Pada implementasi awal, `media_jobs.attempt` adalah satu-satunya counter global. Jika retry tahap `TRANSFORM` atau `STORAGE` menaikkan counter ini, kuota generasi provider akan terbuang sia-sia dan memicu kegagalan terminal prematur.
- **Solusi Akuntansi Percobaan Berjenjang:**
  - `media_jobs.attempt` hanya dinaikkan untuk retry pada level sumber/generasi (`consume_attempt = true`).
  - Retry tingkat tahap (`TRANSFORM`, `STORAGE`) menetapkan `consume_attempt = false` sehingga `media_jobs.attempt` dipertahankan utuh. Jumlah retry tahap dihitung durabel dari tabel `media_job_events`.
  - Angka batas percobaan tahap (`maxStageAttempts`) dikonfigurasikan secara eksplisit via `DEFAULT_STAGE_RETRY_CONFIG` (default 2 retries per stage = 3 kali percobaan total), menghapus magic constant.
- **Fitur Keselamatan:**
  - **Firewall Redaksi Rahasia:** Token, header Authorization Bearer, cookie, dan kunci API disaring otomatis (`[REDACTED_SECRET]`) sebelum ditulis ke database.
  - **Proteksi Status Terminal:** Menolak pembukaan kembali pekerjaan terminal (`COMPLETE`, `FAILED_TERMINAL`, `SUPERSEDED`, `CANCELLED`).
  - **Idempotensi & OCC:** Optimistic Concurrency Control via `job_revision` dan idempotency receipt untuk mencegah eksekusi ganda.
- **Pengujian & Verifikasi (`scripts/test-media-a5-durable-retry.js`):**
  - 17/17 tes lulus 100% membuktikan akuntansi generasi vs stage, firewall rahasia, mitigasi konflik slot, isolasi kegagalan auth/blokir, determinisme waktu `next_retry_at`, dan rekonstruksi pekerja pasca-restart.
- **Commit:** `6cff6aa` (`feat: integrate durable media retry decisions`).

### MEDIA-A5.2 Media Retry Classification & Pure Decision Policy 2026-09-26

- **Tujuan & Ruang Lingkup:** Membangun modul penentu keputusan retry murni (*pure decision engine*, 100% side-effect free) di `src/lib/media/retry-policy.ts` yang memetakan kode kegagalan QA teknis dan upstream provider ke rekomendasi tindakan kanonikal.
- **Klasifikasi Retry Terstruktur:**
  - `RETRY_SAME_STAGE`: Retry pada artefak derivatif yang ada (`WATERMARK_FAILED` -> `TRANSFORM`, `R2_UPLOAD_FAILED` -> `STORAGE`).
  - `RETRY_FROM_SOURCE`: Pengambilan ulang tanpa merubah prompt (`PROVIDER_TIMEOUT`, `PROVIDER_RATE_LIMIT`).
  - `RETRY_WITH_REPROMPT`: Pembuatan ulang dengan penyesuaian parameter teknis.
  - `OPERATOR_REQUIRED`: Penahanan untuk tindakan editor manusia (`PROVIDER_AUTH_FAILED`, `PROVIDER_CONTENT_REJECTED`, atau kegagalan pada `MANUAL_BROWSER_BRIDGE`).
  - `TERMINAL`: Kegagalan fatal yang tidak dapat diulang (kebocoran rahasia `SECRET_LEAK`, batas kuota habis).
  - `NO_RETRY`: Non-kegagalan atau mitigasi konflik slot editorial (`SLOT_OCCUPIED`).
- **Fitur Pendukung:** Perhitungan delay backoff eksponensial deterministik (`computeRetryDelay`) tanpa fungsi sleep/timer non-deterministik.
- **Pengujian & Verifikasi (`scripts/test-media-a5-retry-policy.js`):**
  - 25/25 tes lulus 100% mencakup seluruh matriks kegagalan dan firewall jembatan manual.
- **Commit:** `a008e82` (`feat: add media retry decision policy`).

### MEDIA-A5.1 Deterministic Technical Media QA Service & Failure Taxonomy 2026-09-26

- **Tujuan & Ruang Lingkup:** Menyediakan layanan jaminan kualitas teknis otomatis (`qa-service.ts`) yang mengevaluasi integritas biner, kesesuaian format, dimensi peran, serta firewall provenance dan privasi secara deterministik tanpa efek samping.
- **Taksonomi & Evaluasi Mutu:**
  - **QA-0 (Artifact Integrity):** Pemeriksaan biner kosong (`EMPTY_BYTES`), deteksi format rusak (`DECODE_OR_HEADER_INVALID`), validasi magic byte PNG/JPEG/WebP, dan deteksi payload error HTML/JSON (`ERROR_PAYLOAD`).
  - **QA-1 (Technical Quality):** Pemisahan aturan dimensi peran (`featured`: min 1200×630 px; `inline`: min 600×338 px), rasio aspek, dan batas byte file (min 20 KiB, max 5 MiB).
  - **QA-2 (Provenance & Privacy):** Validasi kelengkapan provenance dan penolakan langsung terhadap kebocoran kredensial (`SECRET_LEAK`).
  - **QA-3 s/d QA-5:** Evaluasi eligibilitas watermark, upload R2, dan lampiran slot artikel (`SLOT_OCCUPIED`).
  - **Batas Evaluator Semantik:** Evaluasi visi semantik secara ketat menghasilkan status `DEFERRED` (tidak pernah false `PASS`) jika model semantik belum dieksekusi.
- **Pengujian & Verifikasi (`scripts/test-media-a5-technical-qa.js`):**
  - 39/39 tes lulus 100% membuktikan ketepatan taksonomi, deteksi biner canary 169×512, dan imutabilitas skema database.
- **Commit:** `f24cd7a` (`feat: add deterministic media QA contract`).

### MEDIA-A4B Production Reversible Canary Execution 2026-09-26

- **Tujuan & Ruang Lingkup:** Melakukan uji coba kanonikal produksi (*production canary*) yang sepenuhnya dapat dibatalkan (*reversible*) untuk memverifikasi siklus penautan aset featured (`article_media`), pembuktian perubahan status preflight kanonikal artikel, dan pemulihan status ke baseline awal secara 100% identik menggunakan endpoint detach kanonikal.
- **Kronologi Eksekusi:**
  1. **Deployment Detach Endpoint:** Berhasil dideploy ke Cloudflare Edge Worker (`9fae7b79-c6b1-4b0c-8e92-2391d1cbe958`).
  2. **Baseline State:** Artikel ID 1 memiliki status preflight kanonikal dengan hash `h_29741012`.
  3. **Canonical Attach:** Menautkan aset `ast_8321f8f3eb7b039c59c222ba` sebagai media featured aktif (`binding_id: 12`).
  4. **State Transition:** Hash preflight kanonikal berubah secara deterministik menjadi `h_10b404c9`. Kesiapan publikasi tetap `NOT_READY` karena kontrol editorial tetap ditegakkan.
  5. **Canonical Detach (Rollback):** Memanggil endpoint `/api/internal/v1/media/article-media/detach` untuk menonaktifkan binding ID 12 (`is_active = 0`).
  6. **Restoration Verification:** Status kanonikal artikel ID 1 kembali 100% persis ke hash baseline awal (`h_29741012`). Kolom legasi `articles.featured_image` tetap tidak tersentuh.
- **Hasil Mutasi Produksi:** Zero side-effects; binding tersimpan dalam status inaktif untuk audit trail; slot editorial kembali bersih.

### MEDIA-A4B.1 Canonical Article Media Detach / Deactivate Service 2026-09-26

- **Tujuan & Ruang Lingkup:** Mengimplementasikan layanan pelepasan/deaktivasi kanonikal (`detachArticleMedia`) dan endpoint internal (`/api/internal/v1/media/article-media/detach`) yang bekerja secara soft-deactivation (`is_active = 0`) untuk memulihkan status kanonikal artikel tanpa memutasi kolom legasi `articles.featured_image`, tabel `media_assets`, atau tabel publikasi, menyediakan jalur *canonical rollback* aman sebelum eksekusi canary produksi MEDIA-A4B.
- **Akar Masalah Jalur Legasi (`unbindFeaturedMedia`):**
  - Jalur unbind legasi di `src/lib/media/service.ts` melakukan mutasi langsung pada `articles.featured_image = ''` dan `articles.image_alt = ''`.
  - Hal ini tidak kompatibel dengan arsitektur media modern RancangLoka karena sumber kebenaran kanonikal untuk gambar artikel adalah tabel relasi `article_media WHERE role = 'featured' AND is_active = 1`.
  - Mengosongkan kolom legasi berisiko merusak metadata artikel dan tidak dapat dibatalkan (non-reversible).
- **Implementasi Layanan Kanonikal (`src/lib/media/article-media.ts`):**
  - **Fungsi:** `detachArticleMedia(params: ArticleMediaDetachParams, db: any): Promise<ArticleMediaDetachResult>`.
  - **Target Terfokus (Exact Scope):** Memerlukan kombinasi eksplisit `article_id` dan `asset_id` (serta opsional `slot_key` dan `binding_id`). Menolak kueri broad deactivation tanpa kriteria identitas.
  - **Soft-Deactivation Semantics:** Menjalankan `UPDATE article_media SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_active = 1`. Baris historis tetap tersimpan untuk keperluan audit.
  - **Pembebasan Unique Slot:** Begitu `is_active` menjadi 0, partial unique index SQLite `idx_article_media_one_active_slot` pada `(article_id, slot_key) WHERE is_active = 1` langsung terbebaskan, sehingga slot editorial dapat digunakan oleh aset baru.
  - **Imutabilitas Mutlak Kolom Legasi:** Tidak ada mutasi pada tabel `articles` (`articles.featured_image` tetap utuh).
  - **Idempotensi & Concurrency Safety:** Jika binding sudah berstatus `is_active = 0`, layanan mengembalikan `already_inactive: true` secara deterministik tanpa error. Kueri scoped pada primary key `id` dan `is_active = 1` mencegah race condition.
  - **Audit Logging:** Mencatat aksi `'DETACH'` ke dalam tabel `media_asset_audit`.
- **Implementasi Endpoint Internal API (`src/pages/api/internal/v1/media/article-media/detach.ts`):**
  - Rute: `POST /api/internal/v1/media/article-media/detach`.
  - Otentikasi: Menggunakan `authenticateDeviceRequest` (HMAC berpasangan) dengan paritas penuh terhadap endpoint attach.
  - Firewall Payload: Menolak biner/multipart (`BINARY_PAYLOAD_NOT_ACCEPTED`, HTTP 415).
  - Validasi Input: Validasi ketat untuk `article_id`, `asset_id`, dan format `slot_key`.
- **Pengujian & Verifikasi Komprehensif (`scripts/test-media-a4b1-detach.js`):**
  - 8/8 pengujian deterministik offline lulus 100%:
    1. `LEGACY_FEATURED_IMAGE_IMMUTABILITY_TEST_PASS`: Kolom `articles.featured_image` identik sebelum, saat, dan sesudah detach.
    2. `CANONICAL_STATE_ROUNDTRIP_PASS`: Hash preflight kanonikal pasca-detach sama persis 100% dengan baseline pre-attach (`h_29741012`).
    3. `ACTIVE_SLOT_REUSE_PASS`: Slot `'featured'` yang dilepas sukses diisi oleh aset pengganti.
    4. `DETACH_IDEMPOTENCY_PASS`: Detach berulang aman dan mengembalikan `already_inactive: true`.
    5. `DETACH_CONFLICT_HANDLING_PASS`: Fail-closed untuk artikel 404, aset 404, binding 404, role mismatch 422, dan invalid slot 400.
    6. `DETACH_MUTATION_SCOPE_PASS`: Tabel `articles` dan `media_assets` tidak mengalami mutasi efek samping.
    7. `DETACH_LEDGER_DECOUPLING_PASS`: Trajectory ledger tetap bersih (0 row).
    8. `LOCAL_FULL_ROUNDTRIP_PASS`: Siklus canary lokal A4B (baseline → attach → verify → detach → hash match) terbukti deterministik.
- **Commit Repositori:**
  - `b5a4d18`: `feat: add canonical article media detach lifecycle`

### MEDIA-A4A Media Asset Registration, Nested Delivery & Source Provenance 2026-09-25 / 2026-09-26

- **Tujuan & Ruang Lingkup:** Mendaftarkan artefak gambar terverifikasi dari Cloudflare R2 (`media/canary/media-a3/...`, sha256 `7b30ab30...`) ke dalam tabel database D1 `media_assets` produksi, memperbaiki penanganan kunci penyimpanan bersarang pada rute publik `/media/[...key]`, mempertahankan semantik asal sumber (`source_origin: 'local_fixture'`), serta menguji delivery langsung via HTTPS.
- **Perbaikan Rute Pengiriman Media Bersarang (`src/pages/media/[...key].ts`):**
  - **Akar Masalah:** Rute single-segment `/media/[key].ts` menolak URL yang memiliki subdirektori (misal `media/canary/...`).
  - **Solusi:** Diubah menjadi rest parameter `/media/[...key].ts`, dinormalisasi dari path traversal (`..`, `%2e%2e`), trailing slashes, dan penanganan decoding yang aman.
  - **Tes Regresi:** 16/16 tes pada `scripts/test-media-delivery-route.js` lulus 100%.
  - **Commit:** `67cdbe0`: `fix: support nested media storage keys`.
- **Preservasi Semantik Sumber Asal (`src/lib/media/asset-registration.ts`):**
  - **Akar Masalah:** Logika lama menetapkan `source_type: 'lokamedia_extension'` secara flat tanpa merekam sumber upstream (`local_fixture`, `chatgpt_browser_bridge`, atau `fal_api`).
  - **Solusi:** Ditambahkan `buildMediaAssetRegistrationPayload` yang merefleksikan metadata provenance secara presisi ke dalam kolom `provenance_json`.
  - **Commit:** `12def9e`: `fix: preserve media source provenance semantics`.
- **Eksekusi Produksi (MEDIA-A4A.2 Canary Live):**
  - Dideploy ke Cloudflare Edge Worker (Deployment ID: `d35528c0-7695-4c85-9a9d-ee39e6097c2a`).
  - Registrasi 1 baris ke D1 `media_assets`:
    - `asset_id`: `ast_8321f8f3eb7b039c59c222ba`
    - `storage_key`: `media/canary/media-a3/7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967.png`
    - `sha256`: `7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967`
    - `status`: `VALIDATED`, `role`: `ARTICLE_PUBLIC_DERIVATIVE`
  - Verifikasi Live Delivery: HTTP 200 OK dengan sha256 dan ukuran biner cocok 100%.
- **Commit Terkait:**
  - `d31c618`: `feat: add media asset registration payload builder and prep test suite`
  - `5e0d76b`: `test: add MEDIA-A4B preparation and dry-run test suite`

### MEDIA-A3 Watermark Derivative Engine & Production R2 Storage Canary 2026-09-25

- **Tujuan & Ruang Lingkup:** Mengimplementasikan proses transformasi watermark teks kanonikal (`rancangloka.com`, `bottom-right`, `opacity=0.62`, `font_size_ratio=0.022`) pada artefak gambar terverifikasi (`GeneratedImageArtifact`), menjaga imutabilitas sumber asli 100%, menghasilkan derivatif gambar deterministik lokal, melakukan satu kali upload live kanonikal ke Cloudflare R2 bucket produksi (`rancangloka-media`), mengunduh ulang secara independen untuk pembuktian hash dan integritas byte (`R2_BYTE_INTEGRITY=PASS`), serta menyusun kontrak serah-terima kanonikal `StoredGeneratedImageArtifact` untuk tahapan MEDIA-A4.
- **Otorisasi & Batasan Mutasi Produksi:**
  - **Otorisasi Terbatas:** Operator telah memberikan otorisasi untuk tepat 1 objek derivatif baru pada Cloudflare R2 bucket `rancangloka-media`.
  - **Firewall Keamanan Produksi:** Dilarang melakukan mutasi D1 (`PRODUCTION_D1_MUTATIONS=0`), dilarang menambah baris pada `media_assets` (`MEDIA_ASSETS_ROWS_CREATED=0`), dilarang membuat binding `article_media` (`ARTICLE_MEDIA_ATTACHMENTS=0`), dilarang mengubah status draf/artikel (`ARTICLE_MUTATIONS=0`), dilarang memicu pipeline publikasi (`PUBLICATION_MUTATIONS=0`), dilarang deploy worker baru (`PRODUCTION_DEPLOYED=NO`), dan dilarang memanggil provider berbayar (`FAL_API_CALLS=0`).
- **Implementasi Engine Derivatif (`src/lib/media/stored-image-artifact.ts`):**
  - **`renderTextWatermarkDerivative()`:** Merender watermark teks menggunakan W3C Canvas 2D engine (`@napi-rs/canvas`) dengan rumus metriks dan penempatan deterministik dari `extensions/lokamedia/src/watermark-engine.js`.
  - **Preservasi Dimensi:** Dimensi piksel sumber (169×512) dipertahankan mutlak tanpa peregangan atau distorsi pada derivatif (169×512).
  - **`createStoredGeneratedImageArtifact()`:** Membangun kontrak `StoredGeneratedImageArtifact` yang mencakup identitas deterministik `artifact_id`, `source_artifact_id`, namespace R2 `storage_key`, `sha256`, `byte_size`, `watermark_applied=true`, `watermark_config_hash`, dan provenance terverifikasi lengkap.
- **Hasil Eksekusi Live Canary R2 Produksi (`scripts/run-media-a3-r2-canary.js`):**
  - **Sumber Aman:** `public/stitch-homepage.png` (`SOURCE_BEFORE_SHA256: 92eca8e32eb2f0f4e176054d82ce8830faf103044ddb75f59f778e204763676d`, 169×512 px, 58.941 bytes).
  - **Derivatif Lokal:** `DERIVATIVE_SHA256: 7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967`, 169×512 px, 66.377 bytes, MIME `image/png`.
  - **Idempotensi Lokal:** Terverifikasi 100% deterministik (`R2_DERIVATIVE_IDEMPOTENCY: PASS`).
  - **Pemeriksaan Pra-Upload (Fail-Closed Guard):** Kunci `media/canary/media-a3/7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967.png` diverifikasi terlebih dahulu di bucket `rancangloka-media`; terkonfirmasi objek belum ada (HTTP 404).
  - **Upload R2 Produksi:** Tepat 1 kali percobaan upload via `wrangler r2 object put` menggunakan `CLOUDFLARE_ACCOUNT_ID=a8e6d11d45dc2d14fe49fe3b84958ee8` (`PRODUCTION_R2_UPLOAD_ATTEMPTS=1`, `PRODUCTION_R2_UPLOAD_SUCCESS=YES`).
  - **Re-Download & Pembuktian Integritas:** Objek diunduh ulang dari bucket produksi, dihitung ulang SHA-256 dan byte size-nya, dan terbukti 100% identik dengan derivatif lokal (`R2_BYTE_INTEGRITY: PASS`).
  - **Imutabilitas Sumber Asli:** `SOURCE_AFTER_SHA256` terbukti persis sama dengan `SOURCE_BEFORE_SHA256` (`SOURCE_IMMUTABLE: PASS`).
  - **Pengiriman Publik:** `PUBLIC_MEDIA_DELIVERY: NOT_APPLICABLE_UNTIL_MEDIA_A4` (route `/media/[key]` single segment tanpa slash, sesuai antisipasi spesifikasi).
  - **Kontrak Serah-Terima:** Disimpan di `artifacts/stored-generated-image-artifact.json` (`MEDIA_A4_STORAGE_CONTRACT: READY`).
- **Pengujian Unit & Regresi (`scripts/test-media-a3-r2-canary.js`):**
  - 6/6 tes unit MEDIA-A3 LULUS (immutability, render deterministik, preservasi dimensi, validasi magic bytes, pembuatan kontrak, dan firewall rahasia).
  - Seluruh rangkaian regresi sistem (A2, watermark settings, asset storage, headless provider, fal mock, fullres capture, asset registration, media planning, typecheck tsc, build astro) lulus 100%.
- **Commit Repositori:**
  - `2e617c3`: `feat: watermark and store production media artifact`

### MEDIA-A2 Provider-Neutral Image Artifact Normalization & Validation 2026-09-25

- **Tujuan & Ruang Lingkup:** Membangun lapisan normalisasi dan validasi artefak media netral-provider (`GeneratedImageArtifact`) untuk menjembatani output dari berbagai sumber pembuatan gambar (jalur otonom `fal.ai FLUX`, jalur manual browser bridge `ChatGPT Plus / LokaMedia`, dan aset fixture repositori lokal) ke dalam format kanonikal tunggal tanpa bergantung pada struktur respons spesifik vendor atau DOM browser, dilengkapi validasi biner asli, ekstraksi dimensi, deteksi anti-spoofing MIME, hashing SHA-256 deterministik, aturan identitas content-addressed, model error bertipe, dan firewall privasi/rahasia.
- **Implementasi Normalisasi & Validasi (`src/lib/media/generated-image-artifact.ts`):**
  - **Kontrak `GeneratedImageArtifact`:** Memuat `artifact_id`, `source_type` (`fal_api` / `chatgpt_browser_bridge` / `local_fixture`), `provider`, `model`, `image_bytes`, `mime_type`, `width`, `height`, `byte_size`, `sha256`, `prompt_hash`, `prompt_version`, `media_role`, `purpose`, `created_at`, dan `provenance`.
  - **Aturan Identitas Kanonikal:** `ARTIFACT_IDENTITY_RULE = 'art_${sha256.substring(0, 24)}'`. Dua biner yang persis sama akan selalu menghasilkan `artifact_id` yang identik.
  - **Fungsi Normalisasi:**
    - `normalizeHeadlessResult`: Menormalkan `ImageGenerationResult` dari provider otonom.
    - `normalizeChatGptBridgeResult`: Menormalkan objek tangkapan dari ekstensi browser LokaMedia (`bytes`, `data_url`, `blobKey`, dsb).
    - `normalizeLocalFixture`: Menormalkan aset berkas lokal terverifikasi.
  - **Validasi Biner & Anti-Spoofing:** Memeriksa magic bytes asli (PNG, JPEG, WebP), mengekstraksi dimensi asli, menolak biner kosong/terpotong (`EMPTY_IMAGE`), menolak respon HTML/JSON error provider (`INVALID_IMAGE_SIGNATURE`), serta mendeteksi ketidaksesuaian deklarasi MIME (`UNSUPPORTED_MIME`) dan dimensi (`DIMENSION_INVALID`).
  - **Secret & Privacy Firewall:** Fungsi `sanitizeProvenance()` dan `sanitizeUrl()` memindai dan menghapus seluruh token otentikasi (`FAL_KEY`, `authorization: Bearer ...`, cookies, session tokens, serta query parameter URL sensitif seperti `?key=`, `?sig=`, `?token=`).
  - **Kontrak Serah-Terima MEDIA-A3:** Fungsi `createMediaA3Contract` memformat input tervalidasi yang siap dikonsumsi tahapan watermark dan R2 storage.
- **Pengujian Unit MEDIA-A2 (`scripts/test-media-a2-normalization.js`):**
  - 14/14 tes unit deterministik offline lulus 100% (headless normalization, chatgpt bridge normalization, local fixture canary, binary magic bytes, MIME anti-spoofing, dimension anti-spoofing, SHA-256 hashing, artifact identity semantics, provenance normalization, secret firewall, HTML error rejection, JSON error rejection, empty bytes fail-closed, dan media-a3 contract creation).
- **Canary Fixture Lokal Riil:**
  - `CANARY_SOURCE`: `public/stitch-homepage.png`
  - `CANARY_SOURCE_TYPE`: `local_fixture`
  - `ARTIFACT_ID`: `art_92eca8e32eb2f0f4e176054d`
  - `ARTIFACT_SHA256`: `92eca8e32eb2f0f4e176054d82ce8830faf103044ddb75f59f778e204763676d`
  - `ARTIFACT_BYTE_SIZE`: `58941`
  - `ARTIFACT_WIDTH`: `169`, `ARTIFACT_HEIGHT`: `512`
  - `ARTIFACT_MIME`: `image/png`
- **Commit Repositori:**
  - `f8bc39f`: `feat: normalize generated media artifacts`

### MEDIA-A1 & MEDIA-A1.1 Headless Image Provider Adapter & Fal.ai Autonomous Pipeline 2026-09-25

- **Tujuan & Ruang Lingkup:** Menggantikan ketergantungan generasi gambar manual pada browser/ekstensi Chrome dengan adapter API provider headless netral-provider (`ImageProviderAdapter`), memisahkan arsitektur generasi otonom (`fal.ai API` / FLUX) dan generasi manual (`ChatGPT Plus UI` via ekstensi LokaMedia), mengimplementasikan validasi biner deterministik lokal, hashing prompt deterministik, penanganan error bertipe, pelindung panggilan tunggal (`MAX_PROVIDER_GENERATE_CALLS=1`), pencatatan provenance lokal, serta kontrak serah-terima ke tahapan MEDIA-A2.
- **Klarifikasi Arsitektur Provider Terpisah (Provider Separation):**
  - **Otonom (Server-Side / Background):** `fal.ai API` menggunakan model `fal-ai/flux/dev` via `FalImageProviderAdapter`. Menggunakan endpoint API komersial terstruktur, mendukung rasio lanskap arsitektural editorial (1312×672 / 1312×656 mendekati ~2:1), materialisasi download URL ke byte lokal, dan otentikasi via `FAL_KEY`.
  - **Manual (Human-Supervised):** `ChatGPT Plus browser UI` via ekstensi browser LokaMedia / CDP bridge.
  - **Konvergensi Kontrak:** Kedua jalur generasi menormalkan output ke kontrak downstream kanonikal yang persis sama: `ImageGenerationResult` / `GeneratedImageArtifact`.
- **Implementasi Abstraksi Netral-Provider (`src/lib/media/`):**
  - **`image-provider-types.ts`:** Mendefinisikan interface `ImageProviderAdapter`, kontrak permintaan `ImageGenerationRequest`, hasil `ImageGenerationResult`, metadata biaya `ImageCostMetadata`, dan model error bertipe `ImageProviderError` dengan kode: `AUTH_ERROR`, `RATE_LIMIT`, `TIMEOUT`, `PROVIDER_5XX`, `INVALID_RESPONSE`, `CONTENT_POLICY_BLOCK`, `DOWNLOAD_FAILURE`, `UNKNOWN_PROVIDER_ERROR`.
  - **`image-validation.ts`:** Validator biner deterministik memeriksa magic bytes signature untuk PNG, JPEG, dan WebP, mengekstraksi dimensi piksel asli, menolak payload teks/HTML/error yang menyamar sebagai gambar, serta menghitung hash SHA-256 melalui Web Crypto.
  - **`headless-image-pipeline.ts`:** Koordinator pipeline headless yang menegakkan kuota panggilan keras canary (`MAX_CALLS`), menghitung SHA-256 prompt yang dinormalisasi (`computePromptSha256`), menyimpan artefak biner lokal, menyusun provenance terverifikasi bebas rahasia, dan memformat kontrak serah-terima `MediaA2InputContract`.
  - **`fal-image-adapter.ts`:** Adapter resmi fal.ai mengintegrasikan `@fal-ai/client`, menangani pemetaan rasio gambar, pengunduhan biner dari hosted URL, redaksi total rahasia token (`[REDACTED_FAL_KEY]`), dan pemetaan error fal.ai ke model error kanonikal.
  - **`openai-image-adapter.ts`:** Adapter OpenAI DALL-E 3 yang mendukung mode `b64_json` dengan sanitasi ketat pesan error gateway.
- **Hasil Pengujian & Verifikasi Unit:**
  - **`test-headless-image-provider.js`:** 7/7 tes unit lulus (pemetaan permintaan, normalisasi respons, redaksi rahasia, hash prompt deterministik, validasi biner, klasifikasi error bertipe, dan batas 1-panggilan keras).
  - **`test-fal-image-provider.js`:** 7/7 tes unit fal.ai lulus (pemetaan dimensi fal 1312x672/1024x1024/672x1312, normalisasi URL & download byte, proteksi kredensial, validasi biner, pemetaan error API, dan koordinasi batas panggilan tunggal).
- **Hasil Regresi & Build Komprehensif:**
  - `node scripts/test-decision-media-planning.js`: 16/16 PASSED.
  - `node scripts/test-lokamedia-phase5d4a-watermark-settings.js`: 14/14 PASSED.
  - `node scripts/test-lokamedia-phase5d4b-watermark-asset-storage.js`: 12/12 PASSED.
  - `node scripts/test-lokamedia-phase5g1-asset-registration.js`: 40/40 PASSED.
  - `npx tsc --noEmit`: 0 error tipe.
  - `npm run build`: Astro production SSR build PASSED (5.86s).
- **Status Eksekusi Live Canary & Guardrail Kredensial:**
  - **Canary OpenAI:** 1 panggilan genuine dikirim ke endpoint OpenAI; gateway mengembalikan HTTP 401 (`AUTH_ERROR`) non-billable (`Incorrect API key provided: [REDACTED_KEY]`). Eksekusi berhenti deterministik tanpa mutasi atau tagihan.
  - **Canary Fal.ai:** Mengikuti guardrail keselamatan Bagian 1 & 2 (*"Check only: FAL_KEY_PRESENT=YES|NO. If NO: STOP"*), sistem memeriksa lingkungan: `FAL_KEY_PRESENT=NO`. Eksekusi berhenti aman sebelum pemanggilan jaringan (`FAL_API_REQUEST_ATTEMPTS=0`, `OFFLINE_BINARY_VALIDATOR_TESTS=PASS`, `LIVE_IMAGE_BINARY_VALIDATION=N/A`).
- **Invarian Keamanan Produksi:**
  - `PRODUCTION_D1_MUTATIONS=0`, `PRODUCTION_R2_UPLOADS=0`, `ARTICLE_MEDIA_ATTACHMENTS=0`, `ARTICLE_MUTATIONS=0`, `PUBLICATION_MUTATIONS=0`, `PRODUCTION_DEPLOYED=NO`.
  - Tidak ada kunci rahasia yang tercetak di log, tersimpan di sumber, atau tersimpan di file provenance.
  - Artefak lokal berada dalam direktori `artifacts/` yang telah diabaikan oleh Git (`.gitignore`).
- **Commit Repositori:**
  - `bbd6d3d`: `feat: add headless image provider adapter`
  - `eee93ee`: `feat: add fal image provider adapter`

### MEDIA-W1 Watermark Production End-to-End Canary 2026-09-24

- **Tujuan & Ruang Lingkup:** Membuktikan alur kerja watermark media RancangLoka end-to-end pada lingkungan produksi nyata (`SOURCE IMAGE → WATERMARK CONFIG → DERIVATIVE RENDER → DERIVATIVE BYTES → R2 → MEDIA_ASSETS → FRONTEND DELIVERY`) tanpa memutasi artikel produksi (Artikel 1, 5, 6 tetap utuh), membuktikan imutabilitas mutlak byte sumber asli, serta menjaga seluruh batas kontrol keselamatan (`mode=OFF`, `auto_schedule=false`, `kill_switch=0`, `JEV authority=ZERO`).
- **Audit Subkoleksi Logo & Konfigurasi:**
  - Konfigurasi aktif di D1 produksi: `type='TEXT'`, `text='rancangloka.com'`, `position='bottom-right'`, `opacity=0.65`, `margin_x_ratio=0.022`, `margin_y_ratio=0.028`, `version=2`.
  - Audit logo resmi RancangLoka (`site_watermark_assets`): 0 baris di D1 produksi, tidak ada aset logo resmi di repositori. Sesuai batasan operasional, pembuatan logo fiktif dilarang keras, sehingga canary IMAGE di-skip secara bersih (`IMAGE_WATERMARK_CANARY=SKIPPED_NO_OFFICIAL_ASSET`).
- **Pemilihan Aset Sumber Aman (Safe Source Asset):**
  - Menggunakan aset internal non-kritis milik proyek: `canary-source-stitch-dashboard.png` (512 × 410 px, `image/png`, 42.919 bytes, SHA-256: `eb76a0a608e64422d74d697ce66b0631c45113e1f2ff54c3595cc0952ecf1998`).
  - Terdaftar di `media_assets` D1 produksi dengan Asset ID: `ast_993f8cdef94bc30f403082c2`, role: `ORIGINAL`.
  - Byte asli di Cloudflare R2 bucket `rancangloka-media` diverifikasi sebelum dan sesudah eksekusi canary (`ORIGINAL_SOURCE_IMMUTABLE=PASS`, `SOURCE_BEFORE_SHA256 === SOURCE_AFTER_SHA256`).
- **Eksekusi Pipeline Derivatif Teks (Text Derivative Pipeline):**
  - **Render Kanonikal:** Dijalankan melalui mesin rendering kanonikal dengan OffscreenCanvas native browser (`applyWatermarkTransform`): 512 × 410 px, 62.080 bytes, SHA-256: `d89bf7d4074e29d2d16762ad34b1a8e5023d03f697c3114dc36fe922fb751bc2` (`TEXT_RENDER_SUCCESS=YES`).
  - **Identitas Deterministik:** Transform ID `2803c1761da301dff63a2f444346f3b7777212de5eae70c5526c5bb71252468e`, Derivative ID `der_c3c4ab6d62d5c05b85fe7a2a907e92b72cfc114d982874a94a4c93d811208629`.
  - **Upload R2 Produksi:** Diunggah ke bucket `rancangloka-media` dengan key `canary-text-derivative-d89bf7d4.png`. Hash terbaca dari R2 cocok 100% dengan hash byte lokal (`TEXT_R2_UPLOAD=PASS`).
  - **Registrasi `media_assets`:** Asset ID `ast_e29a1bb65e754877158e7ec0` tersimpan di database D1 produksi dengan `provenance_json` lengkap (`source_media_asset_id`, `watermark_config`, `derivative_id`, `transform_id`) (`TEXT_MEDIA_REGISTRATION=PASS`).
  - **Frontend Delivery:** Permintaan `GET /media/canary-text-derivative-d89bf7d4.png` menyajikan derivatif dengan status HTTP 200, Content-Type `image/png`, 62.080 bytes, SHA-256 sesuai (`TEXT_FRONTEND_DELIVERY=PASS`).
  - **Visual QA:** Teks "rancangloka.com" tampil kontras, bersih, putih dengan bayangan jatuh tipis di sudut kanan bawah, opasitas proporsional, konten gambar asli tetap jelas tanpa artefak deformasi (`TEXT_VISUAL_QA=PASS`).
- **Firewall Keamanan & Integritas Produksi:**
  - `NEW_CANARY_ARTICLE_MEDIA_BINDINGS=0`, `ARTICLE_MEDIA_FIREWALL=PASS`.
  - `NEW_PUBLICATION_PLANS=0`, `NEW_PUBLICATION_EXECUTIONS=0`, `NEW_PUBLICATION_RECEIPTS=0`, `NEW_PUBLICATIONS=0`.
  - Mode otomasi tetap: `mode=OFF`, `auto_schedule=false`, `kill_switch=0`, `JEV authority=ZERO`.
  - Status kesehatan publik: 5 dari 5 endpoint lulus (`FINAL_PUBLIC_HEALTH=PASS`).
  - Klasifikasi akhir: `WATERMARK_STATUS=TEXT_PRODUCTION_PROVEN_IMAGE_AWAITING_OFFICIAL_ASSET`, `WATERMARK_E2E_PRODUCTION_PROVEN=PARTIAL`.

### LokaMedia Phase 5L13B-B Single Canary Featured Media Production Canonical Ingest 2026-09-22

- **Tujuan & Ruang Lingkup:** Menyiapkan Artikel 5 (`kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`) sebagai tepat SATU (*single canary*) kandidat eligible publikasi deterministik di bawah `auto_policy` tanpa mengaktifkan otomasi publikasi, melalui pembuatan aset gambar utama editorial terdedikasi, validasi biner lokal (1315x660 px, WebP), pengunggahan kanonikal melalui endpoint `POST /api/internal/v1/media/upload`, registrasi aset kanonikal `media_assets`, binding relasional `article_media`, serta rekonsiliasi kesiapan publikasi melalui endpoint terotentikasi sesi admin `POST /api/admin/publication/readiness/5`.
- **Eksekusi Ingest Media Kanonikal Produksi:**
  - **Aset Gambar Terdedikasi:** Dihasilkan sesuai arahan kreatif terkunci (fotografi arsitektural editorial fotorealistik ruang tinggal tropis Indonesia membandingkan kusen aluminium ramping matte-charcoal dan kusen uPVC multi-chamber hangat berdampingan secara netral tanpa teks/logo/manusia/CGI).
  - **Validasi Biner Lokal:** Dimensi 1315 × 660 px, format `image/webp`, ukuran 170.790 bytes (170,8 KB), SHA-256: `631baf7a25e9986b9f0d01073633cb434ae162b3df1241ddac56b977026276e9`.
  - **Jalur Ingest Kanonikal:** Menggunakan `POST /api/internal/v1/media/upload` dengan otentikasi kredensial perangkat lingkungan produksi (`RANCANGLOKA_MEDIA_UPLOAD_KEY`, scope `media:write:draft`). Binary payload langsung diunggah ke Cloudflare R2 bucket `rancangloka-media` dengan storage key `media/images/631baf7a25e9986b9f0d01073633cb434ae162b3df1241ddac56b977026276e9.webp`.
  - **Registrasi `media_assets`:** Asset ID `ast_mfUpgVe99C_bq_p2d_O4Ge4L`, status `VALIDATED`, source_type `manual_upload`, media_type `image`, dimensi 1315x660, alt text informatif tanpa keyword stuffing.
  - **Binding Relasional `article_media`:** Record ID 11 mengikat `ast_mfUpgVe99C_bq_p2d_O4Ge4L` ke Artikel 5 (`role='featured'`, `slot_key='featured'`, `is_active=1`). Artikel 1–4 dan 6 sama sekali tidak tersentuh.
- **Hasil Rekonsiliasi Kesiapan Publikasi (Readiness Snapshot):**
  - Pemanggilan `POST /api/admin/publication/readiness/5` melalui konteks sesi admin menghasilkan evaluasi deterministik baru:
  - `checks.article_integrity`: PASS
  - `checks.editorial_guards`: PASS
  - `checks.evidence_and_citations`: PASS
  - `checks.visual_media`: PASS
  - `checks.publication_metadata`: PASS
  - `policy.system_policy_pass`: true (`ARTICLE_5_SYSTEM_POLICY_PASS=YES`).
  - Sisa blocker: `["APPROVAL_MISSING"]` (sesuai semantik arsitektur terkunci, ketiadaan persetujuan manusia tidak menggugurkan kelayakan `auto_policy`).
- **Pembuktian Calon Tunggal Prospektif (Exactly-One Prospective Candidate):**
  - Draft 1–4: `PROSPECTIVE_ELIGIBLE = NO` (tidak memiliki binding media relasional aktif di `article_media` dan gagal quality gate deterministik).
  - Draft 5: `PROSPECTIVE_ELIGIBLE = YES` (lolos seluruh 5 gate deterministik `auto_policy`).
  - `PROSPECTIVE_AUTO_POLICY_CANDIDATE_COUNT = 1`, `PROSPECTIVE_AUTO_POLICY_CANDIDATE_IDS = [5]`.
- **Firewall Keamanan & Status Siklus Hidup Tetap Terjaga:**
  - Mode otomasi tetap non-aktif: `FINAL_MODE=OFF`, `FINAL_AUTO_SCHEDULE=false`, `FINAL_KILL_SWITCH=0`.
  - Siklus hidup bersih: `NEW_PLANS=0`, `NEW_EXECUTIONS=0`, `NEW_RECEIPTS=0`, `NEW_PUBLICATIONS=0`.
  - Integritas situs publik: Beranda publik sehat, Artikel 6 terbit tetap utuh, sitemap sehat tanpa kebocoran draft, Artikel 5 tetap berstatus `draft` (404 pada URL publik).
  - Mutasi raw SQL: 0. Mutasi ad-hoc R2: 0.

### LokaMedia Phase 5L13B-Pre Production Media Audit & Suitability Decision 2026-09-22

- **Tujuan & Ruang Lingkup:** Melakukan audit mendalam terhadap seluruh aset media yang ada pada database D1 produksi (`media_assets`, `article_media`), Cloudflare R2 bucket (`rancangloka-media`), serta galeri CMS admin untuk mengevaluasi kelayakan penggunaan ulang (*reuse suitability*) sebagai aset gambar utama (*featured media*) bagi Artikel 5 (`kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`).
- **Hasil Audit Inventaris Media Produksi:**
  - **D1 `media_assets`:** 0 baris (belum ada aset kanonikal terdaftar).
  - **D1 `article_media`:** 0 baris (belum ada relasi binding media ke artikel).
  - **R2 Storage (`rancangloka-media`):** Ditemukan tepat 1 objek biner aktif: `rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman-8422.webp` (148 KB, WebP, resolusi 1200x600 px). Objek ini terikat pada Artikel 6 yang telah terbit.
  - **Aset Draft Artikel 1–5:** Artikel 1 memiliki referensi gambar bambu laminasi dengan resolusi 400x267 px (gagal batas minimum resolusi kanonikal ≥600x338 px). Artikel 2–5 memiliki nilai `featured_image = ""`.
  - **Fixture Lokal:** Identitas fixture pada SQLite miniflare lokal (`ast_phase5l5_5`, `ast_phase5l7_fixture`) terbukti tidak ada di D1 maupun R2 produksi.
- **Evaluasi Kesesuaian (Reuse Suitability) untuk Artikel 5:**
  - Artikel 5 membahas komparasi material kusen jendela dan pintu tropis (*kusen aluminium vs uPVC*).
  - Objek R2 yang ada secara tematik dan visual menampilkan rekayasa aliran udara ventilasi silang (milik Artikel 6). Penggunaan ulang objek ini dinilai **TIDAK SESUAI (UNSUITABLE)** dan berisiko merusak integritas konten editorial.
- **Pemberlakuan Guardrail Keamanan (STOP DULU):**
  - Mengikuti instruksi ketat: *"kalau tidak ada → STOP dulu, jangan generate sembarangan"*, agen menghentikan proses mutasi dan tidak melakukan pembuatan atau pengunggahan gambar sembarangan tanpa persetujuan eksplisit.
- **Invarian Keamanan Produksi Tetap Terjaga:**
  - Mode otomasi tetap non-aktif: `AUTOMATION_MODE=OFF`, `AUTO_SCHEDULE_ENABLED=false`, `KILL_SWITCH=0`.
  - Status lifecycle bersih: `TOTAL_PLANS=0`, `ACTIVE_PLANS=0`, `TOTAL_EXECUTIONS=0`, `ACTIVE_EXECUTIONS=0`, `TOTAL_RECEIPTS=0`.
  - Nol mutasi pada produksi (`PRODUCTION_MUTATIONS=0`, `PRODUCTION_R2_WRITES=0`).

### LokaMedia Phase 5L13A Production Plan-Only Candidate Isolation Audit 2026-09-22

- **Tujuan & Ruang Lingkup:** Melakukan audit read-only komprehensif pada 5 draft artikel produksi untuk mengevaluasi kelayakan otomatis terhadap kebijakan publikasi sistem (`auto_policy` / `evaluateAutoScheduleEligibility`) guna menetapkan strategi isolasi deterministik calon kanari (*single-canary strategy*) sebelum aktivasi `PLAN_ONLY`.
- **Evaluasi 5 Draft Artikel Menggunakan Kebijakan Kanonikal:**
  - Seluruh 5 draft saat ini berstatus `AUTO_SCHEDULE_ELIGIBLE = NO` dan `SYSTEM_POLICY_PASS = NO`.
  - Penyebab utama kegagalan deterministik: Ketiadaan binding media utama aktif pada tabel relasional `article_media` (`FEATURED_MEDIA_MISSING`).
  - Draft 1–4 belum memiliki snapshot evaluasi kesiapan (`article_publication_readiness`).
  - Draft 5 memiliki snapshot historis dengan status `NOT_READY` dan blocker `FEATURED_MEDIA_MISSING`.
- **Semantik Persetujuan Kebijakan Otomatis (Locked Architecture):**
  - Mempertahankan arsitektur yang terkunci: Kelayakan `auto_policy` tidak mewajibkan persetujuan manusia (`AUTO_POLICY_APPROVAL_SEMANTICS_PRESERVED=YES`). Status `HUMAN_APPROVAL_PASS=NO` tidak menggugurkan artikel jika seluruh quality gate deterministik terpenuhi.
- **Populasi Kandidat & Analisis Risiko:**
  - Jumlah draft eligible saat ini: `AUTO_POLICY_ELIGIBLE_DRAFT_COUNT=0` (`AUTO_POLICY_ELIGIBLE_ARTICLE_IDS=[]`).
  - Klasifikasi risiko Exactly-One: `PLAN_ONLY_EXACTLY_ONE_RISK=NO_CANARY_AVAILABLE`.
- **Pemilihan Calon Kanari Kanonikal:**
  - Rekomendasi Kanari: Artikel ID 5 (`kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`).
  - Alasan: Artikel 5 merupakan artikel editorial asli (bukan smoke test fixture) yang telah lolos seluruh gate integritas teks, editorial guards, sitasi, dan metadata, serta hanya membutuhkan penyediaan binding media utama yang valid untuk mencapai `system_policy_pass=true`.
  - Mekanisme isolasi: `NATURALLY_ISOLATED` (tidak memerlukan temporary manual hold karena draft lain belum memenuhi syarat kualitas).
- **Analisis Kapabilitas Mode `PLAN_ONLY` & Kesiapan Jalur Kontrol:**
  - Di bawah mode `PLAN_ONLY`: `canPlan=true`, `canScheduleControlled=false`, `canPublishUnattended=false`. Pembuatan rencana diizinkan, namun promosi eksekusi dan penerbitan dilarang mutlak.
  - Endpoint operator terotentikasi kanonikal `POST /api/admin/publication/automation/control` terverifikasi siap mendukung transisi mode `OFF → PLAN_ONLY → OFF` dan `auto_schedule` `false → true → false` lengkap dengan audit logging.
- **Hasil Fase:** `PHASE_5L13A=PASS`, `READY_FOR_PHASE_5L13B=YES`. Mutasi produksi: 0.

### LokaMedia Phase 5L12D Canonical Production OBSERVE_ONLY Round-Trip 2026-09-22

- **Tujuan & Ruang Lingkup:** Menguji validasi round-trip mode otomasi kanonikal produksi pertama (`OFF → OBSERVE_ONLY → OFF`) menggunakan endpoint operator terotentikasi kanonikal `POST /api/admin/publication/automation/control` melalui konteks sesi browser admin yang sah, membuktikan atomisitas pencatatan audit kontrol-plane dan keamanan native Cron tanpa mutasi lifecycle.
- **Konteks & Keamanan Sesi Browser:**
  - Sesi admin terotentikasi aktif pada browser (`AUTHENTICATED_ADMIN_BROWSER_SESSION=YES`).
  - Permintaan mutasi dikirim melalui same-origin fetch dari konteks browser admin (`BROWSER_CANONICAL_REQUEST_METHOD=same_origin_fetch`), memenuhi pertahanan CSRF tanpa mengekstrak cookie/token rahasia.
  - Zero raw SQL: Tidak ada manipulasi SQL langsung ke tabel kontrol (`RAW_SQL_CONTROL_MUTATIONS=0`).
- **Aktivasi OBSERVE_ONLY Kanonikal:**
  - Transisi mode `OFF → OBSERVE_ONLY` berhasil via API (HTTP 200, `changed: true`).
  - Tercatat audit event ID: `actl_b951237dd0934f93`, correlation ID: `corr_bf57b3713580485a`, actor: `admin_operator`.
  - Status D1 produksi terverifikasi: `mode=OBSERVE_ONLY`, `auto_schedule_enabled=false`, `kill_switch_engaged=0`.
- **Observabilitas Native Cron di Bawah OBSERVE_ONLY:**
  - Menunggu trigger native Cloudflare Cron alami tanpa pemanggilan manual (`MANUAL_CRON_TRIGGER_CALLS=0`).
  - Dispatcher native cron mencatat status aman: `BLOCKED` (`UNATTENDED_PUBLISH_BLOCKED`) pada mode `OBSERVE_ONLY` (ID 615).
  - Reconciler native cron mencatat status aman: `BLOCKED` (`AUTOMATION_MODE_BLOCKS_EXECUTION_OBSERVE_ONLY`) pada mode `OBSERVE_ONLY` (ID 616).
  - Planner tidak dijadwalkan / belum jatuh tempo (`NOT_YET_DUE`).
- **Invarian Lifecycle & Kesehatan Publik:**
  - Mutasi rencana baru = 0 (`NEW_PLAN_COUNT=0`), mutasi eksekusi baru = 0 (`NEW_EXECUTION_COUNT=0`), tanda terima baru = 0 (`NEW_RECEIPT_COUNT=0`), publikasi baru = 0 (`NEW_PUBLICATION_COUNT=0`).
  - Status artikel konsisten tidak berubah (Draft: 5, Published: 1).
  - Rute publik tetap sehat: Homepage HTTP 200, artikel terbitan HTTP 200, sitemap XML HTTP 200.
- **Pengembalian Kanonikal ke OFF:**
  - Transisi mode `OBSERVE_ONLY → OFF` berhasil dieksekusi dari konteks browser kanonikal yang sama (HTTP 200, `changed: true`).
  - Tercatat audit event ID kedua: `actl_af92b730e5834af6`, correlation ID: `corr_b46d420022cc49c9`.
  - Tepat 2 event audit tercatat selama fase ini (`NEW_MODE_CHANGE_AUDIT_EVENTS=2`).
- **Status Akhir & Kesiapan:**
  - Mode akhir: `FINAL_MODE=OFF`, `FINAL_AUTO_SCHEDULE=false`, `FINAL_KILL_SWITCH=0`.
  - Kontrol operator kanonikal terbukti 100% aman dan teraudit secara persisten di produksi (`CANONICAL_PRODUCTION_CONTROL_VERIFIED=YES`).
  - Siap untuk fase berikutnya Phase 5L13 (`READY_FOR_PHASE_5L13=YES`).

### LokaMedia Phase 5L12C Canonical Control Production Deployment 2026-09-22

- **Tujuan & Ruang Lingkup:** Menerapkan migrasi D1 produksi `0020_automation_control_audit.sql` dan mendeploy Worker `rancangloka` yang berisi fondasi kontrol operator kanonikal terotentikasi & teraudit ke lingkungan produksi Cloudflare dalam kondisi aman non-aktif (`mode=OFF`, `auto_schedule_enabled=false`, `kill_switch_engaged=0`).
- **Verifikasi Pre-Deploy & Backup:**
  - Backup D1 produksi dibuat sukses melalui `wrangler d1 export` ke file snapshot lokal aman di luar git (`rancangloka_db_pre_5l12c_backup.sql`).
  - Seluruh 10 test suite regresi (5L12B, 5L10, 5L9, 5L6A, 5L6, 5L4, 5L3, 5L2, readiness, soak safety) lulus 100%.
  - Typecheck (`tsc --noEmit`), build Astro, dan Wrangler dry-run seluruhnya PASS.
- **Eksekusi & Validasi Migrasi 0020:**
  - Migrasi `0020_automation_control_audit.sql` diaplikasikan ke remote database `rancangloka_db` secara kanonikal via `wrangler d1 migrations apply`.
  - Tabel terdedikasi `automation_control_audit` dan indeksnya berhasil terbuat tanpa mengubah data yang ada (`MIGRATION_0020_ADDITIVE_ONLY=YES`, `MIGRATION_0020_DESTRUCTIVE_RISK=NONE`).
  - Nol audit retroaktif terbuat (`RETROACTIVE_CONTROL_AUDITS_CREATED=0`).
- **Deployment Worker Produksi:**
  - Worker `rancangloka` berhasil dideploy ke Cloudflare Edge dengan ID versi aktif baru: `d81db579-63f1-40c4-9345-328780f6f694` (deployment sebelumnya: `3404ac08-0e5f-4e11-8e11-2f93b7119a8f` tetap menjadi referensi rollback).
  - Rute publik tetap sehat: Homepage HTTP 200, artikel terbitan (slug: `rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman`) HTTP 200, dan sitemap XML HTTP 200.
- **Validasi Keamanan Endpoint Kontrol Kanonikal:**
  - Rute `POST /api/admin/publication/automation/control` terdeploy dan aktif.
  - Permintaan mutasi anonim ditolak dengan status 401 Unauthorized (`PROD_ANONYMOUS_OPERATOR_MUTATION=DENIED`).
  - Kredensial cron ditolak (`PROD_CRON_SECRET_OPERATOR_ACCESS=DENIED_BY_DESIGN`).
  - Tidak ada mutasi mode yang dieksekusi pada fase ini (`AUTHORIZED_OPERATOR_MODE_CHANGE_CALLS=0`).
- **Observabilitas Native Cron & Invarian Lifecycle:**
  - Heartbeat native Cron pasca-deploy terpantau aktif dan aman mencatat status `BLOCKED` (alasan: `AUTOMATION_MODE_OFF` untuk dispatcher, `AUTOMATION_MODE_BLOCKS_EXECUTION_OFF` untuk reconciler).
  - Nol siklus publikasi terjadi: `POST_DEPLOY_NEW_PLAN_COUNT=0`, `POST_DEPLOY_NEW_EXECUTION_COUNT=0`, `POST_DEPLOY_NEW_RECEIPT_COUNT=0`, `POST_DEPLOY_NEW_PUBLICATION_COUNT=0`.
  - Status artikel tetap konsisten (Draft: 5, Published: 1).
  - Mutasi raw SQL pada tabel kontrol tetap dilarang (`RAW_SQL_CONTROL_MUTATIONS=0`).
- **Status Akhir & Kesiapan:**
  - Status kontrol produksi tetap aman: `FINAL_AUTOMATION_MODE=OFF`, `FINAL_AUTO_SCHEDULE=false`, `FINAL_KILL_SWITCH=0`.
  - Fondasi kanonikal siap untuk uji round-trip terkontrol pertama `OFF → OBSERVE_ONLY → OFF` via API kanonikal pada Phase 5L12D (`READY_FOR_PHASE_5L12D=YES`).

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

### Masalah 48: TypeSafe Jev Decision Platform & Live Shadow Observer (Phase JEV-4A hingga JEV-6)
* **Gejala:** Kebutuhan sistem evaluasi keputusan editorial (probabilitas review manusia, risiko publikasi, rekomendasi aksi) dan media planning adaptif secara otomatis, tanpa mengorbankan keselamatan deterministik (*Zero Authority Invariant*) dan tanpa membebani runtime publishing utama.
* **Solusi:**
  - **Typed Decision Core ([`src/lib/decision/engine.ts`](file:///src/lib/decision/engine.ts)):** Mengembangkan kontrak generic typed decision (`DecisionEngine`, `DecisionPointDefinition`, `DecisionEvaluationRequest`) dengan implementasi provider TypeSafe Jev (`OpenRouterJevProvider`) berbasis model `typesafe/jev-1.13` via OpenRouter Decisions API.
  - **Minimal State Principle:** Jev HANYA menerima metadata faktual ringkas (status validasi editorial, ada/tidaknya referensi/gambar/slug unik), BUKAN naskah artikel utuh demi menjaga efisiensi token dan keamanan editorial.
  - **Durable Decision Telemetry ([`src/lib/decision/telemetry.ts`](file:///src/lib/decision/telemetry.ts)):** Skema migrasi `0021_decision_observations.sql` di Cloudflare D1 untuk mencatat setiap observasi evaluasi (subject_id, run_id, latency_ms, raw input/output hash, cost tracking) tanpa locking transaksi publikasi.
  - **Decision Point Media Planning ([`src/lib/decision/media-planning.ts`](file:///src/lib/decision/media-planning.ts)):** Titik keputusan adaptif untuk memandu LokaMedia mengenai kebutuhan gambar hero/inline artikel, rasio aspek, dan slot penempatan sebelum generasi media dilakukan.
  - **Production Live Shadow Deployment (Version `48196b6d-fa50-493b-ab0d-5d3f8f592b50`):**
    - Migrasi D1 `0021` diaplikasikan ke remote database `rancangloka_db`.
    - Secret `OPENROUTER_API_KEY` dikonfigurasi aman pada Cloudflare Workers.
    - Window kontrol kanonik dijalankan sementara via browser admin terotentikasi: `OFF → OBSERVE_ONLY → OFF` dan `auto_schedule: false → true → false` untuk menguji native cron planner edge.
    - Terbukti non-blocking: Native Cloudflare cron planner (`crun_plan_f14a3318a8ec495a`) selesai dengan status `SUCCEEDED` dan berhasil menulis rekam jejak `decision_observations` (`obs_mudvi9qm_tlqcpw`) melalui `ctx.waitUntil`.
    - Zero publication mutation: 0 plan baru, 0 eksekusi, 0 publikasi, dan artikel draft (Article 5) tetap 100% utuh di status `draft`.

### Masalah 49: Stabilisasi Workerd Fetch Binding & Deployment Edge aca01976 (Phase JEV-6B Prep)
* **Gejala:** Observasi live shadow Jev pada eksekusi native cron di Cloudflare workerd menghasilkan error internal `TypeError: Illegal invocation` dengan `latency_ms: 0` karena instance provider memanggil `fetch` sebagai method tanpa context binding eksplisit ke `globalThis`.
* **Solusi:**
  - **Workerd Fetch Context Wrapper ([`src/lib/decision/openrouter-jev-provider.ts`](file:///src/lib/decision/openrouter-jev-provider.ts)):** Mengubah inisialisasi `this.fetchFn` menjadi wrapper arrow function `(input, init) => globalThis.fetch(input, init)`. Pola ini menjamin native fetch dieksekusi dengan `globalThis` sebagai receiver/callee di lingkungan runtime Cloudflare Workers.
  - **Suite Regresi Tambahan ([`scripts/test-decision-engine.js`](file:///scripts/test-decision-engine.js)):** Menambahkan pengujian kontekstual workerd, error handling fail-safe terhadap `TypeError`, timeout abort, kegagalan network, dan response JSON malformed (23/23 tes PASS).
  - **Edge Deployment Baru:** Berhasil di-deploy ke Cloudflare Workers dengan Version ID `aca01976-9e8b-4dc3-be53-22f2857cb2c3`.
  - **Siklus Kontrol Kanonik & Pre-Offline Safety:**
    - Window kanonik dibuka via admin API: `OFF → OBSERVE_ONLY` dan `auto_schedule: false → true` (kandidat terisolasi tepat `[5]`).
    - Sebelum operator offline, window di-pause secara kanonik: `auto_schedule: true → false` (Audit ID: `ascd_7fe9d63c5a7042a9`) dan `OBSERVE_ONLY → OFF` (Audit ID: `actl_ebbf1712ba6c41b6`).
### Masalah 50: Pembuktian Sukses Live Provider TypeSafe Jev di Produksi Edge (Phase JEV-6B)
* **Tujuan & Ruang Lingkup:** Menguji eksekusi live provider TypeSafe Jev via OpenRouter Decisions API di lingkungan produksi Cloudflare Workers pada native hourly planner cron (`0 * * * *`), memastikan perbaikan workerd fetch context binding berhasil secara sempurna, menghasilkan keputusan berbobot terstruktur (`SUCCESS`), mencatat observasi durable di D1 tanpa memblokir atau mengubah siklus hidup publikasi.
* **Hasil Eksekusi & Bukti Produksi:**
  - **Siklus Kontrol Kanonik (4 Event Audit):**
    1. `OFF → OBSERVE_ONLY` (Audit ID: `actl_b5248c85f07b4f57`, Reason: `JEV-6B successful live provider shadow proof`)
    2. `auto_schedule: false → true` (Audit ID: `ascd_9e355cabcd974780`, Reason: `JEV-6B expose isolated Article 5 for provider success proof`)
    3. `auto_schedule: true → false` (Audit ID: `ascd_1b4489297ad944f0`, Reason: `JEV-6B completed live provider proof, returning to resting state`)
    4. `OBSERVE_ONLY → OFF` (Audit ID: `actl_63fa2c69540a4d71`, Reason: `JEV-6B completed live provider proof, returning to resting state`)
    - Zero raw SQL control mutations (`RAW_SQL_CONTROL_MUTATIONS=0`).
  - **Native Cloudflare Cron Heartbeat (Pukul 19:00 WIB / 12:00 UTC):**
    - Cron Run ID: `crun_plan_ddff89e83d6c4642`, job: `publication_planner`, trigger: `cloudflare_cron`.
    - Status: `SUCCEEDED`, processed_count: `1`, created_count: `0`.
    - Planner Run ID: `prun_0420952a2f29`, eligible candidate: Article 5 (`kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`).
  - **Durable Observation Row (`decision_observations`):**
    - Observation ID: `obs_mue1xio9_ptu7zj` (D1 `rancangloka_db`).
    - Provider: `openrouter` (Model: `typesafe/jev-1.13-20260917`, Version: `20260917`).
    - Provider Status: **`SUCCESS`** (Zero network error, `provider_error_class: null`).
    - Latency: **`285 ms`** (Live external HTTP egress ke OpenRouter Decisions API terverifikasi).
    - Authoritative Decision: `continue` (`DETERMINISTIC_ELIGIBILITY_PASSED`).
    - Jev Decision: `continue` (Confidence: `1.0`, Probabilities: `{"continue":1,"human_review":0,"revise":0,"stop":0}`).
    - Disagreement Classification: `AGREE_CONTINUE`.
### Masalah 51: Aktivasi Autonomous Continuous Jev Shadow Collector di Produksi Edge (Phase JEV-7A)
* **Tujuan & Ruang Lingkup:** Mengaktifkan kolektor telemetri keputusan shadow Jev secara kontinu dan mandiri (*autonomous continuous shadow collector*) di Cloudflare Workers Edge pada jadwal native cron khusus (`17 * * * *`), tanpa memerlukan laptop operator, sesi browser admin, runtime Antigravity, mode `OBSERVE_ONLY`, `auto_schedule=true`, ataupun aktivasi publication planner. Otoritas publikasi tetap terkunci pada `mode=OFF`.
* **Arsitektur & Komponen Kolektor ([`src/lib/decision/shadow-collector.ts`](file:///src/lib/decision/shadow-collector.ts)):**
  - **Fungsi Utama (`runDecisionShadowCollector`):** Membaca state editorial secara *read-only*, menyusun sinyal preflight deterministik minimal, memeriksa deduplikasi state dan kuota harian, memanggil provider Jev (`typesafe/jev-1.13-20260917`), dan mencatat observasi terstruktur ke tabel D1 `decision_observations` serta telemetri run ke `publication_cron_runs`.
  - **Firewall Otoritas Mutlak:** Kolektor tidak memiliki kode/jalur eksekusi untuk membuat rencana publikasi, membuat eksekusi, mempublikasikan artikel, mengubah status artikel/media, ataupun memodifikasi kontrol otomasi.
  - **Deduplikasi Input Hash:** Mencegah pemanggilan berulang untuk artikel dengan state yang identik (`input_hash`). Error sebelumnya dibatasi dengan cooldown 360 menit (`JEV_SHADOW_ERROR_RETRY_MINUTES=360`).
  - **Batas Anggaran (*Budget Guards*):** Dibatasi maksimal 3 subjek per run, 3 call per run, dan pagu harian durable maksimal 25 panggilan per 24 jam berbasis kueri D1.
* **Penerapan Migrasi Skema 0022 ([`db/migrations/0022_allow_jev_shadow_collector_cron.sql`](file:///db/migrations/0022_allow_jev_shadow_collector_cron.sql)):**
  - Memperluas check constraint `publication_cron_runs` untuk menerima `job_name = 'jev_shadow_collector'`.
  - Backup D1 remote berhasil dibuat (`2.545.257 bytes`).
  - Seluruh 3.253 baris riwayat cron run, rentang ID (`min_id=1`, `max_id=3253`), dan 3 index relasional terbukti utuh (*zero data loss*).
* **Penyebaran Bertahap (*Staged Deployment*):**
  - **Stage A (Collector Disabled):** Deployed dengan `JEV_SHADOW_COLLECTOR_ENABLED="false"` (Version ID: `e7447f19-fd17-4cec-ab0e-cd7a80971348`). Public health dan rest mode `OFF` terverifikasi.
  - **Stage B (Collector Enabled):** Deployed dengan `JEV_SHADOW_COLLECTOR_ENABLED="true"` (Version ID: `e47ea5a6-25bf-4aaf-bc53-b5f9dd8e60d2`). Crons aktif: `0 * * * *`, `*/5 * * * *`, `* * * * *`, dan `17 * * * *`.
* **Bukti Eksekusi Native Cloudflare Cron Pertama (13:17 UTC / 20:17 WIB):**
  - **Cron Run ID:** `crun_coll_d37d763f64124a70`.
  - **Trigger Source:** `cloudflare_cron` (Native Cloudflare Edge scheduled worker, 100% independen tanpa laptop/Antigravity/sesi admin).
  - **Job:** `jev_shadow_collector`, Status: **`SUCCEEDED`**, Runtime: 1.989 ms.
  - **Durable Observation Row:** `obs_mue4okdt_9j2tor` pada Artikel 5 (`kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`).
  - **Provider Status:** `SUCCESS`, Model: `typesafe/jev-1.13-20260917`, Latency: `980 ms`, Input hash: `h_8fd8affc`.
  - **Keputusan:** Authoritative `continue`, Jev `revise` (probabilities: `{"stop":0.09,"revise":0.5,"continue":0.29,"human_review":0.12}`, classification: `JEV_MORE_CONSERVATIVE`).
  - **Telemetry Run Details:** `dailyCallsUsed: 3`, `dailyCallsRemaining: 22`, `dedupeSkippedCount: 0`, `providerCallCount: 1`.
* **Invarian Keselamatan Produksi Pasca-Run:**
  - Status resting publikasi: `mode=OFF`, `auto_schedule_enabled=false`, `kill_switch_engaged=0`.
  - Mutasi publikasi: 0 plan baru, 0 eksekusi baru, 0 receipt baru, 0 artikel dipublikasikan.
  - Artikel 5 tetap berstatus `draft` dengan content hash `c77881c0c350...` 100% utuh.
* **Status Fase:** `JEV_PHASE_7A = PASS`. Autonomous shadow collector aktif dan siap untuk observasi multi-cycle lanjutan (Phase JEV-7B).

### Masalah 52: Multi-Cycle Autonomous Shadow Calibration & Deduplication Stability (Phase JEV-7B)
* **Tujuan & Ruang Lingkup:** Mengamati dan memvalidasi stabilitas autonomous shadow collector sepanjang beberapa siklus native cron Cloudflare (`17 * * * *`) tanpa intervensi laptop operator, membuktikan ketahanan deduplikasi input-hash, dan mengaudit divergensi state input antara jalur Planner dan Autonomous Collector.
* **Hasil Observasi Multi-Cycle Produksi:**
  - **Siklus 1 (20:17 WIB):** Observasi pertama berhasil dibuat (`obs_mue4okdt_9j2tor`), input hash `h_8fd8affc`, Jev decision: `revise`, authoritative decision: `continue`.
  - **Siklus 2 (21:17 WIB):** Native cron berhasil dieksekusi (`crun_coll_f47a610e2d31...`), subjek Artikel 5 terdeteksi tidak berubah. Hasil: `dedupeSkippedCount = 1`, `providerCallCount = 0`, `observationCreatedCount = 0`, durasi 204 ms.
  - **Siklus 3 (22:17 WIB):** Native cron siklus ketiga berhasil dieksekusi secara stabil. Hasil: `dedupeSkippedCount = 1`, `providerCallCount = 0`, `observationCreatedCount = 0`, zero provider error.
  - **Pembuktian Deduplikasi:** `AUTONOMOUS_DEDUPE_PROOF = PASS`, `MULTI_CYCLE_DEDUPE_STABLE = YES`.
* **Audit Akar Penyebab Divergensi State (First-Run Hash Divergence):**
  - Pada JEV-6B (reconstructed planner state): `readinessStatus = READY_TO_SCHEDULE`, `readingTimeMinutes = 8` menghasilkan hash `h_5431867a`.
  - Pada JEV-7A (collector state): `readinessStatus = NOT_READY`, `readingTimeMinutes = 8` menghasilkan hash `h_8fd8affc`.
  - Terbukti bahwa `readingTimeMinutes` sudah konsisten pada nilai 8, namun field `readinessStatus` mengalami divergensi semantik (*semantic overloading*):
    - Jalur Planner memetakan kualifikasi operasional artikel (*planner candidate qualification*).
    - Jalur Collector membaca status checklist kesiapan editorial dari tabel D1 `article_publication_readiness.overall_status`.
* **Status Fase:** `JEV_PHASE_7B = PASS`. Direkomendasikan pembentukan kanonikal state builder terpadu (Phase JEV-7C).

### Masalah 53: Kanonikalisasi State Keputusan Jev & Validitas Kalibrasi (Phase JEV-7C)
* **Tujuan & Ruang Lingkup:** Membangun kontrak state semantik kanonikal tunggal untuk titik keputusan `publication_preflight` yang digunakan secara identik oleh publication planner shadow observer, autonomous shadow collector, dan perangkat kalibrasi masa depan. Implementasi dan pengujian dilakukan 100% lokal tanpa mutasi data produksi dan tanpa mengubah kontrol publikasi (`mode=OFF`).
* **Audit Semantik Kesiapan Editorial vs Kelayakan Kebijakan:**
  - Klasifikasi audit: **`DIFFERENT_CONCEPTS_OVERLOADED_IN_ONE_FIELD`**.
  - Mengeliminasi ambiguitas dengan memisahkan dua konsep ortogonal ke dalam field terpisah:
    1. `persistedReadinessStatus`: Status checklist editorial yang tersimpan di D1 (`'READY_TO_SCHEDULE'` | `'NOT_READY'` | `'BLOCKED'`).
    2. `plannerEligibilityStatus`: Kelayakan penjadwalan operasional di bawah kebijakan publikasi aktif (`'ELIGIBLE'` | `'NOT_ELIGIBLE'`).
* **Implementasi Modul Kanonikal Tunggal ([`src/lib/decision/publication-preflight-state.ts`](file:///src/lib/decision/publication-preflight-state.ts)):**
  - Mengonsolidasikan pembentukan 12 field primitif ternormalisasi: `project`, `articleId`, `slug`, `articleGenerationCompleted`, `editorialValidationPassed`, `referencesPresent`, `heroImagePresent`, `duplicateSlug`, `persistedReadinessStatus`, `plannerEligibilityStatus`, `readingTimeMinutes`, `isSponsored`.
  - Fungsi kanonikal: `buildCanonicalPublicationPreflightState` dan `computeCanonicalPreflightHash`.
  - Baik `planner-service.ts` maupun `shadow-collector.ts` dikonfigurasi untuk mengonsumsi builder kanonikal ini secara seragam (`DUPLICATE_STATE_BUILDERS = NO`).
* **Versioning Skema & Isolasi Deduplikasi:**
  - Skema di-bump secara aman menjadi `DECISION_SCHEMA_VERSION = '2026-09-23.v2'`.
  - Konstanta skema v1 (`'2026-09-23.v1'`) tetap dipertahankan untuk memastikan observasi historis tetap dapat diinterpretasikan (`HISTORICAL_OBSERVATIONS_REWRITTEN = NO`).
  - Kueri deduplikasi di `shadow-collector.ts` diperketat dengan filter `AND input_schema_version = ?`, menjamin `V1_V2_FALSE_DEDUPE_POSSIBLE = NO`.
* **Hasil Pengujian Lokal & Paritas:**
  - Suite baru `scripts/test-publication-preflight-canonical-state.js`: 7/7 tes PASS.
  - Membuktikan Artikel 5 menghasilkan canonical state dan input hash 100% identik antara jalur Planner dan jalur Collector (`PLANNER_COLLECTOR_STATE_PARITY = YES`, `PLANNER_COLLECTOR_HASH_PARITY = YES`).
  - Seluruh 314 pengujian lokal (safety, publisher, planner, dual-auth, continuous-shadow, decision suite) lulus tanpa regresi.
  - Typecheck `tsc --noEmit` dan `astro build` lulus dengan exit code 0.
* **Firewall Keamanan & Status:**
  - `PRODUCTION_DEPLOYED = NO`, `PRODUCTION_MUTATIONS = 0`. Otoritas Jev tetap `ZERO`.
  - Status Fase: `JEV_PHASE_7C = PASS`. Siap untuk canary deployment bertahap (Phase JEV-7D).

### Masalah 54: Penerapan Canary Skema v2 di Produksi Edge & Pembuktian Deduplikasi Mandiri (Phase JEV-7D)
* **Tujuan & Ruang Lingkup:** Menerapkan implementasi canonical state v2 (`DECISION_SCHEMA_VERSION = '2026-09-23.v2'`) ke lingkungan produksi Cloudflare Workers Edge sebagai canary terbatas, membuktikan isolasi skema v1 vs v2, memvalidasi pembentukan observasi v2 pertama via native cron, memastikan keutuhan observasi historis v1, membuktikan deduplikasi pada siklus v2 kedua tanpa panggilan provider berlebih, serta mengonfirmasi paritas state & hash produksi antara jalur Planner dan Collector tanpa memberikan otoritas publikasi apa pun kepada Jev.
* **Penyebaran Produksi (*Production Canary Deployment*):**
  - **Previous Deployment ID:** `e47ea5a6-25bf-4aaf-bc53-b5f9dd8e60d2`
  - **v2 Canary Deployment ID:** `a66a0424-9e39-451f-b068-13c1b90832b9`
  - **Audit Migrasi Database:** `JEV_7D_REQUIRES_DB_MIGRATION = NO` (tabel `decision_observations` telah mendukung kolom versioning dan hash sejak migrasi 0021).
  - **Uji Kesehatan Pasca-Deploy:** Beranda publik (200), Artikel 6 terbit (200), sitemap XML (200), gateway admin (302) terverifikasi sehat.
* **Siklus 1 Native Cloudflare Cron v2 (16:17 UTC / 23:17 WIB):**
  - **Cron Run ID:** `crun_coll_9652166db5ef4c24` (`trigger_source: cloudflare_cron`).
  - **Status Eksekusi:** `SUCCEEDED` (runtime: 2.049 ms).
  - **Isolasi Skema Terbukti (*Schema Isolation*):** Karena skema berubah ke v2, collector tidak melakukan false-dedupe terhadap baris historis v1 (`V1_V2_SCHEMA_ISOLATION_PRODUCTION = PASS`).
  - **Observasi Durable Baru Dibuat:**
    - `observation_id`: `obs_mueb41kn_01wr4b`
    - `decision_point`: `publication_preflight`, `subject_id`: `5`
    - `input_schema_version`: `2026-09-23.v2`, `prompt_version`: `v1.13`
    - `input_hash`: `h_89de9fcf`
    - `provider`: `openrouter`, `model`: `typesafe/jev-1.13-20260917`, `latency_ms`: 957
    - `authoritative_decision`: `continue` (`DETERMINISTIC_ELIGIBILITY_PASSED`)
    - `jev_decision`: `continue` (confidence: `0.37`, probabilities: `{"stop":0.12,"human_review":0.08,"revise":0.27,"continue":0.53}`)
    - `disagreement_classification`: `AGREE_CONTINUE`
* **Keutuhan Observasi Historis v1:**
  - Jumlah observasi v1 sebelum deploy: 3 (`obs_mudvi9qm_tlqcpw`, `obs_mue1xio9_ptu7zj`, `obs_mue4okdt_9j2tor`).
  - Jumlah observasi v1 setelah deploy: 3 (`HISTORICAL_V1_OBSERVATIONS_INTACT = YES`).
* **Pembuktian Paritas State & Hash Produksi:**
  - Evaluasi read-only pada data produksi Artikel 5 menunjukkan state kanonikal identik antara jalur Planner (candidateSource: `auto_policy`) dan jalur Collector:
    - `PLANNER_V2_STATE == COLLECTOR_V2_STATE`: `true`
    - `PLANNER_V2_INPUT_HASH == COLLECTOR_V2_INPUT_HASH`: `true` (`h_89de9fcf`)
    - `PRODUCTION_V2_STATE_PARITY = YES`, `PRODUCTION_V2_HASH_PARITY = YES`.
* **Siklus 2 Native Cloudflare Cron v2 (17:17 UTC / 00:17 WIB):**
  - **Cron Run ID:** `crun_coll_15e5ef111c444fa1` (`trigger_source: cloudflare_cron`).
  - **Status Eksekusi:** `SUCCEEDED` (runtime: 915 ms).
  - **Hasil Deduplikasi v2:** Subjek Artikel 5 dengan hash `h_89de9fcf` diidentifikasi tidak berubah -> `dedupeSkippedCount: 1`, `providerCallCount: 0`, `observationCreatedCount: 0`.
  - `V2_AUTONOMOUS_DEDUPE_PROOF = PASS`, `V2_DEDUPE_STABLE = YES`.
  - Panggilan provider v2: Siklus 1 = 1, Siklus 2 = 0 (`dailyCallsUsed` tetap di angka 4).
* **Firewall Keselamatan & Zero-Authority Tetap Absolut:**
  - Status resting publikasi: `mode=OFF`, `auto_schedule=false`, `kill_switch=0`.
  - Mutasi publikasi: 0 plan baru, 0 eksekusi baru, 0 receipt baru, 0 artikel dipublikasikan.
  - Artikel 5 tetap berstatus `draft` dengan content hash `c77881c0c350...` 100% utuh.
  - `JEV_AUTHORITY_UNCHANGED = ZERO`.
* **Status Fase:** `JEV_PHASE_7D = PASS`. Canonical state v2 aktif di produksi dan siap untuk Phase JEV-7E (Dataset Calibration & Calibration Tooling).

### Masalah 55: Audit Kesiapan Dataset v2 & Rancangan Ekspansi Cakupan Shadow (Phase JEV-7E & JEV-7F)
* **Tujuan & Ruang Lingkup:** Melakukan audit read-only komprehensif terhadap observasi v2 yang telah dikumpulkan di D1 produksi, mengevaluasi independensi state kandidat, dan merancang ekspansi cakupan observasi shadow agar mencakup seluruh draf editorial yang dapat dievaluasi secara semantik tanpa mengorbankan keamanan publikasi.
* **Hasil Audit Baseline Dataset v2 Produksi (Phase JEV-7E):**
  - Total observasi produksi: 4 baris (3 baris v1, 1 baris v2 `obs_mueb41kn_01wr4b`).
  - Total kandidat unik terobservasi v2: Tepat 1 subjek (Artikel 5, `h_89de9fcf`).
  - Evaluasi Kesiapan Kalibrasi: `DATASET_READY_FOR_REAL_CALIBRATION = NO` (1 subjek belum mencukupi secara statistik untuk kalibrasi multi-aksi dan evaluasi risiko).
  - Populasi Draf Produksi: 6 artikel (5 draft, 1 published). Kolektor otonom sebelumnya hanya memindai kandidat `READY_TO_SCHEDULE` yang memiliki media aktif.
* **Prinsip Ekspansi Cakupan Shadow (Phase JEV-7F):**
  - **Pemisahan Konseptual Tegas:** `PUBLISHABLE_SUBJECT != SHADOW_EVALUABLE_SUBJECT`.
  - Sebuah draf editorial dinyatakan *shadow evaluable* jika sistem dapat membentuk canonical decision state yang lengkap dan valid tanpa mutasi data, terlepas dari apakah draf tersebut berstatus `NOT_READY`, belum memiliki gambar utama (*missing featured media*), referensi belum lengkap, atau berstatus `manual_hold`.
  - Pembaruan Predikat: `isShadowEvaluable({ id, slug, status })` memvalidasi kelayakan struktural draf tanpa mengharuskan kelayakan terbit.
  - Relaksasi Selektor: Menggunakan `LEFT JOIN article_media` pada `selectProspectiveArticles` agar draf tanpa media tetap dapat dievaluasi dalam shadow mode.
* **Firewall Keamanan & Zero Authority:**
  - Evaluasi shadow terhadap draf yang belum siap tidak mengubah kelayakan terbit deterministik artikel tersebut (`SHADOW_EVALUATION_DOES_NOT_IMPLY_PUBLICATION_ELIGIBILITY = YES`).
  - Kolektor tetap memiliki otoritas nol (`JEV_AUTHORITY_UNCHANGED = ZERO`).

### Masalah 56: Pengerasan Semantik Taksonomi, Taksonomi Exact Action Agreement & Audit Historis D1 (Phase JEV-7F.1 & JEV-7F.2)
* **Tujuan & Ruang Lingkup:** Memperjelas dan mengeraskan semantik klasifikasi ketidaksepakatan (*disagreement classification*) antara otoritas deterministik dan model Jev, memisahkan arah ketidaksepakatan dari perataan gerbang publikasi, menambahkan klasifikasi eksplisit `AGREE_REVISE`, serta mengaudit seluruh data historis D1 untuk membuktikan ketiadaan tabrakan data (*zero semantic collision*).
* **Pengerasan Matriks Ketidaksepakatan (Phase JEV-7F.1):**
  - Analisis menemukan bahwa kasus `authoritative = revise` vs `jev = stop` sebelumnya secara keliru dapat terklasifikasi sebagai `AGREE_STOP`.
  - Matriks direvisi secara ketat:
    - `authoritative = revise` vs `jev = stop` -> `JEV_MORE_CONSERVATIVE`
    - `authoritative = stop` vs `jev = revise` -> `JEV_MORE_PERMISSIVE`
  - Pemisahan Fungsi: Memperkenalkan `computePublicationGateAlignment(authoritative, jev)` untuk menilai keselarasan biner gerbang (`PASS` jika keduanya `continue`, `BLOCK` jika keduanya `revise/stop`, `DIVERGENT` jika berseberangan), sehingga `classifyDisagreement` murni merefleksikan arah rekomendasi analitis.
  - Stabilitas Hash Artikel 5: Terverifikasi tetap `h_89de9fcf` (`HASH_BEHAVIOR_CHANGED = NO`).
* **Pengerasan Taksonomi Exact Action Agreement & Audit Historis Produksi (Phase JEV-7F.2):**
  - Menghilangkan ambiguitas di mana `authoritative = revise` vs `jev = revise` sebelumnya tersimpan sebagai `AGREE_STOP`.
  - Menambahkan nilai klasifikasi resmi baru: `AGREE_REVISE` pada enum TypeScript `DecisionDisagreementClassification` dan validasi router.
  - **Audit Read-Only D1 Produksi `decision_observations`:**
    - Total observasi: 4 baris (v1: 1 `JEV_UNAVAILABLE`, 1 `AGREE_CONTINUE`, 1 `JEV_MORE_CONSERVATIVE`; v2: 1 `AGREE_CONTINUE`).
    - Baris dengan `disagreement_classification = 'AGREE_STOP'`: **0 baris**.
    - `LEGACY_REVISE_REVISE_STORED_AS_AGREE_STOP_COUNT = 0`.
    - Kesimpulan: `DISAGREEMENT_TAXONOMY_VERSIONING_REQUIRED = NO`. Penambahan `AGREE_REVISE` 100% aditif dan bebas dari tabrakan semantik historis.

### Masalah 57: Eliminasi Starvasi, Fairness Multi-Window & Keyset Cursor Berputar Bounded Skala Besar (Phase JEV-7F.3 & JEV-7F.4)
* **Tujuan & Ruang Lingkup:** Mengidentifikasi dan memperbaiki potensi starvasi subjek editorial pada selektor kolektor otonom, memisahkan batas pemindaian kandidat dari batas pemanggilan provider, dan menerapkan cursor keyset berputar yang durabel (*durable rotating keyset cursor with cyclic wraparound*) untuk menjamin keadilan (*fairness*) evaluasi pada kumpulan subjek berskala besar.
* **Audit Starvasi & Pemisahan Batas Pemindaian (Phase JEV-7F.3):**
  - **Cacat Arsitektural Sebelumnya:** `selectProspectiveArticles` menggunakan `maxSubjectsPerRun = 3` langsung sebagai `LIMIT ?` pada SQL.
  - Akibat: Pada kumpulan 5 draf (Artikel 1..5) dengan `ORDER BY id ASC`, setelah Artikel 1..3 diobservasi dan terdeduplikasi, setiap eksekusi cron berikutnya selalu mengambil Artikel 1..3 dan berhenti karena deduplikasi, menyebabkan Artikel 4 dan 5 mengalami **starvasi permanen** (`STARVATION_DETECTED = YES`).
  - **Solusi Arsitektur:** Memisahkan batas pemindaian kandidat (`maxCandidatesScannedPerRun = 25`) dari batas pemanggilan provider (`maxCallsPerRun = 3`). Loop kandidat terus berjalan melewati subjek yang terdeduplikasi (biaya 0 panggilan) hingga batas anggaran provider per eksekusi tercapai.
  - Simulasi membuktikan seluruh 5 subjek akhirnya diobservasi dalam 2 siklus, dan siklus ke-3 mencapai kondisi mapan (*steady state*) 100% dedupe-skip.
* **Penanganan Kumpulan Subjek Besar & Keyset Cursor Berputar Durabel (Phase JEV-7F.4):**
  - **Masalah Skalabilitas:** Jika jumlah draf melebihi `maxCandidatesScannedPerRun` (misal 30 draf dengan batas scan 25), pemindaian statis `ORDER BY id ASC LIMIT 25` akan membuat Artikel 26..30 mengalami starvasi permanen (`LARGE_POOL_STARVATION_DETECTED = YES`).
  - **Implementasi Keyset Cursor Berputar:**
    - Query kandidat diubah menjadi: `SELECT ... WHERE a.status = 'draft' AND a.id > ? ORDER BY a.id ASC LIMIT ?`.
    - **Cyclic Wraparound:** Jika `cursorArticleId > 0` dan jumlah draf yang tersisa setelah cursor lebih sedikit dari `scanLimit`, query secara otomatis melakukan wraparound ke `a.id > 0` untuk mengisi sisa kapasitas jendela pemindaian hingga batas `scanLimit`.
    - **Durabilitas Tanpa Migrasi Skema:** Cursor terakhir (`nextCursorArticleId`) diambil dan disimpan secara durabel melalui kolom `details_json` pada tabel `publication_cron_runs` (yang sudah ada sejak migrasi 0019/0022). Tidak memerlukan tabel atau migrasi database baru (`NEW_DB_MIGRATION_REQUIRED = NO`).
    - **Ketahanan Edge-Case:** Mampu menangani penghapusan artikel, jarak ID renggang (*sparse ID gaps*), dan penambahan artikel baru dengan ID lebih tinggi secara alami.
* **Hasil Pengujian & Verifikasi Skala:**
  - Suite pengujian `scripts/test-shadow-coverage-expansion.js` diperluas menjadi 18 tes komprehensif (18/18 PASS).
  - Skala 30 subjek: Terbukti seluruh 30 subjek berhasil diobservasi dalam beberapa siklus dan mencapai steady state (`ALL_30_EVENTUALLY_OBSERVED = YES`).
  - Skala 100 subjek: Terbukti jendela pemindaian berputar melintasi seluruh 100 subjek dalam 4 siklus dan melakukan wraparound bersih pada siklus ke-5 (`ALL_100_EVENTUALLY_SCANNED = YES`, `SCAN_WRAPAROUND_WORKS = YES`).
  - Seluruh pengujian regresi (soak-safety, planner, publisher, continuous-shadow, decision-engine, media-planning, router, telemetry, lokamedia-integration) lulus 100%. Kompilasi `tsc --noEmit` dan `npm run build` sukses.
* **Status Fase:** `JEV_PHASE_7F_4 = PASS`. Sistem siap untuk peluncuran canary produksi Phase JEV-7G setelah persetujuan operator.

### Masalah 58: Peluncuran Canary Produksi JEV Phase 7G — Ekspansi Cakupan Shadow, Taksonomi Exact-Action & Keyset Cursor Berputar (Phase JEV-7G)
* **Tujuan & Ruang Lingkup:** Meluncurkan implementasi JEV-7F (ekspansi cakupan shadow draf tanpa media, klasifikasi ketidaksepakatan exact-action `AGREE_REVISE`, perataan gerbang publikasi biner, batas pemindaian decoupled, dan keyset cursor durabel berputar) ke lingkungan Cloudflare Workers produksi, memverifikasi akuisisi observasi multi-siklus pada native Cloudflare Cron (`17 * * * *`), membuktikan pembentukan dataset 5-state kanonikal lengkap, serta memverifikasi status mapan deduplikasi penuh (*steady-state dedupe-only*) dengan zero otoritas publikasi.
* **Deployment Canary Produksi:**
  - **Commit Implementasi:** `367cde24b8cb9c7e68a3881900ee9971b9cfb694`
  - **Previous Deployment ID:** `a66a0424-9e39-451f-b068-13c1b90832b9`
  - **Canary Deployment ID:** `f6aaa7a9-639f-42ea-9c27-4435f0fec9de` (01:19 UTC)
  - **Migrasi Database:** Tidak diperlukan (`JEV_7G_REQUIRES_DB_MIGRATION = NO`).
  - **Kesehatan Publik & Keselamatan Kontrol:** Beranda (200), Artikel 6 (200), Sitemap (200), Admin (302) terverifikasi sehat. Kontrol otomasi tetap non-aktif: `mode = OFF`, `auto_schedule = false`, `kill_switch = 0`.
* **Siklus 1 Native Cloudflare Cron (02:17 UTC / Run ID 4255):**
  - **Trigger Source:** `cloudflare_cron` (durasi 5,65s).
  - **Subjek Dipindai:** `[1, 2, 3, 4, 5]`.
  - **Panggilan Provider:** 3 panggilan (Artikel 1, 2, 3).
  - **Dedupe Skipped:** 1 (Artikel 5, `h_89de9fcf`).
  - **Budget Skipped:** 1 (Artikel 4, batas per-run 3 panggilan ditaati ketat).
  - **Observasi Dibuat:**
    - `obs_muewjpdv_1swhuj` (Artikel 1): `auth=revise` vs `jev=stop` -> `JEV_MORE_CONSERVATIVE`, `gate=BOTH_HALT`.
    - `obs_muewjqcs_juo14h` (Artikel 2): `auth=revise` vs `jev=stop` -> `JEV_MORE_CONSERVATIVE`, `gate=BOTH_HALT`.
    - `obs_muewjr72_h355tc` (Artikel 3): `auth=revise` vs `jev=stop` -> `JEV_MORE_CONSERVATIVE`, `gate=BOTH_HALT`.
  - **Durabilitas Cursor:** Tersimpan di `publication_cron_runs.details_json` dengan `"nextCursorArticleId": 5`.
* **Siklus 2 Native Cloudflare Cron (03:17 UTC / Run ID 4328):**
  - **Trigger Source:** `cloudflare_cron` (durasi 3,82s).
  - **Keyset Cursor:** Memuat cursor 5, cyclic wraparound aktif memindai `[1, 2, 3, 4, 5]`.
  - **Dedupe Skipped:** 4 (Artikel 1, 2, 3, dan 5 dedupe-skip secara otonom).
  - **Panggilan Provider:** 1 panggilan (Artikel 4).
  - **Observasi Dibuat:**
    - `obs_mueyovol_js1pt3` (Artikel 4): `auth=revise` vs `jev=stop` -> `JEV_MORE_CONSERVATIVE`, `gate=BOTH_HALT`.
  - **Hasil Evaluasi:** `ALL_ARTICLES_1_TO_4_SUCCESSFULLY_OBSERVED = YES`.
* **Siklus 3 Native Cloudflare Cron Steady State (04:17 UTC / Run ID 4403):**
  - **Trigger Source:** `cloudflare_cron` (durasi 3,04s).
  - **Panggilan Provider:** 0 panggilan.
  - **Observasi Baru:** 0.
  - **Dedupe Skipped:** 5 subjek (100% dedupe).
  - **Hasil Kondisi Mapan:** `STEADY_STATE_DEDUPE_ONLY = YES`.
* **Pembuktian Dataset 5-State Kanonikal & Evaluasi Deskriptif:**
  - 5 subjek draf editorial (Artikel 1..5) terwakili dengan 5 hash unik independen: `h_1a9ca364`, `h_707bc71`, `h_d1426e50`, `h_7c3cc747`, `h_89de9fcf`.
  - Distribusi Otoritatif: `revise = 4`, `continue = 1`.
  - Distribusi Jev: `stop = 4`, `continue = 1`.
  - Taksonomi Ketidaksepakatan: `AGREE_CONTINUE = 1` (Artikel 5), `JEV_MORE_CONSERVATIVE = 4` (Artikel 1..4).
  - Perataan Gerbang: `BOTH_CONTINUE = 1` (Artikel 5), `BOTH_HALT = 4` (Artikel 1..4).
* **Firewall Keselamatan Publikasi & Zero Authority:**
  - Mode akhir: `mode = OFF`, `auto_schedule = false`, `kill_switch = 0`.
  - Mutasi artikel = 0, mutasi media = 0, rencana publikasi baru = 0, eksekusi baru = 0, penerbitan = 0.
  - `JEV_AUTHORITY_UNCHANGED = ZERO`.
* **Kesiapan Kalibrasi:** `DESCRIPTIVE_DATA_READY = YES`, `PRELIMINARY_AGREEMENT_READY = NO`, `CONFIDENCE_CALIBRATION_READY = NO` (Otoritas Jev tetap nol mutlak).
* **Status Fase:** `JEV_PHASE_7G = PASS`.

### Masalah 59: Fondasi Editorial Trajectory Evidence Ledger & Schema Immutability (Phase JEV-7L)
* **Tujuan & Ruang Lingkup:** Membangun fondasi bukti trajektori editorial (*editorial trajectory evidence ledger*) untuk melacak evolusi status artikel, transisi mutasi, dan pencatatan hasil keputusan (*decision outcomes*) secara persisten, append-only, dan deduped pada SQLite/Cloudflare D1 lokal, sebagai prasyarat evaluasi retrospektif model TypeSafe Jev.
* **Skema D1 & Migrasi `0023_editorial_trajectory_ledger.sql`:**
  - `article_state_snapshots`: Snapshot status kanonikal artikel yang tidak dapat diubah (*immutable*), di-deduplikasi berdasarkan kombinasi unik `(article_id, input_hash, input_schema_version)`.
  - `article_state_transitions`: Log append-only untuk setiap mutasi status artikel (`transition_id`, `from_snapshot_id`, `to_snapshot_id`, `from_input_hash`, `to_input_hash`, `transition_type`, `mutation_operation_id`, dll.) dengan index pencarian cepat.
  - `decision_outcomes`: Log append-only hasil keputusan hilir independen (`outcome_id`, `article_id`, `snapshot_id`, `input_hash`, `outcome_type`, `outcome_class`, `idempotency_key`, dll.) yang terikat pada bukti kanonikal.
* **Layanan `trajectory-ledger.ts`:**
  - Taksonomi transisi terstandardisasi: `CONTENT_CHANGED`, `MEDIA_ADDED`, `MEDIA_REPLACED`, `MEDIA_REMOVED`, `MANUAL_HOLD_CHANGED`, `READINESS_CHANGED`, `MULTI_FACTOR_CHANGE`, `UNKNOWN_CHANGE`.
  - Pembatasan NOOP: Jika status kanonikal sebelum dan sesudah mutasi identik, transisi tidak dibuat (`NOOP_READINESS_REEVALUATION_CREATES_TRANSITION = NO`).
  - Aturan Inisial: Artikel baru hanya menghasilkan snapshot inisial tanpa pendahulu transisi fiktif (`INITIAL_STATE_CREATES_TRANSITION = NO`).
  - Firewall Kegagalan: Memisahkan kegagalan keputusan (`EDITORIAL_FAILURE`, `POLICY_FAILURE`) dari kegagalan infrastruktur/jaringan (`INFRASTRUCTURE_FAILURE`, `PROVIDER_FAILURE`, `UNKNOWN_FAILURE`) agar tidak mencemari bukti evaluasi model.
  - Diff Metrics Ringan: Menghitung metrik perubahan teks (`bytes_delta`, `words_delta`, `headings_delta`, `references_delta`) tanpa menyimpan naskah lengkap.
* **Hasil Pengujian Unit:** 47/47 tes lulus pada `scripts/test-editorial-trajectory-ledger.js`.
* **Status Fase:** `JEV_PHASE_7L = PASS`.

### Masalah 60: Integrasi Nyata Callsite Trajectory Ledger & Pengujian End-to-End Komprehensif (Phase JEV-7L.1)
* **Tujuan & Ruang Lingkup:** Mengintegrasikan pemanggilan runtime trajectory ledger ke seluruh titik mutasi produksi riil pada kode sumber lokal, dan membuktikan siklus hidup trajektori secara end-to-end tanpa mock dangkal.
* **Audit Callsite & Hasil Integrasi:**
  - Audit menemukan bahwa commit awal `51130e9d` hanya memuat skema dan unit test, tanpa callsite terpasang pada service riil (`WERE_CAPTURE_POINTS_ACTUALLY_INTEGRATED_IN_COMMIT_51130e9d = NO`).
  - Integrasi penuh dilakukan pada 8 jalur mutasi riil:
    1. *Article content edit:* `updateArticle` di `src/lib/db.ts` merekam snapshot & transisi `CONTENT_CHANGED`.
    2. *Hermes ingest:* `insertHermesArticleAndReceipt` di `src/lib/db.ts` merekam snapshot inisial artikel baru.
    3. *Featured media binding:* `bindMediaToArticle` & `unbindFeaturedMedia` di `src/lib/media/service.ts` merekam `MEDIA_ADDED`, `MEDIA_REPLACED`, `MEDIA_REMOVED`.
    4. *Manual hold mutation:* `holdArticle` & `resumeArticleAutomation` di `src/lib/publication/operator-controls.ts` merekam `MANUAL_HOLD_CHANGED`.
    5. *Readiness evaluation:* `evaluateArticleReadiness` di `src/lib/publication/service.ts` mematuhi aturan NOOP (0 transisi redundant).
    6. *Human editorial outcome:* `recordEditorialApproval` & `revokeEditorialApproval` merekam outcome `human_approved` dan `human_approval_revoked`.
    7. *Publication outcome & receipt:* `executeAtomicPublication` & `cancelExecution` di `src/lib/publication/publisher-service.ts` merekam `publication_succeeded` dan `publication_cancelled` dengan pelindung firewall kegagalan.
* **Hasil Pengujian End-to-End:** 29/29 tes lulus pada `scripts/test-editorial-trajectory-e2e.js`.
* **Status Fase:** `JEV_PHASE_7L_1 = PASS`.

### Masalah 61: Pengerasan Atomisitas Ingest Hermes & Optimistic Concurrency Control (Phase JEV-7L.2)
* **Tujuan & Ruang Lingkup:** Menjamin atomisitas sejati pembentukan draf artikel Hermes baru dan snapshot kanonikal inisial dalam batch D1 tunggal, mencegah event phantom pada konflik konkurensi optimistik (*stale-read races*), serta membuktikan ketahanan rollback kegagalan secara lokal.
* **Penyelesaian Celah Atomisitas Hermes:**
  - Sebelum perbaikan: Artikel dan receipt dimasukkan via `db.batch`, lalu snapshot dieksekusi terpisah di luar batch.
  - Solusi: Alokasi ID artikel secara deterministik di awal (`SELECT MAX(...) + 1`), lalu menggabungkan `insertArticleStmt`, `insertReceiptStmt`, dan `snapStmt` ke dalam **satu batch D1 atomik tunggal** (`NEW_ARTICLE_INITIAL_SNAPSHOT_ATOMIC = YES`).
* **Strategi OCC dengan Zero-Row Detection (`CONDITIONAL_WHERE_EXISTS_WITH_ZERO_ROW_DETECTION`):**
  - Pada SQLite/D1, `UPDATE` yang tidak mengubah baris karena predikat OCC yang basi tidak melempar error SQL sehingga query lain dalam batch berisiko tetap commit.
  - Implementasi: Seluruh builder statement ledger (`prepareCaptureSnapshotStatement`, `prepareRecordTransitionStatement`, `prepareRecordOutcomeStatement`) diperbarui untuk mendukung `OCCGuardCondition` (`INSERT ... SELECT ... WHERE EXISTS (...)`).
  - Jika mutasi bisnis memodifikasi 0 baris, klausa `WHERE EXISTS` otomatis bernilai `FALSE`, memastikan 0 baris masuk ke tabel ledger (`STALE_MUTATION_CAN_CREATE_PHANTOM_LEDGER_EVENT = NO`, `EXACT_STATE_OUTCOME_STALE_BINDING_POSSIBLE = NO`).
  - Service memeriksa `changes === 0` dan segera melempar `OPTIMISTIC_CONCURRENCY_CONFLICT`.
  - Pada `bindMediaToArticle`, urutan eksekusi dibalik sehingga conditional INSERT berjalan mendahului deactivation update untuk membaca status aktif yang konsisten.
* **Hasil Pengujian & Regresi Lengkap:**
  - Suite E2E diperluas menjadi 38 tes komprehensif (`scripts/test-editorial-trajectory-e2e.js`: 38/38 PASS).
  - Seluruh rangkaian regresi lulus 100%: 47 unit ledger tests, 67 planner tests, 48 publisher tests, 16 operator control tests, 23 dual authorization tests, 16 media planning tests, 8 telemetry tests, 23 decision engine tests, 14 router tests, 5 lokamedia integration tests, 54 soak safety tests, TypeScript typecheck clean, dan build Astro sukses.
* **Status Fase:** `JEV_PHASE_7L_2 = PASS`. Sistem lokal 100% siap untuk peluncuran canary produksi JEV-7M.

### Masalah 62: Peluncuran Canary Produksi JEV Phase 7M — Editorial Trajectory Ledger, Migrasi 0023 & Bounded Canary Hold/Resume (Phase JEV-7M)
* **Tujuan & Ruang Lingkup:** Menerapkan migrasi D1 aditif `0023_editorial_trajectory_ledger.sql` ke produksi Cloudflare, men-deploy implementasi Worker sadar-ledger yang teruji, mengeksekusi tepat SATU mutasi kanari terbalikkan terkendali (*bounded reversible canary*): `Article 1 manual_hold 0 -> 1 -> 0` melalui jalur API/service operator kanonikal, membuktikan perekaman snapshot dan transisi atomik secara append-only, deduplikasi snapshot kanonikal saat kembali ke kondisi awal, ketiadaan outcome palsu, serta mempertahankan integritas keselamatan publikasi dan otoritas nol Jev.
* **Aktivasi Migrasi D1 Produksi & Deployment Worker:**
  - **Migrasi D1:** `0023_editorial_trajectory_ledger.sql` berhasil diterapkan ke database `rancangloka_db` (`MIGRATION_0023_PRODUCTION = PASS`). Tabel baru terverifikasi: `article_state_snapshots`, `article_state_transitions`, `decision_outcomes`.
  - **Baseline Pra-Canary:** `PRE_CANARY_SNAPSHOT_COUNT = 0`, `PRE_CANARY_TRANSITION_COUNT = 0`, `PRE_CANARY_OUTCOME_COUNT = 0` (`HISTORICAL_TRANSITIONS_SYNTHESIZED = NO`).
  - **Deployment ID Sebelumnya:** `f6aaa7a9-639f-42ea-9c27-4435f0fec9de`.
  - **Deployment ID Canary JEV-7M:** `cafaa01f-9355-409b-97ca-e8bd58cb0166`.
  - **Kesehatan Publik & Kontrol Pasca-Deploy:** Beranda (200), Artikel 6 (200), Sitemap XML (200), Admin (302 redirect). Kontrol publikasi: `mode = OFF`, `auto_schedule = false`, `kill_switch = 0`.
* **Eksekusi Kanari Mutasi A (Hold Artikel 1: 0 -> 1):**
  - **Jalur Operator Kanonikal:** `POST /api/admin/publication/operator-control` via browser admin yang terotentikasi sah dengan payload `{ action: 'hold', article_id: 1, reason: 'JEV-7M Production Canary Hold', actor: 'admin_operator' }`.
  - **Hasil Aksi:** `HOLD_ACTION_SUCCESS = YES`, `manual_hold = 1`, status tetap `draft`, `content_hash` tetap utuh (`0b88aa50b672...`).
  - **Bukti Ledger:**
    - Transisi tercipta: ID `ast_1_1790235931854_haxp2`.
    - `transition_type = 'MANUAL_HOLD_CHANGED'`.
    - `from_input_hash = 'h_1ec85cbf'`, `to_input_hash = 'h_1e0929a1'`.
    - `mutation_operation_id = 'mop_manual_hold_engaged_a1_1ec85cbf_to_1e0929a1'`.
    - Audit operator tercipta: ID 9 `MANUAL_HOLD_SET`.
    - Outcome keputusan tercipta: 0 (`HOLD_CREATED_OUTCOME_ROWS = 0`).
* **Eksekusi Kanari Mutasi B (Resume Artikel 1: 1 -> 0):**
  - **Jalur Operator Kanonikal:** `POST /api/admin/publication/operator-control` dengan payload `{ action: 'resume', article_id: 1, actor: 'admin_operator' }`.
  - **Hasil Aksi:** `RESUME_ACTION_SUCCESS = YES`, `manual_hold = 0`, status tetap `draft`, `content_hash` tetap utuh.
  - **Bukti Ledger:**
    - Transisi tercipta: ID `ast_1_1790236157117_5sj5p`.
    - `transition_type = 'MANUAL_HOLD_CHANGED'`.
    - `from_input_hash = 'h_1e0929a1'`, `to_input_hash = 'h_1ec85cbf'`.
    - `mutation_operation_id = 'mop_manual_hold_cleared_a1_1e0929a1_to_1ec85cbf'`.
    - Audit operator tercipta: ID 10 `MANUAL_HOLD_CLEARED`.
* **Pembuktian Deduplikasi Snapshot & Sifat Append-Only:**
  - **Topologi Snapshot:** A (`snp_h_1ec85cbf_1`, `manual_hold = 0`) -> B (`snp_h_1e0929a1_1`, `manual_hold = 1`) -> A (`snp_h_1ec85cbf_1`, `manual_hold = 0`).
  - Saat Artikel 1 kembali ke kondisi awal, snapshot A di-*reuse* dan di-deduplikasi (`RETURN_TO_ORIGINAL_SNAPSHOT_DEDUPE = PASS`).
  - Total snapshot kanari unik di tabel: tepat 2 (`ARTICLE_1_UNIQUE_CANARY_SNAPSHOT_COUNT = 2`).
  - Total transisi kanari tersimpan di tabel: tepat 2 (`ARTICLE_1_CANARY_TRANSITION_COUNT = 2`). Keduanya tersimpan permanen tanpa UPDATE/DELETE (`PRODUCTION_APPEND_ONLY_PROOF = PASS`).
  - Pemulihan status bisnis: `ARTICLE_1_BUSINESS_STATE_RESTORED = YES` (`ARTICLE_1_FINAL_INPUT_HASH == ARTICLE_1_PRE_INPUT_HASH == 'h_1ec85cbf'`).
* **Firewall Hasil Keputusan, Keselamatan Publikasi & Otoritas Nol Jev:**
  - Outcome baru: 0 (`NEW_CANARY_DECISION_OUTCOMES = 0`, `OUTCOME_FIREWALL_PRODUCTION = PASS`).
  - Rencana publikasi baru: 0, eksekusi baru: 0, receipt baru: 0, publikasi baru: 0.
  - Artikel 5 tetap `draft`, Artikel 6 tetap terbit.
  - Jev tidak menulis snapshot, transisi, maupun outcome (`JEV_CAN_WRITE_SNAPSHOTS = NO`, `JEV_CAN_WRITE_TRANSITIONS = NO`, `JEV_CAN_WRITE_OUTCOMES = NO`, `JEV_AUTHORITY_UNCHANGED = ZERO`).
  - Kontrol akhir: `FINAL_MODE = OFF`, `FINAL_AUTO_SCHEDULE = false`, `FINAL_KILL_SWITCH = 0`.
  - Kesehatan publik akhir: Beranda (200), Artikel 6 (200), Sitemap (200), Admin (302).
  - Regresi lokal pasca-canary: 100% PASS (`POST_7M_REGRESSION = PASS`).
* **Status Fase:** `JEV_PHASE_7M = PASS`. Editorial Trajectory Ledger resmi aktif di lingkungan produksi.

### Jev Phase 7M.2 Canonical Publication State Parity Fix Production Deployment 2026-09-24

- **Tujuan & Ruang Lingkup:** Menyelesaikan disparitas sumber data kanonikal (*canonical data source drift*) yang ditemukan pasca-canary JEV-7M, di mana jalur TypeSafe Jev shadow collector dan publication planner mengonsumsi aset gambar utama secara ketat dari `article_media(role='featured', is_active=1)`, sedangkan jalur operator controls dan mutasi artikel membaca kolom cermin `articles.featured_image`. Hal ini menyebabkan Artikel 1 menghasilkan `input_hash = 'h_1ec85cbf'` pada pra-kanari 7M (karena membaca cermin legacy non-null), berbeda dari observasi kanonikal historis JEV-7G (`h_1a9ca364`).
- **Analisis Akar Masalah (Root Cause: SOURCE_OF_TRUTH_DRIFT):**
  - Kolom `articles.featured_image` merupakan cermin presentasi warisan (*presentation fallback*) untuk backward compatibility CMS dan SEO Open Graph tags, bukan otoritas kanonikal siklus hidup publikasi.
  - Sumber kebenaran tunggal (*sole source of truth*) yang otoritatif adalah `article_media` aktif (`role='featured' AND is_active=1`).
  - Tidak ada perubahan status bisnis riil pada Artikel 1 (`ARTICLE_1_GENUINE_STATE_CHANGE_BETWEEN_7G_AND_7M = NO`).
- **Perbaikan Kode Lokal & Arsitektur Terpadu (Commit `f03744744fa23b1f9febe8a9ae5b63749cbcb17f`):**
  - Mengimplementasikan loader terpadu `loadCanonicalPublicationPreflightInput(db, articleId, overrides)` di `src/lib/decision/publication-preflight-state.ts` yang memuat artikel, meresolusi featured media secara eksklusif dari relasi aktif `article_media`, dan mengabaikan nilai `articles.featured_image`.
  - Menghubungkan loader kanonikal ke `src/lib/publication/operator-controls.ts` (`holdArticle`, `resumeArticleAutomation`) dan `src/lib/db.ts` (`updateArticle`, `insertArticle`, `insertHermesArticleAndReceipt`).
  - Menambahkan test suite paritas: `scripts/test-canonical-state-parity.js` (8/8 PASS).
  - Skema kanonikal tidak berubah (`SCHEMA_VERSION_BUMP_REQUIRED = NO`, tetap `2026-09-23.v2`).
- **Klasifikasi Rekaman Kanari Historis JEV-7M:**
  - Baris kanari 7M yang ada (`ast_1_1790235931854_haxp2` dan `ast_1_1790236157117_5sj5p`) diklasifikasikan sebagai `VALID_CANARY_BUT_SEMANTICALLY_INCOMPATIBLE`.
  - Sesuai prinsip *append-only*, baris historis ini dipertahankan utuh dan **TIDAK DIHAPUS / TIDAK DITULIS ULANG**.
- **Deployment Produksi & Verifikasi Pasca-Deploy:**
  - **Persetujuan Operator:** Diotorisasi penuh oleh operator untuk rilis Worker tanpa mutasi artikel/media.
  - **Deployment ID Sebelumnya:** `cafaa01f-9355-409b-97ca-e8bd58cb0166`.
  - **Deployment ID Paritas 7M.2:** `46da7f3f-b4d4-43b2-863e-3a25b51ac824`.
  - **Bukti Paritas Kanonikal Produksi (Read-Only):**
    - `PRODUCTION_CANONICAL_FEATURED_ASSET = null`
    - `PRODUCTION_HERO_IMAGE_PRESENT = false`
    - `PRODUCTION_PLANNER_ELIGIBILITY = NOT_ELIGIBLE`
    - `PRODUCTION_ARTICLE_1_CANONICAL_HASH = h_1a9ca364` (`PRODUCTION_HASH_MATCHES_HISTORICAL_JEV = YES`).
    - `LEGACY_FEATURED_IMAGE_CAN_AFFECT_CANONICAL_STATE = NO`.
    - `PLANNER_COLLECTOR_LEDGER_PARITY = PASS`.
    - `FUTURE_DECISION_TO_SNAPSHOT_JOIN_RELIABLE = YES`.
- **Firewall Keamanan, Zero Mutation & Zero Authority:**
  - Mutasi artikel bisnis: 0 (`PRODUCTION_ARTICLE_MUTATIONS = 0`).
  - Mutasi media: 0 (`PRODUCTION_MEDIA_MUTATIONS = 0`).
  - Rencana publikasi baru: 0, eksekusi baru: 0, receipt baru: 0, publikasi baru: 0.
  - Jev authority: `ZERO` (`JEV_CAN_WRITE_SNAPSHOTS = NO`, `JEV_CAN_WRITE_TRANSITIONS = NO`, `JEV_CAN_WRITE_OUTCOMES = NO`).
  - Kontrol produksi: `FINAL_MODE = OFF`, `FINAL_AUTO_SCHEDULE = false`, `FINAL_KILL_SWITCH = 0`.
  - Kesehatan publik: Beranda (200), Artikel 6 (200), Sitemap XML (200), Admin Gateway (302).
  - Regresi lengkap: 16 test suite PASS, TypeScript clean, Astro build clean.
- **Status Fase:** `JEV_PHASE_7M_2 = PASS`. Paritas pemuatan status kanonikal aktif di produksi. Platform siap untuk *Natural Trajectory Collection*.

---

## 📍 3. Status Terkini (Current Milestone Progress)

| Komponen | Status | Catatan |
|---|---|---|
| **Aplikasi Web & UI** | ✅ Selesai (Live) | Layout Apple-aesthetic, responsive, Outfit + Plus Jakarta Sans + JetBrains Mono. |
| **Kompilasi & Deployment** | ✅ Selesai (Live) | Berjalan di Cloudflare Workers Edge (*Version ID: `46da7f3f-b4d4-43b2-863e-3a25b51ac824`*). |
| **D1 Database & Skema** | ✅ Selesai (Aktif) | 19+ tabel (termasuk migrasi `0021_decision_observations`, `0022_allow_jev_shadow_collector_cron`, & `0023_editorial_trajectory_ledger`). |
| **R2 Storage & Media Library** | ✅ Selesai (Aktif) | Bucket `rancangloka-media` + asset registration & pipeline derivative storage. |
| **Decision Engine (TypeSafe Jev)** | ✅ Selesai (5-State Dataset Active & Dedupe Steady) | Dataset 5-state kanonikal v2 lengkap di edge cron `17 * * * *`, deduplikasi mapan terbukti (Zero Authority, mode OFF). |
| **Decision Telemetry** | ✅ Selesai (Aktif) | Tabel D1 `decision_observations` & `publication_cron_runs` mencatat telemetri durable edge. |
| **Editorial Trajectory Ledger** | ✅ Selesai (Aktif di Produksi) | Skema D1 migrasi 0023 aktif di edge, deployment `46da7f3f-b4d4-43b2-863e-3a25b51ac824`, paritas sumber data kanonikal terpadu (JEV-7M.2), append-only terbukti, zero authority. |
| **Publication & Safety Engine** | ✅ Selesai (Aktif) | Capability matrix (`OFF`, `OBSERVE_ONLY`, `PLAN_ONLY`, `CONTROLLED`, `UNATTENDED`), Circuit breaker, Run ledger. Status produksi: resting `OFF`. |
| **Pilar Konten & Editorial Scope** | ✅ Selesai (Aktif) | 13 pilar materi arsitektur, interior, konstruksi & biaya terdokumentasi di Blueprint Master. |
| **Design Problem Solver & Explorer** | ✅ Selesai (Aktif) | Alat diagnosis berbasis kemungkinan penyebab umum & 3-way multi-filter aktif. |
| **Material Comparison Matrix** | ✅ Selesai (Aktif) | Matriks komparasi + box *How We Score* (25%/20%/20%/15%/20%) + Evidence Badges. |
| **Editorial Standards & Metodologi** | ✅ Selesai (Aktif) | Piagam redaksi independen (`/editorial-standards`) & standar pengujian (`/metodologi`). |
| **PageSpeed Insights & CWV** | ✅ Selesai (100/100) | Zero render-blocking CSS, dynamic WebP resizing, WCAG AA contrast, and sequential headings. |
| **CMS Admin Dashboard** | ✅ Selesai (Live) | Layout Stitch Apple Developer Tier, dual-sidebar, bento KPI cards, dan kanonik operator controls (`/admin/automation`). |
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

