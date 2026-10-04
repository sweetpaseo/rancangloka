# Hermes Mission Control — Anomaly Intelligence Layer (MC-INTEL-1)

## Operational Diagnosis, Correlation, Impact Analysis & Recommendation Engine

**Dokumen Arsitektur & Spesifikasi Teknis v1.0**  
**Milestone:** `MC-INTEL-1`  
**Status:** Canonical & Implemented  
**Target Komponen:** `src/lib/mission-control/anomaly-intelligence.ts`, `src/pages/api/admin/mission-control/anomalies.ts`, `src/pages/admin/mission-control/office.astro`, `scripts/test-mission-control-anomaly-intel.js`

---

## 1. Ringkasan Eksekutif & Tujuan Milestone

Sebelum milestone **MC-INTEL-1**, anomali dalam Mission Control hanya berbentuk catatan peringatan mentah (*raw alert records*) dengan penanda sederhana (misal: "RESEARCH_PACK_FAILED" atau "CIRCUIT_BREAKER_OPEN"). Operator manusia harus menebak sendiri:
- Apa sebenarnya yang terjadi?
- Seberapa parah dampaknya terhadap penerbitan?
- Apakah masalah ini insiden baru atau kegagalan berulang (*recurring*)?
- Siapa personel atau departemen yang bertanggung jawab?
- Apa bukti kanonikal yang mendasari alarm tersebut?
- Tindakan manusia apa yang aman dan direkomendasikan berikutnya?

**MC-INTEL-1** mengubah rekaman anomali mentah menjadi lapisan intelijen operasional deterministik (*Deterministic Operational Intelligence Layer*) yang mematuhi paradigma:

```
OBSERVE → CLASSIFY → CORRELATE → EXPLAIN → RECOMMEND
```

### Invarian Keselamatan Mutlak
Sistem intelijen ini **BUKAN** mesin remediasi otomatis (*NOT autonomous remediation*). Sistem ini bersifat murni **READ / ANALYZE / RECOMMEND ONLY**. Otoritas eksekusi dan keputusan final 100% berada di tangan operator manusia (*Human Authority Remains Absolute*).

---

## 2. Taksonomi Anomali Kanonikal (11 Kategori)

Lapisan intelijen memetakan semua kegagalan sistem riil ke dalam 11 kategori taksonomi terstruktur:

| Kategori | Definisi & Contoh Kegagalan |
|---|---|
| `DATA_INTEGRITY` | Kegagalan integritas sistemik, saklar darurat aktif (`EMERGENCY_KILL_SWITCH_ACTIVE`), atau pemutus sirkuit terbuka (`CIRCUIT_BREAKER_OPEN`). |
| `TELEMETRY_STALE` | Sinyal heartbeat usang atau daemon scheduler kontainer Hermes mati (`HERMES_HEARTBEAT_STALE`, `HERMES_HEARTBEAT_OFFLINE`). |
| `WORKER_UNAVAILABLE` | Pekerja media dinonaktifkan sesuai kebijakan (`MEDIA_WORKER_DISABLED`), kegagalan tahap render (`MEDIA_STAGE_FAILURE`), atau percobaan ulang habis (`MEDIA_RETRY_EXHAUSTED`). |
| `EVIDENCE_INCOMPLETE` | Riset bukti teknis terhambat, sitasi empiris atau rujukan SNI tidak lengkap (`RESEARCH_PACK_FAILED`). |
| `PIPELINE_BLOCKED` | Pelanggaran aturan editorial/anti-slop (`EDITORIAL_VALIDATION_FAILED`, `EDITORIAL_QA_FAILED`), atau kampanye sosial terhambat (`SOCIAL_CAMPAIGN_BLOCKED`). |
| `PUBLICATION_STALLED` | Eksekusi Cloudflare Cron gagal atau antrean publikasi tertahan (`CRON_JOB_FAILED`). |
| `HANDOFF_FAILURE` | Antrean dead-letter outbox terisi paket draf yang gagal terkirim setelah retry maksimal (`OUTBOX_DEAD_LETTER`). |
| `AUTH_FAILURE` | Sesi token OAuth kedaluwarsa atau izin akun belum lengkap (`SOCIAL_AUTH_REAUTH_REQUIRED`, `SOCIAL_PERMISSION_INCOMPLETE`). |
| `DEPENDENCY_FAILURE` | Kegagalan upstream eksternal, model OpenRouter tidak terjangkau (`JEV_PROVIDER_ERROR`). |
| `HEALTH_DEGRADED` | Circuit breaker mode uji (`CIRCUIT_BREAKER_HALF_OPEN`), penyedia Jev beralih ke fallback lokal, atau otomasi berstatus OFF sesuai desain. |
| `JOB_STALE` | Tugas aktif yang tidak menunjukkan progres melebihi batas waktu toleransi normal. |

---

## 3. Model Keparahan Deterministik (5 Tingkat)

Keparahan diturunkan secara deterministik dari kondisi nyata sistem, bukan berdasarkan heuristik teks bebas:

```
  [INFO]       Kondisi dormansi yang diharapkan sesuai desain keselamatan (By Design).
               Contoh: Media worker DISABLED, Automation mode OFF. Dampak = 0.
    ↓
  [LOW]        Degradasi minor tanpa memblokir alur kerja editorial utama.
               Contoh: Circuit breaker HALF_OPEN, heartbeat stale ringan (<600s).
    ↓
  [MEDIUM]     Satu tugas pipeline terhambat, atau fallback lokal aktif tanpa mengganggu artikel lain.
               Contoh: JEV provider fallback, kegagalan draf pertama tugas riset.
    ↓
  [HIGH]       Beberapa tugas terkait terhenti, antrean dead-letter terisi, atau kegagalan berulang (≥3x).
               Contoh: OUTBOX_DEAD_LETTER, HERMES_HEARTBEAT_OFFLINE, MEDIA_RETRY_EXHAUSTED.
    ↓
  [CRITICAL]   Kegagalan integritas sistemik total atau saklar darurat aktif.
               Contoh: EMERGENCY_KILL_SWITCH_ACTIVE, global publisher breaker OPEN.
```

---

## 4. Analisis Dampak & Radius Ledakan (*Conservative Blast Radius*)

Sistem menghitung dampak secara konservatif agar operator tidak panik berlebih dan tidak menyalahkan departemen yang tidak bersalah:

* **Minimal (`MINIMAL`):** Untuk kondisi `INFO` / `EXPECTED`. Nol departemen dan nol staf aktif yang terhambat.
* **Terlokalisasi (`LOCALIZED`):** Terisolasi pada satu departemen teknis (misal: pekerja media nonaktif hanya berdampak pada Budi di Media Operations; penulisan teks Joko dan riset Irwan tetap 100% normal).
* **Signifikan (`SIGNIFICANT`):** Memblokir alur antar-departemen (misal: kegagalan riset Irwan memblokir Joko memulai penulisan naskah; tahap `writing` dan `editorial_qa` terhenti).
* **Sistemik (`SYSTEMIC`):** Seluruh penerbitan terkunci darurat (saklar darurat global atau circuit breaker penerbitan terbuka).

---

## 5. Pola Deteksi & Rekurensi

Mengidentifikasi perilaku anomali tanpa algoritma ML yang tidak transparan:
1. `SINGLE_INCIDENT`: Insiden pertama kali terjadi (occurrence count = 1).
2. `REPEATED_TASK_FAILURE`: Kegagalan berulang pada tugas yang sama (occurrence count ≥ 3).
3. `PERSISTENT_OUTAGE`: Anomali tetap berstatus `OPEN` lebih dari 30 menit.
4. `REOPENED_AFTER_RESOLUTION`: Anomali yang sebelumnya telah terselesaikan secara otomatis atau manual namun muncul kembali.

---

## 6. Pemisahan Ketat Fakta vs Inferensi (*Fact vs Inference*)

Sistem intelijen mewajibkan pembedaan eksplisit antara **FAKTA** dan **INFERENSI**:

```
FAKTA (Classification: FACT, Confidence: 1.0)
• Kondisi yang terukur secara langsung pada basis data atau saklar keselamatan.
• Contoh: automation_control.killSwitchEngaged === true (Keyakinan: 100%).
• Contoh: failureCount >= failureThreshold pada circuit breaker (Keyakinan: 100%).

INFERENSI (Classification: INFERENCE, Confidence: 0.70 - 0.95)
• Dugaan penyebab yang diturunkan dari analisis pesan kesalahan atau konteks eksekusi.
• Contoh: "Draf riset kekurangan sitasi empiris / SNI" (Keyakinan: 90% berdasarkan teks "sitasi tidak lengkap").
• Contoh: "API OpenRouter mengalami degradasi latensi/kuota" (Keyakinan: 82% berdasarkan error HTTP 5xx).
```
> **Aturan Mutlak:** Dilarang memberi label FAKTA pada kondisi yang merupakan hasil inferensi.

---

## 7. Rekomendasi Tindakan Manusia yang Aman (*Safe Human Recommendations*)

Setiap anomali memberikan rekomendasi tindakan yang terintegrasi langsung dengan gerbang tindakan operator manusia (**MC-LIVEOPS-3 Action Gate**):

1. **`ACKNOWLEDGE_ANOMALY`:** Mengakui anomali aktif untuk mencatat audit dan meredam alarm ganda (Low-Risk Internal).
2. **`REQUEST_EVIDENCE_FOLLOWUP`:** Menugaskan Irwan melengkapi sitasi SNI/empiris pada draf riset yang terhambat.
3. **`ESCALATE_BLOCKED_TASK`:** Melakukan eskalasi formal naskah terhambat ke antrean Chief Editor.
4. **`REQUEST_HUMAN_REVIEW`:** Mengunci naskah untuk peninjauan manual editor sebelum disetujui (Governance Review).
5. **`INSPECT_JOB_TRACE`:** Membuka linimasa audit kanonikal tugas terkait.
6. **`CHECK_TELEMETRY` / `VERIFY_PROVIDER_CREDENTIALS`:** Saran inspeksi manual non-mutasi.

### Larangan Keras (*Strict Prohibitions*)
- Dilarang merekomendasikan pengaktifan otomatisasi publikasi (`AUTO_PUBLISH`).
- Dilarang merekomendasikan bypass persetujuan manusia.
- Dilarang merekomendasikan aktivasi otomatis media worker jika dinonaktifkan oleh kebijakan.
- Dilarang memberikan saran yang mengeksekusi wewenang atas nama Jefry/JEV.

---

## 8. Skor Anomali Operasional (*Deterministic Anomaly Score*)

Formula transparan berskala 0 hingga 100:

$$\text{Score} = \text{BasePoints}(\text{Severity}) + \text{RecurrencePenalty} + \text{BlastRadiusPenalty} + \text{DurationPenalty}$$

* **Base Points:** `CRITICAL` = 50, `HIGH` = 35, `MEDIUM` = 20, `LOW` = 10, `INFO` = 0.
* **Recurrence Penalty:** $\min(20, (\text{count} - 1) \times 5)$.
* **Blast Radius Penalty:** $\min(15, \text{affectedDepts} \times 5)$.
* **Duration Penalty:** $\ge 15\text{m} = +5$, $\ge 30\text{m} = +10$, $\ge 60\text{m} = +15$.

---

## 9. Integrasi Pixel Office & Live Event Delivery

1. **Pixel Office Inspector:** Saat mengklik sprite atau workstation yang memiliki anomali aktif, modal inspektor menampilkan kartu intelijen lengkap:
   - Header kategori & badge keparahan 5 tingkat.
   - Skor operasional (/100).
   - Radius dampak dan pola rekurensi.
   - Dugaan penyebab dengan penanda `[FAKTA]` atau `[INFERENSI]` dan persentase keyakinan.
   - Tombol tindakan cepat (`⚡ Akui Anomali`, `⚡ Minta Tindak Lanjut Bukti`, dll.) yang langsung membuka dialog pratinjau MC-LIVEOPS-3.
2. **MC-LIVEOPS-4 Revision Feed:** Token revisi `deriveCanonicalRevision` menyertakan `anomaly_id`, `state`, `severity`, dan `occurrence_count`. Setiap perubahan status atau eskalasi keparahan seketika memicu pembaruan revisi kanonikal tanpa jeda.

---

## 10. Batasan Jefry & Persiapan MC-INTEL-2

Pada milestone **MC-INTEL-1**, struktur data anomali telah disiapkan dalam bentuk terstandarisasi yang siap dibaca oleh entitas penasihat manajemen Jefry (TypeSafe JEV).  
Namun, **Jefry tetap memiliki 0 otoritas eksekusi dan belum menjalankan logika prioritas eksekutif silang-anomali**. Fitur tersebut ditangguhkan secara terencana untuk milestone **MC-INTEL-2 — Jefry Management Advisory**.

---

*Dokumen ini diterbitkan pada 4 Oktober 2026 setelah seluruh 22 pengujian dalam test-mission-control-anomaly-intel.js berhasil diverifikasi.*
