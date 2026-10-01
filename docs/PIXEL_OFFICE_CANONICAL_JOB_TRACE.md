# 📜 PIXEL OFFICE & MISSION CONTROL V2.5 — CANONICAL JOB TRACE & ACTIVITY TIMELINE

> **Spesifikasi & Panduan Arsitektur: Canonical Job Trace & Activity Timeline**  
> **Status:** APPROVED FOR DEVELOPMENT (LOCAL ONLY)  
> **Versi:** V2.5  
> **Tanggal:** 1 Oktober 2026  
> **Prinsip Utama:** *NO CANONICAL EVENT EVIDENCE = NO TIMELINE EVENT.*

---

## 1. Identitas Workflow & Job Trace (Job Identity)

Sebuah Job Trace memiliki identitas stabil tunggal yang terikat pada hierarki entitas kanonikal RancangLoka:
- **`task_id`**: Identifier pipeline/tugas Hermes (misalnya `task-article-24`).
- **`workflow_id`**: Identifier workflow kanonikal (misalnya `wf-article-24`).
- **`artifact_id`**: Identifier artikel numerik atau slug artikel (misalnya `article-24` atau `cara-menambal-dinding-retak`).
- **`media_job_id`**: Identifier tugas media kanonikal (misalnya `job-media-24`).

### Aturan Isolasi Identitas
- **Isolasi Mutlak:** Operator tidak akan pernah mencampur riwayat Artikel A dengan Artikel B. Jika `task_id` atau `workflow_id` berbeda, trace yang diturunkan 100% terpisah.
- **Resolusi Lintas-Tabel:** Fungsi `parseTaskIdentifiers()` secara cerdas memetakan nomor ID artikel, slug, atau ID media job dari string `task_id` untuk memastikan kueri riwayat D1 tepat sasaran tanpa cross-contamination.

---

## 2. Sumber Bukti Kanonikal (Canonical Event Sources)

Job Trace **BUKAN** log event sintetis buatan yang diinjeksi saat render, melainkan model baca (*read-only derived model*) yang diturunkan secara deterministik dari tabel-tabel ledger dan state kanonikal di Cloudflare D1 serta snapshot Mission Control:

| Sumber Kanonikal D1 / State | Field Waktu / Bukti | Tipe Event yang Dihasilkan |
| :--- | :--- | :--- |
| `d1_articles` | `created_at` | `TASK_CREATED` (Research/Drafting) |
| `d1_articles` | `published_at` (jika `status = 'published'`) | `PUBLISHED` |
| `d1_article_editorial_approvals` | `created_at`, `approval_status = 'APPROVED'` | `APPROVED` (Editorial QA) |
| `d1_article_editorial_approvals` | `created_at`, `approval_status = 'REJECTED'` | `REJECTED` (Explicit Rollback / Revision) |
| `d1_media_jobs` | `created_at`, `status` | `STAGE_ENTERED` (`waiting_media` / `running`) |
| `d1_media_jobs` | `updated_at` (jika `status = 'completed'`) | `STAGE_COMPLETED` (`media`) |
| `d1_media_job_events` | `created_at`, `event_type` | `STAGE_ENTERED` / `STAGE_COMPLETED` |
| `d1_article_publication_plans` | `created_at`, `state` | `QUEUED` (`publication_queue`) |
| `d1_article_publication_executions` | `dispatched_at` / `created_at` | `PUBLICATION_DISPATCH` |
| `d1_mission_control_anomalies` | `detected_at`, `task_id`, `entity_id` | `ANOMALY` |
| **V2.4 Handoff Engine** | `handoff_id`, `timestamp`, `from/to` | `HANDOFF` |

Repository evidence selalu menang. Tidak ada parallel event store baru yang ditambahkan karena ledger kanonikal D1 sudah menyediakan seluruh jejak yang dibutuhkan.

---

## 3. Kualifikasi Event (Event Qualification) & Anti-Slop / Anti-Hallucination

- **No Canonical Event Evidence = No Timeline Event:** Dilarang merekonstruksi masa lalu hanya karena kita tahu stage saat ini.
- **Dilarang Mengisi Stage Kosong:** Jika sebuah artikel dibuat lalu langsung melompat ke Publication Queue tanpa catatan log review QA, sistem **TIDAK BOLEH** menyelipkan event "QA Review Completed" palsu.
- **Deteksi Kesenjangan Bukti (`EVIDENCE_GAP`):** Jika terjadi lompatan tahapan kanonikal (misal: *Writing* $\to$ *Publication Queue* tanpa bukti *QA*), sistem menyisipkan penanda eksplisit `EVIDENCE_GAP` dengan label *"[No canonical transition evidence available]"*.
- **Gerakan Fisik BUKAN Event Bisnis:** Navigasi staf melalui koridor/hallway Central Hall (Level 1, Level 2, stairs) adalah lapisan presentasi murni (`presentational`). Koridor **TIDAK AKAN PERNAH** dicatat sebagai event timeline bisnis.
- **Animasi Sprite MC-9 BUKAN Event:** Animasi mengetik, sprite melompat, atau lampu monitor menyala tidak memiliki relasi dengan timeline kanonikal.

---

## 4. Identitas Event & Aturan Waktu (Deterministic Event Identity & Timestamps)

### Identitas Event
Setiap event memiliki ID deterministik unik tanpa komponen random UUID:
$$\text{event\_id} = \text{hash}(\text{taskId} + \text{eventType} + \text{canonicalTimestamp} + \text{evidenceSource} + \text{evidenceId})$$
Contoh: `trace-evt-task-24-HANDOFF-1727813880000-handoff-task-24-writing-editorial_qa-joko-rina`

### Sumber Timestamp
Hanya timestamp dari rekaman kanonikal yang diakui:
- `articles.created_at`, `articles.updated_at`, `articles.published_at`
- `media_jobs.created_at`, `media_jobs.updated_at`
- `article_editorial_approvals.created_at`
- `mission_control_anomalies.detected_at`
- `handoff.timestamp`

**Terlarang:** `Date.now()`, waktu polling browser, waktu DOM render, atau waktu kedatangan respons HTTP. Jika tidak ada bukti timestamp otoritatif, event diabaikan.

---

## 5. Pengurutan Kanonikal (Canonical Chronological Ordering)

1. Semua event diurutkan secara strictly ascending berdasarkan `canonical_timestamp` (milidetik).
2. Jika dua event memiliki timestamp yang persis sama, pengurutan sekunder menggunakan tie-breaker deterministik kanonikal (`canonical_order`: `TASK_CREATED` (1) $\to$ `STAGE_ENTERED` (2) $\to$ `ANOMALY` (3) $\to$ `REJECTED` (4) $\to$ `APPROVED` (5) $\to$ `STAGE_COMPLETED` (6) $\to$ `HANDOFF` (7) $\to$ `QUEUED` (8) $\to$ `PUBLICATION_DISPATCH` (9) $\to$ `PUBLISHED` (10)).
3. Pengurutan tidak pernah diacak atau diubah oleh data polling yang terlambat tiba (*stale records cannot reorder current truth*).

---

## 6. Kalkulasi Durasi Tahapan (Stage Duration Semantics)

- **Boundaries Proven Rule:** Durasi tahapan (`duration_ms`) **HANYA** dihitung jika batas awal (`start_timestamp`) dan batas akhir (`end_timestamp`) keduanya terbukti secara kanonikal.
  $$\text{duration\_ms} = \text{end\_timestamp} - \text{start\_timestamp}$$
- **Tahap Berjalan / Current Stage:** Durasi yang sedang berjalan tidak pernah ditulis/di-persist sebagai nilai statis. UI hanya menampilkan `"sejak [canonical_timestamp]"` dan menghitung waktu berjalan secara derivatif di sisi klien.

---

## 7. Status Saat Ini (Current State Header)

Header Job Trace menjawab status aktual saat ini secara instan dan harus cocok 100% dengan kondisi dunia visual Pixel Office:
- **Current Stage:** Nama tahapan yang sedang aktif.
- **Current Staff:** Staf yang saat ini bertanggung jawab (foto & nama).
- **Current Department:** Departemen yang menangani.
- **Operational State:** `RUNNING`, `QUEUED`, `BLOCKED`, `STANDBY`, atau `PUBLISHED`.
- **Location:** Lokasi fisik saat ini di Central Hall / Ruang Kerja.
- **Started At & Elapsed:** Waktu mulai tahap saat ini dan waktu yang telah berjalan.
- **Blocking Condition:** Alasan kendala jika berada dalam kondisi `BLOCKED`.
- **Latest Evidence:** Bukti kanonikal terakhir yang memvalidasi posisi ini.

---

## 8. Integrasi Handoff V2.4 & Anomali MC-6

### Handoff V2.4
- Engine Job Trace memanfaatkan langsung fungsi kanonikal `deriveCanonicalHandoffsFromPipeline()` dari V2.4.
- ID handoff (`handoff_id`) dan evidence hash digunakan kembali tanpa re-abstraksi terpisah.

### Anomali MC-6
- Anomali hanya dikaitkan ke dalam timeline jika terdapat bukti tautan eksplisit (`anomaly.task_id === taskId` atau `anomaly.entity_id === artifactId`).
- Korelasi berbasis kemiripan timestamp semata dilarang keras (*Zero timestamp coincidence linking*).

---

## 9. Semantik Workflow Khusus

1. **`QUEUED` vs `RUNNING`:**
   - `QUEUED` adalah status nyata (misalnya: artikel sudah selesai disetujui, masuk ke Publication Queue, namun `AUTO_PUBLISH = OFF`).
   - `QUEUED` **TIDAK BOLEH** ditampilkan sebagai `RUNNING`.
2. **`BLOCKED`:**
   - Ditampilkan dengan jelas jika Kill Switch aktif, Circuit Breaker OPEN, atau anomali berstatus CRITICAL menghentikan tugas. Menampilkan bukti blocker dan tidak memalsukan durasi selesai.
3. **Rollback & Rejeksi (`REJECTED`):**
   - Jika Chief Editor (Rina) menolak naskah kembali ke Joko (Writing), event penolakan ditampilkan apa adanya (*Truth > Prettiness*). Timeline tidak menyembunyikan riwayat iterasi naskah.

---

## 10. Kebijakan Keselamatan Staf (Safety Invariants)

- **Budi (Media Worker):** Status efektif Media Worker tetap **DISABLED**. Jika terdapat rekaman media lama di database, timeline menampilkannya secara historis faktual, tetapi status terkini Budi tetap dinyatakan `STANDBY` / `OFFLINE` (*Worker Disabled*).
- **Maya (Social):** Status Social tetap **HOLDING**. Tidak ada stage distribusi media sosial yang diada-adakan ke dalam workflow artikel saat ini.
- **TypeSafe Jev:** Tetap dalam mode **SHADOW**. JEV tidak pernah ditampilkan sebagai pemilik tugas (*workflow owner*). Catatan JEV hanya dapat muncul sebagai metadata observasi pasif.

---

## 11. Arsitektur Antarmuka (UI & Entry Points)

- **Lokasi Modal/Drawer:** Job Trace dirender di luar canvas Pixel Office (`#job-trace-modal`), menjaga canvas 2D tetap fokus sebagai representasi spasial dan memisahkan observabilitas bukti operasional.
- **Titik Masuk (Entry Points):**
  1. Tombol `Lihat Trace →` di setiap baris tabel *Recent Handoffs*.
  2. Tombol `Lihat Timeline / Job Trace →` di dalam *Staff Inspector Modal* saat staf sedang aktif mengerjakan tugas atau baru saja melakukan handoff.
  3. Tombol skenario dev QA (`Trace A` s/d `Trace E`) untuk verifikasi visual cepat pada environment lokal.
- **Aksesibilitas:** Timeline dapat dibaca secara mandiri tanpa bergantung pada warna atau animasi, dengan badge status teks yang jelas dan navigasi keyboard ramah pengguna.

---

## 12. Keamanan & Batasan API (API & Security Boundary)

- **Endpoint:** `GET /api/admin/mission-control/job-trace?task_id=<id>`
- **Metode HTTP:** Hanya `GET`. Akses `POST`, `PUT`, `DELETE` ditolak dengan `405 Method Not Allowed`.
- **Autentikasi:** Wajib melewati middleware autentikasi admin RancangLoka. Akses publik ditolak dengan `401 Unauthorized`.
- **Strictly Read-Only:** Endpoint tidak melakukan mutasi status database, tidak mengubah antrean, dan tidak memicu webhook.
- **Redaksi Rahasia:** API key, token HMAC, dan rahasia internal secara otomatis diredaksi sebelum dikirim ke antarmuka operator.

---

## 13. Verifikasi & Suite Pengujian Otomatis

Seluruh logika diverifikasi secara komprehensif melalui suite pengujian dedicated:
```bash
node scripts/test-pixel-office-job-trace.js
```
Mencakup 24 skenario uji kritis:
1. Rekaman kanonikal sama menghasilkan trace yang identik (*deterministic idempotency*).
2. Workflow ID berbeda tidak pernah bercampur (*strict tenant/task isolation*).
3. Status saat ini tidak dapat memalsukan riwayat masa lalu (*no synthetic history*).
4. Pengurutan timeline menggunakan timestamp kanonikal.
5. Rekaman usang tidak mengacaukan kebenaran saat ini.
6. Bukti yang hilang menghasilkan `EVIDENCE_GAP`, bukan event rekaan.
7. ID handoff V2.4 digunakan kembali secara konsisten.
8. `QUEUED` tetap berbeda dari `RUNNING`.
9. `BLOCKED` ditampilkan secara eksplisit beserta buktinya.
10. Rollback kanonikal (`REJECTED`) muncul dalam urutan kronologis yang benar.
11. Durasi tahapan hanya dihitung dari batas yang terbukti.
12. Durasi berjalan pada tahap saat ini diturunkan dari timestamp awal kanonikal.
13. Rekaman ganda dideduplikasi secara otomatis.
14. Refresh menghasilkan trace yang 100% konsisten.
15. Konsistensi lintas-sesi browser terjaga.
16. Bukti historis Budi diizinkan, tetapi status Budi terkini tetap menghormati gate `DISABLED`.
17. Maya tidak menerima event palsu distribusi sosial.
18. JEV tidak pernah ditampilkan sebagai pemilik tugas.
19. Endpoint trace mewajibkan autentikasi admin.
20. Endpoint trace tidak memiliki kemampuan mutasi (*read-only*).
21. Tidak ada `Date.now()` atau poll timestamp yang dipakai untuk identitas event.
22. Event kanonikal baru ditambahkan satu kali (*no duplicate append*).
23. Anomali tanpa korelasi bukti tidak dikaitkan semata-mata karena kedekatan waktu.
24. Anomali yang terbukti tertaut ditampilkan dengan benar pada tugas bersangkutan.
