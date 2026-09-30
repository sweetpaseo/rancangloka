# HERMES-MC-9: Mission Control Role & Job Animation Layer

> **Dokumentasi Rekayasa & Spesifikasi Visual State**  
> Status: `PRODUCTION_READY`  
> Milestone: `HERMES-MC-9`  
> Deployment: Live on Cloudflare Workers (`https://rancangloka.com/admin/mission-control/office`)  
> Tanggal Implementasi: 30 September 2026  

---

## 1. Ikhtisar & Tujuan

Milestone **HERMES-MC-9** mengimplementasikan lapisan animasi peran dan tugas (*Role & Job Animation Layer*) untuk dasbor **Pixel Office** Hermes Mission Control.

### Prinsip Utama (The Invariant of Real Work)
```
REAL TASK → CAPABILITY → STAFF → JOB VISUAL STATE → ROLE-SPECIFIC ANIMATION
```
* **No Real Task = No Working Animation.**  
* Sistem dilarang keras merekayasa aktivitas (*fake work*), membuat staf pura-pura mengetik, meneliti, atau memproses media ketika tidak ada tugas aktif yang sedang berjalan.
* Staf tidak pernah mondar-mandir secara acak (*zero random movement*).
* Status `QUEUED` dalam command queue MC-5 **TIDAK** memicu animasi kerja. Staf baru beralih ke animasi kerja spesifik peran ketika tugas berada dalam status **`RUNNING`**.
* Ketika tugas selesai (`COMPLETED`), animasi kerja segera berhenti dan staf kembali ke Lounge (*Area Rehat & Siaga*).

---

## 2. Model Status Visual Pekerjaan (`StaffWorkVisualState`)

Model status visual pekerjaan didefinisikan secara sentral dan bertipe ketat (*type-safe*) pada `src/lib/mission-control/job-animation-registry.ts`:

```typescript
export interface StaffWorkVisualState {
  agent_id: string;
  capability_id: StaffCapability;
  task_id: string | null;
  task_type: string | null;
  task_status: string | null;
  task_label: string | null;
  animation_key: JobAnimationKey;
  workstation_key: OfficeWorkstationKey;
  visual_detail: string;
  started_at: string | null;
  freshness: 'FRESH' | 'RECENT' | 'STALE' | 'UNKNOWN';
  evidence_reference: string;
  is_actively_working: boolean;
}
```

Semua properti diturunkan secara murni (*pure deterministic derivation*) dari read model snapshot telemetri Mission Control, antrean perintah (`MC-5`), dan pendaftaran staf (`MC-2`).

---

## 3. Registri Animasi Sentral (`JOB_ANIMATION_REGISTRY`)

Seluruh definisi animasi dikelola di `src/lib/mission-control/job-animation-registry.ts` untuk mencegah logika animasi tersebar di template UI Astro:

| Animation Key | Target Agent | Deskripsi Visual | Visual Prop | CSS Class |
|---|---|---|---|---|
| `IDLE_STANDBY` | Semua staf | Duduk/berdiri santai di Lounge, pernapasan ritmis halus | ☕ | `animate-idle-breathing` |
| `ARTICLE_TYPING` | `content_writer_primary` (Joko) | Mengetik di meja Editorial, laptop/monitor aktif | ⌨️ | `animate-typing-loop` |
| `ARTICLE_REWRITE` | `content_writer_primary` (Joko) | Revisi naskah narasumber/editorial dengan indikator edit | 📝 | `animate-rewrite-pulse` |
| `RESEARCH_BROWSING` | `evidence_researcher_lead` (Irwan) | Penelusuran standar SNI / literatur di lab riset | 🔍 | `animate-research-scan` |
| `EVIDENCE_READING` | `evidence_researcher_lead` (Irwan) | Pembacaan tumpukan sitasi dan dokumen referensi | 📑 | `animate-evidence-flip` |
| `QA_REVIEW` | `editorial_qa_primary` (Rina) | Pemeriksaan kepatuhan redaksional & First Article Gate | ⚖️ | `animate-qa-review` |
| `QA_CHECKLIST` | `editorial_qa_primary` (Rina) | Verifikasi butir checklist verifikasi editorial | ✅ | `animate-checklist-check` |
| `MEDIA_PROCESSING` | `lokamedia_worker_primary` (Budi) | Rendering & generasi gambar LokaMedia di konsol media | 🖼️ | `animate-media-render` |
| `MEDIA_REVIEW` | `lokamedia_worker_primary` (Budi) | Inspeksi bingkai foto dan metadata Cloudflare R2 | 🔬 | `animate-media-inspect` |
| `PUBLICATION_MONITORING` | `publication_dispatcher_core` (Sari) | Pemantauan kuota harian & jadwal rilis (Automation OFF) | 📋 | `animate-schedule-pulse` |
| `PUBLICATION_DISPATCH` | `publication_dispatcher_core` (Sari) | Dispatch atomik penerbitan artikel ke publik (Hanya jika aktif) | 🚀 | `animate-dispatch-pulse` |
| `TELEMETRY_MONITORING` | `telemetry_observer_jev` (Dimas) | Pemantauan grafik metrik dan kesehatan sistem edge | 📊 | `animate-telemetry-wave` |
| `JEV_ANALYSIS` | `telemetry_observer_jev` (Dimas) | Evaluasi keputusan bayangan TypeSafe Jev (Zero authority) | 📡 | `animate-jev-radar` |
| `BLOCKED_WARNING` | Staf terdampak | Terhenti di meja departemen dengan penanda waspada | ⚠️ | `animate-bounce` |
| `OFFLINE_DISABLED` | Staf nonaktif terencana (Budi) | Konsol temaram, lencana Worker Disabled, tanpa alarm | ⏸️ | - |
| `UNKNOWN_NEUTRAL` | Fallback | Postur netral aman tanpa klaim beban kerja | ❔ | - |
| `WORKING_GENERIC` | Fallback kerja umum | Postur kerja aman ketika jenis tugas tidak terklasifikasi | ⚙️ | `animate-pulse` |

---

## 4. Perilaku Berdasarkan Peran Staf

### 4.1. Joko — Content Writer (`content_writer_primary`)
- **Tugas Menulis Aktif:** Memicu `ARTICLE_TYPING` dengan lencana keyboard di meja Editorial.
- **Tugas Revisi Aktif:** Memicu `ARTICLE_REWRITE`.
- **Tidak ada tugas:** Duduk siaga di Lounge dengan `IDLE_STANDBY`.

### 4.2. Irwan — Research & Evidence (`evidence_researcher_lead`)
- **Riset Fakta:** Memicu `RESEARCH_BROWSING` di Research Lab.
- **Review Sitasi:** Memicu `EVIDENCE_READING`.
- **Tidak ada tugas:** Duduk siaga di Lounge.

### 4.3. Rina — Editorial QA (`editorial_qa_primary`)
- **Pemeriksaan Naskah:** Memicu `QA_REVIEW` di meja Editorial QA.
- **First Article Gate:** Memicu `QA_CHECKLIST`. Animasi ini merepresentasikan proses verifikasi, bukan persetujuan otomatis.

### 4.4. Budi — Media Operations (`lokamedia_worker_primary`)
- **Invariant Produksi:** Pekerja media saat ini berada dalam status **`DISABLED`**.
- Budi secara konsisten menampilkan **`OFFLINE_DISABLED`** dengan stempel *Worker Disabled* dan konsol temaram, tanpa memicu alarm merah atau kepanikan.
- Budi **TIDAK PERNAH** menampilkan animasi `MEDIA_PROCESSING` kecuali pekerja diaktifkan secara sah dan terdapat antrean job riil yang sedang di-lease.

### 4.5. Sari — Publication Operations (`publication_dispatcher_core`)
- **Invariant Produksi:** Mode otomatisasi saat ini adalah **`automation_mode = OFF`**.
- Sari menampilkan **`PUBLICATION_MONITORING`** atau **`IDLE_STANDBY`**.
- Animasi `PUBLICATION_DISPATCH` dilarang keras muncul kecuali dispatcher benar-benar mengeksekusi pipeline publikasi atomik secara sah.

### 4.6. Dimas — Engineering & Telemetry (`telemetry_observer_jev`)
- **Invariant Produksi:** TypeSafe Jev beroperasi secara **`SHADOW MODE ONLY`** dengan **`ZERO PUBLICATION AUTHORITY`**.
- Dimas menampilkan `TELEMETRY_MONITORING` atau `IDLE_STANDBY`.
- Ketika observasi bayangan Jev diproses, `JEV_ANALYSIS` muncul untuk menggambarkan evaluasi non-blocking tanpa mengklaim otoritas penerbitan artikel.

---

## 5. Siklus Hidup Status Tugas & Transisi Spasial

| Tahap Tugas | Status Visual | Lokasi Spasial | Animasi Aktif? |
|---|---|---|---|
| `QUEUED` | `IDLE_STANDBY` | Executive Lounge | ❌ Tidak (Hanya antrean menunggu) |
| `ACCEPTED` | `IDLE_STANDBY` | Executive Lounge | ❌ Tidak (Persiapan) |
| `RUNNING` | Sesuai Peran (misal `ARTICLE_TYPING`) | Workstation Departemen | ✅ Ya |
| `COMPLETED` | `IDLE_STANDBY` | Executive Lounge | ❌ Berhenti seketika |
| `BLOCKED` / `FAILED` | `BLOCKED_WARNING` | Workstation Departemen | ⚠️ Peringatan stasioner |
| `OFFLINE` | `OFFLINE_DISABLED` | Meja Departemen (Temaram) | ⏸️ Nonaktif tanpa alarm |

---

## 6. Aksesibilitas (`prefers-reduced-motion`)

Semua animasi CSS dikondisikan secara ketat terhadap preferensi aksesibilitas pengguna:
```css
@media (prefers-reduced-motion: reduce) {
  .animate-typing-loop,
  .animate-rewrite-pulse,
  .animate-research-scan,
  .animate-evidence-flip,
  .animate-qa-review,
  .animate-checklist-check,
  .animate-media-render,
  .animate-media-inspect,
  .animate-schedule-pulse,
  .animate-dispatch-pulse,
  .animate-telemetry-wave,
  .animate-jev-radar,
  .animate-idle-breathing {
    animation: none !important;
    transform: none !important;
  }
}
```
Ketika `prefers-reduced-motion` aktif, semua efek getar, pernapasan, dan rotasi dinonaktifkan sepenuhnya. Informasi operasional tetap tersampaikan secara akurat melalui koordinat tata ruang dan label teks kompak.

---

## 7. Panel Inspektur Staf (Pixel Office Inspector)

Ketika operator mengklik ikon staf di Pixel Office, modal inspektur menyajikan data transparan:
- **Nama Tampilan & Peran:** (Contoh: `Dimas — Decision & Telemetry Analyst`)
- **Animasi Kerja:** Nilai kunci registri (Contoh: `IDLE_STANDBY`, `OFFLINE_DISABLED`)
- **Detail Visual:** Keterangan penjelasan visual deterministik
- **Ruangan & Posisi Spasial:** ID ruangan dan posisi meja kerja
- **Status Tugas:** ID tugas nyata, status eksekusi, dan kesegaran (*FRESH / RECENT / STALE*)
- **Catatan Transparansi:** `⚡ Visualisasi berdasarkan telemetry nyata`

---

## 8. Verifikasi & Pengujian

Suite pengujian komprehensif dibuat pada `scripts/test-mission-control-job-animation.js` mencakup 21 skenario:
1. `Joko active writing → ARTICLE_TYPING`
2. `Joko queued task → no typing (IDLE_STANDBY)`
3. `Irwan research → RESEARCH_BROWSING & EVIDENCE_READING`
4. `Rina QA → QA_REVIEW & QA_CHECKLIST`
5. `Budi disabled → OFFLINE_DISABLED`
6. `Budi real running media task → MEDIA_PROCESSING (enabled)`
7. `Sari automation OFF → no publication dispatch`
8. `Dimas JEV shadow idle → no fake JEV processing`
9. `Dimas active observation → JEV_ANALYSIS`
10. `Completed task stops working animation`
11. `Blocked task maps BLOCKED_WARNING`
12. `Unknown task maps safe fallback`
13. `IDLE goes Lounge`
14. `WORKING goes workstation`
15. `No random movement (positions strictly deterministic)`
16. `No random animation (baseline strictly idle/disabled)`
17. `Real task label preserves genuine task title`
18. `Stable canonical machine IDs verified`
19. `Reduced motion compatibility verified`
20. `Zero execution authority verified`
21. `Social department remains unstaffed with zero animations`

**Hasil Pengujian:**
- `test-mission-control-job-animation.js`: **21/21 PASS**
- `test-mission-control-pixel-office.js`: **20/20 PASS**
- `test-mission-control-chat.js`: **20/20 PASS**
- `test-mission-control-anomalies.js`: **18/18 PASS**
- `test-mission-control-expansion.js`: **18/18 PASS**
- `test-mission-control-departments.js`: **18/18 PASS**
- `test-staff-registry.js`: **16/16 PASS**
- `test-mission-control.js`: **10/10 PASS**
- `test-soak-safety.js`: **54/54 PASS**
- `npx tsc --noEmit`: **0 ERRORS**
- `npm run build`: **SUCCESS**
- Browser Subagent Live Verification: **SUCCESS** (Overview, Dimas modal, Budi modal)
